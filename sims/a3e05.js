/* sims/a3e05-v1.0.0.js  (published as sims/a3e05.js)
   Case a3e05 "The Second Opinion": a rerank lab for the Saltcote Prize's copy checker. The winning
   entry, "Lamp Oil", is searched against a teaching sample of 12 of the archive's 40,000 poems.
   Hybrid search (BM25 plus one embedding vector per poem, joined by reciprocal rank fusion) ranks
   them; a cross-encoder can rerank the candidates; the top n go to a stand-in judge. The learner
   sets the candidates retrieved (k), the candidates reranked, the top n sent, the reranker on or
   off, a bigger embedding model, or a judge that reads all 40,000 poems one call at a time, and
   reads where The Lamp-Room lands, the verdict, latency and cost per entry, and how many of the
   jury's 12 known copies are caught. Widget-style sim: it draws its own tables inside api.root.
   No real model, no real embedding.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 12 named poems with stated BM25 scores, cosine similarities
     (current and bigger embedding model) and cross-encoder scores against "Lamp Oil"; ranks and
     fused scores computed here; filler candidates past 12th; 12 known copies with stated source
     places; presets for the night and the four replies. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - BM25 rank and vector rank are ranks among the 12 sample poems, from the stated scores. The
     other 39,988 poems rank below all 12 in both lists for this entry: a teaching assumption.
   - Fused score = 1/(60 + BM25 rank) + 1/(60 + vector rank): reciprocal rank fusion, k = 60
     (Elasticsearch's default rank_constant). Ties would go to the better BM25 rank; there are none.
   - Candidates 13th to 100th are unnamed filler that the cross-encoder scores 0.02 each (from the
     prize's log: none of them scored above 0.02). They only add rerank time and judge reading.
   - Reranking: the first min(k, reranked) candidates are scored as pairs with the entry and sorted
     by that score. With the reranker off, the first-stage order stands.
   - The stand-in judge reads the top n it is sent (n capped by what was retrieved or reranked). It
     notices a copied source at place p of s sent when p <= 5 or p > s - 5: a rough stand-in for
     lost in the middle (a1e09). With 10 or fewer sent it notices every place.
   - "Reads all 40,000": one judge call per archive poem, each with one poem; it catches every copy.
   - Times (the prize's measurements): first stage 50 ms; cross-encoder 6 ms a pair on the office
     GPU; judge call 1.0 s plus 0.05 s per poem read. Cost (the prize's bill): 0.2 cents a judge
     call plus 0.1 cent per poem read; the reranker runs on the prize's own GPU and adds no bill.
     2,400 entries a year.
   - Known copies: 12 entries the jury knows are copied (5 caught in earlier years, 7 written as
     tests). For each, the place hybrid search gives its source with the current and the bigger
     embedding model (null: not in the top 100), and its place after reranking whenever the source
     is among the reranked candidates (1 to 3 here).

   Where every number comes from (conventions rule 14; the case is content/latent/a3/a3e05-v1.0.0.json).
   - BM25 ranks: Night Ferry 1, Low Tide 2, Harbour 3, Salt Wind 4, Chapel 5, Keeper's Wife 6,
     Breakwater 7, Tide Keeps 8, Herring 9, Beacon 10, Foghorn 11, The Lamp-Room 12 (BM25 4.1).
   - Vector ranks (current): Harbour 1, Night Ferry 2, Chapel 3, Low Tide 4, Salt Wind 5,
     The Lamp-Room 6 (0.78), Keeper's Wife 7, Foghorn 8, Beacon 9, Tide Keeps 10, Herring 11,
     Breakwater 12.
   - Fused (current): 1 Night Ferry 0.03252, 2 Harbour 0.03227, 3 Low Tide 0.03175, 4 Chapel
     0.03126, 5 Salt Wind 0.03101, 6 Keeper's Wife 0.03008, 7 The Lamp-Room 0.02904 (the night's
     7th), 8 Tide Keeps 0.02899, 9 Breakwater 0.02881, 10 Foghorn 0.02879, 11 Beacon 0.02878,
     12 Herring 0.02858.
   - Bigger model: The Lamp-Room vector 4th (0.83), fused 6th at 0.02951, behind Night Ferry,
     Low Tide, Harbour, Salt Wind and Chapel.
   - Cross-encoder: The Lamp-Room 0.91; next Keeper's Wife 0.31, Low Tide 0.22, Tide Keeps 0.18,
     Salt Wind 0.14. Reranked, The Lamp-Room is 1st whenever it is among the candidates (k >= 7).
   - The night (k 5, top 5, no reranker): NOT COPIED; 50 + 1,000 + 250 = 1,300 ms = 1.30 s;
     0.2 + 0.5 = 0.7 cents; known copies caught 4 of 12 (sources at 1, 1, 2, 3).
   - Top 50 straight: The Lamp-Room 7th of 50, in the middle: NOT COPIED; 3.55 s; 5.2 cents;
     $124.80 a year; 4 of 12 (41st is in the middle too).
   - Retrieve 100, rerank 100, send 5: COPIED; 50 + 600 + 1,250 = 1,900 ms = 1.90 s; 0.7 cents;
     $16.80 a year; 11 of 12 (the 12th's source is not in the top 100); recall at 100: 11 of 12.
   - Bigger model, top 5: The Lamp-Room 6th: NOT COPIED; 5 of 12.
   - All 40,000: COPIED; 12 of 12; 40,000 x 1.05 s = 42,000 s = 11 h 40 min; 40,000 x 0.3 cents
     = $120.00 an entry; $288,000.00 a year.
   - Also: top 10 straight catches the night and 7 of 12; top 20 straight misses it, 4 of 12.
     Rerank 50: 10 of 12, 1.60 s. Retrieve 100 but rerank 12: 7 of 12, 1.37 s. Retrieve 5 with
     the reranker on: The Lamp-Room never retrieved, NOT COPIED, 4 of 12.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // title, year, first line, BM25 score, cosine (current), cosine (bigger), cross-encoder score
  var POEMS = [
    { t: "Night Ferry", y: 1994, line: "The ferry lights go out across the bay.", bm: 14.2, cos: 0.83, big: 0.86, ce: 0.12 },
    { t: "The Harbour at Two", y: 2003, line: "At two the harbour holds its breath.", bm: 13.1, cos: 0.84, big: 0.84, ce: 0.09 },
    { t: "Low Tide, Lamps Lit", y: 1981, line: "Low tide, and every window lit for someone.", bm: 13.6, cos: 0.80, big: 0.85, ce: 0.22 },
    { t: "Fishermen's Chapel", y: 1968, line: "They hung the nets up by the altar rail.", bm: 11.9, cos: 0.81, big: 0.81, ce: 0.07 },
    { t: "Salt Wind", y: 2011, line: "Salt wind at the door like a dog wanting in.", bm: 12.4, cos: 0.79, big: 0.82, ce: 0.14 },
    { t: "The Keeper's Wife", y: 1975, line: "She trimmed his wick and never climbed the stair.", bm: 11.2, cos: 0.77, big: 0.77, ce: 0.31 },
    { t: "The Lamp-Room", y: 1927, line: "I keep the light that no one comes to see.", bm: 4.1, cos: 0.78, big: 0.83, ce: 0.91 },
    { t: "Breakwater", y: 1999, line: "The breakwater takes the weather on its back.", bm: 10.8, cos: 0.70, big: 0.75, ce: 0.05 },
    { t: "What the Tide Keeps", y: 2017, line: "The tide keeps what we tell it, and returns it wrong.", bm: 10.1, cos: 0.73, big: 0.76, ce: 0.18 },
    { t: "Herring Season", y: 1959, line: "Silver to the elbows, the whole street singing.", bm: 9.7, cos: 0.71, big: 0.79, ce: 0.06 },
    { t: "Beacon", y: 1986, line: "One fire on the headland, answering no one.", bm: 9.3, cos: 0.74, big: 0.78, ce: 0.11 },
    { t: "Foghorn Psalm", y: 2008, line: "Low note, long note, the fog's own prayer.", bm: 8.6, cos: 0.75, big: 0.80, ce: 0.08 }
  ];
  var LAMP = "The Lamp-Room";
  var FILLER_CE = 0.02;
  var RRF_K = 60;
  var ARCHIVE = 40000;
  var ENTRIES = 2400;
  var MS_FIRST = 50;
  var MS_PAIR = 6;
  var MS_CALL = 1000;
  var MS_POEM = 50;
  var TENTHS_CALL = 2;   // 0.2 cents a judge call, in tenths of a cent
  var TENTHS_POEM = 1;   // 0.1 cent per poem read

  // Known copies: source place by hybrid search (current, bigger; null = not in the top 100),
  // and place after reranking whenever the source is among the reranked candidates.
  var KNOWN = [
    { fr: 1, fb: 1, rr: 1 }, { fr: 1, fb: 1, rr: 1 }, { fr: 2, fb: 2, rr: 1 }, { fr: 3, fb: 2, rr: 2 },
    { fr: 6, fb: 4, rr: 1 }, { fr: 7, fb: 6, rr: 1 }, { fr: 9, fb: 8, rr: 1 }, { fr: 14, fb: 11, rr: 3 },
    { fr: 23, fb: 17, rr: 1 }, { fr: 41, fb: 35, rr: 2 }, { fr: 68, fb: 52, rr: 1 }, { fr: null, fb: null, rr: 1 }
  ];

  var KS = [5, 10, 12, 20, 50, 100];
  var NS = [1, 3, 5, 10, 20, 50];
  var PRESETS = [
    { value: "night", label: "The night: top 5, no reranker" },
    { value: "fifty", label: "Send the top 50 straight" },
    { value: "rerank", label: "Retrieve 100, rerank, send 5" },
    { value: "bigger", label: "Bigger embedding model, top 5" },
    { value: "all", label: "Judge reads all 40,000" },
    { value: "custom", label: "Your own settings" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function ord(n) {
    var s = ["th", "st", "nd", "rd"];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function opts(list) { return list.map(function (x) { return { value: x, label: String(x) }; }); }
  function secs(ms) {
    if (ms < 60000) return (ms / 1000).toFixed(2) + " s";
    var min = Math.round(ms / 60000);
    return Math.floor(min / 60) + " h " + (min % 60) + " min";
  }
  function cents(tenths) {
    if (tenths < 1000) return (tenths / 10).toFixed(1) + " cents";
    return dollars(tenths);
  }
  function dollars(tenths) {
    var c = Math.round(tenths / 10);   // whole cents
    return "$" + fmt(Math.floor(c / 100)) + "." + ("0" + (c % 100)).slice(-2);
  }

  /* ---------- the model (pure functions) ---------- */

  function rankBy(key) {
    var order = POEMS.map(function (p, i) { return i; });
    order.sort(function (a, b) { return POEMS[b][key] - POEMS[a][key]; });
    var r = [];
    order.forEach(function (i, j) { r[i] = j + 1; });
    return r;
  }

  // First stage: the 12 poems in fused order, each with its ranks and score.
  function firstStage(C) {
    var b = rankBy("bm");
    var v = rankBy(C.big ? "big" : "cos");
    var rows = POEMS.map(function (p, i) {
      return { p: p, b: b[i], v: v[i], s: 1 / (RRF_K + b[i]) + 1 / (RRF_K + v[i]) };
    });
    rows.sort(function (x, y) { return (y.s - x.s) || (x.b - y.b); });
    rows.forEach(function (r, i) { r.pos = i + 1; });
    return rows;
  }

  function noticed(p, s) { return p <= 5 || p > s - 5; }

  function evaluate(C) {
    var first = firstStage(C);
    var R = {};
    R.first = first;
    var lampPos = 0;
    first.forEach(function (r) { if (r.p.t === LAMP) lampPos = r.pos; });
    R.lampPos = lampPos;
    R.pool = C.rerank ? Math.min(C.k, C.m) : 0;
    R.reranked = [];
    if (C.rerank) {
      var named = first.filter(function (r) { return r.pos <= R.pool; }).slice();
      named.sort(function (x, y) { return (y.p.ce - x.p.ce) || (x.pos - y.pos); });
      R.reranked = named;
    }
    R.sent = C.rerank ? Math.min(C.n, R.pool) : Math.min(C.n, C.k);
    var lampRR = 0;
    R.reranked.forEach(function (r, i) { if (r.p.t === LAMP) lampRR = i + 1; });
    R.lampRR = lampRR;
    var place = C.rerank ? lampRR : (lampPos <= C.k ? lampPos : 0);
    R.copied = C.all ? true : (place > 0 && place <= R.sent && noticed(place, R.sent));
    // known copies
    var caught = 0;
    var inK = 0;
    var detail = [];
    KNOWN.forEach(function (kc) {
      var f = C.big ? kc.fb : kc.fr;
      var retrieved = f !== null && f <= C.k;
      if (retrieved) inK += 1;
      var ok;
      if (C.all) ok = true;
      else if (C.rerank) ok = f !== null && f <= R.pool && kc.rr <= R.sent && noticed(kc.rr, R.sent);
      else ok = retrieved && f <= R.sent && noticed(f, R.sent);
      if (ok) caught += 1;
      detail.push({ f: f, ok: ok });
    });
    R.caught = caught;
    R.inK = inK;
    R.detail = detail;
    if (C.all) {
      R.ms = ARCHIVE * (MS_CALL + MS_POEM);
      R.tenths = ARCHIVE * (TENTHS_CALL + TENTHS_POEM);
    } else {
      R.ms = MS_FIRST + (C.rerank ? R.pool * MS_PAIR : 0) + MS_CALL + MS_POEM * R.sent;
      R.tenths = TENTHS_CALL + TENTHS_POEM * R.sent;
    }
    R.yearTenths = R.tenths * ENTRIES;
    return R;
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = String(text);
      return e;
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;");
    var entry = el("p", "margin:0;", "Entry: \"Lamp Oil\" (2026), first line: \"I tend a flame that nobody will visit.\"");
    var head = el("p", "margin:0;font-weight:600;", "");
    var cols = el("div", "display:flex;flex-wrap:wrap;gap:12px;min-width:0;");
    var left = el("div", "flex:1 1 300px;min-width:0;overflow-x:auto;");
    var right = el("div", "flex:1 1 220px;min-width:0;overflow-x:auto;");
    cols.appendChild(left);
    cols.appendChild(right);
    var known = el("div", "min-width:0;overflow-x:auto;");
    box.appendChild(entry);
    box.appendChild(head);
    box.appendChild(cols);
    box.appendChild(known);
    api.root.appendChild(box);
    return { el: el, head: head, left: left, right: right, known: known };
  }

  function table(ui, parent, caption, headers, rows) {
    var el = ui.el;
    clear(parent);
    parent.appendChild(el("p", "margin:0 0 4px;font-weight:600;", caption));
    var tb = el("table", "width:100%;border-collapse:collapse;");
    var tr = el("tr");
    headers.forEach(function (h) { tr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
    tb.appendChild(tr);
    rows.forEach(function (r) {
      var row = el("tr", r.style || "");
      r.cells.forEach(function (c) { row.appendChild(el("td", "padding:2px 4px;", c)); });
      tb.appendChild(row);
    });
    parent.appendChild(tb);
  }

  function rowStyle(isLamp, sent, inPool) {
    var s = "";
    if (!inPool) s += "opacity:0.45;";
    if (sent) s += "font-weight:600;";
    if (isLamp) s += "outline:1px dashed currentColor;";
    return s;
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = evaluate(C);
    S.R = R;
    var ui = S.ui;
    ui.head.textContent = C.all ? "The judge reads every one of the 40,000 poems, one call each." :
      "Retrieve " + C.k + (C.rerank ? ", rerank " + R.pool + " with the cross-encoder" : ", no reranker") +
      ", send the top " + R.sent + " to the judge" + (C.big ? " (bigger embedding model)." : ".");

    var rows = R.first.map(function (r) {
      var sent = !C.rerank && r.pos <= R.sent && !C.all;
      return { style: rowStyle(r.p.t === LAMP, sent, r.pos <= C.k),
        cells: [String(r.pos), r.p.t + ", " + r.p.y, String(r.b), String(r.v), r.s.toFixed(5)] };
    });
    if (C.k > 12) rows.push({ style: "opacity:0.6;", cells: ["13-" + C.k, "filler: not in the sample", "-", "-", "-"] });
    table(ui, ui.left, "First stage: hybrid search (BM25 + vector, fused). Faded: not retrieved.",
      ["#", "poem", "BM25", "vector", "fused"], rows);

    if (C.rerank && !C.all) {
      var rr = R.reranked.map(function (r, i) {
        return { style: rowStyle(r.p.t === LAMP, i + 1 <= R.sent, true),
          cells: [String(i + 1), r.p.t, r.p.ce.toFixed(2), ord(r.pos)] };
      });
      if (R.pool > 12) rr.push({ style: "opacity:0.6;", cells: ["13-" + R.pool, "filler", FILLER_CE.toFixed(2), "13th+"] });
      table(ui, ui.right, "After the cross-encoder: " + R.pool + " pairs, " + fmt(R.pool * MS_PAIR) + " ms. Bold: sent.",
        ["#", "poem", "score", "was"], rr);
    } else {
      table(ui, ui.right, C.all ? "No ranking: 40,000 judge calls." : "Reranker off: the first-stage order is sent as it stands.", [], []);
    }

    var kr = R.detail.map(function (d, i) {
      return { style: d.ok ? "" : "opacity:0.6;",
        cells: ["copy " + (i + 1), d.f === null ? "not in top 100" : ord(d.f), d.ok ? "caught" : "missed"] };
    });
    table(ui, ui.known, "Known copies: " + R.caught + " of 12 caught.", ["entry", "source, first stage", "judge"], kr);

    S.stat.lamp1(ord(R.lampPos));
    S.stat.lamp2(C.all ? "no ranking" : (!C.rerank ? "not reranked" : (R.lampRR ? ord(R.lampRR) : "not retrieved")));
    S.stat.sent(C.all ? fmt(ARCHIVE) : R.sent);
    S.stat.verdict(R.copied ? "COPIED" : "NOT COPIED");
    S.stat.latency(secs(R.ms));
    S.stat.cost(cents(R.tenths));
    S.stat.year(dollars(R.yearTenths));
    S.stat.caught(R.caught + " of 12");
    S.stat.recallk(R.inK + " of 12");
  }

  function summary(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var where;
    if (C.all) where = "The judge read all 40,000 poems, one call each.";
    else if (C.rerank) where = "The Lamp-Room came " + ord(R.lampPos) + " by hybrid search and " +
      (R.lampRR ? ord(R.lampRR) + " after the rerank (" + R.reranked[R.lampRR - 1].p.ce.toFixed(2) + ")." :"was never retrieved, so the reranker never saw it.");
    else where = "The Lamp-Room came " + ord(R.lampPos) + (R.lampPos <= R.sent ? " and was sent, " + ord(R.lampPos) + " of " + R.sent + "." : " and was not sent.");
    return where + " Verdict: " + (R.copied ? "COPIED" : "NOT COPIED") + ". Known copies caught: " + R.caught +
      " of 12. " + secs(R.ms) + " and " + cents(R.tenths) + " an entry.";
  }

  function apply(api, what) {
    draw(api);
    api.log(what + " " + summary(api), api.state.R.copied ? "ok" : "bad");
  }

  function setAll(S, C) {
    S.C = C;
    S.ctl.k.set(C.k);
    S.ctl.m.set(C.m);
    S.ctl.n.set(C.n);
    S.ctl.rerank.set(C.rerank);
    S.ctl.big.set(C.big);
    S.ctl.all.set(C.all);
  }

  function preset(v) {
    var C = { k: 5, m: 5, n: 5, rerank: false, big: false, all: false };
    if (v === "fifty") { C.k = 50; C.m = 50; C.n = 50; }
    else if (v === "rerank") { C.k = 100; C.m = 100; C.rerank = true; }
    else if (v === "bigger") { C.big = true; }
    else if (v === "all") { C.all = true; }
    return C;
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = preset("night");
      S.ui = buildWidget(api);
      S.ctl = {};

      function custom(what) {
        S.ctl.preset.set("custom");
        apply(api, what);
      }

      S.ctl.preset = api.control.select("preset", "Set up", PRESETS, "night", function (v) {
        if (v === "custom") return;
        setAll(S, preset(String(v)));
        var o = PRESETS.filter(function (p) { return p.value === v; })[0];
        apply(api, o.label + ".");
      });
      S.ctl.k = api.control.select("k", "Candidates retrieved (k)", opts(KS), 5, function (v) {
        S.C.k = Number(v);
        custom("Retrieve " + S.C.k + ".");
      });
      S.ctl.m = api.control.select("m", "Candidates reranked", opts(KS), 5, function (v) {
        S.C.m = Number(v);
        custom("Rerank up to " + S.C.m + ".");
      });
      S.ctl.n = api.control.select("n", "Top n sent to the judge", opts(NS), 5, function (v) {
        S.C.n = Number(v);
        custom("Send the top " + S.C.n + ".");
      });
      S.ctl.rerank = api.control.toggle("rerank", "Reranker (cross-encoder)", false, function (on) {
        S.C.rerank = !!on;
        custom("Reranker " + (on ? "on." : "off."));
      });
      S.ctl.big = api.control.toggle("big", "Bigger embedding model", false, function (on) {
        S.C.big = !!on;
        custom("Bigger embedding model " + (on ? "on." : "off."));
      });
      S.ctl.all = api.control.toggle("all", "Judge reads all 40,000 poems, one call each", false, function (on) {
        S.C.all = !!on;
        custom("Judge reads all 40,000: " + (on ? "on." : "off."));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        lamp1: api.stat("lamp1", "The Lamp-Room, hybrid search", "warn"),
        lamp2: api.stat("lamp2", "The Lamp-Room after rerank", ""),
        sent: api.stat("sent", "poems the judge reads", ""),
        verdict: api.stat("verdict", "verdict on Lamp Oil", "bad"),
        latency: api.stat("latency", "time per entry", ""),
        cost: api.stat("cost", "judge cost per entry", ""),
        year: api.stat("year", "judge cost, 2,400 entries", ""),
        caught: api.stat("caught", "known copies caught", "ok"),
        recallk: api.stat("recallk", "known sources in the top k", "")
      };

      api.info("<strong>How to read it.</strong> Left: the first stage, hybrid search, ranking 12 sample poems by BM25 and by one embedding vector each, fused by reciprocal rank fusion. Right: the cross-encoder's second opinion, which reads the entry and each candidate together. Bold rows are what the judge reads. Below: the jury's 12 known copies, and whether the judge would catch each one with these settings.");

      draw(api);
      api.log("The night of the judging, as the checker ran: hybrid search top 5, no reranker. " + summary(api), "bad");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function titles(list, n) { return list.slice(0, n).map(function (r) { return r.p.t; }).join(" | "); }

      // 1. The opening state: the night, before anyone reruns it.
      t.expect(t.stat("lamp1") === "7th" && t.stat("lamp2") === "not reranked" && t.stat("sent") === 5 &&
        t.stat("verdict") === "NOT COPIED" && t.stat("latency") === "1.30 s" && t.stat("cost") === "0.7 cents" &&
        t.stat("caught") === "4 of 12" && t.stat("recallk") === "4 of 12" &&
        has("The Lamp-Room came 7th and was not sent. Verdict: NOT COPIED. Known copies caught: 4 of 12. 1.30 s and 0.7 cents an entry."),
        "Opens on the night: The Lamp-Room 7th, not sent, NOT COPIED, 4 of 12 known copies, 1.30 s, 0.7 cents");

      // 2. The first-stage list: ranks and fused scores as the post states them.
      var R = t.api.state.R;
      var lamp = R.first[6];
      t.expect(titles(R.first, 5) === "Night Ferry | The Harbour at Two | Low Tide, Lamps Lit | Fishermen's Chapel | Salt Wind" &&
        R.first[0].s.toFixed(5) === "0.03252" && lamp.p.t === "The Lamp-Room" && lamp.b === 12 && lamp.v === 6 &&
        lamp.s.toFixed(5) === "0.02904" && R.first[5].p.t === "The Keeper's Wife" && R.first[5].s.toFixed(5) === "0.03008",
        "First stage: five sea poems on top, Night Ferry 0.03252; The Lamp-Room BM25 12th, vector 6th, fused 7th at 0.02904");

      // 3. Reply A: send the top 50 straight.
      t.set("preset", "fifty");
      t.expect(t.stat("verdict") === "NOT COPIED" && t.stat("sent") === 50 && t.stat("caught") === "4 of 12" &&
        t.stat("latency") === "3.55 s" && t.stat("cost") === "5.2 cents" && t.stat("year") === "$124.80" &&
        has("The Lamp-Room came 7th and was sent, 7th of 50."),
        "Top 50 straight: The Lamp-Room sent 7th of 50, lost in the middle: NOT COPIED, 4 of 12, 3.55 s, 5.2 cents");

      // 4. Reply B: retrieve 100, rerank, send 5.
      t.set("preset", "rerank");
      t.expect(t.stat("lamp2") === "1st" && t.stat("verdict") === "COPIED" && t.stat("caught") === "11 of 12" &&
        t.stat("recallk") === "11 of 12" && t.stat("latency") === "1.90 s" && t.stat("cost") === "0.7 cents" &&
        t.stat("year") === "$16.80" && has("The Lamp-Room came 7th by hybrid search and 1st after the rerank (0.91)."),
        "Retrieve 100, rerank, send 5: The Lamp-Room 1st at 0.91, COPIED, 11 of 12, 1.90 s, 0.7 cents, $16.80 a year");

      // 5. The cross-encoder's top 5.
      R = t.api.state.R;
      t.expect(titles(R.reranked, 5) === "The Lamp-Room | The Keeper's Wife | Low Tide, Lamps Lit | What the Tide Keeps | Salt Wind" &&
        R.reranked[1].p.ce === 0.31 && R.pool === 100,
        "Reranked top 5: The Lamp-Room 0.91, then The Keeper's Wife 0.31, Low Tide, What the Tide Keeps, Salt Wind");

      // 6. A reranker can't lift what retrieval never handed it.
      t.set("k", 5);
      t.expect(t.stat("lamp2") === "not retrieved" && t.stat("verdict") === "NOT COPIED" && t.stat("caught") === "4 of 12" &&
        t.stat("latency") === "1.33 s",
        "Reranker on but only 5 retrieved: The Lamp-Room never reaches it, NOT COPIED, 4 of 12");

      // 7. Fewer candidates reranked: cheaper, fewer copies caught.
      t.set("k", 100);
      t.set("m", 50);
      var r50 = t.stat("caught") === "10 of 12" && t.stat("latency") === "1.60 s";
      t.set("m", 12);
      t.expect(r50 && t.stat("caught") === "7 of 12" && t.stat("latency") === "1.37 s" && t.stat("verdict") === "COPIED",
        "Rerank 50: 10 of 12 at 1.60 s; rerank only 12: 7 of 12 at 1.37 s, the night still caught");

      // 8. Reply C: a bigger embedding model.
      t.set("preset", "bigger");
      t.expect(t.stat("lamp1") === "6th" && t.stat("verdict") === "NOT COPIED" && t.stat("caught") === "5 of 12" &&
        t.api.state.R.first[5].s.toFixed(5) === "0.02951",
        "Bigger embedding model: The Lamp-Room rises to 6th (0.02951), still not sent; 5 of 12");

      // 9. Reply D: the judge reads all 40,000.
      t.set("preset", "all");
      t.expect(t.stat("verdict") === "COPIED" && t.stat("caught") === "12 of 12" && t.stat("sent") === "40,000" &&
        t.stat("latency") === "11 h 40 min" && t.stat("cost") === "$120.00" && t.stat("year") === "$288,000.00",
        "All 40,000: COPIED, 12 of 12, but 11 h 40 min and $120.00 an entry, $288,000.00 a year");

      // 10. Sending more straight helps only while the list is short.
      t.set("preset", "night");
      t.set("k", 10);
      t.set("n", 10);
      var ten = t.stat("verdict") === "COPIED" && t.stat("caught") === "7 of 12";
      t.set("k", 20);
      t.set("n", 20);
      t.expect(ten && t.stat("verdict") === "NOT COPIED" && t.stat("caught") === "4 of 12",
        "Top 10 straight catches the night and 7 of 12; top 20 straight loses it in the middle, 4 of 12");

      // 11. Reset returns to the night.
      t.click("reset");
      t.expect(t.stat("lamp1") === "7th" && t.stat("verdict") === "NOT COPIED" && t.stat("caught") === "4 of 12" &&
        t.stat("year") === "$16.80",
        "Reset: back to the night, NOT COPIED, 4 of 12");
    }
  });
})();
