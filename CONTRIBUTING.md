# Contributing to Qeuli

Thanks for helping. Qeuli is small on purpose: a local daemon, a desktop shell, and a set of features
that are each one folder. Most contributions are a new feature, a new game, or a fix inside one folder.

By contributing you agree that your work is released under the [MIT license](LICENSE).

## Ground rules

These keep Qeuli what it is. A change that breaks one of them will be asked to change.

- **Local only.** No accounts, no telemetry, no hosted service. A feature that needs the network must say
  which host, and send nothing about the user.
- **Keep the privacy line.** Store labels (a tool name, a file's base name), never contents, full paths,
  full commands or prompts.
- **Features are folders.** Nothing in `src/` or the Rust shell should know a specific feature by name.
- **Windows is the supported desktop.** The core and CLI are plain Node and should stay portable.
- **No new dependencies without a reason.** The daemon ships with three; each addition is bundled into
  every install.

## Set up

You need Node 20+. The desktop app also needs Rust (stable) and, on Windows, the Visual Studio C++ Build
Tools.

```bash
git clone https://github.com/Qeuli-AI/Qeuli.git
cd Qeuli
npm install
npm test                   # node --test, from this folder
```

Run `npm test` from the project folder, not a parent directory, or it will pick up unrelated test files.

### See your change

```bash
cd desktop
npm install
npm run preview            # then open the printed address
```

Preview runs its own daemon, its own data folder and its own copy of the Claude Code settings, so it
never touches an installed app or your real hooks. Edit anything under `desktop/ui/` and refresh. A
feature's `ui/` files are staged when preview starts, so restart it after editing those. Handy flags:
`--reset` (start empty), `--quiet` (mute toasts), `--port` and `--ui` (pick ports).

Building the installer (`npm run build` in `desktop/`) takes several minutes and is not needed for most
changes; a pull request does not have to include one.

## Add a feature

Create a top-level folder next to `src/`:

```
<name>/
  feature.json    id (must equal the folder name), name, description, division, defaultEnabled,
                  optional tray: [{ label, method, route }],
                  optional cli:  [{ name, method, route, arg, print, help }]
  index.js        backend: export default { setup(ctx) } returning { routes, tick, onEvent }
  ui/index.js     frontend: export function mount(ctx) that adds a screen
  *.test.js       tests (picked up by npm test)
```

Then run:

```bash
npm run features          # regenerates src/registry.js
npm test
```

A test fails if the registry is stale or the `division` is unknown. Also add the folder to `files` in
`package.json` so it ships.

### Backend `ctx`

| `ctx.` | |
| --- | --- |
| `store`, `save` | the feature's own persisted record |
| `notify(title, body)` | a desktop notification (spaced out so features never stack toasts) |
| `now` | the clock, so tests can drive time |
| `waitMsToday`, `isRunning(session)` | agent wait time today; is this session still running |
| `award(xp, reason)` | XP toward the player's story (capped per reason per day) |
| `queueAdd({ url, title, minutes })` | add to the reading queue |
| `waitHistory(days)` | per-day agent wait minutes and run counts, oldest first |

Routes are served at `/features/<id>/<route>` and may be async. Use `ctx.now` instead of `Date.now()` so
your tests can control time.

### UI `ctx`

`ctx.addView`, `ctx.call`, `ctx.setSummary` (the line on the feature's card), `ctx.setChip`,
`ctx.award`, `ctx.onAgentState`, `ctx.onRefresh`, `ctx.onTheme`, `ctx.toast`, `ctx.loadCss`, `ctx.h`.

Scope all CSS to `#view-<id>`, and use the design tokens (`--ink`, `--paper`, `--accent`, `--run`,
`--display`, `--bw`, ...) so your screen follows every font pack, style and colour scheme. A test checks
that feature CSS is scoped.

### Add a game

Games share a kit, so a new category is a few small files. See `arcade/`, `typing/` and `memory/`.

- **Backend:** `export default gameBackend({ games })` from `src/scores.js`. `games` maps an id to
  `{ name, better: 'higher' | 'lower', unit }`. It keeps best scores per option set and awards XP.
- **Screen:** `mountShelf(ctx, { id, label, icon, options, games })` from `desktop/ui/gamekit.js` gives
  you the shelf of cards, the game window with its setup screen ("Okay, start"), and the result bar.
- **Each game:** `mount(host, { h, opts, active, end }) → { stop() }`. Call `end(score)` when the round is
  over; check `active()` before touching the DOM from a timer.
- **Options:** plain data in `ui/options.js` (see `desktop/ui/gameopts.js` for the shape). Mark an option
  `cosmetic` if it should not split best scores (a skin, a sound).
- **Test:** add the folder id to `FEATURES` in `test/gamefeatures.test.js`. It checks that every option
  has a valid default, that every combination makes a score label the daemon accepts, and that no game
  offers more combinations than the daemon keeps (`MAX_VARIANTS`).

Put the rules of the game (scoring, board logic) in a plain `rules.js` with no DOM so it can be unit
tested; the games here do this.

### Add-ons without code

For a simple reminder you do not need code. A folder with only a `feature.json` that declares reminders
installs with `qeuli feature install ./folder`; see [`examples/stretch`](examples/stretch). Only the
validated manifest is copied.

## Project map

| Path | What is there |
| --- | --- |
| `src/` | The core: daemon, store, CLI, MCP server, profile and story, scores |
| `<feature>/` | One folder per feature (see above) |
| `desktop/ui/` | The app's screens, design system and shared game kit |
| `desktop/src-tauri/` | The Tauri shell (tray, autostart, spawns the daemon) |
| `desktop/scripts/` | `preview.mjs` and the build preparation |
| `extension/` | The Chrome side panel |
| `examples/` | Example add-ons |
| `test/` | Tests for the core and the shared game kit |

## Pull requests

- **One thing per PR.** A new feature, or a fix, not both.
- **Tests pass:** `npm test` from the project folder. New logic comes with tests; time-dependent code
  uses `ctx.now`.
- **Look at it.** For UI changes, run `npm run preview` and check both looks (Sticker and Calm) and a
  narrow window. Say in the PR what you checked. Screenshots are welcome.
- **Match the surrounding code:** naming, comment density, idiom. Comments explain why, not what.
- **Do not commit** build output, `node_modules`, logs or anything from `~/.qeuli`.
- **Describe the user-facing change** in plain words: what you can do now that you could not before.

## Reporting a bug

Open an issue with:

1. What you did and what you expected.
2. What happened instead. Include the message if there was one.
3. Your Windows version, Node version (`node -v`), and whether it is the installed app, the preview or the
   CLI.

For anything that looks like a security problem (for example a way for a web page to reach the daemon),
please do not open a public issue. Contact the maintainer directly instead.

## Ideas that are welcome

More retro games for Arcade, more Memory tests, more typing passages, desk workouts, reminders,
soundscapes, colour schemes, and translations. If you are unsure whether something fits, open an issue
and ask before you build it.
