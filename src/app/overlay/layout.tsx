import type { Viewport } from 'next'

/**
 * The OBS browser-source layout.
 *
 * Deliberately not the application shell: no sidebar, no navigation, none of
 * the dashboard's JavaScript. What OBS loads must stay small, because it renders
 * continuously alongside a game and an encoder.
 *
 * The transparent background is forced here with an inline style rather than a
 * class. It has to win over the app's own `body` background, it has to be right
 * in the first painted frame (a flash of dark would be a visible flash on
 * stream), and it must not depend on a CSS feature a particular OBS build might
 * not have.
 *
 * `color-scheme` is cleared for the same reason, and it is the subtler half.
 * The app declares `dark` globally, which is right for every page a person
 * looks at and wrong for this one: a declared colour scheme asks the browser to
 * paint an opaque canvas of that scheme's default colour, and an opaque canvas
 * is the one thing a browser source must never have. It costs nothing here --
 * there is no form control and no UA-styled surface on an overlay to inherit a
 * scheme -- and it is a long-standing cause of a browser source that composites
 * as a solid rectangle over the stream instead of disappearing.
 */

/**
 * Overrides the app's `colorScheme: 'dark'` for this route only.
 *
 * Next resolves viewport per route, deepest wins, so this removes the
 * `<meta name="color-scheme">` from the overlay without touching the dashboard.
 */
export const viewport: Viewport = { colorScheme: 'normal' }
export default function OverlayLayout({ children }: LayoutProps<'/overlay'>) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html:
            'html,body{background:transparent!important;color-scheme:normal!important;' +
            'margin:0;padding:0;overflow:hidden;cursor:none;' +
            '-webkit-font-smoothing:antialiased}',
        }}
      />
      {children}
    </>
  )
}
