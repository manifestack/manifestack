import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { loadCatalog, parseVendorMap, validateVendorMap } from '../packages/core/src/catalog.mjs';
import { parseYaml, parseFrontmatter } from '../packages/core/src/yaml.mjs';

const MVP_VENDORS = ['clerk', 'neon', 'resend', 'supabase', 'vercel'];

test('catalog has the five MVP vendor maps and they are valid', () => {
	const vendors = loadCatalog(join(ROOT, 'catalog/vendors'));
	assert.deepEqual(vendors.map((v) => v.id), MVP_VENDORS);
	for (const v of vendors) {
		assert.deepEqual(validateVendorMap(v), [], v.id);
		assert.ok(v.usage_questions.length, `${v.id} has usage questions`);
		assert.ok(v.notes.length, `${v.id} has notes`);
	}
});

test('maps hold no prices', () => {
	for (const id of MVP_VENDORS) {
		const text = readFileSync(join(ROOT, 'catalog/vendors', `${id}.md`), 'utf8');
		assert.ok(!/\$\s?\d/.test(text), `${id}.md contains a dollar amount; prices are read from the page at run time`);
	}
});

test('read-only MCP only for Supabase and Neon, with allowlists', () => {
	const vendors = Object.fromEntries(loadCatalog(join(ROOT, 'catalog/vendors')).map((v) => [v.id, v]));
	for (const id of ['supabase', 'neon']) {
		assert.ok(vendors[id].mcp.readonly_flag, id);
		assert.ok(vendors[id].mcp.allowed_tools.length, id);
	}
	for (const id of ['vercel', 'resend', 'clerk']) assert.equal(vendors[id].mcp.readonly_flag, null, id);
	const forbidden = /^(apply_|create_|delete_|deploy_|update_|merge_|reset_|rebase_|pause_|restore_|get_publishable_keys|list_credentials|get_connection_string|prepare_|complete_)/;
	for (const id of ['supabase', 'neon']) for (const tool of vendors[id].mcp.allowed_tools) assert.ok(!forbidden.test(tool), `${id}: ${tool} is not read-only`);
});

test('the template parses but is skipped by loadCatalog', () => {
	const t = parseVendorMap(readFileSync(join(ROOT, 'catalog/vendors/_template.md'), 'utf8'));
	assert.equal(t.id, 'example');
	assert.deepEqual(validateVendorMap(t), []);
});

test('unsupported schema versions are rejected', () => {
	assert.throws(() => parseVendorMap('---\nschema: 2\nid: x\n---\n'), /unsupported vendor map schema 2/);
});

test('yaml subset: maps, lists, lists of maps, inline values, comments', () => {
	const data = parseYaml(`a: 1
b: "x # not a comment"  # comment
c: [one, "two, three", 'it''s']
d:
  e: true
  f: null
list:
  - plain item
  - key: v
    other: w
nested:
- x
- y
url: https://example.com/a#b
empty:
`);
	assert.deepEqual(data, { a: 1, b: 'x # not a comment', c: ['one', 'two, three', "it's"], d: { e: true, f: null }, list: ['plain item', { key: 'v', other: 'w' }], nested: ['x', 'y'], url: 'https://example.com/a#b', empty: null });
	assert.deepEqual(parseFrontmatter('no frontmatter').data, {});
	assert.throws(() => parseYaml('a: 1\n   b: 2'), /indentation|parse/);
});
