import os
import sys

# Ensure `app` package is importable from the api root when running pytest
# from anywhere (repo root or apps/api).
_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)
