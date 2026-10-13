# Git-Hooks

Die Hooks dieses Repositories werden versioniert. Einmalig im Repository
aktivieren:

```sh
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

Der `pre-commit`-Hook ergänzt vor jedem Commit den aktuellen Tagesabschnitt in
`CHANGELOG.md` und staged die Datei automatisch. Ein `pre-commit` läuft vor
dem Commit, nicht beim Push; dadurch wird der aktualisierte Changelog beim
anschließenden Push automatisch mit übertragen.

Der Push nach `main` löst außerdem den GitHub-Pages-Release-Workflow aus. Er
bestimmt die SemVer-Erhöhung anhand aller Conventional Commit-Nachrichten im
Push, aktualisiert `VERSION`, die Footer-Version und einen datierten
Versionsabschnitt im Changelog und pusht diese Metadaten als separaten
Release-Commit. `feat` erhöht Minor, `!` oder ein `BREAKING CHANGE` erhöht
Major, alle anderen Commit-Typen erhöhen Patch.
