---
schema: 1
id: algolia
name: Algolia
roles: [search]
detect:
  packages: ["algoliasearch", "@algolia/", "instantsearch.js", "react-instantsearch", "react-instantsearch-core", "react-instantsearch-nextjs", "react-instantsearch-router-nextjs", "react-instantsearch-hooks", "react-instantsearch-dom", "vue-instantsearch", "angular-instantsearch", "algoliasearch-helper", "@docsearch/", "search-insights"]
  pypi: ["algoliasearch", "algoliasearch-django"]
  go: ["github.com/algolia/algoliasearch-client-go"]
  imports: ["algoliasearch", "@algolia/", "instantsearch.js", "react-instantsearch", "react-instantsearch-core", "react-instantsearch-nextjs", "react-instantsearch-router-nextjs", "react-instantsearch-hooks", "react-instantsearch-dom", "vue-instantsearch", "angular-instantsearch", "algoliasearch-helper", "@docsearch/", "search-insights"]
  env_prefixes: ["ALGOLIA_", "NEXT_PUBLIC_ALGOLIA_", "VITE_ALGOLIA_", "NUXT_PUBLIC_ALGOLIA_", "PUBLIC_ALGOLIA_", "GATSBY_ALGOLIA_", "REACT_APP_ALGOLIA_"]
  config_files: []
pages:
  pricing: https://www.algolia.com/pricing/
  free_terms: https://www.algolia.com/policies/free-plan-details
  grow_terms: https://www.algolia.com/policies/grow-plan-specific-terms
  limits: https://www.algolia.com/doc/guides/scaling/algolia-service-limits
  counting: https://support.algolia.com/hc/en-us/articles/17245378392977-How-does-Algolia-count-search-requests-operations-and-records
  free_blocked: https://support.algolia.com/hc/en-us/articles/13646265384977-Why-is-my-Free-application-blocked
  cost_monitoring: https://support.algolia.com/hc/en-us/articles/11892882592529-How-can-I-monitor-my-application-s-monthly-costs
  track_usage: https://www.algolia.com/doc/guides/going-to-production/track-usage
  replicas: https://www.algolia.com/doc/guides/managing-results/refine-results/sorting/in-depth/replicas-impact-on-pricing
  optimize_requests: https://www.algolia.com/doc/guides/building-search-ui/going-further/optimize-search-request-usage/js
  rate_limited_keys: https://support.algolia.com/hc/en-us/articles/15434270755985-Why-is-it-important-to-create-a-rate-limited-API-Key
  docsearch: https://docsearch.algolia.com/docs/docsearch-program/
  regions: https://support.algolia.com/hc/en-us/articles/4406981912977-Where-are-classic-clusters-and-servers-located
  move_region: https://support.algolia.com/hc/en-us/articles/4406981834001-How-can-I-move-my-application-to-another-region
  mcp: https://www.algolia.com/doc/guides/model-context-protocol/productivity-mcp
  security: https://www.algolia.com/distributed-secure/security-compliance/measures/
  dpa: https://www.algolia.com/policies/data-processing-addendum
read:
  - plans (Free, Grow, Grow Plus, Elevate; legacy Build, Standard and Premium) and the search requests, records, Recommend requests and crawls each includes; overage per 1,000 on Grow and Grow Plus
  - what a search request is, i.e. one network call (up to 50 bundled queries); every keystroke, empty query on load, refinement, page change and facet search counts; Analytics counts fewer searches than billing
  - records, i.e. the total across indices with each standard replica counting again (virtual replicas do not); billed on the highest count of the month after dropping the three highest days
  - what happens at a limit, i.e. a Free app over quota is blocked until the next cycle; Grow bills overage monthly with no cap; a budget under Cost Management only notifies
  - plan-gated features (AI ranking and synonyms, personalization, NeuralSearch on Elevate), analytics retention, record size, indices per application
  - DocSearch, a free program for public docs with its own caps and the Algolia logo
  - region chosen at app creation (US, UK, EU West on self-serve plans); moving needs support
  - SOC 2 Type 2, ISO 27001 and 27017, the DPA; no HIPAA BAA documented
usage_questions:
  - metric: monthly_search_requests
    ask: Search requests this billing cycle and last, against the plan?
    where: dashboard → API Monitoring → Usage, or Billing → Usage
  - metric: records
    ask: Records across all indices, including standard replicas?
    where: dashboard → API Monitoring → Usage; Indices list
  - metric: monthly_bill
    ask: Plan, last invoice total and any budget set?
    where: Settings → Billing (subscription, Invoices, Cost Management)
mcp:
  official: true
  readonly_flag: "always read-only: Productivity MCP at https://mcp.algolia.com/mcp (OAuth, inherits the user's permissions; an owner turns it on under Generative AI → MCP Servers) has no write, key or billing tools"
  allowed_tools: [algolia_search_list_indices, algolia_analytics_number_of_searches, algolia_analytics_number_of_users]
common_fixes:
  - debounce search-as-you-type, set a minimum query length, and skip the empty search on page load
  - bundle queries to several indices into one multi-query request
  - use a search-only key with a per-IP rate limit, secured API keys and referrer restrictions so scrapers cannot run up requests
  - keep crawlers off filter and sort URLs with robots.txt and noindex
  - use virtual replicas for sorting where the plan allows, and index only the attributes that are searched or displayed
  - avoid frequent full reindexes into temporary indices, and set a budget under Cost Management
verified: 2026-10-11
---

- Algolia is detected from `algoliasearch`, `@algolia/`, the InstantSearch libraries, `@docsearch/`, `search-insights`, the Python, Django and Go clients and `ALGOLIA_*` names. Docusaurus and VitePress sites configure DocSearch in their site config without any of these, and Laravel or Rails apps show only `ALGOLIA_*` names: ask.
- `@docsearch/` usually means the free DocSearch program, not a paid plan; ask which plan the app is on.
- Docs pages serve markdown at `<url>.md`; support articles are also served as JSON at `https://support.algolia.com/api/v2/help_center/en-us/articles/<id>.json`. The pricing grid and the service-limits doc disagree on some Free limits; cite the pricing page.
- `algolia_search_list_indices` returns record counts per index, replicas included; do not add virtual replicas to the total. Analytics search counts are a lower bound on billed requests. Do not call the search, recommendation or top-search tools: they read records or end-user queries and may be billed.
- Algolia next to Meilisearch, Typesense, Elastic or another search service is Overlap unless split on purpose.
