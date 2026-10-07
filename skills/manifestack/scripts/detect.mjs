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
		if (key in args) args[key] = [].concat(args[key], value);
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

function todayIso() {
	return new Date().toISOString().slice(0, 10);
}

// ---- packages/core/src/yaml.mjs
// Minimal YAML reader for vendor-map frontmatter. Covers what catalog/vendors/*.md uses:
// nested maps by indentation, block lists, lists of maps, inline [a, "b"] lists, quoted and plain
// scalars, numbers, booleans, null and `#` comments. Not a general YAML parser.

function parseFrontmatter(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text);
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
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'") {
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

// ---- packages/core/src/catalog.mjs
// Reads vendor maps (catalog/vendors/<id>.md in the repo, vendors/<id>.md inside a skill).
// A map says where to look and what to extract, never the prices themselves.

const VENDOR_SCHEMA = 1;
const VENDOR_ROLES = ['hosting', 'database', 'auth', 'email', 'storage', 'payments', 'monitoring', 'other'];

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

function validateVendorMap(v) {
	const errors = [];
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v.id ?? ''))) errors.push('id must be lowercase a-z, 0-9 and single hyphens');
	if (!v.name) errors.push('name is required');
	if (!Array.isArray(v.roles) || !v.roles.length) errors.push('roles must be a non-empty list');
	for (const r of v.roles ?? []) if (!VENDOR_ROLES.includes(r)) errors.push(`unknown role "${r}"`);
	const d = v.detect ?? {};
	if (![d.packages, d.imports, d.env_prefixes, d.config_files].some((x) => x?.length)) errors.push('detect needs at least one signature');
	for (const role of Object.keys(d.role_signals ?? {})) if (!(v.roles ?? []).includes(role)) errors.push(`role_signals.${role} is not in roles`);
	if (!/^https:\/\//.test(String(v.pages?.pricing ?? ''))) errors.push('pages.pricing must be an https URL');
	for (const [k, url] of Object.entries(v.pages ?? {})) if (!/^https:\/\//.test(String(url))) errors.push(`pages.${k} must be an https URL`);
	if (!v.read?.length) errors.push('read must list what to extract from the pages');
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
	return vendors;
}

/** The part of a map that detection needs; embedded into the hook so it runs without the catalog. */
function vendorSignatures(vendors) {
	return vendors.map((v) => ({ id: v.id, name: v.name, roles: v.roles, ...v.detect }));
}

// ---- packages/core/src/known-sdks.mjs
// SDKs of common vendors that have no page map yet. Detection reports them as `unmapped` so the
// audit still covers them (the skill finds the pricing page itself) and the hook can flag them.
// Prefix entries end with `/` and match every package in that scope or path.
const UNMAPPED_SDKS = [
	{ name: 'Stripe', role: 'payments', packages: ['stripe', '@stripe/'] },
	{ name: 'Paddle', role: 'payments', packages: ['@paddle/'] },
	{ name: 'Lemon Squeezy', role: 'payments', packages: ['@lemonsqueezy/'] },
	{ name: 'Polar', role: 'payments', packages: ['@polar-sh/'] },
	{ name: 'Auth0', role: 'auth', packages: ['@auth0/', 'auth0'] },
	{ name: 'WorkOS', role: 'auth', packages: ['@workos-inc/'] },
	{ name: 'Firebase', role: 'database', packages: ['firebase', 'firebase-admin'] },
	{ name: 'PlanetScale', role: 'database', packages: ['@planetscale/'] },
	{ name: 'Turso', role: 'database', packages: ['@libsql/', '@tursodatabase/'] },
	{ name: 'MongoDB Atlas', role: 'database', packages: ['mongodb', 'mongoose'] },
	{ name: 'Upstash', role: 'database', packages: ['@upstash/'] },
	{ name: 'Convex', role: 'database', packages: ['convex'] },
	{ name: 'Prisma Postgres', role: 'database', packages: ['@prisma/ppg', '@prisma/extension-accelerate'] },
	{ name: 'AWS', role: 'other', packages: ['@aws-sdk/', 'aws-sdk', 'aws-cdk-lib'] },
	{ name: 'Google Cloud', role: 'other', packages: ['@google-cloud/'] },
	{ name: 'Azure', role: 'other', packages: ['@azure/'] },
	{ name: 'Cloudflare', role: 'hosting', packages: ['wrangler', '@cloudflare/'] },
	{ name: 'Netlify', role: 'hosting', packages: ['@netlify/', 'netlify-cli'] },
	{ name: 'Fly.io', role: 'hosting', packages: ['@fly/'] },
	{ name: 'SendGrid', role: 'email', packages: ['@sendgrid/'] },
	{ name: 'Postmark', role: 'email', packages: ['postmark'] },
	{ name: 'Mailgun', role: 'email', packages: ['mailgun.js', 'mailgun-js'] },
	{ name: 'Loops', role: 'email', packages: ['loops'] },
	{ name: 'Twilio', role: 'other', packages: ['twilio'] },
	{ name: 'Sentry', role: 'monitoring', packages: ['@sentry/'] },
	{ name: 'Datadog', role: 'monitoring', packages: ['@datadog/', 'dd-trace'] },
	{ name: 'PostHog', role: 'monitoring', packages: ['posthog-js', 'posthog-node'] },
	{ name: 'Axiom', role: 'monitoring', packages: ['@axiomhq/'] },
	{ name: 'Better Stack', role: 'monitoring', packages: ['@logtail/'] },
	{ name: 'UploadThing', role: 'storage', packages: ['uploadthing', '@uploadthing/'] },
	{ name: 'Cloudinary', role: 'storage', packages: ['cloudinary', 'next-cloudinary'] },
	{ name: 'Algolia', role: 'other', packages: ['algoliasearch', '@algolia/'] },
	{ name: 'Pusher', role: 'other', packages: ['pusher', 'pusher-js'] },
	{ name: 'Ably', role: 'other', packages: ['ably'] },
	{ name: 'Liveblocks', role: 'other', packages: ['@liveblocks/'] },
	{ name: 'Inngest', role: 'other', packages: ['inngest'] },
	{ name: 'Trigger.dev', role: 'other', packages: ['@trigger.dev/'] },
	{ name: 'OpenAI', role: 'other', packages: ['openai', '@ai-sdk/openai'] },
	{ name: 'Anthropic', role: 'other', packages: ['@anthropic-ai/sdk', '@ai-sdk/anthropic'] },
	{ name: 'Pinecone', role: 'database', packages: ['@pinecone-database/'] },
];

// Frameworks and infrastructure tooling: inputs for Overbuilt findings, not vendors.
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

function packageMatches(pkg, patterns) {
	return patterns.some((p) => (p.endsWith('/') ? pkg.startsWith(p) : pkg === p));
}

// ---- packages/core/src/detect.mjs
// Finds vendors in a repository: package.json dependencies, imports, config files and env var NAMES.
// Env values are dropped while reading a line, before anything else sees them. No network.

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'venv', '__pycache__', 'target', 'tmp']);
const SOURCE_EXT = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro)$/;
const ENV_FILE = /^\.env(\..+)?$/;
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_EVIDENCE = 8;
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

