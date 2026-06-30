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
    "other": "#8b5cf6",
    "unknown": "#d1d5db",
}

SECTOR_TERRITORY_CENTERS = {
    "water": (-20.0, 0.0),
    "energy": (0.0, 0.0),
    "fibre": (20.0, 0.0),
    "gas": (-10.0, 20.0),
    "infrastructure": (10.0, 20.0),
    "renewables": (0.0, -20.0),
    "other": (30.0, 20.0),
}

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
    customer_id_counts: Dict[str, int] = {}

    for row in rows:
        account_name = (row.get("account_name") or "").strip()
        if not account_name:
            rejected.append({"reason": "missing account_name", "row": row})
            continue

        supplier_key = normalize_text(row.get("supplier"))
        sector_key = normalize_text(row.get("sector"))

        supplier = supplier_map.get(supplier_key, "other" if supplier_key else "unknown")
        sector = sector_map.get(sector_key, "other")

        if supplier_key and supplier_key not in supplier_map:
            unmapped_suppliers.add(row.get("supplier"))
        if sector_key and sector_key not in sector_map:
            unmapped_sectors.add(row.get("sector"))

        value_estimate = parse_float(row.get("value_estimate"))
        total_spend = parse_float(row.get("total_spend"))
        idox_penetration = parse_float(row.get("idox_penetration")) or 0.0
        normalized_value, value_source, value_confidence = canonicalize_value(value_estimate, total_spend)

        base_customer_id = f"{slugify(account_name)}__{sector}"
        customer_id_counts[base_customer_id] = customer_id_counts.get(base_customer_id, 0) + 1
        occurrence = customer_id_counts[base_customer_id]
        customer_id = base_customer_id if occurrence == 1 else f"{base_customer_id}--{occurrence}"

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


def axial_spiral(index: int) -> Tuple[int, int]:
    if index == 0:
        return 0, 0
    directions = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
    ring = 1
    while 1 + 3 * ring * (ring + 1) <= index:
        ring += 1
    ring -= 1
    start_index = 1 + 3 * ring * (ring + 1)
    offset = index - start_index

    q, r = ring + 1, 0
    steps = ring + 1
    for direction in directions:
        for _ in range(steps):
            if offset == 0:
                return q, r
            q += direction[0]
            r += direction[1]
            offset -= 1
    return q, r


def build_battlefield_rows(canonical_rows: List[dict]) -> List[dict]:
    by_sector: Dict[str, List[dict]] = {}
    for row in canonical_rows:
        by_sector.setdefault(row["sector"], []).append(row)

    battlefield_rows: List[dict] = []
    for sector in sorted(by_sector.keys()):
        rows = sorted(by_sector[sector], key=lambda row: row["customer_id"])
        center_x, center_z = SECTOR_TERRITORY_CENTERS.get(sector, SECTOR_TERRITORY_CENTERS["other"])
        for idx, row in enumerate(rows):
            q, r = axial_spiral(idx)
            offset_x, offset_z = axial_to_world(q, r)
            battlefield_rows.append(
                {
                    **row,
                    "height_units": compute_height_units(float(row["normalized_value"])),
                    "color": SUPPLIER_COLORS.get(row["supplier"], SUPPLIER_COLORS["other"]),
                    "x": round(center_x + offset_x, 3),
                    "z": round(center_z + offset_z, 3),
                }
            )

    battlefield_rows.sort(key=lambda item: item["customer_id"])
    return battlefield_rows
