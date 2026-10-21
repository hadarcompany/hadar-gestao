"""Real HTTP protocol checks; synthetic media never reaches a social network."""
import hashlib
import hmac
import http.client
import importlib.util
import io
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("media", Path(__file__).parents[1] / "deploy/media/server.py")
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


class MediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.key = b"test-only-secret-" * 4
        (root / "key").write_bytes(self.key)
        self.store = media.Store({"directory": str(root / "objects"), "origins": ["https://gestao.example.test"],
            "limitBytes": 1024**3, "minFreeBytes": 0,
            "instances": {"hadar": {"secretFile": str(root / "key"), "limitBytes": 512 * 1024**2}}})
        self.server = media.Server(("127.0.0.1", 0), media.Handler)
        self.server.store = self.store
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.asset = {"i": "hadar", "p": "a" * 16 + "/12345678-1234-4234-9234-123456789abc.mp4", "s": 30, "m": "video/mp4"}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def ticket(self, action, asset=None, **override):
        data = (asset or self.asset) | {"a": action, "e": int(time.time()) + 120} | override
        encoded = media.b64(json.dumps(data).encode())
        return encoded + "." + media.b64(hmac.new(self.key, encoded.encode(), hashlib.sha256).digest())

    def request(self, method, action, data=None, token=None, headers=None, query=""):
        client = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=60)
        ticket = token or self.ticket("upload" if action == "chunk" else action)
        uri = "/v1/" + action + ("?ticket=" + ticket if action == "read" else query)
        client.request(method, uri, body=data, headers={"Authorization": "Bearer " + ticket} | (headers or {}))
        response = client.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        client.close()
        return result

    def test_rejects_missing_wrong_expired_and_cross_action_capabilities(self):
        for token in ("invalid", self.ticket("read"), self.ticket("init", e=int(time.time()) - 1), self.ticket("init", i="another")):
            self.assertEqual(self.request("POST", "init", token=token)[0], 401)
        self.assertEqual(self.request("POST", "init", token=self.ticket("init", p="../outside.mp4"))[0], 401)
        self.assertEqual(self.request("POST", "init", headers={"Origin": "https://evil.test"})[0], 403)
        self.assertEqual(self.store.used(), 0)

    def test_upload_completion_is_idempotent_and_object_is_immutable(self):
        content = b"\x00\x00\x00\x20ftypisom" + b"x" * 18
        self.assertEqual(self.request("POST", "init")[0], 200)
        self.assertEqual(self.request("POST", "complete")[0], 409)
        self.assertEqual(self.request("PUT", "chunk", content, query="?index=0")[0], 200)
        self.assertEqual(self.request("PUT", "chunk", content, query="?index=0")[0], 200)
        self.assertEqual(self.request("PUT", "chunk", b"z" * 30, query="?index=0")[0], 409)
        for _ in range(2):
            self.assertEqual(self.request("POST", "complete")[0], 200)
        self.assertEqual(self.request("PUT", "chunk", content, query="?index=0")[0], 409)
        status, headers, result = self.request("GET", "read", headers={"Range": "bytes=4-11"})
        self.assertEqual((status, result), (206, b"ftypisom"))
        self.assertEqual(headers["Content-Range"], "bytes 4-11/30")
        self.assertEqual(headers["Connection"], "close")
        self.assertEqual(self.request("HEAD", "read")[1]["Content-Length"], "30")
        self.assertEqual(self.request("POST", "delete")[0], 200)
        self.assertEqual(self.request("POST", "delete")[0], 200)
        self.assertEqual(self.request("GET", "read")[0], 404)

    def test_quota_declared_size_and_content_type_are_enforced(self):
        self.store.limit = 29
        self.assertEqual(self.request("POST", "init")[0], 507)
        self.store.limit = 100
        self.assertEqual(self.request("POST", "init")[0], 200)
        self.assertEqual(self.request("PUT", "chunk", b"x" * 31, query="?index=0")[0], 409)
        self.assertEqual(self.request("PUT", "chunk", b"x" * 30, query="?index=0")[0], 200)
        self.assertEqual(self.request("POST", "complete")[0], 415)
        self.assertEqual(self.request("GET", "info")[0], 409)
        self.assertFalse((self.store.folder(self.asset) / "object").exists())

    def test_200mb_streams_in_parts_and_digest_matches_after_download(self):
        self.asset["s"] = 200 * 1024**2
        self.assertEqual(self.request("POST", "init")[0], 200)
        digest = hashlib.sha256()
        for index in range(25):
            part = b"x" * media.CHUNK
            if index == 0:
                part = b"\x00\x00\x00\x20ftypisom" + part[12:]
            digest.update(part)
            self.assertEqual(self.request("PUT", "chunk", part, query=f"?index={index}")[0], 200)
        status, _, result = self.request("POST", "complete")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(result)["sha256"], digest.hexdigest())
        client = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=60)
        client.request("GET", "/v1/read?ticket=" + self.ticket("read"))
        response = client.getresponse()
        actual = hashlib.sha256()
        while block := response.read(65536):
            actual.update(block)
        self.assertEqual(actual.digest(), digest.digest())
        client.close()
        self.assertEqual(self.request("POST", "delete")[0], 200)


if __name__ == "__main__":
    unittest.main()
