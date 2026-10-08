// Alle templates van de tool. HTML en JSON komen ongewijzigd uit het brand platform
// (templates/<id>/), alleen "Blobs" heet hier "Gradient".
import photoHtml from "../templates/gob-photo/template.html";
import photo from "../templates/gob-photo/template.json";
import statementHtml from "../templates/gob-statement/template.html";
import statement from "../templates/gob-statement/template.json";
import quoteHtml from "../templates/gob-quote/template.html";
import quote from "../templates/gob-quote/template.json";
import teamHtml from "../templates/gob-team/template.html";
import team from "../templates/gob-team/template.json";
import caseHtml from "../templates/gob-case-carousel/template.html";
import caseCarousel from "../templates/gob-case-carousel/template.json";
import vacancyHtml from "../templates/gob-vacancy/template.html";
import vacancy from "../templates/gob-vacancy/template.json";
import bannerHtml from "../templates/gob-linkedin-banner/template.html";
import banner from "../templates/gob-linkedin-banner/template.json";
import mondayHtml from "../templates/gob-monday/template.html";
import monday from "../templates/gob-monday/template.json";
import emailPhotoHtml from "../templates/gob-email-photo/template.html";
import emailPhoto from "../templates/gob-email-photo/template.json";
import websiteHtml from "../templates/gob-website-photo/template.html";
import website from "../templates/gob-website-photo/template.json";
import profileHtml from "../templates/gob-profile/template.html";
import profile from "../templates/gob-profile/template.json";

const all = [
  [photo, photoHtml],
  [statement, statementHtml],
  [quote, quoteHtml],
  [team, teamHtml],
  [caseCarousel, caseHtml],
  [vacancy, vacancyHtml],
  [banner, bannerHtml],
  [monday, mondayHtml],
  [emailPhoto, emailPhotoHtml],
  [website, websiteHtml],
  [profile, profileHtml],
];

export const TEMPLATES = Object.fromEntries(all.map(([spec, html]) => [spec.id, { spec, html }]));

/** Wat de tool aanbiedt onder Social posts, in deze volgorde. */
export const SOCIAL_IDS = ["gob-photo", "gob-statement", "gob-quote", "gob-team", "gob-case-carousel", "gob-vacancy", "gob-linkedin-banner"];
