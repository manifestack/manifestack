import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ROOT, runNode, tempDir } from './helpers.mjs';
import { detectVendors, readEnvNames, extractImports, hookStatus } from '../packages/core/src/detect.mjs';
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
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { 'mailgun.js': '1', inngest: '1', resend: '1' } }));
	mkdirSync(join(dir, '.claude/skills/x'), { recursive: true });
	writeFileSync(join(dir, '.claude/skills/x/a.mjs'), "import x from '@supabase/supabase-js'; supabase.auth.getUser()");
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['resend']);
	assert.deepEqual(r.unmapped.map((u) => u.name).sort(), ['Inngest', 'Mailgun']);
	assert.deepEqual(r.overlaps, [{ role: 'email', vendors: ['resend', 'Mailgun'] }]);
});

test('hookStatus: off, on once config and script are both there, plugin for Claude Code', (t) => {
	const dir = tempDir(t);
	assert.deepEqual(hookStatus(dir), { 'claude-code': 'off', cursor: 'off' });
	assert.deepEqual(hookStatus(dir, { plugin: true }), { 'claude-code': 'plugin', cursor: 'off' });
	mkdirSync(join(dir, '.claude/hooks'), { recursive: true });
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'node .claude/hooks/manifestack-new-vendor.mjs' }] }] } }));
	assert.equal(hookStatus(dir)['claude-code'], 'off', 'config without the script does not count');
	writeFileSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs'), '');
	assert.equal(hookStatus(dir)['claude-code'], 'on');
	mkdirSync(join(dir, '.cursor/hooks'), { recursive: true });
	writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: 'node .cursor/hooks/manifestack-new-vendor.mjs' }] } }));
	writeFileSync(join(dir, '.cursor/hooks/manifestack-new-vendor.mjs'), '');
	assert.equal(detectVendors(dir, { signatures }).hook.cursor, 'on');
});

test('detect.mjs from the repo checkout counts as the plugin (hooks/hooks.json next to .claude-plugin)', (t) => {
	const r = runNode(join(ROOT, 'skills/manifestack/scripts/detect.mjs'), [tempDir(t)]);
	assert.equal(r.code, 0, r.stderr);
	assert.deepEqual(JSON.parse(r.stdout).hook, { 'claude-code': 'plugin', cursor: 'off' });
});

test('many-vendors: SDKs and config files find every newer vendor map', () => {
	const r = detect('many-vendors');
	assert.deepEqual(ids(r), ['anthropic', 'auth0', 'cloudflare', 'firebase', 'fly', 'netlify', 'openai', 'paddle', 'posthog', 'postmark', 'railway', 'render', 'sendgrid', 'sentry', 'stripe']);
	assert.deepEqual(r.unmapped, []);
	const firebase = r.vendors.find((v) => v.id === 'firebase');
	assert.deepEqual(firebase.roles_used, ['database'], 'auth, hosting and storage are not used here');
	for (const id of ['fly', 'railway', 'render', 'netlify', 'cloudflare']) {
		const v = r.vendors.find((x) => x.id === id);
		assert.ok(v.evidence.some((e) => e.kind === 'config'), `${id} found from its config file`);
	}
	assert.deepEqual(r.overlaps.find((o) => o.role === 'ai').vendors, ['anthropic', 'openai']);
});

test('Python and Go manifests: unmapped SDKs and frameworks', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'requirements.txt'), 'boto3==1.35\nmistralai>=1\n');
	writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "api"\ndependencies = ["fastapi>=0.110"]\n');
	mkdirSync(join(dir, 'worker'));
	writeFileSync(join(dir, 'worker/go.mod'), 'module example.com/worker\n\ngo 1.23\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.10.0\n\tgithub.com/aws/aws-sdk-go-v2 v1.30.0\n)\n');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(r.unmapped.map((u) => u.name).sort(), ['AWS', 'Mistral']);
	assert.deepEqual(r.unmapped.find((u) => u.name === 'AWS').evidence.map((e) => e.file).sort(), ['requirements.txt', 'worker/go.mod']);
	assert.deepEqual(r.frameworks.map((f) => f.name).sort(), ['FastAPI', 'Gin']);
	assert.equal(r.empty, false);
});

test('python-api: vendors from requirements.txt and pyproject.toml, Heroku from its Procfile', () => {
	const r = detect('python-api');
	assert.deepEqual(ids(r), ['datadog', 'gemini', 'heroku', 'mongodb-atlas', 'openai', 'sentry', 'stripe', 'upstash']);
	const stripe = r.vendors.find((v) => v.id === 'stripe');
	assert.ok(stripe.evidence.some((e) => e.kind === 'package' && e.file === 'requirements.txt' && e.match === 'stripe'));
	assert.ok(r.vendors.find((v) => v.id === 'datadog').evidence.some((e) => e.file === 'pyproject.toml'));
	assert.deepEqual(r.frameworks.map((f) => f.name), ['FastAPI']);
});

test('go-worker: vendors from go.mod (major-version paths), DigitalOcean from its app spec', () => {
	const r = detect('go-worker');
	assert.deepEqual(ids(r), ['anthropic', 'digitalocean', 'sentry', 'stripe', 'workos']);
	assert.ok(r.vendors.find((v) => v.id === 'stripe').evidence.some((e) => e.match === 'github.com/stripe/stripe-go/v82'));
	assert.deepEqual(r.frameworks.map((f) => f.name), ['Gin']);
});

test('mobile-app: subscription SDKs, EAS from eas.json and expo-updates, newer storage and database maps', () => {
	const r = detect('mobile-app');
	assert.deepEqual(ids(r), ['adapty', 'cloudinary', 'convex', 'expo', 'lemon-squeezy', 'planetscale', 'polar', 'revenuecat', 'uploadthing']);
	assert.deepEqual(r.overlaps.find((o) => o.role === 'payments').vendors, ['adapty', 'lemon-squeezy', 'polar', 'revenuecat']);
});
