#!/usr/bin/env bash
set -euo pipefail

# Deploy Pride Gallery to Azure.
# Prereqs:
#   - az login (and az account set --subscription <id> if you have multiple)
#   - node + npm on PATH (for the build step)
# Required env var:
#   UPLOAD_PASSWORD  the interim upload password (KEEP SECRET)
# Optional env vars:
#   LOCATION         Azure region (default: swedencentral)
#   RESOURCE_GROUP   existing RG to deploy into (default: martin-playground)
#   BASE_NAME        short name for resources (default: pridegal)

: "${UPLOAD_PASSWORD:?export UPLOAD_PASSWORD before running}"
: "${LOCATION:=swedencentral}"
: "${RESOURCE_GROUP:=martin-playground}"
: "${BASE_NAME:=pridegal}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DEPLOYMENT_NAME="pride-gallery-$(date +%s)"

echo "==> Provisioning infrastructure (this can take 3-6 minutes)"
az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters \
    location="$LOCATION" \
    baseName="$BASE_NAME" \
    uploadPassword="$UPLOAD_PASSWORD" \
  --output none

FUNC_APP=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query properties.outputs.functionAppName.value -o tsv)
STORAGE=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query properties.outputs.storageAccountName.value -o tsv)
FUNC_URL=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query properties.outputs.functionAppUrl.value -o tsv)
FRONTDOOR_HOST=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query properties.outputs.frontDoorEndpointHostName.value -o tsv)
# The system topic name is deterministic (see resources.bicep: evgt-<baseName>-storage),
# so derive it rather than depend on a deployment output.
EG_TOPIC="evgt-${BASE_NAME}-storage"
# Storage account resource id — needed for the Event Grid dead-letter endpoint.
STORAGE_ID=$(az storage account show --resource-group "$RESOURCE_GROUP" --name "$STORAGE" --query id -o tsv)
DEADLETTER_ENDPOINT="${STORAGE_ID}/blobServices/default/containers/deadletters"

echo "    Function App:    $FUNC_APP"
echo "    Storage Account: $STORAGE"
echo "    Front Door:      https://$FRONTDOOR_HOST"

echo "==> Building code"
rm -rf dist
npm run build >/dev/null

echo "==> Installing production dependencies for deploy"
# config-zip does not reliably trigger a remote Kudu/Oryx build for this
# Function App, so node_modules must be bundled locally into the zip.
STAGE_DIR=$(mktemp -d)
trap 'rm -rf "$STAGE_DIR"' EXIT
cp package.json package-lock.json "$STAGE_DIR/"
# Force linux/x64/glibc binaries (e.g. sharp) regardless of the host OS/arch
# running this script, since the Function App runs on Linux.
npm ci --omit=dev --os=linux --cpu=x64 --libc=glibc --prefix "$STAGE_DIR" >/dev/null

echo "==> Packaging deploy.zip"
rm -f deploy.zip
zip -qr deploy.zip host.json package.json package-lock.json dist public
(cd "$STAGE_DIR" && zip -qr "$REPO_ROOT/deploy.zip" node_modules)

echo "==> Uploading code (this can take a couple of minutes)"
az functionapp deployment source config-zip \
  -g "$RESOURCE_GROUP" \
  -n "$FUNC_APP" \
  --src deploy.zip \
  --output none

rm -f deploy.zip

echo "==> Setting a stable blobs_extension system key"
# The blobs_extension system key secures the EventGrid webhook that drives the
# generateThumbnail blob trigger. Two gotchas on the v4 Node model +
# run-from-package + Linux Consumption:
#   1. The ARM keys API (`az functionapp keys list`) reports an empty systemKeys
#      map even though the key exists — the key is only visible via the Functions
#      host admin endpoint (`/admin/host/systemkeys/...`).
#   2. The AUTO-generated key regenerates on host restarts, which silently breaks
#      the EventGrid subscription (EG gets 401 and drops BlobCreated events, so
#      thumbnails stop generating with no error surfaced anywhere).
# Fix: wait for the host + blob extension to come up, then explicitly PUT a key
# we generate. An explicitly-set key is durable across restarts, so the EG
# subscription URL below keeps working indefinitely.
MASTER_KEY=""
for i in $(seq 1 40); do
  MASTER_KEY=$(az functionapp keys list --name "$FUNC_APP" --resource-group "$RESOURCE_GROUP" --query "masterKey" -o tsv 2>/dev/null || echo "")
  if [ -n "$MASTER_KEY" ] && [ "$MASTER_KEY" != "null" ]; then break; fi
  sleep 6
