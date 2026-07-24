import { CrossLink, Layout } from './layout';
import { EditModal } from './editModal';
import type { AlbumSummary } from '../shared/albums';

export function ManagePage({ albums }: { albums: AlbumSummary[] }): JSX.Element {
  return (
    <Layout title="Manage albums — Stockholm Pride Gallery" scripts={['htmx', 'app', 'edit']}>
      <main>
        <h1>
          Manage albums <CrossLink href="/api/upload-page" label="Upload photos →" />
        </h1>
        <form class="settings" id="settings" autocomplete="off">
          <label>
            Password
            <input type="password" name="password" required autocomplete="current-password" />
          </label>
        </form>

        {/* Standalone control so its htmx GET carries only `album` (never the password). */}
        <form class="settings" autocomplete="off">
          <label>
            Album
            <select name="album" required hx-get="/api/manage/album" hx-target="#album-panel" hx-swap="innerHTML">
              <option value="" disabled selected>Choose an album…</option>
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
