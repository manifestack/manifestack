---
# generated, edit catalog/vendors/aws-cloudfront.md (then run: node tools/sync.mjs)
schema: 1
id: aws-cloudfront
name: Amazon CloudFront
family: aws
roles: [hosting]
detect:
  packages: ["@aws-sdk/client-cloudfront", "@aws-sdk/cloudfront-signer", "@aws-sdk/client-cloudfront-keyvaluestore"]
  go: ["github.com/aws/aws-sdk-go-v2/service/cloudfront", "github.com/aws/aws-sdk-go-v2/feature/cloudfront/sign", "github.com/aws/aws-sdk-go-v2/service/cloudfrontkeyvaluestore"]
  imports: ["@aws-sdk/client-cloudfront", "@aws-sdk/cloudfront-signer", "@aws-sdk/client-cloudfront-keyvaluestore"]
  service_signals: ["aws_cloudfront_distribution", "AWS::CloudFront::Distribution", "aws-cdk-lib/aws-cloudfront", "aws_cdk.aws_cloudfront", "client('cloudfront'", "client(\"cloudfront\"", "new AWS.CloudFront(", "aws-sdk-go/service/cloudfront", "aws:cloudfront:Distribution", "sst.aws.Router(", "sst.aws.StaticSite(", "sst.aws.Nextjs(", "aws_cloudfront as", "aws.cloudfront."]
pages:
  pricing: https://aws.amazon.com/cloudfront/pricing/
  pay_as_you_go: https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/
  flat_rate_plans: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html
  quotas: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html
  invalidation: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html
  origin_shield: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html
  usage_reports: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/usage-charts.html
read:
  - flat-rate plans (Free, Pro, Business, Premium) per distribution - monthly request and data transfer allowances, what is bundled (WAF, DDoS protection, Route 53 zone, log ingestion, S3 credits), no overage charges but sustained excess can degrade delivery
  - flat-rate limits - free plans per account, a required WAF web ACL, unsupported features that force pay-as-you-go, eligibility from recent usage, Lambda@Edge still billed per use
  - pay-as-you-go - data transfer out per GB by geographic region and volume tier, HTTP and HTTPS requests by region, data transfer out to origin, price classes
  - the always-free monthly allowance (transfer out, requests, CloudFront Functions, KeyValueStore reads); origin fetches from AWS origins are free
  - CloudFront Functions, KeyValueStore and Lambda@Edge charges
  - invalidation paths free per month, then billed per path
  - Origin Shield requests, real-time logs, field-level encryption, dedicated IP SSL and Anycast static IPs
  - Security Savings Bundle (monthly commitment), not combinable with flat-rate plans
  - quota names - Data transfer rate per distribution, Requests per second per distribution, Distributions per AWS account, Response timeout per origin
usage_questions:
  - metric: transfer_tb
    ask: Data transfer out last month, by billing region?
    where: CloudFront console → Reports and analytics → Usage reports (Billing Region All)
  - metric: requests
    ask: HTTP and HTTPS requests last month?
    where: CloudFront console → Reports and analytics → Usage reports
  - metric: monthly_bill
    ask: CloudFront cost last month by usage type?
    where: Cost Explorer → Service = Amazon CloudFront → Group by Usage type
  - metric: plan
    ask: Pricing plan per distribution and usage against its allowance?
    where: CloudFront console → Distributions → distribution → pricing plan
  - metric: cache_hit_ratio
    ask: Cache hit ratio?
    where: CloudFront console → Reports and analytics → Cache statistics
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - compare the flat-rate tier that fits with the pay-as-you-go cost before reporting a transfer Bill
  - raise the cache hit ratio with cache policies and long TTLs on versioned assets
  - version file names instead of invalidating; use wildcard paths
  - choose a cheaper price class when users are in North America and Europe
  - use CloudFront Functions instead of Lambda@Edge for header and URL rewrites
  - turn on compression
verified: 2026-10-11
---

- Hostnames ending in `cloudfront.net` are not a signal: third-party SDKs and assets use them.
- CloudFront in front of S3, an ALB, Lambda or API Gateway is a CDN layer, not a second host: with another AWS hosting map it is not an Overlap. CloudFront in front of Vercel or Netlify is a double CDN.
- Amplify Hosting and Lightsail distributions bill CDN usage as Amplify or Lightsail.
- Lambda@Edge usage types appear in the CloudFront and Lambda price lists; check both services in Cost Explorer.
