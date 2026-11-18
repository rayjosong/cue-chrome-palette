# Cue — Design Options Comparison

All three design directions explored so far, split into clear options so you can choose which direction to lock in.

---

## Option 1: Dark Indigo Glass (Raycast / Linear Spec) — *Currently Active*

**Grounded in:** Raycast, Linear, VS Code Quick Open, `cmdk`, and `/Users/raymond.ong/Downloads/DESIGN.md`

### Visual & Interaction Profile
* **Surface:** Frosted dark glass (`rgba(21, 21, 27, 0.88)` + `blur(36px) saturate(185%)`), `16px` modal radius, layered shadow, top specular inset highlight.
* **Adaptive Theme:** Automatic `@media (prefers-color-scheme: light)` support across overlay and `650px` popup.
* **Accent & Color:** Indigo (`#818cf8` dark / `#6366f1` light) for active selection bar, chips, and fuzzy match highlights; semantic kind tints (blue tabs, violet bangs, green actions, amber Chrome, pink bookmarks, slate history).
* **Polish Included Now:**
  * Contextual footer (hints adapt to the selected row's kind) + `.qc-kbd` prefix legend
  * Subsequence fuzzy-match highlighting in titles
  * Rich empty state with mode icon + `Search Google` / `Search in All` actions
  * `100ms` exit animation + `prefers-reduced-motion` support
  * Clear button (`✕`), active chip counts (`Tabs · 12`), and full ARIA `dialog` / `combobox` / `listbox` semantics

**Best if you want:** A native macOS Raycast/Linear feel that pops cleanly over any webpage and stays fast.

---

## Option 2: Google Material Design 3 + Meta Clarity

**Grounded in:** Material Design 3 (tonal elevation, `24px` dialog radius, state layers) + Meta Design Principles (strict `8px` grid, high-legibility hierarchy, circular icon tiles)

### Visual & Interaction Profile
* **Surface:** Stepped solid tonal elevation (`#22242A` container over `#1B1D22` footer) instead of heavy translucent blur, `24px` outer corner radius, subtle `1px` hairline border.
* **Iconography & Rows:** `36px` circular tonal icon containers, `56px` airy rows on an `8px` grid, clean `#E4E6EB` / `#9AA0A6` text contrast.
* **Chips & Selection:** Full-pill filter chips (`✓ All` active in tonal blue `#2A3342` / `#A8C7FA`), soft rounded `12px` row selection without a sharp left bar.
* **Preview:** `quickcmd_google_meta_design_1794948142323.jpg`

**Best if you want:** Maximum readability over busy pages (no blur bleed-through), a softer Google/Chrome-native feel, and generous breathing room.

---

## Option 3: Minimalist High-Density (VS Code / Spotlight Hybrid)

**Grounded in:** VS Code Quick Open + Spotlight power-user density

### Visual & Interaction Profile
* **Surface:** Compact `600px`–`620px` card docked closer to the top (`8vh`), minimal or no backdrop blur.
* **Rows:** Tight `34px`–`38px` single-line rows (icon + title + inline muted domain/path on the same line) so 10–12+ items fit without scrolling.
* **Chrome:** No filter chip bar by default (relies on `>`, `@`, `*`, `/h`, `/g`, `/c` prefixes) and a single-line compact footer.

**Best if you want:** Maximum information density and zero visual chrome when juggling 40+ tabs.

