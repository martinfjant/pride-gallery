# CDN / custom-domain decision: Azure Front Door vs. Cloudflare

**Status: Option A (keep Front Door) chosen for now — 2026-07-24.** To be discussed
further with the Azure admin before any migration. This document captures the
analysis so that conversation starts from facts, not memory.

Task references: **#14** (custom domain + TLS).

---

## Context

The Pride Gallery is a photo gallery (~24 albums, 2–5k photos, ~50–100k visits
during festival season) hosted in Azure resource group `martin-playground`
(Contributor-only rights). It replaces `bilder.stockholmpride.org`, whose DNS
zone is already fronted by **Cloudflare**.

The app currently serves everything through **Azure Front Door Standard**, which
is deployed and working today on the `*.azurefd.net` URL. The remaining task is
to attach the real custom domain — which is a natural moment to ask whether Front
Door should stay in the picture at all, given Cloudflare already fronts the zone.

> Historical note: back on 2026-07-09 we considered dropping Front Door because
> the `Microsoft.Cdn` resource provider was unregistered and Contributor rights
> couldn't register it. **That blocker is gone** — the admin registered the
> provider, Front Door deployed cleanly. So the only remaining argument for
> dropping Front Door today is **cost**, not the provider blocker.

---

## Fact 1 — Front Door is essentially the entire cost of the project

Month-to-date actual cost, RG `martin-playground` (2026-07-01 → 2026-07-24):

| Service | Cost MTD |
|---|---|
| **Azure Front Door** | **110.36 SEK** |
| Storage | 3.49 SEK |
| Functions / Event Grid / App Service / Bandwidth / Log Analytics | ~0.00 SEK |

That is ~110 SEK in 24 days **at essentially zero traffic** (≈ ~140 SEK/month
idle projection). Front Door Standard carries a base platform fee paid regardless
of traffic. Against the configured monthly budget of **200 SEK**, Front Door
alone is ~70 % of the budget *before* any festival traffic, and it grows with
egress/requests during the event.

Everything else in the stack costs a few SEK/month.

---

## Fact 2 — What Front Door actually does (what any replacement must reproduce)

The app emits **relative** image URLs. `src/shared/imageUrl.ts` uses the
`PUBLIC_IMAGE_BASE` env var, currently set to `''`, so image URLs come out as
`/thumbnails/{album}/{id}.{ext}` and `/display/{album}/{id}.{ext}`.

Front Door serves two origins off a **single hostname**, split by URL path:

- `/thumbnails/*` and `/display/*` → **Blob Storage** (public containers, edge-cached)
- everything else `/*` → **Function App** (gallery pages + `/api/*`)

This **two-origin, path-based split** is the crux. Any replacement must reproduce
it — either by path (like today) or by moving images to a separate hostname.

Relevant infra: `infra/resources.bicep` (Front Door profile, two origin groups,
`images` route + `app` route).

---

## The options

### Option A — Keep Front Door, attach the custom domain to it  ← chosen for now

- CNAME `bilder.stockholmpride.org` → the Front Door endpoint.
- In Cloudflare, the record is **DNS-only (grey cloud)** so Cloudflare does *not*
  proxy — avoids a wasteful double-CDN (Cloudflare → Front Door → origin).
- Front Door managed TLS certificate for the custom domain.

**Pros:** zero re-architecture; works today; managed TLS; the path-split is
already handled; single hostname; safe.
**Cons:** keeps paying ~140+ SEK/mo (dominant cost, grows with festival egress);
Cloudflare sits unused for this subdomain.

### Option B — Drop Front Door, two Cloudflare subdomains  (recommended end state)

Because the app already supports `PUBLIC_IMAGE_BASE`, origins can be split by
**hostname** instead of by path:

- `bilder.stockholmpride.org` (orange-cloud / proxied) → Function App
- `img.stockholmpride.org` (orange-cloud / proxied) → Blob Storage,
  with `PUBLIC_IMAGE_BASE=https://img.stockholmpride.org`

Each is a **single-origin** Cloudflare proxy — no Origin Rules, no Workers, no
path juggling. Cloudflare caches images for free.

**Pros:** eliminates the ~140 SEK/mo Front Door cost → project runs at
storage-only cost (a few SEK/mo); reuses the CDN already owned; free Cloudflare
caching + WAF + analytics.
**Cons:** requires removing Front Door / `Microsoft.Cdn` from Bicep; two DNS
records; a Cloudflare cache rule on the image subdomain; **Host-header / TLS
handling for the Azure origins** — Cloudflare "Full" TLS mode, and the Host
header must match each Azure origin (`*.azurewebsites.net` for the Function App,
`*.blob.core.windows.net` for storage) via a Host-header override, or the custom
domain must be added to the Function App.

### Option C — Drop Front Door, one Cloudflare hostname + Origin Rules path-split

Keep relative URLs; use Cloudflare **Origin Rules** to route `/thumbnails/*` and
`/display/*` to Blob and everything else to the Function App.

**Pros:** single hostname, no `PUBLIC_IMAGE_BASE` change.
**Cons:** per-path origin override against two Azure origins (Host-header +
resolve override) is the fiddliest of the three. Recommend B over C.

---

## Recommendation

- **Destination: Option B.** It kills the dominant recurring cost using a CDN
  already owned, and is genuinely simpler than the current setup.
- **Timing caveat:** Stockholm Pride is typically end of July / first days of
  August — likely close. Ripping out working image-serving right before the
  traffic peak is risky. ~110 SEK for one more month is cheap insurance.
- **Therefore:** keep Front Door (Option A) through the festival, then migrate to
  Option B afterward. If the festival is further off than assumed, B can be done
  now with runway to validate.

**Current decision: Option A**, pending discussion with the admin.

---

## Open questions for the admin

1. **Festival / traffic-peak date** — decides "migrate now" vs. "migrate after".
2. **Subdomain ownership** — is `img.stockholmpride.org` (or similar) ours to
   create in the Cloudflare zone? Option B needs one extra subdomain.
3. **Cloudflare TLS mode / origin access** — comfortable running Cloudflare
   "Full" mode against Azure origins with Host-header overrides? Any objection to
   the Function App + blob hostnames being reachable behind Cloudflare?
4. **WAF / rate-limiting expectations** — if Cloudflare fronts the app directly
   (Option B), what protection posture is expected for the upload/admin routes?
