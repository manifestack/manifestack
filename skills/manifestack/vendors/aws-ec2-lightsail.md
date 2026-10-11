---
# generated, edit catalog/vendors/aws-ec2-lightsail.md (then run: node tools/sync.mjs)
schema: 1
id: aws-ec2-lightsail
name: Amazon EC2 and Lightsail
family: aws
roles: [hosting]
detect:
  packages: ["@aws-sdk/client-ec2", "@aws-sdk/client-lightsail"]
  go: ["github.com/aws/aws-sdk-go-v2/service/ec2", "github.com/aws/aws-sdk-go-v2/service/lightsail"]
  imports: ["@aws-sdk/client-ec2", "@aws-sdk/client-lightsail"]
  service_signals: ["\"aws_instance\"", "aws_launch_template", "aws_autoscaling_group", "aws_spot_instance_request", "aws_lightsail_instance", "AWS::EC2::Instance", "AWS::EC2::LaunchTemplate", "AWS::AutoScaling::AutoScalingGroup", "AWS::Lightsail::Instance", "ec2.Instance(", "client('ec2'", "client(\"ec2\"", "resource('ec2'", "client('lightsail'", "client(\"lightsail\"", "new AWS.EC2(", "new AWS.Lightsail(", "aws-sdk-go/service/ec2", "aws:ec2:Instance", "aws.ec2.Instance(", "aws.lightsail.Instance("]
  role_signals:
    hosting: ["\"aws_instance\"", "aws_launch_template", "aws_autoscaling_group", "aws_spot_instance_request", "aws_lightsail_instance", "AWS::EC2::Instance", "AWS::EC2::LaunchTemplate", "AWS::AutoScaling::AutoScalingGroup", "AWS::Lightsail::Instance", "ec2.Instance(", "RunInstances", "run_instances(", "aws:ec2:Instance", "aws.ec2.Instance(", "aws.lightsail.Instance(", "@aws-sdk/client-lightsail", "service/lightsail", "client('lightsail'", "client(\"lightsail\"", "new AWS.Lightsail("]
pages:
  pricing: https://aws.amazon.com/ec2/pricing/on-demand/
  savings_plans: https://aws.amazon.com/savingsplans/compute-pricing/
  ebs_pricing: https://aws.amazon.com/ebs/pricing/
  quotas: https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-instance-quotas.html
  billing_by_state: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html
  burstable_unlimited: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances-unlimited-mode-concepts.html
  lightsail_pricing: https://aws.amazon.com/lightsail/pricing/
  lightsail_billing: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html
  lightsail_transfer: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html
read:
  - On-Demand rate per instance type and Region, billed per second with a minimum (some OS hourly)
  - Spot discount and interruptions; Compute vs EC2 Instance Savings Plans and Reserved Instances terms
  - EBS gp3 vs gp2 per GB-month, gp3 IOPS and throughput above the included baseline, snapshot Standard vs Archive tiers, Recycle Bin billed like the source
  - a stopped instance stops instance-hours but its EBS volumes keep billing
  - T3, T3a, T4g and T8i launch in unlimited mode; sustained CPU above baseline is billed as surplus credits
  - quota names - Running On-Demand Standard instances (vCPU-based), All Standard Spot Instance Requests
  - Lightsail bundles are a fixed monthly price billed hourly; instances and databases bill until deleted, even when stopped
  - Lightsail transfer allowance per bundle (inbound and outbound count, only outbound overage is billed per GB by Region, allowances pool per bundle per Region); IPv6-only bundles cost less; unattached static IPs, snapshots, block storage and load balancers bill separately
usage_questions:
  - metric: monthly_bill
    ask: EC2, EBS and Lightsail cost last month?
    where: Cost Explorer → Service = Amazon Elastic Compute Cloud - Compute, EC2 - Other, Amazon Lightsail → Group by Usage type
  - metric: instances
    ask: Running and stopped instances, types and launch dates?
    where: EC2 console → Instances (filter by Instance state)
  - metric: cpu_utilization
    ask: Average CPU per instance and right-sizing advice?
    where: Compute Optimizer → EC2 instances; EC2 console → instance → Monitoring
  - metric: idle_storage
    ask: Unattached volumes and old snapshots?
    where: EC2 console → Elastic Block Store → Volumes (state Available) and Snapshots (Owned by me)
  - metric: egress_gb
    ask: Lightsail outbound transfer vs the bundle allowance?
    where: Lightsail console → Instances → instance → Metrics (NetworkOut)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - terminate idle instances; delete unattached volumes and old snapshots, archive long-kept ones
  - move gp2 volumes to gp3
  - Graviton instance types where the software supports Arm
  - right-size from Compute Optimizer; Savings Plans for 24/7 baselines; Spot for stateless or batch work
  - switch a busy T instance to standard credits or a fixed-performance type
  - delete (not stop) unused Lightsail instances; pick the bundle whose allowance covers outbound transfer
verified: 2026-10-11
---

- `client('ec2'` and `@aws-sdk/client-ec2` also manage VPCs and security groups; confirm instances exist before a finding.
- ECS on EC2 and EKS node groups bill here as EC2.
- `@aws-sdk/client-lightsail` also manages Lightsail buckets, databases and container services; ask which are used.
- EC2 or Lightsail beside another host for the same app is an Overlap unless split on purpose.
- The `hosting` role needs instances (IaC, `RunInstances`, Lightsail); EC2 API calls for security groups or AMIs list the map without it.
