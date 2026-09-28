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
assert.match(labHorseBody, /if\(hasScreenshot\(horse\.id\) \|\| screenshotPointerV\(horse\)\) loadDesignLabPhoto\(thumb, horse\)/);
assert.match(labHorseBody, /courserProgress\(horse\)/, "v2 restores Courser progress");
assert.match(labHorseBody, /STATUS_STYLE\[horse\.status\]/, "v2 restores the existing status colors");
assert.match(labHorseBody, /coatGroupSwatch\(group, horse\.coatColor\)/, "v2 restores the coat cue");
assert.doesNotMatch(labHorseBody, /innerHTML/, "Design Lab rows build DOM with textContent only");
assert.doesNotMatch(
  labHorseBody,
  /persist\(|saveHorse|saveScreenshot|deleteScreenshot|supabase|cloudUpsert|localStorage|horses\.(?:push|splice)/i,
  "Design Lab horse rows are presentation-only"
);

assert.doesNotMatch(labHorseBody, /NillaCrumpet|ButterBean/, "the Design Lab renderer contains no hard-coded example horses");
assert.doesNotMatch(html, /NO PHOTOGRAPH|No photograph|Open horse \u2192/, "v2 drops repeated no-photo text and the redundant open link");
assert.match(html, /\.design-lab-thumb\{width:52px; height:39px;/, "photos are a small identifier, not a row-sizing image");
assert.match(html, /if\(isSpecialSubtypeTier\(horse\.tier\) && horse\.subtype\)/);
assert.match(html, /SUBTYPE_LABEL\[horse\.subtype\] \|\| horse\.subtype/);

const modeStart = html.indexOf('var desktopRosterViewMode = "current";');
const modeEnd = html.indexOf("function renderAll()", modeStart);
const modeBlock = html.slice(modeStart, modeEnd);
assert.doesNotMatch(modeBlock, /localStorage|sessionStorage|SUPABASE|SHOT_BUCKET/);

assert.match(plan, /exactly one source of truth/i);
assert.match(plan, /same visible horse object references/i);
assert.match(plan, /No mobile Design Lab UI/i);
assert.match(plan, /No deployment or merge/i);

console.log("Design Lab architecture and guardrail tests passed");
