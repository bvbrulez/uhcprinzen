export function describeYearComparison(currentValue, previousValue, kind, formatMoney) {
  if (previousValue == null) {
    return { text: "Kein vergleichbarer Vorjahreszeitraum", tone: "neutral" };
  }

  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (previous === 0) {
    if (current === 0) return { text: `Vorjahr ${formatMoney(previous)} · unverändert`, tone: "neutral" };
    return {
      text: `Vorjahr ${formatMoney(previous)} · erstmals vorhanden`,
      tone: kind === "income" ? "positive" : "negative",
    };
  }

  const change = ((current - previous) / previous) * 100;
  const formattedChange = new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Math.abs(change));
  const direction = change > 0 ? "+" : change < 0 ? "−" : "";
  const tone = change === 0
    ? "neutral"
    : (kind === "income" ? change > 0 : change < 0)
      ? "positive"
      : "negative";
  return {
    text: `Vorjahr ${formatMoney(previous)} · ${direction}${formattedChange} %`,
    tone,
  };
}
