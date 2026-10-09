import os
import runpy
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

class DatabaseConfigurationTests(unittest.TestCase):
    def test_root_environment_and_explicit_environment_precedence(self):
        source = Path(__file__).resolve().parent
        for name in ("init-admin.py", "drop-db.py", "seed-db.py"):
            with self.subTest(script=name), tempfile.TemporaryDirectory(prefix="codemeet-config-") as directory:
                root = Path(directory)
                (root / "scripts").mkdir()
                shutil.copyfile(source / name, root / "scripts" / name)
                (root / ".env").write_text("POSTGRES_PASSWORD=synthetic_private_fixture\n", encoding="utf-8")
                environment = dict(os.environ)
                environment.pop("POSTGRES_PASSWORD", None)
                with patch.dict(os.environ, environment, clear=True), patch("subprocess.run", side_effect=AssertionError("Database execution forbidden")):
                    result = runpy.run_path(str(root / "scripts" / name))
                    self.assertEqual(result["DB_PASSWORD"], "synthetic_private_fixture")
                environment["POSTGRES_PASSWORD"] = "explicit_private_fixture"
                with patch.dict(os.environ, environment, clear=True), patch("subprocess.run", side_effect=AssertionError("Database execution forbidden")):
                    result = runpy.run_path(str(root / "scripts" / name))
                    self.assertEqual(result["DB_PASSWORD"], "explicit_private_fixture")

if __name__ == "__main__":
    unittest.main()
