const config = window.SUPABASE_CONFIG;
const supabaseClient = config?.url && config?.anonKey ? supabase.createClient(config.url, config.anonKey) : null;
const loginDialog = document.querySelector("#login-dialog");
const transactionDialog = document.querySelector("#transaction-dialog");
const passwordResetDialog = document.querySelector("#password-reset-dialog");
const categoryDialog = document.querySelector("#category-dialog");
const csvImportDialog = document.querySelector("#csv-import-dialog");
const recurringDialog = document.querySelector("#recurring-dialog");
const auditDialog = document.querySelector("#audit-dialog");
const authState = document.querySelector("#auth-state");
const financeContent = document.querySelector("#finance-content");
const financeHint = document.querySelector("#finance-login-hint");
const transactionList = document.querySelector("#transaction-list");
const yearFilter = document.querySelector("#year-filter");
const accountFilter = document.querySelector("#account-filter");
const summaryFilter = document.querySelector("#summary-filter");
const transactionSearch = document.querySelector("#transaction-search");
const typeFilter = document.querySelector("#type-filter");
const dateFromFilter = document.querySelector("#date-from-filter");
const dateToFilter = document.querySelector("#date-to-filter");
const reconciliationFilter = document.querySelector("#reconciliation-filter");
const savedFilterChips = document.querySelector("#saved-filter-chips");
const saveFilterButton = document.querySelector("#save-filter");
const bulkReconcileButton = document.querySelector("#bulk-reconcile");
const selectVisibleTransactions = document.querySelector("#select-visible-transactions");
const csvExportDialog = document.querySelector("#csv-export-dialog");
const csvExportForm = document.querySelector("#csv-export-form");
const csvExportStatus = document.querySelector("#csv-export-status");
const exportAudit = document.querySelector("#export-audit");
const retryTransactions = document.querySelector("#retry-transactions");
const transactionForm = document.querySelector("#transaction-form");
const transactionSubmit = document.querySelector("#transaction-submit");
const transactionCategory = document.querySelector("#transaction-category");
const transactionModeHint = document.querySelector("#transaction-mode-hint");
const passwordResetForm = document.querySelector("#password-reset-form");
const categoryManagementForm = document.querySelector("#category-management-form");
const categoryManagementList = document.querySelector("#category-management-list");
const categoryManagementStatus = document.querySelector("#category-management-status");
const cancelTransaction = document.querySelector("#cancel-transaction");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");
const exportTransactions = document.querySelector("#export-transactions");
const exportCsvTransactions = document.querySelector("#export-csv-transactions");
const resetFilters = document.querySelector("#reset-filters");
const activeFilters = document.querySelector("#active-filters");
const databaseSetupStatus = document.querySelector("#database-setup-status");
const reportSetupStatus = document.querySelector("#report-setup-status");
const writeSetupStatus = document.querySelector("#write-setup-status");
const monthlySummary = document.querySelector("#monthly-summary");
const categorySummary = document.querySelector("#category-summary");
const monthlyData = document.querySelector("#monthly-data");
const categoryData = document.querySelector("#category-data");
const showDeleted = document.querySelector("#show-deleted");
const csvImportForm = document.querySelector("#csv-import-form");
const csvFile = document.querySelector("#csv-file");
const csvColumnMapping = document.querySelector("#csv-column-mapping");
const csvPreview = document.querySelector("#csv-preview");
const csvImportStatus = document.querySelector("#csv-import-status");
const csvImportSubmit = document.querySelector("#csv-import-submit");
const csvProfile = document.querySelector("#csv-profile");
const recurringForm = document.querySelector("#recurring-form");
const recurringList = document.querySelector("#recurring-list");
const recurringStatus = document.querySelector("#recurring-status");
const recurringCategory = document.querySelector("#recurring-category");
const recurringNextDate = document.querySelector("#recurring-next-date");
const recurringInterval = document.querySelector("#recurring-interval");
const recurringEndDate = document.querySelector("#recurring-end-date");
const recurringCancelEdit = document.querySelector("#recurring-cancel-edit");
const auditHistory = document.querySelector("#audit-history");
const auditStatus = document.querySelector("#audit-status");
const contributionYear = document.querySelector("#contribution-year");
const contributionSummary = document.querySelector("#contribution-summary");
const contributionList = document.querySelector("#contribution-list");
const contributionError = document.querySelector("#contribution-error");
const contributionAmount = document.querySelector("#contribution-amount");
const bankOpeningBalanceInput = document.querySelector("#bank-opening-balance");
const paypalOpeningBalanceInput = document.querySelector("#paypal-opening-balance");
const contributionPaymentMember = document.querySelector("#contribution-payment-member");
const contributionPaymentTransaction = document.querySelector("#contribution-payment-transaction");
const contributionPaymentQuarter = document.querySelector("#contribution-payment-quarter");
const contributionPaymentCount = document.querySelector("#contribution-payment-count");
const contributionAdminStatus = document.querySelector("#contribution-admin-status");
let session = null;
let transactions = [];
let transactionAnalytics = null;
let currentPage = 0;
const pageSize = 50;
let totalPages = 0;
let loadingTransactions = false;
let editingTransaction = null;
let searchTimer = null;
let csvHeaders = [];
let csvRecords = [];
let csvPreparedRows = [];
let recurringEditId = null;
let selectedTransactionIds = new Set();
const savedFiltersKey = "uhc-prinzen-saved-filters";
const csvColumnsKey = "uhc-prinzen-csv-columns";
const financeStartDate = "2026-10-01";
let savedFilters = [];
let teamMembers = [];
let contributionPayments = [];
let contributionQuarters = [];
let contributionIncomeTransactions = [];
let quarterlyContributionAmount = 75;
let bankOpeningBalance = 0;
let paypalOpeningBalance = 0;
let loadingContributions = false;
let contributionRefreshPending = false;

const money = value => `${(Number(value) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
const todayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const setText = (selector, value) => { document.querySelector(selector).textContent = value; };
const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
dateFromFilter.min = financeStartDate;
dateToFilter.min = financeStartDate;

function resolveDateRange(year, startDate, endDate, today) {
  const yearStart = `${year}-01-01`;
  const minimumStart = yearStart < financeStartDate ? financeStartDate : yearStart;
  const start = startDate && startDate > financeStartDate ? startDate : minimumStart;
  return {
    start,
    end: endDate || (startDate ? today : `${year}-12-31`),
  };
}

function getEffectiveDateRange(year = yearFilter.value || String(new Date().getFullYear())) {
  return resolveDateRange(year, dateFromFilter.value, dateToFilter.value, todayDate());
}

function dateRangeLabel() {
  const range = getEffectiveDateRange();
  return dateFromFilter.value || dateToFilter.value
    ? `${formatDate(range.start)} – ${formatDate(range.end)}`
    : yearFilter.value;
}

async function loadTransactionYears() {
  const { data, error } = await supabaseClient.rpc("get_transaction_years");
  if (!error) return (data || []).map(item => String(item.year));
  if (error.code !== "PGRST202") throw error;
  const { data: fallbackData, error: fallbackError } = await supabaseClient
    .from("transactions")
    .select("transaction_date");
  if (fallbackError) throw fallbackError;
  return [...new Set(fallbackData
    .filter(item => item.transaction_date >= financeStartDate)
    .map(item => item.transaction_date.slice(0, 4)))];
}

function setAuthenticated(nextSession) {
  session = nextSession;
  const authenticated = Boolean(session);
  const administrator = isAdministrator();
  document.querySelector("#login-toggle").hidden = authenticated;
  document.querySelector("#logout-button").hidden = !authenticated;
  document.querySelectorAll("[data-admin-only]").forEach(element => {
    element.hidden = !administrator;
  });
  if (!administrator) showDeleted.checked = false;
  bulkReconcileButton.disabled = true;
  selectedTransactionIds.clear();
  financeContent.hidden = !authenticated;
  financeHint.hidden = authenticated;
  const displayName = session?.user?.user_metadata?.display_name
    || session?.user?.user_metadata?.full_name
    || session?.user?.email;
  authState.textContent = authenticated
    ? `Angemeldet als ${displayName} · ${administrator ? "Administrator" : "Mitglied (nur lesend)"}`
    : "Nur für angemeldete Mitglieder";
  if (!authenticated) {
    transactionAnalytics = null;
    transactions = [];
    writeSetupStatus.textContent = "Schreibrechte: werden bei der ersten Änderung geprüft.";
    writeSetupStatus.className = "";
    setFinanceStatus("");
  }
  if (authenticated) {
    refreshTransactions();
    refreshContributions();
  } else {
    contributionList.replaceChildren();
    contributionSummary.textContent = "";
    contributionError.hidden = true;
  }
}

function isAdministrator() {
  return session?.user?.app_metadata?.role === "admin"
    || session?.user?.email?.toLowerCase() === "bvbrulez@gmail.com";
}

function updateActiveFilters() {
  const filters = [
    ["Zeitraum", dateRangeLabel(), dateFromFilter.value || dateToFilter.value ? "period" : "year"],
    ["Konto", accountFilter.value === "BANK" ? "Bankkonto" : accountFilter.value === "PAYPAL" ? "PayPal-Konto" : null, "account"],
    ["Art", typeFilter.value === "INCOME" ? "Einnahmen" : typeFilter.value === "EXPENSE" ? "Ausgaben" : null, "type"],
    ["Abgleich", reconciliationFilter.value === "OPEN" ? "Noch offen" : reconciliationFilter.value === "RECONCILED" ? "Abgeglichen" : null, "reconciliation"],
    ["Suche", transactionSearch.value.trim() ? `„${transactionSearch.value.trim()}“` : null, "search"],
    ["Summen", summaryFilter.checked && accountFilter.value !== "ALL" ? "Nach Konto gefiltert" : null, "summary"],
  ].filter(([, label]) => label);
  activeFilters.replaceChildren();
  const heading = document.createElement("span");
  heading.className = "active-filters-label";
  heading.textContent = filters.length ? "Aktive Filter" : "Keine aktiven Filter";
  activeFilters.append(heading);
  filters.forEach(([name, label, key]) => {
    const chip = document.createElement("span");
    chip.className = "active-filter-chip";
    const text = document.createElement("span");
    text.textContent = `${name}: ${label}`;
    chip.append(text);
    if (key !== "year") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Filter ${name} entfernen`);
      remove.addEventListener("click", () => {
        if (key === "account") {
          accountFilter.value = "ALL";
          summaryFilter.checked = false;
        } else if (key === "type") typeFilter.value = "ALL";
        else if (key === "reconciliation") reconciliationFilter.value = "ALL";
        else if (key === "search") transactionSearch.value = "";
        else if (key === "summary") summaryFilter.checked = false;
        else if (key === "period") {
          dateFromFilter.value = "";
          dateToFilter.value = "";
        }
        currentPage = 0;
        refreshDateRange();
      });
      chip.append(remove);
    }
    activeFilters.append(chip);
  });
}

function currentFilterState() {
  return {
    year: yearFilter.value,
    start: dateFromFilter.value,
    end: dateToFilter.value,
    account: accountFilter.value,
    summary: summaryFilter.checked,
    search: transactionSearch.value,
    type: typeFilter.value,
    reconciliation: reconciliationFilter.value,
  };
}

function applyFilterState(filters) {
  yearFilter.value = filters.year;
  dateFromFilter.value = filters.start;
  dateToFilter.value = filters.end;
  accountFilter.value = filters.account;
  summaryFilter.checked = filters.summary;
  transactionSearch.value = filters.search;
  typeFilter.value = filters.type;
  reconciliationFilter.value = filters.reconciliation;
  selectedTransactionIds.clear();
  refreshDateRange();
}

function renderSavedFilterChips() {
  const chips = [];
  const last30Days = document.createElement("button");
  last30Days.type = "button";
  last30Days.className = "button button-secondary button-edit";
  last30Days.textContent = "Letzte 30 Tage";
  last30Days.addEventListener("click", () => document.querySelector('[data-date-preset="30"]').click());
  chips.push(last30Days);

  const openReconciliations = document.createElement("button");
  openReconciliations.type = "button";
  openReconciliations.className = "button button-secondary button-edit";
  openReconciliations.textContent = "Offene Abgleiche";
  openReconciliations.addEventListener("click", () => {
    reconciliationFilter.value = "OPEN";
    currentPage = 0;
    refreshTransactions();
  });
  chips.push(openReconciliations);

  savedFilters.forEach((filter, index) => {
    const group = document.createElement("span");
    group.className = "saved-filter-chip";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "button button-secondary button-edit";
    apply.textContent = filter.name;
    apply.addEventListener("click", () => applyFilterState(filter.filters));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "saved-filter-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Gespeicherten Filter ${filter.name} entfernen`);
    remove.addEventListener("click", () => {
      savedFilters.splice(index, 1);
      persistSavedFilters();
    });
    group.append(apply, remove);
    chips.push(group);
  });
  savedFilterChips.replaceChildren(...chips);
}

