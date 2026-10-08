// Pure template composition, shared by the portal (live preview, in the browser), the render
// API and scripts/render-template.mjs. No Node or DOM APIs here, so it runs everywhere.
//
// A template is templates/<id>/template.html (markup + CSS that only uses var(--color-<role>)
// and var(--font-<role>)) plus template.json (size, token roles, slots). A brand fills the roles
// via brand.json -> tokens.colors and fonts[].role.

/**
 * @typedef {{ id: string, file: string, label: string }} IconOption
 * @typedef {{ id: string, label: string, preview?: string }} VariantOption
 * @typedef {{ id: string, type: "text" | "image" | "icon" | "date" | "select" | "variant" | "brand-logo", label: string,
 *   maxChars?: number, default?: string, defaultDate?: string, options?: IconOption[] | string[],
 *   cutout?: boolean, onRole?: string, logo?: "mark" | "full" }} Slot
 * // "date" and "select" slots carry plain display text in content, exactly like "text" — the
 * // builder UI is what differs (a native date picker / a dropdown instead of a free text field).
 * // "date" additionally has defaultDate (ISO yyyy-mm-dd), used only to pre-fill that picker.
 * // "image" slots may set cutout: true — the builder then removes the photo's background before
 * // storing it, so a flat token colour shows through instead (see components/portal/ContentBuilder).
 * // "variant" slots pick one of a few locked layout variants (e.g. blob positions). The element with
 * // data-slot gets the chosen option id as an attribute (data-slot-attr names it), never as text,
 * // so the template's own CSS decides what each variant looks like. options: VariantOption[].
 * // "brand-logo" slots have no user-facing options: the engine auto-picks a logo from brand.logos
 * // that reads well against the resolved colour of `onRole` (a colour role this template uses).
 * // logo: "full" prefers the complete lockup (e.g. a wordmark) over the compact mark (default).
 * @typedef {{ id: string, name: string, type: string, width: number, height: number, maxSchemes?: number,
 *   tokens: { colors?: string[], fonts?: string[], swatch?: string[] }, slots: Slot[], locked?: string[] }} TemplateSpec
 * @typedef {{ name: string, role?: string, weight?: number, googleFont?: boolean, fallback?: string }} FontToken
 * @typedef {{ label: string, file: string, background?: "donker" }} BrandLogo
 * @typedef {{ fonts?: FontToken[], logos?: BrandLogo[], tokens?: { colors?: Record<string, string> } }} BrandTokens
 */

/** Roles the template needs that the brand does not define. */
export function missingTokens(template, brand) {
  const colors = brand.tokens?.colors ?? {};
  const fonts = brand.fonts ?? [];
  const needsLogo = template.slots.some((s) => s.type === "brand-logo");
  return [
    ...(template.tokens.colors ?? []).filter((role) => !colors[role]).map((role) => `kleur "${role}"`),
    ...(template.tokens.fonts ?? []).filter((role) => !fonts.some((f) => f.role === role)).map((role) => `font "${role}"`),
    ...(needsLogo && !(brand.logos ?? []).length ? ['logo (merk heeft geen logo\'s)'] : []),
  ];
}

export function tokenCss(template, brand) {
  const vars = Object.entries(colorVars(template, brand)).map(([name, value]) => `${name}: ${value};`);
  for (const role of template.tokens.fonts ?? []) {
    const font = (brand.fonts ?? []).find((f) => f.role === role);
    if (!font) continue;
    vars.push(`--font-${role}: "${font.name}", ${font.fallback ?? "sans-serif"};`);
    vars.push(`--font-${role}-weight: ${font.weight ?? 400};`);
  }
  return `:root { ${vars.join(" ")} }`;
}

// ---- Colour schemes -------------------------------------------------------------------------
// A brand's tokens.colors is the standard scheme; brand.colorSchemes are approved alternatives
// that override some roles; brand.templateSchemes picks which ones each template offers.
// Every scheme is checked before it is offered: all colours must come from the brand palette,
// and text on a surface must meet WCAG AA contrast.

export const STANDARD_SCHEME = "standaard";
// Default cap on how many colour combinations a template offers, when the template itself
// doesn't say otherwise via `maxSchemes` (e.g. a template built with a curated set of 4).
export const SCHEMES_PER_TEMPLATE = 3;

