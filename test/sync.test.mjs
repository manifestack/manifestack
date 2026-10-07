import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, runNode } from './helpers.mjs';
import { plan } from '../tools/sync.mjs';

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
