---
# generated, edit catalog/vendors/cloudinary.md (then run: node tools/sync.mjs)
schema: 1
id: cloudinary
name: Cloudinary
roles: [storage]
detect:
  packages: ["cloudinary", "@cloudinary/", "next-cloudinary", "cloudinary-core", "cloudinary-react", "astro-cloudinary", "svelte-cloudinary"]
  imports: ["cloudinary", "@cloudinary/", "next-cloudinary", "cloudinary-core", "cloudinary-react"]
  pypi: ["cloudinary", "django-cloudinary-storage"]
  go: ["github.com/cloudinary/cloudinary-go"]
  env_prefixes: ["CLOUDINARY_", "NEXT_PUBLIC_CLOUDINARY_"]
  config_files: []
pages:
  pricing: https://cloudinary.com/pricing
  compare_plans: https://cloudinary.com/pricing/compare-plans
  credits: https://cloudinary.com/documentation/developer_onboarding_faq_credits
  limits: https://cloudinary.com/documentation/billing_and_plans
  usage_reports: https://cloudinary.com/documentation/programmable_media_asset_usage_data
  usage_spike: https://cloudinary.com/documentation/ts_usage_spike
  regions: https://cloudinary.com/documentation/developer_onboarding_faq_storage
  security: https://cloudinary.com/trust
  dpa: https://cloudinary.com/gdpr/dpa
read:
  - monthly credits on Free, Plus and Advanced, and what one credit buys (transformations, managed storage, image bandwidth, video bandwidth, which differs between Free and paid plans)
  - how credits are consumed: one pool shared by transformations, storage and bandwidth; video transformations counted per second by resolution; storage includes originals, cached derived versions and backups
  - the counting window (transformations and bandwidth over a rolling 30 days, storage as the current total), so a spike keeps counting for weeks
  - per-file limits by plan (max image, video and raw file size, image megapixels) and Admin API rate limits
  - what happens past the credits (soft limits, email warnings, repeated upgrade prompts, account eventually disabled) and whether paid plans add overage or only push an upgrade
  - add-ons with their own quotas, which stop at a hard limit instead of using credits
  - usage alerts by email near the limit and the opt-in monthly usage report
  - backups count as storage on Free; paid plans can back up to the customer's own bucket
  - storage location (US by default; EU or AP data centers only on Enterprise and set when the account is created)
  - certifications (SOC 2 Type II, ISO 27001), data transfer terms (SCCs, Data Privacy Framework) and which agreement the DPA attaches to
usage_questions:
  - metric: credits_used
    ask: Credits used in the last 30 days, split into transformations, storage and bandwidth?
    where: Cloudinary Console → Home → Dashboard (plan usage), or Settings → Billing → Plans Details
  - metric: transformations
    ask: Transformations in the last 30 days, and which URLs or presets create the most?
    where: Cloudinary Console → Home → Usage Reports (trend) and Home → Delivery Reports (top transformations and assets)
  - metric: storage_gb
    ask: Storage today, including derived versions and backups?
    where: Cloudinary Console → Home → Usage Reports → Storage
  - metric: transfer_tb
    ask: Bandwidth in the last 30 days?
    where: Cloudinary Console → Home → Usage Reports → Bandwidth
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - use a small fixed set of named transformations instead of building transformation URLs per request, and turn on strict transformations so unknown variants are not generated
  - add f_auto and q_auto to delivery URLs to cut bandwidth on every image
  - limit eager transformations in upload presets to the sizes the site really shows
  - delete unused originals and stale derived versions, and turn backups off or point them at your own bucket where the plan allows
  - put a CDN or long cache headers in front of delivery URLs so repeat views do not count again at the origin
  - cap upload size and dimensions in the upload widget or preset so huge originals do not fill storage
  - look at Delivery Reports before upgrading: a one-off spike ages out of the rolling 30-day window
verified: 2026-10-07
---

- One credit pool covers transformations, storage and bandwidth, so a traffic spike or a deploy that changes transformation URLs eats the same credits as stored files. Ask for the credit breakdown, not just storage, before calling the plan sufficient.
- Limits are soft: Cloudinary warns and asks for an upgrade, and the account can eventually be disabled, which stops image delivery for the whole site. For a commercial site on Free this is a Risk finding.
- EU or AP storage is Enterprise-only and fixed at account creation. If the requirements ask for EU data, a self-service plan does not meet them. The DPA attaches to a subscription agreement and order form; confirm it covers a self-service account.
- Official MCP servers exist (`@cloudinary/asset-management-mcp`, `environment-config`, `structured-metadata`, `analysis`, remote at `*.mcp.cloudinary.com`). They take the API key and secret and can upload, delete and change presets and webhooks; `--tool` and `--scope` filters exist but there is no documented read-only mode. Do not use them in the MVP; ask the user for numbers instead.
- Overlap: Cloudinary and another file store (Supabase Storage, S3, R2, UploadThing) holding the same user files. Cloudinary can also fetch from an existing bucket (auto-upload mapping), which keeps a copy in both places.
