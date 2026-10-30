#!/usr/bin/env bash
# Portable backend regression checks for the repository.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"

echo "Running backend unit and Flask app smoke tests..."
python -m pytest backend/tests -q

echo "Backend checks passed."
echo "For frontend checks, run: cd frontend && npm install && CI=true npm test -- --watch=false --passWithNoTests"