function persistSavedFilters() {
  try {
    localStorage.setItem(savedFiltersKey, JSON.stringify(savedFilters));
    renderSavedFilterChips();
  } catch (error) {
    setFinanceStatus(`Gespeicherte Filter konnten nicht gespeichert werden: ${error.message}`, "status-error");
  }
}

function loadSavedFilters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedFiltersKey) || "[]");
    const valid = Array.isArray(parsed) && parsed.every(filter =>
      typeof filter?.name === "string"
      && filter.name.trim().length > 0
      && filter.name.length <= 40
      && /^\d{4}$/.test(filter.filters?.year)
      && (!filter.filters?.start || /^\d{4}-\d{2}-\d{2}$/.test(filter.filters.start))
      && (!filter.filters?.end || /^\d{4}-\d{2}-\d{2}$/.test(filter.filters.end))
      && ["ALL", "BANK", "PAYPAL"].includes(filter.filters?.account)
      && typeof filter.filters?.summary === "boolean"
      && typeof filter.filters?.search === "string"
      && ["ALL", "INCOME", "EXPENSE"].includes(filter.filters?.type)
      && ["ALL", "OPEN", "RECONCILED"].includes(filter.filters?.reconciliation));
    if (!valid) throw new Error("Ungültiges gespeichertes Filterformat.");
    savedFilters = parsed.filter(filter =>
      Number(filter.filters.year) >= 2026
      && (!filter.filters.start || filter.filters.start >= financeStartDate)
      && (!filter.filters.end || filter.filters.end >= financeStartDate)).slice(0, 10);
  } catch (error) {
    savedFilters = [];
    setFinanceStatus(`Gespeicherte Filter konnten nicht geladen werden: ${error.message}`, "status-error");
  }
  renderSavedFilterChips();
}

function updateBulkReconcileControls() {
  bulkReconcileButton.disabled = selectedTransactionIds.size === 0;
  bulkReconcileButton.textContent = selectedTransactionIds.size
    ? `Auswahl abgleichen (${selectedTransactionIds.size})`
    : "Auswahl abgleichen";
  if (selectVisibleTransactions) {
    const eligible = transactions.filter(item => !item.deleted_at && !item.reconciled_at);
    const selectedCount = eligible.filter(item => selectedTransactionIds.has(item.id)).length;
    selectVisibleTransactions.checked = eligible.length > 0 && selectedCount === eligible.length;
    selectVisibleTransactions.indeterminate = selectedCount > 0 && selectedCount < eligible.length;
  }
}

function getExportFilters() {
  return {
    account: accountFilter.value,
    type: typeFilter.value,
    search: transactionSearch.value.trim().replace(/[%_(),]/g, " "),
    reconciliation: reconciliationFilter.value,
  };
}

async function loadTransactions() {
  if (!supabaseClient) throw new Error("Supabase ist noch nicht konfiguriert.");
  const year = yearFilter.value || String(new Date().getFullYear());
  const dateRange = getEffectiveDateRange(year);
  if (dateRange.start > dateRange.end) throw new Error("Das Startdatum darf nicht nach dem Enddatum liegen.");
  let query = supabaseClient.from("transactions")
    .select("id, type, account, description, amount, transaction_date, category, created_at, created_by_email, updated_at, updated_by_email, deleted_at, deleted_by_email, reconciled_at, reconciled_by_email", { count: "exact" })
    .gte("transaction_date", dateRange.start)
    .lte("transaction_date", dateRange.end)
    .order("transaction_date", { ascending: false })
    .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
  query = showDeleted.checked && isAdministrator()
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);
  if (accountFilter.value !== "ALL") query = query.eq("account", accountFilter.value);
  if (typeFilter.value !== "ALL") query = query.eq("type", typeFilter.value);
  if (reconciliationFilter.value === "OPEN") query = query.is("reconciled_at", null);
  if (reconciliationFilter.value === "RECONCILED") query = query.not("reconciled_at", "is", null);
  if (transactionSearch.value.trim()) {
    const search = transactionSearch.value.trim().replace(/[%_(),]/g, " ");
    query = query.or(`description.ilike.%${search}%,category.ilike.%${search}%`);
  }
  const analyticsAccount = summaryFilter.checked && accountFilter.value !== "ALL" ? accountFilter.value : null;
  const analyticsPromise = supabaseClient.rpc("get_transaction_analytics", {
    p_year: Number(year),
    p_account: analyticsAccount,
    p_type: typeFilter.value === "ALL" ? null : typeFilter.value,
    p_search: transactionSearch.value.trim().replace(/[%_(),]/g, " ") || null,
    p_start_date: dateRange.start,
    p_end_date: dateRange.end,
    p_reconciled: reconciliationFilter.value === "ALL" ? null : reconciliationFilter.value === "RECONCILED",
  });
  const yearsPromise = loadTransactionYears();
  const categoriesPromise = loadTransactionCategories();
  const [queryOutcome, analyticsOutcome, yearsOutcome, categoriesOutcome] = await Promise.allSettled([query, analyticsPromise, yearsPromise, categoriesPromise]);
  if (queryOutcome.status === "rejected") throw queryOutcome.reason;
  const queryResult = queryOutcome.value;
  if (queryResult.error) throw queryResult.error;
  databaseSetupStatus.textContent = "Datenbankzugriff: verfügbar.";
  databaseSetupStatus.className = "setup-success";
  if (analyticsOutcome.status === "rejected") throw analyticsOutcome.reason;
  const analyticsResult = analyticsOutcome.value;
  if (analyticsResult.error) throw analyticsResult.error;
  if (yearsOutcome.status === "rejected") throw yearsOutcome.reason;
  if (categoriesOutcome.status === "rejected") throw categoriesOutcome.reason;
  const years = yearsOutcome.value;
  setCategoryOptions(categoriesOutcome.value);
  reportSetupStatus.textContent = "Berichtsfunktionen: verfügbar.";
  reportSetupStatus.className = "setup-success";
  const { data, count } = queryResult;
  const { data: analyticsData } = analyticsResult;
  transactions = data || [];
  transactionAnalytics = analyticsData;
  totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  previousPage.disabled = currentPage === 0;
  nextPage.disabled = currentPage >= totalPages - 1;
  pageStatus.textContent = `Seite ${currentPage + 1} von ${totalPages}`;
  const availableYears = [...new Set([
    String(new Date().getFullYear()),
    ...years.filter(value => `${value}-12-31` >= financeStartDate),
  ])].sort().reverse();
  const selectedYear = availableYears.includes(yearFilter.value) ? yearFilter.value : availableYears[0];
  yearFilter.replaceChildren(...availableYears.map(value => new Option(value, value, value === selectedYear, value === selectedYear)));
  updateActiveFilters();
  renderTransactions();
}

async function loadTransactionCategories() {
  const { data, error } = await supabaseClient
    .from("transaction_categories")
    .select("name")
    .order("name");
  if (error) throw error;
  return (data || []).map(item => item.name);
}

function setCategoryOptions(categories, selected = transactionCategory.value) {
  transactionCategory.replaceChildren(...categories.map(name => new Option(name, name)));
  if (selected && !categories.includes(selected)) {
    const legacyOption = new Option(`${selected} (bisherige Kategorie)`, selected);
    legacyOption.dataset.legacyCategory = "true";
    transactionCategory.add(legacyOption);
  }
  if (selected) transactionCategory.value = selected;
  if (isAdministrator()) renderCategoryManagementList(categories);
}

function quarterDate(year, quarterIndex) {
  return new Date(Date.UTC(year, quarterIndex * 3, 1)).toISOString().slice(0, 10);
}

function quarterEndDate(year, quarterIndex) {
  return new Date(Date.UTC(year, (quarterIndex + 1) * 3, 0)).toISOString().slice(0, 10);
}

function renderContributionPaymentControls() {
  contributionPaymentMember.replaceChildren(...teamMembers
    .filter(member => member.active)
    .map(member => new Option(member.name, String(member.id))));
  const usedTransactions = new Set(contributionPayments.map(payment => Number(payment.transaction_id)));
  const availableTransactions = contributionIncomeTransactions.filter(transaction => !usedTransactions.has(Number(transaction.id)));
  contributionPaymentTransaction.replaceChildren(
    new Option(availableTransactions.length ? "Einnahme auswählen" : "Keine unzugeordneten Einnahmen", ""),
    ...availableTransactions.map(transaction => new Option(
      `${formatDate(transaction.transaction_date)} · ${transaction.description} · ${money(transaction.amount)}`,
      String(transaction.id),
    )),
  );
  const year = Number(contributionYear.value || new Date().getFullYear());
  const thisQuarter = Math.floor(new Date().getMonth() / 3);
  const firstQuarter = year === 2026 ? 3 : 0;
  contributionPaymentQuarter.replaceChildren(...[firstQuarter, ...Array.from(
    { length: 3 - firstQuarter },
    (_, index) => firstQuarter + index + 1,
  )].map(index => {
    const option = new Option(`Q${index + 1} ${year}`, quarterDate(year, index));
    option.selected = year === new Date().getFullYear() && index === thisQuarter;
    return option;
  }));
  if (!contributionPaymentQuarter.value) contributionPaymentQuarter.selectedIndex = 0;
  contributionPaymentCount.replaceChildren(...Array.from({ length: 12 }, (_, index) => {
    const count = index + 1;
    return new Option(`${count} Quartal${count === 1 ? "" : "e"}`, String(count), count === 1, count === 1);
  }));
}

function renderTeamContributions() {
  const years = new Set([
    ...Array.from(
      { length: Math.max(1, new Date().getFullYear() + 5 - 2026 + 1) },
      (_, index) => String(2026 + index),
    ),
    ...contributionQuarters.map(item => item.quarter_start.slice(0, 4)).filter(year => year >= "2026"),
  ]);
  const selectedYear = years.has(contributionYear.value) ? contributionYear.value : String(new Date().getFullYear());
  contributionYear.replaceChildren(...[...years].sort((a, b) => Number(b) - Number(a))
    .map(year => new Option(year, year, year === selectedYear, year === selectedYear)));
  const year = Number(selectedYear);
  const paymentsById = new Map(contributionPayments.map(payment => [Number(payment.id), payment]));
  const paymentsByMemberQuarter = new Map();
  contributionQuarters.forEach(quarter => {
    paymentsByMemberQuarter.set(`${quarter.member_id}:${quarter.quarter_start}`, paymentsById.get(Number(quarter.payment_id)));
  });
  const activeMembers = teamMembers.filter(member => member.active);
  const today = todayDate();
  const eligibleQuarters = [0, 1, 2, 3].filter(index => quarterDate(year, index) >= financeStartDate);
  const dueQuarters = eligibleQuarters.filter(index => today >= quarterEndDate(year, index));
  const dueCount = activeMembers.length * dueQuarters.length;
  let paidDueCount = 0;
  let openCount = 0;
  let overdueCount = 0;
  const futureCount = activeMembers.length * (eligibleQuarters.length - dueQuarters.length);
  contributionList.replaceChildren(...teamMembers.map(member => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.textContent = member.active ? member.name : `${member.name} (inaktiv)`;
    row.append(nameCell);
    let memberPaidCount = 0;
    let memberPaidDueCount = 0;
    let memberOpenCount = 0;
    let memberOverdueCount = 0;
    let memberFutureCount = 0;
    [0, 1, 2, 3].forEach(index => {
      const start = quarterDate(year, index);
      const end = quarterEndDate(year, index);
      const payment = paymentsByMemberQuarter.get(`${member.id}:${start}`);
      const cell = document.createElement("td");
      cell.dataset.label = `Q${index + 1}`;
      if (start < financeStartDate) {
        cell.className = "contribution-inactive";
        cell.textContent = "Vor Beginn";
      } else if (payment) {
        memberPaidCount += 1;
        if (member.active && today >= end) {
          memberPaidDueCount += 1;
          paidDueCount += 1;
        }
        const description = payment.transaction?.description || `Buchung #${payment.transaction_id}`;
        const paymentDate = payment.transaction?.transaction_date
          ? formatDate(payment.transaction.transaction_date)
          : "";
        cell.className = "contribution-paid";
        const badge = document.createElement("span");
        badge.className = "contribution-status-pill contribution-status-paid";
        badge.textContent = "Bezahlt";
        const detail = document.createElement("small");
        detail.textContent = `${paymentDate ? `${paymentDate} · ` : ""}${money(payment.quarterly_amount)} · ${description}`;
        cell.append(badge, detail);
        if (isAdministrator()) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "button button-danger button-edit";
          remove.textContent = "Zuordnung aufheben";
          remove.addEventListener("click", () => removeContributionPayment(payment));
          cell.append(remove);
        }
      } else {
        if (!member.active) {
          cell.className = "contribution-inactive";
          cell.textContent = "–";
        } else if (today < end) {
          memberFutureCount += 1;
          cell.className = "contribution-not-due";
          const badge = document.createElement("span");
          badge.className = "contribution-status-pill contribution-status-future";
          badge.textContent = "Noch nicht fällig";
          const detail = document.createElement("small");
          detail.textContent = `bis ${formatDate(end)}`;
          cell.append(badge, detail);
        } else if (today > end) {
          memberOverdueCount += 1;
          overdueCount += 1;
          cell.className = "contribution-overdue";
          const badge = document.createElement("span");
          badge.className = "contribution-status-pill contribution-status-overdue";
          badge.textContent = "Überfällig";
          const detail = document.createElement("small");
          detail.textContent = `seit ${formatDate(end)}`;
          cell.append(badge, detail);
        } else {
          memberOpenCount += 1;
          openCount += 1;
          cell.className = "contribution-open";
          const badge = document.createElement("span");
          badge.className = "contribution-status-pill contribution-status-due";
          badge.textContent = "Fällig heute";
          cell.append(badge);
        }
      }
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    statusCell.dataset.label = "Jahresstatus";
    statusCell.textContent = member.active
      ? `${memberPaidDueCount}/${dueQuarters.length} fällig bezahlt · ${memberOpenCount} offen · ${memberOverdueCount} überfällig · ${memberFutureCount} noch nicht fällig`
      : `${memberPaidCount}/${eligibleQuarters.length} bezahlt · inaktiv`;
    row.append(statusCell);
    const actionCell = document.createElement("td");
    actionCell.hidden = !isAdministrator();
    actionCell.dataset.label = "Mitglied verwalten";
    if (isAdministrator()) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "button button-secondary button-edit";
      toggle.textContent = member.active ? "Deaktivieren" : "Reaktivieren";
      toggle.addEventListener("click", () => toggleTeamMember(member));
      actionCell.append(toggle);
    }
    row.append(actionCell);
    return row;
  }));
  contributionSummary.replaceChildren(
    ...[
      ["Fällig bezahlt", `${paidDueCount} / ${dueCount}`, "paid"],
      ["Überfällig", String(overdueCount), "overdue"],
      ["Heute fällig", String(openCount), "due"],
      ["Noch nicht fällig", String(futureCount), "future"],
      ["Beitrag je Quartal", money(quarterlyContributionAmount), "amount"],
    ].map(([label, value, kind]) => {
      const metric = document.createElement("div");
      metric.className = `contribution-metric contribution-metric-${kind}`;
      const heading = document.createElement("span");
      heading.textContent = label;
      const number = document.createElement("strong");
      number.textContent = value;
      metric.append(heading, number);
      return metric;
    }),
  );
  contributionAmount.value = Number(quarterlyContributionAmount).toFixed(2);
  bankOpeningBalanceInput.value = Number(bankOpeningBalance).toFixed(2);
  paypalOpeningBalanceInput.value = Number(paypalOpeningBalance).toFixed(2);
  renderContributionPaymentControls();
}

