// Templates vullen en naar beeld omzetten, helemaal in de browser.
// Preview: een iframe met het gevulde template. Export: hetzelfde template als XHTML in een
// SVG <foreignObject>, op een canvas getekend. Alles (foto's, logo's, font, gradient) is een
// data-URL, anders weigert de browser het canvas te exporteren.
import { tokenCss, resolveContent, carouselSlideContents } from "./template-engine.mjs";
import { BRAND, FONT_FACE_CSS } from "./brand.js";
import { TEMPLATES } from "./templates.js";
import { templateGradientPositions, gradientLayer } from "./gradient.js";

const TEXT_LIKE = new Set(["text", "date", "select"]);
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let placeholderUrl = null;
/** Neutrale foto-placeholder zolang er nog niets is gekozen. */
export function placeholderPhoto() {
  if (placeholderUrl) return placeholderUrl;
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 1200;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 1200);
  grad.addColorStop(0, "#3A3F4B");
  grad.addColorStop(1, "#1C1F27");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 1200);
  g.fillStyle = "rgba(255,255,255,.35)";
  g.font = "600 44px Arial, sans-serif";
  g.textAlign = "center";
  g.fillText("KIES EEN FOTO", 600, 620);
  placeholderUrl = c.toDataURL("image/jpeg", 0.85);
  return placeholderUrl;
}

/** Standaardinhoud van een template: de defaults uit template.json, zonder voorbeeldfoto's. */
export function defaultContent(spec) {
  const content = {};
  for (const slot of spec.slots) {
    if (TEXT_LIKE.has(slot.type) && slot.default != null) content[slot.id] = slot.default;
    if (slot.type === "variant") content[slot.id] = slot.default ?? slot.options?.[0]?.id;
  }
  return content;
}

/** Slots die op deze slide/layout getoond worden (carrousels: slot.layouts). */
export function slotsFor(spec, layout) {
  return spec.slots.filter((s) => !s.layouts || !layout || s.layouts.includes(layout));
}

function fill(root, values) {
  for (const el of root.querySelectorAll("[data-slot]")) {
    const value = values[el.dataset.slot] ?? "";
    if (el.dataset.slotAttr) el.setAttribute(el.dataset.slotAttr, value);
    else if (el.tagName === "IMG") el.setAttribute("src", value);
    else el.textContent = value;
  }
}

/**
 * Gevuld template: { width, height, css, bodyHtml }. opts.seed bepaalt de vorm van de
 * organische gradient (zelfde seed = zelfde beeld in preview en export).
 */
export async function buildTemplate(id, content, { seed = 7, overlay = false } = {}) {
  const { spec, html } = TEMPLATES[id];
  const withPhotos = { ...content };
  for (const slot of spec.slots) {
    // overlay: alleen de laag erboven (tekst, overloop, gradient, logo), transparant waar de foto zat.
    if (slot.type === "image" && (overlay || !withPhotos[slot.id])) withPhotos[slot.id] = overlay ? TRANSPARENT_PIXEL : placeholderPhoto();
  }
  const values = resolveContent(spec, withPhotos, { templateBase: "", brandBase: "", brand: BRAND });

  // Organische gradient in plaats van de ronde CSS-gloed: posities uit de template-CSS.
  let gradientCss = "";
  const positions = templateGradientPositions(html);
  const variant = values.blob;
  if (variant && positions[variant]) {
    const url = await gradientLayer({ w: spec.width, h: spec.height, positions: positions[variant], seed });
    gradientCss = `.blobs { background: url(${url}) 0 0 / 100% 100% no-repeat !important; }`;
  }

  const doc = new DOMParser().parseFromString(`<div id="gt-tpl">${html}</div>`, "text/html");
  const root = doc.getElementById("gt-tpl");
  fill(root, values);
  // Uitsnede: content["photo__pos"] = "40% 20%" verschuift de foto binnen zijn kader.
  // Onboarding: "__oy" schuift de foto verticaal binnen zijn kader (object-position),
  // "__ty" verschuift het ankerpunt van de inzoom (transform-origin), beide in %.
  const posCss = spec.slots
    .filter((slot) => slot.type === "image")
    .map((slot) => {
      const sel = `img[data-slot="${slot.id}"]`;
      const rules = [];
      if (content[`${slot.id}__pos`]) rules.push(`object-position: ${content[`${slot.id}__pos`]} !important;`);
      if (content[`${slot.id}__oy`] != null) rules.push(`object-position: 50% ${content[`${slot.id}__oy`]}% !important;`);
      if (content[`${slot.id}__ty`] != null) rules.push(`transform-origin: 50% ${content[`${slot.id}__ty`]}% !important;`);
      return rules.length ? `${sel} { ${rules.join(" ")} }` : "";
    })
    .join(" ");
  const overlayCss = overlay ? ".frame { background: transparent !important; } .photo { visibility: hidden !important; }" : "";
  const css = `${FONT_FACE_CSS} ${tokenCss(spec, BRAND)} ${gradientCss} ${posCss} ${overlayCss}`;
  return { spec, width: spec.width, height: spec.height, css, root };
}

