targetScope = 'resourceGroup'

@description('Azure region')
param location string = 'swedencentral'

@description('Short base name for resources (3-8 lowercase alphanumeric chars)')
@minLength(3)
@maxLength(8)
param baseName string = 'pridegal'

@description('Password required to upload/mutate content')
@secure()
param uploadPassword string

module resources 'resources.bicep' = {
  name: 'pride-gallery-resources'
  params: {
    location: location
    baseName: baseName
    uploadPassword: uploadPassword
  }
}

output resourceGroupName string = resourceGroup().name
output functionAppName string = resources.outputs.functionAppName
output functionAppUrl string = resources.outputs.functionAppUrl
output storageAccountName string = resources.outputs.storageAccountName
output frontDoorEndpointHostName string = resources.outputs.frontDoorEndpointHostName
