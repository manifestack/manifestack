import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ROOT, runNode, tempDir } from './helpers.mjs';
import { detectVendors, readEnvNames, extractImports } from '../packages/core/src/detect.mjs';
import { loadCatalog, vendorSignatures } from '../packages/core/src/catalog.mjs';

const signatures = vendorSignatures(loadCatalog(join(ROOT, 'catalog/vendors')));
const detect = (name) => detectVendors(join(FIXTURES, name), { signatures });
const ids = (r) => r.vendors.map((v) => v.id);

test('empty repository is detected as empty (init mode)', () => {
	const r = detect('empty');
	assert.equal(r.empty, true);
	assert.deepEqual(r.vendors, []);
});

test('next-vercel-supabase-resend: all three vendors with evidence', () => {
	const r = detect('next-vercel-supabase-resend');
	assert.equal(r.empty, false);
	assert.deepEqual(ids(r), ['resend', 'supabase', 'vercel']);
	const supabase = r.vendors.find((v) => v.id === 'supabase');
	assert.ok(supabase.evidence.some((e) => e.kind === 'package' && e.match === '@supabase/supabase-js'));
	assert.ok(supabase.evidence.some((e) => e.kind === 'import'));
	assert.ok(supabase.evidence.some((e) => e.kind === 'env' && e.match === 'NEXT_PUBLIC_SUPABASE_URL'));
	assert.deepEqual(supabase.roles_used, ['database'], 'auth is not used in this fixture');
	assert.ok(r.vendors.find((v) => v.id === 'vercel').evidence.some((e) => e.kind === 'config' && e.match === 'vercel.json'));
	assert.deepEqual(r.frameworks.map((f) => f.name), ['Next.js']);
	assert.deepEqual(r.overlaps, []);
});

test('two-auth-providers: Clerk and Supabase Auth overlap', () => {
	const r = detect('two-auth-providers');
	assert.deepEqual(r.overlaps, [{ role: 'auth', vendors: ['clerk', 'supabase'] }]);
	const supabase = r.vendors.find((v) => v.id === 'supabase');
	assert.ok(supabase.evidence.some((e) => e.kind === 'code' && e.match === 'supabase.auth.'));
});

test('k8s-for-40-users: infrastructure signals for Overbuilt', () => {
	const kinds = new Set(detect('k8s-for-40-users').infra.map((i) => i.kind));
	for (const k of ['docker', 'kubernetes', 'helm', 'terraform']) assert.ok(kinds.has(k), k);
});

test('eu-requirement: Supabase found through config file', () => {
	const r = detect('eu-requirement');
	assert.ok(r.vendors.find((v) => v.id === 'supabase').evidence.some((e) => e.kind === 'config'));
});

test('with-env-values: only names come out, values never do', () => {
	const r = detect('with-env-values');
	assert.deepEqual(r.env_names, ['CLERK_SECRET_KEY', 'DATABASE_URL', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'RESEND_API_KEY']);
	const out = JSON.stringify(r);
	assert.ok(!out.includes('FIXTURE'), 'a value leaked into the result');
	assert.ok(!out.includes('do-not-leak'));
	// The same through the bundled script that ships in the skill.
	const cli = runNode(join(ROOT, 'skills/manifestack/scripts/detect.mjs'), [join(FIXTURES, 'with-env-values')]);
	assert.equal(cli.code, 0, cli.stderr);
	assert.ok(!cli.stdout.includes('FIXTURE') && !cli.stdout.includes('do-not-leak'));
	assert.ok(readFileSync(join(FIXTURES, 'with-env-values/.env'), 'utf8').includes('FIXTURE'), 'fixture still has values');
});

test('injection-page: page content is not scanned or echoed', () => {
	const r = detect('injection-page');
	assert.deepEqual(ids(r), ['neon']);
	assert.ok(!JSON.stringify(r).includes('ignore previous instructions'));
});

test('readEnvNames drops values, including export and quoted forms', () => {
	assert.deepEqual(readEnvNames('A=1\nexport B="two"\n# C=3\n  D = x\nnot a line\n'), ['A', 'B', 'D']);
});

test('extractImports covers import, require and dynamic import', () => {
	const specs = extractImports(`import a from 'x'; import { b } from "@y/z"; const c = require('r'); await import('d'); import 'side';`);
	assert.deepEqual(specs.sort(), ['@y/z', 'd', 'r', 'side', 'x']);
});

test('unmapped SDKs are reported and count for overlaps; dot-folders are skipped', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { stripe: '1', '@auth0/nextjs-auth0': '1', '@clerk/nextjs': '1' } }));
	mkdirSync(join(dir, '.claude/skills/x'), { recursive: true });
	writeFileSync(join(dir, '.claude/skills/x/a.mjs'), "import x from '@supabase/supabase-js'; supabase.auth.getUser()");
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['clerk']);
	assert.deepEqual(r.unmapped.map((u) => u.name).sort(), ['Auth0', 'Stripe']);
	assert.deepEqual(r.overlaps, [{ role: 'auth', vendors: ['clerk', 'Auth0'] }]);
});
