import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ROOT, runNode, tempDir } from './helpers.mjs';
import { detectVendors, readEnvNames, extractImports, extractPythonModules, extractGoImports, hookStatus, importMatches, needleMatcher } from '../packages/core/src/detect.mjs';
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
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { loops: '1', '@liveblocks/client': '1', resend: '1' } }));
	mkdirSync(join(dir, '.claude/skills/x'), { recursive: true });
	writeFileSync(join(dir, '.claude/skills/x/a.mjs'), "import x from '@supabase/supabase-js'; supabase.auth.getUser()");
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['resend']);
	assert.deepEqual(r.unmapped.map((u) => u.name).sort(), ['Liveblocks', 'Loops']);
	assert.deepEqual(r.overlaps, [{ role: 'email', vendors: ['resend', 'Loops'] }]);
});

test('hookStatus: off, on once config and script are both there, plugin for Claude Code', (t) => {
	const dir = tempDir(t);
	assert.deepEqual(hookStatus(dir), { 'claude-code': 'off', cursor: 'off' });
	assert.deepEqual(hookStatus(dir, { plugin: true }), { 'claude-code': 'plugin', cursor: 'off' });
	mkdirSync(join(dir, '.claude/hooks'), { recursive: true });
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'node .claude/hooks/manifestack-new-vendor.mjs' }] }] } }));
	assert.equal(hookStatus(dir)['claude-code'], 'off', 'config without the script does not count');
	writeFileSync(join(dir, '.claude/hooks/manifestack-new-vendor.mjs'), '');
	assert.equal(hookStatus(dir)['claude-code'], 'outdated', 'an entry without Bash misses package-manager installs');
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Write|Edit|MultiEdit|Bash', hooks: [{ type: 'command', command: 'node .claude/hooks/manifestack-new-vendor.mjs' }] }] } }));
	assert.equal(hookStatus(dir)['claude-code'], 'on');
	writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Write|Edit|MultiEdit|Bash', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/manifestack-new-vendor.mjs"' }] }] } }));
	assert.equal(hookStatus(dir)['claude-code'], 'outdated', '$CLAUDE_PROJECT_DIR does not expand in PowerShell');
	mkdirSync(join(dir, '.cursor/hooks'), { recursive: true });
	writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: 'node .cursor/hooks/manifestack-new-vendor.mjs' }] } }));
	writeFileSync(join(dir, '.cursor/hooks/manifestack-new-vendor.mjs'), '');
	assert.equal(detectVendors(dir, { signatures }).hook.cursor, 'outdated', 'Cursor ignores afterFileEdit output');
	writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify({ version: 1, hooks: { postToolUse: [{ command: 'node .cursor/hooks/manifestack-new-vendor.mjs', matcher: 'Write|Shell' }] } }));
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

test('Python and Go manifests: unmapped SDKs, the AWS family and frameworks', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'requirements.txt'), 'boto3==1.35\nmistralai>=1\n');
	writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "api"\ndependencies = ["fastapi>=0.110"]\n');
	mkdirSync(join(dir, 'worker'));
	writeFileSync(join(dir, 'worker/go.mod'), 'module example.com/worker\n\ngo 1.23\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.10.0\n\tgithub.com/aws/aws-sdk-go-v2 v1.30.0\n)\n');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(r.unmapped.map((u) => u.name), ['Mistral']);
	assert.deepEqual(ids(r), ['aws'], 'boto3 and the Go SDK name no service, so only the family is found');
	assert.deepEqual([...new Set(r.vendors[0].evidence.map((e) => e.file))].sort(), ['requirements.txt', 'worker/go.mod']);
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

test('vultr-api: Vultr from its npm SDK and env names, roles only where the code reaches the service', () => {
	const r = detect('vultr-api');
	assert.deepEqual(ids(r), ['aws-s3', 'vultr']);
	const vultr = r.vendors.find((v) => v.id === 'vultr');
	assert.ok(vultr.evidence.some((e) => e.kind === 'package' && e.match === '@vultr/vultr-node'));
	assert.ok(vultr.evidence.some((e) => e.kind === 'env' && e.match === 'VULTR_INFERENCE_API_KEY'));
	assert.deepEqual(vultr.roles_used, ['hosting', 'storage', 'ai'], 'no vultrdb.com host, so no database role');
	assert.deepEqual(r.vendors.find((v) => v.id === 'aws-s3').roles_used, [], 'Object Storage goes through an S3 client: S3 without the storage role');
	assert.deepEqual(r.overlaps, []);
});

test('Vultr from govultr (major-version path) and a Managed Database host in Go code', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.23\n\nrequire github.com/vultr/govultr/v3 v3.33.2\n');
	writeFileSync(join(dir, 'main.go'), 'package main\n\nconst dsn = "postgres://vultradmin@vultr-prod-1.vultrdb.com:16751/app"\n\nfunc main() {}\n');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['vultr']);
	assert.deepEqual(r.vendors[0].roles_used, ['hosting', 'database']);
});

test('rag-app: Turso, Pinecone, OpenRouter and Mailgun from npm SDKs and env names', () => {
	const r = detect('rag-app');
	assert.deepEqual(ids(r), ['mailgun', 'openrouter', 'pinecone', 'turso']);
	assert.deepEqual(r.vendors.find((v) => v.id === 'turso').roles_used, ['database'], 'TURSO_ names in the code mark the cloud');
	assert.deepEqual(r.overlaps, [{ role: 'database', vendors: ['pinecone', 'turso'] }], 'reported; the Pinecone map tells the auditor when it is not one');
	assert.deepEqual(r.unmapped, []);
});

