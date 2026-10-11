---
# generated, edit catalog/vendors/gcp-logging.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-logging
name: Google Cloud Logging, Monitoring and Trace
family: gcp
roles: [monitoring]
detect:
  packages: ["@google-cloud/logging", "@google-cloud/logging-winston", "@google-cloud/logging-bunyan", "@google-cloud/monitoring", "@google-cloud/trace-agent", "@google-cloud/opentelemetry-cloud-trace-exporter", "@google-cloud/opentelemetry-cloud-monitoring-exporter", "@google-cloud/error-reporting", "@google-cloud/profiler"]
  pypi: ["google-cloud-logging", "google-cloud-monitoring", "google-cloud-trace", "google-cloud-error-reporting", "google-cloud-profiler", "opentelemetry-exporter-gcp-trace", "opentelemetry-exporter-gcp-monitoring"]
  go: ["cloud.google.com/go/logging", "cloud.google.com/go/monitoring", "cloud.google.com/go/trace", "cloud.google.com/go/errorreporting", "cloud.google.com/go/profiler", "github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace", "github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric"]
  imports: ["@google-cloud/logging", "@google-cloud/logging-winston", "@google-cloud/logging-bunyan", "@google-cloud/monitoring", "@google-cloud/trace-agent", "@google-cloud/opentelemetry-cloud-trace-exporter", "@google-cloud/opentelemetry-cloud-monitoring-exporter", "@google-cloud/error-reporting", "@google-cloud/profiler"]
  env_prefixes: []
  config_files: []
  role_signals:
    monitoring: ["@google-cloud/logging", "@google-cloud/monitoring", "@google-cloud/trace-agent", "@google-cloud/opentelemetry-cloud-", "@google-cloud/error-reporting", "@google-cloud/profiler", "google.cloud.logging", "google.cloud import logging", "google.cloud import monitoring", "google.cloud import trace", "google.cloud import error_reporting", "googlecloudprofiler", "opentelemetry.exporter.cloud_", "cloud.google.com/go/logging", "cloud.google.com/go/monitoring", "cloud.google.com/go/trace", "cloud.google.com/go/errorreporting", "cloud.google.com/go/profiler", "opentelemetry-operations-go/exporter", "telemetry.googleapis.com", "\"google_monitoring_", "\"google_logging_metric\"", "gcp.monitoring.", "PodMonitoring"]
  service_signals: ["\"google_logging_", "\"google_monitoring_", "gcp.logging.", "gcp.monitoring.", "logging.googleapis.com", "monitoring.googleapis.com", "cloudtrace.googleapis.com", "telemetry.googleapis.com", "PodMonitoring", "\"google_cloud_run_v2_", "\"google_cloud_run_service", "\"google_cloudfunctions", "\"google_container_cluster\"", "\"google_app_engine_standard_app_version\"", "\"google_app_engine_flexible_app_version\"", "gcp.cloudrunv2.", "gcp.cloudrun.", "gcp.cloudfunctions", "gcp.container.Cluster", "gcp.appengine.StandardAppVersion", "gcp.appengine.FlexibleAppVersion", "run.googleapis.com/", "gcloud run deploy", "gcloud functions deploy", "gcloud app deploy", "@google-cloud/functions-framework", "functions_framework", "firebase-functions"]
pages:
  pricing: https://cloud.google.com/products/observability/pricing
  estimating_bills: https://docs.cloud.google.com/stackdriver/estimating-bills
  optimize: https://docs.cloud.google.com/stackdriver/docs/observability/pricing-optimize-and-monitor
  routing: https://docs.cloud.google.com/logging/docs/routing/overview
  buckets: https://docs.cloud.google.com/logging/docs/buckets
  quotas: https://docs.cloud.google.com/logging/quotas
  data_access_audit: https://docs.cloud.google.com/logging/docs/audit/configure-data-access
  metrics_management: https://docs.cloud.google.com/monitoring/docs/metrics-management
  prometheus_costs: https://docs.cloud.google.com/stackdriver/docs/managed-prometheus/cost-controls
  cloud_run_logs: https://docs.cloud.google.com/run/docs/logging
  gke_logs: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/about-logs
