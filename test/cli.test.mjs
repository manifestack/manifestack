import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, symlinkSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, runNode, tempDir } from './helpers.mjs';
import { AGENTS } from '../packages/cli/src/agents.js';
import { hookStatus } from '../packages/core/src/detect.mjs';

const CLI = join(ROOT, 'packages/cli/src/manifestack.js');
const SKILLS = readdirSync(join(ROOT, 'skills')).sort();
const cli = (dir, ...args) => runNode(CLI, [...args, '--dir', dir, '--yes']);
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

for (const agent of AGENTS) {
	test(`install, reinstall and uninstall for ${agent.id}`, (t) => {
		const dir = tempDir(t);
		mkdirSync(join(dir, '.manifestack'));
		writeFileSync(join(dir, '.manifestack/STACK.md'), '## Requirements\nbudget: $0\n');
		const first = cli(dir, 'install', '--agent', agent.id);
		assert.equal(first.code, 0, first.stderr);
		for (const s of SKILLS) {
			assert.ok(existsSync(join(dir, agent.skillsDir, s, 'SKILL.md')), `${s} installed`);
			assert.ok(existsSync(join(dir, agent.skillsDir, s, '.manifestack.json')));
		}
		assert.ok(existsSync(join(dir, agent.skillsDir, 'manifestack/scripts/detect.mjs')));
		const snapshot = () => (agent.hook ? readFileSync(join(dir, agent.hook === 'cursor' ? '.cursor/hooks.json' : '.claude/settings.json'), 'utf8') : '');
		const afterFirst = snapshot();
		const second = cli(dir, 'install', '--agent', agent.id);
		assert.equal(second.code, 0, second.stderr);
		assert.equal(snapshot(), afterFirst, 'reinstall does not duplicate the hook');
		const removed = cli(dir, 'uninstall', '--agent', agent.id);
		assert.equal(removed.code, 0, removed.stderr);
		for (const s of SKILLS) assert.ok(!existsSync(join(dir, agent.skillsDir, s)), `${s} removed`);
		assert.ok(!existsSync(join(dir, agent.skillsDir)), 'the emptied skills folder is removed');
		if (agent.hook) assert.ok(!existsSync(join(dir, agent.hook === 'cursor' ? '.cursor/hooks' : '.claude/hooks')), 'the emptied hooks folder is removed');
		assert.equal(readFileSync(join(dir, '.manifestack/STACK.md'), 'utf8'), '## Requirements\nbudget: $0\n', 'STACK.md untouched');
	});
}

test('claude-code: hook merged into existing settings.json without touching other settings', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.claude'));
	const theirs = {
		permissions: { allow: ['Bash(npm test)'] },
		hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier --write' }] }], Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] },
	};
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify(theirs, null, 2));
	assert.equal(cli(dir, 'install', '--agent', 'claude-code').code, 0);
	const merged = json(join(dir, '.claude/settings.json'));
	assert.deepEqual(merged.permissions, theirs.permissions);
	assert.deepEqual(merged.hooks.Stop, theirs.hooks.Stop);
	assert.equal(merged.hooks.PostToolUse.length, 2);
	assert.deepEqual(merged.hooks.PostToolUse[0], theirs.hooks.PostToolUse[0]);
	assert.equal(merged.hooks.PostToolUse[1].matcher, 'Write|Edit|MultiEdit|Bash');
	assert.match(merged.hooks.PostToolUse[1].hooks[0].command, /\.claude\/hooks\/manifestack-new-vendor\.mjs/);
	assert.ok(existsSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs')));
	assert.equal(cli(dir, 'uninstall', '--agent', 'claude-code').code, 0);
	assert.deepEqual(json(join(dir, '.claude/settings.json')), theirs, 'uninstall restores their settings exactly');
	assert.ok(!existsSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs')));
});

test('claude-code: a settings.json created by install is removed by uninstall', (t) => {
	const dir = tempDir(t);
	cli(dir, 'install', '--agent', 'claude-code');
	cli(dir, 'uninstall', '--agent', 'claude-code');
	assert.ok(!existsSync(join(dir, '.claude/settings.json')));
});

