// The document: what's in a creation, and how layouts place their captions.
import { FILTER_DEFAULTS } from './data.js';

let counter = 0;
export const uid = (p = 'l') => p + Date.now().toString(36) + (counter++).toString(36);

export function newDoc() {
  return {
    v: 1,
    base: null, // asset id of the picture
    layout: 'classic',
    frame: { color: '#ffffff', size: 0.26 },
    rotate: 0, flipX: false, flipY: false,
    filters: { ...FILTER_DEFAULTS },
    layers: [],
  };
}

const COMMON = { x: 0.5, y: 0.5, anchor: 'middle', rot: 0, opacity: 1, hidden: false, effect: 'none' };

export function textLayer(o = {}) {
  return {
    ...COMMON,
    id: uid('t'), type: 'text', text: 'your words here',
    w: 0.9, size: 0.08, font: 'classic', fill: '#ffffff', stroke: '#000000', strokeW: 0.14,
    align: 'center', caps: true, box: 'none', boxColor: '#000000', boxOpacity: 0.85,
    spacing: 0, lineHeight: 1.08,
    ...o,
  };
}

export function stickerLayer(o = {}) {
  return { ...COMMON, id: uid('s'), type: 'sticker', emoji: '😂', size: 0.22, flip: false, ...o };
}

export function pictureLayer(o = {}) {
  return { ...COMMON, id: uid('p'), type: 'picture', asset: null, size: 0.4, flip: false, ...o };
}

export function makeLayer(spec) {
  if (spec.type === 'sticker') return stickerLayer(spec);
  if (spec.type === 'picture') return pictureLayer(spec);
  return textLayer(spec);
}

function ink(hex) {
  const n = parseInt((hex || '#ffffff').slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.55 ? '#000000' : '#ffffff';
}

const CLASSIC = { font: 'classic', fill: '#ffffff', stroke: '#000000', strokeW: 0.14, caps: true, effect: 'none', box: 'none', align: 'center', spacing: 0, lineHeight: 1.05, rot: 0 };

// Where each layout puts its captions, in canvas fractions. Needs the frame geometry.
function slots(layout, geo, frameColor) {
  const { W, H, img, pad } = geo;
  const fx = (v) => v / W; const fy = (v) => v / H;
  const onTop = { ...CLASSIC, x: fx(img.x + img.w / 2), y: fy(img.y + img.h * 0.03), anchor: 'top', w: fx(img.w * 0.94), size: fx(img.w * 0.095) };
  const onBottom = { ...onTop, y: fy(img.y + img.h * 0.97), anchor: 'bottom' };
  const bar = { font: 'plain', fill: ink(frameColor), strokeW: 0, caps: false, effect: 'none', box: 'none', align: 'center', spacing: 0, lineHeight: 1.12, rot: 0, anchor: 'middle', x: 0.5, w: fx(img.w * 0.92), size: fx(img.w * 0.062) };
  const topBar = { ...bar, y: fy(pad.top / 2) };
  const bottomBar = { ...bar, y: fy(img.y + img.h + pad.bottom / 2) };
  switch (layout) {
    case 'classic':
    case 'border':
      return [{ ...onTop, defaultText: 'top text' }, { ...onBottom, defaultText: 'bottom text' }];
    case 'top':
      return [{ ...topBar, defaultText: 'when you finally find the perfect picture' }, { ...onBottom, defaultText: '', optional: true }];
    case 'bottom':
      return [{ ...bottomBar, defaultText: 'and that was the last time anyone saw him' }, { ...onTop, defaultText: '', optional: true }];
    case 'both':
      return [{ ...topBar, defaultText: 'top text' }, { ...bottomBar, defaultText: 'bottom text' }];
    case 'poster': {
      const base = img.y + img.h;
      return [
        { ...bar, font: 'serif', caps: true, spacing: 0.06, y: fy(base + pad.bottom * 0.4), size: fx(img.w * 0.085), defaultText: 'ambition' },
        { ...bar, font: 'grotesk', y: fy(base + pad.bottom * 0.72), size: fx(img.w * 0.034), defaultText: 'the journey of a thousand naps begins with a single yawn.' },
      ];
    }
    case 'polaroid':
      return [{ ...bar, font: 'hand', fill: ink(frameColor) === '#000000' ? '#26222f' : '#ffffff', y: fy(img.y + img.h + pad.bottom / 2), size: fx(img.w * 0.075), defaultText: 'best day ever (not clickbait)' }];
    default:
      return [];
  }
}

// Places existing captions into the layout's slots, restyling them. Creates captions only when there are none.
export function arrangeLayout(doc, geo, { create = true, positionsOnly = false } = {}) {
  const list = slots(doc.layout, geo, doc.frame.color);
  if (!list.length) return;
  const texts = doc.layers.filter((l) => l.type === 'text');
  if (!texts.length && create) {
    list.filter((s) => !s.optional).forEach((s) => {
      const { defaultText, optional, ...style } = s;
      doc.layers.push(textLayer({ ...style, text: defaultText }));
    });
    return;
  }
  texts.slice(0, list.length).forEach((layer, i) => {
    const { defaultText, optional, ...style } = list[i];
    if (positionsOnly) Object.assign(layer, { x: style.x, y: style.y, anchor: style.anchor });
    else Object.assign(layer, style);
  });
}

export function frameInk(color) { return ink(color); }
