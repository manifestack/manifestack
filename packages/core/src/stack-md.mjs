// Reads and updates .manifestack/STACK.md, evaluates `revisit_when` and keeps secrets out of the file.
// Updates touch only the named fields: other lines, unknown keys and user comments stay as they are.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { isMain, parseArgs, printJson, fail, todayIso, isIsoDate, dateArg } from './cli-util.mjs';
import { parseQuantity, eta, approxMonth, METRIC_UNIT_MB } from './project.mjs';
import { STACK_FILE, ensureWorkDir, withinCwd } from './workdir.mjs';

export const STACK_ROLES = ['Hosting', 'Database', 'Auth', 'Email', 'Storage', 'Payments', 'Monitoring', 'AI', 'Other'];
export const STACK_KEYS = ['plan', 'limit', 'source', 'usage', 'decided', 'revisit_when', 'next', 'env'];
export const REQUIREMENT_KEYS = ['budget', 'users', 'requires', 'prefer', 'avoid'];
export const REVISIT_METRICS = ['db_size', 'monthly_sent', 'daily_peak', 'transfer_tb', 'mau', 'users', 'monthly_bill', 'date'];

// Env var names (NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL) and URL slugs (2024-11-05-pro-plan-pricing-update) are made of
// words, numbers and short parts like R2 or v2. A key has at least one long part that mixes letters and digits.
function looksRandom(token) {
	const parts = token.split(/[-_]+/).filter(Boolean);
	if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(token) && parts.every((p) => p.length <= 12)) return false;
	return !parts.every((p) => /^(?:[A-Za-z]+|\d+)$/.test(p) || p.length <= 4);
}

// re_engagement_campaigns is a name; re_ followed by digits or mixed case is a Resend key.
const isResendKey = (m) => {
	const body = m.slice(3).replace(/_/g, '');
	return (/\d/.test(body) && /[A-Za-z]/.test(body)) || (/[a-z]/.test(body) && /[A-Z]/.test(body));
};

