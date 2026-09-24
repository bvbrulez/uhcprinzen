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
