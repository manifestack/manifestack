import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { measureTokens, modeFiles, overBudget, approxTokens } from '../tools/bench.mjs';

const BUDGETS = JSON.parse(readFileSync(join(ROOT, 'bench/budgets.json'), 'utf8'));

// Speed is measured in CI (the Benchmarks job); tokens are the same on every machine, so they are checked here.
test('the text each mode reads, the vendor maps and the hook message stay within bench/budgets.json', async () => {
	const tokens = await measureTokens(ROOT);
	for (const key of Object.keys(BUDGETS.tokens)) assert.ok(key in tokens, `${key} is measured`);
	const over = overBudget({ tokens }, { tokens: BUDGETS.tokens });
	assert.deepEqual(over, [], over.map((o) => `${o.key}: ${o.value} tokens > budget ${o.max}. Make it shorter, or raise the budget on purpose.`).join('\n'));
});

test('every mode in SKILL.md is measured, with the files it lists', () => {
	const modes = modeFiles(join(ROOT, 'skills/manifestack'));
	assert.deepEqual(Object.keys(modes).sort(), ['audit', 'compare', 'init']);
	for (const files of Object.values(modes)) assert.ok(files.includes('SKILL.md') && files.some((f) => f.startsWith('references/workflow-')));
	assert.equal(approxTokens('abcdefgh'), 2);
});
