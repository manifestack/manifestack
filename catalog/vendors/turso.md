---
schema: 1
id: turso
name: Turso
roles: [database]
detect:
  packages: ["@libsql/", "libsql", "@tursodatabase/", "@prisma/adapter-libsql", "turso"]
  pypi: ["libsql", "libsql-experimental", "libsql-client", "pyturso", "turso-serverless", "sqlalchemy-libsql"]
  go: ["github.com/tursodatabase", "turso.tech/database"]
  imports: ["@libsql/", "libsql", "@tursodatabase/", "@prisma/adapter-libsql", "drizzle-orm/libsql", "drizzle-orm/tursodatabase"]
  env_prefixes: ["TURSO_"]
  config_files: []
  role_signals:
    database: ["turso.io", "TURSO_", "@tursodatabase/serverless", "@tursodatabase/sync", "turso_serverless"]
pages:
  pricing: https://turso.tech/pricing
  pricing_text: https://turso.tech/pricing.md
  usage_and_billing: https://docs.turso.tech/help/usage-and-billing
  plan_show: https://docs.turso.tech/cli/plan/show
  overages: https://docs.turso.tech/cli/plan/overages/enable
  point_in_time_recovery: https://docs.turso.tech/features/point-in-time-recovery
  branching: https://docs.turso.tech/features/branching
  recover_deleted: https://docs.turso.tech/features/recover-deleted-databases
  embedded_replicas: https://docs.turso.tech/features/embedded-replicas/introduction
  unarchive: https://docs.turso.tech/cli/group/unarchive
  locations: https://docs.turso.tech/api-reference/locations/list
  mcp: https://docs.turso.tech/integrations/mcp
  acquisition: https://turso.tech/blog/turso-is-joining-supabase
  security: https://trust.turso.tech/
read:
  - plans (Free, Developer, Scaler, Pro, Enterprise) and the storage, rows read, rows written, syncs and databases each includes; groups and locations per plan
  - what happens at a limit, i.e. on Free, or with Overages off (the default), passing any single quota blocks every database; with Overages on, extra usage is billed per unit at month end
  - rows read counts rows scanned, not rows returned (unindexed lookups, aggregates, joins, schema changes); every index adds writes
  - embedded replica and sync traffic counted as syncs
  - branches and point-in-time restores each create a database that uses the database quota and storage; restore window and deleted-database recovery by plan
  - Free databases archived after inactivity, and how to unarchive them
  - Vegas Blackout (one day's charges removed per month) and that there is no spend alert or cap other than leaving Overages off
  - AWS locations; a group's primary location is chosen at creation and has no documented move
  - DPA, SOC 2, HIPAA, SSO and encryption keys by plan
usage_questions:
  - metric: db_size
    ask: Storage used, and the size of the largest database?
    where: "`turso plan show` (storage, rows read, rows written, syncs and databases against the plan, with overages on or off); `turso db show <db>` for one database"
  - metric: rows_read
    ask: Rows read and rows written this month?
    where: "`turso plan show`, or the organization usage in the dashboard"
  - metric: monthly_bill
    ask: Current plan and the last invoice total?
    where: "`turso org billing` opens the billing portal with invoices"
  - metric: region
    ask: Which location does each group use?
    where: "`turso db show <db>` (Locations) or `turso group list`"
mcp:
  official: true
  readonly_flag: "read-only permission for a single group on the OAuth consent screen of https://mcp.turso.ai/mcp (the organization-wide option grants full access)"
  allowed_tools: [list_databases, get_database, list_branches]
common_fixes:
  - add indexes and check slow queries with EXPLAIN QUERY PLAN; keep counters in a table instead of count(*) over large tables
  - delete old branches, restored copies and unused databases (VACUUM is not available, so storage only shrinks by deleting)
  - decide before the limit date whether to turn Overages on or move up a plan, since a passed quota blocks every database
  - lengthen the embedded replica sync interval or use partial sync to cut sync traffic
  - turn on delete protection for production databases
  - create the group in the location the requirements ask for while data is small
verified: 2026-10-11
---

- libSQL also runs as a local SQLite file or a self-hosted server: `@libsql/client` alone (often pulled in by Astro DB, Payload or Mastra for local SQLite) is not proof of Turso Cloud. The `database` role counts only when the code shows `turso.io`, a `TURSO_*` name or a cloud-only driver; otherwise ask where the database runs. `libsql://` URLs without `turso.io` can be self-hosted.
- Supabase announced on 2026-10-02 that it is acquiring Turso; plans, prices and the MCP server may change. Read the pricing page and the announcement at run time, and note the acquisition as a Risk for a long-term decision.
- `docs.turso.tech/help/usage-and-billing` still uses old plan names (Starter, Scaler); the pricing page is current. `trust.turso.tech` renders only in a browser.
- Turso MCP (`https://mcp.turso.ai/mcp`, OAuth) is read-only only when a single group and the read-only permission are chosen at consent; check that no write tools (`create_database`, `write_database`, `evolve_schema`, `delete_database`) are listed. It has no usage or plan tool, so usage comes from the CLI. `read_database` and `database_analytics` can expose rows and query text: do not use them.
- Turso next to another database (Supabase, Neon, Cloudflare D1) is Overlap unless split on purpose, for example a database per tenant on Turso.
