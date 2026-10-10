import test from "node:test";
import assert from "node:assert/strict";
import { createContributionService } from "../../src/scripts/contribution-service.mjs";

function createQuery(result) {
  const calls = [];
  const query = new Proxy({}, {
    get(_target, method) {
      if (method === "then") return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => {
        calls.push([method, ...args]);
        return query;
      };
    },
  });
  return { query, calls };
}

test("loads contribution records through a single domain service", async () => {
  const responses = {
    team_members: [{ data: [{ id: 1, name: "Test", active: true }] }],
    team_contribution_settings: [{ data: { quarterly_amount: 75 } }],
    team_contribution_payments: [{ data: [{ id: 2 }] }],
    team_contribution_payment_quarters: [{ data: [{ payment_id: 2 }] }],
    team_contribution_rates: [{ data: [{ quarter_start: "2026-10-01" }] }],
  };
  const calls = [];
  const client = {
    from(table) {
      const result = responses[table].shift();
      const builder = createQuery(result);
      calls.push({ table, builder });
      return builder.query;
    },
  };

  const overview = await createContributionService(client).loadOverview();

  assert.equal(overview.members[0].name, "Test");
  assert.equal(overview.settings.quarterly_amount, 75);
  assert.equal(overview.payments[0].id, 2);
  assert.equal(overview.quarters[0].payment_id, 2);
  assert.equal(overview.rates[0].quarter_start, "2026-10-01");
  assert.equal(calls.length, 5);
});

test("loads income pages with cutoff, pagination, and optional search filters", async () => {
  const builder = createQuery({ data: [{ id: 4 }] });
  const client = { from: () => builder.query };

  const result = await createContributionService(client).loadIncomeTransactions({
    startDate: "2026-10-01",
    offset: 100,
    search: "Mitglied",
  });

  assert.deepEqual(result, [{ id: 4 }]);
  assert.deepEqual(builder.calls, [
    ["select", "id, description, amount, transaction_date"],
    ["eq", "type", "INCOME"],
    ["gte", "transaction_date", "2026-10-01"],
    ["is", "deleted_at", null],
    ["order", "transaction_date", { ascending: false }],
    ["order", "id", { ascending: false }],
    ["range", 100, 199],
    ["ilike", "description", "%Mitglied%"],
  ]);
});

test("propagates Supabase errors instead of returning empty data", async () => {
  const failure = new Error("database unavailable");
  const client = {
    from: () => createQuery({ data: null, error: failure }).query,
  };

  await assert.rejects(
    () => createContributionService(client).loadIncomeTransactions({
      startDate: "2026-10-01",
      offset: 0,
      search: "",
    }),
    failure,
  );
});
