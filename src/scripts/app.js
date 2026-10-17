import {
  FINANCE_START_DATE as financeStartDate,
  contributionAmountForQuarters as calculateContributionAmount,
  contributionDueStatus,
  getQuarterlyContributionAmount as getEffectiveQuarterlyContributionAmount,
  quarterContributionDueDate,
  quarterDate,
  resolveDatePreset,
  resolveDateRange,
} from "./finance-rules.mjs?v=20261013-overview-periods";
import {
  compareContributionUrgency,
  matchesContributionMemberFilter,
} from "./contribution-view-rules.mjs";
import { createContributionService } from "./contribution-service.mjs";
import { createAuthService } from "./auth-service.mjs";
import { createRecurringService } from "./recurring-service.mjs";
import { summarizeRecurringSchedules } from "./recurring-view-rules.mjs";
import { createTransactionService } from "./transaction-service.mjs?v=20261014-receipts";
import { createLatestRequestGate } from "./latest-request.mjs";
import { createTransactionView } from "./transaction-view.mjs?v=20261014-receipts";
import { createCsvImportController } from "./csv-import-controller.mjs";
import {
  buildCsvText,
  exportColumnOptions,
} from "./csv-rules.mjs";
import {
  buildMonthCloseChecklist,
  buildMonthCloseReport,
  monthCloseRange,
} from "./month-close.mjs";

const config = window.SUPABASE_CONFIG;
const supabaseClient = config?.url && config?.anonKey ? supabase.createClient(config.url, config.anonKey) : null;
const authService = supabaseClient ? createAuthService(supabaseClient) : null;
const contributionService = createContributionService(supabaseClient);
const recurringService = createRecurringService(supabaseClient);
const transactionService = createTransactionService(supabaseClient);
const transactionRequests = createLatestRequestGate();
const loginDialog = document.querySelector("#login-dialog");
const transactionDialog = document.querySelector("#transaction-dialog");
const passwordResetDialog = document.querySelector("#password-reset-dialog");
const categoryDialog = document.querySelector("#category-dialog");
const recurringDialog = document.querySelector("#recurring-dialog");
const auditDialog = document.querySelector("#audit-dialog");
const monthCloseDialog = document.querySelector("#month-close-dialog");
const monthCloseMonth = document.querySelector("#month-close-month");
const monthCloseStatus = document.querySelector("#month-close-status");
const monthCloseSummaryElement = document.querySelector("#month-close-summary");
const monthCloseChecklistElement = document.querySelector("#month-close-checklist");
const downloadMonthCloseReport = document.querySelector("#download-month-close-report");
const authState = document.querySelector("#auth-state");

function showToast(message, type = "info") {
  const container = document.querySelector("#toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  if (type === "error") {
    toast.style.borderLeftColor = "var(--danger)";
  } else if (type === "success") {
    toast.style.borderLeftColor = "var(--success)";
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(1rem)";
    toast.style.transition = "opacity .3s, transform .3s";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setupAdminQuickMenu() {
  const toolbar = document.querySelector(".toolbar-actions");
  if (!toolbar) return;

  // Find the position to insert (after CSV export)
  const exportCsvBtn = document.querySelector("#export-csv-transactions");
  if (!exportCsvBtn) return;

  // Only create if not already exists
  if (document.querySelector("#admin-quick-menu")) return;

  const menu = document.createElement("div");
  menu.id = "admin-quick-menu";
  menu.className = "admin-menu";
  menu.setAttribute("data-admin-only", "");
  menu.hidden = true;

  menu.innerHTML = `
    <button class="button button-secondary admin-menu-trigger" type="button" id="admin-menu-toggle">
      <span class="admin-menu-label">⚙️ Admin</span>
      <span class="nav-link-arrow" aria-hidden="true">↓</span>
    </button>
    <div class="admin-menu-dropdown" id="admin-menu-dropdown">
      <button id="bulk-reconcile" class="admin-menu-item button" type="button" disabled>
        <span class="icon" aria-hidden="true">✅</span> Auswahl abgleichen
      </button>
      <button id="manage-categories" class="admin-menu-item button" type="button">
        <span class="icon" aria-hidden="true">🏷️</span> Kategorien verwalten
      </button>
      <button id="import-transactions" class="admin-menu-item button" type="button">
        <span class="icon" aria-hidden="true">📥</span> CSV importieren
      </button>
      <button id="manage-recurring" class="admin-menu-item button" type="button">
        <span class="icon" aria-hidden="true">🔄</span> Wiederholungen
      </button>
      <button id="new-transaction" class="admin-menu-item button" type="button">
        <span class="icon" aria-hidden="true">➕</span> Neue Buchung
      </button>
    </div>
  `;

  exportCsvBtn.after(menu);

  // Toggle logic
  const toggleBtn = menu.querySelector("#admin-menu-toggle");
  const dropdown = menu.querySelector("#admin-menu-dropdown");
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
  });
}
const financeContent = document.querySelector("#finance-content");
const financeHint = document.querySelector("#finance-login-hint");
const transactionList = document.querySelector("#transaction-list");
const recentTransactionsList = document.querySelector("#recent-transactions-list");
const recentTransactionsStatus = document.querySelector("#recent-transactions-status");
const retryRecentTransactions = document.querySelector("#retry-recent-transactions");
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
const showDeleted = document.querySelector("#show-deleted");
const recurringForm = document.querySelector("#recurring-form");
const recurringList = document.querySelector("#recurring-list");
const recurringStatus = document.querySelector("#recurring-status");
const recurringCategory = document.querySelector("#recurring-category");
const recurringNextDate = document.querySelector("#recurring-next-date");
const recurringInterval = document.querySelector("#recurring-interval");
const recurringEndDate = document.querySelector("#recurring-end-date");
const recurringCancelEdit = document.querySelector("#recurring-cancel-edit");
const recurringOverviewStatus = document.querySelector("#recurring-overview-status");
const auditHistory = document.querySelector("#audit-history");
const auditStatus = document.querySelector("#audit-status");
const contributionYear = document.querySelector("#contribution-year");
const contributionSummary = document.querySelector("#contribution-summary");
const contributionList = document.querySelector("#contribution-list");
const contributionMemberSearch = document.querySelector("#contribution-member-search");
const contributionMemberStatus = document.querySelector("#contribution-member-status");
const contributionFilterStatus = document.querySelector("#contribution-filter-status");
const retryContributions = document.querySelector("#retry-contributions");
const contributionNavCount = document.querySelector("#contribution-nav-count");
const contributionAlert = document.querySelector("#contribution-alert");
const contributionAlertMessage = document.querySelector("#contribution-alert-message");
const contributionError = document.querySelector("#contribution-error");
const contributionAmount = document.querySelector("#contribution-amount");
const bankOpeningBalanceInput = document.querySelector("#bank-opening-balance");
const paypalOpeningBalanceInput = document.querySelector("#paypal-opening-balance");
const contributionPaymentMember = document.querySelector("#contribution-payment-member");
const contributionPaymentTransaction = document.querySelector("#contribution-payment-transaction");
const contributionPaymentQuarter = document.querySelector("#contribution-payment-quarter");
const contributionPaymentCount = document.querySelector("#contribution-payment-count");
const contributionPaymentSearch = document.querySelector("#contribution-payment-search");
const contributionPaymentLoadMore = document.querySelector("#contribution-payment-load-more");
const contributionRateQuarter = document.querySelector("#contribution-rate-quarter");
const contributionAdminStatus = document.querySelector("#contribution-admin-status");
let session = null;
let transactions = [];
let recentTransactions = [];
let transactionAnalytics = null;
let currentYearTotals = {};
let previousYearTotals = null;
let currentYear = new Date().getFullYear();
let currentPage = 0;
const pageSize = 50;
let totalPages = 0;
let editingTransaction = null;
let searchTimer = null;
let recurringEditId = null;
let selectedTransactionIds = new Set();
const savedFiltersKey = "uhc-prinzen-saved-filters";
const csvColumnsKey = "uhc-prinzen-csv-columns";
let savedFilters = [];
let teamMembers = [];
let contributionPayments = [];
let contributionQuarters = [];
let contributionIncomeTransactions = [];
let contributionRates = [];
let contributionMemberFilterData = new Map();
let quarterlyContributionAmount = 75;
let bankOpeningBalance = 0;
let paypalOpeningBalance = 0;
let loadingContributions = false;
let contributionRefreshPending = false;
let contributionIncomeRequestId = 0;
let contributionIncomeLoading = false;
let contributionIncomeHasMore = false;
let contributionIncomeSearchTimer = null;
let monthCloseSummary = null;
let monthCloseChecks = [];
let monthCloseReviewed = [];
let monthCloseRequestId = 0;

