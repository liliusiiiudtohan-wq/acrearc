# Runtime contract: field-shift-data/1.0.0

Active pack: `public/data/manifest.json`. Relative asset paths are resolved under `public/data/`; no secrets, absolute file paths or remote raster processing in the browser. The source ZIP includes the complete starter pack. The independent data ZIP overlays the same path.

## Manifest

- `contractVersion`, `packVersion`, `scope`.
- `sites[]`: stable `id`, town `name`, `state`, official `region`, `catchment`, decimal `lat`/`lon` representative coordinate, `lgaCode`/`lgaName`, `boundaryId`, optional raw `powerFile`, explicit `coverage`. An absent powerFile is an unsupported real weather point, not zero rainfall.
- `boundaries`: `basin`, `regions`, `catchments`, `lgas`, `context` GeoJSON FeatureCollections in EPSG:4326. MDBA properties are retained. The map handles polygon winding. Context has no environmental measurement support.
- `sources[]`: `id`, `name`, exact `product`/`version`, `mode` (`real` or `example`), `units`, `resolution`, `support`, observation `start`/`end`, `retrievedAt`/`processedAt`, `query` (full URL or granule/task ID), `license`, `qa` (masks, completeness and scaling), `timeStandard`, optional `asset`, `status` (`ready` or `missing`). Do not mark ready without all provenance; use separate source IDs for Final/Late, actual ET/ET0, depth and algorithm variants where needed.
- `layers[]`: `id`, `mode`, `sourceId`, `siteId`, `kind` (`series`, `grid`, `flood`, `imagery`), relative `asset`, geographic `[west,south,east,north]` `bounds`, original `crs`, native `resolution`, observation `start`/`end`, `units`, `qa`, `status`. Source and layer modes must agree. A layer is not a claim that its whole selection boundary was observed.

## Raw POWER adapter

Keep the provider Feature JSON unmodified, including header, provider fill value, exact source list, parameter units, time standard, coordinate and requested range. The adapter validates coordinate match (0.025° tolerance), required variables and C/mm/day units, LST, provider fill and physical ranges; Tmin>Tmax is unavailable. It inserts null for missing calendar dates, preserves zero, and never substitutes fixtures. Five bundled series span 2016-01-01 through 2025-12-31, 3,653 dates.

Normalized day record:

```json
{"date":"2025-10-01","rain":0,"max":27,"min":9,"mean":18,"skin":21,"status":"valid"}
```

Use ISO calendar dates. Values are finite numbers or `null`, never sentinels or strings. Status distinguishes `valid`, `missing`, `masked`, `out-of-coverage`, `failed`. Missing inputs stay null. Rain is mm/day; air and skin are C. Original observation windows, time basis and source/native support remain in metadata.

## Processed supplemental asset

Register a `mode: "real"`, `status: "ready"` layer with an acquired sourceId and a JSON asset like:

```json
{
  "mode":"real", "version":"1.0.0", "locationId":"griffith",
  "meta":{"moisture":{"source":"SPL4SMGP.008 / exact granules in source register","resolution":"9 km native EASE-Grid","start":"2025-10-01","end":"2025-10-31","timeStandard":"UTC daily","qa":"6 of 8 valid 3-hour records required; modeled root zone"}},
  "moisture":[{"date":"2025-10-01","surface":0.18,"root":0.25,"status":"valid"}],
  "octoberMoisture":0.25
}
```

The numerical values above illustrate the contract, not supplied observations. Real mode rejects an example-tagged asset, a wrong site, missing metadata, duplicate dates, bad QA statuses and out-of-range moisture/NDVI/rain. Assets can contain one or more keys. Multiple source assets merge by key, and `meta` is deep-merged. Register independent product files to avoid overwriting a series with a different provider.

Supported keys:

| Key | Record fields / use |
| --- | --- |
| `imerg`, `late` | Normalized day rows with `rain`; temperature/skin fields null. Final and provisional Late remain separate. `meta.imerg`/`meta.late` identify coverage, time and support. IMERG Final becomes the heavy-rain cover context when present. |
| `moisture` | `date`, `surface`, `root`, `status`; m3/m3 at 0–5 cm and 0–100 cm. Daily after explicit aggregation. `meta.moisture`. |
| `grid` | `lon`, `lat`, `surface`, `root`, `status`, `bounds` per native cell. Real cells require geographic bounds; native CRS/9 km support stays in metadata. `meta.grid.end` is map snapshot date. Do not upsample. |
| `ndvi` | `date`, `value`, `status`; unitless after valid-raw ×0.0001 scaling and QA. `meta.ndvi`. |
| `et` | `date`, `actualET`, `referenceET`, `esi`, `status`. Daily mm/day actual ET and reference ET0 are different columns, never aliases. `meta.et`; leave a column null unless its method is documented. |
| `soilPH`, `clayPercent` | Site-sampled pH(CaCl2) and % clay, with statistic/depth/SLGA version and uncertainty in source metadata. Never infer unknown values from latitude. |
| `octoberMoisture` | Preprocessed complete-enough October root-zone aggregate for the documented gate; m3/m3. Omit/null if unknown. Explain year, QA, support and aggregation. It is not forecast moisture for the future calendar. |
| `flood` | `id`, `ref`/`event` in `land`,`water`,`masked`, `permanent`, `areaKm2`, geographic `bounds` per cell. Real areas must be calculated upstream in an appropriate equal-area CRS. `meta.flood.start` reference date, `.end` event date, source and resolution. Only shared valid cells enter comparison. |
| `imagery` | `date`, relative `asset` or null, `status`, `validPercent`. RGB assets must share bounds, CRS, pixel alignment and crop dimensions; apply QA upstream. Retain cloud/missing dates. `meta.imagery`. |

Example fixtures have identical normalized fields, plus `days`, and always `mode: "example"`. The app loads them only after the explicit mode switch. Example imagery is schematic SVG and is labeled as such. Every resulting brief retains its mode.

`python3 scripts/validate_data.py public/data` checks the supplied pack and checksums. `python3 scripts/checksums.py public/data` refreshes hashes only after an intentional data change. Raster ingestion instructions are in INGEST.md. Test a pack replacement before publishing.
