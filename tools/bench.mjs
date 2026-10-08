#!/usr/bin/env node
// What a run costs: the text an agent has to read in each mode (approximate tokens) and how fast the scripts and
// the hook are. Budgets live in bench/budgets.json.
//
//   node tools/bench.mjs [tokens|speed|all] [--check] [--json | --markdown] [--root <dir>] [--compare <base.json>]
//
//   --check     exit 1 when a number is over its budget
//   --root      measure another checkout (CI measures the base branch of a pull request this way)
//   --compare   add the base numbers from an earlier --json run and the change in %
//
// Tokens are characters / 4: close enough to see growth, and the same on every machine. Speed is the median of
// several runs (p95 for the hook, which runs after every agent edit); CI machines vary, so the budgets leave room.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

export const approxTokens = (text) => Math.ceil(String(text).length / 4);

const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)];
const round1 = (n) => Math.round(n * 10) / 10;

function time(fn, runs) {
	fn(); // warm the module and file caches
	const out = [];
	for (let i = 0; i < runs; i++) {
		const t = process.hrtime.bigint();
		fn();
		out.push(Number(process.hrtime.bigint() - t) / 1e6);
	}
	return out;
}

function tempDir(name) {
	return realpathSync(mkdtempSync(join(tmpdir(), `manifestack-bench-${name}-`)));
}

function write(file, text) {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, text);
}

const core = (root, name) => import(pathToFileURL(join(root, 'packages/core/src', name)).href);

// ---------------------------------------------------------------- tokens

/** Files each mode reads before it starts: SKILL.md, the shared rules and the references in its row of the table. */
export function modeFiles(skillDir) {
	const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
	const modes = {};
	for (const m of skill.matchAll(/^\| (\w+) \| (.*\]\(references\/.*)\|$/gm)) {
		modes[m[1]] = ['SKILL.md', 'references/security.md', ...[...m[2].matchAll(/\]\((references\/[^)]+)\)/g)].map((x) => x[1])];
	}
	return modes;
}

