// Unit tests for the feedback helpers in public/index.html.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("public/index.html", "utf8");
const start = html.indexOf("  var FEEDBACK_CATEGORIES = [");
const end = html.indexOf("  var FEEDBACK_BUILD =", start);
assert.ok(start > 0 && end > start, "feedback helpers present");
const ctx = vm.createContext({});
vm.runInContext(html.slice(start, end), ctx);

assert.equal(ctx.feedbackSiteFor("www.jinxsstables.com"), "production");
assert.equal(ctx.feedbackSiteFor("jinxsstables.com"), "production");
assert.equal(ctx.feedbackSiteFor("jinx-stables.renee-rieke.workers.dev"), "production");
assert.equal(ctx.feedbackSiteFor("cloud-sync-preview-jinx-stables.renee-rieke.workers.dev"), "preview");
assert.equal(ctx.feedbackSiteFor("evil.example"), "other");

const p = ctx.feedbackPayload("idea", "  " + "x".repeat(5000) + "  ", "", { host: "www.jinxsstables.com", build: "b", ua: "u".repeat(600), viewport: "390x844" });
assert.equal(p.message.length, 4000, "message capped to DB limit");
assert.equal(p.doing, null, "empty optional field sent as null");
assert.equal(p.user_agent.length, 512, "user agent capped to DB limit");
assert.equal(p.site, "production");
assert.deepEqual(Object.keys(p).sort(), ["app_build", "category", "doing", "message", "site", "user_agent", "viewport"],
  "only the columns users are granted; never user_id/status/created_at/id");
assert.equal(ctx.feedbackPayload("bug", "   ", "", { host: "" }).message, "", "whitespace-only message is empty");
console.log("feedback helper tests passed");