test('cursor: hooks.json merge keeps other hooks', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.cursor'));
	const theirs = { version: 1, hooks: { beforeShellExecution: [{ command: './audit.sh' }], afterFileEdit: [{ command: './fmt.sh' }] } };
	writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify(theirs));
	assert.equal(cli(dir, 'install', '--agent', 'cursor').code, 0);
	const merged = json(join(dir, '.cursor/hooks.json'));
	assert.deepEqual(merged.hooks.afterFileEdit, theirs.hooks.afterFileEdit);
	assert.deepEqual(merged.hooks.postToolUse, [{ command: 'node .cursor/hooks/manifestack-new-vendor.mjs', matcher: 'Write|Shell', timeout: 10 }]);
	assert.deepEqual(merged.hooks.beforeShellExecution, theirs.hooks.beforeShellExecution);
	cli(dir, 'uninstall', '--agent', 'cursor');
	assert.deepEqual(json(join(dir, '.cursor/hooks.json')), theirs);
});

test('invalid JSON config is reported and left alone', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.claude'));
	writeFileSync(join(dir, '.claude/settings.json'), '{ broken');
	const r = cli(dir, 'install', '--agent', 'claude-code');
	assert.notEqual(r.code, 0);
	assert.match(r.stderr, /not valid JSON/);
	assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), '{ broken');
	assert.ok(!existsSync(join(dir, '.claude/skills')), 'nothing installed when the plan fails');
});

test('a foreign skill folder with the same name is not overwritten without --force', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.agents/skills/manifestack'), { recursive: true });
	writeFileSync(join(dir, '.agents/skills/manifestack/SKILL.md'), 'theirs');
	const r = cli(dir, 'install', '--agent', 'codex');
	assert.equal(r.code, 0);
	assert.match(r.stdout, /skipped/);
	assert.equal(readFileSync(join(dir, '.agents/skills/manifestack/SKILL.md'), 'utf8'), 'theirs');
	assert.ok(existsSync(join(dir, '.agents/skills/manifestack-guard/SKILL.md')));
	cli(dir, 'uninstall', '--agent', 'codex');
	assert.equal(readFileSync(join(dir, '.agents/skills/manifestack/SKILL.md'), 'utf8'), 'theirs', 'uninstall leaves foreign folders');
	assert.equal(cli(dir, 'install', '--agent', 'codex', '--force').code, 0);
	assert.notEqual(readFileSync(join(dir, '.agents/skills/manifestack/SKILL.md'), 'utf8'), 'theirs');
});

test('--skill installs only the chosen skill; unknown names fail', (t) => {
	const dir = tempDir(t);
	assert.equal(cli(dir, 'install', '--agent', 'codex', '--skill', 'manifestack').code, 0);
	assert.ok(existsSync(join(dir, '.agents/skills/manifestack')));
	assert.ok(!existsSync(join(dir, '.agents/skills/manifestack-guard')));
	const bad = cli(dir, 'install', '--agent', 'codex', '--skill', 'nope');
	assert.notEqual(bad.code, 0);
	assert.match(bad.stderr, /unknown skill nope/);
});

test('without --agent: detected agents, or a clear error', (t) => {
	const dir = tempDir(t);
	const none = cli(dir, 'install');
	assert.notEqual(none.code, 0);
	assert.match(none.stderr, /no agent folders found/);
	mkdirSync(join(dir, '.cursor'));
	writeFileSync(join(dir, 'AGENTS.md'), '# agents');
	const r = cli(dir, 'install');
	assert.equal(r.code, 0, r.stderr);
	assert.match(r.stdout, /Detected: Cursor, Codex/);
	assert.ok(existsSync(join(dir, '.agents/skills/manifestack/SKILL.md')));
	assert.ok(existsSync(join(dir, '.cursor/hooks.json')));
	assert.equal(cli(dir, 'uninstall').code, 0);
	assert.ok(!existsSync(join(dir, '.agents/skills/manifestack')));
	assert.ok(!existsSync(join(dir, '.cursor/hooks.json')));
});

test('--dry-run changes nothing; unknown agent and command fail', (t) => {
	const dir = tempDir(t);
	const r = cli(dir, 'install', '--agent', 'claude-code', '--dry-run');
	assert.equal(r.code, 0);
	assert.match(r.stdout, /\.claude\/settings\.json: create with PostToolUse/);
	assert.deepEqual(readdirSync(dir), []);
	assert.match(cli(dir, 'install', '--agent', 'vim').stderr, /unknown agent vim/);
	assert.match(cli(dir, 'frobnicate').stderr, /unknown command/);
	assert.match(runNode(CLI, ['--help']).stdout, /npx manifestack hook/);
	assert.equal(runNode(CLI, ['--version']).stdout.trim(), json(join(ROOT, 'packages/cli/package.json')).version);
});

