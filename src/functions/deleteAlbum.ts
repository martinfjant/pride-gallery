import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { checkUploadAuth } from '../shared/auth';
import { isHtmx } from '../shared/requestBody';
import { ALBUM_PARTITION, getAlbumsTable, getPhotosTable, PhotoEntity } from '../shared/storage';
import { purgePhoto } from '../shared/deletePhoto';

async function deleteAlbumHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const authFailure = checkUploadAuth(request);
  if (authFailure) return authFailure;

  const slug = request.params.slug;
  if (!slug) {
    return { status: 400, jsonBody: { error: 'missing slug' } };
  }

  const albumsTable = await getAlbumsTable();
  try {
    await albumsTable.getEntity(ALBUM_PARTITION, slug);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: `album "${slug}" not found` } };
    }
    throw err;
  }

  const photosTable = await getPhotosTable();
  const iterator = photosTable.listEntities<PhotoEntity>({
    queryOptions: { filter: `PartitionKey eq '${slug.replace(/'/g, "''")}'` },
  });

  let photosDeleted = 0;
  const warnings: string[] = [];
  for await (const entity of iterator) {
    warnings.push(...(await purgePhoto(photosTable, entity, context)));
    photosDeleted++;
  }

  await albumsTable.deleteEntity(ALBUM_PARTITION, slug);
  context.log(`deleted album ${slug} (${photosDeleted} photo(s), ${warnings.length} blob warning(s))`);

  // htmx reloads the whole page so the album drops out of the select.
  if (isHtmx(request)) {
    return { status: 200, headers: { 'HX-Redirect': '/api/manage-page' } };
  }
  return { status: 200, jsonBody: { deleted: true, photosDeleted, warnings } };
}

app.http('deleteAlbum', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'api/albums/{slug}',
  handler: deleteAlbumHandler,
});
