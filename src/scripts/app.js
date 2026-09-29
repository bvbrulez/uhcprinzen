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

const money = value => `${(Number(value) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
const todayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const setText = (selector, value) => { document.querySelector(selector).textContent = value; };
const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

async function loadTransactionYears() {
  const { data, error } = await supabaseClient.rpc("get_transaction_years");
  if (!error) return (data || []).map(item => String(item.year));
  if (error.code !== "PGRST202") throw error;
  const { data: fallbackData, error: fallbackError } = await supabaseClient
    .from("transactions")
    .select("transaction_date");
  if (fallbackError) throw fallbackError;
  return [...new Set(fallbackData.map(item => item.transaction_date.slice(0, 4)))];
}

function setAuthenticated(nextSession) {
  session = nextSession;
  const authenticated = Boolean(session);
  const administrator = isAdministrator();
  document.querySelector("#login-toggle").hidden = authenticated;
  document.querySelector("#logout-button").hidden = !authenticated;
  document.querySelector("#new-transaction").hidden = !administrator;
  document.querySelector("#manage-categories").hidden = !administrator;
  document.querySelector("#import-transactions").hidden = !administrator;
  document.querySelector("#manage-recurring").hidden = !administrator;
  document.querySelector("#show-deleted-label").hidden = !administrator;
  if (!administrator) showDeleted.checked = false;
  document.querySelector("#transactions-actions-header").hidden = !administrator;
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
  if (authenticated) refreshTransactions();
}

function isAdministrator() {
  return session?.user?.app_metadata?.role === "admin"
    || session?.user?.email?.toLowerCase() === "bvbrulez@gmail.com";
}

function updateActiveFilters() {
  const labels = [yearFilter.value || "aktuelles Jahr"];
  if (accountFilter.value !== "ALL") labels.push(accountFilter.value === "BANK" ? "Bankkonto" : "PayPal-Konto");
  if (typeFilter.value !== "ALL") labels.push(typeFilter.value === "INCOME" ? "Nur Einnahmen" : "Nur Ausgaben");
  if (summaryFilter.checked && accountFilter.value !== "ALL") labels.push("Summen gefiltert");
  if (transactionSearch.value.trim()) labels.push(`Suche: „${transactionSearch.value.trim()}“`);
  activeFilters.textContent = `Aktive Filter: ${labels.join(" · ")}`;
}

async function loadTransactions() {
  if (!supabaseClient) throw new Error("Supabase ist noch nicht konfiguriert.");
  const year = yearFilter.value || String(new Date().getFullYear());
  let query = supabaseClient.from("transactions")
    .select("id, type, account, description, amount, transaction_date, category, created_at, created_by_email, updated_at, updated_by_email, deleted_at, deleted_by_email", { count: "exact" })
    .gte("transaction_date", `${year}-01-01`)
    .lt("transaction_date", `${Number(year) + 1}-01-01`)
    .order("transaction_date", { ascending: false })
    .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
  query = showDeleted.checked && isAdministrator()
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);
  if (accountFilter.value !== "ALL") query = query.eq("account", accountFilter.value);
  if (typeFilter.value !== "ALL") query = query.eq("type", typeFilter.value);
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
  updateActiveFilters();
  totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  previousPage.disabled = currentPage === 0;
  nextPage.disabled = currentPage >= totalPages - 1;
  pageStatus.textContent = `Seite ${currentPage + 1} von ${totalPages}`;
  const availableYears = [...new Set([String(new Date().getFullYear()), ...years])].sort().reverse();
  const selectedYear = availableYears.includes(yearFilter.value) ? yearFilter.value : availableYears[0];
  yearFilter.replaceChildren(...availableYears.map(value => new Option(value, value, value === selectedYear, value === selectedYear)));
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
  setText("#total-income", money(totals.income));
  setText("#total-expenses", money(totals.expenses));
  setText("#total-balance", money(Number(totals.income) - Number(totals.expenses)));
  setText("#bank-balance", money(transactionAnalytics?.accounts?.BANK));
  setText("#paypal-balance", money(transactionAnalytics?.accounts?.PAYPAL));
  renderAnalytics(transactionAnalytics);
  transactionList.replaceChildren(...filtered.map(item => {
    const row = document.createElement("tr");
    row.innerHTML = "<td></td><td></td><td></td><td></td><td class=\"number\"></td><td></td><td></td><td></td>";
    row.children[0].dataset.label = "Datum";
    row.children[1].dataset.label = "Konto";
    row.children[2].dataset.label = "Beschreibung";
    row.children[3].dataset.label = "Typ";
    row.children[4].dataset.label = "Betrag";
    row.children[5].dataset.label = "Kategorie";
    row.children[6].dataset.label = "Geändert";
    row.children[7].dataset.label = "Aktion";
    row.children[0].textContent = formatDate(item.transaction_date);
    row.children[1].textContent = item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto";
    row.children[2].textContent = item.description;
    row.children[3].textContent = item.type === "INCOME" ? "Einnahme" : "Ausgabe";
    row.children[4].textContent = `${item.type === "INCOME" ? "+" : "-"} ${money(item.amount)}`;
    row.children[4].className = `number ${item.type === "INCOME" ? "positive" : "negative"}`;
    row.children[5].textContent = item.category;
    row.children[6].textContent = item.updated_by_email
      ? `${formatDate(item.updated_at.slice(0, 10))} · ${item.updated_by_email}`
      : `Erstellt ${formatDate(item.created_at.slice(0, 10))}${item.created_by_email ? ` · ${item.created_by_email}` : ""}`;
    row.children[7].hidden = !isAdministrator();
    if (!isAdministrator()) return row;
    if (item.deleted_at) {
      row.classList.add("deleted-transaction");
      row.children[3].textContent += " · gelöscht";
      row.children[6].textContent = `Gelöscht ${formatDate(item.deleted_at.slice(0, 10))}${item.deleted_by_email ? ` · ${item.deleted_by_email}` : ""}`;
      const restoreButton = document.createElement("button");
      restoreButton.className = "button button-secondary button-edit";
      restoreButton.type = "button";
      restoreButton.textContent = "Wiederherstellen";
      restoreButton.addEventListener("click", () => restoreTransaction(item));
      row.children[7].append(restoreButton);
    } else {
      const editButton = document.createElement("button");
      editButton.className = "button button-secondary button-edit";
      editButton.type = "button";
      editButton.textContent = "Ändern";
      editButton.addEventListener("click", () => openTransactionEditor(item));
      row.children[7].append(editButton);
      const deleteButton = document.createElement("button");
      deleteButton.className = "button button-danger button-edit";
      deleteButton.type = "button";
      deleteButton.textContent = "Löschen";
      deleteButton.addEventListener("click", () => deleteTransaction(item));
      row.children[7].append(deleteButton);
      const duplicateButton = document.createElement("button");
      duplicateButton.className = "button button-secondary button-edit";
      duplicateButton.type = "button";
      duplicateButton.textContent = "Duplizieren";
      duplicateButton.addEventListener("click", () => openTransactionEditor(item, true));
      row.children[7].append(duplicateButton);
    }
    const auditButton = document.createElement("button");
    auditButton.className = "button button-secondary button-edit";
    auditButton.type = "button";
    auditButton.textContent = "Verlauf";
    auditButton.addEventListener("click", () => openTransactionAudit(item));
    row.children[7].append(auditButton);
    return row;
  }));
  if (!filtered.length) transactionList.innerHTML = '<tr><td colspan="8" class="muted">Keine Buchungen für dieses Jahr.</td></tr>';
}

function renderAnalytics(analytics) {
  const months = monthNames.map((name, index) => {
    const month = analytics?.months?.find(item => Number(item.month) === index);
    return { name, income: month?.income || 0, expenses: month?.expenses || 0 };
  });
  const maxAmount = Math.max(1, ...months.flatMap(item => [item.income, item.expenses]));
  monthlySummary.replaceChildren(...months.map(item => {
    const row = document.createElement("div");
    row.className = "month-row";
    const label = document.createElement("span");
    label.textContent = item.name;
    const bars = document.createElement("div");
    bars.className = "month-bars";
    bars.setAttribute("aria-hidden", "true");
    const incomeBar = document.createElement("i");
    incomeBar.className = "income-bar";
    incomeBar.style.width = `${Number(item.income) / maxAmount * 100}%`;
    const expenseBar = document.createElement("i");
    expenseBar.className = "expense-bar";
    expenseBar.style.width = `${Number(item.expenses) / maxAmount * 100}%`;
    bars.append(incomeBar, expenseBar);
    const balance = document.createElement("small");
    balance.textContent = money(Number(item.income) - Number(item.expenses));
    balance.title = "Monatssaldo";
    const values = document.createElement("div");
    values.className = "month-values";
    values.innerHTML = `<span class="income-value">Einnahmen ${escapeHtml(money(item.income))}</span><span class="expense-value">Ausgaben ${escapeHtml(money(item.expenses))}</span>`;
    row.append(label, bars, values, balance);
    return row;
  }));
  monthlyData.replaceChildren(...months.map(item => {
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
  categorySummary.replaceChildren(...(categoryEntries.length ? categoryEntries : [["Keine Ausgaben", 0]]).map(([category, amount]) => {
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
    row.append(label, bar, total);
    return row;
  }));
  categoryData.replaceChildren(...(categoryEntries.length ? categoryEntries : [["Keine Ausgaben", 0]]).map(([category, amount]) => {
    const row = document.createElement("tr");
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
    await Promise.all([loadRecurringTransactions(), refreshTransactions()]);
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
    const exportFilters = {
      account: accountFilter.value,
      type: typeFilter.value,
      search: transactionSearch.value.trim().replace(/[%_(),]/g, " "),
    };
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
    const balanceFor = account => rows.filter(item => item.account === account).reduce((sum, item) => sum + (item.type === "INCOME" ? Number(item.amount) : -Number(item.amount)), 0);
    const filterLabel = exportFilters.account === "ALL" ? "Alle Konten" : exportFilters.account === "BANK" ? "Bankkonto" : "PayPal-Konto";
    const filterSummary = [year, filterLabel, exportFilters.type === "ALL" ? "Alle Buchungsarten" : exportFilters.type === "INCOME" ? "Nur Einnahmen" : "Nur Ausgaben"];
    if (exportFilters.search) filterSummary.push(`Suche: ${exportFilters.search}`);
    const logoUrl = new URL("assets/uhc-logo.png", window.location.href).href;
    const tableRows = rows.map(item => `<tr>
      <td>${escapeHtml(formatDate(item.transaction_date))}</td>
      <td>${escapeHtml(item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto")}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.type === "INCOME" ? "Einnahme" : "Ausgabe")}</td>
      <td class="amount ${item.type === "INCOME" ? "income" : "expense"}">${item.type === "INCOME" ? "+" : "-"} ${escapeHtml(money(item.amount))}</td>
      <td>${escapeHtml(item.category)}</td>
    </tr>`).join("");
    printWindow.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>UHC Prinzen – Buchungen ${escapeHtml(year)}</title>
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
      <div class="summary"><div>Einnahmen<strong class="income">${escapeHtml(money(income))}</strong></div><div>Ausgaben<strong class="expense">${escapeHtml(money(expenses))}</strong></div><div>Saldo<strong>${escapeHtml(money(income - expenses))}</strong></div><div>Bankkonto<strong>${escapeHtml(money(balanceFor("BANK")))}</strong></div><div>PayPal-Konto<strong>${escapeHtml(money(balanceFor("PAYPAL")))}</strong></div></div>
      <h2>Alle Buchungen (${rows.length})</h2>
      ${rows.length ? `<table><thead><tr><th>Datum</th><th>Konto</th><th>Beschreibung</th><th>Typ</th><th class="amount">Betrag</th><th>Kategorie</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><th colspan="4">Saldo</th><th class="amount">${escapeHtml(money(income - expenses))}</th><th></th></tr></tfoot></table>` : '<p class="empty">Keine Buchungen für den gewählten Zeitraum.</p>'}
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

async function exportTransactionsAsCsv() {
  exportCsvTransactions.disabled = true;
  setFinanceStatus("CSV-Export: Buchungen werden geladen …");
  try {
    const year = yearFilter.value || String(new Date().getFullYear());
    const filters = {
      account: accountFilter.value,
      type: typeFilter.value,
      search: transactionSearch.value.trim().replace(/[%_(),]/g, " "),
    };
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
    const lines = [
      ["Datum", "Konto", "Beschreibung", "Art", "Betrag", "Kategorie"].map(quote).join(";"),
      ...rows.map(item => [
        item.transaction_date,
        item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto",
        safeText(item.description),
        item.type === "INCOME" ? "Einnahme" : "Ausgabe",
        Number(item.amount).toFixed(2).replace(".", ","),
        safeText(item.category),
      ].map(quote).join(";")),
    ];
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uhc-prinzen-buchungen-${year}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFinanceStatus(`CSV-Export mit ${rows.length} Buchungen heruntergeladen.`, "status-success");
  } catch (error) {
    setFinanceStatus(`CSV-Export fehlgeschlagen: ${error.message}`, "status-error");
  } finally {
    exportCsvTransactions.disabled = false;
  }
}

function createExportQuery(year, limit, offset, filters) {
  let query = supabaseClient.from("transactions")
    .select("id, type, account, description, amount, transaction_date, category", offset === 0 ? { count: "exact" } : {})
    .gte("transaction_date", `${year}-01-01`)
    .lt("transaction_date", `${Number(year) + 1}-01-01`)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filters.account !== "ALL") query = query.eq("account", filters.account);
  if (filters.type !== "ALL") query = query.eq("type", filters.type);
  if (filters.search) query = query.or(`description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
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
yearFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
accountFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
summaryFilter.addEventListener("change", refreshTransactions);
typeFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
transactionSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentPage = 0; refreshTransactions(); }, 350);
  updateActiveFilters();
});
resetFilters.addEventListener("click", () => {
  accountFilter.value = "ALL";
  summaryFilter.checked = false;
  typeFilter.value = "ALL";
  transactionSearch.value = "";
  currentPage = 0;
  refreshTransactions();
});
exportTransactions.addEventListener("click", exportTransactionsAsPdf);
exportCsvTransactions.addEventListener("click", exportTransactionsAsCsv);
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
