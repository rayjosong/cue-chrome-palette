# Cue — Privacy Policy

**Last updated:** 22 November 2026
**Developer:** Raymond Ong — https://github.com/rayjosong/cue-chrome-palette

Cue is a fast, no-frills command palette for Google Chrome. It has no account, no sign-in, no analytics, no advertising, and no third-party integrations. This policy states, in full, what Cue does with your data: it does not collect, transmit, sell, or share any of it.

## What Cue accesses, and why

Cue runs entirely in your browser. Everything it reads is processed on your device to show you results in the palette, and none of it leaves Chrome except as noted below.

- **Tabs** — to list, switch to, close, mute, pin, duplicate, and group your open tabs.
- **Bookmarks** — to search your bookmarks from the palette.
- **History** — to search your recent browsing history (last 30 days) from the palette.
- **Recently closed tabs** — to reopen tabs you just closed.
- **Tab groups** — to list your tab groups and add tabs to them.
- **Downloads** — to list your 30 most recent downloads so you can open them from the palette. Cue only reads the list; it does not read file contents.
- **Storage** — to remember your settings, custom bang shortcuts, and frecency ranking (which results you use most), so the palette gets faster for you over time.

When you invoke the palette (Cmd+Shift+K, or the toolbar icon), Cue injects a content script into the tab you are viewing, only to draw the palette overlay. The script is not loaded on any page until you invoke it. It does not read page contents, form inputs, or passwords, and it does not modify pages.

## The one exception: Chrome Sync

Your custom bang shortcuts and settings are stored in `chrome.storage.sync`. If you have Chrome Sync turned on, Google syncs that small settings data through your own Google account to your other signed-in Chrome browsers, under Google's own privacy terms. Cue's developer never sees it, and Cue sends nothing to any other server. If Chrome Sync is off, that data stays on the one device.

For the avoidance of doubt: your tabs, bookmarks, and browsing history never leave Chrome. They are not synced by Cue and are not sent anywhere.

## Optional permission: Chrome theme switching

Theme switching (`/t` in the palette) is off by default and needs the `management` permission, which Chrome grants only when you turn it on in Cue's Options page. It is used solely to list your installed Chrome themes and switch between them. It is never used to enable, disable, or manage any other extension, and everything else in Cue works without it. You can revoke it at any time in `chrome://extensions`, and theme switching simply turns itself off.

## What Cue does not do

- No analytics, telemetry, crash reporting, or tracking of any kind.
- No network requests to any server, including the developer's.
- No advertising and no sale or sharing of data with anyone.
- No account, no sign-in, and no third-party services (no Notion, Figma, Google Docs, or any other integration).

## Children

Cue is a general-purpose browser utility. It collects no personal data from anyone, including children.

## Changes

If this policy changes, the updated version will be posted here with a new "Last updated" date, and the change will be noted in the extension's release notes.

## Contact

Questions about this policy: open an issue at https://github.com/rayjosong/cue-chrome-palette
