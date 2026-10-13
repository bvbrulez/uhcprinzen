import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMonthCloseChecklist,
  buildMonthCloseReport,
  monthCloseRange,
} from "../../src/scripts/month-close.mjs";

test("limits monthly close selection to the managed period through the current month", () => {
  assert.deepEqual(monthCloseRange("2026-10", "2026-10-10"), {
    start: "2026-10-01",
    end: "2026-10-10",
    isProvisional: true,
  });
  assert.deepEqual(monthCloseRange("2026-10", "2026-11-02"), {
    start: "2026-10-01",
    end: "2026-10-31",
    isProvisional: false,
  });
  assert.throws(() => monthCloseRange("2026-09", "2026-11-02"), /zwischen dem 01\.10\.2026/);
  assert.throws(() => monthCloseRange("2026-12", "2026-11-02"), /zwischen dem 01\.10\.2026/);
  assert.throws(() => monthCloseRange("2026-13", "2026-12-02"), /gültigen Abschlussmonat/);
});

test("summarizes monthly reconciliation and contributions as of the close date", () => {
  const summary = buildMonthCloseChecklist({
    month: "2027-01",
    endDate: "2027-01-31",
    analytics: {
      totals: { income: "350.00", expenses: "75.25" },
      reconciliation: {
        BANK: { open_count: 2, open_amount: "100.00" },
        PAYPAL: { open_count: 1, open_amount: "25.00" },
      },
    },
    members: [
      { id: 1, active: true },
      { id: 2, active: true },
      { id: 3, active: false },
    ],
    payments: [
      { id: 10, transaction: { transaction_date: "2027-02-01" } },
    ],
    quarters: [
      { member_id: 1, payment_id: 10, quarter_start: "2027-01-01" },
    ],
    rates: [{ quarter_start: "2027-01-01", quarterly_amount: 80 }],
    quarterlyAmount: 75,
    recurringSchedules: [
      { active: true, next_date: "2027-01-15" },
      { active: false, next_date: "2027-01-10" },
      { active: true, next_date: "2027-01-15", end_date: "2027-01-14" },
    ],
    today: "2027-02-05",
    isProvisional: false,
  });

  assert.deepEqual(summary.totals, { income: 350, expenses: 75.25 });
  assert.equal(summary.openReconciliations, 3);
  assert.equal(summary.openReconciliationAmount, 125);
  assert.deepEqual(summary.contribution, {
    quarterStart: "2027-01-01",
    dueDate: "2027-01-15",
    isDue: true,
    activeMemberCount: 2,
    unpaidCount: 2,
    unpaidAmount: 160,
  });
  assert.equal(summary.recurringDueCount, 1);
});

test("creates a self-contained report with escaped content and review statuses", () => {
  const html = buildMonthCloseReport({
    month: "2026-10",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    totals: { income: 100, expenses: 25 },
    openReconciliations: 1,
    openReconciliationAmount: 25,
    contribution: { quarterStart: "2026-10-01", dueDate: "2026-10-15", isDue: true, unpaidCount: 1, unpaidAmount: 75 },
    recurringDueCount: 0,
    recurringAsOfDate: "2026-11-01",
    isProvisional: false,
  }, [true, false, true, true], new Date("2026-11-01T12:00:00Z"));

  assert.match(html, /Monatsabschluss 2026-10/);
  assert.match(html, /Geprüft/);
  assert.match(html, /Nicht geprüft/);
  assert.match(html, /wird nicht in der Anwendung oder Datenbank gespeichert/);
  assert.match(html, /Monatsbuchungen und Summen/);
});
