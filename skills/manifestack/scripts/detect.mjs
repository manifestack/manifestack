// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- packages/core/src/cli-util.mjs
// Small helpers shared by the command-line entry points of every script.
// Rules for all files in packages/core/src (tools/sync.mjs bundles them into single files):
//   - imports on one line, named only, no `as` renames, only `node:*` or relative `./x.mjs`;
//   - top-level names unique across modules;
//   - the line that runs a module as a script ends with `// @main`.

function isMain(moduleUrl) {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
	} catch {
		return false;
	}
}

/** Parses `--key value`, `--key=value` and `--flag`. Repeated keys become arrays. */
function parseArgs(argv) {
	const args = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) {
			args._.push(a);
			continue;
		}
		let key = a.slice(2);
		let value = true;
		const eq = key.indexOf('=');
		if (eq !== -1) {
			value = key.slice(eq + 1);
			key = key.slice(0, eq);
		} else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
			value = argv[++i];
		}
		// --__proto__ or --constructor must not reach the object's prototype; no script has such an option.
		if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
		if (Object.hasOwn(args, key)) args[key] = [].concat(args[key], value);
		else args[key] = value;
	}
	return args;
}

function printJson(value) {
	process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function fail(message, code = 1) {
	process.stderr.write(`error: ${message}\n`);
	process.exit(code);
}

/** Today in the local time zone: a UTC date is a day off for half the world around midnight. */
function todayIso() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD that names a real day: 2026-13-01 and 2027-02-30 are rejected. */
function isIsoDate(s) {
	if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const t = Date.parse(s + 'T00:00:00Z');
	return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** Reads a date option such as --today or --from; a bare flag or an impossible date is an error. */
function dateArg(args, key, fallback) {
	const v = args[key];
	if (v == null) return fallback;
	if (!isIsoDate(v)) throw new Error(`--${key} needs a date as YYYY-MM-DD${v === true ? '' : `, got "${v}"`}`);
	return v;
}

// ---- packages/core/src/yaml.mjs
// Minimal YAML reader for vendor-map frontmatter. Covers what catalog/vendors/*.md uses:
// nested maps by indentation, block lists, lists of maps, inline [a, "b"] lists, quoted and plain
// scalars, numbers, booleans, null and `#` comments. Not a general YAML parser.

function parseFrontmatter(text) {
	const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text);
	if (!m) return { data: {}, body: text };
	return { data: parseYaml(m[1]), body: m[2] };
}

function parseYaml(src) {
	const lines = [];
	for (const raw of src.split(/\r?\n/)) {
		if (raw.includes('\t') && /^\s*\t/.test(raw)) throw new Error('YAML: tabs are not allowed for indentation');
		const text = stripYamlComment(raw).replace(/\s+$/, '');
		if (!text.trim()) continue;
		lines.push({ indent: text.length - text.trimStart().length, text: text.trim() });
	}
	let i = 0;
	const isItem = (t) => t === '-' || t.startsWith('- ');

	function parseBlock() {
		return isItem(lines[i].text) ? parseList(lines[i].indent) : parseMap(lines[i].indent);
	}

	function parseList(indent) {
		const out = [];
		while (i < lines.length && lines[i].indent === indent && isItem(lines[i].text)) {
			const rest = lines[i].text.slice(1).trim();
			if (!rest) {
				i++;
				out.push(i < lines.length && lines[i].indent > indent ? parseBlock() : null);
			} else if (!/^["'[{]/.test(rest) && splitYamlKey(rest)) {
				// A map item: its first key sits on the dash line, the rest are indented under it.
				lines[i] = { indent: indent + 2, text: rest };
				out.push(parseMap(indent + 2));
			} else {
				i++;
				out.push(parseYamlScalar(rest));
			}
		}
		return out;
	}

	function parseMap(indent) {
		const out = {};
		while (i < lines.length && lines[i].indent === indent && !isItem(lines[i].text)) {
			const kv = splitYamlKey(lines[i].text);
			if (!kv) throw new Error(`YAML: cannot parse line "${lines[i].text}"`);
			i++;
			const [key, value] = kv;
			if (Object.hasOwn(out, key)) throw new Error(`YAML: duplicate key "${key}"`);
			if (value !== '') out[key] = parseYamlScalar(value);
			else if (i < lines.length && (lines[i].indent > indent || (lines[i].indent === indent && isItem(lines[i].text)))) out[key] = parseBlock();
			else out[key] = null;
		}
		if (i < lines.length && lines[i].indent > indent) throw new Error(`YAML: unexpected indentation at "${lines[i].text}"`);
		return out;
	}

	if (!lines.length) return {};
	const result = parseBlock();
	if (i < lines.length) throw new Error(`YAML: unexpected content at "${lines[i].text}"`);
	return result;
}

function stripYamlComment(line) {
	let quote = null;
	for (let k = 0; k < line.length; k++) {
		const c = line[k];
		if (quote) {
			if (c === '\\' && quote === '"') k++;
			else if (c === "'" && quote === "'" && line[k + 1] === "'") k++;
			else if (c === quote) quote = null;
		} else if ((c === '"' || c === "'") && /(^|[:\-[{,])\s*$/.test(line.slice(0, k))) {
			// Only a quote that starts a scalar opens a string; the apostrophe in `What's` does not.
			quote = c;
		} else if (c === '#' && (k === 0 || /\s/.test(line[k - 1]))) {
			return line.slice(0, k);
		}
	}
	return line;
}

function splitYamlKey(text) {
	const m = /^("[^"]*"|'[^']*'|[A-Za-z0-9_][A-Za-z0-9_.\-]*)\s*:(?:\s+(.*))?$/.exec(text);
	if (!m) return null;
	return [m[1].replace(/^["']|["']$/g, ''), (m[2] ?? '').trim()];
}

function parseYamlScalar(raw) {
	const s = raw.trim();
	if (s.startsWith('"')) return JSON.parse(s);
	if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
	if (s.startsWith('[')) {
		if (!s.endsWith(']')) throw new Error(`YAML: unterminated list ${s}`);
		return splitInline(s.slice(1, -1)).map(parseYamlScalar);
	}
	if (s.startsWith('{')) {
		if (!s.endsWith('}')) throw new Error(`YAML: unterminated map ${s}`);
		const out = {};
		for (const part of splitInline(s.slice(1, -1))) {
			const kv = splitYamlKey(part);
			if (!kv) throw new Error(`YAML: cannot parse map entry ${part}`);
			if (Object.hasOwn(out, kv[0])) throw new Error(`YAML: duplicate key "${kv[0]}"`);
			out[kv[0]] = parseYamlScalar(kv[1]);
		}
		return out;
	}
	if (s === 'true') return true;
	if (s === 'false') return false;
	if (s === 'null' || s === '~') return null;
	if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
	return s;
}

function splitInline(s) {
	const parts = [];
	let cur = '';
	let quote = null;
	let depth = 0;
	for (let k = 0; k < s.length; k++) {
		const c = s[k];
		if (quote) {
			cur += c;
			if (c === '\\' && quote === '"') cur += s[++k] ?? '';
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'") {
			quote = c;
			cur += c;
		} else if (c === '[' || c === '{') {
			depth++;
			cur += c;
		} else if (c === ']' || c === '}') {
			depth--;
			cur += c;
		} else if (c === ',' && depth === 0) {
			parts.push(cur);
			cur = '';
		} else {
			cur += c;
		}
	}
	if (cur.trim()) parts.push(cur);
	return parts.map((p) => p.trim()).filter(Boolean);
}

// ---- packages/core/src/known-sdks.mjs
// SDKs of common vendors that have no page map yet. Detection reports them as `unmapped` so the
// audit still covers them (the skill finds the pricing page itself) and the hook can flag them.
// npm prefix entries end with `/` and match every package in that scope or path. `pypi` and `go` follow the rules in
// manifests.mjs (PyPI names normalized, trailing `*` = prefix; Go module path prefixes).
const UNMAPPED_SDKS = [
	{ name: 'Turso', role: 'database', packages: ['@libsql/', '@tursodatabase/'] },
	{ name: 'Prisma Postgres', role: 'database', packages: ['@prisma/ppg', '@prisma/extension-accelerate'] },
	{ name: 'AWS', role: 'other', packages: ['@aws-sdk/', 'aws-sdk', 'aws-cdk-lib'], pypi: ['boto3', 'botocore', 'aws-cdk-lib'], go: ['github.com/aws/aws-sdk-go-v2', 'github.com/aws/aws-sdk-go'] },
	{ name: 'Google Cloud', role: 'other', packages: ['@google-cloud/'], pypi: ['google-cloud-*'], go: ['cloud.google.com/go'] },
	{ name: 'Azure', role: 'other', packages: ['@azure/'], pypi: ['azure-*'], go: ['github.com/Azure/azure-sdk-for-go'] },
	{ name: 'Auth.js', role: 'auth', packages: ['next-auth', '@auth/'] },
	{ name: 'Better Auth', role: 'auth', packages: ['better-auth'] },
	{ name: 'OpenRouter', role: 'ai', packages: ['@openrouter/ai-sdk-provider', '@openrouter/sdk'] },
	{ name: 'Mailgun', role: 'email', packages: ['mailgun.js', 'mailgun-js'] },
	{ name: 'Loops', role: 'email', packages: ['loops'] },
	{ name: 'Twilio', role: 'other', packages: ['twilio'], pypi: ['twilio'], go: ['github.com/twilio/twilio-go'] },
	{ name: 'Axiom', role: 'monitoring', packages: ['@axiomhq/'] },
	{ name: 'Better Stack', role: 'monitoring', packages: ['@logtail/'] },
	{ name: 'Algolia', role: 'other', packages: ['algoliasearch', '@algolia/'] },
	{ name: 'Pusher', role: 'other', packages: ['pusher', 'pusher-js'] },
	{ name: 'Ably', role: 'other', packages: ['ably'] },
	{ name: 'Liveblocks', role: 'other', packages: ['@liveblocks/'] },
	{ name: 'Inngest', role: 'other', packages: ['inngest'] },
	{ name: 'Trigger.dev', role: 'other', packages: ['@trigger.dev/'] },
	{ name: 'Mistral', role: 'ai', packages: ['@mistralai/mistralai', '@ai-sdk/mistral'], pypi: ['mistralai', 'langchain-mistralai'] },
	{ name: 'Groq', role: 'ai', packages: ['groq-sdk', '@ai-sdk/groq'], pypi: ['groq', 'langchain-groq'] },
	{ name: 'Cohere', role: 'ai', packages: ['cohere-ai'], pypi: ['cohere', 'langchain-cohere'] },
	{ name: 'Replicate', role: 'ai', packages: ['replicate'], pypi: ['replicate'], go: ['github.com/replicate/replicate-go'] },
	{ name: 'Together AI', role: 'ai', packages: ['together-ai'], pypi: ['together'] },
	{ name: 'Pinecone', role: 'database', packages: ['@pinecone-database/'], pypi: ['pinecone', 'pinecone-client'], go: ['github.com/pinecone-io/go-pinecone'] },
];

// Frameworks: inputs for Overbuilt findings, not vendors. Keys are matched like vendor patterns of that ecosystem.
const FRAMEWORK_PACKAGES = {
	next: 'Next.js',
	nuxt: 'Nuxt',
	'@remix-run/node': 'Remix',
	'@react-router/dev': 'React Router',
	astro: 'Astro',
	'@sveltejs/kit': 'SvelteKit',
	gatsby: 'Gatsby',
	'@angular/core': 'Angular',
	vite: 'Vite',
	express: 'Express',
	fastify: 'Fastify',
	hono: 'Hono',
	'@nestjs/core': 'NestJS',
	'@tanstack/react-start': 'TanStack Start',
};
const FRAMEWORK_PYPI = { django: 'Django', fastapi: 'FastAPI', flask: 'Flask', litestar: 'Litestar', starlette: 'Starlette' };
const FRAMEWORK_GO = { 'github.com/gin-gonic/gin': 'Gin', 'github.com/labstack/echo': 'Echo', 'github.com/gofiber/fiber': 'Fiber', 'github.com/go-chi/chi': 'Chi' };

function packageMatches(pkg, patterns) {
	return patterns.some((p) => (p.endsWith('/') ? pkg.startsWith(p) : pkg === p));
}

// ---- packages/core/src/manifests.mjs
// Dependency names from each ecosystem's manifest: package.json and deno.json (npm), requirements*.txt, pyproject.toml
// and Pipfile (PyPI), go.mod (Go). Lightweight line parsers, no TOML library: only the dependency lists are read.

/** Signature field that holds each ecosystem's package names in a vendor map. */
const ECOSYSTEM_FIELDS = { npm: 'packages', pypi: 'pypi', go: 'go' };

/** Which ecosystem a manifest belongs to, from its repo-relative path; null if it is not a manifest. */
function manifestKind(path) {
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
function normalizeSpecifier(spec) {
	const prefix = REGISTRY_PREFIX.exec(spec);
	if (!prefix) return spec;
	const m = /^((?:@[^/@?#]+\/)?[^/@?#]+)(?:@[^/?#]*)?([^?#]*)/.exec(spec.slice(prefix[0].length));
	return m ? m[1] + m[2] : spec;
}

/** Package name of a specifier without its subpath ("@a/b/c" -> "@a/b"). */
const packageName = (spec) => /^(?:@[^/]+\/)?[^/]+/.exec(spec)?.[0] ?? spec;

/** Source text with comments blanked out. Strings are kept, so a "//" or "#" inside one stays. */
function stripComments(src, { hash = false } = {}) {
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

function dependencyNames(pkgJson) {
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
function normalizePypi(name) {
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
function manifestDependencies(kind, text, path = '') {
	text = String(text).replace(/^\uFEFF/, '');
	try {
		if (kind === 'npm') return /deno\.jsonc?$/.test(path) ? denoImports(text) : dependencyNames(JSON.parse(text));
		if (kind === 'go') return goMod(text);
		if (kind === 'pypi') return /\.toml$|(^|[\\/])Pipfile$/.test(path) ? pythonToml(text) : requirementsTxt(text);
	} catch {}
	return [];
}

/** Whether a dependency matches a vendor's patterns, by the naming rules of its ecosystem. */
function dependencyMatches(kind, dep, patterns = []) {
	if (kind === 'npm') return packageMatches(dep, patterns);
	if (kind === 'go') return patterns.some((p) => dep === p || dep.startsWith(p + '/'));
	if (kind === 'pypi') {
		const d = normalizePypi(dep);
		return patterns.some((p) => (p.endsWith('*') ? d.startsWith(normalizePypi(p.slice(0, -1))) : d === normalizePypi(p)));
	}
	return false;
}

// ---- packages/core/src/catalog.mjs
// Reads vendor maps (catalog/vendors/<id>.md in the repo, vendors/<id>.md inside a skill).
// A map says where to look and what to extract, never the prices themselves.

const VENDOR_SCHEMA = 1;
const VENDOR_ROLES = ['hosting', 'database', 'auth', 'email', 'storage', 'payments', 'monitoring', 'ai', 'other'];

/** Upgrades older map formats to the current schema. Add a case when VENDOR_SCHEMA goes up. */
function upgradeVendorMap(data) {
	switch (data.schema) {
		case VENDOR_SCHEMA:
			return data;
		default:
			throw new Error(`unsupported vendor map schema ${data.schema} (this version reads schema ${VENDOR_SCHEMA})`);
	}
}

function parseVendorMap(text, file = '<vendor map>') {
	let parsed;
	try {
		parsed = parseFrontmatter(text);
	} catch (e) {
		throw new Error(`${file}: ${e.message}`);
	}
	const data = upgradeVendorMap(parsed.data);
	const detect = data.detect ?? {};
	return {
		...data,
		roles: data.roles ?? [],
		detect: {
			packages: detect.packages ?? [],
			pypi: detect.pypi ?? [],
			go: detect.go ?? [],
			imports: detect.imports ?? [],
			env_prefixes: detect.env_prefixes ?? [],
			config_files: detect.config_files ?? [],
			role_signals: detect.role_signals ?? {},
		},
		pages: data.pages ?? {},
		read: data.read ?? [],
		usage_questions: data.usage_questions ?? [],
		common_fixes: data.common_fixes ?? [],
		notes: parsed.body.trim(),
	};
}

const DETECT_LISTS = ['packages', 'pypi', 'go', 'imports', 'env_prefixes', 'config_files'];
const isStringList = (x) => Array.isArray(x) && x.every((s) => typeof s === 'string' && s.trim() !== '');

function validateVendorMap(v) {
	const errors = [];
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v.id ?? ''))) errors.push('id must be lowercase a-z, 0-9 and single hyphens');
	if (!v.name) errors.push('name is required');
	if (!Array.isArray(v.roles) || !v.roles.length) errors.push('roles must be a non-empty list');
	for (const r of v.roles ?? []) if (!VENDOR_ROLES.includes(r)) errors.push(`unknown role "${r}"`);
	const d = v.detect ?? {};
	// Detection calls .some() on these and an empty pattern matches everything, so the shape is checked here.
	for (const field of DETECT_LISTS) if (!isStringList(d[field])) errors.push(`detect.${field} must be a list of non-empty strings`);
	if (!DETECT_LISTS.some((field) => Array.isArray(d[field]) && d[field].length)) errors.push('detect needs at least one signature');
	const signals = d.role_signals ?? {};
	if (typeof signals !== 'object' || Array.isArray(signals)) errors.push('detect.role_signals must map roles to lists');
	else {
		for (const [role, needles] of Object.entries(signals)) {
			if (!(v.roles ?? []).includes(role)) errors.push(`role_signals.${role} is not in roles`);
			if (!isStringList(needles) || !needles.length) errors.push(`role_signals.${role} must be a list of non-empty strings`);
		}
	}
	if (!/^https:\/\//.test(String(v.pages?.pricing ?? ''))) errors.push('pages.pricing must be an https URL');
	for (const [k, url] of Object.entries(v.pages ?? {})) if (!/^https:\/\//.test(String(url))) errors.push(`pages.${k} must be an https URL`);
	// "- Terms: …" in YAML is a mapping, not text: every item must stay a plain string.
	if (!isStringList(v.read) || !v.read.length) errors.push('read must be a list of plain strings (quote an item that starts with "Word:")');
	if (!isStringList(v.common_fixes)) errors.push('common_fixes must be a list of plain strings');
	for (const q of v.usage_questions ?? []) if (!q.metric || !q.ask || !q.where) errors.push('each usage question needs metric, ask and where');
	if (v.mcp?.official && v.mcp.readonly_flag && !v.mcp.allowed_tools?.length) errors.push('mcp.allowed_tools is required when read-only MCP use is allowed');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.verified ?? ''))) errors.push('verified must be a YYYY-MM-DD date');
	return errors;
}

/** Loads every map in a directory. Files starting with `_` (the template) are skipped. */
function loadCatalog(dir) {
	if (!existsSync(dir)) return [];
	const vendors = [];
	for (const name of readdirSync(dir).sort()) {
		if (!name.endsWith('.md') || name.startsWith('_')) continue;
		const v = parseVendorMap(readFileSync(join(dir, name), 'utf8'), name);
		const errors = validateVendorMap(v);
		if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
		if (`${v.id}.md` !== name) throw new Error(`${name}: id "${v.id}" must match the file name`);
		vendors.push(v);
	}
	const clash = packageClashes(vendors)[0];
	if (clash) throw new Error(clash);
	return vendors;
}

/** Package patterns that two maps both claim: the dependency would be reported as two vendors. */
function packageClashes(vendors) {
	const owner = new Map();
	const clashes = [];
	for (const v of vendors) {
		for (const field of ['packages', 'pypi', 'go']) {
			for (const p of v.detect?.[field] ?? []) {
				const key = `${field}:${field === 'pypi' ? normalizePypi(p) : p}`;
				const other = owner.get(key);
				if (other && other !== v.id) clashes.push(`${other}.md and ${v.id}.md both claim detect.${field} "${p}"`);
				else owner.set(key, v.id);
			}
		}
	}
	return clashes;
}

/** The part of a map that detection needs; embedded into the hook so it runs without the catalog. */
function vendorSignatures(vendors) {
	return vendors.map((v) => ({ id: v.id, name: v.name, roles: v.roles, ...v.detect }));
}

// ---- packages/core/src/detect.mjs
// Finds vendors in a repository: dependencies from package.json, deno.json, requirements*.txt, pyproject.toml, Pipfile and
// go.mod, JS imports (also npm:, jsr: and esm.sh), config files and env var NAMES.
// Env values are dropped while reading a line, before anything else sees them. No network.

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'venv', 'site-packages', 'Pods', '__pycache__', 'target', 'tmp']);
const SOURCE_EXT = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py|go)$/;
const FRAMEWORKS = { npm: FRAMEWORK_PACKAGES, pypi: FRAMEWORK_PYPI, go: FRAMEWORK_GO };
const ENV_FILE = /^\.env(\..+)?$/;
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_EVIDENCE = 8;
// The "new vendor" hook as `npx manifestack install` or `npx manifestack hook` registers it (packages/cli/src/agents.js).
const HOOK_FILE = 'manifestack-new-vendor.mjs';
const HOOK_SETUPS = {
	// `current`: the entry the CLI writes today. Older installs (Cursor afterFileEdit, Claude Code without Bash or
	// with $CLAUDE_PROJECT_DIR, which PowerShell does not expand) are `outdated`.
	'claude-code': {
		configs: ['.claude/settings.json', '.claude/settings.local.json'],
		script: `.claude/hooks/${HOOK_FILE}`,
		current: (c) =>
			(c?.hooks?.PostToolUse ?? []).some((g) => /\bBash\b/.test(g?.matcher ?? '') && (g?.hooks ?? []).some((h) => String(h?.command).includes(HOOK_FILE) && !/\$CLAUDE_PROJECT_DIR\b/.test(h.command))),
	},
	cursor: { configs: ['.cursor/hooks.json'], script: `.cursor/hooks/${HOOK_FILE}`, current: (c) => (c?.hooks?.postToolUse ?? []).some((h) => String(h?.command).includes(HOOK_FILE)) },
};
// Files that do not make a repository "existing code" on their own.
const NON_PROJECT_FILES = /^(readme|license|licence|changelog|contributing|code_of_conduct|security|stack|agents|claude|gemini)(\.[a-z]+)?$|^\.(gitignore|gitattributes|editorconfig|env.*)$/i;

/**
 * Variable names from a dotenv file. The value part of each line is discarded immediately. A quoted value may
 * span lines (a private key): its continuation lines are values too and are skipped, never read as names.
 */
export function readEnvNames(text) {
	const names = [];
	let open = null;
	for (const line of text.split(/\r?\n/)) {
		if (open) {
			if (closesQuote(line, open, 0)) open = null;
			continue;
		}
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
		if (!m) continue;
		names.push(m[1]);
		const value = m[2].trimStart();
		const q = value[0];
		if ((q === '"' || q === "'" || q === '`') && !closesQuote(value, q, 1)) open = q;
	}
	return names;
}

// Whether `line` has the closing quote from `from` on; in "…" a backslash escapes it.
function closesQuote(line, quote, from) {
	for (let i = from; i < line.length; i++) {
		if (line[i] === '\\' && quote === '"') i++;
		else if (line[i] === quote) return true;
	}
	return false;
}

/** Top-level modules a Python file imports: `import stripe`, `from openai import OpenAI`, `import a.b, c`. */
export function extractPythonModules(source) {
	const mods = new Set();
	for (const m of source.matchAll(/^[ \t]*(?:from[ \t]+([A-Za-z_][\w.]*)[ \t]+import\b|import[ \t]+([A-Za-z_][\w.]*(?:[ \t]+as[ \t]+\w+)?(?:[ \t]*,[ \t]*[A-Za-z_][\w.]*(?:[ \t]+as[ \t]+\w+)?)*))/gm)) {
		const list = m[1] ? [m[1]] : m[2].split(',').map((x) => x.trim().split(/\s+/)[0]);
		for (const x of list) mods.add(x.split('.')[0]);
	}
	return [...mods];
}

/** Import paths of a Go file, single (`import "x"`, `import alias "x"`) and grouped (`import ( ... )`). */
export function extractGoImports(source) {
	const paths = new Set();
	for (const block of source.matchAll(/^import\s*\(([\s\S]*?)\)/gm)) for (const m of block[1].matchAll(/"([^"\n]+)"/g)) paths.add(m[1]);
	for (const m of source.matchAll(/^import\s+(?:[\w.]+\s+)?"([^"\n]+)"/gm)) paths.add(m[1]);
	return [...paths];
}

export function extractImports(source) {
	const specs = new Set();
	const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"\n]+)['"]/gm;
	let m;
	while ((m = re.exec(source))) specs.add(m[1]);
	return [...specs];
}

// A pattern that is a whole package name, not a scope or prefix ("@vercel/kv", not "@vercel/").
const exactPattern = (p) => !/[/*]$/.test(p);

/**
 * Which mapped vendors and unmapped SDKs a list of dependencies of one ecosystem (npm, pypi, go) contains.
 * When one map names a package exactly and another only matches it by prefix, the exact one owns it:
 * @vercel/kv is Upstash's, even though Vercel's map claims the whole @vercel/ scope.
 */
export function matchDependencies(deps, signatures, kind = 'npm') {
	const field = ECOSYSTEM_FIELDS[kind];
	const exactOwner = new Map();
	for (const d of deps) for (const sig of signatures) if ((sig[field] ?? []).some((p) => exactPattern(p) && dependencyMatches(kind, d, [p]) && (kind !== 'npm' || d === p))) exactOwner.set(d, [...(exactOwner.get(d) ?? []), sig.id]);
	const vendors = [];
	for (const sig of signatures) {
		const hits = deps.filter((d) => dependencyMatches(kind, d, sig[field]) && (!exactOwner.has(d) || exactOwner.get(d).includes(sig.id)));
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

/**
 * Files of the repository worth reading, shallow ones first. `classify(rel, name)` says 'essential' (manifests, env,
 * config and infrastructure files: always listed), 'candidate' (source and YAML: listed up to limits.maxListed) or
 * null (not read, only counted). Past the limit the walk goes on for essential files, so a large tree loses
 * imports, never dependencies. Returns the files and how many files look like the project's own.
 */
function listFiles(root, limits, classify) {
	const files = [];
	let candidates = 0;
	let projectFiles = 0;
	let walked = 0;
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
			if (++walked > limits.maxWalked) {
				limits.truncated = true;
				return { files, projectFiles };
			}
			const rel = relative(root, full).split(sep).join('/');
			if (!(q === 0 && NON_PROJECT_FILES.test(e.name))) projectFiles++;
			const kind = classify(rel, e.name);
			if (!kind) continue;
			if (kind === 'candidate' && ++candidates > limits.maxListed) {
				limits.truncated = true;
				continue;
			}
			files.push(full);
		}
	}
	return { files, projectFiles };
}

function isFileSync(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

// Folders that hold test data, mocks and examples rather than the product. A vendor seen only there is reported
// under `samples`, not as part of the stack (a fixture repo inside tests is not the app's own Stripe).
const SAMPLE_DIR = /(?:^|\/)(?:fixtures?|__fixtures__|__mocks__|mocks?|examples?|samples?|testdata|tests?|__tests__|e2e|cypress|playwright)\//i;
const isSample = (rel) => SAMPLE_DIR.test(rel);

// Infrastructure files read by name: always listed, even past the file limit.
const INFRA_FILE = /^(Dockerfile(\..+)?|(docker-)?compose(\.[\w-]+)?\.ya?ml|.+\.tf|Chart\.yaml|(helmfile|skaffold|kustomization)\.ya?ml|Pulumi\.ya?ml|serverless\.ya?ml)$/;

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
	let scanned = 0;
	// Paths are listed first, then read in two passes: env files and manifests always, YAML and source until maxFiles
	// files were read. A large tree loses imports, never dependencies.
	const limits = { maxListed: maxFiles * 20, maxWalked: maxFiles * 200, truncated: false };
	const configNames = sigs.flatMap((sig) => sig.config_files);
	const classify = (rel, name) => {
		if (ENV_FILE.test(name) || manifestKind(rel) || INFRA_FILE.test(name)) return 'essential';
		if (configNames.some((cfg) => rel === cfg || rel.endsWith('/' + cfg))) return 'essential';
		return /\.ya?ml$/.test(name) || SOURCE_EXT.test(name) ? 'candidate' : null;
	};

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
	const listing = listFiles(root, limits, classify);
	for (const full of listing.files) {
		const rel = relative(root, full).split(sep).join('/');
		const name = basename(full);

		if (ENV_FILE.test(name)) {
			let names = [];
			try {
				names = readEnvNames(read(full));
			} catch {}
			for (const n of names) {
				if (!isSample(rel)) envNames.add(n);
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
			if (isSample(rel)) continue;
			for (const d of deps) {
				const key = Object.keys(FRAMEWORKS[manifest]).find((k) => dependencyMatches(manifest, d, [k]));
				const fw = key && FRAMEWORKS[manifest][key];
				if (fw && !frameworks.has(fw)) frameworks.set(fw, { name: fw, package: d, file: rel });
			}
			continue;
		}

		if (INFRA_FILE.test(name) && isSample(rel)) continue;
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
				if (!isSample(rel) && statSync(full).size < 256 * 1024 && isKubernetesManifest(read(full))) infra.push({ kind: 'kubernetes', file: rel });
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
		// Python and Go imports name the package itself, so they match like dependencies.
		const native = name.endsWith('.py') ? ['pypi', extractPythonModules(src)] : name.endsWith('.go') ? ['go', extractGoImports(src)] : null;
		if (native) for (const v of matchDependencies(native[1], sigs, native[0]).vendors) for (const p of v.packages) hit(sigs.find((x) => x.id === v.id), 'import', rel, p);
		// As for dependencies, a map that names the package beats one that only claims its scope (@vercel/kv is Upstash).
		const owners = new Map(specs.map(([, pkg]) => [pkg, sigs.filter((sig) => sig.imports.some((p) => !/[/:]$/.test(p) && (pkg === p || pkg.startsWith(p + '/')))).map((sig) => sig.id)]));
		for (const sig of sigs) {
			for (const [spec, pkg] of specs) if (importMatches(pkg, sig.imports) && (!owners.get(pkg).length || owners.get(pkg).includes(sig.id))) hit(sig, 'import', rel, spec);
			for (const [role, needles] of Object.entries(sig.role_signals ?? {})) {
				const needle = needles.find((n) => src.includes(n));
				if (needle) hit(sig, 'code', rel, needle, role);
			}
		}
	}

	const all = [...found.values()]
		// A role signal (".storage.from(") only says how a vendor found otherwise is used; on its own it is too generic.
		.filter(({ evidence }) => [...evidence.values()].some((e) => e.kind !== 'code'))
		.map(({ sig, evidence, roleHits }) => {
			// Roles with signals count only when a signal matched; other roles count once the vendor is present.
			const signalled = Object.keys(sig.role_signals ?? {});
			const roles_used = sig.roles.filter((r) => !signalled.includes(r) || roleHits.has(r));
			// Product code needs its own non-code evidence; a vendor that is a dependency only in fixtures is a sample.
			const product = [...evidence.values()].filter((e) => !isSample(e.file));
			const sample = !product.some((e) => e.kind !== 'code');
			return { id: sig.id, name: sig.name, roles: sig.roles, roles_used, evidence: pickEvidence(sample ? evidence.values() : product), sample };
		})
		.sort((a, b) => a.id.localeCompare(b.id));
	const vendors = all.filter((v) => !v.sample).map(({ sample, ...v }) => v);
	const samples = [
		...all.filter((v) => v.sample).map((v) => ({ id: v.id, name: v.name, evidence: v.evidence })),
		...[...unmapped.values()].filter((u) => u.evidence.every((e) => isSample(e.file))).map((u) => ({ name: u.name, evidence: u.evidence })),
	];
	const unmappedInProduct = [...unmapped.values()].filter((u) => !u.evidence.every((e) => isSample(e.file)));

	const byRole = new Map();
	for (const v of vendors) for (const r of v.roles_used) byRole.set(r, [...(byRole.get(r) ?? []), v.id]);
	for (const u of unmappedInProduct) if (u.role !== 'other') byRole.set(u.role, [...(byRole.get(u.role) ?? []), u.name]);
	const overlaps = [...byRole].filter(([, ids]) => ids.length > 1).map(([role, ids]) => ({ role, vendors: ids }));

	return {
		root,
		empty: listing.projectFiles === 0,
		scanned_files: scanned,
		truncated: limits.truncated,
		vendors,
		unmapped: unmappedInProduct,
		overlaps,
		frameworks: [...frameworks.values()],
		infra,
		env_names: [...envNames].sort(),
		samples,
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
	try {
		const signatures = vendorSignatures(loadCatalog(vendorsDir));
		printJson(detectVendors(args._[0] ?? '.', { signatures, maxFiles: Number(args['max-files']) || 5000, plugin: runsFromPlugin() }));
	} catch (e) {
		fail(e.message);
	}
}

if (isMain(import.meta.url)) detectMain(process.argv.slice(2)); // @main
