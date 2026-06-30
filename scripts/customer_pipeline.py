from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = REPO_ROOT / "data" / "raw" / "clean_customers.csv"
CANONICAL_JSON = REPO_ROOT / "data" / "canonical" / "customers.canonical.json"
QUALITY_REPORT = REPO_ROOT / "data" / "reports" / "data_quality.json"
BATTLEFIELD_JSON = REPO_ROOT / "data" / "canonical" / "customers.battlefield.json"
PUBLIC_BATTLEFIELD_JSON = REPO_ROOT / "public" / "data" / "customers.battlefield.json"
SUPPLIER_MAP_PATH = REPO_ROOT / "data" / "mappings" / "suppliers.json"
SECTOR_MAP_PATH = REPO_ROOT / "data" / "mappings" / "sectors.json"

SUPPLIER_COLORS = {
    "idox": "#1f6feb",
    "landmark": "#f79009",
    "esri": "#2da44e",
    "ordnance_survey": "#8b5cf6",
    "other": "#facc15",
    "unknown": "#9ca3af",
}

ZONE_ORDER = ("water", "energy", "fibre", "gas", "transport")
ZONE_LABELS = {zone: zone.title() for zone in ZONE_ORDER}
GRID_WIDTH = 25
GRID_HEIGHT = 25

REQUIRED_COLUMNS = {
    "account_name",
    "sector",
    "supplier",
    "value_estimate",
    "total_spend",
    "idox_penetration",
}


@dataclass(frozen=True)
class CanonicalRow:
    customer_id: str
    account_name: str
    sector: str
    supplier: str
    value_estimate: float | None
    total_spend: float | None
    normalized_value: float
    value_source: str
    value_confidence: str
    idox_penetration: float


def load_mapping(path: Path) -> Dict[str, str]:
    content = json.loads(path.read_text(encoding="utf-8"))
    mapping: Dict[str, str] = {}
    for canonical, aliases in content.items():
        for alias in aliases:
            mapping[normalize_text(alias)] = canonical
    return mapping


def normalize_text(value: str | None) -> str:
    return (value or "").strip().lower()


def parse_float(value: str | None) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    cleaned = text.replace("£", "").replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def slugify(value: str) -> str:
    collapsed = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return re.sub(r"-+", "-", collapsed).strip("-") or "unknown"


def canonicalize_value(
    value_estimate: float | None,
    total_spend: float | None,
) -> Tuple[float, str, str]:
    if value_estimate is not None and value_estimate > 0:
        return value_estimate, "value_estimate", "estimated"
    if total_spend is not None and total_spend > 0:
        return total_spend, "total_spend", "derived"
    return 0.0, "missing", "missing"


def normalize_rows(rows: Iterable[dict]) -> Tuple[List[CanonicalRow], List[dict], set, set]:
    supplier_map = load_mapping(SUPPLIER_MAP_PATH)
    sector_map = load_mapping(SECTOR_MAP_PATH)

    normalized: List[CanonicalRow] = []
    rejected: List[dict] = []
    unmapped_suppliers: set = set()
    unmapped_sectors: set = set()
    seen_customer_ids: Dict[str, int] = {}

    for row in rows:
        account_name = (row.get("account_name") or "").strip()
        if not account_name:
            rejected.append({"reason": "missing account_name", "row": row})
            continue

        supplier_key = normalize_text(row.get("supplier"))
        sector_key = normalize_text(row.get("sector"))

        supplier = supplier_map.get(supplier_key, "other" if supplier_key else "unknown")
        sector = sector_map.get(sector_key, "transport")

        if supplier_key and supplier_key not in supplier_map:
            unmapped_suppliers.add(row.get("supplier"))
        if sector_key and sector_key not in sector_map:
            unmapped_sectors.add(row.get("sector"))

        value_estimate = parse_float(row.get("value_estimate"))
        total_spend = parse_float(row.get("total_spend"))
        idox_penetration = parse_float(row.get("idox_penetration")) or 0.0
        normalized_value, value_source, value_confidence = canonicalize_value(value_estimate, total_spend)

        customer_id_base = f"{slugify(account_name)}__{sector}"
        occurrence = seen_customer_ids.get(customer_id_base, 0) + 1
        seen_customer_ids[customer_id_base] = occurrence
        customer_id = customer_id_base if occurrence == 1 else f"{customer_id_base}-{occurrence}"

        normalized.append(
            CanonicalRow(
                customer_id=customer_id,
                account_name=account_name,
                sector=sector,
                supplier=supplier,
                value_estimate=value_estimate,
                total_spend=total_spend,
                normalized_value=normalized_value,
                value_source=value_source,
                value_confidence=value_confidence,
                idox_penetration=idox_penetration,
            )
        )

    normalized.sort(key=lambda item: item.customer_id)
    return normalized, rejected, unmapped_suppliers, unmapped_sectors


