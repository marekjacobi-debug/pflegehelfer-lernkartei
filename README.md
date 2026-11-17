# Pflegehelfer-Lernkartei

Lernkartei für die Pflegehelfer-Ausbildung (Lernfelder 1–5): Lernzettel, Karteikarten, Quiz,
Lückentexte, Zuordnungen und Fallbeispiele. Alles steckt in einer einzigen HTML-Seite
und funktioniert auch offline.

**Seite ansehen:** `https://<dein-github-name>.github.io/pflegehelfer-lernkartei/`

> Die Inhalte sind Lernnotizen aus der Ausbildung. Sie ersetzen weder den Unterricht noch
> Lehrbuch, Hausstandards oder die Anweisung der Pflegefachkraft.

## Wie die Seite entsteht

```
Dropbox: inhalte.json (Original, mit Namen)
        │  python3 anonymisieren.py …   ← entfernt die Namen der Lehrkräfte
        ▼
daten/inhalte.json (bereinigt)  +  vorlage.html (die App)
        │  python3 bauen.py
        ▼
site/index.html  →  GitHub Pages (automatisch bei jedem Push auf main)
```

| Datei | Inhalt |
|---|---|
| `vorlage.html` | die Lernkartei-App (HTML, CSS, JS) mit Platzhalter für die Daten |
| `daten/inhalte.json` | alle Lerninhalte, **ohne** Namen der Lehrkräfte |
| `anonymisieren.py` | Original → bereinigte Daten |
| `bauen.py` | bereinigte Daten + Vorlage → `site/index.html` |
| `tests/` | prüft, dass keine Namen durchrutschen und die Seite baut |
| `.github/workflows/seite.yml` | baut und veröffentlicht bei jedem Push |

## Inhalte aktualisieren

1. Die Lernkartei wie gewohnt in Dropbox pflegen (`Claude Code/lernkartei/inhalte.json`).
2. Bereinigte Kopie erzeugen (im Ordner dieses Repos):
   ```bash
   python3 anonymisieren.py ~/Dropbox/Pflegehelferausbildung/Claude\ Code/lernkartei/inhalte.json daten/inhalte.json
   ```
3. Prüfen und ansehen:
   ```bash
   python3 -m unittest discover -s tests
   ```
   ```bash
   python3 bauen.py --zeigen
   ```
4. Committen und pushen. Nach 1–2 Minuten ist die Seite aktuell.

### Namen der Lehrkräfte

`anonymisieren.py` erkennt Lehrkräfte am Feld `lehrkraft` und an den Ordnernamen in den Quellen.
Wer nur im Text erwähnt wird, kommt in die private Liste `lehrkraefte_privat.txt`
**neben der Original-Datei in Dropbox** (nie ins Repo):

```text
Frau Beispiel     # Lehrkraft → wird ersetzt
titel: Frau Wald  # Name ist auch ein normales Wort → nur „Frau Wald“ wird ersetzt, „der Wald“ bleibt
ok: Schulz        # ausgedachter Name, z. B. in einer Quizfrage → bleibt
```

Findet das Skript außerhalb der Fallbeispiele ein unbekanntes „Frau/Herr X“, bricht es ab
und schreibt nichts. Ausgedachte Namen in Fallbeispielen bleiben immer stehen.

## Einmalig einrichten

Auf github.com im Repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
