#!/usr/bin/env node
// Lays out copies of the sources of truth:
//   catalog/vendors/*.md   -> skills/<skill>/vendors/
//   catalog/shared/*.md    -> skills/<skill>/references/
//   packages/core/src/*.mjs -> skills/<skill>/scripts/ and hooks/new-vendor.mjs (one file each, no deps)
//
//   node tools/sync.mjs                      write the copies
//   node tools/sync.mjs --check              fail if a copy differs from its source (CI)
//   node tools/sync.mjs --into packages/cli  also copy skills/, hooks/, README and LICENSE into a package (prepack)
//
// Bundling works line by line, so core modules follow a few rules (sync fails if they do not):
//   - imports are one-line named imports from node: or ./ modules, without "as" renames;
//   - no `export ... from` re-exports and no multi-line `export { ... }` lists;
//   - top-level names are unique across the bundled modules. The check sees declarations that
//     start at column 0, including one-line destructuring (`const { a, b: c } = ...`); it does not
//     see nested destructuring or names declared on a continuation line.
// Generated copies whose source is gone are removed: every file in OWNED_DIRS, and elsewhere in
// skills/ and hooks/ only files that carry the generated banner (hand-written files stay).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(ROOT, 'packages/core/src');
const VENDORS = join(ROOT, 'catalog/vendors');
const SHARED = join(ROOT, 'catalog/shared');

// Which skill receives which data and scripts. A new skill gets a line here (see CONTRIBUTING.md).
const SKILLS = {
	manifestack: { vendors: true, scripts: ['detect', 'project', 'stack-md'], shared: ['security'] },
	'manifestack-guard': { vendors: false, scripts: ['stack-md'], shared: ['security'] },
};
// Directories that sync owns completely: files without a source there are removed.
const OWNED_DIRS = Object.entries(SKILLS).flatMap(([name, s]) => [s.vendors && `skills/${name}/vendors`, s.scripts.length && `skills/${name}/scripts`].filter(Boolean));
// Directories that mix generated and hand-written files: only files with the banner are removed.
const MIXED_DIRS = [...Object.keys(SKILLS).flatMap((name) => ['references', 'vendors', 'scripts'].map((d) => `skills/${name}/${d}`)), 'hooks'].filter((d) => !OWNED_DIRS.includes(d));

const BANNER_JS = '// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)';
const bannerMd = (src) => `<!-- generated, edit ${src} (then run: node tools/sync.mjs) -->`;

