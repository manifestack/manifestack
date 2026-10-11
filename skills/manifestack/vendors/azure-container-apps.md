---
# generated, edit catalog/vendors/azure-container-apps.md (then run: node tools/sync.mjs)
schema: 1
id: azure-container-apps
name: Azure Container Apps and Container Instances
family: azure
roles: [hosting]
detect:
  packages: ["@azure/arm-appcontainers", "@azure/arm-containerinstance"]
  pypi: ["azure-mgmt-appcontainers", "azure-mgmt-containerinstance"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/appcontainers/armappcontainers", "github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/containerinstance/armcontainerinstance"]
  imports: ["@azure/arm-appcontainers", "@azure/arm-containerinstance"]
  service_signals: ["\"azurerm_container_app", "\"azurerm_container_group\"", "Microsoft.App/containerApps", "Microsoft.App/managedEnvironments", "Microsoft.App/jobs", "Microsoft.ContainerInstance/containerGroups", "containerapp.App(", "containerapp.Environment(", "containerservice.Group(", "app.ContainerApp(", "app.ManagedEnvironment(", "containerinstance.ContainerGroup(", "az containerapp ", "az container create", "AzureContainerApps@", ".azurecontainerapps.io", ".azurecontainer.io", "CONTAINER_APP_NAME", "CONTAINER_APP_REVISION", "CONTAINER_APP_JOB_NAME", "from azure.mgmt.appcontainers import", "from azure.mgmt.containerinstance import", "azure/container-apps-deploy-action@"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/container-apps/
  billing: https://learn.microsoft.com/en-us/azure/container-apps/billing
  plans: https://learn.microsoft.com/en-us/azure/container-apps/plans
  workload_profiles: https://learn.microsoft.com/en-us/azure/container-apps/workload-profiles-overview
  scaling: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
  quotas: https://learn.microsoft.com/en-us/azure/container-apps/quotas
  logging: https://learn.microsoft.com/en-us/azure/container-apps/log-options
  environment_cli: https://learn.microsoft.com/en-us/cli/azure/containerapp/env
  aci_pricing: https://azure.microsoft.com/en-us/pricing/details/container-instances/
  aci_overview: https://learn.microsoft.com/en-us/azure/container-instances/container-instances-overview
  aci_quotas: https://learn.microsoft.com/en-us/azure/container-instances/container-instances-resource-and-quota-limits
  acr_pricing: https://azure.microsoft.com/en-us/pricing/details/container-registry/
  acr_tiers: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-skus
read:
  - Consumption - vCPU-seconds and GiB-seconds per running replica at the active rate, a lower idle rate for replicas kept by min replicas above zero while idle (thresholds on the billing page), and HTTP requests from outside the environment; monthly free grants of each per subscription; nothing while scaled to zero
  - jobs bill at the active rate from start to completion, with no request charge
  - Dedicated workload profiles bill per profile instance, plus a Dedicated plan management fee once any Dedicated profile exists (private endpoints and planned maintenance each add the same hourly fee); the Flexible profile (preview) bills like Consumption plus that fee and cannot scale to zero
  - serverless GPU per second on top of vCPU and memory; dynamic sessions (code interpreter per allocated session, custom containers on Dedicated instances)
  - environment logs go to a Log Analytics workspace by default, and `az containerapp env create` without one creates it; ingestion bills under Azure Monitor
  - quota names - Managed Environment Count per region; Consumption, General Purpose and Memory Optimized cores per environment; scaling stops at the limit
  - savings plan for compute on Consumption and Dedicated meters
  - Container Instances - per second per container group from start to stop, vCPU request rounded up to a whole vCPU and memory to a tenth of a GB; Windows software duration extra; Spot and confidential rates; no scale to zero
  - Container Registry - daily rate per registry by tier (Basic, Standard, Premium) with included storage, extra storage per GB per day, geo-replication per region and Tasks build time
usage_questions:
  - metric: monthly_bill
    ask: Container Apps, Container Instances and Container Registry cost last month by meter?
    where: Cost Management → Cost analysis → Group by Service name, then Meter
  - metric: replicas
    ask: Min and max replicas per app; which apps never scale to zero?
    where: container app → Scale; az containerapp list
  - metric: workload_profiles
    ask: Workload profiles per environment, Dedicated profile type and instance count?
    where: az containerapp env workload-profile list
  - metric: quota
    ask: Cores used vs the environment quota?
    where: az containerapp env list-usages
  - metric: logs_ingested_gb
    ask: Logs destination and workspace per environment, GB ingested last month?
    where: environment → Monitoring → Logging options; Cost analysis → Group by Resource (the workspace)
  - metric: aci_groups
    ask: Container groups running all the time, their vCPU and memory?
    where: az container list
mcp:
  official: true
  readonly_flag: "local @azure/mcp started with `server start --read-only --tool containerapps_list --tool acr_registry_list`"
  allowed_tools: [containerapps_list, acr_registry_list]
common_fixes:
  - min replicas 0 outside production; set max replicas on every app
  - run scheduled work as jobs instead of apps kept warm
  - remove Dedicated profiles that Consumption could carry, which also drops the management fee
  - one Log Analytics workspace per region with a daily cap, or "Don't save logs" in dev environments
  - replace always-on Container Instances groups with Container Apps or jobs; delete stopped groups
  - Basic registry unless Premium features are needed; delete old images
verified: 2026-10-11
---

- Container Registry is not a signal here: `.azurecr.io` and `azurerm_container_registry` serve App Service, AKS and Container Apps alike. If one appears, read its lines here and ask what pulls from it.
- `.azurecontainer.io` and `azurerm_container_group` mean Container Instances, billed while running; a group left on is a Bill finding.
- `CONTAINER_APP_*` variables in code mean the app runs here.
- Function apps hosted on Container Apps bill as Container Apps.
- Container Apps beside another host is an Overlap when the same traffic runs on both; an API here with the frontend elsewhere is a split. With App Service or Functions it is one family; ask why both.
- The default Log Analytics workspace can cost more than small apps; check ingestion.
- MCP: `containerapps_list` returns name, location, resource group, environment and provisioning state (not replicas or scale); `acr_registry_list` returns registries with SKU. Never call log query tools.
