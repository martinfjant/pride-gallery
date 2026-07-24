import { Layout } from './layout';
import { BrandBar } from './brand';
import { imageUrl } from '../shared/imageUrl';
import { assetUrl } from '../shared/assets';

export type AlbumInfo = { slug: string; name: string; description: string };
export type AlbumPhoto = { rowKey: string; photographer?: string };

export function AlbumPage({ album, photos }: { album: AlbumInfo | null; photos: AlbumPhoto[] }): JSX.Element {
  if (!album) {
    return (
      <Layout title="Album not found — Stockholm Pride Gallery">
        <BrandBar />
        <main>
          <a href="/" class="back">← All albums</a>
          <h1>Album not found</h1>
        </main>
      </Layout>
    );
  }

  return (
    <Layout title={`${album.name} — Stockholm Pride Gallery`}>
      <BrandBar />
      <main>
        <a href="/" class="back">← All albums</a>
        <h1 safe>{album.name}</h1>
        <p class="desc" safe>{album.description}</p>
        {photos.length === 0 ? (
          <p class="empty">No photos in this album yet.</p>
        ) : (
          <ul class="grid" id="grid">
            {photos.map((photo, i) => (
              <li>
                <a
                  href={imageUrl('display', album.slug, photo.rowKey, 'jpg')}
                  data-index={i}
                  data-display-url-webp={imageUrl('display', album.slug, photo.rowKey, 'webp')}
                  data-display-url-jpg={imageUrl('display', album.slug, photo.rowKey, 'jpg')}
                  data-photographer={photo.photographer ?? ''}
                >
                  <picture>
                    <source srcset={imageUrl('thumbnails', album.slug, photo.rowKey, 'webp')} type="image/webp" />
                    <img
                      src={imageUrl('thumbnails', album.slug, photo.rowKey, 'jpg')}
                      alt={photo.photographer ? `Photo by ${photo.photographer}` : ''}
                      loading="lazy"
                    />
                  </picture>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
      <dialog id="lightbox">
        <div class="box">
          <button class="close" id="close" aria-label="Close">×</button>
          <div class="image-area">
            <button class="nav-btn prev" id="prev" aria-label="Previous">‹</button>
            <img id="lightbox-img" alt="" />
            <button class="nav-btn next" id="next" aria-label="Next">›</button>
          </div>
          <div class="caption" id="caption"></div>
        </div>
      </dialog>
      <script type="module" src={assetUrl('album.js')}></script>
    </Layout>
  );
}
