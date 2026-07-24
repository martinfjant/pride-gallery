import { ALBUM_PARTITION, AlbumEntity, getAlbumsTable } from './storage';

export type AlbumSummary = { slug: string; name: string; description: string; createdAt: string };

export async function listAlbumsData(): Promise<AlbumSummary[]> {
  const table = await getAlbumsTable();
  const iterator = table.listEntities<AlbumEntity>({
    queryOptions: { filter: `PartitionKey eq '${ALBUM_PARTITION}'` },
  });

  const albums: AlbumSummary[] = [];
  for await (const entity of iterator) {
    albums.push({
      slug: entity.rowKey,
      name: entity.name,
      description: entity.description,
      createdAt: entity.createdAt,
    });
  }
  albums.sort((a, b) => a.name.localeCompare(b.name));
  return albums;
}
