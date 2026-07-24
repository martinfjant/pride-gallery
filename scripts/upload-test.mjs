#!/usr/bin/env node
import { readdir, readFile, unlink, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const UPLOAD_DIR = 'test-uploads';
const API_BASE = process.env.API_BASE ?? 'http://localhost:7071/api';
const PASSWORD = process.env.UPLOAD_PASSWORD ?? 'dev-password-change-me';
const PHOTOGRAPHER = process.env.PHOTOGRAPHER ?? 'Test Photographer';
const ALBUM = process.argv[2] ?? 'test';

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
};

await mkdir(UPLOAD_DIR, { recursive: true });

async function ensureAlbum(slug) {
  const res = await fetch(`${API_BASE}/albums`, {
    method: 'POST',
    headers: { authorization: `Bearer ${PASSWORD}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      slug,
      name: slug,
      description: `Test album (auto-created by upload-test.mjs)`,
    }),
  });
  if (res.status === 201) console.log(`created album "${slug}"`);
  else if (res.status === 409) { /* already exists, fine */ }
  else {
    console.error(`could not ensure album "${slug}": ${res.status} ${await res.text()}`);
    process.exit(1);
  }
}

const files = (await readdir(UPLOAD_DIR))
  .filter((f) => extname(f).toLowerCase() in CONTENT_TYPES)
  .sort();

if (files.length === 0) {
  console.log(`no images in ${UPLOAD_DIR}/ — drop some jpg/png/webp/avif/heic files in and re-run`);
  process.exit(0);
}

await ensureAlbum(ALBUM);
console.log(`uploading ${files.length} file(s) to album "${ALBUM}" at ${API_BASE}/upload`);

let ok = 0;
let fail = 0;

for (const name of files) {
  const path = join(UPLOAD_DIR, name);
  const type = CONTENT_TYPES[extname(name).toLowerCase()];
  try {
    const bytes = await readFile(path);
    const form = new FormData();
    form.set('album', ALBUM);
    form.set('photographer', PHOTOGRAPHER);
    form.set('file', new Blob([bytes], { type }), name);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${PASSWORD}` },
      body: form,
    });
    if (!res.ok) {
      console.error(`  FAIL ${name}: ${res.status} ${await res.text()}`);
      fail++;
      continue;
    }
    const json = await res.json();
    console.log(`  OK   ${name} → ${json.originalBlob}`);
    await unlink(path);
    ok++;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    fail++;
  }
}

console.log(`\n${ok} uploaded, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
