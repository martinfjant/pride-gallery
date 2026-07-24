import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/storage-blob';
import { containers, getContainer } from '../shared/storage';

const ALLOWED_CONTAINERS = () => new Set([
  containers.originals(),
  containers.thumbnails(),
  containers.display(),
]);

async function devBlobProxyHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const container = request.params.container;
  const album = request.params.album;
  const name = request.params.name;
  if (!container || !album || !name) {
    return { status: 400, jsonBody: { error: 'missing container/album/name' } };
  }
  if (!ALLOWED_CONTAINERS().has(container)) {
    return { status: 404, jsonBody: { error: 'unknown container' } };
  }

  const client = await getContainer(container);
  const blob = client.getBlockBlobClient(`${album}/${name}`);
  try {
    const buffer = await blob.downloadToBuffer();
    const props = await blob.getProperties();
    return {
      status: 200,
      headers: {
        'content-type': props.contentType ?? 'application/octet-stream',
        'cache-control': 'no-store',
      },
      body: buffer,
    };
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return { status: 404, jsonBody: { error: 'blob not found' } };
    }
    throw err;
  }
}

if (process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
  app.http('devBlobProxy', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/debug/blob/{container}/{album}/{name}',
    handler: devBlobProxyHandler,
  });
}
