---
# generated, edit catalog/vendors/aws-ecs-fargate.md (then run: node tools/sync.mjs)
schema: 1
id: aws-ecs-fargate
name: Amazon ECS on Fargate and AWS App Runner
family: aws
roles: [hosting]
detect:
  packages: ["@aws-sdk/client-ecs", "@aws-sdk/client-apprunner", "@aws-cdk/aws-apprunner-alpha"]
  go: ["github.com/aws/aws-sdk-go-v2/service/ecs", "github.com/aws/aws-sdk-go-v2/service/apprunner"]
  imports: ["@aws-sdk/client-ecs", "@aws-sdk/client-apprunner"]
  config_files: ["apprunner.yaml", "copilot/.workspace"]
  service_signals: ["client('ecs'", "client(\"ecs\"", "client('apprunner'", "client(\"apprunner\"", "aws_ecs_service", "aws_ecs_task_definition", "aws_ecs_express_gateway_service", "aws_apprunner_service", "AWS::ECS::Service", "AWS::ECS::TaskDefinition", "AWS::ECS::ExpressGatewayService", "AWS::AppRunner::Service", "aws-cdk-lib/aws-ecs", "aws-cdk-lib/aws-apprunner", "@aws-cdk/aws-apprunner-alpha", "aws_cdk.aws_ecs", "new AWS.ECS(", "aws-sdk-go/service/ecs", "sst.aws.Service(", "aws:ecs:Service", "Load Balanced Web Service", "Request-Driven Web Service", "aws_ecs as", "aws.ecs."]
pages:
  pricing: https://aws.amazon.com/fargate/pricing/
  ecs_pricing: https://aws.amazon.com/ecs/pricing/
  quotas: https://docs.aws.amazon.com/general/latest/gr/ecs-service.html
  fargate_spot: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
  express_mode: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html
  load_balancer_pricing: https://aws.amazon.com/elasticloadbalancing/pricing/
  apprunner_pricing: https://aws.amazon.com/apprunner/pricing/
  apprunner_availability: https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
read:
  - Fargate vCPU-hour and GB-hour rates by OS and architecture (ARM is cheaper), per second with a one-minute minimum, from image pull until the task stops
  - ephemeral storage above the included default
  - Fargate Spot discount and the two-minute interruption warning
  - no ECS fee on Fargate or EC2; ECS Managed Instances adds a per-instance management fee
  - Express Mode is free but creates a Fargate service, an ALB, logs and scaling
  - ALB hours (partial hours billed as full) plus LCUs; each load balancer adds a fixed monthly floor
  - public IPv4 on tasks, logs, Container Insights and ECR bill separately
  - Compute Savings Plans cover Fargate
  - quota names - Fargate On-Demand vCPU resource count, Fargate Spot vCPU resource count, launch rates, Services per cluster, Tasks per service
  - App Runner is closed to new customers (existing ones keep running, no new features); provisioned GB-hours while idle, active vCPU and GB-hours, automatic deployment fee per app, build minutes
usage_questions:
  - metric: monthly_bill
    ask: Container and load balancer cost last month by usage type?
    where: Cost Explorer → Service = Amazon Elastic Container Service, AWS App Runner, Elastic Load Balancing → Group by Usage type
  - metric: instances
    ask: Running tasks per service, task CPU and memory, and FARGATE vs FARGATE_SPOT?
    where: ECS console → Clusters → cluster → Services → service (Tasks, task definition, capacity provider strategy)
  - metric: cpu_utilization
    ask: Average and peak CPU and memory utilization per service?
    where: ECS console → Clusters → cluster → Services → service → Metrics
  - metric: apprunner_instances
    ask: App Runner active instances and requests?
    where: App Runner console → Services → service → Metrics
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - use ARM64 task definitions where images support it
  - right-size task CPU and memory; lower the minimum task count; scale non-production to zero off hours
  - Fargate Spot for interruption-tolerant workers
  - share one ALB across services with host or path rules
  - set log retention; enable Container Insights only where needed; add ECR lifecycle policies
  - Compute Savings Plan for a steady baseline
  - plan an App Runner move to ECS Express Mode
verified: 2026-10-11
---

- ECS on EC2 shares these signals; its instances bill as EC2 (aws-ec2-lightsail). EKS is not covered.
- `copilot/.workspace` means AWS Copilot CLI, which reached end of support; that is a Risk finding.
- A new account cannot use App Runner. A plan that names it is a Requirement finding; suggest ECS Express Mode.
- ECS beside another host is an Overlap unless split on purpose (API on ECS, frontend elsewhere).
- The ECS MCP server gates writes behind `ALLOW_WRITE`, but one tool mixes reads and writes; the family map decides AWS MCP use.
