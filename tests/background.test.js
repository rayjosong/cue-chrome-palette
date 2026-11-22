const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createChromeHarness(overrides = {}) {
  const listeners = {
    onActivated: [],
    onRemoved: [],
    onInstalled: [],
    onCommand: [],
    onMessage: []
  };

  const calls = {
    tabsUpdate: [],
    tabsRemove: [],
    tabsCreate: [],
    tabsDuplicate: [],
    tabsGroup: [],
    tabsMove: [],
    tabsDiscard: [],
    tabsSendMessage: [],
    windowsUpdate: [],
    windowsCreate: [],
    tabGroupsUpdate: [],
    bookmarksCreate: [],
    managementGetAll: 0,
    managementSetEnabled: [],
    permissionsContains: [],
    scriptingExecuteScript: [],
    actionOpenPopup: 0,
    storageSessionSet: [],
    storageLocalSet: []
  };
  let nextGroupId = 55;
  let nextBookmarkId = 100;

  const state = {
    managementGranted: overrides.managementGranted ?? false,
    tabs: overrides.tabs ?? [
      { id: 1, windowId: 100, groupId: -1, title: "Active Page", url: "https://app.github.com/issues", active: true, pinned: false, lastAccessed: 1000 },
      { id: 2, windowId: 100, groupId: 10, title: "Docs", url: "https://docs.github.com/en", active: false, pinned: false, lastAccessed: 3000 },
      { id: 3, windowId: 100, groupId: -1, title: "Example", url: "https://example.com/", active: false, pinned: true, lastAccessed: 2000 },
      { id: 4, windowId: 200, groupId: -1, title: "Other Window", url: "https://news.ycombinator.com/", active: true, pinned: false, lastAccessed: 500 }
    ],
    tabGroups: overrides.tabGroups ?? [
      { id: 10, title: "Work", color: "blue", collapsed: false, windowId: 100 }
    ],
    bookmarksTree: overrides.bookmarksTree ?? [
      {
        id: "0",
        title: "",
        children: [
          {
            id: "1",
            title: "Bookmarks Bar",
            children: [{ id: "11", title: "MDN", url: "https://developer.mozilla.org" }]
          }
        ]
      }
    ],
    historyItems: overrides.historyItems ?? [
      { id: "h1", title: "Node Docs", url: "https://nodejs.org/api/test.html", visitCount: 5 }
    ],
    sessions: overrides.sessions ?? [
      { tab: { sessionId: "s1", title: "Closed Tab", url: "https://closed.example.com" }, lastModified: 1700000000 }
    ],
    managementAll: overrides.managementAll ?? [
      { id: "theme-1", name: "Dark Theme", type: "theme", enabled: true, description: "Dark", version: "1.0" },
      { id: "ext-1", name: "uBlock Origin", type: "extension", enabled: true, description: "Blocker", optionsUrl: "chrome-extension://ext-1/options.html", version: "1.5" },
      { id: "cue-self-id", name: "Cue", type: "extension", enabled: true }
    ],
    downloads: overrides.downloads ?? [
      { id: 77, filename: "/Users/test/Downloads/report.pdf", url: "https://example.com/report.pdf", state: "complete", mime: "application/pdf", fileSize: 1024 }
    ],
    windows: overrides.windows ?? [
      { id: 100, focused: true, incognito: false, tabs: [{ id: 1, active: true, title: "Active Page" }, { id: 2 }, { id: 3 }] },
      { id: 200, focused: false, incognito: false, tabs: [{ id: 4, active: true, title: "Other Window" }] }
    ],
    quickLinks: overrides.quickLinks ?? null,
    frecency: overrides.frecency ?? {},
    sessionStorage: overrides.sessionStorage ?? {}
  };

  const chrome = {
    runtime: {
      id: "cue-self-id",
      onInstalled: { addListener: (fn) => listeners.onInstalled.push(fn) },
      onMessage: { addListener: (fn) => listeners.onMessage.push(fn) }
    },
    commands: {
      onCommand: { addListener: (fn) => listeners.onCommand.push(fn) }
    },
    action: {
      openPopup: async () => {
        calls.actionOpenPopup += 1;
      }
    },
    scripting: {
      executeScript: async (opts) => {
        calls.scriptingExecuteScript.push(opts);
      }
    },
    permissions: {
      contains: async (query) => {
        calls.permissionsContains.push(query);
        if (query?.permissions?.includes("management")) return state.managementGranted;
        return false;
      }
    },
    storage: {
      session: {
        get: async () => ({ ...state.sessionStorage }),
        set: async (obj) => {
          calls.storageSessionSet.push(obj);
          Object.assign(state.sessionStorage, obj);
        },
        remove: async (key) => {
          delete state.sessionStorage[key];
        }
      },
      sync: {
        get: async () => ({ quickLinks: state.quickLinks }),
        set: async (obj) => {
          if ("quickLinks" in obj) state.quickLinks = obj.quickLinks;
        }
      },
      local: {
        get: async () => ({ cueFrecency: state.frecency }),
        set: async (obj) => {
          calls.storageLocalSet.push(obj);
          if (obj.cueFrecency) state.frecency = obj.cueFrecency;
        },
        remove: async () => {}
      }
    },
    tabs: {
      onActivated: { addListener: (fn) => listeners.onActivated.push(fn) },
      onRemoved: { addListener: (fn) => listeners.onRemoved.push(fn) },
      query: async (q = {}) => {
        let res = [...state.tabs];
        if (q.currentWindow) res = res.filter((t) => t.windowId === 100);
        if (q.active) res = res.filter((t) => t.active);
        if (q.groupId !== undefined) res = res.filter((t) => t.groupId === q.groupId);
        return res;
      },
      get: async (tabId) => {
        const found = state.tabs.find((t) => t.id === tabId);
        if (!found) throw new Error(`Tab ${tabId} not found`);
        return found;
      },
      update: async (tabId, props) => {
        calls.tabsUpdate.push({ tabId, props });
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab) Object.assign(tab, props);
        return tab;
      },
      remove: async (tabIds) => {
        calls.tabsRemove.push(tabIds);
      },
      create: async (props) => {
        calls.tabsCreate.push(props);
        return { id: 999, windowId: 100, ...props };
      },
      duplicate: async (tabId) => {
        calls.tabsDuplicate.push(tabId);
        return { id: 998, windowId: 100 };
      },
      group: async (opts) => {
        calls.tabsGroup.push(opts);
        return opts.groupId ?? nextGroupId++;
      },
      move: async (tabIds, moveProps) => {
        calls.tabsMove.push({ tabIds, moveProps });
        return tabIds;
      },
      ...(overrides.tabsDiscardUnavailable
        ? {}
        : {
            discard: async (tabId) => {
              calls.tabsDiscard.push(tabId);
              const tab = state.tabs.find((t) => t.id === tabId);
              if (tab) tab.discarded = true;
              return tab;
            }
          }),
      sendMessage: async (tabId, msg) => {
        calls.tabsSendMessage.push({ tabId, msg });
        if (overrides.onTabSendMessage) return overrides.onTabSendMessage(tabId, msg);
        return { ok: true };
      }
    },
    windows: {
      getAll: async () => state.windows,
      update: async (windowId, props) => {
        calls.windowsUpdate.push({ windowId, props });
        return { id: windowId, ...props };
      },
      create: async (props) => {
        calls.windowsCreate.push(props);
        return { id: 300, ...props };
      }
    },
    tabGroups: {
      query: async () => state.tabGroups,
      get: async (id) => state.tabGroups.find((g) => g.id === id) || null,
      update: async (id, props) => {
        calls.tabGroupsUpdate.push({ id, props });
        return { id, ...props };
      }
    },
    bookmarks: {
      onCreated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
      onChanged: { addListener: () => {} },
      onMoved: { addListener: () => {} },
      getTree: async () => state.bookmarksTree,
      search: async () => [],
      create: async (b) => {
        const created = { id: `bm-${nextBookmarkId++}`, ...b };
        calls.bookmarksCreate.push(created);
        return created;
      },
      remove: async () => {}
    },
    history: {
      search: async () => state.historyItems
    },
    sessions: {
      getRecentlyClosed: async () => state.sessions
    },
    management: {
      getAll: async () => {
        calls.managementGetAll += 1;
        return state.managementAll;
      },
      get: async (id) => state.managementAll.find((e) => e.id === id),
      setEnabled: async (id, enabled) => {
        calls.managementSetEnabled.push({ id, enabled });
      }
    },
    downloads: {
      search: async () => state.downloads,
      open: async () => {},
      show: () => {}
    }
  };

  const context = vm.createContext({
    chrome,
    URL,
    Date,
    Map,
    Set,
    Promise,
    Math,
    Number,
    Object,
    Array,
    Error,
    isNaN,
    console,
    importScripts: (file) => {
      const scriptCode = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      vm.runInContext(scriptCode, context, { filename: file });
    }
  });
  context.globalThis = context;

  const code = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  vm.runInContext(code, context, { filename: "background.js" });

  function sendMessage(message) {
    return new Promise((resolve) => {
      const listener = listeners.onMessage[0];
      const isAsync = listener(message, {}, (res) => resolve(res));
      if (isAsync === false) {
        // Synchronous sendResponse already called
      }
    });
  }

  return { chrome, state, calls, listeners, sendMessage };
}

