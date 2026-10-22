// The options each retro game offers. Pure data, so it can be tested (see gameopts.js for the shape).
export const OPTIONS = {
  snake: [
    { id: 'size', label: 'Board', def: '20', choices: [['14', 'Small'], ['20', 'Medium'], ['26', 'Large']] },
    { id: 'speed', label: 'Speed', def: 'normal', choices: [['chill', 'Chill'], ['normal', 'Normal'], ['fast', 'Fast']] },
    { id: 'walls', label: 'Walls', def: 'solid', choices: [['solid', 'Solid'], ['wrap', 'Wrap around']] },
    { id: 'rocks', label: 'Rocks', def: 'none', choices: [['none', 'None'], ['few', 'A few'], ['many', 'Lots']] },
    { id: 'skin', label: 'Skin', def: 'sun', cosmetic: true, choices: [['sun', 'Sun'], ['mint', 'Mint'], ['ink', 'Ink']] },
  ],
  g2048: [
    { id: 'size', label: 'Grid', def: '4', choices: [['3', '3 × 3'], ['4', '4 × 4'], ['5', '5 × 5']] },
    { id: 'palette', label: 'Tiles', def: 'candy', cosmetic: true, choices: [['candy', 'Candy'], ['mono', 'Mono'], ['sunset', 'Sunset']] },
  ],
};
