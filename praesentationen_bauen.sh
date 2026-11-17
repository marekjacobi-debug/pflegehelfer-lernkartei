#!/bin/bash
# Baut alle Präsentationen aus den bereinigten Daten nach site/praesentationen/ (für die öffentliche Seite).
# Braucht Node mit pptxgenjs und playwright (NODE_PATH zeigt auf die globalen Module).
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
TMP=$(mktemp -d)
node werkzeuge/render_grafiken.js daten/inhalte.json "$TMP/grafiken"
GRAFIKEN="$TMP/grafiken" node werkzeuge/build_praesentationen.js daten/inhalte.json daten/vortraege.json site/praesentationen
rm -rf "$TMP"
