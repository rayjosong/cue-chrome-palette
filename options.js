const rowsEl = document.getElementById("rows");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("add-btn");
const resetBtn = document.getElementById("reset-btn");
const saveBtn = document.getElementById("save-btn");

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
  const { quickLinks } = await chrome.storage.sync.get("quickLinks");
  if (Array.isArray(quickLinks)) {
    links = quickLinks;
  } else {
    const res = await chrome.runtime.sendMessage({ type: "GET_DEFAULT_QUICK_LINKS" });
    links = res?.defaults || [];
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

saveBtn.addEventListener("click", async () => {
  const cleaned = links.filter((l) => l.title.trim() && l.url.trim());
  await chrome.storage.sync.set({ quickLinks: cleaned });
  links = cleaned;
  render();
  statusEl.textContent = "Saved!";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 1800);
});

load();
