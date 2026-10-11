/* sims/a3e03-v1.0.1.js  (published as sims/a3e03.js)
   Case a3e03 "The Vault of Vectors": a vector index lab for the Kestle Moor Seed Bank. A shelf of
   1,000 chunks, drawn in 2-D so it can be seen, stands in for Seedline's 24 million. The learner
   sets ef_search, top-k, the filter mode (post-filter, iterative index scan, pre-filter), the
   Kestle Moor filter, the index or exact search, and the embedding model's size, and reads the
   nodes visited, the candidates, what passed the filter, recall against exact search, and the
   distance computations. Widget-style sim: it draws its own shelf inside api.root. No real model.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 renames: Brantholme (the third bank) and Silas Tebbit (the collector); the case is
     content/latent/a3/a3e03-v1.0.1.json
   v1.0.0 (2026-10-11) first version: a deterministic 1,000-point shelf, a small three-layer
     HNSW-like graph, post-filter / iterative scan / pre-filter, exact search, two model sizes,
     recall on 50 sample queries, full-size memory and cost. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - A chunk is a point in the unit square. The score is a teaching stand-in for cosine
     similarity: score = 1 - straight-line distance to the query. The query (the clean catalogue
     text) sits at (0.5, 0.5).
   - Fixed points: three safety duplicates (Ellerbeck at distance 0.03, Ravensby 0.04, Brantholme
     0.04, so scores 0.97, 0.96, 0.96); Solenne's own record, Kestle Moor KM-1958-0347, the faded
     scan, at distance 0.29 (score 0.71); 60 barley notes from other banks between 0.11 and 0.25.
     The other 936 points fill the square on a jittered 35 x 35 grid outside radius 0.26; 19 of
     them, all beyond 0.35, belong to Kestle Moor. So Kestle Moor holds 20 of 1,000 rows: 2 percent,
     as in the story (480,000 of 24 million). hash32 (FNV-1a plus the murmur3 finalizer) supplies
     every jitter, so the shelf is the same on every load; nothing here is random.
   - Graph: each point's layer comes from hash32("tier-" + i) mod 100: under 1 is layer 2, under
     10 is layer 1, else layer 0 (6 points reach layer 2, 99 reach layer 1). On each layer a point
     links to its nearest 2 (upper layers) or 3 (ground layer) on that layer, and every link runs
     both ways. Search: greedy descent from the entry point (the first layer-2 point) through
     layers 2 and 1, then the ground layer with a candidate list of ef_search (Malkov and
     Yashunin's algorithm 2). Every score computed counts as one distance computation.
   - Post-filter: the ef_search candidates, then the filter, then the top k. As in pgvector, top-k
     above ef_search can't return more than ef_search rows.
   - Iterative scan: the same search, but once the normal stop is reached it keeps expanding the
     nearest unexpanded candidate until k rows have passed the filter (relaxed order) or 400 rows
     have been visited (this shelf's max scan tuples; pgvector's default is 20,000).
   - Pre-filter: only the rows that pass the filter, each scored exactly.
   - Exact: every row scored, then filtered. The 3,072 model can't use the index (pgvector's vector
     type indexes up to 2,000 dimensions), so every search is exact; the shelf keeps its points,
     because the faded note says the same thing to any model (a teaching simplification).

   Where every number comes from (the case is content/latent/a3/a3e03-v1.0.1.json):
   - Full size: 24,000,000 chunks x 1,024 numbers x 4 bytes = 98,304,000,000 bytes, 98.3 GB, on a
     server with 256 GB of memory. At 3,072 numbers: 294.9 GB.
   - Exact search: 24,000,000 x 1,024 = 24,576,000,000 multiply-adds, 24.6 billion. Teaching rate
     2 billion multiply-adds a second (reading 8 GB a second): 12.3 s. At 3,072: 73.7 billion,
     36.9 s. Pre-filter: 480,000 x 1,024 = 491,520,000, 491.5 million, 0.25 s.
   - The story's search (post-filter, ef_search 40, top 5, Kestle Moor only): 40 candidates, the 3
     duplicates and 37 barley notes; 0 of 40 pass; 0 rows. Exact search with the filter: her record
     first at 0.71, of 20 Kestle Moor rows. Without the filter it ranks 128th on this shelf.
   - Distance computations at ef_search 40: post-filter 84; iterative scan 394 (378 rows visited,
     5 Kestle Moor rows found, hers first at 0.71); pre-filter 20; exact 1,000.
   - Recall@5 on 50 sample queries, no filter: ef_search 10: 0.956, 20: 1.000, 40: 1.000. With the
     Kestle Moor filter at ef_search 40: post-filter 0.072, iterative scan 0.956, pre-filter 1.000.
     Post-filter at ef_search 200 returns her record (1 of 200 passes); at 100, 0 of 100.
   - Top-k 100 at ef_search 40: still 40 candidates; with no filter 40 rows, recall@100 0.400.
   - pgvector's rule of thumb: 40 candidates x 2 percent = 0.8 rows expected to pass.

   Drawing: viewBox 660 x 420. Shelf square x 10 to 410, y 10 to 410. Legend from x 430.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var N = 1000;
  var Q = { x: 0.5, y: 0.5 };
  var CAP = 400;
  var MUP = 2;
  var M0 = 3;
  var ROWS = 24000000;
  var KM_ROWS = 480000;
  var RATE = 2e9;
  var SERVER_GB = 256;
  var VAULT = { KM: "Kestle Moor", EL: "Ellerbeck", RV: "Ravensby", SK: "Brantholme", OT: "other banks" };
  var EFS = [10, 20, 40, 80, 100, 200, 400];
  var KS = [5, 10, 100];
  var MODES = [
    { value: "post", label: "Post-filter: filter the index's candidates (as now)" },
    { value: "iter", label: "Iterative index scan: keep scanning until k rows pass" },
    { value: "pre", label: "Pre-filter: filter first, then score those rows exactly" }
  ];
  var MODE_SHORT = { post: "post-filter", iter: "iterative index scan", pre: "pre-filter" };

  /* ---------- small helpers ---------- */

  function hash32(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h = (h ^ s.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }
  function u(s) { return hash32(s) / 4294967296; }
  function dist(a, b) { var dx = a.x - b.x; var dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function sc(d) { return (1 - d).toFixed(2); }
  function srt(a) { a.sort(function (x, y) { return (x.d - y.d) || (x.i - y.i); }); }

  /* ---------- the shelf and the graph (built once) ---------- */

  function shelf() {
    var P = [];
    P.push({ x: 0.53, y: 0.5, v: "EL", k: "dup" });
    P.push({ x: 0.5, y: 0.46, v: "RV", k: "dup" });
    P.push({ x: 0.468, y: 0.524, v: "SK", k: "dup" });
    P.push({ x: 0.5, y: 0.79, v: "KM", k: "hers" });
    var i;
    for (i = 0; i < 60; i++) {
      var a = u("ang" + i) * 2 * Math.PI;
      var r = 0.11 + 0.14 * Math.sqrt(u("rad" + i));
      P.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a), v: ["EL", "RV", "SK", "OT"][i % 4], k: "barley" });
    }
    var bg = [];
    for (var gy = 0; gy < 35; gy++) {
      for (var gx = 0; gx < 35; gx++) {
        var p = { x: (gx + 0.15 + 0.7 * u("x" + gx + "_" + gy)) / 35, y: (gy + 0.15 + 0.7 * u("y" + gx + "_" + gy)) / 35, k: "other", h: hash32("bg" + gx + "_" + gy) };
        if (dist(p, Q) >= 0.26) bg.push(p);
      }
    }
    bg.sort(function (x, y) { return x.h - y.h; });
    bg = bg.slice(0, N - P.length);
    var km = 0;
    bg.forEach(function (q) {
      if (km < 19 && dist(q, Q) > 0.35 && q.h % 7 === 0) { q.v = "KM"; km += 1; } else q.v = ["EL", "RV", "SK", "OT", "OT"][q.h % 5];
    });
    return P.concat(bg);
  }

  var P = shelf();
  var LVL = P.map(function (p, i) { var h = hash32("tier-" + i) % 100; return h < 1 ? 2 : (h < 10 ? 1 : 0); });
  var G = [{}, {}, {}];
  (function () {
    for (var L = 0; L < 3; L++) {
      var mem = [];
      for (var i = 0; i < N; i++) if (LVL[i] >= L) mem.push(i);
      var adj = G[L];
      mem.forEach(function (i) { adj[i] = []; });
      var m = L ? MUP : M0;
      mem.forEach(function (i) {
        var near = mem.filter(function (j) { return j !== i; }).map(function (j) { return { i: j, d: dist(P[i], P[j]) }; });
        srt(near);
        near.slice(0, m).forEach(function (o) {
          if (adj[i].indexOf(o.i) < 0) adj[i].push(o.i);
          if (adj[o.i].indexOf(i) < 0) adj[o.i].push(i);
        });
      });
    }
  })();
  var ENTRY = LVL.indexOf(2);
  function isKM(i) { return P[i].v === "KM"; }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // HNSW-like search. it = null for a plain search, or { k } for an iterative scan with the filter.
  function hnsw(q, ef, it) {
    var cnt = 0;
    function score(i) { cnt += 1; return dist(P[i], q); }
    var ep = ENTRY;
    var epd = score(ep);
    var path = [ep];
    for (var L = 2; L >= 1; L--) {
      var moved = true;
      while (moved) {
        moved = false;
        G[L][ep].forEach(function (j) { var dj = score(j); if (dj < epd) { epd = dj; ep = j; moved = true; } });
      }
      path.push(ep);
    }
    var seen = {};
    seen[ep] = true;
    var C = [{ i: ep, d: epd }];
    var W = [{ i: ep, d: epd }];
    var all = [{ i: ep, d: epd }];
    function passing() { var n = 0; for (var x = 0; x < all.length; x++) if (isKM(all[x].i)) n += 1; return n; }
    while (C.length) {
      srt(C);
      var c = C[0];
      if (W.length >= ef && c.d > W[W.length - 1].d) {
        if (!it || passing() >= it.k || all.length >= CAP) break;
      } else if (it && all.length >= CAP) break;
      C.shift();
      G[0][c.i].forEach(function (j) {
        if (seen[j]) return;
        seen[j] = true;
        var o = { i: j, d: score(j) };
        var inW = W.length < ef || o.d < W[W.length - 1].d;
        if (inW) { W.push(o); srt(W); if (W.length > ef) W.pop(); }
        if (inW || it) { C.push(o); all.push(o); }
      });
    }
    srt(all);
    return { cand: it ? all : W, cnt: cnt, path: path };
  }

  function exactList(q, filt) {
    var a = [];
    for (var i = 0; i < N; i++) if (!filt || isKM(i)) a.push({ i: i, d: dist(P[i], q) });
    srt(a);
    return a;
  }

  function indexOk(C) { return C.model === 1024; }

  // One search under the settings C. Returns candidates, rows passing, results, counts.
  function runSearch(q, C) {
    var filt = C.filter;
    var how;
    var cand;
    var cnt;
    var path = [];
    if (C.search === "exact" || !indexOk(C)) {
      cand = exactList(q, false);
      cnt = N;
      how = "exact";
    } else if (filt && C.mode === "pre") {
      cand = exactList(q, true);
      cnt = cand.length;
      how = "pre";
    } else {
      var r = hnsw(q, C.ef, filt && C.mode === "iter" ? { k: C.k } : null);
      cand = r.cand;
      cnt = r.cnt;
      path = r.path;
      how = filt && C.mode === "iter" ? "iter" : "post";
    }
    var passed = filt ? cand.filter(function (o) { return isKM(o.i); }) : cand.slice();
    return { how: how, cand: cand, passed: passed, res: passed.slice(0, C.k), cnt: cnt, path: path };
  }

  function recallOf(res, q, C) {
    var ex = exactList(q, C.filter).slice(0, C.k).map(function (o) { return o.i; });
    var hit = 0;
    res.forEach(function (o) { if (ex.indexOf(o.i) >= 0) hit += 1; });
    return ex.length ? hit / ex.length : 1;
  }

  var SAMPLES = [];
  for (var s = 0; s < 50; s++) SAMPLES.push({ x: 0.05 + 0.9 * u("sq-x" + s), y: 0.05 + 0.9 * u("sq-y" + s) });

  // Recall@k over the 50 sample queries, as hits over the exact top-k of every query.
  function sampleRecall(C, filt) {
    var D = { ef: C.ef, k: C.k, mode: C.mode, filter: filt, search: C.search, model: C.model };
    var hit = 0;
    var tot = 0;
    SAMPLES.forEach(function (q) {
      var ex = exactList(q, filt).slice(0, D.k).map(function (o) { return o.i; });
      var res = runSearch(q, D).res;
      tot += ex.length;
      res.forEach(function (o) { if (ex.indexOf(o.i) >= 0) hit += 1; });
    });
    return (hit / tot).toFixed(3);
  }

  function fullCost(how, C) {
    var rows = how === "pre" ? KM_ROWS : ROWS;
    var mads = rows * C.model;
    var big = mads >= 1e9 ? (Math.round(mads / 1e8) / 10).toFixed(1) + " billion" : (Math.round(mads / 1e5) / 10).toFixed(1) + " million";
    var secs = mads / RATE;
    return big + " multiply-adds, " + (secs >= 1 ? secs.toFixed(1) : secs.toFixed(2)) + " s";
  }

  function label(i) {
    var p = P[i];
    if (p.k === "hers") return "Kestle Moor KM-1958-0347 (the faded scan)";
    if (p.k === "dup") return VAULT[p.v] + " safety duplicate";
    if (p.k === "barley") return "barley note, " + VAULT[p.v];
    return "chunk " + i + ", " + VAULT[p.v];
  }

  function mix(list) {
    var c = { dup: 0, barley: 0, hers: 0, other: 0, km: 0 };
    list.forEach(function (o) { c[P[o.i].k] += 1; if (P[o.i].v === "KM" && P[o.i].k !== "hers") c.km += 1; });
    var parts = [];
    if (c.dup) parts.push(c.dup + " safety duplicates");
    if (c.barley) parts.push(c.barley + " barley notes from other banks");
    if (c.hers) parts.push("her own record");
    if (c.other) parts.push(c.other + " other chunks");
    return parts.join(", ");
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function X(x) { return Math.round((10 + 400 * x) * 10) / 10; }
  function Y(y) { return Math.round((10 + 400 * (1 - y)) * 10) / 10; }
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, text, cls) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls }, parent);
    t.textContent = text;
    return t;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 420", width: "100%", "class": "dg", role: "img",
      "aria-label": "The shelf of 1,000 chunks drawn as dots around the query cross. Squares are Kestle Moor rows. Highlighted dots were candidates, green ones were returned. The dashed circle reaches the farthest candidate. The table lists the rows returned."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["rank", "chunk", "bank", "score"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody };
  }

  function drawShelf(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    clear(g);
    var R = S.last;
    var state = {};
    if (R) {
      R.cand.forEach(function (o) { state[o.i] = "accent"; });
      R.res.forEach(function (o) { state[o.i] = "ok"; });
    }
    mk(doc, "rect", { x: 10, y: 10, width: 400, height: 400, fill: "none", "class": "dg-axis" }, g);
    if (R && R.how !== "exact" && R.how !== "pre" && R.cand.length) {
      var far = R.cand[Math.min(R.cand.length, S.C.ef) - 1].d;
      mk(doc, "circle", { cx: X(Q.x), cy: Y(Q.y), r: Math.round(far * 4000) / 10, fill: "none", "class": "dg-axis", "stroke-dasharray": "4 4" }, g);
      var pts = R.path.map(function (i) { return X(P[i].x) + "," + Y(P[i].y); }).join(" ");
      mk(doc, "polyline", { points: pts, fill: "none", "class": "dg-axis" }, g);
    }
    var groups = {};
    ["muted", "warn", "accent", "ok", "bad"].forEach(function (t) { groups[t] = mk(doc, "g", { "class": "dg-node st-" + t }, g); });
    for (var i = 0; i < N; i++) {
      var p = P[i];
      var t = state[i] || (p.k === "dup" ? "bad" : "muted");
      var big = p.k === "dup" || p.k === "hers";
      if (p.v === "KM") mk(doc, "rect", { x: X(p.x) - (big ? 4 : 2.5), y: Y(p.y) - (big ? 4 : 2.5), width: big ? 8 : 5, height: big ? 8 : 5 }, groups[t]);
      else mk(doc, "circle", { cx: X(p.x), cy: Y(p.y), r: big ? 4 : 2 }, groups[t]);
    }
    var cx = X(Q.x);
    var cy = Y(Q.y);
    mk(doc, "path", { d: "M" + (cx - 6) + " " + cy + "H" + (cx + 6) + "M" + cx + " " + (cy - 6) + "V" + (cy + 6), "class": "dg-axis", "stroke-width": 2 }, g);
    txt(doc, g, X(0.5) + 8, Y(0.79) + 4, "KM-1958-0347", "dg-note");
    var lines = [
      ["+ the query: the clean catalogue text", "dg-note"],
      ["Squares: Kestle Moor rows (20).", "dg-axis"],
      ["Red: the three safety duplicates.", "dg-axis"],
      ["Highlighted: candidates.", "dg-axis"],
      ["Green: returned.", "dg-axis"],
      ["Dashed circle: the farthest", "dg-axis"],
      ["candidate the index kept.", "dg-axis"],
      ["Line: greedy descent, layers 2-1.", "dg-axis"],
      [R ? "Scored: " + fmt(R.cnt) + " of 1,000." : "Not searched yet.", "dg-note"]
    ];
    lines.forEach(function (ln, k) { txt(doc, g, 430, 30 + 22 * k, ln[0], ln[1]); });
  }

  function drawTable(S) {
    var ui = S.ui;
    clear(ui.tbody);
    var R = S.last;
    if (!R) return;
    if (!R.res.length) {
      var tr0 = ui.el("tr");
      tr0.appendChild(ui.el("td", "", "-"));
      tr0.appendChild(ui.el("td", "", "no rows returned"));
      ui.tbody.appendChild(tr0);
      return;
    }
    R.res.slice(0, 12).forEach(function (o, n) {
      var tr = ui.el("tr");
      [String(n + 1), label(o.i), VAULT[P[o.i].v], sc(o.d)].forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
      ui.tbody.appendChild(tr);
    });
  }

  function heading(C) {
    var model = C.model === 1024 ? "1,024 numbers" : "3,072 numbers";
    var how = (C.search === "exact" || !indexOk(C)) ? "exact search, every row" : "HNSW index, " + MODE_SHORT[C.mode] + ", ef_search " + C.ef;
    return how + "; top-k " + C.k + "; " + (C.filter ? "Kestle Moor only" : "no filter") + "; model " + model + ".";
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Settings: " + heading(C);
    drawShelf(S);
    drawTable(S);
    var gb = (ROWS * C.model * 4 / 1e9).toFixed(1);
    S.stat.memory(gb + " GB of " + SERVER_GB + " GB");
    var R = S.last;
    if (!R) {
      ["dist", "cands", "passed", "results", "top", "hers", "recall", "srecall", "frecall", "cost"].forEach(function (k) { S.stat[k]("not run"); });
      return;
    }
    var herRank = -1;
    R.res.forEach(function (o, n) { if (P[o.i].k === "hers") herRank = n + 1; });
    S.stat.dist(R.cnt);
    S.stat.cands(R.cand.length);
    S.stat.passed(C.filter ? fmt(R.passed.length) + " of " + fmt(R.cand.length) : "no filter");
    S.stat.results(R.res.length);
    S.stat.top(R.res.length ? label(R.res[0].i) + ", " + sc(R.res[0].d) : "none");
    S.stat.hers(herRank > 0 ? "rank " + herRank + ", " + sc(R.res[herRank - 1].d) : "not returned");
    S.stat.recall(S.recall.toFixed(2));
    S.stat.srecall(S.sr);
    S.stat.frecall(S.fr);
    S.stat.cost(R.how === "exact" || R.how === "pre" ? fullCost(R.how, C) : "the index scores a small share");
  }

  function run(api, why) {
    var S = api.state;
    var C = S.C;
    S.ran = true;
    var R = runSearch(Q, C);
    S.last = R;
    S.recall = recallOf(R.res, Q, C);
    S.sr = sampleRecall(C, false);
    S.fr = sampleRecall(C, true);
    var herRank = -1;
    R.res.forEach(function (o, n) { if (P[o.i].k === "hers") herRank = n + 1; });
    var msg = (why ? why + " " : "") + "Search: " + heading(C) + " ";
    if (C.model !== 1024 && C.search !== "exact") msg += "The index can't be built at 3,072 numbers (pgvector indexes vector up to 2,000), so this ran exact. ";
    if (R.how === "post") {
      msg += "The index gathered " + R.cand.length + " candidates (" + mix(R.cand) + "); " +
        (C.filter ? R.passed.length + " of " + R.cand.length + " passed the filter. " : "");
    } else if (R.how === "iter") {
      msg += "The scan visited " + fmt(R.cand.length) + " rows and " + R.passed.length + " passed the filter. ";
    } else if (R.how === "pre") {
      msg += "Filtered first: " + R.cand.length + " Kestle Moor rows, each scored exactly. ";
    } else {
      msg += "Scored all 1,000 rows" + (C.filter ? ", then kept Kestle Moor's 20. " : ". ");
    }
    msg += R.res.length + (R.res.length === 1 ? " row" : " rows") + " returned";
    msg += R.res.length ? "; first: " + label(R.res[0].i) + ", " + sc(R.res[0].d) + ". " : ". ";
    msg += herRank > 0 ? "Her record: rank " + herRank + ". " : "Her record: not returned. ";
    msg += fmt(R.cnt) + " distance computations. Recall against exact: " + S.recall.toFixed(2) + ".";
    api.log(msg, R.res.length === 0 ? "bad" : (herRank > 0 ? "ok" : "warn"));
    draw(api);
  }

  function changed(api, why) {
    if (api.state.ran) run(api, why);
    else { api.log(why + " Press Run the search.", ""); draw(api); }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { ef: 40, k: 5, mode: "post", filter: true, search: "hnsw", model: 1024 };
      S.ran = false;
      S.last = null;
      S.recall = 0;
      S.sr = "not run";
      S.fr = "not run";
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.search = api.control.button("search", "Run the search", function () { run(api, ""); });
      S.ctl.ef = api.control.select("ef", "hnsw.ef_search (candidates)", EFS.map(function (e) { return { value: e, label: String(e) }; }), 40, function (v) {
        S.C.ef = Number(v);
        changed(api, "ef_search set to " + S.C.ef + ".");
      });
      S.ctl.k = api.control.select("k", "Top-k (LIMIT)", KS.map(function (k) { return { value: k, label: String(k) }; }), 5, function (v) {
        S.C.k = Number(v);
        changed(api, "Top-k set to " + S.C.k + ".");
      });
      S.ctl.mode = api.control.select("mode", "Filter mode", MODES, "post", function (v) {
        S.C.mode = String(v);
        changed(api, "Filter mode: " + MODE_SHORT[S.C.mode] + ".");
      });
      S.ctl.filter = api.control.toggle("filter", "Only Kestle Moor's base collection (2 percent of rows)", true, function (on) {
        S.C.filter = !!on;
        changed(api, "Kestle Moor filter " + (on ? "on." : "off."));
      });
      S.ctl.how = api.control.select("how", "Search with", [{ value: "hnsw", label: "HNSW index" }, { value: "exact", label: "Exact search over every row" }], "hnsw", function (v) {
        S.C.search = String(v);
        changed(api, S.C.search === "exact" ? "Index off: exact search." : "Index on.");
      });
      S.ctl.model = api.control.select("model", "Embedding model", [{ value: 1024, label: "1,024 numbers (as now)" }, { value: 3072, label: "3,072 numbers (bigger model)" }], 1024, function (v) {
        S.C.model = Number(v);
        changed(api, "Embedding model: " + fmt(S.C.model) + " numbers per chunk.");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        dist: api.stat("dist", "distance computations", ""),
        cands: api.stat("cands", "candidates (rows visited)", ""),
        passed: api.stat("passed", "passed the filter", "warn"),
        results: api.stat("results", "rows returned", "bad"),
        top: api.stat("top", "first result", ""),
        hers: api.stat("hers", "KM-1958-0347", "ok"),
        recall: api.stat("recall", "recall against exact, this search", "warn"),
        srecall: api.stat("srecall", "recall@k, 50 sample queries, no filter", ""),
        frecall: api.stat("frecall", "recall@k, 50 sample queries, Kestle Moor filter", ""),
        memory: api.stat("memory", "vectors at full size (24 million chunks)", ""),
        cost: api.stat("cost", "this search at full size", "")
      };

      api.info("<strong>How to read it.</strong> Each dot is one chunk on a 1,000-chunk shelf standing in for Seedline's 24 million; the closer to the cross, the higher the score (score = 1 minus distance). The index starts at its entry point, walks greedily down two thin upper layers, then gathers ef_search candidates on the ground layer. The filter keeps Kestle Moor's squares. Recall compares the rows returned with an exact search.");
      api.log("02:14 at Kestle Moor, before the search. Shelf: 1,000 chunks, 20 of them Kestle Moor's (2 percent). Graph: 6 points on layer 2, 99 on layer 1, all 1,000 on the ground layer.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function since() { return t.logText().slice(mark); }

      // 1. Opening: the shelf before the search.
      t.expect(t.stat("results") === "not run" && t.stat("hers") === "not run" && t.stat("memory") === "98.3 GB of 256 GB" &&
        t.logText().indexOf("Shelf: 1,000 chunks, 20 of them Kestle Moor's (2 percent).") >= 0,
        "Opens before the search: 1,000 chunks, 20 Kestle Moor's, 98.3 GB of vectors at full size");

      // 2. The story's search: 40 candidates, 0 pass.
      begin();
      t.click("search");
      t.expect(has("The index gathered 40 candidates (3 safety duplicates, 37 barley notes from other banks); 0 of 40 passed the filter. 0 rows returned.") &&
        t.stat("passed") === "0 of 40" && t.stat("results") === 0 && t.stat("hers") === "not returned" && t.stat("recall") === 0 && t.stat("dist") === 84,
        "Post-filter, ef_search 40, top 5: 40 candidates, the 3 duplicates and 37 barley notes, 0 of 40 pass, 0 rows");

      // 3. Without the filter: the duplicates on top, her record nowhere.
      t.set("filter", false);
      t.expect(t.stat("top") === "Ellerbeck safety duplicate, 0.97" && t.stat("results") === 5 && t.stat("hers") === "not returned",
        "No filter: Ellerbeck's duplicate first at 0.97, her record not among the 5");
      var order = exactList(Q, false).map(function (o) { return o.i; }).indexOf(3) + 1;
      t.expect(order === 128, "Exact order without the filter: her record ranks 128th on the shelf");

      // 4. Exact search with the filter: her record first at 0.71.
      t.set("filter", true);
      t.set("how", "exact");
      t.expect(t.stat("hers") === "rank 1, 0.71" && t.stat("dist") === 1000 && t.stat("recall") === 1 &&
        t.stat("cost") === "24.6 billion multiply-adds, 12.3 s",
        "Exact with the filter: KM-1958-0347 first at 0.71; 1,000 computations; 12.3 s at full size");

      // 5. Raising top-k to 100: still 40 candidates, still 0 rows.
      t.set("how", "hnsw");
      t.set("k", 100);
      t.expect(t.stat("passed") === "0 of 40" && t.stat("results") === 0,
        "Top-k 100 with ef_search 40: the index still hands over 40, and 0 pass");
      t.set("k", 5);

      // 6. Iterative scan: keeps going until 5 rows pass.
      begin();
      t.set("mode", "iter");
      t.expect(has("The scan visited 378 rows and 5 passed the filter.") && t.stat("hers") === "rank 1, 0.71" && t.stat("dist") === 394 &&
        t.stat("recall") === 1 && t.stat("frecall") === 0.956,
        "Iterative scan: 378 rows visited, 394 computations, her record first at 0.71, filtered sample recall 0.956");

      // 7. Pre-filter: 20 rows scored exactly.
      t.set("mode", "pre");
      t.expect(t.stat("dist") === 20 && t.stat("hers") === "rank 1, 0.71" && t.stat("frecall") === 1 &&
        t.stat("cost") === "491.5 million multiply-adds, 0.25 s",
        "Pre-filter: 20 Kestle Moor rows scored, her record first, 0.25 s at full size");

      // 8. Recall on the sample: unfiltered is perfect at 40; the filter is the problem.
      t.set("mode", "post");
      var s40 = t.stat("srecall");
      var f40 = t.stat("frecall");
      t.set("ef", 10);
      var s10 = t.stat("srecall");
      t.set("ef", 20);
      var s20 = t.stat("srecall");
      t.set("ef", 40);
      t.expect(s40 === 1 && f40 === 0.072 && s10 === 0.956 && s20 === 1,
        "Recall@5 on 50 samples: 0.956 at ef_search 10, 1.000 at 20 and 40; with the filter, post-filter 0.072");

      // 9. The bigger model: no index, every search exact, and it doesn't fit.
      begin();
      t.set("model", 3072);
      t.expect(has("The index can't be built at 3,072 numbers") && t.stat("memory") === "294.9 GB of 256 GB" &&
        t.stat("cost") === "73.7 billion multiply-adds, 36.9 s" && t.stat("dist") === 1000,
        "3,072 numbers: no HNSW index, 294.9 GB of vectors on a 256 GB server, 36.9 s an exact search");
      t.expect(t.stat("hers") === "rank 1, 0.71" && since().indexOf("Scored all 1,000 rows, then kept Kestle Moor's 20.") >= 0,
        "3,072 numbers: her record comes back only because every search is now exact, at the same 0.71");
    }
  });
})();
