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

chrome.tabs.onActivated.addListener(({ tabId }) => {
  mruTimestamps.set(tabId, Date.now());
  persistMru();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mruTimestamps.delete(tabId);
  persistMru();
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
        files: ["palette-core.js", "palette-ui.js", "content.js"]
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

async function getQuickLinks() {
  const { quickLinks } = await chrome.storage.sync.get("quickLinks");
  return Array.isArray(quickLinks) ? quickLinks : DEFAULT_QUICK_LINKS;
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

async function getInstalledThemes() {
  if (!chrome.management) return [];
  try {
    // Theme switching is opt-in: `management` is an optional permission, so
    // never touch chrome.management until the user has granted it.
    const granted = await chrome.permissions.contains({ permissions: ["management"] });
    if (!granted) return [];
    const all = await chrome.management.getAll().catch(() => []);
    return all
      .filter((ext) => ext.type === "theme")
      .map((ext) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description || "",
        enabled: Boolean(ext.enabled),
        version: ext.version || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
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

function normalizeUrlForDedup(rawUrl = "") {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) {
      s = s.slice(0, -1);
    }
    return s;
  } catch {
    return rawUrl.replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

async function getInstalledExtensions() {
  if (!chrome.management) return [];
  try {
    const granted = await chrome.permissions.contains({ permissions: ["management"] });
    if (!granted) return [];
    const all = await chrome.management.getAll().catch(() => []);
    return all
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

const TWO_PART_PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk",
  "com.au", "net.au", "org.au",
  "co.nz",
  "co.jp", "ne.jp", "or.jp",
  "com.sg", "edu.sg", "gov.sg",
  "com.br", "com.mx",
  "co.in", "co.kr", "com.hk", "com.tw"
]);

function extractBaseDomain(rawUrl = "") {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith("chrome://") ||
    trimmed.startsWith("chrome-extension://") ||
    trimmed.startsWith("edge://") ||
    trimmed.startsWith("about:") ||
    trimmed.startsWith("view-source:") ||
    trimmed.startsWith("devtools://") ||
    trimmed.startsWith("chrome-search://") ||
    trimmed.startsWith("data:")
  ) {
    return "";
  }

  let host = "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      host = u.hostname.toLowerCase();
    } catch {
      return "";
    }
  } else if (trimmed.includes("://")) {
    return "";
  } else {
    try {
      const u = new URL(`http://${trimmed}`);
      host = u.hostname.toLowerCase();
    } catch {
      host = trimmed.toLowerCase();
    }
  }

  if (!host) return "";

  if (host.startsWith("www.")) {
    host = host.slice(4);
  }

  const isIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const isIpv6 = host.includes(":") || (host.startsWith("[") && host.endsWith("]"));
  if (host === "localhost" || isIpv4 || isIpv6) {
    return host;
  }

  const parts = host.split(".");
  if (parts.length <= 1) {
    return host;
  }

  const lastTwo = parts.slice(-2).join(".");
  if (TWO_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
    if (parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return host;
  }

  return parts.slice(-2).join(".");
}

async function getPaletteData(query = "") {
  await ensureMruLoaded();

  const [tabs, activeTabs, quickLinks, bookmarks, historyItems, tabGroups, recentSessions, frecency, themes, themesPermission, extensions, downloads, normalWindows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, currentWindow: true }),
    getQuickLinks(),
    getBookmarks(),
    searchHistory(query),
    chrome.tabGroups ? chrome.tabGroups.query({}).catch(() => []) : Promise.resolve([]),
    chrome.sessions ? chrome.sessions.getRecentlyClosed({ maxResults: 15 }).catch(() => []) : Promise.resolve([]),
    getFrecency(),
    getInstalledThemes(),
    chrome.permissions.contains({ permissions: ["management"] }).catch(() => false),
    getInstalledExtensions(),
    getRecentDownloads(),
    chrome.windows ? chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }).catch(() => []) : Promise.resolve([])
  ]);

  const activeTab = activeTabs[0] || null;

  const windows = (normalWindows || []).map((w) => {
    const activeInWin = (w.tabs || []).find((t) => t.active);
    return {
      id: w.id,
      focused: Boolean(w.focused),
      incognito: Boolean(w.incognito),
      tabCount: (w.tabs || []).length,
      title: activeInWin?.title || "Window"
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
          audible: Boolean(activeTab.audible),
          discarded: Boolean(activeTab.discarded),
          muted: Boolean(activeTab.mutedInfo?.muted)
        }
      : null,
    tabs: mappedTabs,
    tabGroups: Array.from(groupMap.values()),
    closedTabs,
    quickLinks,
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
      await chrome.sessions.restore(payload.sessionId);
      return { ok: true, toast: "Restored closed session" };
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

