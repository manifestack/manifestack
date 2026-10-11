---
schema: 1
id: azure-blob-storage
name: Azure Blob Storage
family: azure
roles: [storage]
detect:
  packages: ["@azure/storage-blob", "@azure/storage-file-datalake", "@azure/storage-file-share", "@azure/arm-storage", "azure-storage"]
  pypi: ["azure-storage-blob", "azure-storage-file-datalake", "azure-storage-file-share", "azure-mgmt-storage", "azure-storage", "adlfs"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/storage/azblob", "github.com/Azure/azure-sdk-for-go/sdk/storage/azdatalake", "github.com/Azure/azure-sdk-for-go/sdk/storage/azfile", "github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/storage/armstorage", "github.com/Azure/azure-storage-blob-go"]
  imports: ["@azure/storage-blob", "@azure/storage-file-datalake", "@azure/storage-file-share", "@azure/arm-storage", "azure-storage"]
  env_prefixes: ["AZURE_STORAGE_"]
  config_files: []
  service_signals: ['"azurerm_storage_account"', '"azurerm_storage_container"', '"azurerm_storage_blob"', '"azurerm_storage_share"', '"azurerm_storage_data_lake_gen2_filesystem"', '"azurerm_storage_management_policy"', "Microsoft.Storage/storageAccounts", "avm-res-storage-storageaccount", "avm/res/storage/storage-account", "azure-native:storage:", "azure:storage/", "storage.StorageAccount(", "storage.BlobContainer(", "azure.storage.Account(", "azure.storage.Container(", "azure.storage.blob", "azure.storage.filedatalake", "azure.storage.fileshare", ".blob.core.windows.net", ".dfs.core.windows.net", ".file.core.windows.net", "abfss://", "wasbs://", "app.storageBlob(", "input.storageBlob(", "output.storageBlob(", "blob_trigger(", "blob_input(", "blob_output(", "az storage blob ", "az storage container ", "az storage account create", "azcopy "]
  role_signals:
    storage: ["@azure/storage-blob", "@azure/storage-file-datalake", "@azure/storage-file-share", "'azure-storage'", '"azure-storage"', "azure.storage.blob", "azure.storage.filedatalake", "azure.storage.fileshare", "sdk/storage/azblob", "sdk/storage/azdatalake", "sdk/storage/azfile", "azure-storage-blob-go", "adlfs", '"azurerm_storage_container"', '"azurerm_storage_blob"', '"azurerm_storage_share"', '"azurerm_storage_data_lake_gen2_filesystem"', "blobServices/containers", "fileServices/shares", "storage.BlobContainer(", "azure.storage.Container(", "azure-native:storage:BlobContainer", ".blob.core.windows.net", ".dfs.core.windows.net", ".file.core.windows.net", "abfss://", "app.storageBlob(", "input.storageBlob(", "output.storageBlob(", "blob_trigger(", "blob_input(", "blob_output(", "az storage blob ", "az storage container ", "azcopy "]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/storage/blobs/
  data_lake_pricing: https://azure.microsoft.com/en-us/pricing/details/storage/data-lake/
  files_pricing: https://azure.microsoft.com/en-us/pricing/details/storage/files/
  access_tiers: https://learn.microsoft.com/en-us/azure/storage/blobs/access-tiers-overview
  smart_tier: https://learn.microsoft.com/en-us/azure/storage/blobs/access-tiers-smart
  rehydration: https://learn.microsoft.com/en-us/azure/storage/blobs/archive-rehydrate-overview
  redundancy: https://learn.microsoft.com/en-us/azure/storage/common/storage-redundancy
  soft_delete: https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-blob-overview
  versioning: https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview
  lifecycle: https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview
  sftp: https://learn.microsoft.com/en-us/azure/storage/blobs/secure-file-transfer-protocol-support
  limits: https://learn.microsoft.com/en-us/azure/storage/common/scalability-targets-standard-account
  mcp: https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-storage
read:
  - capacity per GB-month by access tier (hot, cool, cold, archive) and redundancy (LRS, ZRS, GRS, RA-GRS, GZRS, RA-GZRS); geo-redundant accounts also pay geo-replication data transfer per GB
  - minimum retention - cool 30, cold 90, archive 180 days on general-purpose v2; deleting, overwriting or moving a blob earlier bills the remaining days; archive needs LRS, GRS or RA-GRS
  - archive rehydration by standard or high priority, taking hours, billed as archive until done, plus read and retrieval charges
  - operations per 10,000 by tier (write, list and create container, read, all other; delete free); moving to a cooler tier bills writes, to a warmer tier reads plus per-GB retrieval; changing the account default tier re-tiers every blob whose tier is inferred
  - smart tier monitoring fee per object above 128 KiB; smaller objects stay hot
  - soft-deleted blobs, versions and snapshots bill at the same rate as live data; change feed records are billed blobs; lifecycle policies are free but their operations bill
  - Data Lake Storage (hierarchical namespace) operations metered per 4 MB and folder metadata billed; SFTP bills per hour while enabled
  - limits - storage accounts per region per subscription, account capacity and request rate targets
usage_questions:
  - metric: storage_gb
    ask: Used capacity per storage account split by access tier, plus how much is soft-deleted data, versions and snapshots?
    where: Storage account → Monitoring → Metrics → Blob Capacity (split by Blob tier); Storage account → Data management → Blob inventory for versions and deleted blobs
  - metric: monthly_bill
    ask: Storage cost last month by meter (data stored per tier and redundancy, operations, geo-replication data transfer, early delete, SFTP)?
    where: Cost Management → Cost analysis → filter Service name = Storage → group by Meter, then Resource
  - metric: transfer_tb
    ask: Egress from the largest accounts last month, and how much went to the internet?
    where: Storage account → Monitoring → Metrics → Egress; Cost analysis → Service name Bandwidth
  - metric: lifecycle
    ask: Redundancy, default access tier, soft delete retention, versioning, change feed, lifecycle rules and SFTP on the large accounts?
    where: Storage account → Overview (Redundancy, Default access tier); Data management → Data protection, Lifecycle management; Settings → SFTP
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with an explicit tool list: npx -y @azure/mcp@latest server start --read-only --tool storage_account_get"
  allowed_tools: [storage_account_get]
common_fixes:
  - use LRS or ZRS unless a copy in a second region is a real requirement
  - add lifecycle rules that move cold blobs to cool or cold and delete old versions and snapshots
  - shorten soft delete retention on containers of temporary or often rewritten files; turn versioning off where nobody restores
  - archive only data kept well past 180 days and rarely read; leave small objects in an online tier
  - turn SFTP off between transfers
  - serve public files through Front Door or a CDN, not straight from the account
  - keep compute in the account's region
verified: 2026-10-11
---

- Azure Functions keeps its runtime state in a storage account (`AzureWebJobsStorage`), and other services create accounts too, so `"azurerm_storage_account"`, `Microsoft.Storage/storageAccounts`, `AZURE_STORAGE_*` env names and the management SDKs (`@azure/arm-storage`, `azure-mgmt-storage`, armstorage) list the service without the storage role. The role counts from the data SDKs, containers, shares or Data Lake filesystems in IaC, account hostnames or `abfss://` paths in code, Functions blob bindings, `azcopy` or `az storage blob`.
- `AZURE_STORAGE_CONNECTION_STRING` and account keys also serve Queue and Table Storage. Queue Storage belongs to `azure-service-bus`; Tables and Files bill in the same account and count here.
- Azurite (`azurite` package, `UseDevelopmentStorage=true`, `devstoreaccount1`) is the local emulator and bills nothing; ask which account production uses.
- `azure-storage` on npm and PyPI and `github.com/Azure/azure-storage-blob-go` are retired SDKs: a Fit note to move to the current packages.
- Blob Storage next to S3, R2, Cloud Storage, Cloudinary or UploadThing is an Overlap unless split on purpose (backups here, public media elsewhere). Egress bills at the account map's bandwidth rates.
- MCP: `--read-only` still exposes `storage_blob_get`, `storage_blob_container_get` and `storage_table_list`, which return file names and metadata; start the server with the `--tool` list above. `storage_account_get` returns SKU, kind and settings, no keys, capacity or cost.
