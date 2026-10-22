// The routines: plain data, shared by the daemon (for the totals) and the app window (to guide you).
// Every move is something you can do beside a desk in normal clothes, with no equipment.
// Easy on joints by design: nothing here needs to hurt to count. Stop if something does.

const rest = (seconds = 10) => ({ name: 'Rest', seconds, cue: 'Shake it out. Breathe.' });

export const ROUTINES = [
  {
    id: 'desk-reset',
    name: 'Desk reset',
    blurb: 'Wake the legs and loosen the neck. Three minutes.',
    steps: [
      { name: 'Chair squats', seconds: 30, cue: 'Stand from the chair, sit back down slowly. Knees over toes.' },
      { name: 'Desk push-ups', seconds: 30, cue: 'Hands on the desk edge, body straight, chest to the desk.' },
      { name: 'Calf raises', seconds: 30, cue: 'Rise onto your toes, hold for a beat, lower slowly.' },
      { name: 'Hip circles', seconds: 20, cue: 'Hands on hips, draw big slow circles. Switch direction halfway.' },
      { name: 'Shoulder rolls', seconds: 20, cue: 'Roll back, then forward. Let the shoulders drop.' },
      { name: 'Neck release', seconds: 20, cue: 'Ear toward shoulder, breathe. Switch sides halfway.' },
      { name: 'Forward fold', seconds: 30, cue: 'Hinge at the hips, let your arms hang. Soft knees.' },
    ],
  },
  {
    id: 'wrists',
    name: 'Wrists and forearms',
    blurb: 'For everyone who types for a living. Two minutes.',
    steps: [
      { name: 'Wrist circles', seconds: 20, cue: 'Make slow circles with both wrists, then reverse.' },
      { name: 'Prayer stretch', seconds: 20, cue: 'Palms together at your chest, lower the hands until you feel a stretch.' },
      { name: 'Reverse prayer', seconds: 20, cue: 'Backs of the hands together, fingers pointing down. Gentle.' },
      { name: 'Finger spreads', seconds: 20, cue: 'Spread the fingers wide, then make a loose fist. Repeat.' },
      { name: 'Forearm stretch, right', seconds: 20, cue: 'Right arm straight, palm up, left hand eases the fingers back.' },
      { name: 'Forearm stretch, left', seconds: 20, cue: 'Same on the other side.' },
    ],
  },
  {
    id: 'wake-up',
    name: 'Wake-up',
    blurb: 'Get the blood moving after a long sit. Five minutes.',
    steps: [
      { name: 'Jumping jacks', seconds: 40, cue: 'Or step-jacks if you prefer quiet feet.' },
      rest(),
      { name: 'High knees', seconds: 40, cue: 'March fast, knees up, swing the arms.' },
      rest(),
      { name: 'Squats', seconds: 40, cue: 'Sit back like there is a chair behind you. Chest up.' },
      rest(),
      { name: 'Alternating lunges', seconds: 40, cue: 'Step back, lower, push through the front heel.' },
      rest(),
      { name: 'Plank', seconds: 40, cue: 'Forearms down, body in one line. On your knees is fine.' },
      rest(),
      { name: 'Full-body stretch', seconds: 40, cue: 'Reach up, then to each side, then fold forward.' },
      { name: 'Breathe', seconds: 10, cue: 'Slow breath in, slow breath out. Well done.' },
    ],
  },
  {
    id: 'back-reset',
    name: 'Back reset',
    blurb: 'Undo the hunch. Four minutes.',
    steps: [
      { name: 'Seated cat-cow', seconds: 40, cue: 'Hands on knees: arch the back and lift the chest, then round and tuck the chin.' },
      { name: 'Seated twist, left', seconds: 30, cue: 'Turn gently to the left, hold the chair back. Breathe tall.' },
      { name: 'Seated twist, right', seconds: 30, cue: 'Same on the other side.' },
      { name: 'Chest opener', seconds: 40, cue: 'Clasp hands behind you, lift them slightly, open the chest.' },
      { name: 'Hip flexor stretch, left', seconds: 30, cue: 'Standing lunge position, tuck the pelvis, feel the front of the hip.' },
      { name: 'Hip flexor stretch, right', seconds: 30, cue: 'Same on the other side.' },
      { name: 'Hamstring stretch', seconds: 40, cue: 'Heel forward, hinge at the hips with a long back. No bouncing.' },
    ],
  },
];

export const totalSeconds = (routine) => routine.steps.reduce((n, s) => n + s.seconds, 0);

/** Routines with their total length in whole minutes, for listing. */
export const routineList = () => ROUTINES.map((r) => ({ id: r.id, name: r.name, blurb: r.blurb, seconds: totalSeconds(r), steps: r.steps }));
