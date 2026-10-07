// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
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
		if (key in args) args[key] = [].concat(args[key], value);
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

function todayIso() {
	return new Date().toISOString().slice(0, 10);
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
	if (basename(dir) === 'tmp' && basename(dirname(dir)) === WORK_DIR) {
		const ignore = join(dir, '.gitignore');
		if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
	}
}

// ---- packages/core/src/project.mjs
// Cost and limit projections. Prices are inputs: the skill reads them from vendor pages at run time.
// Sizes are decimal (1 GB = 1000 MB), as vendors bill them. Money is USD. No network.

const SIZE_UNITS = { B: 1e-6, KB: 1e-3, MB: 1, GB: 1e3, TB: 1e6 };
const PERIOD_DAYS = { day: 1, d: 1, week: 7, wk: 7, w: 7, month: 30.4375, mo: 30.4375, year: 365.25, yr: 365.25 };
const DAY_MS = 86400000;

/**
 * Parses "312 MB", "+1.1 MB/day", "$25/mo", "41,200", "9k", "18%/mo", "3.4 TB".
 * Returns { value, dim, per } where value is in base units (MB for size, USD for money, 1 for count,
 * percent for pct) and `per` is the period in days for rates (null otherwise).
 */
export function parseQuantity(input) {
	if (typeof input === 'number') return { value: input, dim: 'count', per: null };
	const s = String(input).trim();
	const m = /^([+-])?\s*(\$)?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([kKmM](?![bB]))?\s*(%|[KMGT]?B\b)?\s*(?:\/\s*(day|d|week|wk|w|month|mo|year|yr))?$/i.exec(s);
	if (!m) throw new Error(`cannot read quantity "${input}"`);
	const [, sign, dollar, num, mult, unit, period] = m;
	let value = Number(num.replace(/,/g, ''));
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

export function formatSize(mb) {
	if (Math.abs(mb) >= 1e6) return `${round(mb / 1e6, 2)} TB`;
	if (Math.abs(mb) >= 1e3) return `${round(mb / 1e3, 2)} GB`;
	return `${round(mb, 2)} MB`;
}

function round(n, digits = 2) {
	const f = 10 ** digits;
	return Math.round(n * f) / f;
}

function addDays(iso, days) {
	return new Date(Date.parse(iso + 'T00:00:00Z') + Math.round(days) * DAY_MS).toISOString().slice(0, 10);
}

/** "~Mar 2027", the form findings use for `when`. */
export function approxMonth(iso) {
	const d = new Date(iso + 'T00:00:00Z');
	return `~${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

/** Overage on published rates: max(0, used - included) / per × price. */
export function overage({ used, included = 0, price, per = 1 }) {
	const over = Math.max(0, used - included);
	return { over, cost: round((over / per) * price, 2) };
}

/** Least-squares slope in units per day from [{ date, value }]. Needs two points or more. */
export function linearRate(points) {
	if (points.length < 2) throw new Error('a growth rate needs two data points');
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
export function eta({ current, limit, ratePerDay, growthPerMonth, points, from = todayIso() }) {
	if (points?.length) {
		ratePerDay = linearRate(points);
		const last = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
		current = last.value;
		from = last.date;
	}
	const base = { current, limit, from };
	if (current >= limit) return { ...base, reached: true, days: 0, date: from, when: 'Now' };
	let days;
	let method;
	if (growthPerMonth != null) {
		if (growthPerMonth <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'compound' };
		days = (Math.log(limit / current) / Math.log(1 + growthPerMonth)) * PERIOD_DAYS.mo;
		method = 'compound';
	} else if (ratePerDay != null) {
		if (ratePerDay <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'linear' };
		days = (limit - current) / ratePerDay;
		method = 'linear';
	} else {
		throw new Error('eta needs a rate, a monthly growth or two data points');
	}
	const date = addDays(from, days);
	return { ...base, reached: false, method, rate_per_day: ratePerDay ?? null, days: Math.round(days), weeks: round(days / 7, 1), date, when: `ETA ${approxMonth(date)}` };
}

/**
 * Prices a stack at several user counts. Model (all prices come from vendor pages read at run time):
 * { users: [1000, 10000, 100000],
 *   vendors: [{ id, per_user: { transfer_gb: 0.05 }, fixed: { seats: 1 },
 *     plans: [{ name, base, eligible?, metrics: { transfer_gb: { included, price?, per?, hard? } } }] }] }
 * For each count the cheapest eligible plan whose hard limits hold is picked.
 */
export function costAt(model) {
	const users = model.users ?? [1000, 10000, 100000];
	return users.map((n) => {
		const vendors = (model.vendors ?? []).map((v) => priceVendor(v, n));
		const monthly = round(vendors.reduce((sum, v) => sum + (v.cost ?? 0), 0), 2);
		return { users: n, monthly, yearly: round(monthly * 12, 2), complete: vendors.every((v) => v.plan), vendors };
	});
}

function priceVendor(v, users) {
	const usage = {};
	for (const [metric, perUser] of Object.entries(v.per_user ?? {})) usage[metric] = perUser * users;
	for (const [metric, fixed] of Object.entries(v.fixed ?? {})) usage[metric] = (usage[metric] ?? 0) + fixed;
	const options = [];
	for (const plan of v.plans ?? []) {
		if (plan.eligible === false) continue;
		let cost = plan.base ?? 0;
		let fits = true;
		const lines = [];
		for (const [metric, rule] of Object.entries(plan.metrics ?? {})) {
			const used = usage[metric] ?? 0;
			const included = rule.included ?? 0;
			if (used > included && (rule.hard || rule.price == null)) {
				fits = false;
				break;
			}
			if (rule.price != null && used > included) {
				const o = overage({ used, included, price: rule.price, per: rule.per ?? 1 });
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
	return args[key] == null ? undefined : parseQuantity(args[key]);
}

const USAGE = `usage:
  node project.mjs eta --current "312 MB" --limit "500 MB" --rate "1.1 MB/day" [--from 2026-10-06]
  node project.mjs eta --current 41200 --limit 50000 --growth "18%/mo"
  node project.mjs eta --points "2026-09-06=280 MB,2026-10-06=312 MB" --limit "500 MB"
  node project.mjs overage --used "3.4 TB" --included "1 TB" --price 0.15 --per GB
  node project.mjs cost <.manifestack/tmp/model.json | ->
Prints JSON. Prices are inputs: read them from the vendor page first.`;

export function projectMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	try {
		if (cmd === 'eta') {
			const limit = q(args, 'limit');
			if (!limit) throw new Error('--limit is required');
			const input = { limit: limit.value, from: args.from || todayIso() };
			if (args.points) {
				input.points = String(args.points).split(',').map((p) => {
					const [date, value] = p.split('=');
					return { date: date.trim(), value: parseQuantity(value).value };
				});
			} else {
				const current = q(args, 'current');
				if (!current) throw new Error('--current or --points is required');
				input.current = current.value;
				if (args.growth) {
					const g = parseQuantity(args.growth);
					input.growthPerMonth = (g.dim === 'pct' ? g.value / 100 : g.value) * (PERIOD_DAYS.mo / (g.per ?? PERIOD_DAYS.mo));
				} else if (args.rate) {
					const r = parseQuantity(args.rate);
					input.ratePerDay = r.value / (r.per ?? 1);
				}
			}
			printJson(eta(input));
		} else if (cmd === 'overage') {
			// --per GB (price per unit of size) or --per 1000 (price per thousand of a count)
			const per = args.per && args.per !== true ? parseQuantity(/^\d/.test(args.per) ? args.per : `1 ${args.per}`).value : 1;
			const used = q(args, 'used');
			if (!used || args.price == null) throw new Error('--used and --price are required');
			const included = q(args, 'included')?.value ?? 0;
			const r = overage({ used: used.value, included, price: Number(args.price), per });
			const unit = args.per && args.per !== true ? String(args.per) : 'unit';
			printJson({ over: round(r.over / per, 2), unit, price: Number(args.price), monthly: r.cost, yearly: round(r.cost * 12, 2) });
		} else if (cmd === 'cost') {
			const file = args._[1];
			if (!file) throw new Error('pass a model file or - for stdin');
			const model = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'));
			// The model is a working file: in .manifestack/tmp it stays out of git.
			if (file !== '-') ensureWorkDir(file);
			printJson(costAt(model));
		} else {
			process.stdout.write(USAGE + '\n');
			if (cmd && cmd !== 'help') process.exitCode = 1;
		}
	} catch (e) {
		fail(e.message);
	}
}

if (isMain(import.meta.url)) projectMain(process.argv.slice(2)); // @main
