/* sims/a10e10-v1.0.0.js  (published as sims/a10e10.js)
   case a10e10 "the cost of a token": a fleet cost meter for the velsham tyres assistant on the night of
   sunday 11 to monday 12 october 2026, when the weekly cost report arrives at 00:00. no real model runs
   here and no text is written: every figure is worked out from the given numbers below (also stated in
   sim.lede). widget-style sim: it draws its own table in api.root.

   changelog
   v1.0.0 (2026-10-16) first version. controls: answers at once by day (64 or 48) and at night (24 since
     5 october, 64 before), cards rented (2 or 3), cards on at night (all, or one with the others off from
     22:00), start time of a switched-off card (05:50 or 06:00), night hosting (own cards, or a per-token
     service), card hourly price ($2.79, or $2.51 at about 10% off), per-token price ($0.14 or $0.28 per
     million), play the 00:00 report, play a reply, reset. stats: day and night step, tokens a second a
     card, millions an hour and cost per million; each answer's speed at night; tokens a second in all at
     night; the meter; card time in the night; the per-token charge; when a switched-off card takes answers
     again; the monthly bill and the saving. selftest: 12 assertions.

   the given data (the season bible's shared data and the case's own, stated in sim.lede):
   - llama 3.1 8b: 16.06 billion bytes in 16 bits, about 15 gb on the card's meter (14.96 in 1,024-units).
   - the writing curve on one a100 80gb (velsham's own timing, never a source's): a step takes 10 ms plus
     0.25 ms for each answer in it; tokens a second a card = answers in the step / step time.
   - answers at once (velsham's own count): 64 by day, 32 a card; at night 64 until 00:00 monday 5 october
     (three night lines), 24 since (one line). a running note is rewritten as soon as it is done, so the
     number written at once follows the presses and crews on shift, and tokens an hour follow the speed.
   - cards: two a100 80gb, rented at $2.79 a card hour (close to one provider's list on 16 october 2026),
     billed by the minute while on (story data). a month is 730 hours, 730 / 24 = 30.4 nights.
   - night is 22:00 to 06:00 (8 hours). a switched-off card takes about 3 minutes from switch-on to its
     first answer (velsham's own measurement): the card starts and the model's 15 gb is copied onto it.
   - the meter (gpu utilisation): in each sample it asks whether any work ran, yes or no; steps run back
     to back on any card that has answers, so it reads 100% whatever the step holds.
   - per-token service: $0.14 per million tokens in and out (close to one provider's list on 16 october
     2026), priced here on the night's answers alone, at the report's night pace; prompts are extra.

   where every number comes from (conventions rule 14; the case is content/latent/a10/a10e10-v1.0.0.json):
   - day: 10 + 32 x 0.25 = 18 ms; 32 / 0.018 = 1,777.8, 1,778 a second a card; 64 / 0.018 x 3,600 =
     12,800,000 an hour, 12.8 million; $5.58 / 12.8 = $0.436, $0.44 per million. each answer 1,000 / 18
     = 55.6 tokens a second.
   - night, two cards, 12 each: 10 + 12 x 0.25 = 13 ms; 12 / 0.013 = 923.1, 923 a card; 24 / 0.013 =
     1,846 a second in all; x 3,600 = 6,646,154 an hour, 6.65 million; $5.58 / 6.646 = $0.84 per million.
     each answer 1,000 / 13 = 76.9 a second. a night: 8 x 6.646 = 53.17 million tokens. card time 8 x
     $5.58 = $44.64. the bill 2 x 2.79 x 730 = $4,073.40, $4,073 a month.
   - last week's nights (64 at once): the day's 18 ms, 1,778 a card, $0.44.
   - reply 0, one card at night, the second off at 22:00 and on at 05:50: 10 + 24 x 0.25 = 16 ms; 24 /
     0.016 = 1,500 a second; 62.5 each; 5.4 million an hour; $2.79 / 5.4 = $0.517, $0.52 per million.
     off 7 h 50 min = 7.833 h; card time in the night 8 x 2.79 + (8 - 7.833) x 2.79 = 22.32 + 0.465 =
     $22.79; saved 7.833 x 2.79 = $21.855, $21.86 a night; a month 21.855 x 30.4 = $664.76, $665; the bill
     $3,408.64, $3,409. ready 05:50 + 3 min = 05:53, 7 minutes before 06:00. started at 06:00: ready 06:03,
     3 minutes late; saved 8 x 2.79 x 30.4 = $678.90, $679.
     (the brief's 8 x $2.79 x 30 = $670 assumed the card off for all 8 hours and 30 nights; a 05:50 start
     bills 10 minutes, and the month is 730 hours, so the case uses $21.86 a night and $665 a month.)
   - reply 1, a third card always on: night 8 a card, 10 + 8 x 0.25 = 12 ms, 666.7, 667 a card, 2,000 in
     all, 7.2 million an hour, $8.37 / 7.2 = $1.16 per million; each answer 83.3 a second; the bill 3 x
     2.79 x 730 = $6,110.10, $6,110, $2,036.70, $2,037 more. by day 64 / 3 = 21.3 a card, 15.3 ms.
   - reply 2, the night on a per-token service, both cards off 22:00 to 05:50: 53.17 million x $0.14 =
     $7.44 a night (answers only), against $22.32 for one card's night; card time 2 x (10 / 60) x 2.79 =
     $0.93; the bill 2.79 x (1,460 - 2 x 7.833 x 30.4) + 7.444 x 30.4 = $2,743.88 + $226.41 = $2,970.29,
     $2,970; saved $1,103.
   - reply 3, $2.51 a card hour (about 10% off): night $5.02 / 6.646 = $0.755, $0.76; day $5.02 / 12.8 =
     $0.39; the bill 2 x 2.51 x 730 = $3,664.60, $3,665; saved $408.80, $409.
   - the cold case, 64 at night on one card (two lines back from monday 7 december): 10 + 64 x 0.25 = 26
     ms, 2,461.5, 2,462 a second, each answer 38.5 a second, 8.86 million an hour, $2.79 / 8.862 = $0.31.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BASE_MS = 10;            // a step's fixed part: the card reads the model once
  var PER_ANSWER_MS = 0.25;    // each answer in the step adds this
  var HOURS = 730;             // a month
  var NIGHTS = HOURS / 24;     // nights in a month, 30.4
  var NIGHT_H = 8;             // 22:00 to 06:00
  var START_UP_MIN = 3;        // switch-on to first answer
  var BASE_BILL = 2 * 2.79 * HOURS;   // the bill as it stands: two cards always on

  var DAY_ANS = [
    { value: "64", label: "64 (three day lines)" },
    { value: "48", label: "48" }
  ];
  var NIGHT_ANS = [
    { value: "24", label: "24 (one night line, since 5 october)" },
    { value: "64", label: "64 (three night lines, to 4 october)" }
  ];
  var RENTED = [
    { value: "2", label: "2 cards" },
    { value: "3", label: "3 cards" }
  ];
  var NIGHT_CARDS = [
    { value: "all", label: "every rented card" },
    { value: "one", label: "one card; the others off from 22:00" }
  ];
  var STARTS = [
    { value: "0550", label: "05:50" },
    { value: "0600", label: "06:00" }
  ];
  var HOSTING = [
    { value: "own", label: "our own cards" },
    { value: "token", label: "a per-token service, cards off from 22:00" }
  ];
  var PRICES = [
    { value: "2.79", label: "$2.79 a card hour" },
    { value: "2.51", label: "$2.51 a card hour (about 10% off, for a year)" }
  ];
  var TOKEN_PRICES = [
    { value: "0.14", label: "$0.14 per million tokens" },
    { value: "0.28", label: "$0.28 per million tokens" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: count tokens per card; second card off 22:00 to 05:50" },
    { value: "r1", label: "reply 1: rent a third card" },
    { value: "r2", label: "reply 2: a per-token service at night" },
    { value: "r3", label: "reply 3: a lower hourly price" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function r1(x) { return Math.round(x * 10 + 1e-9) / 10; }
  function cents(x) { return "$" + (Math.round(x * 100 + 1e-6) / 100).toFixed(2); }
  function dollars(x) { return "$" + fmt(Math.round(x + 1e-6)); }
  function speed(x) { return x >= 100 ? fmt(Math.round(x)) : r1(x).toFixed(1); }
  function millions(x) { return String(parseFloat((x / 1e6).toPrecision(3))); }
  function step(n) { return BASE_MS + PER_ANSWER_MS * n; }
  function clock(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function defaults() {
    return { dayAns: "64", nightAns: "24", rented: "2", nightCards: "all", start: "0550",
      hosting: "own", price: "2.79", tokPrice: "0.14", plan: "none" };
  }

  /* ---------- the cost meter (pure: settings in, figures out) ---------- */

  function plan(C) {
    var R = {};
    var rented = Number(C.rented), price = Number(C.price), tokPrice = Number(C.tokPrice);
    var dayAns = Number(C.dayAns), nightAns = Number(C.nightAns);
    var token = C.hosting === "token";
    // by day every rented card is on
    R.dayPer = dayAns / rented;
    R.dayStep = step(R.dayPer);
    R.dayCard = R.dayPer / R.dayStep * 1000;
    R.dayHour = dayAns / R.dayStep * 1000 * 3600;
    R.dayCpm = rented * price / (R.dayHour / 1e6);
    // the report's night pace: every rented card on (what a per-token service is priced on)
    var paceStep = step(nightAns / rented);
    R.paceNight = nightAns / paceStep * 1000 * 3600 * NIGHT_H;
    // at night
    R.nightOn = token ? 0 : (C.nightCards === "one" ? 1 : rented);
    R.off = rented - R.nightOn;
    var startMin = C.start === "0550" ? 5 * 60 + 50 : 6 * 60;
    R.offHours = R.off > 0 ? (startMin + 24 * 60 - 22 * 60) / 60 : 0;
    if (!token) {
      R.nightPer = nightAns / R.nightOn;
      R.nightStep = step(R.nightPer);
      R.nightCard = R.nightPer / R.nightStep * 1000;
      R.nightAll = nightAns / R.nightStep * 1000;
      R.nightEach = 1000 / R.nightStep;
      R.nightHour = R.nightAll * 3600;
      R.nightCpm = R.nightOn * price / (R.nightHour / 1e6);
    }
    R.cardNight = R.nightOn * NIGHT_H * price + R.off * (NIGHT_H - R.offHours) * price;
    R.tokNight = token ? tokPrice * R.paceNight / 1e6 : 0;
    R.month = price * (rented * HOURS - R.off * R.offHours * NIGHTS) + R.tokNight * NIGHTS;
    R.save = BASE_BILL - R.month;
    R.ready = R.off > 0 ? startMin + START_UP_MIN : null;
    R.late = R.ready !== null && R.ready > 6 * 60;
    R.text = {
      dstep: r1(R.dayStep) + " ms a step, " + r1(R.dayPer) + " answers a card",
      dcard: speed(R.dayCard) + " tokens a second a card",
      dhour: millions(R.dayHour) + " million tokens an hour",
      dcpm: cents(R.dayCpm) + " per million",
      nstep: token ? "none: the provider writes" : r1(R.nightStep) + " ms a step, " + r1(R.nightPer) + " answers a card",
      ncard: token ? "none: cards off" : speed(R.nightCard) + " tokens a second a card",
      nall: token ? "the provider's pace" : speed(R.nightAll) + " tokens a second in all",
      neach: token ? "not measured" : speed(R.nightEach) + " tokens a second",
      nhour: token ? String(parseFloat((R.paceNight / 1e6).toFixed(2))) + " million tokens a night" :
        millions(R.nightHour) + " million tokens an hour",
      ncpm: token ? cents(tokPrice) + " per million, answers only" : cents(R.nightCpm) + " per million",
      meter: token ? "cards off; the provider writes" :
        (R.off > 0 ? "100% on " + R.nightOn + (R.nightOn === 1 ? " card, " : " cards, ") + R.off + " off" :
          "100% on " + R.nightOn + " cards"),
      night: cents(R.cardNight) + " a night of card time",
      tok: token ? cents(R.tokNight) + " a night, answers only" : "$0.00 a night",
      ready: R.ready === null ? "always on" :
        (R.late ? clock(R.ready) + ", " + (R.ready - 360) + " minutes after 06:00" :
          clock(R.ready) + ", " + (360 - R.ready) + " minutes before 06:00"),
      month: dollars(R.month) + " a month",
      save: R.save >= 0 ? dollars(R.save) + " a month" : "none: " + dollars(-R.save) + " a month more"
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
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  // one row per rented card: day and night
  function cardRows(C, R) {
    var rows = [];
    var token = C.hosting === "token";
    for (var i = 0; i < Number(C.rented); i++) {
      var day = r1(R.dayPer) + " answers, " + r1(R.dayStep) + " ms a step, meter 100%";
      var night;
      if (token) night = "off 22:00 to " + clock(R.ready - START_UP_MIN) + "; the provider writes";
      else if (i < R.nightOn) night = r1(R.nightPer) + " answers, " + r1(R.nightStep) + " ms a step, meter 100%";
      else night = "off from 22:00; on at " + clock(R.ready - START_UP_MIN) + ", answers from " + clock(R.ready);
      rows.push(["card " + (i + 1), day, night]);
    }
    return rows;
  }

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    var R = plan(C);
    ui.head.textContent = C.rented + " cards at $" + C.price + " a card hour; by day " + C.dayAns +
      " answers at once, at night " + C.nightAns + ". night cost per million: " + R.text.ncpm + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["card", "by day, 06:00 to 22:00", "at night, 22:00 to 06:00"], true);
    cardRows(C, R).forEach(function (r) { row(ui, r, false); });
    ui.note.textContent = "a step: the card reads the model once (10 ms), and every answer in it gets one more " +
      "token (0.25 ms each). the meter asks only whether any work ran in each sample, yes or no.";
  }

  function setStats(api) {
    var R = plan(api.state.C);
    var st = api.state.stat;
    ["dstep", "dcard", "dhour", "dcpm", "nstep", "ncard", "nall", "neach", "nhour", "ncpm", "meter",
      "night", "tok", "ready", "month", "save"].forEach(function (k) { st[k](R.text[k]); });
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = plan(api.state.C);
    if (what) api.log(what + " night: " + R.text.nstep + "; " + R.text.ncpm + "; bill " + R.text.month + ".",
      R.save < 0 ? "bad" : (R.save > 0 ? "ok" : ""));
  }

  function playReport(api) {
    var now = plan(defaults());
    var last = plan({ dayAns: "64", nightAns: "64", rented: "2", nightCards: "all", start: "0550",
      hosting: "own", price: "2.79", tokPrice: "0.14" });
    api.log("00:00 mon 12 oct  weekly cost report, monday 5 to sunday 11 october, emailed by mstislav's script.", "warn");
    api.log("  gpu utilisation: 100% on both cards, day and night.", "warn");
    api.log("  night tokens a second per card: " + speed(now.nightCard) + ", down from " + speed(last.nightCard) + ".", "bad");
    api.log("  night cost per million tokens: " + cents(now.nightCpm) + ", up from " + cents(last.nightCpm) + ".", "bad");
    api.log("by hand: 10 + 12 x 0.25 = " + r1(now.nightStep) + " ms a step, " + millions(now.nightHour) +
      " million an hour, $5.58 / " + millions(now.nightHour) + " = " + cents(now.nightCpm) + " per million.", "");
  }

  function planConfig(p) {
    var C = defaults();
    C.plan = p;
    if (p === "r0") C.nightCards = "one";
    if (p === "r1") C.rented = "3";
    if (p === "r2") C.hosting = "token";
    if (p === "r3") C.price = "2.51";
    return C;
  }

  function planFollowUp(api, p) {
    var R = plan(api.state.C);
    if (p === "r0") api.log("22:00 card 2 off; card 1 takes all 24: " + R.text.nstep + ", " + R.text.nall + ", " +
      R.text.ncpm + ". card 2 on at 05:50, answers from " + R.text.ready + ". saved " + R.text.save + ".", "ok");
    if (p === "r1") api.log("a third card: " + R.text.nstep + ", " + R.text.ncard + ", " + R.text.ncpm +
      "; meter " + R.text.meter + ". bill " + R.text.month + ", " + R.text.save + ".", "bad");
    if (p === "r2") api.log("the provider writes the night, " + R.text.nhour + ": " + R.text.tok +
      ", against $22.32 for one card's night. the press data leaves the factory under the provider's terms.", "warn");
    if (p === "r3") api.log("$2.51 a card hour: " + R.text.nstep + ", " + R.text.ncpm + " at night, " + R.text.dcpm +
      " by day; meter " + R.text.meter + ". saved " + R.text.save + ", for a year's commitment.", "bad");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["dayAns", "nightAns", "rented", "nightCards", "start", "hosting", "price", "tokPrice"];
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
          syncControls();
          refresh(api, what);
        });
      }
      chooser("dayAns", "answers at once by day", DAY_ANS);
      chooser("nightAns", "answers at once at night", NIGHT_ANS);
      chooser("rented", "cards rented", RENTED);
      chooser("nightCards", "cards on at night", NIGHT_CARDS);
      chooser("start", "a switched-off card starts at", STARTS);
      chooser("hosting", "night hosting", HOSTING);
      chooser("price", "card hourly price", PRICES);
      chooser("tokPrice", "per-token price", TOKEN_PRICES);
      S.ctl.report = api.control.button("report", "play the 00:00 report", function () {
        S.C = defaults();
        syncControls();
        S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        draw(api);
        setStats(api);
        playReport(api);
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
        dstep: api.stat("dstep", "by day: a step", ""),
        dcard: api.stat("dcard", "by day: each card writes", ""),
        dhour: api.stat("dhour", "by day: all cards", ""),
        dcpm: api.stat("dcpm", "by day: cost per million tokens", "ok"),
        nstep: api.stat("nstep", "at night: a step", ""),
        ncard: api.stat("ncard", "at night: each card writes", "warn"),
        nall: api.stat("nall", "at night: all cards", ""),
        neach: api.stat("neach", "at night: each answer", ""),
        nhour: api.stat("nhour", "at night: tokens written", ""),
        ncpm: api.stat("ncpm", "at night: cost per million tokens", "bad"),
        meter: api.stat("meter", "the meter at night", "warn"),
        night: api.stat("night", "card time, 22:00 to 06:00", ""),
        tok: api.stat("tok", "per-token charge, 22:00 to 06:00", ""),
        ready: api.stat("ready", "a switched-off card takes answers", ""),
        month: api.stat("month", "the bill", ""),
        save: api.stat("save", "saved against $4,073 a month", "ok")
      };

      api.info("<strong>How to read it.</strong> Each row is one rented card, by day and at night. A step is one pass of writing: the card reads the model once, 10 ms, and every answer in the step gets one more token, 0.25 ms each. Tokens a second a card are answers in the step divided by the step time; cost per million is what the cards cost an hour divided by the millions of tokens they write in it. The meter only asks, in each sample, whether any work ran.");

      draw(api);
      setStats(api);
      api.log("23:59:50 on sunday 11 october, the night office: one night line, 24 answers at once on two cards. the report is due at 00:00.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before the 00:00 report: one night line on two cards.
      t.expect(t.stat("nstep") === "13 ms a step, 12 answers a card" && t.stat("ncard") === "923 tokens a second a card" &&
        t.stat("nhour") === "6.65 million tokens an hour" && t.stat("ncpm") === "$0.84 per million" &&
        t.stat("meter") === "100% on 2 cards" && t.stat("month") === "$4,073 a month" &&
        has("23:59:50 on sunday 11 october"),
        "Opens before 00:00: 13 ms, 923 a card, 6.65 million an hour, $0.84 per million, meter 100%, $4,073 a month");

      // 2. The day, the same in every reply that keeps two cards at $2.79.
      t.expect(t.stat("dstep") === "18 ms a step, 32 answers a card" && t.stat("dcard") === "1,778 tokens a second a card" &&
        t.stat("dhour") === "12.8 million tokens an hour" && t.stat("dcpm") === "$0.44 per million",
        "Day: 18 ms, 1,778 a card, 12.8 million an hour, $0.44 per million");

      // 3. The report at 00:00.
      t.click("report");
      t.expect(has("night tokens a second per card: 923, down from 1,778.") &&
        has("night cost per million tokens: $0.84, up from $0.44.") &&
        has("gpu utilisation: 100% on both cards, day and night."),
        "The report: 923 down from 1,778; $0.84 up from $0.44; 100% on both cards");

      // 4. Last week's nights: three lines, 64 at once, the same meter.
      t.set("nightAns", "64");
      t.expect(t.stat("nstep") === "18 ms a step, 32 answers a card" && t.stat("ncpm") === "$0.44 per million" &&
        t.stat("meter") === "100% on 2 cards",
        "Three night lines: 18 ms and $0.44, and the meter still 100%");

      // 5. Reply 0: one card at night, the second off 22:00 to 05:50.
      t.set("plan", "r0");
      t.expect(t.stat("nstep") === "16 ms a step, 24 answers a card" && t.stat("nall") === "1,500 tokens a second in all" &&
        t.stat("neach") === "62.5 tokens a second" && t.stat("nhour") === "5.4 million tokens an hour" &&
        t.stat("ncpm") === "$0.52 per million" && t.stat("meter") === "100% on 1 card, 1 off",
        "Reply 0: 16 ms, 1,500 a second, 62.5 each, $0.52 per million, meter 100% on the one card");

      // 6. Reply 0's money and start-up.
      t.expect(t.stat("night") === "$22.79 a night of card time" && t.stat("ready") === "05:53, 7 minutes before 06:00" &&
        t.stat("save") === "$665 a month" && t.stat("month") === "$3,409 a month",
        "Reply 0: $22.79 of card time a night, ready 05:53, $665 a month saved, $3,409 a month");

      // 7. Starting at 06:00 instead: 3 minutes late.
      t.set("start", "0600");
      t.expect(t.stat("ready") === "06:03, 3 minutes after 06:00" && t.stat("save") === "$679 a month",
        "Start at 06:00: answers from 06:03, 3 minutes after the day lines start");

      // 8. Reply 1: a third card.
      t.set("plan", "r1");
      t.expect(t.stat("nstep") === "12 ms a step, 8 answers a card" && t.stat("ncard") === "667 tokens a second a card" &&
        t.stat("ncpm") === "$1.16 per million" && t.stat("meter") === "100% on 3 cards" &&
        t.stat("month") === "$6,110 a month" && t.stat("save") === "none: $2,037 a month more",
        "Reply 1: 12 ms, 667 a card, $1.16 per million, meter 100% on 3 cards, $2,037 a month more");

      // 9. Reply 2: a per-token service at night.
      t.set("plan", "r2");
      t.expect(t.stat("tok") === "$7.44 a night, answers only" && t.stat("nhour") === "53.17 million tokens a night" &&
        t.stat("night") === "$0.93 a night of card time" && t.stat("month") === "$2,970 a month" &&
        has("against $22.32 for one card's night"),
        "Reply 2: $7.44 a night for 53.17 million tokens, against $22.32 for one card");

      // 10. Reply 3: about 10% off the hourly price.
      t.set("plan", "r3");
      t.expect(t.stat("ncpm") === "$0.76 per million" && t.stat("dcpm") === "$0.39 per million" &&
        t.stat("nstep") === "13 ms a step, 12 answers a card" && t.stat("month") === "$3,665 a month" &&
        t.stat("save") === "$409 a month",
        "Reply 3: the same 13 ms steps, $0.76 per million at night, $409 a month saved");

      // 11. One card at night, then 64 answers at night (the cold case).
      t.set("price", "2.79");
      t.set("nightCards", "one");
      t.set("nightAns", "64");
      t.expect(t.stat("nstep") === "26 ms a step, 64 answers a card" && t.stat("neach") === "38.5 tokens a second" &&
        t.stat("ncard") === "2,462 tokens a second a card" && t.stat("ncpm") === "$0.31 per million",
        "Cold case: 64 on one card, 26 ms a step, 38.5 a second each, $0.31 per million");

      // 12. Both cards on for 64 again: each answer back at the day's pace.
      t.set("nightCards", "all");
      t.expect(t.stat("nstep") === "18 ms a step, 32 answers a card" && t.stat("neach") === "55.6 tokens a second" &&
        t.stat("ncpm") === "$0.44 per million",
        "Both cards for 64: 18 ms, 55.6 a second each, $0.44 per million");
    }
  });
})();
