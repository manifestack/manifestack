---
schema: 1
id: render
name: Render
roles: [hosting]
detect:
  pypi: ["render", "render-sdk"]
  env_prefixes: ["RENDER_SERVICE_", "RENDER_EXTERNAL_", "RENDER_GIT_", "RENDER_INSTANCE_ID", "RENDER_DISCOVERY_SERVICE", "RENDER_API_KEY"]
  config_files: ["render.yaml"]
pages:
  pricing: https://render.com/pricing
  plans: https://render.com/docs/new-workspace-plans
  free: https://render.com/docs/free
  bandwidth: https://render.com/docs/outbound-bandwidth
  build_spend_limit: https://render.com/docs/build-pipeline
  regions: https://render.com/docs/regions
  postgres: https://render.com/docs/postgresql
  security: https://render.com/security
  compliance: https://render.com/docs/certifications-compliance
  dpa: https://render.com/dpa
read:
  - workspace plans (Hobby, Pro, Scale, Enterprise), the flat monthly fee of each, plus compute billed per service by instance type and prorated by the second
  - Hobby is for personal projects and prototypes (one seat, capped service count); a team or commercial production app points to Pro or higher
  - free instances spin down after inactivity and take time to spin back up (a cold-start Risk), lose local files on spin-down, and are not meant for production
  - monthly free instance hours per workspace and what happens when they run out (free web services suspended until next month)
  - outbound bandwidth included per workspace plan and the per-GB overage rate; private-network traffic in the same region is not billed
  - free Postgres expires a fixed time after creation, then a grace period before deletion; free Key Value is in-memory only; read paid Postgres and Key Value plan kinds, storage billing and backups
  - spend controls, i.e. a spend limit exists for build pipeline minutes only, and usage emails near and past included amounts; there is no hard cap on compute or bandwidth
  - regions offered; the region of a service or database cannot be changed after creation (a move means a new service and a data migration)
  - certifications (SOC 2 Type 2, ISO 27001, HIPAA-enabled workspaces on Scale and higher with a compute premium) and the DPA
usage_questions:
  - metric: monthly_bill
    ask: Accrued usage this month and the last invoice total?
    where: Dashboard → workspace → Billing (accrued charges, invoices)
  - metric: egress_gb
    ask: Outbound bandwidth used this month against the included amount?
    where: Dashboard → workspace → Billing → Monthly Included Usage; per service on service → Metrics → Outbound Bandwidth
  - metric: instances
    ask: Instance type and instance count (or autoscaling range) per service?
    where: Dashboard → service → Compute (Manual Scaling / Autoscaling)
  - metric: region
    ask: Which region does each service and database run in?
    where: Dashboard → service → Settings (Region); or the region field in render.yaml
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - move a production service off the Free instance type to avoid spin-down and expiry
  - right-size the instance type and set an autoscaling range instead of a fixed large count
  - set a spend limit for build pipeline minutes (Workspace Settings → Build Pipeline)
  - keep services and databases in one region and talk over the private network to avoid billed bandwidth
  - choose the region near the database and users at creation time, since it cannot be changed later
  - serve static assets from a static site or CDN with caching instead of a web service
verified: 2026-10-07
---

- Render has no app SDK in `package.json`. It is detected from `render.yaml` (Blueprint; the path can be customized at setup) and `RENDER_*` names in `.env` files. A service created in the dashboard leaves no trace in the repo: ask the user where the app runs.
- A free Postgres database is deleted after its expiry and grace period. If the stack uses one for real data, that is a Risk with a date.
- `databases:` in `render.yaml` means Render Postgres, but detection cannot read YAML keys, so this map does not claim the `database` role. Check `render.yaml` by hand and ask.
- Render MCP (`mcp-server.render.com`, open source `render-oss/render-mcp-server`) has create service/database, update environment variables and SQL query tools, and no read-only mode. Do not use it; ask the user for numbers instead.
- Render plus a second hosting platform for the same app is Overlap unless split on purpose. Because the region is fixed at creation, a data-region requirement that the current region misses needs a migration plan, not a setting change.
