# Changelog

All notable changes are listed here. Versions follow [semver](https://semver.org); 0.x until the formats settle. Each new vendor map gets its own line.

## Unreleased

- Vendor maps: Supabase checks the built-in Auth email service and auth rate limits; Neon what happens when Free runs out; Firebase that Cloud Functions need Blaze; Clerk how retained users and SSO connections are counted. Security pages that were blocked or rendered by JavaScript are replaced (Twilio for SendGrid, Datadog, Anthropic) or dropped where a working page exists; moved docs are updated. Every page link was checked.
- Detection: React Native Firebase and Auth0, Genkit and LlamaIndex for Gemini, `@prisma/adapter-neon`, `go-openai`; Auth.js, Better Auth and OpenRouter are reported as unmapped. `CF_` and `PADDLE_` variables of other tools (CloudFront, PaddlePaddle) no longer count, and a map that names a package beats one that claims its scope (`@vercel/kv` is Upstash, `@vercel/postgres` Neon). The OpenAI map asks which provider `OPENAI_BASE_URL` points to.
- Maps: `read` items must be plain strings (two Gemini items were parsed as YAML mappings).
- Accuracy: the references' examples use a made-up vendor, so no real price or limit sits in the agent's context to stand in for a page it could not read. The guard no longer writes a `limit` or a read date for a page it never opened.
- Vendor pages: one set of rules for every mode (`references/vendor-pages.md`). The skill checks that pages load before asking anything and offers a pasted table or screenshot when they do not; it opens the pricing and limit pages first and the security pages only when requirements need them, which cuts fetches; numbers are quoted as the page states them.
- Init asks about traffic, paid seats, environments, where users are, an uptime promise, payment revenue and the AI model class, with stated defaults. The cost model takes seats and environments in `fixed`, a plan's included usage credit (`credit`), annual plans and currencies (`references/cost-model.md`), and the budget sentence names any vendor left out of the total.
- Audit: severity rules cover a large new bill without a budget, "before launch" without a date and unverified findings; advisories come from `npm audit` and similar, never from memory. The nine-field details table is shown only on request; each finding carries the fields on its own lines.
- Writing STACK.md: the JSON goes to a file in `.manifestack/tmp/` (works in PowerShell too), which `set` keeps out of git. `lint` knows the usage metrics of the vendor maps and accepts `source: user` and `source: unverified`.
- Token use: each mode reads only its own questions; MCP rules load only when a vendor MCP is connected.
- Projections: a percentage growth compounds when converted between periods (+10%/week is about +51% a month, not +43%). `eta` rejects a `--rate` without a period or in the wrong unit, `--points` in a different unit from `--limit`, and a `--growth` without `%`.
- `usage` in STACK.md: also reads `312 MB; +1.1 MB/day`, `312 MB,+1.1 MB/day`, `(as of 2026-10-6)` and `41,200 emails`, and `lint` warns about what it cannot read instead of letting `check` report `ok`.
- Secrets: also catches AWS secret keys, `redis://:password@host`, `db_password: …` and `"apiKey": "…"`. A commit hash or UUID in a URL path, and Stripe object ids, are not secrets. `set` refuses only the lines it writes, writes atomically and never echoes a rejected value.
- Detection: vendors seen only in fixtures, mocks, tests or examples are listed under `samples`, not as the stack. Python and Go imports count as evidence, a role signal alone no longer makes a vendor, and the file limit never drops a manifest. A multi-line value in `.env` no longer leaks into `env_names`.
- STACK.md: a code block opened with `~~~` or four backticks is not closed by a ``` line inside it; `## Other: C#` keeps its `#`; `date > X` is due the day after X; `users` skips years and multipliers ("launch in 2027 with 5k users" is 5,000).
- Hook: fewer false alarms. It no longer reports every vendor when git is missing or refuses the repository, treats an install of a package the project already has as an upgrade, reads commands with quotes and heredocs correctly (a commit message is not an install), and names each vendor once per session.
- Hook: with both the Claude Code plugin and a project hook, only the project hook reports.
- Hook: the Claude Code command uses `${CLAUDE_PROJECT_DIR}`, which also works on Windows without Git Bash. `detect.mjs` reports older entries as `outdated`; run `npx manifestack hook` to update.
- Hook: also recognizes `sudo -E npm`, `corepack pnpm`, `npm.cmd`, `py -m pip` and `npm i alias@npm:pkg`; ignores `--dry-run` and `--location=global`.
- CLI: `uninstall` without a terminal needs `--yes` or `--agent`, like `install`. An agent named twice is set up once; an empty `--dir=` and a folder in place of a config file are clear errors.
- New mode `compare` (`/manifestack compare neon supabase`): two or three vendors for the same job, side by side for your workload: requirements, the plan and cost at your size, the first limit, the features you use and what it takes to leave. When one is already in use, it also sizes the switch.
- Audit: findings get a severity (`Critical`, `High`, `Medium`, `Low`), and the report opens with a verdict (what was found, the budget now and at your target size) and a "Do today" list of quick fixes.
- Both modes ask what the code cannot show (plans, regions, credits, what customers require) with options and stated defaults, and remember the answers in STACK.md.
- New `priority` in STACK.md (`lowest cost`, `balanced`, `least ops`, `control`): init builds the stack for it with up to two alternatives, and audits and the guard follow it.
- Init answers your own idea first, and lists what you do not need and what cannot be changed later.
- Before reporting a bill, the audit checks the vendor's flat-rate tiers; the Vercel map now covers Flat Rate CDN and Spend Management.

## 0.3.0

- Breaking: Node.js 22 or newer is required (18 and 20 are past end of life).
- Hook: also runs after package-manager installs (`npm install`, `pip install`, `go get` and similar). In Cursor it is now a `postToolUse` hook, because Cursor ignored the output of the old `afterFileEdit` one. Run `npx manifestack hook` to update; `detect.mjs` reports old setups as `outdated`.
- Hook: no false alarms after removing a dependency, when git is slow (Windows), when the session runs in a subfolder, or when STACK.md names the vendor differently ("Stripe Billing").
- `stack-md.mjs set --json` takes values from a file or stdin, for text copied from vendor pages. `set` no longer cuts values at `#`, and `check` reports a broken section as `error` instead of failing the whole file.
- Detection: more Python (pyproject extras, uv and PDM groups), Deno imports and `deno.json`, config files in dot-folders. Virtualenvs no longer use up the file limit, and imports in comments, React Email and `mongodb-memory-server` no longer count as vendors.
- CLI: without a terminal, `install` needs `--agent` or `--yes`; `uninstall` removes only manifestack's own folders.
- Skill `manifestack`: a pricing page it cannot read is marked `unverified`, never filled from search results or memory.
- Fixes in cost and usage math (units, `$` amounts, dates), secret detection, Windows paths and line endings.

## 0.2.0

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
- Vendor map: Adapty
- Vendor map: Cloudinary
- Vendor map: Convex
- Vendor map: Datadog
- Vendor map: DigitalOcean
- Vendor map: Expo EAS
- Vendor map: Google Gemini
- Vendor map: Heroku
- Vendor map: Lemon Squeezy
- Vendor map: MongoDB Atlas
- Vendor map: PlanetScale
- Vendor map: Polar
- Vendor map: RevenueCat
- Vendor map: UploadThing
- Vendor map: Upstash
- Vendor map: WorkOS
- Vendor map: Anthropic
- Vendor map: Auth0
- Vendor map: Cloudflare
- Vendor map: Firebase
- Vendor map: Fly.io
- Vendor map: Netlify
- Vendor map: OpenAI
- Vendor map: Paddle
- Vendor map: PostHog
- Vendor map: Postmark
- Vendor map: Railway
- Vendor map: Render
- Vendor map: SendGrid
- Vendor map: Sentry
- Vendor map: Stripe

## 0.1.0

- Skill `manifestack` with `init` and `audit` modes.
- Skill `manifestack-guard`: checks a new or changed vendor against STACK.md.
- STACK.md format with `revisit_when`, and a template.
- Scripts: vendor detection, limit ETA and cost projection, STACK.md parse/check/lint/set.
- npm CLI `manifestack` with `install` and `uninstall` for Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, OpenCode, Cline and Gemini CLI.
- Claude Code plugin and marketplace.
- "New vendor" hook for Claude Code and Cursor.
- Vendor map: Vercel
- Vendor map: Supabase
- Vendor map: Neon
- Vendor map: Clerk
- Vendor map: Resend
