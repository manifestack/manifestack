# Changelog

All notable changes are listed here. Versions follow [semver](https://semver.org); 0.x until the formats settle. Each new vendor map gets its own line.

## Unreleased

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
