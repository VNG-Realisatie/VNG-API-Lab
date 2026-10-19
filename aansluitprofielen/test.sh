#!/usr/bin/env bash
# Draait alle aansluitprofielen tegen de referentieservers. Moet volledig groen zijn.
set -euo pipefail
cd "$(dirname "$0")/.."

RESPECT="npx -y @redocly/cli@2.57.0 respect"

PORT=4020 node aansluitprofielen/referentie-server.js &
PIDS=$!
AUTORISATIE=burger PORT=4021 node aansluitprofielen/mijnzaken/zgw-referentie-server.js &
PIDS="$PIDS $!"
AUTORISATIE=burger PORT=4022 node aansluitprofielen/mijntaken/openvtb-referentie-server.js &
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

# De Open VTB-spec documenteert geen 401/403/404 en heeft een discriminator die Ajv niet
# accepteert. Schema- en statuscodechecks zijn daarom waarschuwingen; de succescriteria
# (het gedrag) blijven hard. Zie aansluitprofielen/README.md.
$RESPECT aansluitprofielen/mijntaken/openvtb.arazzo.yaml \
  --server taken=http://127.0.0.1:4022 \
  --severity '{"SCHEMA_CHECK":"warn","STATUS_CODE_CHECK":"warn"}' \
  --input tokenA=token-a --input burgerA=urn:nld:brp:bsn:111222333 \
  --input zaakA=urn:nld:gemeentevoorbeeld:zaak:zaaknummer:ZAAK-2024-0001 \
  --input tokenB=token-b --input burgerB=urn:nld:brp:bsn:999993653
