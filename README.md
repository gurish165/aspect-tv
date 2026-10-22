# Aspect TV

A standalone bouncing Aspect logo for a TV, projector, or browser window, with an 8-bit arcade on top for event booths. It keeps the original website's seven-color bounce sequence and CRT treatment: horizontal scanlines, RGB texture, a four-second brightness sweep, and darkened edges. The animation fills the screen itself.

## Run locally

Use Node.js 24 LTS (or another version supported by the `engines` field in `package.json`).

```sh
npm install
npm run dev
```

Open http://localhost:5173 for the TV screen and http://localhost:5173/?admin for the admin panel (press **S** on the TV screen to open it). Move the TV window onto your TV and press **F** for fullscreen. Settings changed in the admin tab apply to the TV tab right away; both tabs keep them in this browser's local storage. Older bookmarks with logo settings in the URL (`?logoWidth=40&logoHeight=20&speed=0.75`) still load those settings the first time.

There are no remote services, fonts, analytics, accounts, or API keys. After dependencies are installed, it works without an internet connection. Hidden tabs stop advancing the animation, and returning to the tab does not cause a large jump.

## Arcade

The bouncing logo doubles as the attract screen for **Aspect Arcade**. Attendees play with a numeric keypad only; staff use the admin window with the mouse.

1. **Attract:** a big PLAY button between two scrolling tapes, the event name along the top and today's top scorers along the bottom. Behind it, either the bouncing logo or, in corner mode, the Aspect logo in one corner over an animated neon grid. Press **Enter** to start, or **Tab** (noted on the bottom tape) for today's top 10 per game (**Tab**, **Back**, or **Enter** returns). In corner mode the top 10 also comes up on its own every 20 seconds once there are scores.
2. **Choose a game:** **4**/**6** pick, **Enter** plays, **Back** exits.
3. **How to play:** shows the keypad keys for that game and the time limit, then counts down from 10 so players have time to read them. **Enter** starts right away.
4. **Play:** **Back** pauses. While paused, **Enter** resumes and **Back** ends the game. With a time limit on, the clock shows at the top and the game ends with TIME'S UP.
5. **Game over → initials:** a score in today's top 10 asks for three initials (**8**/**2** change the letter, **4**/**6** move, **Enter** confirms).
6. **Reward:** shows the reward tier, a four-character claim code, and the prize handoff text. **Enter** returns to the attract screen.

Every screen times out back to the attract screen if someone walks away (30 s on the picker, 45 s paused or entering initials, and a configurable time on the reward screen). **+**/**-** change the volume unless staff turn that off. Keypad keys are matched by physical key, so NumLock on or off doesn't matter. Arrow keys, Enter, and Backspace work on a laptop keyboard for testing. Staff can rebind every key in the admin window's **Keys** tab, and every keycap on the TV shows the first key bound to its action.

| Game                                                                                                                                                                                                                                                | Keys                                           | Scoring                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- |
| **File Feast** (snake): eat creative files to grow. Each segment keeps the color of the file that grew it, and the game-over screen lists your library. Golden 4K files are worth extra                | **5 1 2 3** steer                               | 10 per file, 50 per 4K file     |
| **On Set** (runner): a camera on a dolly rolls across a film set, jumping cables, C-stands, and apple boxes and ducking boom mics. Every 15 seconds a clapperboard slates a new scene: Studio Lot, Wild West, Neon City, Outer Space, Under the Sea | **0** jumps (hold to jump higher), **.** ducks | Distance, plus 25 per film reel |

Game names and art are placeholders until the design pass; names can be changed in the admin window.

Claim codes use four characters with no vowels (so they never spell words) and no 0, O, 1, or I. In the desktop app, every finished play is appended to `arcade-plays.jsonl` in the app's data folder (`~/Library/Application Support/aspect-tv/` on macOS), one JSON object per line with its code, game, score, tier, initials, length, how it ended, difficulty preset, and time limit. Codes never repeat within the log. High scores are per machine and reset each day. The desktop app also keeps the display from sleeping.

Games draw on a small canvas, 312×178 arcade pixels in the locked booth window, and scale up with hard pixel edges under the same CRT effect as the logo. The canvas follows the window, the size and stretch settings, and the margins, and every screen lays itself out from the current size. The font, sprites, and chiptune sounds are all generated in code, so there are no asset files. `npm test` runs the game, flow, and settings tests.

## Admin window

The desktop app opens two windows: the borderless **TV window** players see, and a normal **admin window** for staff. The admin window opens beside the TV window, never on top of it, and warns if it's ever dragged over the TV's part of the screen. **Booth → Show Admin Window** (**⌘,**) reopens it; pressing **S** on the TV window does the same. Closing the TV window quits the app.

