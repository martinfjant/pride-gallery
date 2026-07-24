import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { containers, getContainer, getPhotosTable, PhotoEntity } from '../shared/storage';
import { processOriginalImage } from '../shared/processImage';

async function debugProcessHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const album = request.params.album;
  const photoId = request.params.photoId;
  if (!album || !photoId) {
    return { status: 400, jsonBody: { error: 'missing album or photoId' } };
  }

  const table = await getPhotosTable();
  let entity: PhotoEntity;
  try {
    entity = await table.getEntity<PhotoEntity>(album, photoId);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: `photo not found: ${album}/${photoId}` } };
    }
    throw err;
  }

  const container = await getContainer(containers.originals());
  const buffer = await container.getBlockBlobClient(entity.originalBlob).downloadToBuffer();
  const focal = typeof entity.focalX === 'number' && typeof entity.focalY === 'number'
    ? { x: entity.focalX, y: entity.focalY }
    : undefined;
  const result = await processOriginalImage(buffer, album, photoId, focal, context);
  return { status: result.ok ? 200 : 500, jsonBody: result };
}

if (process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
  app.http('debugProcess', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'api/debug/process/{album}/{photoId}',
    handler: debugProcessHandler,
  });
}
