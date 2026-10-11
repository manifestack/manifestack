---
# generated, edit catalog/vendors/gcp-memorystore.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-memorystore
name: Memorystore
family: gcp
roles: [database]
detect:
  packages: ["@google-cloud/redis", "@google-cloud/redis-cluster", "@google-cloud/memorystore", "@google-cloud/memcache", "@googleapis/redis", "@googleapis/memcache"]
  pypi: ["google-cloud-redis", "google-cloud-redis-cluster", "google-cloud-memorystore", "google-cloud-memcache"]
  go: ["cloud.google.com/go/redis", "cloud.google.com/go/memorystore", "cloud.google.com/go/memcache"]
  imports: ["@google-cloud/redis", "@google-cloud/redis-cluster", "@google-cloud/memorystore", "@google-cloud/memcache", "@googleapis/redis", "@googleapis/memcache"]
  env_prefixes: []
  config_files: []
  service_signals: ['"google_redis_', '"google_memorystore_', '"google_memcache_', "gcp.redis.", "gcp:redis:", "gcp.memorystore.", "gcp:memorystore:", "gcp.memcache.", "gcp:memcache:", "redis.cnrm.cloud.google.com", "gcloud redis ", "gcloud memorystore ", "gcloud memcache ", "from google.cloud import redis", "from google.cloud import memorystore", "from google.cloud import memcache"]
pages:
  pricing: https://cloud.google.com/memorystore/docs/redis/pricing
  valkey_pricing: https://cloud.google.com/memorystore/valkey/pricing
  cluster_pricing: https://cloud.google.com/memorystore/cluster/pricing
  memcached_pricing: https://cloud.google.com/memorystore/docs/memcached/pricing
  redis_tiers: https://docs.cloud.google.com/memorystore/docs/redis/redis-tiers
  redis_versions: https://docs.cloud.google.com/memorystore/docs/redis/supported-versions
  redis_quotas: https://docs.cloud.google.com/memorystore/docs/redis/quotas
  valkey_quotas: https://docs.cloud.google.com/memorystore/docs/valkey/quotas
  cluster_quotas: https://docs.cloud.google.com/memorystore/docs/cluster/quotas
  valkey_overview: https://docs.cloud.google.com/memorystore/docs/valkey/product-overview
read:
  - Memorystore for Redis per GiB-hour of provisioned capacity by service tier (Basic, Standard with cross-zone replication) and capacity tier, read replicas, billed from creation whether used or not
  - Memorystore for Valkey and Redis Cluster per node-hour by node type, shards times (1 + replicas), cluster mode enabled or disabled
  - AOF persistence and backup storage charges with the minimum backup charge
  - Private Service Connect per-GiB processing for clients in another zone, and cross-region replication transfer
  - Memcached per vCPU and GiB of memory per node
  - committed use discounts for one and three years
  - that a Basic Tier instance cannot be upgraded to Standard in place
  - quotas Data provisioned per region (Redis), Connected clients per instance, Max clients by node type and Usage units per instance (Valkey)
usage_questions:
  - metric: instances
    ask: Each instance's product (Redis, Redis Cluster, Valkey, Memcached), tier or node type, capacity, shards and replicas, region and version?
    where: Cloud console → Memorystore → instance → Overview
  - metric: db_size
    ask: Memory used against provisioned capacity at peak?
    where: Cloud console → Memorystore → instance → Monitoring (memory usage; redis.googleapis.com/stats/memory/usage_ratio for Redis)
  - metric: monthly_bill
    ask: Last month's Memorystore cost by SKU (capacity or nodes, backups, AOF, network)?
    where: Cloud console → Billing → Reports → Services filtered to Memorystore → Group by SKU
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - right-size provisioned capacity or node count from the memory usage ratio
  - use Basic Tier or no replicas outside production
  - set TTLs and an eviction policy so the cache does not grow to its capacity
  - delete unused instances; they bill every hour from creation
  - keep clients in the instance's zone and region to avoid Private Service Connect and cross-region charges
verified: 2026-10-11
---

- Apps connect with `ioredis`, `redis`, `iovalkey`, `redis-py`, `go-redis` or a Memcached client and a `REDIS_URL` or `REDIS_HOST` whose value is never read, so Memorystore shows only through Terraform, Pulumi, `gcloud` commands or the admin SDKs. A Redis client alone says nothing about where Redis runs: if Google Cloud is found but no cache, ask.
- Memorystore next to Upstash, Redis Cloud or ElastiCache is Overlap unless split on purpose. Next to Cloud SQL, Firestore or Supabase it is usually a cache in front of the database: the detector lists it as a database Overlap, but say so only if it holds primary data.
- All products bill provisioned capacity per second from creation, idle or not; nothing scales to zero.
- MCP: the remote Redis and Valkey servers have write tools and no read-only endpoint, and `get_instance_auth_string` is marked read-only but returns the Redis AUTH string. Do not use them.
