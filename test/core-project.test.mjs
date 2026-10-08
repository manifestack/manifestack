import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, runNode, tempDir } from './helpers.mjs';
import { parseQuantity, overage, eta, linearRate, costAt, approxMonth, monthlyGrowth, splitPoints } from '../packages/core/src/project.mjs';

test('parseQuantity reads sizes, money, counts, rates and percents', () => {
	assert.deepEqual(parseQuantity('312 MB'), { value: 312, dim: 'size', per: null });
	assert.equal(parseQuantity('3.4 TB').value, 3.4e6);
	assert.deepEqual(parseQuantity('$25/mo'), { value: 25, dim: 'money', per: 30.4375 });
	assert.equal(parseQuantity('41,200').value, 41200);
	assert.equal(parseQuantity('9k').value, 9000);
	assert.deepEqual(parseQuantity('+1.1 MB/day'), { value: 1.1, dim: 'size', per: 1 });
	assert.deepEqual(parseQuantity('18%/mo'), { value: 18, dim: 'pct', per: 30.4375 });
	assert.throws(() => parseQuantity('lots'));
});

test('site example: 9,000 GB × $0.15 = $1,350', () => {
	assert.equal(overage({ used: 9000, price: 0.15 }).cost, 1350);
});

test('site example: Vercel 3.4 TB with 1 TB included at $0.15/GB = $360/mo', () => {
	const gb = 1000;
	assert.equal(overage({ used: parseQuantity('3.4 TB').value, included: parseQuantity('1 TB').value, price: 0.15, per: gb }).cost, 360);
});

test('site example: 136 MB at +14 MB/week reaches 500 MB 26 weeks later (around week 33 of the chart)', () => {
	const r = eta({ current: 136, limit: 500, ratePerDay: 2, from: '2026-01-01' });
	assert.equal(r.weeks, 26);
	// From the start of the chart (38 MB at week 0): week 33.
	assert.equal(eta({ current: 38, limit: 500, ratePerDay: 2, from: '2026-01-01' }).weeks, 33);
});

test('site example: Supabase 312/500 MB at +1.1 MB/day → ETA ~Mar 2027', () => {
	const r = eta({ current: 312, limit: 500, ratePerDay: 1.1, from: '2026-10-06' });
	assert.equal(r.when, 'ETA ~Mar 2027');
});

test('site example: Resend 41,200/50,000 at +18%/mo → ETA ~Nov 2026', () => {
	const r = eta({ current: 41200, limit: 50000, growthPerMonth: 0.18, from: '2026-10-06' });
	assert.equal(r.when, 'ETA ~Nov 2026');
});

test('eta handles reached limits, flat trends and two data points', () => {
	assert.equal(eta({ current: 600, limit: 500, ratePerDay: 1 }).when, 'Now');
	assert.equal(eta({ current: 100, limit: 500, ratePerDay: 0 }).date, null);
	const r = eta({ points: [{ date: '2026-09-06', value: 280 }, { date: '2026-10-06', value: 310 }], limit: 500 });
	assert.equal(r.rate_per_day, 1);
	assert.equal(r.date, '2027-04-14');
	assert.throws(() => linearRate([{ date: '2026-01-01', value: 1 }]));
});

test('approxMonth', () => assert.equal(approxMonth('2026-11-11'), '~Nov 2026'));

test('costAt picks the cheapest plan that fits at each user count', () => {
	const model = {
		users: [1000, 10000, 100000],
		vendors: [
			{
				id: 'db',
				per_user: { db_mb: 0.1 },
				plans: [
					{ name: 'Free', base: 0, metrics: { db_mb: { included: 500, hard: true } } },
					{ name: 'Pro', base: 25, metrics: { db_mb: { included: 8000, price: 0.125, per: 1000 } } },
				],
			},
			{ id: 'host', fixed: { seats: 2 }, plans: [{ name: 'Hobby', base: 0, eligible: false }, { name: 'Pro', base: 0, metrics: { seats: { included: 0, price: 20 } } }] },
		],
	};
	const [k1, k10, k100] = costAt(model);
	assert.equal(k1.vendors[0].plan, 'Free');
	assert.equal(k10.vendors[0].plan, 'Pro');
	assert.equal(k100.vendors[0].cost, 25 + (10000 - 8000) / 1000 * 0.125);
	assert.equal(k1.vendors[1].plan, 'Pro');
	assert.equal(k1.monthly, 40);
	assert.equal(k1.yearly, 480);
});

