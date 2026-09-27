const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"));
const asset = fs.readFileSync(path.join(root, "public/assets/hero-titled.webp"));
const executablePath = process.env.CHROMIUM_PATH || undefined;

async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === "/assets/hero-titled.webp") {
      res.writeHead(200, { "content-type": "image/webp" });
      res.end(asset);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, executablePath });

  try {
    for (const width of [320, 375, 390, 430, 1024, 1440]) {
      const mobile = width <= 640;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        isMobile: mobile,
        hasTouch: mobile
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Explore with sample horses/ }).click();
      await page.evaluate(() => {
        horses = [];
        showingSample = false;
        markSeeded();
        persistLocalOnly();
        setLaunchOpen(false);
        renderAll();
      });
      await page.locator(mobile ? "#mobileAddFab" : "#addBtn").click();

      const initial = await page.evaluate(() => {
        const modal = document.querySelector("#modalBox");
        const footer = document.querySelector(".quick-add-actions");
        const input = document.querySelector("#qaName");
        const plus = document.querySelector("#qaLevelPlus");
        const grid = document.querySelector("#qaSkillGrid");
        const mr = modal.getBoundingClientRect();
        const fr = footer.getBoundingClientRect();
        return {
          activeId: document.activeElement && document.activeElement.id,
          inputFont: parseFloat(getComputedStyle(input).fontSize),
          touchAction: getComputedStyle(plus).touchAction,
          modalRight: mr.right,
          modalWidth: mr.width,
          modalScrollWidth: modal.scrollWidth,
          modalClientWidth: modal.clientWidth,
          footerTop: fr.top,
          footerBottom: fr.bottom,
          modalTop: mr.top,
          modalBottom: mr.bottom,
          columns: getComputedStyle(grid).gridTemplateColumns,
          scale: window.visualViewport ? window.visualViewport.scale : 1
        };
      });

      assert.ok(initial.modalRight <= width + 0.5, `${width}px: modal fits viewport`);
      assert.ok(initial.modalScrollWidth <= initial.modalClientWidth, `${width}px: no horizontal modal scroll`);
      if (mobile) {
        assert.notEqual(initial.activeId, "qaName", `${width}px: phone does not autofocus Name`);
        assert.ok(initial.inputFont >= 16, `${width}px: phone field is at least 16px`);
        assert.equal(initial.touchAction, "manipulation", `${width}px: Level + suppresses double-tap zoom`);
        assert.match(initial.columns, /px .*px/, `${width}px: Quick Add skills use two columns`);
        assert.ok(initial.footerTop >= initial.modalTop && initial.footerBottom <= initial.modalBottom + 1,
          `${width}px: Save footer is visible inside modal`);
      } else {
        assert.equal(initial.activeId, "qaName", `${width}px: desktop keeps Name autofocus`);
      }

      for (let i = 1; i < 30; i += 1) await page.locator("#qaLevelPlus").click();
      assert.equal(await page.locator("#qaLevelVal").innerText(), "30", `${width}px: rapid Level + reaches 30`);
      const afterTapsScale = await page.evaluate(() => window.visualViewport ? window.visualViewport.scale : 1);
      assert.equal(afterTapsScale, initial.scale, `${width}px: Level taps do not change scale`);

      await page.locator("#qaName").fill(`MobileTest${width}`);
      await page.locator("#qaSaveBtn").click();
      await page.getByRole("heading", { name: "Saved" }).waitFor();
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.match(await page.locator("#grid").innerText(), new RegExp(`MobileTest${width}`),
        `${width}px: saved horse survives reload`);
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("mobile Quick Add browser tests passed at 320, 375, 390, 430, 1024, and 1440px");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
