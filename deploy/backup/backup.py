#!/usr/bin/env python3
"""Encrypted logical backups, verified by restoring into a disposable local Postgres."""
import argparse
import hashlib
import json
import os
import re
import secrets
import subprocess
import tarfile
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b"HADAR-BACKUP-v1\x00"
IMAGE = "postgres:18-bookworm"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Storage redirects are not allowed")


def storage_open(request, timeout):
    return build_opener(NoRedirect).open(request, timeout=timeout)


def run(args, **kwargs):
    return subprocess.run(args, check=True, stderr=subprocess.PIPE, **kwargs)


def encrypt(source, destination, key):
    nonce = secrets.token_bytes(12)
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    cipher.authenticate_additional_data(MAGIC)
    with source.open("rb") as src, destination.open("xb") as dst:
        dst.write(MAGIC + nonce)
        for block in iter(lambda: src.read(1024 * 1024), b""):
            dst.write(cipher.update(block))
        dst.write(cipher.finalize() + cipher.tag)
        dst.flush()
        os.fsync(dst.fileno())


def decrypt(source, destination, key):
    size = source.stat().st_size
    with source.open("rb") as src:
        if src.read(len(MAGIC)) != MAGIC or size < len(MAGIC) + 28:
            raise ValueError("Invalid backup")
        nonce = src.read(12)
        src.seek(-16, 2)
        tag = src.read(16)
        cipher = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        cipher.authenticate_additional_data(MAGIC)
        remaining = size - len(MAGIC) - 12 - 16
        src.seek(len(MAGIC) + 12)
        with destination.open("xb") as dst:
            while remaining:
                block = src.read(min(1024 * 1024, remaining))
                if not block:
                    raise ValueError("Truncated backup")
                remaining -= len(block)
                dst.write(cipher.update(block))
            dst.write(cipher.finalize())


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest() if hasattr(hashlib, "file_digest") else digest_legacy(stream)


def digest_legacy(stream):
    value = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        value.update(block)
    return value.hexdigest()


def pg_environment(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.password:
        raise ValueError("Invalid database configuration")
    return dict(os.environ, PGHOST=parsed.hostname, PGPORT=str(parsed.port or 5432),
                PGUSER=unquote(parsed.username or "postgres"), PGPASSWORD=unquote(parsed.password),
                PGDATABASE=parsed.path.lstrip("/") or "postgres", PGSSLMODE="require", PGCONNECT_TIMEOUT="20")


def dump_database(url, target):
    args = ["docker", "run", "--rm", "--cpus=0.75", "--memory=384m"]
    for variable in ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "PGCONNECT_TIMEOUT"):
        args += ["--env", variable]
    args += [IMAGE, "pg_dump", "--format=custom", "--compress=6", "--no-owner", "--no-acl",
             "--schema=public", "--schema=auth", "--lock-wait-timeout=30s"]
    with target.open("xb") as output:
        run(args, env=pg_environment(url), stdout=output, timeout=600)