function plain(val) {
  return JSON.parse(JSON.stringify(val));
}

test("GET_PALETTE_DATA returns complete data shape, MRU order, and group tab counts", async () => {
  const { sendMessage, calls } = createChromeHarness({ managementGranted: false });
  const res = await sendMessage({ type: "GET_PALETTE_DATA", query: "" });

  assert.equal(res.ok, true);
  const { data } = res;
  assert.equal(data.activeTab.id, 1);
  assert.equal(data.tabs.length, 4);
  // Active tab in current window is placed last; remaining tabs sorted by lastAccessed desc
  assert.deepEqual(
    data.tabs.map((t) => t.id),
    [2, 3, 4, 1]
  );
  assert.equal(data.tabGroups[0].tabCount, 1);
  assert.equal(data.bookmarks.length, 1);
  assert.equal(data.history.length, 1);
  assert.deepEqual(plain(data.closedTabs), []);
  assert.equal(data.downloads[0].basename, "report.pdf");
  assert.equal(data.windows.length, 2);
  assert.equal(data.themesPermission, false);
  assert.deepEqual(plain(data.themes), []);
  assert.deepEqual(plain(data.extensions), []);
  assert.equal(calls.managementGetAll, 0);
});

test("GET_PALETTE_DATA returns sorted themes and extensions (excluding self) when management is granted", async () => {
  const { sendMessage, calls } = createChromeHarness({ managementGranted: true });
  const res = await sendMessage({ type: "GET_PALETTE_DATA", query: "" });

  assert.equal(res.ok, true);
  assert.equal(res.data.themesPermission, true);
  assert.equal(res.data.themes.length, 1);
  assert.equal(res.data.themes[0].id, "theme-1");
  assert.equal(res.data.extensions.length, 1);
  assert.equal(res.data.extensions[0].id, "ext-1");
  assert.equal(calls.managementGetAll, 1);
  assert.equal(calls.permissionsContains.length, 1);
});

