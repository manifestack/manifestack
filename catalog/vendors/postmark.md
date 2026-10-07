---
schema: 1
id: postmark
name: Postmark
roles: [email]
detect:
  packages: ["postmark"]
  pypi: ["postmark-python", "postmarker", "python-postmark", "pystmark"]
  go: ["github.com/mrz1836/postmark", "github.com/keighl/postmark", "github.com/hjr265/postmark.go"]
  imports: ["postmark"]
  env_prefixes: ["POSTMARK_"]
  config_files: []
pages:
  pricing: https://postmarkapp.com/pricing
  billing: https://postmarkapp.com/support/article/1285-pricing-billing-faq
  limits: https://postmarkapp.com/support/article/does-postmark-have-a-daily-send-limit
  api_limits: https://postmarkapp.com/developer/api/email-api
  approval: https://postmarkapp.com/support/article/1084-how-does-the-account-approval-process-work
  streams: https://postmarkapp.com/message-streams
  dedicated_ips: https://postmarkapp.com/dedicated-ips
  retention: https://postmarkapp.com/support/article/how-does-the-retention-add-on-work
  regions: https://postmarkapp.com/eu-privacy
  dpa: https://postmarkapp.com/dpa
read:
  - emails per month on the free Developer plan and on the smallest paid tier, and the gap between them (no tier in between)
  - paid tiers (Basic, Pro, Platform) and which features each unlocks (message streams, retention add-on, more users and servers)
  - what happens past the monthly volume: paid plans keep sending and bill extra emails at the next invoice, with no cap that can be set; check what the free plan does at its limit
  - new account approval: until approved, sending only to verified domains of your own (a launch-day Risk if approval is not done)
  - transactional and broadcast message streams on separate IP pools, streams per server, and the first-send pacing asked for on broadcast streams
  - dedicated IP qualification (monthly volume threshold, extra IP by daily volume), warm-up, and re-warm-up after low volume
  - API limits per call (messages per batch, recipients per message, payload size); no fixed per-second sending limit is published
  - spam complaint and bounce rate thresholds that pause the account with messages queued
  - default retention of message content and events, the retention add-on range, and which plans offer it
  - hosting location (US data centers, no EU region), DPA with SCCs, sub-processors, and the certifications claimed (held by the data centers, not by Postmark)
usage_questions:
  - metric: monthly_sent
    ask: Emails sent last month, and the month before?
    where: Account → Plans & add-ons (monthly usage indicator) or Account → Billing → invoices; per stream: Servers → server → message stream → Statistics (Sent counts each recipient)
  - metric: daily_peak
    ask: Most emails sent in one day (or expected on launch day)?
    where: Servers → server → message stream → Statistics, filtered by date
  - metric: broadcast_share
    ask: Do you send marketing or bulk email, and through a Broadcast stream?
    where: Servers → server (the page lists its message streams and their type)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - request account approval well before launch
  - send marketing and bulk mail through a Broadcast stream, never the Transactional stream
  - batch digests and notifications instead of one email per event
  - keep bounce and spam rates under the thresholds (verify lists, double opt-in, remove hard bounces)
  - set delivery and bounce webhooks to track volume, since overage cannot be capped
  - lower the activity retention if the requirements limit how long message content may be stored
verified: 2026-10-07
---

- Postmark has no EU sending region. Data is hosted in the US (a Chicago data center and AWS). If the requirements say "EU data", this is a Requirement finding; the DPA with SCCs may be enough for GDPR but is not data residency.
- Paid plans never stop at the monthly volume: extra emails are billed on the next invoice and there is no way to set a cap. Put the plan's included volume in revisit_when.
- Postmark together with another email sender (Resend, SendGrid, Amazon SES, Mailgun) is an Overlap finding, unless one sends transactional and the other marketing on purpose. Postmark's own Broadcast streams can already carry marketing mail.
- The official Postmark MCP server (`@activecampaign/postmark-mcp`) sends email, edits templates, suppressions and webhooks, uses a full-access server token, and has no read-only switch (only per-tool annotations). Do not use it; ask the user for numbers. The unscoped npm package `postmark-mcp` was a malicious impostor that copied every email to an outside address (removed from npm in September 2025); flag it if it appears in a project.
- `postmark` is also an ordinary English word; trust the package.json entry first.
