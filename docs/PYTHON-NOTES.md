# Python notes

Every Python idea used in this repo, in the order it first appeared, with
the file where you can see it working. Read this to revise.

| Idea | Plain meaning | First seen in |
|---|---|---|
| `#` comment | A note for people. Python skips it. | `checks/copy_check.py` |
| `import` | Load a toolbox that comes with Python. | `checks/copy_check.py` |
| `from X import Y` | From toolbox X, take only tool Y. | `checks/copy_check.py` |
| list `[...]` | A row of values, in order. | `checks/copy_check.py` |
| dictionary `{a: b}` | A list of pairs: a thing, and its name or value. | `checks/copy_check.py` |
| `def` | Start a function: a named set of steps to run later. | `checks/copy_check.py` |
| `for ... in ...` | Do the same steps once for each item. | `checks/copy_check.py` |
| `enumerate` | Give each item together with its number. | `checks/copy_check.py` |
| `if` | Only do the next steps when something is true. | `checks/copy_check.py` |
| `in` | Ask: is this inside that? | `checks/copy_check.py` |
| f-string `f"..."` | Text with values dropped in through `{curly brackets}`. | `checks/copy_check.py` |
| `return` | Hand an answer back from a function. | `checks/copy_check.py` |
| `continue` | Skip to the next item in the loop. | `checks/copy_check.py` |
| `len()` | Count the items in a list. | `checks/copy_check.py` |
| `sys.exit(1)` | Stop and tell the computer "this failed". | `checks/copy_check.py` |
| `if __name__ == "__main__":` | Only run this when the file is run directly. | `checks/copy_check.py` |
| `os.environ.get("NAME", "")` | Read a value GitHub put in the environment, or `""` if it is missing. | `ops/supabase_check.py` |
| `with ... as ...:` | Open something, use it, and close it again by itself at the end. | `ops/supabase_check.py` |
| `json.loads(text)` | Turn JSON text into Python lists and dictionaries. | `ops/supabase_check.py` |
| `.get("key", [])` on a dictionary | Look up a key, with a safe default if it is not there. | `ops/supabase_check.py` |
| `list[0]` | The first item in a list. Counting starts at 0. | `ops/supabase_check.py` |
| `subprocess.run([...])` | Run another program from Python and collect its answer. | `ops/supabase_check.py` |
| `!=` | "Is not equal to". | `ops/supabase_check.py` |
| `[]` then `.append(x)` | Start an empty list, then add one item to its end. | `ops/supabase_check.py` |
| `.items()` on a dictionary | Give each pair (the name and its value) one at a time, for a loop. | `ops/supabase_check.py` |
| `str(x)` | Turn a number or `True`/`False` into text, so it can join other text. | `ops/supabase_check.py` |
| `if ... else` | Do one set of steps when something is true, and the other set when it is not. | `ops/supabase_check.py` |
| `try` ... `except` | Try some steps. If one fails, run the `except` steps instead of stopping. | `aws/uptime_watcher.py` |
| `try` ... `else` | Steps that run only when the `try` did not fail. | `aws/uptime_watcher.py` |
| default value in a function, `name=value` | If nobody gives this value, use the one written here. | `aws/uptime_watcher.py` |
| a function as a value | A function can be handed to another function, like a tool passed along. The tests hand in a pretend one. | `aws/uptime_watcher.py` |
| `lambda site: ...` | A tiny function written in one line, with no name. | `aws/uptime_watcher.py` |
| `class` | A bundle of functions and values that belong together. `self` means this bundle. | `aws/uptime_watcher.py` |
| `isinstance(x, dict)` | Ask: is this a dictionary? | `aws/uptime_watcher.py` |
| `ThreadPoolExecutor` and `.map` | Do the same job for many items at the same time, then collect the answers in order. | `aws/uptime_watcher.py` |
| `unittest` | Python's own tool for tests: each test is a function that checks one thing. | `aws/test_uptime_watcher.py` |
