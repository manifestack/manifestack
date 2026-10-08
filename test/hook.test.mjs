import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, runNode, tempDir } from './helpers.mjs';
import { readHookEvent, newVendorMessage } from '../packages/core/src/hook.mjs';
import { loadCatalog, vendorSignatures } from '../packages/core/src/catalog.mjs';

const HOOK = join(ROOT, 'hooks/new-vendor.mjs');
const pkg = (deps) => JSON.stringify({ name: 'app', dependencies: deps }, null, 2) + '\n';

function project(t, deps, stackMd) {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.git'));
	writeFileSync(join(dir, 'package.json'), pkg(deps));
	if (stackMd) {
		mkdirSync(join(dir, '.manifestack'));
		writeFileSync(join(dir, '.manifestack/STACK.md'), stackMd);
	}
	return dir;
}

const run = (input) => runNode(HOOK, [], { input: JSON.stringify(input) });

test('Claude Code Edit that adds resend returns context', (t) => {
	const dir = project(t, { next: '15', resend: '^6' });
	const r = run({
		hook_event_name: 'PostToolUse',
		cwd: dir,
		tool_name: 'Edit',
		tool_input: { file_path: join(dir, 'package.json'), old_string: '"next": "15"', new_string: '"next": "15",\n    "resend": "^6"' },
	});
	assert.equal(r.code, 0);
	const out = JSON.parse(r.stdout);
	assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
	assert.match(out.hookSpecificOutput.additionalContext, /Resend \(email\) was added/);
	assert.match(out.hookSpecificOutput.additionalContext, /Do not quote prices or limits from memory/);
	assert.match(out.hookSpecificOutput.additionalContext, /suggest running \/manifestack/);
	assert.match(out.hookSpecificOutput.additionalContext, /send caps/);
});

test('nothing new: empty output', (t) => {
	const dir = project(t, { next: '15', resend: '^6' });
	const r = run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'package.json'), old_string: '"next": "14"', new_string: '"next": "15"' } });
	assert.equal(r.code, 0);
	assert.equal(r.stdout, '');
});

test('vendor already in STACK.md: empty output', (t) => {
	const dir = project(t, { resend: '^6' }, '## Email: Resend\nplan: Free\n');
	const r = run({ cwd: dir, tool_name: 'Write', tool_input: { file_path: join(dir, 'package.json'), content: '' } });
	assert.equal(r.stdout, '');
});

test('Write compares with the committed version when there is one', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), pkg({ '@supabase/supabase-js': '2' }));
	const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
	git('init', '-q');
	git('-c', 'user.email=t@example.test', '-c', 'user.name=t', 'add', '.');
	git('-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '-qm', 'init');
	writeFileSync(join(dir, 'package.json'), pkg({ '@supabase/supabase-js': '2', 'mailgun.js': '10' }));
	const r = run({ cwd: dir, tool_name: 'Write', tool_input: { file_path: 'package.json', content: '' } });
	const msg = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
	assert.match(msg, /Mailgun \(email\) was added/);
	assert.ok(!/Supabase/.test(msg), 'Supabase was already committed');
	assert.match(msg, /no page map for Mailgun/);
});

function gitRepo(t, files) {
	const dir = tempDir(t);
	const git = (...a) => execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', ...a], { cwd: dir, stdio: 'ignore' });
	git('init', '-q');
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git('add', '.');
	git('commit', '-qm', 'init');
	return dir;
}

test('Write compares with the committed version of a manifest in a subdirectory', (t) => {
	const dir = gitRepo(t, { 'apps/web/package.json': pkg({ '@supabase/supabase-js': '2' }) });
	writeFileSync(join(dir, 'apps/web/package.json'), pkg({ '@supabase/supabase-js': '2', resend: '4' }));
	const r = run({ cwd: dir, tool_name: 'Write', tool_input: { file_path: 'apps/web/package.json', content: '' } });
	const msg = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
	assert.match(msg, /Resend \(email\) was added/);
	assert.ok(!/Supabase/.test(msg), 'Supabase was already committed');
});

