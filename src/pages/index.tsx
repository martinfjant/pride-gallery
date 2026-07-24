import { Layout } from './layout';
import { imageUrl } from '../shared/imageUrl';

export type AlbumSummary = {
  slug: string;
  name: string;
  description: string;
  count: number;
  coverRowKey?: string;
};

export function IndexPage({ albums }: { albums: AlbumSummary[] }): JSX.Element {
  return (
    <Layout title="Stockholm Pride Gallery">
      <main>
        <header>
          <h1>Stockholm Pride Gallery</h1>
          <a href="/api/upload-page">Upload photos →</a>
        </header>
        {albums.length === 0 ? (
          <p class="empty">
            No albums yet. <a href="/api/upload-page">Upload the first photos</a> to get started.
          </p>
        ) : (
          <ul class="albums">
            {albums.map((album) => (
              <li>
                <a href={`/${encodeURIComponent(album.slug)}`}>
                  <div class="cover">
                    {album.coverRowKey ? (
                      <picture>
                        <source srcset={imageUrl('thumbnails', album.slug, album.coverRowKey, 'webp')} type="image/webp" />
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
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Layout>
  );
}
