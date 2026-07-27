import { imageUrl } from '../shared/imageUrl';
import type { AlbumSummary } from '../shared/albums';

// Placeholder stored when a photo has no known photographer; such photos are
// flagged with a red border. Kept in sync with public/edit.js.
const NO_NAME = 'Nomen Nescio';
const needsName = (name?: string): boolean => !name || name === NO_NAME;

export type PhotoRowData = {
  rowKey: string;
  originalFilename?: string;
  photographer?: string;
  focalX?: number;
  focalY?: number;
};

function PhotoRow({ album, photo }: { album: string; photo: PhotoRowData }): JSX.Element {
  const photoId = photo.rowKey;
  const photographer = photo.photographer ?? '';
  const hasFocal = typeof photo.focalX === 'number' && typeof photo.focalY === 'number';
  const meta = needsName(photographer)
    ? `Foto av ${NO_NAME} — klicka på ✎ för att namnge`
    : `Foto av ${photographer}`;

  return (
    <li class={needsName(photographer) ? 'needs-name' : undefined}>
      <div class="thumb">
        <img
          src={imageUrl('thumbnails', album, photoId, 'jpg')}
          alt=""
          onerror="this.parentElement.textContent = 'ingen miniatyr'"
        />
      </div>
      <div class="info">
        <div class="name" safe>{photo.originalFilename || photoId}</div>
        <div class="photo-meta" safe>{meta}</div>
      </div>
      <button
        type="button"
        class={hasFocal ? 'edit set' : 'edit'}
        title="Redigera foto"
        data-album={album}
        data-photo-id={photoId}
        data-photographer={photographer}
        data-focal-x={hasFocal ? String(photo.focalX) : ''}
        data-focal-y={hasFocal ? String(photo.focalY) : ''}
      >
        ✎
      </button>
      <button
        type="button"
        class="del"
        title="Ta bort foto"
        hx-delete={`/api/photo/${encodeURIComponent(album)}/${encodeURIComponent(photoId)}`}
        hx-confirm={`Ta bort ${photo.originalFilename || photoId}? Detta tar bort originalet, miniatyren och visningskopiorna.`}
        hx-target="closest li"
        hx-swap="delete"
      >
        ×
      </button>
    </li>
  );
}

export function ManageAlbumPanel({ album, photos }: { album: AlbumSummary; photos: PhotoRowData[] }): JSX.Element {
  return (
    <>
      <div class="panel">
        <h2>Albumdetaljer</h2>
        <form hx-patch={`/api/albums/${encodeURIComponent(album.slug)}`} hx-target="#edit-result" hx-swap="innerHTML">
          <label>
            Namn
            <input type="text" name="name" value={album.name} maxlength="120" required />
          </label>
          <label>
            Beskrivning
            <textarea name="description" maxlength="500" rows="2" required safe>{album.description}</textarea>
          </label>
          <div class="actions">
            <button
              type="button"
              class="del-album"
              style="margin-right: auto; color: var(--fail); border-color: var(--fail);"
              hx-delete={`/api/albums/${encodeURIComponent(album.slug)}`}
              hx-confirm={`Radera "${album.name}" och alla dess foton? Detta kan inte ångras.`}
            >
              Radera album
            </button>
            <button type="submit" class="primary">Spara ändringar</button>
          </div>
        </form>
        <div class="saved" id="edit-result"></div>
      </div>

      <div class="panel">
        <h2>Foton</h2>
        {photos.length === 0 ? (
          <div class="panel-empty">Inga foton i det här albumet.</div>
        ) : (
          <ul class="photos">
            {photos.map((photo) => (
              <PhotoRow album={album.slug} photo={photo} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
