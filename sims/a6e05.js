/* sims/a6e05-v1.0.0.js  (published as sims/a6e05.js)
   Case a6e05 "Seconds Feel Like Hours": a call clock for Dobrin's, an emergency plumbing firm
   whose phone line is answered by a voice assistant. The learner replays the 23 calls of the
   first hard frost (00:14 to 02:05) through the assistant's steps under different settings,
   and reads when the first word is spoken, whether the phone line has already hung up, and the
   average and slowest of the 23. No real model runs here: every step's time is stated below.
   Widget-style sim: it draws its own call clock and table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: Replay the 23 calls, gas check on or off, the
     checks in a chain or at once, streaming the reply on or off, silence limit (10 s or 30 s),
     smaller model on or off, hold music on or off, which call is drawn, a plan (one of the four
     replies), Reset. Stats: first word, reply fully written, what the line did, calls kept,
     average first word, slowest first word, urgent calls marked for morning. selfTest: 10
     assertions.

   The model (stated in sim.lede). Times in tenths of a second, counted from the caller's last word.
   - Larger model (as built): speech to text 0.6, urgency check 1.8, problem summary 2.0 plus the
     call's extra, gas check 2.2, nearest plumber 0.5, whole reply 3.4; with streaming, the
     reply's first sentence is ready 0.7 after the reply starts.
   - Smaller model: speech to text 0.6 and nearest plumber 0.5 (not model steps) unchanged;
     urgency 1.1, summary 1.2 plus the extra, gas 1.3, whole reply 2.0, first sentence 0.4.
   - Chain: every step starts when the one before ends. At once: the three checks start together
     after speech to text; the plumber search waits for the slowest of them (it needs the urgency
     and the summary; the gas check's warning goes into the reply).
   - First word: when the reply starts plus the whole reply (no streaming) or the first sentence
     (streaming). Reply fully written: when the reply starts plus the whole reply.
   - The phone service hangs up after the silence limit of silence. Music is not silence, so with
     hold music no call is hung up. A call is kept when hold music is on or its first word comes
     before the limit.
   - EXTRA: how much longer each call's summary took, from how long the caller talked (tenths).
     URGENT: the 10 calls the larger model marked urgent. SMALL_MISS: the 3 of those the smaller
     model marked "can wait until morning" when Mr Dobrin replayed the night through it.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e05-v1.0.0.json).
   - Before 22:00 (no gas check): 0.6 + 1.8 + 2.0 + 0.5 + 3.4 = 8.3 s on a typical call; the 23
     calls' slowest 9.1 (call 10, extra 0.8), average 8.5; all kept.
   - Tonight (gas check in the chain): 8.3 + 2.2 = 10.5 s; average 10.7, slowest 11.3; 0 of 23 kept.
     Call 1: last word 00:14:06.0, then 06.6, 08.4, 10.4, 12.6, 13.1, first word 16.5.
   - Silence limit 30 s, or hold music: 23 of 23 kept; first word unchanged, 10.5 / 10.7 / 11.3.
   - Smaller model, chain: 0.6 + 1.1 + 1.2 + 1.3 + 0.5 + 2.0 = 6.7; average 6.9, slowest 7.5;
     23 kept; 3 of 10 urgent calls marked for morning (00:52, 01:31, 01:53).
   - Checks at once only: 0.6 + 2.2 + 0.5 + 3.4 = 6.7; average 6.8, slowest 7.3.
   - Streaming only: 0.6 + 1.8 + 2.0 + 2.2 + 0.5 + 0.7 = 7.8; average 8.0, slowest 8.6.
   - Both (the fix): 0.6 + 2.2 + 0.5 + 0.7 = 4.0; average 4.1, slowest 4.6 (call 10: summary
     2.8, 0.6 + 2.8 + 0.5 + 0.7); reply fully written 6.7 on call 1.
   - With 23 calls, the 99th percentile (p99) is the slowest call.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BIG = { urg: 18, sum: 20, gas: 22, reply: 34, first: 7 };
  var SMALL = { urg: 11, sum: 12, gas: 13, reply: 20, first: 4 };
  var STT = 6, PLUMBER = 5;
  var TIMES = ["00:14", "00:21", "00:29", "00:33", "00:40", "00:46", "00:52", "00:58", "01:03", "01:07", "01:12", "01:18",
    "01:22", "01:27", "01:31", "01:36", "01:40", "01:44", "01:49", "01:53", "01:57", "02:01", "02:05"];
  var EXTRA = [0, 2, 0, 1, 4, 0, 3, 0, 1, 8, 0, 2, 0, 5, 1, 0, 3, 0, 2, 6, 0, 1, 0];
  var URGENT = [1, 3, 5, 7, 10, 12, 15, 18, 20, 23];
  var SMALL_MISS = [7, 15, 20];
  var SAID = {
    1: "Summary: burst pipe under the kitchen sink. Reply: Imrich is on his way, about 35 minutes.",
    10: "Summary: frozen pipe split in the loft, a long story. Reply: Liesbet is on her way, about 50 minutes.",
    18: "Summary: split pipe by the boiler, smell of gas. Reply: leave the house now and ring the gas emergency line; Imrich will come when they say it is safe.",
    20: "Summary: water running through a ceiling light. Reply: Liesbet is on her way, about 40 minutes."
  };
  var LIMITS = [{ value: "10", label: "10 s (as set)" }, { value: "30", label: "30 s" }];
  var MODES = [{ value: "chain", label: "In a chain, one after another (as built)" }, { value: "once", label: "The three checks at once" }];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: silence limit 30 s" },
    { value: "r1", label: "Reply: smaller model everywhere" },
    { value: "r2", label: "Reply: checks at once, speak at first sentence" },
    { value: "r3", label: "Reply: hold music" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function sec(t) { return (t / 10).toFixed(1) + " s"; }
  function defaults() { return { gas: true, mode: "chain", stream: false, limit: 10, small: false, hold: false, call: 1, plan: "none" }; }
  function isIn(list, n) { return list.indexOf(n) >= 0; }

  /* ---------- the model (pure: config in, replay out) ---------- */

  function oneCall(n, C) {
    var M = C.small ? SMALL : BIG, extra = EXTRA[n - 1];
    var steps = [{ name: "Speech to text", a: 0, b: STT }];
    var urg = M.urg, sum = M.sum + extra, gas = C.gas ? M.gas : 0, t;
    if (C.mode === "once") {
      steps.push({ name: "Urgency check", a: STT, b: STT + urg });
      steps.push({ name: "Problem summary", a: STT, b: STT + sum });
      if (C.gas) steps.push({ name: "Gas check", a: STT, b: STT + gas });
      t = STT + Math.max(urg, sum, gas);
    } else {
      steps.push({ name: "Urgency check", a: STT, b: STT + urg });
      steps.push({ name: "Problem summary", a: STT + urg, b: STT + urg + sum });
      t = STT + urg + sum;
      if (C.gas) { steps.push({ name: "Gas check", a: t, b: t + gas }); t += gas; }
    }
    steps.push({ name: "Nearest plumber", a: t, b: t + PLUMBER });
    t += PLUMBER;
    steps.push({ name: C.stream ? "Reply, streamed" : "Whole reply written", a: t, b: t + M.reply });
    var first = t + (C.stream ? M.first : M.reply);
    var kept = C.hold || first < C.limit * 10;
    return { n: n, steps: steps, first: first, done: t + M.reply, kept: kept,
      urgent: isIn(URGENT, n), marked: isIn(URGENT, n) && !(C.small && isIn(SMALL_MISS, n)) };
  }

  function replay(C) {
    var calls = [], kept = 0, sum = 0, slow = null, missed = 0;
    for (var n = 1; n <= 23; n++) {
      var c = oneCall(n, C);
      calls.push(c);
      if (c.kept) kept++;
      sum += c.first;
      if (!slow || c.first > slow.first) slow = c;
      if (c.urgent && !c.marked) missed++;
    }
    return { calls: calls, kept: kept, avg: (sum / 230).toFixed(1) + " s", slow: slow, missed: missed };
  }

  function fate(c, C) {
    if (c.kept) return C.hold && c.first >= C.limit * 10 ? "kept by the music: first word heard" : "kept: first word heard";
    return "hung up at " + sec(C.limit * 10);
  }

  function summary(C, R) {
    return "Replay: " + (C.mode === "chain" ? "chain" : "checks at once") + ", gas check " + (C.gas ? "on" : "off") +
      ", streaming " + (C.stream ? "on" : "off") + ", silence limit " + C.limit + " s, " + (C.small ? "smaller" : "larger") +
      " model, hold music " + (C.hold ? "on" : "off") + ": " + R.kept + " of 23 calls kept. First word: " + sec(R.calls[0].first) +
      " on call 1, " + R.avg + " average, " + sec(R.slow.first) + " slowest (call " + R.slow.n + ", " + TIMES[R.slow.n - 1] +
      "). Urgent calls marked for morning: " + R.missed + " of 10.";
  }

  function callLine(C, R) {
    var c = R.calls[C.call - 1];
    var said = SAID[c.n] ? " " + SAID[c.n] : "";
    if (!c.kept) return "Call " + c.n + ", " + TIMES[c.n - 1] + ": first word at " + sec(c.first) + "; the line hung up at " +
      sec(C.limit * 10) + ". Reply spoken into a dead line." + said;
    return "Call " + c.n + ", " + TIMES[c.n - 1] + ": first word at " + sec(c.first) + ", reply fully written at " + sec(c.done) +
      ". The caller hears it." + said;
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
    var clock = el("div", "display:grid;gap:4px;min-width:0;", "", box);
    var wrap = el("div", "overflow-x:auto;max-height:260px;overflow-y:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var foot = el("p", "margin:0;", "", box);
    return { el: el, head: head, clock: clock, table: table, foot: foot };
  }

  var SCALE = 120; // the drawn clock runs 0 to 12.0 s after the caller's last word

  function bar(ui, label, parts) {
    var line = ui.el("div", "display:grid;grid-template-columns:130px 1fr;gap:6px;align-items:center;", "", ui.clock);
    ui.el("span", "", label, line);
    var track = ui.el("div", "position:relative;height:14px;border-bottom:1px dashed currentColor;opacity:0.95;", "", line);
    parts.forEach(function (p) {
      var a = Math.min(p.a, SCALE), b = Math.min(p.b, SCALE);
      if (b <= a) return;
      ui.el("span", "position:absolute;top:1px;height:12px;left:" + (a * 100 / SCALE) + "%;width:" + ((b - a) * 100 / SCALE) +
        "%;" + p.look + "border-radius:2px;", "", track);
    });
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui, R = S.R;
    ui.head.textContent = "Steps: " + pick(MODES, C.mode).label + ". Gas check " + (C.gas ? "on" : "off") + ". Streaming " +
      (C.stream ? "on" : "off") + ". Silence limit " + C.limit + " s. " + (C.small ? "Smaller" : "Larger") + " model. Hold music " +
      (C.hold ? "on" : "off") + ".";
    while (ui.clock.firstChild) ui.clock.removeChild(ui.clock.firstChild);
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    if (!R) { ui.foot.textContent = "00:00. Nothing replayed yet. The clock below starts at each caller's last word."; return; }
    var c = R.calls[C.call - 1];
    ui.el("p", "margin:0;", "Call " + c.n + ", " + TIMES[c.n - 1] + ": seconds after the caller's last word, 0 to 12. Silence limit" +
      (C.limit * 10 > SCALE ? " (30 s, off the clock)." : " (" + C.limit + " s)."), ui.clock);
    var STEP = "background:currentColor;opacity:0.45;", SOLID = "background:currentColor;opacity:0.9;",
      FAINT = "border:1px dotted currentColor;box-sizing:border-box;",
      STRIPE = "background:repeating-linear-gradient(90deg,currentColor 0 3px,transparent 3px 7px);opacity:0.6;";
    c.steps.forEach(function (s) {
      var parts = [{ a: s.a, b: s.b, look: STEP }];
      if (s.name === "Reply, streamed") parts.push({ a: s.a, b: s.a + (C.small ? SMALL.first : BIG.first), look: SOLID });
      bar(ui, s.name + " (" + sec(s.b - s.a) + ")", parts);
    });
    var hear = [];
    var cut = c.kept ? c.first : C.limit * 10;
    hear.push({ a: 0, b: cut, look: C.hold ? STRIPE : FAINT });
    if (c.kept) hear.push({ a: c.first, b: SCALE, look: SOLID });
    bar(ui, "Caller hears", hear);
    var lim = ui.el("p", "margin:0;", "", ui.clock);
    lim.textContent = "Dotted outline: silence. Stripes: hold music. Solid: the assistant speaking (and, on a streamed reply, its first sentence). " + (c.kept ? "First word at " + sec(c.first) + "." :
      "Line hung up at " + sec(C.limit * 10) + "; first word due at " + sec(c.first) + ".");
    row(ui, ["call", "time", "first word", "reply written", "line", "urgency"], true);
    R.calls.forEach(function (x) {
      row(ui, [x.n, TIMES[x.n - 1], sec(x.first), sec(x.done), x.kept ? "kept" : "hung up",
        x.urgent ? (x.marked ? "urgent" : "marked for morning (urgent)") : "routine"]);
    });
    ui.foot.textContent = "Average first word " + R.avg + "; slowest " + sec(R.slow.first) + " (call " + R.slow.n +
      "). With 23 calls, the 99th percentile is the slowest call.";
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function setStats(api) {
    var S = api.state, R = S.R, st = S.stat, C = S.C;
    if (!R) {
      st.first("not replayed yet"); st.done("-"); st.fate("-"); st.kept("-"); st.avg("-"); st.slow("-"); st.missed("-");
      return;
    }
    var c = R.calls[C.call - 1];
    st.first(sec(c.first));
    st.done(sec(c.done));
    st.fate(fate(c, C));
    st.kept(R.kept + " of 23");
    st.avg(R.avg);
    st.slow(sec(R.slow.first));
    st.missed(R.missed);
  }

  function run(api, what) {
    var S = api.state;
    S.R = replay(S.C);
    draw(api);
    setStats(api);
    api.log((what ? what + " " : "") + summary(S.C, S.R), S.R.kept === 23 ? "ok" : "bad");
    api.log(callLine(S.C, S.R), S.R.calls[S.C.call - 1].kept ? "" : "bad");
  }

  function planOutcome(plan, R) {
    if (plan === "r0" || plan === "r3") return "Every call kept, and the wait unchanged: first word " + sec(R.calls[0].first) +
      " on call 1, " + R.avg + " average, " + sec(R.slow.first) + " slowest.";
    if (plan === "r1") return "Still a chain, 6.7 s of silence on call 1. Urgent calls marked for morning: " + R.missed +
      " of 10 (00:52, 01:31, 01:53).";
    return "Call 1: 0.6 + 2.2 + 0.5 + 0.7 = 4.0 s to the first word. The slowest, call 10 at 01:07, waits for its 2.8 s summary: 4.6 s.";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        run(api, what);
      }
      S.ctl.replay = api.control.button("replay", "Replay the 23 calls", function () { run(api, ""); });
      S.ctl.gas = api.control.toggle("gas", "Gas check (added at 22:00)", true, function (on) {
        S.C.gas = !!on;
        manual("Gas check " + (on ? "on." : "off."));
      });
      S.ctl.mode = api.control.select("mode", "The three checks run", MODES, "chain", function (v) {
        var o = pick(MODES, v);
        if (!o) return;
        S.C.mode = String(o.value);
        manual("Checks: " + o.label + ".");
      });
      S.ctl.stream = api.control.toggle("stream", "Stream the reply: speak from the first sentence", false, function (on) {
        S.C.stream = !!on;
        manual("Streaming " + (on ? "on." : "off."));
      });
      S.ctl.limit = api.control.select("limit", "Silence limit on the phone line", LIMITS, "10", function (v) {
        var o = pick(LIMITS, v);
        if (!o) return;
        S.C.limit = Number(o.value);
        manual("Silence limit: " + o.label + ".");
      });
      S.ctl.small = api.control.toggle("small", "Smaller model for every check and the reply", false, function (on) {
        S.C.small = !!on;
        manual("Smaller model " + (on ? "on." : "off."));
      });
      S.ctl.hold = api.control.toggle("hold", "Hold music from the caller's last word", false, function (on) {
        S.C.hold = !!on;
        manual("Hold music " + (on ? "on." : "off."));
      });
      S.ctl.call = api.control.select("call", "Call drawn on the clock", TIMES.map(function (t, i) {
        return { value: String(i + 1), label: "Call " + (i + 1) + ", " + t };
      }), "1", function (v) {
        var n = Number(v);
        if (!(n >= 1 && n <= 23)) return;
        S.C.call = n;
        if (S.R) { draw(api); setStats(api); api.log(callLine(S.C, S.R), S.R.calls[n - 1].kept ? "" : "bad"); } else draw(api);
      });
      S.ctl.plan = api.control.select("plan", "Play a reply (replays the 23 calls)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = defaults();
        C.plan = String(o.value);
        C.call = S.C.call;
        if (C.plan === "r0") C.limit = 30;
        if (C.plan === "r1") C.small = true;
        if (C.plan === "r2") { C.mode = "once"; C.stream = true; }
        if (C.plan === "r3") C.hold = true;
        S.C = C;
        S.ctl.gas.set(C.gas); S.ctl.mode.set(C.mode); S.ctl.stream.set(C.stream); S.ctl.limit.set(String(C.limit));
        S.ctl.small.set(C.small); S.ctl.hold.set(C.hold);
        run(api, "Plan: " + o.label + ".");
        api.log(planOutcome(C.plan, S.R), "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        first: api.stat("first", "first word, after the caller's last word", "warn"),
        done: api.stat("done", "reply fully written", ""),
        fate: api.stat("fate", "what the line did", "bad"),
        kept: api.stat("kept", "calls kept, of 23", ""),
        avg: api.stat("avg", "average first word, 23 calls", ""),
        slow: api.stat("slow", "slowest first word (with 23 calls, the p99)", "warn"),
        missed: api.stat("missed", "urgent calls marked for morning", "bad")
      };

      api.info("<strong>How to read it.</strong> Each bar is one step of the drawn call, timed from the caller's last word. The phone line hangs up after the silence limit of silence; music is not silence. The table shows all 23 calls of the frost night under the settings you chose.");

      draw(api);
      setStats(api);
      api.log("00:00. Since 22:00 the gas check is the third check in the chain. 23 calls follow, 00:14 to 02:05; nothing replayed yet.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. The opening state: midnight, tonight's settings, nothing replayed.
      t.expect(t.stat("first") === "not replayed yet" && t.stat("kept") === "-" &&
        t.logText().indexOf("00:00. Since 22:00 the gas check is the third check in the chain. 23 calls follow, 00:14 to 02:05; nothing replayed yet.") >= 0,
        "Opens at 00:00 with the gas check in the chain and nothing replayed");

      // 2. Tonight: 10.5 s to the first word, every call hung up at 10.0 s.
      begin();
      t.click("replay");
      t.expect(t.stat("first") === "10.5 s" && t.stat("fate") === "hung up at 10.0 s" && t.stat("kept") === "0 of 23" &&
        t.stat("avg") === "10.7 s" && t.stat("slow") === "11.3 s" &&
        has("Call 1, 00:14: first word at 10.5 s; the line hung up at 10.0 s. Reply spoken into a dead line. Summary: burst pipe under the kitchen sink. Reply: Imrich is on his way, about 35 minutes."),
        "Tonight: 10.5 s on call 1, 10.7 s average, 11.3 s slowest, 0 of 23 kept");

      // 3. Before 22:00: no gas check, 8.3 s, slowest 9.1 s, every call kept.
      t.set("gas", false);
      t.expect(t.stat("first") === "8.3 s" && t.stat("kept") === "23 of 23" && t.stat("avg") === "8.5 s" && t.stat("slow") === "9.1 s",
        "Before 22:00: 8.3 s on a typical call, 9.1 s slowest, all kept");
      t.set("gas", true);

      // 4. Silence limit 30 s: kept, the wait unchanged.
      t.set("limit", "30");
      t.expect(t.stat("kept") === "23 of 23" && t.stat("first") === "10.5 s" && t.stat("avg") === "10.7 s" && t.stat("slow") === "11.3 s",
        "Limit 30 s: all 23 kept, first word still 10.5 s, 11.3 s slowest");
      t.set("limit", "10");

      // 5. Hold music: kept by the music, the wait unchanged.
      t.set("hold", true);
      t.expect(t.stat("kept") === "23 of 23" && t.stat("first") === "10.5 s" && t.stat("slow") === "11.3 s" &&
        t.stat("fate") === "kept by the music: first word heard",
        "Hold music: all kept, first word still 10.5 s");
      t.set("hold", false);

      // 6. Smaller model: a faster chain, three urgent calls marked for morning.
      t.set("small", true);
      t.expect(t.stat("first") === "6.7 s" && t.stat("kept") === "23 of 23" && t.stat("avg") === "6.9 s" && t.stat("slow") === "7.5 s" &&
        t.stat("missed") === 3,
        "Smaller model: 6.7 s, 6.9 s average, 7.5 s slowest, 3 urgent calls marked for morning");
      t.set("small", false);

      // 7. Each half of the fix alone.
      t.set("mode", "once");
      var once = t.stat("first") === "6.7 s" && t.stat("slow") === "7.3 s" && t.stat("avg") === "6.8 s";
      t.set("mode", "chain");
      t.set("stream", true);
      t.expect(once && t.stat("first") === "7.8 s" && t.stat("slow") === "8.6 s" && t.stat("avg") === "8.0 s" && t.stat("done") === "10.5 s",
        "Checks at once alone: 6.7 s; streaming alone: 7.8 s, the reply still fully written at 10.5 s");

      // 8. Both: about 4.0 s to the first word.
      t.set("mode", "once");
      t.expect(t.stat("first") === "4.0 s" && t.stat("done") === "6.7 s" && t.stat("avg") === "4.1 s" && t.stat("slow") === "4.6 s" &&
        t.stat("kept") === "23 of 23" && t.stat("missed") === 0,
        "Checks at once and streaming: 4.0 s on call 1, 4.1 s average, 4.6 s slowest");

      // 9. The slowest call, drawn: call 10's long summary.
      t.set("call", "10");
      t.expect(t.stat("first") === "4.6 s" && t.stat("fate") === "kept: first word heard",
        "Call 10 at 01:07: 4.6 s to the first word");
      t.set("call", "1");
      t.set("mode", "chain");
      t.set("stream", false);

      // 10. The four replies.
      begin();
      t.set("plan", "r0");
      var r0 = has("23 of 23 calls kept") && has("Every call kept, and the wait unchanged: first word 10.5 s on call 1, 10.7 s average, 11.3 s slowest.");
      begin();
      t.set("plan", "r1");
      var r1 = has("Urgent calls marked for morning: 3 of 10 (00:52, 01:31, 01:53).");
      begin();
      t.set("plan", "r2");
      var r2 = has("First word: 4.0 s on call 1, 4.1 s average, 4.6 s slowest (call 10, 01:07).");
      begin();
      t.set("plan", "r3");
      t.expect(r0 && r1 && r2 && has("Every call kept, and the wait unchanged: first word 10.5 s on call 1"),
        "Replies: 30 s and hold music keep the 10.5 s wait; the smaller model misses 3 urgent calls; the fix gives 4.0 s");
    }
  });
})();
