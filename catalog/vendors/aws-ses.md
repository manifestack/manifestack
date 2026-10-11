---
schema: 1
id: aws-ses
name: Amazon SES
family: aws
roles: [email]
detect:
  packages: ["@aws-sdk/client-ses", "@aws-sdk/client-sesv2", "@aws-sdk/client-mailmanager"]
  pypi: ["django-ses", "django-amazon-ses", "mypy-boto3-ses", "mypy-boto3-sesv2"]
  go: ["github.com/aws/aws-sdk-go-v2/service/ses", "github.com/aws/aws-sdk-go-v2/service/sesv2", "github.com/aws/aws-sdk-go-v2/service/mailmanager", "github.com/aws/aws-sdk-go/service/ses", "github.com/aws/aws-sdk-go/service/sesv2"]
  imports: ["@aws-sdk/client-ses", "@aws-sdk/client-sesv2", "@aws-sdk/client-mailmanager"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('ses'", "client(\"ses\"", "client('sesv2'", "client(\"sesv2\"", "aws_ses_", "aws_sesv2_", "AWS::SES::", "aws-cdk-lib/aws-ses", "aws_cdk.aws_ses", "aws_ses as", "new AWS.SES", "ses:Send", "arn:aws:ses:", "email-smtp."]
pages:
  pricing: https://aws.amazon.com/ses/pricing/
  pricing_plans: https://docs.aws.amazon.com/ses/latest/dg/pricing-plans.html
  quotas: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
  sandbox: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
  sending_limits: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
  enforcement: https://docs.aws.amazon.com/ses/latest/dg/faqs-enforcement.html
  reputation: https://docs.aws.amazon.com/ses/latest/dg/reputation-dashboard-dg.html
  dedicated_ips: https://docs.aws.amazon.com/ses/latest/dg/dedicated-ip.html
  regions: https://docs.aws.amazon.com/ses/latest/dg/regions.html
read:
  - pricing plans (Essentials, Pro, Enterprise) versus à la carte, per account and Region; that accounts with no SES activity are put on Essentials by default, and which plan is cheaper for the project's volume (plan fixed fee and per-email rate against à la carte)
  - per-email outbound and inbound rates, the per-GB attachment charge, and that charges count recipients, not messages
  - add-ons and their fixed monthly fees (dedicated IPs standard and managed, BYOIP, Virtual Deliverability Manager, Global Endpoints, tenants, Mail Manager ingress endpoints, which bill even when closed)
  - sandbox limits per Region (verified recipients only, daily cap, send rate) and the production access request
  - sending quota (rolling 24 hours) and maximum send rate, per Region; what happens at the limit (requests rejected) and how increases are requested
  - message size limit for the v1 and v2 APIs
  - sending review: account under review, sending pause, and the bounce and complaint rates that trigger them
usage_questions:
  - metric: monthly_sent
    ask: Emails sent (recipients) last month, and the month before?
    where: Billing and Cost Management → Bills → Charges by service → Simple Email Service; SES console → Virtual Deliverability Manager → Dashboard if enabled
  - metric: daily_peak
    ask: Highest emails in 24 hours, and the sending quota and max send rate today?
    where: SES console → Account dashboard → Sending limits and Daily email usage (each Region used)
  - metric: sandbox
    ask: Is the account still in the SES sandbox in the production Region?
    where: SES console → Account dashboard (sandbox banner) → Get set up
  - metric: billing_plan
    ask: Which SES pricing plan or à la carte, per Region?
    where: SES console → Pricing plan
  - metric: reputation
    ask: Current bounce and complaint rates and account status?
    where: SES console → Account dashboard → Reputation metrics
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - request production access with a verified domain well before launch, in the Region the app sends from
  - compare Essentials with à la carte for the volume and cancel a defaulted plan if à la carte is cheaper (the first downgrade from a default plan is immediate)
  - handle bounce and complaint notifications and use the account-level suppression list
  - set CloudWatch alarms on bounce and complaint rates and turn on automatic sending pause for a configuration set
  - link large attachments instead of attaching them
  - delete Mail Manager ingress endpoints that are not used
verified: 2026-10-11
---

- `nodemailer` with the SES transport needs `@aws-sdk/client-sesv2`, so the package finds it; plain SMTP is found by the `email-smtp.` host in code or YAML. Laravel, Rails and Java SES setups are not scanned; ask.
- `aws_ses` alone would match `aws_session`, so the signals use `aws_ses_`, `aws_sesv2_` and the CDK forms.
- Cognito sends verification email through SES when configured; that mail is billed here.
- Sandbox, quotas, plan and reputation are per Region: check the Region the code sends from.
- Amazon SES with Resend, Postmark, SendGrid or Mailgun is Overlap unless one sends transactional and the other marketing on purpose.
