---
# generated, edit catalog/vendors/adapty.md (then run: node tools/sync.mjs)
schema: 1
id: adapty
name: Adapty
roles: [payments]
detect:
  packages: ["react-native-adapty", "@adapty/", "adapty"]
  imports: ["react-native-adapty", "@adapty/"]
  pypi: []
  go: []
  env_prefixes: ["ADAPTY_", "EXPO_PUBLIC_ADAPTY_", "NEXT_PUBLIC_ADAPTY_", "VITE_ADAPTY_"]
  config_files: []
pages:
  pricing: https://adapty.io/pricing/
  billing: https://adapty.io/docs/account
  rate_limit: https://adapty.io/docs/ss-authorization
  analytics: https://adapty.io/docs/how-adapty-analytics-works
  revenue_chart: https://adapty.io/docs/revenue
  terms: https://adapty.io/terms/
  security: https://adapty.io/security-and-compliance/
  dpa: https://adapty.io/data-processing-agreement/
read:
  - pricing model kind - free up to a monthly revenue threshold, then a share of monthly tracked revenue on the Pro plan; Enterprise is custom pricing
  - what counts as revenue - subscriptions, renewals and one-time purchases tracked by Adapty, in USD, before Apple, Google or Stripe take their cut; below the threshold revenue is tracked on a rolling 30-day window, and the monthly billing cycle starts once it is crossed
  - what happens past the free threshold - billing starts automatically; if payment fails the SDK keeps working but dashboard access is restricted (pricing page), and the terms allow suspension for past-due accounts
  - plan features - paywall builder, A/B tests, analytics, integrations with analytics and attribution tools; which add-ons (Refund Saver, Adapty UA, Apple Ads Manager) are included under the threshold and priced separately above it; what Enterprise adds (SLA, dedicated support, custom data exports)
  - app store commission and web payment processor fees are separate and paid on top; Adapty's fee applies to the pre-commission amount
  - server-side API rate limits - assigned per API key, 429 responses, Retry-After header, and endpoint-specific lower limits
  - data hosting from the DPA subprocessor schedule (cloud providers and countries) and the transfer mechanism (Standard Contractual Clauses for EU, UK and Swiss data); no data residency option is stated on the security page
  - certifications (SOC 2 Type II; report under NDA), privacy laws covered (GDPR, UK GDPR, LGPD) and DPA
usage_questions:
  - metric: monthly_revenue
    ask: Gross revenue for the last 30 days, and the 30 days before?
    where: Adapty dashboard → Analytics → Analytics charts → Revenue (gross revenue view, the default)
  - metric: active_subscriptions
    ask: Active subscriptions today?
    where: Adapty dashboard → Analytics → Analytics charts → Active subscriptions
  - metric: monthly_bill
    ask: Last Adapty invoice total, and which paid add-ons are on?
    where: Adapty dashboard → Account (top right, app.adapty.io/account) → Subscription & Billing
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - add payment details before revenue crosses the free threshold so dashboard access is not restricted
  - turn off paid add-ons that the app does not use once revenue is above the threshold
  - compare the billed revenue with the Revenue chart in gross view; the fee base is pre-commission, so net proceeds are lower
  - keep one subscription backend per app; a second one (RevenueCat, a custom receipt server) tracks the same revenue twice
  - use webhooks or integrations instead of polling the server-side API, and back off on 429 responses using the Retry-After header
verified: 2026-10-07
---

- Revenue for billing is gross: before store commission and taxes. A Bill finding must compute Adapty's fee on gross revenue and treat Apple and Google commission as a separate cost. The Revenue chart defaults to gross and can switch to post-commission or post-commission-and-tax views; make sure the user reads the gross view.
- Adapty and RevenueCat in the same app is an Overlap finding (both are subscription backends billed on tracked revenue), unless one is a documented migration in progress.
- Detection covers React Native and Capacitor only (`react-native-adapty`, `@adapty/react-native-ui`, `@adapty/capacitor`, `@adapty/core`) plus the `adapty` developer CLI. Native iOS (`Adapty` in Podfile or Swift Package Manager), Android (`io.adapty` in Gradle), Flutter (`adapty_flutter` in pubspec.yaml), Kotlin Multiplatform and Unity apps are not read by Manifestack; look for `ADAPTY_` env vars or ask the user. There is no official Python or Go backend SDK; servers call the server-side API directly.
- No official MCP server for account data. The MCP server named in Adapty's docs is Context7, which serves documentation only. The Adapty developer CLI manages apps, products, paywalls and placements (read and write); do not run it. Ask the user for the numbers instead.
