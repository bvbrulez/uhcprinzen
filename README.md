# UHC Prinzen – Mannschaftskasse

Die Anwendung verwaltet die Mannschaftskasse der Wesselbleker Prinzen. Sie
zeigt Bank- und PayPal-Salden, Einnahmen und Ausgaben sowie den Zahlungsstatus
der Quartalsbeiträge. Mitglieder sehen die Finanzübersicht nach der Anmeldung;
Administratoren verwalten Buchungen, Beiträge und Einstellungen.

## Fachliche Anleitung

### Anmelden und Überblick

Jedes Mitglied meldet sich mit einem persönlichen Supabase-Konto an. Die
Finanzdaten sind nur nach der Anmeldung sichtbar. Die Übersicht zeigt den
Gesamtsaldo sowie die Bank- und PayPal-Salden für den ausgewählten Zeitraum.
Gesamteinnahmen und Gesamtausgaben beziehen sich unabhängig von den Filtern auf
das laufende Kalenderjahr bis heute und umfassen beide Konten. Soweit ein
vollständiger Vergleichszeitraum vorhanden ist, zeigen die Karten zusätzlich
die Veränderung gegenüber demselben Zeitraum des Vorjahres.
Die Bereiche Übersicht, Beiträge und Buchungen lassen sich über eine kompakte
Navigation direkt öffnen. Offene und überfällige Beiträge des gewählten
Beitragsjahres werden dort hervorgehoben und sind direkt erreichbar.
In der Beitragsübersicht können Mitglieder nach Namen und Zahlungsstatus
filtern. Auf kleinen Bildschirmen zeigen Buchungskarten zuerst die wichtigsten
Angaben; weitere Details und Verwaltungsaktionen lassen sich bei Bedarf öffnen.
Die Kennzahlen für offene und überfällige Beiträge filtern die Mitgliederliste
direkt. Offene Abgleiche in der Übersicht öffnen die gefilterte Buchungsliste
für das jeweilige Konto.
Die Bereiche „Buchungen“ und „Auswertungen“ lassen sich in der Buchungsansicht
bei Bedarf ein- und ausklappen.
Die Beitragsliste priorisiert offene Fälle und weist den offenen Jahresbetrag
je Mitglied aus. Auf der Finanzübersicht werden zusätzlich die fünf jüngsten
Buchungen direkt angezeigt. Kennzahlen zu offenen Abgleichen und Beiträgen
führen direkt zu den passenden Buchungs- beziehungsweise Mitgliederfiltern.
Offene Quartale können im Adminbereich direkt der vorausgewählten Person und
dem Quartal zugeordnet werden. Administratoren sehen außerdem fällige
Wiederholungsbuchungen und können den Zeitraum der Übersicht schnell auf den
aktuellen Monat, das Jahr oder benutzerdefinierte Daten stellen. Die
Monats-/Jahresauswahl steuert Kontosalden und Auswertungen; Einnahmen- und
Ausgabenjahressummen bleiben auf das laufende Jahr bis heute bezogen.

### Buchungen und Auswertungen

Administratoren können Einnahmen und Ausgaben erfassen, ändern, löschen oder
gelöschte Buchungen wiederherstellen. Buchungen lassen sich nach Zeitraum,
Konto, Text, Buchungsart und Abgleichstatus filtern. Gespeicherte Filter bleiben
im jeweiligen Browser erhalten.

CSV-Dateien bis 5 MB und 500 Buchungen können vor dem Import geprüft und
angepasst werden; die Vorschau ist in Seiten zu 50 Zeilen aufgeteilt. PDF- und
CSV-Exporte verwenden die aktiven Filter. Exporte sind auf 5.000 Buchungen
begrenzt. Buchungen können nach dem Abgleich mit dem Kontoauszug einzeln oder
gesammelt als abgeglichen markiert werden. Wiederholungsbuchungen werden als
Vorlagen gepflegt und nur nach manueller Bestätigung erzeugt.