const CONTRAST_RULES = [
  ["licht", "op-licht", 4.5, "tekst op het lichte vlak"],
  ["markering", "op-markering", 4.5, "tekst op de markering"],
  ["achtergrond", "op-achtergrond", 4.5, "tekst op de achtergrond"],
  ["tag", "op-tag", 4.5, "tekst in het label"],
  ["donker", "licht", 3, "licht vlak tegen de donkere achtergrond"],
];

export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The brand with the colours of scheme `schemeId` applied (unknown id = standard). */
export function withScheme(brand, schemeId) {
  const scheme = (brand.colorSchemes ?? []).find((s) => s.id === schemeId);
  if (!scheme) return brand;
  return { ...brand, tokens: { ...brand.tokens, colors: { ...brand.tokens?.colors, ...scheme.colors } } };
}

/** Why a scheme may not be used for this template (only the roles the template uses count). */
export function schemeProblems(template, brand, schemeId) {
  const colors = withScheme(brand, schemeId).tokens?.colors ?? {};
  const used = new Set(template.tokens.colors ?? []);
  const allowed = new Set(
    [...(brand.palette ?? []).flatMap((g) => g.colors), ...(brand.colors ?? [])].map((c) => c.hex.toUpperCase())
  );
  const problems = [];
  if (allowed.size) {
    for (const role of used) {
      if (colors[role] && !allowed.has(colors[role].toUpperCase())) problems.push(`${colors[role]} zit niet in de huisstijl`);
    }
  }
  // brand.noTextOn: brand colours that may never be a surface behind text (e.g. accent colours).
  const noTextOn = new Set((brand.noTextOn ?? []).map((hex) => hex.toUpperCase()));
  for (const [surface, text, min, label] of CONTRAST_RULES) {
    if (!used.has(surface) || !used.has(text) || !colors[surface] || !colors[text]) continue;
    if (text.startsWith("op-") && noTextOn.has(colors[surface].toUpperCase())) {
      problems.push(`${label}: ${colors[surface]} mag geen vlak achter tekst zijn`);
    }
    const ratio = contrastRatio(colors[surface], colors[text]);
    if (ratio < min) problems.push(`${label}: contrast ${ratio.toFixed(1)}, minimaal ${min}`);
  }
  return problems;
}

/**
 * The colour schemes a template offers in this brand (max SCHEMES_PER_TEMPLATE), plus the ones
 * that were configured but rejected, with the reason. Each offered scheme has a swatch: the
 * colours of the surfaces the template actually uses.
 */
export function templateSchemes(template, brand) {
  const names = { [STANDARD_SCHEME]: brand.tokens?.schemeName ?? "Standaard" };
  for (const s of brand.colorSchemes ?? []) names[s.id] = s.name;
  const configured = brand.templateSchemes?.[template.id] ?? [
    STANDARD_SCHEME,
    ...(brand.colorSchemes ?? []).map((s) => s.id),
  ];
  // tokens.swatch: the roles that visibly change in this template (default: all surface roles).
  const swatchRoles = template.tokens.swatch ?? (template.tokens.colors ?? []).filter((role) => !role.startsWith("op-"));
  const maxSchemes = template.maxSchemes ?? SCHEMES_PER_TEMPLATE;

  const offered = [];
  const rejected = [];
  const seen = new Set();
  for (const id of configured) {
    if (!names[id]) {
      rejected.push({ id, name: id, problems: ["bestaat niet in colorSchemes"] });
      continue;
    }
    const problems = schemeProblems(template, brand, id);
    if (problems.length) {
      rejected.push({ id, name: names[id], problems });
      continue;
    }
    const colors = withScheme(brand, id).tokens?.colors ?? {};
    const key = (template.tokens.colors ?? []).map((role) => colors[role]).join();
    if (seen.has(key) || offered.length >= maxSchemes) continue; // identical look, or over the limit
    seen.add(key);
    offered.push({ id, name: names[id], swatch: swatchRoles.map((role) => colors[role]) });
  }
  return { offered, rejected };
}

/**
 * Picks the brand logo that reads best against `bgHex` (a resolved colour, e.g. the current
 * scheme's value for the slot's `onRole`): a compact mark over a full lockup, and a variant
 * flagged `background: "donker"` (i.e. a light-coloured logo, made for dark surfaces) only when
 * `bgHex` actually is dark. Falls back to the brand's first logo when nothing scores, null when
 * the brand has none.
 */
