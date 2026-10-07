---
# generated, edit catalog/vendors/gemini.md (then run: node tools/sync.mjs)
schema: 1
id: gemini
name: Google Gemini
roles: [ai]
detect:
  packages: ["@google/genai", "@google/generative-ai", "@ai-sdk/google", "@langchain/google-genai"]
  pypi: ["google-genai", "google-generativeai", "langchain-google-genai"]
  go: ["google.golang.org/genai", "github.com/google/generative-ai-go"]
  imports: ["@google/genai", "@google/generative-ai", "@langchain/google-genai"]
  env_prefixes: ["GEMINI_", "NEXT_PUBLIC_GEMINI_", "VITE_GEMINI_", "GOOGLE_GENERATIVE_AI_"]
  config_files: []
pages:
  pricing: https://ai.google.dev/gemini-api/docs/pricing
  rate_limits: https://ai.google.dev/gemini-api/docs/rate-limits
  billing: https://ai.google.dev/gemini-api/docs/billing
  models: https://ai.google.dev/gemini-api/docs/models
  deprecations: https://ai.google.dev/gemini-api/docs/deprecations
  terms: https://ai.google.dev/gemini-api/terms
  abuse_monitoring: https://ai.google.dev/gemini-api/docs/usage-policies
  available_regions: https://ai.google.dev/gemini-api/docs/available-regions
  regions: https://firebase.google.com/docs/ai-logic/locations
  dpa: https://business.safety.google/processorterms/
  dpa_services: https://business.safety.google/services/
read:
  - price per million input and output tokens for each model the code calls, and whether the price steps up above a prompt-length threshold
  - Batch API discount, context caching price and cache storage per hour, and Grounding with Google Search allowance and per-request charge
  - the "Used to improve our products" row on the pricing page for the Free and Paid tier (Free tier content may be used to improve Google products and read by human reviewers; Paid tier is not)
  - rate limits per model and tier (RPM, TPM, RPD), that they apply per project and not per API key, when RPD resets, and which preview models have tighter limits
  - usage tiers (Free, Tier 1 to 3), what moves a project up (billing linked, cumulative spend, days since first payment), and the monthly spend limit per tier
  - Prepay versus Postpay billing, project-level monthly spend caps, what a cap pauses, and the enforcement delay during which overage can still accrue (Batch and agent sessions can run past the cap)
  - Terms: Unpaid versus Paid Services data use, and the rule that apps offered to users in the EEA, Switzerland or the UK must use Paid Services
  - abuse-monitoring retention of prompts and outputs on the Paid tier, and whether any zero-retention option exists for the Developer API
  - processing location: the Developer API serves from a global pool with no region choice (region-pinned processing is a Vertex AI feature); the available-regions page lists only countries where the API may be used
  - DPA: whether "Gemini API Paid Services" is listed as a processor service; certifications are published for Vertex AI and Google Cloud, not separately for the Developer API, so check scope before claiming SOC 2 or ISO 27001
usage_questions:
  - metric: billing_plan
    ask: Is Cloud Billing linked to the project that holds the production API key (Paid tier), or is it on the Free tier? Which billing tier does it show?
    where: aistudio.google.com → Projects (Billing Tier column); billing setup from API keys or Projects → Set up billing
  - metric: monthly_tokens
    ask: Requests and input and output tokens last month, per model?
    where: aistudio.google.com → Dashboard → Usage (select the project and date range)
  - metric: monthly_bill
    ask: Gemini API spend last month, and is a monthly spend cap set on the project?
    where: aistudio.google.com → Spend (Monthly spend cap → Edit spend cap); cost breakdown in Google Cloud console → Billing → Reports
  - metric: usage_tier
    ask: What rate limits (RPM, TPM, RPD) does the project have for the models in use?
    where: aistudio.google.com → Dashboard → Usage (rate limits and quota section)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - link billing to the production project so traffic runs under Paid Services terms, and keep the Free tier for prototypes with non-sensitive data
  - set a monthly spend cap per project and leave headroom for the enforcement delay
  - cache long, stable context (system instructions, documents) with context caching
  - route simple calls (classification, extraction, short replies) to a smaller Flash or Flash-Lite model
  - move offline jobs (evals, backfills, embeddings) to the Batch API
  - cap max output tokens and thinking budget per call
  - split traffic across projects only where limits allow it, since all keys in one project share the same rate limits
  - pin a stable model version rather than a preview or alias and track its shutdown date
verified: 2026-10-07
---

- Free and Paid tiers have different data terms, not just different limits. On the Free tier Google may use prompts and responses to improve its products and human reviewers may read them; on the Paid tier it does not, and keeps them only for abuse monitoring for a limited period. Under the Terms, apps serving users in the EEA, Switzerland or the UK must use Paid Services. A production app with personal data on a Free-tier key is a Requirement finding. Quote the current wording from the Terms page.
- The tier belongs to the Google Cloud project, not the key. Every key in a project shares one set of rate limits, and the billing tier comes from cumulative spend across the linked Cloud Billing account. A new project starts low, so a launch spike can hit RPM or RPD before any budget does; flag it as a Risk.
- Vertex AI (`@google-cloud/vertexai`, `@ai-sdk/google-vertex`, `google-cloud-aiplatform`) is billed by Google Cloud under Cloud terms, with regional endpoints and Cloud certifications. It is not covered by this map. `@google/genai` and `google-genai` can call either backend: `vertexai: true` in the client options or `GOOGLE_GENAI_USE_VERTEXAI` in env means Vertex, so check before reading this map's pages. Firebase AI Logic can also use either backend.
- `GOOGLE_API_KEY` is also used by many other Google APIs, so it is not a signal here. `@google/generative-ai`, `google-generativeai` and `github.com/google/generative-ai-go` are the deprecated older SDKs; finding them can also point to a migration task.
- No official MCP server gives read access to Gemini API usage or billing, so ask the user for the numbers. Two LLM providers in one codebase can be a deliberate fallback; ask before calling it an Overlap.
