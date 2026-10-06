<p align="center">
  <a href="https://kenny2077.github.io/Gopher-Calendar/"><img src="docs/assets/workload.png" width="100%" alt="Gopher Calendar workload view: six courses down the side, sixteen weeks across, purple shading and card-suit marks for how much of each kind of work is due each week"></a>
</p>

# Gopher Calendar ♦

<p align="center">
  <a href="https://kenny2077.github.io/Gopher-Calendar/"><b>Live demo</b></a> ·
  <a href="https://github.com/kenny2077/Gopher-Calendar/releases/latest"><b>Download</b></a> ·
  <a href="#quick-install">Install</a> ·
  <a href="#privacy-and-ai">Privacy</a> ·
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <a href="https://kenny2077.github.io/Gopher-Calendar/"><img src="https://img.shields.io/badge/Live_demo-try_it-6d3fc0?style=for-the-badge" alt="Live demo"></a>
  <a href="https://github.com/kenny2077/Gopher-Calendar/releases/latest"><img src="https://img.shields.io/github/v/release/kenny2077/Gopher-Calendar?style=for-the-badge&color=4f2b91&label=release" alt="Latest release"></a>
  <a href="https://github.com/kenny2077/Gopher-Calendar/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kenny2077/Gopher-Calendar/ci.yml?branch=main&style=for-the-badge&label=tests" alt="Tests"></a>
  <a href="extension/manifest.json"><img src="https://img.shields.io/badge/Chrome-Manifest_V3-4f2b91?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Manifest V3"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/backend-none-16a34a?style=for-the-badge" alt="No backend"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-16a34a?style=for-the-badge" alt="License: MIT"></a>
</p>

**Your whole semester on one page, for University of Minnesota students.** MyU says where you need
to be. Canvas says what you need to do. Gopher Calendar puts both in one calendar, synced from the
tabs you're already logged into, and it reads the syllabus for the dates Canvas never got. No
account, no server, no password.

<table>
<tr><td><b>See which weeks will crush you</b></td><td>Every course against every week. Darker purple means more is due, and card-suit marks show what kind: ♣ exam, ♠ quiz, ♦ assignment, ♥ project.</td></tr>
<tr><td><b>Know where to be today</b></td><td>Your MyU classes on a week grid that fits one screen, with university holidays already taken out.</td></tr>
<tr><td><b>Find what Canvas is missing</b></td><td>Many professors put dates only in a syllabus PDF or on the course Home page. Gopher Calendar finds those files and reads them only after you say yes. New dates stay dashed until you confirm them.</td></tr>
<tr><td><b>Understand repeating events</b></td><td>A line like "each lab, except the first week, begins with a short quiz" becomes Quiz 1, 2, 3… on each real lab day.</td></tr>
<tr><td><b>Private by design</b></td><td>Read-only <code>GET</code> requests with the sessions already in your browser. Everything stays in <code>chrome.storage.local</code>. There is no Gopher Calendar server.</td></tr>
<tr><td><b>AI only if you want it</b></td><td>Syllabi are read by rules on your device. Bring your own Anthropic, OpenAI or Azure OpenAI key for unusual wording and scanned PDFs.</td></tr>
<tr><td><b>Take it anywhere</b></td><td>Export one <code>.ics</code> file for Google Calendar, Apple Calendar or Outlook.</td></tr>
</table>

---

## Quick Install

### From a release (recommended)

