param location string
param baseName string
@secure()
param uploadPassword string

var uniq = uniqueString(resourceGroup().id)
var storageName = toLower('st${baseName}${take(uniq, 12)}')
var functionAppName = 'func-${baseName}-${take(uniq, 8)}'
var appServicePlanName = 'plan-${baseName}'
var appInsightsName = 'ai-${baseName}'
var logAnalyticsName = 'log-${baseName}'
var eventGridTopicName = 'evgt-${baseName}-storage'
var frontDoorProfileName = 'afd-${baseName}'
var frontDoorEndpointName = 'afd-${baseName}-${take(uniq, 6)}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource originalsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'originals'
  properties: { publicAccess: 'None' }
}

resource thumbnailsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'thumbnails'
  properties: { publicAccess: 'Blob' }
}

resource displayContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'display'
  properties: { publicAccess: 'Blob' }
}

// Dead-letter sink for the storage-event subscription: BlobCreated events that
// Event Grid fails to deliver (e.g. host cold/scaling during an upload burst)
// land here instead of silently vanishing after the 24h retry window, so drops
// are observable. The reconcilePending timer is the functional recovery path;
// this is for visibility.
resource deadlettersContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'deadletters'
  properties: { publicAccess: 'None' }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource photosTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'photos'
}

resource albumsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'albums'
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'linux'
  properties: { reserved: true }
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net'

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [ '*' ]
        supportCredentials: false
      }
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'AzureWebJobsFeatureFlags', value: 'EnableWorkerIndexing' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: '1' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
        { name: 'AzureWebJobsStorage', value: storageConnectionString }
        { name: 'PHOTOS_STORAGE_CONNECTION', value: storageConnectionString }
        { name: 'ORIGINALS_CONTAINER', value: 'originals' }
        { name: 'THUMBNAILS_CONTAINER', value: 'thumbnails' }
        { name: 'DISPLAY_CONTAINER', value: 'display' }
        { name: 'PHOTOS_TABLE', value: 'photos' }
        { name: 'ALBUMS_TABLE', value: 'albums' }
        { name: 'UPLOAD_PASSWORD', value: uploadPassword }
        { name: 'ENABLE_DEBUG_ENDPOINTS', value: 'false' }
        { name: 'PUBLIC_IMAGE_BASE', value: '' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
      ]
    }
  }
}

resource eventGridTopic 'Microsoft.EventGrid/systemTopics@2024-06-01-preview' = {
  name: eventGridTopicName
  location: location
  properties: {
    source: storage.id
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

resource frontDoorProfile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: frontDoorProfileName
  location: 'global'
  sku: { name: 'Standard_AzureFrontDoor' }
}

resource frontDoorEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoorProfile
  name: frontDoorEndpointName
  location: 'global'
  properties: { enabledState: 'Enabled' }
}

resource appOriginGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: 'og-app'
  properties: {
    loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3 }
    healthProbeSettings: {
      probePath: '/'
      probeProtocol: 'Https'
      probeRequestType: 'GET'
      probeIntervalInSeconds: 240
    }
  }
}

resource appOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: appOriginGroup
  name: 'functionapp'
  properties: {
    hostName: functionApp.properties.defaultHostName
    originHostHeader: functionApp.properties.defaultHostName
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
  }
}

resource blobOriginGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: 'og-blob'
  properties: {
    loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3 }
    healthProbeSettings: {
      probePath: '/'
      probeProtocol: 'Https'
      probeRequestType: 'HEAD'
      probeIntervalInSeconds: 240
    }
  }
}

var storageBlobHost = replace(replace(storage.properties.primaryEndpoints.blob, 'https://', ''), '/', '')

resource blobOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: blobOriginGroup
  name: 'blobstorage'
  properties: {
    hostName: storageBlobHost
    originHostHeader: storageBlobHost
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
  }
}

resource imagesRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'images'
  properties: {
    originGroup: { id: blobOriginGroup.id }
    patternsToMatch: [ '/thumbnails/*', '/display/*' ]
    supportedProtocols: [ 'Https' ]
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    cacheConfiguration: {
      queryStringCachingBehavior: 'IgnoreQueryString'
      compressionSettings: { isCompressionEnabled: false }
    }
  }
  dependsOn: [ blobOrigin ]
}

resource appRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: frontDoorEndpoint
  name: 'app'
  properties: {
    originGroup: { id: appOriginGroup.id }
    patternsToMatch: [ '/*' ]
    supportedProtocols: [ 'Https' ]
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
  }
  dependsOn: [ appOrigin ]
}

output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output storageAccountName string = storage.name
output eventGridTopicName string = eventGridTopic.name
output frontDoorEndpointHostName string = frontDoorEndpoint.properties.hostName
