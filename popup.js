const mount = document.getElementById("popup-mount");

window.__QuickCmdCreatePalette({
  container: mount,
  isPopup: true,
  onClose: () => window.close()
});
