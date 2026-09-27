// End-to-end test of screenshot sync against an in-memory fake Supabase.
// Nothing here talks to the real project. Two browser contexts act as two
// devices signed in to the same account; a third checks guest mode.
//
//   npm i playwright   (Chromium must be available)
//   node tests/screenshot-sync.e2e.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "public");
const ORIGIN = "http://jinx.test";
const UID = "11111111-1111-4111-8111-111111111111";
const STABLE = "22222222-2222-4222-8222-222222222222";

// ---------- fake backend (shared by every page) ----------
const now = () => new Date().toISOString();
// Horse data shaped like real rows (same fields mk() produces).
const horseData = (id, name, tier, sex, level) => ({
  id, ownerId: "local", name, tier, sex, level, coat: "", coatGroup: "Undetermined", coatColor: "#8C857B",
  coatIdCurrent: "", coatIdLegacy: "", redValue: "", whiteValue: "", blackValue: "", coatStatus: "Unknown",
  coatSource: "", referenceCoatId: "", rider: "", location: "", status: "Undetermined", breedings: 2,
  skills: { sprint: true }, subtype: "", otherSkillNotes: "", skillDataReviewed: true, notes: "",
  acquisition: "Unknown", parentNames: null, project: { type: "None", label: "" }, sale: null,
  imperial: null, exchange: null, consumedIn: null, history: [],
});
const db = {
  horses: [
    { stable_id: STABLE, id: "h_one", data: horseData("h_one", "Cannoli", "8", "Male", 15), updated_at: now(), deleted_at: null },
    { stable_id: STABLE, id: "h_two", data: horseData("h_two", "Taffy", "7", "Female", 16), updated_at: now(), deleted_at: null },
    { stable_id: STABLE, id: "h_three", data: horseData("h_three", "NillaCrumpet", "6", "Female", 9), updated_at: now(), deleted_at: null },
  ],
  stables: [{ id: STABLE, owner_id: UID, name: "Test Stable" }],
};
const storage = new Map(); // path -> {b64, type, updated_at}
let bucketExists = true;
let forceServerError = false;
const storageLog = [];
let stamp = 0;
const tick = () => new Date(Date.now() + (++stamp)).toISOString();

function runQuery(spec) {
  const rows = db[spec.table];
  const match = (r) => spec.filters.every((f) => {
    if (f.op === "eq") return String(r[f.col]) === String(f.val);
    if (f.op === "notnull") return r[f.col] != null;
    return true;
  });
  if (spec.kind === "select") {
    let out = rows.filter(match);
    if (spec.single) return { data: out[0] || null, error: out[0] || spec.maybe ? null : { message: "no rows" } };
    return { data: JSON.parse(JSON.stringify(out)), error: null };
  }
  if (spec.kind === "upsert") {
    const out = [];
    for (const p of spec.payload) {
      let r = rows.find((x) => x.stable_id === p.stable_id && x.id === p.id);
      if (!r) { r = { stable_id: p.stable_id, id: p.id }; rows.push(r); }
      Object.assign(r, p, { updated_at: tick() });
      out.push(r);
    }
    return { data: JSON.parse(JSON.stringify(out)), error: null };
  }
  if (spec.kind === "update") {
    const out = [];
    rows.filter(match).forEach((r) => {
      const patch = { ...spec.payload };
      if (patch.deleted_at && r.deleted_at == null) patch.deleted_at = tick();
      Object.assign(r, patch, { updated_at: tick() });
      out.push(r);
    });
    return { data: JSON.parse(JSON.stringify(out)), error: null };
  }
  if (spec.kind === "insert") {
    rows.push({ ...spec.payload });
    return { data: spec.payload, error: null };
  }
  return { data: null, error: { message: "unsupported" } };
}

