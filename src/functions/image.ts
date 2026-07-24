import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { RestError } from '@azure/storage-blob';
import { containers, getContainer } from '../shared/storage';

const publicContainers = () => new Set([
  containers.thumbnails(),
  containers.display(),
]);

async function imageHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const container = request.params.container;
  const album = request.params.album;
  const name = request.params.name;
  if (!container || !album || !name) {
    return { status: 400, jsonBody: { error: 'missing container/album/name' } };
  }
  if (!publicContainers().has(container)) {
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
        'cache-control': 'public, max-age=31536000, immutable',
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

app.http('image', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/image/{container}/{album}/{name}',
  handler: imageHandler,
});
