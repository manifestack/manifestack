// Reads and updates STACK.md, evaluates `revisit_when` and keeps secrets out of the file.
// Updates touch only the named fields: other lines, unknown keys and user comments stay as they are.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { isMain, parseArgs, printJson, fail, todayIso } from './cli-util.mjs';
import { parseQuantity, eta, approxMonth } from './project.mjs';

export const STACK_ROLES = ['Hosting', 'Database', 'Auth', 'Email', 'Storage', 'Payments', 'Monitoring', 'Other'];
export const STACK_KEYS = ['plan', 'limit', 'source', 'usage', 'decided', 'revisit_when', 'next', 'env'];
export const REQUIREMENT_KEYS = ['budget', 'users', 'requires', 'team_knows'];
export const REVISIT_METRICS = ['db_size', 'monthly_sent', 'daily_peak', 'transfer_tb', 'mau', 'users', 'monthly_bill', 'date'];

const SECRET_PATTERNS = [
	['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
	['URL with credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@\S+/i],
	['API key (sk_/pk_/rk_)', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/],
	['Supabase key', /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/],
	['Resend key', /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9_]{8,}|\bre_[A-Za-z0-9]{24,}/],
	['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/],
	['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
	['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
	['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
	['Neon API key', /\bnapi_[A-Za-z0-9]{16,}/],
	// Only names that usually hold secrets: NODE_ENV=production in a note is fine.
	['env assignment', /\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|DSN|CREDENTIALS?|PRIVATE)[A-Z0-9_]*\s*=\s*['"]?[^\s'"]{6,}/],
	['long token', /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/],
];

/** Finds strings that look like secrets. STACK.md must never contain one. */
export function findSecrets(text) {
	const hits = [];
	text.split(/\r?\n/).forEach((line, idx) => {
		for (const [kind, re] of SECRET_PATTERNS) if (re.test(line)) hits.push({ line: idx + 1, kind });
	});
	return hits;
}

export function scrubSecrets(text) {
	let out = text;
	for (const [, re] of SECRET_PATTERNS) out = out.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), '[removed]');
	return out;
}

function splitComment(raw) {
	const m = /(\s+#\s?)(.*)$/.exec(raw);
	if (!m) return { value: raw.trim(), comment: null, commentRaw: '' };
	return { value: raw.slice(0, m.index).trim(), comment: m[2].trim(), commentRaw: raw.slice(m.index) };
}

export function parseStackMd(text) {
	const lines = text.split(/\r?\n/);
	const sections = [];
	let current = null;
	let fence = false;
	lines.forEach((line, idx) => {
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) return;
		const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
		if (h) {
			const heading = h[1];
			const rv = /^([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/.exec(heading);
			current = {
				heading,
				kind: /^requirements$/i.test(heading) ? 'requirements' : rv ? 'service' : 'other',
				role: rv ? rv[1] : null,
				vendor: rv ? rv[2] : null,
				line: idx + 1,
				fields: {},
			};
			sections.push(current);
			return;
		}
		if (/^#\s/.test(line)) {
			current = null;
			return;
		}
		if (!current) return;
		const f = /^([a-z_][a-z0-9_]*)\s*:(.*)$/.exec(line);
		if (f && !(f[1] in current.fields)) current.fields[f[1]] = { ...splitComment(f[2]), line: idx + 1 };
	});
	const values = (s) => Object.fromEntries(Object.entries(s.fields).map(([k, v]) => [k, v.value]));
	const req = sections.find((s) => s.kind === 'requirements');
	return {
		requirements: req ? values(req) : null,
		sections: sections.map((s) => ({ heading: s.heading, kind: s.kind, role: s.role, vendor: s.vendor, line: s.line, values: values(s), comments: Object.fromEntries(Object.entries(s.fields).filter(([, v]) => v.comment).map(([k, v]) => [k, v.comment])) })),
	};
}

const sameHeading = (a, b) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Sets fields in one section, creating the section if needed.
 * `updates` is { key: value }, `comments` is { key: comment } (an existing comment is kept unless replaced).
 */
export function setFields(text, heading, updates, comments = {}) {
	for (const [k, v] of Object.entries(updates)) {
		if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`invalid key "${k}"`);
		if (/[\r\n]/.test(String(v))) throw new Error(`value for ${k} must be one line`);
		if (findSecrets(`${k}: ${v}`).length) throw new Error(`value for ${k} looks like a secret; STACK.md must not contain secrets`);
	}
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const lines = text.length ? text.split(/\r?\n/) : [];
	let section = parseStackMdRaw(lines).find((s) => sameHeading(s.heading, heading));
	if (!section) {
		while (lines.length && lines.at(-1) === '') lines.pop();
		if (lines.length) lines.push('');
		lines.push(`## ${heading}`);
		section = { headingLine: lines.length - 1, fields: {} };
		lines.push('');
	}
	for (const [key, value] of Object.entries(updates)) {
		const existing = section.fields[key];
		const comment = comments[key] != null ? `  # ${comments[key]}` : existing?.commentRaw ?? '';
		const line = `${key}: ${value}${comment}`;
		if (existing) {
			lines[existing.idx] = line;
			continue;
		}
		const at = insertionIndex(lines, section, key);
		lines.splice(at, 0, line);
		// Re-read positions after the insert.
		section = parseStackMdRaw(lines).find((s) => s.headingLine === section.headingLine);
	}
	let out = lines.join(eol);
	if (!out.endsWith(eol)) out += eol;
	return out.replace(new RegExp(`(${eol}){3,}$`), eol);
}

function parseStackMdRaw(lines) {
	const sections = [];
	let current = null;
	let fence = false;
	lines.forEach((line, idx) => {
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) return;
		const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
		if (h) {
			current = { heading: h[1], headingLine: idx, fields: {}, lastLine: idx };
			sections.push(current);
			return;
		}
		if (/^#\s/.test(line)) {
			current = null;
			return;
		}
		if (!current) return;
		const f = /^([a-z_][a-z0-9_]*)\s*:(.*)$/.exec(line);
		if (f && !(f[1] in current.fields)) {
			current.fields[f[1]] = { idx, ...splitComment(f[2]) };
			current.lastLine = idx;
		}
	});
	return sections;
}

function insertionIndex(lines, section, key) {
	const keys = Object.keys(section.fields);
	const order = [...REQUIREMENT_KEYS, ...STACK_KEYS];
	const pos = order.indexOf(key);
	if (pos !== -1) {
		const before = keys.filter((k) => order.indexOf(k) !== -1 && order.indexOf(k) < pos).sort((a, b) => section.fields[a].idx - section.fields[b].idx);
		if (before.length) return section.fields[before.at(-1)].idx + 1;
		const after = keys.filter((k) => order.indexOf(k) > pos).sort((a, b) => section.fields[a].idx - section.fields[b].idx);
		if (after.length) return section.fields[after[0]].idx;
	}
	if (keys.length) return Math.max(...keys.map((k) => section.fields[k].idx)) + 1;
	return section.headingLine + 1;
}

/**
 * Reads a `usage` value: "312 MB, +1.1 MB/day (2026-10-06)", optionally named
 * ("db_size 312 MB, ..."), several entries separated by ";".
 * Returns { metricName | "_": { value, dim, ratePerDay?, growthPerMonth?, asOf? } }.
 */
export function parseUsage(raw) {
	const metrics = {};
	for (const entry of String(raw ?? '').split(';')) {
		let s = entry.trim();
		if (!s) continue;
		const d = /\((\d{4}-\d{2}-\d{2})\)/.exec(s);
		const asOf = d ? d[1] : null;
		if (d) s = s.replace(d[0], '').trim();
		let name = '_';
		const n = /^([a-z_][a-z0-9_]*)(?:\s*[=:]\s*|\s+)(?=[+$\d.])/.exec(s);
		if (n) {
			name = n[1];
			s = s.slice(n[0].length);
		}
		const parts = s.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
		let base;
		try {
			base = parseQuantity(parts[0]);
		} catch {
			continue;
		}
		const m = { value: base.value, dim: base.dim, asOf };
		for (const p of parts.slice(1)) {
			let r;
			try {
				r = parseQuantity(p);
			} catch {
				continue;
			}
			if (r.dim === 'pct') m.growthPerMonth = (r.value / 100) * (30.4375 / (r.per ?? 30.4375));
			else if (r.per) m.ratePerDay = r.value / r.per;
		}
		metrics[name] = m;
	}
	return metrics;
}

export function tokenizeRevisit(expr) {
	return String(expr)
		.split(/(\(|\)|\s+AND(?:\s+|$)|\s+OR(?:\s+|$))/i)
		.map((t) => t.trim())
		.filter(Boolean)
		.map((t) => (/^(and|or)$/i.test(t) ? t.toUpperCase() : t));
}

/** Parses `revisit_when` into a tree. Grammar: references/stack-md.md in the skill. */
export function parseRevisit(expr) {
	const tokens = tokenizeRevisit(expr);
	let i = 0;
	const peek = () => tokens[i];
	function parseOr() {
		const args = [parseAnd()];
		while (peek() === 'OR') {
			i++;
			args.push(parseAnd());
		}
		return args.length === 1 ? args[0] : { type: 'OR', args };
	}
	function parseAnd() {
		const args = [parsePrimary()];
		while (peek() === 'AND') {
			i++;
			args.push(parsePrimary());
		}
		return args.length === 1 ? args[0] : { type: 'AND', args };
	}
	function parsePrimary() {
		const t = tokens[i++];
		if (t === undefined) throw new Error('revisit_when: unexpected end');
		if (t === '(') {
			const node = parseOr();
			if (tokens[i++] !== ')') throw new Error('revisit_when: missing )');
			return node;
		}
		if (t === ')' || t === 'AND' || t === 'OR') throw new Error(`revisit_when: unexpected ${t}`);
		if (/^before\s+launch$/i.test(t)) return { type: 'manual', text: 'before launch' };
		const m = /^([a-z_][a-z0-9_]*)\s*(>=|<=|>|<)\s*(.+)$/i.exec(t);
		if (!m) throw new Error(`revisit_when: cannot read "${t}"`);
		const [, metric, op, rawValue] = m;
		if (metric === 'date') {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue.trim())) throw new Error(`revisit_when: date needs YYYY-MM-DD, got "${rawValue}"`);
			return { type: 'cmp', metric, op, date: rawValue.trim() };
		}
		const qty = parseQuantity(rawValue);
		return { type: 'cmp', metric, op, value: qty.value, dim: qty.dim, raw: rawValue.trim() };
	}
	const tree = parseOr();
	if (i < tokens.length) throw new Error(`revisit_when: unexpected "${tokens[i]}"`);
	return tree;
}

function revisitMetrics(node, out = new Set()) {
	if (node.type === 'cmp' && node.metric !== 'date') out.add(node.metric);
	for (const a of node.args ?? []) revisitMetrics(a, out);
	return out;
}

const compare = (a, op, b) => (op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : a <= b);

// A unitless threshold on a metric named *_mb, *_gb or *_tb is in that unit.
function thresholdIn(node, metricDim) {
	const unit = /_(mb|gb|tb)$/.exec(node.metric)?.[1];
	if (node.dim === 'count' && unit) return { value: node.value * { mb: 1, gb: 1e3, tb: 1e6 }[unit], dim: 'size' };
	if (node.dim === 'count' && metricDim === 'money') return { value: node.value, dim: 'money' };
	return { value: node.value, dim: node.dim };
}

function evalRevisit(node, ctx) {
	if (node.type === 'manual') return { value: null, eta: null, unknown: [], manual: [node.text] };
	if (node.type === 'cmp') {
		if (node.metric === 'date') {
			const value = compare(ctx.today, node.op, node.date);
			const due = !value && (node.op === '>' || node.op === '>=') ? node.date : null;
			return { value, eta: due, unknown: [], manual: [] };
		}
		const m = ctx.metrics[node.metric];
		if (!m) return { value: null, eta: null, unknown: [node.metric], manual: [] };
		const t = thresholdIn(node, m.dim);
		if (m.dim !== t.dim) return { value: null, eta: null, unknown: [`${node.metric} (unit mismatch: ${m.dim} vs ${t.dim})`], manual: [] };
		const value = compare(m.value, node.op, t.value);
		let due = null;
		if (!value && (node.op === '>' || node.op === '>=') && (m.ratePerDay > 0 || m.growthPerMonth > 0)) {
			due = eta({ current: m.value, limit: t.value, ratePerDay: m.ratePerDay, growthPerMonth: m.growthPerMonth, from: m.asOf ?? ctx.today }).date;
		}
		return { value, eta: due, unknown: [], manual: [] };
	}
	const parts = node.args.map((a) => evalRevisit(a, ctx));
	const merged = { unknown: parts.flatMap((p) => p.unknown), manual: parts.flatMap((p) => p.manual) };
	const etas = parts.map((p) => p.eta).filter(Boolean).sort();
	if (node.type === 'AND') {
		const value = parts.some((p) => p.value === false) ? false : parts.every((p) => p.value === true) ? true : null;
		// All conditions have to hold: the latest of the pending dates, when every pending one has a date.
		const pending = parts.filter((p) => p.value !== true);
		return { value, eta: value === true ? null : pending.every((p) => p.eta) ? pending.map((p) => p.eta).sort().at(-1) : null, ...merged };
	}
	const value = parts.some((p) => p.value === true) ? true : parts.every((p) => p.value === false) ? false : null;
	return { value, eta: value === true ? null : etas[0] ?? null, ...merged };
}

/** Evaluates revisit_when for every service section. `metrics` override what usage says. */
export function checkStack(text, { today = todayIso(), metrics = {} } = {}) {
	const doc = parseStackMd(text);
	const global = {};
	const users = doc.requirements?.users && /^\s*([\d.,]+\s*[kKmM]?)/.exec(doc.requirements.users);
	if (users) {
		try {
			global.users = { value: parseQuantity(users[1]).value, dim: 'count' };
		} catch {}
	}
	const results = [];
	for (const s of doc.sections) {
		if (s.kind !== 'service') continue;
		const expr = s.values.revisit_when;
		const base = { heading: s.heading, line: s.line };
		if (!expr) {
			results.push({ ...base, status: 'none' });
			continue;
		}
		let tree;
		try {
			tree = parseRevisit(expr);
		} catch (e) {
			results.push({ ...base, revisit_when: expr, status: 'error', error: e.message });
			continue;
		}
		const usage = parseUsage(s.values.usage);
		const ctxMetrics = { ...global, ...usage, ...metrics };
		const names = [...revisitMetrics(tree)];
		if (usage._ && names.length === 1 && !(names[0] in usage) && !(names[0] in metrics)) ctxMetrics[names[0]] = usage._;
		const r = evalRevisit(tree, { today, metrics: ctxMetrics });
		const status = r.value === true ? 'triggered' : r.value === false ? 'ok' : r.manual.length && !r.unknown.length ? 'manual' : 'unknown';
		results.push({ ...base, revisit_when: expr, status, eta: r.eta, when: status === 'triggered' ? 'Now' : r.eta ? `ETA ${approxMonth(r.eta)}` : r.manual.length ? 'Before launch' : null, unknown: r.unknown, manual: r.manual });
	}
	const dates = results.map((r) => (r.status === 'triggered' ? today : r.eta)).filter(Boolean).sort();
	return { today, next: dates[0] ?? null, sections: results };
}

export function lintStackMd(text) {
	const errors = [];
	const warnings = [];
	for (const s of findSecrets(text)) errors.push({ line: s.line, message: `looks like a secret (${s.kind}); remove it, STACK.md keeps names only` });
	const doc = parseStackMd(text);
	if (!doc.requirements) warnings.push({ line: 1, message: 'no ## Requirements section' });
	for (const s of doc.sections) {
		if (s.kind === 'other') warnings.push({ line: s.line, message: `heading "${s.heading}" is not "<Role>: <Vendor>"` });
		if (s.kind !== 'service') continue;
		if (!STACK_ROLES.includes(s.role)) warnings.push({ line: s.line, message: `role "${s.role}" is not one of ${STACK_ROLES.join(', ')}` });
		if (s.values.env && /=/.test(s.values.env)) errors.push({ line: s.line, message: 'env lists names only, without values' });
		if (s.values.source && !/\d{4}-\d{2}-\d{2}/.test(`${s.values.source} ${s.comments.source ?? ''}`)) warnings.push({ line: s.line, message: 'source has no read date (add "# read YYYY-MM-DD")' });
		if (s.values.revisit_when) {
			try {
				for (const m of revisitMetrics(parseRevisit(s.values.revisit_when))) if (!REVISIT_METRICS.includes(m)) warnings.push({ line: s.line, message: `revisit_when metric "${m}" is not a standard metric` });
			} catch (e) {
				errors.push({ line: s.line, message: e.message });
			}
		}
	}
	return { ok: errors.length === 0, errors, warnings };
}

const STACK_USAGE = `usage:
  node stack-md.mjs parse [STACK.md]
  node stack-md.mjs check [STACK.md] [--today YYYY-MM-DD] [--metric db_size="420 MB"]...
  node stack-md.mjs lint [STACK.md]
  node stack-md.mjs set [STACK.md] --section "Database: Supabase" --set "plan=free" [--set ...] [--comment "source=read 2026-10-06"]
Prints JSON. set refuses values that look like secrets and keeps every other line as it is.`;

function keyValues(list) {
	const out = {};
	for (const item of [].concat(list ?? [])) {
		const eq = String(item).indexOf('=');
		if (eq < 1) throw new Error(`expected key=value, got "${item}"`);
		out[String(item).slice(0, eq).trim()] = String(item).slice(eq + 1).trim();
	}
	return out;
}

export function stackMdMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	const file = args._[1] ?? 'STACK.md';
	try {
		if (!['parse', 'check', 'lint', 'set'].includes(cmd)) {
			process.stdout.write(STACK_USAGE + '\n');
			if (cmd && cmd !== 'help') process.exitCode = 1;
			return;
		}
		const exists = existsSync(file);
		if (!exists && cmd !== 'set') {
			printJson({ exists: false, file });
			return;
		}
		const text = exists ? readFileSync(file, 'utf8') : '';
		if (cmd === 'parse') printJson({ exists: true, file, ...parseStackMd(text) });
		else if (cmd === 'lint') {
			const r = lintStackMd(text);
			printJson({ file, ...r });
			if (!r.ok) process.exitCode = 2;
		} else if (cmd === 'check') {
			const metrics = {};
			for (const [k, v] of Object.entries(keyValues(args.metric))) {
				const qv = parseQuantity(v);
				metrics[k] = { value: qv.value, dim: qv.dim };
			}
			printJson({ file, ...checkStack(text, { today: args.today || todayIso(), metrics }) });
		} else {
			if (!args.section || args.section === true) throw new Error('--section is required');
			const out = setFields(text, String(args.section), keyValues(args.set), keyValues(args.comment));
			const secrets = findSecrets(out);
			if (secrets.length) {
				process.exitCode = 2;
				throw new Error(`refusing to write: lines ${secrets.map((s) => s.line).join(', ')} look like secrets`);
			}
			writeFileSync(file, out);
			printJson({ file, written: true, section: args.section });
		}
	} catch (e) {
		fail(e.message, process.exitCode || 1);
	}
}

if (isMain(import.meta.url)) stackMdMain(process.argv.slice(2)); // @main
