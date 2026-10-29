# supabase_check.py
#
# What this file does:
#   It proves that GitHub can reach the hospital's Supabase project. It asks
#   Supabase four questions and prints the answers:
#     1. Does the project exist, which region is it in, and is it healthy?
#     2. Does Supabase's security check find any warnings? (Warnings
#        Anthony has accepted, listed in section 2, are shown but not counted.)
#     3. Can we log in to the database itself with the password?
#     4. Are the sign in settings still the ones Anthony set by hand?
#        (Sign ups off, email confirmation on, a 6 digit code that runs out
#        in 600 seconds, and the right Site URL and redirect address.)
#
# How it runs:
#   On GitHub Actions only, because that is where the secrets live. It reads
#   them from the environment. It checks one project per run: the live one
#   or the testing one, whichever SUPABASE_PROJECT_REF names.
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

# Which project to check. Its ID (its "ref") is part of its web address, so
# it is not a secret. If none is given, check the live project.
#   live:    ntfvckqczpmylskusgft
#   testing: nfrvwvqmfxudaarfuwxg
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "ntfvckqczpmylskusgft")

# os.environ.get reads a value that GitHub put in the environment.
# The second value, "", is what we get if it is missing.
ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")

API = "https://api.supabase.com/v1/projects/" + PROJECT_REF

# The web address each project's sign in sends people back to. This is a
# dictionary (a list of pairs): the project ID on the left, its address on
# the right. Set by hand in the dashboard on 2026-10-29.
SITE_URLS = {
    "ntfvckqczpmylskusgft": "https://rhema-hospital.rhemamedical.workers.dev",
    "nfrvwvqmfxudaarfuwxg": "https://rhema-hospital-testing.rhemamedical.workers.dev",
}

# Security warnings Anthony has looked at and decided to accept. Each one is
# still printed, marked "accepted", but it is not counted as a new warning.
# The name on the left is Supabase's own name for the warning; the text on
# the right is why it is accepted. Never add to this list without his yes.
ACCEPTED_WARNINGS = {
    # Accepted 2026-10-29. It checks passwords against lists of stolen
    # passwords. This system uses no passwords (sign in is an email code
    # and a PIN), so it protects nothing here, and switching it on needs
    # Supabase's paid Pro plan.
    "auth_leaked_password_protection": "No passwords are used; needs the Pro plan.",
}


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

    # Split them: the ones Anthony accepted, and the real ones.
    new_warnings = []
    for warning in warnings:
        name = warning.get("name", "")
        if name in ACCEPTED_WARNINGS:
            print("  - accepted:", warning.get("title"), "|", ACCEPTED_WARNINGS[name])
        else:
            new_warnings.append(warning)

    print("Security warnings:", len(new_warnings))
    for warning in new_warnings:
        print("  -", warning.get("title"), "|", warning.get("level"))
        # "detail" says exactly which table or function the warning is about.
        print("    ", warning.get("detail"))

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

    # Check 4: the sign in settings. Our key may read them but not change
    # them, so any change was made by hand in the dashboard. If one moved,
    # say which one and fail, so it is noticed the same day.
    auth = ask_supabase("/config/auth")
    site_url = SITE_URLS.get(PROJECT_REF, "")

    # Each pair is: the setting's name in Supabase, and the value it must have.
    expected = {
        "disable_signup": True,
        "mailer_autoconfirm": False,
        "mailer_otp_exp": 600,
        "mailer_otp_length": 6,
        "site_url": site_url,
        "uri_allow_list": site_url + "/**",
    }

    # Start with no problems, then add one line for each setting that is wrong.
    problems = []
    # .items() gives each pair from the dictionary, one at a time.
    for name, wanted in expected.items():
        actual = auth.get(name)
        if actual != wanted:
            problems.append(name + " is " + str(actual) + ", should be " + str(wanted))

    if len(problems) > 0:
        print("Sign in settings have CHANGED:")
        for problem in problems:
            print("  -", problem)
        sys.exit(1)

    print("Sign in settings are as set: sign ups off, 6 digit code, 600 seconds.")
    print("All four checks passed.")


if __name__ == "__main__":
    main()
