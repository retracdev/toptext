// Toptext: put words on pictures.
import {
  CANDY, FONTS, SOLIDS, GRADIENTS, EFFECTS, BOXES, STICKERS, CAPTIONS, FILTER_DEFAULTS,
  FILTER_SLIDERS, PRESETS, LAYOUTS, FRAME_COLORS, BLANK_SIZES, LOADING_LINES, RIBBON_WORDS,
} from './data.js';
import { geometry, processPicture, compose, storeCenter, fontString, loadImage } from './render.js';
import { newDoc, textLayer, stickerLayer, pictureLayer, makeLayer, arrangeLayout, frameInk, uid } from './model.js';
import { STARTERS, paintStarter } from './starters.js';
import { saveDraft, loadDraft, clearDraft, listStack, addToStack, removeFromStack } from './storage.js';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const icon = (id) => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#' + id);
  svg.appendChild(use);
  return svg;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const canvas = $('canvas');
const overlay = $('overlay');
const sel = $('sel');

// ---------- State ----------

let doc = newDoc();
const assets = new Map(); // id -> { src, img }
let geo = null;
let picture = null;
let pictureKey = '';
let picturePromise = Promise.resolve();
let processToken = 0;
let liveFilters = false;
let selectedId = null;
let drag = null;
let currentTab = 'start';
let format = 'png';
let lastCaption = -1;

const active = () => !!(doc.base && assets.has(doc.base));
const selected = () => doc.layers.find((l) => l.id === selectedId) || null;

// ---------- History ----------

const snapshot = () => JSON.stringify(doc, (k, v) => (k === '_g' ? undefined : v));
let past = [];
let future = [];
let lastSnap = snapshot();

function commit() {
  const s = snapshot();
  if (s === lastSnap) return;
  past.push(lastSnap);
  if (past.length > 120) past.shift();
  future = [];
  lastSnap = s;
  updateUndo();
  scheduleDraft();
}

function resetHistory() {
  past = [];
  future = [];
  lastSnap = snapshot();
  updateUndo();
}

function restore(s) {
  doc = JSON.parse(s);
  lastSnap = s;
  if (!selected()) selectedId = null;
  refreshAll();
  scheduleDraft();
}

function undo() {
  if (!past.length) return;
  future.push(lastSnap);
  restore(past.pop());
  updateUndo();
}

function redo() {
  if (!future.length) return;
  past.push(lastSnap);
  restore(future.pop());
  updateUndo();
}

function updateUndo() {
  $('undo').disabled = !past.length;
  $('redo').disabled = !future.length;
}

let commitTimer = 0;
function commitSoon() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commit, 500);
}

// ---------- Assets ----------

async function addAsset(src, id = uid('a')) {
  if (assets.has(id)) return id;
  const img = await loadImage(src);
  assets.set(id, { src, img });
  return id;
}

async function fileToDataURL(file, max = 2000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Rendering ----------

let raf = 0;
function requestRender() {
  if (!raf) raf = requestAnimationFrame(renderNow);
}

function ensurePicture() {
  const base = assets.get(doc.base);
  const key = JSON.stringify([doc.base, doc.rotate, doc.flipX, doc.flipY, doc.filters, geo.img.w, geo.img.h, liveFilters]);
  if (key === pictureKey) return;
  pictureKey = key;
  const token = ++processToken;
  const fry = doc.filters.deepfry > 0 && !liveFilters;
  if (fry) showBusy('Deep frying…');
  picturePromise = processPicture(base.img, doc, geo.img.w, geo.img.h, { quick: liveFilters })
    .then((result) => {
      if (fry) hideBusy();
      if (token !== processToken) return;
      picture = result;
      requestRender();
    })
    .catch(() => { if (fry) hideBusy(); });
}

const fontsAsked = new Set();
function renderNow() {
  raf = 0;
  if (!active()) return;
  geo = geometry(doc, assets.get(doc.base).img);
  ensurePicture();
  compose(canvas, doc, geo, picture, assets);
  fitCanvas();
  doc.layers.forEach((l) => {
    if (l.type !== 'text' || fontsAsked.has(l.font)) return;
    fontsAsked.add(l.font);
    if (document.fonts && document.fonts.load) document.fonts.load(fontString(l, 40), l.text || 'A').then(requestRender, () => {});
  });
  updateOverlay();
}

// The canvas is drawn at full size and shown scaled to fit the stage.
function fitCanvas() {
  if (!geo) return;
  const stage = $('stage');
  const cs = getComputedStyle(stage);
  const aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = Math.min(window.innerHeight * 0.68, 760);
  const s = Math.min(aw / geo.W, ah / geo.H, 1);
  const w = Math.max(1, Math.floor(geo.W * s)) + 'px';
  const h = Math.max(1, Math.floor(geo.H * s)) + 'px';
  if (canvas.style.width !== w) canvas.style.width = w;
  if (canvas.style.height !== h) canvas.style.height = h;
}

function refreshAll() {
  refreshView();
  renderLayers();
  renderInspector();
  syncEffects();
  syncLayout();
  requestRender();
}

function refreshView() {
  const on = active();
  $('boot').hidden = true;
  $('empty').hidden = on;
  $('board').hidden = !on;
  ['download', 'copyImage', 'shareImage', 'saveStack'].forEach((id) => { $(id).disabled = !on; });
}

function popBoard() {
  const b = $('board');
  b.classList.remove('is-pop');
  void b.offsetWidth;
  b.classList.add('is-pop');
}

// ---------- Busy pill, toasts ----------

let busyCount = 0;
function showBusy(label) {
  busyCount++;
  $('busyLabel').textContent = label;
  $('busy').hidden = false;
}
function hideBusy() {
  busyCount = Math.max(0, busyCount - 1);
  if (!busyCount) $('busy').hidden = true;
}
async function busyFor(label, ms) {
  showBusy(label);
  await wait(ms);
  hideBusy();
}

function toast(message, { action, error = false, ms = 3200 } = {}) {
  const t = el('div', 'toast' + (error ? ' toast--error' : ''));
  t.appendChild(el('span', '', message));
  if (action) {
    const b = el('button', '', action.label);
    b.type = 'button';
    b.addEventListener('click', () => { action.run(); leave(); });
    t.appendChild(b);
  }
  $('toasts').appendChild(t);
  const leave = () => {
    if (t.classList.contains('is-leaving')) return;
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 260);
  };
  setTimeout(leave, ms);
}

// ---------- Overlay and dragging ----------

function displayScale() {
  return canvas.clientWidth / canvas.width || 1;
}

function updateOverlay() {
  const layer = selected();
  if (!layer || !layer._g || !active()) { sel.hidden = true; return; }
  const g = layer._g;
  const s = displayScale();
  const pad = 6;
  const w = g.w * s + pad * 2;
  const h = g.h * s + pad * 2;
  sel.hidden = false;
  sel.dataset.type = layer.type;
  sel.classList.toggle('is-small', h < 44);
  sel.style.width = w + 'px';
  sel.style.height = h + 'px';
  sel.style.transform = `translate(${g.cx * s - w / 2}px, ${g.cy * s - h / 2}px) rotate(${g.rot}deg)`;
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
}

