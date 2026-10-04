"""Read-only security smoke checks against the running authoring server."""
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

origin = "http://127.0.0.1:4180"
with urlopen(origin + "/api/status") as response:
    status = json.load(response)
assert status["ready"]
for headers in [
    {"Origin": "https://example.com", "X-Workshop-Token": status["token"]},
    {"Origin": origin},
    {"Origin": origin, "X-Workshop-Token": "wrong"},
    {"Origin": origin, "X-Workshop-Token": status["token"], "Host": "example.com:4180"},
]:
    request = Request(origin + "/api/lipsync", data=b"{}", method="POST", headers={"Content-Type": "application/json", **headers})
    try:
        urlopen(request)
        raise AssertionError("Unauthorized analysis request accepted")
    except HTTPError as error:
        assert error.code == 403
print("Untrusted origin, missing token, wrong token and mismatched Host rejected (403).")
