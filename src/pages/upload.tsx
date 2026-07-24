import { CrossLink, Layout } from './layout';
import { BrandBar } from './brand';
import { EditModal } from './editModal';
import type { AlbumSummary } from '../shared/albums';

export function UploadPage({ albums, selectedSlug }: { albums: AlbumSummary[]; selectedSlug?: string }): JSX.Element {
  const hasSelection = !!selectedSlug && albums.some((a) => a.slug === selectedSlug);
  return (
    <Layout title="Upload — Stockholm Pride Gallery" scripts={['htmx', 'app', 'edit']}>
      <BrandBar />
      <main>
        <h1>
          Upload photos <CrossLink href="/api/manage-page" label="Manage albums →" />
        </h1>
        <form class="settings" id="settings" autocomplete="off">
          <label>
            Password
            <input type="password" name="password" required autocomplete="current-password" />
          </label>
          <label>
            Album
            <div class="album-row">
              <select name="album" id="album" required>
                <option value="" disabled selected={!hasSelection}>
                  {albums.length === 0 ? 'No albums yet — create one to start' : 'Choose an album…'}
                </option>
                {albums.map((album) => (
                  <option value={album.slug} selected={album.slug === selectedSlug} safe>
                    {`${album.name} (${album.slug})`}
                  </option>
                ))}
              </select>
              <button type="button" id="album-new">+ New</button>
            </div>
          </label>
        </form>
        <dialog id="create-album">
          {/* htmx submit: native validation flags empty fields; the server
              returns HX-Redirect on success or an error fragment into
              #create-error. Auth rides along via app.js's header shim. */}
          <form class="panel" id="create-form" hx-post="/api/albums" hx-target="#create-error" hx-swap="innerHTML">
            <h2>Create album</h2>
            <label>
              Slug (URL-safe id, immutable)
              <input
                type="text"
                id="new-slug"
                name="slug"
                pattern="[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?"
                maxlength="60"
                required
                placeholder="friday-parade"
              />
            </label>
            <label>
              Name (display)
              <input type="text" id="new-name" name="name" maxlength="120" required placeholder="Friday Parade" />
            </label>
            <label>
              Description
              <textarea
                id="new-description"
                name="description"
                maxlength="500"
                rows="2"
                required
                placeholder="Short description shown on the album page"
              ></textarea>
            </label>
            <div class="error" id="create-error"></div>
            <div class="actions">
              <button type="button" id="create-cancel">Cancel</button>
              <button type="submit" class="primary">Create</button>
            </div>
          </form>
        </dialog>
        <label class="dropzone" id="dropzone" hidden={!hasSelection}>
          <input type="file" id="picker" accept="image/*" multiple hidden />
          <span id="dropzone-label">Drop images here or click to select</span>
        </label>
        <ul class="queue" id="queue"></ul>
        <div class="toolbar" id="toolbar" hidden>
          <span id="summary"></span>
          <button type="button" id="clear">Clear done</button>
        </div>
      </main>
      <EditModal />
      <script type="module" src="/api/upload.js"></script>
    </Layout>
  );
}
