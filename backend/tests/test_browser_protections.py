"""The web/Pi backend's browser-facing protections (upload-origin-table-wrap-copy).

1. ``CrossSiteWriteGuard`` (main.py): a state-changing request a browser sent
   (it carries ``Origin`` or ``Sec-Fetch-Site``) without the app's request
   header is refused with 403 before routing, and nothing is written. Measured
   before the fix: a multipart or ``text/plain`` POST from
   ``Origin: https://evil.example`` replaced the eBird backup, the ML export, a
   bar-chart file and any ``/settings/{key}`` value (ROADMAP v1.0.39, finding 1).
2. ``SecurityHeaders`` (main.py): every response carries the four headers, the
   static SPA, a refusal and a CORS preflight answer included.

``settingskv``'s own content-type requirement is pinned in
test_settingskv_router.py beside the route's other body rows.

WHAT THESE ROWS CANNOT SEE: what a real browser sends. The TestClient sends no
Origin and no Sec-Fetch-*, so each deployment shape below states the headers a
current browser sends there, as measured at QA (decisions.md 4): Chromium and
WebKit send ``Sec-Fetch-*`` to loopback and to an HTTPS origin, and NOTHING of
it to a plain-HTTP address that is not loopback. A row that sends
``Sec-Fetch-Site`` for a LAN address describes no browser and passed while the
real setup was refused; do not add one back.
"""

import mimetypes
import os
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main
from main import app
from routers import apikeys as apikeys_module
from routers import barcharts as barcharts_module
from routers import mapdefaults as mapdefaults_module
from routers import settings as settings_module
from routers import settingskv as settingskv_module

client = TestClient(app)

BARCHART = (
    "ebird_US-CA-001__1900_2026_1_12_barchart.txt",
    b"Sample Size:\t1.0\t2.0\nLincoln's Sparrow\t0.1\t0.2\n",
    "text/plain",
)
CSV = ("MyEBirdData.csv", b"Submission ID,Common Name\nS1,American Robin\n", "text/csv")


@pytest.fixture(autouse=True)
def isolated_stores(tmp_path, monkeypatch):
    """Every store a write route can touch, under one temp dir (never the real data/ or .env)."""
    data = tmp_path / "data"
    monkeypatch.setattr(settings_module, "DATA_DIR", data)
    monkeypatch.setattr(settings_module, "EBIRD_FILE", data / "ebird-backup.csv")
    monkeypatch.setattr(settings_module, "ML_FILE", data / "ml-export.csv")
    monkeypatch.setattr(settings_module, "META_FILE", data / "metadata.json")
    monkeypatch.setattr(barcharts_module, "BARCHARTS_DIR", data / "barcharts")
    monkeypatch.setattr(barcharts_module, "BARCHARTS_META", data / "barcharts.json")
    monkeypatch.setattr(settingskv_module, "DATA_DIR", data)
    monkeypatch.setattr(settingskv_module, "SETTINGS_DIR", data / "settings")
    monkeypatch.setattr(mapdefaults_module, "DATA_DIR", data)
    monkeypatch.setattr(mapdefaults_module, "MAP_DEFAULTS_FILE", data / "map-defaults.json")
    env_file = tmp_path / ".env"
    env_file.write_text("")
    monkeypatch.setattr(apikeys_module, "ENV_FILE", env_file)
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)


def _snapshot(root: Path) -> dict:
    """Every file under the temp dir with its bytes, plus the key in the process env."""
    files = {str(p.relative_to(root)): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}
    return {"files": files, "env": os.environ.get("EBIRD_API_KEY")}


# Every state-changing route, each with a body its own handler accepts, so a
# refusal here is the guard's and never a validation error.
WRITES = {
    "POST /settings/files/ebird": ("POST", "/settings/files/ebird", {"files": {"file": CSV}}),
    "POST /settings/files/ml": ("POST", "/settings/files/ml", {"files": {"file": CSV}}),
    "POST /settings/barcharts/{code}": ("POST", "/settings/barcharts/US-CA-001", {"files": {"file": BARCHART}}),
    "POST /settings/{key}": ("POST", "/settings/theme", {"json": "dark"}),
    "POST /settings/keys/{name}": ("POST", "/settings/keys/ebird", {"json": {"value": "attacker-key"}}),
    "POST /settings/map-defaults": ("POST", "/settings/map-defaults", {"json": {"lat": 1.0, "lng": 2.0, "dist": 3}}),
    "DELETE /settings/files/ebird": ("DELETE", "/settings/files/ebird", {}),
    "DELETE /settings/files/ml": ("DELETE", "/settings/files/ml", {}),
    "DELETE /settings/barcharts/{code}": ("DELETE", "/settings/barcharts/US-CA-001", {}),
    "DELETE /settings/barcharts": ("DELETE", "/settings/barcharts", {}),
    "DELETE /settings/{key}": ("DELETE", "/settings/theme", {}),
    "DELETE /settings/keys/{name}": ("DELETE", "/settings/keys/ebird", {}),
    "DELETE /settings/map-defaults": ("DELETE", "/settings/map-defaults", {}),
}


