// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- packages/core/src/cli-util.mjs
// Small helpers shared by the command-line entry points of every script.
// Rules for all files in packages/core/src (tools/sync.mjs bundles them into single files):
//   - imports on one line, named only, no `as` renames, only `node:*` or relative `./x.mjs`;
//   - top-level names unique across modules;
//   - the line that runs a module as a script ends with `// @main`.

function isMain(moduleUrl) {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
	} catch {
		return false;
	}
}

/** Parses `--key value`, `--key=value` and `--flag`. Repeated keys become arrays. */
function parseArgs(argv) {
	const args = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) {
			args._.push(a);
			continue;
		}
		let key = a.slice(2);
		let value = true;
		const eq = key.indexOf('=');
		if (eq !== -1) {
			value = key.slice(eq + 1);
			key = key.slice(0, eq);
		} else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
			value = argv[++i];
		}
		// --__proto__ or --constructor must not reach the object's prototype; no script has such an option.
		if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
		if (Object.hasOwn(args, key)) args[key] = [].concat(args[key], value);
		else args[key] = value;
	}
	return args;
}

function printJson(value) {
	process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function fail(message, code = 1) {
	process.stderr.write(`error: ${message}\n`);
	process.exit(code);
}

/** Today in the local time zone: a UTC date is a day off for half the world around midnight. */
function todayIso() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD that names a real day: 2026-13-01 and 2027-02-30 are rejected. */
function isIsoDate(s) {
	if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const t = Date.parse(s + 'T00:00:00Z');
	return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** Reads a date option such as --today or --from; a bare flag or an impossible date is an error. */
function dateArg(args, key, fallback) {
	const v = args[key];
	if (v == null) return fallback;
	if (!isIsoDate(v)) throw new Error(`--${key} needs a date as YYYY-MM-DD${v === true ? '' : `, got "${v}"`}`);
	return v;
}

// ---- packages/core/src/workdir.mjs
// Everything Manifestack writes in a project lives in one folder, .manifestack/ at the repository root:
//   .manifestack/STACK.md   decisions, committed with the code
//   .manifestack/tmp/       working files such as cost models, ignored by git

const WORK_DIR = '.manifestack';
const STACK_FILE = `${WORK_DIR}/STACK.md`;
const TMP_DIR = `${WORK_DIR}/tmp`;

/** Creates the folder a file goes into. Inside .manifestack/tmp it also adds a .gitignore that ignores the folder. */
function ensureWorkDir(file) {
	const dir = dirname(file);
	mkdirSync(dir, { recursive: true });
	ignoreTmpDir(dir);
}

/** Adds .manifestack/tmp/.gitignore when `dir` is that folder and the file is missing. Never writes through a symlink. */
function ignoreTmpDir(dir) {
	const abs = resolve(dir);
	if (basename(abs) !== 'tmp' || basename(dirname(abs)) !== WORK_DIR) return;
	const ignore = join(abs, '.gitignore');
	try {
		if (!lstatSync(abs).isDirectory()) return;
		lstatSync(ignore);
		return; // already there (a file, or a symlink we leave alone)
	} catch (e) {
		if (e.code !== 'ENOENT') throw e;
	}
	try {
		// wx: fails instead of following a symlink created in the meantime.
		writeFileSync(ignore, '*\n', { flag: 'wx' });
	} catch (e) {
		if (e.code !== 'EEXIST' && e.code !== 'ENOENT') throw e;
	}
}

/** True when `file` resolves (symlinks included) to a path inside the current directory. */
function withinCwd(file) {
	const root = realpathSync(process.cwd());
	let p = resolve(file);
	const rest = [];
	for (;;) {
		let exists = true;
		try {
			lstatSync(p);
		} catch {
			exists = false;
		}
		if (exists) {
			try {
				p = realpathSync(p);
			} catch {
				return false; // dangling symlink: a write would land wherever it points
			}
			break;
		}
		const parent = dirname(p);
		if (parent === p) return false;
		rest.unshift(basename(p));
		p = parent;
	}
	const rel = relative(root, join(p, ...rest));
	return rel !== '' && !isAbsolute(rel) && rel.split(sep)[0] !== '..';
}

// ---- packages/core/src/project.mjs
// Cost and limit projections. Prices are inputs: the skill reads them from vendor pages at run time.
// Sizes are decimal (1 GB = 1000 MB), as vendors bill them. Money is USD. No network.

const SIZE_UNITS = { B: 1e-6, KB: 1e-3, MB: 1, GB: 1e3, TB: 1e6 };
const PERIOD_DAYS = { day: 1, d: 1, week: 7, wk: 7, w: 7, month: 30.4375, mo: 30.4375, year: 365.25, yr: 365.25 };
const DAY_MS = 86400000;
/** A plain number on a metric named *_mb, *_gb or *_tb is in that unit; this is the unit in MB. */
const METRIC_UNIT_MB = { mb: 1, gb: 1e3, tb: 1e6 };

/**
 * Parses "312 MB", "+1.1 MB/day", "$25/mo", "41,200", "9k", "18%/mo", "3.4 TB".
 * Thousands are grouped in threes by ",", "_" or a space: "1,5 GB" is an error, not 15 GB.
 * Returns { value, dim, per } where value is in base units (MB for size, USD for money, 1 for count,
 * percent for pct) and `per` is the period in days for rates (null otherwise).
 */
function parseQuantity(input) {
	if (typeof input === 'number') return { value: input, dim: 'count', per: null };
	// Runs of spaces become one, so the optional parts below cannot backtrack over a long gap.
	const s = String(input).trim().replace(/\s+/g, ' ');
	if (s.length > 64) throw new Error(`cannot read quantity "${s.slice(0, 24)}…": too long`);
	const m = /^([+-])?\s*(\$)?\s*(\d{1,3}(?:([, _])\d{3})(?:\4\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*([kKmM](?![bB]))?\s*(%|[KMGT]?B\b)?\s*(?:\/\s*(day|d|week|wk|w|month|mo|year|yr))?$/i.exec(s);
	if (!m) throw new Error(`cannot read quantity "${input}"`);
	const [, sign, dollar, num, , mult, unit, period] = m;
	let value = Number(num.replace(/[, _]/g, ''));
	if (mult) value *= /k/i.test(mult) ? 1e3 : 1e6;
	let dim = 'count';
	if (dollar) dim = 'money';
	if (unit === '%') dim = 'pct';
	else if (unit) {
		dim = 'size';
		value *= SIZE_UNITS[unit.toUpperCase()];
	}
	if (sign === '-') value = -value;
	return { value, dim, per: period ? PERIOD_DAYS[period.toLowerCase()] : null };
}

function formatSize(mb) {
	if (Math.abs(mb) >= 1e6) return `${round(mb / 1e6, 2)} TB`;
	if (Math.abs(mb) >= 1e3) return `${round(mb / 1e3, 2)} GB`;
	return `${round(mb, 2)} MB`;
}

// The factor nudges values like 1.005, stored as 1.00499…, to round half up as written.
function round(n, digits = 2) {
	const f = 10 ** digits;
	return Math.round(n * f * (1 + Number.EPSILON)) / f;
}

/** A compounding rate over `perDays` as a monthly fraction: 10%/week is (1.1^(30.4375/7) − 1), about 51% a month, not 43%. */
function monthlyGrowth(pct, perDays = PERIOD_DAYS.mo) {
	return (1 + pct / 100) ** (PERIOD_DAYS.mo / perDays) - 1;
}

// null past year 9999: such a date means "not on this trend", and toISOString cannot write it as YYYY-MM-DD.
function addDays(iso, days) {
	const d = new Date(Date.parse(iso + 'T00:00:00Z') + Math.round(days) * DAY_MS);
	if (!Number.isFinite(d.getTime()) || d.getUTCFullYear() > 9999) return null;
	return d.toISOString().slice(0, 10);
}

/** "~Mar 2027", the form findings use for `when`. */
function approxMonth(iso) {
	const d = new Date(iso + 'T00:00:00Z');
	return `~${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

/** Overage on published rates: max(0, used - included) / per × price. */
function overage({ used, included = 0, price, per = 1 }) {
	const over = Math.max(0, used - included);
	return { over, cost: round((over / per) * price, 2) };
}

/** Least-squares slope in units per day from [{ date, value }]. Needs two points or more. */
function linearRate(points) {
	if (points.length < 2) throw new Error('a growth rate needs two data points');
	for (const p of points) if (!isIsoDate(p.date)) throw new Error(`data point dates must be YYYY-MM-DD, got "${p.date}"`);
	const xs = points.map((p) => Date.parse(p.date + 'T00:00:00Z') / DAY_MS);
	const ys = points.map((p) => p.value);
	const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
	const my = ys.reduce((a, b) => a + b, 0) / ys.length;
	let num = 0;
	let den = 0;
	for (let k = 0; k < xs.length; k++) {
		num += (xs[k] - mx) * (ys[k] - my);
		den += (xs[k] - mx) ** 2;
	}
	if (!den) throw new Error('data points need different dates');
	return num / den;
}

/**
 * When does `current` reach `limit`?
 * Linear: ratePerDay (or points). Compounding: growthPerMonth as a fraction (0.18 for +18%/mo).
 */
function eta({ current, limit, ratePerDay, growthPerMonth, points, from = todayIso() }) {
	if (points?.length) {
		ratePerDay = linearRate(points);
		const last = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
		current = last.value;
		from = last.date;
	}
	if (!isIsoDate(from)) throw new Error(`eta: the start date must be YYYY-MM-DD, got "${from}"`);
	const base = { current, limit, from };
	if (current >= limit) return { ...base, reached: true, days: 0, date: from, when: 'Now' };
	let days;
	let method;
	if (growthPerMonth != null) {
		// Growth from zero never gets anywhere.
		if (growthPerMonth <= 0 || current <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'compound' };
		days = (Math.log(limit / current) / Math.log(1 + growthPerMonth)) * PERIOD_DAYS.mo;
		method = 'compound';
	} else if (ratePerDay != null) {
		if (ratePerDay <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'linear' };
		days = (limit - current) / ratePerDay;
		method = 'linear';
	} else {
		throw new Error('eta needs a rate, a monthly growth or two data points');
	}
	const date = Number.isFinite(days) ? addDays(from, days) : null;
	if (!date) return { ...base, reached: false, method, rate_per_day: ratePerDay ?? null, days: null, date: null, when: 'Not on current trend' };
	return { ...base, reached: false, method, rate_per_day: ratePerDay ?? null, days: Math.round(days), weeks: round(days / 7, 1), date, when: `ETA ${approxMonth(date)}` };
}

/**
 * Prices a stack at several user counts. Model (all prices come from vendor pages read at run time):
 * { users: [1000, 10000, 100000],
 *   vendors: [{ id, per_user: { transfer_gb: 0.05 }, fixed: { seats: 1 },
 *     plans: [{ name, base, eligible?, metrics: { transfer_gb: { included, price?, per?, hard? } } }] }] }
 * Numbers are in the metric's unit (transfer_gb in GB); strings may carry one ("100 GB", "$0.15", "50k").
 * For each count the cheapest eligible plan whose hard limits hold is picked.
 */
function costAt(model) {
	const { users, vendors: list } = normalizeModel(model);
	return users.map((n) => {
		const vendors = list.map((v) => priceVendor(v, n));
		const monthly = round(vendors.reduce((sum, v) => sum + (v.cost ?? 0), 0), 2);
		return { users: n, monthly, yearly: round(monthly * 12, 2), complete: vendors.every((v) => v.plan), vendors };
	});
}

function modelNumber(v, metric, where) {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v !== 'string') throw new Error(`${where}: expected a number or a string such as "100 GB", got ${JSON.stringify(v)}`);
	let qv;
	try {
		qv = parseQuantity(v);
	} catch {
		throw new Error(`${where}: cannot read "${v}"`);
	}
	if (qv.per != null && qv.per !== PERIOD_DAYS.mo) throw new Error(`${where}: "${v}" is not monthly; the model is per month`);
	if (qv.dim === 'pct') throw new Error(`${where}: "${v}" is a percentage, expected an amount`);
	if (qv.dim !== 'size') return qv.value;
	const unit = /_(mb|gb|tb)$/.exec(metric ?? '')?.[1];
	if (!unit) throw new Error(`${where}: "${v}" is a size; name the metric *_mb, *_gb or *_tb, or give a plain number`);
	return qv.value / METRIC_UNIT_MB[unit];
}

// Turns every number of the model into a plain number in the metric's unit, or fails naming the field.
function normalizeModel(model) {
	if (!model || typeof model !== 'object' || Array.isArray(model)) throw new Error('the model must be an object: { users, vendors }');
	const users = [].concat(model.users ?? [1000, 10000, 100000]).map((n, i) => modelNumber(n, null, `users[${i}]`));
	const perMetric = (obj, where) => Object.fromEntries(Object.entries(obj ?? {}).map(([m, x]) => [m, modelNumber(x, m, `${where}.${m}`)]));
	const vendors = [].concat(model.vendors ?? []).map((v, vi) => {
		const at = `vendor ${v?.id ?? vi}`;
		const plans = [].concat(v.plans ?? []).map((p, pi) => {
			const pat = `${at} plan ${p?.name ?? pi}`;
			const metrics = {};
			for (const [m, r] of Object.entries(p.metrics ?? {})) {
				const per = r.per == null ? 1 : modelNumber(r.per, m, `${pat} ${m}.per`);
				if (!(per > 0)) throw new Error(`${pat} ${m}.per must be above 0`);
				const included = r.included == null ? 0 : modelNumber(r.included, m, `${pat} ${m}.included`);
				const price = r.price == null ? null : modelNumber(r.price, null, `${pat} ${m}.price`);
				metrics[m] = { ...r, included, price, per };
			}
			return { ...p, base: p.base == null ? 0 : modelNumber(p.base, null, `${pat} base`), metrics };
		});
		return { ...v, per_user: perMetric(v.per_user, `${at} per_user`), fixed: perMetric(v.fixed, `${at} fixed`), plans };
	});
	return { users, vendors };
}

function priceVendor(v, users) {
	const usage = {};
	for (const [metric, perUser] of Object.entries(v.per_user)) usage[metric] = perUser * users;
	for (const [metric, fixed] of Object.entries(v.fixed)) usage[metric] = (usage[metric] ?? 0) + fixed;
	const options = [];
	for (const plan of v.plans) {
		if (plan.eligible === false) continue;
		let cost = plan.base;
		let fits = true;
		const lines = [];
		for (const [metric, rule] of Object.entries(plan.metrics)) {
			const used = usage[metric] ?? 0;
			const included = rule.included;
			if (used > included && (rule.hard || rule.price == null)) {
				fits = false;
				break;
			}
			if (rule.price != null && used > included) {
				const o = overage({ used, included, price: rule.price, per: rule.per });
				cost += o.cost;
				lines.push({ metric, used: round(used, 2), included, over: round(o.over, 2), cost: o.cost });
			}
		}
		if (fits) options.push({ plan: plan.name, cost: round(cost, 2), overage: lines });
	}
	options.sort((a, b) => a.cost - b.cost);
	const usageRounded = Object.fromEntries(Object.entries(usage).map(([k, x]) => [k, round(x, 2)]));
	if (!options.length) return { id: v.id, plan: null, cost: null, usage: usageRounded, note: 'exceeds every listed plan: read the next tier or contact sales' };
	return { id: v.id, ...options[0], usage: usageRounded };
}

function q(args, key) {
	if (args[key] == null) return undefined;
	if (typeof args[key] !== 'string') throw new Error(`--${key} needs one value`);
	return parseQuantity(args[key]);
}

// "2026-09-06=41,200;2026-10-06=43,000": a comma separates points only when a date follows it.
function readPoints(list) {
	return [].concat(list).flatMap((s) => String(s).split(/\s*[;,]\s*(?=\d{4}-\d{2}-\d{2}\s*=)/)).map((p) => {
		const eq = p.indexOf('=');
		const date = p.slice(0, Math.max(eq, 0)).trim();
		if (eq < 1 || !isIsoDate(date)) throw new Error(`--points expects YYYY-MM-DD=value, got "${p}"`);
		const qv = parseQuantity(p.slice(eq + 1));
		return { date, value: qv.value, dim: qv.dim };
	});
}

const sameKind = (what, a, limit) => {
	if (a.dim !== limit.dim) throw new Error(`${what} is a ${a.dim} but --limit is a ${limit.dim}: give both in the same kind of unit`);
};

const USAGE = `usage:
  node project.mjs eta --current "312 MB" --limit "500 MB" --rate "1.1 MB/day" [--from 2026-10-06]
  node project.mjs eta --current 41200 --limit 50000 --growth "18%/mo"
  node project.mjs eta --points "2026-09-06=280 MB;2026-10-06=312 MB" --limit "500 MB"   (or repeat --points)
  node project.mjs overage --used "3.4 TB" --included "1 TB" --price 0.15 --per GB
  node project.mjs overage --used 60000 --included 50000 --price '$0.90' --per 1000
  node project.mjs cost <.manifestack/tmp/model.json | ->
Prints JSON. Prices are inputs: read them from the vendor page first.
A size needs a unit and is priced --per a size unit (GB); a count is priced --per a number (1000).`;

function projectMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	try {
		if (args.help) {
			process.stdout.write(USAGE + '\n');
			return;
		}
		if (cmd === 'eta') {
			const limit = q(args, 'limit');
			if (!limit) throw new Error('--limit is required');
			const input = { limit: limit.value, from: dateArg(args, 'from', todayIso()) };
			if (args.points != null) {
				if (args.points === true) throw new Error('--points needs YYYY-MM-DD=value pairs');
				input.points = readPoints(args.points);
				for (const p of input.points) sameKind(`--points ${p.date}`, p, limit);
			} else {
				const current = q(args, 'current');
				if (!current) throw new Error('--current or --points is required');
				if (current.dim !== limit.dim) throw new Error(`--current is a ${current.dim} but --limit is a ${limit.dim}: give both in the same kind of unit`);
				input.current = current.value;
				if (args.growth) {
					const g = q(args, 'growth');
					// "18%/mo" or the fraction 0.18; a bare 18 would be 1800% a month.
					if (g.dim === 'pct') input.growthPerMonth = monthlyGrowth(g.value, g.per ?? PERIOD_DAYS.mo);
					else if (g.dim === 'count' && g.value > 0 && g.value < 1 && g.per == null) input.growthPerMonth = g.value;
					else throw new Error('--growth is a percentage with a period, such as "18%/mo" or "4%/week"');
				} else if (args.rate) {
					const r = q(args, 'rate');
					if (r.dim === 'pct') throw new Error('--rate is an amount per period ("1.1 MB/day"); for a percentage use --growth');
					if (r.per == null) throw new Error('--rate needs a period, such as "1.1 MB/day" or "300/week"');
					sameKind('--rate', r, limit);
					input.ratePerDay = r.value / r.per;
				}
			}
			printJson(eta(input));
		} else if (cmd === 'overage') {
			// --per GB (price per unit of size) or --per 1000 (price per thousand of a count)
			const used = q(args, 'used');
			const price = q(args, 'price');
			if (!used || !price) throw new Error('--used and --price are required');
			if (used.dim !== 'size' && used.dim !== 'count') throw new Error('--used is an amount: a size such as "3.4 TB" or a count such as 60000');
			if ((price.dim !== 'money' && price.dim !== 'count') || price.per != null || price.value < 0) throw new Error("--price is the price of one --per unit, such as 0.15 or '$0.15'");
			const included = q(args, 'included') ?? { value: 0, dim: used.dim };
			if (included.dim !== used.dim && included.value !== 0) throw new Error(`--used is a ${used.dim} but --included is a ${included.dim}: give both with units ("3.4 TB", "1 TB") or both as counts`);
			let per = { value: 1, dim: 'count' };
			if (args.per != null) {
				if (typeof args.per !== 'string') throw new Error('--per needs one value: a size unit (GB) or a number (1000)');
				per = parseQuantity(/^[\d.]/.test(args.per) ? args.per : `1 ${args.per}`);
			}
			if (used.dim === 'size' && per.dim !== 'size') throw new Error('--used is a size: pass --per with a size unit, such as --per GB');
			if (used.dim === 'count' && per.dim !== 'count') throw new Error(`--per ${args.per} is a size but --used is a count: give --used and --included with units, such as "3.4 TB"`);
			if (!(per.value > 0)) throw new Error('--per must be above 0');
			const r = overage({ used: used.value, included: included.value, price: price.value, per: per.value });
			const unit = args.per == null ? 'unit' : String(args.per);
			printJson({ over: round(r.over / per.value, 2), unit, price: price.value, monthly: r.cost, yearly: round(r.cost * 12, 2) });
		} else if (cmd === 'cost') {
			const file = args._[1];
			if (!file) throw new Error('pass a model file or - for stdin');
			// The model is a working file: .manifestack/tmp is kept out of git before anything can fail.
			if (file !== '-') ignoreTmpDir(dirname(file));
			else if (existsSync(TMP_DIR)) ignoreTmpDir(TMP_DIR);
			let model;
			try {
				model = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'));
			} catch (e) {
				throw new Error(e instanceof SyntaxError ? `${file === '-' ? 'stdin' : file} is not valid JSON` : e.message);
			}
			printJson(costAt(model));
		} else {
			process.stdout.write(USAGE + '\n');
			if (cmd && cmd !== 'help') process.exitCode = 1;
		}
	} catch (e) {
		fail(e.message);
	}
}

// ---- packages/core/src/stack-md.mjs
// Reads and updates .manifestack/STACK.md, evaluates `revisit_when` and keeps secrets out of the file.
// Updates touch only the named fields: other lines, unknown keys and user comments stay as they are.

export const STACK_ROLES = ['Hosting', 'Database', 'Auth', 'Email', 'Storage', 'Payments', 'Monitoring', 'AI', 'Other'];
export const STACK_KEYS = ['plan', 'limit', 'source', 'usage', 'decided', 'revisit_when', 'next', 'env'];
export const REQUIREMENT_KEYS = ['budget', 'users', 'requires', 'prefer', 'avoid', 'priority'];
export const PRIORITIES = ['lowest cost', 'balanced', 'least ops', 'control'];
export const REVISIT_METRICS = ['db_size', 'monthly_sent', 'daily_peak', 'transfer_tb', 'mau', 'users', 'monthly_bill', 'date'];

// Env var names (NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL) and URL slugs (2024-11-05-pro-plan-pricing-update) are made of
// words, numbers and short parts like R2 or v2. A key has at least one long part that mixes letters and digits.
function looksRandom(token) {
	// Stripe object ids (price_…, prod_…) identify things; they are not secrets.
	if (/^(?:price|prod|plan|cus|sub|acct|evt|pi|ch|in|si|txn|po|tr|seti|pm)_[A-Za-z0-9]+$/.test(token)) return false;
	const parts = token.split(/[-_]+/).filter(Boolean);
	if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(token) && parts.every((p) => p.length <= 12)) return false;
	return !parts.every((p) => /^(?:[A-Za-z]+|\d+)$/.test(p) || p.length <= 4);
}

// re_engagement_campaigns is a name; re_ followed by digits or mixed case is a Resend key.
const isResendKey = (m) => {
	const body = m.slice(3).replace(/_/g, '');
	return (/\d/.test(body) && /[A-Za-z]/.test(body)) || (/[a-z]/.test(body) && /[A-Z]/.test(body));
};

// A value after a key=, key: or "key": looks like a password when it mixes letters with digits or cases; an env
// var name (STRIPE_SECRET_KEY) or a plain word is not one.
const isCredentialValue = (m) => {
	const v = m[1] ?? '';
	if (/^[A-Z][A-Z0-9_]*$/.test(v) || /^\$\{?[A-Za-z_]/.test(v) || /^<.*>$/.test(v)) return false;
	return (/\d/.test(v) && /[A-Za-z]/.test(v)) || (/[a-z]/.test(v) && /[A-Z]/.test(v));
};

// A commit hash, digest or UUID as a segment of a URL path (github.com/o/r/blob/<sha>/x.md) names a version, not a
// secret. Alone, the same shapes can be keys (old GitHub tokens are 40 hex characters), so they still count.
const inUrlPath = (m) => m.input[m.index - 1] === '/' && /^(?:[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(m[0]);

// 40 characters of base64 with both cases and a digit: an AWS secret access key and its kind.
const isMixedBase64 = (m) => /[a-z]/.test(m[0]) && /[A-Z]/.test(m[0]) && /\d/.test(m[0]);

const SECRET_PATTERNS = [
	['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
	// redis://:password@host has no user; the password may not contain "/" (that would be a path).
	['URL with credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]*:[^\s@/]+@[^\s@]+/i],
	['API key (sk_/pk_/rk_)', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/],
	['Supabase key', /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/],
	['Resend key', /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{8,}(?![A-Za-z0-9_])|\bre_[A-Za-z0-9]{24,}\b/, (m) => isResendKey(m[0])],
	['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/],
	['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
	['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
	['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
	['Neon API key', /\bnapi_[A-Za-z0-9]{16,}/],
	// Only names that usually hold secrets: NODE_ENV=production in a note is fine.
	['env assignment', /\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|DSN|CREDENTIALS?|PRIVATE)[A-Z0-9_]*\s*=\s*['"]?[^\s'"]{6,}/],
	// db_password: Sup3rS3cret, "apiKey": "…", stripe_secret_key=… (any case, = or :).
	['credential', /\b[A-Za-z0-9_]*(?:key|secret|token|password|passwd|pwd|credentials?)["']?\s*[:=]\s*['"]?([^\s'",;]{6,})/i, isCredentialValue],
	['AWS secret key', /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])/, isMixedBase64],
	['long token', /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/, (m) => !inUrlPath(m) && looksRandom(m[0])],
].map(([kind, re, check]) => [kind, new RegExp(re.source, re.flags + 'g'), check]);

const secretIn = (line, re, check) => [...line.matchAll(re)].some((m) => !check || check(m));

/** Finds strings that look like secrets, one hit per line. STACK.md must never contain one. */
export function findSecrets(text) {
	const hits = [];
	text.split(/\r?\n/).forEach((line, idx) => {
		const hit = SECRET_PATTERNS.find(([, re, check]) => secretIn(line, re, check));
		if (hit) hits.push({ line: idx + 1, kind: hit[0] });
	});
	return hits;
}

export function scrubSecrets(text) {
	let out = text;
	for (const [, re, check] of SECRET_PATTERNS) {
		// replace() passes (match, ...groups, offset, input): rebuild the match object the checks expect.
		out = out.replace(re, (...a) => {
			const m = Object.assign(a.slice(0, -2), { index: a.at(-2), input: a.at(-1) });
			return !check || check(m) ? '[removed]' : m[0];
		});
	}
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
// Scanned by hand: a regex for "two blanks, then #" backtracks quadratically over a long run of spaces.
const isBlank = (c) => c === ' ' || c === '\t';
function splitComment(raw) {
	for (let i = raw.indexOf('#'); i !== -1; i = raw.indexOf('#', i + 1)) {
		let start = i;
		while (start > 0 && isBlank(raw[start - 1])) start--;
		if (i - start < 2) continue;
		const text = raw.slice(isBlank(raw[i + 1]) ? i + 2 : i + 1);
		return { value: raw.slice(0, start).trim(), comment: text.trim(), commentRaw: raw.slice(start).trimEnd() };
	}
	return { value: raw.trim(), comment: null, commentRaw: '' };
}

/** "## Database: Supabase ##" → "Database: Supabase". A closing run of # needs a blank before it: "## Other: C#" names C#. */
function headingText(line) {
	if (!line.startsWith('##') || !isBlank(line[2] ?? '')) return null;
	const text = line.slice(3).trim();
	let end = text.length;
	while (end > 0 && text[end - 1] === '#') end--;
	return end < text.length && end > 0 && isBlank(text[end - 1]) ? text.slice(0, end).trimEnd() : text || null;
}

/** "Database: Supabase" → role and vendor, or null when the heading is not "<Role>: <Vendor>". */
function roleAndVendor(heading) {
	const colon = heading.indexOf(':');
	if (colon < 1) return null;
	const role = heading.slice(0, colon).trim();
	const vendor = heading.slice(colon + 1).trim();
	return /^[A-Za-z][A-Za-z ]*$/.test(role) && vendor ? { role, vendor } : null;
}

function scanSections(lines) {
	const sections = [];
	let current = null;
	let fence = null;
	let comment = false;
	lines.forEach((line, idx) => {
		// Text inside <!-- --> is not part of the document (the template keeps its example there).
		if (comment) {
			if (line.includes('-->')) comment = false;
			return;
		}
		// A fence closes only with the same character, at least as long and with nothing after it (CommonMark), so
		// a ``` line inside a ~~~ block or a ```` block does not end it.
		const fm = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		if (fence) {
			if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length && !fm[2].trim()) fence = null;
			return;
		}
		if (fm && !(fm[1][0] === '`' && fm[2].includes('`'))) {
			fence = fm[1];
			return;
		}
		// Only a line that starts with <!-- opens a comment block (as in Markdown); "<!--" inside a value is text.
		if (/^\s*<!--/.test(line)) {
			if (!line.includes('-->', line.indexOf('<!--') + 4)) comment = true;
			return;
		}
		const heading = headingText(line);
		if (heading) {
			const rv = roleAndVendor(heading);
			current = {
				heading,
				headingLine: idx,
				kind: /^requirements$/i.test(heading) ? 'requirements' : rv ? 'service' : 'other',
				role: rv?.role ?? null,
				vendor: rv?.vendor ?? null,
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
const normalizeHeading = (h) => {
	const s = String(h).trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ');
	const colon = s.indexOf(':');
	return colon === -1 ? s : `${s.slice(0, colon).trimEnd()}: ${s.slice(colon + 1).trimStart()}`.trimEnd();
};
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
	if (/^[^:]+:\s*$/.test(heading)) throw new Error(`section "${heading}" names no vendor after the colon`);
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

// Dates in a usage entry: "(2026-10-06)", "(as of 2026-10-6)", "(read 2026-10-06, dashboard)".
const USAGE_DATE = /\(([^()]*?)\b(\d{4})-(\d{1,2})-(\d{1,2})\b([^()]*)\)/;

// "41,200" groups thousands; "312 MB,+1.1 MB/day" separates parts.
const USAGE_PARTS = /,(?!\d{3}(?!\d))\s*/;

/** A quantity with words after it: "41,200 emails", "+300 emails/day", "3.4 TB of transfer", "9k users". */
function usageQuantity(text) {
	try {
		return parseQuantity(text);
	} catch {
		// Keep a trailing "/period", drop the plain words before it (but not a size unit such as MB).
		const t = String(text).trim();
		const slash = t.lastIndexOf('/');
		const per = slash !== -1 && /^\/ ?[A-Za-z]+$/.test(t.slice(slash)) ? t.slice(slash) : '';
		const words = (per ? t.slice(0, slash) : t).split(/\s+/).filter(Boolean);
		while (words.length > 1 && /^[A-Za-z]+$/.test(words.at(-1)) && !/^[KMGT]?B$/i.test(words.at(-1))) words.pop();
		return parseQuantity(words.join(' ') + per);
	}
}

/**
 * Reads a `usage` value: "312 MB, +1.1 MB/day (2026-10-06)", optionally named ("db_size 312 MB, ..."),
 * several entries separated by ";". Returns { metrics, problems }: metrics is
 * { metricName | "_": { value, dim, ratePerDay?, rateDim?, growthPerMonth?, asOf? } }, problems lists what could
 * not be read, so lint can say so instead of a check that quietly reports "ok". An impossible date is an error.
 */
export function readUsage(raw) {
	const metrics = {};
	const problems = [];
	let last = null;
	for (const entry of String(raw ?? '').split(';')) {
		let s = entry.trim();
		if (!s) continue;
		let asOf = null;
		const d = USAGE_DATE.exec(s);
		if (d) {
			asOf = `${d[2]}-${d[3].padStart(2, '0')}-${d[4].padStart(2, '0')}`;
			if (!isIsoDate(asOf)) throw new Error(`usage: "${d[2]}-${d[3]}-${d[4]}" is not a date (YYYY-MM-DD)`);
			s = s.replace(d[0], '').trim();
		}
		let name = null;
		const n = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*[=:]\s*|\s+)(?=[+$\d.~])/.exec(s);
		if (n) {
			name = n[1].toLowerCase();
			s = s.slice(n[0].length);
		}
		const parts = s.split(USAGE_PARTS).map((p) => p.trim().replace(/^~\s*/, '')).filter(Boolean);
		const rates = [];
		let base = null;
		for (const p of parts) {
			let q;
			try {
				q = usageQuantity(p);
			} catch {
				problems.push(`cannot read "${p}"`);
				continue;
			}
			if (q.per != null || q.dim === 'pct') rates.push(q);
			else if (!base) base = q;
			else problems.push(`"${p}" is a second reading; separate metrics with ";" and name them`);
		}
		// "312 MB; +1.1 MB/day (date)": a rate alone continues the reading before it.
		const target = base ? { value: base.value, dim: base.dim, asOf } : !name && last ? last : null;
		if (!target) {
			if (parts.length) problems.push(`"${entry.trim()}" has a rate but no reading`);
			continue;
		}
		if (!base && asOf && !target.asOf) target.asOf = asOf;
		for (const r of rates) {
			if (r.dim === 'pct') target.growthPerMonth = monthlyGrowth(r.value, r.per ?? undefined);
			else if (r.per) {
				target.ratePerDay = r.value / r.per;
				if (r.dim !== target.dim) target.rateDim = r.dim;
			}
		}
		if (base) {
			metrics[name ?? '_'] = target;
			last = target;
		}
		if ((target.ratePerDay != null || target.growthPerMonth != null) && !target.asOf) problems.push('a reading with a rate has no date; add (YYYY-MM-DD) so projections start from it');
	}
	return { metrics, problems: [...new Set(problems)] };
}

export function parseUsage(raw) {
	return readUsage(raw).metrics;
}

/**
 * Requirements → users: the first number ("9k now, 50k by Q3" is 9000; "9 000", "~9k", "12,000" and "1.5 million" work).
 * null when that number is not a count of users ("12 months out, 3k") or there is none.
 */
export function parseUsers(raw) {
	const s = String(raw ?? '');
	const re = /(?<![\w.$-])(?:~\s*)?(\d{1,3}(?:([ ,_])\d{3})(?:\2\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*([km]|thousand|million|mln|bn|billion)(?![a-z]))?/gi;
	let first;
	let after;
	for (;;) {
		first = re.exec(s);
		if (!first) return null;
		after = s.slice(first.index + first[0].length);
		// "5x growth" is a multiplier; "launch in 2027" is a year, unless users follow ("2000 users").
		if (/^\s*[x×](?![a-z])/i.test(after)) continue;
		if (!first[3] && /^(19|20)\d\d$/.test(first[1]) && !/^\s*[-/.]\d/.test(after) && !/^\s*(?:users?|people|customers?|accounts?|seats?|mau|members?)\b/i.test(after)) continue;
		break;
	}
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

const nextDay = (iso) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
const earliest = (dates) => dates.filter(Boolean).sort()[0] ?? null;

function evalRevisit(node, ctx) {
	if (node.type === 'manual') return { value: null, eta: null, unknown: [], manual: [node.text] };
	if (node.type === 'cmp') {
		if (node.metric === 'date') {
			const value = compare(ctx.today, node.op, node.date);
			// "date > 2026-12-01" holds from Dec 2.
			const due = !value && node.op === '>=' ? node.date : !value && node.op === '>' ? nextDay(node.date) : null;
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
	const priority = doc.requirements?.priority;
	if (priority && !PRIORITIES.includes(priority.toLowerCase())) warnings.push({ line: 1, message: `priority "${priority}" is not one of ${PRIORITIES.join(', ')}` });
	for (const s of doc.sections) {
		if (s.kind === 'other') warnings.push({ line: s.line, message: `heading "${s.heading}" is not "<Role>: <Vendor>"` });
		if (s.kind !== 'service') continue;
		if (!STACK_ROLES.includes(s.role)) warnings.push({ line: s.line, message: `role "${s.role}" is not one of ${STACK_ROLES.join(', ')}` });
		if (s.values.env && /=/.test(s.values.env)) errors.push({ line: s.line, message: 'env lists names only, without values' });
		if (s.values.source && !/\d{4}-\d{2}-\d{2}/.test(`${s.values.source} ${s.comments.source ?? ''}`)) warnings.push({ line: s.line, message: 'source has no read date (add "# read YYYY-MM-DD")' });
		try {
			for (const p of readUsage(s.values.usage).problems) warnings.push({ line: s.line, message: `usage: ${p}. Write it as "312 MB, +1.1 MB/day (2026-10-06)"` });
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
		// The item is not echoed: a value pasted without its key may be the very secret set refuses to write.
		if (item === true || eq < 1) throw new Error(`${flag} expects key=value`);
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
			// Lines this write adds must be clean; a line already in the file is lint's to report, so one old
			// false alarm does not block every later update.
			const before = new Set(text.split(/\r?\n/));
			const outLines = out.split(/\r?\n/);
			const secrets = findSecrets(out);
			const added = secrets.filter((h) => !before.has(outLines[h.line - 1]));
			if (added.length) {
				process.exitCode = 2;
				throw new Error(`refusing to write: lines ${[...new Set(added.map((h) => h.line))].join(', ')} look like secrets`);
			}
			ensureWorkDir(file);
			// Write a sibling file, then rename: an interrupted write never leaves half a STACK.md.
			const tmp = `${file}.${process.pid}.tmp`;
			try {
				writeFileSync(tmp, out);
				renameSync(tmp, file);
			} catch (e) {
				rmSync(tmp, { force: true });
				throw e;
			}
			const elsewhere = [...new Set(secrets.filter((h) => before.has(outLines[h.line - 1])).map((h) => h.line))];
			printJson({ file, written: true, section: normalizeHeading(args.section), ...(elsewhere.length ? { secrets_elsewhere: elsewhere } : {}) });
		}
	} catch (e) {
		fail(e.message, process.exitCode || 1);
	}
}

if (isMain(import.meta.url)) stackMdMain(process.argv.slice(2)); // @main