test('libSQL as a local file is Turso without the database role; Prisma ORM alone is not Prisma Postgres', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@libsql/client': '0.18', prisma: '7', '@prisma/client': '7', '@prisma/adapter-pg': '7' } }));
	writeFileSync(join(dir, '.env'), 'PRISMA_DISABLE_TELEMETRY=1\nDATABASE_URL=x\n');
	writeFileSync(join(dir, 'db.ts'), "import { createClient } from '@libsql/client';\nexport const db = createClient({ url: 'file:local.db' });\n");
	let r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['turso']);
	assert.deepEqual(r.vendors[0].roles_used, []);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { prisma: '7', '@prisma/client': '7', '@prisma/adapter-ppg': '7' } }));
	rmSync(join(dir, 'db.ts'));
	r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['prisma-postgres']);
});

test('Python and Go: Pinecone, Mailgun, OpenRouter and Turso SDKs, major-version and vanity paths', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'requirements.txt'), 'pinecone==10.0.0\nmailgun==1.9.1\nopenrouter==1.3.42\nlibsql==0.1.11\n');
	let r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['mailgun', 'openrouter', 'pinecone', 'turso']);
	rmSync(join(dir, 'requirements.txt'));
	writeFileSync(join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.23\n\nrequire (\n\tgithub.com/pinecone-io/go-pinecone/v7 v7.0.0\n\tgithub.com/mailgun/mailgun-go/v5 v5.19.3\n\tgithub.com/OpenRouterTeam/go-sdk v0.9.41\n\tturso.tech/database/tursogo-serverless v0.1.0\n)\n');
	r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['mailgun', 'openrouter', 'pinecone', 'turso']);
});

test('live-jobs-app: two realtime and two job services overlap; Trigger.dev also from its config file', () => {
	const r = detect('live-jobs-app');
	assert.deepEqual(ids(r), ['ably', 'inngest', 'pusher', 'trigger-dev']);
	assert.ok(r.vendors.find((v) => v.id === 'trigger-dev').evidence.some((e) => e.kind === 'config' && e.match === 'trigger.config.ts'));
	assert.deepEqual(r.overlaps, [{ role: 'realtime', vendors: ['ably', 'pusher'] }, { role: 'jobs', vendors: ['inngest', 'trigger-dev'] }]);
});

test('Laravel: the 8-10 .env.example alone is not Pusher; pusher-js for Reverb is Pusher without the realtime role', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, '.env.example'), 'BROADCAST_DRIVER=log\nPUSHER_APP_ID=\nPUSHER_APP_KEY=\nPUSHER_APP_SECRET=\nPUSHER_HOST=\nPUSHER_APP_CLUSTER=mt1\nVITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"\nMIX_PUSHER_APP_KEY="${PUSHER_APP_KEY}"\n');
	mkdirSync(join(dir, 'resources/js'), { recursive: true });
	writeFileSync(join(dir, 'resources/js/bootstrap.js'), "// import Pusher from 'pusher-js';\n// window.Pusher = Pusher;\n");
	assert.deepEqual(ids(detectVendors(dir, { signatures })), []);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { 'laravel-echo': '2', 'pusher-js': '8' } }));
	writeFileSync(join(dir, 'resources/js/echo.js'), "import Echo from 'laravel-echo';\nimport Pusher from 'pusher-js';\nwindow.Pusher = Pusher;\nwindow.Echo = new Echo({ broadcaster: 'reverb', key: import.meta.env.VITE_REVERB_APP_KEY });\n");
	let r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['pusher']);
	assert.deepEqual(r.vendors[0].roles_used, []);
	writeFileSync(join(dir, 'resources/js/echo.js'), "import Echo from 'laravel-echo';\nimport Pusher from 'pusher-js';\nwindow.Pusher = Pusher;\nwindow.Echo = new Echo({ broadcaster: 'pusher', key: import.meta.env.VITE_PUSHER_APP_KEY });\n");
	r = detectVendors(dir, { signatures });
	assert.deepEqual(r.vendors[0].roles_used, ['realtime']);
});

test('Upstash counts for jobs only when the code uses QStash or Workflow', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@upstash/redis': '1', '@upstash/qstash': '2' } }));
	writeFileSync(join(dir, 'a.ts'), "import { Redis } from '@upstash/redis';\nexport const redis = Redis.fromEnv();\n");
	assert.deepEqual(detectVendors(dir, { signatures }).vendors[0].roles_used, ['database']);
	writeFileSync(join(dir, 'b.ts'), "import { Client } from '@upstash/qstash';\nexport const q = new Client({ token: process.env.QSTASH_TOKEN! });\n");
	assert.deepEqual(detectVendors(dir, { signatures }).vendors[0].roles_used, ['database', 'jobs']);
});

test('video-push-app: Mux for video, OneSignal for push and, when the code sends it, email', () => {
	const r = detect('video-push-app');
	assert.deepEqual(ids(r), ['mux', 'onesignal', 'resend']);
	const onesignal = r.vendors.find((v) => v.id === 'onesignal');
	assert.ok(onesignal.evidence.some((e) => e.kind === 'config' && e.file === 'public/OneSignalSDKWorker.js'));
	assert.deepEqual(onesignal.roles_used, ['other', 'email']);
	assert.deepEqual(r.overlaps, [{ role: 'email', vendors: ['onesignal', 'resend'] }]);
});

test('Hetzner from hcloud and HCLOUD_ names, storage only with an Object Storage endpoint; mux look-alikes are not Mux', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'requirements.txt'), 'hcloud==2.27.0\nboto3==1.35.0\n');
	writeFileSync(join(dir, '.env'), 'HCLOUD_TOKEN=x\nMUX_ROOT=/tmp\n');
	writeFileSync(join(dir, 'deploy.py'), 'import hcloud\nclient = hcloud.Client(token="x")\n');
	let r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['aws', 'hetzner'], 'boto3 is the AWS SDK, also used for S3-compatible storage');
	const hetzner = () => r.vendors.find((v) => v.id === 'hetzner');
	assert.deepEqual(hetzner().roles_used, ['hosting']);
	writeFileSync(join(dir, 'files.py'), 'import boto3\ns3 = boto3.client("s3", endpoint_url="https://fsn1.your-objectstorage.com")\n');
	r = detectVendors(dir, { signatures });
	assert.deepEqual(hetzner().roles_used, ['hosting', 'storage']);
	assert.deepEqual(r.vendors.find((v) => v.id === 'aws-s3').roles_used, [], 'an S3 client pointed at Hetzner is not AWS storage');
	assert.deepEqual(r.overlaps, []);
	writeFileSync(join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.23\n\nrequire (\n\tgithub.com/gorilla/mux v1.8.1\n\tgithub.com/hetznercloud/hcloud-go/v2 v2.52.0\n)\n');
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { mux: '0.5' } }));
	assert.deepEqual(ids(detectVendors(dir, { signatures })), ['aws', 'aws-s3', 'hetzner']);
});

