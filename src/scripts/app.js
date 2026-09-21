const config = window.SUPABASE_CONFIG;
const supabaseClient = config?.url && config?.anonKey ? supabase.createClient(config.url, config.anonKey) : null;
const loginDialog = document.querySelector("#login-dialog");
const transactionDialog = document.querySelector("#transaction-dialog");
const authState = document.querySelector("#auth-state");
const financeContent = document.querySelector("#finance-content");
const financeHint = document.querySelector("#finance-login-hint");
const transactionList = document.querySelector("#transaction-list");
const yearFilter = document.querySelector("#year-filter");
let session = null;
let transactions = [];

const money = value => `${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
const setText = (selector, value) => { document.querySelector(selector).textContent = value; };

function renderTeam(members) {
  const target = document.querySelector("#team-list");
  target.replaceChildren(...members.map(member => {
    const article = document.createElement("article");
    article.className = "team-member";
    article.innerHTML = "<strong></strong><span></span>";
    article.querySelector("strong").textContent = member.name;
    article.querySelector("span").textContent = member.role || "Prinzen";
    return article;
  }));
}

async function loadPublicContent() {
  if (!supabaseClient) {
    renderTeam([{ name: "Die Prinzen", role: "Ü35-Freizeithockey" }]);
    document.querySelector("#schedule-list").innerHTML = '<p class="muted">Spieltermine werden in Supabase gepflegt.</p>';
    return;
  }
  const [{ data: members, error: memberError }, { data: matches, error: matchError }] = await Promise.all([
    supabaseClient.from("members").select("name, role").eq("active", true).order("name"),
    supabaseClient.from("matches").select("match_date, opponent, location").gte("match_date", new Date().toISOString().slice(0, 10)).order("match_date").limit(8),
  ]);
  if (memberError) throw memberError;
  if (matchError && matchError.code !== "42P01") throw matchError;
  renderTeam(members?.length ? members : [{ name: "Die Prinzen", role: "Ü35-Freizeithockey" }]);
  const target = document.querySelector("#schedule-list");
  target.replaceChildren(...(matches || []).map(match => {
    const item = document.createElement("div");
    item.className = "schedule-item";
    item.innerHTML = "<time></time><strong></strong><span></span>";
    item.querySelector("time").textContent = formatDate(match.match_date);
    item.querySelector("strong").textContent = `Prinzen – ${match.opponent}`;
    item.querySelector("span").textContent = match.location || "UHC";
    return item;
  }));
  if (!matches?.length) target.innerHTML = '<p class="muted">Keine kommenden Spiele eingetragen.</p>';
}

function setAuthenticated(nextSession) {
  session = nextSession;
  const authenticated = Boolean(session);
  document.querySelector("#login-toggle").hidden = authenticated;
  document.querySelector("#logout-button").hidden = !authenticated;
  financeContent.hidden = !authenticated;
  financeHint.hidden = authenticated;
  authState.textContent = authenticated ? `Angemeldet als ${session.user.email}` : "Nur für angemeldete Mitglieder";
  if (authenticated) loadTransactions().catch(error => { document.querySelector("#finance-status").textContent = `Finanzdaten konnten nicht geladen werden: ${error.message}`; });
}

async function loadTransactions() {
  if (!supabaseClient) throw new Error("Supabase ist noch nicht konfiguriert.");
  const { data, error } = await supabaseClient.from("transactions").select("id, type, description, amount, transaction_date, category").order("transaction_date", { ascending: false });
  if (error) throw error;
  transactions = data || [];
  const years = [...new Set([String(new Date().getFullYear()), ...transactions.map(item => item.transaction_date.slice(0, 4))])].sort().reverse();
  yearFilter.replaceChildren(...years.map(year => new Option(year, year)));
  renderTransactions();
}

function renderTransactions() {
  const year = yearFilter.value;
  const filtered = transactions.filter(item => item.transaction_date.startsWith(year));
  const income = filtered.filter(item => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = filtered.filter(item => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0);
  setText("#total-income", money(income));
  setText("#total-expenses", money(expenses));
  setText("#total-balance", money(income - expenses));
  transactionList.replaceChildren(...filtered.map(item => {
    const row = document.createElement("tr");
    row.innerHTML = "<td></td><td></td><td></td><td class=\"number\"></td><td></td>";
    row.children[0].textContent = formatDate(item.transaction_date);
    row.children[1].textContent = item.description;
    row.children[2].textContent = item.type === "INCOME" ? "Einnahme" : "Ausgabe";
    row.children[3].textContent = `${item.type === "INCOME" ? "+" : "-"} ${money(item.amount)}`;
    row.children[3].className = `number ${item.type === "INCOME" ? "positive" : "negative"}`;
    row.children[4].textContent = item.category;
    return row;
  }));
  if (!filtered.length) transactionList.innerHTML = '<tr><td colspan="5" class="muted">Keine Buchungen für dieses Jahr.</td></tr>';
}

document.querySelector("#copyright-year").textContent = new Date().getFullYear();
document.querySelector("#login-toggle").addEventListener("click", () => loginDialog.showModal());
document.querySelector("#new-transaction").addEventListener("click", () => { document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10); transactionDialog.showModal(); });
document.querySelector("#year-filter").addEventListener("change", renderTransactions);
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));

document.querySelector("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#login-status");
  if (!supabaseClient) { status.textContent = "Supabase ist noch nicht konfiguriert."; return; }
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: document.querySelector("#email").value, password: document.querySelector("#password").value });
  if (error) { status.textContent = `Anmeldung fehlgeschlagen: ${error.message}`; return; }
  document.querySelector("#login-form").reset();
  loginDialog.close();
  setAuthenticated(data.session);
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) authState.textContent = `Abmeldung fehlgeschlagen: ${error.message}`;
});

document.querySelector("#transaction-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#transaction-status");
  if (!supabaseClient || !session) return;
  const payload = {
    type: document.querySelector("#transaction-type").value,
    description: document.querySelector("#transaction-description").value.trim(),
    amount: Number(document.querySelector("#transaction-amount").value),
    transaction_date: document.querySelector("#transaction-date").value,
    category: document.querySelector("#transaction-category").value.trim(),
  };
  const { error } = await supabaseClient.from("transactions").insert(payload);
  if (error) { status.textContent = `Speichern fehlgeschlagen: ${error.message}`; return; }
  transactionDialog.close();
  document.querySelector("#transaction-form").reset();
  await loadTransactions();
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => setAuthenticated(nextSession));
  supabaseClient.auth.getSession().then(({ data, error }) => { if (error) authState.textContent = `Authentifizierung fehlgeschlagen: ${error.message}`; else setAuthenticated(data.session); });
} else {
  setAuthenticated(null);
}
loadPublicContent().catch(error => {
  const message = document.createElement("p");
  message.className = "status";
  message.textContent = `Inhalte konnten nicht geladen werden: ${error.message}`;
  document.querySelector("#team-list").replaceChildren(message);
});
