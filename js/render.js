// Drawing: the frame, the processed picture and every layer on top.
import { fontById, GRADIENTS } from './data.js';

const MAX_SIDE = 1600;
const MIN_WIDTH = 720;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const canFilter = (() => {
  try { const c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string'; } catch { return false; }
})();
const canLetterSpace = (() => {
  try { return 'letterSpacing' in document.createElement('canvas').getContext('2d'); } catch { return false; }
})();

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Geometry ----------

// Works out the canvas size and where the picture sits inside the frame.
export function geometry(doc, img) {
  const turned = doc.rotate % 180 !== 0;
  let sw = img ? (turned ? img.height : img.width) : 1080;
  let sh = img ? (turned ? img.width : img.height) : 1080;
  let scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  if (sw * scale < MIN_WIDTH) scale = Math.min(MIN_WIDTH / sw, MAX_SIDE * 1.5 / Math.max(sw, sh));
  const iw = Math.round(sw * scale);
  const ih = Math.round(sh * scale);
  const size = doc.frame.size;
  let top = 0; let right = 0; let bottom = 0; let left = 0;
  switch (doc.layout) {
    case 'top': top = ih * size; break;
    case 'bottom': bottom = ih * size; break;
    case 'both': top = ih * size * 0.8; bottom = ih * size * 0.8; break;
    case 'poster': {
      const b = iw * 0.075;
      top = left = right = b;
      bottom = b + iw * size * 0.9;
      break;
    }
    case 'polaroid': {
      const b = iw * 0.05;
      top = left = right = b;
      bottom = iw * Math.max(0.12, size * 0.8);
      break;
    }
    case 'border': top = left = right = bottom = iw * size * 0.35; break;
    default: break;
  }
  [top, right, bottom, left] = [top, right, bottom, left].map(Math.round);
  return { W: iw + left + right, H: ih + top + bottom, img: { x: left, y: top, w: iw, h: ih }, pad: { top, right, bottom, left } };
}

// ---------- Picture processing ----------

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function hueMatrix(deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r); const s = Math.sin(r);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

function drawOriented(ctx, img, doc, w, h) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((doc.rotate * Math.PI) / 180);
  ctx.scale(doc.flipX ? -1 : 1, doc.flipY ? -1 : 1);
  const turned = doc.rotate % 180 !== 0;
  const dw = turned ? h : w; const dh = turned ? w : h;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

// Returns a canvas of the picture with every effect applied. Deep fry is async because it
// crushes the picture through low-quality JPEG a few times.
export async function processPicture(img, doc, w, h, { quick = false } = {}) {
  const f = doc.filters;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';

  if (f.blur > 0 && canFilter) ctx.filter = `blur(${(f.blur / 100) * Math.max(w, h) * 0.02}px)`;
  drawOriented(ctx, img, doc, w, h);
  ctx.filter = 'none';

  if (f.pixelate > 0) {
    const block = 1 + (f.pixelate / 100) * (Math.max(w, h) / 28);
    const sw = Math.max(1, Math.round(w / block)); const sh = Math.max(1, Math.round(h / block));
    const small = document.createElement('canvas');
    small.width = sw; small.height = sh;
    small.getContext('2d').drawImage(c, 0, 0, sw, sh);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  const fry = f.deepfry / 100;
  const sat = 1 + f.saturate / 100 + fry * 1.8;
  const con = 1 + f.contrast / 100 + fry * 0.7;
  const bri = f.brightness * 1.1 + fry * 10;
  const warm = f.warmth * 0.35 + fry * 30;
  const noise = f.noise * 0.9 + fry * 25;
  const gray = f.grayscale / 100; const sep = f.sepia / 100; const inv = f.invert / 100;
  const hm = f.hue ? hueMatrix(f.hue) : null;
  const levels = fry > 0.35 ? Math.round(14 - fry * 8) : 0;
  const busy = sat !== 1 || con !== 1 || bri || warm || noise || gray || sep || inv || hm || levels || f.rgbsplit;

  if (busy) {
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    const rand = seeded(1234);
    const split = Math.round((f.rgbsplit / 100) * w * 0.02);
    const src = split ? new Uint8ClampedArray(d) : null;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i]; let g = d[i + 1]; let b = d[i + 2];
      if (split) {
        const px = (i / 4) % w;
        const ri = px + split < w ? i + split * 4 : i;
        const bi = px - split >= 0 ? i - split * 4 : i;
        r = src[ri]; b = src[bi + 2];
      }
      if (hm) {
        const nr = r * hm[0] + g * hm[1] + b * hm[2];
        const ng = r * hm[3] + g * hm[4] + b * hm[5];
        const nb = r * hm[6] + g * hm[7] + b * hm[8];
        r = nr; g = ng; b = nb;
      }
      r += bri; g += bri; b += bri;
      r = (r - 128) * con + 128; g = (g - 128) * con + 128; b = (b - 128) * con + 128;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r += warm; b -= warm;
      if (gray) { const y = 0.299 * r + 0.587 * g + 0.114 * b; r += (y - r) * gray; g += (y - g) * gray; b += (y - b) * gray; }
      if (sep) {
        const sr = r * 0.393 + g * 0.769 + b * 0.189; const sg = r * 0.349 + g * 0.686 + b * 0.168; const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r += (sr - r) * sep; g += (sg - g) * sep; b += (sb - b) * sep;
      }
      if (inv) { r += (255 - 2 * r) * inv; g += (255 - 2 * g) * inv; b += (255 - 2 * b) * inv; }
      if (noise) { const n = (rand() - 0.5) * noise; r += n; g += n; b += n; }
      if (levels) {
        const step = 255 / levels;
        r = Math.round(r / step) * step; g = Math.round(g / step) * step; b = Math.round(b / step) * step;
      }
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
    ctx.putImageData(data, 0, 0);
  }

  if (fry > 0.45) {
    // Hot spots, the signature glow of an over-fried picture.
    const rand = seeded(99);
    const spots = 1 + Math.round(fry * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < spots; s++) {
      const x = w * (0.15 + rand() * 0.7); const y = h * (0.15 + rand() * 0.6);
      const r = Math.max(w, h) * (0.05 + rand() * 0.07) * fry;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,220,.95)');
      g.addColorStop(0.25, 'rgba(255,140,40,.6)');
      g.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  if (f.vignette > 0) {
    const v = f.vignette / 100;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.85 * v})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (fry > 0 && !quick) {
    const passes = 1 + Math.round(fry * 4);
    const quality = Math.max(0.02, 0.32 - fry * 0.3);
    for (let p = 0; p < passes; p++) {
      const crushed = await loadImage(c.toDataURL('image/jpeg', quality));
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(crushed, 0, 0, w, h);
    }
  }
  return c;
}

// ---------- Text ----------

export function fontString(layer, px) {
  const font = fontById(layer.font);
  return `${font.weight} ${px}px ${font.family}`;
}

function applySpacing(ctx, layer, px) {
  if (canLetterSpace) ctx.letterSpacing = `${(layer.spacing || 0) * px}px`;
}

function wrap(ctx, text, maxWidth) {
  const out = [];
  text.split('\n').forEach((para) => {
    const words = para.split(' ');
    let line = '';
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        if (!line && ctx.measureText(word).width > maxWidth) {
          // A single word wider than the box breaks by character.
          let chunk = '';
          for (const ch of word) {
            if (chunk && ctx.measureText(chunk + ch).width > maxWidth) { out.push(chunk); chunk = ch; } else chunk += ch;
          }
          line = chunk;
        } else line = test;
      } else {
        out.push(line);
        line = word;
      }
    });
    out.push(line);
  });
  return out;
}

