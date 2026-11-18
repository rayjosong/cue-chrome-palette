const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../palette-core.js");

test("Mode definitions and getModeDefinition cover all modes without falling back to All", () => {
  assert.equal(Core.getModeDefinition("tabs").label, "Tabs");
  assert.equal(Core.getModeDefinition("unknown").label, "All");
  for (const mode of ["all", "tabs", "groups", "commands", "bookmarks", "history", "closed", "themes", "extensions", "downloads"]) {
    const def = Core.getModeDefinition(mode);
    assert.ok(def);
    assert.equal(def.id, mode);
    if (mode !== "all") {
      assert.notEqual(def.label, "All");
    }
  }
});

test("parseModeAndQuery handles /e (extensions) and /d (downloads) prefixes", () => {
  assert.deepEqual(Core.parseModeAndQuery("/e ublock"), {
    mode: "extensions",
    query: "ublock",
    prefixLabel: "Extensions",
    isPrefix: true,
    rawPrefix: "/e"
  });
  assert.deepEqual(Core.parseModeAndQuery("/d report.pdf"), {
    mode: "downloads",
    query: "report.pdf",
    prefixLabel: "Downloads",
    isPrefix: true,
    rawPrefix: "/d"
  });
});

test("stripTrackingParams removes marketing/analytics query parameters while preserving content queries", () => {
  const dirty = "https://example.com/article?utm_source=twitter&utm_medium=social&utm_campaign=launch&id=42&fbclid=abc123xyz&ref=rss&gclid=test";
  const clean = Core.stripTrackingParams(dirty);
  assert.equal(clean, "https://example.com/article?id=42&ref=rss");

  const searchUrl = "https://www.google.com/search?q=open+source&oq=open+source&utm_term=test";
  assert.equal(Core.stripTrackingParams(searchUrl), "https://www.google.com/search?q=open+source&oq=open+source");

  // Handles URLs without params or invalid URLs gracefully
  assert.equal(Core.stripTrackingParams("https://example.com"), "https://example.com/");
  assert.equal(Core.stripTrackingParams("not-a-url"), "not-a-url");
});

test("formatMarkdownLink formats title and URL, escaping square brackets in title", () => {
  assert.equal(
    Core.formatMarkdownLink("GitHub Dashboard", "https://github.com"),
    "[GitHub Dashboard](https://github.com)"
  );
  assert.equal(
    Core.formatMarkdownLink("Fix: [Bug] in Parser", "https://github.com/issues/1"),
    "[Fix: \\[Bug\\] in Parser](https://github.com/issues/1)"
  );
  assert.equal(
    Core.formatMarkdownLink("", "https://example.com"),
    "[https://example.com](https://example.com)"
  );
});

test("buildStaticActions creates audio, reload, bookmark, incognito, copy, and window management actions", () => {
  const activeTab = {
    id: 1,
    title: "Example Domain",
    url: "https://example.com/page?utm_source=news",
    groupId: -1
  };
  const tabs = [
    activeTab,
    { id: 2, title: "Music Stream", url: "https://music.youtube.com", audible: true, muted: false },
    { id: 3, title: "Video Player", url: "https://vimeo.com", audible: false, muted: false }
  ];
  const windows = [
    { id: 10, focused: true, tabCount: 3, title: "Example Domain" },
    { id: 20, focused: false, tabCount: 5, title: "Docs Window" }
  ];
  const bookmarks = [
    { id: "b1", title: "Example Domain", url: "https://example.com/page?utm_source=news" }
  ];

  const analysis = Core.analyzeTabs(tabs, activeTab);
  const actions = Core.buildStaticActions(activeTab, analysis, { tabs, windows, bookmarks });

  // Audio actions
  const jumpAudio = actions.find((a) => a.id === "act-jump-audio");
  assert.ok(jumpAudio, "Should have jump to audio action when audible tab exists");
  assert.equal(jumpAudio.actionDescriptor.payload.tabId, 2);

  const muteAudible = actions.find((a) => a.id === "act-mute-audible");
  assert.ok(muteAudible, "Should have mute all audible tabs action");
  assert.equal(muteAudible.actionDescriptor.payload.action, "MUTE_AUDIBLE_TABS");

  const muteOthers = actions.find((a) => a.id === "act-mute-others");
  assert.ok(muteOthers, "Should have mute other tabs action");
  assert.equal(muteOthers.actionDescriptor.payload.action, "MUTE_OTHER_TABS");

  // Reload & Hard Reload
  const reload = actions.find((a) => a.id === "act-reload");
  assert.ok(reload, "Should have reload tab action");
  assert.equal(reload.actionDescriptor.payload.action, "RELOAD_TAB");
  const hardReload = actions.find((a) => a.id === "act-hard-reload");
  assert.ok(hardReload, "Should have hard reload tab action");
  assert.equal(hardReload.actionDescriptor.payload.bypassCache, true);

  // Bookmark toggle (page is bookmarked -> action is "Remove Current Page Bookmark")
  const removeBookmark = actions.find((a) => a.id === "act-toggle-bookmark");
  assert.ok(removeBookmark);
  assert.equal(removeBookmark.title, "Remove Current Page Bookmark");
  assert.equal(removeBookmark.actionDescriptor.payload.action, "TOGGLE_BOOKMARK");

  // Incognito
  const incognito = actions.find((a) => a.id === "act-open-incognito");
  assert.ok(incognito);
  assert.equal(incognito.actionDescriptor.payload.action, "OPEN_IN_INCOGNITO");

  // Copy Markdown and Clean URL
  const copyMd = actions.find((a) => a.id === "act-copy-markdown");
  assert.ok(copyMd);
  assert.equal(copyMd.actionDescriptor.text, "[Example Domain](https://example.com/page?utm_source=news)");

  const copyClean = actions.find((a) => a.id === "act-copy-clean-url");
  assert.ok(copyClean);
  assert.equal(copyClean.actionDescriptor.text, "https://example.com/page");

  // Multi-window actions (>1 window)
  const moveWindow = actions.find((a) => a.id === "act-move-window-picker");
  assert.ok(moveWindow, "Should offer move tab to window when >1 window open");
  const mergeWindows = actions.find((a) => a.id === "act-merge-windows");
  assert.ok(mergeWindows, "Should offer merge all windows when >1 window open");
});

