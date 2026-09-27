---
name: Gopher Calendar
description: One purple semester page that shows which weeks will crush you, and where your classes are.
colors:
  canvas: "#f1ecff"
  panel: "#ffffff"
  panel-2: "#fbf9ff"
  header-row: "#fcfbfe"
  ink: "#241b35"
  ink-2: "#4a3f5e"
  muted: "#6c6280"
  line: "#e8e1f2"
  line-2: "#d9ccec"
  accent: "#6d3fc0"
  accent-deep: "#4f2b91"
  accent-wash: "#f4eeff"
  hover-wash: "#f6f1ff"
  p0: "#faf8ff"
  p1: "#eee7fb"
  p2: "#ddcff7"
  p3: "#c0a7ee"
  p4: "#9871dc"
  danger: "#a3213f"
  danger-wash: "#fbecef"
  tooltip-ink: "#2d2340"
  c0-bg: "#f1e4f7"
  c0-ink: "#5d2a78"
  c0-edge: "#b98bd0"
  c1-bg: "#e4e7fb"
  c1-ink: "#2e3a8c"
  c1-edge: "#8e98e0"
  c2-bg: "#dcefec"
  c2-ink: "#1d5e57"
  c2-edge: "#7fbcb2"
  c3-bg: "#f8ecd4"
  c3-ink: "#74460c"
  c3-edge: "#d9ae63"
  c4-bg: "#f9e2e7"
  c4-ink: "#8a2540"
  c4-edge: "#de8ea1"
  c5-bg: "#e9eed9"
  c5-ink: "#465717"
  c5-edge: "#a9ba74"
  c6-bg: "#e5e9ef"
  c6-ink: "#34404f"
  c6-edge: "#9aa6b6"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  course-label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.45
    letterSpacing: "0.01em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  body-sm:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.45
  meta:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  item-title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.25
  item-time:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "10.5px"
    fontWeight: 800
    lineHeight: 1.25
  suit-mark:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "18px"
    fontWeight: 400
    letterSpacing: "1px"
  suit-legend:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "15px"
    fontWeight: 400
rounded:
  mark: "3px"
  ring-guess: "6px"
  ring-current: "7px"
  chip: "9px"
  control: "10px"
  container: "12px"
  popup: "16px"
  panel-sm: "18px"
  panel: "24px"
spacing:
  hair: "4px"
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "22px"
  shell: "24px"
  gutter: "30px"
  gutter-sm: "18px"
components:
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.panel}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.accent-deep}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-wash}"
  button-secondary-active:
    backgroundColor: "{colors.p1}"
  button-quiet:
    textColor: "{colors.accent-deep}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-quiet-hover:
    backgroundColor: "{colors.accent-wash}"
  button-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
  button-danger-hover:
    backgroundColor: "{colors.danger-wash}"
  switch-track:
    backgroundColor: "{colors.p1}"
    rounded: "{rounded.container}"
    padding: "4px"
  switch-option:
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.chip}"
    padding: "8px 16px"
  switch-option-selected:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.accent-deep}"
  input-text:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  matrix-cell-load0:
    backgroundColor: "{colors.p0}"
    textColor: "{colors.accent-deep}"
    typography: "{typography.suit-mark}"
    height: "58px"
  matrix-cell-load1:
    backgroundColor: "{colors.p1}"
    textColor: "{colors.accent-deep}"
  matrix-cell-load2:
    backgroundColor: "{colors.p2}"
    textColor: "{colors.accent-deep}"
  matrix-cell-load3:
    backgroundColor: "{colors.p3}"
    textColor: "{colors.accent-deep}"
  matrix-cell-load4:
    backgroundColor: "{colors.p4}"
    textColor: "{colors.panel}"
  matrix-course-label:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.course-label}"
    height: "58px"
  course-marker:
    rounded: "{rounded.mark}"
    size: "8px"
  weekly-item:
    backgroundColor: "{colors.accent-wash}"
    typography: "{typography.item-title}"
    rounded: "{rounded.chip}"
    padding: "7px 8px"
  weekly-item-guess:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.chip}"
  weekly-item-done:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.muted}"
  meeting-block:
    backgroundColor: "{colors.c0-bg}"
    textColor: "{colors.c0-ink}"
    rounded: "{rounded.control}"
    padding: "6px 9px"
  meeting-block-cancelled:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  ai-strip:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.container}"
    padding: "10px 14px"
  notice:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-deep}"
    typography: "{typography.body-sm}"
    padding: "11px 30px"
  notice-error:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
  tooltip:
    backgroundColor: "{colors.tooltip-ink}"
    textColor: "{colors.panel}"
    rounded: "{rounded.container}"
    padding: "10px 12px"
    width: "340px"
