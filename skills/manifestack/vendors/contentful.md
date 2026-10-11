---
# generated, edit catalog/vendors/contentful.md (then run: node tools/sync.mjs)
schema: 1
id: contentful
name: Contentful
roles: [cms]
detect:
  packages: ["contentful", "contentful-management", "@contentful/", "contentful-cli", "contentful-migration", "contentful-import", "contentful-export", "create-contentful-app", "gatsby-source-contentful"]
  pypi: ["contentful", "contentful_management"]
  imports: ["contentful", "contentful-management", "@contentful/", "contentful-migration", "contentful-import", "contentful-export"]
  env_prefixes: ["CONTENTFUL_", "NEXT_PUBLIC_CONTENTFUL_", "VITE_CONTENTFUL_", "GATSBY_CONTENTFUL_", "PUBLIC_CONTENTFUL_", "NUXT_PUBLIC_CONTENTFUL_"]
  config_files: [".contentfulrc.json", ".contentful.json"]
pages:
  pricing: https://www.contentful.com/pricing/
  usage_limits: https://www.contentful.com/help/admin/usage/usage-limit/
  technical_limits: https://www.contentful.com/developers/docs/platform/technical-limits/
  asset_bandwidth: https://www.contentful.com/help/admin/usage/asset-bandwidth/
  usage_alerts: https://www.contentful.com/help/admin/usage/usage-alerts/
  free_enforcement: https://www.contentful.com/developers/changelog/enforcing-asset-bandwidth-and-api-limits-for-free-users/
  space_add_ons: https://www.contentful.com/help/admin/manage-space-add-ons/
  preview_api: https://www.contentful.com/developers/docs/references/content-preview-api/overview/
  regions: https://www.contentful.com/developers/docs/platform/eu-data-residency/
  mcp: https://www.contentful.com/developers/docs/mcp/model-context-protocol-mcp-server/
  security: https://www.contentful.com/security/
  dpa: https://www.contentful.com/legal/privacy-and-data-protection/data-processing-addendum-for-customers/
  subprocessors: https://www.contentful.com/legal/privacy-and-data-protection/sub-processors/
read:
  - plans (Free, Lite, Premium or Enterprise) and space types (Starter, Lite Space, Standard, Enterprise), with add-ons (Personalization, AI Actions, Studio, space add-ons)
  - organization quotas, i.e. total API calls per month (delivery, preview, management and GraphQL together), asset bandwidth, users, roles, locales, spaces, Function executions, AI units
  - space quotas, i.e. content types, environments, records (entries plus assets), workflows; creating past a space quota is blocked until the space is upgraded or an add-on bought
  - what happens at a limit, i.e. Free pauses the delivery and preview APIs until next month; Lite bills overage per million API calls and per GB with no cap; Premium has no API-call overage but technical limits and bandwidth overage
  - Free is for testing only, commercial use is not allowed
  - rate limits per second for each API by plan, and that CDN cache hits are not rate-limited
  - the billing month starts on the signup or contract day; trial spaces count toward usage
  - US by default; EU data residency is a Premium add-on chosen per organization
  - ISO 27001, SOC 2 Type 2, PCI DSS SAQ A, TISAX, the DPA and the sub-processor list; no HIPAA BAA documented
usage_questions:
  - metric: monthly_api_calls
    ask: Total API calls this billing period and last, by API?
    where: Organization settings & subscriptions → Usage (owners and admins only)
  - metric: transfer
    ask: Asset bandwidth this period, and the top assets by bandwidth?
    where: Organization settings & subscriptions → Usage → Asset Bandwidth (per space, Top assets)
  - metric: records
    ask: Records, environments and locales per space against the space limits?
    where: Organization settings & subscriptions → Subscription (per space)
  - metric: monthly_bill
    ask: Current plan, space licenses and the last invoice total?
    where: Organization settings & subscriptions → Subscription and billing
mcp:
  official: true
  readonly_flag: "remote server https://mcp.contentful.com/mcp (EU: mcp.eu.contentful.com/mcp) with every tool category set to read-only in the Contentful MCP app configuration of the environment; the local @contentful/mcp-server has no read-only mode"
  allowed_tools: [list_orgs, get_org, list_spaces, get_space, list_environments, list_locales, list_content_types, get_content_type, list_tags, get_usages]
common_fixes:
  - fetch content at build time or on the server with caching and webhook revalidation, not from the browser on every page view
  - use the preview API only behind draft mode, never in the production build
  - request images in modern formats and sizes from the Images API, and check the top assets by bandwidth
  - use webhooks or sync tokens instead of polling for changes
  - delete stale environments and unused records, and use environment aliases
  - move a commercial site off Free before launch, and watch the usage alerts on Lite, which has no cap
verified: 2026-10-11
---

- Contentful is detected from `contentful`, `contentful-management`, `@contentful/`, its CLI and migration tools, `gatsby-source-contentful` (maintained by Gatsby), the Python SDKs, `CONTENTFUL_*` names and `.contentfulrc.json` (which holds a management token: never read it). `@contentful/app-sdk` or `@contentful/f36-*` alone mean the repo is a Contentful App, not a site using Contentful content: ask.
- `www.contentful.com` answers automated requests with a bot checkpoint (429). Docs pages also serve markdown at `<url>.md`, which loads more often; otherwise ask the user to paste the plan table.
- Salesforce completed its acquisition of Contentful on 2026-09-01; plans may change. Note it as a Risk for a long-term decision.
- Even with read-only tools, do not call `search_entries`, `get_entry`, `get_asset` (customer content), `list_content_previews` or `get_entry_preview_url` (preview secrets), or `export_space`. `get_usages` needs an Org Admin or Owner and may be missing on the remote server.
- Contentful next to Sanity, Storyblok, Strapi or another CMS is Overlap unless split on purpose.