test("buildResults produces extension and download items with appropriate badges and descriptors", () => {
  const data = {
    activeTab: { id: 1, title: "Test", url: "https://example.com" },
    tabs: [
      { id: 1, title: "Test", url: "https://example.com", audible: true, discarded: false }
    ],
    extensions: [
      { id: "ext1", name: "uBlock Origin", enabled: true, version: "1.50.0", optionsUrl: "chrome://extensions/?options=ext1" },
      { id: "ext2", name: "Dark Reader", enabled: false, version: "4.9.0" }
    ],
    downloads: [
      { id: 101, filename: "/home/user/Downloads/spec.pdf", basename: "spec.pdf", url: "https://example.com/spec.pdf", fileSize: 2048576, state: "complete", exists: true }
    ]
  };

  // Check tab audio / discarded properties in results
  const tabRes = Core.buildResults(data, "", "tabs");
  assert.equal(tabRes.items[0].audible, true);
  assert.equal(tabRes.items[0].discarded, false);

  // Extensions mode (/e)
  const extRes = Core.buildResults(data, "/e ublock", "all");
  assert.equal(extRes.activeMode, "extensions");
  assert.equal(extRes.items.length, 1);
  assert.equal(extRes.items[0].title, "uBlock Origin");
  assert.equal(extRes.items[0].badge, "Enabled");
  assert.equal(extRes.items[0].actionDescriptor.payload.action, "TOGGLE_EXTENSION");

  // Downloads mode (/d)
  const dlRes = Core.buildResults(data, "/d spec", "all");
  assert.equal(dlRes.activeMode, "downloads");
  assert.equal(dlRes.items.length, 1);
  assert.equal(dlRes.items[0].title, "spec.pdf");
  assert.equal(dlRes.items[0].badge, "Download");
  assert.equal(dlRes.items[0].actionDescriptor.payload.action, "OPEN_DOWNLOAD");

  // Mode counts
  assert.equal(extRes.modeCounts.extensions, 2);
  assert.equal(extRes.modeCounts.downloads, 1);
});

test("parseModeAndQuery handles all chips and prefixes (with or without trailing space)", () => {
  assert.deepEqual(Core.parseModeAndQuery("> settings"), {
    mode: "commands",
    query: "settings",
    prefixLabel: "Commands",
    isPrefix: true,
    rawPrefix: ">"
  });
  assert.deepEqual(Core.parseModeAndQuery("@ github"), {
    mode: "tabs",
    query: "github",
    prefixLabel: "Tabs",
    isPrefix: true,
    rawPrefix: "@"
  });
  assert.deepEqual(Core.parseModeAndQuery("* docs"), {
    mode: "bookmarks",
    query: "docs",
    prefixLabel: "Bookmarks",
    isPrefix: true,
    rawPrefix: "*"
  });
  assert.deepEqual(Core.parseModeAndQuery("/h"), {
    mode: "history",
    query: "",
    prefixLabel: "History",
    isPrefix: true,
    rawPrefix: "/h"
  });
  assert.deepEqual(Core.parseModeAndQuery("/h react"), {
    mode: "history",
    query: "react",
    prefixLabel: "History",
    isPrefix: true,
    rawPrefix: "/h"
  });
  assert.deepEqual(Core.parseModeAndQuery("/g work"), {
    mode: "groups",
    query: "work",
    prefixLabel: "Groups",
    isPrefix: true,
    rawPrefix: "/g"
  });
  assert.deepEqual(Core.parseModeAndQuery("/c tab"), {
    mode: "closed",
    query: "tab",
    prefixLabel: "Closed",
    isPrefix: true,
    rawPrefix: "/c"
  });
  assert.deepEqual(Core.parseModeAndQuery("/t silk"), {
    mode: "themes",
    query: "silk",
    prefixLabel: "Themes",
    isPrefix: true,
    rawPrefix: "/t"
  });
});

