// The words behind the fun: jokes, riddles and the hawk's answers. Plain data and two small helpers,
// with no DOM, so they can be tested.

export const JOKES = [
  "There are only 10 kinds of people: those who understand binary and those who don't.",
  'A SQL query walks into a bar, walks up to two tables and asks: can I join you?',
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I would tell you a UDP joke, but you might not get it.',
  'To understand recursion, you must first understand recursion.',
  "How many programmers does it take to change a light bulb? None. That's a hardware problem.",
  'Debugging is being the detective in a crime movie where you are also the murderer.',
  'The best thing about a boolean is that even if you are wrong, you are only off by a bit.',
  'A programmer is told: go to the store and get a gallon of milk, and if they have eggs, get a dozen. He comes back with 12 gallons of milk.',
  "!false. It's funny because it's true.",
  "Why was the JavaScript developer sad? He didn't Node how to Express himself.",
  "There's no place like 127.0.0.1.",
  'I had a problem, so I used a regex. Now I have two problems.',
  'Why did the developer go broke? He used up all his cache.',
  'A byte walks into a bar looking miserable. The bartender asks what is wrong. "Parity error," says the byte. "Ah, I thought you looked a bit off."',
  'How do you comfort a JavaScript bug? You console it.',
  "Why do Java developers wear glasses? Because they don't C#.",
  'My agent says it is "almost done". Same as me, eight hours ago.',
  'The cloud is just someone else\'s computer with a worse keyboard.',
  'git commit -m "final". git commit -m "final2". git commit -m "final-REAL".',
  "Real programmers don't comment their code. It was hard to write, so it should be hard to read.",
  'I would like to thank my rubber duck for being a great listener and never once asking for a raise.',
  'A programmer puts two glasses on his bedside table before sleep: one full in case he gets thirsty, one empty in case he does not.',
  'It works on my machine. Then we shall ship your machine.',
  'Programming is 10% writing code and 90% understanding why it does not work.',
  'The two hardest problems in computer science: naming things, cache invalidation, and off-by-one errors.',
];

// `answers` are lowercase letters and digits only; a guess matches if it contains any of them.
export const RIDDLES = [
  { q: "What has keys but can't open locks?", answers: ['keyboard', 'piano'] },
  { q: 'What gets wetter the more it dries?', answers: ['towel'] },
  { q: 'I speak without a mouth and hear without ears. What am I?', answers: ['echo'] },
  { q: 'What can you catch but not throw?', answers: ['cold'] },
  { q: 'The more of me there is, the less you see. What am I?', answers: ['darkness', 'dark', 'fog'] },
  { q: 'What has a head and a tail but no body?', answers: ['coin'] },
  { q: 'What goes up but never comes down?', answers: ['age'] },
  { q: 'What has hands but cannot clap?', answers: ['clock', 'watch'] },
  { q: 'What runs but never walks?', answers: ['water', 'river', 'tap', 'stream'] },
  { q: 'What can travel around the world while staying in a corner?', answers: ['stamp'] },
  { q: 'What has many teeth but cannot bite?', answers: ['comb', 'zip', 'saw', 'gear'] },
  { q: 'What building has the most stories?', answers: ['library'] },
  { q: 'What is full of holes but still holds water?', answers: ['sponge'] },
  { q: 'What belongs to you but is used more by others?', answers: ['name'] },
  { q: 'I have cities but no houses, mountains but no trees, and water but no fish. What am I?', answers: ['map'] },
  { q: 'What gets bigger the more you take away from it?', answers: ['hole'] },
  { q: 'What has one eye but cannot see?', answers: ['needle', 'storm', 'hurricane'] },
  { q: 'What comes once in a minute, twice in a moment, but never in a thousand years?', answers: ['m', 'letterm', 'theletterm'] },
  { q: 'What word becomes shorter when you add two letters to it?', answers: ['short'] },
  { q: 'What is always coming but never arrives?', answers: ['tomorrow'] },
  { q: 'What has a neck but no head?', answers: ['bottle', 'shirt'] },
  { q: 'What can fill a room but takes up no space?', answers: ['light', 'air', 'sound'] },
  { q: 'What has words but never speaks?', answers: ['book'] },
  { q: 'What invention lets you look right through a wall?', answers: ['window'] },
];

export const ORACLE = [
  'Ship it.',
  'Not yet. Write the test first.',
  'Ask again after your next glass of water.',
  'The signs say refactor, but gently.',
  'Yes. Tell nobody until it works.',
  'Do the boring thing first.',
  'Take a walk. The answer will meet you there.',
  'Probably. Check the logs.',
  'No, but your second idea is better.',
  'The hawk sees a race condition.',
  'Commit now. Thank yourself later.',
  'Delete it. Not feeling brave? Comment it out. Then delete it.',
  'Sleep on it. Literally.',
  'Stretch first. Then decide.',
  'It is already in the cache. Look there.',
  'Rename the variable. That is the whole bug.',
];

/** Which riddle belongs to a given local date, the same for the whole day. */
export function riddleForDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return RIDDLES[((dayNumber % RIDDLES.length) + RIDDLES.length) % RIDDLES.length];
}

/** Loose answer check: ignore case, spaces and punctuation, and accept a leading "a", "an" or "the". */
export function isCorrect(riddle, guess) {
  const g = String(guess).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!g) return false;
  return riddle.answers.some((a) => g === a || g === `a${a}` || g === `an${a}` || g === `the${a}` || (a.length > 3 && g.includes(a)));
}

/** A shuffled sequence that never repeats until every item has been seen. */
export function deck(list, rand = Math.random) {
  let order = [];
  let last = -1;
  return () => {
    if (!order.length) {
      order = list.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (order[order.length - 1] === last && order.length > 1) order.unshift(order.pop()); // do not repeat across the reshuffle
    }
    last = order.pop();
    return list[last];
  };
}