def _send(write, headers=None):
    method, path, kwargs = write
    return client.request(method, path, headers=headers or {}, **kwargs)


def _seed():
    """A stored value behind every route, written with no Origin (the curl / tooling shape)."""
    for name, write in WRITES.items():
        if write[0] == "POST":
            assert _send(write).status_code == 200, name


APP_HEADER = {main.APP_REQUEST_HEADER: main.APP_REQUEST_HEADER_VALUE}

# A browser on another site. None of these can carry the app's header: adding a
# custom header needs a CORS preflight, which CORS refuses for every one of them
# (test_a_foreign_preflight_for_the_app_header_is_refused).
FOREIGN = {
    "foreign Origin, no Sec-Fetch-* (plain-HTTP target)": {"Origin": "https://evil.example"},
    "Origin: null (a sandboxed frame or file: page)": {"Origin": "null"},
    "Sec-Fetch-Site: cross-site": {"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"},
    "Sec-Fetch-Site: same-site (another port on this host)": {
        "Sec-Fetch-Site": "same-site", "Origin": "http://testserver:8080",
    },
    "Sec-Fetch-Site with no Origin": {"Sec-Fetch-Site": "none"},
}

# SnowRaven's own page in each deployment shape the brief names, with the
# headers a current browser actually sends there. Each passes WITH the app
# header and is refused WITHOUT it.
DEPLOYMENTS = {
    "./start.sh on localhost (loopback, so Sec-Fetch-* is sent)": {
        "Host": "localhost:1620", "Origin": "http://localhost:1620",
        "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
    },
    "Pi by LAN hostname over plain HTTP (no Sec-Fetch-*)": {
        "Host": "pi.local:1620", "Origin": "http://pi.local:1620",
    },
    "Pi by LAN IP over plain HTTP (no Sec-Fetch-*)": {
        "Host": "192.168.1.20:1620", "Origin": "http://192.168.1.20:1620",
    },
    "Vite dev proxy on localhost (Host rewritten)": {
        "Host": "localhost:1620", "Origin": "http://localhost:5173",
        "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
    },
    "Vite dev proxy on a LAN address (Host rewritten, no Sec-Fetch-*)": {
        "Host": "localhost:1620", "Origin": "http://192.168.1.20:5173",
    },
    "nginx default: Host rewritten, no X-Forwarded-Host, no Sec-Fetch-*": {
        "Host": "127.0.0.1:1620", "Origin": "http://pi.local",
    },
    "tailscale serve: https outside, Host kept": {
        "Host": "pi.tail1234.ts.net", "Origin": "https://pi.tail1234.ts.net",
        "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
    },
}

# Not a browser: no Origin and no Sec-Fetch-Site. These pass without the header.
NON_BROWSER = {
    "no Origin, no Sec-Fetch-* (curl, TestClient)": {},
    "Node fetch sends Sec-Fetch-Mode only (website/tools)": {"Sec-Fetch-Mode": "cors"},
}

REFUSED = {"detail": "Request refused: not sent by SnowRaven's own page."}


@pytest.mark.parametrize("shape", [
    {"Origin": "https://evil.example"},
    {"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"},
], ids=["plain-http-target", "trustworthy-target"])
@pytest.mark.parametrize("name", list(WRITES))
def test_every_write_route_refuses_a_cross_site_request_and_writes_nothing(tmp_path, name, shape):
    _seed()
    before = _snapshot(tmp_path)
    resp = _send(WRITES[name], shape)
    assert resp.status_code == 403, resp.text
    assert resp.json() == REFUSED
    assert _snapshot(tmp_path) == before


@pytest.mark.parametrize("shape", list(FOREIGN.values()), ids=list(FOREIGN))
def test_foreign_shapes_are_refused(tmp_path, shape):
    resp = _send(WRITES["POST /settings/files/ebird"], shape)
    assert resp.status_code == 403
    assert _snapshot(tmp_path)["files"] == {".env": b""}


