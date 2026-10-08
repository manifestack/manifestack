// Dependency names from each ecosystem's manifest: package.json and deno.json (npm), requirements*.txt, pyproject.toml
// and Pipfile (PyPI), go.mod (Go). Lightweight line parsers, no TOML library: only the dependency lists are read.
import { packageMatches } from './known-sdks.mjs';

/** Signature field that holds each ecosystem's package names in a vendor map. */
export const ECOSYSTEM_FIELDS = { npm: 'packages', pypi: 'pypi', go: 'go' };

/** Which ecosystem a manifest belongs to, from its repo-relative path; null if it is not a manifest. */
export function manifestKind(path) {
	const parts = String(path).split(/[\\/]/);
	const name = parts.at(-1);
	if (name === 'package.json' || name === 'deno.json' || name === 'deno.jsonc') return 'npm';
	if (name === 'go.mod') return 'go';
	if (name === 'pyproject.toml' || name === 'Pipfile') return 'pypi';
	if (/^[\w.-]*requirements[\w.-]*\.(txt|in)$/i.test(name)) return 'pypi';
	if (parts.at(-2) === 'requirements' && /\.(txt|in)$/.test(name)) return 'pypi';
	return null;
}

// Deno and browser CDNs import npm packages by URL or with a registry prefix: npm:stripe@14, https://esm.sh/x@2.
const REGISTRY_PREFIX = /^(?:npm:|jsr:|https?:\/\/(?:esm\.sh|cdn\.skypack\.dev|esm\.run|cdn\.jsdelivr\.net\/npm|unpkg\.com)\/)\/?/;

/** The package path an import specifier names, without registry prefix or version ("npm:@a/b@2/c" -> "@a/b/c"). */
export function normalizeSpecifier(spec) {
	const prefix = REGISTRY_PREFIX.exec(spec);
	if (!prefix) return spec;
	const m = /^((?:@[^/@?#]+\/)?[^/@?#]+)(?:@[^/?#]*)?([^?#]*)/.exec(spec.slice(prefix[0].length));
	return m ? m[1] + m[2] : spec;
}

/** Package name of a specifier without its subpath ("@a/b/c" -> "@a/b"). */
const packageName = (spec) => /^(?:@[^/]+\/)?[^/]+/.exec(spec)?.[0] ?? spec;

/** Source text with comments blanked out. Strings are kept, so a "//" or "#" inside one stays. */
export function stripComments(src, { hash = false } = {}) {
	let out = '';
	let k = 0;
	while (k < src.length) {
		const c = src[k];
		if (c === '"' || c === "'" || (c === '`' && !hash)) {
			const triple = hash && src.startsWith(c.repeat(3), k) ? c.repeat(3) : '';
			let end = k + (triple.length || 1);
			while (end < src.length) {
				if (src[end] === '\\') end += 2;
				else if (triple ? src.startsWith(triple, end) : src[end] === c) break;
				// Only template literals and triple quotes span lines, so a stray quote (JSX text, a regex) ends at the newline.
				else if (src[end] === '\n' && c !== '`' && !triple) break;
				else end++;
			}
			end = Math.min(src.length, end + (triple.length || 1));
			out += src.slice(k, end);
			k = end;
		} else if (c === '\\') {
			out += src.slice(k, k + 2);
			k += 2;
		} else if (hash ? c === '#' : src.startsWith('//', k)) {
			while (k < src.length && src[k] !== '\n') k++;
		} else if (!hash && src.startsWith('/*', k)) {
			const end = src.indexOf('*/', k + 2);
			out += ' ';
			k = end === -1 ? src.length : end + 2;
		} else {
			out += c;
			k++;
		}
	}
	return out;
}

/** The real package behind an npm alias ("npm:stripe@12" -> "stripe"), else the declared name. */
function npmName(name, version) {
	const m = /^npm:((?:@[^/@]+\/)?[^@]+)/.exec(typeof version === 'string' ? version : '');
	return m ? m[1] : name;
}

export function dependencyNames(pkgJson) {
	const names = new Set();
	for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
		for (const [name, version] of Object.entries(pkgJson?.[field] ?? {})) names.add(npmName(name, version));
	}
	return [...names];
}

/** npm and JSR packages from a deno.json(c) import map; URL and path entries are left out. */
function denoImports(text) {
	const json = JSON.parse(stripComments(text).replace(/,(\s*[}\]])/g, '$1'));
	const names = new Set();
	for (const target of Object.values(json?.imports ?? {})) {
		if (typeof target === 'string' && /^(npm|jsr):/.test(target)) names.add(packageName(normalizeSpecifier(target)));
	}
	return [...names];
}

/** PEP 503 normalization: case-insensitive, runs of `-`, `_` and `.` are equal. */
export function normalizePypi(name) {
	return String(name).toLowerCase().replace(/[-_.]+/g, '-');
}

/** The distribution name at the start of a PEP 508 requirement ("stripe[async]>=7 ; python_version>'3.8'"). */
function requirementName(spec) {
	const m = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(spec);
	return m ? m[1] : null;
}