async function refreshContributions() {
  if (!supabaseClient || !session) return;
  if (loadingContributions) {
    contributionRefreshPending = true;
    return;
  }
  loadingContributions = true;
  contributionError.hidden = true;
  contributionSummary.textContent = "Beitragsübersicht wird geladen …";
  try {
    const [membersResult, settingsResult, paymentsResult, quartersResult, incomeResult] = await Promise.all([
      supabaseClient.from("team_members").select("id, name, active").order("name"),
      supabaseClient.from("team_contribution_settings")
        .select("quarterly_amount, bank_opening_balance, paypal_opening_balance")
        .eq("id", 1)
        .maybeSingle(),
      supabaseClient.from("team_contribution_payments")
        .select("id, member_id, transaction_id, quarterly_amount, transaction:transactions(description, transaction_date)")
        .order("created_at", { ascending: false }),
      supabaseClient.from("team_contribution_payment_quarters")
        .select("payment_id, member_id, quarter_start"),
      supabaseClient.from("transactions")
        .select("id, description, amount, transaction_date")
        .eq("type", "INCOME")
          .gte("transaction_date", financeStartDate)
          .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .limit(1000),
    ]);
    for (const result of [membersResult, settingsResult, paymentsResult, quartersResult, incomeResult]) {
      if (result.error) throw result.error;
    }
    teamMembers = membersResult.data || [];
    quarterlyContributionAmount = Number(settingsResult.data?.quarterly_amount ?? 75);
    bankOpeningBalance = Number(settingsResult.data?.bank_opening_balance ?? 0);
    paypalOpeningBalance = Number(settingsResult.data?.paypal_opening_balance ?? 0);
    contributionPayments = paymentsResult.data || [];
    contributionQuarters = quartersResult.data || [];
    contributionIncomeTransactions = incomeResult.data || [];
    if (transactionAnalytics) renderTransactions();
    renderTeamContributions();
  } catch (error) {
    contributionSummary.textContent = "Beitragsübersicht konnte nicht geladen werden.";
    contributionError.textContent = `Beitragsdaten fehlen oder konnten nicht geladen werden: ${error.message} Bitte das aktuelle Delta-Skript supabase/schema.sql im Supabase SQL Editor ausführen und die RLS-Berechtigungen prüfen.`;
    contributionError.hidden = false;
  } finally {
    loadingContributions = false;
    if (contributionRefreshPending && session) {
      contributionRefreshPending = false;
      refreshContributions();
    } else {
      contributionRefreshPending = false;
    }
  }
}

async function toggleTeamMember(member) {
  if (!isAdministrator()) return;
  try {
    const { error } = await supabaseClient.from("team_members")
      .update({ active: !member.active })
      .eq("id", member.id);
    if (error) throw error;
    contributionAdminStatus.textContent = `${member.name} wurde ${member.active ? "deaktiviert" : "reaktiviert"}.`;
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = `Mitglied konnte nicht aktualisiert werden: ${error.message}`;
  }
}

async function removeContributionPayment(payment) {
  if (!isAdministrator()) return;
  const count = contributionQuarters.filter(item => Number(item.payment_id) === Number(payment.id)).length;
  if (!window.confirm(`Die Zahlungszuordnung für ${count} Quartal${count === 1 ? "" : "e"} wirklich aufheben? Die Einnahme-Buchung bleibt bestehen.`)) return;
  try {
    const { error } = await supabaseClient.from("team_contribution_payments")
      .delete()
      .eq("id", payment.id);
    if (error) throw error;
    contributionAdminStatus.textContent = "Zahlungszuordnung aufgehoben.";
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = `Zahlungszuordnung konnte nicht aufgehoben werden: ${error.message}`;
  }
}

function renderCategoryManagementList(categories) {
  categoryManagementList.replaceChildren(...categories.map(name => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-danger button-edit";
    remove.textContent = "Entfernen";
    remove.addEventListener("click", () => removeTransactionCategory(name));
    item.append(label, remove);
    return item;
  }));
}

async function removeTransactionCategory(name) {
  if (!isAdministrator()) return;
  if (!window.confirm(`Kategorie "${name}" entfernen? Kategorien mit bestehenden Buchungen können nicht entfernt werden.`)) return;
  const { error } = await supabaseClient.from("transaction_categories").delete().eq("name", name);
  if (error) {
    setWriteSetupStatus(`Kategorielöschen fehlgeschlagen: ${error.message}`, true);
    categoryManagementStatus.textContent = error.code === "23503"
      ? "Diese Kategorie wird noch von Buchungen verwendet und kann deshalb nicht entfernt werden."
      : `Kategorie konnte nicht entfernt werden: ${error.message}`;
    return;
  }
  setWriteSetupStatus("Kategorie löschen erfolgreich.");
  try {
    await refreshCategoryList();
    categoryManagementStatus.textContent = `Kategorie „${name}“ entfernt.`;
  } catch (refreshError) {
    categoryManagementStatus.textContent = `Kategorie wurde entfernt, die Liste konnte aber nicht aktualisiert werden: ${refreshError.message}`;
  }
}

async function refreshCategoryList(selected = transactionCategory.value) {
  const categories = await loadTransactionCategories();
  setCategoryOptions(categories, selected);
}

function setFinanceStatus(message, type = "") {
  const status = document.querySelector("#finance-status");
  status.textContent = message;
  status.className = `status ${type}`.trim();
  status.setAttribute("aria-busy", message.includes("geladen"));
}

function setFinanceSetupError(message) {
  const target = message.includes("Finanzberichte") ? reportSetupStatus : databaseSetupStatus;
  target.textContent = message;
  target.className = "setup-error";
}

function setWriteSetupStatus(message, isError = false) {
  writeSetupStatus.textContent = `Schreibrechte: ${message}`;
  writeSetupStatus.className = isError ? "setup-error" : "setup-success";
}

function getFinanceErrorMessage(error) {
  if (/JWT issued at future/i.test(error.message || "")) {
    return "Die Supabase-Sitzung ist zeitlich ungültig. Bitte automatische Datum-/Uhrzeiteinstellung aktivieren, die Seite neu laden und sich erneut anmelden. Bleibt der Fehler bestehen, muss die Systemzeit zwischen Supabase Auth und Daten-API geprüft werden.";
  }
  if (error.code === "42P01") {
    if (/transaction_categories/i.test(error.message || "")) {
      return "Die zentrale Kategorienliste fehlt. Bitte das aktuelle Delta-Skript supabase/schema.sql im Supabase SQL Editor ausführen.";
    }
    return "Die Finanzdatenbank ist noch nicht eingerichtet. Bitte supabase/schema.sql im Supabase SQL Editor ausführen.";
  }
  if (error.code === "PGRST202" && /get_transaction_(analytics|years)/i.test(error.message || "")) {
    return "Die Supabase-Erweiterung für Finanzberichte fehlt. Bitte das aktuelle Delta-Skript supabase/schema.sql im Supabase SQL Editor ausführen.";
  }
  if (error.code === "42501") {
    return "Der Zugriff auf die Finanzdaten wurde verweigert. Bitte anmelden und die aktuellen Supabase-RLS-Policies aus supabase/schema.sql ausführen.";
  }
  return `Finanzdaten konnten nicht geladen werden: ${error.message}`;
}

async function refreshTransactions() {
  if (loadingTransactions) return;
  loadingTransactions = true;
  selectedTransactionIds.clear();
  updateBulkReconcileControls();
  retryTransactions.hidden = true;
  financeContent.setAttribute("aria-busy", "true");
  setFinanceStatus("Finanzdaten werden geladen …");
  try {
    await loadTransactions();
    setFinanceStatus(transactions.length ? "" : "Noch keine Buchungen vorhanden.");
  } catch (error) {
    const message = getFinanceErrorMessage(error);
    setFinanceStatus(message, "status-error");
    if (error.code === "42P01" || error.code === "PGRST202" || error.code === "42501") setFinanceSetupError(message);
    retryTransactions.hidden = false;
  } finally {
    loadingTransactions = false;
    financeContent.setAttribute("aria-busy", "false");
  }
}

