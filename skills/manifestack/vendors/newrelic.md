---
# generated, edit catalog/vendors/newrelic.md (then run: node tools/sync.mjs)
schema: 1
id: newrelic
name: New Relic
roles: [monitoring]
detect:
  packages: ["newrelic", "@newrelic/", "newrelic-react-native-agent", "serverless-newrelic-lambda-layers", "gatsby-plugin-newrelic"]
  pypi: ["newrelic", "newrelic-telemetry-sdk", "newrelic-lambda", "newrelic-lambda-cli"]
  go: ["github.com/newrelic/go-agent", "github.com/newrelic/newrelic-telemetry-sdk-go"]
  imports: ["newrelic", "@newrelic/", "newrelic-react-native-agent"]
  env_prefixes: ["NEW_RELIC_", "NRIA_", "NEXT_PUBLIC_NEW_RELIC_", "VITE_NEW_RELIC_", "REACT_APP_NEW_RELIC_", "PUBLIC_NEW_RELIC_"]
  config_files: ["newrelic.js", "newrelic.cjs", "newrelic.mjs", "newrelic.ini", "newrelic.yml", "newrelic-infra.yml"]
pages:
  pricing: https://newrelic.com/pricing
  free_tier: https://newrelic.com/pricing/free-tier
  compute: https://newrelic.com/pricing/compute
  billing: https://docs.newrelic.com/docs/accounts/accounts-billing/new-relic-one-pricing-billing/new-relic-one-pricing-billing
  usage_plan: https://docs.newrelic.com/docs/licenses/license-information/usage-plans/new-relic-usage-plan
  usage_ui: https://docs.newrelic.com/docs/accounts/accounts-billing/new-relic-one-pricing-billing/usage-ui
  usage_queries: https://docs.newrelic.com/docs/accounts/accounts-billing/new-relic-one-pricing-billing/usage-queries-alerts
  retention: https://docs.newrelic.com/docs/data-apis/manage-data/manage-data-retention
  ingest_budgets: https://docs.newrelic.com/docs/data-apis/manage-data/data-ingest-budgets/overview
  optimize_ingest: https://docs.newrelic.com/docs/new-relic-solutions/observability-maturity/operational-efficiency/data-governance-optimize-ingest-guide
  drop_rules_eol: https://docs.newrelic.com/eol/2025/05/drop-rule-filter
  pipeline_costs: https://docs.newrelic.com/docs/new-relic-control/pipeline-control/costs
  regions: https://docs.newrelic.com/docs/accounts/accounts-billing/account-setup/choose-your-data-center
  compliance: https://docs.newrelic.com/docs/security/security-privacy/compliance/regulatory-audits-new-relic-services
  hipaa: https://docs.newrelic.com/docs/security/security-privacy/compliance/hipaa-readiness-new-relic
  mcp: https://docs.newrelic.com/docs/agentic-ai/mcp/overview
  dpa: https://newrelic.com/termsandconditions/dataprotection
read:
  - editions (Free, Standard, Pro, Enterprise), data options (Original data, Data Plus) and user types (Basic free, Core, Full platform); the full platform user cap on Standard
  - billing by GB ingested beyond the free allowance, and per user at the highest type held in the month (pending invites count); or Core Compute billed per CCU with unlimited users
  - free tier, i.e. GB ingest per month, full platform users, synthetic checks; past it ingest stops and the platform is locked until the next month or an upgrade
  - paid plans bill all usage in arrears with no cap; ingest and compute budgets only alert
  - retention per data type, Data Plus extra retention, extended retention and Live Archives add-ons
  - Advanced Compute (aCCU) for AI features, Pipeline Control and drop rules on new accounts; NRQL drop rules are being retired
  - the EU data center surcharge; region (US, EU, JP) fixed per organization
  - SOC 2, ISO 27001, PCI DSS, FedRAMP Moderate, the HIPAA BAA on Enterprise with Data Plus, the DPA
usage_questions:
  - metric: ingest_gb
    ask: GB ingested this month and the top sources?
    where: Administration → Usage Summary → Data ingest → View details; or NRQL on NrMTDConsumption (GigabytesIngested)
  - metric: users
    ask: Billable full platform and core users this month?
    where: Administration → User management (user type); Usage Summary
  - metric: monthly_bill
    ask: Edition, data option, pay-as-you-go or commitment, and the last invoice?
    where: user menu → Manage your plan
  - metric: region
    ask: Which data center does the organization use?
    where: the UI host (one.newrelic.com, one.eu.newrelic.com, one.jp.newrelic.com)
mcp:
  official: true
  readonly_flag: "read-only by design: the remote server https://mcp.newrelic.com/mcp/ (EU and JP hosts) has no write tools; connect with OAuth (scope observability:read) as a user with Organization Read Only"
  allowed_tools: [list_available_new_relic_accounts, execute_nrql_query]
common_fixes:
  - turn off APM log forwarding where logs already go elsewhere, and keep debug logs out of production
  - sample infrastructure process metrics less often or turn them off outside production
  - filter data at the source (agent config, OpenTelemetry Collector) rather than with server-side drop rules
  - keep most people as Basic users and downgrade full platform users before the month ends
  - remove user and request IDs from metric attributes to stay under cardinality limits
  - lower browser session replay sampling, and buy Data Plus only for compliance or longer retention
  - set ingest budgets with alerts on paid plans and add a card before the free limit
verified: 2026-10-11
---

- New Relic is detected from the `newrelic` agents (Node, Python), `@newrelic/` (browser agent and plugins), the React Native, Lambda and Gatsby packages, `go-agent`, `NEW_RELIC_*` and `NRIA_*` names and agent config files (`newrelic.js`, `newrelic.ini`, `newrelic.yml`, `newrelic-infra.yml`). OpenTelemetry export to New Relic (`otlp.nr-data.net`) uses generic env names and is not detected: ask.
- Docs pages serve markdown at `<url>.md`; the index is `https://docs.newrelic.com/llms.txt`. The old data-options page returns 404; Data Plus facts are on the pricing page. The pricing FAQ disagrees with itself on synthetics; cite the pricing page.
- With the MCP server, run `execute_nrql_query` only on usage event types (`NrMTDConsumption`, `NrConsumption`), for example GB ingested and billable users; never query Log, Span or Transaction data. Tool calls are metered as compute on Compute plans; avoid the AI report tools (Advanced Compute).
- New Relic next to Datadog, Grafana Cloud or Sentry for the same signals is Overlap unless split on purpose.
