// Finds vendors in a repository: dependencies from package.json, deno.json, requirements*.txt, pyproject.toml, Pipfile and
// go.mod, JS imports (also npm:, jsr: and esm.sh), config files and env var NAMES.
// Env values are dropped while reading a line, before anything else sees them. No network.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, parseArgs, printJson, fail } from './cli-util.mjs';
import { loadCatalog, vendorSignatures } from './catalog.mjs';
import { UNMAPPED_SDKS, FRAMEWORK_PACKAGES, FRAMEWORK_PYPI, FRAMEWORK_GO } from './known-sdks.mjs';
import { ECOSYSTEM_FIELDS, manifestKind, manifestDependencies, dependencyMatches, normalizeSpecifier, stripComments } from './manifests.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'venv', 'site-packages', 'Pods', '__pycache__', 'target', 'tmp']);
const SOURCE_EXT = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py|go)$/;
const FRAMEWORKS = { npm: FRAMEWORK_PACKAGES, pypi: FRAMEWORK_PYPI, go: FRAMEWORK_GO };
const ENV_FILE = /^\.env(\..+)?$/;
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_EVIDENCE = 8;
// The "new vendor" hook as `npx manifestack install` or `npx manifestack hook` registers it (packages/cli/src/agents.js).
const HOOK_FILE = 'manifestack-new-vendor.mjs';
const HOOK_SETUPS = {
	// `current`: the entry the CLI writes today. Older installs (Cursor afterFileEdit, Claude Code without Bash) are `outdated`.
	'claude-code': {
		configs: ['.claude/settings.json', '.claude/settings.local.json'],
		script: `.claude/hooks/${HOOK_FILE}`,
		current: (c) => (c?.hooks?.PostToolUse ?? []).some((g) => /\bBash\b/.test(g?.matcher ?? '') && JSON.stringify(g).includes(HOOK_FILE)),
	},
	cursor: { configs: ['.cursor/hooks.json'], script: `.cursor/hooks/${HOOK_FILE}`, current: (c) => (c?.hooks?.postToolUse ?? []).some((h) => String(h?.command).includes(HOOK_FILE)) },
};
// Files that do not make a repository "existing code" on their own.
const NON_PROJECT_FILES = /^(readme|license|licence|changelog|contributing|code_of_conduct|security|stack|agents|claude|gemini)(\.[a-z]+)?$|^\.(gitignore|gitattributes|editorconfig|env.*)$/i;

/** Variable names from a dotenv file. The value part of each line is discarded immediately. */
export function readEnvNames(text) {
	const names = [];
	for (const line of text.split(/\r?\n/)) {
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
		if (m) names.push(m[1]);
	}
	return names;
}

export function extractImports(source) {
	const specs = new Set();
	const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"\n]+)['"]/gm;
	let m;
	while ((m = re.exec(source))) specs.add(m[1]);
	return [...specs];
}

/** Which mapped vendors and unmapped SDKs a list of dependencies of one ecosystem (npm, pypi, go) contains. */
export function matchDependencies(deps, signatures, kind = 'npm') {
	const field = ECOSYSTEM_FIELDS[kind];
	const vendors = [];
	for (const sig of signatures) {
		const hits = deps.filter((d) => dependencyMatches(kind, d, sig[field]));
		if (hits.length) vendors.push({ id: sig.id, name: sig.name, roles: sig.roles, packages: hits });
	}
	const unmapped = [];
	for (const sdk of UNMAPPED_SDKS) {
		const hits = deps.filter((d) => dependencyMatches(kind, d, sdk[field]));
		if (hits.length) unmapped.push({ name: sdk.name, role: sdk.role, packages: hits });
	}
	return { vendors, unmapped };
}

/**
 * An import specifier against a vendor's import patterns. A pattern ending in `/` or `:` is a prefix ("@sentry/",
 * "cloudflare:"); any other pattern is a package name and matches it or its subpaths ("mongodb", "mongodb/lib").
 */
export function importMatches(spec, patterns = []) {
	return patterns.some((p) => (/[/:]$/.test(p) ? spec.startsWith(p) : spec === p || spec.startsWith(p + '/')));
}

/** Files of the repository, shallow ones first, so manifests at the top are listed before deep source trees. */
function listFiles(root, limits) {
	const files = [];
	const queue = [root];
	for (let q = 0; q < queue.length; q++) {
		let entries;
		try {
			entries = readdirSync(queue[q], { withFileTypes: true });
		} catch {
			continue;
		}
		// A virtualenv under any name (python -m venv env, .venv, py312): installed packages, not the product.
		if (q > 0 && entries.some((e) => e.name === 'pyvenv.cfg')) continue;
		for (const e of entries) {
			const full = join(queue[q], e.name);
			if (e.isDirectory()) {
				// Dot-directories hold agent configs, installed skills and VCS data, not the product.
				if (!e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) queue.push(full);
				continue;
			}
			// Symlinks are followed to files only; a linked directory could loop.
			if (!e.isFile() && !(e.isSymbolicLink() && isFileSync(full))) continue;
			if (files.length >= limits.maxListed) {
				limits.truncated = true;
				return files;
			}
			files.push(full);
		}
	}
	return files;
}

