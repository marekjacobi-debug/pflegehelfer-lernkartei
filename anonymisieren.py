"""Entfernt die Namen der Lehrkräfte aus der Lernkartei, bevor sie öffentlich wird.

Aufruf:
    python3 anonymisieren.py <Original-inhalte.json> daten/inhalte.json [--namen <Datei>]

Die Original-Datei (aus Dropbox: "Claude Code/lernkartei/inhalte.json") kommt NIE ins Repo.
Die Namen stehen auch nicht in diesem Skript: Es liest sie aus der Original-Datei
(Feld "lehrkraft" jedes Themas und Lehrkraft-Ordner in "quellen" / "dateien").
Lehrkräfte, die nur im Text erwähnt werden, kommen in eine private Namensliste.
Sie wird automatisch gelesen, wenn sie als "lehrkraefte_privat.txt" neben der
Original-Datei liegt, oder mit --namen angegeben. Diese Liste gehört NICHT ins Repo.
    Frau Beispiel      <- Lehrkraft: wird ersetzt
    titel: Frau Wald   <- Lehrkraft, deren Name auch ein normales Wort ist:
                          nur "Frau Wald" wird ersetzt, "der Wald" bleibt
    ok: Schulz         <- ausgedachter Name (z. B. in einer Quizfrage): bleibt stehen
Steht außerhalb der Fallbeispiele ein "Frau/Herr X", der in keiner der beiden Gruppen
ist, bricht das Skript ab und schreibt nichts.

Was passiert:
  - "Unterricht Frau X"            -> "Unterricht"
  - "von/bei/laut … Frau X"        -> "von/bei/laut … der Lehrkraft"
  - "Frau X", "Herr X", "X"        -> "Lehrkraft"
  - Feld "lehrkraft"               -> leer
  - "quellen"                      -> nur noch der Dateiname (ohne Ordner)
  - "dateien" (Verarbeitungsstand) -> entfernt
Am Ende wird geprüft, dass kein Name mehr vorkommt. Sonst bricht das Skript ab.
"""
import json
import os
import re
import sys

TITEL = r"(?:Frau|Herr|Fr\.|Hr\.)"
NAME_NACH_TITEL = re.compile(TITEL + r"\s+([A-ZÄÖÜ][\wäöüß-]+)")


def alle_themen(daten):
    for lf in daten.get("lernfelder", []):
        for einheit in lf.get("einheiten", []):
            for thema in einheit.get("themen", []):
                yield thema


def _lehrkraft_ordner(pfad):
    """'Lernfeld 02/Lernfeldeinheit 2.1/Frau X/Datei.docx' -> 'Frau X' (sonst None)."""
    teile = str(pfad).split("/")
    return teile[2] if len(teile) >= 4 else None


def namen_finden(daten):
    """Nachnamen aller Lehrkräfte, die in der Original-Datei vorkommen."""
    namen, ohne_titel = set(), set()

    def aus_text(text):
        gefunden = NAME_NACH_TITEL.findall(text or "")
        namen.update(gefunden)
        return gefunden

    for thema in alle_themen(daten):
        aus_text(thema.get("lehrkraft"))
        for quelle in thema.get("quellen", []):
            ordner = _lehrkraft_ordner(quelle)
            if ordner and not aus_text(ordner):
                ohne_titel.add(ordner)
    for datei in daten.get("dateien", []):
        ordner = _lehrkraft_ordner(datei.get("pfad", ""))
        if ordner and not aus_text(ordner):
            ohne_titel.add(ordner)
    return namen, ohne_titel


def _muster(namen):
    liste = "|".join(re.escape(n) for n in sorted(namen, key=len, reverse=True))
    return rf"(?:{liste})s?\b"  # mit Genitiv-s