export async function measureTokens(root = REPO) {
	const skill = join(root, 'skills/manifestack');
	const read = (f) => readFileSync(join(skill, f), 'utf8');
	const out = {};
	for (const [mode, files] of Object.entries(modeFiles(skill))) out[`mode:${mode}`] = files.reduce((n, f) => n + approxTokens(read(f)), 0);
	out['mode:guard'] = approxTokens(readFileSync(join(root, 'skills/manifestack-guard/SKILL.md'), 'utf8'));
	const maps = readdirSync(join(skill, 'vendors')).filter((f) => f.endsWith('.md')).map((f) => approxTokens(read(`vendors/${f}`)));
	out['vendor-map:avg'] = Math.round(maps.reduce((a, b) => a + b, 0) / maps.length);
	out['vendor-map:max'] = Math.max(...maps);

	// The hook's message goes into the agent's context after a dependency is added.
	const { readHookEvent, newVendorMessage, formatHookOutput } = await core(root, 'hook.mjs');
	const { loadCatalog, vendorSignatures } = await core(root, 'catalog.mjs');
	const signatures = vendorSignatures(loadCatalog(join(root, 'catalog/vendors')));
	const dir = tempDir('hook-text');
	try {
		const event = () => readHookEvent({ cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm i resend twilio' } });
		const message = () => formatHookOutput('claude-code', newVendorMessage(event(), { signatures }) ?? '');
		out['hook:without-stack'] = approxTokens(message());
		write(join(dir, '.manifestack/STACK.md'), '## Requirements\nbudget: $50\n');
		out['hook:with-stack'] = approxTokens(message());
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
	return out;
}

// ---------------------------------------------------------------- speed

/** A monorepo of about `files` source files, plus folders the scan must skip (node_modules, a virtualenv). */
function syntheticRepo(files) {
	const dir = tempDir('repo');
	write(join(dir, 'package.json'), JSON.stringify({ name: 'big', private: true, workspaces: ['apps/*'] }));
	write(join(dir, 'apps/web/package.json'), JSON.stringify({ dependencies: { next: '15', '@supabase/supabase-js': '2', stripe: '14', resend: '6', '@sentry/nextjs': '8' } }));
	write(join(dir, 'apps/api/requirements.txt'), 'fastapi==0.115\nopenai>=1\nsentry-sdk\n');
	write(join(dir, 'apps/worker/go.mod'), 'module worker\n\ngo 1.22\n\nrequire github.com/stripe/stripe-go/v76 v76.0.0\n');
	write(join(dir, '.env.example'), 'NEXT_PUBLIC_SUPABASE_URL=\nSTRIPE_SECRET_KEY=\nRESEND_API_KEY=\n');
	const body = Array.from({ length: 40 }, (_, i) => `export const v${i} = (a: number) => a * ${i};`).join('\n');
	for (let i = 0; i < files; i++) {
		const py = i % 10 === 0;
		const file = py ? `apps/api/app/m${i % 50}/f${i}.py` : `apps/web/src/m${i % 200}/f${i}.ts`;
		write(join(dir, file), py ? `import os\nimport stripe\nfrom openai import OpenAI\n\n# ${i}\n` : `import { createClient } from '@supabase/supabase-js';\nimport React from 'react';\n${body}\n`);
	}
	for (let i = 0; i < 2000; i++) write(join(dir, `node_modules/pkg${i % 100}/f${i}.js`), 'module.exports = 1;\n');
	write(join(dir, 'apps/api/.venv/pyvenv.cfg'), 'home = /usr/bin\n');
	for (let i = 0; i < 1000; i++) write(join(dir, `apps/api/.venv/lib/site-packages/p${i % 50}/f${i}.py`), 'x = 1\n');
	return dir;
}

function bigStackMd(sections) {
	let text = '## Requirements\nbudget: ~$600/mo  # user 2026-10-08\nusers: 9k now, 50k by Q3\nrequires: EU database\npriority: balanced\n';
	for (let i = 0; i < sections; i++) {
		text += `\n## Other: Service ${i}\nplan: Team\nlimit: 500 MB database, read-only above it\nsource: acme.example/pricing  # read 2026-10-06\nusage: db_size ${100 + i} MB, +1.1 MB/day (2026-10-06)\nrevisit_when: db_size > 400 MB OR date >= 2027-02-01\nnext: Team, $49/mo\nenv: SERVICE_${i}_URL  # names only\n`;
	}
	return text;
}

function costModel(vendors) {
	return {
		users: [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1e6],
		vendors: Array.from({ length: vendors }, (_, v) => ({
			id: `v${v}`,
			per_user: { db_mb: 2, transfer_gb: 0.5, emails: 10, requests: 300 },
			fixed: { seats: 3 },
			plans: [0, 1, 2, 3].map((p) => ({
				name: `P${p}`,
				base: p * 25,
				credit: p * 5,
				metrics: Object.fromEntries(['db_mb', 'transfer_gb', 'emails', 'requests', 'seats'].map((m) => [m, { included: 1000 * 10 ** p, price: 0.1 / (p + 1), per: 100, hard: p === 0 }])),
			})),
		})),
	};
}

function hookRuns(root, input, runs) {
	const hook = join(root, 'hooks/new-vendor.mjs');
	return time(() => spawnSync(process.execPath, [hook], { input: JSON.stringify(input), encoding: 'utf8' }), runs);
}

export async function measureSpeed(root = REPO, { files = 20000 } = {}) {
	const { detectVendors } = await core(root, 'detect.mjs');
	const { loadCatalog, vendorSignatures } = await core(root, 'catalog.mjs');
	const { parseStackMd, checkStack, lintStackMd, setFields } = await core(root, 'stack-md.mjs');
	const { costAt } = await core(root, 'project.mjs');
	const signatures = vendorSignatures(loadCatalog(join(root, 'catalog/vendors')));
	const out = {};

	out['detect:fixture'] = median(time(() => detectVendors(join(root, 'test/fixtures/next-vercel-supabase-resend'), { signatures }), 10));
	const repo = syntheticRepo(files);
	try {
		out[`detect:${files / 1000}k-files`] = median(time(() => detectVendors(repo, { signatures, maxFiles: files }), 3));
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}

	const stack = bigStackMd(300);
	out['stack-md:parse-300'] = median(time(() => parseStackMd(stack), 20));
	out['stack-md:check-300'] = median(time(() => checkStack(stack, { today: '2026-10-08' }), 10));
	out['stack-md:lint-300'] = median(time(() => lintStackMd(stack), 10));
	out['stack-md:set-300'] = median(time(() => setFields(stack, 'Other: Service 150', { plan: 'Scale' }), 20));
	out['project:cost-20-vendors'] = median(time(() => costAt(costModel(20)), 20));

	// The hook starts a Node process after every Write, Edit and Bash call; p95 is what the user feels.
	const dir = tempDir('hook');
	try {
		write(join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies: { stripe: '14' } }, null, 2));
		write(join(dir, 'styles.css'), 'a{}');
		const git = (...a) => execFileSync('git', ['-c', 'user.email=b@example.test', '-c', 'user.name=b', ...a], { cwd: dir, stdio: 'ignore' });
		let hasGit = true;
		try {
			git('init', '-q');
			git('add', '.');
			git('commit', '-qm', 'init');
		} catch {
			hasGit = false;
		}
		const cases = {
			'hook:edit-css': { cwd: dir, tool_name: 'Edit', tool_input: { file_path: join(dir, 'styles.css'), old_string: 'a', new_string: 'b' } },
			'hook:bash-ls': { cwd: dir, tool_name: 'Bash', tool_input: { command: 'ls -la' } },
			'hook:npm-install': { cwd: dir, tool_name: 'Bash', tool_input: { command: 'npm install resend' } },
		};
		if (hasGit) cases['hook:write-manifest'] = { cwd: dir, tool_name: 'Write', tool_input: { file_path: join(dir, 'package.json'), content: '' } };
		for (const [name, input] of Object.entries(cases)) {
			const runs = hookRuns(root, input, 15);
			out[`${name}:median`] = median(runs);
			out[`${name}:p95`] = p95(runs);
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
	return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, round1(v)]));
}

