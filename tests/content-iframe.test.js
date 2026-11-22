const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");

function createFakeMessageChannelClass() {
  return class FakeMessageChannel {
    constructor() {
      const makePort = () => ({
        onmessage: null,
        closed: false,
        _peer: null,
        postMessage(data) {
          if (this.closed || !this._peer || this._peer.closed) return;
          if (typeof this._peer.onmessage === "function") {
            this._peer.onmessage({ data });
          }
        },
        close() {
          this.closed = true;
        }
      });
      this.port1 = makePort();
      this.port2 = makePort();
      this.port1._peer = this.port2;
      this.port2._peer = this.port1;
    }
  };
}

function createContentHarness() {
  const shadowRoots = new WeakMap();
  const windowListeners = new Map();
  const runtimeListeners = [];
  const initPosts = [];

  class FakeClassList {
    constructor() {
      this._set = new Set();
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
  }

  class FakeElement {
    constructor(tagName) {
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.style = { cssText: "" };
      this.classList = new FakeClassList();
      this.listeners = new Map();
      this.textContent = "";
      this.isConnected = true;
      this.focusedCount = 0;
      this.offsetHeight = 0;
      if (this.tagName === "IFRAME") {
        this.contentWindow = {
          postMessage: (msg, targetOrigin, transfer) => {
            initPosts.push({ msg, targetOrigin, transfer });
          }
        };
      }
    }
    get className() {
      return Array.from(this.classList._set).join(" ");
    }
    set className(v) {
      this.classList._set = new Set(String(v || "").split(/\s+/).filter(Boolean));
    }
    get firstElementChild() {
      return this.children[0] || null;
    }
    get lastElementChild() {
      return this.children[this.children.length - 1] || null;
    }
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    }
    getAttribute(k) {
      return k in this.attributes ? this.attributes[k] : null;
    }
    addEventListener(type, fn, opts) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ fn, once: Boolean(opts && opts.once) });
    }
    dispatchEvent(evt) {
      const list = this.listeners.get(evt.type) || [];
      for (const entry of [...list]) {
        entry.fn.call(this, evt);
        if (entry.once) {
          const idx = list.indexOf(entry);
          if (idx !== -1) list.splice(idx, 1);
        }
      }
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    append(...nodes) {
      for (const n of nodes) this.appendChild(n);
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
      this.isConnected = false;
    }
    attachShadow(opts) {
      assert.equal(opts.mode, "closed");
      const root = new FakeElement("SHADOW-ROOT");
      shadowRoots.set(this, root);
      return root;
    }
    focus() {
      this.focusedCount += 1;
      document.activeElement = this;
    }
    blur() {
      this.blurredCount = (this.blurredCount || 0) + 1;
      if (document.activeElement === this) {
        document.activeElement = null;
      }
    }
  }

  const prevInput = new FakeElement("INPUT");
  const document = {
    activeElement: prevInput,
    documentElement: new FakeElement("HTML"),
    createElement: (tag) => new FakeElement(tag)
  };

  const windowObj = {
    focusCount: 0,
    focus: () => {
      windowObj.focusCount += 1;
    },
    addEventListener: (type, fn) => {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      const list = windowListeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    }
  };

  const chromeObj = {
    runtime: {
      getURL: (p) => `chrome-extension://test-ext-id/${p}`,
      onMessage: {
        addListener: (fn) => runtimeListeners.push(fn)
      }
    }
  };

  class ExtensionURL extends URL {
    get origin() {
      if (this.protocol === "chrome-extension:") {
        return `${this.protocol}//${this.host}`;
      }
      return super.origin;
    }
  }

  const context = vm.createContext({
    window: windowObj,
    document,
    navigator: { platform: "MacIntel" },
    chrome: chromeObj,
    crypto,
    URL: ExtensionURL,
    MessageChannel: createFakeMessageChannelClass(),
    encodeURIComponent,
    setTimeout: () => 1,
    clearTimeout: () => {},
    console
  });

  const code = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
  vm.runInContext(code, context, { filename: "content.js" });

  function sendRuntimeMessage(msg) {
    let response;
    for (const fn of runtimeListeners) {
      fn(msg, {}, (res) => {
        response = res;
      });
    }
    return response;
  }

  function getHostEl() {
    return document.documentElement.children.find((c) => c.id === "cue-shadow-host") || null;
  }

  function getIframeEl() {
    const host = getHostEl();
    if (!host) return null;
    const shadow = shadowRoots.get(host);
    return shadow ? shadow.children.find((c) => c.tagName === "IFRAME") || null : null;
  }

  function getToastHostEl() {
    return document.documentElement.children.find((c) => c.id === "cue-toast-host") || null;
  }

  return {
    windowObj,
    windowListeners,
    document,
    prevInput,
    shadowRoots,
    initPosts,
    sendRuntimeMessage,
    getHostEl,
    getIframeEl,
    getToastHostEl
  };
}

