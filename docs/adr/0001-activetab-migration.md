# 0001. Migrate to activeTab: remove the always-on content script

- **Status:** Accepted
- **Date:** 2026-11-22
- **Deciders:** Raymond Ong

## Context

Cue v1.1.0 was submitted to the Chrome Web Store on 2026-11-22. Google flagged
"Broad Host Permissions" and routed the submission to in-depth review, which takes
weeks instead of days.

The flag came from the manifest: a `content_scripts` entry with
`matches: ["<all_urls>"]` pre-loaded `content.js` on every page at `document_idle`.
That is the widest access an extension can request — the script is resident on any
site the user visits, whether or not the palette is ever opened there.

The palette genuinely needs to work on any page (that is the product: press
Cmd+Shift+K anywhere and the palette opens), so there is no list of "specific
sites" to narrow the matches to. The choice was either to accept the slower
in-depth review, or to stop pre-loading the script and inject it only when the
palette is invoked.

## Decision

Remove the `content_scripts` block from `manifest.json` entirely. Do not add
`host_permissions`. Rely on `activeTab` plus `chrome.scripting.executeScript`,
injected on demand from the background service worker.

This was a small change because the injection path already existed: the
`chrome.commands.onCommand` handler for `toggle-palette` already tries
`chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PALETTE" })`, and on failure
injects `content.js` with `chrome.scripting.executeScript`, retries the message,
and falls back to `chrome.action.openPopup()` if that also fails. The only other
message sent to tabs, `SHOW_TOAST`, already swallows errors, so it degrades
silently when no script is resident.

Two things deliberately stay as they are:

- `web_accessible_resources` keeps `matches: ["<all_urls>"]`. That is not a host
  permission — the palette iframe still has to load on arbitrary pages once the
  script is injected there.
- `content.js` stays in the package as the file that gets injected on demand.

## Consequences

Accepted tradeoffs:

1. **The in-page Cmd+Shift+K fallback listener dies.** `content.js` also listened
   for the shortcut directly on the page, as a backup for when the Chrome command
   is unbound or conflicts with another extension. With no pre-loaded script,
   if the command ever breaks, pressing the keys does nothing. The toolbar icon
   and action popup still open the palette.
2. **Toast confirmations stop appearing** (e.g. "Switched tab"). They are sent to
   a content script that is no longer resident; the calls fail silently and never
   throw.
3. **First palette open per tab is slightly slower** — inject, then open — instead
   of instant.

Implementation status at the time of writing:

- Implemented on branch `activetab-migration` (tip `3da5d00`), not yet merged.
  `main` and the submitted v1.1.0 build are untouched.
- Repo test suite: 76/76 pass. Headless-Chrome sandbox: 6/6 checks pass.
- The real Cmd+Shift+K path could not be verified headlessly (synthetic keys do
  not trigger extension commands, so Chrome never grants `activeTab` in the
  sandbox). A manual check on a real machine — load the branch unpacked, press
  Cmd+Shift+K, confirm the palette opens and toggles — is still required before
  this ships.
- When this ships, two follow-ups: the live privacy policy still carries the old
  wording until the updated `docs/privacy-policy.md` is deployed to GitHub Pages,
  and the store listing's Privacy-tab justifications need updating (drop the host
  permission justification, describe scripting as on-demand injection).
