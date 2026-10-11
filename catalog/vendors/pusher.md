---
schema: 1
id: pusher
name: Pusher
roles: [realtime]
detect:
  packages: ["pusher", "pusher-js", "@pusher/"]
  pypi: ["pusher", "pusher-push-notifications"]
  go: ["github.com/pusher/pusher-http-go", "github.com/pusher/push-notifications-go"]
  imports: ["pusher", "pusher-js", "@pusher/"]
  env_prefixes: ["PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER", "PUSHER_URL", "PUSHER_BEAMS_", "NEXT_PUBLIC_PUSHER_", "EXPO_PUBLIC_PUSHER_", "REACT_APP_PUSHER_"]
  config_files: []
  role_signals:
    realtime: ["pusher.com", "broadcaster: 'pusher'", "broadcaster: \"pusher\"", "new Pusher(", "Pusher.forURL", "pusher.Pusher(", "pusher.Client{", "PushNotifications(", "PusherPushNotifications"]
pages:
  pricing: https://pusher.com/channels/pricing/
  beams_pricing: https://pusher.com/beams/pricing/
  quotas: https://pusher.com/legal/quotas/
  at_the_limit: https://messagebird.gitbook.io/pusher/channels/channels/limits/what-happens-when-i-hit-my-channels-plan-limits
  message_count: https://messagebird.gitbook.io/pusher/channels/channels/limits/how-is-my-message-count-calculated-in-channels
  connection_count: https://messagebird.gitbook.io/pusher/channels/channels/limits/how-are-concurrent-connections-counted
  account_limits: https://messagebird.gitbook.io/pusher/account-billing/account-billing/plans/how-does-my-channels-plan-level-affect-the-limits-of-my-apps
  presence_messages: https://messagebird.gitbook.io/pusher/channels/channels/presence/why-do-presence-channels-generate-so-many-messages
  monitor_usage: https://messagebird.gitbook.io/pusher/channels/channels/limits/how-can-i-monitor-my-account-usage
  beams_limits: https://messagebird.gitbook.io/pusher/beams/beams/limits/what-happens-when-i-hit-my-beams-plan-limits
  clusters: https://pusher.com/docs/channels/miscellaneous/clusters/
  change_cluster: https://messagebird.gitbook.io/pusher/channels/channels/connecting/how-can-i-transition-a-live-app-to-a-different-cluster
  security: https://pusher.com/security/
  hipaa: https://messagebird.gitbook.io/pusher/account-billing/account-billing/legal/how-can-i-comply-with-hipaa-when-using-pusher-channels
  dpa: https://bird.com/legal/dpa
  subprocessors: https://bird.com/legal/subprocessors
read:
  - Channels plans (Sandbox free through Enterprise) and the messages per day and concurrent connections each includes; quotas are per account and shared by every app the account owns
  - how messages are counted, i.e. every API call plus each delivery to each subscriber (one publish to N subscribers counts N+1), client events, webhooks and presence join and leave events; the day runs on UTC
  - what happens at the limit, i.e. publishes get 403 over quota and new connections are refused; Sandbox is capped at the plan, paid plans at a margin above it; no self-serve overage
  - limit warning emails and usage summaries, and that Pusher may disable apps that stay over the soft limit
  - per-message limits (message size, channels per trigger, client event rate, presence members)
  - Beams plans by subscribers (devices registered in a day), the warnings and grace period, then 402 on publish
  - upgrades are prorated and charged at once, downgrades apply at the end of the period with no refund
  - clusters, fixed per app (moving needs a new app)
  - ISO 27001, the Bird DPA, and HIPAA guidance without a BAA
usage_questions:
  - metric: daily_peak
    ask: Most messages in one day and the peak concurrent connections, across all apps on the account?
    where: dashboard.pusher.com → app overview (today's realtime stats keep the day's peak; older graphs show averages); usage summaries under Channels → Manage → Settings
  - metric: monthly_bill
    ask: Channels and Beams plans and the last statement?
    where: Account (top right) → Channels billing and Beams billing
  - metric: region
    ask: Which cluster does each app use?
    where: the app's cluster name (ask for it; do not open App Keys, which shows the secret)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - replace large presence channels with private channels plus webhooks or subscription counts
  - split broad broadcasts into narrow channels so clients get only what they need
  - create one Pusher client per page (once in React), and disconnect idle or hidden tabs
  - exclude the sender with socket_id, avoid the info parameter on triggers, and keep client events off unless needed
  - move dev and staging apps to a separate account so they do not use production quota
  - set limit notifications to reach whoever is on call, and upgrade before launch rather than at the limit
  - call stop on Beams when users opt out, to drop stale subscribers
verified: 2026-10-11
---

- `pusher-js` and `PUSHER_*` names do not prove the hosted service. Laravel 11+ installs `pusher-js` with `laravel-echo` for its own Reverb server, and Soketi and laravel-websockets speak the same protocol. The `realtime` role counts when the code shows Pusher's hosts or a Pusher client (`broadcaster: 'pusher'`, `new Pusher(`), which self-hosted Pusher-protocol servers also use: a `wsHost` option, `REVERB_*` names, `config/reverb.php`, `@soketi/soketi` or `config/websockets.php` mean a self-hosted server, and `pusher-js` pointed at `main.pusher.ably.net` is Ably's Pusher adapter. Ask when unsure.
- Laravel 8–10 projects ship `PUSHER_APP_*`, `VITE_PUSHER_*` and `MIX_PUSHER_*` in `.env.example` with broadcasting off, so those names are not used for detection.
- The support knowledge base moved to `messagebird.gitbook.io/pusher` (append `.md` to an article for markdown); legal pages are on bird.com. Two articles disagree on the warning threshold; cite the quotas page.
- There is no official MCP server, and the Channels API has no usage endpoint: ask the user for numbers.
- Pusher next to Ably, Liveblocks or Supabase Realtime is Overlap unless split on purpose.