def storage_files(config, temporary):
    """Archive configured private buckets; no caller-provided external URLs."""
    buckets = config.get("storageBuckets", [])
    if not buckets:
        return []
    env = {}
    for line in Path(config["environmentFile"]).read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = json.loads(value) if value.startswith('"') else value.strip("'")
    origin = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    if not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", origin):
        raise ValueError("Invalid storage origin")
    token = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not token:
        raise ValueError("Missing storage credentials")
    headers = {"apikey": token, "Authorization": "Bearer " + token}
    result = []
    total = 0
    for bucket in buckets:
        if not re.fullmatch(r"[a-z0-9-]+", bucket):
            raise ValueError("Invalid bucket")
        pending = [""]
        while pending:
            prefix = pending.pop()
            offset = 0
            while True:
                payload = json.dumps({"prefix": prefix, "limit": 1000, "offset": offset, "sortBy": {"column": "name", "order": "asc"}}).encode()
                request = Request(origin + "/storage/v1/object/list/" + bucket, data=payload, headers=dict(headers, **{"Content-Type": "application/json"}), method="POST")
                try:
                    with storage_open(request, timeout=60) as response:
                        rows = json.load(response)
                except HTTPError as error:
                    # A configured bucket must exist: silently skipping a bucket
                    # would make a successful backup misleading.
                    raise RuntimeError("Storage listing failed") from error
                if not isinstance(rows, list):
                    raise ValueError("Invalid storage listing")
                for row in rows:
                    name = row.get("name", "")
                    if not name or "/" in name or "\\" in name or name in (".", ".."):
                        raise ValueError("Unsafe storage path")
                    remote = prefix + name
                    if not row.get("id"):
                        pending.append(remote + "/")
                        continue
                    target = temporary / "storage" / bucket / remote
                    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                    request = Request(origin + "/storage/v1/object/authenticated/" + bucket + "/" + quote(remote, safe="/"), headers=headers)
                    actual_size = 0
                    with storage_open(request, timeout=120) as response, target.open("xb") as stream:
                        for block in iter(lambda: response.read(1024 * 1024), b""):
                            total += len(block)
                            actual_size += len(block)
                            if total > int(config.get("storageMaxBytes", 2 * 1024**3)):
                                raise ValueError("Storage backup size limit exceeded")
                            stream.write(block)
                    if row.get("metadata", {}).get("size") is not None and actual_size != int(row["metadata"]["size"]):
                        raise ValueError("Incomplete storage object")
                    result.append({"bucket": bucket, "path": remote, "bytes": actual_size, "sha256": digest(target), "contentType": row.get("metadata", {}).get("mimetype")})
                    if len(result) > 10000:
                        raise ValueError("Storage backup object limit exceeded")
                if len(rows) < 1000:
                    break
                offset += 1000
    return result


