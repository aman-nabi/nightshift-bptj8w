/* sims/a8e07-v1.0.0.js  (published as sims/a8e07.js)
   Case a8e07 "Open Weights": a cost calculator for the visitor assistant at Skirlaw Observatory.
   No real model runs here and no answer text exists in this file: every figure is worked out from the
   given numbers below (also stated in sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: hosting (provider's service per token, the same open
     model per token, our rented card), questions a day, hours the card runs (24 or 8), price per million
     tokens, card price per hour ($1.00 for our model, $2.00 for the bigger one), play the bill, play a
     reply, reset. Stats: hosting, cost for a 30-day month, cost per answer, against the service, card
     busy share, the card's break-even, wait after a restart, budget, the bill. selfTest: 11 assertions.

   The given data (stated in sim.lede):
   - 600 questions a day, all while the observatory is open, 16:00 to midnight (8 hours).
   - about 2,000 tokens per question (standing instructions, a few pages, the question and the answer).
   - months of 30 days, like September 2026.
   - the provider's service: $2 per million tokens. a company running the same open model: also $2.
   - our rented card: $1.00 an hour, can answer about 20 questions a minute.
   - the bigger model needs a bigger card: $2.00 an hour, can answer about 10 questions a minute.
   - after the card is switched on, the model takes about 3 minutes to be copied onto it.
   - the budget for the assistant: $100 a month. the card has run all day since 00:00 on 1 September.

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e07-v1.0.0.json):
   - service: 600 x 2,000 = 1,200,000 tokens a day; x $2 per million = $2.40 a day; x 30 = $72;
     per answer 2,000 x $2 / 1,000,000 = $0.004.
   - card: 24 h x 30 x $1.00 = 720 hours, $720; 600 x 30 = 18,000 answers; $720 / 18,000 = $0.04,
     10 times the service. busy: 600 / 1,440 minutes = about 0.4 a minute, of 20: 2%.
   - the bill: 720 hours at $1.00 = $720, charged at 01:05 on Thursday 1 October; the budget email at
     01:10 ($720 against the $100 budget).
   - break-even: $720 / $0.004 = 180,000 answers a month, 6,000 a day. at 6,000 a day the card costs
     $0.004 an answer, the same as the service; busy 6,000 / 1,440 = 4.2 a minute, 21%.
   - reply 0: the same open model per token at $2: $72, $0.004.
     reply 1: the bigger card all day: 24 x 30 x $2.00 = $1,440, $0.08, 20 times; busy 0.4 of 10, 4%;
     break-even 360,000 a month (12,000 a day).
     reply 2: the card as it is: $720, $0.04, 10 times; the licence page not read.
     reply 3: the card 8 hours a day: 8 x 30 x $1.00 = $240, $240 / 18,000 = $0.013, 3.3 times the
     service; break-even 60,000 a month (2,000 a day); busy 600 / 480 = 1.25 a minute (shown to one place as 1.3), 6%; the first
     question each day waits about 3 minutes.
   - dates: moved at 00:00 on Tuesday 1 September 2026; the night is Wednesday 30 September into
     Thursday 1 October; the trustees meet on Saturday 3 October.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var QPD = 600;
  var TOKENS = 2000;
  var DAYS = 30;
  var PRICE = 2;
  var BUDGET = 100;
  var RESTART_MIN = 3;
  var CARDS = {
    "1": { rate: 1, perMin: 20, label: "$1.00 an hour, our model (about 20 a minute)" },
    "2": { rate: 2, perMin: 10, label: "$2.00 an hour, the bigger model (about 10 a minute)" }
  };

  var HOSTING = [
    { value: "service", label: "provider's service, per token" },
    { value: "open", label: "the same open model, per token" },
    { value: "card", label: "our rented card" }
  ];
  var HOURS = [
    { value: "24", label: "on all day, 24 hours" },
    { value: "8", label: "8 hours, 16:00 to midnight" }
  ];
  var CARD_LIST = [
    { value: "1", label: CARDS["1"].label },
    { value: "2", label: CARDS["2"].label }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: pay per token, licence written down" },
    { value: "r1", label: "reply 1: the bigger model on a bigger card" },
    { value: "r2", label: "reply 2: keep the card, no conditions read" },
    { value: "r3", label: "reply 3: card off while closed" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(n) {
    if (Math.abs(n - Math.round(n)) < 1e-9) return "$" + fmt(Math.round(n));
    var p = n.toFixed(2).split(".");
    return "$" + fmt(p[0]) + "." + p[1];
  }
  function cents(n) { var p = n.toFixed(2).split("."); return "$" + fmt(p[0]) + "." + p[1]; }
  function perAnswer(n) {
    var s = n.toFixed(3);
    if (s.charAt(s.length - 1) === "0") s = s.slice(0, -1);
    return "$" + s;
  }
  function defaults() {
    return { hosting: "card", qpd: QPD, hours: "24", price: PRICE, card: "1", billed: false, plan: "none" };
  }

  /* ---------- the calculator (pure: settings in, figures out) ---------- */

  function cardMonth(C) { return Number(C.hours) * DAYS * CARDS[C.card].rate; }

  function calc(C) {
    var R = {};
    var answers = C.qpd * DAYS;
    var perTok = C.qpd * DAYS * TOKENS * C.price / 1e6;
    var card = C.hosting === "card";
    R.month = card ? cardMonth(C) : perTok;
    R.day = card ? Number(C.hours) * CARDS[C.card].rate : C.qpd * TOKENS * C.price / 1e6;
    R.answer = R.month / answers;
    R.ratio = card ? Math.round(cardMonth(C) * 1e7 / (answers * TOKENS * C.price)) / 10 : 1;
    R.monthText = money(R.month) + " a month (" + cents(R.day) + " a day)";
    R.answerText = perAnswer(R.answer);
    if (R.ratio === 1) R.ratioText = "the same as the service";
    else R.ratioText = (R.ratio === Math.round(R.ratio) ? String(R.ratio) : R.ratio.toFixed(1)) + " times the service";
    if (card) {
      var perMin = C.qpd / (Number(C.hours) * 60);
      var cap = CARDS[C.card].perMin;
      var share = perMin / cap;
      R.busy = (share > 1 ? "over capacity: " : "") + Math.round(share * 100) + "% (" + perMin.toFixed(1) + " of " + cap + " a minute)";
      R.wait = Number(C.hours) < 24 ? "about " + RESTART_MIN + " minutes, first question each day" : "none: on all day";
    } else {
      R.busy = "not ours: paid per token";
      R.wait = "none: the company's cards stay on";
    }
    var be = Math.round(cardMonth(C) * 1e6 / (TOKENS * C.price));
    R.breakeven = fmt(be) + " a month (" + fmt(Math.round(be / DAYS)) + " a day)";
    R.budget = (R.month > BUDGET ? "over: " : "within: ") + money(R.month) + " against " + money(BUDGET);
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
    var ui = api.state.ui;
    ui.head.textContent = "the assistant's costs at Skirlaw. " + fmt(C.qpd) + " questions a day, about " + fmt(TOKENS) +
      " tokens each, a 30-day month. chosen: " + pick(HOSTING, C.hosting).label + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["hosting", "a 30-day month", "per answer", "card busy"], true);
    HOSTING.forEach(function (h) {
      var D = {};
      for (var k in C) D[k] = C[k];
      D.hosting = h.value;
      var R = calc(D);
      row(ui, [h.label, money(R.month), R.answerText, R.busy], false, h.value === C.hosting);
    });
    var R0 = calc(C);
    ui.note.textContent = "card's break-even: " + R0.breakeven + ". budget: " + R0.budget + ". wait after a restart: " + R0.wait + ".";
  }

  function setStats(api) {
    var C = api.state.C;
    var R = calc(C);
    var st = api.state.stat;
    st.hosting(pick(HOSTING, C.hosting).label);
    st.month(R.monthText);
    st.answer(R.answerText);
    st.ratio(R.ratioText);
    st.busy(R.busy);
    st.breakeven(R.breakeven);
    st.wait(R.wait);
    st.budget(C.billed ? R.budget : "no charges yet this month");
    st.bill(C.billed ? "$720 charged at 01:05; budget email at 01:10" : "not charged yet");
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = calc(api.state.C);
    if (what) api.log(what + " " + R.monthText + ", " + R.answerText + " an answer, " + R.ratioText + ".",
      R.ratio > 1 ? "bad" : "ok");
  }

  function playBill(api) {
    api.log("01:05  billing       september: " + fmt(24 * DAYS) + " hours at $1.00 an hour, $720.00 charged.", "");
    api.log("01:10  budget email  charges so far in october: $720.00. your budget: $100.00 a month.", "bad");
    api.state.C.billed = true;
    draw(api);
    setStats(api);
    api.log("18,000 answers in september: $720 / 18,000 = $0.04 an answer, against $0.004 on the service.", "bad");
  }

  function planConfig(plan, prev) {
    var C = defaults();
    C.plan = plan;
    C.billed = prev.billed;
    if (plan === "r0") { C.hosting = "open"; }
    if (plan === "r1") { C.hosting = "card"; C.card = "2"; }
    if (plan === "r2") { C.hosting = "card"; }
    if (plan === "r3") { C.hosting = "card"; C.hours = "8"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = calc(api.state.C);
    if (plan === "r0") {
      api.log("first: the licence page read and written down, with the date and the link.", "ok");
      api.log("per token: " + R.monthText + ", " + R.answerText + " an answer. look again near 6,000 a day, the card's break-even, or if data must stay in-house.", "ok");
    }
    if (plan === "r1") api.log("the bigger card, all day: " + R.monthText + ", " + R.answerText + " an answer, " + R.ratioText +
      ". busy " + R.busy + ". break-even " + R.breakeven + ".", "bad");
    if (plan === "r2") api.log("the card as it is: " + R.monthText + ", " + R.ratioText + ". licence page: not read, nothing on record.", "bad");
    if (plan === "r3") api.log("card off at midnight: " + R.monthText + ", " + R.ratioText + ". the first question each day waits " +
      R.wait.split(",")[0] + " while the model is copied onto the card.", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.hosting.set(S.C.hosting);
        S.ctl.qpd.set(S.C.qpd);
        S.ctl.hours.set(S.C.hours);
        S.ctl.price.set(S.C.price);
        S.ctl.card.set(S.C.card);
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
      chooser("hosting", "hosting", HOSTING, "card");
      slider("qpd", "questions a day", 100, 12000, 100, QPD);
      chooser("hours", "hours the card runs", HOURS, "24");
      slider("price", "price per million tokens ($)", 0.5, 5, 0.5, PRICE);
      chooser("card", "card price per hour", CARD_LIST, "1");
      S.ctl.bill = api.control.button("bill", "play the bill, 01:05", function () { playBill(api); });
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
        hosting: api.stat("hosting", "hosting", ""),
        month: api.stat("month", "cost, 30-day month", "warn"),
        answer: api.stat("answer", "cost per answer", "warn"),
        ratio: api.stat("ratio", "against the service", "bad"),
        busy: api.stat("busy", "card busy", ""),
        breakeven: api.stat("breakeven", "card's break-even", ""),
        wait: api.stat("wait", "wait after a restart", ""),
        budget: api.stat("budget", "budget, $100 a month", "bad"),
        bill: api.stat("bill", "september's bill", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one way to run the assistant at the settings you chose: what a 30-day month costs, what one answer costs, and how busy the card is. Per token, you pay for the tokens used. On the card, you pay for every hour it is on, answering or not. The bold row is the one chosen.");

      refresh(api, "");
      api.log("thursday 1 october, 00:30 at Skirlaw, before the bill. the card has run all day since 00:00 on tuesday 1 september: 600 questions a day, about 0.4 a minute, for a card that can answer about 20.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the card, all day, before the bill.
      t.expect(t.stat("month") === "$720 a month ($24.00 a day)" && t.stat("answer") === "$0.04" &&
        t.stat("ratio") === "10 times the service" && t.stat("busy") === "2% (0.4 of 20 a minute)" &&
        t.stat("breakeven") === "180,000 a month (6,000 a day)" && t.stat("bill") === "not charged yet" &&
        t.stat("wait") === "none: on all day" && has("00:30 at Skirlaw"),
        "Opens at 00:30: the card all day, $720, $0.04, 10 times, 2% busy, break-even 180,000, bill not charged");

      // 2. The bill and the budget email.
      t.click("bill");
      t.expect(t.stat("bill") === "$720 charged at 01:05; budget email at 01:10" &&
        t.stat("budget") === "over: $720 against $100" && has("01:10  budget email") &&
        has("$720 / 18,000 = $0.04 an answer"), "The bill: $720 at 01:05, the budget email at 01:10");

      // 3. The provider's service: $2.40 a day, $72, $0.004.
      t.set("hosting", "service");
      t.expect(t.stat("month") === "$72 a month ($2.40 a day)" && t.stat("answer") === "$0.004" &&
        t.stat("ratio") === "the same as the service" && t.stat("busy") === "not ours: paid per token" &&
        t.stat("budget") === "within: $72 against $100", "Service: $72 a month, $2.40 a day, $0.004 an answer");

      // 4. The same open model per token: the same price.
      t.set("hosting", "open");
      t.expect(t.stat("month") === "$72 a month ($2.40 a day)" && t.stat("answer") === "$0.004",
        "Same open model per token: $72, $0.004");

      // 5. Break-even: at 6,000 a day the card matches the service.
      t.set("hosting", "card");
      t.set("qpd", 6000);
      t.expect(t.stat("answer") === "$0.004" && t.stat("ratio") === "the same as the service" &&
        t.stat("busy") === "21% (4.2 of 20 a minute)", "6,000 a day: the card costs $0.004, the same as the service");

      // 6. The card 8 hours a day.
      t.set("qpd", 600);
      t.set("hours", "8");
      t.expect(t.stat("month") === "$240 a month ($8.00 a day)" && t.stat("answer") === "$0.013" &&
        t.stat("ratio") === "3.3 times the service" && t.stat("breakeven") === "60,000 a month (2,000 a day)" &&
        t.stat("wait") === "about 3 minutes, first question each day", "8 hours: $240, $0.013, 3.3 times, a 3-minute wait");

      // 7. The bigger model on the bigger card, all day.
      t.set("hours", "24");
      t.set("card", "2");
      t.expect(t.stat("month") === "$1,440 a month ($48.00 a day)" && t.stat("answer") === "$0.08" &&
        t.stat("ratio") === "20 times the service" && t.stat("busy") === "4% (0.4 of 10 a minute)" &&
        t.stat("breakeven") === "360,000 a month (12,000 a day)", "Bigger card: $1,440, $0.08, 20 times, 4% busy");

      // 8. Reply 0: per token, licence written down first.
      t.set("plan", "r0");
      t.expect(t.stat("hosting") === "the same open model, per token" && t.stat("month") === "$72 a month ($2.40 a day)" &&
        t.stat("answer") === "$0.004" && has("licence page read and written down") && has("look again near 6,000 a day"),
        "Reply 0: per token at $72, licence written down first");

      // 9. Reply 1: the bigger model.
      t.set("plan", "r1");
      t.expect(t.stat("month") === "$1,440 a month ($48.00 a day)" && t.stat("ratio") === "20 times the service" &&
        has("the bigger card, all day"), "Reply 1: $1,440 a month, 20 times the service");

      // 10. Reply 2: keep the card, nothing read.
      t.set("plan", "r2");
      t.expect(t.stat("month") === "$720 a month ($24.00 a day)" && t.stat("answer") === "$0.04" &&
        has("licence page: not read"), "Reply 2: $720, $0.04, the licence page not read");

      // 11. Reply 3: card off while closed.
      t.set("plan", "r3");
      t.expect(t.stat("month") === "$240 a month ($8.00 a day)" && t.stat("ratio") === "3.3 times the service" &&
        has("waits about 3 minutes"), "Reply 3: $240, 3.3 times, the first question waits about 3 minutes");
    }
  });
})();
