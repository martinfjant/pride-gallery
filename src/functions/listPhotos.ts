import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listPhotosData } from '../shared/photos';

async function listPhotosHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const album = request.query.get('album');
  const photos = await listPhotosData(album ?? undefined);
  return { jsonBody: { photos } };
}

app.http('listPhotos', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/photos',
  handler: listPhotosHandler,
});