test("EXECUTE_ACTION handles tab switching, pinning, closing, and base-domain actions", async () => {
  const { sendMessage, calls } = createChromeHarness();

  const sw = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "SWITCH_TAB", tabId: 2, windowId: 100 }
  });
  assert.equal(sw.ok, true);
  assert.deepEqual(plain(calls.tabsUpdate[0]), { tabId: 2, props: { active: true } });
  assert.deepEqual(plain(calls.windowsUpdate[0]), { windowId: 100, props: { focused: true } });

  const pin = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "PIN_TAB", tabId: 1 }
  });
  assert.equal(pin.ok, true);
  assert.equal(pin.pinned, true);
});

test("EXECUTE_ACTION CLOSE_BASE_DOMAIN_TABS closes unpinned tabs matching base domain", async () => {
  const { sendMessage, calls } = createChromeHarness();
  const closeDomain = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: "github.com" }
  });
  assert.equal(closeDomain.ok, true);
  assert.equal(closeDomain.closedCount, 2);
  assert.deepEqual(plain(calls.tabsRemove[0]), [1, 2]);
});

test("EXECUTE_ACTION gates extension management behind optional permission", async () => {
  const denied = createChromeHarness({ managementGranted: false });
  const resDenied = await denied.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "TOGGLE_EXTENSION", extensionId: "ext-1" }
  });
  assert.equal(resDenied.ok, false);
  assert.match(resDenied.error, /management/i);

  const granted = createChromeHarness({ managementGranted: true });
  const resGranted = await granted.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "TOGGLE_EXTENSION", extensionId: "ext-1" }
  });
  assert.equal(resGranted.ok, true);
  assert.equal(resGranted.enabled, false);
  assert.deepEqual(plain(granted.calls.managementSetEnabled[0]), { id: "ext-1", enabled: false });
});