function hitTest(p) {
  const tol = 6 / displayScale();
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i];
    const g = l._g;
    if (l.hidden || !g) continue;
    const a = (-g.rot * Math.PI) / 180;
    const dx = p.x - g.cx; const dy = p.y - g.cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= g.w / 2 + tol && Math.abs(ly) <= g.h / 2 + tol) return l;
  }
  return null;
}

overlay.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest('#selDelete')) return;
  const handle = e.target.closest('[data-handle]');
  const p = canvasPoint(e);
  let layer;
  if (handle) layer = selected();
  else {
    layer = hitTest(p);
    select(layer ? layer.id : null);
    if (layer && currentTab === 'start') openTab('words');
  }
  if (!layer || !layer._g) return;
  e.preventDefault();
  overlay.setPointerCapture(e.pointerId);
  drag = {
    mode: handle ? handle.dataset.handle : 'move',
    id: layer.id, start: p, g: { ...layer._g },
    size: layer.size, w: layer.w, moved: false,
  };
});

overlay.addEventListener('pointermove', (e) => {
  const p = canvasPoint(e);
  if (!drag) {
    if (e.pointerType === 'mouse') overlay.classList.toggle('is-hover', !!hitTest(p));
    return;
  }
  const layer = doc.layers.find((l) => l.id === drag.id);
  if (!layer) return;
  drag.moved = true;
  const { W, H } = geo;
  const g = drag.g;
  if (drag.mode === 'move') {
    let cx = g.cx + p.x - drag.start.x;
    let cy = g.cy + p.y - drag.start.y;
    const th = 9 / displayScale();
    const snapV = Math.abs(cx - W / 2) < th;
    const snapH = Math.abs(cy - H / 2) < th;
    if (snapV) cx = W / 2;
    if (snapH) cy = H / 2;
    $('guideV').hidden = !snapV;
    $('guideH').hidden = !snapH;
    storeCenter(layer, cx, cy, W, H);
  } else if (drag.mode === 'scale') {
    const d0 = Math.hypot(drag.start.x - g.cx, drag.start.y - g.cy);
    const d1 = Math.hypot(p.x - g.cx, p.y - g.cy);
    const r = d1 / Math.max(d0, 1);
    layer.size = clampN(drag.size * r, 0.01, 1.6);
    if (layer.type === 'text') layer.w = clampN(drag.w * r, 0.05, 2);
  } else if (drag.mode === 'width') {
    const a = (-layer.rot * Math.PI) / 180;
    const dx = p.x - g.cx; const dy = p.y - g.cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    layer.w = clampN((2 * Math.abs(lx)) / W, 0.05, 2);
  } else if (drag.mode === 'rotate') {
    let ang = (Math.atan2(p.y - g.cy, p.x - g.cx) * 180) / Math.PI + 90;
    if (ang > 180) ang -= 360;
    if (e.shiftKey) ang = Math.round(ang / 15) * 15;
    else {
      const near = Math.round(ang / 45) * 45;
      if (Math.abs(ang - near) < 4) ang = near;
    }
    layer.rot = Math.round(ang);
  }
  requestRender();
  syncSliders();
});

function endDrag() {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  $('guideV').hidden = true;
  $('guideH').hidden = true;
  if (moved) commit();
}
overlay.addEventListener('pointerup', endDrag);
overlay.addEventListener('pointercancel', endDrag);
overlay.addEventListener('lostpointercapture', endDrag);

overlay.addEventListener('dblclick', (e) => {
  const layer = hitTest(canvasPoint(e));
  if (!layer || layer.type !== 'text') return;
  select(layer.id);
  openTab('words');
  const ta = $('textInput');
  ta.focus();
  ta.select();
});

$('selDelete').addEventListener('click', () => deleteLayer());
window.addEventListener('resize', () => { fitCanvas(); updateOverlay(); });

// ---------- Layers ----------

function select(id) {
  selectedId = id;
  renderLayers();
  renderInspector();
  updateOverlay();
}

function needCanvas() {
  if (active()) return Promise.resolve();
  return createBlank('#ffffff', BLANK_SIZES[0], { silent: true });
}

function sizeFor(frac) {
  return geo ? (geo.img.w * frac) / geo.W : frac;
}

async function addText(text) {
  await needCanvas();
  geo = geometry(doc, assets.get(doc.base).img);
  const count = doc.layers.filter((l) => l.type === 'text').length;
  const layer = textLayer({
    text: text || pick(['your words here', 'say something', 'type here', 'big if true']),
    x: 0.5, y: clampN(0.5 + ((count % 3) - 1) * 0.12, 0.15, 0.85),
    w: sizeFor(0.84), size: sizeFor(0.075),
  });
  doc.layers.push(layer);
  commit();
  select(layer.id);
  requestRender();
  openTab('words');
  const ta = $('textInput');
  ta.focus();
  ta.select();
}

async function addSticker(emoji) {
  await needCanvas();
  geo = geometry(doc, assets.get(doc.base).img);
  const layer = stickerLayer({
    emoji, x: 0.5 + (Math.random() - 0.5) * 0.2, y: 0.5 + (Math.random() - 0.5) * 0.2,
    size: sizeFor(0.22), rot: Math.round((Math.random() - 0.5) * 24),
  });
  doc.layers.push(layer);
  commit();
  select(layer.id);
  requestRender();
  popBoard();
}

async function addPictureLayer(file) {
  if (!file || !file.type.startsWith('image/')) return;
  showBusy('Cutting it out…');
  try {
    await needCanvas();
    const [src] = await Promise.all([fileToDataURL(file, 1200), wait(450)]);
    const id = await addAsset(src);
    geo = geometry(doc, assets.get(doc.base).img);
    const layer = pictureLayer({ asset: id, size: sizeFor(0.4), effect: 'shadow' });
    doc.layers.push(layer);
    commit();
    select(layer.id);
    requestRender();
    popBoard();
  } catch {
    toast("That picture didn't load. Try another one.", { error: true });
  } finally {
    hideBusy();
  }
}

function deleteLayer(id = selectedId) {
  const i = doc.layers.findIndex((l) => l.id === id);
  if (i < 0) return;
  doc.layers.splice(i, 1);
  if (selectedId === id) selectedId = null;
  commit();
  refreshAll();
}

function duplicateLayer() {
  const layer = selected();
  if (!layer) return;
  const copy = JSON.parse(JSON.stringify(layer, (k, v) => (k === '_g' ? undefined : v)));
  copy.id = uid(layer.type[0]);
  copy.x = clampN(copy.x + 0.04, 0, 1);
  copy.y = clampN(copy.y + 0.04, 0, 1);
  doc.layers.splice(doc.layers.indexOf(layer) + 1, 0, copy);
  commit();
  select(copy.id);
  requestRender();
}

