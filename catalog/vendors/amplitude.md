---
schema: 1
id: amplitude
name: Amplitude
roles: [analytics, flags]
detect:
  packages: ["@amplitude/", "amplitude-js"]
  pypi: ["amplitude-analytics", "amplitude-experiment", "amplitude-ai", "amplitude"]
  go: ["github.com/amplitude/analytics-go", "github.com/amplitude/experiment-go-server"]
  imports: ["@amplitude/", "amplitude-js"]
  env_prefixes: ["AMPLITUDE_", "NEXT_PUBLIC_AMPLITUDE_", "VITE_AMPLITUDE_", "VITE_PUBLIC_AMPLITUDE_", "REACT_APP_AMPLITUDE_", "PUBLIC_AMPLITUDE_", "NUXT_PUBLIC_AMPLITUDE_", "EXPO_PUBLIC_AMPLITUDE_", "NG_APP_AMPLITUDE_"]
  config_files: ["ampli.json"]
  role_signals:
    flags: ["@amplitude/experiment-", "@amplitude/plugin-experiment-", "amplitude_experiment", "experiment-go-server", "Experiment.initialize", "experimentPlugin(", "experiment()?.variant(", "experiment().variant("]
pages:
  pricing: https://amplitude.com/pricing
  plans_faq: https://amplitude.com/docs/faq/billing-and-plans
  plus_terms: https://amplitude.com/plus-plan-terms
  limits: https://amplitude.com/docs/faq/limits-and-quotas
  mtu: https://amplitude.com/docs/admin/billing-use/mtu-guide
  replay_quota: https://amplitude.com/docs/session-replay/configure-sampling
  experiment_events: https://amplitude.com/docs/feature-experiment/under-the-hood/event-tracking
  web_experiment: https://amplitude.com/docs/web-experiment/tracking
  bots: https://amplitude.com/docs/data/block-bot-traffic
  regions: https://amplitude.com/docs/get-started/create-a-new-account
  startups: https://amplitude.com/startups
  mcp: https://amplitude.com/docs/amplitude-ai/amplitude-mcp
  security: https://trust.amplitude.com/
  privacy: https://amplitude.com/security-and-privacy
  dpa: https://amplitude.com/terms/dpa
read:
  - plans (Free, Plus, Growth, Enterprise, Startups) and whether the contract bills events or MTUs; included volume, the Plus volume ceiling and the events-per-MTU guardrail on MTU contracts
  - what counts, i.e. all ingested events including hidden and backfilled ones; blocked or deleted events, identify calls, Experiment exposure and assignment events and replay-captured events do not; an MTU is a user or device ID with an event in the month
  - what happens past the allowance, i.e. Free is blocked after the third month over and deleted later; Plus bills overage and may be suspended far above the purchased volume; alert emails on paid plans, no cap
  - Session Replay quota per organization (capture stops at the quota) and retention
  - active experiments per plan (flags are unlimited), Web Experiment impressions
  - projects, saved charts, cohorts, data history and per-project limits on event types and properties
  - region (US or EU) chosen when the organization is created and fixed
  - SOC 2 Type II, ISO 27001, 27017 and 27018, the HIPAA BAA, the DPA
usage_questions:
  - metric: monthly_events
    ask: Event volume this month and last, against the plan (or MTUs on an MTU contract)?
    where: Settings → Organization Settings → Plans & Billing; per project under Organization settings → Projects
  - metric: monthly_replays
    ask: Session replays captured this month against the quota?
    where: Plans & Billing (quota); a chart on the Replay Captured event for actual captures
  - metric: monthly_bill
    ask: Plan, contract basis (events or MTUs) and the last invoice?
    where: Plans & Billing → Manage Billing (Plus); contract for Growth and Enterprise
  - metric: region
    ask: Is the organization on the US or EU region?
    where: the app host (app.eu.amplitude.com is EU)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - turn off autocapture event types nobody uses, and block bot traffic with a block filter
  - set Session Replay sampling well below 100 percent (the onboarding snippet captures every session)
  - keep the standard Experiment exposure events (free) instead of custom ones, and ship winning web experiments in code
  - on MTU contracts, avoid reset() on logout and fake test user IDs, and keep backfills small
  - keep test data in a separate project and block internal traffic
  - create the organization in the region the requirements ask for; it cannot be moved
verified: 2026-10-11
---

- Amplitude is detected from `@amplitude/` (analytics, Unified, Session Replay, Experiment, Ampli, AI), the legacy `amplitude-js`, the Python and Go SDKs, `AMPLITUDE_*` names and `ampli.json`. The unscoped npm `amplitude` package is not Amplitude's.
- The `flags` role counts only when the code uses Amplitude Experiment; next to LaunchDarkly, PostHog or Mixpanel flags that is a candidate Overlap.
- Docs and the pricing page serve markdown at `<url>.md`. Some docs pages still show old MTU caps; cite the pricing page.
- The Amplitude MCP server (`https://mcp.amplitude.com/mcp`, EU host) has no client-side read-only switch (write access follows the user's role) and no billing tool; `get_deployments` returns deployment keys and `get_amp_user_data` returns end-user data. Do not use it; ask the user for numbers instead.
- Amplitude next to PostHog or Mixpanel is Overlap unless split on purpose. Amplitude fed by Segment is not.
