import { Layout } from './layout';
import { imageUrl } from '../shared/imageUrl';

export type AlbumSummary = {
  slug: string;
  name: string;
  description: string;
  count: number;
  coverRowKey?: string;
};

// Brand shapes, taken verbatim from Stockholm Pride's 2026 asset kit so the
// geometry matches the printed identity exactly:
//   - the six-point "stjärna" (star) — the enduring graphic form
//   - the "wiggly" — the parade symbol, used as confetti
// Per the brand's Manér guide the wiggly is ALWAYS drawn at the same angle so
// every instance points up-and-forward in unison — so we only ever vary its
// size/position/colour, never its rotation.
const STAR_PATH =
  'M19.91,33.64c10.26,28.61,5.15,60.65-13.3,84.63,30.61,5.55,56.26,26.82,67.42,55.79,19.03-24.51,49.73-37.49,80.64-33.97-10.96-28.38-6.67-60.73,11.5-85.31-29.4-4.6-54.81-23.73-67.31-50.8-19.67,22.43-49.46,33.58-78.96,29.66Z';
const WIGGLY_PATH =
  'M113.97,2.85c.51,5.74-4.29,10.58-10.04,10.07-14.6.59-26.37,12.35-26.97,26.94.42,5.25-3.48,10.02-8.88,9.99-15.03.13-27.58,11.96-28.15,27.06.41,5.24-3.48,10.02-8.88,9.99-15.61-.33-29.04,13.76-28.2,29.32h19.35c-.66-5.8,4.21-10.54,9.96-10.06,14.72-.27,27.32-13.44,27.03-28.15-.01-5.43,4.75-9.17,9.99-8.9,15.03-.54,27.08-13.09,27.03-28.11-.01-5.39,4.75-9.23,9.99-8.87,15.15-.29,27.87-14.16,27-29.3h-19.24v.02Z';

