#!/usr/bin/env bash
# Draait alle aansluitprofielen tegen de referentieservers. Moet volledig groen zijn.
set -euo pipefail
cd "$(dirname "$0")/.."

RESPECT="npx -y @redocly/cli@2.57.0 respect"

PORT=4020 node aansluitprofielen/referentie-server.js &
PIDS=$!
AUTORISATIE=burger PORT=4021 node aansluitprofielen/mijnzaken/zgw-referentie-server.js &
PIDS="$PIDS $!"
trap 'kill $PIDS' EXIT
sleep 1

$RESPECT aansluitprofielen/mijnzaken/mijnzaken-next.arazzo.yaml \
  --server mijnzaken=http://127.0.0.1:4020 \
  --input tokenA=token-a --input tokenB=token-b

$RESPECT aansluitprofielen/mijntaken/mijntaken-next.arazzo.yaml \
  --server mijntaken=http://127.0.0.1:4020 --server mijnzaken=http://127.0.0.1:4020 \
  --input tokenA=token-a --input tokenB=token-b

$RESPECT aansluitprofielen/mijnzaken/zgw.arazzo.yaml \
  --server zaken=http://127.0.0.1:4021 \
  --input tokenA=token-a --input bsnA=111222333 \
  --input tokenB=token-b --input bsnB=999993653
