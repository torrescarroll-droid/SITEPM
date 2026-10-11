"""Offline, hidden entry of a recovery PUBLISHABLE key. Never accepts server secrets."""
import base64
import getpass
import json
import os
import sys
from pathlib import Path

project = "sdqnkvpparemaptbqnkj"
destination = Path("/private/tmp/sitepm-v4-current-recovery-key.json")
if not sys.stdin.isatty():
    raise SystemExit("Run this command in an interactive Terminal; hidden input is required.")
key = getpass.getpass("Recovery project's current publishable/anon API key (hidden): ").strip()
try:
    if key.startswith("sb_publishable_"):
        valid = len(key) > len("sb_publishable_")
    else:
        payload = key.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        valid = claims.get("ref") == project and claims.get("role") == "anon"
    if not valid:
        raise ValueError()
except (ValueError, IndexError, TypeError, UnicodeError):
    raise SystemExit("Rejected: use only this recovery project's publishable/anon key. No file written.") from None
try:
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    raise SystemExit("An input file already exists; stop and ask the agent to inspect it. Nothing overwritten.") from None
with os.fdopen(descriptor, "w") as file:
    json.dump({"project": project, "key": key}, file)
print("Recovery-only publishable test input prepared. No network calls or passwords used. Tell the agent: input ready.")
