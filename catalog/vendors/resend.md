---
schema: 1
id: resend
name: Resend
roles: [email]
detect:
  packages: ["resend"]
  pypi: ["resend"]
  go: ["github.com/resend/resend-go"]
  imports: ["resend"]
  env_prefixes: ["RESEND_"]
  config_files: []
pages:
  pricing: https://resend.com/pricing
  limits: https://resend.com/docs/knowledge-base/account-quotas-and-limits
  rate_limit: https://resend.com/docs/api-reference/rate-limit
  regions: https://resend.com/docs/dashboard/domains/regions
  security: https://resend.com/security
  dpa: https://resend.com/legal/dpa
read:
  - Free monthly quota and daily quota (a daily cap is a launch-day Risk)
  - Pro and Scale monthly quotas and prices, and whether a daily limit applies
  - what happens past the quota (overage, cap, sending stops)
  - API rate limit per second
  - domains included per plan
  - bounce and spam rate thresholds that pause sending
  - sending regions (chosen per domain)
  - certifications (SOC 2 Type II), GDPR and DPA
usage_questions:
  - metric: monthly_sent
    ask: Emails sent last month, and the month before?
    where: Dashboard → Settings → Usage (or Emails, filtered by month)
  - metric: daily_peak
    ask: Most emails sent in one day (or expected on launch day)?
    where: Dashboard → Metrics → Emails, daily view
  - metric: domains
    ask: How many sending domains?
    where: Dashboard → Domains
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - batch digests and notifications instead of one email per event
  - warm up and schedule launch-day sends within the daily quota
  - keep bounce and spam rates under the thresholds (verify lists, double opt-in)
  - plan the next tier before the month the quota runs out
verified: 2026-10-08
---

- `resend` matches a common English word in imports; trust the package.json entry first.
- Resend MCP sends email and manages keys and domains, and has no read-only mode. Do not use it; ask the user for numbers instead.
