// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
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
	// requirements.txt, dev-requirements.in, requirements-test.txt: checked piece by piece, not with one pattern
	// that could backtrack over a long name.
	const lower = name.toLowerCase();
	if (/^[\w.-]+$/.test(name) && /\.(txt|in)$/.test(lower) && lower.slice(0, lower.lastIndexOf('.')).includes('requirements')) return 'pypi';
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

// A comment starts at "#" at the start of a line or after a blank ("stripe==7  # pinned"); "#egg=" in a URL is not one.
function stripHashComment(line) {
	for (let i = line.indexOf('#'); i !== -1; i = line.indexOf('#', i + 1)) {
		if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
	}
	return line;
}

function requirementsTxt(text) {
	const names = [];
	for (let line of text.split(/\r?\n/)) {
		line = stripHashComment(line).trim();
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

/** "[tool.poetry.dependencies]" or "[[tool.uv.index]]", with blanks, quotes or a comment after it → the table name. */
function tomlHeader(line) {
	const t = line.trim();
	if (!t.startsWith('[')) return null;
	const open = t.startsWith('[[') ? 2 : 1;
	const close = t.indexOf(']', open);
	if (close === -1) return null;
	const name = t.slice(open, close).trim();
	const rest = t.slice(t[close + 1] === ']' ? close + 2 : close + 1).trim();
	return name && (!rest || rest.startsWith('#')) ? name : null;
}

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
		const header = tomlHeader(line);
		if (header) {
			table = header.replace(/["'\s]/g, '');
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
		const c = raw.indexOf('//');
		// go mod writes "// indirect" as the comment of a dependency it pulled in for another one.
		const indirect = c !== -1 && /^\s*indirect\b/.test(raw.slice(c + 2));
		const line = (c === -1 ? raw : raw.slice(0, c)).trim();
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
function readEnvNames(text) {
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
function extractPythonModules(source) {
	const mods = new Set();
	for (const m of source.matchAll(/^[ \t]*(?:from[ \t]+([A-Za-z_][\w.]*)[ \t]+import\b|import[ \t]+([A-Za-z_][\w.]*(?:[ \t]+as[ \t]+\w+)?(?:[ \t]*,[ \t]*[A-Za-z_][\w.]*(?:[ \t]+as[ \t]+\w+)?)*))/gm)) {
		const list = m[1] ? [m[1]] : m[2].split(',').map((x) => x.trim().split(/\s+/)[0]);
		for (const x of list) mods.add(x.split('.')[0]);
	}
	return [...mods];
}

/** Import paths of a Go file, single (`import "x"`, `import alias "x"`) and grouped (`import ( ... )`). */
function extractGoImports(source) {
	const paths = new Set();
	for (const block of source.matchAll(/^import\s*\(([\s\S]*?)\)/gm)) for (const m of block[1].matchAll(/"([^"\n]+)"/g)) paths.add(m[1]);
	for (const m of source.matchAll(/^import\s+(?:[\w.]+\s+)?"([^"\n]+)"/gm)) paths.add(m[1]);
	return [...paths];
}

function extractImports(source) {
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
function matchDependencies(deps, signatures, kind = 'npm') {
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
function importMatches(spec, patterns = []) {
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
function hookStatus(root, { plugin = false } = {}) {
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

function detectVendors(root, { signatures, maxFiles = 5000, plugin = false } = {}) {
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

function detectMain(argv) {
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

// ---- packages/core/src/workdir.mjs
// Everything Manifestack writes in a project lives in one folder, .manifestack/ at the repository root:
//   .manifestack/STACK.md   decisions, committed with the code
//   .manifestack/tmp/       working files such as cost models, ignored by git

const WORK_DIR = '.manifestack';
const STACK_FILE = `${WORK_DIR}/STACK.md`;
const TMP_DIR = `${WORK_DIR}/tmp`;

/** Creates the folder a file goes into. Inside .manifestack/tmp it also adds a .gitignore that ignores the folder. */
function ensureWorkDir(file) {
	const dir = dirname(file);
	mkdirSync(dir, { recursive: true });
	ignoreTmpDir(dir);
}

/** Adds .manifestack/tmp/.gitignore when `dir` is that folder and the file is missing. Never writes through a symlink. */
function ignoreTmpDir(dir) {
	const abs = resolve(dir);
	if (basename(abs) !== 'tmp' || basename(dirname(abs)) !== WORK_DIR) return;
	const ignore = join(abs, '.gitignore');
	try {
		if (!lstatSync(abs).isDirectory()) return;
		lstatSync(ignore);
		return; // already there (a file, or a symlink we leave alone)
	} catch (e) {
		if (e.code !== 'ENOENT') throw e;
	}
	try {
		// wx: fails instead of following a symlink created in the meantime.
		writeFileSync(ignore, '*\n', { flag: 'wx' });
	} catch (e) {
		if (e.code !== 'EEXIST' && e.code !== 'ENOENT') throw e;
	}
}

/** True when `file` resolves (symlinks included) to a path inside the current directory. */
function withinCwd(file) {
	const root = realpathSync(process.cwd());
	let p = resolve(file);
	const rest = [];
	for (;;) {
		let exists = true;
		try {
			lstatSync(p);
		} catch {
			exists = false;
		}
		if (exists) {
			try {
				p = realpathSync(p);
			} catch {
				return false; // dangling symlink: a write would land wherever it points
			}
			break;
		}
		const parent = dirname(p);
		if (parent === p) return false;
		rest.unshift(basename(p));
		p = parent;
	}
	const rel = relative(root, join(p, ...rest));
	return rel !== '' && !isAbsolute(rel) && rel.split(sep)[0] !== '..';
}

// ---- packages/core/src/project.mjs
// Cost and limit projections. Prices are inputs: the skill reads them from vendor pages at run time.
// Sizes are decimal (1 GB = 1000 MB), as vendors bill them. Money is USD. No network.

const SIZE_UNITS = { B: 1e-6, KB: 1e-3, MB: 1, GB: 1e3, TB: 1e6 };
const PERIOD_DAYS = { day: 1, d: 1, week: 7, wk: 7, w: 7, month: 30.4375, mo: 30.4375, year: 365.25, yr: 365.25 };
const DAY_MS = 86400000;
/** A plain number on a metric named *_mb, *_gb or *_tb is in that unit; this is the unit in MB. */
const METRIC_UNIT_MB = { mb: 1, gb: 1e3, tb: 1e6 };

/**
 * Parses "312 MB", "+1.1 MB/day", "$25/mo", "41,200", "9k", "18%/mo", "3.4 TB".
 * Thousands are grouped in threes by ",", "_" or a space: "1,5 GB" is an error, not 15 GB.
 * Returns { value, dim, per } where value is in base units (MB for size, USD for money, 1 for count,
 * percent for pct) and `per` is the period in days for rates (null otherwise).
 */
function parseQuantity(input) {
	if (typeof input === 'number') return { value: input, dim: 'count', per: null };
	// Runs of spaces become one, so the optional parts below cannot backtrack over a long gap.
	const s = String(input).trim().replace(/\s+/g, ' ');
	if (s.length > 64) throw new Error(`cannot read quantity "${s.slice(0, 24)}…": too long`);
	const m = /^([+-])?\s*(\$)?\s*(\d{1,3}(?:([, _])\d{3})(?:\4\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*([kKmM](?![bB]))?\s*(%|[KMGT]?B\b)?\s*(?:\/\s*(day|d|week|wk|w|month|mo|year|yr))?$/i.exec(s);
	if (!m) throw new Error(`cannot read quantity "${input}"`);
	const [, sign, dollar, num, , mult, unit, period] = m;
	let value = Number(num.replace(/[, _]/g, ''));
	if (mult) value *= /k/i.test(mult) ? 1e3 : 1e6;
	let dim = 'count';
	if (dollar) dim = 'money';
	if (unit === '%') dim = 'pct';
	else if (unit) {
		dim = 'size';
		value *= SIZE_UNITS[unit.toUpperCase()];
	}
	if (sign === '-') value = -value;
	return { value, dim, per: period ? PERIOD_DAYS[period.toLowerCase()] : null };
}

function formatSize(mb) {
	if (Math.abs(mb) >= 1e6) return `${round(mb / 1e6, 2)} TB`;
	if (Math.abs(mb) >= 1e3) return `${round(mb / 1e3, 2)} GB`;
	return `${round(mb, 2)} MB`;
}

// The factor nudges values like 1.005, stored as 1.00499…, to round half up as written.
function round(n, digits = 2) {
	const f = 10 ** digits;
	return Math.round(n * f * (1 + Number.EPSILON)) / f;
}

/** A compounding rate over `perDays` as a monthly fraction: 10%/week is (1.1^(30.4375/7) − 1), about 51% a month, not 43%. */
function monthlyGrowth(pct, perDays = PERIOD_DAYS.mo) {
	return (1 + pct / 100) ** (PERIOD_DAYS.mo / perDays) - 1;
}

// null past year 9999: such a date means "not on this trend", and toISOString cannot write it as YYYY-MM-DD.
function addDays(iso, days) {
	const d = new Date(Date.parse(iso + 'T00:00:00Z') + Math.round(days) * DAY_MS);
	if (!Number.isFinite(d.getTime()) || d.getUTCFullYear() > 9999) return null;
	return d.toISOString().slice(0, 10);
}

/** "~Mar 2027", the form findings use for `when`. */
function approxMonth(iso) {
	const d = new Date(iso + 'T00:00:00Z');
	return `~${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

/** Overage on published rates: max(0, used - included) / per × price. */
function overage({ used, included = 0, price, per = 1 }) {
	const over = Math.max(0, used - included);
	return { over, cost: round((over / per) * price, 2) };
}

/** Least-squares slope in units per day from [{ date, value }]. Needs two points or more. */
function linearRate(points) {
	if (points.length < 2) throw new Error('a growth rate needs two data points');
	for (const p of points) if (!isIsoDate(p.date)) throw new Error(`data point dates must be YYYY-MM-DD, got "${p.date}"`);
	const xs = points.map((p) => Date.parse(p.date + 'T00:00:00Z') / DAY_MS);
	const ys = points.map((p) => p.value);
	const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
	const my = ys.reduce((a, b) => a + b, 0) / ys.length;
	let num = 0;
	let den = 0;
	for (let k = 0; k < xs.length; k++) {
		num += (xs[k] - mx) * (ys[k] - my);
		den += (xs[k] - mx) ** 2;
	}
	if (!den) throw new Error('data points need different dates');
	return num / den;
}

/**
 * When does `current` reach `limit`?
 * Linear: ratePerDay (or points). Compounding: growthPerMonth as a fraction (0.18 for +18%/mo).
 */
function eta({ current, limit, ratePerDay, growthPerMonth, points, from = todayIso() }) {
	if (points?.length) {
		ratePerDay = linearRate(points);
		const last = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
		current = last.value;
		from = last.date;
	}
	if (!isIsoDate(from)) throw new Error(`eta: the start date must be YYYY-MM-DD, got "${from}"`);
	const base = { current, limit, from };
	if (current >= limit) return { ...base, reached: true, days: 0, date: from, when: 'Now' };
	let days;
	let method;
	if (growthPerMonth != null) {
		// Growth from zero never gets anywhere.
		if (growthPerMonth <= 0 || current <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'compound' };
		days = (Math.log(limit / current) / Math.log(1 + growthPerMonth)) * PERIOD_DAYS.mo;
		method = 'compound';
	} else if (ratePerDay != null) {
		if (ratePerDay <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'linear' };
		days = (limit - current) / ratePerDay;
		method = 'linear';
	} else {
		throw new Error('eta needs a rate, a monthly growth or two data points');
	}
	const date = Number.isFinite(days) ? addDays(from, days) : null;
	if (!date) return { ...base, reached: false, method, rate_per_day: ratePerDay ?? null, days: null, date: null, when: 'Not on current trend' };
	return { ...base, reached: false, method, rate_per_day: ratePerDay ?? null, days: Math.round(days), weeks: round(days / 7, 1), date, when: `ETA ${approxMonth(date)}` };
}

/**
 * Prices a stack at several user counts. Model (all prices come from vendor pages read at run time):
 * { users: [1000, 10000, 100000],
 *   vendors: [{ id, per_user: { transfer_gb: 0.05 }, fixed: { seats: 1 },
 *     plans: [{ name, base, credit?, eligible?, metrics: { transfer_gb: { included, price?, per?, hard? } } }] }] }
 * `credit` is usage credit included in the plan each month: it pays for overage, never for `base`.
 * Numbers are in the metric's unit (transfer_gb in GB); strings may carry one ("100 GB", "$0.15", "50k").
 * For each count the cheapest eligible plan whose hard limits hold is picked.
 */
function costAt(model) {
	const { users, vendors: list } = normalizeModel(model);
	return users.map((n) => {
		const vendors = list.map((v) => priceVendor(v, n));
		const monthly = round(vendors.reduce((sum, v) => sum + (v.cost ?? 0), 0), 2);
		return { users: n, monthly, yearly: round(monthly * 12, 2), complete: vendors.every((v) => v.plan), vendors };
	});
}

function modelNumber(v, metric, where) {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v !== 'string') throw new Error(`${where}: expected a number or a string such as "100 GB", got ${JSON.stringify(v)}`);
	let qv;
	try {
		qv = parseQuantity(v);
	} catch {
		throw new Error(`${where}: cannot read "${v}"`);
	}
	if (qv.per != null && qv.per !== PERIOD_DAYS.mo) throw new Error(`${where}: "${v}" is not monthly; the model is per month`);
	if (qv.dim === 'pct') throw new Error(`${where}: "${v}" is a percentage, expected an amount`);
	if (qv.dim !== 'size') return qv.value;
	const unit = /_(mb|gb|tb)$/.exec(metric ?? '')?.[1];
	if (!unit) throw new Error(`${where}: "${v}" is a size; name the metric *_mb, *_gb or *_tb, or give a plain number`);
	return qv.value / METRIC_UNIT_MB[unit];
}

// Turns every number of the model into a plain number in the metric's unit, or fails naming the field.
function normalizeModel(model) {
	if (!model || typeof model !== 'object' || Array.isArray(model)) throw new Error('the model must be an object: { users, vendors }');
	const users = [].concat(model.users ?? [1000, 10000, 100000]).map((n, i) => modelNumber(n, null, `users[${i}]`));
	const perMetric = (obj, where) => Object.fromEntries(Object.entries(obj ?? {}).map(([m, x]) => [m, modelNumber(x, m, `${where}.${m}`)]));
	const vendors = [].concat(model.vendors ?? []).map((v, vi) => {
		const at = `vendor ${v?.id ?? vi}`;
		const plans = [].concat(v.plans ?? []).map((p, pi) => {
			const pat = `${at} plan ${p?.name ?? pi}`;
			const metrics = {};
			for (const [m, r] of Object.entries(p.metrics ?? {})) {
				const per = r.per == null ? 1 : modelNumber(r.per, m, `${pat} ${m}.per`);
				if (!(per > 0)) throw new Error(`${pat} ${m}.per must be above 0`);
				const included = r.included == null ? 0 : modelNumber(r.included, m, `${pat} ${m}.included`);
				const price = r.price == null ? null : modelNumber(r.price, null, `${pat} ${m}.price`);
				metrics[m] = { ...r, included, price, per };
			}
			const credit = p.credit == null ? 0 : modelNumber(p.credit, null, `${pat} credit`);
			if (credit < 0) throw new Error(`${pat} credit must not be negative`);
			return { ...p, base: p.base == null ? 0 : modelNumber(p.base, null, `${pat} base`), credit, metrics };
		});
		return { ...v, per_user: perMetric(v.per_user, `${at} per_user`), fixed: perMetric(v.fixed, `${at} fixed`), plans };
	});
	return { users, vendors };
}

function priceVendor(v, users) {
	const usage = {};
	for (const [metric, perUser] of Object.entries(v.per_user)) usage[metric] = perUser * users;
	for (const [metric, fixed] of Object.entries(v.fixed)) usage[metric] = (usage[metric] ?? 0) + fixed;
	const options = [];
	for (const plan of v.plans) {
		if (plan.eligible === false) continue;
		let over = 0;
		let fits = true;
		const lines = [];
		for (const [metric, rule] of Object.entries(plan.metrics)) {
			const used = usage[metric] ?? 0;
			const included = rule.included;
			if (used > included && (rule.hard || rule.price == null)) {
				fits = false;
				break;
			}
			if (rule.price != null && used > included) {
				const o = overage({ used, included, price: rule.price, per: rule.per });
				over += o.cost;
				lines.push({ metric, used: round(used, 2), included, over: round(o.over, 2), cost: o.cost });
			}
		}
		const credit = Math.min(plan.credit, over);
		if (fits) options.push({ plan: plan.name, cost: round(plan.base + over - credit, 2), overage: lines, ...(credit ? { credit_used: round(credit, 2) } : {}) });
	}
	options.sort((a, b) => a.cost - b.cost);
	const usageRounded = Object.fromEntries(Object.entries(usage).map(([k, x]) => [k, round(x, 2)]));
	if (!options.length) return { id: v.id, plan: null, cost: null, usage: usageRounded, note: 'exceeds every listed plan: read the next tier or contact sales' };
	return { id: v.id, ...options[0], usage: usageRounded };
}

function q(args, key) {
	if (args[key] == null) return undefined;
	if (typeof args[key] !== 'string') throw new Error(`--${key} needs one value`);
	return parseQuantity(args[key]);
}

// "2026-09-06=41,200;2026-10-06=43,000": a comma separates points only when a date follows it.
function splitPoints(s) {
	const parts = String(s).split(/([;,])/); // pieces and separators, alternating
	const out = [];
	let current = parts[0];
	for (let i = 1; i < parts.length; i += 2) {
		if (/^\s*\d{4}-\d{2}-\d{2}\s*=/.test(parts[i + 1])) {
			out.push(current.trim());
			current = parts[i + 1];
		} else current += parts[i] + parts[i + 1];
	}
	out.push(current.trim());
	return out;
}

function readPoints(list) {
	return [].concat(list).flatMap(splitPoints).map((p) => {
		const eq = p.indexOf('=');
		const date = p.slice(0, Math.max(eq, 0)).trim();
		if (eq < 1 || !isIsoDate(date)) throw new Error(`--points expects YYYY-MM-DD=value, got "${p}"`);
		const qv = parseQuantity(p.slice(eq + 1));
		return { date, value: qv.value, dim: qv.dim };
	});
}

const sameKind = (what, a, limit) => {
	if (a.dim !== limit.dim) throw new Error(`${what} is a ${a.dim} but --limit is a ${limit.dim}: give both in the same kind of unit`);
};

const USAGE = `usage:
  node project.mjs eta --current "312 MB" --limit "500 MB" --rate "1.1 MB/day" [--from 2026-10-06]
  node project.mjs eta --current 41200 --limit 50000 --growth "18%/mo"
  node project.mjs eta --points "2026-09-06=280 MB;2026-10-06=312 MB" --limit "500 MB"   (or repeat --points)
  node project.mjs overage --used "3.4 TB" --included "1 TB" --price 0.15 --per GB
  node project.mjs overage --used 60000 --included 50000 --price '$0.90' --per 1000
  node project.mjs cost <.manifestack/tmp/model.json | ->
Prints JSON. Prices are inputs: read them from the vendor page first.
A size needs a unit and is priced --per a size unit (GB); a count is priced --per a number (1000).`;

function projectMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	try {
		if (args.help) {
			process.stdout.write(USAGE + '\n');
			return;
		}
		if (cmd === 'eta') {
			const limit = q(args, 'limit');
			if (!limit) throw new Error('--limit is required');
			const input = { limit: limit.value, from: dateArg(args, 'from', todayIso()) };
			if (args.points != null) {
				if (args.points === true) throw new Error('--points needs YYYY-MM-DD=value pairs');
				input.points = readPoints(args.points);
				for (const p of input.points) sameKind(`--points ${p.date}`, p, limit);
			} else {
				const current = q(args, 'current');
				if (!current) throw new Error('--current or --points is required');
				if (current.dim !== limit.dim) throw new Error(`--current is a ${current.dim} but --limit is a ${limit.dim}: give both in the same kind of unit`);
				input.current = current.value;
				if (args.growth) {
					const g = q(args, 'growth');
					// "18%/mo" or the fraction 0.18; a bare 18 would be 1800% a month.
					if (g.dim === 'pct') input.growthPerMonth = monthlyGrowth(g.value, g.per ?? PERIOD_DAYS.mo);
					else if (g.dim === 'count' && g.value > 0 && g.value < 1 && g.per == null) input.growthPerMonth = g.value;
					else throw new Error('--growth is a percentage with a period, such as "18%/mo" or "4%/week"');
				} else if (args.rate) {
					const r = q(args, 'rate');
					if (r.dim === 'pct') throw new Error('--rate is an amount per period ("1.1 MB/day"); for a percentage use --growth');
					if (r.per == null) throw new Error('--rate needs a period, such as "1.1 MB/day" or "300/week"');
					sameKind('--rate', r, limit);
					input.ratePerDay = r.value / r.per;
				}
			}
			printJson(eta(input));
		} else if (cmd === 'overage') {
			// --per GB (price per unit of size) or --per 1000 (price per thousand of a count)
			const used = q(args, 'used');
			const price = q(args, 'price');
			if (!used || !price) throw new Error('--used and --price are required');
			if (used.dim !== 'size' && used.dim !== 'count') throw new Error('--used is an amount: a size such as "3.4 TB" or a count such as 60000');
			if ((price.dim !== 'money' && price.dim !== 'count') || price.per != null || price.value < 0) throw new Error("--price is the price of one --per unit, such as 0.15 or '$0.15'");
			const included = q(args, 'included') ?? { value: 0, dim: used.dim };
			if (included.dim !== used.dim && included.value !== 0) throw new Error(`--used is a ${used.dim} but --included is a ${included.dim}: give both with units ("3.4 TB", "1 TB") or both as counts`);
			let per = { value: 1, dim: 'count' };
			if (args.per != null) {
				if (typeof args.per !== 'string') throw new Error('--per needs one value: a size unit (GB) or a number (1000)');
				per = parseQuantity(/^[\d.]/.test(args.per) ? args.per : `1 ${args.per}`);
			}
			if (used.dim === 'size' && per.dim !== 'size') throw new Error('--used is a size: pass --per with a size unit, such as --per GB');
			if (used.dim === 'count' && per.dim !== 'count') throw new Error(`--per ${args.per} is a size but --used is a count: give --used and --included with units, such as "3.4 TB"`);
			if (!(per.value > 0)) throw new Error('--per must be above 0');
			const r = overage({ used: used.value, included: included.value, price: price.value, per: per.value });
			const unit = args.per == null ? 'unit' : String(args.per);
			printJson({ over: round(r.over / per.value, 2), unit, price: price.value, monthly: r.cost, yearly: round(r.cost * 12, 2) });
		} else if (cmd === 'cost') {
			const file = args._[1];
			if (!file) throw new Error('pass a model file or - for stdin');
			// The model is a working file: .manifestack/tmp is kept out of git before anything can fail.
			if (file !== '-') ignoreTmpDir(dirname(file));
			else if (existsSync(TMP_DIR)) ignoreTmpDir(TMP_DIR);
			let model;
			try {
				model = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'));
			} catch (e) {
				throw new Error(e instanceof SyntaxError ? `${file === '-' ? 'stdin' : file} is not valid JSON` : e.message);
			}
			printJson(costAt(model));
		} else {
			process.stdout.write(USAGE + '\n');
			if (cmd && cmd !== 'help') process.exitCode = 1;
		}
	} catch (e) {
		fail(e.message);
	}
}

// ---- packages/core/src/stack-md.mjs
// Reads and updates .manifestack/STACK.md, evaluates `revisit_when` and keeps secrets out of the file.
// Updates touch only the named fields: other lines, unknown keys and user comments stay as they are.

const STACK_ROLES = ['Hosting', 'Database', 'Auth', 'Email', 'Storage', 'Payments', 'Monitoring', 'AI', 'Other'];
const STACK_KEYS = ['plan', 'limit', 'source', 'usage', 'decided', 'revisit_when', 'next', 'env'];
const REQUIREMENT_KEYS = ['budget', 'users', 'requires', 'prefer', 'avoid', 'priority'];
const PRIORITIES = ['lowest cost', 'balanced', 'least ops', 'control'];
// Metrics lint knows without a reading in `usage`; the numeric usage metrics of the vendor maps are among them.
const REVISIT_METRICS = [
	'db_size', 'monthly_sent', 'daily_peak', 'transfer_tb', 'mau', 'users', 'monthly_bill', 'date',
	'egress_gb', 'storage_gb', 'cdn_requests', 'function_invocations', 'compute_hours', 'cpu_hours', 'seats', 'logs_ingested_gb',
	'monthly_events', 'monthly_errors', 'monthly_spans', 'monthly_replays', 'monthly_recordings', 'monthly_tokens', 'monthly_revenue', 'monthly_volume', 'monthly_commands', 'transactions',
];

// Env var names (NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL) and URL slugs (2024-11-05-pro-plan-pricing-update) are made of
// words, numbers and short parts like R2 or v2. A key has at least one long part that mixes letters and digits.
function looksRandom(token) {
	// Stripe object ids (price_…, prod_…) identify things; they are not secrets.
	if (/^(?:price|prod|plan|cus|sub|acct|evt|pi|ch|in|si|txn|po|tr|seti|pm)_[A-Za-z0-9]+$/.test(token)) return false;
	const parts = token.split(/[-_]+/).filter(Boolean);
	if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(token) && parts.every((p) => p.length <= 12)) return false;
	return !parts.every((p) => /^(?:[A-Za-z]+|\d+)$/.test(p) || p.length <= 4);
}

// re_engagement_campaigns is a name; re_ followed by digits or mixed case is a Resend key.
const isResendKey = (m) => {
	const body = m.slice(3).replace(/_/g, '');
	return (/\d/.test(body) && /[A-Za-z]/.test(body)) || (/[a-z]/.test(body) && /[A-Z]/.test(body));
};

// A value after a key=, key: or "key": looks like a password when it mixes letters with digits or cases; an env
// var name (STRIPE_SECRET_KEY) or a plain word is not one.
const isCredentialValue = (m) => {
	const v = m[1] ?? '';
	if (/^[A-Z][A-Z0-9_]*$/.test(v) || /^\$\{?[A-Za-z_]/.test(v) || /^<.*>$/.test(v)) return false;
	return (/\d/.test(v) && /[A-Za-z]/.test(v)) || (/[a-z]/.test(v) && /[A-Z]/.test(v));
};

// A commit hash, digest or UUID as a segment of a URL path (github.com/o/r/blob/<sha>/x.md) names a version, not a
// secret. Alone, the same shapes can be keys (old GitHub tokens are 40 hex characters), so they still count.
const inUrlPath = (m) => m.input[m.index - 1] === '/' && /^(?:[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(m[0]);

// 40 characters of base64 with both cases and a digit: an AWS secret access key and its kind.
const isMixedBase64 = (m) => /[a-z]/.test(m[0]) && /[A-Z]/.test(m[0]) && /\d/.test(m[0]);

const SECRET_PATTERNS = [
	['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
	// redis://:password@host has no user; the password may not contain "/" (that would be a path).
	['URL with credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]*:[^\s@/]+@[^\s@]+/i],
	['API key (sk_/pk_/rk_)', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/],
	['Supabase key', /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/],
	['Resend key', /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{8,}(?![A-Za-z0-9_])|\bre_[A-Za-z0-9]{24,}\b/, (m) => isResendKey(m[0])],
	['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/],
	['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
	['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
	['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
	['Neon API key', /\bnapi_[A-Za-z0-9]{16,}/],
	// Only names that usually hold secrets: NODE_ENV=production in a note is fine.
	['env assignment', /\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|DSN|CREDENTIALS?|PRIVATE)[A-Z0-9_]*\s*=\s*['"]?[^\s'"]{6,}/],
	// db_password: Sup3rS3cret, "apiKey": "…", stripe_secret_key=… (any case, = or :).
	['credential', /\b[A-Za-z0-9_]*(?:key|secret|token|password|passwd|pwd|credentials?)["']?\s*[:=]\s*['"]?([^\s'",;]{6,})/i, isCredentialValue],
	['AWS secret key', /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])/, isMixedBase64],
	['long token', /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/, (m) => !inUrlPath(m) && looksRandom(m[0])],
].map(([kind, re, check]) => [kind, new RegExp(re.source, re.flags + 'g'), check]);

const secretIn = (line, re, check) => [...line.matchAll(re)].some((m) => !check || check(m));

/** Finds strings that look like secrets, one hit per line. STACK.md must never contain one. */
function findSecrets(text) {
	const hits = [];
	text.split(/\r?\n/).forEach((line, idx) => {
		const hit = SECRET_PATTERNS.find(([, re, check]) => secretIn(line, re, check));
		if (hit) hits.push({ line: idx + 1, kind: hit[0] });
	});
	return hits;
}

function scrubSecrets(text) {
	let out = text;
	for (const [, re, check] of SECRET_PATTERNS) {
		// replace() passes (match, ...groups, offset, input): rebuild the match object the checks expect.
		out = out.replace(re, (...a) => {
			const m = Object.assign(a.slice(0, -2), { index: a.at(-2), input: a.at(-1) });
			return !check || check(m) ? '[removed]' : m[0];
		});
	}
	return out;
}

const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

// Lines with their own endings, so an update keeps a file's CRLF/LF mix as it is.
function splitLines(text) {
	const lines = [];
	const ends = [];
	const re = /\r?\n/g;
	let last = 0;
	for (let m; (m = re.exec(text)); last = re.lastIndex) {
		lines.push(text.slice(last, m.index));
		ends.push(m[0]);
	}
	if (last < text.length) {
		lines.push(text.slice(last));
		ends.push('');
	}
	return { lines, ends };
}

function dominantEol(text) {
	const crlf = (text.match(/\r\n/g) ?? []).length;
	return crlf > (text.match(/\n/g) ?? []).length - crlf ? '\r\n' : '\n';
}

// A comment starts at two or more spaces and "#": in "use plan #2 for now" the # is part of the value.
// Scanned by hand: a regex for "two blanks, then #" backtracks quadratically over a long run of spaces.
const isBlank = (c) => c === ' ' || c === '\t';
function splitComment(raw) {
	for (let i = raw.indexOf('#'); i !== -1; i = raw.indexOf('#', i + 1)) {
		let start = i;
		while (start > 0 && isBlank(raw[start - 1])) start--;
		if (i - start < 2) continue;
		const text = raw.slice(isBlank(raw[i + 1]) ? i + 2 : i + 1);
		return { value: raw.slice(0, start).trim(), comment: text.trim(), commentRaw: raw.slice(start).trimEnd() };
	}
	return { value: raw.trim(), comment: null, commentRaw: '' };
}

/** "## Database: Supabase ##" → "Database: Supabase". A closing run of # needs a blank before it: "## Other: C#" names C#. */
function headingText(line) {
	if (!line.startsWith('##') || !isBlank(line[2] ?? '')) return null;
	const text = line.slice(3).trim();
	let end = text.length;
	while (end > 0 && text[end - 1] === '#') end--;
	return end < text.length && end > 0 && isBlank(text[end - 1]) ? text.slice(0, end).trimEnd() : text || null;
}

/** "Database: Supabase" → role and vendor, or null when the heading is not "<Role>: <Vendor>". */
function roleAndVendor(heading) {
	const colon = heading.indexOf(':');
	if (colon < 1) return null;
	const role = heading.slice(0, colon).trim();
	const vendor = heading.slice(colon + 1).trim();
	return /^[A-Za-z][A-Za-z ]*$/.test(role) && vendor ? { role, vendor } : null;
}

function scanSections(lines) {
	const sections = [];
	let current = null;
	let fence = null;
	let comment = false;
	lines.forEach((line, idx) => {
		// Text inside <!-- --> is not part of the document (the template keeps its example there).
		if (comment) {
			if (line.includes('-->')) comment = false;
			return;
		}
		// A fence closes only with the same character, at least as long and with nothing after it (CommonMark), so
		// a ``` line inside a ~~~ block or a ```` block does not end it.
		const fm = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		if (fence) {
			if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length && !fm[2].trim()) fence = null;
			return;
		}
		if (fm && !(fm[1][0] === '`' && fm[2].includes('`'))) {
			fence = fm[1];
			return;
		}
		// Only a line that starts with <!-- opens a comment block (as in Markdown); "<!--" inside a value is text.
		if (/^\s*<!--/.test(line)) {
			if (!line.includes('-->', line.indexOf('<!--') + 4)) comment = true;
			return;
		}
		const heading = headingText(line);
		if (heading) {
			const rv = roleAndVendor(heading);
			current = {
				heading,
				headingLine: idx,
				kind: /^requirements$/i.test(heading) ? 'requirements' : rv ? 'service' : 'other',
				role: rv?.role ?? null,
				vendor: rv?.vendor ?? null,
				fields: {},
			};
			sections.push(current);
			return;
		}
		if (/^#\s/.test(line)) {
			current = null;
			return;
		}
		if (!current) return;
		const f = /^([a-z_][a-z0-9_]*)\s*:(.*)$/.exec(line);
		if (f && !(f[1] in current.fields)) current.fields[f[1]] = { idx, ...splitComment(f[2]) };
	});
	return sections;
}

function parseStackMd(text) {
	const sections = scanSections(splitLines(stripBom(text)).lines);
	const values = (s) => Object.fromEntries(Object.entries(s.fields).map(([k, v]) => [k, v.value]));
	const req = sections.find((s) => s.kind === 'requirements');
	return {
		requirements: req ? values(req) : null,
		sections: sections.map((s) => ({ heading: s.heading, kind: s.kind, role: s.role, vendor: s.vendor, line: s.headingLine + 1, values: values(s), comments: Object.fromEntries(Object.entries(s.fields).filter(([, v]) => v.comment).map(([k, v]) => [k, v.comment])) })),
	};
}

// "Database:Supabase", "database :  supabase" and "Database: Supabase" name the same section.
const normalizeHeading = (h) => {
	const s = String(h).trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ');
	const colon = s.indexOf(':');
	return colon === -1 ? s : `${s.slice(0, colon).trimEnd()}: ${s.slice(colon + 1).trimStart()}`.trimEnd();
};
const sameHeading = (a, b) => normalizeHeading(a).toLowerCase() === normalizeHeading(b).toLowerCase();

/**
 * Sets fields in one section, creating the section if needed.
 * `updates` is { key: value }, `comments` is { key: comment }: an existing comment is kept unless replaced,
 * "" removes it, and a comment for a key without an update comments the existing line.
 */
function setFields(text, heading, updates, comments = {}) {
	if (/[\r\n]/.test(String(heading))) throw new Error('section name must be one line');
	heading = normalizeHeading(heading);
	if (!heading) throw new Error('section name is empty');
	if (/^[^:]+:\s*$/.test(heading)) throw new Error(`section "${heading}" names no vendor after the colon`);
	for (const [k, v] of Object.entries(updates)) {
		if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`invalid key "${k}"`);
		if (/[\r\n]/.test(String(v))) throw new Error(`value for ${k} must be one line`);
		if (findSecrets(`${k}: ${v}`).length) throw new Error(`value for ${k} looks like a secret; STACK.md must not contain secrets`);
	}
	for (const [k, c] of Object.entries(comments)) {
		if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`invalid key "${k}"`);
		if (/[\r\n]/.test(String(c))) throw new Error(`comment for ${k} must be one line`);
		if (findSecrets(String(c)).length) throw new Error(`comment for ${k} looks like a secret; STACK.md must not contain secrets`);
	}
	const src = stripBom(text);
	const eol = dominantEol(src);
	const { lines, ends } = splitLines(src);
	let section = scanSections(lines).find((s) => sameHeading(s.heading, heading));
	const keys = [...new Set([...Object.keys(updates), ...Object.keys(comments)])];
	for (const key of keys) if (!(key in updates) && !section?.fields[key]) throw new Error(`cannot comment on ${key}: section "${heading}" has no ${key} line (set a value too)`);
	if (!section) {
		while (lines.length && !lines.at(-1).trim()) {
			lines.pop();
			ends.pop();
		}
		if (lines.length) {
			ends[ends.length - 1] ||= eol;
			lines.push('');
			ends.push(eol);
		}
		lines.push(`## ${heading}`);
		ends.push(eol);
		section = { headingLine: lines.length - 1, fields: {} };
	}
	for (const key of keys) {
		const existing = section.fields[key];
		// Two spaces and # would start a comment when the file is read back.
		const value = key in updates ? String(updates[key]).trim().replace(/[ \t]{2,}#/g, ' #') : existing.value;
		const c = comments[key] == null ? null : String(comments[key]).trim();
		const comment = c == null ? (existing?.commentRaw ?? '') : c ? `  # ${c}` : '';
		const line = `${key}:${value ? ` ${value}` : ''}${comment}`;
		if (existing) {
			lines[existing.idx] = line;
			continue;
		}
		const at = insertionIndex(section, key);
		if (at > 0 && !ends[at - 1]) ends[at - 1] = eol;
		lines.splice(at, 0, line);
		ends.splice(at, 0, eol);
		// Re-read positions after the insert.
		section = scanSections(lines).find((s) => s.headingLine === section.headingLine);
	}
	if (ends.length && !ends.at(-1)) ends[ends.length - 1] = eol;
	return lines.map((l, i) => l + ends[i]).join('');
}

function insertionIndex(section, key) {
	const keys = Object.keys(section.fields);
	const order = [...REQUIREMENT_KEYS, ...STACK_KEYS];
	const pos = order.indexOf(key);
	if (pos !== -1) {
		const before = keys.filter((k) => order.indexOf(k) !== -1 && order.indexOf(k) < pos).sort((a, b) => section.fields[a].idx - section.fields[b].idx);
		if (before.length) return section.fields[before.at(-1)].idx + 1;
		const after = keys.filter((k) => order.indexOf(k) > pos).sort((a, b) => section.fields[a].idx - section.fields[b].idx);
		if (after.length) return section.fields[after[0]].idx;
	}
	if (keys.length) return Math.max(...keys.map((k) => section.fields[k].idx)) + 1;
	return section.headingLine + 1;
}

// Dates in a usage entry: "(2026-10-06)", "(as of 2026-10-6)", "(read 2026-10-06, dashboard)".
const USAGE_DATE = /\(([^()]*?)\b(\d{4})-(\d{1,2})-(\d{1,2})\b([^()]*)\)/;

// "41,200" groups thousands; "312 MB,+1.1 MB/day" separates parts.
const USAGE_PARTS = /,(?!\d{3}(?!\d))\s*/;

/** A quantity with words after it: "41,200 emails", "+300 emails/day", "3.4 TB of transfer", "9k users". */
function usageQuantity(text) {
	try {
		return parseQuantity(text);
	} catch {
		// Keep a trailing "/period", drop the plain words before it (but not a size unit such as MB).
		const t = String(text).trim();
		const slash = t.lastIndexOf('/');
		const per = slash !== -1 && /^\/ ?[A-Za-z]+$/.test(t.slice(slash)) ? t.slice(slash) : '';
		const words = (per ? t.slice(0, slash) : t).split(/\s+/).filter(Boolean);
		while (words.length > 1 && /^[A-Za-z]+$/.test(words.at(-1)) && !/^[KMGT]?B$/i.test(words.at(-1))) words.pop();
		return parseQuantity(words.join(' ') + per);
	}
}

/**
 * Reads a `usage` value: "312 MB, +1.1 MB/day (2026-10-06)", optionally named ("db_size 312 MB, ..."),
 * several entries separated by ";". Returns { metrics, problems }: metrics is
 * { metricName | "_": { value, dim, ratePerDay?, rateDim?, growthPerMonth?, asOf? } }, problems lists what could
 * not be read, so lint can say so instead of a check that quietly reports "ok". An impossible date is an error.
 */
function readUsage(raw) {
	const metrics = {};
	const problems = [];
	let last = null;
	for (const entry of String(raw ?? '').split(';')) {
		let s = entry.trim();
		if (!s) continue;
		let asOf = null;
		const d = USAGE_DATE.exec(s);
		if (d) {
			asOf = `${d[2]}-${d[3].padStart(2, '0')}-${d[4].padStart(2, '0')}`;
			if (!isIsoDate(asOf)) throw new Error(`usage: "${d[2]}-${d[3]}-${d[4]}" is not a date (YYYY-MM-DD)`);
			s = s.replace(d[0], '').trim();
		}
		let name = null;
		const n = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*[=:]\s*|\s+)(?=[+$\d.~])/.exec(s);
		if (n) {
			name = n[1].toLowerCase();
			s = s.slice(n[0].length);
		}
		const parts = s.split(USAGE_PARTS).map((p) => p.trim().replace(/^~\s*/, '')).filter(Boolean);
		const rates = [];
		let base = null;
		for (const p of parts) {
			let q;
			try {
				q = usageQuantity(p);
			} catch {
				problems.push(`cannot read "${p}"`);
				continue;
			}
			if (q.per != null || q.dim === 'pct') rates.push(q);
			else if (!base) base = q;
			else problems.push(`"${p}" is a second reading; separate metrics with ";" and name them`);
		}
		// "312 MB; +1.1 MB/day (date)": a rate alone continues the reading before it.
		const target = base ? { value: base.value, dim: base.dim, asOf } : !name && last ? last : null;
		if (!target) {
			if (parts.length) problems.push(`"${entry.trim()}" has a rate but no reading`);
			continue;
		}
		if (!base && asOf && !target.asOf) target.asOf = asOf;
		for (const r of rates) {
			if (r.dim === 'pct') target.growthPerMonth = monthlyGrowth(r.value, r.per ?? undefined);
			else if (r.per) {
				target.ratePerDay = r.value / r.per;
				if (r.dim !== target.dim) target.rateDim = r.dim;
			}
		}
		if (base) {
			metrics[name ?? '_'] = target;
			last = target;
		}
		if ((target.ratePerDay != null || target.growthPerMonth != null) && !target.asOf) problems.push('a reading with a rate has no date; add (YYYY-MM-DD) so projections start from it');
	}
	return { metrics, problems: [...new Set(problems)] };
}

function parseUsage(raw) {
	return readUsage(raw).metrics;
}

/**
 * Requirements → users: the first number ("9k now, 50k by Q3" is 9000; "9 000", "~9k", "12,000" and "1.5 million" work).
 * null when that number is not a count of users ("12 months out, 3k") or there is none.
 */
function parseUsers(raw) {
	const s = String(raw ?? '');
	const re = /(?<![\w.$-])(?:~\s*)?(\d{1,3}(?:([ ,_])\d{3})(?:\2\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*([km]|thousand|million|mln|bn|billion)(?![a-z]))?/gi;
	let first;
	let after;
	for (;;) {
		first = re.exec(s);
		if (!first) return null;
		after = s.slice(first.index + first[0].length);
		// "5x growth" is a multiplier; "launch in 2027" is a year, unless users follow ("2000 users").
		if (/^\s*[x×](?![a-z])/i.test(after)) continue;
		if (!first[3] && /^(19|20)\d\d$/.test(first[1]) && !/^\s*[-/.]\d/.test(after) && !/^\s*(?:users?|people|customers?|accounts?|seats?|mau|members?)\b/i.test(after)) continue;
		break;
	}
	if (/^\s*(?:%|\$|[-/.]\d|(?:hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|quarters?|[KMGT]?B)\b|\/)/i.test(after)) return null;
	let value = Number(first[1].replace(/[ ,_]/g, ''));
	if (first[3]) value *= /^(k|thousand)$/i.test(first[3]) ? 1e3 : /^(m|million|mln)$/i.test(first[3]) ? 1e6 : 1e9;
	return value;
}

function tokenizeRevisit(expr) {
	return String(expr)
		.split(/(\(|\)|\bAND\b|\bOR\b)/i)
		.map((t) => t.trim())
		.filter(Boolean)
		.map((t) => (/^(and|or)$/i.test(t) ? t.toUpperCase() : t));
}

/** Parses `revisit_when` into a tree. Grammar: references/stack-md.md in the skill. */
function parseRevisit(expr) {
	const tokens = tokenizeRevisit(expr);
	let i = 0;
	const peek = () => tokens[i];
	function parseOr() {
		const args = [parseAnd()];
		while (peek() === 'OR') {
			i++;
			args.push(parseAnd());
		}
		return args.length === 1 ? args[0] : { type: 'OR', args };
	}
	function parseAnd() {
		const args = [parsePrimary()];
		while (peek() === 'AND') {
			i++;
			args.push(parsePrimary());
		}
		return args.length === 1 ? args[0] : { type: 'AND', args };
	}
	function parsePrimary() {
		const t = tokens[i++];
		if (t === undefined) throw new Error('revisit_when: unexpected end');
		if (t === '(') {
			const node = parseOr();
			if (tokens[i++] !== ')') throw new Error('revisit_when: missing )');
			return node;
		}
		if (t === ')' || t === 'AND' || t === 'OR') throw new Error(`revisit_when: unexpected ${t}`);
		if (/^before\s+launch$/i.test(t)) return { type: 'manual', text: 'before launch' };
		const m = /^([a-z_][a-z0-9_]*)[ \t]*(>=|<=|>|<)(.+)$/i.exec(t);
		if (!m || !m[3].trim()) throw new Error(`revisit_when: cannot read "${t}"`);
		const [, metric, op, rawValue] = m;
		if (metric === 'date') {
			if (!isIsoDate(rawValue.trim())) throw new Error(`revisit_when: date needs a real YYYY-MM-DD, got "${rawValue}"`);
			return { type: 'cmp', metric, op, date: rawValue.trim() };
		}
		const qty = parseQuantity(rawValue);
		return { type: 'cmp', metric, op, value: qty.value, dim: qty.dim, raw: rawValue.trim() };
	}
	const tree = parseOr();
	if (i < tokens.length) throw new Error(`revisit_when: unexpected "${tokens[i]}"`);
	return tree;
}

function revisitMetrics(node, out = new Set()) {
	if (node.type === 'cmp' && node.metric !== 'date') out.add(node.metric);
	for (const a of node.args ?? []) revisitMetrics(a, out);
	return out;
}

const compare = (a, op, b) => (op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : a <= b);

const MONEY_METRIC = /(?:^|_)(?:bill|cost|spend|usd)$/;

// Thresholds and readings get the same rule: a unitless number on a metric named *_mb, *_gb or *_tb is in that
// unit, and on monthly_bill (or *_cost, *_spend, *_usd) it is dollars. Returns a copy.
function inMetricUnit(metric, q) {
	const out = { ...q };
	const unit = /_(mb|gb|tb)$/.exec(metric)?.[1];
	if (unit) {
		const f = METRIC_UNIT_MB[unit];
		if (q.dim === 'count') {
			out.value = q.value * f;
			out.dim = 'size';
		}
		if (q.ratePerDay != null && (q.rateDim ?? q.dim) === 'count') out.ratePerDay = q.ratePerDay * f;
	} else if (q.dim === 'count' && MONEY_METRIC.test(metric)) out.dim = 'money';
	return out;
}

const nextDay = (iso) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
const earliest = (dates) => dates.filter(Boolean).sort()[0] ?? null;

function evalRevisit(node, ctx) {
	if (node.type === 'manual') return { value: null, eta: null, unknown: [], manual: [node.text] };
	if (node.type === 'cmp') {
		if (node.metric === 'date') {
			const value = compare(ctx.today, node.op, node.date);
			// "date > 2026-12-01" holds from Dec 2.
			const due = !value && node.op === '>=' ? node.date : !value && node.op === '>' ? nextDay(node.date) : null;
			return { value, eta: due, unknown: [], manual: [] };
		}
		const reading = ctx.metrics[node.metric];
		if (!reading) return { value: null, eta: null, unknown: [node.metric], manual: [] };
		const m = inMetricUnit(node.metric, reading);
		const t = inMetricUnit(node.metric, { value: node.value, dim: node.dim });
		if (m.dim === 'count' && t.dim === 'money') m.dim = 'money';
		if (t.dim === 'count' && m.dim === 'money') t.dim = 'money';
		if (m.dim !== t.dim) return { value: null, eta: null, unknown: [`${node.metric} (unit mismatch: ${m.dim} vs ${t.dim})`], manual: [] };
		const value = compare(m.value, node.op, t.value);
		let due = null;
		if (!value && (node.op === '>' || node.op === '>=') && (m.ratePerDay > 0 || m.growthPerMonth > 0)) {
			due = eta({ current: m.value, limit: t.value, ratePerDay: m.ratePerDay, growthPerMonth: m.growthPerMonth, from: m.asOf ?? ctx.today }).date;
		}
		// An old reading whose trend has already crossed the line: due now, not "ok".
		if (due && due <= ctx.today) return { value: true, eta: null, projected: due, unknown: [], manual: [] };
		return { value, eta: due, unknown: [], manual: [] };
	}
	const parts = node.args.map((a) => evalRevisit(a, ctx));
	const merged = { unknown: parts.flatMap((p) => p.unknown), manual: parts.flatMap((p) => p.manual) };
	if (node.type === 'AND') {
		const value = parts.some((p) => p.value === false) ? false : parts.every((p) => p.value === true) ? true : null;
		// All conditions have to hold: the latest of the pending dates, when every pending one has a date.
		const pending = parts.filter((p) => p.value !== true);
		const projected = value === true ? latest(parts.map((p) => p.projected)) : null;
		return { value, eta: value === true ? null : pending.every((p) => p.eta) ? latest(pending.map((p) => p.eta)) : null, projected, ...merged };
	}
	const value = parts.some((p) => p.value === true) ? true : parts.every((p) => p.value === false) ? false : null;
	const hits = parts.filter((p) => p.value === true);
	const projected = hits.length && hits.every((p) => p.projected) ? earliest(hits.map((p) => p.projected)) : null;
	return { value, eta: value === true ? null : earliest(parts.map((p) => p.eta)), projected, ...merged };
}

function checkSection(s, ctx) {
	const tree = parseRevisit(s.values.revisit_when);
	const usage = parseUsage(s.values.usage);
	const metrics = { ...ctx.global, ...usage, ...ctx.metrics };
	const names = [...revisitMetrics(tree)];
	if (usage._ && names.length === 1 && !(names[0] in usage) && !(names[0] in ctx.metrics)) metrics[names[0]] = usage._;
	const r = evalRevisit(tree, { today: ctx.today, metrics });
	const status = r.value === true ? 'triggered' : r.value === false ? 'ok' : r.manual.length && !r.unknown.length ? 'manual' : 'unknown';
	const when = status === 'triggered' ? 'Now' : r.eta ? `ETA ${approxMonth(r.eta)}` : r.manual.length ? 'Before launch' : null;
	return { status, eta: r.eta, ...(status === 'triggered' && r.projected ? { projected: r.projected } : {}), when, unknown: r.unknown, manual: r.manual };
}

/**
 * Evaluates revisit_when for every service section. `metrics` override what usage says.
 * A section that cannot be read gets status "error" and the others are still checked.
 */
function checkStack(text, { today = todayIso(), metrics = {} } = {}) {
	if (!isIsoDate(today)) throw new Error(`today must be a real YYYY-MM-DD, got "${today}"`);
	const doc = parseStackMd(text);
	const global = {};
	const users = parseUsers(doc.requirements?.users);
	if (users != null) global.users = { value: users, dim: 'count' };
	const results = [];
	for (const s of doc.sections) {
		if (s.kind !== 'service') continue;
		const expr = s.values.revisit_when;
		const base = { heading: s.heading, line: s.line };
		if (!expr) {
			results.push({ ...base, status: 'none' });
			continue;
		}
		try {
			results.push({ ...base, revisit_when: expr, ...checkSection(s, { today, metrics, global }) });
		} catch (e) {
			results.push({ ...base, revisit_when: expr, status: 'error', error: e.message });
		}
	}
	const dates = results.map((r) => (r.status === 'triggered' ? today : r.eta)).filter(Boolean).sort();
	return { today, next: dates[0] ?? null, sections: results };
}

function lintStackMd(text) {
	const errors = [];
	const warnings = [];
	for (const s of findSecrets(text)) errors.push({ line: s.line, message: `looks like a secret (${s.kind}); remove it, STACK.md keeps names only` });
	const doc = parseStackMd(text);
	if (!doc.requirements) warnings.push({ line: 1, message: 'no ## Requirements section' });
	const priority = doc.requirements?.priority;
	if (priority && !PRIORITIES.includes(priority.toLowerCase())) warnings.push({ line: 1, message: `priority "${priority}" is not one of ${PRIORITIES.join(', ')}` });
	for (const s of doc.sections) {
		if (s.kind === 'other') warnings.push({ line: s.line, message: `heading "${s.heading}" is not "<Role>: <Vendor>"` });
		if (s.kind !== 'service') continue;
		if (!STACK_ROLES.includes(s.role)) warnings.push({ line: s.line, message: `role "${s.role}" is not one of ${STACK_ROLES.join(', ')}` });
		if (s.values.env && /=/.test(s.values.env)) errors.push({ line: s.line, message: 'env lists names only, without values' });
		// "user" (an answer) and "unverified" (not read yet) have no page to date.
		if (s.values.source && !/^(user|unverified)\b/i.test(s.values.source) && !/\d{4}-\d{2}-\d{2}/.test(`${s.values.source} ${s.comments.source ?? ''}`)) warnings.push({ line: s.line, message: 'source has no read date (add "# read YYYY-MM-DD")' });
		try {
			for (const p of readUsage(s.values.usage).problems) warnings.push({ line: s.line, message: `usage: ${p}. Write it as "312 MB, +1.1 MB/day (2026-10-06)"` });
		} catch (e) {
			errors.push({ line: s.line, message: e.message });
		}
		if (s.values.revisit_when) {
			try {
				// A metric outside the list is fine when this section's usage names it; otherwise it may be a typo.
				const named = Object.keys(parseUsage(s.values.usage));
				for (const m of revisitMetrics(parseRevisit(s.values.revisit_when))) if (!REVISIT_METRICS.includes(m) && !named.includes(m)) warnings.push({ line: s.line, message: `revisit_when metric "${m}" is not a standard metric and usage does not name it` });
			} catch (e) {
				errors.push({ line: s.line, message: e.message });
			}
		}
	}
	return { ok: errors.length === 0, errors, warnings };
}

const STACK_USAGE = `usage:
  node stack-md.mjs parse [file]
  node stack-md.mjs check [file] [--today YYYY-MM-DD] [--metric db_size="420 MB"]...
  node stack-md.mjs lint [file]
  node stack-md.mjs set [file] --section "Database: Acme DB" --json .manifestack/tmp/set.json
  node stack-md.mjs set [file] --section "Database: Acme DB" --set "plan=Starter" [--set ...] [--comment "source=read 2026-10-06"]
file defaults to .manifestack/STACK.md and must be inside the current directory. Prints JSON.
set --json reads a JSON object from a file or - (stdin): {"key": "value"} or {"key": {"value": "...", "comment": "..."}}.
Write text copied from a page to that file (or a quoted heredoc, <<'EOF'), never into --set "...": the shell expands $(...) and backticks there.
A comment without a value comments the existing line; an empty comment removes it.
set refuses values that look like secrets and keeps every other line as it is.`;

function keyValues(list, flag) {
	const out = {};
	for (const item of [].concat(list ?? [])) {
		const eq = String(item).indexOf('=');
		// The item is not echoed: a value pasted without its key may be the very secret set refuses to write.
		if (item === true || eq < 1) throw new Error(`${flag} expects key=value`);
		out[String(item).slice(0, eq).trim()] = String(item).slice(eq + 1).trim();
	}
	return out;
}

const scalar = (v, where) => {
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
	throw new Error(`--json: ${where} must be a string`);
};

/** Reads `{"key": "value"}` or `{"key": {"value": "...", "comment": "..."}}` from a file or - (stdin). */
function jsonFields(src) {
	if (typeof src !== 'string') throw new Error('--json needs a file or - for stdin');
	let obj;
	try {
		obj = JSON.parse(stripBom(readFileSync(src === '-' ? 0 : src, 'utf8')));
	} catch (e) {
		// The parser quotes the input; it may hold what the secret check is about to refuse.
		throw new Error(e instanceof SyntaxError ? `--json: ${src === '-' ? 'stdin' : src} is not valid JSON` : e.message);
	}
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('--json expects an object: {"key": "value"} or {"key": {"value": "...", "comment": "..."}}');
	const updates = {};
	const comments = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const extra = Object.keys(v).filter((x) => x !== 'value' && x !== 'comment');
			if (extra.length || !Object.keys(v).length) throw new Error(`--json: "${k}" takes "value" and/or "comment"`);
			if ('value' in v) updates[k] = scalar(v.value, `"${k}".value`);
			if ('comment' in v) comments[k] = scalar(v.comment, `"${k}".comment`);
		} else updates[k] = scalar(v, `"${k}"`);
	}
	return { updates, comments };
}

function mergeOnce(target, source, what) {
	for (const [k, v] of Object.entries(source)) {
		if (k in target) throw new Error(`${what} for ${k} is given twice`);
		target[k] = v;
	}
	return target;
}

function stackMdMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	const file = args._[1] ?? STACK_FILE;
	try {
		if (args.help || !['parse', 'check', 'lint', 'set'].includes(cmd)) {
			process.stdout.write(STACK_USAGE + '\n');
			if (!args.help && cmd && cmd !== 'help') process.exitCode = 1;
			return;
		}
		if (cmd === 'set' && !withinCwd(file)) throw new Error(`refusing to write ${file}: it is outside the current directory`);
		const exists = existsSync(file);
		if (!exists && cmd !== 'set') {
			printJson({ exists: false, file });
			return;
		}
		const text = exists ? stripBom(readFileSync(file, 'utf8')) : '';
		if (cmd === 'parse') printJson({ exists: true, file, ...parseStackMd(text) });
		else if (cmd === 'lint') {
			const r = lintStackMd(text);
			printJson({ file, ...r });
			if (!r.ok) process.exitCode = 2;
		} else if (cmd === 'check') {
			const metrics = {};
			for (const [k, v] of Object.entries(keyValues(args.metric, '--metric'))) {
				const qv = parseQuantity(v);
				metrics[k] = { value: qv.value, dim: qv.dim };
			}
			printJson({ file, ...checkStack(text, { today: dateArg(args, 'today', todayIso()), metrics }) });
		} else {
			if (typeof args.section !== 'string' || !args.section.trim()) throw new Error('--section "<Role>: <Vendor>" is required (one)');
			const updates = keyValues(args.set, '--set');
			const comments = keyValues(args.comment, '--comment');
			if (args.json != null) {
				// A JSON file the agent wrote into .manifestack/tmp stays out of git like the other working files.
				if (typeof args.json === 'string' && args.json !== '-') ignoreTmpDir(dirname(args.json));
				const j = jsonFields(args.json);
				mergeOnce(updates, j.updates, 'a value');
				mergeOnce(comments, j.comments, 'a comment');
			}
			if (!Object.keys(updates).length && !Object.keys(comments).length) throw new Error('nothing to set: pass --json, --set or --comment');
			const out = setFields(text, args.section, updates, comments);
			// Lines this write adds must be clean; a line already in the file is lint's to report, so one old
			// false alarm does not block every later update.
			const before = new Set(text.split(/\r?\n/));
			const outLines = out.split(/\r?\n/);
			const secrets = findSecrets(out);
			const added = secrets.filter((h) => !before.has(outLines[h.line - 1]));
			if (added.length) {
				process.exitCode = 2;
				throw new Error(`refusing to write: lines ${[...new Set(added.map((h) => h.line))].join(', ')} look like secrets`);
			}
			ensureWorkDir(file);
			// Write a sibling file, then rename: an interrupted write never leaves half a STACK.md.
			const tmp = `${file}.${process.pid}.tmp`;
			try {
				writeFileSync(tmp, out);
				renameSync(tmp, file);
			} catch (e) {
				rmSync(tmp, { force: true });
				throw e;
			}
			const elsewhere = [...new Set(secrets.filter((h) => before.has(outLines[h.line - 1])).map((h) => h.line))];
			printJson({ file, written: true, section: normalizeHeading(args.section), ...(elsewhere.length ? { secrets_elsewhere: elsewhere } : {}) });
		}
	} catch (e) {
		fail(e.message, process.exitCode || 1);
	}
}

// ---- packages/core/src/hook.mjs
// "New vendor" hook for Claude Code and Cursor (both PostToolUse; Cursor spells it postToolUse).
// After an edit to a dependency manifest (package.json, requirements*.txt, pyproject.toml, Pipfile, go.mod) it
// compares dependencies before and after the edit; after a package-manager command (npm install, pip install,
// deno add, go get…) it takes the package names from the command. Vendors that are new and not in .manifestack/STACK.md
// get one line of context for the agent; otherwise it prints nothing. Each vendor is announced once per session.
// Offline, never blocks, always exits 0.

// tools/sync.mjs replaces this line with the signatures from catalog/vendors.
let EMBEDDED_SIGNATURES = [{"id":"adapty","name":"Adapty","roles":["payments"],"packages":["react-native-adapty","@adapty/","adapty"],"pypi":[],"go":[],"imports":["react-native-adapty","@adapty/"],"env_prefixes":["ADAPTY_","EXPO_PUBLIC_ADAPTY_","NEXT_PUBLIC_ADAPTY_","VITE_ADAPTY_"],"config_files":[],"role_signals":{}},{"id":"anthropic","name":"Anthropic","roles":["ai"],"packages":["@anthropic-ai/sdk","@anthropic-ai/claude-agent-sdk","@ai-sdk/anthropic","@langchain/anthropic"],"pypi":["anthropic","claude-agent-sdk","langchain-anthropic","llama-index-llms-anthropic"],"go":["github.com/anthropics/anthropic-sdk-go"],"imports":["@anthropic-ai/sdk","@anthropic-ai/claude-agent-sdk","@ai-sdk/anthropic","@langchain/anthropic"],"env_prefixes":["ANTHROPIC_"],"config_files":[],"role_signals":{}},{"id":"auth0","name":"Auth0","roles":["auth"],"packages":["@auth0/","auth0","express-openid-connect","react-native-auth0","auth0-js","auth0-lock"],"pypi":["auth0-python","auth0-server-python","auth0-fastapi","auth0-api-python"],"go":["github.com/auth0/go-auth0","github.com/auth0/go-jwt-middleware"],"imports":["@auth0/","auth0","express-openid-connect","react-native-auth0","auth0-js","auth0-lock"],"env_prefixes":["AUTH0_","NEXT_PUBLIC_AUTH0_"],"config_files":[],"role_signals":{}},{"id":"clerk","name":"Clerk","roles":["auth"],"packages":["@clerk/"],"pypi":["clerk-backend-api"],"go":["github.com/clerk/clerk-sdk-go"],"imports":["@clerk/"],"env_prefixes":["CLERK_","NEXT_PUBLIC_CLERK_","VITE_CLERK_","EXPO_PUBLIC_CLERK_","PUBLIC_CLERK_"],"config_files":[],"role_signals":{}},{"id":"cloudflare","name":"Cloudflare","roles":["hosting","storage","database"],"packages":["wrangler","@cloudflare/","@opennextjs/cloudflare"],"pypi":["cloudflare","workers-py","langchain-cloudflare"],"go":["github.com/cloudflare/cloudflare-go"],"imports":["cloudflare:","@cloudflare/","@opennextjs/cloudflare"],"env_prefixes":["CLOUDFLARE_","CF_API_TOKEN","CF_API_KEY","CF_ACCOUNT_ID","CF_ZONE_ID","CF_PAGES"],"config_files":["wrangler.toml","wrangler.json","wrangler.jsonc"],"role_signals":{"storage":["R2Bucket","KVNamespace","r2.cloudflarestorage.com"],"database":["D1Database","drizzle-orm/d1","@prisma/adapter-d1","kysely-d1"]}},{"id":"cloudinary","name":"Cloudinary","roles":["storage"],"packages":["cloudinary","@cloudinary/","next-cloudinary","cloudinary-core","cloudinary-react","astro-cloudinary","svelte-cloudinary"],"pypi":["cloudinary","django-cloudinary-storage"],"go":["github.com/cloudinary/cloudinary-go"],"imports":["cloudinary","@cloudinary/","next-cloudinary","cloudinary-core","cloudinary-react"],"env_prefixes":["CLOUDINARY_","NEXT_PUBLIC_CLOUDINARY_"],"config_files":[],"role_signals":{}},{"id":"convex","name":"Convex","roles":["database"],"packages":["convex","@convex-dev/","convex-helpers"],"pypi":["convex"],"go":[],"imports":["convex/","@convex-dev/","convex-helpers"],"env_prefixes":["CONVEX_","NEXT_PUBLIC_CONVEX_","VITE_CONVEX_","EXPO_PUBLIC_CONVEX_","PUBLIC_CONVEX_"],"config_files":["convex.json","convex/schema.ts","convex/_generated/api.d.ts"],"role_signals":{}},{"id":"datadog","name":"Datadog","roles":["monitoring"],"packages":["dd-trace","dd-trace-api","@datadog/","datadog-lambda-js"],"pypi":["ddtrace","datadog","datadog-api-client","datadog-lambda"],"go":["github.com/DataDog/dd-trace-go","gopkg.in/DataDog/dd-trace-go.v1","github.com/DataDog/datadog-go","github.com/DataDog/datadog-api-client-go","github.com/DataDog/datadog-lambda-go"],"imports":["dd-trace","dd-trace-api","@datadog/","datadog-lambda-js"],"env_prefixes":["DD_","DATADOG_","NEXT_PUBLIC_DATADOG_","VITE_DATADOG_"],"config_files":["datadog.yaml","datadog-values.yaml","datadog-ci.json"],"role_signals":{}},{"id":"digitalocean","name":"DigitalOcean","roles":["hosting","storage","database"],"packages":["@digitalocean/"],"pypi":["pydo"],"go":["github.com/digitalocean/godo"],"imports":["@digitalocean/"],"env_prefixes":["DIGITALOCEAN_","SPACES_ACCESS_KEY_ID","SPACES_SECRET_ACCESS_KEY","SPACES_ENDPOINT_URL"],"config_files":[".do/app.yaml",".do/deploy.template.yaml"],"role_signals":{"storage":["digitaloceanspaces.com"],"database":["db.ondigitalocean.com"]}},{"id":"expo","name":"Expo EAS","roles":["other"],"packages":["eas-cli","expo-updates","expo-insights","@expo/eas-json"],"pypi":[],"go":[],"imports":["expo-updates","expo-insights"],"env_prefixes":["EAS_","EXPO_TOKEN"],"config_files":["eas.json"],"role_signals":{}},{"id":"firebase","name":"Firebase","roles":["database","auth","hosting","storage"],"packages":["firebase","firebase-admin","firebase-functions","firebase-tools","@firebase/","@react-native-firebase/","reactfire","react-firebase-hooks","@angular/fire","vuefire","@apphosting/"],"pypi":["firebase-admin","firebase-functions"],"go":["firebase.google.com/go"],"imports":["firebase/","firebase-admin","firebase-functions","@firebase/","@react-native-firebase/","reactfire","react-firebase-hooks","@angular/fire","vuefire"],"env_prefixes":["FIREBASE_","NEXT_PUBLIC_FIREBASE_","VITE_FIREBASE_","EXPO_PUBLIC_FIREBASE_"],"config_files":["firebase.json",".firebaserc","firestore.rules","database.rules.json","storage.rules","apphosting.yaml"],"role_signals":{"database":["@react-native-firebase/firestore","@react-native-firebase/database","firebase/firestore","firebase/database","firebase-admin/firestore","firebase-admin/database","@firebase/firestore","@firebase/database","getFirestore(","admin.firestore()","admin.database()"],"auth":["@react-native-firebase/auth","firebase/auth","firebase-admin/auth","@firebase/auth","react-firebase-hooks/auth","onAuthStateChanged(","signInWithPopup(","admin.auth()"],"hosting":["firebase-functions","@apphosting/"],"storage":["@react-native-firebase/storage","firebase/storage","firebase-admin/storage","@firebase/storage","admin.storage()"]}},{"id":"fly","name":"Fly.io","roles":["hosting"],"packages":["@fly/","@flydotio/dockerfile"],"pypi":[],"go":["github.com/superfly/fly-go","github.com/superfly/flyctl"],"imports":["@fly/"],"env_prefixes":["FLY_"],"config_files":["fly.toml"],"role_signals":{}},{"id":"gemini","name":"Google Gemini","roles":["ai"],"packages":["@google/genai","@google/generative-ai","@ai-sdk/google","@langchain/google-genai","@genkit-ai/google-genai"],"pypi":["google-genai","google-generativeai","langchain-google-genai","llama-index-llms-gemini"],"go":["google.golang.org/genai","github.com/google/generative-ai-go"],"imports":["@google/genai","@google/generative-ai","@ai-sdk/google","@langchain/google-genai","@genkit-ai/google-genai"],"env_prefixes":["GEMINI_","NEXT_PUBLIC_GEMINI_","VITE_GEMINI_","GOOGLE_GENERATIVE_AI_"],"config_files":[],"role_signals":{}},{"id":"heroku","name":"Heroku","roles":["hosting"],"packages":["heroku","@heroku/","@heroku-cli/"],"pypi":[],"go":["github.com/heroku/heroku-go"],"imports":["@heroku/"],"env_prefixes":["HEROKU_"],"config_files":["Procfile","heroku.yml"],"role_signals":{}},{"id":"lemon-squeezy","name":"Lemon Squeezy","roles":["payments"],"packages":["@lemonsqueezy/","@lemonsqueezy/lemonsqueezy.js"],"pypi":[],"go":[],"imports":["@lemonsqueezy/"],"env_prefixes":["LEMONSQUEEZY_","LEMON_SQUEEZY_","NEXT_PUBLIC_LEMONSQUEEZY_","VITE_LEMONSQUEEZY_"],"config_files":[],"role_signals":{}},{"id":"mongodb-atlas","name":"MongoDB Atlas","roles":["database"],"packages":["mongodb","mongoose"],"pypi":["pymongo","motor","mongoengine","beanie","django-mongodb-backend"],"go":["go.mongodb.org/mongo-driver","go.mongodb.org/atlas","go.mongodb.org/atlas-sdk"],"imports":["mongodb","mongoose"],"env_prefixes":["MONGODB_","MONGO_"],"config_files":[],"role_signals":{}},{"id":"neon","name":"Neon","roles":["database","auth"],"packages":["@neondatabase/serverless","@prisma/adapter-neon","@vercel/postgres","@neondatabase/neon-js","@neondatabase/auth","@neondatabase/api-client","@neon/sdk","neonctl"],"pypi":["neon-api"],"go":[],"imports":["@neondatabase/","@prisma/adapter-neon","@vercel/postgres"],"env_prefixes":["NEON_"],"config_files":[],"role_signals":{"auth":["@neondatabase/auth"]}},{"id":"netlify","name":"Netlify","roles":["hosting"],"packages":["netlify-cli","netlify","@netlify/"],"pypi":[],"go":["github.com/netlify/open-api"],"imports":["@netlify/"],"env_prefixes":["NETLIFY_"],"config_files":["netlify.toml"],"role_signals":{}},{"id":"openai","name":"OpenAI","roles":["ai"],"packages":["openai","@openai/agents","@ai-sdk/openai","@langchain/openai"],"pypi":["openai","openai-agents","langchain-openai","llama-index-llms-openai","llama-index-embeddings-openai"],"go":["github.com/openai/openai-go","github.com/sashabaranov/go-openai"],"imports":["openai","@openai/agents","@ai-sdk/openai","@langchain/openai"],"env_prefixes":["OPENAI_"],"config_files":[],"role_signals":{}},{"id":"paddle","name":"Paddle","roles":["payments"],"packages":["@paddle/","@paddle/paddle-js","@paddle/paddle-node-sdk"],"pypi":["paddle-python-sdk"],"go":["github.com/PaddleHQ/paddle-go-sdk"],"imports":["@paddle/"],"env_prefixes":["PADDLE_API_KEY","PADDLE_CLIENT_TOKEN","PADDLE_WEBHOOK_SECRET","PADDLE_NOTIFICATION_WEBHOOK_SECRET","PADDLE_ENVIRONMENT","PADDLE_VENDOR_ID","PADDLE_SELLER_ID","NEXT_PUBLIC_PADDLE_","VITE_PADDLE_"],"config_files":[],"role_signals":{}},{"id":"planetscale","name":"PlanetScale","roles":["database"],"packages":["@planetscale/database","@prisma/adapter-planetscale","kysely-planetscale"],"pypi":[],"go":["github.com/planetscale/planetscale-go"],"imports":["@planetscale/database","@prisma/adapter-planetscale","kysely-planetscale"],"env_prefixes":["PLANETSCALE_"],"config_files":[".pscale.yml"],"role_signals":{}},{"id":"polar","name":"Polar","roles":["payments"],"packages":["@polar-sh/","@polar-sh/sdk","@polar-sh/nextjs","@polar-sh/checkout","@polar-sh/better-auth"],"pypi":["polar-sdk"],"go":["github.com/polarsource/polar-go"],"imports":["@polar-sh/"],"env_prefixes":["POLAR_","NEXT_PUBLIC_POLAR_","VITE_POLAR_"],"config_files":[],"role_signals":{}},{"id":"posthog","name":"PostHog","roles":["monitoring"],"packages":["posthog-js","posthog-node","posthog-react-native","posthog-js-lite","@posthog/"],"pypi":["posthog","posthoganalytics"],"go":["github.com/posthog/posthog-go"],"imports":["posthog-js","posthog-node","posthog-react-native","posthog-js-lite","@posthog/"],"env_prefixes":["POSTHOG_","NEXT_PUBLIC_POSTHOG_","VITE_POSTHOG_","VITE_PUBLIC_POSTHOG_","EXPO_PUBLIC_POSTHOG_","PUBLIC_POSTHOG_","REACT_APP_POSTHOG_"],"config_files":[],"role_signals":{}},{"id":"postmark","name":"Postmark","roles":["email"],"packages":["postmark"],"pypi":["postmark-python","postmarker","python-postmark","pystmark"],"go":["github.com/mrz1836/postmark","github.com/keighl/postmark","github.com/hjr265/postmark.go"],"imports":["postmark"],"env_prefixes":["POSTMARK_"],"config_files":[],"role_signals":{}},{"id":"railway","name":"Railway","roles":["hosting"],"packages":["@railway/cli"],"pypi":[],"go":[],"imports":[],"env_prefixes":["RAILWAY_"],"config_files":["railway.json","railway.toml"],"role_signals":{}},{"id":"render","name":"Render","roles":["hosting"],"packages":[],"pypi":["render","render-sdk"],"go":[],"imports":[],"env_prefixes":["RENDER_SERVICE_","RENDER_EXTERNAL_","RENDER_GIT_","RENDER_INSTANCE_ID","RENDER_DISCOVERY_SERVICE","RENDER_API_KEY"],"config_files":["render.yaml"],"role_signals":{}},{"id":"resend","name":"Resend","roles":["email"],"packages":["resend"],"pypi":["resend"],"go":["github.com/resend/resend-go"],"imports":["resend"],"env_prefixes":["RESEND_"],"config_files":[],"role_signals":{}},{"id":"revenuecat","name":"RevenueCat","roles":["payments"],"packages":["react-native-purchases","react-native-purchases-ui","react-native-purchases-store-galaxy","cordova-plugin-purchases","@revenuecat/"],"pypi":[],"go":[],"imports":["react-native-purchases","react-native-purchases-ui","cordova-plugin-purchases","@revenuecat/"],"env_prefixes":["REVENUECAT_","EXPO_PUBLIC_REVENUECAT_","NEXT_PUBLIC_REVENUECAT_","VITE_REVENUECAT_"],"config_files":[],"role_signals":{}},{"id":"sendgrid","name":"SendGrid","roles":["email"],"packages":["@sendgrid/"],"pypi":["sendgrid"],"go":["github.com/sendgrid/sendgrid-go"],"imports":["@sendgrid/"],"env_prefixes":["SENDGRID_"],"config_files":[],"role_signals":{}},{"id":"sentry","name":"Sentry","roles":["monitoring"],"packages":["@sentry/","sentry-expo"],"pypi":["sentry-sdk","raven","sentry-cli"],"go":["github.com/getsentry/sentry-go"],"imports":["@sentry/","sentry-expo"],"env_prefixes":["SENTRY_","NEXT_PUBLIC_SENTRY_","VITE_SENTRY_","EXPO_PUBLIC_SENTRY_","PUBLIC_SENTRY_","REACT_APP_SENTRY_"],"config_files":["sentry.client.config.ts","sentry.client.config.js","sentry.server.config.ts","sentry.server.config.js","sentry.edge.config.ts","sentry.edge.config.js","sentry.properties",".sentryclirc"],"role_signals":{}},{"id":"stripe","name":"Stripe","roles":["payments"],"packages":["stripe","@stripe/","@better-auth/stripe","@payloadcms/plugin-stripe"],"pypi":["stripe","stripe-agent-toolkit"],"go":["github.com/stripe/stripe-go"],"imports":["stripe","@stripe/","@better-auth/stripe","@payloadcms/plugin-stripe"],"env_prefixes":["STRIPE_","NEXT_PUBLIC_STRIPE_","VITE_STRIPE_","EXPO_PUBLIC_STRIPE_"],"config_files":[],"role_signals":{}},{"id":"supabase","name":"Supabase","roles":["database","auth","storage"],"packages":["@supabase/","@supabase/supabase-js","@supabase/ssr","@supabase/auth-helpers-nextjs","@supabase/auth-helpers-react","@supabase/auth-ui-react","supabase"],"pypi":["supabase","supabase-auth","supabase-functions","storage3","realtime","gotrue","supafunc"],"go":["github.com/supabase/supabase-go","github.com/supabase-community/supabase-go"],"imports":["@supabase/"],"env_prefixes":["SUPABASE_","NEXT_PUBLIC_SUPABASE_","VITE_SUPABASE_","EXPO_PUBLIC_SUPABASE_"],"config_files":["supabase/config.toml"],"role_signals":{"auth":["supabase.auth.","@supabase/auth-helpers","@supabase/auth-ui",".auth.signInWith",".auth.getUser("],"storage":["supabase.storage.",".storage.from("]}},{"id":"uploadthing","name":"UploadThing","roles":["storage"],"packages":["uploadthing","@uploadthing/"],"pypi":["uploadthing-py"],"go":[],"imports":["uploadthing","@uploadthing/"],"env_prefixes":["UPLOADTHING_"],"config_files":[],"role_signals":{}},{"id":"upstash","name":"Upstash","roles":["database"],"packages":["@upstash/","@vercel/kv"],"pypi":["upstash-*","qstash"],"go":["github.com/upstash"],"imports":["@upstash/","@vercel/kv"],"env_prefixes":["UPSTASH_","QSTASH_","KV_REST_API_"],"config_files":[],"role_signals":{}},{"id":"vercel","name":"Vercel","roles":["hosting","storage"],"packages":["vercel","@vercel/"],"pypi":["vercel","vercel-sandbox","vercel-queue","vercel-workflow","vercel-cache","vercel-oidc","vercel-headers","vercel-connect"],"go":[],"imports":["@vercel/"],"env_prefixes":["VERCEL_","NEXT_PUBLIC_VERCEL_","BLOB_READ_WRITE_TOKEN"],"config_files":["vercel.json","vercel.ts","vercel.toml"],"role_signals":{"storage":["@vercel/blob"]}},{"id":"workos","name":"WorkOS","roles":["auth"],"packages":["@workos-inc/","@workos-inc/node","@workos-inc/authkit-nextjs","@workos-inc/authkit-react","@workos-inc/authkit-js","@workos-inc/authkit-remix","@workos-inc/authkit-react-router","@workos-inc/widgets"],"pypi":["workos"],"go":["github.com/workos/workos-go"],"imports":["@workos-inc/"],"env_prefixes":["WORKOS_","NEXT_PUBLIC_WORKOS_","VITE_WORKOS_"],"config_files":[],"role_signals":{}}];

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
