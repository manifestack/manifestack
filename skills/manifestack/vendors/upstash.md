---
# generated, edit catalog/vendors/upstash.md (then run: node tools/sync.mjs)
schema: 1
id: upstash
name: Upstash
roles: [database]
detect:
  packages: ["@upstash/", "@vercel/kv"]
  pypi: ["upstash-*", "qstash"]
  go: ["github.com/upstash"]
  imports: ["@upstash/", "@vercel/kv"]
  env_prefixes: ["UPSTASH_", "QSTASH_", "KV_REST_API_"]
  config_files: []
pages:
  pricing: https://upstash.com/pricing/redis
  vector_pricing: https://upstash.com/pricing/vector
  qstash_pricing: https://upstash.com/pricing/qstash
  workflow_pricing: https://upstash.com/pricing/workflow
  limits: https://upstash.com/docs/redis/troubleshooting/max_daily_request_limit
  faq: https://upstash.com/docs/redis/help/faq
  eviction: https://upstash.com/docs/redis/features/eviction
  regions: https://upstash.com/docs/redis/features/globaldatabase
  usage: https://upstash.com/docs/redis/howto/metrics-and-charts
  security: https://upstash.com/docs/common/help/compliance
  dpa: https://upstash.com/static/trust/dpa.pdf
read:
  - Redis Free plan quota kinds (data size, monthly commands, monthly bandwidth, database count) and the request limit the "max daily request limit exceeded" error refers to
  - what happens at a Free limit (commands rejected with an error, throttling, writes rejected at max data size unless eviction is on) and archiving of inactive Free databases
  - Pay as you go price per command and per GB of storage and bandwidth, Fixed plan sizes and included bandwidth, and the Prod Pack add-on
  - the per-database monthly budget on Pay as you go, the alert thresholds, and that a database over budget is rate limited instead of billed further
  - Vector, QStash and Workflow plans and their quota kinds (daily queries or updates, daily messages or steps, message size, schedules, retention); each product is priced on its own page
  - regions per cloud, that writes to a Global database are replicated and billed again in every read region, and that the primary region cannot be changed after creation
  - certifications (SOC 2 for Redis on Pro and Enterprise support plans, HIPAA for Redis, ISO 27001 status) and the DPA and subprocessor list
usage_questions:
  - metric: monthly_commands
    ask: Commands per day over the last days, and this month's cost so far, for the production database?
    where: console.upstash.com → Redis → select the database (Daily Request and Current Month charts on the details page)
  - metric: db_size
    ask: Data size of the production Redis database, and is eviction on?
    where: console.upstash.com → Redis → select the database → Usage → Data Size; eviction under the database Configuration section
  - metric: billing_plan
    ask: Which plan is each database on (Free, Pay as you go, Fixed), and is a monthly budget set?
    where: console.upstash.com → Redis → select the database (plan and budget shown on the details page)
  - metric: region
    ask: Which primary region and read regions does the production database use?
    where: console.upstash.com → Redis → select the database (region shown on the details page)
mcp:
  official: true
  readonly_flag: "start @upstash/mcp-server with a read-only Management API key (console.upstash.com → Account → API Keys); the server detects it and registers only read-only tools"
  allowed_tools: [redis_database_list_databases, redis_database_get_statistics, redis_database_list_backups]
common_fixes:
  - turn on eviction for databases used as a cache so they stay under the data size limit
  - set TTLs on cache, session and rate-limit keys
  - batch commands with pipelines or MGET and MSET to cut the command count
  - stop polling loops and background workers (queue libraries, health checks) that send commands while idle
  - set a monthly budget on Pay as you go databases, or compare a Fixed plan when traffic is steady
  - keep read regions only where readers are, since every write is billed again per read region
  - create the database in the primary region the requirements ask for while data is small
verified: 2026-10-08
---

- Upstash bills each database and product separately. Redis, Vector, QStash and Workflow each have their own plan and quotas, so read the pricing page for every product the code uses. Workflow runs on QStash and is billed per step.
- Only the Free plan has request-count limits. Pay as you go has none, but the budget, when set, rate-limits the database instead of stopping the bill from growing. Queue libraries and job runners that poll Redis (BullMQ, Sidekiq, Celery) can use up a Free plan's commands with no user traffic.
- `@vercel/kv` and `KV_REST_API_*` env vars come from Vercel KV, which is now Upstash Redis billed through Vercel Marketplace; usage is in the Upstash console reached from Vercel. Upstash Redis over the Redis protocol (`ioredis`, `redis`, `go-redis`, `redis-py` with a `REDIS_URL`) leaves no Upstash signal; ask where Redis runs.
- MCP: `redis_database_get_details` is read-only but returns the database password and REST tokens, so do not call it. Do not call `redis_database_run_redis_commands` (reads stored values), `qstash_logs_get`, `qstash_dlq_get`, `workflow_logs_get` (message bodies), `qstash_get_user_token`, or `redis_database_start_free` (creates a database and returns credentials). Without a read-only key, do not use the MCP server.
- Upstash Redis next to another key-value store (Cloudflare KV, Vercel Edge Config, a self-hosted Redis) can be an Overlap; ask what each one holds.
