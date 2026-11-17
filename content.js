(() => {
  if (window.__QuickCmdContentLoaded) return;
  window.__QuickCmdContentLoaded = true;

  let hostEl = null;
  let paletteInstance = null;

  function closePalette() {
    if (paletteInstance) {
      paletteInstance.destroy();
      paletteInstance = null;
    }
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
  }

  function openPalette() {
    if (hostEl) {
      closePalette();
      return;
    }

    hostEl = document.createElement("div");
    hostEl.id = "quickcmd-shadow-host";
    const shadow = hostEl.attachShadow({ mode: "open" });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("palette.css");
    shadow.appendChild(link);

    const mount = document.createElement("div");
    shadow.appendChild(mount);

    document.documentElement.appendChild(hostEl);

    paletteInstance = window.__QuickCmdCreatePalette({
      container: mount,
      isPopup: false,
      onClose: closePalette
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_PALETTE") {
      openPalette();
    }
  });
})();
