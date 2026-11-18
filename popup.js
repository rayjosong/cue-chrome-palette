const mount = document.getElementById("popup-mount");

window.__CueCreatePalette({
  container: mount,
  isPopup: true,
  onClose: () => window.close()
});

