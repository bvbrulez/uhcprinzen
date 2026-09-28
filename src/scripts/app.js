const config = window.SUPABASE_CONFIG;
const supabaseClient = config?.url && config?.anonKey ? supabase.createClient(config.url, config.anonKey) : null;
const loginDialog = document.querySelector("#login-dialog");
const transactionDialog = document.querySelector("#transaction-dialog");
const passwordResetDialog = document.querySelector("#password-reset-dialog");
const categoryDialog = document.querySelector("#category-dialog");
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
const resetFilters = document.querySelector("#reset-filters");
const activeFilters = document.querySelector("#active-filters");
const databaseSetupStatus = document.querySelector("#database-setup-status");
const reportSetupStatus = document.querySelector("#report-setup-status");
const writeSetupStatus = document.querySelector("#write-setup-status");
const monthlySummary = document.querySelector("#monthly-summary");
const categorySummary = document.querySelector("#category-summary");
let session = null;
let transactions = [];
let transactionAnalytics = null;
let currentPage = 0;
const pageSize = 50;
let totalPages = 0;
let loadingTransactions = false;
let editingTransaction = null;
let searchTimer = null;

const money = value => `${(Number(value) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
const setText = (selector, value) => { document.querySelector(selector).textContent = value; };
const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

async function loadTransactionYears() {
  const { data, error } = await supabaseClient.rpc("get_transaction_years");
  if (!error) return (data || []).map(item => String(item.year));
  if (error.code !== "PGRST202") throw error;
  const { data: fallbackData, error: fallbackError } = await supabaseClient
    .from("transactions")
    .select("transaction_date")
    .is("deleted_at", null);
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
    .select("id, type, account, description, amount, transaction_date, category, updated_at", { count: "exact" })
    .gte("transaction_date", `${year}-01-01`)
    .lt("transaction_date", `${Number(year) + 1}-01-01`)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
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
    row.children[6].textContent = item.updated_at ? formatDate(item.updated_at.slice(0, 10)) : "–";
    row.children[7].hidden = !isAdministrator();
    if (!isAdministrator()) return row;
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
    const incomeBar = document.createElement("i");
    incomeBar.className = "income-bar";
    incomeBar.style.width = `${Number(item.income) / maxAmount * 100}%`;
    incomeBar.title = `Einnahmen: ${money(item.income)}`;
    const expenseBar = document.createElement("i");
    expenseBar.className = "expense-bar";
    expenseBar.style.width = `${Number(item.expenses) / maxAmount * 100}%`;
    expenseBar.title = `Ausgaben: ${money(item.expenses)}`;
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

  const categoryEntries = analytics?.categories || [];
  const maxCategory = Math.max(1, ...categoryEntries.map(([, amount]) => amount));
  categorySummary.replaceChildren(...(categoryEntries.length ? categoryEntries : [["Keine Ausgaben", 0]]).map(([category, amount]) => {
    const row = document.createElement("div");
    row.className = "category-row";
    const label = document.createElement("span");
    label.textContent = category;
    const bar = document.createElement("div");
    bar.className = "category-bar";
    const fill = document.createElement("i");
    fill.style.width = `${Number(amount) / maxCategory * 100}%`;
    bar.append(fill);
    const total = document.createElement("strong");
    total.textContent = money(amount);
    row.append(label, bar, total);
    return row;
  }));
}

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character]));

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
  supabaseClient.auth.getSession().then(({ data, error }) => { if (error) authState.textContent = `Authentifizierung fehlgeschlagen: ${error.message}`; else setAuthenticated(data.session); });
} else {
  setAuthenticated(null);
}
