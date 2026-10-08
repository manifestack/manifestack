<div align="center">

<img width="72" height="72" alt="Manifestack logo" src="https://github.com/user-attachments/assets/9c9a39a8-b500-404f-a941-7d63219c173b" />

# Manifestack

**A stack that fits your project, and keeps fitting as it changes.**

[![Website](https://img.shields.io/badge/website-manifestack.com-0a7cff)](https://manifestack.com)
[![npm](https://img.shields.io/npm/v/manifestack?logo=npm&color=cb3837)](https://www.npmjs.com/package/manifestack)
[![CI](https://github.com/manifestack/manifestack/actions/workflows/ci.yml/badge.svg)](https://github.com/manifestack/manifestack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/manifestack/manifestack/blob/main/LICENSE)

</div>

Manifestack is a skill for your coding agent (Claude Code, Cursor, Codex and others). Ask it to check your stack, and it finds the bills, outages and compliance gaps ahead of you, with a fix for each and every price read from the vendor's own page.

## Quick start

```bash
npx manifestack
```

Then ask your agent to check your stack, or run `/manifestack`.

## What it does

- **New project:** asks about users, budget, data rules and your team, then picks hosting, database, auth, email and the rest, priced at 1k, 10k and 100k users, and says what you don't need.
- **Existing project:** scans the whole product (JS, Python and Go dependencies, config files, env var names) and reports what breaks or costs too much, by severity, with a fix for each.
- **Every change:** in Claude Code and Cursor, a hook flags each new vendor SDK and checks it against your requirements before you rely on it.

It never changes your code or vendor settings, needs no API keys or account, and writes only `.manifestack/STACK.md`.

## Usage

| Command | What it does |
| --- | --- |
| `/manifestack` | `init` on an empty repo, `audit` otherwise |
| `/manifestack init "B2B dashboard, EU users"` | Proposes and prices a whole stack |
| `/manifestack audit` | Checks every service against your requirements, budget and growth |

You can also just ask: "what breaks first at 50k users?" or "what should we build this on?".

<details>
<summary>Example: an audit of a demo product (Next.js, FastAPI and Go, 7 vendors)</summary>

<sub>A real run: usage numbers are the demo's, every price and limit was read from the vendor's page on Oct 8, 2026.</sub>

| Severity | Finding | When | Cost | Fix |
| --- | --- | --- | --- | --- |
| Critical | **Risk** Vercel's default $200 on-demand budget runs out mid-month at ~$340/mo of overage, and production deployments pause by default | Every month, ~18th | Site down until each project is resumed by hand | Turn on Flat Rate CDN (below), which ends the overage; until then raise the budget in Settings → Billing → Spend Management |
| Critical | **Requirement** Supabase project in us-east-1, STACK.md requires an EU database | Now | ~1 day of migration | New project in eu-central-1, move the 312 MB now; pin Vercel functions to `fra1` |
| Critical | **Risk** Resend allows 10 API requests/s; the weekly digest sends 9,000 emails, 50 in parallel | Mondays | Digests lost to 429 errors | Throttle the worker to 10 requests/s, retry 429 with backoff |
| Critical | **Requirement** OpenAI's trust page does not confirm the API is in its SOC 2 Type 2 scope (unverified) | Before the next security review | — | Check OpenAI's product compliance status page for the API |
| High | **Bill** At 50k users (the Q3 plan in STACK.md) the stack costs ~$4,580/mo; Vercel transfer is $2,684 of it | By Q3 | ~$55k/yr against a ~$600/mo budget | With Vercel Flat Rate CDN the same 50k users cost ~$1,920/mo, and today ~$350/mo instead of ~$690/mo |
| High | **Bill** Vercel Pro: 3.4 TB of Fast Data Transfer billed on demand ($0.15/GB past 1 TB), +0.3 TB/mo | Now, growing | ~$360/mo, ~$2,684/mo at 50k users | Billing → Flat Rate CDN: the $20/mo tier covers 50 TB and 10M CDN requests (check Usage → CDN Requests first) |
| High | **Risk** OpenAI Build tier caps usage at $500/mo; spend is $310, +21%/mo | ~Dec 2026 | API calls blocked until the month resets | Top up to $100 in total credit purchases to reach Launch ($5,000/mo cap) |
| Medium | **Limit** Resend Pro: 41,200 / 50,000 emails, +18%/mo | ~Nov 2026 | +$15/mo on the 100k tier | Move to the 100k tier ($35/mo) before November |
| Medium | **Limit** Supabase Free: 312 / 500 MB, read-only above it, +1.1 MB/day | ~Mar 2027 | $25/mo on Pro | Archive `events` rows older than 90 days, or upgrade with the EU move |
| Low | **Overlap** Clerk and Supabase Auth both sign users in | Now | Two user stores | Move team invites to Clerk, remove Supabase Auth |

</details>

<details>
<summary>Example: init for a new EU B2B dashboard</summary>

> B2B dashboard for EU customers, ~1k users at launch, 2 React devs, $150/mo max, cheaper is better. Was going to put Next.js on EKS. Sane?

**Skip Kubernetes.** The EKS control plane alone is ~$73/mo, half your budget, before any server, load balancer or database, and you would run it. A whole stack in the EU for ~$71/mo, built for lowest cost:

| Layer | Pick | At launch | Why |
| --- | --- | --- | --- |
| Frontend | React SPA (Vite), static files on Cloudflare | $0 | No SSR needed behind a login, and you already know React |
| Backend | Supabase Pro in Frankfurt: Postgres, auth, API | $25/mo | The Postgres you know, with auth and the API in one EU project |
| Email | Resend Pro, sending domain in Ireland | $20/mo | The free plan caps 100 emails a day, too tight for a launch |
| Errors | Sentry Team, EU organization in Frankfurt | $26/mo | Two developers; the free plan is for one user only |

| Users | 1k | 10k | 50k | 100k |
| --- | --- | --- | --- | --- |
| Per month | $71 | $71 | $131 | $266 |

Fits the $150/mo budget up to ~55k users; email is what grows. Less to run instead: Next.js on Vercel Pro with the same backend, ~$111/mo. Not needed: Kubernetes, SSR, a separate auth service. Decide now: create Supabase in eu-central-1 and Sentry in the EU; neither region can be changed later.

</details>

## Install

`npx manifestack` detects your agent. To pick one:

| Agent | Install | Run |
| --- | --- | --- |
| Claude Code | `npx manifestack --agent claude-code` | `/manifestack` |
| Cursor | `npx manifestack --agent cursor` | ask the agent to run `manifestack` |
| Codex | `npx manifestack --agent codex` | `$manifestack` |

It also detects Copilot, Windsurf, OpenCode, Cline and Gemini CLI. `npx manifestack uninstall` removes everything except `.manifestack/`.

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
mkdir -p .agents/skills                                # Claude Code: .claude/skills/
cp -r manifestack/skills/manifestack manifestack/skills/manifestack-guard .agents/skills/
```

</details>

## STACK.md

Your requirements and decisions, in `.manifestack/STACK.md`. Commit it; every audit and new service is checked against it.

```markdown
## Requirements
budget: ~$600/mo
users: 9k now, 50k by Q3
requires: EU database, SOC 2 vendors
avoid: Kubernetes
priority: least ops

## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
revisit_when: db_size > 400 MB OR date >= 2027-02-01
```

Decisions are written only after your yes; secrets never go in. [Full format](https://github.com/manifestack/manifestack/blob/main/skills/manifestack/references/stack-md.md).

## Vendors

Works with any vendor. Built-in page maps make these faster and more reliable:

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

[Request a map](https://github.com/manifestack/manifestack/issues).

## Contributing

See [CONTRIBUTING.md](https://github.com/manifestack/manifestack/blob/main/CONTRIBUTING.md). Security issues: [SECURITY.md](https://github.com/manifestack/manifestack/blob/main/SECURITY.md).

## License

[MIT](https://github.com/manifestack/manifestack/blob/main/LICENSE)