test("manifest.json exposes only palette-frame.html with use_dynamic_url: true", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.content_scripts[0].js, ["content.js"]);
  assert.equal(manifest.web_accessible_resources.length, 1);
  assert.deepEqual(manifest.web_accessible_resources[0].resources, ["palette-frame.html"]);
  assert.equal(manifest.web_accessible_resources[0].use_dynamic_url, true);
});

test("content.js mounts isolated iframe in closed shadow DOM and communicates via transferred MessageChannel port", () => {
  const h = createContentHarness();
  assert.equal(h.windowObj.__CueCreatePalette, undefined, "content.js must not mount palette-ui.js in host page");
  assert.equal(h.windowListeners.has("message"), false, "content.js should not listen on host window message");

  const openRes = h.sendRuntimeMessage({ type: "TOGGLE_PALETTE" });
  assert.equal(openRes.ok, true);

  const host = h.getHostEl();
  assert.ok(host, "#cue-shadow-host should be mounted");
  const iframe = h.getIframeEl();
  assert.ok(iframe, "iframe should be mounted inside closed shadow root");
  assert.equal(iframe.getAttribute("allow"), "clipboard-write");
  assert.ok(iframe.src.startsWith("chrome-extension://test-ext-id/palette-frame.html#nonce="));

  const nonce = decodeURIComponent(iframe.src.split("#nonce=")[1]);
  assert.ok(nonce.length >= 16);

  // Trigger iframe load -> transfers MessagePort2 via postMessage with extensionOrigin
  iframe.dispatchEvent({ type: "load" });
  assert.equal(h.initPosts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.initPosts[0].msg)), {
    type: "CUE_FRAME_INIT",
    nonce
  });
  assert.equal(h.initPosts[0].targetOrigin, "chrome-extension://test-ext-id");
  assert.equal(h.initPosts[0].transfer.length, 1);

  const framePort = h.initPosts[0].transfer[0];
  const hostPort = framePort._peer;
  const receivedByFrame = [];
  framePort.onmessage = (e) => receivedByFrame.push(e.data);

  // CUE_FRAME_READY over MessageChannel focuses iframe and notifies frame to focus input
  framePort.postMessage({ type: "CUE_FRAME_READY" });
  assert.equal(iframe.focusedCount, 1);
  assert.equal(receivedByFrame.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(receivedByFrame[0])), {
    type: "CUE_FRAME_FOCUS"
  });

  // CUE_FRAME_TOAST over MessageChannel renders floating toast in closed shadow DOM
  framePort.postMessage({ type: "CUE_FRAME_TOAST", toast: "Copied URL", isError: false });
  const toastHost = h.getToastHostEl();
  assert.ok(toastHost, "#cue-toast-host should be mounted");
  const toastShadow = h.shadowRoots.get(toastHost);
  const pill = toastShadow.children.find((c) => c.classList.contains("qc-toast-floating"));
  assert.ok(pill);
  assert.equal(pill.lastElementChild.textContent, "Copied URL");

  // Second TOGGLE_PALETTE sends CUE_FRAME_TOGGLE_CLOSE over MessageChannel port
  const toggleRes = h.sendRuntimeMessage({ type: "TOGGLE_PALETTE" });
  assert.equal(toggleRes.ok, true);
  assert.equal(receivedByFrame.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(receivedByFrame[1])), {
    type: "CUE_FRAME_TOGGLE_CLOSE"
  });

  // CUE_FRAME_CLOSE over MessageChannel removes host, closes port, and restores focus
  framePort.postMessage({ type: "CUE_FRAME_CLOSE" });
  assert.equal(h.getHostEl(), null, "#cue-shadow-host should be removed");
  assert.equal(hostPort.closed, true, "content.js should close its MessagePort on closePalette");
  assert.equal(h.prevInput.focusedCount, 1, "previousActiveElement should be refocused");
});

