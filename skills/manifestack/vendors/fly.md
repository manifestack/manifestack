---
# generated, edit catalog/vendors/fly.md (then run: node tools/sync.mjs)
schema: 1
id: fly
name: Fly.io
roles: [hosting]
detect:
  packages: ["@fly/", "@flydotio/dockerfile"]
  go: ["github.com/superfly/fly-go", "github.com/superfly/flyctl"]
  imports: ["@fly/"]
  env_prefixes: ["FLY_"]
  config_files: ["fly.toml"]
pages:
  pricing: https://fly.io/pricing/
  pricing_docs: https://docs.fly.io/about/pricing
  billing: https://docs.fly.io/about/billing
  free_trial: https://docs.fly.io/about/free-trial
  cost_management: https://docs.fly.io/about/cost-management
  autostop: https://docs.fly.io/launch/autostop-autostart
  regions: https://docs.fly.io/reference/regions
  postgres: https://docs.fly.io/postgres
  security: https://docs.fly.io/security/security-at-fly-io/
  compliance: https://fly.io/compliance/
read:
  - pay-as-you-go with no platform fee; Machines billed per second by CPU/RAM preset, stopped Machines billed for root filesystem only, volumes per provisioned GB
  - price differences between regions (regional multipliers) for Machines
  - outbound data transfer rate by region group, and that cross-region private traffic is billed while inbound and same-region traffic are not
  - dedicated IPv4 addresses and SSL certificates billed separately beyond the free allowance
  - trial terms (short runtime or day limit, whichever comes first, with caps on Machines and volume size); apps stop when the trial ends until billing is added
  - no hard spend cap and no billing alerts (overage is billed); a budget relies on watching the month-to-date bill
  - autostop settings in fly.toml (auto_stop_machines off/stop/suspend, min_machines_running); fly launch defaults scale to zero, a cold-start Risk
  - Managed Postgres plan kinds, storage metering, backups and HA, and the regions where it is offered; legacy unmanaged Fly Postgres clusters are the user's to operate
  - Machines and volumes are tied to the region they are created in; moving region means new Machines and volumes (fork or restore data)
  - certifications (SOC 2 Type 2, ISO 27001 datacenters), the HIPAA package with BAA, the DPA, and paid support plans
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date bill and the last invoice total for the organization?
    where: Dashboard → organization → Billing (invoices open in the Stripe portal via View)
  - metric: egress_gb
    ask: Outbound data transfer last month, by region group?
    where: Dashboard → organization → Billing → invoice line items for data transfer
  - metric: instances
    ask: How many Machines run per app, of which size, and in which regions?
    where: Dashboard → app → Machines; or `fly status` / `fly scale show`
  - metric: region
    ask: Primary region of each app and where its volumes and database live?
    where: primary_region in fly.toml; Dashboard → app → Volumes; `fly volumes list`
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set auto_stop_machines to stop or suspend with min_machines_running 0 for low-traffic apps, accepting cold starts (suspend resumes faster)
  - right-size Machine presets and run fewer Machines
  - put the app's primary_region next to the database and the users
  - release unused dedicated IPv4 addresses, volumes and snapshots
  - serve static assets from a CDN or object storage to cut outbound transfer
verified: 2026-10-07
---

- Fly.io is mostly detected from `fly.toml` (custom names via `fly deploy -c` are possible) and `FLY_*` names such as `FLY_API_TOKEN` in `.env` files. Most apps have no Fly SDK; `@fly/sprites` is the Sprites SDK, billed separately from Machines. A repo deployed from another directory may show nothing: ask the user.
- There is no spend cap or billing alert, so a traffic spike or a forgotten Machine becomes a Bill finding only at invoice time. Ask for the month-to-date bill.
- Managed Postgres and Upstash Redis on Fly leave no package or config signal (only a `DATABASE_URL` / `REDIS_URL` secret), so this map does not claim the `database` role. Ask where the database runs.
- `fly mcp server` (flyctl, experimental) exposes apps, machines, volumes, certs, IPs, orgs and secrets commands, including create, destroy and secrets set/list, with no read-only mode. Do not use it; ask the user for numbers instead.
- Fly.io plus a second hosting platform for the same app is Overlap unless split on purpose. primary_region and volume regions must match any data-region requirement.
