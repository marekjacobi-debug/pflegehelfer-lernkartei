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
import re
import sys
import zipfile

from anonymisieren import pruefe_oeffentlich

WURZEL = pathlib.Path(__file__).resolve().parent
PLATZHALTER = "/*INHALTE*/null/*/INHALTE*/"


def praesentationen(daten, ordner):
    """Liste der gebauten Präsentationen (site/praesentationen/) + ZIP mit allen. None, wenn keine da sind."""
    ordner = pathlib.Path(ordner)
    dateien = []
    for lf in daten["lernfelder"]:
        for e in lf["einheiten"]:
            for t in e["themen"]:
                name = re.sub(r"\s+", " ", re.sub(r'[/\\:*?"<>|]', "-", f"{e['id']} {t['titel']}")).strip() + ".pptx"
                pfad = ordner / lf["titel"] / name
                if pfad.exists():
                    dateien.append({"id": t["id"], "pfad": f"praesentationen/{lf['titel']}/{name}", "kb": pfad.stat().st_size // 1024})
    if not dateien:
        return None
    zip_pfad = ordner / "Pflegehelfer-Praesentationen.zip"
    with zipfile.ZipFile(zip_pfad, "w", zipfile.ZIP_STORED) as z:  # pptx ist schon komprimiert
        for d in dateien:
            z.write(ordner.parent / d["pfad"], d["pfad"].split("/", 1)[1])
    return {"dateien": dateien, "zip": {"pfad": "praesentationen/" + zip_pfad.name, "mb": round(zip_pfad.stat().st_size / 1e6)}}


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
    ziel = pathlib.Path(ziel)
    praes = praesentationen(daten, ziel.parent / "praesentationen")
    kopf = ""
    if praes:
        kopf = "<script>var PRAES=" + json.dumps(praes, ensure_ascii=False).replace("</", "<\\/") + ";</script>\n"
    seite = ('<!doctype html>\n<html lang="de"><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
             + kopf + seite + "\n</body></html>\n")
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(seite, encoding="utf-8")
    return ziel, len(seite)


def main(argv):
    ziel, groesse = seite_bauen(WURZEL / "vorlage.html", WURZEL / "daten" / "inhalte.json", WURZEL / "site" / "index.html")
    print(f"geschrieben: {ziel.relative_to(WURZEL)} ({groesse:,} Zeichen)".replace(",", "."))
    n = len(list((ziel.parent / "praesentationen").rglob("*.pptx")))
    print(f"Präsentationen: {n}" if n else "Präsentationen: keine (erst ./praesentationen_bauen.sh ausführen)")
    if "--zeigen" in argv:
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ziel.parent))
        print("Seite läuft unter http://localhost:8000  (beenden mit Strg+C)")
        http.server.ThreadingHTTPServer(("127.0.0.1", 8000), handler).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
