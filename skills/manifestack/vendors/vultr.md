---
# generated, edit catalog/vendors/vultr.md (then run: node tools/sync.mjs)
schema: 1
id: vultr
name: Vultr
roles: [hosting, storage, database, ai]
detect:
  packages: ["@vultr/"]
  imports: ["@vultr/"]
  pypi: ["vultr-model-catalog"]
  go: ["github.com/vultr/govultr"]
  env_prefixes: ["VULTR_"]
  config_files: []
  role_signals:
    storage: ["vultrobjects.com"]
    database: ["vultrdb.com"]
    ai: ["api.vultrinference.com"]
pages:
  pricing: https://www.vultr.com/pricing/
  plans_api: https://api.vultr.com/v2/plans
  plans_metal_api: https://api.vultr.com/v2/plans-metal
  regions_api: https://api.vultr.com/v2/regions
  server_billing: https://docs.vultr.com/support/platform/billing/how-am-i-billed-for-my-servers
  stopped_instances: https://docs.vultr.com/support/platform/billing/are-stopped-instances-still-billed-on-vultr
  regional_pricing: https://docs.vultr.com/support/platform/billing/is-pricing-the-same-in-all-data-center-locations
  bandwidth_caps: https://docs.vultr.com/support/platform/billing/how-are-bandwidth-caps-calculated
  bandwidth_overage: https://docs.vultr.com/support/platform/billing/what-is-the-bandwidth-overage-rate
  backups: https://docs.vultr.com/support/platform/billing/how-much-does-it-cost-to-enable-automatic-backups
  snapshots: https://docs.vultr.com/support/platform/billing/does-vultr-charge-for-stored-snapshots
  account_limits: https://docs.vultr.com/platform/billing/manage-account-limits
  notifications: https://docs.vultr.com/platform/other/manage-notifications
  object_storage_billing: https://docs.vultr.com/support/platform/billing/how-is-object-storage-billed
  object_storage_limits: https://docs.vultr.com/products/storage/object-storage/limits
  database_faq: https://docs.vultr.com/products/storage/databases/postgresql/faq
  inference_faq: https://docs.vultr.com/products/compute/serverless-inference/faq
  security: https://docs.vultr.com/platform/iam/other/compliance/vultr-compliance
  certifications: https://docs.vultr.com/support/platform/compliance/how-can-i-access-vultrs-compliance-reports
  dpa: https://docs.vultr.com/support/platform/compliance/does-vultr-offer-a-data-processing-addendum
read:
  - pay-as-you-go per product with no platform fee; servers (Cloud Compute, Optimized, Bare Metal, GPU) billed hourly from deploy up to a monthly cap of hours, invoiced on the 1st
  - plan prices, included bandwidth and the regions each plan is sold in from the plans API (monthly_cost, hourly_cost, bandwidth in GB, locations); prices can differ by region
  - the free plan in the plans API (its regions) and that it needs an approved Free Tier application; otherwise there is no free tier
  - stopped instances and Bare Metal keep billing until destroyed; snapshots bill per GB-month and automatic backups add a percentage of the instance price
  - outbound transfer, i.e. an account-wide monthly free allowance plus each running instance's share accrued hourly, overage per GB as soon as the allocated amount is passed, no carry-over
  - no dollar spend alert or spending cap; email notifications cover bandwidth usage and new invoices only, and account limits cap instance count and maximum instance cost, raised through a reviewed request
  - Object Storage tiers with included storage and transfer, per-GB overage, the request rate and bucket limits, and that a tier cannot be changed in place
  - managed database plans (Hobbyist, Startup, Business, Premium), PITR window per plan, replica nodes, and that scaling down needs a fork or migration to a smaller cluster
  - Serverless Inference subscription with included tokens and per-token overage, and that it supports only Chat Completions from the OpenAI API
  - regions and per-region options (Kubernetes, load balancers, block storage) from the regions API; servers and clusters stay in their region, moving means a snapshot or fork in the new one
  - certifications (SOC 2 Type II with HIPAA Security Rule, ISO 27001, 27017, 27018, 20000-1, PCI) with reports in the Console, and the DPA signed on request through a ticket
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date charges and the last invoice total?
    where: Console → Account → Billing → History (balance and charges this month); invoice line items open from each invoice
  - metric: transfer_tb
    ask: Outbound transfer this month against the allocated amount, and any overage?
    where: Console → Account → Billing → Bandwidth Usage (current and previous cycle, top subscriptions, overage)
  - metric: instances
    ask: How many instances and Bare Metal servers run, on which plans, including stopped ones?
    where: Console → Compute (the list shows plan, region and status)
  - metric: region
    ask: Which region does each instance, database cluster and Object Storage subscription use?
    where: the Compute and Databases lists show the location; Object Storage → subscription shows its hostname (region prefix)
  - metric: db_size
    ask: Database plan, node count and disk usage of each managed cluster?
    where: Console → Databases → cluster → Overview (plan, nodes, disk usage)
