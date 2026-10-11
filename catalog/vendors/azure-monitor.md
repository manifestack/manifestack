---
schema: 1
id: azure-monitor
name: Azure Monitor and Application Insights
family: azure
roles: [monitoring]
detect:
  packages: ["applicationinsights", "@microsoft/opentelemetry", "@microsoft/applicationinsights-web", "@microsoft/applicationinsights-react-js", "@microsoft/applicationinsights-angularplugin-js", "@azure/monitor-opentelemetry", "@azure/monitor-opentelemetry-exporter", "@azure/monitor-query", "@azure/monitor-query-logs", "@azure/monitor-query-metrics", "@azure/monitor-ingestion"]
  pypi: ["microsoft-opentelemetry", "azure-monitor-opentelemetry", "azure-monitor-opentelemetry-exporter", "azure-monitor-query", "azure-monitor-querymetrics", "azure-monitor-ingestion", "opencensus-ext-azure", "applicationinsights"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/monitor/azquery", "github.com/Azure/azure-sdk-for-go/sdk/monitor/query/azlogs", "github.com/Azure/azure-sdk-for-go/sdk/monitor/query/azmetrics", "github.com/Azure/azure-sdk-for-go/sdk/monitor/ingestion/azlogs", "github.com/microsoft/ApplicationInsights-Go"]
  imports: ["applicationinsights", "@microsoft/opentelemetry", "@microsoft/applicationinsights-web", "@microsoft/applicationinsights-react-js", "@microsoft/applicationinsights-angularplugin-js", "@azure/monitor-opentelemetry", "@azure/monitor-opentelemetry-exporter", "@azure/monitor-query", "@azure/monitor-query-logs", "@azure/monitor-query-metrics", "@azure/monitor-ingestion"]
  env_prefixes: ["APPLICATIONINSIGHTS_CONNECTION_STRING", "APPINSIGHTS_INSTRUMENTATIONKEY"]
  config_files: []
  role_signals:
    monitoring: ["@azure/monitor-opentelemetry", "@azure/monitor-query", "@azure/monitor-ingestion", "@microsoft/applicationinsights-", "\"applicationinsights\"", "'applicationinsights'", "useAzureMonitor(", "configure_azure_monitor(", "useMicrosoftOpenTelemetry(", "use_microsoft_opentelemetry(", "@microsoft/opentelemetry", "azure.monitor.opentelemetry", "azure.monitor.query", "azure.monitor.ingestion", "opencensus.ext.azure", "from applicationinsights import", "azure-sdk-for-go/sdk/monitor/", "ApplicationInsights-Go", "azuremonitor:", "\"azurerm_monitor_metric_alert\"", "\"azurerm_monitor_scheduled_query_rules_", "\"azurerm_monitor_action_group\"", "\"azurerm_application_insights_workbook\"", "\"azurerm_application_insights_standard_web_test\"", "Microsoft.Insights/metricAlerts", "Microsoft.Insights/scheduledQueryRules", "Microsoft.Insights/actionGroups", "Microsoft.Insights/workbooks", "Microsoft.Insights/webtests", "az monitor "]
  service_signals: ["\"azurerm_application_insights", "\"azurerm_log_analytics_", "\"azurerm_monitor_", "Microsoft.Insights/components", "Microsoft.OperationalInsights/workspaces", "microsoft.insights/components", "microsoft.operationalinsights/workspaces", "Microsoft.Insights/diagnosticSettings", "Microsoft.Insights/dataCollectionRules", "Microsoft.Insights/metricAlerts", "Microsoft.Insights/scheduledQueryRules", "azure-native:insights:", "azure-native:operationalinsights:", "APPLICATIONINSIGHTS_CONNECTION_STRING", "APPINSIGHTS_INSTRUMENTATIONKEY", "applicationinsights.azure.com", "api.loganalytics", "logAnalyticsConfiguration", "oms_agent", "omsagent", "from azure.monitor", "az monitor "]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/monitor/
  cost_usage: https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/cost-usage
  logs_cost: https://learn.microsoft.com/en-us/azure/azure-monitor/logs/cost-logs
  table_plans: https://learn.microsoft.com/en-us/azure/azure-monitor/logs/logs-table-plans
  retention: https://learn.microsoft.com/en-us/azure/azure-monitor/logs/data-retention-configure
  daily_cap: https://learn.microsoft.com/en-us/azure/azure-monitor/logs/daily-cap
  analyze_usage: https://learn.microsoft.com/en-us/azure/azure-monitor/logs/analyze-usage
  sampling: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-sampling
  functions_monitoring: https://learn.microsoft.com/en-us/azure/azure-functions/configure-monitoring
  container_apps_logs: https://learn.microsoft.com/en-us/azure/container-apps/log-options
  container_insights_cost: https://learn.microsoft.com/en-us/azure/azure-monitor/containers/container-insights-cost
read:
  - Log Analytics ingestion per GB by table plan (Analytics, Basic, Auxiliary), the monthly free GB per billing account on Analytics pay-as-you-go, and tables that are free (_IsBillable false)
  - Analytics commitment tiers (per day, a 31-day commitment, overage at the tier rate) and dedicated clusters
  - retention included with Analytics ingestion (longer for Application Insights tables), extended interactive and long-term retention per GB; Basic and Auxiliary queries and search jobs per GB scanned
  - "daily cap: stops Analytics and Basic ingestion until a reset hour you cannot choose, overshoots and bills the excess, never covers Auxiliary; workspace-based Application Insights applies the lower of its own and the workspace cap"
  - Application Insights bills through its workspace; sampling is the main lever (the Node and Microsoft OpenTelemetry distros sample by default; the Python `azure-monitor-opentelemetry` distro sends everything unless `sampling_ratio` is set)
  - log processing, data export, platform logs sent to storage or Event Hubs, restore and workspace replication
  - platform metrics free; Prometheus and OpenTelemetry metrics per sample ingested and queried; metric query API calls past a free number
  - alert rules per monitored time series or log alert frequency; notifications free up to monthly counts, SMS and voice by country
  - Sentinel or Defender on the same workspace changes which meters bill ingestion
usage_questions:
  - metric: monthly_bill
    ask: Azure Monitor cost last month by meter?
    where: Cost Management → Cost analysis → Daily costs view, filter Service name Azure Monitor, Log Analytics, Insight and Analytics, Application Insights → Group by Meter
  - metric: logs_ingested_gb
    ask: Billable GB ingested per workspace last month, top tables?
    where: Log Analytics workspace → Usage and estimated costs (Data ingestion per solution); Logs → Usage table where IsBillable == true, by DataType
  - metric: logs_stored_gb
    ask: Retention and plan per table, daily cap and its reset hour?
    where: Log Analytics workspace → Tables; Usage and estimated costs → Data retention and Daily cap
  - metric: alerts
    ask: How many metric and log alert rules, at what frequency, and SMS or voice actions?
    where: Monitor → Alerts → Alert rules and Action groups
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with an explicit tool list: npx -y @azure/mcp@latest server start --read-only --tool monitor_workspace_list --tool monitor_table_list"
  allowed_tools: [monitor_workspace_list, monitor_table_list]
common_fixes:
  - drop DEBUG and health-check telemetry at the source and lower sampling
  - move verbose tables (container logs, request logs) to Basic or Auxiliary, or filter rows with an ingestion transformation
  - set retention back to the included period
  - set a daily cap on dev and test workspaces with an alert before it; avoid it in production
  - keep Sentinel off operational workspaces
  - use a commitment tier only when steady ingestion is above it
  - turn off Container insights on clusters nobody watches, or use its cost presets
verified: 2026-10-11
---

- Azure Monitor is billed without its SDK: Functions send to Application Insights through the `APPLICATIONINSIGHTS_CONNECTION_STRING` setting, Container Apps send console logs to Log Analytics, AKS sends Container insights when enabled; those resources are service signals. The `monitoring` role counts only for deliberate use (OpenTelemetry distro, browser SDK, query or ingestion clients, alert rules, workbooks, web tests), so Functions logs alone are a Bill check, not an Overlap with Sentry or Datadog.
- `APPLICATIONINSIGHTS_CONNECTION_STRING` in `.env` finds this map but not the role: it is also how Functions and App Service wire default logging.
- Next to Sentry, Datadog, New Relic or Grafana Cloud, Azure Monitor is usually deliberate (platform logs stay here). Overlap only if both hold the same app logs, traces or metrics (two exporters, a diagnostic setting streaming to another tool); ask.
- Classic Application Insights resources have been retired in favour of workspace-based ones. `opencensus-ext-azure`, PyPI `applicationinsights` and `@azure/monitor-query` are deprecated: a Fit note.
- Shortened retention stays billable through a grace period; purge does not lower retention cost.
- MCP: never call `monitor_workspace_log_query`, `monitor_resource_log_query` or `monitor_workspace_log_search` (log rows; Basic and Auxiliary searches bill per GB scanned). No tool reports ingestion or cost; ask.
