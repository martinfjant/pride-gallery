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
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          {/* viewport-fit=cover lets full-bleed backgrounds (and modal
              backdrops) paint into the iOS safe areas behind the status/address
              bars instead of being letterboxed below them. */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title safe>{props.title}</title>
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
        </head>
        <body>{props.children}</body>
      </html>
    </>
  );
}

export function CrossLink(props: { href: string; label: string }): JSX.Element {
  return (
    <a href={props.href} style="font-size: 0.55em; font-weight: normal;" safe>
      {props.label}
    </a>
  );
}
