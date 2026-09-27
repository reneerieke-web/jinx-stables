// Unit tests for the pure screenshot-sync helpers in public/index.html.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("public/index.html", "utf8");
const start = html.indexOf("  // ---------- Screenshot cloud sync: pure helpers ----------");
const end = html.indexOf("  function emptySkills(onKeys){", start);
assert.ok(start >= 0 && end > start, "screenshot helpers are present");
const ctx = vm.createContext({});
vm.runInContext(html.slice(start, end), ctx);

// Pointer normalization: valid object, explicit null, anything else absent.
assert.deepEqual(JSON.parse(JSON.stringify(ctx.normalizeScreenshotPointer({ v: "mg3k2x1a-4f9z2q", x: 1 }))), { v: "mg3k2x1a-4f9z2q" });
assert.equal(ctx.normalizeScreenshotPointer({ v: "2026-09-27T12:00:00.000Z" }), undefined, "only file-name-safe versions");
assert.equal(ctx.normalizeScreenshotPointer(null), null);
assert.equal(ctx.normalizeScreenshotPointer(undefined), undefined);
assert.equal(ctx.normalizeScreenshotPointer({ v: "<img onerror=1>" }), undefined, "unsafe v is dropped");
assert.equal(ctx.normalizeScreenshotPointer({ v: "" }), undefined);
assert.equal(ctx.normalizeScreenshotPointer("x"), undefined);

// Paths match the storage policy's rule.
const p = ctx.shotPaths("uid-1", "h_abc");
assert.equal(p.full, "uid-1/h_abc/full.jpg");
assert.equal(p.thumb, "uid-1/h_abc/thumb.jpg");
assert.equal(ctx.shotIdSafe("h_mufu0wft0leo32"), true);
assert.equal(ctx.shotIdSafe("../x"), false);

// Byte length of a base64 data URL.
assert.equal(ctx.dataUrlByteLength("data:image/jpeg;base64," + Buffer.alloc(1000).toString("base64")), 1000);
assert.equal(ctx.dataUrlByteLength("data:image/jpeg;base64," + Buffer.alloc(1001).toString("base64")), 1001);

// Storage error classification.
assert.equal(ctx.classifyStorageError({ statusCode: "404", message: "Bucket not found" }), "unavailable");
assert.equal(ctx.classifyStorageError({ statusCode: "413", message: "The object exceeded the maximum allowed size" }), "rejected");
assert.equal(ctx.classifyStorageError({ statusCode: "415", message: "mime type image/png is not supported" }), "rejected");
assert.equal(ctx.classifyStorageError({ statusCode: "403", message: "new row violates row-level security policy" }), "retry");
assert.equal(ctx.classifyStorageError(new TypeError("Failed to fetch")), "retry");

// Backoff grows and caps at 10 minutes.
assert.equal(ctx.shotBackoffMs(0), 5000);
assert.equal(ctx.shotBackoffMs(3), 40000);
assert.equal(ctx.shotBackoffMs(20), 600000);

// Cache decisions.
const V = { v: "a" };
assert.equal(ctx.shotCacheDecision(V, { cloudV: "a" }, false), "keep");
assert.equal(ctx.shotCacheDecision(V, { cloudV: "old" }, false), "stale");
assert.equal(ctx.shotCacheDecision(V, null, false), "stale");
assert.equal(ctx.shotCacheDecision(V, { cloudV: "old" }, true), "keep", "own pending change wins");
assert.equal(ctx.shotCacheDecision(null, { cloudV: "a" }, false), "clear", "explicit removal clears a synced copy");
assert.equal(ctx.shotCacheDecision(null, { full: "x" }, false), "keep", "never clears a device-only picture");
assert.equal(ctx.shotCacheDecision(undefined, { cloudV: "a" }, false), "keep", "missing field is not a removal");
assert.equal(ctx.shotCacheDecision(null, { cloudV: "a" }, true), "keep");

// One-time upload offer.
const horse = { id: "h1" };
assert.equal(ctx.shotOfferCandidate(horse, { full: "x" }, true, false), true);
assert.equal(ctx.shotOfferCandidate(horse, { full: "x", cloudV: "a" }, true, false), false, "already uploaded");
assert.equal(ctx.shotOfferCandidate(horse, { full: "x" }, false, false), false, "horse row not in cloud yet");
assert.equal(ctx.shotOfferCandidate({ id: "h1", screenshot: V }, { full: "x" }, true, false), false, "cloud already has one");
assert.equal(ctx.shotOfferCandidate(horse, { full: "x" }, true, true), false, "already queued");
assert.equal(ctx.shotOfferCandidate(horse, { thumb: "t" }, true, false), false, "thumb-only cache");

// Orphan detection.
const now = Date.parse("2026-10-30T00:00:00Z");
const old = [{ name: "full.jpg", updated_at: "2026-09-01T00:00:00Z" }, { name: "thumb.jpg", updated_at: "2026-09-01T00:00:00Z" }];
const fresh = [{ name: "full.jpg", updated_at: "2026-10-29T23:00:00Z" }];
assert.equal(ctx.shotFolderIsOrphan("gone", {}, {}, old, now), true);
assert.equal(ctx.shotFolderIsOrphan("alive", { alive: true }, {}, old, now), false, "known (active or deleted) horse");
assert.equal(ctx.shotFolderIsOrphan("q", {}, { q: true }, old, now), false, "queued");
assert.equal(ctx.shotFolderIsOrphan("new", {}, {}, fresh, now), false, "too new: may be another device's new horse");
assert.equal(ctx.shotFolderIsOrphan("x", {}, {}, [{ name: "full.jpg" }], now), false, "no timestamp");
assert.equal(ctx.shotFolderIsOrphan("x", {}, {}, [], now), false);

console.log("screenshot sync helper tests passed");
