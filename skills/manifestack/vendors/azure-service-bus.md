---
# generated, edit catalog/vendors/azure-service-bus.md (then run: node tools/sync.mjs)
schema: 1
id: azure-service-bus
name: Azure Service Bus, Event Grid, Event Hubs and Queue Storage
family: azure
roles: [jobs]
detect:
  packages: ["@azure/service-bus", "@azure/eventgrid", "@azure/eventgrid-namespaces", "@azure/event-hubs", "@azure/eventhubs-checkpointstore-blob", "@azure/storage-queue"]
  pypi: ["azure-servicebus", "azure-eventgrid", "azure-eventhub", "azure-eventhub-checkpointstoreblob", "azure-eventhub-checkpointstoreblob-aio", "azure-storage-queue"]
  go: ["github.com/Azure/azure-sdk-for-go/sdk/messaging/azservicebus", "github.com/Azure/azure-sdk-for-go/sdk/messaging/eventgrid/azeventgrid", "github.com/Azure/azure-sdk-for-go/sdk/messaging/eventgrid/aznamespaces", "github.com/Azure/azure-sdk-for-go/sdk/messaging/eventgrid/azsystemevents", "github.com/Azure/azure-sdk-for-go/sdk/messaging/azeventhubs", "github.com/Azure/azure-sdk-for-go/sdk/storage/azqueue"]
  imports: ["@azure/service-bus", "@azure/eventgrid", "@azure/eventgrid-namespaces", "@azure/event-hubs", "@azure/eventhubs-checkpointstore-blob", "@azure/storage-queue"]
  env_prefixes: ["AZURE_SERVICEBUS_", "AZURE_SERVICE_BUS_", "SERVICEBUS_CONNECTION_STRING", "AZURE_EVENTHUB", "EVENTHUB_CONNECTION_STRING", "AZURE_EVENTGRID_"]
  config_files: []
  service_signals: ["azure.servicebus", "azure.eventgrid", "azure.eventhub", "azure.storage.queue", "\"azurerm_servicebus_", "\"azurerm_eventgrid_", "\"azurerm_eventhub", "\"azurerm_storage_queue\"", "Microsoft.ServiceBus/namespaces", "Microsoft.EventGrid/", "Microsoft.EventHub/namespaces", "Microsoft.EventHub/clusters", "azure-native:servicebus:", "azure_native.servicebus", "azure-native:eventgrid:", "azure_native.eventgrid", "azure-native:eventhub:", "azure_native.eventhub", ".servicebus.windows.net", ".eventgrid.azure.net", ".queue.core.windows.net", ".serviceBusQueue(", ".serviceBusTopic(", ".eventHub(", ".eventGrid(", ".storageQueue(", ".service_bus_", ".event_hub_", ".event_grid_", ".queue_trigger(", ".queue_output("]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/service-bus/
  quotas: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quotas
  premium: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-premium-messaging
  eventgrid_pricing: https://azure.microsoft.com/en-us/pricing/details/event-grid/
  eventgrid_quotas: https://learn.microsoft.com/en-us/azure/event-grid/quotas-limits
  eventhubs_pricing: https://azure.microsoft.com/en-us/pricing/details/event-hubs/
  eventhubs_quotas: https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-quotas
  eventhubs_scaling: https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-scalability
  eventhubs_auto_inflate: https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-auto-inflate
  eventhubs_capture: https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-capture-overview
  queue_pricing: https://azure.microsoft.com/en-us/pricing/details/storage/queues/
  queue_targets: https://learn.microsoft.com/en-us/azure/storage/queues/scalability-targets
