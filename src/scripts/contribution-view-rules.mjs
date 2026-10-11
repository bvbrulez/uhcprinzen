export function matchesContributionMemberFilter(member, search, status) {
  const normalize = value => value.trim().toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const query = normalize(search);
  if (query && !normalize(member.name).includes(query)) return false;
  if (status === "open") return member.openCount > 0 || member.overdueCount > 0;
  if (status === "overdue") return member.overdueCount > 0;
  if (status === "due") return member.openCount > 0;
  if (status === "paid") {
    return member.active
      && member.dueQuarterCount > 0
      && member.paidDueCount === member.dueQuarterCount
      && member.openCount === 0
      && member.overdueCount === 0;
  }
  return true;
}

function contributionUrgency(member) {
  if (!member.active) return 4;
  if (member.overdueCount > 0) return 0;
  if (member.openCount > 0) return 1;
  if (member.dueQuarterCount > 0 && member.paidDueCount === member.dueQuarterCount) return 2;
  return 3;
}

export function compareContributionUrgency(left, right) {
  const priority = contributionUrgency(left) - contributionUrgency(right);
  if (priority) return priority;
  if (left.overdueCount !== right.overdueCount) return right.overdueCount - left.overdueCount;
  if (left.openCount !== right.openCount) return right.openCount - left.openCount;
  if (left.outstandingAmount !== right.outstandingAmount) return right.outstandingAmount - left.outstandingAmount;
  return left.name.localeCompare(right.name, "de-DE");
}