function moveLayer(id, dir) {
  const i = doc.layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= doc.layers.length) return;
  [doc.layers[i], doc.layers[j]] = [doc.layers[j], doc.layers[i]];
  commit();
  renderLayers();
  requestRender();
}

function centerLayer() {
  const layer = selected();
  if (!layer || !geo) return;
  storeCenter(layer, geo.W / 2, geo.H / 2, geo.W, geo.H);
  commit();
  requestRender();
}

function layerTitle(l) {
  if (l.type === 'text') return (l.text || '').replace(/\s+/g, ' ').trim() || 'Empty words';
  if (l.type === 'sticker') return 'Sticker';
  return 'Your picture';
}

function renderLayers() {
  const list = $('layers');
  list.textContent = '';
  const layers = doc.layers.slice().reverse();
  $('layersEmpty').hidden = layers.length > 0;
  layers.forEach((l, idx) => {
    const li = el('li', 'layer' + (l.id === selectedId ? ' is-selected' : '') + (l.hidden ? ' is-hidden' : ''));
    li.style.animationDelay = idx * 25 + 'ms';
    const ic = el('span', 'layer__icon');
    if (l.type === 'text') ic.appendChild(el('b', '', 'Aa'));
    else if (l.type === 'sticker') ic.textContent = l.emoji;
    else if (assets.has(l.asset)) { const im = el('img'); im.src = assets.get(l.asset).src; im.alt = ''; ic.appendChild(im); }
    const name = el('span', 'layer__name', layerTitle(l));
    const btns = el('span', 'layer__btns');
    const mk = (ico, label, fn, disabled) => {
      const b = el('button');
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.appendChild(icon(ico));
      b.disabled = !!disabled;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
      btns.appendChild(b);
    };
    mk(l.hidden ? 'i-eye-off' : 'i-eye', l.hidden ? 'Show' : 'Hide', () => { l.hidden = !l.hidden; commit(); renderLayers(); requestRender(); });
    mk('i-up', 'Bring forward', () => moveLayer(l.id, 1), idx === 0);
    mk('i-down', 'Send back', () => moveLayer(l.id, -1), idx === layers.length - 1);
    li.append(ic, name, btns);
    li.addEventListener('click', () => select(l.id));
    list.appendChild(li);
  });
}

// ---------- Inspector ----------

function setFill(input) {
  const min = parseFloat(input.min); const max = parseFloat(input.max);
  input.style.setProperty('--fill', ((parseFloat(input.value) - min) / (max - min)) * 100 + '%');
}

function formatProp(prop, v) {
  switch (prop) {
    case 'size': return geo ? Math.round(v * geo.W) + '' : v.toFixed(2);
    case 'rot': return Math.round(v) + '°';
    case 'opacity': case 'strokeW': return Math.round(v * 100) + '%';
    case 'spacing': return Math.round(v * 100) + '';
    case 'lineHeight': return v.toFixed(2);
    default: return String(v);
  }
}

function syncSliders() {
  const layer = selected();
  if (!layer) return;
  $('inspector').querySelectorAll('input[type="range"][data-prop]').forEach((input) => {
    if (input.closest('.insp') && input.closest('.insp').offsetParent === null) return;
    const v = layer[input.dataset.prop];
    if (v == null) return;
    if (document.activeElement !== input) input.value = v;
    setFill(input);
    input.parentElement.querySelector('output').textContent = formatProp(input.dataset.prop, v);
  });
}

function pressAll(container, attr, value) {
  container.querySelectorAll(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(value))));
}

