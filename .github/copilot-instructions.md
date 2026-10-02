# Copilot instructions for this repository

## Project overview

This repository is a static, browser-based frontend for the Wesselbleker Prinzen. It does not have a Node/React/Vite build pipeline or a unit test runner. The page loads directly from `src/` and talks to Supabase from the browser using a public anon key.

## Build, run, and validation commands

There is no project-level `package.json`, `npm` script, lint config, or automated test suite in this repo.

Use the static site directly:

```bash
python3 -m http.server 8080 --directory src
```

Then open http://localhost:8080 in a browser.

GitHub Pages deployment is handled by `.github/workflows/pages.yml`, which uploads the `src/` directory as the Pages artifact.

For database changes, validate against Supabase schema scripts in order:

```bash
# apply the base schema first for a new project
# then apply the incremental schema for existing projects
# see README.md for the exact workflow
```

Keep the repo hooks enabled once per clone:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

This repo auto-updates `CHANGELOG.md` via the pre-commit hook.

## High-level architecture

- `src/index.html`: page structure, all dialogs, filters, tables, and finance UI sections.
- `src/scripts/app.js`: the actual application logic. This is the main file to read for auth, Supabase queries, filter state, summaries, export/import flows, recurring entries, audit views, and admin-only behavior.
- `src/styles/base.css` and `src/styles/components.css`: styling for the site and finance interface.
- `src/supabase-config.js`: browser-safe Supabase URL and anon key. Do not add the service-role key here.
- `supabase/base-schema.sql`: initial database schema for a fresh project.
- `supabase/schema.sql`: incremental schema changes and policies. This file is the main migration source for any database change.
- The quarterly-contribution overview is part of the finance page. `team_members`, contribution settings (including opening account balances), payment records, and quarter allocations live in `supabase/schema.sql`; `record_team_contribution_payment` validates and atomically records a linked income transaction.
- `.github/workflows/pages.yml`: deploys the static frontend to GitHub Pages.
- `.github/workflows/conventional-commits.yml`: enforces conventional commit naming in PRs and pushes.

The app is not a backend service; data access is all client-side via Supabase RLS. Auth and authorization are enforced in the database as well as the UI.

## Key conventions specific to this repo

- Treat this as a static JavaScript app, not a server-rendered or bundled app. Do not introduce build tooling unless the repo already has it.
- Browser-side Supabase config is intentionally public. Only the anon key belongs in `src/supabase-config.js`; never add `service_role` or any privileged secret.
- Admin access is based on Supabase `app_metadata.role = "admin"`, with `bvbrulez@gmail.com` treated as an admin fallback. Changes to admin role must happen in a trusted Supabase admin context, not by setting `user_metadata` from the browser.
- Contribution payment status is readable by all authenticated members, while roster, fee, and payment-assignment changes are admin-only. Keep those checks enforced by Supabase RLS/functions as well as the UI.
- The current finance-management period starts on 2026-10-01. The delta schema migration deliberately deletes earlier transactions, related audit records, and pre-period contribution assignments, then prevents backdated transactions/allocations. It leaves receipt files in storage. Treat changes to this migration's cutoff or cleanup as data-destructive and update README documentation.
- Schema changes should be reflected in `supabase/schema.sql` (and `base-schema.sql` for a new installation), because the README explicitly calls out running the delta script after schema updates.
- The UI is German-language and organized around finance workflows: authentication, transaction listing, date filters, CSV import/export, recurring entries, and audit/history views.
- Commits must follow conventional commit format (for example `feat:`, `fix:`, `docs:`, `chore:`) because CI validates this in `.github/workflows/conventional-commits.yml`.
- The changelog is maintained automatically by `.githooks/pre-commit`; do not hand-edit it in a way that conflicts with that hook.

## Recommended working approach

- Start with `README.md` for setup and product requirements.
- Read `src/scripts/app.js` for runtime behavior; it contains most of the app logic in one place.
- If changing database behavior, inspect both the app logic and the matching SQL in `supabase/schema.sql`.
- If changing auth or permissions, check both the client-side admin checks and the Supabase RLS policy definitions.
- Prefer surgical edits that match the repository's static-file pattern; this project does not use a framework or module bundler.
