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
    tabsSendMessage: [],
    windowsUpdate: [],
    windowsCreate: [],
    tabGroupsUpdate: [],
    managementGetAll: 0,
    managementSetEnabled: [],
    permissionsContains: [],
    scriptingExecuteScript: [],
    actionOpenPopup: 0,
    storageSessionSet: [],
    storageLocalSet: []
  };

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
        return opts.groupId ?? 55;
      },
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
      create: async (b) => b,
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
