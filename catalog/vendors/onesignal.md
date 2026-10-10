---
schema: 1
id: onesignal
name: OneSignal
roles: [other, email]
detect:
  packages: ["react-native-onesignal", "onesignal-cordova-plugin", "react-onesignal", "onesignal-expo-plugin", "onesignal-vue", "onesignal-ngx", "@onesignal/", "onesignal-node"]
  pypi: ["onesignal-python-api", "onesignal", "onesignal-sdk"]
  go: ["github.com/OneSignal/onesignal-go-api"]
  imports: ["react-native-onesignal", "onesignal-cordova-plugin", "react-onesignal", "onesignal-expo-plugin", "onesignal-vue", "onesignal-ngx", "@onesignal/", "onesignal-node"]
  env_prefixes: ["ONESIGNAL_", "NEXT_PUBLIC_ONESIGNAL_", "VITE_ONESIGNAL_", "EXPO_PUBLIC_ONESIGNAL_", "REACT_APP_ONESIGNAL_"]
  config_files: ["OneSignalSDKWorker.js", "OneSignalSDKUpdaterWorker.js"]
  role_signals:
    email: ["target_channel: 'email'", "target_channel: \"email\"", "target_channel = 'email'", "target_channel='email'", "SetTargetChannel(\"email\")", "SetEmailSubject(", "email_from_address", "include_email_tokens", "User.addEmail("]
pages:
  pricing: https://onesignal.com/pricing
  billing: https://documentation.onesignal.com/docs/en/billing-faq
  pricing_explainer: https://onesignal.com/blog/understanding-onesignals-pricing/
  rate_limits: https://documentation.onesignal.com/reference/rate-limits
  subscriptions: https://documentation.onesignal.com/docs/en/subscriptions
  apps_organizations: https://documentation.onesignal.com/docs/en/apps-organizations
  sms_fraud: https://documentation.onesignal.com/docs/en/sms-regulatory-compliance
  sms_usage: https://documentation.onesignal.com/docs/en/sms-message-reports
  email_setup: https://documentation.onesignal.com/docs/en/email-setup
  custom_event_storage: https://documentation.onesignal.com/docs/en/custom-event-storage
  regions: https://documentation.onesignal.com/docs/en/data-questions
  subprocessors: https://onesignal.com/list-of-subprocessors
  security: https://onesignal.com/privacy
  dpa: https://onesignal.com/dpa
  hipaa: https://documentation.onesignal.com/docs/en/hipaa
  soc2: https://documentation.onesignal.com/docs/en/soc-2-type-ii
  mcp: https://documentation.onesignal.com/docs/en/model-context-protocol
read:
  - plans (Free, Growth, Professional, Enterprise; legacy subscriber-billed plans) - Growth is a platform fee plus usage, Professional and Enterprise annual with custom volume pricing
  - what is billed, i.e. mobile MAU (each mobile subscription with a session in the cycle, opted in to push or not, API last_active updates included), web push subscribers (each subscribed browser), email sends (bounces count), SMS per segment, Event Streams and stored Custom Events; in-app and Live Activities come with mobile push
  - Free limits, i.e. the mobile push and in-app MAU cap per organization over a trailing 30 days, web push subscribers per send, email sends per month, Journeys, Segments, Data Tags, reporting history, API message rate
  - what happens at a limit, i.e. over the Free MAU cap mobile push and in-app stop after a grace period while web push, email and SMS keep sending; deleting subscriptions helps only after the trailing window; Growth bills overage and caps self-serve email sends per month
  - app disablement when sends exceed a multiple of subscribed subscriptions in a rolling window
  - SMS needs a paid plan and a contract (no public per-country price), or your own Twilio account billed by Twilio; spend warnings and geo restrictions against SMS pumping
  - primary data centers in the EU with US subprocessors and no region choice; SOC 2 Type II and the HIPAA BAA on Enterprise only, ISO 27001 and 27701, the GDPR DPA
usage_questions:
  - metric: mau
    ask: Mobile MAU across the organization (trailing 30 days) and billed MAU last cycle?
    where: Organizations page (total MAU); Organization settings → Billing (billing-cycle MAU and web push subscribers)
  - metric: monthly_sent
    ask: Email sends this month and last month, against the allowance?
    where: App → Settings → Usage; Organization settings → Billing
  - metric: sms_segments
    ask: SMS segments sent last month by country?
    where: App → Settings → Usage → SMS → See breakdown
  - metric: monthly_bill
    ask: Current plan and last invoice total?
    where: Organization settings → Billing → Invoices (Org Admin only)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - delay mobile subscription creation until consent or login (setConsentRequired, setConsentGiven) so idle installs do not become MAU
  - do not update last_active during imports, and keep dev and test apps in a separate organization
  - delete stale web push subscriptions before the cycle ends, and send to segments instead of everyone
  - clean invalid email addresses and use confirmed opt-in, since bounces are billed
  - keep SMS to one segment (no emoji, short links), rate-limit OTP requests per number and restrict send countries
  - shorten Custom Event retention, pause unused segments, and send with an idempotency_key so retries do not duplicate
verified: 2026-10-11
---

- OneSignal is detected from its web, React Native, Cordova, Expo, Vue and Angular packages, `@onesignal/` (Node SDK), the third-party `onesignal-node`, the Python and Go SDKs, `ONESIGNAL_*` names and the web push worker `OneSignalSDKWorker.js`. Native iOS, Android, Flutter and Unity apps, and sites that load the SDK with a `<script>` tag, leave only the env names or the worker (a renamed worker is missed): ask the user.
- The `email` role counts only when the code sends email through OneSignal. OneSignal email can deliver through the customer's own SendGrid or Mailgun account, so ask before calling it an Overlap with those.
- The pricing page and the pricing blog disagree on some overage rates and warning thresholds; cite the pricing page and the billing FAQ. Docs pages serve markdown at `<url>.md`.
- The OneSignal MCP server (`https://api.onesignal.com/mcp/oauth`, beta) has no read-only mode: it sends messages and edits users, the Viewer role exists only on Growth and above, `list_apps` may return push credentials, and it has no usage or billing tool. Do not use it; ask the user for numbers instead.
