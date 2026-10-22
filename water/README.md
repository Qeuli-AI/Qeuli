# Water

A built-in feature, and the reference for how a feature folder is laid out.

```
water/
  feature.json    name, description, default on/off, tray entries, CLI commands
  index.js        backend entry: setup(ctx) returns routes, tick, onEvent
  water.js        the logic (pure, takes its clock and store as arguments)
  water.test.js   tests, run with `npm test`
  ui/
    index.js      frontend entry: mount(ctx) builds the screen
    glass.js      the animated glass
    water.css     styles, every rule scoped to #view-water
```

## What it does

- Pick what you drink from: sip 100, cup 200, glass 250, mug 350, bottle 500, large bottle 750, litre 1000 ml, or a custom volume. One tap logs it.
- A per-day history with a chart, kept for over a year.
- Daily goal, default 2,500 ml. Enter your weight and it suggests about 35 ml per kg (a rough guide, not medical advice). A heavy work day, with 90+ minutes of agent waiting, adds 250 ml.
- A reminder every 120 minutes between 09:00 and 22:00 (all adjustable), skipped once the goal is met.
- A nudge when an agent run starts, you have not had water for 45 minutes, and the run is still going 20 seconds later. At most one every 30 minutes.
- A glass that fills as you drink, with a splash, ripple and bubbles when you log one.
- One-click logging from the tray menu, or `qeuli drink [ml]`.

## Routes

Served by the daemon at `/features/water/<route>`.

| Route | Does |
| --- | --- |
| `GET state` | Today's total, goal, streak, next reminder, today's log, settings |
| `POST drink` `{ ml?, vessel? }` | Log a drink (default: your vessel's volume, 10 to 2000 ml) |
| `GET history?days=30` | Per-day totals for the last N days (1 to 365), average, best day, days at goal |
| `POST undo` | Remove today's last drink |
| `PUT settings` | Weight, goal, glass size, interval, active hours (clamped to sane values) |
