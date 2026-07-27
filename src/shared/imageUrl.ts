export type ImageContainer = 'originals' | 'thumbnails' | 'display';
export type ImageFormat = 'jpg' | 'webp' | 'avif';

export function imageBase(): string {
  // Default '' → root-relative /thumbnails/… and /display/… URLs, which Front
  // Door serves directly from Blob storage on the cached `images` route
  // (x-cache TCP_HIT). Local dev sets PUBLIC_IMAGE_BASE=/api/image
  // (local.settings.json) to route through the image.ts proxy, since there is
  // no Front Door blob route locally.
  //
  // NB: the default must be '' (not '/api/image') because Azure Functions does
  // not inject empty-string app settings into the process — so an infra setting
  // of PUBLIC_IMAGE_BASE='' arrives as `undefined` here and must resolve to the
  // CDN path, not the uncached function proxy.
  return process.env.PUBLIC_IMAGE_BASE ?? '';
}

export function imageUrl(container: ImageContainer, album: string, photoId: string, format: ImageFormat = 'jpg'): string {
  return `${imageBase()}/${container}/${encodeURIComponent(album)}/${encodeURIComponent(photoId)}.${format}`;
}
