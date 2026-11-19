(() => {
  const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
  const nonce = hashParams.get("nonce") || "";
  const mount = document.getElementById("palette-mount");

  if (!nonce || !mount || typeof window.__CueCreatePalette !== "function") {
    return;
  }

  let port = null;
  const pendingMessages = [];

  function postToParent(payload) {
    if (port) {
      port.postMessage(payload);
    } else {
      pendingMessages.push(payload);
    }
  }

  const paletteInstance = window.__CueCreatePalette({
    container: mount,
    isPopup: false,
    onClose: () => {
      postToParent({ type: "CUE_FRAME_CLOSE" });
    },
    onToast: (toast, isError = false) => {
      postToParent({
        type: "CUE_FRAME_TOAST",
        toast,
        isError: Boolean(isError)
      });
    }
  });

  window.addEventListener("message", (event) => {
    if (port) return;
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "CUE_FRAME_INIT" || data.nonce !== nonce) return;
    const incomingPort = event.ports && event.ports[0];
    if (!incomingPort) return;

    port = incomingPort;
    port.onmessage = (portEvent) => {
      const msg = portEvent.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "CUE_FRAME_TOGGLE_CLOSE") {
        paletteInstance.destroy();
      }
    };

    while (pendingMessages.length > 0) {
      port.postMessage(pendingMessages.shift());
    }
    port.postMessage({ type: "CUE_FRAME_READY" });
    paletteInstance.focus();
  });

  // Handle ⌘⇧K / Ctrl+Shift+K when focus is inside the iframe
  window.addEventListener(
    "keydown",
    (e) => {
      if (!e.isTrusted) return;
      const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
      const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        paletteInstance.destroy();
      }
    },
    true
  );
})();
