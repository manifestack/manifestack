---
# generated, edit catalog/vendors/sanity.md (then run: node tools/sync.mjs)
schema: 1
id: sanity
name: Sanity
roles: [cms]
detect:
  packages: ["sanity", "@sanity/", "next-sanity", "groq", "hydrogen-sanity", "@nuxtjs/sanity", "sanity-plugin-media"]
  go: ["github.com/sanity-io/client-go"]
  imports: ["sanity", "@sanity/", "next-sanity", "groq", "hydrogen-sanity", "@nuxtjs/sanity"]
  env_prefixes: ["SANITY_", "NEXT_PUBLIC_SANITY_", "PUBLIC_SANITY_", "EXPO_PUBLIC_SANITY_", "VITE_SANITY_", "NUXT_PUBLIC_SANITY_"]
  config_files: ["sanity.config.ts", "sanity.config.tsx", "sanity.config.js", "sanity.config.jsx", "sanity.cli.ts", "sanity.cli.js", "sanity.blueprint.ts", "sanity-typegen.json", "sanity.json"]
pages:
  pricing: https://www.sanity.io/pricing
  plans_quotas: https://www.sanity.io/docs/platform-management/plans-and-payments
  limits: https://www.sanity.io/docs/content-lake/technical-limits
  api_cdn: https://www.sanity.io/docs/content-lake/api-cdn
  live_content: https://www.sanity.io/docs/content-lake/live-content-api
  nextjs_client: https://www.sanity.io/docs/nextjs/configure-sanity-client-nextjs
  nextjs16_live: https://www.sanity.io/docs/help/nextjs-16-sanitylive-status
  addons: https://www.sanity.io/docs/platform-management/growth-plan-add-ons
  trial: https://www.sanity.io/docs/platform-management/growth-plan-trial
  ai_credits: https://www.sanity.io/docs/platform-management/how-ai-credits-work
  request_logs: https://www.sanity.io/docs/platform-management/request-logs
  webhooks: https://www.sanity.io/docs/content-lake/webhooks
  mcp: https://www.sanity.io/docs/ai/mcp-server
  security: https://www.sanity.io/security
  dpa: https://www.sanity.io/legal/dpa
  subprocessors: https://www.sanity.io/legal/third-party-sub-processors
read:
  - plans (Free, Growth per seat, Enterprise), seats and roles per plan (Viewers are free), the Startup and non-profit programs
  - quotas, i.e. documents (drafts, release versions and plugin documents count), datasets, API requests, API CDN requests, bandwidth (API, CDN and assets), assets, live connections, history retention, and AI credits and Functions per organization
  - what counts as a request, i.e. failed requests and Sanity's own apps do not, requests from Sanity Functions do; quotas reset on the 1st (UTC)
  - what happens at a limit, i.e. Free and the Growth trial stop public API and CDN requests with HTTP 402 (the site stops loading content) and block uploads; documents are capped on Growth too; Growth bills overage for requests, bandwidth and assets
  - Growth add-ons (increased quota, extra datasets, dedicated support) and Enterprise-only features (SSO, backups, Media Library, Content Releases)
  - the Growth trial ends on Free quotas and makes private datasets public
  - AI credits with an organization spending limit
  - hosted in the EU (Belgium) with API CDN locations worldwide and no self-serve region choice; SOC 2 Type 2, the click-through DPA; no Sanity HIPAA BAA documented
usage_questions:
  - metric: monthly_requests
    ask: API and API CDN requests this month and last month?
    where: sanity.io/manage → project → Usage (request logs downloadable at the bottom)
  - metric: egress_gb
    ask: Bandwidth and asset storage this month?
    where: sanity.io/manage → project → Usage
  - metric: seats
    ask: How many members hold a paid seat (not Viewer)?
    where: sanity.io/manage → project → Members
  - metric: monthly_bill
    ask: Plan, add-ons and the last invoice total?
    where: project → Plan; organization → Billing (admin or billing manager)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - read public content through the API CDN (useCdn true) and keep the live API for builds, webhooks and preview
  - render live content (SanityLive, listeners) only in draft mode; on next-sanity 12 with Next.js 16 upgrade to 13
  - keep query URLs stable (no timestamps or per-user parameters) so the CDN can cache them
  - filter webhooks to published documents so Studio edits do not trigger rebuilds on every keystroke
  - serve resized images with auto format instead of originals
  - give read-only people the free Viewer role, delete unused datasets and documents, and set an AI spending limit
verified: 2026-10-11
---

- Sanity is detected from `sanity` (Studio), `@sanity/`, `next-sanity`, `groq`, `hydrogen-sanity`, `@nuxtjs/sanity`, `client-go`, `SANITY_*` names and `sanity.config.*` / `sanity.cli.*` files. There is no official Python SDK (PyPI `sanity` is unrelated); `@portabletext/*` alone is not Sanity.
- Docs pages serve markdown at `<url>.md`; the index is `https://www.sanity.io/docs/llms.txt`. The pricing page and technical limits disagree on some Growth numbers; cite the pricing page.
- Request tags (`tag` in `@sanity/client`) and request logs show which code makes the requests.
- The Sanity MCP server (`https://mcp.sanity.io`) has no read-only mode and no usage tool: it creates and publishes documents, deploys schemas and Studios, creates projects with tokens and spends AI credits. Do not use it; ask the user for numbers instead.
- Sanity next to Contentful, Storyblok, Strapi or another CMS is Overlap unless split on purpose.
