# Changelog

All notable changes to Qeuli. Newest first. Dates are when the change landed.

## Unreleased

### Added
- **Memory** games: the Chimp test (tap the numbers in order after they vanish) and Sequence memory
  (repeat a growing pattern, with optional sound), alongside Pair match.
- **Typing** is its own category: a word sprint, and long-form passages of prose and code. Speed counts
  only the letters you got right.
- **Games shelf and popup window.** Every game opens in its own window on a setup screen with options,
  then "Okay, start". Best scores are kept per option set.
- **Waiting report**: how much you wait on agents, the trend against last week, and what that time could
  have bought.
- A shared **game kit** (`src/scores.js`, `desktop/ui/gamekit.js`) so a new game category is a few small files.
- `LICENSE` (MIT), `CONTRIBUTING.md`, this changelog and a new README.

### Changed
- **Renamed from AgentWell to Qeuli**: the command is `qeuli`, the app is "Qeuli", environment variables
  start with `QEULI_`. An existing `~/.agentwell` data folder is still used, and `qeuli install claude`
  replaces old AgentWell hooks.
- **Arcade** is now the retro classics only (Snake and 2048). Typing and Memory moved to their own categories.
- The sidebar is the only layout (a bottom tab bar on narrow windows); the top bar is gone.
- Score labels allow longer option sets (64 characters, up to 120 per game), enforced by tests.

### Fixed
- Game windows no longer clip at the top.
- The waiting report chart no longer shows a stray "null" label.
- Hardened score storage against odd labels such as `__proto__`.
- Refreshed the shortcut icons so Windows shows the hawk logo.

## 0.1.0

First installable build.

- Local daemon (loopback only, origin-checked), Tauri desktop app with tray, autostart and single instance,
  NSIS installer.
- Hooks for Claude Code, a notify line for Codex, `qeuli run`, `watch` and auto-watch rules.
- MCP server with `suggest_for_wait`, `queue_reading`, `log_learning` and `session_status`.
- Features as folders: Water, Breaks, Parking lot, Context, Soundscapes, Arcade, Small delights, Desk
  workouts, Feed and the reading queue.
- The Qeuli design system: Sticker and Calm looks, four font packs, 14 colour schemes, eight coloured
  divisions, and the story with XP and chapters.