// Mirrors supabase/review/20260927_screenshot_storage.sql for the owner.
function storageOp(op, a) {
  storageLog.push(op + " " + (a.path || (a.paths || []).join(",") || a.prefix || ""));
  if (!bucketExists) return { data: null, error: { statusCode: "404", message: "Bucket not found" } };
  if (op === "upload" && forceServerError) return { data: null, error: { statusCode: "500", message: "Internal Server Error" } };
  if (op === "upload") {
    const m = /^([^/]+)\/([A-Za-z0-9_-]{1,64})\/(full|thumb)\.jpg$/.exec(a.path);
    const live = m && m[1] === UID && db.horses.some((h) => h.stable_id === STABLE && h.id === m[2] && h.deleted_at == null);
    if (!live) return { data: null, error: { statusCode: "403", message: "new row violates row-level security policy" } };
    if (a.type !== "image/jpeg") return { data: null, error: { statusCode: "415", message: "mime type not supported" } };
    if (Buffer.from(a.b64, "base64").length > 600 * 1024) return { data: null, error: { statusCode: "413", message: "The object exceeded the maximum allowed size" } };
    storage.set(a.path, { b64: a.b64, type: a.type, updated_at: now() });
    return { data: { path: a.path }, error: null };
  }
  if (op === "download") {
    const f = storage.get(a.path);
    if (!f || !a.path.startsWith(UID + "/")) return { data: null, error: { statusCode: "400", message: "Object not found" } };
    return { data: { b64: f.b64, type: f.type }, error: null };
  }
  if (op === "remove") {
    const gone = [];
    for (const p of a.paths) if (p.startsWith(UID + "/") && storage.delete(p)) gone.push({ name: p });
    return { data: gone, error: null };
  }
  if (op === "list") {
    const prefix = a.prefix.replace(/\/$/, "") + "/";
    const names = new Map();
    for (const [p, f] of storage) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash >= 0) names.set(rest.slice(0, slash), { name: rest.slice(0, slash), id: null });
      else names.set(rest, { name: rest, id: "obj-" + p, updated_at: f.updated_at, created_at: f.updated_at });
    }
    return { data: [...names.values()], error: null };
  }
  return { data: null, error: { message: "unsupported" } };
}

// ---------- fake supabase-js loaded into the page ----------
const FAKE_CLIENT = `
<script>
(function(){
  function b64ToBlob(b64, type){ var bin = atob(b64), u = new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Blob([u], {type:type}); }
  function blobToB64(blob){ return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){ res(String(fr.result).split(",")[1]); }; fr.readAsDataURL(blob); }); }
  function builder(table){
    var spec = { table: table, kind: "select", filters: [], payload: null, single: false, maybe: false };
    var q = {
      select: function(){ if(spec.kind === "none") spec.kind = "select"; return q; },
      eq: function(c,v){ spec.filters.push({op:"eq", col:c, val:v}); return q; },
      not: function(c){ spec.filters.push({op:"notnull", col:c}); return q; },
      order: function(){ return q; }, limit: function(){ return q; },
      maybeSingle: function(){ spec.single = true; spec.maybe = true; return q; },
      single: function(){ spec.single = true; return q; },
      insert: function(p){ spec.kind = "insert"; spec.payload = p; return q; },
      upsert: function(p){ spec.kind = "upsert"; spec.payload = p; return q; },
      update: function(p){ spec.kind = "update"; spec.payload = p; return q; },
      then: function(ok, bad){ return window.__fakeDb(JSON.stringify(spec)).then(function(t){ return JSON.parse(t); }).then(ok, bad); }
    };
    return q;
  }
  var signedIn = !window.__guest;
  var user = { id: "${UID}", user_metadata: { global_name: "Tester" } };
  window.supabase = { createClient: function(){ return {
    auth: {
      getSession: function(){ return Promise.resolve({ data: { session: signedIn ? { user: user } : null } }); },
      onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; },
      signOut: function(){ signedIn = false; return Promise.resolve({ error: null }); },
      signInWithOAuth: function(){ return Promise.resolve({ error: null }); }
    },
    from: builder,
    storage: { from: function(){ return {
      upload: function(path, blob, opts){ return blobToB64(blob).then(function(b64){ return window.__fakeStorage("upload", JSON.stringify({ path: path, b64: b64, type: (opts && opts.contentType) || blob.type })); }).then(JSON.parse); },
      download: function(path){ return window.__fakeStorage("download", JSON.stringify({ path: path })).then(JSON.parse).then(function(r){ return r.error ? r : { data: b64ToBlob(r.data.b64, r.data.type), error: null }; }); },
      remove: function(paths){ return window.__fakeStorage("remove", JSON.stringify({ paths: paths })).then(JSON.parse); },
      list: function(prefix){ return window.__fakeStorage("list", JSON.stringify({ prefix: prefix })).then(JSON.parse); }
    }; } }
  }; } };
})();
</script>`;

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^>]*><\/script>/, FAKE_CLIENT);
assert.ok(html.includes("__fakeDb"), "fake client injected");

