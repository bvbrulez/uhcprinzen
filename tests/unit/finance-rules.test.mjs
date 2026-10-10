import test from "node:test";
import assert from "node:assert/strict";
import {
  contributionAmountForQuarters,
  contributionDueStatus,
  getQuarterlyContributionAmount,
  quarterContributionDueDate,
  quarterDate,
  resolveDateRange,
} from "../../src/scripts/finance-rules.mjs";

test("uses the explicit start date even when it is the finance cutoff", () => {
  assert.deepEqual(
    resolveDateRange("2027", "2026-10-01", "", "2026-10-10"),
    { start: "2026-10-01", end: "2026-10-10" },
  );
});

test("uses the selected year when only an end date is set", () => {
  assert.deepEqual(
    resolveDateRange("2027", "", "2027-06-30", "2027-06-30"),
    { start: "2027-01-01", end: "2027-06-30" },
  );
});

test("clamps the year range to the finance start date", () => {
  assert.deepEqual(
    resolveDateRange("2026", "", "", "2026-10-10"),
    { start: "2026-10-01", end: "2026-12-31" },
  );
});

test("keeps explicit ranges and defaults an omitted end date to today", () => {
  assert.deepEqual(
    resolveDateRange("2027", "2027-03-01", "", "2027-03-20"),
    { start: "2027-03-01", end: "2027-03-20" },
  );
});

test("sets the contribution deadline to the 15th of the quarter's first month", () => {
  assert.equal(quarterContributionDueDate(2026, 3), "2026-10-15");
  assert.equal(quarterContributionDueDate(2027, 0), "2027-01-15");
  assert.equal(quarterDate(2027, 2), "2027-07-01");
});

test("keeps contributions future before the quarter starts", () => {
  assert.equal(contributionDueStatus("2026-09-30", "2026-10-01", "2026-10-15"), "future");
});

test("marks contributions due through the 15th, inclusive", () => {
  assert.equal(contributionDueStatus("2026-10-01", "2026-10-01", "2026-10-15"), "due");
  assert.equal(contributionDueStatus("2026-10-15", "2026-10-01", "2026-10-15"), "due");
});

test("marks contributions overdue starting the 16th", () => {
  assert.equal(contributionDueStatus("2026-10-16", "2026-10-01", "2026-10-15"), "overdue");
});

test("chooses the latest rate effective on or before a quarter", () => {
  const rates = [
    { quarter_start: "2027-04-01", quarterly_amount: 90 },
    { quarter_start: "2026-10-01", quarterly_amount: 75 },
    { quarter_start: "2027-01-01", quarterly_amount: 80 },
  ];
  assert.equal(getQuarterlyContributionAmount(rates, 60, "2027-03-01"), 80);
  assert.equal(getQuarterlyContributionAmount(rates, 60, "2026-07-01"), 60);
});

test("adds rates across a change using integer cents", () => {
  const rates = [
    { quarter_start: "2026-10-01", quarterly_amount: 75 },
    { quarter_start: "2027-04-01", quarterly_amount: 90 },
  ];
  assert.equal(
    contributionAmountForQuarters(rates, 0, ["2026-10-01", "2027-01-01", "2027-04-01"]),
    240,
  );
});

test("rounds each quarter to cents before summing", () => {
  const rates = [{ quarter_start: "2026-10-01", quarterly_amount: 75.105 }];
  assert.equal(
    contributionAmountForQuarters(rates, 0, ["2026-10-01", "2027-01-01"]),
    150.22,
  );
});