test('the installed hook works from the project', (t) => {
	const dir = tempDir(t);
	cli(dir, 'install', '--agent', 'claude-code');
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { resend: '6' } }));
	const r = runNode(join(dir, '.claude/hooks/manifestack-new-vendor.mjs'), [], { input: JSON.stringify({ cwd: dir, tool_name: 'Write', tool_input: { file_path: join(dir, 'package.json') } }) });
	assert.match(r.stdout, /Resend \(email\) was added/);
});

test('a bare `npx manifestack` installs, like `install`', (t) => {
	const dir = tempDir(t);
	const r = cli(dir, '--agent', 'codex');
	assert.equal(r.code, 0, r.stderr);
	assert.ok(existsSync(join(dir, '.agents/skills/manifestack/SKILL.md')));
});

test('the same skill installed by another tool is kept, and the hook is still added', (t) => {
	const dir = tempDir(t);
	// What `npx skills add` leaves: a canonical copy in .agents/skills and a symlink from .claude/skills.
	mkdirSync(join(dir, '.agents/skills/manifestack'), { recursive: true });
	const theirs = '---\nname: manifestack\ndescription: x\n---\nfrom skills CLI\n';
	writeFileSync(join(dir, '.agents/skills/manifestack/SKILL.md'), theirs);
	mkdirSync(join(dir, '.claude/skills'), { recursive: true });
	symlinkSync(join(dir, '.agents/skills/manifestack'), join(dir, '.claude/skills/manifestack'), 'dir');
	const r = cli(dir, 'install', '--agent', 'claude-code');
	assert.equal(r.code, 0, r.stderr);
	assert.match(r.stdout, /installed by another tool, kept/);
	assert.doesNotMatch(r.stdout, /skipped/);
	assert.equal(readFileSync(join(dir, '.claude/skills/manifestack/SKILL.md'), 'utf8'), theirs);
	assert.ok(existsSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs')));
});

test('hook: registers only the hook, for Claude Code and Cursor only', (t) => {
	const dir = tempDir(t);
	const r = cli(dir, 'hook', '--agent', 'claude-code,cursor');
	assert.equal(r.code, 0, r.stderr);
	assert.ok(existsSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs')));
	assert.ok(existsSync(join(dir, '.cursor/hooks/manifestack-new-vendor.mjs')));
	assert.match(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), /manifestack-new-vendor/);
	assert.ok(!existsSync(join(dir, '.claude/skills')), 'no skills copied');
	assert.ok(!existsSync(join(dir, '.agents')), 'no skills copied');
	const again = readFileSync(join(dir, '.cursor/hooks.json'), 'utf8');
	assert.equal(cli(dir, 'hook', '--agent', 'cursor').code, 0);
	assert.equal(readFileSync(join(dir, '.cursor/hooks.json'), 'utf8'), again, 'running twice does not duplicate the hook');
	const codex = cli(dir, 'hook', '--agent', 'codex');
	assert.notEqual(codex.code, 0);
	assert.match(codex.stderr, /codex has no hook support/);
	const none = cli(tempDir(t), 'hook');
	assert.notEqual(none.code, 0);
	assert.match(none.stderr, /no agent folders found.*claude-code, cursor\)/);
	assert.equal(cli(dir, 'uninstall').code, 0);
	assert.ok(!existsSync(join(dir, '.claude/settings.json')), 'uninstall removes a hook added by `hook`');
});

const OURS = (prefix) => `node ${prefix}/hooks/manifestack-new-vendor.mjs`;

