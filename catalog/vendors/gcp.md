---
schema: 1
id: gcp
name: Google Cloud
roles: [other]
detect:
  packages: ["@google-cloud/", "@pulumi/gcp"]
  imports: ["@google-cloud/", "@pulumi/gcp"]
  pypi: ["google-cloud-*", "pulumi-gcp"]
  go: ["cloud.google.com/go", "github.com/pulumi/pulumi-gcp/sdk"]
  env_prefixes: ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "GOOGLE_CLOUD_REGION", "GCLOUD_PROJECT", "GCP_PROJECT", "GCP_REGION", "CLOUDSDK_"]
  service_signals: ['provider "google"', 'provider "google-beta"', 'hashicorp/google"', 'hashicorp/google-beta"', 'resource "google_', 'data "google_', "cnrm.cloud.google.com", "gcp-types/", "gcp:project:", "gcloud run deploy", "gcloud functions deploy", "gcloud app deploy"]
  config_files: ["cloudbuild.yaml", "cloudbuild.yml", "cloudbuild.json", ".gcloudignore"]
pages:
  pricing: https://cloud.google.com/pricing
  skus: https://cloud.google.com/skus
  free_program: https://docs.cloud.google.com/free/docs/free-cloud-features
  budgets: https://docs.cloud.google.com/billing/docs/how-to/budgets
  spend_caps: https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
  disable_billing: https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
  anomalies: https://docs.cloud.google.com/billing/docs/how-to/manage-anomalies
  reports: https://docs.cloud.google.com/billing/docs/how-to/reports
  billing_export: https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-setup
  project_billing: https://docs.cloud.google.com/billing/docs/how-to/modify-project
  network_pricing: https://cloud.google.com/vpc/network-pricing
  nat_pricing: https://cloud.google.com/nat/pricing
  cuds: https://docs.cloud.google.com/docs/cuds
  support_pricing: https://cloud.google.com/support
  quotas: https://docs.cloud.google.com/docs/quotas/overview
  regions: https://cloud.google.com/about/locations
  data_residency: https://cloud.google.com/terms/data-residency
  compliance: https://cloud.google.com/security/compliance/offerings
  services_in_scope: https://cloud.google.com/security/compliance/services-in-scope
  hipaa: https://docs.cloud.google.com/docs/security/compliance/hipaa
  dpa: https://cloud.google.com/terms/data-processing-addendum
