// Soundscapes made live with Web Audio: filtered noise, slow oscillators and a little randomness.
// No audio files, nothing downloaded. Each scape returns { stop() } and owns its own gain bus,
// so switching scapes crossfades and the master gain is purely the volume control.

export const SCAPE_INFO = {
  tide: { name: 'Tide', desc: 'Slow waves rolling in and out.' },
  rain: { name: 'Rain', desc: 'Steady rain on a window.' },
  focus: { name: 'Focus', desc: 'A soft, steady drone to hide behind.' },
  lofi: { name: 'Lo-fi', desc: 'Slow, warm chords with a little crackle.' },
  night: { name: 'Night garden', desc: 'Crickets and a low breeze.' },
};

const MASTER_SCALE = 0.6; // headroom, so volume 1 is loud but not harsh

export function createEngine() {
  let ac = null;
  let master = null;
  let analyser = null;
  let current = null; // { id, bus, scape }
  let volume = 0.5;
  const noiseCache = {};

  function ensure() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = volume * MASTER_SCALE;
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
    analyser.connect(ac.destination);
    return ac;
  }

  /** A looping buffer of white, pink or brown noise. */
  function noise(type) {
    if (!noiseCache[type]) {
      const len = ac.sampleRate * 4;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'brown') {
          last = (last + 0.02 * white) / 1.02;
          d[i] = last * 3.5;
        } else if (type === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759; b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856; b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        } else {
          d[i] = white;
        }
      }
      noiseCache[type] = buf;
    }
    const src = ac.createBufferSource();
    src.buffer = noiseCache[type];
    src.loop = true;
    return src;
  }

  const filter = (type, freq, q = 0.7) => {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v) => {
    const g = ac.createGain();
    g.gain.value = v;
    return g;
  };
  const osc = (type, freq) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  };
  /** Wobble an AudioParam around its current value with a slow sine. */
  const lfo = (param, rate, depth, nodes) => {
    const o = osc('sine', rate);
    const g = gain(depth);
    o.connect(g).connect(param);
    o.start();
    nodes.push(o);
  };

  const SCAPES = {
    tide(out) {
      const nodes = [];
      const src = noise('brown');
      const lp = filter('lowpass', 700);
      const g = gain(0.7);
      src.connect(lp).connect(g).connect(out);
      lfo(lp.frequency, 0.09, 450, nodes);
      lfo(g.gain, 0.063, 0.3, nodes);
      src.start();
      nodes.push(src);
      return { stop: () => nodes.forEach((n) => n.stop()) };
    },

    rain(out) {
      const nodes = [];
      const src = noise('pink');
      src.connect(filter('highpass', 400)).connect(filter('lowpass', 7000)).connect(gain(0.55)).connect(out);
      src.start();
      nodes.push(src);
      let timer;
      let alive = true;
      const drop = () => {
        if (!alive) return;
        const t = ac.currentTime;
        const o = osc('sine', 1800 + Math.random() * 2500);
        const g = gain(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.1);
        timer = setTimeout(drop, 40 + Math.random() * 260);
      };
      drop();
      return { stop: () => { alive = false; clearTimeout(timer); nodes.forEach((n) => n.stop()); } };
    },

    focus(out) {
      const nodes = [];
      const bus = gain(0.12);
      [110, 164.81, 220.4].forEach((f) => {
        const o = osc('sine', f);
        o.connect(gain(0.5)).connect(bus);
        o.start();
        nodes.push(o);
      });
      lfo(bus.gain, 0.12, 0.04, nodes);
      bus.connect(out);
      const hiss = noise('pink');
      hiss.connect(filter('highpass', 2000)).connect(filter('lowpass', 5000)).connect(gain(0.02)).connect(out);
      hiss.start();
      nodes.push(hiss);
      return { stop: () => nodes.forEach((n) => n.stop()) };
    },

    lofi(out) {
      const nodes = [];
      const chords = [[110, 130.81, 164.81, 196], [87.31, 110, 130.81, 164.81], [130.81, 164.81, 196, 246.94], [98, 123.47, 146.83, 164.81]];
      const warm = filter('lowpass', 1100);
      warm.connect(out);
      let i = 0;
      let timer;
      let alive = true;
      const chord = () => {
        if (!alive) return;
        const t = ac.currentTime;
        for (const f of chords[i++ % chords.length]) {
          const o = osc('triangle', f);
          const g = gain(0);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.09, t + 0.8);
          g.gain.linearRampToValueAtTime(0, t + 4.6);
          o.connect(g).connect(warm);
          o.start(t);
          o.stop(t + 4.8);
        }
        timer = setTimeout(chord, 4000);
      };
      chord();
      // a little vinyl: constant hiss plus the odd pop
      const hiss = noise('white');
      const pops = gain(0);
      hiss.connect(filter('highpass', 3000)).connect(gain(0.006)).connect(out);
      hiss.connect(filter('highpass', 2500)).connect(pops).connect(out);
      hiss.start();
      nodes.push(hiss);
      let popTimer;
      const pop = () => {
        if (!alive) return;
        const t = ac.currentTime;
        pops.gain.setValueAtTime(0.05, t);
        pops.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        popTimer = setTimeout(pop, 200 + Math.random() * 1400);
      };
      pop();
      return { stop: () => { alive = false; clearTimeout(timer); clearTimeout(popTimer); nodes.forEach((n) => n.stop()); } };
    },

    night(out) {
      const nodes = [];
      [4300, 4700].forEach((f, k) => {
        const carrier = osc('sine', f);
        const am = gain(0);
        const gate = gain(0.5);
        carrier.connect(am).connect(gate).connect(out);
        const fast = osc('sine', 23 + k * 3);
        fast.connect(gain(0.012)).connect(am.gain);
        const slow = osc('sine', 0.35 + k * 0.11);
        slow.connect(gain(0.5)).connect(gate.gain);
        [carrier, fast, slow].forEach((n) => { n.start(); nodes.push(n); });
      });
      const breeze = noise('brown');
      breeze.connect(filter('lowpass', 420)).connect(gain(0.22)).connect(out);
      breeze.start();
      nodes.push(breeze);
      return { stop: () => nodes.forEach((n) => n.stop()) };
    },
  };

  function endCurrent(seconds) {
    if (!current) return;
    const old = current;
    current = null;
    const t = ac.currentTime;
    old.bus.gain.cancelScheduledValues(t);
    old.bus.gain.setValueAtTime(old.bus.gain.value, t);
    old.bus.gain.linearRampToValueAtTime(0, t + seconds);
    setTimeout(() => {
      try {
        old.scape.stop();
      } catch {}
      old.bus.disconnect();
    }, seconds * 1000 + 120);
  }

  return {
    /** Allow sound. Browsers only permit this inside a click or key press. */
    async unlock() {
      ensure();
      try {
        await ac.resume();
      } catch {}
      return ac.state === 'running';
    },
    /** Start a scape, crossfading from the current one. Returns false if the browser still blocks sound. */
    async play(id, { fade = 1.5 } = {}) {
      if (!SCAPES[id]) return false;
      ensure();
      try {
        await ac.resume();
      } catch {}
      if (ac.state !== 'running') return false;
      endCurrent(0.8);
      const bus = gain(0);
      bus.connect(master);
      const scape = SCAPES[id](bus);
      const t = ac.currentTime;
      bus.gain.setValueAtTime(0, t);
      bus.gain.linearRampToValueAtTime(1, t + fade);
      current = { id, bus, scape };
      return true;
    },
    stop(fade = 1.5) {
      if (ac) endCurrent(fade);
    },
    setVolume(v) {
      volume = v;
      if (master) master.gain.setTargetAtTime(v * MASTER_SCALE, ac.currentTime, 0.05);
    },
    get playing() {
      return Boolean(current);
    },
    get currentId() {
      return current?.id ?? null;
    },
    get analyser() {
      return analyser;
    },
    get running() {
      return Boolean(ac && ac.state === 'running');
    },
  };
}
