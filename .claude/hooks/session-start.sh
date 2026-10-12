#!/bin/bash
# Cloud sessions start from a fresh clone: install the dependencies so that
# `npm run check` (lint, unit tests, build) and `npm run shot` work at once.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm ci, not npm install: it installs exactly the lockfile and never writes it
# (the container's npm is older than the one the lockfile was written with,
# and `npm install` would rewrite it). Skipped when node_modules is already
# the lockfile's — npm leaves its own copy of it there.
if [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  exit 0
fi
npm ci --no-audit --no-fund --loglevel=error
