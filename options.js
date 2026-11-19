const rowsEl = document.getElementById("rows");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("add-btn");
const resetBtn = document.getElementById("reset-btn");
const saveBtn = document.getElementById("save-btn");
const idleSelect = document.getElementById("idle-minutes");

let links = [];

function render() {
  rowsEl.textContent = "";
  links.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "row";

    const bangInput = document.createElement("input");
    bangInput.placeholder = "gh";
    bangInput.value = item.bang || "";
    bangInput.addEventListener("input", (e) => {
      links[idx].bang = e.target.value.trim();
    });

    const titleInput = document.createElement("input");
    titleInput.placeholder = "GitHub";
    titleInput.value = item.title || "";
    titleInput.addEventListener("input", (e) => {
      links[idx].title = e.target.value;
    });

    const urlInput = document.createElement("input");
    urlInput.placeholder = "https://github.com";
    urlInput.value = item.url || "";
    urlInput.addEventListener("input", (e) => {
      links[idx].url = e.target.value.trim();
    });

    const searchInput = document.createElement("input");
    searchInput.placeholder = "https://github.com/search?q={query}";
    searchInput.value = item.searchUrl || "";
    searchInput.addEventListener("input", (e) => {
      links[idx].searchUrl = e.target.value.trim();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "✕";
    delBtn.title = "Remove";
    delBtn.addEventListener("click", () => {
      links.splice(idx, 1);
      render();
    });

    row.append(bangInput, titleInput, urlInput, searchInput, delBtn);
    rowsEl.appendChild(row);
  });
}

async function load() {
  const { quickLinks, idleTabMinutes } = await chrome.storage.sync.get(["quickLinks", "idleTabMinutes"]);
  if (Array.isArray(quickLinks)) {
    links = quickLinks;
  } else {
    const res = await chrome.runtime.sendMessage({ type: "GET_DEFAULT_QUICK_LINKS" });
    links = res?.defaults || [];
  }
  if (idleSelect) {
    const parsed = Number(idleTabMinutes);
    idleSelect.value = Number.isFinite(parsed) && parsed > 0 ? String(Math.floor(parsed)) : "60";
  }
  render();
}

addBtn.addEventListener("click", () => {
  links.push({ bang: "", title: "", url: "", searchUrl: "" });
  render();
});

resetBtn.addEventListener("click", async () => {
  const res = await chrome.runtime.sendMessage({ type: "GET_DEFAULT_QUICK_LINKS" });
  links = structuredClone(res?.defaults || []);
  render();
});

function normalizeQuickUrl(raw = "") {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return "";
  if (!/^(https?:\/\/|chrome:\/\/)/i.test(trimmed)) {
    return /^localhost\b/i.test(trimmed) ? `http://${trimmed}` : `https://${trimmed}`;
  }
  return trimmed;
}

saveBtn.addEventListener("click", async () => {
  const normalized = links
    .map((l) => {
      const bang = (l.bang || "").trim();
      const title = (l.title || "").trim();
      const url = normalizeQuickUrl(l.url || "");
      const searchUrl = normalizeQuickUrl(l.searchUrl || "");
      return { bang, title, url, searchUrl };
    })
    .filter((l) => l.title && l.url);

  const seenBangs = new Set();
  let duplicateBang = null;
  for (const item of normalized) {
    if (item.bang) {
      const lower = item.bang.toLowerCase();
      if (seenBangs.has(lower)) {
        duplicateBang = item.bang;
        break;
      }
      seenBangs.add(lower);
    }
  }

  if (duplicateBang) {
    statusEl.style.color = "#f87171";
    statusEl.textContent = `Error: Duplicate bang "!${duplicateBang}". Bangs must be unique.`;
    return;
  }

  const idleMinutes = idleSelect ? Math.max(1, Math.floor(Number(idleSelect.value) || 60)) : 60;
  await chrome.storage.sync.set({ quickLinks: normalized, idleTabMinutes: idleMinutes });
  links = normalized;
  render();
  statusEl.style.color = "";
  statusEl.textContent = "Saved!";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 1800);
});

// Chrome theme switching & extension management is opt-in: `management` is an optional permission.
// The request must run synchronously inside this click handler — awaiting
// anything first would lose the user gesture and Chrome would reject it,
// so the current state is cached in `themeGranted` instead of re-checked.
const themeBtn = document.getElementById("theme-btn");
const themeStatus = document.getElementById("theme-status");
let themeGranted = false;

async function refreshThemeState() {
  themeGranted = await chrome.permissions.contains({ permissions: ["management"] });
  themeBtn.textContent = themeGranted ? "Disable theme & extension management" : "Enable theme & extension management";
  themeStatus.textContent = themeGranted
    ? "On — Cue can list and toggle your installed Chrome themes and extensions."
    : "Off — Cue cannot see your installed themes or extensions.";
}

themeBtn.addEventListener("click", () => {
  if (themeGranted) {
    chrome.permissions.remove({ permissions: ["management"] }, () => refreshThemeState());
  } else {
    chrome.permissions.request({ permissions: ["management"] }, () => refreshThemeState());
  }
});

refreshThemeState();

load();

