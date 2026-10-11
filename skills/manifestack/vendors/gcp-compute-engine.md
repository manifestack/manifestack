---
# generated, edit catalog/vendors/gcp-compute-engine.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-compute-engine
name: Google Compute Engine
family: gcp
roles: [hosting]
detect:
  packages: ["@google-cloud/compute"]
  pypi: ["google-cloud-compute"]
  go: ["cloud.google.com/go/compute/apiv1"]
  imports: ["@google-cloud/compute"]
  service_signals: ["\"google_compute_instance\"", "google_compute_instance_template", "google_compute_region_instance_template", "google_compute_instance_group_manager", "google_compute_region_instance_group_manager", "google_compute_instance_from_", "gcloud compute instances ", "gcloud compute instance-templates ", "gcloud compute ssh ", "gcp.compute.Instance", "gcp.compute.RegionInstanceGroupManager", "compute.NewInstance", "compute_v1.InstancesClient", "compute.v1.instance"]
pages:
  pricing: https://cloud.google.com/products/compute/pricing
  general_purpose_pricing: https://cloud.google.com/products/compute/pricing/general-purpose
  disk_image_pricing: https://cloud.google.com/compute/disks-image-pricing
  spot_pricing: https://cloud.google.com/spot-vms/pricing
  sustained_use: https://docs.cloud.google.com/compute/docs/sustained-use-discounts
  committed_use: https://docs.cloud.google.com/compute/docs/instances/committed-use-discounts-overview
  free_tier: https://docs.cloud.google.com/free/docs/free-cloud-features
  billing_by_state: https://docs.cloud.google.com/compute/docs/instances/instance-lifecycle
  quotas: https://docs.cloud.google.com/compute/resource-usage
  idle_vms: https://docs.cloud.google.com/compute/docs/instances/viewing-and-applying-idle-vm-recommendations
  instance_schedules: https://docs.cloud.google.com/compute/docs/instances/schedule-instance-start-stop
read:
  - vCPU and memory rates per machine series and region, per second after a one-minute minimum; premium images (Windows, SLES, RHEL, Ubuntu Pro) add a license charge
  - discounts do not stack - Spot prices (dynamic, preemptible any time), resource-based CUDs (billed monthly whether used or not), Compute Flexible CUDs, and sustained use discounts only on the machine series listed
  - Always Free e2-micro - one instance's worth of hours per month in the listed US regions only, plus a standard persistent disk and egress allowance; GPUs never free
  - billing by state - CPU while RUNNING, memory also while SUSPENDED; disks, snapshots, images and IPs bill while they exist; reservations bill whether used or not
  - Persistent Disk and Hyperdisk per GiB-month provisioned plus Hyperdisk IOPS and throughput above baseline; standard, archive (minimum period, retrieval fee) and instant snapshots; custom and machine image storage
  - quota names - CPUs, CPUs (All Regions), per-series CPU quotas, Preemptible CPUs, Persistent disk standard (GB), SSD-TOTAL-GB, In-use IP addresses
usage_questions:
  - metric: monthly_bill
    ask: Compute Engine cost last month by SKU?
    where: Billing → Reports → Services = Compute Engine → Group by SKU (instance core and RAM, Storage PD Capacity, snapshots, IPs)
  - metric: instances
    ask: Instances with status, machine type, zone and provisioning model?
    where: Compute Engine → VM instances
  - metric: cpu_utilization
    ask: Average CPU per instance, idle VM and machine type recommendations?
    where: Compute Engine → VM instances → instance → Observability; Recommendations Hub
  - metric: idle_storage
    ask: Unattached disks, old snapshots, images and machine images?
    where: Compute Engine → Storage → Disks (In use by empty), Snapshots, Images, Machine images
  - metric: commitments
    ask: Active commitments, end dates and utilization?
    where: Compute Engine → Committed use discounts; Billing → Committed use discounts
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - delete idle instances, unattached disks, old snapshots and unused images
  - apply machine type recommendations; E2 or Arm series where the software allows
  - Spot VMs for batch and stateless work
  - suspend or schedule start and stop for dev machines
  - archive snapshots for long retention
  - CUDs only for a 24/7 baseline after a few months of history
  - keep a free e2-micro in an eligible region with a standard persistent disk
verified: 2026-10-11
---

- `@google-cloud/compute` also manages networks, firewalls and load balancers; confirm instances exist before a finding. Go matches the `cloud.google.com/go/compute/apiv1` import only, since `cloud.google.com/go/compute/metadata` is in most Go apps on Google Cloud. `metadata.google.internal` and `gcp-metadata` run everywhere on Google Cloud: not signals.
- GKE Standard nodes and App Engine flexible VMs bill under Compute Engine SKUs but belong to `gcp-gke` and `gcp-app-engine`.
- Packer and Deployment Manager Jinja templates are not scanned; ask.
- Compute Engine beside another host for the same app is an Overlap unless split on purpose.
- MCP: the remote server (`compute.googleapis.com/mcp`) mixes reads with create, delete, start, stop and set machine type tools; read-only needs an IAM deny policy on `tool.isReadOnly`, a standing project setting. Do not use it.