---

# Design System: Gopher Calendar

## Overview

**Creative North Star: "The Dealt Semester"**

The whole term is laid out on one table like a dealt hand: every course is a row, every week a column, and the depth of purple says how heavy that week is before a single word is read. Card suits mark what kind of work sits in a week; they are notation, read like a legend, not decoration. Detail is always one gesture away (hover for a tooltip beside the cursor, click to open the week), so the first view stays quiet and whole.

The world is a lavender canvas holding one white working panel with generous 24px corners and a soft violet-tinted lift. Everything inside the panel is flat, hairline-ruled and dense in the way a timetable is dense: tabular numerals, 12 to 14px text, heavy 800 weights reserved for names and titles. Purple is the only voice in the Workload view; the seven muted course tints appear at full strength only in the Class schedule, and elsewhere shrink to an 8px marker beside a course code.

Honesty is a visual property here. Anything the AI read out of a syllabus, rather than something Canvas or MyU stated, is drawn with a dashed outline until the student confirms it. The system is light-only (`color-scheme: light`) and set in Inter, kept on purpose as the incumbent face of the Awesome Calendar Skill world.

**Key Characteristics:**
- Lavender canvas, one white panel, flat hairline-ruled interior.
- A five-step purple ramp (p0 to p4) encodes workload and nothing else.
- Card suits (♦ ♠ ♣ ♥ ● ▲) set in Georgia as a notation, never as icons.
- Dashed outline equals "inferred by AI, unconfirmed".
- Two views, Workload and Class schedule, behind one segmented switch; they never share a canvas.
- Hover detail rides beside the cursor in a dark plum tooltip.

## Colors

A single violet family carries structure, action and load, with seven muted course tints held back for the class timetable.

### Primary
- **Semester Violet** (accent): primary buttons, the current-week label, today's date, the now-line in the schedule, the suit glyphs in the legend and weekly items, the focus outline, and the native `accent-color` for checkboxes.
- **Deep Violet Ink** (accent-deep): text of secondary and quiet buttons, the selected switch option, suit marks inside matrix cells, the notice text, links, and the keyboard-focus ring on matrix cells. It is also the hover fill of the primary button.
- **Violet Wash** (accent-wash): the soft selection field. Today's column head, the focused course lane in the weekly view, the info notice band, and the resting fill of every weekly item.
- **Hover Wash** (hover-wash): hover fill for secondary buttons on the dashboard and in the popup.

### Secondary
- **Load Ramp p0 to p4** (p0, p1, p2, p3, p4): workload intensity in matrix cells, from almost-white Lilac Mist (p0, empty week) through Pale Heather (p1), Soft Wisteria (p2), Lavender Bloom (p3) to Full Amethyst (p4, crunch week). p1 doubles as the switch track and the pressed button fill; p3 is the hover edge for items and the dashed border of the AI strip; p4 is the hover ring on a matrix cell and the dashed border of an AI-inferred item.

### Tertiary
- **Course Tints c0 to c6** (each a bg, ink and edge triple): Orchid (c0), Periwinkle (c1), Sea Glass (c2), Wheat (c3), Rose Quartz (c4), Sage (c5), Slate (c6). The bg/ink pair fills and labels a class meeting block; the edge colors the block border and the 8px course marker dot. Tints are assigned per course and stay stable across both views.

