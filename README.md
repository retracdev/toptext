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

## Running locally

It's a static site with no build step. Serve the folder with any static server, for example:

```sh
npx serve .
```

ES modules don't load from `file://`, so opening `index.html` directly won't work.

## Deploying

GitHub Pages from the `main` branch root. Add a `CNAME` file once the domain is set up.
