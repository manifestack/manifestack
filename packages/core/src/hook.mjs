// "New vendor" hook for Claude Code and Cursor (both PostToolUse; Cursor spells it postToolUse).
// After an edit to a dependency manifest (package.json, requirements*.txt, pyproject.toml, Pipfile, go.mod) it
// compares dependencies before and after the edit; after a package-manager command (npm install, pip install,
// deno add, go get…) it takes the package names from the command. Vendors that are new and not in .manifestack/STACK.md
// get one line of context for the agent; otherwise it prints nothing. Each vendor is announced once per session.
// Offline, never blocks, always exits 0.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isMain } from './cli-util.mjs';
import { loadCatalog, vendorSignatures } from './catalog.mjs';
import { matchDependencies } from './detect.mjs';
import { manifestKind, manifestDependencies } from './manifests.mjs';
import { parseStackMd } from './stack-md.mjs';
import { STACK_FILE } from './workdir.mjs';

// tools/sync.mjs replaces this line with the signatures from catalog/vendors.
let EMBEDDED_SIGNATURES = null; // @embed:signatures

function hookSignatures() {
	if (EMBEDDED_SIGNATURES) return EMBEDDED_SIGNATURES;
	const catalog = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'catalog', 'vendors');
	return vendorSignatures(loadCatalog(catalog));
}

