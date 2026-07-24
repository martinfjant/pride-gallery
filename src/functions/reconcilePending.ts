import { app, InvocationContext, Timer } from '@azure/functions';
import { containers, getContainer, getPhotosTable, PhotoEntity } from '../shared/storage';
import { processOriginalImage } from '../shared/processImage';

// Event Grid delivery is at-least-once but not guaranteed: a BlobCreated event
// can be dropped when the Consumption-plan host is cold/scaling during an upload
// burst. With no dead-letter that photo stays status='pending' with no thumbnail
// forever — invisible to the gallery, recoverable only by manually toggling the
// focal point. This timer sweeps for such stragglers and reprocesses them.

// Only touch photos whose upload is old enough that a legitimately in-flight
// Event Grid delivery would already have completed — avoids racing normal
// processing on freshly uploaded photos.
const STALE_AFTER_MS = Number(process.env.RECONCILE_STALE_AFTER_MS ?? 3 * 60 * 1000);
// Bound work per run so we stay well under the Consumption execution limit.
const MAX_PER_RUN = Number(process.env.RECONCILE_MAX_PER_RUN ?? 50);

async function reconcilePendingHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  const table = await getPhotosTable();
  const cutoff = Date.now() - STALE_AFTER_MS;

  // We only pick up 'pending' (never-processed) photos. 'failed' photos have
  // already run processImage and errored (e.g. a corrupt file); reprocessing
  // them here would loop every tick, so we leave those for manual inspection.
  const iterator = table.listEntities<PhotoEntity>({
    queryOptions: { filter: `status eq 'pending'` },
  });

  const stale: PhotoEntity[] = [];
  for await (const entity of iterator) {
    if (entity.thumbnailBlob) continue; // defensive: already has a thumbnail
    const uploadedMs = Date.parse(entity.uploadedAt ?? '');
    if (Number.isNaN(uploadedMs) || uploadedMs > cutoff) continue;
    stale.push(entity);
    if (stale.length >= MAX_PER_RUN) break;
  }

  if (stale.length === 0) {
    context.log('reconcilePending: nothing to do');
    return;
  }

  context.log(`reconcilePending: found ${stale.length} stale pending photo(s), reprocessing`);
  const originals = await getContainer(containers.originals());

  let ok = 0;
  let failed = 0;
  // Sequential: sharp is memory-heavy and the Y1 plan has little headroom.
  for (const entity of stale) {
    const album = entity.partitionKey;
    const photoId = entity.rowKey;
    try {
      const buffer = await originals.getBlockBlobClient(entity.originalBlob).downloadToBuffer();
      const focal = typeof entity.focalX === 'number' && typeof entity.focalY === 'number'
        ? { x: entity.focalX, y: entity.focalY }
        : undefined;
      const result = await processOriginalImage(buffer, album, photoId, focal, context);
      if (result.ok) ok++; else failed++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      context.error(`reconcilePending: failed to reprocess ${album}/${photoId}: ${message}`);
    }
  }

  context.log(`reconcilePending: done — ${ok} recovered, ${failed} failed`);
}

app.timer('reconcilePending', {
  // Every 5 minutes. Timer triggers are singletons, so runs never overlap.
  schedule: process.env.RECONCILE_SCHEDULE ?? '0 */5 * * * *',
  handler: reconcilePendingHandler,
});