def read_raw_csv(path: Path = RAW_CSV) -> List[dict]:
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        missing_columns = REQUIRED_COLUMNS.difference(set(reader.fieldnames or []))
        if missing_columns:
            raise ValueError(f"Missing required columns: {sorted(missing_columns)}")
        return list(reader)


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def to_serializable(rows: List[CanonicalRow]) -> List[dict]:
    return [row.__dict__ for row in rows]


def build_quality_report(
    rows: List[CanonicalRow],
    rejected: List[dict],
    unmapped_suppliers: set,
    unmapped_sectors: set,
) -> dict:
    duplicates = len(rows) - len({row.customer_id for row in rows})
    non_zero_values = sum(1 for row in rows if row.normalized_value > 0)
    unknown_suppliers = sum(1 for row in rows if row.supplier == "unknown")
    return {
        "loaded_rows": len(rows),
        "rejected_rows": len(rejected),
        "duplicate_customer_ids": duplicates,
        "non_zero_normalized_value_count": non_zero_values,
        "non_zero_normalized_value_coverage_pct": round((non_zero_values / len(rows) * 100), 2) if rows else 0.0,
        "unknown_supplier_count": unknown_suppliers,
        "unknown_supplier_coverage_pct": round((unknown_suppliers / len(rows) * 100), 2) if rows else 0.0,
        "unmapped_suppliers": sorted(str(item) for item in unmapped_suppliers),
        "unmapped_sectors": sorted(str(item) for item in unmapped_sectors),
    }


def compute_height_units(normalized_value: float, min_height: float = 0.8, max_height: float = 18.0) -> float:
    if normalized_value <= 0:
        return min_height
    scaled = math.log10(normalized_value + 1) * 3.5
    return round(max(min_height, min(max_height, scaled)), 3)


def axial_to_world(q: int, r: int, spacing: float = 2.8) -> Tuple[float, float]:
    x = spacing * (math.sqrt(3) * q + math.sqrt(3) / 2 * r)
    z = spacing * (3 / 2 * r)
    return round(x, 3), round(z, 3)


def offset_to_world(column: int, row: int, spacing: float = 2.2) -> Tuple[float, float]:
    centered_column = column - (GRID_WIDTH - 1) / 2
    centered_row = row - (GRID_HEIGHT - 1) / 2
    x = spacing * math.sqrt(3) * (centered_column + 0.5 * (row % 2))
    z = spacing * 1.5 * centered_row
    return round(x, 3), round(z, 3)


def zone_for_cell(column: int, row: int) -> str:
    u = (column + 0.5) / GRID_WIDTH
    v = (row + 0.5) / GRID_HEIGHT

    if v < 0.18 and u > 0.62:
        return "gas"
    if u < 0.24 and v > 0.68:
        return "transport"
    if u < 0.44 and v <= 0.6:
        return "energy"
    if 0.44 <= u < 0.54 and v > 0.48:
        return "water"
    return "fibre"


def build_layout_cells() -> List[dict]:
    cells: List[dict] = []
    for row in range(GRID_HEIGHT):
        for column in range(GRID_WIDTH):
            x, z = offset_to_world(column, row)
            zone = zone_for_cell(column, row)
            cells.append(
                {
                    "grid_column": column,
                    "grid_row": row,
                    "zone": zone,
                    "zone_label": ZONE_LABELS[zone],
                    "x": x,
                    "z": z,
                }
            )
    return cells


def build_battlefield_rows(canonical_rows: List[dict]) -> List[dict]:
    by_sector: Dict[str, List[dict]] = {}
    for row in canonical_rows:
        by_sector.setdefault(row["sector"], []).append(row)

    layout_cells = build_layout_cells()
    cells_by_zone: Dict[str, List[dict]] = {}
    for cell in layout_cells:
        cells_by_zone.setdefault(cell["zone"], []).append(cell)

    for zone in cells_by_zone:
        cells_by_zone[zone].sort(key=lambda cell: (cell["grid_row"], cell["grid_column"]))

    battlefield_rows: List[dict] = []
    for sector in ZONE_ORDER:
        rows = sorted(by_sector.get(sector, []), key=lambda row: row["customer_id"])
        zone_cells = cells_by_zone.get(sector, [])
        if len(rows) > len(zone_cells):
            raise ValueError(
                f"Zone '{sector}' has {len(rows)} companies but only {len(zone_cells)} available hexes"
            )
        for idx, row in enumerate(rows):
            cell = zone_cells[idx]
            battlefield_rows.append(
                {
                    **row,
                    "sector_label": ZONE_LABELS[sector],
                    "acv": float(row["normalized_value"]),
                    "height_units": compute_height_units(float(row["normalized_value"])),
                    "color": SUPPLIER_COLORS.get(row["supplier"], SUPPLIER_COLORS["other"]),
                    "x": cell["x"],
                    "z": cell["z"],
                    "grid_column": cell["grid_column"],
                    "grid_row": cell["grid_row"],
                }
            )

    battlefield_rows.sort(key=lambda item: item["customer_id"])
    return battlefield_rows