test('cursor: install moves an earlier afterFileEdit entry to postToolUse; uninstall removes both', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.cursor'));
	const theirs = { version: 1, hooks: { afterFileEdit: [{ command: './fmt.sh' }], postToolUse: [{ command: './log.sh' }] } };
	const old = { version: 1, hooks: { afterFileEdit: [{ command: './fmt.sh' }, { command: OURS('.cursor') }], postToolUse: [{ command: './log.sh' }] } };
	writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify(old));
	const r = cli(dir, 'hook', '--agent', 'cursor');
	assert.equal(r.code, 0, r.stderr);
	const migrated = json(join(dir, '.cursor/hooks.json'));
	assert.deepEqual(migrated.hooks.afterFileEdit, theirs.hooks.afterFileEdit);
	assert.equal(migrated.hooks.postToolUse.length, 2);
	assert.equal(migrated.hooks.postToolUse[1].matcher, 'Write|Shell');
	// Both entries at once (a hand-made or half-migrated config): uninstall removes ours from each.
	writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify({ ...migrated, hooks: { ...migrated.hooks, afterFileEdit: old.hooks.afterFileEdit } }));
	assert.equal(cli(dir, 'uninstall', '--agent', 'cursor').code, 0);
	assert.deepEqual(json(join(dir, '.cursor/hooks.json')), theirs);
});

test('claude-code: install updates an earlier Write|Edit matcher', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.claude'));
	const theirs = { matcher: 'Write', hooks: [{ type: 'command', command: 'prettier --write' }] };
	const old = { matcher: 'Write|Edit', hooks: [{ type: 'command', command: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/manifestack-new-vendor.mjs"`, timeout: 10 }] };
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [old, theirs] } }));
	const r = cli(dir, 'hook', '--agent', 'claude-code');
	assert.equal(r.code, 0, r.stderr);
	const groups = json(join(dir, '.claude/settings.json')).hooks.PostToolUse;
	assert.deepEqual(groups.map((g) => g.matcher), ['Write', 'Write|Edit|MultiEdit|Bash']);
	assert.equal(cli(dir, 'hook', '--agent', 'claude-code').stdout.includes('hook already registered'), true);
});

test('config files in an unexpected shape are reported and left alone', (t) => {
	for (const [file, text, message] of [
		['.claude/settings.json', '{"hooks": []}', /hooks in \.claude\/settings\.json is not an object/],
		['.claude/settings.json', '{"hooks": {"PostToolUse": {}}}', /hooks\.PostToolUse in \.claude\/settings\.json is not a list/],
		['.claude/settings.json', '{"hooks": {"PostToolUse": [{"matcher": "Write", "hooks": {"type": "command"}}]}}', /hooks\.PostToolUse\[0\]\.hooks in \.claude\/settings\.json is not a list/],
		['.cursor/hooks.json', '{"version": 1, "hooks": {"postToolUse": {}}}', /hooks\.postToolUse in \.cursor\/hooks\.json is not a list/],
	]) {
		const dir = tempDir(t);
		mkdirSync(join(dir, file.split('/')[0]));
		writeFileSync(join(dir, file), text);
		const agent = file.startsWith('.cursor') ? 'cursor' : 'claude-code';
		for (const cmd of ['install', 'uninstall']) {
			const r = cli(dir, cmd, '--agent', agent);
			assert.equal(r.code, 1, `${cmd} ${text}`);
			assert.match(r.stderr, message);
			assert.match(r.stderr, /Fix it first/);
			assert.doesNotMatch(r.stderr, /\n\s+at /, 'no stack trace');
			assert.equal(readFileSync(join(dir, file), 'utf8'), text);
		}
	}
});

test('without a terminal and without --agent or --yes nothing is installed', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.cursor'));
	const r = runNode(CLI, ['install', '--dir', dir], { input: 'n\n' });
	assert.equal(r.code, 1);
	assert.match(r.stdout, /Detected: Cursor/);
	assert.match(r.stderr, /Pass --agent <id> \(cursor\) or --yes/);
	assert.deepEqual(readdirSync(dir), ['.cursor']);
	const hook = runNode(CLI, ['hook', '--dir', dir], { input: '' });
	assert.equal(hook.code, 1);
	assert.deepEqual(readdirSync(join(dir, '.cursor')), []);
	// --agent names the agents, so a script can still install.
	assert.equal(runNode(CLI, ['install', '--dir', dir, '--agent', 'codex'], { input: '' }).code, 0);
});

