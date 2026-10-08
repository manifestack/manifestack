import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, runNode, tempDir } from './helpers.mjs';
import { readHookEvent, newVendorMessage, parsePackageCommands, shellCommands } from '../packages/core/src/hook.mjs';
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

// The postToolUse input documented at https://cursor.com/docs/agent/hooks: tool_name, tool_input, tool_output, cwd.
const cursor = (dir, tool_name, tool_input) => ({ hook_event_name: 'postToolUse', cursor_version: '2.0', workspace_roots: [dir], cwd: dir, tool_name, tool_input, tool_output: '{}' });

test('Cursor postToolUse Write payload with edits', (t) => {
	const dir = project(t, { '@clerk/nextjs': '6' }, '## Requirements\nbudget: $50\n');
	const r = run(cursor(dir, 'Write', { file_path: join(dir, 'package.json'), edits: [{ old_string: '"dependencies": {}', new_string: '"dependencies": {\n    "@clerk/nextjs": "6"\n  }' }] }));
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
	assert.equal(run({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm test && ls' } }).stdout, '');
	assert.equal(run({ cwd: dir, tool_name: 'Read', tool_input: { file_path: join(dir, 'package.json') } }).stdout, '');
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
	assert.equal(group.matcher, 'Write|Edit|MultiEdit|Bash');
	assert.match(cfg.description, /requirements.*go\.mod.*npm.*pip.*go get/);
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

test('Cursor postToolUse Write without edits compares with the committed version', (t) => {
	const dir = gitRepo(t, { 'package.json': pkg({ '@supabase/supabase-js': '2' }) });
	writeFileSync(join(dir, 'package.json'), pkg({ '@supabase/supabase-js': '2', resend: '4' }));
	const out = JSON.parse(run(cursor(dir, 'Write', { file_path: 'package.json', content: '' })).stdout);
	assert.match(out.additional_context, /^Manifestack: Resend \(email\) was added in package\.json/);
});

test('Cursor postToolUse Shell payload', (t) => {
	const dir = project(t, {});
	const out = JSON.parse(run(cursor(dir, 'Shell', { command: 'npm install stripe', working_directory: dir })).stdout);
	assert.match(out.additional_context, /Stripe \(payments\) was added with npm install/);
	assert.equal(run(cursor(dir, 'Shell', { command: 'npm test' })).stdout, '');
});

test('removing a dependency reports nothing', (t) => {
	// The edit removed stripe: an empty new_string cannot tell where the line was.
	const dir = project(t, { openai: '^4', react: '^18' });
	const input = { cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'package.json'), old_string: '    "stripe": "^14.0.0",\n', new_string: '' } };
	assert.equal(run(input).stdout, '');
	const originalFile = pkg({ stripe: '^14.0.0', openai: '^4', react: '^18' });
	assert.equal(run({ ...input, tool_response: { filePath: join(dir, 'package.json'), originalFile } }).stdout, '');
});

test('Claude Code tool_response.originalFile is the version before the edit', (t) => {
	const dir = project(t, { next: '15', resend: '^6' });
	const r = run({
		cwd: dir,
		tool_name: 'Edit',
		tool_input: { file_path: join(dir, 'package.json'), old_string: 'not in the file', new_string: 'neither' },
		tool_response: { originalFile: pkg({ next: '15' }) },
	});
	assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Resend \(email\) was added/);
	// A Write that created the file has originalFile: null; the committed version (none) is the baseline.
	const created = run({ cwd: dir, tool_name: 'Write', tool_input: { file_path: join(dir, 'package.json'), content: '' }, tool_response: { type: 'create', originalFile: null } });
	assert.match(JSON.parse(created.stdout).hookSpecificOutput.additionalContext, /Resend/);
});

test('edits that cannot be undone exactly stay quiet', (t) => {
	const dir = project(t, { openai: '^4', react: '^18' });
	const file = join(dir, 'package.json');
	const edit = (old_string, new_string) => run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: file, old_string, new_string } }).stdout;
	assert.equal(edit('x', '"stripe": "1"'), '', 'new_string not in the file');
	assert.equal(edit('"openai": "^3"', '^'), '', 'new_string in the file twice');
	assert.equal(edit('garbage', '"react": "^18"'), '', 'undone text is not JSON');
	writeFileSync(file, pkg({ openai: '^4' }).replace(/\n/g, '\r\n'));
	assert.equal(edit('"dependencies": {}', '"dependencies": {\n    "openai": "^4"\n  }'), '', 'LF edit in a CRLF file');
	const multi = run({ cwd: dir, tool_name: 'MultiEdit', tool_input: { file_path: file, edits: [{ old_string: 'a', new_string: '' }] } });
	assert.equal(multi.stdout, '');
});

