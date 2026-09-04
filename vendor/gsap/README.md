# GSAP 3.14.2 — vendored

`gsap.min.js` is the unmodified GreenSock Animation Platform build published at
`https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js`.

    sha256  c174bfce53a729418d57a8ad8625e7247c793a22fef8e2851e3cfa3de9cd8280

## Why it is committed rather than fetched

HyperFrames compositions are plain HTML files driven by a GSAP timeline. Every
composition this app generates gets a copy of this file next to it, and loads it
with a relative `<script src="assets/vendor/gsap.min.js">`.

Three reasons that is a local file and not a CDN tag:

1. **A render must not depend on the network.** The renderer opens the
   composition in a headless browser with a navigation timeout. A slow or
   blocked CDN does not degrade the animation — it fails the render outright,
   which is exactly what happened the first time this pipeline ran here.
2. **Reproducibility.** The same composition rendered a year from now should
   produce the same video. A floating CDN version cannot promise that.
3. **This is a local app.** Nothing else about it phones out to render an asset;
   the motion engine should not either.

## Licence

GSAP is distributed under the GreenSock Standard "No Charge" licence
(<https://gsap.com/standard-license>). It is used here as an unmodified runtime
dependency of generated compositions, which is what that licence covers. The
copyright notice at the top of the file is intact and must stay that way.

## Upgrading

Replace the file, update the version and hash above, then re-render one
composition and confirm it still checks clean:

    npx hyperframes check
