---
# generated, edit catalog/vendors/grafana-cloud.md (then run: node tools/sync.mjs)
schema: 1
id: grafana-cloud
name: Grafana Cloud
roles: [monitoring]
detect:
  packages: ["@grafana/faro-web-sdk", "@grafana/faro-web-tracing", "@grafana/faro-react", "@grafana/faro-core", "@grafana/faro-transport-otlp-http", "@grafana/faro-instrumentation-replay", "@grafana/faro-react-native", "@grafana/faro-react-native-tracing", "@grafana/faro-webpack-plugin", "@grafana/faro-rollup-plugin", "@grafana/faro-esbuild-plugin", "@grafana/faro-metro-plugin", "@grafana/faro-cli", "@grafana/agento11y", "grafana-openai-monitoring"]
  pypi: ["agento11y", "grafana-openai-monitoring"]
  go: ["github.com/grafana/grafana-com-public-clients/go/gcom", "github.com/grafana/agento11y/go"]
  imports: ["@grafana/faro-web-sdk", "@grafana/faro-web-tracing", "@grafana/faro-react", "@grafana/faro-core", "@grafana/faro-transport-otlp-http", "@grafana/faro-instrumentation-replay", "@grafana/faro-react-native", "@grafana/faro-react-native-tracing", "@grafana/agento11y", "grafana-openai-monitoring"]
  env_prefixes: ["GRAFANA_CLOUD_", "GCLOUD_HOSTED_", "GCLOUD_RW_API_KEY", "GCLOUD_FM_", "K6_CLOUD_", "GRAFANA_K6_", "GRAFANA_SM_", "GRAFANA_FRONTEND_O11Y_", "GRAFANA_STACK_ID", "NEXT_PUBLIC_FARO_", "VITE_FARO_", "PUBLIC_FARO_", "REACT_APP_FARO_"]
  config_files: ["config.alloy"]
pages:
  pricing: https://grafana.com/pricing/
  pricing_usage: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/
  metrics_billing: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/metrics/
  logs_billing: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/logs/
  frontend: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/frontend-observability/
  users: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/users/
  usage_limits: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/usage-limits/
  stack_plans: https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/stack-plans/
  usage: https://grafana.com/docs/grafana-cloud/platform/cost-management-and-billing/understand-usage-cost/
  usage_alerts: https://grafana.com/docs/grafana-cloud/platform/cost-management-and-billing/usage-cost-alerts/
  reduce_costs: https://grafana.com/docs/grafana-cloud/platform/cost-management-and-billing/analyze-costs/reduce-costs/
  k6_quotas: https://grafana.com/docs/grafana-cloud/observe-and-act/testing/k6/projects-and-users/limits-and-quotas/
  regions: https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/account-management/regional-availability/
  mcp: https://grafana.com/docs/grafana-cloud/ai-tools/mcp-servers/
  security: https://grafana.com/legal/security-compliance/
  dpa: https://grafana.com/legal/data-processing-agreement/
read:
  - plans (Free, Pro with a platform fee plus usage, Enterprise commit), retention per plan, stacks per account, and whether it was bought through a cloud marketplace
  - free allowances per product, i.e. metrics series, logs, traces and profiles GB, Frontend sessions, k6 VU hours, synthetic executions, active users, IRM users, host hours
  - metrics billing, i.e. the 95th percentile of active series or of DPM divided by the included DPM per series, so a shorter scrape interval raises the bill
  - logs, traces and profiles billed for processing, writing and retention per GB; logs queries free up to a multiple of written volume
  - Frontend billed per session (newer customers also pay telemetry separately); App, Kubernetes and Database Observability billed per host hour plus telemetry
  - active users, i.e. anyone who signs in in the month; Assistant and Cloud MCP users billed as AI users
  - what happens at a limit, i.e. Free discards data over the allowance; Pro bills overage with no spend cap, only usage and spend alerts; k6 project quotas stop tests; ingestion rate limits throttle
  - stack region fixed at creation
  - ISO 27001, SOC 2 Type 2, the DPA; no HIPAA BAA documented
usage_questions:
  - metric: active_series
    ask: Billable metrics series (active series and DPM) this month?
    where: stack → Cost Management and Billing → Usage → Metrics; or the grafanacloud-usage data source
  - metric: logs_ingested_gb
    ask: Logs, traces and profiles GB written this month, and logs GB queried?
    where: stack → Cost Management and Billing → Usage → Logs, Traces, Profiles
  - metric: users
    ask: Active Grafana, IRM and Assistant users this month?
    where: Usage → Billable users
  - metric: monthly_bill
    ask: Plan and the last invoice total?
    where: grafana.com Cloud Portal → Billing → Invoice history and Plan details
mcp:
  official: true
  readonly_flag: "mcp-grafana with --disable-write --enabled-tools datasource,prometheus and a Viewer service-account token; not the hosted Cloud MCP, where every connecting user is billed as an AI user"
  allowed_tools: [list_datasources, query_prometheus]
common_fixes:
  - drop or relabel high-cardinality labels in Alloy and apply Adaptive Metrics recommendations
  - scrape every 60 seconds by default and shorten only the jobs that need it
  - drop debug and health-check logs at the collector and apply Adaptive Logs; use instant queries in log alert rules
  - sample traces at the collector, and set Faro session sampling below 1
  - debug k6 scripts locally before cloud runs and set project VU-hour quotas
  - remove users who no longer sign in, and set spend and usage alerts since Pro has no cap
verified: 2026-10-11
---

- Grafana OSS, Loki, Mimir, Tempo and Alloy can all be self-hosted for free; only Grafana Cloud bills. Cloud shows as Faro or Agent Observability packages, `GRAFANA_CLOUD_*`, `GCLOUD_HOSTED_*`, `K6_CLOUD_*` names, the grafana.com API client, `*.grafana.net` endpoints in collector config, or `grafana_cloud_stack` in Terraform. `config.alloy` alone only shows a Grafana pipeline: read its endpoints. A `grafana/grafana` image, `grafana.ini` or `GF_*` names mean self-hosted. `@grafana/ui`, `@grafana/data` and `k6` alone are plugin development or free local load tests.
- OpenTelemetry export to Grafana Cloud uses generic `OTEL_*` names and is not detected: ask.
- Cutting series mid-month barely moves that month's bill (95th percentile); watch active series. Docs serve markdown at `<url>.md`.
- With mcp-grafana, run `query_prometheus` only on the `grafanacloud-usage` data source and `grafanacloud_*` metrics; never query logs, traces or `grafana_api_request`.
- Grafana Cloud next to Datadog, New Relic or Sentry for the same signals is Overlap unless split on purpose.
