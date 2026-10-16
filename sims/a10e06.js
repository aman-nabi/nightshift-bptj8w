/* sims/a10e06-v1.0.0.js  (published as sims/a10e06.js)
   Case a10e06 "The Guess Ahead": a guess-and-check round counter for the assistant on Thorncliffe
   Tunnelling's boring machine, on the night of Monday 21 September 2026, the Polish crew's first night
   shift. No real model runs here and no text is generated: every figure is worked out from the given
   numbers below (also stated in sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: helper on or off, kept guesses (30%, 40%, 50%, 51%,
     80%), guesses a round (5, 10), helper speed (5 or 2.5 ms a guess), play the night, play a reply,
     reset. Stats: round time, tokens a round, tokens a second, the big model alone, against alone,
     the break-even share of kept guesses, a 400-token answer, the dashboard's speed-up label.
     selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 70B: 70.6 billion weights, 80 layers, 141 billion bytes in 16 bits (about 132 GB on the
     meter, 1 GB = 1,024 MB), on one machine with two H100 cards, half the bytes on each. Each card
     reads its half, 70.5 billion bytes, at 3.35 TB/s (3,350 billion bytes a second, the maker's 1,000):
     70.5 / 3,350 = 21 ms at least a token.
   - Thorncliffe's own measurements, never a source's: the big model alone writes a token every 25 ms,
     40 a second; the helper, Llama 3.2 1B, guesses a token in 5 ms; checking a round's guesses is one
     read of the weights, 25 ms, the same as writing one token. Kept guesses: 80% on Monday 14
     September's all-English test, 30% on the Polish crew's questions on Monday 21 September, and 40%
     on English fault-code questions in November (the cold case). The crew's judgement that the
     Polish answers are usable is also story data.
   - a round: the helper guesses g tokens one after another (g x helper ms), the big model checks all g
     in one 25 ms read, keeps the guesses up to the first wrong one and adds one token of its own.
     tokens a round = 1 + a + a^2 + ... + a^g = (1 - a^(g+1)) / (1 - a), a the share of guesses kept
     (Leviathan, Kalman and Matias, Equation 1, with their simplifying assumption that every guess has
     the same chance). tokens a second = tokens a round / round time.
   - a ring-build answer is about 400 tokens. The dashboard's "speed-up: on, 1.84x" is text typed in
     on Tuesday 15 September from the 14 September test; it never changes with the live figures.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e06-v1.0.0.json):
   - helper off: 25 ms a token, 1000 / 25 = 40 a second; 400 tokens 10.0 s.
   - 5 guesses at 5 ms: a round 5 x 5 + 25 = 50 ms.
     80%: 1 + 0.8 + 0.64 + 0.512 + 0.4096 + 0.32768 = 3.68928, 3.69 tokens a round; / 0.05 s = 73.79,
       73.8 a second; / 40 = 1.845 (1.8446), 1.84x; 400 tokens 5.42, 5.4 s.
     30%: 1 + 0.3 + 0.09 + 0.027 + 0.0081 + 0.00243 = 1.42753, 1.43; / 0.05 = 28.55, 28.6 a second;
       0.71x; 400 tokens 14.01, 14.0 s.
     50%: 1.96875, 1.97; 39.375, 39.4 a second (below 40); 400 tokens 10.2 s.
     51%: 2.0049, 2.00; 40.098, 40.1 a second; 1.00x.
     40% (cold case): 1.65984, 1.66; 33.197, 33.2 a second; 400 tokens 12.0 s.
     break-even: the share a where tokens a round / 0.05 s = 40, i.e. tokens a round = 2: a = 0.5087,
       shown as 51% kept ("just over 50%").
   - 10 guesses at 5 ms: a round 10 x 5 + 25 = 75 ms. 30%: 1.42857, 1.43; 19.048, 19.0 a second; 400
     tokens 21.0 s. 80%: 4.5705, 4.57; 60.94, 60.9 a second. break-even 0.6708, 67% kept.
   - 5 guesses at 2.5 ms: a round 5 x 2.5 + 25 = 37.5 ms. 30%: 1.43; 38.067, 38.1 a second; 400 tokens
     10.51, 10.5 s. break-even 0.3343, 33% kept. (80% would give 98.4 a second; the story never
     measured the quicker helper in English.)
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var CHECK_MS = 25;           // one read of the big model's weights: a check, or one token alone
  var ALONE = 1000 / CHECK_MS; // 40 tokens a second
  var ANSWER = 400;            // a ring-build answer, in tokens
  var HELPERS = [
    { value: "on", label: "helper on" },
    { value: "off", label: "helper off: the big model alone" }
  ];
  var KEPTS = [
    { value: "0.3", label: "30% kept (polish questions, monday night)" },
    { value: "0.4", label: "40% kept (english fault-code questions, november)" },
    { value: "0.5", label: "50% kept" },
    { value: "0.51", label: "51% kept" },
    { value: "0.8", label: "80% kept (english, the 14 september test)" }
  ];
  var GUESSES = [
    { value: "5", label: "5 guesses a round" },
    { value: "10", label: "10 guesses a round" }
  ];
  var SPEEDS = [
    { value: "5", label: "5 ms a guess (the 1B helper)" },
    { value: "2.5", label: "2.5 ms a guess (twice as fast)" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: guess 10 tokens ahead" },
    { value: "r1", label: "reply 1: helper off for every crew" },
    { value: "r2", label: "reply 2: count kept guesses per language" },
    { value: "r3", label: "reply 3: a helper twice as fast" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { helper: "on", kept: "0.8", guesses: "5", speed: "5", plan: "none" };
  }
  function num(x) { return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1); }
  function pct(a) { return Math.round(a * 100) + "%"; }

  /* ---------- the round arithmetic (pure: settings in, figures out) ---------- */

  function perRound(a, g) { return (1 - Math.pow(a, g + 1)) / (1 - a); }

  function breakEven(g, ms) {
    var target = (g * ms + CHECK_MS) / CHECK_MS; // tokens a round needed to match 40 a second
    var lo = 0, hi = 0.999;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (perRound(mid, g) < target) lo = mid; else hi = mid;
    }
    return lo;
  }

  function figures(C) {
    var a = Number(C.kept), g = Number(C.guesses), ms = Number(C.speed);
    var R = { a: a, g: g, ms: ms };
    if (C.helper === "off") {
      R.round = CHECK_MS; R.tokens = 1; R.rate = ALONE;
    } else {
      R.round = g * ms + CHECK_MS; R.tokens = perRound(a, g); R.rate = R.tokens / (R.round / 1000);
    }
    R.be = breakEven(g, ms);
    R.text = {
      round: num(R.round) + " ms",
      tokens: C.helper === "off" ? "1 token a pass" : R.tokens.toFixed(2) + " tokens a round",
      rate: num(R.rate) + " a second",
      alone: num(ALONE) + " a second",
      vs: (R.rate / ALONE).toFixed(2) + "×",
      be: C.helper === "off" ? "helper off" : pct(R.be) + " kept",
      ans: (ANSWER / R.rate).toFixed(1) + " s",
      dash: C.helper === "off" ? "speed-up: off" : "speed-up: on, 1.84×"
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
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th, mark) {
    var tr = ui.el("tr", mark ? "font-weight:bold;" : "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    var R = figures(C);
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    if (C.helper === "off") {
      ui.head.textContent = "helper off: the big model writes one token per 25 ms read of its weights.";
      row(ui, ["token", "kept", "time"], true);
      row(ui, ["the big model's own token", "always", "25 ms"], false, true);
    } else {
      ui.head.textContent = "one round: " + R.g + " guesses at " + num(R.ms) + " ms, then one 25 ms check. " +
        pct(R.a) + " of guesses kept.";
      row(ui, ["token in the round", "kept when", "chance it is kept"], true);
      for (var i = 1; i <= R.g; i++) {
        row(ui, ["guess " + i, i === 1 ? "the check agrees" : "guesses 1 to " + (i - 1) + " were kept too",
          Math.pow(R.a, i).toFixed(i < 4 ? 2 : 4)], false);
      }
      row(ui, ["the big model's own token", "always", "1"], false);
      row(ui, ["kept a round, on average", "", R.tokens.toFixed(2)], false, true);
    }
    ui.note.textContent = "round " + R.text.round + ". " + R.text.tokens + " / " + R.text.round + " = " + R.text.rate +
      ", against " + R.text.alone + " alone. a " + ANSWER + "-token answer: " + R.text.ans +
      ". break-even: " + R.text.be + ". the words are the big model's either way.";
  }

  function setStats(api) {
    var R = figures(api.state.C);
    var st = api.state.stat;
    st.round(R.text.round);
    st.tokens(R.text.tokens);
    st.rate(R.text.rate);
    st.alone(R.text.alone);
    st.vs(R.text.vs);
    st.be(R.text.be);
    st.ans(R.text.ans);
    st.dash(R.text.dash);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = figures(api.state.C);
    if (what) api.log(what + " " + R.text.tokens + ", " + R.text.rate + "; a " + ANSWER + "-token answer " + R.text.ans + ".",
      R.rate < ALONE ? "bad" : "ok");
  }

  function at(kept, guesses, speed, helper) {
    return figures({ helper: helper || "on", kept: kept, guesses: guesses, speed: speed, plan: "none" });
  }

  function playNight(api) {
    var day = at("0.8", "5", "5");
    var night = at("0.3", "5", "5");
    api.log("22:00  the polish crew's first night shift begins; every question is now in polish.", "");
    api.log("23:40  wieslaw radios from the ring: the answers crawl.", "warn");
    api.log("23:45  dashboard: speed-up: on, 1.84× (typed in 15 sep, from the 14 sep test).", "");
    api.log("23:45  accepted guesses, last hour: " + pct(night.a) + "; day shift: " + pct(day.a) + ".", "bad");
    api.log("23:45  tokens a second, last hour: " + num(night.rate) + "; helper off, before 15 sep: " + num(ALONE) + ".", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.kept = "0.3";
    if (plan === "r0") C.guesses = "10";
    if (plan === "r1" || plan === "r2") C.helper = "off";
    if (plan === "r3") C.speed = "2.5";
    return C;
  }

  function planFollowUp(api, plan) {
    var pol, eng;
    if (plan === "r0") {
      pol = at("0.3", "10", "5"); eng = at("0.8", "10", "5");
      api.log("10 guesses: rounds of " + pol.text.round + ". polish, 30% kept: " + pol.text.tokens + ", " + pol.text.rate +
        ", a 400-token answer " + pol.text.ans + ". english, 80% kept: " + eng.text.tokens + ", " + eng.text.rate +
        ", down from 73.8.", "bad");
    }
    if (plan === "r1") {
      pol = at("0.3", "5", "5", "off");
      api.log("helper off for every crew: polish " + pol.text.rate + ", a 400-token answer " + pol.text.ans +
        "; english " + pol.text.rate + ", " + pol.text.ans + " instead of " + at("0.8", "5", "5").text.ans + ". same words.", "warn");
    }
    if (plan === "r2") {
      pol = at("0.3", "5", "5", "off"); eng = at("0.8", "5", "5");
      api.log("kept guesses per language: polish, 30% kept, below the break-even of " + eng.text.be + ": helper off, " +
        pol.text.rate + ", " + pol.text.ans + ". english, 80% kept: helper on, " + eng.text.rate + ", " + eng.text.ans +
        ". same words.", "ok");
    }
    if (plan === "r3") {
      pol = at("0.3", "5", "2.5");
      api.log("a 2.5 ms helper: rounds of " + pol.text.round + ". polish, 30% kept: " + pol.text.tokens + ", " + pol.text.rate +
        ", a 400-token answer " + pol.text.ans + ", still below 40. break-even " + pol.text.be +
        ". english: not measured with this helper.", "bad");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["helper", "kept", "guesses", "speed"];
      function syncControls() {
        S.sync = true;
        IDS.forEach(function (id) { S.ctl[id].set(S.C[id]); });
        S.sync = false;
      }
      function chooser(id, label, list) {
        S.ctl[id] = api.control.select(id, label, list, S.C[id], function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          var what = label + ": " + o.label + ".";
          if (S.C.plan !== "none") {
            S.C.plan = "none";
            S.sync = true; S.ctl.plan.set("none"); S.sync = false;
            what += " (reply cleared.)";
          }
          refresh(api, what);
        });
      }
      chooser("helper", "helper", HELPERS);
      chooser("kept", "kept guesses", KEPTS);
      chooser("guesses", "guesses a round", GUESSES);
      chooser("speed", "helper speed", SPEEDS);
      S.ctl.night = api.control.button("night", "play monday night", function () {
        S.C = defaults();
        S.C.kept = "0.3";
        syncControls();
        S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        draw(api);
        setStats(api);
        playNight(api);
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api, "plan: " + o.label + ". polish view:");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        round: api.stat("round", "a round", ""),
        tokens: api.stat("tokens", "kept a round", ""),
        rate: api.stat("rate", "tokens a second", "warn"),
        alone: api.stat("alone", "the big model alone", ""),
        vs: api.stat("vs", "against alone", "warn"),
        be: api.stat("be", "break-even", ""),
        ans: api.stat("ans", "a 400-token answer", "bad"),
        dash: api.stat("dash", "dashboard label", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one token a round can produce. Guess 1 is kept when the big model's check agrees with it; guess 2 only if guess 1 was kept too, and so on, so its chance is the kept share times itself. The big model's own token always comes. The bold row adds them up: the tokens a round keeps on average. Tokens a second is that ÷ the round's time.");

      draw(api);
      setStats(api);
      api.log("21:59 on monday 21 september: the english day crews' last hour. accepted guesses 80%, 73.8 a second.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the English day shift, before the Polish crew's first night.
      t.expect(t.stat("round") === "50 ms" && t.stat("tokens") === "3.69 tokens a round" && t.stat("rate") === "73.8 a second" &&
        t.stat("vs") === "1.84×" && t.stat("alone") === "40 a second" && t.stat("ans") === "5.4 s" &&
        t.stat("be") === "51% kept" && has("21:59 on monday 21 september"),
        "Opens on the English day shift: 50 ms rounds, 3.69 tokens a round, 73.8 a second, 1.84x, break-even 51%");

      // 2. Monday night as it happened.
      t.click("night");
      t.expect(has("23:45  accepted guesses, last hour: 30%; day shift: 80%.") &&
        has("23:45  tokens a second, last hour: 28.6; helper off, before 15 sep: 40.") &&
        t.stat("tokens") === "1.43 tokens a round" && t.stat("rate") === "28.6 a second" && t.stat("ans") === "14.0 s" &&
        t.stat("vs") === "0.71×" && t.stat("dash") === "speed-up: on, 1.84×",
        "The night: 30% kept, 1.43 tokens a round, 28.6 a second, 14.0 s an answer, the label still 1.84x");

      // 3. 50% kept: still below 40.
      t.set("kept", "0.5");
      t.expect(t.stat("tokens") === "1.97 tokens a round" && t.stat("rate") === "39.4 a second",
        "50% kept: 1.97 tokens a round, 39.4 a second, still below 40");

      // 4. 51% kept: just over.
      t.set("kept", "0.51");
      t.expect(t.stat("tokens") === "2.00 tokens a round" && t.stat("rate") === "40.1 a second" && t.stat("vs") === "1.00×",
        "51% kept: 2.00 tokens a round, 40.1 a second");

      // 5. 10 guesses at 30%.
      t.set("kept", "0.3");
      t.set("guesses", "10");
      t.expect(t.stat("round") === "75 ms" && t.stat("rate") === "19.0 a second" && t.stat("ans") === "21.0 s" &&
        t.stat("be") === "67% kept",
        "10 guesses at 30%: 75 ms rounds, 19.0 a second, 21.0 s an answer, break-even 67%");

      // 6. A helper twice as fast at 30%.
      t.set("guesses", "5");
      t.set("speed", "2.5");
      t.expect(t.stat("round") === "37.5 ms" && t.stat("rate") === "38.1 a second" && t.stat("ans") === "10.5 s" &&
        t.stat("be") === "33% kept",
        "2.5 ms helper at 30%: 37.5 ms rounds, 38.1 a second, break-even 33%");

      // 7. Helper off: the big model alone.
      t.set("speed", "5");
      t.set("helper", "off");
      t.expect(t.stat("round") === "25 ms" && t.stat("rate") === "40 a second" && t.stat("ans") === "10.0 s" &&
        t.stat("tokens") === "1 token a pass" && t.stat("dash") === "speed-up: off",
        "Helper off: 25 ms a token, 40 a second, 10.0 s an answer");

      // 8. Reply 0 as played.
      t.set("plan", "r0");
      t.expect(has("10 guesses: rounds of 75 ms. polish, 30% kept: 1.43 tokens a round, 19.0 a second, a 400-token answer 21.0 s. english, 80% kept: 4.57 tokens a round, 60.9 a second, down from 73.8."),
        "Reply 0: 19.0 a second in Polish, 60.9 in English");

      // 9. Reply 1 as played.
      t.set("plan", "r1");
      t.expect(has("helper off for every crew: polish 40 a second, a 400-token answer 10.0 s; english 40 a second, 10.0 s instead of 5.4 s. same words."),
        "Reply 1: 40 a second for everyone; English lose 5.4 s answers");

      // 10. Reply 2 as played.
      t.set("plan", "r2");
      t.expect(has("kept guesses per language: polish, 30% kept, below the break-even of 51% kept: helper off, 40 a second, 10.0 s. english, 80% kept: helper on, 73.8 a second, 5.4 s. same words.") &&
        t.stat("rate") === "40 a second",
        "Reply 2: Polish off at 40, English on at 73.8");

      // 11. Reply 3 as played.
      t.set("plan", "r3");
      t.expect(has("a 2.5 ms helper: rounds of 37.5 ms. polish, 30% kept: 1.43 tokens a round, 38.1 a second, a 400-token answer 10.5 s, still below 40. break-even 33% kept."),
        "Reply 3: 38.1 a second, still below 40");

      // 12. The cold case: English fault-code questions keep 40%.
      t.set("speed", "5");
      t.set("kept", "0.4");
      t.expect(t.stat("tokens") === "1.66 tokens a round" && t.stat("rate") === "33.2 a second" && t.stat("ans") === "12.0 s",
        "Cold case: 40% kept, 1.66 tokens a round, 33.2 a second");
    }
  });
})();
