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
 */
export default function OverlayLayout({ children }: LayoutProps<'/overlay'>) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html:
            'html,body{background:transparent!important;margin:0;padding:0;' +
            'overflow:hidden;cursor:none;-webkit-font-smoothing:antialiased}',
        }}
      />
      {children}
    </>
  )
}
