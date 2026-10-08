// Gobsmacked maaktool voor gobsmacked.agency/brand.
// Laadt zich op de Webflow-pagina in:
//   <div id="gobsmacked-tool"></div>                 de hele tool met tabs
//   <div data-gobsmacked-tool="gradients"></div>     één onderdeel los (gradients, social, onboarding)
// Niets wordt opgeslagen: alles gebeurt in de browser en wat klaar is, wordt direct gedownload.
import css from "./style.css";
import { h } from "./ui.js";
import { gradientsTab } from "./tab-gradients.js";
import { socialTab } from "./tab-social.js";
import { onboardingTab } from "./tab-onboarding.js";

const TABS = [
  { id: "gradients", label: "Gradients", make: gradientsTab },
  { id: "social", label: "Social posts", make: socialTab },
  { id: "onboarding", label: "Onboarding", make: onboardingTab },
];

function mount(host) {
  if (host.dataset.gtMounted) return;
  host.dataset.gtMounted = "true";
  if (!document.getElementById("gt-style")) document.head.append(h("style", { id: "gt-style" }, css));

  // Eén onderdeel los, zonder tabs (bv. de gradientmaker midden in Beeldtaal).
  const only = TABS.find((t) => t.id === host.dataset.gobsmackedTool);
  if (only) {
    host.replaceChildren(h("div", { class: "gt gt-los" }, only.make()));
    return;
  }

  const panels = {};
  const body = h("div", { class: "gt-body" });
  const tabButtons = TABS.map((t) =>
    h("button", { type: "button", role: "tab", class: "gt-tabknop", id: `gt-tab-${t.id}`, "aria-selected": "false", onClick: () => show(t.id) }, t.label)
  );
  function show(id) {
    for (const [i, t] of TABS.entries()) tabButtons[i].setAttribute("aria-selected", String(t.id === id));
    // Een tab wordt pas gebouwd als hij voor het eerst open gaat, en blijft daarna staan.
    if (!panels[id]) panels[id] = h("div", { role: "tabpanel", "aria-labelledby": `gt-tab-${id}` }, TABS.find((t) => t.id === id).make());
    body.replaceChildren(panels[id]);
    try { localStorage.setItem("gt-tab", id); } catch {}
  }

  host.replaceChildren(h("div", { class: "gt" }, h("div", { class: "gt-tabs", role: "tablist", "aria-label": "Maaktool" }, tabButtons), body));
  let start = TABS[0].id;
  try { start = TABS.find((t) => t.id === localStorage.getItem("gt-tab"))?.id ?? start; } catch {}
  const fromHash = TABS.find((t) => location.hash === `#maak-${t.id}`);
  show(fromHash?.id ?? start);
}

function init() {
  document.querySelectorAll("#gobsmacked-tool, [data-gobsmacked-tool]").forEach(mount);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
