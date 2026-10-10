# UHC Prinzen – Mannschaftskasse

Die Anwendung verwaltet die Mannschaftskasse der Wesselbleker Prinzen. Sie
zeigt Bank- und PayPal-Salden, Einnahmen und Ausgaben sowie den Zahlungsstatus
der Quartalsbeiträge. Mitglieder sehen die Finanzübersicht nach der Anmeldung;
Administratoren verwalten Buchungen, Beiträge und Einstellungen.

## Fachliche Anleitung

### Anmelden und Überblick

Jedes Mitglied meldet sich mit einem persönlichen Supabase-Konto an. Die
Finanzdaten sind nur nach der Anmeldung sichtbar. Die Übersicht zeigt den
Gesamtsaldo sowie die Bank- und PayPal-Salden, Einnahmen, Ausgaben und
Auswertungen für den ausgewählten Zeitraum.
Die Bereiche Übersicht, Beiträge und Buchungen lassen sich über eine kompakte
Navigation direkt öffnen. Offene und überfällige Beiträge des gewählten
Beitragsjahres werden dort hervorgehoben und sind direkt erreichbar.

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

Die Node-Test-Suite prüft Datums- und Beitragsregeln, Supabase-Zugriffe für
Beiträge sowie CSV-Import und -Export einschließlich Formel-Schutz. GitHub
Actions führt diese Unit-Tests und eine JavaScript-Syntaxprüfung bei Pull
Requests und Pushes auf `main` aus. Die SQL- und Browser-Tests sind optional
und werden bei Bedarf separat gestartet:

```sh
npm run test:db
npm run test:e2e
```

Für `test:db` ist die unten beschriebene lokale Wegwerf-Datenbank erforderlich.
Für `test:e2e` müssen die Browserabhängigkeiten installiert und – für die
Mitglieds-/Admin- sowie Beitragsabläufe – lokale Testkonten und Testdaten
konfiguriert sein.

Die SQL-Integrationstests prüfen Beitragsraten, Zahlungszuordnungen, historische
Snapshots, Berechtigungen und die Sperre für Wiederholungsbuchungen. Sie setzen
eine **lokale, wegwerfbare Supabase/PostgreSQL-Datenbank** voraus, auf der
`supabase/base-schema.sql` und anschließend `supabase/schema.sql` installiert
sind. Die Migration löscht Buchungen vor dem 01.10.2026; führe sie niemals für
Tests auf einer Produktivdatenbank aus. Danach:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
ALLOW_DATABASE_TESTS=1 npm run test:db
```

Die Datenbanktests benötigen `psql` und die PostgreSQL-Erweiterung `pgtap`.
Der Runner verweigert nicht-lokale Verbindungen und verlangt die explizite
Freigabe `ALLOW_DATABASE_TESTS=1`.

Optionale Browser-E2E-Tests prüfen Mitglieder-/Admin-Zugriff, CSV-Vorschau,
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
- `src/scripts/csv-import-controller.mjs` – CSV-Importdialog, Mapping, Prüfung und Vorschau
- `src/scripts/auth-service.mjs` – Supabase-Authentifizierung und Sitzungszugriff
- `src/scripts/transaction-service.mjs` – Buchungs-, Kategorien-, Export- und Verlaufszugriffe
- `src/scripts/recurring-service.mjs` – Laden und Verwalten von Wiederholungsbuchungen
- `src/scripts/latest-request.mjs` – verwirft verspätete Antworten älterer Filterabfragen
- `src/scripts/finance-rules.mjs` – testbare Datums- und Beitragsregeln
- `src/scripts/contribution-service.mjs` – Supabase-Datenzugriffe für Beiträge
- `src/scripts/csv-rules.mjs` – CSV-Parsing, Normalisierung und Importregeln
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

### Supabase einrichten

Für ein neues Projekt zuerst `supabase/base-schema.sql`, danach
`supabase/schema.sql` im Supabase SQL Editor ausführen. Bei einem bestehenden
Projekt nur `supabase/schema.sql` ausführen. **Das Delta-Skript löscht
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

Ein Push auf `main` veröffentlicht `src/` über die GitHub Action automatisch
auf GitHub Pages. Der versionierte Hook ergänzt beim Commit die geänderten
Dateien im `CHANGELOG.md`. Einmal pro Clone aktivieren:

```sh
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```
