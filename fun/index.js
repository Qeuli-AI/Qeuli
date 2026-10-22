// Small delights: backend entry. The jokes, riddles and oracle live in the UI; the daemon only tracks
// the riddle streak and awards XP. Routes are served at /features/fun/<route>.
import { createFun } from './fun.js';

export default {
  setup(ctx) {
    const fun = createFun({ store: ctx.store, save: ctx.save, now: ctx.now });
    return {
      routes: {
        'GET state': () => fun.state(),
        'POST solve': () => {
          const r = fun.solve();
          if (r.first) ctx.award?.(10, 'riddle');
          return r;
        },
      },
    };
  },
};
