---
schema: 1
id: aws-elasticache
name: Amazon ElastiCache
family: aws
roles: [database]
detect:
  packages: ["@aws-sdk/client-elasticache", "@aws-sdk/client-memorydb"]
  pypi: ["mypy-boto3-elasticache", "mypy-boto3-memorydb"]
  go: ["github.com/aws/aws-sdk-go-v2/service/elasticache", "github.com/aws/aws-sdk-go-v2/service/memorydb"]
  imports: ["@aws-sdk/client-elasticache", "@aws-sdk/client-memorydb"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('elasticache'", "client(\"elasticache\"", "client('memorydb'", "client(\"memorydb\"", "new AWS.ElastiCache(", "aws-sdk/clients/elasticache", "aws-sdk-go/service/elasticache", '"aws_elasticache_', '"aws_memorydb_', "AWS::ElastiCache::", "AWS::MemoryDB::", "aws-cdk-lib/aws-elasticache", "aws_cdk.aws_elasticache", "aws.elasticache.", "sst.aws.Redis(", "arn:aws:elasticache:", "cache.amazonaws.com", ".memorydb."]
pages:
  pricing: https://aws.amazon.com/elasticache/pricing/
  serverless_scaling: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Scaling-serverless.html
  extended_support: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/extended-support.html
  quotas: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/quota-limits.html
  memorydb_pricing: https://aws.amazon.com/memorydb/pricing/
read:
  - node-based caches per node-hour by node type and engine (Valkey, Redis OSS, Memcached), reserved nodes or Database Savings Plans, data tiering nodes
  - Serverless per GB-hour of data stored with the minimum metered storage per cache by engine, plus per ECPU
  - the Valkey discount against Redis OSS and Memcached
  - backup storage, and data transfer across Availability Zones and Regions
  - Extended Support premium for Redis OSS versions past end of standard support, and the dates
  - MemoryDB node-hours plus per-GB data written, if used
  - quotas Nodes per Region, Nodes per cluster, Serverless caches per Region
usage_questions:
  - metric: instances
    ask: Each cache's engine and version, serverless or node type, node and replica count?
    where: ElastiCache console → Valkey caches, Redis OSS caches or Memcached caches → cache → details and Shards and nodes
  - metric: db_size
    ask: Memory used, and for Serverless the data stored and ECPUs over the month?
    where: ElastiCache console → cache → Metrics (BytesUsedForCache, DatabaseMemoryUsagePercentage; Serverless BytesUsedForCache, ElastiCacheProcessingUnits)
  - metric: monthly_bill
    ask: Last month's ElastiCache cost by usage type (NodeUsage, CachedData, ElastiCacheProcessingUnits, BackupUsage, ExtendedSupport)?
    where: Billing and Cost Management → Cost Explorer → Service ElastiCache → Group by Usage type
mcp:
  official: true
  readonly_flag: "--readonly (uvx awslabs.elasticache-mcp-server@latest --readonly): write tools are refused unless marked read-only safe; use a read-only AWS profile"
  allowed_tools: [describe-serverless-caches, describe-replication-groups, describe-cache-clusters, describe-cache-engine-versions, describe-service-updates, get-metric-statistics]
common_fixes:
  - move Redis OSS caches to Valkey
  - upgrade engines before end of standard support
  - right-size node types from memory and CPU metrics; drop unused replicas outside production
  - set TTLs and an eviction policy so the cache does not grow without bound
  - consider Serverless for small or spiky caches, node-based reserved nodes for steady large ones
  - keep clients in the cache's Availability Zone or Region
verified: 2026-10-11
---

- Apps connect with `ioredis`, `redis`, `iovalkey`, `redis-py` or `go-redis` and a `REDIS_URL` whose value is never read, so ElastiCache shows only through infrastructure files, the SDK or a `cache.amazonaws.com` host. If AWS is found but no cache, ask where Redis runs.
- ElastiCache next to Upstash or another Redis is Overlap unless split on purpose. Next to RDS, Supabase or Neon it is usually a cache in front of the database: the detector lists it as a database Overlap, but say so only if it holds primary data.
- Node-based caches bill every hour whether used or not; Serverless never scales below its minimum metered storage.
- Redis OSS caches on old major versions move to paid Extended Support automatically.
- MCP: `get-cost-and-usage` calls the Cost Explorer API, billed per request; leave log, jump host, SSH tunnel and migration tools alone.