function renderInspector() {
  const layer = selected();
  const insp = $('inspector');
  insp.hidden = !layer;
  if (!layer) return;
  insp.dataset.type = layer.type;
  if (layer.type === 'text') {
    const ta = $('textInput');
    if (document.activeElement !== ta) ta.value = layer.text;
    pressAll($('fonts'), 'data-font', layer.font);
    pressAll($('fillSwatches'), 'data-color', layer.fill);
    pressAll($('strokeSwatches'), 'data-color', layer.strokeW > 0 ? layer.stroke : 'none');
    pressAll($('effectChips'), 'data-effect', layer.effect);
    pressAll($('boxChips'), 'data-box', layer.box);
    pressAll($('boxSwatches'), 'data-color', layer.boxColor);
    $('boxSwatches').hidden = layer.box === 'none';
    $('alignGroup').querySelectorAll('[data-align]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.align === layer.align)));
    $('capsToggle').setAttribute('aria-pressed', String(!!layer.caps));
  } else {
    $('flipLayer').setAttribute('aria-pressed', String(!!layer.flip));
    $('shadowLayer').setAttribute('aria-pressed', String(layer.effect === 'shadow'));
  }
  syncSliders();
}

function edit(fn, { soon = false } = {}) {
  const layer = selected();
  if (!layer) return;
  fn(layer);
  requestRender();
  renderInspector();
  if (soon) commitSoon(); else commit();
}

function swatch(color, { custom = false, none = false, onPick }) {
  const b = el('button', 'swatch' + (custom ? ' swatch--custom' : '') + (none ? ' swatch--none' : ''));
  b.type = 'button';
  if (custom) {
    b.title = 'Pick any color';
    const input = el('input');
    input.type = 'color';
    input.value = '#ff7eb6';
    input.setAttribute('aria-label', 'Pick any color');
    input.addEventListener('input', () => onPick(input.value, true));
    input.addEventListener('change', () => onPick(input.value, false));
    b.appendChild(input);
    return b;
  }
  b.dataset.color = none ? 'none' : color;
  b.title = none ? 'No outline' : color;
  b.setAttribute('aria-label', b.title);
  if (!none) {
    const g = color.startsWith('grad:') ? GRADIENTS.find((x) => 'grad:' + x.id === color) : null;
    b.style.setProperty('--sw', g ? `linear-gradient(${g.dir === 'x' ? '90deg' : '180deg'}, ${g.stops.join(',')})` : color);
    if (g) { b.title = g.label; b.setAttribute('aria-label', g.label); }
  }
  b.addEventListener('click', () => onPick(none ? 'none' : color, false));
  return b;
}

function buildInspector() {
  const fonts = $('fonts');
  FONTS.forEach((f) => {
    const b = el('button', 'fontbtn', f.label);
    b.type = 'button';
    b.dataset.font = f.id;
    b.style.fontFamily = f.family;
    b.style.fontWeight = f.weight;
    if (f.id === 'pixel') b.style.fontSize = '.6rem';
    b.addEventListener('click', () => edit((l) => { l.font = f.id; }));
    fonts.appendChild(b);
  });

  const fill = $('fillSwatches');
  [...SOLIDS, ...GRADIENTS.map((g) => 'grad:' + g.id)].forEach((c) => fill.appendChild(swatch(c, { onPick: (v) => edit((l) => { l.fill = v; }) })));
  fill.appendChild(swatch(null, { custom: true, onPick: (v, live) => edit((l) => { l.fill = v; }, { soon: live }) }));

  const stroke = $('strokeSwatches');
  stroke.appendChild(swatch(null, { none: true, onPick: () => edit((l) => { l.strokeW = 0; }) }));
  ['#000000', '#ffffff', '#ff4d4d', '#ffc93c', '#35d6c8', '#ab8fff', '#ff7eb6', '#171029'].forEach((c) => stroke.appendChild(swatch(c, {
    onPick: (v) => edit((l) => { l.stroke = v; if (!l.strokeW) l.strokeW = 0.12; }),
  })));
  stroke.appendChild(swatch(null, { custom: true, onPick: (v, live) => edit((l) => { l.stroke = v; if (!l.strokeW) l.strokeW = 0.12; }, { soon: live }) }));

  const effects = $('effectChips');
  EFFECTS.forEach((fx) => {
    const b = el('button', 'chip', fx.label);
    b.type = 'button';
    b.dataset.effect = fx.id;
    b.addEventListener('click', () => edit((l) => { l.effect = fx.id; }));
    effects.appendChild(b);
  });

  const boxes = $('boxChips');
  BOXES.forEach((bx) => {
    const b = el('button', 'chip', bx.label);
    b.type = 'button';
    b.dataset.box = bx.id;
    b.style.setProperty('--chip', '#35d6c8');
    b.style.setProperty('--chip-side', '#12877c');
    b.addEventListener('click', () => edit((l) => {
      l.box = bx.id;
      if (bx.id !== 'none' && l.strokeW > 0 && l.boxColor === l.stroke) l.strokeW = 0;
      if (bx.id === 'bubble' && l.boxColor === '#000000') { l.boxColor = '#ffffff'; l.boxOpacity = 1; if (l.fill === '#ffffff') l.fill = '#000000'; l.strokeW = 0; }
    }));
    boxes.appendChild(b);
  });
  const boxSw = $('boxSwatches');
  SOLIDS.forEach((c) => boxSw.appendChild(swatch(c, { onPick: (v) => edit((l) => { l.boxColor = v; }) })));
  boxSw.appendChild(swatch(null, { custom: true, onPick: (v, live) => edit((l) => { l.boxColor = v; }, { soon: live }) }));

  $('alignGroup').querySelectorAll('[data-align]').forEach((b) => b.addEventListener('click', () => edit((l) => { l.align = b.dataset.align; })));
  $('capsToggle').addEventListener('click', () => edit((l) => { l.caps = !l.caps; }));
  $('flipLayer').addEventListener('click', () => edit((l) => { l.flip = !l.flip; }));
  $('shadowLayer').addEventListener('click', () => edit((l) => { l.effect = l.effect === 'shadow' ? 'none' : 'shadow'; }));

  $('textInput').addEventListener('input', (e) => {
    const layer = selected();
    if (!layer || layer.type !== 'text') return;
    layer.text = e.target.value;
    requestRender();
    const name = $('layers').querySelector('.layer.is-selected .layer__name');
    if (name) name.textContent = layerTitle(layer);
    commitSoon();
  });
  $('textInput').addEventListener('blur', commit);

  $('inspector').querySelectorAll('input[type="range"][data-prop]').forEach((input) => {
    input.addEventListener('input', () => {
      const layer = selected();
      if (!layer) return;
      layer[input.dataset.prop] = parseFloat(input.value);
      setFill(input);
      input.parentElement.querySelector('output').textContent = formatProp(input.dataset.prop, layer[input.dataset.prop]);
      requestRender();
    });
    input.addEventListener('change', commit);
  });

  const swap = $('swapEmoji');
  [...STICKERS.Faces.slice(0, 14), ...STICKERS.Things.slice(0, 10)].forEach((e) => {
    const b = el('button', '', e);
    b.type = 'button';
    b.setAttribute('aria-label', 'Swap to ' + e);
    b.addEventListener('click', () => edit((l) => { l.emoji = e; }));
    swap.appendChild(b);
  });

  $('layerCenter').addEventListener('click', centerLayer);
  $('layerDuplicate').addEventListener('click', duplicateLayer);
  $('layerDelete').addEventListener('click', () => deleteLayer());
  $('wordsAdd').addEventListener('click', () => addText());
  $('wordsDice').addEventListener('click', rollCaptions);
}

// ---------- Tabs ----------

function openTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.tabpanel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  if (name === 'effects') buildPresetThumbs();
  if (name === 'words') syncSliders();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => openTab(t.dataset.tab)));

// ---------- Start: pictures, starters, blanks ----------

async function setBase(src, { label = 'Developing…' } = {}) {
  showBusy(label);
  try {
    const [id] = await Promise.all([addAsset(src), wait(500 + Math.random() * 300)]);
    const fresh = !active();
    if (fresh) doc = newDoc();
    doc.base = id;
    doc.rotate = 0; doc.flipX = false; doc.flipY = false;
    geo = geometry(doc, assets.get(id).img);
    if (fresh) arrangeLayout(doc, geo);
    else arrangeLayout(doc, geo, { create: false, positionsOnly: true });
    commit();
    if (fresh) selectedId = null;
    refreshAll();
    popBoard();
    if (!fresh) toast('Picture swapped. Your words stayed.', { action: { label: 'Undo', run: undo } });
    else if (currentTab === 'start') openTab('words');
  } catch {
    toast("That picture didn't load. Try another one.", { error: true });
  } finally {
    hideBusy();
  }
}

async function importFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast("That's not a picture. Try a JPG, PNG, GIF or WebP.", { error: true });
    return;
  }
  try {
    const src = await fileToDataURL(file);
    await setBase(src);
  } catch {
    toast("That picture didn't load. Try another one.", { error: true });
  }
}

async function loadStarter(st) {
  showBusy('Painting…');
  try {
    await wait(450 + Math.random() * 250);
    const src = paintStarter(st, st.w, st.h).toDataURL('image/png');
    const id = await addAsset(src);
    doc = newDoc();
    doc.base = id;
    doc.layout = st.layout;
    geo = geometry(doc, assets.get(id).img);
    doc.layers = st.layers.map((spec) => {
      const layer = makeLayer(JSON.parse(JSON.stringify(spec)));
      return layer;
    });
    if (st.captions) {
      const caps = [];
      arrangeLayout({ ...doc, layers: caps }, geo);
      const pair = nextCaption();
      caps.forEach((c, i) => { c.text = pair[i] || ''; });
      doc.layers.push(...caps);
    }
    selectedId = null;
    commit();
    refreshAll();
    popBoard();
    if (currentTab === 'start') openTab('words');
  } finally {
    hideBusy();
  }
}

