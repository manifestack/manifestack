---
schema: 1
id: aws-sqs-sns
name: Amazon SQS, SNS, EventBridge and Step Functions
family: aws
roles: [jobs]
detect:
  packages: ["@aws-sdk/client-sqs", "@aws-sdk/client-sns", "@aws-sdk/client-eventbridge", "@aws-sdk/client-scheduler", "@aws-sdk/client-sfn", "sqs-consumer", "sqs-producer", "@ssut/nestjs-sqs"]
  pypi: ["mypy-boto3-sqs", "mypy-boto3-sns", "mypy-boto3-events", "mypy-boto3-scheduler", "mypy-boto3-stepfunctions"]
  go: ["github.com/aws/aws-sdk-go-v2/service/sqs", "github.com/aws/aws-sdk-go-v2/service/sns", "github.com/aws/aws-sdk-go-v2/service/eventbridge", "github.com/aws/aws-sdk-go-v2/service/scheduler", "github.com/aws/aws-sdk-go-v2/service/sfn"]
  imports: ["@aws-sdk/client-sqs", "@aws-sdk/client-sns", "@aws-sdk/client-eventbridge", "@aws-sdk/client-scheduler", "@aws-sdk/client-sfn", "sqs-consumer", "sqs-producer", "@ssut/nestjs-sqs"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('sqs'", "client(\"sqs\"", "client('sns'", "client(\"sns\"", "client('events'", "client(\"events\"", "client('scheduler'", "client('stepfunctions'", "client(\"stepfunctions\"", "aws_sqs", "aws_sns", "aws_cloudwatch_event_", "aws_scheduler_", "aws_sfn_", "aws_stepfunctions", "AWS::SQS::", "AWS::SNS::", "AWS::Events::", "AWS::Scheduler::", "AWS::StepFunctions::", "AWS::Serverless::StateMachine", "aws-cdk-lib/aws-sqs", "aws-cdk-lib/aws-sns", "aws-cdk-lib/aws-events", "aws-cdk-lib/aws-scheduler", "aws-cdk-lib/aws-stepfunctions", "new AWS.SQS", "new AWS.SNS", "sqs:SendMessage", "sqs:ReceiveMessage", "sns:Publish", "states:StartExecution", "arn:aws:sqs:", "arn:aws:sns:", "sqs://", "client(\"scheduler\"", "aws.sqs.", "aws.sns.", "aws.sfn.", "aws.scheduler."]
  role_signals:
    jobs: ["@aws-sdk/client-sqs", "@aws-sdk/client-eventbridge", "@aws-sdk/client-scheduler", "@aws-sdk/client-sfn", "sqs-consumer", "sqs-producer", "@ssut/nestjs-sqs", "service/sqs", "service/sfn", "service/scheduler", "service/eventbridge", "client('sqs'", "client(\"sqs\"", "client('events'", "client(\"events\"", "client('scheduler'", "client(\"scheduler\"", "client('stepfunctions'", "client(\"stepfunctions\"", "aws_sqs", "aws_cloudwatch_event_", "aws_scheduler_", "aws_sfn_", "aws_stepfunctions", "AWS::SQS::", "AWS::Events::", "AWS::Scheduler::", "AWS::StepFunctions::", "AWS::Serverless::StateMachine", "aws-cdk-lib/aws-sqs", "aws-cdk-lib/aws-events", "aws-cdk-lib/aws-scheduler", "aws-cdk-lib/aws-stepfunctions", "new AWS.SQS", "sqs:SendMessage", "sqs:ReceiveMessage", "states:StartExecution", "arn:aws:sqs:", "sqs://", "aws.sqs.", "aws.sfn.", "aws.scheduler."]
pages:
  pricing: https://aws.amazon.com/sqs/pricing/
  sns_pricing: https://aws.amazon.com/sns/pricing/
  sms_pricing: https://aws.amazon.com/end-user-messaging/pricing/
  eventbridge_pricing: https://aws.amazon.com/eventbridge/pricing/
  stepfunctions_pricing: https://aws.amazon.com/step-functions/pricing/
  sqs_quotas: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html
  sms_spend: https://docs.aws.amazon.com/sns/latest/dg/sms_preferences.html
  sms_fraud: https://docs.aws.amazon.com/sms-voice/latest/userguide/protect.html
  eventbridge_quotas: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-quota.html
  stepfunctions_quotas: https://docs.aws.amazon.com/step-functions/latest/dg/service-quotas.html
read:
  - SQS monthly free requests, standard, FIFO and fair-queue request prices, and that each 64 KB chunk and every API call (including empty receives) is a request
  - SNS request price, delivery prices per endpoint type (push, email, HTTP), free deliveries to SQS and Lambda but data transfer charged on them, FIFO topic pricing
  - SMS price per destination country plus carrier fees, phone number and registration fees, SMS Protect; the SMS sandbox and the account spend limit, which stops sending when reached
  - EventBridge bus types (classic billed per event, the newer custom bus per GB), Pipes, API destinations, archive and replay; Scheduler free invocations, then per invocation
  - Step Functions Standard per state transition (retries count) with its free tier, versus Express per request and GB-second
  - quotas for SQS in-flight messages, message size, retention, FIFO throughput; EventBridge and Scheduler request rates; Step Functions state transition rate, which starts lower on new accounts
usage_questions:
  - metric: monthly_requests
    ask: SQS and SNS requests, SNS deliveries, EventBridge events and Step Functions state transitions last month?
    where: Billing and Cost Management → Cost Explorer → Service (SQS, SNS, EventBridge, Step Functions), group by Usage type
  - metric: sms_spend
    ask: SMS sent and SMS cost last month, top destination countries, and the monthly spend limit?
    where: SNS console → Mobile → Text messaging (SMS) → Text messaging preferences; End User Messaging SMS console → Overview
  - metric: queue_backlog
    ask: Oldest message age and messages in flight on the busiest queue?
    where: CloudWatch → Metrics → SQS → ApproximateAgeOfOldestMessage, ApproximateNumberOfMessagesNotVisible
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - use long polling and batch send, receive and delete (up to ten messages per call)
  - add a dead-letter queue and max receive count so poison messages stop retrying
  - set a low SMS spend limit, block unused countries with a protect configuration, and prefer email or TOTP for one-time codes
  - move high-volume, short workflows from Standard to Express; cut retry loops in Standard
  - filter events at the subscription or rule instead of in the consumer
verified: 2026-10-11
---

- `client('events'` is the weakest signal. `- sqs:` and `schedule:` in YAML are too generic (GitHub Actions use `schedule:`); serverless.yml queues are found by `AWS::SQS::Queue`, ARNs or IAM actions.
- A Lambda SQS trigger polls even when the queue is idle; the requests are billed. Provisioned pollers cost extra.
- SMS is the costly path: fraudulent sign-ups can send many messages to premium destinations. SMS used by Cognito bills here too.
- SQS, EventBridge or Step Functions with Inngest, Trigger.dev or Upstash QStash is Overlap unless split on purpose (for example, infrastructure events versus app jobs).
- The AWS SNS/SQS MCP server can send and receive messages and has no read-only mode; do not use it.
- The `jobs` role needs SQS, EventBridge, Scheduler or Step Functions; SNS used only for SMS or push lists the map without it.