test('costAt reports when no listed plan fits', () => {
	const [r] = costAt({ users: [1e6], vendors: [{ id: 'x', per_user: { mau: 1 }, plans: [{ name: 'Free', metrics: { mau: { included: 50000, hard: true } } }] }] });
	assert.equal(r.vendors[0].plan, null);
	assert.equal(r.complete, false);
});

test('bundled project.mjs CLI', () => {
	const script = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const a = runNode(script, ['eta', '--current', '312 MB', '--limit', '500 MB', '--rate', '1.1 MB/day', '--from', '2026-10-06']);
	assert.equal(a.code, 0, a.stderr);
	assert.equal(JSON.parse(a.stdout).date, '2027-03-26');
	const b = runNode(script, ['overage', '--used', '3.4 TB', '--included', '1 TB', '--price', '0.15', '--per', 'GB']);
	assert.deepEqual(JSON.parse(b.stdout), { over: 2400, unit: 'GB', price: 0.15, monthly: 360, yearly: 4320 });
	const c = runNode(script, ['eta', '--current', '41200', '--limit', '50000', '--growth', '18%/mo', '--from', '2026-10-06']);
	assert.equal(JSON.parse(c.stdout).when, 'ETA ~Nov 2026');
	const d = runNode(script, ['overage', '--used', '60000', '--included', '50000', '--price', '0.9', '--per', '1000']);
	assert.equal(JSON.parse(d.stdout).monthly, 9);
	assert.notEqual(runNode(script, ['eta']).code, 0);
});

test('project.mjs cost keeps .manifestack/tmp out of git', (t) => {
	const dir = tempDir(t);
	const script = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	mkdirSync(join(dir, '.manifestack/tmp'), { recursive: true });
	writeFileSync(join(dir, '.manifestack/tmp/model.json'), JSON.stringify({ users: [1000], vendors: [{ id: 'db', plans: [{ name: 'Free', base: 0 }] }] }));
	const r = runNode(script, ['cost', '.manifestack/tmp/model.json'], { cwd: dir });
	assert.equal(r.code, 0, r.stderr);
	assert.equal(JSON.parse(r.stdout)[0].monthly, 0);
	assert.equal(readFileSync(join(dir, '.manifestack/tmp/.gitignore'), 'utf8'), '*\n');
});

test('parseQuantity: thousands come in groups of three', () => {
	assert.throws(() => parseQuantity('1,5 GB'), /cannot read/);
	assert.throws(() => parseQuantity('12,34'), /cannot read/);
	assert.equal(parseQuantity('1,500 GB').value, 1.5e6);
	assert.equal(parseQuantity('9 000').value, 9000);
	assert.equal(parseQuantity('1_000_000').value, 1e6);
	assert.equal(parseQuantity('$1,350.50').value, 1350.5);
});

test('eta: impossible dates are errors, endless trends have no date', () => {
	assert.throws(() => eta({ current: 1, limit: 2, ratePerDay: 1, from: '2026-13-01' }), /YYYY-MM-DD/);
	assert.throws(() => eta({ points: [{ date: '2027-02-30', value: 1 }, { date: '2027-03-01', value: 2 }], limit: 5 }), /YYYY-MM-DD/);
	const zero = eta({ current: 0, limit: 500, growthPerMonth: 0.2, from: '2026-10-01' });
	assert.deepEqual([zero.date, zero.when], [null, 'Not on current trend']);
	const slow = eta({ current: 1, limit: 500, ratePerDay: 1e-6, from: '2026-10-01' });
	assert.deepEqual([slow.date, slow.when], [null, 'Not on current trend']);
});

test('costAt reads unit strings in the metric unit and names bad fields', () => {
	const model = (included) => ({ users: ['1,000'], vendors: [{ id: 'cdn', per_user: { transfer_gb: '0.05 GB' }, plans: [{ name: 'Free', metrics: { transfer_gb: { included, hard: true } } }, { name: 'Pro', base: '$20/mo', metrics: { transfer_gb: { included: '1 TB', price: '$0.15' } } }] }] });
	assert.equal(costAt(model('100 GB'))[0].vendors[0].plan, 'Free');
	assert.equal(costAt(model('10 GB'))[0].vendors[0].plan, 'Pro');
	assert.equal(costAt(model(10))[0].vendors[0].plan, 'Pro');
	assert.throws(() => costAt(model('lots')), /vendor cdn plan Free transfer_gb\.included: cannot read "lots"/);
	assert.throws(() => costAt({ vendors: [{ id: 'x', plans: [{ name: 'P', metrics: { seats: { included: '10 GB' } } }] }] }), /seats\.included: "10 GB" is a size/);
	assert.throws(() => costAt({ vendors: [{ id: 'x', plans: [{ name: 'P', base: null, metrics: { seats: { price: [1] } } }] }] }), /seats\.price: expected a number/);
});

