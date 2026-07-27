import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { checkUploadAuth } from '../shared/auth';
import { isHtmx, readBody } from '../shared/requestBody';
import { ALBUM_PARTITION, AlbumEntity, getAlbumsTable } from '../shared/storage';

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

async function updateAlbumHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const authFailure = checkUploadAuth(request);
  if (authFailure) return authFailure;

  const slug = request.params.slug;
  if (!slug) {
    return { status: 400, jsonBody: { error: 'slug saknas' } };
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return { status: 400, jsonBody: { error: 'förväntade JSON- eller formulärdata' } };
  }

  const { name, description } = body;
  if (name === undefined && description === undefined) {
    return { status: 400, jsonBody: { error: 'förväntade namn och/eller beskrivning' } };
  }

  const update: { partitionKey: string; rowKey: string } & Partial<AlbumEntity> = {
    partitionKey: ALBUM_PARTITION,
    rowKey: slug,
  };
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > NAME_MAX) {
      return { status: 400, jsonBody: { error: `namn måste vara en icke-tom text, högst ${NAME_MAX} tecken` } };
    }
    update.name = name.trim();
  }
  if (description !== undefined) {
    if (typeof description !== 'string' || !description.trim() || description.length > DESCRIPTION_MAX) {
      return { status: 400, jsonBody: { error: `beskrivning måste vara en icke-tom text, högst ${DESCRIPTION_MAX} tecken` } };
    }
    update.description = description.trim();
  }

  const table = await getAlbumsTable();
  try {
    await table.updateEntity(update, 'Merge');
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: `albumet "${slug}" hittades inte` } };
    }
    throw err;
  }

  const entity = await table.getEntity<AlbumEntity>(ALBUM_PARTITION, slug);
  if (isHtmx(request)) {
    return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: 'Saved ✓' };
  }
  return {
    status: 200,
    jsonBody: { slug: entity.rowKey, name: entity.name, description: entity.description, createdAt: entity.createdAt },
  };
}

app.http('updateAlbum', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'api/albums/{slug}',
  handler: updateAlbumHandler,
});
