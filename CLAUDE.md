# Geteilte Kasse — Hinweise für die Arbeit am Code

Statische PWA für GitHub Pages, kein Build-Schritt, keine Abhängigkeiten. Schwester-App von `espanol` (gleiche Optik, gleiches Sync-Prinzip).

| Datei | Inhalt |
|---|---|
| `app.js` | gesamte Logik, Abschnitte `/* ===== Name =====` (Speicher, Geld, Kategorien, Daten, Rechnen, Tabs, Einstellungen, Sync, Sicherung, Offline) |
| `style.css` | alle Stile; Farb-Tokens identisch zu espanol |
| `index.html` | nur Markup |
| `sw.js` | Service Worker |

## Regeln
- Jede Auslieferung: `CACHE` in `sw.js` hochzählen (`kasse-vN`), `APP_VERSION` in `app.js` anpassen.
- **Gleiche Adresse wie espanol** (philippwirtz.github.io): localStorage und Cache-Speicher werden geteilt.
  Alle Schlüssel tragen den Präfix `kasse.`; der Service Worker löscht nur Caches mit Präfix `kasse-`.
  Einzige bewusste Ausnahme: `app.gh` (Token der Spanisch-App) wird gelesen, nie geschrieben.
- Service Worker darf Fremd-Adressen (api.github.com, open.er-api.com) nie cachen.
- Daten: `DB.recs` = Datensätze `{id,t,u,c,by,dev,del?}`; `t`: `g` Gruppe, `m` Mitglied, `e` Ausgabe, `p` Ausgleich.
  Nur über `put()` ändern (setzt `u` monoton). Löschen = Grabstein `del:true`, nie aus `recs` entfernen.
- Beträge sind ganze Cent. Ausgabe: `amt` in `cur`, `rate` (Gruppenwährung je 1 `cur`), `base` = round(amt·rate),
  `owe` = Anteile in Gruppenwährung, beim Speichern über `allocate()` berechnet (Summe == base, exakt).
- Sync: eine Datei je Gerät `kasse-<DEV.id>.json` im Gist; `mergeRecs` nimmt pro Datensatz das größere `u`
  (Gleichstand: größere Geräte-ID). Wiederherstellen spielt den alten Stand als neue Änderung ein (`restoreDB`).

## Prüfen ohne iPhone
`python -m http.server`, im Browser öffnen; `api.github.com` per Playwright-Route mocken
(Gist im Speicher, GET/POST/PATCH/DELETE) und zwei Browser-Kontexte als zwei Geräte abgleichen.
