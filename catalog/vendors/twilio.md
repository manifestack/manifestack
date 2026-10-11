---
schema: 1
id: twilio
name: Twilio
roles: [other]
detect:
  packages: ["twilio", "@twilio/", "twilio-video", "twilio-sync", "twilio-chat", "twilio-taskrouter", "twilio-client", "twilio-run", "twilio-cli", "@twilio-labs/serverless-api", "@twilio-labs/serverless-runtime-types", "@twilio-labs/runtime-helpers"]
  pypi: ["twilio"]
  go: ["github.com/twilio/twilio-go"]
  imports: ["twilio", "@twilio/", "twilio-video", "twilio-sync", "twilio-chat", "twilio-taskrouter", "twilio-client"]
  env_prefixes: ["TWILIO_"]
  config_files: [".twilioserverlessrc", ".twilioserverlessrc.js", ".twilioserverlessrc.cjs", ".twilioserverlessrc.yml", "twilioserverless.config.js"]
pages:
  pricing: https://www.twilio.com/en-us/pricing
  sms_pricing: https://www.twilio.com/en-us/sms/pricing/us
  sms_csv: https://assets.cdn.prod.twilio.com/pricing-csv/SMSPricing.csv
  numbers_csv: https://assets.cdn.prod.twilio.com/pricing-csv/NumbersPricing.csv
  verify_pricing: https://www.twilio.com/en-us/verify/pricing
  voice_pricing: https://www.twilio.com/en-us/voice/pricing/us
  whatsapp_pricing: https://www.twilio.com/en-us/whatsapp/pricing
  segments: https://www.twilio.com/docs/glossary/what-sms-character-limit
  a2p_10dlc: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
  trial: https://www.twilio.com/docs/usage/trials
  usage_triggers: https://www.twilio.com/docs/usage/api/usage-trigger
  fraud_guard: https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard
  pumping_protection: https://www.twilio.com/docs/messaging/features/sms-pumping-protection-programmable-messaging
  sms_geo: https://www.twilio.com/docs/messaging/guides/sms-geo-permissions
  unused_resources: https://www.twilio.com/docs/usage/manage-unused-resources
  regions: https://www.twilio.com/docs/global-infrastructure/understanding-twilio-regions
  security: https://www.twilio.com/en-us/security
  hipaa_eligible: https://www.twilio.com/content/dam/twilio-com/global/en/other/hipaa/pdf/HIPAA-Eligible-Services.pdf
  dpa: https://www.twilio.com/en-us/legal/data-protection-addendum
read:
  - SMS and MMS priced per segment by destination country and sender type (long code, toll-free, short code, alphanumeric), plus carrier pass-through fees and a fee for failed messages
  - segment size, i.e. one emoji or non-GSM character switches the whole message to UCS-2 and shrinks every segment
  - Verify, i.e. a fee per successful verification plus channel fees; SMS and voice attempts are billed whether or not the code is used
  - phone number monthly fees by type, short code leases, US A2P 10DLC brand, vetting and monthly campaign fees, toll-free verification
  - WhatsApp, i.e. Twilio's per-message fee plus Meta's fee per template category
  - voice per-minute rates and add-ons (recording storage, transcription)
  - trial free units, expiry and restrictions (verified recipients, sign-up country, predefined templates)
  - what happens at a limit, i.e. a prepaid balance at zero suspends the account while number and campaign fees keep accruing; auto-recharge has no monthly cap; usage triggers only call a webhook
  - processing regions (US1, IE1, AU1) per product
  - SOC 2, ISO 27001, PCI DSS, a HIPAA BAA for eligible products only (not WhatsApp), the DPA
usage_questions:
  - metric: monthly_sent
    ask: SMS segments sent last month, by destination country?
    where: Console → Billing → Usage summary (one month at a time, UTC); Messaging logs by country
  - metric: verifications
    ask: Verify attempts and successful verifications last month?
    where: Billing → Usage summary (Verify); Verify → Services → service
  - metric: monthly_bill
    ask: Last month's charges, current balance and auto-recharge settings?
    where: Billing → Billing overview (balance, invoices, auto-recharge)
  - metric: numbers
    ask: How many phone numbers are rented, and which have no traffic?
    where: Numbers & senders → My inventory (active configuration and traffic status)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - turn off Messaging, Verify and Voice geo permissions for countries you do not serve
  - use Verify with Fraud Guard, or SMS Pumping Protection, for OTP and sign-up forms; rate-limit by number and IP
  - keep messages within GSM-7 (no emoji) and short, and check them with the segment calculator
  - release unused phone numbers and delete A2P campaigns no longer used
  - set usage triggers and balance alerts, and cap auto-recharge with a subaccount circuit breaker
  - delete old call recordings, and look up numbers before sending to cut failed-message fees
verified: 2026-10-11
---

- Twilio is detected from `twilio`, `@twilio/` (Voice, Video, Conversations, Flex), the older client packages, the Serverless toolkit (`twilio-run`, `.twilioserverlessrc`), the Python and Go SDKs and `TWILIO_*` names. `@twilio-paste/` is the design system and `@twilio-labs/` holds unrelated tools; neither is used. SendGrid and Segment are separate maps.
- Verify is Twilio's OTP product: it sits next to the auth vendor (Clerk, Auth0, Supabase Auth) rather than replacing it. Twilio Verify next to another SMS provider for the same messages is Overlap unless split on purpose.
- SMS pumping (bots requesting OTPs to premium numbers) is the most common surprise bill: check geo permissions and fraud protection before launch.
- Help-center articles render only in a browser; docs pages serve markdown at `<url>.md`. The legacy `api.<region>.twilio.com` hosts stopped working on 2026-04-28; `api.twilio.com` and the new regional hosts still work.
- The `@twilio-alpha/mcp` server is a proof of concept with no read-only mode, it loads send, call and key-management tools by default, and account tools return the auth token; the docs MCP serves public docs only. Do not use them; ask the user for numbers instead.
