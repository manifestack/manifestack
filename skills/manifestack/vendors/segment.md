---
# generated, edit catalog/vendors/segment.md (then run: node tools/sync.mjs)
schema: 1
id: segment
name: Segment
roles: [other]
detect:
  packages: ["@segment/analytics-next", "@segment/analytics-node", "@segment/analytics-core", "@segment/analytics-react-native", "@segment/analytics-signals", "@segment/analytics-consent-tools", "@segment/analytics.js-core", "@segment/analytics-react", "@segment/snippet", "@segment/public-api-sdk-typescript", "analytics-node", "typewriter", "@analytics/segment", "expo-analytics-segment", "gatsby-plugin-segment-js"]
  pypi: ["segment-analytics-python", "analytics-python"]
  go: ["github.com/segmentio/analytics-go", "gopkg.in/segmentio/analytics-go.v3", "github.com/segmentio/public-api-sdk-go"]
  imports: ["@segment/analytics-next", "@segment/analytics-node", "@segment/analytics-react-native", "@segment/analytics.js-core", "@segment/analytics-signals", "@segment/snippet", "analytics-node", "@analytics/segment", "expo-analytics-segment"]
  env_prefixes: ["SEGMENT_WRITE_KEY", "NEXT_PUBLIC_SEGMENT_", "VITE_SEGMENT_", "PUBLIC_SEGMENT_", "REACT_APP_SEGMENT_", "EXPO_PUBLIC_SEGMENT_", "GATSBY_SEGMENT_"]
  config_files: ["typewriter.yml"]
pages:
  pricing: https://www.twilio.com/en-us/products/connections/pricing
  cdp_pricing: https://www.twilio.com/en-us/pricing/customer-data
  mtus_throughput: https://www.twilio.com/docs/segment/guides/usage-and-billing/mtus-and-throughput
  billing: https://www.twilio.com/docs/segment/guides/usage-and-billing/billing
  account_management: https://www.twilio.com/docs/segment/guides/usage-and-billing/account-management
  rate_limits: https://www.twilio.com/docs/segment/connections/rate-limits
  functions: https://www.twilio.com/docs/segment/connections/functions/usage
  reverse_etl: https://www.twilio.com/docs/segment/connections/reverse-etl/system
  filtering: https://www.twilio.com/docs/segment/guides/filtering-data
  retention: https://www.twilio.com/docs/segment/privacy/data-retention-policy
  regions: https://www.twilio.com/docs/segment/guides/regional-segment
  hipaa: https://www.twilio.com/docs/segment/privacy/hipaa-eligible-segment
  security: https://www.twilio.com/en-us/security
  dpa: https://www.twilio.com/en-us/legal/data-protection-addendum
read:
  - plans (Free, Team, Business; the Customer Data Platform bundle with Unify and Engage) and the MTUs, Reverse ETL records, sources, Functions hours, warehouses and seats each includes; Team overage per 1,000 MTUs in bands, monthly or annual
  - what an MTU is, i.e. unique user IDs plus anonymous IDs never tied to a user, across all sources in the month; throughput is API calls and objects per MTU, and batching does not lower it
  - what counts, i.e. object cloud sources count every pull; events blocked by Protocols do not; Reverse ETL and replays add MTUs only through Segment destinations
  - what happens at the Free limit, i.e. over once in six months locks the workspace while data flows; over twice also stops sending and receiving data
  - annual Team plans bill MTU overage monthly; cancelling or deleting the account does not stop charges while data still flows
  - Business-only features, i.e. destination and schema filters, Protocols, Regional Segment (US or EU, fixed at workspace creation), the HIPAA BAA, invoicing
  - data retention by plan, and the Twilio DPA and certifications (scope per product varies)
usage_questions:
  - metric: mau
    ask: MTUs this period against the plan, and how many are anonymous?
    where: app.segment.com → Settings → Usage & Billing → Usage (per source, daily)
  - metric: api_calls_month
    ask: API calls and objects this period against the throughput allowance?
    where: Settings → Usage & Billing → Usage
  - metric: monthly_bill
    ask: Plan, billing cycle, overage and add-ons?
    where: Settings → Usage & Billing → Plans
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - call reset only on logout and never overwrite the user or anonymous ID, so returning users do not become new MTUs
  - pass the browser's anonymous ID or the user ID with server-side events instead of a new random ID
  - track only on pages that need it and drop bot traffic in source middleware
  - stop calling identify or track on every render or request
  - send events only to the destinations that use them (Integrations object on Free and Team, filters on Business), since each tool bills its own volume
  - rotate write keys or delete the workspace when leaving, since data still flowing keeps the bill running
verified: 2026-10-11
---

- Segment is detected from its analytics libraries (`@segment/analytics-next`, `-node`, `-react-native` and related), the legacy `analytics-node`, Typewriter (`typewriter.yml`), community wrappers, the Python and Go libraries and `SEGMENT_WRITE_KEY` or public `*_SEGMENT_*` names. The whole `@segment/` scope is not used: it holds generic utilities pulled in by unrelated tools. Snippet-only sites show `cdn.segment.com` only in HTML: ask.
- If `apiHost` or `cdnURL` points away from `segment.io` or `segmentapis.com`, the events go to RudderStack, Jitsu or a proxy, not Segment.
- Segment is a pipeline: Mixpanel, Amplitude or PostHog receiving events from Segment is not an Overlap. RudderStack, Jitsu, mParticle or another CDP next to Segment is.
- Pricing and docs moved to twilio.com; docs serve markdown at `<url>.md`. Engage SMS and email are billed on the linked Twilio and SendGrid accounts.
- There is no official MCP server for a Segment workspace (Twilio's MCP serves docs only): ask the user for numbers.