@pytest.mark.parametrize("shape", list(DEPLOYMENTS.values()), ids=list(DEPLOYMENTS))
def test_every_deployment_writes_and_deletes_with_the_app_header(tmp_path, shape):
    headers = {**shape, **APP_HEADER}
    assert _send(WRITES["POST /settings/files/ebird"], headers).status_code == 200
    assert (tmp_path / "data" / "ebird-backup.csv").read_bytes() == CSV[1]
    assert _send(WRITES["POST /settings/{key}"], headers).status_code == 200
    assert _send(WRITES["DELETE /settings/files/ebird"], headers).status_code == 200
    assert not (tmp_path / "data" / "ebird-backup.csv").exists()


@pytest.mark.parametrize("shape", list(DEPLOYMENTS.values()), ids=list(DEPLOYMENTS))
def test_every_deployment_is_refused_without_the_app_header(tmp_path, shape):
    _seed()
    before = _snapshot(tmp_path)
    for name in ("POST /settings/files/ebird", "POST /settings/{key}", "DELETE /settings/files/ebird"):
        resp = _send(WRITES[name], shape)
        assert resp.status_code == 403, name
        assert resp.json() == REFUSED
    assert _snapshot(tmp_path) == before


@pytest.mark.parametrize("value", ["", "0", "true", "11", " 1x"])
def test_the_app_header_must_carry_its_value(tmp_path, value):
    shape = {**DEPLOYMENTS["Pi by LAN hostname over plain HTTP (no Sec-Fetch-*)"], main.APP_REQUEST_HEADER: value}
    assert _send(WRITES["POST /settings/files/ebird"], shape).status_code == 403
    assert _snapshot(tmp_path)["files"] == {".env": b""}


@pytest.mark.parametrize("shape", list(NON_BROWSER.values()), ids=list(NON_BROWSER))
def test_non_browser_callers_write_and_delete_without_the_header(tmp_path, shape):
    assert _send(WRITES["POST /settings/files/ebird"], shape).status_code == 200
    assert (tmp_path / "data" / "ebird-backup.csv").read_bytes() == CSV[1]
    assert _send(WRITES["DELETE /settings/files/ebird"], shape).status_code == 200
    assert not (tmp_path / "data" / "ebird-backup.csv").exists()


def test_reads_and_preflights_are_not_the_guards_business():
    cross = {"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"}
    # A cross-site READ is answered; CORS keeps the sender from reading it.
    resp = client.get("/settings/files", headers=cross)
    assert resp.status_code == 200
    assert "access-control-allow-origin" not in resp.headers
    # CORS still answers preflights exactly as before: the dev origin allowed, a foreign one refused.
    pre = {"Access-Control-Request-Method": "DELETE"}
    ok = client.options("/settings/theme", headers={**pre, "Origin": "http://localhost:5173"})
    assert ok.status_code == 200
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.options("/settings/theme", headers={**pre, "Origin": "https://evil.example"})
    assert bad.status_code == 400


@pytest.mark.parametrize("origin", [
    "https://evil.example",
    "null",
    "http://testserver:8080",
    "http://192.168.1.20:5173",
])
@pytest.mark.parametrize("method", ["POST", "DELETE"])
def test_a_foreign_preflight_for_the_app_header_is_refused(origin, method):
    """What makes the header unforgeable: a page on another origin must preflight
    to add it, and CORS refuses that preflight, so the browser never sends the
    write. The app's own page never preflights (every call is same-origin, the
    Vite proxy included), so a LAN dev origin being refused here costs nothing."""
    resp = client.options("/settings/files/ebird", headers={
        "Origin": origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": main.APP_REQUEST_HEADER.lower(),
    })
    # Starlette's refusal still lists the methods and headers it would allow; a
    # browser fails the preflight on the missing Access-Control-Allow-Origin.
    assert resp.status_code == 400
    assert resp.text == "Disallowed CORS origin"
    assert "access-control-allow-origin" not in resp.headers


