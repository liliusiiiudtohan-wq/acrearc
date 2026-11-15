# Bringing new observations into Field Shift

Run authenticated NASA downloads and raster work on the team's computer, outside the browser. Keep Earthdata/netrc/token files out of this project and both ZIPs. No NASA developer key is used. Acquisition links, collection concept IDs and source versions from the supplied research remain in DATA_ACQUISITION.md; verify current collection/variable documentation before each new batch.

## Repeatable process

1. Choose an actual north or south site/AOI, dates and an event with usable shared coverage. Discover granules through CMR/Earthdata; use the exact collection version and the DAAC's authentication flow. Do not claim that catalog discovery means pixel data were acquired.
2. Retain raw product IDs, granule/task/query URLs, version, footprint/CRS/grid, observation times, units/scales, fill codes, sensor QA flags, retrieval time, license and processing command/version. Never put credentials in the query metadata. Use one provenance source record per product/version/algorithm/window.
3. Decode scale/offset, fill and QA **before** aggregating. Keep invalid observations null, with distinct missing/masked/out-of-coverage/failed statuses. Zero is valid where permitted. No interpolation in the observation cache. Preserve native support; do not resample 9 km SMAP into a paddock-scale measurement.
4. Write a compact CSV/JSON/PNG pack under `public/data/processed/`, add ready real `sources` and `layers` records, and keep example paths unchanged. `DATA_CONTRACT.md` defines exact fields. Real assets require `mode: real` and a matching `locationId`.
5. Run `python3 scripts/checksums.py public/data`, `npm run validate:data`, `npm test`, `npm run build`. Compare map/date/units/QA against the source in both regions. Test a clean overlay of the data ZIP. Record validation in VERIFICATION.md, not only acquisition status.

## Product processing

| Product | Required preparation |
| --- | --- |
| IMERG Final / Late | Process each run separately; respect provider rates vs amounts and integration interval. Export daily rainfall mm/day, coverage and validity. Use Final for matched historic references. Keep Late provisional, with its own availability. Derive a grid only from actual pixel support. The app uses a separate reference per rain source and no cross-provider fill. |
| SMAP SPL4SMGP.008 | Confirm `sm_surface` and `sm_rootzone` names and time definitions. A proposed daily rule is ≥6 of 8 valid 3-hour records; document the choice, UTC boundary, QA and model-only periods. Export surface 0–5 cm and modeled root zone 0–100 cm separately in m3/m3. Preserve native 9 km cell bounds and CRS; register the grid snapshot date. Derive the chosen-year October root-zone gate input with explicit completeness; omit if unknown. |
| OPERA DSWx | Acquire reference + event WTR and sensor-specific QA/masks and a documented permanent-water layer. Align both to shared pixels; cloud/shadow/fill is unknown, never dry land. Decode the exact product's class table rather than guessing optical/radar equivalence. Compute area in an appropriate projected/equal-area CRS, such as Australian Albers, and compare only shared valid coverage. |
| HLSL30 / HLSS30 v2 | Choose 2–4 acquisitions with shared footprint and source QA. Decode source-specific Fmask, cloud/shadow/snow/fill flags. Arrange natural-color red/green/blue bands correctly (L30 B04/B03/B02; check matching S30 metadata). Use one CRS/extent/pixel alignment and fixed RGB stretch for before/after. Preserve cloud and missing dates. Never derive decline causes from appearance alone. |
| MOD13Q1.061 | Decode fill and product QA first. Scale valid NDVI raw values ×0.0001. Preserve 250 m / 16-day support and composite window. Ground-cover context only; green vegetation is not residue cover. |
| SLGA | Pin version, variable, statistic and depth (e.g. 5–15 cm), pH method (CaCl2), clay fraction units and uncertainty. Record point vs AOI reduction. Do not supply assumed regional soil values as measured samples. |
| ET / ESI | Confirm collection version, band names, temporal support and units. Integrate rates only with documented periods; distinguish instantaneous, daily and composite ET. MOD16 may need scale and per-composite-to-daily conversion. Keep actual ET, reference ET0/PET and ESI separate. A POWER-derived ET0 needs its own complete published method and metadata; the prototype does not invent one. |

## Scripts

All ordinary CSV/metadata tools use Python standard library. Optional raster preparation requires:

```sh
python3 -m pip install -r scripts/requirements-ingest.txt
```

**CSV series adapter** (already QA-filtered, daily units, explicit null/blank):

```sh
python3 scripts/ingest_csv.py moisture input/smap_daily.csv public/data/processed/griffith-moisture.json --site griffith --metadata input/smap-metadata.json
```

Kinds: `imerg`, `late`, `moisture`, `ndvi`, `et`. Required common columns: `date,status`; numerical columns are defined in DATA_CONTRACT.md. Metadata JSON contains `source,resolution,start,end,qa,timeStandard`. Its `source` ties to the manifest's full product/version/granule/retrieval/processing record. The script rejects duplicate dates and remaining sentinels. It does not authenticate, decode raw sensor QA or resample a raster.

**Water clips** must already be aligned to EPSG:3577. Supply exact source class mapping JSON such as `{"water":[...],"land":[...]}` filled from the downloaded product guide; all unmapped classes are masked. Supply binary QA rasters derived from each source (1 valid / 0 invalid) and a permanent-water binary raster. Do not use a fabricated class list.

```sh
python3 scripts/prepare_flood.py --reference input/ref.tif --event input/event.tif --reference-qa input/ref_valid.tif --event-qa input/event_valid.tif --permanent input/permanent.tif --classes input/source-classes.json --metadata input/flood-metadata.json --site griffith --output public/data/processed/griffith-flood.json
```

This adapter rejects mismatched grids, non-equal-area inputs or oversized clips; it calculates pixel km2 from the affine transform and preserves geographic pixel bounds for display. Real event validation and the permanent-water definition remain the team's responsibility.

**Aligned HLS RGB stacks and QA**:

```sh
python3 scripts/prepare_hls.py --scene 2025-09-14,input/before_rgb.tif,input/before_valid.tif --scene 2025-11-08,input/after_rgb.tif,input/after_valid.tif --metadata input/hls-metadata.json --site griffith --output-dir public/data/processed_hls
```

The script checks alignment/CRS/dimensions, applies source-specific binary QA, reflectance scale/offset (configurable) and one fixed display stretch; exports RGBA PNGs and a real-tagged imagery JSON. Inspect against source metadata and set layer bounds, source IDs and dates. Default scale 0.0001 is only appropriate when confirmed for the input reflectance stack. No source-specific QA decoder is implied.

**Optional weather acquisition**:

```sh
python3 scripts/fetch_power.py --lat -34.28 --lon 146.04 --start 2016-01-01 --end 2025-12-31 --output staging/griffith.json
```

Maximum request 3,661 days, 30-second timeout; preserves raw response and a sidecar query/retrieval record. Review before replacing a runtime source. Browser recent refresh has a tighter 30-day bound and last-good fallback.

**Official display geometry refresh**:

```sh
python3 scripts/fetch_boundaries.py --output-dir staging/basin_boundaries
```

The received handoff lacked basin_boundaries; the supplied exports were retrieved with this same MDBA service/query pattern. Review changes before copying. Geometry simplification is for display only. ABS LGA refresh uses the exact query in the existing acquisition-log; append correct versions and credits.

Regenerate deterministic examples with `python3 scripts/generate_examples.py`, then update checksums. Every resulting example remains synthetic. Never register those files as real. The eight catalog crops/rotation templates and draft rule settings are independently editable in `src/lib/catalog.ts`; update rule version and verification when changing them.
