import { getPhotosTable, PhotoEntity } from './storage';

export async function listPhotosData(album?: string): Promise<Array<Partial<PhotoEntity>>> {
  const table = await getPhotosTable();
  const filter = album ? `PartitionKey eq '${album.replace(/'/g, "''")}'` : undefined;
  const iterator = table.listEntities<PhotoEntity>({ queryOptions: filter ? { filter } : undefined });

  const photos: Array<Partial<PhotoEntity>> = [];
  for await (const entity of iterator) {
    photos.push({
      partitionKey: entity.partitionKey,
      rowKey: entity.rowKey,
      thumbnailBlob: entity.thumbnailBlob,
      displayBlob: entity.displayBlob,
      originalFilename: entity.originalFilename,
      photographer: entity.photographer,
      width: entity.width,
      height: entity.height,
      focalX: entity.focalX,
      focalY: entity.focalY,
      status: entity.status,
      uploadedAt: entity.uploadedAt,
      pipelineVersion: entity.pipelineVersion,
    });
  }
  return photos;
}
