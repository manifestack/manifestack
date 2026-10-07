---
# generated, edit catalog/vendors/sendgrid.md (then run: node tools/sync.mjs)
schema: 1
id: sendgrid
name: SendGrid
roles: [email]
detect:
  packages: ["@sendgrid/"]
  pypi: ["sendgrid"]
  go: ["github.com/sendgrid/sendgrid-go"]
  imports: ["@sendgrid/"]
  env_prefixes: ["SENDGRID_"]
  config_files: []
pages:
  pricing: https://www.twilio.com/en-us/products/email-api/pricing
  marketing_pricing: https://www.twilio.com/en-us/products/marketing-campaigns/pricing
  free_trial: https://www.twilio.com/docs/sendgrid/ui/account-and-settings/upgrading-your-plan
  free_plan_change: https://www.twilio.com/en-us/changelog/sendgrid-free-plan
  rate_limits: https://www.twilio.com/docs/sendgrid/api-reference/how-to-use-the-sendgrid-v3-api/rate-limits
  account_review: https://www.twilio.com/docs/sendgrid/ui/account-and-settings/account-under-review
  dedicated_ips: https://www.twilio.com/docs/sendgrid/ui/account-and-settings/dedicated-ip-addresses
  regions: https://www.twilio.com/docs/sendgrid/data-residency/faq
  security: https://security.twilio.com/
  dpa: https://www.twilio.com/en-us/legal/data-protection-addendum
read:
  - the free trial terms: its length, the daily sending limit and contact limit during the trial, that it runs once, and that sending stops when it ends unless the plan is upgraded (the permanent free plan was retired)
  - Email API plans (Essentials, Pro, Premier) and the monthly email volumes each is sold in
  - what happens past the monthly volume (overage billed on top of the plan; accounts created through a marketplace such as Heroku or Google Cloud may not allow overage)
  - Marketing Campaigns plans, billed by contacts stored and emails sent, separate from the Email API plan
  - which plan includes a dedicated IP, how many more can be added, and warm-up needs
  - v3 API rate limits per endpoint (429 when exceeded), the Mail Send limit and recipients per request
  - account review states (warned, suspended, deactivated, banned), what happens to queued mail in each, and the bounce and spam behavior that triggers review
  - email activity history retention per plan, the Email Activity history add-on, and that activity data is stored in the United States
  - EU data residency: which plans offer it, and that it needs an EU subuser, an EU dedicated IP and the EU API endpoint
  - certifications on the Twilio trust center (SOC 2, ISO 27001) and the Twilio DPA, including the SendGrid-specific terms in it
usage_questions:
  - metric: monthly_sent
    ask: Emails sent last month, and the month before?
    where: Stats (left sidebar) → Overview, grouped by month (Requests); current plan in Settings → Account Details → Your Products
  - metric: daily_peak
    ask: Most emails sent in one day (or expected on launch day)?
    where: Stats (left sidebar) → Overview, grouped by day
  - metric: trial_end
    ask: Is the account on the free trial, and when does it end?
    where: Settings → Account Details → Your Products
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - upgrade from the trial before it ends, or before launch, since sending stops when it expires
  - batch digests and notifications instead of one email per event
  - keep bounce and spam rates low (verify lists, double opt-in, honor suppressions) to avoid account review
  - for EU data, create an EU subuser with an EU dedicated IP and send through the EU endpoint
  - move marketing sends to Marketing Campaigns or a separate subuser so transactional reputation is kept apart
verified: 2026-10-07
---

- SendGrid retired its permanent free plan in 2025. New accounts get a one-time free trial; when it ends, sending stops until a paid plan is chosen. A project still on the trial at launch is a Risk finding. Upgrading ends the trial at once.
- The old sendgrid.com pricing URLs redirect to a Twilio landing page with no numbers. Read prices from the twilio.com product pricing pages listed above.
- EU data residency is not a switch on the existing account: it needs a Pro-or-higher plan, a new EU subuser, an EU dedicated IP and api.eu.sendgrid.com. Mail sent through the parent account or the global endpoint leaves the EU. EU subusers lose some features (Marketing Campaigns, Activity, Validation).
- SendGrid together with another email sender (Resend, Postmark, Amazon SES, Mailgun) is an Overlap finding, unless one sends transactional and the other marketing on purpose.
- There is no official SendGrid MCP server. Twilio's official MCP server only searches documentation, and the Twilio Alpha API server does not cover the SendGrid v3 API. Community servers can send email; do not use them. Ask the user for numbers.
