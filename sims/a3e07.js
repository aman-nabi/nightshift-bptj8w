/* sims/a3e07-v1.0.1.js  (published as sims/a3e07.js)
   Case a3e07 "When Retrieval Lies": a retrieval debugging lab for the Fenmarrow Record Office's night
   assistant, which answers family historians from chunked 19th-century estate papers. The sim holds a
   teaching sample of 12 chunks from three estates' papers. Each document names its estate and mill
   only in its header; every body chunk says "the said mill". The learner turns document context,
   hand labels, query rewriting, HyDE and a better embedding model on or off, sets top-k, and reads the
   retrieval log, the answer and its source, and the known set. Widget-style sim inside api.root.
   No real model and no real embedding.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 renames: Rosewarne, Polkinghorne and Brackenholt Mill; the case is
     content/latent/a3/a3e07-v1.0.1.json
   v1.0.0 (2026-10-11) first version: 12 stated chunks (W1-W4, P1-P4, G1-G4), stand-in embedding
     (keyword count), BM25, reciprocal rank fusion, a stand-in answerer, stated rewrites and HyDE
     texts, 8 known questions, presets for the night and the four replies. selfTest: 11 assertions.

   The model (stated in sim.lede and the info box):
   - Searched text of a chunk: its body; with context on, the document's context line + body; with
     hand labels on (and context off), the label + body. Metadata (estate, section) is shown, never searched.
   - Words: lower case, split on anything not a letter or digit; STOP words dropped for BM25.
   - BM25 (k1 1.2, b 0.75, idf ln(1 + (N - n + 0.5) / (n + 0.5)), N 12, lengths in words after the stop
     list) with the query's words, rounded to 2 places.
   - Stand-in embedding: counts of VOCAB (a word counts when it starts with the keyword); cosine,
     rounded to 2 places. It exaggerates: a chunk with no listed word scores 0.00. "Better model":
     also counts EXTRA, and related words (GROUP) share one position.
   - Hybrid: fused = 1/(60 + BM25 rank) + 1/(60 + vector rank), a list skipped when its score is 0;
     rounded to 5 places. Ranks and ties: higher score first, then chunk order; fused ties go to the
     better BM25 rank.
   - Stand-in answerer: from the first sent chunk whose searched text names the mill asked about, else
     the first sent chunk; it writes the asked mill's name in place of "the said mill". Nothing sent
     with a score above 0: "nothing found".
   - Rewriting: a follow-up becomes its stated standalone template, filled with the person the previous
     answer came from (chunk.who). HyDE: the vector side embeds the question's stated hypothetical answer.
   - Known set: 8 questions with right chunks. "Right chunk in the top k" and "answered right" are counted
     separately. Q1 and Q2 are the night's two questions.
   - Real archive (story): 31,400 chunks, 12.5 million document tokens, 300 tokens a chunk. Context:
     one model call per chunk, at Anthropic's published $1.02 per million document tokens = $12.75.
     Hand labels: 30 s a chunk = 261.7 h, about 262 h, 131 nights of 2 h. The other chunks are assumed
     to rank below these 12 for the known questions (a teaching assumption).

   Where every number comes from (conventions rule 14; the case is content/latent/a3/a3e07-v1.0.1.json):
   - The night (top 5, all off): Q1 top 5: P2 0.03279 (BM25 3.00 #1, cosine 0.50 #1), G2 0.03226 (1.33,
     0.45), W3 0.03175 (1.28, 0.41), G3 0.03077, P3 0.03055. Answered from P2: "1871. In January Mr Ozias
     Polkinghorne died, and by his will Cauldmere Mill passed to his widow, Mrs Petronella Polkinghorne, who
     owned it for life." Source shown: Polkinghorne estate papers. Q2 "and after her?": no words left after
     the stop list, every score 0.00, nothing found. Known set 6 of 8 in the top k, 4 of 8 right.
     BM25 by hand: P2 has 15 words, avgdl 127 / 12; owned (n 1) 1.8446, 1871 (n 3) 1.1208, mill (n 12)
     0.0335: 3.00. Cosine: 3 / (2 x 3) = 0.50.
   - Top-k 20 (all 12 sent): the same answers, 6 of 8 and 4 of 8; 6,000 passage tokens a question.
   - Better model: P2 0.03227 still first, W3 0.03200 second; G3 ("stood empty, and the woods were
     sold") vector #1 at 0.71. 6 of 8, 4 of 8.
   - Hand labels: W3 0.03252 first; Q2 still nothing; 6 of 8, 5 of 8; about 262 h.
   - Context on: W3 0.03252 (BM25 2.36, cosine 0.58), P2 0.03227 second; Q2 nothing; 6 of 8, 5 of 8.
   - Rewriting alone: Q2 searched as "who owned Cauldmere Mill after Petronella Polkinghorne?", answered
     from P2 again (0.03279). 7 of 8, 5 of 8.
   - HyDE alone: Q1 P2 0.03202 first, W1 0.03154 second; Q2 answered from P4; 8 of 8, 5 of 8.
   - Context + rewriting (the senior fix): Q1 W3 0.03252; Q2 searched as "who owned Cauldmere Mill
     after Jethro Rosewarne?", W4 0.03279, Lemuel Rosewarne. 8 of 8, 7 of 8. The miss: "who bought
     Brackenholt Mill in 1880?" answered from P3 (the 1866 wheel); P4 says sold, not bought, and is 2nd.
   - With HyDE added: 8 of 8, 8 of 8. Model calls a question: 1, plus 1 for rewriting, plus 1 for HyDE.
   - Story-only numbers, not computed: 1,860 documents, about 40 questions a night, 02:14 and 02:16, the
     family history fair in November.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var ARCHIVE_CHUNKS = 31400, ARCHIVE_TOKENS = 12500000, PRICE_PER_M = 1.02;
  var LABEL_SEC = 30, NIGHT_H = 2, CHUNK_TOKENS = 300;
  var KS = [3, 5, 10, 20];

  var DOCS = {
    W: { estate: "Wyvenhall estate papers", section: "Cauldmere Mill: deeds and leases", mill: "Cauldmere",
      context: "From the Wyvenhall estate papers: deeds and leases of Cauldmere Mill, 1846 to 1902.",
      label: "Wyvenhall estate, Cauldmere Mill." },
    P: { estate: "Polkinghorne estate papers", section: "Brackenholt Mill: wills and accounts", mill: "Brackenholt",
      context: "From the Polkinghorne estate papers: wills and accounts of Brackenholt Mill, 1852 to 1881.",
      label: "Polkinghorne estate, Brackenholt Mill." },
    G: { estate: "Gorsedene estate papers", section: "Sallowford mill: rentals", mill: "Sallowford",
      context: "From the Gorsedene estate papers: rentals of Sallowford fulling mill, 1860 to 1885.",
      label: "Gorsedene estate, Sallowford mill." }
  };
  var CHUNKS = [
    { id: "W1", d: "W", who: "Sir Ebenezer Wyvenhall", t: "1846. Sir Ebenezer Wyvenhall bought the said mill, with its weir and cottage, for 900 pounds." },
    { id: "W2", d: "W", who: "Mr J. Rosewarne", t: "1858. The said mill was let for twenty-one years, at 60 pounds a year, to a young miller, Mr J. Rosewarne." },
    { id: "W3", d: "W", who: "Jethro Rosewarne", t: "1871. In March Sir Ebenezer sold the said mill to his tenant, Jethro Rosewarne, for 1,100 pounds." },
    { id: "W4", d: "W", who: "Lemuel Rosewarne", t: "1889. On the death of Jethro Rosewarne the said mill passed to his son, Lemuel Rosewarne, who kept it until the fire of 1902." },
    { id: "P1", d: "P", who: "Ozias Polkinghorne", t: "1852. Mr Ozias Polkinghorne built the said mill on the home farm's stream." },
    { id: "P2", d: "P", who: "Petronella Polkinghorne", t: "1871. In January Mr Ozias Polkinghorne died, and by his will the said mill passed to his widow, Mrs Petronella Polkinghorne, who owned it for life." },
    { id: "P3", d: "P", who: "", t: "1866. Accounts: a new wheel for the said mill, 140 pounds." },
    { id: "P4", d: "P", who: "Abner Hobday", t: "1880. On the death of Mrs Polkinghorne the said mill was sold to Mr Abner Hobday for 1,200 pounds." },
    { id: "G1", d: "G", who: "Joel Lowick", t: "1860. The said mill was let to Joel Lowick, fuller, at 45 pounds a year." },
    { id: "G2", d: "G", who: "Joel Lowick", t: "1871. Rent of the said mill, 45 pounds, received from Joel Lowick at Lady Day and at Michaelmas." },
    { id: "G3", d: "G", who: "", t: "1885. The said mill stood empty, and the woods were sold." },
    { id: "G4", d: "G", who: "his nephew", t: "1874. Joel Lowick gave up the lease of the said mill to his nephew." }
  ];
  var STOP = ("a an and the of to in on at for by with from who what when which did was were it its his her him he " +
    "she they them that this said is be as had next").split(" ");
  var VOCAB = ["mill", "own", "widow", "1871", "sold", "bought", "let", "lease", "rent", "tenant", "death", "died", "son",
    "built", "cauldmere", "brackenholt", "sallowford", "wyvenhall", "polkinghorne", "gorsedene", "rosewarne", "lowick",
    "hobday", "fire", "wheel", "paid", "cost", "pounds"];
  // The "better embedding model" stand-in also counts these, and counts related words on one shared position.
  var EXTRA = ["passed", "kept", "inherit", "held"];
  var GROUP = { own: "OWN", bought: "OWN", sold: "OWN", passed: "OWN", kept: "OWN", inherit: "OWN", held: "OWN",
    let: "TEN", lease: "TEN", rent: "TEN", tenant: "TEN", paid: "TEN", death: "DIE", died: "DIE", fire: "DIE" };
  var K1 = 1.2, B = 0.75, RRF_K = 60;

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function words(s) { return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w !== ""; }); }
  function terms(s) { return words(s).filter(function (w) { return STOP.indexOf(w) < 0; }); }
  function embed(s, better) {
    var w = words(s);
    var keys = better ? VOCAB.concat(EXTRA) : VOCAB;
    var v = {};
    keys.forEach(function (k) {
      var n = 0;
      for (var i = 0; i < w.length; i++) if (w[i].indexOf(k) === 0) n += 1;
      var pos = better && GROUP[k] ? GROUP[k] : k;
      v[pos] = (v[pos] || 0) + n;
    });
    return v;
  }
  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0, k;
    for (k in a) { na += a[k] * a[k]; dot += a[k] * (b[k] || 0); }
    for (k in b) nb += b[k] * b[k];
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r5(x) { return Math.round(x * 100000) / 100000; }
  function chunkText(c, C) {
    if (C.ctx) return DOCS[c.d].context + " " + c.t;
    if (C.labels) return DOCS[c.d].label + " " + c.t;
    return c.t;
  }
  function idf(N, n) { return Math.log(1 + (N - n + 0.5) / (n + 0.5)); }

  // Hybrid search over the 12 chunks: BM25 with the query's words, cosine with the query (or the HyDE text), RRF.
  function search(q, C, hyde) {
    var T = CHUNKS.map(function (c) { return terms(chunkText(c, C)); });
    var N = T.length;
    var avg = T.reduce(function (s, t) { return s + t.length; }, 0) / N;
    var qt = terms(q);
    var qv = embed(C.hyde && hyde ? hyde : q, C.better);
    var rows = CHUNKS.map(function (c, i) {
      var b = 0;
      qt.forEach(function (w) {
        var f = T[i].filter(function (x) { return x === w; }).length;
        if (!f) return;
        var n = T.filter(function (t) { return t.indexOf(w) >= 0; }).length;
        b += idf(N, n) * f * (K1 + 1) / (f + K1 * (1 - B + B * T[i].length / avg));
      });
      return { c: c, i: i, b: r2(b), v: r2(cosine(qv, embed(chunkText(c, C), C.better))) };
    });
    var byB = rows.slice().sort(function (x, y) { return (y.b - x.b) || (x.i - y.i); });
    var byV = rows.slice().sort(function (x, y) { return (y.v - x.v) || (x.i - y.i); });
    rows.forEach(function (r) {
      r.br = byB.indexOf(r) + 1;
      r.vr = byV.indexOf(r) + 1;
      r.f = r5((r.b > 0 ? 1 / (RRF_K + r.br) : 0) + (r.v > 0 ? 1 / (RRF_K + r.vr) : 0));
    });
    rows.sort(function (x, y) { return (y.f - x.f) || (x.br - y.br) || (x.i - y.i); });
    return rows;
  }
  function millAsked(q) {
    var w = words(q);
    for (var d in DOCS) if (w.indexOf(DOCS[d].mill.toLowerCase()) >= 0) return d;
    return null;
  }
  function names(text, d) { return words(text).indexOf(DOCS[d].mill.toLowerCase()) >= 0; }
  // The stand-in model: answers from the first sent chunk whose text names the mill asked about, else the first sent.
  function answerFrom(q, rows, C) {
    var sent = rows.slice(0, C.k).filter(function (r) { return r.f > 0; });
    if (!sent.length) return null;
    var m = millAsked(q);
    if (m) {
      for (var i = 0; i < sent.length; i++) if (names(chunkText(sent[i].c, C), m)) return sent[i];
    }
    return sent[0];
  }
  function answerText(q, r) {
    var m = millAsked(q);
    var name = m ? (m === "G" ? "Sallowford mill" : DOCS[m].mill + " Mill") : "the said mill";
    return r.c.t.replace("the said mill", name);
  }
  var KNOWN = [
    { q: "who owned Cauldmere Mill in 1871?", right: "W3",
      hyde: "In 1871 Cauldmere Mill was owned by the miller who had bought it from the estate, or by an heir who inherited it." },
    { q: "and after her?", prev: 0, right: "W4", tpl: "who owned Cauldmere Mill after {p}?",
      hyde: "After her death the property passed to her heir." },
    { q: "when was Brackenholt Mill built?", right: "P1",
      hyde: "Brackenholt Mill was built in the early nineteenth century by the family who owned the land." },
    { q: "what did the new wheel at Brackenholt Mill cost?", right: "P3",
      hyde: "The new wheel at Brackenholt Mill cost the estate a sum in pounds, entered in the accounts." },
    { q: "what rent did Sallowford mill pay in 1871?", right: "G2",
      hyde: "In 1871 the tenant of Sallowford mill paid a yearly rent in pounds to the estate." },
    { q: "and who had it next?", prev: 4, right: "G4", tpl: "who took the lease of Sallowford mill after {p}?",
      hyde: "After him the lease passed to a new tenant or a relative." },
    { q: "when did fire destroy Cauldmere Mill?", right: "W4",
      hyde: "Cauldmere Mill was destroyed by fire, as the estate papers record." },
    { q: "who bought Brackenholt Mill in 1880?", right: "P4",
      hyde: "In 1880 Brackenholt Mill was sold and bought by a new owner for a sum in pounds." }
  ];
  function runKnown(C) {
    var out = [];
    KNOWN.forEach(function (k) {
      var q = k.q;
      if (k.tpl && C.rewrite) {
        var pa = out[k.prev].ans;
        q = k.tpl.replace("{p}", pa && pa.c.who ? pa.c.who : "that");
      }
      var rows = search(q, C, k.hyde);
      var ans = answerFrom(q, rows, C);
      var pos = 0;
      for (var i = 0; i < rows.length; i++) if (rows[i].c.id === k.right) pos = i + 1;
      out.push({ k: k, q: q, rows: rows, ans: ans, pos: pos,
        hit: pos <= C.k && rows[pos - 1].f > 0, ok: !!ans && ans.c.id === k.right });
    });
    return out;
  }

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function count(R, key) { return R.filter(function (x) { return x[key]; }).length; }
  function setupWork(C) {
    if (C.ctx) return fmt(ARCHIVE_CHUNKS) + " model calls, about $" + (ARCHIVE_TOKENS / 1000000 * PRICE_PER_M).toFixed(2) + " once";
    if (C.labels) {
      var h = ARCHIVE_CHUNKS * LABEL_SEC / 3600;
      return "about " + Math.round(h) + " hours by hand, " + Math.round(h / NIGHT_H) + " nights";
    }
    return "none";
  }
  function calls(C) { return 1 + (C.rewrite ? 1 : 0) + (C.hyde ? 1 : 0); }

  function summary(R) {
    var a = R[0].rows[0];
    var s = "Q1 top: " + a.c.id + " " + a.f.toFixed(5) + " (BM25 " + a.b.toFixed(2) + ", cosine " + a.v.toFixed(2) + "); ";
    s += R[0].ans ? "answered from " + R[0].ans.c.id + ", " + DOCS[R[0].ans.c.d].estate + ". " : "nothing found. ";
    s += "Follow-up searched as \"" + R[1].q + "\": ";
    s += R[1].ans ? "answered from " + R[1].ans.c.id + ", " + DOCS[R[1].ans.c.d].estate + ". " : "every score 0.00, nothing found. ";
    return s + "Known set: right chunk in the top k " + count(R, "hit") + " of 8, answered right " + count(R, "ok") + " of 8.";
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
    var head = el("p", "margin:0;font-weight:600;", "");
    var q1 = el("div", "min-width:0;overflow-x:auto;");
    var q2 = el("div", "min-width:0;overflow-x:auto;");
    var known = el("div", "min-width:0;overflow-x:auto;");
    [head, q1, q2, known].forEach(function (n) { box.appendChild(n); });
    api.root.appendChild(box);
    return { el: el, head: head, q1: q1, q2: q2, known: known };
  }

  function table(ui, parent, caption, headers, rows, foot) {
    var el = ui.el;
    clear(parent);
    parent.appendChild(el("p", "margin:0 0 4px;font-weight:600;", caption));
    var tb = el("table", "width:100%;border-collapse:collapse;");
    var tr = el("tr");
    headers.forEach(function (h) { tr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
    tb.appendChild(tr);
    rows.forEach(function (r) {
      var row = el("tr", r.style || "");
      r.cells.forEach(function (c) { row.appendChild(el("td", "padding:2px 4px;vertical-align:top;", c)); });
      tb.appendChild(row);
    });
    parent.appendChild(tb);
    (foot || []).forEach(function (line) { parent.appendChild(el("p", "margin:4px 0 0;", line)); });
  }

  function logTable(ui, parent, time, res, C) {
    var rows = res.rows.slice(0, Math.min(C.k, 12)).map(function (r, i) {
      var used = res.ans && res.ans.c.id === r.c.id;
      return { style: (used ? "font-weight:600;" : "") + (r.f > 0 ? "" : "opacity:0.5;"),
        cells: [String(i + 1), r.c.id, chunkText(r.c, C), DOCS[r.c.d].estate + " > " + DOCS[r.c.d].section,
          r.b.toFixed(2) + " (#" + r.br + ")", r.v.toFixed(2) + " (#" + r.vr + ")", r.f.toFixed(5)] };
    });
    var foot = res.ans ?
      ["Answer: " + answerText(res.q, res.ans), "Source shown: " + DOCS[res.ans.c.d].estate + " > " + DOCS[res.ans.c.d].section + " (" + res.ans.c.id + ")"] :
      ["Answer: I can find nothing about that in the estate papers."];
    if (C.hyde) foot.push("HyDE text embedded: " + res.k.hyde);
    table(ui, parent, time + " searched as \"" + res.q + "\" (top " + C.k + (C.k > 12 ? ", all 12 sent" : "") + "; bold: answered from)",
      ["#", "chunk", "text searched", "metadata shown", "BM25", "cosine", "fused"], rows, foot);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = runKnown(C);
    S.R = R;
    var ui = S.ui;
    var on = [];
    if (C.ctx) on.push("document context");
    if (C.labels && !C.ctx) on.push("hand labels");
    if (C.rewrite) on.push("query rewriting");
    if (C.hyde) on.push("HyDE");
    if (C.better) on.push("better embedding model");
    ui.head.textContent = "Top " + C.k + ". On: " + (on.length ? on.join(", ") : "nothing") + ".";
    logTable(ui, ui.q1, "02:14", R[0], C);
    logTable(ui, ui.q2, C.rewrite ? "02:16 \"and after her?\"" : "02:16", R[1], C);
    var kr = R.map(function (x, i) {
      return { style: x.ok ? "" : "opacity:0.6;",
        cells: ["Q" + (i + 1), x.q, x.k.right, x.pos && x.rows[x.pos - 1].f > 0 ? "#" + x.pos : "no score",
          x.ans ? x.ans.c.id : "nothing", x.ok ? "right" : "wrong"] };
    });
    table(ui, ui.known, "Known set: right chunk in the top k " + count(R, "hit") + " of 8, answered right " + count(R, "ok") + " of 8.",
      ["", "searched as", "right", "at", "answered from", ""], kr);

    var top = R[0].rows[0];
    S.stat.top(top.c.id + " " + top.f.toFixed(5));
    S.stat.source(R[0].ans ? DOCS[R[0].ans.c.d].estate : "nothing found");
    S.stat.follow(R[1].ans ? R[1].ans.c.id + ", " + DOCS[R[1].ans.c.d].estate : "nothing found");
    S.stat.retrieved(count(R, "hit") + " of 8");
    S.stat.right(count(R, "ok") + " of 8");
    S.stat.calls(calls(C));
    S.stat.tokens(fmt(C.k * CHUNK_TOKENS));
    S.stat.work(setupWork(C));
  }

  function apply(api, what) {
    draw(api);
    api.log(what + " " + summary(api.state.R), count(api.state.R, "ok") >= 7 ? "ok" : "bad");
  }

  var PRESETS = [
    { value: "night", label: "The night, as the archive ran" },
    { value: "k20", label: "Top-k 20" },
    { value: "better", label: "Better embedding model" },
    { value: "labels", label: "Hand labels on every chunk" },
    { value: "senior", label: "Context, rewriting, known set" },
    { value: "hyde", label: "Context, rewriting and HyDE" },
    { value: "custom", label: "Custom" }
  ];
  function preset(v) {
    var C = { k: 5, ctx: false, labels: false, rewrite: false, hyde: false, better: false };
    if (v === "k20") C.k = 20;
    else if (v === "better") C.better = true;
    else if (v === "labels") C.labels = true;
    else if (v === "senior") { C.ctx = true; C.rewrite = true; }
    else if (v === "hyde") { C.ctx = true; C.rewrite = true; C.hyde = true; }
    return C;
  }
  function setAll(S, C) {
    S.C = C;
    S.ctl.k.set(C.k);
    ["ctx", "labels", "rewrite", "hyde", "better"].forEach(function (n) { S.ctl[n].set(C[n]); });
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e07", {
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
      function flag(id, label, name) {
        S.ctl[id] = api.control.toggle(id, label, false, function (v) {
          S.C[id] = !!v;
          custom(name + (v ? " on." : " off."));
        });
      }

      S.ctl.preset = api.control.select("preset", "Set up", PRESETS, "night", function (v) {
        if (v === "custom") return;
        setAll(S, preset(String(v)));
        var o = PRESETS.filter(function (p) { return p.value === v; })[0];
        apply(api, o.label + ".");
      });
      S.ctl.k = api.control.select("k", "Top-k (chunks sent)", KS.map(function (k) { return { value: k, label: String(k) }; }), 5, function (v) {
        S.C.k = Number(v);
        custom("Top-k " + S.C.k + (S.C.k > 12 ? " (all 12 sent)." : "."));
      });
      flag("ctx", "Document context in each chunk's text", "Document context");
      flag("labels", "Hand labels (estate and mill) in each chunk's text", "Hand labels");
      flag("rewrite", "Rewrite follow-ups as standalone questions", "Query rewriting");
      flag("hyde", "HyDE: embed a hypothetical answer", "HyDE");
      flag("better", "Better embedding model", "Better embedding model");
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        top: api.stat("top", "Q1: top chunk, fused score", "warn"),
        source: api.stat("source", "Q1: source shown", "bad"),
        follow: api.stat("follow", "follow-up answered from", ""),
        retrieved: api.stat("retrieved", "known set: right chunk in the top k", ""),
        right: api.stat("right", "known set: answered right", "ok"),
        calls: api.stat("calls", "model calls per question", ""),
        tokens: api.stat("tokens", "passage tokens per question (archive)", ""),
        work: api.stat("work", "one-time work (31,400 chunks)", "")
      };

      api.info("<strong>How to read it.</strong> Each table is a retrieval log: the question as searched, the chunks sent with the text that was searched, the metadata shown under answers, BM25, cosine (stand-in embedding) and fused scores. Metadata is shown, never searched. Below: the eight known questions, with where the right chunk came and which chunk the answer came from.");

      draw(api);
      api.log("The night, as the archive ran it: top 5, no context, no rewriting, no HyDE. " + summary(S.R), "bad");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function ids(rows, n) { return rows.slice(0, n).map(function (r) { return r.c.id + " " + r.f.toFixed(5); }).join(", "); }

      // 1. The opening state: the night, before anything changes.
      t.expect(t.stat("top") === "P2 0.03279" && t.stat("source") === "Polkinghorne estate papers" &&
        t.stat("follow") === "nothing found" && t.stat("retrieved") === "6 of 8" && t.stat("right") === "4 of 8" &&
        t.stat("calls") === 1 && t.stat("tokens") === "1,500" && t.stat("work") === "none" &&
        has("Q1 top: P2 0.03279 (BM25 3.00, cosine 0.50); answered from P2, Polkinghorne estate papers. Follow-up searched as \"and after her?\": every score 0.00, nothing found. Known set: right chunk in the top k 6 of 8, answered right 4 of 8."),
        "Opens on the night: P2 0.03279 from the Polkinghorne papers, the follow-up finds nothing, 6 of 8 and 4 of 8");

      // 2. The night's log: the widow first, the real sale third, and the forged answer.
      var R = t.api.state.R;
      t.expect(ids(R[0].rows, 5) === "P2 0.03279, G2 0.03226, W3 0.03175, G3 0.03077, P3 0.03055" &&
        R[0].rows[2].b === 1.28 && R[0].rows[2].v === 0.41 &&
        answerText(R[0].q, R[0].ans) === "1871. In January Mr Ozias Polkinghorne died, and by his will Cauldmere Mill passed to his widow, Mrs Petronella Polkinghorne, who owned it for life." &&
        R[1].rows.every(function (r) { return r.f === 0; }),
        "Night log: P2, G2, W3 (BM25 1.28, cosine 0.41), G3, P3; the answer names Cauldmere Mill; every follow-up score 0");

      // 3. BM25 and cosine for P2, by hand.
      var avg = 127 / 12;
      function part(n, dl) { return Math.log(1 + (12 - n + 0.5) / (n + 0.5)) * 2.2 / (1 + 1.2 * (0.25 + 0.75 * dl / avg)); }
      var hand = part(1, 15) + part(3, 15) + part(12, 15);
      t.expect(Math.round(hand * 100) / 100 === 3.00 && R[0].rows[0].b === 3.00 && R[0].rows[0].v === 0.5,
        "BM25 by hand for P2: owned 1.8446 + 1871 1.1208 + mill 0.0335 = 3.00; cosine 3 / (2 x 3) = 0.50");

      // 4. Reply A: top-k 20.
      t.set("preset", "k20");
      t.expect(t.stat("top") === "P2 0.03279" && t.stat("source") === "Polkinghorne estate papers" &&
        t.stat("retrieved") === "6 of 8" && t.stat("right") === "4 of 8" && t.stat("tokens") === "6,000",
        "Top-k 20 (all 12 sent): still the widow, 6 of 8 and 4 of 8, 6,000 passage tokens a question");

      // 5. Reply B: a better embedding model.
      t.set("preset", "better");
      R = t.api.state.R;
      var g3 = R[0].rows.filter(function (r) { return r.c.id === "G3"; })[0];
      t.expect(ids(R[0].rows, 2) === "P2 0.03227, W3 0.03200" && g3.vr === 1 && g3.v === 0.71 &&
        t.stat("right") === "4 of 8" && t.stat("follow") === "nothing found",
        "Better model: P2 0.03227 still first, W3 0.03200; G3 climbs to vector #1 at 0.71; 4 of 8");

      // 6. Reply C: hand labels.
      t.set("preset", "labels");
      t.expect(t.stat("top") === "W3 0.03252" && t.stat("source") === "Wyvenhall estate papers" &&
        t.stat("follow") === "nothing found" && t.stat("right") === "5 of 8" &&
        t.stat("work") === "about 262 hours by hand, 131 nights",
        "Hand labels: W3 first, the follow-up still finds nothing, 5 of 8, about 262 hours");

      // 7. Rewriting alone carries the wrong first answer forward.
      t.set("preset", "night");
      t.set("rewrite", true);
      t.expect(has("Follow-up searched as \"who owned Cauldmere Mill after Petronella Polkinghorne?\": answered from P2, Polkinghorne estate papers.") &&
        t.stat("retrieved") === "7 of 8" && t.stat("right") === "5 of 8" && t.stat("calls") === 2,
        "Rewriting alone: the follow-up becomes 'after Petronella Polkinghorne' and returns the widow again; 5 of 8");

      // 8. HyDE alone.
      t.set("rewrite", false);
      t.set("hyde", true);
      R = t.api.state.R;
      t.expect(ids(R[0].rows, 2) === "P2 0.03202, W1 0.03154" && t.stat("follow") === "P4, Polkinghorne estate papers" &&
        t.stat("retrieved") === "8 of 8" && t.stat("right") === "5 of 8",
        "HyDE alone: P2 0.03202 still first, W1 second; the follow-up lands on P4; 8 of 8 and 5 of 8");

      // 9. Reply D: context and rewriting.
      t.set("preset", "senior");
      R = t.api.state.R;
      t.expect(has("Q1 top: W3 0.03252 (BM25 2.36, cosine 0.58); answered from W3, Wyvenhall estate papers. Follow-up searched as \"who owned Cauldmere Mill after Jethro Rosewarne?\": answered from W4, Wyvenhall estate papers. Known set: right chunk in the top k 8 of 8, answered right 7 of 8.") &&
        R[1].rows[0].f.toFixed(5) === "0.03279" && R[7].ans.c.id === "P3" && R[7].pos === 2 &&
        t.stat("work") === "31,400 model calls, about $12.75 once" && t.stat("calls") === 2,
        "Context + rewriting: W3 first, the follow-up finds W4, 8 of 8 and 7 of 8; the Brackenholt 1880 miss answers from P3");

      // 10. With HyDE added, the last miss closes.
      t.set("preset", "hyde");
      t.expect(t.stat("right") === "8 of 8" && t.api.state.R[7].ans.c.id === "P4" && t.stat("calls") === 3,
        "Context, rewriting and HyDE: 8 of 8, at 3 model calls a question");

      // 11. Reset returns to the night.
      t.click("reset");
      t.expect(t.stat("top") === "P2 0.03279" && t.stat("right") === "4 of 8" && t.stat("calls") === 1,
        "Reset: back to the night");
    }
  });
})();
