// Shared photo metadata editor (photographer + focal point). Opens for any
// `button.edit` that carries data-album / data-photo-id / data-photographer /
// data-focal-x / data-focal-y. State lives in those attributes, so it works for
// both server-rendered rows (manage page) and JS-built queue rows (upload page),
// including rows htmx swaps in later — a single delegated click listener binds
// them all.

const NO_NAME = 'Nomen Nescio';
const needsName = (name) => !name || name === NO_NAME;

const passwordInput = document.querySelector('#settings [name="password"]');

const editModal = document.getElementById('edit-modal');
const focalFrame = document.getElementById('focal-frame');
const focalImage = document.getElementById('focal-image');
const focalMarker = document.getElementById('focal-marker');
const editError = document.getElementById('edit-error');
const editPhotographer = document.getElementById('edit-photographer');
const focalClearBtn = document.getElementById('focal-clear');
const editCancelBtn = document.getElementById('edit-cancel');
const editSaveBtn = document.getElementById('edit-save');

// { btn, album, photoId, origPhotographer, x, y, origHasFocal, focalTouched }
let editState = null;

function placeMarker(x, y) {
  focalMarker.style.left = `${x * 100}%`;
  focalMarker.style.top = `${y * 100}%`;
  focalMarker.style.display = 'block';
}

function openEditModal(btn) {
  if (!passwordInput?.value) {
    alert('Password required');
    passwordInput?.focus();
    return;
  }
  const fx = parseFloat(btn.dataset.focalX);
  const fy = parseFloat(btn.dataset.focalY);
  const hasFocal = Number.isFinite(fx) && Number.isFinite(fy);
  editState = {
    btn,
    album: btn.dataset.album,
    photoId: btn.dataset.photoId,
    origPhotographer: btn.dataset.photographer ?? '',
    x: hasFocal ? fx : null,
    y: hasFocal ? fy : null,
    origHasFocal: hasFocal,
    focalTouched: false,
  };
  editPhotographer.value = editState.origPhotographer;
  editError.textContent = '';
  if (hasFocal) placeMarker(fx, fy);
  else focalMarker.style.display = 'none';
  focalImage.src = `/api/image/display/${encodeURIComponent(editState.album)}/${encodeURIComponent(editState.photoId)}.jpg`;
  editModal.showModal();
}

focalFrame.addEventListener('click', (e) => {
  if (!editState) return;
  const rect = focalFrame.getBoundingClientRect();
  editState.x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  editState.y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  editState.focalTouched = true;
  placeMarker(editState.x, editState.y);
});

// Reflect a saved edit back into the button's data-* and its row (meta text,
// needs-name flag, focal-set class, refreshed thumbnail).
function applyToRow(btn, photographer, focal) {
  btn.dataset.photographer = photographer;
  btn.dataset.focalX = focal ? String(focal.x) : '';
  btn.dataset.focalY = focal ? String(focal.y) : '';
  btn.classList.toggle('set', !!focal);

  const li = btn.closest('li');
  if (!li) return;
  const meta = li.querySelector('.photo-meta');
  if (meta) {
    meta.textContent = needsName(photographer)
      ? `Photo by ${NO_NAME} — click ✎ to name`
      : `Photo by ${photographer}`;
  }
  li.classList.toggle('needs-name', needsName(photographer));
}

function refreshThumbnail(btn) {
  const img = btn.closest('li')?.querySelector('.thumb img');
  if (img) {
    img.src = `/api/image/thumbnails/${encodeURIComponent(editState.album)}/${encodeURIComponent(editState.photoId)}.jpg?t=${Date.now()}`;
  }
}

async function saveEdit() {
  if (!editState) return;
  const newPhotographer = editPhotographer.value.trim().slice(0, 120);
  const photographerChanged = newPhotographer !== editState.origPhotographer;
  const focalChanged = editState.focalTouched;
  const focal = editState.x === null ? null : { x: editState.x, y: editState.y };

  if (!photographerChanged && !focalChanged) {
    editModal.close();
    editState = null;
    return;
  }

  editSaveBtn.disabled = true;
  focalClearBtn.disabled = true;
  editSaveBtn.textContent = 'Saving…';
  editSaveBtn.classList.add('is-saving');
  editError.textContent = '';
  const auth = `Bearer ${passwordInput.value}`;
  const base = `/api/photo/${encodeURIComponent(editState.album)}/${encodeURIComponent(editState.photoId)}`;
  try {
    if (photographerChanged) {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({ photographer: newPhotographer }),
      });
      if (!res.ok) {
        editError.textContent = `${res.status}: ${(await res.text()).slice(0, 200)}`;
        return;
      }
    }
    if (focalChanged) {
      const res = await fetch(`${base}/focal-point`, {
        method: 'POST',
        headers: { authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify(focal),
      });
      if (!res.ok) {
        editError.textContent = `${res.status}: ${(await res.text()).slice(0, 200)}`;
        return;
      }
    }
    const btn = editState.btn;
    if (focalChanged) refreshThumbnail(btn);
    applyToRow(btn, newPhotographer, focal);
    editModal.close();
    editState = null;
  } catch (err) {
    editError.textContent = err.message;
  } finally {
    editSaveBtn.disabled = false;
    focalClearBtn.disabled = false;
    editSaveBtn.textContent = 'Save';
    editSaveBtn.classList.remove('is-saving');
  }
}

editSaveBtn.addEventListener('click', saveEdit);

focalClearBtn.addEventListener('click', () => {
  if (!editState) return;
  const hadFocal = editState.x !== null || editState.origHasFocal;
  editState.x = null;
  editState.y = null;
  if (hadFocal) editState.focalTouched = true;
  focalMarker.style.display = 'none';
});

editCancelBtn.addEventListener('click', () => {
  editState = null;
  editModal.close();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button.edit');
  if (btn) openEditModal(btn);
});
