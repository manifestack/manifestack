// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
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
function readEnvNames(text) {
	const names = [];
	for (const line of text.split(/\r?\n/)) {
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
		if (m) names.push(m[1]);
	}
	return names;
}

function extractImports(source) {
	const specs = new Set();
	const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"\n]+)['"]/gm;
	let m;
	while ((m = re.exec(source))) specs.add(m[1]);
	return [...specs];
}

function dependencyNames(pkgJson) {
	const names = new Set();
	for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
		for (const name of Object.keys(pkgJson?.[field] ?? {})) names.add(name);
	}
	return [...names];
}

/** Which mapped vendors and unmapped SDKs a list of package names contains. */
function matchPackages(packages, signatures) {
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

function detectVendors(root, { signatures, maxFiles = 5000 } = {}) {
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

function detectMain(argv) {
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

// ---- packages/core/src/project.mjs
// Cost and limit projections. Prices are inputs: the skill reads them from vendor pages at run time.
// Sizes are decimal (1 GB = 1000 MB), as vendors bill them. Money is USD. No network.

const SIZE_UNITS = { B: 1e-6, KB: 1e-3, MB: 1, GB: 1e3, TB: 1e6 };
const PERIOD_DAYS = { day: 1, d: 1, week: 7, wk: 7, w: 7, month: 30.4375, mo: 30.4375, year: 365.25, yr: 365.25 };
const DAY_MS = 86400000;

/**
 * Parses "312 MB", "+1.1 MB/day", "$25/mo", "41,200", "9k", "18%/mo", "3.4 TB".
 * Returns { value, dim, per } where value is in base units (MB for size, USD for money, 1 for count,
 * percent for pct) and `per` is the period in days for rates (null otherwise).
 */
function parseQuantity(input) {
	if (typeof input === 'number') return { value: input, dim: 'count', per: null };
	const s = String(input).trim();
	const m = /^([+-])?\s*(\$)?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([kKmM](?![bB]))?\s*(%|[KMGT]?B\b)?\s*(?:\/\s*(day|d|week|wk|w|month|mo|year|yr))?$/i.exec(s);
	if (!m) throw new Error(`cannot read quantity "${input}"`);
	const [, sign, dollar, num, mult, unit, period] = m;
	let value = Number(num.replace(/,/g, ''));
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

function round(n, digits = 2) {
	const f = 10 ** digits;
	return Math.round(n * f) / f;
}

function addDays(iso, days) {
	return new Date(Date.parse(iso + 'T00:00:00Z') + Math.round(days) * DAY_MS).toISOString().slice(0, 10);
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
	const base = { current, limit, from };
	if (current >= limit) return { ...base, reached: true, days: 0, date: from, when: 'Now' };
	let days;
	let method;
	if (growthPerMonth != null) {
		if (growthPerMonth <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'compound' };
		days = (Math.log(limit / current) / Math.log(1 + growthPerMonth)) * PERIOD_DAYS.mo;
		method = 'compound';
	} else if (ratePerDay != null) {
		if (ratePerDay <= 0) return { ...base, reached: false, days: null, date: null, when: 'Not on current trend', method: 'linear' };
		days = (limit - current) / ratePerDay;
		method = 'linear';
	} else {
		throw new Error('eta needs a rate, a monthly growth or two data points');
	}
	const date = addDays(from, days);
	return { ...base, reached: false, method, rate_per_day: ratePerDay ?? null, days: Math.round(days), weeks: round(days / 7, 1), date, when: `ETA ${approxMonth(date)}` };
}

/**
 * Prices a stack at several user counts. Model (all prices come from vendor pages read at run time):
 * { users: [1000, 10000, 100000],
 *   vendors: [{ id, per_user: { transfer_gb: 0.05 }, fixed: { seats: 1 },
 *     plans: [{ name, base, eligible?, metrics: { transfer_gb: { included, price?, per?, hard? } } }] }] }
 * For each count the cheapest eligible plan whose hard limits hold is picked.
 */
function costAt(model) {
	const users = model.users ?? [1000, 10000, 100000];
	return users.map((n) => {
		const vendors = (model.vendors ?? []).map((v) => priceVendor(v, n));
		const monthly = round(vendors.reduce((sum, v) => sum + (v.cost ?? 0), 0), 2);
		return { users: n, monthly, yearly: round(monthly * 12, 2), complete: vendors.every((v) => v.plan), vendors };
	});
}

function priceVendor(v, users) {
	const usage = {};
	for (const [metric, perUser] of Object.entries(v.per_user ?? {})) usage[metric] = perUser * users;
	for (const [metric, fixed] of Object.entries(v.fixed ?? {})) usage[metric] = (usage[metric] ?? 0) + fixed;
	const options = [];
	for (const plan of v.plans ?? []) {
		if (plan.eligible === false) continue;
		let cost = plan.base ?? 0;
		let fits = true;
		const lines = [];
		for (const [metric, rule] of Object.entries(plan.metrics ?? {})) {
			const used = usage[metric] ?? 0;
			const included = rule.included ?? 0;
			if (used > included && (rule.hard || rule.price == null)) {
				fits = false;
				break;
			}
			if (rule.price != null && used > included) {
				const o = overage({ used, included, price: rule.price, per: rule.per ?? 1 });
				cost += o.cost;
				lines.push({ metric, used: round(used, 2), included, over: round(o.over, 2), cost: o.cost });
			}
		}
		if (fits) options.push({ plan: plan.name, cost: round(cost, 2), overage: lines });
	}
	options.sort((a, b) => a.cost - b.cost);
	const usageRounded = Object.fromEntries(Object.entries(usage).map(([k, x]) => [k, round(x, 2)]));
	if (!options.length) return { id: v.id, plan: null, cost: null, usage: usageRounded, note: 'exceeds every listed plan: read the next tier or contact sales' };
	return { id: v.id, ...options[0], usage: usageRounded };
}

function q(args, key) {
	return args[key] == null ? undefined : parseQuantity(args[key]);
}

const USAGE = `usage:
  node project.mjs eta --current "312 MB" --limit "500 MB" --rate "1.1 MB/day" [--from 2026-10-06]
  node project.mjs eta --current 41200 --limit 50000 --growth "18%/mo"
  node project.mjs eta --points "2026-09-06=280 MB,2026-10-06=312 MB" --limit "500 MB"
  node project.mjs overage --used "3.4 TB" --included "1 TB" --price 0.15 --per GB
  node project.mjs cost <model.json | ->
Prints JSON. Prices are inputs: read them from the vendor page first.`;

function projectMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	try {
		if (cmd === 'eta') {
			const limit = q(args, 'limit');
			if (!limit) throw new Error('--limit is required');
			const input = { limit: limit.value, from: args.from || todayIso() };
			if (args.points) {
				input.points = String(args.points).split(',').map((p) => {
					const [date, value] = p.split('=');
					return { date: date.trim(), value: parseQuantity(value).value };
				});
			} else {
				const current = q(args, 'current');
				if (!current) throw new Error('--current or --points is required');
				input.current = current.value;
				if (args.growth) {
					const g = parseQuantity(args.growth);
					input.growthPerMonth = (g.dim === 'pct' ? g.value / 100 : g.value) * (PERIOD_DAYS.mo / (g.per ?? PERIOD_DAYS.mo));
				} else if (args.rate) {
					const r = parseQuantity(args.rate);
					input.ratePerDay = r.value / (r.per ?? 1);
				}
			}
			printJson(eta(input));
		} else if (cmd === 'overage') {
			// --per GB (price per unit of size) or --per 1000 (price per thousand of a count)
			const per = args.per && args.per !== true ? parseQuantity(/^\d/.test(args.per) ? args.per : `1 ${args.per}`).value : 1;
			const used = q(args, 'used');
			if (!used || args.price == null) throw new Error('--used and --price are required');
			const included = q(args, 'included')?.value ?? 0;
			const r = overage({ used: used.value, included, price: Number(args.price), per });
			const unit = args.per && args.per !== true ? String(args.per) : 'unit';
			printJson({ over: round(r.over / per, 2), unit, price: Number(args.price), monthly: r.cost, yearly: round(r.cost * 12, 2) });
		} else if (cmd === 'cost') {
			const file = args._[1];
			if (!file) throw new Error('pass a model file or - for stdin');
			printJson(costAt(JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'))));
		} else {
			process.stdout.write(USAGE + '\n');
			if (cmd && cmd !== 'help') process.exitCode = 1;
		}
	} catch (e) {
		fail(e.message);
	}
}

// ---- packages/core/src/stack-md.mjs
// Reads and updates STACK.md, evaluates `revisit_when` and keeps secrets out of the file.
// Updates touch only the named fields: other lines, unknown keys and user comments stay as they are.

const STACK_ROLES = ['Hosting', 'Database', 'Auth', 'Email', 'Storage', 'Payments', 'Monitoring', 'Other'];
const STACK_KEYS = ['plan', 'limit', 'source', 'usage', 'decided', 'revisit_when', 'next', 'env'];
const REQUIREMENT_KEYS = ['budget', 'users', 'requires', 'team_knows'];
const REVISIT_METRICS = ['db_size', 'monthly_sent', 'daily_peak', 'transfer_tb', 'mau', 'users', 'monthly_bill', 'date'];

const SECRET_PATTERNS = [
	['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
	['URL with credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@\S+/i],
	['API key (sk_/pk_/rk_)', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/],
	['Supabase key', /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/],
	['Resend key', /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9_]{8,}|\bre_[A-Za-z0-9]{24,}/],
	['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/],
	['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
	['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
	['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
	['Neon API key', /\bnapi_[A-Za-z0-9]{16,}/],
	// Only names that usually hold secrets: NODE_ENV=production in a note is fine.
	['env assignment', /\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|DSN|CREDENTIALS?|PRIVATE)[A-Z0-9_]*\s*=\s*['"]?[^\s'"]{6,}/],
	['long token', /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/],
];

/** Finds strings that look like secrets. STACK.md must never contain one. */
function findSecrets(text) {
	const hits = [];
	text.split(/\r?\n/).forEach((line, idx) => {
		for (const [kind, re] of SECRET_PATTERNS) if (re.test(line)) hits.push({ line: idx + 1, kind });
	});
	return hits;
}

function scrubSecrets(text) {
	let out = text;
	for (const [, re] of SECRET_PATTERNS) out = out.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), '[removed]');
	return out;
}

function splitComment(raw) {
	const m = /(\s+#\s?)(.*)$/.exec(raw);
	if (!m) return { value: raw.trim(), comment: null, commentRaw: '' };
	return { value: raw.slice(0, m.index).trim(), comment: m[2].trim(), commentRaw: raw.slice(m.index) };
}

function parseStackMd(text) {
	const lines = text.split(/\r?\n/);
	const sections = [];
	let current = null;
	let fence = false;
	lines.forEach((line, idx) => {
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) return;
		const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
		if (h) {
			const heading = h[1];
			const rv = /^([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/.exec(heading);
			current = {
				heading,
				kind: /^requirements$/i.test(heading) ? 'requirements' : rv ? 'service' : 'other',
				role: rv ? rv[1] : null,
				vendor: rv ? rv[2] : null,
				line: idx + 1,
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
		if (f && !(f[1] in current.fields)) current.fields[f[1]] = { ...splitComment(f[2]), line: idx + 1 };
	});
	const values = (s) => Object.fromEntries(Object.entries(s.fields).map(([k, v]) => [k, v.value]));
	const req = sections.find((s) => s.kind === 'requirements');
	return {
		requirements: req ? values(req) : null,
		sections: sections.map((s) => ({ heading: s.heading, kind: s.kind, role: s.role, vendor: s.vendor, line: s.line, values: values(s), comments: Object.fromEntries(Object.entries(s.fields).filter(([, v]) => v.comment).map(([k, v]) => [k, v.comment])) })),
	};
}

const sameHeading = (a, b) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Sets fields in one section, creating the section if needed.
 * `updates` is { key: value }, `comments` is { key: comment } (an existing comment is kept unless replaced).
 */
function setFields(text, heading, updates, comments = {}) {
	for (const [k, v] of Object.entries(updates)) {
		if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`invalid key "${k}"`);
		if (/[\r\n]/.test(String(v))) throw new Error(`value for ${k} must be one line`);
		if (findSecrets(`${k}: ${v}`).length) throw new Error(`value for ${k} looks like a secret; STACK.md must not contain secrets`);
	}
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const lines = text.length ? text.split(/\r?\n/) : [];
	let section = parseStackMdRaw(lines).find((s) => sameHeading(s.heading, heading));
	if (!section) {
		while (lines.length && lines.at(-1) === '') lines.pop();
		if (lines.length) lines.push('');
		lines.push(`## ${heading}`);
		section = { headingLine: lines.length - 1, fields: {} };
		lines.push('');
	}
	for (const [key, value] of Object.entries(updates)) {
		const existing = section.fields[key];
		const comment = comments[key] != null ? `  # ${comments[key]}` : existing?.commentRaw ?? '';
		const line = `${key}: ${value}${comment}`;
		if (existing) {
			lines[existing.idx] = line;
			continue;
		}
		const at = insertionIndex(lines, section, key);
		lines.splice(at, 0, line);
		// Re-read positions after the insert.
		section = parseStackMdRaw(lines).find((s) => s.headingLine === section.headingLine);
	}
	let out = lines.join(eol);
	if (!out.endsWith(eol)) out += eol;
	return out.replace(new RegExp(`(${eol}){3,}$`), eol);
}

function parseStackMdRaw(lines) {
	const sections = [];
	let current = null;
	let fence = false;
	lines.forEach((line, idx) => {
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) return;
		const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
		if (h) {
			current = { heading: h[1], headingLine: idx, fields: {}, lastLine: idx };
			sections.push(current);
			return;
		}
		if (/^#\s/.test(line)) {
			current = null;
			return;
		}
		if (!current) return;
		const f = /^([a-z_][a-z0-9_]*)\s*:(.*)$/.exec(line);
		if (f && !(f[1] in current.fields)) {
			current.fields[f[1]] = { idx, ...splitComment(f[2]) };
			current.lastLine = idx;
		}
	});
	return sections;
}

function insertionIndex(lines, section, key) {
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

/**
 * Reads a `usage` value: "312 MB, +1.1 MB/day (2026-10-06)", optionally named
 * ("db_size 312 MB, ..."), several entries separated by ";".
 * Returns { metricName | "_": { value, dim, ratePerDay?, growthPerMonth?, asOf? } }.
 */
function parseUsage(raw) {
	const metrics = {};
	for (const entry of String(raw ?? '').split(';')) {
		let s = entry.trim();
		if (!s) continue;
		const d = /\((\d{4}-\d{2}-\d{2})\)/.exec(s);
		const asOf = d ? d[1] : null;
		if (d) s = s.replace(d[0], '').trim();
		let name = '_';
		const n = /^([a-z_][a-z0-9_]*)(?:\s*[=:]\s*|\s+)(?=[+$\d.])/.exec(s);
		if (n) {
			name = n[1];
			s = s.slice(n[0].length);
		}
		const parts = s.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
		let base;
		try {
			base = parseQuantity(parts[0]);
		} catch {
			continue;
		}
		const m = { value: base.value, dim: base.dim, asOf };
		for (const p of parts.slice(1)) {
			let r;
			try {
				r = parseQuantity(p);
			} catch {
				continue;
			}
			if (r.dim === 'pct') m.growthPerMonth = (r.value / 100) * (30.4375 / (r.per ?? 30.4375));
			else if (r.per) m.ratePerDay = r.value / r.per;
		}
		metrics[name] = m;
	}
	return metrics;
}

function tokenizeRevisit(expr) {
	return String(expr)
		.split(/(\(|\)|\s+AND(?:\s+|$)|\s+OR(?:\s+|$))/i)
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
		const m = /^([a-z_][a-z0-9_]*)\s*(>=|<=|>|<)\s*(.+)$/i.exec(t);
		if (!m) throw new Error(`revisit_when: cannot read "${t}"`);
		const [, metric, op, rawValue] = m;
		if (metric === 'date') {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue.trim())) throw new Error(`revisit_when: date needs YYYY-MM-DD, got "${rawValue}"`);
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

// A unitless threshold on a metric named *_mb, *_gb or *_tb is in that unit.
function thresholdIn(node, metricDim) {
	const unit = /_(mb|gb|tb)$/.exec(node.metric)?.[1];
	if (node.dim === 'count' && unit) return { value: node.value * { mb: 1, gb: 1e3, tb: 1e6 }[unit], dim: 'size' };
	if (node.dim === 'count' && metricDim === 'money') return { value: node.value, dim: 'money' };
	return { value: node.value, dim: node.dim };
}

function evalRevisit(node, ctx) {
	if (node.type === 'manual') return { value: null, eta: null, unknown: [], manual: [node.text] };
	if (node.type === 'cmp') {
		if (node.metric === 'date') {
			const value = compare(ctx.today, node.op, node.date);
			const due = !value && (node.op === '>' || node.op === '>=') ? node.date : null;
			return { value, eta: due, unknown: [], manual: [] };
		}
		const m = ctx.metrics[node.metric];
		if (!m) return { value: null, eta: null, unknown: [node.metric], manual: [] };
		const t = thresholdIn(node, m.dim);
		if (m.dim !== t.dim) return { value: null, eta: null, unknown: [`${node.metric} (unit mismatch: ${m.dim} vs ${t.dim})`], manual: [] };
		const value = compare(m.value, node.op, t.value);
		let due = null;
		if (!value && (node.op === '>' || node.op === '>=') && (m.ratePerDay > 0 || m.growthPerMonth > 0)) {
			due = eta({ current: m.value, limit: t.value, ratePerDay: m.ratePerDay, growthPerMonth: m.growthPerMonth, from: m.asOf ?? ctx.today }).date;
		}
		return { value, eta: due, unknown: [], manual: [] };
	}
	const parts = node.args.map((a) => evalRevisit(a, ctx));
	const merged = { unknown: parts.flatMap((p) => p.unknown), manual: parts.flatMap((p) => p.manual) };
	const etas = parts.map((p) => p.eta).filter(Boolean).sort();
	if (node.type === 'AND') {
		const value = parts.some((p) => p.value === false) ? false : parts.every((p) => p.value === true) ? true : null;
		// All conditions have to hold: the latest of the pending dates, when every pending one has a date.
		const pending = parts.filter((p) => p.value !== true);
		return { value, eta: value === true ? null : pending.every((p) => p.eta) ? pending.map((p) => p.eta).sort().at(-1) : null, ...merged };
	}
	const value = parts.some((p) => p.value === true) ? true : parts.every((p) => p.value === false) ? false : null;
	return { value, eta: value === true ? null : etas[0] ?? null, ...merged };
}

/** Evaluates revisit_when for every service section. `metrics` override what usage says. */
function checkStack(text, { today = todayIso(), metrics = {} } = {}) {
	const doc = parseStackMd(text);
	const global = {};
	const users = doc.requirements?.users && /^\s*([\d.,]+\s*[kKmM]?)/.exec(doc.requirements.users);
	if (users) {
		try {
			global.users = { value: parseQuantity(users[1]).value, dim: 'count' };
		} catch {}
	}
	const results = [];
	for (const s of doc.sections) {
		if (s.kind !== 'service') continue;
		const expr = s.values.revisit_when;
		const base = { heading: s.heading, line: s.line };
		if (!expr) {
			results.push({ ...base, status: 'none' });
			continue;
		}
		let tree;
		try {
			tree = parseRevisit(expr);
		} catch (e) {
			results.push({ ...base, revisit_when: expr, status: 'error', error: e.message });
			continue;
		}
		const usage = parseUsage(s.values.usage);
		const ctxMetrics = { ...global, ...usage, ...metrics };
		const names = [...revisitMetrics(tree)];
		if (usage._ && names.length === 1 && !(names[0] in usage) && !(names[0] in metrics)) ctxMetrics[names[0]] = usage._;
		const r = evalRevisit(tree, { today, metrics: ctxMetrics });
		const status = r.value === true ? 'triggered' : r.value === false ? 'ok' : r.manual.length && !r.unknown.length ? 'manual' : 'unknown';
		results.push({ ...base, revisit_when: expr, status, eta: r.eta, when: status === 'triggered' ? 'Now' : r.eta ? `ETA ${approxMonth(r.eta)}` : r.manual.length ? 'Before launch' : null, unknown: r.unknown, manual: r.manual });
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
	for (const s of doc.sections) {
		if (s.kind === 'other') warnings.push({ line: s.line, message: `heading "${s.heading}" is not "<Role>: <Vendor>"` });
		if (s.kind !== 'service') continue;
		if (!STACK_ROLES.includes(s.role)) warnings.push({ line: s.line, message: `role "${s.role}" is not one of ${STACK_ROLES.join(', ')}` });
		if (s.values.env && /=/.test(s.values.env)) errors.push({ line: s.line, message: 'env lists names only, without values' });
		if (s.values.source && !/\d{4}-\d{2}-\d{2}/.test(`${s.values.source} ${s.comments.source ?? ''}`)) warnings.push({ line: s.line, message: 'source has no read date (add "# read YYYY-MM-DD")' });
		if (s.values.revisit_when) {
			try {
				for (const m of revisitMetrics(parseRevisit(s.values.revisit_when))) if (!REVISIT_METRICS.includes(m)) warnings.push({ line: s.line, message: `revisit_when metric "${m}" is not a standard metric` });
			} catch (e) {
				errors.push({ line: s.line, message: e.message });
			}
		}
	}
	return { ok: errors.length === 0, errors, warnings };
}

const STACK_USAGE = `usage:
  node stack-md.mjs parse [STACK.md]
  node stack-md.mjs check [STACK.md] [--today YYYY-MM-DD] [--metric db_size="420 MB"]...
  node stack-md.mjs lint [STACK.md]
  node stack-md.mjs set [STACK.md] --section "Database: Supabase" --set "plan=free" [--set ...] [--comment "source=read 2026-10-06"]
Prints JSON. set refuses values that look like secrets and keeps every other line as it is.`;

function keyValues(list) {
	const out = {};
	for (const item of [].concat(list ?? [])) {
		const eq = String(item).indexOf('=');
		if (eq < 1) throw new Error(`expected key=value, got "${item}"`);
		out[String(item).slice(0, eq).trim()] = String(item).slice(eq + 1).trim();
	}
	return out;
}

function stackMdMain(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];
	const file = args._[1] ?? 'STACK.md';
	try {
		if (!['parse', 'check', 'lint', 'set'].includes(cmd)) {
			process.stdout.write(STACK_USAGE + '\n');
			if (cmd && cmd !== 'help') process.exitCode = 1;
			return;
		}
		const exists = existsSync(file);
		if (!exists && cmd !== 'set') {
			printJson({ exists: false, file });
			return;
		}
		const text = exists ? readFileSync(file, 'utf8') : '';
		if (cmd === 'parse') printJson({ exists: true, file, ...parseStackMd(text) });
		else if (cmd === 'lint') {
			const r = lintStackMd(text);
			printJson({ file, ...r });
			if (!r.ok) process.exitCode = 2;
		} else if (cmd === 'check') {
			const metrics = {};
			for (const [k, v] of Object.entries(keyValues(args.metric))) {
				const qv = parseQuantity(v);
				metrics[k] = { value: qv.value, dim: qv.dim };
			}
			printJson({ file, ...checkStack(text, { today: args.today || todayIso(), metrics }) });
		} else {
			if (!args.section || args.section === true) throw new Error('--section is required');
			const out = setFields(text, String(args.section), keyValues(args.set), keyValues(args.comment));
			const secrets = findSecrets(out);
			if (secrets.length) {
				process.exitCode = 2;
				throw new Error(`refusing to write: lines ${secrets.map((s) => s.line).join(', ')} look like secrets`);
			}
			writeFileSync(file, out);
			printJson({ file, written: true, section: args.section });
		}
	} catch (e) {
		fail(e.message, process.exitCode || 1);
	}
}

// ---- packages/core/src/hook.mjs
// "New vendor" hook for Claude Code (PostToolUse) and Cursor (afterFileEdit).
// After an edit to package.json it compares dependencies before and after the edit and with the
// services already in STACK.md. A new vendor gets one line of context for the agent; otherwise it
// prints nothing. Offline, never blocks, always exits 0.

// tools/sync.mjs replaces this line with the signatures from catalog/vendors.
let EMBEDDED_SIGNATURES = [{"id":"clerk","name":"Clerk","roles":["auth"],"packages":["@clerk/"],"imports":["@clerk/"],"env_prefixes":["CLERK_","NEXT_PUBLIC_CLERK_","VITE_CLERK_","EXPO_PUBLIC_CLERK_","PUBLIC_CLERK_"],"config_files":[],"role_signals":{}},{"id":"neon","name":"Neon","roles":["database","auth"],"packages":["@neondatabase/serverless","@neondatabase/neon-js","@neondatabase/auth","neonctl"],"imports":["@neondatabase/"],"env_prefixes":["NEON_"],"config_files":[],"role_signals":{"auth":["@neondatabase/auth"]}},{"id":"resend","name":"Resend","roles":["email"],"packages":["resend","@react-email/","react-email"],"imports":["resend","@react-email/"],"env_prefixes":["RESEND_"],"config_files":[],"role_signals":{}},{"id":"supabase","name":"Supabase","roles":["database","auth","storage"],"packages":["@supabase/supabase-js","@supabase/ssr","@supabase/auth-helpers-nextjs","@supabase/auth-helpers-react","@supabase/auth-ui-react","supabase"],"imports":["@supabase/"],"env_prefixes":["SUPABASE_","NEXT_PUBLIC_SUPABASE_","VITE_SUPABASE_","EXPO_PUBLIC_SUPABASE_"],"config_files":["supabase/config.toml"],"role_signals":{"auth":["supabase.auth.","@supabase/auth-helpers","@supabase/auth-ui",".auth.signInWith",".auth.getUser("],"storage":["supabase.storage.",".storage.from("]}},{"id":"vercel","name":"Vercel","roles":["hosting","storage"],"packages":["vercel","@vercel/"],"imports":["@vercel/"],"env_prefixes":["VERCEL_","NEXT_PUBLIC_VERCEL_","BLOB_READ_WRITE_TOKEN"],"config_files":["vercel.json","vercel.ts","vercel.toml"],"role_signals":{"storage":["@vercel/blob"]}}];

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