export function dependencyNames(pkgJson) {
	const names = new Set();
	for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
		for (const name of Object.keys(pkgJson?.[field] ?? {})) names.add(name);
	}
	return [...names];
}

/** Which mapped vendors and unmapped SDKs a list of package names contains. */
export function matchPackages(packages, signatures) {
	const vendors = [];
	for (const sig of signatures) {
		const hits = packages.filter((p) => packageMatches(p, sig.packages));
		if (hits.length) vendors.push({ id: sig.id, name: sig.name, roles: sig.roles, packages: hits });
	}
	const unmapped = [];
	for (const sdk of UNMAPPED_SDKS) {
		const hits = packages.filter((p) => packageMatches(p, sdk.packages));
		if (hits.length) unmapped.push({ name: sdk.name, role: sdk.role, packages: hits });
	}
	return { vendors, unmapped };
}

function* walk(root, limits) {
	const stack = [root];
	while (stack.length) {
		const dir = stack.pop();
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const e of entries) {
			const full = join(dir, e.name);
			if (e.isDirectory()) {
				// Dot-directories hold agent configs, installed skills and VCS data, not the product.
				if (!e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) stack.push(full);
			} else if (e.isFile()) {
				if (++limits.count > limits.max) {
					limits.truncated = true;
					return;
				}
				yield full;
			}
		}
	}
}

function isKubernetesManifest(text) {
	return /^apiVersion:/m.test(text) && /^kind:\s*(Deployment|StatefulSet|DaemonSet|Service|Ingress|HorizontalPodAutoscaler|CronJob)\b/m.test(text);
}