let blankColor = '#ffffff';
async function createBlank(color, size, { silent = false } = {}) {
  const c = document.createElement('canvas');
  c.width = size.w; c.height = size.h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size.w, size.h);
  if (!silent) await busyFor('Stretching the canvas…', 400);
  const id = await addAsset(c.toDataURL('image/png'));
  doc = newDoc();
  doc.base = id;
  doc.layout = 'free';
  geo = geometry(doc, assets.get(id).img);
  if (!silent) {
    doc.layers.push(textLayer({
      text: 'your words here', font: 'plain', fill: frameInk(color), strokeW: 0, caps: false,
      w: 0.84, size: 0.075, x: 0.5, y: 0.5,
    }));
  }
  selectedId = null;
  commit();
  refreshAll();
  popBoard();
}

function buildStart() {
  const grid = $('starters');
  STARTERS.forEach((st, i) => {
    const b = el('button', 'starter');
    b.type = 'button';
    const thumb = el('span', 'starter__thumb');
    const tw = 200; const th = Math.round((200 * st.h) / st.w);
    const c = paintStarter(st, tw, th);
    const ctx = c.getContext('2d');
    // A preview of the stickers, so each card shows its idea.
    st.layers.filter((l) => l.type === 'sticker').forEach((l) => {
      const px = (l.size || 0.22) * tw;
      ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.emoji, (l.x || 0.5) * tw, (l.y || 0.5) * th);
    });
    thumb.appendChild(c);
    b.append(thumb, el('span', 'starter__label', st.label));
    b.style.animation = `stkin .45s var(--spring) ${i * 40}ms backwards`;
    b.addEventListener('click', () => loadStarter(st));
    grid.appendChild(b);
  });

  const colors = $('blankColors');
  const blankList = ['#ffffff', '#000000', '#ffc93c', '#ff7eb6', '#35d6c8', '#ab8fff', '#ff8360', '#93e571', '#14111f'];
  const pressBlank = () => pressAll(colors, 'data-color', blankColor);
  blankList.forEach((c) => colors.appendChild(swatch(c, {
    onPick: (v) => {
      blankColor = v;
      pressBlank();
      $('blankSizes').querySelectorAll('i').forEach((i) => i.style.setProperty('--blank', v));
    },
  })));
  pressBlank();
  const sizes = $('blankSizes');
  BLANK_SIZES.forEach((s) => {
    const b = el('button', 'sizebtn');
    b.type = 'button';
    const shape = el('i');
    const k = 34 / Math.max(s.w, s.h);
    shape.style.width = Math.round(s.w * k) + 'px';
    shape.style.height = Math.round(s.h * k) + 'px';
    b.append(shape, el('span', '', s.label));
    b.addEventListener('click', () => createBlank(blankColor, s));
    sizes.appendChild(b);
  });

  const fileInput = $('fileInput');
  const choose = () => fileInput.click();
  $('dropzone').addEventListener('click', choose);
  $('pickFile').addEventListener('click', choose);
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) importFile(fileInput.files[0]);
    fileInput.value = '';
  });
  $('emptyStarters').addEventListener('click', () => {
    openTab('start');
    const target = $('starters');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.querySelectorAll('.starter').forEach((s, i) => {
      s.style.animation = 'none';
      void s.offsetWidth;
      s.style.animation = `stkin .45s var(--spring) ${i * 50}ms backwards`;
    });
  });
  $('pasteImage').addEventListener('click', pasteFromClipboard);

  const pictureInput = $('pictureInput');
  $('addPicture').addEventListener('click', () => pictureInput.click());
  pictureInput.addEventListener('change', () => {
    if (pictureInput.files[0]) addPictureLayer(pictureInput.files[0]);
    pictureInput.value = '';
  });
}

async function takeImageBlob(blob) {
  const file = blob instanceof File ? blob : new File([blob], 'pasted.png', { type: blob.type });
  if (!active()) importFile(file);
  else {
    await addPictureLayer(file);
    toast('Pasted on top as a sticker.', { action: { label: 'Use as picture', run: () => { undo(); importFile(file); } } });
  }
}

async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) { takeImageBlob(await item.getType(type)); return; }
    }
    toast('No picture on your clipboard. Copy one first.');
  } catch {
    toast('Your browser blocked the clipboard. Press Ctrl+V instead.', { error: true });
  }
}

document.addEventListener('paste', (e) => {
  const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
  const item = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  takeImageBlob(item.getAsFile());
});

// Drag and drop anywhere.
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  $('dropVeil').hidden = false;
  $('stage').classList.add('is-dragover');
});
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) { $('dropVeil').hidden = true; $('stage').classList.remove('is-dragover'); }
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('dropVeil').hidden = true;
  $('stage').classList.remove('is-dragover');
  const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
  if (file) importFile(file);
  else toast("That's not a picture. Try a JPG, PNG, GIF or WebP.", { error: true });
});

// ---------- Captions dice ----------

function nextCaption() {
  let i;
  do { i = Math.floor(Math.random() * CAPTIONS.length); } while (i === lastCaption && CAPTIONS.length > 1);
  lastCaption = i;
  return CAPTIONS[i];
}

async function rollCaptions() {
  const dice = $('dice');
  dice.classList.remove('is-rolling');
  void dice.offsetWidth;
  dice.classList.add('is-rolling');
  if (!active()) {
    await loadStarter(pick(STARTERS.filter((s) => s.captions)));
    return;
  }
  geo = geometry(doc, assets.get(doc.base).img);
  let texts = doc.layers.filter((l) => l.type === 'text');
  if (!texts.length) {
    arrangeLayout(doc, geo);
    texts = doc.layers.filter((l) => l.type === 'text');
    if (!texts.length) {
      doc.layout = 'classic';
      arrangeLayout(doc, geo);
      texts = doc.layers.filter((l) => l.type === 'text');
    }
  }
  const pair = nextCaption();
  if (texts.length === 1) texts[0].text = pair.join(' ');
  else texts.forEach((t, i) => { t.text = i < 2 ? pair[i] : t.text; });
  commit();
  renderLayers();
  renderInspector();
  requestRender();
  popBoard();
}

// ---------- Effects ----------

let presetThumbKey = '';
function buildEffects() {
  const presets = $('presets');
  PRESETS.forEach((p) => {
    const b = el('button', 'preset');
    b.type = 'button';
    b.dataset.preset = p.id;
    const thumb = el('span', 'preset__thumb');
    thumb.appendChild(el('em', '', p.emoji));
    b.append(thumb, el('span', '', p.label));
    b.addEventListener('click', async () => {
      if (!active()) { toast('Add a picture first, then pick a look.'); return; }
      doc.filters = { ...FILTER_DEFAULTS, ...p.values };
      commit();
      syncEffects();
      requestRender();
      if (p.values.deepfry) await busyFor('Heating the oil…', 500);
    });
    presets.appendChild(b);
  });

  const sliders = $('filterSliders');
  FILTER_SLIDERS.forEach((f) => {
    const label = el('label', 'slider' + (f.hot ? ' is-hot' : ''));
    const input = el('input');
    input.type = 'range';
    input.min = f.min; input.max = f.max; input.step = 1;
    input.dataset.filter = f.id;
    label.append(el('span', '', f.label), input, el('output', '', '0'));
    input.addEventListener('input', () => {
      if (!active()) return;
      doc.filters[f.id] = parseFloat(input.value);
      liveFilters = true;
      setFill(input);
      label.querySelector('output').textContent = input.value;
      requestRender();
    });
    input.addEventListener('change', () => {
      liveFilters = false;
      commit();
      syncEffects();
      requestRender();
    });
    sliders.appendChild(label);
  });

  $('resetFilters').addEventListener('click', () => {
    doc.filters = { ...FILTER_DEFAULTS };
    commit();
    syncEffects();
    requestRender();
  });
  const turn = (fn) => () => { if (!active()) return; fn(); commit(); requestRender(); popBoard(); presetThumbKey = ''; if (currentTab === 'effects') buildPresetThumbs(); };
  $('rotL').addEventListener('click', turn(() => { doc.rotate = (doc.rotate + 270) % 360; }));
  $('rotR').addEventListener('click', turn(() => { doc.rotate = (doc.rotate + 90) % 360; }));
  $('flipH').addEventListener('click', turn(() => { doc.flipX = !doc.flipX; }));
  $('flipV').addEventListener('click', turn(() => { doc.flipY = !doc.flipY; }));
}

