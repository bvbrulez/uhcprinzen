import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCsvText,
  csvDuplicateKey,
  normalizeHeader,
  parseCsv,
  parseCsvAmount,
  parseCsvDate,
  parseCsvType,
} from "../../src/scripts/csv-rules.mjs";

test("parses quoted semicolon CSV fields and escaped quotes", () => {
  assert.deepEqual(parseCsv('Datum;Beschreibung\n2026-10-01;"Beitrag; ""Q4"""'), [
    ["Datum", "Beschreibung"],
    ["2026-10-01", 'Beitrag; "Q4"'],
  ]);
});

test("rejects unclosed quoted fields and header-only CSV files", () => {
  assert.throws(() => parseCsv('Datum;Beschreibung\n2026-10-01;"offen'), /Anführungszeichen/);
  assert.throws(() => parseCsv("Datum;Beschreibung"), /Kopfzeile und mindestens eine Buchung/);
});

test("normalizes German headers and classifies transaction types", () => {
  assert.equal(normalizeHeader("Zahlungsempfänger"), "zahlungsempfanger");
  assert.equal(parseCsvType("Gutschrift"), "INCOME");
  assert.equal(parseCsvType("Lastschrift"), "EXPENSE");
  assert.equal(parseCsvType("unbekannt"), null);
});

test("parses valid ISO and German dates without accepting impossible dates", () => {
  assert.equal(parseCsvDate("2026-10-01"), "2026-10-01");
  assert.equal(parseCsvDate("1.10.2026"), "2026-10-01");
  assert.equal(parseCsvDate("31/02/2026"), null);
  assert.equal(parseCsvDate("unknown"), null);
});

test("parses localized and accounting-negative amounts to positive magnitudes", () => {
  assert.deepEqual(parseCsvAmount("1.234,56 €"), { amount: 1234.56, sign: 1 });
  assert.deepEqual(parseCsvAmount("-12,50"), { amount: 12.5, sign: -1 });
  assert.deepEqual(parseCsvAmount("(12.50)"), { amount: 12.5, sign: -1 });
  assert.equal(parseCsvAmount("0"), null);
});

test("duplicate keys normalize descriptions and round amounts to cents", () => {
  const key = csvDuplicateKey({
    transaction_date: "2026-10-01",
    type: "INCOME",
    account: "BANK",
    description: " Monatsbeitrag ",
    amount: 25.001,
  });
  assert.equal(key, csvDuplicateKey({
    transaction_date: "2026-10-01",
    type: "INCOME",
    account: "BANK",
    description: "monatsbeitrag",
    amount: 25,
  }));
});

test("exports selected columns with escaped delimiters and formula-safe text", () => {
  const text = buildCsvText([{
    id: 12,
    transaction_date: "2026-10-01",
    account: "BANK",
    description: '=HYPERLINK("https://example.test")',
    type: "INCOME",
    amount: 25,
    category: "Beiträge; Verein",
    reconciled_at: null,
  }], ["transaction_date", "description", "amount", "category"]);

  assert.equal(text, [
    '"Datum";"Beschreibung";"Betrag";"Kategorie"',
    '"2026-10-01";"\'=HYPERLINK(""https://example.test"")";"25,00";"Beiträge; Verein"',
  ].join("\r\n"));
});

test("exports an audit section and protects audit text from formulas", () => {
  const text = buildCsvText([{
    id: 8,
    description: "Mitgliedsbeitrag",
    transaction_date: "2026-10-01",
    amount: 10,
  }], ["transaction_date"], [{
    transaction_id: 8,
    occurred_at: "2026-10-02T12:00:00Z",
    action: "=DELETE",
    actor_email: "admin@example.test",
    old_data: null,
    new_data: { description: "@SUM(A1)" },
  }], true);

  assert.match(text, /"Änderungsverlauf";"Buchungs-ID";"Beschreibung"/);
  assert.match(text, /"8";"Mitgliedsbeitrag";"2026-10-02T12:00:00Z";"'=DELETE"/);
  assert.ok(text.includes('"{""description"":""@SUM(A1)""}"'));
});
