import { InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { containers, getContainer, PhotoEntity } from './storage';

export async function purgePhoto(table: TableClient, entity: PhotoEntity, context: InvocationContext): Promise<string[]> {
  const blobTargets: Array<{ container: string; name: string }> = [
    { container: containers.originals(), name: entity.originalBlob },
  ];
  if (entity.thumbnailBlob) {
    blobTargets.push({ container: containers.thumbnails(), name: entity.thumbnailBlob });
    blobTargets.push({ container: containers.thumbnails(), name: entity.thumbnailBlob.replace(/\.jpg$/i, '.webp') });
  }
  if (entity.displayBlob) {
    blobTargets.push({ container: containers.display(), name: entity.displayBlob });
    blobTargets.push({ container: containers.display(), name: entity.displayBlob.replace(/\.jpg$/i, '.webp') });
  }

  const warnings: string[] = [];
  for (const target of blobTargets) {
    try {
      const client = await getContainer(target.container);
      await client.getBlockBlobClient(target.name).deleteIfExists();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`${target.container}/${target.name}: ${msg}`);
      context.error(`delete failed for ${target.container}/${target.name}: ${msg}`);
    }
  }

  await table.deleteEntity(entity.partitionKey, entity.rowKey);
  return warnings;
}
