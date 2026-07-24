const settings = document.getElementById('settings');
const albumSelect = document.getElementById('album');
const albumNewBtn = document.getElementById('album-new');
const createPanel = document.getElementById('create-album');
const newSlug = document.getElementById('new-slug');
const newName = document.getElementById('new-name');
const newDescription = document.getElementById('new-description');
const createCancel = document.getElementById('create-cancel');
const createError = document.getElementById('create-error');
const picker = document.getElementById('picker');
const dropzone = document.getElementById('dropzone');
const queue = document.getElementById('queue');
const toolbar = document.getElementById('toolbar');
const summary = document.getElementById('summary');
const clearBtn = document.getElementById('clear');

// Password persistence lives in app.js (shared with the manage page).

// Placeholder stored when a photo has no known photographer (traditional
// "name unknown" marker). Such photos are flagged with a red border.
const NO_NAME = 'Nomen Nescio';
const needsName = (name) => !name || name === NO_NAME;

// Photographer name is embedded in the filename between `__…__`, with `_`
// separating the name parts: `__Jane_Q_Doe__IMG1234.jpg` → "Jane Q Doe".
function photographerFromName(filename) {
  const m = /__(.+?)__/.exec(filename);
  if (!m) return '';
  return m[1]
    .split('_')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 120);
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

let slugManuallyEdited = false;
newSlug.addEventListener('input', () => { slugManuallyEdited = true; });
newName.addEventListener('input', () => {
  if (!slugManuallyEdited) newSlug.value = slugify(newName.value);
});

// The upload area is hidden until an album is chosen (or pre-selected after
// creating one, via ?album= in the URL). Album options are rendered server-side.
function syncDropzone() {
  dropzone.hidden = !albumSelect.value;
}
albumSelect.addEventListener('change', syncDropzone);

function openCreatePanel() {
  createError.textContent = '';
  slugManuallyEdited = false;
  createPanel.showModal();
  setTimeout(() => newName.focus(), 0);
}

function closeCreatePanel() {
  createPanel.close();
  newSlug.value = '';
  newName.value = '';
  newDescription.value = '';
  createError.textContent = '';
  slugManuallyEdited = false;
}

albumNewBtn.addEventListener('click', openCreatePanel);
createCancel.addEventListener('click', closeCreatePanel);
// Submitting the create form is handled by htmx (hx-post in upload.tsx); on
// success the server replies with HX-Redirect and the page reloads.

let uploaded = 0;
let failed = 0;

function updateSummary() {
  const total = queue.children.length;
  const active = total - uploaded - failed;
  const parts = [`${uploaded} uploaded`];
  if (failed) parts.push(`${failed} failed`);
  if (active) parts.push(`${active} in progress`);
  summary.textContent = parts.join(', ');
  toolbar.hidden = total === 0;
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.alt = '';
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => resolve(null), { once: true });
    img.src = url;
  });
}

// The local object-URL preview (the just-uploaded original) is already showing
// in thumbEl. Thumbnails are generated asynchronously in production, so they
// 404 for a few seconds after upload. Keep the original preview visible and
// poll for the real thumbnail, swapping it in only once it actually loads —
// never clobber the preview with a broken/"no thumb" image.
async function tryLoadThumbnail(thumbEl, album, photoId) {
  // Local dev generates the thumbnail on demand via this debug endpoint; in
  // production a blob trigger does it asynchronously (this 404s and is ignored).
  try {
    await fetch(`/api/debug/process/${encodeURIComponent(album)}/${encodeURIComponent(photoId)}`, { method: 'POST' });
  } catch { /* prod won't have this endpoint; ignore */ }

  const base = `/api/image/thumbnails/${encodeURIComponent(album)}/${encodeURIComponent(photoId)}.jpg`;
  const delays = [0, 1000, 2000, 3000, 5000, 8000, 13000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    // Cache-bust per attempt so a prior 404 is never served from cache.
    const img = await loadImage(`${base}?t=${i}`);
    if (img) {
      thumbEl.replaceChildren(img);
      return;
    }
  }
  // Gave up polling; leave the original preview in place.
}

