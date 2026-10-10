import test from "node:test";
import assert from "node:assert/strict";
import { createLatestRequestGate } from "../../src/scripts/latest-request.mjs";

test("only the latest request remains eligible to update the view", () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();

  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

test("logging out or invalidating filters makes pending requests stale", () => {
  const gate = createLatestRequestGate();
  const request = gate.begin();
  gate.invalidate();

  assert.equal(gate.isCurrent(request), false);
});
