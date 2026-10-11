---
# generated, edit catalog/vendors/mixpanel.md (then run: node tools/sync.mjs)
schema: 1
id: mixpanel
name: Mixpanel
roles: [analytics, flags]
detect:
  packages: ["mixpanel-browser", "mixpanel", "mixpanel-react-native", "@mixpanel/"]
  pypi: ["mixpanel", "mixpanel-py", "mixpanel-utils", "mixpanel-openfeature"]
  go: ["github.com/mixpanel/mixpanel-go"]
  imports: ["mixpanel-browser", "mixpanel", "mixpanel-react-native", "@mixpanel/"]
  env_prefixes: ["MIXPANEL_", "NEXT_PUBLIC_MIXPANEL_", "VITE_MIXPANEL_", "VITE_PUBLIC_MIXPANEL_", "EXPO_PUBLIC_MIXPANEL_", "PUBLIC_MIXPANEL_", "REACT_APP_MIXPANEL_", "NUXT_PUBLIC_MIXPANEL_"]
  config_files: []
  role_signals:
    flags: ["mixpanel.flags.", ".local_flags.", ".remote_flags.", "LocalFlagsConfig", "RemoteFlagsConfig", "WithLocalFlags", "WithRemoteFlags", "featureFlagsOptions", "@mixpanel/openfeature-", "mixpanel_openfeature"]
pages:
  pricing: https://mixpanel.com/pricing/
  billing: https://docs.mixpanel.com/docs/pricing
  session_replay: https://docs.mixpanel.com/docs/session-replay
  experiments: https://docs.mixpanel.com/docs/experiments
  feature_flags: https://docs.mixpanel.com/docs/featureflags
  autocapture: https://docs.mixpanel.com/docs/tracking-methods/autocapture
  bot_traffic: https://docs.mixpanel.com/docs/tracking-best-practices/bot-traffic
  rate_limits: https://docs.mixpanel.com/reference/rate-limits
  projects: https://docs.mixpanel.com/docs/orgs-and-projects/managing-projects
  eu_residency: https://docs.mixpanel.com/docs/privacy/eu-residency
  retention: https://docs.mixpanel.com/docs/privacy/gdpr-compliance#data-retention-policy
  startup_program: https://docs.mixpanel.com/docs/pricing/startup-program
  mcp: https://docs.mixpanel.com/docs/mcp
  security: https://mixpanel.com/legal/security-overview/
  dpa: https://mixpanel.com/legal/dpa/
  hipaa: https://mixpanel.com/legal/mixpanel-hipaa/
read:
  - plans (Free, Growth, Enterprise; MTU billing on Enterprise only) and the monthly events included; events are summed across every project in the organization; identify, merge, alias, opt-in and profile updates are not billed
  - what happens past the allowance, i.e. Free keeps collecting but locks reports until an upgrade or the next month; Growth bills overage the next month; no billing limit, only alert emails
  - per-plan quotas, i.e. seats, saved reports, session replays, Experiments users (MEU), active feature flags, alerts; past them replays cannot be viewed and Experiments pause on Free
  - events billed by ingestion time, so backfills and warehouse mirror updates count in the month they arrive
  - add-ons (Group Analytics, Data Pipelines, Metric Trees, replay volume) and the uplift they add to overage
  - event retention (shorter for projects created after September 2025) and replay retention
  - data residency (US, EU, India) per project, fixed at creation
  - SOC 2 Type II, ISO 27001 and 27701, the DPA, the HIPAA BAA on Enterprise; the Startup Program
usage_questions:
  - metric: monthly_events
    ask: Events this billing period and last, against the plan?
    where: Organization Settings → Plan Details & Billing (usage, Data Usage → View Historical Usage); Owner or Billing Admin
  - metric: monthly_replays
    ask: Session replays and Experiments users this period?
    where: Organization Settings → Plan Details & Billing
  - metric: monthly_bill
    ask: Plan, overage rate and the last invoice?
    where: Plan Details & Billing → Manage Billing & Payment
  - metric: region
    ask: Where is each project stored?
    where: Project Settings → Overview (Data Residency), or the app host (eu., in.)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - turn off or narrow autocapture, and sample session replay well below 100 percent (the quick-start snippet turns everything on)
  - block noisy events in Lexicon (hiding does not stop ingestion) and find the top events by name first
  - mark bot and internal traffic with $ignore, and keep test traffic out of the organization's projects
  - avoid tracking the same event from the client and the server, or set the same insert ID
  - pick a plan tier that covers the expected volume at the start of the period, since there is no spending cap
  - create projects in the region the requirements ask for; residency cannot be changed
verified: 2026-10-11
---

- Mixpanel is detected from `mixpanel-browser`, `mixpanel` (Node and Python), `mixpanel-react-native`, `@mixpanel/` (OpenFeature providers, replay), `mixpanel-go` and `MIXPANEL_*` names. Sites that load the HTML snippet, Google Tag Manager or Segment leave no package: ask.
- The `flags` role counts only when the code reads Mixpanel feature flags; next to LaunchDarkly or PostHog flags that is a candidate Overlap.
- Sending to `api.mixpanel.com` from an EU or India project ingests nothing; check the API host in the code against the project's region. Docs pages serve markdown at `<url>.md`.
- The Mixpanel MCP server (`https://mcp.mixpanel.com/mcp`, EU and India hosts) has no read-only mode (scopes are by area, not by read or write) and no billing tool; it edits dashboards, cohorts, flags and experiments. Do not use it; ask the user for numbers instead.
- Mixpanel next to PostHog or Amplitude is Overlap unless split on purpose. Mixpanel fed by Segment is not.
