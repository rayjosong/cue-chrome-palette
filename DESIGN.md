# Cue — Command Palette Design System & Benchmarks

A compiled reference of modern command palette UX/UI patterns from **Raycast**, **Linear**, **Arc Browser**, **VS Code**, and **`cmdk` (Vercel/shadcn)**, paired with Cue's concrete design tokens and roadmap.

---

## 1. Benchmark Breakdown: What the Best Apps Do

| App / Library | Signature Strength | Key Pattern to Borrow | What to Avoid |
| :--- | :--- | :--- | :--- |
| **Raycast** | Extensible OS launcher feel | **Secondary Action Panel (`⌘K`)** on any highlighted item; crisp icon containers; breadcrumb drill-downs | Deeply nested menus that hide common 1-keystroke actions |
| **Linear** | Speed, density, muscle memory | **High-contrast title + muted metadata**; instant fuzzy match; inline state-changing actions without page navigation | Overly tiny hit targets or low-contrast active row states |
| **Arc Browser** | Unified URL + command bar | **Intent recognition** (URL vs. search vs. browser command in one input); spatial, minimal chrome | Hiding useful power-user shortcuts behind opaque gestures |
| **VS Code** | Prefix-driven mode switching | **Single-character prefixes** (`>` commands, `@` symbols/tabs) with instant mode feedback | Cluttered raw text rows without visual icons or category badges |
| **`cmdk` (Vercel)** | Composable React primitives | **5-state discipline** (Default, Filtering, Empty/Fallback, Loading, Nested) + zero layout shift | Generic "No results" dead ends without a search fallback |

---

## 2. Structural Anatomy (6 Layers)

A high-craft command palette separates cleanly into six vertical layers:

1. **Backdrop (`qc-backdrop`)**
   - Radial dark vignette (`rgba(16,16,24,0.42)` → `rgba(6,6,10,0.62)`) + `blur(6px)` to pull focus away from busy webpages.
   - Modal anchored at `13vh` from the top (not vertically centered) so the list never jumps upward as results shrink.
2. **Container (`qc-modal`)**
   - Width: `min(650px, 92vw)`, `border-radius: 16px`, `backdrop-filter: blur(36px) saturate(185%)`.
   - Top specular highlight (`inset 0 1px 0 rgba(255,255,255,0.11)`) + deep ambient shadow (`0 32px 84px -12px rgba(0,0,0,0.78)`).
3. **Search Row (`qc-search-row`)**
   - Auto-focused `15.5px` input (`-0.01em` tracking), `17px` search icon, active **Mode Pill** (e.g., `Tabs`, `Commands`), and subtle `ESC` keycap.
4. **Scope / Filter Chips (`qc-chips`)**
   - Horizontal pill bar (`All`, `Tabs`, `Groups`, `Closed`, `Bookmarks`, `History`, `Commands`) clickable or cyclable via `Tab` / `Shift+Tab`.
5. **Results List (`qc-list`)**
   - `max-height: 410px` scrollable region.
   - **Section headers** (`11px` uppercase muted labels) on the default zero-query state.
   - **Active row**: subtle luminous fill (`rgba(255,255,255,0.095)`), `2.5px` indigo left accent bar (`#818cf8`), and right-aligned `↵` return hint.
6. **Footer (`qc-footer`)**
   - Low-contrast `11px` helper bar with tactile `<kbd>` keycaps (`↵ Open`, `⌘⌫ Close`, `⌘P Pin`, `⌘M Mute`, `⌘D Duplicate`) and prefix cheat sheet.

---

## 3. Design Tokens (Dark Indigo Glass)

### Surfaces & Borders
```css
--qc-bg-modal:        rgba(21, 21, 27, 0.88);
--qc-bg-popup:        #131317;
--qc-bg-footer:       rgba(12, 12, 16, 0.62);
--qc-bg-row-active:   rgba(255, 255, 255, 0.095);
--qc-border-subtle:   rgba(255, 255, 255, 0.075);
--qc-border-modal:    rgba(255, 255, 255, 0.12);
--qc-accent:          #818cf8; /* Indigo 400 */
--qc-highlight-bg:    rgba(129, 140, 248, 0.26);
```

### Typography
- **Font stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`
- **Monospace (keycaps):** `ui-monospace, SFMono-Regular, Menlo, monospace`
- **Hierarchy:**
  - Search input: `15.5px` / `400` / `#f7f7fa`
  - Row title: `13.5px` / `500` / `#f4f4f7`
  - Row subtitle (URL / path): `11.5px` / `400` / `rgba(255,255,255,0.40)`
  - Section label: `11px` / `600` / uppercase / `0.04em` / `rgba(255,255,255,0.36)`
  - Badges & keycaps: `10px–10.5px` / `500`

### Category Icon & Badge Palette
| Category | Foreground | Background Tint | Border Tint |
| :--- | :--- | :--- | :--- |
| **Tabs / Groups** | `#93c5fd` | `rgba(59, 130, 246, 0.14)` | `rgba(59, 130, 246, 0.18)` |
| **Bangs / Links** | `#c4b5fd` | `rgba(139, 92, 246, 0.16)` | `rgba(139, 92, 246, 0.22)` |
| **Actions** | `#86efac` | `rgba(34, 197, 94, 0.13)` | `rgba(34, 197, 94, 0.18)` |
| **Chrome / Closed** | `#fcd34d` | `rgba(245, 158, 11, 0.13)` | `rgba(245, 158, 11, 0.18)` |
| **Bookmarks** | `#f9a8d4` | `rgba(236, 72, 153, 0.13)` | `rgba(236, 72, 153, 0.18)` |

---

## 4. The 5 Essential UI States

1. **Zero-Query (Default) State:** Never show an empty box. Immediately populate **MRU Open Tabs**, **Tab Groups**, **Recently Closed**, **Quick Links**, and top **Actions** under clean section headers.
2. **Typing / Filtering State:** Rank exact bang matches > current-window MRU tabs > actions > bookmarks > history. Highlight matched substrings in titles (`<mark class="qc-hl">`).
3. **No-Results / Fallback State:** Always provide **Open URL** (if the query looks like a domain or `localhost:port`) and **Search Google for "…"** so `Enter` is never a dead end.
4. **Scoped Mode State:** Triggered either by clicking a filter chip, pressing `Tab`, or typing a prefix (`>`, `@`, `*`, `/h `, `/g `, `/c `). Visually reinforced by the indigo mode pill.
5. **Inline Mutation State:** Destructive or quick-toggle tab actions (`⌘⌫` close, `⌘P` pin, `⌘M` mute, `⌘D` duplicate) update the list in place without dismissing the palette.

---

## 5. Next Design & UX Roadmap for Cue

* **Non-contiguous fuzzy highlighting:** Highlight individual matched characters (e.g., `g` + `h` in **G**it**H**ub) when fuzzy-matching rather than only contiguous substrings.
* **Raycast-style Secondary Action Menu:** Pressing `⌘K` *while the palette is open* reveals item-specific actions (e.g., *Move Tab to Group X*, *Copy as Markdown*, *Close All from Domain*).
* **Inline Toast Feedback:** Brief, non-blocking pill (`Copied URL`, `Tab Pinned`) when an action runs in place.
* **Adaptive Light Theme:** Optional `prefers-color-scheme: light` token set for users on light macOS appearances.

