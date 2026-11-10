#!/usr/bin/env python3
"""Separate Insider material spool; never uses Hadar social storage keys or quotas."""
import argparse
import base64
import hashlib
import hmac
import importlib.util
import json
import re
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location("private_spool", Path(__file__).parent.parent / "media" / "server.py")
spool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spool)
MIMES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4"}
OBJECT = re.compile(r"[a-f0-9]{16}/[a-f0-9-]{36}\.(jpg|png|webp|mp4)\Z")

class Store(spool.Store):
    def authorize(self, token, action):
        try:
            if len(token) > 2048:
                raise ValueError()
            encoded, signature = token.split(".")
            data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            valid = spool.b64(hmac.new(self.keys[data["i"]], encoded.encode(), hashlib.sha256).digest())
            ext = MIMES[data["m"]]
            age = 7200 if action == "upload" else 3600 if action == "read" else 300
            if not (hmac.compare_digest(valid, signature) and data["i"] == "insider-materials"
                    and data["a"] == action and type(data["e"]) is int
                    and time.time() < data["e"] <= time.time() + age + 10
                    and OBJECT.fullmatch(data["p"]) and data["p"].endswith("." + ext)
                    and type(data["s"]) is int and 0 < data["s"] <= (200 if ext == "mp4" else 20) * 1024 ** 2):
                raise ValueError()
            return data
        except (ValueError, KeyError, TypeError, AttributeError):
            raise spool.Reject(401)

    def valid_header(self, data, header):
        return {"image/jpeg": header.startswith(b"\xff\xd8\xff"),
                "image/png": header.startswith(b"\x89PNG\r\n\x1a\n"),
                "image/webp": header[:4] == b"RIFF" and header[8:12] == b"WEBP",
                "video/mp4": header[4:8] == b"ftyp"}[data["m"]]

    def init(self, data):
        super().init(data)
        with self.lock:
            manifest = self.manifest(data)
            if "createdAt" not in manifest:
                self.save(data, manifest | {"createdAt": time.time()})

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--port", type=int, default=8092)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    server = spool.Server((args.bind, args.port), spool.Handler)
    server.store = Store(json.loads(Path(args.config).read_text()))
    server.serve_forever()
