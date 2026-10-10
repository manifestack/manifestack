---
schema: 1
id: openrouter
name: OpenRouter
roles: [ai]
detect:
  packages: ["@openrouter/", "@langchain/openrouter", "@tanstack/ai-openrouter"]
  pypi: ["openrouter", "openrouter-agent-sdk", "langchain-openrouter", "llama-index-llms-openrouter"]
  go: ["github.com/OpenRouterTeam"]
  imports: ["@openrouter/", "@langchain/openrouter", "@tanstack/ai-openrouter"]
  env_prefixes: ["OPENROUTER_"]
  config_files: []
pages:
  pricing: https://openrouter.ai/pricing
  models: https://openrouter.ai/models
  models_api: https://openrouter.ai/api/v1/models
  faq: https://openrouter.ai/docs/faq
  limits: https://openrouter.ai/docs/api_reference/limits
  byok: https://openrouter.ai/docs/guides/overview/auth/byok
  provider_routing: https://openrouter.ai/docs/guides/routing/provider-selection
  model_fallbacks: https://openrouter.ai/docs/guides/routing/model-fallbacks
  service_tiers: https://openrouter.ai/docs/guides/features/service-tiers
  prompt_caching: https://openrouter.ai/docs/guides/best-practices/prompt-caching
  spend_controls: https://openrouter.ai/docs/guides/best-practices/spend-controls
  notifications: https://openrouter.ai/docs/guides/features/notifications
  provider_logging: https://openrouter.ai/docs/guides/privacy/provider-logging
  zdr: https://openrouter.ai/docs/guides/features/zdr
  in_region: https://openrouter.ai/docs/guides/features/in-region-routing
  terms: https://openrouter.ai/terms
  security: https://trust.openrouter.ai/
read:
  - prepaid credits with manual or automatic top-up, the platform fee on each credit purchase by plan (Standard, Business, Enterprise) and payment method, credit expiry and the refund window
  - inference passed through at each provider's price; the same model costs different amounts on different providers
  - BYOK fee as a share of the equivalent OpenRouter cost above a monthly allowance by plan, and that BYOK falls back to shared capacity (paid from credits) unless turned off
  - free model variants with per-minute and per-day request limits that depend on credits ever bought
  - what happens at a limit, i.e. a negative balance returns 402 even on free models; key credit limits, guardrail and workspace budgets return 402 or 403
  - no platform rate limit on paid models; provider rate limits pass through and trigger fallback to other providers
  - default price-weighted routing, and what sort, max_price, fallbacks, :floor, :nitro and service tiers change in the price paid
  - prompt caching passed through per provider (some need cache_control), response caching and the Batch API
  - data policies, i.e. account settings that allow or block providers that train on or retain prompts, separately for free and paid models; zero data retention per request
  - in-region routing (EU, US) on Business and Enterprise only, with a surcharge on regional endpoints
  - SOC 2 Type 2 and the DPA on the trust portal
usage_questions:
  - metric: monthly_bill
    ask: Spend this month and last month, and the credits bought?
    where: Activity (openrouter.ai/activity) → Overview (spend, credits vs BYOK); balance and purchases under Settings → Credits
  - metric: tokens_month
    ask: Requests and tokens this month, by model?
    where: Activity → Overview (usage by model) or Explore with Group = Model; export to CSV from the options menu
  - metric: key_limits
    ask: Which API keys have a credit limit, and is auto top-up on?
    where: Settings → Keys (limit and reset per key); Settings → Credits (auto top-up)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set a credit limit with a reset period on every key, CI and agent keys included, and turn on the key spend alert
  - turn on the low balance alert alongside auto top-up so a negative balance does not stop production
  - pin routing with provider.max_price or sort by price, and keep fallback lists to models whose price is acceptable
  - avoid :nitro and the Auto Router where latency does not matter; bound the Auto Router with allowed models
  - set BYOK to never use shared capacity if spend must stay on your own provider keys
  - use prompt caching with a session ID for sticky routing, and the Batch API for offline jobs
  - keep production off free variants, whose request limits are low and whose providers may log prompts
verified: 2026-10-11
---

- OpenRouter is often called through the OpenAI SDK with `baseURL` set to `https://openrouter.ai/api/v1` (or `eu.` / `us.openrouter.ai`). That is detected through `OPENROUTER_*` names in `.env` files; a hardcoded base URL with `OPENAI_API_KEY` is not, so check the OpenAI client's base URL in the code before treating the project as an OpenAI customer.
- OpenRouter next to OpenAI, Anthropic or Gemini is not an Overlap by itself: it can be a fallback or the way to reach other models. Ask which provider serves production traffic, and compare its direct price with the OpenRouter price plus the platform fee.
- Docs pages also serve markdown at `<url>.md`; the trust portal renders only in a browser.
- The OpenRouter MCP server (`https://mcp.openrouter.ai/mcp`, OAuth) has no read-only mode: `send-message` and `generate-image` spend credits, and sign-in creates an API key with a spend cap. Do not use it; ask the user for numbers instead.
