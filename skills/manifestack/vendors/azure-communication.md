---
# generated, edit catalog/vendors/azure-communication.md (then run: node tools/sync.mjs)
schema: 1
id: azure-communication
name: Azure Communication Services
family: azure
roles: [email]
detect:
  packages: ["@azure/communication-email", "@azure/communication-sms", "@azure/communication-phone-numbers", "@azure/communication-chat", "@azure/communication-calling", "@azure/communication-call-automation", "@azure/communication-identity", "@azure/communication-rooms", "@azure/communication-common", "@azure/communication-react", "@azure-rest/communication-messages"]
  pypi: ["azure-communication-email", "azure-communication-sms", "azure-communication-phonenumbers", "azure-communication-chat", "azure-communication-callautomation", "azure-communication-identity", "azure-communication-rooms", "azure-communication-messages"]
  go: []
  imports: ["@azure/communication-email", "@azure/communication-sms", "@azure/communication-phone-numbers", "@azure/communication-chat", "@azure/communication-calling", "@azure/communication-call-automation", "@azure/communication-identity", "@azure/communication-rooms", "@azure/communication-common", "@azure/communication-react", "@azure-rest/communication-messages"]
  env_prefixes: ["COMMUNICATION_SERVICES_CONNECTION_STRING", "AZURE_COMMUNICATION_"]
  config_files: []
  service_signals: ["azure.communication.", ".communication.azure.com", "\"azurerm_communication_service\"", "\"azurerm_email_communication_service", "Microsoft.Communication/", "azure-native:communication:", "azure_native.communication"]
  role_signals:
    email: ["@azure/communication-email", "azure.communication.email", "\"azurerm_email_communication_service", "Microsoft.Communication/emailServices"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/communication-services/
  email_pricing: https://learn.microsoft.com/en-us/azure/communication-services/concepts/email-pricing
  limits: https://learn.microsoft.com/en-us/azure/communication-services/concepts/service-limits
  email_quota: https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-quota-increase
  email_domains: https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-domain-and-sender-authentication
  managed_domains: https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-azure-managed-domains
  sms_pricing: https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms-pricing
  sms_faq: https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms/sms-faq
  number_eligibility: https://learn.microsoft.com/en-us/azure/communication-services/concepts/numbers/sub-eligibility-number-capability
  voice_pricing: https://learn.microsoft.com/en-us/azure/communication-services/concepts/pricing
  retirement: https://learn.microsoft.com/en-us/azure/communication-services/acs-retirement-and-breaking-changes-guide
  privacy: https://learn.microsoft.com/en-us/azure/communication-services/concepts/privacy
read:
  - "retirement: the date standalone ACS ends, which services retire (Email, SMS, Chat, Rooms, number management) or change (calling, call automation), the onboarding limits for customers without an earlier resource, and the suggested replacements"
  - Email billed per message per recipient plus per MB transferred to each recipient (headers, body, attachments)
  - Email sending limits per subscription for Azure-managed domains (test only, low, cannot be raised) and custom domains (raised on request with a low failure rate and a ramp-up period); requests over the limit are rejected
  - the custom domain setup (SPF, DKIM, an MX record recommended) and the Email Communication Service resource linked to a Communication Services resource
  - SMS per message segment by destination plus carrier surcharges; phone number monthly leasing fees; toll-free and 10DLC registration
  - calling and screen sharing per participant per minute, PSTN legs per minute, recording and other call features
  - subscription eligibility for phone numbers by billing country and offer type
  - data location, a geography chosen when the resource is created, where stored data stays and email content is processed
usage_questions:
  - metric: monthly_sent
    ask: Emails sent (recipients) and MB transferred last month, and the month before?
    where: Azure portal → Cost Management → Cost analysis → filter the Communication Services resource, Group by Meter
  - metric: daily_peak
    ask: Most emails in one hour or day, failed sends, and the sending limit granted?
    where: Communication Services resource → Monitor → Insights → Email (requires diagnostic logs to a Log Analytics workspace); limit from the quota increase ticket
  - metric: domains
    ask: Which sending domains are used, Azure-managed or custom and verified?
    where: Email Communication Service resource → Provision domains
  - metric: sms_spend
    ask: SMS segments sent last month by country, and phone numbers leased?
    where: Cost analysis Group by Meter; Communication Services resource → Phone numbers
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - plan the move off ACS Email and SMS before the retirement date, and do not start new projects on them
  - send production email from a verified custom domain, never the Azure-managed domain
  - ramp volume over weeks and request a quota increase well before launch
  - keep the failure rate low by handling bounces and using suppression lists
  - link large attachments instead of attaching them
  - release phone numbers that send nothing
verified: 2026-10-11
---

- Microsoft announced the retirement of ACS as a standalone offering: Email, SMS, Chat, Rooms and number management retire, calling continues only with Teams. Any ACS use is a Fit finding with the date from the retirement page; a project without an ACS resource created before the onboarding cutoff may not be able to start.
- The email role counts only when the Email SDK or an email resource is in the code; SMS, chat or calling alone give no role. Email needs two resources: an Email Communication Service with its domains, linked to a Communication Services resource.
- An Azure-managed domain is for testing; its limits cannot be raised. A launch on it is a Risk finding.
- ACS Email next to Resend, SendGrid, Postmark, Mailgun or SES is Overlap unless split on purpose. ACS SMS next to Twilio is not reported (Twilio has the role other in this catalog); mention it when both send SMS.
- MCP: the Azure MCP Server's Communication tools only send email and SMS. Do not use them.
