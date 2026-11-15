# Remaining evidence and release checks

## Real data

- `Field_Shift_Handoff/basin_boundaries/` did not exist in the provided archive. Official MDBA FeatureServer exports replace it; raw query URLs and retrieval times are in `public/data/acquisition-log.json`. These are simplified display geometries, not survey or area-measurement boundaries.
- Real IMERG Final/Late, SMAP L4 v8, OPERA, HLS RGB+QA, MOD13Q1, SLGA and observed ET/ESI files were absent and remain unacquired in the north and south. The source register marks them missing. Earthdata Login and product-specific processing are needed; see DATA_ACQUISITION.md and INGEST.md. No supplied NASA developer key is needed.
- Griffith and Mildura real POWER are available. Leeton and Renmark have selection geometry but no real weather cache. Pins, catchments, regions and polygons have no automatic point acquisition or area aggregates. The grower must explicitly select a supported point; the original requested area is never relabeled as measured coverage.
- Six weather caches were structurally verified, including exact coordinate, dates, units and provider fill. These have not been compared against BOM/SILO stations. They are regional gridded products, not paddock stations.
- OPERA fixture areas use known synthetic 30 m squares. Real inundation areas require shared-valid source QA, a permanent-water layer and equal-area/projected processing upstream.

## Agronomy and modeling

- Source tables are team research drafts. No calibration or local variety validation. No yields, crop-loss probabilities, financial savings or fertilizer prescription.
- Forage sorghum numerical pH bounds, grain sorghum crop demand/GDD target and vetch/cover mix crop-specific thermal/water bounds remain unknown. Totals are withheld if weighted evidence is missing. UI paths for a valid partial-evidence rank are in README.
- The pH ≥6.0 chickpea rule is a configurable draft using CaCl2; do not mix test methods. Unknown pH retains Field Pea as a review alternative, not a compatibility claim.
- The October >0.22 m3/m3 rule is a configurable example. Current example moisture is an explicit input; real October aggregate is missing until supplied. No seasonal moisture forecast or stored-water conversion is inferred.
- Sequence penalties, pulse N credit and demand carryover are illustrative. Fallow has unconfirmed cover; planned living cover is not measured residue or erosion rate. Market evidence is only grower-entered; otherwise the fourth index is thermal-only.
- The scenario is a weather sensitivity calculation, not a forecast. No runoff model. Actual ET, ET0 and volumetric moisture are kept distinct.

## Product verification

- Managed preview start/status returned `preview relay unavailable: No such file or directory`. No substitute browser infrastructure was installed. Browser paint/WebGL is not required by the SVG renderer, but layout, pointer drawing, native date inputs and the print dialog still need human browser review.
- DOM verification exercised accessibility names, keyboard focus/Escape, local controls and complete navigation. It is not a visual narrow-screen or screen-reader audit. Responsive and print CSS are provided.
- Pitched 3D is a local SVG value-height rendering, not terrain/WebGL. The coarse native-support grid can be inspected in a table. Map zoom/fitting is supported; free dragging/terrain navigation is not implemented.
- LocalStorage settings do not synchronize between devices. Source and data ZIPs are portable; browser preferences are not included.