def verify_restore(dump, roles=()):
    name = "hadar-restore-" + uuid.uuid4().hex
    env = dict(os.environ, POSTGRES_PASSWORD=secrets.token_urlsafe(32))
    try:
        run(["docker", "run", "-d", "--name", name, "--label", "hadar.restore-test=true", "--network=none",
             "--memory=768m", "--cpus=0.75", "--tmpfs", "/var/lib/postgresql:rw,size=1024m",
             "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB=restorecheck", IMAGE], env=env, stdout=subprocess.PIPE)
        for _ in range(60):
            ready = subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "restorecheck"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Restore test database unavailable")
        sql = ('DROP SCHEMA public; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_auth_admin; '
               'CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; '
               'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;')
        for role in roles:
            if not re.fullmatch(r"[a-z_][a-z0-9_]*", role):
                raise ValueError("Invalid restore role")
            sql += f'CREATE ROLE "{role}";'
        run(["docker", "exec", name, "psql", "-U", "postgres", "-d", "restorecheck", "-v", "ON_ERROR_STOP=1", "-c", sql], stdout=subprocess.PIPE)
        with dump.open("rb") as stream:
            run(["docker", "exec", "-i", name, "pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "-U", "postgres", "-d", "restorecheck"], stdin=stream, stdout=subprocess.PIPE, timeout=600)
        query = "SELECT json_build_object('users',(SELECT count(*) FROM public.users),'authUsers',(SELECT count(*) FROM auth.users),'tasks',(SELECT count(*) FROM public.tasks),'clients',(SELECT count(*) FROM public.clients),'publicTables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'unprotectedTables',(SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity))"
        result = run(["docker", "exec", name, "psql", "-U", "postgres", "-d", "restorecheck", "-At", "-c", query], stdout=subprocess.PIPE)
        counts = json.loads(result.stdout)
        if counts["users"] < 1 or counts["authUsers"] < 1 or counts["unprotectedTables"]:
            raise RuntimeError("Restored database failed integrity checks")
        return counts
    finally:
        owned = subprocess.run(["docker", "inspect", "--format", '{{index .Config.Labels "hadar.restore-test"}}', name], capture_output=True)
        if owned.returncode == 0 and owned.stdout.strip() == b"true":
            subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def backup(config_path):
    config = json.loads(config_path.read_text())
    slug = config["instance"]
    if not re.fullmatch(r"[a-z0-9-]+", slug):
        raise ValueError("Invalid instance name")
    output = Path(config["output"]).resolve()
    output.mkdir(parents=True, exist_ok=True, mode=0o750)
    key = bytes.fromhex(Path(config["keyFile"]).read_text().strip())
    if len(key) != 32:
        raise ValueError("Invalid backup encryption key")
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%S") + f"-{secrets.token_hex(3)}Z"
    final = output / (stamp + ".hgb")
    with tempfile.TemporaryDirectory(prefix="hadar-backup-", dir=config["staging"]) as temporary:
        temp = Path(temporary)
        dump = temp / "database.dump"
        dump_database(config["databaseUrl"], dump)
        counts = verify_restore(dump, config.get("restoreRoles", []))
        objects = storage_files(config, temp)
        manifest = {"instance": slug, "createdAt": now.isoformat(), "schemas": ["public", "auth"],
                    "restoreVerified": True, "restoredCounts": counts,
                    "databaseSha256": digest(dump), "externalStorageObjectsIncluded": bool(config.get("storageBuckets")),
                    "storageBuckets": config.get("storageBuckets", []), "storageObjects": objects}
        (temp / "manifest.json").write_text(json.dumps(manifest))
        archive = temp / "backup.tar"
        with tarfile.open(archive, "w") as tar:
            tar.add(dump, arcname="database.dump")
            tar.add(temp / "manifest.json", arcname="manifest.json")
            tar.add(config["environmentFile"], arcname="application.env")
            if objects:
                tar.add(temp / "storage", arcname="storage")
        encrypted = temp / "backup.hgb"
        encrypt(archive, encrypted, key)
        checked = temp / "checked.tar"
        decrypt(encrypted, checked, key)
        if digest(checked) != digest(archive):
            raise RuntimeError("Encryption verification failed")
        # Both paths must share a filesystem for atomic publication.
        os.replace(encrypted, final)
        os.chmod(final, 0o640)
        os.chown(final, -1, output.stat().st_gid)
        report = {"status": "ok", "instance": slug, "createdAt": now.isoformat(), "file": final.name,
                  "sha256": digest(final), "bytes": final.stat().st_size, "restoreVerified": True}
        report_file = final.with_suffix(".json")
        report_file.write_text(json.dumps(report))
        report_file.chmod(0o640)
        os.chown(report_file, -1, output.stat().st_gid)
        pending = output / "status.pending"
        pending.write_text(json.dumps(report))
        pending.chmod(0o640)
        os.chown(pending, -1, output.stat().st_gid)
        os.replace(pending, output / "status.json")
    cutoff = now - timedelta(days=int(config.get("retentionDays", 14)))
    for old in output.glob("*.hgb"):
        if old != final and datetime.fromtimestamp(old.stat().st_mtime, timezone.utc) < cutoff:
            old.unlink()
            old.with_suffix(".json").unlink(missing_ok=True)
    print(json.dumps(report))


if __name__ == "__main__":
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("config", type=Path)
    args = parser.parse_args()
    try:
        backup(args.config)
    except Exception as error:
        # Provider/SQL exception text may contain credentials or rows; keep it out of the journal.
        print(json.dumps({"status": "failed", "errorClass": type(error).__name__}))
        try:
            config = json.loads(args.config.read_text())
            state = Path(config["output"]) / "status.json"
            failure = {"status": "failed", "instance": config["instance"], "failedAt": datetime.now(timezone.utc).isoformat(), "errorClass": type(error).__name__}
            state.write_text(json.dumps(failure))
            state.chmod(0o640)
            os.chown(state, -1, state.parent.stat().st_gid)
            if isinstance(error, subprocess.CalledProcessError):
                Path(config["staging"], config["instance"] + "-last-error.log").write_bytes(error.stderr or b"")
        except Exception:
            pass
        raise SystemExit(1)
