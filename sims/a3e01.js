/* sims/a3e01-v1.0.1.js  (published as sims/a3e01.js)
   Case a3e01 "Asking the Archive": a RAG pipeline lab, from Imogen's séance at Mallender House, a Victorian
   house museum where visitors ask "the spirit of the house" questions and a model answers from the family's
   archive of letters, diaries and household accounts.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 rename: the two women who share a name are now both Winifred; the case is
     content/latent/a3/a3e01-v1.0.1.json
   v1.0.0 (2026-10-11) first version: a widget-style sim built inside api.root (no diagram), drawn as plain
     text blocks and two tables using theme classes only. No real model: a deterministic stand-in that
     answers from the highest-scoring passage it is given and records which passage that was. A stated
     teaching sample of 10 passages from the archive, each with its writer and date, and a small stated
     embedding vector (4 numbers, every vector of length exactly 10, so cosine similarity is the dot product
     divided by 100 and every score is an exact two-place number). A test set of 6 questions whose right
     passages are known. Controls: the question, where the knowledge comes from (retrieve the top k, the
     whole archive in the context, or a model fine-tuned on the archive), k, the metadata filter by the
     writer a question names, asking when a name fits two writers, sources shown under the answer, reset.
     Stats: the score of the passage the answer used, who wrote it, the test set's retrieval hit rate and
     right answers, tokens per question, the night's cost. selfTest covers the Friday start with exact
     scores, the vector arithmetic, top 50, the filter alone, the senior settings, the whole archive, the
     fine-tuned stand-in, an independent recomputation over every k and setting, every story number, and
     the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a3/a3e01-v1.0.1.json).
   All of them follow from WRITERS, PASSAGES, TESTS, retrieve(), answerFor(), testRun(), tokensFor():
   - The archive (story values): 2,300 items (letters, diaries and household accounts, 1858 to 1938), split
     by Imogen's script into 2,760 passages of 250 tokens each (a teaching value): 690,000 tokens.
   - The vectors are teaching values with four made-up meanings: leaving, family, night, household. Every
     vector's squared length is 100. Friday's question, "What did Winifred say about the night her brother
     left?", is (7, 5, 5, 1). Its dot products with the 10 passages, divided by 100:
       p02 younger Winifred, letter, 9 September 1933, the gate         (8, 4, 4, 2)  0.98  rank 1
       p03 younger Winifred, same letter, the trunk                       (9, 3, 3, 1)  0.94  rank 2
       p05 younger Winifred, diary, 9 September 1934, a year tonight      (5, 5, 5, 5)  0.90  rank 3
       p04 Edmund, letter, 21 March 1873, the boy is gone              (8, 6, 0, 0)  0.86  rank 4
       p06 Harriet, accounts, March 1873, the cab                      (7, 1, 5, 5)  0.84  rank 5
       p01 elder Winifred, diary, 14 March 1873, no goodbye               (6, 0, 8, 0)  0.82  rank 6
       p07 elder Winifred, letter, 2 April 1873, his name at table        (2, 8, 4, 4)  0.78  rank 7
       p08 elder Winifred, diary, 14 March 1883, ten years tonight        (1, 5, 5, 7)  0.64  rank 8
       p10 Harriet, accounts, November 1874, lamp oil                  (1, 1, 7, 7)  0.54  rank 9
       p09 younger Winifred, letter, May 1931, the lilac                  (1, 3, 3, 9)  0.46  rank 10
     The other 2,750 passages of the archive score below 0.46 for every test question (a stated teaching
     assumption), so they only ever fill places after the sample's passages.
   - Friday (top 5, no filter, no asking, no sources): the five passages sent are p02, p03, p05, p04 and
     p06. The elder Winifred's diary, p01, is sixth at 0.82. The stand-in answers from p02 (0.98): "I walked
     him to the gate that night. He pressed my hand and said he would write from the ship."
   - Filter by the writer the question names, no asking: "Winifred" fits two writers, so the filter keeps both
     Winifreds: p02 0.98, p03 0.94, p05 0.90, p01 0.82 (now fourth, sent), p07 0.78. The answer is still p02.
   - Asking when a name fits two writers: the visitor means the elder Winifred, so the filter keeps only her:
     p01 0.82, p07 0.78, p08 0.64. The answer comes from p01: "There was no goodbye. I watched from the
     landing window, and he did not look back."
   - The test set: t1 Friday's question (7,5,5,1), meant the elder Winifred, right p01; t2 "a year after her
     brother went" (4,8,4,2), the younger, p05; t3 Edmund on his son leaving (7,7,1,1), p04; t4 Harriet's
     cab (8,2,4,4), p06; t5 the elder Winifred on her brother's room (5,5,1,7), p08; t6 the lilac by the gate
     (3,3,1,9), the younger, p09.
     Friday's settings: the right passage is in the top 5 for 5 of 6 (t1 misses, sixth) and ranked first
     for 3 of 6 (t3, t4, t6). Top 50: 6 of 6 retrieved, still 3 of 6 first. The filter alone: 6 of 6, 3 of
     6. Asking (with or without the filter): 6 of 6 and 6 of 6. Top 1 with Friday's settings: 3 and 3.
   - Tokens per question (teaching values): the system prompt 400, the question 20, and 250 for each
     passage sent. Top 5: 420 + 1,250 = 1,670. Top 50: 420 + 12,500 = 12,920. The whole archive: 420 +
     690,000 = 690,420, inside a 1,000,000-token window (Anthropic's current models list 1M) and over the
     200,000 tokens below which Anthropic's contextual retrieval post says you can just include the whole
     knowledge base. Fine-tuned, no passages: 420.
   - Cost at the teaching price of $2 per million input tokens (case 3 of Season 1), 60 questions a night
     (story value: two séances an evening, about 30 questions each): top 5, 100,200 tokens, $0.2004, shown
     $0.20; top 50, 775,200, $1.5504, shown $1.55; the whole archive, 41,425,200, $82.8504, shown $82.85,
     which is $1.38 a question; fine-tuned, 25,200, $0.0504, shown $0.05, plus a training run whenever the
     archive changes (not priced: no real fine-tuning price is used). Output tokens are left out.
   - The fine-tuned stand-in is a teaching rule, not a measurement: it answers from what it absorbed most
     strongly, the passage that scores highest with no filter, and it has no passages to show, filter or
     ask about. So it answers 3 of 6 right and shows no sources.
   - Story-only numbers, not computed: the séance at 21:40 on Friday; the elder Winifred 1852 to 1919, writing
     1868 to 1919; the younger Winifred 1911 to 1990, writing 1925 to 1938; Laurence left in March 1873,
     Osgood in September 1933, sixty years apart; the cab at 4s; the sim clock starts at seven on Saturday
     morning (START_CLOCK), when Imogen reruns the question.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed;
     every number is worked out the moment a control changes, and the opening state is Friday's.
   - No random numbers anywhere: no scores tie in the top 6 for any test question (t4 and t5 have ties at
     ranks 7 and 8, which decide nothing), and any tie breaks by passage id.
   - Stats get bare numbers where the value is a number (units live in the labels).
   - Colors come only from theme classes: mark-ok, mark-no, muted, small, table-wrap. Fonts and spacing use
     style attributes, never colors.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 7 * 3600;        // seven on Saturday morning: Imogen reruns Friday's question
  var ITEMS = 2300;                  // letters, diaries and household accounts
  var ALL_PASSAGES = 2760;           // what Imogen's script split them into
  var PASSAGE_TOKENS = 250;          // teaching value: every passage
  var ARCHIVE_TOKENS = ALL_PASSAGES * PASSAGE_TOKENS;   // 690,000
  var SYSTEM_TOKENS = 400;           // teaching value: the short system prompt
  var QUESTION_TOKENS = 20;          // teaching value: one visitor's question
  var NIGHT_QUESTIONS = 60;          // two séances an evening, about 30 questions each
  var PRICE = 2;                     // teaching price: dollars per million input tokens
  var WINDOW = 1000000;              // the context window of Anthropic's current models (1M)
  var SMALL_KB = 200000;             // Anthropic: under 200,000 tokens, just include the whole knowledge base
  var K0 = 5, K_MIN = 1, K_MAX = 50;
  var SEANCE = "21:40";              // Friday's question
  var LEFT_ELDER = 1873, LEFT_YOUNGER = 1933;   // the two brothers left sixty years apart

  var WRITERS = {
    elder: { name: "Winifred Mallender", life: "1852 to 1919", wrote: "1868 to 1919", short: "the elder Winifred", winifred: true },
    younger: { name: "Winifred Mallender", life: "1911 to 1990", wrote: "1925 to 1938", short: "the younger Winifred", winifred: true },
    edmund: { name: "Edmund Mallender", life: "1820 to 1890", wrote: "1858 to 1889", short: "Edmund", winifred: false },
    harriet: { name: "Harriet Mallender", life: "1826 to 1901", wrote: "1860 to 1899", short: "Harriet", winifred: false }
  };

  // The teaching sample: 10 of the archive's 2,760 passages, with their metadata. v: leaving, family,
  // night, household. Every v has squared length 100.
  var PASSAGES = [
    { id: "p01", writer: "elder", kind: "diary", date: "14 March 1873", year: 1873, v: [6, 0, 8, 0],
      text: "Laurence went in the night. There was no goodbye. I watched from the landing window and he did not look back.",
      answer: "There was no goodbye. I watched from the landing window, and he did not look back." },
    { id: "p02", writer: "younger", kind: "letter", date: "9 September 1933", year: 1933, v: [8, 4, 4, 2],
      text: "The night Osgood left, I walked him to the gate. He pressed my hand and said he would write from the ship.",
      answer: "I walked him to the gate that night. He pressed my hand and said he would write from the ship." },
    { id: "p03", writer: "younger", kind: "letter", date: "9 September 1933", year: 1933, v: [9, 3, 3, 1],
      text: "He left after supper. His trunk had gone ahead on the carrier's cart at noon.",
      answer: "He left after supper. His trunk had gone ahead on the carrier's cart at noon." },
    { id: "p04", writer: "edmund", kind: "letter", date: "21 March 1873", year: 1873, v: [8, 6, 0, 0],
      text: "The boy is gone and we will not speak of it.",
      answer: "The boy is gone, and we will not speak of it." },
    { id: "p05", writer: "younger", kind: "diary", date: "9 September 1934", year: 1934, v: [5, 5, 5, 5],
      text: "A year tonight since Osgood went. Still no letter.",
      answer: "A year tonight since he went, and still no letter." },
    { id: "p06", writer: "harriet", kind: "accounts", date: "March 1873", year: 1873, v: [7, 1, 5, 5],
      text: "Cab from the side gate, one fare, late at night: 4s.",
      answer: "A cab from the side gate, one fare, late at night: four shillings." },
    { id: "p07", writer: "elder", kind: "letter", date: "2 April 1873", year: 1873, v: [2, 8, 4, 4],
      text: "Papa will not let Laurence's name be said at table.",
      answer: "Papa will not let his name be said at table." },
    { id: "p08", writer: "elder", kind: "diary", date: "14 March 1883", year: 1883, v: [1, 5, 5, 7],
      text: "Ten years tonight. I keep his room aired.",
      answer: "Ten years tonight. I keep his room aired." },
    { id: "p09", writer: "younger", kind: "letter", date: "May 1931", year: 1931, v: [1, 3, 3, 9],
      text: "The lilac by the gate is out, the colour of Aunt Winifred's old shawl.",
      answer: "The lilac by the gate is out, the colour of Aunt Winifred's old shawl." },
    { id: "p10", writer: "harriet", kind: "accounts", date: "November 1874", year: 1874, v: [1, 1, 7, 7],
      text: "Lamp oil and candles, for the long nights: 2s 6d.",
      answer: "Lamp oil and candles, for the long nights." }
  ];

  // The test set: questions whose right passages are known. names: the writers the question's name fits.
  // meant: who the asker meant (what they answer when asked).
  var TESTS = [
    { id: "t1", q: "What did Winifred say about the night her brother left?", v: [7, 5, 5, 1],
      names: ["elder", "younger"], meant: "elder", right: "p01" },
    { id: "t2", q: "What did Winifred write a year after her brother went?", v: [4, 8, 4, 2],
      names: ["elder", "younger"], meant: "younger", right: "p05" },
    { id: "t3", q: "What did Edmund say when his son left?", v: [7, 7, 1, 1],
      names: ["edmund"], meant: "edmund", right: "p04" },
    { id: "t4", q: "What did Harriet pay for the cab that night?", v: [8, 2, 4, 4],
      names: ["harriet"], meant: "harriet", right: "p06" },
    { id: "t5", q: "What did Winifred say about her brother's room?", v: [5, 5, 1, 7],
      names: ["elder", "younger"], meant: "elder", right: "p08" },
    { id: "t6", q: "What did Winifred write about the lilac by the gate?", v: [3, 3, 1, 9],
      names: ["elder", "younger"], meant: "younger", right: "p09" }
  ];

  var MODES = {
    retrieve: "Retrieve the top k passages",
    whole: "The whole archive in the context",
    tuned: "A model fine-tuned on the archive, no retrieval"
  };
  var MODE_KEYS = ["retrieve", "whole", "tuned"];

  /* ---------- the pipeline ---------- */

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function passage(id) {
    for (var i = 0; i < PASSAGES.length; i++) if (PASSAGES[i].id === id) return PASSAGES[i];
    return null;
  }

  function test(id) {
    for (var i = 0; i < TESTS.length; i++) if (TESTS[i].id === id) return TESTS[i];
    return null;
  }

  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function sq(a) { return dot(a, a); }

  // Every vector has length 10, so cosine similarity = dot / (10 x 10). Kept as hundredths (whole numbers).
  function hundredths(qv, p) { return dot(qv, p.v); }
  function scoreText(h) { return (h / 100).toFixed(2); }

  // Which writers the search may use, and whether the stand-in asks first.
  function scopeFor(tq, cfg) {
    var ambiguous = tq.names.length > 1;
    if (cfg.mode === "tuned") return { writers: null, asked: false, ambiguous: ambiguous };
    if (ambiguous && cfg.ask) return { writers: [tq.meant], asked: true, ambiguous: true };
    if (cfg.mode === "retrieve" && cfg.filter) return { writers: tq.names.slice(), asked: false, ambiguous: ambiguous };
    return { writers: null, asked: false, ambiguous: ambiguous };
  }

  // Every sample passage, ranked for a question, with its status: sent, not sent, or filtered out.
  function retrieve(tq, cfg) {
    var scope = scopeFor(tq, cfg);
    var rows = PASSAGES.map(function (p) {
      return { p: p, h: hundredths(tq.v, p), allowed: !scope.writers || scope.writers.indexOf(p.writer) >= 0 };
    });
    rows.sort(function (a, b) { return b.h - a.h || (a.p.id < b.p.id ? -1 : 1); });
    var rank = 0;
    rows.forEach(function (r) {
      if (!r.allowed) { r.rank = 0; r.status = "filtered out"; return; }
      rank++;
      r.rank = rank;
      if (cfg.mode === "whole") r.status = "in the context";
      else if (cfg.mode === "tuned") r.status = "in the training data";
      else r.status = rank <= cfg.k ? "sent" : "not sent";
    });
    var sent = rows.filter(function (r) { return r.status === "sent" || r.status === "in the context"; });
    var top = rows.filter(function (r) { return r.allowed; })[0];
    return { rows: rows, sent: sent, top: top, scope: scope };
  }

  // The stand-in's rule: answer from the highest-scoring passage it was given, and record which.
  function answerFor(tq, cfg) {
    var r = retrieve(tq, cfg), used = r.top;
    return { used: used.p, h: used.h, asked: r.scope.asked, ret: r, right: used.p.id === tq.right };
  }

  // The test set under the current settings.
  function testRun(cfg) {
    var hit = 0, first = 0, rows = TESTS.map(function (tq) {
      var a = answerFor(tq, cfg), row = a.ret.rows.filter(function (x) { return x.p.id === tq.right; })[0];
      var inK = cfg.mode === "retrieve" && row.status === "sent";
      if (inK) hit++;
      if (a.right) first++;
      return { t: tq, rank: row.rank, inK: inK, used: a.used, right: a.right, asked: a.asked };
    });
    return { hit: hit, first: first, rows: rows, n: TESTS.length };
  }

  function tokensFor(cfg) {
    if (cfg.mode === "whole") return SYSTEM_TOKENS + ARCHIVE_TOKENS + QUESTION_TOKENS;
    if (cfg.mode === "tuned") return SYSTEM_TOKENS + QUESTION_TOKENS;
    return SYSTEM_TOKENS + cfg.k * PASSAGE_TOKENS + QUESTION_TOKENS;
  }

  // Cents for a night: tokens x 60 questions x $2 per million = tokens x 60 / 5,000 cents.
  function nightCents(tokens) { return Math.round(tokens * NIGHT_QUESTIONS * PRICE / 10000); }
  function questionCents(tokens) { return Math.round(tokens * PRICE / 10000); }
  function money(c) { var r = c % 100; return Math.floor(c / 100) + "." + (r < 10 ? "0" : "") + r; }

  /* ---------- words ---------- */

  function num(n) {
    var s = String(Math.round(n)), out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function sourceOf(p) {
    var w = WRITERS[p.writer];
    return w.name + " (" + w.life + "), " + p.kind + ", " + p.date;
  }

  function whoOf(p) { return WRITERS[p.writer].name + ", " + p.year; }

  function askText() {
    return "Which Winifred do you mean: Winifred Mallender who wrote from " + WRITERS.elder.wrote +
      ", or Winifred Mallender who wrote from " + WRITERS.younger.wrote + "?";
  }

  function cfgOf(S) { return { mode: S.mode, k: S.k, filter: S.filter, ask: S.ask, sources: S.sources }; }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }
    function line() { var p = el("p", "", "margin:0;font-size:13px;", ""); box.appendChild(p); return p; }

    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "A teaching sample of 10 of the archive's 2,760 passages. Vectors, token counts and the price are teaching values; " +
      "the answer comes from a deterministic stand-in, not a model."));

    box.appendChild(head("The pipeline, stage by stage"));
    var stages = el("ol", "", "margin:0;padding-left:20px;font-size:13px;display:grid;gap:2px;", "");
    box.appendChild(stages);

    box.appendChild(head("The passages, ranked by cosine similarity to the question"));
    var wrap = el("div", "table-wrap", "", "");
    var table = el("table", "", "font-size:12px;", "");
    var thead = el("thead", "", "", ""), hr = el("tr", "", "", "");
    ["rank", "score", "writer", "date", "vector", "passage", "status"].forEach(function (h) {
      hr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var pBody = el("tbody", "", "", "");
    table.appendChild(pBody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    box.appendChild(head("The answer"));
    var askLine = line(), answerLine = line(), sourceLine = line();
    answerLine.setAttribute("aria-live", "polite");

    box.appendChild(head("The test set: 6 questions whose right passages are known"));
    var wrap2 = el("div", "table-wrap", "", "");
    var table2 = el("table", "", "font-size:12px;", "");
    var thead2 = el("thead", "", "", ""), hr2 = el("tr", "", "", "");
    ["question", "right passage", "its rank", "retrieved", "answered from it"].forEach(function (h) {
      hr2.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead2.appendChild(hr2);
    table2.appendChild(thead2);
    var tBody = el("tbody", "", "", "");
    table2.appendChild(tBody);
    wrap2.appendChild(table2);
    box.appendChild(wrap2);
    var testLine = line();

    box.appendChild(head("Tokens and cost"));
    var costLine = line();

    api.root.appendChild(box);
    return { doc: doc, el: el, stages: stages, pBody: pBody, askLine: askLine, answerLine: answerLine,
      sourceLine: sourceLine, tBody: tBody, testLine: testLine, costLine: costLine };
  }

  /* ---------- drawing ---------- */

  function stageTexts(S, a) {
    var cfg = cfgOf(S), tq = test(S.q), r = a.ret, out = [];
    out.push("Ingest: " + num(ITEMS) + " letters, diaries and household accounts, each with its writer and date.");
    out.push("Chunk: " + num(ALL_PASSAGES) + " passages of " + PASSAGE_TOKENS + " tokens, " + num(ARCHIVE_TOKENS) +
      " tokens in all; each passage keeps its writer and date as metadata.");
    out.push("Embed: each passage becomes a vector; the sample's are four numbers long.");
    out.push("Store and index: the vectors and metadata go into the store, searchable by similarity.");
    if (cfg.mode === "tuned") {
      out.push("Fine-tuned instead: the archive went into the model's weights in a training run. No passages are stored to search, filter or show.");
      out.push("Generate: the question alone, " + num(tokensFor(cfg)) + " tokens with the system prompt.");
      out.push("Cite: nothing to cite. A fine-tuned model can't point to the passage an answer came from.");
      return out;
    }
    out.push("Embed the question: \"" + tq.q + "\" becomes (" + tq.v.join(", ") + ").");
    if (cfg.mode === "whole") {
      out.push("Retrieve: skipped. All " + num(ALL_PASSAGES) + " passages go into every request" +
        (r.scope.asked ? ", after the stand-in asks which Winifred." : "."));
    } else {
      var scope = r.scope.writers ? "only " + r.scope.writers.map(function (w) { return WRITERS[w].short; }).join(" and ") :
        "every writer";
      out.push("Retrieve: the top " + cfg.k + " by cosine similarity, from " + scope + (r.scope.asked ? ", after asking which Winifred" : "") +
        ". In the sample: " + r.sent.map(function (x) { return x.p.id + " " + scoreText(x.h); }).join(", ") +
        (cfg.k > r.sent.length ? "; the rest of the " + cfg.k + " come from the archive's other passages, all lower." : "."));
    }
    out.push("Build the prompt: the system prompt, the passages, then the question: " + num(tokensFor(cfg)) + " tokens.");
    out.push("Generate: the stand-in answers from the highest-scoring passage it was given, " + a.used.id + " at " + scoreText(a.h) + ".");
    out.push("Cite: " + (cfg.sources ? "the writer and date of that passage are shown under the answer." : "sources are hidden, so nothing says whose words these are."));
    return out;
  }

  function drawStages(S, a) {
    var ui = S.ui;
    while (ui.stages.firstChild) ui.stages.removeChild(ui.stages.firstChild);
    stageTexts(S, a).forEach(function (s) { ui.stages.appendChild(ui.el("li", "", "", s)); });
  }

  function drawPassages(S, a) {
    var ui = S.ui, el = ui.el;
    while (ui.pBody.firstChild) ui.pBody.removeChild(ui.pBody.firstChild);
    a.ret.rows.forEach(function (r) {
      var used = r.p.id === a.used.id;
      var tr = el("tr", r.status === "filtered out" || r.status === "not sent" ? "muted" : "", used ? "font-weight:600;" : "", "");
      [r.rank ? String(r.rank) : "-", scoreText(r.h), WRITERS[r.p.writer].short + " (" + WRITERS[r.p.writer].life + ")",
        r.p.date, "(" + r.p.v.join(", ") + ")", r.p.id + ": " + r.p.text, r.status + (used ? ", answered from" : "")].forEach(function (v, i) {
        tr.appendChild(el("td", "", "padding:2px 6px;vertical-align:top;" + (i === 5 ? "min-width:220px;" : "white-space:nowrap;"), v));
      });
      ui.pBody.appendChild(tr);
    });
  }

  function drawAnswer(S, a) {
    var ui = S.ui, tq = test(S.q);
    ui.askLine.textContent = a.asked ? "The stand-in asks: " + askText() + " The visitor: " + WRITERS[tq.meant].short +
      ", who wrote from " + WRITERS[tq.meant].wrote + "." : (S.mode === "tuned" ? "No passages: the answer comes from the weights." : "");
    ui.answerLine.textContent = "Answer: " + a.used.answer;
    ui.answerLine.className = a.right ? "mark-ok" : "mark-no";
    if (S.mode === "tuned") ui.sourceLine.textContent = "Sources: none. A fine-tuned model has no passage to point to.";
    else if (S.sources) {
      var more = S.mode === "whole" ? "the whole archive was in the context" : (a.ret.sent.length - 1) + " more sample passages sent";
      ui.sourceLine.textContent = "Source: " + sourceOf(a.used) + ". Also: " + more + ".";
    } else ui.sourceLine.textContent = "Sources hidden: nothing under the answer says whose words these are.";
    ui.sourceLine.className = S.sources && S.mode !== "tuned" ? "" : "muted";
  }

  function drawTests(S) {
    var ui = S.ui, el = ui.el, run = S.run;
    while (ui.tBody.firstChild) ui.tBody.removeChild(ui.tBody.firstChild);
    run.rows.forEach(function (r) {
      var tr = el("tr", "", "", "");
      [r.t.q, r.t.right + " (" + WRITERS[passage(r.t.right).writer].short + ")", S.mode === "tuned" ? "-" : String(r.rank),
        S.mode === "retrieve" ? (r.inK ? "yes" : "no") : "no retrieval", r.right ? "yes" : "no, " + r.used.id].forEach(function (v, i) {
        tr.appendChild(el("td", i >= 3 ? (v === "yes" ? "mark-ok" : v.indexOf("no") === 0 && v !== "no retrieval" ? "mark-no" : "") : "",
          "padding:2px 6px;" + (i === 0 ? "min-width:200px;" : "white-space:nowrap;"), v));
      });
      ui.tBody.appendChild(tr);
    });
    ui.testLine.textContent = (S.mode === "retrieve" ? "Right passage retrieved in the top " + S.k + ": " + run.hit + " of " + run.n + ". " :
      "No retrieval step to test. ") + "Answered from the right passage: " + run.first + " of " + run.n + ".";
  }

  function costText(S) {
    var tk = tokensFor(cfgOf(S)), s = num(tk) + " input tokens a question; " + NIGHT_QUESTIONS + " questions a night at $" + PRICE +
      " per million: $" + money(nightCents(tk)) + " a night";
    if (S.mode === "whole") {
      s += ", $" + money(questionCents(tk)) + " a question. " + num(tk) + " tokens fit the " + num(WINDOW) +
        "-token window, but are over the " + num(SMALL_KB) + " Anthropic names for sending a whole knowledge base.";
    } else if (S.mode === "tuned") {
      s += ", plus a training run every time the archive changes.";
    } else s += ".";
    return s;
  }

  function hitStat(S) { return S.mode === "retrieve" ? S.run.hit + " of " + S.run.n : "no retrieval"; }

  function draw(api) {
    var S = api.state, tq = test(S.q), a = answerFor(tq, cfgOf(S));
    S.ans = a;
    S.run = testRun(cfgOf(S));
    drawStages(S, a);
    drawPassages(S, a);
    drawAnswer(S, a);
    drawTests(S);
    S.ui.costLine.textContent = costText(S);
    S.stat.top(S.mode === "tuned" ? "no scores" : scoreText(a.h));
    S.stat.who(whoOf(a.used));
    S.stat.hit(hitStat(S));
    S.stat.right(S.run.first + " of " + S.run.n);
    S.stat.tokens(tokensFor(cfgOf(S)));
    S.stat.cost(money(nightCents(tokensFor(cfgOf(S)))));
  }

  /* ---------- narration and controls ---------- */

  function summary(S) {
    var a = S.ans;
    return (a.asked ? "Asked which Winifred, then answered from " : "Answered from ") + a.used.id + ", " + WRITERS[a.used.writer].short +
      "'s " + a.used.kind + " of " + a.used.date + (S.mode === "tuned" ? "" : " (" + scoreText(a.h) + ")") + ". Test set: " +
      (S.mode === "retrieve" ? S.run.hit + " of 6 retrieved, " : "") + S.run.first + " of 6 answered from the right passage; $" +
      money(nightCents(tokensFor(cfgOf(S)))) + " a night.";
  }

  function toneOf(S) { return S.ans.right ? "ok" : "bad"; }

  function change(api, prefix) {
    var S = api.state;
    draw(api);
    api.log(prefix + summary(S), toneOf(S));
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e01", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.q = "t1";
      S.mode = "retrieve";
      S.k = K0;
      S.filter = false;
      S.ask = false;
      S.sources = false;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.q = api.control.select("q", "Question", TESTS.map(function (t) { return { value: t.id, label: t.q }; }), "t1",
        function (v) { if (!test(v)) return; S.q = v; change(api, "Question: " + test(v).q + " "); });
      S.ctl.mode = api.control.select("mode", "Where the knowledge comes from", MODE_KEYS.map(function (k) {
        return { value: k, label: MODES[k] };
      }), "retrieve", function (v) { if (!own(MODES, v)) return; S.mode = v; change(api, cap(MODES[v]) + ". "); });
      S.ctl.k = api.control.range("k", "Top k passages sent", K_MIN, K_MAX, 1, K0, function (v) {
        var n = Math.round(Number(v));
        if (!(n >= K_MIN && n <= K_MAX)) return;
        S.k = n;
        change(api, "Top " + n + ". ");
      });
      S.ctl.filter = api.control.toggle("filter", "Filter by the writer the question names", false, function (v) {
        S.filter = !!v; change(api, "Writer filter " + (S.filter ? "on" : "off") + ". ");
      });
      S.ctl.ask = api.control.toggle("ask", "Ask when a name fits two writers", false, function (v) {
        S.ask = !!v; change(api, "Asking " + (S.ask ? "on" : "off") + ". ");
      });
      S.ctl.sources = api.control.toggle("sources", "Show sources under the answer", false, function (v) {
        S.sources = !!v; change(api, "Sources " + (S.sources ? "shown" : "hidden") + ". ");
      });
      S.ctl.reset = api.control.button("reset", "Reset to Friday", function () { api.reset(); });

      S.stat = {
        top: api.stat("top", "score of the passage answered from", "warn"),
        who: api.stat("who", "who wrote it", ""),
        hit: api.stat("hit", "test set: right passage retrieved", "ok"),
        right: api.stat("right", "test set: answered from the right passage", "ok"),
        tokens: api.stat("tokens", "input tokens per question", ""),
        cost: api.stat("cost", "a night of 60 questions ($)", "warn")
      };

      api.info("<strong>How to read it.</strong> The stages list what each step of the pipeline produced for this question. " +
        "The table ranks the 10 sample passages by cosine similarity: every vector has length 10, so each score is the dot " +
        "product divided by 100. Sent passages go to the stand-in, which answers from the highest-scoring one it was given. " +
        "The writer filter keeps only the writers the question names; when a name fits two writers, asking lets the visitor " +
        "say which. The test set checks retrieval apart from the answer: is the right passage in the top k, and did the answer " +
        "come from it? Tokens and the $2 per million price are teaching values.");
      draw(api);
      api.log("Seven on Saturday morning, Friday's " + SEANCE + " question rerun. " + summary(S), toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function cfg(o) {
        o = o || {};
        return { mode: own(o, "mode") ? o.mode : "retrieve", k: own(o, "k") ? o.k : K0, filter: !!o.filter, ask: !!o.ask,
          sources: !!o.sources };
      }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      function sentIds(r) { return r.sent.map(function (x) { return x.p.id; }); }
      var T1 = test("t1"), ok;

      // 1. The opening state: Friday's settings and Friday's answer, with exact scores.
      await t.run(1);
      var f = answerFor(T1, cfg()), fr = f.ret;
      t.expect(st().q === "t1" && st().mode === "retrieve" && st().k === 5 && !st().filter && !st().ask && !st().sources &&
        t.stat("top") === 0.98 && t.stat("who") === "Winifred Mallender, 1933" && t.stat("hit") === "5 of 6" &&
        t.stat("right") === "3 of 6" && t.stat("tokens") === 1670 && t.stat("cost") === 0.2 &&
        same(sentIds(fr), ["p02", "p03", "p05", "p04", "p06"]) && f.used.id === "p02" && !f.right &&
        fr.rows[5].p.id === "p01" && fr.rows[5].h === 82 && fr.rows[5].status === "not sent" &&
        st().ui.answerLine.textContent === "Answer: " + passage("p02").answer &&
        passage("p02").answer === "I walked him to the gate that night. He pressed my hand and said he would write from the ship." &&
        st().ui.sourceLine.textContent.indexOf("Sources hidden") === 0 &&
        t.logText().indexOf("Answered from p02, the younger Winifred's letter of 9 September 1933 (0.98)") >= 0,
        "the start is Friday's: top 5, no filter, no asking, sources hidden; the five sent are p02, p03, p05, p04 and p06; the elder Winifred's diary is sixth at 0.82 and not sent; the answer is the younger Winifred's farewell at the gate (0.98); the test set 5 of 6 retrieved, 3 of 6 answered right; 1,670 tokens a question, $0.20 a night");

      // 2. The vector arithmetic: every vector has length 10, and every score is the exact dot product / 100.
      ok = PASSAGES.every(function (p) { return sq(p.v) === 100; }) && TESTS.every(function (q) { return sq(q.v) === 100; });
      var friday = fr.rows.map(function (r) { return scoreText(r.h); });
      t.expect(ok && same(friday, ["0.98", "0.94", "0.90", "0.86", "0.84", "0.82", "0.78", "0.64", "0.54", "0.46"]) &&
        same(fr.rows.map(function (r) { return r.p.id; }), ["p02", "p03", "p05", "p04", "p06", "p01", "p07", "p08", "p10", "p09"]) &&
        dot(T1.v, passage("p02").v) === 98 && dot(T1.v, passage("p01").v) === 82 &&
        TESTS.every(function (q) {
          var hs = PASSAGES.map(function (p) { return dot(q.v, p.v); }).sort(function (a, b) { return b - a; }).slice(0, 6);
          return hs.every(function (h, i) { return i === 0 || h !== hs[i - 1]; });
        }),
        "every vector has squared length 100, so cosine similarity is the dot product over 100: Friday's ranking is p02 0.98, p03 0.94, p05 0.90, p04 0.86, p06 0.84, p01 0.82, p07 0.78, p08 0.64, p10 0.54, p09 0.46, with no ties in the top 6 for any test question");

      // 3. Top 50: the right passage is now sent, the answer is unchanged, the cost rises.
      var f50 = answerFor(T1, cfg({ k: 50 })), r50 = testRun(cfg({ k: 50 }));
      t.expect(f50.used.id === "p02" && f50.ret.rows[5].p.id === "p01" && f50.ret.rows[5].status === "sent" &&
        r50.hit === 6 && r50.first === 3 && tokensFor(cfg({ k: 50 })) === 12920 && money(nightCents(12920)) === "1.55",
        "top 50: the elder Winifred's diary is sent at rank 6, the answer still comes from p02 at 0.98; the test set 6 of 6 retrieved but still 3 of 6 answered right; 12,920 tokens a question, $1.55 a night");

      // 4. The filter alone: "Winifred" fits two writers, so both stay in; the answer is unchanged.
      var ff = answerFor(T1, cfg({ filter: true })), rf = testRun(cfg({ filter: true }));
      t.expect(same(sentIds(ff.ret), ["p02", "p03", "p05", "p01", "p07"]) && ff.used.id === "p02" && !ff.asked &&
        ff.ret.rows.filter(function (r) { return r.status === "filtered out"; }).length === 3 && rf.hit === 6 && rf.first === 3,
        "the writer filter alone keeps both Winifreds for Friday's question: p01 moves up to fourth and is sent, but the answer still comes from p02; the test set 6 of 6 retrieved, 3 of 6 answered right");

      // 5. The senior settings: filter, ask and sources, top 5.
      var good = cfg({ filter: true, ask: true, sources: true }), fg = answerFor(T1, good), rg = testRun(good);
      t.expect(fg.asked && fg.used.id === "p01" && fg.right && fg.h === 82 &&
        same(fg.ret.rows.filter(function (r) { return r.allowed; }).map(function (r) { return r.h; }), [82, 78, 64]) &&
        rg.hit === 6 && rg.first === 6 && tokensFor(good) === 1670 && money(nightCents(1670)) === "0.20" &&
        sourceOf(fg.used) === "Winifred Mallender (1852 to 1919), diary, 14 March 1873" &&
        passage("p01").answer === "There was no goodbye. I watched from the landing window, and he did not look back." &&
        testRun(cfg({ ask: true })).first === 6,
        "filter, ask and sources: the stand-in asks which Winifred, the visitor means the elder, and only her passages are searched (0.82, 0.78, 0.64); the answer comes from her diary of 14 March 1873, shown under it; the test set 6 of 6 and 6 of 6, still 1,670 tokens and $0.20 a night; asking alone also gets 6 of 6");

      // 6. The whole archive in the context.
      var w = cfg({ mode: "whole" }), fw = answerFor(T1, w), tw = tokensFor(w);
      t.expect(tw === 690420 && tw < WINDOW && tw > SMALL_KB && money(nightCents(tw)) === "82.85" && money(questionCents(tw)) === "1.38" &&
        fw.used.id === "p02" && testRun(w).first === 3 && testRun(cfg({ mode: "whole", ask: true })).first === 6 &&
        ARCHIVE_TOKENS === 690000,
        "the whole archive: 690,420 tokens a question, inside a 1,000,000-token window but over 200,000; $1.38 a question and $82.85 a night; without asking it still answers from the younger Winifred's letter, 3 of 6; with asking 6 of 6");

      // 7. The fine-tuned stand-in.
      var tu = cfg({ mode: "tuned", filter: true, ask: true, sources: true }), ft = answerFor(T1, tu);
      t.expect(tokensFor(tu) === 420 && money(nightCents(420)) === "0.05" && ft.used.id === "p02" && !ft.asked &&
        testRun(tu).first === 3 && testRun(cfg({ mode: "tuned" })).first === 3,
        "fine-tuned on the archive: 420 tokens a question, $0.05 a night before training runs; it answers from p02 whatever the filter and asking say, 3 of 6, with no sources to show");

      // 8. The test set against an independent recomputation, over every k and setting.
      ok = true;
      for (var k = K_MIN; k <= K_MAX && ok; k++) {
        [[false, false], [true, false], [false, true], [true, true]].forEach(function (fa) {
          var c = cfg({ k: k, filter: fa[0], ask: fa[1] }), run = testRun(c), hit = 0, first = 0;
          TESTS.forEach(function (q) {
            var writers = q.names.length > 1 && fa[1] ? [q.meant] : fa[0] ? q.names : null;
            var list = PASSAGES.filter(function (p) { return !writers || writers.indexOf(p.writer) >= 0; })
              .map(function (p) { return { id: p.id, s: dot(q.v, p.v) }; })
              .sort(function (a, b) { return b.s - a.s; });
            var pos = list.map(function (x) { return x.id; }).indexOf(q.right);
            if (pos >= 0 && pos < k) hit++;
            if (pos === 0) first++;
          });
          if (run.hit !== hit || run.first !== first) ok = false;
        });
      }
      var r1 = testRun(cfg({ k: 1 }));
      t.expect(ok && r1.hit === 3 && r1.first === 3 && testRun(cfg()).rows[0].rank === 6,
        "the test set matches an independent recomputation for every k from 1 to 50 with the filter and asking on or off; at top 1 it is 3 and 3; Friday's right passage ranks sixth");

      // 9. Story numbers.
      t.expect(ITEMS === 2300 && ALL_PASSAGES === 2760 && PASSAGE_TOKENS === 250 && ARCHIVE_TOKENS === 690000 &&
        SYSTEM_TOKENS === 400 && QUESTION_TOKENS === 20 && NIGHT_QUESTIONS === 60 && PRICE === 2 && K0 === 5 &&
        LEFT_YOUNGER - LEFT_ELDER === 60 && SEANCE === "21:40" && START_CLOCK === 25200 &&
        WRITERS.elder.name === WRITERS.younger.name && WRITERS.elder.life === "1852 to 1919" && WRITERS.younger.life === "1911 to 1990" &&
        passage("p01").date === "14 March 1873" && passage("p02").date === "9 September 1933" && passage("p06").text.indexOf("4s") >= 0 &&
        passage("p09").text.indexOf("Aunt Winifred") >= 0 && askText().indexOf("1868 to 1919") >= 0 && askText().indexOf("1925 to 1938") >= 0 &&
        money(nightCents(1670)) === "0.20",
        "story numbers: 2,300 items, 2,760 passages of 250 tokens, 690,000 tokens; a 400-token system prompt and a 20-token question; 60 questions a night at $2 per million; top 5; two brothers who left in 1873 and 1933, sixty years apart; two Winifred Mallenders, 1852 to 1919 and 1911 to 1990; the séance at 21:40 and Saturday at seven");

      // 10. The controls.
      t.set("k", 50);
      var v1 = t.stat("hit") === "6 of 6" && t.stat("right") === "3 of 6" && t.stat("tokens") === 12920 && t.stat("cost") === 1.55 &&
        t.stat("top") === 0.98;
      t.set("k", 5);
      t.set("filter", true);
      t.set("ask", true);
      t.set("sources", true);
      var v2 = t.stat("top") === 0.82 && t.stat("who") === "Winifred Mallender, 1873" && t.stat("hit") === "6 of 6" &&
        t.stat("right") === "6 of 6" && t.stat("cost") === 0.2 &&
        st().ui.askLine.textContent.indexOf("The stand-in asks: Which Winifred do you mean") === 0 &&
        st().ui.sourceLine.textContent.indexOf("Source: Winifred Mallender (1852 to 1919), diary, 14 March 1873") === 0 &&
        st().ui.answerLine.className === "mark-ok";
      t.set("mode", "whole");
      var v3 = t.stat("tokens") === 690420 && t.stat("cost") === 82.85 && t.stat("hit") === "no retrieval" && t.stat("right") === "6 of 6";
      t.set("mode", "tuned");
      var v4 = t.stat("tokens") === 420 && t.stat("cost") === 0.05 && t.stat("top") === "no scores" && t.stat("right") === "3 of 6" &&
        st().ui.sourceLine.textContent.indexOf("Sources: none") === 0;
      t.set("mode", "retrieve");
      t.set("q", "t4");
      var v5 = t.stat("who") === "Harriet Mallender, 1873" && t.stat("top") === 0.98 && st().ui.askLine.textContent === "";
      t.click("reset");
      await t.run(1);
      var v6 = st().q === "t1" && st().k === 5 && !st().filter && !st().ask && t.stat("top") === 0.98 && t.stat("right") === "3 of 6";
      t.expect(v1 && v2 && v3 && v4 && v5 && v6,
        "the controls: top 50 gives 6 of 6 retrieved, 3 of 6 right, 12,920 tokens, $1.55; filter, ask and sources answer from the elder Winifred's 1873 diary at 0.82, 6 of 6 and 6 of 6, $0.20, with the question and the source shown; the whole archive 690,420 tokens, $82.85; fine-tuned 420 tokens, $0.05, no scores, no sources, 3 of 6; Harriet's cab question answers from her accounts with no asking; reset returns to Friday");
    }
  });
})();
