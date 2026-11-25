const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createDomShim(overrides = {}) {
  class FakeClassList {
    constructor(el) {
      this._el = el;
      this._set = new Set();
    }
    _syncFromAttr(val) {
      this._set = new Set(String(val || "").split(/\s+/).filter(Boolean));
    }
    add(...tokens) {
      for (const t of tokens) if (t) this._set.add(t);
    }
    remove(...tokens) {
      for (const t of tokens) this._set.delete(t);
    }
    toggle(token, force) {
      if (force === true) {
        this._set.add(token);
        return true;
      }
      if (force === false) {
        this._set.delete(token);
        return false;
      }
      if (this._set.has(token)) {
        this._set.delete(token);
        return false;
      }
      this._set.add(token);
      return true;
    }
    contains(token) {
      return this._set.has(token);
    }
    toString() {
      return Array.from(this._set).join(" ");
    }
  }

  class FakeTextNode {
    constructor(text) {
      this.nodeType = 3;
      this.textContent = String(text ?? "");
      this.parentNode = null;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
  }

  class FakeElement {
    constructor(tagName) {
      this.nodeType = 1;
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.dataset = {};
      this.style = {
        setProperty: (k, v) => {
          this.style[k] = v;
        },
        removeProperty: (k) => {
          delete this.style[k];
        }
      };
      this.classList = new FakeClassList(this);
      this.listeners = new Map();
      this.value = "";
      this.type = "";
      this.placeholder = "";
      this.title = "";
      this.hidden = false;
      this.disabled = false;
      this.isConnected = true;
      this._textContent = "";
    }

    get id() {
      return this.attributes.id || "";
    }
    set id(v) {
      this.attributes.id = String(v);
    }
    get className() {
      return this.classList.toString();
    }
    set className(v) {
      this.classList._syncFromAttr(v);
    }
    get textContent() {
      if (this.children.length === 0) return this._textContent;
      return this.children.map((c) => c.textContent).join("");
    }
    set textContent(v) {
      this.children = [];
      this._textContent = String(v ?? "");
    }

    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === "class") this.classList._syncFromAttr(v);
    }
    getAttribute(k) {
      return k in this.attributes ? this.attributes[k] : null;
    }
    removeAttribute(k) {
      delete this.attributes[k];
    }

    appendChild(child) {
      if (child.parentNode) child.remove();
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    append(...nodes) {
      for (const n of nodes) {
        if (typeof n === "string") {
          this.appendChild(new FakeTextNode(n));
        } else if (n) {
          this.appendChild(n);
        }
      }
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    removeEventListener(type, fn) {
      const list = this.listeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    }
    dispatchEvent(evt) {
      evt.target = evt.target || this;
      evt.currentTarget = this;
      evt.preventDefault = evt.preventDefault || (() => {});
      evt.stopPropagation = evt.stopPropagation || (() => {});
      const list = this.listeners.get(evt.type) || [];
      for (const fn of [...list]) {
        fn.call(this, evt);
      }
      return true;
    }

    click() {
      this.dispatchEvent({ type: "click" });
    }
    focus() {
      this._document && (this._document.activeElement = this);
    }
    select() {}
    scrollIntoView() {}

    _matchesSelector(sel) {
      if (sel.startsWith(".")) {
        return this.classList.contains(sel.slice(1));
      }
      if (sel.startsWith("#")) {
        return this.id === sel.slice(1);
      }
      return this.tagName.toLowerCase() === sel.toLowerCase();
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (node) => {
        for (const child of node.children || []) {
          if (child.nodeType === 1) {
            if (child._matchesSelector(sel)) out.push(child);
            walk(child);
          }
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
  }

  const document = {
    activeElement: null,
    documentElement: new FakeElement("html"),
    body: new FakeElement("body"),
    createElement(tag) {
      const el = new FakeElement(tag);
      el._document = document;
      return el;
    },
    createElementNS(_ns, tag) {
      const el = new FakeElement(tag);
      el._document = document;
      return el;
    },
    createTextNode(text) {
      return new FakeTextNode(text);
    },
    execCommand(cmd) {
      if (overrides.onExecCommand) return overrides.onExecCommand(cmd, document);
      return true;
    }
  };

  return { document, FakeElement };
}

function mountPalette(overrides = {}) {
  const { document } = createDomShim(overrides);
  const sentMessages = [];
  let closedCount = 0;

  const sampleData = overrides.data || {
    activeTab: { id: 1, windowId: 100, groupId: -1, title: "Active Tab", url: "https://github.com/org/repo", pinned: false, audible: false, muted: false },
    tabs: [
      { id: 2, windowId: 100, groupId: -1, title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", active: false, currentWindow: true, pinned: false, lastAccessed: 2000 },
      { id: 1, windowId: 100, groupId: -1, title: "Active Tab", url: "https://github.com/org/repo", active: true, currentWindow: true, pinned: false, lastAccessed: 1000 }
    ],
    tabGroups: [],
    closedTabs: [],
    quickLinks: [{ bang: "gh", title: "GitHub", url: "https://github.com", searchUrl: "https://github.com/search?q={query}" }],
    chromePages: [{ id: "chrome-settings", title: "Chrome Settings", subtitle: "chrome://settings", url: "chrome://settings" }],
    bookmarks: [],
    history: [],
    frecency: {},
    themes: [],
    themesPermission: false,
    extensions: [],
    downloads: [],
    windows: [{ id: 100, focused: true, incognito: false, tabCount: 2, title: "Active Tab" }]
  };

  const windowObj = {
    screen: { availLeft: 0, availTop: 0, availWidth: 1440, availHeight: 900 },
    innerWidth: 1440,
    innerHeight: 900
  };
  const navigatorObj = overrides.navigator || { platform: "MacIntel", clipboard: { writeText: async () => {} } };

  const chromeObj = {
    runtime: {
      sendMessage: (msg, cb) => {
        sentMessages.push(msg);
        if (overrides.onMessage && overrides.onMessage(msg, cb)) {
          return;
        }
        if (msg.type === "GET_PALETTE_DATA") {
          cb({ ok: true, data: sampleData });
          return;
        }
        if (msg.type === "EXECUTE_ACTION") {
          cb(overrides.onExecuteAction ? overrides.onExecuteAction(msg.payload) : { ok: true, toast: "Done" });
          return;
        }
        if (msg.type === "SEARCH_HISTORY") {
          cb({ ok: true, history: [] });
          return;
        }
        cb({ ok: true });
      }
    }
  };

  const context = vm.createContext({
    window: windowObj,
    document,
    navigator: navigatorObj,
    chrome: chromeObj,
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
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => fn(),
    console
  });

  const coreCode = fs.readFileSync(path.join(__dirname, "..", "palette-core.js"), "utf8");
  const iconsCode = fs.readFileSync(path.join(__dirname, "..", "palette-icons.js"), "utf8");
  const uiCode = fs.readFileSync(path.join(__dirname, "..", "palette-ui.js"), "utf8");
  vm.runInContext(coreCode, context, { filename: "palette-core.js" });
  vm.runInContext(iconsCode, context, { filename: "palette-icons.js" });
  vm.runInContext(uiCode, context, { filename: "palette-ui.js" });

  const container = document.createElement("div");
  document.body.appendChild(container);

  const instance = windowObj.__CueCreatePalette({
    container,
    isPopup: overrides.isPopup ?? true,
    onClose: () => {
      closedCount += 1;
    }
  });

  return {
    document,
    container,
    instance,
    sentMessages,
    getClosedCount: () => closedCount,
    getModal: () => container.querySelector(".qc-modal"),
    getInput: () => container.querySelector(".qc-input"),
    getRows: () => container.querySelectorAll(".qc-item"),
    getSelectedRow: () => container.querySelectorAll(".qc-item").find((r) => r.classList.contains("qc-selected"))
  };
}

const flush = () => new Promise((r) => setTimeout(r, 15));

test("palette-ui mounts, loads data, and renders initial results", async () => {
  const ui = mountPalette();
  await flush();

  const rows = ui.getRows();
  assert.ok(rows.length > 0, "should render initial rows");
  assert.equal(ui.sentMessages[0].type, "GET_PALETTE_DATA");
  assert.equal(rows[0].getAttribute("aria-selected"), "true");
});

test("palette-ui filters results on input and clears on clear button click", async () => {
  const ui = mountPalette();
  await flush();

  const input = ui.getInput();
  input.value = "MDN";
  input.dispatchEvent({ type: "input" });

  const rows = ui.getRows();
  assert.ok(rows.length >= 1);
  assert.match(rows[0].textContent, /MDN Web Docs/);

  const clearBtn = ui.container.querySelector(".qc-clear-btn");
  clearBtn.click();
  assert.equal(input.value, "");
});

test("palette-ui navigates with ArrowDown/ArrowUp and executes selected item on Enter", async () => {
  const ui = mountPalette();
  await flush();

  const modal = ui.getModal();
  const initialSelected = ui.getSelectedRow();
  modal.dispatchEvent({ type: "keydown", key: "ArrowDown" });
  const nextSelected = ui.getSelectedRow();
  assert.notEqual(nextSelected, initialSelected);

  modal.dispatchEvent({ type: "keydown", key: "ArrowUp" });
  assert.equal(ui.getSelectedRow(), initialSelected);

  modal.dispatchEvent({ type: "keydown", key: "Enter" });
  await flush();

  const execMsg = ui.sentMessages.find((m) => m.type === "EXECUTE_ACTION");
  assert.ok(execMsg, "Enter should execute the selected item");
  assert.equal(ui.getClosedCount(), 1, "executing a tab switch should close the palette");
});

test("palette-ui cycles filter chips on Tab", async () => {
  const ui = mountPalette();
  await flush();

  const modal = ui.getModal();
  const chips = ui.container.querySelectorAll(".qc-chip");
  assert.equal(chips[0].classList.contains("qc-chip-active"), true); // All

  modal.dispatchEvent({ type: "keydown", key: "Tab" });
  assert.equal(chips[1].classList.contains("qc-chip-active"), true); // Tabs

  modal.dispatchEvent({ type: "keydown", key: "Tab" });
  assert.equal(chips[2].classList.contains("qc-chip-active"), true); // Groups
});

test("palette-ui toggles actions popover with Cmd+K and closes popover on Escape without closing palette", async () => {
  const ui = mountPalette();
  await flush();

  const modal = ui.getModal();
  const popover = ui.container.querySelector(".qc-actions-popover");
  assert.equal(popover.style.display, "none");

  modal.dispatchEvent({ type: "keydown", key: "k", metaKey: true });
  assert.notEqual(popover.style.display, "none");

  modal.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(popover.style.display, "none");
  assert.equal(ui.getClosedCount(), 0, "Esc should close popover first, not palette");

  modal.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(ui.getClosedCount(), 1, "second Esc should close palette");
});

test("palette-ui ignores Enter while IME is composing", async () => {
  const ui = mountPalette();
  await flush();

  const modal = ui.getModal();
  modal.dispatchEvent({ type: "keydown", key: "Enter", isComposing: true });
  modal.dispatchEvent({ type: "keydown", key: "Enter", keyCode: 229 });
  await flush();

  assert.equal(ui.sentMessages.filter((m) => m.type === "EXECUTE_ACTION").length, 0);
  assert.equal(ui.getClosedCount(), 0);
});

test("palette-ui destroy triggers onClose", async () => {
  const ui = mountPalette();
  await flush();
  assert.equal(ui.getClosedCount(), 0);
  ui.instance.destroy();
  assert.equal(ui.getClosedCount(), 1);
});

test("palette-ui sets referrerPolicy='no-referrer' on favicon <img> elements", async () => {
  const ui = mountPalette({
    data: {
      activeTab: { id: 1, windowId: 100, groupId: -1, title: "Active Tab", url: "https://github.com/org/repo", favIconUrl: "https://github.com/favicon.ico", pinned: false, audible: false, muted: false },
      tabs: [
        { id: 2, windowId: 100, groupId: -1, title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", favIconUrl: "https://developer.mozilla.org/favicon.ico", active: false, currentWindow: true, pinned: false, lastAccessed: 2000 },
        { id: 1, windowId: 100, groupId: -1, title: "Active Tab", url: "https://github.com/org/repo", favIconUrl: "https://github.com/favicon.ico", active: true, currentWindow: true, pinned: false, lastAccessed: 1000 }
      ],
      tabGroups: [],
      closedTabs: [],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [],
      frecency: {},
      themes: [],
      themesPermission: false,
      extensions: [],
      downloads: [],
      windows: [{ id: 100, focused: true, incognito: false, tabCount: 2, title: "Active Tab" }]
    }
  });
  await flush();

  const imgs = ui.container.querySelectorAll("img");
  assert.ok(imgs.length > 0, "expected at least one favicon <img>");
  for (const img of imgs) {
    assert.equal(img.referrerPolicy, "no-referrer");
  }
});

test("palette-ui stops propagation of beforeinput, input, paste, and composition events on backdrop", async () => {
  const ui = mountPalette();
  await flush();

  const backdrop = ui.container.querySelector(".qc-backdrop");
  assert.ok(backdrop, "backdrop should exist");

  for (const type of ["beforeinput", "input", "paste", "copy", "cut", "compositionstart", "compositionupdate", "compositionend"]) {
    let stopped = false;
    backdrop.dispatchEvent({
      type,
      stopPropagation: () => {
        stopped = true;
      }
    });
    assert.equal(stopped, true, `expected ${type} to call stopPropagation() on backdrop`);
  }
});

test("palette-ui copyToClipboard fallback mounts inside backdrop (not document.body) and clears textarea.value before removal", async () => {
  let capturedTextarea = null;
  let bodyHasTextareaDuringExec = false;
  let docElHasTextareaDuringExec = false;
  let focusinStopped = false;
  let copyStopped = false;

  const ui = mountPalette({
    navigator: {
      platform: "MacIntel",
      clipboard: {
        writeText: async () => {
          throw new Error("Clipboard API unavailable");
        }
      }
    },
    onExecCommand: (cmd, doc) => {
      assert.equal(cmd, "copy");
      const backdrop = ui.container.querySelector(".qc-backdrop");
      capturedTextarea = backdrop.querySelector("textarea");
      bodyHasTextareaDuringExec = doc.body.children.some((c) => c.tagName === "TEXTAREA");
      docElHasTextareaDuringExec = doc.documentElement.querySelectorAll("textarea").length > 0;
      if (capturedTextarea) {
        capturedTextarea.dispatchEvent({
          type: "focusin",
          stopPropagation: () => {
            focusinStopped = true;
          }
        });
        capturedTextarea.dispatchEvent({
          type: "copy",
          stopPropagation: () => {
            copyStopped = true;
          }
        });
      }
      return true;
    }
  });
  await flush();

  // Trigger Cmd+C on the selected tab item
  const modal = ui.getModal();
  modal.dispatchEvent({ type: "keydown", key: "c", metaKey: true, preventDefault: () => {} });
  await flush();

  assert.ok(capturedTextarea, "fallback textarea should be mounted inside backdrop");
  assert.equal(bodyHasTextareaDuringExec, false, "textarea must NOT be appended to document.body");
  assert.equal(docElHasTextareaDuringExec, false, "textarea must NOT be appended to document.documentElement");
  assert.equal(focusinStopped, true, "focusin on fallback textarea should stopPropagation");
  assert.equal(copyStopped, true, "copy on fallback textarea should stopPropagation");
  assert.equal(capturedTextarea.value, "", "textarea.value should be cleared before removal");
  assert.equal(capturedTextarea.parentNode, null, "textarea should be removed after copy");
});

test("palette-ui tab popover includes Suspend Tab (Save Memory) for non-active non-discarded tabs and Close Tabs to the Right", async () => {
  const ui = mountPalette({
    data: {
      activeTab: { id: 1, windowId: 100, groupId: -1, title: "Active Tab", url: "https://github.com/org/repo", pinned: false, audible: false, muted: false },
      tabs: [
        { id: 2, windowId: 100, groupId: -1, index: 1, title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", active: false, currentWindow: true, pinned: false, discarded: false, lastAccessed: 2000 },
        { id: 3, windowId: 100, groupId: -1, index: 2, title: "Discarded Tab", url: "https://example.com/", active: false, currentWindow: true, pinned: false, discarded: true, lastAccessed: 1500 },
        { id: 1, windowId: 100, groupId: -1, index: 0, title: "Active Tab", url: "https://github.com/org/repo", active: true, currentWindow: true, pinned: false, discarded: false, lastAccessed: 1000 }
      ],
      tabGroups: [],
      closedTabs: [],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [],
      frecency: {},
      themes: [],
      themesPermission: false,
      extensions: [],
      downloads: [],
      windows: [{ id: 100, focused: true, incognito: false, tabCount: 3, title: "Active Tab" }]
    }
  });
  await flush();

  const modal = ui.getModal();
  const popoverList = ui.container.querySelector(".qc-popover-list");

  // Selected row 0 is tab id 2 (non-active, non-discarded)
  modal.dispatchEvent({ type: "keydown", key: "k", metaKey: true });
  let popoverItems = popoverList.querySelectorAll(".qc-item");
  const suspendRow = popoverItems.find((el) => el.textContent.includes("Suspend Tab (Save Memory)"));
  const closeRightRow = popoverItems.find((el) => el.textContent.includes("Close Tabs to the Right"));
  assert.ok(suspendRow, "should show Suspend Tab (Save Memory) for non-active non-discarded tab");
  assert.ok(closeRightRow, "should show Close Tabs to the Right for tab");

  suspendRow.click();
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(ui.sentMessages.find((m) => m.type === "EXECUTE_ACTION" && m.payload.action === "DISCARD_TAB")?.payload)),
    { action: "DISCARD_TAB", tabId: 2 }
  );

  // Reopen palette to test Close Tabs to the Right on tab id 3 (discarded -> should omit Suspend Tab)
  const ui2 = mountPalette({
    data: {
      activeTab: { id: 1, windowId: 100, groupId: -1, title: "Active Tab", url: "https://github.com/org/repo", pinned: false, audible: false, muted: false },
      tabs: [
        { id: 3, windowId: 100, groupId: -1, index: 1, title: "Discarded Tab", url: "https://example.com/", active: false, currentWindow: true, pinned: false, discarded: true, lastAccessed: 2000 },
        { id: 1, windowId: 100, groupId: -1, index: 0, title: "Active Tab", url: "https://github.com/org/repo", active: true, currentWindow: true, pinned: false, discarded: false, lastAccessed: 1000 }
      ],
      tabGroups: [],
      closedTabs: [],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [],
      frecency: {},
      themes: [],
      themesPermission: false,
      extensions: [],
      downloads: [],
      windows: [{ id: 100, focused: true, incognito: false, tabCount: 2, title: "Active Tab" }]
    }
  });
  await flush();

  ui2.getModal().dispatchEvent({ type: "keydown", key: "k", metaKey: true });
  popoverItems = ui2.container.querySelector(".qc-popover-list").querySelectorAll(".qc-item");
  assert.equal(
    popoverItems.some((el) => el.textContent.includes("Suspend Tab (Save Memory)")),
    false,
    "should omit Suspend Tab (Save Memory) for already-discarded tab"
  );
  const closeRightRow2 = popoverItems.find((el) => el.textContent.includes("Close Tabs to the Right"));
  assert.ok(closeRightRow2);
  closeRightRow2.click();
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(ui2.sentMessages.find((m) => m.type === "EXECUTE_ACTION" && m.payload.action === "CLOSE_TABS_TO_RIGHT")?.payload)),
    { action: "CLOSE_TABS_TO_RIGHT", tabId: 3 }
  );
});

test("palette-ui group popover includes Copy Group Tabs as Markdown and Save Group to Bookmarks", async () => {
  const copiedTexts = [];
  const ui = mountPalette({
    navigator: {
      platform: "MacIntel",
      clipboard: {
        writeText: async (text) => {
          copiedTexts.push(text);
        }
      }
    },
    data: {
      activeTab: { id: 1, windowId: 100, groupId: 10, title: "Active Tab", url: "https://github.com/org/repo", pinned: false, audible: false, muted: false },
      tabs: [
        { id: 2, windowId: 100, groupId: 10, title: "GitHub Issues", url: "https://github.com/org/repo/issues", active: false, currentWindow: true, pinned: false, lastAccessed: 2000 },
        { id: 1, windowId: 100, groupId: 10, title: "Active Tab", url: "https://github.com/org/repo", active: true, currentWindow: true, pinned: false, lastAccessed: 1000 }
      ],
      tabGroups: [
        { id: 10, title: "Work", color: "blue", collapsed: false, windowId: 100, currentWindow: true, tabCount: 2 }
      ],
      closedTabs: [],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [],
      frecency: {},
      themes: [],
      themesPermission: false,
      extensions: [],
      downloads: [],
      windows: [{ id: 100, focused: true, incognito: false, tabCount: 2, title: "Active Tab" }]
    }
  });
  await flush();

  // Switch to Groups chip via Tab twice (All -> Tabs -> Groups)
  const modal = ui.getModal();
  modal.dispatchEvent({ type: "keydown", key: "Tab" });
  modal.dispatchEvent({ type: "keydown", key: "Tab" });

  modal.dispatchEvent({ type: "keydown", key: "k", metaKey: true });
  let popoverItems = ui.container.querySelector(".qc-popover-list").querySelectorAll(".qc-item");
  const copyMdRow = popoverItems.find((el) => el.textContent.includes("Copy Group Tabs as Markdown"));
  const bookmarkGroupRow = popoverItems.find((el) => el.textContent.includes("Save Group to Bookmarks"));
  assert.ok(copyMdRow, "should show Copy Group Tabs as Markdown for group");
  assert.ok(bookmarkGroupRow, "should show Save Group to Bookmarks for group");

  copyMdRow.click();
  await flush();
  assert.equal(
    copiedTexts[0],
    "- [GitHub Issues](https://github.com/org/repo/issues)\n- [Active Tab](https://github.com/org/repo)"
  );

  // Reopen popover and click Save Group to Bookmarks
  modal.dispatchEvent({ type: "keydown", key: "k", metaKey: true });
  popoverItems = ui.container.querySelector(".qc-popover-list").querySelectorAll(".qc-item");
  const bookmarkGroupRow2 = popoverItems.find((el) => el.textContent.includes("Save Group to Bookmarks"));
  bookmarkGroupRow2.click();
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(ui.sentMessages.find((m) => m.type === "EXECUTE_ACTION" && m.payload.action === "BOOKMARK_TAB_GROUP")?.payload)),
    { action: "BOOKMARK_TAB_GROUP", groupId: 10 }
  );
});

test("palette-ui applies qc-is-sidebar class from data and toggles it live without closing", async () => {
  const data = {
    activeTab: null,
    tabs: [],
    tabGroups: [],
    closedTabs: [],
    quickLinks: [],
    chromePages: [],
    bookmarks: [],
    history: [],
    frecency: {},
    themes: [],
    themesPermission: false,
    extensions: [],
    downloads: [],
    windows: [],
    verticalSidebar: false
  };
  const ui = mountPalette({
    isPopup: false,
    data,
    onExecuteAction: (payload) => {
      if (payload?.action === "TOGGLE_VERTICAL_SIDEBAR") {
        data.verticalSidebar = !data.verticalSidebar;
        return {
          ok: true,
          verticalSidebar: data.verticalSidebar,
          toast: data.verticalSidebar ? "Switched to vertical sidebar" : "Switched to centered palette"
        };
      }
      return { ok: true };
    }
  });
  await flush();

  const backdrop = ui.container.querySelector(".qc-backdrop");
  assert.equal(backdrop.classList.contains("qc-is-sidebar"), false);

  const input = ui.getInput();
  input.value = "> sidebar";
  input.dispatchEvent({ type: "input" });
  await flush();

  ui.getModal().dispatchEvent({ type: "keydown", key: "Enter" });
  await flush();

  const toggleCall = ui.sentMessages.find((m) => m.type === "EXECUTE_ACTION");
  assert.ok(toggleCall, `Expected EXECUTE_ACTION, got: ${JSON.stringify(ui.sentMessages)}`);
  assert.deepEqual(JSON.parse(JSON.stringify(toggleCall.payload)), { action: "TOGGLE_VERTICAL_SIDEBAR" });
  assert.equal(backdrop.classList.contains("qc-is-sidebar"), true);
  assert.equal(ui.getClosedCount(), 0, "toggling sidebar should keep palette open");

  // Toggle back to centered
  ui.getModal().dispatchEvent({ type: "keydown", key: "Enter" });
  await flush();
  assert.equal(backdrop.classList.contains("qc-is-sidebar"), false);
  assert.equal(ui.getClosedCount(), 0);
});

test("palette-ui supports inline unload/archive tab buttons, /a archived tab popover, and footer GitHub/Issues quick links", async () => {
  const ui = mountPalette({
    data: {
      activeTab: { id: 1, windowId: 100, groupId: 10, title: "Active Tab", url: "https://github.com/org/repo", pinned: false, audible: false, muted: false },
      tabs: [
        { id: 2, windowId: 100, groupId: 10, title: "MDN Docs", url: "https://developer.mozilla.org/", active: false, currentWindow: true, pinned: false, discarded: false, lastAccessed: 2000 },
        { id: 1, windowId: 100, groupId: 10, title: "Active Tab", url: "https://github.com/org/repo", active: true, currentWindow: true, pinned: false, discarded: false, lastAccessed: 1000 }
      ],
      tabGroups: [
        { id: 10, title: "Work", color: "blue", collapsed: false, windowId: 100, currentWindow: true, tabCount: 2 }
      ],
      closedTabs: [],
      archivedTabs: [
        { id: "arch-42", title: "Saved Spec", url: "https://spec.example.com", archivedAt: Date.now() - 60000 }
      ],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [],
      frecency: {},
      themes: [],
      themesPermission: false,
      extensions: [],
      downloads: [],
      windows: [{ id: 100, focused: true, incognito: false, tabCount: 2, title: "Active Tab" }]
    }
  });
  await flush();

  // First row is tab 2 -> has inline unload & archive buttons
  const firstRow = ui.getRows()[0];
  const unloadBtn = firstRow.querySelectorAll(".qc-tab-btn").find((b) => b.getAttribute("aria-label") === "Unload tab");
  const archiveBtn = firstRow.querySelectorAll(".qc-tab-btn").find((b) => b.getAttribute("aria-label") === "Archive tab");
  assert.ok(unloadBtn, "background tab row should have inline Unload button");
  assert.ok(archiveBtn, "http tab row should have inline Archive button");

  unloadBtn.click();
  await flush();
  assert.ok(
    ui.sentMessages.some((m) => m.type === "EXECUTE_ACTION" && m.payload.action === "DISCARD_TAB" && m.payload.tabId === 2)
  );

  archiveBtn.click();
  await flush();
  assert.ok(
    ui.sentMessages.some((m) => m.type === "EXECUTE_ACTION" && m.payload.action === "ARCHIVE_TAB" && m.payload.tabId === 2)
  );

  // Switch to /a archived tabs mode and inspect popover
  const input = ui.getInput();
  input.value = "/a";
  input.dispatchEvent({ type: "input" });
  await flush();

  const archivedRows = ui.getRows();
  assert.equal(archivedRows.length, 1);
  assert.match(archivedRows[0].textContent, /Saved Spec/);

  ui.getModal().dispatchEvent({ type: "keydown", key: "k", metaKey: true });
  const popItems = ui.container.querySelector(".qc-popover-list").querySelectorAll(".qc-item");
  assert.ok(popItems.some((el) => el.textContent.includes("Restore Tab (Unarchive)")));
  assert.ok(popItems.some((el) => el.textContent.includes("Open Copy (Keep in Archive)")));
  assert.ok(popItems.some((el) => el.textContent.includes("Remove from Archive")));
  ui.getModal().dispatchEvent({ type: "keydown", key: "Escape" });

  // Footer GitHub & Issues quick-link buttons
  const footerBtns = ui.container.querySelectorAll(".qc-footer-icon-btn");
  assert.equal(footerBtns.length, 2, "footer should include GitHub repo and Issues quick-link buttons");
  footerBtns[1].click();
  await flush();
  assert.ok(
    ui.sentMessages.some(
      (m) =>
        m.type === "EXECUTE_ACTION" &&
        m.payload.action === "OPEN_URL" &&
        m.payload.url === "https://github.com/rayjosong/cue-chrome-palette/issues"
    )
  );
});

test("palette-ui merges SEARCH_HISTORY with recent history and selects newly arrived matches over fallback-google", async () => {
  let historyCalls = 0;
  const ui = mountPalette({
    data: {
      activeTab: { id: 1, windowId: 100, groupId: -1, title: "Home", url: "https://example.com", active: true, currentWindow: true },
      tabs: [{ id: 1, windowId: 100, groupId: -1, title: "Home", url: "https://example.com", active: true, currentWindow: true }],
      tabGroups: [],
      closedTabs: [],
      quickLinks: [],
      chromePages: [],
      bookmarks: [],
      history: [{ id: "h-recent", title: "GitHub Pull Requests", url: "https://github.com/org/repo/pulls", visitCount: 5 }],
      frecency: {},
      themes: [],
      themesPermission: false,
      extensions: [],
      downloads: [],
      windows: [{ id: 100, focused: true, incognito: false, tabCount: 1, title: "Home" }]
    },
    onMessage(msg, cb) {
      if (msg.type === "SEARCH_HISTORY") {
        historyCalls++;
        if (msg.query === "gh pr") {
          cb({ ok: true, history: [] });
          return true;
        }
        if (msg.query === "deephistory") {
          cb({
            ok: true,
            history: [{ id: "h-deep", title: "DeepHistory Reference", url: "https://deephistory.dev", visitCount: 3 }]
          });
          return true;
        }
      }
      return false;
    }
  });
  await flush();

  // Fuzzy query "gh pr" matches recent history even when chrome.history.search returns []
  const input = ui.getInput();
  input.value = "gh pr";
  input.dispatchEvent({ type: "input" });
  await new Promise((r) => setTimeout(r, 150));

  let rows = ui.getRows();
  assert.ok(rows.some((r) => r.textContent.includes("GitHub Pull Requests")), "recent history should stay available when SEARCH_HISTORY returns []");

  // Query with no immediate match (only fallback-google) should select newly arrived history match
  input.value = "deephistory";
  input.dispatchEvent({ type: "input" });
  await new Promise((r) => setTimeout(r, 150));

  rows = ui.getRows();
  assert.ok(rows[0].textContent.includes("DeepHistory Reference"), "deep history result should appear first");
  assert.equal(rows[0].getAttribute("aria-selected"), "true", "newly arrived top history result should be selected instead of fallback-google");
  assert.ok(historyCalls >= 2);
});

