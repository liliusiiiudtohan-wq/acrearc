import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  Info,
  MapPin,
  RefreshCw,
  RotateCcw,
  Sprout,
  X,
} from "lucide-react";
import { geoContains, geoCentroid } from "d3-geo";
import type {
  Day,
  Example,
  Manifest,
  Mode,
  Profile,
  Scenario,
  Source,
} from "./lib/types";
import { emptySupplement, json, loadSite, refreshPower } from "./lib/data";
import {
  BASE_SCENARIO,
  DEFAULT_PROFILE,
  ROTATIONS,
  RULE_CONFIG,
} from "./lib/catalog";
import { applyScenario, clamp, weighted } from "./lib/math";
import { scoreRotation } from "./lib/engine";
import BasinMap, {
  type Area,
  featureName,
  prepareGeometry,
  validRing,
} from "./components/BasinMap";
import RiskPanels from "./components/RiskPanels";
import {
  CropCatalog,
  CalendarFlyout,
  CalendarPage,
  FarmBrief,
  FarmProfile,
  FuturePanel,
  Priorities,
  RotationComparison,
} from "./components/Planning";
import { fmt } from "./components/Chart";
function storedProfile(): Profile {
  try {
    const p = JSON.parse(
      localStorage.getItem("field-shift-profile-v1") || "null",
    );
    if (p && p.weights?.length === 4 && p.baseline?.length === 3)
      return {
        ...DEFAULT_PROFILE,
        ...p,
        weights: p.weights.map((x: number) => clamp(x, 0, 10)),
      };
  } catch {}
  return structuredClone(DEFAULT_PROFILE);
}
export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null),
    [geo, setGeo] = useState<any>(null),
    [fatal, setFatal] = useState(""),
    [tab, setPage] = useState("explore"),
    [mode, setMode] = useState<Mode>("real"),
    [siteId, setSiteId] = useState(""),
    [area, setArea] = useState<Area | null>(null),
    [regionFilter, setRegionFilter] = useState(""),
    [stateFilter, setStateFilter] = useState(""),
    [catchmentFilter, setCatchmentFilter] = useState("");
  const [profile, setProfile] = useState<Profile>(storedProfile),
    [scenario, setScenario] = useState<Scenario>({ ...BASE_SCENARIO }),
    [slots, setSlots] = useState(["baseline", "break"]),
    [rotationStep, setRotationStep] = useState(0),
    [selected, setSelected] = useState("baseline"),
    [useSharedEvidence, setUseSharedEvidence] = useState(false),
    [start, setStart] = useState("2016-01-01"),
    [end, setEnd] = useState("2025-12-31"),
    [analysisEnd, setAnalysisEnd] = useState("2025-12-31"),
    [panel, setPanel] = useState("history"),
    [depth, setDepth] = useState<"surface" | "root">("root"),
    [threeD, setThreeD] = useState(false),
    [floodSide, setFloodSide] = useState("event"),
    [rows, setRows] = useState<Day[]>([]),
    [supplement, setSupplement] = useState<Example>(emptySupplement),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [science, setScience] = useState(false),
    [pin, setPin] = useState({ lat: "", lon: "" }),
    [polygon, setPolygon] = useState(""),
    [inputError, setInputError] = useState(""),
    [refreshState, setRefreshState] = useState(""),
    [recent, setRecent] = useState<any>(null);
  const refreshAbort = useRef<AbortController | null>(null),
    refreshSeq = useRef(0),
    closeScience = useRef<HTMLButtonElement>(null);
  const setTab = (page: string) => {
    setPage(page);
    document.documentElement.scrollTop = 0;
  };
  useEffect(() => {
    const c = new AbortController();
    json<Manifest>("manifest.json", c.signal)
      .then(async (m) => {
        if (m.contractVersion !== "field-shift-data/1.0.0")
          throw Error("Unsupported data contract");
        const values = await Promise.all(
          Object.entries(m.boundaries).map(async ([k, v]) => [
            k,
            prepareGeometry(await json(v, c.signal)),
          ]),
        );
        setManifest(m);
        setGeo(Object.fromEntries(values));
      })
      .catch((e) => {
        if (!c.signal.aborted) setFatal(String(e));
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("field-shift-profile-v1", JSON.stringify(profile));
    } catch {}
  }, [profile]);
  const site = manifest?.sites.find((s) => s.id === siteId);
  useEffect(() => {
    const c = new AbortController();
    refreshAbort.current?.abort();
    refreshSeq.current++;
    setRecent(null);
    setRefreshState("");
    setRows([]);
    setSupplement(emptySupplement());
    setError("");
    if (!site || !manifest) {
      setLoading(false);
      return () => c.abort();
    }
    setLoading(true);
    loadSite(manifest, site, mode, c.signal)
      .then((d) => {
        if (c.signal.aborted) return;
        setRows(d.days);
        setSupplement(d.supplement);
        setError(d.errors.join("; "));
        setLoading(false);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(`Failed to load ${site.name}: ${String(e)}`);
          setLoading(false);
        }
      });
    return () => c.abort();
  }, [manifest, site, mode]);
  useEffect(() => {
    if (science) closeScience.current?.focus();
  }, [science]);
  const filteredRows = useMemo(
      () => rows.filter((d) => d.date >= start && d.date <= end),
      [rows, start, end],
    ),
    scenarioRows = useMemo(
      () => applyScenario(filteredRows, scenario),
      [filteredRows, scenario],
    );
  const ph =
    profile.ph !== ""
      ? Number(profile.ph)
      : mode === "example" && Number.isFinite(supplement.soilPH)
        ? supplement.soilPH
        : null;
  const moisture =
    mode === "example" && profile.moistureCase !== "data"
      ? profile.moistureCase === "low"
        ? 0.16
        : profile.moistureCase === "high"
          ? 0.3
          : null
      : Number.isFinite(supplement.octoberMoisture)
        ? supplement.octoberMoisture
        : null;
  const compute = (input: Day[]) => {
    const raw = ROTATIONS.map((r) =>
      scoreRotation(
        r,
        input,
        profile,
        moisture,
        ph,
        supplement.imerg
          ? input === scenarioRows
            ? applyScenario(
                supplement.imerg.filter(
                  (d) => d.date >= start && d.date <= end,
                ),
                scenario,
              )
            : supplement.imerg.filter((d) => d.date >= start && d.date <= end)
          : undefined,
        supplement.imerg ? "IMERG Final" : "POWER proxy",
      ),
    );
    const common = raw[0].dimensions.map((_, i) =>
      raw
        .filter((s) => slots.includes(s.id))
        .every((s) => s.dimensions[i] !== null),
    );
    return raw.map((s) => ({
      ...s,
      partial:
        useSharedEvidence &&
        common.some((v, i) => !v && profile.weights[i] > 0),
      total: weighted(
        s.dimensions.map((v, i) => (common[i] ? v : null)),
        profile.weights.map((weight, i) =>
          useSharedEvidence && !common[i] ? 0 : weight,
        ),
      ),
    }));
  };
  const historicalScores = useMemo(
      () => compute(filteredRows),
      [
        filteredRows,
        profile,
        moisture,
        ph,
        slots,
        supplement,
        start,
        end,
        scenarioRows,
        scenario,
        useSharedEvidence,
      ],
    ),
    scores = useMemo(
      () => compute(scenarioRows),
      [
        scenarioRows,
        profile,
        moisture,
        ph,
        slots,
        supplement,
        start,
        end,
        scenario,
        useSharedEvidence,
      ],
    );
  const pair = slots.map((id) => scores.find((s) => s.id === id)!),
    picked = scores.find((s) => s.id === selected) || scores[0],
    baseline = scores[0];
  const missingScoreInputs = [
    "Water",
    "Soil suitability",
    "Ground cover",
    "Crop fit",
  ].filter(
    (_, i) =>
      profile.weights[i] > 0 &&
      pair.some((score) => score.dimensions[i] === null),
  );
  const chooseSite = (id: string) => {
    const s = manifest!.sites.find((s) => s.id === id)!;
    setSiteId(id);
    setRegionFilter(s.region);
    setStateFilter(s.state);
    setCatchmentFilter(s.catchment);
    setArea({
      name: s.name + " sample",
      type: "town sample",
      feature: geo.lgas.features.find(
        (f: any) => f.properties.LGA_CODE_2025 === s.lgaCode,
      ),
      point: [s.lon, s.lat],
      region: s.region,
    });
  };
  const chooseArea = (a: Area | null) => {
    setArea(a);
    const sample =
      a && !["region", "catchment"].includes(a.type)
        ? manifest?.sites.find(
            (s) =>
              s.powerFile &&
              (a.feature
                ? geoContains(a.feature, [s.lon, s.lat])
                : a.point?.[0] === s.lon && a.point?.[1] === s.lat),
          )
        : undefined;
    setSiteId(sample?.id || "");
    setRegionFilter(a?.region || (a?.type === "region" ? a.name : ""));
    setStateFilter("");
    setCatchmentFilter(a?.type === "catchment" ? a.name : "");
  };
  const available =
    manifest?.sites.filter(
      (s) =>
        (!regionFilter || s.region === regionFilter) &&
        (!stateFilter || s.state === stateFilter) &&
        (!catchmentFilter || s.catchment === catchmentFilter) &&
        (area?.type !== "LGA" || s.lgaName === area.name),
    ) || [];
  const sources =
      manifest?.sources.filter((s) =>
        mode === "example" ? s.id === "example" : s.id === "power-" + siteId,
      ) || [],
    allSources =
      manifest?.sources.filter(
        (s) =>
          s.mode === mode &&
          (!s.id.startsWith("power-") || s.id === "power-" + siteId),
      ) || [];
  const doRefresh = async () => {
    if (!site || mode !== "real") return;
    refreshAbort.current?.abort();
    const c = new AbortController();
    refreshAbort.current = c;
    const seq = ++refreshSeq.current;
    const timer = window.setTimeout(() => c.abort(), 20000);
    setRefreshState("Fetching up to 30 recent days…");
    try {
      const result = await refreshPower(site, c.signal);
      if (seq !== refreshSeq.current) return;
      setRecent(result);
      try {
        localStorage.setItem(
          "field-shift-last-power-" + site.id,
          JSON.stringify(result),
        );
      } catch {}
      setRefreshState(
        "Validated recent observations loaded separately; historical cache remains 2016–2025.",
      );
    } catch (e) {
      if (seq !== refreshSeq.current) return;
      let cached = null;
      try {
        cached = JSON.parse(
          localStorage.getItem("field-shift-last-power-" + site.id) || "null",
        );
      } catch {}
      setRecent(cached);
      setRefreshState(
        `Recent request failed (${c.signal.aborted ? "timeout" : String(e)}). ${cached ? "Showing last successful recent cache." : "Using bundled historical cache; recent data unavailable."}`,
      );
    } finally {
      clearTimeout(timer);
    }
  };
  const keyboardPin = () => {
    if (pin.lat === "" || pin.lon === "") {
      setInputError("Enter both coordinates.");
      return;
    }
    const p: [number, number] = [Number(pin.lon), Number(pin.lat)];
    if (
      !p.every(Number.isFinite) ||
      !geo.basin.features.some((f: any) => geoContains(f, p))
    ) {
      setInputError(
        "Point is outside the basin. Choose an in-scope coordinate or supported town.",
      );
      return;
    }
    setInputError("");
    chooseArea({
      name: `Pin ${p[1].toFixed(3)}, ${p[0].toFixed(3)}`,
      type: "point",
      feature: null,
      point: p,
      region: geo.regions.features.find((f: any) => geoContains(f, p))
        ?.properties.Region,
    });
  };
  const keyboardPolygon = () => {
    try {
      const coords = JSON.parse(polygon);
      if (
        !Array.isArray(coords) ||
        coords.length < 3 ||
        !coords.every(
          (p: any) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every(Number.isFinite) &&
            geo.basin.features.some((f: any) =>
              geoContains(f, p as [number, number]),
            ),
        )
      )
        throw Error("Enter at least 3 in-basin [longitude, latitude] pairs.");
      const closed = [...coords];
      const open =
        String(closed[0]) === String(closed.at(-1))
          ? closed.slice(0, -1)
          : closed;
      if (!validRing(open))
        throw Error(
          "Use distinct vertices and a boundary that does not cross itself.",
        );
      if (JSON.stringify(closed[0]) !== JSON.stringify(closed.at(-1)))
        closed.push(closed[0]);
      chooseArea({
        name: "Drawn planning area",
        type: "drawn area",
        feature: prepareGeometry({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [closed] },
            },
          ],
        }).features[0],
        point: closed[0],
      });
      setInputError("");
    } catch (e) {
      setInputError(String(e));
    }
  };
  if (fatal)
    return (
      <main className="startup">
        <h1>Data pack could not open</h1>
        <p>{fatal}</p>
        <p>Confirm public/data/manifest.json and its assets are present.</p>
        <button onClick={() => location.reload()}>Retry</button>
      </main>
    );
  if (!manifest || !geo)
    return (
      <main className="startup">
        <Sprout size={42} />
        <h1>Field Shift</h1>
        <p>Opening the basin data pack…</p>
      </main>
    );
  const nav = [
      ["explore", "Explore the basin"],
      ["compare", "Compare rotations"],
      ["future", "Future estimates"],
      ["calendar", "Calendar"],
      ["brief", "Farm brief"],
    ],
    scenarioActive =
      scenario.warming !== 0 || scenario.rainfall !== 0 || scenario.heavy !== 0;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div
        className={
          tab === "explore" ? "app-screen explore-screen" : "app-screen"
        }
      >
        <header className="header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("explore");
            }}
          >
            <span className="brand-mark">
              <Sprout size={24} />
            </span>
            <span>
              field shift
              <span className="brand-sub">
                {site?.name || area?.name || "Full basin"}
              </span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {nav.map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
          <CalendarFlyout
            score={picked}
            place={site?.name}
            mode={mode}
            openCalendar={() => setTab("calendar")}
          />
          <button className="science-button" onClick={() => setScience(true)}>
            <Info size={16} />
            <span>About the science</span>
          </button>
        </header>
        <div className={"mode-ribbon " + (mode === "example" ? "example" : "")}>
          <div>
            <span className="live-dot" />
            <strong>
              {mode === "real" ? "Real-data mode" : "EXAMPLE MODE"}
            </strong>
            <span>
              {mode === "real"
                ? "Bundled NASA POWER observations · draft planning rules"
                : "Synthetic weather and satellite-style fixtures · demonstration only"}
            </span>
          </div>
          <label className="mode-switch">
            Data mode
            <select
              aria-label="Data mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="real">Real data</option>
              <option value="example">Example</option>
            </select>
          </label>
        </div>
        <main id="main">
          <div className="page-intro">
            <div>
              <span className="eyebrow">
                MURRAY–DARLING BASIN / NASA SPACE APPS PROTOTYPE
              </span>
              <h1>
                {tab === "calendar" ? (
                  <>Planting calendar</>
                ) : tab === "explore" ? (
                  <>Find your farm area</>
                ) : tab === "compare" ? (
                  <>Compare crop rotations</>
                ) : tab === "future" ? (
                  <>Try a climate scenario</>
                ) : (
                  <>Your three-year farm plan</>
                )}
              </h1>
              <p>
                {tab === "explore"
                  ? "Start with a place. Explore the evidence. Build a three-year plan with local knowledge."
                  : tab === "compare"
                    ? "Balance water, soil, cover and crop fit against the priorities of your farm."
                    : tab === "future"
                      ? "Explore a transparent climate assumption using the same historical evidence."
                      : "A calendar and evidence trail to take to your local agronomist."}
              </p>
            </div>
          </div>
          <div className="context-bar">
            <div>
              <MapPin size={16} />
              <span className="current-step">
                {nav.find(([id]) => id === tab)?.[1]} /
              </span>
              <strong>
                {area?.type === "town sample" ? site?.name : area?.name || "Full basin · choose an area"}
              </strong>
              <span>
                {site
                  ? (area?.type !== "town sample" ? `Weather point: ${site.name}` : `${site.region} · ${site.catchment}`)
                  : area
                    ? area.type
                    : "Northern + Southern Basin"}
              </span>
            </div>
            <div className="date-range">
              <details className="reference-settings">
                <summary>
                  History: {start.slice(0, 4)}–{end.slice(0, 4)}
                </summary>
                <label>
                  Start date
                  <input
                    aria-label="Historical start date"
                    type="date"
                    min="2016-01-01"
                    max={end}
                    value={start}
                    onChange={(e) => {
                      if (e.target.value && e.target.value <= end) {
                        setStart(e.target.value);
                        if (analysisEnd < e.target.value)
                          setAnalysisEnd(e.target.value);
                      }
                    }}
                  />
                </label>
                <label>
                  End date
                  <input
                    aria-label="Historical end date"
                    type="date"
                    min={start}
                    max="2025-12-31"
                    value={end}
                    onChange={(e) => {
                      if (e.target.value && e.target.value >= start) {
                        setEnd(e.target.value);
                        if (analysisEnd > e.target.value)
                          setAnalysisEnd(e.target.value);
                      }
                    }}
                  />
                </label>
              </details>
            </div>
          </div>
          {scenarioActive && (
            <div className="scenario-banner">
              <Info size={16} />
              Scenario active in planning: +{scenario.warming.toFixed(1)} °C ·{" "}
              {scenario.rainfall}% {scenario.season} rainfall · +
              {scenario.heavy}% heavy intensity. Historical charts retain
              observations.
              <button
                className="text-button"
                onClick={() => setScenario({ ...BASE_SCENARIO })}
              >
                Reset
              </button>
            </div>
          )}
          {tab === "explore" && (
            <>
              <div className="explore-layout">
                <details className="location-panel">
                  <summary>Find a town or area</summary>
                  <h2>Choose a location</h2>
                  <p>Pick a town, drop a pin or draw an area.</p>
                  <label>
                    Basin region
                    <select
                      aria-label="Basin region"
                      value={regionFilter}
                      onChange={(e) => {
                        const f = geo.regions.features.find(
                          (f: any) => featureName(f) === e.target.value,
                        );
                        chooseArea(
                          f
                            ? {
                                name: featureName(f),
                                type: "region",
                                feature: f,
                              }
                            : null,
                        );
                      }}
                    >
                      <option value="">Full Murray–Darling Basin</option>
                      {geo.regions.features.map((f: any) => (
                        <option key={featureName(f)}>{featureName(f)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Town weather sample
                    <select
                      aria-label="Town sample"
                      value={siteId}
                      onChange={(e) =>
                        e.target.value && chooseSite(e.target.value)
                      }
                    >
                      <option value="">Choose a town sample</option>
                      {available.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.powerFile
                            ? " · weather cached"
                            : " · no real series"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <details className="location-filters">
                    <summary>More area filters</summary>
                    <label>
                      State
                      <select
                        aria-label="State"
                        value={stateFilter}
                        onChange={(e) => {
                          setStateFilter(e.target.value);
                          setSiteId("");
                          setCatchmentFilter("");
                          setArea(null);
                        }}
                      >
                        <option value="">All in-scope states</option>
                        {[
                          ...new Set(
                            manifest.sites
                              .filter(
                                (s) =>
                                  !regionFilter || s.region === regionFilter,
                              )
                              .map((s) => s.state),
                          ),
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Catchment / Basin Plan region
                      <select
                        aria-label="Catchment"
                        value={catchmentFilter}
                        onChange={(e) => {
                          const f = geo.catchments.features.find(
                            (f: any) => featureName(f) === e.target.value,
                          );
                          chooseArea(
                            f
                              ? {
                                  name: featureName(f),
                                  type: "catchment",
                                  feature: f,
                                }
                              : null,
                          );
                        }}
                      >
                        <option value="">Choose a catchment</option>
                        {geo.catchments.features
                          .filter(
                            (f: any) =>
                              !regionFilter ||
                              geo.regions.features.some(
                                (r: any) =>
                                  featureName(r) === regionFilter &&
                                  geoContains(r, geoCentroid(f)),
                              ),
                          )
                          .map((f: any) => (
                            <option key={featureName(f)}>
                              {featureName(f)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      LGA boundary
                      <select
                        aria-label="LGA boundary"
                        value={
                          area?.type === "LGA" ? area.name : site?.lgaName || ""
                        }
                        onChange={(e) => {
                          const f = geo.lgas.features.find(
                            (f: any) => featureName(f) === e.target.value,
                          );
                          if (f)
                            chooseArea({
                              name: featureName(f),
                              type: "LGA",
                              feature: f,
                            });
                        }}
                      >
                        <option value="">Choose an in-scope LGA</option>
                        {[...new Set(available.map((s) => s.lgaName))].map(
                          (n) => (
                            <option key={n}>{n}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </details>
                  <div className="location-status">
                    <Compass size={19} />
                    <div>
                      <strong>
                        {!area
                          ? "Begin at full basin extent"
                          : site?.powerFile || (mode === "example" && site)
                            ? "Sample available"
                            : "Area selected · no measured aggregate"}
                      </strong>
                      <p>
                        {site
                          ? `${site.lgaName} LGA shown. ${site.lat}, ${site.lon} is a separate representative sample. ${site.coverage}`
                          : area
                            ? "No bundled weather point matches this selection. Satellite imagery is available as map context."
                            : "No town is selected. Outlines show geographic context, not data coverage."}
                      </p>
                    </div>
                  </div>
                  {(!site || !site.powerFile) && (
                    <div className="supported-routes">
                      <small>LOAD A SUPPORTED SAMPLE</small>
                      <button onClick={() => chooseSite("dalby")}>
                        North · Dalby <ArrowRight size={14} />
                      </button>
                      <button onClick={() => chooseSite("griffith")}>
                        South · Griffith <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  <details className="coordinate-input">
                    <summary>Pin or draw with keyboard</summary>
                    <label>
                      Latitude
                      <input
                        type="number"
                        step="0.001"
                        value={pin.lat}
                        onChange={(e) =>
                          setPin({ ...pin, lat: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Longitude
                      <input
                        type="number"
                        step="0.001"
                        value={pin.lon}
                        onChange={(e) =>
                          setPin({ ...pin, lon: e.target.value })
                        }
                      />
                    </label>
                    <button className="outline-button" onClick={keyboardPin}>
                      Drop coordinate pin
                    </button>
                    <label>
                      Polygon [lon, lat] pairs
                      <textarea
                        value={polygon}
                        onChange={(e) => setPolygon(e.target.value)}
                        placeholder="[[146,-34],[146.1,-34],[146.1,-34.1]]"
                      />
                    </label>
                    <button
                      className="outline-button"
                      onClick={keyboardPolygon}
                    >
                      Use drawn area
                    </button>
                    {inputError && <p role="alert">{inputError}</p>}
                  </details>
                </details>
                <div className="map-column">
                  <BasinMap
                    geo={geo}
                    sites={manifest.sites}
                    site={site}
                    area={area}
                    onArea={chooseArea}
                    onSite={chooseSite}
                    grid={
                      floodSide === "reference"
                        ? {
                            ...supplement,
                            meta: supplement.meta?.flood
                              ? {
                                  ...supplement.meta,
                                  flood: {
                                    ...supplement.meta.flood,
                                    end: supplement.meta.flood.start,
                                  },
                                }
                              : supplement.meta,
                            flood: supplement.flood.map((p) => ({
                              ...p,
                              event: p.ref,
                            })),
                          }
                        : supplement
                    }
                    mode={mode}
                    layer={
                      panel === "moisture"
                        ? "moisture"
                        : panel === "flood"
                          ? "flood"
                          : "weather"
                    }
                    depth={depth}
                    threeD={threeD}
                    setThreeD={setThreeD}
                  />
                  <a
                    href="#growing-conditions"
                    className="map-evidence-link primary-button"
                  >
                    Growing conditions ↓
                  </a>
                </div>
              </div>
              {loading ? (
                <div className="loading" role="status">
                  Loading {mode} evidence for {site?.name}…
                </div>
              ) : error ? (
                <div className="notice" role="alert">
                  <Info />
                  <p>{error}</p>
                  <button onClick={() => location.reload()}>
                    Reload data pack
                  </button>
                </div>
              ) : null}
              <div className="evidence-heading" id="growing-conditions">
                <h2>Check your growing conditions</h2>
                <p>
                  Choose rainfall, heat, soil moisture, flooding or vegetation
                  to see the available evidence.
                </p>
              </div>
              <RiskPanels
                eventSide={floodSide}
                setEventSide={setFloodSide}
                panel={panel}
                setPanel={setPanel}
                rows={filteredRows}
                allRows={filteredRows}
                supplement={supplement}
                mode={mode}
                site={site}
                start={start}
                end={end}
                analysisEnd={analysisEnd}
                setAnalysisEnd={setAnalysisEnd}
                depth={depth}
                setDepth={setDepth}
                notes={profile.notesBySite?.[siteId] || ""}
                setNotes={(notes) =>
                  setProfile({
                    ...profile,
                    notesBySite: { ...profile.notesBySite, [siteId]: notes },
                  })
                }
              />
              {site && (
                <section className="card source-summary">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">SOURCE & COVERAGE</span>
                      <h2>Weather sources and coverage</h2>
                    </div>
                    <button
                      className="outline-button"
                      onClick={() => setScience(true)}
                    >
                      Inspect data register <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <p>
                    {site.lgaName} LGA is selection context. POWER is a
                    representative point at {site.lat}, {site.lon}, not a
                    measured area-wide average.
                  </p>
                  {sources.map((s) => (
                    <SourceMeta key={s.id} source={s} />
                  ))}
                  {!site.powerFile && mode === "real" && (
                    <p>
                      No bundled real series here.{" "}
                      <button
                        className="text-button"
                        onClick={() =>
                          chooseSite(
                            site.region === "Northern Basin"
                              ? "dalby"
                              : "griffith",
                          )
                        }
                      >
                        Load supported sample
                      </button>
                    </p>
                  )}
                  {mode === "real" &&
                    site.powerFile &&
                    (import.meta as any).env?.VITE_ENABLE_POWER_REFRESH !==
                      "false" && (
                      <>
                        <button
                          className="outline-button"
                          disabled={refreshState.startsWith("Fetching")}
                          onClick={doRefresh}
                        >
                          <RefreshCw size={15} />
                          Optional keyless recent POWER refresh
                        </button>
                        <p role="status">{refreshState}</p>
                        {recent && (
                          <details open>
                            <summary>
                              Recent cache {recent.start}–{recent.end}, separate
                              from historical analysis
                            </summary>
                            <p>
                              Retrieved {recent.retrievedAt}; LST point{" "}
                              {site.lat}, {site.lon}. Latest valid
                              precipitation:{" "}
                              {recent.days
                                .filter((d: Day) => d.rain !== null)
                                .at(-1)?.date || "none"}
                              .
                            </p>
                            <div className="table-scroll">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Rain mm/day</th>
                                    <th>Tmax °C</th>
                                    <th>Tmin °C</th>
                                    <th>QA</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recent.days.map((d: Day) => (
                                    <tr key={d.date}>
                                      <th>{d.date}</th>
                                      <td>{fmt(d.rain)}</td>
                                      <td>{fmt(d.max)}</td>
                                      <td>{fmt(d.min)}</td>
                                      <td>{d.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        )}
                      </>
                    )}
                </section>
              )}
              <div className="next-step">
                <div>
                  <span className="eyebrow">FROM EVIDENCE TO A PLAN</span>
                  <h2>Compare planting options</h2>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setTab("compare")}
                >
                  Compare rotations <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {tab === "compare" && (
            <>
              <section className="card rotation-steps">
                <p>Step {rotationStep + 1} of 3</p>
                {rotationStep > 0 && (
                  <button
                    className="text-button"
                    onClick={() => setRotationStep(rotationStep - 1)}
                  >
                    Back
                  </button>
                )}
                {rotationStep === 0 && (
                  <>
                    <h2>What matters most on your farm?</h2>
                    <div className="button-row">
                      {[
                        ["Climate safety", [3, 3, 3, 10]],
                        ["Soil support", [3, 10, 7, 3]],
                        ["Reduced water demand", [10, 3, 3, 3]],
                        ["Balanced priorities", [5, 5, 5, 5]],
                      ].map(([label, weights]) => (
                        <button
                          key={String(label)}
                          className="outline-button"
                          onClick={() => {
                            setProfile({
                              ...profile,
                              weights: weights as number[],
                            });
                            setRotationStep(1);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {rotationStep === 1 && (
                  <>
                    <h2>Set your current rotation</h2>
                    <button
                      className="outline-button"
                      onClick={() => {
                        setProfile({
                          ...profile,
                          baseline: [...DEFAULT_PROFILE.baseline],
                        });
                        setRotationStep(2);
                      }}
                    >
                      Use example cereal baseline
                    </button>
                    <details>
                      <summary>Edit farm inputs or enter your own plan</summary>
                      <FarmProfile
                        profile={profile}
                        setProfile={setProfile}
                        mode={mode}
                      />
                    </details>
                    <button
                      className="primary-button"
                      onClick={() => setRotationStep(2)}
                    >
                      Compare plans
                    </button>
                  </>
                )}
              </section>
              {rotationStep === 2 && (
                <>
                  <details className="farm-inputs">
                    <summary>Edit farm inputs</summary>
                    <FarmProfile
                      profile={profile}
                      setProfile={setProfile}
                      mode={mode}
                    />
                  </details>
                  <details className="farm-inputs">
                    <summary>Fine-tune priorities</summary>
                    <Priorities profile={profile} setProfile={setProfile} />
                  </details>
                  {!site && (
                    <div className="notice">
                      <Info />
                      <p>
                        Choose a supported sample for weather-based dimensions.
                      </p>
                      <button onClick={() => setTab("explore")}>
                        Choose location
                      </button>
                    </div>
                  )}
                  {profile.weights.every((w) => w === 0) && (
                    <div className="notice">
                      All priorities are zero. Set a weight above zero to
                      calculate overall fit.
                    </div>
                  )}
                  {missingScoreInputs.length > 0 && (
                    <div className="notice">
                      <Info size={18} />
                      <p>
                        {useSharedEvidence
                          ? "Partial comparison uses the same available inputs for each rotation."
                          : "Ranking unavailable for this evidence set."}{" "}
                        Needs evidence: {missingScoreInputs.join(", ")}.
                        {missingScoreInputs.includes("Soil suitability") &&
                          " Add a CaCl₂ soil pH result under Farm inputs if you have one. Some crop profiles also need local soil limits."}
                      </p>
                      <button
                        onClick={() => setUseSharedEvidence(!useSharedEvidence)}
                      >
                        {useSharedEvidence
                          ? "Require all priorities"
                          : "Compare with available evidence"}
                      </button>
                    </div>
                  )}
                  <RotationComparison
                    scores={pair}
                    selected={selected}
                    setSelected={setSelected}
                    slots={slots}
                    setSlots={(s) => {
                      setSlots(s);
                      if (selected !== "baseline" && !s.includes(selected))
                        setSelected("baseline");
                    }}
                    baseline={baseline}
                    mode={mode}
                    partial={useSharedEvidence && missingScoreInputs.length > 0}
                  />
                  <details className="card">
                    <summary>Crop profiles</summary>
                    <CropCatalog />
                  </details>
                  <div className="next-step">
                    <h2>Review your schedule and next steps</h2>
                    <div className="button-row">
                      <button
                        className="outline-button"
                        onClick={() => setTab("future")}
                      >
                        Future estimates
                      </button>
                      <button
                        className="primary-button"
                        onClick={() => setTab("brief")}
                      >
                        Open farm brief <ArrowRight size={17} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {tab === "calendar" && (
            <CalendarPage score={picked} place={site?.name} mode={mode} />
          )}
          {tab === "future" && (
            <>
              <FuturePanel
                scenario={scenario}
                setScenario={setScenario}
                historical={filteredRows}
                transformed={scenarioRows}
                scores={scores}
                originalScores={historicalScores}
              />
              <Priorities profile={profile} setProfile={setProfile} />
              <RotationComparison
                scores={pair}
                selected={selected}
                setSelected={setSelected}
                slots={slots}
                setSlots={(s) => {
                  setSlots(s);
                  if (selected !== "baseline" && !s.includes(selected))
                    setSelected("baseline");
                }}
                baseline={baseline}
                mode={mode}
                partial={useSharedEvidence && missingScoreInputs.length > 0}
              />
            </>
          )}
          {tab === "brief" &&
            (site ? (
              <FarmBrief
                score={picked}
                site={site}
                mode={mode}
                start={start}
                end={end}
                scenario={scenario}
                profile={{
                  ...profile,
                  notes: profile.notesBySite?.[siteId] || "",
                }}
                sources={sources}
                ph={ph}
                moisture={moisture}
              />
            ) : (
              <section className="card empty-brief">
                <MapPin size={36} />
                <h2>Select a place for your farm brief</h2>
                <button
                  className="primary-button"
                  onClick={() => setTab("explore")}
                >
                  Choose an area
                </button>
              </section>
            ))}
        </main>
        <footer className="footer">
          <a className="brand" href="#main">
            <Sprout size={20} />
            field shift
          </a>
          <p>Evidence from space. Decisions grounded locally.</p>
          <span>NASA SPACE APPS / v0.1</span>
          <button
            className="text-button"
            onClick={() => setProfile(structuredClone(DEFAULT_PROFILE))}
          >
            <RotateCcw size={14} />
            Reset grower settings
          </button>
        </footer>
      </div>
      <div className="print-only">
        {site && (
          <FarmBrief
            score={picked}
            site={site}
            mode={mode}
            start={start}
            end={end}
            scenario={scenario}
            profile={{ ...profile, notes: profile.notesBySite?.[siteId] || "" }}
            sources={sources}
            ph={ph}
            moisture={moisture}
          />
        )}
      </div>
      {science && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setScience(false);
          }}
        >
          <div
            className="science-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="science-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setScience(false);
              if (e.key === "Tab") {
                const f = e.currentTarget.querySelectorAll<HTMLElement>(
                    'button,a,input,select,textarea,[tabindex="0"]',
                  ),
                  first = f[0],
                  last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              ref={closeScience}
              className="modal-close"
              aria-label="Close science details"
              onClick={() => setScience(false)}
            >
              <X size={22} />
            </button>
            <span className="eyebrow">METHODS / VERSIONED & EDITABLE</span>
            <h1 id="science-title">About the science</h1>
            <p>
              Rules {RULE_CONFIG.version}. Contract {manifest.contractVersion};
              pack {manifest.packVersion}. No station, satellite event or
              crop-model calibration is claimed.
            </p>
            <h2>How dimensions are calculated</h2>
            <p>
              <strong>Water:</strong> median complete-season rainfall / draft
              crop demand, capped 0–100 per crop and averaged. Following crops
              add 10% of prior demand to their denominator as a draft
              demand-equivalent carryover penalty. An optional grower cap limits
              rainfall supply. This is a fit index, not a stored-water balance.
            </p>
            <p>
              <strong>Soil:</strong> pH within screening bounds scores 85;
              outside scores 25. Average per year, subtract 15 for each repeated
              cereal and add 8 for a cereal following a pulse. An illustrative
              50 kg/ha pulse contribution is separately disclosed, never as
              measured nitrogen or fertilizer saving. Unknown bounds or pH
              withhold this dimension.
            </p>
            <p>
              <strong>Erosion:</strong> historical ≥20 mm/day POWER proxy days
              overlapping scheduled crop/cover months, averaged across three
              plan years. Fallow has unconfirmed cover. This is a cover-overlap
              index, not erosion rate or measured residue.
            </p>
            <p>
              <strong>Crop / market:</strong> thermal index = 100 ×
              min(GDD/target,target/GDD) −2 per mean seasonal stage hot/frost
              day, clamped 0–100. GDD = Σmax(0,(Tmax+Tmin)/2−base). A
              grower-entered 0–10 fit rating supplies half the crop score when
              provided. With no market evidence this dimension is thermal-only.
            </p>
            <p>
              <strong>Completeness:</strong> rainfall windows require 100% valid
              days and scoring needs ≥5 complete seasons. Thermal seasons need
              ≥95% paired temperature observations and ≥5 seasons. Midrank
              percentile needs ≥5 other years. Daily windows compare the same
              calendar endpoint and equal length; Feb 29 endpoints compare leap
              years only. Gaps break heat streaks. Monthly charts require
              complete months. Summer crop seasons cross calendar years.
            </p>
            <p>
              <strong>Ranking:</strong> every compared rotation must support the
              same weighted dimensions. Otherwise totals are withheld for all
              rows. Zero weights yield no total; stable ID ties preserve
              selection. Moisture m³/m³, actual ET and reference ET are not
              added to rainfall mm. Scenario transforms a copy and does not
              mutate observations.
            </p>
            <h2>Source register</h2>
            {allSources.map((s) => (
              <SourceMeta key={s.id} source={s} />
            ))}
            <h2>Geometry and real-data gaps</h2>
            <p>
              The requested input path <code>basin_boundaries/</code> was absent
              from the ZIP. Official MDBA geometry was retrieved in EPSG:4326
              with display simplification 0.005°; exact queries are in
              data/acquisition-log.json. ABS LGA 2025 boundaries select areas.
              Natural Earth provides offline Australia context. Detailed real
              satellite layers remain unacquired in both regions.
            </p>
            <p>
              <a
                href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/"
                target="_blank"
                rel="noreferrer"
              >
                NASA POWER Daily documentation
              </a>{" "}
              ·{" "}
              <a
                href="https://library.mdba.gov.au/data_product/basin-plan-schedule-6-regions-northern-and-southern-basin"
                target="_blank"
                rel="noreferrer"
              >
                MDBA region definition
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
function SourceMeta({ source: s }: { source: Source }) {
  const age = s.end
    ? Math.max(0, Math.floor((Date.now() - Date.parse(s.end)) / 86400000))
    : null;
  return (
    <div className="source-meta">
      <div>
        <strong>{s.name}</strong>
        <span className={"badge " + (s.mode === "example" ? "amber" : "")}>
          {s.mode.toUpperCase()} · {s.status}
        </span>
      </div>
      <p>
        {s.product} · {s.version}
        <br />
        {s.units} · {s.resolution}
        <br />
        {s.support}
      </p>
      <p>
        Observation window: {s.start || "not acquired"}
        {s.end ? " – " + s.end : ""} · {s.timeStandard}.{" "}
        {age !== null ? `${age} days since window end.` : ""}
        <br />
        Retrieved: {s.retrievedAt || "not acquired"} · processed:{" "}
        {s.processedAt || "not acquired"}
        <br />
        QA: {s.qa}
        <br />
        Licence / credit: {s.license}
      </p>
      <details>
        <summary>Query / granule / asset</summary>
        <p className="break-word">{s.query}</p>
        {s.asset && <p>Relative asset: data/{s.asset}</p>}
      </details>
    </div>
  );
}
