export type Mode = "real" | "example";
export type Status =
  "valid" | "missing" | "masked" | "out-of-coverage" | "failed";
export type Day = {
  date: string;
  rain: number | null;
  max: number | null;
  min: number | null;
  mean: number | null;
  skin: number | null;
  status: Status;
};
export type Source = {
  id: string;
  name: string;
  product: string;
  version: string;
  mode: Mode;
  units: string;
  resolution: string;
  support: string;
  start: string;
  end: string;
  observedAt?: string;
  retrievedAt: string;
  processedAt: string;
  query: string;
  license: string;
  qa: string;
  timeStandard: string;
  asset?: string;
  status: string;
};
export type Site = {
  id: string;
  name: string;
  region: string;
  state: string;
  catchment: string;
  lat: number;
  lon: number;
  lgaCode: string;
  lgaName: string;
  powerFile?: string;
  boundaryId: string;
  coverage: string;
};
export type Manifest = {
  contractVersion: string;
  packVersion: string;
  sites: Site[];
  sources: Source[];
  layers: Layer[];
  boundaries: {
    basin: string;
    regions: string;
    catchments: string;
    lgas: string;
    context: string;
  };
};
export type Layer = {
  id: string;
  mode: Mode;
  sourceId: string;
  siteId: string;
  kind: "grid" | "flood" | "imagery" | "series";
  asset: string;
  bounds: number[];
  crs: string;
  resolution: string;
  start: string;
  end: string;
  units: string;
  qa: string;
  status: string;
};
export type Example = {
  meta?: Record<
    string,
    {
      source: string;
      resolution: string;
      start: string;
      end: string;
      qa: string;
      timeStandard?: string;
    }
  >;
  imerg?: Day[];
  late?: Day[];
  et?: {
    date: string;
    actualET: number | null;
    referenceET: number | null;
    esi: number | null;
    status: Status;
  }[];
  clayPercent?: number;
  days: Day[];
  grid: {
    lon: number;
    lat: number;
    surface: number | null;
    root: number | null;
    status: Status;
    bounds?: number[];
  }[];
  moisture: {
    date: string;
    surface: number | null;
    root: number | null;
    status: Status;
  }[];
  ndvi: { date: string; value: number | null; status: Status }[];
  flood: {
    id: number;
    ref: "land" | "water" | "masked";
    event: "land" | "water" | "masked";
    permanent: boolean;
    areaKm2: number;
    bounds?: number[];
  }[];
  imagery: {
    date: string;
    asset: string | null;
    status: string;
    validPercent: number;
  }[];
  octoberMoisture: number;
  soilPH: number;
};
export type Scenario = {
  warming: number;
  rainfall: number;
  heavy: number;
  season: string;
  runoff: number;
};
export type Profile = {
  baseline: string[];
  waterLimit: string;
  ph: string;
  market: Record<string, string>;
  weights: number[];
  moistureCase: "data" | "low" | "high" | "unknown";
  gate: number;
  notes: string;
  notesBySite?: Record<string, string>;
  startYear: number;
};
export type Crop = {
  id: string;
  name: string;
  group: string;
  sow: number;
  harvest: number;
  sowWindow: string;
  harvestWindow: string;
  base: number | null;
  gdd: number | null;
  water: number | null;
  ph: [number, number] | null;
  heat: number | null;
  frost: number | null;
  stages: { name: string; months: number[]; heat: number; frost: number }[];
  origin: string;
  review: string;
};
export type Rotation = {
  id: string;
  name: string;
  tag: string;
  crops: string[];
};
export type Activity = {
  year: number;
  month: number;
  crop: string;
  phase: "Plant" | "Grow" | "Harvest" | "Cover" | "Fallow" | "Decision";
  flag?: string;
};
export type Score = {
  partial?: boolean;
  id: string;
  rotation: Rotation;
  crops: string[];
  dimensions: (number | null)[];
  total: number | null;
  coverage: number;
  calendar: Activity[];
  details: {
    crop: string;
    rain: number | null;
    demand: number | null;
    gdd: number | null;
    hot: number | null;
    frost: number | null;
    valid: number;
    expected: number;
  }[];
  flags: string[];
  heavyCovered: number;
  heavyTotal: number;
  heavySource: string;
  nitrogen: number;
  repeat: number;
  carryover: number;
};
