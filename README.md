# Gobsmacked maaktool

De tool op gobsmacked.agency/brand: gradients, social posts en onboarding-assets
(Monday, e-mailfoto + Outlook-handtekening, websitefoto, LinkedIn/Teams, teampost).
Alles draait in de browser; er wordt niets opgeslagen, alleen geëxporteerd.

- Templates komen uit het brand platform (`templates/gob-*`), "Blobs" heet hier "Gradient".
- `npm run build` maakt `dist/gobsmacked-brand-tool.js` (één bestand, alles erin).
- Lokaal testen: `dev/index.html` via een lokale server.
- Op Webflow: een element `<div id="gobsmacked-tool"></div>` op de pagina en het script
  via jsDelivr: `https://cdn.jsdelivr.net/gh/<account>/gobsmacked-brand-tool@<versie>/dist/gobsmacked-brand-tool.js`.