Administratoren können zu einer Buchung einen PDF-, JPEG-, PNG- oder
WebP-Beleg bis 10 MB hochladen, ersetzen oder entfernen. Belege werden privat
gespeichert; angemeldete Mitglieder können Belege aktiver Buchungen über einen
kurzlebigen, signierten Link ansehen. Der Monatsabschluss führt durch die
Prüfung von Buchungen, Abgleichen, Quartalsbeiträgen und fälligen
Wiederholungen. Nach Bestätigung aller Prüfschritte lässt sich ein
eigenständiger HTML-Monatsbericht herunterladen und lokal archivieren. Er wird
nicht automatisch in der Datenbank abgelegt. Der laufende Monat ist
vorläufig; der Wiederholungsstatus im Bericht zeigt den Stand bei Erstellung.

```mermaid
flowchart LR
    M[Mitglied] --> V[Finanzübersicht ansehen]
    A[Administrator] --> B[Buchungen verwalten]
    A --> I[CSV importieren]
    A --> W[Wiederholungen pflegen]
    B --> F[Filtern und auswerten]
    I --> F
    W --> B
    F --> E[PDF oder CSV exportieren]
    B --> K[Mit Kontoauszug abgleichen]
```

### Quartalsbeiträge

Die Kassenverwaltung beginnt am **01.10.2026**. Administratoren tragen den
Bank- und PayPal-Startsaldo zu diesem Datum ein. Frühere Buchungen werden nicht
in die Verwaltung übernommen.

Die Beitragsübersicht zeigt den Status jedes Mitglieds ab Q4 2026. Der Beitrag
ist bis einschließlich **15. des ersten Monats im Quartal** fällig: Offene
Beiträge sind bis zu diesem Datum orange, ab dem 16. rot und überfällig.
Beiträge künftiger Quartale sind als noch nicht fällig gekennzeichnet.

Administratoren verwalten die Mitgliederliste und können Beitragssätze ab einem
Quartal festlegen. Ein Satz gilt ab seinem Wirksamkeitsquartal bis zum nächsten
Satz. Eine Einnahmebuchung kann einem Mitglied und einem oder mehreren
aufeinanderfolgenden Quartalen zugeordnet werden. Der Buchungsbetrag muss der
Summe der in diesen Quartalen gültigen Beitragssätze entsprechen; gespeicherte
Zuordnungen behalten ihre ursprünglichen Quartalsbeträge. Korrekturen erfolgen
durch Aufheben der gesamten Zuordnung, nicht durch Ändern der Zahlung.

```mermaid
flowchart TD
    S[Quartalsbeginn] --> D{Zahlung zugeordnet?}
    D -- Ja --> P[Bezahlt]
    D -- Nein --> Q{Quartal bereits begonnen?}
    Q -- Nein --> Z[Noch nicht fällig]
    Q -- Ja --> T{Heute am oder vor dem 15.?}
    T -- Ja --> O[Offen · orange]
    T -- Nein --> U[Überfällig · rot]
    A[Admin: Beitragssatz ab Quartal festlegen] --> R[Satz gilt bis zum nächsten Satz]
    R --> C[Zuordnung prüft Summe der Quartalssätze]
    C --> P
```

## Developer-Anleitung

### Lokal starten

Die Anwendung ist statisch und benötigt keinen Build-Schritt oder eigenen
Anwendungsserver. Zum lokalen Ausführen genügt ein statischer HTTP-Server:

```sh
python3 -m http.server 8080 --directory src
```

Anschließend <http://localhost:8080> öffnen. Für die App selbst ist kein
Build-Schritt erforderlich. Die Testwerkzeuge verwenden Node.js und npm.

### Automatisierte Tests

```sh
npm ci
npm test
```

