import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listAlbumsData } from '../shared/albums';

async function listAlbumsHandler(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const albums = await listAlbumsData();
  return { jsonBody: { albums } };
}

app.http('listAlbums', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/albums',
  handler: listAlbumsHandler,
});
