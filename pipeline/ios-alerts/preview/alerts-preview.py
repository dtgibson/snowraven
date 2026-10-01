#!/usr/bin/env python3
"""ios-alerts preview server: the built app, as the iPhone build, in a browser.

Serves `frontend/dist` on a LOOPBACK port and injects `alerts-preview-shim.js`
(a faked iOS native layer) into index.html before the app's own scripts, so the
platform-gated Settings -> Alerts section renders and every control works
against an in-memory model of the native alert actor. For the user's review
over the tailnet (their memory: loopback plus `tailscale serve --https=<fresh
port>`, never file:// or localhost links), and for the Tester's Playwright runs.

  cd frontend && npm run build
  python3 pipeline/ios-alerts/preview/alerts-preview.py --port 8821
  tailscale serve --https=<a fresh port> http://127.0.0.1:8821
  open  https://<host>:<port>/?scenario=configured      (see the bar at the bottom)

Nothing here ships; it is a preview tool beside the build's pipeline folder.
"""
import argparse
import http.server
import os
import socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DIST = os.path.join(REPO, 'frontend', 'dist')
SHIM_URL = '/__alerts_preview/shim.js'
TAG = f'<script src="{SHIM_URL}"></script>'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIST, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _send(self, body: bytes, ctype: str):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == SHIM_URL:
            with open(os.path.join(HERE, 'alerts-preview-shim.js'), 'rb') as f:
                return self._send(f.read(), 'text/javascript; charset=utf-8')
        target = os.path.join(DIST, path.lstrip('/'))
        if path in ('/', '/index.html') or not os.path.exists(target):
            with open(os.path.join(DIST, 'index.html'), encoding='utf-8') as f:
                html = f.read()
            i = html.find('<script')
            html = html[:i] + TAG + html[i:] if i >= 0 else html.replace('</head>', TAG + '</head>', 1)
            return self._send(html.encode('utf-8'), 'text/html; charset=utf-8')
        return super().do_GET()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8821)
    args = ap.parse_args()
    if not os.path.exists(os.path.join(DIST, 'index.html')):
        raise SystemExit('frontend/dist is missing: run `npm run build` in frontend first')
    with socketserver.ThreadingTCPServer(('127.0.0.1', args.port), Handler) as srv:
        print(f'ios-alerts preview on http://127.0.0.1:{args.port}/?scenario=configured')
        srv.serve_forever()


if __name__ == '__main__':
    main()