Die Node-Test-Suite prüft Datums- und Beitragsregeln, Filter der
Beitragsübersicht, Supabase-Zugriffe für Beiträge und Belege sowie CSV-Import
und -Export einschließlich Formel-Schutz. GitHub Actions führt bei Pull
Requests und vor jedem Pages-Deployment Unit-, SQL- und Browsertests gegen
eine frische, lokale Supabase-Instanz aus. Dafür werden keine
Produktivzugangsdaten verwendet. Die gleichen lokalen Integrationstests lassen
sich manuell starten:

```sh
npm run test:db
npm run test:e2e
```

Für `test:db` ist die unten beschriebene lokale Wegwerf-Datenbank erforderlich;
installiere das Schema dort vorher mit `npm run test:db:install`.
Für `test:e2e` müssen die Browserabhängigkeiten installiert und – für die
Mitglieds-/Admin- sowie Beitragsabläufe – lokale Testkonten und Testdaten
konfiguriert sein.

Für lokale SQL- und Browser-Integrationstests Docker und die Supabase CLI
installieren und die flüchtige Instanz aus `supabase/config.toml` mit
`supabase start` starten. Die SQL-Integrationstests prüfen Beitragsraten,
Zahlungszuordnungen, historische Snapshots, Berechtigungen und die Sperre für
Wiederholungsbuchungen. Sie setzen eine **lokale, wegwerfbare
Supabase/PostgreSQL-Datenbank** mit `psql` und pgTAP voraus. Das
Installationsskript prüft Loopback-Adresse und explizite Freigabe, bevor es
`supabase/base-schema.sql` und danach `supabase/schema.sql` ausführt:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
ALLOW_DATABASE_TESTS=1 npm run test:db
```

Das Delta löscht historische Buchungen vor dem 01.10.2026. Installiere es
ausschließlich in lokalen Wegwerf- oder ausdrücklich dafür vorgesehenen
Testdatenbanken, niemals in Produktion.

Eine frische lokale Datenbank wird ausschließlich mit diesem loopback-geprüften
Befehl eingerichtet:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
ALLOW_DATABASE_TESTS=1 npm run test:db:install
```

Browser-E2E-Tests prüfen Mitglieder-/Admin-Zugriff, Monatsabschluss, CSV-Vorschau,
Einnahmen-Paginierung und – mit einem vorbereiteten, unzugeordneten Testbeitrag –
die komplette Quartalszuordnung samt Aufräumen. Sie benötigen Chromium und
lokale Supabase-Testkonten:

```sh
npx playwright install chromium
export E2E_SUPABASE_URL=http://127.0.0.1:54321
export E2E_SUPABASE_ANON_KEY="your-local-anon-key"
export E2E_MEMBER_EMAIL="member@example.test"
export E2E_MEMBER_PASSWORD="your-local-password"
export E2E_ADMIN_EMAIL="admin@example.test"
export E2E_ADMIN_PASSWORD="your-local-password"
npm run test:e2e
```

Der erste Befehl installiert Chromium für die im Projekt installierte neueste
Playwright-Version. Nach dem Setup lassen sich die E2E-Tests jederzeit mit
`npm run test:e2e` erneut ausführen.

Das Skript `tests/e2e/create-local-users.mjs` kann mit lokalen
`SUPABASE_SERVICE_ROLE_KEY`- und `E2E_*`-Werten Administrator- und
Mitgliedskonten anlegen; es verweigert Verbindungen außerhalb von Loopback.
Die E2E-Testseite überschreibt die Browserkonfiguration ausschließlich für
den Testserver und lässt nur Loopback-Supabase-URLs zu; verwende keine
Produktivkonten. Für die Paginierungsprüfung mit mindestens 101 unzugeordneten
Einnahmen `E2E_EXPECT_OLDER_INCOME=1` setzen. Für eine vollständige
Zuordnungsprüfung zusätzlich `E2E_PAYMENT_MEMBER`, `E2E_PAYMENT_SEARCH`,
`E2E_PAYMENT_FIRST_QUARTER` und optional `E2E_PAYMENT_QUARTER_COUNT` setzen.
Die Testbuchung muss den gültigen Quartalssätzen entsprechen und die Quartale
müssen für das Testmitglied offen sein. Die Zuordnung wird nach erfolgreichem
Test wieder aufgehoben; die Einnahmebuchung bleibt bestehen. Ohne diese
Umgebungsvariablen werden die passenden E2E-Tests übersprungen.