test("toggle-palette command injects scripts on uninitialized tab and opens popup on restricted URLs", async () => {
  // Restricted URL -> openPopup
  const restricted = createChromeHarness({
    tabs: [{ id: 1, windowId: 100, url: "chrome://settings", active: true }]
  });
  await restricted.listeners.onCommand[0]("toggle-palette");
  assert.equal(restricted.calls.actionOpenPopup, 1);
  assert.equal(restricted.calls.tabsSendMessage.length, 0);

  // Uninitialized normal tab -> executeScript then TOGGLE_PALETTE
  let attempt = 0;
  const uninit = createChromeHarness({
    onTabSendMessage: () => {
      attempt += 1;
      if (attempt === 1) throw new Error("Receiving end does not exist");
      return { ok: true };
    }
  });
  await uninit.listeners.onCommand[0]("toggle-palette");
  assert.equal(uninit.calls.scriptingExecuteScript.length, 1);
  assert.deepEqual(Array.from(uninit.calls.scriptingExecuteScript[0].files), ["content.js"]);
  assert.equal(uninit.calls.tabsSendMessage.length, 2);
});

test("GET_DEFAULT_QUICK_LINKS and RECORD_USAGE respond with expected data", async () => {
  const { sendMessage, calls } = createChromeHarness();
  const defaults = await sendMessage({ type: "GET_DEFAULT_QUICK_LINKS" });
  assert.equal(defaults.ok, true);
  assert.ok(Array.isArray(defaults.defaults));
  assert.ok(defaults.defaults.some((l) => l.bang === "gh"));

  const usage = await sendMessage({ type: "RECORD_USAGE", itemId: "tab-2" });
  assert.equal(usage.ok, true);
  assert.equal(calls.storageLocalSet.length, 1);
});

test("recently closed tabs are tracked via tabs.onRemoved without calling chrome.sessions.getRecentlyClosed and restored via RESTORE_SESSION", async () => {
  const { sendMessage, listeners, calls, state } = createChromeHarness();
  state.sessions = null; // Would throw if chrome.sessions.getRecentlyClosed were called

  // Seed snapshots from open tabs
  await sendMessage({ type: "GET_PALETTE_DATA", query: "" });

  // Simulate closing tab 2 (https://docs.github.com/en)
  await listeners.onRemoved[0](2);

  const afterClose = await sendMessage({ type: "GET_PALETTE_DATA", query: "" });
  assert.equal(afterClose.data.closedTabs.length, 1);
  assert.equal(afterClose.data.closedTabs[0].url, "https://docs.github.com/en");

  const sessionId = afterClose.data.closedTabs[0].sessionId;
  const restoreRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "RESTORE_SESSION", sessionId }
  });
  assert.equal(restoreRes.ok, true);
  assert.deepEqual(plain(calls.tabsCreate[0]), { url: "https://docs.github.com/en", active: true });

  const afterRestore = await sendMessage({ type: "GET_PALETTE_DATA", query: "" });
  assert.deepEqual(plain(afterRestore.data.closedTabs), []);
});

