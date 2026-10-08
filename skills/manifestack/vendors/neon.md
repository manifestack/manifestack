---
# generated, edit catalog/vendors/neon.md (then run: node tools/sync.mjs)
schema: 1
id: neon
name: Neon
roles: [database, auth]
detect:
  packages: ["@neondatabase/serverless", "@prisma/adapter-neon", "@vercel/postgres", "@neondatabase/neon-js", "@neondatabase/auth", "@neondatabase/api-client", "@neon/sdk", "neonctl"]
  pypi: ["neon-api"]
  imports: ["@neondatabase/", "@prisma/adapter-neon", "@vercel/postgres"]
  env_prefixes: ["NEON_"]
  config_files: []
  role_signals:
    auth: ["@neondatabase/auth"]
pages:
  pricing: https://neon.com/pricing
  limits: https://neon.com/docs/introduction/plans
  regions: https://neon.com/docs/introduction/regions
  security: https://neon.com/docs/security/compliance
read:
  - Free storage per project and per account
  - Free compute (CU-hours) per project and maximum autoscaling size
  - what happens when a Free allowance runs out (compute or transfer): whether the project is suspended until the next billing period
  - scale-to-zero behaviour on Free (cold starts) and whether it can be turned off
  - network egress included
  - branches per project and the restore (history) window
  - paid plans (Launch, Scale) usage rates for compute, storage and egress, and any monthly minimum
  - regions (a project region cannot be changed later)
  - certifications (SOC 2, ISO 27001/27701, HIPAA on Scale) and GDPR terms
usage_questions:
  - metric: db_size
    ask: Storage used by the project?
    where: Console → Project → Dashboard → Storage (or Organization → Billing)
  - metric: compute_hours
    ask: Compute (CU-hours) used this month?
    where: Console → Project → Dashboard → Compute
  - metric: egress_gb
    ask: Network transfer this month?
    where: Console → Project → Dashboard → Network transfer
  - metric: region
    ask: Which region is the project in?
    where: Console → Project → Settings → General
mcp:
  official: true
  readonly_flag: "readonly=true (remote URL https://mcp.neon.tech/mcp?readonly=true; with OAuth, leave 'Allow writes' unchecked)"
  allowed_tools: [list_projects, describe_project, list_branches, describe_branch, get_branch, list_branch_computes, get_database_tables, describe_table_schema, list_regions, list_organizations, run_sql]
common_fixes:
  - delete unused branches and shorten the history window
  - let compute scale to zero for non-production branches
  - cap autoscaling at the size the load needs
  - use the pooled connection string for serverless functions
  - create the project in the region the requirements ask for while data is small
verified: 2026-10-08
---

- Usage shows in the Console with up to an hour of delay.
- In read-only mode `run_sql` accepts read-only queries. Use it only for metadata such as `pg_database_size`, never to select rows from user tables. `projectId=` in the MCP URL scopes it to one project.
- Do not call `list_credentials` or anything that returns a connection string: the skill never handles secrets.
- `DATABASE_URL` alone does not prove Neon (the host is in the value, which the skill never reads). Ask the user if the only signal is that name.
