#!/usr/bin/env node
// npx manifestack [install] | hook | uninstall
// Copies the skills into the agent's project skills folder and, for Claude Code and Cursor,
// registers the "new vendor" hook. `hook` registers only the hook, for skills installed another way
// (npx skills add, a manual copy). No network, no dependencies.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, rmdirSync, cpSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { AGENTS, HOOKS, ConfigError, findAgent } from './agents.js';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version;
const MARKER = '.manifestack.json';

const HELP = `manifestack ${VERSION}: choose the stack that fits, know when it stops fitting

Usage:
  npx manifestack [install] [--agent <id>] [--skill <name>] [--dir <path>] [--yes] [--dry-run] [--force]
  npx manifestack hook [--agent claude-code|cursor] [--dir <path>] [--yes] [--dry-run]
  npx manifestack uninstall [--agent <id>] [--dir <path>] [--yes] [--dry-run]

Commands:
  install        Skills and, for Claude Code and Cursor, the new-vendor hook. The default command.
  hook           Only the new-vendor hook, for skills installed another way (npx skills add, a copy).
  uninstall      Skills and hook. .manifestack/ (STACK.md) is kept.

Options:
  --agent <id>   ${AGENTS.map((a) => a.id).join(', ')}
                 Repeat or comma-separate for several. Without it, agents are detected from project folders.
  --skill <name> Install only this skill (default: all skills in the package).
  --dir <path>   Project folder (default: current folder).
  --yes, -y      Do not ask for confirmation.
  --dry-run      Show what would change and stop.
  --force        Replace a skill folder that manifestack did not install.

The .manifestack/ folder with STACK.md is never touched. https://manifestack.com`;

class UserError extends Error {}

function parseCli(argv) {
	const opts = { _: [], agent: [], skill: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const [flag, inline] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, null];
		const value = () => {
			const v = inline ?? argv[++i];
			if (v == null || v === '' || v.startsWith('-')) throw new UserError(`${flag} needs a value`);
			return v;
		};
		if (flag === '--agent' || flag === '-a') opts.agent.push(...value().split(','));
		else if (flag === '--skill' || flag === '-s') opts.skill.push(...value().split(','));
		else if (flag === '--dir') opts.dir = value();
		else if (flag === '--yes' || flag === '-y') opts.yes = true;
		else if (flag === '--dry-run') opts.dryRun = true;
		else if (flag === '--force') opts.force = true;
		else if (flag === '--help' || flag === '-h') opts.help = true;
		else if (flag === '--version' || flag === '-v') opts.version = true;
		else if (a.startsWith('-')) throw new UserError(`unknown option ${a}`);
		else opts._.push(a);
	}
	opts.agent = opts.agent.map((s) => s.trim()).filter(Boolean);
	opts.skill = opts.skill.map((s) => s.trim()).filter(Boolean);
	return opts;
}

/** Where skills/ and hooks/ are: the repo root during development (so copies never go stale), else the package. */
function assetsRoot() {
	const repo = resolve(PKG_ROOT, '..', '..');
	const candidates = existsSync(join(repo, 'tools', 'sync.mjs')) ? [repo, PKG_ROOT] : [PKG_ROOT];
	for (const root of candidates) {
		if (existsSync(join(root, 'skills')) && existsSync(join(root, 'hooks', 'new-vendor.mjs'))) return root;
	}
	throw new Error('skills/ not found in the package; reinstall manifestack');
}

function availableSkills(root) {
	return readdirSync(join(root, 'skills'))
		.filter((name) => existsSync(join(root, 'skills', name, 'SKILL.md')))
		.sort();
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const ours = (skillDir) => existsSync(join(skillDir, MARKER));

function readJsonConfig(file) {
	if (!existsSync(file)) return {};
	if (isDir(file)) throw new UserError(`${file} is a folder, not a file. Remove or rename it first.`);
	const text = readFileSync(file, 'utf8');
	if (!text.trim()) return {};
	try {
		const data = JSON.parse(text);
		if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
		return data;
	} catch {
		throw new UserError(`${file} is not valid JSON. Fix it first; manifestack will not overwrite it.`);
	}
}

function detectAgents(project) {
	return AGENTS.filter((a) => a.markers.some((m) => existsSync(join(project, m))));
}

async function ask(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return (await rl.question(question)).trim();
	} finally {
		rl.close();
	}
}

