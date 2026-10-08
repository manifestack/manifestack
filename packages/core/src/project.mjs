// Cost and limit projections. Prices are inputs: the skill reads them from vendor pages at run time.
// Sizes are decimal (1 GB = 1000 MB), as vendors bill them. Money is USD. No network.
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMain, parseArgs, printJson, fail, todayIso, isIsoDate, dateArg } from './cli-util.mjs';
import { TMP_DIR, ignoreTmpDir } from './workdir.mjs';

const SIZE_UNITS = { B: 1e-6, KB: 1e-3, MB: 1, GB: 1e3, TB: 1e6 };
const PERIOD_DAYS = { day: 1, d: 1, week: 7, wk: 7, w: 7, month: 30.4375, mo: 30.4375, year: 365.25, yr: 365.25 };
const DAY_MS = 86400000;
/** A plain number on a metric named *_mb, *_gb or *_tb is in that unit; this is the unit in MB. */
export const METRIC_UNIT_MB = { mb: 1, gb: 1e3, tb: 1e6 };

/**
 * Parses "312 MB", "+1.1 MB/day", "$25/mo", "41,200", "9k", "18%/mo", "3.4 TB".
 * Thousands are grouped in threes by ",", "_" or a space: "1,5 GB" is an error, not 15 GB.
 * Returns { value, dim, per } where value is in base units (MB for size, USD for money, 1 for count,
 * percent for pct) and `per` is the period in days for rates (null otherwise).
 */
export function parseQuantity(input) {
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

export function formatSize(mb) {
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
export function monthlyGrowth(pct, perDays = PERIOD_DAYS.mo) {
	return (1 + pct / 100) ** (PERIOD_DAYS.mo / perDays) - 1;
}

// null past year 9999: such a date means "not on this trend", and toISOString cannot write it as YYYY-MM-DD.
function addDays(iso, days) {
	const d = new Date(Date.parse(iso + 'T00:00:00Z') + Math.round(days) * DAY_MS);
	if (!Number.isFinite(d.getTime()) || d.getUTCFullYear() > 9999) return null;
	return d.toISOString().slice(0, 10);
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
export function eta({ current, limit, ratePerDay, growthPerMonth, points, from = todayIso() }) {
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
 *     plans: [{ name, base, credit?, eligible?, metrics: { transfer_gb: { included, price?, per?, hard? } } }] }] }
 * `credit` is usage credit included in the plan each month: it pays for overage, never for `base`.
 * Numbers are in the metric's unit (transfer_gb in GB); strings may carry one ("100 GB", "$0.15", "50k").
 * For each count the cheapest eligible plan whose hard limits hold is picked.
 */
export function costAt(model) {
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
			const credit = p.credit == null ? 0 : modelNumber(p.credit, null, `${pat} credit`);
			if (credit < 0) throw new Error(`${pat} credit must not be negative`);
			return { ...p, base: p.base == null ? 0 : modelNumber(p.base, null, `${pat} base`), credit, metrics };
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
		let over = 0;
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
				over += o.cost;
				lines.push({ metric, used: round(used, 2), included, over: round(o.over, 2), cost: o.cost });
			}
		}
		const credit = Math.min(plan.credit, over);
		if (fits) options.push({ plan: plan.name, cost: round(plan.base + over - credit, 2), overage: lines, ...(credit ? { credit_used: round(credit, 2) } : {}) });
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
function splitPoints(s) {
	const parts = String(s).split(/([;,])/); // pieces and separators, alternating
	const out = [];
	let current = parts[0];
	for (let i = 1; i < parts.length; i += 2) {
		if (/^\s*\d{4}-\d{2}-\d{2}\s*=/.test(parts[i + 1])) {
			out.push(current.trim());
			current = parts[i + 1];
		} else current += parts[i] + parts[i + 1];
	}
	out.push(current.trim());
	return out;
}

function readPoints(list) {
	return [].concat(list).flatMap(splitPoints).map((p) => {
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

export function projectMain(argv) {
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

if (isMain(import.meta.url)) projectMain(process.argv.slice(2)); // @main
