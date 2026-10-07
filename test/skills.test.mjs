// Agent Skills format (agentskills.io/specification), plugin manifests and one shared version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { parseFrontmatter } from '../packages/core/src/yaml.mjs';

const SKILLS = readdirSync(join(ROOT, 'skills')).filter((d) => existsSync(join(ROOT, 'skills', d, 'SKILL.md')));
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const VERSION = json('packages/cli/package.json').version;

test('both MVP skills exist', () => assert.deepEqual(SKILLS.sort(), ['manifestack', 'manifestack-guard']));

for (const name of SKILLS) {
	const dir = join(ROOT, 'skills', name);
	const text = readFileSync(join(dir, 'SKILL.md'), 'utf8');
	const { data, body } = parseFrontmatter(text);

	test(`${name}: frontmatter follows the Agent Skills spec`, () => {
		assert.equal(data.name, name, 'name matches the folder');
		assert.match(data.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
		assert.ok(data.name.length <= 64);
		assert.equal(typeof data.description, 'string');
		assert.ok(data.description.length >= 1 && data.description.length <= 1024, `description is ${data.description.length} chars`);
		assert.equal(data.license, 'MIT');
		assert.ok(data.compatibility.length <= 500);
		for (const [k, v] of Object.entries(data.metadata)) assert.equal(typeof v, 'string', `metadata.${k} is a string`);
		const allowed = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
		for (const k of Object.keys(data)) assert.ok(allowed.includes(k), `unexpected frontmatter key ${k}`);
	});

	test(`${name}: SKILL.md is under 500 lines and every referenced file exists`, () => {
		assert.ok(text.split('\n').length < 500);
		const files = [...body.matchAll(/\]\(([^)#]+)\)/g), ...body.matchAll(/`((?:references|scripts|assets|vendors)\/[^`<>*\s]+)`/g)].map((m) => m[1]);
		for (const f of files) {
			if (/^https?:/.test(f)) continue;
			assert.ok(!f.startsWith('..'), `${f} points outside the skill`);
			assert.ok(existsSync(join(dir, f)), `${name}: ${f} does not exist`);
		}
	});

	test(`${name}: version matches the package`, () => assert.equal(data.metadata.version, VERSION));

	test(`${name}: references are one level deep and point inside the skill`, () => {
		if (!existsSync(join(dir, 'references'))) return;
		for (const f of readdirSync(join(dir, 'references'))) {
			const ref = readFileSync(join(dir, 'references', f), 'utf8');
			for (const m of ref.matchAll(/`((?:references|scripts|assets|vendors)\/[^`<>*\s]+)`/g)) {
				assert.ok(existsSync(join(dir, m[1])) || /<id>|\.\.\./.test(m[1]), `${f}: ${m[1]} does not exist`);
			}
		}
	});
}

test('manifestack description has the promised keywords', () => {
	const { data } = parseFrontmatter(readFileSync(join(ROOT, 'skills/manifestack/SKILL.md'), 'utf8'));
	for (const k of ['stack', 'pricing', 'limits', 'cost', 'Vercel', 'Supabase', 'budget', 'compliance', 'overbuilt']) assert.ok(data.description.toLowerCase().includes(k.toLowerCase()), k);
});

test('manifestack-guard stays short', () => {
	assert.ok(readFileSync(join(ROOT, 'skills/manifestack-guard/SKILL.md'), 'utf8').split('\n').length <= 100);
});

test('one version everywhere: package, plugin, skills', () => {
	assert.equal(json('.claude-plugin/plugin.json').version, VERSION);
	assert.equal(json('packages/core/package.json').version, VERSION);
});

test('plugin and marketplace manifests', () => {
	const plugin = json('.claude-plugin/plugin.json');
	const market = json('.claude-plugin/marketplace.json');
	assert.equal(plugin.name, 'manifestack');
	assert.equal(market.plugins[0].name, plugin.name, 'marketplace entry and plugin.json share the name');
	assert.equal(market.plugins[0].source, './');
	assert.ok(!existsSync(join(ROOT, 'bin')), 'no bin/ in the plugin root');
	assert.ok(!existsSync(join(ROOT, 'CLAUDE.md')), 'no CLAUDE.md in the plugin root');
});

test('npm package manifest', () => {
	const pkg = json('packages/cli/package.json');
	assert.equal(pkg.name, 'manifestack');
	assert.deepEqual(pkg.files, ['src', 'skills', 'hooks']);
	assert.equal(pkg.bin.manifestack, 'src/manifestack.js');
	assert.equal(pkg.dependencies, undefined, 'no runtime dependencies');
	assert.equal(json('package.json').private, true);
});
