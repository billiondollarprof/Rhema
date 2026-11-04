# uptime_watcher.py
#
# What this file does:
#   It is the AWS uptime watcher. Every 5 minutes AWS runs it. It opens each
#   hospital's address and its health check address, from outside Cloudflare,
#   and emails Anthony when a hospital stops answering, and again when it
#   answers again.
#
# Why it exists:
#   PLAN.md section 7. If Cloudflare has a bad day, the hospital's own
#   system cannot tell us. This watcher lives in StellaXafe's AWS account,
#   so it still can. One watcher checks every hospital in aws/sites.json.
#
# The rules it follows (Anthony, 2026-11-04):
#   - It emails only on a CHANGE: once when a hospital is down, once when it
#     is back. Never every run, and never again every 5 minutes while down.
#   - One failed check is ignored. A hospital counts as down only after 2
#     runs in a row fail (about 10 minutes), so a small blip stays quiet.
#   - Alerts go by email through AWS SNS (AWS's notification service), not
#     through Resend or Supabase, so they still arrive when the app is down.
#
# What it must never do:
#   Send a patient's name or any data. It opens public addresses and says
#   only "up" or "down" and why. It holds no secret: AWS gives it its rights.
#
# How it is tested:
#   aws/test_uptime_watcher.py runs the same logic with pretend websites, a
#   pretend database and pretend email. It runs inside `npm run verify`.


# ===== 1. Tools =====

# json turns text in JSON format into Python lists and dictionaries.
import json

# os lets us read the settings AWS gives this function (the table and the
# topic names).
import os

# time lets us pause for a moment between the two tries of one address.
import time

# urllib is Python's built in tool for opening a web address.
import urllib.error
import urllib.request

# datetime and timezone give us the time, so an email can say when it
# happened. "from X import Y" means: from the toolbox X, take only Y.
from datetime import datetime, timedelta, timezone

# ThreadPoolExecutor lets us check many hospitals at the same time, so the
# run stays short however many hospitals there are.
from concurrent.futures import ThreadPoolExecutor

# Path finds files next to this one.
from pathlib import Path


# ===== 2. Settings =====

# How many runs in a row must fail before we say a hospital is down.
FAILS_BEFORE_ALERT = 2

# How long to wait for one address to answer, in seconds.
TIMEOUT_SECONDS = 10

# How long to wait before the second try of an address, in seconds.
RETRY_PAUSE_SECONDS = 3

# How many hospitals to check at the same time.
CHECK_AT_ONCE = 10

# The name we give ourselves when we open an address.
USER_AGENT = "StellaXafe-Uptime-Watcher/1.0"

# Lagos is one hour ahead of UTC all year round.
LAGOS = timezone(timedelta(hours=1))


# ===== 3. Open one address =====


# "def" starts a function (a named set of steps we can run later).
# This one opens a web address and answers two things: what status number
# came back (200 means fine) and the text of the page.
def open_address(url):
    # Build the request, with our own name on it.
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    # "with ... as ..." opens something, uses it, and closes it again by
    # itself at the end.
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as answer:
        # Read at most 100,000 letters. A health answer is tiny.
        text = answer.read(100_000).decode("utf-8", errors="replace")
        # Hand back the status number and the text.
        return answer.status, text


# ===== 4. Is one address fine? =====


# This function asks: is this address fine? It answers a pair: True or
# False, and in plain words why not. "open_page" is the function that opens
# an address. The tests give it a pretend one, so nothing real is opened.
def check_address(url, expect_ok_json, open_page=open_address):
    # "try" runs the steps, and if one fails, "except" says what to do.
    # We try twice, because one failed try can be a blip.
    for attempt in (1, 2):
        try:
            status, text = open_page(url)
        # A web address that answers with an error number (404, 502...).
        except urllib.error.HTTPError as problem:
            why = f"answered with error {problem.code}"
        # Anything else: no answer at all, too slow, or a bad certificate.
        except Exception as problem:
            why = f"did not answer ({type(problem).__name__})"
        else:
            # It answered. Is it the right answer?
            if status != 200:
                why = f"answered with {status}"
            elif expect_ok_json and not _says_ok(text):
                why = "answered, but the health check did not say ok"
            else:
                return True, ""
        # Wait a moment before the second try.
        if attempt == 1:
            time.sleep(RETRY_PAUSE_SECONDS)
    # Both tries failed.
    return False, why


# The health check answers {"ok": true}. This asks: does the text say so?
def _says_ok(text):
    try:
        # json.loads turns the text into a Python dictionary.
        answer = json.loads(text)
    except ValueError:
        return False
    # isinstance asks: is this a dictionary? Then look for ok being true.
    return isinstance(answer, dict) and answer.get("ok") is True


# ===== 5. Check one hospital =====


# One hospital has two addresses to check: its front page and its health
# check. The hospital is up only when both are fine.
def check_site(site, open_page=open_address):
    # site is a dictionary like {"name": "Rhema live", "url": "https://..."}.
    # .get looks up a key, with a safe default if it is missing.
    base = site["url"].rstrip("/")
    health = base + site.get("health", "/api/health")
    # Start an empty list of problems. Each failed address adds one.
    problems = []
    for name, url, expect_ok_json in (("front page", base + "/", False), ("health check", health, True)):
        fine, why = check_address(url, expect_ok_json, open_page)
        if not fine:
            problems.append(f"The {name} {why}.")
    # Answer: the hospital's name, whether it is fine, and the problems.
    return {"name": site["name"], "ok": not problems, "why": " ".join(problems)}


