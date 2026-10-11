---
schema: 1
id: strapi
name: Strapi
roles: [cms]
detect:
  packages: ["@strapi/", "@strapi-enterprise/", "strapi", "create-strapi-app", "@nuxtjs/strapi", "strapi-sdk-js", "gatsby-source-strapi"]
  imports: ["@strapi/", "@strapi-enterprise/", "strapi-sdk-js"]
  env_prefixes: ["STRAPI_", "NEXT_PUBLIC_STRAPI_", "PUBLIC_STRAPI_", "VITE_STRAPI_", "NUXT_PUBLIC_STRAPI_", "GATSBY_STRAPI_", "API_TOKEN_SALT", "ADMIN_JWT_SECRET", "TRANSFER_TOKEN_SALT"]
  config_files: [".strapi-cloud.json", "src/admin/app.example.tsx", "types/generated/contentTypes.d.ts"]
pages:
  pricing: https://strapi.io/pricing-cloud
  cms_pricing: https://strapi.io/pricing-cms
  usage_billing: https://docs.strapi.io/cloud/getting-started/usage-billing
  fair_use: https://strapi.io/cloud-legal
  observability: https://docs.strapi.io/cloud/projects/observability
  project_settings: https://docs.strapi.io/cloud/projects/settings
  regions: https://docs.strapi.io/cloud/getting-started/deployment
  caching: https://docs.strapi.io/cloud/getting-started/caching
  upload_provider: https://docs.strapi.io/cloud/advanced/upload
  external_database: https://docs.strapi.io/cloud/advanced/database
  billing_portal: https://docs.strapi.io/cms/billing-portal
  enterprise_plugins: https://docs.strapi.io/cms/plugins/installing-enterprise-plugins
  free_plan_removal: https://strapi.io/blog/we-re-removing-the-free-plan-from-strapi-cloud
  mcp: https://docs.strapi.io/cms/features/strapi-mcp-server
  security: https://strapi.io/security
read:
  - where Strapi runs decides the bill, i.e. Strapi Cloud (plans per project), self-hosted Community (free, the bill is the host and database), or a paid self-hosted license (Growth per seat, Enterprise)
  - Cloud plans (Starter, Pro, Business) per project, monthly or yearly; there is no free Cloud plan any more
  - Cloud quotas, i.e. API requests per project per month (REST and GraphQL, every response counts), asset storage per environment, asset bandwidth, database entries under a fair-use storage cap, emails, environments, backups, log retention
  - what happens at a Cloud limit, i.e. overage is billed monthly for requests, bandwidth and storage (not blocked, not prorated, also charged when a project is deleted); fair use allows throttling
  - Starter sleeps when idle (cold starts); only Business has an SLA
  - extra environments as a paid add-on, each with its own asset storage
  - Cloud region (US, Europe, Asia) fixed at creation; media URLs stay on strapiapp.com even with a custom domain
  - license features, i.e. Growth (Releases, Content History, Live Preview, Strapi AI credits, SSO add-on) and Enterprise (SSO, Review Workflows, Audit Logs)
  - SOC 2, the DPA in the Cloud legal terms
usage_questions:
  - metric: api_requests_month
    ask: Cloud API requests this month against the plan, and the top endpoints?
    where: cloud.strapi.io → project → Observability (Summary, Traffic insights)
  - metric: transfer_tb
    ask: Asset bandwidth and storage per environment this month, and the top assets?
    where: cloud.strapi.io → project → Observability
  - metric: monthly_bill
    ask: Cloud plan, billing cycle and this month's overage; or the self-hosted license tier and seats?
    where: project → Settings → Billing & Invoices and Plans; billing.strapi.io → Subscriptions for licenses
  - metric: region
    ask: Which region does the Cloud project use?
    where: project → Settings → General
mcp:
  official: true
  readonly_flag: "the MCP server built into the user's own Strapi (mcp.enabled in config/server, served at <strapi-url>/mcp) with an Admin token that has only the upload read permission"
  allowed_tools: [media_list_assets, media_list_folders]
common_fixes:
  - build pages statically or cache server-side fetches, set Cache-Control, and use webhooks instead of polling
  - check the top endpoints and top assets in Observability before upgrading
  - serve resized images through the frontend optimizer or a CDN, or move uploads to an S3 or Cloudinary provider
  - delete stale environments; each adds an add-on fee and its own storage
  - avoid Starter for a production API that cannot take cold starts
  - on self-hosted, pay for a license only if Growth or Enterprise features are actually used
verified: 2026-10-11
---

- Strapi is detected from `@strapi/` (the server `@strapi/strapi`, the `@strapi/client` frontend client, upload providers), `@strapi-enterprise/` (Enterprise plugins), community clients, `STRAPI_*` and Strapi's own secret names (`API_TOKEN_SALT`, `ADMIN_JWT_SECRET`), and generated files. `@strapi/plugin-cloud` is added to every new project and proves nothing.
- Strapi Cloud shows as a committed `.strapi-cloud.json`, `strapiapp.com` or `media.strapiapp.com` in frontend code or config (image remote patterns), or no host config for the CMS folder. A Dockerfile or host config around the CMS folder, `DATABASE_*` names or a non-local upload provider mean self-hosted: Strapi then costs nothing, so audit the host and database. Ask when unsure.
- A paid license shows as a `STRAPI_LICENSE` name, `@strapi-enterprise/` packages or SSO providers in the admin config; confirm at billing.strapi.io. A scaffolded trial `license.txt` can become a Growth subscription.
- The built-in MCP server has no usage or billing tool; content tools (`list_*`, `get_*`) return customer content, so call only the media list tools, for asset counts and sizes.
- Strapi next to Contentful, Sanity, Storyblok or another CMS is Overlap unless split on purpose.
