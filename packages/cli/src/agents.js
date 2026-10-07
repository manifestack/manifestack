// Agents, where they read project skills, and how the "new vendor" hook is registered.
// Check every path against the agents' current docs before a release (CONTRIBUTING.md, "Before a release").

export const HOOK_SCRIPT = 'manifestack-new-vendor.mjs';

export const AGENTS = [
	{
		id: 'claude-code',
		name: 'Claude Code',
		skillsDir: '.claude/skills',
		markers: ['.claude', 'CLAUDE.md'],
		hook: 'claude-code',
		next: 'Run `/manifestack` in your project.',
	},
	{
		id: 'cursor',
		name: 'Cursor',
		skillsDir: '.agents/skills',
		markers: ['.cursor', '.cursorrules'],
		hook: 'cursor',
		next: 'Ask the agent to run `manifestack` in your project.',
	},
	{
		id: 'codex',
		name: 'Codex',
		skillsDir: '.agents/skills',
		markers: ['.codex', 'AGENTS.md'],
		next: 'Run `$manifestack` in your project.',
	},
	{
		id: 'github-copilot',
		name: 'GitHub Copilot',
		skillsDir: '.github/skills',
		markers: ['.github/copilot-instructions.md', '.github/instructions', '.github/skills'],
		next: 'Ask Copilot to use the manifestack skill.',
	},
	{
		id: 'windsurf',
		name: 'Windsurf',
		skillsDir: '.windsurf/skills',
		markers: ['.windsurf', '.windsurfrules'],
		next: 'Ask Cascade to use the manifestack skill.',
	},
	{
		id: 'opencode',
		name: 'OpenCode',
		skillsDir: '.opencode/skills',
		markers: ['.opencode', 'opencode.json'],
		next: 'Ask OpenCode to use the manifestack skill.',
	},
	{
		id: 'cline',
		name: 'Cline',
		skillsDir: '.cline/skills',
		markers: ['.cline', '.clinerules'],
		next: 'Ask Cline to use the manifestack skill.',
	},
	{
		id: 'gemini-cli',
		name: 'Gemini CLI',
		skillsDir: '.gemini/skills',
		markers: ['.gemini', 'GEMINI.md'],
		next: 'Ask Gemini to use the manifestack skill.',
	},
];

export function findAgent(id) {
	return AGENTS.find((a) => a.id === id);
}

const isOurs = (command) => typeof command === 'string' && command.includes(HOOK_SCRIPT);

// Each hook adapter knows where its script and config live and how to merge or remove our entry
// without touching anything else in the config.
export const HOOKS = {
	'claude-code': {
		script: `.claude/hooks/${HOOK_SCRIPT}`,
		config: '.claude/settings.json',
		describe: 'PostToolUse hook (Write|Edit) in .claude/settings.json',
		add(config) {
			const command = `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${HOOK_SCRIPT}"`;
			config.hooks ??= {};
			config.hooks.PostToolUse ??= [];
			if (!Array.isArray(config.hooks.PostToolUse)) throw new Error('hooks.PostToolUse in .claude/settings.json is not a list');
			const present = config.hooks.PostToolUse.some((g) => (g?.hooks ?? []).some((h) => isOurs(h?.command)));
			if (present) return false;
			config.hooks.PostToolUse.push({ matcher: 'Write|Edit', hooks: [{ type: 'command', command, timeout: 10 }] });
			return true;
		},
		remove(config) {
			const groups = config.hooks?.PostToolUse;
			if (!Array.isArray(groups)) return false;
			let changed = false;
			const kept = [];
			for (const g of groups) {
				const hooks = (g?.hooks ?? []).filter((h) => !isOurs(h?.command));
				if (hooks.length !== (g?.hooks ?? []).length) changed = true;
				if (hooks.length) kept.push({ ...g, hooks });
				else if (!(g?.hooks ?? []).length) kept.push(g);
			}
			if (!changed) return false;
			if (kept.length) config.hooks.PostToolUse = kept;
			else delete config.hooks.PostToolUse;
			if (!Object.keys(config.hooks).length) delete config.hooks;
			return true;
		},
	},
	cursor: {
		// Cursor project hooks: .cursor/hooks.json, commands run from the project root.
		// Verify the event name and output format before a release (CONTRIBUTING.md, "Before a release").
		script: `.cursor/hooks/${HOOK_SCRIPT}`,
		config: '.cursor/hooks.json',
		describe: 'afterFileEdit hook in .cursor/hooks.json',
		add(config) {
			const command = `node .cursor/hooks/${HOOK_SCRIPT}`;
			config.version ??= 1;
			config.hooks ??= {};
			config.hooks.afterFileEdit ??= [];
			if (!Array.isArray(config.hooks.afterFileEdit)) throw new Error('hooks.afterFileEdit in .cursor/hooks.json is not a list');
			if (config.hooks.afterFileEdit.some((h) => isOurs(h?.command))) return false;
			config.hooks.afterFileEdit.push({ command });
			return true;
		},
		remove(config) {
			const list = config.hooks?.afterFileEdit;
			if (!Array.isArray(list)) return false;
			const kept = list.filter((h) => !isOurs(h?.command));
			if (kept.length === list.length) return false;
			if (kept.length) config.hooks.afterFileEdit = kept;
			else delete config.hooks.afterFileEdit;
			if (!Object.keys(config.hooks).length) delete config.hooks;
			if (Object.keys(config).length === 1 && config.version === 1) delete config.version;
			return true;
		},
	},
};
