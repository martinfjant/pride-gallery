import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Content-hashed static assets (CSS + JS bundles).
 *
 * Each app-owned text asset is served at a URL that embeds an 8-char hash of
 * its content, e.g. `/api/app.1a2b3c4d.js`. Because the URL changes whenever the
 * file changes, we can serve these `immutable` with a one-year max-age and let
 * Front Door cache (and gzip/brotli-compress) them forever — a deploy that
 * changes a file produces a new URL, so clients and the CDN never run a stale
 * mix. Compression on Front Door is only available on a *cached* route, which is
 * why the old `no-cache` scheme couldn't be compressed; content hashing is what
 * makes caching safe here.
 *
 * Fonts are handled separately (serveStaticBinary): they're already
 * content-stable, immutable, and woff2 is self-compressed.
 */
interface AssetDef {
  /** Key used by templates and `assetUrl()`, e.g. 'app.js', 'styles.css'. The
   *  extension also drives the hashed filename: 'app.js' -> 'app.<hash>.js'. */
  key: string;
  /** Physical file under public/ (may differ from the URL name, e.g. htmx). */
  file: string;
  contentType: string;
}

const DEFS: AssetDef[] = [
  { key: 'styles.css', file: 'styles.css', contentType: 'text/css; charset=utf-8' },
  { key: 'htmx.js', file: 'htmx.min.js', contentType: 'text/javascript; charset=utf-8' },
  { key: 'app.js', file: 'app.js', contentType: 'text/javascript; charset=utf-8' },
  { key: 'edit.js', file: 'edit.js', contentType: 'text/javascript; charset=utf-8' },
  { key: 'album.js', file: 'album.js', contentType: 'text/javascript; charset=utf-8' },
  { key: 'upload.js', file: 'upload.js', contentType: 'text/javascript; charset=utf-8' },
  // Footer wordmark logos: black-text for light theme, white-text for dark. The
  // footer's <picture> element picks between them by prefers-color-scheme, so
  // only the matching one is fetched.
  { key: 'logo-light.svg', file: 'svg/Logga, färg, svart text, Stockholm Pride.svg', contentType: 'image/svg+xml; charset=utf-8' },
  { key: 'logo-dark.svg', file: 'svg/Logga, färg, vit text, Stockholm Pride.svg', contentType: 'image/svg+xml; charset=utf-8' },
];

export interface Asset {
  /** Public URL, hash embedded, e.g. '/api/app.1a2b3c4d.js'. */
  url: string;
  /** Azure Functions route (URL without the leading slash). */
  route: string;
  contentType: string;
  body: string;
  /** Byte length of `body`. Sent as Content-Length so the Functions host emits
   *  a fixed-length (not chunked) response — Front Door won't compress a
   *  chunked-transfer response, so this is required for gzip/brotli at the edge. */
  byteLength: number;
}

/**
 * Built once at cold start. Reading + hashing synchronously here keeps the
 * bodies in memory (no per-request file read) and lets us register routes with
 * the hashed path at module load.
 */
function buildManifest(): Map<string, Asset> {
  const manifest = new Map<string, Asset>();
  for (const def of DEFS) {
    const body = readFileSync(join(process.cwd(), 'public', def.file), 'utf-8');
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 8);
    const dot = def.key.lastIndexOf('.');
    const hashedName = `${def.key.slice(0, dot)}.${hash}${def.key.slice(dot)}`;
    // Served under a dedicated /api/assets/ prefix so a single Front Door route
    // (/api/assets/*) can cache + compress exactly these files. Front Door
    // patternsToMatch only allows a whole-segment tail wildcard, so a prefix is
    // the only way to select them as a group (an extension glob like
    // /api/*.css is rejected at deploy time).
    manifest.set(def.key, {
      url: `/api/assets/${hashedName}`,
      route: `api/assets/${hashedName}`,
      contentType: def.contentType,
      body,
      byteLength: Buffer.byteLength(body),
    });
  }
  return manifest;
}

export const ASSETS: Map<string, Asset> = buildManifest();

/** Hashed public URL for an asset key (e.g. `assetUrl('app.js')`). */
export function assetUrl(key: string): string {
  const asset = ASSETS.get(key);
  if (!asset) throw new Error(`Unknown static asset: ${key}`);
  return asset.url;
}
