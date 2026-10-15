/* sims/a8e06-v1.0.0.js  (published as sims/a8e06.js)
   Case a8e06 "Measuring the Change": a before-and-after scoreboard for Pellworth Airport's traveller
   assistant, fully fine-tuned for 8 rounds (epochs) on 4,000 english chats. No real model runs here and
   no chat text exists in this file: every score is a given count, set out below and in sim.lede.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: round (1 to 8), sign-off set (training questions,
     held-back chats), old-skills check on or off, release gate (none, lose no more than 2 of 40), send
     non-english chats to the old model, play tonight, a reply to play, reset. Stats: round, training
     error, sign-off score, old-skills score, release, tonight's chats answered in portuguese, best round
     by the chosen set. selfTest: 11 assertions.

   The given data (stated in sim.lede), for the old model and after rounds 1 to 8:
   - training error, of the 4,000 training chats answered differently from the staff:
     1,240, 760, 480, 300, 190, 120, 70, 40 (falls every round).
   - held-back score, of 300 chats kept out of training: old 207; 231, 246, 240, 233, 226, 219, 214, 209
     (peak after round 2, falls every round after).
   - training questions, of 60 taken from the training chats: old 41; 47, 50, 53, 55, 56, 56, 57, 57.
   - old-skills set, of 40 (8 other languages, 5 each, kept from last year): old 37;
     36, 35, 30, 24, 18, 13, 10, 8.
   - tonight's 31 portuguese chats replayed, answered in portuguese: old 30; 30, 29, 24, 18, 13, 9, 6, 4.

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e06-v1.0.0.json):
   - The sign-off: 41 vs 57 of 60 is the training-questions row, old against round 8.
   - Overfitting: the held-back row peaks at 246 (round 2); round 8 is 209, 2 more than the old 207.
   - Forgetting: old skills 37 for the old model, 8 for round 8 (lost 29); round 2 is 35 (lost 2).
   - The gate: lose no more than 2 of 40, so 37 - 2 = 35 or more passes: rounds 1 and 2.
   - Tonight: round 8 answers 4 of 31 in portuguese, 27 in english; round 2, 29; the old model, 30.
   - Reply 0: round 8 is the end of the trend; 246 to 209 and 35 to 8 from round 2 to 8.
     Reply 1: round 2, held-back, old skills on, gate on: pass. Reply 2: lowest training error is
     round 8 (40). Reply 3: round 8 with non-english chats to the old model: 30 of 31.
   - Dates: live since Thursday 1 October 2026; tonight Saturday 10 October, landing 01:40 Sunday 11.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var TRAIN_CHATS = 4000;
  var HELD_N = 300;
  var QUESTIONS_N = 60;
  var SKILLS_N = 40;
  var TONIGHT_N = 31;
  var MAX_LOST = 2;
  var ERR = [1240, 760, 480, 300, 190, 120, 70, 40];
  var HELD = [231, 246, 240, 233, 226, 219, 214, 209];
  var QUESTIONS = [47, 50, 53, 55, 56, 56, 57, 57];
  var SKILLS = [36, 35, 30, 24, 18, 13, 10, 8];
  var TONIGHT = [30, 29, 24, 18, 13, 9, 6, 4];
  var OLD = { held: 207, questions: 41, skills: 37, tonight: 30 };

  var ROUNDS = [];
  for (var r = 1; r <= 8; r++) ROUNDS.push({ value: String(r), label: "round " + r + (r === 8 ? " (live now)" : "") });
  var SETS = [
    { value: "train", label: "training questions (60)" },
    { value: "held", label: "held-back chats (300)" }
  ];
  var GATES = [
    { value: "none", label: "none" },
    { value: "two", label: "lose no more than 2 of 40" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: train for more rounds" },
    { value: "r1", label: "reply 1: held-back, old skills, best round" },
    { value: "r2", label: "reply 2: release at the lowest training error" },
    { value: "r3", label: "reply 3: non-english chats to the old model" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function argMax(a) { var b = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }
  function argMin(a) { var b = 0; for (var i = 1; i < a.length; i++) if (a[i] < a[b]) b = i; return b; }
  function defaults() {
    return { round: "8", set: "train", check: false, gate: "none", router: false, played: false, plan: "none" };
  }

  /* ---------- the scoreboard (pure: settings in, answers out) ---------- */

  function score(C) {
    var i = Number(C.round) - 1;
    var R = { i: i };
    R.err = fmt(ERR[i]) + " of " + fmt(TRAIN_CHATS);
    if (C.set === "held") {
      R.signoff = HELD[i] + " of " + HELD_N + " (old model " + OLD.held + ")";
      var bh = argMax(HELD);
      R.best = "round " + (bh + 1) + ", " + HELD[bh] + " of " + HELD_N;
    } else {
      R.signoff = QUESTIONS[i] + " of " + QUESTIONS_N + " (old model " + OLD.questions + ")";
      var bq = argMax(QUESTIONS);
      R.best = "round " + (bq + 1) + ", " + QUESTIONS[bq] + " of " + QUESTIONS_N;
    }
    R.skills = C.check ? SKILLS[i] + " of " + SKILLS_N + " (old model " + OLD.skills + ")" : "not run";
    var lost = OLD.skills - SKILLS[i];
    R.lost = lost;
    if (C.gate === "none") R.release = "no gate: released as signed off";
    else if (!C.check) R.release = "gate can't run: old-skills check is off";
    else if (lost <= MAX_LOST) R.release = "pass: lost " + lost + " of " + SKILLS_N;
    else R.release = "fail: lost " + lost + " of " + SKILLS_N;
    if (!C.played) R.tonight = "not played yet";
    else if (C.router) R.tonight = OLD.tonight + " of " + TONIGHT_N + " in portuguese (old model)";
    else R.tonight = TONIGHT[i] + " of " + TONIGHT_N + " in portuguese, " + (TONIGHT_N - TONIGHT[i]) + " in english";
    R.models = C.router ? "two models to run and test" : "one model";
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
  function row(ui, cells, th, mark) {
    var tr = ui.el("tr", mark ? "font-weight:bold;" : "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var R = score(C);
    var ui = api.state.ui;
    ui.head.textContent = "the scoreboard at Pellworth. chosen: round " + C.round + ". sign-off set: " +
      pick(SETS, C.set).label + "." + (C.router ? " non-english chats go to the old model." : "");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    var heldHead = C.set === "held" ? "held-back of 300" : "held-back (not used)";
    var qHead = C.set === "train" ? "training questions of 60" : "training questions (not used)";
    row(ui, ["model", "training error of 4,000", qHead, heldHead, "old skills of 40", "tonight in portuguese"], true);
    row(ui, ["old model", "-", OLD.questions, OLD.held, C.check ? OLD.skills : "-", OLD.tonight], false);
    for (var i = 0; i < 8; i++) {
      row(ui, ["round " + (i + 1), fmt(ERR[i]), QUESTIONS[i], HELD[i], C.check ? SKILLS[i] : "-", TONIGHT[i]], false,
        i === R.i);
    }
    ui.note.textContent = "release: " + R.release + ". tonight: " + R.tonight + ". " + R.models + ".";
  }

  function setStats(api) {
    var R = score(api.state.C);
    var st = api.state.stat;
    st.round(api.state.C.round);
    st.err(R.err);
    st.signoff(R.signoff);
    st.skills(R.skills);
    st.release(R.release);
    st.tonight(R.tonight);
    st.best(R.best);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = score(api.state.C);
    if (what) api.log(what + " round " + api.state.C.round + ": sign-off " + R.signoff + "; old skills " + R.skills +
      "; " + R.release + ".", R.release.indexOf("pass") === 0 ? "ok" : (R.release.indexOf("fail") === 0 ? "bad" : ""));
  }

  function playNight(api) {
    var C = api.state.C;
    api.log("Sunday 11 October, 01:40. the diverted flight from porto lands with 140 passengers.", "");
    api.log("01:44 to 02:57  " + TONIGHT_N + " chats, all asked in portuguese.", "");
    C.played = true;
    draw(api);
    setStats(api);
    var R = score(C);
    api.log("answered: " + R.tonight + ".", R.tonight.indexOf("27 in english") >= 0 ? "bad" : "ok");
    api.log("02:10  a passenger shows the duty officer her phone: asked in portuguese, answered in english.",
      C.router || TONIGHT[R.i] >= 29 ? "" : "bad");
  }

  function planConfig(plan, prev) {
    var C = defaults();
    C.plan = plan;
    C.played = prev.played;
    if (plan === "r0") { C.round = "8"; C.set = "train"; }
    if (plan === "r1") { C.round = String(argMax(HELD) + 1); C.set = "held"; C.check = true; C.gate = "two"; }
    if (plan === "r2") { C.round = String(argMin(ERR) + 1); C.set = "train"; }
    if (plan === "r3") { C.round = "8"; C.router = true; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = score(api.state.C);
    if (plan === "r0") api.log("more rounds: from round 2 to round 8 the held-back score fell from " + HELD[1] + " to " + HELD[7] +
      " and old skills from " + SKILLS[1] + " to " + SKILLS[7] + ", while the training error fell from " + fmt(ERR[1]) + " to " +
      fmt(ERR[7]) + ". more rounds carry on down the same slope.", "bad");
    if (plan === "r1") {
      var eight = score({ round: "8", set: "held", check: true, gate: "two", router: false, played: false });
      api.log("first: rolled back to the pinned old model, one setting.", "warn");
      api.log("best held-back round: round " + api.state.C.round + ", " + R.signoff + ". gate " + R.release +
        ". round 8: " + eight.release + ".", "ok");
    }
    if (plan === "r2") api.log("lowest training error: round " + api.state.C.round + ", " + R.err +
      ", the model already live. held-back " + HELD[7] + " of " + HELD_N + " against the old model's " + OLD.held + ".", "bad");
    if (plan === "r3") api.log("non-english chats to the old model: " + R.models + ". the tuned model stays at round 8. its old-skills set: " +
      R.skills + ". its held-back score: " + HELD[7] + " against " + OLD.held + ".", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.round.set(S.C.round);
        S.ctl.set.set(S.C.set);
        S.ctl.check.set(S.C.check);
        S.ctl.gate.set(S.C.gate);
        S.ctl.router.set(S.C.router);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        refresh(api, what);
      }
      function chooser(id, label, list, initial) {
        S.ctl[id] = api.control.select(id, label, list, initial, function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          manual(label + ": " + o.label + ".");
        });
      }
      function flag(id, label) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          if (S.sync) return;
          S.C[id] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      chooser("round", "round", ROUNDS, "8");
      chooser("set", "sign-off set", SETS, "train");
      flag("check", "old-skills check");
      chooser("gate", "release gate", GATES, "none");
      flag("router", "send non-english chats to the old model");
      S.ctl.night = api.control.button("night", "play tonight, from 01:40", function () { playNight(api); });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value), S.C);
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        round: api.stat("round", "round chosen", ""),
        err: api.stat("err", "training error", ""),
        signoff: api.stat("signoff", "sign-off score", "warn"),
        skills: api.stat("skills", "old-skills set", "bad"),
        release: api.stat("release", "release", ""),
        tonight: api.stat("tonight", "tonight's chats answered in portuguese", "bad"),
        best: api.stat("best", "best round by this set", "")
      };

      api.info("<strong>How to read it.</strong> Each row is the old model or one saved round: its training error on the 4,000 training chats, its score on the 60 training questions and on the 300 held-back chats, its old-skills score when the check is on, and how many of tonight's 31 portuguese chats it answers in portuguese. The bold row is the round you would release.");

      refresh(api, "");
      api.log("Sunday 11 October, 01:30 at Pellworth, before the porto flight lands. round 8 has been live since Thursday 1 October: 6 non-english chats since, all by day, helped at the desk. its sign-off: " +
        QUESTIONS[7] + " of " + QUESTIONS_N + " against " + OLD.questions + ".", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: round 8 live, signed off on the training questions, before tonight.
      t.expect(t.stat("round") === 8 && t.stat("err") === "40 of 4,000" && t.stat("signoff") === "57 of 60 (old model 41)" &&
        t.stat("skills") === "not run" && t.stat("tonight") === "not played yet" &&
        t.stat("release") === "no gate: released as signed off" && has("01:30 at Pellworth") && has("6 non-english chats"),
        "Opens at 01:30: round 8, 40 of 4,000, 57 of 60 against 41, old skills not run");

      // 2. Tonight: 27 of 31 answered in english.
      t.click("night");
      t.expect(t.stat("tonight") === "4 of 31 in portuguese, 27 in english" && has("01:40. the diverted flight from porto") &&
        has("02:10  a passenger shows the duty officer her phone"), "Tonight: 4 of 31 in portuguese, 27 in english");

      // 3. The old-skills check: 8 of 40 against 37.
      t.set("check", true);
      t.expect(t.stat("skills") === "8 of 40 (old model 37)", "Old skills: round 8 answers 8 of 40, the old model 37");

      // 4. Held-back chats: 209 against 207, best round 2.
      t.set("set", "held");
      t.expect(t.stat("signoff") === "209 of 300 (old model 207)" && t.stat("best") === "round 2, 246 of 300",
        "Held-back: round 8 209 of 300 against 207; best round 2 at 246");

      // 5. The gate fails round 8.
      t.set("gate", "two");
      t.expect(t.stat("release") === "fail: lost 29 of 40", "Gate: round 8 fails, lost 29 of 40");

      // 6. Round 2: the held-back peak passes the gate, and tonight 29 of 31.
      t.set("round", "2");
      t.expect(t.stat("signoff") === "246 of 300 (old model 207)" && t.stat("err") === "760 of 4,000" &&
        t.stat("skills") === "35 of 40 (old model 37)" && t.stat("release") === "pass: lost 2 of 40" &&
        t.stat("tonight") === "29 of 31 in portuguese, 2 in english", "Round 2: 246 of 300, 35 of 40, pass, 29 of 31");

      // 7. Round 1: higher training error, lower held-back score than round 2.
      t.set("round", "1");
      t.expect(t.stat("err") === "1,240 of 4,000" && t.stat("signoff") === "231 of 300 (old model 207)" &&
        t.stat("release") === "pass: lost 1 of 40", "Round 1: 1,240 of 4,000, 231 of 300, passes");

      // 8. Reply 0: more rounds, the same slope.
      t.set("plan", "r0");
      t.expect(t.stat("round") === 8 && t.stat("signoff") === "57 of 60 (old model 41)" &&
        has("fell from 246 to 209 and old skills from 35 to 8"), "Reply 0: round 8, 57 of 60, held-back 246 to 209, old skills 35 to 8");

      // 9. Reply 1: held-back and old skills, best round, gate.
      t.set("plan", "r1");
      t.expect(t.stat("round") === 2 && t.stat("release") === "pass: lost 2 of 40" &&
        t.stat("tonight") === "29 of 31 in portuguese, 2 in english" && has("round 8: fail: lost 29 of 40") &&
        has("rolled back to the pinned old model"), "Reply 1: round 2 passes, round 8 fails, 29 of 31, rollback first");

      // 10. Reply 2: the lowest training error is round 8.
      t.set("plan", "r2");
      t.expect(t.stat("round") === 8 && t.stat("err") === "40 of 4,000" && t.stat("skills") === "not run" &&
        has("lowest training error: round 8, 40 of 4,000"), "Reply 2: lowest training error picks round 8 again");

      // 11. Reply 3: non-english chats to the old model.
      t.set("plan", "r3");
      t.expect(t.stat("tonight") === "30 of 31 in portuguese (old model)" && has("two models to run and test") &&
        t.stat("round") === 8, "Reply 3: 30 of 31 via the old model, but two models");
    }
  });
})();
