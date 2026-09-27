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

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, in the
imperative mood, under 72 characters.

| Type | Use it for |
|---|---|
| `feat` | Something a user can see or do (`feat(tour): explain on-device reading`) |
| `fix` | A bug fix (`fix(myu): skip meetings on university holidays`) |
| `refactor` | A code change that doesn't change behaviour |
| `perf` | A faster or lighter version of the same behaviour |
| `test` | Adding or fixing tests only |
| `docs` | README, CONTRIBUTING, comments |
| `style` | Formatting only |
| `build` / `ci` | Dependencies, the demo build, GitHub Actions |
| `chore` | Anything else that doesn't touch the extension's behaviour |

Useful scopes: `canvas`, `myu`, `sources`, `extract`, `ai`, `dashboard`, `tour`, `demo`, `ics`.
Mark breaking changes with `!` (`feat(ai)!: …`) and explain them in the body.

## Pull requests

Keep PRs focused, describe what you tested, and make sure `npm test` passes. The PR title follows
the same Conventional Commits format, because it becomes the squash-merge commit message.
