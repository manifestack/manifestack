import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync, symlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ROOT, runNode, tempDir } from './helpers.mjs';
import { parseStackMd, setFields, checkStack, lintStackMd, parseRevisit, parseUsage, readUsage, parseUsers, findSecrets, scrubSecrets } from '../packages/core/src/stack-md.mjs';

// Built from parts so that secret scanners (GitHub push protection) do not take the fixture for a real key.
const RESEND_LIKE = ['re', 'c1tpEyD8', 'NKFusih9vKVQknRAQfmFcWCv'].join('_');

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

test('a comment starts at two spaces and #: set keeps "#" inside values', () => {
	const input = '## Database: Supabase\ndecided: use plan #2 for now\nsource: x.com/pricing  # read 2026-10-06\n';
	assert.equal(parseStackMd(input).sections[0].values.decided, 'use plan #2 for now');
	const out = setFields(input, 'Database: Supabase', { decided: 'move to Pro' });
	assert.match(out, /^decided: move to Pro$/m);
	const issue = setFields(input, 'Database: Supabase', { decided: 'see issue #42' });
	assert.equal(parseStackMd(issue).sections[0].values.decided, 'see issue #42');
	// Two spaces before # in a new value would turn the rest into a comment on the next read.
	assert.equal(parseStackMd(setFields(input, 'Database: Supabase', { next: 'Pro  #1 pick' })).sections[0].values.next, 'Pro #1 pick');
});

test('check: one unreadable section is an error, the others are still checked', () => {
	const doc = (usage, rw = 'db_size > 400 MB') => `## Database: A\nusage: ${usage}\nrevisit_when: ${rw}\n\n## Email: B\nusage: 10\nrevisit_when: monthly_sent > 5\n`;
	const r = checkStack(doc('312 MB, +1.1 MB/day (2026-13-01)'), { today: '2026-10-07' });
	assert.equal(r.sections[0].status, 'error');
	assert.match(r.sections[0].error, /2026-13-01/);
	assert.equal(r.sections[1].status, 'triggered');
	assert.equal(checkStack(doc('312 MB (2027-02-30)'), { today: '2026-10-07' }).sections[0].status, 'error');
	assert.equal(checkStack(doc('1 MB', 'date >= 2027-02-30'), { today: '2026-10-07' }).sections[0].status, 'error');
	const zero = checkStack(doc('0, +20%/mo', 'db_size > 400'), { today: '2026-10-07' }).sections[0];
	assert.deepEqual([zero.status, zero.eta], ['ok', null]);
	const slow = checkStack(doc('1 MB, +0.000001 MB/day (2026-10-01)'), { today: '2026-10-07' }).sections[0];
	assert.deepEqual([slow.status, slow.eta], ['ok', null]);
	assert.throws(() => checkStack(doc('1 MB'), { today: '2026-02-30' }), /YYYY-MM-DD/);
	assert.deepEqual(lintStackMd('## Database: A\nusage: 1 MB (2026-13-01)\n').errors.map((e) => e.line), [1]);
});

test('check: a stale reading whose trend has crossed the threshold is triggered (projected)', () => {
	const r = checkStack('## Database: A\nusage: 312 MB, +1.1 MB/day (2026-01-01)\nrevisit_when: db_size > 400 MB\n', { today: '2026-10-07' }).sections[0];
	assert.equal(r.status, 'triggered');
	assert.equal(r.projected, '2026-03-22');
	assert.equal(r.when, 'Now');
	assert.equal(r.eta, null);
	// A real hit in an OR is not a projection.
	const or = checkStack('## Database: A\nusage: db_size 312 MB, +1.1 MB/day (2026-01-01); mau 900\nrevisit_when: db_size > 400 MB OR mau > 500\n', { today: '2026-10-07' }).sections[0];
	assert.equal(or.status, 'triggered');
	assert.equal(or.projected, undefined);
});

