// Waiting report: backend entry. Read-only: it turns the core's per-day wait stats into a report.
// Routes are served at /features/report/<route>.
import { report, insight } from './report.js';

export default {
  setup(ctx) {
    return {
      routes: {
        'GET state': (_body, query) => {
          const n = Math.min(90, Math.max(14, Number(query.days) || 14));
          const r = report(ctx.waitHistory(n));
          return { ...r, insight: insight(r) };
        },
      },
    };
  },
};
