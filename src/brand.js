// Merkdata van Gobsmacked (uit content/brands/gobsmacked/brand.json in het brand platform).
// Logo's en font zitten als data-URL in de bundel, zodat exports nooit afhangen van een
// externe bron (een canvas met een externe afbeelding mag niet meer geëxporteerd worden).
import woordmerkWit from "../assets/logos/gobsmacked-woordmerk-wit.svg";
import woordmerkMidnight from "../assets/logos/gobsmacked-woordmerk-midnight.svg";
import beeldmerkWit from "../assets/logos/gobsmacked-beeldmerk-wit.svg";
import beeldmerkMidnight from "../assets/logos/gobsmacked-beeldmerk-midnight.svg";
import plexSans from "../assets/fonts/IBMPlexSans-var.woff2";

export const BRAND = {
  slug: "gobsmacked",
  language: "nl",
  fonts: [
    { name: "IBM Plex Sans", role: "kop", weight: 700, fallback: "Arial, sans-serif" },
    { name: "IBM Plex Sans", role: "tekst", weight: 400, fallback: "Arial, sans-serif" },
  ],
  logos: [
    { label: "Woordmerk, wit", file: woordmerkWit, background: "donker" },
    { label: "Woordmerk, Midnight Blue", file: woordmerkMidnight },
    { label: "Beeldmerk, wit", file: beeldmerkWit, background: "donker" },
    { label: "Beeldmerk, Midnight Blue", file: beeldmerkMidnight },
  ],
  tokens: {
    colors: {
      donker: "#090715",
      licht: "#FFFFFF",
      "op-licht": "#090715",
      markering: "#FFFFFF",
      "op-markering": "#090715",
      achtergrond: "#090715",
      "op-achtergrond": "#FFFFFF",
      tag: "#FFFFFF",
      "op-tag": "#090715",
      "op-foto": "#FFFFFF",
      merk: "#21FDE5",
      "merk-licht": "#21FDE5",
      "gloed-links": "#780B4B",
      "gloed-rechts": "#21FDE5",
    },
  },
};

// Variabel font (latin-subset), dekt alle gewichten die de templates gebruiken.
export const FONT_FACE_CSS = `@font-face { font-family: "IBM Plex Sans"; font-style: normal; font-weight: 100 700; src: url(${plexSans}) format("woff2"); }`;