/** `pool` limits the choice: `hook` offers only the agents that have a hook. */
async function chooseAgents(opts, project, { forUninstall = false, pool = AGENTS } = {}) {
	const ids = pool.map((a) => a.id).join(', ');
	opts.agent = [...new Set(opts.agent)];
	if (opts.agent.length) {
		const unknown = opts.agent.filter((id) => !findAgent(id));
		if (unknown.length) throw new UserError(`unknown agent ${unknown.join(', ')}. Known agents: ${AGENTS.map((a) => a.id).join(', ')}`);
		const outside = opts.agent.filter((id) => !pool.some((a) => a.id === id));
		if (outside.length) throw new UserError(`${outside.join(', ')} has no hook support. Hooks work in: ${ids}`);
		return opts.agent.map(findAgent);
	}
	if (forUninstall) return pool;
	const detected = detectAgents(project).filter((a) => pool.includes(a));
	if (!process.stdin.isTTY || opts.yes) {
		if (!detected.length) throw new UserError(`no agent folders found in ${project}. Pass --agent <id> (${ids}).`);
		console.log(`Detected: ${detected.map((a) => a.name).join(', ')}`);
		// Without a terminal nobody can confirm the detected agents, so a script has to name them.
		if (!opts.yes) throw new UserError(`no terminal to confirm the agents. Pass --agent <id> (${detected.map((a) => a.id).join(', ')}) or --yes to use the detected ones.`);
		return detected;
	}
	console.log(pool === AGENTS ? 'Install for which agents?' : 'Add the hook for which agents?');
	pool.forEach((a, i) => console.log(`  ${i + 1}. ${a.name}${detected.includes(a) ? '  (detected)' : ''}`));
	const answer = await ask(detected.length ? `Numbers, comma-separated [Enter = ${detected.map((a) => pool.indexOf(a) + 1).join(',')}]: ` : 'Numbers, comma-separated: ');
	if (!answer) {
		if (!detected.length) throw new UserError('no agent selected');
		return detected;
	}
	const picked = answer.split(',').map((s) => pool[Number(s.trim()) - 1]);
	if (picked.some((a) => !a)) throw new UserError(`pick numbers from 1 to ${pool.length}`);
	return [...new Set(picked)];
}

/** The same skill put there by another tool (npx skills add, a manual copy), as opposed to an unrelated folder. */
function sameSkill(skillDir, name) {
	try {
		const head = readFileSync(join(skillDir, 'SKILL.md'), 'utf8').split(/^---\s*$/m)[1] ?? '';
		return new RegExp(`^name:\\s*["']?${name}["']?\\s*$`, 'm').test(head);
	} catch {
		return false;
	}
}

function planInstall(project, agents, skills, root, opts) {
	const actions = [];
	const seenDirs = new Set();
	for (const agent of agents) {
		const dir = join(project, agent.skillsDir);
		if (!seenDirs.has(dir)) {
			seenDirs.add(dir);
			for (const skill of skills) {
				const to = join(dir, skill);
				const status = !existsSync(to) ? 'new' : ours(to) ? 'update' : opts.force ? 'replace' : sameSkill(to, skill) ? 'kept' : 'skip';
				actions.push({ agent, kind: 'skill', from: join(root, 'skills', skill), to, status });
			}
		}
		const hook = agent.hook && HOOKS[agent.hook];
		if (hook) {
			const script = join(project, hook.script);
			actions.push({ agent, kind: 'hook-script', from: join(root, 'hooks', 'new-vendor.mjs'), to: script, status: existsSync(script) ? 'update' : 'new' });
			const configFile = join(project, hook.config);
			const config = readJsonConfig(configFile);
			const changed = hook.add(config);
			actions.push({ agent, kind: 'hook-config', to: configFile, config, status: changed ? (existsSync(configFile) ? 'merge' : 'new') : 'present', describe: hook.describe });
		}
	}
	return actions;
}

