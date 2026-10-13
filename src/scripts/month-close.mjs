import {
  FINANCE_START_DATE,
  getQuarterlyContributionAmount,
  quarterContributionDueDate,
  quarterDate,
} from "./finance-rules.mjs";

const escapeHtml = value => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export function monthCloseRange(month, today) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Bitte einen gültigen Abschlussmonat auswählen.");
  }
  const monthStart = `${month}-01`;
  if (monthStart < FINANCE_START_DATE || month > today.slice(0, 7)) {
    throw new Error("Der Abschlussmonat muss zwischen dem 01.10.2026 und dem aktuellen Monat liegen.");
  }
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  return {
    start: monthStart,
    end: month === today.slice(0, 7) && today < monthEnd ? today : monthEnd,
    isProvisional: month === today.slice(0, 7),
  };
}

export function buildMonthCloseChecklist({
  month,
  endDate,
  analytics,
  members,
  payments,
  quarters,
  rates,
  quarterlyAmount,
  recurringSchedules,
  today,
  isProvisional,
}) {
  const quarterMonth = Number(month.slice(5, 7));
  const quarterIndex = Math.floor((quarterMonth - 1) / 3);
  const quarterStart = quarterDate(Number(month.slice(0, 4)), quarterIndex);
  const isQuarterStartMonth = quarterMonth === quarterIndex * 3 + 1 && quarterStart >= FINANCE_START_DATE;
  const paymentsById = new Map(payments.map(payment => [Number(payment.id), payment]));
  const paidMembers = new Set(quarters
    .filter(item => item.quarter_start === quarterStart)
    .filter(item => {
      const payment = paymentsById.get(Number(item.payment_id));
      return payment?.transaction?.transaction_date <= endDate;
    })
    .map(item => Number(item.member_id)));
  const contributionDueDate = quarterContributionDueDate(Number(month.slice(0, 4)), quarterIndex);
  const contributionDue = isQuarterStartMonth && contributionDueDate <= endDate;
  const activeMemberCount = members.filter(member => member.active).length;
  const unpaidMembers = contributionDue
    ? members.filter(member => member.active && !paidMembers.has(Number(member.id)))
    : [];
  const reconciliation = analytics?.reconciliation || {};
  const openReconciliations = ["BANK", "PAYPAL"].reduce((total, account) => (
    total + Number(reconciliation[account]?.open_count || 0)
  ), 0);
  const openReconciliationAmount = ["BANK", "PAYPAL"].reduce((total, account) => (
    total + Number(reconciliation[account]?.open_amount || 0)
  ), 0);
  const currentRecurringDue = recurringSchedules.filter(schedule => (
    schedule.active && schedule.next_date <= today && (!schedule.end_date || schedule.next_date <= schedule.end_date)
  ));

  return {
    month,
    isProvisional,
    startDate: `${month}-01`,
    endDate,
    totals: {
      income: Number(analytics?.totals?.income || 0),
      expenses: Number(analytics?.totals?.expenses || 0),
    },
    openReconciliations,
    openReconciliationAmount,
    contribution: {
      quarterStart: isQuarterStartMonth ? quarterStart : null,
      dueDate: isQuarterStartMonth ? contributionDueDate : null,
      isDue: contributionDue,
      activeMemberCount,
      unpaidCount: unpaidMembers.length,
      unpaidAmount: unpaidMembers.length
        * getQuarterlyContributionAmount(rates, quarterlyAmount, quarterStart),
    },
    recurringDueCount: currentRecurringDue.length,
    recurringAsOfDate: today,
  };
}

export function buildMonthCloseReport(summary, reviewed, preparedAt = new Date()) {
  const formatMoney = value => `${Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
  const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
  const checks = [
    ["Monatsbuchungen und Summen", `Einnahmen: ${formatMoney(summary.totals.income)} · Ausgaben: ${formatMoney(summary.totals.expenses)}`],
    ["Offene Kontoabgleiche", `${summary.openReconciliations} offene Buchungen · ${formatMoney(summary.openReconciliationAmount)}`],
    ["Quartalsbeiträge", summary.contribution.quarterStart
      ? summary.contribution.isDue
        ? `${summary.contribution.unpaidCount} offen · ${formatMoney(summary.contribution.unpaidAmount)} · fällig am ${formatDate(summary.contribution.dueDate)}`
        : `${summary.contribution.activeMemberCount} Beiträge noch nicht fällig · fällig am ${formatDate(summary.contribution.dueDate)}`
      : "In diesem Monat beginnt kein Beitragsquartal."],
    ["Wiederholungsbuchungen", `${summary.recurringDueCount} aktuell fällig (Stand ${formatDate(summary.recurringAsOfDate)}).`],
  ];
  const rows = checks.map(([label, detail], index) => `
    <tr><th>${escapeHtml(label)}</th><td>${escapeHtml(detail)}</td><td>${reviewed[index] ? "Geprüft" : "Nicht geprüft"}</td></tr>
  `).join("");
  const preparedDate = preparedAt.toLocaleString("de-DE");
  const period = `${formatDate(summary.startDate)}–${formatDate(summary.endDate)}`;
  const provisional = summary.isProvisional;
  const safeMonth = escapeHtml(summary.month);
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Monatsabschluss ${safeMonth} · UHC Prinzen</title>
<style>
body{color:#17372e;font:16px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:900px;padding:0 1rem}
h1{margin-bottom:.2rem}p{color:#526d76}.totals{display:flex;gap:1rem;flex-wrap:wrap}
.totals article{border:1px solid #dce7e1;border-radius:.6rem;padding:1rem;min-width:12rem}
table{border-collapse:collapse;margin-top:1rem;width:100%}th,td{border-bottom:1px solid #dce7e1;padding:.7rem;text-align:left}
th{width:30%}td:last-child{white-space:nowrap}@media print{body{margin:0;max-width:none}button{display:none}}
</style></head><body>
<h1>Monatsabschluss ${safeMonth}</h1>
<p>UHC Prinzen · Zeitraum ${escapeHtml(period)}${provisional ? " · Vorläufiger Zwischenstand" : ""}</p>
<section class="totals"><article><strong>Einnahmen</strong><br>${formatMoney(summary.totals.income)}</article>
<article><strong>Ausgaben</strong><br>${formatMoney(summary.totals.expenses)}</article>
<article><strong>Offene Abgleiche</strong><br>${summary.openReconciliations} · ${formatMoney(summary.openReconciliationAmount)}</article></section>
<h2>Prüfliste</h2><table><thead><tr><th>Bereich</th><th>Stand</th><th>Prüfung</th></tr></thead><tbody>${rows}</tbody></table>
<p>Erstellt am ${escapeHtml(preparedDate)}. Dieser Bericht wurde lokal erzeugt; er wird nicht in der Anwendung oder Datenbank gespeichert. Der Beitragsstatus verwendet die aktuelle Mitgliederliste; historische Aktivitätsänderungen werden nicht nachverfolgt. Wiederholungsbuchungen zeigen den Stand bei Berichtserstellung.</p>
</body></html>`;
}
