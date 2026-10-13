import { expect, test } from "@playwright/test";

test("finance data stays hidden until a member signs in", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#login-toggle")).toBeVisible();
  await expect(page.locator("#finance-content")).toBeHidden();
  await expect(page.locator("#finance-login-hint")).toBeVisible();
});

test("finance navigation switches sections and opens the contribution table directly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  await page.locator("#finance-content").evaluate(element => { element.hidden = false; });

  await expect(page.locator("#finance-view-overview")).toBeVisible();
  await expect(page.locator("#recent-transactions-heading")).toBeVisible();
  await page.locator(".recent-transactions-heading [data-finance-view='bookings']").click();
  await expect(page.locator("#finance-view-bookings")).toBeVisible();
  const analyticsPanel = page.locator("#analytics-panel");
  await expect(analyticsPanel).toHaveAttribute("open", "");
  await analyticsPanel.locator(":scope > summary").click();
  await expect(analyticsPanel).not.toHaveAttribute("open", "");
  await expect(page.locator("#monthly-heading")).toBeHidden();
  await analyticsPanel.locator(":scope > summary").click();
  await expect(page.locator("#monthly-heading")).toBeVisible();
  const transactionsPanel = page.locator("#transactions-panel");
  await expect(transactionsPanel).toHaveAttribute("open", "");
  await transactionsPanel.locator(":scope > summary").click();
  await expect(transactionsPanel).not.toHaveAttribute("open", "");
  await expect(page.locator("#transaction-search")).toBeHidden();
  await transactionsPanel.locator(":scope > summary").click();
  await expect(page.locator("#transaction-search")).toBeVisible();
  const navigation = page.locator(".finance-section-nav");
  await page.evaluate(() => window.scrollTo(0, 450));
  await expect.poll(async () => navigation.evaluate(element => element.getBoundingClientRect().top))
    .toBeCloseTo(0, 0);
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await expect(page.locator("#finance-view-bookings")).toBeVisible();
  await expect(page.locator("#finance-view-overview")).toBeHidden();

  await page.locator('.finance-section-tab[data-finance-view="contributions"]').click();
  await expect(page.locator("#finance-view-contributions")).toBeVisible();
  await expect(page.locator("#contribution-table-scroll")).toBeFocused();

  await page.locator('.finance-section-tab[data-finance-view="overview"]').click();
  await page.locator("#contribution-alert [data-finance-view='contributions']").click();
  await expect(page.locator("#finance-view-contributions")).toBeVisible();
  await expect(page.locator("#contribution-table-scroll")).toBeFocused();
  await page.locator('.finance-section-tab[data-finance-view="overview"]').click();
  await page.locator("#bank-open-summary").click();
  await expect(page.locator("#finance-view-bookings")).toBeVisible();
  await expect(page.locator("#transactions-panel")).toHaveAttribute("open", "");
  await expect(page.locator("#account-filter")).toHaveValue("BANK");
  await expect(page.locator("#reconciliation-filter")).toHaveValue("OPEN");
});

