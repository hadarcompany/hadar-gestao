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
    def test_local_media_is_encrypted_once_and_retained_while_any_backup_references_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, output, temporary = root / "media", root / "output", root / "tmp"
            for folder in (source / "object-a", output, temporary):
                folder.mkdir(parents=True)
            content = b"private-video" * 100
            expected = hashlib.sha256(content).hexdigest()
            (source / "object-a/object").write_bytes(content)
            (source / "object-a/manifest.json").write_text(json.dumps({"ready": True, "sha256": expected,
                "s": len(content), "m": "video/mp4", "p": "a" * 16 + "/12345678-1234-4234-9234-123456789abc.mp4"}))
            key = b"x" * 32
            config = {"localMediaDirectory": str(source)}
            with patch.object(backup.os, "chown", create=True):
                first = backup.local_media_files(config, temporary, output, key)
                second = backup.local_media_files(config, temporary, output, key)
            self.assertEqual(first, second)
            self.assertEqual(len(list(output.glob("*.hgm"))), 1)
            blob = output / first[0]["file"]
            restored = temporary / "restored.mp4"
            backup.decrypt(blob, restored, key)
            self.assertEqual(restored.read_bytes(), content)
            (output / "old-backup.json").write_text(json.dumps({"mediaBlobs": first}))
            backup.prune_media_blobs(output)
            self.assertTrue(blob.exists())
            (output / "old-backup.json").unlink()
            backup.prune_media_blobs(output)
            self.assertFalse(blob.exists())

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
