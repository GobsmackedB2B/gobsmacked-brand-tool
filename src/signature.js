// Outlook-handtekening, letterlijk overgenomen uit lib/signature.ts in het brand platform:
// alleen tabellen en inline styles, geen webfonts (Outlook valt toch terug).

const LINE_COLOR = "#090715";
const FONT = "'Trebuchet MS', Arial, sans-serif";
const WEBSITE = "www.gobsmacked.agency";
const TERMS = "https://www.gobsmacked.agency/terms-conditions";

const escape = (value) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function contactRow(content) {
  return `<tr><td style="padding:0;font-family:${FONT};font-size:12px;line-height:20px;color:#000000;">${content}</td></tr>`;
}

/** fields: { name, role, availability, phone, email, location } */
export function buildSignatureHtml(fields, photoSrc) {
  const f = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, escape(String(v ?? "").trim())]));
  const phoneHref = String(fields.phone ?? "").replace(/[^+\d]/g, "");
  const rows = [
    f.phone && contactRow(`<a href="tel:${phoneHref}" style="color:#000000;text-decoration:none;">${f.phone}</a>`),
    f.email && contactRow(`<a href="mailto:${f.email}" style="color:#000000;">${f.email}</a>`),
    contactRow(`<a href="https://${WEBSITE}/" style="color:#000000;">${WEBSITE}</a>`),
    f.location && contactRow(f.location),
  ]
    .filter(Boolean)
    .join("");

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${FONT};color:#000000;">
<tr>
<td width="150" style="padding:0 20px 0 0;vertical-align:middle;width:130px;min-width:130px;"><img src="${photoSrc}" width="130" height="130" alt="${f.name}" style="display:block;width:130px;height:130px;min-width:130px;max-width:none;object-fit:cover;border:0;" /></td>
<td style="padding:0 30px 0 0;vertical-align:middle;white-space:nowrap;">
<p style="margin:0;font-family:${FONT};font-size:22px;line-height:28px;font-weight:bold;color:#000000;">${f.name}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:#000000;">${f.role}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:#000000;">Gobsmacked&reg; B2B marketing agency</p>
</td>
<td style="width:1px;padding:0;border-left:1px solid ${LINE_COLOR};"></td>
<td style="padding:0 0 0 30px;vertical-align:middle;white-space:nowrap;">
${f.availability ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:bold;color:#242424;">${f.availability}</p>` : ""}
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>
</td>
</tr>
</table>
<p style="margin:16px 0 0;max-width:640px;font-family:${FONT};font-size:11px;line-height:16px;color:#242424;">Gobsmacked&reg; is een offici&euml;le merknaam van Gobsmacked B.V. Gobsmacked B.V. kan niet aansprakelijk worden gesteld voor onjuistheden en/of onvolledigheden in de verstrekte informatie. Dit e-mailbericht is vertrouwelijk. De <a href="${TERMS}" style="color:#242424;">algemene voorwaarden</a> van Gobsmacked B.V. zijn te allen tijde van toepassing en zijn te lezen via <a href="${TERMS}" style="color:#242424;">${TERMS}</a></p>
<p style="margin:8px 0 0;max-width:640px;font-family:${FONT};font-size:11px;line-height:16px;color:#242424;">Gobsmacked&reg; is an official trademark of Gobsmacked B.V. Gobsmacked B.V. cannot be held liable for inaccuracies and/or incompleteness in the provided information. This email message is confidential. The <a href="${TERMS}" style="color:#242424;">general terms and conditions</a> of Gobsmacked B.V. apply at all times and can be accessed via <a href="${TERMS}" style="color:#242424;">${TERMS}</a></p>`;
}

/** Kopieert de handtekening als opgemaakte tekst, zodat hij zo in Outlook geplakt kan worden. */
export async function copySignature(html) {
  if (navigator.clipboard && window.ClipboardItem) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  // Oudere browsers: via een tijdelijke selectie.
  const box = document.createElement("div");
  box.innerHTML = html;
  box.style.cssText = "position:fixed;left:-9999px;top:0;background:#fff;";
  document.body.append(box);
  const range = document.createRange();
  range.selectNodeContents(box);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand("copy");
  sel.removeAllRanges();
  box.remove();
}
