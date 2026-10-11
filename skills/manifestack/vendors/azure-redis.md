---
# generated, edit catalog/vendors/azure-redis.md (then run: node tools/sync.mjs)
schema: 1
id: azure-redis
name: Azure Managed Redis and Azure Cache for Redis
family: azure
roles: [database]
detect:
  packages: ["@azure/arm-rediscache", "@azure/arm-redisenterprisecache", "@redis/entraid"]
  pypi: ["azure-mgmt-redis", "azure-mgmt-redisenterprise", "redis-entraid"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/redis/armredis", "github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/redisenterprise/armredisenterprise", "github.com/redis/go-redis-entraid"]
  imports: ["@azure/arm-rediscache", "@azure/arm-redisenterprisecache", "@redis/entraid"]
  env_prefixes: ["AZURE_REDIS_"]
  config_files: []
  service_signals: ['"azurerm_redis_', '"azurerm_managed_redis', "Microsoft.Cache/redis", "azure-native:redis:", "azure_native.redis.", "azure-native:redisenterprise:", "azure_native.redisenterprise.", "azure-native:cache:", "azure_native.cache.", "azure.redis.Cache", "azure.managedredis.", "az redis ", "az redisenterprise ", "azure.mgmt.redis", ".redis.cache.windows.net", ".redis.azure.net"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/managed-redis/
  cache_pricing: https://azure.microsoft.com/en-us/pricing/details/cache/
  overview: https://learn.microsoft.com/en-us/azure/redis/overview
  architecture: https://learn.microsoft.com/en-us/azure/redis/architecture
  scale: https://learn.microsoft.com/en-us/azure/redis/how-to-scale
  persistence: https://learn.microsoft.com/en-us/azure/redis/how-to-persistence
  geo_replication: https://learn.microsoft.com/en-us/azure/redis/how-to-active-geo-replication
  migrate: https://learn.microsoft.com/en-us/azure/redis/migrate/migrate-basic-standard-premium-overview
  retirement_faq: https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/retirement-faq
  whats_new: https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-whats-new
  cache_overview: https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview
  cache_persistence: https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-how-to-premium-persistence
  cache_geo_replication: https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-how-to-geo-replication
read:
  - Azure Managed Redis per hour by tier (Memory Optimized, Balanced, Compute Optimized, Flash Optimized) and size, high availability on or off (off only at creation, dev and test only), billed from creation whether used or not
  - Managed Redis persistence disk included in the price; active geo-replication billed per linked instance, and whether inter-region transfer is charged yet
  - Azure Cache for Redis per hour by tier and size (Basic single node with no SLA, Standard with a replica, Premium with shards, extra replicas and zones), Enterprise and Enterprise Flash
  - Premium persistence writes to the user's own storage account (billed as Azure Storage); Premium geo-replication pays inter-region transfer
  - "retirement: Enterprise tiers end on 31 March 2027, Basic, Standard and Premium on 30 September 2028; Enterprise creation is blocked for everyone, Basic, Standard and Premium for tenants with no cache before April 2026; the migration tooling and the Managed Redis size that matches each cache"
  - reservations for one or three years and how they carry over after migration
usage_questions:
  - metric: instances
    ask: Each cache's product (Managed Redis or Cache for Redis), tier and size, HA, shards and replicas, persistence, geo-replication, region and Redis version?
    where: Azure portal → Azure Managed Redis or Azure Cache for Redis → instance → Overview; Settings → Scale, Advanced settings, Data persistence, Active geo-replication
  - metric: db_size
    ask: Used memory against the size at peak, and connected clients?
    where: Azure portal → instance → Monitoring → Metrics (Used Memory Percentage, Used Memory, Connected Clients)
  - metric: monthly_bill
    ask: Last month's Redis cost by meter and instance?
    where: Azure portal → Cost Management + Billing → Cost Management → Cost analysis → filter Service name Redis Cache (covers both products) → Group by Resource, then Meter
mcp:
  official: true
  readonly_flag: "local Azure MCP Server started with --read-only and only this tool: npx -y @azure/mcp@latest server start --read-only --tool redis_list"
  allowed_tools: [redis_list]
common_fixes:
  - plan the move of Cache for Redis to Managed Redis before the retirement date; Enterprise first
  - right-size from Used Memory Percentage, and pick Memory Optimized for dev and test
  - create dev caches without HA (Managed Redis) or on Basic (Cache for Redis)
  - set TTLs and an eviction policy so the cache does not grow to its size
  - delete unused caches and linked geo-replicas; they bill every hour from creation
  - turn off soft delete on the Premium persistence storage account
verified: 2026-10-11
---

- Apps connect with `ioredis`, `redis`, `redis-py`, `go-redis` or StackExchange.Redis and a host whose value is never read, so Azure Redis shows through infrastructure files, the management SDKs, `AZURE_REDIS_*` env names (Service Connector), a `*.redis.cache.windows.net` (Cache for Redis) or `*.redis.azure.net` (Managed Redis) host in code, or the Entra ID helpers `@redis/entraid`, `redis-entraid` and `go-redis-entraid` (Microsoft Entra ID sign-in for Azure Redis). If Azure is found but no cache, ask where Redis runs.
- Azure Redis next to Upstash, Redis Cloud, ElastiCache or Memorystore is Overlap unless split on purpose. Next to a database it is usually a cache; say Overlap only if it holds primary data.
- A Cache for Redis instance still running is a Fit finding with its retirement date. Creation of Basic, Standard and Premium is blocked for tenants with no cache before April 2026; others can still create them until retirement.
- Nothing scales to zero or pauses; a cache bills every hour until deleted.
- MCP: `--read-only` leaves `redis_list` (name, SKU, version, shards, replicas, persistence, host name; no access keys). The `redis create` tool is hidden in that mode.
