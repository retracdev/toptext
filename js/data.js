// Static content for Toptext: fonts, colors, stickers, caption ideas, effect presets, layouts and starters.

// The Toptext print-shop inks: [color, darker edge].
export const INKS = [
  ['#ffe14d', '#b89a00'], ['#ff4a3d', '#a8221a'], ['#3d7bff', '#1d47b8'],
  ['#2fe0a0', '#11946a'], ['#ff8a1f', '#b35400'], ['#f5efe0', '#a39b8a'],
];

// `family` is what the canvas draws with. Fonts from Google load on first use.
export const FONTS = [
  { id: 'classic', label: 'Classic', family: 'Impact, Anton, "Arial Narrow", sans-serif', weight: '400' },
  { id: 'plain', label: 'Plain', family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weight: '700' },
  { id: 'bagel', label: 'Bagel', family: '"Bagel Fat One", sans-serif', weight: '400' },
  { id: 'grotesk', label: 'Grotesk', family: '"Space Grotesk", sans-serif', weight: '700' },
  { id: 'bangers', label: 'Kapow', family: 'Bangers, Impact, sans-serif', weight: '400' },
  { id: 'marker', label: 'Marker', family: '"Permanent Marker", cursive', weight: '400' },
  { id: 'comic', label: 'Comic', family: '"Comic Neue", "Comic Sans MS", cursive', weight: '700' },
  { id: 'bebas', label: 'Tall', family: '"Bebas Neue", Impact, sans-serif', weight: '400' },
  { id: 'archivo', label: 'Chunky', family: '"Archivo Black", "Arial Black", sans-serif', weight: '400' },
  { id: 'oswald', label: 'Narrow', family: 'Oswald, "Arial Narrow", sans-serif', weight: '700' },
  { id: 'serif', label: 'Fancy', family: '"DM Serif Display", Georgia, serif', weight: '400' },
  { id: 'pacifico', label: 'Retro', family: 'Pacifico, cursive', weight: '400' },
  { id: 'hand', label: 'Scribble', family: 'Caveat, cursive', weight: '700' },
  { id: 'pixel', label: 'Pixel', family: '"Press Start 2P", monospace', weight: '400' },
  { id: 'creepy', label: 'Spooky', family: 'Creepster, cursive', weight: '400' },
];
export const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

export const SOLIDS = [
  '#ffffff', '#000000', '#f3f0ff', '#8b86a3', '#ff4d4d', '#ff8360', '#ffc93c', '#fff36b',
  '#93e571', '#35d6c8', '#4da3ff', '#ab8fff', '#ff7eb6', '#7a4b2a',
];

// Gradient fills, referenced as "grad:<id>".
export const GRADIENTS = [
  { id: 'rainbow', label: 'Rainbow', dir: 'x', stops: ['#ff4d4d', '#ffc93c', '#93e571', '#35d6c8', '#4da3ff', '#ab8fff', '#ff7eb6'] },
  { id: 'fire', label: 'Fire', dir: 'y', stops: ['#fff36b', '#ffb020', '#ff4d1a', '#c4140c'] },
  { id: 'ocean', label: 'Ocean', dir: 'y', stops: ['#b8fff4', '#35d6c8', '#2a6cff'] },
  { id: 'candy', label: 'Candy', dir: 'x', stops: ['#ff7eb6', '#ab8fff', '#35d6c8'] },
  { id: 'gold', label: 'Gold', dir: 'y', stops: ['#fff7c2', '#ffd34d', '#c78a12', '#fff0a0'] },
  { id: 'toxic', label: 'Toxic', dir: 'y', stops: ['#eaff6b', '#5cff3d', '#0b9f4c'] },
  { id: 'sunset', label: 'Sunset', dir: 'y', stops: ['#ffd36b', '#ff6f91', '#7b4bff'] },
  { id: 'chrome', label: 'Chrome', dir: 'y', stops: ['#ffffff', '#c9cfe0', '#5a607a', '#e6ebff', '#9aa2bf'] },
];

