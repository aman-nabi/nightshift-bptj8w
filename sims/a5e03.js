/* sims/a5e03-v1.0.0.js  (published as sims/a5e03.js)
   Case a5e03 "Faithful or Fabricated": a RAG scorecard for Wyvernhold Home Insurance's drafting
   assistant. Ten customer questions that Tryphena, the night claims adjuster, labelled: for each,
   the passages that hold the answer and the claims a correct answer makes. Each question has a
   stated ranked list of 8 passages, tonight's drafted answer split into claims, three stated
   cosine scores for answer relevance, and a stated confidence from a second model. The learner
   picks k (passages retrieved), the prompt line, whose labels judge the claims (the adjuster's or
   the automated check's), a metric and a question. No real model and no real search: every list,
   claim and score below is stated data. Widget-style sim: it draws its own tables in api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: 14 passages, 10 labelled questions, context precision,
     context recall, faithfulness and answer relevance, overall and per question; the automated
     faithfulness check against the adjuster's labels; the prompt line; a reply preset for each of
     the four options. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Context precision at k, one question = passages in the top k that the adjuster labelled
     relevant / k (the plain share; the RAGAS library's form also weights by rank).
   - Context recall at k, one question = claims of the correct answer whose passage is in the top
     k / claims of the correct answer (the RAGAS docs: reference claims supported by the
     retrieved context / all reference claims).
   - Faithfulness, one question = the draft's supported claims / the draft's claims (a3e06). A
     claim is supported when the adjuster (or, with the grader switched, the automated check)
     marked it so. Drafts were written from tonight's top 4 and don't change with k.
   - Answer relevance, one question = the mean of 3 stated cosine scores: each compares the real
     question with a question the answer looks like it is answering (Es et al.'s method).
   - Every overall score is the plain mean over the 10 questions. Rounding to 2 places, half up.
   - The prompt line ("answer only from the documents provided") has one stated effect: in Q1 the
     draft drops its two claims with no passage behind them. Q4 and Q9 keep theirs.

   Where every number comes from (conventions rule 14; the case is content/latent/a5/a5e03-v1.0.0.json).
   - Q1 (Mr Gwinnett, flood): top 4 W4.2, W4.1, W2.1, W8.3; E17 6th. Relevant W4.2, E17.
     Correct-answer claims: wording covers flood (W4.2); Endorsement 17 removes it (E17).
     Context recall at 4: 1 of 2 = 0.50. Context precision at 4: 1 / 4 = 0.25. Draft claims: covers
     flood (W4.2, supported), up to £25,000 (no passage), section 4.2 of a Flood Cover Addendum (no
     such document). Faithfulness 1 of 3 = 0.33. Answer relevance (0.98 + 0.96 + 0.97) / 3 = 0.97.
     Confidence 0.93.
   - Context precision at 4, Q1 to Q10: 1, 2, 2, 1, 1, 1, 2, 1, 2, 1 relevant of 4: 14 / 40 = 0.35.
     At 8: 2, 2, 2, 2, 1, 1, 2, 1, 2, 1 of 8: 16 / 80 = 0.20.
   - Context recall at 4: Q1 0.50 (E17 6th), Q4 0.50 (schedule 5th), others 1: 9 / 10 = 0.90.
     At 5: 0.95. At 6 to 8: 1.00.
   - Faithfulness, adjuster: Q1 1/3, Q4 1/2 (laptop cover claim unsupported), Q9 1/2 (£1,000 for
     a bicycle in no passage), others 1: 8.33 / 10 = 0.83. Automated check: Q1 1/3, Q4 2/2, Q7 1/2
     (it misses "empty" for "unoccupied"), Q9 1/2: also 0.83. Claims agreeing: 18 of 20.
   - Prompt line on: Q1 keeps 1 claim, supported: 1.00. Faithfulness 0.90 (both graders);
     claims agreeing 16 of 18. Context recall unchanged, 0.90.
   - Answer relevance per question: 0.97, 0.95, 0.90, 0.94, 0.93, 0.96, 0.92, 0.95, 0.94, 0.94:
     9.40 / 10 = 0.94.
   - Confidence below 0.70 goes to an adjuster: only Q9 (0.64). Q1 0.93 and Q4 0.88 go out.
   - The adjuster marked 3 drafts wrong: Q1, Q4, Q9.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var PASS = {
    "W2.1": "Wording 2.1, buildings: the structure of your home is covered.",
    "W3.1": "Wording 3.1, escape of water: damage from a burst or leaking pipe is covered.",
    "W3.4": "Wording 3.4, trace and access: finding and reaching a leak, up to £5,000.",
    "W4.1": "Wording 4.1, storm: storm damage is covered; fences, gates and hedges are not.",
    "W4.2": "Wording 4.2, flood: damage by flood is covered. (It names no figure.)",
    "W4.5": "Wording 4.5, subsidence: covered; the excess for subsidence is £1,000.",
    "W5.1": "Wording 5.1, contents: your belongings inside the home are covered.",
    "W5.6": "Wording 5.6, possessions away from home: covered only if your schedule shows it.",
    "W6.2": "Wording 6.2, accidental damage: covered only if your schedule shows it.",
    "W7.1": "Wording 7.1, somewhere to stay: paid while your home can't be lived in.",
    "W8.3": "Wording 8.3, making a claim: tell us within 30 days.",
    "W9.2": "Wording 9.2, unoccupied homes: no escape of water cover once unoccupied more than 60 days in a row.",
    "SCH": "The asking customer's own schedule: their excess, optional covers bought, endorsements by number.",
    "E17": "Endorsement 17: section 4.2 is deleted for homes in the postcodes listed, Steadfold's among them."
  };

  var QS = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"];

  // label, ranked passages (8), relevant passages, correct-answer claims [text, passage],
  // draft claims [text, passage or "", adjuster supported, check supported, dropped by the prompt line],
  // three cosine scores, confidence, adjuster's verdict on the draft.
  var Q = {
    Q1: {
      label: "Q1: Mr Gwinnett tonight: does my policy cover flood damage?",
      rank: ["W4.2", "W4.1", "W2.1", "W8.3", "W3.1", "E17", "SCH", "W7.1"],
      rel: ["W4.2", "E17"],
      ref: [["The wording covers flood (section 4.2)", "W4.2"], ["Endorsement 17 removes flood cover at his postcode", "E17"]],
      claims: [["Your policy covers flood damage.", "W4.2", true, true, false],
        ["Cover is up to £25,000.", "", false, false, true],
        ["This is set out in section 4.2 of your Flood Cover Addendum.", "", false, false, true]],
      cos: [0.98, 0.96, 0.97], conf: 0.93, verdict: "wrong"
    },
    Q2: {
      label: "Q2: a pipe burst under my kitchen floor; am I covered, and for finding the leak?",
      rank: ["W3.1", "W3.4", "W2.1", "W9.2", "W6.2", "SCH", "W8.3", "W5.1"],
      rel: ["W3.1", "W3.4"],
      ref: [["Burst pipe damage is covered", "W3.1"], ["Finding the leak is covered up to £5,000", "W3.4"]],
      claims: [["Damage from a burst pipe is covered.", "W3.1", true, true, false],
        ["Finding and reaching the leak is covered up to £5,000.", "W3.4", true, true, false]],
      cos: [0.96, 0.94, 0.95], conf: 0.91, verdict: "right"
    },
    Q3: {
      label: "Q3: what is my excess?",
      rank: ["SCH", "W4.5", "W3.1", "W8.3", "W2.1", "W6.2", "W4.1", "W7.1"],
      rel: ["SCH", "W4.5"],
      ref: [["The excess is £250", "SCH"], ["For subsidence it is £1,000", "W4.5"]],
      claims: [["Your excess is £250.", "SCH", true, true, false],
        ["For subsidence the excess is £1,000.", "W4.5", true, true, false]],
      cos: [0.91, 0.89, 0.90], conf: 0.95, verdict: "right"
    },
    Q4: {
      label: "Q4: I dropped my laptop; is it covered?",
      rank: ["W5.1", "W6.2", "W5.6", "W8.3", "SCH", "W2.1", "W3.1", "W7.1"],
      rel: ["W6.2", "SCH"],
      ref: [["Accidental damage is covered only if the schedule shows it", "W6.2"], ["This schedule doesn't, so it is not covered", "SCH"]],
      claims: [["Your laptop is covered for accidental damage under section 6.2.", "W6.2", false, true, false],
        ["Tell us within 30 days.", "W8.3", true, true, false]],
      cos: [0.95, 0.93, 0.94], conf: 0.88, verdict: "wrong"
    },
    Q5: {
      label: "Q5: will you pay for a hotel if I can't live at home?",
      rank: ["W7.1", "W2.1", "W8.3", "W5.1", "W4.1", "W3.1", "SCH", "W9.2"],
      rel: ["W7.1"],
      ref: [["Somewhere to stay is paid while the home can't be lived in", "W7.1"]],
      claims: [["We pay for somewhere to stay.", "W7.1", true, true, false],
        ["We pay while your home can't be lived in.", "W7.1", true, true, false]],
      cos: [0.94, 0.92, 0.93], conf: 0.90, verdict: "right"
    },
    Q6: {
      label: "Q6: how long do I have to report a claim?",
      rank: ["W8.3", "SCH", "W7.1", "W2.1", "W5.1", "W3.4", "W4.2", "W6.2"],
      rel: ["W8.3"],
      ref: [["Tell us within 30 days", "W8.3"]],
      claims: [["You must tell us within 30 days.", "W8.3", true, true, false]],
      cos: [0.97, 0.95, 0.96], conf: 0.96, verdict: "right"
    },
    Q7: {
      label: "Q7: my house stood empty for three months and a pipe leaked; am I covered?",
      rank: ["W3.1", "W9.2", "W3.4", "W2.1", "SCH", "W8.3", "W7.1", "W5.1"],
      rel: ["W3.1", "W9.2"],
      ref: [["A leak is normally covered", "W3.1"], ["Not once unoccupied more than 60 days in a row", "W9.2"]],
      claims: [["A leak from a burst pipe is covered.", "W3.1", true, true, false],
        ["But not if the home was empty for more than 60 days in a row.", "W9.2", true, false, false]],
      cos: [0.93, 0.91, 0.92], conf: 0.84, verdict: "right"
    },
    Q8: {
      label: "Q8: the storm blew my fence down; is that covered?",
      rank: ["W4.1", "W4.2", "W2.1", "W4.5", "SCH", "W8.3", "W5.1", "W7.1"],
      rel: ["W4.1"],
      ref: [["Storm damage is covered", "W4.1"], ["Fences are not covered for storm", "W4.1"]],
      claims: [["Storm damage is covered.", "W4.1", true, true, false],
        ["Fences are not covered for storm damage.", "W4.1", true, true, false]],
      cos: [0.96, 0.94, 0.95], conf: 0.92, verdict: "right"
    },
    Q9: {
      label: "Q9: my bike was stolen at the station; is it covered?",
      rank: ["W5.1", "W5.6", "SCH", "W8.3", "W6.2", "W2.1", "W7.1", "W3.1"],
      rel: ["W5.6", "SCH"],
      ref: [["Possessions away from home are covered only if the schedule shows it", "W5.6"], ["This schedule shows it", "SCH"]],
      claims: [["Your bike is covered away from home, as your schedule includes it.", "W5.6", true, true, false],
        ["Cover is up to £1,000 for a bicycle.", "", false, false, false]],
      cos: [0.95, 0.93, 0.94], conf: 0.64, verdict: "wrong"
    },
    Q10: {
      label: "Q10: is subsidence covered, and what is the excess?",
      rank: ["W4.5", "W2.1", "W4.1", "SCH", "W8.3", "W3.1", "W7.1", "W5.1"],
      rel: ["W4.5"],
      ref: [["Subsidence is covered, excess £1,000", "W4.5"]],
      claims: [["Subsidence is covered.", "W4.5", true, true, false],
        ["Its excess is £1,000.", "W4.5", true, true, false]],
      cos: [0.95, 0.93, 0.94], conf: 0.89, verdict: "right"
    }
  };

  var DRAFT_K = 4;
  var BAR = 0.7;
  var METRICS = [
    { value: "cp", label: "Context precision at k" },
    { value: "cr", label: "Context recall at k" },
    { value: "faith", label: "Faithfulness" },
    { value: "ar", label: "Answer relevance" }
  ];
  var MNAME = { cp: "context precision", cr: "context recall", faith: "faithfulness", ar: "answer relevance" };
  var GRADERS = [
    { value: "adj", label: "The adjuster's labels" },
    { value: "chk", label: "The automated faithfulness check" }
  ];
  var GNAME = { adj: "the adjuster", chk: "the automated check" };
  var REPLIES = [
    { value: "none", label: "None yet" },
    { value: "0", label: "A: score the labelled questions" },
    { value: "1", label: "B: the prompt line, then trust" },
    { value: "2", label: "C: a second model's confidence" },
    { value: "3", label: "D: retrieve twice as many passages" }
  ];

  /* ---------- the arithmetic (pure functions the display and self-tests read) ---------- */

  function r2(x) { return (Math.round(Math.round(x * 1e6) / 1e4) / 100).toFixed(2); }
  function ord(n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); }
  function top(q, k) { return Q[q].rank.slice(0, k); }
  function rankOf(q, id) { return Q[q].rank.indexOf(id) + 1; }

  function cp(q, k) {
    var t = top(q, k);
    var n = t.filter(function (p) { return Q[q].rel.indexOf(p) >= 0; }).length;
    return { n: n, d: k, v: n / k };
  }
  function cr(q, k) {
    var t = top(q, k);
    var n = Q[q].ref.filter(function (r) { return t.indexOf(r[1]) >= 0; }).length;
    return { n: n, d: Q[q].ref.length, v: n / Q[q].ref.length };
  }
  function claimsOf(q, line) { return Q[q].claims.filter(function (c) { return !(line && c[4]); }); }
  function faith(q, line, g) {
    var cs = claimsOf(q, line);
    var n = cs.filter(function (c) { return g === "chk" ? c[3] : c[2]; }).length;
    return { n: n, d: cs.length, v: n / cs.length };
  }
  function ar(q) { var c = Q[q].cos; return (c[0] + c[1] + c[2]) / 3; }

  function card(k, line, g) {
    var o = { cp: 0, cr: 0, faith: 0, ar: 0, agree: 0, claims: 0 };
    QS.forEach(function (q) {
      o.cp += cp(q, k).v; o.cr += cr(q, k).v; o.faith += faith(q, line, g).v; o.ar += ar(q);
      claimsOf(q, line).forEach(function (c) { o.claims += 1; if (c[2] === c[3]) o.agree += 1; });
    });
    o.cp /= QS.length; o.cr /= QS.length; o.faith /= QS.length; o.ar /= QS.length;
    return o;
  }
  function oneOf(C, q, m) {
    return m === "cp" ? cp(q, C.k).v : m === "cr" ? cr(q, C.k).v : m === "faith" ? faith(q, C.line, C.g).v : ar(q);
  }

  // The worked line for one question and one metric.
  function worked(C) {
    var q = C.q;
    var x;
    var head = q + ", " + MNAME[C.metric] + ": ";
    if (C.metric === "cp") {
      x = cp(q, C.k);
      return head + x.n + " of the top " + C.k + " passages are labelled relevant (" + Q[q].rel.join(", ") + "). " +
        x.n + " / " + x.d + " = " + r2(x.v) + ".";
    }
    if (C.metric === "cr") {
      x = cr(q, C.k);
      var held = Q[q].ref.map(function (r) {
        return r[0] + " (" + r[1] + ", " + ord(rankOf(q, r[1])) + (rankOf(q, r[1]) <= C.k ? ", in" : ", missed") + ")";
      });
      return head + "a correct answer makes " + x.d + " claim" + (x.d === 1 ? "" : "s") + ": " + held.join("; ") + ". " +
        x.n + " / " + x.d + " = " + r2(x.v) + ".";
    }
    if (C.metric === "faith") {
      x = faith(q, C.line, C.g);
      return head + x.n + " of " + x.d + " claim" + (x.d === 1 ? "" : "s") + " supported, by " + GNAME[C.g] + "'s labels. " +
        x.n + " / " + x.d + " = " + r2(x.v) + ".";
    }
    var c = Q[q].cos;
    return head + "three questions the answer looks like it answers, each compared with the real one: (" +
      c.map(function (v) { return v.toFixed(2); }).join(" + ") + ") / 3 = " + r2(ar(q)) + ".";
  }

  function meanLine(C) {
    var vals = [];
    var sum = 0;
    QS.forEach(function (q) { var v = oneOf(C, q, C.metric); sum += v; vals.push(r2(v)); });
    return "Mean " + MNAME[C.metric] + " over the 10 questions: (" + vals.join(" + ") + ") / 10 = " + r2(sum / 10) + ".";
  }

  function summaryLine(C) {
    var c = card(C.k, C.line, C.g);
    return "k " + C.k + ", prompt line " + (C.line ? "on" : "off") + ", claims judged by " + GNAME[C.g] +
      ": answer relevance " + r2(c.ar) + ", context precision " + r2(c.cp) + ", context recall " + r2(c.cr) +
      ", faithfulness " + r2(c.faith) + ". Q1: context recall " + r2(cr("Q1", C.k).v) + ", faithfulness " + r2(faith("Q1", C.line, C.g).v) + ".";
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
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;overflow-x:auto;");
    var head = el("p", "margin:0;font-weight:600;");
    var passT = el("table", "width:100%;border-collapse:collapse;");
    var claimT = el("table", "width:100%;border-collapse:collapse;");
    var work = el("p", "margin:0;");
    var mean = el("p", "margin:0;");
    var cardT = el("table", "width:100%;border-collapse:collapse;");
    box.appendChild(head);
    box.appendChild(passT);
    box.appendChild(el("p", "margin:0;font-weight:600;", "Tonight's draft, split into claims"));
    box.appendChild(claimT);
    box.appendChild(work);
    box.appendChild(mean);
    box.appendChild(el("p", "margin:0;font-weight:600;", "The scorecard: all 10 labelled questions"));
    box.appendChild(cardT);
    api.root.appendChild(box);
    return { el: el, head: head, passT: passT, claimT: claimT, work: work, mean: mean, cardT: cardT };
  }

  function row(ui, cells, style, tag) {
    var tr = ui.el("tr", style || "");
    cells.forEach(function (c) { tr.appendChild(ui.el(tag || "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    return tr;
  }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var q = C.q;
    var c = card(C.k, C.line, C.g);
    ui.head.textContent = Q[q].label + " The search's ranked passages; the line is the top " + C.k + ".";

    empty(ui.passT);
    ui.passT.appendChild(row(ui, ["rank", "passage", "what it says", "adjuster's label"], "", "th"));
    Q[q].rank.forEach(function (id, i) {
      var isRel = Q[q].rel.indexOf(id) >= 0;
      var st = isRel ? (i < C.k ? "font-weight:600;" : "font-weight:600;color:var(--red);") : "color:var(--muted);";
      if (i === C.k - 1) st += "border-bottom:2px solid var(--amber);";
      ui.passT.appendChild(row(ui, [i + 1, id, PASS[id], isRel ? "RELEVANT" : ""], st));
    });

    empty(ui.claimT);
    ui.claimT.appendChild(row(ui, ["claim", "rests on", "adjuster", "automated check"], "", "th"));
    claimsOf(q, C.line).forEach(function (cl) {
      var st = cl[2] === cl[3] ? "" : "font-weight:600;color:var(--amber);";
      ui.claimT.appendChild(row(ui, [cl[0], cl[1] || "no passage", cl[2] ? "supported" : "UNSUPPORTED", cl[3] ? "supported" : "UNSUPPORTED"], st));
    });

    ui.work.textContent = worked(C);
    ui.mean.textContent = meanLine(C);

    empty(ui.cardT);
    ui.cardT.appendChild(row(ui, ["question", "context precision", "context recall", "faithfulness", "answer relevance", "confidence", "adjuster's verdict"], "", "th"));
    QS.forEach(function (x) {
      var st = x === q ? "font-weight:600;" : "";
      ui.cardT.appendChild(row(ui, [x, r2(cp(x, C.k).v), r2(cr(x, C.k).v), r2(faith(x, C.line, C.g).v), r2(ar(x)),
        Q[x].conf.toFixed(2), Q[x].verdict], st));
    });
    ui.cardT.appendChild(row(ui, ["all 10", r2(c.cp), r2(c.cr), r2(c.faith), r2(c.ar), "", ""], "font-weight:600;"));

    S.stat.ar(r2(c.ar));
    S.stat.cp(r2(c.cp));
    S.stat.cr(r2(c.cr));
    S.stat.faith(r2(c.faith));
    S.stat.floodcr(r2(cr("Q1", C.k).v));
    S.stat.floodfaith(r2(faith("Q1", C.line, C.g).v));
    S.stat.agree(c.agree + " of " + c.claims);
    S.stat.e17(rankOf("Q1", "E17"));
  }

  function setAll(S) {
    var C = S.C;
    S.ctl.k.set(C.k); S.ctl.line.set(C.line); S.ctl.metric.set(C.metric); S.ctl.g.set(C.g); S.ctl.q.set(C.q);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a5e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { k: DRAFT_K, line: false, metric: "faith", g: "adj", q: "Q1" };
      S.ui = buildWidget(api);
      S.ctl = {};

      function change(msg, tone) {
        draw(api);
        api.log(msg + " " + summaryLine(S.C), tone || "");
      }

      S.ctl.k = api.control.range("k", "k: passages retrieved for each question", 1, 8, 1, DRAFT_K, function (v) {
        var x = Math.max(1, Math.min(8, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.k) return;
        S.C.k = x;
        change("k is now " + x + ". Drafts stay as written from the top " + DRAFT_K + ".");
      });
      S.ctl.line = api.control.toggle("line", "Prompt line: answer only from the documents provided", false, function (on) {
        S.C.line = !!on;
        change("Prompt line " + (on ? "on." : "off."));
      });
      S.ctl.g = api.control.select("g", "Claims judged by", GRADERS, "adj", function (v) {
        if (!GNAME[v] || v === S.C.g) return;
        S.C.g = String(v);
        change("Claims now judged by " + GNAME[S.C.g] + ".");
      });
      S.ctl.metric = api.control.select("metric", "Metric worked out", METRICS, "faith", function (v) {
        if (!MNAME[v]) return;
        S.C.metric = String(v);
        draw(api);
      });
      S.ctl.q = api.control.select("q", "Question to inspect", QS.map(function (x) { return { value: x, label: Q[x].label }; }), "Q1", function (v) {
        if (!Q[v]) return;
        S.C.q = String(v);
        draw(api);
      });
      S.ctl.reply = api.control.select("reply", "Try a reply", REPLIES, "none", function (v) {
        var C = S.C;
        var c;
        if (v === "0") {
          C.k = DRAFT_K; C.line = false; C.metric = "faith"; C.g = "adj"; C.q = "Q1";
          draw(api);
          c = card(DRAFT_K, false, "adj");
          api.log("Reply A: the 10 labelled questions scored at k 4. Answer relevance " + r2(c.ar) + ", context precision " + r2(c.cp) +
            ", context recall " + r2(c.cr) + ", faithfulness " + r2(c.faith) + ". Q1: context recall " + r2(cr("Q1", 4).v) +
            ", faithfulness " + r2(faith("Q1", false, "adj").v) + ". The automated check agrees on " + c.agree + " of " + c.claims +
            " claims and also averages " + r2(card(DRAFT_K, false, "chk").faith) + "; it passes Q4's laptop claim and fails Q7's empty-home claim.", "ok");
        } else if (v === "1") {
          C.k = DRAFT_K; C.line = true; C.metric = "faith"; C.g = "adj"; C.q = "Q1";
          draw(api);
          c = card(DRAFT_K, true, "adj");
          api.log("Reply B: with the prompt line, faithfulness " + r2(c.faith) + " and Q1 " + r2(faith("Q1", true, "adj").v) +
            ": \"" + claimsOf("Q1", true)[0][0] + "\" Context recall stays " + r2(c.cr) + " and Q1 " + r2(cr("Q1", 4).v) +
            ": Endorsement 17 is still " + ord(rankOf("Q1", "E17")) + ". Q9 keeps its £1,000.", "bad");
        } else if (v === "2") {
          C.k = DRAFT_K; C.line = false; C.metric = "faith"; C.g = "adj"; C.q = "Q1";
          draw(api);
          var sent = QS.filter(function (x) { return Q[x].conf < BAR; });
          var wrongOut = QS.filter(function (x) { return Q[x].conf >= BAR && Q[x].verdict === "wrong"; });
          api.log("Reply C: confidence below 0.70 goes to an adjuster: " + sent.map(function (x) { return x + " (" + Q[x].conf.toFixed(2) + ")"; }).join(", ") +
            ". Marked wrong but sent out: " + wrongOut.map(function (x) { return x + " (" + Q[x].conf.toFixed(2) + ")"; }).join(", ") + ".", "bad");
        } else if (v === "3") {
          C.k = 8; C.line = false; C.metric = "cr"; C.g = "adj"; C.q = "Q1";
          draw(api);
          var a = card(DRAFT_K, false, "adj");
          var b = card(8, false, "adj");
          api.log("Reply D: k 4 to 8. Context recall " + r2(a.cr) + " to " + r2(b.cr) + "; context precision " + r2(a.cp) + " to " + r2(b.cp) +
            ". Endorsement 17 is in, " + ord(rankOf("Q1", "E17")) + ". The drafts are not scored again, and £25,000 is in no passage at any k.", "warn");
        } else {
          return;
        }
        setAll(S);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        ar: api.stat("ar", "answer relevance (the team's one score)", ""),
        cp: api.stat("cp", "context precision at k", ""),
        cr: api.stat("cr", "context recall at k", ""),
        faith: api.stat("faith", "faithfulness", ""),
        floodcr: api.stat("floodcr", "Q1 flood: context recall", "bad"),
        floodfaith: api.stat("floodfaith", "Q1 flood: faithfulness", "bad"),
        agree: api.stat("agree", "claims where the check agrees with the adjuster", "warn"),
        e17: api.stat("e17", "rank of Endorsement 17 for Q1", "bad")
      };

      api.info("<strong>How to read it.</strong> Ten customer questions Tryphena labelled: the passages that hold each answer, and the claims a correct answer makes. The top table is one question's ranked passages; the amber line is the top k. Below it, tonight's draft split into claims, with her label and the automated check's for each. Then the chosen metric is worked out for that question and averaged over all 10.");

      draw(api);
      var c0 = card(DRAFT_K, false, "adj");
      api.log("Tonight, Q1, Mr Gwinnett's flood question: Wording 4.2 1st, Endorsement 17 " + ord(rankOf("Q1", "E17")) +
        ", outside the top 4. The draft makes " + Q.Q1.claims.length + " claims; " + faith("Q1", false, "adj").n +
        " rests on a passage. Its answer relevance is " + r2(ar("Q1")) + "; over the 10, " + r2(c0.ar) + ".", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var S = t.api.state;

      // 1. Opening state: tonight's drafts, k 4, prompt line off, the adjuster's labels.
      t.expect(t.stat("ar") === 0.94 && t.stat("cp") === 0.35 && t.stat("cr") === 0.9 && t.stat("faith") === 0.83 &&
        t.stat("floodcr") === 0.5 && t.stat("floodfaith") === 0.33 && t.stat("agree") === "18 of 20" && t.stat("e17") === 6 &&
        has("Tonight, Q1, Mr Gwinnett's flood question: Wording 4.2 1st, Endorsement 17 6th, outside the top 4. The draft makes 3 claims; 1 rests on a passage. Its answer relevance is 0.97; over the 10, 0.94."),
        "Opens on tonight: answer relevance 0.94, context precision 0.35, context recall 0.90, faithfulness 0.83; Q1 recall 0.50, faithfulness 0.33");

      // 2. Q1 worked by hand: faithfulness 1 of 3, recall 1 of 2, relevance 0.97.
      var wf = worked(S.C);
      var wr = worked({ k: 4, line: false, metric: "cr", g: "adj", q: "Q1" });
      var wa = worked({ k: 4, line: false, metric: "ar", g: "adj", q: "Q1" });
      t.expect(wf === "Q1, faithfulness: 1 of 3 claims supported, by the adjuster's labels. 1 / 3 = 0.33." &&
        wr.indexOf("(E17, 6th, missed). 1 / 2 = 0.50.") >= 0 && wa.indexOf("(0.98 + 0.96 + 0.97) / 3 = 0.97.") >= 0,
        "Q1 by hand: faithfulness 1 / 3 = 0.33, context recall 1 / 2 = 0.50, answer relevance 0.97");

      // 3. Context precision at 4 by hand, and Q4's recall.
      var wp = worked({ k: 4, line: false, metric: "cp", g: "adj", q: "Q1" });
      t.expect(wp === "Q1, context precision: 1 of the top 4 passages are labelled relevant (W4.2, E17). 1 / 4 = 0.25." &&
        r2(cr("Q4", 4).v) === "0.50" && r2(faith("Q4", false, "adj").v) === "0.50" && r2(faith("Q9", false, "adj").v) === "0.50",
        "Q1 context precision 0.25; Q4 recall 0.50 and faithfulness 0.50; Q9 faithfulness 0.50");

      // 4. k 5 and k 8: recall rises, precision falls, faithfulness unchanged.
      t.set("k", 5);
      var cr5 = t.stat("cr");
      t.set("k", 8);
      t.expect(cr5 === 0.95 && t.stat("cr") === 1 && t.stat("cp") === 0.2 && t.stat("floodcr") === 1 && t.stat("faith") === 0.83 && t.stat("ar") === 0.94,
        "k 5: recall 0.95; k 8: recall 1.00, precision 0.20, faithfulness still 0.83");
      t.set("k", 4);

      // 5. The prompt line: faithfulness rises, the flood answer is faithful and still wrong.
      t.set("line", true);
      t.expect(t.stat("faith") === 0.9 && t.stat("floodfaith") === 1 && t.stat("cr") === 0.9 && t.stat("floodcr") === 0.5 &&
        t.stat("agree") === "16 of 18" && claimsOf("Q1", true).length === 1,
        "Prompt line on: faithfulness 0.90, Q1 1.00 with one claim, Q1 recall still 0.50");
      t.set("line", false);

      // 6. The automated check: the same average, two different claims.
      t.set("g", "chk");
      var fq4 = r2(faith("Q4", false, "chk").v);
      var fq7 = r2(faith("Q7", false, "chk").v);
      t.expect(t.stat("faith") === 0.83 && fq4 === "1.00" && fq7 === "0.50" && t.stat("agree") === "18 of 20",
        "Automated check: also 0.83 overall, but Q4 1.00 (it passes the laptop claim) and Q7 0.50");
      t.set("g", "adj");

      // 7. Answer relevance over the 10.
      var sum = 0;
      QS.forEach(function (x) { sum += Math.round(ar(x) * 100); });
      t.expect(sum === 940 && r2(ar("Q3")) === "0.90", "Answer relevance per question adds to 9.40: mean 0.94");

      // 8. Reply A: the scorecard.
      t.set("reply", "0");
      t.expect(has("Reply A: the 10 labelled questions scored at k 4. Answer relevance 0.94, context precision 0.35, context recall 0.90, faithfulness 0.83. Q1: context recall 0.50, faithfulness 0.33. The automated check agrees on 18 of 20 claims and also averages 0.83; it passes Q4's laptop claim and fails Q7's empty-home claim."),
        "Reply A: every score, Q1's two failures, and the check's 18 of 20");

      // 9. Reply B: the prompt line.
      t.set("reply", "1");
      t.expect(has("Reply B: with the prompt line, faithfulness 0.90 and Q1 1.00: \"Your policy covers flood damage.\" Context recall stays 0.90 and Q1 0.50: Endorsement 17 is still 6th. Q9 keeps its £1,000.") &&
        t.stat("floodfaith") === 1, "Reply B: faithful, still wrong");

      // 10. Reply C: confidence.
      t.set("reply", "2");
      t.expect(has("Reply C: confidence below 0.70 goes to an adjuster: Q9 (0.64). Marked wrong but sent out: Q1 (0.93), Q4 (0.88)."),
        "Reply C: only Q9 goes to an adjuster; Q1 and Q4 go out");

      // 11. Reply D: twice as many passages.
      t.set("reply", "3");
      t.expect(has("Reply D: k 4 to 8. Context recall 0.90 to 1.00; context precision 0.35 to 0.20. Endorsement 17 is in, 6th. The drafts are not scored again, and £25,000 is in no passage at any k.") &&
        t.stat("cr") === 1 && t.stat("cp") === 0.2, "Reply D: recall 0.90 to 1.00, precision 0.35 to 0.20");
    }
  });
})();
