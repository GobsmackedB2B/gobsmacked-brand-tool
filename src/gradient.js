// Organische Gobsmacked-gradients: per gloed drie verschoven lobben (onregelmatige Catmull-Rom-
// paden) met een elliptische radial gradient, de rand vervormd met feTurbulence +
// feDisplacementMap en daarna zacht gemaakt met feGaussianBlur. Purple is altijd de grote gloed.
// Zelfde techniek als renders/gradients/blob-generator.html in het brand platform.

export const MIDNIGHT = "#090715";
export const ARCTIC = "#21FDE5";
export const PURPLE = "#780B4B";

export const VARIANTS = [
  { id: "hoeken", label: "Hoeken" },
  { id: "gespiegeld", label: "Gespiegeld" },
  { id: "boven-onder", label: "Boven en onder" },
  { id: "zijkanten", label: "Zijkanten" },
  { id: "ingetogen", label: "Ingetogen" },
];

// Posities per variant: [rx%, ry%, cx%, cy%] voor Purple (p) en Arctic Blue (a).
// Liggend = deck, staand = deck een kwartslag gedraaid, social = 4:5 en 1:1-templates.
const TABLES = {
  liggend: {
    hoeken: [[60, 62, -8, 108], [52, 56, 108, -8]],
    gespiegeld: [[60, 62, 108, 108], [52, 56, -8, -8]],
    "boven-onder": [[90, 52, 50, 122], [80, 46, 50, -18]],
    zijkanten: [[42, 70, -14, 55], [38, 62, 114, 42]],
    ingetogen: [[40, 40, -10, 112], [34, 34, 110, -10]],
  },
  staand: {
    hoeken: [[62, 60, -8, 108], [56, 52, 108, -8]],
    gespiegeld: [[62, 60, 108, 108], [56, 52, -8, -8]],
    "boven-onder": [[70, 42, 50, 114], [62, 38, 50, -14]],
    zijkanten: [[52, 90, -22, 55], [46, 80, 118, 45]],
    ingetogen: [[40, 40, -10, 112], [34, 34, 110, -10]],
  },
  social: {
    hoeken: [[75, 48, -12, 88], [62, 40, 112, 6]],
    gespiegeld: [[75, 48, 112, 88], [62, 40, -12, 6]],
    "boven-onder": [[115, 46, 50, 116], [100, 38, 50, -12]],
    zijkanten: [[62, 55, -20, 55], [55, 48, 120, 42]],
    ingetogen: [[52, 32, -14, 98], [42, 26, 114, -2]],
  },
};

/** Posities voor een variant bij een formaat, gekozen op de beeldverhouding. */
export function variantPositions(variant, w, h) {
  const q = w / h;
  const table = q > 1.3 ? TABLES.liggend : q < 0.7 ? TABLES.staand : TABLES.social;
  return table[variant] ?? table.hoeken;
}

/** mulberry32: een seed geeft altijd dezelfde vorm. */
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uni = (r, a, b) => a + (b - a) * r();

function pathAround(cx, cy, rx, ry, r, n) {
  const ph = uni(r, 0, 6.28);
  const p = [];
  for (let i = 0; i < n; i++) {
    const t = ph + (2 * Math.PI * i) / n + uni(r, -0.18, 0.18);
    const k = uni(r, 0.5, 1.1);
    p.push([cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)]);
  }
  const f = (v) => v.toFixed(1);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + "Z";
}

