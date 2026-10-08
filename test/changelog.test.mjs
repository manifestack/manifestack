import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, runNode } from './helpers.mjs';
import { changelogSection } from '../tools/changelog-notes.mjs';

const CHANGELOG = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');

test('release notes come from the version section of CHANGELOG.md', () => {
	const text = '# Changelog\n\n## [Unreleased]\n\n- next\n\n## [1.2.0] - 2026-01-02\n\n### Fixed\n\n- a bug\n\n## [1.1.0] - 2026-01-01\n\n- older\n\n[1.2.0]: https://x/compare\n';
	assert.equal(changelogSection(text, '1.2.0'), '### Fixed\n\n- a bug');
	assert.equal(changelogSection(text, '1.1.0'), '- older');
	assert.equal(changelogSection(text, '9.9.9'), null);
	assert.equal(changelogSection('## [1.0.0]\n\n## [0.9.0]\n- x\n', '1.0.0'), null, 'an empty section is no notes');
});

test('CHANGELOG.md follows Keep a Changelog and has a section for the current version', () => {
	const version = JSON.parse(readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8')).version;
	assert.match(CHANGELOG, /^## \[Unreleased\]$/m);
	assert.ok(changelogSection(CHANGELOG, version), `no notes for ${version}`);
	const lines = CHANGELOG.split(/\r?\n/);
	for (const [, v] of CHANGELOG.matchAll(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/gm)) assert.ok(lines.some((l) => l.startsWith(`[${v}]: https://`)), `link for ${v}`);
	const r = runNode(join(ROOT, 'tools/changelog-notes.mjs'), ['0.0.1'], { cwd: ROOT });
	assert.equal(r.code, 1);
	assert.match(r.stderr, /no "## \[0\.0\.1\]" section/);
});
