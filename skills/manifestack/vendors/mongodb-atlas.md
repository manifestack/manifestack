---
# generated, edit catalog/vendors/mongodb-atlas.md (then run: node tools/sync.mjs)
schema: 1
id: mongodb-atlas
name: MongoDB Atlas
roles: [database]
detect:
  packages: ["mongodb", "mongoose"]
  pypi: ["pymongo", "motor", "mongoengine", "beanie", "django-mongodb-backend"]
  go: ["go.mongodb.org/mongo-driver", "go.mongodb.org/atlas", "go.mongodb.org/atlas-sdk"]
  imports: ["mongodb", "mongoose"]
  env_prefixes: ["MONGODB_", "MONGO_"]
  config_files: []
pages:
  pricing: https://www.mongodb.com/pricing
  free_limits: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
  flex_limits: https://www.mongodb.com/docs/atlas/reference/flex-limitations/
  flex_billing: https://www.mongodb.com/docs/atlas/billing/atlas-flex-costs/
  storage_limits: https://www.mongodb.com/docs/atlas/reference/faq/storage/
  billing: https://www.mongodb.com/docs/atlas/billing/
  data_transfer: https://www.mongodb.com/docs/atlas/billing/data-transfer-costs/
  regions_aws: https://www.mongodb.com/docs/atlas/reference/amazon-aws/
  regions_gcp: https://www.mongodb.com/docs/atlas/reference/google-gcp/
  regions_azure: https://www.mongodb.com/docs/atlas/reference/microsoft-azure/
  move_region: https://www.mongodb.com/docs/atlas/tutorial/move-cluster/
  security: https://www.mongodb.com/products/platform/trust
  dpa: https://www.mongodb.com/legal/data-processing-agreement
read:
  - Free cluster limits by kind (storage, operations per second, data transfer per rolling week, connections, databases and collections), one Free cluster per project, and pausing after inactivity
  - what happens at a limit on Free and Flex (storage is a hard limit and writes fail; past the operations limit, requests are throttled and queued)
  - Flex pricing model (base price, usage steps by operations per second, monthly cap) and what Flex lacks (storage autoscaling, continuous backup, private endpoints)
  - that Serverless instances are no longer offered; older advice that recommends them is out of date
  - Dedicated tier hourly price by tier, cloud provider and region, storage auto-expand (on by default), compute autoscaling, and backup billed separately
  - data transfer charges (same region, cross-region, internet) and how they change by provider
  - billing alerts (organization alert conditions that notify past a set amount; nothing caps spend) and the Cost Explorer
  - regions per cloud (AWS, Google Cloud, Azure) and which ones support Free and Flex; the region is set per cluster, Flex and Dedicated clusters can move with a rolling migration, Free clusters cannot
  - certifications (SOC 2 Type II, ISO 27001/27017/27018, PCI DSS, HIPAA with a BAA, CSA STAR) and the DPA that is part of the cloud terms
usage_questions:
  - metric: cluster_tier
    ask: Which tier (Free, Flex or Dedicated), cloud provider and region does the production cluster use?
    where: Atlas → Project → Database → Clusters (the cluster card shows tier, provider and region)
  - metric: db_size
    ask: Data size of the production cluster today?
    where: Atlas → Project → Clusters → cluster name → Metrics (Data Size or Logical Size on Free and Flex, Disk Usage on Dedicated)
  - metric: ops_per_sec
    ask: Peak operations per second over the last month?
    where: Atlas → Project → Clusters → cluster name → Metrics → Opcounters
  - metric: monthly_bill
    ask: Month-to-date cost and the line items behind it?
    where: Atlas → Organization → Billing → Overview (or Billing → Cost Explorer)
mcp:
  official: true
  readonly_flag: "local server only: npx mongodb-mcp-server --readOnly (or MDB_MCP_READ_ONLY=true); add --disabledTools create,update,delete,read (MDB_MCP_DISABLED_TOOLS) so only metadata tools stay registered. The Atlas Managed (remote) server's Read mode (Organization Settings → App Connections) still allows find and aggregate, so do not use it for the audit"
  allowed_tools: [list-databases, list-collections, collection-storage-size, db-stats, collection-indexes]
common_fixes:
  - add indexes for slow queries and drop unused ones before moving to a bigger tier (Performance Advisor suggests them on Dedicated tiers)
  - add TTL indexes so sessions, logs and events expire on their own
  - move large files out of documents (to object storage) and keep only references
  - delete or export old data to stay under the Free or Flex storage limit (Online Archive is available on Dedicated tiers)
  - pause dedicated clusters used only for development
  - set a billing alert for the monthly amount you expect
  - create the cluster in the region the requirements ask for; move it while data is small
verified: 2026-10-07
---

- Detection is weak. The `mongodb` and `mongoose` drivers (and `pymongo`, `motor`, the Go driver) also connect to self-hosted MongoDB, Amazon DocumentDB and Azure Cosmos DB for MongoDB. The Atlas host (`mongodb+srv://….mongodb.net`) is in the connection string value, which the skill never reads. Confirm Atlas vs self-hosted with the user before you apply any Atlas plan or limit. Only `go.mongodb.org/atlas` and `go.mongodb.org/atlas-sdk` (Atlas Admin API clients) prove Atlas use.
- Free and Flex storage is a hard limit: writes fail with an error, so a growing Free cluster is a launch risk, not just a cost line. Dedicated tiers auto-expand storage by default, which keeps the app up but raises the bill.
- MCP: allowed tools return only names, sizes and index definitions. Do not call `find`, `aggregate`, `aggregate-db`, `count`, `export` or `collection-schema` (it samples documents), and do not call `atlas-list-clusters`, `atlas-inspect-cluster`, `atlas-connect-cluster`, `remote-atlas-connect` or `atlas-list-db-users`: they return connection strings or create temporary database users. Ask the cluster tier and region question instead. With no connection string configured, the database tools need `connect`, so use MCP only if the user already set it up.
- MongoDB Atlas next to another primary database for the same data (Supabase, Neon, PlanetScale, Firebase Firestore) is an Overlap finding.
