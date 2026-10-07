---
# generated, edit catalog/vendors/planetscale.md (then run: node tools/sync.mjs)
schema: 1
id: planetscale
name: PlanetScale
roles: [database]
detect:
  packages: ["@planetscale/database", "@prisma/adapter-planetscale", "kysely-planetscale"]
  go: ["github.com/planetscale/planetscale-go"]
  imports: ["@planetscale/database", "@prisma/adapter-planetscale", "kysely-planetscale"]
  env_prefixes: ["PLANETSCALE_"]
  config_files: [".pscale.yml"]
pages:
  pricing: https://planetscale.com/pricing
  plans: https://planetscale.com/docs/planetscale-plans
  vitess_pricing: https://planetscale.com/docs/vitess/pricing
  postgres_pricing: https://planetscale.com/docs/postgres/pricing
  billing: https://planetscale.com/docs/billing
  storage: https://planetscale.com/docs/postgres/cluster-configuration/cluster-storage
  regions: https://planetscale.com/docs/plans/regions
  security: https://planetscale.com/docs/security
  dpa: https://planetscale.com/legal/data-processing-addendum
read:
  - whether any free plan exists today (the Hobby/Developer plan was retired) and the cheapest entry point on the Base plan
  - which engine the database runs (Vitess/MySQL, Postgres, or Neki) and how that engine is billed (cluster size by cloud and region, single-node or highly available, replicas, VTGates or PgBouncer)
  - storage, development branch hours and egress included per branch, and the overage rate for each
  - what happens as the disk fills (network-attached disk autoscaling up to a storage limit you set; Metal has a fixed NVMe size that needs a manual resize)
  - spend alerts (a monthly budget with email notifications at thresholds) and whether anything caps spend or only notifies
  - cluster size limits for new organizations until early invoices are paid
  - regions on AWS and Google Cloud, including EU options, and that a database region cannot be changed later (moving means a new branch, dump and restore, and new credentials)
  - certifications per plan (SOC 1 and SOC 2 Type 2 with HIPAA, BAA on request, PCI DSS only on PlanetScale Managed) and the DPA that covers all plans
usage_questions:
  - metric: cluster_size
    ask: Which engine (Vitess or Postgres) and cluster size runs production, and is it single-node or highly available?
    where: Dashboard → database → Clusters (choose the production branch)
  - metric: db_size
    ask: Storage used by the production branch, and the storage limit if one is set?
    where: Dashboard → database → Clusters → branch → Storage tab (invoice line items also show storage per branch)
  - metric: monthly_bill
    ask: Current invoice total and the line items that drive it?
    where: Organization → Settings → Billing → current invoice → View details
  - metric: region
    ask: Which cloud and region is the database in?
    where: Dashboard → database → Settings (app.planetscale.com/<org>/<database>/settings)
mcp:
  official: true
  readonly_flag: "use the insights-only server URL https://mcp.pscale.dev/mcp/planetscale-insights-only (it has no query tools) and, on the OAuth screen, grant read-only database access and no payment method access; with a service token, grant only read_organization, read_database, read_branch and read_invoices (no connect_* permissions)"
  allowed_tools: [planetscale_list_organizations, planetscale_get_organization, planetscale_list_databases, planetscale_get_database, planetscale_list_branches, planetscale_get_branch, planetscale_get_branch_schema, planetscale_list_regions_for_organization, planetscale_list_cluster_size_skus, planetscale_list_invoices, planetscale_get_invoice_line_items, planetscale_list_schema_recommendations, planetscale_search_documentation]
common_fixes:
  - apply the missing indexes from Insights and schema recommendations before moving to a larger cluster size
  - delete development branches nobody uses; they bill by branch hours or per branch
  - use single-node clusters for non-production branches and keep high availability for production
  - archive or delete old rows from large tables, then check that storage drops on the next invoice
  - keep disk autoscaling on and set a storage limit on purpose
  - turn on spend alerts with a monthly budget (Settings → Billing)
  - create the database in the region the requirements ask for while data is small
verified: 2026-10-07
---

- There is no free plan. PlanetScale retired the Hobby (Developer) plan in 2024, but older articles and agents trained on older data still recommend it as free MySQL. Never present it as an option; read the current plans page and treat PlanetScale as paid from the first database.
- PlanetScale now runs several engines: Vitess (MySQL-compatible), Postgres, and Neki (sharded Postgres, in preview). Prices, features and docs differ per engine, so confirm which one the user has before you read a price.
- Detection: most apps connect with plain `mysql2`, `pg` or an ORM and a `DATABASE_URL`, which does not prove PlanetScale (the host is in the value, and the skill never reads values). `@planetscale/database`, the Prisma or Kysely PlanetScale adapters, or `.pscale.yml` are real signals. If you only have a generic driver, ask the user.
- MCP: never call `planetscale_execute_read_query` or `planetscale_execute_write_query` (they read or change rows), `planetscale_get_postgres_logs` or `planetscale_list_query_error_executions` (they can hold query values), or the payment method tools. Invoice line items give storage and spend per branch without touching data.
- PlanetScale next to a second primary database for the same data (Supabase, Neon, MongoDB Atlas) is an Overlap finding.
