---
# generated, edit catalog/vendors/azure-ai-search.md (then run: node tools/sync.mjs)
schema: 1
id: azure-ai-search
name: Azure AI Search
family: azure
roles: [search]
detect:
  packages: ["@azure/search-documents"]
  pypi: ["azure-search-documents", "llama-index-vector-stores-azureaisearch"]
  go: []
  imports: ["@azure/search-documents"]
  env_prefixes: ["AZURE_SEARCH_", "AZURE_AI_SEARCH_"]
  config_files: []
  service_signals: ["azure.search.documents", ".search.windows.net", "\"azurerm_search_", "Microsoft.Search/searchServices", "azure-native.search", "azure_native.search", "vectorstores.azuresearch", "vectorstores/azure_aisearch", "AzureAISearch", "AzureCognitiveSearch"]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/search/
  tiers: https://learn.microsoft.com/en-us/azure/search/search-sku-tier
  limits: https://learn.microsoft.com/en-us/azure/search/search-limits-quotas-capacity
  manage_costs: https://learn.microsoft.com/en-us/azure/search/search-sku-manage-costs
  capacity: https://learn.microsoft.com/en-us/azure/search/search-capacity-planning
  semantic_ranker: https://learn.microsoft.com/en-us/azure/search/semantic-search-overview
  vector_size: https://learn.microsoft.com/en-us/azure/search/vector-search-index-size
  skillset_billing: https://learn.microsoft.com/en-us/azure/search/cognitive-search-attach-cognitive-services
  agentic_retrieval: https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview
  regions: https://learn.microsoft.com/en-us/azure/search/search-region-support
  security: https://learn.microsoft.com/en-us/azure/search/search-security-built-in
read:
  - Dedicated tiers (Free, Basic, Standard S1 to S3, Storage Optimized L1 and L2) billed per search unit per hour, where search units are replicas times partitions; billing runs from creation until the service is deleted, queried or not
  - Serverless (preview) tier billed per compute unit hour and per GB of index storage, scaling to zero when idle; when its billing started and what it cannot migrate to
  - per-tier storage per partition, indexes per service, maximum replicas and partitions, and vector index quota per partition (newer services get more)
  - which tiers a service can switch between (Basic and S1 to S3 only) and that other moves need a new service and a reindex
  - semantic ranker free plan with a monthly request allowance, then the standard plan per 1,000 requests
  - agentic retrieval per token above a free allowance, and remote knowledge source charges
  - AI enrichment, i.e. built-in skills free for a few transactions per index per day, then billed through an attached Foundry resource; image extraction and custom entity lookup billed by Search; vectorizers billed by Azure OpenAI or Foundry
  - savings plans and reservations for Dedicated tiers; the Free tier (one per subscription, shared, may be deleted after inactivity)
  - throttling when a tier's query or indexing capacity is reached, and the replica counts the SLA needs
usage_questions:
  - metric: monthly_bill
    ask: AI Search cost last month by meter (search units, semantic ranker, agentic retrieval, image extraction)?
    where: Azure portal → Cost Management → Cost analysis → filter the search resource (or its resource group), Group by Meter
  - metric: search_units
    ask: Tier, replicas and partitions of each search service, including test services left running?
    where: search service → Settings → Scale; Overview (Pricing tier)
  - metric: db_size
    ask: Storage and vector index size used against the tier quota?
    where: search service → Overview → Usage tab (storage and vector index size)
  - metric: monthly_search_requests
    ask: Queries per second at peak, throttled queries, and semantic queries last month?
    where: search service → Monitoring → Metrics (SearchQueriesPerSecond, ThrottledSearchQueriesPercentage), 30 days
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with only the tool below (npx -y @azure/mcp@latest server start --read-only --tool search_service_list); sign in with a Reader identity"
  allowed_tools: [search_service_list]
common_fixes:
  - delete idle dev and test search services; a Dedicated service bills until deleted
  - drop to one replica outside production and add replicas only for query load or the SLA
  - shrink vectors with narrow types, quantization and no stored copies before adding partitions
  - keep semantic ranker on the free plan or cap it to the queries that need it
  - attach a Foundry resource only to skillsets that need enrichment, and run indexers on a schedule rather than continuously
  - buy a reservation or savings plan only for the steady baseline
verified: 2026-10-11
---

- Azure AI Search was Azure Cognitive Search and is now also sold as Foundry IQ; the pricing page uses both names.
- A Dedicated service bills every hour from creation, even with no queries; a forgotten S1 or higher is a Bill finding. Serverless avoids idle compute but is in preview.
- LangChain (`AzureSearch`, `AzureAISearchVectorStore`), LlamaIndex and Semantic Kernel use it as a vector store; the signals count once the Azure family is found.
- Pinecone has the database role in this catalog, so Pinecone plus AI Search is not reported as Overlap; flag it when both hold the same embeddings. Algolia, Elastic Cloud or OpenSearch next to AI Search is Overlap unless split on purpose.
- MCP: `search_index_query` and `search_knowledge_base_retrieve` return documents and can bill semantic ranker or agentic retrieval; index, knowledge base and knowledge source definitions can hold connection details. Call only `search_service_list` (name, location, SKU, endpoint).
