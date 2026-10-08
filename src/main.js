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
    const panel = h("div", { class: "gt gt-los" }, only.make());
    host.replaceChildren(panel);
    fullBleed(host, panel);
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

/**
 * Laat het witte vlak over de hele breedte van de sectie lopen (een witte band), terwijl de
 * inhoud uitgelijnd blijft met de tekst van de sectie. Webflow bepaalt de kolombreedte, dus
 * dit wordt gemeten en bij elke maatverandering opnieuw gezet.
 */
function fullBleed(host, panel) {
  const section = host.closest("section") ?? document.body;
  const apply = () => {
    const s = section.getBoundingClientRect();
    const r = host.getBoundingClientRect();
    const left = Math.max(0, Math.round(r.left - s.left));
    const right = Math.max(0, Math.round(s.right - r.right));
    Object.assign(panel.style, {
      marginLeft: `-${left}px`,
      marginRight: `-${right}px`,
      paddingLeft: `${Math.max(left, 16)}px`,
      paddingRight: `${Math.max(right, 16)}px`,
    });
  };
  apply();
  new ResizeObserver(apply).observe(section);
  window.addEventListener("resize", apply);
}

function init() {
  document.querySelectorAll("#gobsmacked-tool, [data-gobsmacked-tool]").forEach(mount);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