export function detectVendors(root, { signatures, maxFiles = 5000 } = {}) {
	root = resolve(root);
	if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`not a directory: ${root}`);
	const sigs = signatures ?? [];
	const found = new Map(); // vendor id -> { evidence, roleHits }
	const unmapped = new Map();
	const envNames = new Set();
	const frameworks = new Map();
	const infra = [];
	let projectFiles = 0;
	const limits = { count: 0, max: maxFiles, truncated: false };

	const hit = (sig, kind, file, match, role) => {
		if (!found.has(sig.id)) found.set(sig.id, { sig, evidence: [], roleHits: new Set() });
		const f = found.get(sig.id);
		if (role) f.roleHits.add(role);
		if (f.evidence.length < MAX_EVIDENCE && !f.evidence.some((e) => e.kind === kind && e.match === match && e.file === file)) {
			f.evidence.push({ kind, file, match });
		}
	};

	for (const full of walk(root, limits)) {
		const rel = relative(root, full).split(sep).join('/');
		const name = basename(full);
		if (!(rel.indexOf('/') === -1 && NON_PROJECT_FILES.test(name))) projectFiles++;

		if (ENV_FILE.test(name)) {
			let names = [];
			try {
				names = readEnvNames(readFileSync(full, 'utf8'));
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

		if (name === 'package.json') {
			let pkg;
			try {
				pkg = JSON.parse(readFileSync(full, 'utf8'));
			} catch {
				continue;
			}
			const deps = dependencyNames(pkg);
			const m = matchPackages(deps, sigs);
			for (const v of m.vendors) for (const p of v.packages) hit(sigs.find((s) => s.id === v.id), 'package', rel, p);
			for (const u of m.unmapped) {
				if (!unmapped.has(u.name)) unmapped.set(u.name, { name: u.name, role: u.role, evidence: [] });
				for (const p of u.packages) unmapped.get(u.name).evidence.push({ kind: 'package', file: rel, match: p });
			}
			for (const d of deps) if (FRAMEWORK_PACKAGES[d] && !frameworks.has(FRAMEWORK_PACKAGES[d])) frameworks.set(FRAMEWORK_PACKAGES[d], { name: FRAMEWORK_PACKAGES[d], package: d, file: rel });
			continue;
		}

		if (name === 'Dockerfile' || /^Dockerfile\./.test(name)) infra.push({ kind: 'docker', file: rel });
		else if (/^(docker-)?compose(\.[\w-]+)?\.ya?ml$/.test(name)) infra.push({ kind: 'docker-compose', file: rel });
		else if (/\.tf$/.test(name)) infra.push({ kind: 'terraform', file: rel });
		else if (name === 'Chart.yaml') infra.push({ kind: 'helm', file: rel });
		else if (/^(helmfile|skaffold|kustomization)\.ya?ml$/.test(name)) infra.push({ kind: 'kubernetes', file: rel });
		else if (/^Pulumi\.ya?ml$/.test(name)) infra.push({ kind: 'pulumi', file: rel });
		else if (/^serverless\.ya?ml$/.test(name)) infra.push({ kind: 'serverless-framework', file: rel });
		else if (/\.ya?ml$/.test(name)) {
			try {
				if (statSync(full).size < 256 * 1024 && isKubernetesManifest(readFileSync(full, 'utf8'))) infra.push({ kind: 'kubernetes', file: rel });
			} catch {}
		}

		if (SOURCE_EXT.test(name)) {
			let src;
			try {
				if (statSync(full).size > MAX_SOURCE_BYTES) continue;
				src = readFileSync(full, 'utf8');
			} catch {
				continue;
			}
			const specs = extractImports(src);
			for (const sig of sigs) {
				for (const spec of specs) if (sig.imports.some((p) => spec.startsWith(p))) hit(sig, 'import', rel, spec);
				for (const [role, needles] of Object.entries(sig.role_signals ?? {})) {
					const needle = needles.find((n) => src.includes(n));
					if (needle) hit(sig, 'code', rel, needle, role);
				}
			}
		}
	}

	const vendors = [...found.values()]
		.map(({ sig, evidence, roleHits }) => {
			// Roles with signals count only when a signal matched; other roles count once the vendor is present.
			const signalled = Object.keys(sig.role_signals ?? {});
			const roles_used = sig.roles.filter((r) => !signalled.includes(r) || roleHits.has(r));
			return { id: sig.id, name: sig.name, roles: sig.roles, roles_used, evidence };
		})
		.sort((a, b) => a.id.localeCompare(b.id));

	const byRole = new Map();
	for (const v of vendors) for (const r of v.roles_used) byRole.set(r, [...(byRole.get(r) ?? []), v.id]);
	for (const u of unmapped.values()) if (u.role !== 'other') byRole.set(u.role, [...(byRole.get(u.role) ?? []), u.name]);
	const overlaps = [...byRole].filter(([, ids]) => ids.length > 1).map(([role, ids]) => ({ role, vendors: ids }));

	return {
		root,
		empty: projectFiles === 0,
		scanned_files: Math.min(limits.count, limits.max),
		truncated: limits.truncated,
		vendors,
		unmapped: [...unmapped.values()],
		overlaps,
		frameworks: [...frameworks.values()],
		infra,
		env_names: [...envNames].sort(),
	};
}

function defaultVendorsDir() {
	const here = dirname(fileURLToPath(import.meta.url));
	// Inside a skill: <skill>/scripts/detect.mjs next to <skill>/vendors. In the repo: packages/core/src.
	for (const dir of [join(here, '..', 'vendors'), join(here, '..', '..', '..', 'catalog', 'vendors')]) if (existsSync(dir)) return dir;
	return null;
}

export function detectMain(argv) {
	const args = parseArgs(argv);
	if (args.help) {
		process.stdout.write('usage: node detect.mjs [repo-dir] [--vendors <dir>] [--max-files N]\nPrints JSON: vendors with evidence, unmapped SDKs, overlaps, frameworks, infra, env var names (never values).\n');
		return;
	}
	const vendorsDir = args.vendors || defaultVendorsDir();
	if (!vendorsDir) fail('vendor maps not found; pass --vendors <dir>');
	const signatures = vendorSignatures(loadCatalog(vendorsDir));
	try {
		printJson(detectVendors(args._[0] ?? '.', { signatures, maxFiles: Number(args['max-files']) || 5000 }));
	} catch (e) {
		fail(e.message);
	}
}

if (isMain(import.meta.url)) detectMain(process.argv.slice(2)); // @main
