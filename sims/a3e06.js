/* sims/a3e06-v1.0.0.js  (published as sims/a3e06.js)
   Case a3e06 "Show Your Sources" (LATENT Season 3): a grounding lab for the Polglase Verbatim
   transcript assistant. No real model. A stated page of a deposition transcript (page 41, twelve
   speaker turns), a stated set of eight questions, and a deterministic stand-in that writes answers
   from the chunks it is given, by stated rules. The learner changes the chunking, citations, the
   quote check, "not found", the temperature, a prompt line and a hand check, and reads each answer,
   the spans it cites, what the checks struck, and faithfulness on the set. Widget-style sim: it
   builds its own panel inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: chunking (240 characters with no speaker labels, or one block
     per speaker turn), citations, quote check, "not found" allowed, temperature 0 / 0.7 / 1, the
     prompt line "never invent quotes", a stenographer's hand check, and a question picker. Stats:
     faithfulness on the set, honest "not found", answerable questions left unanswered, quotes struck
     by the check, claims struck by hand, wordings in 5 reruns, stenographer time a night.
     selfTest: 10 assertions.

   The model (stated in sim.lede):
   - TURNS: page 41, lines 2 to 24. Each turn takes two lines, the speaker's name and then the
     words, and a turn is cited by its first line. Even lines: Mr Carveth asks (2, 6, 10, 14, 18,
     22), Mrs Tresidder answers (4, 8, 12, 16, 20, 24).
   - Characters: the words of all twelve turns joined with single spaces, 631 characters, no names,
     cut every 240 characters into 3 pieces (0-239, 240-479, 480-630). Turns: 12 blocks, each
     "NAME: words", line kept with the block.
   - The stand-in's own quotation of an answer ("free quote"):
       a stitch, when the question has one and both phrases lie in one character piece: Q1 joins
       "I saw the blue car" (line 14, Mr Carveth reading the driver's statement) and "at ten to
       nine" (line 12, Mrs Tresidder): "I saw the blue car at ten to nine", cited at line 12, the
       line of the last words it used;
       a drift, when the question has one: Q2 drops the hedge ("It was raining"), Q3 adds words
       ("Just after nine, by the church clock");
       otherwise the exact phrase.
   - Citations off: the answer's claim is the free quote. Citations on: the claim is the exact
     phrase, and its cited text is copied from the source: the sentence holding it (character
     pieces, sent as plain text, are cited by sentence) or the whole block (turns). If the free
     quote differs from the exact phrase, the stand-in's prose still carries it as a second claim.
   - No answer in the transcript (Q6, Q7): in character pieces, a lure it can't tell apart from the
     witness (Q7: "I saw the blue car at the corner", line 14) is used whatever the settings. Else,
     with "not found" allowed it says not found; otherwise it writes its guess (Q6: "the cyclist in
     a yellow coat", line 24; Q7 in blocks: the line-14 words, attributed to the witness).
   - Supported (the faithfulness judge): the quoted words appear in Mrs Tresidder's own turn at the
     cited line. Faithfulness = supported claims / claims sent, over the eight questions.
   - Quote check: character pieces can only confirm the words occur somewhere in the 631 characters;
     blocks confirm them inside the cited line's block, and that the block is the witness's.
     A claim that fails is struck. Hand check: a stenographer strikes every unsupported claim.
     An answer left with no claim says "not found" if allowed, or sends nothing.
   - Temperature changes only the opening words: at 0 every rerun uses wording 1; above 0, rerun i
     uses wording (i mod 3) + 1. The claims never change. The prompt line changes nothing the
     stand-in can see: it already believes every quote it writes is on the page.
   - Hand check time: 160 answers a night x 3 minutes = 480 min = 8 h 0 min.

   Where every number comes from (conventions rule 14; the case is
   content/latent/a3/a3e06-v1.0.0.json). Worked out from the model above and checked by selfTest.
   - The night (characters, citations off, no check, no "not found", temperature 0.7): Q1
     "I saw the blue car at ten to nine" (p. 41, l. 12). Supported: Q4, Q5, Q8 only: 3 of 8 (38%).
   - Temperature 0 or 1, or the prompt line: still 3 of 8; wordings in 5 reruns 1 at 0, 3 above 0.
   - Blocks only: 4 of 8 (Q1 now right). Blocks + citations: 6 of 10. + quote check: 6 of 6,
     4 struck, Q6 and Q7 send nothing. + "not found": 6 of 6, 2 struck, not found 2 of 2.
   - Blocks + citations + "not found", no check: 6 of 8 (the two drifted prose quotes).
   - Characters with citations, check and "not found": 6 of 7, not found 1 of 2 (Q7's lure passes a
     check that can't see speakers).
   - Characters + check only: 3 of 4, 4 struck, 3 answerable questions left unanswered.
   - Characters + hand check: 3 of 3, 5 struck by hand, 3 left unanswered, 8 h 0 min a night.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var PAGE = 41;
  var CHARS = 240;
  var CV = "MR CARVETH";
  var TR = "MRS TRESIDDER";
  var TURNS = [
    [2, CV, "Where were you at a quarter to nine that morning?"],
    [4, TR, "At the bakery on Bossiney Row, buying bread for my mother."],
    [6, CV, "Could you see the junction from the bakery?"],
    [8, TR, "Through the window, yes. I think it might have been raining."],
    [10, CV, "Did you see any car on Bossiney Row before nine?"],
    [12, TR, "No. I was at the counter with my back to the road. I never saw a car at ten to nine."],
    [14, CV, "The driver's statement says, I saw the blue car at the corner. Were you at the corner?"],
    [16, TR, "No. I stayed inside until I heard the bang."],
    [18, CV, "What time was the bang?"],
    [20, TR, "Just after nine. The church clock had gone."],
    [22, CV, "And when you went out?"],
    [24, TR, "I went out and saw the cyclist on the ground by the post box."]
  ].map(function (r) { return { l: r[0], who: r[1], w: r[1] === TR, text: r[2] }; });
  var JOINED = TURNS.map(function (t) { return t.text; }).join(" ");

  var QS = [
    { q: "Did the witness see the car before nine?", ans: [5, "I never saw a car at ten to nine"],
      stitch: [[6, "I saw the blue car"], [5, "at ten to nine"]], yes: "Yes.", no: "No." },
    { q: "Was it raining when she looked out?", ans: [3, "I think it might have been raining"],
      drift: "It was raining", yes: "Yes.", no: "Perhaps." },
    { q: "What time was the bang?", ans: [9, "Just after nine"], drift: "Just after nine, by the church clock", yes: "", no: "" },
    { q: "Where was she at a quarter to nine?", ans: [1, "At the bakery on Bossiney Row"], yes: "", no: "" },
    { q: "Was she at the corner?", ans: [7, "I stayed inside until I heard the bang"], yes: "No.", no: "No." },
    { q: "What colour was the cyclist's coat?", guess: [11, "the cyclist in a yellow coat"], yes: "Yellow.", no: "Yellow." },
    { q: "Did she see the driver?", lure: [6, "I saw the blue car at the corner"], guess: [6, "I saw the blue car at the corner"], yes: "Yes.", no: "Yes." },
    { q: "What did she see when she went out?", ans: [11, "the cyclist on the ground by the post box"], yes: "", no: "" }
  ];
  var WORDINGS = ["The witness said,", "She told counsel,", "In her words,"];
  var TEMPS = ["0", "0.7", "1"];
  var NIGHT_ANSWERS = 160;
  var MIN_PER_CHECK = 3;

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function startOf(t) { var p = 0; for (var i = 0; i < t; i++) p += TURNS[i].text.length + 1; return p; }
  function piecesOf(t, ph) {
    var s = startOf(t) + TURNS[t].text.indexOf(ph);
    return [Math.floor(s / CHARS), Math.floor((s + ph.length - 1) / CHARS)];
  }
  function onePiece(a, b) {
    var x = piecesOf(a[0], a[1]);
    var y = piecesOf(b[0], b[1]);
    return x[0] === x[1] && y[0] === y[1] && x[0] === y[0];
  }
  function sentences(s) {
    var out = [];
    var cur = "";
    for (var i = 0; i < s.length; i++) {
      cur += s.charAt(i);
      if (/[.?!]/.test(s.charAt(i)) && (i + 1 === s.length || s.charAt(i + 1) === " ")) { out.push(cur.trim()); cur = ""; }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function citedText(C, t, ph) {
    if (C.chunk === "turns") return TURNS[t].who + ": " + TURNS[t].text;
    var ss = sentences(TURNS[t].text);
    for (var i = 0; i < ss.length; i++) if (ph && ss[i].indexOf(ph) >= 0) return ss[i];
    return ss[0];
  }
  function turnAt(l) { for (var i = 0; i < TURNS.length; i++) if (TURNS[i].l === l) return i; return -1; }
  function supported(c) { var t = TURNS[turnAt(c.line)]; return !!t && t.w && t.text.indexOf(c.quote) >= 0; }
  function passes(C, c) { return C.chunk === "chars" ? JOINED.indexOf(c.quote) >= 0 : supported(c); }

  function answer(q, C) {
    var claims = [];
    var r = { claims: claims, nf: false, empty: false, struck: 0, hand: 0, first: "" };
    if (q.ans) {
      var line = TURNS[q.ans[0]].l;
      var fq;
      if (q.stitch && C.chunk === "chars" && onePiece(q.stitch[0], q.stitch[1])) {
        fq = { quote: q.stitch[0][1] + " " + q.stitch[1][1], line: TURNS[q.stitch[1][0]].l, kind: "stitch" };
      } else if (q.drift) fq = { quote: q.drift, line: line, kind: "drift" };
      else fq = { quote: q.ans[1], line: line, kind: "free" };
      if (C.cite) {
        claims.push({ quote: q.ans[1], line: line, cited: citedText(C, q.ans[0], q.ans[1]), kind: "cited" });
        if (fq.quote !== q.ans[1]) claims.push(fq);
      } else claims.push(fq);
    } else if (C.chunk === "chars" && q.lure) {
      claims.push({ quote: q.lure[1], line: TURNS[q.lure[0]].l, cited: C.cite ? citedText(C, q.lure[0], q.lure[1]) : null, kind: "lure" });
    } else if (C.nf) {
      r.nf = true;
    } else {
      claims.push({ quote: q.guess[1], line: TURNS[q.guess[0]].l, cited: C.cite ? citedText(C, q.guess[0], "") : null, kind: "guess" });
    }
    r.first = claims.length ? claims[0].kind : "";
    var i;
    if (C.check) for (i = claims.length - 1; i >= 0; i--) if (!passes(C, claims[i])) { claims.splice(i, 1); r.struck += 1; }
    if (C.hand) for (i = claims.length - 1; i >= 0; i--) if (!supported(claims[i])) { claims.splice(i, 1); r.hand += 1; }
    if (!claims.length && !r.nf) { if (C.nf) r.nf = true; else r.empty = true; }
    return r;
  }

  function score(C) {
    var s = { sup: 0, n: 0, nf: 0, lost: 0, struck: 0, hand: 0, answers: [] };
    QS.forEach(function (q) {
      var a = answer(q, C);
      s.answers.push(a);
      a.claims.forEach(function (c) { s.n += 1; if (supported(c)) s.sup += 1; });
      if (!q.ans && a.nf) s.nf += 1;
      if (q.ans && (a.nf || a.empty)) s.lost += 1;
      s.struck += a.struck;
      s.hand += a.hand;
    });
    return s;
  }
  function faithText(s) { return s.sup + " of " + s.n + " (" + (s.n ? Math.round(s.sup * 100 / s.n) : 0) + "%)"; }
  function wordingsIn5(C) { return C.temp === "0" ? 1 : 3; }

  function answerText(q, a, C) {
    if (a.nf) return "Not found: this transcript page does not answer the question.";
    if (a.empty) return "(nothing sent: every quotation was struck)";
    var bad = { stitch: true, lure: true, guess: true, drift: true };
    var lead = bad[a.first] ? q.yes : q.no;
    var parts = a.claims.map(function (c, k) {
      return (k ? "Also: " : WORDINGS[0] + " ") + "\"" + c.quote + "\" (p. " + PAGE + ", l. " + c.line + ").";
    });
    return (lead ? lead + " " : "") + parts.join(" ");
  }
  function settingsText(C) {
    return (C.chunk === "chars" ? "240-character pieces, no speaker names" : "one block per speaker turn") +
      ", citations " + (C.cite ? "on" : "off") + ", quote check " + (C.check ? "on" : "off") +
      ", \"not found\" " + (C.nf ? "allowed" : "not allowed") + ", temperature " + C.temp +
      (C.prompt ? ", prompt says never invent quotes" : "") + (C.hand ? ", hand check on" : "");
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
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var ask = el("p", "margin:0;font-weight:600;");
    var ans = el("p", "margin:0;padding:6px 8px;border:1px solid currentColor;border-radius:6px;");
    var checks = el("ul", "margin:0;padding-left:18px;");
    var given = el("div", "margin:0;");
    var table = el("table", "width:100%;border-collapse:collapse;");
    var hr = el("tr");
    ["page, line", "speaker", "words", "this answer"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    var setT = el("table", "width:100%;border-collapse:collapse;");
    var sh = el("tr");
    ["#", "question", "sent", "supported"].forEach(function (h) { sh.appendChild(el("th", "text-align:left;", h)); });
    var sthead = el("thead");
    sthead.appendChild(sh);
    setT.appendChild(sthead);
    var sbody = el("tbody");
    setT.appendChild(sbody);
    [head, ask, ans, checks, el("p", "margin:4px 0 0;font-weight:600;", "What the stand-in was given"), given,
      el("p", "margin:4px 0 0;font-weight:600;", "Page 41 as spoken"), table,
      el("p", "margin:4px 0 0;font-weight:600;", "The eight-question set"), setT].forEach(function (n) { box.appendChild(n); });
    api.root.appendChild(box);
    return { el: el, head: head, ask: ask, ans: ans, checks: checks, given: given, tbody: tbody, sbody: sbody };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var el = ui.el;
    var s = score(C);
    S.score = s;
    var q = QS[C.q];
    var a = s.answers[C.q];
    S.answerText = answerText(q, a, C);
    ui.head.textContent = "Settings: " + settingsText(C) + ".";
    ui.ask.textContent = "Q" + (C.q + 1) + ". " + q.q;
    ui.ans.textContent = S.answerText;

    while (ui.checks.firstChild) ui.checks.removeChild(ui.checks.firstChild);
    var lines = [];
    a.claims.forEach(function (c) {
      lines.push("\"" + c.quote + "\" at line " + c.line + ": " + (supported(c) ? "supported, in the witness's own words" : "NOT supported: not the witness's words at that line") +
        (c.cited ? ". Cited text: \"" + c.cited + "\"" : ". No cited span: the stand-in wrote this quotation itself"));
    });
    if (a.struck) lines.push("The quote check struck " + a.struck + (a.struck === 1 ? " quotation." : " quotations."));
    if (a.hand) lines.push("The hand check struck " + a.hand + (a.hand === 1 ? " claim." : " claims."));
    if (!lines.length) lines.push(q.ans ? "No claim was sent for a question the page does answer." : "The page holds no answer, and none was claimed.");
    lines.forEach(function (t) { ui.checks.appendChild(el("li", "", t)); });

    while (ui.given.firstChild) ui.given.removeChild(ui.given.firstChild);
    if (C.chunk === "chars") {
      for (var k = 0; k * CHARS < JOINED.length; k++) {
        ui.given.appendChild(el("p", "margin:2px 0;font-family:monospace;", "piece " + (k + 1) + ": " + JOINED.slice(k * CHARS, (k + 1) * CHARS)));
      }
    } else {
      ui.given.appendChild(el("p", "margin:2px 0;", "12 blocks, one per speaker turn, each starting with the speaker's name, page 41 and its line kept with it."));
    }

    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    TURNS.forEach(function (t) {
      var mark = [];
      a.claims.forEach(function (c) {
        if (c.line === t.l) mark.push(supported(c) ? "quoted, as said" : "quoted, never said here");
        if (c.cited && TURNS[turnAt(c.line)] === t) mark.push("cited span");
      });
      var tr = el("tr", mark.length ? "font-weight:600;" : "");
      [PAGE + ", " + t.l, t.who, t.text, mark.join("; ")].forEach(function (x) { tr.appendChild(el("td", "", x)); });
      ui.tbody.appendChild(tr);
    });

    while (ui.sbody.firstChild) ui.sbody.removeChild(ui.sbody.firstChild);
    QS.forEach(function (qq, i) {
      var aa = s.answers[i];
      var sup = 0;
      aa.claims.forEach(function (c) { if (supported(c)) sup += 1; });
      var sent = aa.nf ? "not found" : (aa.empty ? "nothing" : aa.claims.length + (aa.claims.length === 1 ? " claim" : " claims"));
      var tr = el("tr", i === C.q ? "font-weight:600;" : "");
      ["Q" + (i + 1), qq.q, sent, aa.nf || aa.empty ? "-" : sup + " of " + aa.claims.length].forEach(function (x) { tr.appendChild(el("td", "", x)); });
      ui.sbody.appendChild(tr);
    });

    S.stat.faith(faithText(s));
    S.stat.notfound(s.nf + " of 2");
    S.stat.lost(s.lost);
    S.stat.struck(s.struck);
    S.stat.hand(s.hand);
    S.stat.wordings(wordingsIn5(C));
    S.stat.steno(C.hand ? Math.floor(NIGHT_ANSWERS * MIN_PER_CHECK / 60) + " h " + (NIGHT_ANSWERS * MIN_PER_CHECK % 60) + " min" : "none");
  }

  // Logs describe the state before the change, then what it became.
  function change(api, what) {
    var S = api.state;
    var before = faithText(S.score);
    draw(api);
    var after = faithText(S.score);
    api.log(what + " Faithfulness on the set was " + before + ", now " + after + ". Q" + (S.C.q + 1) + ": " + S.answerText,
      S.score.n && S.score.sup === S.score.n ? "ok" : "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { chunk: "chars", cite: false, check: false, nf: false, temp: "0.7", prompt: false, hand: false, q: 0 };
      S.ui = buildWidget(api);
      S.stat = {
        faith: api.stat("faith", "faithfulness on the set (supported claims)", "bad"),
        notfound: api.stat("notfound", "honest \"not found\" (of 2 unanswerable)", "ok"),
        lost: api.stat("lost", "answerable questions left unanswered", "warn"),
        struck: api.stat("struck", "quotations struck by the quote check", ""),
        hand: api.stat("byhand", "claims struck by hand", ""),
        wordings: api.stat("wordings", "different wordings in 5 reruns", ""),
        steno: api.stat("steno", "stenographer time a night", "warn")
      };
      api.control.select("q", "Question", QS.map(function (x, i) { return { value: String(i), label: "Q" + (i + 1) + ". " + x.q }; }), "0", function (v) {
        var x = Number(v);
        if (!(x >= 0 && x < QS.length)) return;
        S.C.q = x;
        draw(api);
        api.log("Q" + (x + 1) + ": " + S.answerText, "");
      });
      api.control.select("chunk", "Chunking", [
        { value: "chars", label: "Every 240 characters, no speaker names" },
        { value: "turns", label: "One block per speaker turn" }], "chars", function (v) {
        S.C.chunk = String(v) === "turns" ? "turns" : "chars";
        change(api, "Chunking: " + (S.C.chunk === "turns" ? "one block per speaker turn." : "every 240 characters, no names."));
      });
      api.control.toggle("cite", "Citations (cited text copied from the source)", false, function (on) {
        S.C.cite = !!on;
        change(api, "Citations " + (on ? "on." : "off."));
      });
      api.control.toggle("check", "Quote check (string match against the transcript)", false, function (on) {
        S.C.check = !!on;
        change(api, "Quote check " + (on ? "on." : "off."));
      });
      api.control.toggle("nf", "Allow \"not found\"", false, function (on) {
        S.C.nf = !!on;
        change(api, "\"Not found\" " + (on ? "allowed." : "not allowed."));
      });
      api.control.select("temp", "Temperature", TEMPS.map(function (x) { return { value: x, label: x }; }), "0.7", function (v) {
        if (TEMPS.indexOf(String(v)) < 0) return;
        S.C.temp = String(v);
        change(api, "Temperature " + S.C.temp + ": " + wordingsIn5(S.C) + (wordingsIn5(S.C) === 1 ? " wording" : " wordings") + " in 5 reruns, the same quotations.");
      });
      api.control.toggle("prompt", "Prompt line: never invent quotes", false, function (on) {
        S.C.prompt = !!on;
        change(api, "Prompt line " + (on ? "added" : "removed") + ": the stand-in already believes every quote it writes is on the page.");
      });
      api.control.toggle("hand", "A stenographer checks every answer by hand", false, function (on) {
        S.C.hand = !!on;
        change(api, "Hand check " + (on ? "on: 160 answers a night at 3 minutes each." : "off."));
      });
      api.control.button("reset", "Back to the night", function () { api.reset(); });

      api.info("<strong>How to read it.</strong> The stand-in is not a model: it follows the rules in the lede. Pick a question to see its answer, the claims in it, and where each claim points on page 41. A claim is supported only if the quoted words are Mrs Tresidder's own, at the line given. Faithfulness counts supported claims over all claims sent for the eight questions.");

      draw(api);
      api.log("The night: " + settingsText(S.C) + ". Q1: " + S.answerText + " Faithfulness on the set: " + faithText(S.score) + ".", "bad");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(x) { return t.logText().slice(mark).indexOf(x) >= 0; }
      function st() { return t.api.state; }

      // 1. The night: the stitched quotation with page and line, 3 of 8.
      t.expect(t.stat("faith") === "3 of 8 (38%)" && t.stat("notfound") === "0 of 2" && t.stat("lost") === 0 && t.stat("struck") === 0 &&
        t.stat("wordings") === 3 && t.stat("steno") === "none" &&
        st().answerText === "Yes. The witness said, \"I saw the blue car at ten to nine\" (p. 41, l. 12)." &&
        TURNS[turnAt(12)].text.indexOf("I never saw a car at ten to nine") >= 0 && TURNS[turnAt(14)].text.indexOf("I saw the blue car") >= 0,
        "Opens on the night: Q1 answers \"I saw the blue car at ten to nine\" (p. 41, l. 12), a line nobody spoke; faithfulness 3 of 8");

      // 2. Temperature changes wording, never faithfulness.
      t.set("temp", "0");
      var z = t.stat("faith") === "3 of 8 (38%)" && t.stat("wordings") === 1 && st().answerText.indexOf("I saw the blue car at ten to nine") >= 0;
      t.set("temp", "1");
      t.expect(z && t.stat("faith") === "3 of 8 (38%)" && t.stat("wordings") === 3,
        "Temperature 0: one wording in 5 reruns, the same stitched quote, still 3 of 8; temperature 1: 3 wordings, 3 of 8");
      t.set("temp", "0.7");

      // 3. The prompt line changes nothing the stand-in can see.
      begin();
      t.set("prompt", true);
      t.expect(t.stat("faith") === "3 of 8 (38%)" && has("was 3 of 8 (38%), now 3 of 8 (38%)") && st().answerText.indexOf("blue car at ten to nine") >= 0,
        "Prompt line never invent quotes: the stitched quote stays, 3 of 8");
      t.set("prompt", false);

      // 4. Blocks per speaker turn: the stitch can't form.
      t.set("chunk", "turns");
      t.expect(t.stat("faith") === "4 of 8 (50%)" && st().answerText === "No. The witness said, \"I never saw a car at ten to nine\" (p. 41, l. 12).",
        "One block per speaker turn: Q1 quotes line 12 as spoken; 4 of 8, the drifted quotes and guesses remain");

      // 5. Citations on: every answer carries its exact span, but prose quotes and guesses remain.
      t.set("cite", true);
      t.expect(t.stat("faith") === "6 of 10 (60%)", "Blocks and citations: 6 of 10");

      // 6. Quote check: drifts and guesses are struck; unanswerable questions send nothing.
      t.set("check", true);
      t.expect(t.stat("faith") === "6 of 6 (100%)" && t.stat("struck") === 4 && t.stat("notfound") === "0 of 2" && t.stat("lost") === 0,
        "Blocks, citations and quote check: 6 of 6, 4 quotations struck, Q6 and Q7 send nothing");

      // 7. Allow not found: the senior setup.
      t.set("nf", true);
      t.set("q", "5");
      var q6 = st().answerText.indexOf("Not found") === 0;
      t.set("q", "0");
      t.expect(q6 && t.stat("faith") === "6 of 6 (100%)" && t.stat("notfound") === "2 of 2" && t.stat("struck") === 2 && t.stat("lost") === 0 &&
        st().score.answers[0].claims[0].cited === "MRS TRESIDDER: No. I was at the counter with my back to the road. I never saw a car at ten to nine.",
        "Blocks, citations, quote check, not found: 6 of 6, not found 2 of 2, Q1 cites Mrs Tresidder's whole turn at line 12");

      // 8. Same settings, character pieces: the check can't see who spoke.
      t.set("chunk", "chars");
      t.set("q", "6");
      t.expect(t.stat("faith") === "6 of 7 (86%)" && t.stat("notfound") === "1 of 2" && st().answerText.indexOf("\"I saw the blue car at the corner\" (p. 41, l. 14)") >= 0,
        "Everything on but 240-character pieces: Q7 claims counsel's line 14 as the witness's; 6 of 7, not found 1 of 2");
      t.set("q", "0");

      // 9. The night plus a quote check only.
      t.set("cite", false);
      t.set("nf", false);
      t.expect(t.stat("faith") === "3 of 4 (75%)" && t.stat("struck") === 4 && t.stat("lost") === 3 && st().answerText.indexOf("nothing sent") >= 0,
        "Night plus quote check: 3 of 4, 4 struck, 3 answerable questions (Q1 among them) left unanswered");

      // 10. The night plus a stenographer's hand check.
      t.set("check", false);
      t.set("hand", true);
      t.expect(t.stat("faith") === "3 of 3 (100%)" && t.stat("byhand") === 5 && t.stat("lost") === 3 && t.stat("steno") === "8 h 0 min",
        "Night plus hand check: 3 of 3 sent, 5 claims struck by hand, 3 questions unanswered, 8 h 0 min a night");
    }
  });
})();
