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
// Screenshot variant: only then are id/has_screenshot sent.
const env = { host: "cloud-sync-preview-jinx-stables.renee-rieke.workers.dev", build: "b", ua: "u", viewport: "1x1" };
const withShot = ctx.feedbackPayload("bug", "broken", "", env, { id: "11111111-2222-4333-8444-555555555555" });
assert.equal(withShot.id, "11111111-2222-4333-8444-555555555555");
assert.equal(withShot.has_screenshot, true);
assert.deepEqual(Object.keys(withShot).sort(), ["app_build", "category", "doing", "has_screenshot", "id", "message", "site", "user_agent", "viewport"]);
assert.ok(!("has_screenshot" in ctx.feedbackPayload("bug", "x", "", env, null)), "no screenshot: original columns only");

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const nodeCrypto = require("node:crypto");
assert.match(ctx.feedbackNewId({ randomUUID: () => nodeCrypto.randomUUID() }), uuidRe);
const fallback = ctx.feedbackNewId({ getRandomValues: (b) => nodeCrypto.randomFillSync(b) });
assert.match(fallback, uuidRe, "fallback builds a v4 UUID");

assert.equal(ctx.feedbackShotPath("aaaa", "bbbb"), "aaaa/bbbb.jpg");
assert.equal(ctx.feedbackShotUploadDone({ data: {}, error: null }), true);
assert.equal(ctx.feedbackShotUploadDone({ error: { statusCode: "409", message: "The resource already exists" } }), true, "already uploaded counts as done");
// Real storage-api v1.11.2 response to a second upload of the same name (HTTP 400, body statusCode 409):
assert.equal(ctx.feedbackShotUploadDone({ error: { status: 400, statusCode: "409", error: "Duplicate", message: "The resource already exists" } }), true);
assert.equal(ctx.feedbackShotUploadDone({ error: { status: 400, statusCode: "400", message: "Asset Already Exists" } }), true, "400 Asset Already Exists counts as done");
assert.equal(ctx.feedbackShotUploadDone({ error: { statusCode: "403", message: "new row violates row-level security policy" } }), false);
assert.equal(ctx.feedbackShotUploadDone({ error: { status: 400, statusCode: "400", message: "new row violates row-level security policy" } }), false, "a plain 400 is not done");
assert.equal(ctx.feedbackShotUploadDone({ error: { statusCode: "413", message: "The object exceeded the maximum allowed size" } }), false);
assert.equal(ctx.feedbackShotUnsupported({ code: "42501", message: "permission denied for table feedback" }), true);
assert.equal(ctx.feedbackShotUnsupported({ code: "PGRST204", message: "Could not find the 'has_screenshot' column of 'feedback' in the schema cache" }), true);
assert.equal(ctx.feedbackShotUnsupported({ code: "P0001", message: "Feedback limit reached: at most 20 reports per day." }), false);
assert.equal(ctx.feedbackShotInputProblem(3 * 1024 * 1024, "image/png"), "");
assert.equal(ctx.feedbackShotInputProblem(3 * 1024 * 1024, ""), "", "some phones give no type; compression decides");
assert.match(ctx.feedbackShotInputProblem(20 * 1024 * 1024 + 1, "image/jpeg"), /over 20 MB/);
assert.match(ctx.feedbackShotInputProblem(1000, "application/pdf"), /choose an image/);
assert.match(ctx.feedbackShotInputProblem(0, "image/jpeg"), /empty/);
console.log("feedback helper tests passed");
