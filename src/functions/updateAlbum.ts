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
    return { status: 400, jsonBody: { error: 'missing slug' } };
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return { status: 400, jsonBody: { error: 'expected JSON or form body' } };
  }

  const { name, description } = body;
  if (name === undefined && description === undefined) {
    return { status: 400, jsonBody: { error: 'expected name and/or description' } };
  }

  const update: { partitionKey: string; rowKey: string } & Partial<AlbumEntity> = {
    partitionKey: ALBUM_PARTITION,
    rowKey: slug,
  };
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > NAME_MAX) {
      return { status: 400, jsonBody: { error: `name must be a non-empty string, max ${NAME_MAX} chars` } };
    }
    update.name = name.trim();
  }
  if (description !== undefined) {
    if (typeof description !== 'string' || !description.trim() || description.length > DESCRIPTION_MAX) {
      return { status: 400, jsonBody: { error: `description must be a non-empty string, max ${DESCRIPTION_MAX} chars` } };
    }
    update.description = description.trim();
  }

  const table = await getAlbumsTable();
  try {
    await table.updateEntity(update, 'Merge');
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: `album "${slug}" not found` } };
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