async function uploadFile(file) {
  const photographer = photographerFromName(file.name) || NO_NAME;

  const li = document.createElement('li');
  const thumbEl = document.createElement('div');
  thumbEl.className = 'thumb';
  const info = document.createElement('div');
  info.className = 'info';
  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  nameEl.textContent = file.name;
  const metaEl = document.createElement('div');
  metaEl.className = 'photo-meta';
  const renderMeta = () => {
    metaEl.textContent = needsName(photographer)
      ? `Photo by ${NO_NAME} — click ✎ to name`
      : `Photo by ${photographer}`;
    li.classList.toggle('needs-name', needsName(photographer));
  };
  renderMeta();
  info.append(nameEl, metaEl);
  const statusEl = document.createElement('div');
  statusEl.className = 'status uploading';
  statusEl.textContent = 'uploading…';
  li.append(thumbEl, info, statusEl);
  queue.appendChild(li);
  updateSummary();

  const previewUrl = URL.createObjectURL(file);
  const preview = document.createElement('img');
  preview.src = previewUrl;
  preview.alt = '';
  preview.addEventListener('load', () => URL.revokeObjectURL(previewUrl), { once: true });
  thumbEl.appendChild(preview);

  const form = new FormData();
  form.set('album', albumSelect.value);
  form.set('photographer', photographer);
  form.set('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.password.value}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    statusEl.className = 'status ok';
    statusEl.textContent = 'uploaded';
    uploaded++;
    updateSummary();
    tryLoadThumbnail(thumbEl, json.album, json.photoId);

    const delBtn = document.createElement('button');
    delBtn.className = 'del';
    delBtn.type = 'button';
    delBtn.textContent = '×';
    delBtn.title = 'Delete photo';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete ${file.name}? This removes the original, thumbnail, and display copies.`)) return;
      delBtn.disabled = true;
      try {
        const delRes = await fetch(`/api/photo/${encodeURIComponent(json.album)}/${encodeURIComponent(json.photoId)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${settings.password.value}` },
        });
        if (!delRes.ok) {
          const text = await delRes.text();
          alert(`Delete failed: ${delRes.status} ${text.slice(0, 200)}`);
          delBtn.disabled = false;
          return;
        }
        li.remove();
        uploaded--;
        updateSummary();
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
        delBtn.disabled = false;
      }
    });

    // Photo metadata editing is handled by the shared edit.js, which binds any
    // button.edit via its data-* attributes.
    const editBtn = document.createElement('button');
    editBtn.className = 'edit';
    editBtn.type = 'button';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit photo';
    editBtn.dataset.album = json.album;
    editBtn.dataset.photoId = json.photoId;
    editBtn.dataset.photographer = photographer;
    editBtn.dataset.focalX = '';
    editBtn.dataset.focalY = '';

    li.append(editBtn, delBtn);
  } catch (err) {
    statusEl.className = 'status fail';
    statusEl.textContent = err.message;
    failed++;
    updateSummary();
  }
}

async function handleFiles(files) {
  if (!files.length) return;
  if (!albumSelect.value) {
    alert('Pick or create an album first');
    return;
  }
  if (!settings.reportValidity()) return;
  for (const file of files) {
    await uploadFile(file);
  }
}

picker.addEventListener('change', (e) => {
  // Snapshot the FileList into an array *before* clearing the input: handleFiles
  // iterates asynchronously (await per file), and `e.target.value = ''` empties
  // the live FileList mid-loop, which would drop every file after the first.
  const files = [...e.target.files];
  e.target.value = '';
  handleFiles(files);
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
});

clearBtn.addEventListener('click', () => {
  queue.querySelectorAll('.status.ok, .status.fail').forEach((s) => s.parentElement.remove());
  uploaded = 0;
  failed = 0;
  updateSummary();
});

syncDropzone();
