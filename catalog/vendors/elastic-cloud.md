---
schema: 1
id: elastic-cloud
name: Elastic Cloud
roles: [search, monitoring]
detect:
  packages: ["@elastic/elasticsearch", "@elastic/elasticsearch-serverless", "elasticsearch", "@elastic/enterprise-search", "@elastic/search-ui", "@elastic/react-search-ui", "@elastic/search-ui-elasticsearch-connector", "elastic-apm-node", "@elastic/apm-rum", "@elastic/apm-rum-react", "@elastic/opentelemetry-node"]
  pypi: ["elasticsearch", "elasticsearch8", "elasticsearch9", "elasticsearch-serverless", "elasticsearch-dsl", "elastic-apm", "elasticapm", "elastic-opentelemetry"]
  go: ["github.com/elastic/go-elasticsearch", "github.com/elastic/elasticsearch-serverless-go", "go.elastic.co/apm"]
  imports: ["@elastic/elasticsearch", "@elastic/elasticsearch-serverless", "elasticsearch", "@elastic/enterprise-search", "@elastic/search-ui", "@elastic/react-search-ui", "elastic-apm-node", "@elastic/apm-rum", "@elastic/apm-rum-react", "@elastic/opentelemetry-node"]
  env_prefixes: ["ELASTIC_CLOUD_", "ELASTIC_API_KEY", "ELASTIC_APM_", "ELASTICSEARCH_", "NEXT_PUBLIC_ELASTIC_", "VITE_ELASTIC_"]
  config_files: ["elastic-apm-node.js"]
  role_signals:
    search: ["@elastic/elasticsearch", "@elastic/search-ui", "@elastic/react-search-ui", "@elastic/enterprise-search", "from 'elasticsearch'", "require('elasticsearch')", "from elasticsearch", "import elasticsearch", "elasticsearch_serverless", "go-elasticsearch"]
    monitoring: ["elastic-apm-node", "@elastic/apm-rum", "@elastic/opentelemetry-node", "elasticapm", "elasticotel", "go.elastic.co/apm"]
pages:
  pricing: https://www.elastic.co/pricing
  hosted_pricing: https://www.elastic.co/pricing/cloud-hosted
  serverless_search: https://www.elastic.co/pricing/serverless-search
  serverless_observability: https://www.elastic.co/pricing/serverless-observability
  pricing_faq: https://www.elastic.co/pricing/faq
  hosted_billing: https://www.elastic.co/docs/deploy-manage/cloud-organization/billing/cloud-hosted-deployment-billing-dimensions
  search_billing: https://www.elastic.co/docs/deploy-manage/cloud-organization/billing/elasticsearch-billing-dimensions
  observability_billing: https://www.elastic.co/docs/deploy-manage/cloud-organization/billing/elastic-observability-billing-dimensions
  billing_faq: https://www.elastic.co/docs/deploy-manage/cloud-organization/billing/billing-faq
  budgets: https://www.elastic.co/docs/deploy-manage/cloud-organization/billing/manage-billing-notifications
  trial: https://www.elastic.co/docs/deploy-manage/deploy/elastic-cloud/create-an-organization
  autoscaling: https://www.elastic.co/docs/deploy-manage/autoscaling/autoscaling-in-ece-and-ech
  regions: https://www.elastic.co/docs/reference/cloud/cloud-hosted/regions
  apm_sampling: https://www.elastic.co/docs/solutions/observability/apm/transaction-sampling
  security: https://www.elastic.co/trust
  dpa: https://www.elastic.co/pdf/v100623-0-elastic-customer-dpa.pdf
read:
  - which product is used, i.e. Hosted deployments (resource-based) or Serverless projects (usage-based: Search, Observability, Security)
  - Hosted, i.e. subscription tier (Standard, Gold, Platinum, Enterprise) and the features it gates; capacity billed per GB of RAM per hour by instance type and zones (three zones cost three times); data out and inter-node transfer, snapshot storage and requests beyond free allowances
  - Serverless Search, i.e. ingest, search and ML VCU-hours, storage and egress; search VCUs never scale to zero (an idle baseline set by Search Power)
  - Serverless Observability and Security, i.e. ingest and retention per GB measured on enriched, uncompressed data; metrics priced separately
  - what happens at a limit, i.e. everything bills on demand with no cap; budgets email at fixed thresholds; autoscaling stops at the maximum size per zone
  - support charged as a share of usage on higher tiers; token and Agent Builder or Workflows executions beyond free allowances
  - trial, i.e. resources suspended when it ends and deleted with their data 30 days later
  - region fixed per deployment or project; marketplace organizations use only their cloud's regions
  - SOC 2, ISO 27001, FedRAMP, HIPAA, the DPA
usage_questions:
  - metric: monthly_bill
    ask: Month-to-date usage, last invoice, subscription tier and budgets?
    where: cloud.elastic.co → Billing → Usage (group by product or resource), Billing history, Budgets and notifications
  - metric: instances
    ask: Size per zone, number of zones and autoscaling maximum of each Hosted deployment?
    where: deployment → Edit (current and maximum size per zone)
  - metric: logs_ingested_gb
    ask: Serverless ingest and retention GB this month, by project?
    where: Billing → Usage, by project
  - metric: region
    ask: Which provider and region does each deployment or project use?
    where: deployment or project overview
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - delete idle and trial deployments, and right-size capacity and zone count
  - move old data off the hot tier with lifecycle policies or data stream retention
  - drop unneeded replicas and oversharded small indices; prune old snapshots
  - set a maximum size per zone for autoscaling (ML autoscaling is on by default)
  - lower the APM transaction sample rate (default is every transaction) or use tail sampling
  - on Serverless Search, lower Search Power and the boost window; on Observability, drop noisy logs and set retention per data stream
verified: 2026-10-11
---

- Detection cannot tell Elastic Cloud from self-managed Elasticsearch. Cloud shows as `ELASTIC_CLOUD_ID`, a `cloud: { id }` / `cloud_id` / `CloudID` client option, `serverMode` serverless, the serverless clients, or hosts ending in `elastic-cloud.com`, `cloud.es.io`, `found.io` (Hosted) or `elastic.cloud` (Serverless). Elasticsearch images in compose, `localhost:9200`, ECK or Helm mean self-managed: Elastic then costs nothing, so audit the host. OpenSearch (`@opensearch-project/opensearch`, `opensearch-py`, `es.amazonaws.com`) is a different vendor.
- The `search` and `monitoring` roles count only when the code uses the search clients or the APM agents. Agents started from package scripts, `NODE_OPTIONS` or `opentelemetry-instrument` leave no code signal: ask.
- `@elastic/eui`, `@elastic/charts` and the ECS log formatters are not service signals. Docs serve markdown at `<url>.md`; the Hosted price calculator renders only in a browser.
- The Agent Builder MCP endpoint has write-capable tools and no read-only switch; the older Elasticsearch MCP server is deprecated, and both search and ES|QL tools return documents. Neither has billing tools. Ask the user for numbers instead.
- Elasticsearch next to Algolia or another search service, or Elastic APM next to Datadog, New Relic or Grafana Cloud, is Overlap unless split on purpose.
