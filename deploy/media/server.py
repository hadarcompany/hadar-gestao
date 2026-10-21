#!/usr/bin/env python3
"""Private, bounded media spool. No framework, transcoding or database credentials.

Only Caddy reaches this loopback server. Capabilities are HMAC authenticated and
scoped to one immutable object and action. Never log URLs (they contain tickets).
"""
import argparse
import base64
import hashlib
import hmac
import json
import math
import os
import re
import shutil
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

CHUNK = 8 * 1024 * 1024
MAX_VIDEO = 200 * 1024 * 1024
PATH = re.compile(r"[a-f0-9]{16}/[a-f0-9-]{36}\.(?:jpg|mp4)\Z")
INSTANCE = re.compile(r"[a-z0-9-]{1,48}\Z")


class Reject(Exception):
    def __init__(self, status=400):
        self.status = status


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


class Store:
    def __init__(self, config):
        self.root = Path(config["directory"]).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.origins = config["origins"]
        self.instances = config["instances"]
        self.limit = int(config.get("limitBytes", 10 * 1024**3))
        self.floor = int(config.get("minFreeBytes", 10 * 1024**3))
        self.lock = threading.RLock()
        self.keys = {name: Path(item["secretFile"]).read_bytes().strip()
                     for name, item in self.instances.items()}
        if any(len(key) < 32 for key in self.keys.values()):
            raise ValueError("Media secrets must have at least 32 bytes")

    def authorize(self, token, action):
        try:
            if len(token) > 2048:
                raise ValueError()
            encoded, signature = token.split(".")
            data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            key = self.keys[data["i"]]
            valid = b64(hmac.new(key, encoded.encode(), hashlib.sha256).digest())
            maximum_age = 7200 if action == "upload" else 3600 if action == "read" else 300
            if not (hmac.compare_digest(valid, signature) and data["a"] == action
                    and type(data["e"]) is int and time.time() < data["e"] <= time.time() + maximum_age + 10
                    and INSTANCE.fullmatch(data["i"]) and PATH.fullmatch(data["p"])
                    and data["m"] in ("image/jpeg", "video/mp4")
                    and type(data["s"]) is int and 0 < data["s"] <= (MAX_VIDEO if data["m"] == "video/mp4" else CHUNK)
                    and data["p"].endswith(".mp4" if data["m"] == "video/mp4" else ".jpg")):
                raise ValueError()
            return data
        except (ValueError, KeyError, TypeError, AttributeError):
            raise Reject(401)

    def folder(self, data):
        # Hash user-facing paths; object directories are never served as a tree.
        return self.root / data["i"] / hashlib.sha256(data["p"].encode()).hexdigest()

    def manifest(self, data):
        try:
            result = json.loads((self.folder(data) / "manifest.json").read_text())
            if any(result[k] != data[k] for k in ("i", "p", "s", "m")):
                raise Reject(409)
            return result
        except FileNotFoundError:
            raise Reject(404)

    def save(self, data, manifest):
        folder = self.folder(data)
        temporary = folder / "manifest.tmp"
        with temporary.open("w") as file:
            json.dump(manifest, file)
            file.flush()
            os.fsync(file.fileno())
        temporary.replace(folder / "manifest.json")

    def used(self, instance=None):
        return sum(json.loads(path.read_text())["s"]
                   for path in self.root.glob(f"{instance or '*' }/*/manifest.json"))

    def init(self, data):
        with self.lock:
            folder = self.folder(data)
            if (folder / "manifest.json").exists():
                self.manifest(data)
                return
            quota = int(self.instances[data["i"]]["limitBytes"])
            # Assembly temporarily needs a second copy; keep a global disk floor.
            if (self.used() + data["s"] > self.limit
                    or self.used(data["i"]) + data["s"] > quota
                    or shutil.disk_usage(self.root).free - 2 * data["s"] < self.floor):
                raise Reject(507)
            folder.mkdir(parents=True, exist_ok=True, mode=0o700)
            self.save(data, {k: data[k] for k in ("i", "p", "s", "m")} | {"ready": False})

    def chunk(self, data, index, size, source):
        with self.lock:
            manifest = self.manifest(data)
            total = math.ceil(data["s"] / CHUNK)
            expected = min(CHUNK, data["s"] - index * CHUNK)
            if manifest["ready"] or not 0 <= index < total or size != expected:
                raise Reject(409)
            if shutil.disk_usage(self.root).free - size < self.floor:
                raise Reject(507)
            folder = self.folder(data)
            part, temporary = folder / f"{index}.part", folder / "upload.tmp"
            digest = hashlib.sha256()
            try:
                with temporary.open("wb") as output:
                    remaining = size
                    while remaining:
                        block = source.read(min(65536, remaining))
                        if not block:
                            raise Reject(400)
                        output.write(block)
                        digest.update(block)
                        remaining -= len(block)
                    output.flush()
                    os.fsync(output.fileno())
                if part.exists():
                    with part.open("rb") as old:
                        previous_hash = hashlib.sha256()
                        while block := old.read(65536):
                            previous_hash.update(block)
                        previous = previous_hash.digest()
                    if not hmac.compare_digest(previous, digest.digest()):
                        raise Reject(409)
                else:
                    temporary.replace(part)
            finally:
                temporary.unlink(missing_ok=True)

    def complete(self, data):
        with self.lock:
            manifest = self.manifest(data)
            folder = self.folder(data)
            if manifest["ready"]:
                return self.info(data)
            parts = [folder / f"{n}.part" for n in range(math.ceil(data["s"] / CHUNK))]
            if any(not p.is_file() for p in parts):
                raise Reject(409)
            if sum(p.stat().st_size for p in parts) != data["s"]:
                raise Reject(409)
            if shutil.disk_usage(self.root).free - data["s"] < self.floor:
                raise Reject(507)
            digest = hashlib.sha256()
            temporary = folder / "complete.tmp"
            try:
                with temporary.open("wb") as output:
                    for part in parts:
                        with part.open("rb") as source:
                            while block := source.read(65536):
                                digest.update(block)
                                output.write(block)
                    output.flush()
                    os.fsync(output.fileno())
                with temporary.open("rb") as file:
                    header = file.read(16)
                if not (header.startswith(b"\xff\xd8\xff") if data["m"] == "image/jpeg" else header[4:8] == b"ftyp"):
                    raise Reject(415)
                temporary.replace(folder / "object")
                self.save(data, manifest | {"ready": True, "sha256": digest.hexdigest()})
                for part in parts:
                    part.unlink(missing_ok=True)
            finally:
                temporary.unlink(missing_ok=True)
            return self.info(data)

    def info(self, data):
        manifest = self.manifest(data)
        if not manifest["ready"] or not (self.folder(data) / "object").is_file():
            raise Reject(409)
        return {"bytes": manifest["s"], "mime": manifest["m"], "sha256": manifest["sha256"]}

    def delete(self, data):
        with self.lock:
            folder = self.folder(data)
            if folder.exists():
                # Parent is private to the service, never writable by HTTP clients.
                self.manifest(data)
                shutil.rmtree(folder)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "HadarMedia"
    sys_version = ""

    def log_message(self, *_args):
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(40)

    def send(self, status, result):
        encoded = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Connection", "close")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(encoded)
        self.close_connection = True

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin in self.server.store.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def do_OPTIONS(self):
        if self.headers.get("Origin") not in self.server.store.origins:
            return self.send(403, {"error": "Origin"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "PUT, GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Range")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()

    def handle_action(self):
        try:
            target = urlsplit(self.path)
            action = {("POST", "/v1/init"): "init", ("POST", "/v1/complete"): "complete",
                      ("POST", "/v1/delete"): "delete", ("GET", "/v1/info"): "info",
                      ("PUT", "/v1/chunk"): "upload", ("GET", "/v1/read"): "read",
                      ("HEAD", "/v1/read"): "read"}.get((self.command, target.path))
            if not action:
                raise Reject(404)
            origin = self.headers.get("Origin")
            if origin and origin not in self.server.store.origins:
                raise Reject(403)
            query = parse_qs(target.query, max_num_fields=3)
            token = query.get("ticket", [""])[0] if action == "read" else self.headers.get("Authorization", "").removeprefix("Bearer ")
            data = self.server.store.authorize(token, action)
            if self.headers.get("Transfer-Encoding"):
                raise Reject(400)
            size = int(self.headers.get("Content-Length", "0"))
            if action != "upload" and size != 0:
                raise Reject(400)
            store = self.server.store
            if action == "upload":
                store.chunk(data, int(query.get("index", ["-1"])[0]), size, self.rfile)
            elif action == "read":
                return self.read_object(data)
            elif action == "complete":
                return self.send(200, store.complete(data))
            elif action == "info":
                return self.send(200, store.info(data))
            else:
                getattr(store, action)(data)
            self.send(200, {"ok": True})
        except Reject as error:
            self.send(error.status, {"error": "Media request refused"})
        except (OSError, socket.timeout, ValueError):
            self.send(503, {"error": "Media unavailable"})
        except Exception:
            self.send(500, {"error": "Media unavailable"})

    def read_object(self, data):
        # Open under the same lock as deletion; an already opened Unix descriptor
        # stays valid even if cleanup unlinks the object during a long download.
        store = self.server.store
        with store.lock:
            store.info(data)
            file = (store.folder(data) / "object").open("rb")
        with file:
            start, end, status = 0, data["s"] - 1, 200
            requested = self.headers.get("Range")
            if requested:
                match = re.fullmatch(r"bytes=(\d+)-(\d*)", requested)
                if not match:
                    raise Reject(416)
                start = int(match[1])
                end = min(end, int(match[2])) if match[2] else end
                if not 0 <= start <= end < data["s"]:
                    raise Reject(416)
                status = 206
            self.send_response(status)
            self.send_header("Content-Type", data["m"])
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Connection", "close")
            self.close_connection = True
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{data['s']}")
            self.end_headers()
            if self.command != "HEAD":
                file.seek(start)
                remaining = end - start + 1
                while remaining:
                    block = file.read(min(65536, remaining))
                    if not block:
                        break
                    self.wfile.write(block)
                    remaining -= len(block)

    do_POST = do_PUT = do_GET = do_HEAD = handle_action


class Server(ThreadingHTTPServer):
    daemon_threads = True
    slots = threading.BoundedSemaphore(4)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            request.sendall(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--port", type=int, default=8091)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    server = Server((args.bind, args.port), Handler)
    server.store = Store(config)
    server.serve_forever()
