# drive_backup.py
#
# What this file does:
#   Puts this month's text backup (a zip of spreadsheets) into the
#   hospital's own Google Drive, in folders year by year:
#     <Hospital> backups / 2026 / 2026-11 November.zip
#   (request 226b, Anthony 2026-11-17: "create folders year by year...
#   inside of year 2026, a zip file month by month").
#
# How it runs:
#   On GitHub Actions, from .github/workflows/drive-backup.yml, after that
#   workflow has made the zip. It reads from the environment:
#     KEY_SEALED            the hospital's Google key, scrambled
#     GOOGLE_CLIENT_ID      the StellaXafe Google app
#     GOOGLE_CLIENT_SECRET  (also what unscrambles the key)
#     ZIP_PATH, MONTH       the zip, and its month, e.g. 2026-11
#     TOP_FOLDER            e.g. "RHEMA backups"
#   The same name in the same folder is replaced, so running twice is safe.
#
# What it must never do:
#   Print the key, a token or anything inside the zip. It prints only the
#   file's name and size.


# ===== 1. Tools =====

# base64 turns text such as "q83k..." back into raw bytes.
import base64
# hashlib makes a fingerprint (SHA-256) of some text.
import hashlib
# json reads and writes the answers Google sends.
import json
import os
import sys
# urllib is Python's own toolbox for talking to websites.
import urllib.parse
import urllib.request

# The month names, so 11 becomes "November".
MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


# ===== 2. The file's name and its year folder =====

def names_for(month):
    # month is text like "2026-11". split("-") cuts it at the dash.
    year, number = month.split("-")
    # int("11") turns the text into the number 11; the list counts from 0.
    word = MONTHS[int(number) - 1]
    # The year folder, and the file inside it.
    return year, f"{month} {word}.zip"


# ===== 3. Unscramble the key =====

def unseal(sealed, client_secret):
    # The same secret key the Worker used: SHA-256 of a label and the secret.
    # .digest() gives the 32 raw bytes of the fingerprint.
    key = hashlib.sha256(f"rhema-drive-key:{client_secret}".encode()).digest()
    raw = base64.b64decode(sealed)
    # The first 12 bytes are the start value; the rest is the sealed key.
    # raw[:12] means "from the start up to byte 12"; raw[12:] the rest.
    start, body = raw[:12], raw[12:]
    # AESGCM comes from the cryptography library, installed by the
    # workflow. It is loaded here, only when needed.
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return AESGCM(key).decrypt(start, body, None).decode()


# ===== 4. Talking to Google =====

def call(url, data=None, token=None, method=None, headers=None, raw=None):
    # One request to Google. data: form fields; raw: bytes sent as they are.
    all_headers = dict(headers or {})
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        all_headers["Content-Type"] = "application/x-www-form-urlencoded"
    if raw is not None:
        body = raw
    if token:
        all_headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=body, headers=all_headers, method=method)
    with urllib.request.urlopen(request, timeout=120) as answer:
        return json.loads(answer.read() or b"{}")


def access_token(refresh_key, client_id, client_secret):
    # Trade the long lived key for a key that works for one hour.
    answer = call("https://oauth2.googleapis.com/token", data={
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_key,
        "grant_type": "refresh_token",
    })
    return answer["access_token"]


def find(token, name, parent, folder):
    # Look for one item by name in a folder ("root" is the top of the Drive).
    kind = "mimeType = 'application/vnd.google-apps.folder'" if folder else \
        "mimeType != 'application/vnd.google-apps.folder'"
    # A ' inside a name would break the question, so it is escaped.
    safe = name.replace("'", "\\'")
    question = f"name = '{safe}' and '{parent}' in parents and trashed = false and {kind}"
    url = "https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode({
        "q": question, "fields": "files(id)", "spaces": "drive",
    })
    files = call(url, token=token).get("files", [])
    # The first one found, or None (Python's "nothing").
    return files[0]["id"] if files else None


def folder(token, name, parent):
    # The folder if it is there; otherwise it is made.
    found = find(token, name, parent, True)
    if found:
        return found
    made = call(
        "https://www.googleapis.com/drive/v3/files",
        token=token,
        method="POST",
        headers={"Content-Type": "application/json"},
        raw=json.dumps({
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent],
        }).encode(),
    )
    return made["id"]


def upload(token, path, name, parent):
    # Read the whole zip into memory: a month of text is a few MB.
    with open(path, "rb") as file:
        content = file.read()
    existing = find(token, name, parent, False)
    if existing:
        # The same month again: its content is replaced, not doubled.
        call(
            f"https://www.googleapis.com/upload/drive/v3/files/{existing}?uploadType=media",
            token=token, method="PATCH",
            headers={"Content-Type": "application/zip"}, raw=content,
        )
        return len(content)
    # A new file: its name and folder, then its content, in one request.
    edge = "rhema-backup-part"
    about = json.dumps({"name": name, "parents": [parent]}).encode()
    body = (
        f"--{edge}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".encode()
        + about
        + f"\r\n--{edge}\r\nContent-Type: application/zip\r\n\r\n".encode()
        + content
        + f"\r\n--{edge}--".encode()
    )
    call(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        token=token, method="POST",
        headers={"Content-Type": f"multipart/related; boundary={edge}"}, raw=body,
    )
    return len(content)


# ===== 5. The whole job =====

def main():
    environment = os.environ
    month = environment.get("MONTH", "")
    year, name = names_for(month)
    refresh_key = unseal(environment["KEY_SEALED"], environment["GOOGLE_CLIENT_SECRET"])
    token = access_token(refresh_key, environment["GOOGLE_CLIENT_ID"],
                         environment["GOOGLE_CLIENT_SECRET"])
    top = folder(token, environment.get("TOP_FOLDER", "Hospital backups"), "root")
    year_folder = folder(token, year, top)
    size = upload(token, environment["ZIP_PATH"], name, year_folder)
    # Only the name and the size: nothing inside the zip.
    print(f"Saved to Google Drive: {year}/{name} ({size} bytes)")
    # The name, for the workflow to write in the database.
    return name


if __name__ == "__main__":
    try:
        main()
    except Exception as problem:
        # Only the kind of problem, never a key or a token.
        print(f"FAILED: {type(problem).__name__}")
        sys.exit(1)
