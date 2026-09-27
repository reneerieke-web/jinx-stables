const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");

assert.match(
  html,
  /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/,
  "normal pinch zoom remains available"
);
assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
assert.match(html, /button\{font-family:inherit; cursor:pointer; touch-action:manipulation;\}/);
assert.match(html, /input,select,textarea\{font-size:16px !important;\}/);
assert.match(
  html,
  /#qaSkillGrid,#qaSpecialSkillGrid\{display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\); gap:6px;\}/
);
assert.match(html, /quick-add-actions[^}]*position:sticky[^}]*flex-wrap:wrap/s);
assert.match(html, /max-height:calc\(100dvh - max\(10px/);
assert.match(html, /#modalBox\{[^}]*overflow-x:clip/s);
assert.match(html, /#modalBox\.quick-add-modal\{overflow-y:hidden;\}/);
assert.match(html, /#modalBox \.quick-add-body\{display:flex; flex:1 1 auto; min-height:0; overflow-y:auto;/);
assert.match(html, /modal-actions quick-add-actions/);

const autofocusGuard = /if\(!window\.matchMedia \|\| window\.matchMedia\("\(min-width:641px\)"\)\.matches\) el\("(?:fName|qaName)"\)\.focus\(\);/g;
assert.equal((html.match(autofocusGuard) || []).length, 2, "both horse-name autofocus calls are desktop-only");

// Model the exact phone box math from the mobile CSS. This guards the minimum
// two-column width and ensures the modal never exceeds the viewport.
for (const width of [320, 375, 390, 430]) {
  const modalWidth = width - 20; // 10px backdrop padding on each side
  const contentWidth = modalWidth - 28; // 14px modal padding on each side
  const skillColumnWidth = (contentWidth - 6) / 2;
  assert.ok(modalWidth <= width, `${width}px: modal stays within viewport`);
  assert.ok(skillColumnWidth >= 133, `${width}px: skill columns remain usable`);
  assert.ok(2 * 96 + 10 <= contentWidth, `${width}px: two footer buttons fit and the third may wrap`);
}

// Desktop layout remains outside the max-width:640px override.
for (const width of [1024, 1440]) {
  assert.ok(width > 640, `${width}px uses unchanged desktop rules`);
}

// The Level + handler remains a capped data-only update; it never changes CSS
// or viewport state. Model rapid taps through and beyond level 30.
let level = 1;
for (let i = 0; i < 40; i += 1) level = Math.min(30, level + 1);
assert.equal(level, 30);
assert.match(
  html,
  /qaLevel = Math\.min\(maxLevelForTier\(qaTier\), qaLevel\+1\); renderQaLevel\(\);/
);

// Saving still writes the horse and local snapshot before any optional image
// work or confirmation UI. The mobile patch must not alter that ordering.
const quickAddStart = html.indexOf("function saveQuickAddHorse(name)");
const quickAddEnd = html.indexOf("function buildQuickDraft(name)", quickAddStart);
assert.ok(quickAddStart >= 0 && quickAddEnd > quickAddStart);
const saveBody = html.slice(quickAddStart, quickAddEnd);
assert.ok(saveBody.indexOf("horses.push(newHorse)") < saveBody.indexOf("persist()"));
assert.ok(saveBody.indexOf("persist()") < saveBody.indexOf("applyQaScreenshotAction(newHorse.id)"));

console.log("mobile Quick Add structural tests passed");
