const test = require("node:test");
const assert = require("node:assert/strict");
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
