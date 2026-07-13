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

## Password protection (Vercel)

This site is password-gated via:

- Middleware (`/middleware.js`) that redirects unauthenticated users to `/login`
- `POST /api/auth` that validates against `process.env.SITE_PASSWORD`
- An HttpOnly auth cookie (`bf_auth`) with a 7-day lifetime
- `GET /api/logout` to clear the cookie

### Required environment variable

- `SITE_PASSWORD` (required)

### Configure in Vercel

1. Open **Project → Settings → Environment Variables**
2. Add `SITE_PASSWORD` with your desired password
3. Redeploy so middleware/functions pick up the value

### Configure for local development

Create `.env.local` in the repository root:

```bash
SITE_PASSWORD=your-password-here
```

For local testing of middleware + serverless auth routes, use:

```bash
npx vercel dev
```

`npm run dev` still runs the plain Vite dev server and does not execute Vercel middleware/functions.

### Behavior notes

- Unauthenticated requests to app routes are redirected to `/login?next=...`
- Successful login returns users to the originally requested path
- Failed login redirects back to `/login` with an error message
- Static/framework asset paths are excluded so required resources can load
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

## Data source

- Required CSV (only source used at runtime): `public/data/UtilityTop100.csv`
- Repository raw copy: `data/raw/UtilityTop100.csv`

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
- Idox → blue
- all other values (including Unknown/blanks/etc.) → gray

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
- Light UI/theme (white/pale-grey background with white surface/panels)
- Flat base-plate labels for each active cluster zone (updates with filters)