mcp:
  official: true
  readonly_flag: "always read-only: the hosted server https://mcp.vultr.com/mcp (OAuth, one organization per sign-in) has no write, key or IAM tools; /mcp/account or another area endpoint narrows the list"
  allowed_tools: [vultr_account_get, vultr_account_bandwidth_get, vultr_account_billing_history_list, vultr_account_invoices_list, vultr_account_invoice_items_list, vultr_account_pending_charges_list, vultr_compute_instances_list, vultr_compute_baremetal_list, vultr_database_clusters_list, vultr_database_usage_get, vultr_storage_object_storage_list, vultr_storage_blocks_list, vultr_kubernetes_clusters_list, vultr_inference_usage_get, vultr_catalog_regions_list]
common_fixes:
  - destroy stopped instances and Bare Metal servers that are not coming back, after a snapshot if the data matters, and delete old snapshots
  - right-size the plan or move a steady workload to a plan whose included bandwidth covers its traffic
  - keep instances, the database and Object Storage in one region and connect them over a VPC
  - serve static files from Object Storage or the CDN instead of an instance
  - turn off automatic backups on stateless instances that can be rebuilt
  - turn on Bandwidth Usage notifications (Manage User → Preferences → Notification Preferences), knowing they do not watch the bill
verified: 2026-10-11
---

- Vultr is detected from the `@vultr/` npm scope (`@vultr/vultr-node`, `@vultr/model-catalog`), `govultr`, `vultr-model-catalog` and `VULTR_*` names such as `VULTR_API_KEY` or `VULTR_INFERENCE_API_KEY` in `.env` files. There is no official Python API SDK, and Terraform (`vultr/vultr` provider) or `vultr-cli` leave no file this map can match. Most servers are created in the Console: ask the user where the app runs. A `VULTR_*` key can also be for DNS or CI only.
- `www.vultr.com` (the pricing page) answers automated requests with a bot challenge. Read plan prices and regions from `api.vultr.com/v2/plans`, `/v2/plans-metal` and `/v2/regions`, which are public JSON, and the docs pages for the rest; for Object Storage, database or inference prices that only the pricing page has, ask the user to paste the table.
- Object Storage is S3-compatible, so the code uses an AWS S3 client; the `storage` role counts only when a `vultrobjects.com` endpoint appears in the code. The `database` role counts only when a `vultrdb.com` host appears; connection strings usually sit in `.env` values, which are never read, so ask. Serverless Inference is used through the OpenAI SDK, so the `ai` role counts only when `api.vultrinference.com` appears.
- Vultr MCP (official, Preview) is read-only by design and strips passwords, S3 keys, the inference API key and kubeconfig from its answers. Each sign-in covers one organization: ask which one before reading numbers. Call only the tools listed above.
- Vultr plus a second hosting platform for the same app is Overlap unless split on purpose. Object Storage next to S3 or R2, or a managed database next to Supabase or Neon, is Overlap in the same way.