/** Only folders named like our skills and marked by us: a renamed copy is the user's now. */
function planUninstall(project, agents, skills) {
	const actions = [];
	const seenDirs = new Set();
	for (const agent of agents) {
		const dir = join(project, agent.skillsDir);
		if (!seenDirs.has(dir) && isDir(dir)) {
			seenDirs.add(dir);
			for (const name of readdirSync(dir).sort()) {
				const to = join(dir, name);
				if (skills.includes(name) && isDir(to) && ours(to)) actions.push({ agent, kind: 'skill', to, status: 'remove' });
			}
		}
		const hook = agent.hook && HOOKS[agent.hook];
		if (hook) {
			const script = join(project, hook.script);
			if (existsSync(script)) actions.push({ agent, kind: 'hook-script', to: script, status: 'remove' });
			const configFile = join(project, hook.config);
			if (existsSync(configFile)) {
				const config = readJsonConfig(configFile);
				if (hook.remove(config)) actions.push({ agent, kind: 'hook-config', to: configFile, config, status: Object.keys(config).length ? 'unmerge' : 'remove', describe: hook.describe });
			}
		}
	}
	return actions;
}

const LABEL = {
	new: '+ ',
	update: '~ ',
	replace: '! ',
	merge: '~ ',
	present: '= ',
	skip: '- ',
	kept: '= ',
	remove: '- ',
	unmerge: '~ ',
};

function describe(a, project) {
	const path = relative(project, a.to).split('\\').join('/') || '.';
	if (a.kind === 'hook-config') {
		const what = { new: `create with ${a.describe}`, merge: `add ${a.describe}`, present: 'hook already registered, no change', unmerge: `remove ${a.describe}, keep the rest`, remove: `remove ${a.describe} (file becomes empty, deleted)` }[a.status];
		return `${LABEL[a.status]}${path}: ${what}`;
	}
	const note = {
		new: '',
		update: ' (update)',
		replace: ' (replace, --force)',
		kept: ' (installed by another tool, kept; --force replaces it with this version)',
		skip: ' (exists and was not installed by manifestack: skipped, use --force to replace)',
		remove: '',
	}[a.status];
	return `${LABEL[a.status]}${path}${note}`;
}

function printPlan(title, project, actions) {
	console.log(`${title}\n  in ${project}`);
	let last = null;
	for (const a of actions) {
		if (a.agent !== last) {
			console.log(`  ${a.agent.name}`);
			last = a.agent;
		}
		console.log(`    ${describe(a, project)}`);
	}
}

function writeConfig(file, config) {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}

/** Removes the skills and hooks folders that uninstall emptied, so an empty .github/skills is not taken for Copilot. */
function removeEmptyDirs(actions) {
	const dirs = new Set(actions.filter((a) => a.status === 'remove' && a.kind !== 'hook-config').map((a) => dirname(a.to)));
	for (const dir of dirs) {
		try {
			if (isDir(dir) && !readdirSync(dir).length) rmdirSync(dir);
		} catch {
			// Best effort: a folder we cannot remove is harmless.
		}
	}
}

