---
# generated, edit catalog/vendors/anthropic.md (then run: node tools/sync.mjs)
schema: 1
id: anthropic
name: Anthropic
roles: [ai]
detect:
  packages: ["@anthropic-ai/sdk", "@anthropic-ai/claude-agent-sdk", "@ai-sdk/anthropic", "@langchain/anthropic"]
  pypi: ["anthropic", "claude-agent-sdk", "langchain-anthropic", "llama-index-llms-anthropic"]
  go: ["github.com/anthropics/anthropic-sdk-go"]
  imports: ["@anthropic-ai/sdk", "@anthropic-ai/claude-agent-sdk", "@ai-sdk/anthropic", "@langchain/anthropic"]
  env_prefixes: ["ANTHROPIC_"]
  config_files: []
pages:
  pricing: https://platform.claude.com/docs/en/about-claude/pricing
  rate_limits: https://platform.claude.com/docs/en/api/rate-limits
  models: https://platform.claude.com/docs/en/models/overview
  deprecations: https://platform.claude.com/docs/en/about-claude/model-deprecations
  data_retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
  regions: https://platform.claude.com/docs/en/manage-claude/data-residency
  security: https://support.claude.com/en/articles/10015870-what-certifications-has-anthropic-obtained
  dpa: https://www.anthropic.com/legal/data-processing-addendum
  status: https://status.claude.com/
read:
  - price per million input and output tokens for each model the code calls, and cache write and cache read multipliers
  - Batch API discount, fast mode premium, and per-use server tool charges (web search, code execution)
  - usage tiers, how an organization moves up (usage history, or a request from the Limits page), and the monthly spend cap per tier
  - what happens at the spend cap (requests paused until next month) and at a self-set spend limit
  - rate limits per tier and model (RPM, ITPM, OTPM) and whether cached input counts toward ITPM; a low tier on launch day is a Risk
  - default retention of API inputs and outputs, training use, ZDR (approved per organization by sales) and which features are not ZDR-eligible
  - data residency: inference geo options per request, workspace geo (fixed at creation), and the pricing multiplier for US-only inference
  - certifications (SOC 2 Type II, ISO 27001, ISO 42001, HIPAA-ready with BAA) and the DPA
  - retirement dates for the models in use and the recommended replacements
usage_questions:
  - metric: monthly_bill
    ask: API spend last month, and the month before?
    where: Claude Console (platform.claude.com) → Cost
  - metric: monthly_tokens
    ask: Input, cached input and output tokens last month, per model?
    where: Claude Console (platform.claude.com) → Usage, group by model
  - metric: usage_tier
    ask: Which usage tier is the organization on, its monthly spend cap, and the rate limits for the models in use?
    where: Claude Console → Settings → Limits (tier and rate limits); Settings → Billing (spend cap and spend limit)
  - metric: data_retention
    ask: Is ZDR or HIPAA readiness enabled, and which inference geo do production requests use?
    where: Claude Console → Settings → Data retention; Settings → Workspaces (inference geo defaults)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - cache stable prompt prefixes (system prompt, tools, documents); cache reads cost less and do not count toward ITPM on most models
  - route simple calls to a smaller model
  - move offline jobs (evals, backfills, classification runs) to the Message Batches API
  - cap max_tokens per call and per user
  - set an organization spend limit and per-workspace spend and rate limits
  - request a higher tier from the Limits page before launch, and ramp traffic gradually
  - pin a model version and track its retirement date
verified: 2026-10-08
---

- Claude through Amazon Bedrock (`@anthropic-ai/bedrock-sdk`) or Google Cloud (`@anthropic-ai/vertex-sdk`) is billed and rate-limited by that cloud, not by this map; read the cloud's pricing instead.
- Cost grows per user and per request (tokens in and out), not as a flat plan. Estimate tokens per request × requests per user × users, and read prices for the exact model. Rate limits and the monthly spend cap follow the usage tier, and a new organization starts low. At the cap, requests return 429 until next month; flag a launch on a low tier as a Risk.
- Training use, retention (ZDR, models that require longer retention) and data residency are Requirement questions: compare them with the project's data rules, not with the bill.
- Anthropic has a docs-only MCP server (`https://platform.claude.com/docs/mcp`). It holds no account data; no official account MCP exists (community Admin API servers are not official), so ask the user for numbers.
- Two LLM providers in one codebase (Anthropic and OpenAI) can be a deliberate fallback or per-task routing; ask before calling it an Overlap.