function renderTransactions() {
  const filtered = transactions;
  const totals = transactionAnalytics?.totals || {};
  const period = dateRangeLabel();
  setText("#summary-period", `Kennzahlen für ${period}`);
  const range = getEffectiveDateRange();
  const accounts = transactionAnalytics?.accounts || {};
  const bankBalance = Number(accounts.BANK || 0) + bankOpeningBalance;
  const paypalBalance = Number(accounts.PAYPAL || 0) + paypalOpeningBalance;
  document.querySelector("#bank-balance-label").textContent = `Bankkonto · Saldo zum ${formatDate(range.end)}`;
  document.querySelector("#paypal-balance-label").textContent = `PayPal-Konto · Saldo zum ${formatDate(range.end)}`;
  setText("#reconciliation-period", period);
  const reconciliation = transactionAnalytics?.reconciliation || {};
  for (const [account, prefix] of [["BANK", "bank"], ["PAYPAL", "paypal"]]) {
    const values = reconciliation[account] || {};
    setText(`#${prefix}-open-summary`, `${Number(values.open_count || 0)} · ${money(values.open_amount || 0)}`);
    setText(`#${prefix}-reconciled-summary`, `${Number(values.reconciled_count || 0)} · ${money(values.reconciled_amount || 0)}`);
  }
  setText("#total-income", money(totals.income));
  setText("#total-expenses", money(totals.expenses));
  setText("#total-balance", money(bankBalance + paypalBalance));
  setText("#bank-balance", money(bankBalance));
  setText("#paypal-balance", money(paypalBalance));
  renderAnalytics(transactionAnalytics);
  transactionList.replaceChildren(...filtered.map(item => {
    const row = document.createElement("tr");
    row.classList.add(item.type === "INCOME" ? "income-transaction" : "expense-transaction");
    row.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td class=\"number\"></td><td></td><td></td><td></td><td></td>";
    row.children[0].hidden = !isAdministrator() || Boolean(item.deleted_at) || Boolean(item.reconciled_at);
    row.children[0].dataset.label = "Auswahl";
    if (!row.children[0].hidden) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedTransactionIds.has(item.id);
      checkbox.dataset.transactionId = String(item.id);
      checkbox.setAttribute("aria-label", `Buchung ${item.description} auswählen`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedTransactionIds.add(item.id);
        else selectedTransactionIds.delete(item.id);
        updateBulkReconcileControls();
      });
      row.children[0].append(checkbox);
    }
    row.children[1].dataset.label = "Datum";
    row.children[2].dataset.label = "Konto";
    row.children[3].dataset.label = "Beschreibung";
    row.children[4].dataset.label = "Typ";
    row.children[5].dataset.label = "Betrag";
    row.children[6].dataset.label = "Kategorie";
    row.children[7].dataset.label = "Abgleich";
    row.children[8].dataset.label = "Geändert";
    row.children[9].dataset.label = "Aktion";
    row.children[1].textContent = formatDate(item.transaction_date);
    row.children[2].className = `account-cell ${item.account === "PAYPAL" ? "account-cell-paypal" : "account-cell-bank"}`;
    const accountIcon = document.createElement("span");
    accountIcon.className = "account-row-icon";
    accountIcon.setAttribute("aria-hidden", "true");
    accountIcon.textContent = item.account === "PAYPAL" ? "↗" : "▤";
    const accountName = document.createElement("span");
    accountName.textContent = item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto";
    row.children[2].append(accountIcon, accountName);
    row.children[3].textContent = item.description;
    row.children[4].textContent = item.type === "INCOME" ? "Einnahme" : "Ausgabe";
    row.children[5].textContent = `${item.type === "INCOME" ? "+" : "-"} ${money(item.amount)}`;
    row.children[5].className = `number ${item.type === "INCOME" ? "positive" : "negative"}`;
    row.children[6].textContent = item.category;
    row.children[7].textContent = item.reconciled_at
      ? `Abgeglichen ${formatDate(item.reconciled_at.slice(0, 10))}${item.reconciled_by_email ? ` · ${item.reconciled_by_email}` : ""}`
      : "Offen";
    row.children[7].className = item.reconciled_at ? "reconciliation-done" : "reconciliation-open";
    row.children[8].textContent = item.updated_by_email
      ? `${formatDate(item.updated_at.slice(0, 10))} · ${item.updated_by_email}`
      : `Erstellt ${formatDate(item.created_at.slice(0, 10))}${item.created_by_email ? ` · ${item.created_by_email}` : ""}`;
    row.children[9].hidden = !isAdministrator();
    row.children[9].classList.add("transaction-actions");
    if (!isAdministrator()) return row;
    if (item.deleted_at) {
      row.classList.add("deleted-transaction");
      row.children[3].textContent += " · gelöscht";
      row.children[8].textContent = `Gelöscht ${formatDate(item.deleted_at.slice(0, 10))}${item.deleted_by_email ? ` · ${item.deleted_by_email}` : ""}`;
      const restoreButton = document.createElement("button");
      restoreButton.className = "button button-secondary button-edit";
      restoreButton.type = "button";
      restoreButton.textContent = "Wiederherstellen";
      restoreButton.addEventListener("click", () => restoreTransaction(item));
      row.children[9].append(restoreButton);
    } else {
      const reconcileButton = document.createElement("button");
      reconcileButton.className = `button ${item.reconciled_at ? "button-secondary" : "button-reconcile"} button-edit`;
      reconcileButton.type = "button";
      reconcileButton.textContent = item.reconciled_at ? "Abgleich aufheben" : "Abgleichen";
      reconcileButton.setAttribute("aria-pressed", String(Boolean(item.reconciled_at)));
      reconcileButton.addEventListener("click", () => setTransactionReconciled(item));
      row.children[9].append(reconcileButton);
      const editButton = document.createElement("button");
      editButton.className = "button button-secondary button-edit";
      editButton.type = "button";
      editButton.textContent = "Ändern";
      editButton.addEventListener("click", () => openTransactionEditor(item));
      row.children[9].append(editButton);
      const deleteButton = document.createElement("button");
      deleteButton.className = "button button-danger button-edit";
      deleteButton.type = "button";
      deleteButton.textContent = "Löschen";
      deleteButton.addEventListener("click", () => deleteTransaction(item));
      row.children[9].append(deleteButton);
      const duplicateButton = document.createElement("button");
      duplicateButton.className = "button button-secondary button-edit";
      duplicateButton.type = "button";
      duplicateButton.textContent = "Duplizieren";
      duplicateButton.addEventListener("click", () => openTransactionEditor(item, true));
      row.children[9].append(duplicateButton);
    }
    const auditButton = document.createElement("button");
    auditButton.className = "button button-secondary button-edit";
    auditButton.type = "button";
    auditButton.textContent = "Verlauf";
    auditButton.addEventListener("click", () => openTransactionAudit(item));
    row.children[9].append(auditButton);
    return row;
  }));
  if (!filtered.length) transactionList.innerHTML = '<tr><td colspan="10" class="muted">Keine Buchungen für den gewählten Zeitraum und Filter.</td></tr>';
  updateBulkReconcileControls();
}

function renderAnalytics(analytics) {
  const months = (analytics?.months || []).map(item => ({
    name: `${monthNames[Number(item.month)]} ${item.year}`,
    income: item.income || 0,
    expenses: item.expenses || 0,
  }));
  const maxAmount = Math.max(1, ...months.flatMap(item => [item.income, item.expenses]));
  monthlySummary.replaceChildren(...(months.length ? months : [null]).map(item => {
    if (!item) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Keine Monatswerte im gewählten Zeitraum.";
      return empty;
    }
    const row = document.createElement("div");
    row.className = "month-row";
    const label = document.createElement("span");
    label.className = "month-label";
    label.textContent = item.name;
    const bars = document.createElement("div");
    bars.className = "month-bars";
    bars.setAttribute("aria-hidden", "true");
    for (const [type, amount] of [["income", item.income], ["expense", item.expenses]]) {
      const track = document.createElement("span");
      track.className = `month-track ${type}-track`;
      const fill = document.createElement("i");
      fill.style.width = `${Number(amount) / maxAmount * 100}%`;
      track.append(fill);
      bars.append(track);
    }
    const balance = document.createElement("small");
    balance.textContent = money(Number(item.income) - Number(item.expenses));
    balance.title = "Monatssaldo";
    balance.className = Number(item.income) >= Number(item.expenses) ? "month-balance-positive" : "month-balance-negative";
    const values = document.createElement("div");
    values.className = "month-values";
    values.innerHTML = `<span class="income-value">Einnahmen ${escapeHtml(money(item.income))}</span><span class="expense-value">Ausgaben ${escapeHtml(money(item.expenses))}</span>`;
    row.append(label, bars, values, balance);
    return row;
  }));
  monthlyData.replaceChildren(...(months.length ? months : [null]).map(item => {
    if (!item) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Keine Monatswerte im gewählten Zeitraum.";
      row.append(cell);
      return row;
    }
    const row = document.createElement("tr");
    const values = [item.name, money(item.income), money(item.expenses), money(Number(item.income) - Number(item.expenses))];
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      else cell.className = "number";
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));

  const categoryEntries = analytics?.categories || [];
  const maxCategory = Math.max(1, ...categoryEntries.map(([, amount]) => amount));
  categorySummary.replaceChildren(...(categoryEntries.length ? categoryEntries : [null]).map(entry => {
    if (!entry) {
      const empty = document.createElement("p");
      empty.className = "analytics-empty";
      empty.textContent = "Keine Ausgaben im gewählten Zeitraum.";
      return empty;
    }
    const [category, amount] = entry;
    const row = document.createElement("div");
    row.className = "category-row";
    const label = document.createElement("span");
    label.textContent = category;
    const bar = document.createElement("div");
    bar.className = "category-bar";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("i");
    fill.style.width = `${Number(amount) / maxCategory * 100}%`;
    bar.append(fill);
    const total = document.createElement("strong");
    total.textContent = money(amount);
    const share = document.createElement("small");
    share.className = "category-share";
    share.textContent = `${Math.round(Number(amount) / maxCategory * 100)} %`;
    row.append(label, bar, total, share);
    return row;
  }));
  categoryData.replaceChildren(...(categoryEntries.length ? categoryEntries : [null]).map(entry => {
    const row = document.createElement("tr");
    if (!entry) {
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = "Keine Ausgaben im gewählten Zeitraum.";
      row.append(cell);
      return row;
    }
    const [category, amount] = entry;
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = category;
    const value = document.createElement("td");
    value.className = "number";
    value.textContent = money(amount);
    row.append(label, value);
    return row;
  }));
}

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character]));

function parseCsv(text) {
  const sample = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = [",", ";", "\t"].sort((a, b) => sample.split(b).length - sample.split(a).length)[0];
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.");
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("Die CSV-Datei muss eine Kopfzeile und mindestens eine Buchung enthalten.");
  return rows;
}

const normalizeHeader = value => value.toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const csvFields = [
  { key: "date", title: "Datum", required: true, aliases: ["datum", "date", "buchungsdatum", "valuta", "buchungstag"] },
  { key: "type", title: "Art", aliases: ["art", "typ", "type", "buchungsart", "umsatzart", "sollhaben", "sollhabencode"] },
  { key: "description", title: "Beschreibung", required: true, aliases: ["beschreibung", "verwendungszweck", "buchungstext", "description", "name", "empfaenger", "auftraggeber", "zahlungsempfaenger"] },
  { key: "amount", title: "Betrag", aliases: ["betrag", "umsatz", "amount", "summe", "transaktionsbetrag", "brutto", "gross", "grossamount", "net", "netto", "netamount"] },
  { key: "debit", title: "Soll / Belastung", aliases: ["soll", "solleur", "sollbetrag", "betragsoll", "belastung", "lastschrift", "debit", "ausgabe"] },
  { key: "credit", title: "Haben / Gutschrift", aliases: ["haben", "habeneur", "habenbetrag", "betraghaben", "gutschrift", "credit", "einnahme"] },
  { key: "account", title: "Konto", aliases: ["konto", "account", "kontoname"] },
  { key: "category", title: "Kategorie", aliases: ["kategorie", "category"] },
];

const csvProfileAliases = {
  generic: {},
  sparkasse: {
    date: ["buchungstag", "valuta"],
    description: ["buchungstext", "verwendungszweck"],
    debit: ["soll"],
    credit: ["haben"],
  },
  volksbank: {
    date: ["buchungstag", "wertstellung"],
    description: ["buchungstext", "verwendungszweck"],
    debit: ["soll"],
    credit: ["haben"],
  },
  "deutsche-bank": {
    date: ["buchungstag", "buchungsdatum"],
    description: ["buchungstext", "verwendungszweck"],
    amount: ["betrag", "umsatz"],
  },
  paypal: {
    date: ["datum", "date"],
    description: ["name", "beschreibung"],
    amount: ["brutto", "gross", "grossamount", "betrag", "netto", "net", "netamount"],
    type: ["typ"],
  },
};

function renderCsvMapping() {
  csvColumnMapping.replaceChildren(...csvFields.map(field => {
    const label = document.createElement("label");
    label.textContent = `${field.title}${field.required ? " (erforderlich)" : ""}`;
    const select = document.createElement("select");
    select.dataset.csvField = field.key;
    select.setAttribute("aria-label", `${field.title} in der CSV`);
    select.add(new Option("Nicht zugeordnet", ""));
    csvHeaders.forEach((header, index) => select.add(new Option(header || `Spalte ${index + 1}`, String(index))));
    const profile = csvProfileAliases[csvProfile.value] || {};
    const aliases = [...(profile[field.key] || []), ...field.aliases];
    const match = csvHeaders.findIndex(header => aliases.includes(normalizeHeader(header)));
    if (match >= 0) select.value = String(match);
    label.append(select);
    return label;
  }));
  csvColumnMapping.querySelectorAll("select").forEach(select => select.addEventListener("change", () => {
    classifyCsvRows().catch(error => {
      csvImportSubmit.disabled = true;
      csvImportStatus.textContent = `CSV-Vorschau konnte nicht aktualisiert werden: ${error.message}`;
    });
  }));
}

function parseCsvDate(value) {
  const input = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(input);
  const parts = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local ? [Number(local[3]), Number(local[2]), Number(local[1])] : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;
}

function parseCsvAmount(value) {
  const raw = value.trim().replace(/[€$£\s]/g, "").replace(/\u2212/g, "-");
  const accountingNegative = raw.startsWith("(") && raw.endsWith(")");
  let normalized = accountingNegative ? raw.slice(1, -1) : raw;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount !== 0
    ? { amount: Math.round(Math.abs(amount) * 100) / 100, sign: accountingNegative ? -1 : Math.sign(amount) }
    : null;
}

function parseCsvType(value) {
  const type = normalizeHeader(value);
  if (["income", "einnahme", "eingang", "haben", "h", "credit", "gutschrift"].includes(type)) return "INCOME";
  if (["expense", "ausgabe", "ausgang", "soll", "s", "debit", "lastschrift", "belastung"].includes(type)) return "EXPENSE";
  return null;
}

