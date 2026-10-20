#!/usr/bin/env python3
"""Invoke one publishing step using a private config; credentials never enter argv."""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Worker redirects are not allowed")

config = json.loads(Path(sys.argv[1]).read_text())
url = urlparse(config["url"])
if url.scheme != "https" or url.username or url.password or url.path != "/api/social/worker" or url.query:
    raise SystemExit("Invalid worker URL")
secret = Path(config["secretFile"]).read_text().strip()
if len(secret) < 32:
    raise SystemExit("Missing worker secret")
try:
    request = Request(config["url"], data=b"", headers={"Authorization": "Bearer " + secret}, method="POST")
    with build_opener(NoRedirect).open(request, timeout=270) as response:
        body = json.load(response)
    # Aggregate counts only; never print response content or credentials on failure.
    print(json.dumps({key: body[key] for key in ("paused", "idle", "processing", "published", "failed", "uncertain") if key in body}))
except Exception as error:
    print(json.dumps({"status": "failed", "errorClass": type(error).__name__}))
    raise SystemExit(1)