read:
  - Service Bus tiers (Basic, Standard, Premium): topics, sessions and duplicate detection need Standard; large messages, isolation and geo-replication need Premium
  - Standard base charge (once per Azure subscription, not per namespace) with included operations, then tiered per million operations; each 64 KB chunk, receive, complete, abandon, lock renewal and delivery to each topic subscription counts
  - brokered connection charges on Standard (AMQP connections and HTTP long polling) above the included allowance; Basic is capped at its free connections
  - Premium per messaging unit per hour on the highest unit count in each hour, whether used or not; partitioned namespaces multiply units by partitions; geo-replication per replica and per GB
  - Event Grid Basic per million operations (publish, advanced filtering, each delivery attempt) with a free monthly allowance; Standard namespaces per throughput unit per hour plus event and MQTT operations, each per 64 KB
  - Event Hubs tiers (Basic, Standard per throughput unit per hour plus ingress events; Premium per processing unit; Dedicated per capacity unit with a minimum of hours); retention per tier and storage overage
  - Event Hubs Capture billed per throughput unit on Standard (included on Premium and Dedicated), plus the storage account it writes to
  - Queue Storage per GB stored and per 10,000 operations by class, by redundancy, on the storage account's bill
  - quotas for message and queue size, namespaces per subscription, throughput units per namespace, and what happens at a limit (throttling, quota exceeded errors)
usage_questions:
  - metric: monthly_bill
    ask: Service Bus, Event Grid and Event Hubs cost last month by meter, and Queue Storage transactions?
    where: Azure portal → Cost Management → Cost analysis → Group by Meter, filter Service name (Service Bus, Event Grid, Event Hubs, Storage)
  - metric: messaging_tier
    ask: Tier of each Service Bus and Event Hubs namespace, messaging, throughput or processing units, and is auto-inflate on with what maximum?
    where: Service Bus or Event Hubs namespace → Overview (Pricing tier) and Settings → Scale
  - metric: monthly_requests
    ask: Incoming and outgoing messages and requests last month on the busiest namespace?
    where: namespace → Monitoring → Metrics (IncomingMessages, OutgoingMessages, IncomingRequests, ThrottledRequests), Sum, 30 days
  - metric: queue_backlog
    ask: Active and dead-lettered messages on the busiest queue or subscription?
    where: Service Bus namespace → Metrics (ActiveMessages, DeadletteredMessages) split by EntityName
mcp:
  official: true
  readonly_flag: "--read-only on the local Azure MCP Server with only these tools: npx -y @azure/mcp@latest server start --read-only --tool eventhubs_namespace_get --tool eventhubs_eventhub_get --tool eventgrid_topic_list; sign in with a Reader identity"
  allowed_tools: [eventhubs_namespace_get, eventhubs_eventhub_get, eventgrid_topic_list]
common_fixes:
  - cut abandons, lock renewals and redeliveries, which each bill as operations; use receive-and-delete where losing a message on a crash is acceptable
  - set max delivery count and handle dead-lettered messages so poison messages stop redelivering
  - filter at the topic subscription or Event Grid subscription instead of in the consumer
  - right-size Premium messaging units on CPU and memory metrics, or move a low-volume namespace to Standard
  - set an auto-inflate maximum on Event Hubs and scale throughput units back down by hand
verified: 2026-10-11
---

- The Standard base charge comes once per subscription, so a second Standard namespace adds no base charge. Premium bills every hour per messaging unit, idle or not: a Premium namespace for a small app is a Bill finding.
- Event Hubs auto-inflate scales throughput units up but never down; a spike leaves the higher count billed until someone lowers it.
- `.servicebus.windows.net` is the host of both Service Bus and Event Hubs namespaces. Azure Functions triggers (`app.serviceBusQueue(`, `@app.service_bus_queue_trigger(`) find the service even when no SDK is imported; `function.json` bindings and C# or Java code are not scanned.
- Queue Storage lives in a storage account; its cost shows as Storage transactions, not under messaging.
- Service Bus, Event Grid or Event Hubs with Inngest, Trigger.dev, Upstash QStash, SQS or Pub/Sub is Overlap unless split on purpose (infrastructure events versus app jobs).
- MCP: `--read-only` alone still exposes read tools of every Azure service, some of which return data or run billed calls, so start the server with the `--tool` list above (`--namespace` cannot be combined with `--tool`). The Service Bus tools (`servicebus_*_details`) read the namespace data plane and need Azure Service Bus Data Owner, a role that can also send and receive messages: leave them out and ask for queue counts instead. Never call `eventgrid_events_publish` or any update or delete tool.