### Neutral
- **Lavender Canvas** (canvas): the page ground behind the panel, dashboard and popup alike.
- **Paper White** (panel): the working panel, button faces, sticky course labels, day cells.
- **Whisper Lilac** (panel-2): recessed bands inside the panel (settings drawer, AI strip, completed items, schedule change list).
- **Header Row Tint** (header-row): the week-label row of the matrix and the day-head rows of both weekly grids.
- **Plum Ink** (ink): body text and titles.
- **Dusk Ink** (ink-2): secondary text, setting labels, notice and strip copy.
- **Muted Mauve** (muted): subtitles, sync line, hints, hours, day-of-week labels, completed items.
- **Hairline** (line): every grid rule and section divider (1px).
- **Control Edge** (line-2): button and input borders, and the ghost border of a cancelled meeting.
- **Tooltip Plum** (tooltip-ink): the one dark surface, reserved for the cursor tooltip.
- **Alarm Garnet** (danger) with **Garnet Wash** (danger-wash): sync errors, missing submissions, the destructive "Clear synced data" button and error notices. Never used for workload, however heavy.

### Named Rules
**The Purple Is Load Rule.** In the Workload view, purple intensity means workload and only workload. A darker cell must always mean more due that week; no other element borrows p2 to p4 as a decorative fill.

**The Tints Stay Home Rule.** Course tints fill surfaces only in the Class schedule. Everywhere else a course is identified by an 8px tinted marker beside its code, never by a tinted card or row.

## Typography