const money = value => `${(Number(value) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
const todayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const transactionView = createTransactionView({ money, formatDate });
const csvImportController = createCsvImportController({
  transactionService,
  loadCategories: loadTransactionCategories,
  isAdministrator,
  financeStartDate,
  formatDate,
  money,
  refreshTransactions,
  refreshContributions,
});
yearFilter.replaceChildren(new Option(String(currentYear), String(currentYear), true, true));
dateFromFilter.min = financeStartDate;
dateToFilter.min = financeStartDate;

function setFinanceView(view, focusContributions = false) {
  document.querySelectorAll(".finance-section-tab").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.financeView === view));
  });
  document.querySelectorAll(".finance-view").forEach(panel => {
    panel.hidden = panel.id !== `finance-view-${view}`;
  });
  if (focusContributions) {
    const table = document.querySelector("#contribution-table-scroll");
    table.scrollIntoView({ block: "start" });
    table.focus({ preventScroll: true });
    return;
  }
  const panel = document.querySelector(`#finance-view-${view}`);
  panel.scrollIntoView({ block: "start" });
  panel.focus({ preventScroll: true });
}

function renderContributionNavigation(year, openCount, overdueCount) {
  const total = openCount + overdueCount;
  const tab = document.querySelector('.finance-section-tab[data-finance-view="contributions"]');
  contributionNavCount.textContent = String(total);
  contributionNavCount.hidden = total === 0;
  contributionNavCount.classList.toggle("finance-nav-count-overdue", overdueCount > 0);
  contributionNavCount.classList.toggle("finance-nav-count-due", total > 0 && overdueCount === 0);
  contributionAlert.classList.toggle("contribution-alert-due", total > 0 && overdueCount === 0);
  contributionAlert.classList.toggle("contribution-alert-overdue", overdueCount > 0);
  contributionAlertMessage.textContent = total
    ? `Beitragsjahr ${year}: ${total} offene Beiträge, davon ${overdueCount} überfällig und ${openCount} noch innerhalb der Frist.`
    : `Beitragsjahr ${year}: Keine Beiträge sind offen oder überfällig.`;
  tab.setAttribute(
    "aria-label",
    `Beiträge, ${total} offen, davon ${overdueCount} überfällig, Beitragsjahr ${year}`,
  );
}

function getEffectiveDateRange(year = yearFilter.value || String(new Date().getFullYear())) {
  return resolveDateRange(year, dateFromFilter.value, dateToFilter.value, todayDate());
}

function dateRangeLabel() {
  const range = getEffectiveDateRange();
  return dateFromFilter.value || dateToFilter.value
    ? `${formatDate(range.start)} – ${formatDate(range.end)}`
    : `Jahr ${yearFilter.value}`;
}

function updateOverviewPeriodControls() {
  const today = todayDate();
  const month = resolveDatePreset("month", today);
  const year = resolveDatePreset("year", today);
  const hasExplicitRange = Boolean(dateFromFilter.value || dateToFilter.value);
  const isMonth = dateFromFilter.value === month.start && dateToFilter.value === month.end;
  const isYear = dateFromFilter.value === year.start && dateToFilter.value === year.end;
  document.querySelectorAll("[data-overview-period]").forEach(button => {
    const preset = button.dataset.overviewPeriod;
    const selected = preset === "month"
      ? isMonth
      : preset === "year"
        ? isYear || (!hasExplicitRange && yearFilter.value === today.slice(0, 4))
        : hasExplicitRange && !isMonth && !isYear;
    button.setAttribute("aria-pressed", String(selected));
  });
}

