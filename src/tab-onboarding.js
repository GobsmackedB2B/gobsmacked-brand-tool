// Tab Onboarding: één foto en een paar gegevens, en alle formaten die een nieuwe collega nodig
// heeft komen eruit: Monday, e-mailfoto + handtekening, website, LinkedIn/Teams en de teampost.
import { zipSync } from "fflate";
import { TEMPLATES } from "./templates.js";
import { buildTemplate, defaultContent, readPhoto } from "./render.js";
import { buildSignatureHtml, copySignature } from "./signature.js";
import { VARIANTS } from "./gradient.js";
import { h, button, choices, field, textInput, fileInput, downloadBlob, busy, preview, exportBuilt, slugify, fitList, photoTarget, intro } from "./ui.js";

const PERSON = [
  { id: "name", label: "Naam", placeholder: "Robin Jansen", maxChars: 40 },
  { id: "role", label: "Functie", placeholder: "Strategisch marketeer", maxChars: 50 },
  { id: "availability", label: "Beschikbaarheid", placeholder: "Available: Monday, Tuesday, Thursday, Friday", maxChars: 70, hint: "Leeg laten als je fulltime werkt" },
  { id: "phone", label: "Telefoon", placeholder: "+31 6 12 34 56 78", maxChars: 24 },
  { id: "email", label: "E-mailadres", placeholder: "robin@gobsmacked.agency", maxChars: 50 },
  { id: "location", label: "Locatie", placeholder: "Wijchen, The Netherlands", maxChars: 40 },
];

