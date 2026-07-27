/**
 * Photo metadata editor dialog (photographer + focal-point picker). Shared by
 * the upload and manage pages; driven by `public/edit.js`, which opens it in
 * response to clicks on any `button.edit` carrying `data-album`/`data-photo-id`/
 * `data-photographer`/`data-focal-x`/`data-focal-y`.
 */
export function EditModal(): JSX.Element {
  return (
    <dialog id="edit-modal">
      <div class="edit-body">
        <h2>Redigera foto</h2>
        <label class="edit-photographer-label">
          Fotograf
          <input type="text" id="edit-photographer" maxlength="120" placeholder="Fotografens namn" />
        </label>
        <p class="focal-hint">Klicka på punkten som ska vara centrerad i den fyrkantiga miniatyrbeskärningen.</p>
        <div class="focal-frame" id="focal-frame">
          <img id="focal-image" alt="" />
          <div class="focal-marker" id="focal-marker"></div>
        </div>
        <div class="edit-error" id="edit-error"></div>
        <div class="actions">
          <button type="button" id="focal-clear">Rensa fokuspunkt</button>
          <button type="button" id="edit-cancel">Avbryt</button>
          <button type="button" id="edit-save" class="primary">Spara</button>
        </div>
      </div>
    </dialog>
  );
}