### Architektur

- `src/index.html` – Seitenstruktur und Dialoge
- `src/scripts/app.js` – Benutzeroberfläche und Ereignissteuerung
- `src/scripts/transaction-view.mjs` – Buchungstabelle, Finanzkennzahlen und Auswertungen
- `src/scripts/year-comparison.mjs` – Vorjahresvergleich und Darstellung der Veränderung
- `src/scripts/csv-import-controller.mjs` – CSV-Importdialog, Mapping, Prüfung und Vorschau
- `src/scripts/auth-service.mjs` – Supabase-Authentifizierung und Sitzungszugriff
- `src/scripts/transaction-service.mjs` – Buchungs-, Kategorien-, Export- und Verlaufszugriffe
- `src/scripts/month-close.mjs` – Monatsabschluss-Prüfliste und Archivbericht
- `src/scripts/recurring-service.mjs` – Laden und Verwalten von Wiederholungsbuchungen
- `src/scripts/latest-request.mjs` – verwirft verspätete Antworten älterer Filterabfragen
- `src/scripts/finance-rules.mjs` – testbare Datums- und Beitragsregeln
- `src/scripts/contribution-service.mjs` – Supabase-Datenzugriffe für Beiträge
- `src/scripts/contribution-view-rules.mjs` – testbare Filterregeln für die Mitglieder-Beitragsübersicht
- `src/scripts/csv-rules.mjs` – CSV-Parsing, Normalisierung und Importregeln
- `supabase/migrations/` – versionierte, vorwärtsgerichtete SQL-Änderungen
- `src/styles/` – Layout und responsive Gestaltung
- `src/supabase-config.js` – öffentliche Supabase-Projekt-URL und anon key
- `supabase/base-schema.sql` – Grundschema für ein neues Projekt
- `supabase/schema.sql` – Delta-Schema für bestehende Projekte

```mermaid
flowchart LR
    Browser[Browser: HTML, CSS und JavaScript] -->|anon key + Sitzung| Supabase[Supabase]
    Supabase --> Auth[Authentication]
    Supabase --> DB[(Postgres)]
    DB --> RLS[RLS und Datenbankfunktionen]
    RLS -->|autorisierte Daten und Aktionen| Browser
    GitHub[Push auf main] --> Pages[GitHub Actions: GitHub Pages]
    Pages --> Browser
```

### Sicherungen und Schemaänderungen

Vor jeder produktiven Schemaänderung eine aktuelle Sicherung über die
Supabase-Projektsicherung oder einen freigegebenen `pg_dump`-Ablauf erstellen
und prüfen. Datenbank-Dumps enthalten vertrauliche Finanz- und Mitgliederdaten:
ausschließlich verschlüsselt und zugriffsbeschränkt speichern, niemals in Git
oder CI-Artefakten ablegen. Mit `pg_restore --list datei.dump` lässt sich ein
Custom-Format-Dump vor dem Restore auf Lesbarkeit prüfen. Ein Datenbank-Dump
enthält nicht die privaten Dateien aus dem Storage-Bucket; deren Sicherung muss
separat über einen freigegebenen Storage-Backup-Prozess erfolgen.

Für einen freigegebenen lokalen `pg_dump`-Ablauf Zugangsdaten aus dem
geheimnisgeschützten Passwortspeicher verwenden, nicht in die Shell-Historie
schreiben:

```sh
umask 077
pg_dump --format=custom --file=uhc-prinzen-backup.dump "$PRODUCTION_DB_URL"
pg_restore --list uhc-prinzen-backup.dump
```