function getCsvMappedValue(record, field) {
  const selected = csvColumnMapping.querySelector(`[data-csv-field="${field}"]`)?.value;
  return selected === "" || selected === undefined ? "" : record[Number(selected)]?.trim() || "";
}

function csvDuplicateKey(transaction) {
  return JSON.stringify([
    transaction.transaction_date,
    transaction.type,
    transaction.account,
    transaction.description.trim().toLocaleLowerCase("de-DE"),
    Math.round(Number(transaction.amount) * 100),
  ]);
}

async function classifyCsvRows() {
  if (!csvRecords.length) return;
  const categories = await loadTransactionCategories();
  const seen = new Set();
  csvPreparedRows = csvRecords.map((record, index) => {
    const date = parseCsvDate(getCsvMappedValue(record, "date"));
    const explicitType = parseCsvType(getCsvMappedValue(record, "type"));
    const description = getCsvMappedValue(record, "description");
    const rawAmount = getCsvMappedValue(record, "amount");
    const debitValue = getCsvMappedValue(record, "debit");
    const creditValue = getCsvMappedValue(record, "credit");
    const debit = debitValue ? parseCsvAmount(debitValue) : null;
    const credit = creditValue ? parseCsvAmount(creditValue) : null;
    const bothColumnsFilled = Boolean(debit?.amount && credit?.amount);
    const parsedAmount = bothColumnsFilled ? null
      : credit?.amount ? { amount: credit.amount, sign: 1 }
        : debit?.amount ? { amount: debit.amount, sign: -1 }
          : rawAmount ? parseCsvAmount(rawAmount) : null;
    const type = explicitType || (parsedAmount?.sign < 0 ? "EXPENSE" : parsedAmount?.sign > 0 ? "INCOME" : null);
    const amount = parsedAmount?.amount;
    const accountText = normalizeHeader(getCsvMappedValue(record, "account"));
    const account = !accountText
      ? csvProfile.value === "paypal" ? "PAYPAL" : "BANK"
      : ["bank", "bankkonto", "girokonto"].includes(accountText) ? "BANK"
      : ["paypal", "paypalkonto"].includes(accountText) ? "PAYPAL" : null;
    const category = getCsvMappedValue(record, "category") || "Sonstiges";
    const error = !date ? "Datum ungültig"
      : date < financeStartDate ? `Buchungen vor dem ${formatDate(financeStartDate)} liegen außerhalb der Verwaltung`
      : bothColumnsFilled ? "Soll und Haben sind beide befüllt"
        : !type ? "Buchungsart ungültig"
        : !description ? "Beschreibung fehlt"
          : !parsedAmount ? "Betrag ungültig"
            : !account ? "Konto nicht erkannt"
              : description.length > 120 ? "Beschreibung zu lang"
                : !categories.includes(category) ? `Kategorie „${category}“ existiert nicht` : "";
    const transaction = { transaction_date: date, type, account, description, amount, category };
    const key = error ? "" : csvDuplicateKey(transaction);
    const duplicateInFile = key && seen.has(key);
    if (key) seen.add(key);
    return { line: index + 2, transaction, error, key, duplicateInFile, duplicateInDatabase: false };
  });
  await detectCsvDuplicates();
  renderCsvPreview();
}

async function detectCsvDuplicates() {
  const dates = [...new Set(csvPreparedRows.filter(row => !row.error).map(row => row.transaction.transaction_date))];
  if (!dates.length) return;
  const existing = new Set();
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseClient.from("transactions")
      .select("transaction_date, type, account, description, amount")
      .in("transaction_date", dates)
      .is("deleted_at", null)
      .range(offset, offset + 999);
    if (error) throw error;
    (data || []).forEach(item => existing.add(csvDuplicateKey(item)));
    if (!data || data.length < 1000) break;
    offset += data.length;
  }
  csvPreparedRows.forEach(row => {
    row.duplicateInDatabase = Boolean(row.key && existing.has(row.key));
  });
}

function renderCsvPreview() {
  const labels = ["Zeile", "Datum", "Art", "Konto", "Beschreibung", "Betrag", "Kategorie", "Prüfung"];
  csvPreview.replaceChildren(...csvPreparedRows.map(row => {
    const tr = document.createElement("tr");
    const values = [
      row.line,
      row.transaction.transaction_date || "–",
      row.transaction.type === "INCOME" ? "Einnahme" : row.transaction.type === "EXPENSE" ? "Ausgabe" : "–",
      row.transaction.account === "PAYPAL" ? "PayPal" : row.transaction.account === "BANK" ? "Bank" : "–",
      row.transaction.description || "–",
      row.transaction.amount ? money(row.transaction.amount) : "–",
      row.transaction.category || "Sonstiges",
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      cell.dataset.label = labels[index];
      tr.append(cell);
    });
    const check = document.createElement("td");
    check.dataset.label = labels[7];
    check.textContent = row.error || row.duplicateInFile || row.duplicateInDatabase
      ? row.error || (row.duplicateInFile ? "Doppelt in Datei" : "Bereits vorhanden")
      : "Wird importiert";
    tr.classList.toggle("csv-row-error", Boolean(row.error || row.duplicateInFile || row.duplicateInDatabase));
    tr.append(check);
    return tr;
  }));
  const importable = csvPreparedRows.filter(row => !row.error && !row.duplicateInFile && !row.duplicateInDatabase).length;
  const skipped = csvPreparedRows.length - importable;
  csvImportSubmit.disabled = !isAdministrator() || importable === 0;
  csvImportStatus.textContent = `${importable} importierbar · ${skipped} fehlerhaft oder doppelt übersprungen.`;
}

async function setTransactionReconciled(transaction) {
  if (!isAdministrator() || transaction.deleted_at) return;
  const reconciled = !transaction.reconciled_at;
  const message = reconciled
    ? `Buchung "${transaction.description}" als abgeglichen markieren?`
    : `Abgleich für "${transaction.description}" wieder aufheben?`;
  if (!window.confirm(message)) return;
  try {
    const { data, error } = await supabaseClient.from("transactions")
      .update({ reconciled_at: reconciled ? new Date().toISOString() : null })
      .eq("id", transaction.id)
      .is("deleted_at", null)
      .select("id, reconciled_at");
    if (error) throw error;
    if (!data?.length) throw new Error("Die Buchung wurde nicht aktualisiert. Bitte Berechtigungen prüfen.");
    setWriteSetupStatus(reconciled ? "Abgleich gespeichert." : "Abgleich aufgehoben.");
    await refreshTransactions();
  } catch (error) {
    setWriteSetupStatus(`Abgleich konnte nicht aktualisiert werden: ${error.message}`, true);
    setFinanceStatus(`Abgleich fehlgeschlagen: ${error.message}`, "status-error");
  }
}

async function reconcileSelectedTransactions() {
  if (!isAdministrator() || !selectedTransactionIds.size) return;
  const ids = [...selectedTransactionIds];
  if (!window.confirm(`${ids.length} ausgewählte Buchung${ids.length === 1 ? "" : "en"} als abgeglichen markieren?`)) return;
  bulkReconcileButton.disabled = true;
  try {
    const { data, error } = await supabaseClient.from("transactions")
      .update({ reconciled_at: new Date().toISOString() })
      .in("id", ids)
      .is("deleted_at", null)
      .is("reconciled_at", null)
      .select("id");
    if (error) throw error;
    const updatedCount = data?.length || 0;
    selectedTransactionIds.clear();
    setWriteSetupStatus(`${updatedCount} Buchung${updatedCount === 1 ? "" : "en"} abgeglichen.`);
    await refreshTransactions();
    setFinanceStatus(`${updatedCount} Buchung${updatedCount === 1 ? "" : "en"} abgeglichen.`, "status-success");
  } catch (error) {
    setWriteSetupStatus(`Sammelabgleich fehlgeschlagen: ${error.message}`, true);
    setFinanceStatus(`Sammelabgleich fehlgeschlagen: ${error.message}`, "status-error");
  } finally {
    updateBulkReconcileControls();
  }
}

async function openCsvImport() {
  if (!isAdministrator()) return;
  csvImportForm.reset();
  csvColumnMapping.replaceChildren();
  csvPreview.replaceChildren();
  csvPreparedRows = [];
  csvRecords = [];
  csvHeaders = [];
  csvImportSubmit.disabled = true;
  csvImportStatus.textContent = "";
  csvImportDialog.showModal();
}

