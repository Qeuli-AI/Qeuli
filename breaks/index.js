// Breaks: backend entry. The core calls setup() once and then only uses what it returns.
// ctx is the same contract as water/index.js: store, save, notify, isRunning, now.
// Routes are served at /features/breaks/<route>. See ../README.md for the full feature contract.
import { createBreaks } from './breaks.js';

const AGENT_NAMES = { 'claude-code': 'Claude', codex: 'Codex' };

export default {
  setup(ctx) {
    const breaks = createBreaks({
      store: ctx.store,
      save: ctx.save,
      notify: ctx.notify,
      isRunning: ctx.isRunning,
      now: ctx.now,
    });

    // Every break is XP toward the player's story; hitting the daily goal is a bonus.
    const take = (kind) => {
      const before = breaks.state();
      const after = breaks.take(kind);
      ctx.award?.(8, 'break');
      if (before.total < before.goal && after.total >= after.goal) ctx.award?.(20, 'break-goal');
      return after;
    };

    return {
      routes: {
        'GET state': () => breaks.state(),
        'POST take': (body) => take(body.kind),
        'POST eyes': () => take('eyes'), // the tray item calls this one
        'POST undo': () => breaks.undo(),
        'PUT settings': (body) => breaks.configure(body),
        'GET history': (_body, query) => breaks.history(Number(query.days) || 14),
      },
      tick: () => breaks.tick(),
      onEvent: (e) => {
        if (e.type === 'started') breaks.onRunStart(e.session, e.name || AGENT_NAMES[e.source]);
      },
    };
  },
};
