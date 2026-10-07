---
schema: 1
id: convex
name: Convex
roles: [database]
detect:
  packages: ["convex", "@convex-dev/", "convex-helpers"]
  pypi: ["convex"]
  go: []
  imports: ["convex/", "@convex-dev/", "convex-helpers"]
  env_prefixes: ["CONVEX_", "NEXT_PUBLIC_CONVEX_", "VITE_CONVEX_", "EXPO_PUBLIC_CONVEX_", "PUBLIC_CONVEX_"]
  config_files: ["convex.json", "convex/schema.ts", "convex/_generated/api.d.ts"]
pages:
  pricing: https://www.convex.dev/pricing
  pricing_faq: https://www.convex.dev/pricing/faq
  limits: https://docs.convex.dev/production/state/limits
  usage_limits: https://docs.convex.dev/production/usage-limits
  spending_limits: https://docs.convex.dev/dashboard/teams
  regions: https://docs.convex.dev/production/regions
  security: https://www.convex.dev/security
  dpa: https://www.convex.dev/legal/dpa
  mcp: https://docs.convex.dev/ai/convex-mcp-server
read:
  - Free plan quota kinds (function calls, action compute, database storage, database I/O, file storage, search storage and queries, data egress, deployments, developers) and that usage is counted per team across all projects
  - what happens over a Free limit (warning emails, then function calls may return errors and new writes may fail; written data is not deleted)
  - Starter pay-as-you-go rates per unit past the free amounts, the Professional plan price (per developer) and included quotas, and which plans list HIPAA and SOC 2 reports
  - team spending limits (warning and disable thresholds; at the disable threshold every project in the team stops running functions) and per-deployment usage limits by day or month
  - per-function and per-transaction limits (execution time, documents and bytes read or written, concurrency per plan) that fail single requests before any quota is reached
  - regions offered, the surcharge for regions outside the US, and that a deployment's region cannot be changed (move by export and import)
  - certifications (SOC 2 Type II, HIPAA with a BAA, GDPR) and the DPA
usage_questions:
  - metric: function_invocations
    ask: Function calls, action compute and database I/O this month, and the split by project?
    where: dashboard.convex.dev → Team Settings → Usage (daily breakdown and usage by project)
  - metric: db_size
    ask: Database storage and file storage today?
    where: dashboard.convex.dev → Team Settings → Usage
  - metric: monthly_bill
    ask: Which plan is the team on, last invoice, and is a spending limit set?
    where: dashboard.convex.dev → Team Settings → Billing (plan, invoices, spending limits)
  - metric: region
    ask: Which region is the production deployment in?
    where: dashboard.convex.dev → open the production deployment (region shown with the deployment); team default region in Team Settings
mcp:
  official: true
  readonly_flag: "npx convex mcp start --disable-tools data,run,runOneoffQuery,logs,envGet,envList,envSet,envRemove, with neither --dangerously-enable-production-deployments nor --cautiously-allow-production-pii; status then lists the production deployment as readOnly: true. Without --disable-tools every tool works on dev deployments"
  allowed_tools: [status, tables, functionSpec, insights]
common_fixes:
  - add indexes and use withIndex instead of filter so queries read fewer documents and less database I/O
  - paginate large queries instead of collecting whole tables
  - move heavy or repeated work out of reactive queries that rerun on every change, and avoid subscribing to data that changes often
  - store large blobs in file storage instead of in documents
  - set usage limits on dev and preview deployments, and a team spending limit with a warning threshold
  - create the production deployment in the region the requirements ask for while data is small
verified: 2026-10-07
---

- Usage counts per team, not per project: one busy prototype uses the same Free quota as production. Reactive queries rerun when the data they read changes, so database I/O and function calls grow with active sessions and write rate, not only with user count.
- Free has hard caps (function calls fail when a cap is passed for some time). Paid plans keep serving and bill metered overage unless a spending limit is set, and hitting the disable threshold stops every project in the team at once. Treat it as a deliberate choice.
- Convex also ships auth (`@convex-dev/auth`, or `@convex-dev/better-auth`) and file storage, but this map claims only `database`. Convex Auth next to Clerk or Auth0, or Convex file storage next to S3 or R2, can be an Overlap; ask which one is live. `@convex-dev/r2` is the Convex component for Cloudflare R2: the files are billed by Cloudflare.
- MCP: by default the server cannot run production writes or read production data or env vars. On prod, `status`, `tables` (schemas only), `functionSpec` and `insights` expose no user data. Add `--disable-tools` because dev deployments allow every tool, including `run` and `envSet`. Never pass the two production flags. `insights` is not available when the server runs with `CONVEX_DEPLOY_KEY`.
- `convex` on PyPI is the official Python client. There is no official Go module. A self-hosted Convex backend (`CONVEX_SELF_HOSTED_URL`) is not billed by Convex; read the host's pricing instead.
