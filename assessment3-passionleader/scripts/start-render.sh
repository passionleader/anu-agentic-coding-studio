#!/bin/sh
# Start-up on Render's free plan (no disk: /data is empty on every start).
# The AI guides' pages come from a gzipped knowledge.db baked into the image,
# and the password accounts come back from hashes in SEED_ACCOUNTS (never passwords).
set -e
mkdir -p /data
if [ -f /seed/knowledge.db.gz ] && [ ! -s /data/knowledge.db ]; then
  gunzip -c /seed/knowledge.db.gz > /data/knowledge.db
fi
if [ -n "$SEED_ACCOUNTS" ]; then
  node scripts/seed-accounts.ts "$SEED_ACCOUNTS" > /dev/null
fi
exec node server/main.ts
