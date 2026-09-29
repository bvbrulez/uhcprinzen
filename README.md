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
   Es ergänzt Konto- und Audit-Spalten, Soft-Delete, Kategorien,
   Wiederholungsbuchungen, den Änderungsverlauf, gefilterte Reporting-Funktionen
   und die aktuellen RLS-Policies. Nach Schemaänderungen muss das Delta-Skript
   erneut ausgeführt werden.
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

Administratoren können bis zu 500 Buchungen aus CSV-Dateien importieren.
Profile für Sparkasse, Volks-/Raiffeisenbank, Deutsche Bank/Postbank, PayPal
und Standard-CSV schlagen passende Spaltenzuordnungen vor; diese lassen sich
vor dem Import anpassen. Ein Beispiel-CSV-Download zeigt das unterstützte
Format. Beträge mit Vorzeichen sowie getrennte Soll-/Haben-Spalten bestimmen
automatisch Einnahme oder Ausgabe, wenn keine passende Art-Spalte vorhanden
ist. Die Vorschau markiert ungültige Zeilen sowie exakte Dubletten anhand von
Datum, Buchungsart, Konto, Beschreibung und Betrag; markierte Zeilen werden
übersprungen. CSV-Dateien benötigen eine Kopfzeile und ein Datum im ISO- oder
deutschen Format. Ohne Kontospalte wird das Bankkonto, ohne Kategoriespalte
„Sonstiges“ verwendet.

Neben dem PDF kann die gefilterte Buchungsliste als UTF-8-CSV exportiert und in
Tabellenkalkulationen geöffnet werden. Der Export berücksichtigt Jahr, Konto,
Buchungsart und Suche, ist auf 5.000 Buchungen begrenzt und schützt Textfelder
vor der Ausführung als Tabellenformel.

Unter **Wiederholungen** können wöchentliche, monatliche und jährliche
Buchungsvorlagen verwaltet und pausiert werden. Ein optionales Enddatum begrenzt
die Fälligkeiten; fällige Vorkommen werden nur nach manueller Bestätigung
erzeugt und in der Oberfläche hervorgehoben. Das Datum des ersten monatlichen
Vorkommens bestimmt den Monatstag; bei kürzeren Monaten wird der letzte
Monatstag verwendet. Jährliche Termine am 29. Februar fallen in Nicht-Schalt-
jahren auf den 28. Februar. Die Datenbank verhindert Doppelbuchungen für
dasselbe Vorkommen.

Administratoren können gelöschte Buchungen über **Gelöschte Buchungen**
anzeigen und wiederherstellen. **Verlauf** zeigt Erstellungs-, Änderungs-,
Lösch- und Wiederherstellungszeitpunkt, Benutzer sowie die betroffenen
Buchungswerte direkt im Vorher-nachher-Vergleich. Der Auditverlauf beginnt mit
dem Zeitpunkt, an dem das aktuelle Delta-Skript ausgeführt wird. Monats- und
Kategorie-Diagramme bieten zusätzlich aufklappbare Datentabellen, die per
Tastatur und Screenreader nutzbar sind.

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
