# Contributing

Thanks for helping. Two rules shape everything here:

- **Sources and copies.** Edit `catalog/` (data and shared rules) and `packages/core/` (logic). `node tools/sync.mjs` copies them into `skills/` and `hooks/`. Generated files say so on their first lines; CI fails if they are out of date. Commit the generated files too: the plugin and the `skills` CLI install straight from GitHub.
- **No backend, no keys, no dependencies.** Scripts use only the Node.js standard library and never touch the network. Skills never ask for keys and never read env values.

## Repository layout

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

Generated: `skills/*/vendors/`, `skills/*/scripts/`, `skills/*/references/security.md`, `hooks/new-vendor.mjs`.

```bash
node tools/sync.mjs          # regenerate copies after editing catalog/ or packages/core/
npm test                     # unit, CLI, hook and format tests (Node.js 22+)
node tools/sync.mjs --check  # what CI runs to catch stale copies
npm run smoke                # packs the npm package and runs it in an empty project
```

## Add a vendor map

1. Copy `catalog/vendors/_template.md` to `catalog/vendors/<id>.md`. The `id` is lowercase and matches the file name.
2. Fill in:
   - `detect`: npm package names (a trailing `/` matches a whole scope), PyPI names (`pypi`) and Go module paths (`go`) of the official SDKs, imports (a name matches itself and its subpaths; a trailing `/` or `:` makes it a prefix), env var name prefixes, config files. Verify every name on npmjs.com, pypi.org and pkg.go.dev. Add `role_signals` if the vendor has several roles and a role should count only when its code is used.
   - `pages`: official pricing, limits, regions and security/compliance pages. Open every URL.
   - `read`: what the auditor extracts from the pages: quota *names*, what happens at the limit, the next plan.
   - `usage_questions`: what to ask and the exact dashboard path. Use the standard metric names where they fit (`db_size`, `monthly_sent`, `daily_peak`, `transfer_tb`, `mau`, `users`, `monthly_bill`).
   - `mcp`: only if the vendor has an official MCP server with a real read-only mode. List only read-only tools in `allowed_tools`, and leave out anything that returns keys or connection strings.
   - `verified`: today's date.
3. **No prices or quota numbers in the map.** They are read from the page at run time. A test fails on dollar amounts.
4. If the vendor was in `packages/core/src/known-sdks.mjs` (unmapped SDKs), remove it there.
5. Add a fixture in `test/fixtures/` that uses the vendor's SDK, and a detection test in `test/core-detect.test.mjs`.
6. Run `node tools/sync.mjs && npm test`.
7. Add a line to `CHANGELOG.md` under Unreleased: `Vendor map: <Name>`.

## Change the scripts

Code lives in `packages/core/src/`. `tools/sync.mjs` bundles each script into one file, so:

- imports are one-line named imports (`import { a, b } from './x.mjs';`), without `as`;
- only `node:*` built-ins and relative `./x.mjs` imports;
- top-level names are unique across modules (the bundler fails on a clash);
- the line that runs a module as a script ends with `// @main`.

## Change or add a skill

- Write and tune skills with [`skill-creator`](https://github.com/anthropics/skills) (`npx skills add anthropics/skills --skill skill-creator`). It is a development tool: do not copy it into `skills/`.
- `SKILL.md` stays under 500 lines (guard: about 100). Details go to `references/`, one level deep, with paths relative to the skill root.
- Keep `description` under 1024 characters, saying what the skill does and when to use it.
- A new user-invoked command is a mode of `manifestack` (`references/workflow-<mode>.md`). A new skill (`skills/manifestack-<area>/`) only when it needs its own automatic trigger or a large separate domain.
- For a new skill: add its line to `SKILLS` in `tools/sync.mjs` (which data and scripts it gets), add trigger evals in `test/evals/`, and run the evals with `skill-creator` before release.
- Validate: `npm test`, `agentskills validate skills/<name>` (from `pip install skills-ref`) and `claude plugin validate . --strict`.

## Versions

One version for everything in 0.x: `packages/cli/package.json`, `packages/core/package.json`, `.claude-plugin/plugin.json` and `metadata.version` in every `SKILL.md`. A test checks they agree.

## Before a release

1. Bump the version everywhere (see Versions) and add the CHANGELOG entry.
2. `node tools/sync.mjs --check && npm test`.
3. `agentskills validate skills/manifestack` and `skills/manifestack-guard`; `claude plugin validate . --strict`.
4. Check what can drift outside this repo:
   - the invocation name of the plugin skill (`claude plugin details manifestack` after installing from the marketplace) and of the npm-installed skill (`/manifestack`, `$manifestack` in Codex);
   - project skill paths per agent in `packages/cli/src/agents.js`;
   - the Cursor hook format (`.cursor/hooks.json`, event name and output) and whether Codex has hooks yet;
   - read-only flags of the Supabase and Neon MCP servers and their tool lists in `catalog/vendors/`;
   - the vendor pages listed in each map still load, and `verified` dates are recent.
5. Run the manual scenarios in `test/evals/README.md` in Claude Code, Cursor and Codex; every finding needs a `source` with a date.
6. `npx skills add ./ --list` shows both skills.
7. Tag `vX.Y.Z` and push the tag; `release.yml` publishes to npm.
