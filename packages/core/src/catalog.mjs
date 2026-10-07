// Reads vendor maps (catalog/vendors/<id>.md in the repo, vendors/<id>.md inside a skill).
// A map says where to look and what to extract, never the prices themselves.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './yaml.mjs';

export const VENDOR_SCHEMA = 1;
export const VENDOR_ROLES = ['hosting', 'database', 'auth', 'email', 'storage', 'payments', 'monitoring', 'other'];

/** Upgrades older map formats to the current schema. Add a case when VENDOR_SCHEMA goes up. */
function upgradeVendorMap(data) {
	switch (data.schema) {
		case VENDOR_SCHEMA:
			return data;
		default:
			throw new Error(`unsupported vendor map schema ${data.schema} (this version reads schema ${VENDOR_SCHEMA})`);
	}
}

export function parseVendorMap(text, file = '<vendor map>') {
	let parsed;
	try {
		parsed = parseFrontmatter(text);
	} catch (e) {
		throw new Error(`${file}: ${e.message}`);
	}
	const data = upgradeVendorMap(parsed.data);
	const detect = data.detect ?? {};
	return {
		...data,
		roles: data.roles ?? [],
		detect: {
			packages: detect.packages ?? [],
			imports: detect.imports ?? [],
			env_prefixes: detect.env_prefixes ?? [],
			config_files: detect.config_files ?? [],
			role_signals: detect.role_signals ?? {},
		},
		pages: data.pages ?? {},
		read: data.read ?? [],
		usage_questions: data.usage_questions ?? [],
		common_fixes: data.common_fixes ?? [],
		notes: parsed.body.trim(),
	};
}

export function validateVendorMap(v) {
	const errors = [];
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v.id ?? ''))) errors.push('id must be lowercase a-z, 0-9 and single hyphens');
	if (!v.name) errors.push('name is required');
	if (!Array.isArray(v.roles) || !v.roles.length) errors.push('roles must be a non-empty list');
	for (const r of v.roles ?? []) if (!VENDOR_ROLES.includes(r)) errors.push(`unknown role "${r}"`);
	const d = v.detect ?? {};
	if (![d.packages, d.imports, d.env_prefixes, d.config_files].some((x) => x?.length)) errors.push('detect needs at least one signature');
	for (const role of Object.keys(d.role_signals ?? {})) if (!(v.roles ?? []).includes(role)) errors.push(`role_signals.${role} is not in roles`);
	if (!/^https:\/\//.test(String(v.pages?.pricing ?? ''))) errors.push('pages.pricing must be an https URL');
	for (const [k, url] of Object.entries(v.pages ?? {})) if (!/^https:\/\//.test(String(url))) errors.push(`pages.${k} must be an https URL`);
	if (!v.read?.length) errors.push('read must list what to extract from the pages');
	for (const q of v.usage_questions ?? []) if (!q.metric || !q.ask || !q.where) errors.push('each usage question needs metric, ask and where');
	if (v.mcp?.official && v.mcp.readonly_flag && !v.mcp.allowed_tools?.length) errors.push('mcp.allowed_tools is required when read-only MCP use is allowed');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.verified ?? ''))) errors.push('verified must be a YYYY-MM-DD date');
	return errors;
}

/** Loads every map in a directory. Files starting with `_` (the template) are skipped. */
export function loadCatalog(dir) {
	if (!existsSync(dir)) return [];
	const vendors = [];
	for (const name of readdirSync(dir).sort()) {
		if (!name.endsWith('.md') || name.startsWith('_')) continue;
		const v = parseVendorMap(readFileSync(join(dir, name), 'utf8'), name);
		const errors = validateVendorMap(v);
		if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
		if (`${v.id}.md` !== name) throw new Error(`${name}: id "${v.id}" must match the file name`);
		vendors.push(v);
	}
	return vendors;
}

/** The part of a map that detection needs; embedded into the hook so it runs without the catalog. */
export function vendorSignatures(vendors) {
	return vendors.map((v) => ({ id: v.id, name: v.name, roles: v.roles, ...v.detect }));
}