test('MultiEdit edits are undone in reverse order', (t) => {
	const dir = project(t, { next: '15', resend: '^6', stripe: '14' });
	const r = run({
		cwd: dir,
		tool_name: 'MultiEdit',
		tool_input: {
			file_path: join(dir, 'package.json'),
			edits: [
				{ old_string: '"next": "15"', new_string: '"next": "15",\n    "resend": "^6"' },
				{ old_string: '"resend": "^6"', new_string: '"resend": "^6",\n    "stripe": "14"' },
			],
		},
	});
	assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Resend \(email\), Stripe \(payments\) was added/);
});

test('package-manager commands: names from the command, not yet in STACK.md', (t) => {
	const dir = project(t, {}, '## Payments: Stripe\nplan: Standard\n');
	const bash = (command) => run({ cwd: dir, tool_name: 'Bash', tool_input: { command } }).stdout;
	assert.equal(bash('npm install stripe@14'), '', 'Stripe is in STACK.md');
	const msg = JSON.parse(bash('npm ci && npm i -D stripe @stripe/stripe-js resend@^6')).hookSpecificOutput.additionalContext;
	assert.match(msg, /^Manifestack: Resend \(email\) was added with npm i\. /);
	assert.match(msg, /\(\.manifestack\/STACK\.md\)/);
	assert.match(JSON.parse(bash('pip install "openai>=1"')).hookSpecificOutput.additionalContext, /OpenAI \(ai\) was added with pip install/);
	assert.match(JSON.parse(bash('go get github.com/resend/resend-go/v2@v2.13.0')).hookSpecificOutput.additionalContext, /Resend \(email\) was added with go get/);
	assert.equal(bash('npm install'), '');
	assert.equal(bash('npm i -g vercel resend'), '', 'a global install is not a project dependency');
	assert.equal(bash('ls -la'), '');
});

test('parsePackageCommands reads the common package managers', () => {
	const names = (command) => parsePackageCommands(command).map((c) => `${c.kind}:${c.names.join(',')}`);
	assert.deepEqual(names('npm i -D -E stripe@14 @scope/pkg@^1 ./local user/repo file:../x https://x/y.tgz'), ['npm:stripe,@scope/pkg']);
	assert.deepEqual(names('cd web && pnpm --filter web add openai; yarn workspace web add resend || bun add -d svix'), ['npm:openai', 'npm:resend', 'npm:svix']);
	assert.deepEqual(names('npm --prefix web install --save-dev resend 2>&1 | tail'), ['npm:resend']);
	assert.deepEqual(names('pip install -r requirements.txt -e . stripe==1.2 "openai>=1" anthropic[bedrock] https://x/y.whl'), ['pypi:stripe,openai,anthropic']);
	assert.deepEqual(names('python3 -m pip install -U mistralai && pip3 install --user cohere'), ['pypi:mistralai', 'pypi:cohere']);
	assert.deepEqual(names('uv pip install twilio; uv add --group dev stripe; poetry add -G dev resend@^2; pipenv install sentry-sdk'), ['pypi:twilio', 'pypi:stripe', 'pypi:resend', 'pypi:sentry-sdk']);
	assert.deepEqual(names('go get -u github.com/stripe/stripe-go/v76@v76.0.0 ./...'), ['go:github.com/stripe/stripe-go/v76']);
	assert.deepEqual(names('sudo NODE_ENV=dev npm add resend'), ['npm:resend']);
	for (const quiet of ['npm install', 'npm test', 'npm run add', 'yarn', 'pip install -r requirements.txt', 'go get ./...', 'npm i -g vercel', 'echo npm i stripe']) {
		assert.deepEqual(parsePackageCommands(quiet), [], quiet);
	}
	assert.equal(parsePackageCommands('npm install stripe')[0].verb, 'npm install');
	assert.equal(parsePackageCommands('uv pip install stripe')[0].verb, 'uv pip install');
	assert.deepEqual(names('deno add npm:stripe@14 jsr:@std/path'), ['npm:stripe,@std/path']);
});

