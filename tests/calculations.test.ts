import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyScenario,
  dates,
  gdd,
  heatStats,
  rainReference,
  rolling,
  weighted,
  floodComparison,
} from "../src/lib/math";
import {
  buildCalendar,
  moistureGate,
  pulseChoice,
  resolveRotation,
  scoreRotation,
  stableRank,
} from "../src/lib/engine";
import { DEFAULT_PROFILE, ROTATIONS } from "../src/lib/catalog";
import { normalizePower, validateSupplement } from "../src/lib/data";
import type { Day, Manifest, Example } from "../src/lib/types";
const day = (
  date: string,
  rain: number | null,
  max: number | null = 30,
  min: number | null = 10,
): Day => ({
  date,
  rain,
  max,
  min,
  mean: max === null || min === null ? null : (max + min) / 2,
  skin: 25,
  status: rain === null || max === null ? "missing" : "valid",
});
const read = (p: string) =>
  JSON.parse(
    readFileSync(new URL("../public/data/" + p, import.meta.url), "utf8"),
  );
const m = read("manifest.json") as Manifest;
test("complete 7-day sum equals 28; zero valid; incomplete and absent day do not sum", () => {
  const r = dates("2025-01-01", "2025-01-07").map((d, i) => day(d, i + 1));
  assert.equal(rolling(r, "2025-01-07", 7).value, 28);
  r[2].rain = 0;
  assert.equal(rolling(r, "2025-01-07", 7).value, 25);
  r[2].rain = null;
  assert.equal(rolling(r, "2025-01-07", 7).value, null);
  assert.equal(rolling(r.slice(1), "2025-01-07", 7).valid, 5);
});
test("hot streak breaks at missing observation or missing calendar day", () => {
  const r = [
    day("2025-01-01", 0, 36),
    day("2025-01-02", 0, 37),
    day("2025-01-03", 0, null),
    day("2025-01-04", 0, 39),
    day("2025-01-05", 0, 38),
    day("2025-01-07", 0, 38),
  ];
  assert.equal(heatStats(r).longest, 2);
  assert.equal(heatStats(r).hot, 5);
});
test("GDD hand calculation: 15 + 0 + missing = 15 degree-days", () =>
  assert.equal(
    gdd(
      [
        day("2025-01-01", 0, 30, 10),
        day("2025-01-02", 0, 4, 0),
        day("2025-01-03", 0, null, 10),
      ],
      5,
    ),
    15,
  ));
