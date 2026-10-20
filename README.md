# Aspect TV

A standalone bouncing Aspect logo for a TV, projector, or browser window. It keeps the original website's seven-color bounce sequence and CRT treatment: horizontal scanlines, RGB texture, a four-second brightness sweep, and darkened edges. The animation fills the screen itself.

## Run locally

Use Node.js 24 LTS (or another version supported by the `engines` field in `package.json`).

```sh
npm install
npm run dev
```

Open http://localhost:5173. Move the window onto your TV, then click **Fullscreen**, press **F**, or double-click the background. The browser requires that user action to enter fullscreen. Press **Esc** to leave fullscreen.

The pointer and controls disappear after 3.5 seconds without activity. Move the pointer, tap the screen, or press a key to bring them back. Controls remain visible while settings are open or a control has keyboard focus.

## Adjust the display

Click **Settings** or press **S**. Adjust logo size, speed, CRT strength, scanline spacing, glow, and edge margins. Press **Space** or click **Pause** to pause both the logo and the scan sweep. Reset restores the original app defaults.

Logo size and edge margin are percentages of the shorter side of the containing window. The logo keeps its proportions. A `ResizeObserver` recalculates the boundaries when the window resizes or enters fullscreen, preserving the logo's relative position. It also works in portrait and ultrawide windows.

The URL updates as you change settings. Bookmark it to reopen the same setup, for example:

```text
http://localhost:5173/?logoSize=40&speed=0.75&crt=1.3&glow=0.6&padding=4
```

There are no remote services, fonts, analytics, accounts, or API keys. After dependencies are installed, it works without an internet connection. A system preference for reduced motion starts it paused; press Play to opt into animation. Hidden tabs stop advancing the animation, and returning to the tab does not cause a large jump.

## Open it from a TV's browser

```sh
npm run dev:network
```

Use the Network URL printed by Vite on a TV connected to the same local network. On the TV, `localhost` would refer to the TV itself, so use your computer's network address. If the TV browser does not support the Fullscreen API, use its own fullscreen option. Your computer must stay awake and keep the server running.

## Production build

```sh
npm run build
npm run preview
```

The static output lives in `dist/` and can be served by any static web server. `npm run check` checks TypeScript without building. For a network-accessible production preview, run `npm run preview -- --host 0.0.0.0`.

## Source layout

- `src/lib/bounce.ts` contains the bounce simulation and color palette.
- `src/lib/settings.ts` defines settings, slider ranges, and URL parsing.
- `src/components/AspectLogo.tsx` holds the original vector logo artwork.
- `src/components/BouncingDisplay.tsx` fits the animation to its parent container. To embed it elsewhere, give that parent an explicit width and height.
- `src/components/CRTOverlay.tsx` and `src/styles.css` create the CRT effect.
- `src/App.tsx` manages fullscreen, keyboard controls, and the settings panel.

The app uses React, TypeScript, Vite, and Motion. Logo movement and the CRT sweep use Motion values without rerendering React every frame.

## Visual treatment

The animation uses Aspect's vector logo, a seven-color sequence, an 8:6 movement ratio, and layered CRT effects. The vector view box is cropped to the artwork so its visible edges match the bounce boundaries. RGB edge fringes use small offset logo layers instead of a filter over the entire screen.
