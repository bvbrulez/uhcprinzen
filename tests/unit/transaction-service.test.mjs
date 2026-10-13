import test from "node:test";
import assert from "node:assert/strict";
import { createTransactionService } from "../../src/scripts/transaction-service.mjs";

function query(result, calls) {
  const builder = new Proxy({}, {
    get(_target, method) {
      if (method === "then") return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => {
        calls.push([method, ...args]);
        return builder;
      };
    },
  });
  return builder;
}

test("loads filtered analytics and current-year totals independently of filters", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return query({
        data: table === "transactions" ? [{ id: 2 }] : [{ name: "Beiträge" }],
        count: table === "transactions" ? 1 : null,
      }, calls);
    },
    rpc(name, args) {
      calls.push(["rpc", name, args]);
      if (name === "get_transaction_years") return Promise.resolve({ data: [{ year: "2026" }], error: null });
      if (args.p_year === 2028 && args.p_account === null) {
        return Promise.resolve({ data: { totals: { income: 1200, expenses: 400 } }, error: null });
      }
      if (args.p_year === 2027 && args.p_account === null) {
        return Promise.resolve({ data: { totals: { income: 1000, expenses: 500 } }, error: null });
      }
      return Promise.resolve({ data: { totals: { income: 30, expenses: 20 } }, error: null });
    },
  };

  const result = await createTransactionService(client).loadPage({
    filters: {
      year: "2026",
      dateRange: { start: "2026-10-01", end: "2026-12-31" },
      showDeleted: false,
      account: "BANK",
      type: "EXPENSE",
      reconciliation: "OPEN",
      search: "Miete",
      summary: true,
    },
    page: 2,
    pageSize: 50,
    startDate: "2026-10-01",
    asOfDate: "2028-02-29",
  });

  assert.deepEqual(result.transactions, [{ id: 2 }]);
  assert.deepEqual(result.analytics, { totals: { income: 30, expenses: 20 } });
  assert.deepEqual(result.yearlyTotals, { income: 1200, expenses: 400 });
  assert.equal(result.currentYear, 2028);
  assert.deepEqual(result.previousYearTotals, { income: 1000, expenses: 500 });
  assert.deepEqual(result.years, ["2026"]);
  assert.deepEqual(result.categories, ["Beiträge"]);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify([
    "rpc",
    "get_transaction_analytics",
    {
      p_year: 2028,
      p_account: null,
      p_type: null,
      p_search: null,
      p_start_date: "2028-01-01",
      p_end_date: "2028-02-29",
      p_reconciled: null,
    },
  ])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify([
    "rpc",
    "get_transaction_analytics",
    {
      p_year: 2027,
      p_account: null,
      p_type: null,
      p_search: null,
      p_start_date: "2027-01-01",
      p_end_date: "2027-02-28",
      p_reconciled: null,
    },
  ])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["range", 100, 149])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "account", "BANK"])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["is", "reconciled_at", null])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["or", "description.ilike.%Miete%,category.ilike.%Miete%"])));
});

test("does not compare years without a complete previous period", async () => {
  const analyticsCalls = [];
  const client = {
    from(table) {
      return query({
        data: table === "transactions" ? [] : [{ name: "Beiträge" }],
        count: 0,
        error: null,
      }, []);
    },
    rpc(name, args) {
      if (name === "get_transaction_years") return Promise.resolve({ data: [], error: null });
      analyticsCalls.push(args);
      return Promise.resolve({ data: { totals: { income: 0, expenses: 0 } }, error: null });
    },
  };

  const result = await createTransactionService(client).loadPage({
    filters: {
      year: "2027",
      dateRange: { start: "2027-01-01", end: "2027-12-31" },
      showDeleted: false,
      account: "ALL",
      type: "ALL",
      reconciliation: "ALL",
      search: "",
      summary: false,
    },
    page: 0,
    pageSize: 50,
    startDate: "2026-10-01",
    asOfDate: "2027-10-11",
  });

  assert.equal(result.previousYearTotals, null);
  assert.equal(analyticsCalls.length, 2);
  assert.ok(analyticsCalls.every(args => args.p_year === 2027));
});

test("propagates database failures instead of producing success-shaped data", async () => {
  const failure = new Error("database unavailable");
  const client = {
    from(table) {
      return query(
        table === "transactions"
          ? { data: null, error: failure }
          : { data: [], error: null },
        [],
      );
    },
    rpc(name) {
      return Promise.resolve(name === "get_transaction_analytics"
        ? { data: {}, error: null }
        : { data: [{ year: "2026" }], error: null });
    },
  };

  await assert.rejects(() => createTransactionService(client).loadPage({
    filters: {
      year: "2026",
      dateRange: { start: "2026-10-01", end: "2026-12-31" },
      showDeleted: false,
      account: "ALL",
      type: "ALL",
      reconciliation: "ALL",
      search: "",
      summary: false,
    },
    page: 0,
    pageSize: 50,
    startDate: "2026-10-01",
    asOfDate: "2026-10-10",
  }), failure);
});

test("loads recent non-deleted transactions from the finance start date", async () => {
  const calls = [];
  const rows = [{ id: 5, description: "Neueste Buchung" }];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return query({ data: rows, error: null }, calls);
    },
  };
  const result = await createTransactionService(client).loadRecentTransactions({
    startDate: "2026-10-01",
    limit: 5,
  });

  assert.deepEqual(result, rows);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["gte", "transaction_date", "2026-10-01"])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["is", "deleted_at", null])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["order", "transaction_date", { ascending: false }])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["order", "id", { ascending: false }])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["limit", 5])));
});

