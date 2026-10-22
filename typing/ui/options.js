// The options each typing game offers. Pure data, so it can be tested (see gameopts.js for the shape).
export const OPTIONS = {
  sprint: [
    { id: 'time', label: 'Time', def: '30', choices: [['15', '15 s'], ['30', '30 s'], ['60', '60 s'], ['120', '2 min']] },
    { id: 'words', label: 'Words', def: 'dev', choices: [['dev', 'Mixed'], ['short', 'Short'], ['long', 'Long']] },
  ],
  passage: [
    { id: 'length', label: 'Length', def: 'medium', choices: [['short', 'Short, ~50 words'], ['medium', 'Medium, ~100'], ['long', 'Long, ~200']] },
    { id: 'text', label: 'Text', def: 'prose', choices: [['prose', 'Prose'], ['code', 'Code']] },
  ],
};
