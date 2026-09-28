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
3. Bei einem neuen Supabase-Projekt zuerst
   [`supabase/base-schema.sql`](supabase/base-schema.sql), anschließend
   [`supabase/schema.sql`](supabase/schema.sql) ausführen. Bei einem
   bestehenden Projekt nur das Delta-Skript `supabase/schema.sql` ausführen.
   Es ergänzt Konto- und Audit-Spalten, Soft-Delete, Index, Trigger,
   gefilterte Reporting-Funktionen und die aktuellen RLS-Policies. Nach
   Schemaänderungen muss das Delta-Skript erneut ausgeführt werden.
4. Buchungen dürfen nur Administratoren anlegen, bearbeiten oder löschen.
   `bvbrulez@gmail.com` ist als Admin fest zugelassen; weitere Admins benötigen
   serverseitig `app_metadata.role: "admin"`. Diese Rolle ausschließlich über
   einen vertrauenswürdigen Supabase-Admin-Kontext vergeben (Admin API,
   `auth.admin.updateUserById`), niemals über `user_metadata` oder aus dem
   Browser. Änderungen an `app_metadata` werden nach Erneuerung der Sitzung
   bzw. erneuter Anmeldung wirksam. Alle angemeldeten Mitglieder behalten
   Lesezugriff.

5. Unter **Authentication → Users** die berechtigten Mitglieder anlegen. Der
   Login-Bereich verwendet Supabase `signInWithPassword` und stellt bestehende
   Sessions beim Laden der Seite automatisch wieder her.
   Für den Lesezugang einen Auth-Benutzer mit Name `Prinzenkroeten`, gültiger
   E-Mail-Adresse und einem eigenen sicheren Passwort anlegen. In dessen
   `user_metadata` `display_name: "Prinzenkroeten"` setzen; `app_metadata`
   erhält ausdrücklich keine Admin-Rolle. Der Benutzer meldet sich mit der
   E-Mail-Adresse und dem vergebenen Passwort an und erhält nur Lesezugriff.
   Für den Passwort-Reset die GitHub-Pages-URL unter **Authentication → URL
   Configuration → Redirect URLs** freigeben. Der Link wird an die eingegebene
   E-Mail gesendet; die Anwendung speichert oder verarbeitet kein bestehendes
   Passwort.
6. Die Seite über GitHub Pages veröffentlichen oder `src/` auf einen statischen
   Webserver deployen.

## Buchungsverwaltung

Monats- und Kategorieauswertungen übernehmen Jahr, Buchungsart und Suche sowie
optional den Konto-Summenfilter. Der PDF-Export lädt Buchungen in Seiten zu je
500 Einträgen und zeigt währenddessen den Fortschritt an. Kategorien werden
zentral in `transaction_categories` verwaltet. Administratoren können sie in
der Oberfläche ergänzen oder entfernen; Kategorien, die noch in Buchungen
verwendet werden, schützt ein Fremdschlüssel vor dem Löschen. Bestehende
Kategorien werden bei der Migration übernommen.

PDF-Exporte sind auf 5.000 Buchungen begrenzt, um Browser-Speicher und
Druckansicht zu schützen. Bei größeren Treffermengen bitte Zeitraum, Konto
oder Suchfilter eingrenzen.

## Admin-Zugänge verwalten

Admin-Rechte liegen ausschließlich in Supabase `app_metadata.role`. Zum
Befördern oder Zurückstufen `app_metadata` über eine vertrauenswürdige
Supabase-Admin-API (`auth.admin.updateUserById`) auf `{"role":"admin"}` setzen
bzw. die `role` entfernen. Vorher die Benutzer-ID unter **Authentication →
Users** prüfen; anschließend die Rolle über einen geschützten Server-/Admin-
Kontext setzen. Zum Entziehen `app_metadata` aktualisieren und die aktive
Session des Benutzers widerrufen bzw. erneuern. Niemals den Service-Role-Key
im Frontend, in Git-Dateien oder in einem öffentlichen Script hinterlegen.
Die Benutzeroberfläche zeigt die aus dem aktuellen JWT gelesene Rolle; die
RLS-Policies in `supabase/schema.sql` erzwingen sie unabhängig davon.

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
