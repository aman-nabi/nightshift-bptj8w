/* sims/a5e01-v1.0.0.js  (published as sims/a5e01.js)
   Case a5e01 "Who Grades the Oracle": an eval lab for Quillfield Tutoring's late help room, where
   students revise with a maths helper (a model with a system prompt). No real model runs here: the
   helper's verdict on each of 20 golden questions is stated below for each of three prompts, the way
   Prudencia recorded them at 02:00 on Thursday. Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 20 golden questions (12 algebra, 8 geometry), each with its known
     answer, a student's answer and whether that answer is right; the helper's verdict under three
     prompts (before: Monday's; after: Tuesday's "be more encouraging"; after plus a line: "never praise a
     wrong answer"). Controls: prompt, measure (thumbs-up rate, verdict accuracy overall, verdict accuracy
     by topic, a teacher's Friday reading), pass bar (70%, 80%, 90%), reset. Stats: prompt, verdicts
     correct, overall, algebra, geometry, wrong answers praised, right answers called wrong, thumbs-up
     rate, the gate, when you would know. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - A verdict is correct when the helper calls a right answer right or a wrong answer wrong.
   - Thumbs up: the help room's log rule. A student told "right" taps thumbs up; told "wrong", thumbs
     down. So the thumbs-up rate on the set is the share of verdicts that say "right".
   - Gate: a prompt passes when every score the chosen measure uses is at or above the bar.
     Thumbs-up: the thumbs-up rate. Overall: verdicts correct over all 20. By topic: algebra and
     geometry each. The teacher's Friday reading is no gate: it happens after the change ships.

   Where every number comes from (conventions rule 14; the case is content/latent/a5/a5e01-v1.0.0.json).
   All of them follow from SET below and the rules above, and the selfTest checks them.
   - The set: 12 algebra (A1 to A12), 6 student answers wrong (A2, A3, A6, A7, A9, A11); 8 geometry
     (G1 to G8), 3 wrong (G2, G4, G6).
   - Before: every verdict correct except A11 (x = 4 for -3x = 12, called right). Algebra 11 of 12
     (91.7%), geometry 8 of 8 (100%), overall 19 of 20 (95%). Wrong answers praised 1, right answers
     called wrong 0. Says "right" 7 + 5 = 12 times: thumbs-up 12 of 20 (60%).
   - After: every algebra answer called right. Algebra 6 of 12 (50%), geometry 8 of 8, overall 14 of 20
     (70%). Wrong answers praised 6. Says "right" 12 + 5 = 17 times: thumbs-up 17 of 20 (85%).
   - After plus the line: A6, A9, A11 still called right; G3 (18.8 cm) and G7 (65 degrees) now called
     wrong. Algebra 9 of 12 (75%), geometry 6 of 8 (75%), overall 15 of 20 (75%). Wrong answers praised
     3, right answers called wrong 2. Says "right" 9 + 3 = 12 times: thumbs-up 12 of 20 (60%).
   - Gates. Thumbs-up: before fails at 70% (60%), after passes at 70% and 80% (85%), fails at 90%.
     Overall: after passes at 70% (70%), fails at 80%; before passes at 90% (95%). By topic: after fails
     at every bar (algebra 50%); the line passes at 70% (75% and 75%), fails at 80%; before passes at 90%
     (algebra 91.7%).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // v: the helper's verdict under [before, after, after plus the line]. ok: the student's answer is right.
  var SET = [
    { id: "A1", topic: "algebra", q: "Solve 3x + 5 = 20", key: "x = 5", ans: "x = 5", ok: true, v: ["right", "right", "right"] },
    { id: "A2", topic: "algebra", q: "Solve 2x - 7 = 9", key: "x = 8", ans: "x = 1", ok: false, v: ["wrong", "right", "wrong"] },
    { id: "A3", topic: "algebra", q: "Expand -2(x - 4)", key: "-2x + 8", ans: "-2x - 8", ok: false, v: ["wrong", "right", "wrong"] },
    { id: "A4", topic: "algebra", q: "Solve x / 4 = 3", key: "x = 12", ans: "x = 12", ok: true, v: ["right", "right", "right"] },
    { id: "A5", topic: "algebra", q: "Factorise x² - 9", key: "(x - 3)(x + 3)", ans: "(x - 3)(x + 3)", ok: true, v: ["right", "right", "right"] },
    { id: "A6", topic: "algebra", q: "Solve 5 - x = 2", key: "x = 3", ans: "x = -3", ok: false, v: ["wrong", "right", "right"] },
    { id: "A7", topic: "algebra", q: "Simplify 4a - 6a", key: "-2a", ans: "2a", ok: false, v: ["wrong", "right", "wrong"] },
    { id: "A8", topic: "algebra", q: "Solve 2(x + 1) = 10", key: "x = 4", ans: "x = 4", ok: true, v: ["right", "right", "right"] },
    { id: "A9", topic: "algebra", q: "Solve x² = 16", key: "x = 4 or x = -4", ans: "x = 4", ok: false, v: ["wrong", "right", "right"] },
    { id: "A10", topic: "algebra", q: "Expand (x + 2)(x + 3)", key: "x² + 5x + 6", ans: "x² + 5x + 6", ok: true, v: ["right", "right", "right"] },
    { id: "A11", topic: "algebra", q: "Solve -3x = 12", key: "x = -4", ans: "x = 4", ok: false, v: ["right", "right", "right"] },
    { id: "A12", topic: "algebra", q: "Simplify 6x / 3", key: "2x", ans: "2x", ok: true, v: ["right", "right", "right"] },
    { id: "G1", topic: "geometry", q: "Third angle of a triangle with 50° and 60°", key: "70°", ans: "70°", ok: true, v: ["right", "right", "right"] },
    { id: "G2", topic: "geometry", q: "Area of a 6 cm by 4 cm rectangle", key: "24 cm²", ans: "20 cm²", ok: false, v: ["wrong", "wrong", "wrong"] },
    { id: "G3", topic: "geometry", q: "Circumference, radius 3 cm, to 1 decimal place", key: "18.8 cm", ans: "18.8 cm", ok: true, v: ["right", "right", "wrong"] },
    { id: "G4", topic: "geometry", q: "Longest side of a right triangle with sides 3 and 4", key: "5", ans: "7", ok: false, v: ["wrong", "wrong", "wrong"] },
    { id: "G5", topic: "geometry", q: "Angles inside a quadrilateral add to", key: "360°", ans: "360°", ok: true, v: ["right", "right", "right"] },
    { id: "G6", topic: "geometry", q: "Area of a triangle, base 10 cm, height 6 cm", key: "30 cm²", ans: "60 cm²", ok: false, v: ["wrong", "wrong", "wrong"] },
    { id: "G7", topic: "geometry", q: "Angle on a straight line beside 115°", key: "65°", ans: "65°", ok: true, v: ["right", "right", "wrong"] },
    { id: "G8", topic: "geometry", q: "Volume of a cube with 3 cm sides", key: "27 cm³", ans: "27 cm³", ok: true, v: ["right", "right", "right"] }
  ];
  var TOPICS = ["algebra", "geometry"];

  var PROMPTS = [
    { value: "0", label: "Before: Monday's prompt" },
    { value: "1", label: "After: Tuesday's \"be more encouraging\"" },
    { value: "2", label: "After plus \"never praise a wrong answer\"" }
  ];
  var SHORT = ["before", "after", "after plus the line"];
  var MEASURES = [
    { value: "thumbs", label: "Thumbs-up rate" },
    { value: "overall", label: "Verdict accuracy, overall" },
    { value: "topic", label: "Verdict accuracy, by topic" },
    { value: "teacher", label: "A teacher reads replies on Friday" }
  ];
  var BARS = [
    { value: "70", label: "70%" },
    { value: "80", label: "80%" },
    { value: "90", label: "90%" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function pct(a, n) { return String(Math.round(a * 1000 / n) / 10) + "%"; }
  function ofN(a, n) { return a + " of " + n; }
  function meets(a, n, bar) { return a * 100 >= bar * n; }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function score(p) {
    var R = { p: p, correct: 0, n: SET.length, ups: 0, praised: 0, flagged: 0, by: {}, rows: [] };
    TOPICS.forEach(function (t) { R.by[t] = { correct: 0, n: 0 }; });
    SET.forEach(function (x) {
      var verdict = x.v[p];
      var good = (verdict === "right") === x.ok;
      R.by[x.topic].n += 1;
      if (good) { R.correct += 1; R.by[x.topic].correct += 1; }
      if (verdict === "right") R.ups += 1;
      if (verdict === "right" && !x.ok) R.praised += 1;
      if (verdict === "wrong" && x.ok) R.flagged += 1;
      R.rows.push({ x: x, verdict: verdict, good: good });
    });
    return R;
  }

  // The gate for a measure and a bar: { text, why, pass }.
  function gate(R, measure, bar) {
    var b = bar + "%";
    if (measure === "teacher") {
      return { pass: null, text: "no gate: it ships first", why: "a teacher's Friday reading comes after the change is live; it checks nothing before it ships." };
    }
    if (measure === "thumbs") {
      var tp = meets(R.ups, R.n, bar);
      return { pass: tp, text: tp ? "passes" : "fails", why: "thumbs-up " + pct(R.ups, R.n) + (tp ? " is at or above " : " is under ") + b + "." };
    }
    if (measure === "overall") {
      var op = meets(R.correct, R.n, bar);
      return { pass: op, text: op ? "passes" : "fails", why: "overall " + pct(R.correct, R.n) + (op ? " is at or above " : " is under ") + b + "." };
    }
    var under = TOPICS.filter(function (t) { return !meets(R.by[t].correct, R.by[t].n, bar); });
    if (!under.length) return { pass: true, text: "passes", why: "every topic is at or above " + b + "." };
    return { pass: false, text: "fails", why: under.map(function (t) { return t + " " + pct(R.by[t].correct, R.by[t].n); }).join(" and ") + (under.length > 1 ? " are" : " is") + " under " + b + "." };
  }

  function knownWhen(measure) {
    if (measure === "thumbs") return "after it ships";
    if (measure === "teacher") return "Friday, after it ships";
    return "before it ships";
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
    var scores = el("p", "margin:0;", "", box);
    var gateLine = el("p", "margin:0;font-weight:600;", "", box);
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var thead = el("thead", "", "", table);
    var hr = el("tr", "", "", thead);
    ["#", "question", "known answer", "student's answer", "helper says", "verdict correct?"].forEach(function (h) {
      el("th", "text-align:left;padding:2px 4px;", h, hr);
    });
    var tbody = el("tbody", "", "", table);
    return { el: el, head: head, scores: scores, gate: gateLine, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = score(C.p);
    var G = gate(R, C.measure, C.bar);
    S.R = R;
    S.G = G;
    ui.head.textContent = "Prompt: " + PROMPTS[C.p].label + ". Measure: " + pick(MEASURES, C.measure).label + ". Pass bar: " + C.bar + "%.";
    ui.scores.textContent = "Verdicts correct " + ofN(R.correct, R.n) + " (" + pct(R.correct, R.n) + "). Algebra " +
      ofN(R.by.algebra.correct, R.by.algebra.n) + " (" + pct(R.by.algebra.correct, R.by.algebra.n) + "), geometry " +
      ofN(R.by.geometry.correct, R.by.geometry.n) + " (" + pct(R.by.geometry.correct, R.by.geometry.n) + "). Thumbs up " +
      ofN(R.ups, R.n) + " (" + pct(R.ups, R.n) + ").";
    ui.gate.textContent = "Would this prompt pass? " + G.text + ". " + G.why;
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    R.rows.forEach(function (r) {
      var tr = ui.el("tr", r.good ? "" : "font-weight:600;", "", ui.tbody);
      [r.x.id, r.x.q, r.x.key, r.x.ans + (r.x.ok ? " (right)" : " (wrong)"), r.verdict, r.good ? "yes" : "NO"].forEach(function (c) {
        ui.el("td", "padding:2px 4px;", c, tr);
      });
    });
    S.stat.prompt(SHORT[C.p]);
    S.stat.correct(ofN(R.correct, R.n));
    S.stat.overall(pct(R.correct, R.n));
    S.stat.algebra(ofN(R.by.algebra.correct, R.by.algebra.n));
    S.stat.geometry(ofN(R.by.geometry.correct, R.by.geometry.n));
    S.stat.praised(R.praised);
    S.stat.flagged(R.flagged);
    S.stat.thumbs(pct(R.ups, R.n) + " (" + ofN(R.ups, R.n) + ")");
    S.stat.gate(G.text);
    S.stat.known(knownWhen(C.measure));
  }

  function report(api, what) {
    draw(api);
    var S = api.state;
    var R = S.R;
    api.log(what + " Prompt " + SHORT[S.C.p] + ": verdicts correct " + ofN(R.correct, R.n) + " (" + pct(R.correct, R.n) +
      "), algebra " + ofN(R.by.algebra.correct, R.by.algebra.n) + ", geometry " + ofN(R.by.geometry.correct, R.by.geometry.n) +
      ", wrong answers praised " + R.praised + ", right answers called wrong " + R.flagged + ", thumbs-up " + pct(R.ups, R.n) +
      ". Gate: " + S.G.text + ", " + S.G.why, S.G.pass === true ? "ok" : (S.G.pass === false ? "bad" : "warn"));
  }

  /* ---------- the module ---------- */

  DL.sims.define("a5e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { p: 0, measure: "thumbs", bar: 70 };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.prompt = api.control.select("prompt", "Prompt", PROMPTS, "0", function (v) {
        var o = pick(PROMPTS, v);
        if (!o) return;
        var was = SHORT[S.C.p];
        S.C.p = Number(o.value);
        report(api, "Prompt was " + was + "; now " + SHORT[S.C.p] + ".");
      });
      S.ctl.measure = api.control.select("measure", "What is measured", MEASURES, "thumbs", function (v) {
        var o = pick(MEASURES, v);
        if (!o) return;
        S.C.measure = String(o.value);
        report(api, "Measure: " + o.label + ".");
      });
      S.ctl.bar = api.control.select("bar", "Pass bar", BARS, "70", function (v) {
        var o = pick(BARS, v);
        if (!o) return;
        S.C.bar = Number(o.value);
        report(api, "Pass bar: " + o.label + ".");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        prompt: api.stat("prompt", "prompt", ""),
        correct: api.stat("correct", "verdicts correct", ""),
        overall: api.stat("overall", "verdict accuracy, overall", ""),
        algebra: api.stat("algebra", "algebra verdicts correct", "warn"),
        geometry: api.stat("geometry", "geometry verdicts correct", ""),
        praised: api.stat("praised", "wrong answers praised as right", "bad"),
        flagged: api.stat("flagged", "right answers called wrong", "warn"),
        thumbs: api.stat("thumbs", "thumbs-up rate", ""),
        gate: api.stat("gate", "would it pass?", "bad"),
        known: api.stat("known", "when you would know", "")
      };

      api.info("<strong>How to read it.</strong> Twenty questions from the worksheet bank, each with its known answer and a student's answer that is known to be right or wrong. The helper's job on each is a verdict: right or wrong. A verdict is correct when it matches the truth. Bold rows are verdicts the helper got wrong. Thumbs up follows the help room's log: a student told right taps up, told wrong taps down.");

      draw(api);
      api.log("The set: 20 questions, 12 algebra (6 student answers wrong) and 8 geometry (3 wrong). Monday's prompt: verdicts correct 19 of 20. Nothing has changed yet.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      function has(s) { return since().indexOf(s) >= 0; }

      // 1. The opening state: Monday's prompt, measured by thumbs up at 70%, before Tuesday's change.
      t.expect(t.stat("prompt") === "before" && t.stat("correct") === "19 of 20" && t.stat("overall") === "95%" &&
        t.stat("algebra") === "11 of 12" && t.stat("geometry") === "8 of 8" && t.stat("praised") === 1 &&
        t.stat("flagged") === 0 && t.stat("thumbs") === "60% (12 of 20)" && t.stat("gate") === "fails" &&
        t.stat("known") === "after it ships" && t.logText().indexOf("Monday's prompt: verdicts correct 19 of 20.") >= 0,
        "Opens on Monday's prompt: 19 of 20 verdicts correct, thumbs-up 60%, which fails a 70% bar");

      // 2. The set is what the story says: 12 algebra with 6 wrong, 8 geometry with 3 wrong.
      var alg = SET.filter(function (x) { return x.topic === "algebra"; });
      var geo = SET.filter(function (x) { return x.topic === "geometry"; });
      t.expect(SET.length === 20 && alg.length === 12 && geo.length === 8 &&
        alg.filter(function (x) { return !x.ok; }).length === 6 && geo.filter(function (x) { return !x.ok; }).length === 3,
        "The golden set: 20 questions, 12 algebra (6 wrong answers), 8 geometry (3 wrong answers)");

      // 3. Tuesday's prompt: algebra falls to 6 of 12, geometry stays 8 of 8, and the thumbs-up rate rises.
      begin();
      t.set("prompt", "1");
      t.expect(t.stat("correct") === "14 of 20" && t.stat("overall") === "70%" && t.stat("algebra") === "6 of 12" &&
        t.stat("geometry") === "8 of 8" && t.stat("praised") === 6 && t.stat("thumbs") === "85% (17 of 20)" &&
        t.stat("gate") === "passes" && has("Prompt was before; now after."),
        "After: 14 of 20, algebra 6 of 12, geometry 8 of 8, 6 wrong answers praised, thumbs-up 85% and it passes");

      // 4. Thumbs up rose while correctness fell.
      var after = t.api.state.R;
      t.set("prompt", "0");
      var before = t.api.state.R;
      t.expect(after.ups > before.ups && after.correct < before.correct && after.by.geometry.correct === before.by.geometry.correct,
        "Thumbs up rose from 12 to 17 of 20 as correct verdicts fell from 19 to 14; geometry did not move");
      t.set("prompt", "1");

      // 5. The overall number hides it: 70% passes a 70% bar, fails at 80%.
      begin();
      t.set("measure", "overall");
      var o70 = t.stat("gate") === "passes" && has("overall 70% is at or above 70%.");
      t.set("bar", "80");
      t.expect(o70 && t.stat("gate") === "fails" && t.stat("known") === "before it ships",
        "Overall accuracy after the change: 70% passes at 70%, fails at 80%");

      // 6. By topic, the algebra slice fails at every bar.
      begin();
      t.set("measure", "topic");
      t.set("bar", "70");
      t.expect(t.stat("gate") === "fails" && has("algebra 50% is under 70%."),
        "By topic: algebra 50% is under even a 70% bar");

      // 7. Monday's prompt passes by topic at 90% (algebra 91.7%).
      begin();
      t.set("prompt", "0");
      t.set("bar", "90");
      t.expect(t.stat("gate") === "passes" && has("every topic is at or above 90%.") && has("verdicts correct 19 of 20 (95%)"),
        "Before, by topic at 90%: algebra 91.7% and geometry 100% both pass");

      // 8. The extra line: another change, measured.
      begin();
      t.set("prompt", "2");
      t.expect(t.stat("algebra") === "9 of 12" && t.stat("geometry") === "6 of 8" && t.stat("overall") === "75%" &&
        t.stat("praised") === 3 && t.stat("flagged") === 2 && t.stat("thumbs") === "60% (12 of 20)" &&
        t.stat("gate") === "fails" && has("algebra 75% and geometry 75% are under 90%."),
        "After plus the line: algebra 9 of 12, geometry 6 of 8, 3 wrong praised, 2 right called wrong; fails at 90%");
      t.set("bar", "70");
      var line70 = t.stat("gate") === "passes";
      t.set("bar", "80");
      t.expect(line70 && t.stat("gate") === "fails", "After plus the line, by topic: passes a 70% bar, fails at 80%");

      // 9. The teacher's Friday reading is no gate.
      t.set("measure", "teacher");
      t.expect(t.stat("gate") === "no gate: it ships first" && t.stat("known") === "Friday, after it ships",
        "A teacher's Friday reading: no gate, you would know on Friday, after it ships");
    }
  });
})();
