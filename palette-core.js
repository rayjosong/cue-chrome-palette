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

  const MODE_DEFINITIONS = {
    all: { id: "all", label: "All", singularLabel: "result", icon: "search" },
    tabs: { id: "tabs", label: "Tabs", singularLabel: "tab", icon: "globe" },
    groups: { id: "groups", label: "Groups", singularLabel: "tab group", icon: "layers" },
    commands: { id: "commands", label: "Commands", singularLabel: "command", icon: "zap" },
    bookmarks: { id: "bookmarks", label: "Bookmarks", singularLabel: "bookmark", icon: "star" },
    history: { id: "history", label: "History", singularLabel: "history item", icon: "history" },
    closed: { id: "closed", label: "Closed", singularLabel: "recently closed tab", icon: "rotateCcw" },
    themes: { id: "themes", label: "Themes", singularLabel: "Chrome theme", icon: "palette" },
    extensions: { id: "extensions", label: "Extensions", singularLabel: "extension", icon: "puzzle" },
    downloads: { id: "downloads", label: "Downloads", singularLabel: "download", icon: "download" }
  };

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

  function singleTokenMatch(t, tok, usedIndices) {
    if (!tok || !t) return { score: 0, indices: [], matchType: "none" };

    if (t === tok) {
      const indices = Array.from({ length: t.length }, (_, i) => i);
      return { score: 120, indices, matchType: "exact" };
    }

    if (t.startsWith(tok)) {
      const indices = Array.from({ length: tok.length }, (_, i) => i);
      const hasOverlap = usedIndices && indices.some((i) => usedIndices.has(i));
      if (!hasOverlap) {
        return { score: 95, indices, matchType: "prefix" };
      }
    }

    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const wbRegex = new RegExp(`(^|[/\\-_\\.\\s:])(${escaped})`, "gi");
    let wbMatch;
    const wbMatches = [];
    while ((wbMatch = wbRegex.exec(t)) !== null) {
      const idx = wbMatch.index + (wbMatch[1] ? wbMatch[1].length : 0);
      const indices = Array.from({ length: tok.length }, (_, i) => idx + i);
      wbMatches.push({ idx, indices });
      wbRegex.lastIndex = wbMatch.index + Math.max(1, wbMatch[1] ? wbMatch[1].length : 1);
    }

    let fromIdx = 0;
    const subMatches = [];
    while (true) {
      const idx = t.indexOf(tok, fromIdx);
      if (idx === -1) break;
      const indices = Array.from({ length: tok.length }, (_, i) => idx + i);
      subMatches.push({ idx, indices });
      fromIdx = idx + 1;
    }

    if (wbMatches.length > 0) {
      const nonOverlapping = usedIndices
        ? wbMatches.find((m) => !m.indices.some((i) => usedIndices.has(i)))
        : wbMatches[0];
      if (nonOverlapping) {
        return {
          score: Math.max(76, 90 - Math.min(nonOverlapping.idx, 14)),
          indices: nonOverlapping.indices,
          matchType: "boundary"
        };
      }
    }

    if (subMatches.length > 0) {
      const nonOverlapping = usedIndices
        ? subMatches.find((m) => !m.indices.some((i) => usedIndices.has(i)))
        : subMatches[0];
      if (nonOverlapping) {
        return {
          score: Math.max(66, 74 - Math.min(nonOverlapping.idx, 8)),
          indices: nonOverlapping.indices,
          matchType: "substring"
        };
      }
    }

    if (wbMatches.length > 0) {
      const best = wbMatches[0];
      return {
        score: Math.max(76, 90 - Math.min(best.idx, 14)),
        indices: best.indices,
        matchType: "boundary"
      };
    }

    if (subMatches.length > 0) {
      const best = subMatches[0];
      return {
        score: Math.max(66, 74 - Math.min(best.idx, 8)),
        indices: best.indices,
        matchType: "substring"
      };
    }

    function findSubseq(allowOverlap) {
      let qi = 0;
      let score = 0;
      let consecutive = 0;
      const indices = [];
      for (let ti = 0; ti < t.length && qi < tok.length; ti++) {
        if (!allowOverlap && usedIndices && usedIndices.has(ti)) {
          continue;
        }
        if (t[ti] === tok[qi]) {
          indices.push(ti);
          qi++;
          consecutive++;
          const isBoundary = ti === 0 || /[/\-_.\s:]/.test(t[ti - 1]);
          score += 2 + consecutive + (isBoundary ? 2 : 0);
        } else {
          consecutive = 0;
        }
      }
      return qi === tok.length
        ? { score: Math.min(52, Math.max(1, score)), indices, matchType: "subsequence" }
        : null;
    }

    const subseq = (usedIndices ? findSubseq(false) : null) || findSubseq(true);
    if (subseq) {
      return subseq;
    }

    return { score: 0, indices: [], matchType: "none" };
  }

  function fuzzyMatch(text, query) {
    if (!query) return { score: 1, indices: [] };
    const t = (text || "").toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return { score: 1, indices: [] };
    if (!t) return { score: 0, indices: [] };
    if (t === q) {
      return { score: 120, indices: Array.from({ length: t.length }, (_, i) => i) };
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const tokenResults = [];
      const usedIndices = new Set();
      for (const tok of tokens) {
        const res = singleTokenMatch(t, tok, usedIndices);
        if (!res || res.score === 0) {
          return { score: 0, indices: [] };
        }
        for (const i of res.indices) {
          usedIndices.add(i);
        }
        tokenResults.push(res);
      }

      const allIndices = Array.from(usedIndices).sort((a, b) => a - b);
      const isAllSubstring = tokenResults.every(
        (r) =>
          r.matchType === "exact" ||
          r.matchType === "prefix" ||
          r.matchType === "boundary" ||
          r.matchType === "substring"
      );

      if (isAllSubstring) {
        return { score: 65, indices: allIndices };
      }

      const avgScore = tokenResults.reduce((sum, r) => sum + r.score, 0) / tokenResults.length;
      const composite = Math.min(64, Math.max(53, 53 + Math.round((avgScore / 100) * 11)));
      return { score: composite, indices: allIndices };
    }

    if (t.startsWith(q)) {
      return { score: 95, indices: Array.from({ length: q.length }, (_, i) => i) };
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wbRegex = new RegExp(`(^|[/\\-_\\.\\s:])${escaped}`, "i");
    const wbMatch = t.match(wbRegex);
    if (wbMatch && wbMatch.index !== undefined) {
      const idx = wbMatch.index + (wbMatch[1] ? wbMatch[1].length : 0);
      return {
        score: Math.max(76, 90 - Math.min(idx, 14)),
        indices: Array.from({ length: q.length }, (_, i) => idx + i)
      };
    }

    const idx = t.indexOf(q);
    if (idx !== -1) {
      return {
        score: Math.max(66, 74 - Math.min(idx, 8)),
        indices: Array.from({ length: q.length }, (_, i) => idx + i)
      };
    }

    let qi = 0;
    let score = 0;
    let consecutive = 0;
    const indices = [];
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        indices.push(ti);
        qi++;
        consecutive++;
        const isBoundary = ti === 0 || /[/\-_.\s:]/.test(t[ti - 1]);
        score += 2 + consecutive + (isBoundary ? 2 : 0);
      } else {
        consecutive = 0;
      }
    }
    return qi === q.length ? { score: Math.min(52, Math.max(1, score)), indices } : { score: 0, indices: [] };
  }

  function getHighlightRanges(text, query) {
    const str = text || "";
    const q = (query || "").trim();
    if (!q) return [{ text: str, matched: false }];

    const { score, indices } = fuzzyMatch(str, q);
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

  function computeFrecencyBoost(frecencyMap, itemId, now = Date.now()) {
    if (!frecencyMap || !itemId) return 0;
    const entry = frecencyMap[itemId];
    if (!entry || !entry.count) return 0;
    const ageDays = Math.max(0, (now - (entry.lastUsed || now)) / (1000 * 60 * 60 * 24));
    const decay = Math.pow(0.5, ageDays / 7);
    const boost = Math.min(18, Math.log2(entry.count + 1) * 6 * (0.4 + 0.6 * decay));
    return Math.round(boost * 100) / 100;
  }

  function analyzeTabs(tabs = [], activeTab = null) {
    const windowTabs = tabs.filter((t) => t.currentWindow !== false);
    const targetTabs = windowTabs.length > 0 ? windowTabs : tabs;

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

    let suggestedGroupTitle = "";
    if (activeDomain) {
      const cleanHost = activeDomain.replace(/^www\./, "");
      const base = cleanHost.split(".")[0] || cleanHost;
      const knownBrands = {
        github: "GitHub",
        gitlab: "GitLab",
        youtube: "YouTube",
        linkedin: "LinkedIn",
        stackoverflow: "StackOverflow",
        chatgpt: "ChatGPT",
        localhost: "Localhost"
      };
      suggestedGroupTitle = knownBrands[base.toLowerCase()] || base.charAt(0).toUpperCase() + base.slice(1);
    }

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
    for (const t of targetTabs) {
      const bd = extractBaseDomain(t.url);
      if (!bd) continue;
      if (!baseDomainMap.has(bd)) {
        baseDomainMap.set(bd, []);
      }
      baseDomainMap.get(bd).push(t.id);
    }

    const baseDomainGroups = [];
    for (const [baseDomain, tabIds] of baseDomainMap.entries()) {
      if (tabIds.length > 1) {
        baseDomainGroups.push({ baseDomain, tabIds, count: tabIds.length });
      }
    }
    baseDomainGroups.sort((a, b) => b.count - a.count);

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
      baseDomainGroups
    };
  }

  function buildStaticActions(activeTab, analysis, contextData = {}) {
    const allTabs = Array.isArray(contextData) ? contextData : (contextData?.tabs || []);
    const windows = Array.isArray(contextData) ? [] : (contextData?.windows || []);
    const bookmarks = Array.isArray(contextData) ? [] : (contextData?.bookmarks || []);
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
          keepsOpen: true,
          searchText: "mute all audible tabs sound silence",
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "MUTE_AUDIBLE_TABS" },
            keepsOpen: true
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
      keepsOpen: true,
      searchText: "mute all other tabs unmuted",
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "MUTE_OTHER_TABS" },
        keepsOpen: true
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
          ? [
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
            ]
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
            keepsOpen: true,
            searchText: isBookmarked
              ? "remove bookmark unbookmark current page"
              : "bookmark current page save star",
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "TOGGLE_BOOKMARK", url: activeTab.url, title: activeTab.title },
              keepsOpen: true
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
            searchText: "open current page in incognito private window",
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_IN_INCOGNITO", url: activeTab.url }
            }
          }
        );
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
            keepsOpen: true,
            searchText: "merge all windows into current combine",
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "MERGE_ALL_WINDOWS" },
              keepsOpen: true
            }
          }
        );
      }
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
          keepsOpen: true,
          searchText: `close all domain tabs ${analysis.activeDomain}`,
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "CLOSE_DOMAIN_TABS", domain: analysis.activeDomain },
            keepsOpen: true
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
          keepsOpen: true,
          searchText: `close all base website domain tabs ${analysis.activeBaseDomain}`,
          actionDescriptor: {
            type: "EXECUTE_ACTION",
            payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: analysis.activeBaseDomain },
            keepsOpen: true
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
            keepsOpen: true,
            searchText: `close all base website domain tabs ${bg.baseDomain}`,
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: bg.baseDomain },
              keepsOpen: true
            }
          });
        }
      }
    }

    actions.push(
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
        keepsOpen: true,
        searchText: "close duplicate tabs dedup cleanup duplicates",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "CLOSE_DUPLICATE_TABS" },
          keepsOpen: true
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
        actionDescriptor: { type: "EXECUTE_ACTION", payload: { action: "OPEN_OPTIONS" } }
      }
    );

    return actions;
  }

  function buildResults(data = {}, rawQuery = "", chipMode = "all") {
    const { mode, query, prefixLabel, isPrefix } = parseModeAndQuery(rawQuery, chipMode);
    const frecency = data.frecency || {};
    const now = Date.now();
    const analysis = analyzeTabs(data.tabs || [], data.activeTab || null);
    const items = [];

    const tabs = (data.tabs || []).map((t, idx) => ({
      id: `tab-${t.id}`,
      kind: "tab",
      section: "Open Tabs (Recent)",
      tabId: t.id,
      windowId: t.windowId,
      groupId: t.groupId ?? -1,
      title: t.title,
      subtitle: t.url,
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
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "SWITCH_TAB", tabId: t.id, windowId: t.windowId }
      }
    }));

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
        badge: ql.bang ? `!${ql.bang}` : "Link",
        badgeClass: "qc-badge-bang",
        iconClass: "qc-icon-bang",
        iconName: "zap",
        enterVerb: "Open",
        priority: exactBang ? 180 : 14,
        forceScore: exactBang ? 180 : 0,
        searchText: `${ql.bang || ""} ${ql.title} ${ql.url || ""}`,
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "OPEN_URL", url: ql.url }
        }
      });
    }

    const actions = buildStaticActions(data.activeTab, analysis, data);

    const chromePages = (data.chromePages || []).map((p) => ({
      id: p.id,
      kind: "chrome",
      section: "Chrome Pages",
      title: p.title,
      subtitle: p.subtitle,
      badge: "Chrome",
      badgeClass: "qc-badge-chrome",
      iconClass: "qc-icon-chrome",
      iconName: "settings",
      enterVerb: "Open",
      priority: 8,
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
      badge: "Bookmark",
      badgeClass: "qc-badge-bookmark",
      iconClass: "qc-icon-bookmark",
      iconName: "star",
      enterVerb: "Open",
      priority: 6,
      searchText: `${b.title} ${b.url} ${b.folder || ""}`,
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
      keepsOpen: true,
      priority: t.enabled ? 11 : 9,
      searchText: `theme ${t.name} ${t.description || ""}`,
      actionDescriptor: {
        type: "EXECUTE_ACTION",
        payload: { action: "SWITCH_CHROME_THEME", themeId: t.id },
        keepsOpen: true
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
        keepsOpen: true,
        priority: 8.5,
        searchText: "theme restore default chrome reset appearance",
        actionDescriptor: {
          type: "EXECUTE_ACTION",
          payload: { action: "SWITCH_CHROME_THEME", themeId: null },
          keepsOpen: true
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
            keepsOpen: true,
            priority: ext.enabled ? 10 : 8,
            optionsUrl: ext.optionsUrl || "",
            searchText: `extension ${ext.name} ${ext.description || ""} ${ext.version || ""}`,
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "TOGGLE_EXTENSION", extensionId: ext.id },
              keepsOpen: true
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
      all: tabs.length + tabGroups.length + closedTabs.length + bookmarks.length + actions.length + chromePages.length + themes.length + extensions.length + downloads.length,
      tabs: tabs.length,
      groups: tabGroups.length,
      closed: closedTabs.length,
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
        ...sortedLinks.slice(0, 4),
        ...sortedActions.slice(0, 5),
        ...chromePages.slice(0, 3)
      ];
    } else {
      pool = [...quickLinks, ...tabs, ...tabGroups, ...closedTabs, ...actions, ...chromePages, ...themes, ...extensions, ...downloads, ...bookmarks, ...history];
    }

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
      const titleScore = fuzzyMatch(item.title, query).score;
      const subScore = Math.round(fuzzyMatch(item.subtitle || "", query).score * 0.85);
      const extraScore = item.searchText ? Math.round(fuzzyMatch(item.searchText, query).score * 0.9) : 0;
      const bestMatch = Math.max(titleScore, subScore, extraScore);
      if (bestMatch > 0) {
        items.push({ ...item, _score: bestMatch + item.priority + boost });
      }
    }

    if (query) {
      items.sort((a, b) => b._score - a._score);
      if (mode === "all") {
        if (looksLikeUrl(query)) {
          const target = normalizeUrl(query);
          items.push({
            id: "fallback-url",
            kind: "fallback",
            title: `Open URL: ${target}`,
            subtitle: "Navigate directly in a new tab",
            badge: "URL",
            badgeClass: "",
            iconClass: "",
            iconName: "globe",
            enterVerb: "Open",
            _score: 0.5,
            actionDescriptor: {
              type: "EXECUTE_ACTION",
              payload: { action: "OPEN_URL", url: target }
            }
          });
        }
        items.push({
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
        });
      }
    } else if (mode !== "all") {
      items.sort((a, b) => b._score - a._score);
    }

    const limit = mode === "tabs" ? 200 : mode === "all" ? 40 : 60;
    const sliced = items.slice(0, limit);
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

  const Core = {
    GROUP_COLOR_HEX,
    GROUP_COLORS,
    CHIP_MODES,
    MODE_DEFINITIONS,
    getModeDefinition,
    hexToRgba,
    looksLikeUrl,
    normalizeUrl,
    normalizeUrlForDedup,
    stripTrackingParams,
    formatMarkdownLink,
    extractHostname,
    extractBaseDomain,
    parseModeAndQuery,
    fuzzyMatch,
    getHighlightRanges,
    computeFrecencyBoost,
    analyzeTabs,
    buildStaticActions,
    buildResults
  };

  if (typeof window !== "undefined") {
    window.__CueCore = Core;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  }
})();

