import type { Activity, Day, Profile, Rotation, Score } from "./types";
import { crop, RULE_CONFIG as R } from "./catalog";
import { clamp, date, dates, gdd, mean, median, valid, weighted } from "./math";
export function moistureGate(value: number | null, threshold = 0.22) {
  return value === null || !Number.isFinite(value)
    ? "unknown"
    : value > threshold
      ? "eligible"
      : "ineligible";
}
export function pulseChoice(ph: number | null) {
  return ph === null ? "pea" : ph >= R.chickpeaMinPH ? "chickpea" : "lupin";
}
export function resolveRotation(
  rotation: Rotation,
  profile: Profile,
  moisture: number | null,
  ph: number | null,
) {
  const flags: string[] = [];
  const gate = moistureGate(moisture, profile.gate);
  let ids = rotation.id === "baseline" ? profile.baseline : rotation.crops;
  ids = ids.map((id) => {
    if (id === "pulse") {
      const choice = pulseChoice(ph);
      flags.push(
        ph === null
          ? "pH unknown: Field Pea held as review alternative; confirm pH before planting."
          : `pH(CaCl₂) ${ph.toFixed(1)}: ${crop(choice).name} selected using draft chickpea ≥${R.chickpeaMinPH.toFixed(1)} rule.`,
      );
      return choice;
    }
    if (id === "conditional") {
      flags.push(
        `October root zone: ${gate}. Example gate >${profile.gate.toFixed(2)} m³/m³. ${gate === "eligible" ? "Stored-water and following-crop review required." : gate === "ineligible" ? "Fallow branch applied; conserve stored water." : "Fallow held pending moisture evidence; planting undecided."}`,
      );
      return gate === "eligible" ? "forage" : "fallow";
    }
    return id;
  });
  return { ids, flags };
}
export function buildCalendar(
  ids: string[],
  startYear: number,
  flags: string[] = [],
): Activity[] {
  const calendar: Activity[] = Array.from({ length: 36 }, (_, i) => ({
    year: startYear + Math.floor(i / 12),
    month: (i % 12) + 1,
    crop: "fallow",
    phase: "Fallow",
  }));
  ids.forEach((id, index) => {
    const c = crop(id);
    if (c.group === "fallow") return;
    const year = startYear + index;
    const endYear = c.harvest < c.sow ? year + 1 : year;
    for (let y = year; y <= endYear; y++)
      for (let m = 1; m <= 12; m++) {
        if ((y === year && m < c.sow) || (y === endYear && m > c.harvest))
          continue;
        const pos = (y - startYear) * 12 + m - 1;
        if (pos < 0 || pos >= 36) continue;
        calendar[pos] = {
          year: y,
          month: m,
          crop: id,
          phase:
            y === year && m === c.sow
              ? "Plant"
              : y === endYear && m === c.harvest
                ? "Harvest"
                : c.group === "cover"
                  ? "Cover"
                  : "Grow",
          flag: c.stages.some((s) => s.months.includes(m))
            ? "Temperature-sensitive stage; inspect exposure"
            : undefined,
        };
      }
  });
  if (flags.some((f) => f.startsWith("October root zone"))) {
    const i = 12 + 9;
    calendar[i] = {
      ...calendar[i],
      flag: flags.find((f) => f.startsWith("October root zone")),
      phase: ids[1] === "fallow" ? "Decision" : calendar[i].phase,
    };
  }
  return calendar;
}
function seasons(rows: Day[], id: string) {
  const c = crop(id),
    by = new Map(rows.map((d) => [d.date, d])),
    years = [...new Set(rows.map((d) => +d.date.slice(0, 4)))];
  return years
    .map((y) => {
      const endYear = c.harvest < c.sow ? y + 1 : y;
      const end = new Date(Date.UTC(endYear, c.harvest, 0))
        .toISOString()
        .slice(0, 10);
      const ds = dates(`${y}-${String(c.sow).padStart(2, "0")}-01`, end);
      const selected = ds.map((d) => by.get(d));
      const rain = selected.every(
        (d) => d?.rain !== null && d?.rain !== undefined,
      )
        ? selected.reduce((s, d) => s + d!.rain!, 0)
        : null;
      const known = selected.filter(
        (d): d is Day => !!d && d.min !== null && d.max !== null,
      );
      const thermal =
        known.length / ds.length >= R.thermalCompleteness && c.base !== null
          ? gdd(known, c.base)
          : null;
      let hot = 0,
        frost = 0;
      known.forEach((d) => {
        const stages = c.stages.filter((s) =>
          s.months.includes(+d.date.slice(5, 7)),
        );
        if (stages.some((s) => d.max! >= s.heat)) hot++;
        if (stages.some((s) => d.min! <= s.frost)) frost++;
      });
      return {
        rain,
        gdd: thermal,
        hot,
        frost,
        valid: known.length,
        expected: ds.length,
      };
    })
    .filter((s) => s.valid > 0);
}
export function scoreRotation(
  rotation: Rotation,
  rows: Day[],
  profile: Profile,
  moisture: number | null,
  ph: number | null,
  erosionRows: Day[] = rows,
  heavySource = "POWER proxy",
): Score {
  const { ids, flags } = resolveRotation(rotation, profile, moisture, ph);
  const calendar = buildCalendar(ids, profile.startYear, flags);
  let repeat = 0,
    nitrogen = 0,
    carryover = 0;
  ids.forEach((id, i) => {
    const c = crop(id);
    if (c.group === "pulse") nitrogen += R.pulseContributionKgHa;
    if (i && c.group === "cereal" && crop(ids[i - 1]).group === "cereal")
      repeat++;
    if (i && c.water !== null)
      carryover += (crop(ids[i - 1]).water ?? 0) * R.waterCarryoverFraction;
  });
  const details = ids.map((id) => {
    const c = crop(id);
    const ss = seasons(rows, id);
    const rs = ss.map((x) => x.rain).filter(valid),
      gs = ss.map((x) => x.gdd).filter(valid);
    return {
      crop: id,
      rain:
        c.group === "fallow"
          ? 0
          : rs.length >= R.minCompleteReference
            ? median(rs)
            : null,
      demand: c.water,
      gdd: gs.length >= R.minCompleteReference ? median(gs) : null,
      hot: c.stages.length
        ? mean(ss.filter((s) => s.gdd !== null).map((s) => s.hot))
        : null,
      frost: c.stages.length
        ? mean(ss.filter((s) => s.gdd !== null).map((s) => s.frost))
        : null,
      valid: ss.reduce((s, x) => s + x.valid, 0),
      expected: ss.reduce((s, x) => s + x.expected, 0),
    };
  });
  const waterVals = details.map((d, i) => {
    if (d.demand === 0) return 100;
    if (d.demand === null || d.rain === null) return null;
    const carry = i
      ? (crop(ids[i - 1]).water ?? 0) * R.waterCarryoverFraction
      : 0;
    const limit = profile.waterLimit !== "" ? +profile.waterLimit : null;
    const supply = limit === null ? d.rain : Math.min(d.rain, limit);
    return clamp((100 * supply) / (d.demand + carry));
  });
  const water = waterVals.every(valid) ? mean(waterVals) : null;
  let soil: number | null = null;
  if (ph !== null) {
    const fits = ids.map((id) => {
      const c = crop(id);
      if (c.group === "fallow") return 40;
      if (!c.ph) return null;
      return ph >= c.ph[0] && ph <= c.ph[1] ? 85 : 25;
    });
    if (fits.every(valid))
      soil = clamp(
        mean(fits)! -
          repeat * R.cerealRepeatPenalty +
          ids.reduce(
            (s, id, i) =>
              s +
              (i &&
              crop(id).group === "cereal" &&
              crop(ids[i - 1]).group === "pulse"
                ? R.pulseFollowingCerealBonus
                : 0),
            0,
          ),
      );
  }
  const heavy = erosionRows.filter(
    (d) => d.rain !== null && d.rain >= R.heavyRainMmDay,
  );
  let heavyCovered = 0;
  for (const d of heavy) {
    const m = +d.date.slice(5, 7);
    heavyCovered +=
      calendar.filter((a) => a.month === m && a.crop !== "fallow").length / 3;
  }
  const erosion =
    heavy.length >= 5 ? clamp((100 * heavyCovered) / heavy.length) : null;
  const thermal = details.map((d) => {
    const c = crop(d.crop);
    if (c.group === "fallow") return 50;
    if (c.gdd === null || d.gdd === null) return null;
    const thermalScore = clamp(
      100 * Math.min(d.gdd / c.gdd, c.gdd / Math.max(d.gdd, 1)) -
        (d.hot ?? 0) * 2 -
        (d.frost ?? 0) * 2,
    );
    const entry = profile.market[d.crop];
    return entry !== undefined && entry !== ""
      ? (thermalScore + clamp(+entry, 0, 10) * 10) / 2
      : thermalScore;
  });
  const market = thermal.every(valid) ? mean(thermal) : null;
  const dimensions = [water, soil, erosion, market];
  if (ph === null)
    flags.push(
      "Soil pH unknown: soil dimension and weighted total withheld when soil weight is positive.",
    );
  if (
    ids.some(
      (id) =>
        crop(id).water === null || (crop(id).gdd === null && id !== "fallow"),
    )
  )
    flags.push(
      "Some crop-specific profile inputs are unknown; affected dimensions are unavailable.",
    );
  if (
    ids.some(
      (id) => profile.market[id] === undefined || profile.market[id] === "",
    )
  )
    flags.push(
      "No grower market/forage evidence for some crops; fourth dimension uses thermal fit only where supported.",
    );
  if (ids.some((id) => crop(id).group !== "fallow" && !crop(id).ph))
    flags.push(
      "Numeric soil-pH bounds unknown for one or more crops; soil dimension withheld.",
    );
  const total = weighted(dimensions, profile.weights);
  return {
    id: rotation.id,
    rotation,
    crops: ids,
    dimensions,
    total,
    coverage: dimensions.filter(valid).length / 4,
    calendar,
    details,
    flags,
    heavyCovered,
    heavyTotal: heavy.length,
    heavySource,
    nitrogen,
    repeat,
    carryover,
  };
}
export function stableRank(scores: Score[]) {
  return [...scores].sort(
    (a, b) =>
      (b.total ?? -Infinity) - (a.total ?? -Infinity) ||
      a.id.localeCompare(b.id),
  );
}
