import test from "node:test";
import assert from "node:assert/strict";
import { describeYearComparison } from "../../src/scripts/year-comparison.mjs";

const money = value => `${Number(value).toLocaleString("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} €`;

test("does not imply a change when no comparable previous period is available", () => {
  assert.deepEqual(describeYearComparison(120, null, "income", money), {
    text: "Kein vergleichbarer Vorjahreszeitraum",
    tone: "neutral",
  });
});

test("describes a percentage change and colors income increases positively", () => {
  assert.deepEqual(describeYearComparison(125, 100, "income", money), {
    text: "Vorjahr 100,00 € · +25,0 %",
    tone: "positive",
  });
});

test("treats lower expenses as positive and higher expenses as negative", () => {
  assert.deepEqual(describeYearComparison(75, 100, "expenses", money), {
    text: "Vorjahr 100,00 € · −25,0 %",
    tone: "positive",
  });
  assert.equal(describeYearComparison(125, 100, "expenses", money).tone, "negative");
});

test("handles a zero previous total without calculating an invalid percentage", () => {
  assert.deepEqual(describeYearComparison(25, 0, "income", money), {
    text: "Vorjahr 0,00 € · erstmals vorhanden",
    tone: "positive",
  });
  assert.equal(describeYearComparison(0, 0, "income", money).tone, "neutral");
});