async function device(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 } });
  if (opts.guest) await ctx.addInitScript(() => { window.__guest = true; });
  await ctx.exposeBinding("__fakeDb", (_s, spec) => JSON.stringify(runQuery(JSON.parse(spec))));
  await ctx.exposeBinding("__fakeStorage", (_s, op, a) => JSON.stringify(storageOp(op, JSON.parse(a))));
  await ctx.route(ORIGIN + "/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/" || u.pathname === "/index.html") return route.fulfill({ contentType: "text/html", body: html });
    const f = path.join(ROOT, u.pathname);
    if (fs.existsSync(f)) return route.fulfill({ path: f });
    return route.fulfill({ status: 404, body: "" });
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: "" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(ORIGIN + "/");
  page.errors = errors;
  return page;
}

const waitFor = async (fn, what, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error("timed out waiting for " + what);
};
const row = (id) => db.horses.find((h) => h.id === id);
const cardFor = (page, name) => page.locator(".card", { hasText: name }).first();

async function openHorse(page, name) {
  await cardFor(page, name).click();
  await page.waitForSelector("#editor:not([hidden])");
}

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
  const imgPath = path.join(__dirname, "fixtures-tmp-horse.png");
  // A realistic-size test picture: render a busy 1920x1080 page and capture it.
  const painter = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await painter.setContent('<body style="margin:0;background:linear-gradient(45deg,#2a6,#c42,#24c,#ec4)">' + Array.from({ length: 400 }, (_, i) => `<span style="display:inline-block;width:48px;height:27px;background:hsl(${i * 37 % 360},70%,${30 + i % 40}%)"></span>`).join("") + "</body>");
  fs.writeFileSync(imgPath, await painter.screenshot());

  let pass = 0;
  const ok = (label) => { pass++; console.log("PASS  " + label); };

  // 1. Device A adds a picture; it uploads and the pointer is set only after both files exist.
  const A = await device(browser);
  await waitFor(() => A.locator(".card").count().then((n) => n === 3), "device A roster");
  await openHorse(A, "Cannoli");
  await A.setInputFiles("#screenshotFileInput", imgPath);
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.click("#saveBtn");
  await waitFor(() => row("h_one").data.screenshot && storage.has(`${UID}/h_one/full.jpg`), "upload + pointer");
  const v1 = row("h_one").data.screenshot.v;
  assert.ok(storage.has(`${UID}/h_one/thumb.jpg`));
  const fullBytes = Buffer.from(storage.get(`${UID}/h_one/full.jpg`).b64, "base64");
  assert.ok(fullBytes.length <= 500 * 1024, "full.jpg under 500 KB (" + fullBytes.length + ")");
  const dims = await A.evaluate((b64) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = "data:image/jpeg;base64," + b64; }), storage.get(`${UID}/h_one/full.jpg`).b64);
  assert.ok(Math.max(...dims) <= 1280, "full.jpg capped at 1280 px (" + dims + ")");
  const upOrder = storageLog.filter((l) => l.startsWith("upload")).map((l) => l.split("/").pop());
  assert.deepEqual(upOrder.slice(0, 2), ["thumb.jpg", "full.jpg"]);
  ok("device A upload: thumb then full, then pointer; 1280 px, " + Math.round(fullBytes.length / 1024) + " KB");

  // 2. Device B (phone size) sees the badge, downloads the thumb on open, full on tap.
  const B = await device(browser, { viewport: { width: 390, height: 844 } });
  await waitFor(() => B.locator(".card").count().then((n) => n === 3), "device B roster");
  await waitFor(() => cardFor(B, "Cannoli").locator(".badge.photo").count().then((n) => n === 1), "badge on B");
  const dlBefore = storageLog.filter((l) => l.startsWith("download")).length;
  await openHorse(B, "Cannoli");
  await B.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  assert.equal(storageLog.filter((l) => l.startsWith("download")).length - dlBefore, 1, "only thumb downloaded on open");
  await B.click("#screenshotPreview");
  await B.waitForSelector(".shot-full-overlay img");
  assert.ok(storageLog.slice(-1)[0].endsWith("full.jpg"), "full downloaded on tap");
  const noScroll = await B.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.ok(noScroll, "no horizontal scroll on phone");
  await B.screenshot({ path: path.join(__dirname, "..", "..", "shot-e2e-phone-full.png") }).catch(() => {});
  await B.click(".shot-full-overlay");
  ok("device B: badge, thumb on open, full on tap, phone layout OK");

  // 3. Soft delete keeps files; Restore brings the picture back.
  await B.click("#closeEditor");
  await A.bringToFront();
  await openHorse(A, "Cannoli");
  await A.click("#deleteBtn");
  await A.fill("#deleteConfirmName", "Cannoli");
  await A.click("#deleteBtn");
  await waitFor(() => row("h_one").deleted_at != null, "soft delete synced");
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(storage.has(`${UID}/h_one/full.jpg`), "files kept after soft delete");
  await A.evaluate(() => document.getElementById("recentlyDeletedBtn").click());
  await A.click("[data-restore-index]");
  await waitFor(() => row("h_one").deleted_at == null, "restored");
  assert.equal(row("h_one").data.screenshot.v, v1, "pointer survives delete/restore");
  await A.evaluate(() => document.getElementById("mCancel").click());
  ok("soft delete keeps files; restore keeps pointer");

  // 4. Remove on A: files deleted, pointer null; B clears its synced copy on refresh.
  await openHorse(A, "Cannoli");
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.click("#removeScreenshotBtn");
  await A.click("#saveBtn");
  await waitFor(() => row("h_one").data.screenshot === null && !storage.has(`${UID}/h_one/full.jpg`) && !storage.has(`${UID}/h_one/thumb.jpg`), "remove synced");
  await B.reload();
  await waitFor(() => B.locator(".card").count().then((n) => n === 3), "B reload");
  await waitFor(() => cardFor(B, "Cannoli").locator(".badge.photo").count().then((n) => n === 0), "B badge cleared");
  const bLocal = await B.evaluate(() => new Promise((res) => { const r = indexedDB.open("jinxStablesMedia", 1); r.onsuccess = () => { const g = r.result.transaction("screenshots").objectStore("screenshots").get("h_one"); g.onsuccess = () => res(!!g.result); }; }));
  assert.equal(bLocal, false, "B's cached copy cleared");
  ok("remove: files deleted, pointer null, other device cleared");

  // 5. Storage not set up yet (SQL not applied): picture stays queued, no error banner, no pointer.
  bucketExists = false;
  await openHorse(A, "Taffy");
  await A.setInputFiles("#screenshotFileInput", imgPath);
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.click("#saveBtn");
  await new Promise((r) => setTimeout(r, 2500));
  assert.equal(row("h_two").data.screenshot, undefined, "no pointer without storage");
  const queued = await A.evaluate((uid) => JSON.parse(localStorage.getItem("jinxStables.shotQueue.v1." + uid) || "{}"), UID);
  assert.equal(queued.h_two && queued.h_two.op, "upload", "stays queued");
  assert.equal(await A.locator("#shotSyncBanner").isHidden(), true, "no alarming banner");
  assert.equal(await cardFor(A, "Taffy").locator(".badge.photo").count(), 1, "local badge still shows");
  bucketExists = true;
  await A.reload();
  await waitFor(() => row("h_two").data.screenshot && storage.has(`${UID}/h_two/full.jpg`), "queued upload sent after storage appears");
  ok("storage not ready: stays queued quietly, uploads once available");

  // 6. Brand-new horse + picture: upload waits for the horse row.
  await A.evaluate(() => document.getElementById("addBtn").click());
  await A.waitForSelector("#qaName");
  await A.fill("#qaName", "NorWaffer");
  await A.setInputFiles("#qaScreenshotFileInput", imgPath);
  await A.waitForSelector("#qaScreenshotPreviewWrap:not([hidden])");
  await A.click("#qaSaveBtn");
  await waitFor(() => { const r = db.horses.find((h) => h.data && h.data.name === "NorWaffer"); return r && r.data.screenshot && storage.has(`${UID}/${r.id}/full.jpg`); }, "new horse upload");
  const denied = storageLog.filter((l) => l.startsWith("upload")).length;
  ok("new horse: row first, then picture (" + denied + " uploads total, none refused)");

  // 7. One-time offer for a picture that existed on a device before sync.
  const C = await device(browser);
  await waitFor(() => C.locator(".card").count().then((n) => n === 4), "device C roster");
  await C.evaluate(() => new Promise((res) => { const r = indexedDB.open("jinxStablesMedia", 1); r.onsuccess = () => { const tx = r.result.transaction("screenshots", "readwrite"); const c = document.createElement("canvas"); c.width = 1600; c.height = 900; const x = c.getContext("2d"); x.fillStyle = "#b85"; x.fillRect(0, 0, 1600, 900); tx.objectStore("screenshots").put({ horseId: "h_three", full: c.toDataURL("image/jpeg", 0.85), thumb: c.toDataURL("image/jpeg", 0.5), addedDate: "2026-09-01" }); tx.oncomplete = () => res(); }; }));
  await C.reload();
  await C.waitForSelector("#shotOfferUpload", { timeout: 15000 });
  assert.match(await C.locator("#modalBox").innerText(), /Upload 1 screenshot from this device/);
  await C.click("#shotOfferUpload");
  await waitFor(() => row("h_three").data.screenshot && storage.has(`${UID}/h_three/full.jpg`), "offered upload");
  await C.reload();
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal(await C.locator("#shotOfferUpload").count(), 0, "offer is one-time");
  ok("one-time offer: asks once, uploads only on yes");

  // 8. Orphan cleanup: purged horse's old files go; unknown-but-new files stay.
  const old = "2026-08-01T00:00:00.000Z";
  storage.set(`${UID}/h_purged/full.jpg`, { b64: "AA==", type: "image/jpeg", updated_at: old });
  storage.set(`${UID}/h_purged/thumb.jpg`, { b64: "AA==", type: "image/jpeg", updated_at: old });
  storage.set(`${UID}/h_brandnew/full.jpg`, { b64: "AA==", type: "image/jpeg", updated_at: now() });
  const D = await device(browser);
  await waitFor(() => !storage.has(`${UID}/h_purged/full.jpg`), "orphan removed", 25000);
  assert.ok(!storage.has(`${UID}/h_purged/thumb.jpg`));
  assert.ok(storage.has(`${UID}/h_brandnew/full.jpg`), "new unknown folder kept");
  assert.ok(storage.has(`${UID}/h_two/full.jpg`) && storage.has(`${UID}/h_three/full.jpg`), "live horses kept");
  ok("orphan cleanup: purged removed, fresh and live kept");

  // 8b. Retry ceiling: a picture that keeps failing stops after 12 server errors.
  forceServerError = true;
  await A.evaluate((uid) => localStorage.setItem("jinxStables.shotQueue.v1." + uid, JSON.stringify({ h_two: { op: "upload", v: "2026-09-27T09:00:00.000Z", attempts: 11, nextAt: 0 } })), UID);
  await A.reload();
  await A.waitForSelector("#shotSyncBanner:not([hidden])", { timeout: 15000 });
  assert.match(await A.locator("#shotSyncBannerText").innerText(), /Taffy.*after several tries/);
  const leftover = await A.evaluate((uid) => localStorage.getItem("jinxStables.shotQueue.v1." + uid), UID);
  assert.equal(leftover, null, "gave-up entry removed from the queue");
  forceServerError = false;
  ok("retry ceiling: gives up after 12 failures and tells the user");

  // 9. Guest mode: pictures stay on the device; no storage calls at all.
  const before = storageLog.length;
  const G = await device(browser, { guest: true });
  await G.waitForSelector("#launchSample");
  await G.click("#launchSample");
  await G.evaluate(() => document.getElementById("addBtn").click());
  await G.waitForSelector("#qaName");
  await G.fill("#qaName", "GuestHorse");
  await G.setInputFiles("#qaScreenshotFileInput", imgPath);
  await G.waitForSelector("#qaScreenshotPreviewWrap:not([hidden])");
  await G.click("#qaSaveBtn");
  await new Promise((r) => setTimeout(r, 2000));
  assert.equal(storageLog.length, before, "guest never calls storage");
  assert.equal(await cardFor(G, "GuestHorse").locator(".badge.photo").count(), 1);
  ok("guest mode: device only, no storage calls");

  for (const p of [A, B, C, D, G]) assert.deepEqual(p.errors, [], "no page errors");
  ok("no page errors on any device");
  fs.unlinkSync(imgPath);
  await browser.close();
  console.log(`screenshot sync e2e: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
