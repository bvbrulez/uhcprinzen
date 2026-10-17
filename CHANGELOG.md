# Changelog

Alle Änderungen sind chronologisch nach Commit aufgeführt.

## 2026-10-13
### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – .github/workflows/conventional-commits.yml`
- `M – .github/workflows/pages.yml`
- `M – .github/workflows/tests.yml`


### Version 1.1.2

- verbessere die Version
- Merge branch 'main' of https://github.com/bvbrulez/uhcprinzen

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – VERSION`
- `M – src/index.html`


### Version 1.1.1

- fix(e2e): allow empty member bookings view

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – src/index.html`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – tests/e2e/access-control.spec.mjs`


### Version 1.1.0

- feat(release): automate SemVer version updates

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – .githooks/README.md`
- `M – .github/workflows/pages.yml`
- `M – README.md`
- `A – VERSION`
- `A – scripts/release-version.mjs`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/base.css`
- `M – tests/e2e/access-control.spec.mjs`
- `A – tests/unit/release-version.test.mjs`

### Automatische SemVer-Versionierung und Footer-Anzeige ergänzt

- Versionsnummer im Footer ergänzt und `VERSION` als kanonische
  Versionsquelle eingeführt.
- Release-Workflow erhöht die SemVer-Version anhand der Conventional Commits
  jedes Pushes nach `main`, aktualisiert den datierten Changelog-Abschnitt und
  veröffentlicht den versionierten Stand nach erfolgreichen Prüfungen.
- README und Hook-Dokumentation zu den Major-, Minor- und Patch-Regeln
  aktualisiert; Release-Skript und Tests ergänzt.
- Beleg-Popup-Navigation und zugehörige Playwright-URL-Prüfung stabilisiert.

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – README.md`
- `M – supabase/migrations/20261014080000_contribution_rates_revoke_write.sql`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – README.md`
- `A – supabase/migrations/20261014080000_contribution_rates_revoke_write.sql`
- `M – supabase/schema.sql`
- `M – supabase/tests/contribution_rules.test.sql`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-13:
- `M – .github/copilot-instructions.md`
- `M – .github/workflows/pages.yml`
- `M – .github/workflows/tests.yml`
- `M – README.md`
- `M – package.json`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/scripts/finance-rules.mjs`
- `A – src/scripts/month-close.mjs`
- `A – src/scripts/recurring-view-rules.mjs`
- `M – src/scripts/transaction-service.mjs`
- `M – src/scripts/transaction-view.mjs`
- `M – src/styles/components.css`
- `A – supabase/config.toml`
- `A – supabase/migrations/20261014090000_transaction_receipt_member_read.sql`
- `M – supabase/schema.sql`
- `M – supabase/tests/contribution_rules.test.sql`
- `A – tests/db/install-local-schema.mjs`
- `M – tests/e2e/access-control.spec.mjs`
- `A – tests/e2e/create-local-users.mjs`
- `M – tests/unit/finance-rules.test.mjs`
- `A – tests/unit/month-close.test.mjs`
- `A – tests/unit/recurring-view-rules.test.mjs`
- `M – tests/unit/transaction-service.test.mjs`


### Belege, Monatsabschluss und Deployment-Prüfungen ergänzt

- Belegverwaltung für Buchungen mit privatem Supabase-Storage, Upload- und
  Dateityp-/Größenprüfung sowie kurzlebigen Links für angemeldete Mitglieder
  ergänzt.
- Geführten Monatsabschluss mit Prüfschritten für Buchungen, Abgleiche,
  Quartalsbeiträge und Wiederholungen sowie herunterladbarem HTML-Archivbericht
  ergänzt.
- Backup-/Restore-Hinweise und eine versionierte SQL-Migration dokumentiert;
  lokale Schema-Installationen sind auf Loopback-Datenbanken beschränkt.
- CI um lokale Supabase-, pgTAP- und authentifizierte Playwright-Läufe erweitert
  und GitHub-Pages-Deployment von erfolgreichen Prüfungen abhängig gemacht.
- Beitragszuordnung, Wiederholungsstatus und Zeitraum-Schnellwahl für die
  Finanzübersicht weiter verbessert.
- Unit- und Browserprüfungen sowie README und Modulübersicht aktualisiert.

### Vererbte Schreibrechte auf Beitragssätzen entfernt

- Bereits gewährte Tabellenrechte für `PUBLIC`, `anon` und `authenticated`
  werden explizit widerrufen; angemeldete Mitglieder behalten ausschließlich
  Leserechte auf Beitragssätze.
- Neue Migration `20261014080000_contribution_rates_revoke_write.sql` ergänzt,
  die vor der Beleg-Lesepolicy-Migration auszuführen ist.
- pgTAP-Berechtigungsprüfung auf `INSERT`, `UPDATE`, `DELETE` und `TRUNCATE`
  erweitert.