// ---------------------------------------------------------------- report

export function overBudget(results, budgets) {
	const over = [];
	for (const group of ['tokens', 'speed']) {
		for (const [key, max] of Object.entries(budgets[group] ?? {})) {
			const value = results[group]?.[key];
			if (value != null && value > max) over.push({ group, key, value, max });
		}
	}
	return over;
}

function table(results, budgets, base, markdown) {
	const lines = [];
	for (const group of ['tokens', 'speed']) {
		if (!results[group]) continue;
		const unit = group === 'tokens' ? 'tokens' : 'ms';
		const head = ['Metric', `Value (${unit})`, 'Budget', ...(base ? ['Base', 'Change'] : [])];
		lines.push(markdown ? `\n### ${group === 'tokens' ? 'Text the agent reads' : 'Script and hook speed'}\n` : `\n${group}`);
		if (markdown) lines.push(`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`);
		for (const [key, value] of Object.entries(results[group])) {
			const max = budgets[group]?.[key];
			const was = base?.[group]?.[key];
			// Below a millisecond or two, timer noise is larger than any change: show none.
			const pct = was ? Math.round(((value - was) / was) * 100) : null;
			const change = pct == null ? '' : group === 'speed' && Math.abs(value - was) < 2 ? '~' : `${pct > 0 ? '+' : ''}${pct}%`;
			const flag = max != null && value > max ? ' (over)' : '';
			const cells = [key, `${value}${flag}`, max ?? '', ...(base ? [was ?? '', change] : [])];
			lines.push(markdown ? `| ${cells.join(' | ')} |` : `  ${key.padEnd(28)} ${String(value + flag).padStart(10)}  ${String(max ?? '').padStart(8)}${base ? `  ${String(was ?? '').padStart(8)}  ${change}` : ''}`);
		}
	}
	return lines.join('\n') + '\n';
}

async function main(argv) {
	const what = ['tokens', 'speed', 'all'].includes(argv[0]) ? argv.shift() : 'all';
	const flag = (name) => argv.includes(name);
	const value = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
	const root = resolve(value('--root') ?? REPO);
	const results = {};
	if (what !== 'speed') results.tokens = await measureTokens(root);
	if (what !== 'tokens') results.speed = await measureSpeed(root);
	if (flag('--json')) return process.stdout.write(JSON.stringify(results, null, 2) + '\n');
	const budgets = JSON.parse(readFileSync(join(REPO, 'bench/budgets.json'), 'utf8'));
	const compare = value('--compare');
	const base = compare && existsSync(compare) ? JSON.parse(readFileSync(compare, 'utf8')) : null;
	process.stdout.write(table(results, budgets, base, flag('--markdown')));
	const over = overBudget(results, budgets);
	if (flag('--check') && over.length) {
		const text = over.map((o) => `${o.key}: ${o.value} > ${o.max}`).join('; ');
		process.stdout.write(`\nOver budget: ${text}. Make it smaller or faster, or raise the budget in bench/budgets.json on purpose.\n`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
	main(process.argv.slice(2)).catch((e) => {
		console.error(e.stack ?? e.message);
		process.exit(1);
	});
}
