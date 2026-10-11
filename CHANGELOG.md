# Changelog

All notable changes are listed here, in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Versions follow [semver](https://semver.org); 0.x until the formats settle. The section of a version is also its GitHub release notes.

## [Unreleased]

### Changed

- README and the npm and Claude Code plugin descriptions lead with what the stack will cost: every service priced at your usage and growth on the vendor's own pages, each bill with the fix that cuts it. Limits, data rules, overlaps and overbuilt setups follow in the same report.

## [0.5.1] - 2026-10-11

108 vendor maps, up from 36: AWS, Google Cloud and Azure as vendor families, 27 more vendors and six new roles. Detection also reads CI workflows and infrastructure templates in JSON. To update an installed project, run `npx manifestack@latest`; it also updates the new-vendor hook, which carries its own copy of the vendor list. With the hook added by `npx manifestack hook`, run `npx manifestack@latest hook`; with the Claude Code plugin, update the plugin.

### Added

- Vendor families: a large vendor is split into an account map and one map per service (`family`, `detect.service_signals`), so an audit reads only the services a project uses. Service signals are also found in Terraform, Bicep, `serverless.yml`, SAM, CloudFormation and other YAML files. Services of one family in the same role (CloudFront in front of Lambda) are not an Overlap, and a family's own signals (a Terraform provider, a CloudFormation YAML template, `azure.yaml`) find it without an SDK. `detect.mjs` marks such entries with `family` and lists Bicep files in `infra`.
- AWS: an account map (Free plan and credits, spend limits, Budgets, data transfer, NAT Gateway, public IPv4, support plans, regions) and 15 service maps, found from SDK clients, boto3 calls, Terraform, CloudFormation, SAM, CDK, Pulumi and SST.
- Google Cloud: an account map (Free Trial and credits, budgets and spend caps, network egress, regions) and 11 service maps, found from client libraries, Python and Go modules, Terraform, Pulumi, Config Connector, `cloudbuild.yaml` and `gcloud` deploy commands. Firebase joins this family, so Firestore next to Cloud SQL, or Firebase Storage next to Cloud Storage, is not an Overlap.
- Azure: an account map (free account and credits, spending limit, budgets, bandwidth, public IPv4, reservations and savings plans, support plans, regions) and 16 service maps, found from client libraries, Python and Go modules, Terraform, Bicep, Pulumi, `azure.yaml` (Azure Developer CLI), Azure Pipelines and `az` commands. Communication Services is flagged as retiring. Azure OpenAI through the `openai` SDK (`AzureOpenAI`) is read from the Azure OpenAI map, and OpenAI counts for `AI` only when the code calls OpenAI directly.
- Platform logs (Lambda, Cloud Run, GKE, App Engine, Container Apps, Functions, AKS) make CloudWatch, Cloud Logging or Azure Monitor a bill to check, not a second monitoring tool next to Sentry or Datadog.
- Vendor maps:
  - Hosting: Vultr (with its read-only MCP server) and Hetzner. Hetzner counts for storage only with an Object Storage endpoint in the code.
  - Database and AI: Turso, Prisma Postgres, Pinecone and OpenRouter, which were detected before without a map. Turso counts as a database only when the code points to Turso Cloud, and the Prisma ORM alone is not Prisma Postgres.
  - Email, SMS and push: Mailgun, Twilio and OneSignal. OneSignal counts for email only when the code sends email through it.
  - Payments: PayPal, with Braintree. PayPal next to Stripe is usually a wallet button next to card payments; the map says when it is an Overlap.
  - Video: Mux.
  - Realtime and jobs: Pusher, Ably, Inngest and Trigger.dev. Pusher counts only when the code uses a Pusher client or host, so Laravel projects on Reverb's defaults are not mistaken for it.
  - Search and CMS: Algolia, Contentful, Sanity, Storyblok and Strapi. Strapi notes how to tell Strapi Cloud from a self-hosted server.
  - Analytics and flags: Segment, Mixpanel, Amplitude and LaunchDarkly. Segment feeding an analytics tool is not an Overlap; Mixpanel and Amplitude count for flags only when the code uses their feature flags.
  - Monitoring: New Relic, Grafana Cloud and Elastic Cloud. Their notes tell Grafana Cloud and Elastic Cloud apart from free self-hosted Grafana and Elasticsearch. Elastic counts for search or monitoring only when the code uses that part.
- Roles `Analytics`, `Search`, `Realtime`, `Jobs`, `CMS` and `Flags` for STACK.md sections and vendor maps, so two services doing the same job are reported as an Overlap. PostHog is `Analytics`, and counts for `Monitoring` or `Flags` only when the code uses error tracking or feature flags. Upstash counts for `Jobs` when the code uses QStash or Workflow. `Other` holds unrelated jobs (SMS, a data pipeline, a cloud account), so two vendors in it are never an Overlap.
- Detection reads CI workflows (`.github/workflows`, `.circleci`, `.buildkite`): deploy steps for AWS, Google Cloud and Azure (`google-github-actions/deploy-cloudrun`, `azure/webapps-deploy`, `aws-actions/amazon-ecs-deploy-task-definition` and others) find the cloud and the service.
- Detection reads infrastructure in JSON: CloudFormation and SAM templates (`template.json`), ARM templates (`azuredeploy.json`) and Terraform JSON (`*.tf.json`).
- Vendor maps can leave one package out of a scope they claim (`!azure-devops`, `!@google-cloud/local-auth`), so Azure DevOps and Google Workspace sign-in no longer find the clouds.

### Fixed

- Detection: only Vercel's platform packages mean Vercel (`@vercel/og`, `@vercel/otel` and `@vercel/ncc` run anywhere); `EAS_` and other tools' `DD_` env names no longer find Expo or Datadog; Claude through Bedrock, Vertex AI or Foundry counts for the cloud, not as Anthropic API use. When the env prefixes of two maps match one name, the longer prefix wins.
- Detection: an unclosed `/*` (a glob, a regex such as `/[/*]$/`) no longer hides the rest of the file; role signals in tests, fixtures and examples no longer give the product a role; a scan cut at the file limit finds the same vendors on every file system, and the limit counts source files only, so many manifests no longer use it up.
- Hook: with git missing or slow, upgrading a package the project already has is no longer reported as a new vendor, and all git calls share one time limit. Vendor names with accents in STACK.md match.
- `npx manifestack` reads `.claude/settings.json` and `.cursor/hooks.json` saved with a byte order mark.
- STACK.md: `usage` reads GiB, MiB, TiB and PB, and a unit or currency it cannot read is a lint warning instead of a wrong number; parallel `set` calls no longer lose each other's sections; `lint` accepts a vendor map's own metric name when the section has one reading.
- `project.mjs eta`: a reading old enough that the trend has already passed the limit says `Now`, with the projected date.
- STACK.md: Slack webhook URLs and GitLab tokens are refused as secrets, and very long pasted lines are checked quickly.
- `project.mjs cost`: negative, endless or malformed model values are errors that name the field, instead of negative totals or a crash.
- `npx manifestack uninstall` removes agent folders it left empty (`.gemini`, `.windsurf`), so a later install does not detect agents the project does not use.
- Detection is about a third faster on large repositories.

## [0.4.0] - 2026-10-08

To update an installed project: `npx manifestack@latest`, then `npx manifestack hook` so the Claude Code hook gets the command that also works on Windows.

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
- STACK.md: code fences, headings such as `## Other: C#` and `date > X`.
- Parsing time on very long lines in STACK.md, `pyproject.toml`, `requirements.txt`, `go.mod` and `--points`: a crafted `pyproject.toml` could hang detection and the hook.

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

[Unreleased]: https://github.com/manifestack/manifestack/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/manifestack/manifestack/compare/v0.4.0...v0.5.1
[0.4.0]: https://github.com/manifestack/manifestack/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/manifestack/manifestack/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/manifestack/manifestack/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/manifestack/manifestack/releases/tag/v0.1.0
