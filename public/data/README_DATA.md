# Field Shift runtime pack MDB-2026-11-15-v01

Active path: Field_Shift_Prototype/public/data/manifest.json.

The source ZIP already contains this pack. To update, extract the data ZIP inside the project root and merge public/data. Run python3 scripts/checksums.py public/data only after intentional edits, then npm run validate:data and npm run build. Source metadata and exact query pointers are in manifest.json, acquisition-log.json and source-manifests/original_northern_trial.json. SHA-256 asset checksums are in checksums.json.

Real: five raw NASA POWER point responses (2016-2025); official MDBA basin/region/catchment display boundaries, ABS eight LGA boundaries, Natural Earth Australia context.
Example: labeled synthetic fixtures for eight towns, separate weather/rainfall/moisture/NDVI/ET context, grid, water masks and schematic imagery. Never register example assets as real. Missing real satellite products remain missing in real mode.

See docs/DATA_CONTRACT.md, docs/INGEST.md and docs/SOURCE_REGISTER.md in the project. Authenticated downloads and raster QA occur outside the browser. No credentials are needed for bundled mode.
