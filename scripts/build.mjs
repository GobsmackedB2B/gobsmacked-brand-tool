// Bouwt dist/gobsmacked-brand-tool.js: één bestand met alles erin (templates, logo's, font, CSS).
// node scripts/build.mjs           eenmalig
// node scripts/build.mjs --watch   bij elke wijziging opnieuw (voor dev/index.html)
import * as esbuild from "esbuild";

const options = {
  entryPoints: ["src/main.js"],
  outfile: "dist/gobsmacked-brand-tool.js",
  bundle: true,
  format: "iife",
  target: ["chrome110", "safari16", "firefox115"],
  minify: !process.argv.includes("--watch"),
  legalComments: "none",
  loader: { ".html": "text", ".css": "text", ".svg": "dataurl", ".woff2": "dataurl" },
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