test("palette-frame.js mounts __CueCreatePalette, accepts CUE_FRAME_INIT port, and communicates strictly over MessageChannel", () => {
  const parentPostCalls = [];
  const windowListeners = new Map();
  let capturedOpts = null;
  let destroyCount = 0;
  let focusCount = 0;

  const parentWin = {
    postMessage: (msg, targetOrigin) => {
      parentPostCalls.push({ msg, targetOrigin });
    }
  };

  const windowObj = {
    location: { hash: "#nonce=abc-123-nonce" },
    parent: parentWin,
    addEventListener: (type, fn) => {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(fn);
    },
    __CueCreatePalette: (opts) => {
      capturedOpts = opts;
      return {
        focus: () => {
          focusCount += 1;
        },
        destroy: () => {
          destroyCount += 1;
          opts.onClose();
        }
      };
    }
  };

  const mountEl = { id: "palette-mount" };
  const documentObj = {
    getElementById: (id) => (id === "palette-mount" ? mountEl : null)
  };

  const context = vm.createContext({
    window: windowObj,
    document: documentObj,
    navigator: { platform: "MacIntel" },
    URLSearchParams,
    console
  });

  const frameCode = fs.readFileSync(path.join(ROOT, "palette-frame.js"), "utf8");
  vm.runInContext(frameCode, context, { filename: "palette-frame.js" });

  assert.ok(capturedOpts, "__CueCreatePalette should be called");
  assert.equal(capturedOpts.container, mountEl);
  assert.equal(capturedOpts.isPopup, false);
  assert.equal(parentPostCalls.length, 0, "palette-frame.js must never call window.parent.postMessage");

  const FakeMC = createFakeMessageChannelClass();
  const ch = new FakeMC();
  const receivedFromFrame = [];
  ch.port1.onmessage = (e) => receivedFromFrame.push(e.data);

  // Spoofed CUE_FRAME_INIT (wrong source, wrong nonce, or missing port) -> ignored
  for (const fn of windowListeners.get("message") || []) {
    fn({ source: windowObj, data: { type: "CUE_FRAME_INIT", nonce: "abc-123-nonce" }, ports: [ch.port2] });
    fn({ source: parentWin, data: { type: "CUE_FRAME_INIT", nonce: "wrong-nonce" }, ports: [ch.port2] });
    fn({ source: parentWin, data: { type: "CUE_FRAME_INIT", nonce: "abc-123-nonce" }, ports: [] });
  }
  assert.equal(focusCount, 0);
  assert.equal(receivedFromFrame.length, 0);

  // Valid CUE_FRAME_INIT -> attaches port, posts CUE_FRAME_READY, focuses palette
  for (const fn of windowListeners.get("message") || []) {
    fn({ source: parentWin, data: { type: "CUE_FRAME_INIT", nonce: "abc-123-nonce" }, ports: [ch.port2] });
  }
  assert.equal(focusCount, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(receivedFromFrame[0])), {
    type: "CUE_FRAME_READY"
  });

  // onToast posts CUE_FRAME_TOAST over MessagePort
  capturedOpts.onToast("Hello", true);
  assert.deepEqual(JSON.parse(JSON.stringify(receivedFromFrame[1])), {
    type: "CUE_FRAME_TOAST",
    toast: "Hello",
    isError: true
  });

  // CUE_FRAME_FOCUS over MessagePort focuses palette
  ch.port1.postMessage({ type: "CUE_FRAME_FOCUS" });
  assert.equal(focusCount, 2);

  // Window focus event focuses palette when activeElement is empty/body
  for (const fn of windowListeners.get("focus") || []) {
    fn({});
  }
  assert.equal(focusCount, 3);

  // CUE_FRAME_TOGGLE_CLOSE over MessagePort destroys palette & posts CUE_FRAME_CLOSE
  ch.port1.postMessage({ type: "CUE_FRAME_TOGGLE_CLOSE" });
  assert.equal(destroyCount, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(receivedFromFrame[2])), {
    type: "CUE_FRAME_CLOSE"
  });
  assert.equal(parentPostCalls.length, 0, "palette-frame.js must never call window.parent.postMessage");
});

