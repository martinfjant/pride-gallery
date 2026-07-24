import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { Html } from '@kitajs/html';
import { checkUploadAuth } from '../shared/auth';
import { isHtmx, readBody } from '../shared/requestBody';
import { ALBUM_PARTITION, AlbumEntity, getAlbumsTable } from '../shared/storage';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

// Album pages are served at the site root (`/{slug}`), so a slug must not
// shadow a real top-level path. Everything under `/api/` is already namespaced
// away, so this only needs to reserve the `api` segment plus a few words we may
// want to hand out at the root later (favicon, health checks, etc.).
const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'assets',
  'static',
  'public',
  'favicon',
  'robots',
  'sitemap',
  'health',
  'healthz',
  'about',
]);

async function createAlbumHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const htmx = isHtmx(request);

  // For htmx callers, surface failures as an HTML fragment (swapped into the
  // modal's #create-error) with a 200 so htmx renders it. JSON callers still
  // get the proper status code.
  const fail = (message: string, status: number): HttpResponseInit =>
    htmx
      ? { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: Html.escapeHtml(message) }
      : { status, jsonBody: { error: message } };

  const authFailure = checkUploadAuth(request);
  if (authFailure) {
    return htmx ? fail('Password required or incorrect — check the password field at the top of the page.', 401) : authFailure;
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return fail('expected JSON or form body', 400);
  }

  const { slug, name, description } = body;

  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return fail('Invalid slug (lowercase letters/digits/dashes, 1–60 chars, must start and end with alphanumeric).', 400);
  }
  if (RESERVED_SLUGS.has(slug)) {
    return fail(`"${slug}" is a reserved word and can't be used as an album slug.`, 400);
  }
  if (typeof name !== 'string' || !name.trim() || name.length > NAME_MAX) {
    return fail(`Name required, max ${NAME_MAX} chars.`, 400);
  }
  if (typeof description !== 'string' || !description.trim() || description.length > DESCRIPTION_MAX) {
    return fail(`Description required, max ${DESCRIPTION_MAX} chars.`, 400);
  }

  const entity: AlbumEntity = {
    partitionKey: ALBUM_PARTITION,
    rowKey: slug,
    name: name.trim(),
    description: description.trim(),
    createdAt: new Date().toISOString(),
  };

  const table = await getAlbumsTable();
  try {
    await table.createEntity(entity);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 409) {
      return fail(`An album with the slug "${slug}" already exists.`, 409);
    }
    throw err;
  }

  // Reload the upload page with the new album pre-selected.
  if (htmx) {
    return { status: 200, headers: { 'HX-Redirect': `/api/upload-page?album=${encodeURIComponent(slug)}` } };
  }
  return {
    status: 201,
    jsonBody: { slug: entity.rowKey, name: entity.name, description: entity.description, createdAt: entity.createdAt },
  };
}

app.http('createAlbum', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'api/albums',
  handler: createAlbumHandler,
});
