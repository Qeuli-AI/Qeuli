# Changelog

All notable changes to Qeuli. Newest first. Dates are when the change landed.

## Unreleased

### Added
- **Release pipeline**: pushing a version tag builds the Windows installer and publishes it as a GitHub release.
- A project website on GitHub Pages.
- **Waiting report**: how much you wait on agents, the trend against last week, and what that time could have
  bought.
- A few quick games, with scores kept per setting.
- `LICENSE` (MIT), `CONTRIBUTING.md`, this changelog and a new README.

### Changed
- **Renamed from AgentWell to Qeuli**: the command is `qeuli`, the app is "Qeuli", environment variables
  start with `QEULI_`. An existing `~/.agentwell` data folder is still used, and `qeuli install claude`
  replaces old AgentWell hooks.
- The sidebar is the only layout (a bottom tab bar on narrow windows); the top bar is gone.

### Fixed
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
