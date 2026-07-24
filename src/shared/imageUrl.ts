export type ImageContainer = 'originals' | 'thumbnails' | 'display';
export type ImageFormat = 'jpg' | 'webp' | 'avif';

export function imageBase(): string {
  return process.env.PUBLIC_IMAGE_BASE ?? '/api/image';
}

export function imageUrl(container: ImageContainer, album: string, photoId: string, format: ImageFormat = 'jpg'): string {
  return `${imageBase()}/${container}/${encodeURIComponent(album)}/${encodeURIComponent(photoId)}.${format}`;
}
