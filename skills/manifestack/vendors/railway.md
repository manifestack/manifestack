---
# generated, edit catalog/vendors/railway.md (then run: node tools/sync.mjs)
schema: 1
id: railway
name: Railway
roles: [hosting]
detect:
  packages: ["@railway/cli"]
  env_prefixes: ["RAILWAY_"]
  config_files: ["railway.json", "railway.toml"]
pages:
  pricing: https://railway.com/pricing
  plans: https://docs.railway.com/pricing/plans
  cost_control: https://docs.railway.com/pricing/cost-control
  faqs: https://docs.railway.com/pricing/faqs
  serverless: https://docs.railway.com/deployments/serverless
  regions: https://docs.railway.com/deployments/regions
  postgres: https://docs.railway.com/databases/postgresql
  security: https://docs.railway.com/enterprise/compliance
  trust: https://trust.railway.com
  dpa: https://railway.com/legal/dpa
read:
  - plan names (Trial, Free, Hobby, Pro, Enterprise), the monthly fee of each and the usage credit it includes
  - usage rates billed per second for vCPU, memory and volume storage, and the per-GB rate for network egress
  - trial terms (one-time credit grant) and the Free plan's monthly credit, with the per-plan caps on replicas, RAM, CPU, volume size and image size
  - what happens when a credit balance reaches zero or an invoice goes unpaid (workloads stopped, deploys blocked)
  - usage limits per workspace, i.e. a custom email alert (soft) and a hard limit that takes all workloads offline, and the minimum hard limit allowed
  - whether Serverless (sleep after inactivity) is on for the service, and the cold-start delay or 502 on the first request after sleep
  - databases are unmanaged templates (Postgres, MySQL, Redis, MongoDB) on volumes; read the backup, HA and volume size limits per plan
  - regions offered and that changing the region of a service with a volume migrates the volume with downtime
  - commercial use guidance for Free and Hobby (Pro is recommended for commercial apps)
  - certifications (SOC 2 Type II, SOC 3, HIPAA BAA as an add-on with a spend threshold) and the self-serve DPA
usage_questions:
  - metric: monthly_bill
    ask: Current billing-period usage and the estimated total (and last invoice)?
    where: Dashboard → workspace → Usage (railway.com/workspace/usage); invoices under Billing → Billing History
  - metric: egress_gb
    ask: Network egress this billing period, per project?
    where: Dashboard → workspace → Usage → Usage by Project (Network)
  - metric: region
    ask: Which region does each service (and its volume) run in?
    where: Project → service → Settings → region picker (replicas per region)
  - metric: instances
    ask: How many replicas does each service run, and is Serverless on?
    where: Project → service → Settings → region/replica settings; Settings → Deploy → Serverless
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set a hard usage limit and a custom email alert on the workspace Usage page
  - enable Serverless on low-traffic or staging services (Settings → Deploy → Serverless), accepting cold starts
  - cap per-replica CPU and memory (Settings → Deploy → Replica Limits) and remove idle replicas
  - connect services and databases over private networking to avoid egress charges
  - put the app and its database in the same region, near the users
  - serve static assets and large media from a CDN or object storage
verified: 2026-10-07
---

- Railway usually has no SDK in `package.json`. It is detected from `railway.json` / `railway.toml` and `RAILWAY_*` names in `.env` files. A repo deployed from the dashboard only may show nothing: ask the user where the app runs.
- A hard usage limit stops every workload in the workspace when reached, so a low cap on a production app is an outage Risk. A soft alert only emails.
- Railway databases are templates on volumes, not a managed service. `DATABASE_URL` / `PGHOST` names alone do not prove Railway is the database host, so this map does not claim the `database` role; ask if Postgres runs on Railway.
- Railway MCP (`mcp.railway.com`, or `railway mcp` locally) has create, deploy, redeploy and set/list variables tools and no read-only mode. Do not use it; ask the user for numbers instead.
- Railway plus a second hosting platform for the same app is Overlap unless split on purpose (for example a frontend on Vercel and an API on Railway). The service region must match any data-region requirement.
