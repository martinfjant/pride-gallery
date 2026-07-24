# Festival Photo Gallery — Architecture & Decisions

## Context

Replacement for last year's gallery (bilder.stockholmpride.org), which was built in a
way we don't want to continue. Roughly the same scale as last year: ~24 albums/events,
likely 2,000–5,000+ photos total across the festival, contributed by multiple
photographers. This is Stockholm Pride, Sweden's largest LGBTQ+ festival, so expect
meaningful public traffic during and after the event — not a small personal gallery.

Last year's images were served quite small even in "full" view (~300–400px wide
lightbox images). We want better image quality this time, within a reasonable budget.

## Requirements

- Uploaders must **not** need Azure accounts or logins — uploads go through our own
  endpoint, not direct Azure Portal/Storage Explorer access.
- Thumbnails must be generated **server-side**, not client-side — visitor experience
  matters, and we can't rely on upload devices to do resizing well.
- No hard requirement to be free, but should stay **under $100/month**, ideally well
  under it.
- Built in **TypeScript** (not C#).
- **Uploaders authenticate via Azure SSO (Entra ID)** on the frontend for the upload
  part specifically — this is distinct from the "no Azure account needed" point
  above, which refers to *not* needing raw Storage/Portal access. Uploaders (likely
  festival staff/photographers) will sign in through Entra ID; the general public
  browsing the gallery does not need to authenticate.
- **Gallery frontend must not be an SPA.** Prefer several plain HTML pages plus
  modern native browser features — `<dialog>` for photo lightboxes, and the
  View Transitions API for smooth navigation between pages/photos — over a
  JS framework/SPA approach. Keep JavaScript on the gallery-viewing side minimal.

## Chosen Architecture

- **Azure Functions, Node.js v4 programming model, TypeScript.**
  No `function.json` — triggers/bindings defined in code via `app.http()`,
  `app.storageBlob()`, etc.
- **Blob Storage** holds original photos and generated thumbnails/display sizes.
  Not the same as Static Web Apps' storage — Blob Storage scales far beyond the
  250MB/500MB SWA app-content limit that caused problems last year. That limit only
  applies to the deployed app package, not to a separate Blob Storage account.
- **Upload path**: HTTP-triggered function accepts the photo from the browser and
  writes it to Blob Storage server-side (using the function's own storage credentials).
  Uploaders never touch Azure directly. (Alternative considered: client uploads
  directly via a short-lived SAS token issued by a function — worth revisiting if
  upload volume/bandwidth on the function becomes a bottleneck.)
- **Thumbnail generation**: Blob-triggered function, using the **Event Grid source**
  (not the default polling trigger) for near-real-time processing after upload.
  Uses the **`sharp`** library (Node/libvips) to generate thumbnail + display sizes —
  there's no direct equivalent to C#'s ImageResizer/ImageBuilder in Node.
- **Metadata storage**: Azure Table Storage — cheap, simple key/lookup store for
  photo records (album, filename, uploader, timestamps, etc.).
- **Listing API**: HTTP-triggered function reads Table Storage and returns JSON for
  the frontend gallery.
- **CDN in front of Blob Storage** (Azure Front Door or similar): recommended from
  day one, not just an optimization added later. Festival galleries have a strong
  repeat-view pattern (many visitors viewing the same popular photos), which a CDN
  caches at the edge — cutting both origin egress cost and load times. Front Door's
  ~$35/month base fee is expected to be worth it at this scale/popularity.
- **Upload authentication**: Azure Entra ID (Azure AD) SSO gates the upload page/
  endpoint. Options to weigh during build: Static Web Apps' built-in Entra ID auth
  (simplest, if SWA is used for hosting), or `@azure/msal-browser` +
  validating the token in the upload Function directly (more control, works
  regardless of hosting choice). The upload Function should verify the token
  server-side either way — don't rely on frontend-only gating.
- **Gallery frontend**: multiple plain HTML pages (e.g. one per album, one per
  photo or a dialog-based lightbox) rather than a single-page app. Use:
  - `<dialog>` element (native, no JS library) for the photo lightbox/viewer.
  - **View Transitions API** for smooth animated navigation between the album
    grid and individual photos, and between pages.
  - Minimal vanilla JS only where necessary (opening/closing dialogs, wiring up
    transitions, fetching the photo-listing JSON from the API). No React/Vue/
    framework runtime for the gallery-viewing experience.
  - Hosted as static files — Static Web Apps or plain Blob Storage static website
    hosting both work here since it's just HTML/CSS/a little JS, not a framework
    build output.

## Security notes

- Many Azure accounts now disable anonymous/public blob container access by default.
  Plan on serving images via CDN/SAS rather than assuming public container access
  will just work.
- CORS configuration still needed on the Function App for browser access.

## Cost estimate (working numbers, not guarantees)

Assumptions: ~4,000 photos, ~800KB average display size + ~50KB thumbnail,
CDN caching, 50,000–100,000 visits during/after the festival.

| Component | Estimate |
|---|---|
| Blob Storage (Hot tier, ~3.5GB) | <$1/month |
| Function executions (uploads + thumbnailing + API) | $0 (well within free monthly grant) |
| Bandwidth/egress (after CDN caching + 100GB free tier) | ~$10–60/month depending on actual traffic |
| CDN base fee (Azure Front Door Standard) | ~$35/month |
| **Total** | **Roughly $10–100/month, likely $40–70 in a realistic high-traffic scenario** |

Biggest lever on cost: total bandwidth to visitors, driven mainly by how much
full-resolution image data gets served vs. thumbnails, and how effectively the CDN
caches popular images. Photo original file size (if uploaders' devices produce very
large files) is the next biggest lever.

## Open items / things to decide during build

- Direct-to-blob upload via SAS token vs. proxying uploads through the function
  (revisit if upload traffic is heavy).
- Exact thumbnail/display image dimensions and compression settings (last year's
  were notably small; we want to improve this without ballooning bandwidth costs).
- Whether to organize by album/event in Table Storage partition keys (recommended,
  given ~24 distinct albums).
- Public container access strategy (CDN-only vs. SAS-gated vs. public + CDN).
