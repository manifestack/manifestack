---
# generated, edit catalog/vendors/azure-app-service.md (then run: node tools/sync.mjs)
schema: 1
id: azure-app-service
name: Azure App Service and Static Web Apps
family: azure
roles: [hosting]
detect:
  packages: ["@azure/arm-appservice", "@azure/static-web-apps-cli"]
  pypi: ["azure-mgmt-web"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/appservice/armappservice"]
  imports: ["@azure/arm-appservice"]
  config_files: ["staticwebapp.config.json", "swa-cli.config.json"]
  service_signals: ["\"azurerm_linux_web_app", "\"azurerm_windows_web_app", "\"azurerm_app_service\"", "\"azurerm_static_web_app\"", "\"azurerm_static_site\"", "Microsoft.Web/staticSites", "kind: 'app,", "'app,linux", "appservice.LinuxWebApp", "appservice.WindowsWebApp", "appservice.StaticWebApp", "web.StaticSite(", "az webapp ", "az staticwebapp ", "swa deploy", "AzureWebApp@", "AzureWebAppContainer@", "AzureStaticWebApp@", "appType: webApp", "appType: 'webApp", ".azurestaticapps.net", "from azure.mgmt.web import", "azure/webapps-deploy@", "azure/static-web-apps-deploy@"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/app-service/linux/
  windows_pricing: https://azure.microsoft.com/en-us/pricing/details/app-service/windows/
  plans: https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans
  manage_costs: https://learn.microsoft.com/en-us/azure/app-service/overview-manage-costs
  limits: https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits
  free_quotas: https://learn.microsoft.com/en-us/azure/app-service/web-sites-monitor
  general_settings: https://learn.microsoft.com/en-us/azure/app-service/configure-common
  slots: https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots
  premium_v4: https://learn.microsoft.com/en-us/azure/app-service/app-service-configure-premium-v4-tier
  isolated: https://learn.microsoft.com/en-us/azure/app-service/environment/overview
  static_pricing: https://azure.microsoft.com/en-us/pricing/details/app-service/static/
  static_plans: https://learn.microsoft.com/en-us/azure/static-web-apps/plans
  static_quotas: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas
  static_apis: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions
read:
  - hourly rate per plan instance by tier and size (Free, Shared on Windows, Basic, Standard, Premium v2, Premium v3, Premium v4, Isolated v2), Linux and Windows priced apart, prorated to the second
  - a plan bills every instance while it exists, whether its apps run, are stopped or were deleted; slots, WebJobs, backups and diagnostics run on the same instances with no charge of their own
  - scale-out instances multiply the bill; autoscale from Standard; maximum instances per tier
  - Free and Shared quotas (CPU per five minutes and per day, memory, outbound bandwidth per day, storage); past a CPU or bandwidth quota the app returns HTTP 403 until it resets, past memory it stops briefly, past storage writes fail; no SLA
  - Always On (Basic and up) keeps the app loaded at no extra charge; off, the app unloads after idle time
  - billed apart - IP-based TLS beyond the one included from Standard, App Service domains and certificates, backup storage, Log Analytics, a NAT gateway for Premium v4 (no stable outbound IPs)
  - Isolated v2 bills per instance in an App Service Environment v3; an empty environment bills as one Windows I1v2 instance
  - reservations and savings plan on Premium v3, Premium v4 and Isolated v2 only (none on Basic, Standard or Premium v2); Dev/Test rates
  - Static Web Apps - Free (no SLA, site not served past its quotas) or Standard per app per hour; bandwidth included per subscription and the Standard overage per GB; storage per app and environment, preview environments, custom domains, apps per subscription; the Dedicated plan is retired
  - Static Web Apps APIs - managed Functions (HTTP triggers only, short runtime list) or a linked Functions app billed on its own plan; enterprise-grade edge per app
usage_questions:
  - metric: monthly_bill
    ask: App Service and Static Web Apps cost last month by meter?
    where: Cost Management → Cost analysis → Group by Service name, then Meter
  - metric: plans
    ask: Every plan with tier, instance count and number of apps, including plans with no running apps?
    where: az appservice plan list; plan → Settings → Scale up (App Service plan) and Scale out (App Service plan)
  - metric: stopped_apps
    ask: Stopped apps and the plans they sit on?
    where: az webapp list (state, serverFarmId)
  - metric: slots
    ask: Deployment slots per app?
    where: app → Deployment → Deployment slots
  - metric: cpu_utilization
    ask: Average and peak CPU and memory per plan?
    where: plan → Monitoring → Metrics (CPU Percentage, Memory Percentage)
  - metric: static_apps
    ask: Static web apps on Standard, and bandwidth overage last month?
    where: static web app → Settings → Hosting plan; Cost analysis → Group by Meter
mcp:
  official: true
  readonly_flag: "local @azure/mcp started with `server start --read-only --tool appservice_webapp_get`; --read-only alone still exposes appservice_webapp_settings_get-appsettings (secrets)"
  allowed_tools: [appservice_webapp_get]
common_fixes:
  - delete plans with no running apps or scale them to Free; delete stopped apps nobody needs
  - put small apps on one plan within the density guidance; give noisy apps their own plan
  - autoscale with schedules; one instance in non-production
  - fewer, larger Premium v3 or v4 instances instead of many Basic or Standard ones; reserve the steady baseline
  - delete unused deployment slots
  - Static Web Apps Free for sites inside its quotas
verified: 2026-10-11
---

- `staticwebapp.config.json`, `swa-cli.config.json` and `@azure/static-web-apps-cli` find Static Web Apps directly. `@azure/arm-appservice` and `azure-mgmt-web` are management clients; IaC, `az webapp` and pipeline tasks show what runs here.
- Function apps also use `Microsoft.Web/sites` and `Microsoft.Web/serverfarms`, `.azurewebsites.net`, the `WEBSITE_*` variables and `azurerm_service_plan`, so none of these is a signal. If the family is found and Bicep or Pulumi `web.WebApp` has a site with no `functionapp` kind (a Windows web app is plain `kind: 'app'`, too common in app code to be a signal), count App Service by hand.
- A plan with no apps bills like one with apps; a Free plan is the only one that costs nothing.
- An `api/` folder next to `staticwebapp.config.json` is usually the managed API, billed with the static web app, not as a function app.
- App Service beside another host is an Overlap only when the same traffic runs on both. App Service, Functions and Container Apps are one family, so never reported as an Overlap; still ask why one app uses two.
- Logs stay on the app file system unless Application Insights or a diagnostic setting sends them to Azure Monitor.
- MCP: `appservice_webapp_get` returns name, kind, state, SKU and host names. Never call the app settings, diagnose or deployment tools.