test("EXECUTE_ACTION CLOSE_IDLE_TABS closes only unpinned silent inactive tabs older than threshold", async () => {
  const now = Date.now();
  const { sendMessage, calls } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, active: true, pinned: false, audible: false, lastAccessed: now - 120 * 60 * 1000, title: "Active", url: "https://a.com" },
      { id: 2, windowId: 100, active: false, pinned: true, audible: false, lastAccessed: now - 120 * 60 * 1000, title: "Pinned", url: "https://b.com" },
      { id: 3, windowId: 100, active: false, pinned: false, audible: true, lastAccessed: now - 120 * 60 * 1000, title: "Audible", url: "https://c.com" },
      { id: 4, windowId: 100, active: false, pinned: false, audible: false, lastAccessed: now - 10 * 60 * 1000, title: "Recent", url: "https://d.com" },
      { id: 5, windowId: 100, active: false, pinned: false, audible: false, lastAccessed: now - 90 * 60 * 1000, title: "Idle 1", url: "https://e.com" },
      { id: 6, windowId: 200, active: false, pinned: false, audible: false, lastAccessed: now - 90 * 60 * 1000, title: "Other Win", url: "https://f.com" }
    ]
  });

  const res = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "CLOSE_IDLE_TABS", idleMinutes: 60 }
  });
  assert.equal(res.ok, true);
  assert.equal(res.closedCount, 1);
  assert.deepEqual(plain(calls.tabsRemove[0]), [5]);
});

test("EXECUTE_ACTION NEW_TAB_IN_GROUP and OPEN_URL_IN_CURRENT_GROUP open tabs inside the target group", async () => {
  const { sendMessage, calls } = createChromeHarness();

  const newTabRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "NEW_TAB_IN_GROUP", groupId: 10, windowId: 100 }
  });
  assert.equal(newTabRes.ok, true);
  assert.deepEqual(plain(calls.tabsCreate[0]), { windowId: 100, active: true });
  assert.deepEqual(plain(calls.tabsGroup[0]), { tabIds: [999], groupId: 10 });

  const openUrlRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "OPEN_URL_IN_CURRENT_GROUP", url: "https://example.com", groupId: 10, windowId: 100 }
  });
  assert.equal(openUrlRes.ok, true);
  assert.deepEqual(plain(calls.tabsCreate[1]), { url: "https://example.com", windowId: 100, active: true });
  assert.deepEqual(plain(calls.tabsGroup[1]), { tabIds: [999], groupId: 10 });

  const noGroupRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "NEW_TAB_IN_GROUP", groupId: -1, windowId: 100 }
  });
  assert.equal(noGroupRes.ok, false);
});

test("GET_PALETTE_DATA preserves tab index when present", async () => {
  const { sendMessage } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, groupId: -1, index: 0, title: "First", url: "https://a.com", active: true, pinned: false, lastAccessed: 1000 },
      { id: 2, windowId: 100, groupId: -1, index: 1, title: "Second", url: "https://b.com", active: false, pinned: false, lastAccessed: 2000 }
    ]
  });
  const res = await sendMessage({ type: "GET_PALETTE_DATA", query: "" });
  assert.equal(res.ok, true);
  assert.equal(res.data.tabs.find((t) => t.id === 1).index, 0);
  assert.equal(res.data.tabs.find((t) => t.id === 2).index, 1);
});

