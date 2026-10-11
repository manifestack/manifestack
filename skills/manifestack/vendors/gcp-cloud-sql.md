---
# generated, edit catalog/vendors/gcp-cloud-sql.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-cloud-sql
name: Cloud SQL and AlloyDB
family: gcp
roles: [database]
detect:
  packages: ["@google-cloud/cloud-sql-connector", "@google-cloud/sql", "@googleapis/sqladmin", "@google-cloud/alloydb", "@googleapis/alloydb"]
  pypi: ["cloud-sql-python-connector", "google-cloud-alloydb-connector", "google-cloud-alloydb"]
  go: ["cloud.google.com/go/cloudsqlconn", "cloud.google.com/go/sql", "cloud.google.com/go/alloydbconn", "cloud.google.com/go/alloydb"]
  imports: ["@google-cloud/cloud-sql-connector", "@google-cloud/sql", "@googleapis/sqladmin", "@google-cloud/alloydb", "@googleapis/alloydb"]
  env_prefixes: ["INSTANCE_CONNECTION_NAME", "CLOUD_SQL_"]
  config_files: []
  service_signals: ['"google_sql_', '"google_alloydb_', "gcp.sql.", "gcp:sql:", "gcp.alloydb.", "gcp:alloydb:", "sql.cnrm.cloud.google.com", "alloydb.cnrm.cloud.google.com", "gcloud sql ", "gcloud alloydb ", "/cloudsql/", "cloudsql-instances", "cloud-sql-proxy", "cloud_sql_proxy", "cloudsql-docker", "alloydb-auth-proxy", "google.cloud.sql.connector", "google.cloud.alloydb", "sqladmin.googleapis.com"]
pages:
  pricing: https://cloud.google.com/sql/pricing
  alloydb_pricing: https://cloud.google.com/alloydb/pricing
  editions: https://docs.cloud.google.com/sql/docs/postgres/editions-intro
  extended_support: https://docs.cloud.google.com/sql/docs/postgres/extended-support
  versions: https://docs.cloud.google.com/sql/docs/db-versions
  quotas: https://docs.cloud.google.com/sql/docs/quotas
  stop_instance: https://docs.cloud.google.com/sql/docs/postgres/start-stop-restart-instance
  backups: https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups
  free_trial: https://docs.cloud.google.com/sql/docs/postgres/free-trial-instance
read:
  - Enterprise versus Enterprise Plus: per vCPU-hour and GB-hour of memory, shared-core machines (Enterprise only, no SLA), data cache; which versions default to Enterprise Plus
  - HA (regional) rates for instance, storage and backups against zonal
  - SSD, HDD and Hyperdisk Balanced storage per GB provisioned, backup storage used
  - extended support per vCPU-hour for major versions past end of life, and the dates for the versions in use
  - idle IPv4 address charge, network egress, SQL Server license; committed use discounts and what they exclude
  - AlloyDB vCPU and memory per hour, storage per GB used, backups, read pools, extended support; free trial instances and clusters
  - quotas Instances per project, Maximum concurrent connections, Cloud Run limits
usage_questions:
  - metric: instances
    ask: Each instance's engine and major version, edition, machine type, HA or zonal, and whether it is in extended support?
    where: Cloud console → SQL → Instances (Filter Type by database version) → instance → Overview → Configuration; AlloyDB → Clusters
  - metric: db_size
    ask: Provisioned storage, storage used, automatic storage increase limit, and backup retention?
    where: Cloud console → SQL → instance → Overview (Configuration, storage usage chart); Edit → Customize your instance → Storage; Backups → Settings
  - metric: monthly_bill
    ask: Last month's Cloud SQL cost by SKU (vCPU, RAM, storage, backups, extended support, IP address, network)?
    where: Cloud console → Billing → Reports → Services filtered to Cloud SQL and AlloyDB → Group by SKU
  - metric: idle
    ask: Any stopped, idle or overprovisioned instances and replicas?
    where: Cloud console → SQL → Instances (status, and the idle instance recommendations banner → View all); Active Assist → Recommendations
mcp:
  official: true
  readonly_flag: "remote read-only toolset https://sqladmin.googleapis.com/mcp/readonly (Cloud SQL only)"
  allowed_tools: [list_instances, get_instance, get_operation]
common_fixes:
  - upgrade major versions before extended support starts
  - choose Enterprise edition and a smaller machine for dev and staging, and set the edition when creating instances on versions that default to Enterprise Plus
  - use zonal instead of HA outside production
  - stop or delete idle instances; a stopped instance still pays storage and IP addresses
  - set an automatic storage increase limit, and shrink storage that grew past need
  - delete unused read replicas and old on-demand backups
verified: 2026-10-11
---

- Apps connect with `pg`, `mysql2` or an ORM and a `DATABASE_URL` whose value is never read, so Cloud SQL shows through infrastructure files, the connectors, the Auth Proxy, a `/cloudsql/` socket, a Cloud Run `cloudsql-instances` setting or `INSTANCE_CONNECTION_NAME`. If Google Cloud is found but no database, ask where Postgres or MySQL runs.
- Cloud SQL or AlloyDB next to Supabase, Neon, PlanetScale or another managed database is Overlap unless split on purpose. Next to Firestore it is usually a split by data type.
- Extended support starts automatically after a version's end of life, billed per vCPU on top of the instance. A stopped instance pays storage and IP addresses. Storage that grew automatically stays until shrunk, with downtime.
- PostgreSQL 16+ and MySQL 8.4+ default to Enterprise Plus, which has no shared-core machines: a small app created with defaults pays far more than on a shared-core Enterprise instance.
- MCP: in the read-only toolset, `execute_sql_readonly` returns table data and the user tools list database users; leave them out. The AlloyDB server has write tools and no read-only endpoint: do not use it.