function setAuthenticated(nextSession) {
  transactionRequests.invalidate();
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
    recurringOverviewStatus.textContent = "Nach der Anmeldung werden Fälligkeiten angezeigt.";
    financeContent.setAttribute("aria-busy", "false");
    writeSetupStatus.textContent = "Schreibrechte: werden bei der ersten Änderung geprüft.";
    writeSetupStatus.className = "";
    setFinanceStatus("");
    contributionNavCount.textContent = "";
    contributionNavCount.hidden = true;
    contributionFilterStatus.textContent = "";
    retryContributions.hidden = true;
    contributionMemberFilterData.clear();
    contributionMemberSearch.value = "";
    contributionMemberStatus.value = "all";
    recentTransactions = [];
    recentTransactionsList.replaceChildren();
    recentTransactionsStatus.textContent = "Nach der Anmeldung werden die letzten Buchungen angezeigt.";
    retryRecentTransactions.hidden = true;
    contributionNavCount.classList.remove("finance-nav-count-due", "finance-nav-count-overdue");
    contributionAlertMessage.textContent = "Beitragsstatus wird geladen …";
    contributionAlert.classList.remove("contribution-alert-due", "contribution-alert-overdue");
    document.querySelector('.finance-section-tab[data-finance-view="contributions"]')
      .setAttribute("aria-label", "Beiträge");
  }
  if (authenticated) {
    refreshTransactions();
    refreshContributions();
    if (administrator) refreshRecurringOverview();
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
  updateOverviewPeriodControls();
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
updateOverviewPeriodControls();

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

async function loadTransactions(requestId) {
  if (!supabaseClient) throw new Error("Supabase ist noch nicht konfiguriert.");
  const year = yearFilter.value || String(new Date().getFullYear());
  const dateRange = getEffectiveDateRange(year);
  if (dateRange.start > dateRange.end) throw new Error("Das Startdatum darf nicht nach dem Enddatum liegen.");
  const filters = {
    year,
    dateRange,
    showDeleted: showDeleted.checked && isAdministrator(),
    account: accountFilter.value,
    type: typeFilter.value,
    reconciliation: reconciliationFilter.value,
    search: transactionSearch.value.trim().replace(/[%_(),]/g, " "),
    summary: summaryFilter.checked,
  };
  const result = await transactionService.loadPage({
    filters,
    page: currentPage,
    pageSize,
    startDate: financeStartDate,
    asOfDate: todayDate(),
  });
  if (!transactionRequests.isCurrent(requestId)) return;
  databaseSetupStatus.textContent = "Datenbankzugriff: verfügbar.";
  databaseSetupStatus.className = "setup-success";
  setCategoryOptions(result.categories);
  reportSetupStatus.textContent = "Berichtsfunktionen: verfügbar.";
  reportSetupStatus.className = "setup-success";
  transactions = result.transactions;
  transactionAnalytics = result.analytics;
  currentYearTotals = result.yearlyTotals;
  previousYearTotals = result.previousYearTotals;
  currentYear = result.currentYear;
  totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  previousPage.disabled = currentPage === 0;
  nextPage.disabled = currentPage >= totalPages - 1;
  pageStatus.textContent = `Seite ${currentPage + 1} von ${totalPages}`;
  const availableYears = [...new Set([
    String(new Date().getFullYear()),
    ...result.years.filter(value => `${value}-12-31` >= financeStartDate),
  ])].sort().reverse();
  const selectedYear = availableYears.includes(yearFilter.value) ? yearFilter.value : availableYears[0];
  yearFilter.replaceChildren(...availableYears.map(value => new Option(value, value, value === selectedYear, value === selectedYear)));
  updateActiveFilters();
  renderTransactions();
}

async function loadTransactionCategories() {
  return transactionService.loadCategories();
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

function getQuarterlyContributionAmount(quarterStart) {
  return getEffectiveQuarterlyContributionAmount(
    contributionRates,
    quarterlyContributionAmount,
    quarterStart,
  );
}

function contributionAmountForQuarters(quarterStarts) {
  return calculateContributionAmount(contributionRates, quarterlyContributionAmount, quarterStarts);
}

function quarterLabel(quarterStart) {
  const date = new Date(`${quarterStart}T00:00:00Z`);
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

function renderContributionRateHistory() {
  const history = document.querySelector("#contribution-rate-history");
  history.replaceChildren(...[...contributionRates]
    .sort((a, b) => a.quarter_start.localeCompare(b.quarter_start))
    .map(rate => {
      const item = document.createElement("li");
      item.textContent = `Ab ${quarterLabel(rate.quarter_start)}: ${money(rate.quarterly_amount)} je Quartal`;
      return item;
    }));
}

function renderContributionRateQuarterOptions() {
  const lastYear = new Date().getFullYear() + 5;
  const options = [];
  for (let year = 2026; year <= lastYear; year += 1) {
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const start = quarterDate(year, quarter);
      if (start >= financeStartDate) options.push(new Option(quarterLabel(start), start));
    }
  }
  const currentQuarter = quarterDate(
    new Date().getFullYear(),
    Math.floor(new Date().getMonth() / 3),
  );
  const preferred = contributionRateQuarter.value || currentQuarter;
  contributionRateQuarter.replaceChildren(...options);
  contributionRateQuarter.value = options.some(option => option.value === preferred)
    ? preferred
    : options[0]?.value;
}

function renderContributionPaymentControls() {
  const selectedMember = contributionPaymentMember.value;
  const selectedQuarter = contributionPaymentQuarter.value;
  const selectedCount = contributionPaymentCount.value;
  contributionPaymentMember.replaceChildren(...teamMembers
    .filter(member => member.active)
    .map(member => new Option(member.name, String(member.id))));
  if (teamMembers.some(member => member.active && String(member.id) === selectedMember)) {
    contributionPaymentMember.value = selectedMember;
  }
  const usedTransactions = new Set(contributionPayments.map(payment => Number(payment.transaction_id)));
  const availableTransactions = contributionIncomeTransactions.filter(transaction => !usedTransactions.has(Number(transaction.id)));
  const selectedTransaction = contributionPaymentTransaction.value;
  contributionPaymentTransaction.replaceChildren(
    new Option(availableTransactions.length ? "Einnahme auswählen" : "Keine unzugeordneten Einnahmen auf dieser Seite", ""),
    ...availableTransactions.map(transaction => new Option(
      `${formatDate(transaction.transaction_date)} · ${transaction.description} · ${money(transaction.amount)}`,
      String(transaction.id),
    )),
  );
  if (availableTransactions.some(transaction => String(transaction.id) === selectedTransaction)) {
    contributionPaymentTransaction.value = selectedTransaction;
  }
  contributionPaymentLoadMore.disabled = contributionIncomeLoading || !contributionIncomeHasMore;
  contributionPaymentLoadMore.textContent = contributionIncomeLoading
    ? "Einnahmen werden geladen …"
    : contributionIncomeHasMore ? "Ältere Einnahmen laden" : "Keine weiteren Einnahmen";
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
  if ([...contributionPaymentQuarter.options].some(option => option.value === selectedQuarter)) {
    contributionPaymentQuarter.value = selectedQuarter;
  } else if (!contributionPaymentQuarter.value) {
    contributionPaymentQuarter.selectedIndex = 0;
  }
  contributionPaymentCount.replaceChildren(...Array.from({ length: 12 }, (_, index) => {
    const count = index + 1;
    return new Option(`${count} Quartal${count === 1 ? "" : "e"}`, String(count), false, count === 1);
  }));
  if ([...contributionPaymentCount.options].some(option => option.value === selectedCount)) {
    contributionPaymentCount.value = selectedCount;
  }
}

async function loadContributionIncomeTransactions(reset = false) {
  if (!isAdministrator()) return;
  if (!reset && contributionIncomeLoading) return;
  if (reset) {
    contributionIncomeRequestId += 1;
    contributionIncomeTransactions = [];
    contributionIncomeHasMore = false;
  }
  const requestId = contributionIncomeRequestId;
  contributionIncomeLoading = true;
  renderContributionPaymentControls();
  try {
    const offset = reset ? 0 : contributionIncomeTransactions.length;
    const search = contributionPaymentSearch.value.trim();
    const data = await contributionService.loadIncomeTransactions({
      startDate: financeStartDate,
      offset,
      search,
    });
    if (requestId !== contributionIncomeRequestId) return;
    const page = data;
    const knownIds = new Set(contributionIncomeTransactions.map(item => Number(item.id)));
    contributionIncomeTransactions.push(...page.filter(item => !knownIds.has(Number(item.id))));
    contributionIncomeHasMore = page.length === 100;
  } catch (error) {
    if (requestId === contributionIncomeRequestId) {
      contributionAdminStatus.textContent = `Einnahmen konnten nicht geladen werden: ${error.message}`;
    }
  } finally {
    if (requestId === contributionIncomeRequestId) {
      contributionIncomeLoading = false;
      renderContributionPaymentControls();
    }
  }
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
    paymentsByMemberQuarter.set(`${quarter.member_id}:${quarter.quarter_start}`, {
      payment: paymentsById.get(Number(quarter.payment_id)),
      amount: Number(quarter.quarterly_amount),
    });
  });
  const activeMembers = teamMembers.filter(member => member.active);
  const today = todayDate();
  const eligibleQuarters = [0, 1, 2, 3].filter(index => quarterDate(year, index) >= financeStartDate);
  const dueQuarters = eligibleQuarters.filter(index => today >= quarterDate(year, index));
  const dueCount = activeMembers.length * dueQuarters.length;
  let paidDueCount = 0;
  let openCount = 0;
  let overdueCount = 0;
  let outstandingAmount = 0;
  const futureCount = activeMembers.length * (eligibleQuarters.length - dueQuarters.length);
  contributionMemberFilterData = new Map();
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
    let memberOutstandingAmount = 0;
    [0, 1, 2, 3].forEach(index => {
      const start = quarterDate(year, index);
      const dueDate = quarterContributionDueDate(year, index);
      const quarterPayment = paymentsByMemberQuarter.get(`${member.id}:${start}`);
      const cell = document.createElement("td");
      cell.dataset.label = `Q${index + 1}`;
      if (start < financeStartDate) {
        cell.className = "contribution-inactive";
        cell.textContent = "Vor Beginn";
      } else if (quarterPayment?.payment) {
        const payment = quarterPayment.payment;
        memberPaidCount += 1;
        if (member.active && today >= start) {
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
        detail.textContent = `${paymentDate ? `${paymentDate} · ` : ""}${money(quarterPayment.amount)} · ${description}`;
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
        } else {
          const dueStatus = contributionDueStatus(today, start, dueDate);
          if (dueStatus === "future") {
            memberFutureCount += 1;
            cell.className = "contribution-not-due";
            const badge = document.createElement("span");
            badge.className = "contribution-status-pill contribution-status-future";
            badge.textContent = "Noch nicht fällig";
            const detail = document.createElement("small");
            detail.textContent = `${money(getQuarterlyContributionAmount(start))} · fällig bis ${formatDate(dueDate)}`;
            cell.append(badge, detail);
          } else if (dueStatus === "overdue") {
            memberOverdueCount += 1;
            overdueCount += 1;
            memberOutstandingAmount += getQuarterlyContributionAmount(start);
            outstandingAmount += getQuarterlyContributionAmount(start);
            cell.className = "contribution-overdue";
            const badge = document.createElement("span");
            badge.className = "contribution-status-pill contribution-status-overdue";
            badge.textContent = "Überfällig";
            const detail = document.createElement("small");
            detail.textContent = `${money(getQuarterlyContributionAmount(start))} · Frist ${formatDate(dueDate)}`;
            cell.append(badge, detail);
            if (isAdministrator()) {
              const assign = document.createElement("button");
              assign.type = "button";
              assign.className = "button button-secondary button-edit contribution-assign-button";
              assign.textContent = "Zuordnen";
              assign.setAttribute("aria-label", `Zahlung für ${member.name}, Q${index + 1} ${year} zuordnen`);
              assign.addEventListener("click", () => openContributionAssignment(member, start));
              cell.append(assign);
            }
          } else {
            memberOpenCount += 1;
            openCount += 1;
            memberOutstandingAmount += getQuarterlyContributionAmount(start);
            outstandingAmount += getQuarterlyContributionAmount(start);
            cell.className = "contribution-open";
            const badge = document.createElement("span");
            badge.className = "contribution-status-pill contribution-status-due";
            badge.textContent = "Fällig";
            const detail = document.createElement("small");
            detail.textContent = `${money(getQuarterlyContributionAmount(start))} · bis ${formatDate(dueDate)}`;
            cell.append(badge, detail);
            if (isAdministrator()) {
              const assign = document.createElement("button");
              assign.type = "button";
              assign.className = "button button-secondary button-edit contribution-assign-button";
              assign.textContent = "Zuordnen";
              assign.setAttribute("aria-label", `Zahlung für ${member.name}, Q${index + 1} ${year} zuordnen`);
              assign.addEventListener("click", () => openContributionAssignment(member, start));
              cell.append(assign);
            }
          }
        }
      }
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    statusCell.dataset.label = "Jahresstatus";
    statusCell.textContent = member.active
      ? `${memberPaidDueCount}/${dueQuarters.length} fällig bezahlt · ${memberOpenCount} offen · ${memberOverdueCount} überfällig · ${memberFutureCount} noch nicht fällig`
      : `${memberPaidCount}/${eligibleQuarters.length} bezahlt · inaktiv`;
    const outstandingCell = document.createElement("td");
    outstandingCell.dataset.label = "Offen im Jahr";
    outstandingCell.className = `number ${memberOutstandingAmount > 0 ? "contribution-outstanding" : ""}`;
    outstandingCell.textContent = money(memberOutstandingAmount);
    row.append(outstandingCell, statusCell);
    contributionMemberFilterData.set(String(member.id), {
      name: member.name,
      active: member.active,
      paidDueCount: memberPaidDueCount,
      dueQuarterCount: dueQuarters.length,
      openCount: memberOpenCount,
      overdueCount: memberOverdueCount,
      outstandingAmount: memberOutstandingAmount,
    });
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
    row.dataset.memberId = String(member.id);
    return row;
  }));
  const sortedRows = [...contributionList.querySelectorAll("tr[data-member-id]")]
    .sort((left, right) => compareContributionUrgency(
      contributionMemberFilterData.get(left.dataset.memberId),
      contributionMemberFilterData.get(right.dataset.memberId),
    ));
  contributionList.replaceChildren(...sortedRows);
  contributionSummary.replaceChildren(
    ...[
      ["Fällig bezahlt", `${paidDueCount} / ${dueCount}`, "paid"],
      ["Überfällig", String(overdueCount), "overdue"],
      ["Fällig", String(openCount), "due"],
      ["Offen gesamt", money(outstandingAmount), "open-amount"],
      ["Noch nicht fällig", String(futureCount), "future"],
      ["Beitrag aktuell", money(getQuarterlyContributionAmount(quarterDate(
        new Date().getFullYear(),
        Math.floor(new Date().getMonth() / 3),
      ))), "amount"],
    ].map(([label, value, kind]) => {
      const statusFilter = kind === "overdue" ? "overdue" : kind === "open-amount" ? "open" : null;
      const metric = document.createElement(statusFilter ? "button" : "div");
      metric.className = `contribution-metric contribution-metric-${kind}${statusFilter ? " contribution-metric-button" : ""}`;
      if (statusFilter) {
        metric.type = "button";
        metric.dataset.contributionStatus = statusFilter;
        metric.setAttribute("aria-pressed", String(contributionMemberStatus.value === statusFilter));
        metric.addEventListener("click", () => applyContributionQuickFilter(statusFilter));
      }
      const heading = document.createElement("span");
      heading.textContent = label;
      const number = document.createElement("strong");
      number.textContent = value;
      metric.append(heading, number);
      if (statusFilter) {
        const hint = document.createElement("small");
        hint.textContent = "Mitglieder anzeigen";
        metric.append(hint);
      }
      return metric;
    }),
  );
  applyContributionMemberFilters();
  renderContributionNavigation(year, openCount, overdueCount);
  renderContributionRateQuarterOptions();
  contributionAmount.value = getQuarterlyContributionAmount(contributionRateQuarter.value).toFixed(2);
  bankOpeningBalanceInput.value = Number(bankOpeningBalance).toFixed(2);
  paypalOpeningBalanceInput.value = Number(paypalOpeningBalance).toFixed(2);
  renderContributionRateHistory();
  renderContributionPaymentControls();
}

