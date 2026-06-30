import unittest

from scripts.customer_pipeline import (
    GRID_HEIGHT,
    GRID_WIDTH,
    SUPPLIER_COLORS,
    ZONE_ORDER,
    build_battlefield_rows,
    canonicalize_value,
    compute_height_units,
    normalize_rows,
    read_raw_csv,
)


class CustomerPipelineTests(unittest.TestCase):
    def test_value_precedence_prefers_value_estimate(self):
        value, source, confidence = canonicalize_value(125000.0, 60000.0)
        self.assertEqual(value, 125000.0)
        self.assertEqual(source, "value_estimate")
        self.assertEqual(confidence, "estimated")

    def test_value_precedence_falls_back_to_total_spend(self):
        value, source, confidence = canonicalize_value(None, 82000.0)
        self.assertEqual(value, 82000.0)
        self.assertEqual(source, "total_spend")
        self.assertEqual(confidence, "derived")

    def test_value_precedence_missing(self):
        value, source, confidence = canonicalize_value(None, None)
        self.assertEqual(value, 0.0)
        self.assertEqual(source, "missing")
        self.assertEqual(confidence, "missing")

    def test_unmapped_supplier_defaults_other(self):
        rows, _, unmapped_suppliers, _ = normalize_rows(
            [
                {
                    "account_name": "Example Co",
                    "sector": "Water",
                    "supplier": "AcmeGeo",
                    "value_estimate": "",
                    "total_spend": "1200",
                    "idox_penetration": "0",
                }
            ]
        )
        self.assertEqual(rows[0].supplier, "other")
        self.assertIn("AcmeGeo", unmapped_suppliers)

    def test_height_units_has_minimum(self):
        self.assertEqual(compute_height_units(0.0), 0.8)

    def test_dataset_maps_to_required_zones(self):
        rows, _, _, _ = normalize_rows(read_raw_csv())
        self.assertEqual(len(rows), 469)
        observed_zones = {row.sector for row in rows}
        self.assertTrue(observed_zones.issubset(set(ZONE_ORDER)))
        self.assertTrue({"water", "energy", "fibre", "transport"}.issubset(observed_zones))

    def test_battlefield_rows_use_unique_grid_cells(self):
        canonical_rows, _, _, _ = normalize_rows(read_raw_csv())
        battlefield_rows = build_battlefield_rows([row.__dict__ for row in canonical_rows])
        self.assertEqual(len(battlefield_rows), 469)

        occupied = {(row["grid_column"], row["grid_row"]) for row in battlefield_rows}
        self.assertEqual(len(occupied), len(battlefield_rows))

        for row in battlefield_rows:
            self.assertIn(row["sector"], ZONE_ORDER)
            self.assertIn(row["supplier"], SUPPLIER_COLORS)
            self.assertEqual(row["color"], SUPPLIER_COLORS[row["supplier"]])
            self.assertGreaterEqual(row["grid_column"], 0)
            self.assertGreaterEqual(row["grid_row"], 0)
            self.assertLess(row["grid_column"], GRID_WIDTH)
            self.assertLess(row["grid_row"], GRID_HEIGHT)


if __name__ == "__main__":
    unittest.main()
