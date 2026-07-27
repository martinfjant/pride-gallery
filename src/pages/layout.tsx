import type { PropsWithChildren } from '@kitajs/html';
import { assetUrl } from '../shared/assets';

/**
 * Shared HTML shell. `scripts` names shared libraries to load (deferred, in
 * order) from `/api/<name>.js` — e.g. `['htmx', 'app', 'edit']`. Page-specific
 * module scripts (album.js, upload.js) are still added directly in the page.
 */
export function Layout(props: PropsWithChildren<{ title: string; scripts?: string[] }>): JSX.Element {
  return (
    <>
      {'<!doctype html>'}
      <html lang="sv">
        <head>
          <meta charset="utf-8" />
          {/* viewport-fit=cover lets full-bleed backgrounds (and modal
              backdrops) paint into the iOS safe areas behind the status/address
              bars instead of being letterboxed below them. */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title safe>{props.title}</title>
          {/* Preload the primary (Latin) display font. Without this the browser
              only discovers it after fetching + parsing styles.css, forming a
              3-deep critical chain (HTML -> CSS -> font). Preloading fetches it
              in parallel with the CSS. `crossorigin` is required even same-origin
              — fonts are always fetched in anonymous CORS mode, and the preload
              must match or it double-fetches. The Latin subset covers Swedish
              å/ä/ö; the -ext subset is loaded lazily only if its glyphs appear. */}
          <link
            rel="preload"
            href="/api/fonts/bricolage-grotesque-latin.woff2"
            as="font"
            type="font/woff2"
            crossorigin="anonymous"
          />
          <link rel="stylesheet" href={assetUrl('styles.css')} />
          {(props.scripts ?? []).map((name) =>
            // htmx is a classic UMD global; our own scripts are ES modules so
            // their top-level bindings don't collide in the shared global scope.
            name === 'htmx' ? (
              <script defer src={assetUrl('htmx.js')}></script>
            ) : (
              <script type="module" src={assetUrl(`${name}.js`)}></script>
            ),
          )}
          {/* GoatCounter privacy-friendly pageview analytics. Loaded async from
              the vendor CDN; sends a hit to the stockholmpride.goatcounter.com
              endpoint. On every page via the shared Layout. */}
          <script data-goatcounter="https://stockholmpride.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
        </head>
        <body>
          {props.children}
          <Footer />
        </body>
      </html>
    </>
  );
}

/**
 * Site footer with the Stockholm Pride wordmark, centered. The <picture> serves
 * the black-text logo in light mode and the white-text logo in dark mode via a
 * prefers-color-scheme media source, so the browser fetches only the one that
 * matches the visitor's theme.
 */
export function Footer(): JSX.Element {
  return (
    <footer class="site-footer">
      <picture>
        <source srcset={assetUrl('logo-dark.svg')} media="(prefers-color-scheme: dark)" />
        <img class="footer-logo" src={assetUrl('logo-light.svg')} alt="Stockholm Pride" width="273" height="126" loading="lazy" />
      </picture>
      <nav class="footer-links">
        <a href="https://stockholmpride.org">Stockholm Pride</a>
        <a href="https://program.stockholmpride.org">Årets Program</a>
        <a href="/api/upload-page">Admin</a>
      </nav>
    </footer>
  );
}

export function CrossLink(props: { href: string; label: string }): JSX.Element {
  return (
    <a href={props.href} style="font-size: 0.55em; font-weight: normal;" safe>
      {props.label}
    </a>
  );
}