test("fuzzyMatch hierarchy ranks exact > prefix > word-boundary > substring > multi-token > subsequence", () => {
  const exact = Core.fuzzyMatch("GitHub", "github");
  const prefix = Core.fuzzyMatch("GitHub Actions", "github");
  const boundary = Core.fuzzyMatch("https://github.com/raymond/repo", "raymond");
  const substring = Core.fuzzyMatch("supergithubtool", "github");
  const multi = Core.fuzzyMatch("React JavaScript Documentation", "react doc");
  const subseq = Core.fuzzyMatch("Command Palette", "cmdplt");
  const none = Core.fuzzyMatch("GitHub", "xyz");

  assert.equal(exact.score, 120);
  assert.equal(prefix.score, 95);
  assert.ok(boundary.score > substring.score, `Expected boundary (${boundary.score}) > substring (${substring.score})`);
  assert.ok(substring.score > 0);
  assert.equal(multi.score, 65);
  assert.ok(subseq.score > 0 && subseq.score <= 52);
  assert.equal(none.score, 0);
});

test("getHighlightRanges segments both titles and URLs accurately", () => {
  const ranges = Core.getHighlightRanges("https://github.com/pulls", "pulls");
  assert.deepEqual(ranges, [
    { text: "https://github.com/", matched: false },
    { text: "pulls", matched: true }
  ]);
});

test("computeFrecencyBoost rewards frequent & recent usage and decays with age", () => {
  const now = Date.now();
  const map = {
    recent: { count: 10, lastUsed: now },
    old: { count: 10, lastUsed: now - 1000 * 60 * 60 * 24 * 21 }
  };
  const recentBoost = Core.computeFrecencyBoost(map, "recent", now);
  const oldBoost = Core.computeFrecencyBoost(map, "old", now);
  assert.ok(recentBoost > oldBoost);
  assert.equal(Core.computeFrecencyBoost(map, "missing", now), 0);
});

test("analyzeTabs detects duplicate URLs (ignoring hash & trailing slash) and domain tabs", () => {
  const tabs = [
    { id: 1, url: "https://github.com/foo/", currentWindow: true, active: true },
    { id: 2, url: "https://github.com/foo#section", currentWindow: true, active: false },
    { id: 3, url: "https://github.com/bar", currentWindow: true, active: false },
    { id: 4, url: "https://google.com", currentWindow: true, active: false }
  ];
  const analysis = Core.analyzeTabs(tabs, tabs[0]);

  assert.equal(analysis.duplicateCount, 1);
  assert.deepEqual(analysis.duplicateTabIds, [2]);
  assert.equal(analysis.activeDomain, "github.com");
  assert.equal(analysis.domainCount, 3);
  assert.deepEqual(analysis.domainTabIds, [1, 2, 3]);
  assert.equal(analysis.suggestedGroupTitle, "GitHub");
});

test("buildResults supports bang templates, frecency boosts, domain/duplicate actions, and Chrome themes", () => {
  const now = Date.now();
  const data = {
    activeTab: { id: 1, title: "GitHub Issues", url: "https://github.com/issues", groupId: -1 },
    tabs: [
      { id: 1, title: "GitHub Issues", url: "https://github.com/issues", currentWindow: true, active: true },
      { id: 2, title: "GitHub Dup", url: "https://github.com/issues#top", currentWindow: true, active: false }
    ],
    quickLinks: [
      { bang: "gh", title: "GitHub", url: "https://github.com", searchUrl: "https://github.com/search?q={query}" },
      { bang: "yt", title: "YouTube", url: "https://youtube.com", searchUrl: "https://youtube.com/results?search_query={query}" }
    ],
    themes: [
      { id: "theme-sapphire", name: "Sapphire Ice — Silk Theme", enabled: true },
      { id: "theme-crimson", name: "Crimson Gold — Silk Theme", enabled: false }
    ],
    frecency: {
      "ql-yt-https://youtube.com": { count: 15, lastUsed: now }
    }
  };

  // Bang search template expansion
  const bangRes = Core.buildResults(data, "gh command palette", "all");
  assert.equal(bangRes.items[0].id, "bang-search-gh");
  assert.ok(bangRes.items[0].subtitle.includes("command%20palette"));

  // Commands mode includes duplicate cleanup & domain grouping actions
  const cmdRes = Core.buildResults(data, ">", "all");
  assert.ok(cmdRes.items.some((i) => i.id === "act-close-dups" && i.title.includes("(1)")));
  assert.ok(cmdRes.items.some((i) => i.id === "act-group-domain" && i.title.includes("github.com")));
  assert.ok(cmdRes.items.some((i) => i.id === "act-group-picker"));

  // Themes mode (/t) filters installed Chrome themes
  const themeRes = Core.buildResults(data, "/t crimson", "all");
  assert.equal(themeRes.activeMode, "themes");
  assert.ok(themeRes.items.some((i) => i.title === "Crimson Gold — Silk Theme"));
});

