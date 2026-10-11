import test from "node:test";
import assert from "node:assert/strict";
import {
  compareContributionUrgency,
  matchesContributionMemberFilter,
} from "../../src/scripts/contribution-view-rules.mjs";

const members = {
  overdue: { name: "Märta", active: true, paidDueCount: 1, dueQuarterCount: 2, openCount: 0, overdueCount: 1 },
  due: { name: "Anna", active: true, paidDueCount: 1, dueQuarterCount: 2, openCount: 1, overdueCount: 0 },
  paid: { name: "Bärbel", active: true, paidDueCount: 2, dueQuarterCount: 2, openCount: 0, overdueCount: 0 },
  inactive: { name: "Inaktiv", active: false, paidDueCount: 2, dueQuarterCount: 2, openCount: 0, overdueCount: 0 },
  future: { name: "Zukunft", active: true, paidDueCount: 0, dueQuarterCount: 0, openCount: 0, overdueCount: 0 },
};

test("matches contribution member names without case sensitivity", () => {
  assert.equal(matchesContributionMemberFilter(members.overdue, "mÄR", "all"), true);
  assert.equal(matchesContributionMemberFilter(members.overdue, "Marta", "all"), true);
  assert.equal(matchesContributionMemberFilter(members.due, "mÄR", "all"), false);
  assert.equal(matchesContributionMemberFilter(members.due, "  ", "all"), true);
});

test("filters members by outstanding, overdue, due, and fully paid quarters", () => {
  assert.equal(matchesContributionMemberFilter(members.overdue, "", "open"), true);
  assert.equal(matchesContributionMemberFilter(members.due, "", "open"), true);
  assert.equal(matchesContributionMemberFilter(members.overdue, "", "overdue"), true);
  assert.equal(matchesContributionMemberFilter(members.due, "", "overdue"), false);
  assert.equal(matchesContributionMemberFilter(members.due, "", "due"), true);
  assert.equal(matchesContributionMemberFilter(members.overdue, "", "due"), false);
  assert.equal(matchesContributionMemberFilter(members.paid, "", "paid"), true);
  assert.equal(matchesContributionMemberFilter(members.due, "", "paid"), false);
});

test("does not count inactive or future-only members as fully paid", () => {
  assert.equal(matchesContributionMemberFilter(members.inactive, "", "paid"), false);
  assert.equal(matchesContributionMemberFilter(members.future, "", "paid"), false);
});

test("sorts overdue members before due, fully paid, future, and inactive members", () => {
  const ordered = [members.inactive, members.future, members.paid, members.due, members.overdue]
    .sort(compareContributionUrgency);
  assert.deepEqual(ordered, [members.overdue, members.due, members.paid, members.future, members.inactive]);
});

test("uses open amounts and names to make urgency sorting predictable", () => {
  const membersWithAmounts = [
    { ...members.overdue, name: "Marta", outstandingAmount: 25 },
    { ...members.overdue, name: "Anna", overdueCount: 2, outstandingAmount: 50 },
    { ...members.due, name: "Zoe", outstandingAmount: 75 },
    { ...members.due, name: "Ben", outstandingAmount: 25 },
  ].sort(compareContributionUrgency);
  assert.deepEqual(membersWithAmounts.map(member => member.name), ["Anna", "Marta", "Zoe", "Ben"]);
});
