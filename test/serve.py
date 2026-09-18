#!/usr/bin/env python3
"""Serve the fixtures and the extension sources over http for the smoke test.

Every path returns a fixture page, so the fixture can be requested at a URL
shaped like a real channel (/@name/videos) and the content script's route
check sees the pathname it expects. ?f= picks which fixture.
"""

import http.server
import pathlib
import socketserver
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = ROOT / "test"
TYPES = {".js": "application/javascript", ".css": "text/css", ".html": "text/html"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path, _, query = self.path.partition("?")

        if path.startswith("/src/") or path.startswith("/test/"):
            target = ROOT / path.lstrip("/")
        else:
            name = query.split("f=")[1].split("&")[0] if "f=" in query else "grid.html"
            target = TESTS / name

        if not target.is_file():
            self.send_error(404)
            return

        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(target.suffix, "text/plain"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
    httpd.serve_forever()
