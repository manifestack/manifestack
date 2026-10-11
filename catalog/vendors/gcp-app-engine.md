---
schema: 1
id: gcp-app-engine
name: Google App Engine
family: gcp
roles: [hosting]
detect:
  packages: ["@google-cloud/appengine-admin"]
  pypi: ["google-cloud-appengine-admin", "appengine-python-standard"]
  go: ["cloud.google.com/go/appengine", "google.golang.org/appengine"]
  imports: ["@google-cloud/appengine-admin"]
  service_signals: ["google_app_engine_standard_app_version", "google_app_engine_flexible_app_version", "StandardAppVersion", "FlexibleAppVersion", "gcloud app deploy", "gcloud app versions", "args: ['app', 'deploy'", "args: [\"app\", \"deploy\"", "instance_class: F", "instance_class: B", "automatic_scaling:", "basic_scaling:", "manual_scaling:", "env: flex", "app_engine_apis:", "static_dir:", "script: auto", ".r.appspot.com", "google.appengine.", "GAE_APPLICATION", "GAE_SERVICE", "GAE_ENV", "google-github-actions/deploy-appengine@"]
pages:
  pricing: https://cloud.google.com/appengine/pricing
  environments: https://docs.cloud.google.com/appengine/docs/the-appengine-environments
  quotas: https://docs.cloud.google.com/appengine/docs/standard/quotas
  managing_costs: https://docs.cloud.google.com/appengine/docs/standard/managing-costs
  scaling: https://docs.cloud.google.com/appengine/docs/standard/how-instances-are-managed
  runtime_lifecycle: https://docs.cloud.google.com/appengine/docs/standard/lifecycle/runtime-lifecycle
  support_schedule: https://docs.cloud.google.com/appengine/docs/standard/lifecycle/support-schedule
  flexible_support_schedule: https://docs.cloud.google.com/appengine/docs/flexible/lifecycle/support-schedule
  compare_cloud_run: https://docs.cloud.google.com/appengine/migration-center/run/compare-gae-with-run
  locations: https://docs.cloud.google.com/appengine/docs/standard/locations
read:
  - standard - hourly rate per instance class (F classes bill as Frontend Instances, B classes as Backend Instances, in multiples of the base class), free daily F and B instance hours and outbound traffic per project
  - instance hours accrue until fifteen minutes after the last request (automatic and basic scaling) or after shutdown (manual); min_idle_instances bill with no traffic
  - flexible - no free tier, Compute Engine VMs billed per second for vCPU, memory (including runtime overhead) and disk, at least one instance per version, egress at Compute Engine rates
  - legacy bundled services prices (Blobstore, dedicated memcache, Search API, Logs API) and the ones with no extra charge
  - quota names - Frontend instance hours, Backend instance hours, Outgoing bandwidth; daily and per-minute quotas and the error at the limit
  - runtime end of support (deploys blocked unless an org policy re-enables them), deprecated (that re-enable removed) and decommissioned (app may be disabled) dates
  - Google recommends Cloud Run for new projects; the app region cannot change after creation
usage_questions:
  - metric: monthly_bill
    ask: App Engine cost last month by SKU?
    where: Billing → Reports → Services = App Engine → Group by SKU (Frontend Instances, Backend Instances, flexible core and RAM hours)
  - metric: instance_hours
    ask: Instance hours per day vs the free quota?
    where: App Engine → Quotas
  - metric: instances
    ask: Services, versions (standard or flexible, serving or stopped), runtime, instance class and scaling?
    where: App Engine → Versions and Instances; app.yaml (runtime, instance_class, scaling, min_idle_instances, max_instances)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set max_instances; drop min_idle_instances outside production
  - smallest instance class that keeps latency acceptable
  - stop or delete old versions, above all flexible ones
  - move low-traffic flexible services to standard or Cloud Run so they scale to zero
  - upgrade runtimes before the end of support date
  - budget alert scoped to App Engine
verified: 2026-10-11
---

- `app.yaml` is a common name (DigitalOcean App Platform, Kubernetes), so it is not a config file signal. App Engine keys (`instance_class`, `automatic_scaling`, `env: flex`), `gcloud app deploy` and Terraform app versions find it once the gcp family is found. An `app.yaml` with only `runtime:` is missed: if the family is found and a root `app.yaml` names an App Engine runtime ID (`python313`, `nodejs22`), count App Engine by hand.
- `google_app_engine_application` and `gcloud app create` alone often only set up Firestore or Cloud Scheduler; not signals.
- `.r.appspot.com` is an App Engine URL; plain `.appspot.com` is not a signal, since older Firebase Storage buckets use it.
- Java apps (`appengine-web.xml`) are not scanned; ask.
- A first-generation runtime (`python27`, `java8`, `go111`, `php55`) near or past decommission is a Risk finding with a date. A new project on App Engine is a Fit note: Google points new users to Cloud Run.
- App Engine beside another host is an Overlap only when the same traffic runs on both.
- No official App Engine MCP server.
