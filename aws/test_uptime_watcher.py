# test_uptime_watcher.py
#
# What this file does:
#   It tests aws/uptime_watcher.py with pretend websites, a pretend memory
#   and pretend email, so no real address is opened and no email is sent.
#
# How to run it:
#   python3 -m unittest discover -s aws -p "test_*.py"
#   (It also runs inside `npm run verify` and in CI on every push.)
#
# What it must never do:
#   Open a real address or use a real AWS account.


# ===== 1. Tools =====

# json reads aws/sites.json, so the real list is checked too.
import contextlib
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# time lets the pretend slow page keep us waiting.
import time

# unittest is Python's built in tool for tests.
import unittest

# urllib.error lets a pretend page fail the way a real one does.
import urllib.error

# Path finds the real sites.json next to this file.
from pathlib import Path

# The file being tested. unittest runs from this folder, so it is found.
import uptime_watcher as watcher

# The watcher pauses between two tries. In tests there is no waiting.
watcher.RETRY_PAUSE_SECONDS = 0


# ===== 2. Pretend parts =====


# A pretend web: a dictionary of address -> what it answers. An answer is
# (status, text), or an exception to raise.
def pretend_web(answers):
    def open_page(url):
        answer = answers[url]
        if isinstance(answer, Exception):
            raise answer
        return answer

    return open_page


# A pretend web where every address fails the same way.
def pretend_web_all(problem):
    def open_page(url):
        raise problem

    return open_page


# A pretend memory.
class FakeState:
    def __init__(self):
        self.saved = {}
        self.writes = 0

    def get(self, name):
        return dict(self.saved.get(name, {}))

    def put(self, name, state):
        self.saved[name] = dict(state)
        self.writes += 1


# A pretend email sender that keeps what it was asked to send.
class FakeEmail:
    def __init__(self, fail=False):
        self.sent = []
        self.fail = fail

    def send(self, subject, body):
        if self.fail:
            raise RuntimeError("SNS is down")
        self.sent.append((subject, body))


SITE = {"name": "Rhema live", "url": "https://rhema.example"}
FRONT = "https://rhema.example/"
HEALTH = "https://rhema.example/api/health"
UP = {FRONT: (200, "<html>hello</html>"), HEALTH: (200, '{"ok": true}')}


# ===== 2b. A tiny real web server, on this computer only =====


# It answers /ok with {"ok": true} (and remembers who asked), /big with a long
# text, /slow after 2 seconds, and anything else with error 404. Nothing
# leaves this computer.
class TinyServer:
    def __enter__(self):
        asked_by = self.asked_by = []

        class Answers(BaseHTTPRequestHandler):
            def do_GET(self):
                asked_by.append(self.headers.get("User-Agent"))
                if self.path == "/slow":
                    time.sleep(2)
                    body, status = b"late", 200
                elif self.path == "/ok":
                    body, status = b'{"ok": true}', 200
                elif self.path == "/big":
                    body, status = b"x" * 200_000, 200
                else:
                    body, status = b"nothing here", 404
                self.send_response(status)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Answers)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        return self

    def __exit__(self, *args):
        self.server.shutdown()
        self.server.server_close()


class OpenAddress(unittest.TestCase):
    def test_it_opens_an_address_with_its_own_name_on_it(self):
        with TinyServer() as web:
            status, text = watcher.open_address(web.base + "/ok")
        self.assertEqual((status, text), (200, '{"ok": true}'))
        self.assertEqual(web.asked_by, [watcher.USER_AGENT])

    def test_an_error_page_raises_so_it_counts_as_a_failure(self):
        with TinyServer() as web:
            with self.assertRaises(urllib.error.HTTPError):
                watcher.open_address(web.base + "/missing")

    def test_it_reads_a_whole_health_answer_but_not_a_huge_page(self):
        with TinyServer() as web:
            _, text = watcher.open_address(web.base + "/big")
        self.assertEqual(len(text), 100_000)

    def test_a_page_that_is_too_slow_is_given_up_on(self):
        original = watcher.TIMEOUT_SECONDS
        watcher.TIMEOUT_SECONDS = 0.3
        try:
            with TinyServer() as web:
                started = time.monotonic()
                with self.assertRaises(Exception):
                    watcher.open_address(web.base + "/slow")
                self.assertLess(time.monotonic() - started, 1.5)
        finally:
            watcher.TIMEOUT_SECONDS = original

    def test_a_real_check_of_a_real_looking_site_end_to_end(self):
        with TinyServer() as web:
            fine, _ = watcher.check_address(web.base + "/ok", True)
            missing, why = watcher.check_address(web.base + "/missing", False)
        self.assertTrue(fine)
        self.assertFalse(missing)
        self.assertIn("404", why)


# ===== 3. Opening one address =====


