---
# generated, edit catalog/vendors/heroku.md (then run: node tools/sync.mjs)
schema: 1
id: heroku
name: Heroku
roles: [hosting]
detect:
  packages: ["heroku", "@heroku/", "@heroku-cli/"]
  imports: ["@heroku/"]
  go: ["github.com/heroku/heroku-go"]
  env_prefixes: ["HEROKU_"]
  config_files: ["Procfile", "heroku.yml"]
pages:
  pricing: https://www.heroku.com/pricing
  billing: https://devcenter.heroku.com/articles/usage-and-billing
  dyno_tiers: https://devcenter.heroku.com/articles/dyno-tiers
  eco_dyno_hours: https://devcenter.heroku.com/articles/eco-dyno-hours
  free_plans_removed: https://devcenter.heroku.com/changelog-items/2502
  limits: https://devcenter.heroku.com/articles/limits
  regions: https://devcenter.heroku.com/articles/regions
  postgres: https://devcenter.heroku.com/articles/heroku-postgres-plans
  security: https://www.heroku.com/policy/security
  compliance: https://www.heroku.com/compliance
  shield: https://www.heroku.com/shield
  dpa: https://www.salesforce.com/content/dam/web/en_us/www/documents/legal/Agreements/data-processing-addendum.pdf
  dpa_help: https://help.heroku.com/B4E5QFQQ/where-do-i-get-copy-of-dpa-from-heroku
read:
  - dyno tiers (Eco, Basic, Standard, Performance on the Common Runtime; Private and Shield in Private Spaces; Fir) and the monthly price of each dyno size; usage is prorated to the second and each dyno or add-on is charged at most its listed monthly price
  - there is no free tier; free dynos, free Postgres and free Redis were removed in 2022, so a plan that relies on a free Heroku dyno is a Requirement finding
  - Eco dynos share a monthly pool of dyno hours per account and web dynos sleep after inactivity (cold start on the next request); when the pool runs out every Eco dyno sleeps until the next month, a production Risk
  - which tiers allow several process types, horizontal scaling, Preboot and autoscaling (Performance and Private tiers only), and which tiers show metrics
  - network bandwidth is a soft limit per app per month, not a billed allowance; read the limits page for its size and the other platform limits (slug size, request timeout, log retention)
  - there is no native spend cap or spend alert; the bill is the sum of dynos and add-ons per month, so read it from the app formation and the Billing page (usage refreshed nightly)
  - Heroku Postgres tiers (Essential, Standard, Premium, Private, Shield, Advanced) with their storage, connection and table limits, and which tiers have rollback, fork/follow and HA
  - Common Runtime regions (us, eu) versus Private Spaces regions; an app's region cannot be changed, a move means a new app and a data migration
  - certifications (SOC 1/2/3, ISO 27001/27017/27018, PCI DSS); HIPAA only on Shield products (Shield Private Spaces, Shield dynos, Shield Postgres) with a BAA, offered to Enterprise customers
  - the DPA is the Salesforce-wide Data Processing Addendum that covers Heroku
usage_questions:
  - metric: monthly_bill
    ask: Current usage this month and the last invoice total?
    where: Dashboard → Account settings → Billing (dashboard.heroku.com/account/billing); Enterprise accounts use the Enterprise Account Usage dashboard
  - metric: dynos
    ask: Which dyno type and how many dynos does each process type run, per app?
    where: Dashboard → app → Resources; or `heroku ps -a <app>`
  - metric: db_size
    ask: Heroku Postgres plan, data size and connection count?
    where: `heroku pg:info -a <app>` (Plan, Data Size, Connections); or the Heroku Postgres add-on from app → Resources
  - metric: region
    ask: Which region (or Private Space) does each app run in?
    where: `heroku info -a <app>` (Region); Private Space apps show the space and its region in the Dashboard
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - right-size dyno types and counts on the Resources tab, and scale idle staging or demo apps down to zero dynos
  - use Eco dynos only for non-production apps that can sleep, and stop monitors from pinging them awake
  - on Performance dynos, turn on autoscaling with a maximum dyno count instead of a fixed high count
  - remove unused add-ons and idle review or staging apps, since each is billed by the month
  - pick the Postgres tier by data size, connection count and the HA or rollback the app needs, and pool connections before moving up a tier
  - create the app in the region the data rules require at the start, since the region cannot be changed later
  - serve static assets and large media from a CDN or object storage to stay well under the bandwidth soft limit
verified: 2026-10-07
---

- Heroku usually has no SDK in the app. It is detected from `Procfile` and `heroku.yml` in the repo root and `HEROKU_*` names in `.env` files (`HEROKU_API_KEY` for the CLI, `HEROKU_APP_NAME` and other dyno metadata vars when the `runtime-dyno-metadata` lab is on). `Procfile` is also read by other buildpack hosts (Dokku, Scalingo and other Cloud Native Buildpacks platforms), so a `Procfile` alone is a hint, not proof; ask. A repo deployed by Git push or from the dashboard without these files leaves no trace: ask the user where the app runs.
- `app.json` (Review Apps, Heroku CI, Heroku Button) is not a detection signal because Expo and other tools use the same file name. Check it by hand: a root `app.json` with `addons`, `formation` or `buildpacks` keys is Heroku.
- Heroku Postgres, Key-Value Store and add-ons show only as `DATABASE_URL`, `REDIS_URL` or `HEROKU_POSTGRESQL_<COLOR>_URL` config vars, which rarely appear in the repo, so this map does not claim the `database` role. Ask where the database runs.
- Heroku MCP (`heroku mcp:start` or `@heroku/mcp-server`, local only) has deploy, create app, scale, restart, maintenance, `pg_psql`, `pg_kill`, `pg_upgrade` and `pg_credentials` tools, and `get_app_info` returns app config; there is no read-only mode. Do not use it; ask the user for numbers instead.
- Heroku plus a second hosting platform for the same app is Overlap unless split on purpose (for example a frontend on Vercel and an API on Heroku). A Common Runtime app runs in `us` or `eu` only; any other data-region requirement needs Private Spaces, which is an Enterprise product.
