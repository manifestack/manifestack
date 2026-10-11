param location string = resourceGroup().location

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'logs'
  location: location
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'api'
  location: location
  properties: {
    managedEnvironmentId: env.id
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'orders-db'
  location: location
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'ordersfiles'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

resource uploads 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storage.name}/default/uploads'
}

resource bus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: 'orders-bus'
  location: location
}

resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'orders-ai'
  location: location
  kind: 'OpenAI'
}

resource chat 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'gpt-4.1-mini'
}

// resource cache 'Microsoft.Cache/redis@2024-03-01' = {}
