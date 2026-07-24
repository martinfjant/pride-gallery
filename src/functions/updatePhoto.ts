import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { checkUploadAuth } from '../shared/auth';
import { getPhotosTable, PhotoEntity } from '../shared/storage';

const PHOTOGRAPHER_MAX = 120;

async function updatePhotoHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const authFailure = checkUploadAuth(request);
  if (authFailure) return authFailure;

  const album = request.params.album;
  const photoId = request.params.photoId;
  if (!album || !photoId) {
    return { status: 400, jsonBody: { error: 'missing album or photoId' } };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, jsonBody: { error: 'expected JSON body' } };
  }
  if (!body || typeof body !== 'object') {
    return { status: 400, jsonBody: { error: 'expected JSON object' } };
  }

  const { photographer } = body as Record<string, unknown>;
  if (photographer === undefined) {
    return { status: 400, jsonBody: { error: 'expected photographer' } };
  }
  if (typeof photographer !== 'string' || photographer.length > PHOTOGRAPHER_MAX) {
    return { status: 400, jsonBody: { error: `photographer must be a string, max ${PHOTOGRAPHER_MAX} chars` } };
  }
  const value = photographer.trim().slice(0, PHOTOGRAPHER_MAX);

  const table = await getPhotosTable();
  try {
    await table.updateEntity<Partial<PhotoEntity>>(
      { partitionKey: album, rowKey: photoId, photographer: value },
      'Merge',
    );
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: `photo not found: ${album}/${photoId}` } };
    }
    throw err;
  }

  context.log(`updated photographer for ${album}/${photoId}`);
  return { status: 200, jsonBody: { album, photoId, photographer: value } };
}

app.http('updatePhoto', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'api/photo/{album}/{photoId}',
  handler: updatePhotoHandler,
});