### Migration für Beitragssatz-Rechte abgesichert

- Rechte-Migration prüft vor der Änderung, ob `public.team_contribution_rates`
  existiert, und überspringt sie andernfalls mit einer SQL-Hinweismeldung.
- README um den Umgang mit einem vorhandenen Datenbankschema ergänzt; das
  historische Delta-Skript wird nicht als Reparatur für fehlende Tabellen
  empfohlen.

## 2026-10-11
### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-11:
- `M – .github/copilot-instructions.md`
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `A – src/scripts/contribution-view-rules.mjs`
- `M – src/scripts/transaction-service.mjs`
- `M – src/scripts/transaction-view.mjs`
- `A – src/scripts/year-comparison.mjs`
- `M – src/styles/components.css`
- `M – tests/e2e/access-control.spec.mjs`
- `A – tests/unit/contribution-view-rules.test.mjs`
- `M – tests/unit/transaction-service.test.mjs`
- `A – tests/unit/year-comparison.test.mjs`


### Finanzübersicht und Schnellzugriffe erweitert

- Einnahmen und Ausgaben zeigen zusätzlich den Vergleich zum gleichen
  Vorjahreszeitraum; ein Vergleich wird nur bei vorhandenen Daten für den
  vollständigen Vergleichszeitraum angezeigt.
- Offene Abgleichswerte für Bank und PayPal führen mit passenden Konten- und
  Abgleichfiltern direkt zur Buchungsliste.
- Kennzahlen für offene und überfällige Beiträge filtern die Mitgliederliste
  direkt.
- Buchungs- und Auswertungsbereiche ein- und ausklappbar gemacht; letzte
  Buchungen, offene Beitragssummen und die Dringlichkeitssortierung in der
  Finanzübersicht ergänzt.
- Beitragsfilter, Vorjahresvergleich, Buchungszugriffe und UI-Schnellfilter
  durch Unit- und Playwright-Tests abgedeckt.
- README und Copilot-Projektanweisungen zur Oberfläche und Modulstruktur
  aktualisiert.

## 2026-10-10
### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-10:
- `M – .github/copilot-instructions.md`
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `A – src/scripts/csv-import-controller.mjs`
- `A – src/scripts/transaction-view.mjs`
- `M – src/styles/components.css`
- `M – tests/e2e/access-control.spec.mjs`
- `M – tests/e2e/contribution-workflows.spec.mjs`

### Finanzbereiche und App-Module strukturiert

- Finanzseite in die Bereiche Übersicht, Beiträge und Buchungen gegliedert;
  offene und überfällige Beiträge werden in der Navigation gezählt und in der
  Übersicht hervorgehoben.
- Buchungsansicht und CSV-Import in eigene Module ausgelagert und die
  Navigation sowie direkten Wege zur Beitragstabelle mit Playwright ergänzt.
- README und Copilot-Projektanweisungen zur aktualisierten Modulstruktur
  überarbeitet.

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-10:
- `M – .github/copilot-instructions.md`
- `M – .github/workflows/conventional-commits.yml`
- `M – .github/workflows/pages.yml`
- `A – .github/workflows/tests.yml`
- `A – .gitignore`
- `M – README.md`
- `A – package-lock.json`
- `A – package.json`
- `A – playwright.config.mjs`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `A – src/scripts/auth-service.mjs`
- `A – src/scripts/contribution-service.mjs`
- `A – src/scripts/csv-rules.mjs`
- `A – src/scripts/finance-rules.mjs`
- `A – src/scripts/latest-request.mjs`
- `A – src/scripts/recurring-service.mjs`
- `A – src/scripts/transaction-service.mjs`
- `A – supabase/tests/contribution_rules.test.sql`
- `A – tests/db/run.mjs`
- `A – tests/e2e/access-control.spec.mjs`
- `A – tests/e2e/contribution-workflows.spec.mjs`
- `A – tests/e2e/fixtures/preview.csv`
- `A – tests/e2e/static-server.mjs`
- `A – tests/unit/contribution-service.test.mjs`
- `A – tests/unit/csv-rules.test.mjs`
- `A – tests/unit/finance-rules.test.mjs`
- `A – tests/unit/request-gate.test.mjs`
- `A – tests/unit/transaction-service.test.mjs`

### Tests, Stabilität und Modulstruktur erweitert

- Node-Testabdeckung für Datums-/Beitragsregeln, CSV-Import und -Export,
  Authentifizierungs-/Datenzugriffe ergänzt; Playwright- und pgTAP-Teststrecken
  für lokale Entwicklungsumgebungen vorbereitet.
- Playwright auf Version 1.64 aktualisiert und README um Befehle und
  Voraussetzungen zum Ausführen der Unit-, Datenbank- und Browser-Tests ergänzt.
- GitHub-Actions-Workflow für Unit-Tests und Syntaxprüfung eingerichtet und
  vorhandene Workflow-Dateien kommentiert.
