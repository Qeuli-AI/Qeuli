// Desk workouts: backend entry. The guided session runs in the app window; the daemon keeps the log.
// Routes are served at /features/move/<route>.
import { createMove } from './move.js';

export default {
  setup(ctx) {
    const move = createMove({ store: ctx.store, save: ctx.save, now: ctx.now });
    return {
      routes: {
        'GET state': () => move.state(),
        'POST done': (body) => {
          const before = move.state();
          const after = move.done(body.routine);
          ctx.award?.(15, 'move');
          if (before.todayMin < before.goalMin && after.todayMin >= after.goalMin) ctx.award?.(15, 'move-goal');
          return after;
        },
        'POST undo': () => move.undo(),
        'PUT settings': (body) => move.configure(body),
        'GET history': (_body, query) => move.history(Number(query.days) || 7),
      },
    };
  },
};
