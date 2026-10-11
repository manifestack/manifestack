---
# generated, edit catalog/vendors/aws-rds-aurora.md (then run: node tools/sync.mjs)
schema: 1
id: aws-rds-aurora
name: Amazon RDS and Aurora
family: aws
roles: [database]
detect:
  packages: ["@aws-sdk/client-rds", "@aws-sdk/client-rds-data", "@aws-sdk/rds-signer", "aws-advanced-nodejs-wrapper"]
  pypi: ["aws-advanced-python-wrapper", "mypy-boto3-rds", "mypy-boto3-rds-data"]
  go: ["github.com/aws/aws-sdk-go-v2/service/rds", "github.com/aws/aws-sdk-go-v2/service/rdsdata", "github.com/aws/aws-sdk-go-v2/feature/rds/auth", "github.com/aws/aws-advanced-go-wrapper"]
  imports: ["@aws-sdk/client-rds", "@aws-sdk/client-rds-data", "@aws-sdk/rds-signer", "aws-advanced-nodejs-wrapper"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('rds'", "client(\"rds\"", "client('rds-data'", "client(\"rds-data\"", "new AWS.RDS(", "new AWS.RDSDataService(", "aws-sdk/clients/rds", "aws-sdk-go/service/rds", '"aws_db_', '"aws_rds_', "AWS::RDS::", "aws-cdk-lib/aws-rds", "aws_cdk.aws_rds", "aws.rds.", "sst.aws.Postgres(", "sst.aws.Aurora(", "sst.aws.Mysql(", "arn:aws:rds:", "rds-db:connect", "rds.amazonaws.com"]
pages:
  pricing: https://aws.amazon.com/rds/pricing/
  postgres_pricing: https://aws.amazon.com/rds/postgresql/pricing/
  mysql_pricing: https://aws.amazon.com/rds/mysql/pricing/
  aurora_pricing: https://aws.amazon.com/rds/aurora/pricing/
  proxy_pricing: https://aws.amazon.com/rds/proxy/pricing/
  quotas: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html
  extended_support: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support.html
  aurora_storage: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html
  aurora_auto_pause: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html
read:
  - instance hours by class and engine, Single-AZ vs Multi-AZ, CPU credits of T classes (Unlimited mode)
  - storage by type (gp2, gp3, io1, io2), provisioned IOPS; backup storage free up to provisioned storage, snapshots of deleted instances billed
  - Aurora Standard (per-request I/O) vs I/O-Optimized (no I/O fee, higher rates), switch limits
  - Aurora Serverless v2 per ACU-hour, auto-pause at zero ACUs and what prevents it
  - RDS Extended Support per vCPU-hour or ACU-hour, its third-year rate, end of standard support dates of the versions in use
  - RDS Proxy minimum charge; Global Database replicated write I/O
  - quotas DB instances, Total storage for all DB instances, Manual DB instance snapshots
usage_questions:
  - metric: instances
    ask: Engine and version, class, Multi-AZ and RDS Extended Support status of each database?
    where: RDS console → Databases (Size, Engine version, RDS Extended Support columns); database → Configuration
  - metric: db_size
    ask: Allocated and used storage, and backup retention?
    where: RDS console → Databases → database → Configuration (Storage), Monitoring (Free storage space), Maintenance & backups
  - metric: monthly_bill
    ask: Last month's RDS cost by usage type (InstanceUsage, Multi-AZUsage, Aurora:StorageIOUsage, ExtendedSupport, ChargedBackupUsage)?
    where: Billing and Cost Management → Cost Explorer → Service Relational Database Service → Group by Usage type
  - metric: snapshots
    ask: Manual snapshots and snapshots of deleted databases?
    where: RDS console → Snapshots → Manual
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - upgrade major versions before end of standard support, or set Extended Support off when creating a database
  - use Single-AZ for dev and staging
  - right-size the class; gp3 unless IOPS need io2
  - for idle or spiky Aurora use Serverless v2 with a zero minimum
  - pick I/O-Optimized when I/O is a large share of the Aurora bill
  - delete old manual snapshots
verified: 2026-10-11
---

- Apps connect with `pg`, `mysql2` or an ORM and a `DATABASE_URL` whose value is never read, so RDS shows only through infrastructure files, the SDK or an `rds.amazonaws.com` host. If AWS is found but no database, ask where Postgres or MySQL runs.
- RDS or Aurora next to Supabase, Neon, PlanetScale or another managed database is Overlap unless split on purpose.
- Extended Support starts automatically at end of standard support and can cost more than the instance. A stopped instance still pays storage and restarts after seven days. RDS Proxy keeps Aurora from auto-pausing.
- Aurora DSQL is priced per DPU and storage and is not covered by this map.
- `awslabs.postgres-mcp-server` and `awslabs.mysql-mcp-server` run SQL on user data with a best-effort read-only check; do not use them.