function glow(id, pos, w, h, color, opacity, r) {
  // kleine variatie in maat en plek; het hart blijft buiten het kader
  const rx = (pos[0] / 100) * w * uni(r, 0.92, 1.08);
  const ry = (pos[1] / 100) * h * uni(r, 0.92, 1.08);
  const cx = ((pos[2] + uni(r, -4, 4)) / 100) * w;
  const cy = ((pos[3] + uni(r, -4, 4)) / 100) * h;
  const R = Math.max(rx, ry);
  const blur = Math.min(rx, ry) * 0.13;
  const noiseSeed = Math.floor(r() * 1000);
  const defs =
    `<radialGradient id="g${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${R}" gradientTransform="translate(${cx} ${cy}) scale(${rx / R} ${ry / R}) translate(${-cx} ${-cy})">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>` +
    `<stop offset=".5" stop-color="${color}" stop-opacity="${opacity * 0.8}"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>` +
    `<filter id="f${id}" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(1.6 / R).toFixed(5)}" numOctaves="2" seed="${noiseSeed}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="${Math.round(R * 0.32)}" xChannelSelector="R" yChannelSelector="G"/>` +
    `<feGaussianBlur stdDeviation="${Math.round(blur)}"/></filter>`;
  // drie lobben, verschoven langs de rand van het kader
  const dx = w / 2 - cx, dy = h / 2 - cy, L = Math.hypot(dx, dy) || 1, tx = -dy / L, ty = dx / L;
  const lobes = [[0, 1, 1], [uni(r, 0.35, 0.55), uni(r, 0.55, 0.75), 0.8], [-uni(r, 0.3, 0.5), uni(r, 0.5, 0.7), 0.7]];
  const paths = lobes
    .map((l) => `<path d="${pathAround(cx + tx * l[0] * rx, cy + ty * l[0] * ry, rx * l[1], ry * l[1], r, 6)}" fill="url(#g${id})" opacity="${l[2]}"/>`)
    .join("");
  return { defs, g: `<g filter="url(#f${id})">${paths}</g>` };
}

/**
 * SVG-tekst van een gradient. `positions` = [[rx,ry,cx,cy] Purple, [..] Arctic] in procenten.
 * background: kleur van het vlak, of null voor een transparante laag (voor over een foto).
 */
export function gradientSvg({ w, h, positions, seed = 1, background = MIDNIGHT, purple = PURPLE, arctic = ARCTIC }) {
  const r = rng(seed);
  const p = glow(`p${seed}`, positions[0], w, h, purple, 0.92, r);
  const a = glow(`a${seed}`, positions[1], w, h, arctic, 0.58, r);
  const bg = background ? `<rect width="${w}" height="${h}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${p.defs}${a.defs}</defs>${bg}${p.g}${a.g}</svg>`;
}

/** Losse achtergrond in een vaste variant. swap: Purple en Arctic Blue van plek wisselen. */
export function backgroundSvg({ w, h, variant, seed, swap = false }) {
  const [big, small] = variantPositions(variant, w, h);
  const positions = swap ? [[big[0], big[1], small[2], small[3]], [small[0], small[1], big[2], big[3]]] : [big, small];
  return gradientSvg({ w, h, positions, seed });
}

/** SVG naar canvas (zelfde pixelmaat). */
export async function svgToCanvas(svg, w, h) {
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas;
}

// Gradientlagen voor templates: de posities komen uit de CSS van het template zelf
// (--blob-p / --blob-a per data-blob-variant), zodat elk template zijn eigen plaatsing houdt.
const layerCache = new Map();

/** "75% 48% at -12% 88%" -> [75, 48, -12, 88] */
function parseRadial(value) {
  const n = value.match(/-?[\d.]+(?=%)/g);
  return n && n.length >= 4 ? n.slice(0, 4).map(Number) : null;
}

/** Posities per variant uit een template.html, bv. { hoeken: [[...], [...]] }. */
export function templateGradientPositions(templateHtml) {
  const out = {};
  const re = /\[data-blob="([\w-]+)"\]\s*\{\s*--blob-p:\s*([^;]+);\s*--blob-a:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(templateHtml))) {
    const p = parseRadial(m[2]), a = parseRadial(m[3]);
    if (p && a) out[m[1]] = [p, a];
  }
  return out;
}

/** Transparante organische gradientlaag als PNG-data-URL (gecachet per formaat/variant/seed). */
export async function gradientLayer({ w, h, positions, seed }) {
  const key = `${w}x${h}:${positions.flat().join(",")}:${seed}`;
  if (!layerCache.has(key)) {
    layerCache.set(
      key,
      svgToCanvas(gradientSvg({ w, h, positions, seed, background: null }), w, h).then((c) => c.toDataURL("image/png"))
    );
  }
  return layerCache.get(key);
}

/** Klein voorbeeldplaatje van een variant (SVG-data-URL), voor de keuzeknoppen. */
export function gradientThumb(variant, w, h) {
  const scale = 120 / Math.max(w, h);
  const tw = Math.round(w * scale), th = Math.round(h * scale);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(backgroundSvg({ w: tw, h: th, variant, seed: 11 }));
}
