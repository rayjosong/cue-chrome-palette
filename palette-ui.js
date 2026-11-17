(() => {
  if (window.__QuickCmdCreatePalette) return;

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (res) => {
        resolve(res || { ok: false });
      });
    });
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
        ["path", { d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" }]
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
      incognito: [
        ["path", { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" }],
        ["circle", { cx: "12", cy: "12", r: "3" }]
      ],
      settings: [
        ["circle", { cx: "12", cy: "12", r: "3" }],
        ["path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" }]
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

  function fuzzyMatch(text, query) {
    if (!query) return { score: 1, indices: [] };
    const t = (text || "").toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return { score: 1, indices: [] };
    if (t === q) {
      return { score: 120, indices: Array.from({ length: t.length }, (_, i) => i) };
    }
    if (t.startsWith(q)) {
      return { score: 95, indices: Array.from({ length: q.length }, (_, i) => i) };
    }
    const idx = t.indexOf(q);
    if (idx !== -1) {
      return {
        score: 75 - Math.min(idx, 30),
        indices: Array.from({ length: q.length }, (_, i) => idx + i)
      };
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every((tok) => t.includes(tok))) {
      const indices = [];
      for (const tok of tokens) {
        const ti = t.indexOf(tok);
        if (ti !== -1) {
          for (let j = 0; j < tok.length; j++) indices.push(ti + j);
        }
      }
      return { score: 60, indices };
    }

    let qi = 0;
    let score = 0;
    let consecutive = 0;
    const indices = [];
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        indices.push(ti);
        qi++;
        consecutive++;
        score += 2 + consecutive;
      } else {
        consecutive = 0;
      }
    }
    return qi === q.length ? { score: Math.min(50, score), indices } : { score: 0, indices: [] };
  }

  function renderHighlightedText(container, text, query) {
    container.textContent = "";
    const str = text || "";
    const q = (query || "").trim();
    if (!q) {
      container.textContent = str;
      return;
    }

    const { score, indices } = fuzzyMatch(str, q);
    if (!score || !indices.length) {
      container.textContent = str;
      return;
    }

    const markSet = new Set(indices);
    let buf = "";
    let inMark = false;

    const flush = () => {
      if (!buf) return;
      if (inMark) {
        const mark = document.createElement("mark");
        mark.className = "qc-hl";
        mark.textContent = buf;
        container.appendChild(mark);
      } else {
        container.appendChild(document.createTextNode(buf));
      }
      buf = "";
    };

    for (let i = 0; i < str.length; i++) {
      const isMarked = markSet.has(i);
      if (isMarked !== inMark) {
        flush();
        inMark = isMarked;
      }
      buf += str[i];
    }
    flush();
  }

  function buildStaticActions(activeTab) {
    const actions = [];
    if (activeTab) {
      actions.push(
        {
          id: "act-pin",
          kind: "action",
          section: "Actions",
          title: activeTab.pinned ? "Unpin Current Tab" : "Pin Current Tab",
          subtitle: activeTab.title || "Current tab",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "pin",
          enterVerb: "Run",
          run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "PIN_TAB", tabId: activeTab.id } })
        },
        {
          id: "act-mute",
          kind: "action",
          section: "Actions",
          title: activeTab.muted ? "Unmute Current Tab" : "Mute Current Tab",
          subtitle: activeTab.title || "Current tab",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: activeTab.muted ? "volume" : "mute",
          enterVerb: "Run",
          run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "MUTE_TAB", tabId: activeTab.id } })
        },
        {
          id: "act-dup",
          kind: "action",
          section: "Actions",
          title: "Duplicate Current Tab",
          subtitle: activeTab.url || "",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "copy",
          enterVerb: "Run",
          run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "DUPLICATE_TAB", tabId: activeTab.id } })
        },
        {
          id: "act-copy-url",
          kind: "action",
          section: "Actions",
          title: "Copy Current Page URL",
          subtitle: activeTab.url || "",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "link",
          enterVerb: "Copy",
          run: async () => {
            if (activeTab.url && navigator.clipboard) {
              await navigator.clipboard.writeText(activeTab.url);
            }
          }
        },
        {
          id: "act-close-others",
          kind: "action",
          section: "Actions",
          title: "Close Other Unpinned Tabs",
          subtitle: "Closes all other unpinned tabs in this window",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "x",
          enterVerb: "Run",
          run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "CLOSE_OTHER_TABS" } })
        },
        {
          id: "act-move-win",
          kind: "action",
          section: "Actions",
          title: "Move Current Tab to New Window",
          subtitle: activeTab.title || "",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "window",
          enterVerb: "Run",
          run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "MOVE_TAB_NEW_WINDOW" } })
        },
        activeTab.groupId !== undefined && activeTab.groupId !== -1
          ? {
              id: "act-ungroup",
              kind: "action",
              section: "Actions",
              title: "Ungroup Current Tab",
              subtitle: "Remove this tab from its tab group",
              badge: "Action",
              badgeClass: "qc-badge-action",
              iconClass: "qc-icon-action",
              iconName: "layers",
              enterVerb: "Run",
              run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "UNGROUP_CURRENT_TAB" } })
            }
          : {
              id: "act-group",
              kind: "action",
              section: "Actions",
              title: "Add Current Tab to New Group",
              subtitle: "Create a new Chrome tab group with this tab",
              badge: "Action",
              badgeClass: "qc-badge-action",
              iconClass: "qc-icon-action",
              iconName: "layers",
              enterVerb: "Run",
              run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "GROUP_CURRENT_TAB" } })
            }
      );
    }

    actions.push(
      {
        id: "act-incognito",
        kind: "action",
        section: "Actions",
        title: "New Incognito Window",
        subtitle: "Open a private browsing window",
        badge: "Action",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "incognito",
        enterVerb: "Run",
        run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "NEW_INCOGNITO" } })
      },
      {
        id: "act-manage-links",
        kind: "action",
        section: "Actions",
        title: "Manage Quick Links & Bangs",
        subtitle: "Add or edit custom bang shortcuts (e.g. gh, yt, gm)",
        badge: "Settings",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-bang",
        iconName: "zap",
        enterVerb: "Open",
        run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_OPTIONS" } })
      }
    );

    return actions;
  }

  const GROUP_COLOR_HEX = {
    grey: "#9ca3af",
    blue: "#60a5fa",
    red: "#f87171",
    yellow: "#fbbf24",
    green: "#4ade80",
    pink: "#f472b6",
    purple: "#c084fc",
    cyan: "#22d3ee",
    orange: "#fb923c"
  };

  function looksLikeUrl(q) {
    if (!q || /\s/.test(q)) return false;
    return /^(https?:\/\/|localhost(:\d+)?|([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?)$/i.test(q);
  }

  function normalizeUrl(q) {
    if (/^https?:\/\//i.test(q)) return q;
    if (/^localhost/i.test(q)) return `http://${q}`;
    return `https://${q}`;
  }

  function parseModeAndQuery(raw, chipMode) {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith(">")) return { mode: "commands", query: trimmed.slice(1).trim(), prefixLabel: "Commands", isPrefix: true };
    if (trimmed.startsWith("@")) return { mode: "tabs", query: trimmed.slice(1).trim(), prefixLabel: "Tabs", isPrefix: true };
    if (trimmed.startsWith("*")) return { mode: "bookmarks", query: trimmed.slice(1).trim(), prefixLabel: "Bookmarks", isPrefix: true };
    if (trimmed.startsWith("/h ")) return { mode: "history", query: trimmed.slice(3).trim(), prefixLabel: "History", isPrefix: true };
    if (trimmed.startsWith("/g ")) return { mode: "groups", query: trimmed.slice(3).trim(), prefixLabel: "Groups", isPrefix: true };
    if (trimmed.startsWith("/c ")) return { mode: "closed", query: trimmed.slice(3).trim(), prefixLabel: "Closed", isPrefix: true };
    return { mode: chipMode || "all", query: trimmed, prefixLabel: "", isPrefix: false };
  }

  function buildResults(data, rawQuery, chipMode = "all") {
    const { mode, query, prefixLabel, isPrefix } = parseModeAndQuery(rawQuery, chipMode);
    const items = [];

    const tabs = (data.tabs || []).map((t, idx) => ({
      id: `tab-${t.id}`,
      kind: "tab",
      section: "Open Tabs (Recent)",
      tabId: t.id,
      windowId: t.windowId,
      title: t.title,
      subtitle: t.url,
      favIconUrl: t.favIconUrl,
      badge: t.pinned ? "Pinned" : t.currentWindow ? "Tab" : "Other Window",
      badgeClass: "qc-badge-tab",
      iconClass: "qc-icon-tab",
      iconName: "globe",
      enterVerb: "Switch",
      priority: (t.currentWindow ? 24 : 14) + Math.max(0, 12 - idx) * 0.2,
      run: () =>
        sendRuntimeMessage({
          type: "EXECUTE_ACTION",
          payload: { action: "SWITCH_TAB", tabId: t.id, windowId: t.windowId }
        })
    }));

    const tabGroups = [];
    for (const g of data.tabGroups || []) {
      const dotColor = GROUP_COLOR_HEX[g.color] || GROUP_COLOR_HEX.grey;
      tabGroups.push({
        id: `grp-focus-${g.id}`,
        kind: "group",
        section: "Tab Groups",
        groupColor: dotColor,
        title: `${g.title} (${g.tabCount} ${g.tabCount === 1 ? "tab" : "tabs"})`,
        subtitle: g.collapsed ? "Collapsed — switch to first tab in group" : "Expanded — switch to first tab in group",
        badge: g.collapsed ? "Collapsed" : "Group",
        badgeClass: "qc-badge-tab",
        iconClass: "qc-icon-tab",
        iconName: "layers",
        enterVerb: "Switch",
        priority: 15,
        run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "FOCUS_GROUP", groupId: g.id } })
      });
      tabGroups.push({
        id: `grp-toggle-${g.id}`,
        kind: "group",
        section: "Tab Groups",
        groupColor: dotColor,
        title: `${g.collapsed ? "Expand" : "Collapse"} Group: ${g.title}`,
        subtitle: `Toggle ${g.tabCount}-tab group`,
        badge: "Group",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "layers",
        enterVerb: g.collapsed ? "Expand" : "Collapse",
        priority: 11,
        run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "TOGGLE_GROUP_COLLAPSE", groupId: g.id } })
      });
    }

    const closedTabs = (data.closedTabs || []).map((c) => ({
      id: `closed-${c.sessionId}`,
      kind: "closed",
      section: "Recently Closed",
      title: c.title,
      subtitle: c.url,
      favIconUrl: c.favIconUrl,
      badge: "Closed",
      badgeClass: "qc-badge-chrome",
      iconClass: "qc-icon-chrome",
      iconName: "rotateCcw",
      enterVerb: "Reopen",
      priority: 13,
      run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "RESTORE_SESSION", sessionId: c.sessionId } })
    }));

    const quickLinks = [];
    const qParts = query.split(/\s+/);
    const firstWord = (qParts[0] || "").toLowerCase();
    const restQuery = qParts.slice(1).join(" ").trim();

    for (const ql of data.quickLinks || []) {
      const bangLower = (ql.bang || "").toLowerCase();
      if (query && bangLower && firstWord === bangLower && restQuery && ql.searchUrl) {
        const targetUrl = ql.searchUrl.replace("{query}", encodeURIComponent(restQuery));
        quickLinks.push({
          id: `bang-search-${ql.bang}`,
          kind: "bang",
          section: "Quick Links",
          title: `Search ${ql.title} for "${restQuery}"`,
          subtitle: targetUrl,
          badge: `!${ql.bang}`,
          badgeClass: "qc-badge-bang",
          iconClass: "qc-icon-bang",
          iconName: "zap",
          enterVerb: "Search",
          priority: 200,
          forceScore: 200,
          run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_URL", url: targetUrl } })
        });
      }

      const exactBang = query && bangLower && query.toLowerCase() === bangLower;
      quickLinks.push({
        id: `ql-${ql.bang}-${ql.url}`,
        kind: "bang",
        section: "Quick Links",
        title: ql.title,
        subtitle: ql.url,
        badge: ql.bang ? `!${ql.bang}` : "Link",
        badgeClass: "qc-badge-bang",
        iconClass: "qc-icon-bang",
        iconName: "zap",
        enterVerb: "Open",
        priority: exactBang ? 180 : 14,
        forceScore: exactBang ? 180 : 0,
        searchText: `${ql.bang} ${ql.title} ${ql.url}`,
        run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_URL", url: ql.url } })
      });
    }

    const actions = buildStaticActions(data.activeTab).map((a) => ({ ...a, priority: 10 }));

    const chromePages = (data.chromePages || []).map((p) => ({
      id: p.id,
      kind: "chrome",
      section: "Chrome Pages",
      title: p.title,
      subtitle: p.subtitle,
      badge: "Chrome",
      badgeClass: "qc-badge-chrome",
      iconClass: "qc-icon-chrome",
      iconName: "settings",
      enterVerb: "Open",
      priority: 8,
      run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_URL", url: p.url } })
    }));

    const bookmarks = (data.bookmarks || []).map((b) => ({
      id: b.id,
      kind: "bookmark",
      section: "Bookmarks",
      title: b.title,
      subtitle: b.folder ? `${b.folder} — ${b.url}` : b.url,
      badge: "Bookmark",
      badgeClass: "qc-badge-bookmark",
      iconClass: "qc-icon-bookmark",
      iconName: "star",
      enterVerb: "Open",
      priority: 6,
      searchText: `${b.title} ${b.url} ${b.folder || ""}`,
      run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_URL", url: b.url } })
    }));

    const history = (data.history || []).map((h) => ({
      id: h.id,
      kind: "history",
      section: "History",
      title: h.title,
      subtitle: h.url,
      badge: "History",
      badgeClass: "qc-badge-history",
      iconClass: "qc-icon-history",
      iconName: "history",
      enterVerb: "Open",
      priority: 4,
      run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_URL", url: h.url } })
    }));

    const modeCounts = {
      all: tabs.length + tabGroups.length + closedTabs.length + bookmarks.length + actions.length + chromePages.length,
      tabs: tabs.length,
      groups: tabGroups.length,
      closed: closedTabs.length,
      bookmarks: bookmarks.length,
      history: history.length,
      commands: actions.length + chromePages.length
    };

    let pool = [];
    if (mode === "commands") {
      pool = [...actions, ...chromePages];
    } else if (mode === "tabs") {
      pool = tabs;
    } else if (mode === "groups") {
      pool = tabGroups;
    } else if (mode === "closed") {
      pool = closedTabs;
    } else if (mode === "bookmarks") {
      pool = bookmarks;
    } else if (mode === "history") {
      pool = history;
    } else if (!query) {
      pool = [...tabs, ...tabGroups.slice(0, 3), ...closedTabs.slice(0, 3), ...quickLinks.slice(0, 4), ...actions.slice(0, 4), ...chromePages.slice(0, 3)];
    } else {
      pool = [...quickLinks, ...tabs, ...tabGroups, ...closedTabs, ...actions, ...chromePages, ...bookmarks, ...history];
    }

    for (const item of pool) {
      if (!query) {
        items.push({ ...item, _score: item.priority });
        continue;
      }
      if (item.forceScore) {
        items.push({ ...item, _score: item.forceScore });
        continue;
      }
      const haystack = item.searchText || `${item.title} ${item.subtitle || ""}`;
      const { score } = fuzzyMatch(haystack, query);
      if (score > 0) {
        items.push({ ...item, _score: score + item.priority });
      }
    }

    if (query) {
      items.sort((a, b) => b._score - a._score);
      if (mode === "all") {
        if (looksLikeUrl(query)) {
          const target = normalizeUrl(query);
          items.push({
            id: "fallback-url",
            kind: "fallback",
            title: `Open URL: ${target}`,
            subtitle: "Navigate directly in a new tab",
            badge: "URL",
            badgeClass: "",
            iconClass: "",
            iconName: "globe",
            enterVerb: "Open",
            _score: 0.5,
            run: () => sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "OPEN_URL", url: target } })
          });
        }
        items.push({
          id: "fallback-google",
          kind: "fallback",
          title: `Search Google for "${query}"`,
          subtitle: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          badge: "Web",
          badgeClass: "",
          iconClass: "",
          iconName: "search",
          enterVerb: "Search",
          _score: 0,
          run: () =>
            sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_URL", url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }
            })
        });
      }
    }

    return {
      prefixLabel: isPrefix ? prefixLabel : "",
      activeMode: mode,
      cleanQuery: query,
      isGrouped: !query && mode === "all",
      modeCounts,
      items: items.slice(0, 40)
    };
  }

  window.__QuickCmdCreatePalette = function createPalette({ container, isPopup = false, onClose }) {
    const backdrop = document.createElement("div");
    backdrop.className = `qc-backdrop${isPopup ? " qc-is-popup" : ""}`;

    const modal = document.createElement("div");
    modal.className = "qc-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "QuickCmd command palette");
    backdrop.appendChild(modal);

    const searchRow = document.createElement("div");
    searchRow.className = "qc-search-row";

    const searchIcon = createSvgIcon("search");
    searchIcon.classList.add("qc-search-icon");

    const listId = "qc-results-listbox";
    const input = document.createElement("input");
    input.className = "qc-input";
    input.type = "text";
    input.placeholder = "Search tabs, bookmarks, history, or type > for commands…";
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

    const CHIP_MODES = [
      { id: "all", label: "All", icon: "search" },
      { id: "tabs", label: "Tabs", icon: "globe" },
      { id: "groups", label: "Groups", icon: "layers" },
      { id: "closed", label: "Closed", icon: "rotateCcw" },
      { id: "bookmarks", label: "Bookmarks", icon: "star" },
      { id: "history", label: "History", icon: "history" },
      { id: "commands", label: "Commands", icon: "zap" }
    ];

    let chipMode = "all";
    const chipsBar = document.createElement("div");
    chipsBar.className = "qc-chips";
    const chipButtons = new Map();
    for (const c of CHIP_MODES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `qc-chip${c.id === chipMode ? " qc-chip-active" : ""}`;
      btn.textContent = c.label;
      btn.addEventListener("click", () => {
        chipMode = c.id;
        selectedIndex = 0;
        render();
        input.focus();
      });
      chipButtons.set(c.id, btn);
      chipsBar.appendChild(btn);
    }

    const listEl = document.createElement("div");
    listEl.className = "qc-list";
    listEl.id = listId;
    listEl.setAttribute("role", "listbox");

    const liveRegion = document.createElement("div");
    liveRegion.className = "qc-sr-only";
    liveRegion.setAttribute("aria-live", "polite");

    const footer = document.createElement("div");
    footer.className = "qc-footer";

    const hints = document.createElement("div");
    hints.className = "qc-hints";

    const prefixLegend = document.createElement("div");
    prefixLegend.className = "qc-prefix-legend";
    for (const p of [">", "@", "*", "/h", "/g", "/c"]) {
      const k = document.createElement("kbd");
      k.className = "qc-kbd";
      k.textContent = p;
      prefixLegend.appendChild(k);
    }
    footer.append(hints, prefixLegend);

    modal.append(searchRow, chipsBar, listEl, liveRegion, footer);
    container.appendChild(backdrop);

    let data = { tabs: [], tabGroups: [], closedTabs: [], quickLinks: [], chromePages: [], bookmarks: [], history: [], activeTab: null };
    let currentItems = [];
    let selectedIndex = 0;
    let isClosing = false;

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
      if (selected) {
        if (selected.kind === "tab") {
          specs = [
            ["↵", "Switch"],
            ["⌘⌫", "Close"],
            ["⌘P", "Pin"],
            ["⌘M", "Mute"],
            ["⌘D", "Duplicate"]
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

    function render(preserveId = null) {
      const { prefixLabel, activeMode, cleanQuery, isGrouped, modeCounts, items } = buildResults(data, input.value, chipMode);
      currentItems = items;

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
        const isActive = c.id === activeMode;
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

        const modeObj = CHIP_MODES.find((c) => c.id === activeMode) || CHIP_MODES[0];
        const emptyIcon = createSvgIcon(modeObj.icon);
        emptyIcon.classList.add("qc-empty-icon");
        empty.appendChild(emptyIcon);

        const msg = document.createElement("div");
        msg.textContent = cleanQuery
          ? `No ${modeObj.label.toLowerCase()} matches "${cleanQuery}".`
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
              if (/^(>|@|\*|\/[hgc]\s)/.test(raw)) {
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
        renderHighlightedText(title, item.title, cleanQuery);

        const sub = document.createElement("div");
        sub.className = "qc-item-sub";
        sub.title = item.subtitle || "";
        sub.textContent = item.subtitle || "";
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
          badge.textContent = item.badge;
          meta.appendChild(badge);
        }

        const enterHint = document.createElement("span");
        enterHint.className = "qc-enter-hint";
        enterHint.textContent = `↵ ${item.enterVerb || "Open"}`;
        meta.appendChild(enterHint);

        if (item.kind === "tab") {
          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "qc-tab-btn";
          closeBtn.title = "Close tab (⌘⌫)";
          closeBtn.textContent = "✕";
          closeBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const currentId = currentItems[selectedIndex]?.id;
            await sendRuntimeMessage({
              type: "EXECUTE_ACTION",
              payload: { action: "CLOSE_TAB", tabId: item.tabId }
            });
            await refreshData(currentId);
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
          closeWithMotion();
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
      historyTimer = setTimeout(() => {
        const currentId = currentItems[selectedIndex]?.id;
        refreshData(currentId);
      }, 140);
    });

    input.addEventListener("keydown", async (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const selected = currentItems[selectedIndex];

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeWithMotion();
        return;
      }

      if (e.key === "Backspace" && !mod) {
        const trimmed = input.value.trimStart();
        if (trimmed === ">" || trimmed === "@" || trimmed === "*" || trimmed === "/h" || trimmed === "/g" || trimmed === "/c") {
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

      if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "p")) {
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

      if (e.key === "Enter" && selected) {
        e.preventDefault();
        await selected.run();
        closeWithMotion();
        return;
      }

      if (mod && selected && selected.kind === "tab") {
        const k = e.key.toLowerCase();
        const currentId = selected.id;
        if (e.key === "Backspace") {
          e.preventDefault();
          await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "CLOSE_TAB", tabId: selected.tabId } });
          await refreshData();
        } else if (k === "p") {
          e.preventDefault();
          await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "PIN_TAB", tabId: selected.tabId } });
          await refreshData(currentId);
        } else if (k === "m") {
          e.preventDefault();
          await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "MUTE_TAB", tabId: selected.tabId } });
          await refreshData(currentId);
        } else if (k === "d") {
          e.preventDefault();
          await sendRuntimeMessage({ type: "EXECUTE_ACTION", payload: { action: "DUPLICATE_TAB", tabId: selected.tabId } });
          await refreshData(currentId);
        }
      }
    });

    if (!isPopup) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeWithMotion();
      });
    }

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