export const EFFECTS = [
  { id: 'none', label: 'None' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'extrude', label: '3D' },
  { id: 'glow', label: 'Glow' },
  { id: 'neon', label: 'Neon' },
];

export const BOXES = [
  { id: 'none', label: 'None' },
  { id: 'box', label: 'Box' },
  { id: 'lines', label: 'Highlight' },
  { id: 'pill', label: 'Pill' },
  { id: 'bubble', label: 'Bubble' },
];

export const STICKERS = {
  Faces: ['😂', '🤣', '😭', '💀', '😎', '🥹', '😳', '🤨', '😐', '🫠', '🙃', '😤', '🤡', '🥴', '😈', '🤯', '🥶', '🥵', '😬', '🫡', '🤓', '🧐', '😴', '🤔', '😏', '🙄', '🗿', '👀'],
  Hands: ['👍', '👎', '👌', '🤌', '👏', '🙌', '🙏', '💪', '🫵', '👉', '👈', '☝️', '✌️', '🤞', '🤷', '🤦', '💅', '🫶'],
  Things: ['🔥', '💯', '✨', '💥', '💫', '⭐', '🌈', '☀️', '🌧️', '⚡', '💸', '🍕', '🍟', '🌮', '☕', '🧃', '🎉', '🎂', '🏆', '👑', '💎', '🧠', '🫀', '🚀', '🛸', '🦆', '🐸', '🐈', '🐶', '🦖', '🍌', '🥔'],
  Signs: ['❗', '❓', '‼️', '⁉️', '💢', '💤', '💬', '🗯️', '❌', '✅', '⛔', '⚠️', '🆗', '🆒', '🆕', '🔞', '➡️', '⬅️', '⬆️', '⬇️', '🔴', '🟢', '❤️', '💔'],
};

// Top and bottom pairs for the caption dice.
export const CAPTIONS = [
  ['when the wifi drops for 0.2 seconds', 'and you lose everything'],
  ['pov:', 'you said "one more episode"'],
  ['me explaining my plan', 'the plan: 🤷'],
  ['my last two brain cells', 'fighting for third place'],
  ['when the code works', "and you don't know why"],
  ['nobody:', 'me at 2am:'],
  ["they said it couldn't be done", 'they were right'],
  ['teacher: the test will be easy', 'the test:'],
  ['me pretending to understand', 'the group chat'],
  ['just one more', '(it was not one more)'],
  ['my brain at 3am', 'remember that thing from 2014?'],
  ['the group chat at 2am', '47 new messages'],
  ['someone: "quick question"', 'the question: not quick'],
  ['we have food at home', 'the food at home:'],
  ["i'm not lazy", "i'm in energy saving mode"],
  ['me: does literally nothing', 'also me: i need a break'],
  ['when you hit send', 'and see the typo'],
  ['day 1 of being productive', 'starting tomorrow'],
  ['my bank account', 'after one coffee'],
  ['me after one gym session', 'checking the mirror every 5 minutes'],
  ['when the teacher says', '"find a partner"'],
  ['me: i should sleep', 'my brain: what if ducks had arms'],
  ['the face you make', 'when it says "low battery" at 80%'],
  ['main character energy', 'side character budget'],
  ['me, a genius:', 'pushes door that says pull'],
  ['monday', 'again??'],
  ['how it started', 'how it\'s going'],
  ['me watching the loading bar', 'at 99% for 10 minutes'],
  ['i came here to have a good time', 'and honestly i\'m feeling so attacked'],
  ['this is fine', 'everything is fine'],
];

// Effect presets set every image filter value at once.
export const FILTER_DEFAULTS = {
  brightness: 0, contrast: 0, saturate: 0, hue: 0, warmth: 0, blur: 0,
  noise: 0, pixelate: 0, vignette: 0, rgbsplit: 0, deepfry: 0, grayscale: 0, sepia: 0, invert: 0,
};

