---
# generated, edit catalog/vendors/aws-cloudwatch.md (then run: node tools/sync.mjs)
schema: 1
id: aws-cloudwatch
name: Amazon CloudWatch
family: aws
roles: [monitoring]
detect:
  packages: ["@aws-sdk/client-cloudwatch", "@aws-sdk/client-cloudwatch-logs", "@aws-sdk/client-xray", "aws-xray-sdk", "aws-xray-sdk-core", "aws-embedded-metrics", "aws-rum-web", "@aws-lambda-powertools/metrics", "@aws-lambda-powertools/tracer", "winston-cloudwatch"]
  pypi: ["aws-xray-sdk", "aws-embedded-metrics", "watchtower", "mypy-boto3-cloudwatch", "mypy-boto3-logs"]
  go: ["github.com/aws/aws-sdk-go-v2/service/cloudwatch", "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs", "github.com/aws/aws-sdk-go-v2/service/xray", "github.com/aws/aws-xray-sdk-go"]
  imports: ["@aws-sdk/client-cloudwatch", "@aws-sdk/client-cloudwatch-logs", "@aws-sdk/client-xray", "aws-xray-sdk", "aws-xray-sdk-core", "aws-embedded-metrics", "aws-rum-web", "@aws-lambda-powertools/metrics", "@aws-lambda-powertools/tracer"]
  role_signals:
    monitoring: ["@aws-sdk/client-cloudwatch", "@aws-sdk/client-xray", "aws-xray-sdk", "aws-embedded-metrics", "aws-rum-web", "@aws-lambda-powertools/metrics", "@aws-lambda-powertools/tracer", "client('cloudwatch'", "client(\"cloudwatch\"", "new AWS.CloudWatch(", "aws_cloudwatch_metric_alarm", "aws_cloudwatch_dashboard", "AWS::CloudWatch::", "aws-cdk-lib/aws-cloudwatch", "POWERTOOLS_METRICS_NAMESPACE", "import watchtower", "watchtower.CloudWatchLogHandler"]
  service_signals: ["client('logs'", "client(\"logs\"", "client('cloudwatch'", "client(\"cloudwatch\"", "new AWS.CloudWatch(", "new AWS.CloudWatchLogs(", "aws_cloudwatch_log_", "aws_cloudwatch_metric_alarm", "aws_cloudwatch_dashboard", "AWS::Logs::", "AWS::CloudWatch::", "aws-cdk-lib/aws-logs", "aws-cdk-lib/aws-cloudwatch", "awslogs-group", "logRetentionInDays", "POWERTOOLS_METRICS_NAMESPACE", "aws_lambda_function", "AWS::Lambda::Function", "AWS::Serverless::Function", "aws_logs as", "aws.cloudwatch."]
pages:
  pricing: https://aws.amazon.com/cloudwatch/pricing/
  costs: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_billing.html
  log_classes: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatch_Logs_Log_Classes.html
  retention: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html
  tiering: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/cwl_intelligent_tier.html
  lambda_logs: https://aws.amazon.com/blogs/compute/aws-lambda-introduces-tiered-pricing-for-amazon-cloudwatch-logs-and-additional-logging-destinations/
  custom_metrics: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html
  quotas: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html
read:
  - free allowances (log GB, custom metrics, alarm metrics, dashboards, API requests, traces, canary runs); GetMetricData is always billed
  - log ingestion per GB by class (Standard, Infrequent Access), storage, Logs Insights per GB scanned
  - vended log tiers, which since 2025 include Lambda logs
  - custom metric per metric-month (each dimension combination counts, EMF too), alarm metric, dashboard
  - Application Signals, X-Ray traces, Container Insights, canary run, RUM event
usage_questions:
  - metric: monthly_bill
    ask: CloudWatch cost last month by usage type?
    where: Cost Explorer → Service CloudWatch → Group by Usage type (DataProcessing-Bytes, VendedLog-Bytes, TimedStorage-ByteHrs, DataScanned-Bytes, MetricMonitorUsage)
  - metric: logs_ingested_gb
    ask: Log GB ingested per month, top log groups?
    where: CloudWatch → All metrics → Logs → Log group metrics → IncomingBytes, Sum, 30 days
  - metric: logs_stored_gb
    ask: Stored log GB, and groups with no retention?
    where: CloudWatch → Log Management (Retention "Never expire"); aws logs describe-log-groups (storedBytes)
mcp:
  official: true
  readonly_flag: "read-only by design: awslabs.cloudwatch-mcp-server (local) has no write tools; run it with a read-only AWS profile"
  allowed_tools: [describe_log_groups]
common_fixes:
  - set retention on every log group; Lambda and ECS groups never expire by default
  - drop DEBUG and health-check logs at the source
  - use the Infrequent Access class for bulk log groups, or Intelligent Tiering
  - remove user and request IDs from metric and EMF dimensions
  - delete alarms and dashboards of deleted resources
  - lower X-Ray sampling; limit Container Insights to clusters that need it
  - send audit-only vended logs (VPC Flow Logs) to S3
verified: 2026-10-11
---

- CloudWatch is billed without its SDK: Lambda and ECS (awslogs) write logs there, so their resources are service signals. Log ingestion and never-expiring storage are the usual surprise. The `monitoring` role counts only when the code or infrastructure uses CloudWatch on purpose (SDK, alarms, dashboards, EMF metrics, X-Ray), so Lambda logs alone are a Bill check, not an Overlap with Sentry or Datadog.
- The pricing page fills in prices by script: read it in a browser.
- A log group's class is fixed at creation; Infrequent Access has no metric or subscription filters, EMF or Live Tail.
- MCP: call only `describe_log_groups`. Insights, `analyze_log_group` and PromQL tools return log contents and bill per GB scanned.
- Next to Datadog, New Relic, Grafana Cloud or Sentry, CloudWatch is usually deliberate. Overlap only if both hold the same app logs, metrics or traces (look for forwarders); ask.
