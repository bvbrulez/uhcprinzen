export function createTransactionView({ money, formatDate }) {
  const transactionList = document.querySelector("#transaction-list");
  const monthlySummary = document.querySelector("#monthly-summary");
  const categorySummary = document.querySelector("#category-summary");
  const monthlyData = document.querySelector("#monthly-data");
  const categoryData = document.querySelector("#category-data");
  const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

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
      const income = document.createElement("span");
      income.className = "income-value";
      income.textContent = `Einnahmen ${money(item.income)}`;
      const expenses = document.createElement("span");
      expenses.className = "expense-value";
      expenses.textContent = `Ausgaben ${money(item.expenses)}`;
      values.append(income, expenses);
      row.append(label, bars, values, balance);
      return row;
    }));
    monthlyData.replaceChildren(...(months.length ? months : [null]).map(item => {
      const row = document.createElement("tr");
      if (!item) {
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "Keine Monatswerte im gewählten Zeitraum.";
        row.append(cell);
        return row;
      }
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

  function createButton(label, action, className = "button button-secondary button-edit") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function renderTransactions({
    transactions,
    analytics,
    period,
    range,
    bankOpeningBalance,
    paypalOpeningBalance,
    selectedTransactionIds,
    isAdministrator,
    callbacks,
  }) {
    const setText = (selector, value) => { document.querySelector(selector).textContent = value; };
    const totals = analytics?.totals || {};
    const accounts = analytics?.accounts || {};
    const bankBalance = Number(accounts.BANK || 0) + bankOpeningBalance;
    const paypalBalance = Number(accounts.PAYPAL || 0) + paypalOpeningBalance;
    setText("#summary-period", `Kennzahlen für ${period}`);
    setText("#bank-balance-label", `Bankkonto · Saldo zum ${formatDate(range.end)}`);
    setText("#paypal-balance-label", `PayPal-Konto · Saldo zum ${formatDate(range.end)}`);
    setText("#reconciliation-period", period);
    const reconciliation = analytics?.reconciliation || {};
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
    renderAnalytics(analytics);

    transactionList.replaceChildren(...transactions.map(item => {
      const row = document.createElement("tr");
      row.classList.add(item.type === "INCOME" ? "income-transaction" : "expense-transaction");
      row.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td class=\"number\"></td><td></td><td></td><td></td><td></td>";
      row.children[0].hidden = !isAdministrator || Boolean(item.deleted_at) || Boolean(item.reconciled_at);
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
          callbacks.updateBulkControls();
        });
        row.children[0].append(checkbox);
      }
      ["Auswahl", "Datum", "Konto", "Beschreibung", "Typ", "Betrag", "Kategorie", "Abgleich", "Geändert", "Aktion"]
        .forEach((label, index) => { if (index > 0) row.children[index].dataset.label = label; });
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
      row.children[9].hidden = !isAdministrator;
      row.children[9].classList.add("transaction-actions");
      if (!isAdministrator) return row;

      if (item.deleted_at) {
        row.classList.add("deleted-transaction");
        row.children[3].textContent += " · gelöscht";
        row.children[8].textContent = `Gelöscht ${formatDate(item.deleted_at.slice(0, 10))}${item.deleted_by_email ? ` · ${item.deleted_by_email}` : ""}`;
        row.children[9].append(createButton("Wiederherstellen", () => callbacks.restore(item)));
      } else {
        row.children[9].append(createButton(
          item.reconciled_at ? "Abgleich aufheben" : "Abgleichen",
          () => callbacks.toggleReconciled(item),
          `button ${item.reconciled_at ? "button-secondary" : "button-reconcile"} button-edit`,
        ));
        const reconcileButton = row.children[9].lastElementChild;
        reconcileButton.setAttribute("aria-pressed", String(Boolean(item.reconciled_at)));
        row.children[9].append(createButton("Ändern", () => callbacks.edit(item)));
        row.children[9].append(createButton("Löschen", () => callbacks.delete(item), "button button-danger button-edit"));
        row.children[9].append(createButton("Duplizieren", () => callbacks.duplicate(item)));
      }
      row.children[9].append(createButton("Verlauf", () => callbacks.audit(item)));
      return row;
    }));
    if (!transactions.length) {
      transactionList.innerHTML = '<tr><td colspan="10" class="muted">Keine Buchungen für den gewählten Zeitraum und Filter.</td></tr>';
    }
    callbacks.updateBulkControls();
  }

  return { renderTransactions };
}
