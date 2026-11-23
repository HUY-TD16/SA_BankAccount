# Run the load-test notebook of one commit as a Kaggle batch job ("Save Version" > "Save & Run All"),
# so the browser does not have to stay open. One-cell Kaggle notebook, Internet on, no accelerator:
#   !curl -fsSL https://raw.githubusercontent.com/datdooo/SA_BankAccount/<SHA>/test/performance/kaggle_batch.py | python - <SHA> full
# Optional third argument: JSON list of workloads, e.g. '["debit","login","mixed"]'.
import json
import sys
import urllib.request

import nbformat
from nbclient import NotebookClient

sha, mode = sys.argv[1], sys.argv[2]
workloads = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
assert len(sha) == 40, 'SHA must be the full commit being measured'
assert mode in ('smoke', 'full')
url = f'https://raw.githubusercontent.com/datdooo/SA_BankAccount/{sha}/docs/performance/kaggle-load-test.ipynb'
nb = nbformat.reads(urllib.request.urlopen(url).read().decode(), as_version=4)
source = nb.cells[2].source
for old, new in [("MODE = 'smoke'", f'MODE = {mode!r}'), ("COMMIT = 'ĐIỀN_SHA_CẦN_ĐO'", f'COMMIT = {sha!r}'),
                 ('WORKLOADS = None', f'WORKLOADS = {workloads!r}')]:
    assert old in source, old
    source = source.replace(old, new)
nb.cells[2].source = source
try:
    NotebookClient(nb, timeout=None, kernel_name='python3').execute()
finally:
    nbformat.write(nb, f'/kaggle/working/executed-{mode}-{sha[:7]}.ipynb')  # Kept even on failure, for the log.
