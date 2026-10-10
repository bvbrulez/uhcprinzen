export function parseCsv(text) {
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

export const normalizeHeader = value => value.toLocaleLowerCase("de-DE")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]/g, "");

export const csvFields = [
  { key: "date", title: "Datum", required: true, aliases: ["datum", "date", "buchungsdatum", "valuta", "buchungstag"] },
  { key: "type", title: "Art", aliases: ["art", "typ", "type", "buchungsart", "umsatzart", "sollhaben", "sollhabencode"] },
  { key: "description", title: "Beschreibung", required: true, aliases: ["beschreibung", "verwendungszweck", "buchungstext", "description", "name", "empfaenger", "auftraggeber", "zahlungsempfaenger"] },
  { key: "amount", title: "Betrag", aliases: ["betrag", "umsatz", "amount", "summe", "transaktionsbetrag", "brutto", "gross", "grossamount", "net", "netto", "netamount"] },
  { key: "debit", title: "Soll / Belastung", aliases: ["soll", "solleur", "sollbetrag", "betragsoll", "belastung", "lastschrift", "debit", "ausgabe"] },
  { key: "credit", title: "Haben / Gutschrift", aliases: ["haben", "habeneur", "habenbetrag", "betraghaben", "gutschrift", "credit", "einnahme"] },
  { key: "account", title: "Konto", aliases: ["konto", "account", "kontoname"] },
  { key: "category", title: "Kategorie", aliases: ["kategorie", "category"] },
];

export const csvProfileAliases = {
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

export function parseCsvDate(value) {
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

export function parseCsvAmount(value) {
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

export function parseCsvType(value) {
  const type = normalizeHeader(value);
  if (["income", "einnahme", "eingang", "haben", "h", "credit", "gutschrift"].includes(type)) return "INCOME";
  if (["expense", "ausgabe", "ausgang", "soll", "s", "debit", "lastschrift", "belastung"].includes(type)) return "EXPENSE";
  return null;
}

export function csvDuplicateKey(transaction) {
  return JSON.stringify([
    transaction.transaction_date,
    transaction.type,
    transaction.account,
    transaction.description.trim().toLocaleLowerCase("de-DE"),
    Math.round(Number(transaction.amount) * 100),
  ]);
}

export const exportColumnOptions = [
  ["transaction_date", "Datum"],
  ["account", "Konto"],
  ["description", "Beschreibung"],
  ["type", "Art"],
  ["amount", "Betrag"],
  ["category", "Kategorie"],
  ["reconciled", "Abgleichstatus"],
  ["reconciled_at", "Abgeglichen am"],
  ["reconciled_by_email", "Abgeglichen von"],
];

function quoteCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function protectSpreadsheetFormula(value) {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(String(value ?? "")) ? `'${value}` : value;
}

function exportColumnValue(item, key) {
  if (key === "account") return item.account === "PAYPAL" ? "PayPal-Konto" : "Bankkonto";
  if (key === "type") return item.type === "INCOME" ? "Einnahme" : "Ausgabe";
  if (key === "amount") return Number(item.amount).toFixed(2).replace(".", ",");
  if (key === "reconciled") return item.reconciled_at ? "Ja" : "Nein";
  return item[key] || "";
}

export function buildCsvText(rows, selectedColumns, auditEntries = [], includeAudit = false) {
  const columns = exportColumnOptions.filter(([key]) => selectedColumns.includes(key));
  const lines = [
    columns.map(([, label]) => quoteCsv(label)).join(";"),
    ...rows.map(item => columns
      .map(([key]) => quoteCsv(protectSpreadsheetFormula(exportColumnValue(item, key))))
      .join(";")),
  ];

  if (includeAudit) {
    const byId = new Map(rows.map(row => [row.id, row.description]));
    lines.push("", ["Änderungsverlauf", "Buchungs-ID", "Beschreibung", "Zeitpunkt", "Aktion", "Benutzer", "Vorher", "Nachher"]
      .map(quoteCsv).join(";"));
    lines.push(...auditEntries.map(entry => [
      "",
      entry.transaction_id,
      protectSpreadsheetFormula(byId.get(entry.transaction_id) || ""),
      entry.occurred_at,
      protectSpreadsheetFormula(entry.action),
      protectSpreadsheetFormula(entry.actor_email),
      protectSpreadsheetFormula(JSON.stringify(entry.old_data || {})),
      protectSpreadsheetFormula(JSON.stringify(entry.new_data || {})),
    ].map(quoteCsv).join(";")));
  }
  return lines.join("\r\n");
}
