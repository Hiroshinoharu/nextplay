"""
Pytest path setup for recommender tests.

Allows absolute imports like `services.recommender.main` whether tests are run
from repo root or from `services/recommender`.
"""

import os
from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[3]
repo_root_str = str(REPO_ROOT)
if repo_root_str not in sys.path:
    sys.path.insert(0, repo_root_str)


os.environ.setdefault('GATEWAY_SERVICE_TOKEN', 'test-service-token')
