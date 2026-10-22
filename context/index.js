// Context: backend entry. It listens to agent events and keeps a privacy-safe account of each run.
// Routes are served at /features/context/<route>. See ../README.md for the full feature contract.
import { createContext } from './context.js';

export default {
  setup(ctx) {
    const context = createContext({ store: ctx.store, save: ctx.save, now: ctx.now });
    return {
      routes: {
        'GET state': () => context.state(),
        'POST clear': () => context.clear(),
      },
      onEvent: (e) => context.onEvent(e),
    };
  },
};