export function onboardingTab() {
  const person = Object.fromEntries(PERSON.map((p) => [p.id, ""]));
  const state = {
    photo: "",
    monday: defaultContent(TEMPLATES["gob-monday"].spec),
    website: defaultContent(TEMPLATES["gob-website-photo"].spec),
    profile: defaultContent(TEMPLATES["gob-profile"].spec),
    team: defaultContent(TEMPLATES["gob-team"].spec),
    teamSeed: Math.floor(Math.random() * 1e9),
  };
  const slug = () => slugify(person.name || "nieuwe-collega");
  const firstName = () => person.name.trim().split(/\s+/)[0] ?? "";

  // ---- Uitvoer: elk formaat is een kaart met preview, eigen keuzes en een downloadknop ----
  const outputs = [];
  const card = ({ title, sub, templateId, content, file, type, options = [], seed }) => {
    const warnings = h("div");
    const spec = TEMPLATES[templateId].spec;
    const view = preview({
      maxWidth: 300,
      maxHeight: 300,
      onFit: (issues) => warnings.replaceChildren(fitList(issues, Object.fromEntries(spec.slots.map((s) => [s.id, s.label]))) ?? ""),
    });
    let built = null;
    let pending = 0;
    const output = {
      file: () => `${slug()}-${file}.${type}`,
      async refresh() {
        const mine = ++pending;
        const b = await buildTemplate(templateId, { ...content(), photo: state.photo }, { seed: seed?.() });
        if (mine !== pending) return;
        built = b;
        view.update(built);
      },
      async blob() {
        const b = await buildTemplate(templateId, { ...content(), photo: state.photo }, { seed: seed?.() });
        return exportBuilt(b, type);
      },
      get built() { return built; },
    };
    outputs.push(output);
    const el = h(
      "div",
      { class: "gt-uitvoer" },
      h("div", { class: "gt-uitvoer-kop" }, h("h4", { class: "gt-kop4" }, title), h("span", { class: "gt-hint" }, sub)),
      view.el,
      warnings,
      ...options,
      h("div", { class: "gt-acties" }, button(`Download ${type.toUpperCase()}`, (e) => busy(e.currentTarget, async () => downloadBlob(output.file(), await output.blob())), "vol"))
    );
    return { el, output };
  };

  const mondaySpec = TEMPLATES["gob-monday"].spec;
  const ringSlot = mondaySpec.slots.find((s) => s.id === "ring");
  const ringSelect = h("select", { class: "gt-invoer" }, ringSlot.options.map((o) => h("option", { value: o.id }, o.label)));
  ringSelect.value = state.monday.ring;
  const monday = card({
    title: "Monday",
    sub: "836 × 828, transparant",
    templateId: "gob-monday",
    content: () => state.monday,
    file: "monday",
    type: "png",
    options: [
      field("Kleur van de ring", ringSelect),
      field("Uitsnede", choices(mondaySpec.slots.find((s) => s.id === "focus").options, state.monday.focus, (v) => { state.monday.focus = v; monday.output.refresh(); }).el),
    ],
  });
  ringSelect.addEventListener("change", () => { state.monday.ring = ringSelect.value; monday.output.refresh(); });

  const email = card({ title: "E-mailfoto", sub: "250 × 250, voor de handtekening", templateId: "gob-email-photo", content: () => ({}), file: "email", type: "png" });

  const website = card({
    title: "Website",
    sub: "687 × 916, zoals op de pagina Over ons",
    templateId: "gob-website-photo",
    content: () => state.website,
    file: "website",
    type: "jpg",
    options: [field("Uitsnede", choices(TEMPLATES["gob-website-photo"].spec.slots[1].options, state.website.focus, (v) => { state.website.focus = v; website.output.refresh(); }).el)],
  });

  const profile = card({
    title: "LinkedIn en Teams",
    sub: "800 × 800, profielfoto",
    templateId: "gob-profile",
    content: () => state.profile,
    file: "profielfoto",
    type: "png",
    options: [field("Uitsnede", choices(TEMPLATES["gob-profile"].spec.slots[1].options, state.profile.focus, (v) => { state.profile.focus = v; profile.output.refresh(); }).el)],
  });

  const team = card({
    title: "Teampost",
    sub: "1080 × 1350, voor LinkedIn en Instagram",
    templateId: "gob-team",
    content: () => ({ ...state.team, name: firstName(), role: person.role }),
    file: "teampost",
    type: "png",
    seed: () => state.teamSeed,
    options: [
      field("Label", textInput(state.team.label, (v) => { state.team.label = v; team.output.refresh(); }, { maxChars: 28 })),
      field("Gradient", choices(VARIANTS, state.team.blob, (v) => { state.team.blob = v; team.output.refresh(); }).el),
      h("div", { class: "gt-rij" }, button("Nieuwe gradientvorm", () => { state.teamSeed = Math.floor(Math.random() * 1e9); team.output.refresh(); })),
    ],
  });

  // ---- Handtekening ----
  const sigView = h("div", { class: "gt-handtekening" });
  let sigHtml = "";
  const refreshSignature = async () => {
    const photo = await blobToDataUrl(await email.output.blob());
    sigHtml = buildSignatureHtml(person, photo);
    sigView.innerHTML = sigHtml;
  };
  const signature = h(
    "div",
    { class: "gt-uitvoer gt-uitvoer-breed" },
    h("div", { class: "gt-uitvoer-kop" }, h("h4", { class: "gt-kop4" }, "Outlook-handtekening"), h("span", { class: "gt-hint" }, "Kopieer en plak in Outlook bij Instellingen, Handtekeningen")),
    sigView,
    h(
      "div",
      { class: "gt-acties" },
      button("Kopieer handtekening", (e) => busy(e.currentTarget, async () => { await refreshSignature();  await copySignature(sigHtml); }), "vol"),
      button("Download HTML", (e) => busy(e.currentTarget, async () => { await refreshSignature(); downloadBlob(`${slug()}-handtekening.html`, new Blob([`<!doctype html><meta charset="utf-8">${sigHtml}`], { type: "text/html" })); }))
    )
  );

  // ---- Invoer ----
  const refreshAll = () => {
    for (const o of outputs) o.refresh();
    refreshSignature();
  };
  let typing = null;
  const personFields = PERSON.map((p) =>
    field(p.label, textInput("", (v) => { person[p.id] = v; clearTimeout(typing); typing = setTimeout(() => { team.output.refresh(); refreshSignature(); }, 250); }, { maxChars: p.maxChars, placeholder: p.placeholder }), p.hint)
  );
  const photoName = h("span", { class: "gt-hint" }, "Staand, hoofd boven het midden. Slepen kan ook.");
  const dropZone = h("div", { class: "gt-dropzone" },
    fileInput(async (file) => { photoName.textContent = file.name; state.photo = await readPhoto(file); refreshAll(); }, "Kies een foto"),
    photoName
  );
  photoTarget(dropZone, () => dropZone.querySelector("input[type=file]"), { click: false });
  const photoField = h("div", { class: "gt-veld" }, h("span", { class: "gt-veld-naam" }, "Foto"), dropZone);

  const downloadAll = button("Download alles (ZIP)", (e) =>
    busy(e.currentTarget, async () => {
      await refreshSignature();
      const files = {};
      for (const o of outputs) files[o.file()] = new Uint8Array(await (await o.blob()).arrayBuffer());
      files[`${slug()}-handtekening.html`] = new TextEncoder().encode(`<!doctype html><meta charset="utf-8">${sigHtml}`);
      downloadBlob(`${slug()}-onboarding.zip`, new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }));
    }), "vol");

  refreshAll();
  return h(
    "div",
    {},
    intro("Alle formaten voor een nieuwe collega, uit één foto.", [
      "Upload een staande foto.",
      "Vul de gegevens in.",
      "Download los of alles in één ZIP.",
    ]),
    h(
    "div",
    { class: "gt-tab" },
    h("div", { class: "gt-kolom gt-instellingen" }, h("h3", { class: "gt-kop3" }, "Nieuwe collega"), photoField, personFields, h("div", { class: "gt-acties" }, downloadAll)),
    h("div", { class: "gt-kolom gt-voorbeeld" }, h("div", { class: "gt-uitvoer-raster" }, monday.el, email.el, website.el, profile.el, team.el, signature))
    )
  );
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
