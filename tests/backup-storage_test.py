"""No network: validate private storage backup integrity and path boundaries."""
import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backup", Path(__file__).parents[1] / "deploy/backup/backup.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class StorageBackupTests(unittest.TestCase):
    def config(self, root):
        env = root / "application.env"
        env.write_text('NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co"\nSUPABASE_SERVICE_ROLE_KEY="test-only"\n')
        return {"environmentFile": str(env), "storageBuckets": ["social-media"]}

    def test_bucket_files_are_archived_with_size_and_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            responses = [io.BytesIO(json.dumps([{"name": "photo.jpg", "id": "object-1", "metadata": {"size": 5, "mimetype": "image/jpeg"}}]).encode()), io.BytesIO(b"image")]
            with patch.object(backup, "storage_open", side_effect=responses) as request:
                objects = backup.storage_files(self.config(root), root)
            self.assertEqual(objects[0]["sha256"], hashlib.sha256(b"image").hexdigest())
            self.assertEqual((root / "storage/social-media/photo.jpg").read_bytes(), b"image")
            self.assertTrue(request.call_args.args[0].full_url.startswith("https://example.supabase.co/storage/"))

    def test_unsafe_object_names_fail_before_any_download(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(backup, "storage_open", return_value=io.BytesIO(b'[{"name":"../outside","id":"object"}]')) as request:
                with self.assertRaises(ValueError):
                    backup.storage_files(self.config(root), root)
                self.assertEqual(request.call_count, 1)

    def test_truncated_object_never_passes_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            responses = [io.BytesIO(b'[{"name":"photo.jpg","id":"object","metadata":{"size":100}}]'), io.BytesIO(b"short")]
            with patch.object(backup, "storage_open", side_effect=responses):
                with self.assertRaises(ValueError):
                    backup.storage_files(self.config(root), root)


if __name__ == "__main__":
    unittest.main()
