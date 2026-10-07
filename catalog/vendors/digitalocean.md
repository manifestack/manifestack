---
schema: 1
id: digitalocean
name: DigitalOcean
roles: [hosting, storage, database]
detect:
  packages: ["@digitalocean/"]
  imports: ["@digitalocean/"]
  pypi: ["pydo"]
  go: ["github.com/digitalocean/godo"]
  env_prefixes: ["DIGITALOCEAN_", "SPACES_ACCESS_KEY_ID", "SPACES_SECRET_ACCESS_KEY", "SPACES_ENDPOINT_URL"]
  config_files: [".do/app.yaml", ".do/deploy.template.yaml"]
  role_signals:
    storage: ["digitaloceanspaces.com"]
    database: ["db.ondigitalocean.com"]
pages:
  pricing: https://www.digitalocean.com/pricing
  app_platform_pricing: https://docs.digitalocean.com/products/app-platform/details/pricing/
  app_platform_limits: https://docs.digitalocean.com/products/app-platform/details/limits/
  scale_to_zero: https://docs.digitalocean.com/products/app-platform/how-to/scale-to-zero/
  droplet_pricing: https://docs.digitalocean.com/products/droplets/details/pricing/
  bandwidth: https://docs.digitalocean.com/platform/billing/bandwidth/
  spend_alerts: https://docs.digitalocean.com/platform/billing/spend-alerts/
  billing: https://docs.digitalocean.com/platform/billing/
  spaces_pricing: https://docs.digitalocean.com/products/spaces/details/pricing/
  postgres_pricing: https://docs.digitalocean.com/products/databases/postgresql/details/pricing/
  postgres_limits: https://docs.digitalocean.com/products/databases/postgresql/details/limits/
  regions: https://docs.digitalocean.com/platform/regional-availability/
  change_app_region: https://docs.digitalocean.com/products/app-platform/how-to/change-region/
  move_droplet: https://docs.digitalocean.com/support/how-do-i-migrate-my-droplet-to-another-datacenter-region/
  security: https://www.digitalocean.com/trust
  certifications: https://www.digitalocean.com/trust/certification-reports
  hipaa: https://www.digitalocean.com/trust/hipaa-at-do
  dpa: https://www.digitalocean.com/legal/data-processing-agreement
read:
  - pay-as-you-go per product with no platform fee; App Platform containers billed by the second by instance size (shared or dedicated CPU), Droplets billed by the second (bundled CPU plans up to a monthly cap), managed databases by node plan plus extra storage
  - free options, i.e. a small number of static-site-only App Platform apps, plus signup credit for a new team; there is no free tier for services, workers, Droplets or managed databases
  - powered-off Droplets keep billing until they are destroyed; App Platform Scale to Zero (inactivity sleep) is a private preview, bills sleeping components at a reduced rate and adds a cold start
  - outbound transfer, i.e. Droplet allowances pool per team into a transfer pool, App Platform allowances pool across the team's apps, Spaces has its own allowance; overage is billed per GiB, inbound and VPC traffic are free, managed database traffic does not count
  - spend alerts email at percentage thresholds of a budget per team or organization and are not a spending cap; nothing stops resources when a budget is passed
  - Spaces subscription with included storage and transfer, the built-in CDN counting against that transfer, and per-unit overage
  - managed database plans (single node versus HA with standby nodes, read-only nodes, Standard versus Advanced Edition and announced plan changes), connection limits per plan, PITR window, and that dev databases on App Platform are PostgreSQL-only with a single database
  - datacenter regions and per-product availability; an App Platform region change redeploys the app and leaves its database behind, managed clusters can be relocated (not MongoDB), Droplets move only by snapshot and a new Droplet
  - certifications (SOC 2 Type II, SOC 3, PCI DSS SAQ-A, CSA STAR) and the HIPAA-eligible product list with a BAA on request; App Platform and Managed Databases are not on that list
  - the DPA is an addendum to the Customer Terms of Service and applies without a separate signature
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date charges and the last invoice total?
    where: Control Panel → Billing → Overview → Month-to-date Summary (cloud.digitalocean.com/account/billing); past invoices under Billing History
  - metric: transfer_tb
    ask: Droplet outbound transfer used against the team's pool this month, and App Platform or Spaces transfer lines on the last invoice?
    where: Control Panel → Billing → Droplet Transfer (Bandwidth) Overview; App Platform cumulative transfer is not shown, so read the invoice line items
  - metric: region
    ask: Which datacenter does each app, Droplet, database cluster and Spaces bucket use?
    where: Apps → app → Settings → App Spec (region field) or the Networking tab; Databases → cluster → Settings → Cluster datacenter; the Droplets and Spaces lists show the datacenter
  - metric: db_size
    ask: Database plan, node count and disk usage of each managed cluster?
    where: Databases → cluster → Overview → Insights tab (Disk usage); plan and nodes on the cluster's Overview
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - create spend alerts on the Billing page (Spend alerts tab), knowing they warn and do not cap
  - destroy unused Droplets instead of powering them off, and delete old snapshots and backups
  - right-size App Platform instance size and container count, and use autoscaling on dedicated CPU plans instead of a fixed high count
  - connect apps, Droplets and databases over the VPC network so traffic stays out of the transfer pool
  - serve static files from a static site component or Spaces with the CDN instead of a service container
  - keep the app, database and Spaces bucket in one datacenter region near the users
  - add a standby node or move to an HA plan before launch if the database needs failover, rather than switching providers
verified: 2026-10-07
---

- DigitalOcean is detected from `.do/app.yaml` (App Platform spec, the default path for local builds and `doctl`), `.do/deploy.template.yaml` (Deploy to DigitalOcean button), the `@digitalocean/` npm scope, `pydo`, `godo`, `DIGITALOCEAN_*` token names and the Terraform provider's `SPACES_*` names in `.env` files. A Droplet or an app created in the Control Panel leaves no trace in the repo: ask the user where the app runs. A `DIGITALOCEAN_*` token can also be for DNS or CI only.
- Spaces is S3-compatible, so the code uses an AWS S3 client; the `storage` role counts only when the `digitaloceanspaces.com` endpoint appears in the code. The `database` role counts only when a `db.ondigitalocean.com` host appears in the code; connection strings usually sit in `.env` values, which are never read, so ask where the database runs.
- App Platform transfer allowance and usage cannot be viewed in the Control Panel, so a bandwidth Bill finding has to come from invoice line items or the user.
- DigitalOcean MCP (local `@digitalocean/mcp` with `--services`, or per-service remote servers) marks tools with read-only hints but has no read-only mode; it includes create, delete and deploy tools, `apps-get-info` returns app environment variables and the database tools create users and handle connection credentials. A Read Only API token blocks writes but still exposes those secrets. Do not use it; ask the user for numbers instead.
- DigitalOcean plus a second hosting platform for the same app is Overlap unless split on purpose (for example Droplets for a worker and Vercel for the frontend). Spaces next to S3 or R2, or a managed database next to Supabase or Neon, is Overlap in the same way.
