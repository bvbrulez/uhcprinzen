import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixtures/preview.csv", import.meta.url));

async function signInAsAdmin(page) {
  test.skip(
    !process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_ANON_KEY,
    "Configure a local Supabase URL and anon key for browser tests.",
  );
  const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a local admin test user.");
  await page.goto("/");
  await page.locator("#login-toggle").click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator("#finance-content")).toBeVisible();
  await expect(page.locator("#auth-state")).toContainText("Administrator");
}

test("admin can search and load income pages beyond the first 100 records", async ({ page }) => {
  test.skip(
    process.env.E2E_EXPECT_OLDER_INCOME !== "1",
    "Set E2E_EXPECT_OLDER_INCOME=1 after seeding at least 101 income rows in the local test database.",
  );
  await signInAsAdmin(page);
  await page.locator('.finance-section-tab[data-finance-view="contributions"]').click();
  await page.locator("details.contribution-admin > summary").click();
  const loadMore = page.locator("#contribution-payment-load-more");
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(loadMore).toBeDisabled();
  expect(await page.locator("#contribution-payment-transaction option").count()).toBeGreaterThan(100);
});

test("admin can preview a CSV without importing it", async ({ page }) => {
  await signInAsAdmin(page);
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await page.locator("#import-transactions").click();
  await page.locator("#csv-file").setInputFiles(resolve(fixture));
  await expect(page.locator("#csv-preview")).toContainText("E2E Vorschau ohne Import");
  await expect(page.locator("#csv-import-submit")).toBeEnabled();
  await expect(page.locator("#csv-import-dialog")).toBeVisible();
});

test("CSV preview pages through rows and rejects files over the size limit", async ({ page }) => {
  await signInAsAdmin(page);
  await page.locator('.finance-section-tab[data-finance-view="bookings"]').click();
  await page.locator("#import-transactions").click();
  const rows = Array.from({ length: 51 }, (_, index) =>
    `2026-10-01;E2E Vorschauzeile ${String(index + 1).padStart(3, "0")};;25,00;Bankkonto;Prinzenkröten`);
  const csv = ["Datum;Beschreibung;Soll;Haben;Konto;Kategorie", ...rows].join("\r\n");
  await page.locator("#csv-file").setInputFiles({
    name: "pagination.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });

  const preview = page.locator("#csv-preview");
  await expect(preview).toContainText("E2E Vorschauzeile 001");
  await expect(preview).not.toContainText("E2E Vorschauzeile 051");
  await expect(page.locator("#csv-preview-page-status")).toContainText("1–50 von 51");
  await page.locator("#csv-preview-next").click();
  await expect(preview).toContainText("E2E Vorschauzeile 051");
  await expect(page.locator("#csv-preview-page-status")).toContainText("Seite 2 von 2");

  await page.locator("#csv-file").setInputFiles({
    name: "too-large.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.locator("#csv-import-status")).toContainText("größer als das Limit von 5 MB");
  await expect(page.locator("#csv-import-submit")).toBeDisabled();
});

test("admin can assign an income to a member and consecutive quarters", async ({ page }) => {
  const memberName = process.env.E2E_PAYMENT_MEMBER;
  const searchTerm = process.env.E2E_PAYMENT_SEARCH;
  const firstQuarter = process.env.E2E_PAYMENT_FIRST_QUARTER;
  const quarterCount = Number(process.env.E2E_PAYMENT_QUARTER_COUNT || 1);
  test.skip(
    !memberName || !searchTerm || !firstQuarter,
    "Set payment fixture variables for a disposable local test member and matching income.",
  );
  await signInAsAdmin(page);
  await page.locator('.finance-section-tab[data-finance-view="contributions"]').click();
  await page.locator("details.contribution-admin > summary").click();

  const memberSelect = page.locator("#contribution-payment-member");
  await memberSelect.selectOption({ label: memberName });
  await page.locator("#contribution-payment-search").fill(searchTerm);
  const transactionSelect = page.locator("#contribution-payment-transaction");
  await expect.poll(async () => transactionSelect.locator("option").allTextContents())
    .toEqual(expect.arrayContaining([expect.stringContaining(searchTerm)]));
  const matchingOption = await transactionSelect.locator("option").evaluateAll((options, term) => {
    const option = options.find(item => item.value && item.textContent.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
    return option?.value || "";
  }, searchTerm);
  expect(matchingOption).not.toBe("");
  await transactionSelect.selectOption(matchingOption);
  await page.locator("#contribution-payment-quarter").selectOption(firstQuarter);
  await page.locator("#contribution-payment-count").selectOption(String(quarterCount));

  let assigned = false;
  try {
    assigned = true;
    await page.locator('#contribution-payment-form button[type="submit"]').click();
    await expect(page.locator("#contribution-admin-status")).toContainText("zugeordnet");
    const quarterDate = new Date(`${firstQuarter}T00:00:00Z`);
    const quarterNumber = Math.floor(quarterDate.getUTCMonth() / 3) + 1;
    await page.locator("#contribution-year").selectOption(String(quarterDate.getUTCFullYear()));
    const memberRow = page.locator("#contribution-list tr").filter({
      has: page.locator("#contribution-list th", { hasText: memberName }),
    });
    const assignedCell = memberRow.locator(`td[data-label="Q${quarterNumber}"]`);
    await expect(assignedCell).toContainText("Bezahlt");
    await expect(assignedCell).toContainText(searchTerm);
    page.once("dialog", dialog => dialog.accept());
    await assignedCell.getByRole("button", { name: "Zuordnung aufheben" }).click();
    await expect(page.locator("#contribution-admin-status")).toContainText("aufgehoben");
    assigned = false;
  } finally {
    if (assigned) {
      const quarterDate = new Date(`${firstQuarter}T00:00:00Z`);
      const quarterNumber = Math.floor(quarterDate.getUTCMonth() / 3) + 1;
      await page.locator("#contribution-year").selectOption(String(quarterDate.getUTCFullYear()));
      const memberRow = page.locator("#contribution-list tr").filter({
        has: page.locator("#contribution-list th", { hasText: memberName }),
      });
      const assignedCell = memberRow.locator(`td[data-label="Q${quarterNumber}"]`);
      const remove = assignedCell.getByRole("button", { name: "Zuordnung aufheben" });
      if (await assignedCell.getByText(searchTerm, { exact: false }).count() && await remove.isVisible()) {
        page.once("dialog", dialog => dialog.accept());
        await remove.click();
      }
    }
  }
});