function applyContributionMemberFilters() {
  const search = contributionMemberSearch.value;
  const status = contributionMemberStatus.value;
  const rows = [...contributionList.querySelectorAll("tr[data-member-id]")];
  let visibleCount = 0;
  rows.forEach(row => {
    const member = contributionMemberFilterData.get(row.dataset.memberId);
    row.hidden = !matchesContributionMemberFilter(member, search, status);
    if (!row.hidden) visibleCount += 1;
  });
  if (status === "all" && !search.trim()) {
    rows.sort((left, right) => compareContributionUrgency(
      contributionMemberFilterData.get(left.dataset.memberId),
      contributionMemberFilterData.get(right.dataset.memberId),
    ));
    contributionList.replaceChildren(...rows);
  }
  const filtered = Boolean(search.trim() || status !== "all");
  contributionSummary.querySelectorAll("[data-contribution-status]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.contributionStatus === status));
  });
  const reset = document.querySelector("#reset-contribution-filters");
  reset.disabled = !filtered;
  contributionFilterStatus.textContent = !rows.length
    ? "Noch keine Mitglieder angelegt."
    : filtered
    ? visibleCount
      ? `${visibleCount} von ${rows.length} Mitgliedern angezeigt.`
      : "Keine Mitglieder entsprechen der Suche und dem gewählten Status."
    : `${rows.length} Mitglieder.`;
}