test('content-site: Sanity and a Strapi app in its own folder overlap as CMS; Algolia is search', () => {
	const r = detect('content-site');
	assert.deepEqual(ids(r), ['algolia', 'sanity', 'strapi']);
	assert.ok(r.vendors.find((v) => v.id === 'strapi').evidence.some((e) => e.file === 'cms/package.json'));
	assert.deepEqual(r.overlaps, [{ role: 'cms', vendors: ['sanity', 'strapi'] }]);
});

test('CMS config and generated files: Contentful, Sanity and Storyblok without a package', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, '.contentfulrc.json'), '{}');
	writeFileSync(join(dir, 'sanity.config.ts'), 'export default {};\n');
	mkdirSync(join(dir, 'src/types'), { recursive: true });
	writeFileSync(join(dir, 'src/types/storyblok-components.d.ts'), 'export {};\n');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['contentful', 'sanity', 'storyblok']);
	assert.ok(r.vendors.every((v) => v.evidence.every((e) => e.kind === 'config')));
	assert.deepEqual(r.overlaps, [{ role: 'cms', vendors: ['contentful', 'sanity', 'storyblok'] }]);
});

test('product-analytics-app: three analytics tools and three flag services overlap; Segment feeding them does not', () => {
	const r = detect('product-analytics-app');
	assert.deepEqual(ids(r), ['amplitude', 'launchdarkly', 'mixpanel', 'posthog', 'segment']);
	assert.deepEqual(r.vendors.find((v) => v.id === 'mixpanel').roles_used, ['analytics'], 'no Mixpanel flags in the code');
	assert.deepEqual(r.vendors.find((v) => v.id === 'segment').roles_used, ['other']);
	assert.deepEqual(r.overlaps, [{ role: 'analytics', vendors: ['amplitude', 'mixpanel', 'posthog'] }, { role: 'flags', vendors: ['amplitude', 'launchdarkly', 'posthog'] }]);
});

test('look-alikes: Segment utility packages and linker variables are not vendors', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@segment/ajv-human-errors': '2', amplitude: '1' } }));
	writeFileSync(join(dir, '.env'), 'LD_LIBRARY_PATH=/usr/lib\nLD_PRELOAD=\nSEGMENT_DURATION=6\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures })), []);
});

test('observability-app: New Relic and Grafana Cloud overlap; Elastic used only for search is not monitoring', () => {
	const r = detect('observability-app');
	assert.deepEqual(ids(r), ['elastic-cloud', 'grafana-cloud', 'newrelic']);
	assert.deepEqual(r.vendors.find((v) => v.id === 'elastic-cloud').roles_used, ['search']);
	assert.ok(r.vendors.find((v) => v.id === 'newrelic').evidence.some((e) => e.kind === 'config' && e.match === 'newrelic.js'));
	assert.deepEqual(r.overlaps, [{ role: 'monitoring', vendors: ['grafana-cloud', 'newrelic'] }]);
});

test('look-alikes: Grafana plugin packages, k6, OpenSearch and the Elasticsearch image password are not vendors', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@grafana/ui': '13', '@grafana/data': '13', k6: '0.0.0', '@opensearch-project/opensearch': '3', '@elastic/eui': '100' } }));
	writeFileSync(join(dir, '.env'), 'ELASTIC_PASSWORD=x\nGF_SECURITY_ADMIN_PASSWORD=x\nGCLOUD_PROJECT=demo\n');
	writeFileSync(join(dir, 'load.js'), "import http from 'k6/http';\nexport default function () { http.get('https://example.com'); }\n");
	assert.deepEqual(ids(detectVendors(dir, { signatures })), ['gcp'], 'GCLOUD_PROJECT is Google Cloud, not Grafana Cloud');
});

test('checkout-sms-app: PayPal and Stripe are reported for the auditor to judge; Twilio is other; Braintree utilities are not vendors', () => {
	const r = detect('checkout-sms-app');
	assert.deepEqual(ids(r), ['paypal', 'stripe', 'twilio']);
	assert.deepEqual(r.overlaps, [{ role: 'payments', vendors: ['paypal', 'stripe'] }]);
	assert.deepEqual(r.unmapped, []);
});

test('Braintree is found as PayPal from Python and env names; Twilio from its serverless config', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'requirements.txt'), 'braintree==4.47.0\n');
	writeFileSync(join(dir, 'pay.py'), 'import paypalserversdk\n');
	writeFileSync(join(dir, '.env'), 'BT_MERCHANT_ID=x\n');
	writeFileSync(join(dir, '.twilioserverlessrc'), '{}');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['paypal', 'twilio']);
	assert.ok(r.vendors[0].evidence.some((e) => e.kind === 'import' && e.match === 'paypalserversdk'));
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@twilio-paste/core': '20', 'card-validator': '10' } }));
	rmSync(join(dir, 'requirements.txt'));
	rmSync(join(dir, 'pay.py'));
	rmSync(join(dir, '.env'));
	rmSync(join(dir, '.twilioserverlessrc'));
	assert.deepEqual(ids(detectVendors(dir, { signatures })), []);
});