/** Top-level names a line declares, if it starts with a declaration (one-line destructuring included). */
export function declaredNames(line) {
	const simple = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
	if (simple) return [simple[1]];
	const destructured = /^(?:export\s+)?(?:const|let|var)\s*([{[])(.*)([}\]])\s*=/.exec(line);
	if (!destructured) return [];
	return destructured[2]
		.split(',')
		.map((part) => part.split('=')[0].trim().replace(/^\.\.\./, ''))
		.map((part) => (part.includes(':') ? part.split(':').pop().trim() : part))
		.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/** Bundles a core module and its local imports into one dependency-free ES module. */
export function bundle(entryFile, embeds = {}) {
	const seen = new Set();
	const nodeImports = new Map();
	const names = new Map();
	const parts = [];

	function visit(file, isEntry) {
		if (seen.has(file)) return;
		seen.add(file);
		const rel = relative(ROOT, file).split('\\').join('/');
		const deps = [];
		const body = [];
		for (const line of readFileSync(file, 'utf8').split('\n')) {
			if (/^import\s/.test(line)) {
				const m = /^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$/.exec(line);
				if (!m) throw new Error(`${rel}: imports must be one-line named imports: ${line}`);
				const specifiers = m[1].split(',').map((s) => s.trim()).filter(Boolean);
				if (specifiers.some((s) => /\s/.test(s))) throw new Error(`${rel}: "as" renames are not supported: ${line}`);
				if (m[2].startsWith('./')) deps.push(join(dirname(file), m[2]));
				else if (m[2].startsWith('node:')) {
					if (!nodeImports.has(m[2])) nodeImports.set(m[2], new Set());
					for (const s of specifiers) nodeImports.get(m[2]).add(s);
				} else throw new Error(`${rel}: only node: and relative imports are allowed (scripts have no dependencies): ${m[2]}`);
				continue;
			}
			if (/^export\s*\*/.test(line) || /^export\s*\{[^}]*\}\s*from\b/.test(line)) throw new Error(`${rel}: re-exports are not supported; import the names and export them from the module that uses them: ${line}`);
			if (/^export\s*\{/.test(line) && !line.includes('}')) throw new Error(`${rel}: export lists must be on one line: ${line}`);
			if (!isEntry && /\/\/ @main\s*$/.test(line)) continue;
			const embed = /^let (\w+) = null; \/\/ @embed:(\w+)\s*$/.exec(line);
			if (embed) {
				if (!(embed[2] in embeds)) throw new Error(`${rel}: no value for @embed:${embed[2]}`);
				body.push(`let ${embed[1]} = ${JSON.stringify(embeds[embed[2]])};`);
				continue;
			}
			for (const name of declaredNames(line)) {
				if (names.has(name) && names.get(name) !== rel) throw new Error(`top-level name "${name}" is declared in both ${names.get(name)} and ${rel}`);
				names.set(name, rel);
			}
			if (isEntry) body.push(line);
			else if (/^export\s+\{/.test(line)) continue;
			else body.push(line.replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/, ''));
		}
		for (const dep of deps) visit(dep, false);
		parts.push(`// ---- ${rel}\n${body.join('\n').trim()}\n`);
	}

	visit(entryFile, true);
	const header = [...nodeImports].sort(([a], [b]) => a.localeCompare(b)).map(([mod, s]) => `import { ${[...s].sort().join(', ')} } from '${mod}';`);
	return `${BANNER_JS}\n${header.join('\n')}\n\n${parts.join('\n')}`;
}

function vendorCopy(text, srcRel) {
	// The banner goes inside the frontmatter as a YAML comment so the file still parses.
	if (!text.startsWith('---\n')) throw new Error(`${srcRel}: vendor map must start with frontmatter`);
	return `---\n# generated, edit ${srcRel} (then run: node tools/sync.mjs)\n${text.slice(4)}`;
}

async function signatures() {
	const { loadCatalog, vendorSignatures } = await import(pathToFileURL(join(CORE, 'catalog.mjs')).href);
	return vendorSignatures(loadCatalog(VENDORS));
}

/** Every generated file: { path (repo-relative), content }. */
export async function plan() {
	const files = [];
	const vendorFiles = readdirSync(VENDORS).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
	for (const [name, spec] of Object.entries(SKILLS)) {
		if (spec.vendors) {
			for (const f of vendorFiles) files.push({ path: `skills/${name}/vendors/${f}`, content: vendorCopy(readFileSync(join(VENDORS, f), 'utf8'), `catalog/vendors/${f}`) });
		}
		for (const s of spec.scripts) files.push({ path: `skills/${name}/scripts/${s}.mjs`, content: bundle(join(CORE, `${s}.mjs`)) });
		for (const s of spec.shared) files.push({ path: `skills/${name}/references/${s}.md`, content: `${bannerMd(`catalog/shared/${s}.md`)}\n\n${readFileSync(join(SHARED, `${s}.md`), 'utf8')}` });
	}
	files.push({ path: 'hooks/new-vendor.mjs', content: bundle(join(CORE, 'hook.mjs'), { signatures: await signatures() }) });
	return files;
}

const isGenerated = (abs) => readFileSync(abs, 'utf8').split('\n').slice(0, 2).some((l) => l.includes('generated, edit '));

/** Generated files under `root` that no source produces any more (repo-relative paths). */
export function stale(files, root = ROOT) {
	const wanted = new Set(files.map((f) => f.path));
	const out = [];
	for (const [dirs, owned] of [[OWNED_DIRS, true], [MIXED_DIRS, false]]) {
		for (const dir of dirs) {
			const abs = join(root, dir);
			if (!existsSync(abs)) continue;
			for (const e of readdirSync(abs, { withFileTypes: true })) {
				const rel = `${dir}/${e.name}`;
				if (!e.isFile() || wanted.has(rel)) continue;
				if (owned || isGenerated(join(abs, e.name))) out.push(rel);
			}
		}
	}
	return out.sort();
}

async function main(argv) {
	const files = await plan();
	if (argv.includes('--check')) {
		const problems = [];
		for (const f of files) {
			const abs = join(ROOT, f.path);
			if (!existsSync(abs)) problems.push(`missing  ${f.path}`);
			else if (readFileSync(abs, 'utf8') !== f.content) problems.push(`differs  ${f.path}`);
		}
		for (const p of stale(files)) problems.push(`stale    ${p}`);
		if (problems.length) {
			console.error(`Generated copies are out of date. Run: node tools/sync.mjs\n${problems.join('\n')}`);
			process.exit(1);
		}
		console.log(`sync: ${files.length} generated files match their sources`);
		return;
	}
	let changed = 0;
	for (const f of files) {
		const abs = join(ROOT, f.path);
		if (existsSync(abs) && readFileSync(abs, 'utf8') === f.content) continue;
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, f.content);
		changed++;
	}
	for (const p of stale(files)) {
		rmSync(join(ROOT, p));
		changed++;
	}
	console.log(`sync: ${files.length} generated files, ${changed} updated`);

	const into = argv.indexOf('--into');
	if (into !== -1) {
		const target = resolve(ROOT, argv[into + 1] ?? '');
		if (!target.startsWith(join(ROOT, 'packages') + sep)) throw new Error('--into must point to a folder in packages/');
		for (const dir of ['skills', 'hooks']) {
			rmSync(join(target, dir), { recursive: true, force: true });
			cpSync(join(ROOT, dir), join(target, dir), { recursive: true });
		}
		for (const f of ['README.md', 'LICENSE']) cpSync(join(ROOT, f), join(target, f));
		console.log(`sync: copied skills/, hooks/, README.md and LICENSE into ${relative(ROOT, target)}`);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).catch((e) => {
		console.error(`sync: ${e.message}`);
		process.exit(1);
	});
}
