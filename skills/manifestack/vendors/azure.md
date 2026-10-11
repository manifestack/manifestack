---
# generated, edit catalog/vendors/azure.md (then run: node tools/sync.mjs)
schema: 1
id: azure
name: Microsoft Azure
roles: [other]
detect:
  packages: ["@azure/", "@azure-rest/", "@pulumi/azure-native", "@pulumi/azure"]
  imports: ["@azure/", "@azure-rest/", "@pulumi/azure-native", "@pulumi/azure"]
  pypi: ["azure-*", "!azure-devops", "pulumi-azure-native", "pulumi-azure"]
  go: ["github.com/Azure/azure-sdk-for-go", "github.com/Azure/go-autorest", "github.com/pulumi/pulumi-azure-native-sdk", "github.com/pulumi/pulumi-azure/sdk"]
  env_prefixes: ["AZURE_SUBSCRIPTION_ID", "AZURE_RESOURCE_GROUP", "AZURE_LOCATION", "AZURE_ENV_NAME", "ARM_SUBSCRIPTION_ID"]
  service_signals: ["AzureOpenAI(", "AzureChatOpenAI", "AzureOpenAIEmbeddings", ".openai.azure.com", ".redis.cache.windows.net", ".documents.azure.com", ".servicebus.windows.net", 'provider "azurerm"', 'provider "azapi"', 'backend "azurerm"', 'hashicorp/azurerm"', 'azure/azapi"', 'resource "azurerm_', 'data "azurerm_', "targetScope = 'subscription'", "resourceGroup().location", "'Microsoft.Resources/resourceGroups@", "br/public:avm/", "azd-env-name", "azure-native:", "management.azure.com", "azureSubscription:", "az group create", "az deployment ", "az webapp ", "az containerapp ", "az functionapp ", "azd provision", "azd deploy", "azure/login@", "deploymentTemplate.json#"]
  config_files: ["azure.yaml", ".azure/config.json", "bicepconfig.json"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/
  free_account: https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account
  free_account_charges: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/avoid-charges-free-account
  upgrade: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/upgrade-azure-subscription
  spending_limit: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit
  students: https://learn.microsoft.com/en-us/azure/education-hub/about-azure-for-students
  billing_accounts: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/view-all-accounts
  budgets: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets
  cost_alerts: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending
  anomalies: https://learn.microsoft.com/en-us/azure/cost-management-billing/understand/analyze-unexpected-charges
  cost_analysis: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis
  exports: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-improved-exports
  bandwidth: https://azure.microsoft.com/en-us/pricing/details/bandwidth/
  ip_pricing: https://azure.microsoft.com/en-us/pricing/details/ip-addresses/
  nat_pricing: https://azure.microsoft.com/en-us/pricing/details/azure-nat-gateway/
  default_outbound: https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/default-outbound-access
  reservations: https://learn.microsoft.com/en-us/azure/cost-management-billing/reservations/save-compute-costs-reservations
  savings_plans: https://learn.microsoft.com/en-us/azure/cost-management-billing/savings-plan/savings-plan-overview
  support_plans: https://azure.microsoft.com/en-us/support/plans/
  regions: https://learn.microsoft.com/en-us/azure/reliability/regions-list
  data_residency: https://azure.microsoft.com/en-us/explore/global-infrastructure/data-residency/
  compliance: https://learn.microsoft.com/en-us/azure/compliance/
  hipaa: https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-hipaa-us
  dpa: https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
read:
  - pay-as-you-go per meter, charged to a subscription; resource groups group resources inside it; the service maps say how each service bills
  - "billing account: Microsoft Online Services Program (most website sign-ups, invoice per subscription), Microsoft Customer Agreement (billing profiles, invoice sections) or Enterprise Agreement (enrollment, prepayment)"
  - "free account: credit for a set number of days, 12-month free services and always-free monthly amounts that do not roll over; when credit or days run out the subscription is disabled (VMs deallocated, storage read-only) until an upgrade; an upgrade keeps the credit until the original end date, and 12-month services continue only after an upgrade within the trial"
  - "spending limit: on by default only on the free account and offers with monthly credits (Visual Studio); equal to the credit; at the limit services are disabled for the billing period; on Visual Studio-type offers removable for good or for one period, on a free account only by upgrading; pay-as-you-go and commitment plans have none, so nothing caps spend"
  - Azure for Students credit, its validity and yearly renewal, and what happens when it runs out
  - budgets alert on actual or forecast cost and never stop resources; at subscription or resource group scope a budget can call an action group that runs automation; cost data lags by hours and budgets are evaluated daily
  - anomaly alerts per subscription (daily, after a delay), credit alerts (EA prepayment only), scheduled exports to a storage account (FOCUS, price sheet)
  - "bandwidth: ingress and same-zone transfer free; internet egress free allowance per month, then tiered per GB by source continent, Microsoft network versus routing preference Internet; inter-region transfer per GB by continent"
  - every Standard public IPv4 address and prefix is charged per hour, attached or not; NAT Gateway per hour from creation plus per GB processed; virtual networks created with API versions after 2026-03-31 need an explicit outbound method
  - reservations (one or three years, up front or monthly, exchange and refund limits) and savings plans for compute and databases
  - support plans (Basic included; Developer, Standard and Professional Direct at a fixed monthly price; Unified)
  - regions with availability zones; customer data stays in the chosen geography for most services
  - certifications (SOC 1/2/3, ISO 27001/27017/27018, PCI DSS, FedRAMP High) with per-service scope, the HIPAA BAA in the Product Terms for in-scope services, the Products and Services DPA
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date cost and forecast for this month, and last month's invoice?
    where: Cost Management → Cost analysis (scope Subscription or Billing account) → Services view, Total cost KPI; Accumulated costs view with forecast; Cost Management + Billing → Invoices
  - metric: cost_by_service
    ask: Top services, resource groups and meters by cost this month and last month?
    where: Cost Management → Cost analysis → Services and Resource groups smart views; expand rows for meters
  - metric: transfer_tb
    ask: Bandwidth, NAT Gateway and public IP cost this month?
    where: Cost analysis → group by Service name, then Meter; look for data transfer, NAT Gateway and IP address meters
  - metric: region
    ask: Which regions and subscriptions have spend or resources?
    where: Cost analysis → group by Location and by Subscription, last three months
  - metric: budgets
    ask: Are budgets, action groups and anomaly alerts set, and at what thresholds?
    where: Cost Management → Budgets; Cost Management → Cost alerts → Alert rules
  - metric: plan
    ask: Offer type (free account, pay-as-you-go, Visual Studio, Students, MCA, EA), credit left and expiry, spending limit on or off?
    where: Subscriptions → subscription → Overview (offer, spending limit banner, free services grid, credit remaining); Cost Management + Billing → Credits (Microsoft Customer Agreement)
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with an explicit tool list: npx -y @azure/mcp@latest server start --read-only --tool subscription_list --tool group_list --tool group_resource_list --tool pricing_get --tool advisor_recommendation_list"
  allowed_tools: [subscription_list, group_list, group_resource_list, pricing_get, advisor_recommendation_list]
common_fixes:
  - create a monthly budget with actual and forecast thresholds on every subscription and an anomaly alert rule
  - keep the spending limit on credit offers used for testing; upgrade a free account before credit or days run out if the app must stay up
  - delete unattached public IPs, idle NAT Gateways and load balancers, and resources in forgotten regions and resource groups
  - start a cost export early for history
  - buy reservations or a savings plan only for steady baseline usage
verified: 2026-10-11
---

- Found from the SDKs, Pulumi, Terraform `azurerm` or `azapi`, Bicep or `azure.yaml` (Azure Developer CLI). Each service has its own map; read this one once for the account.
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `@azure/identity` alone also serve Microsoft Graph apps with no Azure subscription, so the env names are not signals; ask. PyPI `azure-devops` (excluded) and `azure-pipelines.yml` are Azure DevOps, billed apart; ask.
- On a free account or Students subscription, cost views show charges covered by credit; real usage is billed after the upgrade. A production app on one is a Bill finding with its end date.
- A spending limit stops services and can lose virtual IP settings; budgets stop nothing unless an action group runs automation.
- Pricing pages fill prices in by script; the Retail Prices API serves list prices as JSON without sign-in: `https://prices.azure.com/api/retail/prices?$filter=serviceName eq '<name>'`.
- MCP (`@azure/mcp`, generally available as 2.x; `@latest` currently installs a 3.0 beta): `--read-only` still allows reads of secrets (never pass `--dangerously-disable-elicitation`), documents and log rows; start it only with the `--tool` list. No tool returns actual cost.
