import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = join(ROOT, 'test/fixtures');
export const CORE = join(ROOT, 'packages/core/src');

export function tempDir(t) {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), 'manifestack-test-')));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

export function runNode(script, args = [], { input, cwd } = {}) {
	const r = spawnSync(process.execPath, [script, ...args], { input, cwd, encoding: 'utf8' });
	return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
