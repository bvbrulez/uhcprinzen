import { expect, test } from "@playwright/test";

test("finance data stays hidden until a member signs in", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#login-toggle")).toBeVisible();
  await expect(page.locator("#finance-content")).toBeHidden();
  await expect(page.locator("#finance-login-hint")).toBeVisible();
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
  await expect(page.locator("#contribution-heading")).toBeVisible();
  await expect(page.locator("#transaction-list")).toBeVisible();
  expect(await page.locator("[data-admin-only]").evaluateAll(items => items.every(item => item.hidden))).toBe(true);
});

test("administrator sees contribution and transaction management controls", async ({ page }) => {
  const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a local admin test user.");

  await signIn(page, email, password);
  await expect(page.locator("#auth-state")).toContainText("Administrator");
  await expect(page.locator("#new-transaction")).toBeVisible();
  await expect(page.locator("#manage-categories")).toBeVisible();
  await expect(page.locator("details.contribution-admin")).toBeVisible();
});