test("overview period shortcuts set month and year or open custom date filters", async ({ page }) => {
  await page.goto("/");
  await page.locator("#finance-content").evaluate(element => { element.hidden = false; });

  const today = await page.evaluate(() => {
    const date = new Date();
    return {
      today: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      year: String(date.getFullYear()),
    };
  });
  await page.locator('[data-overview-period="month"]').click();
  await expect(page.locator("#date-from-filter")).toHaveValue(`${today.year}-${today.today.slice(5, 7)}-01`);
  await expect(page.locator("#date-to-filter")).toHaveValue(today.today);
  await expect(page.locator('[data-overview-period="month"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-overview-period="year"]').click();
  await expect(page.locator("#year-filter")).toHaveValue(today.year);
  await expect(page.locator("#date-to-filter")).toHaveValue(today.today);
  await expect(page.locator('[data-overview-period="year"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-overview-period="custom"]').click();
  await expect(page.locator("#finance-view-bookings")).toBeVisible();
  await expect(page.locator("#date-from-filter")).toBeFocused();
});

async function signIn(page, email, password) {
  test.skip(
    !process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_ANON_KEY,
    "Configure a local Supabase URL and anon key for browser tests.",
  );
  await page.goto("/");
  await page.locator("#login-toggle").click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator("#finance-content")).toBeVisible();
}

test("member can read the finance view but cannot see admin controls", async ({ page }) => {
  const { E2E_MEMBER_EMAIL: email, E2E_MEMBER_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL and E2E_MEMBER_PASSWORD for local test users.");

  await signIn(page, email, password);
  await expect(page.locator("#auth-state")).toContainText("Mitglied (nur lesend)");
  await page.locator('.finance-section-tab[data-finance-view="contributions"]').click();
  await expect(page.locator("#contribution-heading")).toBeVisible();
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await expect(page.locator("#transaction-list")).toBeVisible();
  expect(await page.locator("[data-admin-only]").evaluateAll(items => items.every(item => item.hidden))).toBe(true);
});

test("administrator sees contribution and transaction management controls", async ({ page }) => {
  const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a local admin test user.");

  await signIn(page, email, password);
  await expect(page.locator("#auth-state")).toContainText("Administrator");
  await expect(page.locator("#recurring-overview")).toBeVisible();
  await expect.poll(() => page.locator("#recurring-overview-status").textContent())
    .not.toContain("Fälligkeiten werden geladen");
  await page.locator("#open-recurring-overview").click();
  await expect(page.locator("#recurring-dialog")).toBeVisible();
  await page.locator("#recurring-dialog [data-close-dialog]").click();
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await expect(page.locator("#new-transaction")).toBeVisible();
  await expect(page.locator("#manage-categories")).toBeVisible();
  await page.locator('.finance-section-tab[data-finance-view="contributions"]').click();
  await expect(page.locator("details.contribution-admin")).toBeVisible();
  const memberSearch = page.locator("#contribution-member-search");
  await expect(memberSearch).toBeVisible();
  await memberSearch.fill("kein-treffer-987654321");
  await expect(page.locator("#contribution-filter-status"))
    .toContainText(/Keine Mitglieder entsprechen|Noch keine Mitglieder angelegt/);
  await page.locator("#reset-contribution-filters").click();
  await expect(memberSearch).toHaveValue("");
  const openMetric = page.locator('#contribution-summary [data-contribution-status="open"]');
  await openMetric.click();
  await expect(memberSearch).toHaveValue("");
  await expect(page.locator("#contribution-member-status")).toHaveValue("open");
  await expect(openMetric).toHaveAttribute("aria-pressed", "true");
  const overdueMetric = page.locator('#contribution-summary [data-contribution-status="overdue"]');
  await overdueMetric.click();
  await expect(page.locator("#contribution-member-status")).toHaveValue("overdue");
  await expect(overdueMetric).toHaveAttribute("aria-pressed", "true");
  await page.locator("#reset-contribution-filters").click();
  const assignmentButton = page.locator(".contribution-assign-button").first();
  if (await assignmentButton.count()) {
    await assignmentButton.click();
    await expect(page.locator(".contribution-admin")).toHaveAttribute("open", "");
    await expect(page.locator("#contribution-payment-member")).not.toHaveValue("");
    await expect(page.locator("#contribution-payment-quarter")).not.toHaveValue("");
    await expect(page.locator("#contribution-payment-count")).toHaveValue("1");
  }

  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await expect.poll(async () => {
    const hasRows = await page.locator("#transaction-list tr").count() > 0;
    const emptyStateVisible = await page.locator("#transaction-empty-state").isVisible();
    const canRetry = await page.locator("#retry-transactions").isVisible();
    return hasRows || emptyStateVisible || canRetry;
  }).toBe(true);
  const firstTransaction = page.locator("#transaction-list tr").first();
  if (await firstTransaction.count()) {
    await page.setViewportSize({ width: 390, height: 700 });
    const detailsToggle = firstTransaction.getByRole("button", { name: "Weitere Details" });
    await detailsToggle.click();
    await expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
    await expect(firstTransaction.locator(".transaction-mobile-details")).toBeVisible();
    const actionsToggle = firstTransaction.getByRole("button", { name: "Aktionen" });
    await actionsToggle.click();
    await expect(firstTransaction.locator(".transaction-action-list")).toBeVisible();
  }
});

test("administrator can review and archive the monthly close report", async ({ page }) => {
  const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for local test users.");

  await signIn(page, email, password);
  await page.locator("#open-month-close").click();
  await expect(page.locator("#month-close-dialog")).toBeVisible();
  await expect(page.locator("#month-close-checklist li")).toHaveCount(4);
  const archiveButton = page.locator("#download-month-close-report");
  await expect(archiveButton).toBeDisabled();
  for (const checkbox of await page.locator("#month-close-checklist input[type=checkbox]").all()) {
    await checkbox.check({ force: true });
  }
  await expect(archiveButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await archiveButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^uhc-prinzen-monatsabschluss-\d{4}-\d{2}\.html$/);
});

test("administrator can attach a private receipt for members to view", async ({ page }) => {
  const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for local test users.");

  const description = `E2E Beleg ${Date.now()}`;
  await signIn(page, email, password);
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await page.locator("#new-transaction").click();
  await page.locator("#transaction-description").fill(description);
  await page.locator("#transaction-amount").fill("12.34");
  await page.locator("#transaction-date").fill(await page.evaluate(() => new Date().toISOString().slice(0, 10)));
  await page.locator("#transaction-category").selectOption("Sonstiges");
  await page.locator("#transaction-submit").click();
  await expect(page.locator("#finance-status")).toContainText("Buchung erfolgreich gespeichert");

  const row = page.locator("#transaction-list tr").filter({ hasText: description });
  await expect(row).toBeVisible();
  await row.locator('input[type="file"]').setInputFiles({
    name: "e2e-receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nE2E receipt\n%%EOF"),
  });
  await expect(row.getByRole("button", { name: /Beleg ansehen: e2e-receipt\.pdf/ })).toBeVisible();

  await page.locator("#logout-button").click();
  await expect(page.locator("#login-toggle")).toBeVisible();
  await signIn(page, process.env.E2E_MEMBER_EMAIL, process.env.E2E_MEMBER_PASSWORD);
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  const memberRow = page.locator("#transaction-list tr").filter({ hasText: description });
  await expect(memberRow.getByRole("button", { name: /Beleg ansehen: e2e-receipt\.pdf/ })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await memberRow.getByRole("button", { name: /Beleg ansehen: e2e-receipt\.pdf/ }).click();
  const receiptPage = await popupPromise;
  await expect.poll(() => receiptPage.url()).toContain("/storage/v1/object/sign/transaction-receipts/");
  await receiptPage.close();

  await page.locator("#logout-button").click();
  await expect(page.locator("#login-toggle")).toBeVisible();
  await signIn(page, email, password);
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  const cleanupRow = page.locator("#transaction-list tr").filter({ hasText: description });
  await cleanupRow.getByRole("button", { name: "Aktionen" }).click();
  page.once("dialog", dialog => dialog.accept());
  await cleanupRow.getByRole("button", { name: "Beleg entfernen" }).click();
  await expect(cleanupRow.getByRole("button", { name: /Beleg ansehen/ })).toHaveCount(0);
  await cleanupRow.getByRole("button", { name: "Aktionen" }).click();
  page.once("dialog", dialog => dialog.accept());
  await cleanupRow.getByRole("button", { name: "Löschen" }).click();
  await expect(cleanupRow).toHaveCount(0);
});
