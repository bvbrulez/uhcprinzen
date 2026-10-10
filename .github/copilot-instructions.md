# Copilot instructions for this repository

## Project overview

This repository is a static, browser-based frontend for the Wesselbleker Prinzen. The app has no bundler or build step; it loads directly from `src/` and talks to Supabase from the browser using a public anon key. Node's built-in test runner covers pure finance rules, Playwright provides optional browser tests, and pgTAP SQL tests run only against a disposable local database.

## Build, run, and validation commands

The browser app has no build pipeline. Development test commands are:

```bash
npm ci
npm test
node --check src/scripts/app.js
```

Optional database and browser test setup is documented in `README.md`. Never
run the destructive delta schema against a production database.

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
- `src/scripts/app.js`: the application UI and event wiring. Read this for filters, summaries, table/CSV preview rendering, dialog behavior, and admin-only UI.
- `src/scripts/auth-service.mjs`: Supabase sign-in/out, password reset, and session wrappers.
- `src/scripts/transaction-service.mjs`: transaction, category, audit, filter/page, and export data operations.
- `src/scripts/recurring-service.mjs`: recurring-schedule queries, writes, and due-entry creation.
- `src/scripts/latest-request.mjs`: request-generation gate used to prevent stale transaction queries from replacing newer filter results.
- `src/scripts/finance-rules.mjs`: pure date-range, contribution-deadline, and historical-rate calculations shared by the app and Node tests.
- `src/scripts/contribution-service.mjs`: Supabase data operations for contribution settings, members, rates, and payments; UI behavior remains in `app.js`.
- `src/scripts/csv-rules.mjs`: pure CSV parsing and normalization rules, covered by Node unit tests.
- `tests/unit/`: Node built-in tests for finance rules; `tests/e2e/`: optional Playwright flows that only permit loopback Supabase URLs.
- `supabase/tests/`: pgTAP integration tests; execute only against a disposable local database.
- `src/styles/base.css` and `src/styles/components.css`: styling for the site and finance interface.
- `src/supabase-config.js`: browser-safe Supabase URL and anon key. Do not add the service-role key here.
- `supabase/base-schema.sql`: initial database schema for a fresh project.
- `supabase/schema.sql`: incremental schema changes and policies. This file is the main migration source for any database change.
- The quarterly-contribution overview is part of the finance page. `team_members`, contribution settings/rates (including opening account balances), payment records, and quarter allocations live in `supabase/schema.sql`; `record_team_contribution_payment` validates each quarter against the effective historical rate and stores the applied rate as a snapshot.
- `.github/workflows/pages.yml`: deploys the static frontend to GitHub Pages.
- `.github/workflows/tests.yml`: runs finance unit tests and JavaScript syntax checks.
- `.github/workflows/conventional-commits.yml`: enforces conventional commit naming in PRs and pushes.

The app is not a backend service; data access is all client-side via Supabase RLS. Auth and authorization are enforced in the database as well as the UI.

## Key conventions specific to this repo

- Treat this as a static JavaScript app, not a server-rendered or bundled app. Do not introduce build tooling unless the repo already has it.
- Browser-side Supabase config is intentionally public. Only the anon key belongs in `src/supabase-config.js`; never add `service_role` or any privileged secret.
- Admin access is based on Supabase `app_metadata.role = "admin"`, with `bvbrulez@gmail.com` treated as an admin fallback. Changes to admin role must happen in a trusted Supabase admin context, not by setting `user_metadata` from the browser.
- Contribution payment status is readable by all authenticated members, while roster, fee, and payment-assignment changes are admin-only. Keep those checks enforced by Supabase RLS/functions as well as the UI.
- The current finance-management period starts on 2026-10-01. The delta schema migration deliberately deletes earlier transactions, related audit records, and pre-period contribution assignments, then prevents backdated transactions/allocations. It leaves receipt files in storage. Treat changes to this migration's cutoff or cleanup as data-destructive and update README documentation.
- Active recurring transactions must have a `next_date` on or after 2026-10-01. Contribution-rate entries take effect from their selected quarter until the next entry; payment-quarter snapshots must not be rewritten when rates change.
- Schema changes should be reflected in `supabase/schema.sql` (and `base-schema.sql` for a new installation), because the README explicitly calls out running the delta script after schema updates.
- The UI is German-language and organized around finance workflows: authentication, transaction listing, date filters, CSV import/export, recurring entries, and audit/history views.
- Commits must follow conventional commit format (for example `feat:`, `fix:`, `docs:`, `chore:`) because CI validates this in `.github/workflows/conventional-commits.yml`.
- The changelog is maintained automatically by `.githooks/pre-commit`; do not hand-edit it in a way that conflicts with that hook.

## Recommended working approach

- Start with `README.md` for setup and product requirements.
- Read `src/scripts/app.js` for UI behavior and follow the domain service imports for Supabase operations.
- If changing database behavior, inspect both the app logic and the matching SQL in `supabase/schema.sql`.
- If changing auth or permissions, check both the client-side admin checks and the Supabase RLS policy definitions.
- Prefer surgical edits that match the repository's static-file pattern; this project does not use a framework or module bundler.
