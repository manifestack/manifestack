#!/usr/bin/env node
// Lays out copies of the sources of truth:
//   catalog/vendors/*.md   -> skills/<skill>/vendors/
//   catalog/shared/*.md    -> skills/<skill>/references/
//   packages/core/src/*.mjs -> skills/<skill>/scripts/ and hooks/new-vendor.mjs (one file each, no deps)
//
//   node tools/sync.mjs                      write the copies
//   node tools/sync.mjs --check              fail if a copy differs from its source (CI)
//   node tools/sync.mjs --into packages/cli  also copy skills/, hooks/, README and LICENSE into a package (prepack)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const BANNER_JS = '// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)';
const bannerMd = (src) => `<!-- generated, edit ${src} (then run: node tools/sync.mjs) -->`;

/** Bundles a core module and its local imports into one dependency-free ES module. */
export function bundle(entryFile, embeds = {}) {
	const seen = new Set();
	const nodeImports = new Map();
	const names = new Map();
	const parts = [];

	function visit(file, isEntry) {
		if (seen.has(file)) return;
		seen.add(file);
		const rel = relative(ROOT, file);
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
			if (!isEntry && /\/\/ @main\s*$/.test(line)) continue;
			const embed = /^let (\w+) = null; \/\/ @embed:(\w+)\s*$/.exec(line);
			if (embed) {
				if (!(embed[2] in embeds)) throw new Error(`${rel}: no value for @embed:${embed[2]}`);
				body.push(`let ${embed[1]} = ${JSON.stringify(embeds[embed[2]])};`);
				continue;
			}
			const decl = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
			if (decl) {
				if (names.has(decl[1]) && names.get(decl[1]) !== rel) throw new Error(`top-level name "${decl[1]}" is declared in both ${names.get(decl[1])} and ${rel}`);
				names.set(decl[1], rel);
			}
			if (isEntry) body.push(line);
			else if (/^export\s+\{/.test(line)) continue;
			else body.push(line.replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/, ''));
		}
		for (const dep of deps) visit(dep, false);
		parts.push(`// ---- ${relative(ROOT, file)}\n${body.join('\n').trim()}\n`);
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
	const { loadCatalog, vendorSignatures } = await import(join(CORE, 'catalog.mjs'));
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

function stale(files) {
	const wanted = new Set(files.map((f) => f.path));
	const out = [];
	for (const dir of OWNED_DIRS) {
		const abs = join(ROOT, dir);
		if (!existsSync(abs)) continue;
		for (const f of readdirSync(abs)) if (!wanted.has(`${dir}/${f}`)) out.push(`${dir}/${f}`);
	}
	return out;
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
		if (!target.startsWith(join(ROOT, 'packages') + '/')) throw new Error('--into must point to a folder in packages/');
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
