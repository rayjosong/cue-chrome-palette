if (typeof importScripts === "function" && typeof globalThis.__CueCore === "undefined") {
  importScripts("palette-core.js");
}
const { normalizeUrlForDedup, extractBaseDomain, extractHostname } = globalThis.__CueCore;

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
let mruLoaded = false;

async function ensureMruLoaded() {
  if (mruLoaded) return;
  mruLoaded = true;
  try {
    // Renamed from QuickCmd: fall back to the old key once so existing
    // MRU data survives the rename, then drop the old key.
    const stored = await chrome.storage.session.get(["cueMru", "quickcmdMru"]);
    const data = stored.cueMru || stored.quickcmdMru;
    if (data && typeof data === "object") {
      if (!stored.cueMru && stored.quickcmdMru) chrome.storage.session.remove("quickcmdMru").catch(() => {});
      for (const [k, v] of Object.entries(data)) {
        const numId = Number(k);
        const numVal = Number(v);
        if (!isNaN(numId) && !isNaN(numVal)) {
          mruTimestamps.set(numId, numVal);
        }
      }
    }
  } catch {
    // Session storage might fail or be unavailable in certain contexts
  }
}

function persistMru() {
  try {
    const obj = Object.fromEntries(mruTimestamps);
    chrome.storage.session.set({ cueMru: obj }).catch(() => {});
  } catch {
    // Ignore storage errors
  }
}

const MAX_CLOSED_TABS = 15;
const tabSnapshots = new Map();
let closedTabsCache = [];
let closedTabsLoaded = false;

async function ensureClosedTabsLoaded() {
  if (closedTabsLoaded) return;
  closedTabsLoaded = true;
  try {
    const stored = await chrome.storage.session.get("cueClosedTabs");
    if (Array.isArray(stored.cueClosedTabs)) {
      closedTabsCache = stored.cueClosedTabs.slice(0, MAX_CLOSED_TABS);
    }
  } catch {
    // Session storage might be unavailable
  }
}

function persistClosedTabs() {
  try {
    chrome.storage.session.set({ cueClosedTabs: closedTabsCache }).catch(() => {});
  } catch {
    // Ignore storage errors
  }
}

function recordTabSnapshot(tab) {
  if (!tab || tab.id == null || !tab.url || isRestrictedUrl(tab.url)) return;
  tabSnapshots.set(tab.id, {
    title: tab.title || tab.url,
    url: tab.url,
    favIconUrl: tab.favIconUrl || ""
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  mruTimestamps.set(tabId, Date.now());
  persistMru();
  if (chrome.tabs.get) {
    chrome.tabs.get(tabId).then(recordTabSnapshot).catch(() => {});
  }
});

if (chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
      recordTabSnapshot(tab);
    }
  });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  mruTimestamps.delete(tabId);
  persistMru();

  const snap = tabSnapshots.get(tabId);
  tabSnapshots.delete(tabId);
  if (!snap || !snap.url || isRestrictedUrl(snap.url)) return;

  await ensureClosedTabsLoaded();
  const entry = {
    sessionId: `local-${Date.now()}-${tabId}`,
    title: snap.title || snap.url || "Closed Tab",
    url: snap.url,
    favIconUrl: snap.favIconUrl || "",
    lastModified: Math.floor(Date.now() / 1000)
  };
  closedTabsCache = [
    entry,
    ...closedTabsCache.filter((c) => c.url !== entry.url)
  ].slice(0, MAX_CLOSED_TABS);
  persistClosedTabs();
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
    url.startsWith("view-source:") ||
    url.startsWith("devtools://") ||
    url.startsWith("chrome-search://") ||
    url.startsWith("data:") ||
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
    const res = await chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_PALETTE" });
    if (res && res.ok) return;
    throw new Error("Palette not initialized in tab");
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["content.js"]
      });
      const res = await chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_PALETTE" });
      if (!res || !res.ok) throw new Error("Fallback to popup");
    } catch {
      try {
        await chrome.action.openPopup();
      } catch {
        // Ignore if popup cannot be opened programmatically.
      }
    }
  }
});

const DEFAULT_IDLE_TAB_MINUTES = 60;

async function getQuickLinks() {
  const { quickLinks } = await chrome.storage.sync.get("quickLinks");
  return Array.isArray(quickLinks) ? quickLinks : DEFAULT_QUICK_LINKS;
}

async function getIdleTabMinutes() {
  const { idleTabMinutes } = await chrome.storage.sync.get("idleTabMinutes");
  const parsed = Number(idleTabMinutes);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_IDLE_TAB_MINUTES;
}

let cachedBookmarks = null;

