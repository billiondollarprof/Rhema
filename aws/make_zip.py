# make_zip.py
#
# What this file does:
#   It makes watcher.zip, the file Anthony uploads in the AWS Lambda console
#   when the watcher is set up WITHOUT GitHub (GitHubDeploy no, the default).
#   Inside: the watcher, named index.py (AWS starts index.handler, the same
#   name the placeholder uses), and the list of hospitals, sites.json.
#
# Why it exists:
#   2026-11-09: the AWS account is on the Free plan, whose rules forbid the
#   GitHub login link, so GitHub cannot put the code in. Anthony chose to
#   upload it by hand until his card is added.
#
# How to run it:
#   python3 aws/make_zip.py            (writes aws/watcher.zip)
#   python3 aws/make_zip.py other.zip  (writes it somewhere else)
#
# What it must never do:
#   Put anything in the zip except those two files. No key, no secret.

# sys gives us the words typed after the command (here, where to write).
import sys

# zipfile is Python's built in tool for making .zip files.
import zipfile

# Path finds files next to this one.
from pathlib import Path

# The folder this file is in (aws/).
HERE = Path(__file__).parent

# Where to write: the first word after the command, or aws/watcher.zip.
target = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "watcher.zip"

# Write the zip. "w" means write a new file; ZIP_DEFLATED makes it smaller.
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as bundle:
    # The watcher goes in as index.py, so AWS's index.handler finds it.
    bundle.write(HERE / "uptime_watcher.py", "index.py")
    # The hospitals to watch, beside it, where the watcher looks for them.
    bundle.write(HERE / "sites.json", "sites.json")

# Say where it went.
print(f"Made {target}")
