---
schema: 1
id: gcp-bigquery
name: BigQuery
family: gcp
roles: [other]
detect:
  packages: ["@google-cloud/bigquery", "@google-cloud/bigquery-storage", "@google-cloud/bigquery-data-transfer", "@google-cloud/bigquery-reservation", "@googleapis/bigquery"]
  pypi: ["google-cloud-bigquery", "google-cloud-bigquery-storage", "google-cloud-bigquery-datatransfer", "google-cloud-bigquery-reservation", "pandas-gbq", "sqlalchemy-bigquery", "bigframes", "bigquery-magics", "dbt-bigquery"]
  go: ["cloud.google.com/go/bigquery"]
  imports: ["@google-cloud/bigquery", "@google-cloud/bigquery-storage", "@google-cloud/bigquery-data-transfer", "@google-cloud/bigquery-reservation", "@googleapis/bigquery"]
  env_prefixes: []
  config_files: []
  service_signals: ['"google_bigquery_', "gcp.bigquery.", "gcp:bigquery:", "bigquery.cnrm.cloud.google.com", "from google.cloud import bigquery", "google.cloud.bigquery", "bigquery.googleapis.com/", "bq query", "bq load", "bq mk "]
pages:
  pricing: https://cloud.google.com/bigquery/pricing
  editions: https://docs.cloud.google.com/bigquery/docs/editions-intro
  storage_billing: https://docs.cloud.google.com/bigquery/docs/datasets-intro
  time_travel: https://docs.cloud.google.com/bigquery/docs/time-travel
  cost_controls: https://docs.cloud.google.com/bigquery/docs/best-practices-costs
  custom_quotas: https://docs.cloud.google.com/bigquery/docs/custom-quotas
  quotas: https://docs.cloud.google.com/bigquery/quotas
  sandbox: https://docs.cloud.google.com/bigquery/docs/sandbox
  write_api: https://docs.cloud.google.com/bigquery/docs/write-api-rest
  jobs_view: https://docs.cloud.google.com/bigquery/docs/information-schema-jobs
read:
  - on-demand query price per TiB scanned, the free TiB per month, and the minimum billed bytes per query and per table referenced
  - capacity pricing per slot-hour by edition (Standard, Enterprise, Enterprise Plus), autoscaling and its billing minimum, baseline slots, commitments
  - storage per GiB-month, active and long-term (unmodified for 90 days), logical versus physical billing per dataset (physical bills time travel and fail-safe bytes), the free GiB per month
  - Storage Write API (gRPC, and REST, formerly insertAll) per GB with free allowance and REST's per-row minimum; free batch loads; Storage Read API per TiB read
  - BI Engine capacity per GiB-hour, BigQuery ML and AI function charges, if used
  - sandbox limits for projects without billing
  - quotas QueryUsagePerDay (with its default) and QueryUsagePerUserPerDay, concurrent queries, load jobs per table per day
usage_questions:
  - metric: monthly_bill
    ask: Last month's BigQuery cost by SKU (queries or slots, active and long-term storage, streaming, Storage Read API)?
    where: Cloud console → Billing → Reports → Services filtered to BigQuery → Group by SKU
  - metric: query_tb
    ask: Bytes billed by queries in the last 30 days, the top users and the most expensive queries?
    where: "BigQuery → SQL query: SUM(total_bytes_billed) from `region-<loc>`.INFORMATION_SCHEMA.JOBS_BY_PROJECT, grouped by user_email and query; BigQuery → Monitoring → Resource utilization"
  - metric: storage_gb
    ask: Logical and physical bytes, active and long-term, per dataset, and each dataset's storage billing model?
    where: "BigQuery → SQL query on `region-<loc>`.INFORMATION_SCHEMA.TABLE_STORAGE_BY_PROJECT; Explorer → dataset → Details (Storage billing model)"
  - metric: cost_controls
    ask: Pricing model (on-demand or reservations), custom query quotas, maximum bytes billed in the app's queries, and partitioning on the largest tables?
    where: BigQuery → Capacity management (reservations); IAM & Admin → Quotas → Query usage per day; table → Details (Partitioned by)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set a custom QueryUsagePerDay quota and maximum bytes billed on app queries
  - partition and cluster large tables and filter on the partition column; select only needed columns instead of SELECT *
  - switch datasets with well-compressed data to physical storage billing and shorten the time travel window
  - set table or partition expiration on staging and log tables
  - use the Storage Write API (gRPC) instead of legacy streaming inserts, or batch loads where latency allows
  - move steady heavy query load to editions with a low autoscaling maximum; stay on-demand for small or spiky use
verified: 2026-10-11
---

- BigQuery is a warehouse, not the app's database: role `other`, so it is not an Overlap with Postgres or Firestore, nor with PostHog or Mixpanel exporting into it. Snowflake, ClickHouse Cloud or Redshift next to it is one; say so by hand.
- A Firebase or GA4 export to BigQuery and Looker Studio dashboards leave no code: ask whether exports are on and how large the tables are.
- On-demand has no cap except the daily query quota: a dashboard refreshing an unpartitioned table or a `SELECT *` in a loop is billed per TiB scanned. LIMIT does not reduce bytes scanned on unclustered tables.
- Logical billing is the default; changing the model takes 24 hours and can be changed again only after 14 days.
- INFORMATION_SCHEMA queries are billed and need a region qualifier. MCP: the remote server has no read-only endpoint, `execute_sql` runs DML and DDL and query results are rows. Do not use it; ask for the query results.