**Display Font:** Inter (self-hosted variable, with -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Inter
**Label/Mono Font:** Georgia (with Times New Roman, serif), for suit glyphs only

**Character:** A single grotesque doing timetable work: tabular numerals everywhere, tight negative tracking on titles, and heavy 800 weight for anything that names a thing (course codes, week titles, dates). The serif is not a second voice; it exists so the suits render as proper card pips.

### Hierarchy
- **Display** (800, 30px, 1.1, -0.025em): the term title top left of the panel. One per page.
- **Headline** (700, 22px, -0.015em): the empty-state heading.
- **Title** (800, 18px, -0.01em): the week title in the weekly and class schedule headers.
- **Course label** (800, 13px, +0.01em): course codes in the matrix and weekly lanes; the class table caption steps up to 14px.
- **Body** (400, 14px, 1.45, tabular numerals): base text. Hints and prose cap at 60ch.
- **Body small** (400, 13px): subtitle, notices, table cells.
- **Button** (700, 13px, 1.2): buttons and switch options.
- **Label** (700, 12px): setting labels and the bold source names in the sync line. **Meta** (400, 12px, muted) carries the sync line, hints, footers and day-of-week labels.
- **Item title / item time** (700 at 11.5px; 800 at 10.5px): the two lines inside a weekly item; meeting blocks use 12.5px 800 for the code over 11.5px meta.
- **Suit mark** (Georgia 400, 18px, 1px tracking) inside matrix cells; **Suit legend** (Georgia 400, 15px) in the footer legend.

### Named Rules
**The Suits Are Notation Rule.** ♦ assignment, ♠ quiz, ♣ exam, ♥ project or presentation, ● participation, ▲ report or milestone. Suits are typeset characters in the suit face, colored with the accent family, always backed by the legend in the matrix footer. They are never drawn as icons, never boxed in badges, and never decorate buttons, headings or navigation.

**The No Words In Cells Rule.** A matrix cell carries only its load color and its suit marks, ordered exam, quiz, project, milestone, assignment, participation. Titles, counts and dates live in the tooltip and the weekly view.

## Layout

A centered shell (max 1480px, 36px top margin, 24px side padding) holds one panel. Inside, content runs on a 30px side gutter: topbar (28px top), toolbar (sync line left, actions right) closed by a hairline, then the active view. The first viewport reads title and date span top left, the Workload | Class schedule switch top right, the sync status line and actions (Sync, Export .ics, Settings) beneath, then the full-width matrix with the suit legend and load scale in its footer.

The matrix is a CSS grid: a sticky course-label column, then one column per week; month labels (28px) over week labels (42px), course rows 58px tall. The weekly workload grid is a 116px lane column plus seven day columns (min 126px, grid min-width 1040px); the class schedule is a 56px hour gutter plus five or seven day columns (min 150px) on an hourly background rule. Wide grids scroll horizontally inside their wrapper; the page itself never does.

Rhythm is small and even: 4, 6 and 8px inside controls and lists, 16px between toolbar groups, 22px above view content, 30px panel gutter.

Two breakpoints. At 900px the settings drawer collapses from three columns to one. At 760px the shell gutter drops to 10px, the panel gutter to 18px, the panel radius to 18px; the topbar and toolbar stack, the switch stretches full width with equal halves, the primary Sync button takes the remaining row width and drops its long label, and the class table becomes stacked blocks.

## Elevation & Depth

Depth is mostly tonal: lavender canvas below, white panel above, recessed whisper-lilac bands inside. The panel is the only lifted surface on the page; everything within it is flat and separated by 1px hairlines. The few interior shadows are small, violet-tinted, and signal state rather than structure. Hover and keyboard focus on matrix cells use inset 2px rings, not shadows.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 22px 60px rgba(70, 45, 110, .12)`): the single working panel. The popup uses a smaller version (`0 10px 30px`, same tint).
- **Selected switch** (`box-shadow: 0 2px 8px rgba(79, 43, 145, .14)`): the chosen view option riding on its track.
- **Item rest** (`box-shadow: 0 3px 8px rgba(80, 50, 120, .06)`): a barely-there lift on weekly items so they read as clickable.
- **Tooltip** (`box-shadow: 0 12px 30px rgba(34, 22, 52, .28)`): the dark cursor tooltip, the only floating layer.

### Named Rules
**The One Panel Rule.** There is exactly one lifted white panel per page. New sections go inside it as flat, hairline-divided bands; they do not become cards with their own shadows.

## Shapes

Corners scale with the size of the thing: 24px for the panel (18px on phones, 16px for the popup card), 12px for bands and floating layers (switch track, AI strip, notices list, tooltip), 10px for controls and meeting blocks, 9px for weekly items and switch options, 6 to 7px for the inset rings drawn inside matrix cells, 3px for the course marker and load swatches. Matrix and grid cells themselves are square and share hairline borders like a ruled ledger.

Line style carries meaning. Solid 1px hairlines rule the grids. A 1.5px solid ring (accent at 35%) inset 4px marks the current week. A 1.5px dashed outline marks AI inference: inset 7px inside a matrix cell, as the whole border of a weekly item, and as the border of the AI strip.

### Named Rules
**The Dashed Doubt Rule.** A dashed outline means the AI inferred it from a syllabus and the student has not confirmed it. Dashes appear on AI-dated items, on matrix cells holding such an item, and on the AI strip that reports the syllabus pass. Once confirmed, the item drops the dash and becomes an ordinary solid item.

## Components

### Buttons
Compact, bold and violet-inked; they read as tools on a timetable, not calls to action.
- **Shape:** gently rounded (10px), 1px border, 8px by 13px padding, 13px 700 label.
- **Primary:** Semester Violet fill with white text (Sync). One per toolbar or empty state.
- **Secondary:** white face, Control Edge border, Deep Violet Ink text (Export .ics, week navigation, Save key).
- **Quiet:** no border or fill until hover (Settings, This week).
- **Danger:** secondary shape with Alarm Garnet text, Garnet Wash on hover (Clear synced data only).
- **Hover / Focus:** background and border color transition over 150ms ease. Secondary hovers to Hover Wash and presses to p1; primary hovers to Deep Violet. Focus is a 2px accent outline at 2px offset. Disabled drops to 50% opacity; busy sets a progress cursor.
- **Popup:** the same primary and secondary buttons at full width, 9px by 12px padding, stacked with 8px between.

### View switch
A segmented control on a p1 track (12px radius, 4px padding, 2px gap). Options are 13px 700 muted text with 9px corners; the selected option becomes a white chip with Deep Violet Ink text and the selected-switch shadow. Transitions run 180ms ease. It is a real tablist with arrow-key semantics; the chosen view persists per browser.

### Matrix cell (signature)
The heart of the Workload view. A 58px square-cornered cell filled with its load step (p0 to p4) and centered suit marks in Deep Violet Ink (white on p4). Hover draws an inset 2px p4 ring and shows the tooltip beside the cursor; keyboard focus draws an inset 2px Deep Violet ring. The current week carries an inset solid violet ring; a week holding an unconfirmed AI date carries an inset dashed ring. Clicking opens that week with the course lane highlighted. The sticky course label beside each row pairs an 8px tinted course marker (3px radius) with the 13px 800 code.

### Weekly item
A 9px-rounded chip in Violet Wash with a faint violet border and item-rest shadow; top line is the 10.5px 800 time with the item's suit in accent, bottom line the 11.5px 700 title. Hover shifts the border to p3. Canvas items link out to Canvas.
- **Inferred:** white fill, 1.5px dashed p4 border, and the time line gains " · from syllabus". Clicking confirms it.
- **Done:** Whisper Lilac fill, hairline border, muted text, struck-through title.
- **Missing:** the state word turns Alarm Garnet.
The focused course lane (label and day cells) takes Violet Wash with p3 hairlines top and bottom.

### Meeting block
A class meeting in the Class schedule, absolutely positioned on the hour grid: 10px corners, 6px by 9px padding, the course's tint triple for fill, text and 1px border; 12.5px 800 course code over 11.5px meta (time, room). Short blocks hide the meta. A 2px violet now-line with an 8px dot crosses today's column.
- **Cancelled:** white ghost, muted text, struck-through code, "No class". The build currently draws this ghost with a 1.5px dashed Control Edge border, which collides with the Dashed Doubt Rule; that border is recorded drift, not a pattern to copy.

### Inputs / Fields
White field, 1px Control Edge border, 10px corners, 8px by 10px padding, inheriting the 14px body face; focus uses the global 2px accent outline. Checkboxes use the native control tinted by `accent-color`.

### AI strip
A single-line status band above the matrix: Whisper Lilac fill, 1px dashed p3 border, 12px corners, 10px by 14px padding, 12.5px Dusk Ink text with the lead phrase bolded in Deep Violet and errors in Garnet. It ellipsizes rather than wraps, with the full text in its title.

### Notice
A full-width band directly under the toolbar: Violet Wash fill, Deep Violet Ink 13px text, hairline bottom border, 11px vertical padding on the panel gutter, with small inline buttons (5px by 10px). The error variant swaps to Garnet Wash and Alarm Garnet.

### Tooltip
The only dark surface: Tooltip Plum, white 12px text at 1.42 line height, 12px corners, max 340px, tooltip shadow. It follows the cursor at a 14px offset and flips at viewport edges. A bold title, lines in pale lilac with suits in the suit face, and a smaller muted-lilac meta line that says what a click will do. It fades and rises 4px over 80ms.

### Motion
Motion is brief and functional: 80ms for the tooltip, 120ms for matrix cell rings, 150ms for buttons, 180ms for the switch, all `ease`, and only color, shadow, opacity or a 4px rise. `prefers-reduced-motion: reduce` removes every transition and animation.

## Do's and Don'ts

### Do:
- **Do** keep the page to one white panel (24px corners, panel-lift shadow) on the lavender canvas, and add new content as flat, hairline-divided bands inside it.
- **Do** encode workload only with the p0 to p4 ramp, and keep the lighter-to-heavier scale in the matrix footer whenever the matrix is shown.
- **Do** set suits in Georgia with the accent family and keep the suit legend visible beside the matrix.
- **Do** draw anything the AI inferred with a dashed outline (1.5px dashed p4 on items) and say so in words nearby ("from syllabus"), until the student confirms it.
- **Do** keep Workload and Class schedule behind the one segmented switch; each view shows only its own data.
- **Do** put detail in the cursor tooltip or one click deeper, and keep headline surfaces free of per-item text.
- **Do** use tabular numerals and the 12 to 14px Inter scale; reserve 800 weight for names, titles and dates.

### Don't:
- **Don't** put words, counts or dates inside matrix cells; only load color and suit marks.
- **Don't** use a dashed line for anything the AI did not infer.
- **Don't** replace suits with icon-set pictograms, wrap them in badges, or use them to decorate buttons, headings or navigation.
- **Don't** show class meetings in the Workload view or deadlines in the Class schedule, and don't fill Workload surfaces with course tints beyond the 8px marker.
- **Don't** use Alarm Garnet to signal heavy workload; it is for errors, missing work and destructive actions only.
- **Don't** stack extra cards or shadows inside the panel.
