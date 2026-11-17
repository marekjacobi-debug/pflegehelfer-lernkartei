"""Baut die öffentliche Lernkartei-Seite.

Aufruf:
    python3 bauen.py                 -> site/index.html
    python3 bauen.py --zeigen        -> bauen und unter http://localhost:8000 anzeigen

Gleiche Logik wie build_offline.py aus dem Dropbox-Ordner, aber vorher wird geprüft,
dass die Daten bereinigt sind (keine Lehrkraft-Namen, keine Ordnerpfade).
"""
import functools
import http.server
import json
import pathlib
import sys

from anonymisieren import pruefe_oeffentlich

WURZEL = pathlib.Path(__file__).resolve().parent
PLATZHALTER = "/*INHALTE*/null/*/INHALTE*/"


def seite_bauen(vorlage, inhalte, ziel):
    daten = json.loads(pathlib.Path(inhalte).read_text(encoding="utf-8"))
    probleme = pruefe_oeffentlich(daten)
    if probleme:
        raise SystemExit("Daten sind nicht bereinigt – erst anonymisieren.py ausführen:\n  " + "\n  ".join(probleme))
    seite = pathlib.Path(vorlage).read_text(encoding="utf-8")
    if PLATZHALTER not in seite:
        raise SystemExit("Platzhalter fehlt in der Vorlage: " + PLATZHALTER)
    js = json.dumps(daten, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    seite = seite.replace(PLATZHALTER, "/*INHALTE*/" + js + "/*/INHALTE*/")
    seite = seite.replace('<header class="top">', '</head><body>\n<header class="top">', 1)
    seite = ('<!doctype html>\n<html lang="de"><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
             + seite + "\n</body></html>\n")
    ziel = pathlib.Path(ziel)
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(seite, encoding="utf-8")
    return ziel, len(seite)


def main(argv):
    ziel, groesse = seite_bauen(WURZEL / "vorlage.html", WURZEL / "daten" / "inhalte.json", WURZEL / "site" / "index.html")
    print(f"geschrieben: {ziel.relative_to(WURZEL)} ({groesse:,} Zeichen)".replace(",", "."))
    if "--zeigen" in argv:
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ziel.parent))
        print("Seite läuft unter http://localhost:8000  (beenden mit Strg+C)")
        http.server.ThreadingHTTPServer(("127.0.0.1", 8000), handler).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
