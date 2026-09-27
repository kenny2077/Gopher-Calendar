---
version: 1
slug: "extension-dashboard-dashboard-html"
primary_target: "extension/dashboard/dashboard.html"
related_targets: ["extension/popup/popup.html"]
---

## Scope
Calendar dashboard page of the Chrome extension (extension/dashboard/), plus its popup. Visitor mode: Operate.

## Audience and job
A UMN student opening their calendar tab several times a week to see which weeks are heavy, what is due this week, and where their classes are.

## Direction contract
THESIS: The semester shape comes first: a course × week matrix whose purple intensity is workload, with card-suit marks for item types. Refuses the category default of a month grid stuffed with event chips.
OWN-WORLD: Lavender canvas, one white working panel, purple ramp p0–p4 for load, suits (♦ ♠ ♣ ♥ ● ▲) as notation, dashed outline for anything the AI inferred, seven muted course tints (bg/ink/edge) used only in the class schedule and as small course markers.
STORY: The student sees the whole term at once, spots crunch weeks, clicks a cell to see that week's items, and switches to Class schedule for where to be. AI-read dates are visibly unconfirmed.
FIRST VIEWPORT: Title and date span top left, Workload | Class schedule switch top right, sync status line and actions (Sync, Export .ics, Settings) beneath, then the full-width matrix; legend and load scale in the footer.
FORM: Refinement of the incumbent Awesome Calendar Skill world (rank 1, incumbent). Seed key: none. The concept roll was waived because the user asked for the template to be kept ("keep our original template as a workload and a semester view") and made better, which is refinement inside an established world, not a new world.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Signature interaction
Hover a matrix cell for its items beside the cursor; click to open that week with the course lane highlighted.

## Unresolved
Hosted website version; holiday calendar (MyU week view still lists meetings on university holidays).