async function openContributionAssignment(member, quarterStart) {
  if (!isAdministrator()) return;
  contributionYear.value = quarterStart.slice(0, 4);
  renderTeamContributions();
  contributionPaymentMember.value = String(member.id);
  contributionPaymentQuarter.value = quarterStart;
  contributionPaymentCount.value = "1";

  // Intelligent Matching
  try {
    const matches = await contributionService.suggestMatches({
      member,
      quarterStart,
      // We need the transaction data. We'll use the current income transactions list.
      transactions: contributionIncomeTransactions,
    });
    if (matches.length > 0) {
      const bestMatch = matches[0].member.id === member.id 
        ? await contributionService.suggestMatches({
            // We need to find the transaction that matched this member best
            // This is a bit circular. Let's refine the suggestMatches logic.
          }) : null;
    }
  } catch (e) {
    console.error("Matching error", e);
  }

  document.querySelector(".contribution-admin").open = true;
  contributionAdminStatus.textContent = `Mitglied ${member.name} und Quartal ${quarterLabel(quarterStart)} sind vorausgewählt.`;
  document.querySelector(".contribution-admin").scrollIntoView({ block: "center" });
  contributionPaymentMember.focus({ preventScroll: true });
}

function applyContributionQuickFilter(status) {
  contributionMemberStatus.value = status;
  applyContributionMemberFilters();
  document.querySelector("#contribution-table-scroll").scrollIntoView({ block: "center" });
}

function showOpenTransactionsForAccount(account) {
  accountFilter.value = account;
  typeFilter.value = "ALL";
  reconciliationFilter.value = "OPEN";
  transactionSearch.value = "";
  summaryFilter.checked = false;
  showDeleted.checked = false;
  clearTimeout(searchTimer);
  currentPage = 0;
  document.querySelector("#transactions-panel").open = true;
  setFinanceView("bookings");
  refreshTransactions();
}

