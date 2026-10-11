---
# generated, edit catalog/vendors/gcp-firestore.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-firestore
name: Firestore (Google Cloud SDKs and Datastore mode)
family: gcp
roles: [database]
detect:
  packages: ["@google-cloud/firestore", "@google-cloud/datastore", "@googleapis/firestore", "@googleapis/datastore"]
  pypi: ["google-cloud-firestore", "google-cloud-datastore", "google-cloud-ndb"]
  go: ["cloud.google.com/go/firestore", "cloud.google.com/go/datastore"]
  imports: ["@google-cloud/firestore", "@google-cloud/datastore", "@googleapis/firestore", "@googleapis/datastore"]
  env_prefixes: []
  config_files: []
  service_signals: ['"google_firestore_', '"google_datastore_', "gcp.firestore.", "gcp:firestore:", "firestore.cnrm.cloud.google.com", "gcloud firestore ", "gcloud datastore ", "from google.cloud import firestore", "google.cloud.firestore", "from google.cloud import datastore", "google.cloud.datastore", "from google.cloud import ndb", "google.cloud.ndb", ".firestore.goog:"]
pages:
  pricing: https://cloud.google.com/firestore/pricing
  enterprise_pricing: https://cloud.google.com/firestore/enterprise/pricing
  datastore_pricing: https://cloud.google.com/datastore/pricing
  editions: https://docs.cloud.google.com/firestore/native/docs/editions-overview
  quotas: https://docs.cloud.google.com/firestore/quotas
  usage: https://docs.cloud.google.com/firestore/native/docs/monitor-usage
  datastore_or_firestore: https://docs.cloud.google.com/datastore/docs/firestore-or-datastore
  mongodb_compatibility: https://docs.cloud.google.com/firestore/mongodb-compatibility/docs/connect
read:
  - Standard edition per document read, write and delete, stored data per GiB-month and network egress by location; the daily free quota and that it applies to one database per project only
  - Enterprise edition read, write, real-time update and event units by byte tranche, its free tier, and the MongoDB compatibility mode
  - Datastore mode entity reads, writes and deletes and its free quota
  - features without free usage (TTL deletes, PITR, backups, restore, clone) and how each is billed
  - committed use discounts
  - limits Maximum number of databases per project, Maximum size for a document, Maximum number of index entries for each document
usage_questions:
  - metric: firestore_reads
    ask: Document reads, writes and deletes per day at peak, stored data, and which database (default or named) and edition each is?
    where: Cloud console → Firestore → Databases → database → Usage
  - metric: monthly_bill
    ask: Last month's Firestore cost by SKU (reads, writes, deletes, storage, PITR, backups, egress)?
    where: Cloud console → Billing → Reports → Services filtered to Firestore → Group by SKU
  - metric: backups
    ask: Are PITR, scheduled backups and TTL policies on?
    where: Cloud console → Firestore → Databases → database → Disaster Recovery, Time-to-live
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - paginate queries with limit() and cursors, and count with aggregation queries instead of reading documents
  - drop indexes and single-field index entries on fields that are never queried
  - set TTL policies on sessions, logs and caches
  - keep small projects on the default database to use the free quota
  - check the edition before migrating; Enterprise bills by bytes, not documents
verified: 2026-10-11
---

- This map covers Firestore and Datastore reached through the Google Cloud server SDKs (`@google-cloud/firestore`, `google-cloud-firestore`, `google-cloud-datastore`, `google-cloud-ndb`, the Go modules). Firestore through the Firebase SDKs is in the Firebase map; the database and its bill are the same, so read both when both are found.
- Firestore next to Supabase, Neon, MongoDB Atlas or another primary database is Overlap unless split on purpose; next to Firebase it is one database.
- Firestore with MongoDB compatibility uses the MongoDB drivers (found as MongoDB Atlas): a `*.firestore.goog` host means Firestore Enterprise, not Atlas.
- Every document returned is a billed read (Standard edition), including realtime listener updates.
- MCP: the remote server (`firestore.googleapis.com/mcp`) has write tools and no read-only endpoint, and its document tools return user data. Do not use it.
