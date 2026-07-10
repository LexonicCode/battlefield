# battlefield

Fresh JavaScript (Vite + Three.js) 3D battlefield app that renders utility accounts as a square grid of vertical columns.

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

## Data source

- Primary CSV: `public/data/UtilityTop100.csv`
- Runtime fallback CSV: `public/data/UtilitySectorData.csv`
- Repository raw copies: `data/raw/UtilityTop100.csv`, `data/raw/UtilitySectorData.csv`

## Runtime data model

Rows are normalized at runtime into records with fields:

- `owner`
- `accountName`
- `companyActivity`
- `classification`
- `supplierRaw`
- `competitorValue`
- `upsellValue`
- `totalSpend`
- `computedTotalValue`
- `zoneKey`
- `colorKey`
- `scaledHeight`

## Parsing and assumptions

- Currency parser strips `£`, commas, spaces, and handles values like `£-` as `0`.
- Empty/invalid numeric values are treated as `0`.
- Header aliases are supported so either the latest UtilityTop100 headers or older utility headers can be ingested.
- Deterministic ordering:
  1. Group by `Company Activity`
  2. Sort zones alphabetically
  3. Sort accounts by `Account Name` within each zone

## Height logic

Each column’s base value is:

`computedTotalValue = competitorValue + upsellValue + totalSpend`

Displayed height uses a monotonic square-root scale to preserve rank order while keeping tall values viewable:

- `scaledHeight = minHeight + sqrt(total/maxTotal) * (maxHeight - minHeight)`
- Default range: `0.75` to `22`

## Color logic

By `Current Main Supplier (Idox or Competitor Name)`:

- ESRI → green
- Landmark → orange
- Ordnance Survey / OS → purple
- all other values (including Idox, Unknown, blanks, etc.) → gray

## Layout rules

- Standard square grid (no hexes)
- Configurable `cellSize`, `cellGap`, and `columnWidth`
- Small visible gap between adjacent columns via `cellGap`
- Contiguous zones per `Company Activity`
- Zone blocks are separated by configurable grid-cell spacing and packed for scale toward ~110×110 capacity

## UI behavior

- Orbit/pan/zoom camera controls
- Legend for supplier colors
- Hover tooltip with account details and computed total
- Click to pin tooltip, `Esc` to clear
