import { dates, valid } from "./math";
import type { Day, Example, Manifest, Site } from "./types";
export async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(
    ((import.meta as any).env?.BASE_URL ?? "/") + "data/" + path,
    { signal },
  );
  if (!r.ok) throw Error(`${path}: HTTP ${r.status}`);
  return r.json();
}
export function normalizePower(
  p: any,
  site: Site,
  start = "2016-01-01",
  end = "2025-12-31",
): Day[] {
  if (
    p.type !== "Feature" ||
    !p.header ||
    !p.properties?.parameter ||
    !p.parameters
  )
    throw Error("Invalid POWER response");
  if (
    Math.abs(p.geometry?.coordinates?.[0] - site.lon) > 0.025 ||
    Math.abs(p.geometry?.coordinates?.[1] - site.lat) > 0.025
  )
    throw Error("POWER response coordinate does not match selected sample");
  if (p.header.time_standard !== "LST")
    throw Error("POWER time standard must be LST");
  const pp = p.properties.parameter;
  for (const k of ["T2M_MAX", "T2M_MIN", "T2M", "PRECTOTCORR", "TS"])
    if (!pp[k]) throw Error(`Missing POWER variable ${k}`);
  if (
    p.parameters.PRECTOTCORR.units !== "mm/day" ||
    p.parameters.T2M_MAX.units !== "C"
  )
    throw Error("Unexpected POWER units");
  const fill = p.header.fill_value;
  if (!valid(fill)) throw Error("POWER provider fill code missing");
  const value = (key: string, d: string, min: number, max: number) => {
    const n = pp[key]?.[d.replaceAll("-", "")];
    return valid(n) && n !== fill && n >= min && n <= max ? n : null;
  };
  return dates(start, end).map((d) => {
    let max = value("T2M_MAX", d, -90, 65),
      min = value("T2M_MIN", d, -100, 60);
    if (max !== null && min !== null && min > max) {
      max = null;
      min = null;
    }
    const rain = value("PRECTOTCORR", d, 0, 2000),
      mean = value("T2M", d, -100, 65),
      skin = value("TS", d, -100, 90);
    return {
      date: d,
      rain,
      max,
      min,
      mean,
      skin,
      status:
        rain !== null && max !== null && min !== null ? "valid" : "missing",
    };
  });
}
export function validateSupplement(
  x: any,
  siteId: string,
  mode: "real" | "example",
) {
  if (x.mode !== mode || x.locationId !== siteId)
    throw Error("Layer mode or site does not match selected data contract");
  const seenDate = (rows: any[], keys: string[], lo: number, hi: number) => {
    const seen = new Set<string>();
    for (const r of rows) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || seen.has(r.date))
        throw Error("Invalid / duplicate layer date");
      seen.add(r.date);
      if (
        !["valid", "missing", "masked", "out-of-coverage", "failed"].includes(
          r.status,
        )
      )
        throw Error("Layer QA status missing");
      if (
        ["masked", "out-of-coverage", "failed"].includes(r.status) &&
        keys.some((k) => r[k] !== null)
      )
        throw Error("Masked or unavailable source value must be null");
      for (const k of keys)
        if (r[k] !== null && (!valid(r[k]) || r[k] < lo || r[k] > hi))
          throw Error(`Layer ${k} outside accepted range`);
    }
  };
  if (x.moisture) seenDate(x.moisture, ["surface", "root"], 0, 1);
  if (x.ndvi) seenDate(x.ndvi, ["value"], -1, 1);
  if (x.imerg) seenDate(x.imerg, ["rain"], 0, 2000);
  if (x.late) seenDate(x.late, ["rain"], 0, 2000);
  if (mode === "real" && !x.meta)
    throw Error("Processed real layer needs product and QA metadata");
  for (const g of x.grid || []) {
    for (const k of ["surface", "root"])
      if (g[k] !== null && (!valid(g[k]) || g[k] < 0 || g[k] > 1))
        throw Error("Invalid grid moisture");
    if (mode === "real" && (!g.bounds || g.bounds.length !== 4))
      throw Error("Real grid requires explicit cell bounds");
  }
  for (const p of x.flood || [])
    if (
      !["land", "water", "masked"].includes(p.ref) ||
      !["land", "water", "masked"].includes(p.event) ||
      !valid(p.areaKm2) ||
      p.areaKm2 < 0 ||
      (mode === "real" && !p.bounds)
    )
      throw Error("Invalid flood classes, area or support");
  return x;
}
export const emptySupplement = (): Example => ({
  days: [],
  grid: [],
  moisture: [],
  ndvi: [],
  flood: [],
  imagery: [],
  octoberMoisture: NaN,
  soilPH: NaN,
});
export async function loadSite(
  manifest: Manifest,
  site: Site,
  mode: "real" | "example",
  signal: AbortSignal,
) {
  if (mode === "example") {
    const x = validateSupplement(
      await json<Example>("example/" + site.id + ".json", signal),
      site.id,
      mode,
    ) as Example;
    return { days: x.days, supplement: x, power: null, errors: [] as string[] };
  }
  const errors: string[] = [];
  let days: Day[] = [],
    power: any = null;
  let supplement = emptySupplement();
  if (site.powerFile) {
    power = await json<any>(site.powerFile, signal);
    days = normalizePower(power, site);
  }
  const loaded = new Set<string>();
  for (const layer of manifest.layers.filter(
    (l) => l.siteId === site.id && l.mode === "real" && l.status === "ready",
  )) {
    try {
      if (loaded.has(layer.asset)) continue;
      if (
        manifest.sources.find((s) => s.id === layer.sourceId)?.mode !== "real"
      )
        throw Error("Source mode mismatch");
      const x = validateSupplement(
        await json<Partial<Example>>(layer.asset, signal),
        site.id,
        "real",
      );
      supplement = {
        ...supplement,
        ...x,
        meta: { ...supplement.meta, ...x.meta },
      };
      loaded.add(layer.asset);
    } catch (e) {
      if (signal.aborted) throw e;
      errors.push(`${layer.id}: ${String(e)}`);
    }
  }
  return { days, supplement, power, errors };
}
export async function refreshPower(site: Site, signal: AbortSignal) {
  const now = new Date();
  const end = new Date(+now - 7 * 86400000).toISOString().slice(0, 10);
  const start = new Date(+new Date(end) - 29 * 86400000)
    .toISOString()
    .slice(0, 10);
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.search = new URLSearchParams({
    parameters: "T2M_MAX,T2M_MIN,T2M,PRECTOTCORR,TS",
    community: "AG",
    longitude: String(site.lon),
    latitude: String(site.lat),
    start: start.replaceAll("-", ""),
    end: end.replaceAll("-", ""),
    "time-standard": "LST",
    format: "JSON",
  }).toString();
  const r = await fetch(url, { signal });
  if (!r.ok) throw Error(`POWER HTTP ${r.status}`);
  const raw = await r.json();
  const days = normalizePower(raw, site, start, end);
  if (!days.some((d) => d.rain !== null && d.max !== null))
    throw Error("No valid observations in refresh");
  return {
    raw,
    days,
    query: url.toString(),
    retrievedAt: new Date().toISOString(),
    start,
    end,
  };
}