test("weighted average hand calculation, zeros and unavailable weighted dimension", () => {
  assert.equal(weighted([80, 60, 40, 20], [1, 2, 3, 4]), 40);
  assert.equal(weighted([80, 60, 40, 20], [0, 0, 0, 0]), null);
  assert.equal(weighted([80, null, 40, 20], [1, 0, 0, 0]), 80);
  assert.equal(weighted([80, null, 40, 20], [1, 1, 0, 0]), null);
});
test("midrank reference, median and near-zero suppression; leap-day minimum samples", () => {
  const r = dates("2016-01-01", "2025-12-31").map((d) => day(d, 0));
  let x = rainReference(r, "2025-10-01", 7, 2016, 2025);
  assert.equal(x.median, 0);
  assert.equal(x.percentDeparture, null);
  assert.equal(x.percentile, 50);
  assert.equal(x.sample, 9);
  x = rainReference(r, "2024-02-29", 7, 2016, 2025);
  assert.equal(x.sample, 2);
  assert.equal(x.percentile, null);
});
test("strict October gate includes zero, low, exact threshold, high and missing", () => {
  assert.equal(moistureGate(0), "ineligible");
  assert.equal(moistureGate(0.16), "ineligible");
  assert.equal(moistureGate(0.22), "ineligible");
  assert.equal(moistureGate(0.22001), "eligible");
  assert.equal(moistureGate(null), "unknown");
  assert.equal(moistureGate(NaN), "unknown");
});
test("pH threshold and explicit alternative", () => {
  assert.equal(pulseChoice(5.9), "lupin");
  assert.equal(pulseChoice(6), "chickpea");
  assert.equal(pulseChoice(null), "pea");
  const r = resolveRotation(ROTATIONS[1], DEFAULT_PROFILE, null, 5.9);
  assert.equal(r.ids[2], "lupin");
  assert.ok(r.flags.some((f) => f.includes("draft chickpea")));
});
test("36-month calendar carries summer crop from October into following March", () => {
  const c = buildCalendar(["grain", "chickpea", "wheat"], 2027);
  assert.equal(c.length, 36);
  assert.deepEqual(
    c.find((a) => a.year === 2027 && a.month === 10)?.phase,
    "Plant",
  );
  assert.equal(c.find((a) => a.year === 2028 && a.month === 1)?.crop, "grain");
  assert.equal(
    c.find((a) => a.year === 2028 && a.month === 3)?.phase,
    "Harvest",
  );
  assert.equal(
    c.find((a) => a.year === 2028 && a.month === 5)?.crop,
    "chickpea",
  );
});
test("sorghum has eligible, fallow and pending decision branches", () => {
  const high = resolveRotation(ROTATIONS[3], DEFAULT_PROFILE, 0.3, 6.2);
  const low = resolveRotation(ROTATIONS[3], DEFAULT_PROFILE, 0.16, 6.2);
  const missing = resolveRotation(ROTATIONS[3], DEFAULT_PROFILE, null, 6.2);
  assert.equal(high.ids[1], "forage");
  assert.equal(low.ids[1], "fallow");
  assert.equal(missing.ids[1], "fallow");
  assert.ok(missing.flags.some((f) => f.includes("planting undecided")));
});
test("shared-valid flood comparison excludes masks and permanent water", () => {
  const r = floodComparison([
    { ref: "land", event: "water", permanent: false, areaKm2: 1 },
    { ref: "water", event: "water", permanent: true, areaKm2: 1 },
    { ref: "masked", event: "water", permanent: false, areaKm2: 1 },
    { ref: "land", event: "masked", permanent: false, areaKm2: 1 },
  ]);
  assert.equal(r.newArea, 1);
  assert.equal(r.valid, 2);
  assert.equal(r.percent, 50);
  assert.equal(r.permanent, 1);
});
test("scenario combination: 20mm ×0.9 ×1.05=18.9; air +1.6; skin/missing unchanged; reset reproduces original", () => {
  const original = [
    day("2025-01-01", 20, 35, 10),
    day("2025-01-02", null, null, 10),
  ];
  const before = JSON.stringify(original);
  const result = applyScenario(original, {
    warming: 1.6,
    rainfall: -10,
    heavy: 5,
    season: "summer",
    runoff: 0,
  });
  assert.ok(Math.abs(result[0].rain! - 18.9) < 1e-9);
  assert.equal(result[0].max, 36.6);
  assert.equal(result[0].skin, 25);
  assert.equal(result[1].rain, null);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(
    applyScenario(original, {
      warming: 0,
      rainfall: 0,
      heavy: 0,
      season: "all",
      runoff: 0,
    }),
    original,
  );
});
test("all five real POWER caches have correct coordinates, dates, units and provider fill normalization", () => {
  for (const site of m.sites.filter((s) => s.powerFile)) {
    const raw = read(site.powerFile!);
    const rows = normalizePower(raw, site);
    assert.equal(rows.length, 3653);
    assert.equal(rows[0].date, "2016-01-01");
    assert.equal(rows.at(-1)?.date, "2025-12-31");
    assert.ok(rows.filter((d) => d.rain !== null).length > 3600);
    assert.ok(rows.some((d) => d.rain === 0));
    const mutated = structuredClone(raw);
    mutated.properties.parameter.PRECTOTCORR["20160101"] =
      mutated.header.fill_value;
    assert.equal(normalizePower(mutated, site)[0].rain, null);
    mutated.geometry.coordinates[0] += 1;
    assert.throws(() => normalizePower(mutated, site), /coordinate/);
  }
});
test("real north and south rainfall hand sum matches normalized rolling window", () => {
  for (const id of ["dalby", "griffith"]) {
    const site = m.sites.find((s) => s.id === id)!;
    const raw = read(site.powerFile!);
    const rows = normalizePower(raw, site);
    const sum = dates("2025-12-25", "2025-12-31").reduce(
      (s, d) => s + raw.properties.parameter.PRECTOTCORR[d.replaceAll("-", "")],
      0,
    );
    assert.ok(Math.abs(rolling(rows, "2025-12-31", 7).value! - sum) < 1e-8);
  }
});
test("data-driven scores change under scenario, stable ties and baseline edits", () => {
  const x = read("example/griffith.json") as Example;
  const p = structuredClone(DEFAULT_PROFILE);
  p.ph = "6.2";
  p.weights = [5, 0, 5, 5];
  const a = ROTATIONS.slice(0, 4).map((r) =>
    scoreRotation(r, x.days, p, 0.3, 6.2),
  );
  const s = applyScenario(x.days, {
    warming: 1.6,
    rainfall: -20,
    heavy: 5,
    season: "all",
    runoff: 0,
  });
  const b = scoreRotation(ROTATIONS[0], s, p, 0.3, 6.2);
  assert.notEqual(a[0].total, b.total);
  assert.ok(a[0].dimensions[0]! > b.dimensions[0]!);
  const tied = [
    { ...a[2], total: 60 },
    { ...a[0], total: 60 },
    { ...a[1], total: 60 },
  ];
  assert.deepEqual(
    stableRank(tied).map((s) => s.id),
    ["baseline", "break", "early"],
  );
  p.baseline = ["fallow", "cover", "wheat"];
  const edit = scoreRotation(ROTATIONS[0], x.days, p, 0.3, 6.2);
  assert.equal(edit.crops[0], "fallow");
  assert.equal(
    edit.calendar.find((a) => a.year === 2028 && a.month === 4)?.phase,
    "Plant",
  );
});

test("incoming layer validation preserves zero and rejects wrong mode, site, duplicate dates and physical fill", () => {
  const x = {
    mode: "real",
    locationId: "griffith",
    meta: {
      moisture: {
        source: "SMAP",
        resolution: "9 km",
        start: "2025-01-01",
        end: "2025-01-01",
        qa: "valid",
      },
    },
    moisture: [{ date: "2025-01-01", surface: 0, root: 0, status: "valid" }],
  };
  assert.equal(validateSupplement(x, "griffith", "real").moisture[0].root, 0);
  assert.throws(
    () => validateSupplement({ ...x, mode: "example" }, "griffith", "real"),
    /mode/,
  );
  assert.throws(() => validateSupplement(x, "dalby", "real"), /site/);
  assert.throws(
    () =>
      validateSupplement(
        { ...x, moisture: [...x.moisture, ...x.moisture] },
        "griffith",
        "real",
      ),
    /duplicate/,
  );
  assert.throws(
    () =>
      validateSupplement(
        { ...x, moisture: [{ ...x.moisture[0], root: -9999 }] },
        "griffith",
        "real",
      ),
    /range/,
  );
});
