import type { Day, Scenario } from "./types";
export const RULES_VERSION = "field-shift-rules/1.0.0";
export const DAY_MS = 86400000;
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const date = (s: string) => new Date(s + "T00:00:00Z");
export const addDays = (s: string, n: number) =>
  iso(new Date(+date(s) + n * DAY_MS));
export function dates(start: string, end: string) {
  const result: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    result.push(d);
    if (result.length > 15000) throw Error("Date range exceeds 15,000 days");
  }
  return result;
}
export const valid = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export const mean = (v: (number | null)[]) => {
  const x = v.filter(valid);
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
};
export const median = (v: number[]) => {
  const x = [...v].sort((a, b) => a - b),
    i = Math.floor(x.length / 2);
  return x.length ? (x.length % 2 ? x[i] : (x[i - 1] + x[i]) / 2) : null;
};
export const clamp = (v: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, v));
export function total(
  rows: Day[],
  start: string,
  end: string,
  key: "rain" = "rain",
) {
  const by = new Map(rows.map((d) => [d.date, d]));
  const ds = dates(start, end);
  const values = ds.map((d) => by.get(d)?.[key]);
  return {
    value: values.every(valid)
      ? (values as number[]).reduce((a, b) => a + b, 0)
      : null,
    valid: values.filter(valid).length,
    expected: ds.length,
  };
}
export function rolling(rows: Day[], end: string, n: number) {
  return total(rows, addDays(end, 1 - n), end);
}
export function rainReference(
  rows: Day[],
  end: string,
  n: number,
  startYear: number,
  endYear: number,
) {
  const target = rolling(rows, end, n);
  const refs: number[] = [];
  const targetYear = +end.slice(0, 4);
  for (let y = startYear; y <= endYear; y++) {
    if (y === targetYear) continue;
    const e = y + end.slice(4);
    if (iso(date(e)) !== e) continue;
    const x = rolling(rows, e, n);
    if (x.value !== null) refs.push(x.value);
  }
  const med = median(refs);
  return {
    ...target,
    median: med,
    sample: refs.length,
    anomaly: target.value !== null && med !== null ? target.value - med : null,
    percentDeparture:
      target.value !== null && med !== null && med >= 1
        ? (100 * (target.value - med)) / med
        : null,
    percentile:
      refs.length >= 5 && target.value !== null
        ? (100 *
            (refs.filter((x) => x < target.value!).length +
              0.5 * refs.filter((x) => x === target.value).length)) /
          refs.length
        : null,
  };
}
export function heatStats(rows: Day[], hot = 35, frost = 0) {
  let longest = 0,
    streak = 0,
    previous = "";
  for (const d of rows) {
    if (previous && addDays(previous, 1) !== d.date) streak = 0;
    streak = d.max !== null && d.max >= hot ? streak + 1 : 0;
    longest = Math.max(longest, streak);
    previous = d.date;
  }
  return {
    hot: rows.filter((d) => d.max !== null && d.max >= hot).length,
    frost: rows.filter((d) => d.min !== null && d.min <= frost).length,
    longest,
    validMax: rows.filter((d) => d.max !== null).length,
    validMin: rows.filter((d) => d.min !== null).length,
  };
}
export function gdd(rows: Day[], base: number) {
  return rows.reduce(
    (sum, d) =>
      sum +
      (d.max !== null && d.min !== null
        ? Math.max(0, (d.max + d.min) / 2 - base)
        : 0),
    0,
  );
}
export function weighted(scores: (number | null)[], weights: number[]) {
  if (
    weights.reduce((a, b) => a + b, 0) === 0 ||
    scores.some((s, i) => weights[i] > 0 && s === null)
  )
    return null;
  return (
    scores.reduce<number>((sum, s, i) => sum + (s ?? 0) * weights[i], 0) /
    weights.reduce((a, b) => a + b, 0)
  );
}
export function applyScenario(
  rows: Day[],
  s: Scenario,
  heavyThreshold = 20,
): Day[] {
  return rows.map((d) => {
    const m = +d.date.slice(5, 7);
    const season =
      s.season === "all" ||
      (s.season === "summer"
        ? [12, 1, 2]
        : s.season === "autumn"
          ? [3, 4, 5]
          : s.season === "winter"
            ? [6, 7, 8]
            : [9, 10, 11]
      ).includes(m);
    return {
      ...d,
      max: d.max === null ? null : d.max + s.warming,
      min: d.min === null ? null : d.min + s.warming,
      mean: d.mean === null ? null : d.mean + s.warming,
      skin: d.skin,
      rain:
        d.rain === null
          ? null
          : d.rain *
            (season ? 1 + s.rainfall / 100 : 1) *
            (d.rain >= heavyThreshold ? 1 + s.heavy / 100 : 1),
    };
  });
}
export function monthly(
  rows: Day[],
  key: "rain" | "max" | "min" | "mean" | "skin",
) {
  const groups = new Map<string, Day[]>();
  rows.forEach((d) => {
    const k = d.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) || []), d]);
  });
  return [...groups].map(([month, ds]) => {
    const expected = new Date(
      +month.slice(0, 4),
      +month.slice(5, 7),
      0,
    ).getDate();
    const vals = ds.map((d) => d[key]);
    const count = vals.filter(valid).length;
    return {
      date: month,
      value:
        count === expected
          ? key === "rain"
            ? (vals as number[]).reduce((a, b) => a + b, 0)
            : mean(vals)
          : null,
      valid: count,
      expected,
    };
  });
}
export function floodComparison(
  pixels: { ref: string; event: string; permanent: boolean; areaKm2: number }[],
) {
  const shared = pixels.filter(
    (p) => p.ref !== "masked" && p.event !== "masked",
  );
  const area = shared.reduce((s, p) => s + p.areaKm2, 0);
  const newArea = shared
    .filter((p) => p.ref === "land" && p.event === "water" && !p.permanent)
    .reduce((s, p) => s + p.areaKm2, 0);
  return {
    valid: shared.length,
    total: pixels.length,
    area,
    newArea,
    percent: area ? (100 * newArea) / area : null,
    permanent: shared
      .filter((p) => p.permanent && p.event === "water")
      .reduce((s, p) => s + p.areaKm2, 0),
  };
}
export function dryPersistence(rows: Day[], end: string) {
  const by = new Map(rows.map((d) => [d.date, d]));
  let count = 0;
  for (let d = end; count < 365; d = addDays(d, -1)) {
    const v = by.get(d)?.rain;
    if (v == null || v >= 1) break;
    count++;
  }
  return count;
}