test("buildResults gates Chrome themes behind the optional management permission", () => {
  const data = {
    activeTab: null,
    tabs: [],
    quickLinks: [],
    themes: [],
    themesPermission: false,
    frecency: {}
  };

  // /t with the permission off shows one row that opens Options — no theme
  // rows and no "Restore Default" row.
  const res = Core.buildResults(data, "/t", "all");
  assert.equal(res.activeMode, "themes");
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].id, "theme-enable-permission");
  assert.equal(res.items[0].actionDescriptor.payload.action, "OPEN_OPTIONS");

  // Permission on keeps the old behaviour.
  const allowed = Core.buildResults(
    { ...data, themesPermission: true, themes: [{ id: "t1", name: "Silk", enabled: false }] },
    "/t",
    "all"
  );
  assert.ok(allowed.items.some((i) => i.title === "Silk"));

  // Permission unknown (old callers) also keeps the old behaviour.
  const legacy = { ...data, themes: [{ id: "t1", name: "Silk", enabled: false }] };
  delete legacy.themesPermission;
  const legacyRes = Core.buildResults(legacy, "/t", "all");
  assert.ok(legacyRes.items.some((i) => i.title === "Silk"));
});

test("zero-query All mode caps tabs to 8 while preserving groups, links, and actions with >10 tabs", () => {
  const tabs = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    title: `Tab ${i + 1}`,
    url: `https://example.com/${i + 1}`,
    currentWindow: true,
    active: i === 0
  }));
  const tabGroups = [
    { id: 101, title: "Work", color: "blue", currentWindow: true, count: 3 }
  ];
  const quickLinks = [
    { bang: "gh", title: "GitHub", url: "https://github.com", searchUrl: "https://github.com/search?q={query}" }
  ];

  const res = Core.buildResults({ tabs, tabGroups, quickLinks, activeTab: tabs[0] }, "", "all");
  const tabResults = res.items.filter((i) => i.kind === "tab");
  assert.equal(tabResults.length, 8);
  assert.ok(res.items.some((i) => i.kind === "group"));
  assert.ok(res.items.some((i) => i.kind === "bang"));
  assert.ok(res.items.some((i) => i.kind === "action"));
});

test("Tabs mode returns >40 tabs (e.g. 50 tabs)", () => {
  const tabs = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    title: `Tab ${i + 1}`,
    url: `https://example.com/${i + 1}`,
    currentWindow: true,
    active: i === 0
  }));

  const res = Core.buildResults({ tabs }, "@", "all");
  assert.equal(res.activeMode, "tabs");
  assert.equal(res.items.length, 50);

  const resDirect = Core.buildResults({ tabs }, "", "tabs");
  assert.equal(resDirect.items.length, 50);
});

test("Current badge is applied to active tab in current window and Pinned · Current when pinned", () => {
  const tabs = [
    { id: 1, title: "Active Tab", url: "https://example.com/1", currentWindow: true, active: true, pinned: false },
    { id: 2, title: "Pinned Active Tab", url: "https://example.com/2", currentWindow: true, active: true, pinned: true },
    { id: 3, title: "Inactive Pinned Tab", url: "https://example.com/3", currentWindow: true, active: false, pinned: true },
    { id: 4, title: "Inactive Tab", url: "https://example.com/4", currentWindow: true, active: false, pinned: false },
    { id: 5, title: "Other Window Tab", url: "https://example.com/5", currentWindow: false, active: false, pinned: false }
  ];

  const res = Core.buildResults({ tabs }, "", "tabs");
  const byId = Object.fromEntries(res.items.map((i) => [i.tabId, i]));

  assert.equal(byId[1].badge, "Current");
  assert.equal(byId[2].badge, "Pinned · Current");
  assert.equal(byId[3].badge, "Pinned");
  assert.equal(byId[4].badge, "Tab");
  assert.equal(byId[5].badge, "Other Window");
});

test("searchUrl with multiple {query} placeholders replaces all occurrences", () => {
  const data = {
    quickLinks: [
      {
        bang: "multi",
        title: "Multi Query",
        url: "https://example.com",
        searchUrl: "https://example.com/search?q={query}&highlight={query}"
      }
    ]
  };

  const res = Core.buildResults(data, "multi hello world", "all");
  assert.equal(res.items[0].id, "bang-search-multi");
  assert.equal(res.items[0].subtitle, "https://example.com/search?q=hello%20world&highlight=hello%20world");
});

test("buildResults gates /e extensions behind optional management permission when explicitly false", () => {
  const gated = Core.buildResults({ themesPermission: false, extensions: [] }, "/e", "all");
  assert.equal(gated.activeMode, "extensions");
  assert.equal(gated.items.length, 1);
  assert.equal(gated.items[0].id, "ext-enable-permission");
  assert.equal(gated.items[0].actionDescriptor.payload.action, "OPEN_OPTIONS");
});

