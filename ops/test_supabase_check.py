# test_supabase_check.py
#
# What this file does:
#   It tests the sign in address rule of ops/supabase_check.py with pretend
#   settings. No Supabase is asked and no secret is needed.
#
# How to run it:
#   python3 -m unittest discover -s ops -p "test_*.py"
#   (It also runs inside `npm run verify` and in CI on every push.)
#
# What it must never do:
#   Call Supabase or read a secret.

# unittest is Python's built in tool for tests.
import unittest

# The file being tested. unittest runs from this folder, so it is found. It
# reads its settings from the environment when loaded, and none are needed.
import supabase_check as check

OLD = "https://old.example"
NEW = "https://new.example"


# Builds pretend Supabase settings.
def settings(site_url, allow):
    return {"site_url": site_url, "uri_allow_list": allow}


class AddressRule(unittest.TestCase):
    def test_today_s_settings_pass(self):
        auth = settings(OLD, OLD + "/**")
        self.assertEqual(check.address_problems(auth, OLD, NEW), [])

    def test_both_addresses_pass_in_any_order(self):
        for allow in (OLD + "/**," + NEW + "/**", NEW + "/**, " + OLD + "/**"):
            auth = settings(OLD, allow)
            self.assertEqual(check.address_problems(auth, OLD, NEW), [], allow)

    def test_a_stray_comma_or_space_is_harmless(self):
        for allow in (OLD + "/**,", " " + OLD + "/** ,", ",," + OLD + "/**"):
            auth = settings(OLD, allow)
            self.assertEqual(check.address_problems(auth, OLD, NEW), [], allow)

    def test_the_new_address_alone_passes_after_the_move(self):
        auth = settings(NEW, NEW + "/**")
        self.assertEqual(check.address_problems(auth, OLD, NEW), [])

    def test_another_site_url_fails(self):
        auth = settings("https://evil.example", OLD + "/**")
        problems = check.address_problems(auth, OLD, NEW)
        self.assertTrue(any("site_url" in problem for problem in problems))

    def test_a_stranger_in_the_list_fails(self):
        auth = settings(OLD, OLD + "/**,https://evil.example/**")
        problems = check.address_problems(auth, OLD, NEW)
        self.assertTrue(any("evil.example" in problem for problem in problems))

    def test_a_wildcard_for_everybody_fails(self):
        for allow in (OLD + "/**,https://**", OLD + "/**,*", OLD + "/**,https://*.example/**"):
            problems = check.address_problems(settings(OLD, allow), OLD, NEW)
            self.assertTrue(problems, allow)

    def test_an_address_without_the_double_star_fails(self):
        auth = settings(OLD, OLD + "/**," + NEW)
        problems = check.address_problems(auth, OLD, NEW)
        self.assertTrue(any(NEW in problem for problem in problems))

    def test_an_empty_list_fails(self):
        for allow in ("", None, " , "):
            problems = check.address_problems(settings(OLD, allow), OLD, NEW)
            self.assertTrue(problems, repr(allow))

    def test_the_site_url_must_be_in_the_list(self):
        auth = settings(NEW, OLD + "/**")
        problems = check.address_problems(auth, OLD, NEW)
        self.assertTrue(any("does not hold" in problem for problem in problems))

    def test_a_missing_site_url_fails(self):
        problems = check.address_problems({"uri_allow_list": OLD + "/**"}, OLD, NEW)
        self.assertTrue(any("site_url" in problem for problem in problems))


class RealAddresses(unittest.TestCase):
    def test_every_project_has_two_secure_addresses(self):
        for ref, pair in check.SITES.items():
            self.assertEqual(set(pair), {"old", "new"}, ref)
            for address in pair.values():
                self.assertTrue(address.startswith("https://"), address)
                self.assertFalse(address.endswith("/"), address)

    def test_live_and_testing_never_share_an_address(self):
        addresses = [address for pair in check.SITES.values() for address in pair.values()]
        self.assertEqual(len(addresses), len(set(addresses)))



# ===== The email wording rule =====

GOOD = "<div>Use this code: {{ .Token }}</div>"


# Builds pretend settings for the two emails.
def emails(magic=GOOD, confirm=GOOD, subject=check.EMAIL_SUBJECT):
    return {
        "mailer_templates_magic_link_content": magic,
        "mailer_templates_confirmation_content": confirm,
        "mailer_subjects_magic_link": subject,
        "mailer_subjects_confirmation": subject,
    }


class EmailRule(unittest.TestCase):
    def test_both_emails_with_the_code_pass(self):
        self.assertEqual(check.template_problems(emails()), [])

    def test_supabase_s_own_confirm_link_fails(self):
        default = '<a href="{{ .ConfirmationURL }}">Confirm your mail</a>'
        problems = check.template_problems(emails(confirm=default))
        self.assertEqual(len(problems), 2)
        self.assertTrue(all("Confirm signup" in p for p in problems))

    def test_a_magic_link_without_the_code_fails(self):
        problems = check.template_problems(emails(magic="<p>Hello</p>"))
        self.assertEqual(problems, ["Magic link email has no sign in code ({{ .Token }})"])

    def test_a_code_with_a_link_beside_it_fails(self):
        both = GOOD + '<a href="{{ .ConfirmationURL }}">or tap</a>'
        self.assertEqual(len(check.template_problems(emails(magic=both))), 1)

    def test_the_wrong_subject_fails(self):
        self.assertEqual(len(check.template_problems(emails(subject="Confirm Your Signup"))), 2)

    def test_missing_settings_fail(self):
        self.assertEqual(len(check.template_problems({})), 4)


if __name__ == "__main__":
    unittest.main()
