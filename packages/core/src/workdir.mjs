// Everything Manifestack writes in a project lives in one folder, .manifestack/ at the repository root:
//   .manifestack/STACK.md   decisions, committed with the code
//   .manifestack/tmp/       working files such as cost models, ignored by git
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const WORK_DIR = '.manifestack';
export const STACK_FILE = `${WORK_DIR}/STACK.md`;
export const TMP_DIR = `${WORK_DIR}/tmp`;

/** Creates the folder a file goes into. Inside .manifestack/tmp it also adds a .gitignore that ignores the folder. */
export function ensureWorkDir(file) {
	const dir = dirname(file);
	mkdirSync(dir, { recursive: true });
	if (basename(dir) === 'tmp' && basename(dirname(dir)) === WORK_DIR) {
		const ignore = join(dir, '.gitignore');
		if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
	}
}
