/* sims/a9e05-v1.0.0.js  (published as sims/a9e05.js)
   Case a9e05 "Writing It Down": an eval report reader for a wine merchant's assistant, from 09:00 on
   Friday 20 November 2026 (the report printed, before the demo) to the meeting at 10:00 on Monday
   7 December. No real model runs: every count below is given data, set out here and in sim.lede.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: question set (her 50, the owner's 10, tonight's 20),
     the report's headline metric, the staff check (vegan and allergy, every answer, off), force
     faithfulness to 50 of 50, a reply to play, reset. Stats: question set, page 1 says, does it
     answer his question, right sheet found, right answers, faithful, wrong year, staff check, held
     for staff, wrong vegan or allergy answers reaching the asker, all wrong answers reaching the
     asker, busy saturday replies, the demo's 3, what the reply shows. selfTest: 10 assertions.

   The given data (stated in sim.lede). Each question set is split into four groups:
     a = right sheet, faithful, right;  b = right sheet, not faithful, wrong;
     c = wrong year, faithful (to the other year's sheet), wrong;  d = wrong year, not faithful, wrong.
   - her 50 (one per wine, written by her from the sheets about what changed since the year before,
     run and marked on wednesday 18 november): a 33, b 1, c 15, d 1.
     about vegan or allergies: a 14, b 0, c 6, d 0 (20 in all).
     the rehearsed demo's 3 questions on friday 20 november are among the 33 in a.
   - tonight's 20 (the assistant's log, friday 4 december, checked after closing at 21:30):
     a 13, b 1, c 5, d 1; about vegan or allergies: a 5, b 0, c 3, d 1 (9 in all).
     the 20:40 question ('yes, the 2022 is vegan', answered from the 2021 sheet) is one of the 3 in c.
   - the owner's 10 (picked by him on monday 7 december): a 7, c 3; vegan or allergies a 2, c 2.
   - the staff check reads the bottle's back label, so it corrects every wrong vegan or allergy
     answer it holds.
   - forcing faithfulness to 50 of 50: b's answers stick to the right sheet and become right (b -> a);
     d's stick to the wrong year's sheet and stay wrong (d -> c).
   - a busy saturday (12 december): 120 questions, 30 about vegan or allergies; staff can check
     about 60 a day between customers.

   Where every number comes from (conventions rule 14; the case is content/latent/a9/a9e05-v1.0.0.json):
   - her 50: right sheet 33 + 1 = 34; wrong year 15 + 1 = 16; faithful 33 + 15 = 48; right 33.
     printed page 1: faithfulness 96% (48 of 50); page 2: right sheet found 34 of 50, right answers 33 of 50.
   - forced: faithful 50 of 50; right 33 + 1 = 34 of 50, never more than the 34 right sheets.
   - tonight's 20: right 13; faithful 13 + 5 = 18; right sheet 14; wrong 7, of them vegan or
     allergy 0 + 3 + 1 = 4; other wrong 3. check off: 4 wrong vegan or allergy answers reach guests.
     forced: right 14 of 20; still 4 wrong vegan or allergy answers.
   - the owner's 10: right 7 of 10, faithful 10 of 10; wrong 3, vegan or allergy 2 (held, corrected), 1 other.
   - busy saturday: check on vegan and allergy: 120 - 30 = 90 in seconds, 30 held, all checked the
     same day; check on every answer: 120 held, 60 checked the same day, 120 - 60 = 60 the next morning.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SETS = {
    hers: { n: 50, a: 33, b: 1, c: 15, d: 1, va: { a: 14, b: 0, c: 6, d: 0 } },
    owner: { n: 10, a: 7, b: 0, c: 3, d: 0, va: { a: 2, b: 0, c: 2, d: 0 } },
    tasting: { n: 20, a: 13, b: 1, c: 5, d: 1, va: { a: 5, b: 0, c: 3, d: 1 } }
  };
  var DEMO = 3;
  var SAT_Q = 120;
  var SAT_VA = 30;
  var SAT_STAFF = 60;
  var PRINTED = "faithfulness 96% (48 of 50)";

  var SET_OPTS = [
    { value: "hers", label: "her 50 (written by her from the sheets)" },
    { value: "owner", label: "the owner's 10 (picked by him on the day)" },
    { value: "tasting", label: "tonight's 20 (asked by guests at the tasting)" }
  ];
  var HEAD_OPTS = [
    { value: "faithfulness", label: "faithfulness (as printed)" },
    { value: "sheet", label: "right sheet found" },
    { value: "right", label: "right answers" }
  ];
  var CHECK_OPTS = [
    { value: "va", label: "vegan and allergy answers (as built)" },
    { value: "every", label: "every answer" },
    { value: "off", label: "off" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: raise faithfulness to 50 of 50" },
    { value: "r1", label: "reply 1: a longer report, every metric" },
    { value: "r2", label: "reply 2: reissue led by right answers, restore the check" },
    { value: "r3", label: "reply 3: staff check on every answer" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function of(n, d) { return n + " of " + d; }
  function defaults() {
    return { set: "hers", headline: "faithfulness", check: "va", forced: false, plan: "none" };
  }

  /* ---------- the count (pure: settings in, numbers out) ---------- */

  function count(C) {
    var s = SETS[C.set];
    var g = { a: s.a, b: s.b, c: s.c, d: s.d };
    var v = { a: s.va.a, b: s.va.b, c: s.va.c, d: s.va.d };
    if (C.forced) {
      g.a += g.b; v.a += v.b; g.b = 0; v.b = 0;
      g.c += g.d; v.c += v.d; g.d = 0; v.d = 0;
    }
    var R = { n: s.n, g: g, v: v };
    R.sheet = g.a + g.b;
    R.wrongYear = g.c + g.d;
    R.right = g.a;
    R.faithful = g.a + g.c;
    R.wrong = s.n - g.a;
    R.vaAll = v.a + v.b + v.c + v.d;
    R.vaWrong = v.b + v.c + v.d;
    R.otherWrong = R.wrong - R.vaWrong;
    if (C.check === "off") { R.held = 0; R.reachVa = R.vaWrong; R.reach = R.wrong; }
    else if (C.check === "va") { R.held = R.vaAll; R.reachVa = 0; R.reach = R.otherWrong; }
    else { R.held = s.n; R.reachVa = 0; R.reach = 0; }
    if (C.headline === "faithfulness") {
      R.page1 = (C.set === "hers" && !C.forced) ? PRINTED : "faithfulness " + of(R.faithful, R.n);
      R.answers = "no: it counts answers that stick to the sheet found, right year or not";
    } else if (C.headline === "sheet") {
      R.page1 = "right sheet found: " + of(R.sheet, R.n);
      R.answers = "no: the right sheet can still give a wrong answer";
    } else {
      R.page1 = "right answers: " + of(R.right, R.n);
      R.answers = "yes: answers true for the bottle asked about";
    }
    R.saturday = saturday(C.check);
    return R;
  }

  function saturday(check) {
    if (check === "off") return "all " + SAT_Q + " in seconds";
    if (check === "va") return (SAT_Q - SAT_VA) + " in seconds; " + SAT_VA + " held, all checked the same day";
    return SAT_Q + " held: " + SAT_STAFF + " checked the same day, " + (SAT_Q - SAT_STAFF) + " the next morning";
  }

  function report(plan) {
    if (plan === "r0") {
      var h0 = count({ set: "hers", headline: "faithfulness", check: "off", forced: true });
      var t0 = count({ set: "tasting", headline: "faithfulness", check: "off", forced: true });
      return "her 50: faithful " + of(h0.faithful, h0.n) + ", right " + of(h0.right, h0.n) + "; tonight's 20 replayed, check off: right " +
        of(t0.right, t0.n) + ", " + t0.reachVa + " wrong vegan or allergy answers reach the asker";
    }
    if (plan === "r1") {
      var h1 = count({ set: "hers", headline: "faithfulness", check: "off", forced: false });
      var t1 = count({ set: "tasting", headline: "faithfulness", check: "off", forced: false });
      return "page 1 still reads " + h1.page1 + "; right " + of(h1.right, h1.n) + " on page 3; tonight's 20 replayed, check off: right " +
        of(t1.right, t1.n) + ", " + t1.reachVa + " wrong vegan or allergy answers reach the asker";
    }
    if (plan === "r2") {
      var h2 = count({ set: "hers", headline: "right", check: "va", forced: false });
      var o2 = count({ set: "owner", headline: "right", check: "va", forced: false });
      return "page 1: " + h2.page1 + "; his 10: right " + of(o2.right, o2.n) + ", faithful " + of(o2.faithful, o2.n) + ", " + o2.vaWrong +
        " wrong vegan or allergy answers held and corrected, " + o2.otherWrong + " other wrong; busy saturday: " + o2.saturday;
    }
    if (plan === "r3") {
      var t3 = count({ set: "tasting", headline: "faithfulness", check: "every", forced: false });
      return "every answer held: " + t3.reach + " wrong answers reach the asker on tonight's 20; busy saturday: " + t3.saturday +
        "; page 1 still reads " + PRINTED;
    }
    return "not played yet";
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
    var R = count(C);
    var ui = api.state.ui;
    ui.head.textContent = "question set: " + pick(SET_OPTS, C.set).label + ". page 1 says: " + R.page1 +
      ". staff check: " + pick(CHECK_OPTS, C.check).label + ". faithfulness forced: " + (C.forced ? "yes" : "no") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["group", "questions", "faithful", "right", "about vegan or allergies"], true);
    row(ui, ["right sheet, faithful", R.g.a, "yes", "yes", R.v.a], false);
    row(ui, ["right sheet, not faithful", R.g.b, "no", "no", R.v.b], false);
    row(ui, ["wrong year, faithful", R.g.c, "yes", "no", R.v.c], false);
    row(ui, ["wrong year, not faithful", R.g.d, "no", "no", R.v.d], false);
    row(ui, ["all", R.n, R.faithful, R.right, R.vaAll], false);
    ui.note.textContent = "right sheet found " + of(R.sheet, R.n) + "; right answers " + of(R.right, R.n) + "; faithful " + of(R.faithful, R.n) +
      ". held for staff: " + R.held + ". wrong vegan or allergy answers reaching the asker: " + R.reachVa +
      ". the rehearsed demo's " + DEMO + " questions: all in 'right sheet, faithful' of her 50. reply played: " + report(C.plan) + ".";
  }

  function setStats(api) {
    var C = api.state.C;
    var R = count(C);
    var st = api.state.stat;
    st.set(pick(SET_OPTS, C.set).label);
    st.page1(R.page1);
    st.answers(R.answers);
    st.sheet(of(R.sheet, R.n));
    st.right(of(R.right, R.n));
    st.faithful(of(R.faithful, R.n));
    st.wrongyear(of(R.wrongYear, R.n));
    st.check(pick(CHECK_OPTS, C.check).label);
    st.held(R.held);
    st.reachva(R.reachVa);
    st.reach(R.reach);
    st.saturday(R.saturday);
    st.demo(DEMO + " of " + DEMO + ", all among her 33 right-sheet, faithful answers");
    st.report(report(C.plan));
  }

  function refresh(api) { draw(api); setStats(api); }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.set = "tasting"; C.check = "off"; C.forced = true; }
    if (plan === "r1") { C.set = "tasting"; C.check = "off"; }
    if (plan === "r2") { C.set = "owner"; C.headline = "right"; }
    if (plan === "r3") { C.set = "tasting"; C.check = "every"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = count(api.state.C);
    if (plan === "r0") api.log("instructions tightened: faithful " + of(R.faithful, R.n) + " on tonight's 20, right " + of(R.right, R.n) +
      ". the " + R.wrongYear + " wrong-year answers now stick to the wrong year's sheet. check still off: " + R.reachVa + " wrong vegan or allergy answers reach the asker.", "bad");
    if (plan === "r1") api.log("longer report, faithfulness still first. check still off: right " + of(R.right, R.n) + ", " + R.reachVa +
      " wrong vegan or allergy answers reach the asker.", "bad");
    if (plan === "r2") api.log("monday 10:00: page 1 " + count({ set: "hers", headline: "right", check: "va", forced: false }).page1 + ". his 10, picked on the spot: right " +
      of(R.right, R.n) + ", faithful " + of(R.faithful, R.n) + "; " + R.vaWrong + " wrong vegan or allergy answers held and corrected by staff.", "ok");
    if (plan === "r3") api.log("every answer held: " + R.reach + " wrong answers reach the asker. busy saturday: " + R.saturday + ".", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.set.set(S.C.set);
        S.ctl.headline.set(S.C.headline);
        S.ctl.check.set(S.C.check);
        S.ctl.forced.set(S.C.forced);
        S.sync = false;
      }
      function clearPlan() {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        }
      }
      S.ctl.set = api.control.select("set", "question set", SET_OPTS, "hers", function (val) {
        if (S.sync) return;
        var o = pick(SET_OPTS, val);
        if (!o) return;
        clearPlan();
        S.C.set = String(o.value);
        refresh(api);
        var R = count(S.C);
        api.log("question set: " + o.label + ". right sheet found " + of(R.sheet, R.n) + ", right " + of(R.right, R.n) + ", faithful " + of(R.faithful, R.n) + ".", "");
        if (S.C.set === "tasting") {
          api.log("20:40: 'yes, the 2022 is vegan', answered from the 2021 sheet; the bottle's back label says 'contains: egg'. wrong vegan or allergy answers reaching the asker: " +
            R.reachVa + ".", R.reachVa > 0 ? "bad" : "");
        }
      });
      S.ctl.headline = api.control.select("headline", "page 1 leads with", HEAD_OPTS, "faithfulness", function (val) {
        if (S.sync) return;
        var o = pick(HEAD_OPTS, val);
        if (!o) return;
        var before = count(S.C);
        clearPlan();
        S.C.headline = String(o.value);
        refresh(api);
        var R = count(S.C);
        api.log("page 1: '" + before.page1 + "' before, '" + R.page1 + "' after. answers his question? " + R.answers + ".", R.answers.indexOf("yes") === 0 ? "ok" : "warn");
      });
      S.ctl.check = api.control.select("check", "staff check", CHECK_OPTS, "va", function (val) {
        if (S.sync) return;
        var o = pick(CHECK_OPTS, val);
        if (!o) return;
        var before = count(S.C);
        clearPlan();
        S.C.check = String(o.value);
        refresh(api);
        var R = count(S.C);
        api.log("staff check: " + o.label + (S.C.check === "off" ? ", as the owner set it on the afternoon of friday 4 december" : "") +
          ". wrong vegan or allergy answers reaching the asker: " + before.reachVa + " before, " + R.reachVa + " after. busy saturday: " + R.saturday + ".",
          R.reachVa > 0 ? "bad" : (S.C.check === "every" ? "warn" : ""));
      });
      S.ctl.forced = api.control.toggle("forced", "force faithfulness to 50 of 50 (stick to the sheet found)", false, function (on) {
        if (S.sync) return;
        var before = count(S.C);
        clearPlan();
        S.C.forced = !!on;
        refresh(api);
        var R = count(S.C);
        api.log("faithfulness forced " + (on ? "on" : "off") + ". faithful: " + of(before.faithful, before.n) + " before, " + of(R.faithful, R.n) +
          " after. right: " + of(before.right, before.n) + " before, " + of(R.right, R.n) + " after, never more than the " + R.sheet + " right sheets found.", "");
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
        set: api.stat("set", "question set", ""),
        page1: api.stat("page1", "page 1 says", ""),
        answers: api.stat("answers", "answers his question?", ""),
        sheet: api.stat("sheet", "right sheet found", ""),
        right: api.stat("right", "right answers", "ok"),
        faithful: api.stat("faithful", "faithful to the sheet found", ""),
        wrongyear: api.stat("wrongyear", "wrong year's sheet found", "warn"),
        check: api.stat("check", "staff check holds", ""),
        held: api.stat("held", "answers held for staff", ""),
        reachva: api.stat("reachva", "wrong vegan or allergy answers reaching the asker", "bad"),
        reach: api.stat("reach", "all wrong answers reaching the asker", "bad"),
        saturday: api.stat("saturday", "busy saturday replies (120 questions)", ""),
        demo: api.stat("demo", "the rehearsed demo's questions", ""),
        report: api.stat("report", "the reply played shows", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of the chosen question set. First the assistant finds a sheet: the right wine and year, or the same wine's other year. Then the model writes from that sheet, and the answer either sticks to it (faithful) or adds something it doesn't say. 'Right' means true for the bottle asked about. The last column counts questions about vegan or allergies, the ones the staff check holds.");

      refresh(api);
      api.log("friday 20 november, 09:00. the report is printed: page 1, " + PRINTED + "; page 2, right sheet found 34 of 50, right answers 33 of 50. the staff check holds every vegan or allergy answer.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the report as printed, the check on vegan and allergy answers.
      t.expect(t.stat("page1") === "faithfulness 96% (48 of 50)" && t.stat("sheet") === "34 of 50" && t.stat("right") === "33 of 50" &&
        t.stat("faithful") === "48 of 50" && t.stat("wrongyear") === "16 of 50" && t.stat("held") === 20 && t.stat("reachva") === 0 &&
        t.stat("demo") === "3 of 3, all among her 33 right-sheet, faithful answers" && has("friday 20 november, 09:00"),
        "Opens on 20 November: page 1 faithfulness 96% (48 of 50); right sheet 34, right 33, wrong year 16; the check holds 20");

      // 2. The owner switches the check off; tonight's 20: 13 right, 4 wrong vegan or allergy answers reach guests.
      t.set("check", "off");
      t.set("set", "tasting");
      t.expect(t.stat("right") === "13 of 20" && t.stat("faithful") === "18 of 20" && t.stat("sheet") === "14 of 20" && t.stat("reachva") === 4 &&
        t.stat("reach") === 7 && has("'contains: egg'"),
        "Check off, tonight's 20: right 13 of 20, faithful 18 of 20, 4 wrong vegan or allergy answers and 7 wrong in all reach the asker");

      // 3. Faithfulness forced to 50 of 50 on her 50: right stops at 34.
      t.set("set", "hers");
      t.set("forced", true);
      t.expect(t.stat("faithful") === "50 of 50" && t.stat("right") === "34 of 50" && t.stat("sheet") === "34 of 50" && t.stat("reachva") === 6 &&
        has("never more than the 34 right sheets found"),
        "Forced: faithful 50 of 50, right 34 of 50, no more than the right sheets; 6 wrong vegan or allergy answers remain");

      // 4. The headline that answers his question.
      t.set("forced", false);
      t.set("headline", "right");
      t.expect(t.stat("page1") === "right answers: 33 of 50" && t.stat("answers") === "yes: answers true for the bottle asked about",
        "Headline right answers: 33 of 50, and it answers his question");

      // 5. The staff check on every answer: nothing wrong reaches anyone, and a busy saturday waits.
      t.set("check", "every");
      t.expect(t.stat("reach") === 0 && t.stat("reachva") === 0 && t.stat("held") === 50 &&
        t.stat("saturday") === "120 held: 60 checked the same day, 60 the next morning",
        "Check on every answer: 0 wrong reach the asker; busy saturday 60 checked the same day, 60 the next morning");

      // 6. The owner's 10: 7 right, 10 faithful.
      t.set("check", "va");
      t.set("set", "owner");
      t.expect(t.stat("right") === "7 of 10" && t.stat("faithful") === "10 of 10" && t.stat("held") === 4 && t.stat("reach") === 1 &&
        t.stat("saturday") === "90 in seconds; 30 held, all checked the same day",
        "The owner's 10: right 7 of 10, faithful 10 of 10; the check holds 4; busy saturday 90 in seconds, 30 held");

      // 7. Reply 0: faithful to the wrong year.
      t.set("plan", "r0");
      t.expect(t.stat("report") === "her 50: faithful 50 of 50, right 34 of 50; tonight's 20 replayed, check off: right 14 of 20, 4 wrong vegan or allergy answers reach the asker" &&
        t.stat("right") === "14 of 20", "Reply 0: 50 of 50 faithful, 34 of 50 right; tonight 14 of 20, 4 reach the asker");

      // 8. Reply 1: the same first line.
      t.set("plan", "r1");
      t.expect(t.stat("report") === "page 1 still reads faithfulness 96% (48 of 50); right 33 of 50 on page 3; tonight's 20 replayed, check off: right 13 of 20, 4 wrong vegan or allergy answers reach the asker" &&
        t.stat("reachva") === 4, "Reply 1: page 1 unchanged; tonight 13 of 20, 4 reach the asker");

      // 9. Reply 2: led by right answers, the check restored, his 10 picked on the day.
      t.set("plan", "r2");
      t.expect(t.stat("report") === "page 1: right answers: 33 of 50; his 10: right 7 of 10, faithful 10 of 10, 2 wrong vegan or allergy answers held and corrected, 1 other wrong; busy saturday: 90 in seconds; 30 held, all checked the same day" &&
        t.stat("reachva") === 0 && has("held and corrected by staff"), "Reply 2: right answers 33 of 50 first; his 10: 7 right, 10 faithful, 2 held and corrected");

      // 10. Reply 3: safe, and slow on a busy saturday.
      t.set("plan", "r3");
      t.expect(t.stat("report") === "every answer held: 0 wrong answers reach the asker on tonight's 20; busy saturday: 120 held: 60 checked the same day, 60 the next morning; page 1 still reads faithfulness 96% (48 of 50)" &&
        t.stat("held") === 20, "Reply 3: 0 wrong reach the asker; 60 of 120 busy-saturday replies wait until the next morning");
    }
  });
})();