async function refreshContributions() {
  if (!supabaseClient || !session) return;
  if (loadingContributions) {
    contributionRefreshPending = true;
    return;
  }
  loadingContributions = true;
  contributionError.hidden = true;
  retryContributions.hidden = true;
  contributionSummary.textContent = "Beitragsübersicht wird geladen …";
  contributionNavCount.textContent = "";
  contributionNavCount.hidden = true;
  contributionNavCount.classList.remove("finance-nav-count-due", "finance-nav-count-overdue");
  contributionAlertMessage.textContent = "Beitragsstatus wird geladen …";
  contributionAlert.classList.remove("contribution-alert-due", "contribution-alert-overdue");
  try {
    const overview = await contributionService.loadOverview();
    teamMembers = overview.members;
    quarterlyContributionAmount = Number(overview.settings?.quarterly_amount ?? 75);
    bankOpeningBalance = Number(overview.settings?.bank_opening_balance ?? 0);
    paypalOpeningBalance = Number(overview.settings?.paypal_opening_balance ?? 0);
    contributionPayments = overview.payments;
    contributionQuarters = overview.quarters;
    contributionRates = overview.rates;
    if (transactionAnalytics) renderTransactions();
    renderTeamContributions();
    if (isAdministrator()) await loadContributionIncomeTransactions(true);
  } catch (error) {
    contributionSummary.textContent = "Beitragsübersicht konnte nicht geladen werden.";
    contributionAlertMessage.textContent = "Der Beitragsstatus ist derzeit nicht verfügbar.";
    document.querySelector('.finance-section-tab[data-finance-view="contributions"]')
      .setAttribute("aria-label", "Beiträge, Status derzeit nicht verfügbar");
    contributionError.textContent = `Beitragsdaten fehlen oder konnten nicht geladen werden: ${error.message} Bitte das aktuelle Delta-Skript supabase/schema.sql im Supabase SQL Editor ausführen und die RLS-Berechtigungen prüfen.`;
    contributionError.hidden = false;
    retryContributions.hidden = false;
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
    await contributionService.updateMember(member);
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
    await contributionService.removePayment(payment.id);
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
  try {
    await transactionService.removeCategory(name);
  } catch (error) {
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
  const requestId = transactionRequests.begin();
  selectedTransactionIds.clear();
  updateBulkReconcileControls();
  retryTransactions.hidden = true;
  retryRecentTransactions.hidden = true;
  financeContent.setAttribute("aria-busy", "true");
  setFinanceStatus("Finanzdaten werden geladen …");
  recentTransactionsStatus.textContent = "Jüngste Buchungen werden geladen …";
  try {
    await loadTransactions(requestId);
    if (!transactionRequests.isCurrent(requestId)) return;
    setFinanceStatus("");
    try {
      recentTransactions = await transactionService.loadRecentTransactions({
        startDate: financeStartDate,
        limit: 5,
      });
      if (!transactionRequests.isCurrent(requestId)) return;
      renderRecentTransactions();
    } catch (error) {
      if (!transactionRequests.isCurrent(requestId)) return;
      recentTransactions = [];
      recentTransactionsList.replaceChildren();
      recentTransactionsStatus.textContent = `Jüngste Buchungen konnten nicht geladen werden: ${error.message}`;
      retryRecentTransactions.hidden = false;
    }
  } catch (error) {
    if (!transactionRequests.isCurrent(requestId)) return;
    const message = getFinanceErrorMessage(error);
    setFinanceStatus(message, "status-error");
    recentTransactions = [];
    recentTransactionsList.replaceChildren();
    recentTransactionsStatus.textContent = `Jüngste Buchungen konnten nicht geladen werden: ${message}`;
    retryRecentTransactions.hidden = false;
    if (error.code === "42P01" || error.code === "PGRST202" || error.code === "42501") setFinanceSetupError(message);
    retryTransactions.hidden = false;
  } finally {
    if (transactionRequests.isCurrent(requestId)) financeContent.setAttribute("aria-busy", "false");
  }
}

function renderRecentTransactions() {
  retryRecentTransactions.hidden = true;
  recentTransactionsList.replaceChildren(...recentTransactions.map(item => {
    const row = document.createElement("li");
    row.className = `recent-transaction ${item.type === "INCOME" ? "recent-transaction-income" : "recent-transaction-expense"}`;
    const main = document.createElement("div");
    main.className = "recent-transaction-main";
    const description = document.createElement("strong");
    description.textContent = item.description;
    const details = document.createElement("span");
    details.textContent = `${formatDate(item.transaction_date)} · ${item.account === "PAYPAL" ? "PayPal" : "Bank"} · ${item.category}`;
    const amount = document.createElement("strong");
    amount.className = "recent-transaction-amount";
    amount.textContent = `${item.type === "INCOME" ? "+" : "−"} ${money(item.amount)}`;
    const reconciliation = document.createElement("small");
    reconciliation.className = item.reconciled_at ? "reconciliation-done" : "reconciliation-open";
    reconciliation.textContent = item.reconciled_at ? "Abgeglichen" : "Offen";
    main.append(description, details);
    row.append(main, amount, reconciliation);
    return row;
  }));
  recentTransactionsStatus.textContent = recentTransactions.length
    ? `${recentTransactions.length} ${recentTransactions.length === 1 ? "neueste Buchung" : "neueste Buchungen"} seit dem 01.10.2026.`
    : "Noch keine Buchungen vorhanden.";
}

function renderTransactions() {
  const hasActiveFilters = hasNarrowedTransactionFilters();
  transactionView.renderTransactions({
    transactions,
    analytics: transactionAnalytics,
    yearlyTotals: currentYearTotals,
    previousYearTotals,
    currentYear,
    period: dateRangeLabel(),
    range: getEffectiveDateRange(),
    bankOpeningBalance,
    paypalOpeningBalance,
    selectedTransactionIds,
    isAdministrator: isAdministrator(),
    hasActiveFilters,
    callbacks: {
      updateBulkControls: updateBulkReconcileControls,
      restore: restoreTransaction,
      toggleReconciled: setTransactionReconciled,
      edit: openTransactionEditor,
      delete: deleteTransaction,
      duplicate: transaction => openTransactionEditor(transaction, true),
      audit: openTransactionAudit,
      viewReceipt: openTransactionReceipt,
      uploadReceipt: uploadTransactionReceipt,
      removeReceipt: removeTransactionReceipt,
      resetFilters: resetTransactionFilterValues,
    },
  });
}

async function openTransactionReceipt(transaction) {
  if (!session || !transaction.receipt_path) return;
  const receiptWindow = window.open("about:blank", "_blank");
  if (!receiptWindow) {
    setFinanceStatus("Der Browser hat das Belegfenster blockiert. Erlaube Pop-ups und versuche es erneut.", "status-error");
    return;
  }
  receiptWindow.opener = null;
  try {
    const signedUrl = await transactionService.createReceiptUrl(transaction.receipt_path);
    receiptWindow.location.replace(signedUrl);
  } catch (error) {
    receiptWindow.close();
    setFinanceStatus(`Beleg konnte nicht geöffnet werden: ${error.message}`, "status-error");
  }
}

async function uploadTransactionReceipt(transaction, file) {
  if (!isAdministrator() || transaction.deleted_at) return;
  let statusMessage;
  let statusType = "status-success";
  try {
    await transactionService.uploadReceipt(transaction.id, file, transaction.receipt_path);
    statusMessage = `Beleg für „${transaction.description}“ gespeichert.`;
  } catch (error) {
    statusMessage = `Beleg konnte nicht gespeichert werden: ${error.message}`;
    statusType = "status-error";
  }
  await refreshTransactions();
  setFinanceStatus(statusMessage, statusType);
}

async function removeTransactionReceipt(transaction) {
  if (!isAdministrator() || !transaction.receipt_path) return;
  if (!window.confirm(`Beleg „${transaction.receipt_name || transaction.description}“ endgültig entfernen?`)) return;
  let statusMessage;
  let statusType = "status-success";
  try {
    await transactionService.removeReceipt(transaction);
    statusMessage = `Beleg für „${transaction.description}“ entfernt.`;
  } catch (error) {
    statusMessage = `Beleg konnte nicht vollständig entfernt werden: ${error.message}`;
    statusType = "status-error";
  }
  await refreshTransactions();
  setFinanceStatus(statusMessage, statusType);
}

function renderMonthCloseSummary(summary, range) {
  monthCloseSummaryElement.replaceChildren();
  const rows = [
    ["Zeitraum", `${formatDate(range.start)} bis ${formatDate(range.end)}${range.isProvisional ? " · vorläufig" : ""}`],
    ["Einnahmen", money(summary.totals.income)],
    ["Ausgaben", money(summary.totals.expenses)],
    ["Offene Abgleiche", `${summary.openReconciliations} · ${money(summary.openReconciliationAmount)}`],
  ];
  rows.forEach(([label, value]) => {
    const item = document.createElement("p");
    const heading = document.createElement("strong");
    heading.textContent = `${label}: `;
    item.append(heading, document.createTextNode(value));
    monthCloseSummaryElement.append(item);
  });
  monthCloseSummaryElement.hidden = false;
}

function updateMonthCloseDownloadState() {
  downloadMonthCloseReport.disabled = !monthCloseSummary
    || !monthCloseChecks.length
    || monthCloseReviewed.some(reviewed => !reviewed);
}

async function refreshMonthClose() {
  if (!isAdministrator()) return;
  const requestId = ++monthCloseRequestId;
  downloadMonthCloseReport.disabled = true;
  monthCloseSummary = null;
  monthCloseChecks = [];
  monthCloseReviewed = [];
  monthCloseChecklistElement.replaceChildren();
  monthCloseSummaryElement.hidden = true;
  try {
    const today = todayDate();
    const range = monthCloseRange(monthCloseMonth.value, today);
    monthCloseStatus.textContent = "Monatsdaten werden geladen …";
    const [analytics, overview, recurringSchedules] = await Promise.all([
      transactionService.loadMonthCloseAnalytics(monthCloseMonth.value, range.end),
      contributionService.loadOverview(),
      recurringService.load(),
    ]);
    monthCloseSummary = buildMonthCloseChecklist({
      month: monthCloseMonth.value,
      endDate: range.end,
      analytics,
      members: overview.members,
      payments: overview.payments,
      quarters: overview.quarters,
      rates: overview.rates,
      quarterlyAmount: Number(overview.settings?.quarterly_amount ?? quarterlyContributionAmount),
      recurringSchedules,
      today,
      isProvisional: range.isProvisional,
    });
    if (requestId !== monthCloseRequestId) return;
    monthCloseChecks = [
      ["Monatsbuchungen und Summen prüfen", `${money(monthCloseSummary.totals.income)} Einnahmen · ${money(monthCloseSummary.totals.expenses)} Ausgaben`],
      ["Offene Abgleiche prüfen", `${monthCloseSummary.openReconciliations} offene Buchungen · ${money(monthCloseSummary.openReconciliationAmount)}`],
      ["Quartalsbeiträge prüfen", monthCloseSummary.contribution.quarterStart
        ? monthCloseSummary.contribution.isDue
          ? `${monthCloseSummary.contribution.unpaidCount} offen · ${money(monthCloseSummary.contribution.unpaidAmount)}`
          : `${monthCloseSummary.contribution.activeMemberCount} Beiträge noch nicht fällig · fällig am ${formatDate(monthCloseSummary.contribution.dueDate)}`
        : "In diesem Monat beginnt kein Beitragsquartal."],
      ["Wiederholungsbuchungen prüfen", `${monthCloseSummary.recurringDueCount} aktuell fällig (Stand heute).`],
    ];
    monthCloseReviewed = monthCloseChecks.map(() => false);
    monthCloseChecks.forEach(([label, detail], index) => {
      const item = document.createElement("li");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.addEventListener("change", () => {
        monthCloseReviewed[index] = input.checked;
        updateMonthCloseDownloadState();
      });
      const text = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = label;
      const description = document.createElement("small");
      description.textContent = detail;
      text.append(title, description);
      item.append(input, text);
      monthCloseChecklistElement.append(item);
    });
    renderMonthCloseSummary(monthCloseSummary, range);
    monthCloseStatus.textContent = range.isProvisional
      ? "Der laufende Monat ist vorläufig und umfasst Buchungen bis heute."
      : "Alle Daten für den gewählten Abschlussmonat sind geladen. Wiederholungen zeigen den heutigen Stand.";
  } catch (error) {
    if (requestId !== monthCloseRequestId) return;
    monthCloseStatus.textContent = `Monatsabschluss konnte nicht vorbereitet werden: ${error.message}`;
  }
  if (requestId !== monthCloseRequestId) return;
  updateMonthCloseDownloadState();
}

function archiveMonthCloseReport() {
  if (!isAdministrator() || !monthCloseSummary || monthCloseReviewed.some(reviewed => !reviewed)) return;
  const html = buildMonthCloseReport(monthCloseSummary, monthCloseReviewed);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `uhc-prinzen-monatsabschluss-${monthCloseSummary.month}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  monthCloseStatus.textContent = "Monatsbericht heruntergeladen. Lege die Datei am gewünschten Archivort ab.";
}

function hasNarrowedTransactionFilters() {
  return dateFromFilter.value !== ""
    || dateToFilter.value !== ""
    || accountFilter.value !== "ALL"
    || summaryFilter.checked
    || typeFilter.value !== "ALL"
    || reconciliationFilter.value !== "ALL"
    || transactionSearch.value.trim() !== ""
    || showDeleted.checked;
}

function resetTransactionFilterValues() {
  accountFilter.value = "ALL";
  yearFilter.value = String(new Date().getFullYear());
  dateFromFilter.value = "";
  dateToFilter.value = "";
  reconciliationFilter.value = "ALL";
  summaryFilter.checked = false;
  typeFilter.value = "ALL";
  transactionSearch.value = "";
  showDeleted.checked = false;
  refreshDateRange();
}

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character]));

async function setTransactionReconciled(transaction) {
  if (!isAdministrator() || transaction.deleted_at) return;
  const reconciled = !transaction.reconciled_at;
  const message = reconciled
    ? `Buchung "${transaction.description}" als abgeglichen markieren?`
    : `Abgleich für "${transaction.description}" wieder aufheben?`;
  if (!window.confirm(message)) return;
  try {
    const data = await transactionService.setReconciled(transaction.id, reconciled);
    if (!data.length) throw new Error("Die Buchung wurde nicht aktualisiert. Bitte Berechtigungen prüfen.");
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
    const data = await transactionService.reconcileMany(ids);
    const updatedCount = data.length;
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

async function loadRecurringTransactions() {
  const schedules = await recurringService.load();
  renderRecurringOverview(schedules);
  recurringList.replaceChildren(...schedules.map(schedule => {
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

function renderRecurringOverview(schedules) {
  const { dueCount, nextDate } = summarizeRecurringSchedules(schedules, todayDate());
  if (!nextDate) {
    recurringOverviewStatus.textContent = "Keine aktiven Wiederholungen vorhanden.";
  } else if (dueCount) {
    recurringOverviewStatus.textContent = `${dueCount} Wiederholung${dueCount === 1 ? "" : "en"} fällig · nächste Fälligkeit ${formatDate(nextDate)}.`;
  } else {
    recurringOverviewStatus.textContent = `Keine fällig · nächste Fälligkeit ${formatDate(nextDate)}.`;
  }
}

async function refreshRecurringOverview() {
  try {
    const schedules = await recurringService.load();
    renderRecurringOverview(schedules);
  } catch (error) {
    recurringOverviewStatus.textContent = `Fälligkeiten konnten nicht geladen werden: ${error.message}`;
  }
}

async function openRecurringDialog() {
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
    await recurringService.setActive(schedule.id, !schedule.active);
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
    const count = await recurringService.createDue();
    recurringStatus.textContent = `${count} fällige Buchung${count === 1 ? "" : "en"} erstellt.`;
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
    entries = await transactionService.loadAudit(transaction.id);
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
      const { data, count } = await transactionService.loadExportPage({
        filters: exportFilters,
        dateRange,
        offset,
        limit: pageSizeForExport,
        includeCount: offset === 0,
      });
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

async function loadAuditEntriesForExport(rows) {
  const ids = rows.map(row => row.id);
  return transactionService.loadAuditForExport(ids);
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
      const { data, count } = await transactionService.loadExportPage({
        filters,
        dateRange,
        offset,
        limit: pageSizeForExport,
        includeCount: offset === 0,
      });
      total ??= count ?? data?.length ?? 0;
      if (total > maxCsvRows) {
        throw new Error(`Der Export umfasst ${total} Buchungen und überschreitet das Limit von ${maxCsvRows}. Bitte Zeitraum, Konto oder Filter eingrenzen.`);
      }
      rows.push(...(data || []));
      offset += data?.length || 0;
      setFinanceStatus(`CSV-Export: ${rows.length} von ${total} Buchungen geladen …`);
      if (!data?.length || data.length < pageSizeForExport) break;
    }
    let auditEntries = [];
    if (includeAudit) {
      setFinanceStatus(`CSV-Export: Änderungsverlauf für ${rows.length} Buchungen wird geladen …`);
      auditEntries = await loadAuditEntriesForExport(rows);
    }
    const blob = new Blob(["\uFEFF", buildCsvText(rows, selectedColumns, auditEntries, includeAudit)], { type: "text/csv;charset=utf-8" });
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
  const { error } = await authService.requestPasswordReset(email, redirectTo);
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
  const { error } = await authService.updatePassword(password);
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
document.querySelectorAll("[data-finance-view]").forEach(button => {
  button.addEventListener("click", () => {
    const view = button.dataset.financeView;
    setFinanceView(view, view === "contributions");
  });
});
document.querySelector("#import-transactions").addEventListener("click", csvImportController.open);
document.querySelector("#download-csv-example").addEventListener("click", csvImportController.downloadExample);
document.querySelector("#manage-recurring").addEventListener("click", openRecurringDialog);
document.querySelector("#open-recurring-overview").addEventListener("click", openRecurringDialog);
document.querySelector("#open-month-close").addEventListener("click", async () => {
  if (!isAdministrator()) return;
  const currentMonth = todayDate().slice(0, 7);
  monthCloseMonth.min = "2026-10";
  monthCloseMonth.max = currentMonth;
  monthCloseMonth.value = currentMonth < monthCloseMonth.min ? monthCloseMonth.min : currentMonth;
  monthCloseStatus.textContent = "";
  monthCloseDialog.showModal();
  await refreshMonthClose();
});
document.querySelector("#refresh-month-close").addEventListener("click", refreshMonthClose);
monthCloseMonth.addEventListener("change", refreshMonthClose);
downloadMonthCloseReport.addEventListener("click", archiveMonthCloseReport);
recurringForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const nextDate = recurringNextDate.value;
  if (!nextDate) {
    recurringStatus.textContent = "Bitte eine gültige erste Fälligkeit wählen.";
    return;
  }
  if (nextDate < financeStartDate) {
    recurringStatus.textContent = `Die erste Fälligkeit darf nicht vor dem ${formatDate(financeStartDate)} liegen.`;
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
  const submit = recurringForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await recurringService.save(payload, recurringEditId, session.user.id);
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
contributionMemberSearch.addEventListener("input", applyContributionMemberFilters);
contributionMemberStatus.addEventListener("change", applyContributionMemberFilters);
document.querySelector("#bank-open-summary").addEventListener("click", () => showOpenTransactionsForAccount("BANK"));
document.querySelector("#paypal-open-summary").addEventListener("click", () => showOpenTransactionsForAccount("PAYPAL"));
document.querySelector("#reset-contribution-filters").addEventListener("click", () => {
  contributionMemberSearch.value = "";
  contributionMemberStatus.value = "all";
  renderTeamContributions();
  contributionMemberSearch.focus();
});
retryContributions.addEventListener("click", refreshContributions);
document.querySelector("#contribution-settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const bankBalance = Number(bankOpeningBalanceInput.value);
  const paypalBalance = Number(paypalOpeningBalanceInput.value);
  if (!Number.isFinite(bankBalance)
    || !Number.isFinite(paypalBalance)) {
    contributionAdminStatus.textContent = "Bitte gültige Startsalden eingeben.";
    return;
  }
  try {
    await contributionService.updateSettings({
      bankBalance,
      paypalBalance,
      userId: session.user.id,
    });
    contributionAdminStatus.textContent = "Startsalden gespeichert.";
    await refreshTransactions();
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = `Einstellungen konnten nicht gespeichert werden: ${error.message}`;
  }
});
document.querySelector("#contribution-rate-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const amount = Number(contributionAmount.value);
  const effectiveQuarter = contributionRateQuarter.value;
  if (!Number.isFinite(amount) || amount <= 0 || !effectiveQuarter) {
    contributionAdminStatus.textContent = "Bitte einen Beitrag größer als 0 und ein Wirksamkeitsquartal auswählen.";
    return;
  }
  try {
    await contributionService.setRate({ quarterStart: effectiveQuarter, amount });
    contributionAdminStatus.textContent = `Beitragssatz ab ${quarterLabel(effectiveQuarter)} gespeichert.`;
    await refreshContributions();
  } catch (error) {
    contributionAdminStatus.textContent = `Beitragssatz konnte nicht gespeichert werden: ${error.message}`;
  }
});
contributionRateQuarter.addEventListener("change", () => {
  contributionAmount.value = getQuarterlyContributionAmount(contributionRateQuarter.value).toFixed(2);
});
contributionPaymentSearch.addEventListener("input", () => {
  clearTimeout(contributionIncomeSearchTimer);
  contributionIncomeSearchTimer = setTimeout(() => loadContributionIncomeTransactions(true), 300);
});
contributionPaymentLoadMore.addEventListener("click", () => loadContributionIncomeTransactions());
document.querySelector("#contribution-member-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdministrator()) return;
  const form = event.currentTarget;
  const name = document.querySelector("#contribution-member-name").value.trim();
  if (!name) return;
  try {
    await contributionService.addMember(name);
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
  const quarterDateValue = new Date(`${firstQuarter}T00:00:00Z`);
  const quarterStarts = Array.from({ length: count }, (_, index) => {
    const date = new Date(quarterDateValue);
    date.setUTCMonth(date.getUTCMonth() + index * 3);
    return date.toISOString().slice(0, 10);
  });
  const expectedAmount = contributionAmountForQuarters(quarterStarts);
  if (Math.round(Number(transaction.amount) * 100) !== Math.round(expectedAmount * 100)) {
    contributionAdminStatus.textContent = `Der Buchungsbetrag (${money(transaction.amount)}) muss für ${quarterStarts.map(quarterLabel).join(", ")} genau ${money(expectedAmount)} betragen.`;
    return;
  }
  try {
    await contributionService.recordPayment({
      memberId,
      transactionId,
      quarterStarts,
    });
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
  try {
    await transactionService.addCategory(name);
  } catch (error) {
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
function applyDatePreset(preset) {
  const today = todayDate();
  if (preset === "month" || preset === "year") {
    const range = resolveDatePreset(preset, today);
    yearFilter.value = today.slice(0, 4);
    dateFromFilter.value = range.start;
    dateToFilter.value = range.end;
  } else if (preset === "30") {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    dateFromFilter.value = startDate < financeStartDate ? financeStartDate : startDate;
    dateToFilter.value = today;
  }
  updateOverviewPeriodControls();
  refreshDateRange();
}

function refreshDateRange() {
  const range = getEffectiveDateRange();
  const isBeforeStart = (dateFromFilter.value && dateFromFilter.value < financeStartDate)
    || (dateToFilter.value && dateToFilter.value < financeStartDate);
  const isInvalid = isBeforeStart || range.start > range.end;
  dateFromFilter.setAttribute("aria-invalid", String(Boolean(isInvalid)));
  dateToFilter.setAttribute("aria-invalid", String(Boolean(isInvalid)));
  currentPage = 0;
  if (isInvalid) {
    transactionRequests.invalidate();
    financeContent.setAttribute("aria-busy", "false");
    selectedTransactionIds.clear();
    updateBulkReconcileControls();
    transactions = [];
    transactionAnalytics = null;
    renderTransactions();
    updateActiveFilters();
    setFinanceStatus(isBeforeStart
      ? `Die Verwaltung beginnt am ${formatDate(financeStartDate)}. Frühere Buchungen werden nicht berücksichtigt.`
      : "Das Startdatum darf nicht nach dem Enddatum liegen.", "status-error");
    return;
  }
  updateActiveFilters();
  refreshTransactions();
}
dateFromFilter.addEventListener("change", refreshDateRange);
dateToFilter.addEventListener("change", refreshDateRange);
document.querySelectorAll("[data-overview-period]").forEach(button => button.addEventListener("click", () => {
  const preset = button.dataset.overviewPeriod;
  if (preset === "custom") {
    document.querySelector("#transactions-panel").open = true;
    setFinanceView("bookings");
    dateFromFilter.focus({ preventScroll: true });
    return;
  }
  applyDatePreset(preset);
}));
document.querySelectorAll("[data-date-preset]").forEach(button => button.addEventListener("click", () => {
  applyDatePreset(button.dataset.datePreset);
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
resetFilters.addEventListener("click", resetTransactionFilterValues);
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
retryRecentTransactions.addEventListener("click", refreshTransactions);
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
    const data = await transactionService.setDeleted(transaction.id, true);
    if (!data.length) {
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
    const data = await transactionService.setDeleted(transaction.id, false);
    if (!data.length) throw new Error("Die Buchung wurde nicht wiederhergestellt. Prüfe die Supabase-Berechtigungen.");
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
    const nextSession = await authService.signIn(
      document.querySelector("#email").value,
      document.querySelector("#password").value,
    );
    document.querySelector("#login-form").reset();
    loginDialog.close();
    setAuthenticated(nextSession);
  } catch (error) {
    status.textContent = `Anmeldung fehlgeschlagen: ${error.message}`;
  } finally {
    submit.disabled = false;
    submit.textContent = "Anmelden";
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await authService.signOut();
  } catch (error) {
    authState.textContent = `Abmeldung fehlgeschlagen: ${error.message}`;
  }
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
    const data = await transactionService.save(payload, wasEditing ? editingTransaction.id : null);
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
  authService.onAuthStateChange((event, nextSession) => {
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
  authService.getSession().then(nextSession => {
    setAuthenticated(nextSession);
  }).catch(error => {
    setAuthenticated(null);
    authState.textContent = `Authentifizierung fehlgeschlagen: ${error.message}`;
  });
} else {
  setAuthenticated(null);
}
