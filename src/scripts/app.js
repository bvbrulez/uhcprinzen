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
const retryTransactions = document.querySelector("#retry-transactions");
const transactionForm = document.querySelector("#transaction-form");
const transactionSubmit = document.querySelector("#transaction-submit");
const cancelTransaction = document.querySelector("#cancel-transaction");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");
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
}

async function refreshTransactions() {
  if (loadingTransactions) return;
  loadingTransactions = true;
  retryTransactions.hidden = true;
  setFinanceStatus("Finanzdaten werden geladen …");
  try {
    await loadTransactions();
    setFinanceStatus(transactions.length ? "" : "Noch keine Buchungen vorhanden.");
  } catch (error) {
    const message = error.code === "42P01"
      ? "Die Finanzdatenbank ist noch nicht eingerichtet. Bitte supabase/schema.sql im Supabase SQL Editor ausführen."
      : `Finanzdaten konnten nicht geladen werden: ${error.message}`;
    setFinanceStatus(message, "status-error");
    retryTransactions.hidden = false;
  } finally {
    loadingTransactions = false;
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
    row.append(label, bars, balance);
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
