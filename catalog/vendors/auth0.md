---
schema: 1
id: auth0
name: Auth0
roles: [auth]
detect:
  packages: ["@auth0/", "auth0", "express-openid-connect"]
  pypi: ["auth0-python", "auth0-server-python", "auth0-fastapi", "auth0-api-python"]
  go: ["github.com/auth0/go-auth0", "github.com/auth0/go-jwt-middleware"]
  imports: ["@auth0/", "auth0", "express-openid-connect"]
  env_prefixes: ["AUTH0_", "NEXT_PUBLIC_AUTH0_"]
  config_files: []
pages:
  pricing: https://auth0.com/pricing
  billing: https://auth0.com/docs/troubleshoot/customer-support/operational-policies/billing-policy
  rate_limits: https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy
  regions: https://auth0.com/docs/get-started/auth0-overview/create-tenants
  security: https://security.okta.com/
  dpa: https://www.okta.com/legal/trustandcompliance/
read:
  - plan names (Free, Essentials, Professional, Enterprise) and the monthly active users included on each, separately for the B2C and B2B tracks
  - what counts as an active user (a unique user who authenticates in the calendar month, counted per tenant; refresh-token use does not add to the count) — a second production tenant counts its users again
  - how the price steps up between MAU brackets and from the top self-service bracket to Enterprise (the growth penalty), and whether yearly billing changes it
  - features locked behind plans or add-ons: MFA factors (Pro and Enterprise MFA), enterprise connections included per plan, Organizations, custom domains (a card on file is required even on Free)
  - Authentication API and Management API rate limits for the plan and tenant type (Free, self-service, Enterprise); Management API limits matter for user imports and admin scripts
  - SMS and email limits for passwordless and MFA on the built-in providers, and whether a custom provider is required in production
  - tenant regions offered (US, EU, AU, JP, UK, CA) and that a tenant's region is fixed at creation; moving means a new tenant and a user export and import
  - certifications on the Okta trust center (SOC 2, ISO 27001, HIPAA, PCI DSS), the DPA with SCCs, and the sub-processor list
usage_questions:
  - metric: mau
    ask: Active users last month, and the month before?
    where: Auth0 Support Center (support.auth0.com) → Reports → Usage → pick the subscription and tenant; Reports → Quota Utilization shows this month against the plan
  - metric: tenants
    ask: How many production tenants do you run (each counts its active users separately)?
    where: Dashboard → tenant name menu (top left) → Switch tenant
  - metric: features
    ask: Do you use or need MFA, enterprise connections, Organizations or a custom domain?
    where: Dashboard → Security → Multi-factor Auth; Authentication → Enterprise; Organizations; Branding → Custom Domains
mcp:
  official: true
  readonly_flag: "--read-only (or AUTH0_MCP_READ_ONLY=true) on the local @auth0/auth0-mcp-server; initialize it with --read-only --scopes 'read:*' so the Management API token cannot write either"
  allowed_tools: [auth0_list_applications, auth0_list_resource_servers, auth0_list_actions]
common_fixes:
  - check that the plan is not counting test or staging users in the production tenant; keep test traffic in a separate development tenant
  - confirm which paid features are in use (MFA factors, enterprise connections, Organizations) before upgrading a tier
  - cache Management API tokens and user lookups instead of calling the Management API on every request, to stay under its rate limit
  - pick the tenant region against the data residency requirement before launch, since it cannot be changed later
  - remove a second auth provider from the code if Auth0 is the one you keep (or the other way round)
verified: 2026-10-07
---

- Auth0 bills by monthly active users per tenant, in brackets. Moving up one bracket, or crossing from the top self-service bracket to Enterprise, can raise the bill much more than the user growth itself. Price the next two brackets from the page and put the bracket edge in revisit_when.
- Auth0 together with another auth provider (Clerk, Supabase Auth, Firebase Auth, NextAuth/Auth.js with its own user store) in the same codebase is an Overlap finding, unless one is a documented migration in progress.
- The Auth0 MCP server is official but in beta. Use it only in read-only mode and only for the listed tools. It has no tool that returns active-user counts, so ask the user for MAU from the Support Center report. Do not call `auth0_get_application` (it returns full client settings with the secret masked), `auth0_list_logs` or `auth0_get_log` (user emails and IPs).
- Security and legal documents now live on Okta pages (security.okta.com, okta.com legal). auth0.com/legal keeps only older versions of the DPA.
- `auth0` in env vars is common (AUTH0_SECRET, AUTH0_DOMAIN). Values are never read; the prefix only shows Auth0 is configured.
