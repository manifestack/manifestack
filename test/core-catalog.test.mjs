import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { loadCatalog, parseVendorMap, validateVendorMap, packageClashes } from '../packages/core/src/catalog.mjs';
import { parseYaml, parseFrontmatter } from '../packages/core/src/yaml.mjs';

const VENDORS_DIR = join(ROOT, 'catalog/vendors');
const ALL_IDS = readdirSync(VENDORS_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => f.slice(0, -3)).sort();

test('every vendor map is valid, with usage questions and notes', () => {
	const vendors = loadCatalog(VENDORS_DIR);
	assert.deepEqual(vendors.map((v) => v.id), ALL_IDS);
	for (const id of ['clerk', 'neon', 'resend', 'supabase', 'vercel', 'stripe', 'openai', 'anthropic', 'sentry', 'cloudflare', 'firebase', 'fly']) assert.ok(ALL_IDS.includes(id), id);
	for (const v of vendors) {
		assert.deepEqual(validateVendorMap(v), [], v.id);
		assert.ok(v.usage_questions.length, `${v.id} has usage questions`);
		assert.ok(v.notes.length, `${v.id} has notes`);
	}
});

test('maps hold no prices', () => {
	for (const id of ALL_IDS) {
		const text = readFileSync(join(VENDORS_DIR, `${id}.md`), 'utf8');
		const price = /[$€£]\s?\d|\d\s?[€£]|\b(?:USD|EUR|GBP)\s?\d|\d\s?(?:USD|EUR|GBP)\b/.exec(text);
		assert.ok(!price, `${id}.md contains a price ("${price?.[0]}"); prices are read from the page at run time`);
	}
});

test('read-only MCP use only with an allowlist of read-only tools', () => {
	const vendors = loadCatalog(VENDORS_DIR);
	for (const id of ['supabase', 'neon']) assert.ok(vendors.find((v) => v.id === id).mcp.readonly_flag, id);
	for (const id of ['vercel', 'resend', 'clerk']) assert.equal(vendors.find((v) => v.id === id).mcp.readonly_flag, null, id);
	const forbidden = /^(apply_|create_|delete_|deploy_|update_|merge_|reset_|rebase_|pause_|restore_|send_|cancel_|refund_|set_|add_|remove_|get_publishable_keys|list_credentials|get_connection_string|prepare_|complete_)|(_key|_keys|_secret|_secrets|_token|_tokens)$/;
	for (const v of vendors) {
		if (!v.mcp?.readonly_flag) {
			assert.ok(!v.mcp?.allowed_tools?.length, `${v.id}: tools listed without a read-only mode`);
			continue;
		}
		assert.ok(v.mcp.allowed_tools.length, v.id);
		for (const tool of v.mcp.allowed_tools) assert.ok(!forbidden.test(tool), `${v.id}: ${tool} is not read-only`);
	}
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

test('yaml: an apostrophe inside a plain scalar does not hide a comment', () => {
	assert.deepEqual(parseYaml(`ask: What's the MAU? # note\nq: say "hi" # note\nr: 'it''s # kept'  # note`), { ask: "What's the MAU?", q: 'say "hi"', r: "it's # kept" });
	assert.deepEqual(parseYaml('- {a: 1}\n- [x, "y # z"] # note'), [{ a: 1 }, ['x', 'y # z']]);
});

test('yaml: duplicate keys are an error', () => {
	assert.throws(() => parseYaml('a: 1\nb: 2\na: 3'), /duplicate key "a"/);
	assert.throws(() => parseYaml('d:\n  x: 1\n  x: 2'), /duplicate key "x"/);
	assert.throws(() => parseYaml('m: {x: 1, x: 2}'), /duplicate key "x"/);
	assert.deepEqual(parseFrontmatter('\uFEFF---\na: 1\n---\nbody').data, { a: 1 });
});

test('detect fields must be lists of non-empty strings', () => {
	const template = readFileSync(join(ROOT, 'catalog/vendors/_template.md'), 'utf8');
	const withDetect = (detect) => validateVendorMap(parseVendorMap(template.replace(/^detect:\n(?: {2}.*\n)+/m, `detect:\n${detect}\n`)));
	assert.deepEqual(withDetect('  packages: ["stripe"]'), []);
	assert.ok(withDetect('  packages: stripe').includes('detect.packages must be a list of non-empty strings'));
	assert.ok(withDetect('  packages: ["x"]\n  imports: [""]').includes('detect.imports must be a list of non-empty strings'));
	assert.ok(withDetect('  packages: ["x"]\n  go: [1]').includes('detect.go must be a list of non-empty strings'));
	assert.ok(withDetect('  packages: ["x"]\n  role_signals: ["send("]').includes('detect.role_signals must map roles to lists'));
	assert.ok(withDetect('  packages: ["x"]\n  role_signals:\n    auth: "send("').includes('role_signals.auth must be a list of non-empty strings'));
	assert.ok(withDetect('  packages: []').includes('detect needs at least one signature'));
});

test('two maps cannot claim the same package', () => {
	const vendors = loadCatalog(VENDORS_DIR);
	assert.deepEqual(packageClashes(vendors), []);
	const copy = { id: 'copy', detect: { packages: ['@clerk/'], pypi: ['Clerk_Backend.API'], go: [] } };
	assert.deepEqual(packageClashes([...vendors, copy]), ['clerk.md and copy.md both claim detect.packages "@clerk/"', 'clerk.md and copy.md both claim detect.pypi "Clerk_Backend.API"']);
});
