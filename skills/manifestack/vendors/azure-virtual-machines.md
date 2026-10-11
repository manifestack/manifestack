---
# generated, edit catalog/vendors/azure-virtual-machines.md (then run: node tools/sync.mjs)
schema: 1
id: azure-virtual-machines
name: Azure Virtual Machines
family: azure
roles: [hosting]
detect:
  packages: ["@azure/arm-compute"]
  pypi: ["azure-mgmt-compute"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/compute/armcompute"]
  imports: ["@azure/arm-compute"]
  service_signals: ['"azurerm_linux_virtual_machine"', '"azurerm_windows_virtual_machine"', '"azurerm_virtual_machine"', '"azurerm_linux_virtual_machine_scale_set"', '"azurerm_windows_virtual_machine_scale_set"', '"azurerm_orchestrated_virtual_machine_scale_set"', '"azurerm_managed_disk"', "avm-res-compute-virtualmachine", "avm/res/compute/virtual-machine", "Microsoft.Compute/virtualMachines", "Microsoft.Compute/virtualMachineScaleSets", "Microsoft.Compute/disks", "azure-native:compute:", "azure:compute:", "compute.VirtualMachine(", "compute.VirtualMachineScaleSet(", "compute.LinuxVirtualMachine", "compute.WindowsVirtualMachine", "azure.mgmt.compute", "az vm create", "az vmss create"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/virtual-machines/linux/
  windows_pricing: https://azure.microsoft.com/en-us/pricing/details/virtual-machines/windows/
  disk_pricing: https://azure.microsoft.com/en-us/pricing/details/managed-disks/
  states_billing: https://learn.microsoft.com/en-us/azure/virtual-machines/states-billing
  disk_types: https://learn.microsoft.com/en-us/azure/virtual-machines/disks-types
  snapshots: https://learn.microsoft.com/en-us/azure/virtual-machines/disks-incremental-snapshots
  spot: https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms
  b_series: https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/b-series-cpu-credit-model
  hybrid_benefit: https://learn.microsoft.com/en-us/azure/virtual-machines/windows/hybrid-use-benefit-licensing
  reservations: https://learn.microsoft.com/en-us/azure/virtual-machines/prepay-reserved-vm-instances
  free_account: https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account
  auto_shutdown: https://learn.microsoft.com/en-us/azure/virtual-machines/auto-shutdown-vm
  quotas: https://learn.microsoft.com/en-us/azure/virtual-machines/quotas
  advisor: https://learn.microsoft.com/en-us/azure/advisor/advisor-cost-recommendations
  mcp: https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-compute
read:
  - compute rate per size, region and OS; the pricing FAQ bills full minutes of running time; Windows sizes include the Windows Server license unless Azure Hybrid Benefit is set; some Marketplace images add a publisher charge
  - billing by power state - Starting, Running and Stopped (allocated) bill compute, and a shutdown from inside the guest OS leaves the VM Stopped (allocated); only Stopped (deallocated) and Hibernated (deallocated) stop compute; disks and static public IPs keep billing
  - managed disks billed hourly by provisioned size rounded up to the next size tier, attached or not; Standard HDD and Standard SSD also bill transactions per 10,000 up to an hourly cap; Premium SSD v2 and Ultra Disk bill per GiB plus provisioned IOPS and throughput; the temporary disk is free
  - snapshots billed on used size, incremental ones on the changes since the last snapshot, for as long as they exist
  - Spot VMs - variable price capped by an optional max price, eviction with up to 30 seconds notice, policy Deallocate (default; disks keep billing, quota stays used) or Delete; no B-series, no SLA
  - B-series burstable sizes bank credits below their base CPU level and spend them above it; with no credits left the VM is throttled to base
  - reservations (one or three years, instance size flexibility) and savings plans for compute apply to VMs and scale sets
  - free account - 12 months of a monthly hour allowance for each of B1s, B2pts v2 and B2ats v2, Linux or Windows; other sizes and anything beyond the allowance bill
  - scale sets have no charge of their own; quota names Total Regional vCPUs, Standard <family> Family vCPUs, a separate Spot vCPU quota, and a VM count per region
usage_questions:
  - metric: monthly_bill
    ask: VM, disk, snapshot and public IP cost last month by meter?
    where: Cost Management → Cost analysis → filter Service name = Virtual Machines, Storage, Virtual Network → group by Meter
  - metric: instances
    ask: VMs and scale sets with size, OS, region, power state, Spot or regular, and Azure Hybrid Benefit?
    where: Virtual machines (columns Size, Status, Operating system, Location); Virtual machine scale sets; VM → Overview → Licensing
  - metric: cpu_utilization
    ask: Average and peak CPU per VM, CPU Credits Remaining on B-series, and Advisor right-size or shutdown recommendations?
    where: VM → Monitoring → Metrics (Percentage CPU, CPU Credits Remaining); Advisor → Cost
  - metric: idle_storage
    ask: Unattached managed disks, old snapshots and images, unattached public IPs?
    where: Disks (Disk state Unattached); Snapshots; Images; Public IP addresses (Associated to empty)
  - metric: commitments
    ask: Active reservations and savings plans, scope, end dates and utilization?
    where: Reservations; Savings plans → Utilization
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with an explicit tool list: npx -y @azure/mcp@latest server start --read-only --tool compute_vm_get --tool compute_vmss_get --tool compute_disk_get"
  allowed_tools: [compute_vm_get, compute_vmss_get, compute_disk_get]
common_fixes:
  - deallocate idle VMs from the portal, CLI or API, never just shut down the OS; auto-shutdown for dev VMs
  - delete unattached disks, old snapshots and images, and unattached public IPs
  - apply Advisor right-size recommendations; B-series or Arm sizes for low average CPU
  - Spot VMs or Spot scale sets for batch and stateless work, eviction policy Delete when disks are not needed
  - Standard SSD instead of Premium SSD for low-IO disks; pick sizes at a tier boundary
  - Azure Hybrid Benefit on Windows VMs when Windows Server licenses with Software Assurance exist
  - reservations or a savings plan only for a 24/7 baseline after a few months of history
  - keep the free-account VM on an eligible size
verified: 2026-10-11
---

- `@azure/arm-compute`, `azure-mgmt-compute` and armcompute also manage disks, images, galleries and scale sets; confirm VMs exist before a finding.
- AKS node pools are scale sets in the cluster's MC_ node resource group, billed under Virtual Machines meters; they belong to `azure-aks`. Check the resource group before counting a scale set here.
- A VM shut down from inside the OS shows Stopped and still bills compute. Only Stopped (deallocated) ends compute charges.
- Packer templates, cloud-init files and ARM JSON are not scanned; ask. `azurerm_virtual_machine` is the older Terraform resource, replaced by the Linux and Windows ones.
- VMs beside another host for the same app are an Overlap unless split on purpose.
- MCP: `--read-only` hides the create, update, delete and power-state tools; the tools above return configuration, power state and disk sizes, no cost.