done
if [ -z "$MASTER_KEY" ] || [ "$MASTER_KEY" = "null" ]; then
  echo "!!! Could not obtain the Function App master key after 4 min."
  echo "!!! Wait another minute, then re-run this script — it's idempotent."
  exit 1
fi

# Wait until the blob extension has initialized (its auto key exists), so our
# explicit PUT overrides a live key rather than racing extension startup.
for i in $(seq 1 40); do
  EXISTING=$(curl -s "${FUNC_URL}/admin/host/systemkeys/blobs_extension?code=${MASTER_KEY}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('value',''))" 2>/dev/null || echo "")
  if [ -n "$EXISTING" ]; then break; fi
  sleep 6
done

SYSTEM_KEY=$(python3 -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(40)).decode().rstrip('='))")
SET_OK=""
for i in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "${FUNC_URL}/admin/host/systemkeys/blobs_extension?code=${MASTER_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"blobs_extension\",\"value\":\"${SYSTEM_KEY}\"}")
  if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then SET_OK=1; break; fi
  sleep 6
done
if [ -z "$SET_OK" ]; then
  echo "!!! Could not set the blobs_extension system key (host not ready after several min)."
  echo "!!! Wait another minute, then re-run this script — it's idempotent."
  exit 1
fi

echo "==> Wiring Event Grid subscription (BlobCreated -> generateThumbnail)"
HOOK_URL="${FUNC_URL}/runtime/webhooks/blobs?functionName=Host.Functions.generateThumbnail&code=${SYSTEM_KEY}"

# NOTE: `az eventgrid system-topic event-subscription create` frequently reports
#   (ResourceNotFound) ... Microsoft.EventGrid/systemTopics/eventSubscriptions ... was not found
# even on success: after the PUT it immediately polls with a GET, and ARM can
# return a transient 404 before the new subscription is queryable (eventual
# consistency, especially in Sweden Central). The subscription still provisions.
# So we don't trust the create/update exit code — we verify provisioningState
# below and only fail if it never reaches Succeeded.
if az eventgrid system-topic event-subscription show \
      --name pride-gallery-blob-created \
      --resource-group "$RESOURCE_GROUP" \
      --system-topic-name "$EG_TOPIC" >/dev/null 2>&1; then
  az eventgrid system-topic event-subscription update \
    --name pride-gallery-blob-created \
    --resource-group "$RESOURCE_GROUP" \
    --system-topic-name "$EG_TOPIC" \
    --endpoint "$HOOK_URL" \
    --endpoint-type webhook \
    --output none 2>/dev/null || true
else
  az eventgrid system-topic event-subscription create \
    --name pride-gallery-blob-created \
    --resource-group "$RESOURCE_GROUP" \
    --system-topic-name "$EG_TOPIC" \
    --endpoint "$HOOK_URL" \
    --endpoint-type webhook \
    --included-event-types Microsoft.Storage.BlobCreated \
    --subject-begins-with "/blobServices/default/containers/originals/" \
    --output none 2>/dev/null || true
fi

echo "==> Verifying Event Grid subscription provisioned"
EG_STATE=""
for i in $(seq 1 20); do
  EG_STATE=$(az eventgrid system-topic event-subscription show \
    --name pride-gallery-blob-created \
    --resource-group "$RESOURCE_GROUP" \
    --system-topic-name "$EG_TOPIC" \
    --query provisioningState -o tsv 2>/dev/null || echo "")
  if [ "$EG_STATE" = "Succeeded" ]; then break; fi
  if [ "$EG_STATE" = "Failed" ] || [ "$EG_STATE" = "Canceled" ]; then break; fi
  sleep 6
