---
# generated, edit catalog/vendors/inngest.md (then run: node tools/sync.mjs)
schema: 1
id: inngest
name: Inngest
roles: [jobs]
detect:
  packages: ["inngest", "inngest-cli", "@inngest/"]
  pypi: ["inngest", "inngest-encryption"]
  go: ["github.com/inngest/inngestgo"]
  imports: ["inngest", "@inngest/"]
  env_prefixes: ["INNGEST_"]
  config_files: []
pages:
  pricing: https://www.inngest.com/pricing
  limits: https://www.inngest.com/docs/durable-execution/limits
  concurrency: https://www.inngest.com/docs/durable-execution/flow-control/concurrency
  bursty_concurrency: https://www.inngest.com/docs/durable-execution/flow-control/bursty-concurrency
  batching: https://www.inngest.com/docs/durable-execution/flow-control/batching
  debounce: https://www.inngest.com/docs/durable-execution/flow-control/debounce
  retries: https://www.inngest.com/docs/durable-execution/guides-and-advanced/error-handling/retries
  wait_for_event: https://www.inngest.com/docs/durable-execution/primitives/step-waitforevent
  environments: https://www.inngest.com/docs/platform-and-operations/environments-and-branch-deploys
  realtime_limits: https://www.inngest.com/docs/realtime/limits
  regions_security: https://www.inngest.com/docs/platform-and-operations/cloud-architecture-and-security
  self_hosting: https://www.inngest.com/docs/self-hosting
  mcp: https://www.inngest.com/docs/ai-dev-tools/mcp
  changelog: https://www.inngest.com/changelog
  security: https://www.inngest.com/security
read:
  - plans (Free, Pro, Business, Enterprise) and the executions, concurrent steps, seats, workers, events, realtime and trace history each includes
  - what an execution is, i.e. one per function run plus one per step (a run with five steps uses six); retries and agent tool calls add more
  - what happens at a limit, i.e. Free pauses execution until an upgrade with no overage; Pro and Business bill tiered overage per execution and for seats, events and span data; steps above the concurrency limit wait in a queue
  - maximum run length per plan, which includes sleeps and waits
  - every environment except local dev is billed, and active branch deploys are capped per plan
  - concurrency add-on blocks on Pro and bursty concurrency on Pro and above
  - realtime connections and messages per day, counted per publish
  - billing through Vercel for accounts created from the Vercel Marketplace
  - US-only cloud regions (no EU option documented), SOC 2 Type II, a signed DPA on paid plans on request, and the HIPAA BAA add-on
usage_questions:
  - metric: monthly_executions
    ask: Executions this month and last month, against the plan?
    where: Billing → Usage (app.inngest.com/billing/usage; Executions, Runs or Steps, this or last month)
  - metric: monthly_bill
    ask: Current plan, next invoice amount and the concurrency limit?
    where: Billing → Overview (plan, next invoice, executions bar, concurrent steps, seats); Vercel → Billing for Marketplace accounts
  - metric: concurrency
    ask: How often do steps queue behind the concurrency limit?
    where: function → Metrics (throughput and backlog)
mcp:
  official: true
  readonly_flag: "grant read permissions only, for one environment, on the OAuth consent screen of https://api.inngest.com/mcp (or use an API key created with read permissions)"
  allowed_tools: [list_envs, get_apps, get_app, list_functions, get_function, list_runs, list_function_runs, list_insights_tables]
common_fixes:
  - merge steps that do not need their own retry into one step, since each step is an execution
  - batch events into one run instead of fanning out a run per event, and debounce bursts of updates
  - use rate limiting where dropped runs are fine, and throttling only where every run must happen
  - throw NonRetriableError for permanent failures and lower retries on functions that fail often
  - use step.waitForEvent instead of sleep-and-check polling loops
  - lower cron frequency and archive unused branch environments
  - check bursty concurrency and add-on blocks before moving to a bigger plan
verified: 2026-10-11
---

- Inngest is detected from `inngest`, `inngest-cli`, `@inngest/`, the Python and Go SDKs and `INNGEST_*` names. The same key names are used by a self-hosted server (`inngest/inngest` image, `INNGEST_BASE_URL` pointing at your own host, a `.inngest/` folder) and by the local Dev Server (`INNGEST_DEV=1`), neither billed by Inngest: ask where it runs.
- Each step is an HTTP request to the app on serverless hosts, so many steps also raise the Vercel or Lambda bill.
- Docs are also served as markdown at `https://www.inngest.com/docs-markdown/<path>`. The trust center renders only in a browser. Enterprise trace history differs between the pricing page and the limits doc; cite the pricing page.
- The Cloud MCP server has no usage or billing tool. With an API key, `fetch_account_event_keys` and `fetch_account_signing_keys` return keys and `list_webhooks` returns URLs with the ingest key: never call them. Do not call `get_run`, `get_run_trace`, `query_insights` or `fetch_account` (payloads, event data, email). If `send_event`, `invoke_function`, `rerun` or `cancel_run` are listed, the session has write access: do not use it.
- Inngest next to Trigger.dev, Upstash QStash or another job runner is Overlap unless split on purpose.