# ===== 6. Decide what a result means (no AWS in here) =====


# This is the heart of the watcher. It takes what we remembered about a
# hospital (state) and what we just saw (ok), and answers two things: what
# to remember now, and whether to send an email ("down", "back" or None).
def next_state(state, ok):
    # state looks like {"fails": 0, "down": False}. A hospital we have never
    # seen starts with no failures and not down.
    fails = state.get("fails", 0)
    down = state.get("down", False)
    if ok:
        # It is fine now. If we had said it was down, say it is back.
        message = "back" if down else None
        return {"fails": 0, "down": False}, message
    # It failed this run. Count it.
    fails += 1
    # Alert only when it reaches the limit, and only once.
    if fails >= FAILS_BEFORE_ALERT and not down:
        return {"fails": fails, "down": True}, "down"
    return {"fails": fails, "down": down}, None


# ===== 7. Write the email =====


# The email says what happened, in whole sentences, with the time in Lagos.
# It returns the subject and the body.
def write_alert(result, kind, now=None):
    when = (now or datetime.now(timezone.utc)).astimezone(LAGOS).strftime("%d %b %Y, %H:%M")
    if kind == "down":
        subject = f"DOWN: {result['name']}"
        body = (
            f"{result['name']} has stopped answering.\n\n"
            f"{result['why']}\n\n"
            f"Seen at {when}, Lagos time, on {FAILS_BEFORE_ALERT} checks in a row.\n"
            "You will get one more email when it answers again."
        )
    else:
        subject = f"BACK UP: {result['name']}"
        body = f"{result['name']} is answering again.\n\nSeen at {when}, Lagos time."
    return subject, body


# ===== 8. The real AWS parts =====


# This remembers, for each hospital, how many checks failed and whether we
# already said it was down. It uses a DynamoDB table (AWS's small database).
# A "class" is a bundle of functions that belong together.
class DynamoState:
    def __init__(self, table_name):
        # boto3 is AWS's own toolbox for Python. AWS puts it in every Lambda
        # function, so it is brought in here and not at the top, which lets
        # the tests run on a computer that does not have it.
        import boto3

        self.client = boto3.client("dynamodb")
        self.table_name = table_name

    # Read what we remembered about one hospital.
    def get(self, name):
        found = self.client.get_item(TableName=self.table_name, Key={"site": {"S": name}})
        item = found.get("Item")
        if not item:
            return {}
        return {"fails": int(item["fails"]["N"]), "down": item["down"]["BOOL"]}

    # Remember something new about one hospital.
    def put(self, name, state):
        self.client.put_item(
            TableName=self.table_name,
            Item={
                "site": {"S": name},
                "fails": {"N": str(state["fails"])},
                "down": {"BOOL": state["down"]},
            },
        )


# This sends the email through SNS.
class SnsEmail:
    def __init__(self, topic_arn):
        import boto3

        self.client = boto3.client("sns")
        self.topic_arn = topic_arn

    def send(self, subject, body):
        self.client.publish(TopicArn=self.topic_arn, Subject=subject, Message=body)


# ===== 9. One full run =====


# Check every hospital, decide, and email when something changed. "state"
# remembers things, "alerts" sends emails; the tests give pretend ones.
def run_once(sites, state, alerts, open_page=open_address, now=None):
    # Check all the hospitals at the same time.
    with ThreadPoolExecutor(max_workers=CHECK_AT_ONCE) as pool:
        results = list(pool.map(lambda site: check_site(site, open_page), sites))
    for result in results:
        old = state.get(result["name"])
        new, kind = next_state(old, result["ok"])
        if kind:
            subject, body = write_alert(result, kind, now)
            try:
                alerts.send(subject, body)
            except Exception as problem:
                # The email did not go. Do NOT remember it as sent, so the
                # next run tries again. The log says what happened.
                print(f"ALERT NOT SENT for {result['name']}: {type(problem).__name__}")
                continue
        # Remember only when something is different from before.
        if new != {"fails": old.get("fails", 0), "down": old.get("down", False)}:
            state.put(result["name"], new)
        # One line in the log for every hospital, every run.
        print(f"{result['name']}: {'up' if result['ok'] else 'DOWN'} {result['why']}".strip())
    return results


# ===== 10. The door AWS calls =====


# Read the list of hospitals that sits next to this file.
def load_sites():
    text = (Path(__file__).parent / "sites.json").read_text(encoding="utf-8")
    return json.loads(text)["sites"]


# AWS calls this function every 5 minutes, with two things (event and
# context) that we do not need. {"test": true} only looks and reports: it
# remembers nothing and sends nothing. The deploy uses it to prove the
# watcher works. "open_page" is only ever given by the tests.
def handler(event, context, open_page=open_address):
    sites = load_sites()
    if isinstance(event, dict) and event.get("test"):
        with ThreadPoolExecutor(max_workers=CHECK_AT_ONCE) as pool:
            results = list(pool.map(lambda site: check_site(site, open_page), sites))
        return {"test": True, "results": results}
    state = DynamoState(os.environ["TABLE_NAME"])
    alerts = SnsEmail(os.environ["TOPIC_ARN"])
    results = run_once(sites, state, alerts, open_page)
    return {"test": False, "results": results}
