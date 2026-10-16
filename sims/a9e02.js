/* sims/a9e02-v1.0.0.js  (published as sims/a9e02.js)
   Case a9e02 "The Sealed Envelope": a replay of one take-home night, from the email at 20:00 on
   Thursday 12 November 2026 to the 08:00 deadline on Friday 13 November. It has an index (a list of
   chunks and where each came from) and a scorer, and no real model: every answer, similarity and
   flag below is given data, set out here and in sim.lede. Widget-style sim: it draws its own table
   in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: time of night, where eval.csv sits, leak check on or
     off, question set (tuned on, fresh), a reply to play, reset. Stats: time, time left, where
     eval.csv sits, chunks indexed, right, faithful and recall@5 (each of 20), answer 7's citation,
     question 18's answer, leak check, what the report claims, the graders' hidden questions.
     selfTest: 12 assertions.

   The given data (stated in sim.lede):
   - 50 documents under data/ cut into 300 chunks. eval.csv holds 20 rows, one per test question;
     the indexer cuts a table one row per chunk, so indexing it adds 20 chunks: 300 + 20 = 320.
   - The 20 questions she tuned on (02:00 to 04:00), each with: the best document chunk's
     similarity (0.70 to 0.85), its own eval.csv row's similarity (0.99), whether the right document
     was in the top 5 of the 300 document chunks (recall@5), and, answered from the documents,
     whether the answer was right and faithful.
     Recall misses: 4, 9, 13, 16 (16 of 20 hits). Wrong: 4, 9, 13, 16, 18 (15 of 20 right).
     Not faithful: 9, 13, 18 (17 of 20 faithful). Question 18 (resoling ski boots, unanswerable)
     answers "£35", the walking-boot resole price; its key says "the documents don't say".
   - 20 fresh questions (written 05:20 to 07:20 in the warn reply): recall misses 3, 11, 14, 17, 20
     (15 of 20); wrong 3, 6, 11, 14, 17, 19, 20 (13 of 20 right); not faithful 6, 14, 19, 20
     (16 of 20). Their nearest eval.csv row scores 0.66 or less, below their best document chunk.
   - The graders' 10 hidden questions, run after 08:00: right on 7 of 10 (wrong 3, 7, 10). None of
     them is in eval.csv, so the 7 is the same wherever eval.csv sits.

   Where every number comes from (conventions rule 14; the case is content/latent/a9/a9e02-v1.0.0.json):
   - Rule: when eval.csv is indexed, a question whose own row outscores its best document chunk
     (0.99 against 0.70 to 0.85) gets that row as its top chunk; the model copies it, so the answer
     is right and faithful, and it cites "eval.csv, row n". Otherwise the given flags apply.
   - 04:00 (eval.csv on the desktop): 15, 17, 16 of 20; answer 7 cites returns-policy.txt.
   - 04:30 tidy: eval.csv into data/eval/, still 300 chunks. 04:40 re-index: 320.
   - 05:00: 20, 20, and recall@5 still 16, because recall ranks only the 300 document chunks.
   - Leak check: fails if any chunk comes from eval.csv or any question's top chunk scores 0.98 or
     more. With eval.csv indexed: 20 chunks, 20 of 20 questions. Moved to tests/: 0 chunks, top
     match 0.85 (question 11's best document chunk).
   - Time left: 08:00 minus the time. 05:10 leaves 2 h 50 min; the post at 05:20 leaves 2 h 40 min
     (under three hours), where every reply starts; 07:20 leaves 40 min.
   - Reply 0: tests/, leak check on, tuned set, 15 of 20 reported as tuned on. Reply 1: 20 of 20
     reported. Reply 2: no numbers, five example answers (1, 2, 7, 11, 15). Reply 3: fresh set at
     07:20: 13, 16, 15 of 20. Hidden questions: 7 of 10 for every reply.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DOC_CHUNKS = 300;
  var ROWS = 20;
  var DEADLINE = 720;          // minutes from 20:00 to 08:00
  var LEAK_AT = 0.98;
  var ROW_SIM = 0.99;

  // The 20 questions she tuned on (index 0 is question 1).
  var TUNED = {
    doc: [0.81, 0.78, 0.84, 0.72, 0.79, 0.83, 0.81, 0.76, 0.70, 0.82, 0.85, 0.77, 0.73, 0.80, 0.84, 0.74, 0.79, 0.75, 0.82, 0.78],
    row: [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
    hit: [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1],
    right: [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1],
    faith: [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
    cite: ["size-guide-women.txt", "size-guide-men.txt", "size-guide-children.txt", "care-guide-leather.txt",
      "care-guide-suede.txt", "returns-policy.txt", "returns-policy.txt", "repair-prices.txt",
      "care-guide-leather.txt", "size-guide-children.txt", "returns-policy.txt", "repair-prices.txt",
      "size-guide-men.txt", "care-guide-suede.txt", "returns-policy.txt", "size-guide-women.txt",
      "repair-prices.txt", "repair-prices.txt", "care-guide-leather.txt", "returns-policy.txt"]
  };
  var Q18_BEFORE = "£35 (the walking-boot resole price)";
  var Q18_KEY = "the documents don't say";

  // 20 fresh questions, written 05:20 to 07:20 in the warn reply.
  var FRESH = {
    doc: [0.80, 0.83, 0.71, 0.79, 0.82, 0.77, 0.84, 0.78, 0.81, 0.76, 0.72, 0.80, 0.83, 0.74, 0.79, 0.82, 0.73, 0.78, 0.81, 0.75],
    row: [0.52, 0.61, 0.48, 0.66, 0.55, 0.59, 0.63, 0.50, 0.57, 0.62, 0.46, 0.58, 0.64, 0.53, 0.60, 0.56, 0.49, 0.65, 0.54, 0.51],
    hit: [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
    right: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0],
    faith: [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0]
  };

  // The graders' 10 hidden questions, after 08:00.
  var HIDDEN = [1, 1, 0, 1, 1, 1, 0, 1, 1, 0];

  var TIMES = [
    { value: "20:00", label: "20:00 thursday: the email", m: 0 },
    { value: "21:00", label: "21:00: building starts", m: 60 },
    { value: "01:00", label: "01:00 friday: index built, eval.csv written", m: 300 },
    { value: "04:00", label: "04:00: tuning done", m: 480 },
    { value: "04:30", label: "04:30: the tidy", m: 510 },
    { value: "04:40", label: "04:40: the re-index", m: 520 },
    { value: "05:00", label: "05:00: the scorer", m: 540 },
    { value: "05:10", label: "05:10: answer 7 into the report", m: 550 },
    { value: "05:20", label: "05:20: the post", m: 560 },
    { value: "07:20", label: "07:20: fresh questions done (reply 3)", m: 680 }
  ];
  var PLACES = [
    { value: "story", label: "as it happened: desktop, then data/eval/ at 04:30" },
    { value: "data", label: "data/eval/ (inside data/, so indexed)" },
    { value: "tests", label: "tests/ (outside data/)" }
  ];
  var SETS = [
    { value: "tuned", label: "the 20 i tuned on (eval.csv)" },
    { value: "fresh", label: "20 fresh questions (written by 07:20)" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: key out, leak check, 15 of 20 as tuned on" },
    { value: "r1", label: "reply 1: submit 20 of 20" },
    { value: "r2", label: "reply 2: no numbers, five example answers" },
    { value: "r3", label: "reply 3: 20 fresh questions, report only those" }
  ];
  var REPORTS = {
    none: "not written yet",
    r0: "15 of 20 right, 17 faithful, recall@5 16, on questions i tuned on; 5 failures shown; next: a fresh test set",
    r1: "20 of 20 right, 20 of 20 faithful, recall@5 16 of 20",
    r2: "five example answers (1, 2, 7, 11, 15), no numbers",
    r3: "13 of 20 right, 16 faithful, recall@5 15, on 20 fresh questions"
  };

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function left(m) { var r = DEADLINE - m; return Math.floor(r / 60) + " h " + pad(r % 60) + " min"; }
  function two(x) { return x.toFixed(2); }
  function minOf(a) { var b = a[0]; for (var i = 1; i < a.length; i++) if (a[i] < b) b = a[i]; return b; }
  function maxOf(a) { var b = a[0]; for (var i = 1; i < a.length; i++) if (a[i] > b) b = a[i]; return b; }
  function defaults() {
    return { time: "20:00", place: "story", moved: false, check: false, set: "tuned", plan: "none" };
  }

  /* ---------- the night (pure: settings in, answers out) ---------- */

  function night(C) {
    var m = pick(TIMES, C.time).m;
    var R = { m: m };
    R.left = left(m);
    R.keyExists = m >= 300;
    var where;
    if (!R.keyExists) where = "none";
    else if (C.place === "story") where = m >= 510 ? "data" : "desktop";
    else where = C.place;
    R.where = where;
    R.whereText = where === "none" ? "not written yet" : (where === "desktop" ? "desktop" : (where === "data" ? "data/eval/" : "tests/"));
    // Indexed at the 04:40 re-index, or at once when you move it yourself (a re-index runs on every move).
    R.keyIndexed = where === "data" && (m >= 520 || C.moved);
    R.chunks = m >= 300 ? DOC_CHUNKS + (R.keyIndexed ? ROWS : 0) : 0;

    var Q = C.set === "fresh" ? FRESH : TUNED;
    R.ready = C.set === "fresh" ? m >= 680 : m >= 480;
    var right = 0, faith = 0, hit = 0, high = 0, top = 0;
    R.ans = [];
    for (var i = 0; i < ROWS; i++) {
      var useRow = R.keyIndexed && Q.row[i] > Q.doc[i];
      var best = useRow ? Q.row[i] : Q.doc[i];
      if (best > top) top = best;
      if (best >= LEAK_AT) high += 1;
      var a = {
        right: useRow ? 1 : Q.right[i],
        faith: useRow ? 1 : Q.faith[i],
        cite: useRow ? "eval.csv, row " + (i + 1) : (Q.cite ? Q.cite[i] : "a document")
      };
      R.ans.push(a);
      right += a.right; faith += a.faith; hit += Q.hit[i];
    }
    R.right = R.ready ? right + " of " + ROWS : "not scored yet";
    R.faith = R.ready ? faith + " of " + ROWS : "not scored yet";
    R.recall = R.ready ? hit + " of " + ROWS : "not scored yet";
    R.cite7 = R.ready && C.set === "tuned" ? R.ans[6].cite : "not run yet";
    R.q18 = R.ready && C.set === "tuned" ? (R.keyIndexed ? Q18_KEY : Q18_BEFORE) : "not run yet";
    R.high = high;
    R.top = top;
    if (!C.check) R.leak = "off";
    else if (m < 300) R.leak = "nothing to check yet";
    else if (R.keyIndexed || high > 0) R.leak = "fail: " + (R.keyIndexed ? ROWS : 0) + " chunks from eval.csv, " + high + " of " + ROWS + " questions at " + LEAK_AT + " or more";
    else R.leak = "pass: 0 chunks from eval.csv, top match " + two(top);
    R.report = REPORTS[C.plan];
    R.hidden = C.plan === "none" ? "run by the graders after 08:00" : sum(HIDDEN) + " of " + HIDDEN.length;
    return R;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    var w1 = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var R = night(C);
    var ui = api.state.ui;
    ui.head.textContent = "the take-home at " + C.time + ". eval.csv: " + R.whereText + ". chunks indexed: " + R.chunks +
      ". question set: " + pick(SETS, C.set).label + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["question", "best document chunk", "own eval.csv row", "right document in top 5", "right", "faithful", "cites"], true);
    var Q = C.set === "fresh" ? FRESH : TUNED;
    for (var i = 0; i < ROWS; i++) {
      var a = R.ans[i];
      row(ui, [i + 1, two(Q.doc[i]), R.keyIndexed ? two(Q.row[i]) : "not indexed", Q.hit[i] ? "yes" : "no",
        R.ready ? (a.right ? "yes" : "no") : "-", R.ready ? (a.faith ? "yes" : "no") : "-", R.ready ? a.cite : "-"], false);
    }
    ui.note.textContent = "time left: " + R.left + ". leak check: " + R.leak + ". report: " + R.report + ".";
  }

  function setStats(api) {
    var R = night(api.state.C);
    var st = api.state.stat;
    st.time(api.state.C.time);
    st.left(R.left);
    st.where(R.whereText);
    st.chunks(R.chunks);
    st.right(R.right);
    st.faith(R.faith);
    st.recall(R.recall);
    st.cite7(R.cite7);
    st.q18(R.q18);
    st.leak(R.leak);
    st.report(R.report);
    st.hidden(R.hidden);
  }

  function refresh(api) { draw(api); setStats(api); }

  // One line for the moment the time control lands on; it describes the night up to that moment.
  function moment(api, before) {
    var C = api.state.C;
    var R = night(C);
    var t = C.time;
    if (t === "20:00") api.log("20:00 thursday 12 november. the take-home email arrives: 50 documents, 20 test questions to write, due 08:00. time left: " + R.left + ".", "");
    if (t === "21:00") api.log("21:00. building starts at the kitchen table. nothing indexed yet.", "");
    if (t === "01:00") api.log("01:00 friday. index built from every file under data/: 0 chunks before, " + R.chunks + " after. eval.csv written on the " + R.whereText + ": 20 rows.", "");
    if (t === "04:00") api.log("04:00. tuning done (02:00 to 04:00) on the 20 questions in eval.csv: right " + R.right + ", faithful " + R.faith + ", recall@5 " + R.recall + ".", "");
    if (t === "04:30") api.log("04:30. the tidy for handing in: eval.csv is now in " + R.whereText + ". chunks indexed still " + R.chunks + ".", "warn");
    if (t === "04:40") api.log("04:40. re-index of every file under data/: " + before.chunks + " chunks before, " + R.chunks + " after.", R.keyIndexed ? "bad" : "");
    if (t === "05:00") {
      var Q = C.set === "fresh" ? FRESH : TUNED;
      api.log("05:00. scorer run: right " + R.right + ", faithful " + R.faith + ", recall@5 " + R.recall +
        (R.keyIndexed && C.set === "tuned" ? ". each question's own eval.csv row scores " + two(ROW_SIM) + "; its best document chunk " +
          two(minOf(Q.doc)) + " to " + two(maxOf(Q.doc)) + "." : "."), R.keyIndexed ? "bad" : "");
    }
    if (t === "05:10") api.log("05:10. answer 7 copied into the report. its citation: " + R.cite7 + ". time left: " + R.left + ".", R.keyIndexed ? "bad" : "");
    if (t === "05:20") api.log("05:20. the post: what should i change before 08:00? time left: " + R.left + ".", "warn");
    if (t === "07:20") api.log("07:20. time left for the report: " + R.left + ".", "warn");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.time = "05:20";
    if (plan === "r0") { C.place = "tests"; C.moved = true; C.check = true; }
    if (plan === "r1") { C.place = "data"; }
    if (plan === "r2") { C.place = "tests"; C.moved = true; }
    if (plan === "r3") { C.time = "07:20"; C.place = "tests"; C.moved = true; C.set = "fresh"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = night(api.state.C);
    var leaky = night({ time: "05:20", place: "story", moved: false, check: true, set: "tuned", plan: "none" });
    if (plan === "r0") {
      api.log("leak check on the 04:40 index: " + leaky.leak + ".", "bad");
      api.log("eval.csv moved to tests/, re-index: " + leaky.chunks + " chunks before, " + R.chunks + " after. leak check: " + R.leak +
        ". right " + R.right + ", faithful " + R.faith + ", recall@5 " + R.recall + ", labelled: questions i tuned on. time left: " + R.left + ".", "ok");
    }
    if (plan === "r1") api.log("submitted as scored: " + R.report + ". the graders' hidden questions: " + R.hidden +
      " right. none of them is in eval.csv, so the key never helped them.", "bad");
    if (plan === "r2") api.log("report: " + R.report + ". the brief asked for recall@5 and faithfulness. hidden questions: " + R.hidden + " right.", "bad");
    if (plan === "r3") api.log("05:20, " + leaky.left + " left. 20 fresh questions took until 07:20: right " + R.right + ", faithful " + R.faith +
      ", recall@5 " + R.recall + ". " + R.left + " left for the report. hidden questions: " + R.hidden + " right.", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.time.set(S.C.time);
        S.ctl.place.set(S.C.place);
        S.ctl.check.set(S.C.check);
        S.ctl.set.set(S.C.set);
        S.sync = false;
      }
      function clearPlan() {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        }
      }
      S.ctl.time = api.control.select("time", "time of night", TIMES, "20:00", function (val) {
        if (S.sync) return;
        var o = pick(TIMES, val);
        if (!o) return;
        var before = night(S.C);
        clearPlan();
        S.C.time = String(o.value);
        refresh(api);
        moment(api, before);
      });
      S.ctl.place = api.control.select("place", "where eval.csv sits", PLACES, "story", function (val) {
        if (S.sync) return;
        var o = pick(PLACES, val);
        if (!o) return;
        var before = night(S.C);
        clearPlan();
        S.C.place = String(o.value);
        S.C.moved = S.C.place !== "story";
        refresh(api);
        var R = night(S.C);
        api.log("eval.csv: " + o.label + ". " + (R.m >= 300 ? "re-index: " + before.chunks + " chunks before, " + R.chunks + " after." : "not written until 01:00."),
          R.keyIndexed ? "bad" : "");
      });
      S.ctl.check = api.control.toggle("check", "leak check", false, function (on) {
        if (S.sync) return;
        clearPlan();
        S.C.check = !!on;
        refresh(api);
        var R = night(S.C);
        api.log("leak check " + (on ? "on: " + R.leak : "off") + ".", R.leak.indexOf("fail") === 0 ? "bad" : (R.leak.indexOf("pass") === 0 ? "ok" : ""));
      });
      S.ctl.set = api.control.select("set", "question set", SETS, "tuned", function (val) {
        if (S.sync) return;
        var o = pick(SETS, val);
        if (!o) return;
        clearPlan();
        S.C.set = String(o.value);
        refresh(api);
        var R = night(S.C);
        api.log("question set: " + o.label + ". right " + R.right + ", faithful " + R.faith + ", recall@5 " + R.recall + ".", "");
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api);
        api.log("reply: " + o.label + ".", "");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        left: api.stat("left", "time left before 08:00", "warn"),
        where: api.stat("where", "where eval.csv sits", ""),
        chunks: api.stat("chunks", "chunks indexed", ""),
        right: api.stat("right", "right, of 20", ""),
        faith: api.stat("faith", "faithful, of 20", ""),
        recall: api.stat("recall", "recall@5, of 20", ""),
        cite7: api.stat("cite7", "answer 7 cites", "bad"),
        q18: api.stat("q18", "question 18's answer", ""),
        leak: api.stat("leak", "leak check", ""),
        report: api.stat("report", "what the report claims", ""),
        hidden: api.stat("hidden", "graders' hidden questions, right", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one test question: the similarity of the best chunk cut from the 50 documents, the similarity of its own row in eval.csv when that file is indexed, whether the right document was in the top 5 of the document chunks (recall@5), and, once scored, whether the answer was right and faithful and what it cites. A question takes whichever chunk scores higher.");

      refresh(api);
      api.log("thursday 12 november, 20:00 at the shoe shop's till, before the take-home email arrives. nothing built yet.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: 20:00, before the email's contents are opened.
      t.expect(t.stat("time") === "20:00" && t.stat("left") === "12 h 00 min" && t.stat("chunks") === 0 &&
        t.stat("where") === "not written yet" && t.stat("right") === "not scored yet" && t.stat("leak") === "off" &&
        t.stat("hidden") === "run by the graders after 08:00" && has("before the take-home email arrives"),
        "Opens at 20:00: 12 h left, nothing indexed, eval.csv not written");

      // 2. 01:00: 50 documents make 300 chunks; eval.csv sits on the desktop.
      t.set("time", "01:00");
      t.expect(t.stat("chunks") === 300 && t.stat("where") === "desktop" && has("0 chunks before, 300 after"),
        "01:00: 300 chunks, eval.csv on the desktop");

      // 3. 04:00: after tuning, 15, 17 and 16 of 20; question 18 says £35.
      t.set("time", "04:00");
      t.expect(t.stat("right") === "15 of 20" && t.stat("faith") === "17 of 20" && t.stat("recall") === "16 of 20" &&
        t.stat("cite7") === "returns-policy.txt" && t.stat("q18") === "£35 (the walking-boot resole price)",
        "04:00: 15 right, 17 faithful, recall@5 16; question 18 answers £35");

      // 4. 04:30: the tidy moves eval.csv into data/eval/, but nothing is re-indexed yet.
      t.set("time", "04:30");
      t.expect(t.stat("where") === "data/eval/" && t.stat("chunks") === 300, "04:30: eval.csv in data/eval/, still 300 chunks");

      // 5. 04:40: the re-index adds one chunk per row.
      t.set("time", "04:40");
      t.expect(t.stat("chunks") === 320 && has("300 chunks before, 320 after"), "04:40: 300 + 20 = 320 chunks");

      // 6. 05:00: every answer copies the key; recall@5 stays 16.
      t.set("time", "05:00");
      t.expect(t.stat("right") === "20 of 20" && t.stat("faith") === "20 of 20" && t.stat("recall") === "16 of 20" &&
        t.stat("q18") === "the documents don't say" && has("own eval.csv row scores 0.99; its best document chunk 0.70 to 0.85"),
        "05:00: 20, 20, 16; question 18 copies the key; 0.99 against 0.70 to 0.85");

      // 7. 05:10: answer 7's citation, and about 3 hours left.
      t.set("time", "05:10");
      t.expect(t.stat("cite7") === "eval.csv, row 7" && t.stat("left") === "2 h 50 min", "05:10: answer 7 cites eval.csv, row 7; 2 h 50 min left");

      // 8. The leak check fails on the 04:40 index, then passes once eval.csv is outside data/.
      t.set("check", true);
      var failed = t.stat("leak") === "fail: 20 chunks from eval.csv, 20 of 20 questions at 0.98 or more";
      t.set("place", "tests");
      t.expect(failed && t.stat("leak") === "pass: 0 chunks from eval.csv, top match 0.85" && t.stat("chunks") === 300 &&
        t.stat("right") === "15 of 20" && t.stat("faith") === "17 of 20" && t.stat("cite7") === "returns-policy.txt",
        "Leak check: fails at 320 chunks, passes at 300 with top match 0.85; back to 15 and 17");

      // 9. Reply 0: key out, leak check, 15 of 20 as tuned on.
      t.set("plan", "r0");
      t.expect(t.stat("report") === "15 of 20 right, 17 faithful, recall@5 16, on questions i tuned on; 5 failures shown; next: a fresh test set" &&
        t.stat("leak") === "pass: 0 chunks from eval.csv, top match 0.85" && t.stat("hidden") === "7 of 10" && t.stat("left") === "2 h 40 min" &&
        has("leak check on the 04:40 index: fail"), "Reply 0: leak check fails then passes; 15 of 20 reported as tuned on; hidden 7 of 10");

      // 10. Reply 1: 20 of 20 submitted; the hidden questions score 7 of 10.
      t.set("plan", "r1");
      t.expect(t.stat("right") === "20 of 20" && t.stat("chunks") === 320 && t.stat("hidden") === "7 of 10" &&
        has("the graders' hidden questions: 7 of 10 right"), "Reply 1: 20 of 20 claimed, 7 of 10 on the hidden questions");

      // 11. Reply 2: no numbers in the report.
      t.set("plan", "r2");
      t.expect(t.stat("report") === "five example answers (1, 2, 7, 11, 15), no numbers" && t.stat("chunks") === 300,
        "Reply 2: five example answers, no numbers");

      // 12. Reply 3: fresh questions, 40 minutes left.
      t.set("plan", "r3");
      t.expect(t.stat("time") === "07:20" && t.stat("left") === "0 h 40 min" && t.stat("right") === "13 of 20" &&
        t.stat("faith") === "16 of 20" && t.stat("recall") === "15 of 20" && has("05:20, 2 h 40 min left"),
        "Reply 3: fresh set 13, 16, 15 of 20, with 40 minutes left for the report");
    }
  });
})();
