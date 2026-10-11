---
# generated, edit catalog/vendors/aws-s3.md (then run: node tools/sync.mjs)
schema: 1
id: aws-s3
name: Amazon S3
family: aws
roles: [storage]
detect:
  packages: ["@aws-sdk/client-s3", "@aws-sdk/lib-storage", "@aws-sdk/s3-request-presigner", "@aws-sdk/s3-presigned-post"]
  pypi: ["mypy-boto3-s3", "types-boto3-s3"]
  go: ["github.com/aws/aws-sdk-go-v2/service/s3", "github.com/aws/aws-sdk-go-v2/feature/s3/manager", "github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"]
  imports: ["@aws-sdk/client-s3", "@aws-sdk/lib-storage", "@aws-sdk/s3-request-presigner", "@aws-sdk/s3-presigned-post"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('s3'", "client(\"s3\"", "resource('s3'", "resource(\"s3\"", "new AWS.S3(", "aws-sdk/clients/s3", "aws-sdk-go/service/s3", '"aws_s3_', "AWS::S3::", "AWS::S3Express::", "aws-cdk-lib/aws-s3", "aws_cdk.aws_s3", "aws.s3.Bucket", "sst.aws.Bucket(", "arn:aws:s3:::", "s3.amazonaws.com", "aws_s3 as"]
  role_signals:
    storage: ['"aws_s3_', "AWS::S3::", "AWS::S3Express::", "aws-cdk-lib/aws-s3", "aws_cdk.aws_s3", "aws.s3.Bucket", "sst.aws.Bucket(", "arn:aws:s3:::", "s3:GetObject", "s3:PutObject", "s3.amazonaws.com/${", "s3-accelerate.amazonaws.com", "aws_s3 as"]
pages:
  pricing: https://aws.amazon.com/s3/pricing/
  storage_classes: https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html
  quotas: https://docs.aws.amazon.com/AmazonS3/latest/userguide/BucketRestrictions.html
  error_billing: https://docs.aws.amazon.com/AmazonS3/latest/userguide/ErrorCodeBilling.html
  multipart_cleanup: https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html
  storage_lens: https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage_lens.html
read:
  - storage per GB-month by class, and the minimum storage duration and billable object size of the IA and Glacier classes
  - request tiers (PUT, COPY, POST, LIST vs GET), lifecycle transition requests, retrieval fees
  - Intelligent-Tiering monitoring and automation fee per object and the size below which objects are not monitored
  - free transfers (in, same Region, to CloudFront), Transfer Acceleration and Replication
  - S3 Express One Zone storage, request and per-GB upload and retrieval fees; one Availability Zone only
  - which error responses are not billed to the bucket owner (5XX, a listed set of 3XX and 4XX codes, AccessDenied from outside the account or organization); other 4XX requests are billed
  - Storage Lens advanced metrics, Inventory, Batch Operations, S3 Metadata
  - general purpose bucket quota per account
usage_questions:
  - metric: storage_gb
    ask: Size, object count and storage class split per bucket?
    where: S3 console → Storage Lens → Dashboards → default-account-dashboard
  - metric: monthly_bill
    ask: Last month's S3 cost by usage type (storage, Requests-Tier1, Requests-Tier2, DataTransfer-Out)?
    where: Billing and Cost Management → Cost Explorer → Service S3 → Group by Usage type
  - metric: transfer_tb
    ask: S3 data transfer out to the internet last month?
    where: Billing and Cost Management → Bills → Charges by service → Simple Storage Service
  - metric: lifecycle
    ask: Versioning and lifecycle rules (noncurrent versions, incomplete multipart uploads) on the large buckets?
    where: S3 console → General purpose buckets → bucket → Properties (Bucket Versioning), Management (Lifecycle rules)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - add lifecycle rules that abort incomplete multipart uploads and expire noncurrent versions
  - move cold data to IA or Glacier classes, minding minimum durations and object sizes
  - serve public files through CloudFront, not from the bucket
  - keep compute in the bucket's Region
  - use Intelligent-Tiering only for objects big enough to be monitored
verified: 2026-10-11
---

- The S3 SDKs and boto3 `client('s3')` also reach R2, Spaces, Hetzner, Vultr, Backblaze B2 and MinIO, so `storage` counts only with an AWS-only signal (Terraform, CloudFormation, CDK, Pulumi, SST, an `arn:aws:s3:::` ARN, an `s3:` IAM action, an `s3.amazonaws.com` host). Without one, a custom `endpoint`, `endpoint_url` or `forcePathStyle` means another store: drop S3 if that vendor is found, else ask where the bucket is.
- S3 next to R2, Spaces or another object store is Overlap unless split on purpose (backups on S3, public files on R2).
- Versioned buckets bill every noncurrent version, and incomplete multipart uploads are billed storage that listings do not show; Storage Lens shows both.
- S3 Vectors and S3 Tables share the pricing page but are not covered here.
