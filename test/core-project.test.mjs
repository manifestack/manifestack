import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ROOT, runNode } from './helpers.mjs';
import { parseQuantity, overage, eta, linearRate, costAt, approxMonth } from '../packages/core/src/project.mjs';

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
