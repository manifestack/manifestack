---
schema: 1
id: aws-amplify
name: AWS Amplify Hosting
family: aws
roles: [hosting]
detect:
  packages: ["aws-amplify", "@aws-amplify/", "@aws-sdk/client-amplify", "@aws-cdk/aws-amplify-alpha"]
  go: ["github.com/aws/aws-sdk-go-v2/service/amplify"]
  imports: ["aws-amplify", "@aws-amplify/", "@aws-sdk/client-amplify"]
  config_files: ["amplify.yml", "amplify/backend.ts", "amplify/backend/backend-config.json", "amplify/.config/project-config.json"]
  service_signals: ["AWS::Amplify::App", "aws_amplify_app", "aws-cdk-lib/aws-amplify", "@aws-cdk/aws-amplify-alpha", "client('amplify'", "client(\"amplify\"", "new AWS.Amplify("]
  role_signals:
    hosting: ["defineBackend(", "ampx pipeline-deploy", "amplifyPush", "baseDirectory:", "AWS::Amplify::App", "aws_amplify_app"]
pages:
  pricing: https://aws.amazon.com/amplify/pricing/
  quotas: https://docs.aws.amazon.com/amplify/latest/userguide/quotas-chapter.html
  build_spec: https://docs.aws.amazon.com/amplify/latest/userguide/yml-specification-syntax.html
  nextjs_support: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html
  ssr_features: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html
  waf_pricing: https://docs.aws.amazon.com/amplify/latest/userguide/waf-pricing.html
  metrics: https://docs.aws.amazon.com/amplify/latest/userguide/monitoring-with-cloudwatch.html
  gen1_to_gen2: https://docs.amplify.aws/react/start/migrate-to-gen2/
read:
  - build minutes per build instance size, data stored on the CDN (recurs until the app is deleted), data transfer out, SSR request count and request duration (GB-hours)
  - the free allowances and how long they last for a new account
  - firewall fee per app plus AWS WAF usage
  - backends (Gen 2 or Gen 1) create Cognito, AppSync, DynamoDB, Lambda and S3 resources billed under those services
  - quota names - Apps, Branches per app, Concurrent jobs, Build artifact size, Manual deploy ZIP file size, Request tokens per second; new accounts get reduced apps and concurrent jobs
  - Next.js versions supported by Amplify Hosting compute, and apps still on the Classic (Next.js 11) SSR provider
usage_questions:
  - metric: monthly_bill
    ask: Amplify cost last month by usage type, and the backend services?
    where: Cost Explorer → Service = AWS Amplify → Group by Usage type; repeat for Cognito, AppSync, DynamoDB
  - metric: transfer_tb
    ask: Data served and requests last month?
    where: Amplify console → app → Monitoring → Metrics (BytesDownloaded, Requests)
  - metric: build_minutes
    ask: Build minutes last month and builds per day?
    where: Cost Explorer → AWS Amplify → usage type BuildDuration (usage quantity)
  - metric: branches
    ask: Connected branches and pull request previews?
    where: Amplify console → app → Overview and Previews
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - disconnect stale branches; turn off auto-build and previews that nobody uses
  - cache dependencies in amplify.yml to shorten builds; stay on the standard build instance
  - set Cache-Control for static assets; serve large media from S3 and CloudFront
  - delete unused apps (stored artifacts bill until deletion)
  - migrate Gen 1 projects (amplify/backend/backend-config.json) to Gen 2
verified: 2026-10-11
---

- `aws-amplify` and `@aws-amplify/ui-react` also run on other hosts just for Cognito auth or AppSync; the hosting role then needs a build spec, a Gen 2 backend (`amplify/backend.ts`) or IaC. Amplify libraries on Vercel are not a hosting Overlap.
- `amplify_outputs.json` (Gen 2) and `aws-exports.js` (Gen 1) are generated and usually gitignored; do not rely on them.
- Gen 1 docs are labeled Legacy, with a migration guide to Gen 2: a Risk finding for Gen 1 projects.
- Amplify Hosting serves through CloudFront but bills as Amplify; it is not an aws-cloudfront Overlap.
- A Next.js version newer than the supported list is a Requirement finding.
