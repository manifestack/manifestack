---
schema: 1
id: azure-aks
name: Azure Kubernetes Service (AKS)
family: azure
roles: [hosting]
detect:
  packages: ["@azure/arm-containerservice"]
  pypi: ["azure-mgmt-containerservice"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/containerservice/armcontainerservice"]
  imports: ["@azure/arm-containerservice"]
  service_signals: ['"azurerm_kubernetes_cluster"', '"azurerm_kubernetes_cluster_node_pool"', "Azure/aks/azurerm", "avm-res-containerservice-managedcluster", "avm/res/container-service/managed-cluster", "Microsoft.ContainerService/managedClusters", "azure-native:containerservice:", "azure:containerservice:KubernetesCluster", "containerservice.ManagedCluster", "containerservice.KubernetesCluster", "azure.mgmt.containerservice", "az aks ", "kubelogin convert-kubeconfig", "Azure/kubelogin", "kubernetes.azure.com", "azure.workload.identity/", "service.beta.kubernetes.io/azure-"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/kubernetes-service/
  tiers: https://learn.microsoft.com/en-us/azure/aks/free-standard-pricing-tiers
  automatic: https://learn.microsoft.com/en-us/azure/aks/intro-aks-automatic
  long_term_support: https://learn.microsoft.com/en-us/azure/aks/long-term-support
  versions: https://learn.microsoft.com/en-us/azure/aks/supported-kubernetes-versions
  node_resource_group: https://learn.microsoft.com/en-us/azure/aks/faq
  spot_node_pools: https://learn.microsoft.com/en-us/azure/aks/spot-node-pool
  start_stop: https://learn.microsoft.com/en-us/azure/aks/start-stop-cluster
  cost_analysis: https://learn.microsoft.com/en-us/azure/aks/cost-analysis
  cost_best_practices: https://learn.microsoft.com/en-us/azure/aks/best-practices-cost
  container_insights_cost: https://learn.microsoft.com/en-us/azure/azure-monitor/containers/container-insights-cost
  quotas: https://learn.microsoft.com/en-us/azure/aks/quotas-skus-regions
  mcp: https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-kubernetes
read:
  - cluster management tiers - Free (no fee, no financially backed SLA, not meant for more than ten nodes), Standard (uptime SLA, fee per cluster-hour) and Premium (Standard plus a Long Term Support fee per cluster-hour); Automatic clusters always use the Standard tier
  - AKS Automatic - an hourly hosted control plane fee plus an hourly Automatic fee on node compute by VM category, on top of the VM price; it turns on node autoprovisioning, a managed NAT gateway and, from the CLI or portal, Managed Prometheus and Container insights
  - node pools bill as Virtual Machine Scale Set VMs plus their managed OS disks, busy or idle; reservations and savings plans apply to node VMs
  - the node resource group (MC_<group>_<cluster>_<region> by default) holds node VMs, disks, load balancers and public IPs; each LoadBalancer Service and persistent volume adds billed resources there; it is deleted with the cluster
  - Spot node pools - variable price, no SLA, eviction policy Delete (default) or Deallocate; deallocated nodes count against quota; a Spot pool can never be the system pool
  - a stopped cluster stops its control plane and nodes to save compute, keeps state up to 12 months, and may not restart in a capacity-constrained region
  - version support - N-2 minor versions, then platform support with a 60-day grace period before AKS upgrades the cluster itself; LTS needs the Premium tier
  - Container insights and Managed Prometheus bill in Azure Monitor by data ingested and retained; ContainerLogV2 can use the cheaper Basic logs plan
  - quota names - Total Regional vCPUs and the per-family vCPU quotas of the node VM sizes, a separate Spot vCPU quota, clusters per subscription, nodes per cluster and per node pool
usage_questions:
  - metric: monthly_bill
    ask: AKS cost last month by meter, including node VMs, disks, load balancers and IPs in the node resource group?
    where: Cost Management → Cost analysis → filter Resource group = the cluster's group and its MC_ node resource group → group by Service name, then Meter
  - metric: clusters
    ask: Clusters with pricing tier, Automatic or Standard, Kubernetes version, support plan, power state, and node pools (VM size, count, autoscaler range, Spot)?
    where: Kubernetes services → cluster → Overview; Settings → Node pools
  - metric: cpu_utilization
    ask: Requested vs used CPU and memory per node pool, and idle cost?
    where: Kubernetes services → cluster → Monitoring → Insights; with the cost analysis add-on (Standard or Premium tier), Cost Management → Cost analysis → Kubernetes views
  - metric: logs_ingested_gb
    ask: Log Analytics GB ingested per day from the cluster, top tables (ContainerLogV2, KubePodInventory, Perf)?
    where: Kubernetes services → cluster → Monitoring → Workbooks → Container Insights Usage
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with an explicit tool list: npx -y @azure/mcp@latest server start --read-only --tool aks_cluster_get --tool aks_nodepool_get; never the AKS MCP server (Azure/aks-mcp)"
  allowed_tools: [aks_cluster_get, aks_nodepool_get]
common_fixes:
  - Free tier for dev and test clusters; Standard only where the uptime SLA matters
  - cluster autoscaler with user node pools that scale to zero, or stop dev clusters off hours
  - Spot node pools for interruptible work, eviction policy Delete
  - right-size node VM sizes and pod requests from Container insights data
  - collect fewer Container insights tables, filter stdout and namespaces, ContainerLogV2 on Basic logs
  - delete unused LoadBalancer Services, public IPs and orphaned disks in the node resource group
  - upgrade before platform support ends instead of paying for Premium only to stay on an old version
verified: 2026-10-11
---

- detect lists Kubernetes manifests, Helm and Kustomize under `infra` for any cluster; `kubernetes.azure.com` labels and the app routing ingress class, `azure.workload.identity/` and `service.beta.kubernetes.io/azure-` annotations, Terraform, Bicep and `az aks` tie them to AKS. `@azure/arm-containerservice` only manages clusters, so most apps on AKS show no SDK. `kubelogin` alone is not a signal: a different OIDC plugin uses the same binary name.
- Overbuilt: a cluster for one web service, a small API or a pre-launch app pays for idle nodes, a load balancer and IPs; Container Apps or App Service usually fit. A Standard-tier cluster for a hobby app adds the SLA fee.
- Node VMs and disks appear under Virtual Machines and Storage meters in the MC_ resource group; count them here, not in `azure-virtual-machines`.
- AKS beside another host for the same app is an Overlap unless split on purpose.
- MCP: the AKS MCP server's default `readonly` access level still runs `kubectl get`, `describe` and `logs` through `call_kubectl` (Secrets, pod logs) and any read `az` command through `call_az`; its README calls the access level a guardrail, not a security boundary. Do not use it. The Azure MCP Server tools above return cluster and node pool settings only, no cost.
