# Cue — Chrome Command Palette

A fast, no-frills Manifest V3 command palette for Google Chrome (`⌘⇧K` / `Ctrl+Shift+K`) — no account, no integrations, no data leaves your device. Built for company computers as much as personal ones. Featuring Dark Indigo Glass & Adaptive Light UI, MRU tab switching, interactive tab groups, custom bangs, and optional Chrome theme switching.

---

## UI & Appearance

### Dark Indigo Glass
![Dark Indigo Glass](docs/screenshots/01-overview-dark.png)

### Adaptive Light Mode
![Adaptive Light Mode](docs/screenshots/08-light-theme.png)

---

## Features & UX

### Bang Search Templates (`gh <query>`)
![Bang Search](docs/screenshots/02-bang-search.png)

### Fuzzy Search & Match Highlighting
![Fuzzy Search](docs/screenshots/03-fuzzy-search.png)

### Interactive Tab Group Picker (`⌘G`)
![Tab Group Picker](docs/screenshots/04-tab-group-picker.png)

### Commands, Domain Actions & Duplicate Cleanup (`>`)
![Commands Mode](docs/screenshots/05-commands-mode.png)

### Secondary Actions Popover (`⌘K`)
![Secondary Actions Popover](docs/screenshots/06-actions-popover.png)

### Chrome Theme Switcher (`/t`) & Inline Toasts
![Chrome Theme Switcher](docs/screenshots/07-theme-switcher.png)

### Quick Links & Bangs Options
![Options Page](docs/screenshots/09-options-page.png)

---

## Shortcuts & Prefixes

| Shortcut | Action |
| :--- | :--- |
| `⌘⇧K` / `Ctrl+Shift+K` | Toggle palette |
| `Tab` / `Shift+Tab` | Cycle filter chips (or group colors) |
| `⌘K` / `Ctrl+K` | Actions menu |
| `⌘⌫` / `Ctrl+Bksp` | Close tab |
| `⌘G` / `Ctrl+G` | Add tab to group |
| `⌘P` / `Ctrl+P` | Pin / unpin tab |
| `⌘M` / `Ctrl+M` | Mute / unmute tab |
| `⌘D` / `Ctrl+D` | Duplicate tab |
| `Esc` | Exit sub-mode / close |

| Prefix | Mode |
| :--- | :--- |
| `>` | Commands & `chrome://` pages |
| `@` | Open tabs |
| `*` | Bookmarks |
| `/h` | History (30 days) |
| `/g` | Tab groups |
| `/c` | Recently closed |
| `/t` | Chrome themes (optional — needs the `management` permission, granted in Options) |

---

## Privacy & Permissions

- **No account, no sign-in, no analytics.** Cue runs entirely on your device — tabs, bookmarks, and history never leave Chrome.
- **No third-party integrations, by design.** No Notion, Figma, Google Docs, or any other service is connected. Browsing data stays in the browser.
- **Minimal permissions.** The extension asks only for what the palette needs (tabs, bookmarks, history, storage). Chrome theme switching (`/t`) is opt-in: it needs the `management` permission, which can also enable or disable other extensions, so it is requested only when you enable theme switching in Options — everything else works without it.

---

## Install (Unpacked)

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Press **`⌘ + Shift + K`** (or **`Ctrl + Shift + K`**) on any page, or click the toolbar icon on `chrome://` pages.

## Tests

```bash
node --test tests/palette-core.test.js
```

