# Changelog

Alle Änderungen sind chronologisch nach Commit aufgeführt.

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
- `A – .githooks/README.md`
- `A – .githooks/pre-commit`
- `M – README.md`

### Änderungen aus diesem Commit

- Aktualisiert am 2026-09-24:
- `A – .githooks/README.md`
- `A – .githooks/pre-commit`
- `M – README.md`


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
