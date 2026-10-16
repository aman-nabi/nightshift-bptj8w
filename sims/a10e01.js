/* sims/a10e01-v1.0.0.js  (published as sims/a10e01.js)
   Case a10e01 "The Furnace": a road-and-adders calculator for the foundry's assistant (Llama 3.1 8B)
   on a rented card. No real model runs here and no answer text exists in this file: every figure is
   worked out from the given numbers below (also stated in sim.lede). Widget-style sim: it draws its
   own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: card (the A100 80GB, the L40S, a card with more sums on
     the same road), bits per weight (16 or 8), question length (1,000 to 4,000 tokens), answer length
     (100 to 1,200 tokens), play the night, play a reply, reset. Stats: card, ms a token on the road,
     the road's limit, tokens a second, reading the question, writing the checklist, the whole answer,
     sums per byte, which limit each job hits, cost per million tokens, a month of card hours, memory
     speed per dollar. selfTest: 11 assertions.

   The given data (the season bible's shared data, stated in sim.lede):
   - Llama 3.1 8B: 8.03 billion weights. 16 bits = 2 bytes a weight: 16.06 billion bytes (about 15 GB
     on the card's meter, 16.06e9 / 1024^3 = 14.96). 8 bits = 1 byte: 8.03 billion bytes.
   - A100 80GB: 2,039 GB/s, 312 TFLOPS dense, $2.79 an hour (Lambda's list, read 16 October 2026).
   - L40S: 864 GB/s, 362 TFLOPS dense, $1.54 an hour (the story's figure, close to an aggregator's
     median of $1.50 read 16 October 2026).
   - a card with more sums on the same road: 864 GB/s, 733 TFLOPS (the L40S sheet's figure with
     sparsity), priced like the L40S. a what-if, not a real product.
   - the foundry's own measurements, never a source's: writing reaches about 80% of the road's limit,
     and reading the question runs at about half the sheet's sums a second.
   - a question is 2,000 tokens with its pages; a checklist 600; reading needs 2 sums per weight per
     token read; a month is 730 hours.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e01-v1.0.0.json):
   - road time = bytes / memory speed: A100 16.06 / 2,039 = 7.88 ms (7.9), limit 1000 / 7.88 = 127;
     L40S 16.06 / 864 = 18.59 ms (18.6), limit 54. 8 bits on the L40S: 9.29 ms (9.3), limit 108.
   - tokens a second = the limit x 0.8, rounded to two figures: A100 101.6 -> about 100 (the foundry's
     curve: 10.25 ms a step for one answer, 97.6 a second, also about 100); L40S 43.04 -> 43 (tonight's
     dashboard); 8 bits on the L40S 86.08 -> 86 (the bible's 864 / 8.03 x 0.8); the more-sums card 43.
   - reading = 2 x 8.03e9 x 2,000 = 32.12 trillion sums at half the sheet rate: A100 32.12 / 156 =
     0.206 s (0.21); L40S 32.12 / 181 = 0.177 s (0.18); more-sums card 32.12 / 366.5 = 0.088 s (0.09);
     1,000 tokens on the L40S 0.089 s (0.09).
   - writing 600 tokens: 600 / 100 = 6 s; 600 / 43 = 13.95 s (14); 600 / 86 = 6.98 s (7).
     whole answer = reading + writing: 6.2 s and 14.1 s (the dashboard log), 7.2 s at 8 bits.
   - sums per byte: writing 2 sums per weight / 2 bytes = 1 (16 bits) or 2 (8 bits); reading 2,000 tokens
     2,000 (16 bits). card ratio = TFLOPS / (GB/s / 1000): A100 312 / 2.039 = 153; L40S 362 / 0.864 =
     419; more-sums card 733 / 0.864 = 848.
   - cost per million = price / (tokens a second x 3,600) x 1,000,000: A100 $2.79 / 360,000 = $7.75;
     L40S $1.54 / 154,800 = $9.95; 8 bits on the L40S $1.54 / 309,600 = $4.97.
   - a month = price x 730: $2,036.70 ($2,037); $1,124.20 ($1,124).
   - memory speed per dollar = GB/s / price: 2,039 / 2.79 = 731; 864 / 1.54 = 561.
   - the night: launch on Monday 6 July 2026 on the A100; the rental moved at 00:00 on Thursday
     1 October 2026; 00:40 two answers of about 30 tokens: 0.18 + 30 / 43 = 0.88 s (A100: 0.21 + 0.30 =
     0.51 s); 01:20 ladle 3's checklist, 600 tokens, 14.1 s (6.2 s on Thursday 24 September).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var WEIGHTS = 8.03e9;
  var MONTH_HOURS = 730;
  var SHARE_OF_ROAD = 0.8;     // the foundry's own measurement
  var READ_SHARE = 0.5;        // the foundry's own measurement: half the sheet's sums a second
  var CARDS = {
    a100: { name: "A100 80GB", bw: 2039, tf: 312, price: 2.79 },
    l40s: { name: "L40S", bw: 864, tf: 362, price: 1.54 },
    more: { name: "more sums, same road", bw: 864, tf: 733, price: 1.54 }
  };
  var CARD_LIST = [
    { value: "a100", label: "A100 80GB: 2,039 GB/s, 312 TFLOPS, $2.79 an hour" },
    { value: "l40s", label: "L40S: 864 GB/s, 362 TFLOPS, $1.54 an hour" },
    { value: "more", label: "more sums, same road: 864 GB/s, 733 TFLOPS, $1.54 an hour" }
  ];
  var BITS = [
    { value: "16", label: "16 bits, 2 bytes a weight" },
    { value: "8", label: "8 bits, 1 byte a weight" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a card with even more sums" },
    { value: "r1", label: "reply 1: shorter questions" },
    { value: "r2", label: "reply 2: memory speed per dollar, timed" },
    { value: "r3", label: "reply 3: keep the L40S, weights in 8 bits" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function twoFigures(x) {
    var e = Math.floor(Math.log(x) / Math.LN10) - 1;
    var f = Math.pow(10, e);
    return Math.round(x / f) * f;
  }
  function cents(n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); }
  function defaults() { return { card: "a100", bits: "16", q: 2000, a: 600, plan: "none", night: false }; }

  /* ---------- the calculator (pure: settings in, figures out) ---------- */

  function calc(C) {
    var k = CARDS[C.card];
    var bits = Number(C.bits);
    var R = {};
    R.bytes = WEIGHTS * bits / 8;
    R.roadMs = R.bytes / (k.bw * 1e9) * 1000;
    R.limit = Math.round(1000 / R.roadMs);
    R.speed = twoFigures(1000 / R.roadMs * SHARE_OF_ROAD);
    R.read = 2 * WEIGHTS * C.q / (k.tf * READ_SHARE * 1e12);
    R.write = C.a / R.speed;
    R.whole = R.read + R.write;
    R.writeSpb = 16 / bits;
    R.readSpb = C.q * 16 / bits;
    R.ratio = Math.round(k.tf / (k.bw / 1000));
    R.perM = k.price / (R.speed * 3600) * 1e6;
    R.month = Math.round(k.price * MONTH_HOURS);
    R.perDollar = Math.round(k.bw / k.price);
    R.text = {
      road: R.roadMs.toFixed(1) + " ms",
      limit: "at most " + R.limit + " a second",
      speed: "about " + R.speed + " a second",
      read: R.read.toFixed(2) + " s",
      write: Math.round(R.write) + " s",
      whole: R.whole.toFixed(1) + " s",
      spb: "writing " + R.writeSpb + ", reading " + fmt(R.readSpb) + "; card " + R.ratio,
      limiter: "writing: " + (R.writeSpb < R.ratio ? "road" : "adders") + "; reading: " + (R.readSpb < R.ratio ? "road" : "adders"),
      perM: cents(R.perM),
      month: "$" + fmt(R.month) + " a month",
      perDollar: R.perDollar + " GB/s per $1 an hour"
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
    ui.head.textContent = "one answer for one person: a " + fmt(C.q) + "-token question, then " + fmt(C.a) +
      " tokens written, weights in " + C.bits + " bits. chosen card: " + CARDS[C.card].name + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["card", "road, ms a token", "tokens a second", "reading", "writing", "per million"], true);
    CARD_LIST.forEach(function (o) {
      var D = {};
      for (var k in C) D[k] = C[k];
      D.card = o.value;
      var R = calc(D);
      row(ui, [CARDS[o.value].name, R.text.road, R.text.speed, R.text.read, R.text.write, R.text.perM], false, o.value === C.card);
    });
    var R0 = calc(C);
    ui.note.textContent = "each token fetches " + (R0.bytes / 1e9).toFixed(2) + " billion bytes and does " + R0.writeSpb +
      " sum per byte; this card's adders could do " + R0.ratio + " per byte, so writing waits on the road. " +
      "reading the question does " + fmt(R0.readSpb) + " per byte, so it waits on the adders.";
  }

  function setStats(api) {
    var C = api.state.C;
    var R = calc(C);
    var st = api.state.stat;
    st.card(CARDS[C.card].name + ", " + C.bits + " bits");
    st.road(R.text.road);
    st.limit(R.text.limit);
    st.speed(R.text.speed);
    st.read(R.text.read);
    st.write(R.text.write);
    st.whole(R.text.whole);
    st.spb(R.text.spb);
    st.limiter(R.text.limiter);
    st.perM(R.text.perM);
    st.month(R.text.month);
    st.perDollar(R.text.perDollar);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = calc(api.state.C);
    if (what) api.log(what + " " + R.text.speed + ", reading " + R.text.read + ", writing " + R.text.write + ", " +
      R.text.perM + " per million.", R.speed < 100 ? "warn" : "ok");
  }

  function playNight(api) {
    var a = calc({ card: "a100", bits: "16", q: 2000, a: 30 });
    var l = calc({ card: "l40s", bits: "16", q: 2000, a: 30 });
    api.log("00:00  rental moved: A100 80GB at $2.79 an hour to L40S at $1.54.", "");
    api.log("00:40  two answers of about 30 tokens: " + l.whole.toFixed(2) + " s each (on the A100 " +
      a.read.toFixed(2) + " s + " + a.write.toFixed(2) + " s = " + (a.read + a.write).toFixed(2) + " s). nothing looked wrong.", "");
    api.log("01:20  ladle 3 checklist, 600 tokens: first token 0.18 s, then 43 a second, 14.1 s in all " +
      "(24 sep on the A100: 0.21 s, 100 a second, 6.2 s).", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.card = "more"; }
    if (plan === "r1") { C.card = "l40s"; C.q = 1000; }
    if (plan === "r2") { C.card = "a100"; }
    if (plan === "r3") { C.card = "l40s"; C.bits = "8"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = calc(api.state.C);
    if (plan === "r0") api.log("more sums, same road: reading " + R.text.read + ", but writing stays " + R.text.speed +
      ". writing does " + R.writeSpb + " sum per byte against the card's " + R.ratio + ".", "bad");
    if (plan === "r1") api.log("questions of 1,000 tokens: reading " + R.text.read + " instead of 0.18 s; the checklist still " +
      R.text.write + ", from half the pages.", "bad");
    if (plan === "r2") api.log("back to the A100, timed on our own answers first: " + R.text.perDollar + " against 561 on the L40S; " +
      R.text.perM + " per million against $9.95; the checklist in " + R.text.write + ".", "ok");
    if (plan === "r3") api.log("8 bits on the L40S: " + R.text.road + " a token, " + R.text.speed + ", the checklist in " + R.text.write +
      ". its quality on our own checklists is not yet measured.", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.card.set(S.C.card);
        S.ctl.bits.set(S.C.bits);
        S.ctl.q.set(S.C.q);
        S.ctl.a.set(S.C.a);
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
      function slider(id, label, min, max, step, initial) {
        S.ctl[id] = api.control.range(id, label, min, max, step, initial, function (val) {
          if (S.sync) return;
          var n = Number(val);
          if (!(n >= min && n <= max)) return;
          S.C[id] = n;
          manual(label + ": " + fmt(n) + ".");
        });
      }
      chooser("card", "card", CARD_LIST, "a100");
      chooser("bits", "bits per weight", BITS, "16");
      slider("q", "question length, tokens", 1000, 4000, 500, 2000);
      slider("a", "answer length, tokens", 100, 1200, 100, 600);
      S.ctl.night = api.control.button("night", "play the night, 00:00 to 01:20", function () {
        S.C = defaults();
        S.C.card = "l40s";
        S.C.night = true;
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
        card: api.stat("card", "card", ""),
        road: api.stat("road", "road time a token", ""),
        limit: api.stat("limit", "the road's limit", ""),
        speed: api.stat("speed", "tokens a second (80% of the road)", "warn"),
        read: api.stat("read", "reading the question", ""),
        write: api.stat("write", "writing the answer", "warn"),
        whole: api.stat("whole", "the whole answer", ""),
        spb: api.stat("spb", "sums per byte: the jobs against the card", ""),
        limiter: api.stat("limiter", "what each job waits on", "bad"),
        perM: api.stat("perM", "cost per million tokens", "warn"),
        month: api.stat("month", "card hours, 730 a month", ""),
        perDollar: api.stat("perDollar", "memory speed per dollar", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one card at the settings you chose. Writing fetches every weight for each token, so the road time is bytes divided by memory speed; the foundry measured about 80% of that limit. Reading the question uses each fetched weight for every question token, so it waits on the sums instead. The bold row is the chosen card.");

      draw(api);
      setStats(api);
      api.log("23:50 on wednesday 30 september, on the A100 80GB since monday 6 july: about 100 tokens a second, the checklist in 6 s.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the A100, before the rental moves.
      t.expect(t.stat("card") === "A100 80GB, 16 bits" && t.stat("road") === "7.9 ms" && t.stat("limit") === "at most 127 a second" &&
        t.stat("speed") === "about 100 a second" && t.stat("read") === "0.21 s" && t.stat("write") === "6 s" &&
        t.stat("whole") === "6.2 s" && t.stat("perM") === "$7.75" && t.stat("month") === "$2,037 a month" &&
        t.stat("perDollar") === "731 GB/s per $1 an hour" && has("23:50 on wednesday 30 september"),
        "Opens at 23:50 on the A100: 7.9 ms, at most 127, about 100, reading 0.21 s, checklist 6 s, $7.75, $2,037");

      // 2. Sums per byte on the A100: writing 1, reading 2,000, card 153.
      t.expect(t.stat("spb") === "writing 1, reading 2,000; card 153" && t.stat("limiter") === "writing: road; reading: adders",
        "A100: writing does 1 sum per byte against 153, so it waits on the road; reading 2,000 waits on the adders");

      // 3. The night: the L40S at 00:00.
      t.click("night");
      t.expect(t.stat("card") === "L40S, 16 bits" && t.stat("road") === "18.6 ms" && t.stat("limit") === "at most 54 a second" &&
        t.stat("speed") === "about 43 a second" && t.stat("read") === "0.18 s" && t.stat("write") === "14 s" &&
        t.stat("whole") === "14.1 s" && t.stat("perM") === "$9.95" && t.stat("month") === "$1,124 a month" &&
        t.stat("perDollar") === "561 GB/s per $1 an hour",
        "The L40S: 18.6 ms, at most 54, about 43, reading 0.18 s, checklist 14 s, $9.95, $1,124");

      // 4. The night's log: short answers under a second, then the checklist.
      t.expect(has("00:40  two answers of about 30 tokens: 0.88 s each (on the A100 0.21 s + 0.30 s = 0.51 s)") &&
        has("01:20  ladle 3 checklist, 600 tokens: first token 0.18 s, then 43 a second, 14.1 s in all") &&
        t.stat("spb") === "writing 1, reading 2,000; card 419",
        "The night: 00:40 answers in 0.88 s, 01:20 the checklist in 14.1 s; the L40S's ratio is 419");

      // 5. More sums on the same road: reading halves, writing does not move.
      t.set("card", "more");
      t.expect(t.stat("read") === "0.09 s" && t.stat("speed") === "about 43 a second" && t.stat("write") === "14 s" &&
        t.stat("spb") === "writing 1, reading 2,000; card 848",
        "733 TFLOPS on the 864 GB/s road: reading 0.09 s, writing still about 43, checklist 14 s");

      // 6. A shorter question on the L40S: reading halves, the checklist stays.
      t.set("card", "l40s");
      t.set("q", 1000);
      t.expect(t.stat("read") === "0.09 s" && t.stat("write") === "14 s",
        "1,000-token questions on the L40S: reading 0.09 s, the checklist still 14 s");

      // 7. 8 bits on the L40S.
      t.set("q", 2000);
      t.set("bits", "8");
      t.expect(t.stat("road") === "9.3 ms" && t.stat("limit") === "at most 108 a second" && t.stat("speed") === "about 86 a second" &&
        t.stat("write") === "7 s" && t.stat("perM") === "$4.97" && t.stat("spb") === "writing 2, reading 4,000; card 419",
        "8 bits on the L40S: 9.3 ms, at most 108, about 86, checklist 7 s, $4.97");

      // 8. Reply 0: a card with even more sums.
      t.set("plan", "r0");
      t.expect(t.stat("card") === "more sums, same road, 16 bits" && t.stat("speed") === "about 43 a second" &&
        has("more sums, same road: reading 0.09 s, but writing stays about 43 a second"),
        "Reply 0: reading 0.09 s, writing still about 43");

      // 9. Reply 1: shorter questions.
      t.set("plan", "r1");
      t.expect(t.stat("read") === "0.09 s" && t.stat("write") === "14 s" && has("the checklist still 14 s, from half the pages"),
        "Reply 1: reading 0.09 s, the checklist still 14 s");

      // 10. Reply 2: back to the A100, compared by memory speed per dollar.
      t.set("plan", "r2");
      t.expect(t.stat("speed") === "about 100 a second" && t.stat("perM") === "$7.75" && t.stat("month") === "$2,037 a month" &&
        has("731 GB/s per $1 an hour against 561 on the L40S; $7.75 per million against $9.95; the checklist in 6 s"),
        "Reply 2: the A100, 731 against 561 GB/s per dollar, $7.75 against $9.95, the checklist in 6 s");

      // 11. Reply 3: 8 bits on the L40S, quality not yet measured.
      t.set("plan", "r3");
      t.expect(t.stat("speed") === "about 86 a second" && t.stat("perM") === "$4.97" && t.stat("month") === "$1,124 a month" &&
        has("its quality on our own checklists is not yet measured"),
        "Reply 3: about 86 a second, $4.97 per million, quality not yet measured");
    }
  });
})();
