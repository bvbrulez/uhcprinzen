import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRecurringSchedules } from "../../src/scripts/recurring-view-rules.mjs";

test("summarizes active due schedules and the next active date", () => {
  assert.deepEqual(summarizeRecurringSchedules([
    { active: true, next_date: "2027-02-01", end_date: null },
    { active: true, next_date: "2027-01-15", end_date: "2027-03-01" },
    { active: false, next_date: "2027-01-01", end_date: null },
    { active: true, next_date: "2027-01-01", end_date: "2026-12-31" },
  ], "2027-01-20"), {
    dueCount: 1,
    nextDate: "2027-01-15",
  });
});

test("returns no next date when there are no active schedules", () => {
  assert.deepEqual(summarizeRecurringSchedules([
    { active: false, next_date: "2027-01-01", end_date: null },
  ], "2027-01-20"), {
    dueCount: 0,
    nextDate: null,
  });
});
