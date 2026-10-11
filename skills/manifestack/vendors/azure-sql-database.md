---
# generated, edit catalog/vendors/azure-sql-database.md (then run: node tools/sync.mjs)
schema: 1
id: azure-sql-database
name: Azure SQL Database and SQL Managed Instance
family: azure
roles: [database]
detect:
  packages: ["@azure/arm-sql"]
  pypi: ["azure-mgmt-sql"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/sql/armsql"]
  imports: ["@azure/arm-sql"]
  env_prefixes: ["AZURE_SQL_"]
  config_files: []
  service_signals: ['"azurerm_mssql_server"', '"azurerm_mssql_database"', '"azurerm_mssql_elasticpool"', '"azurerm_mssql_managed_instance"', '"azurerm_sql_server"', '"azurerm_sql_database"', "Microsoft.Sql/servers", "Microsoft.Sql/managedInstances", "azure-native:sql:", "azure_native.sql.", "azure:mssql:", "azure.mssql.", "az sql ", "azure.mgmt.sql", '.database.windows.net"', ".database.windows.net'", ".database.windows.net`", ".database.windows.net,", ".database.windows.net:", "https://database.windows.net/"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/azure-sql-database/single/
  elastic_pricing: https://azure.microsoft.com/en-us/pricing/details/azure-sql-database/elastic/
  managed_instance_pricing: https://azure.microsoft.com/en-us/pricing/details/azure-sql-managed-instance/single/
  free_offer: https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer
  serverless: https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview
  auto_pause: https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-auto-pause-resume
  backups: https://learn.microsoft.com/en-us/azure/azure-sql/database/automated-backups-overview
  hyperscale: https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tier-hyperscale
  hybrid_benefit: https://learn.microsoft.com/en-us/azure/azure-sql/azure-hybrid-benefit
  standby_replica: https://learn.microsoft.com/en-us/azure/azure-sql/database/standby-replica-how-to-configure
  costs: https://learn.microsoft.com/en-us/azure/azure-sql/database/cost-management
  mi_free_offer: https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/free-offer
read:
  - vCore model per vCore-hour by service tier (General Purpose, Business Critical, Hyperscale) and hardware, against the DTU model (Basic, Standard, Premium) where compute, storage and short-term backups come as one bundle per database or eDTU pool
  - serverless per vCore-second between the minimum vCores and memory and the maximum, the auto-pause delay, storage billed while paused, and the features that keep a database from pausing (geo-replication, failover groups, long-term retention, DNS alias)
  - "free offer: monthly vCore-seconds, data and backup storage per database, the number of free databases per subscription, and the Behavior when free limit reached setting (auto-pause until next month, or continue with charges at serverless rates)"
  - provisioned compute billed per hour; elastic pools per vCore or eDTU of the pool
  - Hyperscale per vCore per replica (primary, HA, named), storage billed as allocated, no SQL license fee
  - backup storage per GB-month beyond the free amount equal to max data size, by redundancy (LRS, ZRS, GRS default, GZRS); long-term retention storage
  - geo-replicas and failover group secondaries billed as full databases; a license-free standby replica for one DR secondary
  - Azure Hybrid Benefit (provisioned vCore only, not serverless, DTU or new Hyperscale) and reservations
  - SQL Managed Instance per vCore-hour and storage from creation, stop and start in General Purpose, and its free offer (one per subscription, monthly vCore hours, ends after a year)
usage_questions:
  - metric: instances
    ask: Each database's purchasing model and tier (DTU or vCore, serverless or provisioned, Hyperscale), max vCores or DTUs, elastic pool, replicas, and whether it uses the free offer?
    where: Azure portal → SQL databases (Pricing tier column) → database → Overview; Settings → Compute + storage; Data management → Replicas
  - metric: db_size
    ask: Used and allocated data space, max size, backup retention and backup storage redundancy?
    where: Azure portal → SQL database → Overview (Storage); Settings → Compute + storage; logical server → Data management → Backups → Retention policies
  - metric: free_vcore_seconds
    ask: For free offer databases, free vCore-seconds left this month and the behavior at the limit?
    where: Azure portal → SQL database → Overview (Free monthly vCore amount) → Metrics (Free amount remaining); Settings → Compute + storage
  - metric: monthly_bill
    ask: Last month's cost by meter subcategory (compute, storage, PITR and LTR backup storage, license) for SQL Database and SQL Managed Instance?
    where: Azure portal → Cost Management + Billing → Cost Management → Cost analysis → filter Service name SQL Database or SQL Managed Instance → Group by Meter subcategory
mcp:
  official: true
  readonly_flag: "local Azure MCP Server started with --read-only and only these tools: npx -y @azure/mcp@latest server start --read-only --tool sql_server_get --tool sql_db_get --tool sql_elastic-pool_list"
  allowed_tools: [sql_server_get, sql_db_get, sql_elastic-pool_list]
common_fixes:
  - move dev and intermittent databases to serverless General Purpose with auto-pause, and close idle connections and tools that keep it awake
  - use the free offer for small databases and set it to auto-pause at the limit
  - pool many small databases in an elastic pool instead of sizing each one
  - set backup storage redundancy to LRS or ZRS outside production and shorten PITR retention
  - designate a DR-only geo-secondary as standby; delete unused replicas
  - apply Azure Hybrid Benefit or reservations to steady provisioned compute
  - stop General Purpose managed instances outside working hours
verified: 2026-10-11
---

- Apps connect with `mssql`, `tedious`, `pyodbc`, `pymssql`, `mssql-python`, `go-mssqldb` or Prisma `sqlserver`. They also serve SQL Server in Docker, on a VM or on premises, so they are not signals. Azure SQL shows through infrastructure files, the management SDK, `AZURE_SQL_*` env names (Service Connector), a `*.database.windows.net` host in code or the `https://database.windows.net/` Entra token scope. If Azure is found but no database, ask where SQL Server runs.
- Host needles end in a quote, comma or colon because `https://ossrdbms-aad.database.windows.net/.default` is the Entra token scope of PostgreSQL and MySQL, not SQL Database.
- Azure SQL next to Supabase, Neon, PlanetScale or another managed database is Overlap unless split on purpose.
- Serverless bills storage while paused, and any open session (an IDE, a health check, a pool with a minimum size) keeps it from pausing. A free offer database on "continue with charges" cannot go back to auto-pause.
- Deleting a database keeps its backups until retention ends, still billed. Hyperscale backup redundancy is set at creation only.
- MCP: `--read-only` hides create, update, rename and delete tools; the `--tool` list also leaves out firewall rules and Entra admins. No tool returns usage or cost.
