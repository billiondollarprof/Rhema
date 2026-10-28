# supabase_check.py
#
# What this file does:
#   It proves that GitHub can reach the hospital's Supabase project. It asks
#   Supabase three questions and prints the answers:
#     1. Does the project exist, which region is it in, and is it healthy?
#     2. Does Supabase's security check find any warnings?
#     3. Can we log in to the database itself with the password?
#
# How it runs:
#   On GitHub Actions only (.github/workflows/supabase-check.yml), because
#   that is where the secrets live. It reads them from the environment.
#
# What it must never do:
#   Print a secret, or read any table that could hold patient data. It only
#   asks the database for its version number.


# ===== 1. Tools =====

# os lets us read the secrets that GitHub hands to this script.
import os

# json turns Supabase's answers (text in JSON format) into Python
# dictionaries we can look inside.
import json

# subprocess lets Python run another program. We use it to run psql, the
# standard Postgres command line tool, which GitHub's computers already have.
import subprocess

import sys

# urllib is Python's built in tool for calling a web address.
import urllib.request


# ===== 2. Settings =====

# The project's ID (its "ref"). It is part of the project's web address, so
# it is not a secret.
PROJECT_REF = "ntfvckqczpmylskusgft"

# os.environ.get reads a value that GitHub put in the environment.
# The second value, "", is what we get if it is missing.
ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")

API = "https://api.supabase.com/v1/projects/" + PROJECT_REF


# ===== 3. A helper that asks Supabase one question =====

def ask_supabase(path):
    # Build the request, with the token in the Authorization header.
    # The token proves to Supabase who is asking.
    request = urllib.request.Request(
        API + path,
        headers={"Authorization": "Bearer " + ACCESS_TOKEN},
    )

    # "with" opens the connection and closes it again by itself at the end.
    with urllib.request.urlopen(request, timeout=30) as response:
        # Read the answer and turn it from JSON text into Python data.
        return json.loads(response.read())


# ===== 4. The three checks =====

def main():
    # Stop early, with a clear message, if a secret is missing.
    if ACCESS_TOKEN == "" or DB_PASSWORD == "":
        print("A secret is missing: SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD")
        sys.exit(1)

    # Check 1: the project itself.
    project = ask_supabase("")
    print("Project:", project.get("name"))
    print("Region: ", project.get("region"))
    print("Status: ", project.get("status"))

    # Check 2: Supabase's own security advisor.
    advisors = ask_supabase("/advisors/security")
    # .get("lints", []) means: give me the list called "lints", or an empty
    # list if there is none.
    warnings = advisors.get("lints", [])
    print("Security warnings:", len(warnings))
    for warning in warnings:
        print("  -", warning.get("title"), "|", warning.get("level"))

    # Check 3: log in to the database through Supabase's connection pooler
    # (the front door that shares connections). GitHub's computers cannot
    # use the direct address, so we ask Supabase for the pooler's address.
    poolers = ask_supabase("/config/database/pooler")
    pooler = poolers[0]

    # Copy the current environment and add the password to it, so psql can
    # read it. The password is never put on the command line or printed.
    environment = dict(os.environ)
    environment["PGPASSWORD"] = DB_PASSWORD

    result = subprocess.run(
        [
            "psql",
            "--host", pooler["db_host"],
            "--port", "5432",
            "--username", pooler["db_user"],
            "--dbname", "postgres",
            "--tuples-only",
            "--command", "select version();",
        ],
        env=environment,
        capture_output=True,
        text=True,
    )

    # returncode 0 means psql worked. Anything else means it failed.
    if result.returncode != 0:
        print("Database login FAILED:", result.stderr.strip())
        sys.exit(1)

    print("Database login worked:", result.stdout.strip()[:60])
    print("All three checks passed.")


if __name__ == "__main__":
    main()