// A made-up vendor family: one SDK for every service (like boto3), plus a service map with its own package.
const acme = { id: 'acme', name: 'Acme Cloud', roles: ['other'], packages: ['acme-sdk'], pypi: ['acme'], go: [], imports: ['acme-sdk'], env_prefixes: ['ACME_'], config_files: [], service_signals: ['provider "acme"'], role_signals: {} };
const acmeStore = { id: 'acme-store', name: 'Acme Store', family: 'acme', roles: ['storage'], packages: ['@acme/store'], pypi: [], go: [], imports: ['@acme/store'], env_prefixes: [], config_files: [], service_signals: ["acme.client('store')", 'acme_store_bucket', 'Acme::Store::Bucket'], role_signals: {} };
const withAcme = [...signatures, acme, acmeStore];

test('families: a service signal finds the service once its family is found, in code, Terraform, Bicep or SAM', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'app.py'), "s3 = acme.client('store')\n");
	assert.deepEqual(ids(detectVendors(dir, { signatures: withAcme })), [], 'a service signal alone finds nothing');
	writeFileSync(join(dir, 'requirements.txt'), 'acme==2.0\n');
	let r = detectVendors(dir, { signatures: withAcme });
	assert.deepEqual(ids(r), ['acme', 'acme-store']);
	const store = r.vendors.find((v) => v.id === 'acme-store');
	assert.equal(store.family, 'acme');
	assert.deepEqual(store.evidence, [{ kind: 'service', file: 'app.py', match: "acme.client('store')" }]);
	assert.deepEqual(store.roles_used, ['storage']);
	assert.equal('family' in r.vendors.find((v) => v.id === 'acme'), false);

	rmSync(join(dir, 'app.py'));
	mkdirSync(join(dir, 'infra'));
	writeFileSync(join(dir, 'infra/main.tf'), '# resource "acme_store_bucket" "old" {}\nresource "acme_network" "main" {}\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures: withAcme })), ['acme'], 'a commented-out resource is not used');
	writeFileSync(join(dir, 'infra/main.tf'), 'resource "acme_store_bucket" "files" {}\n');
	r = detectVendors(dir, { signatures: withAcme });
	assert.deepEqual(ids(r), ['acme', 'acme-store']);
	assert.ok(r.infra.some((i) => i.kind === 'terraform'));

	rmSync(join(dir, 'infra/main.tf'));
	writeFileSync(join(dir, 'template.yaml'), 'Resources:\n  Files:\n    Type: Acme::Store::Bucket\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures: withAcme })), ['acme', 'acme-store']);

	rmSync(join(dir, 'template.yaml'));
	writeFileSync(join(dir, 'infra/main.bicep'), "// resource old 'acme_store_bucket@2024' = {}\n/* resource older 'acme_store_bucket@2023' = {} */\nparam site string = 'https://example.com'\n");
	assert.deepEqual(ids(detectVendors(dir, { signatures: withAcme })), ['acme'], 'Bicep comments are stripped, a URL in a string is kept');
	writeFileSync(join(dir, 'infra/main.bicep'), "resource files 'acme_store_bucket@2024' = { name: 'files' }\n");
	r = detectVendors(dir, { signatures: withAcme });
	assert.deepEqual(ids(r), ['acme', 'acme-store']);
	assert.ok(r.infra.some((i) => i.kind === 'bicep' && i.file === 'infra/main.bicep'));
});

test('families: a service found by its own package makes the family present for its siblings', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@acme/store': '1' } }));
	writeFileSync(join(dir, 'serverless.yml'), 'resources:\n  Resources:\n    Bucket:\n      Type: Acme::Store::Bucket\n');
	const r = detectVendors(dir, { signatures: withAcme });
	assert.deepEqual(ids(r), ['acme-store', 'aws-lambda'], 'the family map needs its own evidence to be listed; serverless.yml is the Lambda config');
	assert.ok(r.vendors[0].evidence.some((e) => e.kind === 'service' && e.file === 'serverless.yml'));
});

test('families: Terraform alone finds the family by its provider, then its services by their resources', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'main.tf'), 'resource "acme_store_bucket" "files" {}\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures: withAcme })), [], 'a resource without the provider finds nothing');
	writeFileSync(join(dir, 'main.tf'), 'provider "acme" {\n  region = "eu-1"\n}\nresource "acme_store_bucket" "files" {}\n');
	const r = detectVendors(dir, { signatures: withAcme });
	assert.deepEqual(ids(r), ['acme', 'acme-store']);
	assert.deepEqual(r.vendors[0].evidence, [{ kind: 'service', file: 'main.tf', match: 'provider "acme"' }]);
});

test('families: services of one family in the same role are not an Overlap; with another vendor they are', (t) => {
	const acmeCdn = { ...acmeStore, id: 'acme-cdn', name: 'Acme CDN', packages: ['@acme/cdn'], imports: ['@acme/cdn'], service_signals: [] };
	const sigs = [...signatures, acme, acmeStore, acmeCdn];
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@acme/store': '1', '@acme/cdn': '1' } }));
	assert.deepEqual(detectVendors(dir, { signatures: sigs }).overlaps, []);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@acme/store': '1', '@acme/cdn': '1', uploadthing: '7' } }));
	assert.deepEqual(detectVendors(dir, { signatures: sigs }).overlaps, [{ role: 'storage', vendors: ['acme-cdn', 'acme-store', 'uploadthing'] }]);
});

test('role signals are read from infrastructure-as-code files too', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, '.env'), 'HCLOUD_TOKEN=x\n');
	writeFileSync(join(dir, 'storage.tf'), 'locals { endpoint = "https://fsn1.your-objectstorage.com" }\n');
	assert.deepEqual(detectVendors(dir, { signatures }).vendors.find((v) => v.id === 'hetzner').roles_used, ['hosting', 'storage']);
});