export const FILTER_SLIDERS = [
  { id: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { id: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { id: 'saturate', label: 'Saturation', min: -100, max: 100 },
  { id: 'hue', label: 'Hue shift', min: -180, max: 180 },
  { id: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { id: 'blur', label: 'Blur', min: 0, max: 100 },
  { id: 'noise', label: 'Grain', min: 0, max: 100 },
  { id: 'pixelate', label: 'Pixelate', min: 0, max: 100 },
  { id: 'vignette', label: 'Vignette', min: 0, max: 100 },
  { id: 'rgbsplit', label: 'RGB split', min: 0, max: 100 },
  { id: 'deepfry', label: 'Deep fry', min: 0, max: 100, hot: true },
];

export const PRESETS = [
  { id: 'original', label: 'Original', emoji: '🖼️', values: {} },
  { id: 'fried', label: 'Deep fried', emoji: '🍟', values: { deepfry: 70, saturate: 40, contrast: 25, noise: 20 } },
  { id: 'nuclear', label: 'Nuclear', emoji: '☢️', values: { deepfry: 100, saturate: 90, contrast: 60, noise: 45, rgbsplit: 35, vignette: 40 } },
  { id: 'vintage', label: 'Vintage', emoji: '📼', values: { sepia: 55, contrast: -12, noise: 30, vignette: 55, warmth: 20 } },
  { id: 'noir', label: 'Noir', emoji: '🎩', values: { grayscale: 100, contrast: 35, vignette: 60, noise: 15 } },
  { id: 'vapor', label: 'Vapor', emoji: '🌴', values: { hue: -40, saturate: 45, rgbsplit: 30, contrast: 10, warmth: -20 } },
  { id: 'cursed', label: 'Cursed', emoji: '👁️', values: { invert: 100, hue: 180, contrast: 20, noise: 25 } },
  { id: 'potato', label: 'Potato', emoji: '🥔', values: { pixelate: 40, noise: 35, saturate: -20, deepfry: 25 } },
  { id: 'dream', label: 'Dreamy', emoji: '☁️', values: { blur: 18, brightness: 18, saturate: 20, vignette: 25, warmth: 15 } },
  { id: 'arcade', label: 'Arcade', emoji: '🕹️', values: { pixelate: 22, saturate: 60, contrast: 30 } },
  { id: 'cold', label: 'Frozen', emoji: '🧊', values: { warmth: -80, brightness: 8, saturate: -10 } },
  { id: 'sunny', label: 'Golden', emoji: '🌅', values: { warmth: 60, saturate: 25, brightness: 6, vignette: 20 } },
];

export const LAYOUTS = [
  { id: 'classic', label: 'Classic', hint: 'Words on the picture' },
  { id: 'top', label: 'Top bar', hint: 'A caption above' },
  { id: 'bottom', label: 'Bottom bar', hint: 'A caption below' },
  { id: 'both', label: 'Sandwich', hint: 'Bars above and below' },
  { id: 'poster', label: 'Poster', hint: 'Framed, with a title' },
  { id: 'polaroid', label: 'Instant', hint: 'A snapshot frame' },
  { id: 'border', label: 'Border', hint: 'An even frame' },
  { id: 'free', label: 'Freestyle', hint: 'Just the picture' },
];

export const FRAME_COLORS = ['#ffffff', '#000000', '#f3f0ff', '#14111f', '#ffc93c', '#ff7eb6', '#35d6c8', '#ab8fff', '#ff8360', '#93e571'];

export const BLANK_SIZES = [
  { id: 'square', label: 'Square', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Tall', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide', w: 1600, h: 900 },
  { id: 'story', label: 'Story', w: 1080, h: 1920 },
];

export const LOADING_LINES = [
  'Kerning the punchline…',
  'Thickening the outlines…',
  'Consulting the group chat…',
  'Calibrating the funny…',
  'Polishing every pixel…',
  'Adding extra crunch…',
  'Asking the cat for notes…',
  'Centering the vibes…',
  'Warming up the letters…',
  'Rendering at maximum giggle…',
];

export const RIBBON_WORDS = [
  'top text', 'bottom text', 'pov:', 'nobody:', 'me at 2am', 'deep fried', 'add a sticker', 'big words',
  'small words', 'caption everything', 'outline it', 'this is fine', 'how it started', 'make it funny',
];
