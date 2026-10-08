---
schema: 1
id: openai
name: OpenAI
roles: [ai]
detect:
  packages: ["openai", "@openai/agents", "@ai-sdk/openai", "@langchain/openai"]
  pypi: ["openai", "openai-agents", "langchain-openai", "llama-index-llms-openai", "llama-index-embeddings-openai"]
  go: ["github.com/openai/openai-go", "github.com/sashabaranov/go-openai"]
  imports: ["openai", "@openai/agents", "@ai-sdk/openai", "@langchain/openai"]
  env_prefixes: ["OPENAI_"]
  config_files: []
pages:
  pricing: https://developers.openai.com/api/docs/pricing
  rate_limits: https://developers.openai.com/api/docs/guides/rate-limits
  models: https://developers.openai.com/api/docs/models
  deprecations: https://developers.openai.com/api/docs/deprecations
  data_controls: https://developers.openai.com/api/docs/guides/your-data
  security: https://trust.openai.com/
  status: https://status.openai.com/
read:
  - price per million input, cached input and output tokens for each model the code calls
  - Batch and Flex discounts, and the Fast (formerly Priority) processing premium
  - usage tiers and what moves an organization up (cumulative paid credit), and the monthly usage ceiling per tier
  - rate limits per tier and model (RPM, TPM, RPD, TPD); a low tier on launch day is a Risk
  - monthly budget alerts and hard limits per organization and per project, and what a hard limit blocks
  - default abuse-monitoring retention, whether API data is used for training, and how Zero Data Retention or Modified Abuse Monitoring is approved
  - data residency regions (set per project at creation), which regions also process inference in-region, and the regional pricing uplift
  - certifications (SOC 2 Type 2, ISO 27001 family) and the DPA listed in the trust portal
  - deprecation and shutdown dates for the pinned model snapshots and their recommended replacements
usage_questions:
  - metric: monthly_bill
    ask: API spend last month, and the month before?
    where: platform.openai.com → Usage (sidebar), Cost view, date range by month; Export gives a CSV
  - metric: monthly_tokens
    ask: Input and output tokens last month, per model?
    where: platform.openai.com → Usage (sidebar), group by model
  - metric: usage_tier
    ask: Which usage tier is the organization on, and what are the rate limits for the models in use?
    where: platform.openai.com → Settings → Organization → Limits (Usage tier and Rate limits sections)
  - metric: data_retention
    ask: Is Zero Data Retention or Modified Abuse Monitoring on, and which data residency region is the production project in?
    where: platform.openai.com → Settings → Organization → Data controls → Data retention; region shown in the project settings
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - cache stable prompt prefixes (system prompt, tool definitions) so repeated input is billed at the cached rate
  - route simple calls (classification, extraction, short replies) to a smaller model
  - move offline jobs (evals, backfills, embeddings) to the Batch API or Flex
  - cap max output tokens per call and per user
  - set a monthly budget alert and a hard limit per project
  - check the usage tier and request or prepay into a higher tier before launch
  - pin a model snapshot and track its deprecation date
verified: 2026-10-08
---

- The `openai` SDK also talks to other providers (OpenRouter, Groq, DeepSeek, a local model) when `OPENAI_BASE_URL` or a `baseURL` option points elsewhere: if one is set, ask which provider it is before reading OpenAI's pages.
- `openai` is also an English word in imports and comments; trust the package.json entry first. Azure OpenAI (`@azure/openai`, `AZURE_OPENAI_*`) is billed by Azure, not by this map.
- Cost grows per user and per request (tokens in and out), not as a flat plan. Estimate tokens per request × requests per user × users, and read prices for the exact model. Rate limits follow the usage tier, and a new organization starts low. A launch spike can hit RPM or TPM limits before any budget; flag it as a Risk.
- Training use, retention (ZDR) and data residency are Requirement questions: compare them with the project's data rules, not with the bill.
- OpenAI has a docs-only MCP server (`https://developers.openai.com/mcp`, search and read docs). It holds no account data; no official account MCP exists, so ask the user for numbers.
- Two LLM providers in one codebase (OpenAI and Anthropic) can be a deliberate fallback or per-task routing; ask before calling it an Overlap.