test('project.mjs overage: $ prices, unit checks and clear errors', () => {
	const script = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const ok = runNode(script, ['overage', '--used', '3.4 TB', '--included', '1 TB', '--price', '$0.15', '--per', 'GB']);
	assert.equal(ok.code, 0, ok.stderr);
	assert.equal(JSON.parse(ok.stdout).monthly, 360);
	assert.equal(JSON.parse(runNode(script, ['overage', '--used', '60,000', '--included', '50,000', '--price', '$0.90', '--per', '1,000']).stdout).monthly, 9);
	for (const [args, re] of [
		[['--used', '3.4 TB', '--included', '1000', '--price', '0.15', '--per', 'GB'], /--included is a count/],
		[['--used', '3400', '--price', '0.15', '--per', 'GB'], /--used is a count/],
		[['--used', '3.4 TB', '--price', '0.15'], /--per with a size unit/],
		[['--used', '3.4 TB', '--price', 'cheap', '--per', 'GB'], /cannot read quantity "cheap"/],
		[['--used', '3.4 TB', '--price', '15%', '--per', 'GB'], /--price/],
		[['--used', '3.4 TB', '--price'], /--price needs one value/],
	]) {
		const r = runNode(script, ['overage', ...args]);
		assert.notEqual(r.code, 0, args.join(' '));
		assert.match(r.stderr, re, args.join(' '));
		assert.equal(r.stdout, '');
	}
});

test('project.mjs eta: --points with thousands, repeated --points, --from and --help', () => {
	const script = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const a = runNode(script, ['eta', '--points', '2026-09-06=41,000,2026-10-06=42,000', '--limit', '50,000']);
	assert.equal(a.code, 0, a.stderr);
	assert.equal(JSON.parse(a.stdout).current, 42000);
	const b = runNode(script, ['eta', '--points', '2026-09-06=41,000', '--points', '2026-10-06=42,000', '--limit', '50,000']);
	assert.equal(JSON.parse(b.stdout).date, JSON.parse(a.stdout).date);
	assert.match(runNode(script, ['eta', '--points', '2026-02-30=1;2026-03-01=2', '--limit', '5']).stderr, /YYYY-MM-DD=value/);
	assert.match(runNode(script, ['eta', '--current', '1', '--limit', '5', '--rate', '1/day', '--from']).stderr, /--from needs a date/);
	assert.match(runNode(script, ['eta', '--current', '1 GB', '--limit', '5', '--rate', '1/day']).stderr, /--current is a size but --limit is a count/);
	const help = runNode(script, ['overage', '--help']);
	assert.equal(help.code, 0);
	assert.match(help.stdout, /usage:/);
});

test('project.mjs cost ignores .manifestack/tmp before reading, also for stdin and broken JSON', (t) => {
	const dir = tempDir(t);
	const script = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const tmp = join(dir, '.manifestack/tmp');
	mkdirSync(tmp, { recursive: true });
	writeFileSync(join(tmp, 'model.json'), '{ broken');
	const broken = runNode(script, ['cost', '.manifestack/tmp/model.json'], { cwd: dir });
	assert.notEqual(broken.code, 0);
	assert.match(broken.stderr, /not valid JSON/);
	assert.equal(readFileSync(join(tmp, '.gitignore'), 'utf8'), '*\n');
	rmSync(join(tmp, '.gitignore'));
	const stdin = runNode(script, ['cost', '-'], { cwd: dir, input: JSON.stringify({ users: [1], vendors: [] }) });
	assert.equal(stdin.code, 0, stdin.stderr);
	assert.equal(readFileSync(join(tmp, '.gitignore'), 'utf8'), '*\n');
	// A symlink in place of .gitignore is left alone: nothing is written where it points.
	rmSync(join(tmp, '.gitignore'));
	symlinkSync(join(dir, 'target'), join(tmp, '.gitignore'));
	assert.equal(runNode(script, ['cost', '-'], { cwd: dir, input: '{}' }).code, 0);
	assert.ok(!existsSync(join(dir, 'target')));
});

