import { useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Printer,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  Day,
  Mode,
  Profile,
  Scenario,
  Score,
  Site,
  Source,
} from "../lib/types";
import { CROPS, crop, DIM_COLORS, PRIORITIES, ROTATIONS } from "../lib/catalog";
import { fmt } from "./Chart";
import { heatStats, mean, monthly } from "../lib/math";
export function FarmProfile({
  profile,
  setProfile,
  mode,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  mode: Mode;
}) {
  const change = (p: Partial<Profile>) => setProfile({ ...profile, ...p });
  return (
    <section className="card profile-card">
      <div className="section-title">
        <div>
          <span className="eyebrow">YOUR FARM / STORED ON THIS DEVICE</span>
          <h2>Start with your current plan</h2>
        </div>
      </div>
      <div className="form-grid">
        <div className="baseline-input">
          <label>Editable three-year baseline</label>
          <div className="baseline-fields">
            {profile.baseline.map((id, i) => (
              <label key={i}>
                <small>YEAR {i + 1}</small>
                <select
                  aria-label={`Baseline year ${i + 1}`}
                  value={id}
                  onChange={(e) =>
                    change({
                      baseline: profile.baseline.map((c, k) =>
                        k === i ? e.target.value : c,
                      ),
                    })
                  }
                >
                  {CROPS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
        <label>
          Optional seasonal rainfall constraint (mm)
          <input
            type="number"
            min="0"
            max="2000"
            placeholder="No cap entered"
            value={profile.waterLimit}
            onChange={(e) => change({ waterLimit: e.target.value })}
          />
          <small>
            Caps the rainfall supply used by the draft fit index; not an
            allocation or irrigation model.
          </small>
        </label>
        <label>
          Soil pH (CaCl₂)
          <input
            type="number"
            min="3"
            max="10"
            step="0.1"
            placeholder={
              mode === "example"
                ? "Example default: 6.2"
                : "Unknown — enter local test"
            }
            value={profile.ph}
            onChange={(e) => change({ ph: e.target.value })}
          />
          <small>
            Grower-entered test, separate from SLGA. Zero is retained and
            flagged as outside screening bounds.
          </small>
        </label>
        <label>
          Plan begins
          <input
            type="number"
            min="2026"
            max="2100"
            value={profile.startYear}
            onChange={(e) => change({ startYear: +e.target.value || 2027 })}
          />
        </label>
        <label>
          October root-zone gate (m³/m³)
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={profile.gate}
            onChange={(e) => change({ gate: +e.target.value })}
          />
          <small>Draft example: eligible strictly above 0.22.</small>
        </label>
        {mode === "example" && (
          <label>
            Example October moisture case
            <select
              value={profile.moistureCase}
              onChange={(e) =>
                change({
                  moistureCase: e.target.value as Profile["moistureCase"],
                })
              }
            >
              <option value="data">Fixture · 0.26 (eligible)</option>
              <option value="high">High · 0.30</option>
              <option value="low">Low · 0.16 (fallow)</option>
              <option value="unknown">Missing · decision pending</option>
            </select>
          </label>
        )}
      </div>
      <details>
        <summary>Optional grower crop / market / forage fit evidence</summary>
        <p>
          Enter a 0–10 fit rating only where you have local evidence. A blank
          entry stays unknown. Recorded ratings contribute half of the
          crop/market dimension; the other half uses thermal fit.
        </p>
        <div className="form-grid">
          {CROPS.filter((c) => c.group !== "fallow").map((c) => (
            <label key={c.id}>
              {c.name}
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                value={profile.market[c.id] ?? ""}
                placeholder="Unknown"
                onChange={(e) =>
                  change({
                    market: { ...profile.market, [c.id]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
export function Priorities({
  profile,
  setProfile,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
}) {
  return (
    <div className="priorities">
      <div>
        <span className="eyebrow">WHAT MATTERS TO YOU</span>
        <h2>Set your priorities</h2>
        <p>
          Every dimension stays visible. Adjusting a priority recalculates the
          comparison locally.
        </p>
      </div>
      <div className="priority-sliders">
        {PRIORITIES.map((label, i) => (
          <label key={label} htmlFor={`priority-${i}`}>
            <span>
              <i style={{ background: DIM_COLORS[i] }} />
              {label}
              <span className="control-value" aria-hidden="true">
                {profile.weights[i]}
                <small> / 10</small>
              </span>
            </span>
            <input
              id={`priority-${i}`}
              type="range"
              min="0"
              max="10"
              step="1"
              value={profile.weights[i]}
              aria-label={label}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  weights: profile.weights.map((v, j) =>
                    j === i ? +e.target.value : v,
                  ),
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
export function RotationComparison({
  scores,
  selected,
  setSelected,
  slots,
  setSlots,
  baseline,
  mode,
  partial = false,
}: {
  scores: Score[];
  selected: string;
  setSelected: (id: string) => void;
  slots: string[];
  setSlots: (s: string[]) => void;
  baseline: Score;
  mode: Mode;
  partial?: boolean;
}) {
  const [details, setDetails] = useState<string | null>(null);
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <span className="eyebrow">36 MONTHS / DRAFT FIT INDICES</span>
          <h2>Compare two plans</h2>
        </div>
        <span className={"badge " + (mode === "example" ? "amber" : "")}>
          {mode === "example"
            ? "Example calculations"
            : "Real weather + draft rules"}
        </span>
      </div>
      <div className="slot-selects">
        {slots.map((slot, i) => (
          <label key={i}>
            {i === 0 ? "Plan A" : "Plan B"}
            <select
              aria-label={i === 0 ? "Plan A" : "Plan B"}
              value={slot}
              onChange={(e) =>
                setSlots(slots.map((s, j) => (j === i ? e.target.value : s)))
              }
            >
              {ROTATIONS.map((r) => (
                <option
                  key={r.id}
                  value={r.id}
                  disabled={slots.includes(r.id) && r.id !== slot}
                >
                  {r.name} ·{" "}
                  {r.crops
                    .map((id) =>
                      id === "pulse"
                        ? "Suitable pulse"
                        : id === "conditional"
                          ? "Conditional sorghum"
                          : crop(id).name,
                    )
                    .join(" → ")}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="dimension-legend">
        {PRIORITIES.map((p, i) => (
          <span key={p}>
            <i style={{ background: DIM_COLORS[i] }} />
            {p}
          </span>
        ))}
      </div>
      <div className="rotation-list paired-plans">
        {scores.map((s) => (
          <article
            key={s.id}
            className={"rotation-row " + (selected === s.id ? "selected" : "")}
          >
            <div className="rotation-top">
              <div className="rotation-name">
                <span className="eyebrow">{s.rotation.tag}</span>
                <h3>{s.rotation.name}</h3>
                <ol className="crop-sequence">
                  {s.crops.map((id, i) => (
                    <li key={i}>
                      <span aria-hidden="true">
                        {crop(id).group === "fallow"
                          ? "□"
                          : crop(id).group === "pulse"
                            ? "●"
                            : "🌱"}
                      </span>
                      <span>
                        Year {i + 1}
                        <strong>{crop(id).name}</strong>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="score-total">
                <strong>
                  {s.total === null
                    ? "Needs evidence"
                    : `${fmt(s.total)} of 100`}
                </strong>
                <small>
                  {s.total === null
                    ? "See missing inputs below"
                    : partial
                      ? "Partial draft fit"
                      : "Draft fit"}
                </small>
              </div>
              <button
                className={
                  selected === s.id ? "selected-button" : "outline-button"
                }
                onClick={() => setSelected(s.id)}
                aria-pressed={selected === s.id}
              >
                {selected === s.id ? (
                  <>
                    <Check size={15} />
                    Selected
                  </>
                ) : (
                  "Use this plan"
                )}
              </button>
            </div>
            <div className="score-bars">
              {s.dimensions.map((v, j) => (
                <div key={j}>
                  <span>{PRIORITIES[j]}</span>
                  <div className="bar-track">
                    <div
                      style={{
                        width: (v ?? 0) + "%",
                        background: DIM_COLORS[j],
                      }}
                    />
                  </div>
                  <strong>{v === null ? "Missing" : fmt(v, 0)}</strong>
                </div>
              ))}
            </div>
            {s.total === null && s.flags.length > 0 && (
              <ul className="missing-inputs">
                {s.flags
                  .filter((flag) => /unknown|withheld|unavailable/i.test(flag))
                  .map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
              </ul>
            )}
            <div className="rotation-bottom">
              <span>
                {s.dimensions.filter((v) => v !== null).length}/4 dimensions
                supported ·{" "}
                {s.id === "baseline"
                  ? "Comparator"
                  : s.total !== null && baseline.total !== null
                    ? `${s.total - baseline.total >= 0 ? "+" : ""}${fmt(s.total - baseline.total)} from baseline`
                    : "Baseline difference unavailable"}
              </span>
              <button
                className="text-button"
                onClick={() => setDetails(details === s.id ? null : s.id)}
                aria-expanded={details === s.id}
              >
                Inputs & assumptions <ChevronRight size={14} />
              </button>
            </div>
            {details === s.id && (
              <div className="score-details">
                <div className="table-scroll">
                  <table>
                    <caption>
                      Historical crop-window medians; ≥5 complete reference
                      seasons for rainfall, ≥95% daily thermal completeness;
                      draft demand
                    </caption>
                    <thead>
                      <tr>
                        <th>Crop</th>
                        <th>Rain mm</th>
                        <th>Demand mm</th>
                        <th>GDD °C·day</th>
                        <th>Stage hot days / season</th>
                        <th>Stage frost days / season</th>
                        <th>Thermal days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.details.map((d, j) => (
                        <tr key={j}>
                          <th>{crop(d.crop).name}</th>
                          <td>{fmt(d.rain)}</td>
                          <td>{fmt(d.demand, 0)}</td>
                          <td>{fmt(d.gdd, 0)}</td>
                          <td>{fmt(d.hot)}</td>
                          <td>{fmt(d.frost)}</td>
                          <td>
                            {d.valid}/{d.expected}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Sequence assumptions: {s.repeat} cereal repetition(s),{" "}
                  {s.nitrogen} kg/ha illustrative pulse contribution over the
                  sequence, {fmt(s.carryover)} mm demand-equivalent carryover
                  penalty. These are uncalibrated planning parameters, not
                  measured nitrogen or stored water. Heavy-rain cover proxy:{" "}
                  {fmt(s.heavyCovered)} covered equivalents / {s.heavyTotal}{" "}
                  historical ≥20 mm/day {s.heavySource} days.
                </p>
                <ul>
                  {s.flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="method-note">
        Overall = Σ(weight × dimension score) / Σweights. Zero weights give no
        total. All compared strategies use the same weighted evidence
        dimensions; if any lacks a weighted dimension, ranking is withheld for
        the whole set. Ties use stable strategy IDs. Selection remains attached
        to its strategy ID when rows move.
      </p>
    </section>
  );
}
export function CropCatalog() {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <span className="eyebrow">CONFIGURABLE / REVIEW REQUIRED</span>
          <h2>Crop profiles</h2>
        </div>
      </div>
      <div className="crop-cards">
        {CROPS.filter((c) => c.group !== "fallow").map((c) => (
          <details key={c.id}>
            <summary>
              {c.name}
              <span>{c.group}</span>
            </summary>
            <dl>
              <dt>Plant / finish</dt>
              <dd>
                {c.sowWindow} / {c.harvestWindow}
              </dd>
              <dt>Draft GDD</dt>
              <dd>
                Base {fmt(c.base)} °C · target {fmt(c.gdd, 0)} °C·day
              </dd>
              <dt>Indicative water</dt>
              <dd>
                {fmt(c.water, 0)} mm/crop · midpoint from research range where
                available
              </dd>
              <dt>Soil pH screen</dt>
              <dd>{c.ph ? c.ph.join("–") : "Unknown"}</dd>
              <dt>Stage temperature checks</dt>
              <dd>
                {c.stages.length
                  ? c.stages
                      .map(
                        (s) =>
                          `${s.name}: months ${s.months.join(",")}, heat ≥${s.heat} °C, frost ≤${s.frost} °C`,
                      )
                      .join("; ")
                  : "Unknown"}
              </dd>
              <dt>Origin</dt>
              <dd>{c.origin}</dd>
              <dt>Local review</dt>
              <dd>{c.review}</dd>
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
export function FuturePanel({
  scenario,
  setScenario,
  historical,
  transformed,
  scores,
  originalScores,
}: {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  historical: Day[];
  transformed: Day[];
  scores: Score[];
  originalScores: Score[];
}) {
  const annualRain = (rows: Day[]) => {
    const complete = monthly(rows, "rain").filter((x) => x.value !== null);
    return mean(complete.map((x) => x.value));
  };
  const h = heatStats(historical),
    t = heatStats(transformed);
  const rain0 = annualRain(historical),
    rain1 = annualRain(transformed);
  return (
    <section className="card future-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">
            FUTURE ESTIMATES / ILLUSTRATIVE SCENARIO
          </span>
          <h2>What if the seasons shift?</h2>
          <p>
            Transform a copy of your historical weather, then recalculate the
            same rotations.
          </p>
        </div>
        <div className="button-row">
          <button
            className="outline-button"
            onClick={() =>
              setScenario({
                warming: 1.6,
                rainfall: 0,
                heavy: 5,
                season: "all",
                runoff: 0,
              })
            }
          >
            Illustrative 2050 preset
          </button>
          <button
            className="outline-button"
            onClick={() =>
              setScenario({
                warming: 0,
                rainfall: 0,
                heavy: 0,
                season: "all",
                runoff: 0,
              })
            }
          >
            <RotateCcw size={15} />
            Reset scenario
          </button>
        </div>
      </div>
      <div className="scenario-grid">
        <label>
          Air warming{" "}
          <span className="control-value" aria-hidden="true">
            +{scenario.warming.toFixed(1)} °C
          </span>
          <input
            type="range"
            min="0"
            max="4"
            step="0.1"
            value={scenario.warming}
            onChange={(e) =>
              setScenario({ ...scenario, warming: +e.target.value })
            }
          />
        </label>
        <label>
          Seasonal rainfall change{" "}
          <span className="control-value" aria-hidden="true">
            {scenario.rainfall > 0 ? "+" : ""}
            {scenario.rainfall}%
          </span>
          <input
            type="range"
            min="-40"
            max="40"
            step="1"
            value={scenario.rainfall}
            onChange={(e) =>
              setScenario({ ...scenario, rainfall: +e.target.value })
            }
          />
        </label>
        <label>
          Heavy-rain intensity{" "}
          <span className="control-value" aria-hidden="true">
            +{scenario.heavy}%
          </span>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={scenario.heavy}
            onChange={(e) =>
              setScenario({ ...scenario, heavy: +e.target.value })
            }
          />
        </label>
        <label>
          Rainfall adjustment season
          <select
            value={scenario.season}
            onChange={(e) =>
              setScenario({ ...scenario, season: e.target.value })
            }
          >
            <option value="all">All seasons</option>
            <option value="summer">Summer · Dec–Feb</option>
            <option value="autumn">Autumn · Mar–May</option>
            <option value="winter">Winter · Jun–Aug</option>
            <option value="spring">Spring · Sep–Nov</option>
          </select>
        </label>
        <label>
          Separate runoff sensitivity
          <input
            type="number"
            min="0"
            max="50"
            value={scenario.runoff}
            onChange={(e) =>
              setScenario({ ...scenario, runoff: +e.target.value })
            }
          />
          <small>
            % of scenario rainfall displayed as a sensitivity only. No runoff
            model; not deducted from crop scores.
          </small>
        </label>
      </div>
      <div className="stats-grid">
        <StatLocal
          label="Mean complete-month rainfall"
          before={rain0}
          after={rain1}
          unit="mm"
        />
        <StatLocal
          label="Hot days ≥35 °C"
          before={h.hot}
          after={t.hot}
          unit="days"
        />
        <StatLocal
          label="Frost exposure ≤0 °C"
          before={h.frost}
          after={t.frost}
          unit="days"
        />
      </div>
      <p className="source-line">
        Same selected site and historical window. Heavy days are identified from
        unmodified daily rainfall ≥20 mm/day. Scenario rainfall = original ×
        seasonal multiplier × heavy-day multiplier; adjustments multiply on
        qualifying days. Air Tmin/Tmax/mean add warming. Missing values persist.
        Skin temperature, moisture, NDVI and soil are unchanged.
      </p>
      <div className="table-scroll">
        <table>
          <caption>
            Baseline vs scenario · no forecast probability or yield projection
          </caption>
          <thead>
            <tr>
              <th>Rotation</th>
              <th>Historical fit</th>
              <th>Scenario fit</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const o = originalScores.find((o) => o.id === s.id);
              return (
                <tr key={s.id}>
                  <th>{s.rotation.name}</th>
                  <td>{fmt(o?.total)}</td>
                  <td>{fmt(s.total)}</td>
                  <td>
                    {s.total !== null &&
                    o?.total !== null &&
                    o?.total !== undefined
                      ? fmt(s.total - o.total)
                      : "Unavailable"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="method-note">
        2050 is an illustrative label for +1.6 °C and +5% heavy-rain intensity,
        not a downscaled climate forecast. Seasonal rainfall defaults to 0% in
        the preset. Runoff sensitivity:{" "}
        {fmt(((rain1 ?? 0) * scenario.runoff) / 100)} mm per mean complete month
        (separate assumption).
      </p>
    </section>
  );
}
function StatLocal({
  label,
  before,
  after,
  unit,
}: {
  label: string;
  before: number | null;
  after: number | null;
  unit: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {fmt(before)} → {fmt(after)}
      </strong>
      <small>
        {before !== null && after !== null
          ? `${after - before >= 0 ? "+" : ""}${fmt(after - before)} ${unit} scenario delta`
          : "No valid evidence"}
      </small>
    </div>
  );
}
export function Calendar({ score }: { score: Score }) {
  const years = [...new Set(score.calendar.map((a) => a.year))];
  return (
    <div className="calendar">
      {years.map((year, i) => (
        <div className="calendar-year" key={year}>
          <div className="calendar-year-title">
            <h3>{year}</h3>
            <span>
              YEAR {i + 1} / {crop(score.crops[i]).name}
            </span>
          </div>
          <div className="calendar-months">
            {score.calendar
              .filter((a) => a.year === year)
              .map((a) => (
                <div key={a.month} className={"month " + a.phase.toLowerCase()}>
                  <strong>
                    {new Date(2025, a.month - 1, 1).toLocaleString("en-AU", {
                      month: "short",
                    })}
                  </strong>
                  <span>{a.phase}</span>
                  <small>{crop(a.crop).name}</small>
                  {a.flag && (
                    <span className="decision-flag" title={a.flag}>
                      Review <Info size={11} />
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

export function CalendarFlyout({
  score,
  place,
  mode,
  openCalendar,
}: {
  score: Score;
  place?: string;
  mode: Mode;
  openCalendar?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const activity = score.calendar[index];
  const leadingDays = activity
    ? (new Date(Date.UTC(activity.year, activity.month - 1, 1)).getUTCDay() +
        6) %
      7
    : 0;
  const dayCount = activity
    ? new Date(Date.UTC(activity.year, activity.month, 0)).getUTCDate()
    : 0;
  return (
    <>
      <button
        className="calendar-trigger outline-button"
        onClick={() => dialog.current?.showModal()}
      >
        <CalendarDays size={16} aria-hidden="true" /> Calendar
      </button>
      <dialog
        ref={dialog}
        className={`calendar-flyout${expanded ? " expanded" : ""}`}
        aria-labelledby="flyout-heading"
      >
        <div className="calendar-flyout-header">
          <div>
            <h2 id="flyout-heading">Planting calendar</h2>
            <p>
              {place
                ? `${place} · ${score.rotation.name}${mode === "example" ? " · Example" : ""}`
                : "Select a town to see a planting plan."}
            </p>
          </div>
          <form method="dialog">
            <button className="outline-button" aria-label="Close calendar">
              <X size={18} />
            </button>
          </form>
        </div>
        {openCalendar && (
          <button
            className="text-button"
            onClick={() => {
              dialog.current?.close();
              openCalendar();
            }}
          >
            Open full calendar
          </button>
        )}
        {place && activity && (
          <>
            <div className="calendar-controls">
              <button
                className="outline-button"
                aria-label="Previous month"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <label>
                <span className="sr-only">Planning month</span>
                <select
                  value={index}
                  onChange={(e) => setIndex(Number(e.target.value))}
                >
                  {score.calendar.map(({ year, month }, n) => (
                    <option key={`${year}-${month}`} value={n}>
                      {monthLabel(year, month)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="outline-button"
                aria-label="Next month"
                disabled={index === score.calendar.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {!expanded && (
              <table
                className="month-grid"
                aria-label={monthLabel(activity.year, activity.month)}
              >
                <thead>
                  <tr>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <th key={day} scope="col">
                          {day}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    { length: Math.ceil((leadingDays + dayCount) / 7) },
                    (_, week) => (
                      <tr key={week}>
                        {Array.from({ length: 7 }, (_, weekday) => {
                          const day = week * 7 + weekday - leadingDays + 1;
                          return (
                            <td key={weekday}>
                              {day >= 1 && day <= dayCount ? day : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
            <div
              className={`month calendar-activity ${activity.phase.toLowerCase()}`}
            >
              <strong>{activity.phase}</strong>
              <span>{crop(activity.crop).name}</span>
              {activity.flag && <p>{activity.flag}</p>}
            </div>
            <p className="calendar-note">
              Activities are planning windows by month. Confirm specific dates
              locally.
            </p>
            <button
              className="outline-button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show one month" : "Expand all 36 months"}
            </button>
            {expanded && <Calendar score={score} />}
          </>
        )}
      </dialog>
    </>
  );
}
export function CalendarPage({
  score,
  place,
  mode,
}: {
  score: Score;
  place?: string;
  mode: Mode;
}) {
  const [yearIndex, setYearIndex] = useState(0);
  const [month, setMonth] = useState<number | null>(null);
  const years = [...new Set(score.calendar.map((activity) => activity.year))];
  const year = years[yearIndex];
  const activities = score.calendar.filter(
    (activity) => activity.year === year,
  );
  const selected = activities.find((activity) => activity.month === month);
  if (!place)
    return (
      <p className="card">
        Choose a town or area with evidence, then choose a rotation to view its
        calendar.
      </p>
    );
  return (
    <section className="card planning-calendar">
      <p>
        {place} · {score.rotation.name} ·{" "}
        {mode === "example" ? "Example plan" : "Draft planning windows"}
      </p>
      <label>
        Plan year{" "}
        <select
          value={yearIndex}
          onChange={(event) => {
            setYearIndex(Number(event.target.value));
            setMonth(null);
          }}
        >
          {years.map((value, index) => (
            <option key={value} value={index}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="calendar-year-grid">
        {activities.map((activity) => (
          <button
            key={activity.month}
            className="month outline-button"
            aria-pressed={month === activity.month}
            onClick={() => setMonth(activity.month)}
          >
            <strong>{monthLabel(year, activity.month)}</strong>
            <span>
              {activity.phase} · {crop(activity.crop).name}
            </span>
          </button>
        ))}
      </div>
      <h2>
        {selected
          ? monthLabel(year, selected.month)
          : "Planting, harvest and review windows"}
      </h2>
      {selected ? (
        <p>
          {selected.phase} · {crop(selected.crop).name}. {selected.flag}
        </p>
      ) : (
        <ul>
          {activities
            .filter(
              (activity) =>
                ["Plant", "Harvest", "Decision"].includes(activity.phase) ||
                activity.flag,
            )
            .map((activity) => (
              <li key={activity.month}>
                {monthLabel(year, activity.month)} · {activity.phase} ·{" "}
                {crop(activity.crop).name}
                {activity.flag ? ` · ${activity.flag}` : ""}
              </li>
            ))}
        </ul>
      )}
      <p>Timing is shown by month. Confirm field dates locally.</p>
    </section>
  );
}
export function ReviewCards({
  score,
  site,
  mode,
  sources,
  scenario,
  ph,
  moisture,
  notes,
}: {
  score: Score;
  site?: Site;
  mode: Mode;
  sources: Source[];
  scenario: Scenario;
  ph: number | null;
  moisture: number | null;
  notes: string;
}) {
  return (
    <div className="review-cards">
      <section>
        <span className="card-number">01 / EVIDENCE</span>
        <h3>What this plan uses</h3>
        <p>
          {site?.name} · {site?.region}. {site?.lgaName} boundary and a separate
          sample at {site?.lat}, {site?.lon}.
        </p>
        <p>
          {mode === "example"
            ? "SYNTHETIC weather, soil, moisture, water masks and imagery. Interaction demonstration only."
            : "Real NASA POWER weather cache; missing satellite inputs remain unavailable. User-entered soil and fit ratings are assumptions."}
        </p>
        <p>
          Soil pH(CaCl₂): {fmt(ph)} · October root-zone moisture:{" "}
          {fmt(moisture, 3)} m³/m³.
        </p>
        {sources
          .filter((s) => s.status === "ready")
          .map((s) => (
            <p key={s.id}>
              <strong>{s.name}</strong> · {s.start}–{s.end}
              <br />
              {s.resolution} · {s.timeStandard}
              <br />
              Retrieved {s.retrievedAt.slice(0, 10)}; processed{" "}
              {s.processedAt.slice(0, 10)}.
            </p>
          ))}
      </section>
      <section>
        <span className="card-number">02 / INFORMATION GAPS & UNCERTAINTY</span>
        <h3>What needs a closer look</h3>
        <p>
          Weather is coarse point-extracted regional context. The selected
          boundary is not the measured weather footprint. Cache ends in 2025; it
          does not describe current conditions.
        </p>
        <p>
          Crop thresholds, planting windows, nitrogen credit and carryover are
          draft planning assumptions. No local station or field validation has
          been completed.
        </p>
        <p>
          {mode === "real"
            ? "IMERG, SMAP, OPERA, HLS, MODIS, SLGA and observed ET are not acquired in this starter pack."
            : "Example fixtures cannot validate environmental or agronomic performance."}
        </p>
        <ul>
          {score.flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p>
          Scenario: +{scenario.warming} °C, {scenario.rainfall}%{" "}
          {scenario.season} rainfall, +{scenario.heavy}% heavy intensity. Runoff
          sensitivity {scenario.runoff}% is separate.
        </p>
      </section>
      <section>
        <span className="card-number">03 / FARMER & AGRONOMIST REVIEW</span>
        <h3>Bring local knowledge</h3>
        {[
          "Confirm seasonal water allocation, licence and local restrictions.",
          "Measure stored soil water before any summer crop; review following-crop reserve.",
          "Check soil pH test method, soil depth, drainage and waterlogging.",
          "Check herbicide plant-back, crop disease and variety suitability.",
          "Confirm seed, sowing window, cover termination, equipment and local grain / forage markets.",
          "Review heavy-rain exposure and retained residue in the paddock.",
        ].map((t) => (
          <label className="check-item" key={t}>
            <input type="checkbox" />
            {t}
          </label>
        ))}
        {notes && (
          <p>
            <strong>Grower notes:</strong> {notes}
          </p>
        )}
        <p>Use this brief for a local planning discussion.</p>
      </section>
    </div>
  );
}
export function FarmBrief({
  score,
  site,
  mode,
  start,
  end,
  scenario,
  profile,
  sources,
  ph,
  moisture,
}: {
  score: Score;
  site?: Site;
  mode: Mode;
  start: string;
  end: string;
  scenario: Scenario;
  profile: Profile;
  sources: Source[];
  ph: number | null;
  moisture: number | null;
}) {
  return (
    <section className="farm-brief">
      <div className="brief-heading">
        <div>
          <span className="eyebrow">FIELD SHIFT / 36-MONTH PLANNING BRIEF</span>
          <h1>{site?.name || "No supported sample selected"}</h1>
          <p>
            {site?.region} · {site?.state} · {site?.catchment}
          </p>
          <p>
            {mode === "example"
              ? "EXAMPLE MODE — SYNTHETIC EVIDENCE"
              : "REAL-DATA MODE — POWER WEATHER + DRAFT PLANNING ASSUMPTIONS"}
          </p>
        </div>
        <button
          className="primary-button no-print"
          onClick={() => window.print()}
        >
          <Printer size={17} />
          Print / Save as PDF
        </button>
      </div>
      <div className="brief-meta">
        <span>
          <strong>Chosen strategy</strong>
          {score.rotation.name}
        </span>
        <span>
          <strong>Historical reference</strong>
          {start}–{end}
        </span>
        <span>
          <strong>Plan</strong>
          {profile.startYear}–{profile.startYear + 2}
        </span>
        <span>
          <strong>Priorities / 10</strong>
          {profile.weights.join(" / ")}
        </span>
      </div>
      <p className="brief-sequence">
        {score.crops.map((id) => crop(id).name).join(" → ")}
      </p>
      <p>
        Scenario inputs: +{scenario.warming.toFixed(1)} °C air warming;{" "}
        {scenario.rainfall}% {scenario.season} rainfall; +{scenario.heavy}%
        intensity on historical ≥20 mm/day days. Runoff sensitivity{" "}
        {scenario.runoff}% shown separately. Scenario values are not forecasts.
        Weather cache 2016–2025; no current-condition claim.
      </p>
      <Calendar score={score} />
      <div className="guidance card">
        <h2>Regional guidance</h2>
        <p>
          {site?.region === "Northern Basin"
            ? "Northern site: review summer rainfall reliability and reserve stored water before an opportunity summer crop."
            : "Southern site: review autumn establishment rainfall, winter drainage and the spring finish. Summer forage remains conditional on measured water and the following crop."}{" "}
          {site?.catchment} guidance uses the selected site and current
          scenario, not a basin-wide paddock prescription.
        </p>
        <ul>
          {score.crops.map((id, i) => (
            <li key={i}>
              <strong>
                Year {i + 1}: {crop(id).name}.
              </strong>{" "}
              Indicative planting {crop(id).sowWindow}; finish{" "}
              {crop(id).harvestWindow}. {crop(id).review}
            </li>
          ))}
        </ul>
        <p>
          {score.partial
            ? "Partial fit using shared evidence"
            : "Current weather-based fit"}
          : {fmt(score.total)} / 100;{" "}
          {score.dimensions.filter((x) => x !== null).length}/4 supported
          dimensions. No yield, financial return or damage probability
          estimated.
        </p>
      </div>
      <ReviewCards
        score={score}
        site={site}
        mode={mode}
        sources={sources}
        scenario={scenario}
        ph={ph}
        moisture={moisture}
        notes={profile.notes}
      />
      <p className="print-footer">
        Field Shift prototype v0.1 · rules/1.0.0 · planning discussion only ·
        printed {new Date().toLocaleDateString("en-AU")} · Source geometry: MDBA
        / ABS CC BY 4.0; context: Natural Earth.
      </p>
    </section>
  );
}
