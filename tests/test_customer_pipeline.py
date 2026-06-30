import unittest

from scripts.customer_pipeline import canonicalize_value, compute_height_units, normalize_rows


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


if __name__ == "__main__":
    unittest.main()