test("EXECUTE_ACTION AUTO_GROUP_BY_DOMAIN groups unpinned ungrouped websites with 2+ tabs", async () => {
  const { sendMessage, calls } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, groupId: -1, title: "GH 1", url: "https://github.com/a", active: true, pinned: false },
      { id: 2, windowId: 100, groupId: -1, title: "GH 2", url: "https://docs.github.com/b", active: false, pinned: false },
      { id: 3, windowId: 100, groupId: -1, title: "GH Pinned", url: "https://gist.github.com/c", active: false, pinned: true },
      { id: 4, windowId: 100, groupId: 10, title: "Already Grouped", url: "https://developer.mozilla.org/a", active: false, pinned: false },
      { id: 5, windowId: 100, groupId: -1, title: "MDN 1", url: "https://developer.mozilla.org/b", active: false, pinned: false },
      { id: 6, windowId: 100, groupId: -1, title: "YT 1", url: "https://www.youtube.com/watch?v=1", active: false, pinned: false },
      { id: 7, windowId: 100, groupId: -1, title: "YT 2", url: "https://music.youtube.com/", active: false, pinned: false },
      { id: 8, windowId: 100, groupId: -1, title: "Settings", url: "chrome://settings", active: false, pinned: false },
      { id: 9, windowId: 200, groupId: -1, title: "Other Win", url: "https://github.com/other", active: false, pinned: false }
    ]
  });

  const res = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "AUTO_GROUP_BY_DOMAIN" }
  });
  assert.equal(res.ok, true);
  assert.equal(res.groupedCount, 4);
  assert.equal(res.groupsCreated, 2);
  assert.equal(calls.tabsGroup.length, 2);
  assert.deepEqual(plain(calls.tabsGroup[0]), { tabIds: [1, 2] });
  assert.deepEqual(plain(calls.tabsGroup[1]), { tabIds: [6, 7] });
  assert.equal(calls.tabGroupsUpdate.length, 2);
  assert.equal(calls.tabGroupsUpdate[0].props.color, "blue");
  assert.equal(calls.tabGroupsUpdate[1].props.color, "purple");
  assert.match(res.toast, /Auto-grouped 4 tabs into 2 groups/);

  // Empty case
  const emptyHarness = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, groupId: -1, title: "Solo", url: "https://example.com", active: true, pinned: false }
    ]
  });
  const emptyRes = await emptyHarness.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "AUTO_GROUP_BY_DOMAIN" }
  });
  assert.equal(emptyRes.ok, true);
  assert.equal(emptyRes.groupsCreated, 0);
  assert.equal(emptyRes.toast, "No websites with 2+ ungrouped tabs found");
});

test("EXECUTE_ACTION DISCARD_TAB, DISCARD_IDLE_TABS, and DISCARD_OTHER_TABS suspend eligible tabs", async () => {
  const now = Date.now();
  const { sendMessage, calls } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, active: true, pinned: false, audible: false, discarded: false, lastAccessed: now - 120 * 60 * 1000, title: "Active", url: "https://a.com" },
      { id: 2, windowId: 100, active: false, pinned: true, audible: false, discarded: false, lastAccessed: now - 120 * 60 * 1000, title: "Pinned", url: "https://b.com" },
      { id: 3, windowId: 100, active: false, pinned: false, audible: true, discarded: false, lastAccessed: now - 120 * 60 * 1000, title: "Audible", url: "https://c.com" },
      { id: 4, windowId: 100, active: false, pinned: false, audible: false, discarded: true, lastAccessed: now - 120 * 60 * 1000, title: "Already Discarded", url: "https://d.com" },
      { id: 5, windowId: 100, active: false, pinned: false, audible: false, discarded: false, lastAccessed: now - 10 * 60 * 1000, title: "Recent", url: "https://e.com" },
      { id: 6, windowId: 100, active: false, pinned: false, audible: false, discarded: false, lastAccessed: now - 90 * 60 * 1000, title: "Idle", url: "https://f.com" },
      { id: 7, windowId: 200, active: false, pinned: false, audible: false, discarded: false, lastAccessed: now - 90 * 60 * 1000, title: "Other Win", url: "https://g.com" }
    ]
  });

  // DISCARD_TAB
  const singleRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "DISCARD_TAB", tabId: 5 }
  });
  assert.equal(singleRes.ok, true);
  assert.deepEqual(plain(calls.tabsDiscard), [5]);

  // Reset tab 5 discarded to false for idle/other tests
  calls.tabsDiscard.length = 0;

  // DISCARD_IDLE_TABS (only tab 6 matches)
  const idleRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "DISCARD_IDLE_TABS", idleMinutes: 60 }
  });
  assert.equal(idleRes.ok, true);
  assert.equal(idleRes.discardedCount, 1);
  assert.deepEqual(plain(calls.tabsDiscard), [6]);

  // Unavailable discard API
  const unavailable = createChromeHarness({ tabsDiscardUnavailable: true });
  const unavailRes = await unavailable.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "DISCARD_TAB", tabId: 2 }
  });
  assert.equal(unavailRes.ok, false);
  assert.match(unavailRes.error, /unavailable/i);

  // DISCARD_OTHER_TABS
  const otherHarness = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, active: true, pinned: false, audible: false, discarded: false, title: "Active", url: "https://a.com" },
      { id: 2, windowId: 100, active: false, pinned: true, audible: false, discarded: false, title: "Pinned", url: "https://b.com" },
      { id: 3, windowId: 100, active: false, pinned: false, audible: true, discarded: false, title: "Audible", url: "https://c.com" },
      { id: 4, windowId: 100, active: false, pinned: false, audible: false, discarded: true, title: "Discarded", url: "https://d.com" },
      { id: 5, windowId: 100, active: false, pinned: false, audible: false, discarded: false, title: "Bg 1", url: "https://e.com" },
      { id: 6, windowId: 100, active: false, pinned: false, audible: false, discarded: false, title: "Bg 2", url: "https://f.com" }
    ]
  });
  const otherRes = await otherHarness.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "DISCARD_OTHER_TABS" }
  });
  assert.equal(otherRes.ok, true);
  assert.equal(otherRes.discardedCount, 2);
  assert.deepEqual(plain(otherHarness.calls.tabsDiscard), [5, 6]);
});

