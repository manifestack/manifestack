---
schema: 1
id: cloudflare
name: Cloudflare
roles: [hosting, storage, database]
detect:
  packages: ["wrangler", "@cloudflare/", "@opennextjs/cloudflare"]
  pypi: ["cloudflare", "workers-py", "langchain-cloudflare"]
  go: ["github.com/cloudflare/cloudflare-go"]
  imports: ["cloudflare:", "@cloudflare/", "@opennextjs/cloudflare"]
  env_prefixes: ["CLOUDFLARE_", "CF_"]
  config_files: ["wrangler.toml", "wrangler.json", "wrangler.jsonc"]
  role_signals:
    storage: ["R2Bucket", "KVNamespace", "r2.cloudflarestorage.com"]
    database: ["D1Database", "drizzle-orm/d1", "@prisma/adapter-d1", "kysely-d1"]
pages:
  pricing: https://developers.cloudflare.com/workers/platform/pricing/
  workers_limits: https://developers.cloudflare.com/workers/platform/limits/
  pages_limits: https://developers.cloudflare.com/pages/platform/limits/
  r2_pricing: https://developers.cloudflare.com/r2/pricing/
  kv_pricing: https://developers.cloudflare.com/kv/platform/pricing/
  kv_limits: https://developers.cloudflare.com/kv/platform/limits/
  d1_pricing: https://developers.cloudflare.com/d1/platform/pricing/
  d1_limits: https://developers.cloudflare.com/d1/platform/limits/
  billing: https://developers.cloudflare.com/billing/understand/usage-based-billing/
  budget_alerts: https://developers.cloudflare.com/billing/manage/budget-alerts/
  r2_data_location: https://developers.cloudflare.com/r2/reference/data-location/
  d1_data_location: https://developers.cloudflare.com/d1/configuration/data-location/
  security: https://www.cloudflare.com/trust-hub/compliance-resources/
  dpa: https://www.cloudflare.com/cloudflare-customer-dpa/
read:
  - Workers Free quota kinds (requests per day, CPU time per invocation) and what happens past the daily request limit (error 1027, or the Worker is bypassed when the route is set to fail open)
  - Workers Paid monthly minimum, included requests and CPU time, and the overage rate per unit; static asset requests are not billed
  - Pages Functions are billed as Workers and count toward the same request quota; Pages build and file limits
  - KV free daily reads, writes, deletes and list requests, stored data, and overage rates on Paid
  - D1 rows read, rows written and storage included per plan; on Free, queries fail once the daily limit is hit and writes stop at the storage limit
  - R2 storage, Class A and Class B operations included and their rates; egress has no charge
  - billing is usage-based in arrears; budget alerts send email only and do not pause or cap usage
  - commercial-use terms on the Free plan (none stated on the pricing page at last check)
  - data location: R2 and D1 jurisdictions (EU, US, FedRAMP) and location hints are set at creation and cannot be changed later
  - certifications listed on the compliance page and the customer DPA
usage_questions:
  - metric: workers_requests
    ask: Worker requests per day at peak and for the last month?
    where: Dashboard → Workers & Pages → Overview → select the Worker → Metrics
  - metric: d1_rows_read
    ask: D1 rows read and written last month, and the database size?
    where: Dashboard → D1 → select the database → Metrics
  - metric: storage_gb
    ask: R2 storage size and Class A / Class B operations last month?
    where: Dashboard → R2 object storage → select the bucket → Metrics
  - metric: monthly_bill
    ask: Usage-based spend this billing period and the last invoice total?
    where: Dashboard → Manage Account → Billing → Billable Usage (invoices under Billing → Invoices and documents)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - serve static files as Workers Static Assets instead of from Worker code, since static asset requests are not billed
  - cache responses with Cache Rules or the Cache API so repeated requests skip the Worker and the database
  - add indexes to D1 tables, because rows read counts every scanned row, not just returned rows
  - cache hot KV reads with cacheTtl and avoid writing the same key in a loop
  - set the route failure mode on purpose (fail open or fail closed) for the Free daily limit
  - create a budget alert on the account, and move a production Worker to Workers Paid before it reaches the Free daily limit
  - create R2 buckets and D1 databases in the required jurisdiction while data is small
verified: 2026-10-07
---

- Cloudflare has several official MCP servers. The Cloudflare API server (`mcp.cloudflare.com`) exposes an `execute` tool that can call any API endpoint, including writes; the product servers (Workers Bindings, Builds, Observability and others) also act on the account. None has a server-side read-only mode; access is limited only by the scopes of the token or OAuth grant. Do not use them in the MVP; ask the user for numbers instead.
- R2 egress has no charge. For a project that serves large files to many users, compare it with S3-style storage on egress as a Fit note, not as a ranking.
- Hosting has no code signal: any Cloudflare signature (wrangler config, `CF_` env var) counts as hosting. If the project only uses R2 through the S3 SDK, say so and drop hosting from the findings.
- Free-plan limits are per day (reset daily), while Paid quotas are per month. Use the matching window when you compare usage with a limit.
- Cloudflare D1 and another database (Supabase, Neon, Firebase) in the same code is an Overlap finding.
