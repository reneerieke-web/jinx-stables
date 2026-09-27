// Real Supabase Storage API checks for the feedback-screenshots bucket.
// Run via tests/storage/run_storage_api_it.sh (local only, never Supabase).
// Report rows are inserted with SQL as the `authenticated` role with the same
// JWT claims PostgREST would set; every storage call goes over HTTP to the
// real storage-api server, which evaluates the RLS policies.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const { sign } = require("./storage_api_jwt.js");

const API = "http://127.0.0.1:5555";
const DB = process.env.DB || "storage_it";
const BUCKET = "feedback-screenshots";
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const tok = { A: sign({ sub: A, role: "authenticated" }), B: sign({ sub: B, role: "authenticated" }), anon: sign({ role: "anon" }), svc: sign({ role: "service_role" }) };

const sql = (q) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "5499", "-U", "postgres", "-d", DB, "-qtA", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();
function report(uid, flagged) {
  const id = crypto.randomUUID();
  sql(`begin; set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
    insert into public.feedback(id, category, message, site, has_screenshot) values ('${id}', 'bug', 'it', 'preview', ${flagged});
    commit;`);
  return id;
}
const objCount = () => Number(sql(`select count(*) from storage.objects where bucket_id='${BUCKET}'`));
const jpeg = (n = 3000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(n)]);

async function call(method, path, who, { body, type, headers = {} } = {}) {
  const h = { ...headers };
  if (who) { h.Authorization = "Bearer " + tok[who]; h.apikey = tok.anon; }
  if (type) h["Content-Type"] = type;
  if (body && !type) { h["Content-Type"] = "application/json"; body = JSON.stringify(body); }
  const res = await fetch(API + path, { method, headers: h, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString("utf8")); } catch (e) {}
  return { status: res.status, json, buf };
}
const upload = (who, name, data = jpeg(), extra = {}) =>
  call("POST", `/object/${BUCKET}/${name}`, who, { body: data, type: extra.type || "image/jpeg", headers: { "x-upsert": extra.upsert ? "true" : "false" } });

let pass = 0;
const ok = (label, detail) => { pass++; console.log("PASS  " + label + (detail ? "  [" + detail + "]" : "")); };
const denied = (r) => r.status >= 400;

