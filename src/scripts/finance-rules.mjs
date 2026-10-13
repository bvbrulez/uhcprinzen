export const FINANCE_START_DATE = "2026-10-01";

export function resolveDateRange(year, startDate, endDate, today, financeStartDate = FINANCE_START_DATE) {
  const yearStart = `${year}-01-01`;
  const minimumStart = yearStart < financeStartDate ? financeStartDate : yearStart;
  const start = startDate && startDate >= financeStartDate ? startDate : minimumStart;
  return {
    start,
    end: endDate || (startDate ? today : `${year}-12-31`),
  };
}

export function resolveDatePreset(preset, today, financeStartDate = FINANCE_START_DATE) {
  if (!["month", "year"].includes(preset)) throw new Error(`Unknown date preset: ${preset}`);
  const currentYear = today.slice(0, 4);
  const yearStart = `${currentYear}-01-01`;
  const monthStart = `${today.slice(0, 7)}-01`;
  const start = preset === "month" ? monthStart : yearStart;
  return {
    start: start < financeStartDate ? financeStartDate : start,
    end: today,
  };
}

export function quarterDate(year, quarterIndex) {
  return new Date(Date.UTC(year, quarterIndex * 3, 1)).toISOString().slice(0, 10);
}

export function quarterContributionDueDate(year, quarterIndex) {
  return `${quarterDate(year, quarterIndex).slice(0, 7)}-15`;
}

export function contributionDueStatus(today, quarterStart, dueDate) {
  if (today < quarterStart) return "future";
  return today > dueDate ? "overdue" : "due";
}

export function getQuarterlyContributionAmount(rates, fallbackAmount, quarterStart) {
  const rate = [...rates]
    .filter(item => item.quarter_start <= quarterStart)
    .sort((a, b) => b.quarter_start.localeCompare(a.quarter_start))[0];
  return Number(rate?.quarterly_amount ?? fallbackAmount);
}

export function contributionAmountForQuarters(rates, fallbackAmount, quarterStarts) {
  const totalCents = quarterStarts.reduce(
    (total, quarterStart) => total + Math.round(
      getQuarterlyContributionAmount(rates, fallbackAmount, quarterStart) * 100,
    ),
    0,
  );
  return totalCents / 100;
}
