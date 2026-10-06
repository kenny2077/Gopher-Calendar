# Changelog

All notable changes to Gopher Calendar are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-05

First public release. Unzip the file below and load the folder with **Load unpacked**, or wait for the Chrome
Web Store listing.

### Added

- **Workload view**: every course against every week, shaded by how much is due, with card-suit
  marks for exams, quizzes, assignments and projects. Click a week to see its items.
- **Class schedule view**: MyU class meetings on a one-screen week grid, with UMN holidays removed
  using the public academic calendar.
- **Syllabus reading**: finds syllabus and schedule files in each course, reads only the ones you
  approve, and fills in dates Canvas doesn't have. New dates stay dashed until you confirm them.
  Weekly patterns ("a quiz at the start of each lab") become numbered, dated items.
- **On-device by default**: rules in `extract.js` read approved files without sending anything
  anywhere. Optional AI reading with your own Anthropic, OpenAI or Azure OpenAI key.
- **`.ics` export** for Google Calendar, Apple Calendar and Outlook.
- **First-run tour**, a sample semester, and a [live demo](https://kenny2077.github.io/Gopher-Calendar/).
- **Release tooling**: `npm run package` builds the Chrome Web Store zip from an allowlist, so local
  secrets can't ship. Pushing a `v*` tag publishes a GitHub release with the zip attached.
- [Privacy policy](https://github.com/kenny2077/Gopher-Calendar/blob/main/PRIVACY.md) and a ready-to-paste [store listing](https://github.com/kenny2077/Gopher-Calendar/blob/main/store/LISTING.md).

[0.1.0]: https://github.com/kenny2077/Gopher-Calendar/releases/tag/v0.1.0
