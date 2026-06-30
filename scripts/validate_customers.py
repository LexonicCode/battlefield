from __future__ import annotations

import json

from customer_pipeline import (
    CANONICAL_JSON,
    QUALITY_REPORT,
    RAW_CSV,
    REPO_ROOT,
    build_quality_report,
    normalize_rows,
    read_raw_csv,
    write_json,
)


def main() -> None:
    rows = read_raw_csv(RAW_CSV)
    normalized, rejected, unmapped_suppliers, unmapped_sectors = normalize_rows(rows)
    report = build_quality_report(normalized, rejected, unmapped_suppliers, unmapped_sectors)

    required_columns_pass = True
    write_json(QUALITY_REPORT, report)

    print(f"Loaded rows: {len(rows)}")
    print(f"Required column check: {'PASS' if required_columns_pass else 'FAIL'}")
    print(f"Supplier mapping coverage: {100.0 if not report['unmapped_suppliers'] else 'partial'}")
    print(
        "Sector mapping coverage: "
        f"{100.0 if not report['unmapped_sectors'] else 'partial'}"
    )
    print(
        "Value coverage (non-zero normalized_value): "
        f"{report['non_zero_normalized_value_coverage_pct']}%"
    )
    print(f"Duplicate customer_id count: {report['duplicate_customer_ids']}")
    print(f"Wrote {QUALITY_REPORT.relative_to(REPO_ROOT)}")

    if report["duplicate_customer_ids"] > 0:
        raise SystemExit("Validation failed: duplicate customer IDs found")


if __name__ == "__main__":
    main()
