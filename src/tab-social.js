// Tab Social posts: de gob-*-templates uit het brand platform, losse posts en carrousels.
import { zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { TEMPLATES, SOCIAL_IDS } from "./templates.js";
import { buildTemplate, defaultContent, slotsFor, slideContents, readPhoto, rasterize, canvasToBlob } from "./render.js";
import { h, button, choices, field, textInput, fileInput, downloadBlob, busy, preview, exportBuilt, fitList } from "./ui.js";

const newSeed = () => Math.floor(Math.random() * 1e9);
const today = () => new Date().toISOString().slice(0, 10);

export function socialTab() {
  const host = h("div", { class: "gt-tab gt-tab-social" });
  const picker = h(
    "div",
    { class: "gt-kaarten" },
    SOCIAL_IDS.map((id) => {
      const { spec } = TEMPLATES[id];
      const kind = spec.carousel ? "Carrousel" : spec.type === "web-banner" ? "Banner" : "Post";
      return h(
        "button",
        { type: "button", class: "gt-kaart", onClick: () => open(id) },
        h("span", { class: "gt-kaart-soort" }, kind),
        h("span", { class: "gt-kaart-naam" }, spec.name),
        h("span", { class: "gt-kaart-maat" }, `${spec.width} × ${spec.height}`)
      );
    })
  );
  const editorHost = h("div");
  host.append(h("div", { class: "gt-breed" }, picker), editorHost);

  function open(id) {
    for (const card of picker.children) card.setAttribute("aria-pressed", String(card.querySelector(".gt-kaart-naam").textContent === TEMPLATES[id].spec.name));
    editorHost.replaceChildren(TEMPLATES[id].spec.carousel ? carouselEditor(id) : postEditor(id));
  }
  open(SOCIAL_IDS[0]);
  return host;
}

/** Formuliervelden voor een set slots. */
function slotFields(slots, content, onChange) {
  return slots
    .filter((s) => s.type !== "brand-logo" && s.id !== "counter")
    .map((slot) => {
      if (slot.type === "variant") {
        return field(slot.label, choices(slot.options, content[slot.id], (v) => onChange(slot.id, v), { label: slot.label }).el);
      }
      if (slot.type === "image") {
        const name = h("span", { class: "gt-hint" }, content[slot.id] ? "Foto gekozen" : "Nog geen foto");
        return field(
          slot.label,
          h("div", { class: "gt-rij" }, fileInput(async (file) => { name.textContent = file.name; onChange(slot.id, await readPhoto(file)); }), name)
        );
      }
      const multiline = (slot.maxChars ?? 0) > 60;
      const count = h("span", { class: "gt-teller" });
      const setCount = (v) => (count.textContent = slot.maxChars ? `${v.length} / ${slot.maxChars}` : "");
      setCount(content[slot.id] ?? "");
      const input = textInput(content[slot.id], (v) => { setCount(v); onChange(slot.id, v); }, { maxChars: slot.maxChars, multiline });
      return field(slot.label, h("div", { class: "gt-invoer-wrap" }, input, count));
    });
}

const labelsOf = (spec) => Object.fromEntries(spec.slots.map((s) => [s.id, s.label]));

function postEditor(id) {
  const { spec } = TEMPLATES[id];
  const content = defaultContent(spec);
  let seed = newSeed();
  let built = null;
  const warnings = h("div");
  const view = preview({ onFit: (issues) => warnings.replaceChildren(fitList(issues, labelsOf(spec)) ?? "") });

  let pending = 0;
  const refresh = async () => {
    const mine = ++pending;
    const b = await buildTemplate(id, content, { seed });
    if (mine !== pending) return;
    built = b;
    view.update(built);
  };
  const onChange = (slotId, value) => { content[slotId] = value; refresh(); };

  const base = `gobsmacked-${id.replace(/^gob-/, "")}-${today()}`;
  const hasGradient = spec.slots.some((s) => s.id === "blob");
  const actions = h(
    "div",
    { class: "gt-acties" },
    button("Download PNG", (e) => busy(e.currentTarget, async () => downloadBlob(`${base}.png`, await exportBuilt(built, "png"))), "vol"),
    button("Download JPG", (e) => busy(e.currentTarget, async () => downloadBlob(`${base}.jpg`, await exportBuilt(built, "jpg"))))
  );

  refresh();
  return h(
    "div",
    { class: "gt-tab" },
    h("div", { class: "gt-kolom gt-instellingen" },
      h("h3", { class: "gt-kop3" }, spec.name),
      slotFields(spec.slots, content, onChange),
      hasGradient ? h("div", { class: "gt-rij" }, button("Nieuwe gradientvorm", () => { seed = newSeed(); refresh(); })) : null,
      actions
    ),
    h("div", { class: "gt-kolom gt-voorbeeld" }, view.el, warnings)
  );
}

function carouselEditor(id) {
  const { spec } = TEMPLATES[id];
  const { carousel } = spec;
  const sharedIds = new Set(carousel.shared ?? []);
  const base = defaultContent(spec);
  const shared = Object.fromEntries([...sharedIds].filter((k) => base[k] != null).map((k) => [k, base[k]]));
  // Elke slide start met de defaults voor zijn layout, plus wat het template als voorbeeld meegeeft.
  const slideFor = (preset) => {
    const layout = preset.layout;
    const own = {};
    for (const slot of slotsFor(spec, layout)) {
      if (sharedIds.has(slot.id) || slot.id === carousel.counterSlot || slot.type === "brand-logo") continue;
      if (base[slot.id] != null) own[slot.id] = base[slot.id];
    }
    return { ...own, ...preset };
  };
  const slides = (carousel.slides ?? []).map(slideFor);
  let current = 0;
  let seed = newSeed();
  let built = null;

  const warnings = h("div");
  const view = preview({ onFit: (issues) => warnings.replaceChildren(fitList(issues, labelsOf(spec)) ?? "") });
  const tabs = h("div", { class: "gt-slides", role: "tablist", "aria-label": "Slides" });
  const slideForm = h("div");

  const contents = () => slideContents(spec, shared, slides);
  let pending = 0;
  const refresh = async () => {
    const mine = ++pending;
    const b = await buildTemplate(id, contents()[current], { seed });
    if (mine !== pending) return;
    built = b;
    view.update(built);
  };

  const layoutSlot = spec.slots.find((s) => s.id === carousel.layoutSlot);
  const renderSlideForm = () => {
    const slide = slides[current];
    const own = slotsFor(spec, slide.layout).filter(
      (s) => !sharedIds.has(s.id) && s.id !== carousel.counterSlot && s.id !== carousel.layoutSlot
    );
    const canChooseLayout = carousel.minSlides !== carousel.maxSlides;
    slideForm.replaceChildren(
      h("h3", { class: "gt-kop3" }, `Slide ${current + 1}`),
      canChooseLayout
        ? field("Layout", choices(layoutSlot.options, slide.layout, (v) => { slides[current] = { ...slideFor({ layout: v }), ...pick(slide, v) }; renderSlideForm(); refresh(); }).el)
        : null,
      slotFields(own, slide, (k, v) => { slide[k] = v; refresh(); })
    );
  };
  // Behoud wat al ingevuld was als de layout wisselt (alleen velden die de nieuwe layout kent).
  const pick = (slide, layout) => {
    const allowed = new Set(slotsFor(spec, layout).map((s) => s.id));
    return Object.fromEntries(Object.entries(slide).filter(([k]) => allowed.has(k) && k !== "layout"));
  };

  const renderTabs = () => {
    tabs.replaceChildren(
      ...slides.map((s, i) =>
        h("button", { type: "button", role: "tab", class: "gt-slide-tab", "aria-selected": String(i === current), onClick: () => { current = i; renderTabs(); renderSlideForm(); refresh(); } }, String(i + 1).padStart(2, "0"))
      ),
      slides.length < carousel.maxSlides
        ? h("button", { type: "button", class: "gt-slide-tab gt-plus", "aria-label": "Slide toevoegen", onClick: () => { slides.splice(slides.length - 1, 0, slideFor(carousel.newSlide ?? { layout: slides[0].layout })); current = slides.length - 2; renderTabs(); renderSlideForm(); refresh(); } }, "+")
        : null
    );
  };

  const removeBtn = button("Slide verwijderen", () => {
    if (slides.length <= carousel.minSlides) return;
    slides.splice(current, 1);
    current = Math.max(0, current - 1);
    renderTabs(); renderSlideForm(); refresh();
  });
  const moveBtn = (dir, label) => button(label, () => {
    const to = current + dir;
    if (to < 0 || to >= slides.length) return;
    [slides[current], slides[to]] = [slides[to], slides[current]];
    current = to;
    renderTabs(); renderSlideForm(); refresh();
  });

  const name = `gobsmacked-${id.replace(/^gob-/, "")}-${today()}`;
  const allCanvases = async () => {
    const out = [];
    for (const c of contents()) out.push(await rasterize(await buildTemplate(id, c, { seed })));
    return out;
  };
  const zipOf = async (type) => {
    const files = {};
    const canvases = await allCanvases();
    for (const [i, canvas] of canvases.entries()) {
      const blob = await canvasToBlob(canvas, type === "jpg" ? "image/jpeg" : "image/png");
      files[`${name}-${String(i + 1).padStart(2, "0")}.${type}`] = new Uint8Array(await blob.arrayBuffer());
    }
    return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
  };
  const pdf = async () => {
    const doc = await PDFDocument.create();
    for (const canvas of await allCanvases()) {
      const bytes = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.95)).arrayBuffer());
      const img = await doc.embedJpg(bytes);
      doc.addPage([canvas.width, canvas.height]).drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    }
    return new Blob([await doc.save()], { type: "application/pdf" });
  };

  const actions = h(
    "div",
    { class: "gt-acties" },
    button("Download PDF (LinkedIn)", (e) => busy(e.currentTarget, async () => downloadBlob(`${name}.pdf`, await pdf())), "vol"),
    button("Alle slides PNG (ZIP)", (e) => busy(e.currentTarget, async () => downloadBlob(`${name}-png.zip`, await zipOf("png")))),
    button("Alle slides JPG (ZIP)", (e) => busy(e.currentTarget, async () => downloadBlob(`${name}-jpg.zip`, await zipOf("jpg")))),
    button("Deze slide PNG", (e) => busy(e.currentTarget, async () => downloadBlob(`${name}-${String(current + 1).padStart(2, "0")}.png`, await exportBuilt(built, "png"))))
  );

  renderTabs();
  renderSlideForm();
  refresh();
  const sharedSlots = spec.slots.filter((s) => sharedIds.has(s.id));
  return h(
    "div",
    { class: "gt-tab" },
    h("div", { class: "gt-kolom gt-instellingen" },
      h("h3", { class: "gt-kop3" }, `${spec.name}: voor alle slides`),
      slotFields(sharedSlots, shared, (k, v) => { shared[k] = v; refresh(); }),
      h("div", { class: "gt-rij" }, button("Nieuwe gradientvorm", () => { seed = newSeed(); refresh(); })),
      h("hr", { class: "gt-lijn" }),
      tabs,
      carousel.minSlides !== carousel.maxSlides ? h("div", { class: "gt-rij" }, moveBtn(-1, "← Naar voren"), moveBtn(1, "Naar achteren →"), removeBtn) : null,
      slideForm,
      actions
    ),
    h("div", { class: "gt-kolom gt-voorbeeld" }, view.el, warnings)
  );
}
