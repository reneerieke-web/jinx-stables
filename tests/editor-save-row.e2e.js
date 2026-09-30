// Browser regression test for the full horse editor's Delete / Save row.
// Opens public/index.html locally (no network, no Supabase), signed out.
//   npm i playwright   (set CHROMIUM_PATH if Chromium is not bundled)
//   node tests/editor-save-row.e2e.js
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

const FILE = "file://" + path.join(__dirname, "..", "public", "index.html");

(async () => {
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({ executablePath: exe });
  let pass = 0;
  for (const [width, height, phone] of [[320, 568, true], [390, 844, true], [430, 932, true], [1024, 768, false], [1366, 900, false]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(FILE);
    await page.waitForSelector("#launchChooser", { state: "attached" });
    await page.evaluate(() => { document.getElementById("launchChooser").hidden = true; });
    await page.evaluate((isPhone) => document.getElementById(isPhone ? "mobileAddFab" : "addBtn").click(), phone);
    await page.waitForSelector("#qaName");
    const name = "Save Row " + width;
    await page.fill("#qaName", name);
    await page.click("#qaMoreDetailsBtn");
    await page.waitForSelector("#editor:not([hidden]) #editorSaveBar");

    const r = await page.evaluate(() => {
      const ed = document.getElementById("editor"), bar = document.getElementById("editorSaveBar");
      ed.scrollTop = 0;
      const br = bar.getBoundingClientRect(), er = ed.getBoundingClientRect();
      const barOnScreen = br.top < er.bottom && br.bottom > er.top;
      const covered = barOnScreen ? [...ed.querySelectorAll("fieldset, .field, legend, .skill-toggle")]
        .filter((el) => !bar.contains(el))
        .filter((el) => { const x = el.getBoundingClientRect(); return x.height > 0 && x.bottom > br.top + 1 && x.top < br.bottom - 1; }).length : 0;
      ed.scrollTop = ed.scrollHeight;
      const end = bar.getBoundingClientRect(), edEnd = ed.getBoundingClientRect();
      const last = [...ed.children].filter((c) => c !== bar && c.offsetParent).pop().getBoundingClientRect();
      return { position: getComputedStyle(bar).position, covered, isLast: ed.lastElementChild === bar,
        visibleAtEnd: end.top >= edEnd.top && end.bottom <= edEnd.bottom + 0.5, belowContent: end.top >= last.bottom - 0.5 };
    });
    assert.equal(r.position, "static", width + "px: save row is not sticky/fixed");
    assert.equal(r.covered, 0, width + "px: save row covers no form content");
    assert.ok(r.isLast && r.belowContent, width + "px: save row is at the end of the editor");
    assert.ok(r.visibleAtEnd, width + "px: save row fully visible after scrolling to the bottom");

    await page.evaluate(() => document.getElementById("saveBtn").scrollIntoView());
    await page.click("#saveBtn");
    await page.waitForFunction(() => document.getElementById("editor").hidden);
    const stored = await page.evaluate((n) => JSON.parse(localStorage.getItem("jinxStables.horses.v2") || "[]").filter((h) => h.name === n).length, name);
    assert.equal(stored, 1, width + "px: Save stores the horse once");
    await page.locator(".card", { hasText: name }).first().click();
    await page.waitForSelector("#editor:not([hidden]) #deleteBtn");
    await page.evaluate(() => document.getElementById("deleteBtn").scrollIntoView());
    await page.click("#deleteBtn");
    await page.waitForSelector("#deleteConfirmName", { state: "visible" });
    assert.deepEqual(errors, []);
    await page.close();
    pass++;
    console.log(`PASS  ${width}px: in-flow save row, nothing covered, Save and Delete work`);
  }
  await browser.close();
  console.log(`editor save row e2e: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