test('check: readings without units follow the metric name, like thresholds', () => {
	const v = '## Hosting: Vercel\nusage: transfer_tb 1.6 (2026-10-01); monthly_bill 540 (2026-10-01)\nrevisit_when: transfer_tb > 1.5 AND monthly_bill > $300\n';
	assert.equal(checkStack(v, { today: '2026-10-07' }).sections[0].status, 'triggered');
	const bare = '## Hosting: Vercel\nrevisit_when: transfer_tb > 1.5\n';
	assert.equal(checkStack(bare, { today: '2026-10-07', metrics: { transfer_tb: { value: 1.6, dim: 'count' } } }).sections[0].status, 'triggered');
	assert.equal(checkStack(bare, { today: '2026-10-07', metrics: { transfer_tb: { value: 1.4, dim: 'count' } } }).sections[0].status, 'ok');
	const rate = checkStack('## Hosting: Vercel\nusage: transfer_tb 1.4, +0.1/mo (2026-10-01)\nrevisit_when: transfer_tb > 1.5\n', { today: '2026-10-07' }).sections[0];
	assert.equal(rate.status, 'ok');
	assert.equal(rate.eta, '2026-10-31');
	assert.equal(checkStack('## Hosting: Vercel\nusage: 3 GB\nrevisit_when: monthly_bill > $300\n', { today: '2026-10-07' }).sections[0].status, 'unknown');
});

test('secrets: env var names, URL slugs and word names are not keys', () => {
	const fine = 'env: NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL, AWS_S3_BUCKET_NAME_FOR_EXPORTS_2024\nsource: clerk.com/changelog/2024-11-05-pro-plan-pricing-update  # read 2026-10-07\ndecided: re_engagement_campaign_emails go through Resend\nnote: re_engagement_campaigns\n';
	assert.deepEqual(findSecrets(fine), []);
	assert.equal(scrubSecrets(fine), fine);
	const keys = `a: ${RESEND_LIKE}\nb: a3f9c2e1b4d5a6f7e8d9c0b1a2f3e4d5c6b7a8f9\nc: dozjgNryP4J3jVmNHl0w5NdozjgNryP4J3jVmN\nd: see docs/2024-11-05-pricing then key_8f3KdA9xQ2mZ7pL4vB6nT1cR5yW0eH3j`;
	assert.deepEqual([...new Set(findSecrets(keys).map((s) => s.line))], [1, 2, 3, 4]);
	assert.doesNotThrow(() => setFields('', 'Storage: R2', { env: 'NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL', source: 'clerk.com/changelog/2024-11-05-pro-plan-pricing-update' }));
});

test('a UTF-8 BOM does not hide the first heading and is not written back', () => {
	const text = '\uFEFF## Requirements\nbudget: $1\n';
	assert.deepEqual(parseStackMd(text).requirements, { budget: '$1' });
	assert.equal(setFields(text, 'Requirements', { users: '5' }), '## Requirements\nbudget: $1\nusers: 5\n');
	assert.deepEqual(lintStackMd(text).warnings, []);
});

test('set keeps each line ending and uses the dominant one for new lines', () => {
	assert.equal(setFields('## A: B\r\nplan: x\nlimit: y\nnext: z\n', 'A: B', { plan: 'w', env: 'E' }), '## A: B\r\nplan: w\nlimit: y\nnext: z\nenv: E\n');
	assert.equal(setFields('## A: B\r\nplan: x\r\nnext: z\n', 'A: B', { env: 'E' }), '## A: B\r\nplan: x\r\nnext: z\nenv: E\r\n');
	assert.equal(setFields('## A: B\nplan: x', 'A: B', { env: 'E' }), '## A: B\nplan: x\nenv: E\n');
});

test('set rejects line breaks in section names and comments', () => {
	assert.throws(() => setFields('', 'Auth: X', { plan: 'a' }, { plan: 'ok\n## Auth: Evil' }), /one line/);
	assert.throws(() => setFields('', 'Auth: X\r\n## Auth: Evil', { plan: 'a' }), /one line/);
	assert.throws(() => setFields('', 'Auth: X', { plan: 'a' }, { plan: 'sk_live_abcdefgh12345678' }), /secret/);
});

test('a comment without a value comments the existing line', () => {
	assert.equal(setFields('## A: B\nplan: x\n', 'A: B', {}, { plan: 'checked 2026-10-07' }), '## A: B\nplan: x  # checked 2026-10-07\n');
	assert.equal(setFields('## A: B\nplan: x  # old\n', 'A: B', {}, { plan: '' }), '## A: B\nplan: x\n');
	assert.throws(() => setFields('## A: B\nplan: x\n', 'A: B', {}, { limit: 'checked' }), /no limit line/);
	assert.throws(() => setFields('', 'A: B', {}, { plan: 'checked' }), /no plan line/);
});

