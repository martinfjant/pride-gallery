import { CrossLink, Layout } from './layout';
import { BrandBar } from './brand';
import { EditModal } from './editModal';
import type { AlbumSummary } from '../shared/albums';
import { assetUrl } from '../shared/assets';

export function UploadPage({ albums, selectedSlug }: { albums: AlbumSummary[]; selectedSlug?: string }): JSX.Element {
  const hasSelection = !!selectedSlug && albums.some((a) => a.slug === selectedSlug);
  return (
    <Layout title="Ladda upp — Stockholm Pride Gallery" scripts={['htmx', 'app', 'edit']}>
      <BrandBar />
      <main>
        <h1>
          Ladda upp foton <CrossLink href="/api/manage-page" label="Hantera album →" />
        </h1>
        <form class="settings" id="settings" autocomplete="off">
          <label>
            Lösenord
            <input type="password" name="password" required autocomplete="current-password" />
          </label>
          <label>
            Album
            <div class="album-row">
              <select name="album" id="album" required>
                <option value="" disabled selected={!hasSelection}>
                  {albums.length === 0 ? 'Inga album ännu — skapa ett för att börja' : 'Välj ett album…'}
                </option>
                {albums.map((album) => (
                  <option value={album.slug} selected={album.slug === selectedSlug} safe>
                    {`${album.name} (${album.slug})`}
                  </option>
                ))}
              </select>
              <button type="button" id="album-new">+ Nytt</button>
            </div>
          </label>
        </form>
        <dialog id="create-album">
          {/* htmx submit: native validation flags empty fields; the server
              returns HX-Redirect on success or an error fragment into
              #create-error. Auth rides along via app.js's header shim. */}
          <form class="panel" id="create-form" hx-post="/api/albums" hx-target="#create-error" hx-swap="innerHTML">
            <h2>Skapa album</h2>
            <label>
              Slug (URL-säkert id, kan inte ändras)
              <input
                type="text"
                id="new-slug"
                name="slug"
                pattern="[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?"
                maxlength="60"
                required
                placeholder="fredags-parad"
              />
            </label>
            <label>
              Namn (visas)
              <input type="text" id="new-name" name="name" maxlength="120" required placeholder="Fredagens parad" />
            </label>
            <label>
              Beskrivning
              <textarea
                id="new-description"
                name="description"
                maxlength="500"
                rows="2"
                required
                placeholder="Kort beskrivning som visas på albumsidan"
              ></textarea>
            </label>
            <div class="error" id="create-error"></div>
            <div class="actions">
              <button type="button" id="create-cancel">Avbryt</button>
              <button type="submit" class="primary">Skapa</button>
            </div>
          </form>
        </dialog>
        <label class="dropzone" id="dropzone" hidden={!hasSelection}>
          <input type="file" id="picker" accept="image/*" multiple hidden />
          <span id="dropzone-label">Släpp bilder här eller klicka för att välja</span>
        </label>
        <ul class="queue" id="queue"></ul>
        <div class="toolbar" id="toolbar" hidden>
          <span id="summary"></span>
          <button type="button" id="clear">Rensa klara</button>
        </div>
      </main>
      <EditModal />
      <script type="module" src={assetUrl('upload.js')}></script>
    </Layout>
  );
}
