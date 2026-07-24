const gridEl = document.getElementById('grid');
const dialog = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const captionEl = document.getElementById('caption');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const closeBtn = document.getElementById('close');

const thumbs = gridEl ? Array.from(gridEl.querySelectorAll('a')) : [];

let currentIndex = 0;
let currentThumb = null;

function detectWebpSupport() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width === 1);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
}

const webpSupported = await detectWebpSupport();

function displayUrl(thumb) {
  return webpSupported ? thumb.dataset.displayUrlWebp : thumb.dataset.displayUrlJpg;
}

function runTransition(mutate) {
  if (typeof document.startViewTransition !== 'function') {
    mutate();
    return { finished: Promise.resolve() };
  }
  return document.startViewTransition(mutate);
}

async function preload(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function updateCaption(thumb) {
  captionEl.innerHTML = '';
  const cred = document.createElement('span');
  cred.innerHTML = `Photo by <strong></strong>`;
  cred.querySelector('strong').textContent = thumb.dataset.photographer || 'unknown';
  captionEl.appendChild(cred);
  const counter = document.createElement('span');
  counter.textContent = ` · ${currentIndex + 1} / ${thumbs.length}`;
  captionEl.appendChild(counter);
}

function updateNavButtons() {
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === thumbs.length - 1;
}

async function openLightbox(index) {
  currentIndex = index;
  const thumb = thumbs[index];
  currentThumb = thumb;
  const url = displayUrl(thumb);
  const img = thumb.querySelector('img');
  await preload(url);

  img.style.viewTransitionName = 'hero';
  const t = runTransition(() => {
    img.style.viewTransitionName = '';
    lightboxImg.style.viewTransitionName = 'hero';
    lightboxImg.src = url;
    updateCaption(thumb);
    updateNavButtons();
    dialog.showModal();
  });
  await t.finished;
}

async function navigate(delta) {
  const next = currentIndex + delta;
  if (next < 0 || next >= thumbs.length) return;
  currentIndex = next;
  const thumb = thumbs[next];
  currentThumb = thumb;
  const url = displayUrl(thumb);
  await preload(url);
  runTransition(() => {
    lightboxImg.src = url;
    updateCaption(thumb);
    updateNavButtons();
  });
}

async function closeLightbox() {
  const thumb = currentThumb;
  const img = thumb ? thumb.querySelector('img') : null;
  const t = runTransition(() => {
    lightboxImg.style.viewTransitionName = '';
    if (img) img.style.viewTransitionName = 'hero';
    dialog.close();
  });
  await t.finished;
  if (img) img.style.viewTransitionName = '';
  currentThumb = null;
}

prevBtn.addEventListener('click', () => navigate(-1));
nextBtn.addEventListener('click', () => navigate(1));
closeBtn.addEventListener('click', () => closeLightbox());
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (!dialog.open) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
});

thumbs.forEach((thumb, i) => {
  thumb.addEventListener('click', (e) => {
    e.preventDefault();
    openLightbox(i);
  });
});
