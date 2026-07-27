import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { checkUploadAuth } from '../shared/auth';
import { containers, Focal, getContainer, getPhotosTable, PhotoEntity } from '../shared/storage';
import { processOriginalImage } from '../shared/processImage';

function parseFocal(body: unknown): { focal: Focal | null } | { error: string } {
  if (body === null) return { focal: null };
  if (!body || typeof body !== 'object') return { error: 'förväntade JSON-objekt eller null' };
  const { x, y } = body as Record<string, unknown>;
  if (x === null && y === null) return { focal: null };
  if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) {
    return { error: 'x och y måste vara tal (eller båda null för att rensa)' };
  }
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return { error: 'x och y måste ligga i [0, 1]' };
  }
  return { focal: { x, y } };
}

async function setFocalPointHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const authFailure = checkUploadAuth(request);
  if (authFailure) return authFailure;

  const album = request.params.album;
  const photoId = request.params.photoId;
  if (!album || !photoId) {
    return { status: 400, jsonBody: { error: 'album eller photoId saknas' } };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, jsonBody: { error: 'förväntade JSON-data' } };
  }

  const parsed = parseFocal(body);
  if ('error' in parsed) return { status: 400, jsonBody: { error: parsed.error } };

  const table = await getPhotosTable();
  let entity: PhotoEntity;
  try {
    entity = await table.getEntity<PhotoEntity>(album, photoId);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: `fotot hittades inte: ${album}/${photoId}` } };
    }
    throw err;
  }

  await table.updateEntity(
    {
      partitionKey: album,
      rowKey: photoId,
      focalX: parsed.focal?.x ?? null,
      focalY: parsed.focal?.y ?? null,
    },
    'Merge',
  );

  const container = await getContainer(containers.originals());
  const buffer = await container.getBlockBlobClient(entity.originalBlob).downloadToBuffer();
  const result = await processOriginalImage(buffer, album, photoId, parsed.focal ?? undefined, context);

  return { status: result.ok ? 200 : 500, jsonBody: { focal: parsed.focal, processing: result } };
}

app.http('setFocalPoint', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'api/photo/{album}/{photoId}/focal-point',
  handler: setFocalPointHandler,
});
