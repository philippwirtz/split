# Geteilte Kasse — auf dem iPhone installieren

Ausgaben in Gruppen teilen wie bei Splitwise: wer hat was bezahlt, wer schuldet wem wie viel.
Aufgebaut wie *Español de bolsillo*: statische Web-App, offline nutzbar, Abgleich zwischen den iPhones über ein geheimes GitHub-Gist.

## Was hier drin ist

| Datei | Zweck |
|---|---|
| `index.html` | Die App: Gruppen, Ausgaben, Salden, Aktivität, Einstellungen |
| `style.css` | Aussehen (gleiche Farben wie die Spanisch-App, hell/dunkel) |
| `app.js` | Programmlogik: Aufteilen, Salden, Schulden vereinfachen, Cloud-Sync, Sicherung |
| `sw.js` | Service Worker — macht die App offline nutzbar |
| `manifest.webmanifest` | Name, Farben, Vollbildmodus |
| `icon-180.png` / `icon-512.png` | Icons für Homescreen und App-Umschalter |

Alle Dateien gehören in **dasselbe Verzeichnis**, ohne Unterordner.

## Hochladen zu GitHub Pages

1. github.com → **New repository** → Name `kasse` → **Public** → Create
2. **Add file → Upload files** → alle Dateien hineinziehen → **Commit changes**
3. **Settings → Pages** → Branch `main`, Ordner `/ (root)` → **Save**
4. Ein bis zwei Minuten warten

Adresse: `https://philippwirtz.github.io/kasse/`

## Auf den Homescreen legen

Adresse in **Safari** öffnen → Teilen-Symbol → **Zum Home-Bildschirm**.

## Cloud-Sync

Unter **Einstellungen → Speichern** denselben GitHub-Token wie für die Spanisch-App eingeben
(nur Recht **gist**). Ist die Spanisch-App auf dem Gerät schon verbunden, trägt die Kasse den Token
selbst ein — nur noch „Mit GitHub verbinden" tippen. Es entsteht ein **eigenes** geheimes Gist
„Geteilte Kasse – Daten"; der Lernstand bleibt davon unberührt.

Jedes Gerät schreibt eine eigene Datei `kasse-<gerät>.json`. Beim Abgleich wird pro Ausgabe der
neuere Stand übernommen, Löschungen werden mit übertragen. Gleichzeitig auf beiden iPhones erfasste
Ausgaben gehen deshalb nicht verloren.

## Aktualisieren

Geänderte Datei hochladen und in `sw.js` die erste Zeile hochzählen (`const CACHE = 'kasse-v2';`),
sonst bleibt auf dem iPhone die alte Fassung im Zwischenspeicher.
