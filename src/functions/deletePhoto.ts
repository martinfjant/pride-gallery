import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { checkUploadAuth } from '../shared/auth';
import { getPhotosTable, PhotoEntity } from '../shared/storage';
import { purgePhoto } from '../shared/deletePhoto';

async function deletePhotoHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const authFailure = checkUploadAuth(request);
  if (authFailure) return authFailure;

  const album = request.params.album;
  const photoId = request.params.photoId;
  if (!album || !photoId) {
    return { status: 400, jsonBody: { error: 'album eller photoId saknas' } };
  }

  const table = await getPhotosTable();
  let entity: PhotoEntity | null = null;
  try {
    entity = await table.getEntity<PhotoEntity>(album, photoId);
  } catch (err) {
    if (!(err instanceof RestError && err.statusCode === 404)) throw err;
  }

  if (!entity) {
    return { status: 200, jsonBody: { deleted: false, note: 'photo already gone' } };
  }

  const warnings = await purgePhoto(table, entity, context);
  context.log(`deleted ${album}/${photoId}${warnings.length ? ` (${warnings.length} blob warning(s))` : ''}`);
  return { status: 200, jsonBody: { deleted: true, warnings } };
}

app.http('deletePhoto', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'api/photo/{album}/{photoId}',
  handler: deletePhotoHandler,
});
