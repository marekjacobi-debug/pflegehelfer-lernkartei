# Pflegehelfer-Lernkartei (öffentliches Repo)

Dieses Repo ist **öffentlich** und veröffentlicht die Lernkartei über GitHub Pages.
Sprich Deutsch, einfach und direkt. Die ausführliche Anleitung (Mitschriften, Präsentationen,
Layout-Fassungen, Inhaltsregeln) liegt privat in Dropbox: `Pflegehelferausbildung/Claude Code/CLAUDE.md`.

## Datenschutz – wichtigste Regel
- **Keine Namen von Lehrkräften** ins Repo: nicht in Daten, Code, Tests, Commits oder README.
- Die Original-`inhalte.json` (mit Namen), `vortraege_alle.json`, `layout_stand.json` und
  `lehrkraefte_privat.txt` kommen **nie** ins Repo. `.gitignore` schützt zusätzlich.
- `daten/inhalte.json` nur über `anonymisieren.py` erzeugen, nie von Hand aus dem Original kopieren.
- Vor jedem Commit: `python3 -m unittest discover -s tests`.
- Ausgedachte Namen in Fallbeispielen sind gewollt und bleiben.

## Ablauf: Inhalte aktualisieren
1. Original-`inhalte.json` besorgen (Dropbox `Claude Code/lernkartei/`). In der Cloud geht kein
   Dropbox-Download: den Nutzer bitten, die Datei in den Chat hochzuladen. Ablegen **außerhalb** des Repos.
2. `python3 anonymisieren.py <original> daten/inhalte.json` (private Namensliste: `--namen <datei>`
   oder `lehrkraefte_privat.txt` neben dem Original).
3. Bricht das Skript wegen unbekannter Namen ab: den Nutzer fragen, ob Lehrkraft oder ausgedacht.
4. Ausgabe „Ersetzte Stellen“ lesen. Holprige Sätze im **Original** in Dropbox verbessern, nicht hier.
5. Tests, `python3 bauen.py`, Seite einmal im Browser ansehen (Playwright ist installiert), committen, pushen.

## Ablauf: App verbessern (`vorlage.html`)
- Platzhalter `/*INHALTE*/null/*/INHALTE*/` muss erhalten bleiben.
- Lernfortschritt hängt an den IDs (Karten, Quiz, Fälle …): IDs nie ändern.
- Geänderte `vorlage.html` auch zurück nach Dropbox (`Claude Code/lernkartei/vorlage.html`), damit die
  Offline-Datei gleich bleibt. Kann Claude in der Cloud nicht selbst: dem Nutzer Bescheid geben.

## Cloud-Umgebung
Umgebung „pflegehelfer-lernseite“: Python 3, Node, Playwright/Chromium, LibreOffice, pdftotext,
Schriften Carlito/Caladea vorinstalliert; Setup-Skript installiert `pptxgenjs` und die Python-Pakete.
Node-Skripte mit `NODE_PATH=$(npm root -g) node …` starten.
