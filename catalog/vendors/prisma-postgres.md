---
schema: 1
id: prisma-postgres
name: Prisma Postgres
roles: [database]
detect:
  packages: ["@prisma/ppg", "@prisma/adapter-ppg", "@prisma/extension-accelerate", "@prisma/sqlcommenter-query-insights", "@prisma/management-api-sdk"]
  imports: ["@prisma/ppg", "@prisma/adapter-ppg", "@prisma/extension-accelerate", "@prisma/sqlcommenter-query-insights", "@prisma/management-api-sdk"]
  env_prefixes: ["PRISMA_POSTGRES_", "PRISMA_SERVICE_TOKEN", "PRISMA_WORKSPACE_"]
  config_files: []
pages:
  pricing: https://www.prisma.io/pricing
  faq: https://www.prisma.io/docs/postgres/faq
  billing: https://www.prisma.io/docs/postgres#billing-and-limits
  connecting: https://www.prisma.io/docs/postgres/database/connecting-to-your-database
  connection_pooling: https://www.prisma.io/docs/postgres/database/connection-pooling
  backups: https://www.prisma.io/docs/postgres/database/backups
  regions: https://www.prisma.io/docs/postgres/faq#what-regions-is-prisma-postgres-available-in
  usage_cli: https://www.prisma.io/docs/cli/postgres
  metrics: https://www.prisma.io/docs/console/features/metrics
  accelerate: https://www.prisma.io/docs/accelerate
  switch_from_accelerate: https://www.prisma.io/docs/postgres/database/switch-from-accelerate
  changelog: https://www.prisma.io/changelog/2026-10-02
  mcp_tools: https://www.prisma.io/docs/ai/mcp-tools
  security: https://www.prisma.io/legal/security-and-compliance
  terms: https://www.prisma.io/legal/terms
read:
  - plans (Free, Starter, Pro, Business) and the operations, storage, databases and pooled and direct connections each includes; quotas apply to the whole workspace, not per database
  - what counts as an operation, i.e. one Prisma Client query (even when it runs several SQL statements), one SQL statement over a direct connection or another ORM, cached reads included; egress is not billed
  - what happens at the Free limit, i.e. the databases stop accepting reads and writes until next month or an upgrade, with a one-time 24-hour grace period per workspace
  - overage per million operations and per GB of storage on paid plans, and the hard spend limit on paid plans (on by default)
  - backups by plan (none on Free), no point-in-time recovery, restore to a new database
  - regions, set when a database is created
  - Accelerate (cache and pooling) billed on its own meters and retired on 2026-12-01; Early Access databases deleted on 2026-11-01
  - billing through Vercel when the database was created from the Vercel Marketplace
  - GDPR on every plan, HIPAA from Pro, SOC 2 Type II and ISO 27001 on Business; the DPA is downloaded in the Console
usage_questions:
  - metric: operations_month
    ask: Operations this month against the plan, and the estimated invoice?
    where: Console → workspace overview (usage against the plan, estimated upcoming invoice); Usage page for cumulative and daily operations; or `npx prisma postgres usage <database>`
  - metric: db_size
    ask: Storage used and the number of databases in the workspace?
    where: Console → workspace → Usage (Total storage used, Total DBs)
  - metric: monthly_bill
    ask: Current plan, spend limit and the last invoice total?
    where: Console → workspace billing (plan, spend limit, invoices); Vercel → Billing if created from the Vercel Marketplace
  - metric: region
    ask: Which region does each database use?
    where: Console → project → database
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - batch writes with createMany, updateMany and deleteMany instead of one query per row, and remove N+1 query loops
  - use an array $transaction for independent queries (one operation) instead of an interactive transaction (one per query)
  - drop keep-alive and health-check queries that run on a timer; each one is an operation
  - send app traffic through the pooled host and reuse one client per serverless instance, keeping the direct host for migrations
  - move off Accelerate (prisma+postgres:// URLs, withAccelerate, cacheStrategy) before 2026-12-01
  - keep your own pg_dump copies on Free, which has no backups
verified: 2026-10-11
---

- The Prisma ORM (`prisma`, `@prisma/client`, `schema.prisma`, `@prisma/adapter-pg`) is not this vendor: it runs against any Postgres. Prisma Postgres is detected only from its own driver and adapter (`@prisma/ppg`, `@prisma/adapter-ppg`), Accelerate, Query Insights, the management SDK and `PRISMA_POSTGRES_*` / `PRISMA_SERVICE_TOKEN` / `PRISMA_WORKSPACE_*` names. Do not treat other `PRISMA_*` names (ORM settings) or `DATABASE_URL` as evidence.
- Hosts that prove it, when they appear in code or CI files: `db.prisma.io` and `pooled.db.prisma.io`, or `prisma+postgres://accelerate.prisma-data.net`. `prisma://accelerate.prisma-data.net` is Accelerate in front of another vendor's database, and `prisma+postgres://localhost` is the local `prisma dev` server: neither is a Prisma Postgres database.
- `@prisma/extension-accelerate` alone may mean Accelerate in front of Supabase, Neon or PlanetScale: ask where the database runs, and report the Accelerate retirement date as a Risk either way.
- Prisma also sells Compute (hosting) and Object Storage on the same workspace plans; this map covers the database. Docs pages serve markdown at `<url>.md`.
- The Prisma MCP server (`https://mcp.prisma.io/mcp`) has no read-only mode: its only scope is workspace admin, and it includes `execute_sql_query`, database deletion and `list_prisma_postgres_connection_strings`, which returns connection strings. Do not use it; ask the user for numbers instead.
- Prisma Postgres next to another Postgres (Supabase, Neon) is Overlap unless split on purpose.
