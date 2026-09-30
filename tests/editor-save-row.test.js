// Structural regression test: the full horse editor's Delete / Save row is
// part of the normal document flow on phones (not sticky or fixed), while
// desktop and Quick Add keep their existing rules.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");

const phoneRule = html.match(/#editorSaveBar\{[^}]*\}/g);
assert.ok(phoneRule && phoneRule.length === 1, "exactly one #editorSaveBar block rule");
assert.match(phoneRule[0], /position:static/, "phone editor save row is in normal flow");
assert.doesNotMatch(phoneRule[0], /position:(sticky|fixed)|\bbottom:0|z-index/, "no floating save row");

// The row is the last element of the editor markup, after all form sections.
assert.match(
  html,
  /'<div class="editor-actions" id="editorSaveBar">' \+\s*'<button class="btn danger" id="deleteBtn">Delete<\/button>' \+\s*'<button class="btn primary" id="saveBtn" style="margin-left:auto;">Save horse<\/button>' \+\s*'<\/div>'\s*\);/,
  "Delete and Save stay in the editor's final action row"
);

// Desktop's shared rule is unchanged.
assert.match(html, /\.editor-actions\{display:flex; flex-wrap:wrap; gap:10px; margin-top:auto; padding-top:8px; border-top:1px solid var\(--border\);\}/);

// The phone editor keeps bottom padding with the iPhone safe area.
assert.match(html, /#editor\{left:0;[^}]*padding:16px 14px calc\(88px \+ env\(safe-area-inset-bottom,0px\)\);\}/);

// Quick Add keeps its own sticky, wrapping action footer (not changed here).
assert.match(html, /quick-add-actions[^}]*position:sticky[^}]*flex-wrap:wrap/s);

console.log("editor save row structural tests passed");
