import { app, InvocationContext } from '@azure/functions';
import { RestError } from '@azure/data-tables';
import { Focal, getPhotosTable, PhotoEntity } from '../shared/storage';
import { processOriginalImage } from '../shared/processImage';

async function readFocal(album: string, photoId: string): Promise<Focal | undefined> {
  try {
    const entity = await (await getPhotosTable()).getEntity<PhotoEntity>(album, photoId);
    if (typeof entity.focalX === 'number' && typeof entity.focalY === 'number') {
      return { x: entity.focalX, y: entity.focalY };
    }
    return undefined;
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return undefined;
    throw err;
  }
}

async function generateThumbnailHandler(blob: unknown, context: InvocationContext): Promise<void> {
  const trigger = context.triggerMetadata ?? {};
  const blobName = String(trigger.name ?? trigger.blobTrigger ?? '');
  if (!blobName) {
    context.error('blob trigger fired without a name');
    return;
  }

  const [album, filename] = blobName.split('/');
  if (!album || !filename) {
    context.error(`unexpected blob path: ${blobName}`);
    return;
  }
  const photoId = filename.replace(/\.[^.]+$/, '');
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob as ArrayBuffer);
  const focal = await readFocal(album, photoId);

  await processOriginalImage(buf, album, photoId, focal, context);
}

app.storageBlob('generateThumbnail', {
  path: `${process.env.ORIGINALS_CONTAINER ?? 'originals'}/{name}`,
  connection: 'PHOTOS_STORAGE_CONNECTION',
  source: 'EventGrid',
  handler: generateThumbnailHandler,
});
