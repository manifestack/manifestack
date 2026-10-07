import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ROOT, runNode, tempDir } from './helpers.mjs';
import { parseStackMd, setFields, checkStack, lintStackMd, parseRevisit, parseUsage, findSecrets, scrubSecrets } from '../packages/core/src/stack-md.mjs';

const SITE_EXAMPLE = `## Requirements
budget: ~$600/mo
users: 9k now, 50k by Q3
requires: EU database, SOC 2 vendors
prefer: Postgres, Next.js
avoid: Kubernetes

## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
usage: 312 MB, +1.1 MB/day (2026-10-06)
decided: stay on Free until first paying user
revisit_when: db_size > 400 MB OR date >= 2027-02-01
next: Pro, $25/mo
env: SUPABASE_URL, SUPABASE_ANON_KEY  # names only
`;

test('parses the example from the site', () => {
	const doc = parseStackMd(SITE_EXAMPLE);
	assert.deepEqual(doc.requirements, { budget: '~$600/mo', users: '9k now, 50k by Q3', requires: 'EU database, SOC 2 vendors', prefer: 'Postgres, Next.js', avoid: 'Kubernetes' });
	const db = doc.sections[1];
	assert.equal(db.role, 'Database');
	assert.equal(db.vendor, 'Supabase');
	assert.equal(db.values.source, 'supabase.com/pricing');
	assert.equal(db.comments.source, 'read 2026-10-06');
	assert.equal(db.values.env, 'SUPABASE_URL, SUPABASE_ANON_KEY');
	assert.equal(db.comments.env, 'names only');
});

test('the site example lints clean', () => {
	assert.deepEqual(lintStackMd(SITE_EXAMPLE), { ok: true, errors: [], warnings: [] });
});

test('revisit_when: the site example is ok today with an ETA when db_size passes 400 MB', () => {
	const r = checkStack(SITE_EXAMPLE, { today: '2026-10-07' });
	assert.equal(r.sections[0].status, 'ok');
	assert.equal(r.sections[0].eta, '2026-12-25');
	assert.equal(r.next, '2026-12-25');
});

test('revisit_when: triggered by a metric override and by the date', () => {
	assert.equal(checkStack(SITE_EXAMPLE, { today: '2026-10-07', metrics: { db_size: { value: 420, dim: 'size' } } }).sections[0].status, 'triggered');
	assert.equal(checkStack(SITE_EXAMPLE, { today: '2027-02-01' }).sections[0].status, 'triggered');
});

test('revisit_when grammar: precedence, parentheses, units, manual', () => {
	const tree = parseRevisit('a > 1 OR b > 2 AND c < 3');
	assert.equal(tree.type, 'OR');
	assert.equal(tree.args[1].type, 'AND');
	assert.equal(parseRevisit('(a > 1 OR b > 2) AND c < 3').type, 'AND');
	assert.deepEqual(parseRevisit('before launch'), { type: 'manual', text: 'before launch' });
	assert.equal(parseRevisit('monthly_bill > $300').dim, 'money');
	assert.throws(() => parseRevisit('db_size >'), /cannot read/);
	assert.throws(() => parseRevisit('date >= next year'), /YYYY-MM-DD/);
	assert.throws(() => parseRevisit('(a > 1'), /missing \)/);
});

test('revisit_when: unknown metrics, units by name and AND/OR with unknowns', () => {
	const doc = (rw, usage = '') => `## Hosting: Vercel\nusage: ${usage}\nrevisit_when: ${rw}\n`;
	const unknown = checkStack(doc('monthly_bill > $300'), { today: '2026-10-07' }).sections[0];
	assert.equal(unknown.status, 'unknown');
	assert.deepEqual(unknown.unknown, ['monthly_bill']);
	assert.equal(checkStack(doc('transfer_tb > 1', 'transfer_tb 3.4 TB (2026-10-01)'), { today: '2026-10-07' }).sections[0].status, 'triggered');
	assert.equal(checkStack(doc('transfer_tb > 1 OR monthly_bill > $300', 'transfer_tb 3.4 TB'), { today: '2026-10-07' }).sections[0].status, 'triggered');
	assert.equal(checkStack(doc('transfer_tb > 5 AND monthly_bill > $300', 'transfer_tb 3.4 TB'), { today: '2026-10-07' }).sections[0].status, 'ok');
	assert.equal(checkStack(doc('before launch'), { today: '2026-10-07' }).sections[0].status, 'manual');
	assert.equal(checkStack(doc('users > 5k'), { today: '2026-10-07' }).sections[0].status, 'unknown');
	assert.equal(checkStack('## Requirements\nusers: 9k now\n\n' + doc('users > 5k'), { today: '2026-10-07' }).sections[0].status, 'triggered');
});

