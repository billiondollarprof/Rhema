# copy_check.py
#
# What this file does:
#   It reads every screen file in the app and fails if it finds an em dash
#   (—) or an en dash (–). Anthony's rule is "no em dashes, ever", and this
#   check makes the computer enforce it, so nobody has to remember.
#
# How to run it:
#   python3 checks/copy_check.py
#   (It also runs inside `npm run verify` and in CI on every push.)
#
# What it must never do:
#   Change any file. It only reads and reports.


# ===== 1. Bring in the tools we need =====

# "import" means: load a toolbox that comes with Python.
# "sys" lets the script tell the computer "I failed" or "I passed" at the end.
import sys

# "pathlib" gives us Path, a tool for finding and reading files.
# "from X import Y" means: from the toolbox X, take only the tool Y.
from pathlib import Path


# ===== 2. Settings =====

# A list (a row of values inside square brackets) of the folders to check.
# These hold the text that hospital staff will read on screen.
FOLDERS_TO_CHECK = ["web/app", "web/components"]

# The kinds of file to read. A file ending in .tsx is a screen.
FILE_ENDINGS = [".tsx", ".ts", ".css"]

# A dictionary (a list of pairs: a thing, and its name) of the forbidden
# characters. The left side is the character, the right side is its name,
# used in the error message.
FORBIDDEN = {
    "—": "em dash",
    "–": "en dash",
}


# ===== 3. The check itself =====

# "def" starts a function (a named set of steps we can run later).
# This function looks inside one file and returns a list of the problems.
def find_problems_in_file(file_path):
    # Start with an empty list. Each problem we find gets added to it.
    problems = []

    # Read the whole file as text. utf-8 is the standard way text is stored.
    text = file_path.read_text(encoding="utf-8")

    # Split the text into lines, so we can say which line has the problem.
    # enumerate gives us each line together with its number, starting at 1.
    for line_number, line in enumerate(text.splitlines(), start=1):
        # Go through each forbidden character, one at a time.
        # .items() gives us both sides of each pair in the dictionary.
        for character, name in FORBIDDEN.items():
            # "in" asks: does this line contain the character?
            if character in line:
                # An f-string (text starting with f) lets us put values
                # inside curly brackets straight into the sentence.
                problems.append(f"{file_path}:{line_number}: {name} found")

    # Hand the list of problems back to whoever called this function.
    return problems


# ===== 4. Go through every file =====

def main():
    all_problems = []
    files_checked = 0

    for folder in FOLDERS_TO_CHECK:
        folder_path = Path(folder)

        # If a folder does not exist yet, skip it quietly.
        # "continue" means: jump to the next folder in the list.
        if not folder_path.exists():
            continue

        # rglob("*") finds every file inside the folder, and inside every
        # folder within it too.
        for file_path in folder_path.rglob("*"):
            # .suffix is the ending of the file name, like ".tsx".
            if file_path.suffix in FILE_ENDINGS:
                files_checked = files_checked + 1
                # extend adds every item from one list onto another.
                all_problems.extend(find_problems_in_file(file_path))

    # ===== 5. Report =====

    # len() counts how many items a list has.
    if len(all_problems) > 0:
        for problem in all_problems:
            print(problem)
        print(f"copy check FAILED: {len(all_problems)} problem(s) in {files_checked} files")
        # Exit with 1, which tells npm and CI that this check failed.
        sys.exit(1)

    print(f"copy check passed: {files_checked} files, no em or en dashes")


# This line means: only run main() when the file is run directly, and not
# when another Python file borrows something from it.
if __name__ == "__main__":
    main()