test('section names match regardless of spacing around ":" and case', () => {
	const input = '## Database: Supabase\nplan: x\n';
	assert.equal(setFields(input, 'Database:Supabase', { plan: 'y' }), '## Database: Supabase\nplan: y\n');
	assert.equal(setFields(input, '  database :  supabase ', { plan: 'y' }), '## Database: Supabase\nplan: y\n');
	assert.match(setFields(input, 'Auth:Clerk', { plan: 'Hobby' }), /\n## Auth: Clerk\nplan: Hobby\n$/);
});

test('headings inside HTML comments are not sections', () => {
	const text = '## Requirements\nbudget: $1\n\n<!--\n## Database: Firebase\nplan: x\n-->\n<!-- ## Auth: Y -->\n\n## Email: Resend\nplan: Free\n';
	assert.deepEqual(parseStackMd(text).sections.map((s) => s.heading), ['Requirements', 'Email: Resend']);
	assert.match(setFields(text, 'Database: Firebase', { plan: 'Spark' }), /\n## Database: Firebase\nplan: Spark\n$/);
	const template = readFileSync(join(ROOT, 'skills/manifestack/assets/STACK.template.md'), 'utf8');
	assert.deepEqual(parseStackMd(template).sections.map((s) => s.heading), ['Requirements']);
});

test('Requirements users: thousands, k/m and the first number only when it is a user count', () => {
	for (const [text, n] of [['9 000', 9000], ['9,000 now', 9000], ['~9k', 9000], ['1_500 users', 1500], ['1.2M', 1.2e6], ['9k now, 50k by Q3', 9000], ['40 now, 60 by next year', 40], ['Q3: 50k', 50000]]) assert.equal(parseUsers(text), n, text);
	for (const text of ['12 months out, 3k', '2026-10-01: 9k', '$5 / seat', 'not sure', '', undefined]) assert.equal(parseUsers(text), null, String(text));
	const doc = (users) => `## Requirements\nusers: ${users}\n\n## Auth: Clerk\nrevisit_when: users > 5k\n`;
	assert.equal(checkStack(doc('9 000'), { today: '2026-10-07' }).sections[0].status, 'triggered');
	assert.equal(checkStack(doc('12 months out, 3k'), { today: '2026-10-07' }).sections[0].status, 'unknown');
});

test('quantities: "1,5 GB" is not 15 GB, and parentheses need no spaces', () => {
	assert.throws(() => parseRevisit('db_size > 1,5 GB'), /cannot read/);
	assert.equal(checkStack('## Database: A\nusage: 1,5 GB\nrevisit_when: db_size > 1 GB\n', { today: '2026-10-07' }).sections[0].status, 'unknown');
	assert.equal(parseRevisit('(db_size > 400 MB)AND(date >= 2027-01-01)').type, 'AND');
	assert.equal(parseRevisit('(db_size > 400 MB)OR date >= 2027-01-01').type, 'OR');
	assert.equal(checkStack('## Database: A\nusage: 450 MB\nrevisit_when: (db_size > 400 MB)AND(date >= 2026-01-01)\n', { today: '2026-10-07' }).sections[0].status, 'triggered');
});

test('stack-md.mjs set --json reads values and comments from a file or stdin', (t) => {
	const dir = tempDir(t);
	const script = join(ROOT, 'skills/manifestack-guard/scripts/stack-md.mjs');
	const page = 'Free: 3,000 emails/mo $(touch pwned) `id`';
	const r = runNode(script, ['set', '--section', 'Email: Resend', '--json', '-'], { cwd: dir, input: JSON.stringify({ plan: 'Free', limit: page, source: { value: 'resend.com/pricing', comment: 'read 2026-10-07' } }) });
	assert.equal(r.code, 0, r.stderr);
	const file = join(dir, '.manifestack/STACK.md');
	assert.equal(readFileSync(file, 'utf8'), `## Email: Resend\nplan: Free\nlimit: ${page}\nsource: resend.com/pricing  # read 2026-10-07\n`);
	writeFileSync(join(dir, 'fields.json'), JSON.stringify({ plan: { comment: 'checked 2026-10-08' }, usage: 'monthly_sent 1,200 (2026-10-08)' }));
	const f = runNode(script, ['set', '--section', 'Email:Resend', '--json', 'fields.json', '--set', 'next=Pro'], { cwd: dir });
	assert.equal(f.code, 0, f.stderr);
	assert.match(readFileSync(file, 'utf8'), /^plan: Free {2}# checked 2026-10-08\n[^]*usage: monthly_sent 1,200 \(2026-10-08\)\nnext: Pro\n$/m);
	const before = readFileSync(file, 'utf8');
	for (const [input, re] of [['[1]', /object/], ['{"plan": ', /not valid JSON/], ['{"plan": {"value": "x", "extra": 1}}', /value/], ['{"plan": "Pro"}', /given twice/], [`{"env": "RESEND_KEY=${RESEND_LIKE}"}`, /secret/]]) {
		const bad = runNode(script, ['set', '--section', 'Email: Resend', '--set', 'plan=Pro', '--json', '-'], { cwd: dir, input });
		assert.notEqual(bad.code, 0, input);
		assert.match(bad.stderr, re, input);
		assert.ok(!bad.stderr.includes('re_c1tp'));
	}
	assert.equal(readFileSync(file, 'utf8'), before);
});

test('stack-md.mjs CLI: --help, --today, confinement and newline injection', (t) => {
	const dir = tempDir(t);
	const script = join(ROOT, 'skills/manifestack/scripts/stack-md.mjs');
	const help = runNode(script, ['set', '--help'], { cwd: dir });
	assert.equal(help.code, 0);
	assert.match(help.stdout, /--json/);
	mkdirSync(join(dir, 'proj/.manifestack'), { recursive: true });
	const cwd = join(dir, 'proj');
	writeFileSync(join(cwd, '.manifestack/STACK.md'), SITE_EXAMPLE);
	assert.match(runNode(script, ['check', '--today'], { cwd }).stderr, /--today needs a date/);
	assert.match(runNode(script, ['check', '--today', '2026-13-01'], { cwd }).stderr, /--today needs a date/);
	const out = runNode(script, ['set', '../outside.md', '--section', 'A: B', '--set', 'plan=x'], { cwd });
	assert.notEqual(out.code, 0);
	assert.match(out.stderr, /outside the current directory/);
	assert.ok(!existsSync(join(dir, 'outside.md')));
	symlinkSync(join(dir, 'elsewhere.md'), join(cwd, 'link.md'));
	assert.notEqual(runNode(script, ['set', 'link.md', '--section', 'A: B', '--set', 'plan=x'], { cwd }).code, 0);
	assert.ok(!existsSync(join(dir, 'elsewhere.md')));
	const before = readFileSync(join(cwd, '.manifestack/STACK.md'), 'utf8');
	const inj = runNode(script, ['set', '--section', 'Auth: Clerk', '--set', 'plan=Hobby', '--comment', 'plan=ok\n## Auth: Evil'], { cwd });
	assert.notEqual(inj.code, 0);
	assert.equal(readFileSync(join(cwd, '.manifestack/STACK.md'), 'utf8'), before);
	const c = runNode(script, ['set', '--section', 'Database: Supabase', '--comment', 'plan=checked 2026-10-08'], { cwd });
	assert.equal(c.code, 0, c.stderr);
	assert.match(readFileSync(join(cwd, '.manifestack/STACK.md'), 'utf8'), /^plan: free {2}# checked 2026-10-08$/m);
	assert.notEqual(runNode(script, ['set', '--section', 'Database: Supabase', '--comment', 'owner=me'], { cwd }).code, 0);
});

test('"<!--" inside a value is text; only a line starting with <!-- opens a comment', () => {
	const doc = parseStackMd('## Database: Neon\ndecided: keep free tier <!-- see wiki\nusage: 450 MB\n\n<!--\n## Auth: Example\n-->\n## Email: Resend\nplan: Free\n');
	assert.deepEqual(doc.sections.map((s) => s.heading), ['Database: Neon', 'Email: Resend']);
	assert.equal(doc.sections[0].values.usage, '450 MB');
});

test('users written out in words: million, thousand, bn', () => {
	assert.equal(parseUsers('5 million'), 5e6);
	assert.equal(parseUsers('1.5 Million by 2027'), 1.5e6);
	assert.equal(parseUsers('2 thousand'), 2000);
	assert.equal(parseUsers('3 bn'), 3e9);
	assert.equal(parseUsers('5 mo'), null);
});

test('Requirements: priority is a known key and goes after avoid', () => {
	const text = setFields('## Requirements\nbudget: ~$150/mo\navoid: Kubernetes\n\n## Database: Supabase\nplan: Pro\n', 'Requirements', { priority: 'least ops' });
	assert.match(text, /^avoid: Kubernetes\npriority: least ops\n\n## Database/m);
	assert.equal(parseStackMd(text).requirements.priority, 'least ops');
	assert.deepEqual(lintStackMd(text).errors, []);
});

test('lint warns about a priority outside the four known values', () => {
	const warn = (p) => lintStackMd(`## Requirements\nbudget: ~$150/mo\npriority: ${p}\n`).warnings.map((w) => w.message);
	assert.ok(warn('least-ops').some((m) => /priority "least-ops" is not one of lowest cost, balanced, least ops, control/.test(m)));
	assert.deepEqual(warn('Least ops'), []);
	assert.deepEqual(warn('lowest cost  # user 2026-10-08'), []);
});

test('readUsage: separators, dates and words people write, and what it cannot read', () => {
	const semi = readUsage('312 MB; +1.1 MB/day (2026-10-06)');
	assert.deepEqual(semi.metrics, { _: { value: 312, dim: 'size', asOf: '2026-10-06', ratePerDay: 1.1 } }, 'a rate after ; continues the reading');
	assert.deepEqual(semi.problems, []);
	assert.equal(parseUsage('312 MB,+1.1 MB/day (2026-10-06)')._.ratePerDay, 1.1, 'no space after the comma');
	assert.equal(parseUsage('312 MB, +1.1 MB/day (as of 2026-10-6)')._.asOf, '2026-10-06');
	const sent = parseUsage('41,200 emails, +18%/mo (2026-10-01)')._;
	assert.equal(sent.value, 41200);
	assert.ok(Math.abs(sent.growthPerMonth - 0.18) < 1e-12);
	assert.equal(parseUsage('MAU 9k users').mau.value, 9000);
	assert.ok(Math.abs(parseUsage('db_size 100 MB, +10%/week (2026-10-01)').db_size.growthPerMonth - (1.1 ** (30.4375 / 7) - 1)) < 1e-12, 'weekly growth compounds');
	assert.match(readUsage('about three hundred megs').problems[0], /cannot read/);
	assert.match(readUsage('312 MB, +1.1 MB/day').problems[0], /has no date/);
	assert.throws(() => readUsage('312 MB (2026-02-30)'), /not a date/);
});

test('lint warns about usage it cannot read instead of passing it', () => {
	const r = lintStackMd('## Requirements\nbudget: $50\n\n## Database: Supabase\nusage: lots of data\nsource: supabase.com/pricing  # read 2026-10-08\n');
	assert.equal(r.ok, true);
	assert.match(r.warnings.map((w) => w.message).join('\n'), /usage: cannot read "lots of data"/);
	const ok = lintStackMd('## Requirements\nbudget: $50\n\n## Database: Supabase\nusage: 312 MB, +1.1 MB/day (2026-10-06)\nsource: supabase.com/pricing  # read 2026-10-08\n');
	assert.deepEqual(ok.warnings, []);
	const c = checkStack('## Database: Supabase\nusage: 312 MB; +1.1 MB/day (2026-10-06)\nrevisit_when: db_size > 400 MB\n', { today: '2026-10-08' }).sections[0];
	assert.equal(c.eta, '2026-12-25', 'the ; form projects instead of reading 1.1 MB');
});

test('parseUsers skips years and multipliers', () => {
	assert.equal(parseUsers('launch in 2027 with 5k users'), 5000);
	assert.equal(parseUsers('by end of 2026: 50k'), 50000);
	assert.equal(parseUsers('5x growth, 9k now'), 9000);
	assert.equal(parseUsers('2000 users at launch'), 2000);
	assert.equal(parseUsers('2026-10-01: 9k'), null, 'a date first stays unclear');
});

test('date > X is due the day after X', () => {
	const r = checkStack('## Database: Supabase\nrevisit_when: date > 2026-12-01\n', { today: '2026-10-08' }).sections[0];
	assert.equal(r.eta, '2026-12-02');
	assert.equal(checkStack('## Database: Supabase\nrevisit_when: date >= 2026-12-01\n', { today: '2026-10-08' }).sections[0].eta, '2026-12-01');
});

test('secrets: forms that slipped through before, and ids that are not secrets', () => {
	for (const line of [
		`note: ${['wJalrXUtnFEMI', 'K7MDENG', 'bPxRfiCYEXAMPLEKEY'].join('/')}`,
		'cache: redis://:hunter2pass@cache.example.com:6379',
		'db_password: Sup3rS3cretPw',
		'stripe_secret_key=sk9fj3Kd02mZ',
		'{"apiKey": "AIzaSyD3x9Q"}',
	]) {
		assert.equal(findSecrets(line).length, 1, line);
	}
	for (const line of [
		'source: github.com/o/r/blob/3f786850e387550fdab836ed7e6dc881de23001b/P.md',
		'note: project https://app.example.com/p/123e4567-e89b-12d3-a456-426614174000/settings',
		'plan: price_1NabcDEFghiJKLmnoPQRstuVWx',
		'env: STRIPE_SECRET_KEY, RESEND_API_KEY',
		'note: token: limits apply per minute',
	]) {
		assert.deepEqual(findSecrets(line), [], line);
	}
	assert.equal(findSecrets('STRIPE_SECRET_KEY=whsec_live_abc123').length, 1, 'one hit per line');
});

test('set: a false alarm already in the file does not block other updates; the write is atomic', (t) => {
	const dir = tempDir(t);
	const file = join(dir, '.manifestack/STACK.md');
	mkdirSync(join(dir, '.manifestack'));
	writeFileSync(file, '## Database: Supabase\nnote: a3f9c2e1b4d5a6f7e8d9c0b1a2f3e4d5c6b7a8f9\n');
	const r = runNode(join(ROOT, 'skills/manifestack/scripts/stack-md.mjs'), ['set', '--section', 'Database: Supabase', '--set', 'plan=Pro'], { cwd: dir });
	assert.equal(r.code, 0, r.stderr);
	assert.deepEqual(JSON.parse(r.stdout).secrets_elsewhere, [2]);
	assert.match(readFileSync(file, 'utf8'), /plan: Pro/);
	assert.ok(!readdirSync(join(dir, '.manifestack')).some((f) => f.endsWith('.tmp')), 'no temp file left');
	const bad = runNode(join(ROOT, 'skills/manifestack/scripts/stack-md.mjs'), ['set', '--section', 'Database: Supabase', '--set', 'sk_live_abcdefgh12345678'], { cwd: dir });
	assert.equal(bad.code, 1);
	assert.doesNotMatch(bad.stderr, /sk_live/, 'the value is not echoed');
});

test('fences close only on the same marker; headings keep a trailing # and drop a leading ##', () => {
	const tilde = '## Database: Supabase\nplan: free\n\n~~~\n```\n~~~\n';
	assert.match(setFields(tilde, 'Database: Supabase', { plan: 'pro' }), /^## Database: Supabase\nplan: pro\n/);
	assert.equal(setFields(tilde, 'Database: Supabase', { plan: 'pro' }).match(/## Database/g).length, 1);
	const four = '## Database: Supabase\nplan: free\n\n````\n```\n## Database: Supabase\nplan: example\n```\n````\n';
	const out = setFields(four, 'Database: Supabase', { plan: 'pro' });
	assert.match(out, /^## Database: Supabase\nplan: pro\n/);
	assert.match(out, /plan: example/, 'the example inside the code block is untouched');
	const sharp = setFields('', 'Other: C#', { plan: 'x' });
	assert.equal(setFields(sharp, 'Other: C#', { plan: 'y' }).match(/## Other/g).length, 1);
	assert.equal(parseStackMd(sharp).sections[0].heading, 'Other: C#');
	assert.match(setFields('', '## Database: Neon', { plan: 'x' }), /^## Database: Neon\n/);
	assert.throws(() => setFields('', 'Database:', { plan: 'x' }), /names no vendor/);
});

test('long runs of spaces stay linear: headings, comments and usage', () => {
	const sp = ' '.repeat(50000);
	const t = Date.now();
	parseStackMd(`## a${sp}b${sp}#x\nplan: x${sp}y\n`);
	readUsage(`9A${sp}x`);
	setFields('', `a${sp}b: c`, { plan: 'x' });
	assert.ok(Date.now() - t < 300, `took ${Date.now() - t} ms`);
	assert.deepEqual(parseStackMd('## Database: Supabase ##\nplan: free  # since May\n').sections[0], { heading: 'Database: Supabase', kind: 'service', role: 'Database', vendor: 'Supabase', line: 1, values: { plan: 'free' }, comments: { plan: 'since May' } });
	assert.equal(parseUsage('3.4 TB of transfer, +0.3 TB/mo (2026-10-01)')._.value, 3.4e6);
});
