// Source of the app logo: three ascending rounded bars, a steady rhythm that climbs (cadence). Silver bars, the
// tallest in champagne, on a graphite-black field.
// `render.mjs` writes these SVGs next to this file and renders them to the PNGs app.json points at.

const FIELD = { top: "#2A2A2D", mid: "#121214", base: "#050506" };

/** Bars left to right: `h` is the height at scale 1; `c` is [light, deep]; `gray` feeds the tinted icon. */
const SEGMENTS = [
  { h: 250, c: ["#F4F4F6", "#A9ABB1"], gray: "#9A9A9A" },
  { h: 400, c: ["#F4F4F6", "#A9ABB1"], gray: "#CFCFCF" },
  { h: 560, c: ["#F6E3B8", "#C99A55"], gray: "#FFFFFF" },
];

/** Bar width and gap at scale 1; bars are full pills. */
const BAR = { w: 136, gap: 54 };

const fx = (n) => +n.toFixed(2);

function pill(x, y, w, h) {
  const r = w / 2;
  return [
    `M ${fx(x)} ${fx(y + r)}`,
    `A ${fx(r)} ${fx(r)} 0 0 1 ${fx(x + w)} ${fx(y + r)}`,
    `L ${fx(x + w)} ${fx(y + h - r)}`,
    `A ${fx(r)} ${fx(r)} 0 0 1 ${fx(x)} ${fx(y + h - r)}`,
    "Z",
  ].join(" ");
}

/** The bars at `scale` (1 = iOS icon), centred on (512, 512) by their bounding box. */
function geometry(scale) {
  const w = BAR.w * scale;
  const gap = BAR.gap * scale;
  const total = SEGMENTS.length * w + (SEGMENTS.length - 1) * gap;
  const tallest = Math.max(...SEGMENTS.map((s) => s.h)) * scale;
  const bottom = 512 + tallest / 2;
  const segments = SEGMENTS.map((s, i) => {
    const h = s.h * scale;
    return { ...s, d: pill(512 - total / 2 + i * (w + gap), bottom - h, w, h) };
  });
  return { scale, segments };
}

const svg = (body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs ? `\n  <defs>${defs}\n  </defs>` : ""}${body}\n</svg>\n`;

/**
 * Full-colour bars: each segment shaded light to deep across itself, a soft light catching every upward-facing edge
 * (the segment minus itself nudged down, blurred a little), and one soft shadow under the bars.
 * `shadow` is the shadow opacity (0 = none).
 */
function colourMark(g, { shadow = 0.42, highlight = true } = {}) {
  const { scale } = g;
  const lift = 9 * scale;
  let defs = `
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="${fx(22 * scale)}" stdDeviation="${fx(28 * scale)}" flood-color="#000" flood-opacity="${shadow}"/></filter>
    <filter id="soften" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${fx(2.5 * scale)}"/></filter>`;
  let fills = "";
  let lights = "";
  g.segments.forEach((s, i) => {
    defs += `
    <linearGradient id="seg${i}" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${s.c[0]}"/><stop offset="1" stop-color="${s.c[1]}"/>
    </linearGradient>
    <clipPath id="clip${i}"><path d="${s.d}"/></clipPath>
    <mask id="edge${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <path d="${s.d}" fill="#fff"/><path d="${s.d}" fill="#000" transform="translate(0 ${fx(lift)})" filter="url(#soften)"/>
    </mask>`;
    fills += `\n    <path d="${s.d}" fill="url(#seg${i})"/>`;
    lights += `\n    <g clip-path="url(#clip${i})"><rect width="1024" height="1024" fill="#fff" fill-opacity="0.5" mask="url(#edge${i})"/></g>`;
  });
  const body = `
  <g${shadow ? ' filter="url(#shadow)"' : ""}>${fills}
  </g>${highlight ? lights : ""}`;
  return { defs, body };
}

/** Flat silhouette (Android themed icon) or per-segment grays (iOS tinted). */
function flatMark(g, { color, grays = false } = {}) {
  const body = g.segments
    .map((s) => `\n  <path d="${s.d}" fill="${grays ? s.gray : color}"/>`)
    .join("");
  return { defs: "", body };
}

