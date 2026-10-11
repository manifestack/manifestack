---
# generated, edit catalog/vendors/gcp-gke.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-gke
name: Google Kubernetes Engine (GKE)
family: gcp
roles: [hosting]
detect:
  packages: ["@google-cloud/container"]
  pypi: ["google-cloud-container"]
  go: ["cloud.google.com/go/container"]
  imports: ["@google-cloud/container"]
  service_signals: ["google_container_cluster", "google_container_node_pool", "terraform-google-modules/kubernetes-engine", "gcloud container clusters ", "gcloud container node-pools ", "gke-gcloud-auth-plugin", "cloud-builders/gke-deploy", "gcp.container.Cluster", "gcp.container.NodePool", "container.NewCluster(", "container_v1.ClusterManagerClient", "container.cnrm.cloud.google.com", ".gke.io/", "cloud.google.com/gke-", "cloud.google.com/compute-class", "cloud.google.com/neg"]
pages:
  pricing: https://cloud.google.com/kubernetes-engine/pricing
  autopilot: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview
  autopilot_requests: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/autopilot-resource-requests
  spot_pods: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/autopilot-spot-pods
  versioning: https://docs.cloud.google.com/kubernetes-engine/versioning
  quotas: https://docs.cloud.google.com/kubernetes-engine/quotas
  cost_allocation: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/cost-allocations
  cost_optimization: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/cost-optimization-metrics
  mcp: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/use-gke-mcp
read:
  - cluster management fee per cluster-hour for every cluster type; the monthly free tier credit per billing account covers about one zonal Standard or Autopilot cluster, never a regional one or compute
  - Extended channel - an extra cluster fee once the minor version passes end of standard support
  - Autopilot Pod-based billing per second for requested vCPU, memory and ephemeral storage; Autopilot raises low requests to its minimums and ratios; Pods in CrashLoopBackOff or ImagePullBackOff are billed; Balanced, Scale-Out and Spot Pod rates
  - Autopilot Pods that select hardware or GPUs bill the whole node at Compute Engine prices plus a management premium
  - Standard node pools bill as Compute Engine VMs and disks until deleted, busy or not
  - Kubernetes Engine CUD rates; Backup for GKE, Multi Cluster Gateway and Ingress billed separately; Services and Ingresses create billed load balancers
  - quota names - Nodes per cluster, Nodes per node pool, Pods per cluster, Concurrent operations, plus Compute Engine CPU and IP quotas
usage_questions:
  - metric: monthly_bill
    ask: GKE and node cost last month by SKU?
    where: Billing → Reports → Services = Kubernetes Engine and Compute Engine → Group by SKU; with cost allocation on, group by label goog-k8s-cluster-name
  - metric: clusters
    ask: Clusters with mode, location type, release channel, version and node count?
    where: Kubernetes Engine → Clusters
  - metric: cpu_utilization
    ask: Requested vs used CPU and memory per cluster?
    where: Kubernetes Engine → Clusters → Cost Optimization tab
  - metric: cost_by_namespace
    ask: Cost allocation on, and top namespaces by cost?
    where: Kubernetes Engine → Clusters → cluster → Features → Cost Allocation; Billing → Reports by label k8s-namespace
mcp:
  official: true
  readonly_flag: "remote read-only toolset https://container.googleapis.com/mcp/read-only, as a principal with only roles/mcp.toolUser and roles/container.clusterViewer (scope container.read-only)"
  allowed_tools: [list_clusters, get_cluster, list_node_pools, get_node_pool, list_operations, get_operation, get_k8s_version, get_k8s_cluster_info]
common_fixes:
  - consolidate small clusters into one zonal or Autopilot cluster
  - Autopilot for small or spiky workloads, with requests set to real usage
  - cluster autoscaler and dev node pools scaled to zero off hours
  - Spot Pods or Spot node pools for interruption-tolerant work
  - upgrade before end of standard support instead of paying the extended fee
  - delete unused LoadBalancer Services and Ingresses
  - CUD for a steady baseline
verified: 2026-10-11
---

- detect lists Kubernetes manifests, Helm and Kustomize under `infra` for any cluster; `.gke.io/` annotations, `cloud.google.com/gke-` selectors, Config Connector and Terraform tie them to GKE. `@google-cloud/container` only manages clusters, so most apps on GKE show no SDK.
- Overbuilt: a cluster for one web service, a small API or a pre-launch app pays the cluster fee plus idle nodes; Cloud Run usually fits. A regional Standard cluster for a small app is worse.
- Standard nodes appear under Compute Engine SKUs; count them here.
- GKE beside another host for the same app is an Overlap unless split on purpose.
- MCP: in the read-only toolset, `get_k8s_resource` and `describe_k8s_resource` can read Secrets and `get_k8s_logs` returns log lines, so they are left out. The default `/mcp` endpoint and local `gke-mcp` have create and update tools.
