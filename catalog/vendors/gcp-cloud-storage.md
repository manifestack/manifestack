---
schema: 1
id: gcp-cloud-storage
name: Google Cloud Storage
family: gcp
roles: [storage]
detect:
  packages: ["@google-cloud/storage", "@google-cloud/storage-control", "@googleapis/storage"]
  pypi: ["google-cloud-storage", "google-cloud-storage-control", "gcsfs"]
  go: ["cloud.google.com/go/storage"]
  imports: ["@google-cloud/storage", "@google-cloud/storage-control", "@googleapis/storage"]
  env_prefixes: []
  config_files: []
  service_signals: ['"google_storage_', "gcp.storage.", "gcp:storage:", "storage.cnrm.cloud.google.com", "from google.cloud import storage", "google.cloud.storage", "gs://", "//storage.googleapis.com", ".storage.googleapis.com", "storage.cloud.google.com", "gsutil ", "gcloud storage "]
  role_signals:
    storage: ["@google-cloud/storage", "from google.cloud import storage", "google.cloud.storage", "cloud.google.com/go/storage", '"google_storage_bucket"', "gcp.storage.Bucket", "gcp:storage:Bucket", "gsutil ", "gcloud storage "]
pages:
  pricing: https://cloud.google.com/storage/pricing
  storage_classes: https://docs.cloud.google.com/storage/docs/storage-classes
  soft_delete: https://docs.cloud.google.com/storage/docs/soft-delete
  autoclass: https://docs.cloud.google.com/storage/docs/autoclass
  lifecycle: https://docs.cloud.google.com/storage/docs/lifecycle
  locations: https://docs.cloud.google.com/storage/docs/locations
  quotas: https://docs.cloud.google.com/storage/quotas
read:
  - storage per GB-month by class (Standard, Nearline, Coldline, Archive) and location type (region, dual-region, multi-region); minimum storage durations and early deletion charges
  - Class A and Class B operations by class (lifecycle class changes are Class A), retrieval fees of the colder classes, inter-region replication per GB written to dual- and multi-region buckets
  - Autoclass management fee, the object size it skips, and the one-time enablement charge
  - soft delete on by default with a seven-day retention; soft-deleted and noncurrent objects bill storage like live ones
  - internet egress tiers, free transfers within a location, egress to other Google Cloud services; Always Free usage in a few US regions
  - Rapid Cache and Rapid Bucket charges, if used
  - quotas Maximum bucket creation and deletion rate per project, Maximum rate of writes to the same object name, Maximum soft delete retention duration
usage_questions:
  - metric: storage_gb
    ask: Size per bucket split by storage class and by type (live, noncurrent, soft-deleted, multipart-upload)?
    where: Cloud console → Monitoring → Metrics explorer → GCS Bucket → Total bytes (v2) (storage.googleapis.com/storage/v2/total_bytes), grouped by storage_class and type; measured once a day
  - metric: monthly_bill
    ask: Last month's Cloud Storage cost by SKU (storage per class and location, Class A and B operations, retrieval, replication, network egress)?
    where: Cloud console → Billing → Reports → Services Cloud Storage → Group by SKU
  - metric: transfer_tb
    ask: Data sent from the largest buckets last month, and how much went to the internet?
    where: Cloud console → Cloud Storage → Buckets → bucket → Observability; Billing → Reports → egress SKUs
  - metric: lifecycle
    ask: Location type, default storage class, soft delete retention, Object Versioning, Autoclass and lifecycle rules on the large buckets?
    where: Cloud console → Cloud Storage → Buckets → bucket → Configuration and Protection tabs, Lifecycle tab
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set soft delete retention to 0 or a few days on buckets of temporary or frequently rewritten objects, and on new buckets through a tag
  - add lifecycle rules that delete noncurrent versions and abort incomplete multipart uploads
  - use a regional bucket in the compute region unless dual-region or multi-region is a requirement
  - move cold data to Nearline, Coldline or Archive only when reads are rare, or turn on Autoclass for unknown access patterns
  - serve public files through Cloud CDN or another CDN instead of from the bucket
verified: 2026-10-11
---

- The storage role counts from the SDK, a Terraform or Pulumi bucket, or `gsutil`/`gcloud storage` commands. A `gs://` path or `storage.googleapis.com` URL alone may be someone else's public bucket (TensorFlow.js models, sample data): the service is listed without the role.
- An S3 SDK with `endpoint` `https://storage.googleapis.com` and HMAC keys is Cloud Storage through its XML API, not S3 (`aws-s3` then has no storage role); if Google Cloud is not otherwise found, ask.
- Firebase Storage buckets (`*.firebasestorage.app`, `*.appspot.com`) are Cloud Storage buckets billed at these rates. Cloud Storage next to S3, R2 or another object store is Overlap unless split on purpose; next to Firebase Storage it is one service.
- Soft delete is on by default and bills deleted data for its retention; Object Versioning bills every noncurrent version; incomplete multipart uploads stay until aborted. Total bytes (v2) shows each.
- MCP: the remote server (`storage.googleapis.com/storage/mcp`) has write tools and no read-only endpoint; an IAM deny policy is a standing project setting, and `read_object` returns file contents. Do not use it.
