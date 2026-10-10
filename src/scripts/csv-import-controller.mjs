import {
  csvDuplicateKey,
  csvFields,
  csvProfileAliases,
  normalizeHeader,
  parseCsv,
  parseCsvAmount,
  parseCsvDate,
  parseCsvType,
} from "./csv-rules.mjs";

const maxFileBytes = 5 * 1024 * 1024;
const previewPageSize = 50;

export function createCsvImportController({
  transactionService,
  loadCategories,
  isAdministrator,
  financeStartDate,
  formatDate,
  money,
  refreshTransactions,
  refreshContributions,
}) {
  const dialog = document.querySelector("#csv-import-dialog");
  const form = document.querySelector("#csv-import-form");
  const fileInput = document.querySelector("#csv-file");
  const mapping = document.querySelector("#csv-column-mapping");
  const preview = document.querySelector("#csv-preview");
  const previous = document.querySelector("#csv-preview-previous");
  const next = document.querySelector("#csv-preview-next");
  const pageStatus = document.querySelector("#csv-preview-page-status");
  const status = document.querySelector("#csv-import-status");
  const submit = document.querySelector("#csv-import-submit");
  const profile = document.querySelector("#csv-profile");
  let headers = [];
  let records = [];
  let preparedRows = [];
  let previewPage = 0;
  let classificationRequestId = 0;

  function renderMapping() {
    mapping.replaceChildren(...csvFields.map(field => {
      const label = document.createElement("label");
      label.textContent = `${field.title}${field.required ? " (erforderlich)" : ""}`;
      const select = document.createElement("select");
      select.dataset.csvField = field.key;
      select.setAttribute("aria-label", `${field.title} in der CSV`);
      select.add(new Option("Nicht zugeordnet", ""));
      headers.forEach((header, index) => select.add(new Option(header || `Spalte ${index + 1}`, String(index))));
      const profileAliases = csvProfileAliases[profile.value] || {};
      const aliases = [...(profileAliases[field.key] || []), ...field.aliases];
      const match = headers.findIndex(header => aliases.includes(normalizeHeader(header)));
      if (match >= 0) select.value = String(match);
      label.append(select);
      return label;
    }));
    mapping.querySelectorAll("select").forEach(select => select.addEventListener("change", () => {
      classifyRows().catch(error => {
        submit.disabled = true;
        status.textContent = `CSV-Vorschau konnte nicht aktualisiert werden: ${error.message}`;
      });
    }));
  }

  function getMappedValue(record, field) {
    const selected = mapping.querySelector(`[data-csv-field="${field}"]`)?.value;
    return selected === "" || selected === undefined ? "" : record[Number(selected)]?.trim() || "";
  }

  function renderPreview() {
    const labels = ["Zeile", "Datum", "Art", "Konto", "Beschreibung", "Betrag", "Kategorie", "Prüfung"];
    const pageCount = Math.max(1, Math.ceil(preparedRows.length / previewPageSize));
    previewPage = Math.min(previewPage, pageCount - 1);
    const start = previewPage * previewPageSize;
    const pageRows = preparedRows.slice(start, start + previewPageSize);
    preview.replaceChildren(...pageRows.map(row => {
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
    const importable = preparedRows.filter(row => !row.error && !row.duplicateInFile && !row.duplicateInDatabase).length;
    const skipped = preparedRows.length - importable;
    submit.disabled = !isAdministrator() || importable === 0;
    previous.disabled = previewPage === 0;
    next.disabled = previewPage >= pageCount - 1;
    pageStatus.textContent = preparedRows.length
      ? `Vorschau ${start + 1}–${Math.min(start + pageRows.length, preparedRows.length)} von ${preparedRows.length} · Seite ${previewPage + 1} von ${pageCount}`
      : "Keine Vorschau vorhanden.";
    status.textContent = `${importable} importierbar · ${skipped} fehlerhaft oder doppelt übersprungen.`;
  }

  async function detectDuplicates(rows, requestId) {
    const dates = [...new Set(rows.filter(row => !row.error).map(row => row.transaction.transaction_date))];
    if (!dates.length) return;
    const existingRows = await transactionService.loadRowsForDates(dates);
    if (requestId !== classificationRequestId) return;
    const existing = new Set(existingRows.map(item => csvDuplicateKey(item)));
    rows.forEach(row => {
      row.duplicateInDatabase = Boolean(row.key && existing.has(row.key));
    });
  }

  async function classifyRows() {
    if (!records.length) return;
    const requestId = ++classificationRequestId;
    try {
      const categories = await loadCategories();
      if (requestId !== classificationRequestId) return;
      const seen = new Set();
      preparedRows = records.map((record, index) => {
        const date = parseCsvDate(getMappedValue(record, "date"));
        const explicitType = parseCsvType(getMappedValue(record, "type"));
        const description = getMappedValue(record, "description");
        const rawAmount = getMappedValue(record, "amount");
        const debitValue = getMappedValue(record, "debit");
        const creditValue = getMappedValue(record, "credit");
        const debit = debitValue ? parseCsvAmount(debitValue) : null;
        const credit = creditValue ? parseCsvAmount(creditValue) : null;
        const bothColumnsFilled = Boolean(debit?.amount && credit?.amount);
        const parsedAmount = bothColumnsFilled ? null
          : credit?.amount ? { amount: credit.amount, sign: 1 }
            : debit?.amount ? { amount: debit.amount, sign: -1 }
              : rawAmount ? parseCsvAmount(rawAmount) : null;
        const type = explicitType || (parsedAmount?.sign < 0 ? "EXPENSE" : parsedAmount?.sign > 0 ? "INCOME" : null);
        const amount = parsedAmount?.amount;
        const accountText = normalizeHeader(getMappedValue(record, "account"));
        const account = !accountText
          ? profile.value === "paypal" ? "PAYPAL" : "BANK"
          : ["bank", "bankkonto", "girokonto"].includes(accountText) ? "BANK"
            : ["paypal", "paypalkonto"].includes(accountText) ? "PAYPAL" : null;
        const category = getMappedValue(record, "category") || "Sonstiges";
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
      const rows = preparedRows;
      await detectDuplicates(rows, requestId);
      if (requestId !== classificationRequestId) return;
      renderPreview();
    } catch (error) {
      if (requestId === classificationRequestId) throw error;
    }
  }

  function open() {
    if (!isAdministrator()) return;
    classificationRequestId += 1;
    form.reset();
    mapping.replaceChildren();
    preview.replaceChildren();
    preparedRows = [];
    records = [];
    headers = [];
    previewPage = 0;
    previous.disabled = true;
    next.disabled = true;
    pageStatus.textContent = "Keine Vorschau vorhanden.";
    submit.disabled = true;
    status.textContent = "";
    dialog.showModal();
  }

  function downloadExample() {
    const sample = [
      "Datum;Beschreibung;Soll;Haben;Konto;Kategorie",
      "2026-10-15;Monatsbeitrag;;25,00;Bankkonto;Prinzenkröten",
      "2026-10-20;Platzmiete;120,00;;Bankkonto;Platzmiete",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", sample], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "uhc-prinzen-csv-beispiel.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  profile.addEventListener("change", () => {
    if (!headers.length) return;
    renderMapping();
    classifyRows().catch(error => {
      submit.disabled = true;
      status.textContent = `CSV-Vorschau konnte nicht aktualisiert werden: ${error.message}`;
    });
  });
  fileInput.addEventListener("change", async () => {
    const requestId = ++classificationRequestId;
    submit.disabled = true;
    status.textContent = "";
    preview.replaceChildren();
    mapping.replaceChildren();
    preparedRows = [];
    records = [];
    headers = [];
    previewPage = 0;
    previous.disabled = true;
    next.disabled = true;
    pageStatus.textContent = "Keine Vorschau vorhanden.";
    try {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (file.size > maxFileBytes) {
        throw new Error(`Die Datei ist größer als das Limit von ${Math.round(maxFileBytes / 1024 / 1024)} MB.`);
      }
      const text = await file.text();
      if (requestId !== classificationRequestId) return;
      const rows = parseCsv(text.replace(/^\uFEFF/, ""));
      if (rows.length - 1 > 500) throw new Error("Pro Import sind höchstens 500 Datenzeilen erlaubt.");
      headers = rows[0].map(value => value.trim());
      records = rows.slice(1);
      renderMapping();
      await classifyRows();
    } catch (error) {
      status.textContent = `CSV konnte nicht vorbereitet werden: ${error.message}`;
    }
  });
  previous.addEventListener("click", () => {
    if (previewPage === 0) return;
    previewPage -= 1;
    renderPreview();
  });
  next.addEventListener("click", () => {
    const lastPage = Math.max(0, Math.ceil(preparedRows.length / previewPageSize) - 1);
    if (previewPage >= lastPage) return;
    previewPage += 1;
    renderPreview();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!isAdministrator()) return;
    const rows = preparedRows.filter(row => !row.error && !row.duplicateInFile && !row.duplicateInDatabase);
    if (!rows.length) return;
    submit.disabled = true;
    status.textContent = `${rows.length} Buchungen werden importiert …`;
    try {
      await transactionService.importMany(rows.map(row => row.transaction));
      rows.forEach(row => { row.duplicateInDatabase = true; });
      renderPreview();
      status.textContent = `${rows.length} Buchungen importiert; ${preparedRows.length - rows.length} fehlerhafte oder doppelte Zeilen übersprungen.`;
      await refreshTransactions();
      await refreshContributions();
    } catch (error) {
      status.textContent = `Import fehlgeschlagen; es wurden keine Buchungen übernommen: ${error.message}`;
    } finally {
      submit.disabled = preparedRows.every(row => row.error || row.duplicateInFile || row.duplicateInDatabase);
    }
  });

  return { open, downloadExample };
}
