(() => {
  if (window.__CueCreatePalette) return;

  const Core = window.__CueCore;
  if (!Core) return;

  const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
  const modSymbol = isMac ? "⌘" : "Ctrl+";
  const delSymbol = isMac ? "⌘⌫" : "Ctrl+Bksp";
  const shiftDelSymbol = isMac ? "⌘⇧⌫" : "Ctrl+Shift+Bksp";

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (res) => {
        resolve(res || { ok: false });
      });
    });
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // Fall back to execCommand
      }
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      (document.body || document.documentElement).appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      textarea.remove();
      return Boolean(success);
    } catch (_) {
      return false;
    }
  }

  function createSvgIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    const paths = {
      globe: [
        ["circle", { cx: "12", cy: "12", r: "10" }],
        ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
        ["path", { d: "M2 12h20" }]
      ],
      zap: [["polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }]],
      pin: [
        ["path", { d: "M12 17v5" }],
        [
          "path",
          {
            d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
          }
        ]
      ],
      mute: [
        ["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }],
        ["line", { x1: "22", y1: "9", x2: "16", y2: "15" }],
        ["line", { x1: "16", y1: "9", x2: "22", y2: "15" }]
      ],
      volume: [
        ["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }],
        ["path", { d: "M15.54 8.46a5 5 0 0 1 0 7.07" }],
        ["path", { d: "M19.07 4.93a10 10 0 0 1 0 14.14" }]
      ],
      copy: [
        ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }],
        ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }]
      ],
      link: [
        ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
        ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]
      ],
      x: [
        ["path", { d: "M18 6 6 18" }],
        ["path", { d: "m6 6 12 12" }]
      ],
      window: [
        ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
        ["path", { d: "M3 9h18" }]
      ],
      split: [
        ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
        ["path", { d: "M12 3v18" }]
      ],
      incognito: [
        ["path", { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" }],
        ["circle", { cx: "12", cy: "12", r: "3" }]
      ],
      settings: [
        ["circle", { cx: "12", cy: "12", r: "3" }],
        [
          "path",
          {
            d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          }
        ]
      ],
      star: [
        ["polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }]
      ],
      history: [
        ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
        ["path", { d: "M3 3v5h5" }],
        ["path", { d: "M12 7v5l4 2" }]
      ],
      layers: [
        ["polygon", { points: "12 2 2 7 12 12 22 7 12 2" }],
        ["polyline", { points: "2 17 12 22 22 17" }],
        ["polyline", { points: "2 12 12 17 22 12" }]
      ],
      search: [
        ["circle", { cx: "11", cy: "11", r: "8" }],
        ["path", { d: "m21 21-4.3-4.3" }]
      ],
      rotateCcw: [
        ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
        ["path", { d: "M3 3v5h5" }]
      ],
      palette: [
        ["circle", { cx: "13.5", cy: "6.5", r: ".5" }],
        ["circle", { cx: "17.5", cy: "10.5", r: ".5" }],
        ["circle", { cx: "8.5", cy: "7.5", r: ".5" }],
        ["circle", { cx: "6.5", cy: "12.5", r: ".5" }],
        [
          "path",
          {
            d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
          }
        ]
      ],
      plus: [
        ["path", { d: "M12 5v14" }],
        ["path", { d: "M5 12h14" }]
      ],
      check: [["polyline", { points: "20 6 9 17 4 12" }]],
      puzzle: [
        ["path", { d: "M15 4a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2h-2a2 2 0 1 0-4 0H7a2 2 0 0 1-2-2v-1H4a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4V9a2 2 0 0 1 2-2h1V6a2 2 0 0 1 2-2h2a2 2 0 1 0 4 0h2z" }]
      ],
      download: [
        ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
        ["polyline", { points: "7 10 12 15 17 10" }],
        ["line", { x1: "12", y1: "15", x2: "12", y2: "3" }]
      ]
    };

    for (const [tag, attrs] of paths[name] || paths.globe) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
      }
      svg.appendChild(el);
    }
    return svg;
  }

  function renderHighlightedText(container, text, query) {
    container.textContent = "";
    const segments = Core.getHighlightRanges(text || "", query || "");
    for (const seg of segments) {
      if (!seg.text) continue;
      if (seg.matched) {
        const mark = document.createElement("mark");
        mark.className = "qc-hl";
        mark.textContent = seg.text;
        container.appendChild(mark);
      } else {
        container.appendChild(document.createTextNode(seg.text));
      }
    }
  }

  window.__CueCreatePalette = function createPalette({ container, isPopup = false, onClose }) {
    const backdrop = document.createElement("div");
    backdrop.className = `qc-backdrop${isPopup ? " qc-is-popup" : ""}`;

    // Isolate all keyboard events from leaking to the host page (GitHub, YouTube, Gmail, etc.)
    for (const evtName of ["keydown", "keyup", "keypress"]) {
      backdrop.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }

    const modal = document.createElement("div");
    modal.className = "qc-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Cue command palette");
    modal.tabIndex = -1;
    backdrop.appendChild(modal);

    const searchRow = document.createElement("div");
    searchRow.className = "qc-search-row";

    const searchIcon = createSvgIcon("search");
    searchIcon.classList.add("qc-search-icon");

    const listId = "qc-results-listbox";
    const defaultPlaceholder = "Search tabs, bookmarks, history, or type > for commands…";
    const input = document.createElement("input");
    input.className = "qc-input";
    input.type = "text";
    input.placeholder = defaultPlaceholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", listId);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "qc-clear-btn";
    clearBtn.title = "Clear search";
    clearBtn.textContent = "✕";
    clearBtn.style.display = "none";

    const modePill = document.createElement("span");
    modePill.className = "qc-mode-pill";
    modePill.style.display = "none";

    const escPill = document.createElement("span");
    escPill.className = "qc-esc-pill";
    escPill.textContent = "ESC";

    searchRow.append(searchIcon, input, clearBtn, modePill, escPill);

    const CHIP_MODES = Core.CHIP_MODES;
    let chipMode = "all";
    let activeGroup = null;
    let groupPickerContext = null; // { tabIds: number[], defaultTitle: string, domain?: string }
    let groupEditContext = null; // { groupId: number, title: string, color: string }
    let windowPickerContext = null; // { tabId: number }
    let splitPickerContext = null; // { tabIds: number[], layoutId: string }
    let selectedGroupColor = "blue";

    const chipsBar = document.createElement("div");
    chipsBar.className = "qc-chips";
    const chipButtons = new Map();
    for (const c of CHIP_MODES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `qc-chip${c.id === chipMode ? " qc-chip-active" : ""}`;
      btn.textContent = c.label;
      btn.addEventListener("click", () => {
        activeGroup = null;
        groupPickerContext = null;
        groupEditContext = null;
        windowPickerContext = null;
        splitPickerContext = null;
        input.placeholder = defaultPlaceholder;
        chipMode = c.id;
        selectedIndex = 0;
        render();
        input.focus();
      });
      chipButtons.set(c.id, btn);
      chipsBar.appendChild(btn);
    }

    const colorBar = document.createElement("div");
    colorBar.className = "qc-color-bar";
    colorBar.style.display = "none";

    const splitBar = document.createElement("div");
    splitBar.className = "qc-split-bar";
    splitBar.style.display = "none";

    const listEl = document.createElement("div");
    listEl.className = "qc-list";
    listEl.id = listId;
    listEl.setAttribute("role", "listbox");

    const toastEl = document.createElement("div");
    toastEl.className = "qc-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");

    const liveRegion = document.createElement("div");
    liveRegion.className = "qc-sr-only";
    liveRegion.setAttribute("aria-live", "polite");

    const footer = document.createElement("div");
    footer.className = "qc-footer";

    const hints = document.createElement("div");
    hints.className = "qc-hints";

    const actionsTrigger = document.createElement("button");
    actionsTrigger.type = "button";
    actionsTrigger.className = "qc-actions-trigger";
    const actText = document.createTextNode("Actions ");
    const actKbd = document.createElement("kbd");
    actKbd.className = "qc-kbd";
    actKbd.textContent = `${modSymbol}K`;
    actionsTrigger.append(actText, actKbd);
    footer.append(hints, actionsTrigger);

    const popover = document.createElement("div");
    popover.className = "qc-actions-popover";
    popover.style.display = "none";

    const popoverSearch = document.createElement("div");
    popoverSearch.className = "qc-popover-search";
    const popoverInput = document.createElement("input");
    popoverInput.className = "qc-popover-input";
    popoverInput.type = "text";
    popoverInput.placeholder = "Filter actions…";
    popoverSearch.appendChild(popoverInput);

    const popoverList = document.createElement("div");
    popoverList.className = "qc-popover-list";

    popover.append(popoverSearch, popoverList);

    modal.append(searchRow, chipsBar, colorBar, splitBar, listEl, toastEl, liveRegion, footer, popover);
    container.appendChild(backdrop);

    let data = {
      tabs: [],
      tabGroups: [],
      closedTabs: [],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [],
      themes: [],
      extensions: [],
      downloads: [],
      windows: [],
      frecency: {},
      activeTab: null
    };
    let currentItems = [];
    let selectedIndex = 0;
    let isClosing = false;
    let popoverOpen = false;
    let popoverItems = [];
    let popoverIndex = 0;
    let popoverQuery = "";
    let toastTimer = null;

    popoverInput.addEventListener("input", () => {
      popoverQuery = popoverInput.value;
      popoverIndex = 0;
      renderPopover();
    });

    function showToast(msg) {
      if (!msg) return;
      toastEl.textContent = msg;
      toastEl.classList.add("qc-toast-visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.classList.remove("qc-toast-visible");
      }, 2100);
    }

    function recordItemUsage(item) {
      if (!item) return;
      if (item.kind === "action" || item.kind === "bang" || item.kind === "bookmark" || item.kind === "chrome" || item.kind === "theme" || item.kind === "extension" || item.kind === "download") {
        const usageId = item.frecencyId || item.id;
        sendRuntimeMessage({ type: "RECORD_USAGE", itemId: usageId }).then((res) => {
          if (res?.ok && res.frecency) {
            data.frecency = res.frecency;
          }
        });
      }
    }

    function openGroupPicker({ tabIds, defaultTitle = "Group", domain = "" }) {
      if (!tabIds || !tabIds.length) return;
      activeGroup = null;
      groupPickerContext = { tabIds, defaultTitle, domain };
      groupEditContext = null;
      windowPickerContext = null;
      splitPickerContext = null;
      input.value = "";
      input.placeholder = `Filter existing groups or type a name (default: "${defaultTitle}")…`;
      selectedIndex = 0;
      render();
      input.focus();
    }

    function openGroupEditor(group) {
      if (!group) return;
      activeGroup = null;
      groupPickerContext = null;
      windowPickerContext = null;
      splitPickerContext = null;
      let colorName = "blue";
      const dataGroup = (data.tabGroups || []).find((g) => g.id === group.groupId);
      if (dataGroup && dataGroup.color) {
        colorName = dataGroup.color;
      } else if (group.groupColor) {
        for (const [name, hex] of Object.entries(Core.GROUP_COLOR_HEX)) {
          if (hex.toLowerCase() === group.groupColor.toLowerCase() || name.toLowerCase() === group.groupColor.toLowerCase()) {
            colorName = name;
            break;
          }
        }
      }
      selectedGroupColor = colorName;
      groupEditContext = {
        groupId: group.groupId,
        title: group.groupTitle || dataGroup?.title || "",
        color: colorName
      };
      input.value = groupEditContext.title;
      input.placeholder = "Enter group title (Enter to save, Esc to cancel)…";
      selectedIndex = 0;
      render();
      input.focus();
      input.select();
    }

    function openWindowPicker({ tabId }) {
      if (!tabId) return;
      activeGroup = null;
      groupPickerContext = null;
      groupEditContext = null;
      windowPickerContext = { tabId };
      splitPickerContext = null;
      input.value = "";
      input.placeholder = "Select target window to move tab…";
      selectedIndex = 0;
      render();
      input.focus();
    }

    function getScreenBounds() {
      return {
        left: typeof window.screen?.availLeft === "number" ? window.screen.availLeft : 0,
        top: typeof window.screen?.availTop === "number" ? window.screen.availTop : 0,
        width:
          typeof window.screen?.availWidth === "number" && window.screen.availWidth > 0
            ? window.screen.availWidth
            : window.innerWidth || 1200,
        height:
          typeof window.screen?.availHeight === "number" && window.screen.availHeight > 0
            ? window.screen.availHeight
            : window.innerHeight || 800
      };
    }

    async function executeSplitTabs(tabIds, layoutId = "") {
      const uniqueIds = [...new Set(tabIds)].filter((id) => Number.isFinite(id));
      if (uniqueIds.length < 2) {
        showToast("Select at least 2 tabs to split");
        return false;
      }
      const layouts = Core.getAvailableSplitLayouts(uniqueIds.length);
      const activeLayout = layouts.find((l) => l.id === layoutId) || layouts[0];
      const isNative = activeLayout?.id === "native" && uniqueIds.length === 2;
      const payload = isNative
        ? {
            action: "SPLIT_TABS",
            mode: "native",
            tabIds: uniqueIds,
            layoutLabel: activeLayout.label
          }
        : {
            action: "SPLIT_TABS",
            tabIds: uniqueIds,
            rects: Core.computeSplitLayouts(uniqueIds.length, getScreenBounds(), activeLayout?.id || ""),
            layoutLabel: activeLayout?.label || ""
          };
      const res = await sendRuntimeMessage({
        type: "EXECUTE_ACTION",
        payload
      });
      if (!res?.ok) {
        showToast(res?.error || "Could not split tabs");
        return false;
      }
      return true;
    }

    function openSplitPicker({ tabIds = [], layoutId = "" } = {}) {
      activeGroup = null;
      groupPickerContext = null;
      groupEditContext = null;
      windowPickerContext = null;
      const initialIds = tabIds.length
        ? [...new Set(tabIds)]
        : data.activeTab?.id != null
        ? [data.activeTab.id]
        : [];
      splitPickerContext = { tabIds: initialIds, layoutId };
      input.value = "";
      input.placeholder = "Filter tabs (Tab or click to select, Enter to split)…";
      selectedIndex = 0;
      render();
      input.focus();
    }

    function exitSubMode() {
      activeGroup = null;
      groupPickerContext = null;
      groupEditContext = null;
      windowPickerContext = null;
      splitPickerContext = null;
      input.value = "";
      input.placeholder = defaultPlaceholder;
      selectedIndex = 0;
      render();
      input.focus();
    }

    async function executeDescriptor(descriptor, item = null) {
      if (!descriptor) return { closesPalette: true };
      recordItemUsage(item);

      switch (descriptor.type) {
        case "OPEN_GROUP_PICKER": {
          openGroupPicker({
            tabIds: descriptor.tabIds,
            defaultTitle: descriptor.defaultTitle || "Group",
            domain: descriptor.domain || ""
          });
          return { closesPalette: false };
        }
        case "OPEN_WINDOW_PICKER": {
          openWindowPicker({ tabId: descriptor.tabId });
          return { closesPalette: false };
        }
        case "OPEN_SPLIT_PICKER": {
          openSplitPicker({ tabIds: descriptor.tabIds || [] });
          return { closesPalette: false };
        }
        case "DRILL_GROUP": {
          activeGroup = descriptor.group;
          groupPickerContext = null;
          groupEditContext = null;
          windowPickerContext = null;
          splitPickerContext = null;
          input.value = "";
          selectedIndex = 0;
          render();
          return { closesPalette: false };
        }
        case "ENTER_MODE": {
          activeGroup = null;
          groupPickerContext = null;
          groupEditContext = null;
          windowPickerContext = null;
          splitPickerContext = null;
          chipMode = "all";
          input.value = descriptor.prefix || "";
          selectedIndex = 0;
          render();
          input.focus();
          return { closesPalette: false };
        }
        case "COPY_TEXT": {
          const ok = await copyToClipboard(descriptor.text || "");
          showToast(ok ? (descriptor.toast || "Copied URL to clipboard") : "Failed to copy");
          input.focus();
          return { closesPalette: false };
        }
        case "EXECUTE_ACTION": {
          const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: descriptor.payload });
          const keepsOpen = Boolean(descriptor.keepsOpen || item?.keepsOpen);
          if (keepsOpen) {
            if (res?.toast) showToast(res.toast);
            else if (res?.error) showToast(res.error);
            await refreshData(currentItems[selectedIndex]?.id);
            return { closesPalette: false };
          }
          return { closesPalette: true };
        }
        default:
          return { closesPalette: true };
      }
    }

    function hydrateItem(item) {
      if (item.run) return item;
      const keepsOpen = Boolean(
        item.keepsOpen ||
          item.actionDescriptor?.keepsOpen ||
          item.actionDescriptor?.type === "OPEN_GROUP_PICKER" ||
          item.actionDescriptor?.type === "OPEN_WINDOW_PICKER" ||
          item.actionDescriptor?.type === "OPEN_SPLIT_PICKER" ||
          item.actionDescriptor?.type === "DRILL_GROUP" ||
          item.actionDescriptor?.type === "ENTER_MODE" ||
          item.actionDescriptor?.type === "COPY_TEXT"
      );
      return {
        ...item,
        keepsOpen,
        run: async () => {
          await executeDescriptor(item.actionDescriptor, item);
        }
      };
    }

    function getActionsForItem(item) {
      if (!item) return [];
      const list = [];
      if (item.kind === "tab") {
        const tabDomain = Core.extractHostname(item.subtitle || "");
        const tabAnalysis = Core.analyzeTabs(data.tabs || [], { url: item.subtitle || "" });
        const isBookmarked = (data.bookmarks || []).some((b) => b.url === item.subtitle);
        const tabBaseDomain = Core.extractBaseDomain ? Core.extractBaseDomain(item.subtitle || "") : tabDomain;
        list.push(
          {
            title: "Switch to Tab",
            shortcut: "↵",
            iconName: "globe",
            closesPalette: true,
            run: () => item.run()
          },
          {
            title: "Reload Tab",
            iconName: "rotateCcw",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "RELOAD_TAB", tabId: item.tabId, bypassCache: false } });
              if (res?.toast) showToast(res.toast);
            }
          },
          {
            title: "Hard Reload Tab",
            iconName: "rotateCcw",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "RELOAD_TAB", tabId: item.tabId, bypassCache: true } });
              if (res?.toast) showToast(res.toast);
            }
          }
        );
        if (item.subtitle && /^https?:\/\//i.test(item.subtitle)) {
          list.push({
            title: "Open in Incognito",
            iconName: "incognito",
            closesPalette: true,
            run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_IN_INCOGNITO", url: item.subtitle } })
          });
        }
        list.push(
          {
            title: "Add / Move Tab to Group…",
            shortcut: `${modSymbol}G`,
            iconName: "layers",
            closesPalette: false,
            run: async () => {
              openGroupPicker({
                tabIds: [item.tabId],
                defaultTitle: tabAnalysis.suggestedGroupTitle || "Group"
              });
            }
          },
          {
            title: "Pin / Unpin Tab",
            shortcut: `${modSymbol}P`,
            iconName: "pin",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "PIN_TAB", tabId: item.tabId } });
              if (res?.toast) showToast(res.toast);
            }
          },
          {
            title: "Mute / Unmute Tab",
            shortcut: `${modSymbol}M`,
            iconName: "mute",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "MUTE_TAB", tabId: item.tabId } });
              if (res?.toast) showToast(res.toast);
            }
          },
          {
            title: "Duplicate Tab",
            shortcut: `${modSymbol}D`,
            iconName: "copy",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "DUPLICATE_TAB", tabId: item.tabId } });
              if (res?.toast) showToast(res.toast);
            }
          },
          {
            title: "Copy Tab URL",
            shortcut: `${modSymbol}C`,
            iconName: "link",
            closesPalette: false,
            run: async () => {
              if (item.subtitle && navigator.clipboard) {
                await navigator.clipboard.writeText(item.subtitle);
                showToast("Copied URL to clipboard");
              }
            }
          }
        );
        if (item.subtitle && /^https?:\/\//i.test(item.subtitle)) {
          list.push({
            title: isBookmarked ? "Remove Bookmark" : "Bookmark Tab",
            iconName: "star",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: { action: "TOGGLE_BOOKMARK", url: item.subtitle, title: item.title }
              });
              if (res?.toast) showToast(res.toast);
              await refreshData();
            }
          });
        }
        if ((data.windows || []).length > 1) {
          list.push({
            title: "Move Tab to Window…",
            iconName: "window",
            closesPalette: false,
            run: () => openWindowPicker({ tabId: item.tabId })
          });
        }
        if (data.activeTab && item.tabId !== data.activeTab.id) {
          list.push({
            title: "Split with Current Tab",
            iconName: "split",
            closesPalette: true,
            run: async () => {
              await executeSplitTabs([data.activeTab.id, item.tabId], "native");
            }
          });
        }
        const rawTab = (data.tabs || []).find((t) => t.id === item.tabId);
        if (rawTab?.splitViewId != null && rawTab.splitViewId !== -1) {
          list.push({
            title: "Unsplit Tab",
            iconName: "split",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: { action: "UNSPLIT_TAB", splitViewId: rawTab.splitViewId }
              });
              if (res?.toast) showToast(res.toast);
              else if (res?.error) showToast(res.error);
              await refreshData();
            }
          });
        }
        if ((data.tabs || []).length >= 2) {
          list.push({
            title: "Add to Split View…",
            iconName: "split",
            closesPalette: false,
            run: () => {
              const seed =
                data.activeTab && data.activeTab.id !== item.tabId
                  ? [data.activeTab.id, item.tabId]
                  : [item.tabId];
              openSplitPicker({ tabIds: seed });
            }
          });
        }
        list.push({
          title: "Copy Tab URL",
          iconName: "link",
          closesPalette: false,
          run: async () => {
            const ok = await copyToClipboard(item.subtitle || "");
            showToast(ok ? "Copied URL to clipboard" : "Failed to copy");
            input.focus();
          }
        });
        if (item.subtitle && /^https?:\/\//i.test(item.subtitle)) {
          list.push(
            {
              title: "Copy as Markdown",
              iconName: "copy",
              closesPalette: false,
              run: async () => {
                const ok = await copyToClipboard(Core.formatMarkdownLink(item.title, item.subtitle));
                showToast(ok ? "Copied Markdown link to clipboard" : "Failed to copy");
                input.focus();
              }
            },
            {
              title: "Copy Clean URL",
              iconName: "link",
              closesPalette: false,
              run: async () => {
                const ok = await copyToClipboard(Core.stripTrackingParams(item.subtitle));
                showToast(ok ? "Copied clean URL to clipboard" : "Failed to copy");
                input.focus();
              }
            }
          );
        }
        if (tabDomain && tabAnalysis.domainCount > 1) {
          const closeDomainAction = {
            title: `Close All ${tabDomain} Tabs (${tabAnalysis.domainCount})`,
            iconName: "x",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: { action: "CLOSE_DOMAIN_TABS", domain: tabDomain }
              });
              if (res?.toast) showToast(res.toast);
            }
          };
          if (tabAnalysis.baseDomainCount === tabAnalysis.domainCount) {
            closeDomainAction.shortcut = shiftDelSymbol;
          }
          list.push(
            {
              title: `Group All ${tabDomain} Tabs (${tabAnalysis.domainCount})…`,
              iconName: "layers",
              closesPalette: false,
              run: async () => {
                openGroupPicker({
                  tabIds: tabAnalysis.domainTabIds,
                  defaultTitle: tabAnalysis.suggestedGroupTitle || tabDomain,
                  domain: tabDomain
                });
              }
            },
            closeDomainAction
          );
        }
        if (
          tabBaseDomain &&
          tabAnalysis.baseDomainCount > 1 &&
          tabAnalysis.baseDomainCount > tabAnalysis.domainCount
        ) {
          list.push(
            {
              title: `Group All ${tabBaseDomain} Website Tabs (${tabAnalysis.baseDomainCount})…`,
              iconName: "layers",
              closesPalette: false,
              run: async () => {
                openGroupPicker({
                  tabIds: tabAnalysis.baseDomainTabIds,
                  defaultTitle: tabAnalysis.suggestedGroupTitle || tabBaseDomain,
                  domain: tabBaseDomain
                });
              }
            },
            {
              title: `Close All ${tabBaseDomain} Website Tabs (${tabAnalysis.baseDomainCount})`,
              shortcut: shiftDelSymbol,
              iconName: "x",
              closesPalette: false,
              run: async () => {
                const res = await sendRuntimeMessage({
                  type: "EXECUTE_ACTION",
                  payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: tabBaseDomain }
                });
                if (res?.toast) showToast(res.toast);
              }
            }
          );
        }
        list.push({
          title: "Close Tab",
          shortcut: delSymbol,
          iconName: "x",
          closesPalette: false,
          run: async () => {
            const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "CLOSE_TAB", tabId: item.tabId } });
            if (res?.toast) showToast(res.toast);
          }
        });
      } else if (item.kind === "group") {
        list.push(
          {
            title: "View Tabs in Group",
            shortcut: "↵",
            iconName: "layers",
            closesPalette: false,
            run: () => {
              activeGroup = { id: item.groupId, title: item.groupTitle, color: item.groupColor };
              input.value = "";
              selectedIndex = 0;
              render();
            }
          },
          {
            title: "Switch to First Tab in Group",
            iconName: "globe",
            closesPalette: true,
            run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "FOCUS_GROUP", groupId: item.groupId } })
          },
          {
            title: "Rename / Recolor Group…",
            iconName: "palette",
            closesPalette: false,
            run: () => openGroupEditor(item)
          },
          {
            title: item.groupCollapsed ? "Expand Group" : "Collapse Group",
            iconName: "layers",
            closesPalette: false,
            run: async () => {
              await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "TOGGLE_GROUP_COLLAPSE", groupId: item.groupId } });
              showToast(item.groupCollapsed ? "Expanded group" : "Collapsed group");
            }
          },
          {
            title: "Ungroup All Tabs",
            iconName: "layers",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "UNGROUP_ALL_IN_GROUP", groupId: item.groupId } });
              if (res?.toast) showToast(res.toast);
              await refreshData();
            }
          },
          {
            title: "Close All Tabs in Group",
            iconName: "x",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "CLOSE_GROUP_TABS", groupId: item.groupId } });
              if (res?.toast) showToast(res.toast);
              await refreshData();
            }
          }
        );
      } else if (item.kind === "extension") {
        list.push({
          title: item.enterVerb || "Toggle Extension",
          iconName: "puzzle",
          closesPalette: false,
          run: () => item.run()
        });
        if (item.optionsUrl) {
          list.push({
            title: "Open Extension Options",
            iconName: "settings",
            closesPalette: true,
            run: () => sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_EXTENSION_OPTIONS", extensionId: item.extensionId }
            })
          });
        }
      } else if (item.kind === "download") {
        list.push(
          {
            title: "Open Download",
            iconName: "download",
            closesPalette: true,
            run: () => sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_DOWNLOAD", downloadId: item.downloadId }
            })
          },
          {
            title: "Show in Folder",
            iconName: "window",
            closesPalette: false,
            run: async () => {
              const res = await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: { action: "SHOW_DOWNLOAD_IN_FOLDER", downloadId: item.downloadId }
              });
              if (res?.toast) showToast(res.toast);
            }
          }
        );
        if (item.downloadUrl || (item.subtitle && /^https?:\/\//i.test(item.subtitle))) {
          const dUrl = item.downloadUrl || item.subtitle;
          list.push({
            title: "Copy Download URL",
            iconName: "link",
            closesPalette: false,
            run: async () => {
              const ok = await copyToClipboard(dUrl);
              showToast(ok ? "Copied Download URL to clipboard" : "Failed to copy");
              input.focus();
            }
          });
        }
      } else {
        list.push({
          title: item.enterVerb || "Open",
          shortcut: "↵",
          iconName: item.iconName || "globe",
          closesPalette: !item.keepsOpen,
          run: () => item.run()
        });
        if (item.subtitle && /^https?:\/\//i.test(item.subtitle)) {
          list.push(
            {
              title: "Copy URL",
              shortcut: `${modSymbol}C`,
              iconName: "link",
              closesPalette: false,
              run: async () => {
                const ok = await copyToClipboard(item.subtitle || "");
                showToast(ok ? "Copied URL to clipboard" : "Failed to copy");
                input.focus();
              }
            },
            {
              title: "Copy as Markdown",
              iconName: "copy",
              closesPalette: false,
              run: async () => {
                const ok = await copyToClipboard(Core.formatMarkdownLink(item.title, item.subtitle));
                showToast(ok ? "Copied Markdown link to clipboard" : "Failed to copy");
                input.focus();
              }
            },
            {
              title: "Copy Clean URL",
              iconName: "link",
              closesPalette: false,
              run: async () => {
                const ok = await copyToClipboard(Core.stripTrackingParams(item.subtitle));
                showToast(ok ? "Copied clean URL to clipboard" : "Failed to copy");
                input.focus();
              }
            }
          );
        }
      }
      return list;
    }

    function getFilteredPopoverItems() {
      const q = popoverQuery.trim();
      if (!q) return popoverItems;
      return popoverItems.filter((act) => Core.fuzzyMatch(act.title, q).score > 0);
    }

    function closePopover() {
      popoverOpen = false;
      popover.style.display = "none";
      popoverQuery = "";
      if (popoverInput) popoverInput.value = "";
      popoverList.textContent = "";
      input.focus();
    }

    function renderPopover() {
      const filtered = getFilteredPopoverItems();
      popoverList.textContent = "";

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "qc-popover-empty";
        empty.textContent = "No matching actions";
        popoverList.appendChild(empty);
        return;
      }

      if (popoverIndex >= filtered.length) {
        popoverIndex = 0;
      } else if (popoverIndex < 0) {
        popoverIndex = 0;
      }

      filtered.forEach((act, idx) => {
        const row = document.createElement("div");
        row.className = `qc-item${idx === popoverIndex ? " qc-selected" : ""}`;
        const iconBox = document.createElement("div");
        iconBox.className = "qc-item-icon";
        iconBox.appendChild(createSvgIcon(act.iconName || "zap"));
        const main = document.createElement("div");
        main.className = "qc-item-main";
        const title = document.createElement("div");
        title.className = "qc-item-title";
        renderHighlightedText(title, act.title, popoverQuery);
        main.appendChild(title);
        row.append(iconBox, main);

        if (act.shortcut) {
          const kbd = document.createElement("kbd");
          kbd.className = "qc-kbd qc-popover-shortcut";
          kbd.textContent = act.shortcut;
          row.appendChild(kbd);
        }

        row.addEventListener("mouseenter", () => {
          popoverIndex = idx;
          const rows = popoverList.querySelectorAll(".qc-item");
          rows.forEach((r, i) => {
            if (i === idx) r.classList.add("qc-selected");
            else r.classList.remove("qc-selected");
          });
        });

        row.addEventListener("click", async () => {
          closePopover();
          await act.run();
          if (act.closesPalette) {
            closeWithMotion();
          } else {
            await refreshData();
          }
        });

        popoverList.appendChild(row);
      });

      const selectedEl = popoverList.querySelector(".qc-selected");
      if (selectedEl) selectedEl.scrollIntoView({ block: "nearest" });
    }

    function togglePopover() {
      if (popoverOpen) {
        closePopover();
        return;
      }
      const selected = currentItems[selectedIndex];
      popoverItems = getActionsForItem(selected);
      if (!popoverItems.length) return;
      popoverIndex = 0;
      popoverQuery = "";
      if (popoverInput) popoverInput.value = "";
      popoverOpen = true;
      popover.style.display = "flex";
      renderPopover();
      popoverInput.focus();
    }

    actionsTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopover();
    });

    function closeWithMotion() {
      if (isClosing) return;
      isClosing = true;
      if (isPopup) {
        onClose();
        return;
      }
      backdrop.classList.add("qc-closing");
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        onClose();
      };
      backdrop.addEventListener("animationend", finish, { once: true });
      setTimeout(finish, 120);
    }

    function updateFooter(selected) {
      hints.textContent = "";
      let specs = [["↵", "Open"]];
      if (groupPickerContext) {
        specs = [
          ["↵", selected?.enterVerb || "Assign"],
          ["⇥", "Cycle Color"],
          ["Esc", "Cancel"]
        ];
      } else if (groupEditContext) {
        specs = [
          ["↵", "Save Group"],
          ["⇥", "Cycle Color"],
          ["Esc", "Cancel"]
        ];
      } else if (windowPickerContext) {
        specs = [
          ["↵", "Move to Window"],
          ["Esc", "Cancel"]
        ];
      } else if (splitPickerContext) {
        const count = splitPickerContext.tabIds.length;
        specs = [
          ["↵", count >= 2 ? `Split ${count}` : count === 1 ? "Split +1" : "Select"],
          ["⇥", "Toggle Tab"],
          [`${modSymbol}L`, "Layout"],
          ["Esc", "Cancel"]
        ];
      } else if (selected) {
        if (selected.kind === "tab") {
          const tabAnalysis = Core.analyzeTabs(data.tabs || [], { url: selected.subtitle || "" });
          specs = [
            ["↵", "Switch"],
            [delSymbol, "Close"]
          ];
          if ((tabAnalysis.baseDomainCount || tabAnalysis.domainCount) > 1) {
            specs.push([shiftDelSymbol, "Close Site"]);
          }
          specs.push(
            [`${modSymbol}G`, "Group"],
            [`${modSymbol}P`, "Pin"],
            [`${modSymbol}M`, "Mute"],
            [`${modSymbol}D`, "Dup"]
          );
          if (selected.badge === "Other Window") {
            specs.push([`${modSymbol}↵`, "Bring Here"]);
          }
        } else if (selected.actionDescriptor?.payload?.action === "OPEN_URL") {
          specs = [
            ["↵", selected.enterVerb || "Open"],
            [`${modSymbol}↵`, "Current Tab"],
            ["⇧↵", "New Window"]
          ];
        } else if (selected.actionDescriptor?.payload?.action === "OPEN_URL") {
          specs = [
            ["↵", selected.enterVerb || "Open"],
            ["⇧↵", "Current"],
            [`${modSymbol}↵`, "Bg Tab"]
          ];
        } else {
          specs = [["↵", selected.enterVerb || "Open"]];
        }
      }
      for (const [key, text] of specs) {
        const span = document.createElement("span");
        span.className = "qc-hint";
        const kbd = document.createElement("kbd");
        kbd.className = "qc-kbd";
        kbd.textContent = key;
        span.append(kbd, document.createTextNode(text));
        hints.appendChild(span);
      }
    }

    function renderColorBar() {
      if (!groupPickerContext && !groupEditContext) {
        colorBar.style.display = "none";
        colorBar.textContent = "";
        return;
      }
      colorBar.style.display = "flex";
      colorBar.textContent = "";
      const label = document.createElement("span");
      label.className = "qc-color-bar-label";
      label.textContent = groupEditContext ? "Group color (Tab to cycle):" : "New group color (Tab to cycle):";
      colorBar.appendChild(label);

      const swatches = document.createElement("div");
      swatches.className = "qc-color-swatches";
      for (const colorName of Core.GROUP_COLORS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `qc-color-swatch${colorName === selectedGroupColor ? " qc-active" : ""}`;
        btn.title = colorName;
        btn.style.background = Core.GROUP_COLOR_HEX[colorName];
        btn.addEventListener("click", () => {
          selectedGroupColor = colorName;
          render();
          input.focus();
        });
        swatches.appendChild(btn);
      }
      colorBar.appendChild(swatches);
    }

    function buildGroupPickerItems(cleanQuery) {
      const targetCount = groupPickerContext.tabIds.length;
      const newGroupName = cleanQuery || groupPickerContext.defaultTitle || "New Group";
      const colorHex = Core.GROUP_COLOR_HEX[selectedGroupColor] || Core.GROUP_COLOR_HEX.blue;

      const createItem = {
        id: "grp-picker-create",
        kind: "group-create",
        section: "Create New Tab Group",
        title: `+ Create Group "${newGroupName}"`,
        subtitle: `Group ${targetCount} ${targetCount === 1 ? "tab" : "tabs"} · Color: ${selectedGroupColor}`,
        badge: selectedGroupColor,
        badgeClass: "",
        iconClass: "",
        customColor: colorHex,
        iconName: "plus",
        enterVerb: "Create",
        keepsOpen: true,
        run: async () => {
          const tabIds = groupPickerContext.tabIds;
          const res = await sendRuntimeMessage({
            type: "EXECUTE_ACTION",
            payload: {
              action: "CREATE_TAB_GROUP",
              tabIds,
              title: newGroupName,
              color: selectedGroupColor
            }
          });
          groupPickerContext = null;
          input.value = "";
          input.placeholder = defaultPlaceholder;
          if (res?.toast) showToast(res.toast);
          await refreshData();
        }
      };

      const existingItems = [];
      for (const g of data.tabGroups || []) {
        if (cleanQuery && Core.fuzzyMatch(g.title, cleanQuery).score <= 0) continue;
        const gHex = Core.GROUP_COLOR_HEX[g.color] || Core.GROUP_COLOR_HEX.grey;
        existingItems.push({
          id: `grp-picker-assign-${g.id}`,
          kind: "group-assign",
          section: "Assign to Existing Group",
          title: g.title,
          subtitle: `${g.tabCount} ${g.tabCount === 1 ? "tab" : "tabs"} · ${g.currentWindow ? "Current window" : "Other window"}`,
          badge: "Assign",
          badgeClass: "",
          iconClass: "",
          customColor: gHex,
          groupColor: gHex,
          iconName: "layers",
          enterVerb: "Assign",
          keepsOpen: true,
          run: async () => {
            const tabIds = groupPickerContext.tabIds;
            const res = await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: {
                action: "ASSIGN_TAB_TO_GROUP",
                groupId: g.id,
                tabIds
              }
            });
            groupPickerContext = null;
            input.value = "";
            input.placeholder = defaultPlaceholder;
            if (res?.toast) showToast(res.toast);
            await refreshData();
          }
        });
      }

      if (cleanQuery && !existingItems.some((e) => e.title.toLowerCase() === cleanQuery.toLowerCase())) {
        return [createItem, ...existingItems];
      }
      return [...existingItems, createItem];
    }

    function renderSplitBar() {
      if (!splitPickerContext) {
        splitBar.style.display = "none";
        splitBar.textContent = "";
        return;
      }
      splitBar.style.display = "flex";
      splitBar.textContent = "";

      const count = splitPickerContext.tabIds.length;
      const label = document.createElement("span");
      label.className = "qc-split-bar-label";
      label.textContent =
        count >= 2
          ? `${count} tabs selected`
          : count === 1
          ? "1 tab selected · pick 1+ more"
          : "Pick 2+ tabs to split";
      splitBar.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "qc-split-controls";

      const layouts = Core.getAvailableSplitLayouts(Math.max(2, count));
      const activeLayout = layouts.find((l) => l.id === splitPickerContext.layoutId) || layouts[0];
      if (activeLayout && splitPickerContext.layoutId !== activeLayout.id) {
        splitPickerContext.layoutId = activeLayout.id;
      }

      for (const layout of layouts) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `qc-split-layout-btn${layout.id === activeLayout?.id ? " qc-active" : ""}`;
        btn.textContent = layout.label;
        btn.addEventListener("click", () => {
          splitPickerContext.layoutId = layout.id;
          render(currentItems[selectedIndex]?.id);
          input.focus();
        });
        controls.appendChild(btn);
      }

      const goBtn = document.createElement("button");
      goBtn.type = "button";
      goBtn.className = "qc-split-go-btn";
      goBtn.disabled = count < 2;
      goBtn.textContent = count >= 2 ? `Split ${count}` : "Split";
      goBtn.addEventListener("click", async () => {
        const ok = await executeSplitTabs(splitPickerContext.tabIds, splitPickerContext.layoutId);
        if (ok) closeWithMotion();
      });
      controls.appendChild(goBtn);

      splitBar.appendChild(controls);
    }

    function render(preserveId = null) {
      let prefixLabel = "";
      let activeMode = chipMode;
      let cleanQuery = input.value.trim();
      let isGrouped = false;
      let modeCounts = {};

      renderColorBar();
      renderSplitBar();

      if (groupPickerContext) {
        currentItems = buildGroupPickerItems(cleanQuery);
        isGrouped = true;
        prefixLabel = groupPickerContext.domain
          ? `Group ${groupPickerContext.domain} (${groupPickerContext.tabIds.length})`
          : `Group ${groupPickerContext.tabIds.length === 1 ? "Tab" : `${groupPickerContext.tabIds.length} Tabs`}`;
      } else if (groupEditContext) {
        const newTitle = input.value.trim() || groupEditContext.title || "Untitled";
        const colorHex = Core.GROUP_COLOR_HEX[selectedGroupColor] || Core.GROUP_COLOR_HEX.blue;
        currentItems = [
          hydrateItem({
            id: "grp-edit-save",
            kind: "group-save",
            section: "Save Tab Group Changes",
            title: `Save as "${newTitle}"`,
            subtitle: `Color: ${selectedGroupColor} · Press Enter to save, Tab to cycle colors`,
            badge: selectedGroupColor,
            badgeClass: "",
            iconClass: "",
            customColor: colorHex,
            iconName: "check",
            enterVerb: "Save",
            keepsOpen: true,
            run: async () => {
              const res = await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: {
                  action: "RENAME_RECOLOR_GROUP",
                  groupId: groupEditContext.groupId,
                  title: input.value.trim() || groupEditContext.title || "Untitled",
                  color: selectedGroupColor
                }
              });
              groupEditContext = null;
              input.value = "";
              input.placeholder = defaultPlaceholder;
              if (res?.toast) showToast(res.toast);
              await refreshData();
            }
          })
        ];
        prefixLabel = "Edit Group";
      } else if (windowPickerContext) {
        const movingTab = (data.tabs || []).find((t) => t.id === windowPickerContext.tabId);
        const currentWinId = movingTab ? movingTab.windowId : data.activeTab?.windowId;
        const targetWindows = (data.windows || []).filter((w) => w.id !== currentWinId);
        const filtered = cleanQuery
          ? targetWindows.filter((w) => Core.fuzzyMatch(`${w.title} Window ${w.id}`, cleanQuery).score > 0)
          : targetWindows;
        currentItems = filtered.map((w) =>
          hydrateItem({
            id: `win-move-${w.id}`,
            kind: "window-target",
            section: "Open Windows",
            title: w.title || `Window ${w.id}`,
            subtitle: `Window ID: ${w.id} · ${w.tabCount} ${w.tabCount === 1 ? "tab" : "tabs"}${w.incognito ? " · Incognito" : ""}`,
            badge: `${w.tabCount} ${w.tabCount === 1 ? "tab" : "tabs"}`,
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "window",
            enterVerb: "Move",
            keepsOpen: true,
            run: async () => {
              const res = await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: {
                  action: "MOVE_TAB_TO_WINDOW",
                  tabId: windowPickerContext.tabId,
                  targetWindowId: w.id
                }
              });
              windowPickerContext = null;
              input.value = "";
              input.placeholder = defaultPlaceholder;
              if (res?.toast) showToast(res.toast);
              await refreshData();
            }
          })
        );
        prefixLabel = "Move to Window";
      } else if (splitPickerContext) {
        const allTabs = data.tabs || [];
        const activeIdSet = new Set(allTabs.map((t) => t.id));
        splitPickerContext.tabIds = splitPickerContext.tabIds.filter((id) => activeIdSet.has(id));
        const selectedIds = splitPickerContext.tabIds;
        const filteredTabs = cleanQuery
          ? allTabs.filter((t) => Core.fuzzyMatch(`${t.title} ${t.url}`, cleanQuery).score > 0)
          : allTabs;

        currentItems = filteredTabs.map((t) => {
          const paneIdx = selectedIds.indexOf(t.id);
          const isSelected = paneIdx !== -1;
          const isCurrent = data.activeTab && t.id === data.activeTab.id;
          const sameWin = !data.activeTab || t.windowId === data.activeTab.windowId;
          const badgeText = isSelected
            ? `Pane ${paneIdx + 1}`
            : isCurrent
            ? "Current"
            : sameWin
            ? "Tab"
            : "Other Window";
          const enterVerb =
            selectedIds.length >= 2
              ? "Split"
              : selectedIds.length === 1 && !isSelected
              ? "Split +1"
              : isSelected
              ? "Deselect"
              : "Select";
          return hydrateItem({
            id: `split-tab-${t.id}`,
            kind: "split-tab",
            tabId: t.id,
            windowId: t.windowId,
            section: isSelected ? "Selected for Split" : "Open Tabs",
            title: t.title || t.url || "Untitled Tab",
            subtitle: t.url || "",
            favIconUrl: t.favIconUrl,
            badge: badgeText,
            badgeClass: isSelected ? "qc-badge-action" : "qc-badge-tab",
            iconClass: isSelected ? "qc-icon-action" : "qc-icon-tab",
            iconName: isSelected ? "split" : "globe",
            enterVerb,
            keepsOpen: true,
            run: () => {
              const idx = splitPickerContext.tabIds.indexOf(t.id);
              if (idx === -1) {
                splitPickerContext.tabIds.push(t.id);
              } else {
                splitPickerContext.tabIds.splice(idx, 1);
              }
              render(`split-tab-${t.id}`);
              input.focus();
            }
          });
        });
        prefixLabel = selectedIds.length >= 2 ? `Split ${selectedIds.length} Tabs` : "Split Tabs";
      } else if (activeGroup) {
        const groupTabs = (data.tabs || [])
          .filter((t) => t.groupId === activeGroup.id)
          .map((t) =>
            hydrateItem({
              id: `tab-${t.id}`,
              kind: "tab",
              tabId: t.id,
              windowId: t.windowId,
              title: t.title,
              subtitle: t.url,
              favIconUrl: t.favIconUrl,
              badge: t.pinned ? "Pinned" : "Tab",
              badgeClass: "qc-badge-tab",
              iconClass: "qc-icon-tab",
              iconName: "globe",
              enterVerb: "Switch",
              actionDescriptor: {
                type: "EXECUTE_ACTION",
                payload: { action: "SWITCH_TAB", tabId: t.id, windowId: t.windowId }
              }
            })
          );
        currentItems = cleanQuery
          ? groupTabs.filter((t) => Core.fuzzyMatch(`${t.title} ${t.subtitle}`, cleanQuery).score > 0)
          : groupTabs;
        prefixLabel = `Group: ${activeGroup.title}`;
      } else {
        const built = Core.buildResults(data, input.value, chipMode);
        prefixLabel = built.prefixLabel;
        activeMode = built.activeMode;
        cleanQuery = built.cleanQuery;
        isGrouped = built.isGrouped;
        modeCounts = built.modeCounts;
        currentItems = built.items.map(hydrateItem);
      }

      if (preserveId) {
        const foundIdx = currentItems.findIndex((it) => it.id === preserveId);
        if (foundIdx !== -1) selectedIndex = foundIdx;
      }
      if (selectedIndex >= currentItems.length) {
        selectedIndex = Math.max(0, currentItems.length - 1);
      }

      clearBtn.style.display = input.value ? "flex" : "none";

      for (const c of CHIP_MODES) {
        const btn = chipButtons.get(c.id);
        const isActive = !activeGroup && !groupPickerContext && !groupEditContext && !windowPickerContext && !splitPickerContext && c.id === activeMode;
        btn.classList.toggle("qc-chip-active", isActive);
        const count = modeCounts[c.id];
        btn.textContent = isActive && typeof count === "number" ? `${c.label} · ${count}` : c.label;
      }

      if (prefixLabel) {
        modePill.textContent = prefixLabel;
        modePill.style.display = "inline-block";
      } else {
        modePill.style.display = "none";
      }

      listEl.textContent = "";
      if (!currentItems.length) {
        input.removeAttribute("aria-activedescendant");
        updateFooter(null);

        const empty = document.createElement("div");
        empty.className = "qc-empty";

        const modeObj = Core.getModeDefinition(activeMode);
        const emptyIcon = createSvgIcon(modeObj.icon);
        emptyIcon.classList.add("qc-empty-icon");
        empty.appendChild(emptyIcon);

        const msg = document.createElement("div");
        msg.textContent = cleanQuery
          ? `No ${modeObj.singularLabel || modeObj.label.toLowerCase()} matches "${cleanQuery}".`
          : `No ${modeObj.label.toLowerCase()} items yet.`;
        empty.appendChild(msg);

        if (cleanQuery || activeMode !== "all") {
          const actions = document.createElement("div");
          actions.className = "qc-empty-actions";

          if (cleanQuery) {
            const googleBtn = document.createElement("button");
            googleBtn.type = "button";
            googleBtn.className = "qc-empty-btn";
            googleBtn.textContent = `Search Google for "${cleanQuery}"`;
            googleBtn.addEventListener("click", async () => {
              await sendRuntimeMessage({
                type: "EXECUTE_ACTION",
                payload: { action: "OPEN_URL", url: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}` }
              });
              closeWithMotion();
            });
            actions.appendChild(googleBtn);
          }

          if (activeMode !== "all") {
            const allBtn = document.createElement("button");
            allBtn.type = "button";
            allBtn.className = "qc-empty-btn";
            allBtn.textContent = "Search in All instead";
            allBtn.addEventListener("click", () => {
              chipMode = "all";
              const raw = input.value.trimStart();
              if (/^(>|@|\*|\/[hgcted](\s|$))/.test(raw)) {
                input.value = cleanQuery;
              }
              selectedIndex = 0;
              render();
              input.focus();
            });
            actions.appendChild(allBtn);
          }

          empty.appendChild(actions);
        }

        listEl.appendChild(empty);
        liveRegion.textContent = msg.textContent;
        return;
      }

      let lastSection = null;
      currentItems.forEach((item, idx) => {
        if (isGrouped && item.section && item.section !== lastSection) {
          lastSection = item.section;
          const sec = document.createElement("div");
          sec.className = "qc-section-label";
          sec.setAttribute("aria-hidden", "true");
          sec.textContent = item.section;
          listEl.appendChild(sec);
        }

        const row = document.createElement("div");
        const optionId = `qc-opt-${item.id}`;
        row.id = optionId;
        row.className = `qc-item${idx === selectedIndex ? " qc-selected" : ""}`;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", idx === selectedIndex ? "true" : "false");
        row.dataset.index = String(idx);

        const iconBox = document.createElement("div");
        iconBox.className = `qc-item-icon ${item.iconClass || ""}`;
        if (item.customColor) {
          iconBox.style.color = item.customColor;
          iconBox.style.background = Core.hexToRgba(item.customColor, 0.14);
          iconBox.style.borderColor = Core.hexToRgba(item.customColor, 0.28);
        }
        if (item.favIconUrl && /^(https?:|chrome:|data:)/i.test(item.favIconUrl)) {
          const img = document.createElement("img");
          img.src = item.favIconUrl;
          img.alt = "";
          img.onerror = () => {
            iconBox.textContent = "";
            iconBox.appendChild(createSvgIcon("globe"));
          };
          iconBox.appendChild(img);
        } else {
          iconBox.appendChild(createSvgIcon(item.iconName || "globe"));
        }

        const main = document.createElement("div");
        main.className = "qc-item-main";
        const title = document.createElement("div");
        title.className = "qc-item-title";
        title.title = item.title || "";
        const hlQuery = groupPickerContext || groupEditContext ? "" : cleanQuery;
        renderHighlightedText(title, item.title, hlQuery);

        const sub = document.createElement("div");
        sub.className = "qc-item-sub";
        sub.title = item.subtitle || "";
        renderHighlightedText(sub, item.subtitle || "", hlQuery);
        main.append(title, sub);

        const meta = document.createElement("div");
        meta.className = "qc-item-meta";
        if (item.groupColor) {
          const dot = document.createElement("span");
          dot.className = "qc-group-dot";
          dot.style.background = item.groupColor;
          meta.appendChild(dot);
        }
        if (item.badge) {
          const badge = document.createElement("span");
          badge.className = `qc-badge ${item.badgeClass || ""}`;
          if (item.customColor) {
            badge.style.color = item.customColor;
            badge.style.background = Core.hexToRgba(item.customColor, 0.14);
            badge.style.borderColor = Core.hexToRgba(item.customColor, 0.28);
          }
          badge.textContent = item.badge;
          meta.appendChild(badge);
        }
        if (item.kind === "tab") {
          if (item.audible) {
            const aBadge = document.createElement("span");
            aBadge.className = "qc-badge qc-badge-playing";
            aBadge.textContent = "Playing";
            meta.appendChild(aBadge);
          }
          if (item.muted) {
            const mBadge = document.createElement("span");
            mBadge.className = "qc-badge qc-badge-muted";
            mBadge.textContent = "Muted";
            meta.appendChild(mBadge);
          }
          if (item.discarded) {
            const dBadge = document.createElement("span");
            dBadge.className = "qc-badge qc-badge-sleeping";
            dBadge.textContent = "Sleeping";
            meta.appendChild(dBadge);
          }
        }

        const enterHint = document.createElement("span");
        enterHint.className = "qc-enter-hint";
        enterHint.textContent = `↵ ${item.enterVerb || "Open"}`;
        meta.appendChild(enterHint);

        if (item.kind === "tab") {
          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "qc-tab-btn";
          closeBtn.title = `Close tab (${delSymbol})`;
          closeBtn.textContent = "✕";
          closeBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const currentId = currentItems[selectedIndex]?.id;
            const res = await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "CLOSE_TAB", tabId: item.tabId }
            });
            if (res?.toast) showToast(res.toast);
            await refreshData(currentId);
            input.focus();
          });
          meta.appendChild(closeBtn);
        }

        row.append(iconBox, main, meta);
        row.addEventListener("mouseenter", () => {
          selectedIndex = idx;
          updateSelection();
        });
        row.addEventListener("click", async () => {
          await item.run();
          if (!item.keepsOpen) closeWithMotion();
          else input.focus();
        });

        listEl.appendChild(row);
      });

      const selectedItem = currentItems[selectedIndex];
      if (selectedItem) {
        input.setAttribute("aria-activedescendant", `qc-opt-${selectedItem.id}`);
      }
      updateFooter(selectedItem);
      liveRegion.textContent = `${currentItems.length} results`;

      const selectedEl = listEl.querySelector(".qc-selected");
      if (selectedEl) selectedEl.scrollIntoView({ block: "nearest" });
    }

    function updateSelection() {
      const rows = listEl.querySelectorAll(".qc-item");
      rows.forEach((r, i) => {
        const isSel = i === selectedIndex;
        r.classList.toggle("qc-selected", isSel);
        r.setAttribute("aria-selected", isSel ? "true" : "false");
      });
      const selectedItem = currentItems[selectedIndex];
      if (selectedItem) {
        input.setAttribute("aria-activedescendant", `qc-opt-${selectedItem.id}`);
      }
      updateFooter(selectedItem);
      const selectedEl = listEl.querySelector(".qc-selected");
      if (selectedEl) selectedEl.scrollIntoView({ block: "nearest" });
    }

    async function refreshData(preserveId = null) {
      const res = await sendRuntimeMessage({ type: "GET_PALETTE_DATA", query: input.value });
      if (res.ok && res.data) {
        data = res.data;
        render(preserveId);
      }
    }

    clearBtn.addEventListener("click", () => {
      input.value = "";
      selectedIndex = 0;
      render();
      input.focus();
    });

    let historyTimer = null;
    input.addEventListener("input", () => {
      selectedIndex = 0;
      render();
      clearTimeout(historyTimer);
      const parsed = Core.parseModeAndQuery(input.value, chipMode);
      if (parsed.mode === "history" || (parsed.mode === "all" && parsed.query)) {
        historyTimer = setTimeout(async () => {
          const currentId = currentItems[selectedIndex]?.id;
          const res = await sendRuntimeMessage({ type: "SEARCH_HISTORY", query: parsed.query });
          if (res?.ok && Array.isArray(res.history)) {
            if (Core.parseModeAndQuery(input.value, chipMode).query === parsed.query) {
              data.history = res.history;
              render(currentId);
            }
          }
        }, 120);
      }
    });

    modal.addEventListener("keydown", async (e) => {
      e.stopPropagation();
      const mod = e.metaKey || e.ctrlKey;
      const selected = currentItems[selectedIndex];

      if (!popoverOpen && document.activeElement !== input && e.key.length === 1 && !mod && !e.altKey) {
        input.focus();
      }

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePopover();
        return;
      }

      if (popoverOpen) {
        const filtered = getFilteredPopoverItems();
        if (e.key === "Escape") {
          e.preventDefault();
          closePopover();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (filtered.length > 0) {
            popoverIndex = (popoverIndex + 1) % filtered.length;
            renderPopover();
          }
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (filtered.length > 0) {
            popoverIndex = (popoverIndex - 1 + filtered.length) % filtered.length;
            renderPopover();
          }
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (filtered[popoverIndex]) {
            const act = filtered[popoverIndex];
            closePopover();
            await act.run();
            if (act.closesPalette) {
              closeWithMotion();
            } else {
              await refreshData();
            }
          }
          return;
        }
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (splitPickerContext) {
          if (selected?.tabId) {
            const idx = splitPickerContext.tabIds.indexOf(selected.tabId);
            if (idx === -1) {
              splitPickerContext.tabIds.push(selected.tabId);
            } else {
              splitPickerContext.tabIds.splice(idx, 1);
            }
            render(selected.id);
          }
          return;
        }
        if (groupPickerContext || groupEditContext) {
          const cIdx = Core.GROUP_COLORS.indexOf(selectedGroupColor);
          const nextC = e.shiftKey
            ? (cIdx - 1 + Core.GROUP_COLORS.length) % Core.GROUP_COLORS.length
            : (cIdx + 1) % Core.GROUP_COLORS.length;
          selectedGroupColor = Core.GROUP_COLORS[nextC];
          render(currentItems[selectedIndex]?.id);
          return;
        }
        activeGroup = null;
        const curIdx = CHIP_MODES.findIndex((c) => c.id === chipMode);
        const nextIdx = e.shiftKey
          ? (curIdx - 1 + CHIP_MODES.length) % CHIP_MODES.length
          : (curIdx + 1) % CHIP_MODES.length;
        chipMode = CHIP_MODES[nextIdx].id;
        selectedIndex = 0;
        render();
        return;
      }

      if (mod && e.key.toLowerCase() === "l" && splitPickerContext) {
        e.preventDefault();
        const layouts = Core.getAvailableSplitLayouts(Math.max(2, splitPickerContext.tabIds.length));
        if (layouts.length > 1) {
          const curIdx = layouts.findIndex((l) => l.id === splitPickerContext.layoutId);
          const nextIdx = (curIdx + 1) % layouts.length;
          splitPickerContext.layoutId = layouts[nextIdx].id;
          render(currentItems[selectedIndex]?.id);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (groupPickerContext || groupEditContext || windowPickerContext || splitPickerContext || activeGroup) {
          exitSubMode();
          return;
        }
        closeWithMotion();
        return;
      }

      if (e.key === "Backspace" && !mod && (groupPickerContext || groupEditContext || windowPickerContext || splitPickerContext || activeGroup) && !input.value) {
        e.preventDefault();
        exitSubMode();
        return;
      }

      if (e.key === "Backspace" && !mod) {
        const trimmed = input.value.trim();
        if (
          trimmed === ">" ||
          trimmed === "@" ||
          trimmed === "*" ||
          trimmed === "/h" ||
          trimmed === "/g" ||
          trimmed === "/c" ||
          trimmed === "/t" ||
          trimmed === "/e" ||
          trimmed === "/d"
        ) {
          e.preventDefault();
          input.value = "";
          chipMode = "all";
          selectedIndex = 0;
          render();
          return;
        }
      }

      if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "n")) {
        e.preventDefault();
        if (currentItems.length) {
          selectedIndex = (selectedIndex + 1) % currentItems.length;
          updateSelection();
        }
        return;
      }

      const isUpNav =
        e.key === "ArrowUp" ||
        (e.ctrlKey && e.key.toLowerCase() === "p" && (isMac ? !e.metaKey : selected?.kind !== "tab"));
      if (isUpNav) {
        e.preventDefault();
        if (currentItems.length) {
          selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
          updateSelection();
        }
        return;
      }

      if (e.key === "Home" && currentItems.length) {
        e.preventDefault();
        selectedIndex = 0;
        updateSelection();
        return;
      }

      if (e.key === "End" && currentItems.length) {
        e.preventDefault();
        selectedIndex = currentItems.length - 1;
        updateSelection();
        return;
      }

      if (e.key === "PageDown" && currentItems.length) {
        e.preventDefault();
        selectedIndex = Math.min(currentItems.length - 1, selectedIndex + 8);
        updateSelection();
        return;
      }

      if (e.key === "PageUp" && currentItems.length) {
        e.preventDefault();
        selectedIndex = Math.max(0, selectedIndex - 8);
        updateSelection();
        return;
      }

      if (e.key === "Enter" && splitPickerContext) {
        e.preventDefault();
        const ids = [...splitPickerContext.tabIds];
        if (ids.length >= 2) {
          const ok = await executeSplitTabs(ids, splitPickerContext.layoutId);
          if (ok) closeWithMotion();
          return;
        }
        if (ids.length === 1 && selected?.tabId && !ids.includes(selected.tabId)) {
          const ok = await executeSplitTabs([...ids, selected.tabId], splitPickerContext.layoutId);
          if (ok) closeWithMotion();
          return;
        }
        if (selected?.tabId) {
          await selected.run();
        }
        return;
      }

      if (e.key === "Enter" && selected) {
        e.preventDefault();
        if (selected.actionDescriptor?.payload?.action === "OPEN_URL" && selected.actionDescriptor.payload.url) {
          if (mod) {
            await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_URL_CURRENT_TAB", url: selected.actionDescriptor.payload.url }
            });
            recordItemUsage(selected);
            closeWithMotion();
            return;
          }
          if (e.shiftKey) {
            await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_URL_NEW_WINDOW", url: selected.actionDescriptor.payload.url }
            });
            recordItemUsage(selected);
            closeWithMotion();
            return;
          }
        } else if (selected.kind === "tab" && selected.tabId) {
          if (mod) {
            await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "PULL_TAB_TO_CURRENT_WINDOW", tabId: selected.tabId }
            });
            closeWithMotion();
            return;
          }
          if (e.shiftKey) {
            await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "MOVE_TAB_NEW_WINDOW", tabId: selected.tabId }
            });
            closeWithMotion();
            return;
          }
        }

        await selected.run();
        if (!selected.keepsOpen) closeWithMotion();
        return;
      }

      if (mod && selected && selected.kind === "tab") {
        const k = e.key.toLowerCase();
        const currentId = selected.id;
        if (e.key === "Backspace" && e.shiftKey) {
          e.preventDefault();
          const baseDomain =
            (Core.extractBaseDomain && Core.extractBaseDomain(selected.subtitle || "")) ||
            Core.extractHostname(selected.subtitle || "");
          if (baseDomain) {
            const res = await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain }
            });
            if (res?.toast) showToast(res.toast);
            await refreshData();
          }
        } else if (e.key === "Backspace") {
          e.preventDefault();
          const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "CLOSE_TAB", tabId: selected.tabId } });
          if (res?.toast) showToast(res.toast);
          await refreshData();
        } else if (k === "g") {
          e.preventDefault();
          const tabAnalysis = Core.analyzeTabs(data.tabs || [], { url: selected.subtitle || "" });
          openGroupPicker({
            tabIds: [selected.tabId],
            defaultTitle: tabAnalysis.suggestedGroupTitle || "Group"
          });
        } else if (k === "p" && (isMac ? (e.metaKey && !e.ctrlKey) : e.ctrlKey)) {
          e.preventDefault();
          const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "PIN_TAB", tabId: selected.tabId } });
          if (res?.toast) showToast(res.toast);
          await refreshData(currentId);
        } else if (k === "m") {
          e.preventDefault();
          const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "MUTE_TAB", tabId: selected.tabId } });
          if (res?.toast) showToast(res.toast);
          await refreshData(currentId);
        } else if (k === "d") {
          e.preventDefault();
          const res = await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "DUPLICATE_TAB", tabId: selected.tabId } });
          if (res?.toast) showToast(res.toast);
          await refreshData(currentId);
        } else if (k === "c" && selected.subtitle) {
          e.preventDefault();
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(selected.subtitle);
            showToast("Copied URL to clipboard");
          }
        }
      }
    });

    backdrop.addEventListener("mousedown", (e) => {
      if (popoverOpen && !popover.contains(e.target) && !actionsTrigger.contains(e.target)) {
        closePopover();
      }
    });

    if (!isPopup) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeWithMotion();
      });
    }

    chipMode = "all";
    refreshData();
    setTimeout(() => input.focus(), 0);

    return {
      destroy() {
        closeWithMotion();
      },
      focus() {
        input.focus();
      }
    };
  };
})();