test('a chain of package managers names every command in the message', (t) => {
	const dir = project(t, {});
	const r = run({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm install -D stripe@14 && pnpm add @sentry/nextjs' } });
	assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /was added with npm install, pnpm add\./);
});

test('deno.jsonc with comments and package.json with a BOM: the edit is still read', (t) => {
	const dir = project(t, {});
	const deno = '{\n  // Deno config\n  "imports": {\n    "react": "npm:react@19"\n  }\n}\n';
	const denoAfter = deno.replace('"npm:react@19"', '"npm:react@19",\n    "stripe": "npm:stripe@14"');
	writeFileSync(join(dir, 'deno.jsonc'), denoAfter);
	const d = run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: 'deno.jsonc', old_string: '"npm:react@19"', new_string: '"npm:react@19",\n    "stripe": "npm:stripe@14"' } });
	assert.match(JSON.parse(d.stdout).hookSpecificOutput.additionalContext, /Stripe \(payments\) was added in deno\.jsonc/);
	writeFileSync(join(dir, 'package.json'), '\uFEFF' + pkg({ next: '15', resend: '^6' }));
	const p = run({ cwd: dir, tool_name: 'Edit', tool_input: { file_path: 'package.json', old_string: '"next": "15"', new_string: '"next": "15",\n    "resend": "^6"' } });
	assert.match(JSON.parse(p.stdout).hookSpecificOutput.additionalContext, /Resend \(email\) was added/);
});

test('STACK.md at the repository root is found from a subfolder', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.git'));
	mkdirSync(join(dir, '.manifestack'));
	writeFileSync(join(dir, '.manifestack/STACK.md'), '## Payments: Stripe\nplan: Standard\n');
	mkdirSync(join(dir, 'apps/web'), { recursive: true });
	writeFileSync(join(dir, 'apps/web/package.json'), pkg({ next: '15', stripe: '14', resend: '6' }));
	const cwd = join(dir, 'apps/web');
	const r = run({ cwd, tool_name: 'Edit', tool_input: { file_path: 'package.json', old_string: '"next": "15"', new_string: '"next": "15",\n    "stripe": "14",\n    "resend": "6"' } });
	const msg = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
	assert.match(msg, /^Manifestack: Resend \(email\) was added/);
	assert.match(msg, /STACK\.md \(\.\.\/\.\.\/\.manifestack\/STACK\.md\)/);
	assert.equal(run({ cwd, tool_name: 'Bash', tool_input: { command: 'npm i stripe' } }).stdout, '');
});

