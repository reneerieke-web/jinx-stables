// End-to-end test of screenshot sync against an in-memory fake Supabase.
// Nothing here talks to the real project. Browser contexts act as separate
// devices signed in to the same account; one more checks guest mode.
//
// The fake mirrors supabase/review/20260927_screenshot_storage.sql
// (revision 2: owner folder, live horse, fixed full.jpg/thumb.jpg,
// 600 KB, image/jpeg) and PostgREST's 1,000-row response cap.
//
//   npm i playwright   (needs a Chromium; set CHROMIUM_PATH if not bundled)
//   node tests/screenshot-sync.e2e.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "public");
const ORIGIN = "http://jinx.test";
const UID = "11111111-1111-4111-8111-111111111111";
const STABLE = "22222222-2222-4222-8222-222222222222";
const MAX_ROWS = 1000;

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
const makeRow = (id, name, tier = "6", sex = "Female", level = 1) =>
  ({ stable_id: STABLE, id, data: horseData(id, name, tier, sex, level), updated_at: now(), deleted_at: null });
const db = {
  horses: [makeRow("h_one", "Cannoli", "8", "Male", 15), makeRow("h_two", "Taffy", "7", "Female", 16), makeRow("h_three", "NillaCrumpet", "6", "Female", 9)],
  stables: [{ id: STABLE, owner_id: UID, name: "Test Stable" }],
  feedback: [],
};
const storage = new Map(); // path -> {b64, type, updated_at}
let bucketExists = true;
// Feedback screenshots (supabase/review/20260927_feedback_screenshots.sql).
let feedbackShotsSql = true;      // false = SQL not applied yet (old column grant)
let feedbackShotFail = false;     // force the picture upload to fail
const feedbackFiles = new Map();  // path -> {bytes, type}
const feedbackOps = [];
let forceServerError = false;
const storageLog = [];
const guestStorageCalls = []; // storage calls made by guest pages only
const edgeCache = new Map();
const rangeLog = [];
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
    if (spec.order) out = out.slice().sort((a, b) => (a[spec.order] < b[spec.order] ? -1 : a[spec.order] > b[spec.order] ? 1 : 0));
    if (spec.range) { rangeLog.push(spec.range.join("-")); out = out.slice(spec.range[0], spec.range[1] + 1); }
    out = out.slice(0, MAX_ROWS); // PostgREST default max rows
    if (/shot:data->screenshot/.test(spec.columns || "")) out = out.map((r) => ({ id: r.id, shot: r.data && r.data.screenshot !== undefined ? r.data.screenshot : null }));
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
    if (spec.table === "feedback") {
      // Mirrors supabase/review/20260927_feedback.sql: insert-only, content columns only, no read-back.
      const allowed = ["category", "message", "doing", "site", "app_build", "user_agent", "viewport"].concat(feedbackShotsSql ? ["id", "has_screenshot"] : []);
      if (Object.keys(spec.payload).some((k) => !allowed.includes(k))) return { data: null, error: { code: "42501", message: "permission denied for table feedback" } };
      if (spec.columns) return { data: null, error: { code: "42501", message: "permission denied for table feedback" } };
      const id = spec.payload.id || ("gen-" + rows.length);
      if (rows.some((r) => r.id === id)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"feedback_pkey\"" } };
      const has = !!spec.payload.has_screenshot;
      if (has && rows.filter((r) => r.has_screenshot).length >= 5) return { data: null, error: { code: "P0001", message: "Feedback screenshot limit reached: at most 5 screenshots per day." } };
      rows.push({ ...spec.payload, id, has_screenshot: has, screenshot_path: has ? `${UID}/${id}.jpg` : null, user_id: UID, status: "new" });
      return { data: null, error: null };
    }
    rows.push({ ...spec.payload }); return { data: spec.payload, error: null };
  }
  return { data: null, error: { message: "unsupported" } };
}

