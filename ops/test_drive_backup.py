# test_drive_backup.py: checks for drive_backup.py (request 226b).
#
# Run with: python3 -m unittest discover -s ops -p "test_*.py"

import base64
import hashlib
import os
import unittest

import drive_backup


class NamesTest(unittest.TestCase):

    # The year folder, and the month's file inside it.
    def test_month_names(self):
        self.assertEqual(drive_backup.names_for("2026-11"), ("2026", "2026-11 November.zip"))
        self.assertEqual(drive_backup.names_for("2027-01"), ("2027", "2027-01 January.zip"))


class UnsealTest(unittest.TestCase):

    # The key the Worker scrambled comes back out with the same secret.
    def test_unseal_opens_what_the_worker_sealed(self):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        key = hashlib.sha256(b"rhema-drive-key:client-secret").digest()
        start = os.urandom(12)
        sealed = AESGCM(key).encrypt(start, b"the-real-key", None)
        text = base64.b64encode(start + sealed).decode()
        self.assertEqual(drive_backup.unseal(text, "client-secret"), "the-real-key")

    # A wrong secret never opens it.
    def test_wrong_secret_fails(self):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        key = hashlib.sha256(b"rhema-drive-key:client-secret").digest()
        start = os.urandom(12)
        sealed = AESGCM(key).encrypt(start, b"k", None)
        text = base64.b64encode(start + sealed).decode()
        with self.assertRaises(Exception):
            drive_backup.unseal(text, "another-secret")


if __name__ == "__main__":
    unittest.main()
