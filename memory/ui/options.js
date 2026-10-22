// The options each memory game offers. Pure data, so it can be tested (see gameopts.js for the shape).
export const OPTIONS = {
  match: [
    { id: 'pairs', label: 'Pairs', def: '8', choices: [['6', '6 pairs'], ['8', '8 pairs']] },
    { id: 'flip', label: 'Flip back', def: 'slow', choices: [['slow', 'Slow'], ['fast', 'Fast']] },
    { id: 'peek', label: 'Peek', def: 'off', choices: [['off', 'Off'], ['on', 'Show all first']] },
  ],
  chimp: [
    { id: 'start', label: 'Start at', def: '4', choices: [['4', '4 numbers'], ['6', '6 numbers'], ['8', '8 numbers']] },
    { id: 'strikes', label: 'Strikes', def: '3', choices: [['1', '1 strike'], ['3', '3 strikes'], ['5', '5 strikes']] },
    { id: 'grid', label: 'Board', def: 'classic', choices: [['classic', 'Classic 8 × 5'], ['tight', 'Tight 6 × 4']] },
  ],
  sequence: [
    { id: 'grid', label: 'Board', def: '3', choices: [['3', '3 × 3'], ['4', '4 × 4']] },
    { id: 'speed', label: 'Speed', def: 'normal', choices: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
    { id: 'sound', label: 'Sound', def: 'off', cosmetic: true, choices: [['off', 'Off'], ['on', 'On']] },
  ],
};
