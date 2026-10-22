// Parking lot: backend entry. Routes are served at /features/parking/<route>.
// See ../README.md for the full feature contract.
import { createParking } from './parking.js';

export default {
  setup(ctx) {
    const parking = createParking({ store: ctx.store, save: ctx.save, now: ctx.now });
    return {
      routes: {
        'GET state': () => parking.state(),
        'POST add': (body) => {
          const s = parking.add(body.text, body.kind);
          ctx.award?.(2, 'parking'); // capturing a thought is a good habit
          return s;
        },
        'POST toggle': (body) => parking.toggle(body.id),
        'POST remove': (body) => parking.remove(body.id),
        'POST clear-done': () => parking.clearDone(),
      },
    };
  },
};