class CheckAddress(unittest.TestCase):
    def test_a_fine_page(self):
        self.assertEqual(watcher.check_address(FRONT, False, pretend_web(UP)), (True, ""))

    def test_an_error_number_is_a_failure(self):
        web = pretend_web({FRONT: urllib.error.HTTPError(FRONT, 502, "Bad", None, None)})
        fine, why = watcher.check_address(FRONT, False, web)
        self.assertFalse(fine)
        self.assertIn("502", why)

    def test_no_answer_is_a_failure(self):
        web = pretend_web({FRONT: TimeoutError()})
        fine, why = watcher.check_address(FRONT, False, web)
        self.assertFalse(fine)
        self.assertIn("did not answer", why)

    def test_a_200_that_is_not_ok_json_fails_the_health_check(self):
        for text in ('{"ok": false}', "not json", "[]", '{"fine": true}'):
            web = pretend_web({HEALTH: (200, text)})
            self.assertFalse(watcher.check_address(HEALTH, True, web)[0], text)

    def test_a_non_200_is_a_failure_even_with_good_text(self):
        web = pretend_web({FRONT: (503, "<html>hello</html>")})
        self.assertFalse(watcher.check_address(FRONT, False, web)[0])

    def test_any_status_but_200_is_a_failure(self):
        for status in (204, 301, 401, 403, 404, 429, 500, 503):
            web = pretend_web({FRONT: (status, "<html>hello</html>")})
            self.assertFalse(watcher.check_address(FRONT, False, web)[0], status)

    def test_it_waits_between_the_two_tries_only_when_the_first_failed(self):
        waits = []
        original = watcher.time.sleep
        watcher.time.sleep = waits.append
        try:
            watcher.check_address(FRONT, False, pretend_web(UP))
            self.assertEqual(waits, [])
            watcher.check_address(FRONT, False, pretend_web_all(TimeoutError()))
            self.assertEqual(waits, [watcher.RETRY_PAUSE_SECONDS])
        finally:
            watcher.time.sleep = original

    def test_one_blip_is_forgiven_inside_a_run(self):
        calls = []

        def flaky(url):
            calls.append(url)
            if len(calls) == 1:
                raise TimeoutError()
            return 200, "ok"

        self.assertEqual(watcher.check_address(FRONT, False, flaky), (True, ""))
        self.assertEqual(len(calls), 2)


# ===== 4. One hospital =====


class CheckSite(unittest.TestCase):
    def test_up_when_both_addresses_are_fine(self):
        self.assertTrue(watcher.check_site(SITE, pretend_web(UP))["ok"])

    def test_down_when_only_the_health_check_fails(self):
        answers = dict(UP)
        answers[HEALTH] = (500, "")
        result = watcher.check_site(SITE, pretend_web(answers))
        self.assertFalse(result["ok"])
        self.assertIn("health check", result["why"])
        self.assertNotIn("front page", result["why"])

    def test_down_when_only_the_front_page_fails(self):
        answers = dict(UP)
        answers[FRONT] = (500, "")
        result = watcher.check_site(SITE, pretend_web(answers))
        self.assertFalse(result["ok"])
        self.assertIn("front page", result["why"])

    def test_a_trailing_slash_in_the_address_is_fine(self):
        site = {"name": "x", "url": "https://rhema.example/"}
        self.assertTrue(watcher.check_site(site, pretend_web(UP))["ok"])


# ===== 5. What a result means =====


class NextState(unittest.TestCase):
    def test_one_failure_is_quiet(self):
        state, message = watcher.next_state({}, False)
        self.assertEqual((state, message), ({"fails": 1, "down": False}, None))

    def test_two_failures_in_a_row_say_down_once(self):
        state, _ = watcher.next_state({}, False)
        state, message = watcher.next_state(state, False)
        self.assertEqual((state, message), ({"fails": 2, "down": True}, "down"))

    def test_a_third_failure_does_not_say_it_again(self):
        state = {"fails": 2, "down": True}
        for _ in range(5):
            state, message = watcher.next_state(state, False)
            self.assertIsNone(message)
            self.assertTrue(state["down"])

    def test_recovery_says_back_once(self):
        state, message = watcher.next_state({"fails": 3, "down": True}, True)
        self.assertEqual((state, message), ({"fails": 0, "down": False}, "back"))
        state, message = watcher.next_state(state, True)
        self.assertIsNone(message)

    def test_a_blip_between_good_runs_is_forgotten(self):
        state, _ = watcher.next_state({}, False)
        state, message = watcher.next_state(state, True)
        self.assertEqual((state, message), ({"fails": 0, "down": False}, None))
        state, message = watcher.next_state(state, False)
        self.assertIsNone(message)

    def test_being_fine_says_nothing(self):
        self.assertEqual(watcher.next_state({}, True), ({"fails": 0, "down": False}, None))