def _regeln(namen, nur_titel=()):
    n = _muster(namen)
    regeln = [
        ("Unterricht", re.compile(rf"\b(Unterricht(?:sstunde)?)\s+(?:(?:bei|von)\s+)?{TITEL}\s+{n}"), r"\1"),
        ("Präposition", re.compile(rf"\b((?i:von|bei|mit|laut|nach))\s+{TITEL}\s+{n}"), r"\1 der Lehrkraft"),
        ("Titel+Name", re.compile(rf"(?<![\w]){TITEL}\s+{n}"), "Lehrkraft"),
    ]
    allein = set(namen) - set(nur_titel)
    if allein:
        regeln.append(("Name allein", re.compile(rf"\b{_muster(allein)}"), "Lehrkraft"))
    return regeln


def _aufraeumen(text, svg=False):
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s+\(\s*\)", "", text)
    if not svg:  # in SVG-Code keine Satzzeichen anfassen
        text = re.sub(r"\s+([,.;:!?)])", r"\1", text)
    text = re.sub(r"Lehrkraft(?:\s*(?:/|,|und|&)\s*Lehrkraft)+", "Lehrkraft", text)
    return text


def verdaechtige_namen(daten, namen):
    """'Frau X'/'Herr X' außerhalb der Fallbeispiele, die nicht als Lehrkraft bekannt sind.
    Fallbeispiele haben absichtlich ausgedachte Namen und werden nicht gemeldet."""
    funde = set()

    def suche(wert, in_fall):
        if isinstance(wert, str):
            if not in_fall:
                for name in NAME_NACH_TITEL.findall(wert):
                    if name not in namen:
                        funde.add(name)
        elif isinstance(wert, list):
            for v in wert:
                suche(v, in_fall)
        elif isinstance(wert, dict):
            for k, v in wert.items():
                suche(v, in_fall or k == "faelle")

    suche(daten, False)
    return sorted(funde)


def namensliste_lesen(pfad):
    """-> (Lehrkräfte, ausgedachte Namen, Lehrkräfte nur mit Titel ersetzen).
    Zeilen: 'Frau X' / 'X', 'titel: X' oder 'ok: X'."""
    lehrkraefte, ok, nur_titel = set(), set(), set()

    def woerter(rest):
        return [w for w in rest.replace(",", " ").split() if w[:1].isupper() and w not in ("Frau", "Herr")]

    with open(pfad, encoding="utf-8") as f:
        for zeile in f:
            zeile = zeile.split("#")[0].strip()
            if not zeile:
                continue
            if zeile.lower().startswith("ok:"):
                ok.update(woerter(zeile[3:]))
            elif zeile.lower().startswith("titel:"):
                nur_titel.update(woerter(zeile[6:]))
                lehrkraefte.update(woerter(zeile[6:]))
            else:
                lehrkraefte.add(zeile.split()[-1])  # "Frau X" oder "X" -> "X"
    return lehrkraefte, ok, nur_titel


