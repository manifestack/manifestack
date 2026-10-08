// "New vendor" hook for Claude Code and Cursor (both PostToolUse; Cursor spells it postToolUse).
// After an edit to a dependency manifest (package.json, requirements*.txt, pyproject.toml, Pipfile, go.mod) it
// compares dependencies before and after the edit; after a package-manager command (npm install, pip install,
// deno add, go get…) it takes the package names from the command. Vendors that are new and not in .manifestack/STACK.md
// get one line of context for the agent; otherwise it prints nothing. Offline, never blocks, always exits 0.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, basename, relative, resolve } from 'node:path';
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

/** One shell command → { kind, verb, names } when it adds packages, else null. */
function packageCommand(words) {
	let i = 0;
	while (/^[A-Za-z_]\w*=/.test(words[i] ?? '') || ['sudo', 'time', 'exec', 'command'].includes(words[i])) i++;
	let tool = words[i]?.replace(/^.*\//, '');
	if (/^python[\d.]*$/.test(tool ?? '') && words[i + 1] === '-m') tool = words[(i += 2)];
	tool = tool?.replace(/^pip[\d.]*$/, 'pip');
	const pm = Object.hasOwn(PACKAGE_MANAGERS, tool ?? '') ? PACKAGE_MANAGERS[tool] : null;
	if (!pm) return null;
	const args = [];
	for (let j = i + 1; j < words.length; j++) {
		const w = words[j];
		if (w === '-g' || w === '--global') return null; // a global CLI, not a project dependency
		if (w.startsWith('-')) {
			if (pm.values.includes(w)) j++;
		} else args.push(w);
	}
	const verb = pm.verbs.find((v) => v.every((x, k) => args[k] !== undefined && (x === '*' || args[k] === x)));
	if (!verb) return null;
	const names = args.slice(verb.length).map(pm.name).filter(Boolean);
	return names.length ? { kind: pm.kind, verb: `${tool} ${verb.slice(verb.indexOf('*') + 1).join(' ')}`, names } : null;
}

/** Package-manager add commands in a shell command line, chains (&&, ||, ;, |, newlines) included. */
export function parsePackageCommands(command) {
	if (!/\b(npm|pnpm|yarn|bun|deno|pip[\d.]*|uv|poetry|pipenv|go)\b/.test(command)) return [];
	return command
		.split(/&&|\|\||[;|\n]/)
		.map((part) => packageCommand(part.trim().split(/\s+/).map((w) => w.replace(/^["']|["']$/g, ''))))
		.filter(Boolean);
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
	if (tool === 'Bash' || tool === 'Shell') {
		const installs = typeof ti.command === 'string' ? parsePackageCommands(ti.command) : [];
		return installs.length ? { agent, installs, cwd: resolve(cwd, ti.working_directory ?? '.') } : null;
	}
	// Cursor does not document the Write input, so take the usual field names.
	const path = ti.file_path ?? ti.path ?? ti.target_file;
	if (!['Write', 'Edit', 'MultiEdit'].includes(tool) || typeof path !== 'string') return null;
	const edits = Array.isArray(ti.edits) ? ti.edits : 'new_string' in ti ? [{ old_string: ti.old_string, new_string: ti.new_string, replace_all: ti.replace_all }] : null;
	const original = input.tool_response?.originalFile;
	return { agent, file: resolve(cwd, path), edits: edits ?? [], write: tool === 'Write' && !edits, original: typeof original === 'string' ? original : null };
}

const toPosix = (p) => p.split('\\').join('/');

/** The file as it was before the edits: undo them in reverse order. Null when that cannot be told. */
function previousContent(current, event, gitTimeout) {
	if (typeof event.original === 'string') return event.original;
	if (event.write) {
		// `HEAD:./name` resolves against cwd, so one git process is enough: starting one is slow on Windows.
		try {
			return execFileSync('git', ['show', `HEAD:./${basename(event.file)}`], { cwd: dirname(event.file), encoding: 'utf8', timeout: gitTimeout, stdio: ['ignore', 'pipe', 'ignore'] });
		} catch (err) {
			// No git, no commit or a new file: everything in it is new. Git too slow: unknown, so stay quiet
			// rather than report every vendor in the file as added.
			return err?.code === 'ETIMEDOUT' ? null : '';
		}
	}
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

/** Vendors and unmapped SDKs named in package-manager commands, each once. */
function commandAdditions(event, signatures) {
	const found = { vendors: [], unmapped: [] };
	for (const { kind, names } of event.installs) {
		const m = matchDependencies(names, signatures, kind);
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

/** Returns the context line for the agent, or null when nothing new was added. */
export function newVendorMessage(event, { signatures, gitTimeout = 2000 }) {
	if (!event) return null;
	const found = event.installs ? commandAdditions(event, signatures) : manifestAdditions(event, gitTimeout, signatures);
	if (!found) return null;
	const dir = event.installs ? event.cwd : dirname(event.file);
	const stackFile = findStackMd(dir);
	const listed = [];
	if (stackFile) {
		for (const s of parseStackMd(readFileSync(stackFile, 'utf8')).sections) if (s.vendor) listed.push(norm(s.vendor));
	}
	const known = (...names) => names.some((n) => listed.some((l) => sameVendor(l, norm(n ?? ''))));
	const added = [
		...found.vendors.filter((v) => !known(v.id, v.name)).map((v) => ({ label: `${v.name} (${v.roles.join(', ')})`, mapped: true })),
		...found.unmapped.filter((u) => !known(u.name)).map((u) => ({ label: `${u.name} (${u.role})`, mapped: false })),
	];
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

export function hookMain() {
	try {
		const raw = readStdin();
		if (!raw.trim()) return;
		const event = readHookEvent(JSON.parse(raw));
		if (!event) return;
		const message = newVendorMessage(event, { signatures: hookSignatures() });
		if (message) process.stdout.write(formatHookOutput(event.agent, message) + '\n');
	} catch {
		// A hook must never break the agent's edit.
	}
}

if (isMain(import.meta.url)) hookMain(); // @main