# ===== 6. A full run =====


class RunOnce(unittest.TestCase):
    def run_with(self, web, state, email, sites=(SITE,)):
        # The watcher prints one line per hospital; keep the test output quiet.
        with contextlib.redirect_stdout(io.StringIO()):
            return watcher.run_once(list(sites), state, email, pretend_web(web))

    def test_a_fine_hospital_sends_nothing_and_writes_nothing(self):
        state, email = FakeState(), FakeEmail()
        self.run_with(UP, state, email)
        self.assertEqual(email.sent, [])
        self.assertEqual(state.writes, 0)

    def test_down_for_three_runs_then_back_is_exactly_two_emails(self):
        state, email = FakeState(), FakeEmail()
        broken = dict(UP)
        broken[HEALTH] = (500, "")
        for web in (broken, broken, broken, UP, UP):
            self.run_with(web, state, email)
        self.assertEqual([subject for subject, _ in email.sent], ["DOWN: Rhema live", "BACK UP: Rhema live"])

    def test_the_down_email_says_which_address_and_when(self):
        state, email = FakeState(), FakeEmail()
        broken = dict(UP)
        broken[HEALTH] = (500, "")
        self.run_with(broken, state, email)
        self.run_with(broken, state, email)
        subject, body = email.sent[0]
        self.assertIn("health check", body)
        self.assertIn("Lagos time", body)
        self.assertIn("answers again", body)

    def test_one_hospital_down_does_not_alert_for_another(self):
        other = {"name": "Other hospital", "url": "https://other.example"}
        web = dict(UP)
        web.update({"https://other.example/": (200, "x"), "https://other.example/api/health": (200, '{"ok": true}')})
        broken = dict(web)
        broken[HEALTH] = (500, "")
        state, email = FakeState(), FakeEmail()
        for _ in range(2):
            self.run_with(broken, state, email, sites=(SITE, other))
        self.assertEqual([subject for subject, _ in email.sent], ["DOWN: Rhema live"])
        self.assertNotIn("Other hospital", state.saved)

    def test_a_failed_email_is_tried_again_next_run(self):
        state = FakeState()
        broken = dict(UP)
        broken[HEALTH] = (500, "")
        self.run_with(broken, state, FakeEmail(fail=True))
        self.run_with(broken, state, FakeEmail(fail=True))
        self.assertFalse(state.saved.get("Rhema live", {}).get("down", False))
        working = FakeEmail()
        self.run_with(broken, state, working)
        self.assertEqual([subject for subject, _ in working.sent], ["DOWN: Rhema live"])


# ===== 7. The door AWS calls =====


class Handler(unittest.TestCase):
    # Every address of the real list, answering fine.
    def fine_web(self):
        answers = {}
        for site in watcher.load_sites():
            base = site["url"].rstrip("/")
            answers[base + "/"] = (200, "x")
            answers[base + "/api/health"] = (200, '{"ok": true}')
        return pretend_web(answers)

    def test_test_mode_only_looks(self):
        # In test mode nothing may touch AWS. boto3 is not on this computer,
        # so touching it would stop the test.
        answer = watcher.handler({"test": True}, None, self.fine_web())
        self.assertTrue(answer["test"])
        self.assertEqual(len(answer["results"]), len(watcher.load_sites()))
        self.assertTrue(all(result["ok"] for result in answer["results"]))

    def test_test_mode_reports_a_hospital_that_is_down(self):
        answer = watcher.handler({"test": True}, None, pretend_web_all(TimeoutError()))
        self.assertTrue(all(not result["ok"] for result in answer["results"]))

    def test_the_real_run_needs_its_settings_from_aws(self):
        # No TABLE_NAME, so a real run refuses at once instead of guessing.
        with self.assertRaises(KeyError):
            watcher.handler({}, None, self.fine_web())


# ===== 8. The real list of hospitals =====


class RealList(unittest.TestCase):
    def setUp(self):
        text = (Path(__file__).parent / "sites.json").read_text(encoding="utf-8")
        self.sites = json.loads(text)["sites"]

    def test_there_is_at_least_one_hospital(self):
        self.assertGreaterEqual(len(self.sites), 1)

    def test_every_hospital_has_a_name_and_a_secure_address(self):
        for site in self.sites:
            self.assertTrue(site["name"].strip())
            self.assertTrue(site["url"].startswith("https://"), site["url"])

    def test_names_are_not_repeated(self):
        names = [site["name"] for site in self.sites]
        self.assertEqual(len(names), len(set(names)))

    def test_the_watcher_reads_the_same_list(self):
        self.assertEqual(watcher.load_sites(), self.sites)


if __name__ == "__main__":
    unittest.main()