(async () => {
  const R1 = report(A, true), R2 = report(A, false), RB = report(B, true), ROLD = report(A, true);
  sql(`update public.feedback set created_at = now() - interval '2 hours' where id = '${ROLD}'`);
  const p1 = `${A}/${R1}.jpg`;
  const first = jpeg();

  let r = await upload("A", p1, first);
  assert.equal(r.status, 200, "own flagged report upload: " + JSON.stringify(r.json));
  assert.equal(objCount(), 1);
  ok("A uploads its own flagged report's picture (real API, write-once insert)", "HTTP " + r.status);

  r = await upload("A", p1);
  assert.ok(denied(r)); assert.equal(objCount(), 1);
  ok("second upload to the same name is refused", `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  const duplicateShape = r.json;

  r = await upload("A", p1, jpeg(), { upsert: true });
  assert.ok(denied(r), "upsert must not overwrite");
  ok("upsert (x-upsert: true) cannot replace it", `HTTP ${r.status} ${r.json && r.json.message}`);
  r = await call("PUT", `/object/${BUCKET}/${p1}`, "A", { body: jpeg(), type: "image/jpeg" });
  assert.ok(denied(r));
  ok("PUT update cannot replace it", `HTTP ${r.status}`);

  r = await call("GET", `/object/authenticated/${BUCKET}/${p1}`, "A");
  assert.ok(denied(r)); ok("A cannot download its own picture", `HTTP ${r.status}`);
  r = await call("GET", `/object/${BUCKET}/${p1}`, "A");
  assert.ok(denied(r)); ok("A cannot download via /object/{bucket}/{path}", `HTTP ${r.status}`);
  r = await call("GET", `/object/info/authenticated/${BUCKET}/${p1}`, "A");
  assert.ok(denied(r)); ok("A cannot read object info", `HTTP ${r.status}`);
  r = await call("POST", `/object/list/${BUCKET}`, "A", { body: { prefix: A, limit: 100, offset: 0 } });
  assert.ok(denied(r) || (Array.isArray(r.json) && r.json.length === 0), "list must show nothing: " + JSON.stringify(r.json));
  ok("A cannot list its folder", `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  r = await call("POST", `/object/list/${BUCKET}`, "A", { body: { prefix: "", limit: 100, offset: 0 } });
  assert.ok(denied(r) || (Array.isArray(r.json) && r.json.length === 0));
  ok("A cannot list the bucket root", `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  r = await call("POST", `/object/sign/${BUCKET}/${p1}`, "A", { body: { expiresIn: 60 } });
  assert.ok(denied(r)); ok("A cannot create a signed download URL", `HTTP ${r.status}`);
  r = await call("POST", `/object/move`, "A", { body: { bucketId: BUCKET, sourceKey: p1, destinationKey: `${A}/moved.jpg` } });
  assert.ok(denied(r)); ok("A cannot move it", `HTTP ${r.status}`);
  r = await call("POST", `/object/copy`, "A", { body: { bucketId: BUCKET, sourceKey: p1, destinationKey: `${A}/${R2}.jpg` } });
  assert.ok(denied(r)); ok("A cannot copy it", `HTTP ${r.status}`);
  r = await call("DELETE", `/object/${BUCKET}/${p1}`, "A");
  assert.equal(objCount(), 1, "delete must not remove it");
  ok("A cannot delete it", `HTTP ${r.status}`);
  r = await call("DELETE", `/object/${BUCKET}`, "A", { body: { prefixes: [p1] } });
  assert.equal(objCount(), 1); ok("A cannot bulk-delete it", `HTTP ${r.status} ${JSON.stringify(r.json)}`);

  for (const [label, name] of [
    ["report without the screenshot flag", `${A}/${R2}.jpg`],
    ["report id that does not exist", `${A}/${crypto.randomUUID()}.jpg`],
    ["flagged report older than an hour", `${A}/${ROLD}.jpg`],
    ["B's folder", `${B}/${RB}.jpg`],
    ["B's report id in A's folder", `${A}/${RB}.jpg`],
    ["extra folder level", `${A}/x/${R1}.jpg`],
  ]) {
    r = await upload("A", name);
    assert.ok(denied(r), label); ok("A upload refused: " + label, `HTTP ${r.status}`);
  }
  r = await upload("anon", `${A}/${report(A, true)}.jpg`);
  assert.ok(denied(r)); ok("anon upload refused", `HTTP ${r.status}`);
  r = await call("POST", `/object/upload/sign/${BUCKET}/${A}/${report(A, false)}.jpg`, "A");
  assert.ok(denied(r)); ok("A cannot create a signed upload URL for an unflagged report", `HTTP ${r.status}`);

  const RA2 = report(A, true);
  r = await upload("A", `${A}/${RA2}.jpg`, jpeg(), { type: "image/png" });
  assert.ok(denied(r)); ok("non-JPEG refused by the bucket", `HTTP ${r.status} ${r.json && r.json.message}`);
  r = await upload("A", `${A}/${RA2}.jpg`, jpeg(900 * 1024));
  assert.ok(denied(r)); ok("over 800 KB refused by the bucket", `HTTP ${r.status} ${r.json && r.json.message}`);

  r = await upload("B", `${B}/${RB}.jpg`);
  assert.equal(r.status, 200); ok("B uploads its own picture", "HTTP 200");
  r = await call("GET", `/object/authenticated/${BUCKET}/${B}/${RB}.jpg`, "A");
  assert.ok(denied(r)); ok("A cannot download B's picture", `HTTP ${r.status}`);

  r = await call("GET", `/object/authenticated/${BUCKET}/${p1}`, "svc");
  assert.equal(r.status, 200); assert.ok(r.buf.equals(first), "admin gets the exact bytes");
  ok("service role (Renee's dashboard) retrieves the picture", "HTTP 200, bytes match");

  console.log("duplicate upload response for the app: " + JSON.stringify(duplicateShape));
  console.log(`storage api integration: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
