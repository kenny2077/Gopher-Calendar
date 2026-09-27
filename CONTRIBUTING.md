# Contributing

Thanks for helping! Gopher Calendar is a plain Manifest V3 extension with no build
step. You need Node 20+ for the tests and nothing else.

## Setup

```bash
git clone https://github.com/kenny2077/Gopher-Calendar.git
cd Gopher-Calendar
npm install          # test-only dev dependencies
npm test             # collectors, normalisation, calendar model, rules reader, AI request shapes
```

Load `extension/` with **chrome://extensions → Developer mode → Load unpacked**.

## Previewing the calendar page

```bash
npm run preview      # http://localhost:5178/dev/preview.html, sample semester, no extension needed
npm run build:demo   # builds the GitHub Pages demo into _site/
```

## Ground rules

- **Read-only.** Collectors must only send `GET` requests, one at a time, with a pause between
  them. Anything that changes a student's Canvas or MyU data won't be merged.
- **No real student data in the repo.** Fixtures under `test/fixtures/` are synthetic. If you
  capture your own courses for testing, keep them in `test/fixtures/private/`, which is gitignored.
- **Rules first.** Dates the rules can find (`extension/lib/extract.js`) shouldn't need AI. If you
  add a pattern, add a test in `test/extract.test.js` built from a made-up syllabus line.
- **Escape anything from Canvas, MyU or a model** before it goes into the page (`esc()` in
  `dashboard.js`).

## Pull requests

Keep PRs focused, describe what you tested, and make sure `npm test` passes.