test("fuzzyMatch handles multi-token queries with word-boundary, substring, and subsequence matching", () => {
  // Multi-token substring / boundary match (score = 65)
  const allSubstring = Core.fuzzyMatch("React JavaScript Documentation", "react doc");
  assert.equal(allSubstring.score, 65);
  assert.deepEqual(allSubstring.indices, [0, 1, 2, 3, 4, 17, 18, 19]);

  // Multi-token subsequence match (e.g. "gh pr" against "GitHub Pull Requests")
  const ghPr = Core.fuzzyMatch("GitHub Pull Requests", "gh pr");
  assert.ok(ghPr.score >= 53 && ghPr.score <= 64, `Expected score in [53, 64], got ${ghPr.score}`);
  assert.deepEqual(ghPr.indices, [0, 3, 7, 12]);

  // Multi-token subsequence match (e.g. "cmd plt" against "Command Palette")
  const cmdPlt = Core.fuzzyMatch("Command Palette", "cmd plt");
  assert.ok(cmdPlt.score >= 53 && cmdPlt.score <= 64, `Expected score in [53, 64], got ${cmdPlt.score}`);
  assert.deepEqual(cmdPlt.indices, [0, 2, 6, 8, 10, 12]);

  // Ranking hierarchy: all-substring multi-token (65) > multi-token subsequence (53..64) > single-pass subsequence (<= 52)
  const singleSubseq = Core.fuzzyMatch("Command Palette", "cmdplt");
  assert.ok(allSubstring.score > ghPr.score, `Expected allSubstring (${allSubstring.score}) > ghPr (${ghPr.score})`);
  assert.ok(ghPr.score > singleSubseq.score, `Expected ghPr (${ghPr.score}) > singleSubseq (${singleSubseq.score})`);

  // Repeated tokens in query match distinct occurrences cleanly
  const repeated = Core.fuzzyMatch("Quick Quick Settings", "quick quick");
  assert.equal(repeated.score, 65);
  assert.deepEqual(repeated.indices, [0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);

  // Multi-token query where one token fails to match returns score 0
  const noMatch = Core.fuzzyMatch("GitHub Pull Requests", "gh xyz");
  assert.equal(noMatch.score, 0);
  assert.deepEqual(noMatch.indices, []);
});

test("getHighlightRanges accurately produces multiple highlight segments on multi-token queries", () => {
  // Multi-token substring: "react doc" in "React JavaScript Documentation"
  const multiSubRanges = Core.getHighlightRanges("React JavaScript Documentation", "react doc");
  assert.deepEqual(multiSubRanges, [
    { text: "React", matched: true },
    { text: " JavaScript ", matched: false },
    { text: "Doc", matched: true },
    { text: "umentation", matched: false }
  ]);
  assert.equal(multiSubRanges.map((s) => s.text).join(""), "React JavaScript Documentation");

  // Multi-token subsequence: "gh pr" in "GitHub Pull Requests"
  const ghPrRanges = Core.getHighlightRanges("GitHub Pull Requests", "gh pr");
  assert.deepEqual(ghPrRanges, [
    { text: "G", matched: true },
    { text: "it", matched: false },
    { text: "H", matched: true },
    { text: "ub ", matched: false },
    { text: "P", matched: true },
    { text: "ull ", matched: false },
    { text: "R", matched: true },
    { text: "equests", matched: false }
  ]);
  assert.equal(ghPrRanges.map((s) => s.text).join(""), "GitHub Pull Requests");

  // Multi-token subsequence: "cmd plt" in "Command Palette"
  const cmdPltRanges = Core.getHighlightRanges("Command Palette", "cmd plt");
  assert.deepEqual(cmdPltRanges, [
    { text: "C", matched: true },
    { text: "o", matched: false },
    { text: "m", matched: true },
    { text: "man", matched: false },
    { text: "d", matched: true },
    { text: " ", matched: false },
    { text: "P", matched: true },
    { text: "a", matched: false },
    { text: "l", matched: true },
    { text: "e", matched: false },
    { text: "t", matched: true },
    { text: "te", matched: false }
  ]);
  assert.equal(cmdPltRanges.map((s) => s.text).join(""), "Command Palette");
});

test("extractBaseDomain detects root/registrable domains across subdomains, multi-part suffixes, and edge cases", () => {
  // Bare subdomains specified in requirements
  assert.equal(Core.extractBaseDomain("mail.google.com"), "google.com");
  assert.equal(Core.extractBaseDomain("docs.google.com"), "google.com");
  assert.equal(Core.extractBaseDomain("www.github.com"), "github.com");
  assert.equal(Core.extractBaseDomain("news.bbc.co.uk"), "bbc.co.uk");
  assert.equal(Core.extractBaseDomain("localhost:3000"), "localhost");

  // Full URLs with protocol & paths
  assert.equal(Core.extractBaseDomain("https://mail.google.com/mail/u/0/#inbox"), "google.com");
  assert.equal(Core.extractBaseDomain("https://docs.google.com/document/d/123"), "google.com");
  assert.equal(Core.extractBaseDomain("http://gist.github.com/user/123"), "github.com");
  assert.equal(Core.extractBaseDomain("http://localhost:3000/app"), "localhost");
  assert.equal(Core.extractBaseDomain("https://sub.domain.co.jp/path"), "domain.co.jp");
  assert.equal(Core.extractBaseDomain("https://api.service.com.au/v1"), "service.com.au");

  // Single label, IPs, localhost
  assert.equal(Core.extractBaseDomain("localhost"), "localhost");
  assert.equal(Core.extractBaseDomain("corp-intranet"), "corp-intranet");
  assert.equal(Core.extractBaseDomain("127.0.0.1"), "127.0.0.1");
  assert.equal(Core.extractBaseDomain("http://192.168.1.1:8080/admin"), "192.168.1.1");

  // Non-web or invalid URLs return ""
  assert.equal(Core.extractBaseDomain("chrome://extensions"), "");
  assert.equal(Core.extractBaseDomain("about:blank"), "");
  assert.equal(Core.extractBaseDomain("edge://settings"), "");
  assert.equal(Core.extractBaseDomain("file:///Users/test/file.txt"), "");
  assert.equal(Core.extractBaseDomain(""), "");
  assert.equal(Core.extractBaseDomain(null), "");
});

test("analyzeTabs computes activeBaseDomain, baseDomainTabIds, baseDomainCount, and baseDomainGroups", () => {
  const tabs = [
    { id: 1, url: "https://mail.google.com/mail/u/0", currentWindow: true, active: true },
    { id: 2, url: "https://docs.google.com/document/d/1", currentWindow: true, active: false },
    { id: 3, url: "https://calendar.google.com/calendar", currentWindow: true, active: false },
    { id: 4, url: "https://github.com/issues", currentWindow: true, active: false },
    { id: 5, url: "https://gist.github.com/user/1", currentWindow: true, active: false },
    { id: 6, url: "https://youtube.com/watch?v=1", currentWindow: true, active: false }
  ];

  const analysis = Core.analyzeTabs(tabs, tabs[0]);

  // Existing properties preserved
  assert.equal(analysis.activeDomain, "mail.google.com");
  assert.equal(analysis.domainCount, 1);
  assert.deepEqual(analysis.domainTabIds, [1]);

  // Base domain analysis
  assert.equal(analysis.activeBaseDomain, "google.com");
  assert.equal(analysis.baseDomainCount, 3);
  assert.deepEqual(analysis.baseDomainTabIds, [1, 2, 3]);

  // baseDomainGroups (sorted descending by count)
  assert.ok(Array.isArray(analysis.baseDomainGroups));
  assert.equal(analysis.baseDomainGroups.length, 2);
  assert.deepEqual(analysis.baseDomainGroups[0], {
    baseDomain: "google.com",
    tabIds: [1, 2, 3],
    count: 3
  });
  assert.deepEqual(analysis.baseDomainGroups[1], {
    baseDomain: "github.com",
    tabIds: [4, 5],
    count: 2
  });
});

test("buildResults surfaces act-group-base-domain, act-close-base-domain, and act-close-site-<baseDomain>", () => {
  const data = {
    activeTab: { id: 1, title: "Gmail", url: "https://mail.google.com/mail/u/0", groupId: -1 },
    tabs: [
      { id: 1, title: "Gmail", url: "https://mail.google.com/mail/u/0", currentWindow: true, active: true },
      { id: 2, title: "Google Docs", url: "https://docs.google.com/document/d/1", currentWindow: true, active: false },
      { id: 3, title: "Google Calendar", url: "https://calendar.google.com/calendar", currentWindow: true, active: false },
      { id: 4, title: "GitHub Issues", url: "https://github.com/issues", currentWindow: true, active: false },
      { id: 5, title: "GitHub Gist", url: "https://gist.github.com/user/1", currentWindow: true, active: false }
    ]
  };

  const res = Core.buildResults(data, ">", "all");

  // act-group-base-domain
  const groupBaseAct = res.items.find((i) => i.id === "act-group-base-domain");
  assert.ok(groupBaseAct, "act-group-base-domain should be present");
  assert.equal(groupBaseAct.title, "Group All google.com Website Tabs (3)…");
  assert.equal(groupBaseAct.subtitle, "Assign all 3 tabs across *.google.com into a group");
  assert.equal(groupBaseAct.badge, "Website");
  assert.equal(groupBaseAct.priority, 13.6);
  assert.deepEqual(groupBaseAct.actionDescriptor, {
    type: "OPEN_GROUP_PICKER",
    tabIds: [1, 2, 3],
    defaultTitle: "Mail",
    domain: "google.com"
  });

  // act-close-base-domain
  const closeBaseAct = res.items.find((i) => i.id === "act-close-base-domain");
  assert.ok(closeBaseAct, "act-close-base-domain should be present");
  assert.equal(closeBaseAct.title, "Close All google.com Website Tabs (3)");
  assert.equal(closeBaseAct.subtitle, "Closes all 3 unpinned tabs across *.google.com in this window");
  assert.equal(closeBaseAct.badge, "Website");
  assert.equal(closeBaseAct.priority, 11.6);
  assert.deepEqual(closeBaseAct.actionDescriptor, {
    type: "EXECUTE_ACTION",
    payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: "google.com" }
  });

  // Other multi-tab site in baseDomainGroups: act-close-site-github.com
  const closeSiteAct = res.items.find((i) => i.id === "act-close-site-github.com");
  assert.ok(closeSiteAct, "act-close-site-github.com should be present");
  assert.equal(closeSiteAct.title, "Close All github.com Website Tabs (2)");
  assert.equal(closeSiteAct.subtitle, "Closes all 2 unpinned tabs from github.com in this window");
  assert.equal(closeSiteAct.badge, "Website");
  assert.equal(closeSiteAct.priority, 9.2);
  assert.deepEqual(closeSiteAct.actionDescriptor, {
    type: "EXECUTE_ACTION",
    payload: { action: "CLOSE_BASE_DOMAIN_TABS", baseDomain: "github.com" }
  });
});