function syncEffects() {
  $('filterSliders').querySelectorAll('input').forEach((input) => {
    const v = doc.filters[input.dataset.filter] || 0;
    input.value = v;
    setFill(input);
    input.parentElement.querySelector('output').textContent = v;
  });
  const sameAs = (p) => Object.keys(FILTER_DEFAULTS).every((k) => (doc.filters[k] || 0) === ({ ...FILTER_DEFAULTS, ...p.values }[k] || 0));
  $('presets').querySelectorAll('[data-preset]').forEach((b) => {
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    b.setAttribute('aria-pressed', String(sameAs(p)));
  });
}

async function buildPresetThumbs() {
  if (!active()) return;
  const key = [doc.base, doc.rotate, doc.flipX, doc.flipY].join('|');
  if (key === presetThumbKey) return;
  presetThumbKey = key;
  const img = assets.get(doc.base).img;
  const turned = doc.rotate % 180 !== 0;
  const sw = turned ? img.height : img.width; const sh = turned ? img.width : img.height;
  const k = 160 / Math.min(sw, sh);
  const w = Math.round(sw * k); const h = Math.round(sh * k);
  for (const b of $('presets').querySelectorAll('[data-preset]')) {
    if (presetThumbKey !== key) return;
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    const c = await processPicture(img, { ...doc, filters: { ...FILTER_DEFAULTS, ...p.values } }, w, h, { quick: true });
    const thumb = b.querySelector('.preset__thumb');
    let im = thumb.querySelector('img');
    if (!im) { im = el('img'); im.alt = ''; thumb.prepend(im); }
    im.src = c.toDataURL('image/jpeg', 0.8);
  }
}

// ---------- Layout ----------

const LAYOUT_SIZE = { top: 0.26, bottom: 0.26, both: 0.22, poster: 0.34, polaroid: 0.24, border: 0.14 };

function miniFor(id) {
  const m = el('span', 'mini' + (id === 'classic' || id === 'free' ? ' mini--' + id : ''));
  const box = (style) => { const i = el('i'); i.style.cssText = 'position:absolute;' + style; m.appendChild(i); };
  const bar = (style) => { const s = el('s'); s.style.cssText = style; m.appendChild(s); };
  switch (id) {
    case 'classic': box('inset:0'); bar('top:8px'); bar('bottom:8px'); break;
    case 'top': box('left:0;right:0;bottom:0;top:16px'); bar('top:6px'); break;
    case 'bottom': box('left:0;right:0;top:0;bottom:16px'); bar('bottom:6px'); break;
    case 'both': box('left:0;right:0;top:13px;bottom:13px'); bar('top:4px'); bar('bottom:4px'); break;
    case 'poster': m.style.background = '#000'; box('left:7px;right:7px;top:6px;bottom:18px;outline:1px solid #fff;outline-offset:1px'); bar('bottom:7px;background:#fff;left:24%;right:24%'); break;
    case 'polaroid': box('left:4px;right:4px;top:4px;bottom:15px'); bar('bottom:5px;left:28%;right:28%;background:#555'); break;
    case 'border': m.style.background = '#ffc93c'; box('inset:6px'); break;
    default: box('inset:0'); break;
  }
  return m;
}

function buildLayout() {
  const wrap = $('layouts');
  LAYOUTS.forEach((ly) => {
    const b = el('button', 'layoutbtn');
    b.type = 'button';
    b.dataset.layout = ly.id;
    const text = el('span');
    text.append(el('b', '', ly.label), el('small', '', ly.hint));
    b.append(miniFor(ly.id), text);
    b.addEventListener('click', () => setLayout(ly.id));
    wrap.appendChild(b);
  });
  const colors = $('frameColors');
  FRAME_COLORS.forEach((c) => colors.appendChild(swatch(c, { onPick: (v) => setFrameColor(v, false) })));
  colors.appendChild(swatch(null, { custom: true, onPick: (v, live) => setFrameColor(v, live) }));
  const size = $('frameSize');
  size.addEventListener('input', () => {
    if (!active()) return;
    doc.frame.size = parseFloat(size.value);
    setFill(size);
    size.parentElement.querySelector('output').textContent = Math.round(doc.frame.size * 100) + '%';
    geo = geometry(doc, assets.get(doc.base).img);
    arrangeLayout(doc, geo, { create: false, positionsOnly: true });
    requestRender();
  });
  size.addEventListener('change', commit);
}

async function setLayout(id) {
  if (!active()) { await needCanvas(); }
  const prev = doc.layout;
  doc.layout = id;
  if (LAYOUT_SIZE[id]) doc.frame.size = LAYOUT_SIZE[id];
  if (id === 'poster') doc.frame.color = '#000000';
  else if (prev === 'poster' && doc.frame.color === '#000000') doc.frame.color = '#ffffff';
  geo = geometry(doc, assets.get(doc.base).img);
  arrangeLayout(doc, geo);
  commit();
  refreshAll();
  popBoard();
}

function setFrameColor(color, live) {
  if (!active()) return;
  const oldInk = frameInk(doc.frame.color);
  const newInk = frameInk(color);
  doc.frame.color = color;
  if (geo) {
    const barTop = geo.pad.top / geo.H; const barBottom = 1 - geo.pad.bottom / geo.H;
    doc.layers.forEach((l) => {
      const inFrame = l.y < barTop || l.y > barBottom;
      if (l.type === 'text' && inFrame && l.fill === oldInk) l.fill = newInk;
    });
  }
  requestRender();
  syncLayout();
  if (live) commitSoon(); else commit();
}

function syncLayout() {
  pressAll($('layouts'), 'data-layout', doc.layout);
  const framed = !['classic', 'free'].includes(doc.layout);
  $('frameCtl').hidden = !framed;
  pressAll($('frameColors'), 'data-color', doc.frame.color);
  const size = $('frameSize');
  size.value = doc.frame.size;
  setFill(size);
  size.parentElement.querySelector('output').textContent = Math.round(doc.frame.size * 100) + '%';
}