test('aws-serverless-app: AWS services from SDK clients and Terraform; services of one family are not an Overlap', () => {
	const r = detect('aws-serverless-app');
	assert.deepEqual(ids(r), ['aws', 'aws-cloudwatch', 'aws-dynamodb', 'aws-lambda', 'aws-s3', 'aws-ses', 'sentry']);
	assert.ok(r.vendors.filter((v) => v.id.startsWith('aws-')).every((v) => v.family === 'aws'));
	assert.deepEqual(r.vendors.find((v) => v.id === 'aws-s3').roles_used, ['storage'], 'aws_s3_bucket marks real S3');
	assert.deepEqual(r.vendors.find((v) => v.id === 'aws-cloudwatch').roles_used, [], 'Lambda logs alone are a bill, not a second monitoring tool');
	assert.ok(r.vendors.find((v) => v.id === 'aws').evidence.some((e) => e.file === 'infra/main.tf'));
	assert.deepEqual(r.overlaps, []);
	assert.deepEqual(r.unmapped, []);
});

test('AWS from boto3: services from client and resource calls, CloudFormation alone finds the family', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'requirements.txt'), 'boto3==1.35\n');
	writeFileSync(join(dir, 'app.py'), "import boto3\nddb = boto3.resource('dynamodb')\nbedrock = boto3.client('bedrock-runtime')\nsqs = boto3.client(\"sqs\")\n");
	assert.deepEqual(ids(detectVendors(dir, { signatures })), ['aws', 'aws-bedrock', 'aws-dynamodb', 'aws-sqs-sns']);
	const cfn = tempDir(t);
	writeFileSync(join(cfn, 'template.yaml'), "AWSTemplateFormatVersion: '2010-09-09'\nResources:\n  Queue:\n    Type: AWS::SQS::Queue\n  Users:\n    Type: AWS::Cognito::UserPool\n");
	assert.deepEqual(ids(detectVendors(cfn, { signatures })), ['aws', 'aws-cognito', 'aws-sqs-sns']);
});

test('gcp-cloud-run-app: Google Cloud services from client packages and Terraform; Cloud Run logs are a bill, not a second monitoring tool', () => {
	const r = detect('gcp-cloud-run-app');
	assert.deepEqual(ids(r), ['gcp', 'gcp-cloud-run', 'gcp-cloud-sql', 'gcp-cloud-storage', 'gcp-logging', 'gcp-pubsub', 'sentry']);
	assert.ok(r.vendors.filter((v) => v.id.startsWith('gcp-')).every((v) => v.family === 'gcp'));
	const roles = Object.fromEntries(r.vendors.map((v) => [v.id, v.roles_used]));
	assert.deepEqual(roles['gcp-cloud-run'], ['hosting']);
	assert.deepEqual(roles['gcp-cloud-storage'], ['storage']);
	assert.deepEqual(roles['gcp-logging'], [], 'Cloud Run sends logs to Cloud Logging by default');
	assert.ok(!ids(r).includes('gcp-memorystore'), 'a commented-out resource is not a signal');
	assert.deepEqual(r.overlaps, []);
	assert.deepEqual(r.unmapped, []);
});

test('azure-container-app: Azure services from client packages, azd and Bicep; Container Apps logs are a bill, Azure OpenAI is not OpenAI', () => {
	const r = detect('azure-container-app');
	assert.deepEqual(ids(r), ['azure', 'azure-blob-storage', 'azure-container-apps', 'azure-cosmos-db', 'azure-monitor', 'azure-openai', 'azure-service-bus', 'openai', 'sentry']);
	assert.ok(r.vendors.filter((v) => v.id.startsWith('azure-')).every((v) => v.family === 'azure'));
	const roles = Object.fromEntries(r.vendors.map((v) => [v.id, v.roles_used]));
	assert.deepEqual(roles['azure-container-apps'], ['hosting']);
	assert.deepEqual(roles['azure-monitor'], [], 'the Log Analytics workspace of a Container Apps environment');
	assert.deepEqual(roles['azure-openai'], ['ai']);
	assert.deepEqual(roles.openai, [], 'the openai package used through AzureOpenAI is billed by Azure');
	assert.ok(!ids(r).includes('azure-redis'), 'a commented-out Bicep resource is not a signal');
	assert.ok(r.infra.some((i) => i.kind === 'bicep'));
	assert.deepEqual(r.overlaps, []);
	assert.deepEqual(r.unmapped, []);
});

