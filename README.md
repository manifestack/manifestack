<div align="center">

# Manifestack

**A stack that fits your project, and keeps fitting as it changes.**

[![Website](https://img.shields.io/badge/website-manifestack.com-0a7cff)](https://manifestack.com)
[![npm](https://img.shields.io/npm/v/manifestack?logo=npm&color=cb3837)](https://www.npmjs.com/package/manifestack)
[![CI](https://github.com/manifestack/manifestack/actions/workflows/ci.yml/badge.svg)](https://github.com/manifestack/manifestack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/manifestack/manifestack/blob/main/LICENSE)

</div>

Picking a stack is the easy part. Keeping it right is harder: the project grows, the agent adds a service nobody checks, a plan runs out of quota, a customer asks for EU data. Manifestack works inside your coding agent (Claude Code, Cursor, Codex and others) and looks at the whole product: frontend, backend, workers, infrastructure and every third-party API.

- **Starting a project?** It picks hosting, database, auth, email and the rest for your budget, users, data rules and team, priced at 1k, 10k and 100k users.
- **Changing the stack?** Every service the agent adds is checked against your requirements, your avoid list and the services you already run, before you rely on it.
- **Already running?** It tells you which limit or bill you'll hit first, when, what it will cost and how to avoid it.

Built for developers, small teams and agencies who choose their own services, from the first commit to a few hundred thousand users.

- **Read-only.** It never changes code, config or vendor settings on its own. The only file it writes is `.manifestack/STACK.md`.
- **No API keys, no account, runs locally.** It reads env var names, never their values.
- **Current facts.** Every price, limit and region comes from the vendor's public pages, with the date it was read.

## Quick start

```bash
npx manifestack
```

Then, in your agent:

```text
/manifestack
```

It runs `init` on an empty repo and `audit` on an existing one.

## What it looks at

The whole product, not one `package.json`. Example: a Next.js frontend, a Python API and a Go worker.

```text
1. Reads                     2. Sorts by role                                  3. Checks against
web/package.json         ->  Hosting     Vercel                            ->  .manifestack/STACK.md
api/requirements.txt         Database    Supabase                                budget, users, requires,
worker/go.mod                Auth        Clerk + Supabase Auth  ← Overlap        prefer, avoid
vercel.json, infra/*.tf      Payments    Stripe                                vendor pages, read today
.env (names only)            Email       Resend                                  pricing, limits, regions,
                             Monitoring  Sentry                                  certifications
                             AI          OpenAI
```

It reads dependencies from `package.json`, `requirements.txt`, `pyproject.toml`, `Pipfile` and `go.mod`, plus config files and env var names in any project. An audit of that product looks like this:

| Finding | When | Cost | Fix |
| --- | --- | --- | --- |
| **Requirement** Supabase project in us-east-1, STACK.md requires an EU database | Before launch | ~1 day of migration | Create the production project in an EU region and move the data while it is small |
| **Overlap** Clerk and Supabase Auth both sign users in | Now | $25/mo on Clerk Pro | Keep the one whose features you use, remove the other |
| **Risk** OpenAI usage tier 1: the launch-day estimate is above the tokens-per-minute limit | Launch day | Higher tiers need paid history and time | Request a tier increase now, queue uploads, use a smaller model for short summaries |
| **Limit** Supabase Free: database size. 312 / 500 MB, +1.1 MB/day | ETA ~Mar 2027 | $25/mo on Pro | Archive `events` rows older than 90 days, or schedule the upgrade |

Findings are `Requirement`, `Overlap`, `Overbuilt`, `Limit`, `Bill` or `Risk`, each with evidence, when, cost, fix and source.

## Install

`npx manifestack` detects your agent. To pick one explicitly:

| Agent | Install | Run |
| --- | --- | --- |
| Claude Code | `npx manifestack --agent claude-code` | `/manifestack` |
| Cursor | `npx manifestack --agent cursor` | ask the agent to run `manifestack` |
| Codex | `npx manifestack --agent codex` | `$manifestack` |

It also detects Copilot, Windsurf, OpenCode, Cline and Gemini CLI. For Claude Code and Cursor it adds a hook that flags each new vendor the agent adds to `package.json`, `requirements.txt`, `pyproject.toml` or `go.mod`. `npx manifestack uninstall` removes everything except your `.manifestack/` folder.

<details>
<summary>Other ways to install</summary>

**Claude Code plugin** (run it as `/manifestack:manifestack`):

```text
/plugin marketplace add manifestack/manifestack
/plugin install manifestack@manifestack
```

**skills CLI** (skills only; `/manifestack` offers to add the hook later):

```bash
npx skills add manifestack/manifestack
```

**Manual:**

```bash
git clone https://github.com/manifestack/manifestack
cp -r manifestack/skills/manifestack .agents/skills/   # Claude Code: .claude/skills/
```

</details>

## Commands

| Command | What it does |
| --- | --- |
| `/manifestack` | `init` for an empty repo, `audit` otherwise |
| `/manifestack init "B2B dashboard, EU users"` | Asks about budget, users, requirements and what the team prefers and avoids, proposes and prices a whole stack |
| `/manifestack audit` | Scans the repo, checks every service against your requirements and growth, reports findings |
| *(automatic)* | In Claude Code and Cursor, a hook checks every vendor the agent adds against `STACK.md` before you rely on it |

## STACK.md

Manifestack writes only to `.manifestack/` and never to your repository root:

```text
.manifestack/
├── STACK.md   # requirements and decisions, commit it
└── tmp/       # working files, ignored by git
```

```markdown
## Requirements
budget: ~$600/mo
users: 9k now, 50k by Q3
requires: EU database, SOC 2 vendors
prefer: Postgres, Next.js
avoid: Kubernetes  # no ops on-call

## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
decided: stay on Free until first paying user
revisit_when: db_size > 400 MB OR date >= 2027-02-01
```

`requires` holds hard rules, `prefer` what the team knows or wants to use, `avoid` what it rules out. Every pick and every new service is checked against them. Decisions are only written after your yes. Secrets never go in. [Full format](https://github.com/manifestack/manifestack/blob/main/skills/manifestack/references/stack-md.md).

## Vendors

Works with any vendor: the skill finds its public pages during the audit. Built-in page maps make that faster and more reliable. So far they cover:

| Role | Vendors |
| --- | --- |
| Hosting | Vercel, Netlify, Cloudflare, Railway, Render, Fly.io, Heroku, DigitalOcean |
| Database | Supabase, Neon, Firebase, PlanetScale, MongoDB Atlas, Upstash, Convex |
| Auth | Clerk, Auth0, WorkOS |
| Email | Resend, Postmark, SendGrid |
| Storage | Cloudinary, UploadThing |
| Payments | Stripe, Paddle, Lemon Squeezy, Polar |
| Mobile | RevenueCat, Adapty, Expo EAS |
| Monitoring | Sentry, PostHog, Datadog |
| AI | OpenAI, Anthropic, Google Gemini |

New maps ship as releases. [Request a map](https://github.com/manifestack/manifestack/issues).

## Contributing

See [CONTRIBUTING.md](https://github.com/manifestack/manifestack/blob/main/CONTRIBUTING.md). Security issues: [SECURITY.md](https://github.com/manifestack/manifestack/blob/main/SECURITY.md).

## License

[MIT](https://github.com/manifestack/manifestack/blob/main/LICENSE)