export function pickBrandLogo(logos, bgHex, variant = "mark") {
  if (!logos?.length) return null;
  const wantDark = bgHex ? luminance(bgHex) < 0.4 : false;
  const score = (logo) => {
    const onRightSurface = wantDark ? logo.background === "donker" : !logo.background;
    const isMark = /beeldmerk|icon|mark/i.test(logo.label) && !/woordmerk/i.test(logo.label);
    return (onRightSurface ? 2 : 0) + (isMark === (variant === "mark") ? 1 : 0);
  };
  return [...logos].sort((a, b) => score(b) - score(a))[0];
}

/** CSS custom properties for a template's colour roles in a brand, e.g. { "--color-donker": "#1A4413" }. */
export function colorVars(template, brand) {
  const colors = brand.tokens?.colors ?? {};
  return Object.fromEntries(
    (template.tokens.colors ?? []).filter((role) => colors[role]).map((role) => [`--color-${role}`, colors[role]])
  );
}

/**
 * Google Fonts stylesheet URL for all brand fonts marked googleFont, or null. Also loads the
 * weights and italics the brand's typeScale uses, so the guide can show every style for real.
 */
export function googleFontsUrl(brand) {
  const styles = new Map(); // font name -> Set of "ital,weight"
  const add = (name, weight, italic) => {
    if (!styles.has(name)) styles.set(name, new Set());
    styles.get(name).add(`${italic ? 1 : 0},${weight ?? 400}`);
  };
  const googleFonts = (brand.fonts ?? []).filter((f) => f.googleFont);
  for (const font of googleFonts) add(font.name, font.weight, false);
  for (const style of brand.typeScale ?? []) {
    const font = googleFonts.find((f) => f.role === style.role);
    if (font) add(font.name, style.weight, style.italic);
  }
  if (styles.size === 0) return null;
  const families = [...styles]
    .map(([name, set]) => {
      const axes = [...set].map((s) => s.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const family = `family=${name.replace(/ /g, "+")}`;
      return axes.some(([ital]) => ital)
        ? `${family}:ital,wght@${axes.map(([ital, weight]) => `${ital},${weight}`).join(";")}`
        : `${family}:wght@${axes.map(([, weight]) => weight).join(";")}`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=block`;
}

/**
 * The content of each slide of a carousel template: shared fields from `shared`, the rest from the
 * slide itself, and the counter ("02 / 07") filled in here, never by the user.
 */
export function carouselSlideContents(spec, shared, slides) {
  const { carousel } = spec;
  const pad = (n) => String(n).padStart(2, "0");
  return slides.map((slide, i) => {
    const content = { ...slide };
    for (const id of carousel.shared ?? []) {
      if (shared[id] !== undefined) content[id] = shared[id];
      else delete content[id];
    }
    if (carousel.counterSlot) content[carousel.counterSlot] = `${pad(i + 1)} / ${pad(slides.length)}`;
    return content;
  });
}

const TEXT_LIKE = new Set(["text", "date", "select"]);

/** Validation errors for user content (length limits, image size, invalid choice). Empty array = valid. */
export function validateContent(template, content) {
  const errors = [];
  for (const slot of template.slots) {
    const value = content[slot.id];
    if (value == null) continue;
    if (TEXT_LIKE.has(slot.type) && slot.maxChars && value.length > slot.maxChars) {
      errors.push(`"${slot.label}" is ${value.length} tekens, max ${slot.maxChars}`);
    }
    if (slot.type === "image" && value.startsWith("data:") && value.length > 20_000_000) {
      errors.push(`"${slot.label}": afbeelding is te groot (max ~15 MB)`);
    }
    if ((slot.type === "icon" || slot.type === "variant") && !(slot.options ?? []).some((o) => o.id === value)) {
      errors.push(`"${slot.label}": ongeldige keuze`);
    }
    if (slot.type === "select" && slot.options && !slot.options.includes(value)) {
      errors.push(`"${slot.label}": ongeldige keuze`);
    }
  }
  return errors;
}

/**
 * Resolves slot values to what the page shows. Image values can be:
 * "" / missing -> the template's default image, "brand:<path>" -> a file in the brand's files/ folder,
 * "data:..." -> an uploaded image (kept as is). `brand` is the (already scheme-applied) brand —
 * needed for "brand-logo" slots, which read brand.logos and brand.tokens.colors themselves.
 */
export function resolveContent(template, content, { templateBase, brandBase, brand }) {
  const out = {};
  for (const slot of template.slots) {
    const value = content[slot.id];
    if (TEXT_LIKE.has(slot.type)) {
      out[slot.id] = value ?? slot.default ?? "";
    } else if (slot.type === "variant") {
      const ids = (slot.options ?? []).map((o) => o.id);
      out[slot.id] = ids.includes(value) ? value : slot.default ?? ids[0] ?? "";
    } else if (slot.type === "icon") {
      const option = (slot.options ?? []).find((o) => o.id === value) ?? (slot.options ?? []).find((o) => o.id === slot.default);
      out[slot.id] = option ? templateBase + option.file : "";
    } else if (slot.type === "brand-logo") {
      const bgHex = slot.onRole ? brand?.tokens?.colors?.[slot.onRole] : undefined;
      const logo = pickBrandLogo(brand?.logos, bgHex, slot.logo);
      out[slot.id] = logo ? brandBase + logo.file : "";
    } else if (value && value.startsWith("data:")) {
      out[slot.id] = value;
    } else if (value && value.startsWith("brand:")) {
      out[slot.id] = brandBase + value.slice("brand:".length);
    } else {
      out[slot.id] = slot.default ? templateBase + slot.default : "";
    }
  }
  return out;
}

// Runs inside the composed page: fills slots, reports text that does not fit, and accepts
// live updates from a parent window (the portal preview) via postMessage.
const PAGE_SCRIPT = `
function fitIssues() {
  const frame = document.querySelector(".frame").getBoundingClientRect();
  const issues = [];
  for (const el of document.querySelectorAll("[data-fit]")) {
    if (el.scrollHeight > el.clientHeight + 1) issues.push({ slot: el.dataset.slot, issue: "past niet in het vak" });
  }
  // data-fit-width: single-line text (white-space: nowrap) that must not run wider than its box.
  // Height is ignored on purpose: big display type always overflows its line box a little.
  for (const el of document.querySelectorAll("[data-fit-width]")) {
    if (el.scrollWidth > el.clientWidth + 1) issues.push({ slot: el.dataset.slot, issue: "te lang voor één regel" });
  }
  for (const el of document.querySelectorAll("[data-fit-frame]")) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > frame.right || r.bottom > frame.bottom)) issues.push({ slot: el.dataset.slot, issue: "loopt buiten het beeld" });
  }
  return issues;
}
function applyContent(content) {
  for (const el of document.querySelectorAll("[data-slot]")) {
    const value = content[el.dataset.slot] ?? "";
    if (el.dataset.slotAttr) el.setAttribute(el.dataset.slotAttr, value);
    else if (el.tagName === "IMG") { if (el.getAttribute("src") !== value) el.src = value; }
    else el.textContent = value;
  }
  report();
}
function report() {
  if (window.parent === window) return;
  document.fonts.ready.then(() => requestAnimationFrame(() => window.parent.postMessage({ type: "template-fit", issues: fitIssues() }, "*")));
}
window.__fitIssues = fitIssues;
window.addEventListener("message", (e) => {
  if (!e.data) return;
  if (e.data.type === "template-content") applyContent(e.data.content);
  if (e.data.type === "template-colors") {
    for (const [name, value] of Object.entries(e.data.vars)) document.documentElement.style.setProperty(name, value);
  }
});
document.querySelectorAll("img").forEach((img) => img.addEventListener("load", report));
applyContent(window.__initialContent);
`;

/** Full HTML document for a template in a brand, with resolved content. */
export function composeDocument({ template, bodyHtml, brand, content, baseHref }) {
  const fonts = googleFontsUrl(brand);
  // lang drives hyphenation of long words (hyphens: auto in the templates).
  return `<!doctype html>
<html lang="${brand.language ?? "nl"}">
<head>
<meta charset="utf-8">
<base href="${baseHref}">
${fonts ? `<link rel="stylesheet" href="${fonts}">` : ""}
<style>${tokenCss(template, brand)} html, body { margin: 0; padding: 0; overflow: hidden; }</style>
</head>
<body>
${bodyHtml}
<script>window.__initialContent = ${JSON.stringify(content).replace(/</g, "\\u003c")};${PAGE_SCRIPT}</script>
</body>
</html>`;
}
