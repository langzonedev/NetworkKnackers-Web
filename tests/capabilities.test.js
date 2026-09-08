import test from "node:test";
import assert from "node:assert/strict";
import { capabilityModules, formatConnectionSnapshot, validateModule } from "../capabilities.js";

test("all modules satisfy the public module contract", () => {
  assert.equal(capabilityModules.every(validateModule), true);
  assert.equal(new Set(capabilityModules.map(({ id }) => id)).size, capabilityModules.length);
});

test("browser snapshot labels estimates and never invents gateway data", () => {
  const result = formatConnectionSnapshot({ onLine: true, connection: { effectiveType: "4g", rtt: 50, downlink: 8.5, saveData: false } });
  assert.equal(result.status, "success");
  assert.equal(result.fields.find(({ label }) => label === "Effective connection").kind, "estimated");
  assert.equal(result.fields.find(({ label }) => label === "Default gateway").value, "Unavailable");
  assert.equal(result.fields.some(({ value }) => /^192\.168\./.test(value)), false);
});

test("missing Network Information API degrades explicitly", () => {
  const result = formatConnectionSnapshot({ onLine: false });
  assert.equal(result.fields.find(({ label }) => label === "Connection estimate").value, "Unavailable");
  assert.match(result.summary, /offline/i);
});

test("gateway module is not runnable as a browser capability", () => {
  const gateway = capabilityModules.find(({ id }) => id === "gateway.identify");
  assert.equal(gateway.availability, "native-required");
  assert.deepEqual(gateway.requirements, ["native-network-engine"]);
});