def test_cors_admits_only_the_dev_origin():
    # The header's guarantee rests on this list (main.is_refused_browser_write):
    # a wildcard or a regex here would let every admitted origin send it.
    cors = next(m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware")
    assert cors.kwargs["allow_origins"] == list(main.DEV_ORIGINS) == ["http://localhost:5173"]
    assert "allow_origin_regex" not in cors.kwargs


_FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
_FRONTEND_HEADER = _FRONTEND / "src" / "lib" / "appRequestHeader.ts"


def test_the_vite_dev_server_leaves_preflights_to_this_backend():
    # Vite's default CORS answers a preflight itself for ANY localhost origin
    # and echoes the requested headers, so a page on another local port could
    # add the app header and write through the dev proxy (measured in Chromium
    # and WebKit at QA attempt 1). `cors: false` hands the preflight to the
    # CORS checked above. Comments are stripped, so the explanation beside the
    # setting cannot satisfy this row on its own.
    config = "\n".join(
        line.split("//", 1)[0] for line in (_FRONTEND / "vite.config.ts").read_text(encoding="utf-8").splitlines()
    )
    server = config[config.index("server: {"):config.index("build: {")]
    assert re.search(r"^\s*cors:\s*false,?\s*$", server, re.M), "vite.config.ts server.cors must be false"


def test_the_frontend_sends_the_header_the_backend_requires():
    # Two declarations of one contract, compared to each other: a name or value
    # changed on one side alone would refuse every web/Pi write.
    source = _FRONTEND_HEADER.read_text(encoding="utf-8")
    name = re.findall(r"export const APP_REQUEST_HEADER = '([^']*)'", source)
    value = re.findall(r"export const APP_REQUEST_HEADER_VALUE = '([^']*)'", source)
    assert name == [main.APP_REQUEST_HEADER]
    assert value == [main.APP_REQUEST_HEADER_VALUE]


# ── The four security headers ────────────────────────────────────────────────

EXPECTED_HEADERS = {
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
}


def _assert_security_headers(resp):
    for name, value in EXPECTED_HEADERS.items():
        assert resp.headers.get(name) == value, f"{name} on {resp.request.method} {resp.request.url.path}"


def test_the_header_values_are_the_ones_main_sends():
    # One table, compared to the module's, so the expected values are not merely restated.
    assert {k.lower(): v for k, v in main.SECURITY_HEADERS} == EXPECTED_HEADERS


@pytest.mark.parametrize("request_args", [
    ("GET", "/health", {}),
    ("GET", "/settings/files", {}),
    ("GET", "/settings/never-saved", {}),  # a 404 from a route
    ("POST", "/settings/theme", {"content": b"x", "headers": {"content-type": "text/plain"}}),  # a 415
    ("POST", "/settings/theme", {"json": "dark", "headers": {"Origin": "null"}}),  # the guard's 403
    ("OPTIONS", "/settings/theme", {"headers": {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}}),
    ("GET", "/", {}),  # the static SPA when frontend/dist is built, else a 404 from the same outer stack
], ids=["health", "api-200", "api-404", "api-415", "guard-403", "cors-preflight", "spa-root"])
def test_every_response_carries_the_security_headers(request_args):
    method, path, kwargs = request_args
    _assert_security_headers(client.request(method, path, **kwargs))


_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@pytest.mark.skipif(not (_DIST / "index.html").exists(), reason="frontend/dist is not built")
def test_the_built_spa_and_its_scripts_and_styles_carry_the_headers_and_their_types():
    page = client.get("/")
    assert page.status_code == 200
    assert page.headers["content-type"].startswith("text/html")
    _assert_security_headers(page)
    assets = sorted((_DIST / "assets").iterdir())
    script = next(p for p in assets if p.suffix == ".js")
    style = next(p for p in assets if p.suffix == ".css")
    js = client.get(f"/assets/{script.name}")
    css = client.get(f"/assets/{style.name}")
    assert js.headers["content-type"].split(";")[0] in {"text/javascript", "application/javascript"}
    assert css.headers["content-type"].split(";")[0] == "text/css"
    _assert_security_headers(js)
    _assert_security_headers(css)


def test_this_hosts_mimetypes_serves_scripts_and_styles_as_themselves():
    # `nosniff` makes a script or stylesheet served as anything else fail to
    # load. Starlette's StaticFiles types a file with mimetypes, which reads the
    # host's own tables (/etc/mime.types on Linux, so this row is the CI runner's
    # answer). Vite's module scripts and workers already require a JavaScript
    # type without nosniff; this pins the stylesheet half too.
    for name in ("a.js", "a.mjs"):
        assert mimetypes.guess_type(name)[0] in {"text/javascript", "application/javascript"}, name
    assert mimetypes.guess_type("a.css")[0] == "text/css"
