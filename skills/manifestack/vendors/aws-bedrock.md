---
# generated, edit catalog/vendors/aws-bedrock.md (then run: node tools/sync.mjs)
schema: 1
id: aws-bedrock
name: Amazon Bedrock
family: aws
roles: [ai]
detect:
  packages: ["@aws-sdk/client-bedrock-runtime", "@aws-sdk/client-bedrock", "@aws-sdk/client-bedrock-agent-runtime", "@aws-sdk/client-bedrock-agent", "@aws-sdk/client-bedrock-agentcore", "@ai-sdk/amazon-bedrock", "@langchain/aws", "@anthropic-ai/bedrock-sdk", "bedrock-agentcore", "@aws-cdk/aws-bedrock-alpha"]
  pypi: ["langchain-aws", "llama-index-llms-bedrock-converse", "bedrock-agentcore", "mypy-boto3-bedrock-runtime", "mypy-boto3-bedrock-agent-runtime"]
  go: ["github.com/aws/aws-sdk-go-v2/service/bedrockruntime", "github.com/aws/aws-sdk-go-v2/service/bedrock", "github.com/aws/aws-sdk-go-v2/service/bedrockagentruntime", "github.com/aws/aws-sdk-go-v2/service/bedrockagentcore", "github.com/anthropics/anthropic-sdk-go/bedrock"]
  imports: ["@aws-sdk/client-bedrock-runtime", "@aws-sdk/client-bedrock", "@aws-sdk/client-bedrock-agent-runtime", "@aws-sdk/client-bedrock-agent", "@aws-sdk/client-bedrock-agentcore", "@ai-sdk/amazon-bedrock", "@langchain/aws", "@anthropic-ai/bedrock-sdk", "bedrock-agentcore"]
  env_prefixes: ["AWS_BEARER_TOKEN_BEDROCK"]
  config_files: []
  service_signals: ["client('bedrock", "client(\"bedrock", "aws_bedrock", "AWS::Bedrock", "aws-cdk-lib/aws-bedrock", "AnthropicBedrock", "bedrock:Invoke", "arn:aws:bedrock:", "bedrock-runtime.", "bedrock-mantle.", "anthropic.claude-", "amazon.nova-", "amazon.titan-", "\"bedrock/", "'bedrock/"]
pages:
  pricing: https://aws.amazon.com/bedrock/pricing/
  service_tiers: https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html
  quotas: https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-runtime.html
  token_burndown: https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html
  model_access: https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
  cross_region: https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html
  model_lifecycle: https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle.html
  regions: https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html
  data_protection: https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
  agentcore_pricing: https://aws.amazon.com/bedrock/agentcore/pricing/
read:
  - per-model input, output, cache write and cache read token prices for the models the code calls, in the Region and inference profile used (global cross-Region profiles cost less than geographic or in-Region)
  - service tiers (Standard, Flex, Priority, Reserved) and the Batch discount; which models support each
  - Provisioned Throughput (per model unit per hour, with or without commitment) and Reserved tier capacity, both billed until deleted
  - Knowledge Bases, Guardrails, web search and AgentCore charges when the code uses them
  - per-model quotas (tokens per minute, requests per minute, cross-model tokens per day), the output token burndown rate, that new accounts may get lower values, and that increases are not automatic
  - model access: third-party models subscribed through AWS Marketplace on first call, the Anthropic first-time-use form, and legacy and end-of-life dates for the models in use
  - data use: content is not used to improve base models or shared with providers; invocation logging is off by default
usage_questions:
  - metric: monthly_bill
    ask: Bedrock spend last month, per model?
    where: Billing and Cost Management → Cost Explorer → Service Bedrock (and any AWS Marketplace model lines), group by Usage type
  - metric: monthly_tokens
    ask: Input, output and cached tokens last month, per model?
    where: CloudWatch → Metrics → AWS/Bedrock → By ModelId (InputTokenCount, OutputTokenCount, CacheReadInputTokenCount)
  - metric: usage_tier
    ask: Tokens-per-minute and tokens-per-day quotas for the models in use, and any throttling?
    where: Service Quotas → AWS services → Amazon Bedrock; CloudWatch → AWS/Bedrock → InvocationThrottles
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - use a global cross-Region inference profile when data residency allows
  - cache stable prompt prefixes and route simple calls to a smaller model
  - move offline jobs to batch inference or the Flex tier
  - set max_tokens close to real output; it reserves quota at request start
  - request quota increases before launch for the models and Regions in use
  - delete unused Provisioned Throughput and custom models
verified: 2026-10-11
---

- Claude through Bedrock (`@anthropic-ai/bedrock-sdk`, `AnthropicBedrock` in the Python SDK, the Go `bedrock` package) is billed and rate-limited by AWS: read this map, not `anthropic`. The Python client ships in `anthropic`, which also finds the Anthropic map; ask which one production uses.
- Model IDs such as `anthropic.claude-` and `us.anthropic.claude-` are Bedrock-only; LiteLLM uses a `bedrock/` prefix.
- The pricing page fills most prices in with JavaScript; read it in a browser or the Pricing Calculator.
- Bedrock next to OpenAI, Anthropic, Gemini or OpenRouter may be routing or a fallback; ask before calling it Overlap.
- AWS MCP servers for Bedrock (Knowledge Base retrieval, AgentCore) run queries or change resources and expose no usage; do not use them.
