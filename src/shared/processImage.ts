import sharp from 'sharp';
import { InvocationContext } from '@azure/functions';
import { containers, Focal, getContainer, getPhotosTable } from './storage';

const THUMB_SIZE = 480;
const DISPLAY_WIDTH = 2400;
const JPEG_QUALITY_THUMB = 78;
const JPEG_QUALITY_DISPLAY = 82;
const WEBP_QUALITY_THUMB = 72;
const WEBP_QUALITY_DISPLAY = 78;

export type ProcessResult =
  | { ok: true; album: string; photoId: string; thumbBytes: number; displayBytes: number; width?: number; height?: number }
  | { ok: false; album: string; photoId: string; errorMessage: string };

function computeSquareCrop(width: number, height: number, focal: Focal): { left: number; top: number; side: number } {
  const side = Math.min(width, height);
  let left = Math.round(focal.x * width - side / 2);
  let top = Math.round(focal.y * height - side / 2);
  left = Math.max(0, Math.min(width - side, left));
  top = Math.max(0, Math.min(height - side, top));
  return { left, top, side };
}

function squareThumbnailPipeline(buf: Buffer, effW: number, effH: number, focal: Focal | undefined): sharp.Sharp {
  const base = sharp(buf).rotate();
  if (focal && effW > 0 && effH > 0) {
    const { left, top, side } = computeSquareCrop(effW, effH, focal);
    return base.extract({ left, top, width: side, height: side }).resize({ width: THUMB_SIZE, height: THUMB_SIZE });
  }
  return base.resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'cover', position: sharp.strategy.attention });
}

export async function processOriginalImage(
  buf: Buffer,
  album: string,
  photoId: string,
  focal: Focal | undefined,
  context: Pick<InvocationContext, 'log' | 'error'>,
): Promise<ProcessResult> {
  const table = await getPhotosTable();
  const thumbContainer = await getContainer(containers.thumbnails());
  const displayContainer = await getContainer(containers.display());

  try {
    const meta = await sharp(buf).metadata();
    const orientation = meta.orientation ?? 1;
    const swap = orientation >= 5 && orientation <= 8;
    const effW = (swap ? meta.height : meta.width) ?? 0;
    const effH = (swap ? meta.width : meta.height) ?? 0;

    const thumbName = `${album}/${photoId}.jpg`;
    const thumbNameWebp = `${album}/${photoId}.webp`;
    const displayName = `${album}/${photoId}.jpg`;
    const displayNameWebp = `${album}/${photoId}.webp`;

    const thumbPipeline = squareThumbnailPipeline(buf, effW, effH, focal);
    const [thumbBuf, thumbBufWebp] = await Promise.all([
      thumbPipeline.clone().jpeg({ quality: JPEG_QUALITY_THUMB, mozjpeg: true }).toBuffer(),
      thumbPipeline.clone().webp({ quality: WEBP_QUALITY_THUMB }).toBuffer(),
    ]);

    const displayPipeline = sharp(buf).rotate().resize({ width: DISPLAY_WIDTH, withoutEnlargement: true });
    const [displayBuf, displayBufWebp] = await Promise.all([
      displayPipeline.clone().jpeg({ quality: JPEG_QUALITY_DISPLAY, mozjpeg: true }).toBuffer(),
      displayPipeline.clone().webp({ quality: WEBP_QUALITY_DISPLAY }).toBuffer(),
    ]);

    await thumbContainer.getBlockBlobClient(thumbName).uploadData(thumbBuf, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg', blobCacheControl: 'public, max-age=31536000, immutable' },
    });
    await thumbContainer.getBlockBlobClient(thumbNameWebp).uploadData(thumbBufWebp, {
      blobHTTPHeaders: { blobContentType: 'image/webp', blobCacheControl: 'public, max-age=31536000, immutable' },
    });
    await displayContainer.getBlockBlobClient(displayName).uploadData(displayBuf, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg', blobCacheControl: 'public, max-age=31536000, immutable' },
    });
    await displayContainer.getBlockBlobClient(displayNameWebp).uploadData(displayBufWebp, {
      blobHTTPHeaders: { blobContentType: 'image/webp', blobCacheControl: 'public, max-age=31536000, immutable' },
    });

    await table.updateEntity(
      {
        partitionKey: album,
        rowKey: photoId,
        thumbnailBlob: thumbName,
        displayBlob: displayName,
        width: effW,
        height: effH,
        status: 'ready',
        processedAt: new Date().toISOString(),
      },
      'Merge',
    );

    context.log(`processed ${album}/${photoId} → thumb ${thumbBuf.length}B (webp ${thumbBufWebp.length}B), display ${displayBuf.length}B (webp ${displayBufWebp.length}B), focal=${focal ? `${focal.x.toFixed(2)},${focal.y.toFixed(2)}` : 'auto'}`);
    return { ok: true, album, photoId, thumbBytes: thumbBuf.length, displayBytes: displayBuf.length, width: effW, height: effH };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    context.error(`failed to process ${album}/${photoId}: ${errorMessage}`);
    await table.updateEntity(
      { partitionKey: album, rowKey: photoId, status: 'failed', errorMessage },
      'Merge',
    );
    return { ok: false, album, photoId, errorMessage };
  }
}
