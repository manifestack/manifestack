---
# generated, edit catalog/vendors/azure-postgresql-mysql.md (then run: node tools/sync.mjs)
schema: 1
id: azure-postgresql-mysql
name: Azure Database for PostgreSQL and MySQL (flexible server)
family: azure
roles: [database]
detect:
  packages: ["@azure/arm-postgresql-flexible", "@azure/arm-mysql-flexible"]
  pypi: ["azure-mgmt-postgresqlflexibleservers", "azure-mgmt-mysqlflexibleservers", "azure-mgmt-rdbms"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/postgresql/armpostgresqlflexibleservers", "github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/mysql/armmysqlflexibleservers"]
  imports: ["@azure/arm-postgresql-flexible", "@azure/arm-mysql-flexible"]
  env_prefixes: ["AZURE_POSTGRESQL_", "AZURE_MYSQL_"]
  config_files: []
  service_signals: ['"azurerm_postgresql_flexible_server', '"azurerm_mysql_flexible_server', '"azurerm_postgresql_server"', '"azurerm_mysql_server"', '"azurerm_cosmosdb_postgresql_cluster"', "Microsoft.DBforPostgreSQL/", "Microsoft.DBforMySQL/", "azure-native:dbforpostgresql:", "azure_native.dbforpostgresql.", "azure-native:dbformysql:", "azure_native.dbformysql.", "azure.postgresql.FlexibleServer", "azure.mysql.FlexibleServer", "az postgres flexible-server", "az mysql flexible-server", "azure.mgmt.postgresqlflexibleservers", "azure.mgmt.mysqlflexibleservers", "azure.mgmt.rdbms", ".postgres.database.azure.com", ".mysql.database.azure.com", "ossrdbms-aad.database.windows.net"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/
  mysql_pricing: https://azure.microsoft.com/en-us/pricing/details/mysql/
  free_account: https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account
  compute: https://learn.microsoft.com/en-us/azure/postgresql/compute-storage/concepts-compute
  storage: https://learn.microsoft.com/en-us/azure/postgresql/compute-storage/concepts-storage
  limits: https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-limits
  high_availability: https://learn.microsoft.com/en-us/azure/postgresql/high-availability/concepts-high-availability
  backups: https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore
  stop_server: https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/how-to-stop-server
  versions: https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-version-policy
  extended_support: https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/extended-support
  mysql_tiers: https://learn.microsoft.com/en-us/azure/mysql/flexible-server/concepts-service-tiers-storage
  mysql_backups: https://learn.microsoft.com/en-us/azure/mysql/flexible-server/concepts-backup-restore
  mysql_stop_start: https://learn.microsoft.com/en-us/azure/mysql/flexible-server/how-to-stop-start-server-portal
  mysql_versions: https://learn.microsoft.com/en-us/azure/mysql/concepts-version-policy
read:
  - compute per vCore-hour by tier (Burstable, General Purpose, Memory Optimized; MySQL meters name the last one Business Critical) and VM series; Burstable CPU credits
  - storage per GB-month provisioned (not used); Premium SSD v2 IOPS and throughput above the baseline billed separately; MySQL pre-provisioned or autoscale IOPS
  - storage autogrow, on by default, and that storage only grows (shrinking needs a dump and restore to a new server)
  - high availability bills a standby with the same compute and storage; each read replica bills as its own server
  - backup storage free up to provisioned storage, retention between the minimum and maximum days, geo-redundant backup counted twice and chosen at creation only
  - stopped servers stop compute billing; how long until the service starts them again (PostgreSQL and MySQL differ)
  - Extended Support per vCore-hour for major versions past standard support, applied automatically, and the dates for the versions in use
  - Azure free account allowance (Burstable B1MS hours, storage and backup storage per month, for the first months only)
  - reservations for compute
usage_questions:
  - metric: instances
    ask: Each server's engine and major version, compute tier and size, HA mode, read replicas, and stopped or running?
    where: Azure portal → Azure Database for PostgreSQL flexible servers (or MySQL flexible servers) → server → Overview; Settings → Compute + storage, High availability, Replication
  - metric: db_size
    ask: Provisioned and used storage, autogrow on or off, IOPS settings, backup retention and geo-redundant backup?
    where: Azure portal → server → Settings → Compute + storage; Monitoring → Metrics (Storage used, Storage percent); Settings → Backup and restore
  - metric: monthly_bill
    ask: Last month's cost by meter (compute, storage, IOPS, backup storage, extended support) for both engines?
    where: Azure portal → Cost Management + Billing → Cost Management → Cost analysis → filter Service name Azure Database for PostgreSQL or Azure Database for MySQL → Group by Meter
mcp:
  official: true
  readonly_flag: "local Azure MCP Server started with --read-only and only these tools: npx -y @azure/mcp@latest server start --read-only --tool postgres_list --tool postgres_server_config_get --tool mysql_list --tool mysql_server_config_get"
  allowed_tools: [postgres_list, postgres_server_config_get, mysql_list, mysql_server_config_get]
common_fixes:
  - upgrade major versions before Extended Support billing starts
  - use Burstable and no HA for dev and staging
  - stop dev servers outside working hours, with a scheduled stop since the service restarts them
  - right-size storage at creation; it cannot shrink
  - drop unused read replicas and lower backup retention outside production
  - buy reservations only for steady production compute
verified: 2026-10-11
---

- Apps connect with `pg`, `postgres`, `mysql2`, `psycopg`, `pgx` or an ORM and a `DATABASE_URL` whose value is never read, so these servers show through infrastructure files, the management SDKs, `AZURE_POSTGRESQL_*` or `AZURE_MYSQL_*` env names (Service Connector), a `*.postgres.database.azure.com` or `*.mysql.database.azure.com` host in code, or the Entra token scope `ossrdbms-aad.database.windows.net`. If Azure is found but no database, ask where Postgres or MySQL runs.
- Next to Supabase, Neon, PlanetScale, Cloud SQL, RDS or another managed database it is Overlap unless split on purpose.
- Single Server for both engines is retired. `"azurerm_postgresql_server"`, `"azurerm_mysql_server"` or a `Microsoft.DBforPostgreSQL/servers` resource is a Fit finding to migrate to flexible server.
- PostgreSQL 11 to 13 and MySQL 5.7 are already in paid Extended Support; read the version tables for MySQL 8.0 and PostgreSQL 14. A stopped server pays storage and backups but no Extended Support.
- A free account B1MS server bills at pay-as-you-go rates once the free months end; HA, replicas and extra servers bill from day one.
- `Microsoft.DBforPostgreSQL/serverGroupsv2` or `"azurerm_cosmosdb_postgresql_cluster"` is Azure Cosmos DB for PostgreSQL, on a retirement path and priced per node: a Fit finding.
- MCP: in `--read-only` mode the Azure MCP Server hides `database query` and `server param set`; list tools return server, database and table names, and `server config get` returns SKU, storage, retention and geo-backup. Never `table schema get` or query tools.
