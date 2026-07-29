import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IndexPage } from '../pages/index';
import { AlbumPage } from '../pages/album';
import { UploadPage } from '../pages/upload';
import { ManagePage } from '../pages/manage';
import { ManageAlbumPanel } from '../pages/managePanel';
import { listAlbumsData } from '../shared/albums';
import { listPhotosData } from '../shared/photos';
import { photoHasAvif } from '../shared/storage';
import { ASSETS, Asset } from '../shared/assets';

function serveHtml(element: JSX.Element): HttpResponseInit {
  return {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: element as string,
  };
}

function serveAsset(asset: Asset): HttpResponseInit {
  return {
    status: 200,
    headers: {
      'content-type': asset.contentType,
      // The URL embeds a content hash (see shared/assets.ts), so a changed file
      // always ships under a new URL. That makes it safe to cache forever and
      // lets Front Door serve these gzip/brotli-compressed — compression on
      // Front Door only applies to cacheable routes.
      'cache-control': 'public, max-age=31536000, immutable',
      // Explicit Content-Length makes the Functions host send a fixed-length
      // response instead of Transfer-Encoding: chunked. Front Door does NOT
      // compress chunked-transfer responses, so without this the gzip/brotli
      // edge compression on the app-assets route silently never kicks in.
      'content-length': asset.byteLength.toString(),
    },
    body: asset.body,
  };
}

const binaryCache = new Map<string, Buffer>();

// Binary assets (fonts) can't go through serveStaticAsset — that reads utf-8 and
// would corrupt the bytes. Fonts are content-hashed by us and immutable, so they
// get a long, immutable cache lifetime rather than the 5-minute one above.
async function serveStaticBinary(filename: string, contentType: string): Promise<HttpResponseInit> {
  let buf = binaryCache.get(filename);
  if (buf === undefined) {
    buf = await readFile(join(process.cwd(), 'public', filename));
    binaryCache.set(filename, buf);
  }
  return {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: buf,
  };
}

async function galleryIndexHandler(): Promise<HttpResponseInit> {
  const albums = await listAlbumsData();
  const summaries = await Promise.all(albums.map(async (album) => {
    const photos = await listPhotosData(album.slug);
    const ready = photos.filter((p) => p.status === 'ready' && p.thumbnailBlob);
    return { ...album, count: ready.length, coverRowKey: ready[0]?.rowKey, coverHasAvif: ready[0] ? photoHasAvif(ready[0]) : false };
  }));
  return serveHtml(IndexPage({ albums: summaries }));
}

async function galleryAlbumHandler(slug: string): Promise<HttpResponseInit> {
  const albums = await listAlbumsData();
  const album = albums.find((a) => a.slug === slug) ?? null;
  if (!album) {
    return { ...serveHtml(AlbumPage({ album: null, photos: [] })), status: 404 };
  }

  const photos = await listPhotosData(slug);
  const ready = photos
    .filter((p) => p.status === 'ready' && p.thumbnailBlob && p.rowKey)
    .sort((a, b) => ((a.uploadedAt ?? '') > (b.uploadedAt ?? '') ? -1 : 1))
    .map((p) => ({ rowKey: p.rowKey as string, photographer: p.photographer, hasAvif: photoHasAvif(p) }));

  return serveHtml(AlbumPage({ album, photos: ready }));
}

// The gallery index (`/`) and album pages (`/{slug}`) share one function on the
// optional single-segment route `{slug?}`. This is deliberate:
//   - The Functions host serves its built-in landing page at `/` and shadows a
//     function registered on the *empty* route, so we can't bind the index to ''.
//   - A greedy catch-all (`{*path}`) does reach `/`, but it also outranks the
//     literal `api/*` routes and swallows them.
// A single-segment optional param reaches `/` (slug undefined → index) without
// matching the two-segment `api/*` routes, so those stay intact.
app.http('galleryPages', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: '{slug?}',
  handler: (request: HttpRequest) => {
    const slug = request.params.slug;
    return slug ? galleryAlbumHandler(slug) : galleryIndexHandler();
  },
});

app.http('uploadPage', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/upload-page',
  handler: async (request: HttpRequest) =>
    serveHtml(UploadPage({ albums: await listAlbumsData(), selectedSlug: request.query.get('album') ?? undefined })),
});

app.http('managePage', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/manage-page',
  handler: async () => serveHtml(ManagePage({ albums: await listAlbumsData() })),
});

// HTML fragment for the manage page: album details form + photo list, swapped
// in by htmx when an album is selected.
async function manageAlbumPanelHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const slug = request.query.get('album');
  const album = slug ? (await listAlbumsData()).find((a) => a.slug === slug) ?? null : null;
  if (!album) {
    return serveHtml('<div class="panel-empty">Album not found.</div>' as unknown as JSX.Element);
  }
  const photos = (await listPhotosData(slug ?? undefined))
    .filter((p) => p.rowKey)
    .sort((a, b) => ((a.uploadedAt ?? '') < (b.uploadedAt ?? '') ? -1 : 1))
    .map((p) => ({
      rowKey: p.rowKey as string,
      originalFilename: p.originalFilename,
      photographer: p.photographer,
      focalX: p.focalX,
      focalY: p.focalY,
    }));
  return serveHtml(ManageAlbumPanel({ album, photos }));
}

app.http('manageAlbumPanel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/manage/album',
  handler: manageAlbumPanelHandler,
});

// Register a route per content-hashed asset (styles.css + JS bundles). The
// hashed path and body both come from the manifest built at cold start.
for (const [key, asset] of ASSETS) {
  app.http(`asset_${key.replace(/[^a-zA-Z0-9]/g, '_')}`, {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: asset.route,
    handler: () => serveAsset(asset),
  });
}

app.http('fontBricolageLatin', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/fonts/bricolage-grotesque-latin.woff2',
  handler: () => serveStaticBinary('fonts/bricolage-grotesque-latin.woff2', 'font/woff2'),
});

app.http('fontBricolageLatinExt', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/fonts/bricolage-grotesque-latin-ext.woff2',
  handler: () => serveStaticBinary('fonts/bricolage-grotesque-latin-ext.woff2', 'font/woff2'),
});

