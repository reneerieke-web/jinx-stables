const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");
const plan = fs.readFileSync("docs/design-lab-plan.md", "utf8");

assert.match(html, /<div class="[^"]*desktop-only[^"]*" id="desktopRosterViewSwitch"/);
assert.match(html, /id="currentRosterViewBtn" aria-pressed="true">Current roster</);
assert.match(html, /id="designLabViewBtn" aria-pressed="false">Design Lab</);
assert.match(html, /@media \(max-width:640px\)[\s\S]*?\.desktop-only\{display:none;\}/);
assert.match(html, /var desktopRosterViewMode = "current";/, "Current Roster remains the default control");
assert.match(html, /window\.matchMedia\("\(min-width: 641px\)"\)/);
assert.match(html, /if\(!designLabDesktopMedia\.matches\) desktopRosterViewMode = "current";/);

assert.match(
  html,
  /function selectVisibleHorses\(\)\{\s*return sortHorses\(horses\.filter\(matches\)\);\s*\}/,
  "the existing selection pipeline remains the single visible-horse source"
);
assert.match(html, /renderDesignLab\(visibleHorses\);/);
assert.match(html, /renderCurrentRoster\(visibleHorses\);/);
assert.doesNotMatch(html, /renderDesignLab\(horses\)|renderCurrentRoster\(horses\)/);

const labHorseStart = html.indexOf("function renderDesignLabHorse(horse)");
const labHorseEnd = html.indexOf("function renderDesignLab(visibleHorses)", labHorseStart);
assert.ok(labHorseStart >= 0 && labHorseEnd > labHorseStart);
const labHorseBody = html.slice(labHorseStart, labHorseEnd);
assert.match(labHorseBody, /article\.dataset\.horseId = horse\.id/);
assert.match(labHorseBody, /openEditor\(horse\.id\)/, "Design Lab routes to the authoritative editor");
assert.match(labHorseBody, /hasPhoto \? " has-photo" : " no-photo"/);
assert.match(labHorseBody, /if\(hasPhoto\)\{/);
assert.doesNotMatch(
  labHorseBody,
  /persist\(|saveHorse|saveScreenshot|deleteScreenshot|supabase|cloudUpsert|localStorage|horses\.(?:push|splice)/i,
  "Design Lab horse rows are presentation-only"
);

assert.doesNotMatch(labHorseBody, /NillaCrumpet|ButterBean/, "the Design Lab renderer contains no hard-coded example horses");
assert.match(html, /\.design-lab-horse\.no-photo\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(html, /if\(isSpecialSubtypeTier\(horse\.tier\) && horse\.subtype\)/);
assert.match(html, /return SUBTYPE_LABEL\[horse\.subtype\] \|\| horse\.subtype/);

const modeStart = html.indexOf('var desktopRosterViewMode = "current";');
const modeEnd = html.indexOf("function renderAll()", modeStart);
const modeBlock = html.slice(modeStart, modeEnd);
assert.doesNotMatch(modeBlock, /localStorage|sessionStorage|SUPABASE|SHOT_BUCKET/);

assert.match(plan, /exactly one source of truth/i);
assert.match(plan, /same visible horse object references/i);
assert.match(plan, /No mobile Design Lab UI/i);
assert.match(plan, /No deployment or merge/i);

console.log("Design Lab architecture and guardrail tests passed");