test('Azure: Terraform alone; auth, email and AI roles only for real use; host.json is not Functions', (t) => {
	const run = (files) => {
		const dir = tempDir(t);
		for (const [f, c] of Object.entries(files)) writeFileSync(join(dir, f), c);
		return detectVendors(dir, { signatures });
	};
	let r = run({ 'main.tf': 'provider "azurerm" {\n  features {}\n}\nresource "azurerm_linux_web_app" "web" {}\nresource "azurerm_postgresql_flexible_server" "db" {}\nresource "azurerm_redis_cache" "cache" {}\n' });
	assert.deepEqual(ids(r), ['azure', 'azure-app-service', 'azure-postgresql-mysql', 'azure-redis']);
	assert.deepEqual(r.overlaps, [], 'PostgreSQL and Redis of one family are not an Overlap');

	r = run({ 'requirements.txt': 'msal==1.31\n', 'job.py': 'import msal\napp = msal.ConfidentialClientApplication("id", client_credential="x")\ntoken = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])\n', 'package.json': JSON.stringify({ dependencies: { '@clerk/nextjs': '6' } }) });
	assert.deepEqual(r.vendors.find((v) => v.id === 'azure-entra').roles_used, [], 'MSAL calling Graph as a daemon is not user sign-in');
	assert.deepEqual(r.overlaps, []);
	r = run({ 'package.json': JSON.stringify({ dependencies: { '@azure/msal-browser': '4', '@clerk/nextjs': '6' } }), 'auth.ts': "import { PublicClientApplication } from '@azure/msal-browser';\nexport const msal = new PublicClientApplication({ auth: { clientId: 'x', authority: 'https://contoso.ciamlogin.com/' } });\nawait msal.loginRedirect();\n" });
	assert.deepEqual(r.overlaps, [{ role: 'auth', vendors: ['azure-entra', 'clerk'] }]);

	r = run({ 'package.json': JSON.stringify({ dependencies: { '@azure/communication-sms': '1', resend: '4' } }), 'sms.ts': "import { SmsClient } from '@azure/communication-sms';\n" });
	assert.deepEqual(r.overlaps, [], 'SMS through Communication Services is not a second email service');
	r = run({ 'package.json': JSON.stringify({ dependencies: { '@azure/communication-email': '1', resend: '4' } }), 'mail.ts': "import { EmailClient } from '@azure/communication-email';\nimport { Resend } from 'resend';\n" });
	assert.deepEqual(r.overlaps, [{ role: 'email', vendors: ['azure-communication', 'resend'] }]);

	r = run({ 'package.json': JSON.stringify({ dependencies: { openai: '6' } }), 'ai.ts': "import OpenAI from 'openai';\nconst client = new OpenAI();\n" });
	assert.deepEqual(r.vendors.map((v) => [v.id, v.roles_used]), [['openai', ['ai']]]);
	r = run({ 'package.json': JSON.stringify({ dependencies: { openai: '6', '@azure/identity': '4' } }), 'ai.ts': "import OpenAI, { AzureOpenAI } from 'openai';\nconst a = new OpenAI();\nconst b = new AzureOpenAI({ endpoint: 'https://x.openai.azure.com' });\n" });
	assert.deepEqual(r.overlaps, [{ role: 'ai', vendors: ['azure-openai', 'openai'] }]);

	assert.deepEqual(ids(run({ 'host.json': '{"version":"2.0"}', 'package.json': JSON.stringify({ dependencies: { express: '5' } }) })), []);
});

test('Google Cloud: Terraform or Python alone; Firebase is in the family; Cloud Run next to Vercel is an Overlap', (t) => {
	const tf = tempDir(t);
	writeFileSync(join(tf, 'main.tf'), 'provider "google" {}\nresource "google_container_cluster" "main" {}\nresource "google_redis_instance" "cache" {}\nresource "google_bigquery_dataset" "events" {}\n');
	assert.deepEqual(ids(detectVendors(tf, { signatures })), ['gcp', 'gcp-bigquery', 'gcp-gke', 'gcp-logging', 'gcp-memorystore']);

	const py = tempDir(t);
	writeFileSync(join(py, 'requirements.txt'), 'google-cloud-storage==3\nfunctions-framework==3\n');
	writeFileSync(join(py, 'main.py'), 'import functions_framework\nfrom google.cloud import bigquery\n');
	assert.deepEqual(ids(detectVendors(py, { signatures })), ['gcp-bigquery', 'gcp-cloud-run', 'gcp-cloud-storage', 'gcp-logging'], 'Python imports reduce to `google`, so code signals name the service');

	const fb = tempDir(t);
	writeFileSync(join(fb, 'package.json'), JSON.stringify({ dependencies: { 'firebase-admin': '13', '@google-cloud/firestore': '7', '@google-cloud/storage': '7', 'next': '15' } }));
	writeFileSync(join(fb, 'db.ts'), "import { Firestore } from '@google-cloud/firestore';\nimport { Storage } from '@google-cloud/storage';\n");
	let r = detectVendors(fb, { signatures });
	assert.deepEqual(ids(r), ['firebase', 'gcp-cloud-storage', 'gcp-firestore']);
	assert.deepEqual(r.overlaps, [], 'Firestore and Cloud Storage next to Firebase are one family');

	writeFileSync(join(fb, 'vercel.json'), '{}');
	writeFileSync(join(fb, 'cloudbuild.yaml'), "steps:\n  - name: gcr.io/google.com/cloudsdktool/cloud-sdk\n    args: ['run', 'deploy', 'api']\n");
	r = detectVendors(fb, { signatures });
	assert.deepEqual(r.overlaps.find((o) => o.role === 'hosting')?.vendors, ['gcp-cloud-run', 'vercel']);
});

test('mobile-app: subscription SDKs, EAS from eas.json and expo-updates, newer storage and database maps', () => {
	const r = detect('mobile-app');
	assert.deepEqual(ids(r), ['adapty', 'cloudinary', 'convex', 'expo', 'lemon-squeezy', 'planetscale', 'polar', 'revenuecat', 'uploadthing']);
	assert.deepEqual(r.overlaps.find((o) => o.role === 'payments').vendors, ['adapty', 'lemon-squeezy', 'polar', 'revenuecat']);
});

test('a virtualenv under any name is skipped and the file limit drops source before manifests', (t) => {
	const dir = tempDir(t);
	for (const venv of ['env', 'py312']) {
		mkdirSync(join(dir, venv, 'lib/python3.12/x'), { recursive: true });
		writeFileSync(join(dir, venv, 'pyvenv.cfg'), 'home = /usr/bin\n');
		for (let i = 0; i < 30; i++) writeFileSync(join(dir, venv, 'lib/python3.12/x', `m${i}.js`), "import OpenAI from 'openai';\n");
		writeFileSync(join(dir, venv, 'lib/python3.12/x/package.json'), JSON.stringify({ dependencies: { openai: '1' } }));
	}
	mkdirSync(join(dir, 'a/b/c'), { recursive: true });
	for (let i = 0; i < 10; i++) writeFileSync(join(dir, 'a/b/c', `s${i}.js`), "import x from '@clerk/nextjs';\n");
	writeFileSync(join(dir, 'a/b/c/requirements.txt'), 'stripe\n');
	const r = detectVendors(dir, { signatures, maxFiles: 3 });
	assert.deepEqual(ids(r), ['clerk', 'stripe'], 'the deep manifest is read, only some source files are');
	assert.equal(r.truncated, true);
	assert.equal(r.scanned_files, 3);
	const full = detectVendors(dir, { signatures });
	assert.equal(full.truncated, false);
	assert.equal(full.scanned_files, 11);
});