function apply(actions) {
	for (const a of actions) {
		try {
			if (a.status === 'skip' || a.status === 'kept' || a.status === 'present') continue;
			if (a.kind === 'skill' && a.status === 'remove') rmSync(a.to, { recursive: true, force: true });
			else if (a.kind === 'skill') {
				rmSync(a.to, { recursive: true, force: true });
				mkdirSync(dirname(a.to), { recursive: true });
				cpSync(a.from, a.to, { recursive: true });
				writeFileSync(join(a.to, MARKER), JSON.stringify({ installedBy: 'manifestack', version: VERSION }, null, 2) + '\n');
			} else if (a.kind === 'hook-script' && a.status === 'remove') rmSync(a.to, { force: true });
			else if (a.kind === 'hook-script') {
				mkdirSync(dirname(a.to), { recursive: true });
				cpSync(a.from, a.to);
			} else if (a.kind === 'hook-config' && a.status === 'remove') rmSync(a.to, { force: true });
			else if (a.kind === 'hook-config') writeConfig(a.to, a.config);
		} catch (e) {
			if (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS') throw new UserError(`no write permission for ${a.to}`);
			throw e;
		}
	}
}

async function confirm(opts) {
	if (opts.yes || !process.stdin.isTTY) return true;
	const answer = await ask('Apply these changes? [Y/n] ');
	return answer === '' || /^y(es)?$/i.test(answer);
}

async function install(opts) {
	const project = resolve(opts.dir ?? '.');
	if (!isDir(project)) throw new UserError(`project folder not found: ${project}`);
	const root = assetsRoot();
	const all = availableSkills(root);
	const unknown = opts.skill.filter((s) => !all.includes(s));
	if (unknown.length) throw new UserError(`unknown skill ${unknown.join(', ')}. Available: ${all.join(', ')}`);
	const skills = opts.skill.length ? opts.skill : all;
	const agents = await chooseAgents(opts, project);
	const actions = planInstall(project, agents, skills, root, opts);
	printPlan(`manifestack ${VERSION}: install ${skills.join(', ')}`, project, actions);
	if (opts.dryRun) return console.log('Dry run: nothing changed.');
	if (!(await confirm(opts))) return console.log('Cancelled: nothing changed.');
	apply(actions);
	const skipped = actions.filter((a) => a.status === 'skip');
	console.log(`Done.${skipped.length ? ` ${skipped.length} skipped (see above).` : ''}`);
	for (const agent of agents) console.log(`  ${agent.name}: ${agent.next.replace(/`/g, '')}`);
}

async function hook(opts) {
	const project = resolve(opts.dir ?? '.');
	if (!isDir(project)) throw new UserError(`project folder not found: ${project}`);
	const root = assetsRoot();
	const agents = await chooseAgents(opts, project, { pool: AGENTS.filter((a) => a.hook) });
	const actions = planInstall(project, agents, [], root, opts);
	printPlan(`manifestack ${VERSION}: new-vendor hook`, project, actions);
	if (opts.dryRun) return console.log('Dry run: nothing changed.');
	if (!(await confirm(opts))) return console.log('Cancelled: nothing changed.');
	apply(actions);
	console.log('Done. After a dependency manifest edit or a package install command the hook flags vendor SDKs that are new to the project.');
}

async function uninstall(opts) {
	const project = resolve(opts.dir ?? '.');
	if (!isDir(project)) throw new UserError(`project folder not found: ${project}`);
	// Without a terminal nobody confirms, so removing from every agent needs --yes or the agents named.
	if (!process.stdin.isTTY && !opts.yes && !opts.agent.length) throw new UserError('no terminal to confirm the removal. Pass --agent <id> or --yes.');
	const agents = await chooseAgents(opts, project, { forUninstall: true });
	const actions = planUninstall(project, agents, availableSkills(assetsRoot()));
	if (!actions.length) return console.log(`Nothing to remove in ${project}.`);
	printPlan(`manifestack ${VERSION}: uninstall (.manifestack/ is kept)`, project, actions);
	if (opts.dryRun) return console.log('Dry run: nothing changed.');
	if (!(await confirm(opts))) return console.log('Cancelled: nothing changed.');
	apply(actions);
	removeEmptyDirs(actions);
	console.log('Done. .manifestack/ was not touched.');
}

async function main(argv) {
	const opts = parseCli(argv);
	if (opts.version) return console.log(VERSION);
	const cmd = opts._[0];
	if (opts.help) return console.log(HELP);
	if (!cmd || cmd === 'install') return install(opts);
	if (cmd === 'hook') return hook(opts);
	if (cmd === 'uninstall') return uninstall(opts);
	throw new UserError(`unknown command "${cmd}". Run: npx manifestack --help`);
}

// npx ignores "engines", so an older Node gets a clear message instead of a syntax or API error later.
if (Number(process.versions.node.split('.')[0]) < 22) {
	console.error(`manifestack: Node.js 22 or newer is required (this is ${process.versions.node}). Update Node.js and run it again.`);
	process.exit(1);
}

main(process.argv.slice(2)).catch((e) => {
	const message = e instanceof ConfigError ? `${e.message}. Fix it first; manifestack will not overwrite it.` : e instanceof UserError ? e.message : e.stack ?? e.message;
	console.error(`manifestack: ${message}`);
	process.exit(1);
});
