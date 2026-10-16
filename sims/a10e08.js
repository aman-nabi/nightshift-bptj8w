/* sims/a10e08-v1.0.0.js  (published as sims/a10e08.js)
   Case a10e08 "The Engines": an engine replay for the assistant of a motorway resurfacing contractor on
   the night of Wednesday 7 October 2026, the first 22:00 start after IT switched serving engines at
   14:00. No real model runs here and no text is generated: every figure is worked out from the given
   numbers below (also stated in sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: engine (vllm; tensorrt-llm built with a largest batch of
     16; built with 64), copies (1 or 2 cards), arrivals (all at 22:00:00, or 16 a minute), load (12, 64
     or 80 questions), play 22:00, play a reply, reset. Stats: first word for the first crew, the longest
     wait for a first word, waves, the last answer, tokens a second each, slots a card, cards, cost, and
     the dashboard's afternoon sum. selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 8B: 16.06 billion bytes in 16 bits, about 15 GB on the card's meter (1 GB = 1,024 MB);
     working memory 128 KB a token (2 x 32 layers x 8 heads x 128 numbers x 2 bytes = 131,072 bytes).
   - one H100: 80 GB, 3.35 TB/s (the maker's 1,000). rented by the hour at $4.29, one provider's list
     price for a single H100 SXM on 16 October 2026; a month is 730 hours.
   - each question carries its crew's method statement, about 1,500 tokens, and the summary is about
     500 tokens: 2,000 tokens x 128 KB = 250 MB of working memory an answer while it is written.
   - every summary in the sim is 500 tokens, so the answers started together finish together.
   - the contractor's own measurements, never a source's:
     vllm: 45 tokens a second each with 64 at once, first word 0.3 s (last week's 22:00 peak, Wednesday
       30 September); 55 a second each with up to 16 at once, first word 0.2 s (the afternoon test, 12).
     tensorrt-llm: 72 a second each with up to 16 at once, first word 0.2 s (the afternoon test, 12, and
       each 16-answer wave in tonight's log taking 6.9 s); built for 64, with 64 at once: 54 a second
       each, first word 0.3 s (the contractor's own replay in reply 1, never a source's).
     any other number at once on one card (32, 80) was not measured: the sim says so instead of guessing.
   - vllm decides how many answers run together from free memory while running: 64 answers need 64 x
     250 MB = 15.6 GB beside 15 GB of weights, so all 64 fit on the 80 GB card. tensorrt-llm runs at most
     the largest batch fixed when it was built; the rest wait, and a new wave starts as slots free.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e08-v1.0.0.json):
   - an answer takes 500 / rate: 72 -> 6.944, 6.9 s; 55 -> 9.091, 9.1 s; 45 -> 11.111, 11.1 s; 54 ->
     9.259, 9.3 s.
   - the night as built (16 slots, 64 at 22:00:00): waves start at 0, 6.944, 13.889, 20.833 (0, 6.9,
     13.9, 20.8 s); the last 16 crews' first word 20.833 + 0.2 = 21.033, 21.0 s; the last answer
     4 x 6.944 = 27.778, 27.8 s. first words of waves 2 and 3: 7.1 s and 14.1 s.
   - the dashboard: 72 / 55 = 1.309, 1.31 times, typed in at 14:00 as "answers 30% faster than last
     week"; both figures are the afternoon test's, 12 at once.
   - reply 0, two copies of the 16-slot build: 32 slots, 32 questions a card, 2 waves: second wave first
     word 6.944 + 0.2 = 7.144, 7.1 s; last answer 13.889, 13.9 s; $8.58 an hour, 2 x $3,131.70 =
     $6,263.40, $6,263 a month, against $3,132 for one card.
   - reply 1, built for 64: one wave, first word 0.3 s, 54 a second each, 9.3 s; memory 15 GB + 15.6 GB =
     30.6 GB of 80.
   - reply 2, vllm: one wave, first word 0.3 s, 45 a second each, 11.1 s; at 12 at once 55 against 72:
     9.1 s against 6.9 s, 55 / 72 = 0.764, close to a quarter slower.
   - reply 3, 16 a minute at 22:00, 22:01, 22:02, 22:03 on the 16-slot build: every first word 0.2 s,
     every answer 6.9 s; the last group asks at 22:03:00 and its answers end at 186.944, 186.9 s.
   - cold case, 80 crews on the build for 64: 64 run (54 a second, 9.259 s), 16 wait; second wave first
     word 9.259 + 0.2 = 9.459, 9.5 s; last answer 9.259 + 6.944 = 16.204, 16.2 s.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var TOKENS = 500;            // a summary, in tokens
  var PRICE = 4.29;            // a card hour, one provider's list price for a single h100
  var HOURS = 730;             // a month
  var ENGINES = [
    { value: "vllm", label: "vllm: batch sized from free memory", cap: Infinity },
    { value: "trt16", label: "tensorrt-llm built with a largest batch of 16", cap: 16 },
    { value: "trt64", label: "tensorrt-llm built with a largest batch of 64", cap: 64 }
  ];
  var COPIES = [
    { value: "1", label: "1 copy, 1 card" },
    { value: "2", label: "2 copies, 2 cards" }
  ];
  var ARRIVALS = [
    { value: "together", label: "all at 22:00:00, when the permits start" },
    { value: "staggered", label: "16 a minute from 22:00" }
  ];
  var LOADS = [
    { value: "12", label: "12 questions (the afternoon test)" },
    { value: "64", label: "64 questions (the 22:00 peak)" },
    { value: "80", label: "80 questions (two contracts, december)" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a second copy on another card" },
    { value: "r1", label: "reply 1: replay our peak, build from it" },
    { value: "r2", label: "reply 2: back to vllm" },
    { value: "r3", label: "reply 3: crews ask a few minutes apart" }
  ];

  // tokens a second each, and seconds to the first word, by engine and answers at once on one card
  function rate(engine, n) {
    if (engine === "vllm") return n <= 16 ? 55 : (n === 64 ? 45 : null);
    if (engine === "trt16") return n <= 16 ? 72 : null;
    return n <= 16 ? 72 : (n === 64 ? 54 : null);
  }
  function firstToken(n) { return n <= 16 ? 0.2 : 0.3; }

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { engine: "trt16", copies: "1", arrivals: "together", load: "12", plan: "none" };
  }
  function s1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function clock(sec) {
    var whole = Math.floor(Math.round(sec * 10) / 10);
    var tenth = Math.round(sec * 10) % 10;
    var m = Math.floor(whole / 60), s = whole % 60;
    return "22:" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + "." + tenth;
  }
  function money(x) {
    var r = Math.round(x);
    return "$" + String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* ---------- the replay (pure: settings in, timings out) ---------- */

  function arrivalsOf(C) {
    var n = Number(C.load), out = [];
    for (var i = 0; i < n; i++) out.push({ crew: i + 1, at: C.arrivals === "staggered" ? 60 * Math.floor(i / 16) : 0 });
    return out;
  }

  // every group asks at one instant and, in every setting offered, finishes before the next group asks,
  // so a wave runs alone: its answers start together and, all 500 tokens, end together.
  function replay(C) {
    var eng = pick(ENGINES, C.engine), k = Number(C.copies);
    var cards = [], i;
    for (i = 0; i < k; i++) cards.push([]);
    arrivalsOf(C).forEach(function (a, j) { cards[j % k].push(a); });
    var R = { waves: [], answers: [], unmeasured: false, maxWaves: 0 };
    cards.forEach(function (queue, c) {
      var t = 0, w = 0, q = queue.slice();
      while (q.length) {
        var start = Math.max(t, q[0].at);
        var batch = [];
        while (q.length && q[0].at <= start && batch.length < eng.cap) batch.push(q.shift());
        var r = rate(C.engine, batch.length);
        if (r === null) { R.unmeasured = batch.length; return; }
        var end = start + TOKENS / r, first = start + firstToken(batch.length);
        w++;
        R.waves.push({ card: c + 1, start: start, first: first, end: end, n: batch.length, rate: r, waiting: q.filter(function (x) { return x.at <= start; }).length });
        batch.forEach(function (a) { R.answers.push({ crew: a.crew, at: a.at, start: start, first: first, end: end, rate: r }); });
        t = end;
      }
      R.maxWaves = Math.max(R.maxWaves, w);
    });
    return R;
  }

  function figures(C) {
    var R = replay(C), k = Number(C.copies);
    var eng = pick(ENGINES, C.engine);
    var T = {};
    T.cards = k + (k === 1 ? " card" : " cards");
    T.cost = "$" + (PRICE * k).toFixed(2) + " an hour, " + money(PRICE * k * HOURS) + " a month";
    T.slots = eng.cap === Infinity ? "from free memory" : eng.cap + " a card";
    T.dash = "72 ÷ 55 = 1.31×";
    if (R.unmeasured) {
      T.first = T.wait = T.waves = T.last = T.rate = "not measured";
      T.note = R.unmeasured + " answers at once on one card was not measured in any replay; the sim will not guess.";
      R.text = T;
      return R;
    }
    var firstCrew = R.answers.reduce(function (m, a) { return Math.min(m, a.first - a.at); }, Infinity);
    var wait = R.answers.reduce(function (m, a) { return Math.max(m, a.first - a.at); }, 0);
    var last = R.answers.reduce(function (m, a) { return Math.max(m, a.end); }, 0);
    var rates = [];
    R.waves.forEach(function (w) { if (rates.indexOf(w.rate) < 0) rates.push(w.rate); });
    rates.sort(function (a, b) { return a - b; });
    T.first = s1(firstCrew) + " s";
    T.wait = s1(wait) + " s";
    T.waves = R.maxWaves + (R.maxWaves === 1 ? " wave" : " waves") + (k > 1 ? " a card" : "");
    T.last = s1(last) + " s";
    T.rate = rates.join(" and ") + " a second each";
    T.note = "";
    R.wait = wait; R.last = last;
    R.text = T;
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
    var C = api.state.C, ui = api.state.ui, R = figures(C);
    var eng = pick(ENGINES, C.engine);
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    ui.head.textContent = eng.label + ", " + pick(COPIES, C.copies).label + ". " + C.load + " questions, " +
      pick(ARRIVALS, C.arrivals).label + ". every summary 500 tokens.";
    if (R.unmeasured) {
      ui.note.textContent = R.text.note;
      return;
    }
    row(ui, ["crews", "card", "asked", "starts", "first word", "done", "tokens a second each"], true);
    var groups = [];
    var k = Number(C.copies);
    function cardOf(a) { return ((a.crew - 1) % k) + 1; }
    R.answers.slice().sort(function (a, b) { return (cardOf(a) - cardOf(b)) || (a.crew - b.crew); }).forEach(function (a) {
      var g = groups.length ? groups[groups.length - 1] : null;
      var key = [cardOf(a), a.at, a.start, a.end].join("|");
      if (g && g.key === key && g.to === a.crew - k) { g.to = a.crew; g.count++; }
      else groups.push({ key: key, from: a.crew, to: a.crew, count: 1, a: a, card: cardOf(a) });
    });
    groups.forEach(function (g) {
      var who = g.count === 1 ? "crew " + g.from : (Number(C.copies) > 1 ? g.count + " crews from " + g.from : "crews " + g.from + " to " + g.to);
      row(ui, [who, g.card, s1(g.a.at) + " s", s1(g.a.start) + " s", s1(g.a.first) + " s", s1(g.a.end) + " s", g.a.rate],
        false, g.a.first - g.a.at > 5);
    });
    ui.note.textContent = "times are seconds after 22:00:00. longest wait for a first word " + R.text.wait +
      "; last answer " + R.text.last + ". " + R.text.cards + ", " + R.text.cost + ".";
  }

  function setStats(api) {
    var T = figures(api.state.C).text, st = api.state.stat;
    st.first(T.first); st.wait(T.wait); st.waves(T.waves); st.last(T.last); st.rate(T.rate);
    st.slots(T.slots); st.cards(T.cards); st.cost(T.cost); st.dash(T.dash);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = figures(api.state.C);
    if (what) api.log(what + (R.unmeasured ? " " + R.text.note : " longest wait for a first word " + R.text.wait + ", last answer " + R.text.last + "."),
      R.unmeasured ? "warn" : (R.wait > 5 ? "bad" : "ok"));
  }

  function at(engine, copies, arrivals, load) {
    return figures({ engine: engine, copies: copies, arrivals: arrivals, load: load, plan: "none" });
  }

  function playNight(api) {
    var R = at("trt16", "1", "together", "64");
    var total = 64;
    R.waves.forEach(function (w, i) {
      var left = total - 16 * (i + 1);
      if (i === 0) api.log(clock(w.start) + "  64 questions arrive. 16 answers start, 48 questions wait.", "warn");
      else api.log(clock(w.start) + "  16 answers finish. " + (left > 0 ? "16 more answers start, " + left + " questions wait." : "the last 16 answers start."), "warn");
    });
    var lastWave = R.waves[R.waves.length - 1];
    api.log(clock(lastWave.first) + "  the last 16 crews get their first word.", "bad");
    api.log(clock(lastWave.end) + "  the last 16 answers finish.", "bad");
    api.log("dashboard: answers 30% faster than last week (72 ÷ 55 = 1.31, the afternoon test, 12 at once).", "");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan; C.load = "64";
    if (plan === "r0") { C.copies = "2"; }
    if (plan === "r1") { C.engine = "trt64"; }
    if (plan === "r2") { C.engine = "vllm"; }
    if (plan === "r3") { C.arrivals = "staggered"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var a, b;
    if (plan === "r0") {
      a = at("trt16", "2", "together", "64");
      api.log("two copies of the 16-slot build: 32 slots for 64 crews, " + a.text.waves + ". the second wave's first word " +
        a.text.wait + ", last answer " + a.text.last + ". " + a.text.cost + ", twice one card's " + at("trt16", "1", "together", "64").text.cost + ".", "bad");
    }
    if (plan === "r1") {
      a = at("vllm", "1", "together", "64"); b = at("trt16", "1", "together", "64");
      var c = at("trt64", "1", "together", "64");
      api.log("replay of 64 at 22:00:00: vllm " + a.text.last + "; built for 16, " + b.text.waves + ", last " + b.text.last +
        "; built for 64, " + c.text.waves + ", first word " + c.text.first + ", " + c.text.rate + ", last " + c.text.last +
        ". memory: 15 GB + 64 × 250 MB = 30.6 GB of 80.", "ok");
    }
    if (plan === "r2") {
      a = at("vllm", "1", "together", "64"); b = at("vllm", "1", "together", "12");
      api.log("back to vllm: 64 at once, first word " + a.text.first + ", " + a.text.rate + ", last " + a.text.last +
        ". 12 at once: " + b.text.rate + ", " + b.text.last + " against 72 and 6.9 s.", "warn");
    }
    if (plan === "r3") {
      a = at("trt16", "1", "staggered", "64");
      api.log("16 a minute on the 16-slot build: every first word " + a.text.wait + ", every answer 6.9 s; the last group asks at 22:03:00, last answer " +
        a.text.last + " after 22:00:00.", "warn");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["engine", "copies", "arrivals", "load"];
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
      chooser("engine", "engine", ENGINES);
      chooser("copies", "copies", COPIES);
      chooser("arrivals", "arrivals", ARRIVALS);
      chooser("load", "load", LOADS);
      S.ctl.night = api.control.button("night", "play 22:00", function () {
        S.C = defaults();
        S.C.load = "64";
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
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        first: api.stat("first", "first word, first crew", ""),
        wait: api.stat("wait", "longest wait for a first word", "bad"),
        waves: api.stat("waves", "waves", "warn"),
        last: api.stat("last", "last answer done", "bad"),
        rate: api.stat("rate", "tokens a second", ""),
        slots: api.stat("slots", "largest batch", ""),
        cards: api.stat("cards", "cards", ""),
        cost: api.stat("cost", "card bill", ""),
        dash: api.stat("dash", "the dashboard's sum", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of crews whose questions start and finish together. asked is when the question reached the engine, starts is when it got a slot, first word is when its first token reached the tablet, done is when its last did, all in seconds after 22:00:00. A bold row waited more than 5 s for its first word. When the engine's largest batch is full, the rest wait; a new wave starts as slots free.");

      draw(api);
      setStats(api);
      api.log("21:59 on wednesday 7 october: tensorrt-llm since 14:00, built with a largest batch of 16. this afternoon's test, 12 at once: 72 a second each, 6.9 s an answer.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the afternoon test, 12 at once on the 16-slot build.
      t.expect(t.stat("first") === "0.2 s" && t.stat("wait") === "0.2 s" && t.stat("waves") === "1 wave" &&
        t.stat("last") === "6.9 s" && t.stat("rate") === "72 a second each" && t.stat("slots") === "16 a card" &&
        t.stat("dash") === "72 ÷ 55 = 1.31×" && has("21:59 on wednesday 7 october"),
        "Opens on the afternoon test: 12 at once, 0.2 s first word, 6.9 s, one wave, 1.31x");

      // 2. 22:00 as it happened.
      t.click("night");
      t.expect(has("22:00:00.0  64 questions arrive. 16 answers start, 48 questions wait.") &&
        has("22:00:06.9  16 answers finish. 16 more answers start, 32 questions wait.") &&
        has("22:00:13.9  16 answers finish. 16 more answers start, 16 questions wait.") &&
        has("22:00:20.8  16 answers finish. the last 16 answers start.") &&
        has("22:00:21.0  the last 16 crews get their first word.") && has("22:00:27.8  the last 16 answers finish.") &&
        t.stat("waves") === "4 waves" && t.stat("wait") === "21.0 s" && t.stat("last") === "27.8 s",
        "22:00: waves at 0, 6.9, 13.9 and 20.8 s; the last 16 first words at 21.0 s; last answer 27.8 s");

      // 3. Last week's peak on vLLM.
      t.set("engine", "vllm");
      t.expect(t.stat("waves") === "1 wave" && t.stat("first") === "0.3 s" && t.stat("last") === "11.1 s" &&
        t.stat("rate") === "45 a second each" && t.stat("slots") === "from free memory",
        "vLLM at 64: one wave, 0.3 s first word, 45 a second each, 11.1 s");

      // 4. vLLM at the afternoon's 12.
      t.set("load", "12");
      t.expect(t.stat("last") === "9.1 s" && t.stat("rate") === "55 a second each",
        "vLLM at 12: 55 a second each, 9.1 s");

      // 5. Two copies of the 16-slot build at 64.
      t.set("engine", "trt16");
      t.set("load", "64");
      t.set("copies", "2");
      t.expect(t.stat("waves") === "2 waves a card" && t.stat("wait") === "7.1 s" && t.stat("last") === "13.9 s" &&
        t.stat("cost") === "$8.58 an hour, $6,263 a month",
        "Two copies: 32 slots, 2 waves, 7.1 s, 13.9 s, $6,263 a month");

      // 6. Built for 64, one card.
      t.set("copies", "1");
      t.set("engine", "trt64");
      t.expect(t.stat("waves") === "1 wave" && t.stat("first") === "0.3 s" && t.stat("rate") === "54 a second each" &&
        t.stat("last") === "9.3 s" && t.stat("cost") === "$4.29 an hour, $3,132 a month",
        "Built for 64: one wave, 54 a second each, 9.3 s, one card");

      // 7. Staggered arrivals on the 16-slot build.
      t.set("engine", "trt16");
      t.set("arrivals", "staggered");
      t.expect(t.stat("wait") === "0.2 s" && t.stat("waves") === "4 waves" && t.stat("last") === "186.9 s",
        "16 a minute: 0.2 s first words, the last answer 186.9 s after 22:00:00");

      // 8. Reply 0 as played.
      t.set("plan", "r0");
      t.expect(has("two copies of the 16-slot build: 32 slots for 64 crews, 2 waves a card. the second wave's first word 7.1 s, last answer 13.9 s. $8.58 an hour, $6,263 a month, twice one card's $4.29 an hour, $3,132 a month."),
        "Reply 0: 2 waves, 13.9 s, twice the bill");

      // 9. Reply 1 as played.
      t.set("plan", "r1");
      t.expect(has("replay of 64 at 22:00:00: vllm 11.1 s; built for 16, 4 waves, last 27.8 s; built for 64, 1 wave, first word 0.3 s, 54 a second each, last 9.3 s. memory: 15 GB + 64 × 250 MB = 30.6 GB of 80.") &&
        t.stat("last") === "9.3 s",
        "Reply 1: the replay ranks the three; built for 64, 9.3 s, memory 30.6 GB");

      // 10. Reply 2 as played.
      t.set("plan", "r2");
      t.expect(has("back to vllm: 64 at once, first word 0.3 s, 45 a second each, last 11.1 s. 12 at once: 55 a second each, 9.1 s against 72 and 6.9 s."),
        "Reply 2: vLLM 11.1 s at the peak, 9.1 s against 6.9 s at 12");

      // 11. Reply 3 as played.
      t.set("plan", "r3");
      t.expect(has("16 a minute on the 16-slot build: every first word 0.2 s, every answer 6.9 s; the last group asks at 22:03:00, last answer 186.9 s after 22:00:00."),
        "Reply 3: 0.2 s first words, the last group done at 22:03:06.9");

      // 12. The cold case: 80 crews on the build for 64.
      t.set("arrivals", "together");
      t.set("engine", "trt64");
      t.set("load", "80");
      t.expect(t.stat("waves") === "2 waves" && t.stat("wait") === "9.5 s" && t.stat("last") === "16.2 s" &&
        t.stat("rate") === "54 and 72 a second each",
        "Cold case: 80 on the build for 64, 2 waves, 9.5 s, 16.2 s");
    }
  });
})();
