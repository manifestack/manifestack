---
schema: 1
id: gcp-pubsub
name: Google Cloud Pub/Sub, Cloud Tasks, Cloud Scheduler, Workflows and Eventarc
family: gcp
roles: [jobs]
detect:
  packages: ["@google-cloud/pubsub", "@google-cloud/tasks", "@google-cloud/scheduler", "@google-cloud/workflows", "@google-cloud/eventarc", "@google-cloud/eventarc-publishing"]
  pypi: ["google-cloud-pubsub", "google-cloud-pubsublite", "google-cloud-tasks", "google-cloud-scheduler", "google-cloud-workflows", "google-cloud-eventarc", "google-cloud-eventarc-publishing"]
  go: ["cloud.google.com/go/pubsub", "cloud.google.com/go/pubsublite", "cloud.google.com/go/cloudtasks", "cloud.google.com/go/scheduler", "cloud.google.com/go/workflows", "cloud.google.com/go/eventarc"]
  imports: ["@google-cloud/pubsub", "@google-cloud/tasks", "@google-cloud/scheduler", "@google-cloud/workflows", "@google-cloud/eventarc", "@google-cloud/eventarc-publishing"]
  env_prefixes: ["PUBSUB_EMULATOR_HOST"]
  config_files: []
  service_signals: ["google.cloud.pubsub", "google.cloud import pubsub", "google.cloud import tasks", "google.cloud import scheduler", "google.cloud import workflows", "google.cloud.workflows", "google.cloud import eventarc", "\"google_pubsub_", "\"google_cloud_tasks_queue", "\"google_cloud_scheduler_job\"", "\"google_workflows_workflow\"", "\"google_eventarc_", "gcp.pubsub.", "gcp.cloudtasks.", "gcp.cloudscheduler.", "gcp.workflows.", "gcp.eventarc.", "pubsub.googleapis.com/", "cloudtasks.googleapis.com/", "cloudscheduler.googleapis.com/", "workflows.googleapis.com/", "eventarc.googleapis.com/", "PUBSUB_EMULATOR_HOST", "firebase-functions/v2/pubsub", "firebase-functions/v2/scheduler", "firebase-functions/v2/tasks", "functions.pubsub."]
pages:
  pricing: https://cloud.google.com/pubsub/pricing
  quotas: https://docs.cloud.google.com/pubsub/quotas
  lite: https://docs.cloud.google.com/pubsub/lite/docs
  tasks_pricing: https://cloud.google.com/tasks/pricing
  tasks_quotas: https://docs.cloud.google.com/tasks/docs/quotas
  scheduler_pricing: https://cloud.google.com/scheduler/pricing
  workflows_pricing: https://cloud.google.com/workflows/pricing
  workflows_quotas: https://docs.cloud.google.com/workflows/quotas
  eventarc_pricing: https://cloud.google.com/eventarc/pricing
  eventarc_quotas: https://docs.cloud.google.com/eventarc/docs/quotas
read:
  - Pub/Sub throughput per TiB with the free monthly allowance per billing account, the minimum billed per request, and the higher rate without a free allowance for BigQuery and Cloud Storage subscriptions, import topics and transforms
  - Pub/Sub storage for topic retention, retained acknowledged messages, snapshots (with a one-time backlog charge) and unacked messages older than a day; cross-region delivery per subscriber
  - Cloud Tasks operations per million with a free allowance; each 32 KB chunk, API call and push attempt (retries too) counts
  - Cloud Scheduler per job per month, a few free jobs per billing account; paused jobs count
  - Workflows internal versus external steps with free steps; failed and retried steps and connector polling count
  - Eventarc Standard events by source on top of Pub/Sub transport; Eventarc Advanced bus, pipeline and transformation charges
  - quota names for Pub/Sub regional throughput, Tasks queue dispatch rate, Workflows concurrent executions, Eventarc bus throughput
usage_questions:
  - metric: monthly_bill
    ask: Pub/Sub, Cloud Tasks, Cloud Scheduler, Workflows and Eventarc cost last month by SKU?
    where: Billing → Reports → Group by SKU, Services filter (Cloud Pub/Sub, Cloud Tasks, Cloud Scheduler, Workflows, Eventarc)
  - metric: transfer_tb
    ask: Pub/Sub bytes billed last month, top topics and subscriptions?
    where: Monitoring → Metrics explorer → topic/byte_cost and subscription/byte_cost, Sum, 30 days, grouped by topic_id or subscription_id
  - metric: queue_backlog
    ask: Oldest unacked message age and undelivered messages on the busiest subscription; dead-letter topics set?
    where: Pub/Sub → Subscriptions → (subscription) → Metrics (oldest_unacked_message_age, num_undelivered_messages)
  - metric: scheduler_jobs
    ask: Cloud Scheduler jobs, paused ones included, across all projects on the billing account?
    where: Cloud Scheduler → Jobs in each project and region
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - batch small messages into fewer publish requests
  - add a dead-letter topic and retry policy so poison messages stop redelivering
  - prefer topic retention or one snapshot to retaining acked messages per subscription; delete old snapshots
  - keep publishers, message storage and subscribers in one region
  - set max attempts and backoff on Cloud Tasks queues; delete unused Scheduler jobs rather than pausing them
  - replace polling loops in Workflows with callbacks or Eventarc events
verified: 2026-10-11
---

- Small unbatched messages are billed at the per-request minimum, not their size, and each subscription bills delivery again, so fan-out multiplies throughput. Messages a subscription filter drops still bill.
- Eventarc triggers on Google sources ride on Cloud Audit Logs: Data Access logs must be on and bill in Cloud Logging (`gcp-logging`). Cloud Run functions event triggers create Eventarc triggers and Pub/Sub subscriptions; Firebase `onSchedule` creates Scheduler jobs.
- Pub/Sub Lite is deprecated and closed to new customers: a Fit finding. It is turned down on 2027-01-31 per the Lite page (the pricing page still shows an older date) and migrate to Pub/Sub or Managed Service for Apache Kafka.
- `new PubSub(` and `pubsub.publish(` are not signals: graphql-subscriptions uses the same names.
- Pub/Sub, Tasks or Workflows with Inngest, Trigger.dev, Upstash QStash or SQS is Overlap unless split on purpose (infrastructure events versus app jobs).
- MCP: the remote server (`pubsub.googleapis.com/mcp`) has publish, create, update and delete tools and no read-only endpoint, and push endpoint URLs can hold tokens. Do not use it.