Only the focused window receives the keypad, so the admin window always shows who has it:

- **Green, "Keypad → GAME":** players can play.
- **Amber, "Keypad → ADMIN":** you're working in the admin window. A game in progress pauses. After 20 seconds without mouse or keyboard use in the admin window, the keypad goes back to the game on its own (configurable, or off).
- **Red, "Keypad → another app":** click **Give keypad to game** or press **⌘G**.

Everything below applies to the TV immediately and is saved on this laptop:

- **Plays & codes:** today's play count, typical game length, and tiers per game, for tuning difficulty toward 30-60 second games. Search a code or initials to verify a claim, and mark it claimed so it can't be claimed twice.
- **Difficulty:** Easy, Normal, Hard, and Expert presets per game, plus every value behind them. Snake: start and top speed, how often and how much it speeds up, segments per file, and square size. Runner: start and top speed, seconds to top speed (tougher obstacles unlock along the way), obstacle spacing (there's always room to land a jump), and runner size. The time limit per game (default 60 s, or off) is the surest way to keep the line moving.
- **Rewards:** the minimum score for each tier, per game. Players only see the tier name; credit amounts stay internal.
- **Arcade & text:** game names and taglines, the top tape's event name, the start screen headline and tagline, the two prize handoff lines, volume, whether players can change volume, and how long the reward screen stays up.
- **Keys:** which keys drive each action (up, down, left, right, Enter, jump, duck, back, top 10, volume). Click **Add key** and press the key; the first key on a row is the one drawn on the TV. Changes reach the TV right away.
- **TV fit & picture:** **Boost for the CRT** turns on real TV mode (no simulated scanlines, color fringes, or vignette, which only darken a real CRT), raises brightness, contrast, and color, and turns on bold edges (thick, bright walls in File Feast and a thicker floor in On Set). Each piece can also be adjusted on its own. Then arcade size (bigger text, snake, and runner), horizontal stretch (for a TV that squishes or widens the picture), margins (for a TV that crops the edges), and position. Turn on the test pattern and adjust until the circle looks round and all four red corners are visible on the TV.
- **Home screen:** bouncing logo or corner logo with the neon grid, and which corner; plus the bouncing logo's width, height, speed, CRT strength, scanline spacing, glow, edge margin, and pause.
- **Window & scores:** lock or unlock the TV window, fullscreen, and clearing today's high scores.

## Desktop app

The TV window has no title bar and no traffic-light buttons. While it's unlocked, drag its background to move it and drag its edges to resize it. **Lock TV window** in the admin window pins its position and size, including on the next launch. Bounds, the lock, and all settings are saved per machine in the app's user data folder, so each computer keeps its own setup. Quit with **⌘Q**.

```sh
npm run desktop:dev      # loads http://localhost:5173 (start `npm run dev` first) for live reload
npm run desktop          # builds, then loads dist/ without a server
npm run desktop:package  # builds release/mac-arm64/Aspect TV.app (unsigned)
```

The main process lives in `electron/main.js`: it owns the settings and the play log, and tells both windows about every change. `electron/preload.cjs` bridges the windows to it and handles dragging the TV window.

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
- `src/lib/settings.ts` defines the logo settings and their slider ranges.
- `src/lib/booth.ts` defines every booth setting, its range, and the difficulty presets; `src/lib/boothStore.ts` shares them between windows.
- `src/components/AspectLogo.tsx` holds the original vector logo artwork.
- `src/components/BouncingDisplay.tsx` fits the animation to its parent container. To embed it elsewhere, give that parent an explicit width and height.
- `src/components/CRTOverlay.tsx` and `src/styles.css` create the CRT effect.
- `src/App.tsx` is the TV window; `src/admin/` is the admin window.
- `src/arcade/` holds the arcade: `arcade.ts` (screens and flow), `games/` (one file per game), `input.ts` (reads the key bindings from `src/lib/keys.ts`), `audio.ts`, `pixel.ts` (font, drawing, and layout helpers), `rewards.ts`, and `scores.ts` (high scores, play log, and claim codes). `src/components/ArcadeScreen.tsx` sizes the canvas and runs the arcade at a fixed 60 steps per second.

The app uses React, TypeScript, Vite, and Motion. Logo movement and the CRT sweep use Motion values without rerendering React every frame.

## Visual treatment

The animation uses Aspect's vector logo, a seven-color sequence, an 8:6 movement ratio, and layered CRT effects. The vector view box is cropped to the artwork so its visible edges match the bounce boundaries. RGB edge fringes use small offset logo layers instead of a filter over the entire screen.