test("buildResults surfaces act-consolidate-groups when groups exist and counts only unpinned, ungrouped tabs", () => {
  const data = {
    activeTab: { id: 1, title: "Grouped Tab", url: "https://example.com/1", groupId: 10 },
    tabs: [
      { id: 1, title: "Grouped Tab", url: "https://example.com/1", groupId: 10, pinned: false, currentWindow: true, active: true },
      { id: 2, title: "Pinned Tab", url: "https://example.com/2", groupId: -1, pinned: true, currentWindow: true, active: false },
      { id: 3, title: "Ungrouped Tab A", url: "https://example.com/3", groupId: -1, pinned: false, currentWindow: true, active: false },
      { id: 4, title: "Ungrouped Tab B", url: "https://example.com/4", groupId: -1, pinned: false, currentWindow: false, active: false }
    ],
    tabGroups: [
      { id: 10, title: "Work", color: "blue", currentWindow: true, count: 1 }
    ],
    windows: [
      { id: 100, current: true, tabCount: 3 }
    ]
  };

  const res = Core.buildResults(data, ">", "all");
  const act = res.items.find((i) => i.id === "act-consolidate-groups");
  assert.ok(act, "act-consolidate-groups should be present");
  assert.equal(act.title, "Consolidate Groups Here & Separate Ungrouped Tabs");
  assert.equal(act.subtitle, "Keep 1 group(s) in this window and move 2 unpinned, ungrouped tab(s) to another window");
  assert.equal(act.badge, "Window");
  assert.deepEqual(act.actionDescriptor, {
    type: "EXECUTE_ACTION",
    payload: { action: "CONSOLIDATE_GROUPS_AND_SEPARATE_TABS" }
  });

  // Should not appear when there are no tab groups
  const noGroupsRes = Core.buildResults({ ...data, tabGroups: [] }, ">", "all");
  assert.equal(noGroupsRes.items.find((i) => i.id === "act-consolidate-groups"), undefined);
});

