// Small helpers shared by the command-line entry points of every script.
// Rules for all files in packages/core/src (tools/sync.mjs bundles them into single files):
//   - imports on one line, named only, no `as` renames, only `node:*` or relative `./x.mjs`;
//   - top-level names unique across modules;
//   - the line that runs a module as a script ends with `// @main`.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isMain(moduleUrl) {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
	} catch {
		return false;
	}
}

/** Parses `--key value`, `--key=value` and `--flag`. Repeated keys become arrays. */
export function parseArgs(argv) {
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

export function printJson(value) {
	process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

export function fail(message, code = 1) {
	process.stderr.write(`error: ${message}\n`);
	process.exit(code);
}

/** Today in the local time zone: a UTC date is a day off for half the world around midnight. */
export function todayIso() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD that names a real day: 2026-13-01 and 2027-02-30 are rejected. */
export function isIsoDate(s) {
	if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const t = Date.parse(s + 'T00:00:00Z');
	return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** Reads a date option such as --today or --from; a bare flag or an impossible date is an error. */
export function dateArg(args, key, fallback) {
	const v = args[key];
	if (v == null) return fallback;
	if (!isIsoDate(v)) throw new Error(`--${key} needs a date as YYYY-MM-DD${v === true ? '' : `, got "${v}"`}`);
	return v;
}
