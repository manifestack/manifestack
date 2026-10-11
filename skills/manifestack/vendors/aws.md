---
# generated, edit catalog/vendors/aws.md (then run: node tools/sync.mjs)
schema: 1
id: aws
name: AWS
roles: [other]
detect:
  packages: ["@aws-sdk/", "aws-sdk", "aws-cdk-lib", "aws-cdk", "@aws-cdk/", "@pulumi/aws"]
  imports: ["@aws-sdk/", "aws-sdk", "aws-cdk-lib", "@aws-cdk/"]
  pypi: ["boto3", "botocore", "aiobotocore", "aws-cdk-lib", "aws-cdk*", "awscli", "pulumi-aws"]
  go: ["github.com/aws/aws-sdk-go-v2", "github.com/aws/aws-sdk-go", "github.com/aws/aws-cdk-go/awscdk", "github.com/pulumi/pulumi-aws/sdk"]
  env_prefixes: ["AWS_PROFILE", "AWS_DEFAULT_REGION", "AWS_ACCOUNT_ID", "AWS_ROLE_ARN", "CDK_DEFAULT_"]
  service_signals: ['provider "aws"', "AnthropicBedrock", "hashicorp/aws", "AWSTemplateFormatVersion", "AWS::Serverless-2016-10-31", "sst.aws."]
  config_files: ["cdk.json", "samconfig.toml", "samconfig.yaml", "samconfig.yml", "buildspec.yml", "appspec.yml", "Dockerrun.aws.json"]
pages:
  pricing: https://aws.amazon.com/pricing/
  free_plan: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html
  sign_up_options: https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html
  spend_limit: https://docs.aws.amazon.com/accounts/latest/reference/create-spend-limit.html
  project_regions: https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html
  budgets: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
  budgets_pricing: https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/
  cost_explorer: https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html
  cost_explorer_pricing: https://aws.amazon.com/aws-cost-management/aws-cost-explorer/pricing/
  anomaly_detection: https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html
  data_transfer: https://aws.amazon.com/ec2/pricing/on-demand/
  vpc_pricing: https://aws.amazon.com/vpc/pricing/
  support_pricing: https://aws.amazon.com/premiumsupport/pricing/
  support_plans_eos: https://docs.aws.amazon.com/awssupport/latest/user/support-plans-eos.html
  savings_plans: https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html
  regions: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
  compliance: https://aws.amazon.com/compliance/programs/
  services_in_scope: https://aws.amazon.com/compliance/services-in-scope/
  hipaa: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/
  gdpr: https://aws.amazon.com/compliance/gdpr-center/
read:
  - pay-as-you-go per service and Region; the service maps say how each service bills
  - "account plan: Free plan (credits only, a reduced service list, ends at the earlier of its time limit or credit exhaustion, then the account is closed and erased after a 90-day window to upgrade) versus Paid plan; sign-up credit and activity credits, their expiry, and the Always Free and short-term trial offers"
  - "sign-up type: the new experience (projects, a fixed home Region by contact country, spend limits, reduced service list) versus advanced sign-up or activated advanced features (all Regions, Budgets, no spend limit)"
  - "spend limit on a Paid-plan project: minimum, notification thresholds, optional early controls (stop new launches, pause idle, pause top cost drivers) and that the project is paused at the limit; otherwise nothing caps spend"
  - Budgets alert on actual or forecast cost and are not a cap; budget actions can apply an IAM policy or SCP or stop chosen EC2 and RDS instances; free action-enabled budgets and report charges; data refreshes several times a day
  - Cost Explorer UI is free and its API is charged per request; data lags up to a day
  - internet egress free allowance aggregated across services and Regions, then tiered per GB; inter-AZ and inter-Region transfer charged; NAT Gateway hourly plus per-GB processing; gateway VPC endpoints for S3 and DynamoDB carry no charge
  - every public IPv4 address is charged per hour, in use or idle
  - support plans (Basic included; Business Support+ priced as the greater of a minimum or a share of the monthly bill) and the end of Developer and Business Support
  - Savings Plans types and Reserved Instances with their one or three year term
  - Regions, opt-in Regions, and that content stays in the chosen Region
  - certifications (SOC 1/2/3, ISO 27001, PCI DSS, FedRAMP, C5), per-service scope, HIPAA-eligible services with a BAA accepted in AWS Artifact, the GDPR DPA in the Service Terms
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date cost and the forecast for this month, and last month's bill?
    where: Billing and Cost Management → Home → Cost summary (excludes credits) and Bills; new-experience accounts: AWS Settings (settings.aws.com) → Billing
  - metric: cost_by_service
    ask: Top services by cost this month and last month?
    where: Billing and Cost Management → Cost Explorer → Group by Service, monthly granularity; the EC2-Other line holds NAT Gateway, EBS and data transfer
  - metric: transfer_tb
    ask: Data transfer and NAT Gateway cost this month?
    where: Cost Explorer → Filters → Usage type group (EC2: Data Transfer - Internet (Out), Inter AZ, Region to Region (Out)); Group by Usage type for NatGateway and PublicIPv4 lines
  - metric: region
    ask: Which Regions have any spend or resources?
    where: Cost Explorer → Group by Region, last three months; new-experience projects: AWS Settings → Project → Overview → Additional Info
  - metric: budgets
    ask: Are budgets, budget actions, an anomaly monitor or a spend limit set, and at what thresholds?
    where: Billing and Cost Management → Budgets; Cost Anomaly Detection → Monitors; AWS Settings → Billing → Spend limit
  - metric: plan
    ask: Free plan or Paid plan, days left on the Free plan, credits remaining and their expiry, support plan?
    where: Console Home → Cost and usage widget; Billing and Cost Management → Credits and Free Tier; Support Center → Support plans
