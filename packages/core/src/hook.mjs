// "New vendor" hook for Claude Code (PostToolUse) and Cursor (afterFileEdit).
// After an edit to package.json it compares dependencies before and after the edit and with the
// services already in STACK.md. A new vendor gets one line of context for the agent; otherwise it
// prints nothing. Offline, never blocks, always exits 0.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isMain } from './cli-util.mjs';
import { loadCatalog, vendorSignatures } from './catalog.mjs';
import { dependencyNames, matchPackages } from './detect.mjs';
import { parseStackMd } from './stack-md.mjs';

// tools/sync.mjs replaces this line with the signatures from catalog/vendors.
let EMBEDDED_SIGNATURES = null; // @embed:signatures

const MANIFESTS = new Set(['package.json']);

function hookSignatures() {
	if (EMBEDDED_SIGNATURES) return EMBEDDED_SIGNATURES;
	const catalog = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'catalog', 'vendors');
	return vendorSignatures(loadCatalog(catalog));
}

/** Normalizes Claude Code and Cursor hook payloads into { agent, file, edits, write }. */
export function readHookEvent(input) {
	if (input?.hook_event_name === 'afterFileEdit' || (input?.file_path && Array.isArray(input?.edits))) {
		return { agent: 'cursor', file: input.file_path, edits: input.edits ?? [], write: false, roots: input.workspace_roots ?? [] };
	}
	const tool = input?.tool_name;
	const ti = input?.tool_input ?? {};
	if (!['Write', 'Edit', 'MultiEdit'].includes(tool) || !ti.file_path) return null;
	const file = resolve(input.cwd ?? process.cwd(), ti.file_path);
	if (tool === 'Write') return { agent: 'claude-code', file, edits: [], write: true, roots: [input.cwd].filter(Boolean) };
	const edits = tool === 'MultiEdit' ? ti.edits ?? [] : [{ old_string: ti.old_string, new_string: ti.new_string, replace_all: ti.replace_all }];
	return { agent: 'claude-code', file, edits, write: false, roots: [input.cwd].filter(Boolean) };
}

/** The file as it was before the edits: undo them in reverse order. */
function previousContent(current, event) {
	if (event.write) {
		try {
			const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dirname(event.file), encoding: 'utf8', timeout: 150, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
			const rel = relative(root, event.file).split('\\').join('/');
			return execFileSync('git', ['show', `HEAD:${rel}`], { cwd: root, encoding: 'utf8', timeout: 150, stdio: ['ignore', 'pipe', 'ignore'] });
		} catch {
			return '';
		}
	}
	let text = current;
	for (const e of [...event.edits].reverse()) {
		if (typeof e?.new_string !== 'string' || typeof e?.old_string !== 'string') continue;
		text = e.replace_all ? text.split(e.new_string).join(e.old_string) : text.replace(e.new_string, () => e.old_string);
	}
	return text;
}

function depsOf(text) {
	try {
		return dependencyNames(JSON.parse(text));
	} catch {
		return [];
	}
}

function findStackMd(file, roots) {
	let dir = dirname(file);
	for (;;) {
		const candidate = join(dir, 'STACK.md');
		if (existsSync(candidate)) return candidate;
		if (existsSync(join(dir, '.git')) || roots.some((r) => resolve(r) === dir)) return null;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Returns the context line for the agent, or null when nothing new was added. */
export function newVendorMessage(event, { signatures }) {
	if (!event || !MANIFESTS.has(basename(event.file)) || !existsSync(event.file)) return null;
	const current = readFileSync(event.file, 'utf8');
	const now = matchPackages(depsOf(current), signatures);
	if (!now.vendors.length && !now.unmapped.length) return null;
	const before = matchPackages(depsOf(previousContent(current, event)), signatures);
	const stackFile = findStackMd(event.file, event.roots);
	const listed = new Set();
	if (stackFile) {
		for (const s of parseStackMd(readFileSync(stackFile, 'utf8')).sections) if (s.vendor) listed.add(norm(s.vendor));
	}
	const known = (id, name) => listed.has(norm(name)) || listed.has(norm(id ?? ''));
	const added = [
		...now.vendors.filter((v) => !before.vendors.some((b) => b.id === v.id) && !known(v.id, v.name)).map((v) => ({ label: `${v.name} (${v.roles.join(', ')})`, mapped: true })),
		...now.unmapped.filter((u) => !before.unmapped.some((b) => b.name === u.name) && !known(null, u.name)).map((u) => ({ label: `${u.name} (${u.role})`, mapped: false })),
	];
	if (!added.length) return null;
	const names = added.map((a) => a.label).join(', ');
	const unmapped = added.filter((a) => !a.mapped).map((a) => a.label.replace(/ \(.*$/, ''));
	// Self-contained on purpose: models rarely pick up a skill for a routine coding task, so the
	// message says what to check even if the manifestack-guard skill is never loaded.
	let msg = `Manifestack: ${names} was added in ${basename(event.file)}. Before you finish, tell the user in two or three lines`;
	if (stackFile) {
		msg += ` how it fits STACK.md (${relative(dirname(event.file), stackFile) || 'STACK.md'}): the "requires" line (data region, certifications), the budget, any section with the same role, and any "decided" line it touches. Use the manifestack-guard skill if it is available. Do not edit STACK.md without the user's yes.`;
	} else {
		msg += ' which plan limits to check for it (send caps, billed users, storage, rate limits), and suggest running /manifestack to record the stack in STACK.md.';
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
		const message = newVendorMessage(event, { signatures: hookSignatures() });
		if (message) process.stdout.write(formatHookOutput(event.agent, message) + '\n');
	} catch {
		// A hook must never break the agent's edit.
	}
}

if (isMain(import.meta.url)) hookMain(); // @main
