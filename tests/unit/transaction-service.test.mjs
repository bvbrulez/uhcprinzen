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

test("loads the transaction page, analytics, years, and categories with the same filters", async () => {
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
      return Promise.resolve(name === "get_transaction_analytics"
        ? { data: { totals: {} }, error: null }
        : { data: [{ year: "2026" }], error: null });
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
  });

  assert.deepEqual(result.transactions, [{ id: 2 }]);
  assert.deepEqual(result.analytics, { totals: {} });
  assert.deepEqual(result.years, ["2026"]);
  assert.deepEqual(result.categories, ["Beiträge"]);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["range", 100, 149])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "account", "BANK"])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["is", "reconciled_at", null])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["or", "description.ilike.%Miete%,category.ilike.%Miete%"])));
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
  }), failure);
});
