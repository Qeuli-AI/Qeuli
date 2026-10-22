// The tide: a waterline across the window.
//   quiet    -> nearly flat, muted
//   running  -> slow swell, the water rises with progress
//   waiting  -> flat dashed line with a ring pulsing on it (it needs you)
//   settled  -> a calm swell in the "done" colour, for a few seconds after a run ends

const STATES = {
  quiet: { amp: 2.5, level: 0.14, speed: 0.12, color: 'muted', fill: 0.05 },
  running: { amp: 15, level: 0.5, speed: 0.55, color: 'run', fill: 0.16 },
  waiting: { amp: 0, level: 0.46, speed: 0, color: 'wait', fill: 0.07 },
  settled: { amp: 6, level: 0.3, speed: 0.25, color: 'ok', fill: 0.12 },
};

const LAYERS = [
  { k: 1.0, phase: 0, alpha: 1 },
  { k: 0.65, phase: 2.1, alpha: 0.55 },
  { k: 0.4, phase: 4.2, alpha: 0.3 },
];

const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

function rgba(hex, a) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export function createTide(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let target = { ...STATES.quiet };
  let cur = { ...STATES.quiet };
  let colors = {};
  let waiting = false;
  let raf = 0;
  let t0 = performance.now();

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['muted', 'run', 'wait', 'ok', 'line', 'bg']) colors[k] = cs.getPropertyValue(`--${k}`).trim();
  };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  };

  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    const color = colors[cur.color] || colors.muted;
    const base = h - cur.level * h;

    // faint reference rules, like a gauge
    ctx.strokeStyle = rgba(colors.line || '#888888', 0.9);
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = Math.round((h / 5) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    LAYERS.forEach((L, i) => {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = base + Math.sin(x * 0.011 * L.k + t * cur.speed * (1 + i * 0.4) + L.phase) * cur.amp * L.k + i * 3;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      if (i === 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(waiting ? [3, 7] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = rgba(color, cur.fill * L.alpha);
      ctx.fill();
    });

    if (waiting) {
      // ring pulsing on the line, one cycle every 2.4s
      const p = (t % 2.4) / 2.4;
      const x = w * 0.72;
      ctx.beginPath();
      ctx.arc(x, base, 5 + p * 34, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 1 - p);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, base, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  let last = performance.now();
  function frame(now) {
    // Ease toward the target at a rate independent of frame rate (~63% of the way per 0.7s).
    // Colour switches immediately.
    const k = 1 - Math.exp(-Math.min(now - last, 200) / 700);
    last = now;
    for (const key of ['amp', 'level', 'speed', 'fill']) cur[key] = lerp(cur[key], target[key], k);
    cur.color = target.color;
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reduced()) {
      cur = { ...target };
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }
  }

  new ResizeObserver(resize).observe(canvas);
  readColors();
  resize();
  start();

  return {
    set(state, pct = null) {
      target = { ...STATES[state] };
      waiting = state === 'waiting';
      // With reported progress the water rises from 20% to 80% of the band.
      if (state === 'running' && pct != null) target.level = 0.2 + 0.6 * (pct / 100);
      start();
    },
    refresh() {
      readColors();
      start();
    },
  };
}