test("content.js blocks host-page arrow keys and reclaims focus while palette is open, then detaches on close", () => {
  const h = createContentHarness();
  h.sendRuntimeMessage({ type: "TOGGLE_PALETTE" });
  assert.equal(h.prevInput.blurredCount, 1, "previousActiveElement should be blurred when opening palette");

  const iframe = h.getIframeEl();
  iframe.dispatchEvent({ type: "load" });
  const framePort = h.initPosts[0].transfer[0];
  framePort.postMessage({ type: "CUE_FRAME_READY" });
  const focusBefore = iframe.focusedCount;

  // ArrowDown hitting host window while palette is open is blocked and refocuses iframe
  let prevented = false;
  let stoppedImmediate = false;
  for (const fn of [...(h.windowListeners.get("keydown") || [])]) {
    fn({
      type: "keydown",
      key: "ArrowDown",
      isTrusted: true,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {
        prevented = true;
      },
      stopImmediatePropagation: () => {
        stoppedImmediate = true;
      }
    });
  }
  assert.equal(prevented, true, "ArrowDown on host window must be prevented while palette is open");
  assert.equal(stoppedImmediate, true, "ArrowDown on host window must stopImmediatePropagation while palette is open");
  assert.equal(iframe.focusedCount, focusBefore + 1, "ArrowDown on host window should refocus iframe");

  // Close palette -> host guards are detached and ArrowDown is no longer blocked
  framePort.postMessage({ type: "CUE_FRAME_CLOSE" });
  let preventedAfterClose = false;
  let stoppedAfterClose = false;
  for (const fn of [...(h.windowListeners.get("keydown") || [])]) {
    fn({
      type: "keydown",
      key: "ArrowDown",
      isTrusted: true,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {
        preventedAfterClose = true;
      },
      stopImmediatePropagation: () => {
        stoppedAfterClose = true;
      }
    });
  }
  assert.equal(preventedAfterClose, false, "ArrowDown must not be prevented after palette closes");
  assert.equal(stoppedAfterClose, false, "ArrowDown must not be stopped after palette closes");
});

test("iframe element and palette-frame.html share matching color-scheme: light dark for transparency", () => {
  const h = createContentHarness();
  h.sendRuntimeMessage({ type: "TOGGLE_PALETTE" });

  const iframe = h.getIframeEl();
  assert.ok(iframe, "iframe should be mounted");
  assert.match(iframe.style.cssText, /background:\s*transparent/i);
  assert.match(iframe.style.cssText, /color-scheme:\s*light dark/i);

  const frameHtml = fs.readFileSync(path.join(ROOT, "palette-frame.html"), "utf8");
  assert.match(frameHtml, /<meta\s+name="color-scheme"\s+content="light dark"\s*\/?>/i);
  assert.match(frameHtml, /color-scheme:\s*light dark/i);
});
