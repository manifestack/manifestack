---
# generated, edit catalog/vendors/storyblok.md (then run: node tools/sync.mjs)
schema: 1
id: storyblok
name: Storyblok
roles: [cms]
detect:
  packages: ["@storyblok/", "storyblok-js-client", "storyblok", "gatsby-source-storyblok", "storyblok-react", "storyblok-vue", "storyblok-nuxt"]
  pypi: ["storyblok", "storyblok-richtext"]
  imports: ["@storyblok/", "storyblok-js-client", "gatsby-source-storyblok", "storyblok-react", "storyblok-vue", "storyblok-nuxt"]
  env_prefixes: ["STORYBLOK_", "NEXT_PUBLIC_STORYBLOK_", "VITE_STORYBLOK_", "NUXT_PUBLIC_STORYBLOK_", "PUBLIC_STORYBLOK_", "REACT_APP_STORYBLOK_"]
  config_files: ["storyblok.config.ts", "storyblok.config.js", "storyblok.config.mjs", "storyblok.config.json", "storyblok-components.d.ts"]
pages:
  pricing: https://www.storyblok.com/pricing
  technical_limits: https://www.storyblok.com/pricing/technical-limits
  pricing_faq: https://www.storyblok.com/pricing/pricing-faq
  factsheet: https://a.storyblok.com/f/88751/x/010505f975/storyblok-pricing-plan-factsheet.pdf
  overage_fees: https://a.storyblok.com/f/88751/x/f0b81d3677/2025-overage-fee-one-pager.pdf
  traffic: https://www.storyblok.com/docs/concepts/traffic
  caching: https://www.storyblok.com/docs/concepts/caching
  delivery_api: https://www.storyblok.com/docs/api/content-delivery/v2
  fair_use: https://www.storyblok.com/faq/what-is-fair-normal-use-vs-abusive-use
  spaces_regions: https://www.storyblok.com/docs/manuals/spaces
  space_dashboard: https://www.storyblok.com/docs/manuals/space-dashboard
  mcp: https://www.storyblok.com/docs/tooling/mcp-server
  security: https://www.storyblok.com/trust-center/security
  dpa: https://www.storyblok.com/legal/dpa
read:
  - plans per space (Starter free, Growth, Growth Plus, Premium, Elite), with included seats and a seat maximum; each paid space is its own subscription
  - quotas, i.e. API requests per month, monthly traffic, seats, stories, assets, locales, AI credits, and rate limits for cached and uncached delivery requests
  - what counts as traffic, i.e. delivery and GraphQL responses (cached or not), every Image Service variation, webhook payloads; the factsheet and the docs disagree on management API traffic, cite the docs
  - what happens at a limit, i.e. self-serve plans buy add-on packs up to a plan maximum and then must upgrade; traffic packs are charged each time the limit is crossed; Starter cannot buy API packs; there is no cap, a breach fee and a surcharge after two months over, and no configurable usage alerts
  - extra seats billed when added (annual plans for the whole year)
  - region chosen per space at creation (EU default, US, CA, AP, China); a guaranteed data center is Premium and Elite only
  - ISO 27001, TISAX, the DPA and the Data Privacy Framework; no SOC 2 report or HIPAA BAA documented
usage_questions:
  - metric: monthly_api_requests
    ask: API requests this month and last month, per space?
    where: Space → Dashboard → usage (API); Organization → Dashboard → traffic
  - metric: transfer_tb
    ask: Monthly traffic, and which assets use the most?
    where: Organization → Dashboard → monthly traffic; Space → Dashboard → usage (traffic, per asset)
  - metric: seats
    ask: Seats in use per space?
    where: Space → Settings → users
  - metric: monthly_bill
    ask: Plan per space and the expected overage?
    where: Space → Settings → Subscription (plan and overage estimate, without seats and traffic)
mcp:
  official: true
  readonly_flag: "read-only permissions for selected spaces on the OAuth consent screen of https://mcp.storyblok.com/mcp, or a personal access token with read scopes only"
  allowed_tools: [search, describe, execute_readonly]
common_fixes:
  - pass the cv value the API returns (updated by webhook) instead of a timestamp, so requests are served from the CDN
  - request draft content only in preview environments; published content is cached, drafts are not
  - set a TTL on the public token for high-traffic sites, and fetch many stories per request in static builds
  - exclude unused fields and filter on the API instead of in the frontend
  - serve sized WebP images from the Image Service and large videos from your own host
  - remove unused collaborators and downgrade or delete spaces nobody uses
  - upgrade before a limit is crossed, since traffic packs are charged automatically and overage has no cap
verified: 2026-10-11
---

- Storyblok is detected from `@storyblok/`, `storyblok-js-client`, the `storyblok` CLI, older `storyblok-*` and Gatsby packages, `STORYBLOK_*` names and CLI files (`storyblok.config.*`, `storyblok-components.d.ts`). The API host in the code shows the region (`api-us`, `api-ca`, `api-ap`, `storyblokchina.cn`).
- `support.storyblok.com` answers automated requests with a challenge; docs pages serve markdown at `<url>.md`. The overage one-pager and the pricing page disagree on Growth Plus add-ons; cite the pricing page and technical limits.
- On the MCP server, `execute_readonly` runs any GET: never request space API keys, the space object (it holds the preview token and billing address) or collaborators. Statistics need a token with the Statistics scope.
- Storyblok next to Contentful, Sanity, Strapi or another CMS is Overlap unless split on purpose.