test('growth rates compound when converted between periods', () => {
	assert.ok(Math.abs(monthlyGrowth(10, 7) - (1.1 ** (30.4375 / 7) - 1)) < 1e-12);
	assert.ok(Math.abs(monthlyGrowth(18) - 0.18) < 1e-12, 'a monthly rate stays as it is');
	const P = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const days = (growth) => JSON.parse(runNode(P, ['eta', '--current', '100', '--limit', '200', '--growth', growth, '--from', '2026-10-08']).stdout).days;
	assert.equal(days('10%/week'), 51, 'doubling at 10% a week takes 7.27 weeks');
	assert.equal(days('5%/day'), 14);
	assert.equal(days('50%/yr'), 624);
});

test('project.mjs eta checks units of --rate, --points and --growth', () => {
	const P = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const err = (...a) => runNode(P, ['eta', ...a]).stderr;
	assert.match(err('--current', '312 MB', '--limit', '500 MB', '--rate', '18%/mo'), /for a percentage use --growth/);
	assert.match(err('--current', '312 MB', '--limit', '500 MB', '--rate', '$5/day'), /--rate is a money but --limit is a size/);
	assert.match(err('--current', '312 MB', '--limit', '500 MB', '--rate', '1.1 MB'), /--rate needs a period/);
	assert.match(err('--points', '2026-09-06=0.28;2026-10-06=0.312', '--limit', '0.5 GB'), /--points 2026-09-06 is a count but --limit is a size/);
	assert.match(err('--current', '41200', '--limit', '50000', '--growth', '18'), /--growth is a percentage/);
	assert.equal(runNode(P, ['eta', '--current', '41200', '--limit', '50000', '--growth', '0.18']).code, 0, 'a fraction still works');
});

test('parseQuantity stays fast on long input and rounds money half up', () => {
	const t = Date.now();
	assert.throws(() => parseQuantity('5' + ' '.repeat(5000) + 'x'));
	assert.throws(() => parseQuantity('5 ' + 'MB '.repeat(40)), /too long/);
	assert.ok(Date.now() - t < 200, `took ${Date.now() - t} ms`);
	assert.equal(parseQuantity('5    MB').value, 5);
	assert.equal(overage({ used: 1.005, price: 1 }).cost, 1.01);
});

test('costAt: plan credit pays for overage, never for the base price; seats go in fixed', () => {
	const model = (credit) => ({
		users: [1000],
		vendors: [{ id: 'x', per_user: { transfer_gb: 1 }, fixed: { seats: 3 }, plans: [{ name: 'Pro', base: 20, credit, metrics: { transfer_gb: { included: 900, price: 0.1 }, seats: { included: 1, price: 20 } } }] }],
	});
	const [none] = costAt(model(0));
	assert.equal(none.monthly, 20 + 10 + 40);
	const [some] = costAt(model(25));
	assert.equal(some.monthly, 20 + 25, 'overage $50, of which $25 is covered');
	assert.equal(some.vendors[0].credit_used, 25);
	const [more] = costAt(model(500));
	assert.equal(more.monthly, 20, 'credit never brings the base price down');
	assert.throws(() => costAt(model(-1)), /credit must not be negative/);
});

test('--points: commas in numbers, ; or , between points, and no slow split on long input', () => {
	const P = join(ROOT, 'skills/manifestack/scripts/project.mjs');
	const eta = (...a) => runNode(P, ['eta', ...a]);
	const r = eta('--points', '2026-09-06=41,200, 2026-10-06=43,000', '--limit', '50000');
	assert.equal(r.code, 0, r.stderr);
	assert.equal(JSON.parse(r.stdout).current, 43000);
	assert.deepEqual(splitPoints('2026-09-06=41,200;2026-10-06 = 43,000, 2026-11-06=44 MB'), ['2026-09-06=41,200', '2026-10-06 = 43,000', '2026-11-06=44 MB']);
	// Long input is checked in this process: Windows caps a command line at 32,767 characters.
	const t = Date.now();
	splitPoints(`2026-09-06=1${' ;'.repeat(50000)}x`);
	assert.ok(Date.now() - t < 200, `took ${Date.now() - t} ms`);
	assert.equal(eta('--points', `2026-09-06=1${' ;'.repeat(100)}x`, '--limit', '5').code, 1);
});
