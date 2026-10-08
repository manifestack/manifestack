// Everything Manifestack writes in a project lives in one folder, .manifestack/ at the repository root:
//   .manifestack/STACK.md   decisions, committed with the code
//   .manifestack/tmp/       working files such as cost models, ignored by git
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const WORK_DIR = '.manifestack';
export const STACK_FILE = `${WORK_DIR}/STACK.md`;
export const TMP_DIR = `${WORK_DIR}/tmp`;

/** Creates the folder a file goes into. Inside .manifestack/tmp it also adds a .gitignore that ignores the folder. */
export function ensureWorkDir(file) {
	const dir = dirname(file);
	mkdirSync(dir, { recursive: true });
	ignoreTmpDir(dir);
}

/** Adds .manifestack/tmp/.gitignore when `dir` is that folder and the file is missing. Never writes through a symlink. */
export function ignoreTmpDir(dir) {
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
export function withinCwd(file) {
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
