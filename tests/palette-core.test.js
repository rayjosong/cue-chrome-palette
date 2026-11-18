const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../palette-core.js");

test("Mode definitions and getModeDefinition cover all modes without falling back to All", () => {
  assert.equal(Core.getModeDefinition("tabs").label, "Tabs");
  assert.equal(Core.getModeDefinition("unknown").label, "All");
  for (const mode of ["all", "tabs", "groups", "commands", "bookmarks", "history", "closed", "themes"]) {
    const def = Core.getModeDefinition(mode);
    assert.ok(def);
    assert.equal(def.id, mode);
    if (mode !== "all") {
      assert.notEqual(def.label, "All");
    }
  }
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
