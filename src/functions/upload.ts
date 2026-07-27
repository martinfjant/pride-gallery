import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { checkUploadAuth } from '../shared/auth';
import { ALBUM_PARTITION, containers, getAlbumsTable, getContainer, getPhotosTable, PhotoEntity } from '../shared/storage';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']);

async function albumExists(slug: string): Promise<boolean> {
  try {
    await (await getAlbumsTable()).getEntity(ALBUM_PARTITION, slug);
    return true;
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return false;
    throw err;
  }
}

async function uploadHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const authFailure = checkUploadAuth(request);
  if (authFailure) return authFailure;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return { status: 415, jsonBody: { error: 'förväntade multipart/form-data' } };
  }

  const form = await request.formData();
  const rawAlbum = form.get('album');
  const rawPhotographer = form.get('photographer');
  const file = form.get('file');

  if (typeof rawAlbum !== 'string' || !rawAlbum.trim()) {
    return { status: 400, jsonBody: { error: 'album saknas' } };
  }
  if (!(file instanceof File)) {
    return { status: 400, jsonBody: { error: 'fil saknas' } };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { status: 415, jsonBody: { error: `innehållstypen stöds inte: ${file.type}` } };
  }

  const album = rawAlbum.trim();
  if (!(await albumExists(album))) {
    return { status: 400, jsonBody: { error: `albumet "${album}" finns inte; skapa det först via POST /api/albums` } };
  }
  const photographer = typeof rawPhotographer === 'string' ? rawPhotographer.trim().slice(0, 120) : '';

  const photoId = randomUUID();
  const ext = extname(file.name) || '.jpg';
  const blobName = `${album}/${photoId}${ext}`;

  const container = await getContainer(containers.originals());
  const blob = container.getBlockBlobClient(blobName);
  const bytes = Buffer.from(await file.arrayBuffer());

  await blob.uploadData(bytes, {
    blobHTTPHeaders: { blobContentType: file.type },
    metadata: {
      album,
      photoId,
      originalFilename: encodeURIComponent(file.name),
    },
  });

  const table = await getPhotosTable();
  const entity: PhotoEntity = {
    partitionKey: album,
    rowKey: photoId,
    originalBlob: blobName,
    originalFilename: file.name,
    contentType: file.type,
    photographer,
    status: 'pending',
    uploadedAt: new Date().toISOString(),
  };
  await table.createEntity(entity);

  context.log(`uploaded ${blobName} (${bytes.length} bytes)`);
  return { status: 201, jsonBody: { album, photoId, originalBlob: blobName } };
}

app.http('upload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'api/upload',
  handler: uploadHandler,
});
