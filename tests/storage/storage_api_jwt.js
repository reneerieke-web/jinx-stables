// Local test JWTs only (fake secret; never used against Supabase).
const crypto = require("crypto");
const SECRET = "local-only-test-secret-at-least-32-characters-long";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload){ const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ iat: 1700000000, exp: 4102444800, ...payload });
  return h + "." + p + "." + crypto.createHmac("sha256", SECRET).update(h + "." + p).digest("base64url"); }
module.exports = { SECRET, sign };
if (require.main === module) console.log(JSON.stringify({ anon: sign({ role: "anon" }), service: sign({ role: "service_role" }) }));
