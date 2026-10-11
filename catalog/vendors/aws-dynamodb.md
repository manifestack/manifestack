---
schema: 1
id: aws-dynamodb
name: Amazon DynamoDB
family: aws
roles: [database]
detect:
  packages: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/util-dynamodb", "@aws-sdk/client-dynamodb-streams", "dynamoose", "electrodb", "dynamodb-toolbox", "dynamodb-onetable"]
  pypi: ["pynamodb", "mypy-boto3-dynamodb"]
  go: ["github.com/aws/aws-sdk-go-v2/service/dynamodb", "github.com/aws/aws-sdk-go-v2/service/dynamodbstreams", "github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue", "github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression", "github.com/guregu/dynamo"]
  imports: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/util-dynamodb", "@aws-sdk/client-dynamodb-streams", "dynamoose", "electrodb", "dynamodb-toolbox", "dynamodb-onetable"]
  env_prefixes: []
  config_files: []
  service_signals: ["client('dynamodb'", "client(\"dynamodb\"", "resource('dynamodb'", "resource(\"dynamodb\"", "new AWS.DynamoDB", "aws-sdk/clients/dynamodb", "aws-sdk-go/service/dynamodb", '"aws_dynamodb_', "AWS::DynamoDB::", "AWS::Serverless::SimpleTable", "aws-cdk-lib/aws-dynamodb", "aws_cdk.aws_dynamodb", "aws.dynamodb.Table", "sst.aws.Dynamo(", "arn:aws:dynamodb:", "aws_dynamodb as", "aws.dynamodb."]
pages:
  pricing: https://aws.amazon.com/dynamodb/pricing/
  capacity_modes: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html
  max_throughput: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode-max-throughput.html
  table_classes: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.TableClasses.html
  quotas: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html
  cost_optimization: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-cost-optimization.html
read:
  - on-demand price per read and write request unit; provisioned per RCU and WCU hour; reserved capacity and Database Savings Plans
  - units per read (eventual, strong, transactional) and per write by item size
  - storage per GB-month by table class (Standard, Standard-IA) and when Standard-IA pays off
  - global secondary indexes billed for their own writes and storage; global tables billed for replicated writes in every Region
  - point-in-time recovery, on-demand backup, restore, export to S3 and import from S3
  - Streams reads, Kinesis change data capture, DAX, vector search
  - Free Tier storage and capacity allowances
  - quotas Table-level read and write throughput, account-level throughput, tables per Region, item size, provisioned capacity decreases per day
usage_questions:
  - metric: db_size
    ask: Table size and item count of the largest tables, and their capacity mode and table class?
    where: DynamoDB console → Tables → table → Overview (Items summary) and Additional settings (capacity, table class)
  - metric: monthly_bill
    ask: Last month's DynamoDB cost by usage type (ReadRequestUnits, WriteRequestUnits, TimedStorage-ByteHrs, TimedPITRStorage-ByteHrs)?
    where: Billing and Cost Management → Cost Explorer → Service DynamoDB → Group by Usage type
  - metric: throughput
    ask: Consumed read and write units at peak and on average for the busiest tables?
    where: DynamoDB console → Tables → table → Monitor (consumed read and write capacity)
  - metric: backups
    ask: Is point-in-time recovery on, and are TTL and global tables used?
    where: DynamoDB console → Tables → table → Backups (Point-in-time recovery), Additional settings (Time to Live), Global tables
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set TTL on sessions, caches and logs; TTL deletes are free
  - switch steady tables to provisioned with auto scaling, spiky ones to on-demand
  - set a maximum throughput on on-demand tables
  - drop or project fewer attributes into unused GSIs
  - use Standard-IA for tables where storage dominates the bill
  - replace Scans with Query on a key or index
verified: 2026-10-11
---

- DynamoDB signals are reliable. DynamoDB Local (`amazon/dynamodb-local`) used only in tests costs nothing; ScyllaDB Alternator speaks the same API.
- DynamoDB next to another primary database (RDS, Supabase, Neon, MongoDB Atlas) is Overlap unless split on purpose (for example sessions or events in DynamoDB, relational data in Postgres).
- On-demand has no cap by default: a Scan in a loop or a retry storm is billed per request. Each GSI multiplies write cost.
- Switching capacity mode and changing table class have frequency limits; read them before advising a switch.
- `awslabs.dynamodb-mcp-server` is a data modeling helper that does not read account usage; do not use it.
