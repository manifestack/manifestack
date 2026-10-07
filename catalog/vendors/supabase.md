---
schema: 1
id: supabase
name: Supabase
roles: [database, auth, storage]
detect:
  packages: ["@supabase/supabase-js", "@supabase/ssr", "@supabase/auth-helpers-nextjs", "@supabase/auth-helpers-react", "@supabase/auth-ui-react", "supabase"]
  imports: ["@supabase/"]
  env_prefixes: ["SUPABASE_", "NEXT_PUBLIC_SUPABASE_", "VITE_SUPABASE_", "EXPO_PUBLIC_SUPABASE_"]
  config_files: ["supabase/config.toml"]
  role_signals:
    auth: ["supabase.auth.", "@supabase/auth-helpers", "@supabase/auth-ui", ".auth.signInWith", ".auth.getUser("]
    storage: ["supabase.storage.", ".storage.from("]
pages:
  pricing: https://supabase.com/pricing
  limits: https://supabase.com/docs/guides/platform/manage-your-usage
  billing: https://supabase.com/docs/guides/platform/billing-on-supabase
  regions: https://supabase.com/docs/guides/platform/regions
  security: https://supabase.com/security
  dpa: https://supabase.com/legal/dpa
read:
  - Free database size per project and what happens at the limit (read-only mode)
  - Free project pausing after inactivity, and the number of active Free projects
  - Free egress, cached egress, file storage, MAU and Edge Function invocations
  - Realtime peak connections and messages included
  - Pro price, included quotas, compute credits and overage rates per unit
  - spend cap default on Pro and what it blocks
  - regions available for a project (a project region cannot be changed later)
  - certifications (SOC 2 Type 2, HIPAA with BAA, ISO 27001) and DPA
usage_questions:
  - metric: db_size
    ask: Database size today, and a month ago if you can see it?
    where: Dashboard → Organization → Usage → Disk Size (or Project → Database → Usage)
  - metric: egress_gb
    ask: Egress this billing cycle?
    where: Dashboard → Organization → Usage → Egress
  - metric: mau
    ask: Monthly active users for Auth?
    where: Dashboard → Organization → Usage → Monthly Active Users
  - metric: storage_gb
    ask: File storage size?
    where: Dashboard → Organization → Usage → Storage Size
  - metric: region
    ask: Which region is the production project in?
    where: Dashboard → Project → Settings → General (region shown with the project)
mcp:
  official: true
  readonly_flag: "read_only=true (remote URL https://mcp.supabase.com/mcp?read_only=true&project_ref=<ref>) or --read-only with --project-ref (local @supabase/mcp-server-supabase)"
  allowed_tools: [list_organizations, get_organization, list_projects, get_project, list_tables, list_extensions, list_migrations, execute_sql, list_storage_buckets, get_storage_config, list_edge_functions, get_advisors, search_docs]
common_fixes:
  - archive or delete old rows from large tables (events, logs, sessions) and run VACUUM
  - move files and large blobs from table columns to Storage
  - keep a Free project awake only if pausing is acceptable; otherwise plan Pro before launch
  - turn the Pro spend cap on or off on purpose and know what it blocks
  - create the production project in the region the requirements ask for while data is small
verified: 2026-10-07
---

- Only use MCP when it is connected with read-only mode on. With `read_only=true` the server hides write tools; `execute_sql` still exists but runs as a read-only Postgres role. Use it only for metadata queries such as `select pg_size_pretty(pg_database_size(current_database()))` or `pg_total_relation_size`, never to select rows from user tables.
- Do not call `get_publishable_keys`, even though it is read-only: the skill never handles keys.
- `project_ref` scopes the server to one project and hides account tools. Prefer it.
- Supabase Auth and another auth provider (Clerk, Auth0) in the same code is an Overlap finding.
