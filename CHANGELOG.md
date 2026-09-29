# Changelog

Alle Änderungen sind chronologisch nach Commit aufgeführt.

## 2026-09-29
### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-29:
- `M – src/index.html`
- `M – src/styles/components.css`
- `M – supabase/schema.sql`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-29:
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`
- `M – supabase/schema.sql`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-29:
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`
- `M – supabase/schema.sql`


### Freie Zeiträume und Buchungsabgleich ergänzt

- Eigene Start- und Enddaten sowie Schnellfilter für 30 Tage, aktuellen Monat
  und laufendes Jahr ergänzt; Buchungslisten, Kennzahlen und Exporte wenden
  denselben Zeitraum an.
- Administratoren können Buchungen als abgeglichen markieren, den Status
  filtern und Abgleichszeitpunkt sowie Benutzer in Liste, Auswertungen und
  Exporten nachvollziehen.
- Datenbankschema und Audit-Logging um Abgleichsmetadaten erweitert.
- Eine verständlichere Meldung für JWT-Fehler wegen einer in der Zukunft
  liegenden Ausstellungszeit ergänzt.
- README auf individuelle Supabase-Zugänge für beliebig viele lesende
  Mitglieder aktualisiert.
- Gespeicherte Filteransichten und Schnellfilter als Filterchips ergänzt.
- Sammelabgleich mit Kontenübersicht für offene und abgeglichene Buchungen
  sowie Beträge umgesetzt.
- Monats- und Kategorieauswertungen für den schnelleren Überblick oberhalb der
  Buchungsliste platziert.
- CSV-Export um Spaltenauswahl und optionalen Export des Auditverlaufs erweitert.
- Monatsübersicht und Kategorienauswertung mit klarerer visueller Hierarchie,
  Karten, aussagekräftigen Saldo-/Vergleichsmarken und optimierter Mobilansicht
  aufgefrischt.
- Gesamtsaldo als Hauptkennzahl hervorgehoben, Bank- und PayPal-Konten visuell
  differenziert und Monatsverläufe mit getrennten Vergleichsbalken gestaltet.
- Filter in Zeitraum-, Konto- und Buchungsgruppen geordnet; aktive Filter lassen
  sich jetzt einzeln als Chips entfernen.
- Buchungszeilen für Einnahmen und Ausgaben dezent farblich markiert und
  Aktionsbuttons kompakter angeordnet.
- Administrator-exklusive Aktionen zentral gekennzeichnet und für Mitglieder
  mit Lesezugriff konsequent ausgeblendet.
- README um individuelle lesende Supabase-Konten erweitert.
- Header-Link „Mannschaftskasse“ als hervorgehobene, responsive Navigationskapsel
  gestaltet.
- Header-Logo mit klarerem Rahmen, ausgewogener Größe und verbessertem
  Fokus-/Hover-Zustand aufgewertet.

### `b0b029e` – feat: improve finance workflows and navigation

- Admin-Rechte für Buchungen und Kategorien abgesichert, zentrale
  Kategorienverwaltung und Passwort-Wiederherstellung ergänzt.
- CSV-Import mit Spaltenzuordnung, Vorschau und Dublettenprüfung um Profile für
  gängige Banken und PayPal sowie automatische Vorzeichen- und Soll/Haben-
  Erkennung erweitert; gefilterten CSV-Export hinzugefügt.
- Wiederholungsbuchungen um Wochen-, Monats- und Jahresrhythmus sowie optionale
  Enddaten erweitert; fällige Termine hervorgehoben.
- Änderungsverlauf mit Wiederherstellung und Vorher-nachher-Vergleich
  erweitert; Auswertungen um zugängliche Datentabellen ergänzt.
- Buttons und mobile Aktionsbereiche überarbeitet; Header-Link in
  „Mannschaftskasse“ umbenannt und zentriert.
- Anmeldung und Abmeldung so angepasst, dass jeweils nur die passende Aktion
  angezeigt wird.
- README, Changelog und Supabase-Delta-Schema aktualisiert.

## 2026-09-21

### `1576e58` – feat: migrate app to static frontend

- Neue statische Frontend-Anwendung für die Wesselbleker Prinzen unter `src/`.
- Vereins-Startseite mit Hero-Bereich, Logo, Mannschaftsfoto und Informationen
  zum Team.
- Dynamische Teamübersicht und Spielplan über Supabase vorbereitet.
- Authentifizierung für Mitglieder über Supabase ergänzt.
- Finanzübersicht mit Einnahmen, Ausgaben und Saldo implementiert.
- Formular zum Anlegen neuer Finanzbuchungen ergänzt.
- Responsive Gestaltung für Desktop- und Mobilgeräte hinzugefügt.
- Supabase-Konfigurationsdatei und Einrichtungsanleitung in `README.md`
  hinzugefügt.
- GitHub-Pages-Workflow für die Veröffentlichung der statischen Anwendung
  ergänzt.

