---
schema: 1
id: launchdarkly
name: LaunchDarkly
roles: [flags]
detect:
  packages: ["@launchdarkly/", "launchdarkly-js-client-sdk", "launchdarkly-react-client-sdk", "launchdarkly-node-server-sdk", "launchdarkly-node-client-sdk", "launchdarkly-vue-client-sdk", "@flags-sdk/launchdarkly", "@openfeature/launchdarkly-client-provider"]
  pypi: ["launchdarkly-server-sdk", "launchdarkly-server-sdk-ai", "launchdarkly-observability", "launchdarkly-openfeature-server", "ldclient-py", "ldclient"]
  go: ["github.com/launchdarkly/go-server-sdk", "gopkg.in/launchdarkly/go-server-sdk.v5", "gopkg.in/launchdarkly/go-server-sdk.v4"]
  imports: ["@launchdarkly/", "launchdarkly-js-client-sdk", "launchdarkly-react-client-sdk", "launchdarkly-node-server-sdk", "launchdarkly-node-client-sdk", "launchdarkly-vue-client-sdk", "@flags-sdk/launchdarkly", "@openfeature/launchdarkly-client-provider"]
  env_prefixes: ["LAUNCHDARKLY_", "NEXT_PUBLIC_LAUNCHDARKLY_", "VITE_LAUNCHDARKLY_", "REACT_APP_LAUNCHDARKLY_", "PUBLIC_LAUNCHDARKLY_", "LD_SDK_KEY", "LD_CLIENT_SIDE_ID", "LD_MOBILE_KEY", "LD_ACCESS_TOKEN", "NEXT_PUBLIC_LD_CLIENT", "VITE_LD_CLIENT", "PUBLIC_LD_CLIENT"]
  config_files: [".launchdarkly/coderefs.yaml"]
pages:
  pricing: https://launchdarkly.com/pricing/
  plans: https://launchdarkly.com/docs/home/account/plans
  calculating_billing: https://launchdarkly.com/docs/home/account/calculating-billing
  service_connections: https://launchdarkly.com/docs/home/account/service-connections
  usage_metrics: https://launchdarkly.com/docs/home/account/metrics
  billing_page: https://launchdarkly.com/docs/home/account/billing-page
  anonymous_contexts: https://launchdarkly.com/docs/home/flags/anonymous-contexts
  app_metadata: https://launchdarkly.com/docs/sdk/features/app-config
  eu: https://launchdarkly.com/docs/home/infrastructure/eu
  federal: https://launchdarkly.com/docs/home/infrastructure/federal
  mcp_local: https://launchdarkly.com/docs/home/getting-started/mcp-local
  security: https://launchdarkly.com/security/
  dpa: https://launchdarkly.com/policies/data-processing-addendum/
read:
  - plans (Developer free, Foundation pay as you go, Enterprise, the Guardian add-on; legacy seat-based plans) and the CodeControl (flags) and AgentControl (AI configs) tracks
  - meters, i.e. service connections (each server SDK instance per environment, counted in connection minutes; polling counts too), client-side MAU (unique context keys from client, edge and AI SDKs), Experimentation MAU or keys, AI runs, observability sessions, errors, logs and traces
  - what happens at a limit, i.e. Developer warns and then turns the account read-only (AI-run ingestion stops); Foundation and Enterprise bill overage monthly with no cap; MAU is never throttled
  - projects and environments per plan, and plan-gated features (approvals, scheduling, code references, custom roles, audit log, release monitoring)
  - special rates for Kubernetes, serverless, Python and Ruby workloads
  - EU and federal instances for Enterprise only
  - SOC 2 Type II, ISO 27001, FedRAMP, the DPA; HIPAA on Enterprise
usage_questions:
  - metric: service_connections
    ask: Service connections this month, by SDK, environment and app?
    where: Organization settings → Plan usage → Service connections (set applicationId so apps are named)
  - metric: mau
    ask: Client-side MAU this month, and the share of anonymous contexts?
    where: Organization settings → Plan usage → Client-side MAU
  - metric: monthly_bill
    ask: Plan, charges this month and the last invoice?
    where: Organization settings → Billing
mcp:
  official: true
  readonly_flag: "local @launchdarkly/mcp-server with --scope read and a Reader-role API token (--server-url for EU or federal); the hosted server is read-only only when authorized by a Reader member"
  allowed_tools: [list-feature-flags, get-flag-status-across-environments, get-code-references]
common_fixes:
  - create one SDK client per process at startup, never per request or per handler call
  - initialize serverless clients outside the handler, and use streaming rather than frequent polling
  - delay client-side init until the user is known, and let the SDK generate and persist anonymous keys so bots do not create new MAU
  - keep pre-production environments and workers that need no flags off the SDK
  - set applicationId to find which app uses connections, and remove stale flags
  - lower the sampling of online evaluations for AI configs
verified: 2026-10-11
---

- LaunchDarkly is detected from `@launchdarkly/` (server, client, edge, React Native, observability, MCP and CLI), the legacy `launchdarkly-*` packages, the Vercel Flags and OpenFeature adapters, the Python and Go SDKs, `LAUNCHDARKLY_*` and specific `LD_*` key names (never a bare `LD_`, which matches linker variables) and `.launchdarkly/coderefs.yaml`. PyPI `ldclient` is also an unrelated package; trust it only next to other signals.
- Every pod, replica, forked worker and serverless instance counts as a service connection, and a Relay Proxy does not reduce the count. A client created per request is the most common cause of a high bill.
- Docs serve markdown at `<url>.md`. The pricing page and the docs disagree on SSO and monthly billing for Foundation; cite the pricing page.
- On the local MCP server, never call `get-environments`: it returns the SDK key and mobile key. Neither server has a billing tool; the hosted one (`https://mcp.launchdarkly.com/mcp/launchdarkly`) has `get-service-connections-usage` but no read-only switch.
- LaunchDarkly next to PostHog or Mixpanel flags, Statsig, Unleash, Flagsmith, GrowthBook or another flag service is Overlap unless split on purpose.