test('a source folder named env is scanned: only a pyvenv.cfg marks a virtualenv', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, 'src/env'), { recursive: true });
	writeFileSync(join(dir, 'src/env/mail.ts'), "import { Resend } from 'resend';\n");
	assert.deepEqual(ids(detectVendors(dir, { signatures })), ['resend']);
});

test('config files in dot-directories: DigitalOcean from .do/app.yaml alone', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, '.do'));
	writeFileSync(join(dir, '.do/app.yaml'), 'name: app\n');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['digitalocean']);
	assert.deepEqual(r.vendors[0].evidence, [{ kind: 'config', file: '.do/app.yaml', match: '.do/app.yaml' }]);
});

test('Deno and CDN imports: npm:, jsr: and esm.sh specifiers, deno.json import maps', (t) => {
	const dir = tempDir(t);
	mkdirSync(join(dir, 'supabase/functions/pay'), { recursive: true });
	writeFileSync(join(dir, 'supabase/functions/pay/index.ts'), `import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hono } from "jsr:@hono/hono";
`);
	mkdirSync(join(dir, 'supabase/functions/mail'));
	writeFileSync(join(dir, 'supabase/functions/mail/deno.json'), JSON.stringify({ imports: { openai: 'npm:openai@4' } }));
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['openai', 'stripe', 'supabase']);
	assert.ok(r.vendors.find((v) => v.id === 'stripe').evidence.some((e) => e.kind === 'import' && e.match === 'npm:stripe@14'));
	assert.ok(r.vendors.find((v) => v.id === 'openai').evidence.some((e) => e.kind === 'package' && e.file === 'supabase/functions/mail/deno.json'));
});

test('no false positives from comments, longer package names or React Email', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { 'mongodb-memory-server': '9', 'react-email': '3', '@react-email/components': '0.1' } }));
	writeFileSync(join(dir, 'a.ts'), `// TODO: import { auth } from "@clerk/nextjs"
/* const s = require('stripe') */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Html } from '@react-email/components';
const url = "https://example.com//x"; import { Pool } from 'mongodb-pool-x';
`);
	writeFileSync(join(dir, 'b.py'), '# supabase.auth.sign_in_with_password\nprint("ok")\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures })), []);
});

test('importMatches: package names match themselves and subpaths, "/" and ":" patterns are prefixes', () => {
	assert.ok(importMatches('mongodb', ['mongodb']));
	assert.ok(importMatches('mongodb/lib/x', ['mongodb']));
	assert.ok(!importMatches('mongodb-memory-server', ['mongodb']));
	assert.ok(importMatches('@sentry/nextjs', ['@sentry/']));
	assert.ok(importMatches('cloudflare:workers', ['cloudflare:']));
	assert.ok(!importMatches('anything', []));
});

test('analytics and other roles: PostHog counts for monitoring only with its error tracking, "other" never overlaps', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { 'posthog-js': '1', '@sentry/nextjs': '8', expo: '52', 'acme-sms': '1', twilio: '5' } }));
	const acme = { id: 'acme-sms', name: 'Acme SMS', roles: ['other'], packages: ['acme-sms'], pypi: [], go: [], imports: [], env_prefixes: [], config_files: [], role_signals: {} };
	writeFileSync(join(dir, 'a.ts'), "import posthog from 'posthog-js';\nimport * as Sentry from '@sentry/nextjs';\nSentry.captureException(new Error('x'));\n");
	let r = detectVendors(dir, { signatures: [...signatures, acme] });
	assert.deepEqual(r.vendors.find((v) => v.id === 'posthog').roles_used, ['analytics'], 'Sentry.captureException is not a PostHog signal');
	assert.deepEqual(r.overlaps, [], 'two mapped "other" vendors (Expo, Acme SMS) and an unmapped one are not an Overlap');
	writeFileSync(join(dir, 'b.ts'), "import posthog from 'posthog-js';\nposthog.captureException(new Error('y'));\n");
	r = detectVendors(dir, { signatures });
	assert.deepEqual(r.overlaps, [{ role: 'monitoring', vendors: ['posthog', 'sentry'] }]);
});

test('evidence cap keeps the package evidence when many env names match', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { stripe: '1' } }));
	writeFileSync(join(dir, '.env'), Array.from({ length: 12 }, (_, i) => `STRIPE_KEY_${i}=x`).join('\n'));
	writeFileSync(join(dir, 'a.js'), "import Stripe from 'stripe';");
	const stripe = detectVendors(dir, { signatures }).vendors.find((v) => v.id === 'stripe');
	assert.equal(stripe.evidence.length, 8);
	assert.deepEqual(stripe.evidence.slice(0, 3).map((e) => e.kind), ['package', 'import', 'env']);
});

test('symlinked files are read, symlinked directories are not followed', { skip: process.platform === 'win32' && 'symlinks need privileges' }, (t) => {
	const dir = tempDir(t);
	const shared = tempDir(t);
	writeFileSync(join(shared, 'package.json'), JSON.stringify({ dependencies: { stripe: '1' } }));
	mkdirSync(join(shared, 'lib'));
	writeFileSync(join(shared, 'lib/a.js'), "import x from '@clerk/nextjs';");
	symlinkSync(join(shared, 'package.json'), join(dir, 'package.json'));
	symlinkSync(join(shared, 'lib'), join(dir, 'lib'));
	symlinkSync(dir, join(dir, 'loop'));
	assert.deepEqual(ids(detectVendors(dir, { signatures })), ['stripe']);
});

