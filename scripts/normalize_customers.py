from __future__ import annotations

from customer_pipeline import (
    CANONICAL_JSON,
    RAW_CSV,
    REPO_ROOT,
    normalize_rows,
    read_raw_csv,
    to_serializable,
    write_json,
)

REJECTED_ROWS = REPO_ROOT / "data" / "reports" / "rejected_rows.json"


def main() -> None:
    rows = read_raw_csv(RAW_CSV)
    normalized, rejected, _, _ = normalize_rows(rows)
    write_json(CANONICAL_JSON, to_serializable(normalized))
    write_json(REJECTED_ROWS, rejected)

    print(f"Loaded rows: {len(rows)}")
    print(f"Canonical rows: {len(normalized)}")
    print(f"Rejected rows: {len(rejected)}")
    print(f"Wrote {CANONICAL_JSON.relative_to(REPO_ROOT)}")
    print(f"Wrote {REJECTED_ROWS.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
