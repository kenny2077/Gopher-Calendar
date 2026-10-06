# Privacy policy

_Last updated: October 5, 2026_

Gopher Calendar is a Chrome extension that shows University of Minnesota students their Canvas
deadlines and MyU class times on one page. This policy covers the extension in this repository
and in the Chrome Web Store. The short version: **there is no Gopher Calendar server, and the
developer never receives your data.**

## What the extension reads

When you click **Sync**, the extension sends read-only `GET` requests from a Canvas or MyU tab,
using the session you're already logged in with:

- **Canvas** (`canvas.umn.edu`): your current courses, deadlines, submission status, the Syllabus
  tab, and the *names* of course files and pages that might hold a schedule.
- **MyU** (`www.myu.umn.edu`): your class meeting times, rooms and instructors.
- **UMN academic calendar** (`academic-calendar.umn.edu`): the public list of university holidays.

It never sees or stores your password or Duo, and it never changes anything in Canvas or MyU.

Syllabus and schedule files are opened **only after you approve them** in **Sources to read**.

## Where your data is stored

Everything the extension reads is stored in `chrome.storage.local`, in your own browser profile.
Nothing is uploaded to the developer or to any analytics service. The extension has no tracking,
no ads, and no remote code.

**Settings → Clear synced data** deletes your courses, deadlines, classes and anything read from
syllabi. Removing the extension deletes everything it stored, including your settings and any API
key.

## Optional AI reading

AI reading is **off by default**. In the default mode, approved files are read by rules that run
on your device, and nothing leaves your browser.

If you turn AI reading on and enter your own API key for Anthropic, OpenAI or Azure OpenAI:

- Chrome asks you before the extension may contact that provider.
- The provider receives the names of candidate files (to help choose what to read), and then the
  text or page images of the files you approved, the course code, and Canvas item titles.
- Your name, student ID, grades and submissions are never sent.
- Your key is stored only in `chrome.storage.local` in your browser and is sent only to the
  provider you chose.

What the provider does with that request is governed by your agreement with that provider.

## Calendar export

**Download .ics file** saves a file on your computer. The extension doesn't send it anywhere.

## Chrome Web Store disclosures

- The extension handles personal information (course schedule, deadlines) only to show it to you
  on your own device.
- This data is not sold, not transferred to third parties (except to the AI provider you pick
  yourself, as described above), and not used for credit, lending or advertising.

## Contact

Questions or concerns: open an issue at
<https://github.com/kenny2077/Gopher-Calendar/issues>, or report a security problem privately as
described in [SECURITY.md](SECURITY.md).
