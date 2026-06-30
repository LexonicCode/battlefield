from __future__ import annotations

from customer_pipeline import (
    BATTLEFIELD_JSON,
    CANONICAL_JSON,
    PUBLIC_BATTLEFIELD_JSON,
    REPO_ROOT,
    SUPPLIER_COLORS,
    build_battlefield_rows,
    write_json,
)
import json


def main() -> None:
    canonical_rows = json.loads(CANONICAL_JSON.read_text(encoding="utf-8"))
    battlefield_rows = build_battlefield_rows(canonical_rows)
    payload = {
        "metadata": {
            "supplier_colors": SUPPLIER_COLORS,
            "height_semantics": "height_units = clamp(log10(normalized_value + 1) * 3.5, 0.8, 18.0)",
            "value_precedence": "value_estimate > total_spend > 0",
        },
        "records": battlefield_rows,
    }
    write_json(BATTLEFIELD_JSON, payload)
    write_json(PUBLIC_BATTLEFIELD_JSON, payload)
    print(f"Wrote {BATTLEFIELD_JSON.relative_to(REPO_ROOT)}")
    print(f"Wrote {PUBLIC_BATTLEFIELD_JSON.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