function requirementsTxt(text) {
	const names = [];
	for (let line of text.split(/\r?\n/)) {
		line = line.replace(/(^|\s)#.*$/, '').trim();
		// A VCS or URL requirement names its package in "#egg=" (also after -e).
		const egg = /[#&]egg=([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line);
		if (egg) {
			names.push(egg[1]);
			continue;
		}
		if (!line || line.startsWith('-') || /^[./~]/.test(line)) continue;
		// "name @ https://…" is a direct reference with a name; a bare URL has none.
		if (line.includes('://') && !/^[A-Za-z0-9][A-Za-z0-9._-]*(\[[^\]]*\])?\s*@/.test(line)) continue;
		const name = requirementName(line);
		if (name) names.push(name);
	}
	return names;
}

/**
 * Scans the value part of one TOML line. Open brackets and multi-line strings carry over to the next line in `st`;
 * `#` outside a string starts a comment. Each string goes to onString with the brackets it sits in.
 */
function scanTomlValue(line, st, onString) {
	let k = 0;
	if (st.multiline) {
		const end = line.indexOf(st.multiline);
		if (end === -1) return;
		k = end + 3;
		st.multiline = null;
	}
	for (; k < line.length; k++) {
		const c = line[k];
		if (c === '#') return;
		if (c === '[' || c === '{') st.stack.push(c);
		else if (c === ']' || c === '}') st.stack.pop();
		else if (c === '"' || c === "'") {
			const triple = c.repeat(3);
			if (line.startsWith(triple, k)) {
				const end = line.indexOf(triple, k + 3);
				if (end === -1) {
					st.multiline = triple;
					return;
				}
				k = end + 2;
				continue;
			}
			let str = '';
			let j = k + 1;
			for (; j < line.length && line[j] !== c; j++) {
				if (c === '"' && line[j] === '\\') j++;
				str += line[j] ?? '';
			}
			onString(str, st.stack);
			k = j;
		}
	}
}

// Arrays of PEP 508 requirement strings, and tables whose keys are package names.
const requirementArray = (table, key) =>
	(table === 'project' && (key === 'dependencies' || key === 'optional-dependencies')) ||
	(table === 'tool.uv' && key === 'dev-dependencies') ||
	['project.optional-dependencies', 'dependency-groups', 'tool.pdm.dev-dependencies'].includes(table);
const packageKeyTable = (table) => /^tool\.poetry(\.group\.[^.]+)?\.(dev-)?dependencies$/.test(table) || table === 'packages' || table === 'dev-packages';

/** Dependencies from pyproject.toml (PEP 621, PEP 735 groups, uv, PDM, Poetry) and Pipfile. */
function pythonToml(text) {
	const names = [];
	let table = '';
	const st = { stack: [], multiline: null, collect: false };
	// Only strings directly in an array are requirements; {include-group = "test"} is not.
	const onString = (str, stack) => {
		if (!st.collect || stack.at(-1) !== '[') return;
		const name = requirementName(str);
		if (name) names.push(name);
	};
	for (const line of text.split(/\r?\n/)) {
		if (st.stack.length || st.multiline) {
			scanTomlValue(line, st, onString);
			continue;
		}
		const header = /^\s*\[{1,2}\s*([^\]]+?)\s*\]{1,2}\s*(#.*)?$/.exec(line);
		if (header) {
			table = header[1].replace(/["'\s]/g, '');
			continue;
		}
		const m = /^\s*(["']?)([A-Za-z0-9_.-]+)\1\s*=/.exec(line);
		if (!m) continue;
		if (packageKeyTable(table) && m[2].toLowerCase() !== 'python') names.push(m[2]);
		st.collect = requirementArray(table, m[2]);
		scanTomlValue(line.slice(m[0].length), st, onString);
	}
	return names;
}

/** Module paths from go.mod `require` lines and blocks; `// indirect` entries are left out. */
function goMod(text) {
	const names = [];
	let block = false;
	for (const raw of text.split(/\r?\n/)) {
		const indirect = /\/\/\s*indirect\b/.test(raw);
		const line = raw.replace(/\/\/.*$/, '').trim();
		if (block) {
			if (line === ')') block = false;
			else if (line && !indirect) names.push(line.split(/\s+/)[0]);
			continue;
		}
		if (/^require\s*\($/.test(line)) block = true;
		else if (/^require\s+\S+/.test(line) && !indirect) names.push(line.split(/\s+/)[1]);
	}
	return names;
}

/** Dependency names declared in a manifest of the given kind. Unparseable files give an empty list. */
export function manifestDependencies(kind, text, path = '') {
	text = String(text).replace(/^\uFEFF/, '');
	try {
		if (kind === 'npm') return /deno\.jsonc?$/.test(path) ? denoImports(text) : dependencyNames(JSON.parse(text));
		if (kind === 'go') return goMod(text);
		if (kind === 'pypi') return /\.toml$|(^|[\\/])Pipfile$/.test(path) ? pythonToml(text) : requirementsTxt(text);
	} catch {}
	return [];
}

/** Whether a dependency matches a vendor's patterns, by the naming rules of its ecosystem. */
export function dependencyMatches(kind, dep, patterns = []) {
	if (kind === 'npm') return packageMatches(dep, patterns);
	if (kind === 'go') return patterns.some((p) => dep === p || dep.startsWith(p + '/'));
	if (kind === 'pypi') {
		const d = normalizePypi(dep);
		return patterns.some((p) => (p.endsWith('*') ? d.startsWith(normalizePypi(p.slice(0, -1))) : d === normalizePypi(p)));
	}
	return false;
}
