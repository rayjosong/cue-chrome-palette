const DEFAULT_QUICK_LINKS = [
  { bang: "gh", title: "GitHub", url: "https://github.com", searchUrl: "https://github.com/search?q={query}" },
  { bang: "yt", title: "YouTube", url: "https://www.youtube.com", searchUrl: "https://www.youtube.com/results?search_query={query}" },
  { bang: "gm", title: "Gmail", url: "https://mail.google.com", searchUrl: "https://mail.google.com/mail/u/0/#search/{query}" },
  { bang: "cal", title: "Google Calendar", url: "https://calendar.google.com", searchUrl: "" },
  { bang: "g", title: "Google Search", url: "https://www.google.com", searchUrl: "https://www.google.com/search?q={query}" },
  { bang: "mdn", title: "MDN Web Docs", url: "https://developer.mozilla.org", searchUrl: "https://developer.mozilla.org/en-US/search?q={query}" }
];

const CHROME_PAGES = [
  { id: "chrome-settings", title: "Chrome Settings", subtitle: "chrome://settings", url: "chrome://settings" },
  { id: "chrome-extensions", title: "Extensions", subtitle: "chrome://extensions", url: "chrome://extensions" },
  { id: "chrome-shortcuts", title: "Extension Keyboard Shortcuts", subtitle: "chrome://extensions/shortcuts", url: "chrome://extensions/shortcuts" },
  { id: "chrome-downloads", title: "Downloads", subtitle: "chrome://downloads", url: "chrome://downloads" },
  { id: "chrome-history", title: "History", subtitle: "chrome://history", url: "chrome://history" },
  { id: "chrome-bookmarks", title: "Bookmark Manager", subtitle: "chrome://bookmarks", url: "chrome://bookmarks" },
  { id: "chrome-flags", title: "Chrome Flags (Experiments)", subtitle: "chrome://flags", url: "chrome://flags" },
  { id: "chrome-passwords", title: "Password Manager", subtitle: "chrome://password-manager", url: "chrome://password-manager" }
];

const mruTimestamps = new Map();

chrome.tabs.onActivated.addListener(({ tabId }) => {
  mruTimestamps.set(tabId, Date.now());
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mruTimestamps.delete(tabId);
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get("quickLinks");
  if (!stored.quickLinks) {
    await chrome.storage.sync.set({ quickLinks: DEFAULT_QUICK_LINKS });
  }
});

function isRestrictedUrl(url = "") {
  return (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("https://chromewebstore.google.com") ||
    url.startsWith("https://chrome.google.com/webstore")
  );
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-palette") return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || isRestrictedUrl(activeTab.url)) {
    try {
      await chrome.action.openPopup();
    } catch {
      // Older Chrome versions may not support openPopup() from all contexts.
    }
    return;
  }

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_PALETTE" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["palette-ui.js", "content.js"]
      });
      await chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_PALETTE" });
    } catch {
      try {
        await chrome.action.openPopup();
      } catch {
        // Ignore if popup cannot be opened programmatically.
      }
    }
  }
});

async function getQuickLinks() {
  const { quickLinks } = await chrome.storage.sync.get("quickLinks");
  return Array.isArray(quickLinks) ? quickLinks : DEFAULT_QUICK_LINKS;
}

async function flattenBookmarks(nodes, folderPath = "", out = []) {
  for (const node of nodes) {
    if (node.url) {
      out.push({
        id: `bm-${node.id}`,
        title: node.title || node.url,
        url: node.url,
        folder: folderPath
      });
    } else if (node.children) {
      const nextPath = node.title ? (folderPath ? `${folderPath} / ${node.title}` : node.title) : folderPath;
      await flattenBookmarks(node.children, nextPath, out);
    }
  }
  return out;
}