test('readEnvNames skips the lines of a multi-line value', () => {
	const env = 'PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\nZm9vYmFyU2VjcmV0S2V5RnJhZ21lbnQ=\n-----END PRIVATE KEY-----"\nOK_NAME=1\nB=\'one\ntwo=x\'\nC=3\n';
	assert.deepEqual(readEnvNames(env), ['PRIVATE_KEY', 'OK_NAME', 'B', 'C']);
	assert.deepEqual(readEnvNames('A="quoted \\" inside"\nB=2\n'), ['A', 'B'], 'an escaped quote does not open a block');
});

test('Python and Go imports find vendors without a manifest', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'app.py'), 'import os, stripe\nfrom openai import OpenAI\nimport sentry_sdk as sentry\n');
	mkdirSync(join(dir, 'worker'));
	writeFileSync(join(dir, 'worker/main.go'), 'package main\n\nimport (\n\t"fmt"\n\tresend "github.com/resend/resend-go/v2"\n)\n');
	assert.deepEqual(extractPythonModules('import os, stripe\nfrom openai import OpenAI\nfrom . import x\n'), ['os', 'stripe', 'openai']);
	assert.deepEqual(extractGoImports('import (\n\t"fmt"\n\tx "github.com/a/b"\n)\nimport "github.com/c/d"\n'), ['fmt', 'github.com/a/b', 'github.com/c/d']);
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['openai', 'resend', 'sentry', 'stripe']);
	assert.ok(r.vendors.every((v) => v.evidence.some((e) => e.kind === 'import')));
});

test('fixtures, mocks and examples are samples, not the stack', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { resend: '6' } }));
	mkdirSync(join(dir, 'test/fixtures/shop'), { recursive: true });
	writeFileSync(join(dir, 'test/fixtures/shop/package.json'), JSON.stringify({ dependencies: { stripe: '14', '@clerk/nextjs': '6' } }));
	writeFileSync(join(dir, 'test/fixtures/shop/.env'), 'SECRET_FROM_FIXTURE=1\n');
	mkdirSync(join(dir, 'examples/k8s'), { recursive: true });
	writeFileSync(join(dir, 'examples/k8s/deploy.yaml'), 'apiVersion: apps/v1\nkind: Deployment\n');
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['resend']);
	assert.deepEqual(r.samples.map((s) => s.id).sort(), ['clerk', 'stripe']);
	assert.deepEqual(r.infra, [], 'a Kubernetes example is not the project running Kubernetes');
	assert.ok(!r.env_names.includes('SECRET_FROM_FIXTURE'));
});

test('a role signal alone does not make a vendor', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'upload.ts'), 'export const up = (client) => client.storage.from("avatars").upload("a", b);\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures })), []);
});

test('the file limit drops source files, never manifests', (t) => {
	const dir = tempDir(t);
	for (let i = 0; i < 30; i++) writeFileSync(join(dir, `n${i}.ts`), 'export {}\n');
	for (let i = 0; i < 30; i++) writeFileSync(join(dir, `d${i}.txt`), 'x\n');
	mkdirSync(join(dir, 'apps/web'), { recursive: true });
	writeFileSync(join(dir, 'apps/web/package.json'), JSON.stringify({ dependencies: { stripe: '14' } }));
	const r = detectVendors(dir, { signatures, maxFiles: 1 });
	assert.equal(r.truncated, true);
	assert.deepEqual(ids(r), ['stripe']);
	assert.equal(r.empty, false);
});

test('a map that names a package beats one that claims its scope', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@vercel/kv': '3', '@vercel/postgres': '0.10' } }));
	writeFileSync(join(dir, 'db.ts'), "import { kv } from '@vercel/kv';\nimport { sql } from '@vercel/postgres';\n");
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['neon', 'upstash'], 'no Vercel hosting from its deprecated storage SDKs');
});

test('detection: React Native SDKs, specific Cloudflare and Paddle env names, self-hosted auth libraries', (t) => {
	const dir = tempDir(t);
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@react-native-firebase/app': '20', '@react-native-firebase/auth': '20', 'react-native-auth0': '4', 'next-auth': '5' } }));
	writeFileSync(join(dir, '.env.example'), 'CF_DISTRIBUTION_ID=\nCF_INSTANCE_GUID=\nPADDLE_TRAINER_ID=\n');
	writeFileSync(join(dir, 'login.ts'), "import auth from '@react-native-firebase/auth';\n");
	const r = detectVendors(dir, { signatures });
	assert.deepEqual(ids(r), ['auth0', 'firebase'], 'CloudFront and PaddlePaddle variables are not Cloudflare or Paddle');
	assert.ok(r.vendors.find((v) => v.id === 'firebase').roles_used.includes('auth'));
	assert.deepEqual(r.unmapped.map((u) => u.name), ['Auth.js']);
	assert.ok(r.overlaps.some((o) => o.role === 'auth' && o.vendors.includes('Auth.js')));
	writeFileSync(join(dir, '.env.example'), 'CF_API_TOKEN=\nPADDLE_API_KEY=\n');
	assert.deepEqual(ids(detectVendors(dir, { signatures })), ['auth0', 'cloudflare', 'firebase', 'paddle']);
});

test('needleMatcher finds every fixed string present, overlapping and nested ones included, short ones too', () => {
	const match = needleMatcher(["client('bedrock", "client('bedrock-runtime'", 'aws_s3_', '"aws_s3_', 'ab', 'AWS::S3::', 'none here']);
	const found = match(`s = boto3.client('bedrock-runtime')\nresource "aws_s3_bucket" "b" {}\nType: AWS::S3::Bucket\nab`);
	assert.deepEqual([...found].sort(), ['"aws_s3_', 'AWS::S3::', "client('bedrock", "client('bedrock-runtime'", 'ab', 'aws_s3_'].sort());
	assert.deepEqual([...match('nothing to see')], []);
	assert.deepEqual([...needleMatcher(['é漢字x'])('a é漢字x b')], ['é漢字x'], 'non-ASCII needles are confirmed in place');
});
