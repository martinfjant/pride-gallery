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

const rawCache = new Map<string, string>();

async function serveStaticAsset(filename: string, contentType: string, templated: boolean): Promise<HttpResponseInit> {
  let raw = rawCache.get(filename);
  if (raw === undefined) {
    raw = await readFile(join(process.cwd(), 'public', filename), 'utf-8');
    rawCache.set(filename, raw);
  }
  const body = templated ? raw.replace(/__IMAGE_BASE__/g, process.env.PUBLIC_IMAGE_BASE ?? '/api/image') : raw;
  return {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=300',
    },
    body,
  };
}

async function galleryIndexHandler(): Promise<HttpResponseInit> {
  const albums = await listAlbumsData();
  const summaries = await Promise.all(albums.map(async (album) => {
    const photos = await listPhotosData(album.slug);
    const ready = photos.filter((p) => p.status === 'ready' && p.thumbnailBlob);
    return { ...album, count: ready.length, coverRowKey: ready[0]?.rowKey };
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
    .sort((a, b) => ((a.uploadedAt ?? '') < (b.uploadedAt ?? '') ? -1 : 1))
    .map((p) => ({ rowKey: p.rowKey as string, photographer: p.photographer }));

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

app.http('styles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/styles.css',
  handler: () => serveStaticAsset('styles.css', 'text/css; charset=utf-8', false),
});

app.http('albumScript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/album.js',
  handler: () => serveStaticAsset('album.js', 'text/javascript; charset=utf-8', false),
});

app.http('uploadScript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/upload.js',
  handler: () => serveStaticAsset('upload.js', 'text/javascript; charset=utf-8', false),
});

app.http('htmxScript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/htmx.js',
  handler: () => serveStaticAsset('htmx.min.js', 'text/javascript; charset=utf-8', false),
});

app.http('appScript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/app.js',
  handler: () => serveStaticAsset('app.js', 'text/javascript; charset=utf-8', false),
});

app.http('editScript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'api/edit.js',
  handler: () => serveStaticAsset('edit.js', 'text/javascript; charset=utf-8', false),
});
