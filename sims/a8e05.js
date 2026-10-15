/* sims/a8e05-v1.0.0.js  (published as sims/a8e05.js)
   Case a8e05 "Rewarding the Right Answers": a preference-pair counter for Glaisdale Gyms, a 24-hour
   gym chain whose coaching assistant was tuned toward the answers members tapped. No real model runs
   here: every score is a given count from a small stated set, so a learner can check it by hand.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: who picks the pairs (members, coaches with the rule
     correct first, then kind), method (DPO, RLHF with a scoring model), number of pairs (2,400,
     9,600), release gate (none, at least 51 of 60), live model (tuned, old model and its prompt), play
     tonight, a reply to play, reset. Stats: picks that agree with the asker, corrections out of 60,
     thumbs-up, the release gate, the model live tonight, tonight's two answers. selfTest: 11 assertions.

   The given data (stated in sim.lede):
   - Pairs: each pair is one question with two answers, one that goes along with what the asker said
     and one that pushes back; somebody taps the better one.
   - Members' taps, 2,400 pairs (14 September to 4 October): the agreeing answer picked in 1,970.
     Members' taps, 9,600 pairs: 7,880.
   - Coaches' picks with the stated rule (correct first, then kind), 2,400 pairs: 1,010 agreeing.
     9,600 pairs: 4,040.
   - The coaches' labelled set: 60 questions with a wrong belief built in. Corrections out of 60:
     old model and its prompt 51 (run in spring).
     members 2,400: DPO 17, RLHF 16. members 9,600: DPO 15, RLHF 14.
     coaches 2,400: DPO 55, RLHF 54. coaches 9,600: DPO 56, RLHF 55.
   - Thumbs-up, out of 1,000 rated answers: old model 710; tuned on members' taps 880 (2,400 pairs)
     or 890 (9,600); tuned on coaches' picks 840 (2,400) or 850 (9,600). Method does not change it.
   - Release gate: at least 51 of 60 corrected, the old model's score. A blocked model is not
     released and the old model stays live.
   - Tonight, Wednesday 14 October: 23:20 "Skipping my warm-up is fine when I'm short of time,
     right?" and 23:26 "I should never skip my warm-up, right?". A model tuned on members' taps says
     yes to both; the old model, or one tuned on coaches' picks, corrects the first and agrees with
     the second (a short warm-up beats none; warm-ups are good practice).

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e05-v1.0.0.json):
   - 82%: 1,970 / 2,400 = 0.821; 7,880 / 9,600 = 0.821. 42%: 1,010 / 2,400 = 0.421; 4,040 / 9,600 = 0.421.
   - 71%: 710 / 1,000. 88%: 880 / 1,000. 89%: 890 / 1,000. 84%: 840 / 1,000. 85%: 850 / 1,000.
   - Gate: 17 < 51 blocked; 55 >= 51 passes; old model 51.
   - Reply 0: members, 9,600, DPO: 7,880 of 9,600 (82%), 15 of 60, 89%. Reply 1: members, 2,400, RLHF:
     1,970 of 2,400 (82%), 16 of 60, 88%. Reply 2: old model, 51 of 60, 71%. Reply 3: coaches, 2,400,
     DPO, gate on: 1,010 of 2,400 (42%), 55 of 60, passes, 84%.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SET = 60;
  var BAR = 51;
  var OLD = { fixed: 51, thumbs: 710 };
  var DATA = {
    members: {
      p2400: { pairs: 2400, agree: 1970, fixed: { dpo: 17, rlhf: 16 }, thumbs: 880 },
      p9600: { pairs: 9600, agree: 7880, fixed: { dpo: 15, rlhf: 14 }, thumbs: 890 }
    },
    coaches: {
      p2400: { pairs: 2400, agree: 1010, fixed: { dpo: 55, rlhf: 54 }, thumbs: 840 },
      p9600: { pairs: 9600, agree: 4040, fixed: { dpo: 56, rlhf: 55 }, thumbs: 850 }
    }
  };
  var WHO = [
    { value: "members", label: "members' taps" },
    { value: "coaches", label: "coaches' picks, correct first, then kind" }
  ];
  var METHODS = [
    { value: "dpo", label: "DPO: train on the pairs directly" },
    { value: "rlhf", label: "RLHF: scoring model first, then train to please it" }
  ];
  var PAIRS = [
    { value: "p2400", label: "2,400 pairs (as now)" },
    { value: "p9600", label: "9,600 pairs" }
  ];
  var GATES = [
    { value: "none", label: "none: release on thumbs-up" },
    { value: "bar", label: "at least 51 of 60 corrected" }
  ];
  var MODELS = [
    { value: "tuned", label: "tuned model" },
    { value: "old", label: "old model and its prompt" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: far more members' pairs" },
    { value: "r1", label: "reply 1: RLHF on the same members' taps" },
    { value: "r2", label: "reply 2: roll back to the old model" },
    { value: "r3", label: "reply 3: coaches' pairs, gate on the 60" }
  ];
  var NIGHT = [
    { t: "23:20", q: "Skipping my warm-up is fine when I'm short of time, right?",
      yes: "yes, if you're short of time, skipping it is fine.",
      fix: "a short warm-up beats none; shorten it rather than skip it." },
    { t: "23:26", q: "I should never skip my warm-up, right?",
      yes: "yes, never skip it. your warm-up matters.",
      fix: "yes, a warm-up is good practice." }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pct(a, b) { return String(Math.round(a * 100 / b)); }
  function defaults() {
    return { who: "members", method: "dpo", pairs: "p2400", gate: "none", model: "tuned", played: false, plan: "none" };
  }

  /* ---------- the counter (pure: settings in, answers out) ---------- */

  function score(C) {
    var D = DATA[C.who][C.pairs];
    var R = { pairs: D.pairs, agreeN: D.agree };
    R.agree = fmt(D.agree) + " of " + fmt(D.pairs) + " (" + pct(D.agree, D.pairs) + "%)";
    R.tunedFixed = D.fixed[C.method];
    R.tunedThumbs = D.thumbs;
    if (C.gate === "none") { R.passes = true; R.gate = "none: released on thumbs-up"; }
    else if (R.tunedFixed >= BAR) { R.passes = true; R.gate = "passes: " + R.tunedFixed + " of " + SET + ", at least " + BAR; }
    else { R.passes = false; R.gate = "blocked: " + R.tunedFixed + " of " + SET + ", below " + BAR; }
    R.liveOld = C.model === "old" || !R.passes;
    R.live = R.liveOld ? "old model and its prompt" : "tuned model";
    var fixed = R.liveOld ? OLD.fixed : R.tunedFixed;
    var thumbs = R.liveOld ? OLD.thumbs : R.tunedThumbs;
    R.fixedN = fixed;
    R.fixed = fixed + " of " + SET;
    R.thumbs = pct(thumbs, 1000) + "% (" + thumbs + " of 1,000)";
    R.yesBoth = !R.liveOld && C.who === "members";
    if (!C.played) R.tonight = "not played yet";
    else R.tonight = R.yesBoth ? "yes to both sides" : "corrected the first, yes to the second";
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
    var R = score(C);
    var ui = api.state.ui;
    ui.head.textContent = "the pair counter at Glaisdale. pairs from: " + pick(WHO, C.who).label +
      ". method: " + pick(METHODS, C.method).label + ". release gate: " + pick(GATES, C.gate).label + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["version", "picks that agree with the asker", "corrected of 60", "thumbs-up of 1,000", "release gate"], true);
    row(ui, ["old model and its prompt", "not tuned", OLD.fixed + " of " + SET, OLD.thumbs, "the bar: " + BAR + " of " + SET], false);
    row(ui, ["tuned on " + fmt(R.pairs) + " pairs", R.agree, R.tunedFixed + " of " + SET, R.tunedThumbs, R.gate], false);
    ui.note.textContent = "live tonight: " + R.live + ". tonight's two answers: " + R.tonight + ".";
  }

  function setStats(api) {
    var R = score(api.state.C);
    var st = api.state.stat;
    st.agree(R.agree);
    st.fixed(R.fixed);
    st.thumbs(R.thumbs);
    st.gate(R.gate);
    st.live(R.live);
    st.tonight(R.tonight);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = score(api.state.C);
    if (what) api.log(what + " picks agreeing " + R.agree + "; live: " + R.live + ", " + R.fixed +
      " corrected, thumbs-up " + R.thumbs + ".", R.fixedN >= BAR ? "ok" : "bad");
  }

  function playNight(api) {
    var C = api.state.C;
    C.played = true;
    var R = score(C);
    api.log("Wednesday 14 October, 23:20. live: " + R.live + ".", "");
    NIGHT.forEach(function (n, i) {
      var a = R.yesBoth ? n.yes : n.fix;
      api.log(n.t + "  Ingunn: " + n.q + "  assistant: " + a, (R.yesBoth && i === 0) ? "bad" : "ok");
    });
    draw(api);
    setStats(api);
    api.log("23:30  Ingunn shows the desk her phone. tonight: " + R.tonight + ".", R.yesBoth ? "bad" : "ok");
  }

  function planConfig(plan, prev) {
    var C = defaults();
    C.plan = plan;
    C.played = prev.played;
    if (plan === "r0") C.pairs = "p9600";
    if (plan === "r1") C.method = "rlhf";
    if (plan === "r2") C.model = "old";
    if (plan === "r3") { C.who = "coaches"; C.gate = "bar"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = score(api.state.C);
    if (plan === "r0") api.log("four times the members' taps: the same lean, " + R.agree + "; " + R.fixed + " corrected.", "bad");
    if (plan === "r1") api.log("the scoring model learns from the same " + R.agree + " agreeing picks, then the assistant learns to please it: " +
      R.fixed + " corrected.", "bad");
    if (plan === "r2") api.log("rolled back: " + R.fixed + " corrected again, but thumbs-up " + R.thumbs + ".", "warn");
    if (plan === "r3") {
      var before = score({ who: "members", method: "dpo", pairs: "p2400", gate: "bar", model: "tuned", played: false });
      api.log("the gate on the members' tuning first: " + before.gate + ".", "warn");
      api.log("counted before training: coaches' picks agreeing " + R.agree + ". after training: " + R.gate +
        "; thumbs-up " + R.thumbs + ".", "ok");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.who.set(S.C.who);
        S.ctl.method.set(S.C.method);
        S.ctl.pairs.set(S.C.pairs);
        S.ctl.gate.set(S.C.gate);
        S.ctl.model.set(S.C.model);
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
          manual(o.label + ".");
        });
      }
      chooser("who", "who picks", WHO, "members");
      chooser("method", "method", METHODS, "dpo");
      chooser("pairs", "number of pairs", PAIRS, "p2400");
      chooser("gate", "release gate", GATES, "none");
      chooser("model", "live model", MODELS, "tuned");
      S.ctl.night = api.control.button("night", "play tonight, 23:20 to 23:30", function () { playNight(api); });
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
        agree: api.stat("agree", "picks that agree with the asker", "warn"),
        fixed: api.stat("fixed", "wrong beliefs corrected, of 60", "bad"),
        thumbs: api.stat("thumbs", "thumbs-up", ""),
        gate: api.stat("gate", "release gate", ""),
        live: api.stat("live", "live tonight", ""),
        tonight: api.stat("tonight", "tonight's two answers", "")
      };

      api.info("<strong>How to read it.</strong> The top row is the old model and its prompt; the second is the model tuned on the pairs you choose. Each pair is one question with two answers, one that agrees with the asker and one that pushes back. The counter shows how often the picked answer agreed, how many of the coaches' 60 questions the model corrects, and its thumbs-up out of 1,000 rated answers. Play tonight for Ingunn's two questions.");

      refresh(api, "");
      api.log("Wednesday 14 October, 23:00 at Glaisdale, before tonight's questions. the tuned model has run since Sunday 11 October. " +
        "thumbs-up 71% before, 88% since.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the tuned model on members' taps, live since Sunday, before 23:20.
      t.expect(t.stat("agree") === "1,970 of 2,400 (82%)" && t.stat("fixed") === "17 of 60" &&
        t.stat("thumbs") === "88% (880 of 1,000)" && t.stat("gate") === "none: released on thumbs-up" &&
        t.stat("tonight") === "not played yet" && has("23:00 at Glaisdale") && has("thumbs-up 71% before, 88% since"),
        "Opens at 23:00: 1,970 of 2,400 (82%), 17 of 60, 88% thumbs-up, no gate");

      // 2. Tonight: yes to both sides, six minutes apart.
      t.click("night");
      t.expect(t.stat("tonight") === "yes to both sides" && has("23:20  Ingunn: Skipping my warm-up") &&
        has("23:26  Ingunn: I should never skip my warm-up, right?") && has("23:30  Ingunn shows the desk her phone"),
        "Tonight: yes at 23:20 and yes at 23:26, phone shown at 23:30");

      // 3. The old model and its prompt: 51 of 60, 71%.
      t.set("model", "old");
      t.expect(t.stat("fixed") === "51 of 60" && t.stat("thumbs") === "71% (710 of 1,000)" &&
        t.stat("tonight") === "corrected the first, yes to the second", "Old model: 51 of 60, 71%, corrects the first");
      t.set("model", "tuned");

      // 4. More members' pairs: the same lean.
      t.set("pairs", "p9600");
      t.expect(t.stat("agree") === "7,880 of 9,600 (82%)" && t.stat("fixed") === "15 of 60" &&
        t.stat("thumbs") === "89% (890 of 1,000)", "9,600 members' pairs: 82% agreeing, 15 of 60, 89%");
      t.set("pairs", "p2400");

      // 5. RLHF on the same members' taps: the same lesson.
      t.set("method", "rlhf");
      t.expect(t.stat("agree") === "1,970 of 2,400 (82%)" && t.stat("fixed") === "16 of 60",
        "RLHF on members' taps: 82% agreeing, 16 of 60");
      t.set("method", "dpo");

      // 6. The gate blocks the tuned model at 17.
      t.set("gate", "bar");
      t.expect(t.stat("gate") === "blocked: 17 of 60, below 51" && t.stat("live") === "old model and its prompt" &&
        t.stat("fixed") === "51 of 60", "Gate: blocked at 17 of 60, the old model stays live");

      // 7. Coaches' picks with the rule: 42% agreeing, 55 of 60, passes.
      t.set("who", "coaches");
      t.expect(t.stat("agree") === "1,010 of 2,400 (42%)" && t.stat("gate") === "passes: 55 of 60, at least 51" &&
        t.stat("live") === "tuned model" && t.stat("thumbs") === "84% (840 of 1,000)",
        "Coaches' picks: 1,010 of 2,400 (42%), 55 of 60 passes, 84%");

      // 8. Reply 0: far more members' pairs.
      t.set("plan", "r0");
      t.expect(t.stat("agree") === "7,880 of 9,600 (82%)" && t.stat("fixed") === "15 of 60" && t.stat("tonight") === "yes to both sides",
        "Reply 0: 7,880 of 9,600 (82%), 15 of 60, still yes to both");

      // 9. Reply 1: RLHF with a scoring model on the same taps.
      t.set("plan", "r1");
      t.expect(t.stat("fixed") === "16 of 60" && t.stat("thumbs") === "88% (880 of 1,000)" && has("the scoring model learns from the same 1,970 of 2,400 (82%)"),
        "Reply 1: RLHF, 16 of 60, 88%");

      // 10. Reply 2: roll back.
      t.set("plan", "r2");
      t.expect(t.stat("fixed") === "51 of 60" && t.stat("thumbs") === "71% (710 of 1,000)" && t.stat("live") === "old model and its prompt",
        "Reply 2: rolled back, 51 of 60, thumbs-up back to 71%");

      // 11. Reply 3: coaches' pairs, counted before training, gate on the 60.
      t.set("plan", "r3");
      t.expect(t.stat("gate") === "passes: 55 of 60, at least 51" && t.stat("agree") === "1,010 of 2,400 (42%)" &&
        has("the gate on the members' tuning first: blocked: 17 of 60, below 51") &&
        t.stat("tonight") === "corrected the first, yes to the second", "Reply 3: 42% agreeing, 55 of 60 passes, the first corrected");
    }
  });
})();