test('Write of a manifest that is not committed yet reports every vendor in it', (t) => {
	const dir = gitRepo(t, { 'README.md': 'app\n' });
	writeFileSync(join(dir, 'package.json'), pkg({ '@supabase/supabase-js': '2' }));
	const r = run({ cwd: dir, tool_name: 'Write', tool_input: { file_path: 'package.json', content: '' } });
	assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Supabase/);
});

test('Write stays quiet when git is too slow to tell what was committed', (t) => {
	const dir = gitRepo(t, { 'package.json': pkg({ '@supabase/supabase-js': '2' }) });
	writeFileSync(join(dir, 'package.json'), pkg({ '@supabase/supabase-js': '2', resend: '4' }));
	const event = readHookEvent({ cwd: dir, tool_name: 'Write', tool_input: { file_path: 'package.json', content: '' } });
	const signatures = vendorSignatures(loadCatalog(join(ROOT, 'catalog/vendors')));
	assert.match(newVendorMessage(event, { signatures }), /Resend \(email\) was added/);
	// No git process starts within 1 ms, so this is the timeout path on every platform.
	assert.equal(newVendorMessage(event, { signatures, gitTimeout: 1 }), null);
});

test('Cursor afterFileEdit payload', (t) => {
	const dir = project(t, { '@clerk/nextjs': '6' }, '## Requirements\nbudget: $50\n');
	const r = run({ hook_event_name: 'afterFileEdit', file_path: join(dir, 'package.json'), edits: [{ old_string: '"dependencies": {}', new_string: '"dependencies": {\n    "@clerk/nextjs": "6"\n  }' }], workspace_roots: [dir] });
	const out = JSON.parse(r.stdout);
	assert.match(out.additional_context, /Clerk \(auth\) was added/);
	assert.match(out.additional_context, /requires/);
	assert.match(out.additional_context, /"avoid" line/);
	assert.match(out.additional_context, /\(\.manifestack\/STACK\.md\)/);
	assert.ok(!/suggest running \/manifestack/.test(out.additional_context));
});

test('other files, other tools and bad input are ignored silently', (t) => {
	const dir = project(t, { resend: '^6' });
	writeFileSync(join(dir, 'styles.css'), 'a{}');
	assert.equal(run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'styles.css'), old_string: 'a', new_string: 'b' } }).stdout, '');
	assert.equal(run({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm i resend' } }).stdout, '');
	const bad = runNode(HOOK, [], { input: 'not json' });
	assert.equal(bad.code, 0);
	assert.equal(bad.stdout, '');
	assert.equal(runNode(HOOK, [], { input: '' }).code, 0);
});

test('hook is fast', (t) => {
	const dir = project(t, { resend: '^6' });
	const input = { cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'package.json'), old_string: 'x', new_string: 'y' } };
	run(input); // warm the file cache
	const start = process.hrtime.bigint();
	run(input);
	const ms = Number(process.hrtime.bigint() - start) / 1e6;
	assert.ok(ms < 500, `took ${ms} ms including node startup`);
});

test('plugin hooks.json runs the hook through CLAUDE_PLUGIN_ROOT', async () => {
	const { readFileSync } = await import('node:fs');
	const cfg = JSON.parse(readFileSync(join(ROOT, 'hooks/hooks.json'), 'utf8'));
	const group = cfg.hooks.PostToolUse[0];
	assert.equal(group.matcher, 'Write|Edit');
	assert.equal(group.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/new-vendor.mjs"');
});

test('requirements.txt edit that adds an SDK returns context', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.git'));
	writeFileSync(join(dir, 'requirements.txt'), 'fastapi==0.115\nmistralai==1.2\n');
	const r = run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'requirements.txt'), old_string: 'fastapi==0.115', new_string: 'fastapi==0.115\nmistralai==1.2' } });
	assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Mistral \(ai\) was added in requirements\.txt/);
});

test('go.mod edit that adds nothing new: empty output', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.git'));
	writeFileSync(join(dir, 'go.mod'), 'module x\n\nrequire github.com/aws/aws-sdk-go-v2 v1.31.0\n');
	const r = run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'go.mod'), old_string: 'v1.30.0', new_string: 'v1.31.0' } });
	assert.equal(r.stdout, '');
});
