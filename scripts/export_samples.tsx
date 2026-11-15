import React from "react";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmBrief } from "../src/components/Planning";
import BasinMap, { prepareGeometry } from "../src/components/BasinMap";
import { DEFAULT_PROFILE, ROTATIONS } from "../src/lib/catalog";
import { scoreRotation } from "../src/lib/engine";
import type { Example, Manifest } from "../src/lib/types";
const read = (p: string) =>
  JSON.parse(readFileSync("public/data/" + p, "utf8"));
const m = read("manifest.json") as Manifest,
  site = m.sites.find((s) => s.id === "griffith")!,
  x = read("example/griffith.json") as Example;
const profile = {
  ...structuredClone(DEFAULT_PROFILE),
  ph: "6.2",
  weights: [5, 0, 5, 5],
};
const scenario = {
  warming: 0,
  rainfall: 0,
  heavy: 0,
  season: "all",
  runoff: 0,
};
const score = scoreRotation(
  ROTATIONS[3],
  x.days,
  profile,
  0.3,
  6.2,
  x.imerg,
  "SYNTHETIC IMERG Final",
);
const css = readFileSync("src/style.css", "utf8");
mkdirSync("docs/preview", { recursive: true });
const html = renderToStaticMarkup(
  <FarmBrief
    score={score}
    site={site}
    mode="example"
    start="2016-01-01"
    end="2025-12-31"
    scenario={scenario}
    profile={profile}
    sources={m.sources.filter((s) => s.mode === "example")}
    ph={6.2}
    moisture={0.3}
  />,
);
writeFileSync(
  "docs/preview/Example_Griffith_Farm_Brief.html",
  `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Field Shift - Example Griffith brief</title><style>${css}\nbody{padding:30px}.app-screen{display:block}@media print{body{padding:0}.app-screen{display:block!important}.no-print{display:none!important}}</style></head><body><div class="app-screen">${html}</div></body></html>`,
);
writeFileSync(
  "docs/preview/sample-plan.json",
  JSON.stringify(
    {
      site,
      mode: "example",
      profile,
      scenario,
      score,
      sources: m.sources.filter((s) => s.mode === "example"),
      note: "Generated from same engine and React brief component; not a browser print capture",
    },
    null,
    2,
  ),
);
const geo = Object.fromEntries(
  Object.entries(m.boundaries).map(([k, v]) => [k, prepareGeometry(read(v))]),
);
const map = renderToStaticMarkup(
  <BasinMap
    geo={geo}
    sites={m.sites}
    area={null}
    onArea={() => {}}
    onSite={() => {}}
    grid={x}
    mode="real"
    layer="weather"
    depth="root"
    threeD={false}
    setThreeD={() => {}}
  />,
);
const svg = map
  .slice(map.indexOf("<svg"), map.indexOf("</svg>") + 6)
  .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
writeFileSync("docs/preview/Full_Basin_Map.svg", svg);
console.log("Exported example brief HTML, plan JSON and full-basin SVG.");
