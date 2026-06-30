# battlefield

Interactive 3D customer battlefield planner with deterministic data normalization pipeline.

## Project structure

- `data/raw/clean_customers.csv` - source input CSV
- `data/mappings/*.json` - supplier and sector taxonomy aliases
- `data/canonical/customers.canonical.json` - normalized canonical records
- `data/canonical/customers.battlefield.json` - render-ready dataset
- `data/reports/data_quality.json` - validation coverage report
- `scripts/*.py` - normalize/validate/build pipeline
- `src/*` - Three.js battlefield MVP

## Setup

```bash
npm install
```

## Regenerate datasets (idempotent)

```bash
python scripts/normalize_customers.py
python scripts/validate_customers.py
python scripts/build_battlefield_dataset.py
```

## Run interactive battlefield locally

```bash
npm run dev
```

## Build frontend

```bash
npm run build
```

## Run focused tests

```bash
python -m unittest discover -s tests -v
```

## Semantics

### Supplier colors

- `idox` = blue `#1f6feb`
- `landmark` = orange `#f79009`
- `esri` = green `#2da44e`
- `ordnance_survey` = purple `#8b5cf6`
- `other` = yellow `#facc15`
- `unknown` = grey `#9ca3af`

### Zones

- `water`
- `energy`
- `fibre`
- `gas`
- `transport`

### Value-to-height mapping

- `ACV` precedence: `value_estimate` > `total_spend` > `0`
- `height_units = clamp(log10(ACV + 1) * 3.5, 0.8, 18.0)`
