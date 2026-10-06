# Chrome Web Store listing

Everything the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) asks for, ready
to paste. Upload `dist/gopher-calendar-v<version>.zip` from `npm run package`, or the zip attached
to the matching [GitHub release](https://github.com/kenny2077/Gopher-Calendar/releases).

## Store listing

**Name:** Gopher Calendar

**Summary** (132 characters max):

> Canvas deadlines and MyU class times in one semester calendar for UMN students. Your data stays in your browser.

**Category:** Education · **Language:** English (United States)

**Description** (paste as is; each paragraph is one line so the store doesn't break lines mid-sentence):

```text
Your whole semester on one page, built for University of Minnesota students.

MyU tells you where to be. Canvas tells you what's due. Gopher Calendar puts both in one calendar, using the Canvas and MyU sessions already open in your browser. No account, no password, no server.

WORKLOAD VIEW
See which weeks will crush you. Every course against every week, shaded by how much is due, with card-suit marks for the kind of work: ♣ exam, ♠ quiz, ♦ assignment, ♥ project.

CLASS SCHEDULE
Your MyU classes on a week grid that fits one screen, with university holidays already removed.

DATES CANVAS IS MISSING
Many professors put due dates only in a syllabus PDF or on the course Home page. Gopher Calendar finds those files and reads them, only after you approve them. New dates show dashed until you confirm them. Repeating events like "a short quiz at the start of each lab" become Quiz 1, 2, 3…

TAKE IT ANYWHERE
Export an .ics file for Google Calendar, Apple Calendar or Outlook.

PRIVATE BY DESIGN
• Read-only: it never changes anything in Canvas or MyU.
• Everything stays in your browser. There is no Gopher Calendar server.
• Syllabi are read by rules on your device. AI reading is optional and off by default; if you turn it on, you bring your own Anthropic, OpenAI or Azure OpenAI key.

Open source (MIT): https://github.com/kenny2077/Gopher-Calendar
Not affiliated with or endorsed by the University of Minnesota.
```

**Graphics:**

| Asset | File |
|---|---|
| Icon, 128×128 | `extension/icons/icon-128.png` |
| Screenshots, 1280×800 | `store/screenshots/1-workload.png`, `2-week.png`, `3-classes.png` |
| Small promo tile, 440×280 | `store/promo-tile-440x280.png` |

Screenshots come from the live demo's sample semester. They contain no real student data.

**Official URL / homepage:** https://github.com/kenny2077/Gopher-Calendar
**Support URL:** https://github.com/kenny2077/Gopher-Calendar/issues

## Test instructions

Reviewers can't sign in to UMN Canvas or MyU, so point them at the built-in sample semester:

```text
Gopher Calendar reads a University of Minnesota student's Canvas and MyU, which need a UMN login. To review without one:
1. Click the toolbar icon, then "Open calendar".
2. Click "Show sample semester". This loads a made-up semester stored only in the browser.
3. Browse the Workload view, click any week to see its items, and open the Class schedule tab.
4. Settings has the reading mode (on-device by default), the optional AI key fields, .ics export and "Clear synced data".
A public demo of the same page is at https://kenny2077.github.io/Gopher-Calendar/
```

## Privacy practices

**Single purpose:**

> Shows a UMN student's Canvas deadlines and MyU class times together in one calendar page.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the synced calendar, the student's approvals and settings locally in the browser. |
| `unlimitedStorage` | Cached text of approved syllabus PDFs can exceed the default 10 MB local storage quota. |
| `scripting` | Runs the read-only collectors inside a Canvas or MyU tab so requests use the student's own logged-in session. |
| `tabs` | Finds an open Canvas/MyU tab (or opens one in the background), waits for university sign-on redirects to finish, and detects when the student needs to log in. |
| Host: `canvas.umn.edu`, `www.myu.umn.edu` | The two sites the calendar is built from. Only GET requests are sent. |
| Host: `academic-calendar.umn.edu` | Public UMN holiday list, so classes on university holidays are hidden. |
| Host: `*.instructure.com`, `*.inscloudgate.net`, `*.canvas-user-content.com` | Where Canvas serves course files; used only to download syllabus files the student approved. |
| Optional host: Anthropic, OpenAI, Azure OpenAI | Requested only if the student turns on AI reading and saves their own API key. |

**Remote code:** No. All code, including pdf.js, ships inside the package.

**Data usage** (check these boxes in the dashboard):

- Personally identifiable information: **No**
- Health / financial / authentication information: **No**
- Personal communications: **No**
- Location: **No**
- Web history: **No**
- User activity: **No**
- Website content: **Yes**. Course schedules and deadlines from Canvas and MyU, shown to the
  student on their own device.

Certify all three: not sold to third parties, not used for unrelated purposes, not used for
creditworthiness or lending.

**Privacy policy URL:** https://github.com/kenny2077/Gopher-Calendar/blob/main/PRIVACY.md

## Distribution

Public, all regions. Free.
