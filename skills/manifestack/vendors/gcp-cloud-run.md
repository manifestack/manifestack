---
# generated, edit catalog/vendors/gcp-cloud-run.md (then run: node tools/sync.mjs)
schema: 1
id: gcp-cloud-run
name: Google Cloud Run and Cloud Run functions
family: gcp
roles: [hosting]
detect:
  packages: ["@google-cloud/run", "@google-cloud/functions", "@google-cloud/functions-framework"]
  pypi: ["google-cloud-run", "google-cloud-functions", "functions-framework"]
  go: ["cloud.google.com/go/run", "cloud.google.com/go/functions", "github.com/GoogleCloudPlatform/functions-framework-go"]
  imports: ["@google-cloud/run", "@google-cloud/functions", "@google-cloud/functions-framework"]
  service_signals: ["google_cloud_run_", "google_cloudfunctions", "gcloud run ", "gcloud beta run ", "gcloud functions ", "args: ['run', 'deploy'", "args: [\"run\", \"deploy\"", "args: ['functions', 'deploy'", "args: [\"functions\", \"deploy\"", "allow-unauthenticated", "serving.knative.dev", "run.googleapis.com", "cloudfunctions.googleapis.com", ".a.run.app", ".run.app/", ".run.app\"", ".run.app'", "cloudfunctions.net", "gcp.cloudrun", "gcp.cloudfunctions", "/gcp/cloudrun", "/gcp/cloudfunctions", "run_v2.ServicesClient", "\"K_SERVICE\"", "'K_SERVICE'", "env.K_SERVICE", "CLOUD_RUN_JOB"]
pages:
  pricing: https://cloud.google.com/run/pricing
  billing_settings: https://docs.cloud.google.com/run/docs/configuring/billing-settings
  min_instances: https://docs.cloud.google.com/run/docs/configuring/min-instances
  max_instances: https://docs.cloud.google.com/run/docs/configuring/max-instances
  concurrency: https://docs.cloud.google.com/run/docs/about-concurrency
  quotas: https://docs.cloud.google.com/run/quotas
  resource_model: https://docs.cloud.google.com/run/docs/resource-model
  functions_comparison: https://docs.cloud.google.com/run/docs/functions/comparison
  functions_1st_gen_pricing: https://cloud.google.com/functions/pricing-1stgen
  functions_runtimes: https://docs.cloud.google.com/functions/docs/runtime-support
read:
  - vCPU-second and GiB-second rates by region tier for request-based billing (active rate, min-instance idle rate, per-million requests) and instance-based billing, and the monthly free tier of each per billing account
  - request-based bills only while an instance starts, serves or shuts down; instance-based bills the whole instance lifetime with a one-minute minimum; jobs always bill instance-based
  - min instances bill at the idle rate with no traffic; revision-level min instances keep every tagged revision warm
  - pricing page sections - Services, Jobs, Delayed Jobs (dynamic prices), Worker pools, Instances (Preview), Ephemeral Disk, GPUs; Cloud Run CUD rates
  - functions (formerly Cloud Functions 2nd gen) bill as Cloud Run services; 1st gen has its own invocation, GB-second and GHz-second rates, free tier and one request per instance
  - Cloud Build, Artifact Registry, Eventarc and Serverless VPC Access connectors bill separately
  - quota names - Maximum number of instances, CPU and memory allocation per region, Job Run, GPU instances (zero by default)
  - at a spend cap services return 5xx, jobs and worker pools stop until it is lifted
usage_questions:
  - metric: monthly_bill
    ask: Cloud Run and functions cost last month by SKU?
    where: Billing → Reports → Services = Cloud Run and Cloud Run Functions (formerly Cloud Functions) → Group by SKU
  - metric: requests
    ask: Requests per month and peak per service?
    where: Cloud Run → Services → service → Metrics (Request count)
  - metric: instances
    ask: Billing setting, min and max instances, concurrency, CPU and memory per service; active vs idle instances?
    where: Cloud Run → Services → service → Revisions and Metrics (Container instance count); gcloud run services describe SERVICE
  - metric: functions_1st_gen
    ask: Functions still on 1st gen?
    where: gcloud functions list (Environment column)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set max instances on every service; min instances only in production, at service level
  - raise concurrency for thread-safe code before adding CPU; startup CPU boost instead of min instances for cold starts
  - switch to instance-based billing when the Recommender says it is cheaper or the service works in the background
  - set a spend cap budget on Cloud Run where a hard stop is acceptable
  - Artifact Registry cleanup policies for deploy images
  - upgrade 1st gen functions to Cloud Run functions
verified: 2026-10-11
---

- `@google-cloud/run` and `@google-cloud/functions` are admin clients; the Functions Framework, Terraform, gcloud, Knative `service.yaml`, `.run.app` or `cloudfunctions.net` URLs and `K_SERVICE` show code that runs here. `serving.knative.dev` also fits self-hosted Knative.
- `.github/` is not scanned: a deploy only in GitHub Actions leaves no signal; ask.
- Firebase Functions, App Hosting and Hosting rewrites run on Cloud Run in the same project: one deployment, not an Overlap.
- Cloud Run beside another host (Vercel, Fly, Render) is an Overlap when the same traffic runs on both; an API here with the frontend elsewhere is a split. Cloud Run, App Engine, Compute Engine and GKE are one family, so detection never reports them as an Overlap; still ask why one app uses two.
- `allow-unauthenticated` with no max instances is a Bill risk under abuse.
- MCP: the remote server (`run.googleapis.com/mcp`) and local `cloud-run-mcp` have deploy tools and no read-only toolset; `get_service` returns environment variable values. Do not use them.
