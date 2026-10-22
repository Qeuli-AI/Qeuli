// Feed: backend entry. Routes are served at /features/feed/<route>.
// Handlers here are async because they talk to the network; the daemon awaits them.
import { createFeed } from './feed.js';

export default {
  setup(ctx) {
    const feed = createFeed();
    return {
      routes: {
        'GET stories': (_body, query) => feed.stories(query.list || 'top', { refresh: query.refresh === '1' }),
        // Only stories we listed ourselves can be saved, so a URL from outside is never queued.
        'POST save': (body) => {
          const story = feed.find(body.id);
          if (!story) throw Object.assign(new Error('story not found, refresh the feed'), { status: 404 });
          const item = ctx.queueAdd?.({ url: story.url, title: story.title, minutes: story.minutes });
          ctx.award?.(2, 'read-later');
          return { queued: item };
        },
      },
    };
  },
};