function downloadCsvExample() {
  const sample = [
    "Datum;Beschreibung;Soll;Haben;Konto;Kategorie",
    "2026-01-15;Monatsbeitrag;;25,00;Bankkonto;Prinzenkröten",
    "2026-01-20;Platzmiete;120,00;;Bankkonto;Platzmiete",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", sample], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "uhc-prinzen-csv-beispiel.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadRecurringTransactions() {
  const { data, error } = await supabaseClient.from("recurring_transactions")
    .select("id, type, account, description, amount, category, day_of_month, next_date, interval_type, end_date, active")
    .order("next_date");
  if (error) throw error;
  recurringList.replaceChildren(...(data || []).map(schedule => {
    const item = document.createElement("li");
    const description = document.createElement("span");
    const intervalName = { weekly: "wöchentlich", monthly: "monatlich", yearly: "jährlich" }[schedule.interval_type] || "monatlich";
    const due = schedule.next_date <= todayDate();
    description.textContent = `${schedule.description} · ${money(schedule.amount)} · ${intervalName} · ${schedule.active ? `nächste Fälligkeit ${formatDate(schedule.next_date)}${due ? " (fällig)" : ""}` : "pausiert"}${schedule.end_date ? ` · bis ${formatDate(schedule.end_date)}` : ""}`;
    item.classList.toggle("recurring-due", due && schedule.active);
    const actions = document.createElement("span");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-secondary button-edit";
    edit.textContent = "Ändern";
    edit.addEventListener("click", () => editRecurringSchedule(schedule));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "button button-secondary button-edit";
    toggle.textContent = schedule.active ? "Pausieren" : "Fortsetzen";
    toggle.addEventListener("click", () => toggleRecurringSchedule(schedule));
    actions.append(edit, toggle);
    item.append(description, actions);
    return item;
  }));
  const categories = await loadTransactionCategories();
  recurringCategory.replaceChildren(...categories.map(name => new Option(name, name)));
}

function editRecurringSchedule(schedule) {
  recurringEditId = schedule.id;
  document.querySelector("#recurring-form-heading").textContent = "Wiederholung bearbeiten";
  document.querySelector("#recurring-description").value = schedule.description;
  document.querySelector("#recurring-type").value = schedule.type;
  document.querySelector("#recurring-account").value = schedule.account;
  document.querySelector("#recurring-amount").value = schedule.amount;
  recurringCategory.value = schedule.category;
  recurringNextDate.value = schedule.next_date;
  recurringInterval.value = schedule.interval_type || "monthly";
  recurringEndDate.value = schedule.end_date || "";
  recurringCancelEdit.hidden = false;
}

async function toggleRecurringSchedule(schedule) {
  if (!isAdministrator()) return;
  try {
    const { error } = await supabaseClient.from("recurring_transactions")
      .update({ active: !schedule.active }).eq("id", schedule.id);
    if (error) throw error;
    await loadRecurringTransactions();
    recurringStatus.textContent = "Wiederholung aktualisiert.";
  } catch (error) {
    recurringStatus.textContent = `Wiederholung konnte nicht aktualisiert werden: ${error.message}`;
    return;
  }
}

async function createDueRecurringTransactions() {
  if (!isAdministrator()) return;
  const button = document.querySelector("#create-due-recurring");
  button.disabled = true;
  recurringStatus.textContent = "Fällige Buchungen werden geprüft …";
  try {
    const { data, error } = await supabaseClient.rpc("create_due_recurring_transactions");
    if (error) throw error;
    recurringStatus.textContent = `${data} fällige Buchung${data === 1 ? "" : "en"} erstellt.`;
    await Promise.all([loadRecurringTransactions(), refreshTransactions(), refreshContributions()]);
  } catch (error) {
    recurringStatus.textContent = `Wiederholungsbuchungen konnten nicht erzeugt werden: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function openTransactionAudit(transaction) {
  auditHistory.replaceChildren();
  auditStatus.textContent = "Verlauf wird geladen …";
  document.querySelector("#audit-heading").textContent = transaction.description;
  auditDialog.showModal();
  let entries;
  try {
    const { data, error } = await supabaseClient.from("transaction_audit_log")
      .select("action, actor_email, occurred_at, old_data, new_data")
      .eq("transaction_id", transaction.id)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    entries = data || [];
  } catch (error) {
    auditStatus.textContent = `Verlauf konnte nicht geladen werden: ${error.message}`;
    return;
  }
  auditHistory.replaceChildren(...entries.map(entry => {
    const item = document.createElement("li");
    const action = { created: "erstellt", updated: "geändert", deleted: "gelöscht", restored: "wiederhergestellt" }[entry.action] || entry.action;
    item.textContent = `${new Date(entry.occurred_at).toLocaleString("de-DE")} · ${entry.actor_email} · ${action}`;
    const oldData = entry.old_data || {};
    const newData = entry.new_data || {};
    const fields = [
      ["description", "Beschreibung", value => value || "–"],
      ["amount", "Betrag", value => value == null ? "–" : money(value)],
      ["type", "Art", value => value === "INCOME" ? "Einnahme" : value === "EXPENSE" ? "Ausgabe" : "–"],
      ["transaction_date", "Datum", value => value || "–"],
      ["account", "Konto", value => value === "PAYPAL" ? "PayPal" : value === "BANK" ? "Bank" : "–"],
      ["category", "Kategorie", value => value || "–"],
      ["reconciled_at", "Abgeglichen am", value => value ? new Date(value).toLocaleString("de-DE") : "Offen"],
      ["reconciled_by_email", "Abgeglichen von", value => value || "–"],
      ["deleted_at", "Gelöscht am", value => value ? new Date(value).toLocaleString("de-DE") : "–"],
    ];
    const table = document.createElement("table");
    table.className = "audit-diff";
    const caption = document.createElement("caption");
    caption.textContent = "Buchungswerte vor und nach diesem Ereignis";
    const head = document.createElement("thead");
    const headingRow = document.createElement("tr");
    ["Feld", "Vorher", "Nachher"].forEach(text => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      headingRow.append(th);
    });
    head.append(headingRow);
    const body = document.createElement("tbody");
    fields.forEach(([key, label, format]) => {
      const oldValue = oldData[key];
      const newValue = newData[key];
      if (JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)) return;
      const row = document.createElement("tr");
      const field = document.createElement("th");
      field.scope = "row";
      field.textContent = label;
      row.append(field);
      [oldValue, newValue].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = format(value);
        row.append(cell);
      });
      body.append(row);
    });
    if (body.children.length) {
      table.append(caption, head, body);
      const scroll = document.createElement("div");
      scroll.className = "table-scroll";
      scroll.append(table);
      item.append(scroll);
    }
    return item;
  }));
  auditStatus.textContent = entries.length ? "" : "Für diese Buchung ist noch kein Änderungsverlauf vorhanden.";
}

async function exportTransactionsAsPdf() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setFinanceStatus("Der PDF-Export wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.", "status-error");
    return;
  }
  exportTransactions.disabled = true;
  exportTransactions.textContent = "Export wird erstellt …";
  setFinanceStatus("PDF-Export: Buchungen werden geladen …");
  try {
    const year = yearFilter.value || String(new Date().getFullYear());
    const dateRange = getEffectiveDateRange(year);
    if (dateRange.start > dateRange.end) throw new Error("Das Startdatum darf nicht nach dem Enddatum liegen.");
    const exportFilters = getExportFilters();
    const pageSizeForExport = 500;
    const rows = [];
    let offset = 0;
    let total = null;
    const maxPdfRows = 5000;
    while (total === null || offset < total) {
      const pageQuery = createExportQuery(year, pageSizeForExport, offset, exportFilters);
      const { data, count, error } = await pageQuery;
      if (error) throw error;
      total ??= count ?? data?.length ?? 0;
      if (total > maxPdfRows) {
        throw new Error(`Der Export umfasst ${total} Buchungen und überschreitet das Limit von ${maxPdfRows}. Bitte Zeitraum, Konto oder Filter eingrenzen.`);
      }
      rows.push(...(data || []));
      offset += data?.length || 0;
      setFinanceStatus(`PDF-Export: ${rows.length} von ${total} Buchungen geladen …`);
      if (!data?.length || data.length < pageSizeForExport) break;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    setFinanceStatus(`PDF-Export: Druckansicht für ${rows.length} Buchungen wird erstellt …`);
    const income = rows.filter(item => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = rows.filter(item => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0);
    const balanceFor = (account, openingBalance) => Number(transactionAnalytics?.accounts?.[account] || 0) + openingBalance;
    const bankBalance = balanceFor("BANK", bankOpeningBalance);
    const paypalBalance = balanceFor("PAYPAL", paypalOpeningBalance);
    const filterLabel = exportFilters.account === "ALL" ? "Alle Konten" : exportFilters.account === "BANK" ? "Bankkonto" : "PayPal-Konto";
    const filterSummary = [dateRangeLabel(), filterLabel, exportFilters.type === "ALL" ? "Alle Buchungsarten" : exportFilters.type === "INCOME" ? "Nur Einnahmen" : "Nur Ausgaben"];
    if (exportFilters.search) filterSummary.push(`Suche: ${exportFilters.search}`);
    if (exportFilters.reconciliation !== "ALL") filterSummary.push(exportFilters.reconciliation === "OPEN" ? "Noch nicht abgeglichen" : "Abgeglichen");
    const logoUrl = new URL("assets/uhc-logo.png", window.location.href).href;
    const tableRows = rows.map(item => `<tr>
      <td>${escapeHtml(formatDate(item.transaction_date))}</td>
      <td>${escapeHtml(item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto")}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.type === "INCOME" ? "Einnahme" : "Ausgabe")}</td>
      <td class="amount ${item.type === "INCOME" ? "income" : "expense"}">${item.type === "INCOME" ? "+" : "-"} ${escapeHtml(money(item.amount))}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${item.reconciled_at ? `Abgeglichen${item.reconciled_by_email ? ` · ${escapeHtml(item.reconciled_by_email)}` : ""}` : "Offen"}</td>
    </tr>`).join("");
    printWindow.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>UHC Prinzen – Buchungen ${escapeHtml(dateRangeLabel())}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { color: #172a3a; font: 12px Arial, sans-serif; margin: 0; }
        header { align-items: center; border-bottom: 2px solid #102d49; display: flex; justify-content: space-between; margin-bottom: 18px; padding-bottom: 10px; } header > div { align-items: center; display: flex; gap: 12px; } .logo { height: 42px; width: auto; }
        h1 { color: #102d49; font-size: 22px; margin: 0 0 4px; } h2 { color: #102d49; font-size: 15px; margin: 20px 0 8px; }
        .meta { color: #5e7480; } .summary { display: flex; gap: 28px; margin: 10px 0 18px; } .summary strong { display: block; font-size: 15px; margin-top: 3px; }
        table { border-collapse: collapse; width: 100%; } th, td { border-bottom: 1px solid #d7e2e6; padding: 7px 5px; text-align: left; } th { background: #eef3f5; color: #5e7480; font-size: 10px; text-transform: uppercase; } .amount { text-align: right; } .income { color: #137455; } .expense { color: #b1423e; }
        .empty { color: #5e7480; padding: 20px 0; } footer { color: #5e7480; margin-top: 18px; } .page-number::after { content: counter(page) " / " counter(pages); }
        .print-button { background: #176b87; border: 0; color: white; cursor: pointer; padding: 8px 12px; } @media print { .print-button { display: none; } }
      </style></head><body>
      <header><div><img class="logo" src="${escapeHtml(logoUrl)}" alt="UHC Prinzen"><div><h1>UHC Prinzen – Buchungen</h1><div class="meta">${escapeHtml(filterSummary.join(" · "))}</div></div></div><button class="print-button" onclick="window.print()">Als PDF speichern / drucken</button></header>
      <div class="summary"><div>Einnahmen im Zeitraum<strong class="income">${escapeHtml(money(income))}</strong></div><div>Ausgaben im Zeitraum<strong class="expense">${escapeHtml(money(expenses))}</strong></div><div>Saldo im Zeitraum<strong>${escapeHtml(money(income - expenses))}</strong></div><div>Saldo Bankkonto zum ${escapeHtml(formatDate(dateRange.end))}<strong>${escapeHtml(money(bankBalance))}</strong></div><div>Saldo PayPal-Konto zum ${escapeHtml(formatDate(dateRange.end))}<strong>${escapeHtml(money(paypalBalance))}</strong></div></div>
      <h2>Alle Buchungen (${rows.length})</h2>
      ${rows.length ? `<table><thead><tr><th>Datum</th><th>Konto</th><th>Beschreibung</th><th>Typ</th><th class="amount">Betrag</th><th>Kategorie</th><th>Abgleich</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><th colspan="4">Saldo</th><th class="amount">${escapeHtml(money(income - expenses))}</th><th colspan="2"></th></tr></tfoot></table>` : '<p class="empty">Keine Buchungen für den gewählten Zeitraum.</p>'}
      <footer>Erstellt am ${escapeHtml(new Date().toLocaleString("de-DE"))} <span class="page-number"> · Seite </span></footer>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setFinanceStatus("PDF-Druckansicht ist bereit. Im neuen Fenster kannst du sie als PDF speichern.", "status-success");
  } catch (error) {
    printWindow.close();
    setFinanceStatus(`PDF-Export fehlgeschlagen: ${error.message}`, "status-error");
  } finally {
    exportTransactions.disabled = false;
    exportTransactions.textContent = "PDF exportieren";
  }
}

const exportColumnOptions = [
  ["transaction_date", "Datum"],
  ["account", "Konto"],
  ["description", "Beschreibung"],
  ["type", "Art"],
  ["amount", "Betrag"],
  ["category", "Kategorie"],
  ["reconciled", "Abgleichstatus"],
  ["reconciled_at", "Abgeglichen am"],
  ["reconciled_by_email", "Abgeglichen von"],
];

function exportColumnValue(item, key) {
  if (key === "account") return item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto";
  if (key === "type") return item.type === "INCOME" ? "Einnahme" : "Ausgabe";
  if (key === "amount") return Number(item.amount).toFixed(2).replace(".", ",");
  if (key === "reconciled") return item.reconciled_at ? "Ja" : "Nein";
  return item[key] || "";
}

async function loadAuditEntriesForExport(rows) {
  const entries = [];
  const ids = rows.map(row => row.id);
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseClient.from("transaction_audit_log")
        .select("transaction_id, action, actor_email, occurred_at, old_data, new_data")
        .in("transaction_id", chunk)
        .order("occurred_at", { ascending: false })
        .range(offset, offset + 499);
      if (error) throw error;
      entries.push(...(data || []));
      if (entries.length > 10000) throw new Error("Der Änderungsverlauf umfasst mehr als 10.000 Einträge. Bitte den Zeitraum verkleinern.");
      if (!data?.length || data.length < 500) break;
      offset += data.length;
    }
  }
  return entries;
}

async function exportTransactionsAsCsv(selectedColumns, includeAudit) {
  exportCsvTransactions.disabled = true;
  setFinanceStatus("CSV-Export: Buchungen werden geladen …");
  try {
    const year = yearFilter.value || String(new Date().getFullYear());
    const dateRange = getEffectiveDateRange(year);
    if (dateRange.start > dateRange.end) throw new Error("Das Startdatum darf nicht nach dem Enddatum liegen.");
    const filters = getExportFilters();
    const rows = [];
    const pageSizeForExport = 500;
    const maxCsvRows = 5000;
    let offset = 0;
    let total = null;
    while (total === null || offset < total) {
      const { data, count, error } = await createExportQuery(year, pageSizeForExport, offset, filters);
      if (error) throw error;
      total ??= count ?? data?.length ?? 0;
      if (total > maxCsvRows) {
        throw new Error(`Der Export umfasst ${total} Buchungen und überschreitet das Limit von ${maxCsvRows}. Bitte Zeitraum, Konto oder Filter eingrenzen.`);
      }
      rows.push(...(data || []));
      offset += data?.length || 0;
      setFinanceStatus(`CSV-Export: ${rows.length} von ${total} Buchungen geladen …`);
      if (!data?.length || data.length < pageSizeForExport) break;
    }
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const safeText = value => /^[\s\u0000-\u001f]*[=+\-@]/.test(String(value ?? "")) ? `'${value}` : value;
    const columns = exportColumnOptions.filter(([key]) => selectedColumns.includes(key));
    const lines = [
      columns.map(([, label]) => quote(label)).join(";"),
      ...rows.map(item => columns.map(([key]) => quote(safeText(exportColumnValue(item, key)))).join(";")),
    ];
    if (includeAudit) {
      setFinanceStatus(`CSV-Export: Änderungsverlauf für ${rows.length} Buchungen wird geladen …`);
      const auditEntries = await loadAuditEntriesForExport(rows);
      const byId = new Map(rows.map(row => [row.id, row.description]));
      lines.push("", [quote("Änderungsverlauf"), quote("Buchungs-ID"), quote("Beschreibung"), quote("Zeitpunkt"), quote("Aktion"), quote("Benutzer"), quote("Vorher"), quote("Nachher")].join(";"));
      lines.push(...auditEntries.map(entry => [
        "",
        entry.transaction_id,
        safeText(byId.get(entry.transaction_id) || ""),
        entry.occurred_at,
        safeText(entry.action),
        safeText(entry.actor_email),
        safeText(JSON.stringify(entry.old_data || {})),
        safeText(JSON.stringify(entry.new_data || {})),
      ].map(quote).join(";")));
    }
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uhc-prinzen-buchungen-${dateRange.start}-bis-${dateRange.end}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFinanceStatus(`CSV-Export mit ${rows.length} Buchungen${includeAudit ? " und Änderungsverlauf" : ""} heruntergeladen.`, "status-success");
  } catch (error) {
    setFinanceStatus(`CSV-Export fehlgeschlagen: ${error.message}`, "status-error");
  } finally {
    exportCsvTransactions.disabled = false;
  }
}

function createExportQuery(year, limit, offset, filters) {
  const dateRange = getEffectiveDateRange(year);
  let query = supabaseClient.from("transactions")
    .select("id, type, account, description, amount, transaction_date, category, reconciled_at, reconciled_by_email", offset === 0 ? { count: "exact" } : {})
    .gte("transaction_date", dateRange.start)
    .lte("transaction_date", dateRange.end)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filters.account !== "ALL") query = query.eq("account", filters.account);
  if (filters.type !== "ALL") query = query.eq("type", filters.type);
  if (filters.search) query = query.or(`description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
  if (filters.reconciliation === "OPEN") query = query.is("reconciled_at", null);
  if (filters.reconciliation === "RECONCILED") query = query.not("reconciled_at", "is", null);
  return query;
}

document.querySelector("#copyright-year").textContent = new Date().getFullYear();
document.querySelector("#login-toggle").addEventListener("click", () => loginDialog.showModal());
document.querySelector("#request-password-reset").addEventListener("click", async () => {
  const email = document.querySelector("#email").value.trim();
  const status = document.querySelector("#password-reset-request-status");
  if (!email) {
    status.textContent = "Bitte zuerst die E-Mail-Adresse eingeben.";
    return;
  }
  if (!supabaseClient) {
    status.textContent = "Supabase ist noch nicht konfiguriert.";
    return;
  }
  status.textContent = "Wiederherstellungslink wird angefordert …";
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  status.textContent = error
    ? `Passwort-Reset konnte nicht angefordert werden: ${error.message}`
    : "Falls ein Konto zu dieser Adresse existiert, wurde ein Wiederherstellungslink versendet.";
});
passwordResetForm.addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#password-reset-status");
  const password = document.querySelector("#new-password").value;
  if (password !== document.querySelector("#confirm-password").value) {
    status.textContent = "Die Passwörter stimmen nicht überein.";
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    status.textContent = `Passwort konnte nicht geändert werden: ${error.message}`;
    return;
  }
  passwordResetForm.reset();
  passwordResetDialog.close();
  loginDialog.close();
  setFinanceStatus("Passwort wurde aktualisiert.", "status-success");
});
document.querySelector("#manage-categories").addEventListener("click", async () => {
  if (!isAdministrator()) return;
  categoryManagementStatus.textContent = "";
  try {
    await refreshCategoryList();
    categoryDialog.showModal();
  } catch (error) {
    categoryManagementStatus.textContent = `Kategorien konnten nicht geladen werden: ${error.message}`;
    categoryDialog.showModal();
  }
});
document.querySelector("#import-transactions").addEventListener("click", openCsvImport);
document.querySelector("#download-csv-example").addEventListener("click", downloadCsvExample);
csvProfile.addEventListener("change", () => {
  if (!csvHeaders.length) return;
  renderCsvMapping();
  classifyCsvRows().catch(error => {
    csvImportSubmit.disabled = true;
    csvImportStatus.textContent = `CSV-Vorschau konnte nicht aktualisiert werden: ${error.message}`;
  });
});
csvFile.addEventListener("change", async () => {
  csvImportSubmit.disabled = true;
  csvImportStatus.textContent = "";
  csvPreview.replaceChildren();
  csvColumnMapping.replaceChildren();
  csvPreparedRows = [];
  csvRecords = [];
  csvHeaders = [];
  try {
    const file = csvFile.files?.[0];
    if (!file) return;
    const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
    if (rows.length - 1 > 500) throw new Error("Pro Import sind höchstens 500 Datenzeilen erlaubt.");
    csvHeaders = rows[0].map(value => value.trim());
    csvRecords = rows.slice(1);
    renderCsvMapping();
    await classifyCsvRows();
  } catch (error) {
    csvImportStatus.textContent = `CSV konnte nicht vorbereitet werden: ${error.message}`;
  }
});
csvImportForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const rows = csvPreparedRows.filter(row => !row.error && !row.duplicateInFile && !row.duplicateInDatabase);
  if (!rows.length) return;
  csvImportSubmit.disabled = true;
  csvImportStatus.textContent = `${rows.length} Buchungen werden importiert …`;
  try {
    const { error } = await supabaseClient.from("transactions")
      .insert(rows.map(row => row.transaction));
    if (error) throw error;
    rows.forEach(row => { row.duplicateInDatabase = true; });
    renderCsvPreview();
    csvImportStatus.textContent = `${rows.length} Buchungen importiert; ${csvPreparedRows.length - rows.length} fehlerhafte oder doppelte Zeilen übersprungen.`;
    await refreshTransactions();
    await refreshContributions();
  } catch (error) {
    csvImportStatus.textContent = `Import fehlgeschlagen; es wurden keine Buchungen übernommen: ${error.message}`;
  } finally {
    csvImportSubmit.disabled = csvPreparedRows.every(row => row.error || row.duplicateInFile || row.duplicateInDatabase);
  }
});
document.querySelector("#manage-recurring").addEventListener("click", async () => {
  if (!isAdministrator()) return;
  recurringStatus.textContent = "";
  recurringForm.reset();
  recurringEditId = null;
  recurringNextDate.value = todayDate();
  document.querySelector("#recurring-form-heading").textContent = "Wiederholung hinzufügen";
  recurringCancelEdit.hidden = true;
  try {
    await loadRecurringTransactions();
  } catch (error) {
    recurringStatus.textContent = `Wiederholungen konnten nicht geladen werden: ${error.message}`;
  }
  recurringDialog.showModal();
});
recurringForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const nextDate = recurringNextDate.value;
  if (!nextDate) {
    recurringStatus.textContent = "Bitte eine gültige erste Fälligkeit wählen.";
    return;
  }
  const payload = {
    type: document.querySelector("#recurring-type").value,
    account: document.querySelector("#recurring-account").value,
    description: document.querySelector("#recurring-description").value.trim(),
    amount: Number(document.querySelector("#recurring-amount").value),
    category: recurringCategory.value,
    day_of_month: Number(nextDate.slice(8, 10)),
    next_date: nextDate,
    interval_type: recurringInterval.value,
    end_date: recurringEndDate.value || null,
  };
  if (payload.end_date && payload.end_date < payload.next_date) {
    recurringStatus.textContent = "Die letzte Fälligkeit darf nicht vor der ersten Fälligkeit liegen.";
    return;
  }
  const query = recurringEditId
    ? supabaseClient.from("recurring_transactions").update(payload).eq("id", recurringEditId)
    : supabaseClient.from("recurring_transactions").insert({ ...payload, created_by: session.user.id });
  const submit = recurringForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const { error } = await query;
    if (error) throw error;
  } catch (error) {
    recurringStatus.textContent = `Wiederholung konnte nicht gespeichert werden: ${error.message}`;
    return;
  } finally {
    submit.disabled = false;
  }
  recurringStatus.textContent = "Wiederholung gespeichert.";
  recurringForm.reset();
  recurringEditId = null;
  document.querySelector("#recurring-form-heading").textContent = "Wiederholung hinzufügen";
  recurringCancelEdit.hidden = true;
  recurringNextDate.value = todayDate();
  recurringInterval.value = "monthly";
  recurringEndDate.value = "";
  try {
    await loadRecurringTransactions();
  } catch (loadError) {
    recurringStatus.textContent = `Wiederholung gespeichert, Liste konnte nicht aktualisiert werden: ${loadError.message}`;
  }
});
recurringCancelEdit.addEventListener("click", () => {
  recurringEditId = null;
  recurringForm.reset();
  recurringNextDate.value = todayDate();
  recurringInterval.value = "monthly";
  recurringEndDate.value = "";
  recurringCancelEdit.hidden = true;
  document.querySelector("#recurring-form-heading").textContent = "Wiederholung hinzufügen";
});
document.querySelector("#create-due-recurring").addEventListener("click", createDueRecurringTransactions);
contributionYear.addEventListener("change", renderTeamContributions);
document.querySelector("#contribution-settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const amount = Number(contributionAmount.value);
  const bankBalance = Number(bankOpeningBalanceInput.value);
  const paypalBalance = Number(paypalOpeningBalanceInput.value);
  if (!Number.isFinite(amount) || amount <= 0
    || !Number.isFinite(bankBalance)
    || !Number.isFinite(paypalBalance)) {
    contributionAdminStatus.textContent = "Bitte einen Quartalsbeitrag größer als 0 und gültige Startsalden eingeben.";
    return;
  }
  try {
    const { error } = await supabaseClient.from("team_contribution_settings").upsert({
      id: 1,
      quarterly_amount: amount,
      bank_opening_balance: bankBalance,
      paypal_opening_balance: paypalBalance,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    });
    if (error) throw error;
    contributionAdminStatus.textContent = "Quartalsbeitrag und Startsalden gespeichert.";
    await refreshTransactions();
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = `Einstellungen konnten nicht gespeichert werden: ${error.message}`;
  }
});
document.querySelector("#contribution-member-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const form = event.currentTarget;
  const name = document.querySelector("#contribution-member-name").value.trim();
  if (!name) return;
  try {
    const { error } = await supabaseClient.from("team_members").insert({ name });
    if (error) throw error;
    form.reset();
    contributionAdminStatus.textContent = `${name} wurde hinzugefügt.`;
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = error.code === "23505"
      ? `„${name}“ ist bereits in der Mitgliederliste.`
      : `Mitglied konnte nicht hinzugefügt werden: ${error.message}`;
  }
});
document.querySelector("#contribution-payment-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const form = event.currentTarget;
  const memberId = Number(contributionPaymentMember.value);
  const transactionId = Number(contributionPaymentTransaction.value);
  const count = Number(contributionPaymentCount.value);
  const firstQuarter = contributionPaymentQuarter.value;
  const transaction = contributionIncomeTransactions.find(item => Number(item.id) === transactionId);
  if (!memberId || !transaction || !firstQuarter || count < 1 || count > 12) {
    contributionAdminStatus.textContent = "Bitte Mitglied, Einnahme-Buchung und Quartalszeitraum auswählen.";
    return;
  }
  if (Math.round(Number(transaction.amount) * 100) !== Math.round(quarterlyContributionAmount * count * 100)) {
    contributionAdminStatus.textContent = `Der Buchungsbetrag (${money(transaction.amount)}) muss genau ${money(quarterlyContributionAmount * count)} für ${count} Quartal${count === 1 ? "" : "e"} betragen.`;
    return;
  }
  const quarterDateValue = new Date(`${firstQuarter}T00:00:00Z`);
  const quarterStarts = Array.from({ length: count }, (_, index) => {
    const date = new Date(quarterDateValue);
    date.setUTCMonth(date.getUTCMonth() + index * 3);
    return date.toISOString().slice(0, 10);
  });
  try {
    const { error } = await supabaseClient.rpc("record_team_contribution_payment", {
      p_member_id: memberId,
      p_transaction_id: transactionId,
      p_quarter_starts: quarterStarts,
    });
    if (error) throw error;
    form.reset();
    contributionAdminStatus.textContent = `Zahlung über ${money(transaction.amount)} für ${count} Quartal${count === 1 ? "" : "e"} zugeordnet.`;
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = `Zahlung konnte nicht zugeordnet werden: ${error.message}`;
  }
});
showDeleted.addEventListener("change", () => {
  if (!isAdministrator()) {
    showDeleted.checked = false;
    return;
  }
  currentPage = 0;
  refreshTransactions();
});
categoryManagementForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const name = document.querySelector("#new-category-name").value.trim();
  if (!name) return;
  const { error } = await supabaseClient.from("transaction_categories").insert({ name });
  if (error) {
    setWriteSetupStatus(`Kategorie anlegen fehlgeschlagen: ${error.message}`, true);
    categoryManagementStatus.textContent = error.code === "23505"
      ? "Diese Kategorie existiert bereits."
      : `Kategorie konnte nicht hinzugefügt werden: ${error.message}`;
    return;
  }
  setWriteSetupStatus("Kategorie anlegen erfolgreich.");
  categoryManagementForm.reset();
  try {
    await refreshCategoryList(name);
    categoryManagementStatus.textContent = `Kategorie „${name}“ hinzugefügt.`;
  } catch (refreshError) {
    categoryManagementStatus.textContent = `Kategorie wurde hinzugefügt, die Liste konnte aber nicht aktualisiert werden: ${refreshError.message}`;
  }
});
document.querySelector("#new-transaction").addEventListener("click", () => {
  if (!isAdministrator()) return;
  editingTransaction = null;
  transactionForm.reset();
  document.querySelector("#transaction-dialog-title").textContent = "Neue Buchung";
  transactionSubmit.textContent = "Speichern";
  document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10);
  resetCategoryOptions();
  transactionModeHint.textContent = "";
  transactionDialog.showModal();
});
yearFilter.addEventListener("change", () => {
  dateFromFilter.value = "";
  dateToFilter.value = "";
  refreshDateRange();
});
function refreshDateRange() {
  const range = getEffectiveDateRange();
  const isBeforeStart = (dateFromFilter.value && dateFromFilter.value < financeStartDate)
    || (dateToFilter.value && dateToFilter.value < financeStartDate);
  const isInvalid = isBeforeStart || range.start > range.end;
  dateFromFilter.setAttribute("aria-invalid", String(Boolean(isInvalid)));
  dateToFilter.setAttribute("aria-invalid", String(Boolean(isInvalid)));
  currentPage = 0;
  if (isInvalid) {
    selectedTransactionIds.clear();
    updateBulkReconcileControls();
    updateActiveFilters();
    setFinanceStatus(isBeforeStart
      ? `Die Verwaltung beginnt am ${formatDate(financeStartDate)}. Frühere Buchungen werden nicht berücksichtigt.`
      : "Das Startdatum darf nicht nach dem Enddatum liegen.", "status-error");
    return;
  }
  refreshTransactions();
}
dateFromFilter.addEventListener("change", refreshDateRange);
dateToFilter.addEventListener("change", refreshDateRange);
document.querySelectorAll("[data-date-preset]").forEach(button => button.addEventListener("click", () => {
  const today = new Date();
  const end = todayDate();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (button.dataset.datePreset === "30") start.setDate(start.getDate() - 29);
  if (button.dataset.datePreset === "month") start.setDate(1);
  if (button.dataset.datePreset === "year") start.setMonth(0, 1);
  const toIso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  dateFromFilter.value = toIso(start);
  dateToFilter.value = end;
  refreshDateRange();
}));
accountFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
summaryFilter.addEventListener("change", refreshTransactions);
typeFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
reconciliationFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
transactionSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentPage = 0; refreshTransactions(); }, 350);
  updateActiveFilters();
});
resetFilters.addEventListener("click", () => {
  accountFilter.value = "ALL";
  dateFromFilter.value = "";
  dateToFilter.value = "";
  reconciliationFilter.value = "ALL";
  summaryFilter.checked = false;
  typeFilter.value = "ALL";
  transactionSearch.value = "";
  refreshDateRange();
});
exportTransactions.addEventListener("click", exportTransactionsAsPdf);
exportCsvTransactions.addEventListener("click", () => {
  try {
    const storedColumns = JSON.parse(localStorage.getItem(csvColumnsKey) || "null");
    if (Array.isArray(storedColumns)) {
      csvExportForm.querySelectorAll('[name="export-column"]').forEach(input => {
        input.checked = storedColumns.includes(input.value);
      });
    }
  } catch (error) {
    csvExportStatus.textContent = `Gespeicherte Spaltenauswahl konnte nicht geladen werden: ${error.message}`;
  }
  exportAudit.checked = false;
  csvExportDialog.showModal();
});
csvExportForm.addEventListener("submit", async event => {
  event.preventDefault();
  const selectedColumns = [...csvExportForm.querySelectorAll('[name="export-column"]:checked')].map(input => input.value);
  if (!selectedColumns.length) {
    csvExportStatus.textContent = "Bitte mindestens eine Buchungsspalte auswählen.";
    return;
  }
  try {
    localStorage.setItem(csvColumnsKey, JSON.stringify(selectedColumns));
  } catch (error) {
    csvExportStatus.textContent = `Spaltenauswahl kann nicht gespeichert werden: ${error.message}`;
  }
  csvExportDialog.close();
  await exportTransactionsAsCsv(selectedColumns, isAdministrator() && exportAudit.checked);
});
saveFilterButton.addEventListener("click", () => {
  if (savedFilters.length >= 10) {
    setFinanceStatus("Es können höchstens 10 Filteransichten gespeichert werden.", "status-error");
    return;
  }
  const name = window.prompt("Name für diese Filteransicht:");
  if (!name?.trim()) return;
  const normalizedName = name.trim().slice(0, 40);
  if (savedFilters.some(filter => filter.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
    setFinanceStatus("Ein gespeicherter Filter mit diesem Namen existiert bereits.", "status-error");
    return;
  }
  savedFilters.push({ name: normalizedName, filters: currentFilterState() });
  persistSavedFilters();
});
bulkReconcileButton.addEventListener("click", reconcileSelectedTransactions);
selectVisibleTransactions.addEventListener("change", () => {
  const eligible = transactions.filter(item => !item.deleted_at && !item.reconciled_at);
  eligible.forEach(item => {
    if (selectVisibleTransactions.checked) selectedTransactionIds.add(item.id);
    else selectedTransactionIds.delete(item.id);
  });
  transactionList.querySelectorAll("[data-transaction-id]").forEach(input => {
    input.checked = selectedTransactionIds.has(Number(input.dataset.transactionId));
  });
  updateBulkReconcileControls();
});
retryTransactions.addEventListener("click", refreshTransactions);
previousPage.addEventListener("click", () => {
  if (currentPage === 0) return;
  currentPage -= 1;
  refreshTransactions();
});
nextPage.addEventListener("click", () => {
  if (currentPage >= totalPages - 1) return;
  currentPage += 1;
  refreshTransactions();
});
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => {
  const dialog = button.closest("dialog");
  if (dialog === transactionDialog) {
    editingTransaction = null;
    transactionForm.reset();
    resetCategoryOptions();
    transactionModeHint.textContent = "";
    transactionSubmit.textContent = "Speichern";
  }
  dialog.close();
}));

function openTransactionEditor(transaction, duplicate = false) {
  if (!isAdministrator()) return;
  editingTransaction = duplicate ? null : transaction;
  document.querySelector("#transaction-dialog-title").textContent = duplicate ? "Buchung duplizieren" : "Buchung ändern";
  transactionModeHint.textContent = duplicate
    ? "Es wird eine neue Buchung angelegt. Bitte Angaben prüfen, damit keine unbeabsichtigte Doppelbuchung entsteht."
    : "";
  transactionSubmit.textContent = duplicate ? "Duplikat speichern" : "Änderungen speichern";
  document.querySelector("#transaction-type").value = transaction.type;
  document.querySelector("#transaction-account").value = transaction.account;
  document.querySelector("#transaction-description").value = duplicate
    ? `${transaction.description} (Kopie)`.slice(0, 120)
    : transaction.description;
  document.querySelector("#transaction-amount").value = transaction.amount;
  document.querySelector("#transaction-date").value = transaction.transaction_date;
  selectCategory(transaction.category);
  if (duplicate) document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#transaction-status").textContent = "";
  transactionDialog.showModal();
}

function resetCategoryOptions() {
  transactionCategory.querySelectorAll("[data-legacy-category]").forEach(option => option.remove());
  transactionCategory.selectedIndex = 0;
}

function selectCategory(category) {
  resetCategoryOptions();
  let option = [...transactionCategory.options].find(item => item.value === category);
  if (!option) {
    option = new Option(`${category} (bisherige Kategorie)`, category);
    option.dataset.legacyCategory = "true";
    transactionCategory.add(option);
  }
  transactionCategory.value = category;
}

cancelTransaction.addEventListener("click", () => {
  editingTransaction = null;
  transactionForm.reset();
  resetCategoryOptions();
  transactionModeHint.textContent = "";
  transactionDialog.close();
});

async function deleteTransaction(transaction) {
  if (!isAdministrator()) return;
  const label = `${transaction.description} (${money(transaction.amount)})`;
  if (!window.confirm(`Buchung "${label}" wirklich löschen?`)) return;
  setFinanceStatus("Buchung wird gelöscht …");
  try {
    const { data, error } = await supabaseClient
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", transaction.id)
      .is("deleted_at", null)
      .select("id, deleted_at");
    if (error) throw error;
    if (!data?.length) {
      throw new Error("Die Buchung wurde nicht gelöscht. Prüfe deine Supabase-UPDATE-Berechtigung.");
    }
    setWriteSetupStatus("Löschen erfolgreich.");
    await refreshTransactions();
    await refreshContributions();
    setFinanceStatus("Buchung erfolgreich gelöscht.", "status-success");
  } catch (error) {
    setWriteSetupStatus(`Löschversuch fehlgeschlagen: ${error.message}`, true);
    setFinanceStatus(`Löschen fehlgeschlagen: ${error.message}`, "status-error");
  }
}

async function restoreTransaction(transaction) {
  if (!isAdministrator()) return;
  if (!window.confirm(`Buchung "${transaction.description}" wiederherstellen?`)) return;
  try {
    const { data, error } = await supabaseClient.from("transactions")
      .update({ deleted_at: null })
      .eq("id", transaction.id)
      .not("deleted_at", "is", null)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Die Buchung wurde nicht wiederhergestellt. Prüfe die Supabase-Berechtigungen.");
    await refreshTransactions();
    await refreshContributions();
    setFinanceStatus("Buchung wiederhergestellt.", "status-success");
  } catch (error) {
    setFinanceStatus(`Wiederherstellung fehlgeschlagen: ${error.message}`, "status-error");
  }
}

document.querySelector("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#login-status");
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  if (!supabaseClient) { status.textContent = "Supabase ist noch nicht konfiguriert."; return; }
  submit.disabled = true;
  submit.textContent = "Anmeldung läuft …";
  status.textContent = "";
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: document.querySelector("#email").value, password: document.querySelector("#password").value });
    if (error) throw error;
    document.querySelector("#login-form").reset();
    loginDialog.close();
    setAuthenticated(data.session);
  } catch (error) {
    status.textContent = `Anmeldung fehlgeschlagen: ${error.message}`;
  } finally {
    submit.disabled = false;
    submit.textContent = "Anmelden";
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) authState.textContent = `Abmeldung fehlgeschlagen: ${error.message}`;
});

document.querySelector("#transaction-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#transaction-status");
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  if (!supabaseClient || !session) return;
  if (!isAdministrator()) {
    status.textContent = "Nur Administratoren dürfen Buchungen anlegen oder ändern.";
    return;
  }
  const payload = {
    type: document.querySelector("#transaction-type").value,
    account: document.querySelector("#transaction-account").value,
    description: document.querySelector("#transaction-description").value.trim(),
    amount: Number(document.querySelector("#transaction-amount").value),
    transaction_date: document.querySelector("#transaction-date").value,
    category: document.querySelector("#transaction-category").value.trim(),
  };
  if (payload.transaction_date < financeStartDate) {
    status.textContent = `Buchungen vor dem ${formatDate(financeStartDate)} liegen außerhalb der Verwaltung.`;
    return;
  }
  submit.disabled = true;
  submit.textContent = "Speichern läuft …";
  status.textContent = "";
  const wasEditing = Boolean(editingTransaction);
  try {
    const query = wasEditing
      ? supabaseClient.from("transactions").update(payload).eq("id", editingTransaction.id).select("id")
      : supabaseClient.from("transactions").insert(payload);
    const { data, error } = await query;
    if (error) throw error;
    if (wasEditing && !data?.length) {
      throw new Error("Die Buchung wurde nicht geändert. Prüfe deine Supabase-UPDATE-Berechtigung.");
    }
    setWriteSetupStatus(wasEditing ? "Ändern erfolgreich." : "Anlegen erfolgreich.");
    document.querySelector("#transaction-form").reset();
    transactionDialog.close();
    editingTransaction = null;
    await refreshTransactions();
    await refreshContributions();
    setFinanceStatus(wasEditing ? "Buchung erfolgreich geändert." : "Buchung erfolgreich gespeichert.", "status-success");
  } catch (error) {
    setWriteSetupStatus(`Schreibversuch fehlgeschlagen: ${error.message}`, true);
    status.textContent = `Speichern fehlgeschlagen: ${error.message}`;
  } finally {
    submit.disabled = false;
    submit.textContent = wasEditing ? "Änderungen speichern" : "Speichern";
  }
});

if (supabaseClient) {
  loadSavedFilters();
  supabaseClient.auth.onAuthStateChange((event, nextSession) => {
    if (event === "PASSWORD_RECOVERY") {
      setAuthenticated(nextSession);
      passwordResetDialog.showModal();
      return;
    }
    if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !nextSession)) {
      setAuthenticated(null);
      authState.textContent = "Sitzung abgelaufen – bitte erneut anmelden";
      return;
    }
    setAuthenticated(nextSession);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      setAuthenticated(null);
      authState.textContent = `Authentifizierung fehlgeschlagen: ${error.message}`;
    } else {
      setAuthenticated(data.session);
    }
  });
} else {
  setAuthenticated(null);
}
