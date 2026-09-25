const config = window.SUPABASE_CONFIG;
const supabaseClient = config?.url && config?.anonKey ? supabase.createClient(config.url, config.anonKey) : null;
const loginDialog = document.querySelector("#login-dialog");
const transactionDialog = document.querySelector("#transaction-dialog");
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
const cancelTransaction = document.querySelector("#cancel-transaction");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");
const exportTransactions = document.querySelector("#export-transactions");
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

const money = value => `${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
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
  document.querySelector("#login-toggle").hidden = authenticated;
  document.querySelector("#logout-button").hidden = !authenticated;
  financeContent.hidden = !authenticated;
  financeHint.hidden = authenticated;
  authState.textContent = authenticated ? `Angemeldet als ${session.user.email}` : "Nur für angemeldete Mitglieder";
  if (authenticated) refreshTransactions();
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
  });
  const yearsPromise = loadTransactionYears();
  const [{ data, count, error }, { data: analyticsData, error: analyticsError }, years] = await Promise.all([query, analyticsPromise, yearsPromise]);
  if (error) throw error;
  if (analyticsError) throw analyticsError;
  transactions = data || [];
  transactionAnalytics = analyticsData;
  totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  previousPage.disabled = currentPage === 0;
  nextPage.disabled = currentPage >= totalPages - 1;
  pageStatus.textContent = `Seite ${currentPage + 1} von ${totalPages}`;
  const availableYears = [...new Set([String(new Date().getFullYear()), ...years])].sort().reverse();
  const selectedYear = availableYears.includes(yearFilter.value) ? yearFilter.value : availableYears[0];
  yearFilter.replaceChildren(...availableYears.map(value => new Option(value, value, value === selectedYear, value === selectedYear)));
  renderTransactions();
}

function setFinanceStatus(message, type = "") {
  const status = document.querySelector("#finance-status");
  status.textContent = message;
  status.className = `status ${type}`.trim();
  status.setAttribute("aria-busy", message.includes("geladen"));
}

function getFinanceErrorMessage(error) {
  if (error.code === "42P01") {
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
    setFinanceStatus(getFinanceErrorMessage(error), "status-error");
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
    row.children[6].dataset.label = "Aktion";
    row.children[7].dataset.label = "Aktion";
    row.children[0].textContent = formatDate(item.transaction_date);
    row.children[1].textContent = item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto";
    row.children[2].textContent = item.description;
    row.children[3].textContent = item.type === "INCOME" ? "Einnahme" : "Ausgabe";
    row.children[4].textContent = `${item.type === "INCOME" ? "+" : "-"} ${money(item.amount)}`;
    row.children[4].className = `number ${item.type === "INCOME" ? "positive" : "negative"}`;
    row.children[5].textContent = item.category;
    row.children[6].textContent = item.updated_at ? formatDate(item.updated_at.slice(0, 10)) : "–";
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
  try {
    const year = yearFilter.value || String(new Date().getFullYear());
    let query = supabaseClient.from("transactions")
      .select("type, account, description, amount, transaction_date, category")
      .gte("transaction_date", `${year}-01-01`)
      .lt("transaction_date", `${Number(year) + 1}-01-01`)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false });
    if (accountFilter.value !== "ALL") query = query.eq("account", accountFilter.value);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const income = rows.filter(item => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = rows.filter(item => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0);
    const balanceFor = account => rows.filter(item => item.account === account).reduce((sum, item) => sum + (item.type === "INCOME" ? Number(item.amount) : -Number(item.amount)), 0);
    const filterLabel = accountFilter.value === "ALL" ? "Alle Konten" : accountFilter.value === "BANK" ? "Bankkonto" : "PayPal-Konto";
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
        header { align-items: center; border-bottom: 2px solid #102d49; display: flex; justify-content: space-between; margin-bottom: 18px; padding-bottom: 10px; }
        h1 { color: #102d49; font-size: 22px; margin: 0 0 4px; } h2 { color: #102d49; font-size: 15px; margin: 20px 0 8px; }
        .meta { color: #5e7480; } .summary { display: flex; gap: 28px; margin: 10px 0 18px; } .summary strong { display: block; font-size: 15px; margin-top: 3px; }
        table { border-collapse: collapse; width: 100%; } th, td { border-bottom: 1px solid #d7e2e6; padding: 7px 5px; text-align: left; } th { background: #eef3f5; color: #5e7480; font-size: 10px; text-transform: uppercase; } .amount { text-align: right; } .income { color: #137455; } .expense { color: #b1423e; }
        .empty { color: #5e7480; padding: 20px 0; } footer { color: #5e7480; margin-top: 18px; }
        .print-button { background: #176b87; border: 0; color: white; cursor: pointer; padding: 8px 12px; } @media print { .print-button { display: none; } }
      </style></head><body>
      <header><div><h1>UHC Prinzen – Buchungen</h1><div class="meta">Jahr ${escapeHtml(year)} · ${escapeHtml(filterLabel)}</div></div><button class="print-button" onclick="window.print()">Als PDF speichern / drucken</button></header>
      <div class="summary"><div>Einnahmen<strong class="income">${escapeHtml(money(income))}</strong></div><div>Ausgaben<strong class="expense">${escapeHtml(money(expenses))}</strong></div><div>Saldo<strong>${escapeHtml(money(income - expenses))}</strong></div><div>Bankkonto<strong>${escapeHtml(money(balanceFor("BANK")))}</strong></div><div>PayPal-Konto<strong>${escapeHtml(money(balanceFor("PAYPAL")))}</strong></div></div>
      <h2>Alle Buchungen (${rows.length})</h2>
      ${rows.length ? `<table><thead><tr><th>Datum</th><th>Konto</th><th>Beschreibung</th><th>Typ</th><th class="amount">Betrag</th><th>Kategorie</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><th colspan="4">Saldo</th><th class="amount">${escapeHtml(money(income - expenses))}</th><th></th></tr></tfoot></table>` : '<p class="empty">Keine Buchungen für den gewählten Zeitraum.</p>'}
      <footer>Erstellt am ${escapeHtml(new Date().toLocaleString("de-DE"))}</footer>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
  } catch (error) {
    printWindow.close();
    setFinanceStatus(`PDF-Export fehlgeschlagen: ${error.message}`, "status-error");
  } finally {
    exportTransactions.disabled = false;
    exportTransactions.textContent = "PDF exportieren";
  }
}

document.querySelector("#copyright-year").textContent = new Date().getFullYear();
document.querySelector("#login-toggle").addEventListener("click", () => loginDialog.showModal());
document.querySelector("#new-transaction").addEventListener("click", () => {
  editingTransaction = null;
  transactionForm.reset();
  document.querySelector("#transaction-dialog-title").textContent = "Neue Buchung";
  transactionSubmit.textContent = "Speichern";
  document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10);
  transactionDialog.showModal();
});
yearFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
accountFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
summaryFilter.addEventListener("change", refreshTransactions);
typeFilter.addEventListener("change", () => { currentPage = 0; refreshTransactions(); });
transactionSearch.addEventListener("input", () => { currentPage = 0; refreshTransactions(); });
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
    transactionSubmit.textContent = "Speichern";
  }
  dialog.close();
}));

function openTransactionEditor(transaction) {
  editingTransaction = transaction;
  document.querySelector("#transaction-dialog-title").textContent = "Buchung ändern";
  transactionSubmit.textContent = "Änderungen speichern";
  document.querySelector("#transaction-type").value = transaction.type;
  document.querySelector("#transaction-account").value = transaction.account;
  document.querySelector("#transaction-description").value = transaction.description;
  document.querySelector("#transaction-amount").value = transaction.amount;
  document.querySelector("#transaction-date").value = transaction.transaction_date;
  document.querySelector("#transaction-category").value = transaction.category;
  document.querySelector("#transaction-status").textContent = "";
  transactionDialog.showModal();
}

cancelTransaction.addEventListener("click", () => {
  editingTransaction = null;
  transactionForm.reset();
  transactionDialog.close();
});

async function deleteTransaction(transaction) {
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
    await refreshTransactions();
    setFinanceStatus("Buchung erfolgreich gelöscht.", "status-success");
  } catch (error) {
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
    document.querySelector("#transaction-form").reset();
    transactionDialog.close();
    editingTransaction = null;
    await refreshTransactions();
    setFinanceStatus(wasEditing ? "Buchung erfolgreich geändert." : "Buchung erfolgreich gespeichert.", "status-success");
  } catch (error) {
    status.textContent = `Speichern fehlgeschlagen: ${error.message}`;
  } finally {
    submit.disabled = false;
    submit.textContent = wasEditing ? "Änderungen speichern" : "Speichern";
  }
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => setAuthenticated(nextSession));
  supabaseClient.auth.getSession().then(({ data, error }) => { if (error) authState.textContent = `Authentifizierung fehlgeschlagen: ${error.message}`; else setAuthenticated(data.session); });
} else {
  setAuthenticated(null);
}
