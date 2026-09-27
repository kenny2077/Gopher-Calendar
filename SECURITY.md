# Security policy

Gopher Calendar runs with a student's own Canvas and MyU sessions, so we take
reports seriously.

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/kenny2077/Gopher-Calendar/security/advisories/new)
instead. Include the steps to reproduce and what an attacker could do. We aim to
reply within a week.

## What the extension does, and doesn't do

- **It reads, and never writes.** Every request to Canvas and MyU is a `GET`, made one at a
  time from a tab on that site, using the session you already have. It never stores or sees
  your password or Duo.
- **Your data stays local.** Synced data lives in `chrome.storage.local` in your browser.
  There is no server.
- **AI is opt-in.** In the default mode, approved syllabus files are read on your
  device by rules and nothing leaves your browser. If you choose an AI provider, then after you
  approve the sources, their text is sent to that provider with your own key, together with
  course codes and Canvas item titles. In that mode the provider also sees file *names* while
  picking what to read. Your name, grades and submissions are never sent.
- **Permissions:** Canvas and MyU hosts (to read your data), Canvas file hosts
  (`*.instructure.com`, `*.inscloudgate.net`, `*.canvas-user-content.com`, where Canvas
  serves syllabus PDFs), `academic-calendar.umn.edu` (public holiday list), and `scripting`,
  `tabs`, `storage`. AI provider hosts are *optional* permissions, requested only when you
  save a key.

## Keys

API keys you enter are stored in `chrome.storage.local` on your machine. For development,
`extension/config.local.json` is gitignored. Never commit a real key, and never package that
file into a release zip.
