# Changelog

All notable changes are listed here, in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Versions follow [semver](https://semver.org); 0.x until the formats settle. The section of a version is also its GitHub release notes.

## [Unreleased]

### Added

- `compare` mode (`/manifestack compare neon supabase`): two or three vendors for the same job, side by side for your workload: requirements, cost at your size, the first limit, the features you use and what it takes to leave. When one is in use, it also sizes the switch.
- Audit findings get a severity (`Critical`, `High`, `Medium`, `Low`); the report opens with a verdict and a "Do today" list of quick fixes.
- `priority` in STACK.md (`lowest cost`, `balanced`, `least ops`, `control`), followed by every mode and the guard.
- Questions with options and stated defaults, remembered in STACK.md. Init also asks about traffic, paid seats, environments, where users are, an uptime promise, payment revenue and the AI model class.
- `references/vendor-pages.md`: pages are checked before the questions, with a pasted table or screenshot as the fallback; pricing and limit pages come first and security pages only when requirements need them.
- `references/cost-model.md`: seats and environments in `fixed`, a plan's included usage `credit`, annual plans and currencies; the budget sentence names any vendor left out of the total.
- Detection: Python and Go imports, React Native Firebase and Auth0, Genkit and LlamaIndex for Gemini, `@prisma/adapter-neon`, `go-openai`; Auth.js, Better Auth and OpenRouter as unmapped SDKs; `samples` lists vendors seen only in fixtures, tests or examples.

### Changed

- Init answers your own idea first, then lists what you do not need and what to decide now.
- The references' examples use a made-up vendor, so no real price can stand in for a page that did not load. The guard writes no `limit` or read date for a page it never opened. The nine-field details table is shown only on request.
- STACK.md writes go through a JSON file in `.manifestack/tmp/`, which also works in PowerShell.
- The Claude Code hook command uses `${CLAUDE_PROJECT_DIR}`, which works on Windows without Git Bash. `detect.mjs` reports older entries as `outdated`; `npx manifestack hook` updates them.
- `uninstall` without a terminal needs `--yes` or `--agent`.
- Vendor maps check more traps (Supabase Auth emails, Neon Free limits, Cloud Functions on Firebase Blaze, Clerk retained users and SSO, Vercel Flat Rate CDN and Spend Management) and link working security pages.

### Fixed

- Projections: a percentage growth compounds when converted between periods; `eta` checks the units of `--rate`, `--points` and `--growth`; `usage` reads more forms, and `lint` warns about what it cannot read.
- Secrets: AWS secret keys, `redis://:password@host` and `key: value` forms are caught; commit hashes or UUIDs in URLs and Stripe ids are not flagged. `set` writes atomically and never echoes a rejected value.
- Hook: no false alarms when git is missing, for upgrades of packages already there, or from quoted text and heredocs; each vendor once per session; only one of the plugin and project hooks reports.
- Detection: environment variables of other tools (`CF_`, `PADDLE_`), `@vercel/kv` and `@vercel/postgres` (Upstash and Neon), a role signal alone, the file limit dropping manifests, multi-line values in `.env`.
- STACK.md: code fences, headings such as `## Other: C#`, `date > X`, and parsing time on very long lines.

## [0.3.0] - 2026-10-08

- Breaking: Node.js 22 or newer is required (18 and 20 are past end of life).
- Hook: also runs after package-manager installs (`npm install`, `pip install`, `go get` and similar). In Cursor it is now a `postToolUse` hook, because Cursor ignored the output of the old `afterFileEdit` one. Run `npx manifestack hook` to update; `detect.mjs` reports old setups as `outdated`.
- Hook: no false alarms after removing a dependency, when git is slow (Windows), when the session runs in a subfolder, or when STACK.md names the vendor differently ("Stripe Billing").
- `stack-md.mjs set --json` takes values from a file or stdin, for text copied from vendor pages. `set` no longer cuts values at `#`, and `check` reports a broken section as `error` instead of failing the whole file.
- Detection: more Python (pyproject extras, uv and PDM groups), Deno imports and `deno.json`, config files in dot-folders. Virtualenvs no longer use up the file limit, and imports in comments, React Email and `mongodb-memory-server` no longer count as vendors.
- CLI: without a terminal, `install` needs `--agent` or `--yes`; `uninstall` removes only manifestack's own folders.
- Skill `manifestack`: a pricing page it cannot read is marked `unverified`, never filled from search results or memory.
- Fixes in cost and usage math (units, `$` amounts, dates), secret detection, Windows paths and line endings.

## [0.2.0] - 2026-10-07

- CLI: `npx manifestack hook` registers only the new-vendor hook, for skills installed with `npx skills add` or by hand.
- CLI: a bare `npx manifestack` runs `install`.
- CLI: `install` keeps a manifestack skill another tool installed and says so, instead of reporting it as skipped.
- `detect.mjs` reports whether the new-vendor hook is on for Claude Code and Cursor (`hook`: `on`, `plugin` or `off`).
- Skill `manifestack`: in Claude Code and Cursor, offers to turn the hook on at the end of `init` and `audit` when it is off.
- Everything Manifestack writes lives in `.manifestack/`, never in the repository root: `.manifestack/STACK.md` (the scripts' default path, and where the hook and `manifestack-guard` look) and working files such as cost models in `.manifestack/tmp/`, which `project.mjs cost` keeps out of git.
- STACK.md `## Requirements`: `prefer` lists what the team knows or wants to use, `avoid` lists vendors, technologies or setups the team rules out. `init` asks for both; picks skip what is in `avoid`, and `manifestack-guard` and the hook check new services against it.
- New role `AI` for STACK.md sections and vendor maps; Gemini, Mistral, Groq, Cohere, Replicate and Together AI SDKs are detected without a map.
- Railway, Render and Fly.io are detected from their config files and env names, without an SDK.
- `fit.md`: rules for picking payments (merchant of record first), monitoring and AI APIs.
- Python and Go: dependencies are read from `requirements*.txt`, `pyproject.toml` (PEP 621, dependency groups, Poetry), `Pipfile` and `go.mod`, vendor maps list `pypi` and `go` packages, and the new-vendor hook reacts to edits of those files. Django, FastAPI, Flask, Gin, Echo, Fiber and Chi count as frameworks.
- Vendor maps: Adapty, Cloudinary, Convex, Datadog, DigitalOcean, Expo EAS, Google Gemini, Heroku, Lemon Squeezy, MongoDB Atlas, PlanetScale, Polar, RevenueCat, UploadThing, Upstash, WorkOS, Anthropic, Auth0, Cloudflare, Firebase, Fly.io, Netlify, OpenAI, Paddle, PostHog, Postmark, Railway, Render, SendGrid, Sentry, Stripe.

## [0.1.0] - 2026-10-07

- Skill `manifestack` with `init` and `audit` modes.
- Skill `manifestack-guard`: checks a new or changed vendor against STACK.md.
- STACK.md format with `revisit_when`, and a template.
- Scripts: vendor detection, limit ETA and cost projection, STACK.md parse/check/lint/set.
- npm CLI `manifestack` with `install` and `uninstall` for Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, OpenCode, Cline and Gemini CLI.
- Claude Code plugin and marketplace.
- "New vendor" hook for Claude Code and Cursor.
- Vendor maps: Vercel, Supabase, Neon, Clerk, Resend.

[Unreleased]: https://github.com/manifestack/manifestack/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/manifestack/manifestack/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/manifestack/manifestack/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/manifestack/manifestack/releases/tag/v0.1.0
