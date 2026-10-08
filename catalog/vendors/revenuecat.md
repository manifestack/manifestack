---
schema: 1
id: revenuecat
name: RevenueCat
roles: [payments]
detect:
  packages: ["react-native-purchases", "react-native-purchases-ui", "react-native-purchases-store-galaxy", "cordova-plugin-purchases", "@revenuecat/"]
  imports: ["react-native-purchases", "react-native-purchases-ui", "cordova-plugin-purchases", "@revenuecat/"]
  pypi: []
  go: []
  env_prefixes: ["REVENUECAT_", "EXPO_PUBLIC_REVENUECAT_", "NEXT_PUBLIC_REVENUECAT_", "VITE_REVENUECAT_"]
  config_files: []
pages:
  pricing: https://www.revenuecat.com/pricing/
  billing: https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management
  rate_limit: https://www.revenuecat.com/docs/api-v2
  charts: https://www.revenuecat.com/docs/dashboard-and-metrics/charts
  revenue_chart: https://www.revenuecat.com/docs/dashboard-and-metrics/charts/revenue-chart
  security: https://www.revenuecat.com/security-and-compliance
  dpa: https://www.revenuecat.com/dpa
read:
  - pricing model kind - billed on Monthly Tracked Revenue (MTR); free up to a monthly tracked revenue threshold on the Pro plan, then a share of tracked revenue; Enterprise is custom pricing
  - what counts toward MTR - all purchases and renewals including non-subscription products, measured before store commission and taxes; annual and lifetime purchases count in full in the month they happen; billing periods run date to date, not calendar months
  - what happens past the free threshold - usage is billed, not blocked; new accounts get a grace period to add a payment method, after which charts, customer lists, experiments and paywalls are restricted until payment
  - plan features on the pricing page - paywalls and paywall editor, A/B experiments, charts, integrations (attribution, analytics, messaging), web-to-app funnels, webhooks - and the separate pricing for using growth tools without the subscription backend
  - app store fees (Apple, Google) and web payment processor fees are separate and are paid on top; RevenueCat's fee applies to the pre-commission amount
  - REST API v2 rate limits per endpoint domain (requests per minute), 429 responses and the Retry-After header
  - data hosting location and transfer mechanism from the DPA (cloud provider and country, Standard Contractual Clauses for EEA, UK and Swiss data)
  - certifications (SOC 2 Type II; report under NDA) and privacy laws covered (GDPR, UK GDPR, CCPA/CPRA, LGPD) and DPA
usage_questions:
  - metric: monthly_revenue
    ask: Monthly Tracked Revenue for the current billing period, and the previous one?
    where: Dashboard → account settings → Billing (app.revenuecat.com/settings/billing)
  - metric: active_subscriptions
    ask: Active subscriptions today, and three months ago for the trend?
    where: Dashboard → Charts → Active Subscriptions
  - metric: monthly_bill
    ask: Last RevenueCat invoice total?
    where: Dashboard → account settings → Billing (app.revenuecat.com/settings/billing)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - add a payment method before tracked revenue crosses the free threshold so charts, customer lists, experiments and paywalls stay available
  - compare the MTR on the Billing page with the Revenue chart set to gross revenue; MTR is counted before store commission, so net proceeds are lower than the billed base
  - keep one subscription backend per app; a second one (Adapty, a custom receipt server) tracks the same revenue twice
  - use webhooks instead of polling the REST API, and back off on 429 responses using the Retry-After header
  - ask RevenueCat sales about Enterprise terms once tracked revenue is high
verified: 2026-10-07
---

- MTR is gross: it is the amount charged to the customer before Apple, Google or Stripe take their cut and before taxes. A Bill finding must compute RevenueCat's fee on gross revenue and treat store commission as a separate cost.
- RevenueCat and Adapty in the same app is an Overlap finding (both are subscription backends billed on tracked revenue), unless one is a documented migration in progress. RevenueCat next to Stripe or Paddle is usually not an overlap: RevenueCat can sit on top of Stripe for web purchases; check how they are wired before reporting.
- Detection covers JavaScript only (React Native, Capacitor, Cordova, web). Native iOS (`RevenueCat` in Podfile or Swift Package Manager), Android (`com.revenuecat.purchases` in Gradle), Flutter (`purchases_flutter` in pubspec.yaml) and Unity apps are not read by Manifestack; look for `REVENUECAT_` env vars or ask the user. There is no official Python or Go backend SDK; servers call the REST API directly.
- Do not use the RevenueCat MCP server. It is official (remote `https://mcp.revenuecat.ai/mcp`, OAuth or an API v2 secret key) and has create, update and delete tools; a read-only API key limits it, but that is a key setting, not a server switch, and the skill never handles keys. Its read tools also return SDK API keys (`list-app-public-api-keys`) and customer data (`get-customer`, `list-customers`, `list-subscriptions`, `list-purchases`). Ask the user for the numbers instead.
