(() => {
  if (window.__CueContentLoaded) return;
  window.__CueContentLoaded = true;

  const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;

  let hostEl = null;
  let iframeEl = null;
  let messagePort = null;
  let isClosing = false;
  let closeFallbackTimer = null;
  let previousActiveElement = null;
  let toastHostEl = null;
  let toastPillEl = null;
  let toastHideTimer = null;
  let toastRemoveTimer = null;

  function generateNonce() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function showFloatingToast(msg, isError = false) {
    if (!msg) return;
    clearTimeout(toastHideTimer);
    clearTimeout(toastRemoveTimer);

    if (!toastHostEl) {
      toastHostEl = document.createElement("div");
      toastHostEl.id = "cue-toast-host";
      toastHostEl.style.cssText =
        "all: initial; position: fixed; left: 0; bottom: 0; width: 100%; height: 0; overflow: visible; z-index: 2147483647; pointer-events: none; display: block;";
      const shadow = toastHostEl.attachShadow({ mode: "closed" });

      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial; }
        .qc-toast-floating {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translate(-50%, 10px);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #131317;
          color: #f4f4f7;
          border: 1px solid rgba(129, 140, 248, 0.38);
          box-shadow: 0 18px 42px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 0, 0, 0.35);
          padding: 8px 16px;
          border-radius: 999px;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          line-height: 1.3;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.16s ease, transform 0.16s ease;
          z-index: 2147483647;
          white-space: nowrap;
          max-width: min(90vw, 460px);
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .qc-toast-floating.qc-toast-visible {
          opacity: 1;
          transform: translate(-50%, 0);
        }
        .qc-toast-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: rgba(99, 102, 241, 0.22);
          color: #818cf8;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .qc-toast-floating.qc-toast-error .qc-toast-icon {
          background: rgba(248, 113, 113, 0.16);
          color: #f87171;
        }
        @media (prefers-color-scheme: light) {
          .qc-toast-floating {
            background: #ffffff;
            color: #111827;
            border-color: rgba(79, 70, 229, 0.32);
            box-shadow: 0 14px 36px -8px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08);
          }
          .qc-toast-icon {
            background: rgba(79, 70, 229, 0.12);
            color: #4f46e5;
          }
        }
      `;
      shadow.appendChild(style);

      toastPillEl = document.createElement("div");
      toastPillEl.className = "qc-toast-floating";
      toastPillEl.setAttribute("role", "status");
      toastPillEl.setAttribute("aria-live", "polite");

      const icon = document.createElement("span");
      icon.className = "qc-toast-icon";
      const text = document.createElement("span");
      toastPillEl.append(icon, text);
      shadow.appendChild(toastPillEl);

      document.documentElement.appendChild(toastHostEl);
    }

    const iconEl = toastPillEl.firstElementChild;
    const textEl = toastPillEl.lastElementChild;
    if (iconEl) iconEl.textContent = isError ? "!" : "✓";
    if (textEl) textEl.textContent = msg;
    toastPillEl.classList.toggle("qc-toast-error", Boolean(isError));

    void toastPillEl.offsetHeight;
    toastPillEl.classList.add("qc-toast-visible");

    toastHideTimer = setTimeout(() => {
      if (toastPillEl) toastPillEl.classList.remove("qc-toast-visible");
      toastRemoveTimer = setTimeout(() => {
        if (toastHostEl) {
          toastHostEl.remove();
          toastHostEl = null;
          toastPillEl = null;
        }
      }, 200);
    }, 2400);
  }

  function closePalette() {
    clearTimeout(closeFallbackTimer);
    closeFallbackTimer = null;
    isClosing = false;
    if (messagePort) {
      try {
        messagePort.onmessage = null;
        messagePort.close();
      } catch (_) {}
      messagePort = null;
    }
    iframeEl = null;
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
    if (previousActiveElement && previousActiveElement.isConnected && typeof previousActiveElement.focus === "function") {
      try {
        previousActiveElement.focus();
      } catch (_) {}
    }
    previousActiveElement = null;
  }

  function openPalette() {
    if (hostEl) {
      if (isClosing) {
        closePalette();
      } else {
        isClosing = true;
        if (messagePort) {
          messagePort.postMessage({ type: "CUE_FRAME_TOGGLE_CLOSE" });
          clearTimeout(closeFallbackTimer);
          closeFallbackTimer = setTimeout(closePalette, 250);
        } else {
          closePalette();
        }
      }
      return;
    }

    previousActiveElement = document.activeElement;
    isClosing = false;
    const nonce = generateNonce();

    hostEl = document.createElement("div");
    hostEl.id = "cue-shadow-host";
    hostEl.style.cssText =
      "all: initial; position: fixed; inset: 0; width: 0; height: 0; z-index: 2147483647; display: block;";
    const shadow = hostEl.attachShadow({ mode: "closed" });

    const currentIframe = document.createElement("iframe");
    iframeEl = currentIframe;
    currentIframe.setAttribute("allow", "clipboard-write");
    currentIframe.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;border:0;background:transparent;z-index:2147483647;color-scheme:normal;";

    const channel = new MessageChannel();
    const currentPort = channel.port1;
    messagePort = currentPort;

    currentPort.onmessage = (event) => {
      if (messagePort !== currentPort) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CUE_FRAME_READY") {
        try {
          currentIframe.focus();
        } catch (_) {}
      } else if (data.type === "CUE_FRAME_CLOSE") {
        closePalette();
      } else if (data.type === "CUE_FRAME_TOAST") {
        showFloatingToast(data.toast, Boolean(data.isError));
      }
    };

    currentIframe.addEventListener(
      "load",
      () => {
        if (iframeEl !== currentIframe || !currentIframe.contentWindow) return;
        currentIframe.contentWindow.postMessage({ type: "CUE_FRAME_INIT", nonce }, extensionOrigin, [channel.port2]);
      },
      { once: true }
    );

    currentIframe.src = chrome.runtime.getURL("palette-frame.html") + "#nonce=" + encodeURIComponent(nonce);
    shadow.appendChild(currentIframe);

    document.documentElement.appendChild(hostEl);
  }

  // Fallback in-page shortcut listener (⌘⇧K on Mac, Ctrl+Shift+K on Windows/Linux)
  // Works even if chrome://extensions/shortcuts has a unbound/conflicting command
  window.addEventListener(
    "keydown",
    (e) => {
      if (!e.isTrusted) return;
      const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
      const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        openPalette();
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "TOGGLE_PALETTE") {
      try {
        openPalette();
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || "Failed to open palette" });
      }
    } else if (message.type === "SHOW_TOAST") {
      showFloatingToast(message.toast, Boolean(message.isError));
      sendResponse({ ok: true });
    }
    return false;
  });
})();

