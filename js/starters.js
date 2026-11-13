// Starters: backgrounds painted in code, each with a few layers to begin from.
import { seeded } from './render.js';

function sunburst(ctx, w, h, a, b, rays = 24) {
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2; const cy = h * 0.55; const r = Math.hypot(w, h);
  ctx.fillStyle = b;
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2; const a1 = ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function stars(ctx, w, h, count, rand) {
  for (let i = 0; i < count; i++) {
    const s = rand() * rand() * 2.6 * (w / 1080) + 0.4;
    ctx.globalAlpha = 0.4 + rand() * 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function blob(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const T = (text, o = {}) => ({ type: 'text', text, ...o });
const S = (emoji, o = {}) => ({ type: 'sticker', emoji, ...o });

export const STARTERS = [
  {
    id: 'sunburst', label: 'Sunburst', w: 1080, h: 1080, layout: 'classic', captions: true,
    paint(ctx, w, h) { sunburst(ctx, w, h, '#ffc93c', '#ffb020'); },
    layers: [S('😎', { x: 0.5, y: 0.55, size: 0.42, effect: 'shadow' })],
  },
  {
    id: 'galaxy', label: 'Galaxy brain', w: 1080, h: 1080, layout: 'classic', captions: true,
    paint(ctx, w, h) {
      const rand = seeded(7);
      ctx.fillStyle = '#07060d';
      ctx.fillRect(0, 0, w, h);
      blob(ctx, w * 0.3, h * 0.4, w * 0.55, 'rgba(171,143,255,.55)');
      blob(ctx, w * 0.75, h * 0.65, w * 0.5, 'rgba(255,126,182,.45)');
      blob(ctx, w * 0.6, h * 0.2, w * 0.35, 'rgba(53,214,200,.35)');
      stars(ctx, w, h, 420, rand);
    },
    layers: [S('🧠', { x: 0.5, y: 0.52, size: 0.36, effect: 'shadow' }), S('✨', { x: 0.73, y: 0.36, size: 0.12, rot: 15 }), S('✨', { x: 0.28, y: 0.66, size: 0.09, rot: -20 })],
  },
  {
    id: 'textpost', label: 'Text post', w: 1080, h: 760, layout: 'free',
    paint(ctx, w, h) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); },
    layers: [
      T('nobody:\n\nabsolutely nobody:\n\nme at 2am:', { x: 0.5, y: 0.08, anchor: 'top', w: 0.88, size: 0.056, font: 'plain', fill: '#000000', strokeW: 0, caps: false, align: 'left', lineHeight: 1.2 }),
      S('🕺', { x: 0.62, y: 0.79, size: 0.2 }),
    ],
  },
  {
    id: 'news', label: 'Breaking', w: 1600, h: 900, layout: 'free',
    paint(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0b1d4d'); g.addColorStop(1, '#1f5fd6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 2;
      for (let x = -h; x < w; x += 70) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke(); }
      blob(ctx, w * 0.5, h * 0.38, h * 0.55, 'rgba(120,180,255,.45)');
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, h * 0.9, w, h * 0.1);
      ctx.fillStyle = '#ffc93c';
      ctx.fillRect(0, h * 0.9, w * 0.14, h * 0.1);
    },
    layers: [
      S('🎙️', { x: 0.5, y: 0.36, size: 0.2, effect: 'shadow' }),
      T('breaking news', { x: 0.2, y: 0.665, w: 0.36, size: 0.042, font: 'bebas', fill: '#ffffff', strokeW: 0, box: 'box', boxColor: '#e0262b', boxOpacity: 1, spacing: 0.05 }),
      T('local person drinks water, feels "kind of better actually"', { x: 0.5, y: 0.785, w: 0.9, size: 0.036, font: 'archivo', fill: '#0a0a14', strokeW: 0, caps: false, box: 'box', boxColor: '#ffffff', boxOpacity: 1, align: 'left' }),
      T('live', { x: 0.07, y: 0.95, w: 0.12, size: 0.024, font: 'archivo', fill: '#0a0a14', strokeW: 0 }),
      T('scientists confirm snacks are good  •  more at 11', { x: 0.58, y: 0.95, w: 0.8, size: 0.022, font: 'grotesk', fill: '#ffffff', strokeW: 0, caps: false, align: 'left' }),
    ],
  },
  {
    id: 'versus', label: 'Expectation', w: 1080, h: 1080, layout: 'free',
    paint(ctx, w, h) {
      const top = ctx.createLinearGradient(0, 0, w, h / 2);
      top.addColorStop(0, '#9be7ff'); top.addColorStop(1, '#ffd6f0');
      ctx.fillStyle = top; ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = '#5b6170'; ctx.fillRect(0, h / 2, w, h / 2);
      const rand = seeded(3);
      ctx.strokeStyle = 'rgba(200,220,255,.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 90; i++) {
        const x = rand() * w; const y = h / 2 + rand() * h / 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 30); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h / 2 - 5, w, 10);
    },
    layers: [
      T('expectation', { x: 0.04, y: 0.04, anchor: 'top', w: 0.6, size: 0.06, font: 'archivo', fill: '#ffffff', strokeW: 0, box: 'pill', boxColor: '#14111f', boxOpacity: 0.9, align: 'left', caps: false }),
      S('🏝️', { x: 0.5, y: 0.28, size: 0.24 }), S('✨', { x: 0.72, y: 0.16, size: 0.09 }),
      T('reality', { x: 0.04, y: 0.54, anchor: 'top', w: 0.6, size: 0.06, font: 'archivo', fill: '#ffffff', strokeW: 0, box: 'pill', boxColor: '#14111f', boxOpacity: 0.9, align: 'left', caps: false }),
      S('🫠', { x: 0.5, y: 0.78, size: 0.24 }), S('🌧️', { x: 0.76, y: 0.66, size: 0.1 }),
    ],
  },
  {
    id: 'hazard', label: 'Warning', w: 1080, h: 1080, layout: 'free',
    paint(ctx, w, h) {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.fillStyle = '#ffc93c';
      for (let x = -h; x < w + h; x += 120) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 60 - h, h); ctx.lineTo(x - h, h); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      const b = w * 0.09;
      ctx.fillStyle = '#ffc93c';
      ctx.fillRect(b, b, w - b * 2, h - b * 2);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 10;
      ctx.strokeRect(b + 20, b + 20, w - b * 2 - 40, h - b * 2 - 40);
    },
    layers: [
      S('⚠️', { x: 0.5, y: 0.34, size: 0.26 }),
      T('warning', { x: 0.5, y: 0.6, w: 0.7, size: 0.12, font: 'archivo', fill: '#111111', strokeW: 0, spacing: 0.04 }),
      T('may contain strong opinions\nabout pineapple on pizza', { x: 0.5, y: 0.76, w: 0.7, size: 0.042, font: 'grotesk', fill: '#111111', strokeW: 0, caps: false }),
    ],
  },
  {
    id: 'chalk', label: 'Chalkboard', w: 1600, h: 1000, layout: 'free',
    paint(ctx, w, h) {
      ctx.fillStyle = '#7a4b2a'; ctx.fillRect(0, 0, w, h);
      const b = w * 0.035;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2f4a3a'); g.addColorStop(1, '#1d3328');
      ctx.fillStyle = g; ctx.fillRect(b, b, w - b * 2, h - b * 2);
      const rand = seeded(11);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      for (let i = 0; i < 40; i++) {
        ctx.lineWidth = 20 + rand() * 60;
        ctx.beginPath();
        const y = b + rand() * (h - b * 2);
        ctx.moveTo(b, y); ctx.bezierCurveTo(w * 0.3, y - 60, w * 0.6, y + 60, w - b, y - 20);
        ctx.stroke();
      }
    },
    layers: [
      T("today's lesson:", { x: 0.5, y: 0.14, anchor: 'top', w: 0.84, size: 0.06, font: 'hand', fill: '#f3f0ff', strokeW: 0, caps: false, align: 'left', opacity: 0.92 }),
      T('everything is fine.\nwe are all fine.', { x: 0.5, y: 0.52, w: 0.8, size: 0.07, font: 'hand', fill: '#ffffff', strokeW: 0, caps: false, opacity: 0.92 }),
      S('🍎', { x: 0.88, y: 0.8, size: 0.08 }),
    ],
  },
  {
    id: 'vapor', label: 'Vaporwave', w: 1080, h: 1080, layout: 'free',
    paint(ctx, w, h) {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, '#1a0b3d'); sky.addColorStop(1, '#ff6f91');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.6);
      const sun = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.6);
      sun.addColorStop(0, '#fff36b'); sun.addColorStop(1, '#ff4fa3');
      ctx.fillStyle = sun;
      ctx.beginPath(); ctx.arc(w / 2, h * 0.6, w * 0.26, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ff6f91';
      for (let i = 0; i < 6; i++) ctx.fillRect(0, h * (0.46 + i * 0.025), w, 4 + i * 2);
      ctx.fillStyle = '#12052a'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
      ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 3;
      for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 20, h * 0.6); ctx.lineTo(w / 2 + i * 140, h); ctx.stroke(); }
      for (let i = 0; i < 10; i++) { const y = h * 0.6 + Math.pow(i / 10, 2) * h * 0.4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    },
    layers: [
      T('a e s t h e t i c', { x: 0.5, y: 0.14, w: 0.94, size: 0.085, font: 'serif', fill: 'grad:sunset', stroke: '#ffffff', strokeW: 0.04, caps: false, effect: 'glow' }),
      S('🌴', { x: 0.15, y: 0.6, size: 0.24 }), S('🌴', { x: 0.86, y: 0.62, size: 0.2, flip: true }),
    ],
  },
];

export function paintStarter(starter, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  starter.paint(c.getContext('2d'), w, h);
  return c;
}
