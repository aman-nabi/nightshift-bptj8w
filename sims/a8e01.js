/* sims/a8e01-v1.0.0.js  (published as sims/a8e01.js)
   Case a8e01 "Teach It or Tell It": a small driving school's assistant, fine-tuned in March on
   3,200 learners' questions with the instructors' answers, still says 30 mph on Malthouse Road after
   the council cut the limit to 20 on Monday 12 October. No real model runs here: every answer below
   is given data, one right-or-wrong mark per question per set-up, and every score is a count of those
   marks. Widget-style sim: it draws its own table of the 20 questions in api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: run the 20 questions, how the assistant gets its rules
     (fine-tune only, fine-tune plus a line in its instructions, a bigger fine-tune on the same
     answers, lookup in the dated page with no fine-tune, fine-tune for tone plus lookup), the school's
     copy of the council's page (refreshed each night, saved 1 September, saved in March), retraining
     (none, after each change), the date (tonight, Monday 2 November), a reply to play, reset. Stats:
     score of 20, changed rules right of 6, which questions are wrong, sounds like us, what it says
     about Malthouse Road, retraining cost and days of wrong answers over two years. selfTest: 10
     assertions.

   The model (stated in sim.lede, given data):
   - 20 questions about the town's road rules, each with its right answer from the council's dated
     page. 6 are on rules changed since March: the high street bus lane (Monday 1 June), the market
     lane made one-way (Monday 3 August), Malthouse Road 30 to 20 mph (Monday 12 October); two
     questions each. The other 14 are on rules unchanged since before March.
   - Fine-tuned in March (as now): right on the 14 unchanged rules, wrong on all 6 changed ones,
     because every one of the 3,200 answers was written before June. A line in its instructions
     ("always use the latest road rules") changes no mark. A bigger model trained on the same 3,200
     answers gets the same marks. All three sound like the instructors.
   - Lookup: before answering, the assistant finds the rules on the school's copy of the council's
     dated page that fit the question and answers from them. Right on every rule the copy has in its
     current form, except one: "is the cut-through one-way?", because the page calls that street
     Cordwainer Row. Lookup with no fine-tune does not sound like the instructors; the fine-tune kept
     for tone plus lookup does, with the same marks as lookup.
   - Copy of the page: refreshed each night (has all three changes); saved 1 September (has June and
     August, not Malthouse Road); saved in March (has none of the three).
   - Retraining: about $400 and three weeks (21 days) of instructor checking each time, as in March.
     After each change, the retrained model is right on that change's questions from 21 days later:
     1 June -> 22 June, 3 August -> 24 August, 12 October -> Monday 2 November.
   - The council changed 5 rules in the past two years.

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e01-v1.0.0.json):
   - Fine-tune only, tonight: 20 - 6 = 14 of 20; changed 0 of 6; Malthouse Road "30 mph".
   - Lookup, nightly copy: 20 - 1 (the cut-through) = 19 of 20; changed 6 of 6.
   - Lookup, copy saved 1 September: 19 - 2 (Malthouse Road) = 17 of 20. Saved in March: 19 - 6 = 13.
   - Retrain after each change, tonight: June and August done, Malthouse Road waits: 20 - 2 = 18 of 20.
     On Monday 2 November: 20 of 20.
   - Retraining over two years: 5 x $400 = $2,000; 5 x 21 = 105 days of wrong answers.
   - Lookup with the nightly copy: at most 1 day wrong per change, 5 x 1 = 5 days over two years.
   - The 14 Malthouse Road answers since Monday are from the chat log; the sim states them in the lede.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var COST = 400;          // dollars per retraining, as March cost
  var CHECK_DAYS = 21;     // three weeks of instructor checking per retraining
  var CHANGES_2Y = 5;      // council rule changes in the past two years
  // changes since March: day of the year 2026 the rule took effect, and the day a retrain would finish
  var CHANGES = {
    jun: { text: "1 June", day: 152, done: 173 },     // done 22 June
    aug: { text: "3 August", day: 215, done: 236 },   // done 24 August
    oct: { text: "12 October", day: 285, done: 306 }  // done Monday 2 November
  };
  var QUESTIONS = [
    { q: "high street bus lane: its hours", ch: "jun" },
    { q: "high street bus lane at 17:00: may I drive in it?", ch: "jun" },
    { q: "the market lane: which way does it run?", ch: "aug" },
    { q: "the market lane: may I turn in from the square?", ch: "aug" },
    { q: "Malthouse Road: the speed limit", ch: "oct" },
    { q: "Malthouse Road after dark: the speed limit", ch: "oct" },
    { q: "the bypass: the speed limit", ch: null },
    { q: "the roundabout by the bridge: which lane to turn right?", ch: null },
    { q: "the hospital road: the speed limit", ch: null },
    { q: "the level crossing: where to stop", ch: null },
    { q: "the high street: parking overnight", ch: null },
    { q: "the bridge: its width limit", ch: null },
    { q: "the ring road: the speed limit", ch: null },
    { q: "the box junction by the fire station: may I stop in it?", ch: null },
    { q: "the bus station: may learners turn in?", ch: null },
    { q: "the market square: may cars enter on market day?", ch: null },
    { q: "the canal road: its weight limit", ch: null },
    { q: "the park road after dark: the speed limit", ch: null },
    { q: "the station approach: may I wait there?", ch: null },
    { q: "the cut-through: is it one-way?", ch: null, nick: true }
  ];
  var APPROACHES = [
    { value: "ft", label: "fine-tune only (as now)", look: false, tone: true },
    { value: "line", label: "fine-tune, plus a line in its instructions", look: false, tone: true },
    { value: "big", label: "a bigger model, fine-tuned on the same 3,200", look: false, tone: true },
    { value: "look", label: "lookup in the dated page, no fine-tune", look: true, tone: false },
    { value: "both", label: "fine-tune for tone, plus lookup", look: true, tone: true }
  ];
  var COPIES = [
    { value: "nightly", label: "refreshed each night", has: 999 },
    { value: "sep", label: "saved 1 September, never refreshed", has: 244 },
    { value: "march", label: "saved in March, never refreshed", has: 59 }
  ];
  var RETRAIN = [
    { value: "none", label: "none" },
    { value: "each", label: "after each council change" }
  ];
  var DATES = [
    { value: "tonight", label: "tonight, Wednesday 14 October", day: 287 },
    { value: "2nov", label: "Monday 2 November", day: 306 }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a line in its instructions" },
    { value: "r1", label: "reply 1: lookup, training kept for tone" },
    { value: "r2", label: "reply 2: a bigger model, same answers" },
    { value: "r3", label: "reply 3: retrain after each change" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { approach: "ft", copy: "nightly", retrain: "none", date: "tonight", plan: "none" };
  }

  /* ---------- the model (pure: settings in, marks out) ---------- */

  function right(C, item) {
    var a = pick(APPROACHES, C.approach);
    var day = pick(DATES, C.date).day;
    if (a.look) {
      if (item.nick) return false;
      if (!item.ch) return true;
      return CHANGES[item.ch].day <= pick(COPIES, C.copy).has;
    }
    if (!item.ch) return true;
    return C.retrain === "each" && CHANGES[item.ch].done <= day;
  }

  function mark(C) {
    var R = { marks: [], score: 0, changed: 0, wrong: [], malt: "" };
    QUESTIONS.forEach(function (item, i) {
      var ok = right(C, item);
      R.marks.push(ok);
      if (ok) { R.score++; if (item.ch) R.changed++; }
      else R.wrong.push("q" + (i + 1));
    });
    R.malt = R.marks[4] ? "20 mph" : "30 mph";
    var a = pick(APPROACHES, C.approach);
    R.tone = a.tone ? "yes" : "no";
    if (a.look) {
      R.cost = "$0";
      R.days = C.copy === "nightly" ? (CHANGES_2Y * 1) + " days over two years" : "until the copy is refreshed";
    } else if (C.retrain === "each") {
      R.cost = "$" + (CHANGES_2Y * COST).toLocaleString("en-US") + " over two years";
      R.days = (CHANGES_2Y * CHECK_DAYS) + " days over two years";
    } else {
      R.cost = C.approach === "big" ? "$" + COST + " once" : "$0";
      R.days = "until the next training";
    }
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
    return { el: el, head: head, table: table };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var a = pick(APPROACHES, C.approach);
    ui.head.textContent = "the 20 questions. set-up: " + a.label + "." +
      (a.look ? " page copy: " + pick(COPIES, C.copy).label + "." : " retraining: " + pick(RETRAIN, C.retrain).label + ".") +
      " date: " + pick(DATES, C.date).label + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["#", "question", "rule changed", "answer"], true);
    QUESTIONS.forEach(function (item, i) {
      var m = S.R ? (S.R.marks[i] ? "right" : "wrong") : "-";
      row(ui, ["q" + (i + 1), item.q, item.ch ? CHANGES[item.ch].text : "no", m], false);
    });
  }

  function setStats(api) {
    var S = api.state;
    var st = S.stat;
    var ids = ["score", "changed", "wrong", "tone", "malt", "cost", "days"];
    if (!S.R) { ids.forEach(function (id) { st[id]("-"); }); return; }
    var R = S.R;
    st.score(R.score + " of 20");
    st.changed(R.changed + " of 6");
    st.wrong(R.wrong.length ? R.wrong.join(", ") : "none");
    st.tone(R.tone);
    st.malt(R.malt);
    st.cost(R.cost);
    st.days(R.days);
  }

  function run(api, what) {
    var S = api.state;
    S.R = mark(S.C);
    draw(api);
    setStats(api);
    var R = S.R;
    api.log((what ? what + " " : "") + "ran the 20: " + R.score + " of 20, changed rules " + R.changed +
      " of 6, sounds like us: " + R.tone + ", Malthouse Road: " + R.malt + ".",
      R.score >= 19 ? "ok" : (R.score >= 17 ? "warn" : "bad"));
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.approach = "line";
    if (plan === "r1") C.approach = "both";
    if (plan === "r2") C.approach = "big";
    if (plan === "r3") C.retrain = "each";
    return C;
  }

  function planFollowUp(api, plan) {
    if (plan === "r0") {
      api.log("the line asks for the latest rules; the only rules it has are in the 3,200 answers, all written before June.", "bad");
    }
    if (plan === "r1") {
      api.log("still wrong: q20, the cut-through. the page calls it Cordwainer Row.", "warn");
    }
    if (plan === "r2") {
      api.log("a bigger model, the same 3,200 answers: $" + COST + " and " + CHECK_DAYS + " days of checking, the same March rules.", "bad");
    }
    if (plan === "r3") {
      api.log("retraining after each change: $" + COST + " and " + CHECK_DAYS + " days each; Malthouse Road waits until Monday 2 November. over " +
        CHANGES_2Y + " changes in two years: $" + (CHANGES_2Y * COST).toLocaleString("en-US") + " and " + (CHANGES_2Y * CHECK_DAYS) + " days of wrong answers.", "warn");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.approach.set(S.C.approach);
        S.ctl.copy.set(S.C.copy);
        S.ctl.retrain.set(S.C.retrain);
        S.ctl.date.set(S.C.date);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        run(api, what);
      }
      function chooser(id, label, list, key) {
        S.ctl[id] = api.control.select(id, label, list, S.C[key], function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[key] = String(o.value);
          manual(label + ": " + o.label + ".");
        });
      }
      S.ctl.run = api.control.button("run", "run the 20 questions", function () { run(api, ""); });
      chooser("approach", "where its rules come from", APPROACHES, "approach");
      chooser("copy", "the school's copy of the page", COPIES, "copy");
      chooser("retrain", "retraining", RETRAIN, "retrain");
      chooser("date", "date", DATES, "date");
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        run(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        score: api.stat("score", "right answers of the 20", "warn"),
        changed: api.stat("changed", "changed rules right, of 6", "bad"),
        wrong: api.stat("wrong", "questions it gets wrong", "bad"),
        tone: api.stat("tone", "sounds like our instructors", "ok"),
        malt: api.stat("malt", "what it says for Malthouse Road", "bad"),
        cost: api.stat("cost", "retraining cost", ""),
        days: api.stat("days", "days of wrong answers over two years", "warn")
      };

      api.info("<strong>How to read it.</strong> Each row is one of the 20 questions, with the date its rule changed, if it did. Choose where the assistant gets its rules, then run: each answer is marked right or wrong against the council's dated page.");

      draw(api);
      setStats(api);
      api.log("Wednesday 14 October, after the night lesson. Nothing run yet: 20 questions, 6 on rules changed since March.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: nothing run.
      t.expect(t.stat("score") === "-" && t.stat("malt") === "-" &&
        has("Wednesday 14 October, after the night lesson. Nothing run yet"),
        "Opens on 14 October with nothing run");

      // 2. As it is: the March fine-tune scores 14 of 20, all 6 changed rules wrong.
      t.click("run");
      t.expect(t.stat("score") === "14 of 20" && t.stat("changed") === "0 of 6" &&
        t.stat("wrong") === "q1, q2, q3, q4, q5, q6" && t.stat("tone") === "yes" &&
        t.stat("malt") === "30 mph" && t.stat("days") === "until the next training",
        "Fine-tune only: 14 of 20, all 6 changed wrong, Malthouse Road 30 mph");

      // 3. A line in its instructions changes nothing.
      t.set("approach", "line");
      t.expect(t.stat("score") === "14 of 20" && t.stat("malt") === "30 mph",
        "Plus a line in its instructions: still 14 of 20");

      // 4. A bigger model on the same answers changes nothing.
      t.set("approach", "big");
      t.expect(t.stat("score") === "14 of 20" && t.stat("changed") === "0 of 6" && t.stat("cost") === "$400 once",
        "A bigger fine-tune on the same 3,200: 14 of 20, $400");

      // 5. Lookup alone: 19 of 20, the cut-through missed, not in the school's voice.
      t.set("approach", "look");
      t.expect(t.stat("score") === "19 of 20" && t.stat("changed") === "6 of 6" && t.stat("wrong") === "q20" &&
        t.stat("tone") === "no" && t.stat("malt") === "20 mph",
        "Lookup, no fine-tune: 19 of 20, only q20 wrong, tone lost");

      // 6. Fine-tune for tone plus lookup: 19 of 20 and the voice kept.
      t.set("approach", "both");
      t.expect(t.stat("score") === "19 of 20" && t.stat("tone") === "yes" && t.stat("cost") === "$0" &&
        t.stat("days") === "5 days over two years",
        "Fine-tune for tone plus lookup: 19 of 20, tone kept, $0, 5 days over two years");

      // 7. A stale copy of the page.
      t.set("copy", "sep");
      var sep = t.stat("score");
      var sepMalt = t.stat("malt");
      t.set("copy", "march");
      t.expect(sep === "17 of 20" && sepMalt === "30 mph" && t.stat("score") === "13 of 20" &&
        t.stat("days") === "until the copy is refreshed",
        "Copy saved 1 September: 17 of 20; saved in March: 13 of 20");

      // 8. Retraining after each change: 18 tonight, 20 on 2 November, $2,000 and 105 days over two years.
      t.set("copy", "nightly");
      t.set("approach", "ft");
      t.set("retrain", "each");
      var tonight = t.stat("score");
      var tonightMalt = t.stat("malt");
      t.set("date", "2nov");
      t.expect(tonight === "18 of 20" && tonightMalt === "30 mph" && t.stat("score") === "20 of 20" &&
        t.stat("malt") === "20 mph" && t.stat("cost") === "$2,000 over two years" &&
        t.stat("days") === "105 days over two years",
        "Retrain after each change: 18 tonight, 20 on 2 November, $2,000 and 105 days");

      // 9. Reply 1: lookup with the training kept for tone.
      t.set("plan", "r1");
      t.expect(t.stat("score") === "19 of 20" && t.stat("tone") === "yes" && t.stat("malt") === "20 mph" &&
        has("still wrong: q20, the cut-through. the page calls it Cordwainer Row."),
        "Reply 1: 19 of 20, tone kept, q20 still wrong");

      // 10. Replies 0, 2 and 3.
      t.set("plan", "r0");
      var p0 = t.stat("score") === "14 of 20" && has("all written before June");
      t.set("plan", "r2");
      var p2 = t.stat("score") === "14 of 20";
      t.set("plan", "r3");
      t.expect(p0 && p2 && t.stat("score") === "18 of 20" &&
        has("over 5 changes in two years: $2,000 and 105 days of wrong answers."),
        "Replies 0 and 2: 14 of 20; reply 3: 18 tonight, $2,000 and 105 days");
    }
  });
})();
