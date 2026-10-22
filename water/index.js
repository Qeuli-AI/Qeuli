// Water: backend entry. The core calls setup() once and then only uses what it returns.
//   ctx.store         this feature's own persisted record (saved with ctx.save())
//   ctx.notify        desktop notification
//   ctx.waitMsToday   agent wait time so far today, including a run in progress
//   ctx.isRunning     is this agent session still running
//   ctx.now           the clock (injected so tests can drive time)
// Routes are served at /features/water/<route>. See ../README.md for the full feature contract.
import { createWater } from './water.js';

const AGENT_NAMES = { 'claude-code': 'Claude', codex: 'Codex' };

export default {
  setup(ctx) {
    const water = createWater({
      store: ctx.store,
      save: ctx.save,
      notify: ctx.notify,
      waitMsToday: ctx.waitMsToday,
      isRunning: ctx.isRunning,
      now: ctx.now,
    });

    return {
      routes: {
        'GET state': () => water.state(),
        'POST drink': (body) => {
          const before = water.state();
          const after = water.drink(body.ml, body.vessel);
          ctx.award?.(4, 'water');
          if (before.drunkMl < before.goalMl && after.drunkMl >= after.goalMl) ctx.award?.(20, 'water-goal');
          return after;
        },
        'POST undo': () => water.undo(),
        'PUT settings': (body) => water.configure(body),
        'GET history': (_body, query) => water.history(Number(query.days) || 30),
      },
      tick: () => water.tick(),
      onEvent: (e) => {
        if (e.type === 'started') water.onRunStart(e.session, e.name || AGENT_NAMES[e.source]);
      },
    };
  },
};
