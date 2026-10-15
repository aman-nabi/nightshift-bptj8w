/* sims/a8e03-v1.0.0.js  (published as sims/a8e03.js)
   Case a8e03 "Making Its Own Lessons": a contamination checker for the answer checker on Wakeful,
   a late-night quiz show. No real model runs here: every card, pair and score is a count from the
   given data below, checkable by hand. Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: test set written fresh and locked before generating
     (or drawn from the archive afterwards), twin filter, hand check of a 100-pair sample, rewrites per
     archive question (3, so 6,000 pairs, or 10, so 20,000), check tonight's 40 cards by hand, run the
     checker on the 100 practice cards, ask the bigger model to grade, a reply to play, reset. Stats:
     training pairs, test cards with a twin, score on the test set, score on the practice cards, points
     the sheet overstates, tonight's wrong cards stamped verified, wrong made-up pairs found, the bigger
     model's grade, hand-check hours per episode. selfTest: 11 assertions.

   The given data (stated in sim.lede):
   - Archive: 2,000 checked questions, ten series of 200. The bigger model rewrote each one 3 times
     (6,000 pairs, Monday 1 June 2026) or, in reply 1, 10 times (20,000 pairs).
   - Test set drawn from the archive afterwards (Monday 8 June), 200 cards, in three groups:
       164 cards have a twin with 3 rewrites or 10; unseen, the checker would stamp 136 of them right.
        24 cards have a twin only with 10 rewrites; unseen, 20 right.
        12 cards never have a twin; unseen, 10 right.
     A card with a twin in training is always stamped right (the checker in effect remembers it).
   - Test set written fresh on the new topics and locked before generating, 200 cards:
         6 cards the archive had asked before in nearly the same words, so they have twins; unseen, 4 right.
       194 other cards; unseen, 140 right.
   - The twin filter drops every pair that shares the answer and most words with a test card, so no
     card keeps a twin.
   - The 100 practice cards written this month on new topics, checked by Eirlys: the checker agrees
     with her on 72. Rewrites of the same archive teach nothing about new topics, so 72 holds in every
     setting. The bigger model, asked to grade those 100 stamps, marks 91 right.
   - Tonight's 40 first-draft cards: 11 wrong (cards 3, 7, 9, 12, 15, 18, 22, 26, 29, 33, 38);
     the checker stamped all but cards 12 and 29 verified: 9 of 11. Card 7 is the octopus.
   - The hand-checked sample: pairs 6, 14, 27, 41, 58, 63, 79 and 92 of 100 are wrong: 8 of 100.
   - A hand check of every card takes about 4.5 minutes, so 40 cards take 180 minutes: 3 hours.

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e03-v1.0.0.json):
   - As released: 6,000 pairs, 164 twins, 164 + 20 + 10 = 194 of 200 (97%); the 36 without a twin:
     30 right.
   - 20,000 pairs: 188 twins, 188 + 10 = 198 of 200 (99%). Twin filter on the drawn set:
     136 + 20 + 10 = 166 (83%). Locked first: 6 + 140 = 146 (73%); with the filter 4 + 140 = 144 (72%).
   - Points the sheet overstates: 97 - 72 = 25; 99 - 72 = 27; 83 - 72 = 11; 73 - 72 = 1; 72 - 72 = 0.
   - Wrong pairs: 8 of 100 is 8%, so about 480 of 6,000 and 1,600 of 20,000.
   - Reply 0: 144 of 200 (72%), 0 twins, 0 points. Reply 1: 20,000, 188, 198 of 200 (99%), 27 points,
     still 9 of 11. Reply 2: grade 91 of 100 against 72. Reply 3: 3 hours, all 11 caught by hand.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var ARCHIVE = 2000;
  var TEST = 200;
  var DRAWN = [
    { name: "twin with 3 or 10 rewrites", n: 164, twin3: true, twin10: true, unseen: 136 },
    { name: "twin only with 10 rewrites", n: 24, twin3: false, twin10: true, unseen: 20 },
    { name: "never a twin", n: 12, twin3: false, twin10: false, unseen: 10 }
  ];
  var LOCKED = [
    { name: "asked before in the archive", n: 6, twin3: true, twin10: true, unseen: 4 },
    { name: "new to the archive", n: 194, twin3: false, twin10: false, unseen: 140 }
  ];
  var PRACTICE = 100;
  var PRACTICE_RIGHT = 72;
  var GRADER_RIGHT = 91;
  var MINUTES_PER_CARD = 4.5;
  var WRONG_TONIGHT = [3, 7, 9, 12, 15, 18, 22, 26, 29, 33, 38];
  var STAMPED_CHECK = [12, 29];
  var SAMPLE_SIZE = 100;
  var SAMPLE_WRONG = [6, 14, 27, 41, 58, 63, 79, 92];

  var TONIGHT = [];
  for (var i = 1; i <= 40; i++) {
    var wrong = WRONG_TONIGHT.indexOf(i) >= 0;
    TONIGHT.push({ id: i, wrong: wrong, stamp: (wrong && STAMPED_CHECK.indexOf(i) >= 0) ? "check" : "verified" });
  }

  var PAIRS = [
    { value: "6000", label: "3 rewrites each: 6,000 pairs", rewrites: 3 },
    { value: "20000", label: "10 rewrites each: 20,000 pairs", rewrites: 10 }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: lock first, filter, sample" },
    { value: "r1", label: "reply 1: 20,000 pairs" },
    { value: "r2", label: "reply 2: the bigger model grades" },
    { value: "r3", label: "reply 3: Eirlys checks every card" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function defaults() {
    return { locked: false, filter: false, sample: false, pairs: "6000", plan: "none",
      tonight: false, practice: false, grader: false, every: false };
  }

  /* ---------- the model (pure: settings in, answers out) ---------- */

  function measure(C) {
    var p = pick(PAIRS, C.pairs);
    var key = p.rewrites === 10 ? "twin10" : "twin3";
    var groups = C.locked ? LOCKED : DRAWN;
    var twins = 0, right = 0, rows = [];
    groups.forEach(function (g) {
      var isTwin = g[key] && !C.filter;
      var r = isTwin ? g.n : g.unseen;
      if (isTwin) twins += g.n;
      right += r;
      rows.push({ name: g.name, n: g.n, twin: isTwin, right: r });
    });
    var pct = Math.round(right * 100 / TEST);
    var pairs = ARCHIVE * p.rewrites;
    var wrongTonight = TONIGHT.filter(function (c) { return c.wrong; });
    var verified = wrongTonight.filter(function (c) { return c.stamp === "verified"; }).length;
    var R = {
      pairs: pairs, twins: twins, right: right, pct: pct, rows: rows,
      score: right + " of " + TEST + " (" + pct + "%)",
      practice: C.practice ? PRACTICE_RIGHT + " of " + PRACTICE + " (" + PRACTICE_RIGHT + "%)" : "not run yet",
      gap: C.practice ? (pct - PRACTICE_RIGHT) + " points" : "not known yet",
      tonight: !C.tonight ? "not checked yet" :
        (verified + " of " + wrongTonight.length + (C.every ? "; all " + wrongTonight.length + " caught by hand" : "")),
      wrong: C.sample ? SAMPLE_WRONG.length + " of " + SAMPLE_SIZE + ", about " +
        fmt(Math.round(pairs * SAMPLE_WRONG.length / SAMPLE_SIZE)) + " of " + fmt(pairs) : "not checked",
      grade: C.grader ? GRADER_RIGHT + " of " + PRACTICE : "not asked",
      hours: C.every ? Math.round(TONIGHT.length * MINUTES_PER_CARD / 60) : 0,
      nWrong: wrongTonight.length, nVerified: verified
    };
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
    var R = measure(C);
    var ui = api.state.ui;
    ui.head.textContent = "the test set: " + (C.locked ? "200 cards written fresh and locked before generating" :
      "200 cards drawn from the archive after generating") + ". training pairs: " + fmt(R.pairs) +
      ". twin filter: " + (C.filter ? "on" : "off") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["test cards", "count", "twin in training", "stamped right"], true);
    R.rows.forEach(function (r) { row(ui, [r.name, r.n, r.twin ? "yes" : "no", r.right], false); });
    row(ui, ["all", TEST, R.twins, R.right], false);
    ui.note.textContent = "a card with a twin in training is always stamped right: memory, not checking. " +
      "the sheet would print " + R.pct + "%. the practice cards: " + R.practice + ".";
  }

  function setStats(api) {
    var R = measure(api.state.C);
    var st = api.state.stat;
    st.pairs(fmt(R.pairs));
    st.twins(R.twins);
    st.score(R.score);
    st.practice(R.practice);
    st.gap(R.gap);
    st.tonight(R.tonight);
    st.wrong(R.wrong);
    st.grade(R.grade);
    st.hours(R.hours);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = measure(api.state.C);
    if (what) api.log(what + " twins " + R.twins + "; test score " + R.score + ".",
      R.twins === 0 ? "ok" : (R.twins > 100 ? "bad" : "warn"));
  }

  function tonightText() {
    return "tonight's 40 first-draft cards checked by hand: 11 of 40 cards wrong, cards " + WRONG_TONIGHT.join(", ") +
      ". the checker stamped 9 of the 11 verified, card 7 among them; it stamped only cards 12 and 29 check.";
  }
  function practiceText(C) {
    var R = measure(C);
    return "the checker on the 100 practice cards: agrees with Eirlys on 72 of 100. the sheet would say " + R.pct +
      "%, so it overstates by " + (R.pct - PRACTICE_RIGHT) + " points.";
  }
  function sampleText(C) {
    var R = measure(C);
    return "sample of 100 made-up pairs checked against their archive questions: wrong in pairs " +
      SAMPLE_WRONG.join(", ") + ". " + R.wrong + ".";
  }
  var GRADER_TEXT = "the bigger model graded the 100 practice stamps: 91 of 100 right. Eirlys's sources say 72. " +
    "it passes stamps that match what it would have answered itself.";

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.tonight = true;
    C.practice = true;
    if (plan === "r0") { C.locked = true; C.filter = true; C.sample = true; }
    if (plan === "r1") C.pairs = "20000";
    if (plan === "r2") C.grader = true;
    if (plan === "r3") C.every = true;
    return C;
  }

  function planFollowUp(api, plan) {
    var C = api.state.C;
    if (plan === "r0") {
      api.log("200 test cards written on the new topics and locked before generating. the twin filter found 6 the archive " +
        "had asked before and dropped the pairs that echoed them: 0 twins left.", "ok");
      api.log(sampleText(C), "warn");
      api.log("score on the locked cards: 144 of 200 (72%), the same as the practice cards. the sheet tells the truth before release.", "ok");
    }
    if (plan === "r1") {
      api.log("10 rewrites of each archive question: 20,000 pairs. at 8 in 100, about 1,600 of them carry a wrong stamp.", "bad");
      api.log("test set drawn afterwards: 188 twins, 198 of 200 (99%). practice cards still 72; tonight still 9 of 11 verified.", "bad");
    }
    if (plan === "r2") {
      api.log(GRADER_TEXT, "bad");
      api.log("tonight still 9 of 11 wrong cards stamped verified; the sheet still says 97%.", "bad");
    }
    if (plan === "r3") {
      api.log("Eirlys checks every card: 40 cards at about 4.5 minutes each, 3 hours an episode. all 11 wrong cards caught.", "warn");
      api.log("the checker is unchanged: the sheet still says 97%, the practice cards 72.", "warn");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.locked.set(S.C.locked);
        S.ctl.filter.set(S.C.filter);
        S.ctl.sample.set(S.C.sample);
        S.ctl.pairs.set(S.C.pairs);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.C.every = false;
          S.C.grader = false;
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        refresh(api, what);
      }
      function flag(id, label) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          if (S.sync) return;
          S.C[id] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
          if (id === "sample" && on) api.log(sampleText(S.C), "warn");
        });
      }
      flag("locked", "test set written fresh and locked before generating");
      flag("filter", "twin filter");
      flag("sample", "hand-check a sample of 100 made-up pairs");
      S.ctl.pairs = api.control.select("pairs", "rewrites per archive question", PAIRS, "6000", function (val) {
        if (S.sync) return;
        var o = pick(PAIRS, val);
        if (!o) return;
        S.C.pairs = String(o.value);
        manual("pairs: " + o.label + ".");
      });
      S.ctl.tonight = api.control.button("tonight", "check tonight's 40 cards by hand", function () {
        S.C.tonight = true;
        refresh(api, "");
        api.log(tonightText(), "bad");
      });
      S.ctl.practice = api.control.button("practice", "run the checker on the 100 practice cards", function () {
        S.C.practice = true;
        refresh(api, "");
        api.log(practiceText(S.C), measure(S.C).pct === PRACTICE_RIGHT ? "ok" : "bad");
      });
      S.ctl.grader = api.control.button("grader", "ask the bigger model to grade the practice stamps", function () {
        S.C.grader = true;
        refresh(api, "");
        api.log(GRADER_TEXT, "bad");
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        pairs: api.stat("pairs", "training pairs", ""),
        twins: api.stat("twins", "test cards with a twin in training", "bad"),
        score: api.stat("score", "score on the test set (the sheet)", "warn"),
        practice: api.stat("practice", "score on the 100 practice cards", ""),
        gap: api.stat("gap", "points the sheet overstates", "bad"),
        tonight: api.stat("tonight", "tonight's wrong cards stamped verified", "bad"),
        wrong: api.stat("wrong", "wrong made-up pairs found", "warn"),
        grade: api.stat("grade", "the bigger model's grade of the practice stamps", ""),
        hours: api.stat("hours", "hand-check hours per episode", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of test cards: how many, whether a twin (a training pair asking the same question in most of the same words, with the same right answer) sits in training, and how many the checker stamps right. Change how the test set is made, the filter and the number of pairs, then compare the test score with the practice cards.");

      refresh(api, "");
      api.log("Monday 12 October, 23:59 at Wakeful, before the night writer reads the batch. the sheet on the wall says 97%.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the checker as released, nothing checked yet.
      t.expect(t.stat("pairs") === "6,000" && t.stat("twins") === 164 && t.stat("score") === "194 of 200 (97%)" &&
        t.stat("practice") === "not run yet" && t.stat("tonight") === "not checked yet" && t.stat("hours") === 0 &&
        has("the sheet on the wall says 97%"),
        "Opens as released: 6,000 pairs, 164 twins, 194 of 200 (97%)");

      // 2. Tonight's 40 cards: 11 wrong, 9 stamped verified.
      t.click("tonight");
      t.expect(t.stat("tonight") === "9 of 11" && has("11 of 40 cards wrong"),
        "Tonight: 11 of 40 wrong, 9 of the 11 stamped verified");

      // 3. The practice cards: 72 of 100, so the sheet overstates by 25 points.
      t.click("practice");
      t.expect(t.stat("practice") === "72 of 100 (72%)" && t.stat("gap") === "25 points",
        "Practice cards: 72 of 100; the sheet overstates by 25 points");

      // 4. The hand-checked sample: 8 of 100, about 480 of 6,000.
      t.set("sample", true);
      t.expect(t.stat("wrong") === "8 of 100, about 480 of 6,000" && has("wrong in pairs 6, 14, 27"),
        "Sample: 8 of 100 wrong, about 480 of 6,000");

      // 5. 20,000 pairs: more twins, a higher sheet, more wrong pairs.
      t.set("pairs", "20000");
      var big = t.stat("pairs") === "20,000" && t.stat("twins") === 188 && t.stat("score") === "198 of 200 (99%)" &&
        t.stat("gap") === "27 points" && t.stat("wrong") === "8 of 100, about 1,600 of 20,000";
      t.set("pairs", "6000");
      t.expect(big && t.stat("twins") === 164, "20,000 pairs: 188 twins, 198 of 200 (99%), about 1,600 wrong");

      // 6. The twin filter on the drawn test set shows part of the gap.
      t.set("filter", true);
      t.expect(t.stat("twins") === 0 && t.stat("score") === "166 of 200 (83%)" && t.stat("gap") === "11 points",
        "Twin filter on the drawn set: 0 twins, 166 of 200 (83%)");

      // 7. Locked first: 6 repeats without the filter, 144 of 200 (72%) with it.
      t.set("filter", false); t.set("locked", true);
      var lockedOff = t.stat("twins") === 6 && t.stat("score") === "146 of 200 (73%)";
      t.set("filter", true);
      t.expect(lockedOff && t.stat("twins") === 0 && t.stat("score") === "144 of 200 (72%)" && t.stat("gap") === "0 points",
        "Locked first: 6 twins and 146 (73%); with the filter 0 twins and 144 of 200 (72%)");

      // 8. Reply 0: lock first, filter, sample.
      t.set("plan", "r0");
      t.expect(t.stat("score") === "144 of 200 (72%)" && t.stat("gap") === "0 points" &&
        t.stat("wrong") === "8 of 100, about 480 of 6,000" && t.stat("tonight") === "9 of 11",
        "Reply 0: 144 of 200 (72%), 0 points, 8 of 100 found");

      // 9. Reply 1: 20,000 pairs.
      t.set("plan", "r1");
      t.expect(t.stat("pairs") === "20,000" && t.stat("twins") === 188 && t.stat("score") === "198 of 200 (99%)" &&
        t.stat("practice") === "72 of 100 (72%)" && has("about 1,600 of them"),
        "Reply 1: 20,000 pairs, 188 twins, 99%, practice still 72");

      // 10. Reply 2: the bigger model grades.
      t.set("plan", "r2");
      t.expect(t.stat("grade") === "91 of 100" && t.stat("practice") === "72 of 100 (72%)" &&
        t.stat("score") === "194 of 200 (97%)" && t.stat("tonight") === "9 of 11",
        "Reply 2: the grade says 91 of 100, Eirlys 72");

      // 11. Reply 3: Eirlys checks every card.
      t.set("plan", "r3");
      t.expect(t.stat("hours") === 3 && t.stat("tonight") === "9 of 11; all 11 caught by hand" &&
        t.stat("score") === "194 of 200 (97%)",
        "Reply 3: 3 hours an episode, all 11 caught, the sheet still 97%");
    }
  });
})();
