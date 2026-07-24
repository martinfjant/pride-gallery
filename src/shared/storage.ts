import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { TableClient } from '@azure/data-tables';

const connection = () => {
  const conn = process.env.PHOTOS_STORAGE_CONNECTION;
  if (!conn) throw new Error('PHOTOS_STORAGE_CONNECTION not set');
  return conn;
};

export const containers = {
  originals: () => process.env.ORIGINALS_CONTAINER ?? 'originals',
  thumbnails: () => process.env.THUMBNAILS_CONTAINER ?? 'thumbnails',
  display: () => process.env.DISPLAY_CONTAINER ?? 'display',
};

export const tableName = () => process.env.PHOTOS_TABLE ?? 'photos';
export const albumsTableName = () => process.env.ALBUMS_TABLE ?? 'albums';

export const ALBUM_PARTITION = 'album';

let blobService: BlobServiceClient | null = null;
export function getBlobService(): BlobServiceClient {
  if (!blobService) blobService = BlobServiceClient.fromConnectionString(connection());
  return blobService;
}

export async function getContainer(name: string): Promise<ContainerClient> {
  const client = getBlobService().getContainerClient(name);
  await client.createIfNotExists();
  return client;
}

let photosTable: TableClient | null = null;
export async function getPhotosTable(): Promise<TableClient> {
  if (!photosTable) {
    photosTable = TableClient.fromConnectionString(connection(), tableName());
    await photosTable.createTable();
  }
  return photosTable;
}

let albumsTable: TableClient | null = null;
export async function getAlbumsTable(): Promise<TableClient> {
  if (!albumsTable) {
    albumsTable = TableClient.fromConnectionString(connection(), albumsTableName());
    await albumsTable.createTable();
  }
  return albumsTable;
}

export type AlbumEntity = {
  partitionKey: typeof ALBUM_PARTITION;
  rowKey: string;
  name: string;
  description: string;
  createdAt: string;
};

export type PhotoEntity = {
  partitionKey: string;
  rowKey: string;
  originalBlob: string;
  thumbnailBlob?: string;
  displayBlob?: string;
  originalFilename: string;
  contentType: string;
  photographer: string;
  width?: number;
  height?: number;
  focalX?: number;
  focalY?: number;
  status: 'pending' | 'ready' | 'failed';
  uploadedAt: string;
  processedAt?: string;
  errorMessage?: string;
};

export type Focal = { x: number; y: number };
