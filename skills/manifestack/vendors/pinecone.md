---
# generated, edit catalog/vendors/pinecone.md (then run: node tools/sync.mjs)
schema: 1
id: pinecone
name: Pinecone
roles: [database]
detect:
  packages: ["@pinecone-database/", "@langchain/pinecone", "@llamaindex/pinecone"]
  pypi: ["pinecone", "pinecone-client", "pinecone-plugin-*", "langchain-pinecone", "llama-index-vector-stores-pinecone"]
  go: ["github.com/pinecone-io/go-pinecone"]
  imports: ["@pinecone-database/", "@langchain/pinecone", "@llamaindex/pinecone"]
  env_prefixes: ["PINECONE_"]
  config_files: []
pages:
  pricing: https://www.pinecone.io/pricing/
  object_limits: https://docs.pinecone.io/reference/api/database-limits/object-limits
  rate_limits: https://docs.pinecone.io/reference/api/database-limits/rate-limits
  understanding_cost: https://docs.pinecone.io/guides/manage-cost/understanding-cost
  manage_cost: https://docs.pinecone.io/guides/manage-cost/manage-cost
  monitor_usage: https://docs.pinecone.io/guides/manage-cost/monitor-usage-and-costs
  save_on_costs: https://docs.pinecone.io/guides/optimize/save-on-costs
  standard_trial: https://docs.pinecone.io/guides/organizations/manage-billing/standard-trial
  downgrade: https://docs.pinecone.io/guides/organizations/manage-billing/downgrade-billing-plan
  regions: https://docs.pinecone.io/guides/index-data/create-an-index#cloud-regions
  assistant_pricing: https://docs.pinecone.io/guides/assistant/pricing-and-limits
  release_notes: https://docs.pinecone.io/release-notes/2026
  security: https://www.pinecone.io/security/
  dpa: https://www.pinecone.io/legal/data-processing-addendum/
read:
  - plans (Starter, Builder, Standard, Enterprise) and which are blocked at a quota and which bill overage per unit
  - Starter and Builder quotas, i.e. indexes per project, storage, namespaces per index, read units and write units per month, embedding tokens, rerank requests and egress; what each returns when passed (quota error, reads blocked until next period)
  - Standard monthly minimum usage commitment (billed as a top-up when usage is lower) and what the trial does when it ends
  - serverless units, i.e. read units that grow with namespace size, write units per KB with a per-request minimum, storage, egress, import, backup and restore
  - inference (embedding, rerank) and Assistant billed on top of database units
  - regions per plan and that the cloud and region of an index cannot be changed
  - spend alerts on Standard and Enterprise only
  - downgrading deletes backups, collections and indexes outside the Starter region unless moved first
  - certifications (SOC 2 Type II, HIPAA with a BAA as a Standard add-on) and the DPA
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date cost and the last invoice total?
    where: Console → Settings → Usage (Standard and Enterprise, owner or billing admin; up to 3 days delay); plan under Settings → Billing → Plans
  - metric: read_units
    ask: Read units and write units this month?
    where: Console → Settings → Usage, by SKU; per index under Database → Indexes → index → Metrics
  - metric: db_size
    ask: Storage per index and record count?
    where: Database → Indexes → index → Metrics, or describe_index_stats for record and namespace counts
  - metric: region
    ask: Which cloud and region does each index use?
    where: Database → Indexes → index details
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - use one namespace per tenant instead of an index per tenant, and delete idle indexes and namespaces
  - shrink metadata and use a lower vector dimension to cut storage, write and read units
  - narrow queries with metadata filters, and use list plus fetch instead of query for lookups by ID
  - batch upserts and use bulk import for large loads instead of many small writes
  - keep include_values off when the vectors are not needed, to cut egress
  - set spend alerts on Standard, which warn and do not cap
verified: 2026-10-11
---

- Pinecone is detected from `@pinecone-database/`, `pinecone` (and the deprecated `pinecone-client`), the Pinecone plugins, the LangChain and LlamaIndex integrations, `go-pinecone` and `PINECONE_*` names. Index hosts look like `<index>-<project>.svc.<env>.pinecone.io`.
- Query cost follows namespace size, not `top_k`: a namespace that keeps growing raises the read units of every query. Ask for the size of the largest namespace when reads are the main cost.
- Starter has no documented usage dashboard; ask the user for record counts or read them from `describe_index_stats`.
- The Developer MCP (`@pinecone-database/mcp`) has no read-only mode: it includes `upsert-records` and `create-index-for-model`, and `search-records` reads user data and spends units. A viewer-scoped API key exists only on Standard and Enterprise. Do not use it; ask the user for numbers instead.
- Pinecone next to a Postgres database (Supabase, Neon) is not an Overlap by itself: the jobs differ. It is one when the Postgres side also stores the same embeddings with pgvector.