function isFileSync(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

// Evidence kept per vendor, most telling first; every kind found keeps at least one slot.
const EVIDENCE_ORDER = ['package', 'config', 'import', 'code', 'env'];

function pickEvidence(all) {
	const sorted = [...all].sort((a, b) => EVIDENCE_ORDER.indexOf(a.kind) - EVIDENCE_ORDER.indexOf(b.kind));
	const picked = new Set(EVIDENCE_ORDER.map((k) => sorted.find((e) => e.kind === k)).filter(Boolean).slice(0, MAX_EVIDENCE));
	for (const e of sorted) if (picked.size < MAX_EVIDENCE) picked.add(e);
	return sorted.filter((e) => picked.has(e));
}

/** Per agent: `on` (registered in the project), `outdated` (registered by an older version), `plugin` (the Claude Code plugin brings its own) or `off`. */
export function hookStatus(root, { plugin = false } = {}) {
	const status = {};
	for (const [agent, setup] of Object.entries(HOOK_SETUPS)) {
		let registered = false;
		let current = false;
		for (const c of setup.configs) {
			let text;
			try {
				text = readFileSync(join(root, c), 'utf8');
			} catch {
				continue;
			}
			if (!text.includes(HOOK_FILE)) continue;
			registered = true;
			try {
				current ||= setup.current(JSON.parse(text));
			} catch {
				// Unparseable config: the hook is registered, its shape unknown.
			}
		}
		if (registered && existsSync(join(root, setup.script))) status[agent] = current ? 'on' : 'outdated';
		else status[agent] = agent === 'claude-code' && plugin ? 'plugin' : 'off';
	}
	return status;
}

function isKubernetesManifest(text) {
	return /^apiVersion:/m.test(text) && /^kind:\s*(Deployment|StatefulSet|DaemonSet|Service|Ingress|HorizontalPodAutoscaler|CronJob)\b/m.test(text);
}

export function detectVendors(root, { signatures, maxFiles = 5000, plugin = false } = {}) {
	root = resolve(root);
	if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`not a directory: ${root}`);
	const sigs = signatures ?? [];
	const found = new Map(); // vendor id -> { evidence, roleHits }
	const unmapped = new Map();
	const envNames = new Set();
	const frameworks = new Map();
	const infra = [];
	let projectFiles = 0;
	let scanned = 0;
	// Paths are listed first, then read in two passes: env files and manifests always, YAML and source until maxFiles
	// files were read. A large tree loses imports, never dependencies.
	const limits = { maxListed: maxFiles * 20, truncated: false };

	const hit = (sig, kind, file, match, role) => {
		if (!found.has(sig.id)) found.set(sig.id, { sig, evidence: new Map(), roleHits: new Set() });
		const f = found.get(sig.id);
		if (role) f.roleHits.add(role);
		const key = `${kind}\0${file}\0${match}`;
		if (!f.evidence.has(key)) f.evidence.set(key, { kind, file, match });
	};
	const read = (full) => {
		const text = readFileSync(full, 'utf8');
		scanned++;
		return text;
	};

	// Config files are also checked at their exact path: the walk skips dot-directories such as .do/.
	for (const sig of sigs) for (const cfg of sig.config_files) if (isFileSync(join(root, cfg))) hit(sig, 'config', cfg, cfg);

	const deferred = [];
	for (const full of listFiles(root, limits)) {
		const rel = relative(root, full).split(sep).join('/');
		const name = basename(full);
		if (!(rel.indexOf('/') === -1 && NON_PROJECT_FILES.test(name))) projectFiles++;

		if (ENV_FILE.test(name)) {
			let names = [];
			try {
				names = readEnvNames(read(full));
			} catch {}
			for (const n of names) {
				envNames.add(n);
				for (const sig of sigs) {
					const prefix = sig.env_prefixes.find((p) => n.startsWith(p));
					if (prefix) hit(sig, 'env', rel, n);
				}
			}
			continue;
		}

		for (const sig of sigs) {
			for (const cfg of sig.config_files) if (rel === cfg || rel.endsWith('/' + cfg)) hit(sig, 'config', rel, cfg);
		}

		const manifest = manifestKind(rel);
		if (manifest) {
			let text;
			try {
				text = read(full);
			} catch {
				continue;
			}
			const deps = manifestDependencies(manifest, text, rel);
			const m = matchDependencies(deps, sigs, manifest);
			for (const v of m.vendors) for (const p of v.packages) hit(sigs.find((s) => s.id === v.id), 'package', rel, p);
			for (const u of m.unmapped) {
				if (!unmapped.has(u.name)) unmapped.set(u.name, { name: u.name, role: u.role, evidence: [] });
				for (const p of u.packages) unmapped.get(u.name).evidence.push({ kind: 'package', file: rel, match: p });
			}
			for (const d of deps) {
				const key = Object.keys(FRAMEWORKS[manifest]).find((k) => dependencyMatches(manifest, d, [k]));
				const fw = key && FRAMEWORKS[manifest][key];
				if (fw && !frameworks.has(fw)) frameworks.set(fw, { name: fw, package: d, file: rel });
			}
			continue;
		}

		if (name === 'Dockerfile' || /^Dockerfile\./.test(name)) infra.push({ kind: 'docker', file: rel });
		else if (/^(docker-)?compose(\.[\w-]+)?\.ya?ml$/.test(name)) infra.push({ kind: 'docker-compose', file: rel });
		else if (/\.tf$/.test(name)) infra.push({ kind: 'terraform', file: rel });
		else if (name === 'Chart.yaml') infra.push({ kind: 'helm', file: rel });
		else if (/^(helmfile|skaffold|kustomization)\.ya?ml$/.test(name)) infra.push({ kind: 'kubernetes', file: rel });
		else if (/^Pulumi\.ya?ml$/.test(name)) infra.push({ kind: 'pulumi', file: rel });
		else if (/^serverless\.ya?ml$/.test(name)) infra.push({ kind: 'serverless-framework', file: rel });
		else if (/\.ya?ml$/.test(name) || SOURCE_EXT.test(name)) deferred.push({ full, rel, name });
	}

	for (const { full, rel, name } of deferred) {
		if (scanned >= maxFiles) {
			limits.truncated = true;
			break;
		}
		if (/\.ya?ml$/.test(name)) {
			try {
				if (statSync(full).size < 256 * 1024 && isKubernetesManifest(read(full))) infra.push({ kind: 'kubernetes', file: rel });
			} catch {}
			continue;
		}
		let src;
		try {
			if (statSync(full).size > MAX_SOURCE_BYTES) continue;
			src = stripComments(read(full), { hash: name.endsWith('.py') });
		} catch {
			continue;
		}
		const specs = extractImports(src).map((spec) => [spec, normalizeSpecifier(spec)]);
		for (const sig of sigs) {
			for (const [spec, pkg] of specs) if (importMatches(pkg, sig.imports)) hit(sig, 'import', rel, spec);
			for (const [role, needles] of Object.entries(sig.role_signals ?? {})) {
				const needle = needles.find((n) => src.includes(n));
				if (needle) hit(sig, 'code', rel, needle, role);
			}
		}
	}

	const vendors = [...found.values()]
		.map(({ sig, evidence, roleHits }) => {
			// Roles with signals count only when a signal matched; other roles count once the vendor is present.
			const signalled = Object.keys(sig.role_signals ?? {});
			const roles_used = sig.roles.filter((r) => !signalled.includes(r) || roleHits.has(r));
			return { id: sig.id, name: sig.name, roles: sig.roles, roles_used, evidence: pickEvidence(evidence.values()) };
		})
		.sort((a, b) => a.id.localeCompare(b.id));

	const byRole = new Map();
	for (const v of vendors) for (const r of v.roles_used) byRole.set(r, [...(byRole.get(r) ?? []), v.id]);
	for (const u of unmapped.values()) if (u.role !== 'other') byRole.set(u.role, [...(byRole.get(u.role) ?? []), u.name]);
	const overlaps = [...byRole].filter(([, ids]) => ids.length > 1).map(([role, ids]) => ({ role, vendors: ids }));

	return {
		root,
		empty: projectFiles === 0,
		scanned_files: scanned,
		truncated: limits.truncated,
		vendors,
		unmapped: [...unmapped.values()],
		overlaps,
		frameworks: [...frameworks.values()],
		infra,
		env_names: [...envNames].sort(),
		hook: hookStatus(root, { plugin }),
	};
}

