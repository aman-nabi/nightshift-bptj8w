/* sims/a4e04-v1.0.0.js  (published as sims/a4e04.js)
   Case a4e04 "Many Hands": a delegation lab for Garthwick Research's report "circle", a lead agent and
   five worker agents. The learner reruns Tuesday night's report for Wrayholme Ferries and reads each
   worker's subtask as briefed, the sources it read, the claims in the merged report with the workers
   each came from, and the tokens, cost and minutes against one agent. No real model runs here: every
   agent follows stated rules over stated data. Widget-style sim: two tables built inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: two client questions (Tuesday's four parts; one thread, how
     Inchcombe decided), 1 to 8 worker agents, subtask briefs (one line each, or objective, limits and
     output format), UK only written into every one-liner or not, workers messaging each other
     directly, one agent instead of the circle. Stats: claims in the report, meetings that never
     happened, claims from outside the UK, duplicated subtasks, sources read, sources read twice,
     parts nobody researched, workers whose own notes hold the meeting, input and output tokens,
     cost in dollars, times the cost of one agent, minutes from start to report. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Teaching price, from the firm's invoice: $3 per million input tokens, $15 per million output.
     Cost in millionths of a dollar = input x 3 + output x 15, shown in dollars to two places.
   - Tuesday's question has four parts: a ports, b money, c decisions, d ferry lines. Each part, done by
     one worker, has stated tokens in/out, minutes and sources: a 184,000/6,000, 14 min, 9 sources;
     b 152,000/5,000, 11 min, 7; c 206,000/7,000, 17 min, 11; d 178,000/6,000, 15 min, 8. The one-thread
     question has one part, e: 132,000/5,000, 24 min, 10 sources.
   - One-line briefs: worker i gets part number i, counting round the parts again when there are more
     workers than parts (5 workers: a, b, c, d, a), so a part can go to two workers and a part can go
     to none. The one-liner for d says "ferry lines" with no UK only (as that night), so its worker
     reads Norwegian sources, unless the UK only toggle is on.
   - Full briefs: one brief per part, each with objective, limits (UK ports only, January 2022 on,
     public sources) and output format (claim, source link, date, place). Each part goes to one
     worker; spare workers are not started. Each brief adds 600 output tokens to the lead and 600
     input tokens to its worker.
   - The lead: plan 9,000 in, 2,000 out (plus the briefs); merge 15,000 in plus every worker's notes
     (their output tokens), 8,000 out. 3 minutes to plan and 6 to merge; workers run at the same time,
     so a run takes 3 + the slowest worker + 6 minutes.
   - The merge rule: notes from one-line briefs carry no source or worker, and the lead joins two notes
     about shore power with the same date into one event. Full briefs tag every finding with its
     source, and the lead keeps each finding separate.
   - Workers messaging directly: every worker reads every other worker's notes (their output tokens)
     as extra input, and the run waits 5 more minutes. A worker that reads a note about the same date
     writes the joined event into its own notes.
   - One agent: stated data from the firm's single-agent runs, one context searching one thing after
     another. Tuesday's question: 236,000/14,000, 58 min, 21 sources, 6 of the 8 findings (it did not
     reach Thurloe's money or its ferry lines). One thread: 118,000/6,000, 31 min, 10 sources, 3 claims.

   Where every number comes from (conventions rule 14; the case is content/latent/a4/a4e04-v1.0.0.json).
   - Tuesday night as run (5 workers, one-line briefs, no UK only on worker 4): lead 54,000 in (9,000 +
     15,000 + 30,000) and 10,000 out (2,000 + 8,000); workers 184,000/6,000, 152,000/5,000,
     206,000/7,000, 178,000/6,000, 184,000/6,000. Totals 958,000 in, 40,000 out:
     2,874,000 + 600,000 = 3,474,000 millionths, $3.47. 44 sources, 9 read twice (worker 5 repeated
     worker 1). 26 minutes (3 + 17 + 6): 23:00 to 23:26. 7 claims: 1 invented meeting, 1 from Norway.
   - Worker 5 alone: 184,000 x 3 + 6,000 x 15 = 642,000 millionths, $0.64.
   - The invented meeting: worker 3's note (Hilary Sowerby, Inchcombe harbour office, 14 March 2024)
     joined with worker 4's (Ragnhild Skjelbred, Havbrua, Brennvika quay, 14 March 2024).
   - One agent: 236,000 x 3 + 14,000 x 15 = 918,000 millionths, $0.92; 3,474,000 / 918,000 = 3.78,
     shown as 3.8 times. Tokens: 998,000 against 250,000, about 4 times.
   - Eight workers: 4 duplicated, 35 sources read twice, 1,512,000/58,000, $5.41, 5.9 times.
   - UK only in every one-liner: 8 claims, none invented, none from Norway, still 1 duplicated, $3.47.
   - Workers messaging directly: +120,000 input, 1,078,000/40,000, $3.83, 4.2 times, 31 minutes; the
     meeting is in the notes of 2 workers (3 and 4).
   - Full briefs: 4 workers, 770,400/36,400, $2.86, 3.1 times, 26 minutes, 35 sources, 8 claims.
   - One thread: full briefs 161,600/15,600, $0.72, 1.6 times, 33 minutes; one-line briefs with 5
     workers 709,000/35,000, $2.65, 6.0 times, 4 duplicated; one agent $0.44, 31 minutes. 3 claims each.
*/
(function () {
  "use strict";

  var IN_PRICE = 3;     // dollars per million input tokens (the firm's invoice, a teaching price)
  var OUT_PRICE = 15;   // dollars per million output tokens
  var PLAN_IN = 9000;
  var PLAN_OUT = 2000;
  var BRIEF_OUT = 600;  // each full brief the lead writes
  var BRIEF_IN = 600;   // each full brief a worker reads
  var MERGE_IN = 15000; // the lead's merge, before the workers' notes
  var MERGE_OUT = 8000;
  var PLAN_MIN = 3;
  var MERGE_MIN = 6;
  var TALK_MIN = 5;

  var CLAIMS = {
    a1: { text: "Inchcombe approved two shore power berths in 2023.", uk: true },
    a2: { text: "The Port of Thurloe approved one berth in 2024.", uk: true },
    b1: { text: "Inchcombe's berths cost 4.2 million GBP, half from a national port grant.", uk: true },
    b2: { text: "Thurloe's berth costs 1.6 million GBP, from the port's own reserves.", uk: true },
    c1: { text: "Hilary Sowerby, Inchcombe's harbour master, announced the funding at the Inchcombe harbour office on 14 March 2024.", uk: true },
    c2: { text: "Thurloe's port board voted for its berth on 9 May 2024.", uk: true },
    d1: { text: "Two ferry lines have agreed to plug in at Inchcombe from 2025.", uk: true },
    d2: { text: "No line has yet agreed to use Thurloe's berth.", uk: true },
    n1: { text: "Ragnhild Skjelbred, Havbrua's operations director, signed a shore power deal at the Brennvika quay on 14 March 2024.", uk: false },
    n2: { text: "Every Havbrua ferry has plugged in at Brennvika since 2023.", uk: false },
    F: { text: "On 14 March 2024 Hilary Sowerby met Ragnhild Skjelbred at the Inchcombe harbour office and agreed that Havbrua's ferries would plug in there.", uk: false, invented: true },
    e1: { text: "Inchcombe's board first discussed shore power in June 2022.", uk: true },
    e2: { text: "The board approved two berths in 2023.", uk: true },
    e3: { text: "Hilary Sowerby announced the funding on 14 March 2024.", uk: true }
  };

  // id, one-line brief, input and output tokens, minutes, sources read, where from, claims
  var PARTS = {
    a: { name: "ports", line: "Find which UK ports have committed money to shore power since 2022.",
      tin: 184000, tout: 6000, min: 14, src: 9, from: "UK port board minutes and trade press", claims: ["a1", "a2"] },
    b: { name: "money", line: "Find how much each UK port is spending on shore power, and where the money comes from.",
      tin: 152000, tout: 5000, min: 11, src: 7, from: "UK grant notices and port accounts", claims: ["b1", "b2"] },
    c: { name: "decisions", line: "Find who decided each UK port's shore power plan, and when.",
      tin: 206000, tout: 7000, min: 17, src: 11, from: "UK port board minutes and local news", claims: ["c1", "c2"] },
    d: { name: "ferry lines", line: "Find which ferry lines will plug in to shore power.",
      lineUK: "Find which ferry lines will plug in to shore power at UK ports.",
      tin: 178000, tout: 6000, min: 15, src: 8, from: "Norwegian ferry press releases and news", fromUK: "UK ferry lines' announcements",
      claims: ["n1", "n2"], claimsUK: ["d1", "d2"] },
    e: { name: "Inchcombe's timeline", line: "Find how Inchcombe's shore power decision was made, step by step.",
      tin: 132000, tout: 5000, min: 24, src: 10, from: "Inchcombe board minutes, 2022 to 2024", claims: ["e1", "e2", "e3"] }
  };
  var QUESTIONS = {
    // the firm's single-agent runs: one context, searching one thing after another (stated data)
    tonight: { parts: ["a", "b", "c", "d"], single: { tin: 236000, tout: 14000, min: 58, src: 21,
      claims: ["a1", "a2", "b1", "c1", "c2", "d1"] } },
    thread: { parts: ["e"], single: { tin: 118000, tout: 6000, min: 31, src: 10, claims: ["e1", "e2", "e3"] } }
  };
  var LIMITS = "UK ports only, January 2022 on, public sources";
  var FORMAT = "one finding a line: claim, source link, date, place";

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function micro(tin, tout) { return tin * IN_PRICE + tout * OUT_PRICE; }
  function dollars(m) { return (Math.round(m / 10000) / 100).toFixed(2); }

  /* ---------- the model: one run of the circle, or one agent ---------- */

  function partBrief(C, p) {
    var P = PARTS[p];
    if (C.brief === "full") return P.line.replace(/\.$/, "") + " | limits: " + LIMITS + " | format: " + FORMAT;
    if (p === "d" && C.uk) return P.lineUK;
    return P.line;
  }
  function partLost(C, p) { return p === "d" && C.brief === "one" && !C.uk; }

  function runCircle(C) {
    var Q = QUESTIONS[C.q];
    var P = Q.parts;
    var N = Number(C.workers);
    var workers = [];
    var i, j;
    if (C.brief === "one") {
      for (i = 0; i < N; i++) workers.push({ n: i + 1, parts: [P[i % P.length]] });
    } else {
      var used = Math.min(N, P.length);
      for (i = 0; i < used; i++) workers.push({ n: i + 1, parts: [] });
      for (j = 0; j < P.length; j++) workers[j % used].parts.push(P[j]);
    }
    var seen = {}, dup = 0, twice = 0, sumOut = 0;
    workers.forEach(function (w) {
      w.tin = 0; w.tout = 0; w.min = 0; w.src = 0; w.claims = []; w.from = []; w.briefs = [];
      w.parts.forEach(function (p) {
        var D = PARTS[p];
        var lost = partLost(C, p);
        w.tin += D.tin + (C.brief === "full" ? BRIEF_IN : 0);
        w.tout += D.tout; w.min += D.min; w.src += D.src;
        w.briefs.push(partBrief(C, p));
        w.from.push(p === "d" && !lost ? D.fromUK : D.from);
        w.claims = w.claims.concat(p === "d" && !lost ? D.claimsUK : D.claims);
        if (seen[p]) { dup += 1; twice += D.src; }
        seen[p] = true;
      });
      sumOut += w.tout;
    });
    var gaps = P.filter(function (p) { return !seen[p]; }).length;
    if (C.talk) workers.forEach(function (w) { w.tin += sumOut - w.tout; });
    // the merged report: each claim once, with the workers it came from
    var order = [], by = {};
    workers.forEach(function (w) {
      w.claims.forEach(function (c) {
        if (!by[c]) { by[c] = []; order.push(c); }
        by[c].push(w.n);
      });
    });
    var witnesses = 0;
    // stated rule: notes with no source or worker on them are merged by the lead, which joins two
    // notes about shore power with the same date into one event. Full briefs tag every finding.
    if (C.brief === "one" && by.c1 && by.n1) {
      var fromF = by.c1.concat(by.n1).sort(function (x, y) { return x - y; });
      order = order.filter(function (c) { return c !== "n1"; });
      order[order.indexOf("c1")] = "F";
      by.F = fromF;
      if (C.talk) witnesses = fromF.length;
    }
    var lead = {
      tin: PLAN_IN + MERGE_IN + sumOut,
      tout: PLAN_OUT + (C.brief === "full" ? BRIEF_OUT * P.length : 0) + MERGE_OUT
    };
    var tin = lead.tin, tout = lead.tout, wmax = 0, src = 0;
    workers.forEach(function (w) { tin += w.tin; tout += w.tout; src += w.src; if (w.min > wmax) wmax = w.min; });
    return {
      workers: workers, lead: lead, claims: order, by: by, dup: dup, twice: twice, gaps: gaps, witnesses: witnesses, src: src,
      tin: tin, tout: tout, m: micro(tin, tout), min: PLAN_MIN + wmax + MERGE_MIN + (C.talk ? TALK_MIN : 0)
    };
  }

  function runSingle(C) {
    var Q = QUESTIONS[C.q];
    var claims = Q.single.claims.slice(), by = {};
    claims.forEach(function (c) { by[c] = ["agent"]; });
    return {
      workers: [], lead: null, claims: claims, by: by, dup: 0, twice: 0, gaps: 0, witnesses: 0, src: Q.single.src,
      tin: Q.single.tin, tout: Q.single.tout, m: micro(Q.single.tin, Q.single.tout), min: Q.single.min
    };
  }

  function evaluate(C) {
    var R = C.single ? runSingle(C) : runCircle(C);
    var S1 = QUESTIONS[C.q].single;
    R.times = (Math.round(R.m / micro(S1.tin, S1.tout) * 10) / 10).toFixed(1);
    R.invented = R.claims.filter(function (c) { return CLAIMS[c].invented; }).length;
    R.abroad = R.claims.filter(function (c) { return !CLAIMS[c].uk && !CLAIMS[c].invented; }).length;
    return R;
  }

  function describe(C) {
    if (C.single) return "One agent, " + (C.q === "tonight" ? "Tuesday's four-part question" : "the one-thread question");
    return "The circle: a lead and " + C.workers + " worker" + (C.workers === "1" ? "" : "s") + ", " +
      (C.brief === "one" ? "one-line briefs" + (C.uk ? " with UK only" : " (as that night)") : "full briefs") +
      (C.talk ? ", workers talking directly" : "") + ", " + (C.q === "tonight" ? "the four-part question" : "the one-thread question");
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
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    function table(cols) {
      var wrap = el("div", "overflow-x:auto;");
      var t = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
      var hr = el("tr");
      cols.forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
      var th = el("thead"); th.appendChild(hr); t.appendChild(th);
      var tb = el("tbody"); t.appendChild(tb);
      wrap.appendChild(t); box.appendChild(wrap);
      return tb;
    }
    var agents = table(["agent", "subtask as briefed", "sources read", "tokens in / out", "minutes"]);
    var claims = table(["claim in the merged report", "came from"]);
    api.root.appendChild(box);
    return { el: el, head: head, agents: agents, claims: claims };
  }

  function row(ui, tb, cells, cls) {
    var tr = ui.el("tr");
    cells.forEach(function (c, k) {
      var td = ui.el("td", "padding:2px 4px;vertical-align:top;", c);
      if (cls && k === 0) td.setAttribute("class", cls);
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  }

  function draw(api, R) {
    var ui = api.state.ui;
    [ui.agents, ui.claims].forEach(function (tb) { while (tb.firstChild) tb.removeChild(tb.firstChild); });
    if (!R) {
      row(ui, ui.agents, ["-", "not run yet", "-", "-", "-"]);
      row(ui, ui.claims, ["not run yet", "-"]);
      return;
    }
    var C = api.state.C;
    if (R.lead) row(ui, ui.agents, ["lead", "plan, write " + (C.brief === "one" ? "one-line" : "full") + " briefs, merge the notes", "-",
      fmt(R.lead.tin) + " / " + fmt(R.lead.tout), PLAN_MIN + " + " + MERGE_MIN]);
    else row(ui, ui.agents, ["agent", "the whole question, one context", "-", fmt(R.tin) + " / " + fmt(R.tout), String(R.min)]);
    var seen = {};
    R.workers.forEach(function (w) {
      var dupe = w.parts.some(function (p) { var s = seen[p]; seen[p] = true; return s; });
      var lost = w.parts.some(function (p) { return partLost(C, p); });
      row(ui, ui.agents, ["worker " + w.n, w.briefs.join(" / "), w.src + ", " + w.from.join("; "),
        fmt(w.tin) + " / " + fmt(w.tout), String(w.min)], dupe ? "st-warn" : (lost ? "st-bad" : ""));
    });
    R.claims.forEach(function (c) {
      var K = CLAIMS[c];
      var from = R.by[c].map(function (n) { return n === "agent" ? "the agent" : "worker " + n; }).join(", ");
      row(ui, ui.claims, [K.text, from], K.invented ? "st-bad" : (K.uk ? "" : "st-warn"));
    });
  }

  function show(api, R) {
    var st = api.state.stat;
    st.claims(R ? R.claims.length : "-");
    st.invented(R ? R.invented : "-");
    st.abroad(R ? R.abroad : "-");
    st.dup(R ? R.dup : "-");
    st.src(R ? R.src : "-");
    st.twice(R ? R.twice : "-");
    st.gaps(R ? R.gaps : "-");
    st.witness(R ? R.witnesses : "-");
    st.tin(R ? fmt(R.tin) : "-");
    st.tout(R ? fmt(R.tout) : "-");
    st.cost(R ? dollars(R.m) : "-");
    st.times(R ? R.times : "-");
    st.min(R ? R.min : "-");
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    var R = evaluate(C);
    S.R = R;
    S.ran = true;
    R.workers.forEach(function (w) {
      var lost = w.parts.some(function (p) { return partLost(C, p); });
      api.log("worker " + w.n + ": " + w.briefs.join(" / ").replace(/\.?$/, ".") + " Read " + w.src + " sources: " + w.from.join("; ") + ".", lost ? "bad" : "");
    });
    if (!R.lead) api.log("agent: the whole question in one context, one search after another. Read " + R.src + " sources.", "");
    R.claims.forEach(function (c) {
      if (CLAIMS[c].invented) api.log("report: " + CLAIMS[c].text + " (from workers " + R.by[c].slice(0, -1).join(", ") + " and " + R.by[c][R.by[c].length - 1] + ")", "bad");
    });
    if (R.witnesses) api.log("notes: after messaging each other, " + R.witnesses + " workers hold the meeting in their own notes.", "bad");
    api.log(describe(C) + ": " + R.claims.length + " claims, " + R.invented + " invented, " + R.abroad + " from outside the UK, " +
      R.dup + " duplicated, " + R.gaps + " left out; " + fmt(R.tin) + " input and " + fmt(R.tout) + " output tokens, $" +
      dollars(R.m) + ", " + R.times + " times one agent, " + R.min + " minutes.", R.invented || R.abroad ? "bad" : "ok");
    S.ui.head.textContent = describe(C) + ".";
    draw(api, R);
    show(api, R);
  }

  function changed(api) {
    if (api.state.ran) run(api);
    else api.state.ui.head.textContent = describe(api.state.C) + ". Run it to see the briefs, the notes and the report.";
  }

  var NUMS = ["1", "2", "3", "4", "5", "6", "7", "8"].map(function (v) { return { value: v, label: v }; });

  DL.sims.define("a4e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { q: "tonight", workers: "5", brief: "one", uk: false, talk: false, single: false };
      S.ran = false;
      S.R = null;
      S.ui = buildWidget(api);
      api.control.select("q", "Client question", [
        { value: "tonight", label: "Tuesday's: four parts (ports, money, decisions, ferry lines)" },
        { value: "thread", label: "One thread: how Inchcombe decided, step by step" }
      ], "tonight", function (v) { S.C.q = String(v); changed(api); });
      api.control.select("workers", "Worker agents", NUMS, "5", function (v) { S.C.workers = String(v); changed(api); });
      api.control.select("brief", "Subtask briefs", [
        { value: "one", label: "One line each (as that night)" },
        { value: "full", label: "Objective, limits and output format" }
      ], "one", function (v) { S.C.brief = String(v) === "full" ? "full" : "one"; changed(api); });
      api.control.toggle("uk", "UK only written into every one-line brief", false, function (on) { S.C.uk = !!on; changed(api); });
      api.control.toggle("talk", "Workers message each other directly", false, function (on) { S.C.talk = !!on; changed(api); });
      api.control.toggle("single", "One agent instead of the circle", false, function (on) { S.C.single = !!on; changed(api); });
      api.control.button("run", "Run the report", function () { run(api); });
      api.control.button("reset", "Reset to 23:00", function () { api.reset(); });
      S.stat = {
        claims: api.stat("claims", "claims in the report", ""),
        invented: api.stat("invented", "meetings that never happened", "bad"),
        abroad: api.stat("abroad", "claims from outside the UK", "bad"),
        dup: api.stat("dup", "duplicated subtasks", "warn"),
        src: api.stat("src", "sources read", ""),
        twice: api.stat("twice", "sources read twice", "warn"),
        gaps: api.stat("gaps", "parts nobody researched", "warn"),
        witness: api.stat("witness", "workers whose own notes hold the meeting", "bad"),
        tin: api.stat("tin", "input tokens", ""),
        tout: api.stat("tout", "output tokens", ""),
        cost: api.stat("cost", "cost ($)", "warn"),
        times: api.stat("times", "times the cost of one agent", "warn"),
        min: api.stat("min", "minutes, start to report", "")
      };
      api.info("<strong>How to read it.</strong> The top table is every agent in the run: the lead, which plans, briefs the workers and merges their notes, and each worker with the subtask exactly as it was briefed, the sources it read, its tokens and minutes. Workers run at the same time, so the run takes the lead's minutes plus the slowest worker's. The bottom table is the merged report, one claim a row, with the workers each claim came from. In the claims, red is a claim that never happened and amber a claim from outside the UK. In the agents, red is a worker whose brief lost UK only and amber a worker doing a subtask another already had.");
      api.log("Tuesday, 23:00. Wrayholme Ferries' question is in. " + describe(S.C) + ". Nothing run yet.", "");
      S.ui.head.textContent = describe(S.C) + ". Run it to see the briefs, the notes and the report.";
      draw(api, null);
      show(api, null);
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: Tuesday 23:00, before the run.
      t.expect(t.stat("claims") === "-" && t.stat("cost") === "-" && st().ran === false && st().C.workers === "5" &&
        st().C.brief === "one" && st().C.uk === false && st().C.talk === false && st().C.single === false && has("Nothing run yet."),
        "Opens at 23:00 with the circle as built (a lead, 5 workers, one-line briefs), nothing run");

      // 2. Tuesday night's run as it happened.
      t.click("run");
      t.expect(t.stat("claims") === 7 && t.stat("invented") === 1 && t.stat("abroad") === 1 && t.stat("dup") === 1 &&
        t.stat("src") === 44 && t.stat("twice") === 9 && t.stat("gaps") === 0 && t.stat("witness") === 0 &&
        t.stat("tin") === "958,000" && t.stat("tout") === "40,000" && t.stat("cost") === 3.47 && t.stat("times") === 3.8 && t.stat("min") === 26,
        "As that night: 7 claims, 1 invented meeting, 1 Norwegian claim, 1 duplicated subtask, 958,000 and 40,000 tokens, $3.47, 3.8 times one agent, 26 minutes");

      // 3. Every agent's tokens, the lost constraint and the invented meeting.
      var R = st().R;
      t.expect(R.lead.tin === 54000 && R.lead.tout === 10000 &&
        R.workers.map(function (w) { return w.tin + "/" + w.tout; }).join(" ") === "184000/6000 152000/5000 206000/7000 178000/6000 184000/6000" &&
        has("worker 4: Find which ferry lines will plug in to shore power. Read 8 sources: Norwegian ferry press releases and news.") &&
        has("worker 5: Find which UK ports have committed money to shore power since 2022. Read 9 sources") &&
        has("report: On 14 March 2024 Hilary Sowerby met Ragnhild Skjelbred at the Inchcombe harbour office and agreed that Havbrua's ferries would plug in there. (from workers 3 and 4)"),
        "Lead 54,000/10,000, workers as stated; worker 4 had no UK only and read Norwegian sources; worker 5 repeated worker 1; the meeting joins workers 3 and 4");

      // 4. One agent on the same question.
      t.set("single", true);
      t.expect(t.stat("claims") === 6 && t.stat("invented") === 0 && t.stat("abroad") === 0 && t.stat("src") === 21 &&
        t.stat("tin") === "236,000" && t.stat("tout") === "14,000" && t.stat("cost") === 0.92 && t.stat("times") === 1 && t.stat("min") === 58,
        "One agent: 6 claims, nothing invented, 21 sources, $0.92, 58 minutes");

      // 5. More workers, the same one-line briefs.
      t.set("single", false);
      t.set("workers", "8");
      t.expect(t.stat("dup") === 4 && t.stat("twice") === 35 && t.stat("invented") === 1 && t.stat("abroad") === 1 &&
        t.stat("cost") === 5.41 && t.stat("times") === 5.9 && t.stat("min") === 26 &&
        has("(from workers 3, 4, 7 and 8)"),
        "Eight workers: 4 duplicated subtasks, the meeting still there, $5.41, 5.9 times one agent");

      // 6. UK only written into every one-liner.
      t.set("workers", "5");
      t.set("uk", true);
      t.expect(t.stat("invented") === 0 && t.stat("abroad") === 0 && t.stat("claims") === 8 && t.stat("dup") === 1 && t.stat("cost") === 3.47,
        "UK only in every one-liner: no meeting, no Norwegian claim, still 1 duplicated subtask, $3.47");

      // 7. Workers messaging each other directly.
      t.set("uk", false);
      t.set("talk", true);
      t.expect(t.stat("witness") === 2 && t.stat("invented") === 1 && t.stat("tin") === "1,078,000" && t.stat("cost") === 3.83 &&
        t.stat("times") === 4.2 && t.stat("min") === 31 && has("2 workers hold the meeting in their own notes"),
        "Talking directly: the meeting now in 2 workers' own notes, $3.83, 31 minutes");

      // 8. Full briefs: objective, limits and output format.
      t.set("talk", false);
      t.set("brief", "full");
      t.expect(t.stat("claims") === 8 && t.stat("invented") === 0 && t.stat("abroad") === 0 && t.stat("dup") === 0 && t.stat("src") === 35 &&
        t.stat("tin") === "770,400" && t.stat("tout") === "36,400" && t.stat("cost") === 2.86 && t.stat("times") === 3.1 && t.stat("min") === 26 &&
        st().R.workers.length === 4,
        "Full briefs: 4 workers, 8 claims, nothing invented or duplicated, $2.86, 3.1 times one agent, 26 minutes");

      // 9. The one-thread question: the circle against one agent.
      t.set("q", "thread");
      var full = [t.stat("cost"), t.stat("times"), t.stat("min"), t.stat("claims")].join(" ");
      t.set("brief", "one");
      var one = [t.stat("dup"), t.stat("cost"), t.stat("times")].join(" ");
      t.set("single", true);
      t.expect(full === "0.72 1.6 33 3" && one === "4 2.65 6" && t.stat("cost") === 0.44 && t.stat("min") === 31 && t.stat("claims") === 3,
        "One thread: full briefs $0.72 (1.6 times), one-liners $2.65 with 4 duplicated, one agent $0.44 in 31 minutes, same 3 claims");

      // 10. Reset returns to 23:00.
      t.click("reset");
      t.expect(st().ran === false && st().C.q === "tonight" && st().C.workers === "5" && st().C.single === false && t.stat("claims") === "-",
        "Reset returns to Tuesday 23:00 with the circle as built, nothing run");
    }
  });
})();