test('fixture next-vercel-supabase-resend: Vercel triggered, Resend ETA', () => {
	const r = checkStack(readFileSync(join(FIXTURES, 'next-vercel-supabase-resend/.manifestack/STACK.md'), 'utf8'), { today: '2026-10-07' });
	const by = Object.fromEntries(r.sections.map((s) => [s.heading, s]));
	assert.equal(by['Hosting: Vercel'].status, 'triggered');
	assert.equal(by['Database: Supabase'].status, 'ok');
	assert.equal(by['Email: Resend'].status, 'ok');
	assert.match(by['Email: Resend'].when, /^ETA ~Oct 2026$/);
});

test('parseUsage: unnamed, named and several entries', () => {
	assert.deepEqual(parseUsage('312 MB, +1.1 MB/day (2026-10-06)'), { _: { value: 312, dim: 'size', asOf: '2026-10-06', ratePerDay: 1.1 } });
	const m = parseUsage('monthly_sent 41,200, +18%/mo (2026-10-01); daily_peak 2,900');
	assert.equal(m.monthly_sent.value, 41200);
	assert.equal(Math.round(m.monthly_sent.growthPerMonth * 100), 18);
	assert.equal(m.daily_peak.value, 2900);
	assert.equal(parseUsage('db_size=136 MB, +14 MB/week').db_size.ratePerDay, 2);
});