test("palette.css prevents modal chrome bars from shrinking vertically when .qc-list overflows", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "palette.css"), "utf8");
  for (const selector of [".qc-search-row", ".qc-chips", ".qc-color-bar", ".qc-split-bar", ".qc-footer"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `${selector} rule should exist in palette.css`);
    assert.match(
      match[1],
      /flex-shrink\s*:\s*0\s*;/,
      `${selector} must set flex-shrink: 0 so overflow-x/flex layout cannot squish its vertical padding`
    );
  }
});

test("getAvailableSplitLayouts returns appropriate layout options for 2, 3, 4, and 5+ tabs", () => {
  assert.deepEqual(Core.getAvailableSplitLayouts(1), []);
  assert.deepEqual(
    Core.getAvailableSplitLayouts(2).map((l) => l.id),
    ["native", "cols", "rows"]
  );
  assert.deepEqual(
    Core.getAvailableSplitLayouts(3).map((l) => l.id),
    ["cols", "master-stack"]
  );
  assert.deepEqual(
    Core.getAvailableSplitLayouts(4).map((l) => l.id),
    ["grid", "cols"]
  );
  assert.deepEqual(
    Core.getAvailableSplitLayouts(5).map((l) => l.id),
    ["grid"]
  );
});

test("computeSplitLayouts tiles 2, 3, 4, and 5 tabs cleanly within screen bounds", () => {
  const bounds = { left: 100, top: 25, width: 1441, height: 901 };

  // 2 tabs side-by-side (odd width distributes remainder pixel cleanly)
  const twoCols = Core.computeSplitLayouts(2, bounds, "cols");
  assert.deepEqual(twoCols, [
    { left: 100, top: 25, width: 721, height: 901 },
    { left: 821, top: 25, width: 720, height: 901 }
  ]);

  // 2 tabs top-and-bottom
  const twoRows = Core.computeSplitLayouts(2, bounds, "rows");
  assert.deepEqual(twoRows, [
    { left: 100, top: 25, width: 1441, height: 451 },
    { left: 100, top: 476, width: 1441, height: 450 }
  ]);

  // 3 tabs 1+2 master-stack
  const threeMaster = Core.computeSplitLayouts(3, bounds, "master-stack");
  assert.deepEqual(threeMaster, [
    { left: 100, top: 25, width: 721, height: 901 },
    { left: 821, top: 25, width: 720, height: 451 },
    { left: 821, top: 476, width: 720, height: 450 }
  ]);

  // 4 tabs 2x2 grid
  const fourGrid = Core.computeSplitLayouts(4, bounds, "grid");
  assert.equal(fourGrid.length, 4);
  assert.equal(fourGrid[0].width + fourGrid[1].width, bounds.width);
  assert.equal(fourGrid[0].height + fourGrid[2].height, bounds.height);

  // 5 tabs auto-grid (3 on top row, 2 filling bottom row)
  const fiveGrid = Core.computeSplitLayouts(5, bounds, "grid");
  assert.equal(fiveGrid.length, 5);
  assert.equal(fiveGrid[0].width + fiveGrid[1].width + fiveGrid[2].width, bounds.width);
  assert.equal(fiveGrid[3].width + fiveGrid[4].width, bounds.width);
  assert.equal(fiveGrid[0].height + fiveGrid[3].height, bounds.height);
});