mcp:
  official: true
  readonly_flag: "always read-only for the listed tools: uvx awslabs.billing-cost-management-mcp-server@latest the listed tools only read (storage-lens, not listed, creates Athena resources); run it with a billing read-only IAM role; each Cost Explorer API call is billed"
  allowed_tools: [cost-explorer, cost-comparison, budgets, cost-anomaly, free-tier-usage, credits, cost-optimization, compute-optimizer]
common_fixes:
  - create a cost budget with forecast alerts and an anomaly monitor, or a spend limit on a new-experience project (only the spend limit or a budget action stops resources)
  - delete idle NAT Gateways, use one per VPC for dev, and add gateway VPC endpoints for S3 and DynamoDB traffic
  - release unused Elastic IPs and drop public IPv4 addresses that are not needed (IPv6, a load balancer, or private subnets)
  - delete unattached EBS volumes, old snapshots and AMIs, checking every Region used
  - find resources in forgotten Regions and restrict Regions with an SCP
  - set CloudWatch Logs retention instead of never expire
  - buy a Compute or Database Savings Plan only for steady baseline usage after a few months of history
  - upgrade from the Free plan before its end date if the app must stay up
verified: 2026-10-11
---

- Found from the SDKs, CDK, SAM, CodeBuild, CodeDeploy and Beanstalk files, a Terraform `aws` provider or a CloudFormation template. Each service the project uses has its own map (`aws-s3`, `aws-lambda` and so on) with how that service bills; read this map once for the account.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` and `AWS_ENDPOINT_URL*` also serve S3-compatible storage (R2, Spaces, Tigris) and show up in Vercel Functions, so they are not signals.
- `aws-sdk` (JS v2) reached end of support on 2025-09-08 and `github.com/aws/aws-sdk-go` (Go v1) on 2025-07-31: a Fit note to migrate. AWS CLI v1 is in maintenance mode.
- Accounts created since 2025-07-15 choose a Free or Paid plan; a Free-plan account is closed when its time or credits run out, so a launch on it is a Bill finding with a date. Older accounts keep the 12-month Free Tier.
- The Cost summary excludes credits; a bill covered by credits hides real usage that will be charged once they expire.
- docs.aws.amazon.com pages have a `.md` twin. aws.amazon.com pricing pages fill prices in with JavaScript; the Price List API serves them as JSON at `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/<ServiceCode>/current/<region>/index.json` (AmazonS3, AmazonRDS, AmazonDynamoDB, AWSLambda and so on).
- AWS MCP Server (remote, Agent Toolkit for AWS) and `awslabs.aws-api-mcp-server` run any API or Python script; read-only depends on IAM (`READ_OPERATIONS_ONLY` only filters write calls) and reads still return secrets such as Lambda environment variables. Do not use them.