test('setFields updates only its fields and keeps comments, unknown keys and other text', () => {
	const input = SITE_EXAMPLE + '\n## Notes\nwritten by hand, keep me\n';
	const out = setFields(input, 'Database: Supabase', { usage: '330 MB, +1.1 MB/day (2026-10-20)', owner: 'ops' });
	assert.match(out, /^usage: 330 MB, \+1\.1 MB\/day \(2026-10-20\)$/m);
	assert.match(out, /^source: supabase\.com\/pricing  # read 2026-10-06$/m);
	assert.match(out, /^env: SUPABASE_URL, SUPABASE_ANON_KEY  # names only$/m);
	assert.match(out, /written by hand, keep me/);
	assert.match(out, /env: SUPABASE_URL, SUPABASE_ANON_KEY  # names only\nowner: ops\n/);
	assert.equal(out.split('\n').length, input.split('\n').length + 1);
});

test('setFields keeps the key order and replaces a comment only when asked', () => {
	const out = setFields('## Email: Resend\nplan: Free\nenv: RESEND_API_KEY\n', 'Email: Resend', { limit: '3,000/mo, 100/day', source: 'resend.com/pricing' }, { source: 'read 2026-10-07' });
	assert.equal(out, '## Email: Resend\nplan: Free\nlimit: 3,000/mo, 100/day\nsource: resend.com/pricing  # read 2026-10-07\nenv: RESEND_API_KEY\n');
});

test('setFields puts avoid right after prefer', () => {
	const out = setFields('## Requirements\nbudget: $50/mo\nprefer: React\nnote: kept\n', 'Requirements', { avoid: 'Kubernetes' });
	assert.equal(out, '## Requirements\nbudget: $50/mo\nprefer: React\navoid: Kubernetes\nnote: kept\n');
});

test('setFields creates a missing section in the site layout', () => {
	const out = setFields(SITE_EXAMPLE, 'Auth: Clerk', { plan: 'Hobby', env: 'CLERK_SECRET_KEY' });
	assert.ok(out.endsWith('\n\n## Auth: Clerk\nplan: Hobby\nenv: CLERK_SECRET_KEY\n'), JSON.stringify(out.slice(-60)));
	assert.equal(setFields('', 'Requirements', { budget: '$0' }), '## Requirements\nbudget: $0\n');
});

test('setFields refuses secrets', () => {
	assert.throws(() => setFields(SITE_EXAMPLE, 'Auth: Clerk', { env: 'CLERK_SECRET_KEY=abc12345678' }), /secret/);
	assert.throws(() => setFields(SITE_EXAMPLE, 'Database: Supabase', { note: 'postgres://u:hunter22@db.example.com/app' }), /secret/);
	assert.throws(() => setFields(SITE_EXAMPLE, 'Database: Supabase', { note: 'two\nlines' }), /one line/);
});

test('findSecrets and scrubSecrets', () => {
	const text = 'a: sk_live_abcdefgh12345678\nb: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N\nc: plain text 400 MB\nd: re_123456789_abcdefghijklmnop';
	assert.deepEqual(findSecrets(text).map((s) => s.line), [1, 2, 4]);
	assert.ok(!/sk_live|eyJ|re_1/.test(scrubSecrets(text)));
	assert.equal(findSecrets(SITE_EXAMPLE).length, 0);
	assert.equal(findSecrets('Set `NODE_ENV=production` and LOG_LEVEL=warning in the Dockerfile').length, 0);
	assert.equal(findSecrets('STRIPE_SECRET_KEY=whsec_live_abc123').length, 1);
});

test('lint reports secrets as errors and format issues as warnings', () => {
	const r = lintStackMd('## Database Supabase\nplan: free\n\n## Cache: Redis\nenv: REDIS_URL=redis://x\nsource: redis.io/pricing\nrevisit_when: hits > 3 OR\n');
	assert.equal(r.ok, false);
	const messages = [...r.errors, ...r.warnings].map((e) => e.message).join('\n');
	assert.match(messages, /names only/);
	assert.match(messages, /not "<Role>: <Vendor>"/);
	assert.match(messages, /role "Cache"/);
	assert.match(messages, /read date/);
	assert.match(messages, /unexpected end/);
});

test('stack-md.mjs CLI: parse, check, lint, set and refusal', (t) => {
	const dir = tempDir(t);
	const script = join(ROOT, 'skills/manifestack-guard/scripts/stack-md.mjs');
	assert.deepEqual(JSON.parse(runNode(script, ['parse'], { cwd: dir }).stdout), { exists: false, file: '.manifestack/STACK.md' });
	mkdirSync(join(dir, '.manifestack'));
	writeFileSync(join(dir, '.manifestack/STACK.md'), SITE_EXAMPLE);
	assert.equal(JSON.parse(runNode(script, ['parse'], { cwd: dir }).stdout).sections.length, 2);
	const check = JSON.parse(runNode(script, ['check', '--today', '2026-10-07', '--metric', 'db_size=450 MB'], { cwd: dir }).stdout);
	assert.equal(check.sections[0].status, 'triggered');
	assert.equal(runNode(script, ['lint'], { cwd: dir }).code, 0);
	const set = runNode(script, ['set', '--section', 'Email: Resend', '--set', 'plan=Free', '--set', 'revisit_when=monthly_sent >= 2500', '--comment', 'plan=checked 2026-10-07'], { cwd: dir });
	assert.equal(set.code, 0, set.stderr);
	assert.match(readFileSync(join(dir, '.manifestack/STACK.md'), 'utf8'), /## Email: Resend\nplan: Free  # checked 2026-10-07\nrevisit_when: monthly_sent >= 2500\n$/);
	const before = readFileSync(join(dir, '.manifestack/STACK.md'), 'utf8');
	const bad = runNode(script, ['set', '--section', 'Auth: Clerk', '--set', 'env=CLERK_SECRET_KEY=sk_live_abcdefgh12345678'], { cwd: dir });
	assert.notEqual(bad.code, 0);
	assert.equal(readFileSync(join(dir, '.manifestack/STACK.md'), 'utf8'), before);
	assert.ok(!bad.stdout.includes('sk_live') && !bad.stderr.includes('sk_live'));
	assert.ok(existsSync(join(dir, '.manifestack/STACK.md')));
});

test('stack-md.mjs set creates .manifestack/ when it is missing', (t) => {
	const dir = tempDir(t);
	const script = join(ROOT, 'skills/manifestack/scripts/stack-md.mjs');
	const r = runNode(script, ['set', '--section', 'Database: Neon', '--set', 'plan=Free'], { cwd: dir });
	assert.equal(r.code, 0, r.stderr);
	assert.equal(JSON.parse(r.stdout).file, '.manifestack/STACK.md');
	assert.match(readFileSync(join(dir, '.manifestack/STACK.md'), 'utf8'), /## Database: Neon\nplan: Free\n/);
});
