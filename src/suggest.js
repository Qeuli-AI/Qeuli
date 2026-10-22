const BREAKS = [
  { minutes: 1, title: 'Look 20 feet away for 20 seconds' },
  { minutes: 1, title: 'Drink some water' },
  { minutes: 2, title: 'Stand up and stretch your neck and shoulders' },
  { minutes: 2, title: 'Take five slow breaths' },
  { minutes: 5, title: 'Walk to the window or around the room' },
];

/** Pick something that fits a wait of `minutes`: a queued read first, otherwise a break. */
export function suggest(queue, minutes) {
  const fits = queue
    .filter((q) => !q.done && q.minutes <= minutes)
    .sort((a, b) => b.minutes - a.minutes)[0];
  if (fits) return { kind: 'read', ...fits };

  const options = BREAKS.filter((b) => b.minutes <= minutes);
  const pick = options[Math.floor(Math.random() * options.length)] || BREAKS[0];
  return { kind: 'break', ...pick };
}