// ---------- Stickers tab ----------

function buildStickers() {
  const cats = $('stickerCats');
  const grid = $('stickerGrid');
  const show = (name) => {
    pressAll(cats, 'data-cat', name);
    grid.textContent = '';
    STICKERS[name].forEach((e, i) => {
      const b = el('button', 'stk', e);
      b.type = 'button';
      b.style.setProperty('--i', i);
      b.setAttribute('aria-label', 'Add ' + e);
      b.addEventListener('click', () => addSticker(e));
      grid.appendChild(b);
    });
  };
  Object.keys(STICKERS).forEach((name, i) => {
    const b = el('button', 'chip', name);
    b.type = 'button';
    b.dataset.cat = name;
    const [c, d] = CANDY[(i + 3) % CANDY.length];
    b.style.setProperty('--chip', c);
    b.style.setProperty('--chip-side', d);
    b.addEventListener('click', () => show(name));
    cats.appendChild(b);
  });
  show('Faces');
}

// ---------- Export ----------

async function finalCanvas(type) {
  liveFilters = false;
  renderNow();
  await picturePromise;
  renderNow();
  if (type !== 'image/jpeg') return canvas;
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

async function exportBlob(type = 'image/png') {
  const c = await finalCanvas(type);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, 0.92));
}

function fileName(ext) {
  const first = doc.layers.find((l) => l.type === 'text' && l.text.trim());
  const slug = first ? first.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) : '';
  return 'toptext' + (slug ? '-' + slug : '') + '.' + ext;
}

function thumbnail(max = 360) {
  const k = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

function project() {
  const ids = new Set([doc.base, ...doc.layers.filter((l) => l.type === 'picture').map((l) => l.asset)]);
  const out = {};
  ids.forEach((id) => { if (assets.has(id)) out[id] = assets.get(id).src; });
  return { doc: JSON.parse(snapshot()), assets: out };
}

async function openProject(p) {
  for (const [id, src] of Object.entries(p.assets || {})) await addAsset(src, id);
  doc = { ...newDoc(), ...p.doc, filters: { ...FILTER_DEFAULTS, ...(p.doc.filters || {}) } };
  selectedId = null;
  pictureKey = '';
  presetThumbKey = '';
}

async function cook(promise) {
  const box = $('cooking');
  const bar = $('cookingBar');
  const line = $('cookingLine');
  const paper = $('cookingThumb');
  paper.src = thumbnail(320);
  paper.style.setProperty('--p', 0);
  bar.style.width = '0%';
  box.hidden = false;
  const lines = LOADING_LINES.slice().sort(() => Math.random() - 0.5);
  line.textContent = lines[0];
  const total = 1500 + Math.random() * 600;
  const t0 = performance.now();
  let li = 0;
  await new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min(1, (now - t0) / total);
      const eased = 1 - Math.pow(1 - t, 2.2);
      bar.style.width = Math.round(eased * 100) + '%';
      paper.style.setProperty('--p', eased.toFixed(3));
      const want = Math.min(lines.length - 1, Math.floor(t * 3.2));
      if (want !== li) { li = want; line.textContent = lines[li]; line.style.animation = 'none'; void line.offsetWidth; line.style.animation = ''; }
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  try {
    return await promise;
  } finally {
    line.textContent = 'Done!';
    await wait(250);
    box.hidden = true;
  }
}

async function download() {
  if (!active()) { toast('Add a picture first.'); return; }
  const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  try {
    const blob = await cook(exportBlob(type));
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName(format === 'jpeg' ? 'jpg' : 'png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    confetti($('download'));
    await saveToStack({ quiet: true });
    toast('Downloaded! A copy is in your Stack too.');
  } catch {
    toast("Something went wrong saving that. Try again?", { error: true });
  }
}

async function copyImage() {
  if (!active()) return;
  showBusy('Copying…');
  try {
    const [blob] = await Promise.all([exportBlob('image/png'), wait(450)]);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Copied! Paste it anywhere.');
    confetti($('copyImage'), 40);
  } catch {
    toast("Your browser wouldn't let us copy. Use Download instead.", { error: true });
  } finally {
    hideBusy();
  }
}

async function shareImage() {
  if (!active()) return;
  showBusy('Getting it ready…');
  try {
    const blob = await exportBlob('image/png');
    hideBusy();
    const file = new File([blob], fileName('png'), { type: 'image/png' });
    await navigator.share({ files: [file], title: 'Made with Toptext' });
  } catch (err) {
    if (busyCount) hideBusy();
    if (err && err.name !== 'AbortError') toast("Sharing didn't work here. Try Download.", { error: true });
  }
}

async function saveToStack({ quiet = false } = {}) {
  if (!active()) return;
  if (!quiet) showBusy('Stacking…');
  try {
    if (!quiet) await wait(450);
    await finalCanvas('image/png');
    await addToStack({ id: uid('k'), ts: Date.now(), thumb: thumbnail(), project: project() });
    await refreshStackCount(true);
    if (!quiet) toast('Saved to your Stack.');
  } catch {
    if (!quiet) toast("Couldn't save to your Stack. Storage might be full.", { error: true });
  } finally {
    if (!quiet) hideBusy();
  }
}

async function refreshStackCount(bump = false) {
  const items = await listStack();
  $('stackCount').textContent = items.length;
  if (bump) {
    const b = $('stackOpen');
    b.classList.remove('is-bumped');
    void b.offsetWidth;
    b.classList.add('is-bumped');
  }
  return items;
}

async function openStack() {
  const dialog = $('stackDialog');
  const grid = $('stackGrid');
  const items = await refreshStackCount();
  grid.textContent = '';
  $('stackEmpty').hidden = items.length > 0;
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  items.forEach((item, i) => {
    const card = el('div', 'stackitem');
    card.style.setProperty('--i', i);
    const open = el('button', 'stackitem__open');
    open.type = 'button';
    open.title = 'Keep editing';
    const img = el('img');
    img.src = item.thumb;
    img.alt = 'Saved picture';
    img.loading = 'lazy';
    open.appendChild(img);
    open.addEventListener('click', async () => {
      dialog.close();
      showBusy('Unstacking…');
      try {
        await Promise.all([openProject(item.project), wait(400)]);
        commit();
        refreshAll();
        popBoard();
        toast('Back on the table. Keep going!');
      } finally {
        hideBusy();
      }
    });
    const row = el('div', 'stackitem__row');
    row.appendChild(el('span', '', fmt.format(item.ts)));
    const btns = el('div');
    const del = el('button');
    del.type = 'button';
    del.title = 'Remove from Stack';
    del.setAttribute('aria-label', 'Remove from Stack');
    del.appendChild(icon('i-trash'));
    del.addEventListener('click', async () => {
      await removeFromStack(item.id);
      card.remove();
      const left = await refreshStackCount();
      $('stackEmpty').hidden = left.length > 0;
    });
    btns.appendChild(del);
    row.appendChild(btns);
    card.append(open, row);
    grid.appendChild(card);
  });
  if (!dialog.open) dialog.showModal();
}

// ---------- Confetti ----------

function confetti(from, count = 140) {
  const c = $('confetti');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const r = from ? from.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const ox = r.left + r.width / 2; const oy = r.top + r.height / 2;
  const colors = CANDY.map((p) => p[0]).concat(['#ffffff']);
  const bits = Array.from({ length: count }, () => ({
    x: ox, y: oy,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 6,
    w: 6 + Math.random() * 7, h: 8 + Math.random() * 10,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    c: pick(colors), life: 0,
  }));
  const t0 = performance.now();
  const step = (now) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const t = now - t0;
    bits.forEach((b) => {
      b.vy += 0.45; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.scale(1, Math.cos(t / 90 + b.r));
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    });
    if (t < 2600) requestAnimationFrame(step); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(step);
}

// ---------- Hero ----------

function buildHero() {
  const art = $('titleArt');
  Array.from('Toptext').forEach((ch, i) => {
    const letter = el('span', 'letter', ch);
    const [c, d] = CANDY[(i + 2) % CANDY.length];
    letter.style.setProperty('--c', c);
    letter.style.setProperty('--d', d);
    letter.style.setProperty('--i', i);
    letter.style.setProperty('--tw', (i % 2 ? 2.6 : -2.6) + 'deg');
    const boing = () => {
      letter.classList.remove('is-boing');
      void letter.offsetWidth;
      letter.classList.add('is-boing');
    };
    letter.addEventListener('pointerenter', boing);
    letter.addEventListener('animationend', (e) => { if (e.animationName === 'boing') letter.classList.remove('is-boing'); });
    art.appendChild(letter);
  });

  const floaters = [
    [5, 14, '2.4rem', 9, '😂'], [13, 64, '1.9rem', 11, '🔥'], [24, 10, '1rem', 8, 'TOP TEXT', 'tag'],
    [8, 82, '.95rem', 10, 'me at 2am', 'bubble'], [82, 12, '2.2rem', 9.5, '💀'], [91, 60, '2rem', 12, '🗿'],
    [74, 72, '1rem', 8.5, 'BOTTOM TEXT', 'tag'], [94, 22, '1.7rem', 10.5, '✨'], [30, 80, '1.6rem', 9.5, '👀'],
    [66, 6, '.95rem', 11.5, 'pov:', 'bubble'], [52, 88, '1.5rem', 10, '💯'],
  ];
  const wrap = $('heroFloaters');
  floaters.forEach(([x, y, s, t, content, kind], i) => {
    const f = el('span', 'floater' + (kind ? ' floater--' + kind : ''), content);
    f.style.setProperty('--x', x + '%');
    f.style.setProperty('--y', y + '%');
    f.style.setProperty('--s', s);
    f.style.setProperty('--t', t + 's');
    f.style.setProperty('--w', -i * 1.3 + 's');
    f.style.setProperty('--r0', ((i % 3) - 1) * 10 + 'deg');
    f.style.setProperty('--c', CANDY[i % CANDY.length][0]);
    wrap.appendChild(f);
  });

  const track = $('ribbonTrack');
  const set = el('div', 'ribbon__set');
  for (let i = 0; i < 2; i++) {
    RIBBON_WORDS.forEach((w) => {
      set.appendChild(el('span', 'ribbon__word', w));
      set.appendChild(el('span', 'ribbon__star', '✦'));
    });
  }
  track.appendChild(set);
  track.appendChild(set.cloneNode(true));
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  const typing = !!(e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]'));
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (typing) e.target.blur();
    else if (selectedId) select(null);
    return;
  }
  if (mod && (e.key === 's' || e.key === 'S')) { e.preventDefault(); download(); return; }
  if (typing || document.querySelector('dialog[open]')) return;
  if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
  if (mod && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
  if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateLayer(); return; }
  if (mod || e.altKey) return;
  if (e.key === 't' || e.key === 'T') { e.preventDefault(); addText(); return; }
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rollCaptions(); return; }
  const layer = selected();
  if (!layer) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteLayer(); return; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key] && geo) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    layer.x += (arrows[e.key][0] * step) / geo.W;
    layer.y += (arrows[e.key][1] * step) / geo.H;
    requestRender();
    commitSoon();
  }
});

