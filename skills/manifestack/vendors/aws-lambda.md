---
# generated, edit catalog/vendors/aws-lambda.md (then run: node tools/sync.mjs)
schema: 1
id: aws-lambda
name: AWS Lambda
family: aws
roles: [hosting]
detect:
  packages: ["@aws-sdk/client-lambda", "@aws-lambda-powertools/", "aws-lambda-ric", "@codegenie/serverless-express", "@vendia/serverless-express", "serverless"]
  pypi: ["aws-lambda-powertools", "awslambdaric", "mangum", "chalice", "zappa"]
  go: ["github.com/aws/aws-sdk-go-v2/service/lambda", "github.com/aws/aws-lambda-go", "github.com/awslabs/aws-lambda-go-api-proxy"]
  imports: ["@aws-sdk/client-lambda", "@aws-lambda-powertools/", "hono/aws-lambda", "@codegenie/serverless-express", "@vendia/serverless-express"]
  config_files: ["serverless.yml", "serverless.yaml", "serverless.ts", ".chalice/config.json", "zappa_settings.json"]
  service_signals: ["client('lambda'", "client(\"lambda\"", "aws_lambda_function", "AWS::Lambda::Function", "AWS::Lambda::Url", "AWS::Serverless::Function", "aws-cdk-lib/aws-lambda", "aws_cdk.aws_lambda", "new AWS.Lambda(", "aws-sdk-go/service/lambda", "sst.aws.Function(", "aws:lambda:Function", "from 'aws-lambda'", "from \"aws-lambda\"", "aws.lambda.Function", "aws.lambda_.Function", "aws_lambda as"]
  role_signals:
    hosting: ["@aws-lambda-powertools/", "aws-lambda-ric", "@codegenie/serverless-express", "@vendia/serverless-express", "hono/aws-lambda", "aws_lambda_powertools", "awslambdaric", "mangum", "chalice", "zappa", "aws-lambda-go", "aws_lambda_function", "AWS::Lambda::Function", "AWS::Serverless::Function", "aws-cdk-lib/aws-lambda", "aws_cdk.aws_lambda", "aws_lambda as", "sst.aws.Function(", "aws:lambda:Function", "aws.lambda.Function", "aws.lambda_.Function", "from 'aws-lambda'", "from \"aws-lambda\"", "(event, context)", "runtime: nodejs", "runtime: python3", "runtime: provided", "Runtime: nodejs", "Runtime: python3"]
pages:
  pricing: https://aws.amazon.com/lambda/pricing/
  quotas: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
  concurrency: https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html
  provisioned_concurrency: https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html
  architectures: https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html
  function_urls: https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html
  recursion: https://docs.aws.amazon.com/lambda/latest/dg/invocation-recursion.html
  runtimes: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
read:
  - request and duration (GB-second) rates for x86 and Arm, the volume tiers, and the monthly free requests and GB-seconds
  - init (cold start) time is billed; memory sets CPU; extra ephemeral storage and response streaming bytes are billed
  - Provisioned Concurrency billed from enable to disable whether used or not, and the free tier does not apply to it
  - SnapStart cache and restore charges (non-Java runtimes)
  - if used - Managed Instances (EC2 price plus management fee), durable functions, tenant isolation, MicroVMs, provisioned event pollers
  - quota names - Concurrent executions (reduced for new accounts; throttling past it), Function timeout, payload and deployment package size, code storage
  - runtime deprecation dates (block function create, then update)
  - Compute Savings Plans cover Lambda duration and Provisioned Concurrency
usage_questions:
  - metric: monthly_bill
    ask: Lambda cost last month by usage type?
    where: Billing and Cost Management → Cost Explorer → Service = AWS Lambda → Group by Usage type
  - metric: invocations
    ask: Invocations last month, all functions?
    where: CloudWatch → Metrics → Lambda → Across All Functions → Invocations (Sum)
  - metric: concurrency_peak
    ask: Peak concurrent executions vs the account quota?
    where: CloudWatch → Lambda → Across All Functions → ConcurrentExecutions (Maximum); Service Quotas → AWS Lambda → Concurrent executions
  - metric: provisioned
    ask: Which functions keep Provisioned Concurrency, how much, and when?
    where: Lambda console → function → Configuration → Concurrency
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - move functions to arm64 where dependencies allow
  - right-size memory from Compute Optimizer or a power-tuning run
  - schedule Provisioned Concurrency for peak hours only
  - reserved concurrency on functions that can loop or fan out; keep recursive loop detection on
  - set retention and log level on function log groups
  - Compute Savings Plan for steady duration
  - upgrade runtimes before the block dates
verified: 2026-10-11
---

- `@aws-sdk/client-lambda` or `client('lambda'` means the app calls Lambda; handler types, Powertools and IaC show code that runs on it.
- `serverless.yml` is detected directly; check `provider.name` is aws.
- Lambda beside another host is an Overlap only when the same web traffic runs on both; jobs or webhooks on Lambda are a split.
- A function URL with auth type NONE is public; abuse becomes a Bill finding.
- Function logs bill under CloudWatch Logs and can cost more than compute; API Gateway bills separately.
- The `hosting` role needs code or infrastructure that runs on Lambda (handlers, Powertools, adapters, IaC); calling Lambda from another host (`InvokeCommand`) lists the map without it.
