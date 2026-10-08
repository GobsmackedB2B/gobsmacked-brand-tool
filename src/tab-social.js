// Tab Social posts: de gob-*-templates uit het brand platform, losse posts en carrousels.
import { zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { TEMPLATES, SOCIAL_IDS } from "./templates.js";
import { buildTemplate, defaultContent, slotsFor, slideContents, readPhoto, rasterize, canvasToBlob } from "./render.js";
import { h, button, choices, field, textInput, fileInput, downloadBlob, busy, preview, exportBuilt, fitList, photoTarget, intro } from "./ui.js";
import { gradientThumb } from "./gradient.js";

const newSeed = () => Math.floor(Math.random() * 1e9);
const today = () => new Date().toISOString().slice(0, 10);

export function socialTab() {
  const host = h("div", { class: "gt-tab-social" });
  const editors = {}; // per template bewaard zolang de pagina open is, zodat wisselen niets wist
  const cards = {};
  const picker = h(
    "div",
    { class: "gt-kaarten" },
    SOCIAL_IDS.map((id) => {
      const { spec } = TEMPLATES[id];
      const kind = spec.carousel ? "Carrousel" : spec.type === "social-story" ? "Story" : "Post";
      const thumb = preview({ maxWidth: 140, maxHeight: 175 });
      buildTemplate(id, spec.carousel ? slideContents(spec, defaultContent(spec), spec.carousel.slides)[0] : defaultContent(spec), { seed: 11 }).then(thumb.update);
      cards[id] = h(
        "button",
        { type: "button", class: "gt-kaart", onClick: () => open(id) },
        h("span", { class: "gt-kaart-beeld" }, thumb.el),
        h("span", { class: "gt-kaart-soort" }, kind),
        h("span", { class: "gt-kaart-naam" }, spec.name),
        h("span", { class: "gt-kaart-maat" }, `${spec.width} × ${spec.height}`)
      );
      return cards[id];
    })
  );
  const editorHost = h("div");
  host.append(
    intro(
      "Posts, stories en carrousels voor LinkedIn en Instagram, in de huisstijl. Logo, kleuren en opmaak staan al goed; jij vult alleen foto en tekst in.",
      [
        "Kies een template.",
        "Vul foto en tekst in. Een foto kun je ook op het voorbeeld slepen. Past een tekst niet, dan zie je een melding onder het voorbeeld.",
        "Download als PNG of JPG. Carrousels download je als PDF voor LinkedIn, of als losse slides.",
      ],
      "Wat je invult blijft staan als je even een ander template bekijkt, tot je de pagina ververst. Er wordt niets opgeslagen."
    ),
    h("div", { class: "gt-breed" }, picker),
    editorHost
  );

  function open(id) {
    for (const [cid, card] of Object.entries(cards)) card.setAttribute("aria-pressed", String(cid === id));
    editors[id] ??= TEMPLATES[id].spec.carousel ? carouselEditor(id) : postEditor(id);
    editorHost.replaceChildren(editors[id]);
  }
  open(SOCIAL_IDS[0]);
  return host;
}

// Volgorde in het formulier: eerst de inhoud (foto, tekst), dan de vorm (keuzes, gradient).
const ORDER = { image: 0, text: 1, date: 1, select: 1, variant: 2 };
const orderOf = (slot) => (slot.id === "blob" ? 3 : ORDER[slot.type] ?? 2);

/** Formuliervelden voor een set slots. size: { w, h } van het template, voor de gradientvoorbeelden. */
function slotFields(slots, content, onChange, size) {
  return slots
    .filter((s) => s.type !== "brand-logo" && s.id !== "counter")
    .sort((a, b) => orderOf(a) - orderOf(b))
    .map((slot) => {
      if (slot.type === "variant") {
        const options = slot.options.map((o) =>
          slot.id === "blob" && size
            ? { ...o, thumb: o.id === "geen" ? null : gradientThumb(o.id, size.w, size.h), swatch: o.id === "geen" ? "#090715" : null }
            : o.preview ? { ...o, swatch: o.preview } : o
        );
        return field(slot.label, choices(options, content[slot.id], (v) => onChange(slot.id, v), { label: slot.label }).el);
      }
      if (slot.type === "image") {
        const name = h("span", { class: "gt-hint" }, content[slot.id] ? "Foto gekozen" : "Of sleep een foto op het voorbeeld");
        return field(
          slot.label,
          h("div", { class: "gt-rij" }, fileInput(async (file) => { name.textContent = file.name; onChange(slot.id, await readPhoto(file)); }), name)
        );
      }
      const multiline = (slot.maxChars ?? 0) > 60;
      const count = h("span", { class: "gt-teller" });
      const setCount = (v) => (count.textContent = slot.maxChars ? `${v.length} / ${slot.maxChars}` : "");
      setCount(content[slot.id] ?? "");
      const input = textInput(content[slot.id], (v) => { setCount(v); onChange(slot.id, v); }, { maxChars: slot.maxChars, multiline, placeholder: slot.placeholder });
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
    button("Download JPG", (e) => busy(e.currentTarget, async () => downloadBlob(`${base}.jpg`, await exportBuilt(built, "jpg")))),
    spec.overlayExport
      ? button("Alleen overlay (transparante PNG)", (e) =>
          busy(e.currentTarget, async () => downloadBlob(`${base}-overlay.png`, await exportBuilt(await buildTemplate(id, content, { seed, overlay: true }), "png")))
        )
      : null
  );

  refresh();
  const size = { w: spec.width, h: spec.height };
  const form = h("div", { class: "gt-kolom gt-instellingen" },
    h("h3", { class: "gt-kop3" }, spec.name),
    slotFields(spec.slots, content, onChange, size),
    hasGradient ? h("div", { class: "gt-rij" }, button("Nieuwe gradientvorm", () => { seed = newSeed(); refresh(); })) : null
  );
  if (spec.slots.some((s) => s.type === "image")) photoTarget(view.el, () => form.querySelector("input[type=file]"));
  return h(
    "div",
    { class: "gt-tab" },
    form,
    h("div", { class: "gt-kolom gt-voorbeeld" }, view.el, warnings, actions)
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
  const layoutLabel = (layout) => layoutSlot?.options.find((o) => o.id === layout)?.label ?? layout;
  const canEditSlides = carousel.minSlides !== carousel.maxSlides;
  // Eerste tekstveld van een slide, als herkenning in de lijst.
  const snippet = (slide) => {
    const first = slotsFor(spec, slide.layout).find((s) => s.type === "text" && !sharedIds.has(s.id) && s.id !== carousel.counterSlot && slide[s.id]);
    const text = first ? String(slide[first.id]) : "";
    return text.length > 34 ? text.slice(0, 33) + "…" : text;
  };

  const select = (i) => { current = i; renderTabs(); renderSlideForm(); refresh(); };
  const position = h("span", { class: "gt-slide-positie" });
  const prevBtn = button("← Vorige", () => current > 0 && select(current - 1));
  const nextBtn = button("Volgende →", () => current < slides.length - 1 && select(current + 1));
  const navBar = h("div", { class: "gt-slide-nav" }, prevBtn, position, nextBtn);

  const renderSlideForm = () => {
    const slide = slides[current];
    const own = slotsFor(spec, slide.layout).filter(
      (s) => !sharedIds.has(s.id) && s.id !== carousel.counterSlot && s.id !== carousel.layoutSlot
    );
    // Lege plekken (null) en lijsten van velden plat slaan; replaceChildren zet die anders als tekst neer.
    const parts = [
      h("h3", { class: "gt-kop3" }, `Stap 2 · Tekst en foto van slide ${current + 1}`),
      canEditSlides
        ? field("Layout van deze slide", choices(layoutSlot.options, slide.layout, (v) => { slides[current] = { ...slideFor({ layout: v }), ...pick(slide, v) }; renderTabs(); renderSlideForm(); refresh(); }).el)
        : null,
      ...(own.length
        ? slotFields(own, slide, (k, v) => { slide[k] = v; renderTabs(); refresh(); }, { w: spec.width, h: spec.height })
        : [h("p", { class: "gt-hint" }, "Deze slide heeft geen eigen tekst of foto.")]),
      canEditSlides
        ? h("div", { class: "gt-rij" }, moveBtn(-1, "← Eerder"), moveBtn(1, "Later →"), removeBtn)
        : null
    ];
    slideForm.replaceChildren(...parts.flat().filter(Boolean));
    position.textContent = `Slide ${current + 1} van ${slides.length} · ${layoutLabel(slide.layout)}`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
  };
  // Behoud wat al ingevuld was als de layout wisselt (alleen velden die de nieuwe layout kent).
  const pick = (slide, layout) => {
    const allowed = new Set(slotsFor(spec, layout).map((s) => s.id));
    return Object.fromEntries(Object.entries(slide).filter(([k]) => allowed.has(k) && k !== "layout"));
  };

  const renderTabs = () => {
    tabs.replaceChildren(
      ...slides.map((s, i) =>
        h(
          "button",
          { type: "button", role: "tab", class: "gt-slide-item", "aria-selected": String(i === current), onClick: () => select(i) },
          h("span", { class: "gt-slide-nr" }, String(i + 1).padStart(2, "0")),
          h("span", { class: "gt-slide-tekst" }, h("strong", {}, layoutLabel(s.layout)), snippet(s) ? h("span", {}, snippet(s)) : null)
        )
      ),
      canEditSlides && slides.length < carousel.maxSlides
        ? h("button", { type: "button", class: "gt-slide-item gt-plus", onClick: () => { slides.splice(slides.length - 1, 0, slideFor(carousel.newSlide ?? { layout: slides[0].layout })); select(slides.length - 2); } }, "+ Slide toevoegen")
        : ""
    );
  };

  const removeBtn = button("Verwijderen", () => {
    if (slides.length <= carousel.minSlides) return;
    slides.splice(current, 1);
    select(Math.max(0, current - 1));
  });
  const moveBtn = (dir, label) => button(label, () => {
    const to = current + dir;
    if (to < 0 || to >= slides.length) return;
    [slides[current], slides[to]] = [slides[to], slides[current]];
    select(to);
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
  photoTarget(view.el, () => slideForm.querySelector("input[type=file]"));
  const sharedSlots = spec.slots.filter((s) => sharedIds.has(s.id));
  return h(
    "div",
    { class: "gt-tab" },
    h("div", { class: "gt-kolom gt-instellingen" },
      h("h3", { class: "gt-kop3" }, "Stap 1 · Kies een slide"),
      h("p", { class: "gt-hint gt-uitleg" }, "Klik op een slide om de tekst en foto ervan aan te passen."),
      tabs,
      h("hr", { class: "gt-lijn" }),
      slideForm,
      h("hr", { class: "gt-lijn" }),
      h("h3", { class: "gt-kop3" }, "Stap 3 · Voor alle slides"),
      slotFields(sharedSlots, shared, (k, v) => { shared[k] = v; refresh(); }, { w: spec.width, h: spec.height }),
      h("div", { class: "gt-rij" }, button("Nieuwe gradientvorm", () => { seed = newSeed(); refresh(); }))
    ),
    h("div", { class: "gt-kolom gt-voorbeeld" }, navBar, view.el, warnings, actions)
  );
}
