/* sims/a5e02-v1.0.0.js  (published as sims/a5e02.js)
   Case a5e02 "The Retrieval Scorecard": a retrieval scorecard for the Calderbrook Firearms
   Laboratory's case-file search. Eight labelled searches (queries) over twelve comparison reports,
   five of them old paper scans, ranked by two searches: the old search (kept on a test machine)
   and the new one (Sightline's upgrade). The learner picks the search, k, the metric worked out,
   the slice and one query, and reads each query's ranked list with the right reports marked,
   each metric worked out by hand, and the per-slice table. No real model and no real search:
   every ranking below is stated data. Widget-style sim: it draws its own tables in api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: 12 reports, 8 labelled queries, both searches' full rankings;
     recall at k, precision at k, mean reciprocal rank and nDCG at k, overall and by slice; a
     reply preset for each of the four options. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - A report is right (relevant) for a query when Lowri Haverstock marked it so. Labels are
     yes or no (binary); nobody else is relevant.
   - Recall at k for one query = right reports in the top k / right reports for that query.
   - Precision at k for one query = right reports in the top k / k.
   - Reciprocal rank for one query = 1 / rank of its first right report (all 12 are ranked, so
     there always is one). Mean reciprocal rank (MRR) = the mean over the queries. It ignores k.
   - nDCG at k (the IR book's form, binary labels, so each right report's gain is 2^1 - 1 = 1):
     DCG at k = sum over right reports in the top k of 1 / log2(1 + rank). Ideal DCG at k = the
     same sum with all right reports at the top. nDCG at k = DCG / ideal DCG.
   - Every score shown is the plain mean over the queries in the slice (macro average).
   - A slice keeps the queries with at least one right report of that type and counts only that
     type as right. Old scans: Q1, Q3, Q5, Q6, Q8 (5 queries, 6 right reports). Digital: Q1, Q2,
     Q4, Q5, Q7, Q8 (6 queries, 8 right reports). Q1, Q5 and Q8 are in both.
   - Rounding: every score to 2 decimals, half up.

   Where every number comes from (conventions rule 14; the case is content/latent/a5/a5e02-v1.0.0.json).
   - Right reports: Q1 D6, S3 (Lowri's query; S3 is her August 2023 scan). Q2 D1, D3. Q3 S1, S4.
     Q4 D2. Q5 D4, S5. Q6 S2. Q7 D5, D7. Q8 D7, S1. 14 in all: 8 digital, 6 scans.
   - Ranks of right reports. Old: Q1 S3 2, D6 4; Q2 D1 2, D3 3; Q3 S1 1, S4 3; Q4 D2 3; Q5 S5 1,
     D4 6; Q6 S2 2; Q7 D5 1, D7 4; Q8 D7 2, S1 4. New: Q1 D6 1, S3 9; Q2 D1 1, D3 2; Q3 S1 2, S4 7;
     Q4 D2 1; Q5 D4 1, S5 3; Q6 S2 6; Q7 D5 1, D7 2; Q8 D7 1, S1 3.
   - First result right (precision at 1): old 3 of 8 (Q3, Q5, Q7) = 0.38; new 6 of 8 = 0.75.
   - All 8 queries, k 5. Recall: old 0.94 (7.5 / 8; 13 of 14 found, D4 6th in Q5 missed), new
     0.75 (6 / 8; 11 of 14 found; missed S3 9th, S4 7th, S2 6th, all scans). Precision at 5: old
     0.33 (13 / 40), new 0.28 (11 / 40). MRR: old 0.67 (5.33 / 8), new 0.83 (6.67 / 8). nDCG at 5:
     old 0.69, new 0.73.
   - Precision at 3: old 0.42 (10 / 24), new 0.46 (11 / 24).
   - Old scans, k 5: recall old 1.00 (6 of 6), new 0.50 (3 of 6). MRR old 0.65, new 0.29. nDCG at 5
     old 0.72, new 0.28. Digital, k 5: recall old 0.83 (7 of 8), new 1.00 (8 of 8). MRR old 0.46,
     new 1.00.
   - k 10: both find 14 of 14, recall 1.00.
   - Q1 by hand, k 5. New: D6 at 1 gives 1 / log2(2) = 1; S3 at 9 is outside. Ideal: 1 + 1 / log2(3)
     = 1 + 0.631 = 1.631. nDCG 1 / 1.631 = 0.61. Old: S3 at 2 gives 0.631, D6 at 4 gives
     1 / log2(5) = 0.431, DCG 1.062, nDCG 1.062 / 1.631 = 0.65.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  // id, year, kind, scan (true: a scanned paper report from before the lab went digital in 2024)
  var DOCS = {
    S1: { y: 2021, kind: "cartridge-case comparison", scan: true },
    S2: { y: 2022, kind: "bullet comparison", scan: true },
    S3: { y: 2023, kind: "cartridge-case comparison (August)", scan: true },
    S4: { y: 2022, kind: "test-fire report", scan: true },
    S5: { y: 2023, kind: "bullet comparison", scan: true },
    D1: { y: 2024, kind: "cartridge-case comparison", scan: false },
    D2: { y: 2024, kind: "bullet comparison", scan: false },
    D3: { y: 2025, kind: "test-fire report", scan: false },
    D4: { y: 2025, kind: "cartridge-case comparison", scan: false },
    D5: { y: 2025, kind: "bullet comparison", scan: false },
    D6: { y: 2026, kind: "cartridge-case comparison", scan: false },
    D7: { y: 2026, kind: "test-fire report", scan: false }
  };

  var QUERIES = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];
  var QLABEL = {
    Q1: "Q1: Lowri's new report tonight, cartridge cases",
    Q2: "Q2: a cartridge-case comparison from June",
    Q3: "Q3: a test-fire report from July",
    Q4: "Q4: a bullet comparison from July",
    Q5: "Q5: a cartridge-case comparison from August",
    Q6: "Q6: a bullet comparison from August",
    Q7: "Q7: a test-fire report from September",
    Q8: "Q8: a cartridge-case comparison from September"
  };

  // The reports Lowri marked right for each query.
  var RIGHT = {
    Q1: ["D6", "S3"], Q2: ["D1", "D3"], Q3: ["S1", "S4"], Q4: ["D2"],
    Q5: ["D4", "S5"], Q6: ["S2"], Q7: ["D5", "D7"], Q8: ["D7", "S1"]
  };

  // Each search's full ranking of all 12 reports for each query, best first.
  var RANK = {
    old: {
      Q1: ["D2", "S3", "S4", "D6", "D5", "S1", "D7", "S2", "D1", "S5", "D3", "D4"],
      Q2: ["S4", "D1", "D3", "D5", "S1", "D7", "S2", "S5", "S3", "D4", "D6", "D2"],
      Q3: ["S1", "D5", "S4", "D7", "S2", "D1", "S5", "D3", "S3", "D4", "D6", "D2"],
      Q4: ["S1", "D7", "D2", "S2", "D1", "S5", "D3", "S3", "D4", "D6", "S4", "D5"],
      Q5: ["S5", "D7", "S2", "D1", "D3", "D4", "S3", "D6", "D2", "S4", "D5", "S1"],
      Q6: ["D1", "S2", "S5", "D3", "S3", "D4", "D6", "D2", "S4", "D5", "S1", "D7"],
      Q7: ["D5", "D1", "S5", "D7", "D3", "S3", "D4", "D6", "D2", "S4", "S1", "S2"],
      Q8: ["S5", "D7", "D3", "S1", "S3", "D4", "D6", "D2", "S4", "D5", "S2", "D1"]
    },
    "new": {
      Q1: ["D6", "D3", "D5", "D2", "D7", "D1", "D4", "S1", "S3", "S2", "S4", "S5"],
      Q2: ["D1", "D3", "D5", "D2", "D7", "D4", "D6", "S1", "S2", "S4", "S5", "S3"],
      Q3: ["D2", "S1", "D7", "D1", "D4", "D6", "S4", "D3", "D5", "S2", "S5", "S3"],
      Q4: ["D2", "D7", "D1", "D4", "D6", "D3", "D5", "S1", "S2", "S4", "S5", "S3"],
      Q5: ["D4", "D1", "S5", "D6", "D3", "D5", "D2", "D7", "S1", "S2", "S4", "S3"],
      Q6: ["D4", "D6", "D3", "D5", "D2", "S2", "D7", "D1", "S1", "S4", "S5", "S3"],
      Q7: ["D5", "D7", "D6", "D3", "D2", "D1", "D4", "S1", "S2", "S4", "S5", "S3"],
      Q8: ["D7", "D3", "S1", "D5", "D2", "D1", "D4", "D6", "S2", "S4", "S5", "S3"]
    }
  };

  var SEARCHES = [
    { value: "new", label: "New search (Sightline's upgrade)" },
    { value: "old", label: "Old search (on the test machine)" }
  ];
  var SNAME = { "new": "new search", old: "old search" };
  var METRICS = [
    { value: "recall", label: "Recall at k" },
    { value: "precision", label: "Precision at k" },
    { value: "mrr", label: "Mean reciprocal rank (MRR)" },
    { value: "ndcg", label: "nDCG at k" }
  ];
  var SLICES = [
    { value: "all", label: "All reports" },
    { value: "scan", label: "Old scans only" },
    { value: "digital", label: "Digital reports only" }
  ];
  var SLNAME = { all: "all queries", scan: "old scans", digital: "digital reports" };
  var REPLIES = [
    { value: "none", label: "None yet" },
    { value: "0", label: "A: keep the new search, first result right" },
    { value: "1", label: "B: examiners rate both for a week" },
    { value: "2", label: "C: re-scan the old paper reports" },
    { value: "3", label: "D: recall in the top 5, old scans split out" }
  ];

  /* ---------- the arithmetic (pure functions the display and self-tests read) ---------- */

  function r2(x) { return (Math.round(Math.round(x * 1e6) / 1e4) / 100).toFixed(2); }
  function r3(x) { return (Math.round(Math.round(x * 1e6) / 1e3) / 1000).toFixed(3); }
  function log2(x) { return Math.log(x) / Math.LN2; }
  function inSlice(id, slice) { return slice === "all" || (slice === "scan" ? DOCS[id].scan : !DOCS[id].scan); }
  function rightIn(q, slice) { return RIGHT[q].filter(function (d) { return inSlice(d, slice); }); }
  function rankOf(search, q, id) { return RANK[search][q].indexOf(id) + 1; }
  function ord(n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); }

  // One query's scores, or null when the query has no right report in the slice.
  function score(search, q, k, slice) {
    var rel = rightIn(q, slice);
    if (!rel.length) return null;
    var list = RANK[search][q];
    var hits = [];
    var dcg = 0;
    var first = 0;
    for (var i = 0; i < list.length; i++) {
      if (rel.indexOf(list[i]) < 0) continue;
      if (!first) first = i + 1;
      if (i < k) { hits.push(list[i]); dcg += 1 / log2(i + 2); }
    }
    var ideal = 0;
    for (var j = 0; j < Math.min(k, rel.length); j++) ideal += 1 / log2(j + 2);
    return {
      rel: rel, hits: hits, first: first, dcg: dcg, ideal: ideal,
      recall: hits.length / rel.length, precision: hits.length / k, rr: 1 / first, ndcg: dcg / ideal
    };
  }

  function card(search, k, slice) {
    var out = { queries: [], recall: 0, precision: 0, mrr: 0, ndcg: 0, found: 0, total: 0, firstRight: 0, missed: [] };
    QUERIES.forEach(function (q) {
      var s = score(search, q, k, slice);
      if (!s) return;
      out.queries.push(q);
      out.recall += s.recall; out.precision += s.precision; out.mrr += s.rr; out.ndcg += s.ndcg;
      out.found += s.hits.length; out.total += s.rel.length;
      if (s.first === 1) out.firstRight += 1;
      s.rel.forEach(function (d) { if (s.hits.indexOf(d) < 0) out.missed.push(q + " " + d + " " + ord(rankOf(search, q, d))); });
    });
    var n = out.queries.length;
    out.n = n;
    out.recall /= n; out.precision /= n; out.mrr /= n; out.ndcg /= n;
    return out;
  }

  function metricText(m, k) {
    return m === "recall" ? "recall at " + k : m === "precision" ? "precision at " + k : m === "mrr" ? "MRR" : "nDCG at " + k;
  }
  function metricOf(c, m) { return m === "recall" ? c.recall : m === "precision" ? c.precision : m === "mrr" ? c.mrr : c.ndcg; }
  function oneOf(s, m) { return m === "recall" ? s.recall : m === "precision" ? s.precision : m === "mrr" ? s.rr : s.ndcg; }

  // The worked line for one query.
  function worked(C) {
    var s = score(C.search, C.q, C.k, C.slice);
    var head = C.q + ", " + SNAME[C.search] + ", " + SLNAME[C.slice] + ": ";
    if (!s) return head + "no right report of this type, so this query is not in the slice.";
    var right = "right reports " + s.rel.join(", ") + " at ranks " + s.rel.map(function (d) { return rankOf(C.search, C.q, d); }).join(", ") + ". ";
    if (C.metric === "recall") return head + right + s.hits.length + " of " + s.rel.length + " in the top " + C.k + ". Recall at " + C.k + " = " + s.hits.length + " / " + s.rel.length + " = " + r2(s.recall) + ".";
    if (C.metric === "precision") return head + right + s.hits.length + " right in the top " + C.k + ". Precision at " + C.k + " = " + s.hits.length + " / " + C.k + " = " + r2(s.precision) + ".";
    if (C.metric === "mrr") return head + right + "The first right report is " + ord(s.first) + ". Reciprocal rank = 1 / " + s.first + " = " + r2(s.rr) + ".";
    var parts = s.hits.map(function (d) { return "1 / log2(1 + " + rankOf(C.search, C.q, d) + ")"; });
    return head + right + "DCG at " + C.k + " = " + (parts.length ? parts.join(" + ") : "0") + " = " + r3(s.dcg) +
      ". Ideal DCG, every right report at the top: " + r3(s.ideal) + ". nDCG at " + C.k + " = " + r3(s.dcg) + " / " + r3(s.ideal) + " = " + r2(s.ndcg) + ".";
  }

  // The mean line: every query's value, added and divided.
  function meanLine(C) {
    var vals = [];
    var sum = 0;
    QUERIES.forEach(function (q) {
      var s = score(C.search, q, C.k, C.slice);
      if (!s) return;
      var v = oneOf(s, C.metric);
      sum += v;
      vals.push(q + " " + r2(v));
    });
    return "Mean " + metricText(C.metric, C.k) + " over the " + vals.length + " queries in " + SLNAME[C.slice] + ": (" + vals.join(" + ") + ") / " + vals.length + " = " + r2(sum / vals.length) + ".";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;font-weight:600;");
    var listT = el("table", "width:100%;border-collapse:collapse;");
    var work = el("p", "margin:0;");
    var mean = el("p", "margin:0;");
    var sliceT = el("table", "width:100%;border-collapse:collapse;");
    box.appendChild(head);
    box.appendChild(listT);
    box.appendChild(work);
    box.appendChild(mean);
    box.appendChild(el("p", "margin:0;font-weight:600;", "The scorecard at this k: both searches, every slice"));
    box.appendChild(sliceT);
    api.root.appendChild(box);
    return { el: el, head: head, listT: listT, work: work, mean: mean, sliceT: sliceT };
  }

  function row(ui, cells, style, tag) {
    var tr = ui.el("tr", style || "");
    cells.forEach(function (c) { tr.appendChild(ui.el(tag || "td", "text-align:left;padding:2px 6px;", String(c))); });
    return tr;
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var c = card(C.search, C.k, C.slice);
    S.card = c;
    ui.head.textContent = QLABEL[C.q] + ". Ranked by the " + SNAME[C.search] + ". Right reports are marked; the line is the top " + C.k + ".";

    while (ui.listT.firstChild) ui.listT.removeChild(ui.listT.firstChild);
    ui.listT.appendChild(row(ui, ["rank", "report", "year", "kind", "type", "Lowri's label"], "", "th"));
    var rel = rightIn(C.q, C.slice);
    RANK[C.search][C.q].forEach(function (id, i) {
      var d = DOCS[id];
      var isRight = RIGHT[C.q].indexOf(id) >= 0;
      var label = isRight ? (rel.indexOf(id) >= 0 ? "RIGHT" : "right (other slice)") : "";
      var st = isRight && rel.indexOf(id) >= 0 ? (i < C.k ? "font-weight:600;" : "font-weight:600;color:var(--red);") : "color:var(--muted);";
      if (i === C.k - 1) st += "border-bottom:2px solid var(--amber);";
      ui.listT.appendChild(row(ui, [i + 1, id, d.y, d.kind, d.scan ? "old scan" : "digital", label], st));
    });

    ui.work.textContent = worked(C);
    ui.mean.textContent = meanLine(C);

    while (ui.sliceT.firstChild) ui.sliceT.removeChild(ui.sliceT.firstChild);
    ui.sliceT.appendChild(row(ui, ["slice", "queries", "search", "recall at " + C.k, "precision at " + C.k, "MRR", "nDCG at " + C.k, "found"], "", "th"));
    ["all", "scan", "digital"].forEach(function (sl) {
      ["old", "new"].forEach(function (se) {
        var x = card(se, C.k, sl);
        var st = sl === C.slice && se === C.search ? "font-weight:600;" : "";
        ui.sliceT.appendChild(row(ui, [SLNAME[sl], x.n, SNAME[se], r2(x.recall), r2(x.precision), r2(x.mrr), r2(x.ndcg), x.found + " of " + x.total], st));
      });
    });

    S.stat.recall(r2(c.recall));
    S.stat.precision(r2(c.precision));
    S.stat.mrr(r2(c.mrr));
    S.stat.ndcg(r2(c.ndcg));
    S.stat.found(c.found + " of " + c.total);
    S.stat.first(c.firstRight + " of " + c.n);
    S.stat.older(rankOf(C.search, "Q1", "S3"));
  }

  function summaryLine(C) {
    var c = card(C.search, C.k, C.slice);
    return "The " + SNAME[C.search] + ", k " + C.k + ", " + SLNAME[C.slice] + ": recall at " + C.k + " " + r2(c.recall) +
      ", precision at " + C.k + " " + r2(c.precision) + ", MRR " + r2(c.mrr) + ", nDCG at " + C.k + " " + r2(c.ndcg) +
      "; " + c.found + " of " + c.total + " right reports in the top " + C.k + ".";
  }

  function both(metric, k, slice) {
    return "old " + r2(metricOf(card("old", k, slice), metric)) + ", new " + r2(metricOf(card("new", k, slice), metric));
  }

  /* ---------- the module ---------- */

  DL.sims.define("a5e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { search: "new", k: 5, metric: "recall", slice: "all", q: "Q1" };
      S.ui = buildWidget(api);
      S.ctl = {};

      function change(msg, tone) {
        draw(api);
        api.log(msg + " " + summaryLine(S.C), tone || "");
      }

      S.ctl.search = api.control.select("search", "Search", SEARCHES, "new", function (v) {
        if (!SNAME[v] || v === S.C.search) return;
        S.C.search = String(v);
        change("Switched to the " + SNAME[S.C.search] + ".");
      });
      S.ctl.k = api.control.range("k", "k: how many top results count", 1, 12, 1, 5, function (v) {
        var x = Math.max(1, Math.min(12, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.k) return;
        S.C.k = x;
        change("k is now " + x + ".");
      });
      S.ctl.metric = api.control.select("metric", "Measure worked out", METRICS, "recall", function (v) {
        S.C.metric = String(v);
        draw(api);
      });
      S.ctl.slice = api.control.select("slice", "Slice", SLICES, "all", function (v) {
        if (!SLNAME[v] || v === S.C.slice) return;
        S.C.slice = String(v);
        change("Slice: " + SLNAME[S.C.slice] + ".");
      });
      S.ctl.q = api.control.select("q", "Query to inspect", QUERIES.map(function (q) { return { value: q, label: QLABEL[q] }; }), "Q1", function (v) {
        if (!QLABEL[v]) return;
        S.C.q = String(v);
        draw(api);
      });
      S.ctl.reply = api.control.select("reply", "Try a reply", REPLIES, "none", function (v) {
        var C = S.C;
        if (v === "0") {
          C.search = "new"; C.k = 1; C.metric = "precision"; C.slice = "all"; C.q = "Q1";
          draw(api);
          api.log("Reply A: scored by the first result alone, precision at 1: " + both("precision", 1, "all") +
            ". The new search stays, and Lowri's 2023 report stays " + ord(rankOf("new", "Q1", "S3")) + ".", "bad");
        } else if (v === "1") {
          C.search = "new"; C.k = 5; C.metric = "precision"; C.slice = "all"; C.q = "Q1";
          draw(api);
          api.log("Reply B: a week of ratings scores how the first screen felt, and nobody rates a report they never saw. Nothing on the scorecard moves; Lowri's 2023 report stays " +
            ord(rankOf("new", "Q1", "S3")) + ".", "bad");
        } else if (v === "2") {
          C.search = "new"; C.k = 5; C.metric = "recall"; C.slice = "scan"; C.q = "Q1";
          draw(api);
          var cs = card("new", 5, "scan");
          api.log("Reply C: re-scanning changes the scans, not the scorecard. Today the new search finds " + cs.found + " of " + cs.total +
            " old scans in its top 5, and without scoring again nobody will know whether the re-scan moved that.", "warn");
        } else if (v === "3") {
          C.search = "new"; C.k = 5; C.metric = "recall"; C.slice = "scan"; C.q = "Q1";
          draw(api);
          api.log("Reply D: recall at 5. All queries: " + both("recall", 5, "all") + ". Old scans: " + both("recall", 5, "scan") +
            ". Digital: " + both("recall", 5, "digital") + ". Every report the new search misses is a scan: " + card("new", 5, "all").missed.join(", ") + ".", "ok");
        } else {
          return;
        }
        S.ctl.search.set(C.search); S.ctl.k.set(C.k); S.ctl.metric.set(C.metric); S.ctl.slice.set(C.slice); S.ctl.q.set(C.q);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        recall: api.stat("recall", "recall at k (mean over queries)", ""),
        precision: api.stat("precision", "precision at k", ""),
        mrr: api.stat("mrr", "mean reciprocal rank", ""),
        ndcg: api.stat("ndcg", "nDCG at k", ""),
        found: api.stat("found", "right reports in the top k", "warn"),
        first: api.stat("first", "queries with the first result right", ""),
        older: api.stat("older", "rank of S3, Lowri's 2023 scan, for Q1", "bad")
      };

      api.info("<strong>How to read it.</strong> Eight searches Lowri labelled, each a recent report's description, over twelve reports: S1 to S5 are old paper scans, D1 to D7 digital. Each search ranks all twelve. The top table is one query's ranked list; the amber line is the top k. Below it, the chosen metric is worked out for that query, then averaged over the queries in the slice. The bottom table is the whole scorecard at this k.");

      draw(api);
      api.log("Tonight's search, Q1, by the new search: D6 1st, S3 (Lowri's 2023 scan) " + ord(rankOf("new", "Q1", "S3")) +
        ". The old search had S3 " + ord(rankOf("old", "Q1", "S3")) + ". First result right: old " + card("old", 5, "all").firstRight +
        " of 8, new " + card("new", 5, "all").firstRight + " of 8.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function hasAll(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: tonight, the new search, k 5, all queries, Q1.
      t.expect(t.stat("recall") === 0.75 && t.stat("mrr") === 0.83 && t.stat("found") === "11 of 14" &&
        t.stat("first") === "6 of 8" && t.stat("older") === 9 &&
        hasAll("Tonight's search, Q1, by the new search: D6 1st, S3 (Lowri's 2023 scan) 9th. The old search had S3 2nd. First result right: old 3 of 8, new 6 of 8."),
        "Opens on tonight: new search, recall at 5 0.75, MRR 0.83, 11 of 14 found, S3 9th, first result right 6 of 8 against 3 of 8");

      // 2. The old search on the same set.
      begin();
      t.set("search", "old");
      t.expect(t.stat("recall") === 0.94 && t.stat("mrr") === 0.67 && t.stat("found") === "13 of 14" &&
        t.stat("first") === "3 of 8" && t.stat("older") === 2 &&
        has("Switched to the old search. The old search, k 5, all queries: recall at 5 0.94, precision at 5 0.33, MRR 0.67, nDCG at 5 0.69; 13 of 14 right reports in the top 5."),
        "Old search: recall at 5 0.94, MRR 0.67, 13 of 14 found, S3 2nd");

      // 3. Precision at 3: the new search wins by one hit (11 of 24 against 10 of 24).
      t.set("k", 3);
      var p3old = t.stat("precision");
      t.set("search", "new");
      t.expect(p3old === 0.42 && t.stat("precision") === 0.46, "Precision at 3: old 0.42, new 0.46");

      // 4. Back to k 5: the new search wins nDCG overall too, narrowly.
      t.set("k", 5);
      t.expect(t.stat("ndcg") === 0.73 && t.stat("precision") === 0.28, "New search at k 5: nDCG 0.73, precision at 5 0.28");

      // 5. The old scans slice: the whole loss is here.
      t.set("slice", "scan");
      var scanNew = [t.stat("recall"), t.stat("found"), t.stat("mrr")];
      t.set("search", "old");
      t.expect(scanNew[0] === 0.5 && scanNew[1] === "3 of 6" && scanNew[2] === 0.29 && t.stat("recall") === 1 && t.stat("found") === "6 of 6",
        "Old scans, k 5: new recall 0.50 (3 of 6), old 1.00 (6 of 6)");

      // 6. The digital slice: the new search is better or equal everywhere.
      t.set("slice", "digital");
      var digOld = [t.stat("recall"), t.stat("mrr")];
      t.set("search", "new");
      t.expect(digOld[0] === 0.83 && digOld[1] === 0.46 && t.stat("recall") === 1 && t.stat("mrr") === 1 && t.stat("found") === "8 of 8",
        "Digital, k 5: old recall 0.83 and MRR 0.46, new 1.00 and 1.00");

      // 7. nDCG at 5 for Q1 by hand: new 0.61, old 0.65.
      t.set("slice", "all");
      t.set("metric", "ndcg");
      var S = t.api.state;
      var wNew = worked(S.C);
      var nNew = score("new", "Q1", 5, "all").ndcg;
      var nOld = score("old", "Q1", 5, "all").ndcg;
      t.expect(r2(nNew) === "0.61" && r2(nOld) === "0.65" &&
        wNew.indexOf("DCG at 5 = 1 / log2(1 + 1) = 1.000. Ideal DCG, every right report at the top: 1.631. nDCG at 5 = 1.000 / 1.631 = 0.61.") >= 0,
        "Q1 by hand: new nDCG at 5 = 1 / 1.631 = 0.61; old = 1.062 / 1.631 = 0.65");

      // 8. Every report the new search misses at k 5 is an old scan.
      var miss = card("new", 5, "all").missed;
      t.expect(miss.join(", ") === "Q1 S3 9th, Q3 S4 7th, Q6 S2 6th" && miss.every(function (m) { return m.split(" ")[1].charAt(0) === "S"; }),
        "The new search's three misses at k 5 are all scans: S3 9th, S4 7th, S2 6th");

      // 9. At k 10 both searches find all 14.
      t.set("k", 10);
      t.expect(t.stat("found") === "14 of 14" && t.stat("recall") === 1, "At k 10 the new search finds all 14 too");

      // 10. Reply A: scored by the first result alone.
      begin();
      t.set("reply", "0");
      t.expect(has("Reply A: scored by the first result alone, precision at 1: old 0.38, new 0.75. The new search stays, and Lowri's 2023 report stays 9th.") &&
        t.stat("precision") === 0.75, "Reply A: precision at 1, old 0.38 against new 0.75, and S3 stays 9th");

      // 11. Reply D: recall at 5 by slice.
      begin();
      t.set("reply", "3");
      t.expect(has("Reply D: recall at 5. All queries: old 0.94, new 0.75. Old scans: old 1.00, new 0.50. Digital: old 0.83, new 1.00. Every report the new search misses is a scan: Q1 S3 9th, Q3 S4 7th, Q6 S2 6th.") &&
        t.stat("recall") === 0.5 && t.stat("found") === "3 of 6",
        "Reply D: recall at 5 overall 0.94 against 0.75; old scans 1.00 against 0.50; digital 0.83 against 1.00");
    }
  });
})();
