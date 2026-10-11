/* sims/a3e04-v1.0.1.js  (published as sims/a3e04.js)
   Case a3e04 "Two Kinds of Searching": a hybrid search lab, from Bryher's night helpline desk at the
   Lanternline Trust, a missing-persons charity. A test archive of ten documents copied from the real
   one is searched three ways: keyword search (BM25), vector search (cosine similarity of stated
   vectors), and both fused by reciprocal rank fusion (RRF). The learner picks the question, the mode,
   the RRF constant k, the rank window and a hand-made synonym list, and reads where Juliet Gorrimer's
   file and the Saltrigg sighting report land, and how many of six known-answer questions pass.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 renames: Isobel Gorringe and Lachlan; the case is
     content/latent/a3/a3e04-v1.0.1.json
   v1.0.0 (2026-10-11) first version: widget sim in api.root, no diagram, theme classes only. No real
     model or embedding. 10 documents, 7 questions (the caller's, plus a test set of 6), 4 modes
     (vector, keyword, hybrid, both lists side by side), k 10/30/60/100, rank window 3/5/10, synonym
     list on or off. selfTest: 11 assertions.

   The model (stated in sim.lede and the info box):
   - Tokens: lower-case, apostrophes dropped, split on anything that isn't a letter or a digit, so
     "98/0417" is two tokens, 98 and 0417. No stemming, no stop words (as the Word Index case, s3e11).
   - BM25 exactly as s3e11: k1 = 1.2, b = 0.75, idf = ln(1 + (N - n + 0.5) / (n + 0.5)), score per
     search token = idf x f x 2.2 / (f + 1.2 x (0.25 + 0.75 x dl / avgdl)), summed over the distinct
     search tokens. N = 10, total length 202 tokens, avgdl = 20.2. Only documents scoring above 0 are
     listed. Ties: archive order.
   - Vectors: 5 named teaching dimensions (a case file, a name like Gor-, a yellow coat, the coast and
     the lighthouse, someone waiting at home), stated for every document and question. Score = cosine
     similarity. Every document is listed. Ties: archive order.
   - RRF: each file scores the sum over the two lists of 1 / (k + rank), counting only the top
     "window" results of each list. Ties go to the better keyword rank, then the better vector rank.
   - The volunteer reads the top 3 of the list the mode gives; side by side, the top 3 of both (6).
   - A test question passes when its right file comes first (name and number questions) or within the
     top 3 (descriptions). Side by side: first in either list, or top 3 of either.
   - Synonym list: raincoat also searches coat, yellow also searches mustard (keyword list only).

   Where every number comes from (conventions rule 14; the case is content/latent/a3/a3e04-v1.0.1.json).
   All of them follow from DOCS, QUERIES and the functions below:
   - Story, Thursday 23:52, "Gorrimer 98/0417", vector search: Margaret Gorman 0.929, Rowena Gormley
     0.898, Isobel Gorringe 0.859; Juliet Gorrimer's file 4th at 0.745 (not shown; 3 are shown).
   - Keyword (BM25): her file is the only match, 4.99 (gorrimer, 98 and 0417 are in her file alone).
   - Hybrid, k 60, window 10: her file 1/61 + 1/64 = 0.0320, first; Margaret Gorman 1/61 = 0.0164.
   - Conal's description, "woman in a long yellow raincoat walking to St Cleave's Light":
     vector: Saltrigg sighting 0.997 first, her file 0.708. Keyword: her file 12.81, the 2003 letter
     3.44, Lachlan Tarrant 2.35, Isobel Gorringe 2.30, the sighting 5th at 1.53 (it shares only woman and
     in). Hybrid k 60 window 10: her file 0.0325, the sighting 1/65 + 1/61 = 0.0318, second.
   - Synonym list on: the sighting rises to keyword 2nd at 4.29 (mustard, coat added).
   - The trap, test question "97/0211" (Isobel Gorringe), window 3: Margaret Gorman is 3rd in both lists,
     2/63 = 0.0317, first; Isobel's file is keyword 1st but vector 4th, outside the window: 1/61 = 0.0164,
     second (tied with Lachlan Tarrant's vector-only 0.0164, and ahead on keyword rank). Window 5 or 10:
     Isobel's file 1/61 + 1/64 = 0.0320 against Margaret's 0.0317.
   - Test set (6): vector only 2 of 6; keyword only 4 of 6; keyword with synonyms 5 of 6 (the lamp
     question finds nothing); side by side 6 of 6 with 6 results to read; hybrid window 3: 5 of 6 for
     k 10, 30, 60 and 100; hybrid window 5 or 10: 6 of 6 for every k.
   - Story-only numbers, not computed: the 27 years from 1999 to 2026; the archive's age; 23:52.
   - The cold case's added scores (13.52, 3.54, 2.68, 2.63, 2.53) are the shown BM25 plus cosine
     values for the description; the sim doesn't add them.

   Notes: no random numbers; colours only from theme classes (mark-ok, mark-no, muted, small, table-wrap).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 23 * 3600 + 52 * 60;   // Thursday 23:52, the call
  var K1 = 1.2, B = 0.75, SHOWN = 3;
  var KS = [10, 30, 60, 100];
  var WINDOWS = [3, 5, 10];
  var SYN = { raincoat: ["coat"], yellow: ["mustard"] };
  var DIMS = ["a case file", "a name like Gor-", "a yellow coat", "the coast and the lighthouse", "someone waiting at home"];

  var DOCS = [
    { id: "F1", name: "Juliet Gorrimer, 98/0417", v: [0.6, 0.6, 0.5, 0.4, 0],
      text: "Case 98/0417. Juliet Gorrimer, 34, missing from Wetherdene since March 1998. Last seen in a long yellow raincoat with horn toggles. She spoke of walking to St Cleave's Light." },
    { id: "F2", name: "Margaret Gorman, 97/0388", v: [0.7, 0.7, 0.1, 0, 0],
      text: "Case 97/0388. Margaret Gorman, 41, missing from Coldbrook since May 1997. Last seen in a grey anorak at the bus station." },
    { id: "F3", name: "Isobel Gorringe, 97/0211", v: [0.7, 0.6, 0.3, 0, 0],
      text: "Case 97/0211. Isobel Gorringe, 29, missing from Ullersby Fell since June 1997. Last seen in a yellow cardigan on the canal path." },
    { id: "F4", name: "Rowena Gormley, 99/0102", v: [0.7, 0.6, 0, 0.1, 0],
      text: "Case 99/0102. Rowena Gormley, 52, missing from Wetherdene since April 1999. Last seen in a red coat at the market." },
    { id: "F5", name: "Lachlan Tarrant, 96/0045", v: [0.8, 0.1, 0, 0.1, 0.1],
      text: "Case 96/0045. Lachlan Tarrant, 19, missing from Coldbrook since January 1996. Last seen in a long black coat by the river." },
    { id: "F6", name: "Annis Bellwood, 97/0326", v: [0.5, 0.1, 0, 0, 0.6],
      text: "Case 97/0326. Annis Bellwood, 23, missing since 1997. Her mother still waits." },
    { id: "S1", name: "Saltrigg sighting, 1999", v: [0.2, 0, 0.7, 0.7, 0],
      text: "Sighting report, Saltrigg, November 1999. Woman in mustard duffel coat asked the ferryman which way was the old lighthouse at Garrow Head. Went on alone, on foot." },
    { id: "L1", name: "Letter, 2003 (porch light)", v: [0.1, 0, 0, 0.1, 0.9],
      text: "Letter, 2003. My sister kept the porch light on every night, in case the woman came home." },
    { id: "L2", name: "Letter, 2011 (home now)", v: [0.2, 0, 0, 0, 0.5],
      text: "Letter, 2011. I rang one night in 2009 and someone answered. I am home now." },
    { id: "R1", name: "Helpline rota, 1998", v: [0.2, 0, 0, 0, 0.1],
      text: "Helpline rota, 1998. Night volunteers answer the phones from ten until six." }
  ];

  var QUERIES = [
    { id: "q0", kind: "name and number", text: "Gorrimer 98/0417", right: "F1", v: [0.4, 0.9, 0, 0, 0], label: "The caller, 23:52: Gorrimer 98/0417" },
    { id: "n1", kind: "name", text: "Rowena Gormley", right: "F4", v: [0.4, 0.9, 0, 0, 0] },
    { id: "n2", kind: "name", text: "Lachlan Tarrant", right: "F5", v: [0.9, 0.1, 0, 0, 0.3] },
    { id: "c1", kind: "number", text: "98/0417", right: "F1", v: [0.9, 0.3, 0, 0, 0] },
    { id: "c2", kind: "number", text: "97/0211", right: "F3", v: [0.9, 0.3, 0, 0, 0] },
    { id: "d1", kind: "description", text: "woman in a long yellow raincoat walking to St Cleave's Light", right: "S1", v: [0.2, 0, 0.7, 0.6, 0], label: "Conal's description (a test question too)" },
    { id: "d2", kind: "description", text: "lamp left burning for lost daughter", right: "L1", v: [0.1, 0, 0, 0, 0.9] }
  ];
  var TESTS = ["n1", "n2", "c1", "c2", "d1", "d2"];

  var MODES = [
    { value: "vector", label: "Vector search only (the assistant as it runs)" },
    { value: "keyword", label: "Keyword search only (BM25, the 2012 box)" },
    { value: "hybrid", label: "Hybrid: both, fused by reciprocal rank fusion" },
    { value: "both", label: "Both lists side by side, no fusion" }
  ];
  var MODE_SHORT = { vector: "vector search only", keyword: "keyword search only", hybrid: "hybrid (RRF)", both: "both lists side by side" };

  /* ---------- small helpers ---------- */

  function f2(x) { return x.toFixed(2); }
  function f3(x) { return x.toFixed(3); }
  function f4(x) { return x.toFixed(4); }
  function q(id) { for (var i = 0; i < QUERIES.length; i++) if (QUERIES[i].id === id) return QUERIES[i]; return null; }
  function doc(id) { for (var i = 0; i < DOCS.length; i++) if (DOCS[i].id === id) return DOCS[i]; return null; }
  function order(id) { for (var i = 0; i < DOCS.length; i++) if (DOCS[i].id === id) return i; return 99; }
  function rankOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i + 1; return 0; }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function tok(s) { return s.toLowerCase().replace(/'/g, "").split(/[^a-z0-9]+/).filter(function (x) { return x; }); }

  var IDX = (function () {
    var toks = {}, df = {}, total = 0;
    DOCS.forEach(function (d) {
      var t = tok(d.text), seen = {};
      toks[d.id] = t;
      total += t.length;
      t.forEach(function (w) { if (!seen[w]) { seen[w] = true; df[w] = (df[w] || 0) + 1; } });
    });
    return { toks: toks, df: df, N: DOCS.length, total: total, avgdl: total / DOCS.length };
  })();

  function idf(n) { return Math.log(1 + (IDX.N - n + 0.5) / (n + 0.5)); }
  function bm25(f, dl, n) { return idf(n) * f * (K1 + 1) / (f + K1 * (1 - B + B * dl / IDX.avgdl)); }

  function searchTokens(text, syn) {
    var base = tok(text), out = [];
    base.forEach(function (w) {
      if (out.indexOf(w) < 0) out.push(w);
      if (syn && SYN[w]) SYN[w].forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    });
    return out;
  }

  function keyword(Q, syn) {
    var qt = searchTokens(Q.text, syn), out = [];
    DOCS.forEach(function (d) {
      var t = IDX.toks[d.id], s = 0, words = [];
      qt.forEach(function (w) {
        var f = 0;
        for (var i = 0; i < t.length; i++) if (t[i] === w) f += 1;
        if (f) { s += bm25(f, t.length, IDX.df[w]); words.push(w); }
      });
      if (s > 0) out.push({ id: d.id, s: s, words: words });
    });
    out.sort(function (a, b) { return (b.s - a.s) || (order(a.id) - order(b.id)); });
    return out;
  }

  function cosine(a, b) {
    var d = 0, x = 0, y = 0;
    for (var i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
    return d / Math.sqrt(x * y);
  }

  function vector(Q) {
    var out = DOCS.map(function (d) { return { id: d.id, s: cosine(Q.v, d.v) }; });
    out.sort(function (a, b) { return (b.s - a.s) || (order(a.id) - order(b.id)); });
    return out;
  }

  function fuse(kl, vl, k, w) {
    var m = {};
    function add(list, key) {
      list.slice(0, w).forEach(function (x, i) {
        var e = m[x.id] || (m[x.id] = { id: x.id, s: 0, rk: 0, rv: 0 });
        e.s += 1 / (k + i + 1);
        e[key] = i + 1;
      });
    }
    add(kl, "rk");
    add(vl, "rv");
    var out = Object.keys(m).map(function (id) { return m[id]; });
    out.sort(function (a, b) {
      return (b.s - a.s) || ((a.rk || 99) - (b.rk || 99)) || ((a.rv || 99) - (b.rv || 99)) || (order(a.id) - order(b.id));
    });
    return out;
  }

  function lists(Q, C) {
    var kl = keyword(Q, C.syn), vl = vector(Q);
    return { kl: kl, vl: vl, fl: fuse(kl, vl, C.k, C.w) };
  }

  // The list the volunteer reads in this mode (side by side: null, both are read).
  function readList(L, mode) { return mode === "keyword" ? L.kl : (mode === "vector" ? L.vl : (mode === "hybrid" ? L.fl : null)); }

  function passes(Q, L, mode) {
    function ok(list) { var r = rankOf(list, Q.right); return Q.kind === "description" ? (r >= 1 && r <= SHOWN) : r === 1; }
    if (mode === "both") return ok(L.kl) || ok(L.vl);
    return ok(readList(L, mode));
  }

  function testRun(C) {
    var res = TESTS.map(function (id) { var Q = q(id), L = lists(Q, C); return { Q: Q, L: L, pass: passes(Q, L, C.mode) }; });
    return { res: res, pass: res.filter(function (x) { return x.pass; }).length };
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var d = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, cls, style, text) {
      var e = d.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    function head(text) { box.appendChild(el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text)); }
    function line() { var p = el("p", "", "margin:0;font-size:13px;", ""); box.appendChild(p); return p; }
    function table(cols) {
      var wrap = el("div", "table-wrap", "", ""), t = el("table", "", "font-size:12px;", ""), th = el("thead", "", "", ""), tr = el("tr", "", "", "");
      cols.forEach(function (h) { tr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h)); });
      th.appendChild(tr); t.appendChild(th);
      var body = el("tbody", "", "", "");
      t.appendChild(body); wrap.appendChild(t); box.appendChild(wrap);
      return body;
    }
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "A test archive of 10 documents copied from the Lanternline archive. BM25 is computed exactly (k1 1.2, b 0.75). " +
      "The vectors are stated by hand on 5 named dimensions, a teaching simplification: no real embedding model runs here."));
    var setLine = line();
    head("The three ranked lists, with scores");
    var lBody = table(["rank", "keyword (BM25)", "vector (cosine)", "fused (RRF)"]);
    head("What the volunteer reads");
    var seeLine = line(), whereLine = line();
    seeLine.setAttribute("aria-live", "polite");
    head("The test set: 6 questions whose right files are known");
    var tBody = table(["question", "kind", "right file", "where it lands", "passes"]);
    var testLine = line();
    api.root.appendChild(box);
    return { el: el, setLine: setLine, lBody: lBody, seeLine: seeLine, whereLine: whereLine, tBody: tBody, testLine: testLine };
  }

  function cfgOf(S) { return { mode: S.mode, k: S.k, w: S.w, syn: S.syn }; }

  function landText(L, mode, id) {
    if (mode === "both") {
      var a = rankOf(L.kl, id), b = rankOf(L.vl, id);
      return "keyword " + (a || "none") + ", vector " + (b || "none");
    }
    var r = rankOf(readList(L, mode), id);
    return r ? String(r) : "not listed";
  }

  function scoreText(L, mode, id) {
    if (mode === "both") return "-";
    var list = readList(L, mode), r = rankOf(list, id);
    if (!r) return "-";
    var s = list[r - 1].s;
    return mode === "keyword" ? f2(s) : (mode === "vector" ? f3(s) : f4(s));
  }

  function draw(api) {
    var S = api.state, ui = S.ui, el = ui.el, C = cfgOf(S), Q = q(S.qid);
    var L = lists(Q, C), T = testRun(C);
    S.L = L; S.T = T;
    ui.setLine.textContent = "Search: " + Q.text + ". Mode: " + MODE_SHORT[C.mode] + ". RRF k " + C.k + ", rank window " + C.w +
      ". Synonym list " + (C.syn ? "on (raincoat: coat; yellow: mustard)" : "off") + ".";
    while (ui.lBody.firstChild) ui.lBody.removeChild(ui.lBody.firstChild);
    var cols = [[L.kl, "keyword", f2], [L.vl, "vector", f3], [L.fl, "hybrid", f4]];
    for (var i = 0; i < DOCS.length; i++) {
      var tr = el("tr", "", "", "");
      tr.appendChild(el("td", "", "padding:2px 6px;", String(i + 1)));
      cols.forEach(function (c) {
        var x = c[0][i], cls = "", txt = "";
        if (x) {
          txt = doc(x.id).name + " · " + c[2](x.s);
          var read = (C.mode === c[1] || (C.mode === "both" && c[1] !== "hybrid")) && i < SHOWN;
          var inWin = c[1] === "hybrid" || C.mode !== "hybrid" || i < C.w;
          cls = x.id === Q.right ? "mark-ok" : (inWin ? "" : "muted");
          if (read) txt += " (read)";
          if (!inWin) txt += " (outside window)";
        }
        tr.appendChild(el("td", cls, "padding:2px 6px;white-space:nowrap;", txt));
      });
      ui.lBody.appendChild(tr);
    }
    var seen;
    if (C.mode === "both") seen = "Keyword: " + L.kl.slice(0, SHOWN).map(function (x) { return doc(x.id).name; }).join("; ") +
      ". Vector: " + L.vl.slice(0, SHOWN).map(function (x) { return doc(x.id).name; }).join("; ") + ". Six results, two orders.";
    else {
      var rl = readList(L, C.mode);
      seen = rl.length ? "Top " + SHOWN + ": " + rl.slice(0, SHOWN).map(function (x) { return doc(x.id).name; }).join("; ") + "." : "No results: no document shares a word with the search.";
    }
    ui.seeLine.textContent = seen;
    ui.seeLine.className = passes(Q, L, C.mode) ? "mark-ok" : "mark-no";
    ui.whereLine.textContent = "Right file for this search: " + doc(Q.right).name + ", " + landText(L, C.mode, Q.right) +
      ". Her file: " + landText(L, C.mode, "F1") + ". The Saltrigg sighting: " + landText(L, C.mode, "S1") + ".";
    while (ui.tBody.firstChild) ui.tBody.removeChild(ui.tBody.firstChild);
    T.res.forEach(function (x) {
      var tr = el("tr", "", "", "");
      [x.Q.text, x.Q.kind, doc(x.Q.right).name, landText(x.L, C.mode, x.Q.right), x.pass ? "yes" : "no"].forEach(function (v, j) {
        tr.appendChild(el("td", j === 4 ? (x.pass ? "mark-ok" : "mark-no") : "", "padding:2px 6px;" + (j === 0 ? "min-width:200px;" : "white-space:nowrap;"), v));
      });
      ui.tBody.appendChild(tr);
    });
    ui.testLine.textContent = "Passed: " + T.pass + " of 6. A name or number passes when its right file comes first; a description, within the top " +
      SHOWN + ". Results to read per question: " + (C.mode === "both" ? 6 : SHOWN) + ".";
    var rl0 = readList(L, C.mode);
    S.stat.first(C.mode === "both" ? (L.kl.length ? doc(L.kl[0].id).name : "none") + " / " + doc(L.vl[0].id).name : (rl0.length ? doc(rl0[0].id).name : "none"));
    S.stat.right(landText(L, C.mode, Q.right));
    S.stat.her(landText(L, C.mode, "F1"));
    S.stat.herScore(scoreText(L, C.mode, "F1"));
    S.stat.sighting(landText(L, C.mode, "S1"));
    S.stat.pass(T.pass + " of 6");
    S.stat.read(C.mode === "both" ? 6 : SHOWN);
  }

  function summary(S) {
    var Q = q(S.qid), L = S.L, rl = readList(L, S.mode), first;
    if (S.mode === "both") first = "keyword first " + (L.kl.length ? doc(L.kl[0].id).name : "none") + ", vector first " + doc(L.vl[0].id).name;
    else first = rl.length ? "first " + doc(rl[0].id).name + " " + scoreText(L, S.mode, rl[0].id) : "no results";
    return Q.text + ": " + first + ". Right file: " + landText(L, S.mode, Q.right) + ". Test set: " + S.T.pass + " of 6.";
  }
  function change(api, prefix) {
    var S = api.state;
    draw(api);
    api.log(prefix + summary(S), passes(q(S.qid), S.L, S.mode) ? "ok" : "bad");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e04", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.qid = "q0"; S.mode = "vector"; S.k = 60; S.w = 10; S.syn = false;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.q = api.control.select("q", "Search", QUERIES.map(function (x) {
        return { value: x.id, label: x.label || ("Test, " + x.kind + ": " + x.text) };
      }), "q0", function (v) { if (!q(v)) return; S.qid = v; change(api, "Search: " + q(v).text + ". "); });
      S.ctl.mode = api.control.select("mode", "Mode", MODES, "vector", function (v) {
        if (!MODE_SHORT[v]) return; S.mode = v; change(api, "Mode: " + MODE_SHORT[v] + ". ");
      });
      S.ctl.k = api.control.select("k", "RRF constant k", KS.map(function (n) { return { value: n, label: String(n) }; }), 60, function (v) {
        var n = Number(v); if (KS.indexOf(n) < 0) return; S.k = n; change(api, "k: " + n + ". ");
      });
      S.ctl.w = api.control.select("w", "Rank window (from each list)", WINDOWS.map(function (n) { return { value: n, label: String(n) }; }), 10, function (v) {
        var n = Number(v); if (WINDOWS.indexOf(n) < 0) return; S.w = n; change(api, "Rank window: " + n + ". ");
      });
      S.ctl.syn = api.control.toggle("syn", "Hand-made synonym list (raincoat: coat; yellow: mustard)", false, function (v) {
        S.syn = !!v; change(api, "Synonym list " + (S.syn ? "on" : "off") + ". ");
      });
      S.ctl.reset = api.control.button("reset", "Reset to 23:52", function () { api.reset(); });
      S.stat = {
        first: api.stat("first", "first result read", ""),
        right: api.stat("right", "right file's rank", "ok"),
        her: api.stat("her", "Juliet Gorrimer's file, rank", ""),
        herScore: api.stat("herScore", "her file's score", ""),
        sighting: api.stat("sighting", "Saltrigg sighting, rank", "warn"),
        pass: api.stat("pass", "test set passed", "ok"),
        read: api.stat("read", "results to read per question", "")
      };
      api.info("<strong>How to read it.</strong> Keyword search scores the words themselves with BM25: rare words weigh most, " +
        "and a document that shares no word isn't listed. Vector search scores every document by the cosine similarity of stated " +
        "vectors on five named dimensions (" + DIMS.join(", ") + "). Reciprocal rank fusion gives each file 1 / (k + rank) " +
        "from each list, counting only the top results of each list up to the rank window, and adds them. Ties go to the better keyword rank. " +
        "The volunteer reads the top 3. Green marks the right file for the search.");
      draw(api);
      api.log("Thursday 23:52, the caller's search, the assistant as it runs: vector search only. " + summary(S), "bad");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function names(list, n) { return list.slice(0, n).map(function (x) { return x.id; }).join(","); }
      function sc(list, n, fn) { return list.slice(0, n).map(function (x) { return fn(x.s); }).join(" "); }

      // 1. The opening state: 23:52, the caller's search, vector search only.
      await t.run(0.5);
      t.expect(st().qid === "q0" && st().mode === "vector" && st().k === 60 && st().w === 10 && !st().syn &&
        t.stat("first") === "Margaret Gorman, 97/0388" && t.stat("her") === 4 && t.stat("herScore") === 0.745 &&
        t.stat("pass") === "2 of 6" && t.stat("read") === 3 &&
        t.logText().indexOf("Gorrimer 98/0417: first Margaret Gorman, 97/0388 0.929. Right file: 4. Test set: 2 of 6.") >= 0,
        "opens at 23:52 on vector search only: Margaret Gorman first at 0.929, her file 4th at 0.745, test set 2 of 6");

      // 2. The vector list's exact scores, and BM25's one match.
      var L = st().L;
      t.expect(names(L.vl, 4) === "F2,F4,F3,F1" && sc(L.vl, 4, f3) === "0.929 0.898 0.859 0.745" &&
        L.kl.length === 1 && L.kl[0].id === "F1" && f2(L.kl[0].s) === "4.99" && IDX.total === 202 && Math.abs(IDX.avgdl - 20.2) < 1e-12,
        "vector: Gorman 0.929, Gormley 0.898, Gorringe 0.859, her file 0.745; keyword: her file alone at 4.99; avgdl 202 / 10 = 20.2");

      // 3. Keyword search only: her file first; the test set misses both descriptions.
      t.set("mode", "keyword");
      t.expect(t.stat("first") === "Juliet Gorrimer, 98/0417" && t.stat("her") === 1 && t.stat("herScore") === 4.99 && t.stat("pass") === "4 of 6",
        "keyword only: her file first at 4.99; test set 4 of 6");

      // 4. Hybrid: 1/61 + 1/64 = 0.0320 puts her file first; every test passes.
      t.set("mode", "hybrid");
      var her = st().L.fl[0];
      t.expect(her.id === "F1" && Math.abs(her.s - (1 / 61 + 1 / 64)) < 1e-12 && t.stat("herScore") === 0.032 &&
        f4(st().L.fl[1].s) === "0.0164" && st().L.fl[1].id === "F2" && t.stat("pass") === "6 of 6",
        "hybrid, k 60, window 10: her file 1/61 + 1/64 = 0.0320 first, Gorman 0.0164 second; test set 6 of 6");

      // 5. Conal's description: keyword puts the sighting 5th, vectors 1st, fusion 2nd.
      t.set("q", "d1");
      L = st().L;
      var s1 = L.kl[rankOf(L.kl, "S1") - 1];
      t.expect(names(L.kl, 5) === "F1,L1,F5,F3,S1" && sc(L.kl, 5, f2) === "12.81 3.44 2.35 2.30 1.53" && s1.words.join(",") === "woman,in" &&
        names(L.vl, 2) === "S1,F1" && sc(L.vl, 2, f3) === "0.997 0.708" &&
        t.stat("sighting") === 2 && f4(L.fl[1].s) === "0.0318" && Math.abs(L.fl[1].s - (1 / 65 + 1 / 61)) < 1e-12,
        "description: keyword 5th at 1.53 (shares only woman, in), vector 1st at 0.997, hybrid 2nd at 1/65 + 1/61 = 0.0318");

      // 6. BM25 by hand for the sighting.
      var byHand = Math.log(1 + 8.5 / 2.5) * 2.2 / (1 + 1.2 * (0.25 + 0.75 * 27 / 20.2)) +
        Math.log(1 + 2.5 / 8.5) * 2.2 / (1 + 1.2 * (0.25 + 0.75 * 27 / 20.2));
      t.expect(Math.abs(s1.s - byHand) < 1e-12 && IDX.df.woman === 2 && IDX.df["in"] === 8 && IDX.toks.S1.length === 27,
        "BM25 by hand: woman (n 2) and in (n 8) in a 27-token report, avgdl 20.2: 1.53");

      // 7. The trap: 97/0211 with a rank window of 3.
      t.set("q", "c2");
      t.set("w", 3);
      L = st().L;
      var trapped = L.fl[0].id === "F2" && f4(L.fl[0].s) === "0.0317" && Math.abs(L.fl[0].s - 2 / 63) < 1e-12 &&
        L.fl[1].id === "F3" && L.fl[2].id === "F5" && L.fl[1].s === L.fl[2].s && t.stat("right") === 2 && t.stat("pass") === "5 of 6";
      t.set("w", 5);
      t.expect(trapped && st().L.fl[0].id === "F3" && f4(st().L.fl[0].s) === "0.0320" && t.stat("pass") === "6 of 6",
        "window 3: Gorman, 3rd in both, 2/63 = 0.0317 beats Isobel Gorringe's file at 1/61 = 0.0164 (vector 4th, outside); 5 of 6. Window 5: 6 of 6");

      // 8. k barely matters here; the window does.
      var byK = [];
      [10, 30, 100, 60].forEach(function (k) {
        t.set("k", k);
        t.set("w", 10); byK.push(t.stat("pass"));
        t.set("w", 3); byK.push(t.stat("pass"));
      });
      t.set("w", 10);
      t.expect(byK.join("|") === "6 of 6|5 of 6|6 of 6|5 of 6|6 of 6|5 of 6|6 of 6|5 of 6",
        "k 10, 30, 100 and 60: 6 of 6 at window 10, 5 of 6 at window 3 every time");

      // 9. Option 1: keyword only with a hand-made synonym list.
      t.set("mode", "keyword");
      t.set("syn", true);
      t.set("q", "d1");
      L = st().L;
      var synOk = L.kl[1].id === "S1" && f2(L.kl[1].s) === "4.29" && t.stat("pass") === "5 of 6";
      t.set("q", "d2");
      t.expect(synOk && st().L.kl.length === 0 && t.stat("right") === "not listed" && t.stat("first") === "none",
        "keyword with synonyms: the sighting rises to 2nd at 4.29; 5 of 6, the lamp question finds nothing");
      t.set("syn", false);

      // 10. Option 3: both lists side by side.
      t.set("mode", "both");
      t.set("q", "q0");
      t.expect(t.stat("pass") === "6 of 6" && t.stat("read") === 6 && t.stat("her") === "keyword 1, vector 4" &&
        t.stat("first") === "Juliet Gorrimer, 98/0417 / Margaret Gorman, 97/0388",
        "side by side: 6 of 6, but 6 results to read and two orders that disagree");

      // 11. A tie at 1/61: 98/0417 at window 3, her file wins on keyword rank.
      t.set("mode", "hybrid");
      t.set("q", "c1");
      t.set("w", 3);
      L = st().L;
      t.expect(L.fl[0].id === "F1" && L.fl[1].id === "F5" && L.fl[0].s === 1 / 61 && L.fl[1].s === 1 / 61 && t.stat("right") === 1,
        "98/0417 at window 3: her file and Lachlan Tarrant's both score 1/61; the tie goes to the better keyword rank");
    }
  });
})();