test('uninstall removes only our skill folders and leaves non-empty folders', (t) => {
	const dir = tempDir(t);
	assert.equal(cli(dir, 'install', '--agent', 'github-copilot').code, 0);
	// A renamed copy still carries our marker, but it is the user's now.
	cpSync(join(dir, '.github/skills/manifestack'), join(dir, '.github/skills/my-stack'), { recursive: true });
	assert.equal(cli(dir, 'uninstall', '--agent', 'github-copilot').code, 0);
	assert.ok(!existsSync(join(dir, '.github/skills/manifestack')));
	assert.ok(existsSync(join(dir, '.github/skills/my-stack/SKILL.md')), 'renamed copy kept');
	rmSync(join(dir, '.github/skills/my-stack'), { recursive: true });
	assert.equal(cli(dir, 'install', '--agent', 'github-copilot').code, 0);
	assert.equal(cli(dir, 'uninstall', '--agent', 'github-copilot').code, 0);
	assert.ok(!existsSync(join(dir, '.github/skills')), 'empty skills folder removed');
	assert.ok(existsSync(join(dir, '.github')), 'only the folder we wrote into is removed');
	const next = cli(dir, 'install');
	assert.match(next.stderr, /no agent folders found/, 'a leftover .github/skills would make this detect Copilot');
});

test('detect.mjs reports the hook the CLI installs as on, not outdated', (t) => {
	const dir = tempDir(t);
	assert.equal(cli(dir, 'install', '--agent', 'claude-code', '--agent', 'cursor').code, 0);
	assert.deepEqual(hookStatus(dir), { 'claude-code': 'on', cursor: 'on' });
});

test('claude-code: the hook command uses ${CLAUDE_PROJECT_DIR}; an older $CLAUDE_PROJECT_DIR entry is outdated and replaced', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.claude/hooks'), { recursive: true });
	writeFileSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs'), '');
	const old = { matcher: 'Write|Edit|MultiEdit|Bash', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/manifestack-new-vendor.mjs"', timeout: 10 }] };
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [old] } }));
	assert.equal(hookStatus(dir)['claude-code'], 'outdated', 'PowerShell does not expand $CLAUDE_PROJECT_DIR');
	const r = cli(dir, 'hook', '--agent', 'claude-code');
	assert.equal(r.code, 0, r.stderr);
	assert.doesNotMatch(r.stdout, /already registered/);
	const groups = json(join(dir, '.claude/settings.json')).hooks.PostToolUse;
	assert.equal(groups.length, 1);
	assert.equal(groups[0].hooks[0].command, 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/manifestack-new-vendor.mjs"');
	assert.equal(hookStatus(dir)['claude-code'], 'on');
	assert.match(cli(dir, 'hook', '--agent', 'claude-code').stdout, /hook already registered/);
});

test('uninstall without a terminal needs --yes or --agent', (t) => {
	const dir = tempDir(t);
	assert.equal(cli(dir, 'install', '--agent', 'cursor').code, 0);
	const r = runNode(CLI, ['uninstall', '--dir', dir], { input: '' });
	assert.equal(r.code, 1);
	assert.match(r.stderr, /no terminal to confirm the removal/);
	assert.ok(existsSync(join(dir, '.cursor/hooks.json')), 'nothing removed');
	assert.equal(runNode(CLI, ['uninstall', '--dir', dir, '--agent', 'cursor'], { input: '' }).code, 0);
	assert.ok(!existsSync(join(dir, '.cursor/hooks.json')));
});

test('an agent named twice is installed once', (t) => {
	const dir = tempDir(t);
	const r = cli(dir, 'install', '--agent', 'claude-code,claude-code');
	assert.equal(r.code, 0, r.stderr);
	assert.equal(r.stdout.match(/settings\.json: create/g).length, 1);
	assert.equal(json(join(dir, '.claude/settings.json')).hooks.PostToolUse.length, 1);
});

test('an empty --dir= and a folder where a config file belongs are clear errors', (t) => {
	const empty = runNode(CLI, ['install', '--dir=', '--agent', 'codex', '--yes']);
	assert.equal(empty.code, 1);
	assert.match(empty.stderr, /--dir needs a value/);
	const dir = tempDir(t);
	mkdirSync(join(dir, '.claude/settings.json'), { recursive: true });
	const r = cli(dir, 'hook', '--agent', 'claude-code');
	assert.equal(r.code, 1);
	assert.match(r.stderr, /settings\.json is a folder/);
	assert.doesNotMatch(r.stderr, /\n\s+at /, 'no stack trace');
});
