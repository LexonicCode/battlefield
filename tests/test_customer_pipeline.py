import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.customer_pipeline import canonicalize_value, compute_height_units, normalize_rows, read_raw_csv


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

    def test_read_raw_csv_supports_utility_sector_headers(self):
        with TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "UtilitySectorData.csv"
            csv_path.write_text(
                "Account Owner,Account Name,Sector,Supplier ,Current ACV,Potential ACV,\n"
                "Owner,Example Co,Water,Idox,100,250,\n",
                encoding="utf-8",
            )

            rows = read_raw_csv(csv_path)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["account_name"], "Example Co")
        self.assertEqual(rows[0]["sector"], "Water")
        self.assertEqual(rows[0]["supplier"], "Idox")
        self.assertEqual(rows[0]["total_spend"], "100")
        self.assertEqual(rows[0]["value_estimate"], "250")
        self.assertIsNone(rows[0]["idox_penetration"])

    def test_read_raw_csv_rejects_missing_required_columns(self):
        with TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "invalid.csv"
            csv_path.write_text("Account Name,Supplier \nExample Co,Idox\n", encoding="utf-8")

            with self.assertRaises(ValueError):
                read_raw_csv(csv_path)

    def test_normalize_rows_disambiguates_duplicate_customer_ids(self):
        rows, _, _, _ = normalize_rows(
            [
                {
                    "account_owner": "North",
                    "account_name": "Example Co",
                    "sector": "Water",
                    "supplier": "Idox",
                    "value_estimate": "10",
                    "total_spend": "10",
                    "idox_penetration": "0",
                },
                {
                    "account_owner": "South",
                    "account_name": "Example Co",
                    "sector": "Water",
                    "supplier": "Idox",
                    "value_estimate": "20",
                    "total_spend": "20",
                    "idox_penetration": "0",
                },
            ]
        )

        self.assertEqual(len({row.customer_id for row in rows}), 2)


if __name__ == "__main__":
    unittest.main()
