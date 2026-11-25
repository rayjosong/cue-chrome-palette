/**
 * palette-core.js - Pure Search/Ranking Engine & Domain Logic for Cue
 * Manifest V3 Zero-Build Vanilla JavaScript
 */
(() => {
  const GROUP_COLOR_HEX = {
    grey: "#9ca3af",
    blue: "#60a5fa",
    red: "#f87171",
    yellow: "#fbbf24",
    green: "#4ade80",
    pink: "#f472b6",
    purple: "#c084fc",
    cyan: "#22d3ee",
    orange: "#fb923c"
  };

  const GROUP_COLORS = ["blue", "purple", "cyan", "green", "yellow", "orange", "pink", "red", "grey"];

  const CHIP_MODES = [
    { id: "all", label: "All", icon: "search" },
    { id: "tabs", label: "Tabs", icon: "globe" },
    { id: "groups", label: "Groups", icon: "layers" },
    { id: "commands", label: "Commands", icon: "zap" }
  ];

  const REPO_URL = "https://github.com/rayjosong/cue-chrome-palette";
  const ISSUES_URL = "https://github.com/rayjosong/cue-chrome-palette/issues";
  const SUPPORT_URL = "https://buymeacoffee.com/xqpfm09t8t";

  const MODE_DEFINITIONS = {
    all: { id: "all", label: "All", singularLabel: "result", icon: "search" },
    tabs: { id: "tabs", label: "Tabs", singularLabel: "tab", icon: "globe" },
    groups: { id: "groups", label: "Groups", singularLabel: "tab group", icon: "layers" },
    commands: { id: "commands", label: "Commands", singularLabel: "command", icon: "zap" },
    bookmarks: { id: "bookmarks", label: "Bookmarks", singularLabel: "bookmark", icon: "star" },
    history: { id: "history", label: "History", singularLabel: "history item", icon: "history" },
    closed: { id: "closed", label: "Closed", singularLabel: "recently closed tab", icon: "rotateCcw" },
    archived: { id: "archived", label: "Archived", singularLabel: "archived tab", icon: "archive" },
    themes: { id: "themes", label: "Themes", singularLabel: "Chrome theme", icon: "palette" },
    extensions: { id: "extensions", label: "Extensions", singularLabel: "extension", icon: "puzzle" },
    downloads: { id: "downloads", label: "Downloads", singularLabel: "download", icon: "download" }
  };

  function formatRelativeTime(timestamp, now = Date.now()) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || ts <= 0) return "Archived";
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.floor(diffDay / 30);
    return `${diffMo}mo ago`;
  }

  function getModeDefinition(mode) {
    return MODE_DEFINITIONS[mode] || MODE_DEFINITIONS.all;
  }

  function hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== "string") return `rgba(156, 163, 175, ${alpha})`;
    let clean = hex.replace("#", "");
    if (clean.length === 3) {
      clean = clean
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return `rgba(156, 163, 175, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function looksLikeUrl(q) {
    if (!q || typeof q !== "string") return false;
    const trimmed = q.trim();
    if (!trimmed || /\s/.test(trimmed)) return false;
    return /^(https?:\/\/|localhost(:\d+)?(\/.*)?|([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?)$/i.test(trimmed);
  }

  function normalizeUrl(q) {
    if (!q || typeof q !== "string") return "";
    const trimmed = q.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^localhost/i.test(trimmed)) return `http://${trimmed}`;
    return `https://${trimmed}`;
  }

  function normalizeUrlForDedup(rawUrl = "") {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
      const u = new URL(rawUrl);
      u.hash = "";
      let s = u.toString();
      if (s.endsWith("/")) {
        s = s.slice(0, -1);
      }
      return s;
    } catch {
      return rawUrl.replace(/#.*$/, "").replace(/\/+$/, "");
    }
  }

  function stripTrackingParams(rawUrl = "") {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
      const u = new URL(rawUrl);
      const trackingParams = new Set([
        "fbclid", "gclid", "dclid", "msclkid",
        "mc_cid", "mc_eid", "ref_src", "igshid",
        "_hsenc", "_hsmi"
      ]);
      const keysToDelete = [];
      for (const key of u.searchParams.keys()) {
        const lower = key.toLowerCase();
        if (lower.startsWith("utm_") || trackingParams.has(lower)) {
          keysToDelete.push(key);
        }
      }
      for (const k of keysToDelete) {
        u.searchParams.delete(k);
      }
      return u.toString();
    } catch {
      return rawUrl;
    }
  }

  function formatMarkdownLink(title = "", url = "") {
    const safeTitle = (title || url || "")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");
    return `[${safeTitle}](${url || ""})`;
  }

  const KNOWN_BRAND_TITLES = {
    github: "GitHub",
    gitlab: "GitLab",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    stackoverflow: "StackOverflow",
    chatgpt: "ChatGPT",
    localhost: "Localhost",
    google: "Google",
    mozilla: "Mozilla",
    reddit: "Reddit",
    wikipedia: "Wikipedia",
    figma: "Figma",
    notion: "Notion"
  };

  function suggestDomainGroupTitle(hostnameOrDomain = "") {
    if (!hostnameOrDomain || typeof hostnameOrDomain !== "string") return "";
    const cleanHost = hostnameOrDomain.trim().replace(/^www\./i, "");
    if (!cleanHost) return "";
    const base = cleanHost.split(".")[0] || cleanHost;
    return KNOWN_BRAND_TITLES[base.toLowerCase()] || base.charAt(0).toUpperCase() + base.slice(1);
  }

  function formatTabList(tabs = [], format = "markdown") {
    if (!Array.isArray(tabs)) return "";
    const validTabs = tabs.filter((t) => t && typeof t.url === "string" && t.url.trim().length > 0);
    if (format === "urls") {
      return validTabs.map((t) => t.url).join("\n");
    }
    if (format === "clean-urls") {
      return validTabs.map((t) => stripTrackingParams(t.url)).join("\n");
    }
    return validTabs.map((t) => `- ${formatMarkdownLink(t.title || t.url, t.url)}`).join("\n");
  }

  function extractHostname(rawUrl = "") {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
      const u = new URL(rawUrl);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return u.hostname.toLowerCase();
      }
    } catch {
      // Ignore invalid URLs
    }
    return "";
  }

  const TWO_PART_PUBLIC_SUFFIXES = new Set([
    "co.uk", "org.uk", "gov.uk", "ac.uk",
    "com.au", "net.au", "org.au",
    "co.nz",
    "co.jp", "ne.jp", "or.jp",
    "com.sg", "edu.sg", "gov.sg",
    "com.br", "com.mx",
    "co.in", "co.kr", "com.hk", "com.tw"
  ]);

  function extractBaseDomain(rawUrl = "") {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    const trimmed = rawUrl.trim();
    if (
      trimmed.startsWith("chrome://") ||
      trimmed.startsWith("chrome-extension://") ||
      trimmed.startsWith("edge://") ||
      trimmed.startsWith("about:") ||
      trimmed.startsWith("view-source:") ||
      trimmed.startsWith("devtools://") ||
      trimmed.startsWith("chrome-search://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("javascript:") ||
      trimmed.startsWith("file://")
    ) {
      return "";
    }

    let host = "";
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed);
        if (u.protocol !== "http:" && u.protocol !== "https:") return "";
        host = u.hostname.toLowerCase();
      } catch {
        return "";
      }
    } else if (trimmed.includes("://")) {
      return "";
    } else {
      try {
        const u = new URL(`http://${trimmed}`);
        host = u.hostname.toLowerCase();
      } catch {
        host = trimmed.toLowerCase();
      }
    }

    if (!host) return "";

    if (host.startsWith("www.")) {
      host = host.slice(4);
    }

    const isIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    const isIpv6 = host.includes(":") || (host.startsWith("[") && host.endsWith("]"));
    if (host === "localhost" || isIpv4 || isIpv6) {
      return host;
    }

    const parts = host.split(".");
    if (parts.length <= 1) {
      return host;
    }

    const lastTwo = parts.slice(-2).join(".");
    if (TWO_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
      if (parts.length >= 3) {
        return parts.slice(-3).join(".");
      }
      return host;
    }

    return parts.slice(-2).join(".");
  }

  function parseModeAndQuery(raw, chipMode = "all") {
    const trimmed = (raw || "").trimStart();
    if (trimmed.startsWith(">")) {
      return { mode: "commands", query: trimmed.slice(1).trim(), prefixLabel: "Commands", isPrefix: true, rawPrefix: ">" };
    }
    if (trimmed.startsWith("@")) {
      return { mode: "tabs", query: trimmed.slice(1).trim(), prefixLabel: "Tabs", isPrefix: true, rawPrefix: "@" };
    }
    if (trimmed.startsWith("*")) {
      return { mode: "bookmarks", query: trimmed.slice(1).trim(), prefixLabel: "Bookmarks", isPrefix: true, rawPrefix: "*" };
    }
    if (trimmed === "/h" || trimmed.startsWith("/h ")) {
      return { mode: "history", query: trimmed.slice(2).trim(), prefixLabel: "History", isPrefix: true, rawPrefix: "/h" };
    }
    if (trimmed === "/g" || trimmed.startsWith("/g ")) {
      return { mode: "groups", query: trimmed.slice(2).trim(), prefixLabel: "Groups", isPrefix: true, rawPrefix: "/g" };
    }
    if (trimmed === "/c" || trimmed.startsWith("/c ")) {
      return { mode: "closed", query: trimmed.slice(2).trim(), prefixLabel: "Closed", isPrefix: true, rawPrefix: "/c" };
    }
    if (trimmed === "/a" || trimmed.startsWith("/a ")) {
      return { mode: "archived", query: trimmed.slice(2).trim(), prefixLabel: "Archived", isPrefix: true, rawPrefix: "/a" };
    }
    if (trimmed === "/t" || trimmed.startsWith("/t ")) {
      return { mode: "themes", query: trimmed.slice(2).trim(), prefixLabel: "Themes", isPrefix: true, rawPrefix: "/t" };
    }
    if (trimmed === "/e" || trimmed.startsWith("/e ")) {
      return { mode: "extensions", query: trimmed.slice(2).trim(), prefixLabel: "Extensions", isPrefix: true, rawPrefix: "/e" };
    }
    if (trimmed === "/d" || trimmed.startsWith("/d ")) {
      return { mode: "downloads", query: trimmed.slice(2).trim(), prefixLabel: "Downloads", isPrefix: true, rawPrefix: "/d" };
    }
    return {
      mode: chipMode || "all",
      query: trimmed.trim(),
      prefixLabel: "",
      isPrefix: false,
      rawPrefix: ""
    };
  }

  const BOUNDARY_SEP_RE = /[\s/\\\-_.:?&=#()[\]{},;"'|·—–+@]/;
  const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
  const SCHEME_EXPLICIT_RE = /(https?:|chrome:|edge:|file:|ftp:|www\.)/i;

  // Fast ASCII separator lookup table (avoids regex overhead in tight loops)
  const ASCII_SEP = new Uint8Array(128);
  for (const ch of " \t\n\r\f\v/\\-_.:?&=#()[]{},;\"'|+@") {
    ASCII_SEP[ch.charCodeAt(0)] = 1;
  }

  function isSeparatorCode(code) {
    if (code < 128) return ASCII_SEP[code] === 1;
    return code === 0x00b7 || code === 0x2014 || code === 0x2013 || code === 0x00a0;
  }

  function isAsciiUpper(code) {
    return code >= 65 && code <= 90;
  }

  function isAsciiLower(code) {
    return code >= 97 && code <= 122;
  }

  function isAsciiDigit(code) {
    return code >= 48 && code <= 57;
  }

  function isAsciiLetter(code) {
    return isAsciiUpper(code) || isAsciiLower(code);
  }

  function prepareText(str) {
    const raw = typeof str === "string" ? str : String(str || "");
    if (!raw) return { raw: "", lower: "", indexMap: null, boundaries: new Uint8Array(0) };

    let isAscii = true;
    for (let i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) > 127) {
        isAscii = false;
        break;
      }
    }

    let lower;
    let indexMap = null;
    if (isAscii) {
      lower = raw.toLowerCase();
    } else {
      lower = "";
      indexMap = [];
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch >= "\u0300" && ch <= "\u036f") continue;
        const folded = ch.normalize("NFD").replace(COMBINING_MARKS_RE, "");
        const base = (folded || ch).toLowerCase();
        for (let k = 0; k < base.length; k++) {
          lower += base[k];
          indexMap.push(i);
        }
      }
    }

    const len = lower.length;
    const boundaries = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      if (i === 0) {
        boundaries[i] = 1;
        continue;
      }
      const rawIdx = indexMap ? indexMap[i] : i;
      const prevRawIdx = indexMap ? indexMap[i - 1] : i - 1;
      const prevCode = raw.charCodeAt(prevRawIdx);
      const curCode = raw.charCodeAt(rawIdx);
      if (isSeparatorCode(prevCode)) {
        boundaries[i] = 1;
        continue;
      }
      if (isAsciiLower(prevCode) && isAsciiUpper(curCode)) {
        boundaries[i] = 1;
        continue;
      }
      if (isAsciiUpper(prevCode) && isAsciiUpper(curCode) && rawIdx + 1 < raw.length && isAsciiLower(raw.charCodeAt(rawIdx + 1))) {
        boundaries[i] = 1;
        continue;
      }
      if ((isAsciiLetter(prevCode) && isAsciiDigit(curCode)) || (isAsciiDigit(prevCode) && isAsciiLetter(curCode))) {
        boundaries[i] = 1;
      }
    }

    return { raw, lower, indexMap, boundaries };
  }

  function mapIndices(indices, indexMap) {
    if (!indexMap || !indices.length) return indices;
    const seen = new Set();
    const out = [];
    for (let i = 0; i < indices.length; i++) {
      const mapped = indexMap[indices[i]];
      if (mapped !== undefined && !seen.has(mapped)) {
        seen.add(mapped);
        out.push(mapped);
      }
    }
    return out;
  }

  function normalizeQueryStr(query) {
    if (!query || typeof query !== "string") return "";
    const trimmed = query.trim();
    if (!trimmed) return "";
    let isAscii = true;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed.charCodeAt(i) > 127) {
        isAscii = false;
        break;
      }
    }
    if (isAscii) return trimmed.toLowerCase();
    return trimmed.normalize("NFD").replace(COMBINING_MARKS_RE, "").toLowerCase();
  }

  // Reusable scratch rows for Damerau-Levenshtein (avoids per-call allocations)
  const DL_ROW_A = new Int32Array(32);
  const DL_ROW_B = new Int32Array(32);
  const DL_ROW_C = new Int32Array(32);

  function damerauLevenshtein(a, b, maxDist) {
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > maxDist) return maxDist + 1;
    if (a === b) return 0;
    if (lb >= 32) return maxDist + 1;

    let prevPrev = DL_ROW_C;
    let prev = DL_ROW_A;
    let curr = DL_ROW_B;
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
      curr[0] = i;
      let rowMin = i;
      const ai = a.charCodeAt(i - 1);
      for (let j = 1; j <= lb; j++) {
        const bj = b.charCodeAt(j - 1);
        const cost = ai === bj ? 0 : 1;
        let val = prev[j] + 1;
        const ins = curr[j - 1] + 1;
        if (ins < val) val = ins;
        const sub = prev[j - 1] + cost;
        if (sub < val) val = sub;
        if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
          const trans = prevPrev[j - 2] + 1;
          if (trans < val) val = trans;
        }
        curr[j] = val;
        if (val < rowMin) rowMin = val;
      }
      if (rowMin > maxDist) return maxDist + 1;
      const tmp = prevPrev;
      prevPrev = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[lb];
  }

  function findOptimalSubsequence(t, tok, boundaries, usedIndices, allowOverlap) {
    const m = tok.length;
    if (m < 2) return null;
    const n = Math.min(t.length, 256);
    if (n < m) return null;

    // Fast linear feasibility check before DP
    let qi = 0;
    for (let ti = 0; ti < n && qi < m; ti++) {
      if (!allowOverlap && usedIndices && usedIndices.has(ti)) continue;
      if (t.charCodeAt(ti) === tok.charCodeAt(qi)) qi++;
    }
    if (qi < m) return null;

    // Collect candidate positions for each query character
    const pos = new Array(m);
    for (let i = 0; i < m; i++) {
      const ch = tok.charCodeAt(i);
      const list = [];
      for (let j = 0; j < n; j++) {
        if (!allowOverlap && usedIndices && usedIndices.has(j)) continue;
        if (t.charCodeAt(j) === ch) list.push(j);
      }
      if (!list.length) return null;
      pos[i] = list;
    }

    const dp = new Array(m);
    const prevIdx = new Array(m);
    const runLen = new Array(m);

    // Base row (i = 0) — integer weights (10x scaled) for exact deterministic tie-breaking
    dp[0] = new Int32Array(pos[0].length);
    prevIdx[0] = new Int32Array(pos[0].length);
    runLen[0] = new Int32Array(pos[0].length);
    for (let p = 0; p < pos[0].length; p++) {
      const j = pos[0][p];
      dp[0][p] = 100 + (j === 0 ? 160 : boundaries[j] ? 140 : 0) - Math.min(j, 20) * 5;
      prevIdx[0][p] = -1;
      runLen[0][p] = 1;
    }

    // DP transitions
    const NEG_INF = -1000000000;
    for (let i = 1; i < m; i++) {
      const curList = pos[i];
      const prevList = pos[i - 1];
      dp[i] = new Int32Array(curList.length);
      prevIdx[i] = new Int32Array(curList.length);
      runLen[i] = new Int32Array(curList.length);

      for (let p = 0; p < curList.length; p++) {
        const j = curList[p];
        const isBnd = boundaries[j] === 1;
        let best = NEG_INF;
        let bestK = -1;
        let bestRun = 1;

        for (let k = 0; k < prevList.length; k++) {
          const pj = prevList[k];
          if (pj >= j) break;
          const prevScore = dp[i - 1][k];
          if (prevScore === NEG_INF) continue;

          const gap = j - pj - 1;
          let delta;
          let nextRun;
          if (gap === 0) {
            nextRun = runLen[i - 1][k] + 1;
            delta = 100 + 120 + Math.min(nextRun, 5) * 20 + (isBnd ? 60 : 0);
          } else if (isBnd) {
            nextRun = 1;
            delta = 100 + 140 - (15 + Math.min(gap, 8) * 6);
          } else {
            nextRun = 1;
            delta = 100 - (30 + Math.min(gap, 12) * 16 + Math.max(0, gap - 12) * 6);
          }

          const cand = prevScore + delta;
          if (cand > best) {
            best = cand;
            bestK = k;
            bestRun = nextRun;
          }
        }

        dp[i][p] = best;
        prevIdx[i][p] = bestK;
        runLen[i][p] = bestRun;
      }
    }

    // Find best ending position
    let bestEnd = -1;
    let bestScore = NEG_INF;
    const lastRow = dp[m - 1];
    for (let p = 0; p < lastRow.length; p++) {
      if (lastRow[p] > bestScore) {
        bestScore = lastRow[p];
        bestEnd = p;
      }
    }
    if (bestEnd === -1 || bestScore === NEG_INF) return null;

    const indices = new Array(m);
    let curP = bestEnd;
    for (let i = m - 1; i >= 0; i--) {
      indices[i] = pos[i][curP];
      curP = prevIdx[i][curP];
    }

    // Anti-noise quality gate: reject scattered random letter matches in long strings/URLs
    const span = indices[m - 1] - indices[0] + 1;
    const firstIsBnd = boundaries[indices[0]] === 1;
    let bndCount = 0;
    let consecCount = 0;
    let maxNonBndGap = 0;
    let maxBndGap = 0;
    let maxSkippedWords = 0;

    for (let i = 0; i < m; i++) {
      if (boundaries[indices[i]] === 1) bndCount++;
      if (i > 0) {
        const prev = indices[i - 1];
        const cur = indices[i];
        const gap = cur - prev - 1;
        if (gap === 0) {
          consecCount++;
        } else if (boundaries[cur] === 1) {
          if (gap > maxBndGap) maxBndGap = gap;
          let skippedWords = 0;
          for (let k = prev + 1; k < cur; k++) {
            if (boundaries[k] === 1) skippedWords++;
          }
          if (skippedWords > maxSkippedWords) maxSkippedWords = skippedWords;
        } else if (gap > maxNonBndGap) {
          maxNonBndGap = gap;
        }
      }
    }

    if (m === 2) {
      const gap = indices[1] - indices[0] - 1;
      const secondIsBnd = boundaries[indices[1]] === 1;
      if (!firstIsBnd || (!secondIsBnd && gap > 4) || (secondIsBnd && (gap > 14 || maxSkippedWords > 2))) {
        return null;
      }
    } else {
      const density = m / span;
      const bndRatio = bndCount / m;
      if (bndRatio >= 0.75) {
        if (span > m * 14 || maxBndGap > 14 || maxNonBndGap > 6 || maxSkippedWords > 2) return null;
      } else {
        if (!firstIsBnd && consecCount < 1) return null;
        if (density < 0.25 && !(bndCount >= 2 && density >= 0.2)) return null;
        if (maxNonBndGap > 8 || maxBndGap > 14 || maxSkippedWords > 2) return null;
      }
    }

    const density = m / span;
    const bndRatio = bndCount / m;
    const consecRatio = consecCount / Math.max(1, m - 1);
    const posPenalty = Math.min(indices[0], 16) * 0.25;
    const score = Math.round(33 + bndRatio * 12 + consecRatio * 7 + density * 6 - posPenalty);
    return {
      score: Math.min(56, Math.max(32, score)),
      indices,
      matchType: "subsequence"
    };
  }

  function findTypoMatch(t, tok, boundaries, usedIndices) {
    const m = tok.length;
    if (m < 4 || m > 24) return null;
    const maxDist = m >= 7 ? 2 : 1;
    const n = Math.min(t.length, 256);
    const tok0 = tok.charCodeAt(0);
    const tok1 = tok.charCodeAt(1);
    const tok2 = tok.charCodeAt(2);

    let best = null;
    let wStart = -1;
    for (let i = 0; i <= n; i++) {
      const isAlphaNum = i < n && !isSeparatorCode(t.charCodeAt(i));
      if (isAlphaNum) {
        if (wStart === -1) wStart = i;
      } else if (wStart !== -1) {
        const start = wStart;
        const end = i;
        wStart = -1;
        const len = end - start;
        if (len < m - maxDist || len > 30) continue;

        // Fast first-char pre-filter before slicing or running DP
        const w0 = t.charCodeAt(start);
        const w1 = len > 1 ? t.charCodeAt(start + 1) : -1;
        if (m <= 5) {
          if (w0 !== tok0 && !(w0 === tok1 && w1 === tok0)) continue;
        } else if (w0 !== tok0 && w0 !== tok1 && w1 !== tok0 && w1 !== tok1 && w0 !== tok2) {
          continue;
        }

        if (usedIndices) {
          let allUsed = true;
          for (let u = start; u < end; u++) {
            if (!usedIndices.has(u)) {
              allUsed = false;
              break;
            }
          }
          if (allUsed) continue;
        }

        const word = t.slice(start, end);
        let dist = maxDist + 1;
        let matchLen = len;
        let isPrefixTypo = false;

        if (Math.abs(len - m) <= maxDist) {
          const dFull = damerauLevenshtein(tok, word, maxDist);
          if (dFull <= maxDist) {
            dist = dFull;
            matchLen = len;
          }
        }

        if (dist > 1 && len > m) {
          const dPref = damerauLevenshtein(tok, word.slice(0, m), 1);
          if (dPref <= 1) {
            dist = dPref;
            matchLen = m;
            isPrefixTypo = true;
          }
        }

        if (dist <= maxDist) {
          const posPenalty = Math.min(start, 16) * 0.2;
          const startBonus = start === 0 ? 2 : boundaries[start] === 1 ? 1 : 0;
          const base = dist === 1 ? (isPrefixTypo ? 28 : 32) : 25;
          const score = Math.max(22, Math.round(base + startBonus - posPenalty));
          if (!best || score > best.score) {
            best = {
              score,
              indices: Array.from({ length: matchLen }, (_, k) => start + k),
              matchType: "typo"
            };
          }
        }
      }
    }

    return best;
  }

  function singleTokenMatch(prepared, tok, usedIndices, options = {}) {
    const t = prepared.lower;
    const boundaries = prepared.boundaries;
    if (!tok || !t) return { score: 0, indices: [], matchType: "none" };

    if (t === tok) {
      const indices = Array.from({ length: t.length }, (_, i) => i);
      return { score: 120, indices, matchType: "exact" };
    }

    if (t.startsWith(tok)) {
      const indices = Array.from({ length: tok.length }, (_, i) => i);
      const hasOverlap = usedIndices && indices.some((i) => usedIndices.has(i));
      if (!hasOverlap) {
        const endIdx = tok.length;
        const isWholeWord = endIdx === t.length || boundaries[endIdx] === 1 || isSeparatorCode(t.charCodeAt(endIdx));
        const coverage = tok.length / t.length;
        const score = Math.min(108, 95 + (isWholeWord ? 4 : 0) + Math.round(coverage * 7));
        return { score, indices, matchType: "prefix" };
      }
    }

    let fromIdx = 0;
    const wbMatches = [];
    const subMatches = [];
    while (true) {
      const idx = t.indexOf(tok, fromIdx);
      if (idx === -1) break;
      const indices = Array.from({ length: tok.length }, (_, i) => idx + i);
      const endIdx = idx + tok.length;
      const isWholeWord = endIdx === t.length || boundaries[endIdx] === 1 || isSeparatorCode(t.charCodeAt(endIdx));
      const entry = { idx, indices, isWholeWord };
      if (boundaries[idx] === 1) {
        wbMatches.push(entry);
      } else {
        subMatches.push(entry);
      }
      fromIdx = idx + 1;
    }

    function pickBestContiguous(matches, isBoundary) {
      if (!matches.length) return null;
      const candidates = usedIndices
        ? matches.filter((m) => !m.indices.some((i) => usedIndices.has(i)))
        : matches;
      const pool = candidates.length ? candidates : null;
      if (!pool) return null;
      // Prefer whole-word boundary matches, then earliest occurrence
      let best = pool[0];
      for (let i = 1; i < pool.length; i++) {
        if (pool[i].isWholeWord && !best.isWholeWord) {
          best = pool[i];
          break;
        }
      }
      const coverage = Math.min(1, tok.length / Math.max(1, t.length));
      if (isBoundary) {
        const score = Math.min(
          94,
          Math.max(76, 88 - Math.min(best.idx, 12)) + (best.isWholeWord ? 4 : 0) + Math.round(coverage * 2)
        );
        return { score, indices: best.indices, matchType: "boundary" };
      }
      const score = Math.max(60, 72 - Math.min(best.idx, 12)) + Math.round(coverage * 2);
      return { score, indices: best.indices, matchType: "substring" };
    }

    const bestWb = pickBestContiguous(wbMatches, true);
    if (bestWb) return bestWb;

    const bestSub = pickBestContiguous(subMatches, false);
    if (bestSub) return bestSub;

    // Fallback to overlapping contiguous matches if all occurrences overlapped usedIndices
    if (usedIndices && wbMatches.length > 0) {
      const best = wbMatches[0];
      const score = Math.min(94, Math.max(76, 88 - Math.min(best.idx, 12)) + (best.isWholeWord ? 4 : 0));
      return { score, indices: best.indices, matchType: "boundary" };
    }
    if (usedIndices && subMatches.length > 0) {
      const best = subMatches[0];
      return { score: Math.max(60, 72 - Math.min(best.idx, 12)), indices: best.indices, matchType: "substring" };
    }

    if (options.allowSubseq !== false) {
      const subseq =
        (usedIndices ? findOptimalSubsequence(t, tok, boundaries, usedIndices, false) : null) ||
        findOptimalSubsequence(t, tok, boundaries, usedIndices, true);
      if (subseq) {
        return subseq;
      }
    }

    if (options.allowTypo !== false) {
      const typo = findTypoMatch(t, tok, boundaries, usedIndices);
      if (typo) {
        return typo;
      }
    }

    return { score: 0, indices: [], matchType: "none" };
  }

  function matchMultiTokens(prepared, tokens, options = {}) {
    const tokenResults = [];
    const usedIndices = new Set();
    for (let i = 0; i < tokens.length; i++) {
      const res = singleTokenMatch(prepared, tokens[i], usedIndices, options);
      if (!res || res.score === 0) {
        return { score: 0, indices: [] };
      }
      for (const idx of res.indices) {
        usedIndices.add(idx);
      }
      tokenResults.push(res);
    }

    const allIndices = Array.from(usedIndices).sort((a, b) => a - b);
    const avgScore = tokenResults.reduce((sum, r) => sum + r.score, 0) / tokenResults.length;

    // Reward tokens appearing in typed order and adjacent to each other
    let inOrder = true;
    let adjacentPairs = 0;
    for (let i = 1; i < tokenResults.length; i++) {
      const prevInds = tokenResults[i - 1].indices;
      const curInds = tokenResults[i].indices;
      if (prevInds.length && curInds.length) {
        const prevStart = prevInds[0];
        const prevEnd = prevInds[prevInds.length - 1];
        const curStart = curInds[0];
        if (curStart < prevStart) {
          inOrder = false;
        } else if (curStart - prevEnd <= 3) {
          adjacentPairs++;
        }
      }
    }

    const hasTypo = tokenResults.some((r) => r.matchType === "typo");
    const hasSubseq = tokenResults.some((r) => r.matchType === "subsequence");
    const bonus = (inOrder ? 4 : 0) + Math.min(8, adjacentPairs * 4);
    let composite = Math.round(avgScore + bonus);

    if (hasTypo) {
      composite = Math.min(50, Math.max(24, composite));
    } else if (hasSubseq) {
      composite = Math.min(72, Math.max(44, composite));
    } else {
      composite = Math.min(110, Math.max(64, composite));
    }

    return { score: composite, indices: allIndices };
  }

  function fuzzyMatchPrepared(prepared, normQ, tokens, options = {}) {
    const t = prepared.lower;
    if (!t) return { score: 0, indices: [] };

    if (t === normQ) {
      const rawIndices = Array.from({ length: t.length }, (_, i) => i);
      return { score: 120, indices: mapIndices(rawIndices, prepared.indexMap) };
    }

    if (tokens.length > 1) {
      // Check if the full phrase matches contiguously (e.g. "tab group" in "Fold All Tab Groups")
      const phraseRes = singleTokenMatch(prepared, normQ, null, { allowSubseq: false, allowTypo: false });
      const multiRes = matchMultiTokens(prepared, tokens, options);
      let best;
      if (phraseRes.score > 0 && phraseRes.score >= multiRes.score) {
        const nonSpaceIndices = phraseRes.indices.filter((i) => !isSeparatorCode(t.charCodeAt(i)));
        best = { score: phraseRes.score, indices: nonSpaceIndices };
      } else {
        best = multiRes;
      }
      if (!best.score) return { score: 0, indices: [] };
      return { score: best.score, indices: mapIndices(best.indices, prepared.indexMap) };
    }

    const single = singleTokenMatch(prepared, tokens[0], null, options);
    if (single.score > 0) {
      return { score: single.score, indices: mapIndices(single.indices, prepared.indexMap) };
    }

    // Support punctuation-joined queries like "tab-group" matching "Tab Group"
    if (/[-_/]/.test(tokens[0])) {
      const splitTokens = tokens[0].split(/[-_/]+/).filter(Boolean);
      if (splitTokens.length > 1) {
        const splitRes = matchMultiTokens(prepared, splitTokens, options);
        if (splitRes.score > 0) {
          return { score: splitRes.score, indices: mapIndices(splitRes.indices, prepared.indexMap) };
        }
      }
    }

    return { score: 0, indices: [] };
  }

  function fuzzyMatch(text, query, options = {}) {
    if (!query) return { score: 1, indices: [] };
    const q = normalizeQueryStr(query);
    if (!q) return { score: 1, indices: [] };
    const prepared = prepareText(text);
    const tokens = q.split(/\s+/).filter(Boolean);
    return fuzzyMatchPrepared(prepared, q, tokens, options);
  }

  function getHighlightRanges(text, query) {
    const str = text || "";
    const q = (query || "").trim();
    if (!q) return [{ text: str, matched: false }];

    // Avoid highlighting scheme characters (https://) in URLs unless the query references a scheme
    let searchStr = str;
    let offset = 0;
    if (/^https?:\/\//i.test(str) && !SCHEME_EXPLICIT_RE.test(q)) {
      const schemeEnd = str.indexOf("://") + 3;
      searchStr = str.slice(schemeEnd);
      offset = schemeEnd;
    }

    let { score, indices } = fuzzyMatch(searchStr, q);
    if (score > 0 && indices.length && offset > 0) {
      indices = indices.map((i) => i + offset);
    }

    // For cross-field multi-token queries (e.g. "github pull" where "github" is in URL and "pull" is in title),
    // highlight whichever query tokens cleanly match this field.
    if (!score || !indices.length) {
      const normQ = normalizeQueryStr(q);
      const tokens = normQ.split(/\s+/).filter(Boolean);
      if (tokens.length > 1) {
        const prepared = prepareText(searchStr);
        const used = new Set();
        for (const tok of tokens) {
          const res = singleTokenMatch(prepared, tok, used, { allowTypo: false });
          if (res.score > 0 && res.indices.length) {
            for (const i of res.indices) used.add(i);
          }
        }
        if (used.size > 0) {
          const sorted = Array.from(used).sort((a, b) => a - b);
          indices = mapIndices(sorted, prepared.indexMap).map((i) => i + offset);
          score = 1;
        }
      }
    }

    if (!score || !indices.length) return [{ text: str, matched: false }];

    const markSet = new Set(indices);
    const segments = [];
    let currentMatched = markSet.has(0);
    let buf = "";

    for (let i = 0; i < str.length; i++) {
      const isMarked = markSet.has(i);
      if (isMarked !== currentMatched) {
        if (buf) segments.push({ text: buf, matched: currentMatched });
        buf = str[i];
        currentMatched = isMarked;
      } else {
        buf += str[i];
      }
    }
    if (buf) segments.push({ text: buf, matched: currentMatched });
    return segments;
  }

  function extractUrlParts(rawUrl = "") {
    if (!rawUrl || typeof rawUrl !== "string") return { host: "", cleanUrl: "" };
    const trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return { host: "", cleanUrl: trimmed };
    }
    const withoutScheme = trimmed.replace(/^https?:\/\//i, "");
    const cleanUrl = withoutScheme.replace(/^www\./i, "");
    const slashIdx = cleanUrl.search(/[/?#]/);
    const host = slashIdx === -1 ? cleanUrl : cleanUrl.slice(0, slashIdx);
    return { host, cleanUrl: cleanUrl.slice(0, 240) };
  }

  function getSearchPriority(item, mode) {
    if (!item) return 0;
    switch (item.kind) {
      case "tab": {
        if (item.currentWindow) {
          if (item.active) return 5.0;
          const mruBonus = Math.max(0, Math.min(2.0, ((item.priority || 24) - 24) * 0.8));
          return 8.0 + mruBonus;
        }
        return 6.5;
      }
      case "group":
        return item.priority >= 16 ? 6.5 : 5.0;
      case "bang":
        return 6.0;
      case "action": {
        const base = mode === "commands" ? 5.5 : 4.5;
        return base + Math.max(-1, Math.min(2, ((item.priority || 10) - 9) * 0.25));
      }
      case "closed":
        return 4.8;
      case "archived":
        return 4.6;
      case "chrome":
      case "theme":
      case "extension":
        return 4.5;
      case "bookmark":
        return 4.2;
      case "download":
        return 3.8;
      case "history": {
        const visitBonus = item.visitCount ? Math.min(2.2, Math.log2(item.visitCount + 1) * 0.55) : 0;
        return 2.0 + visitBonus;
      }
      default:
        return 3.0;
    }
  }

  function scoreItem(item, query, queryTokens = null) {
    if (!item || !query) return 0;
    const normQ = normalizeQueryStr(query);
    if (!normQ) return 0;
    const tokens = queryTokens || normQ.split(/\s+/).filter(Boolean);
    const wantsScheme = SCHEME_EXPLICIT_RE.test(normQ);

    const fields = [];
    if (item.title) {
      fields.push({ text: item.title, weight: 1.0, prepared: null });
    }

    const isUrlItem =
      item.kind === "tab" ||
      item.kind === "closed" ||
      item.kind === "archived" ||
      item.kind === "history" ||
      item.kind === "bookmark" ||
      item.kind === "bang" ||
      item.kind === "chrome" ||
      item.kind === "download";

    if (isUrlItem) {
      const rawUrl = item.url || (item.kind === "bookmark" ? "" : item.subtitle) || "";
      const { host, cleanUrl } = extractUrlParts(rawUrl);
      if (host) {
        fields.push({ text: host, weight: 0.94, prepared: null });
      }
      if (cleanUrl && cleanUrl !== host) {
        fields.push({ text: cleanUrl, weight: 0.78, prepared: null });
      }
      if (wantsScheme && rawUrl) {
        fields.push({ text: rawUrl, weight: 0.85, prepared: null });
      }
      if (item.folder) {
        fields.push({ text: item.folder, weight: 0.78, prepared: null });
      }
      if (!rawUrl && item.subtitle) {
        fields.push({ text: item.subtitle, weight: 0.76, prepared: null });
      }
    } else if (item.subtitle && !item.ignoreSubtitleSearch) {
      fields.push({ text: item.subtitle, weight: 0.72, prepared: null });
    }

    if (item.searchText) {
      fields.push({
        text: item.searchText,
        weight: item.kind === "action" ? 0.88 : 0.76,
        prepared: null,
        // searchText is a synonym keyword bag: avoid stitching random subsequence letters across unrelated keywords
        options: { allowSubseq: false }
      });
    }

    let singleFieldBest = 0;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.prepared) f.prepared = prepareText(f.text);
      const s = fuzzyMatchPrepared(f.prepared, normQ, tokens, f.options).score;
      if (s > 0) {
        const weighted = Math.round(s * f.weight * 100) / 100;
        if (weighted > singleFieldBest) singleFieldBest = weighted;
      }
    }

    // Cross-field multi-token matching: e.g. "github pull" matching "github.com" in host + "Pull Requests" in title
    let crossFieldScore = 0;
    if (tokens.length > 1 && fields.length > 1) {
      let totalWeighted = 0;
      let allMatched = true;
      for (let ti = 0; ti < tokens.length; ti++) {
        const tok = tokens[ti];
        let bestTokScore = 0;
        for (let fi = 0; fi < fields.length; fi++) {
          const f = fields[fi];
          if (!f.prepared) f.prepared = prepareText(f.text);
          const s = singleTokenMatch(f.prepared, tok, null, f.options).score;
          if (s > 0) {
            const w = s * f.weight;
            if (w > bestTokScore) bestTokScore = w;
          }
        }
        if (bestTokScore === 0) {
          allMatched = false;
          break;
        }
        totalWeighted += bestTokScore;
      }
      if (allMatched) {
        crossFieldScore = Math.round((totalWeighted / tokens.length) * 0.94 * 100) / 100;
      }
    }

    return Math.max(singleFieldBest, crossFieldScore);
  }

  function computeFrecencyBoost(frecencyMap, itemId, now = Date.now()) {
    if (!frecencyMap || !itemId) return 0;
    const entry = frecencyMap[itemId];
    if (!entry || !entry.count) return 0;
    const ageDays = Math.max(0, (now - (entry.lastUsed || now)) / (1000 * 60 * 60 * 24));
    const decay = Math.pow(0.5, ageDays / 7);
    const boost = Math.min(18, Math.log2(entry.count + 1) * 6 * (0.4 + 0.6 * decay));
    return Math.round(boost * 100) / 100;
  }

  function analyzeTabs(tabs = [], activeTab = null, options = {}) {
    const windowTabs = tabs.filter((t) => t.currentWindow !== false);
    const targetTabs = windowTabs.length > 0 ? windowTabs : tabs;
    const now = Number.isFinite(Number(options?.now)) ? Number(options.now) : Date.now();
    const rawIdle = Number(options?.idleMinutes);
    const idleMinutes = Number.isFinite(rawIdle) && rawIdle > 0 ? Math.floor(rawIdle) : 60;
    const idleCutoff = now - idleMinutes * 60 * 1000;

    const idleTabIds = [];
    const discardableIdleTabIds = [];
    for (const t of targetTabs) {
      if (t.active || t.pinned || t.audible) continue;
      if (t.lastAccessed > 0 && t.lastAccessed <= idleCutoff) {
        idleTabIds.push(t.id);
        if (!t.discarded) {
          discardableIdleTabIds.push(t.id);
        }
      }
    }

    const discardableOtherTabIds = [];
    const archivableOtherTabIds = [];
    for (const t of targetTabs) {
      if (!t.active && !(activeTab && t.id === activeTab.id) && !t.pinned && !t.audible) {
        archivableOtherTabIds.push(t.id);
        if (!t.discarded) {
          discardableOtherTabIds.push(t.id);
        }
      }
    }

    const urlMap = new Map();
    for (const t of targetTabs) {
      if (!t.url || t.url.startsWith("chrome://") || t.url.startsWith("about:")) continue;
      const norm = normalizeUrlForDedup(t.url);
      if (!norm) continue;
      if (!urlMap.has(norm)) urlMap.set(norm, []);
      urlMap.get(norm).push(t);
    }

    const duplicateTabIds = [];
    for (const [, group] of urlMap.entries()) {
      if (group.length > 1) {
        const kept = group.find((t) => t.active) || group[0];
        for (const t of group) {
          if (t.id !== kept.id && !t.pinned) {
            duplicateTabIds.push(t.id);
          }
        }
      }
    }

    const activeDomain = activeTab ? extractHostname(activeTab.url) : "";
    const domainTabIds = [];
    if (activeDomain) {
      for (const t of targetTabs) {
        if (extractHostname(t.url) === activeDomain) {
          domainTabIds.push(t.id);
        }
      }
    }

    const suggestedGroupTitle = activeDomain ? suggestDomainGroupTitle(activeDomain) : "";

    const activeBaseDomain = activeTab ? extractBaseDomain(activeTab.url) : "";
    const baseDomainTabIds = [];
    if (activeBaseDomain) {
      for (const t of targetTabs) {
        if (extractBaseDomain(t.url) === activeBaseDomain) {
          baseDomainTabIds.push(t.id);
        }
      }
    }

    const baseDomainMap = new Map();
    const ungroupedBaseDomainMap = new Map();
    for (const t of targetTabs) {
      const bd = extractBaseDomain(t.url);
      if (!bd) continue;
      if (!baseDomainMap.has(bd)) {
        baseDomainMap.set(bd, []);
      }
      baseDomainMap.get(bd).push(t.id);

      if (!t.pinned && (t.groupId == null || t.groupId === -1)) {
        if (!ungroupedBaseDomainMap.has(bd)) {
          ungroupedBaseDomainMap.set(bd, []);
        }
        ungroupedBaseDomainMap.get(bd).push(t.id);
      }
    }

    const baseDomainGroups = [];
    for (const [baseDomain, tabIds] of baseDomainMap.entries()) {
      if (tabIds.length > 1) {
        baseDomainGroups.push({ baseDomain, tabIds, count: tabIds.length });
      }
    }
    baseDomainGroups.sort((a, b) => b.count - a.count);

    const ungroupedBaseDomainGroups = [];
    let autoGroupTabCount = 0;
    for (const [baseDomain, tabIds] of ungroupedBaseDomainMap.entries()) {
      if (tabIds.length >= 2) {
        ungroupedBaseDomainGroups.push({
          baseDomain,
          title: suggestDomainGroupTitle(baseDomain),
          tabIds,
          count: tabIds.length
        });
        autoGroupTabCount += tabIds.length;
      }
    }
    ungroupedBaseDomainGroups.sort((a, b) => b.count - a.count);

    const tabsToRightIds = [];
    const tabsToLeftIds = [];
    if (activeTab) {
      const activePos = targetTabs.findIndex((t) => t.id === activeTab.id);
      if (activePos !== -1) {
        const activeObj = targetTabs[activePos];
        const activeIdx =
          typeof activeTab.index === "number"
            ? activeTab.index
            : typeof activeObj.index === "number"
              ? activeObj.index
              : null;
        const allHaveIndex = activeIdx !== null && targetTabs.every((t) => typeof t.index === "number");
        if (allHaveIndex) {
          const rightTabs = targetTabs
            .filter((t) => !t.pinned && t.index > activeIdx)
            .sort((a, b) => a.index - b.index);
          const leftTabs = targetTabs
            .filter((t) => !t.pinned && t.index < activeIdx)
            .sort((a, b) => a.index - b.index);
          for (const t of rightTabs) tabsToRightIds.push(t.id);
          for (const t of leftTabs) tabsToLeftIds.push(t.id);
        } else {
          for (let i = 0; i < targetTabs.length; i++) {
            const t = targetTabs[i];
            if (t.pinned || i === activePos) continue;
            if (i > activePos) {
              tabsToRightIds.push(t.id);
            } else {
              tabsToLeftIds.push(t.id);
            }
          }
        }
      }
    }

    return {
      duplicateTabIds,
      duplicateCount: duplicateTabIds.length,
      activeDomain,
      domainTabIds,
      domainCount: domainTabIds.length,
      suggestedGroupTitle,
      activeBaseDomain,
      baseDomainTabIds,
      baseDomainCount: baseDomainTabIds.length,
      baseDomainGroups,
      ungroupedBaseDomainGroups,
      autoGroupTabCount,
      idleTabIds,
      idleCount: idleTabIds.length,
      idleMinutes,
      discardableIdleTabIds,
      discardableOtherTabIds,
      archivableOtherTabIds,
      tabsToRightIds,
      tabsToLeftIds
    };
  }

  function buildStaticActions(activeTab, analysis, contextData = {}) {
    const allTabs = Array.isArray(contextData) ? contextData : (contextData?.tabs || []);
    const windows = Array.isArray(contextData) ? [] : (contextData?.windows || []);
    const bookmarks = Array.isArray(contextData) ? [] : (contextData?.bookmarks || []);
    const tabGroupsList = Array.isArray(contextData) ? [] : (contextData?.tabGroups || []);
    const archivedTabsList = Array.isArray(contextData) ? [] : (contextData?.archivedTabs || []);
    const actions = [];

    const audibleTab = allTabs.find((t) => t.audible);
    if (audibleTab) {
      actions.push(
        {
          id: "act-jump-audio",
          kind: "action",
          section: "Actions",
          title: "Jump to Playing Audio Tab",
          subtitle: audibleTab.title || "Switch to playing audio tab",
          badge: "Audio",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "volume",
          enterVerb: "Switch",
          priority: 14.5,
          ignoreSubtitleSearch: true,
          searchText: "jump to playing audio tab sound",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "SWITCH_TAB", tabId: audibleTab.id, windowId: audibleTab.windowId }
          }
        },
        {
          id: "act-mute-audible",
          kind: "action",
          section: "Actions",
          title: "Mute All Audible Tabs",
          subtitle: "Mute all tabs currently playing audio",
          badge: "Audio",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "mute",
          enterVerb: "Mute",
          priority: 14,
          searchText: "mute all audible tabs sound silence",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "MUTE_AUDIBLE_TABS" }
          }
        }
      );
    }

    actions.push({
      id: "act-mute-others",
      kind: "action",
      section: "Actions",
      title: "Mute All Other Tabs",
      subtitle: "Mute all other unmuted tabs",
      badge: "Audio",
      badgeClass: "qc-badge-action",
      iconClass: "qc-icon-action",
      iconName: "mute",
      enterVerb: "Mute",
      priority: 10,
      searchText: "mute all other tabs unmuted",
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "MUTE_OTHER_TABS" }
      }
    });

    if (activeTab) {
      actions.push(
        {
          id: "act-reload",
          kind: "action",
          section: "Actions",
          title: "Reload Current Tab",
          subtitle: activeTab.title || "Reload page",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "rotateCcw",
          enterVerb: "Reload",
          priority: 9.5,
          ignoreSubtitleSearch: true,
          searchText: "reload refresh current tab page",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "RELOAD_TAB", tabId: activeTab.id, bypassCache: false }
          }
        },
        {
          id: "act-hard-reload",
          kind: "action",
          section: "Actions",
          title: "Hard Reload Current Tab (Bypass Cache)",
          subtitle: activeTab.title || "Reload page bypassing cache",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "rotateCcw",
          enterVerb: "Hard Reload",
          priority: 9.4,
          ignoreSubtitleSearch: true,
          searchText: "hard reload refresh bypass cache force",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "RELOAD_TAB", tabId: activeTab.id, bypassCache: true }
          }
        },
        {
          id: "act-group-picker",
          kind: "action",
          section: "Actions",
          title: "Add Current Tab to Group…",
          subtitle: "Assign to an existing group or create a new colored group (⌘G)",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "layers",
          enterVerb: "Choose",
          priority: 12.5,
          keepsOpen: true,
          searchText: "group current tab add assign create colored group",
          actionDescriptor: {
            type: "OPEN_GROUP_PICKER",
            tabIds: [activeTab.id],
            defaultTitle: analysis.suggestedGroupTitle || "Group"
          }
        },
        ...(activeTab.groupId !== undefined && activeTab.groupId !== -1
          ? (() => {
              const currentGroup = (contextData?.tabGroups || []).find((g) => g.id === activeTab.groupId);
              const groupTabs = allTabs.filter((t) => t.groupId === activeTab.groupId);
              const groupTitle = currentGroup?.title || "Current Group";
              return [
                {
                  id: "act-new-tab-in-group",
                  kind: "action",
                  section: "Actions",
                  title: "New Tab in Current Group",
                  subtitle: currentGroup ? `Open a new tab inside "${currentGroup.title}"` : "Open a new tab in the active tab's group",
                  badge: "Group",
                  badgeClass: "qc-badge-group",
                  iconClass: "qc-icon-group",
                  iconName: "layers",
                  enterVerb: "Open",
                  priority: 11.5,
                  searchText: "new tab in current group open blank tab group",
                  actionDescriptor: {
                    type: "EXECUTE_ACTION",
                    payload: { action: "NEW_TAB_IN_GROUP", groupId: activeTab.groupId, windowId: activeTab.windowId }
                  }
                },
                {
                  id: "act-copy-group-markdown",
                  kind: "action",
                  section: "Actions",
                  title: `Copy Current Group Tabs as Markdown (${groupTabs.length})`,
                  subtitle: `Copy all tabs in "${groupTitle}" as a Markdown list`,
                  badge: "Group",
                  badgeClass: "qc-badge-group",
                  iconClass: "qc-icon-group",
                  iconName: "copy",
                  enterVerb: "Copy",
                  priority: 11.2,
                  searchText: "copy current group tabs as markdown list export",
                  actionDescriptor: {
                    type: "COPY_TEXT",
                    text: formatTabList(groupTabs, "markdown"),
                    toast: `Copied ${groupTabs.length} group tabs as Markdown`
                  }
                },
                {
                  id: "act-copy-group-urls",
                  kind: "action",
                  section: "Actions",
                  title: `Copy Current Group Tab URLs (${groupTabs.length})`,
                  subtitle: `Copy clean URLs for all tabs in "${groupTitle}"`,
                  badge: "Group",
                  badgeClass: "qc-badge-group",
                  iconClass: "qc-icon-group",
                  iconName: "link",
                  enterVerb: "Copy",
                  priority: 11.15,
                  searchText: "copy current group tab urls links list export",
                  actionDescriptor: {
                    type: "COPY_TEXT",
                    text: formatTabList(groupTabs, "clean-urls"),
                    toast: `Copied ${groupTabs.length} group tab URLs`
                  }
                },
                {
                  id: "act-bookmark-group",
                  kind: "action",
                  section: "Actions",
                  title: "Save Current Group to Bookmarks",
                  subtitle: `Save all ${groupTabs.length} tabs in "${groupTitle}" into a bookmark folder`,
                  badge: "Bookmark",
                  badgeClass: "qc-badge-bookmark",
                  iconClass: "qc-icon-bookmark",
                  iconName: "star",
                  enterVerb: "Save",
                  priority: 11.1,
                  searchText: "save export current tab group to bookmark folder archive",
                  actionDescriptor: {
                    type: "EXECUTE_ACTION",
                    payload: { action: "BOOKMARK_TAB_GROUP", groupId: activeTab.groupId }
                  }
                },
                {
                  id: "act-discard-group",
                  kind: "action",
                  section: "Actions",
                  title: `Unload Current Group Tabs (${groupTabs.length})`,
                  subtitle: `Sleep inactive tabs in "${groupTitle}" to free browser memory`,
                  badge: "Memory",
                  badgeClass: "qc-badge-action",
                  iconClass: "qc-icon-action",
                  iconName: "moon",
                  enterVerb: "Unload",
                  priority: 11.08,
                  searchText: "unload suspend sleep discard current tab group memory saver",
                  actionDescriptor: {
                    type: "EXECUTE_ACTION",
                    payload: { action: "DISCARD_GROUP_TABS", groupId: activeTab.groupId }
                  }
                },
                {
                  id: "act-archive-group",
                  kind: "action",
                  section: "Actions",
                  title: `Archive Current Group (${groupTabs.length})`,
                  subtitle: `Save all tabs in "${groupTitle}" to Archived Tabs (/a) and close them`,
                  badge: "Archive",
                  badgeClass: "qc-badge-archived",
                  iconClass: "qc-icon-archived",
                  iconName: "archive",
                  enterVerb: "Archive",
                  priority: 11.06,
                  searchText: "archive current tab group close save like arc memory",
                  actionDescriptor: {
                    type: "EXECUTE_ACTION",
                    payload: { action: "ARCHIVE_GROUP_TABS", groupId: activeTab.groupId }
                  }
                },
                {
                  id: "act-ungroup",
                  kind: "action",
                  section: "Actions",
                  title: "Ungroup Current Tab",
                  subtitle: "Remove this tab from its tab group",
                  badge: "Action",
                  badgeClass: "qc-badge-action",
                  iconClass: "qc-icon-action",
                  iconName: "layers",
                  enterVerb: "Run",
                  priority: 11,
                  searchText: "ungroup current tab remove from group",
                  actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "UNGROUP_CURRENT_TAB" } }
                }
              ];
            })()
          : []),
        {
          id: "act-pin",
          kind: "action",
          section: "Actions",
          title: activeTab.pinned ? "Unpin Current Tab" : "Pin Current Tab",
          subtitle: activeTab.title || "Current tab",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "pin",
          enterVerb: "Run",
          priority: 10,
          ignoreSubtitleSearch: true,
          searchText: "pin unpin current tab",
          actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "PIN_TAB", tabId: activeTab.id } }
        },
        {
          id: "act-mute",
          kind: "action",
          section: "Actions",
          title: activeTab.muted ? "Unmute Current Tab" : "Mute Current Tab",
          subtitle: activeTab.title || "Current tab",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: activeTab.muted ? "volume" : "mute",
          enterVerb: "Run",
          priority: 10,
          ignoreSubtitleSearch: true,
          searchText: "mute unmute current tab audio sound silence",
          actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "MUTE_TAB", tabId: activeTab.id } }
        },
        {
          id: "act-dup",
          kind: "action",
          section: "Actions",
          title: "Duplicate Current Tab",
          subtitle: activeTab.url || "",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "copy",
          enterVerb: "Run",
          priority: 10,
          ignoreSubtitleSearch: true,
          searchText: "duplicate clone copy current tab",
          actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "DUPLICATE_TAB", tabId: activeTab.id } }
        },
        {
          id: "act-copy-url",
          kind: "action",
          section: "Actions",
          title: "Copy Current Page URL",
          subtitle: activeTab.url || "",
          badge: "Action",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "link",
          enterVerb: "Copy",
          priority: 10,
          ignoreSubtitleSearch: true,
          searchText: "copy current page url link address clipboard",
          actionDescriptor: { type: "COPY_TEXT", text: activeTab.url || "" }
        }
      );

      if (activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
        const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);
        actions.push(
          {
            id: "act-toggle-bookmark",
            kind: "action",
            section: "Actions",
            title: isBookmarked ? "Remove Current Page Bookmark" : "Bookmark Current Page",
            subtitle: activeTab.url,
            badge: "Bookmark",
            badgeClass: "qc-badge-bookmark",
            iconClass: "qc-icon-bookmark",
            iconName: "star",
            enterVerb: isBookmarked ? "Remove" : "Bookmark",
            priority: 9.8,
            ignoreSubtitleSearch: true,
            searchText: isBookmarked
              ? "remove bookmark unbookmark current page"
              : "bookmark current page save star",
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "TOGGLE_BOOKMARK", url: activeTab.url, title: activeTab.title }
            }
          },
          {
            id: "act-copy-markdown",
            kind: "action",
            section: "Actions",
            title: "Copy Current Page as Markdown",
            subtitle: formatMarkdownLink(activeTab.title || activeTab.url, activeTab.url),
            badge: "Action",
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "copy",
            enterVerb: "Copy",
            priority: 9.7,
            ignoreSubtitleSearch: true,
            searchText: "copy current page as markdown link md",
            actionDescriptor: {
              type: "COPY_TEXT",
              text: formatMarkdownLink(activeTab.title || activeTab.url, activeTab.url),
              toast: "Copied Markdown link to clipboard"
            }
          },
          {
            id: "act-copy-clean-url",
            kind: "action",
            section: "Actions",
            title: "Copy Clean URL",
            subtitle: stripTrackingParams(activeTab.url),
            badge: "Action",
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "link",
            enterVerb: "Copy",
            priority: 9.6,
            ignoreSubtitleSearch: true,
            searchText: "copy clean url strip tracking utm params",
            actionDescriptor: {
              type: "COPY_TEXT",
              text: stripTrackingParams(activeTab.url),
              toast: "Copied clean URL to clipboard"
            }
          },
          {
            id: "act-open-incognito",
            kind: "action",
            section: "Actions",
            title: "Open Current Page in Incognito",
            subtitle: activeTab.url,
            badge: "Incognito",
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "incognito",
            enterVerb: "Open",
            priority: 9.2,
            ignoreSubtitleSearch: true,
            searchText: "open current page in incognito private window",
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_IN_INCOGNITO", url: activeTab.url }
            }
          }
        );
      }

      if (activeTab?.splitViewId != null && activeTab.splitViewId !== -1) {
        actions.push({
          id: "act-unsplit-tab",
          kind: "action",
          section: "Actions",
          title: "Unsplit Current Tab",
          subtitle: "Separate the current native Split View into normal tabs",
          badge: "Window",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "split",
          enterVerb: "Unsplit",
          priority: 9.45,
          searchText: "unsplit current tab separate split view",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "UNSPLIT_TAB", splitViewId: activeTab.splitViewId }
          }
        });
      }

      if (allTabs.length >= 2) {
        actions.push({
          id: "act-split-tabs",
          kind: "action",
          section: "Actions",
          title: "Split Tabs…",
          subtitle: `Tile 2 or more open tabs side-by-side or in a grid (${allTabs.length} open)`,
          badge: "Window",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "split",
          enterVerb: "Choose",
          priority: 9.4,
          keepsOpen: true,
          searchText: "split tabs tile view side by side grid multiple windows",
          actionDescriptor: {
            type: "OPEN_SPLIT_PICKER",
            tabIds: activeTab?.id != null ? [activeTab.id] : []
          }
        });
      }

      if (windows.length > 1) {
        actions.push(
          {
            id: "act-move-window-picker",
            kind: "action",
            section: "Actions",
            title: "Move Current Tab to Window…",
            subtitle: `Select from ${windows.length - 1} other open window(s)`,
            badge: "Window",
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "window",
            enterVerb: "Choose",
            priority: 9.3,
            keepsOpen: true,
            searchText: "move current tab to window picker",
            actionDescriptor: {
              type: "OPEN_WINDOW_PICKER",
              tabId: activeTab.id
            }
          },
          {
            id: "act-merge-windows",
            kind: "action",
            section: "Actions",
            title: "Merge All Windows into Current",
            subtitle: `Combine tabs from all ${windows.length} windows into this window`,
            badge: "Window",
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "window",
            enterVerb: "Merge",
            priority: 9.1,
            searchText: "merge all windows into current combine",
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "MERGE_ALL_WINDOWS" }
            }
          }
        );
      }

      const ungroupedUnpinnedCount = allTabs.filter(
        (t) => !t.pinned && (t.groupId == null || t.groupId < 0)
      ).length;
      if (tabGroupsList.length > 0 && (windows.length > 1 || ungroupedUnpinnedCount > 0)) {
        actions.push({
          id: "act-consolidate-groups",
          kind: "action",
          section: "Actions",
          title: "Consolidate Groups Here & Separate Ungrouped Tabs",
          subtitle: `Keep ${tabGroupsList.length} group(s) in this window and move ${ungroupedUnpinnedCount} unpinned, ungrouped tab(s) to another window`,
          badge: "Window",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "layers",
          enterVerb: "Organize",
          priority: 9.15,
          searchText: "consolidate groups here separate unpinned ungrouped tabs another window organize",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "CONSOLIDATE_GROUPS_AND_SEPARATE_TABS" }
          }
        });
      }

      const tabsToRightIds = analysis?.tabsToRightIds || [];
      if (tabsToRightIds.length > 0) {
        actions.push({
          id: "act-close-tabs-right",
          kind: "action",
          section: "Actions",
          title: `Close Tabs to the Right (${tabsToRightIds.length})`,
          subtitle: `Close ${tabsToRightIds.length} unpinned ${tabsToRightIds.length === 1 ? "tab" : "tabs"} to the right of the current tab`,
          badge: "Cleanup",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "x",
          enterVerb: "Close",
          priority: 9.22,
          searchText: "close tabs to the right after current tab cleanup",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "CLOSE_TABS_TO_RIGHT" }
          }
        });
      }
    }

    const currentWindowTabs = allTabs.filter((t) => t.currentWindow !== false);
    const windowTabs = currentWindowTabs.length > 0 ? currentWindowTabs : allTabs;
    if (windowTabs.length > 0) {
      actions.push(
        {
          id: "act-copy-window-markdown",
          kind: "action",
          section: "Actions",
          title: `Copy All Window Tabs as Markdown (${windowTabs.length})`,
          subtitle: `Copy ${windowTabs.length} open ${windowTabs.length === 1 ? "tab" : "tabs"} as a Markdown bullet list`,
          badge: "Copy",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "copy",
          enterVerb: "Copy",
          priority: 9.35,
          searchText: "copy all window tabs as markdown list links export share",
          actionDescriptor: {
            type: "COPY_TEXT",
            text: formatTabList(windowTabs, "markdown"),
            toast: `Copied ${windowTabs.length} tabs as Markdown`
          }
        },
        {
          id: "act-copy-window-urls",
          kind: "action",
          section: "Actions",
          title: `Copy All Window Tab URLs (${windowTabs.length})`,
          subtitle: `Copy ${windowTabs.length} clean tab URLs separated by newlines`,
          badge: "Copy",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "link",
          enterVerb: "Copy",
          priority: 9.25,
          searchText: "copy all window tab urls links list export",
          actionDescriptor: {
            type: "COPY_TEXT",
            text: formatTabList(windowTabs, "clean-urls"),
            toast: `Copied ${windowTabs.length} tab URLs`
          }
        }
      );
    }

    const ungroupedBaseDomainGroups = analysis?.ungroupedBaseDomainGroups || [];
    if (ungroupedBaseDomainGroups.length > 0) {
      actions.push({
        id: "act-auto-group-domains",
        kind: "action",
        section: "Actions",
        title: `Auto-Group Ungrouped Tabs by Website (${analysis.autoGroupTabCount} tabs in ${ungroupedBaseDomainGroups.length} ${ungroupedBaseDomainGroups.length === 1 ? "group" : "groups"})`,
        subtitle: `Automatically group ungrouped tabs sharing a website (${ungroupedBaseDomainGroups.slice(0, 3).map((g) => g.title).join(", ")}${ungroupedBaseDomainGroups.length > 3 ? "…" : ""})`,
        badge: "Organize",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "layers",
        enterVerb: "Auto-Group",
        priority: 13.2,
        searchText: "auto group all ungrouped tabs by website domain organize cluster",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "AUTO_GROUP_BY_DOMAIN" }
        }
      });
    }

    const currentWindowGroups = tabGroupsList.filter((g) => g.currentWindow !== false);
    const expandedGroupsCount = currentWindowGroups.filter((g) => !g.collapsed).length;
    const collapsedGroupsCount = currentWindowGroups.filter((g) => Boolean(g.collapsed)).length;

    if (expandedGroupsCount > 0) {
      actions.push({
        id: "act-fold-tab-groups",
        kind: "action",
        section: "Actions",
        title: "Fold All Tab Groups",
        subtitle: `Collapse ${expandedGroupsCount} expanded tab group(s) in this window`,
        badge: "Group",
        badgeClass: "qc-badge-group",
        iconClass: "qc-icon-group",
        iconName: "layers",
        enterVerb: "Fold",
        priority: 11.4,
        searchText: "fold collapse minimize hide all tab groups",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "FOLD_ALL_TAB_GROUPS" }
        }
      });
    }

    if (collapsedGroupsCount > 0) {
      actions.push({
        id: "act-unfold-tab-groups",
        kind: "action",
        section: "Actions",
        title: "Unfold All Tab Groups",
        subtitle: `Expand ${collapsedGroupsCount} folded tab group(s) in this window`,
        badge: "Group",
        badgeClass: "qc-badge-group",
        iconClass: "qc-icon-group",
        iconName: "layers",
        enterVerb: "Unfold",
        priority: 11.3,
        searchText: "unfold expand open show all tab groups",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "UNFOLD_ALL_TAB_GROUPS" }
        }
      });
    }

    if (analysis.activeDomain && analysis.domainCount > 1) {
      actions.push(
        {
          id: "act-group-domain",
          kind: "action",
          section: "Actions",
          title: `Group All ${analysis.activeDomain} Tabs (${analysis.domainCount})…`,
          subtitle: `Assign all ${analysis.domainCount} tabs from ${analysis.activeDomain} into a group`,
          badge: "Domain",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "layers",
          enterVerb: "Group",
          priority: 13.5,
          keepsOpen: true,
          searchText: `group all domain tabs ${analysis.activeDomain}`,
          actionDescriptor: {
            type: "OPEN_GROUP_PICKER",
            tabIds: analysis.domainTabIds,
            defaultTitle: analysis.suggestedGroupTitle || analysis.activeDomain,
            domain: analysis.activeDomain
          }
        },
        {
          id: "act-close-domain",
          kind: "action",
          section: "Actions",
          title: `Close All ${analysis.activeDomain} Tabs (${analysis.domainCount})`,
          subtitle: `Closes all ${analysis.domainCount} unpinned tabs from ${analysis.activeDomain} in this window`,
          badge: "Domain",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "x",
          enterVerb: "Close",
          priority: 11.5,
          searchText: `close all domain tabs ${analysis.activeDomain}`,
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "CLOSE_DOMAIN_TABS", domain: analysis.activeDomain }
          }
        }
      );
    }

    if (analysis.activeBaseDomain && analysis.baseDomainCount > 1 && analysis.baseDomainCount > analysis.domainCount) {
      actions.push(
        {
          id: "act-group-base-domain",
          kind: "action",
          section: "Actions",
          title: `Group All ${analysis.activeBaseDomain} Website Tabs (${analysis.baseDomainCount})…`,
          subtitle: `Assign all ${analysis.baseDomainCount} tabs across *.${analysis.activeBaseDomain} into a group`,
          badge: "Website",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "layers",
          enterVerb: "Group",
          priority: 13.6,
          keepsOpen: true,
          searchText: `group all base website domain tabs ${analysis.activeBaseDomain}`,
          actionDescriptor: {
            type: "OPEN_GROUP_PICKER",
            tabIds: analysis.baseDomainTabIds,
            defaultTitle: analysis.suggestedGroupTitle || analysis.activeBaseDomain,
            domain: analysis.activeBaseDomain
          }
        },
        {
          id: "act-close-base-domain",
          kind: "action",
          section: "Actions",
          title: `Close All ${analysis.activeBaseDomain} Website Tabs (${analysis.baseDomainCount})`,
          subtitle: `Closes all ${analysis.baseDomainCount} unpinned tabs across *.${analysis.activeBaseDomain} in this window`,
          badge: "Website",
          badgeClass: "qc-badge-action",
          iconClass: "qc-icon-action",
          iconName: "x",
          enterVerb: "Close",
          priority: 11.6,
          searchText: `close all base website domain tabs ${analysis.activeBaseDomain}`,
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: analysis.activeBaseDomain }
          }
        }
      );
    }

    if (analysis.baseDomainGroups && analysis.baseDomainGroups.length) {
      for (const bg of analysis.baseDomainGroups) {
        if (bg.baseDomain && bg.baseDomain !== analysis.activeBaseDomain && bg.count > 1) {
          actions.push({
            id: `act-close-site-${bg.baseDomain}`,
            kind: "action",
            section: "Actions",
            title: `Close All ${bg.baseDomain} Website Tabs (${bg.count})`,
            subtitle: `Closes all ${bg.count} unpinned tabs from ${bg.baseDomain} in this window`,
            badge: "Website",
            badgeClass: "qc-badge-action",
            iconClass: "qc-icon-action",
            iconName: "x",
            enterVerb: "Close",
            priority: 9.2,
            searchText: `close all base website domain tabs ${bg.baseDomain}`,
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: bg.baseDomain }
            }
          });
        }
      }
    }

    const discardableIdleTabIds = analysis?.discardableIdleTabIds || [];
    const discardableOtherTabIds = analysis?.discardableOtherTabIds || [];
    const archivableOtherTabIds = analysis?.archivableOtherTabIds || [];
    const idleTabIds = analysis?.idleTabIds || [];
    const idleMinutes = analysis?.idleMinutes ?? 60;

    if (activeTab && windowTabs.length > 1) {
      actions.push({
        id: "act-discard-current",
        kind: "action",
        section: "Actions",
        title: "Unload Current Tab (Save Memory)",
        subtitle: "Switch away and put the current tab to sleep without closing it",
        badge: "Memory",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "moon",
        enterVerb: "Unload",
        priority: 9.18,
        searchText: "unload suspend sleep discard hibernate current tab memory saver arc",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "DISCARD_TAB", tabId: activeTab.id }
        }
      });
    }

    if (activeTab && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
      actions.push({
        id: "act-archive-current",
        kind: "action",
        section: "Actions",
        title: "Archive Current Tab",
        subtitle: "Save to Archived Tabs (/a) and close to free memory (like Arc)",
        badge: "Archive",
        badgeClass: "qc-badge-archived",
        iconClass: "qc-icon-archived",
        iconName: "archive",
        enterVerb: "Archive",
        priority: 9.19,
        searchText: "archive current tab save close arc memory unload",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "ARCHIVE_TAB", tabId: activeTab.id }
        }
      });
    }

    actions.push(
      {
        id: "act-discard-idle",
        kind: "action",
        section: "Actions",
        title:
          discardableIdleTabIds.length > 0
            ? `Suspend Idle Tabs (${discardableIdleTabIds.length})`
            : "Suspend Idle Tabs (Memory Saver)",
        subtitle:
          discardableIdleTabIds.length > 0
            ? `Unload ${discardableIdleTabIds.length} inactive ${discardableIdleTabIds.length === 1 ? "tab" : "tabs"} (${idleMinutes}+ min) to free memory without closing`
            : `Free memory by unloading tabs inactive for ${idleMinutes}+ min without closing them`,
        badge: discardableIdleTabIds.length > 0 ? `${discardableIdleTabIds.length} Idle` : "Memory",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "moon",
        enterVerb: "Suspend",
        priority: discardableIdleTabIds.length > 0 ? 13.8 : 9.1,
        searchText: "unload suspend discard idle tabs sleep memory saver hibernate arc",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "DISCARD_IDLE_TABS", idleMinutes }
        }
      },
      {
        id: "act-discard-others",
        kind: "action",
        section: "Actions",
        title:
          discardableOtherTabIds.length > 0
            ? `Suspend Other Background Tabs (${discardableOtherTabIds.length})`
            : "Suspend Other Background Tabs",
        subtitle: "Free memory by unloading all other non-audible background tabs in this window",
        badge: "Memory",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "moon",
        enterVerb: "Suspend",
        priority: 9.05,
        searchText: "unload suspend discard other background tabs sleep memory saver hibernate arc",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "DISCARD_OTHER_TABS" }
        }
      },
      {
        id: "act-archive-idle",
        kind: "action",
        section: "Actions",
        title:
          idleTabIds.length > 0
            ? `Archive Idle Tabs (${idleTabIds.length})`
            : "Archive Idle Tabs (Like Arc)",
        subtitle:
          idleTabIds.length > 0
            ? `Save ${idleTabIds.length} inactive ${idleTabIds.length === 1 ? "tab" : "tabs"} (${idleMinutes}+ min) to /a and close to free memory`
            : `Archive tabs inactive for ${idleMinutes}+ min into /a and close them`,
        badge: idleTabIds.length > 0 ? `${idleTabIds.length} Idle` : "Archive",
        badgeClass: "qc-badge-archived",
        iconClass: "qc-icon-archived",
        iconName: "archive",
        enterVerb: "Archive",
        priority: idleTabIds.length > 0 ? 13.7 : 9.08,
        searchText: "archive idle stale unused tabs like arc save close memory /a",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "ARCHIVE_IDLE_TABS", idleMinutes }
        }
      },
      {
        id: "act-archive-others",
        kind: "action",
        section: "Actions",
        title:
          archivableOtherTabIds.length > 0
            ? `Archive Other Background Tabs (${archivableOtherTabIds.length})`
            : "Archive Other Background Tabs",
        subtitle: "Save all other unpinned background tabs to /a and close them to free memory",
        badge: "Archive",
        badgeClass: "qc-badge-archived",
        iconClass: "qc-icon-archived",
        iconName: "archive",
        enterVerb: "Archive",
        priority: 9.02,
        searchText: "archive other background tabs like arc save close memory /a",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "ARCHIVE_OTHER_TABS" }
        }
      },
      {
        id: "act-view-archived",
        kind: "action",
        section: "Actions",
        title:
          archivedTabsList.length > 0
            ? `View Archived Tabs (${archivedTabsList.length})…`
            : "View Archived Tabs…",
        subtitle: "Browse and restore archived tabs (/a)",
        badge: "Archive",
        badgeClass: "qc-badge-archived",
        iconClass: "qc-icon-archived",
        iconName: "archive",
        enterVerb: "Browse",
        priority: archivedTabsList.length > 0 ? 10.6 : 8.6,
        keepsOpen: true,
        searchText: "view browse restore archived tabs archive /a arc",
        actionDescriptor: { type: "ENTER_MODE", prefix: "/a " }
      },
      ...(archivedTabsList.length > 0
        ? [
            {
              id: "act-clear-archived",
              kind: "action",
              section: "Actions",
              title: `Clear Archived Tabs (${archivedTabsList.length})`,
              subtitle: "Permanently remove all tabs saved in Archived Tabs (/a)",
              badge: "Archive",
              badgeClass: "qc-badge-archived",
              iconClass: "qc-icon-archived",
              iconName: "x",
              enterVerb: "Clear",
              priority: 7.9,
              searchText: "clear delete empty archived tabs archive /a",
              actionDescriptor: {
                type: "EXECUTE_ACTION",
                payload: { action: "CLEAR_ARCHIVED_TABS" }
              }
            }
          ]
        : []),
      {
        id: "act-sort-tabs",
        kind: "action",
        section: "Actions",
        title: "Sort Tabs by Website",
        subtitle: "Order unpinned tabs in this window alphabetically by website and title",
        badge: "Organize",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "layers",
        enterVerb: "Sort",
        priority: 9.12,
        searchText: "sort order arrange tabs by website domain title alphabetically",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "SORT_TABS_BY_DOMAIN" }
        }
      },
      {
        id: "act-close-dups",
        kind: "action",
        section: "Actions",
        title: analysis.duplicateCount > 0 ? `Close Duplicate Tabs (${analysis.duplicateCount})` : "Close Duplicate Tabs",
        subtitle:
          analysis.duplicateCount > 0
            ? `Remove ${analysis.duplicateCount} duplicate ${analysis.duplicateCount === 1 ? "tab" : "tabs"} in this window`
            : "Scan and close duplicate URLs in this window",
        badge: analysis.duplicateCount > 0 ? `${analysis.duplicateCount} Dups` : "Cleanup",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "x",
        enterVerb: "Clean Up",
        priority: analysis.duplicateCount > 0 ? 15 : 9.5,
        searchText: "close duplicate tabs dedup cleanup duplicates",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "CLOSE_DUPLICATE_TABS" }
        }
      },
      {
        id: "act-close-idle",
        kind: "action",
        section: "Actions",
        title: analysis.idleCount > 0 ? `Close Idle Tabs (${analysis.idleCount})` : "Close Idle Tabs",
        subtitle:
          analysis.idleCount > 0
            ? `Close ${analysis.idleCount} unpinned ${analysis.idleCount === 1 ? "tab" : "tabs"} inactive for ${analysis.idleMinutes}+ min`
            : `No unpinned tabs inactive for ${analysis.idleMinutes}+ min`,
        badge: analysis.idleCount > 0 ? `${analysis.idleCount} Idle` : "Cleanup",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "x",
        enterVerb: "Clean Up",
        priority: analysis.idleCount > 0 ? 14 : 9.2,
        searchText: "close idle tabs inactive stale unused cleanup",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "CLOSE_IDLE_TABS", idleMinutes: analysis.idleMinutes }
        }
      },
      {
        id: "act-close-others",
        kind: "action",
        section: "Actions",
        title: "Close Other Unpinned Tabs",
        subtitle: "Closes all other unpinned tabs in this window",
        badge: "Action",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "x",
        enterVerb: "Run",
        priority: 9,
        searchText: "close other unpinned tabs cleanup",
        actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "CLOSE_OTHER_TABS" } }
      },
      {
        id: "act-move-win",
        kind: "action",
        section: "Actions",
        title: "Move Current Tab to New Window",
        subtitle: activeTab?.title || "Move active tab into its own window",
        badge: "Action",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "window",
        enterVerb: "Run",
        priority: 9,
        ignoreSubtitleSearch: true,
        searchText: "move detach pop out current tab to new window",
        actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "MOVE_TAB_NEW_WINDOW" } }
      },
      {
        id: "act-switch-theme",
        kind: "action",
        section: "Actions",
        title: "Switch Chrome Theme…",
        subtitle: "Browse and activate installed Chrome themes (/t)",
        badge: "Themes",
        badgeClass: "qc-badge-theme",
        iconClass: "qc-icon-theme",
        iconName: "palette",
        enterVerb: "Browse",
        priority: 10.5,
        keepsOpen: true,
        searchText: "switch chrome theme appearance silk twilight /t",
        actionDescriptor: { type: "ENTER_MODE", prefix: "/t " }
      },
      {
        id: "act-incognito",
        kind: "action",
        section: "Actions",
        title: "New Incognito Window",
        subtitle: "Open a private browsing window",
        badge: "Action",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-action",
        iconName: "incognito",
        enterVerb: "Run",
        priority: 8.5,
        searchText: "new incognito private browsing window",
        actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "NEW_INCOGNITO" } }
      },
      {
        id: "act-manage-links",
        kind: "action",
        section: "Actions",
        title: "Manage Quick Links & Bangs",
        subtitle: "Add or edit custom bang shortcuts (e.g. gh, yt, gm)",
        badge: "Settings",
        badgeClass: "qc-badge-action",
        iconClass: "qc-icon-bang",
        iconName: "zap",
        enterVerb: "Open",
        priority: 8.5,
        searchText: "manage quick links bangs shortcuts settings options preferences",
        actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "OPEN_OPTIONS" } }
      },
      (() => {
        const isSidebar = Boolean(!Array.isArray(contextData) && contextData?.verticalSidebar);
        return {
          id: "act-toggle-vertical-sidebar",
          kind: "action",
          section: "Actions",
          title: isSidebar ? "Switch to Centered Palette" : "Switch to Vertical Sidebar",
          subtitle: isSidebar
            ? "Restore the default centered command palette modal"
            : "Dock Cue as a full-height vertical sidebar",
          badge: "Layout",
          badgeClass: "qc-badge-chrome",
          iconClass: "qc-icon-chrome",
          iconName: "sidebar",
          enterVerb: isSidebar ? "Center" : "Dock",
          priority: 8,
          searchText: "toggle vertical sidebar panel dock layout centered modal",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "TOGGLE_VERTICAL_SIDEBAR" }
          }
        };
      })(),
      {
        id: "act-report-issue",
        kind: "action",
        section: "Actions",
        title: "Report Issue / Request Feature on GitHub",
        subtitle: ISSUES_URL,
        badge: "Issues",
        badgeClass: "qc-badge-chrome",
        iconClass: "qc-icon-chrome",
        iconName: "bug",
        enterVerb: "Open",
        priority: 7.7,
        ignoreSubtitleSearch: true,
        searchText: "report bug issue feedback feature request github help support cue",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "OPEN_URL", url: ISSUES_URL }
        }
      },
      {
        id: "act-open-repo",
        kind: "action",
        section: "Actions",
        title: "Cue on GitHub (Share / Star)",
        subtitle: REPO_URL,
        badge: "GitHub",
        badgeClass: "qc-badge-chrome",
        iconClass: "qc-icon-chrome",
        iconName: "github",
        enterVerb: "Open",
        priority: 7.6,
        ignoreSubtitleSearch: true,
        searchText: "cue github repo repository source code share extension star link about",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "OPEN_URL", url: REPO_URL }
        }
      },
      {
        id: "act-support-coffee",
        kind: "action",
        section: "Actions",
        title: "Support Cue (Buy Me a Coffee)",
        subtitle: SUPPORT_URL,
        badge: "Support",
        badgeClass: "qc-badge-chrome",
        iconClass: "qc-icon-chrome",
        iconName: "coffee",
        enterVerb: "Open",
        priority: 7.5,
        ignoreSubtitleSearch: true,
        searchText: "buy me a coffee support donate sponsor tip cue",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "OPEN_URL", url: SUPPORT_URL }
        }
      }
    );

    return actions;
  }

  function buildResults(data = {}, rawQuery = "", chipMode = "all") {
    const { mode, query, prefixLabel, isPrefix } = parseModeAndQuery(rawQuery, chipMode);
    const frecency = data.frecency || {};
    const now = Date.now();
    const analysis = analyzeTabs(data.tabs || [], data.activeTab || null, { now, idleMinutes: data.idleTabMinutes });
    const items = [];

    const groupById = new Map();
    for (const g of data.tabGroups || []) {
      if (g && g.id != null) groupById.set(g.id, g);
    }

    const tabs = (data.tabs || []).map((t, idx) => {
      const grp = t.groupId != null && t.groupId !== -1 ? groupById.get(t.groupId) : null;
      const statusParts = [];
      if (grp?.title) statusParts.push(grp.title);
      if (t.pinned) statusParts.push("pinned");
      if (t.audible) statusParts.push("playing audio sound");
      if (t.muted) statusParts.push("muted");
      if (t.discarded) statusParts.push("sleeping suspended unloaded");
      return {
        id: `tab-${t.id}`,
        kind: "tab",
        section: "Open Tabs (Recent)",
        tabId: t.id,
        windowId: t.windowId,
        groupId: t.groupId ?? -1,
        active: Boolean(t.active),
        title: t.title,
        subtitle: t.url,
        url: t.url || "",
        favIconUrl: t.favIconUrl,
        audible: Boolean(t.audible),
        muted: Boolean(t.muted),
        discarded: Boolean(t.discarded),
        pinned: Boolean(t.pinned),
        currentWindow: t.currentWindow,
        badge:
          t.active && t.currentWindow
            ? t.pinned
              ? "Pinned · Current"
              : "Current"
            : t.pinned
              ? "Pinned"
              : t.currentWindow
                ? "Tab"
                : "Other Window",
        badgeClass: "qc-badge-tab",
        iconClass: "qc-icon-tab",
        iconName: "globe",
        enterVerb: "Switch",
        priority: (t.currentWindow ? 24 : 14) + Math.max(0, 12 - idx) * 0.2,
        ...(statusParts.length ? { searchText: statusParts.join(" ") } : {}),
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "SWITCH_TAB", tabId: t.id, windowId: t.windowId }
        }
      };
    });

    const tabGroups = [];
    for (const g of data.tabGroups || []) {
      const dotColor = GROUP_COLOR_HEX[g.color] || GROUP_COLOR_HEX.grey;
      const winNote = g.currentWindow ? "Current window" : "Other window";
      const count = g.tabCount ?? g.count ?? 0;
      tabGroups.push({
        id: `grp-drill-${g.id}`,
        kind: "group",
        section: "Tab Groups",
        groupId: g.id,
        groupTitle: g.title,
        groupColor: dotColor,
        groupCollapsed: g.collapsed,
        title: `${g.title} (${count} ${count === 1 ? "tab" : "tabs"})`,
        subtitle: `${winNote} · ${g.collapsed ? "Collapsed — " : ""}Enter to view tabs in group`,
        badge: g.collapsed ? "Collapsed" : g.currentWindow ? "Group" : "Other Window",
        badgeClass: "",
        iconClass: "",
        customColor: dotColor,
        iconName: "layers",
        enterVerb: "View Tabs",
        keepsOpen: true,
        priority: g.currentWindow ? 16 : 13,
        searchText: `group ${g.title || ""} ${g.color || ""}`,
        actionDescriptor: {
          type: "DRILL_GROUP",
          group: { id: g.id, title: g.title, color: dotColor }
        }
      });
    }
    tabGroups.sort((a, b) => b.priority - a.priority);

    const closedTabs = (data.closedTabs || []).map((c) => ({
      id: `closed-${c.sessionId}`,
      kind: "closed",
      section: "Recently Closed",
      title: c.title,
      subtitle: c.url,
      url: c.url || "",
      favIconUrl: c.favIconUrl,
      badge: "Closed",
      badgeClass: "qc-badge-chrome",
      iconClass: "qc-icon-chrome",
      iconName: "rotateCcw",
      enterVerb: "Reopen",
      priority: 13,
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "RESTORE_SESSION", sessionId: c.sessionId }
      }
    }));

    const archivedTabs = (data.archivedTabs || []).map((a) => {
      const grpHex = a.groupColor ? GROUP_COLOR_HEX[a.groupColor] || "" : "";
      const ageLabel = formatRelativeTime(a.archivedAt, now);
      return {
        id: `archived-${a.id}`,
        kind: "archived",
        section: "Archived Tabs",
        archiveId: a.id,
        title: a.title || a.url || "Archived Tab",
        subtitle: a.url || "",
        url: a.url || "",
        favIconUrl: a.favIconUrl || "",
        archivedAt: a.archivedAt || 0,
        groupTitle: a.groupTitle || "",
        groupColor: grpHex || undefined,
        badge: a.groupTitle ? `${a.groupTitle} · ${ageLabel}` : ageLabel,
        badgeClass: "qc-badge-archived",
        iconClass: "qc-icon-archived",
        iconName: "archive",
        enterVerb: "Restore",
        priority: 12.5,
        searchText: `archived archive ${a.groupTitle || ""}`.trim(),
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "RESTORE_ARCHIVED_TAB", archiveId: a.id }
        }
      };
    });

    const quickLinks = [];
    const qParts = query.split(/\s+/);
    const firstWord = (qParts[0] || "").toLowerCase();
    const restQuery = qParts.slice(1).join(" ").trim();

    for (const ql of data.quickLinks || []) {
      const bangLower = (ql.bang || "").toLowerCase();
      if (query && bangLower && firstWord === bangLower && restQuery && ql.searchUrl) {
        const targetUrl = ql.searchUrl.replaceAll("{query}", encodeURIComponent(restQuery));
        quickLinks.push({
          id: `bang-search-${ql.bang}`,
          frecencyId: `ql-${ql.bang}-${ql.url}`,
          kind: "bang",
          section: "Quick Links",
          title: `Search ${ql.title} for "${restQuery}"`,
          subtitle: targetUrl,
          url: targetUrl,
          badge: `!${ql.bang}`,
          badgeClass: "qc-badge-bang",
          iconClass: "qc-icon-bang",
          iconName: "zap",
          enterVerb: "Search",
          priority: 200,
          forceScore: 200,
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "OPEN_URL", url: targetUrl }
          }
        });
      }

      const exactBang = query && bangLower && query.toLowerCase() === bangLower;
      quickLinks.push({
        id: `ql-${ql.bang}-${ql.url}`,
        kind: "bang",
        section: "Quick Links",
        title: ql.title,
        subtitle: ql.url || ql.subtitle || "",
        url: ql.url || "",
        badge: ql.bang ? `!${ql.bang}` : "Link",
        badgeClass: "qc-badge-bang",
        iconClass: "qc-icon-bang",
        iconName: "zap",
        enterVerb: "Open",
        priority: exactBang ? 180 : 14,
        forceScore: exactBang ? 180 : 0,
        searchText: `${ql.bang || ""} ${ql.title}`.trim(),
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "OPEN_URL", url: ql.url }
        }
      });
    }

    const actions = buildStaticActions(data.activeTab, analysis, data);

    const CHROME_PAGE_SYNONYMS = {
      "chrome-settings": "chrome settings preferences config options",
      "chrome-extensions": "chrome extensions addons plugins manage",
      "chrome-shortcuts": "chrome extension keyboard shortcuts hotkeys keybindings",
      "chrome-downloads": "chrome downloads files",
      "chrome-history": "chrome history recent pages",
      "chrome-bookmarks": "chrome bookmark manager favorites",
      "chrome-flags": "chrome flags experiments labs",
      "chrome-passwords": "chrome password manager credentials logins autofill"
    };

    const chromePages = (data.chromePages || []).map((p) => ({
      id: p.id,
      kind: "chrome",
      section: "Chrome Pages",
      title: p.title,
      subtitle: p.subtitle,
      url: p.url || "",
      badge: "Chrome",
      badgeClass: "qc-badge-chrome",
      iconClass: "qc-icon-chrome",
      iconName: "settings",
      enterVerb: "Open",
      priority: 8,
      ...(CHROME_PAGE_SYNONYMS[p.id] ? { searchText: CHROME_PAGE_SYNONYMS[p.id] } : {}),
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "OPEN_URL", url: p.url }
      }
    }));

    const bookmarks = (data.bookmarks || []).map((b) => ({
      id: b.id,
      kind: "bookmark",
      section: "Bookmarks",
      title: b.title,
      subtitle: b.folder ? `${b.folder} — ${b.url}` : b.url,
      url: b.url || "",
      folder: b.folder || "",
      badge: "Bookmark",
      badgeClass: "qc-badge-bookmark",
      iconClass: "qc-icon-bookmark",
      iconName: "star",
      enterVerb: "Open",
      priority: 6,
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "OPEN_URL", url: b.url }
      }
    }));

    const history = (data.history || []).map((h) => ({
      id: h.id,
      kind: "history",
      section: "History",
      title: h.title,
      subtitle: h.url,
      url: h.url || "",
      visitCount: h.visitCount || 0,
      badge: "History",
      badgeClass: "qc-badge-history",
      iconClass: "qc-icon-history",
      iconName: "history",
      enterVerb: "Open",
      priority: 4,
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "OPEN_URL", url: h.url }
      }
    }));

    const themes = (data.themes || []).map((t) => ({
      id: `theme-${t.id}`,
      kind: "theme",
      section: "Chrome Themes",
      themeId: t.id,
      title: t.name,
      subtitle: t.enabled
        ? "Active Chrome Theme · Press Enter to re-apply"
        : t.description || "Installed Chrome Theme · Press Enter to activate",
      badge: t.enabled ? "Active Theme" : "Theme",
      badgeClass: "qc-badge-theme",
      iconClass: "qc-icon-theme",
      iconName: "palette",
      enterVerb: "Activate",
      priority: t.enabled ? 11 : 9,
      searchText: `theme ${t.name} ${t.description || ""}`,
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "SWITCH_CHROME_THEME", themeId: t.id }
      }
    }));

    if ((data.themes && data.themes.length > 0) || mode === "themes") {
      themes.push({
        id: "theme-default",
        kind: "theme",
        section: "Chrome Themes",
        themeId: null,
        title: "Restore Default Chrome Theme",
        subtitle: "Disable active custom theme and return to default Chrome appearance",
        badge: "Reset",
        badgeClass: "qc-badge-theme",
        iconClass: "qc-icon-theme",
        iconName: "rotateCcw",
        enterVerb: "Restore",
        priority: 8.5,
        searchText: "theme restore default chrome reset appearance",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "SWITCH_CHROME_THEME", themeId: null }
        }
      });
    }

    // Theme & extension management is opt-in (optional `management` permission).
    // When it is off, replace theme rows with a single row that opens Options,
    // and likewise for /e extensions mode. `themesPermission` undefined (old
    // callers, tests) means allowed.
    if (data.themesPermission === false) {
      themes.length = 0;
      themes.push({
        id: "theme-enable-permission",
        kind: "theme",
        section: "Chrome Themes",
        title: "Enable Chrome Theme Switching",
        subtitle: "Optional permission — Cue lists and switches installed Chrome themes only with your consent. Press Enter to open Options.",
        badge: "Optional",
        badgeClass: "qc-badge-theme",
        iconClass: "qc-icon-theme",
        iconName: "palette",
        enterVerb: "Enable",
        priority: 9,
        searchText: "theme enable permission switch chrome theme appearance",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "OPEN_OPTIONS" }
        }
      });
    }

    const extensions =
      data.themesPermission === false
        ? [
            {
              id: "ext-enable-permission",
              kind: "extension",
              section: "Installed Extensions",
              title: "Enable Extension Management",
              subtitle: "Optional permission — Cue toggles installed extensions only with your consent. Press Enter to open Options.",
              badge: "Optional",
              badgeClass: "qc-badge-action",
              iconClass: "qc-icon-ext",
              iconName: "puzzle",
              enterVerb: "Enable",
              priority: 9,
              searchText: "extension enable permission manage toggle",
              actionDescriptor: {
                type: "EXECUTE_ACTION",
                payload: { action: "OPEN_OPTIONS" }
              }
            }
          ]
        : (data.extensions || []).map((ext) => ({
            id: `ext-${ext.id}`,
            kind: "extension",
            section: "Installed Extensions",
            extensionId: ext.id,
            title: ext.name,
            subtitle: ext.description
              ? `${ext.enabled ? "Enabled" : "Disabled"} · ${ext.description}`
              : `${ext.enabled ? "Enabled" : "Disabled"}${ext.version ? ` · v${ext.version}` : ""}`,
            badge: ext.enabled ? "Enabled" : "Disabled",
            badgeClass: ext.enabled ? "qc-badge-action" : "",
            iconClass: "qc-icon-ext",
            iconName: "puzzle",
            enterVerb: ext.enabled ? "Disable" : "Enable",
            priority: ext.enabled ? 10 : 8,
            optionsUrl: ext.optionsUrl || "",
            searchText: `extension ${ext.name} ${ext.description || ""} ${ext.version || ""}`,
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "TOGGLE_EXTENSION", extensionId: ext.id }
            }
          }));

    const downloads = (data.downloads || []).map((dl) => ({
      id: `dl-${dl.id}`,
      kind: "download",
      section: "Recent Downloads",
      downloadId: dl.id,
      title: dl.basename || dl.filename || "Downloaded File",
      subtitle: dl.filename || dl.url || "",
      downloadUrl: dl.url || "",
      badge: dl.state === "complete" ? "Download" : (dl.state || "Download"),
      badgeClass: "qc-badge-download",
      iconClass: "qc-icon-download",
      iconName: "download",
      enterVerb: "Open",
      priority: 6,
      searchText: `download ${dl.basename || ""} ${dl.filename || ""} ${dl.url || ""}`,
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "OPEN_DOWNLOAD", downloadId: dl.id }
      }
    }));

    const modeCounts = {
      all: tabs.length + tabGroups.length + closedTabs.length + archivedTabs.length + bookmarks.length + actions.length + chromePages.length + themes.length + extensions.length + downloads.length,
      tabs: tabs.length,
      groups: tabGroups.length,
      closed: closedTabs.length,
      archived: archivedTabs.length,
      bookmarks: bookmarks.length,
      history: history.length,
      commands: actions.length + chromePages.length + themes.length + extensions.length,
      themes: themes.length,
      extensions: extensions.length,
      downloads: downloads.length
    };

    let pool = [];
    if (mode === "commands") {
      pool = [...actions, ...chromePages, ...themes, ...extensions];
    } else if (mode === "tabs") {
      pool = tabs;
    } else if (mode === "groups") {
      pool = tabGroups;
    } else if (mode === "closed") {
      pool = closedTabs;
    } else if (mode === "archived") {
      pool = archivedTabs;
    } else if (mode === "bookmarks") {
      pool = bookmarks;
    } else if (mode === "history") {
      pool = history;
    } else if (mode === "themes") {
      pool = themes;
    } else if (mode === "extensions") {
      pool = extensions;
    } else if (mode === "downloads") {
      pool = downloads;
    } else if (!query) {
      const sortedActions = [...actions].sort(
        (a, b) =>
          b.priority + computeFrecencyBoost(frecency, b.id, now) - (a.priority + computeFrecencyBoost(frecency, a.id, now))
      );
      const sortedLinks = [...quickLinks].sort(
        (a, b) =>
          b.priority + computeFrecencyBoost(frecency, b.id, now) - (a.priority + computeFrecencyBoost(frecency, a.id, now))
      );
      pool = [
        ...tabs.slice(0, 8),
        ...tabGroups.slice(0, 3),
        ...closedTabs.slice(0, 3),
        ...archivedTabs.slice(0, 3),
        ...sortedLinks.slice(0, 4),
        ...sortedActions.slice(0, 5),
        ...chromePages.slice(0, 3)
      ];
    } else {
      pool = [...quickLinks, ...tabs, ...tabGroups, ...closedTabs, ...archivedTabs, ...actions, ...chromePages, ...themes, ...extensions, ...downloads, ...bookmarks, ...history];
    }

    const queryTokens = query ? normalizeQueryStr(query).split(/\s+/).filter(Boolean) : [];
    const seenPrimaryUrls = new Set();

    for (const item of pool) {
      const boost = computeFrecencyBoost(frecency, item.frecencyId || item.id, now);
      if (!query) {
        items.push({ ...item, _score: item.priority + boost });
        continue;
      }
      if (item.forceScore) {
        items.push({ ...item, _score: item.forceScore + boost });
        continue;
      }
      const bestMatch = scoreItem(item, query, queryTokens);
      if (bestMatch > 0) {
        if (mode === "all") {
          const normUrl = item.url ? normalizeUrlForDedup(item.url) : "";
          if (normUrl) {
            if (item.kind === "history") {
              if (seenPrimaryUrls.has(normUrl)) continue;
              seenPrimaryUrls.add(normUrl);
            } else if (item.kind === "tab" || item.kind === "closed" || item.kind === "bookmark") {
              seenPrimaryUrls.add(normUrl);
            }
          }
        }
        const searchPriority = getSearchPriority(item, mode);
        items.push({ ...item, _score: bestMatch + searchPriority + boost * 0.75 });
      }
    }

    const limit = mode === "tabs" ? 200 : mode === "all" ? 40 : 60;
    let sliced;

    if (query) {
      let urlFallback = null;
      let googleFallback = null;

      if (mode === "all") {
        if (looksLikeUrl(query)) {
          const target = normalizeUrl(query);
          const normTarget = normalizeUrlForDedup(target);
          const hasExactUrlMatch = items.some((it) => it.url && normalizeUrlForDedup(it.url) === normTarget);
          urlFallback = {
            id: "fallback-url",
            kind: "fallback",
            title: `Open URL: ${target}`,
            subtitle: "Navigate directly in a new tab",
            badge: "URL",
            badgeClass: "",
            iconClass: "",
            iconName: "globe",
            enterVerb: "Open",
            _score: hasExactUrlMatch ? 5 : 68,
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_URL", url: target }
            }
          };
          items.push(urlFallback);
        }
        googleFallback = {
          id: "fallback-google",
          kind: "fallback",
          title: `Search Google for "${query}"`,
          subtitle: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          badge: "Web",
          badgeClass: "",
          iconClass: "",
          iconName: "search",
          enterVerb: "Search",
          _score: 0,
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "OPEN_URL", url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }
          }
        };
      }

      items.sort((a, b) => b._score - a._score);
      if (googleFallback) {
        sliced = items.slice(0, Math.max(0, limit - 1));
        sliced.push(googleFallback);
      } else {
        sliced = items.slice(0, limit);
      }
    } else {
      if (mode !== "all") {
        items.sort((a, b) => b._score - a._score);
      }
      sliced = items.slice(0, limit);
    }

    return {
      prefixLabel: isPrefix ? prefixLabel : "",
      activeMode: mode,
      cleanQuery: query,
      isGrouped: !query && mode === "all",
      modeCounts,
      analysis,
      items: sliced,
      results: sliced
    };
  }

  function getAvailableSplitLayouts(count) {
    if (!Number.isFinite(count) || count < 2) return [];
    if (count === 2) {
      return [
        { id: "native", label: "In-Window Split" },
        { id: "cols", label: "Side by Side (Win)" },
        { id: "rows", label: "Top & Bottom (Win)" }
      ];
    }
    if (count === 3) {
      return [
        { id: "cols", label: "3 Columns" },
        { id: "master-stack", label: "1 + 2 Split" }
      ];
    }
    if (count === 4) {
      return [
        { id: "grid", label: "2×2 Grid" },
        { id: "cols", label: "4 Columns" }
      ];
    }
    return [{ id: "grid", label: "Auto Grid" }];
  }

  function distributeSpan(total, parts) {
    const base = Math.floor(total / parts);
    const rem = total - base * parts;
    return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
  }

  function computeSplitLayouts(count, bounds = {}, layoutId = "") {
    if (!Number.isFinite(count) || count < 2) return [];
    const left = Math.round(Number.isFinite(bounds.left) ? bounds.left : 0);
    const top = Math.round(Number.isFinite(bounds.top) ? bounds.top : 0);
    const width = Math.max(300, Math.round(Number.isFinite(bounds.width) ? bounds.width : 1200));
    const height = Math.max(200, Math.round(Number.isFinite(bounds.height) ? bounds.height : 800));

    const available = getAvailableSplitLayouts(count);
    const resolvedLayout = available.some((l) => l.id === layoutId)
      ? layoutId
      : available[0].id;

    if (resolvedLayout === "cols") {
      const widths = distributeSpan(width, count);
      let curX = left;
      return widths.map((w) => {
        const rect = { left: curX, top, width: w, height };
        curX += w;
        return rect;
      });
    }

    if (resolvedLayout === "rows") {
      const heights = distributeSpan(height, count);
      let curY = top;
      return heights.map((h) => {
        const rect = { left, top: curY, width, height: h };
        curY += h;
        return rect;
      });
    }

    if (resolvedLayout === "master-stack" && count === 3) {
      const [leftW, rightW] = distributeSpan(width, 2);
      const [topH, bottomH] = distributeSpan(height, 2);
      return [
        { left, top, width: leftW, height },
        { left: left + leftW, top, width: rightW, height: topH },
        { left: left + leftW, top: top + topH, width: rightW, height: bottomH }
      ];
    }

    // "grid" for 4 or 5+ tabs
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const rowHeights = distributeSpan(height, rows);
    const rects = [];
    let curY = top;
    let remaining = count;

    for (let r = 0; r < rows; r++) {
      const itemsInRow = r === rows - 1 ? remaining : Math.min(cols, remaining);
      const colWidths = distributeSpan(width, itemsInRow);
      let curX = left;
      for (let c = 0; c < itemsInRow; c++) {
        rects.push({ left: curX, top: curY, width: colWidths[c], height: rowHeights[r] });
        curX += colWidths[c];
      }
      curY += rowHeights[r];
      remaining -= itemsInRow;
    }

    return rects;
  }

  const Core = {
    REPO_URL,
    ISSUES_URL,
    SUPPORT_URL,
    GROUP_COLOR_HEX,
    GROUP_COLORS,
    CHIP_MODES,
    MODE_DEFINITIONS,
    getModeDefinition,
    formatRelativeTime,
    hexToRgba,
    looksLikeUrl,
    normalizeUrl,
    normalizeUrlForDedup,
    stripTrackingParams,
    formatMarkdownLink,
    suggestDomainGroupTitle,
    formatTabList,
    extractHostname,
    extractBaseDomain,
    parseModeAndQuery,
    fuzzyMatch,
    scoreItem,
    getHighlightRanges,
    computeFrecencyBoost,
    analyzeTabs,
    buildStaticActions,
    buildResults,
    getAvailableSplitLayouts,
    computeSplitLayouts
  };

  if (typeof globalThis !== "undefined") {
    globalThis.__CueCore = Core;
  }
  if (typeof window !== "undefined") {
    window.__CueCore = Core;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  }
})();