const SECRET_PATTERNS = [
	['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
	['URL with credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@\S+/i],
	['API key (sk_/pk_/rk_)', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/],
	['Supabase key', /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/],
	['Resend key', /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{8,}(?![A-Za-z0-9_])|\bre_[A-Za-z0-9]{24,}\b/, isResendKey],
	['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/],
	['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
	['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
	['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
	['Neon API key', /\bnapi_[A-Za-z0-9]{16,}/],
	// Only names that usually hold secrets: NODE_ENV=production in a note is fine.
	['env assignment', /\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|DSN|CREDENTIALS?|PRIVATE)[A-Z0-9_]*\s*=\s*['"]?[^\s'"]{6,}/],
	['long token', /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/, looksRandom],
].map(([kind, re, check]) => [kind, new RegExp(re.source, re.flags + 'g'), check]);

const secretIn = (line, re, check) => [...line.matchAll(re)].some((m) => !check || check(m[0]));

/** Finds strings that look like secrets. STACK.md must never contain one. */
export function findSecrets(text) {
	const hits = [];
	text.split(/\r?\n/).forEach((line, idx) => {
		for (const [kind, re, check] of SECRET_PATTERNS) if (secretIn(line, re, check)) hits.push({ line: idx + 1, kind });
	});
	return hits;
}

export function scrubSecrets(text) {
	let out = text;
	for (const [, re, check] of SECRET_PATTERNS) out = out.replace(re, (m) => (!check || check(m) ? '[removed]' : m));
	return out;
}

const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

// Lines with their own endings, so an update keeps a file's CRLF/LF mix as it is.
function splitLines(text) {
	const lines = [];
	const ends = [];
	const re = /\r?\n/g;
	let last = 0;
	for (let m; (m = re.exec(text)); last = re.lastIndex) {
		lines.push(text.slice(last, m.index));
		ends.push(m[0]);
	}
	if (last < text.length) {
		lines.push(text.slice(last));
		ends.push('');
	}
	return { lines, ends };
}

function dominantEol(text) {
	const crlf = (text.match(/\r\n/g) ?? []).length;
	return crlf > (text.match(/\n/g) ?? []).length - crlf ? '\r\n' : '\n';
}

// A comment starts at two or more spaces and "#": in "use plan #2 for now" the # is part of the value.
function splitComment(raw) {
	const m = /[ \t]{2,}#[ \t]?/.exec(raw);
	if (!m) return { value: raw.trim(), comment: null, commentRaw: '' };
	return { value: raw.slice(0, m.index).trim(), comment: raw.slice(m.index + m[0].length).trim(), commentRaw: raw.slice(m.index).trimEnd() };
}

function scanSections(lines) {
	const sections = [];
	let current = null;
	let fence = false;
	let comment = false;
	lines.forEach((line, idx) => {
		// Text inside <!-- --> is not part of the document (the template keeps its example there).
		if (comment) {
			if (line.includes('-->')) comment = false;
			return;
		}
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) return;
		// Only a line that starts with <!-- opens a comment block (as in Markdown); "<!--" inside a value is text.
		if (/^\s*<!--/.test(line)) {
			if (!line.includes('-->', line.indexOf('<!--') + 4)) comment = true;
			return;
		}
		const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
		if (h) {
			const heading = h[1];
			const rv = /^([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/.exec(heading);
			current = {
				heading,
				headingLine: idx,
				kind: /^requirements$/i.test(heading) ? 'requirements' : rv ? 'service' : 'other',
				role: rv ? rv[1] : null,
				vendor: rv ? rv[2] : null,
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
		if (f && !(f[1] in current.fields)) current.fields[f[1]] = { idx, ...splitComment(f[2]) };
	});
	return sections;
}

export function parseStackMd(text) {
	const sections = scanSections(splitLines(stripBom(text)).lines);
	const values = (s) => Object.fromEntries(Object.entries(s.fields).map(([k, v]) => [k, v.value]));
	const req = sections.find((s) => s.kind === 'requirements');
	return {
		requirements: req ? values(req) : null,
		sections: sections.map((s) => ({ heading: s.heading, kind: s.kind, role: s.role, vendor: s.vendor, line: s.headingLine + 1, values: values(s), comments: Object.fromEntries(Object.entries(s.fields).filter(([, v]) => v.comment).map(([k, v]) => [k, v.comment])) })),
	};
}

// "Database:Supabase", "database :  supabase" and "Database: Supabase" name the same section.
const normalizeHeading = (h) => String(h).trim().replace(/\s+/g, ' ').replace(/\s*:\s*/, ': ');
const sameHeading = (a, b) => normalizeHeading(a).toLowerCase() === normalizeHeading(b).toLowerCase();

/**
 * Sets fields in one section, creating the section if needed.
 * `updates` is { key: value }, `comments` is { key: comment }: an existing comment is kept unless replaced,
 * "" removes it, and a comment for a key without an update comments the existing line.
 */
export function setFields(text, heading, updates, comments = {}) {
	if (/[\r\n]/.test(String(heading))) throw new Error('section name must be one line');
	heading = normalizeHeading(heading);
	if (!heading) throw new Error('section name is empty');
	for (const [k, v] of Object.entries(updates)) {
		if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`invalid key "${k}"`);
		if (/[\r\n]/.test(String(v))) throw new Error(`value for ${k} must be one line`);
		if (findSecrets(`${k}: ${v}`).length) throw new Error(`value for ${k} looks like a secret; STACK.md must not contain secrets`);
	}
	for (const [k, c] of Object.entries(comments)) {
		if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`invalid key "${k}"`);
		if (/[\r\n]/.test(String(c))) throw new Error(`comment for ${k} must be one line`);
		if (findSecrets(String(c)).length) throw new Error(`comment for ${k} looks like a secret; STACK.md must not contain secrets`);
	}
	const src = stripBom(text);
	const eol = dominantEol(src);
	const { lines, ends } = splitLines(src);
	let section = scanSections(lines).find((s) => sameHeading(s.heading, heading));
	const keys = [...new Set([...Object.keys(updates), ...Object.keys(comments)])];
	for (const key of keys) if (!(key in updates) && !section?.fields[key]) throw new Error(`cannot comment on ${key}: section "${heading}" has no ${key} line (set a value too)`);
	if (!section) {
		while (lines.length && !lines.at(-1).trim()) {
			lines.pop();
			ends.pop();
		}
		if (lines.length) {
			ends[ends.length - 1] ||= eol;
			lines.push('');
			ends.push(eol);
		}
		lines.push(`## ${heading}`);
		ends.push(eol);
		section = { headingLine: lines.length - 1, fields: {} };
	}
	for (const key of keys) {
		const existing = section.fields[key];
		// Two spaces and # would start a comment when the file is read back.
		const value = key in updates ? String(updates[key]).trim().replace(/[ \t]{2,}#/g, ' #') : existing.value;
		const c = comments[key] == null ? null : String(comments[key]).trim();
		const comment = c == null ? (existing?.commentRaw ?? '') : c ? `  # ${c}` : '';
		const line = `${key}:${value ? ` ${value}` : ''}${comment}`;
		if (existing) {
			lines[existing.idx] = line;
			continue;
		}
		const at = insertionIndex(section, key);
		if (at > 0 && !ends[at - 1]) ends[at - 1] = eol;
		lines.splice(at, 0, line);
		ends.splice(at, 0, eol);
		// Re-read positions after the insert.
		section = scanSections(lines).find((s) => s.headingLine === section.headingLine);
	}
	if (ends.length && !ends.at(-1)) ends[ends.length - 1] = eol;
	return lines.map((l, i) => l + ends[i]).join('');
}

function insertionIndex(section, key) {
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
 * Returns { metricName | "_": { value, dim, ratePerDay?, rateDim?, growthPerMonth?, asOf? } }.
 * An entry it cannot read is skipped; an impossible date is an error.
 */
export function parseUsage(raw) {
	const metrics = {};
	for (const entry of String(raw ?? '').split(';')) {
		let s = entry.trim();
		if (!s) continue;
		const d = /\((\d{4}-\d{2}-\d{2})\)/.exec(s);
		const asOf = d ? d[1] : null;
		if (asOf && !isIsoDate(asOf)) throw new Error(`usage: "${asOf}" is not a date (YYYY-MM-DD)`);
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
			else if (r.per) {
				m.ratePerDay = r.value / r.per;
				if (r.dim !== base.dim) m.rateDim = r.dim;
			}
		}
		metrics[name] = m;
	}
	return metrics;
}

/**
 * Requirements → users: the first number ("9k now, 50k by Q3" is 9000; "9 000", "~9k", "12,000" and "1.5 million" work).
 * null when that number is not a count of users ("12 months out, 3k") or there is none.
 */
export function parseUsers(raw) {
	const s = String(raw ?? '');
	const re = /(?<![\w.$-])(?:~\s*)?(\d{1,3}(?:([ ,_])\d{3})(?:\2\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*([km]|thousand|million|mln|bn|billion)(?![a-z]))?/gi;
	const first = re.exec(s);
	if (!first) return null;
	const after = s.slice(first.index + first[0].length);
	if (/^\s*(?:%|\$|[-/.]\d|(?:hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|quarters?|[KMGT]?B)\b|\/)/i.test(after)) return null;
	let value = Number(first[1].replace(/[ ,_]/g, ''));
	if (first[3]) value *= /^(k|thousand)$/i.test(first[3]) ? 1e3 : /^(m|million|mln)$/i.test(first[3]) ? 1e6 : 1e9;
	return value;
}

export function tokenizeRevisit(expr) {
	return String(expr)
		.split(/(\(|\)|\bAND\b|\bOR\b)/i)
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
			if (!isIsoDate(rawValue.trim())) throw new Error(`revisit_when: date needs a real YYYY-MM-DD, got "${rawValue}"`);
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

const MONEY_METRIC = /(?:^|_)(?:bill|cost|spend|usd)$/;

// Thresholds and readings get the same rule: a unitless number on a metric named *_mb, *_gb or *_tb is in that
// unit, and on monthly_bill (or *_cost, *_spend, *_usd) it is dollars. Returns a copy.
function inMetricUnit(metric, q) {
	const out = { ...q };
	const unit = /_(mb|gb|tb)$/.exec(metric)?.[1];
	if (unit) {
		const f = METRIC_UNIT_MB[unit];
		if (q.dim === 'count') {
			out.value = q.value * f;
			out.dim = 'size';
		}
		if (q.ratePerDay != null && (q.rateDim ?? q.dim) === 'count') out.ratePerDay = q.ratePerDay * f;
	} else if (q.dim === 'count' && MONEY_METRIC.test(metric)) out.dim = 'money';
	return out;
}

const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
const earliest = (dates) => dates.filter(Boolean).sort()[0] ?? null;

function evalRevisit(node, ctx) {
	if (node.type === 'manual') return { value: null, eta: null, unknown: [], manual: [node.text] };
	if (node.type === 'cmp') {
		if (node.metric === 'date') {
			const value = compare(ctx.today, node.op, node.date);
			const due = !value && (node.op === '>' || node.op === '>=') ? node.date : null;
			return { value, eta: due, unknown: [], manual: [] };
		}
		const reading = ctx.metrics[node.metric];
		if (!reading) return { value: null, eta: null, unknown: [node.metric], manual: [] };
		const m = inMetricUnit(node.metric, reading);
		const t = inMetricUnit(node.metric, { value: node.value, dim: node.dim });
		if (m.dim === 'count' && t.dim === 'money') m.dim = 'money';
		if (t.dim === 'count' && m.dim === 'money') t.dim = 'money';
		if (m.dim !== t.dim) return { value: null, eta: null, unknown: [`${node.metric} (unit mismatch: ${m.dim} vs ${t.dim})`], manual: [] };
		const value = compare(m.value, node.op, t.value);
		let due = null;
		if (!value && (node.op === '>' || node.op === '>=') && (m.ratePerDay > 0 || m.growthPerMonth > 0)) {
			due = eta({ current: m.value, limit: t.value, ratePerDay: m.ratePerDay, growthPerMonth: m.growthPerMonth, from: m.asOf ?? ctx.today }).date;
		}
		// An old reading whose trend has already crossed the line: due now, not "ok".
		if (due && due <= ctx.today) return { value: true, eta: null, projected: due, unknown: [], manual: [] };
		return { value, eta: due, unknown: [], manual: [] };
	}
	const parts = node.args.map((a) => evalRevisit(a, ctx));
	const merged = { unknown: parts.flatMap((p) => p.unknown), manual: parts.flatMap((p) => p.manual) };
	if (node.type === 'AND') {
		const value = parts.some((p) => p.value === false) ? false : parts.every((p) => p.value === true) ? true : null;
		// All conditions have to hold: the latest of the pending dates, when every pending one has a date.
		const pending = parts.filter((p) => p.value !== true);
		const projected = value === true ? latest(parts.map((p) => p.projected)) : null;
		return { value, eta: value === true ? null : pending.every((p) => p.eta) ? latest(pending.map((p) => p.eta)) : null, projected, ...merged };
	}
	const value = parts.some((p) => p.value === true) ? true : parts.every((p) => p.value === false) ? false : null;
	const hits = parts.filter((p) => p.value === true);
	const projected = hits.length && hits.every((p) => p.projected) ? earliest(hits.map((p) => p.projected)) : null;
	return { value, eta: value === true ? null : earliest(parts.map((p) => p.eta)), projected, ...merged };
}

function checkSection(s, ctx) {
	const tree = parseRevisit(s.values.revisit_when);
	const usage = parseUsage(s.values.usage);
	const metrics = { ...ctx.global, ...usage, ...ctx.metrics };
	const names = [...revisitMetrics(tree)];
	if (usage._ && names.length === 1 && !(names[0] in usage) && !(names[0] in ctx.metrics)) metrics[names[0]] = usage._;
	const r = evalRevisit(tree, { today: ctx.today, metrics });
	const status = r.value === true ? 'triggered' : r.value === false ? 'ok' : r.manual.length && !r.unknown.length ? 'manual' : 'unknown';
	const when = status === 'triggered' ? 'Now' : r.eta ? `ETA ${approxMonth(r.eta)}` : r.manual.length ? 'Before launch' : null;
	return { status, eta: r.eta, ...(status === 'triggered' && r.projected ? { projected: r.projected } : {}), when, unknown: r.unknown, manual: r.manual };
}

/**
 * Evaluates revisit_when for every service section. `metrics` override what usage says.
 * A section that cannot be read gets status "error" and the others are still checked.
 */
export function checkStack(text, { today = todayIso(), metrics = {} } = {}) {
	if (!isIsoDate(today)) throw new Error(`today must be a real YYYY-MM-DD, got "${today}"`);
	const doc = parseStackMd(text);
	const global = {};
	const users = parseUsers(doc.requirements?.users);
	if (users != null) global.users = { value: users, dim: 'count' };
	const results = [];
	for (const s of doc.sections) {
		if (s.kind !== 'service') continue;
		const expr = s.values.revisit_when;
		const base = { heading: s.heading, line: s.line };
		if (!expr) {
			results.push({ ...base, status: 'none' });
			continue;
		}
		try {
			results.push({ ...base, revisit_when: expr, ...checkSection(s, { today, metrics, global }) });
		} catch (e) {
			results.push({ ...base, revisit_when: expr, status: 'error', error: e.message });
		}
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
		try {
			parseUsage(s.values.usage);
		} catch (e) {
			errors.push({ line: s.line, message: e.message });
		}
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
  node stack-md.mjs parse [file]
  node stack-md.mjs check [file] [--today YYYY-MM-DD] [--metric db_size="420 MB"]...
  node stack-md.mjs lint [file]
  node stack-md.mjs set [file] --section "Email: Resend" --json - <<'EOF'
{"plan": "Free", "limit": "3,000 emails/mo", "source": {"value": "resend.com/pricing", "comment": "read 2026-10-06"}}
EOF
  node stack-md.mjs set [file] --section "Database: Supabase" --set "plan=free" [--set ...] [--comment "source=read 2026-10-06"]
file defaults to .manifestack/STACK.md and must be inside the current directory. Prints JSON.
set --json reads a JSON object from a file or - (stdin): {"key": "value"} or {"key": {"value": "...", "comment": "..."}}.
Use it with a quoted heredoc (<<'EOF') for text copied from a page: the shell expands $(...) and backticks inside "...".
A comment without a value comments the existing line; an empty comment removes it.
set refuses values that look like secrets and keeps every other line as it is.`;

function keyValues(list, flag) {
	const out = {};
	for (const item of [].concat(list ?? [])) {
		const eq = String(item).indexOf('=');
		if (item === true || eq < 1) throw new Error(`${flag} expects key=value, got "${item === true ? '' : item}"`);
		out[String(item).slice(0, eq).trim()] = String(item).slice(eq + 1).trim();
	}
	return out;
}

const scalar = (v, where) => {
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
	throw new Error(`--json: ${where} must be a string`);
};

/** Reads `{"key": "value"}` or `{"key": {"value": "...", "comment": "..."}}` from a file or - (stdin). */
function jsonFields(src) {
	if (typeof src !== 'string') throw new Error('--json needs a file or - for stdin');
	let obj;
	try {
		obj = JSON.parse(stripBom(readFileSync(src === '-' ? 0 : src, 'utf8')));
	} catch (e) {
		// The parser quotes the input; it may hold what the secret check is about to refuse.
		throw new Error(e instanceof SyntaxError ? `--json: ${src === '-' ? 'stdin' : src} is not valid JSON` : e.message);
	}
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('--json expects an object: {"key": "value"} or {"key": {"value": "...", "comment": "..."}}');
	const updates = {};
	const comments = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const extra = Object.keys(v).filter((x) => x !== 'value' && x !== 'comment');
			if (extra.length || !Object.keys(v).length) throw new Error(`--json: "${k}" takes "value" and/or "comment"`);
			if ('value' in v) updates[k] = scalar(v.value, `"${k}".value`);
			if ('comment' in v) comments[k] = scalar(v.comment, `"${k}".comment`);
		} else updates[k] = scalar(v, `"${k}"`);
	}
	return { updates, comments };
}

function mergeOnce(target, source, what) {
	for (const [k, v] of Object.entries(source)) {
		if (k in target) throw new Error(`${what} for ${k} is given twice`);
		target[k] = v;
	}
	return target;
}

export function stackMdMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	const file = args._[1] ?? STACK_FILE;
	try {
		if (args.help || !['parse', 'check', 'lint', 'set'].includes(cmd)) {
			process.stdout.write(STACK_USAGE + '\n');
			if (!args.help && cmd && cmd !== 'help') process.exitCode = 1;
			return;
		}
		if (cmd === 'set' && !withinCwd(file)) throw new Error(`refusing to write ${file}: it is outside the current directory`);
		const exists = existsSync(file);
		if (!exists && cmd !== 'set') {
			printJson({ exists: false, file });
			return;
		}
		const text = exists ? stripBom(readFileSync(file, 'utf8')) : '';
		if (cmd === 'parse') printJson({ exists: true, file, ...parseStackMd(text) });
		else if (cmd === 'lint') {
			const r = lintStackMd(text);
			printJson({ file, ...r });
			if (!r.ok) process.exitCode = 2;
		} else if (cmd === 'check') {
			const metrics = {};
			for (const [k, v] of Object.entries(keyValues(args.metric, '--metric'))) {
				const qv = parseQuantity(v);
				metrics[k] = { value: qv.value, dim: qv.dim };
			}
			printJson({ file, ...checkStack(text, { today: dateArg(args, 'today', todayIso()), metrics }) });
		} else {
			if (typeof args.section !== 'string' || !args.section.trim()) throw new Error('--section "<Role>: <Vendor>" is required (one)');
			const updates = keyValues(args.set, '--set');
			const comments = keyValues(args.comment, '--comment');
			if (args.json != null) {
				const j = jsonFields(args.json);
				mergeOnce(updates, j.updates, 'a value');
				mergeOnce(comments, j.comments, 'a comment');
			}
			if (!Object.keys(updates).length && !Object.keys(comments).length) throw new Error('nothing to set: pass --json, --set or --comment');
			const out = setFields(text, args.section, updates, comments);
			const secrets = findSecrets(out);
			if (secrets.length) {
				process.exitCode = 2;
				throw new Error(`refusing to write: lines ${secrets.map((s) => s.line).join(', ')} look like secrets`);
			}
			ensureWorkDir(file);
			writeFileSync(file, out);
			printJson({ file, written: true, section: normalizeHeading(args.section) });
		}
	} catch (e) {
		fail(e.message, process.exitCode || 1);
	}
}

if (isMain(import.meta.url)) stackMdMain(process.argv.slice(2)); // @main
