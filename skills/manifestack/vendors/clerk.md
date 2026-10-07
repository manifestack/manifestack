---
# generated, edit catalog/vendors/clerk.md (then run: node tools/sync.mjs)
schema: 1
id: clerk
name: Clerk
roles: [auth]
detect:
  packages: ["@clerk/"]
  pypi: ["clerk-backend-api"]
  go: ["github.com/clerk/clerk-sdk-go"]
  imports: ["@clerk/"]
  env_prefixes: ["CLERK_", "NEXT_PUBLIC_CLERK_", "VITE_CLERK_", "EXPO_PUBLIC_CLERK_", "PUBLIC_CLERK_"]
  config_files: []
pages:
  pricing: https://clerk.com/pricing
  limits: https://clerk.com/docs/guides/how-clerk-works/system-limits
  security: https://clerk.com/security
  dpa: https://clerk.com/legal/dpa
read:
  - the billed user metric and how it is counted (Clerk bills monthly retained users, MRU, not every sign-up)
  - users included on the free plan and on Pro, and the price per extra user
  - which features need a paid plan or add-on (MFA, enterprise SSO, removing branding, organizations)
  - Backend API rate limits per plan (they matter on launch day)
  - where user data is hosted and whether data residency is offered
  - certifications (SOC 2 Type 2, HIPAA with BAA on Enterprise), DPA and Data Privacy Framework status
usage_questions:
  - metric: mau
    ask: Monthly retained users (MRU) last month?
    where: Dashboard → application → Overview (or workspace Billing) — check the label, it may say MRU
  - metric: features
    ask: Do you use or need MFA, enterprise SSO or organizations?
    where: Dashboard → application → Configure
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - confirm which paid features are actually used before upgrading
  - remove a second auth provider from the code if Clerk is the one you keep (or the other way round)
  - check data residency against the requirements before launch, not after
verified: 2026-10-07
---

- Clerk publishes no region page. If Requirements say "EU data", treat the region as unverified and point the user to the DPA and Clerk support; do not assume.
- The dashboard path for MRU changes between versions; if the user cannot find it, ask for the number from the latest invoice.
