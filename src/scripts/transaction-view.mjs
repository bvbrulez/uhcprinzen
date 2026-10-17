import { describeYearComparison } from "./year-comparison.mjs";

export function createTransactionView({ money, formatDate }) {
  const transactionList = document.querySelector("#transaction-list");
  const transactionTableScroll = transactionList.closest(".table-scroll");
  const emptyState = document.querySelector("#transaction-empty-state");
  const emptyMessage = document.querySelector("#transaction-empty-message");
  const resetEmptyFilters = document.querySelector("#reset-empty-transaction-filters");
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

  function renderYearComparison(selector, currentValue, previousValue, kind) {
    const element = document.querySelector(selector);
    element.className = "year-comparison trend-indicator";
    element.title = "Vergleich mit dem gleichen Zeitraum des Vorjahres.";
    const comparison = describeYearComparison(currentValue, previousValue, kind, money);
    
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    if (comparison.tone === "positive") {
      icon.textContent = "↑";
      element.classList.add("trend-up");
    } else if (comparison.tone === "negative") {
      icon.textContent = "↓";
      element.classList.add("trend-down");
    } else {
      icon.textContent = "→";
      element.classList.add("year-comparison-neutral");
    }

    element.textContent = "";
    element.append(icon, " ", comparison.text);
    element.classList.add(`year-comparison-${comparison.tone}`);
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
    yearlyTotals,
    previousYearTotals,
    currentYear,
    period,
    range,
    bankOpeningBalance,
    paypalOpeningBalance,
    selectedTransactionIds,
    isAdministrator,
    hasActiveFilters,
    callbacks,
  }) {
    const setText = (selector, value, className = null) => { 
      const el = document.querySelector(selector);
      if (!el) return;
      el.textContent = value; 
      if (className) {
        el.className = className;
      }
    };
    const totals = analytics?.totals || {};
    const accounts = analytics?.accounts || {};
    const bankBalance = Number(accounts.BANK || 0) + bankOpeningBalance;
    const paypalBalance = Number(accounts.PAYPAL || 0) + paypalOpeningBalance;
    setText("#summary-period", `Kontosalden und Auswertungen für ${period}. Einnahmen und Ausgaben zeigen das laufende Jahr bis heute.`);
    setText("#total-income-label", `Gesamteinnahmen · ${currentYear} · beide Konten`);
    setText("#total-expenses-label", `Gesamtausgaben · ${currentYear} · beide Konten`);
    setText("#bank-balance-label", `Bankkonto · Saldo zum ${formatDate(range.end)}`);
    setText("#paypal-balance-label", `PayPal-Konto · Saldo zum ${formatDate(range.end)}`);
    setText("#reconciliation-period", period);
    const reconciliation = analytics?.reconciliation || {};
    for (const [account, prefix] of [["BANK", "bank"], ["PAYPAL", "paypal"]]) {
      const values = reconciliation[account] || {};
      const openSummary = document.querySelector(`#${prefix}-open-summary`);
      openSummary.textContent = `${Number(values.open_count || 0)} · ${money(values.open_amount || 0)}`;
      openSummary.setAttribute(
        "aria-label",
        `${Number(values.open_count || 0)} offene Buchungen auf dem ${prefix === "bank" ? "Bankkonto" : "PayPal-Konto"}, ${money(values.open_amount || 0)}. Anklicken, um diese Buchungen anzuzeigen.`,
      );
      setText(`#${prefix}-reconciled-summary`, `${Number(values.reconciled_count || 0)} · ${money(values.reconciled_amount || 0)}`);
    }
    setText("#total-income", money(yearlyTotals.income), "amount-positive");
    setText("#total-expenses", money(yearlyTotals.expenses), "amount-negative");
    renderYearComparison("#income-year-comparison", yearlyTotals.income, previousYearTotals?.income, "income");
    renderYearComparison("#expenses-year-comparison", yearlyTotals.expenses, previousYearTotals?.expenses, "expenses");
    setText("#total-balance", money(bankBalance + paypalBalance));
    setText("#bank-balance", money(bankBalance));
    setText("#paypal-balance", money(paypalBalance));
    renderAnalytics(analytics);

    transactionTableScroll.hidden = transactions.length === 0;
    emptyState.hidden = transactions.length !== 0;
    emptyMessage.textContent = hasActiveFilters
      ? "Keine Buchungen entsprechen den aktiven Filtern."
      : "Für diesen Zeitraum gibt es noch keine Buchungen.";
    resetEmptyFilters.hidden = !hasActiveFilters;
    resetEmptyFilters.onclick = callbacks.resetFilters;

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
      const description = document.createElement("span");
      description.className = "transaction-description";
      description.textContent = item.description;
      row.children[3].append(description);
      row.children[4].textContent = item.type === "INCOME" ? "Einnahme" : "Ausgabe";
      row.children[5].textContent = `${item.type === "INCOME" ? "+" : "-"} ${money(item.amount)}`;
      row.children[5].className = `number ${item.type === "INCOME" ? "amount-positive" : "amount-negative"}`;
      row.children[6].textContent = item.category;
      row.children[7].textContent = item.reconciled_at
        ? `Abgeglichen ${formatDate(item.reconciled_at.slice(0, 10))}${item.reconciled_by_email ? ` · ${item.reconciled_by_email}` : ""}`
        : "Offen";
      row.children[7].className = item.reconciled_at ? "reconciliation-done" : "reconciliation-open";
      row.children[8].textContent = item.updated_by_email
        ? `${formatDate(item.updated_at.slice(0, 10))} · ${item.updated_by_email}`
        : `Erstellt ${formatDate(item.created_at.slice(0, 10))}${item.created_by_email ? ` · ${item.created_by_email}` : ""}`;
      const detailToggle = createButton("Weitere Details", () => {
        const expanded = detailToggle.getAttribute("aria-expanded") !== "true";
        detailToggle.setAttribute("aria-expanded", String(expanded));
        mobileDetails.hidden = !expanded;
      }, "transaction-mobile-toggle");
      detailToggle.setAttribute("aria-expanded", "false");
      detailToggle.setAttribute("aria-controls", `transaction-details-${item.id}`);
      const mobileDetails = document.createElement("div");
      mobileDetails.id = `transaction-details-${item.id}`;
      mobileDetails.className = "transaction-mobile-details";
      mobileDetails.hidden = true;
      const detailValues = [
        ["Konto", item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto"],
        ["Art", item.type === "INCOME" ? "Einnahme" : "Ausgabe"],
        ["Kategorie", item.category],
        ["Geändert", row.children[8].textContent],
      ];
      detailValues.forEach(([label, value]) => {
        const detail = document.createElement("span");
        const heading = document.createElement("strong");
        heading.textContent = `${label}: `;
        detail.append(heading, document.createTextNode(value));
        mobileDetails.append(detail);
      });
      row.children[3].append(detailToggle, mobileDetails);
      if (item.receipt_path) {
        row.children[3].append(createButton(
          `Beleg ansehen${item.receipt_name ? `: ${item.receipt_name}` : ""}`,
          () => callbacks.viewReceipt(item),
          "button button-secondary button-edit transaction-receipt-button",
        ));
      }
      row.children[9].hidden = !isAdministrator;
      row.children[9].classList.add("transaction-actions");
      if (!isAdministrator) return row;

      const actionToggle = createButton("Aktionen", () => {
        const expanded = actionToggle.getAttribute("aria-expanded") !== "true";
        actionToggle.setAttribute("aria-expanded", String(expanded));
        actionList.classList.toggle("is-expanded", expanded);
      }, "transaction-mobile-toggle");
      actionToggle.setAttribute("aria-expanded", "false");
      actionToggle.setAttribute("aria-controls", `transaction-actions-${item.id}`);
      const actionList = document.createElement("div");
      actionList.id = `transaction-actions-${item.id}`;
      actionList.className = "transaction-action-list";
      row.children[9].append(actionToggle, actionList);
      if (!item.deleted_at) {
        const receiptButton = createButton(
          item.receipt_path ? "Beleg ersetzen" : "Beleg hinzufügen",
          () => receiptInput.click(),
        );
        const receiptInput = document.createElement("input");
        receiptInput.type = "file";
        receiptInput.accept = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
        receiptInput.hidden = true;
        receiptInput.setAttribute("aria-label", `Beleg für ${item.description} auswählen`);
        receiptInput.addEventListener("change", () => {
          const [file] = receiptInput.files || [];
          if (file) callbacks.uploadReceipt(item, file);
          receiptInput.value = "";
        });
        actionList.append(receiptButton, receiptInput);
      }
      if (item.receipt_path) {
        actionList.append(createButton("Beleg entfernen", () => callbacks.removeReceipt(item), "button button-danger button-edit"));
      }

      if (item.deleted_at) {
        row.classList.add("deleted-transaction");
        description.textContent += " · gelöscht";
        row.children[8].textContent = `Gelöscht ${formatDate(item.deleted_at.slice(0, 10))}${item.deleted_by_email ? ` · ${item.deleted_by_email}` : ""}`;
        mobileDetails.lastElementChild.lastChild.textContent = row.children[8].textContent;
        actionList.append(createButton("Wiederherstellen", () => callbacks.restore(item)));
      } else {
        actionList.append(createButton(
          item.reconciled_at ? "Abgleich aufheben" : "Abgleichen",
          () => callbacks.toggleReconciled(item),
          `button ${item.reconciled_at ? "button-secondary" : "button-reconcile"} button-edit`,
        ));
        const reconcileButton = actionList.lastElementChild;
        reconcileButton.setAttribute("aria-pressed", String(Boolean(item.reconciled_at)));
        actionList.append(createButton("Ändern", () => callbacks.edit(item)));
        actionList.append(createButton("Löschen", () => callbacks.delete(item), "button button-danger button-edit"));
        actionList.append(createButton("Duplizieren", () => callbacks.duplicate(item)));
      }
      actionList.append(createButton("Verlauf", () => callbacks.audit(item)));
      return row;
    }));
    callbacks.updateBulkControls();
  }

  return { renderTransactions };
}