done
if [ "$EG_STATE" != "Succeeded" ]; then
  echo "!!! Event Grid subscription did not reach Succeeded (state: '${EG_STATE:-<none>}')."
  echo "!!! New uploads won't generate thumbnails until this is wired."
  echo "!!! Wait a minute, then re-run this script — it's idempotent."
  exit 1
fi
echo "    Event Grid subscription: Succeeded"

# Best-effort: attach the dead-letter sink so dropped BlobCreated events land in
# the 'deadletters' container instead of vanishing. Done as a separate step
# AFTER the subscription is confirmed healthy, and never allowed to fail the
# deploy — it's observability, not the functional path (reconcilePending is).
# It may be rejected in tenants where Event Grid lacks write access to the
# storage account (e.g. Contributor-only rights, no role-assignment ability).
echo "==> Attaching Event Grid dead-letter sink (best-effort)"
if az eventgrid system-topic event-subscription update \
      --name pride-gallery-blob-created \
      --resource-group "$RESOURCE_GROUP" \
      --system-topic-name "$EG_TOPIC" \
      --deadletter-endpoint "$DEADLETTER_ENDPOINT" \
      --output none 2>/dev/null; then
  echo "    Dead-letter sink: deadletters container"
else
  echo "    Dead-letter sink: skipped (Event Grid lacks write access to storage; non-fatal)"
fi

# Monthly cost budget (#17). Kept out of Bicep because a budget's startDate must be
# a valid recent first-of-month; computing it here keeps redeploys from being rejected
# by a stale hardcoded date. Idempotent PUT — safe to re-run.
: "${BUDGET_AMOUNT:=200}"
: "${ALERT_EMAILS:=martin.falk.johansson@stockholmpride.org martin@falkjohansson.se}"
echo "==> Ensuring monthly cost budget (${BUDGET_AMOUNT}/mo)"
SUB_ID=$(az account show --query id -o tsv)
BUDGET_START="$(date -u +%Y-%m-01)T00:00:00Z"
# Build the contactEmails JSON array from the space-separated ALERT_EMAILS.
EMAILS_JSON=$(printf '%s\n' $ALERT_EMAILS | awk 'BEGIN{s=""}{printf "%s\"%s\"", s, $0; s=","}')
if az rest --method put \
      --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Consumption/budgets/budget-${BASE_NAME}-monthly?api-version=2023-11-01" \
      --body "{\"properties\":{\"category\":\"Cost\",\"amount\":${BUDGET_AMOUNT},\"timeGrain\":\"Monthly\",\"timePeriod\":{\"startDate\":\"${BUDGET_START}\",\"endDate\":\"2030-07-01T00:00:00Z\"},\"notifications\":{\"actual_80\":{\"enabled\":true,\"operator\":\"GreaterThanOrEqualTo\",\"threshold\":80,\"thresholdType\":\"Actual\",\"contactEmails\":[${EMAILS_JSON}]},\"actual_100\":{\"enabled\":true,\"operator\":\"GreaterThanOrEqualTo\",\"threshold\":100,\"thresholdType\":\"Actual\",\"contactEmails\":[${EMAILS_JSON}]},\"forecast_100\":{\"enabled\":true,\"operator\":\"GreaterThanOrEqualTo\",\"threshold\":100,\"thresholdType\":\"Forecasted\",\"contactEmails\":[${EMAILS_JSON}]}}}}" \
      --output none 2>/dev/null; then
  echo "    Budget: budget-${BASE_NAME}-monthly (start ${BUDGET_START%%T*})"
else
  echo "    Budget: skipped (no Microsoft.Consumption write access; non-fatal)"
fi

echo
echo "Deployed. Front Door can take 5-10 min to finish propagating on first deploy."
echo "Once propagated, the site (pages + images) is served entirely through Front Door:"
echo "    https://${FRONTDOOR_HOST}/"
echo "    https://${FRONTDOOR_HOST}/api/upload-page"
echo
echo "The direct Function App URL still works for pages/API, but thumbnail/display"
echo "images will 404 there (they're only routed via Front Door -> Blob Storage):"
echo "    ${FUNC_URL}/"
echo
echo "Upload password: use the value of UPLOAD_PASSWORD you set for this run."
