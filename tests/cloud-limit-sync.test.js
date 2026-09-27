const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("public/index.html", "utf8");
const start = html.indexOf("  function cloudLimitErrorMessage(err){");
const end = html.indexOf("  function loadCloudCache(userId){", start);
assert.ok(start >= 0 && end > start, "cloud limit helpers are present");

const context = vm.createContext({ TextEncoder, Blob });
vm.runInContext(html.slice(start, end), context);

const exact = JSON.stringify({ name: "Exact", notes: "x".repeat(25973) });
assert.equal(new TextEncoder().encode(exact).length, 26000);
let plan = context.cloudDirtyUpsertPlan({ upserts: { exact }, deletes: {} });
assert.equal(plan.send.length, 1, "26,000 UTF-8 bytes is allowed");
assert.deepEqual(Object.keys(plan.blockedSnapshots), []);

const tooLarge = JSON.stringify({ name: "Big Horse", notes: "x".repeat(25975) });
const valid = JSON.stringify({ name: "Small Horse", notes: "ok" });
plan = context.cloudDirtyUpsertPlan({
  upserts: { big: tooLarge, small: valid },
  deletes: {}
});
assert.deepEqual(Array.from(plan.send, (item) => item.id), ["small"]);
assert.deepEqual(Object.keys(plan.blockedSnapshots), ["big"]);
assert.deepEqual(Array.from(plan.blockedNames), ["Big Horse"]);
assert.match(context.oversizedHorseMessage(plan.blockedNames), /“Big Horse”/);

const unicode = JSON.stringify({ name: "Emoji", notes: "🐴".repeat(6500) });
assert.ok(unicode.length < 26000, "UTF-16 length alone would miss this case");
assert.ok(new TextEncoder().encode(unicode).length > 26000);
plan = context.cloudDirtyUpsertPlan({ upserts: { unicode }, deletes: {} });
assert.deepEqual(Array.from(Object.keys(plan.blockedSnapshots)), ["unicode"]);

context.cloudDirty = { upserts: { unicode }, deletes: {} };
assert.equal(context.hasRetryableCloudDirty(plan.blockedSnapshots), false);
context.cloudDirty.upserts.unicode = valid;
assert.equal(
  context.hasRetryableCloudDirty(plan.blockedSnapshots),
  true,
  "editing a blocked horse below the cap queues another save attempt"
);

const merged = context.mergeCloudDirtyIntoRoster(
  [{ id: "keep", name: "Remote" }, { id: "delete", name: "Delete me" }],
  {
    upserts: {
      keep: JSON.stringify({ id: "keep", name: "Local edit" }),
      newHorse: JSON.stringify({ id: "newHorse", name: "Rejected but editable" })
    },
    deletes: { delete: true }
  }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(merged)),
  [
    { id: "keep", name: "Local edit" },
    { id: "newHorse", name: "Rejected but editable" }
  ],
  "reconnect keeps dirty local snapshots visible and honors local deletes"
);

assert.match(
  context.cloudLimitErrorMessage({ code: "P0001", message: "stable cannot exceed 2,000 horse rows" }),
  /Recently deleted horses still count until they are purged after 30 days/
);

console.log("cloud limit sync tests passed");
