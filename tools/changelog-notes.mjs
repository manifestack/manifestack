#!/usr/bin/env node
// Prints the CHANGELOG.md section of one version, for the GitHub release notes (release.yml).
// Fails when the section is missing or empty, so a release cannot go out without its notes.
// Usage: node tools/changelog-notes.mjs 0.4.0 [CHANGELOG.md]
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function changelogSection(text, version) {
	const lines = text.split(/\r?\n/);
	const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
	if (start === -1) return null;
	const rest = lines.slice(start + 1);
	// The section ends at the next version heading or at the link references at the bottom.
	const end = rest.findIndex((l) => l.startsWith('## ') || /^\[[^\]]+\]: /.test(l));
	const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
	return body || null;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
	const [version, file = 'CHANGELOG.md'] = process.argv.slice(2);
	if (!version) {
		console.error('usage: node tools/changelog-notes.mjs <version> [CHANGELOG.md]');
		process.exit(1);
	}
	const notes = changelogSection(readFileSync(file, 'utf8'), version);
	if (!notes) {
		console.error(`CHANGELOG.md has no "## [${version}]" section with notes; add it before releasing.`);
		process.exit(1);
	}
	process.stdout.write(notes + '\n');
}
