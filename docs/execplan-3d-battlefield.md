# ExecPlan: Interactive 3D Customer Battlefield

This is a living execution plan aligned to repository planning standards. It is written to be self-contained for contributors with no prior repository context.

## Objective
Build an MVP planning tool that transforms `clean_customers.csv` into a normalized canonical dataset and visualizes each company as an interactive 3D hex column battlefield grouped by sector territories.

## Scope in this PR
- Add deterministic data pipeline foundation (`normalize`, `validate`, `build`).
- Add canonical mappings and generated machine-readable outputs.
- Add interactive 3D battlefield scaffold (hex columns, supplier coloring, value-based heights, territory layout, click details + filters).
- Document exact commands for regeneration and local run.

## Out of Scope (for this PR)
- In-app write-back editing to production data (only designed for in plan, not fully implemented).
- Advanced analytics and authentication.

## Progress
- [x] Inspect repository baseline and CI context.
- [x] Define architecture for deterministic data and frontend rendering pipeline.
- [x] Create data directory structure (`data/raw`, `data/canonical`, `data/reports`, `data/mappings`).
- [x] Implement normalization/validation/build scripts with repeatable outputs.
- [x] Add 3D visualization scaffold with sector and supplier filters.
- [x] Add focused tests for normalization and taxonomy logic.
- [ ] Extend into write-back update workflow.
- [ ] Add production deployment pipeline.

## Surprises & Discoveries
- Repository was nearly empty (no prior app/tooling), so foundational scaffolding was required.
- `PLANS.md` was not present in current branch or `main`; plan therefore includes required living sections explicitly.
- Source CSV was not present in clone at start, so a small sample `data/raw/clean_customers.csv` was added for deterministic local verification while preserving expected input filename.

## Decision Log
1. **Decision:** Use Python stdlib scripts for data pipeline (`scripts/*.py`).
   - **Rationale:** Deterministic, dependency-light, and easy to run in CI and local environments.
   - **Date:** 2026-06-30

2. **Decision:** Canonical supplier/sector mappings stored as JSON in `data/mappings/`.
   - **Rationale:** Explicit taxonomy registry for maintainability and safe updates.
   - **Date:** 2026-06-30

3. **Decision:** `normalized_value` precedence = `value_estimate` > `total_spend` > `0`.
   - **Rationale:** Matches requirement for deterministic field with documented precedence.
   - **Date:** 2026-06-30

4. **Decision:** Render dataset generated to both `data/canonical/customers.battlefield.json` and `public/data/customers.battlefield.json`.
   - **Rationale:** Keeps canonical artifact in data pipeline while making frontend consumption direct and static.
   - **Date:** 2026-06-30

## Implementation Milestones

### Milestone 1: Data foundation
**Files**
- `/home/runner/work/battlefield/battlefield/scripts/customer_pipeline.py`
- `/home/runner/work/battlefield/battlefield/scripts/normalize_customers.py`
- `/home/runner/work/battlefield/battlefield/scripts/validate_customers.py`
- `/home/runner/work/battlefield/battlefield/scripts/build_battlefield_dataset.py`
- `/home/runner/work/battlefield/battlefield/data/mappings/suppliers.json`
- `/home/runner/work/battlefield/battlefield/data/mappings/sectors.json`

**Commands**
- `python scripts/normalize_customers.py`
- `python scripts/validate_customers.py`
- `python scripts/build_battlefield_dataset.py`

**Acceptance checks**
- Canonical JSON generated deterministically.
- Data quality report generated.
- Battlefield dataset includes color and height fields.

### Milestone 2: 3D MVP visual
**Files**
- `/home/runner/work/battlefield/battlefield/src/battlefield/palette.js`
- `/home/runner/work/battlefield/battlefield/src/battlefield/layout.js`
- `/home/runner/work/battlefield/battlefield/src/battlefield/hexTile.js`
- `/home/runner/work/battlefield/battlefield/src/battlefield/scene.js`
- `/home/runner/work/battlefield/battlefield/src/main.js`
- `/home/runner/work/battlefield/battlefield/src/styles.css`
- `/home/runner/work/battlefield/battlefield/index.html`

**Commands**
- `npm install`
- `npm run dev`
- `npm run build`

**Acceptance checks**
- Interactive scene loads.
- Hex columns show value-based heights and supplier colors.
- Sector grouping and basic filters/click interaction function.

### Milestone 3: Quality/verification docs
**Files**
- `/home/runner/work/battlefield/battlefield/tests/test_customer_pipeline.py`
- `/home/runner/work/battlefield/battlefield/README.md`

**Commands**
- `python -m unittest discover -s tests -v`

**Acceptance checks**
- Tests pass.
- README provides exact setup/run/regeneration commands and semantics.

## Interfaces and Dependencies

### Data Interfaces
Input:
- `/home/runner/work/battlefield/battlefield/data/raw/clean_customers.csv`

Outputs:
- `/home/runner/work/battlefield/battlefield/data/canonical/customers.canonical.json`
- `/home/runner/work/battlefield/battlefield/data/reports/data_quality.json`
- `/home/runner/work/battlefield/battlefield/data/canonical/customers.battlefield.json`
- `/home/runner/work/battlefield/battlefield/public/data/customers.battlefield.json`

### Frontend contract (record fields used)
- `customer_id`, `account_name`, `sector`, `supplier`
- `normalized_value`, `height_units`, `color`
- `x`, `z` position

### Runtime dependencies
- `three`
- `vite`

## Validation Steps
1. Regenerate pipeline outputs:
   - `python scripts/normalize_customers.py`
   - `python scripts/validate_customers.py`
   - `python scripts/build_battlefield_dataset.py`
2. Run focused tests:
   - `python -m unittest discover -s tests -v`
3. Build frontend:
   - `npm run build`
4. Manual verification:
   - `npm run dev`
   - Verify filters and click details update according to selected tile.

## Idempotence and Recovery
- All scripts overwrite derived files and sort records deterministically.
- Re-running with unchanged input yields unchanged outputs.
- Recovery path: re-run normalize -> validate -> build, then restart `npm run dev`.
- `data/raw/clean_customers.csv` is treated as source-of-truth and never mutated by scripts.

## Observable Acceptance Criteria
- Repo has a living ExecPlan with required sections.
- Pipeline produces canonical + battlefield JSON from `clean_customers.csv`.
- Frontend displays 3D hex columns with:
  - height from normalized account value,
  - supplier color mapping (IDOX blue, LANDMARK orange, ESRI green, other distinct, unknown pale grey),
  - deterministic sector territory placement.
- At least one interactive utility function exists (filters and click details panel).

## Outcomes & Retrospective
Implemented MVP foundation in an empty repository with deterministic data pipeline and usable 3D visual scaffold. Remaining next-step work is write-back editing workflow and richer UX/analytics, now enabled by the canonical model and module boundaries added in this PR.

---
Revision note (2026-06-30): Initial plan authored and updated to reflect implemented milestone progress in this PR.
