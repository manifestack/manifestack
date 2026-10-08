import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT, runNode, tempDir } from './helpers.mjs';
import { plan, stale, bundle, declaredNames } from '../tools/sync.mjs';

function write(dir, files) {
	for (const [rel, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), text);
	}
}

test('generated copies match their sources (run: node tools/sync.mjs)', () => {
	const r = runNode(join(ROOT, 'tools/sync.mjs'), ['--check']);
	assert.equal(r.code, 0, r.stderr);
});

test('every generated file carries the banner', async () => {
	for (const f of await plan()) assert.match(f.content.split('\n').slice(0, 2).join('\n'), /generated, edit /, f.path);
});

test('bundled scripts import only node: built-ins', async () => {
	for (const f of await plan()) {
		if (!f.path.endsWith('.mjs')) continue;
		for (const m of f.content.matchAll(/^import .* from '([^']+)';$/gm)) assert.match(m[1], /^node:/, `${f.path} imports ${m[1]}`);
		assert.ok(!/\bfetch\(|node:https?|node:net/.test(f.content), `${f.path} must not use the network`);
	}
});

test('the hook embeds vendor signatures', () => {
	const hook = readFileSync(join(ROOT, 'hooks/new-vendor.mjs'), 'utf8');
	const embedded = JSON.parse(/let EMBEDDED_SIGNATURES = (\[.*\]);/.exec(hook)[1]);
	assert.deepEqual(embedded.map((s) => s.id), readdirSync(join(ROOT, 'catalog/vendors')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => f.slice(0, -3)).sort());
});

test('vendor copies still parse as vendor maps', async () => {
	const { loadCatalog } = await import('../packages/core/src/catalog.mjs');
	assert.equal(loadCatalog(join(ROOT, 'skills/manifestack/vendors')).length, loadCatalog(join(ROOT, 'catalog/vendors')).length);
});

test('stale: removes generated copies whose source is gone, never hand-written files', (t) => {
	const dir = tempDir(t);
	write(dir, {
		'skills/manifestack/references/security.md': '<!-- generated, edit catalog/shared/security.md (then run: node tools/sync.mjs) -->\n',
		'skills/manifestack/references/old-shared.md': '<!-- generated, edit catalog/shared/old-shared.md (then run: node tools/sync.mjs) -->\n',
		'skills/manifestack/references/fit.md': '# Fit\n',
		'skills/manifestack/vendors/gone.md': '---\n# generated, edit catalog/vendors/gone.md (then run: node tools/sync.mjs)\nid: gone\n---\n',
		'skills/manifestack-guard/scripts/old.mjs': '// anything in an owned folder\n',
		'hooks/hooks.json': '{}\n',
		'hooks/old-hook.mjs': '// generated, edit catalog/ or packages/core/ (then run: node tools/sync.mjs)\n',
	});
	const files = [{ path: 'skills/manifestack/references/security.md' }];
	assert.deepEqual(stale(files, dir), ['hooks/old-hook.mjs', 'skills/manifestack-guard/scripts/old.mjs', 'skills/manifestack/references/old-shared.md', 'skills/manifestack/vendors/gone.md']);
});

test('bundle: re-exports and multi-line export lists are errors, not silently dropped', (t) => {
	const dir = tempDir(t);
	write(dir, {
		'entry.mjs': "import { a } from './a.mjs';\nexport const main = () => a;\n",
		'a.mjs': "export { b } from './b.mjs';\n",
		'b.mjs': 'export const b = 1;\n',
		'entry2.mjs': "import { c } from './c.mjs';\nexport const main = () => c;\n",
		'c.mjs': 'const c = 1;\nexport {\n\tc,\n};\n',
		'entry3.mjs': "export * from './b.mjs';\n",
	});
	assert.throws(() => bundle(join(dir, 'entry.mjs')), /re-exports are not supported/);
	assert.throws(() => bundle(join(dir, 'entry2.mjs')), /export lists must be on one line/);
	assert.throws(() => bundle(join(dir, 'entry3.mjs')), /re-exports are not supported/);
});

test('bundle: top-level name collisions are caught, destructuring included', (t) => {
	assert.deepEqual(declaredNames('export const { a, b: c, d = 1, ...rest } = obj;'), ['a', 'c', 'd', 'rest']);
	assert.deepEqual(declaredNames('const [x, , y] = list;'), ['x', 'y']);
	assert.deepEqual(declaredNames('export async function go() {'), ['go']);
	assert.deepEqual(declaredNames('\tconst inner = 1;'), []);
	const dir = tempDir(t);
	write(dir, {
		'entry.mjs': "import { one } from './one.mjs';\nimport { two } from './two.mjs';\nexport const main = () => one + two;\n",
		'one.mjs': 'const { shared } = globalThis;\nexport const one = shared;\n',
		'two.mjs': 'const shared = 2;\nexport const two = shared;\n',
	});
	assert.throws(() => bundle(join(dir, 'entry.mjs')), /top-level name "shared" is declared in both/);
});