test("buildResults surfaces act-split-tabs when 2 or more tabs are open", () => {
  const twoTabsData = {
    activeTab: { id: 1, windowId: 10, title: "One", url: "https://one.com" },
    tabs: [
      { id: 1, windowId: 10, title: "One", url: "https://one.com", active: true },
      { id: 2, windowId: 10, title: "Two", url: "https://two.com" }
    ],
    windows: [{ id: 10, tabCount: 2 }]
  };
  const res = Core.buildResults(twoTabsData, "> split", "all");
  const splitAct = res.items.find((i) => i.id === "act-split-tabs");
  assert.ok(splitAct, "act-split-tabs should appear when >= 2 tabs are open");
  assert.deepEqual(splitAct.actionDescriptor, {
    type: "OPEN_SPLIT_PICKER",
    tabIds: [1]
  });

  const oneTabRes = Core.buildResults(
    {
      ...twoTabsData,
      tabs: [twoTabsData.tabs[0]]
    },
    "> split",
    "all"
  );
  assert.equal(oneTabRes.items.find((i) => i.id === "act-split-tabs"), undefined);

  const splitActiveRes = Core.buildResults(
    {
      ...twoTabsData,
      activeTab: { ...twoTabsData.activeTab, splitViewId: 42 }
    },
    "> unsplit",
    "all"
  );
  const unsplitAct = splitActiveRes.items.find((i) => i.id === "act-unsplit-tab");
  assert.ok(unsplitAct, "act-unsplit-tab should appear when activeTab has a splitViewId");
  assert.deepEqual(unsplitAct.actionDescriptor, {
    type: "EXECUTE_ACTION",
    payload: { action: "UNSPLIT_TAB", splitViewId: 42 }
  });
});

test("command actions and copy descriptors do not keep the palette open after running", () => {
  const data = {
    activeTab: { id: 1, windowId: 10, title: "Example", url: "https://sub.example.com/page?utm_source=x", groupId: 5, splitViewId: 42 },
    tabs: [
      { id: 1, windowId: 10, title: "Example", url: "https://sub.example.com/page?utm_source=x", active: true, audible: true, groupId: 5, splitViewId: 42 },
      { id: 2, windowId: 10, title: "Example 2", url: "https://sub.example.com/other", audible: false, groupId: -1 },
      { id: 3, windowId: 11, title: "Root", url: "https://example.com/", audible: false, groupId: -1 }
    ],
    tabGroups: [{ id: 5, title: "Work", color: "blue", currentWindow: true, tabCount: 1 }],
    windows: [
      { id: 10, current: true, tabCount: 2 },
      { id: 11, current: false, tabCount: 1 }
    ],
    bookmarks: [],
    themes: [{ id: "theme-1", name: "Dark Theme", enabled: false }],
    extensions: [{ id: "ext-1", name: "Test Ext", enabled: true }]
  };

  for (const query of [">", "/t", "/e"]) {
    const res = Core.buildResults(data, query, "all");
    for (const item of res.items) {
      const type = item.actionDescriptor?.type;
      if (type === "EXECUTE_ACTION" || type === "COPY_TEXT") {
        assert.notEqual(item.keepsOpen, true, `${item.id} should not have keepsOpen: true`);
        assert.notEqual(item.actionDescriptor.keepsOpen, true, `${item.id} actionDescriptor should not have keepsOpen: true`);
      }
    }
  }
});
