/* sims/a3e02-v1.0.1.js  (published as sims/a3e02.js)
   Case a3e02 "Cutting the Pages": a chunking lab, from Henrike Marrable's studio at Hobcarr Mill, where a
   book conservator's apprentices ask an assistant that answers from the studio handbook (an 1860s binder's
   manual with the studio's own notes typed in after the chapters they belong to).

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 rename: the apprentice is now Imani (name and handle); the case is
     content/latent/a3/a3e02-v1.0.1.json
   v1.0.0 (2026-10-11) first version: widget sim in api.root, no diagram, theme classes only. No real model
     or embedding. Pages 40 to 47 of the handbook (3 chapters, 9 sections, 11 paragraphs) cut by one of five
     splitters; 6 test questions with known right rules. selfTest: 11 assertions.

   The model (stated in sim.lede and the info box):
   - The document is BLOCKS joined by "\n\n": 2,743 characters. Tokens: 4 characters each, rounded up.
   - Stand-in embedding: counts of VOCAB (a word counts when it starts with the keyword); score = cosine of
     question and chunk counts, rounded to two places; ties by chunk number. No shared keyword: 0.00.
   - Heading and page kept: the section path and page(s) go in front of the chunk's text for the embedding
     and its tokens, and under the answer. A chunk's section is that of its first paragraph.
   - Splitters: fixed (every size x 4 characters, stepping size - overlap); recursive (heading, paragraph,
     sentence, space, character; merged up to the size, across headings); by heading (a section each,
     split recursively inside it if too big); by chapter; one sentence each (headings too). Overlap: fixed
     repeats characters; recursive and by heading reach back by whole sentences, never across a heading.
   - The top 3 are sent; the stand-in answers from the first that holds a whole rule (in a chunk with
     several, the one sharing most keywords with the question). Tokens: 300 + 20 + the chunks sent.

   Where every number comes from (conventions rule 14; the case is content/latent/a3/a3e02-v1.0.1.json).
   All of them follow from BLOCKS, RULES, VOCAB and TESTS through the functions below:
   - Story, Tuesday 21:52 (fixed, 125 tokens = 500 characters, no overlap, no heading): 6 chunks. Chunk 2 ends
     with the heading "Emerald green cloths" (characters 978 to 998); chunk 3 starts at character 1,000 with
     "Bindings of this colour" and holds the warning, with no heading and no "green". Imani's question
     (emerald, green, cloth) scores chunk 4 ("Other green cloths") 0.84, chunk 2 0.79, chunk 5 0.56, chunk 3
     0.00 (it holds only "arsenic"). The answer: "Handle it freely, and wash your hands after, as for any old
     book." from Other green cloths. Test set: right rule in the top 3 for 4 of 6, answered right 3 of 6.
     695 tokens a question (320 + 3 x 125).
   - Keep heading and page on, same cuts: chunk 3 scores 0.87, first; answered from Emerald green cloths;
     5 of 6 and 5 of 6 (the thread rule is still cut in two).
   - Overlap 25 tokens (100 characters), no heading: 7 chunks; the heading now rides into the chunk with the
     warning, and Imani's question is answered right; 6 of 6 retrieved, 5 of 6 right.
   - By chapter: 3 chunks, all 3 sent every time: 6 of 6 retrieved, 4 of 6 right (paste and thread answered
     from the wrong chapter); 1,005 tokens a question (Imani's).
   - One sentence each: 38 chunks. The heading line "Emerald green cloths" scores 1.00 and holds no rule; the
     warning sentence scores 0.00; nothing found for Imani. 5 of 6 retrieved, 5 of 6 right.
   - The default the comment thread argues for (fixed, 512 tokens, 50 overlap): 2 chunks, 6 of 6 retrieved,
     4 of 6 right; Imani's question answered from Calico and buckram; 1,056 tokens.
   - The senior settings (by heading, 125 tokens, overlap 25, heading and page kept): 11 chunks, 6 of 6 and
     6 of 6; Imani's question answered from Emerald green cloths, p. 42; 563 tokens; 14 tokens sent twice.
   - Story-only numbers, not computed: the ledger of 1858 (inside the 1840s to 1860s that the Poison Book
     Project gives for emerald green bookcloth); 21:52 on Tuesday; the 400 books still waiting.

   Notes: everything sits in one function; no random numbers; colours only from theme classes (mark-ok,
   mark-no, muted, small, table-wrap). Stats get bare numbers where the value is a number.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 21 * 3600 + 52 * 60;   // Tuesday 21:52, when Imani asked
  var CPT = 4;                             // teaching value: characters per token
  var SYSTEM_TOKENS = 300, QUESTION_TOKENS = 20, K = 3;
  var SIZES = [50, 75, 100, 125, 250, 512];
  var OVERLAPS = [0, 25, 50];

  var BLOCKS = [
    { k: "h1", t: "Covering materials", page: 40 },
    { k: "h2", t: "Calico and buckram", page: 40 },
    { k: "p", page: 40, t: "Calico is plain cotton cloth, cheap and soft, and it serves well for the inner joints and the hinges of a binding. Buckram is cotton or linen stiffened with size, and it wears far longer on a spine that is opened every day. For an account book in daily use, choose buckram." },
    { k: "h2", t: "Grained cloths", page: 41 },
    { k: "p", page: 41, t: "From the 1840s on, publishers covered their books in cloth embossed with a grain, most often a morocco grain made to look like goatskin. Others were ribbed, pebbled, or rippled like watered silk. The grain hides scuffs and wear and keeps its colour in the hollows." },
    { k: "p", page: 41, t: "When you patch a cover, match the grain as well as the colour, or the patch will show in any raking light. Keep offcuts of old cloth in the plan chest, sorted by grain; a patch of old cloth always sits better than new cloth. Lay the patch with its threads running the same way as the cover's, and rub it down through a sheet of thin paper with a bone folder." },
    { k: "h1", t: "Pigments and safety", page: 42 },
    { k: "h2", t: "Emerald green cloths", page: 42 },
    { k: "p", page: 42, t: "Bindings of this colour made from the 1840s to the 1860s may be coloured with copper acetoarsenite, a pigment that contains arsenic and rubs off as a fine, invisible dust. Handle it only with nitrile gloves, never bare-handed." },
    { k: "p", page: 42, t: "Work on a hard table, never on a lap or a chair, and wipe the table down afterwards with a damp, disposable wipe, then throw it out. Wash your hands after, even if you wore gloves. Seal the book in a polyethylene bag until it goes back to its owner, and label it clearly." },
    { k: "h2", t: "Other green cloths", page: 43 },
    { k: "p", page: 43, t: "Green cloth on bindings from after about 1900 was usually coloured with later dyes, and its green is often darker and duller than emerald. Handle it freely, and wash your hands after, as for any old book." },
    { k: "h1", t: "Repairs", page: 44 },
    { k: "h2", t: "Mending torn leaves", page: 44 },
    { k: "p", page: 44, t: "Mend a torn leaf from the back with thin Japanese tissue, its edges feathered so the repair does not show. Let each mend dry under a weight before you turn the page." },
    { k: "h2", t: "Lifting cloth from the boards", page: 45 },
    { k: "p", page: 45, t: "To patch a torn cover, lift the cloth from the board with a thin knife and a little moisture, working in from the tear. Never lift an emerald green cloth outside a fume hood: lifting it raises the arsenic dust into the air." },
    { k: "h2", t: "Paste and glue", page: 46 },
    { k: "p", page: 46, t: "Wheat starch paste comes away again with water, so it is our first choice for cloth and paper. Animal glue sets fast and hard; keep it for the spine linings of heavy books." },
    { k: "h2", t: "Resewing a ledger", page: 46 },
    { k: "p", page: 46, t: "An account book is sewn on tapes so that it opens flat on the desk. Resew it with unbleached linen thread as thick as the old, through the old holes, and keep the tapes." },
    { k: "h2", t: "Storage", page: 47 },
    { k: "p", page: 47, t: "Keep a mended book in a box made to its size, away from damp and light. A book that may carry arsenic goes in a sealed bag inside its box, labelled for whoever opens it next." }
  ];

  // The rule each section gives, as it stands in the text, and the section it sits in.
  var RULES = [
    { id: "R1", sec: "Calico and buckram", t: "For an account book in daily use, choose buckram." },
    { id: "R2", sec: "Grained cloths", t: "When you patch a cover, match the grain as well as the colour, or the patch will show in any raking light." },
    { id: "R3", sec: "Emerald green cloths", t: "Handle it only with nitrile gloves, never bare-handed." },
    { id: "R4", sec: "Other green cloths", t: "Handle it freely, and wash your hands after, as for any old book." },
    { id: "R9", sec: "Mending torn leaves", t: "Mend a torn leaf from the back with thin Japanese tissue, its edges feathered so the repair does not show." },
    { id: "R5", sec: "Lifting cloth from the boards", t: "Never lift an emerald green cloth outside a fume hood: lifting it raises the arsenic dust into the air." },
    { id: "R6", sec: "Paste and glue", t: "Wheat starch paste comes away again with water, so it is our first choice for cloth and paper." },
    { id: "R7", sec: "Resewing a ledger", t: "Resew it with unbleached linen thread as thick as the old, through the old holes, and keep the tapes." },
    { id: "R8", sec: "Storage", t: "A book that may carry arsenic goes in a sealed bag inside its box, labelled for whoever opens it next." }
  ];

  var VOCAB = ["emerald", "green", "cloth", "arsenic", "box", "lift", "paste", "thread", "account"];

  var TESTS = [
    { id: "t1", q: "Is the emerald green cloth on the 1858 ledger safe to handle?", right: "R3" },
    { id: "t2", q: "How should a book that may carry arsenic be boxed?", right: "R8" },
    { id: "t3", q: "Can I lift the cloth from the boards of an emerald cover?", right: "R5" },
    { id: "t4", q: "Which paste do I use on cloth?", right: "R6" },
    { id: "t5", q: "What thread do I resew the ledger with?", right: "R7" },
    { id: "t6", q: "Which cloth should cover an account book in daily use?", right: "R1" }
  ];

  var SPLITS = [
    { value: "fixed", label: "Fixed characters (cut every N characters)" },
    { value: "recursive", label: "Recursive (heading, paragraph, sentence, word)" },
    { value: "heading", label: "By heading, then paragraph" },
    { value: "chapter", label: "By chapter (a whole chapter each)" },
    { value: "sentence", label: "One sentence each" }
  ];
  var SPLIT_SHORT = { fixed: "fixed characters", recursive: "recursive", heading: "by heading", chapter: "by chapter", sentence: "one sentence each" };

  /* ---------- the document ---------- */

  var DOC = "", START = [], END = [], PATH = [];
  (function () {
    var ch = "";
    BLOCKS.forEach(function (b, i) {
      if (i) DOC += "\n\n";
      START[i] = DOC.length;
      DOC += b.t;
      END[i] = DOC.length;
      if (b.k === "h1") ch = b.t;
      PATH[i] = b.k === "h1" ? ch : (b.k === "h2" ? ch + " > " + b.t : PATH[i - 1]);
    });
  })();

  function blockAt(pos) { for (var i = BLOCKS.length - 1; i >= 0; i--) if (START[i] <= pos) return i; return 0; }
  function isHead(i) { return BLOCKS[i].k !== "p"; }

  // Sentences: each heading line is one; paragraphs split after . ! or ?
  var SENT = [];
  BLOCKS.forEach(function (b, i) {
    if (isHead(i)) { SENT.push([START[i], END[i]]); return; }
    var re = /[^.!?]+[.!?]+/g, m;
    while ((m = re.exec(b.t))) {
      var s = m.index;
      while (b.t.charAt(s) === " ") s++;
      SENT.push([START[i] + s, START[i] + m.index + m[0].length]);
    }
  });

  // Cut points for the recursive separators, in order.
  var CUT_HEAD = [], CUT_PARA = [], CUT_SENT = [], CUT_WORD = [], CUT_CHAR = [];
  BLOCKS.forEach(function (b, i) {
    var afterHead = i > 0 && isHead(i - 1);
    if (!afterHead) { CUT_PARA.push(START[i]); if (isHead(i)) CUT_HEAD.push(START[i]); }
  });
  SENT.forEach(function (s) { var b = blockAt(s[0]); if (!isHead(b) && s[0] !== START[b]) CUT_SENT.push(s[0]); });
  for (var p = 0; p < DOC.length; p++) { CUT_CHAR.push(p); if (DOC.charAt(p) === " ") CUT_WORD.push(p + 1); }
  var LEVELS = [CUT_HEAD, CUT_PARA, CUT_SENT, CUT_WORD, CUT_CHAR];

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function len(r) { return r[1] - r[0]; }
  function trim(r) {
    var s = r[0], e = r[1];
    while (s < e && /\s/.test(DOC.charAt(s))) s++;
    while (e > s && /\s/.test(DOC.charAt(e - 1))) e--;
    return [s, e];
  }
  function cutAt(r, cuts) {
    var pts = [r[0]], out = [];
    cuts.forEach(function (c) { if (c > r[0] && c < r[1]) pts.push(c); });
    pts.push(r[1]);
    for (var i = 0; i + 1 < pts.length; i++) out.push([pts[i], pts[i + 1]]);
    return out;
  }
  function merge(pieces, size) {
    var out = [], cur = null;
    pieces.forEach(function (q) {
      if (cur && len(trim([cur[0], q[1]])) > size) { out.push(cur); cur = null; }
      cur = cur ? [cur[0], q[1]] : [q[0], q[1]];
    });
    if (cur) out.push(cur);
    return out;
  }
  function rec(r, level, size) {
    var out = [], good = [];
    cutAt(r, LEVELS[level]).forEach(function (q) {
      if (len(trim(q)) <= size || level === LEVELS.length - 1) good.push(q);
      else {
        if (good.length) { out = out.concat(merge(good, size)); good = []; }
        out = out.concat(rec(q, level + 1, size));
      }
    });
    if (good.length) out = out.concat(merge(good, size));
    return out;
  }
  // Start each chunk earlier by whole sentences that fit in the overlap, never back across a heading.
  function overlapBack(ranges, over) {
    return ranges.map(function (r, i) {
      if (!i || !over) return r;
      var b = blockAt(r[0]);
      if (isHead(b) || (START[b] === r[0] && isHead(b - 1))) return r;
      var s = r[0];
      for (var k = SENT.length - 1; k >= 0; k--) {
        var st = SENT[k];
        if (st[1] > s) continue;
        if (isHead(blockAt(st[0])) || r[0] - st[0] > over || st[0] < ranges[i - 1][0]) break;
        s = st[0];
      }
      return [s, r[1]];
    });
  }

  function words(s) { return s.toLowerCase().match(/[a-z0-9']+/g) || []; }
  function vec(s) {
    var w = words(s);
    return VOCAB.map(function (k) { var n = 0; w.forEach(function (x) { if (x.indexOf(k) === 0) n += 1; }); return n; });
  }
  function dot(a, b) { var d = 0; for (var i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }
  function score(q, c) { var a = dot(q, q), b = dot(c, c); return a && b ? Math.round(100 * dot(q, c) / Math.sqrt(a * b)) : 0; }
  function tokensOf(s) { return Math.ceil(s.length / CPT); }
  function sc2(h) { return (h / 100).toFixed(2); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function chunk(C) {
    var size = C.size * CPT, over = C.over * CPT, out = [], s;
    if (C.split === "fixed") {
      for (s = 0; s < DOC.length; s += size - over) { out.push([s, Math.min(DOC.length, s + size)]); if (s + size >= DOC.length) break; }
    } else if (C.split === "recursive") {
      out = overlapBack(rec([0, DOC.length], 0, size).map(trim), over);
    } else if (C.split === "heading") {
      cutAt([0, DOC.length], CUT_HEAD).forEach(function (r) { out = out.concat(len(trim(r)) <= size ? [r] : rec(r, 1, size)); });
      out = overlapBack(out.map(trim), over);
    } else if (C.split === "chapter") {
      out = cutAt([0, DOC.length], BLOCKS.map(function (b, i) { return b.k === "h1" ? START[i] : -1; }));
    } else {
      out = SENT.slice();
    }
    return out.map(trim).filter(function (r) { return len(r) > 0; }).map(function (r, i) {
      var b = blockAt(r[0]), e = blockAt(r[1] - 1), f = b;
      while (f < e && isHead(f)) f++;
      var pg = BLOCKS[f].page, pg2 = BLOCKS[e].page;
      var meta = PATH[f] + ", " + (pg === pg2 ? "p. " + pg : "pp. " + pg + " to " + pg2);
      var text = DOC.slice(r[0], r[1]);
      var emb = C.meta ? meta + "\n" + text : text;
      return { n: i + 1, r: r, text: text, meta: meta, v: vec(emb), tok: tokensOf(emb) };
    });
  }

  function rulesIn(c) {
    var out = [];
    RULES.forEach(function (x) { var at = c.text.indexOf(x.t); if (at >= 0) out.push({ x: x, at: at }); });
    out.sort(function (a, b) { return a.at - b.at; });
    return out.map(function (o) { return o.x; });
  }
  function rule(id) { for (var i = 0; i < RULES.length; i++) if (RULES[i].id === id) return RULES[i]; return null; }
  function test(id) { for (var i = 0; i < TESTS.length; i++) if (TESTS[i].id === id) return TESTS[i]; return null; }

  function ask(chunks, t) {
    var qv = vec(t.q);
    var rows = chunks.map(function (c) { return { c: c, h: score(qv, c.v) }; });
    rows.sort(function (a, b) { return (b.h - a.h) || (a.c.n - b.c.n); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    var sent = rows.slice(0, K), used = null, from = null;
    for (var j = 0; j < sent.length && !used; j++) {
      var best = -1;
      rulesIn(sent[j].c).forEach(function (x) {
        var d = dot(qv, vec(x.t));
        if (d > best) { best = d; used = x; from = sent[j]; }
      });
    }
    var hit = sent.some(function (r) { return rulesIn(r.c).some(function (x) { return x.id === t.right; }); });
    var tokens = SYSTEM_TOKENS + QUESTION_TOKENS;
    var chars = 0, cover = [];
    sent.forEach(function (r) { tokens += r.c.tok; chars += len(r.c.r); cover.push(r.c.r); });
    cover.sort(function (a, b) { return a[0] - b[0]; });
    var union = 0, end = -1;
    cover.forEach(function (r) { if (r[1] > end) { union += r[1] - Math.max(r[0], end); end = r[1]; } });
    return { qv: qv, rows: rows, sent: sent, used: used, from: from, right: !!used && used.id === t.right, hit: hit,
      tokens: tokens, twice: Math.ceil((chars - union) / CPT) };
  }

  function testRun(C) {
    var chunks = chunk(C), res = TESTS.map(function (t) { return ask(chunks, t); });
    return { chunks: chunks, res: res, hit: res.filter(function (x) { return x.hit; }).length,
      right: res.filter(function (x) { return x.right; }).length };
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    function head(text) { box.appendChild(el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text)); }
    function line() { var q = el("p", "", "margin:0;font-size:13px;", ""); box.appendChild(q); return q; }
    function table(cols) {
      var wrap = el("div", "table-wrap", "", ""), t = el("table", "", "font-size:12px;", ""), th = el("thead", "", "", ""), tr = el("tr", "", "", "");
      cols.forEach(function (h) { tr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h)); });
      th.appendChild(tr); t.appendChild(th);
      var body = el("tbody", "", "", "");
      t.appendChild(body); wrap.appendChild(t); box.appendChild(wrap);
      return body;
    }
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "Pages 40 to 47 of the studio handbook, 2,743 characters. The embedding is a stand-in that counts 9 keywords, " +
      "token counts are a teaching value (4 characters a token), and the answer comes from a deterministic stand-in, not a model."));
    var setLine = line();
    head("The chunks, in document order, scored against the question");
    var cBody = table(["#", "score", "rank", "tokens", "heading and page", "text"]);
    head("The answer");
    var ansLine = line(), srcLine = line();
    ansLine.setAttribute("aria-live", "polite");
    head("The test set: 6 questions whose right rules are known");
    var tBody = table(["question", "right rule in", "in the top 3", "answered from", "right"]);
    var testLine = line();
    api.root.appendChild(box);
    return { el: el, setLine: setLine, cBody: cBody, ansLine: ansLine, srcLine: srcLine, tBody: tBody, testLine: testLine };
  }

  function cfgOf(S) { return { split: S.split, size: S.size, over: S.over, meta: S.meta }; }
  function sizeText(C) {
    if (C.split === "chapter" || C.split === "sentence") return SPLIT_SHORT[C.split] + " (size and overlap don't apply)";
    var s = SPLIT_SHORT[C.split] + ", " + C.size + " tokens";
    if (C.split === "fixed") s += " (" + fmt(C.size * CPT) + " characters)";
    return s + ", overlap " + (C.over ? C.over + " tokens" : "none");
  }

  function draw(api) {
    var S = api.state, ui = S.ui, el = ui.el, C = cfgOf(S), t = test(S.q);
    var run = testRun(C), a = ask(run.chunks, t);
    S.run = run; S.ans = a;
    ui.setLine.textContent = "Splitter: " + sizeText(C) + ". Heading and page " + (C.meta ? "kept" : "not kept") + ". " +
      run.chunks.length + " chunks. Keywords in the question: " + VOCAB.filter(function (k, i) { return a.qv[i]; }).join(", ") + ".";
    var rankOf = {};
    a.rows.forEach(function (r) { rankOf[r.c.n] = r; });
    while (ui.cBody.firstChild) ui.cBody.removeChild(ui.cBody.firstChild);
    run.chunks.forEach(function (c) {
      var r = rankOf[c.n], sent = r.rank <= K, tr = el("tr", sent ? "" : "muted", a.from && a.from.c.n === c.n ? "font-weight:600;" : "", "");
      [String(c.n), sc2(r.h), r.rank + (sent ? ", sent" : ""), String(c.tok), C.meta ? c.meta : "not kept", c.text.replace(/\n\n/g, " / ")].forEach(function (v, i) {
        tr.appendChild(el("td", "", "padding:2px 6px;vertical-align:top;" + (i === 5 ? "min-width:260px;" : "white-space:nowrap;"), v));
      });
      ui.cBody.appendChild(tr);
    });
    ui.ansLine.textContent = "Answer: " + (a.used ? a.used.t : "I can't find a rule for that in the pages I was sent.");
    ui.ansLine.className = a.right ? "mark-ok" : "mark-no";
    ui.srcLine.textContent = !a.used ? "No chunk sent holds a rule." :
      (C.meta ? "Source: " + a.from.c.meta + " (chunk " + a.from.c.n + ", " + sc2(a.from.h) + ")." :
        "Source not shown: no heading or page was kept. It came from chunk " + a.from.c.n + ".");
    ui.srcLine.className = C.meta ? "" : "muted";
    while (ui.tBody.firstChild) ui.tBody.removeChild(ui.tBody.firstChild);
    run.res.forEach(function (x, i) {
      var tt = TESTS[i], tr = el("tr", "", "", "");
      [tt.q, rule(tt.right).sec, x.hit ? "yes" : "no", x.used ? x.used.sec : "nothing found", x.right ? "yes" : "no"].forEach(function (v, j) {
        tr.appendChild(el("td", j === 2 || j === 4 ? (v === "yes" ? "mark-ok" : "mark-no") : "", "padding:2px 6px;" + (j === 0 ? "min-width:220px;" : "white-space:nowrap;"), v));
      });
      ui.tBody.appendChild(tr);
    });
    ui.testLine.textContent = "Right rule in the top " + K + ": " + run.hit + " of 6. Answered from the right rule: " + run.right + " of 6. " +
      "This question: " + fmt(a.tokens) + " input tokens (300 system prompt, 20 question, " + fmt(a.tokens - 320) + " in the chunks sent)" +
      (a.twice ? ", " + a.twice + " of them sent twice by the overlap." : ".");
    S.stat.chunks(run.chunks.length);
    S.stat.top(sc2(a.rows[0].h));
    S.stat.from(a.used ? a.used.sec : "nothing found");
    S.stat.hit(run.hit + " of 6");
    S.stat.right(run.right + " of 6");
    S.stat.tokens(a.tokens);
    S.stat.twice(a.twice);
  }

  function summary(S) {
    var a = S.ans;
    return (a.used ? "Answered from " + a.used.sec + " (chunk " + a.from.c.n + ", " + sc2(a.from.h) + ")" : "Nothing found in the top " + K) +
      ". Test set: " + S.run.hit + " of 6 retrieved, " + S.run.right + " of 6 right; " + fmt(a.tokens) + " tokens.";
  }
  function change(api, prefix) {
    var S = api.state;
    draw(api);
    api.log(prefix + summary(S), S.ans.right ? "ok" : "bad");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e02", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.q = "t1"; S.split = "fixed"; S.size = 125; S.over = 0; S.meta = false;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.q = api.control.select("q", "Question", TESTS.map(function (t) { return { value: t.id, label: t.q }; }), "t1", function (v) {
        if (!test(v)) return; S.q = v; change(api, "Question: " + test(v).q + " ");
      });
      S.ctl.split = api.control.select("split", "Splitter", SPLITS, "fixed", function (v) {
        if (!SPLIT_SHORT[v]) return; S.split = v; change(api, "Splitter: " + SPLIT_SHORT[v] + ". ");
      });
      S.ctl.size = api.control.select("size", "Chunk size (tokens)", SIZES.map(function (n) {
        return { value: n, label: n + " tokens (" + fmt(n * CPT) + " characters)" };
      }), 125, function (v) {
        var n = Number(v); if (SIZES.indexOf(n) < 0) return; S.size = n; change(api, "Chunk size: " + n + " tokens. ");
      });
      S.ctl.over = api.control.select("over", "Overlap (tokens)", OVERLAPS.map(function (n) {
        return { value: n, label: n ? n + " tokens" : "none" };
      }), 0, function (v) {
        var n = Number(v); if (OVERLAPS.indexOf(n) < 0) return; S.over = n; change(api, "Overlap: " + (n ? n + " tokens" : "none") + ". ");
      });
      S.ctl.meta = api.control.toggle("meta", "Keep heading and page with each chunk", false, function (v) {
        S.meta = !!v; change(api, "Heading and page " + (S.meta ? "kept" : "not kept") + ". ");
      });
      S.ctl.reset = api.control.button("reset", "Reset to Tuesday night", function () { api.reset(); });
      S.stat = {
        chunks: api.stat("chunks", "chunks", ""),
        top: api.stat("top", "top score", "warn"),
        from: api.stat("from", "answered from", ""),
        hit: api.stat("hit", "test set: right rule in the top 3", "ok"),
        right: api.stat("right", "test set: answered from the right rule", "ok"),
        tokens: api.stat("tokens", "input tokens, this question", ""),
        twice: api.stat("twice", "tokens sent twice (overlap)", "warn")
      };
      api.info("<strong>How to read it.</strong> The splitter cuts the pages into chunks. Each chunk's score is the cosine " +
        "similarity of keyword counts: the stand-in embedding counts the 9 keywords the test questions use, so a chunk with none " +
        "of the question's keywords scores 0.00. A real embedding would still give a cut chunk a partial match; this lab " +
        "exaggerates the loss. The top 3 chunks are sent, and the stand-in answers from the first of them that holds a whole rule. " +
        "Keeping the heading and page puts the section path in front of each chunk's text and shows it under the answer.");
      draw(api);
      api.log("Tuesday 21:52, Imani's question, the handbook as it was cut. " + summary(S), S.ans.right ? "ok" : "bad");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function cfg(split, size, over, meta) { return { split: split, size: size, over: over, meta: meta }; }
      function row(a, n) { for (var i = 0; i < a.rows.length; i++) if (a.rows[i].c.n === n) return a.rows[i]; return null; }
      var T1 = test("t1");

      // 1. The opening state: Tuesday night's settings and answer, with exact scores.
      await t.run(1);
      var story = chunk(cfg("fixed", 125, 0, false)), a = ask(story, T1);
      t.expect(st().split === "fixed" && st().size === 125 && st().over === 0 && !st().meta && st().q === "t1" &&
        t.stat("chunks") === 6 && t.stat("top") === 0.84 && t.stat("from") === "Other green cloths" &&
        t.stat("hit") === "4 of 6" && t.stat("right") === "3 of 6" && t.stat("tokens") === 695 && t.stat("twice") === 0 &&
        st().ui.ansLine.textContent === "Answer: Handle it freely, and wash your hands after, as for any old book." &&
        t.logText().indexOf("Answered from Other green cloths (chunk 4, 0.84)") >= 0,
        "opens on Tuesday 21:52: fixed 500-character chunks, no overlap, no heading; 6 chunks; Imani's question is answered from Other green cloths at 0.84; 4 of 6 retrieved, 3 of 6 right; 695 tokens");

      // 2. The lost warning: the cut falls just after the heading, and the warning's chunk scores 0.00.
      t.expect(DOC.length === 2743 && story[1].text.slice(-20) === "Emerald green cloths" && story[2].r[0] === 1000 &&
        story[2].text.indexOf("Bindings of this colour") === 0 && story[2].text.indexOf(rule("R3").t) > 0 &&
        story[2].text.toLowerCase().indexOf("green") < 0 && row(a, 4).h === 84 && row(a, 2).h === 79 && row(a, 5).h === 56 &&
        row(a, 1).h === 55 && row(a, 3).h === 0 && row(a, 3).rank === 5 && a.qv.join("") === "111000000",
        "chunk 2 ends with the heading Emerald green cloths; chunk 3 starts at character 1,000 with the warning, no heading and no 'green'; scores 0.84, 0.79, 0.56 for chunks 4, 2, 5 (sent), 0.55 for chunk 1, and 0.00 for chunk 3, fifth of six");

      // 3. Keep the heading and page, same cuts: the warning's chunk comes first.
      t.set("meta", true);
      t.expect(t.stat("top") === 0.87 && t.stat("from") === "Emerald green cloths" && t.stat("hit") === "5 of 6" &&
        t.stat("right") === "5 of 6" && st().ui.srcLine.textContent.indexOf("Source: Pigments and safety > Emerald green cloths, p. 42 (chunk 3, 0.87)") === 0,
        "heading and page kept: chunk 3 scores 0.87 and comes first; answered from Emerald green cloths, p. 42; 5 of 6 and 5 of 6");
      t.set("meta", false);

      // 4. Overlap alone: the heading rides across the cut.
      t.set("over", 25);
      var o = ask(chunk(cfg("fixed", 125, 25, false)), T1);
      t.expect(t.stat("chunks") === 7 && t.stat("from") === "Emerald green cloths" && t.stat("hit") === "6 of 6" && t.stat("right") === "5 of 6" &&
        o.from.c.text.indexOf("Emerald green cloths") >= 0 && t.stat("twice") > 0,
        "overlap of 25 tokens (100 characters): 7 chunks, the heading rides into the warning's chunk, Imani's question answered right; 6 of 6 and 5 of 6, with tokens sent twice");
      t.set("over", 0);

      // 5. Option 0: a whole chapter each. Everything is sent; two answers come from the wrong chapter.
      t.set("split", "chapter");
      var ch = testRun(cfg("chapter", 125, 0, false));
      t.expect(t.stat("chunks") === 3 && t.stat("hit") === "6 of 6" && t.stat("right") === "4 of 6" && t.stat("tokens") === 1005 &&
        !ch.res[3].right && !ch.res[4].right,
        "by chapter: 3 chunks, all sent, 6 of 6 retrieved but 4 of 6 right (paste and thread answered from the wrong chapter); 1,005 tokens");

      // 6. Option 1: one sentence each. The heading alone matches; the warning sentence scores 0.00.
      t.set("split", "sentence");
      var sn = chunk(cfg("sentence", 125, 0, false)), sa = ask(sn, T1), warn = null;
      sn.forEach(function (c) { if (c.text === rule("R3").t) warn = c; });
      t.expect(t.stat("chunks") === 38 && t.stat("top") === 1 && t.stat("from") === "nothing found" && sa.rows[0].c.text === "Emerald green cloths" &&
        warn && row(sa, warn.n).h === 0 && t.stat("hit") === "5 of 6" && t.stat("right") === "5 of 6",
        "one sentence each: 38 chunks; the heading line scores 1.00 and holds no rule; the warning sentence scores 0.00; nothing found; 5 of 6 and 5 of 6");

      // 7. The thread's default: 512 tokens with 50 overlap.
      t.set("split", "fixed"); t.set("size", 512); t.set("over", 50);
      t.expect(t.stat("chunks") === 2 && t.stat("hit") === "6 of 6" && t.stat("right") === "4 of 6" && t.stat("from") === "Calico and buckram" &&
        t.stat("tokens") === 1056,
        "512 tokens with 50 overlap: 2 chunks, 6 of 6 retrieved, 4 of 6 right; Imani's question answered from Calico and buckram; 1,056 tokens");

      // 8. The senior settings: by heading, 125 tokens, a sentence of overlap, heading and page kept.
      t.set("split", "heading"); t.set("size", 125); t.set("over", 25); t.set("meta", true);
      t.expect(t.stat("chunks") === 11 && t.stat("hit") === "6 of 6" && t.stat("right") === "6 of 6" && t.stat("from") === "Emerald green cloths" &&
        t.stat("tokens") === 563 && t.stat("twice") === 14 && st().ui.ansLine.textContent === "Answer: " + rule("R3").t,
        "by heading, 125 tokens, overlap 25, heading and page kept: 11 chunks, 6 of 6 and 6 of 6; the warning, from Emerald green cloths, p. 42; 563 tokens, 14 sent twice");

      // 9. An independent count: the keyword counts and the cosine behind 0.84, worked by hand.
      var c4 = story[3], v = vec(c4.text), manual = Math.round(100 * (v[0] + v[1] + v[2]) / Math.sqrt(3 * dot(v, v)));
      t.expect(c4.text.indexOf("Other green cloths") === 0 && v.join(",") === "1,3,4,0,0,2,0,0,0" && manual === 84 && tokensOf(DOC.slice(0, 500)) === 125,
        "chunk 4 counts emerald 1, green 3, cloth 4, lift 2: 8 / sqrt(3 x 30) = 0.84; 500 characters = 125 tokens");

      // 10. Every question under every splitter: the senior settings are the only ones here with 6 of 6 right.
      var best = [];
      ["fixed", "recursive", "heading", "chapter", "sentence"].forEach(function (sp) {
        [false, true].forEach(function (m) { var r = testRun(cfg(sp, 125, 25, m)); if (r.right === 6 && r.hit === 6) best.push(sp + (m ? "+meta" : "")); });
      });
      t.expect(best.indexOf("heading+meta") >= 0 && best.indexOf("fixed") < 0 && best.indexOf("chapter") < 0 && best.indexOf("sentence") < 0,
        "at 125 tokens and 25 overlap, by heading with heading and page kept gets 6 of 6 and 6 of 6; fixed, chapter and sentence splits without it don't");

      // 11. Reset returns to Tuesday night.
      t.click("reset");
      t.expect(st().split === "fixed" && st().size === 125 && !st().meta && t.stat("from") === "Other green cloths" && t.stat("top") === 0.84,
        "reset returns to Tuesday night's cuts and answer");
    }
  });
})();