const npmArgName = (w) => {
	// An alias names the real package after npm: (pay@npm:stripe@14 installs stripe).
	const alias = /^(?:@[^@/]+\/)?[^@]+@npm:(.+)$/.exec(w);
	if (alias) return npmArgName(alias[1]);
	if (/^[./~]/.test(w) || w.includes(':') || /\.tgz$/i.test(w)) return null;
	return /^((?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+)(?:@.*)?$/i.exec(w)?.[1] ?? null;
};
const pypiName = (w) => {
	if (/^[./~]/.test(w) || /:\/\/|^git\+/.test(w) || /\.(whl|zip|tar\.gz)$/i.test(w)) return null;
	return /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?(?:[=<>!~;@,].*)?$/.exec(w)?.[1] ?? null;
};
// deno add npm:stripe jsr:@std/path: the registry prefix is not part of the name.
const denoName = (w) => npmArgName(w.replace(/^(?:npm|jsr):/, ''));
const goName = (w) => {
	const name = w.split('@')[0];
	return /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(name) ? name : null;
};

// Package-manager commands that add dependencies. `verbs` are the words before the package names ('*' is any
// word); `values` are the flags whose next word is a value, not a package (a -r file, a workspace, an index URL).
const PACKAGE_MANAGERS = {
	npm: { kind: 'npm', name: npmArgName, verbs: [['install'], ['i'], ['add']], values: ['-w', '--workspace', '--prefix', '--registry', '--tag'] },
	pnpm: { kind: 'npm', name: npmArgName, verbs: [['add']], values: ['-F', '--filter', '-C', '--dir', '--registry'] },
	yarn: { kind: 'npm', name: npmArgName, verbs: [['add'], ['workspace', '*', 'add']], values: ['--cwd', '--registry'] },
	bun: { kind: 'npm', name: npmArgName, verbs: [['add'], ['install'], ['i']], values: ['--cwd', '--registry'] },
	pip: { kind: 'pypi', name: pypiName, verbs: [['install']], values: ['-r', '--requirement', '-c', '--constraint', '-e', '--editable', '-i', '--index-url', '--extra-index-url', '-f', '--find-links', '-t', '--target', '--prefix', '--root', '--python'] },
	uv: { kind: 'pypi', name: pypiName, verbs: [['add'], ['pip', 'install']], values: ['-r', '--requirements', '--requirement', '-c', '--constraints', '--constraint', '-e', '--editable', '--group', '--optional', '--package', '-p', '--python', '--index', '--index-url', '--extra-index-url', '--directory', '--project'] },
	poetry: { kind: 'pypi', name: pypiName, verbs: [['add']], values: ['-G', '--group', '-E', '--extras', '--source', '-C', '--directory', '-P', '--project'] },
	pipenv: { kind: 'pypi', name: pypiName, verbs: [['install']], values: ['-r', '--requirements', '-i', '--index', '--python', '--categories'] },
	deno: { kind: 'npm', name: denoName, verbs: [['add'], ['install'], ['i']], values: ['-c', '--config'] },
	go: { kind: 'go', name: goName, verbs: [['get']], values: ['-C'] },
};

// Words that run the next word as the command: sudo -E npm i, corepack pnpm add, env FOO=1 npm i.
const PREFIXES = ['sudo', 'time', 'exec', 'command', 'nohup', 'env', 'corepack'];
// npm.cmd, C:\\tools\\pip.exe, /usr/local/bin/npm → npm, pip
const toolName = (w) => w?.replace(/^.*[\\/]/, '').replace(/\.(cmd|exe|ps1|bat)$/i, '').toLowerCase();

/** One shell command → { kind, verb, names } when it adds packages, else null. */
function packageCommand(words) {
	let i = 0;
	for (;;) {
		if (/^[A-Za-z_]\w*=/.test(words[i] ?? '')) i++;
		else if (PREFIXES.includes(toolName(words[i]))) {
			i++;
			while (words[i]?.startsWith('-')) i++;
		} else break;
	}
	let tool = toolName(words[i]);
	if (/^(python[\d.]*|py)$/.test(tool ?? '')) {
		// python3 -m pip, py -3.12 -m pip
		let j = i + 1;
		while (words[j]?.startsWith('-') && words[j] !== '-m') j++;
		if (words[j] !== '-m') return null;
		tool = toolName(words[(i = j + 1)]);
	}
	tool = tool?.replace(/^pip[\d.]*$/, 'pip');
	const pm = Object.hasOwn(PACKAGE_MANAGERS, tool ?? '') ? PACKAGE_MANAGERS[tool] : null;
	if (!pm) return null;
	const args = [];
	for (let j = i + 1; j < words.length; j++) {
		const w = words[j];
		// A global CLI is not a project dependency; a dry run installs nothing.
		if (w === '-g' || w === '--global' || w === '--location=global' || w === '--dry-run') return null;
		if (w === '--location' && words[j + 1] === 'global') return null;
		if (w.startsWith('-')) {
			if (pm.values.includes(w)) j++;
		} else args.push(w);
	}
	const verb = pm.verbs.find((v) => v.every((x, k) => args[k] !== undefined && (x === '*' || args[k] === x)));
	if (!verb) return null;
	const names = args.slice(verb.length).map(pm.name).filter(Boolean);
	return names.length ? { kind: pm.kind, verb: `${tool} ${verb.slice(verb.indexOf('*') + 1).join(' ')}`, names } : null;
}

/**
 * The simple commands of a shell line as lists of words. Separators (&&, ||, ;, |, &, newlines) count only
 * outside quotes; quotes are removed, redirections dropped and heredoc bodies skipped, so the text of a
 * commit message or a file written with cat <<EOF is never read as a command. $(…) and backticks are not
 * expanded: their words stay inside the word they belong to.
 */
export function shellCommands(line) {
	const commands = [];
	let words = [];
	let word = null;
	let heredocs = [];
	const endWord = () => {
		if (word !== null) words.push(word);
		word = null;
	};
	const endCommand = () => {
		endWord();
		if (words.length) commands.push(words);
		words = [];
	};
	const n = line.length;
	for (let i = 0; i < n; i++) {
		const c = line[i];
		if (c === "'") {
			const end = line.indexOf("'", i + 1);
			const stop = end < 0 ? n : end;
			word = (word ?? '') + line.slice(i + 1, stop);
			i = stop;
		} else if (c === '"') {
			let j = i + 1;
			let text = '';
			while (j < n && line[j] !== '"') {
				if (line[j] === '\\' && /["\\$`\n]/.test(line[j + 1] ?? '')) j++;
				text += line[j++];
			}
			word = (word ?? '') + text;
			i = j;
		} else if (c === '\\' && (i + 1 === n || /[\s"'\\$`;&|<>#()]/.test(line[i + 1]))) {
			// An escape (or a line continuation). Before other characters a backslash is kept, so Windows
			// paths such as C:\tools\npm.cmd survive.
			if (line[i + 1] !== '\n') word = (word ?? '') + (line[i + 1] ?? '');
			i++;
		} else if (c === '\n') {
			endCommand();
			// Heredoc bodies start on the next line and end at a line that is the delimiter alone.
			for (const { tag, dash } of heredocs) {
				for (;;) {
					const eol = line.indexOf('\n', i + 1);
					const body = line.slice(i + 1, eol < 0 ? n : eol).replace(/\r$/, '');
					i = eol < 0 ? n : eol;
					if ((dash ? body.replace(/^\t+/, '') : body) === tag || eol < 0) break;
				}
			}
			heredocs = [];
		} else if (c === ';' || c === '&' || c === '|') {
			endCommand();
		} else if (c === '<' && line[i + 1] === '<' && line[i + 2] !== '<') {
			endWord();
			let j = i + 2;
			const dash = line[j] === '-';
			if (dash) j++;
			while (line[j] === ' ' || line[j] === '\t') j++;
			let tag = '';
			while (j < n && !/[\s;&|<>]/.test(line[j])) {
				if (line[j] !== '"' && line[j] !== "'" && line[j] !== '\\') tag += line[j];
				j++;
			}
			if (tag) heredocs.push({ tag, dash });
			i = j - 1;
		} else if (c === '>' || c === '<') {
			// A redirection and its target are not arguments: 2>&1, >/dev/null, >> log, < input.
			if (word !== null && /^\d+$/.test(word)) word = null;
			else endWord();
			let j = i + 1;
			if (line[j] === '>' || line[j] === '<') j++;
			if (line[j] === '&') j++;
			while (line[j] === ' ' || line[j] === '\t') j++;
			while (j < n && !/[\s;&|<>]/.test(line[j])) j++;
			i = j - 1;
		} else if (c === ' ' || c === '\t' || c === '\r') {
			endWord();
		} else if (c === '#' && word === null) {
			const eol = line.indexOf('\n', i);
			i = (eol < 0 ? n : eol) - 1;
		} else {
			word = (word ?? '') + c;
		}
	}
	endCommand();
	return commands;
}

/** Package-manager add commands in a shell command line, chains (&&, ||, ;, |, newlines) included. */
export function parsePackageCommands(command) {
	if (!/\b(npm|pnpm|yarn|bun|deno|pip[\d.]*|uv|poetry|pipenv|go)\b/i.test(command)) return [];
	return shellCommands(command).map(packageCommand).filter(Boolean);
}

/**
 * Normalizes Claude Code (PostToolUse) and Cursor (postToolUse) payloads into a manifest edit
 * { agent, file, edits, write, original } or a package-manager command { agent, installs, cwd }.
 */
export function readHookEvent(input) {
	const agent = input?.hook_event_name === 'postToolUse' || input?.cursor_version ? 'cursor' : 'claude-code';
	const tool = input?.tool_name;
	const ti = input?.tool_input ?? {};
	const cwd = input?.cwd ?? input?.workspace_roots?.[0] ?? process.cwd();
	const id = input?.session_id ?? input?.conversation_id;
	const session = typeof id === 'string' && id ? id : null;
	if (tool === 'Bash' || tool === 'Shell') {
		const installs = typeof ti.command === 'string' ? parsePackageCommands(ti.command) : [];
		return installs.length ? { agent, session, installs, cwd: resolve(cwd, ti.working_directory ?? '.') } : null;
	}
	// Cursor does not document the Write input, so take the usual field names.
	const path = ti.file_path ?? ti.path ?? ti.target_file;
	if (!['Write', 'Edit', 'MultiEdit'].includes(tool) || typeof path !== 'string') return null;
	const edits = Array.isArray(ti.edits) ? ti.edits : 'new_string' in ti ? [{ old_string: ti.old_string, new_string: ti.new_string, replace_all: ti.replace_all }] : null;
	const original = input.tool_response?.originalFile;
	return { agent, session, file: resolve(cwd, path), edits: edits ?? [], write: tool === 'Write' && !edits, original: typeof original === 'string' ? original : null };
}

const toPosix = (p) => p.split('\\').join('/');

// git show answers these (in the C locale) when the file has no committed version: everything in it is new.
const NOT_COMMITTED = /does not exist in 'HEAD'|exists on disk, but not in 'HEAD'|invalid object name 'HEAD'|unknown revision|bad revision|not a git repository/i;

/**
 * The committed version of a file: its text, '' when it was never committed (or there is no repository),
 * null when git cannot tell (git missing, too slow, refusing the repository). Null keeps the hook quiet:
 * reporting every vendor in the file as new would be wrong on every edit.
 */
function committedContent(file, gitTimeout) {
	// `HEAD:./name` resolves against cwd, so one git process is enough: starting one is slow on Windows.
	try {
		return execFileSync('git', ['show', `HEAD:./${basename(file)}`], { cwd: dirname(file), encoding: 'utf8', timeout: gitTimeout, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LC_ALL: 'C', LANGUAGE: '' } });
	} catch (err) {
		if (err?.code === 'ETIMEDOUT' || err?.code === 'ENOENT' || typeof err?.status !== 'number') return null;
		return NOT_COMMITTED.test(String(err.stderr ?? '')) ? '' : null;
	}
}

/** The file as it was before the edits: undo them in reverse order. Null when that cannot be told. */
function previousContent(current, event, gitTimeout) {
	if (typeof event.original === 'string') return event.original;
	if (event.write) return committedContent(event.file, gitTimeout);
	let text = current;
	for (const e of [...event.edits].reverse()) {
		if (typeof e?.new_string !== 'string' || typeof e?.old_string !== 'string') return null;
		// An empty new_string (a removal), one not in the file (CRLF file, LF edit) or one that is there twice
		// cannot be put back in the right place: unknown.
		const parts = e.new_string ? text.split(e.new_string) : [];
		if (parts.length < 2 || (!e.replace_all && parts.length > 2)) return null;
		text = parts.join(e.old_string);
	}
	return text;
}

const parsesAsJson = (text) => {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
};

/** Vendors and unmapped SDKs a manifest edit added, or null when it added none or that cannot be told. */
function manifestAdditions(event, gitTimeout, signatures) {
	const kind = manifestKind(event.file);
	if (!kind || !existsSync(event.file)) return null;
	const current = readFileSync(event.file, 'utf8');
	const now = matchDependencies(manifestDependencies(kind, current, event.file), signatures, kind);
	if (!now.vendors.length && !now.unmapped.length) return null;
	const previous = previousContent(current, event, gitTimeout);
	if (previous === null) return null;
	// A package.json that only parses after the edit was rebuilt wrong: every dependency would look new.
	// (deno.jsonc allows comments, so the check is for package.json only.)
	if (basename(event.file) === 'package.json' && previous.trim() && !parsesAsJson(previous.replace(/^\uFEFF/, ''))) return null;
	const before = matchDependencies(manifestDependencies(kind, previous, event.file), signatures, kind);
	return {
		vendors: now.vendors.filter((v) => !before.vendors.some((b) => b.id === v.id)),
		unmapped: now.unmapped.filter((u) => !before.unmapped.some((b) => b.name === u.name)),
	};
}

// Where each ecosystem keeps its dependencies, nearest folder first.
const MANIFESTS = { npm: ['package.json', 'deno.json', 'deno.jsonc'], pypi: ['pyproject.toml', 'requirements.txt', 'Pipfile'], go: ['go.mod'] };

/**
 * Dependencies the project already had before the command: from the committed manifests in the nearest
 * folder that has one. The working copy is no help, because npm, uv or go get have already written to it.
 */
function committedDependencies(kind, cwd, gitTimeout) {
	for (let dir = cwd; ; dir = dirname(dir)) {
		const files = MANIFESTS[kind].map((name) => join(dir, name)).filter((f) => existsSync(f));
		if (files.length) {
			const deps = [];
			for (const file of files) {
				const text = committedContent(file, gitTimeout);
				if (text) deps.push(...manifestDependencies(manifestKind(file), text, file));
			}
			return deps;
		}
		if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return [];
	}
}

/** Vendors and unmapped SDKs that package-manager commands add, each once; upgrades of packages already there are not news. */
function commandAdditions(event, signatures, gitTimeout) {
	const found = { vendors: [], unmapped: [] };
	for (const { kind, names } of event.installs) {
		let m = matchDependencies(names, signatures, kind);
		if (!m.vendors.length && !m.unmapped.length) continue;
		const before = matchDependencies(committedDependencies(kind, event.cwd, gitTimeout), signatures, kind);
		m = { vendors: m.vendors.filter((v) => !before.vendors.some((b) => b.id === v.id)), unmapped: m.unmapped.filter((u) => !before.unmapped.some((b) => b.name === u.name)) };
		found.vendors.push(...m.vendors.filter((v) => !found.vendors.some((f) => f.id === v.id)));
		found.unmapped.push(...m.unmapped.filter((u) => !found.unmapped.some((f) => f.name === u.name)));
	}
	return found;
}

/** .manifestack/STACK.md in the folder or above it, up to the repository root (the folder with .git). */
function findStackMd(dir) {
	for (;;) {
		const candidate = join(dir, STACK_FILE);
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (existsSync(join(dir, '.git')) || parent === dir) return null;
		dir = parent;
	}
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// "Stripe Billing", "stripe.com" and "Stripe (Billing)" in STACK.md all name Stripe: a prefix either way is
// enough, from 3 characters so that short names do not match by accident.
const sameVendor = (a, b) => Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a));

// Vendors already announced in this session, so a second edit of the same manifest or a retried install
// does not repeat the message. Kept per user in the cache folder; best effort, any error means no memory.
const SEEN_TTL_MS = 2 * 24 * 60 * 60 * 1000;

function seenFile() {
	if (process.env.MANIFESTACK_CACHE_DIR) return join(process.env.MANIFESTACK_CACHE_DIR, 'hook-seen.json');
	const base = process.platform === 'win32' ? process.env.LOCALAPPDATA : process.env.XDG_CACHE_HOME || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches') : join(homedir(), '.cache'));
	return base ? join(base, 'manifestack', 'hook-seen.json') : null;
}

function readSeen(file) {
	try {
		const data = JSON.parse(readFileSync(file, 'utf8'));
		return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
	} catch {
		return {};
	}
}

/** Drops what this session already announced, and remembers the rest. Without a session id nothing is filtered. */
function unseen(session, keys, now = Date.now()) {
	const file = session ? seenFile() : null;
	if (!file) return keys;
	const all = readSeen(file);
	const entry = all[session] && Array.isArray(all[session].keys) ? all[session] : { keys: [] };
	const fresh = keys.filter((k) => !entry.keys.includes(k));
	if (!fresh.length) return fresh;
	const kept = Object.fromEntries(Object.entries(all).filter(([, v]) => now - (v?.at ?? 0) < SEEN_TTL_MS));
	kept[session] = { at: now, keys: [...entry.keys, ...fresh] };
	try {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(kept));
	} catch {
		// No cache folder: the message may repeat, which is harmless.
	}
	return fresh;
}

/** Returns the context line for the agent, or null when nothing new was added. */
export function newVendorMessage(event, { signatures, gitTimeout = 2000 }) {
	if (!event) return null;
	const found = event.installs ? commandAdditions(event, signatures, gitTimeout) : manifestAdditions(event, gitTimeout, signatures);
	if (!found) return null;
	const dir = event.installs ? event.cwd : dirname(event.file);
	const stackFile = findStackMd(dir);
	const listed = [];
	if (stackFile) {
		for (const s of parseStackMd(readFileSync(stackFile, 'utf8')).sections) if (s.vendor) listed.push(norm(s.vendor));
	}
	const known = (...names) => names.some((n) => listed.some((l) => sameVendor(l, norm(n ?? ''))));
	let added = [
		...found.vendors.filter((v) => !known(v.id, v.name)).map((v) => ({ key: v.id, label: `${v.name} (${v.roles.join(', ')})`, mapped: true })),
		...found.unmapped.filter((u) => !known(u.name)).map((u) => ({ key: `sdk:${u.name}`, label: `${u.name} (${u.role})`, mapped: false })),
	];
	if (!added.length) return null;
	const fresh = unseen(event.session, added.map((a) => a.key));
	added = added.filter((a) => fresh.includes(a.key));
	if (!added.length) return null;
	const names = added.map((a) => a.label).join(', ');
	const unmapped = added.filter((a) => !a.mapped).map((a) => a.label.replace(/ \(.*$/, ''));
	const where = event.installs ? `with ${[...new Set(event.installs.map((i) => i.verb))].join(', ')}` : `in ${basename(event.file)}`;
	// Self-contained on purpose: models rarely pick up a skill for a routine coding task, so the
	// message says what to check even if the manifestack-guard skill is never loaded.
	let msg = `Manifestack: ${names} was added ${where}. Before you finish, tell the user in two or three lines`;
	if (stackFile) {
		msg += ` how it fits STACK.md (${toPosix(relative(dir, stackFile))}): the "requires" line (data region, certifications), the "avoid" line (vendors or tech the team rules out), the budget, any section with the same role, and any "decided" line it touches. Use the manifestack-guard skill if it is available. Do not edit STACK.md without the user's yes.`;
	} else {
		msg += ` which plan limits to check for it (send caps, billed users, storage, rate limits), and suggest running /manifestack to record the stack in ${STACK_FILE}.`;
	}
	if (unmapped.length) msg += ` Manifestack has no page map for ${unmapped.join(', ')}; its public pricing page is the source for prices.`;
	msg += ' Do not quote prices or limits from memory. Keep going with the task.';
	return msg;
}

export function formatHookOutput(agent, message) {
	if (agent === 'cursor') return JSON.stringify({ additional_context: message });
	return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message } });
}