export function layoutText(ctx, layer, W) {
  const px = Math.max(4, layer.size * W);
  ctx.font = fontString(layer, px);
  applySpacing(ctx, layer, px);
  const text = layer.caps ? layer.text.toUpperCase() : layer.text;
  const boxW = layer.w * W;
  const lines = wrap(ctx, text || ' ', boxW);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lh = px * (layer.lineHeight || 1.1);
  const padY = layer.box !== 'none' ? px * 0.22 : 0;
  return { px, lines, widths, lh, boxW, textH: lines.length * lh, h: lines.length * lh + padY * 2, padY };
}

function fillStyle(ctx, fill, x0, y0, x1, y1) {
  if (!fill.startsWith('grad:')) return fill;
  const grad = GRADIENTS.find((g) => 'grad:' + g.id === fill) || GRADIENTS[0];
  const g = grad.dir === 'x' ? ctx.createLinearGradient(x0, 0, x1, 0) : ctx.createLinearGradient(0, y0, 0, y1);
  grad.stops.forEach((s, i) => g.addColorStop(i / (grad.stops.length - 1), s));
  return g;
}

function darken(hex, amt) {
  if (!hex.startsWith('#')) return '#333';
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * (1 - amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function baseColor(fill) {
  if (!fill.startsWith('grad:')) return fill;
  const grad = GRADIENTS.find((g) => 'grad:' + g.id === fill);
  return grad ? grad.stops[Math.floor(grad.stops.length / 2)] : '#ffffff';
}

function hexAlpha(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function lineX(layer, boxW, width) {
  if (layer.align === 'left') return { x: -boxW / 2, start: -boxW / 2 };
  if (layer.align === 'right') return { x: boxW / 2, start: boxW / 2 - width };
  return { x: 0, start: -width / 2 };
}

function drawText(ctx, layer, W, H) {
  const t = layoutText(ctx, layer, W);
  const { px, lines, widths, lh, boxW } = t;
  const g = placement(layer, W, H, boxW, t.h);
  layer._g = g;
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate((layer.rot * Math.PI) / 180);
  ctx.globalAlpha = layer.opacity;
  ctx.font = fontString(layer, px);
  applySpacing(ctx, layer, px);
  ctx.textBaseline = 'middle';
  ctx.textAlign = layer.align === 'left' ? 'left' : layer.align === 'right' ? 'right' : 'center';
  const top = -t.textH / 2;
  const maxW = Math.max(...widths, 1);

  // Backgrounds behind the words.
  if (layer.box !== 'none') {
    ctx.save();
    ctx.fillStyle = hexAlpha(layer.boxColor, layer.boxOpacity);
    const padX = px * 0.32; const padY = px * 0.16;
    if (layer.box === 'lines') {
      lines.forEach((l, i) => {
        if (!l.trim()) return;
        const { start } = lineX(layer, boxW, widths[i]);
        ctx.beginPath();
        ctx.roundRect(start - padX, top + i * lh - padY * 0.2, widths[i] + padX * 2, lh + padY * 0.4, px * 0.18);
        ctx.fill();
      });
    } else {
      const { start } = lineX(layer, boxW, maxW);
      const x = start - padX; const y = top - padY; const w = maxW + padX * 2; const h = t.textH + padY * 2;
      const radius = layer.box === 'pill' ? Math.min(h / 2, px) : layer.box === 'bubble' ? px * 0.6 : px * 0.12;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      if (layer.box === 'bubble') {
        const tx = x + Math.min(w * 0.25, px * 1.4);
        ctx.moveTo(tx, y + h - 1);
        ctx.lineTo(tx - px * 0.35, y + h + px * 0.6);
        ctx.lineTo(tx + px * 0.55, y + h - 1);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();
  }

  const fill = fillStyle(ctx, layer.fill, -boxW / 2, top, boxW / 2, top + t.textH);
  const stroke = layer.strokeW > 0 ? layer.stroke : null;
  const each = (fn) => lines.forEach((l, i) => fn(l, lineX(layer, boxW, widths[i]).x, top + i * lh + lh / 2));
  const strokeAll = (color, width) => {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    each((l, x, y) => ctx.strokeText(l, x, y));
  };

  if (layer.effect === 'extrude') {
    const depth = Math.max(2, Math.round(px * 0.09));
    const side = darken(baseColor(layer.fill), 0.55);
    for (let d = depth; d > 0; d--) {
      ctx.save();
      ctx.translate(d * 0.55, d);
      if (stroke) strokeAll(stroke, layer.strokeW * px);
      ctx.fillStyle = stroke || side;
      each((l, x, y) => ctx.fillText(l, x, y));
      ctx.restore();
    }
  }
  if (layer.effect === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = px * 0.18;
    ctx.shadowOffsetY = px * 0.08;
  }
  if (layer.effect === 'glow' || layer.effect === 'neon') {
    ctx.shadowColor = baseColor(layer.fill);
    ctx.shadowBlur = px * (layer.effect === 'neon' ? 0.5 : 0.3);
  }
  if (stroke) strokeAll(stroke, layer.strokeW * px);
  if (layer.effect === 'neon') {
    // A bright core over a colored glow, drawn twice for intensity.
    ctx.fillStyle = fill;
    each((l, x, y) => ctx.fillText(l, x, y));
    ctx.shadowBlur = px * 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.55;
    each((l, x, y) => ctx.fillText(l, x, y));
    ctx.globalAlpha = layer.opacity;
  }
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill;
  each((l, x, y) => ctx.fillText(l, x, y));
  ctx.restore();
}

// Turns a layer's stored position into a center point. `anchor` says whether y is the top, middle or bottom edge.
export function placement(layer, W, H, w, h) {
  const cx = layer.x * W;
  let cy = layer.y * H;
  if (layer.anchor === 'top') cy += h / 2;
  if (layer.anchor === 'bottom') cy -= h / 2;
  return { cx, cy, w, h, rot: layer.rot };
}

// The inverse of placement: a new center point back into the stored y.
export function storeCenter(layer, cx, cy, W, H) {
  const h = layer._g ? layer._g.h : 0;
  layer.x = cx / W;
  let y = cy;
  if (layer.anchor === 'top') y -= h / 2;
  if (layer.anchor === 'bottom') y += h / 2;
  layer.y = y / H;
}

function drawSticker(ctx, layer, W, H) {
  const px = layer.size * W;
  const g = placement(layer, W, H, px * 1.2, px * 1.2);
  layer._g = g;
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate((layer.rot * Math.PI) / 180);
  ctx.scale(layer.flip ? -1 : 1, 1);
  ctx.globalAlpha = layer.opacity;
  ctx.font = `${px}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (layer.effect === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = px * 0.15;
    ctx.shadowOffsetY = px * 0.06;
  }
  ctx.fillText(layer.emoji, 0, px * 0.06);
  ctx.restore();
}

function drawPicture(ctx, layer, W, H, assets) {
  const asset = assets.get(layer.asset);
  if (!asset) return;
  const w = layer.size * W;
  const h = w * (asset.img.height / asset.img.width);
  const g = placement(layer, W, H, w, h);
  layer._g = g;
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate((layer.rot * Math.PI) / 180);
  ctx.scale(layer.flip ? -1 : 1, 1);
  ctx.globalAlpha = layer.opacity;
  if (layer.effect === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = w * 0.05;
    ctx.shadowOffsetY = w * 0.02;
  }
  ctx.drawImage(asset.img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---------- Compose ----------

export function compose(canvas, doc, geo, picture, assets) {
  const { W, H, img } = geo;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (doc.layout !== 'classic' && doc.layout !== 'free') {
    ctx.fillStyle = doc.frame.color;
    ctx.fillRect(0, 0, W, H);
  }
  if (picture) ctx.drawImage(picture, img.x, img.y, img.w, img.h);
  if (doc.layout === 'poster') {
    const gap = Math.max(3, img.w * 0.008);
    ctx.strokeStyle = doc.frame.color === '#000000' || doc.frame.color === '#14111f' ? '#ffffff' : '#000000';
    ctx.lineWidth = Math.max(2, img.w * 0.003);
    ctx.strokeRect(img.x - gap, img.y - gap, img.w + gap * 2, img.h + gap * 2);
  }
  doc.layers.forEach((layer) => {
    if (layer.hidden) { layer._g = null; return; }
    if (layer.type === 'text') drawText(ctx, layer, W, H);
    else if (layer.type === 'sticker') drawSticker(ctx, layer, W, H);
    else if (layer.type === 'picture') drawPicture(ctx, layer, W, H, assets);
  });
}

export { canFilter, loadImage };
