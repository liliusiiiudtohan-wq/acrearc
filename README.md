# Field Shift

A crop-rotation planning prototype for growers in Australia's Northern and Southern Murray–Darling Basin. It responds to [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/), the 2026 NASA Space Apps Challenge.

**[Open the live AcreArc demo](https://fieldshifts.study/)**

## Try the prototype

Use Node.js 24 and npm. Python 3.10 or newer is needed for the optional stand-alone data checks.

    npm ci
    npm test
    npm run build
    npm run preview

Open the local URL Vite prints. Choose Griffith under **Find a town or area**, then **Growing conditions → Rainfall & drought**. Open **Compare rotations**, pick priorities, and compare two of eight templates. The **Calendar** tab and flyout show the selected plan. **Future estimates** applies hypothetical changes to historical values.

## From NASA data to a visible result

The active manifest points Griffith to an original NASA POWER Daily AG response and records its source URL. The app parses and validates precipitation units, LST dates, coordinates and missing-value metadata in src/lib/data.ts. src/lib/math.ts computes complete-window sums used in src/components/RiskPanels.tsx. Griffith's seven-day rainfall ending December 31, 2025 is 0.0 mm across seven valid days. The input is a representative gridded-model point estimate. It does not provide paddock measurements.

Observed NASA POWER temperature and rainfall are available for six town samples. Example mode uses labeled synthetic data and schematics for pending analytical satellite and soil workflows. Online Esri tiles provide optional visual map context. No farm-specific outcome is guaranteed. See [data sources](docs/SOURCE_REGISTER.md), [data ingestion](docs/INGEST.md) and [remaining gaps](docs/KNOWN_GAPS.md).

## AI / SI Usage Disclosure

ChatGPT assisted with planning, handoff documentation and initial prototype work. OpenAI Codex assisted with implementation, documentation, automated checks and local browser verification. Generated example data are marked by mode and provenance, and example schematic images display an AI-generated label. NASA POWER observations are retrieved directly from NASA and loaded independently. See [artifact and software credits](docs/CREDITS.md).

## GitHub Pages

The workflow in .github/workflows/pages.yml builds and tests the static site, validates the bundled data and deploys dist. After creating the GitHub repository, select **GitHub Actions** in **Settings → Pages**. Verify the deployed URL and asset loading while signed out. In the Space Apps portal, provide separate working public links for the final project and short demo.