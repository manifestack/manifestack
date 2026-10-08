---
# generated, edit catalog/vendors/posthog.md (then run: node tools/sync.mjs)
schema: 1
id: posthog
name: PostHog
roles: [monitoring]
detect:
  packages: ["posthog-js", "posthog-node", "posthog-react-native", "posthog-js-lite", "@posthog/"]
  pypi: ["posthog", "posthoganalytics"]
  go: ["github.com/posthog/posthog-go"]
  imports: ["posthog-js", "posthog-node", "posthog-react-native", "posthog-js-lite", "@posthog/"]
  env_prefixes: ["POSTHOG_", "NEXT_PUBLIC_POSTHOG_", "VITE_POSTHOG_", "VITE_PUBLIC_POSTHOG_", "EXPO_PUBLIC_POSTHOG_", "PUBLIC_POSTHOG_", "REACT_APP_POSTHOG_"]
  config_files: []
pages:
  pricing: https://posthog.com/pricing
  billing: https://posthog.com/docs/billing
  limits: https://posthog.com/docs/billing/limits-alerts
  replay_retention: https://posthog.com/docs/session-replay/recording-retention
  flag_costs: https://posthog.com/docs/feature-flags/cutting-costs
  regions: https://posthog.com/docs/privacy/data-storage
  projects: https://posthog.com/docs/settings/projects
  security: https://posthog.com/handbook/company/security
  trust: https://trust.posthog.com/
  hipaa: https://posthog.com/docs/privacy/hipaa-compliance
  dpa: https://posthog.com/dpa
read:
  - free monthly allowance per product (analytics events, session replay recordings, feature flag requests, exceptions, survey responses, data warehouse rows, logs) and that it resets monthly
  - free plan restrictions (number of projects, data retention, team members) and what needs a card on file
  - what happens at the free allowance or a billing limit (extra events permanently dropped, feature flags return a quota-limited response)
  - billing limits set per product, and the usage alert emails sent to organization owners
  - per-unit usage pricing past the free allowance and how volume tiers lower it
  - data retention for events and for recordings per plan (recording retention changes apply to new recordings only)
  - cloud region (US or EU) chosen when the organization is created; moving a project across regions needs a paid plan tier and PostHog engineers
  - certifications (SOC 2 Type II, GDPR, HIPAA with a BAA on specific plans), what a BAA excludes, and the DPA
usage_questions:
  - metric: monthly_events
    ask: Analytics events ingested this billing period and last month?
    where: Organization → Billing (app path /organization/billing), Product analytics usage
  - metric: monthly_recordings
    ask: Session replay recordings this billing period and last month?
    where: Organization → Billing, Session replay usage
  - metric: monthly_flag_requests
    ask: Feature flag requests this billing period?
    where: Organization → Billing, Feature flags usage
  - metric: region
    ask: Is the organization on US Cloud or EU Cloud?
    where: The app address the team logs in to (us.posthog.com or eu.posthog.com)
mcp:
  official: true
  readonly_flag: "readonly=true query parameter (or header x-posthog-read-only: true) on https://mcp.posthog.com/mcp, combined with a tools filter, e.g. https://mcp.posthog.com/mcp?readonly=true&tools=organization-get,billing-overview-get,billing-usage-summary-get,billing-usage-get,billing-usage-timeseries-get,billing-usage-status-get,billing-limits-get,billing-subscription-get,billing-forecast-get,billing-spend-summary-get,billing-projects-list,docs-search"
  allowed_tools: [organization-get, billing-overview-get, billing-usage-summary-get, billing-usage-get, billing-usage-timeseries-get, billing-usage-status-get, billing-limits-get, billing-subscription-get, billing-forecast-get, billing-spend-summary-get, billing-projects-list, docs-search]
common_fixes:
  - set a billing limit on every product, including ones not in use
  - sample session replay (sampling rate, minimum duration, URL or event triggers) instead of recording every session
  - send anonymous events without person profiles (person_profiles identified_only) and turn off autocapture events nobody uses
  - cut flag requests with local evaluation on servers, bootstrapping, and advanced_disable_feature_flags_on_first_load where flags are not needed at load
  - drop noisy exceptions and test traffic before they are sent
  - create the organization in the region the requirements ask for while data is small
verified: 2026-10-07
---

- At the free allowance or a billing limit, extra events are dropped for good and feature flags return a quota-limited response, so the app falls back to flag defaults. Treat a limit hit mid-month as both a blind spot and a product behavior change.
- Free organizations get one project; a separate staging project needs a paid plan. Cross-region project moves (US ↔ EU) are only done by PostHog engineers on higher tiers, so the region must match a data-region requirement from the start.
- MCP read-only mode is real: `readonly=true` (or the `x-posthog-read-only` header) removes every create, update and delete tool. Always pair it with the `tools` filter above so only billing and organization tools load; billing tools have no feature category, so `features=` alone does not expose them. Do not use `execute-sql`, `projects-get` (not needed, and project objects can include the project token) or `posthog-connection-forward`.
- PostHog error tracking next to Sentry, PostHog session replay next to Sentry Session Replay, or PostHog feature flags next to another flag service is a candidate Overlap. Confirm in the code that both tools do the same job (PostHog is often there only for product analytics) and ask the user before reporting it.
- A BAA does not cover the managed reverse proxy or PostHog AI features; a HIPAA requirement means those stay off.
