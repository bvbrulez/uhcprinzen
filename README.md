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

5. Unter **Authentication → Users** alle berechtigten Mitglieder als eigene
   Auth-Benutzer anlegen. Der Login-Bereich verwendet Supabase
   `signInWithPassword` und stellt bestehende Sessions beim Laden der Seite
   automatisch wieder her. Jeder Benutzer meldet sich mit seiner eigenen
   E-Mail-Adresse und dem für sein Konto gesetzten Passwort an. Für
   ausschließlich lesenden Zugriff darf in `app_metadata` keine Admin-Rolle
   gesetzt sein; `user_metadata.display_name` kann optional für den angezeigten
   Namen verwendet werden. Es gibt keine gemeinsamen oder fest eingebauten
   Zugangsdaten. Für den Passwort-Reset die GitHub-Pages-URL unter
   **Authentication → URL Configuration → Redirect URLs** freigeben. Der Link
   wird an die eingegebene E-Mail gesendet; die Anwendung speichert oder
   verarbeitet kein bestehendes Passwort.
6. Die Seite über GitHub Pages veröffentlichen oder `src/` auf einen statischen
   Webserver deployen.

## Buchungsverwaltung

Monats- und Kategorieauswertungen übernehmen Jahr oder frei gewählten Zeitraum,
Buchungsart, Abgleichstatus und Suche sowie optional den Konto-Summenfilter. Schnellfilter für
die letzten 30 Tage, den aktuellen Monat und das laufende Jahr helfen bei der
Auswahl; häufige und selbst gespeicherte Filteransichten stehen als Chips bereit
und werden lokal im Browser gespeichert. Wenn ein eigenes Startdatum gesetzt
wird und das Enddatum leer bleibt, reicht der Zeitraum bis heute; ohne
Startdatum beginnt er am Jahresanfang.
PDF- und CSV-Export verwenden dieselben Datums- und Buchungsfilter. Der
PDF-Export lädt Buchungen in Seiten zu je 500 Einträgen und zeigt währenddessen
den Fortschritt an. Kategorien werden
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

Administratoren können Buchungen nach Abgleichstatus filtern und nach Prüfung
mit Kontoauszügen einzeln oder gesammelt als abgeglichen markieren. Die
Abgleichübersicht fasst offene und abgeglichene Buchungsanzahl sowie Betrag für
Bank- und PayPal-Konto im ausgewählten Zeitraum zusammen. Zeitpunkt und Benutzer
werden gespeichert und sind in Listen sowie Exporten sichtbar; der Verlauf
protokolliert auch das Abgleichen und Aufheben eines Abgleichs. Neue Buchungen
und CSV-Importe beginnen standardmäßig als offen.

Der CSV-Export erlaubt eine eigene Spaltenauswahl und merkt sie im Browser für
den nächsten Export. Administratoren können optional zusätzlich den
Änderungsverlauf der exportierten Buchungen in derselben Datei mit ausgeben.
Monats- und Kategorieauswertungen stehen direkt oberhalb der Filter und
Buchungsliste, damit die Entwicklung des ausgewählten Zeitraums schneller
erkennbar ist. Der Gesamtsaldo ist als Hauptkennzahl hervorgehoben; Bank- und
PayPal-Konto erhalten eigene dezente Farben. Zeitraum-, Konto- und
Buchungsfilter sind gruppiert, aktive Filter lassen sich einzeln über Chips
entfernen. Einnahmen und Ausgaben sind in der Liste durch dezente Farbakzente
unterscheidbar.

## Quartalsbeiträge

Die laufende Kassenverwaltung beginnt am **01.10.2026**. Beim Ausführen des
aktuellen `supabase/schema.sql` werden ältere Buchungen sowie deren
Änderungsverlauf und Beitragszuordnungen gelöscht. Diese Löschung ist endgültig.
Vor dem Ausführen muss deshalb ein Datenbank-Backup erstellt werden. Dateien im
privaten Belegspeicher werden von dieser Migration nicht gelöscht.
Buchungen mit Datum vor dem Startdatum werden anschließend auch durch die
Datenbank abgewiesen.

Administratoren tragen in der Oberfläche den Bank- und PayPal-Startsaldo zum
01.10.2026 ein. Die Kontostände werden aus diesen Anfangssalden und den
Buchungen ab diesem Datum bis zum Ende des gewählten Zeitraums berechnet.
CSV-Import und manuelle Buchungseingabe berücksichtigen ebenfalls nur Daten ab
dem Startdatum.

Die Beitragsübersicht zeigt für alle angemeldeten Mitglieder den Zahlungsstatus
je Quartal ab Q4 2026. Beiträge sind am letzten Tag des Quartals fällig und ab
dem Folgetag überfällig. Bis zum Quartalsende wird ein unbezahlter Beitrag als
„Noch nicht fällig“ angezeigt; am Fälligkeitstag als „Fällig heute“.
Administratoren pflegen die separate Mitgliederliste und können Mitglieder
deaktivieren oder reaktivieren. Der Quartalsbeitrag startet mit 75 Euro und
kann von Administratoren angepasst werden.

Eine Zahlung wird durch einen Administrator einer vorhandenen Einnahme-Buchung
und einem Mitglied zugeordnet. Die Buchungssumme muss dem Beitrag multipliziert
mit der Anzahl der abgedeckten Quartale entsprechen. Zusammenhängende Quartale
können in einer Zuordnung erfasst werden, auch über einen Jahreswechsel hinweg.
Eine Einnahme kann nur einmal zugeordnet werden; bereits bezahlte Quartale
können nicht doppelt verbucht werden. Zum Korrigieren hebt ein Administrator
die gesamte Zuordnung auf; die Einnahme selbst bleibt bestehen. Die
Zuordnungen und Mitgliederliste werden durch Supabase-RLS geschützt.

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