const fieldDefs = `
    <radialGradient id="field" cx="0.3" cy="0.1" r="1.1">
      <stop offset="0" stop-color="${FIELD.top}"/><stop offset="0.55" stop-color="${FIELD.mid}"/><stop offset="1" stop-color="${FIELD.base}"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>`;
const field = `\n  <rect width="1024" height="1024" fill="url(#field)"/>`;
const sheen = `\n  <rect width="1024" height="1024" fill="url(#sheen)"/>`;

/** Background colour for app.json's android.adaptiveIcon.backgroundColor (the field's mid tone). */
export const BACKGROUND = FIELD.mid;

/** iOS / default icon: full-bleed graphite field, colour bars. Opaque. */
export function appIcon() {
  const m = colourMark(geometry(1));
  return svg(field + m.body + sheen, fieldDefs + m.defs);
}

/** iOS 18 dark appearance: the colour bars on transparent; the system supplies its dark backdrop. */
export function appIconDark() {
  const m = colourMark(geometry(1), { shadow: 0.3 });
  return svg(m.body, m.defs);
}

/** iOS 18 tinted appearance: grayscale bars on black; the system maps luminance to the user's tint. */
export function appIconTinted() {
  const m = flatMark(geometry(1), { grays: true });
  return svg(`\n  <rect width="1024" height="1024" fill="#000"/>${m.body}`);
}

/** Android adaptive foreground: transparent, the bars inside the 66dp safe circle (r ≈ 313px of 1024). */
const ANDROID_SCALE = 0.76;
export function androidForeground() {
  const m = colourMark(geometry(ANDROID_SCALE), { shadow: 0.36 });
  return svg(m.body, m.defs);
}

export function androidMonochrome() {
  const m = flatMark(geometry(ANDROID_SCALE), { color: "#fff" });
  return svg(m.body);
}

export function androidBackground() {
  return svg(field + sheen, fieldDefs);
}

// Alternate icon: a rupee sign drawn as round-capped strokes in the tallest bar's champagne.
const RUPEE =
  "M 336 286 H 690 M 336 412 H 690 M 336 286 H 466 A 126 126 0 0 1 466 538 H 362 L 652 790";

function rupeeMark(scale, { shadow = 0.42, color } = {}) {
  const t = `translate(${fx(512 * (1 - scale))} ${fx(512 * (1 - scale) - 33 * scale)}) scale(${scale})`;
  const stroke = color ?? "url(#rupee)";
  const defs = `
    <linearGradient id="rupee" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#F6E3B8"/><stop offset="1" stop-color="#C99A55"/>
    </linearGradient>
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="${fx(22 * scale)}" stdDeviation="${fx(28 * scale)}" flood-color="#000" flood-opacity="${shadow}"/></filter>`;
  const body = `
  <g transform="${t}"${shadow && !color ? ' filter="url(#shadow)"' : ""}><path d="${RUPEE}" fill="none" stroke="${stroke}" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return { defs, body };
}

export function rupeeIcon() {
  const m = rupeeMark(1);
  return svg(field + m.body + sheen, fieldDefs + m.defs);
}

export function rupeeIconDark() {
  const m = rupeeMark(1, { shadow: 0.3 });
  return svg(m.body, m.defs);
}

export function rupeeIconTinted() {
  const m = rupeeMark(1, { color: "#fff" });
  return svg(`\n  <rect width="1024" height="1024" fill="#000"/>${m.body}`, m.defs);
}

export function rupeeAndroidForeground() {
  const m = rupeeMark(ANDROID_SCALE, { shadow: 0.36 });
  return svg(m.body, m.defs);
}

/** Web favicon: the bars a little larger and no rim light, so they hold at 16–32px. */
export function favicon() {
  const m = colourMark(geometry(1.14), {
    shadow: 0.3,
    highlight: false,
  });
  return svg(field + m.body, fieldDefs + m.defs);
}
