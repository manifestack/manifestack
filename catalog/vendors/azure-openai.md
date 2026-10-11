---
schema: 1
id: azure-openai
name: Azure OpenAI and Foundry Models
family: azure
roles: [ai]
detect:
  packages: ["@azure/openai", "@azure-rest/ai-inference", "@azure/ai-projects", "@azure/ai-agents", "@ai-sdk/azure", "@anthropic-ai/foundry-sdk"]
  pypi: ["azure-ai-inference", "azure-ai-projects", "azure-ai-agents", "langchain-azure-ai", "llama-index-llms-azure-openai", "llama-index-embeddings-azure-openai"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"]
  imports: ["@azure/openai", "@azure-rest/ai-inference", "@azure/ai-projects", "@azure/ai-agents", "@ai-sdk/azure", "@anthropic-ai/foundry-sdk"]
  env_prefixes: ["AZURE_OPENAI_", "FOUNDRY_PROJECT_ENDPOINT", "ANTHROPIC_FOUNDRY_"]
  config_files: []
  service_signals: ["AzureOpenAI(", "AzureChatOpenAI", "AzureOpenAIEmbeddings", "createAzure(", "AnthropicFoundry", "azure_endpoint=", "azure_ad_token_provider", "azure.WithEndpoint(", "AZURE_OPENAI_", ".openai.azure.com", ".services.ai.azure.com", "azure.ai.inference", "azure.ai.projects", "azure.ai.agents", "\"azurerm_cognitive_deployment\"", "\"azurerm_cognitive_account_project\"", "\"azurerm_ai_foundry", "Microsoft.CognitiveServices/accounts/deployments", "Microsoft.CognitiveServices/accounts/projects", "cognitiveservices.Deployment("]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/azure-openai/
  deployment_types: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/deployment-types
  quotas: https://learn.microsoft.com/en-us/azure/foundry/openai/quotas-limits
  quota_management: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/quota
  provisioned: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/provisioned-throughput
  provisioned_billing: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/provisioned-throughput-billing
  batch: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch
  fine_tuning_cost: https://learn.microsoft.com/en-us/azure/foundry/fine-tuning/cost-management
  fine_tuning_deploy: https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/fine-tuning-deploy
  models_by_azure: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure
  partner_models: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-from-partners
  retirements: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirements
  content_filter: https://learn.microsoft.com/en-us/azure/foundry-classic/foundry-models/concepts/content-filter
  data_privacy: https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy
  manage_costs: https://learn.microsoft.com/en-us/azure/foundry/concepts/manage-costs
read:
  - per-model input, cached input and output token prices by deployment type (Global, Data Zone, Regional Standard) for the models the code calls
  - Provisioned (Global, Data Zone, Regional) billed per PTU per hour while the deployment exists, used or not; deployments cannot be paused; monthly or yearly reservations cover a PTU count and do not follow resizing
  - Global and Data Zone Batch discount and the turnaround window
  - fine-tuning training per token or per hour, and the hourly hosting fee of each deployed fine-tuned model on Standard types; Developer deployments have no hosting fee and are removed after a day
  - Foundry Models sold directly by Azure versus models from partners and community, which bill through Azure Marketplace at the provider's price
  - quota in tokens per minute per subscription, region, model and deployment type; quota tiers that rise with usage; how increases are requested
  - data processing by deployment type (Global any region, Data Zone within US, EU or APAC, Regional within the geography); stored data stays in the resource's geography
  - prompts and completions not used for training nor shared with model providers; abuse monitoring and how modified abuse monitoring is approved
  - content filtering defaults and which settings need approval
  - retirement dates for the model versions in use and their replacements
usage_questions:
  - metric: monthly_bill
    ask: Azure OpenAI and Foundry Models cost last month, per deployment and meter?
    where: Azure portal → Cost Management → Cost analysis → filter the Foundry or Azure OpenAI resource, Group by Meter
  - metric: monthly_tokens
    ask: Prompt and generated tokens last month, per deployment?
    where: Azure OpenAI or Foundry resource → Monitoring → Metrics (ProcessedPromptTokens, GeneratedTokens), Sum, split by ModelDeploymentName
  - metric: deployments
    ask: Which deployments exist, with deployment type, model version and TPM or PTU each, including fine-tuned and provisioned ones?
    where: Foundry portal → Build → Models (classic portal: project → Models + endpoints); Azure portal → resource → Model deployments
  - metric: usage_tier
    ask: Quota per model and region against current use, and any 429 throttling?
    where: Foundry portal → Manage → Quota (classic portal: Management center → Quota); resource → Metrics (AzureOpenAIRequests split by StatusCode)
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with only the tools below (npx -y @azure/mcp@latest server start --read-only --tool foundryextensions_resource_get --tool foundryextensions_openai_models-list); sign in with a Reader identity"
  allowed_tools: [foundryextensions_resource_get, foundryextensions_openai_models-list]
common_fixes:
  - delete fine-tuned and provisioned deployments that are not serving traffic
  - put steady production load on Provisioned only after measuring utilization, then buy a reservation for the deployed PTUs
  - use Global Standard where data residency allows; Data Zone or Regional only when required
  - move offline jobs to Batch, cache stable prompt prefixes and cap output tokens
  - route simple calls to a smaller model and pin model versions with an upgrade plan before retirement
  - request quota before launch in the region and deployment type used
verified: 2026-10-11
---

- Most Azure OpenAI code uses the `openai` package (`AzureOpenAI`, `AsyncAzureOpenAI`, or `OpenAI` with a base URL ending in `/openai/v1`), which also finds the `openai` map. The `.openai.azure.com` host, `AZURE_OPENAI_*` names or the Azure classes decide: Azure bills it, not OpenAI. `@azure/openai` 2.x is only a types companion to `openai`; its 1.x betas are retired.
- A fine-tuned model deployed on a Standard type bills hosting every hour until deleted or auto-removed after a period without calls; provisioned deployments bill per PTU per hour until deleted. Both are Bill findings when idle.
- Claude on Foundry (`@anthropic-ai/foundry-sdk`, `AnthropicFoundry`, `ANTHROPIC_FOUNDRY_*`) and other Foundry models bill on Azure; `ANTHROPIC_FOUNDRY_*` also matches the `anthropic` map, so ask which one production uses.
- `.cognitiveservices.azure.com` and `"azurerm_cognitive_account"` also serve Speech, Vision and Language, so they are not signals here.
- Azure OpenAI next to OpenAI, Anthropic, Gemini or Bedrock may be routing or a fallback; ask before calling it Overlap.
- MCP: `foundryextensions_openai_chat-completions-create`, `create-completion` and `embeddings-create` are marked read-only but spend tokens; the separate Foundry MCP server (`mcp.ai.azure.com`) deploys models and runs evaluations. Do not call them.