def anonymisieren(daten, extra_namen=(), ausgedacht=(), nur_titel=()):
    """Gibt (bereinigte Daten, Bericht) zurück. Die Eingabe wird nicht verändert."""
    namen, ohne_titel = namen_finden(daten)
    namen |= set(extra_namen)
    bericht = {"namen": len(namen), "ohne_titel": sorted(ohne_titel), "treffer": {}, "stellen": [],
               "verdacht": [n for n in verdaechtige_namen(daten, namen) if n not in set(ausgedacht)]}
    daten = json.loads(json.dumps(daten))  # tiefe Kopie

    daten.pop("dateien", None)
    for thema in alle_themen(daten):
        if "lehrkraft" in thema:
            thema["lehrkraft"] = ""
        thema["quellen"] = [str(q).split("/")[-1] for q in thema.get("quellen", [])]

    if not namen:
        return daten, bericht
    regeln = _regeln(namen, nur_titel)

    def bearbeite(wert, ort):
        if isinstance(wert, str):
            neu = wert
            for name, muster, ersatz in regeln:
                neu, anzahl = muster.subn(ersatz, neu)
                if anzahl:
                    bericht["treffer"][name] = bericht["treffer"].get(name, 0) + anzahl
            if neu != wert:
                neu = _aufraeumen(neu, svg=(ort == "svg"))
                if ort != "svg":
                    i = neu.find("Lehrkraft") if "Lehrkraft" in neu else 0
                    bericht["stellen"].append(neu[max(0, i - 50): i + 60].replace("\n", " "))
            return neu
        if isinstance(wert, list):
            return [bearbeite(v, ort) for v in wert]
        if isinstance(wert, dict):
            return {k: bearbeite(v, k) for k, v in wert.items()}
        return wert

    daten = bearbeite(daten, "")
    text = json.dumps(daten, ensure_ascii=False)
    rest = namen_im_text(text, set(namen) - set(nur_titel))
    if set(nur_titel) & namen:
        rest += re.findall(rf"(?<![\w]){TITEL}\s+{_muster(set(nur_titel) & namen)}", text)
    if rest:
        raise ValueError("Namen noch vorhanden: %d Stelle(n) – bitte prüfen" % len(rest))
    return daten, bericht


def namen_im_text(text, namen):
    if not namen:
        return []
    liste = "|".join(re.escape(n) for n in namen)
    return re.findall(rf"\b(?:{liste})s?\b", text)


def pruefe_oeffentlich(daten):
    """Strukturprüfung für die öffentliche Datei. Gibt eine Liste von Problemen zurück."""
    probleme = []
    if "dateien" in daten:
        probleme.append('Feld "dateien" darf nicht in der öffentlichen Datei stehen')
    for thema in alle_themen(daten):
        tid = thema.get("id", "?")
        if thema.get("lehrkraft"):
            probleme.append(f'{tid}: Feld "lehrkraft" ist nicht leer')
        for quelle in thema.get("quellen", []):
            if "/" in str(quelle):
                probleme.append(f"{tid}: Quelle enthält einen Ordnerpfad")
    return probleme


def main(argv):
    args = argv[1:]
    namen_datei = None
    if "--namen" in args:
        i = args.index("--namen")
        namen_datei = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        print(__doc__)
        return 2
    quelle, ziel = args
    if namen_datei is None:
        standard = os.path.join(os.path.dirname(os.path.abspath(quelle)), "lehrkraefte_privat.txt")
        namen_datei = standard if os.path.exists(standard) else None
    extra, ausgedacht, nur_titel = namensliste_lesen(namen_datei) if namen_datei else (set(), set(), set())
    with open(quelle, encoding="utf-8") as f:
        original = json.load(f)
    daten, bericht = anonymisieren(original, extra, ausgedacht, nur_titel)
    if bericht["verdacht"]:
        print("NICHTS GESCHRIEBEN – diese Namen stehen außerhalb der Fallbeispiele und sind unbekannt:",
              *("Frau/Herr " + n for n in bericht["verdacht"]),
              "In lehrkraefte_privat.txt eintragen: Lehrkraft -> 'Frau X', ausgedacht -> 'ok: X'.", sep="\n  ")
        return 1
    probleme = pruefe_oeffentlich(daten)
    if probleme:
        print("FEHLER:", *probleme, sep="\n  ")
        return 1
    with open(ziel, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    themen = sum(1 for _ in alle_themen(daten))
    print(f"geschrieben: {ziel} ({themen} Themen)")
    print(f"Lehrkräfte erkannt: {bericht['namen']}  ·  Ersetzungen: {bericht['treffer'] or 'keine'}")
    if bericht["ohne_titel"]:
        print("Lehrkraft-Ordner ohne Frau/Herr (bitte prüfen):", *bericht["ohne_titel"], sep="\n  ")
    if bericht["stellen"]:
        print("Ersetzte Stellen im Text (Grammatik prüfen):", *bericht["stellen"], sep="\n  … ")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