async function getPaletteData(query = "") {
  const [tabs, activeTabs, quickLinks, bookmarkTree, historyItems, tabGroups, recentSessions] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, currentWindow: true }),
    getQuickLinks(),
    chrome.bookmarks.getTree(),
    chrome.history.search({ text: query.trim(), maxResults: 30, startTime: Date.now() - 1000 * 60 * 60 * 24 * 30 }),
    chrome.tabGroups ? chrome.tabGroups.query({}).catch(() => []) : Promise.resolve([]),
    chrome.sessions ? chrome.sessions.getRecentlyClosed({ maxResults: 15 }).catch(() => []) : Promise.resolve([])
  ]);

  const activeTab = activeTabs[0] || null;
  const bookmarks = await flattenBookmarks(bookmarkTree);

  const groupMap = new Map();
  for (const g of tabGroups) {
    groupMap.set(g.id, {
      id: g.id,
      title: g.title || "Untitled Group",
      color: g.color || "grey",
      collapsed: Boolean(g.collapsed),
      windowId: g.windowId,
      currentWindow: activeTab ? g.windowId === activeTab.windowId : false,
      tabCount: 0
    });
  }

  const mappedTabs = tabs.map((t) => {
    if (t.groupId !== undefined && t.groupId !== -1 && groupMap.has(t.groupId)) {
      groupMap.get(t.groupId).tabCount += 1;
    }
    return {
      id: t.id,
      windowId: t.windowId,
      groupId: t.groupId ?? -1,
      title: t.title || "Untitled",
      url: t.url || "",
      favIconUrl: t.favIconUrl || "",
      active: t.active,
      currentWindow: activeTab ? t.windowId === activeTab.windowId : false,
      pinned: t.pinned,
      muted: Boolean(t.mutedInfo?.muted),
      lastAccessed: Math.max(t.lastAccessed || 0, mruTimestamps.get(t.id) || 0)
    };
  });

  mappedTabs.sort((a, b) => {
    if (a.active && a.currentWindow) return 1;
    if (b.active && b.currentWindow) return -1;
    return b.lastAccessed - a.lastAccessed;
  });

  const closedTabs = [];
  for (const s of recentSessions) {
    if (s.tab) {
      closedTabs.push({
        sessionId: s.tab.sessionId,
        title: s.tab.title || s.tab.url || "Closed Tab",
        url: s.tab.url || "",
        favIconUrl: s.tab.favIconUrl || "",
        lastModified: s.lastModified || 0
      });
    } else if (s.window && Array.isArray(s.window.tabs)) {
      closedTabs.push({
        sessionId: s.window.sessionId,
        title: `Closed Window (${s.window.tabs.length} tabs)`,
        url: s.window.tabs[0]?.url || "",
        favIconUrl: "",
        lastModified: s.lastModified || 0
      });
    }
  }

  return {
    activeTab: activeTab
      ? {
          id: activeTab.id,
          windowId: activeTab.windowId,
          groupId: activeTab.groupId ?? -1,
          title: activeTab.title,
          url: activeTab.url,
          pinned: activeTab.pinned,
          muted: Boolean(activeTab.mutedInfo?.muted)
        }
      : null,
    tabs: mappedTabs,
    tabGroups: Array.from(groupMap.values()),
    closedTabs,
    quickLinks,
    chromePages: CHROME_PAGES,
    bookmarks,
    history: historyItems
      .filter((h) => h.url)
      .map((h) => ({
        id: `hist-${h.id}`,
        title: h.title || h.url,
        url: h.url,
        visitCount: h.visitCount || 0
      }))
  };
}

async function executeAction(payload) {
  const { action, tabId, windowId, url } = payload;

  switch (action) {
    case "SWITCH_TAB": {
      await chrome.tabs.update(tabId, { active: true });
      if (windowId !== undefined) {
        await chrome.windows.update(windowId, { focused: true });
      }
      return { ok: true };
    }
    case "CLOSE_TAB": {
      await chrome.tabs.remove(tabId);
      return { ok: true };
    }
    case "PIN_TAB": {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { pinned: !tab.pinned });
      return { ok: true, pinned: !tab.pinned };
    }
    case "MUTE_TAB": {
      const tab = await chrome.tabs.get(tabId);
      const nextMuted = !tab.mutedInfo?.muted;
      await chrome.tabs.update(tabId, { muted: nextMuted });
      return { ok: true, muted: nextMuted };
    }
    case "DUPLICATE_TAB": {
      await chrome.tabs.duplicate(tabId);
      return { ok: true };
    }
    case "CLOSE_OTHER_TABS": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active) return { ok: false };
      const all = await chrome.tabs.query({ currentWindow: true });
      const toClose = all.filter((t) => t.id !== active.id && !t.pinned).map((t) => t.id);
      if (toClose.length) await chrome.tabs.remove(toClose);
      return { ok: true };
    }
    case "MOVE_TAB_NEW_WINDOW": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active) await chrome.windows.create({ tabId: active.id });
      return { ok: true };
    }
    case "NEW_INCOGNITO": {
      await chrome.windows.create({ incognito: true });
      return { ok: true };
    }
    case "OPEN_URL": {
      await chrome.tabs.create({ url });
      return { ok: true };
    }
    case "OPEN_OPTIONS": {
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    }
    case "RESTORE_SESSION": {
      await chrome.sessions.restore(payload.sessionId);
      return { ok: true };
    }
    case "FOCUS_GROUP": {
      const groupTabs = await chrome.tabs.query({ groupId: payload.groupId });
      if (groupTabs.length) {
        await chrome.tabs.update(groupTabs[0].id, { active: true });
        await chrome.windows.update(groupTabs[0].windowId, { focused: true });
      }
      return { ok: true };
    }
    case "TOGGLE_GROUP_COLLAPSE": {
      const grp = await chrome.tabGroups.get(payload.groupId);
      await chrome.tabGroups.update(payload.groupId, { collapsed: !grp.collapsed });
      return { ok: true };
    }
    case "GROUP_CURRENT_TAB": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active) {
        const opts = payload.groupId !== undefined ? { groupId: payload.groupId, tabIds: [active.id] } : { tabIds: [active.id] };
        await chrome.tabs.group(opts);
      }
      return { ok: true };
    }
    case "UNGROUP_CURRENT_TAB": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active && active.groupId !== -1) {
        await chrome.tabs.ungroup(active.id);
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PALETTE_DATA") {
    getPaletteData(message.query || "")
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "EXECUTE_ACTION") {
    executeAction(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_DEFAULT_QUICK_LINKS") {
    sendResponse({ ok: true, defaults: DEFAULT_QUICK_LINKS });
    return false;
  }
});