/** Volledig HTML-document voor de preview-iframe. */
export function previewDocument(built) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>${built.css} html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; }</style></head><body>${built.root.innerHTML}</body></html>`;
}

/** Teksten die niet passen, gemeten in een geladen preview-document. */
export function fitIssues(doc) {
  const frameEl = doc.querySelector(".frame");
  if (!frameEl) return [];
  const frame = frameEl.getBoundingClientRect();
  const issues = [];
  for (const el of doc.querySelectorAll("[data-fit]")) {
    if (el.scrollHeight > el.clientHeight + 1) issues.push({ slot: el.dataset.slot, issue: "past niet in het vak" });
  }
  for (const el of doc.querySelectorAll("[data-fit-width]")) {
    if (el.scrollWidth > el.clientWidth + 1) issues.push({ slot: el.dataset.slot, issue: "is te lang voor één regel" });
  }
  for (const el of doc.querySelectorAll("[data-fit-frame]")) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > frame.right + 1 || r.bottom > frame.bottom + 1)) issues.push({ slot: el.dataset.slot, issue: "loopt buiten het beeld" });
  }
  return issues;
}

/** Tekent een gevuld template op een canvas (transparant waar het template niets schildert). */
export async function rasterize(built) {
  const { width: w, height: h, css, root } = built;
  // :root bestaat niet binnen een foreignObject; de variabelen gaan op de wrapper.
  const scopedCss = css.replace(/:root\b/g, ".gt-root");
  const wrapper = root.ownerDocument.createElement("div");
  wrapper.setAttribute("class", "gt-root");
  wrapper.setAttribute("lang", "nl");
  wrapper.setAttribute("style", `width:${w}px;height:${h}px;margin:0;padding:0;overflow:hidden;`);
  const style = root.ownerDocument.createElement("style");
  style.textContent = scopedCss;
  wrapper.appendChild(style);
  for (const child of [...root.childNodes]) wrapper.appendChild(child.cloneNode(true));
  const xhtml = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;

  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  // Het ingesloten font is soms pas na de eerste decode klaar; even wachten voorkomt een
  // export in het reservefont.
  await new Promise((r) => setTimeout(r, 120));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas;
}

export function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Exporteren lukte niet in deze browser."))), type, quality)
  );
}

/** Inhoud per slide van een carrousel (gedeelde velden + teller), zoals in het brand platform. */
export function slideContents(spec, shared, slides) {
  return carouselSlideContents(spec, shared, slides);
}

/** Foto inlezen en verkleinen tot max. 2560 px aan de lange kant, als JPEG-data-URL. */
export async function readPhoto(file, maxEdge = 2560) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Standaard uitsnede van de foto in een template ([x, y] in %), uit object-position in de CSS. */
export function defaultPhotoPosition(id) {
  const m = TEMPLATES[id].html.match(/\.photo\s*\{[^}]*object-position:\s*([^;}]+)/);
  const words = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
  const parts = (m ? m[1].trim().split(/\s+/) : ["50%", "50%"]).map((v) => (v in words ? words[v] : parseFloat(v)));
  const [x = 50, y = 50] = parts.length === 1 ? [parts[0], 50] : parts;
  return [isNaN(x) ? 50 : x, isNaN(y) ? 50 : y];
}
