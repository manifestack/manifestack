---
# generated, edit catalog/vendors/workos.md (then run: node tools/sync.mjs)
schema: 1
id: workos
name: WorkOS
roles: [auth]
detect:
  packages: ["@workos-inc/", "@workos-inc/node", "@workos-inc/authkit-nextjs", "@workos-inc/authkit-react", "@workos-inc/authkit-js", "@workos-inc/authkit-remix", "@workos-inc/authkit-react-router", "@workos-inc/widgets"]
  imports: ["@workos-inc/"]
  env_prefixes: ["WORKOS_", "NEXT_PUBLIC_WORKOS_", "VITE_WORKOS_"]
  config_files: []
  pypi: ["workos"]
  go: ["github.com/workos/workos-go"]
pages:
  pricing: https://workos.com/pricing
  billing: https://workos.com/docs/dashboard/billing
  environments: https://workos.com/docs/authkit/environments
  rate_limits: https://workos.com/docs/reference/rate-limits
  security: https://workos.com/security
  dpa: https://workos.com/legal/data-processing-addendum
read:
  - AuthKit price unit (monthly active users, defined as a user who signs up, signs in or updates a profile in the calendar month), the free MAU allowance and the per-bracket price above it
  - Single Sign-On and Directory Sync priced per connection per month, with volume bands; one enterprise customer usually means one SSO connection and one directory, so the bill grows with enterprise customers, not users
  - other metered line items the code may use (Audit Logs log streams and event retention, Radar checks, custom domain, monthly tracked agents) and whether they appear on the pricing page
  - what AuthKit includes without an add-on (email and password, social login, passkeys, MFA, magic auth, Organizations, Admin Portal) and what the Enterprise plan adds (uptime SLA, onboarding, pre-pay discounts)
  - only production environments are billed; staging is free but has no custom domain and cannot be promoted to production
  - rate limit kinds - per API key, per SSO connection and per directory, AuthKit reads and writes per environment, per email or challenge for authentication flows, per IP on hosted AuthKit - and Retry-After handling
  - data location (the DPA names the United States; no regional hosting choice is documented) and SCCs for EU, Swiss and UK transfers
  - certifications on the security page (SOC 2 Type 2, GDPR, CCPA, penetration tests) and whether a HIPAA BAA needs an enterprise plan
usage_questions:
  - metric: mau
    ask: AuthKit monthly active users this month, and last month's invoice?
    where: WorkOS Dashboard → Settings → Workspace → Billing → Current usage; past months under View payment history
  - metric: sso_connections
    ask: How many active SSO connections and Directory Sync directories in production?
    where: WorkOS Dashboard → Settings → Workspace → Billing → Current usage (connection counts line items)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - keep test and demo connections in the staging environment, which is not billed
  - delete SSO connections and directories of churned customers in production so they stop counting
  - put the per-connection price into the enterprise plan price so each new SSO customer pays for its connection
  - cache sessions and user lookups instead of calling the API on every request, and back off with Retry-After on rate limit errors
  - remove a second auth provider from the code if WorkOS is the one you keep (or the other way round)
verified: 2026-10-07
---

- WorkOS is a B2B fit question. AuthKit MAU cost is rarely the issue; the per-connection price for SSO and Directory Sync is. If the requirements mention enterprise customers, SSO or SCIM, price the expected number of connections from the page and put the next volume band in revisit_when. For a consumer app with no SSO needs, WorkOS mostly adds an enterprise feature set that is not used.
- WorkOS together with another auth provider (Auth0, Clerk, Supabase Auth, Firebase Auth, NextAuth/Auth.js with its own user store) is an Overlap finding, unless it is deliberate - for example WorkOS used only for enterprise SSO behind an existing login, or a documented migration.
- Data residency: the DPA names the United States as the data location and no EU region is documented. For an "EU data stays in the EU" Requirement this is a Requirement-type finding unless the user accepts SCC-based transfers.
- The official MCP server (remote, `mcp.workos.com`, OAuth) has no read-only switch; it inherits the dashboard role of the signing-in user, and its tool names are not documented. It manages users and organizations, so do not use it. Ask the user for numbers from the Billing page.
- The trust center (trust.workos.com) renders with JavaScript and the sub-processor link redirects there; if it does not load as text, use the security page and the DPA. The `workos` npm package is the official CLI, not an SDK, so it is not a detection signal on its own.
