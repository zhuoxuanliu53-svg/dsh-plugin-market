// dsh-plugin-market client bundle (hand-written, no build step).
// Format mirrors the DSH client preset: window.__ModuleLoader__.load({id, factory}),
// with react resolved from the loader module table. No JSX/TS — React.createElement only.
window.__ModuleLoader__.load({ id: "dsh-plugin-market", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;

  var React = require("react");
  var createElement = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;

  var CSS = "\
.pm-root{font-family:inherit;color:var(--dsw-alias-label-primary);box-sizing:border-box}\n\
.pm-root *{box-sizing:border-box}\n\
.pm-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}\n\
.pm-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}\n\
.pm-link{color:var(--dsw-alias-brand-primary);text-decoration:none}\n\
.pm-count{font-size:12px;color:var(--dsw-alias-label-secondary)}\n\
.pm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}\n\
.pm-input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);padding:4px 8px;font-size:13px;min-width:180px}\n\
.pm-select{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);padding:4px 6px;font-size:12px}\n\
.pm-btn{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);padding:4px 10px;font-size:12px;cursor:pointer}\n\
.pm-btn:hover{border-color:var(--dsw-alias-brand-primary)}\n\
.pm-btn.active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}\n\
.pm-btn:disabled{opacity:.55;cursor:default}\n\
.pm-tags-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}\n\
.pm-tag{font-size:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:1px 8px;line-height:16px;cursor:pointer}\n\
.pm-tag.active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}\n\
.pm-list{display:flex;flex-direction:column;gap:8px}\n\
.pm-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px}\n\
.pm-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}\n\
.pm-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);text-decoration:none}\n\
.pm-name:hover{color:var(--dsw-alias-brand-primary)}\n\
.pm-stats{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}\n\
.pm-byline{display:flex;gap:6px;margin-top:2px;align-items:center;flex-wrap:wrap}\n\
.pm-desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n\
.pm-actions{display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap}\n\
.pm-badge{font-size:10px;border-radius:10px;padding:0 8px;line-height:16px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}\n\
.pm-badge.curated{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}\n\
.pm-badge.community{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}\n\
.pm-badge.installed{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}\n\
.pm-badge.update{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}\n\
.pm-cmd{font-size:11px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px 8px;margin-top:6px;white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-secondary)}\n\
.pm-msg{font-size:11px;margin-top:6px}\n\
.pm-err{color:var(--dsw-alias-state-error-primary);font-size:12px}\n\
.pm-ok{color:var(--dsw-alias-state-success-primary)}\n\
.pm-warn{color:var(--dsw-alias-state-warn-primary)}\n\
.pm-empty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:16px 0;text-align:center}\n\
.pm-sentinel{font-size:12px;color:var(--dsw-alias-label-secondary);padding:12px 0;text-align:center}\n\
.pm-auto{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}\n\
.pm-modal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}\n\
.pm-modal-box{background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px;max-width:640px;width:92%;max-height:80vh;overflow:auto;display:flex;flex-direction:column;gap:10px}\n\
.pm-modal-title{font-size:14px;font-weight:600}\n\
.pm-textarea{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);padding:6px 8px;font-size:12px;min-height:120px;width:100%;font-family:monospace;resize:vertical}\n\
.pm-modal-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}\n\
";

  // ---- API 帮助 ----

  function apiGet(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
      return r.json().then(function (b) {
        if (!r.ok) throw new Error((b && b.error && b.error.message) || ("HTTP " + r.status));
        return b;
      });
    });
  }

  function apiPost(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (b) {
        if (!r.ok) throw new Error((b && b.error && b.error.message) || ("HTTP " + r.status));
        return b;
      });
    });
  }

  // ---- 排序 ----

  var SORTS = [
    { key: "stars-desc", label: "热门：星标最多" },
    { key: "stars-asc", label: "热门：星标最少" },
    { key: "forks-desc", label: "Fork 最多" },
    { key: "updated-desc", label: "最近更新" },
    { key: "created-desc", label: "发布时间：最新" },
    { key: "created-asc", label: "发布时间：最早" },
    { key: "name-asc", label: "名称 A-Z" },
    { key: "update-first", label: "有更新优先" },
  ];

  function MarketApp() {
    var stateRef = useState({ phase: "loading", merged: [], bundles: [], skills: [], presets: [], otherCount: 0, warnings: [], fetchedAt: 0, error: null });
    var state = stateRef[0];
    var setState = stateRef[1];

    var tabRef = useState("bundle");
    var tab = tabRef[0];
    var setTab = tabRef[1];

    var othersRef = useState([]);
    var others = othersRef[0];
    var setOthers = othersRef[1];

    var PAGE_SIZE = 100;
    var visibleRef = useState(PAGE_SIZE);
    var visibleCount = visibleRef[0];
    var setVisibleCount = visibleRef[1];
    var sentinelRef = useRef(null);

    var followsRef = useState([]);
    var follows = followsRef[0];
    var setFollows = followsRef[1];

    var installedRef = useState({});
    var installed = installedRef[0];
    var setInstalled = installedRef[1];

    var queryRef = useState("");
    var query = queryRef[0];
    var setQuery = queryRef[1];

    var sortRef = useState("stars-desc");
    var sortKey = sortRef[0];
    var setSortKey = sortRef[1];

    var tagRef = useState("");
    var tag = tagRef[0];
    var setTag = tagRef[1];

    var onlyFollowsRef = useState(false);
    var onlyFollows = onlyFollowsRef[0];
    var setOnlyFollows = onlyFollowsRef[1];

    var onlyInstalledRef = useState(false);
    var onlyInstalled = onlyInstalledRef[0];
    var setOnlyInstalled = onlyInstalledRef[1];

    var opsRef = useState({});
    var ops = opsRef[0];
    var setOps = opsRef[1];

    var modalRef = useState("");
    var modal = modalRef[0];
    var setModal = modalRef[1];

    var exportTextRef = useState("");
    var exportText = exportTextRef[0];
    var setExportText = exportTextRef[1];

    var importTextRef = useState("");
    var importText = importTextRef[0];
    var setImportText = importTextRef[1];

    var importPreviewRef = useState(null);
    var importPreview = importPreviewRef[0];
    var setImportPreview = importPreviewRef[1];

    var importResultsRef = useState(null);
    var importResults = importResultsRef[0];
    var setImportResults = importResultsRef[1];

    var importBusyRef = useState(false);
    var importBusy = importBusyRef[0];
    var setImportBusy = importBusyRef[1];

    var tokenRef = useState("");
    var token = tokenRef[0];
    var setToken = tokenRef[1];

    function refresh(force) {
      setState(function (s) { return { phase: (s.merged && s.merged.length) ? s.phase : "loading", merged: s.merged, bundles: s.bundles, skills: s.skills, presets: s.presets, otherCount: s.otherCount, warnings: s.warnings, fetchedAt: s.fetchedAt, error: null }; });
      apiGet("/pm/registry").then(function (r) {
        setState({ phase: "ready", merged: r.merged || [], bundles: r.bundles || [], skills: r.skills || [], presets: r.presets || [], otherCount: r.otherCount || 0, warnings: r.warnings || [], fetchedAt: r.fetchedAt || 0, error: null });
      }).catch(function (e) {
        setState({ phase: "error", merged: [], bundles: [], skills: [], presets: [], otherCount: 0, warnings: [], fetchedAt: 0, error: e.message });
      });
      apiGet("/pm/state").then(function (r) {
        setFollows(r.follows || []);
        setInstalled(r.installed || {});
      }).catch(function () {});
    }

    function loadOthers() {
      if (others.length > 0) return;
      apiGet("/pm/others").then(function (r) {
        setOthers(r.others || []);
      }).catch(function () {});
    }

    function doRestart() {
      setOps(function (m) { var n = Object.assign({}, m); n["__restart__"] = { running: "restart", result: null }; return n; });
      apiPost("/pm/restart").then(function (r) {
        setOps(function (m) { var n = Object.assign({}, m); n["__restart__"] = { running: null, result: { status: "ok", message: r.message || "正在重启…" } }; return n; });
      }).catch(function (e) {
        setOps(function (m) { var n = Object.assign({}, m); n["__restart__"] = { running: null, result: { status: "failed", message: String(e && e.message || e) } }; return n; });
      });
    }

    function selfUpdate() {
      setOps(function (m) { var n = Object.assign({}, m); n["__self__"] = { running: "update", result: null }; return n; });
      apiPost("/pm/self-update").then(function (r) {
        setOps(function (m) {
          var n = Object.assign({}, m);
          n["__self__"] = { running: null, result: { status: r.status || "ok", message: r.message || "已更新", needsRestart: r.needsRestart } };
          return n;
        });
      }).catch(function (e) {
        setOps(function (m) { var n = Object.assign({}, m); n["__self__"] = { running: null, result: { status: "failed", message: String(e && e.message || e) } }; return n; });
      });
    }

    useEffect(function () { refresh(false); }, []);

    function setOp(name, patch) {
      setOps(function (m) { var n = Object.assign({}, m); n[name] = Object.assign({}, m[name], patch); return n; });
    }

    function runOp(name, path, verb) {
      var cur = ops[name];
      if (cur && cur.running) return;
      setOp(name, { running: verb, result: null });
      apiPost(path, { id: name }).then(function (r) {
        setOp(name, { running: null, result: r || { status: "failed", message: "无响应" } });
        refresh(false);
      }).catch(function (e) {
        setOp(name, { running: null, result: { status: "failed", message: String(e && e.message || e) } });
      });
    }

    function toggleFollow(name) {
      apiPost("/pm/follow", { id: name }).then(function (r) {
        if (r && Array.isArray(r.follows)) setFollows(r.follows);
      }).catch(function () {});
    }

    function toggleAutoUpdate(name) {
      var rec = installed[name];
      apiPost("/pm/auto-update", { id: name, enabled: !(rec && rec.autoUpdate) }).then(function (r) {
        if (r && r.installed) setInstalled(r.installed);
      }).catch(function () {});
    }

    function toggleHot(name, disabled) {
      apiPost("/pm/hot", { id: name, disabled: disabled }).then(function (r) {
        setOp(name, { running: null, result: { status: r.error ? "failed" : "ok", message: r.error ? r.error.message : (disabled ? "已停用（HMR 生效）" : "已启用（HMR 生效）") } });
        refresh(false);
      }).catch(function (e) {
        setOp(name, { running: null, result: { status: "failed", message: String(e && e.message || e) } });
      });
    }

    function updateAll() {
      apiPost("/pm/update-all").then(function (r) {
        setOps(function (m) { var n = Object.assign({}, m); n["__all__"] = { result: { status: "ok", message: "已触发全部更新" } }; return n; });
        refresh(false);
      }).catch(function (e) {
        setOps(function (m) { var n = Object.assign({}, m); n["__all__"] = { result: { status: "failed", message: String(e && e.message || e) } }; return n; });
      });
    }

    function doExport() {
      apiGet("/pm/manifest/export").then(function (r) {
        setExportText(r.text || "");
        setModal("export");
      }).catch(function (e) {
        setExportText("导出失败：" + (e && e.message || e));
        setModal("export");
      });
    }

    function doImportPreview() {
      setImportBusy(true);
      setImportPreview(null);
      setImportResults(null);
      apiPost("/pm/manifest/preview", { manifestText: importText }).then(function (r) {
        setImportPreview(r || { ok: false, errors: ["无响应"] });
      }).catch(function (e) {
        setImportPreview({ items: [], errors: [String(e && e.message || e)] });
      }).then(function () { setImportBusy(false); });
    }

    function doImportApply() {
      setImportBusy(true);
      apiPost("/pm/manifest/apply", { manifestText: importText }).then(function (r) {
        setImportResults(r || { results: {}, errors: ["无响应"] });
        refresh(false);
      }).catch(function (e) {
        setImportResults({ results: {}, errors: [String(e && e.message || e)] });
      }).then(function () { setImportBusy(false); });
    }

    function saveToken() {
      apiPost("/pm/token", { token: token }).then(function () {
        setModal("");
        refresh(true);
      }).catch(function (e) {
        setOps(function (m) { var n = Object.assign({}, m); n["__all__"] = { result: { status: "failed", message: "Token 保存失败：" + (e && e.message || e) } }; return n; });
      });
    }

    // ---- 派生数据 ----

    var followSet = {};
    for (var i = 0; i < follows.length; i++) followSet[follows[i]] = true;

    var baseList = tab === "skill" ? state.skills
      : tab === "preset" ? state.presets
      : tab === "other" ? others
      : state.bundles;

    var tagCounts = {};
    var p, t;
    for (i = 0; i < baseList.length; i++) {
      p = baseList[i];
      if (!p.topics) continue;
      for (var j = 0; j < p.topics.length; j++) {
        t = p.topics[j];
        if (t === "dsh-plugin") continue;
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    var tagNames = Object.keys(tagCounts).sort(function (a, b) { return tagCounts[b] - tagCounts[a]; }).slice(0, 12);

    function hasUpdate(entry) {
      var rec = installed[entry.id];
      if (!rec || !rec.installedAt || !entry.pushedAt) return false;
      return new Date(entry.pushedAt).getTime() > rec.installedAt;
    }

    var q = query.trim().toLowerCase();
    var list = baseList.filter(function (entry) {
      if (q) {
        var hay = (entry.fullName + " " + (entry.displayName || "") + " " + (entry.description || "") + " " + (entry.topics || []).join(" ")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      if (tag && (entry.topics || []).indexOf(tag) < 0) return false;
      if (onlyFollows && !followSet[entry.id]) return false;
      if (onlyInstalled && !installed[entry.id]) return false;
      return true;
    });

    var cmp = {
      "stars-desc": function (a, b) { return b.stars - a.stars; },
      "stars-asc": function (a, b) { return a.stars - b.stars; },
      "forks-desc": function (a, b) { return b.forks - a.forks; },
      "updated-desc": function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); },
      "created-desc": function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); },
      "created-asc": function (a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); },
      "name-asc": function (a, b) { return a.fullName.localeCompare(b.fullName); },
      "update-first": function (a, b) {
        var ua = hasUpdate(a) ? 1 : 0;
        var ub = hasUpdate(b) ? 1 : 0;
        if (ua !== ub) return ub - ua;
        return b.stars - a.stars;
      },
    };
    list = list.slice().sort(cmp[sortKey] || cmp["stars-desc"]);

    // 切换 tab / 搜索 / 排序 / 筛选时回到首屏。
    useEffect(function () { setVisibleCount(PAGE_SIZE); }, [tab, query, sortKey, tag, onlyFollows, onlyInstalled]);

    // 滚动触底加载下一页（IntersectionObserver 观察哨兵）。
    useEffect(function () {
      var el = sentinelRef.current;
      if (!el || visibleCount >= list.length) return;
      if (typeof IntersectionObserver === "undefined") return;
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) setVisibleCount(function (v) { return v + PAGE_SIZE; });
        }
      }, { rootMargin: "200px" });
      io.observe(el);
      return function () { io.disconnect(); };
    }, [visibleCount, list.length]);

    var visibleList = list.slice(0, visibleCount);

    // ---- 渲染 ----

    function renderCard(entry) {
      var followed = !!followSet[entry.id];
      var rec = installed[entry.id];
      var op = ops[entry.id];
      var upd = hasUpdate(entry);
      var running = op && op.running;
      var opResult = op && op.result;
      var isCurated = entry.source === "curated";
      var tags = (entry.topics || []).filter(function (x) { return x !== "dsh-plugin"; }).slice(0, 4);

      return createElement("div", { className: "pm-card", key: entry.id },
        createElement("div", { className: "pm-card-head" },
          createElement("a", { className: "pm-name", href: entry.url, target: "_blank", rel: "noreferrer" }, entry.displayName || entry.fullName),
          createElement("span", { className: "pm-stats" }, "★ " + entry.stars + " · ⑂ " + entry.forks)
        ),
        createElement("div", { className: "pm-byline" },
          createElement("span", { className: "pm-stats" }, entry.fullName),
          entry.subpath ? createElement("span", { className: "pm-badge" }, "#path:/" + entry.subpath) : null
        ),
        createElement("div", { className: "pm-actions" },
          createElement("span", { className: "pm-badge " + (isCurated ? "curated" : "community") }, isCurated ? "已审核" : "社区"),
          createElement("span", { className: "pm-badge" }, entry.shape === "skill" ? "技能" : entry.shape === "preset" ? "预设" : "插件"),
          rec ? createElement("span", { className: "pm-badge " + (upd ? "update" : "installed") }, upd ? "有更新" : "已安装") : null,
          entry.category ? createElement("span", { className: "pm-stats" }, entry.category) : null,
          entry.language ? createElement("span", { className: "pm-stats" }, entry.language) : null
        ),
        entry.description ? createElement("div", { className: "pm-desc" }, entry.description) : null,
        tags.length ? createElement("div", { className: "pm-tags-row" }, tags.map(function (tg) { return createElement("span", { className: "pm-tag", key: tg }, tg); })) : null,
        createElement("div", { className: "pm-actions" },
          createElement("button", { className: "pm-btn" + (followed ? " active" : ""), onClick: function () { toggleFollow(entry.id); } }, followed ? "已关注" : "关注"),
          rec
            ? createElement("button", { className: "pm-btn", disabled: !!running, onClick: function () { runOp(entry.id, "/pm/update", "update"); } }, "更新")
            : createElement("button", { className: "pm-btn", disabled: !!running, onClick: function () { runOp(entry.id, "/pm/install", "install"); } }, running === "install" ? "安装中…" : "安装"),
          rec ? createElement("button", { className: "pm-btn", disabled: !!running, onClick: function () { runOp(entry.id, "/pm/remove", "remove"); } }, "卸载") : null,
          rec ? createElement("label", { className: "pm-auto" },
            createElement("input", { type: "checkbox", checked: !!rec.autoUpdate, onChange: function () { toggleAutoUpdate(entry.id); } }),
            "自动更新") : null,
          rec ? createElement("button", { className: "pm-btn", onClick: function () { toggleHot(entry.id, true); } }, "停用") : null
        ),
        running ? createElement("div", { className: "pm-msg pm-warn" }, running === "install" ? "安装中…" : running === "update" ? "更新中…" : "卸载中…") : null,
        opResult && opResult.command ? createElement("div", { className: "pm-cmd" }, "$ " + opResult.command) : null,
        opResult && opResult.message ? createElement("div", { className: "pm-msg " + (opResult.status === "ok" ? "pm-ok" : "pm-err") }, opResult.message) : null,
        opResult && opResult.needsRestart ? createElement("button", { className: "pm-btn active", onClick: doRestart }, "重启以生效") : null,
        rec && rec.installedAt ? createElement("div", { className: "pm-stats", style: { marginTop: "4px" } }, "安装于 " + new Date(rec.installedAt).toLocaleDateString()) : null
      );
    }

    function copyExport() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(exportText).then(function () {
          setOps(function (m) { var n = Object.assign({}, m); n["__export__"] = { result: { status: "ok", message: "已复制到剪贴板" } }; return n; });
        }).catch(function () {});
      }
    }

    function renderExportModal() {
      return createElement("div", { className: "pm-modal", onClick: function () { setModal(""); } },
        createElement("div", { className: "pm-modal-box", onClick: function (e) { e.stopPropagation(); } },
          createElement("div", { className: "pm-modal-title" }, "导出插件名单（纯文本）"),
          createElement("textarea", { className: "pm-textarea", readOnly: true, value: exportText, style: { minHeight: "200px" } }),
          createElement("div", { className: "pm-modal-actions" },
            createElement("button", { className: "pm-btn active", onClick: copyExport }, "复制"),
            createElement("span", { className: "pm-stats" }, "直接发到评论区，他人粘贴回市场导入即可复刻。"),
            createElement("button", { className: "pm-btn", onClick: function () { setModal(""); } }, "关闭")
          )
        )
      );
    }

    function renderImportModal() {
      return createElement("div", { className: "pm-modal", onClick: function () { setModal(""); } },
        createElement("div", { className: "pm-modal-box", onClick: function (e) { e.stopPropagation(); } },
          createElement("div", { className: "pm-modal-title" }, "导入插件名单"),
          createElement("textarea", { className: "pm-textarea", placeholder: "粘贴纯文本：每行一个（插件 spec / skill:github:owner/repo / preset:github:owner/repo），# 开头为注释", value: importText, onChange: function (e) { setImportText(e.target.value); } }),
          createElement("div", { className: "pm-modal-actions" },
            createElement("button", { className: "pm-btn", disabled: importBusy, onClick: doImportPreview }, "预览"),
            importPreview && !importPreview.errors && importPreview.items ? createElement("button", { className: "pm-btn active", disabled: importBusy, onClick: doImportApply }, "应用导入") : null,
            createElement("button", { className: "pm-btn", onClick: function () { setModal(""); } }, "关闭")
          ),
          importPreview && importPreview.errors && importPreview.errors.length ? createElement("div", { className: "pm-err" }, "预览失败：" + importPreview.errors.join("；")) : null,
          importPreview && importPreview.items ? createElement("div", { className: "pm-ok" }, "清单有效：" + importPreview.items.length + " 项") : null,
          importResults ? createElement("div", {},
            (importResults.errors || []).length ? createElement("div", { className: "pm-err" }, "导入出错：" + importResults.errors.join("；")) : createElement("div", { className: "pm-ok" }, "导入完成")
          ) : null
        )
      );
    }

    function renderTokenModal() {
      return createElement("div", { className: "pm-modal", onClick: function () { setModal(""); } },
        createElement("div", { className: "pm-modal-box", onClick: function (e) { e.stopPropagation(); } },
          createElement("div", { className: "pm-modal-title" }, "GitHub Token（可选）"),
          createElement("input", { className: "pm-input", placeholder: "粘贴 PAT 提限（10→30 次/分）", value: token, onChange: function (e) { setToken(e.target.value); } }),
          createElement("div", { className: "pm-modal-actions" },
            createElement("button", { className: "pm-btn active", onClick: saveToken }, "保存"),
            createElement("button", { className: "pm-btn", onClick: function () { setModal(""); } }, "取消")
          ),
          createElement("div", { className: "pm-stats" }, "只存本机 profile，不进导出、不上传。")
        )
      );
    }

    if (state.phase === "loading") {
      return createElement("div", { className: "pm-root" }, "正在加载插件市场…");
    }
    if (state.phase === "error") {
      return createElement("div", { className: "pm-root" },
        createElement("div", { className: "pm-err" }, "无法加载插件列表：" + (state.error || "未知错误")),
        createElement("div", { className: "pm-actions" }, createElement("button", { className: "pm-btn", onClick: function () { refresh(true); } }, "重试"))
      );
    }

    return createElement("div", { className: "pm-root" },
      createElement("div", { className: "pm-head" },
        createElement("span", { className: "pm-title" }, "插件市场"),
        createElement("span", { className: "pm-count" }, (tab === "skill" ? "技能" : tab === "preset" ? "预设" : tab === "other" ? "其他" : "插件") + " " + baseList.length + " 个"),
        createElement("button", { className: "pm-btn", onClick: function () { refresh(true); } }, "刷新"),
        createElement("button", { className: "pm-btn", onClick: updateAll }, "更新全部"),
        createElement("button", { className: "pm-btn", onClick: selfUpdate }, "更新市场"),
        createElement("button", { className: "pm-btn", onClick: doExport }, "导出名单"),
        createElement("button", { className: "pm-btn", onClick: function () { setImportPreview(null); setImportResults(null); setModal("import"); } }, "导入名单"),
        createElement("button", { className: "pm-btn", onClick: function () { setModal("token"); } }, "Token")
      ),
      (state.warnings || []).length ? createElement("div", { className: "pm-msg pm-warn" }, state.warnings.join("；")) : null,
      (ops["__self__"] && ops["__self__"].result) ? createElement("div", { className: "pm-actions" },
        createElement("span", { className: "pm-msg " + (ops["__self__"].result.status === "ok" ? "pm-ok" : "pm-err") }, "市场：" + ops["__self__"].result.message),
        ops["__self__"].result.needsRestart ? createElement("button", { className: "pm-btn active", onClick: doRestart }, "重启以生效") : null
      ) : null,
      createElement("div", { className: "pm-toolbar" },
        createElement("button", { className: "pm-btn" + (tab === "bundle" ? " active" : ""), onClick: function () { setTab("bundle"); } }, "插件（" + state.bundles.length + "）"),
        createElement("button", { className: "pm-btn" + (tab === "skill" ? " active" : ""), onClick: function () { setTab("skill"); } }, "技能（" + state.skills.length + "）"),
        createElement("button", { className: "pm-btn" + (tab === "preset" ? " active" : ""), onClick: function () { setTab("preset"); } }, "预设（" + state.presets.length + "）"),
        createElement("button", { className: "pm-btn" + (tab === "other" ? " active" : ""), onClick: function () { setTab("other"); loadOthers(); } }, "其他（" + state.otherCount + "）")
      ),
      createElement("div", { className: "pm-toolbar" },
        createElement("input", { className: "pm-input", placeholder: "搜索名称或标签…", value: query, onChange: function (e) { setQuery(e.target.value); } }),
        createElement("select", { className: "pm-select", value: sortKey, onChange: function (e) { setSortKey(e.target.value); } },
          SORTS.map(function (s) { return createElement("option", { key: s.key, value: s.key }, s.label); })),
        createElement("button", { className: "pm-btn" + (onlyFollows ? " active" : ""), onClick: function () { setOnlyFollows(!onlyFollows); } }, "只看关注（" + follows.length + "）"),
        createElement("button", { className: "pm-btn" + (onlyInstalled ? " active" : ""), onClick: function () { setOnlyInstalled(!onlyInstalled); } }, "只看已安装")
      ),
      tagNames.length ? createElement("div", { className: "pm-tags-row" },
        tagNames.map(function (tg) { return createElement("span", { className: "pm-tag" + (tag === tg ? " active" : ""), key: tg, onClick: function () { setTag(tag === tg ? "" : tg); } }, tg + " (" + tagCounts[tg] + ")"); })) : null,
      list.length ? createElement("div", { className: "pm-list" },
        visibleList.map(renderCard),
        visibleCount < list.length ? createElement("div", { className: "pm-sentinel", ref: sentinelRef }, "加载更多…") : null
      ) : createElement("div", { className: "pm-empty" }, "没有匹配的插件"),
      modal === "export" ? renderExportModal() : null,
      modal === "import" ? renderImportModal() : null,
      modal === "token" ? renderTokenModal() : null
    );
  }

  var name = "dsh-plugin-market";
  var inject = ["slots"];

  function apply(ctx) {
    var style = document.createElement("style");
    style.setAttribute("data-plugin", "dsh-plugin-market");
    style.textContent = CSS;
    document.head.appendChild(style);

    ctx.effect(function () {
      return function () { if (style.parentNode) style.parentNode.removeChild(style); };
    }, "dsh-plugin-market: css");

    ctx.slots.inject("settings.section", function () {
      return ctx.slots.register(
        { name: "settings.section", id: "plugin-market", order: 40, label: "插件市场" },
        function () { return createElement(MarketApp); }
      );
    });
  }

  module.exports = { name: name, inject: inject, apply: apply };
  return module.exports;
}});
