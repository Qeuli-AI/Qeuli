// The glass: water rises as you drink. Same language as the tide, drawn as a vessel.
// Logging a drink sends a splash through the surface, a ripple ring and a few bubbles.
// Reaching the goal turns the water to the "done" colour.

const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

function rgba(hex, a) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export function createGlass(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let colors = {};
  let target = 0; // fill fraction 0..1
  let level = 0;
  let reached = false;
  let splash = 0; // extra wave height, decays
  let ripples = []; // { t0 }
  let bubbles = []; // { x, y, r, vy, drift }
  let raf = 0;
  const t0 = performance.now();
  let last = t0;

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['muted', 'run', 'ok', 'line', 'fg']) colors[k] = cs.getPropertyValue(`--${k}`).trim();
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

  // Glass outline: slightly narrower at the base, rounded bottom corners.
  function glassPath() {
    const topW = Math.min(w * 0.7, 150);
    const botW = topW * 0.74;
    const cx = w * 0.46;
    const top = 14;
    const bot = h - 14;
    const r = 16;
    const p = new Path2D();
    p.moveTo(cx - topW / 2, top);
    p.lineTo(cx - botW / 2, bot - r);
    p.quadraticCurveTo(cx - botW / 2, bot, cx - botW / 2 + r, bot);
    p.lineTo(cx + botW / 2 - r, bot);
    p.quadraticCurveTo(cx + botW / 2, bot, cx + botW / 2, bot - r);
    p.lineTo(cx + topW / 2, top);
    return { path: p, cx, top, bot, topW, botW };
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    const g = glassPath();
    const color = reached ? colors.ok : colors.run;
    const surfaceY = g.bot - level * (g.bot - g.top - 6);

    // water, clipped to the inside of the glass
    ctx.save();
    const clip = new Path2D(g.path);
    clip.closePath();
    ctx.clip(clip);
    [
      { k: 1, phase: 0, alpha: 0.5 },
      { k: 1.7, phase: 2, alpha: 0.3 },
    ].forEach((L, i) => {
      const amp = (level > 0.01 ? 3.2 + splash * 9 : 0) * (i ? 0.6 : 1);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = surfaceY + Math.sin(x * 0.05 * L.k + t * (1.4 + i * 0.5) + L.phase) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = rgba(color, L.alpha);
      ctx.fill();
    });

    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(colors.fg, 0.55 * Math.min(1, (b.y - surfaceY) / 20));
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    // graduation marks at 25 / 50 / 75 / 100 %
    ctx.strokeStyle = rgba(colors.muted, 0.7);
    ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const y = Math.round(g.bot - f * (g.bot - g.top - 6)) + 0.5;
      const half = (g.botW + (g.topW - g.botW) * f) / 2;
      ctx.beginPath();
      ctx.moveTo(g.cx + half + 8, y);
      ctx.lineTo(g.cx + half + (f === 1 ? 26 : 18), y);
      ctx.stroke();
    }

    // glass outline on top
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke(g.path);

    // ripple rings on the surface
    for (const r of ripples) {
      const p = (now - r.t0) / 900;
      if (p > 1) continue;
      ctx.beginPath();
      ctx.ellipse(g.cx, surfaceY, 10 + p * 46, 3 + p * 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 1 - p);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    level = lerp(level, target, 1 - Math.exp(-dt / 450));
    splash *= Math.exp(-dt / 500);
    const g = glassPath();
    const surfaceY = g.bot - level * (g.bot - g.top - 6);
    for (const b of bubbles) {
      b.y -= b.vy * (dt / 16);
      b.x += Math.sin(b.y * 0.08) * b.drift;
    }
    bubbles = bubbles.filter((b) => b.y > surfaceY + 2);
    ripples = ripples.filter((r) => now - r.t0 < 900);
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reduced()) {
      level = target;
      bubbles = [];
      ripples = [];
      draw(performance.now());
    } else {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  new ResizeObserver(resize).observe(canvas);
  readColors();
  resize();
  start();

  return {
    set(fraction, isReached) {
      target = Math.max(0, Math.min(1, fraction));
      reached = isReached;
      start();
    },
    burst() {
      if (reduced()) return;
      const g = glassPath();
      splash = 1;
      ripples.push({ t0: performance.now() });
      for (let i = 0; i < 12; i++) {
        bubbles.push({
          x: g.cx + (Math.random() - 0.5) * g.botW * 0.7,
          y: g.bot - 10 - Math.random() * 14,
          r: 1.5 + Math.random() * 3,
          vy: 0.9 + Math.random() * 1.4,
          drift: (Math.random() - 0.5) * 0.5,
        });
      }
    },
    refresh() {
      readColors();
      start();
    },
  };
}
