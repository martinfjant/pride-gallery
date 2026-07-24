# Pride Gallery

Photo gallery for the Stockholm Pride festival — a replacement for the previous
`bilder.stockholmpride.org`. Built to handle roughly festival scale: ~24 albums,
2,000–5,000+ photos contributed by multiple photographers, and meaningful public
traffic (50,000–100,000 visits) during and after the event.

Photographers upload through the site's own endpoint (no Azure account needed);
thumbnails and display-size images are generated server-side; and the public
browses a fast, non-SPA gallery served through a CDN.

## How it works

- **Azure Functions** (Node.js v4 model, TypeScript) — HTTP endpoints for pages,
  upload, and the listing API, plus a blob-triggered function that generates
  images with [`sharp`](https://sharp.pixelplumbing.com/).
- **Blob Storage** holds originals, thumbnails, and display-size images.
- **Table Storage** holds photo/album metadata (album, filename, photographer,
  focal point, timestamps).
- **Server-rendered pages** via [`@kitajs/html`](https://github.com/kitajs/html) —
  plain HTML pages with minimal vanilla JS (plus htmx on the manage/upload side),
  not a single-page app.
- **Azure Front Door** sits in front of everything as the CDN; in production the
  whole site (pages + images) is served through it.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design rationale, cost
estimates, and open decisions.

## Prerequisites

- **Node.js 20+**
- **[Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)** (`func`)
- **[Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite)** — the local Blob/Table storage emulator
- **[Azure CLI](https://learn.microsoft.com/cli/azure/)** (`az`) — only needed to deploy

## Local development

1. **Install dependencies**

   ```
   npm install
   ```

2. **Create your local settings** from the example (this file is gitignored — it
   holds your dev upload password):

   ```
   cp local.settings.json.example local.settings.json
   ```

   Edit `UPLOAD_PASSWORD` to whatever you want to use locally. The storage
   connections default to `UseDevelopmentStorage=true`, which points at Azurite.

3. **Start Azurite** (in its own terminal, or as a background service):

   ```
   azurite --silent --location .azurite
   ```

4. **Build and run the Functions host:**

   ```
   npm start
   ```

   `npm start` cleans, compiles TypeScript, and launches `func start`. The site
   is then available at `http://localhost:7071/` — the gallery at `/`, albums at
   `/{slug}`, and the upload/manage pages under `/api/`.

   Use `npm run watch` in a second terminal for incremental TypeScript rebuilds
   while developing.

To upload a test photo from the command line, drop an image and run
`npm run upload-test` (see `scripts/upload-test.mjs`).

## Deploying to Azure

Deployment is scripted end-to-end in [`infra/deploy.sh`](./infra/deploy.sh), which
provisions the infrastructure (Bicep templates in `infra/`) and pushes the code.

1. Sign in: `az login` (and `az account set --subscription <id>` if you have more
   than one).
2. Set the required env var(s) — see [`.env.example`](./.env.example):

   ```
   export UPLOAD_PASSWORD='a-strong-password'   # required, kept secret
   # optional overrides: LOCATION, RESOURCE_GROUP, BASE_NAME
   ```

3. Run the deploy:

   ```
   ./infra/deploy.sh
   ```

The script prints the Front Door URL when it finishes. On the first deploy, Front
Door can take 5–10 minutes to finish propagating. In production the site is served
through Front Door — the direct Function App URL works for pages/API, but images
are only routed via Front Door → Blob Storage.

## Project layout

```
src/functions/   Azure Functions (HTTP endpoints + blob trigger)
src/pages/       Server-rendered pages (@kitajs/html)
src/shared/      Shared logic — storage, image processing, auth, albums, photos
public/          Static assets (CSS, client JS, htmx)
infra/           Bicep templates + deploy.sh
scripts/         Dev/utility scripts
```

## Configuration

Runtime configuration comes from environment variables (from `local.settings.json`
locally, or App Settings in Azure). Key ones:

| Variable | Purpose |
|---|---|
| `UPLOAD_PASSWORD` | Interim password gating uploads (Entra ID SSO planned to replace this) |
| `PHOTOS_STORAGE_CONNECTION` | Blob/Table Storage connection string |
| `ORIGINALS_CONTAINER` / `DISPLAY_CONTAINER` / `THUMBNAILS_CONTAINER` | Blob container names |
| `PHOTOS_TABLE` | Table Storage table for photo metadata |
| `ENABLE_DEBUG_ENDPOINTS` | Enables debug/reprocess endpoints (keep off in prod) |

> **Note:** Upload auth currently uses a shared password as an interim measure;
> the planned model is Azure Entra ID SSO for photographers. Never commit
> `local.settings.json` or real passwords — the example files are the only
> config that belongs in git.