read:
  - pay-as-you-go per SKU, charged to the Cloud Billing account linked to each project; the service maps say how each service bills
  - "Free Trial: Welcome credit for a set number of days (no GPUs, Marketplace or quota increases; not for the Gemini API in AI Studio); when credit or days run out without an upgrade the account closes, resources stop and are deleted after a grace period; an upgrade keeps resources and the credit until the original end date"
  - Free Tier monthly allowances per billing account, with no end date
  - "budgets alert on actual or forecast cost and do not cap; a Pub/Sub budget notification can run a function that disables billing on the project (stops every service, data may be deleted); spend cap budgets (Preview) pause new usage of one eligible service in one project until the month ends, on estimated gross cost, not instantly, and leave persistent resources running"
  - anomaly alerts, early signals for AI spend, and the lag before costs reach reports
  - billing export to BigQuery (standard, detailed, pricing, FOCUS) and how much history a new export gets by dataset location
  - "network: ingress free; internet egress per GiB by Network Service Tier (Premium is the default, Standard is cheaper with its own free allowance) and by source and destination; inter-zone and inter-region VM traffic charged"
  - external IPv4 addresses charged per hour on VMs and at a higher rate when reserved but unused; addresses on forwarding rules and IPv6 not charged; load balancer forwarding rules charged per hour even with no traffic; Cloud NAT charged per gateway hour by VM count, per GiB processed and per NAT IP
  - committed use discounts (resource-based or spend-based, one or three years) and automatic sustained use discounts on some machine series
  - Customer Care plans (Basic free; Standard, Enhanced and Premium priced as the greater of a minimum or a share of monthly spend)
  - "quotas per project, lower on Free Trial accounts; increases are reviewed against account history and may need prepayment; a per-user project count limit"
  - regions and multi-regions, and the services with a data location commitment
  - certifications (SOC 1/2/3, ISO 27001/27017/27018, PCI DSS, FedRAMP, C5) with per-service scope, the HIPAA BAA accepted in the console and its covered products, the Cloud Data Processing Addendum with SCCs
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date cost, forecast for the month, and last month's invoice?
    where: Billing → Overview; Billing → Reports (Time range Billing period for invoice totals; clear Promotions under Savings to see cost before credits)
  - metric: cost_by_service
    ask: Top services, SKUs and projects by cost this month and last month?
    where: Billing → Reports → Group by Service, then SKU or Project (preset reports Services, SKUs, Projects this month)
  - metric: transfer_tb
    ask: Data transfer, Cloud NAT, load balancer and external IP cost this month?
    where: Billing → Reports → Group by SKU, filter Networking and Compute Engine, look for data transfer, NAT, forwarding rule and IP SKUs
  - metric: region
    ask: Which regions and projects have spend?
    where: Billing → Reports → Group by Location; Billing → Account management → Projects linked to this billing account
  - metric: budgets
    ask: Are budgets, spend cap budgets or anomaly alerts set, and at what amounts?
    where: Billing → Budgets & alerts (Spend cap status column); Billing → Anomalies
  - metric: plan
    ask: Free Trial or Paid billing account, credit and days left, and Customer Care plan?
    where: Billing → Overview (Free credit pane, Activate button); Billing → Credits; console Support page
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - create a budget with forecast thresholds on every billing account and keep anomaly alerts on
  - set spend cap budgets on Cloud Run, Cloud Run functions, Gemini API and Vertex AI projects; a hard stop elsewhere needs the disable-billing function, which stops the whole project
  - upgrade the Free Trial billing account before its credit or days run out if the app must stay up
  - release unused static external IPs and delete idle forwarding rules, load balancers and NAT gateways in every project
  - keep chatty services in one zone, and use Standard Tier where latency allows
  - shut down forgotten projects linked to the billing account
  - enable billing export to a multi-region BigQuery dataset early, since history is limited
  - buy committed use discounts only for steady baseline usage
verified: 2026-10-11
---

- Found from `@google-cloud/*` SDKs, Pulumi, Terraform `google` resources, Config Connector or Cloud Build files. Each service has its own map (`gcp-cloud-run` and so on); read this one once for the account.
- `googleapis`, `google-api-python-client`, `google.golang.org/api`, `google-auth-library`, `google-auth`, `@google-cloud/local-auth` and `GOOGLE_APPLICATION_CREDENTIALS` also serve Gmail, Drive, Sheets and Maps, so they are not signals; `@google-cloud/local-auth` alone is a Workspace OAuth helper, not Google Cloud.
- Firebase and AI Studio create Google Cloud projects with no billing account. Once one is linked (Blaze, Gemini paid tier), they bill on that account: the budgets, spend caps and reports here cover them.
- On a Free Trial account, reports with credits show near zero: real usage is charged after the upgrade. A production app on a Free Trial is a Bill finding with its end date.
- Deployment Manager (`gcp-types/` in YAML) lost support on 2026-03-31 and is turned down on 2027-06-30: a Fit note to move to Infrastructure Manager or Terraform.
- docs.cloud.google.com pages have a `.md.txt` twin (append it to the path); cloud.google.com pricing pages are plain HTML.
- The remote Cloud Billing MCP server (Preview) lists billing accounts, linked projects and prices but no costs, and also has create, move and set_iam_policy tools. The remote Google Cloud CLI MCP and gcloud MCP without an allowlist run any gcloud command, including reading secrets. Do not use them.