test("EXECUTE_ACTION SORT_TABS_BY_DOMAIN sorts unpinned tabs by website then title after pinned tabs", async () => {
  const { sendMessage, calls } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, index: 0, pinned: true, title: "Pinned", url: "https://zzz.com" },
      { id: 2, windowId: 100, index: 1, pinned: false, title: "Zebra", url: "https://news.ycombinator.com/" },
      { id: 3, windowId: 100, index: 2, pinned: false, title: "Beta", url: "https://docs.github.com/b" },
      { id: 4, windowId: 100, index: 3, pinned: false, title: "Alpha", url: "https://app.github.com/a" }
    ]
  });

  const res = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "SORT_TABS_BY_DOMAIN" }
  });
  assert.equal(res.ok, true);
  assert.equal(res.sortedCount, 3);
  assert.deepEqual(plain(calls.tabsMove[0]), {
    tabIds: [4, 3, 2],
    moveProps: { index: 1 }
  });

  const fewHarness = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, index: 0, pinned: true, title: "Pinned", url: "https://a.com" },
      { id: 2, windowId: 100, index: 1, pinned: false, title: "Only", url: "https://b.com" }
    ]
  });
  const fewRes = await fewHarness.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "SORT_TABS_BY_DOMAIN" }
  });
  assert.equal(fewRes.ok, true);
  assert.equal(fewRes.sortedCount, 0);
  assert.equal(fewHarness.calls.tabsMove.length, 0);
});

test("EXECUTE_ACTION BOOKMARK_TAB_GROUP saves http/https tabs in group to a bookmark folder", async () => {
  const { sendMessage, calls } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, groupId: 10, active: true, title: "GH Issues", url: "https://github.com/issues" },
      { id: 2, windowId: 100, groupId: 10, active: false, title: "MDN", url: "https://developer.mozilla.org" },
      { id: 3, windowId: 100, groupId: 10, active: false, title: "Settings", url: "chrome://settings" }
    ],
    tabGroups: [{ id: 10, title: "Research", color: "blue", windowId: 100 }]
  });

  const res = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "BOOKMARK_TAB_GROUP" } // falls back to active tab's groupId 10
  });
  assert.equal(res.ok, true);
  assert.equal(res.savedCount, 2);
  assert.ok(res.folderId);
  assert.equal(calls.bookmarksCreate.length, 3);
  assert.equal(calls.bookmarksCreate[0].title, "Cue: Research");
  assert.equal(calls.bookmarksCreate[1].parentId, res.folderId);
  assert.equal(calls.bookmarksCreate[1].url, "https://github.com/issues");
  assert.equal(calls.bookmarksCreate[2].parentId, res.folderId);
  assert.equal(calls.bookmarksCreate[2].url, "https://developer.mozilla.org");

  const noGrp = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "BOOKMARK_TAB_GROUP", groupId: -1 }
  });
  // When payload.groupId is -1 it falls back to active tab; test with ungrouped active tab
  const ungroupedHarness = createChromeHarness({
    tabs: [{ id: 1, windowId: 100, groupId: -1, active: true, title: "Solo", url: "https://a.com" }]
  });
  const ungroupedRes = await ungroupedHarness.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "BOOKMARK_TAB_GROUP" }
  });
  assert.equal(ungroupedRes.ok, false);
  assert.equal(noGrp.ok, true); // fallback to active tab group 10 succeeded above
});

