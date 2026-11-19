# Toptext

Put words on any picture. Part of the [retrac.space](https://retrac.space) collection.

Toptext is an image caption adder and editor: drop in a picture (or start from a painted starter), add words, stickers and frames, give it a look, and download it. Everything runs in the browser and nothing is uploaded.

## Features

- **Pictures in every way**: choose a file, drag and drop, or paste with Ctrl+V. Painted starters and blank canvases for when there's no picture.
- **Words**: 15 fonts, solid and gradient fills, outlines, shadow / 3D / glow / neon effects, boxes, highlights, pills and speech bubbles, alignment, spacing and line height.
- **Direct editing**: drag to move (snaps to center), corner to resize, side handles for wrap width, top handle to tilt. Double-click to edit words.
- **Stickers**: emoji stickers, or your own picture as a layer.
- **Layouts**: Classic, Top bar, Bottom bar, Sandwich, Poster, Instant and Border frames. Switching layouts re-places your captions.
- **Effects**: looks like Deep fried, Nuclear, Vintage, Noir, Vapor and Potato, plus fine-tune sliders (brightness, contrast, saturation, hue, warmth, blur, grain, pixelate, vignette, RGB split, deep fry), turning and flipping.
- **Caption dice**: roll random captions with R.
- **Your Stack**: every download is saved in this browser so you can reopen it and keep editing. Your current work autosaves too.
- Undo / redo, keyboard shortcuts, PNG or JPG, copy to clipboard and share.

## Beta

Toptext is in beta (version 0.1). The first visit shows a short beta notice, remembered with a cookie. Visitors signed in to their retrac.space account get a welcome pill at the top. Account features like cloud saves, favorites and sharing aren't here yet.

## Running locally

It's a static site with no build step. Serve the folder with any static server, for example:

```sh
npx serve .
```

Live updates fetch `version.yml`, so opening `index.html` straight from `file://` won't work.

## Publishing an update

Open tabs update themselves in place, without reloading, through `js/live-update.js` (the same system as Simple Soundboard):

- Raise the version in `version.yml`. The "Sync version" workflow copies it into `<meta name="toptext-version">` in `index.html` on `main` (locally, `npm run set-version` does the same). Open tabs check every 30 seconds and only install a page whose meta matches `version.yml`.
- The footer's **Check for Updates** button fetches the newest copy right away.
- Keep every file in `js/` wrapped in a function, and share things between files through `window` properties. Don't add top-level `let`, `const` or `class`, or ES modules, because updates run each script again in the same page.
- Scripts between `js/splash.js` and `js/app.js` call `ToptextSplash.partLoaded()` when they finish; if you add one, raise `CODE_PARTS` in `js/splash.js`.
- Anything that must be put away when the app is replaced registers `window.ToptextLiveUpdate.onDispose(fn)`. Listeners on `window`/`document`, timers, observers, fetches and Web Locks are cleaned up automatically.
- `js/live-update.js` itself is never replaced by a live update. Changes to it reach visitors on their next real page load.

## Deploying

GitHub Pages from the `main` branch root (`toptext.retrac.space`).
