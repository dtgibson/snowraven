#!/bin/sh
# Read merge request 51451's state, pipelines and recent notes. Prints no secret.
set -eu
T="$(cat "$HOME/.tauri/gitlab-fdroid.token")"
P="fdroid%2Ffdroiddata"
api() { curl -sS -H "PRIVATE-TOKEN: $T" "$@"; }
echo "--- merge request:"
api "https://gitlab.com/api/v4/projects/$P/merge_requests/51451" | python3 -c '
import sys,json; m=json.load(sys.stdin)
print("state:", m["state"], "| draft:", m.get("draft"), "| merge status:", m.get("detailed_merge_status"))
print("labels:", m.get("labels")); print("updated:", m["updated_at"]); print("head pipeline:", (m.get("head_pipeline") or {}).get("status"))'
echo "--- pipelines:"
api "https://gitlab.com/api/v4/projects/$P/merge_requests/51451/pipelines" | python3 -c '
import sys,json
for p in json.load(sys.stdin)[:5]: print(p["id"], p["status"], p["created_at"], p.get("web_url"))'
echo "--- notes (newest first):"
api "https://gitlab.com/api/v4/projects/$P/merge_requests/51451/notes?sort=desc&per_page=8" | python3 -c '
import sys,json
for n in json.load(sys.stdin):
    body=n["body"].replace("\n"," ")[:300]
    print("*", n["created_at"][:16], n["author"]["username"], "(system)" if n.get("system") else "", ":", body)'