- Buchungs-, Authentifizierungs- und Wiederholungszugriffe in Services
  ausgelagert; CSV-Regeln und Beitragslogik separat testbar gemacht.
- Veraltete Antworten bei Filter- und Sitzungswechseln entwertet.
- CSV-Import auf 5 MB und 500 Datensätze begrenzt; Vorschau auf Seiten mit je
  50 Zeilen aufgeteilt und Dateibeispiele an den Verwaltungsbeginn angepasst.
- README und Copilot-Projektanweisungen zur Testausführung und Modulstruktur
  aktualisiert.

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-10:
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-10:
- `M – .github/copilot-instructions.md`
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`
- `M – supabase/schema.sql`


### Kassenverwaltung und responsives Design verbessert

- Datumsfilter korrigiert: Ein explizites Startdatum hat Vorrang vor dem
  Jahresbeginn, während die Verwaltungsgrenze 01.10.2026 erhalten bleibt.
- Wiederholungsbuchungen zusätzlich in der Datenbank auf Fälligkeiten ab dem
  01.10.2026 begrenzt.
- Einnahmen für Beitragszuordnungen durchsuchbar und seitenweise ladbar gemacht.
- Beitragssätze mit wählbarem Wirksamkeitsquartal historisiert; Vorauszahlungen
  über Satzwechsel werden anhand der je Quartal gültigen Beträge validiert und
  bereits erfasste Quartalsbeträge als Snapshot bewahrt.
- Finanzübersicht visuell vereinfacht und responsives Layout für Filter,
  Kennzahlen, Beitragsverwaltung und Buchungsliste verbessert; die
  Gesamtsaldokarte an die Höhe der übrigen Kennzahlenkarten angeglichen.
- README und repository-spezifische Copilot-Anweisungen aktualisiert.
- Beitragsfrist auf den 15. des ersten Quartalsmonats festgelegt; offene
  Beiträge sind bis einschließlich Frist orange und danach rot markiert.
- README gekürzt, in fachliche und Developer-Anleitung gegliedert und mit
  Mermaid-Diagrammen zu Buchungen, Beitragsstatus und Architektur ergänzt.
- Gesamtsaldo-Karte auf dieselbe Höhe wie Einnahmen- und Ausgabenkarten gebracht.

## 2026-10-02
### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-02:
- `A – .github/copilot-instructions.md`
- `M – README.md`
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/styles/components.css`
- `M – supabase/schema.sql`


### Quartalsbeiträge, Kassenstart und Oberflächenüberarbeitung

- Beitragsübersicht pro Mitglied und Quartal mit Status für bezahlt, heute
  fällig, überfällig und noch nicht fällig ergänzt; Fälligkeit ist jeweils am
  Quartalsende.
- Admin-Verwaltung für Mitglieder, Quartalsbeitrag sowie Zuordnung von
  Einnahmebuchungen zu einem oder mehreren Quartalen ergänzt.
- Verwaltung auf den 01.10.2026 begrenzt; ältere Buchungen, Änderungsverläufe
  und Beitragszuordnungen werden beim Ausführen der Supabase-Migration
  endgültig gelöscht. Vorher ein Datenbank-Backup erstellen.
- Eingabefelder für Bank- und PayPal-Startsaldo ergänzt und Kontosalden mit
  Buchungen ab dem Startdatum verknüpft.
- Datumsfilter, manuelle Buchungen, CSV-Import und Beitragszuordnungen auf den
  neuen Verwaltungszeitraum begrenzt.
- Kassenübersicht, Filter, Buchungsliste, Dialoge und mobile Darstellung
  visuell überarbeitet.
- Repository-spezifische GitHub-Copilot-Anweisungen ergänzt und README zur
  Beitragsverwaltung sowie zum Kassenstart aktualisiert.

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

## 2026-10-17

### Version 1.3.1

- ci: add automatic release workflow

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-17:
- `M – tests/e2e/access-control.spec.mjs`
- `M – tests/e2e/contribution-workflows.spec.mjs`


### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-17:
- `M – src/index.html`
- `M – src/scripts/app.js`
- `M – src/scripts/transaction-view.mjs`
- `M – src/styles/base.css`
- `M – src/styles/components.css`


## 2026-10-18
### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `M – src/scripts/transaction-service.mjs`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `A – .github/workflows/release.yml`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `M – VERSION`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `M – src/scripts/app.js`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `M – src/scripts/contribution-service.mjs`
- `M – src/scripts/transaction-service.mjs`
- `M – src/scripts/transaction-view.mjs`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `M – VERSION`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `M – .github/workflows/tests.yml`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `A – tests/e2e/placeholder.spec.mjs`


### Änderungen aus diesem Commit

- Aktualisiert am 2026-10-18:
- `D – tests/e2e/access-control.spec.mjs`
- `D – tests/e2e/contribution-workflows.spec.mjs`

