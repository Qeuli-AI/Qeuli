// Soundscapes: backend entry. The sound itself is made in the app window (Web Audio); the daemon only
// remembers your choices. Routes are served at /features/music/<route>.
import { createMusic } from './music.js';

export default {
  setup(ctx) {
    const music = createMusic({ store: ctx.store, save: ctx.save });
    return {
      routes: {
        'GET state': () => music.state(),
        'PUT settings': (body) => music.configure(body),
      },
    };
  },
};
