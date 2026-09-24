# UHC Prinzen

Statische Frontend-Anwendung für die Wesselbleker Prinzen, aufgebaut wie die
Referenzanwendung `balkonkraftwerk`. Die Seite benötigt keinen eigenen Server:
öffentliche Inhalte und die Mannschaftskasse werden direkt aus Supabase geladen.

## Lokal starten

Die Anwendung kann mit jedem statischen HTTP-Server gestartet werden, zum Beispiel:

```sh
python3 -m http.server 8080 --directory src
```

Danach ist die Seite unter <http://localhost:8080> erreichbar. Ohne
Supabase-Konfiguration bleibt die Finanzübersicht deaktiviert.

## Supabase einrichten

1. Das konfigurierte Projekt ist `boymeoxuwnhountijfml.supabase.co`.
2. Falls ein anderes Supabase-Projekt verwendet werden soll, die Projekt-URL
   und den **anon public key** in `src/supabase-config.js` ersetzen. Der
   `service_role`-Key darf niemals in den Browser gelangen.
3. Den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) vollständig im
   Supabase SQL Editor ausführen. Dadurch wird die von der Finanzübersicht
   erwartete Tabelle `public.transactions` inklusive Konto-Spalte (`BANK` oder
   `PAYPAL`) und Zugriffsschutz angelegt bzw. aktualisiert.

4. Unter **Authentication → Users** die berechtigten Mitglieder anlegen. Der
   Login-Bereich verwendet Supabase `signInWithPassword` und stellt bestehende
   Sessions beim Laden der Seite automatisch wieder her.
5. Die Seite über GitHub Pages veröffentlichen oder `src/` auf einen statischen
   Webserver deployen.

## Deployment

Die GitHub-Action veröffentlicht `src/` bei jedem Push auf `main` automatisch
als GitHub-Pages-Seite.

## Automatischer Changelog

Die versionierten Git-Hooks einmalig aktivieren:

```sh
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

Der `pre-commit`-Hook ergänzt vor jedem Commit die am aktuellen Tag geänderten
Dateien in `CHANGELOG.md`. Beim anschließenden Push ist der Changelog damit
bereits Bestandteil des Commits.
