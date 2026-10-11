---
# generated, edit catalog/vendors/azure-cosmos-db.md (then run: node tools/sync.mjs)
schema: 1
id: azure-cosmos-db
name: Azure Cosmos DB
family: azure
roles: [database]
detect:
  packages: ["@azure/cosmos", "@azure/arm-cosmosdb"]
  pypi: ["azure-cosmos", "azure-mgmt-cosmosdb"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos", "github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/cosmos/armcosmos"]
  imports: ["@azure/cosmos", "@azure/arm-cosmosdb"]
  env_prefixes: ["AZURE_COSMOS_", "COSMOS_ENDPOINT", "COSMOS_DB_"]
  config_files: []
  service_signals: ['"azurerm_cosmosdb_account"', '"azurerm_cosmosdb_sql_', '"azurerm_cosmosdb_mongo_', '"azurerm_mongo_cluster"', "Microsoft.DocumentDB/databaseAccounts", "Microsoft.DocumentDB/mongoClusters", "azure-native:cosmosdb:", "azure_native.cosmosdb.", "azure-native:documentdb:", "azure_native.documentdb.", "azure.cosmosdb.Account", "az cosmosdb ", "from azure.cosmos import", "from azure.cosmos.aio import", "azure.mgmt.cosmosdb", ".documents.azure.com", ".mongo.cosmos.azure.com", ".mongocluster.cosmos.azure.com", ".table.cosmos.azure.com", ".cassandra.cosmos.azure.com", ".gremlin.cosmos.azure.com"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/cosmos-db/autoscale-provisioned/
  serverless_pricing: https://azure.microsoft.com/en-us/pricing/details/cosmos-db/serverless/
  documentdb_pricing: https://azure.microsoft.com/en-us/pricing/details/documentdb/
  free_tier: https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier
  request_units: https://learn.microsoft.com/en-us/azure/cosmos-db/request-units
  autoscale: https://learn.microsoft.com/en-us/azure/cosmos-db/provision-throughput-autoscale
  serverless: https://learn.microsoft.com/en-us/azure/cosmos-db/serverless
  understand_bill: https://learn.microsoft.com/en-us/azure/cosmos-db/understand-your-bill
  multi_region: https://learn.microsoft.com/en-us/azure/cosmos-db/optimize-cost-regions
  throughput_cost: https://learn.microsoft.com/en-us/azure/cosmos-db/optimize-cost-throughput
  continuous_backup: https://learn.microsoft.com/en-us/azure/cosmos-db/continuous-backup-restore-introduction
  periodic_backup: https://learn.microsoft.com/en-us/azure/cosmos-db/periodic-backup-restore-introduction
  analytical_store: https://learn.microsoft.com/en-us/azure/cosmos-db/analytical-store-introduction
  dedicated_gateway: https://learn.microsoft.com/en-us/azure/cosmos-db/dedicated-gateway
  limits: https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits
read:
  - "provisioned throughput: standard (manual) RU/s billed per hour for every hour it exists, the minimum RU/s per container or shared database"
  - autoscale billed per hour for the highest RU/s reached that hour (at least a tenth of the max) at a higher rate than standard, except on multi-region write accounts
  - serverless billed per million RUs consumed plus storage, no minimum, single region only; serverless limits on the limits page
  - RU cost of operations (point read, write, query) by item size and indexing
  - storage per GB-month for transactional data and indexes
  - every region added bills the provisioned RU/s and storage again; multi-region writes bill RU/s at the multi-region write rate
  - "free tier: RU/s and storage discount on one account per subscription, chosen only when the account is created, not for serverless; stacking with the Azure free account"
  - periodic backup (two copies free, more billed by redundancy) and continuous backup (7-day tier free, 30 and 35-day tiers billed per GB per region; every restore billed)
  - analytical store storage and IO, dedicated gateway nodes per hour, reserved capacity
  - MongoDB RU accounts bill like the NoSQL API; Azure DocumentDB (vCore clusters) bills per cluster and is priced on its own page
usage_questions:
  - metric: instances
    ask: Each account's API, capacity mode (provisioned, autoscale or serverless), regions, multi-region writes, free tier and backup policy?
    where: Azure portal → Azure Cosmos DB account → Overview; Settings → Features, Replicate data globally, Backup & Restore
  - metric: throughput
    ask: Provisioned or autoscale max RU/s per database and container, and peak Normalized RU Consumption?
    where: Azure portal → Cosmos DB account → Data Explorer → container → Scale & Settings; Monitoring → Insights → Throughput
  - metric: db_size
    ask: Data and index storage per container and in total?
    where: Azure portal → Cosmos DB account → Monitoring → Insights → Storage
  - metric: monthly_bill
    ask: Last month's Cosmos DB cost by meter (RU/s, multi-region write RU/s, serverless RUs, data stored, backup, analytical store, dedicated gateway)?
    where: Azure portal → Cost Management + Billing → Cost Management → Cost analysis → filter Service name Azure Cosmos DB → Group by Meter
mcp:
  official: true
  readonly_flag: "local Azure MCP Server started with --read-only and only this tool: npx -y @azure/mcp@latest server start --read-only --tool cosmos_list"
  allowed_tools: [cosmos_list]
common_fixes:
  - use serverless for dev and spiky low-traffic apps, and autoscale for production that idles
  - switch autoscale containers that run near their max most hours to standard throughput
  - share database throughput across many small containers instead of one minimum per container
  - turn on free tier when creating the first account in a subscription
  - exclude unused paths from indexing and use point reads instead of queries
  - drop regions and multi-region writes that do not serve users; set TTL on transient data
verified: 2026-10-11
---

- Found reliably from `@azure/cosmos`, `azure-cosmos`, `azcosmos` and the management SDKs. `COSMOS_ENDPOINT` and `COSMOS_DB_*` are common names in Azure samples; a Cosmos blockchain project can use similar names, so confirm with the code.
- The MongoDB API (RU accounts and Azure DocumentDB clusters) uses the `mongodb` driver and is found as MongoDB Atlas. A `*.mongo.cosmos.azure.com` or `*.mongocluster.cosmos.azure.com` host or the Bicep and Terraform types mean Azure, not Atlas.
- `@azure/data-tables` and `azure-data-tables` serve Azure Table Storage and the Cosmos DB Table API alike, so they belong to storage; a `*.table.cosmos.azure.com` host means Cosmos DB.
- Next to MongoDB Atlas, Firestore, DynamoDB or a SQL database it is Overlap unless split on purpose.
- Provisioned RU/s bill every hour whether used or not, in every region. Autoscale never goes below a tenth of its max. Azure Synapse Link is closed to new projects.
- MCP: `--read-only` still exposes item query, get, recent, text and vector search and schema infer, which return or sample documents. Never call them; `cosmos_list` returns account, database and container names only, no RU/s or storage; call it without `--auth-method key`, and expect database and container names to need a Cosmos DB data-plane read role.
