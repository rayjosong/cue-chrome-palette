(() => {
  if (window.__CueContentLoaded && typeof window.__CueCreatePalette === "function") return;
  window.__CueContentLoaded = true;

  let hostEl = null;
  let paletteInstance = null;
  let isClosing = false;
  let previousActiveElement = null;

  function closePalette() {
    isClosing = false;
    if (paletteInstance) {
      const inst = paletteInstance;
      paletteInstance = null;
      inst.destroy();
    }
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
        if (paletteInstance) {
          paletteInstance.destroy();
        } else {
          closePalette();
        }
        return;
      }
    }

    if (typeof window.__CueCreatePalette !== "function") {
      return;
    }

    previousActiveElement = document.activeElement;
    isClosing = false;
    hostEl = document.createElement("div");
    hostEl.id = "cue-shadow-host";
    const shadow = hostEl.attachShadow({ mode: "open" });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("palette.css");
    shadow.appendChild(link);

    const mount = document.createElement("div");
    mount.style.visibility = "hidden";
    shadow.appendChild(mount);

    let revealed = false;
    const revealMount = () => {
      if (revealed) return;
      revealed = true;
      mount.style.visibility = "visible";
      if (paletteInstance) paletteInstance.focus();
    };

    link.addEventListener("load", revealMount, { once: true });
    link.addEventListener("error", revealMount, { once: true });
    setTimeout(revealMount, 150);

    document.documentElement.appendChild(hostEl);

    paletteInstance = window.__CueCreatePalette({
      container: mount,
      isPopup: false,
      onClose: closePalette
    });
  }

  // Fallback in-page shortcut listener (⌘⇧K on Mac, Ctrl+Shift+K on Windows/Linux)
  // Works even if chrome://extensions/shortcuts has a unbound/conflicting command
  window.addEventListener(
    "keydown",
    (e) => {
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
    }
    return false;
  });
})();

