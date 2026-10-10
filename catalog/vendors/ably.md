---
schema: 1
id: ably
name: Ably
roles: [realtime]
detect:
  packages: ["ably", "@ably/", "@ably-labs/"]
  pypi: ["ably"]
  go: ["github.com/ably/ably-go"]
  imports: ["ably", "@ably/", "@ably-labs/"]
  env_prefixes: ["ABLY_", "NEXT_PUBLIC_ABLY_", "VITE_ABLY_", "EXPO_PUBLIC_ABLY_"]
  config_files: []
pages:
  pricing: https://ably.com/pricing
  pricing_overview: https://ably.com/docs/platform/pricing
  limits: https://ably.com/docs/platform/pricing/limits
  message_counting: https://ably.com/docs/platform/pricing/message-counting
  free: https://ably.com/docs/platform/pricing/free
  standard: https://ably.com/docs/platform/pricing/standard
  pro: https://ably.com/docs/platform/pricing/pro
  billing: https://ably.com/docs/platform/pricing/billing
  faqs: https://ably.com/docs/platform/pricing/faqs
  cost_optimization: https://ably.com/docs/pub-sub/pricing
  storage: https://ably.com/docs/storage-history/storage
  stats: https://ably.com/docs/metadata-stats/stats
  account_limit_error: https://ably.com/docs/platform/errors/codes/40112-account-message-limit-exceeded
  regions: https://ably.com/docs/platform/account/enterprise-customization
  security: https://ably.com/security-and-compliance
  data_protection: https://ably.com/data-protection
read:
  - packages (Free, Standard, Pro, Enterprise), the base fee of each paid package, and usage billed per message, channel minute, connection minute and bandwidth above the allowance
  - limits per package, i.e. message rate, concurrent connections and channels, messages per month (Free only), history retention, presence members, integrations and rules
  - how messages are counted, i.e. each publish plus each delivery to each subscriber, echo to the publisher, presence events to every presence subscriber, persisted messages, history reads, integration deliveries; messages billed in 5 KiB chunks
  - Chat, Spaces, LiveObjects, LiveSync and AI Transport count messages their own ways (typing heartbeats, cursor batches, object sync on attach)
  - what happens at a limit, i.e. most limits are soft with warnings; new connections or channels are refused at count limits; Free is blocked when the monthly message cap is reached until an upgrade
  - billing, i.e. minutes rounded up, invoices in arrears, upgrades charge from the first message, billing alerts on Standard and Pro and no spend cap
  - message persistence by rule, its cost, and that persisted messages cannot be deleted through the API
  - EU-only or US-only routing and storage on Enterprise only; persisted history stored in several regions otherwise
  - SOC 2 Type 2, GDPR terms built into the Terms (no separate DPA), HIPAA BAA on Enterprise only
usage_questions:
  - metric: monthly_messages
    ask: Billable messages this month and last month?
    where: Account dashboard → Usage (usage_history; graphs, table and download), per app under the app's stats
  - metric: peak_connections
    ask: Peak concurrent connections and channels this month?
    where: Account dashboard → Usage (connections and channels peaks)
  - metric: monthly_bill
    ask: Current package, last invoice total and any billing alert?
    where: Account → Billing (package, invoices, billing alerts)
  - metric: limits_hit
    ask: Has the account hit any limit recently?
    where: Account → Limits → recent limit notifications
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set echoMessages to false on server publishers and use subscription filters instead of filtering on the client
  - use occupancy instead of presence when only a count is needed, and turn on server-side presence batching
  - enable persistence only on namespaces that need history, and mark streaming data ephemeral
  - turn on delta compression and conflation, and keep payloads under the 5 KiB chunk
  - close connections and detach channels and rooms when done; avoid one channel per user where a shared one works
  - set billing alerts on paid packages, and upgrade Free before a launch so the account is not blocked
verified: 2026-10-11
---

- Ably is detected from `ably` (with `ably/react` and `ably/liveobjects` subpaths), `@ably/` (Chat, Spaces, AI Transport, CLI), `@ably-labs/`, the Python and Go SDKs and `ABLY_*` names. An Ably API key under a public prefix (`NEXT_PUBLIC_ABLY_`, `VITE_ABLY_`) is a finding of its own: clients should use token auth.
- Ably also speaks the Pusher protocol: `pusher-js` pointed at `main.pusher.ably.net` is Ably, not Pusher. An `endpoint` or `environment` client option, or a `*.realtime.ably.net` host other than `main`, means an Enterprise custom endpoint.
- ably.com answers with 429 after a burst of requests. Read docs through their `.md` twins (`<url>.md`); the index is `https://ably.com/llms.txt`.
- There is no official MCP server (the CLI's experimental one was removed): ask the user for numbers.
- Ably next to Pusher, Liveblocks, Supabase Realtime or Firebase Realtime Database is Overlap unless split on purpose.
