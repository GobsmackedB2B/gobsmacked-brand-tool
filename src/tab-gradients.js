// Tab Gradients: losse achtergronden in elk formaat, in de vijf vaste varianten.
import { zipSync } from "fflate";
import { VARIANTS, backgroundSvg, svgToCanvas } from "./gradient.js";
import { canvasToBlob } from "./render.js";
import { h, button, choices, downloadBlob, busy } from "./ui.js";

const FORMATS = [
  { id: "16x9", label: "16:9", sub: "1920 × 1080", w: 1920, h: 1080 },
  { id: "9x16", label: "9:16", sub: "1080 × 1920", w: 1080, h: 1920 },
  { id: "4x5", label: "4:5", sub: "1080 × 1350", w: 1080, h: 1350 },
  { id: "1x1", label: "1:1", sub: "1080 × 1080", w: 1080, h: 1080 },
  { id: "eigen", label: "Eigen maat", sub: "breedte × hoogte" },
];

const newSeed = () => Math.floor(Math.random() * 1e9);

export function gradientsTab() {
  const state = { format: "16x9", w: 1920, h: 1080, variant: "hoeken", swap: false, seed: newSeed() };

  const stage = h("div", { class: "gt-podium" });
  const info = h("p", { class: "gt-info" });

  const draw = () => {
    stage.innerHTML = backgroundSvg(state);
    const svg = stage.querySelector("svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Gradient ${state.w} × ${state.h}`);
    const variant = VARIANTS.find((v) => v.id === state.variant).label;
    info.textContent = `${state.w} × ${state.h} px · ${variant}${state.swap ? " · kleuren gewisseld" : ""}`;
  };

  const wInput = h("input", { class: "gt-invoer gt-maat", type: "number", min: 100, max: 6000, value: 1920, "aria-label": "Breedte in pixels" });
  const hInput = h("input", { class: "gt-invoer gt-maat", type: "number", min: 100, max: 6000, value: 1080, "aria-label": "Hoogte in pixels" });
  const custom = h("div", { class: "gt-rij gt-eigen", hidden: true }, wInput, h("span", {}, "×"), hInput, h("span", {}, "px"));
  const readCustom = () => {
    const clamp = (v) => Math.max(100, Math.min(6000, Math.round(Number(v) || 0)));
    state.w = clamp(wInput.value);
    state.h = clamp(hInput.value);
    draw();
  };
  wInput.addEventListener("change", readCustom);
  hInput.addEventListener("change", readCustom);

  const formats = choices(FORMATS, state.format, (id) => {
    state.format = id;
    const f = FORMATS.find((x) => x.id === id);
    custom.hidden = id !== "eigen";
    if (f.w) Object.assign(state, { w: f.w, h: f.h });
    else readCustom();
    draw();
  }, { label: "Formaat" });

  const variants = choices(VARIANTS, state.variant, (id) => { state.variant = id; draw(); }, { label: "Variant" });

  const swapBtn = button("Wissel kleuren", () => {
    state.swap = !state.swap;
    swapBtn.setAttribute("aria-pressed", String(state.swap));
    draw();
  });
  swapBtn.setAttribute("aria-pressed", "false");

  const fileName = (variant = state.variant) => `gobsmacked-gradient-${variant}-${state.w}x${state.h}.png`;
  const render = async (variant = state.variant) => {
    const canvas = await svgToCanvas(backgroundSvg({ ...state, variant }), state.w, state.h);
    return canvasToBlob(canvas, "image/png");
  };

  const downloadOne = button("Download PNG", (e) => busy(e.currentTarget, async () => downloadBlob(fileName(), await render())), "vol");
  const downloadAll = button("Alle 5 varianten (ZIP)", (e) =>
    busy(e.currentTarget, async () => {
      const files = {};
      for (const v of VARIANTS) files[fileName(v.id)] = new Uint8Array(await (await render(v.id)).arrayBuffer());
      downloadBlob(`gobsmacked-gradients-${state.w}x${state.h}.zip`, new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }));
    })
  );

  draw();
  return h(
    "div",
    { class: "gt-tab" },
    h("div", { class: "gt-kolom gt-instellingen" },
      h("h3", { class: "gt-kop3" }, "Formaat"), formats.el, custom,
      h("h3", { class: "gt-kop3" }, "Variant"), variants.el,
      h("div", { class: "gt-rij" }, button("Nieuwe vorm", () => { state.seed = newSeed(); draw(); }), swapBtn),
      h("div", { class: "gt-acties" }, downloadOne, downloadAll)
    ),
    h("div", { class: "gt-kolom gt-voorbeeld" }, stage, info)
  );
}