test("EXECUTE_ACTION CLOSE_TABS_TO_RIGHT closes unpinned tabs to the right by index or array position", async () => {
  const { sendMessage, calls } = createChromeHarness({
    tabs: [
      { id: 1, windowId: 100, index: 0, pinned: false, active: false, title: "Left", url: "https://a.com" },
      { id: 2, windowId: 100, index: 1, pinned: false, active: true, title: "Ref", url: "https://b.com" },
      { id: 3, windowId: 100, index: 2, pinned: true, active: false, title: "Pinned Right", url: "https://c.com" },
      { id: 4, windowId: 100, index: 3, pinned: false, active: false, title: "Right 1", url: "https://d.com" },
      { id: 5, windowId: 100, index: 4, pinned: false, active: false, title: "Right 2", url: "https://e.com" }
    ]
  });

  const res = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "CLOSE_TABS_TO_RIGHT", tabId: 2 }
  });
  assert.equal(res.ok, true);
  assert.equal(res.closedCount, 2);
  assert.deepEqual(plain(calls.tabsRemove[0]), [4, 5]);

  // Fallback when index is absent (uses active tab when tabId omitted)
  const noIdxHarness = createChromeHarness({
    tabs: [
      { id: 10, windowId: 100, pinned: false, active: false, title: "Before", url: "https://a.com" },
      { id: 11, windowId: 100, pinned: false, active: true, title: "Active", url: "https://b.com" },
      { id: 12, windowId: 100, pinned: false, active: false, title: "After", url: "https://c.com" }
    ]
  });
  const noIdxRes = await noIdxHarness.sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "CLOSE_TABS_TO_RIGHT" }
  });
  assert.equal(noIdxRes.ok, true);
  assert.equal(noIdxRes.closedCount, 1);
  assert.deepEqual(plain(noIdxHarness.calls.tabsRemove[0]), [12]);
});

test("EXECUTE_ACTION FOLD_ALL_TAB_GROUPS and UNFOLD_ALL_TAB_GROUPS update current-window groups", async () => {
  const { sendMessage, calls } = createChromeHarness({
    tabGroups: [
      { id: 10, title: "Work", color: "blue", collapsed: false, windowId: 100 },
      { id: 11, title: "Docs", color: "green", collapsed: true, windowId: 100 },
      { id: 12, title: "Other", color: "red", collapsed: false, windowId: 200 }
    ]
  });

  const foldRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "FOLD_ALL_TAB_GROUPS" }
  });
  assert.equal(foldRes.ok, true);
  assert.equal(foldRes.toast, "Folded 1 tab group(s)");
  assert.deepEqual(plain(calls.tabGroupsUpdate), [{ id: 10, props: { collapsed: true } }]);

  const unfoldRes = await sendMessage({
    type: "EXECUTE_ACTION",
    payload: { action: "UNFOLD_ALL_TAB_GROUPS" }
  });
  assert.equal(unfoldRes.ok, true);
  assert.equal(unfoldRes.toast, "Unfolded 1 tab group(s)");
  assert.deepEqual(plain(calls.tabGroupsUpdate), [
    { id: 10, props: { collapsed: true } },
    { id: 11, props: { collapsed: false } }
  ]);
});