if (chrome.bookmarks) {
  const invalidateBookmarks = () => { cachedBookmarks = null; };
  chrome.bookmarks.onCreated.addListener(invalidateBookmarks);
  chrome.bookmarks.onRemoved.addListener(invalidateBookmarks);
  chrome.bookmarks.onChanged.addListener(invalidateBookmarks);
  chrome.bookmarks.onMoved.addListener(invalidateBookmarks);
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

async function getBookmarks() {
  if (cachedBookmarks) return cachedBookmarks;
  try {
    const tree = await chrome.bookmarks.getTree();
    cachedBookmarks = await flattenBookmarks(tree);
    return cachedBookmarks;
  } catch {
    return [];
  }
}

async function getFrecency() {
  try {
    // Renamed from QuickCmd: fall back to the old key once so existing
    // frecency data survives the rename.
    const stored = await chrome.storage.local.get(["cueFrecency", "quickcmdFrecency"]);
    const data = stored.cueFrecency || stored.quickcmdFrecency;
    if (data && typeof data === "object") {
      if (!stored.cueFrecency && stored.quickcmdFrecency) chrome.storage.local.remove("quickcmdFrecency").catch(() => {});
      return data;
    }
    return {};
  } catch {
    return {};
  }
}

async function recordUsage(itemId) {
  if (!itemId) return { ok: false };
  try {
    const frecency = await getFrecency();
    const entry = frecency[itemId] || { count: 0, lastUsed: 0 };
    frecency[itemId] = {
      count: entry.count + 1,
      lastUsed: Date.now()
    };
    const keys = Object.keys(frecency);
    if (keys.length > 300) {
      const sorted = keys.sort((a, b) => (frecency[b].lastUsed || 0) - (frecency[a].lastUsed || 0));
      const pruned = {};
      for (let i = 0; i < 250 && i < sorted.length; i++) {
        pruned[sorted[i]] = frecency[sorted[i]];
      }
      await chrome.storage.local.set({ cueFrecency: pruned });
      return { ok: true, frecency: pruned };
    }
    await chrome.storage.local.set({ cueFrecency: frecency });
    return { ok: true, frecency };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getManagementData() {
  if (!chrome.management) {
    return { themesPermission: false, themes: [], extensions: [] };
  }
  try {
    // Theme switching & extension management are opt-in: `management` is an
    // optional permission, so never touch chrome.management until granted.
    const granted = await chrome.permissions.contains({ permissions: ["management"] }).catch(() => false);
    if (!granted) {
      return { themesPermission: false, themes: [], extensions: [] };
    }
    const all = await chrome.management.getAll().catch(() => []);
    const themes = all
      .filter((ext) => ext.type === "theme")
      .map((ext) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description || "",
        enabled: Boolean(ext.enabled),
        version: ext.version || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const extensions = all
      .filter((ext) => ext.type === "extension" && ext.id !== chrome.runtime.id)
      .map((ext) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description || "",
        enabled: Boolean(ext.enabled),
        optionsUrl: ext.optionsUrl || "",
        version: ext.version || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { themesPermission: true, themes, extensions };
  } catch {
    return { themesPermission: false, themes: [], extensions: [] };
  }
}

async function searchHistory(query = "") {
  try {
    const items = await chrome.history.search({
      text: query.trim(),
      maxResults: 30,
      startTime: Date.now() - 1000 * 60 * 60 * 24 * 30
    });
    return items
      .filter((h) => h.url)
      .map((h) => ({
        id: `hist-${h.id}`,
        title: h.title || h.url,
        url: h.url,
        visitCount: h.visitCount || 0
      }));
  } catch {
    return [];
  }
}

async function getRecentDownloads() {
  if (!chrome.downloads) return [];
  try {
    const items = await chrome.downloads.search({ limit: 30, orderBy: ["-startTime"] }).catch(() => []);
    return items.map((d) => {
      const filename = d.filename || "";
      const basename = filename.split(/[/\\]/).pop() || filename || "Download";
      return {
        id: d.id,
        filename,
        basename,
        url: d.url || "",
        state: d.state || "",
        mime: d.mime || "",
        startTime: d.startTime || "",
        fileSize: d.fileSize || 0
      };
    });
  } catch {
    return [];
  }
}

async function getPaletteData(query = "") {
  await Promise.all([ensureMruLoaded(), ensureClosedTabsLoaded()]);

  const [tabs, activeTabs, quickLinks, idleTabMinutes, bookmarks, historyItems, tabGroups, frecency, mgmtData, downloads, normalWindows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, currentWindow: true }),
    getQuickLinks(),
    getIdleTabMinutes(),
    getBookmarks(),
    searchHistory(query),
    chrome.tabGroups ? chrome.tabGroups.query({}).catch(() => []) : Promise.resolve([]),
    getFrecency(),
    getManagementData(),
    getRecentDownloads(),
    chrome.windows ? chrome.windows.getAll({ populate: false, windowTypes: ["normal"] }).catch(() => []) : Promise.resolve([])
  ]);

  const { themesPermission, themes, extensions } = mgmtData;
  const activeTab = activeTabs[0] || null;

  const tabsByWindow = new Map();
  for (const t of tabs) {
    let info = tabsByWindow.get(t.windowId);
    if (!info) {
      info = { count: 0, activeTitle: "" };
      tabsByWindow.set(t.windowId, info);
    }
    info.count += 1;
    if (t.active && !info.activeTitle) {
      info.activeTitle = t.title || "";
    }
  }

  const windows = (normalWindows || []).map((w) => {
    const info = tabsByWindow.get(w.id);
    return {
      id: w.id,
      focused: Boolean(w.focused),
      incognito: Boolean(w.incognito),
      tabCount: info ? info.count : 0,
      title: info?.activeTitle || "Window"
    };
  });

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
    recordTabSnapshot(t);
    if (t.groupId !== undefined && t.groupId !== -1 && groupMap.has(t.groupId)) {
      groupMap.get(t.groupId).tabCount += 1;
    }
    return {
      id: t.id,
      windowId: t.windowId,
      groupId: t.groupId ?? -1,
      ...(t.index !== undefined ? { index: t.index } : {}),
      title: t.title || "Untitled",
      url: t.url || "",
      favIconUrl: t.favIconUrl || "",
      active: t.active,
      currentWindow: activeTab ? t.windowId === activeTab.windowId : false,
      pinned: t.pinned,
      audible: Boolean(t.audible),
      discarded: Boolean(t.discarded),
      muted: Boolean(t.mutedInfo?.muted),
      lastAccessed: Math.max(t.lastAccessed || 0, mruTimestamps.get(t.id) || 0)
    };
  });

  mappedTabs.sort((a, b) => {
    if (a.active && a.currentWindow) return 1;
    if (b.active && b.currentWindow) return -1;
    return b.lastAccessed - a.lastAccessed;
  });

  const closedTabs = [...closedTabsCache];

  return {
    activeTab: activeTab
      ? {
          id: activeTab.id,
          windowId: activeTab.windowId,
          groupId: activeTab.groupId ?? -1,
          title: activeTab.title,
          url: activeTab.url,
          pinned: activeTab.pinned,
          audible: Boolean(activeTab.audible),
          discarded: Boolean(activeTab.discarded),
          muted: Boolean(activeTab.mutedInfo?.muted)
        }
      : null,
    tabs: mappedTabs,
    tabGroups: Array.from(groupMap.values()),
    closedTabs,
    quickLinks,
    idleTabMinutes,
    chromePages: CHROME_PAGES,
    bookmarks,
    history: historyItems,
    frecency,
    themes,
    themesPermission,
    extensions,
    downloads,
    windows
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
      if (tabId !== undefined) {
        chrome.tabs.sendMessage(tabId, { type: "SHOW_TOAST", toast: "Switched tab" }).catch(() => {});
      }
      return { ok: true, toast: "Switched tab" };
    }
    case "CLOSE_TAB": {
      await chrome.tabs.remove(tabId);
      return { ok: true, toast: "Closed tab" };
    }
    case "PIN_TAB": {
      const tab = await chrome.tabs.get(tabId);
      const nextPinned = !tab.pinned;
      await chrome.tabs.update(tabId, { pinned: nextPinned });
      return { ok: true, pinned: nextPinned, toast: !nextPinned ? "Unpinned tab" : "Pinned tab" };
    }
    case "MUTE_TAB": {
      const tab = await chrome.tabs.get(tabId);
      const nextMuted = !tab.mutedInfo?.muted;
      await chrome.tabs.update(tabId, { muted: nextMuted });
      return { ok: true, muted: nextMuted, toast: nextMuted ? "Muted tab" : "Unmuted tab" };
    }
    case "DUPLICATE_TAB": {
      await chrome.tabs.duplicate(tabId);
      return { ok: true, toast: "Duplicated tab" };
    }
    case "CLOSE_OTHER_TABS": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active) return { ok: false };
      const all = await chrome.tabs.query({ currentWindow: true });
      const toClose = all.filter((t) => t.id !== active.id && !t.pinned).map((t) => t.id);
      if (toClose.length) await chrome.tabs.remove(toClose);
      return { ok: true, toast: "Closed " + toClose.length + " tab(s)" };
    }
    case "CLOSE_IDLE_TABS": {
      await ensureMruLoaded();
      const rawMinutes = Number(payload.idleMinutes);
      const idleMinutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? Math.floor(rawMinutes) : await getIdleTabMinutes();
      const cutoff = Date.now() - idleMinutes * 60 * 1000;
      const all = await chrome.tabs.query({ currentWindow: true });
      const toClose = all
        .filter((t) => {
          if (t.active || t.pinned || t.audible) return false;
          const lastAccessed = Math.max(t.lastAccessed || 0, mruTimestamps.get(t.id) || 0);
          return lastAccessed > 0 && lastAccessed <= cutoff;
        })
        .map((t) => t.id);
      if (toClose.length) await chrome.tabs.remove(toClose);
      return {
        ok: true,
        closedCount: toClose.length,
        toast: toClose.length
          ? `Closed ${toClose.length} idle ${toClose.length === 1 ? "tab" : "tabs"}`
          : `No idle tabs (${idleMinutes}+ min)`
      };
    }
    case "NEW_TAB_IN_GROUP": {
      let groupId = payload.groupId;
      let targetWindowId = windowId;
      if (groupId === undefined || groupId === -1) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active) {
          groupId = active.groupId;
          if (targetWindowId === undefined) targetWindowId = active.windowId;
        }
      }
      if (groupId === undefined || groupId === -1) {
        return { ok: false, error: "Current tab is not in a group" };
      }
      const createOpts = { active: true };
      if (targetWindowId !== undefined) createOpts.windowId = targetWindowId;
      const created = await chrome.tabs.create(createOpts);
      if (created?.id !== undefined && chrome.tabs?.group) {
        await chrome.tabs.group({ tabIds: [created.id], groupId });
      }
      return { ok: true, tabId: created?.id, toast: "Opened new tab in group" };
    }
    case "OPEN_URL_IN_CURRENT_GROUP": {
      if (!url) return { ok: false, error: "No URL provided" };
      let groupId = payload.groupId;
      let targetWindowId = windowId;
      if (groupId === undefined || groupId === -1) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active) {
          groupId = active.groupId;
          if (targetWindowId === undefined) targetWindowId = active.windowId;
        }
      }
      const createOpts = { url, active: true };
      if (targetWindowId !== undefined) createOpts.windowId = targetWindowId;
      const created = await chrome.tabs.create(createOpts);
      if (created?.id !== undefined && groupId !== undefined && groupId !== -1 && chrome.tabs?.group) {
        await chrome.tabs.group({ tabIds: [created.id], groupId });
      }
      return {
        ok: true,
        tabId: created?.id,
        toast: groupId !== undefined && groupId !== -1 ? "Opened in current group" : undefined
      };
    }
    case "MOVE_TAB_NEW_WINDOW": {
      if (payload.tabId !== undefined) {
        await chrome.windows.create({ tabId: payload.tabId });
      } else {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active) await chrome.windows.create({ tabId: active.id });
      }
      return { ok: true, toast: "Moved tab to new window" };
    }
    case "OPEN_URL_CURRENT_TAB": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active) {
        await chrome.tabs.update(active.id, { url });
      } else {
        await chrome.tabs.create({ url });
      }
      return { ok: true };
    }
    case "OPEN_URL_NEW_WINDOW": {
      await chrome.windows.create({ url });
      return { ok: true };
    }
    case "PULL_TAB_TO_CURRENT_WINDOW": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active) {
        await chrome.tabs.move(payload.tabId, { windowId: active.windowId, index: -1 });
        await chrome.tabs.update(payload.tabId, { active: true });
      }
      return { ok: true, toast: "Moved tab to current window" };
    }
    case "NEW_INCOGNITO": {
      await chrome.windows.create({ incognito: true });
      return { ok: true, toast: "Opened new incognito window" };
    }
    case "MUTE_AUDIBLE_TABS": {
      const all = await chrome.tabs.query({});
      const audible = all.filter((t) => t.audible);
      for (const t of audible) {
        await chrome.tabs.update(t.id, { muted: true });
      }
      return {
        ok: true,
        mutedCount: audible.length,
        toast: audible.length ? `Muted ${audible.length} audible ${audible.length === 1 ? "tab" : "tabs"}` : "No audible tabs found"
      };
    }
    case "MUTE_OTHER_TABS": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      const all = await chrome.tabs.query({ currentWindow: true });
      const toMute = all.filter((t) => (!active || t.id !== active.id) && !t.mutedInfo?.muted);
      for (const t of toMute) {
        await chrome.tabs.update(t.id, { muted: true });
      }
      return {
        ok: true,
        mutedCount: toMute.length,
        toast: `Muted ${toMute.length} other ${toMute.length === 1 ? "tab" : "tabs"}`
      };
    }
    case "RELOAD_TAB": {
      let targetTabId = payload.tabId;
      if (!targetTabId) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTabId = active ? active.id : null;
      }
      if (!targetTabId) return { ok: false, error: "No tab to reload" };
      await chrome.tabs.reload(targetTabId, { bypassCache: Boolean(payload.bypassCache) });
      return { ok: true, toast: payload.bypassCache ? "Hard reloaded tab (bypass cache)" : "Reloaded tab" };
    }
    case "OPEN_IN_INCOGNITO": {
      await chrome.windows.create({ url: payload.url, incognito: true });
      return { ok: true, toast: "Opened in incognito window" };
    }
    case "OPEN_URL": {
      const target = payload.target || "new";
      if (target === "current") {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active) {
          await chrome.tabs.update(active.id, { url });
        } else {
          await chrome.tabs.create({ url });
        }
      } else if (target === "background") {
        await chrome.tabs.create({ url, active: false });
      } else {
        await chrome.tabs.create({ url });
      }
      return { ok: true };
    }
    case "OPEN_OPTIONS": {
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    }
    case "RESTORE_SESSION": {
      await ensureClosedTabsLoaded();
      const idx = closedTabsCache.findIndex((c) => c.sessionId === payload.sessionId);
      if (idx !== -1) {
        const [entry] = closedTabsCache.splice(idx, 1);
        persistClosedTabs();
        if (entry?.url) {
          await chrome.tabs.create({ url: entry.url, active: true });
          return { ok: true, toast: "Restored closed tab" };
        }
      }
      if (chrome.sessions?.restore && payload.sessionId && !String(payload.sessionId).startsWith("local-")) {
        await chrome.sessions.restore(payload.sessionId);
        return { ok: true, toast: "Restored closed session" };
      }
      return { ok: false, error: "Closed tab is no longer available" };
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
      return { ok: true, toast: "Grouped current tab" };
    }
    case "UNGROUP_CURRENT_TAB": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active && active.groupId !== -1) {
        await chrome.tabs.ungroup(active.id);
      }
      return { ok: true, toast: "Removed tab from group" };
    }
    case "CLOSE_DUPLICATE_TABS": {
      await ensureMruLoaded();
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const map = new Map();
      for (const t of allTabs) {
        if (!t.url || t.url.startsWith("chrome://") || t.url.startsWith("about:")) continue;
        const norm = normalizeUrlForDedup(t.url);
        if (!map.has(norm)) map.set(norm, []);
        map.get(norm).push(t);
      }
      const toClose = [];
      for (const [, group] of map.entries()) {
        if (group.length > 1) {
          group.sort((a, b) => {
            if (a.active) return -1;
            if (b.active) return 1;
            const ma = Math.max(a.lastAccessed || 0, mruTimestamps.get(a.id) || 0);
            const mb = Math.max(b.lastAccessed || 0, mruTimestamps.get(b.id) || 0);
            return mb - ma;
          });
          for (let i = 1; i < group.length; i++) {
            if (!group[i].pinned) {
              toClose.push(group[i].id);
            }
          }
        }
      }
      if (toClose.length) {
        await chrome.tabs.remove(toClose);
      }
      return {
        ok: true,
        closedCount: toClose.length,
        toast: toClose.length ? `Closed ${toClose.length} duplicate ${toClose.length === 1 ? "tab" : "tabs"}` : "No duplicate tabs found"
      };
    }
    case "CLOSE_DOMAIN_TABS": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      let domain = payload.domain;
      if (!domain && active && active.url) {
        try {
          domain = new URL(active.url).hostname;
        } catch {}
      }
      if (!domain) return { ok: false, error: "No domain specified" };
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const ids = [];
      for (const t of allTabs) {
        if (t.pinned) continue;
        try {
          if (new URL(t.url).hostname === domain) {
            ids.push(t.id);
          }
        } catch {}
      }
      if (ids.length) {
        await chrome.tabs.remove(ids);
      }
      return {
        ok: true,
        closedCount: ids.length,
        toast: `Closed ${ids.length} ${domain} ${ids.length === 1 ? "tab" : "tabs"}`
      };
    }
    case "CLOSE_BASE_DOMAIN_TABS": {
      let baseDomain = payload.baseDomain ? extractBaseDomain(payload.baseDomain) : "";
      if (!baseDomain) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active && active.url) {
          baseDomain = extractBaseDomain(active.url);
        }
      }
      if (!baseDomain) return { ok: false, error: "No base domain specified" };

      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const ids = [];
      for (const t of allTabs) {
        if (t.pinned) continue;
        if (extractBaseDomain(t.url) === baseDomain) {
          ids.push(t.id);
        }
      }
      if (ids.length) {
        await chrome.tabs.remove(ids);
      }
      return {
        ok: true,
        closedCount: ids.length,
        toast: `Closed ${ids.length} ${baseDomain} ${ids.length === 1 ? "tab" : "tabs"}`
      };
    }
    case "ASSIGN_TAB_TO_GROUP": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabIds = payload.tabIds || [payload.tabId || (active ? active.id : null)].filter(Boolean);
      const groupId = payload.groupId;
      if (!tabIds.length || groupId === undefined) return { ok: false, error: "Missing tabIds or groupId" };
      await chrome.tabs.group({ groupId, tabIds });
      let grp = null;
      try {
        grp = await chrome.tabGroups.get(groupId);
      } catch {}
      return {
        ok: true,
        groupId,
        toast: `Added to group "${grp?.title || "Group"}"`
      };
    }
    case "CREATE_TAB_GROUP": {
      let tabIds = payload.tabIds;
      if (!tabIds || !tabIds.length) {
        if (payload.domain) {
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          tabIds = [];
          for (const t of allTabs) {
            try {
              if (new URL(t.url).hostname === payload.domain) {
                tabIds.push(t.id);
              }
            } catch {}
          }
        }
        if (!tabIds || !tabIds.length) {
          const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (active) tabIds = [payload.tabId || active.id];
        }
      }
      if (!tabIds || !tabIds.length) return { ok: false, error: "No tabs to group" };
      const groupId = await chrome.tabs.group({ tabIds });
      const title = payload.title || "";
      const color = payload.color || "blue";
      await chrome.tabGroups.update(groupId, { title, color });
      return {
        ok: true,
        groupId,
        toast: `Created group "${title || "Untitled"}" (${tabIds.length} ${tabIds.length === 1 ? "tab" : "tabs"})`
      };
    }
    case "SWITCH_CHROME_THEME": {
      const { themeId } = payload;
      // `management` is optional: refuse cleanly when it was never granted
      // (or was revoked) instead of throwing inside chrome.management.
      const themesGranted = await chrome.permissions.contains({ permissions: ["management"] }).catch(() => false);
      if (!themesGranted) {
        return { ok: false, error: "Theme switching is off — enable it in Cue options." };
      }
      if (themeId) {
        try {
          const ext = await chrome.management.get(themeId);
          await chrome.management.setEnabled(themeId, true);
          return { ok: true, toast: `Activated theme: ${ext.name}` };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      } else {
        try {
          const all = await chrome.management.getAll();
          for (const ext of all) {
            if (ext.type === "theme" && ext.enabled && ext.id !== chrome.runtime.id) {
              await chrome.management.setEnabled(ext.id, false);
            }
          }
          return { ok: true, toast: "Restored default Chrome theme" };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }
    }
    case "RENAME_RECOLOR_GROUP": {
      const { groupId, title, color } = payload;
      const updateProps = {};
      if (title !== undefined) updateProps.title = title;
      if (color !== undefined) updateProps.color = color;
      await chrome.tabGroups.update(groupId, updateProps);
      return { ok: true, toast: `Updated group "${title || "Group"}"` };
    }
    case "UNGROUP_ALL_IN_GROUP": {
      const { groupId } = payload;
      const groupTabs = await chrome.tabs.query({ groupId });
      if (groupTabs.length) {
        await chrome.tabs.ungroup(groupTabs.map((t) => t.id));
      }
      return { ok: true, toast: `Ungrouped ${groupTabs.length} tab(s)` };
    }
    case "CLOSE_GROUP_TABS": {
      const { groupId } = payload;
      const groupTabs = await chrome.tabs.query({ groupId });
      if (groupTabs.length) {
        await chrome.tabs.remove(groupTabs.map((t) => t.id));
      }
      return { ok: true, toast: `Closed ${groupTabs.length} tab(s) in group` };
    }
    case "MOVE_TAB_TO_WINDOW": {
      const { tabId, targetWindowId } = payload;
      await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
      await chrome.windows.update(targetWindowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      return { ok: true, toast: "Moved tab to window" };
    }
    case "MERGE_ALL_WINDOWS": {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active) return { ok: false, error: "No active tab" };
      const currentWinId = active.windowId;
      const allWindows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
      let movedCount = 0;
      for (const win of allWindows) {
        if (win.id !== currentWinId && Boolean(win.incognito) === Boolean(active.incognito) && Array.isArray(win.tabs)) {
          const tabIds = win.tabs.map((t) => t.id).filter(Boolean);
          if (tabIds.length) {
            await chrome.tabs.move(tabIds, { windowId: currentWinId, index: -1 });
            movedCount += tabIds.length;
          }
        }
      }
      return { ok: true, toast: `Merged ${movedCount} tab(s) into current window` };
    }
    case "SPLIT_TABS": {
      const requestedIds = Array.isArray(payload.tabIds) ? payload.tabIds : [];
      const uniqueIds = [...new Set(requestedIds)].filter((id) => Number.isFinite(id));
      if (uniqueIds.length < 2) {
        return { ok: false, error: "Select at least 2 tabs to split" };
      }

      const allTabs = await chrome.tabs.query({});
      const tabById = new Map(allTabs.map((t) => [t.id, t]));
      const validTabs = uniqueIds.map((id) => tabById.get(id)).filter(Boolean);
      if (validTabs.length < 2) {
        return { ok: false, error: "Select at least 2 open tabs to split" };
      }

      if (payload.mode === "native" && validTabs.length === 2) {
        if (typeof chrome.tabs.createSplit !== "function") {
          return {
            ok: false,
            error: "Native Split View API is unavailable in this Chrome version (use Side by Side (Win))"
          };
        }
        const [tab1, tab2] = validTabs;
        try {
          if (tab1.splitViewId != null && tab1.splitViewId !== -1 && typeof chrome.tabs.unsplit === "function") {
            await chrome.tabs.unsplit(tab1.splitViewId);
          }
          if (tab2.splitViewId != null && tab2.splitViewId !== -1 && typeof chrome.tabs.unsplit === "function") {
            await chrome.tabs.unsplit(tab2.splitViewId);
          }
          if (tab2.windowId !== tab1.windowId) {
            await chrome.tabs.move(tab2.id, { windowId: tab1.windowId, index: tab1.index + 1 });
          } else if (Math.abs(tab2.index - tab1.index) !== 1) {
            await chrome.tabs.move(tab2.id, { index: tab1.index + 1 });
          }
          await chrome.tabs.createSplit([tab1.id, tab2.id]);
          await chrome.windows.update(tab1.windowId, { focused: true }).catch(() => {});
          await chrome.tabs.update(tab1.id, { active: true }).catch(() => {});
          return { ok: true, toast: "Split 2 tabs in window" };
        } catch (err) {
          return { ok: false, error: err?.message || "Could not create native Split View" };
        }
      }

      const allWindows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
      const winById = new Map(allWindows.map((w) => [w.id, w]));
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentWin = (active && winById.get(active.windowId)) || allWindows[0];

      let rects = Array.isArray(payload.rects) && payload.rects.length === validTabs.length
        ? payload.rects.map((r) => ({
            left: Math.round(r.left),
            top: Math.round(r.top),
            width: Math.max(300, Math.round(r.width)),
            height: Math.max(200, Math.round(r.height))
          }))
        : null;

      if (!rects) {
        const baseLeft = Number.isFinite(currentWin?.left) ? currentWin.left : 0;
        const baseTop = Number.isFinite(currentWin?.top) ? currentWin.top : 0;
        const baseWidth = Math.max(300, Number.isFinite(currentWin?.width) ? currentWin.width : 1200);
        const baseHeight = Math.max(200, Number.isFinite(currentWin?.height) ? currentWin.height : 800);
        const colW = Math.floor(baseWidth / validTabs.length);
        rects = validTabs.map((_, idx) => ({
          left: baseLeft + idx * colW,
          top: baseTop,
          width: idx === validTabs.length - 1 ? baseWidth - colW * (validTabs.length - 1) : colW,
          height: baseHeight
        }));
      }

      const usedWindowIds = new Set();
      const paneWindowIds = [];

      for (let i = 0; i < validTabs.length; i++) {
        const tab = validTabs[i];
        const rect = rects[i];
        const tabWin = winById.get(tab.windowId);
        const canReuseCurrent = i === 0 && currentWin && tab.windowId === currentWin.id && !usedWindowIds.has(currentWin.id);
        const canReuseSolo = tabWin && Array.isArray(tabWin.tabs) && tabWin.tabs.length === 1 && !usedWindowIds.has(tabWin.id);

        if (canReuseCurrent || canReuseSolo) {
          const targetWinId = tab.windowId;
          usedWindowIds.add(targetWinId);
          paneWindowIds.push(targetWinId);
          await chrome.tabs.update(tab.id, { active: true });
          if (tabWin && tabWin.state && tabWin.state !== "normal") {
            await chrome.windows.update(targetWinId, { state: "normal" });
          }
          await chrome.windows.update(targetWinId, rect);
        } else {
          const created = await chrome.windows.create({
            tabId: tab.id,
            incognito: Boolean(tab.incognito),
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            focused: false
          });
          if (created?.id != null) {
            usedWindowIds.add(created.id);
            paneWindowIds.push(created.id);
          }
        }
      }

      if (paneWindowIds.length > 0) {
        await chrome.windows.update(paneWindowIds[0], { focused: true }).catch(() => {});
      }

      const layoutSuffix = payload.layoutLabel ? ` (${payload.layoutLabel})` : "";
      return { ok: true, toast: `Split ${validTabs.length} tabs${layoutSuffix}` };
    }
    case "UNSPLIT_TAB": {
      if (typeof chrome.tabs.unsplit !== "function") {
        return { ok: false, error: "Native Split View API is unavailable in this Chrome version" };
      }
      let splitViewId = payload.splitViewId;
      if (splitViewId == null || splitViewId === -1) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        splitViewId = active?.splitViewId;
      }
      if (splitViewId == null || splitViewId === -1) {
        return { ok: false, error: "Tab is not in a Split View" };
      }
      await chrome.tabs.unsplit(splitViewId);
      return { ok: true, toast: "Unsplit tab view" };
    }
    case "CONSOLIDATE_GROUPS_AND_SEPARATE_TABS": {
      if (!chrome.tabGroups) return { ok: false, error: "Tab groups API unavailable" };
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active) return { ok: false, error: "No active tab" };
      const currentWinId = active.windowId;
      const isIncognito = Boolean(active.incognito);

      const initialWindows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
      const sameTypeWinIds = new Set(
        initialWindows.filter((w) => Boolean(w.incognito) === isIncognito).map((w) => w.id)
      );
      const allGroups = await chrome.tabGroups.query({}).catch(() => []);
      const sameTypeGroups = allGroups.filter((g) => sameTypeWinIds.has(g.windowId));
      if (sameTypeGroups.length === 0) {
        return { ok: false, error: "No tab groups to consolidate" };
      }

      // 1. Move all groups from other matching windows into the current window first
      // so the current window stays open even if its ungrouped tabs are moved out next.
      let movedGroupsCount = 0;
      for (const grp of sameTypeGroups) {
        if (grp.windowId !== currentWinId) {
          await chrome.tabGroups.move(grp.id, { windowId: currentWinId, index: -1 });
          movedGroupsCount += 1;
        }
      }

      // 2. Re-query windows and move all unpinned, ungrouped tabs into another window.
      const updatedWindows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
      const remainingSameType = updatedWindows.filter((w) => Boolean(w.incognito) === isIncognito);
      const otherWindows = remainingSameType.filter((w) => w.id !== currentWinId);
      const ungroupedTabs = [];
      for (const win of remainingSameType) {
        for (const t of win.tabs || []) {
          if (!t.pinned && (t.groupId == null || t.groupId === -1)) {
            ungroupedTabs.push(t);
          }
        }
      }

      if (ungroupedTabs.length === 0) {
        return {
          ok: true,
          toast: movedGroupsCount > 0
            ? `Consolidated ${movedGroupsCount} group(s) into this window`
            : "All groups are already in this window"
        };
      }

      let movedTabsCount = 0;
      if (otherWindows.length > 0) {
        const targetOtherWinId = otherWindows[0].id;
        const tabIdsToMove = ungroupedTabs
          .filter((t) => t.windowId !== targetOtherWinId)
          .map((t) => t.id)
          .filter(Boolean);
        if (tabIdsToMove.length > 0) {
          await chrome.tabs.move(tabIdsToMove, { windowId: targetOtherWinId, index: -1 });
          movedTabsCount = tabIdsToMove.length;
        }
      } else {
        const [firstTab, ...restTabs] = ungroupedTabs;
        const newWin = await chrome.windows.create({
          tabId: firstTab.id,
          incognito: isIncognito,
          focused: false
        });
        const restIds = restTabs.map((t) => t.id).filter(Boolean);
        if (restIds.length > 0 && newWin?.id) {
          await chrome.tabs.move(restIds, { windowId: newWin.id, index: -1 });
        }
        movedTabsCount = ungroupedTabs.length;
      }

      const toast = movedTabsCount > 0
        ? `Consolidated ${sameTypeGroups.length} group(s) here; moved ${movedTabsCount} ungrouped tab(s) to another window`
        : `Consolidated ${sameTypeGroups.length} group(s) here; ungrouped tabs already in another window`;
      return { ok: true, toast };
    }
    case "TOGGLE_BOOKMARK": {
      const { url, title } = payload;
      if (!chrome.bookmarks) return { ok: false, error: "Bookmarks API unavailable" };
      const found = await chrome.bookmarks.search({ url });
      const matches = (found || []).filter((b) => b.url === url);
      if (matches.length > 0) {
        for (const b of matches) {
          await chrome.bookmarks.remove(b.id);
        }
        cachedBookmarks = null;
        return { ok: true, bookmarked: false, toast: "Removed bookmark" };
      } else {
        await chrome.bookmarks.create({ title: title || url, url });
        cachedBookmarks = null;
        return { ok: true, bookmarked: true, toast: "Bookmarked page" };
      }
    }
    case "TOGGLE_EXTENSION": {
      const mgmtGranted = await chrome.permissions.contains({ permissions: ["management"] }).catch(() => false);
      if (!mgmtGranted || !chrome.management) {
        return { ok: false, error: "Extension management is off — enable it in Cue options." };
      }
      const ext = await chrome.management.get(payload.extensionId);
      const nextState = !ext.enabled;
      await chrome.management.setEnabled(payload.extensionId, nextState);
      return {
        ok: true,
        enabled: nextState,
        toast: `${nextState ? "Enabled" : "Disabled"} ${ext.name}`
      };
    }
    case "OPEN_EXTENSION_OPTIONS": {
      const mgmtGranted = await chrome.permissions.contains({ permissions: ["management"] }).catch(() => false);
      if (!mgmtGranted || !chrome.management) {
        return { ok: false, error: "Extension management is off — enable it in Cue options." };
      }
      const ext = await chrome.management.get(payload.extensionId);
      if (ext.optionsUrl) {
        await chrome.tabs.create({ url: ext.optionsUrl });
        return { ok: true };
      }
      return { ok: false, error: "Extension has no options page" };
    }
    case "OPEN_DOWNLOAD": {
      if (!chrome.downloads) return { ok: false, error: "Downloads API unavailable" };
      await chrome.downloads.open(payload.downloadId);
      return { ok: true, toast: "Opened download" };
    }
    case "SHOW_DOWNLOAD_IN_FOLDER": {
      if (!chrome.downloads) return { ok: false, error: "Downloads API unavailable" };
      chrome.downloads.show(payload.downloadId);
      return { ok: true, toast: "Showing download in folder" };
    }
    case "AUTO_GROUP_BY_DOMAIN": {
      const all = await chrome.tabs.query({ currentWindow: true });
      const ungrouped = all.filter((t) => !t.pinned && (t.groupId == null || t.groupId === -1));
      const byDomain = new Map();
      for (const t of ungrouped) {
        const bd = extractBaseDomain(t.url);
        if (!bd) continue;
        if (!byDomain.has(bd)) byDomain.set(bd, []);
        byDomain.get(bd).push(t.id);
      }
      const colors = globalThis.__CueCore.GROUP_COLORS || ["blue", "purple", "cyan", "green", "yellow", "orange", "pink", "red", "grey"];
      let groupsCreated = 0;
      let groupedCount = 0;
      for (const [baseDomain, tabIds] of byDomain.entries()) {
        if (tabIds.length < 2) continue;
        const groupId = await chrome.tabs.group({ tabIds });
        const title = globalThis.__CueCore.suggestDomainGroupTitle
          ? globalThis.__CueCore.suggestDomainGroupTitle(baseDomain)
          : baseDomain.split(".")[0].charAt(0).toUpperCase() + baseDomain.split(".")[0].slice(1);
        const color = colors[groupsCreated % colors.length];
        if (chrome.tabGroups?.update) {
          await chrome.tabGroups.update(groupId, { title, color });
        }
        groupsCreated += 1;
        groupedCount += tabIds.length;
      }
      return {
        ok: true,
        groupedCount,
        groupsCreated,
        toast: groupsCreated > 0
          ? `Auto-grouped ${groupedCount} tabs into ${groupsCreated} ${groupsCreated === 1 ? "group" : "groups"}`
          : "No websites with 2+ ungrouped tabs found"
      };
    }
    case "DISCARD_TAB": {
      if (!chrome.tabs.discard) return { ok: false, error: "Tab discard API unavailable" };
      if (payload.tabId == null) return { ok: false, error: "No tab specified" };
      await chrome.tabs.discard(payload.tabId);
      return { ok: true, toast: "Suspended tab to save memory" };
    }
    case "DISCARD_IDLE_TABS": {
      if (!chrome.tabs.discard) return { ok: false, error: "Tab discard API unavailable" };
      await ensureMruLoaded();
      const rawMinutes = Number(payload.idleMinutes);
      const idleMinutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? Math.floor(rawMinutes) : await getIdleTabMinutes();
      const cutoff = Date.now() - idleMinutes * 60 * 1000;
      const all = await chrome.tabs.query({ currentWindow: true });
      const toDiscard = all.filter((t) => {
        if (t.active || t.pinned || t.audible || t.discarded) return false;
        const lastAccessed = Math.max(t.lastAccessed || 0, mruTimestamps.get(t.id) || 0);
        return lastAccessed > 0 && lastAccessed <= cutoff;
      });
      for (const t of toDiscard) {
        await chrome.tabs.discard(t.id);
      }
      return {
        ok: true,
        discardedCount: toDiscard.length,
        toast: toDiscard.length
          ? `Suspended ${toDiscard.length} idle ${toDiscard.length === 1 ? "tab" : "tabs"}`
          : `No idle tabs to suspend (${idleMinutes}+ min)`
      };
    }
    case "DISCARD_OTHER_TABS": {
      if (!chrome.tabs.discard) return { ok: false, error: "Tab discard API unavailable" };
      const all = await chrome.tabs.query({ currentWindow: true });
      const toDiscard = all.filter((t) => !t.active && !t.pinned && !t.audible && !t.discarded);
      for (const t of toDiscard) {
        await chrome.tabs.discard(t.id);
      }
      return {
        ok: true,
        discardedCount: toDiscard.length,
        toast: toDiscard.length
          ? `Suspended ${toDiscard.length} background ${toDiscard.length === 1 ? "tab" : "tabs"}`
          : "No background tabs to suspend"
      };
    }
    case "SORT_TABS_BY_DOMAIN": {
      const all = await chrome.tabs.query({ currentWindow: true });
      const unpinned = all.filter((t) => !t.pinned);
      if (unpinned.length < 2) {
        return { ok: true, sortedCount: 0, toast: "Not enough unpinned tabs to sort" };
      }
      unpinned.sort((a, b) => {
        const da = extractBaseDomain(a.url) || extractHostname(a.url) || a.url || "";
        const db = extractBaseDomain(b.url) || extractHostname(b.url) || b.url || "";
        const cmp = da.localeCompare(db);
        if (cmp !== 0) return cmp;
        return (a.title || "").localeCompare(b.title || "");
      });
      const pinnedCount = all.filter((t) => t.pinned).length;
      const sortedIds = unpinned.map((t) => t.id);
      await chrome.tabs.move(sortedIds, { index: pinnedCount });
      return {
        ok: true,
        sortedCount: unpinned.length,
        toast: `Sorted ${unpinned.length} tabs by website`
      };
    }
    case "BOOKMARK_TAB_GROUP": {
      if (!chrome.bookmarks) return { ok: false, error: "Bookmarks API unavailable" };
      let groupId = payload.groupId;
      if (groupId == null || groupId === -1) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        groupId = active ? active.groupId : -1;
      }
      if (groupId == null || groupId === -1) {
        return { ok: false, error: "No tab group selected" };
      }
      const grp = chrome.tabGroups ? await chrome.tabGroups.get(groupId).catch(() => null) : null;
      const groupTabs = (await chrome.tabs.query({ groupId })).filter((t) => t.url && /^https?:\/\//i.test(t.url));
      if (!groupTabs.length) {
        return { ok: false, error: "No bookmarkable tabs in group" };
      }
      const folderTitle = payload.folderTitle || (grp?.title ? `Cue: ${grp.title}` : "Cue Tab Group");
      const folder = await chrome.bookmarks.create({ title: folderTitle });
      for (const t of groupTabs) {
        await chrome.bookmarks.create({ parentId: folder?.id, title: t.title || t.url, url: t.url });
      }
      cachedBookmarks = null;
      return {
        ok: true,
        folderId: folder?.id,
        savedCount: groupTabs.length,
        toast: `Saved ${groupTabs.length} tabs to bookmark folder "${folderTitle}"`
      };
    }
    case "CLOSE_TABS_TO_RIGHT": {
      const all = await chrome.tabs.query({ currentWindow: true });
      const refTab = payload.tabId != null
        ? all.find((t) => t.id === payload.tabId)
        : all.find((t) => t.active);
      if (!refTab) {
        return { ok: false, error: "No active tab found" };
      }
      let toClose;
      if (typeof refTab.index === "number") {
        toClose = all.filter((t) => !t.pinned && typeof t.index === "number" && t.index > refTab.index);
      } else {
        const refIdx = all.indexOf(refTab);
        toClose = all.slice(refIdx + 1).filter((t) => !t.pinned);
      }
      if (toClose.length > 0) {
        await chrome.tabs.remove(toClose.map((t) => t.id));
      }
      return {
        ok: true,
        closedCount: toClose.length,
        toast: toClose.length
          ? `Closed ${toClose.length} ${toClose.length === 1 ? "tab" : "tabs"} to the right`
          : "No unpinned tabs to the right"
      };
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

  if (message.type === "SEARCH_HISTORY") {
    searchHistory(message.query || "")
      .then((history) => sendResponse({ ok: true, history }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "RECORD_USAGE") {
    recordUsage(message.itemId)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_DEFAULT_QUICK_LINKS") {
    sendResponse({ ok: true, defaults: DEFAULT_QUICK_LINKS });
    return false;
  }
});

