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
