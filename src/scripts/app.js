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
const retryTransactions = document.querySelector("#retry-transactions");
let session = null;
let transactions = [];
let loadingTransactions = false;

const money = value => `${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
const setText = (selector, value) => { document.querySelector(selector).textContent = value; };

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
  const { data, error } = await supabaseClient.from("transactions").select("id, type, account, description, amount, transaction_date, category").order("transaction_date", { ascending: false });
  if (error) throw error;
  transactions = data || [];
  const years = [...new Set([String(new Date().getFullYear()), ...transactions.map(item => item.transaction_date.slice(0, 4))])].sort().reverse();
  yearFilter.replaceChildren(...years.map(year => new Option(year, year)));
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
  const year = yearFilter.value;
  const account = accountFilter.value;
  const yearTransactions = transactions.filter(item => item.transaction_date.startsWith(year));
  const filtered = yearTransactions.filter(item => account === "ALL" || item.account === account);
  const income = yearTransactions.filter(item => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = yearTransactions.filter(item => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0);
  const balanceFor = accountName => yearTransactions.filter(item => item.account === accountName).reduce((sum, item) => sum + (item.type === "INCOME" ? Number(item.amount) : -Number(item.amount)), 0);
  setText("#total-income", money(income));
  setText("#total-expenses", money(expenses));
  setText("#total-balance", money(income - expenses));
  setText("#bank-balance", money(balanceFor("BANK")));
  setText("#paypal-balance", money(balanceFor("PAYPAL")));
  transactionList.replaceChildren(...filtered.map(item => {
    const row = document.createElement("tr");
    row.innerHTML = "<td></td><td></td><td></td><td></td><td class=\"number\"></td><td></td>";
    row.children[0].dataset.label = "Datum";
    row.children[1].dataset.label = "Konto";
    row.children[2].dataset.label = "Beschreibung";
    row.children[3].dataset.label = "Typ";
    row.children[4].dataset.label = "Betrag";
    row.children[5].dataset.label = "Kategorie";
    row.children[0].textContent = formatDate(item.transaction_date);
    row.children[1].textContent = item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto";
    row.children[2].textContent = item.description;
    row.children[3].textContent = item.type === "INCOME" ? "Einnahme" : "Ausgabe";
    row.children[4].textContent = `${item.type === "INCOME" ? "+" : "-"} ${money(item.amount)}`;
    row.children[4].className = `number ${item.type === "INCOME" ? "positive" : "negative"}`;
    row.children[5].textContent = item.category;
    return row;
  }));
  if (!filtered.length) transactionList.innerHTML = '<tr><td colspan="6" class="muted">Keine Buchungen für dieses Jahr.</td></tr>';
}

document.querySelector("#copyright-year").textContent = new Date().getFullYear();
document.querySelector("#login-toggle").addEventListener("click", () => loginDialog.showModal());
document.querySelector("#new-transaction").addEventListener("click", () => { document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10); transactionDialog.showModal(); });
yearFilter.addEventListener("change", renderTransactions);
accountFilter.addEventListener("change", renderTransactions);
retryTransactions.addEventListener("click", refreshTransactions);
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));

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
  try {
    const { error } = await supabaseClient.from("transactions").insert(payload);
    if (error) throw error;
    document.querySelector("#transaction-form").reset();
    transactionDialog.close();
    await refreshTransactions();
    setFinanceStatus("Buchung erfolgreich gespeichert.", "status-success");
  } catch (error) {
    status.textContent = `Speichern fehlgeschlagen: ${error.message}`;
  } finally {
    submit.disabled = false;
    submit.textContent = "Speichern";
  }
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => setAuthenticated(nextSession));
  supabaseClient.auth.getSession().then(({ data, error }) => { if (error) authState.textContent = `Authentifizierung fehlgeschlagen: ${error.message}`; else setAuthenticated(data.session); });
} else {
  setAuthenticated(null);
}
