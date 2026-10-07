// Dependency names from each ecosystem's manifest: package.json (npm), requirements*.txt, pyproject.toml and
// Pipfile (PyPI), go.mod (Go). Lightweight line parsers, no TOML library: only the dependency lists are read.
import { packageMatches } from './known-sdks.mjs';

/** Signature field that holds each ecosystem's package names in a vendor map. */
export const ECOSYSTEM_FIELDS = { npm: 'packages', pypi: 'pypi', go: 'go' };

/** Which ecosystem a manifest belongs to, from its repo-relative path; null if it is not a manifest. */
export function manifestKind(path) {
	const parts = String(path).split(/[\\/]/);
	const name = parts.at(-1);
	if (name === 'package.json') return 'npm';
	if (name === 'go.mod') return 'go';
	if (name === 'pyproject.toml' || name === 'Pipfile') return 'pypi';
	if (/^requirements([-._][\w.-]*)?\.(txt|in)$/i.test(name)) return 'pypi';
	if (parts.at(-2) === 'requirements' && /\.(txt|in)$/.test(name)) return 'pypi';
	return null;
}

export function dependencyNames(pkgJson) {
	const names = new Set();
	for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
		for (const name of Object.keys(pkgJson?.[field] ?? {})) names.add(name);
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
		if (!line || line.startsWith('-') || /^[./~]/.test(line)) continue;
		// "name @ https://…" is a direct reference with a name; a bare URL has none.
		if (line.includes('://') && !/^[A-Za-z0-9][A-Za-z0-9._-]*(\[[^\]]*\])?\s*@/.test(line)) continue;
		const name = requirementName(line);
		if (name) names.push(name);
	}
	return names;
}

const tomlKey = (line) => /^\s*("?)([A-Za-z0-9_.-]+)\1\s*=/.exec(line)?.[2];

/** Dependencies from pyproject.toml (PEP 621, PEP 735 groups, Poetry) and Pipfile. */
function pythonToml(text) {
	const names = [];
	let table = '';
	let collecting = false;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/\s+#.*$/, '');
		if (collecting) {
			for (const m of line.matchAll(/["']([^"']+)["']/g)) {
				const name = requirementName(m[1]);
				if (name) names.push(name);
			}
			if (line.includes(']')) collecting = false;
			continue;
		}
		const header = /^\s*\[{1,2}\s*([^\]]+?)\s*\]{1,2}\s*$/.exec(line);
		if (header) {
			table = header[1].replace(/["']/g, '');
			continue;
		}
		const key = tomlKey(line);
		if (!key) continue;
		const arrayTable = (table === 'project' && key === 'dependencies') || table === 'project.optional-dependencies' || table === 'dependency-groups';
		const keyTable = /^tool\.poetry(\.group\.[^.]+)?\.(dev-)?dependencies$/.test(table) || table === 'packages' || table === 'dev-packages';
		if (arrayTable && /=\s*\[/.test(line)) {
			const rest = line.slice(line.indexOf('[') + 1);
			for (const m of rest.matchAll(/["']([^"']+)["']/g)) {
				const name = requirementName(m[1]);
				if (name) names.push(name);
			}
			collecting = !rest.includes(']');
		} else if (keyTable && key.toLowerCase() !== 'python') {
			names.push(key);
		}
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
	try {
		if (kind === 'npm') return dependencyNames(JSON.parse(text));
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