### `07955a2` – fix: enable pages deployment workflow

- GitHub-Pages-Workflow um `enablement: true` ergänzt.
- Pages-Bereitstellung für neue Repositories zuverlässig aktiviert.

### `f3d9235` – ci: check conventional commit messages

- GitHub-Action zur Prüfung aller Commit-Messages ergänzt.
- Conventional-Commit-Formate werden bei Pushes auf `main` und Pull Requests
  validiert.
- Erlaubte Typen, Scopes und Breaking-Change-Markierungen werden geprüft.

### `30215aa` – feat: enable Supabase login

- Supabase-Projektkonfiguration für die Browser-Anwendung aktiviert.
- Anmeldung per `signInWithPassword`, Session-Wiederherstellung und Abmeldung
  ergänzt.
- README um die Einrichtung des Supabase-Logins erweitert.

### `f2511cd` – feat: remove team and schedule sections

- Navigationslinks und Bereiche für Mannschaft und Termine entfernt.
- Nicht mehr benötigte Supabase-Abfragen für Team und Spielplan gelöscht.
- Finanzübersicht und Login unverändert beibehalten.

## 2026-09-24
### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-24:
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-24:
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`
- `M – supabase/schema.sql`


### `9eb3d0f` – ci: automate daily changelog updates

- Versionierten `pre-commit`-Hook für automatische Changelog-Einträge ergänzt.
- Hook-Dokumentation in `.githooks/README.md` und `README.md` hinzugefügt.

### `4ca9ed9` – fix: avoid duplicate changelog entries

- Doppelte automatische Changelog-Einträge beim Commit verhindert.

### `824e2b9` – feat: allow editing transactions

- Bearbeiten bestehender Buchungen ergänzt.
- Update-RLS-Policy und Formular für vorhandene Buchungsdaten erweitert.

### `d970489` – feat: manage and clarify transactions

- Löschen von Buchungen mit Bestätigung ergänzt.
- Soft-Delete- und Delete-RLS-Unterstützung hinzugefügt.
- Abbrechen-Button und eindeutige Beschriftung für das Bearbeitungsformular ergänzt.
- Hinweis zur Bedeutung von Gesamt- und Kontosummen hinzugefügt.

### `ce7211b` – fix: diagnose transaction mutation failures

- Frontend-Fehler im Login-Submit-Button korrigiert.
- Update- und Löschvorgänge prüfen jetzt, ob tatsächlich eine Buchung betroffen war.
- Verständlichere Berechtigungsfehlermeldungen ergänzt.

### `fd32dde` – feat: paginate and audit transactions

- Serverseitige Filterung nach Jahr und Konto ergänzt.
- Buchungsliste auf 50 Einträge pro Seite begrenzt.
- Kontoabhängige Summenfilterung ergänzt.
- Audit-Felder, Soft-Delete, Index und Datenbank-Trigger ergänzt.

### `b8037d4` – fix: add Supabase transactions schema

- Ausführbares Supabase-Schema unter `supabase/schema.sql` ergänzt.
- Tabelle `public.transactions` mit Validierungen und Row-Level-Security-Policies
  angelegt.
- Verständliche Fehlermeldung ergänzt, wenn die Finanzdatenbank noch nicht
  eingerichtet ist.
- README auf die einmalige Ausführung des SQL-Schemas aktualisiert.

### `791f635` – feat: remove about section and team photo

- Navigationslink und Inhaltsbereich „Über uns“ entfernt.
- Mannschaftsfoto von der Startseite entfernt.
- Nicht mehr benötigte CSS-Regeln bereinigt.

### `a4c849d` – refactor: split Supabase base schema and delta

- Basisschema für neue Supabase-Projekte in `supabase/base-schema.sql`
  ausgelagert.
- `supabase/schema.sql` auf ein Delta-Migrationsskript für bestehende
  Installationen umgestellt.
- README um die getrennten Einrichtungswege ergänzt.

## 2026-09-25

### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-25:
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`


## 2026-09-28

### `98b8c7d` – feat: secure and refresh finance app

- Buchungen und Kategorien auf Administratoren beschränkt; `bvbrulez@gmail.com`
  als Admin zugelassen und die Rechte in Supabase-RLS abgesichert.
- Lesenden Mitglieder-Login `Prinzenkroeten` sowie Passwort-Wiederherstellung
  ergänzt.
- Kategorien zentral in Supabase verwaltet, mit Admin-Funktionen zum Hinzufügen
  und Entfernen; bestehende Kategorien übernommen und geschützt.
- Monats- und Kategorieauswertungen mit Suche, Buchungsart und optionalem
  Kontofilter synchronisiert; Kontosalden unabhängig davon ausgewiesen.
- PDF-Export paginiert und auf 5.000 Buchungen begrenzt.
- Admin-Anleitungen aktualisiert und das responsive Vereinsdesign aufgefrischt.