function readStdin() {
	try {
		return readFileSync(0, 'utf8');
	} catch {
		return '';
	}
}

// The copy that `npx manifestack install` or `hook` puts in the project.
const PROJECT_HOOK = '.claude/hooks/manifestack-new-vendor.mjs';

/**
 * True when this is the Claude Code plugin's copy and the project registers its own: both would run on
 * every edit (Claude Code does not merge a plugin hook with a different settings hook), so the plugin steps aside.
 */
function projectHookTakesOver(input) {
	if (basename(fileURLToPath(import.meta.url)) === basename(PROJECT_HOOK)) return false;
	const root = process.env.CLAUDE_PROJECT_DIR || input?.cwd;
	if (typeof root !== 'string' || !existsSync(join(root, PROJECT_HOOK))) return false;
	return ['.claude/settings.json', '.claude/settings.local.json'].some((f) => {
		try {
			return readFileSync(join(root, f), 'utf8').includes(basename(PROJECT_HOOK));
		} catch {
			return false;
		}
	});
}

export function hookMain() {
	try {
		const raw = readStdin();
		if (!raw.trim()) return;
		const input = JSON.parse(raw);
		const event = readHookEvent(input);
		if (!event || (event.agent === 'claude-code' && projectHookTakesOver(input))) return;
		const message = newVendorMessage(event, { signatures: hookSignatures() });
		if (message) process.stdout.write(formatHookOutput(event.agent, message) + '\n');
	} catch {
		// A hook must never break the agent's edit.
	}
}

if (isMain(import.meta.url)) hookMain(); // @main
