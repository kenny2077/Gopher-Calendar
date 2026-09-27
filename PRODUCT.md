# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Chrome extension, Manifest V3, plain HTML/CSS/JS modules, no build step (delegated: chosen for hackathon reliability; load unpacked from `extension/`). pdf.js is vendored for syllabus reading. Node + linkedom only for tests. A hosted website (Cloudflare or AWS) comes later.

## Users

University of Minnesota students (first tested on one student's Fall 2026 schedule, 6 courses). They check Canvas and MyU over and over to figure out what their week looks like.

## Product Purpose

Students have two calendars: MyU says where they need to be, Canvas says what they need to do. The extension syncs both from the student's existing logged-in browser session and generates one calendar page that opens in a new tab. Success: the student stops opening Canvas every day to check due dates.

## Positioning

Not "Canvas in Google Calendar" (Canvas feeds and Gopher Grades already do that). The product answers "which weeks will crush me?" with a course × week workload matrix, and fills gaps Canvas leaves (undated assignments whose dates live only in syllabus PDFs) with an LLM pass, clearly marked as unconfirmed.

## Operating Context

- Data sources: Canvas REST API (`canvas.umn.edu/api/v1/...`, planner items, assignments, syllabus) and MyU IScript pages (weekly class schedule, class detail), both read with the student's own session cookies from a tab on that site.
- Read-only GET requests at low volume. No tokens, no passwords, no backend.
- Reading approved syllabus/schedule sources runs on-device with rules by default (lib/extract.js). Optional AI mode (student's own key: Anthropic, OpenAI or Azure OpenAI) reads only the syllabus/schedule sources the student approved (picked from file names first, max 3 per course) to date undated items, add syllabus-only items and classify item types; it also decides duplicates. It sees course codes, item titles, syllabus content; never the student's name or grades.
- Export: `.ics` file for Google Calendar or Apple Calendar import.

## Capabilities and Constraints

- Two views that never mix: Workload (semester matrix + weekly due items) and Class schedule (weekly class meetings from MyU).
- All times shown in America/Chicago.
- Later extras, not built yet: "what changed since last sync", study-time suggestions, hosted website, direct Google Calendar API.

## Brand Commitments

Continues the Awesome Calendar Skill (github.com/kenny2077/Awesome-calendar-skill): purple light canvas with one white working panel, purple intensity for workload, card-suit symbols for item types (♦ assignment, ♠ quiz, ♣ exam, ♥ project/presentation, ● participation, ▲ milestone), no text inside matrix cells, hover detail near the cursor. Inter is the incumbent typeface (self-hosted in `extension/fonts/`); kept on purpose despite the overused-font detector warning.

## Evidence on Hand

- Original template: the Awesome Calendar Skill repo's `examples/fall-2026-demo.html`.
- Real synced data only exists in the user's browser; the repo ships a sample semester derived from the public demo.

## Product Principles

1. The student's data never leaves their browser, except syllabus content sent to the AI step they switched on.
2. Anything the AI guessed looks different from what Canvas stated, until the student confirms it.
3. The semester shape comes first; detail is one click away.
4. Be a good citizen to Canvas and MyU: few, sequential, read-only requests.
