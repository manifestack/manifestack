---
# generated, edit catalog/vendors/datadog.md (then run: node tools/sync.mjs)
schema: 1
id: datadog
name: Datadog
roles: [monitoring]
detect:
  packages: ["dd-trace", "dd-trace-api", "@datadog/", "datadog-lambda-js"]
  pypi: ["ddtrace", "datadog", "datadog-api-client", "datadog-lambda"]
  go: ["github.com/DataDog/dd-trace-go", "gopkg.in/DataDog/dd-trace-go.v1", "github.com/DataDog/datadog-go", "github.com/DataDog/datadog-api-client-go", "github.com/DataDog/datadog-lambda-go"]
  imports: ["dd-trace", "dd-trace-api", "@datadog/", "datadog-lambda-js"]
  env_prefixes: ["DD_", "DATADOG_", "NEXT_PUBLIC_DATADOG_", "VITE_DATADOG_"]
  config_files: ["datadog.yaml", "datadog-values.yaml", "datadog-ci.json"]
pages:
  pricing: https://www.datadoghq.com/pricing/
  pricing_list: https://www.datadoghq.com/pricing/list/
  billing: https://docs.datadoghq.com/account_management/billing/
  pricing_units: https://docs.datadoghq.com/account_management/billing/pricing/
  custom_metrics: https://docs.datadoghq.com/account_management/billing/custom_metrics/
  logs_billing: https://docs.datadoghq.com/account_management/billing/log_management/
  apm_billing: https://docs.datadoghq.com/account_management/billing/apm_tracing_profiler/
  usage: https://docs.datadoghq.com/account_management/plan_and_usage/usage_details/
  usage_metrics: https://docs.datadoghq.com/account_management/billing/usage_metrics/
  log_indexes: https://docs.datadoghq.com/logs/log_configuration/indexes/
  log_best_practices: https://docs.datadoghq.com/logs/guide/best-practices-for-log-management/
  apm_ingestion: https://docs.datadoghq.com/tracing/trace_pipeline/ingestion_controls/
  regions: https://docs.datadoghq.com/getting_started/site/
  security: https://trust.datadoghq.com/
  hipaa: https://docs.datadoghq.com/data_security/hipaa_compliance/
  dpa: https://www.datadoghq.com/legal/data-processing-addendum/
read:
  - the free Infrastructure plan (host cap and metric retention) and the per-host price of Infrastructure Pro and Enterprise, annual vs monthly vs on-demand
  - billing units per product the project uses (infrastructure hosts, containers, APM hosts, ingested and indexed spans, ingested log GB, indexed log events per retention period, custom metrics, RUM sessions, serverless functions)
  - how hosts are counted (hourly, high-water mark of the lower part of the month or a monthly commitment plus hourly overage) and when an Agent per container counts each container as a host
  - custom metrics allotment per host and how tag cardinality multiplies billable custom metrics
  - what happens past included or committed usage (usage above the plan or commitment is billed at on-demand rates rather than dropped) and the controls that limit it (log index daily quotas, exclusion filters, APM ingestion sampling, retention filters)
  - log retention options and their price per indexed event, plus archive and rehydration charges
  - usage alerts (monitors on datadog.estimated_usage metrics) and where the Usage page shows month-to-date usage
  - Datadog sites (US1, US3, US5, EU1, AP1, AP2, UK1, US1-FED, US2-FED) and that the site is fixed per organization; data cannot move between sites
  - certifications (SOC 2 Type 2, ISO 27001, PCI DSS, HIPAA with a BAA for HIPAA-eligible services, FedRAMP on the government sites) and the DPA
usage_questions:
  - metric: hosts
    ask: Infrastructure hosts and APM hosts this month, and the containers count if you run containers?
    where: Plan & Usage (account menu, bottom left) → Usage → All tab, Month-to-Date Summary
  - metric: logs_ingested_gb
    ask: Logs ingested and log events indexed this month, by index?
    where: Plan & Usage → Usage → Log Management tab (Logs Usage by Index)
  - metric: custom_metrics
    ask: Average custom metrics this month, and the top custom metrics by volume?
    where: Plan & Usage → Usage → Custom Metrics tab (Top Custom Metrics)
  - metric: monthly_bill
    ask: Plan (annual, monthly or on-demand), committed amounts, and the last invoice total?
    where: Plan & Usage → Plan tab and Billing History tab (Admin or Billing Read permission needed)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - add log exclusion filters for DEBUG and health-check logs and set a daily quota on each log index
  - shorten retention on noisy indexes and send long-term logs to an archive instead
  - lower APM ingestion sampling for high-traffic services and keep retention filters narrow
  - remove high-cardinality tags (user IDs, request IDs) from custom metrics, or use Metrics without Limits to index fewer tag combinations
  - run one containerized Agent per node instead of an Agent in every container
  - set monitors on datadog.estimated_usage metrics so spikes alert before the invoice
  - turn off products or integrations nobody looks at (RUM, profiling, unused cloud integrations)
  - choose the Datadog site the data-region requirement asks for before sending data
verified: 2026-10-07
---

- Datadog bills many meters at once and keeps ingesting past what is included, charging on-demand rates. It has no global spend cap. Logs (ingested GB plus indexed events), custom metrics (tag cardinality) and APM (hosts plus ingested and indexed spans) are the usual surprise lines. Read each meter the project uses, not only the per-host price.
- The site is fixed per organization (EU1 is in Germany; US1 is the default). A data-region requirement means checking the site in the app URL (`app.datadoghq.eu` vs `app.datadoghq.com`), and moving means a new organization.
- MCP: the official Datadog MCP server (remote, `toolsets` and `omit_tools` URL parameters) has no read-only switch. Writes are blocked only if the authorizing user's Datadog role lacks write permissions, which the skill cannot check, and its core tools return log, span and RUM contents that can hold user data. Do not use it for the audit; ask the usage questions instead.
- Detection: `DD_` env names are weak alone (short prefix). `datadog.yaml` is the Agent config and `datadog-values.yaml` the usual Helm values file; both mean the Agent is deployed from this repo. `hot-shots` and other StatsD clients can send to Datadog, but they are not counted, because they also send to plain StatsD.
- Datadog next to Sentry (errors, APM), PostHog or LogRocket (session replay vs RUM), or a second log platform is a candidate Overlap. Two monitoring tools often do different jobs, so confirm in the code which features each one uses and ask the user before reporting it.
