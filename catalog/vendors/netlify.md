---
schema: 1
id: netlify
name: Netlify
roles: [hosting]
detect:
  packages: ["netlify-cli", "netlify", "@netlify/"]
  go: ["github.com/netlify/open-api"]
  imports: ["@netlify/"]
  env_prefixes: ["NETLIFY_"]
  config_files: ["netlify.toml"]
pages:
  pricing: https://www.netlify.com/pricing/
  limits: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
  credits: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
  monitor_usage: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/
  billing_faq: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/
  paused_projects: https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/
  legacy_plans: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-for-legacy-plans/
  regions: https://docs.netlify.com/build/functions/configuration/
  security: https://www.netlify.com/trust-center/
  dpa: https://www.netlify.com/pdf/netlify-dpa.pdf
read:
  - which pricing model the team is on (credit-based for accounts created since the switch; Legacy plans keep bandwidth, build minutes and function quotas)
  - credits included per month on Free, Personal and Pro, and the credit cost of each meter (production deploys, web requests, bandwidth, compute, AI inference)
  - what is not metered (deploy previews, branch deploys, failed deploys, rollbacks)
  - what happens when credits run out (all projects paused with a "Site not available" page until the next cycle; Free cannot buy more credits)
  - auto recharge and credit packs on paid plans (off by default), and rollover rules
  - usage notifications at set percentages of the monthly credits; the AI credit usage limit
  - Legacy plans: overage model (metered add-ons upgraded automatically) and that switching to credits cannot be undone
  - commercial-use terms on Free (none stated on the plan pages at last check) and other Free limits (one owner, concurrent builds)
  - functions region (default and the self-serve list); it can be changed and applies to new deploys
  - certifications (SOC 2 Type 2, ISO 27001/27018, PCI DSS, HIPAA) and the DPA
usage_questions:
  - metric: credits_used
    ask: Credits used last month and by which meter (bandwidth, web requests, compute, deploys)?
    where: Netlify → team → Usage & billing → Credit usage breakdown
  - metric: transfer_tb
    ask: Bandwidth last month?
    where: Netlify → team → Usage & billing → Account usage insights
  - metric: billing_plan
    ask: Which plan is the team on (Legacy or credit-based), and is auto recharge on?
    where: Netlify → team → Usage & billing → Plan details (auto recharge under Credit balance)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - batch changes into fewer production deploys and use deploy previews for review, since production deploys cost credits and previews do not
  - set cache headers on static files and use the CDN cache for generated pages to cut web requests and function compute
  - serve resized images through Netlify Image CDN instead of full-size originals to cut bandwidth
  - set the functions region next to the database
  - decide on auto recharge on purpose: off means projects pause at the limit, on means the bill grows with traffic
  - move a launched project off Free before the expected traffic, since Free cannot buy extra credits
verified: 2026-10-08
---

- Running out of credits pauses every project on the team, not just the busy one. For a commercial site on Free or on a paid plan with auto recharge off, that is a Requirement or Bill finding.
- Legacy-plan teams are billed on bandwidth, build minutes and function quotas with automatic add-ons. Ask which model the team uses before reading the pricing page.
- The Netlify MCP server (`@netlify/mcp`, remote at `netlify-mcp.netlify.app`) is official but has no read-only mode: it creates and deploys projects, changes access controls and manages environment variables and secrets. Do not use it; ask the user for numbers instead.
- Netlify also offers Blobs and a database product. This map covers hosting only; if `@netlify/blobs` or Netlify Database is used, treat it as storage or database through Netlify and check for Overlap with other vendors.