function feedbackStorageOp(op, a) {
  feedbackOps.push(op + " " + (a.path || ""));
  if (op !== "upload") return { data: null, error: { statusCode: "403", message: "new row violates row-level security policy" } };
  if (!feedbackShotsSql) return { data: null, error: { statusCode: "404", message: "Bucket not found" } };
  if (feedbackShotFail) return { data: null, error: { statusCode: "500", message: "Internal Server Error" } };
  const fb = db.feedback.find((r) => r.has_screenshot && r.screenshot_path === a.path && r.user_id === UID);
  if (!fb || !a.path.startsWith(UID + "/")) return { data: null, error: { statusCode: "403", message: "new row violates row-level security policy" } };
  if (feedbackFiles.has(a.path)) return { data: null, error: { statusCode: "409", message: "The resource already exists" } };
  if (a.type !== "image/jpeg") return { data: null, error: { statusCode: "415", message: "mime type not supported" } };
  const bytes = Buffer.from(a.b64, "base64");
  if (bytes.length > 800 * 1024) return { data: null, error: { statusCode: "413", message: "The object exceeded the maximum allowed size" } };
  feedbackFiles.set(a.path, { bytes, type: a.type });
  return { data: { path: a.path }, error: null };
}

function storageOp(op, a) {
  if (a.bucket === "feedback-screenshots") return feedbackStorageOp(op, a);
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
    // Emulate a browser/CDN cache keyed by request URL: a repeated URL gets
    // whatever bytes were first served for it, even after an overwrite.
    // This is the real-world stale-picture bug from Renee's PralineKnot test.
    const key = a.path + "?" + (a.cacheNonce == null ? "" : a.cacheNonce);
    if (!edgeCache.has(key)) edgeCache.set(key, { b64: f.b64, type: f.type });
    const hit = edgeCache.get(key);
    return { data: { b64: hit.b64, type: hit.type }, error: null };
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
const filesOf = (id) => [...storage.keys()].filter((p) => p.startsWith(`${UID}/${id}/`)).map((p) => p.split("/").pop()).sort();
const PAIR = ["full.jpg", "thumb.jpg"];

// ---------- fake supabase-js loaded into the page ----------
const FAKE_CLIENT = `
<script>
(function(){
  function b64ToBlob(b64, type){ var bin = atob(b64), u = new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Blob([u], {type:type}); }
  function blobToB64(blob){ return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){ res(String(fr.result).split(",")[1]); }; fr.readAsDataURL(blob); }); }
  function builder(table){
    var spec = { table: table, kind: "select", filters: [], payload: null, single: false, maybe: false, columns: "", order: null, range: null };
    var q = {
      select: function(cols){ spec.columns = cols || ""; return q; },
      eq: function(c,v){ spec.filters.push({op:"eq", col:c, val:v}); return q; },
      not: function(c){ spec.filters.push({op:"notnull", col:c}); return q; },
      order: function(c){ spec.order = c; return q; },
      range: function(a,b){ spec.range = [a,b]; return q; },
      limit: function(){ return q; },
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
    storage: { from: function(bucket){ return {
      upload: function(path, blob, opts){ return blobToB64(blob).then(function(b64){ return window.__fakeStorage("upload", JSON.stringify({ bucket: bucket, path: path, b64: b64, type: (opts && opts.contentType) || blob.type, upsert: !!(opts && opts.upsert) })); }).then(JSON.parse); },
      download: function(path, opts){ return window.__fakeStorage("download", JSON.stringify({ bucket: bucket, path: path, cacheNonce: opts && opts.cacheNonce != null ? String(opts.cacheNonce) : null })).then(JSON.parse).then(function(r){ return r.error ? r : { data: b64ToBlob(r.data.b64, r.data.type), error: null }; }); },
      remove: function(paths){ return window.__fakeStorage("remove", JSON.stringify({ bucket: bucket, paths: paths })).then(JSON.parse); },
      list: function(prefix){ return window.__fakeStorage("list", JSON.stringify({ bucket: bucket, prefix: prefix })).then(JSON.parse); }
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
  await ctx.exposeBinding("__fakeStorage", (_s, op, a) => { if (opts.guest) guestStorageCalls.push(op); return JSON.stringify(storageOp(op, JSON.parse(a))); });
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, what, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(150); }
  throw new Error("timed out waiting for " + what);
};
const row = (id) => db.horses.find((h) => h.id === id);
const ptr = (id) => row(id).data.screenshot;
const cardFor = (page, name) => page.locator(".card", { hasText: name }).first();
const localRec = (page, id) => page.evaluate((hid) => new Promise((res) => { const r = indexedDB.open("jinxStablesMedia", 1); r.onsuccess = () => { const g = r.result.transaction("screenshots").objectStore("screenshots").get(hid); g.onsuccess = () => res(g.result || null); }; }), id);
const putLocal = (page, id, color, cloudV) => page.evaluate(({ hid, color, cloudV }) => new Promise((res) => { const c = document.createElement("canvas"); c.width = 1600; c.height = 900; const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 1600, 900); const r = indexedDB.open("jinxStablesMedia", 1); r.onsuccess = () => { const tx = r.result.transaction("screenshots", "readwrite"); const rec = { horseId: hid, full: c.toDataURL("image/jpeg", 0.85), thumb: c.toDataURL("image/jpeg", 0.5), addedDate: "2026-09-01" }; if (cloudV) rec.cloudV = cloudV; tx.objectStore("screenshots").put(rec); tx.oncomplete = () => res(); }; }), { hid: id, color, cloudV });
const queueOf = (page) => page.evaluate((uid) => JSON.parse(localStorage.getItem("jinxStables.shotQueue.v1." + uid) || "{}"), UID);

async function openHorse(page, name) {
  await cardFor(page, name).click();
  await page.waitForSelector("#editor:not([hidden])");
}

(async () => {
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({ executablePath: exe });
  const imgPath = path.join(__dirname, "fixtures-tmp-horse.png");
  const img2Path = path.join(__dirname, "fixtures-tmp-horse2.png");
  const painter = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const paint = async (seed) => {
    await painter.setContent('<body style="margin:0;background:linear-gradient(45deg,#2a6,#c42,#24c,#ec4)">' + Array.from({ length: 400 }, (_, i) => `<span style="display:inline-block;width:48px;height:27px;background:hsl(${(i * 37 + seed) % 360},70%,${30 + i % 40}%)"></span>`).join("") + "</body>");
    return painter.screenshot();
  };
  fs.writeFileSync(imgPath, await paint(0));
  fs.writeFileSync(img2Path, await paint(180));

  let pass = 0;
  const ok = (label) => { pass++; console.log("PASS  " + label); };

  // 1. Device A adds a picture: versioned pair uploads, then the pointer names it.
  const A = await device(browser);
  await waitFor(() => A.locator(".card").count().then((n) => n === 3), "device A roster");
  await openHorse(A, "Cannoli");
  await A.setInputFiles("#screenshotFileInput", imgPath);
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.click("#saveBtn");
  await waitFor(() => ptr("h_one") && filesOf("h_one").length === 2, "upload + pointer");
  const v1 = ptr("h_one").v;
  assert.deepEqual(filesOf("h_one"), PAIR, "files are the pointer's version");
  const fullBytes = Buffer.from(storage.get(`${UID}/h_one/full.jpg`).b64, "base64");
  assert.ok(fullBytes.length <= 500 * 1024, "full under 500 KB");
  const dims = await A.evaluate((b64) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = "data:image/jpeg;base64," + b64; }), storage.get(`${UID}/h_one/full.jpg`).b64);
  assert.ok(Math.max(...dims) <= 1280, "full capped at 1280 px");
  const ups = storageLog.filter((l) => l.startsWith("upload")).map((l) => l.split("/").pop());
  assert.deepEqual(ups.slice(0, 2), ["thumb.jpg", "full.jpg"]);
  ok("device A: thumb then full, then pointer");

  // 2. Device B (phone) shows the badge, downloads that version's thumb on open, full on tap.
  const B = await device(browser, { viewport: { width: 390, height: 844 } });
  await waitFor(() => B.locator(".card").count().then((n) => n === 3), "device B roster");
  await waitFor(() => cardFor(B, "Cannoli").locator(".badge.photo").count().then((n) => n === 1), "badge on B");
  const dl0 = storageLog.filter((l) => l.startsWith("download")).length;
  await openHorse(B, "Cannoli");
  await B.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  const dls = storageLog.filter((l) => l.startsWith("download")).slice(dl0);
  assert.deepEqual(dls.map((l) => l.split("/").pop()), ["thumb.jpg"], "only the thumb on open");
  await B.click("#screenshotPreview");
  await B.waitForSelector(".shot-full-overlay img");
  assert.ok(storageLog.slice(-1)[0].endsWith("h_one/full.jpg"), "full on tap");
  assert.ok(await B.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll on phone");
  await B.click(".shot-full-overlay");
  await B.click("#closeEditor");
  ok("device B: badge, thumb on open, full on tap, phone layout OK");

  // 3. Replace on A: files overwritten, pointer moves, other device refreshes its copy.
  await openHorse(A, "Cannoli");
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.setInputFiles("#screenshotFileInput", img2Path);
  await sleep(500);
  await A.click("#saveBtn");
  await waitFor(() => ptr("h_one") && ptr("h_one").v !== v1, "new pointer");
  const v2 = ptr("h_one").v;
  assert.deepEqual(filesOf("h_one"), PAIR, "still exactly two files");
  const dlBeforeReplace = storageLog.filter((l) => l.startsWith("download")).length;
  await B.reload();
  await waitFor(() => B.locator(".card").count().then((n) => n === 3), "B reload");
  await openHorse(B, "Cannoli");
  await B.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  assert.equal(storageLog.filter((l) => l.startsWith("download")).length, dlBeforeReplace + 1, "B re-fetched after the pointer changed");
  assert.equal((await localRec(B, "h_one")).cloudV, v2, "B's copy now matches the new pointer");
  const bThumb = (await localRec(B, "h_one")).thumb.split(",")[1];
  assert.equal(bThumb, storage.get(`${UID}/h_one/thumb.jpg`).b64, "B shows the NEW picture, not a cached old one");
  await B.click("#closeEditor");
  ok("replace: files overwritten, pointer moved, other device shows the new picture despite caching");

  // 3b. A copy saved before versioned downloads (no cacheScheme) that holds old
  // bytes under the current version is re-fetched once (the PralineKnot case).
  await putLocal(B, "h_one", "#00ff00", v2); // wrong picture labelled with the current version
  await B.reload();
  await waitFor(() => B.locator(".card").count().then((n) => n === 3), "B reload 2");
  await openHorse(B, "Cannoli");
  await B.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await waitFor(async () => { const rec = await localRec(B, "h_one"); return rec && rec.cacheScheme === 2; }, "poisoned copy re-fetched");
  assert.equal((await localRec(B, "h_one")).thumb.split(",")[1], storage.get(`${UID}/h_one/thumb.jpg`).b64, "poisoned copy replaced by the real picture");
  await B.click("#closeEditor");
  ok("old-format cached copy is re-checked once and corrected");

  // 4. Soft delete keeps files; Restore keeps the pointer.
  await openHorse(A, "Cannoli");
  await A.click("#deleteBtn");
  await A.fill("#deleteConfirmName", "Cannoli");
  await A.click("#deleteBtn");
  await waitFor(() => row("h_one").deleted_at != null, "soft delete synced");
  await sleep(1500);
  assert.deepEqual(filesOf("h_one"), PAIR, "files kept after soft delete");
  await A.evaluate(() => document.getElementById("recentlyDeletedBtn").click());
  await A.click("[data-restore-index]");
  await waitFor(() => row("h_one").deleted_at == null, "restored");
  assert.equal(ptr("h_one").v, v2);
  await A.evaluate(() => document.getElementById("mCancel").click());
  ok("soft delete keeps files; restore keeps pointer");

  // 5. Remove on A: every version deleted, pointer null; B clears its synced copy.
  await openHorse(A, "Cannoli");
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.click("#removeScreenshotBtn");
  await A.click("#saveBtn");
  await waitFor(() => ptr("h_one") === null && filesOf("h_one").length === 0, "remove synced");
  await B.reload();
  await waitFor(() => B.locator(".card").count().then((n) => n === 3), "B reload");
  await waitFor(() => cardFor(B, "Cannoli").locator(".badge.photo").count().then((n) => n === 0), "B badge cleared");
  assert.equal(await localRec(B, "h_one"), null, "B's cached copy cleared");
  ok("remove: files deleted, pointer null, other device cleared");

  // 6. Storage not set up yet: queued quietly, uploads once available.
  bucketExists = false;
  await openHorse(A, "Taffy");
  await A.setInputFiles("#screenshotFileInput", imgPath);
  await A.waitForSelector("#screenshotPreviewWrap:not([hidden])");
  await A.click("#saveBtn");
  await sleep(2500);
  assert.equal(ptr("h_two"), undefined, "no pointer without storage");
  assert.equal((await queueOf(A)).h_two.op, "upload", "stays queued");
  assert.equal(await A.locator("#shotSyncBanner").isHidden(), true, "no banner");
  await openHorse(A, "Taffy");
  await A.waitForSelector("#screenshotSyncState:not([hidden])");
  assert.match(await A.locator("#screenshotSyncState").innerText(), /saved on this device only until syncing succeeds/);
  await A.click("#closeEditor");
  bucketExists = true;
  await A.reload();
  await waitFor(() => ptr("h_two") && filesOf("h_two").length === 2, "queued upload sent");
  ok("storage not ready: stays queued quietly, uploads once available");

  // 7. Brand-new horse with a picture: horse row first, then files.
  await A.evaluate(() => document.getElementById("addBtn").click());
  await A.waitForSelector("#qaName");
  await A.fill("#qaName", "NorWaffer");
  await A.setInputFiles("#qaScreenshotFileInput", imgPath);
  await A.waitForSelector("#qaScreenshotPreviewWrap:not([hidden])");
  await A.click("#qaSaveBtn");
  await waitFor(() => { const r = db.horses.find((h) => h.data && h.data.name === "NorWaffer"); return r && r.data.screenshot && filesOf(r.id).length === 2; }, "new horse upload");
  ok("new horse: row first, then picture");

  // 8. Permanent failure never loses the local picture to an older cloud copy (Codex finding 2).
  const cloudV2 = ptr("h_two").v;
  await putLocal(A, "h_two", "#ff00aa", null); // a replacement picture, not yet uploaded
  await A.evaluate(({ uid }) => localStorage.setItem("jinxStables.shotQueue.v1." + uid, JSON.stringify({ h_two: { op: "upload", v: "fixrepl1", attempts: 11, nextAt: 0 } })), { uid: UID });
  forceServerError = true;
  await A.reload();
  await A.waitForSelector("#shotSyncBanner:not([hidden])", { timeout: 15000 });
  assert.match(await A.locator("#shotSyncBannerText").innerText(), /Taffy.*after several tries.*won’t be replaced/);
  assert.equal((await queueOf(A)).h_two.failed, "gaveup", "failed marker kept");
  const dlBeforeOpen = storageLog.filter((l) => l.startsWith("download")).length;
  await openHorse(A, "Taffy");
  await A.waitForSelector("#shotRetryBtn");
  assert.match(await A.locator("#screenshotSyncState").innerText(), /Clearing browser\/site data may remove it/);
  await sleep(800);
  assert.equal(storageLog.filter((l) => l.startsWith("download")).length, dlBeforeOpen, "no cloud download over the local picture");
  const kept = await localRec(A, "h_two");
  assert.ok(kept && !kept.cloudV && kept.full, "local replacement still there");
  assert.equal(ptr("h_two").v, cloudV2, "cloud pointer untouched");
  forceServerError = false;
  await A.click("#shotRetryBtn");
  await waitFor(() => ptr("h_two").v === "fixrepl1" && JSON.stringify(filesOf("h_two")) === JSON.stringify(PAIR), "retry uploads");
  await A.click("#closeEditor");
  ok("permanent failure: marked, local picture protected, Try again uploads");

  // 9. One-time offer for a picture that existed on a device before sync.
  const C = await device(browser);
  await waitFor(() => C.locator(".card").count().then((n) => n === 4), "device C roster");
  await putLocal(C, "h_three", "#bb8855", null);
  await C.reload();
  await C.waitForSelector("#shotOfferUpload", { timeout: 15000 });
  assert.match(await C.locator("#modalBox").innerText(), /Upload 1 screenshot from this device/);
  await C.click("#shotOfferUpload");
  await waitFor(() => ptr("h_three") && filesOf("h_three").length === 2, "offered upload");
  await C.reload();
  await sleep(3000);
  assert.equal(await C.locator("#shotOfferUpload").count(), 0, "offer is one-time");
  ok("one-time offer: asks once, uploads only on yes");

  // 10. Cleanup with more than 1,000 horses (Codex finding 1): paginated, nothing valid deleted.
  const old = "2026-08-01T00:00:00.000Z";
  for (let i = 0; i < 1100; i++) db.horses.push(makeRow("x" + String(i).padStart(4, "0"), "Filler " + i));
  const late = makeRow("zz_late", "LateHorse");
  late.data.screenshot = { v: "latev1" };
  db.horses.push(late); // sorts after 1,100 fillers: only visible on page 2
  const put = (p, iso) => storage.set(`${UID}/${p}`, { b64: "AA==", type: "image/jpeg", updated_at: iso });
  put("zz_late/full.jpg", old); put("zz_late/thumb.jpg", old);   // known horse on page 2: stays
  put("h_purged/full.jpg", old); put("h_purged/thumb.jpg", old); // purged horse: goes
  put("h_brandnew/full.jpg", now());                             // unknown but fresh: stays
  rangeLog.length = 0;
  const D = await device(browser);
  await waitFor(() => !storage.has(`${UID}/h_purged/full.jpg`), "orphan removed", 25000);
  await sleep(500);
  assert.deepEqual(filesOf("zz_late"), PAIR, "page-2 horse's picture kept");
  assert.equal(filesOf("h_purged").length, 0, "purged horse's files removed");
  assert.ok(rangeLog.includes("0-999") && rangeLog.includes("1000-1999"), "horse ids paged with range(): " + rangeLog.join(","));
  assert.ok(storage.has(`${UID}/h_brandnew/full.jpg`), "fresh unknown folder kept");
  assert.equal(filesOf("h_two").length, 2, "live horses kept");
  db.horses = db.horses.filter((h) => !/^x\d{4}$/.test(h.id) && h.id !== "zz_late");
  ok("cleanup: pages past 1,000 rows, keeps valid pictures, removes purged horses' files");

  // 10b. Send feedback: insert-only, no read-back, auto context.
  await A.evaluate(() => document.getElementById("feedbackBtn").click());
  await A.waitForSelector("#fbMessage");
  await A.click('input[name="fbCat"][value="confusing"]');
  await A.fill("#fbMessage", "Could not find the delete button <b>at first</b>");
  await A.fill("#fbDoing", "editing Taffy");
  await A.click("#fbSend");
  await A.waitForSelector("text=Your feedback was sent.");
  const fb = db.feedback[0];
  assert.equal(db.feedback.length, 1);
  assert.equal(fb.category, "confusing");
  assert.equal(fb.message, "Could not find the delete button <b>at first</b>");
  assert.equal(fb.doing, "editing Taffy");
  assert.equal(fb.site, "other", "jinx.test test host is neither production nor preview");
  assert.ok(fb.user_agent && fb.viewport, "device context captured");
  await A.click("#mCancel");
  ok("feedback: sent with category, text and device context; insert-only");

  // 10c. Feedback with a screenshot: compressed on device, text saved first,
  // then one JPEG at {uid}/{report id}.jpg. Big 3200x2000 PNG input.
  const bigPng = path.join(__dirname, "fixtures-tmp-feedback.png");
  const bigPainter = await (await browser.newContext({ viewport: { width: 3200, height: 2000 } })).newPage();
  await bigPainter.setContent('<body style="margin:0;background:linear-gradient(135deg,#123,#c42,#2c6,#fd4)">' + Array.from({ length: 2000 }, (_, i) => `<span style="display:inline-block;width:64px;height:40px;background:hsl(${(i * 53) % 360},80%,${25 + i % 50}%)"></span>`).join("") + "</body>");
  fs.writeFileSync(bigPng, await bigPainter.screenshot());
  await bigPainter.close();
  const openFb = async () => { await A.evaluate(() => document.getElementById("feedbackBtn").click()); await A.waitForSelector("#fbMessage"); };
  await openFb();
  assert.ok(await A.isVisible("#fbShotAdd"), "Add screenshot button shown");
  assert.equal(await A.isVisible("#fbShotPreview"), false);
  assert.ok(/attach a screenshot right here/.test(await A.textContent("#modalBox")), "new wording");
  assert.ok(!/Send it to Renee on Discord/.test(await A.textContent("#modalBox")), "old Discord wording gone");
  await A.setInputFiles("#fbShotInput", bigPng);
  await A.waitForSelector("#fbShotPreview:not([hidden])");
  await A.click("#fbShotRemove");
  assert.equal(await A.isVisible("#fbShotPreview"), false, "Remove clears the preview");
  assert.ok(await A.isVisible("#fbShotAdd"));
  await A.setInputFiles("#fbShotInput", imgPath);
  await A.waitForSelector("#fbShotPreview:not([hidden])");
  await A.setInputFiles("#fbShotInput", bigPng); // Replace
  await A.waitForFunction(() => /^data:image\/jpeg/.test(document.getElementById("fbShotImg").src));
  await A.fill("#fbMessage", "The level buttons overlap on my phone");
  await A.click("#fbSend");
  await A.waitForSelector("text=Your feedback and screenshot were sent.");
  const fbShotRow = db.feedback[db.feedback.length - 1];
  assert.equal(fbShotRow.has_screenshot, true);
  assert.match(fbShotRow.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const shotFile = feedbackFiles.get(`${UID}/${fbShotRow.id}.jpg`);
  assert.ok(shotFile, "picture stored at {uid}/{report id}.jpg");
  assert.equal(shotFile.type, "image/jpeg");
  assert.equal(shotFile.bytes[0], 0xff, "JPEG bytes");
  assert.ok(shotFile.bytes.length <= 800 * 1024, "within the 800 KB bucket limit: " + shotFile.bytes.length);
  assert.ok(!("screenshot" in fbShotRow) && !JSON.stringify(fbShotRow).includes("base64"), "no image data in the feedback row");
  await A.click("#mCancel");
  ok(`feedback screenshot: add/remove/replace, compressed (${Math.round(shotFile.bytes.length / 1024)} KB JPEG), stored by report id`);

  // 10d. Upload fails: the text is kept, Try again finishes the picture.
  feedbackShotFail = true;
  await openFb();
  await A.setInputFiles("#fbShotInput", imgPath);
  await A.waitForSelector("#fbShotPreview:not([hidden])");
  await A.fill("#fbMessage", "Picture upload will fail first");
  await A.click("#fbSend");
  await A.waitForSelector("text=Your written feedback was saved.");
  const failedRow = db.feedback[db.feedback.length - 1];
  assert.equal(failedRow.message, "Picture upload will fail first", "text saved despite the failed picture");
  assert.equal(feedbackFiles.has(`${UID}/${failedRow.id}.jpg`), false);
  await A.click("#fbShotRetry");
  await A.waitForSelector("text=You can keep trying for about an hour");
  feedbackShotFail = false;
  await A.click("#fbShotRetry");
  await A.waitForSelector("text=Your feedback and screenshot were sent.");
  assert.ok(feedbackFiles.has(`${UID}/${failedRow.id}.jpg`), "retry stored the picture for the same report");
  assert.equal(db.feedback.filter((r) => r.message === "Picture upload will fail first").length, 1, "no duplicate report on retry");
  await A.click("#mCancel");
  ok("feedback screenshot failure: text kept, Try again uploads to the same report");

  // 10e. SQL not applied yet: text still goes through, user told to use Discord.
  feedbackShotsSql = false;
  const beforeRows = db.feedback.length;
  await openFb();
  await A.setInputFiles("#fbShotInput", imgPath);
  await A.waitForSelector("#fbShotPreview:not([hidden])");
  await A.fill("#fbMessage", "Before the screenshot SQL");
  await A.click("#fbSend");
  await A.waitForSelector("text=Screenshots can't be attached yet");
  assert.equal(db.feedback.length, beforeRows + 1);
  const plainRow = db.feedback[db.feedback.length - 1];
  assert.equal(plainRow.message, "Before the screenshot SQL");
  assert.equal(plainRow.has_screenshot, false);
  await A.click("#mCancel");
  feedbackShotsSql = true;
  assert.ok(feedbackOps.every((o) => o.startsWith("upload ")), "app never lists, downloads or deletes feedback pictures: " + feedbackOps.join(","));
  ok("feedback before the SQL is applied: text sent, clear screenshot message; upload-only access");


  // 11. Guest mode: device only, no storage calls.
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
  await sleep(2000);
  // Signed-in test devices may still run their scheduled cleanup meanwhile,
  // so count only the guest page's own storage calls.
  assert.deepEqual(guestStorageCalls, [], "guest never calls storage");
  assert.equal(await cardFor(G, "GuestHorse").locator(".badge.photo").count(), 1);
  const feedbackBeforeGuest = db.feedback.length;
  await G.evaluate(() => document.getElementById("feedbackBtn").click());
  await G.waitForSelector("text=Sign in with Discord to send feedback");
  assert.equal(await G.locator("#fbShotAdd").count(), 0, "guest gets no screenshot control");
  assert.equal(db.feedback.length, feedbackBeforeGuest, "guest cannot submit feedback");
  ok("guest mode: device only, no storage calls");

  // 12. Feedback layout at phone widths with a picture attached. Runs last:
  //     these signed-in devices do their own startup cleanup calls.
  for (const width of [320, 390]) {
    const Pn = await device(browser, { viewport: { width, height: 740 } });
    await Pn.waitForSelector("#feedbackBtn", { state: "attached" });
    await Pn.evaluate(() => document.getElementById("feedbackBtn").click());
    await Pn.waitForSelector("#fbMessage");
    await Pn.setInputFiles("#fbShotInput", bigPng);
    await Pn.waitForSelector("#fbShotPreview:not([hidden])");
    const lay = await Pn.evaluate(() => {
      const box = document.getElementById("modalBox"), img = document.getElementById("fbShotImg").getBoundingClientRect();
      const btns = ["fbShotReplace", "fbShotRemove", "fbSend", "mCancel"].map((i) => document.getElementById(i).getBoundingClientRect());
      return { overflow: box.scrollWidth > box.clientWidth + 1, doc: document.documentElement.scrollWidth, imgW: img.width, right: Math.max(img.right, ...btns.map((b) => b.right)) };
    });
    assert.equal(lay.overflow, false, width + "px: modal has no sideways overflow");
    assert.ok(lay.doc <= width, width + "px: page has no sideways scroll");
    assert.ok(lay.right <= width, width + "px: preview and buttons fit: " + JSON.stringify(lay));
    const sendReach = await Pn.evaluate(() => { const b = document.getElementById("fbSend"); b.scrollIntoView({ block: "nearest" }); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    assert.ok(sendReach, width + "px: Send button reachable by scrolling the form");
    await Pn.screenshot({ path: path.join(__dirname, `fixtures-tmp-feedback-${width}.png`) });
    assert.deepEqual(Pn.errors, []);
    await Pn.context().close();
  }
  fs.unlinkSync(bigPng);
  ok("feedback screenshot layout fits at 320 and 390 px");
  for (const p of [A, B, C, D, G]) assert.deepEqual(p.errors, [], "no page errors");
  ok("no page errors on any device");
  fs.unlinkSync(imgPath); fs.unlinkSync(img2Path);
  await browser.close();
  console.log(`screenshot sync e2e: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