read:
  - free allotments (log storage, chargeable metric bytes, read API time series, uptime checks, trace spans) and whether each is per project or per billing account
  - log storage per GiB streamed into _Default and user-defined buckets (default retention included) and retention beyond it; _Required bucket, routing and Observability Analytics queries are free; a log routed to two buckets bills twice
  - metrics by bytes ingested (custom, agent, logs-based) versus Managed Service for Prometheus and OTLP by samples ingested; Google Cloud metrics are free
  - read API per time series returned (console free); alerting charges and their start date
  - trace spans beyond the free allotment; Cloud Run, Cloud Run functions and App Engine standard spans are free; Error Reporting and Profiler have no charge of their own
  - quota names for LogEntry size, entries.write rate per region, sinks, buckets and exclusion filters
usage_questions:
  - metric: monthly_bill
    ask: Cloud Logging, Monitoring and Trace cost last month by SKU?
    where: Billing → Reports → Group by SKU, Services filter (Cloud Logging, Cloud Monitoring, Cloud Trace)
  - metric: logs_ingested_gb
    ask: Log GiB streamed this month and last per project, top resource types?
    where: Logging → Logs Storage (Current month ingestion → See ingestion analysis)
  - metric: logs_stored_gb
    ask: Buckets with retention beyond the default, sinks copying logs to a second bucket, exclusion filters, Data Access audit logs on?
    where: Logging → Logs Storage (Retention column); Logging → Log Router; IAM & Admin → Audit Logs
  - metric: metrics_ingested
    ask: Chargeable metric bytes and Prometheus samples this month, top metrics, time series billed for read queries?
    where: Monitoring → Metrics Management; Metrics explorer → monitoring.googleapis.com/billing/time_series_billed_for_queries_count
mcp:
  official: true
  readonly_flag: "read-only by design: remote https://logging.googleapis.com/mcp and https://monitoring.googleapis.com/mcp have only read-only tools; use a principal with roles/mcp.toolUser and view-only Logging and Monitoring roles"
  allowed_tools: [list_buckets, get_bucket, list_log_names, list_metric_descriptors, list_alert_policies, list_timeseries]
common_fixes:
  - exclude health checks, load balancer request logs and DEBUG lines on the _Default sink, or exclude a percentage to sample
  - set retention back to the default; route long-term copies to Cloud Storage
  - stop routing the same logs to two buckets
  - turn off Data Access audit logs nobody reads, unless Eventarc triggers need them
  - remove user and request IDs from custom and logs-based metric labels
  - raise the Prometheus scrape interval and drop unused kube-state-metrics series
  - lower trace sampling; aggregate before alerting
verified: 2026-10-11
---

- Cloud Logging is billed without its SDK: Cloud Run, Cloud Run functions, GKE and App Engine send stdout, stderr and request logs there by default, so those resources are service signals. The `monitoring` role counts only for deliberate use (SDK or log handler, alert policies, dashboards, logs-based metrics, OTLP to `telemetry.googleapis.com`, `PodMonitoring`), so Cloud Run logs alone are a Bill check, not an Overlap with Sentry or Datadog.
- Next to Datadog, Grafana Cloud, New Relic or Sentry, Cloud Logging is usually deliberate (platform and audit logs stay there). Overlap only if both hold the same app logs, metrics or traces (a Pub/Sub log sink, a Cloud Monitoring data source, a dual-export collector); ask. Tools that read Cloud Monitoring bill read API time series here.
- Exclusions cut storage, not `entries.write` quota. Shortened retention stays billable through a grace period.
- `@google-cloud/trace-agent` and the `@google-cloud/opentelemetry-cloud-*` exporters are deprecated in favour of OTLP to the Telemetry API: a Fit note.
- MCP: `list_log_entries`, `list_traces`, `get_trace` and `list_group_stats` return log contents, spans and stack traces; do not call them. `list_timeseries` bills per time series returned.
