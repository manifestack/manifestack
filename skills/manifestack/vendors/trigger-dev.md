---
# generated, edit catalog/vendors/trigger-dev.md (then run: node tools/sync.mjs)
schema: 1
id: trigger-dev
name: Trigger.dev
roles: [jobs]
detect:
  packages: ["@trigger.dev/", "trigger.dev"]
  imports: ["@trigger.dev/"]
  env_prefixes: ["TRIGGER_SECRET_KEY", "TRIGGER_ACCESS_TOKEN", "TRIGGER_API_URL", "TRIGGER_PROJECT_REF", "TRIGGER_PREVIEW_BRANCH"]
  config_files: ["trigger.config.ts", "trigger.config.js", "trigger.config.mjs"]
pages:
  pricing: https://trigger.dev/pricing
  limits: https://trigger.dev/docs/limits
  billing_limits: https://trigger.dev/docs/billing-limits
  reduce_spend: https://trigger.dev/docs/how-to-reduce-your-spend
  machines: https://trigger.dev/docs/machines
  run_usage: https://trigger.dev/docs/run-usage
  concurrency: https://trigger.dev/docs/concurrency
  max_duration: https://trigger.dev/docs/runs/max-duration
  schedules: https://trigger.dev/docs/tasks/scheduled
  regions: https://trigger.dev/docs/triggering
  self_hosting: https://trigger.dev/docs/self-hosting/overview
  mcp: https://trigger.dev/docs/mcp-introduction
  changelog: https://trigger.dev/changelog
  security: https://trigger.dev/security
  dpa: https://trigger.dev/legal/dpa
  subprocessors: https://trigger.dev/legal/subprocessors
read:
  - plans (Free, Hobby, Pro, Enterprise) and the monthly usage credit each includes; the Hobby and Pro fee equals their included usage
  - compute, i.e. a per-second price by machine preset plus a cost per run; dev runs are free, waits longer than a few seconds are not billed, retries are
  - what happens when the credit runs out, i.e. Free queues runs until next month or an upgrade, paid plans bill overage at compute rates
  - billing limits (none by default) and what happens at one, i.e. queues pause, a grace period, then new triggers are rejected; alerts are email only
  - per-plan quotas, i.e. concurrency per environment and extra concurrency bundles, schedules per project, preview branches, team members, log retention, realtime connections, payload and batch sizes
  - Free schedules run at most hourly
  - regions, which set where runs execute but not where payloads and logs are stored
  - SOC 2 Type II, the DPA (part of the terms), the HIPAA BAA add-on, and SSO on Enterprise
usage_questions:
  - metric: monthly_bill
    ask: Compute spend this month against the included usage, and the billing limit?
    where: Organization menu → Usage (spend, most expensive tasks, daily spikes); Settings → Billing limits
  - metric: runs_month
    ask: Runs this month by task, and the machine preset of the busiest tasks?
    where: Organization menu → Usage (runs and duration by task)
  - metric: concurrency
    ask: Concurrency limit per environment and how often runs queue behind it?
    where: project → environment → Concurrency; Limits page for quotas
  - metric: region
    ask: Which region do runs execute in?
    where: project → Regions
mcp:
  official: true
  readonly_flag: "--readonly in the MCP server args (npx trigger.dev@latest mcp --readonly), which hides every write tool"
  allowed_tools: [list_orgs, list_projects, list_runs, list_deploys, list_preview_branches, get_current_worker, search_docs]
common_fixes:
  - set a billing limit and alerts before launch (there is none by default)
  - use the smallest machine preset that works and raise it only for the tasks that need it
  - use wait.for, wait.until or triggerAndWait instead of polling loops
  - add idempotency keys to triggers and deduplication keys to schedules created in code
  - do async work in parallel inside one task instead of fanning out many small runs; debounce rapid triggers
  - lower retry maxAttempts and stop retrying permanent errors; set a realistic maxDuration
  - on Pro, buy extra concurrency instead of moving to a bigger plan
verified: 2026-10-11
---

- Trigger.dev is detected from `@trigger.dev/`, the `trigger.dev` CLI, `trigger.config.*` and the `TRIGGER_*` key names. It is open source and can be self-hosted (`TRIGGER_API_URL` or `configure({ baseURL })` pointing elsewhere), where none of the cloud limits or prices apply: ask where it runs. `@trigger.dev/python` is an npm build extension, not a Python SDK.
- Concurrency is released only when a waiting run checkpoints, so short polling waits hold slots and queue other runs.
- `docs/limits` can lag behind the pricing page (realtime connections); cite the pricing page when they disagree.
- The MCP server with `--readonly` still has tools with side effects or user data: do not call `start_dev_server`, `stop_dev_server`, `switch_profile`, `get_run_details`, `get_span_details`, `get_webhook_delivery`, `query` or `run_dashboard_query` (they can return run payloads and output). It has no spend or invoice tool; usage comes from the Usage page.
- Trigger.dev next to Inngest, Upstash QStash or another job runner is Overlap unless split on purpose.
