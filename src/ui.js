// Kleine DOM-helpers en gedeelde onderdelen (preview, knoppen, downloads).
import { previewDocument, fitIssues, rasterize, canvasToBlob } from "./render.js";

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function button(label, onClick, kind = "leeg") {
  return h("button", { type: "button", class: `gt-knop gt-${kind}`, onClick }, label);
}

/** Groep keuzeknoppen; geeft { el, set(value) } terug. */
export function choices(options, value, onChange, { label } = {}) {
  const visual = options.some((o) => o.thumb || o.swatch);
  const el = h("div", { class: visual ? "gt-keuzes gt-keuzes-beeld" : "gt-keuzes", role: "group", "aria-label": label });
  const render = (current) => {
    el.replaceChildren(
      ...options.map((o) =>
        h(
          "button",
          { type: "button", class: "gt-keuze", "aria-pressed": String(o.id === current), onClick: () => { render(o.id); onChange(o.id); } },
          o.thumb ? h("img", { class: "gt-keuze-beeld", src: o.thumb, alt: "" }) : null,
          o.swatch ? h("span", { class: "gt-keuze-vlak", style: `background:${o.swatch}` }) : null,
          h("span", {}, o.label, o.sub ? h("small", {}, o.sub) : null)
        )
      )
    );
  };
  render(value);
  return { el, set: render };
}

export function field(label, control, hint) {
  return h("label", { class: "gt-veld" }, h("span", { class: "gt-veld-naam" }, label), control, hint ? h("span", { class: "gt-hint" }, hint) : null);
}

export function textInput(value, onInput, { maxChars, multiline, placeholder } = {}) {
  const attrs = { class: "gt-invoer", maxlength: maxChars ?? null, placeholder: placeholder ?? null };
  const el = multiline ? h("textarea", { ...attrs, rows: 4 }) : h("input", { ...attrs, type: "text" });
  el.value = value ?? "";
  el.addEventListener("input", () => onInput(el.value));
  return el;
}

export function fileInput(onFile, label = "Kies een foto") {
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", class: "gt-verborgen" });
  input.addEventListener("change", () => input.files?.[0] && onFile(input.files[0]));
  return h("label", { class: "gt-knop gt-leeg gt-bestand" }, label, input);
}

/**
 * Maakt een vlak (de preview) klikbaar en een plek om een foto op te slepen. De foto gaat via
 * het bestaande bestandsveld, zodat de rest van het formulier gewoon meeloopt.
 */
export function photoTarget(target, getInput, { click = true } = {}) {
  target.classList.add("gt-fotodoel");
  if (click) {
    target.title = "Klik of sleep een foto hierheen";
    target.addEventListener("click", () => getInput()?.click());
  }
  target.addEventListener("dragover", (e) => { e.preventDefault(); target.classList.add("gt-sleep"); });
  target.addEventListener("dragleave", () => target.classList.remove("gt-sleep"));
  target.addEventListener("drop", (e) => {
    e.preventDefault();
    target.classList.remove("gt-sleep");
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
    const input = getInput();
    if (!file || !input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
  });
}

/** Korte uitleg bovenaan een tab: waarvoor het is, en in drie stappen hoe het werkt. */
export function intro(text, steps = [], tip) {
  return h(
    "div",
    { class: "gt-uitlegblok" },
    h("p", { class: "gt-intro" }, text),
    steps.length
      ? h("ol", { class: "gt-stappen" }, steps.map((step, i) => h("li", {}, h("span", { class: "gt-stap-nr" }, String(i + 1).padStart(2, "0")), h("span", {}, step))))
      : null,
    tip ? h("p", { class: "gt-tip" }, h("strong", {}, "Tip: "), tip) : null
  );
}

export function slugify(text) {
  return (
    String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "gobsmacked"
  );
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Bezig-status op een knop terwijl een export loopt. */
export async function busy(btn, fn) {
  const label = btn.dataset.label ?? btn.textContent;
  btn.dataset.label = label;
  btn.disabled = true;
  btn.textContent = "Bezig…";
  try {
    await fn();
    btn.textContent = btn.dataset.done ?? "Gedownload";
    btn.classList.add("gt-klaar");
    setTimeout(() => { btn.textContent = label; btn.classList.remove("gt-klaar"); }, 1800);
  } catch (err) {
    console.error(err);
    alert(err?.message || "Er ging iets mis bij het exporteren.");
    btn.textContent = label;
  } finally {
    btn.disabled = false;
  }
}

/**
 * Geschaalde live preview van een gevuld template. update(built) ververst; onFit krijgt de
 * teksten die niet passen.
 */
export function preview({ maxWidth = 520, maxHeight = 640, onFit } = {}) {
  const frame = h("iframe", { class: "gt-iframe", title: "Voorbeeld", scrolling: "no", tabindex: "-1" });
  const box = h("div", { class: "gt-preview-box" }, frame);
  const el = h("div", { class: "gt-preview" }, box);
  let size = null;
  const layout = () => {
    if (!size) return;
    const avail = Math.min(maxWidth, el.clientWidth || maxWidth);
    const s = Math.min(avail / size.w, maxHeight / size.h, 1);
    box.style.width = `${size.w * s}px`;
    box.style.height = `${size.h * s}px`;
    frame.style.width = `${size.w}px`;
    frame.style.height = `${size.h}px`;
    frame.style.transform = `scale(${s})`;
  };
  new ResizeObserver(layout).observe(el);
  frame.addEventListener("load", () => {
    const doc = frame.contentDocument;
    if (!doc || !onFit) return;
    doc.fonts.ready.then(() => requestAnimationFrame(() => onFit(fitIssues(doc))));
  });
  return {
    el,
    update(built) {
      size = { w: built.width, h: built.height };
      frame.srcdoc = previewDocument(built);
      layout();
    },
  };
}

/** Exporteert een gevuld template als PNG of JPG. */
export async function exportBuilt(built, type = "png") {
  const canvas = await rasterize(built);
  return canvasToBlob(canvas, type === "jpg" ? "image/jpeg" : "image/png", 0.92);
}

export function fitList(issues, labels) {
  if (!issues.length) return null;
  return h(
    "ul",
    { class: "gt-meldingen" },
    issues.map((i) => h("li", {}, `${labels[i.slot] ?? i.slot} ${i.issue}`))
  );
}