test("propagates errors when recent transactions fail to load", async () => {
  const failure = new Error("recent transactions unavailable");
  const client = {
    from() {
      return query({ data: null, error: failure }, []);
    },
  };

  await assert.rejects(
    () => createTransactionService(client).loadRecentTransactions({ startDate: "2026-10-01", limit: 5 }),
    failure,
  );
});

test("validates receipt type and size before uploading", async () => {
  let uploadCalls = 0;
  const service = createTransactionService({
    storage: { from: () => ({ upload: async () => { uploadCalls += 1; } }) },
  });
  await assert.rejects(() => service.uploadReceipt(1, { name: "receipt.exe", type: "application/octet-stream", size: 10 }), /PDF-, JPEG-, PNG- oder WebP/);
  await assert.rejects(() => service.uploadReceipt(1, { name: "large.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }), /höchstens 10 MB/);
  assert.equal(uploadCalls, 0);
});

test("uploads receipts privately and associates only after storage succeeds", async () => {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload(path, _file, options) {
            calls.push(["upload", bucket, path, options]);
            return { error: null };
          },
        };
      },
    },
    from(table) {
      calls.push(["from", table]);
      return {
        update(values) {
          calls.push(["update", values]);
          return this;
        },
        eq(column, value) {
          calls.push(["eq", column, value]);
          return this;
        },
        select(value) {
          calls.push(["select", value]);
          return this;
        },
        single: async () => ({ data: { id: 4 }, error: null }),
      };
    },
  };
  await createTransactionService(client).uploadReceipt(4, {
    name: "../Kassenbon.pdf",
    type: "application/pdf",
    size: 100,
  });

  const [upload] = calls;
  assert.equal(upload[0], "upload");
  assert.equal(upload[1], "transaction-receipts");
  assert.match(upload[2], /^4\/[0-9a-f-]+-Kassenbon\.pdf$/);
  assert.equal(upload[3].contentType, "application/pdf");
  assert.deepEqual(calls.find(call => call[0] === "update")[1], {
    receipt_path: upload[2],
    receipt_name: "../Kassenbon.pdf",
  });
});

test("cleans up a receipt when the transaction update fails", async () => {
  const calls = [];
  const failure = new Error("transaction update failed");
  const client = {
    storage: {
      from() {
        return {
          upload: async () => ({ error: null }),
          remove: async paths => {
            calls.push(paths);
            return { error: null };
          },
        };
      },
    },
    from() {
      return {
        update() { return this; },
        eq() { return this; },
        select() { return this; },
        single: async () => ({ data: null, error: failure }),
      };
    },
  };
  await assert.rejects(() => createTransactionService(client).uploadReceipt(9, {
    name: "Beleg.png",
    type: "image/png",
    size: 100,
  }), failure);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^9\//);
});

test("creates short-lived signed receipt URLs", async () => {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        return {
          createSignedUrl: async (path, expiresIn) => {
            calls.push([bucket, path, expiresIn]);
            return { data: { signedUrl: "https://example.test/private-receipt" }, error: null };
          },
        };
      },
    },
  };
  assert.equal(await createTransactionService(client).createReceiptUrl("4/receipt.pdf"), "https://example.test/private-receipt");
  assert.deepEqual(calls, [["transaction-receipts", "4/receipt.pdf", 60]]);
});

test("reports a receipt deletion cleanup failure after clearing its transaction reference", async () => {
  const calls = [];
  const client = {
    from() {
      return {
        update(values) { calls.push(["update", values]); return this; },
        eq() { return Promise.resolve({ error: null }); },
      };
    },
    storage: {
      from() {
        return {
          remove: async paths => {
            calls.push(["remove", paths]);
            return { error: new Error("storage unavailable") };
          },
        };
      },
    },
  };
  await assert.rejects(
    () => createTransactionService(client).removeReceipt({ id: 3, receipt_path: "3/file.pdf" }),
    /Der Belegverweis wurde entfernt.*storage unavailable/,
  );
  assert.deepEqual(calls[0][1], { receipt_path: null, receipt_name: null });
  assert.deepEqual(calls[1], ["remove", ["3/file.pdf"]]);
});

test("loads unfiltered monthly analytics for the selected close period", async () => {
  const calls = [];
  const analytics = { totals: { income: 100, expenses: 25 } };
  const service = createTransactionService({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: analytics, error: null };
    },
  });
  assert.equal(await service.loadMonthCloseAnalytics("2027-04", "2027-04-30"), analytics);
  assert.deepEqual(calls, [[
    "get_transaction_analytics",
    {
      p_year: 2027,
      p_account: null,
      p_type: null,
      p_search: null,
      p_start_date: "2027-04-01",
      p_end_date: "2027-04-30",
      p_reconciled: null,
    },
  ]]);
  await assert.rejects(() => service.loadMonthCloseAnalytics("2027-13", "2027-12-31"), /Ungültiger Zeitraum/);
  await assert.rejects(() => service.loadMonthCloseAnalytics("2027-04", "2027-04-31"), /Ungültiger Zeitraum/);
});
