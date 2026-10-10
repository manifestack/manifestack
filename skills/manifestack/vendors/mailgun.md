---
# generated, edit catalog/vendors/mailgun.md (then run: node tools/sync.mjs)
schema: 1
id: mailgun
name: Mailgun
roles: [email]
detect:
  packages: ["mailgun.js", "mailgun-js", "@mailgun/", "nodemailer-mailgun-transport"]
  pypi: ["mailgun"]
  go: ["github.com/mailgun/mailgun-go"]
  imports: ["mailgun.js", "mailgun-js", "@mailgun/", "nodemailer-mailgun-transport"]
  env_prefixes: ["MAILGUN_"]
  config_files: []
pages:
  pricing: https://www.mailgun.com/pricing/
  free_plan: https://help.mailgun.com/hc/en-us/articles/203068914-What-does-the-Free-plan-offer
  authorized_recipients: https://help.mailgun.com/hc/en-us/articles/217531258-Authorized-Recipients
  overage: https://help.mailgun.com/hc/en-us/articles/6745531451547-What-happens-if-I-send-more-emails-than-my-monthly-plan-provides
  sending_limit: https://help.mailgun.com/hc/en-us/articles/4402611589915-Configuring-the-account-custom-message-limit
  hourly_limit: https://help.mailgun.com/hc/en-us/articles/115001124753-Why-does-my-account-have-an-hourly-sending-limitation
  domain_disabled: https://help.mailgun.com/hc/en-us/articles/202051664-Why-has-my-domain-been-disabled
  dedicated_ip: https://help.mailgun.com/hc/en-us/articles/202453900-When-do-I-need-a-dedicated-IP-address
  message_retention: https://help.mailgun.com/hc/en-us/articles/8841411163035-Adjusting-a-domain-s-message-retention-settings
  optimize_pricing: https://www.mailgun.com/pricing/optimize/
  regions: https://www.mailgun.com/about/regions/
  region_change: https://help.mailgun.com/hc/en-us/articles/360007512013-Can-I-transfer-my-domain-to-another-region-US-to-EU-EU-to-US
  security: https://www.mailgun.com/security/
  gdpr: https://www.mailgun.com/gdpr/
  dpa: https://sinch.com/legal/terms-and-conditions/other-sinch-terms-conditions/data-processing-agreement/
  hipaa: https://www.mailgun.com/legal/hipaa-baa/
read:
  - plans (Free, Basic, Foundation, Scale, Enterprise) and the emails included in each; Free has a daily cap, the paid plans a monthly volume
  - Free plan limits, i.e. sending stops for the day at the cap, one custom sending domain, and sending only to authorized recipients until a card is added
  - overage per 1,000 emails by plan, billed at renewal and impossible to switch off; the account custom message limit is the only cap and stops all sending
  - custom sending domains, users, inbound routes, templates and SSO per plan
  - log retention and message retention per plan (message retention is set per domain)
  - dedicated IP, i.e. which plan includes one, the add-on per IP, warm-up, and Mailgun's volume advice for when one helps
  - email validation, Optimize and Inspect billed separately from sending
  - US or EU region chosen per domain and fixed; logs, stats and the custom limit are kept per region
  - new-account review (business verification, hourly sending limit) and domains disabled for a high bounce rate
  - certifications (SOC 2 Type II, ISO 27001), the GDPR DPA (Sinch), the HIPAA BAA addendum and the plans it covers
usage_questions:
  - metric: monthly_sent
    ask: Emails sent last month, and the month before?
    where: Profile menu → Usage (app.mailgun.com/settings/usage, refreshed daily); per invoice under Plan & Billing → Invoices
  - metric: daily_peak
    ask: Most emails sent in one day (or expected on launch day)?
    where: Send → Reporting → Dashboard, by day, for each region (US and EU stats are separate)
  - metric: monthly_bill
    ask: Current plan and the last invoice total, including overage?
    where: Profile menu → Plan & Billing (plan and invoices)
  - metric: region
    ask: Which region (US or EU) does each sending domain use?
    where: Send → Sending → Domains
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - complete business verification before launch so the account is not held to an hourly limit
  - set the account custom message limit in every region used, knowing it stops all sending when reached
  - upgrade before the Free daily cap is reached at launch; on paid plans compare overage with the next plan
  - batch digests and notifications instead of one email per event
  - keep bounces and complaints low (validate at signup, double opt-in, honor suppressions) and set Alerts for both rates
  - skip a dedicated IP below Mailgun's volume advice; a cold IP hurts delivery
  - create sending domains in the region the requirements ask for, since a domain cannot change region
verified: 2026-10-11
---

- Mailgun is detected from `mailgun.js`, the deprecated `mailgun-js`, the `@mailgun/` scope (CLI and MCP server), the community `nodemailer-mailgun-transport`, `mailgun` on PyPI, `mailgun-go` and `MAILGUN_*` names. An app can also send through SMTP (`smtp.mailgun.org`, `smtp.eu.mailgun.org`) with a generic mailer: ask when only SMTP settings point to Mailgun. `api.eu.mailgun.net` in the code means an EU domain.
- `help.mailgun.com` answers automated requests with 403. Each article is also served as JSON at `https://help.mailgun.com/api/v2/help_center/en-us/articles/<id>.json` (the number at the start of the article slug); read it there, and cite the article page.
- Do not use `www.mailgun.com/legal/dpa/`: it redirects to an old French DPA. The current DPA is Sinch's.
- The Mailgun MCP server (`@mailgun/mcp-server`) has no read-only mode: `--tags` only filters by product, and the send tools include sending email, editing webhooks, routes, lists and templates. Domain tools may return the SMTP password. Do not use it; ask the user for numbers instead.
- Mailgun next to Resend, Postmark or SendGrid is Overlap unless split on purpose (for example marketing on one, transactional on the other).
