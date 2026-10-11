---
# generated, edit catalog/vendors/azure-functions.md (then run: node tools/sync.mjs)
schema: 1
id: azure-functions
name: Azure Functions
family: azure
roles: [hosting]
detect:
  packages: ["@azure/functions", "durable-functions", "azure-functions-core-tools", "@azure/functions-opentelemetry-instrumentation", "@azure/functions-extensions-base", "@azure/functions-extensions-blob"]
  pypi: ["azure-functions", "azure-functions-durable", "azurefunctions-extensions-*"]
  imports: ["@azure/functions", "durable-functions", "@azure/functions-opentelemetry-instrumentation", "@azure/functions-extensions-base", "@azure/functions-extensions-blob"]
  env_prefixes: ["FUNCTIONS_WORKER_RUNTIME", "AzureWebJobsStorage"]
  config_files: [".funcignore", "local.settings.json"]
  service_signals: ["\"azurerm_linux_function_app", "\"azurerm_windows_function_app", "\"azurerm_function_app_flex_consumption\"", "\"azurerm_function_app\"", "kind: 'functionapp", "'functionapp,linux", "functionAppConfig", "'FlexConsumption'", "'ElasticPremium'", "Microsoft.DurableTask/schedulers", "appservice.LinuxFunctionApp", "appservice.WindowsFunctionApp", "az functionapp ", "func azure functionapp", "AzureFunctionApp@", "AzureFunctionAppContainer@", "appType: functionApp", "appType: 'functionApp", "FUNCTIONS_WORKER_RUNTIME", "FUNCTIONS_EXTENSION_VERSION", "AzureWebJobsStorage", "import azure.functions", "from azure.functions import", "import azure.durable_functions", "func.FunctionApp("]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/functions/
  hosting_options: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
  flex_consumption: https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan
  consumption: https://learn.microsoft.com/en-us/azure/azure-functions/consumption-plan
  migrate_to_flex: https://learn.microsoft.com/en-us/azure/azure-functions/migration/migrate-plan-consumption-to-flex
  premium: https://learn.microsoft.com/en-us/azure/azure-functions/functions-premium-plan
  dedicated: https://learn.microsoft.com/en-us/azure/azure-functions/dedicated-plan
  costs: https://learn.microsoft.com/en-us/azure/azure-functions/functions-consumption-costs
  storage: https://learn.microsoft.com/en-us/azure/azure-functions/storage-considerations
  durable_billing: https://learn.microsoft.com/en-us/azure/durable-task/durable-functions/durable-functions-billing
  durable_task_scheduler_billing: https://learn.microsoft.com/en-us/azure/durable-task/scheduler/durable-task-scheduler-billing
  monitoring: https://learn.microsoft.com/en-us/azure/azure-functions/configure-monitoring
  runtime_versions: https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions
read:
  - Flex Consumption - on-demand GB-seconds of instance memory while executing and executions, with monthly free grants per subscription; always-ready instances bill a baseline while idle plus execution time and executions, with no free grant; minimum billable execution and rounding
  - legacy Consumption - GB-seconds and executions with its own free grant; Linux Consumption retirement date and the earlier stop date for v3 apps on it; Windows Consumption is legacy; Flex is Linux only
  - Premium (Elastic Premium, EP) - vCPU and memory per second for every allocated instance, no execution charge; at least one instance per plan always billed; always ready and prewarmed instances
  - Dedicated - an App Service plan at App Service rates, Always On needed for reliable triggers, no Free or Shared; Container Apps hosting bills as Container Apps
  - the storage account every function app needs bills apart and sits outside the free grant; Durable Functions on Azure Storage add queue polling, blob lease and table transactions, and on Consumption each orchestrator replay bills as an execution
  - Durable Task Scheduler - Dedicated per Capacity Unit or Consumption per action
  - savings plan for compute on Flex Consumption and Premium meters
  - quota names - Flex Consumption regional subscription memory quota (cores; lower on Free Trial and Students), maximum instances per plan, function apps per subscription; timeouts per plan and the HTTP response limit
usage_questions:
  - metric: monthly_bill
    ask: Functions cost last month by meter, plus the storage accounts and Application Insights the apps use?
    where: Cost Management → Cost analysis → Group by Service name, then Meter; filter by the function apps' resource groups
  - metric: plans
    ask: Plan type per function app (Flex Consumption, Consumption on Linux or Windows, Premium, Dedicated) and runtime version?
    where: az functionapp list; az functionapp plan list
  - metric: executions
    ask: Executions and execution units per app last month?
    where: function app → Monitoring → Metrics (OnDemandFunctionExecutionCount and Units, AlwaysReadyUnits on Flex; FunctionExecutionCount and Units on Consumption)
  - metric: always_ready
    ask: Always-ready counts (Flex) or always ready instances and maximum burst (Premium)?
    where: function app → Settings → Scale and concurrency (Flex); App Service plan → Scale out (Premium)
  - metric: storage_transactions
    ask: Transactions per month on each app's AzureWebJobsStorage account?
    where: storage account → Monitoring → Metrics (Transactions)
mcp:
  official: true
  readonly_flag: "local @azure/mcp started with `server start --read-only --tool functionapp_get`"
  allowed_tools: [functionapp_get]
common_fixes:
  - migrate Linux Consumption apps to Flex Consumption before the retirement date, v3 apps to v4 first
  - keep always-ready at zero outside production; pick the smallest Flex instance memory that keeps latency
  - lower Premium always ready instances; move low or bursty Premium apps to Flex Consumption
  - set a maximum instance count so abuse cannot scale without limit
  - Application Insights sampling and log levels in host.json
  - for heavy Durable Functions, compare Durable Task Scheduler with Azure Storage transaction cost
verified: 2026-10-11
---

- `@azure/functions`, `azure-functions`, the Durable packages, `.funcignore` and `local.settings.json` (kept out of git, present locally) find Functions directly. `host.json` is not a signal: the name is common outside Functions.
- .NET, Java and PowerShell manifests are not scanned; Go and Rust run as custom handlers with no SDK. Without IaC, ask.
- Static Web Apps managed APIs use `@azure/functions` too; next to `staticwebapp.config.json` with no function app in IaC they bill with the static web app.
- Linux Consumption retires on 30 September 2028, and v3 apps on it stopped running after 30 September 2026: Risk findings with the date. A Premium plan is never idle-free. A Dedicated function app is one more app on an App Service plan.
- Functions with the frontend on another host (Vercel, Netlify, Cloudflare) is a split; an Overlap only when the same API runs on both. Functions with App Service or Container Apps is one family; ask why both.
- Application Insights is usually created with the app (`APPLICATIONINSIGHTS_CONNECTION_STRING`) and bills under Azure Monitor; sampling is on by default.
- MCP: `functionapp_get` returns name, plan, status, host name and tags. Never call other Functions or App Service tools.
