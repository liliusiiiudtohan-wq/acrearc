import { useMemo, useState } from "react";
import {
  CloudRain,
  Thermometer,
  Waves,
  Droplets,
  Leaf,
  History,
  Info,
} from "lucide-react";
import type { Day, Example, Mode, Site } from "../lib/types";
import {
  addDays,
  dryPersistence,
  floodComparison,
  heatStats,
  mean,
  median,
  monthly,
  rainReference,
  rolling,
  valid,
} from "../lib/math";
import Chart, { fmt } from "./Chart";
export const PANELS = [
  { id: "history", label: "Historical analysis", icon: History },
  { id: "rain", label: "Rainfall & drought", icon: CloudRain },
  { id: "heat", label: "Heat & temperature", icon: Thermometer },
  { id: "flood", label: "Surface flooding", icon: Waves },
  { id: "moisture", label: "Soil moisture", icon: Droplets },
  { id: "vegetation", label: "Vegetation decline", icon: Leaf },
];
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function NotAvailable({ product, mode }: { product: string; mode: Mode }) {
  return (
    <div className="notice">
      <Info size={18} />
      <div>
        <strong>
          {product}{" "}
          {mode === "real"
            ? "not acquired"
            : "has no fixture for this selection"}
        </strong>
        <p>
          {mode === "real"
            ? "No real observations are bundled. Weather analysis can still run at supported POWER points. Switch explicitly to Example mode to exercise this interaction."
            : "Select a supported sample to load its example footprint."}
        </p>
      </div>
    </div>
  );
}
export default function RiskPanels({
  panel,
  setPanel,
  rows,
  allRows,
  supplement,
  mode,
  site,
  start,
  end,
  analysisEnd,
  setAnalysisEnd,
  depth,
  setDepth,
  notes,
  setNotes,
  eventSide,
  setEventSide,
}: {
  panel: string;
  setPanel: (s: string) => void;
  rows: Day[];
  allRows: Day[];
  supplement: Example;
  mode: Mode;
  site?: Site;
  start: string;
  end: string;
  analysisEnd: string;
  setAnalysisEnd: (s: string) => void;
  depth: "surface" | "root";
  setDepth: (s: "surface" | "root") => void;
  notes: string;
  setNotes: (s: string) => void;
  eventSide: string;
  setEventSide: (s: string) => void;
}) {
  const [hotThreshold, setHotThreshold] = useState(35),
    [frostThreshold, setFrostThreshold] = useState(0),
    [before, setBefore] = useState(0),
    [after, setAfter] = useState(2),
    [swipe, setSwipe] = useState(50);
  const recent = rows.filter(
    (d) => d.date >= addDays(analysisEnd, -89) && d.date <= analysisEnd,
  );
  const r = rainReference(
    allRows,
    analysisEnd,
    30,
    +start.slice(0, 4),
    +end.slice(0, 4),
  );
  const heat = heatStats(recent, hotThreshold, frostThreshold);
  const source =
    mode === "real"
      ? `NASA POWER Daily AG · ${site?.name} representative point · LST · native meteorology grid ~0.5° × 0.625°`
      : "SYNTHETIC interaction fixtures v1 · not observations · point-style weather";
  const period = `${start} to ${end}`;
  const flood = useMemo(
    () =>
      eventSide === "reference"
        ? supplement.flood.map((p) => ({ ...p, event: p.ref }))
        : supplement.flood,
    [supplement.flood, eventSide],
  );
  const f = floodComparison(flood);
  const moisture = supplement.moisture.filter(
    (d) => d.date >= addDays(analysisEnd, -89) && d.date <= analysisEnd,
  );
  const current =
    supplement.moisture.find((d) => d.date === analysisEnd)?.[depth] ?? null;
  const reference = supplement.moisture
    .filter(
      (d) =>
        d.date.slice(5) === analysisEnd.slice(5) &&
        d.date.slice(0, 4) !== analysisEnd.slice(0, 4) &&
        d.date >= start &&
        d.date <= end,
    )
    .map((d) => d[depth])
    .filter(valid);
  const moistureMed = median(reference);
  const trendNow = moisture.slice(-7),
    trendBefore = moisture.slice(-14, -7);
  const trend =
    trendNow.length === 7 &&
    trendBefore.length === 7 &&
    [...trendNow, ...trendBefore].every((x) => x[depth] !== null)
      ? mean(trendNow.map((x) => x[depth]))! -
        mean(trendBefore.map((x) => x[depth]))!
      : null;
  const annual = [...new Set(rows.map((d) => d.date.slice(0, 4)))].map(
    (year) => {
      const ds = rows.filter((d) => d.date.startsWith(year));
      const rain = rolling(
        allRows,
        year + "-12-31",
        Number.isInteger(+year / 4) ? 366 : 365,
      );
      const h = heatStats(ds);
      return {
        year,
        rain:
          ds[0]?.date === year + "-01-01" && ds.at(-1)?.date === year + "-12-31"
            ? rain.value
            : null,
        mean: mean(ds.map((d) => d.mean)),
        meanValid: ds.filter((d) => d.mean !== null).length,
        heat: h.hot,
        frost: h.frost,
        valid: h.validMax,
      };
    },
  );
  const frames = supplement.imagery;
  const b = frames[before],
    a = frames[Math.min(after, frames.length - 1)];
  const floodMeta = supplement.meta?.flood;
  const refDate = floodMeta?.start || "2025-09-14",
    eventDate = floodMeta?.end || "2025-11-08";
  const satLabel = supplement.meta?.moisture
    ? `${supplement.meta.moisture.source} · ${supplement.meta.moisture.resolution} · ${supplement.meta.moisture.qa}`
    : mode === "example"
      ? "SYNTHETIC, SMAP-style daily fixture · 9 km support · 0–5 / 0–100 cm · daily indexed calendar"
      : "Processed SMAP L4 v8 · native 9 km support · see source register for QA";
  return (
    <section className="risk-section">
      <div
        className="panel-tabs"
        role="tablist"
        aria-label="Environmental evidence"
      >
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={panel === id}
            className={panel === id ? "active" : ""}
            onClick={() => setPanel(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div
        className="risk-body"
        role="tabpanel"
        aria-label={PANELS.find((p) => p.id === panel)?.label}
      >
        <div className="section-title">
          <div>
            <span className="eyebrow">
              THE EVIDENCE /{" "}
              {mode === "real" ? "OBSERVED WEATHER CACHE" : "EXAMPLE INPUTS"}
            </span>
            <h2>{PANELS.find((p) => p.id === panel)?.label}</h2>
          </div>
          <label className="inline-label">
            Window ends
            <input
              type="date"
              aria-label="Risk window end"
              value={analysisEnd}
              min={start}
              max={end}
              onChange={(e) => e.target.value && setAnalysisEnd(e.target.value)}
            />
          </label>
        </div>
        {!site ? (
          <p className="empty-small">
            Choose a supported town sample to examine its evidence. An area
            selection alone does not supply measured data.
          </p>
        ) : (
          <>
            {panel === "history" && (
              <>
                <div className="stats-grid">
                  <Stat
                    label="Historical window"
                    value={`${start.slice(0, 4)}–${end.slice(0, 4)}`}
                    note="Shared across views"
                  />
                  <Stat
                    label="Weather coverage"
                    value={`${rows.filter((d) => d.rain !== null).length} / ${rows.length}`}
                    note="Valid precipitation days"
                  />
                  <Stat
                    label="Latest cached observation"
                    value={rows.at(-1)?.date || "Unavailable"}
                    note="Frozen cache; not current conditions"
                  />
                </div>
                <Chart
                  title="Monthly rainfall history"
                  series={[
                    {
                      name: "Complete-month rainfall",
                      color: "#4c858c",
                      values: monthly(rows, "rain"),
                    },
                  ]}
                  unit="mm / month"
                  bar
                  source={`${source} · ${period} · only complete months summed`}
                />
                <Chart
                  title="Monthly mean air temperature"
                  series={[
                    {
                      name: "Air temperature at 2 m",
                      color: "#c48e56",
                      values: monthly(rows, "mean"),
                    },
                  ]}
                  unit="°C"
                  source={`${source} · complete months only`}
                />
                <div className="table-scroll">
                  <table>
                    <caption>
                      Annual exposure context · POWER point · draft heat ≥35 °C
                      / frost ≤0 °C
                    </caption>
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Rain mm</th>
                        <th>Mean °C (valid days)</th>
                        <th>Hot days</th>
                        <th>Frost days</th>
                        <th>Valid Tmax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annual.map((v) => (
                        <tr key={v.year}>
                          <th>{v.year}</th>
                          <td>{fmt(v.rain)}</td>
                          <td>
                            {fmt(v.mean)} ({v.meanValid} days)
                          </td>
                          <td>{v.heat}</td>
                          <td>{v.frost}</td>
                          <td>{v.valid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {supplement.moisture.length ? (
                  <Chart
                    title="Root-zone moisture context"
                    series={[
                      {
                        name: "0–100 cm daily",
                        color: "#4c858c",
                        values: supplement.moisture
                          .filter((d) => d.date >= start && d.date <= end)
                          .filter((_, i) => i % 16 === 0)
                          .map((d) => ({ date: d.date, value: d.root })),
                      },
                    ]}
                    unit="m³/m³"
                    source={`${satLabel} · every 16th daily observation shown; not smoothed`}
                  />
                ) : (
                  <NotAvailable product="SMAP moisture history" mode={mode} />
                )}
                <NDVI
                  supplement={supplement}
                  mode={mode}
                  start={start}
                  end={end}
                />
                {supplement.et?.length ? (
                  <Chart
                    title="ET context — separate quantities"
                    unit="mm/day"
                    series={[
                      {
                        name: "Actual ET",
                        color: "#508c8e",
                        values: supplement.et.map((d) => ({
                          date: d.date,
                          value: d.actualET,
                        })),
                      },
                      {
                        name: "Reference ET0",
                        color: "#af9256",
                        values: supplement.et.map((d) => ({
                          date: d.date,
                          value: d.referenceET,
                        })),
                      },
                    ]}
                    source={`${supplement.meta?.et?.source} · ${supplement.meta?.et?.start}–${supplement.meta?.et?.end} · ${supplement.meta?.et?.resolution} · separate quantities; no water balance conversion`}
                  />
                ) : (
                  <NotAvailable product="Observed ET / ESI" mode={mode} />
                )}
              </>
            )}
            {panel === "rain" && (
              <>
                <div className="stats-grid four">
                  {[1, 7, 30, 90].map((n) => {
                    const v = rolling(allRows, analysisEnd, n);
                    return (
                      <Stat
                        key={n}
                        label={n === 1 ? "Daily rainfall" : `${n}-day rainfall`}
                        value={
                          v.value === null ? "Incomplete" : `${fmt(v.value)} mm`
                        }
                        note={`${v.valid}/${v.expected} valid days · ${addDays(analysisEnd, 1 - n)}–${analysisEnd}`}
                      />
                    );
                  })}
                </div>
                <div className="stats-grid four">
                  <Stat
                    label="Matched 30-day median"
                    value={`${fmt(r.median)} mm`}
                    note={`${r.sample} complete same-season reference windows`}
                  />
                  <Stat
                    label="Anomaly / departure"
                    value={`${fmt(r.anomaly)} mm`}
                    note={
                      r.percentDeparture === null
                        ? "% suppressed: reference near zero or unavailable"
                        : `${fmt(r.percentDeparture)}% from median`
                    }
                  />
                  <Stat
                    label="Midrank percentile"
                    value={
                      r.percentile === null
                        ? "Insufficient reference"
                        : `${fmt(r.percentile)}th`
                    }
                    note="Minimum 5 complete windows; excludes target year"
                  />
                  <Stat
                    label="Dry persistence"
                    value={`${dryPersistence(allRows, analysisEnd)} days`}
                    note="Consecutive <1 mm days; stops at gap"
                  />
                </div>
                <Chart
                  title="Daily and rolling rainfall"
                  series={[
                    {
                      name: "Daily rainfall",
                      color: "#97b7ad",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: d.rain,
                      })),
                    },
                    {
                      name: "7-day total",
                      color: "#2e696b",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: rolling(allRows, d.date, 7).value,
                      })),
                    },
                    {
                      name: "30-day total",
                      color: "#b78a51",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: rolling(allRows, d.date, 30).value,
                      })),
                    },
                    {
                      name: "90-day total",
                      color: "#7d779b",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: rolling(allRows, d.date, 90).value,
                      })),
                    },
                  ]}
                  unit="mm"
                  source={`${source} · ${recent[0]?.date}–${analysisEnd} · separate POWER proxy reference; not IMERG`}
                />
                {supplement.imerg?.length ? (
                  <>
                    <h3>IMERG Final — separate historical source</h3>
                    <div className="stats-grid">
                      {[7, 30, 90].map((n) => {
                        const v = rainReference(
                          supplement.imerg!,
                          analysisEnd,
                          n,
                          +start.slice(0, 4),
                          +end.slice(0, 4),
                        );
                        return (
                          <Stat
                            key={n}
                            label={`${n}-day IMERG Final`}
                            value={`${fmt(v.value)} mm`}
                            note={`${v.valid}/${v.expected} days; median ${fmt(v.median)} mm; n=${v.sample}; percentile ${fmt(v.percentile)}; anomaly ${fmt(v.anomaly)} mm`}
                          />
                        );
                      })}
                    </div>
                    <Chart
                      title="IMERG Final daily rainfall"
                      unit="mm/day"
                      series={[
                        {
                          name: "Final",
                          color: "#2e696c",
                          values: supplement.imerg
                            .filter(
                              (d) =>
                                d.date >= addDays(analysisEnd, -89) &&
                                d.date <= analysisEnd,
                            )
                            .map((d) => ({ date: d.date, value: d.rain })),
                        },
                      ]}
                      source={`${supplement.meta?.imerg?.source || "IMERG Final"} · ${supplement.meta?.imerg?.resolution || "0.1°"} · ${supplement.meta?.imerg?.start}–${supplement.meta?.imerg?.end}; own matched reference, no POWER fill`}
                    />
                  </>
                ) : (
                  <NotAvailable
                    product="IMERG Final historical rainfall"
                    mode="real"
                  />
                )}
                {supplement.late?.length ? (
                  <Chart
                    title="IMERG Late — provisional recent rainfall"
                    unit="mm/day"
                    series={[
                      {
                        name: "Late provisional",
                        color: "#b78a51",
                        values: supplement.late.map((d) => ({
                          date: d.date,
                          value: d.rain,
                        })),
                      },
                    ]}
                    source={`${supplement.meta?.late?.source || "IMERG Late"} · provisional; ${supplement.meta?.late?.resolution || "0.1°"} · not merged with Final reference`}
                  />
                ) : (
                  <NotAvailable
                    product="IMERG Late provisional rainfall"
                    mode="real"
                  />
                )}
                <p className="method-note">
                  Reference rule v1: equal-length windows ending on the same
                  calendar month/day in each selected reference year. All days
                  required. Feb 29 reference endpoints use leap years only.
                  Median ≥1 mm required for percent departure. A rainfall
                  deficit is contextual evidence, not a crop-loss probability.
                </p>
              </>
            )}
            {panel === "heat" && (
              <>
                <div className="controls-row">
                  <label>
                    Draft hot threshold °C
                    <input
                      type="number"
                      value={hotThreshold}
                      onChange={(e) => setHotThreshold(+e.target.value)}
                    />
                  </label>
                  <label>
                    Draft frost threshold °C
                    <input
                      type="number"
                      value={frostThreshold}
                      onChange={(e) => setFrostThreshold(+e.target.value)}
                    />
                  </label>
                </div>
                <div className="stats-grid">
                  <Stat
                    label={`Days ≥${hotThreshold} °C`}
                    value={String(heat.hot)}
                    note={`${heat.validMax}/${recent.length} valid Tmax observations`}
                  />
                  <Stat
                    label={`Days ≤${frostThreshold} °C`}
                    value={String(heat.frost)}
                    note={`${heat.validMin}/${recent.length} valid Tmin observations`}
                  />
                  <Stat
                    label="Longest hot streak"
                    value={`${heat.longest} days`}
                    note="A missing day breaks the streak"
                  />
                </div>
                <Chart
                  title="Daily air temperature at 2 metres"
                  series={[
                    {
                      name: "Maximum",
                      color: "#c18454",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: d.max,
                      })),
                    },
                    {
                      name: "Mean",
                      color: "#7a8764",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: d.mean,
                      })),
                    },
                    {
                      name: "Minimum",
                      color: "#528c9e",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: d.min,
                      })),
                    },
                  ]}
                  unit="°C"
                  source={`${source} · ${recent[0]?.date}–${analysisEnd} · air exposure, not canopy damage`}
                />
                <Chart
                  title="Earth skin temperature — separate surface series"
                  series={[
                    {
                      name: "POWER TS",
                      color: "#97817e",
                      values: recent.map((d) => ({
                        date: d.date,
                        value: d.skin,
                      })),
                    },
                  ]}
                  unit="°C"
                  source={`${source} · TS is Earth skin temperature; air warming scenario does not transform TS`}
                />
              </>
            )}
            {panel === "moisture" && (
              <>
                <div className="segmented">
                  <button
                    className={depth === "surface" ? "active" : ""}
                    onClick={() => setDepth("surface")}
                  >
                    Surface · 0–5 cm
                  </button>
                  <button
                    className={depth === "root" ? "active" : ""}
                    onClick={() => setDepth("root")}
                  >
                    Modeled root zone · 0–100 cm
                  </button>
                </div>
                {supplement.moisture.length ? (
                  <>
                    <div className="stats-grid four">
                      <Stat
                        label="Daily moisture"
                        value={`${fmt(current, 3)} m³/m³`}
                        note={analysisEnd}
                      />
                      <Stat
                        label="Same-day anomaly"
                        value={`${fmt(current !== null && moistureMed !== null ? current - moistureMed : null, 3)}`}
                        note={`${reference.length} valid matched reference dates`}
                      />
                      <Stat
                        label="Matched percentile"
                        value={
                          current !== null && reference.length >= 5
                            ? `${fmt((100 * (reference.filter((x) => x < current).length + 0.5 * reference.filter((x) => x === current).length)) / reference.length)}th`
                            : "Insufficient reference"
                        }
                        note="Midrank; ≥5 other years"
                      />
                      <Stat
                        label="7-day mean change"
                        value={`${fmt(trend, 3)} m³/m³`}
                        note="Complete adjacent weeks required"
                      />
                    </div>
                    <Chart
                      title={`${depth === "root" ? "Root-zone" : "Surface"} moisture · daily`}
                      series={[
                        {
                          name: depth === "root" ? "0–100 cm" : "0–5 cm",
                          color: "#44877e",
                          values: moisture.map((d) => ({
                            date: d.date,
                            value: d[depth],
                          })),
                        },
                      ]}
                      unit="m³/m³"
                      source={`${satLabel} · ${moisture[0]?.date}–${analysisEnd} · ${moisture.filter((d) => d[depth] !== null).length}/${moisture.length} valid observations`}
                    />
                    <details>
                      <summary>Inspect native grid support and QA</summary>
                      <p>
                        Grid snapshot:{" "}
                        {supplement.meta?.grid?.end || "2025-10-15"}.{" "}
                        {supplement.grid.length} cells,{" "}
                        {
                          supplement.grid.filter((c) => c[depth] !== null)
                            .length
                        }{" "}
                        valid.{" "}
                        {supplement.meta?.grid?.resolution ||
                          "Synthetic 9 km support"}
                        . Depth toggle changes map values. Heights represent
                        moisture, not terrain.
                      </p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Cell</th>
                              <th>Lon / Lat</th>
                              <th>{depth} m³/m³</th>
                              <th>QA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplement.grid.map((g, i) => (
                              <tr key={i}>
                                <th>{i + 1}</th>
                                <td>
                                  {g.lon.toFixed(3)}, {g.lat.toFixed(3)}
                                </td>
                                <td>{fmt(g[depth], 3)}</td>
                                <td>{g.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                ) : (
                  <NotAvailable
                    product="SMAP surface / root-zone values and grid"
                    mode={mode}
                  />
                )}
                <p className="method-note">
                  Volumetric water content is not a rainfall amount. SMAP
                  root-zone moisture is modeled at coarse native support. No
                  m³/m³ values are added to rainfall in mm. No paddock
                  irrigation volume is inferred.
                </p>
              </>
            )}
            {panel === "flood" && (
              <>
                {flood.length ? (
                  <>
                    <div className="controls-row">
                      <label>
                        Reference observation
                        <select aria-label="Flood reference date">
                          <option>{refDate} · reference QA</option>
                        </select>
                      </label>
                      <label>
                        Comparison observation
                        <select
                          value={eventSide}
                          onChange={(e) => setEventSide(e.target.value)}
                        >
                          <option value="event">{eventDate} · event</option>
                          <option value="reference">
                            {refDate} · reference (self-check)
                          </option>
                        </select>
                      </label>
                    </div>
                    <div className="stats-grid four">
                      <Stat
                        label="Possible new inundation"
                        value={`${fmt(f.newArea, 4)} km²`}
                        note={`${fmt(f.percent)}% of shared valid area`}
                      />
                      <Stat
                        label="Shared valid support"
                        value={`${f.valid} / ${f.total} pixels`}
                        note={`${fmt(f.area, 4)} km² · unknown pixels excluded`}
                      />
                      <Stat
                        label="Permanent water"
                        value={`${fmt(f.permanent, 4)} km²`}
                        note="Separated from possible new water"
                      />
                      <Stat
                        label="Acquisition status"
                        value={
                          mode === "example" ? "SYNTHETIC" : "Processed input"
                        }
                        note={
                          mode === "example"
                            ? "Not an observed flood claim"
                            : "Processed source and QA; inspect register"
                        }
                      />
                    </div>
                    <div
                      className="flood-grid"
                      role="img"
                      aria-label={`${flood.length} classified ${mode} pixels; unknown cells remain hatched`}
                    >
                      {flood.map((p) => (
                        <span
                          key={p.id}
                          title={`Pixel ${p.id}: ${p.ref} → ${p.event}`}
                          className={
                            p.ref === "masked" || p.event === "masked"
                              ? "masked"
                              : p.permanent
                                ? "permanent"
                                : p.event === "water"
                                  ? "new-water"
                                  : "land"
                          }
                        />
                      ))}
                    </div>
                    <p className="source-line">
                      {mode === "example"
                        ? "Synthetic OPERA-style QA/classification fixture"
                        : floodMeta?.source ||
                          "Processed OPERA water classes"}{" "}
                      ·{" "}
                      {mode === "example"
                        ? "30 m synthetic equal-area pixels, 0.0009 km² each"
                        : floodMeta?.resolution +
                          " · area supplied by equal-area processing"}
                      . Reference {refDate}; event{" "}
                      {eventSide === "event" ? eventDate : refDate}. Shared
                      valid pixels only.
                    </p>
                    <details>
                      <summary>Accessible pixel classification table</summary>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Pixel</th>
                              <th>Reference</th>
                              <th>Comparison</th>
                              <th>Permanent</th>
                              <th>Shared QA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {flood.map((p) => (
                              <tr key={p.id}>
                                <th>{p.id}</th>
                                <td>{p.ref}</td>
                                <td>{p.event}</td>
                                <td>{String(p.permanent)}</td>
                                <td>
                                  {p.ref === "masked" || p.event === "masked"
                                    ? "unknown / excluded"
                                    : "valid"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                    <Chart
                      title="Rainfall context around the event"
                      series={[
                        {
                          name: "POWER proxy",
                          color: "#4c858c",
                          values: allRows
                            .filter(
                              (d) =>
                                d.date >= addDays(eventDate, -14) &&
                                d.date <= addDays(eventDate, 7),
                            )
                            .map((d) => ({ date: d.date, value: d.rain })),
                        },
                      ]}
                      unit="mm/day"
                      bar
                      source={`${source} · event context only; rainfall does not classify inundation`}
                    />
                  </>
                ) : (
                  <NotAvailable
                    product="OPERA reference / event water and QA layers"
                    mode={mode}
                  />
                )}
              </>
            )}
            {panel === "vegetation" && (
              <>
                {frames.length ? (
                  <>
                    <div className="controls-row">
                      <label>
                        Before
                        <select
                          aria-label="Vegetation before date"
                          value={before}
                          onChange={(e) => setBefore(+e.target.value)}
                        >
                          {frames.map((f, i) => (
                            <option key={f.date} value={i}>
                              {f.date} · {f.status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        After
                        <select
                          aria-label="Vegetation after date"
                          value={Math.min(after, frames.length - 1)}
                          onChange={(e) => setAfter(+e.target.value)}
                        >
                          {frames.map((f, i) => (
                            <option key={f.date} value={i}>
                              {f.date} · {f.status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="swipe-frame">
                      {a?.asset ? (
                        <img
                          src={
                            ((import.meta as any).env?.BASE_URL ?? "/") +
                            "data/" +
                            a.asset
                          }
                          alt={`After ${a.date}, synthetic same-footprint field mosaic`}
                        />
                      ) : (
                        <div className="cloud-placeholder">
                          {a?.date} · cloud/missing pixels · no usable after
                          image
                        </div>
                      )}
                      <div
                        className="swipe-before"
                        style={{
                          width: "100%",
                          clipPath: `inset(0 ${100 - swipe}% 0 0)`,
                        }}
                      >
                        {b?.asset ? (
                          <img
                            src={
                              ((import.meta as any).env?.BASE_URL ?? "/") +
                              "data/" +
                              b.asset
                            }
                            alt={`Before ${b.date}, synthetic same-footprint field mosaic`}
                          />
                        ) : (
                          <div className="cloud-placeholder">
                            {b?.date} · cloud / missing image
                          </div>
                        )}
                      </div>
                      <div className="swipe-line" style={{ left: swipe + "%" }}>
                        <span>↔</span>
                      </div>
                      <span className="image-date before">
                        {b?.date} · {b?.validPercent}% valid
                      </span>
                      <span className="image-date after">
                        {a?.date} · {a?.validPercent}% valid
                      </span>
                    </div>
                    <label className="swipe-control">
                      Before / after divider
                      <input
                        type="range"
                        aria-label="Before after imagery divider"
                        min="0"
                        max="100"
                        value={swipe}
                        onChange={(e) => setSwipe(+e.target.value)}
                      />
                      <output>{swipe}% before</output>
                    </label>
                    <p className="source-line">
                      {mode === "example"
                        ? "Synthetic HLS-style visual fixture · schematic field pattern, not satellite imagery · identical 720×480 framing across dates. Cloud date retained. Real HLS RGB+QA remains an acquisition gap."
                        : `${supplement.meta?.imagery?.source || "HLS v2"} · ${supplement.meta?.imagery?.resolution || "30 m"} · aligned shared geographic frame; source QA masks retained.`}
                    </p>
                    <label>
                      Local observation notes
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Describe what you see, and what needs checking in the field…"
                      />
                    </label>
                  </>
                ) : (
                  <NotAvailable
                    product="Dated HLS RGB imagery and QA"
                    mode={mode}
                  />
                )}
                <NDVI
                  supplement={supplement}
                  mode={mode}
                  start={start}
                  end={end}
                />
                <p className="method-note">
                  Visual interpretation is the grower's task. NDVI measures
                  greenness, not crop residue, disease, yield or a specific
                  cause of decline.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
function NDVI({
  supplement,
  mode,
  start,
  end,
}: {
  supplement: Example;
  mode: Mode;
  start: string;
  end: string;
}) {
  return supplement.ndvi.length ? (
    <Chart
      title="NDVI · historical greenness context"
      series={[
        {
          name: "NDVI",
          color: "#7a9766",
          values: supplement.ndvi
            .filter((d) => d.date >= start && d.date <= end)
            .map((d) => ({ date: d.date, value: d.value })),
        },
      ]}
      unit="unitless"
      source={`${mode === "example" ? "SYNTHETIC MODIS-style fixture" : supplement.meta?.ndvi?.source || "MOD13Q1.061 processed QA series"} · 250 m / 16-day support · ${start}–${end} · masked values are gaps`}
    />
  ) : (
    <NotAvailable product="MODIS NDVI historical series" mode={mode} />
  );
}