// ---------- Draft autosave ----------

let draftTimer = 0;
function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (active()) saveDraft(project());
    else clearDraft();
  }, 900);
}

// ---------- Wiring ----------

function wire() {
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('addText').addEventListener('click', () => addText());
  $('addSticker').addEventListener('click', () => openTab('stickers'));
  $('dice').addEventListener('click', rollCaptions);
  $('newDoc').addEventListener('click', () => {
    if (!active()) return;
    doc = newDoc();
    selectedId = null;
    commit();
    refreshAll();
    openTab('start');
    toast('Fresh start!', { action: { label: 'Undo', run: undo } });
  });

  document.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => {
    format = b.dataset.format;
    document.querySelectorAll('[data-format]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  }));
  $('download').addEventListener('click', download);
  $('copyImage').addEventListener('click', copyImage);
  $('saveStack').addEventListener('click', () => saveToStack());
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) {
      $('shareImage').hidden = false;
      $('shareImage').addEventListener('click', shareImage);
    }
  } catch { /* sharing files isn't supported here */ }
  if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) $('copyImage').hidden = true;

  $('stackOpen').addEventListener('click', openStack);
  $('shortcutsOpen').addEventListener('click', () => $('shortcutsDialog').showModal());
  document.querySelectorAll('dialog').forEach((d) => {
    d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  });

  if (document.fonts) document.fonts.addEventListener('loadingdone', requestRender);
  if ('ResizeObserver' in window) new ResizeObserver(() => { fitCanvas(); updateOverlay(); }).observe($('stage'));
}

async function boot() {
  buildHero();
  buildInspector();
  buildStart();
  buildStickers();
  buildEffects();
  buildLayout();
  wire();
  refreshStackCount();

  // A short warm-up, mostly for the fun of it.
  const lines = LOADING_LINES.slice().sort(() => Math.random() - 0.5);
  $('bootLine').textContent = lines[0];
  const timer = setInterval(() => { $('bootLine').textContent = lines[(lines.indexOf($('bootLine').textContent) + 1) % lines.length]; }, 420);
  const [draft] = await Promise.all([loadDraft(), wait(1100)]);
  clearInterval(timer);

  if (draft && draft.doc && draft.doc.base) {
    try {
      await openProject(draft);
      resetHistory();
      toast('Welcome back! Picked up where you left off.', {
        action: { label: 'Start fresh', run: () => { doc = newDoc(); selectedId = null; commit(); refreshAll(); openTab('start'); } },
        ms: 5000,
      });
      openTab('words');
    } catch {
      doc = newDoc();
    }
  }
  refreshAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRender);
}

boot();