test('STACK.md vendor names match by prefix, from 3 characters', (t) => {
	for (const heading of ['Stripe Billing', 'stripe.com', 'Stripe (Billing)', 'stripe']) {
		const dir = project(t, {}, `## Payments: ${heading}\n`);
		assert.equal(run({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm i stripe' } }).stdout, '', heading);
	}
	const dir = project(t, {}, '## Payments: St\n');
	assert.match(run({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm i stripe' } }).stdout, /Stripe/, 'two letters are not a match');
});

test('shellCommands keeps quoted text, heredoc bodies and redirections out of the commands', () => {
	assert.deepEqual(shellCommands(`git commit -m "deps; npm install resend" && echo 'a | b'`), [['git', 'commit', '-m', 'deps; npm install resend'], ['echo', 'a | b']]);
	assert.deepEqual(shellCommands("cat > README.md <<'EOF'\nnpm install @sentry/nextjs\nEOF\nnpm i stripe"), [['cat'], ['npm', 'i', 'stripe']]);
	assert.deepEqual(shellCommands('cat <<-END\n\tpip install openai\n\tEND\nls'), [['cat'], ['ls']]);
	assert.deepEqual(shellCommands('npm install stripe>/dev/null 2>&1 | tail -5 & wait'), [['npm', 'install', 'stripe'], ['tail', '-5'], ['wait']]);
	assert.deepEqual(shellCommands('npm i \\\n  resend # the email SDK'), [['npm', 'i', 'resend']]);
});

test('parsePackageCommands: quotes, heredocs, prefixes, Windows names, aliases and dry runs', () => {
	const names = (command) => parsePackageCommands(command).map((c) => `${c.kind}:${c.names.join(',')}`);
	for (const quiet of [
		'git commit -m "deps; npm install resend"',
		"cat > NOTES.md <<'EOF'\nnpm install @sentry/nextjs\nEOF",
		'npm install --dry-run stripe',
		'pip install --dry-run openai',
		'npm install --location=global vercel',
		'npm install --location global vercel',
	]) {
		assert.deepEqual(parsePackageCommands(quiet), [], quiet);
	}
	assert.deepEqual(names('sudo -E npm i stripe'), ['npm:stripe']);
	assert.deepEqual(names('corepack pnpm add resend'), ['npm:resend']);
	assert.deepEqual(names('npm.cmd install stripe'), ['npm:stripe']);
	assert.deepEqual(names('C:\\tools\\nodejs\\npm.cmd i openai'), ['npm:openai']);
	assert.deepEqual(names('py -3.12 -m pip install anthropic'), ['pypi:anthropic']);
	assert.deepEqual(names('npm i pay@npm:stripe@14'), ['npm:stripe']);
	assert.deepEqual(names('npm install stripe>/dev/null && npm install resend&'), ['npm:stripe', 'npm:resend']);
});

test('installing a package the project already has is an upgrade, not a new vendor', (t) => {
	const dir = gitRepo(t, { 'package.json': pkg({ stripe: '14' }), 'api/requirements.txt': 'openai==1.0\n' });
	const bash = (command, cwd = dir) => run({ cwd, tool_name: 'Bash', tool_input: { command } }).stdout;
	// npm has already written the new version to package.json; the committed one says what was there.
	writeFileSync(join(dir, 'package.json'), pkg({ stripe: '15' }));
	assert.equal(bash('npm install stripe@latest'), '');
	const msg = JSON.parse(bash('npm install stripe resend')).hookSpecificOutput.additionalContext;
	assert.match(msg, /Resend \(email\) was added/);
	assert.doesNotMatch(msg, /Stripe/);
	assert.equal(bash('pip install -U openai', join(dir, 'api')), '', 'nearest manifest, from a subfolder');
});

test('git missing or refusing the repository: a Write stays quiet instead of reporting every vendor', (t) => {
	const dir = gitRepo(t, { 'package.json': pkg({ stripe: '14', '@sentry/nextjs': '8' }) });
	writeFileSync(join(dir, 'package.json'), pkg({ stripe: '14', '@sentry/nextjs': '8', lodash: '4' }));
	const event = readHookEvent({ cwd: dir, tool_name: 'Write', tool_input: { file_path: 'package.json', content: '' } });
	const signatures = vendorSignatures(loadCatalog(join(ROOT, 'catalog/vendors')));
	assert.equal(newVendorMessage(event, { signatures }), null, 'with git: nothing new');
	const path = process.env.PATH;
	t.after(() => (process.env.PATH = path));
	process.env.PATH = tempDir(t);
	assert.equal(newVendorMessage(event, { signatures }), null, 'no git on PATH');
	if (process.platform !== 'win32') {
		const bin = tempDir(t);
		writeFileSync(join(bin, 'git'), "#!/bin/sh\necho \"fatal: detected dubious ownership in repository at '$PWD'\" >&2\nexit 128\n", { mode: 0o755 });
		process.env.PATH = bin;
		assert.equal(newVendorMessage(event, { signatures }), null, 'git refuses the repository');
	}
});

test('each vendor is announced once per session', (t) => {
	const cache = tempDir(t);
	const before = process.env.MANIFESTACK_CACHE_DIR;
	t.after(() => (before === undefined ? delete process.env.MANIFESTACK_CACHE_DIR : (process.env.MANIFESTACK_CACHE_DIR = before)));
	process.env.MANIFESTACK_CACHE_DIR = cache;
	const dir = project(t, {});
	const bash = (command, session_id) => run({ session_id, cwd: dir, tool_name: 'Bash', tool_input: { command } }).stdout;
	assert.match(bash('npm i resend', 's1'), /Resend/);
	assert.equal(bash('npm i resend', 's1'), '', 'retried install');
	const both = JSON.parse(bash('npm i resend stripe', 's1')).hookSpecificOutput.additionalContext;
	assert.match(both, /^Manifestack: Stripe \(payments\) was added/, 'only the vendor not announced yet');
	assert.match(bash('npm i resend', 's2'), /Resend/, 'a new session hears it again');
	assert.match(bash('npm i resend'), /Resend/, 'without a session id nothing is remembered');
});

test('the plugin copy stays quiet when the project registers its own hook', (t) => {
	const dir = project(t, {});
	const bash = () => run({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm i resend' } }).stdout;
	mkdirSync(join(dir, '.claude/hooks'), { recursive: true });
	writeFileSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs'), '');
	assert.match(bash(), /Resend/, 'a script alone, not registered: the plugin still reports');
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/manifestack-new-vendor.mjs"' }] }] } }));
	assert.equal(bash(), '', 'the project hook reports instead');
});
