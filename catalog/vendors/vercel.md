---
schema: 1
id: vercel
name: Vercel
roles: [hosting, storage]
detect:
  packages: ["vercel", "@vercel/"]
  pypi: ["vercel", "vercel-sandbox", "vercel-queue", "vercel-workflow", "vercel-cache", "vercel-oidc", "vercel-headers", "vercel-connect"]
  imports: ["@vercel/"]
  env_prefixes: ["VERCEL_", "NEXT_PUBLIC_VERCEL_", "BLOB_READ_WRITE_TOKEN"]
  config_files: ["vercel.json", "vercel.ts", "vercel.toml"]
  role_signals:
    storage: ["@vercel/blob"]
pages:
  pricing: https://vercel.com/pricing
  limits: https://vercel.com/docs/limits
  hobby: https://vercel.com/docs/plans/hobby
  regions: https://vercel.com/docs/regions
  flat_rate_cdn: https://vercel.com/docs/pricing/flat-rate-cdn
  spend_management: https://vercel.com/docs/spend-management
  security: https://vercel.com/security
  dpa: https://vercel.com/legal/dpa
read:
  - Hobby is for personal, non-commercial use only (a commercial project on Hobby is a Requirement finding)
  - Fast Data Transfer included per plan and the overage rate per GB
  - Flat Rate CDN tiers on Pro (fixed monthly price for CDN requests and data transfer) and who is not eligible; compare the tier that fits with the on-demand overage before reporting a transfer Bill
  - Fast Origin Transfer and Edge/CDN requests included and overage rates
  - Function invocations, Active CPU hours and provisioned memory included and overage rates
  - Image transformations and image cache reads/writes included
  - Pro price per seat and the included usage credit
  - what happens past a Hobby limit (features paused, typically until the 30-day window resets)
  - Spend Management on Pro: the default on-demand budget, whether reaching it pauses production deployments, and that paused projects must be resumed by hand
  - compute regions and the default function region
  - certifications (SOC 2 Type 2, ISO 27001, PCI DSS, HIPAA on Enterprise) and DPA
usage_questions:
  - metric: transfer_tb
    ask: Fast Data Transfer last month (and the month before, for the trend)?
    where: Dashboard → team → Usage → Networking → Fast Data Transfer
  - metric: cdn_requests
    ask: CDN requests last month? (decides which Flat Rate CDN tier fits)
    where: Dashboard → team → Usage → CDN Requests
  - metric: function_invocations
    ask: Function invocations last month?
    where: Dashboard → team → Usage → Functions → Invocations
  - metric: cpu_hours
    ask: Active CPU hours last month?
    where: Dashboard → team → Usage → Functions → Active CPU
  - metric: seats
    ask: How many team members deploy or need dashboard access?
    where: Dashboard → team → Settings → Members
  - metric: monthly_bill
    ask: Last invoice total?
    where: Dashboard → team → Settings → Billing → Invoices
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - cache static and generated assets at the edge (Cache-Control, ISR) to cut Fast Data Transfer and invocations
  - move large media to a storage bucket or image CDN instead of serving it through functions
  - set the function region next to the database
  - turn on Spend Management with a limit and alerts on Pro
  - move a commercial project from Hobby to Pro before launch
verified: 2026-10-07
---

- Usage is per team; filter the Usage page by project to see one app.
- Overage rates differ by region. Note the region of the traffic when you compute a Bill finding.
- Vercel MCP (`mcp.vercel.com`) has write tools (deployments, file uploads, purchases) and no read-only mode. Do not use it in the MVP; ask the user for numbers instead.
- `@vercel/kv` and `@vercel/postgres` are deprecated and now backed by Upstash and Neon. If you see them, the database vendor is Upstash or Neon, billed through Vercel Marketplace.
