#!/usr/bin/env node
// Checks the npm package as users get it: packs packages/cli the way `npm publish` does (prepack included),
// runs the tarball with `npm exec` in an empty project, then runs the installed hooks and skill scripts.
// The tests in test/ run the CLI from the repository, where it reads skills/ and hooks/ directly.
//
//   npm run smoke
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Under `npm run`, npm_execpath points to npm's own script, which also works on Windows where `npm` is a .cmd file.
function npm(args, cwd) {
	const [file, pre] = process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath]] : ['npm', []];
	return execFileSync(file, [...pre, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
const node = (args, cwd, input) => execFileSync(process.execPath, args, { cwd, input, encoding: 'utf8' });

const tmp = mkdtempSync(join(tmpdir(), 'manifestack-smoke-'));
try {
	npm(['pack', '-w', 'packages/cli', '--pack-destination', tmp], ROOT);
	const tarball = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
	assert.ok(tarball, 'npm pack produced no tarball');

	const app = join(tmp, 'app');
	mkdirSync(app);
	writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', dependencies: {} }));
	const manifestack = (...args) => npm(['exec', '--yes', `--package=${join(tmp, tarball)}`, '--', 'manifestack', ...args, '--agent', 'claude-code', '--agent', 'cursor', '--yes'], app);

	manifestack('install');
	for (const file of [
		'.claude/skills/manifestack/SKILL.md',
		'.claude/skills/manifestack/vendors/resend.md',
		'.claude/skills/manifestack/scripts/detect.mjs',
		'.claude/skills/manifestack-guard/SKILL.md',
		'.claude/hooks/manifestack-new-vendor.mjs',
		'.claude/settings.json',
		'.cursor/hooks/manifestack-new-vendor.mjs',
		'.cursor/hooks.json',
	]) assert.ok(existsSync(join(app, file)), `install did not create ${file}`);

	const before = JSON.stringify({ name: 'app', dependencies: {} }, null, 2);
	const after = JSON.stringify({ name: 'app', dependencies: { resend: '6' } }, null, 2);
	writeFileSync(join(app, 'package.json'), after);
	const claude = JSON.parse(node(['.claude/hooks/manifestack-new-vendor.mjs'], app, JSON.stringify({ cwd: app, tool_name: 'Write', tool_input: { file_path: 'package.json' } })));
	assert.match(claude.hookSpecificOutput.additionalContext, /Resend \(email\) was added/);
	const cursor = JSON.parse(node(['.cursor/hooks/manifestack-new-vendor.mjs'], app, JSON.stringify({ hook_event_name: 'afterFileEdit', file_path: join(app, 'package.json'), edits: [{ old_string: before, new_string: after }], workspace_roots: [app] })));
	assert.match(cursor.additional_context, /Resend \(email\) was added/);

	const detected = JSON.parse(node(['.claude/skills/manifestack/scripts/detect.mjs'], app));
	assert.ok(detected.vendors.some((v) => v.id === 'resend'), 'detect.mjs did not find resend');
	assert.deepEqual(JSON.parse(node(['.claude/skills/manifestack-guard/scripts/stack-md.mjs', 'parse'], app)), { exists: false, file: '.manifestack/STACK.md' });

	manifestack('uninstall');
	for (const dir of ['.claude/skills/manifestack', '.claude/hooks/manifestack-new-vendor.mjs', '.cursor/hooks/manifestack-new-vendor.mjs']) {
		assert.ok(!existsSync(join(app, dir)), `uninstall left ${dir}`);
	}
	console.log(`smoke: ${tarball} installs, runs and uninstalls`);
} finally {
	rmSync(tmp, { recursive: true, force: true });
}
