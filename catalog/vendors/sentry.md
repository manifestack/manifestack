---
schema: 1
id: sentry
name: Sentry
roles: [monitoring]
detect:
  packages: ["@sentry/", "sentry-expo"]
  pypi: ["sentry-sdk", "raven", "sentry-cli"]
  go: ["github.com/getsentry/sentry-go"]
  imports: ["@sentry/", "sentry-expo"]
  env_prefixes: ["SENTRY_", "NEXT_PUBLIC_SENTRY_", "VITE_SENTRY_", "EXPO_PUBLIC_SENTRY_", "PUBLIC_SENTRY_", "REACT_APP_SENTRY_"]
  config_files: ["sentry.client.config.ts", "sentry.client.config.js", "sentry.server.config.ts", "sentry.server.config.js", "sentry.edge.config.ts", "sentry.edge.config.js", "sentry.properties", ".sentryclirc"]
pages:
  pricing: https://sentry.io/pricing/
  billing: https://docs.sentry.io/pricing/
  limits: https://docs.sentry.io/pricing/quotas/
  spike_protection: https://docs.sentry.io/pricing/quotas/spike-protection/
  usage: https://docs.sentry.io/product/stats/
  retention: https://docs.sentry.io/security-legal-pii/security/data-retention-periods/
  regions: https://docs.sentry.io/organization/data-storage-location/
  security: https://sentry.io/security/
  dpa: https://sentry.io/legal/dpa/
read:
  - Developer (free) plan quota per data type (errors, spans, replays, attachments, logs, cron and uptime monitors) and the seat limit on it
  - what happens past the quota on each plan (events dropped and not counted, or billed against a pay-as-you-go budget)
  - pay-as-you-go budget behavior when the budget runs out (data dropped for the rest of the billing cycle)
  - spike protection, whether it is on for new organizations, and that it is set per project
  - Team plan price, included quotas per data type, seats and the features gated to Business
  - data retention per plan and per data type (retention follows the plan at ingest time)
  - data storage location (US or EU) and that it cannot be changed after the organization is created
  - certifications (SOC 2 Type II, ISO 27001, HIPAA attestation), whether a BAA is offered on the plan, and the DPA
usage_questions:
  - metric: monthly_errors
    ask: Errors accepted last month, and how many were rate limited or dropped?
    where: Sentry → Stats → Usage tab, category Errors (Accepted, Filtered, Rate Limited, Client Discard)
  - metric: monthly_spans
    ask: Spans (or transactions on older plans) accepted last month?
    where: Sentry → Stats → Usage tab, category Spans or Transactions
  - metric: monthly_replays
    ask: Session replays accepted last month?
    where: Sentry → Stats → Usage tab, category Replays
  - metric: monthly_bill
    ask: Current plan, reserved quotas and pay-as-you-go budget?
    where: Settings → Subscription (pay-as-you-go budget and spend notifications are set there)
mcp:
  official: true
  readonly_flag: "grant only the inspect skill: on the remote server (https://mcp.sentry.dev/mcp) tick only Inspect Issues & Events on the OAuth consent screen, or add ?skills=inspect when passing a token with the Sentry-Bearer header; locally run npx @sentry/mcp-server --skills=inspect (or MCP_SKILLS=inspect)"
  allowed_tools: [find_organizations, find_projects, search_docs, get_doc, execute_sentry_tool]
common_fixes:
  - lower tracesSampleRate (or use tracesSampler) so spans stay inside the quota
  - lower replaysSessionSampleRate and keep replaysOnErrorSampleRate for the sessions that matter
  - drop noisy errors in the SDK (ignoreErrors, denyUrls, beforeSend) and with Project → Settings → Inbound Filters
  - turn on spike protection for every project (Settings → Spike Protection)
  - set a per-project rate limit on the DSN (Project → Settings → Client Keys)
  - set the pay-as-you-go budget on purpose and turn on spend notifications (Settings → Subscription)
  - create the organization in the data storage location the requirements ask for before sending data
verified: 2026-10-07
---

- Quota exhausted mid-month means a blind spot: events past the quota (or past the pay-as-you-go budget) are dropped until the cycle resets. Rate Limited counts on the Stats page show it already happened.
- The data storage location is fixed per organization. Moving from US to EU means a new organization and losing history, so it must match a data-region requirement from day one.
- MCP: Inspect is read-only by design; Seer, Triage and Manage Projects & Teams add write tools (update_issue, create_dsn, create_project, analyze_issue_with_seer) and must stay unticked. Only top-level tools appear in the tool list; others are called through `execute_sentry_tool`, which only runs tools of granted skills. Call it only with `find_organizations` or `find_projects`; never call `find_dsns` or `onboarding_status_update`, and do not read issues or events: they can hold user data, and the audit needs none of it. MCP shows no usage or billing data, so ask the usage questions instead. `find_organizations` returns the region URL, which tells US from EU.
- Sentry and another error tracker (PostHog error tracking, Datadog, Bugsnag) in the same code is an Overlap finding. Sentry Session Replay plus PostHog session replay is the same kind of Overlap.
- Pricing moved from transactions to spans for plans started after mid-2024; older organizations may still see Transactions on Stats and in the subscription.
