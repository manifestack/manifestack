---
# generated, edit catalog/vendors/aws-opensearch.md (then run: node tools/sync.mjs)
schema: 1
id: aws-opensearch
name: Amazon OpenSearch Service
family: aws
roles: [search]
detect:
  packages: ["@aws-sdk/client-opensearch", "@aws-sdk/client-opensearchserverless", "@aws-sdk/client-elasticsearch-service"]
  pypi: ["mypy-boto3-opensearch", "mypy-boto3-opensearchserverless"]
  go: ["github.com/aws/aws-sdk-go-v2/service/opensearch", "github.com/aws/aws-sdk-go-v2/service/opensearchserverless", "github.com/aws/aws-sdk-go-v2/service/elasticsearchservice"]
  imports: ["@aws-sdk/client-opensearch", "@aws-sdk/client-opensearchserverless", "@aws-sdk/client-elasticsearch-service"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('opensearch'", "client(\"opensearch\"", "client('opensearchserverless'", "client(\"opensearchserverless\"", "AwsSigv4Signer", "AWSV4SignerAuth", "AWSV4SignerAsyncAuth", "/signer/awsv2", '"aws_opensearch', '"aws_elasticsearch_domain', "AWS::OpenSearchService::", "AWS::OpenSearchServerless::", "AWS::Elasticsearch::", "aws-cdk-lib/aws-opensearch", "aws_cdk.aws_opensearch", "aws.opensearch.", "sst.aws.OpenSearch(", "arn:aws:es:", "arn:aws:aoss:", ".es.amazonaws.com", "aoss.amazonaws.com"]
pages:
  pricing: https://aws.amazon.com/opensearch-service/pricing/
  versions_and_support: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html#choosing-version
  serverless: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-overview.html
  serverless_capacity: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scaling.html
  quotas: https://docs.aws.amazon.com/general/latest/gr/opensearch-service.html
  sizing: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/sizing-domains.html
read:
  - domain instance-hours by type for data, dedicated cluster manager and UltraWarm nodes; EBS storage by volume type and provisioned IOPS and throughput; reserved instances or Database Savings Plans
  - managed storage for UltraWarm, cold storage and OR1; Multi-AZ with Standby
  - "Serverless: NextGen collections (OCUs scale to zero when idle) versus Classic collections (a minimum OCU charge for the first collection, less in dev-test mode without standby); indexing and search OCU-hours and managed storage per GB-month"
  - collection groups sharing OCUs, and the account or group maximum OCU setting
  - Extended Support fee per normalized instance-hour for old Elasticsearch and OpenSearch versions, and the end of standard support dates
  - OpenSearch Ingestion OCUs, Direct Query, vector engine charges
  - quotas Domains per Region, Instances per domain, Maximum indexing capacity (OCUs), Maximum search capacity (OCUs)
usage_questions:
  - metric: instances
    ask: Each domain's version, instance types and counts (data, cluster manager, UltraWarm), storage and Multi-AZ setting?
    where: OpenSearch Service console → Domains → domain → General information and Cluster configuration
  - metric: ocu_hours
    ask: Serverless collection type (NextGen or Classic), collection group capacity limits and OCU use?
    where: OpenSearch Service console → Serverless → Collections, then the collection group's capacity settings; CloudWatch metrics IndexingOCU and SearchOCU
  - metric: monthly_bill
    ask: Last month's OpenSearch cost by usage type (ESInstance, ES:GP3-Storage, IndexingOCU, SearchOCU, StorageUsedInS3ByteHour, OpenSearchExtendedSupport)?
    where: Billing and Cost Management → Cost Explorer → Service OpenSearch Service → Group by Usage type
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - delete test domains and collections; Classic Serverless collections bill a minimum around the clock
  - use NextGen collections or a zero minimum on the collection group for idle workloads
  - use dev-test mode (no standby) outside production
  - right-size data nodes and EBS from CPU, JVM memory pressure and free storage
  - move old indexes to UltraWarm or cold storage, or delete them with Index State Management
  - upgrade versions before end of standard support
verified: 2026-10-11
---

- `@opensearch-project/opensearch`, `opensearch-py` and `opensearch-go` also serve self-hosted clusters, so they are not signals. A SigV4 signer (`AwsSigv4Signer`, `AWSV4SignerAuth`), service `es` or `aoss`, or an `es.amazonaws.com` or `aoss.amazonaws.com` host means AWS. OpenSearch in Docker Compose or `localhost:9200` means self-hosted.
- OpenSearch next to Algolia, Elastic Cloud or another search engine is Overlap unless split on purpose.
- A small domain still runs instances every hour; a Classic Serverless collection has a minimum charge even when idle.
- `opensearch-mcp-server-py` (OpenSearch project) searches index contents; do not use it.
