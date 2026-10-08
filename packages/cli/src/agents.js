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

/** A config the user wrote in a shape we do not expect: reported, never overwritten. */
export class ConfigError extends Error {}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkList(value, where) {
	if (value !== undefined && !Array.isArray(value)) throw new ConfigError(`${where} is not a list`);
	return value ?? [];
}

const CLAUDE_MATCHER = 'Write|Edit|MultiEdit|Bash';
// Cursor reads additional_context only from postToolUse; earlier versions registered afterFileEdit.
const CURSOR_EVENTS = ['postToolUse', 'afterFileEdit'];
const CURSOR_MATCHER = 'Write|Shell';

// Each hook adapter knows where its script and config live and how to merge or remove our entry
// without touching anything else in the config. `add` replaces an outdated entry of ours.
export const HOOKS = {
	'claude-code': {
		script: `.claude/hooks/${HOOK_SCRIPT}`,
		config: '.claude/settings.json',
		describe: `PostToolUse hook (${CLAUDE_MATCHER}) in .claude/settings.json`,
		groups(config) {
			if (config.hooks !== undefined && !isObject(config.hooks)) throw new ConfigError('hooks in .claude/settings.json is not an object');
			const groups = checkList(config.hooks?.PostToolUse, 'hooks.PostToolUse in .claude/settings.json');
			groups.forEach((g, i) => {
				if (!isObject(g)) throw new ConfigError(`hooks.PostToolUse[${i}] in .claude/settings.json is not an object`);
				checkList(g.hooks, `hooks.PostToolUse[${i}].hooks in .claude/settings.json`);
			});
			return groups;
		},
		add(config) {
			const groups = this.groups(config);
			const ours = groups.filter((g) => (g.hooks ?? []).some((h) => isOurs(h?.command)));
			if (ours.length === 1 && ours[0].matcher === CLAUDE_MATCHER) return false;
			this.remove(config);
			const command = `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${HOOK_SCRIPT}"`;
			config.hooks ??= {};
			config.hooks.PostToolUse ??= [];
			config.hooks.PostToolUse.push({ matcher: CLAUDE_MATCHER, hooks: [{ type: 'command', command, timeout: 10 }] });
			return true;
		},
		remove(config) {
			const groups = this.groups(config);
			let changed = false;
			const kept = [];
			for (const g of groups) {
				const hooks = (g.hooks ?? []).filter((h) => !isOurs(h?.command));
				if (hooks.length !== (g.hooks ?? []).length) changed = true;
				if (hooks.length) kept.push({ ...g, hooks });
				else if (!(g.hooks ?? []).length) kept.push(g);
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
		describe: `postToolUse hook (${CURSOR_MATCHER}) in .cursor/hooks.json`,
		lists(config) {
			if (config.hooks !== undefined && !isObject(config.hooks)) throw new ConfigError('hooks in .cursor/hooks.json is not an object');
			return Object.fromEntries(CURSOR_EVENTS.map((e) => [e, checkList(config.hooks?.[e], `hooks.${e} in .cursor/hooks.json`)]));
		},
		add(config) {
			const lists = this.lists(config);
			const current = lists.postToolUse.filter((h) => isOurs(h?.command));
			if (current.length === 1 && current[0].matcher === CURSOR_MATCHER && !lists.afterFileEdit.some((h) => isOurs(h?.command))) return false;
			this.remove(config);
			config.version ??= 1;
			config.hooks ??= {};
			config.hooks.postToolUse ??= [];
			config.hooks.postToolUse.push({ command: `node .cursor/hooks/${HOOK_SCRIPT}`, matcher: CURSOR_MATCHER, timeout: 10 });
			return true;
		},
		remove(config) {
			const lists = this.lists(config);
			let changed = false;
			for (const event of CURSOR_EVENTS) {
				const kept = lists[event].filter((h) => !isOurs(h?.command));
				if (kept.length === lists[event].length) continue;
				changed = true;
				if (kept.length) config.hooks[event] = kept;
				else delete config.hooks[event];
			}
			if (!changed) return false;
			if (!Object.keys(config.hooks).length) delete config.hooks;
			if (Object.keys(config).length === 1 && config.version === 1) delete config.version;
			return true;
		},
	},
};
