import { CrossLink, Layout } from './layout';
import { BrandBar } from './brand';
import { EditModal } from './editModal';
import type { AlbumSummary } from '../shared/albums';

export function ManagePage({ albums }: { albums: AlbumSummary[] }): JSX.Element {
  return (
    <Layout title="Hantera album — Stockholm Pride Gallery" scripts={['htmx', 'app', 'edit']}>
      <BrandBar />
      <main>
        <h1>
          Hantera album <CrossLink href="/api/upload-page" label="Ladda upp foton →" />
        </h1>
        <form class="settings" id="settings" autocomplete="off">
          <label>
            Lösenord
            <input type="password" name="password" required autocomplete="current-password" />
          </label>
        </form>

        {/* Standalone control so its htmx GET carries only `album` (never the password). */}
        <form class="settings" autocomplete="off">
          <label>
            Album
            <select name="album" required hx-get="/api/manage/album" hx-target="#album-panel" hx-swap="innerHTML">
              <option value="" disabled selected>Välj ett album…</option>
              {albums.map((album) => (
                <option value={album.slug} safe>{`${album.name} (${album.slug})`}</option>
              ))}
            </select>
          </label>
        </form>

        <div id="album-panel"></div>
      </main>
      <EditModal />
    </Layout>
  );
}