1. Download `gopher-calendar-vX.Y.Z.zip` from the **[latest release](https://github.com/kenny2077/Gopher-Calendar/releases/latest)** and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.
4. Log in to [Canvas](https://canvas.umn.edu) and [MyU](https://www.myu.umn.edu) in the same Chrome profile.
5. Click the Gopher Calendar icon, then **Sync and open calendar**.

> **Chrome Web Store:** a store listing is on the way. Until then, the release zip is the same
> package that will be submitted.

### From source

```bash
git clone https://github.com/kenny2077/Gopher-Calendar.git
```

Then follow steps 2–5 above and pick the `extension/` folder.

> **Just looking?** The **[live demo](https://kenny2077.github.io/Gopher-Calendar/)** runs the same
> page with a sample semester. Everything can be browsed; buttons that sync, save or download are
> for show.

---

## Getting Started

| Step | What you do | What happens |
|---|---|---|
| **Sync** | Click **Sync Canvas and MyU** | Deadlines from Canvas, classes from MyU, holidays from the UMN calendar. Takes about 30 seconds. |
| **Approve sources** | Check what's listed in **Sources to read**, then click **Read** | The syllabus and schedule files it found are read, and missing dates are filled in. |
| **Confirm** | Click a dashed item, or **Confirm all** | The date is marked as checked by you. |
| **Explore** | Click any week in the grid | That week's items, with the course you clicked listed first. |
| **Export** | **Settings → Download .ics file** | One file with every class meeting and deadline. |

A four-step tour opens the first time the calendar has data. **Settings → Show the tour** replays it.

<table>
<tr>
<td width="50%"><img src="docs/assets/class-schedule.png" alt="Class schedule view: a week of classes on a time grid, one colour per course"></td>
<td width="50%"><img src="docs/assets/week.png" alt="Week view: each course is a row and each day a column, with due items; syllabus dates are dashed"></td>
</tr>
<tr>
<td align="center"><b>Class schedule</b>: from MyU, holidays removed</td>
<td align="center"><b>Week view</b>: dashed items came from the syllabus</td>
</tr>
</table>

---

## How It Works

1. **Read what the university already publishes.** Canvas's API gives due dates, points and whether
   you submitted. MyU gives your class times and rooms. UMN's public academic calendar gives
   holidays. This builds the calendar with plain code: no AI and no guessing.
2. **Find what Canvas is missing.** Each course's Syllabus tab, Home page, files, pages and modules
   are judged by name ("syllabus", "schedule", "calendar") and by how many dates a page mentions.
   At most three per course are picked, and duplicate copies are dropped. Only names are looked at;
   nothing is downloaded yet.
3. **Read only what you approve.** After you click **Read**, rules on your computer find lines like
   "HW 3 due Monday 9/28 at the beginning of the class", table rows like
   "Mon Dec 14 | FP4 slides due 11:59am", and weekly rules. Found dates are matched to the Canvas
   assignments that had none, and anything Canvas already has is skipped.

Approvals are remembered. You're asked again only when a file changes or a new one appears.
Something outside Canvas, like a course website, gets a link and three short steps: open it, save
it as a PDF, then **Add a file**.

<details>
<summary><b>Every request a sync makes</b></summary>

Every request is a `GET`, sent one at a time with a pause, from inside a Canvas or MyU tab so it
carries your existing session.

| Source | What | Endpoint |
|---|---|---|
| Canvas | courses, current term, syllabus | `GET /api/v1/courses?include[]=term&include[]=syllabus_body` |
| Canvas | deadlines with status | `GET /api/v1/planner/items` |
| Canvas | assignments with no due date | `GET /api/v1/courses/:id/assignments` |
| Canvas | candidate sources (names only) | `…/files`, `…/pages`, `…/modules`, `…/front_page` |
| MyU | one week of meetings | `IScript_DrawSection?section=UM_SSS_ACAD_SCHEDULE&effdt=…` |
| MyU | meeting pattern and dates | `IScript_DrawSection?section=UM_SSS_CLASS_DETAIL&…` |
| UMN (public) | closures and no-class days | `https://academic-calendar.umn.edu/academic_calendar` |

Quirks it handles, all covered by tests: Canvas's `while(1);` JSON prefix and UTC times (an
11:59pm deadline arrives as 04:59 the next day), MyU day numbers that overflow the month
(`20260931`), classes with several meeting rows, and MyU listing classes on university holidays.

</details>

---

## Privacy and AI

AI is **optional and off by default**. Gopher Calendar works fully without a key.

| | On this device (default) | With an AI model (optional) |
|---|---|---|
| Who reads approved files | Rules in [`extension/lib/extract.js`](extension/lib/extract.js) | Anthropic, OpenAI or Azure OpenAI, with **your own key** |
| What leaves your browser | Nothing | File names while picking sources, then the text of the files you approved, the course code and Canvas item titles. Never your name, grades or submissions. |
| API key | Not needed | Stored only in this browser. Chrome asks before the extension may contact the provider. |
| Good at | Dates written in the text, tables, clear weekly quiz rules | Unusual wording, repeating events described in prose, scanned PDFs |

In AI mode the model only *describes* repeating events (name, weekday, first and last date). Code
turns that into dates, skips holidays, and checks every answer: only real items, only dates inside
the term.

| Provider | Default model | Output |
|---|---|---|
| Anthropic | `claude-sonnet-5` | Structured output (JSON schema) |
| OpenAI | `gpt-6-luna` | Strict structured output (JSON schema) |
| Azure OpenAI | your deployment | Strict structured output (JSON schema) |

> **How good are the rules?** On the maintainer's six Fall 2026 courses, the on-device rules found
> all 30 dates the AI found, with no false ones. That's a small sample, and the rules were tuned on
> it.

### Permissions

| Permission | Why |
|---|---|
| `canvas.umn.edu`, `www.myu.umn.edu` | The two sites the calendar is built from. `GET` only. |
| `academic-calendar.umn.edu` | Public holiday list, so classes on university holidays are hidden. |
| `*.instructure.com`, `*.inscloudgate.net`, `*.canvas-user-content.com` | Where Canvas serves course files. Used only for syllabus files you approved. |
| `scripting`, `tabs` | Run the read-only collectors inside a Canvas or MyU tab, and notice when you need to log in. |
| `storage`, `unlimitedStorage` | Keep the calendar and the text of approved syllabi in your browser. |
| AI provider hosts *(optional)* | Requested only when you save an API key. |

Full details: [PRIVACY.md](PRIVACY.md) · [SECURITY.md](SECURITY.md)

---

## Troubleshooting

#### "Log in to Canvas (or MyU) in the tab that just opened"

Your university session expired. Sign in, including Duo, in that tab, then click **Sync** again.
Gopher Calendar never sees your password.

#### "No active term found in Canvas"

Canvas has no term that is running or starts within 45 days. This is normal between semesters.

#### "MyU shows no classes with set times for the coming weeks"

All your classes are online or have no meeting times yet. Deadlines from Canvas still work.

#### A syllabus I can see in Canvas isn't in Sources to read

Only files and pages whose names look like a syllabus or schedule are offered. Download it from
Canvas, then use **Add a file** next to the course.

---

## Documentation

| Doc | What's covered |
|---|---|
| [PRIVACY.md](PRIVACY.md) | What is read, where it is stored, and what the optional AI mode sends |
| [SECURITY.md](SECURITY.md) | Permissions, keys, and how to report a vulnerability privately |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, ground rules (read-only, no real student data), commit style |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each release |
| [store/LISTING.md](store/LISTING.md) | Chrome Web Store copy, permission justifications, data disclosures |
| [DESIGN.md](DESIGN.md) | Visual system: colour, type, the workload grid, card-suit marks |
| [PRODUCT.md](PRODUCT.md) | Who it's for, positioning, constraints |

### Project layout

```
extension/
  manifest.json, background.js   sync orchestration (read-only, one request at a time)
  lib/canvas-collect.js          runs inside canvas.umn.edu
  lib/myu-collect.js             runs inside www.myu.umn.edu
  lib/normalize.js, model.js     raw data → deadlines, classes, weeks, workload
  lib/sources.js                 which syllabus/schedule sources to read; approvals; duplicates
  lib/extract.js                 on-device reader, plus weekly-series expansion
  lib/polish.js                  optional AI reader (Anthropic / OpenAI / Azure); PDF text via pdf.js
  lib/closures.js, ics.js        UMN holidays; calendar export
  dashboard/, popup/             the calendar page and toolbar popup
demo/                            GitHub Pages demo (same page, sample semester, inert buttons)
store/                           Chrome Web Store listing and graphics
test/                            node --test suites with synthetic fixtures
dev/                             preview server, packaging and tools
```

### Development

```bash
npm install          # test-only dev dependencies (Node 20+)
npm test             # collectors, normalisation, calendar model, rules reader, AI request shapes
npm run preview      # http://localhost:5178/dev/preview.html with a sample semester
npm run build:demo   # builds the Pages demo into _site/
npm run package      # builds dist/gopher-calendar-vX.Y.Z.zip for the Chrome Web Store
```

Releases are cut by pushing a `vX.Y.Z` tag; see [CONTRIBUTING.md](CONTRIBUTING.md#releasing).

---

## Roadmap

- Chrome Web Store listing
- "What changed since last sync"
- Study-time suggestions in the gaps between classes
- Direct Google Calendar sync

---

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. In short:
read-only requests, no real student data in the repo, and a test for every new syllabus pattern.

## Community

- 🐛 [Report a bug or request a feature](https://github.com/kenny2077/Gopher-Calendar/issues)
- 🔒 [Report a security problem privately](https://github.com/kenny2077/Gopher-Calendar/security/advisories/new)
- 🗓️ [Try the live demo](https://kenny2077.github.io/Gopher-Calendar/)

## Credits

The workload grid comes from [Awesome Calendar Skill](https://github.com/kenny2077/Awesome-calendar-skill).
[Gopher Grades](https://github.com/samyok/gophergrades) showed that MyU's schedule pages can be
read from an extension, and Better Canvas did the same for Canvas's API. No code is copied from
either. Gopher Calendar isn't affiliated with or endorsed by the University of Minnesota.

## License

MIT. See [LICENSE](LICENSE). pdf.js is Apache-2.0 and Inter is SIL OFL 1.1; their license files ship
next to them.

Built by [@kenny2077](https://github.com/kenny2077) at the University of Minnesota.
