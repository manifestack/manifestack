# Manifestack

Choose the stack that fits your project. Know when it stops fitting.

Manifestack is a free, MIT-licensed [Agent Skill](https://agentskills.io) for Claude Code, Cursor, Codex and other coding agents. It proposes a stack for your budget, users, requirements and team, then keeps checking it: plan limits, bills, launch-day risks, requirement gaps, overlapping services and overbuilt infrastructure. Decisions live in a `STACK.md` file in your repo.

- **No API keys, no account.** It reads your repo and env var *names*, never their values, and asks you for usage numbers.
- **Runs locally.** There is no Manifestack server. The only network use is reading vendors' public pricing pages.
- **Current prices.** Every finding cites the vendor page and the date it was read. If a page can't be read, the finding says `unverified`.
- **Neutral.** No rankings, no affiliate links, no "switch to X". Fixes are settings, planned upgrades, or a deliberate switch when the fit is wrong.

Site: [manifestack.com](https://manifestack.com)

## Install

| Agent | Command | Then |
| --- | --- | --- |
| Claude Code | `npx manifestack install --agent claude-code` | `/manifestack` |
| Cursor | `npx manifestack install --agent cursor` | ask the agent to run `manifestack` |
| Codex | `npx manifestack install --agent codex` | `$manifestack` |
| Other agents | `npx manifestack install` | detects Copilot, Windsurf, OpenCode, Cline, Gemini CLI and asks |

`npx manifestack install` copies both skills into the agent's project skills folder. For Claude Code and Cursor it also registers the "new vendor" hook. `npx manifestack uninstall` removes them and leaves `STACK.md` alone. Run `npx manifestack --help` for options (`--skill`, `--dir`, `--dry-run`, `--yes`).

### Claude Code plugin

```
/plugin marketplace add manifestack/manifestack
/plugin install manifestack@manifestack
```

The plugin brings both skills and the hook. Skills from a plugin are namespaced: run `/manifestack:manifestack`.

### skills CLI (skills.sh)

```bash
npx skills add manifestack/manifestack
npx skills add manifestack/manifestack --skill manifestack -a claude-code
npx skills add manifestack/manifestack --list
```

The `skills` CLI installs the skills only, without the hook. In Claude Code and Cursor, use `npx manifestack install` if you want the hook. Without a hook, `manifestack-guard` runs only when the agent picks it up on its own, which doesn't always happen for routine coding tasks, so run `/manifestack audit` before you merge a change that adds or swaps a service.

### Manual

```bash
git clone https://github.com/manifestack/manifestack
cp -r manifestack/skills/manifestack .agents/skills/      # Claude Code: .claude/skills/
```

## Use

| Command | What it does |
| --- | --- |
| `/manifestack` | Picks `init` for an empty repo and `audit` otherwise |
| `/manifestack init "B2B dashboard, EU users"` | Asks about budget, users, requirements and team, proposes a whole stack priced at 1k, 10k and 100k users, writes `STACK.md` |
| `/manifestack audit` | Scans the repo, reads current pricing, projects growth, and reports findings with a when, a cost and a fix |

Planned: `compare`, `migrate`, `watch`.

Every audit finding has a kind (`Limit`, `Bill`, `Risk`, `Requirement`, `Overlap`, `Overbuilt`), evidence, when, cost, fix and source:

| Finding | When | Cost | Fix |
| --- | --- | --- | --- |
| **Limit** Supabase Free: database size. 312 / 500 MB, +1.1 MB/day | ETA ~Mar 2027 | $25/mo on Pro | Archive `events` rows older than 90 days, or schedule the upgrade for February |
| **Bill** Vercel Pro: data transfer. 3.4 TB last month, 1 TB included | Every month, growing | ~$360/mo overage | Cache `/og/*` at the edge, set `Cache-Control` on `/api/feed` |

(Sample output; numbers come from your inputs and today's vendor pages.)

### Where usage numbers come from

1. You: the skill asks 4–6 questions at most and says where each number is in the vendor dashboard.
2. Exports (CSV/JSON) you put in the repo.
3. A vendor's official MCP server connected in **read-only** mode (Supabase with `read_only=true`, Neon with `readonly=true`). Vercel and Resend MCP servers are not used: they have write tools and no read-only mode.

### STACK.md

```markdown
## Requirements
budget: ~$600/mo
users: 9k now, 50k by Q3
requires: EU database, SOC 2 vendors
team_knows: Postgres, Next.js

## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
usage: 312 MB, +1.1 MB/day (2026-10-06)
decided: stay on Free until first paying user
revisit_when: db_size > 400 MB OR date >= 2027-02-01
next: Pro, $25/mo
env: SUPABASE_URL, SUPABASE_ANON_KEY  # names only
```

Format and `revisit_when` grammar: [skills/manifestack/references/stack-md.md](skills/manifestack/references/stack-md.md).

## Vendors with a page map

Vercel, Supabase, Neon, Clerk, Resend. A map says which pages to read, what to extract and where usage lives in the dashboard; it never stores prices. For any other vendor the skill finds the public pricing page itself. New maps ship as releases; to request one, open an issue with the pricing page.

## What is in this repository

| Path | What |
| --- | --- |
| `skills/manifestack/` | Main skill: `init` and `audit` |
| `skills/manifestack-guard/` | Small skill the agent calls on its own before adding or changing a vendor |
| `catalog/vendors/` | Vendor maps (source of truth) |
| `catalog/shared/` | Rules shared by all skills (source of truth) |
| `packages/core/` | Detection, projections, STACK.md logic (source of truth for the scripts) |
| `packages/cli/` | The `manifestack` npm package |
| `hooks/` | Claude Code plugin hook and the generated hook script |
| `tools/sync.mjs` | Copies `catalog/` and `packages/core/` into `skills/` and `hooks/` |
| `.claude-plugin/` | Plugin manifest and marketplace |

Files in `skills/*/vendors/`, `skills/*/scripts/`, `skills/*/references/security.md` and `hooks/new-vendor.mjs` are generated. Edit the sources and run `node tools/sync.mjs`.

## Development

Node.js 18+. No dependencies.

```bash
node tools/sync.mjs          # regenerate copies after editing catalog/ or packages/core/
npm test                     # unit, CLI, hook and format tests
node tools/sync.mjs --check  # what CI runs to catch stale copies
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a vendor map or a skill, and [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

[MIT](LICENSE)