Einen Restore zuerst in ein **separates, leeres Staging-/Testprojekt**
durchführen, zum Beispiel mit
`pg_restore --exit-on-error --no-owner --no-acl --dbname="$STAGING_DB_URL" datei.dump`.
Danach Tabellen, Policies, Funktionen und Belegdateien stichprobenartig prüfen.
Niemals `--clean` oder einen Restore ungeprüft gegen die aktive
Produktionsdatenbank ausführen. Wiederherstellungsschritte regelmäßig anhand
einer aktuellen Sicherung testen und verschlüsselte Backups entsprechend den
geltenden Aufbewahrungsfristen aufbewahren.

Neue Änderungen für bestehende Installationen kommen als fortlaufend
nummerierte SQL-Dateien nach `supabase/migrations/` und werden geprüft,
gesichert und zuerst in Staging getestet. Die Datei
`20261014080000_contribution_rates_revoke_write.sql` entfernt geerbte
Schreibrechte auf Beitragssätzen, und
`20261014090000_transaction_receipt_member_read.sql` ergänzt die Lesepolicy
für Belege. Beide sind für Projekte gedacht, die das bisherige Schema bereits
installiert haben; in der Reihenfolge des Zeitstempels ausführen. Neue
Projekte verwenden weiterhin die Reihenfolge
`base-schema.sql` und danach `schema.sql`. Das bestehende
`supabase/schema.sql` ist ein historisches Delta-/Setup-Skript und bereinigt
Buchungen vor dem 01.10.2026 samt Zuordnungen; es ist **keine** sichere,
automatisch ausführbare Produktionsmigration.

Die Beitragssatz-Migration überspringt ihre Änderung mit einer SQL-Hinweis-
meldung, falls `public.team_contribution_rates` noch nicht angelegt wurde.
Diese Tabelle gehört zum vollständigen Anwendungsschema: fehlende Tabellen
nicht durch blindes Ausführen des historischen Delta-Skripts auf einer
Produktivdatenbank nachholen, sondern zuerst Backup, Datenbankstand und
Upgradepfad prüfen.

### Supabase einrichten

Für ein neues Projekt zuerst `supabase/base-schema.sql`, danach
`supabase/schema.sql` im Supabase SQL Editor ausführen. Für ein bestehendes,
bereits aktualisiertes Projekt vor Änderungen ausschließlich die passende neue
Migration aus `supabase/migrations/` ausführen; ältere Zwischenstände brauchen
eine geprüfte und gesicherte Upgradeplanung. **Das Delta-Skript löscht
Buchungen vor dem 01.10.2026 samt zugehörigem Änderungsverlauf und
Beitragszuordnungen endgültig. Vor der Ausführung ein Datenbank-Backup
erstellen.** Belegdateien im Storage werden dabei nicht gelöscht.

Die Projekt-URL und der **anon public key** gehören in
`src/supabase-config.js`. Niemals den `service_role`-Key im Frontend oder in
versionierten Dateien hinterlegen. RLS und Datenbankfunktionen erzwingen die
Berechtigungen zusätzlich zur Oberfläche.

Mitglieder benötigen jeweils einen eigenen Benutzer unter
**Authentication → Users**. Administratoren erhalten serverseitig
`app_metadata.role: "admin"`; `bvbrulez@gmail.com` ist zusätzlich als
Administrator fest hinterlegt. Rollenänderungen ausschließlich über einen
vertrauenswürdigen Supabase-Admin-Kontext vornehmen, nie aus dem Browser.

### Deployment und Changelog

Ein Push auf `main` veröffentlicht `src/` auf GitHub Pages, nachdem Unit-,
SQL- und lokale Supabase-Browsertests für denselben Commit erfolgreich waren.
Der versionierte Hook ergänzt beim Commit die geänderten Dateien im
`CHANGELOG.md`. Einmal pro Clone aktivieren:

```sh
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```