function defaultVendorsDir() {
	const here = dirname(fileURLToPath(import.meta.url));
	// Inside a skill: <skill>/scripts/detect.mjs next to <skill>/vendors. In the repo: packages/core/src.
	for (const dir of [join(here, '..', 'vendors'), join(here, '..', '..', '..', 'catalog', 'vendors')]) if (existsSync(dir)) return dir;
	return null;
}

/** True when this script runs from the Claude Code plugin, which registers the hook itself (hooks/hooks.json). */
function runsFromPlugin() {
	const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
	try {
		return existsSync(join(pluginRoot, '.claude-plugin', 'plugin.json')) && readFileSync(join(pluginRoot, 'hooks', 'hooks.json'), 'utf8').includes('new-vendor');
	} catch {
		return false;
	}
}

export function detectMain(argv) {
	const args = parseArgs(argv);
	if (args.help) {
		process.stdout.write('usage: node detect.mjs [repo-dir] [--vendors <dir>] [--max-files N]\nPrints JSON: vendors with evidence, unmapped SDKs, overlaps, frameworks, infra, env var names (never values), new-vendor hook status.\n');
		return;
	}
	const vendorsDir = args.vendors || defaultVendorsDir();
	if (!vendorsDir) fail('vendor maps not found; pass --vendors <dir>');
	const signatures = vendorSignatures(loadCatalog(vendorsDir));
	try {
		printJson(detectVendors(args._[0] ?? '.', { signatures, maxFiles: Number(args['max-files']) || 5000, plugin: runsFromPlugin() }));
	} catch (e) {
		fail(e.message);
	}
}

if (isMain(import.meta.url)) detectMain(process.argv.slice(2)); // @main