function Star({ cls }: { cls: string }): JSX.Element {
  return (
    <svg class={cls} viewBox="0 0 172.8 178.04" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}

function Wiggly({ cls }: { cls: string }): JSX.Element {
  return (
    <svg class={`wiggly ${cls}`} viewBox="0 0 136.06 119.06" aria-hidden="true">
      <path d={WIGGLY_PATH} />
    </svg>
  );
}

// The official "2026" year mark (årsmarkör) — the star doubles as the first
// zero. Rendered in this year's colour, årsfärg 2026 (#00fb75), via CSS.
function YearMark(): JSX.Element {
  return (
    <svg class="hero-year" viewBox="0 0 207.27 74.62" aria-hidden="true">
      <path d="M114.37,65.53v-8.95l19.65-14.97c1.23-1,2.48-2.06,3.76-3.18,1.28-1.17,2.45-2.45,3.51-3.85,1.11-1.39,2.01-2.87,2.68-4.43.72-1.56,1.09-3.23,1.09-5.02s-.42-3.46-1.25-4.85c-.84-1.39-2.09-2.45-3.76-3.18-1.62-.78-3.65-1.17-6.1-1.17-1.67,0-3.23.22-4.68.67-1.45.45-2.7,1.23-3.76,2.34-1.06,1.11-1.87,2.59-2.42,4.43-.5,1.84-.75,4.12-.75,6.86l-7.36-1.25c-.11-4.01.53-7.5,1.92-10.45,1.39-3.01,3.51-5.32,6.35-6.94,2.9-1.62,6.52-2.42,10.87-2.42,3.73,0,7,.61,9.78,1.84,2.79,1.23,4.93,3.01,6.44,5.35,1.56,2.29,2.34,5.02,2.34,8.19,0,2.62-.45,5.04-1.34,7.27-.89,2.17-2.03,4.18-3.43,6.02-1.39,1.78-2.93,3.4-4.6,4.85-1.62,1.39-3.21,2.65-4.77,3.76l-15.8,12.04v.75l31.27-.33v6.61h-39.63Z" />
      <path d="M2.99,65.53v-8.95l19.65-14.97c1.23-1,2.48-2.06,3.76-3.18,1.28-1.17,2.45-2.45,3.51-3.85,1.11-1.39,2.01-2.87,2.68-4.43.72-1.56,1.09-3.23,1.09-5.02s-.42-3.46-1.25-4.85c-.84-1.39-2.09-2.45-3.76-3.18-1.62-.78-3.65-1.17-6.1-1.17-1.67,0-3.23.22-4.68.67-1.45.45-2.7,1.23-3.76,2.34-1.06,1.11-1.87,2.59-2.42,4.43-.5,1.84-.75,4.12-.75,6.86l-7.36-1.25c-.11-4.01.53-7.5,1.92-10.45,1.39-3.01,3.51-5.32,6.35-6.94,2.9-1.62,6.52-2.42,10.87-2.42,3.73,0,7,.61,9.78,1.84,2.79,1.23,4.93,3.01,6.44,5.35,1.56,2.29,2.34,5.02,2.34,8.19,0,2.62-.45,5.04-1.34,7.27-.89,2.17-2.03,4.18-3.43,6.02-1.39,1.78-2.93,3.4-4.6,4.85-1.62,1.39-3.21,2.65-4.77,3.76l-15.8,12.04v.75l31.27-.33v6.61H2.99Z" />
      <path
        fill-rule="evenodd"
        d="M45.35,48.84c2.4.43,4.71,1.11,6.93,2.01,6.67,2.71,12.37,7.41,16.3,13.43,1.34,2.04,2.47,4.24,3.36,6.56,1.53-1.97,3.24-3.74,5.11-5.32,5.5-4.63,12.31-7.48,19.47-8.15,2.38-.22,4.8-.2,7.22.07-.88-2.27-1.51-4.61-1.89-6.97-1.13-6.92-.18-14.06,2.76-20.45,1-2.17,2.22-4.26,3.67-6.22-2.41-.38-4.74-1-6.98-1.85-6.36-2.4-11.91-6.61-15.95-12.08-1.39-1.89-2.61-3.93-3.61-6.1-1.58,1.8-3.32,3.41-5.19,4.83-5.43,4.11-11.96,6.57-18.74,7.08-2.38.18-4.8.11-7.21-.21.82,2.29,1.39,4.64,1.72,7,.96,6.91-.16,13.97-3.18,20.23-1.04,2.15-2.3,4.21-3.78,6.14ZM55.62,44.89c7.25,3.11,13.49,8.22,17.98,14.69,6.15-4.89,13.59-7.97,21.41-8.87-1.09-7.69-.04-15.56,3.06-22.71-7.07-2.84-13.26-7.57-17.86-13.64-6.16,4.54-13.45,7.32-21.05,8.03.91,7.68-.32,15.48-3.54,22.5Z"
      />
      <path d="M184.79,65.53c-7.21,0-12.83-2.32-16.87-6.96-4.04-4.64-6.06-11.52-6.06-20.64,0-5.79.85-10.84,2.54-15.15,1.69-4.31,4.2-7.66,7.54-10.03,3.33-2.37,7.43-3.56,12.29-3.56,2.51,0,4.83.34,6.96,1.02,2.13.68,3.99,1.69,5.57,3.03,1.58,1.34,2.87,3,3.85,5,.98,2,1.58,4.3,1.8,6.92l-7.13,1.64c-.22-2.68-.86-4.82-1.93-6.43-1.06-1.61-2.41-2.78-4.05-3.52-1.64-.74-3.41-1.11-5.32-1.11-2.62,0-4.87.61-6.76,1.84s-3.41,2.91-4.59,5.04c-1.17,2.13-2.05,4.53-2.62,7.21-.57,2.68-.86,5.46-.86,8.35,0,1.91.15,3.89.45,5.94.3,2.05.7,3.97,1.19,5.77h.66c-.22-3.38.09-6.27.94-8.64.85-2.38,2.06-4.3,3.65-5.78,1.58-1.47,3.37-2.55,5.36-3.24,1.99-.68,4.03-1.02,6.1-1.02,3,0,5.78.63,8.31,1.88s4.59,3.1,6.14,5.53c1.56,2.43,2.33,5.48,2.33,9.13,0,2.35-.38,4.6-1.15,6.76-.76,2.16-1.94,4.05-3.52,5.69-1.58,1.64-3.6,2.93-6.06,3.89-2.46.96-5.38,1.43-8.77,1.43ZM184.21,59.14c2.29,0,4.23-.31,5.82-.94,1.58-.63,2.86-1.49,3.85-2.58.98-1.09,1.69-2.31,2.13-3.65.44-1.34.65-2.74.65-4.22,0-2.46-.53-4.48-1.6-6.06-1.07-1.58-2.42-2.74-4.06-3.48-1.64-.74-3.41-1.11-5.32-1.11-2.35,0-4.42.51-6.22,1.51-1.8,1.01-3.22,2.45-4.26,4.3-1.04,1.86-1.56,4.07-1.56,6.63,0,1.91.31,3.5.94,4.75.63,1.26,1.46,2.24,2.5,2.95s2.17,1.2,3.4,1.47c1.23.27,2.47.41,3.73.41Z" />
    </svg>
  );
}

export function IndexPage({ albums }: { albums: AlbumSummary[] }): JSX.Element {
  const totalPhotos = albums.reduce((sum, a) => sum + a.count, 0);
  return (
    <Layout title="Stockholm Pride Gallery">
      {/* Squircle (superellipse) corners for the album cards — a static SVG
          clipPath in normalized objectBoundingBox units, referenced from CSS
          (`.albums a { clip-path: url(#album-squircle) }`). No JS, no flash, and
          identical in every browser. Radius scales with the card box, which is
          fine because the cards are near-square. */}
      <svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="album-squircle" clipPathUnits="objectBoundingBox">
            <path d="M0.0900,0L0.9100,0L0.9100,0.0000L0.9382,0.0002L0.9498,0.0009L0.9585,0.0020L0.9657,0.0035L0.9718,0.0055L0.9771,0.0079L0.9817,0.0109L0.9857,0.0143L0.9891,0.0183L0.9921,0.0229L0.9945,0.0282L0.9965,0.0343L0.9980,0.0415L0.9991,0.0502L0.9998,0.0618L1.0000,0.0900L1,0.9100L1.0000,0.9100L0.9998,0.9382L0.9991,0.9498L0.9980,0.9585L0.9965,0.9657L0.9945,0.9718L0.9921,0.9771L0.9891,0.9817L0.9857,0.9857L0.9817,0.9891L0.9771,0.9921L0.9718,0.9945L0.9657,0.9965L0.9585,0.9980L0.9498,0.9991L0.9382,0.9998L0.9100,1.0000L0.0900,1L0.0900,1.0000L0.0618,0.9998L0.0502,0.9991L0.0415,0.9980L0.0343,0.9965L0.0282,0.9945L0.0229,0.9921L0.0183,0.9891L0.0143,0.9857L0.0109,0.9817L0.0079,0.9771L0.0055,0.9718L0.0035,0.9657L0.0020,0.9585L0.0009,0.9498L0.0002,0.9382L0.0000,0.9100L0,0.0900L0.0000,0.0900L0.0002,0.0618L0.0009,0.0502L0.0020,0.0415L0.0035,0.0343L0.0055,0.0282L0.0079,0.0229L0.0109,0.0183L0.0143,0.0143L0.0183,0.0109L0.0229,0.0079L0.0282,0.0055L0.0343,0.0035L0.0415,0.0020L0.0502,0.0009L0.0618,0.0002L0.0900,0.0000Z" />
          </clipPath>
        </defs>
      </svg>
      <header class="hero">
        <Star cls="starburst" />
        <Wiggly cls="w1" />
        <Wiggly cls="w2" />
        <Wiggly cls="w3" />
        <Wiggly cls="w4" />
        <Wiggly cls="w5" />
        <Wiggly cls="w6" />
        <Wiggly cls="w7" />
        <Wiggly cls="w8" />
        <Wiggly cls="w9" />
        <Wiggly cls="w10" />
        <Wiggly cls="w11" />
        <Wiggly cls="w12" />
        <Wiggly cls="w13" />
        <Wiggly cls="w14" />
        <Wiggly cls="w15" />
        <div class="hero-inner">
          <div class="hero-lockup">
            <h1 class="wordmark">
              <span class="wm-l1">Stockholm</span>
              <span class="wm-l2">Pride</span>
              <span class="wm-add">Gallery</span>
            </h1>
            <YearMark />
          </div>
          <p class="hero-sub">Photos from the festival — browse the albums and relive the weekend.</p>
          <a class="hero-cta" href="/api/upload-page">
            Upload photos <span aria-hidden="true">→</span>
          </a>
        </div>
      </header>
      <main class="gallery">
        {albums.length === 0 ? (
          <div class="empty">
            <Star cls="starburst-sm" />
            <p>
              No albums yet. <a href="/api/upload-page">Upload the first photos</a> to get started.
            </p>
          </div>
        ) : (
          <>
            <div class="section-head">
              <h2>Albums</h2>
              <span class="section-count">
                {totalPhotos} photo{totalPhotos === 1 ? '' : 's'} across {albums.length} album
                {albums.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul class="albums">
              {albums.map((album) => (
                <li>
                  {/* Two nested squircle-clipped layers: the <a> is the 1px
                      border ring (border colour + padding), .card-inner is the
                      panel fill. The gap between the two clips is the border,
                      which follows the squircle — a plain border would be cut
                      off at the corners by the clip-path. */}
                  <a href={`/${encodeURIComponent(album.slug)}`}>
                    <div class="card-inner">
                      <div class="cover">
                        {album.coverRowKey ? (
                          <picture>
                            <source
                              srcset={imageUrl('thumbnails', album.slug, album.coverRowKey, 'webp')}
                              type="image/webp"
                            />
                            <img src={imageUrl('thumbnails', album.slug, album.coverRowKey, 'jpg')} alt="" loading="lazy" />
                          </picture>
                        ) : (
                          'No photos yet'
                        )}
                      </div>
                      <div class="meta">
                        <h2 safe>{album.name}</h2>
                        <p class="desc" safe>{album.description}</p>
                        <p class="count">
                          {album.count} photo{album.count === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </Layout>
  );
}
