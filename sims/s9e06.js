/* sims/s9e06-v1.0.0.js  (published as sims/s9e06.js)
   Case s9e06 "Monolith or Many": a pricing lab for a 24-hour supermarket on Thursday night
   8 October 2026. Twelve services (programs that each run on their own) show or charge prices,
   and each carries its own copy of the shared pricing library. Version 2.1 (Thursday 8 January
   2026) has no bakery rule; version 2.4 adds "bakery half price from 22:00", the first new pricing
   rule in nine months. The learner picks a design, how many services are upgraded, a failing
   test, the nightly mismatch report and the till override, then steps the night from 21:50 to
   23:00 in 5-minute steps. Widget-style sim: it draws inside api.root. Button-driven
   (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls design, services upgraded, failing test, nightly
     report, till override; buttons Next 5 minutes, Play to 23:00, Reset. Stats: time, loaf prices
     in the shop, shelf label, self-checkout, staffed till, price checker, mismatches, services on
     2.4, deploys per rule change, time to roll out a rule, mismatch first seen, nightly report.
     selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e06-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - 12 services, named in the post's log in this upgrade order: shelf-label printer, self-checkouts,
     scales, online orders, shop app, scan-as-you-shop handsets, reduced-sticker gun (the 7 on 2.4
     tonight), then staffed tills, price checker, customer service desk, cafe till, fuel kiosk
     (the 5 still on 2.1).
   - The white loaf: GBP 1.10. Version 2.4's rule: bakery half price from 22:00, so GBP 0.55 on a 2.4
     copy from 22:00. A 2.1 copy has no such rule: GBP 1.10 all night.
   - An upgrade (the post): 40 minutes of tests in the one test lab, a 10-minute deploy, a 10-minute
     check: an hour a service, one at a time. 2.4 ready at 14:00; 14:00 to 21:00 is 7 hours, so 7 of
     12 done. All 12 would take 12 hours, the last done at 02:00.
   - Deploys per rule change (sim.lede): 12 copies 12 (12 hours, one at a time); one pricing place 1
     (1 hour); one pipeline 12 in one run (tests on 12 test machines at once, then all released
     together: 1 hour); one service per rule 13 (the rule's own service plus the 12 callers, one at a
     time: 13 hours).
   - Story events (the post): 22:00 the rule starts; 22:05 the label printer prints the bakery label;
     22:20 a customer buys a loaf at a self-checkout (GBP 0.55); 22:30 self-checkouts close for
     cleaning; 22:40 she buys a second loaf at staffed till 3 (GBP 1.10). Before 22:05 the shelf
     still carries the old GBP 1.10 label.
   - Mismatches: services whose loaf price differs from the shelf label. As built: 7 from 22:00 to
     22:04 (old label), 5 from 22:05.
   - The nightly report runs at 06:00 on Friday 9 October: 22:40 Thursday to 06:00 Friday is 7 h 20 min.
   - The failing test is the cafe till's (part 2 of the warn option, 5 November): the pipeline holds
     all 12 on 2.1; with 12 copies only the cafe till stays behind.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after midnight, money in pence) ---------- */

  var START = 21 * 60 + 50;   // 21:50, the sim opens here
  var STEP = 5;               // minutes a step
  var LAST = 14;              // 14 steps: 21:55 to 23:00
  var RULE = 22 * 60;         // 22:00, version 2.4's bakery rule starts
  var PRINT = 22 * 60 + 5;    // 22:05, the label printer prints the bakery label
  var SELF_BUY = 22 * 60 + 20;
  var SELF_SHUT = 22 * 60 + 30;
  var TILL_BUY = 22 * 60 + 40;
  var LOAF = 110;
  var HALF = 55;
  var AS_BUILT_UP = 7;

  var SERVICES = [
    "shelf-label printer", "self-checkouts", "scales", "online orders", "shop app",
    "scan-as-you-shop handsets", "reduced-sticker gun", "staffed tills", "price checker",
    "customer service desk", "café till", "fuel kiosk"
  ];
  var LABEL = 0, SELF = 1, TILLS = 7, CHECKER = 8, CAFE = 10;

  var DESIGNS = [
    { value: "copies", label: "12 library copies, one upgrade each (as built)", deploys: 12, rollout: "12 hours, one at a time" },
    { value: "one", label: "one pricing place every service asks", deploys: 1, rollout: "1 hour" },
    { value: "pipeline", label: "one pipeline upgrading all 12 together", deploys: 12, rollout: "1 hour, all 12 at once" },
    { value: "rule", label: "one service per rule", deploys: 13, rollout: "13 hours, one at a time" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { return two(Math.floor(t / 60) % 24) + ":" + two(t % 60); }
  function money(p) { return "£" + (p / 100).toFixed(2); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function timeAt(k) { return START + k * STEP; }
  function differ(n) { return n + (n === 1 ? " service differs" : " services differ"); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // Which library version each service prices with tonight.
  function versions(C) {
    var out = [];
    for (var i = 0; i < SERVICES.length; i++) {
      var v;
      if (C.design === "one") v = "2.4";                                   // one place, one deploy
      else if (C.design === "pipeline") v = C.fail ? "2.1" : "2.4";        // all move, or none
      else v = i < C.up && !(C.fail && i === CAFE) ? "2.4" : "2.1";        // copies, or callers of the rule service
      out.push(v);
    }
    return out;
  }

  function priceOf(ver, t) { return ver === "2.4" && t >= RULE ? HALF : LOAF; }

  function state(C, t) {
    var vs = versions(C);
    var prices = vs.map(function (v) { return priceOf(v, t); });
    var label = t >= PRINT ? prices[LABEL] : LOAF;          // the old label until 22:05
    var distinct = {};
    prices.forEach(function (p) { distinct[p] = true; });
    var mism = prices.filter(function (p) { return p !== label; }).length;
    var on24 = vs.filter(function (v) { return v === "2.4"; }).length;
    return { t: t, vs: vs, prices: prices, label: label, count: Object.keys(distinct).length, mism: mism, on24: on24 };
  }

  function summary(st) {
    var by = {};
    st.prices.forEach(function (p) { by[p] = (by[p] || 0) + 1; });
    return Object.keys(by).map(Number).sort(function (a, b) { return a - b; })
      .map(function (p) { return money(p) + " at " + by[p]; }).join(", ");
  }

  function upgradedText(C, st) {
    if (C.design === "one") return "all 12 ask one pricing place (2.4)";
    if (C.design === "rule") return st.on24 + " of 12 callers ask the rule";
    return st.on24 + " of 12 on 2.4";
  }

  // What the customer sees at till 3 at 22:40, against her 22:20 self-checkout receipt.
  function customer(C) {
    var receipt = state(C, SELF_BUY).prices[SELF];
    var till = state(C, TILL_BUY).prices[TILLS];
    return { receipt: receipt, till: till, seen: receipt !== till };
  }

  function describe(C) {
    var d = pick(DESIGNS, C.design).label;
    var up = C.design === "copies" || C.design === "rule" ? ", " + C.up + " of 12 upgraded" : "";
    return d + up + (C.fail ? ", the café till's test failing" : "") + ", report " + (C.report ? "on" : "off") +
      ", till override " + (C.override ? "on" : "off");
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["service", "pricing library", "loaf now", "same as label?"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, sum: sum };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var t = timeAt(S.k);
    var st = state(C, t);
    var d = pick(DESIGNS, C.design);
    ui.head.textContent = "Set-up: " + describe(C) + ".";
    clear(ui.body);
    SERVICES.forEach(function (name, i) {
      var tr = ui.el("tr");
      var lib = C.design === "one" ? "asks the pricing place (2.4)" : C.design === "rule" ? (st.vs[i] === "2.4" ? "asks the rule" : "old copy (2.1)") : st.vs[i];
      [name, lib, money(st.prices[i]), st.prices[i] === st.label ? "yes" : "no"].forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.body.appendChild(tr);
    });
    S.stat.time(hm(t));
    S.stat.prices(st.count);
    S.stat.label(money(st.label));
    S.stat.self(money(st.prices[SELF]));
    S.stat.till(money(st.prices[TILLS]));
    S.stat.checker(money(st.prices[CHECKER]));
    S.stat.mism(st.mism);
    S.stat.up(upgradedText(C, st));
    S.stat.deploys(d.deploys);
    S.stat.rollout(d.rollout);
    S.stat.seen(S.seen);
    S.stat.report(C.report ? S.reportText || "runs Fri 06:00" : "off");
    ui.sum.textContent = "At " + hm(t) + " the loaf costs " + summary(st) + " services. The shelf label says " + money(st.label) +
      "; " + st.mism + " of 12 disagree with it.";
  }

  function resetNight(api) {
    var S = api.state;
    S.k = 0;
    S.seen = "not yet";
    S.reportText = "";
  }

  function change(api, what) {
    resetNight(api);
    api.log(what + " Set back to 21:50.", "");
    if (api.state.C.design === "pipeline" && api.state.C.fail) {
      api.log("Pipeline held: the café till's test failed, so none of the 12 moved to 2.4.", "warn");
    }
    draw(api);
  }

  function endOfNight(api, st) {
    var S = api.state;
    var C = S.C;
    var cu = customer(C);
    api.log("23:00 end of the night: " + st.count + (st.count === 1 ? " price" : " prices") + " for the loaf (" + summary(st) + "); " +
      st.mism + " of 12 services differ from the shelf label. " + pick(DESIGNS, C.design).deploys + " deploys a rule change.", st.mism ? "bad" : "ok");
    if (C.report) {
      S.reportText = "Fri 06:00: " + differ(st.mism);
      api.log("Friday 06:00 nightly report: the white loaf has " + st.count + (st.count === 1 ? " price" : " prices") + "; " + differ(st.mism) +
        " from the shelf label." + (cu.seen ? " That is 7 h 20 min after the customer at till 3 saw it." : ""), st.mism ? "warn" : "ok");
      if (!cu.seen && st.mism) S.seen = "Fri 06:00, the nightly report";
    }
    if (S.seen === "not yet") S.seen = st.mism ? "not seen yet" : "no mismatch";
  }

  function events(api, t) {
    var S = api.state;
    var C = S.C;
    var st = state(C, t);
    if (t === RULE) {
      var where = C.design === "one" ? "in the pricing place" : st.on24 ? "on 2.4 copies" : "nowhere: no service runs 2.4";
      api.log("22:00 rule starts " + where + ": the loaf costs " + summary(st) + " services.", st.count > 1 ? "warn" : "ok");
    }
    if (t === PRINT) api.log("22:05 shelf-label printer prints the bakery label: " + money(st.label) + ".", "");
    if (t === SELF_BUY) api.log("22:20 a customer buys a loaf at a self-checkout: " + money(st.prices[SELF]) + ".", "");
    if (t === SELF_SHUT) api.log("22:30 self-checkouts close for cleaning.", "");
    if (t === TILL_BUY) {
      var cu = customer(C);
      if (cu.seen) {
        S.seen = "Thu 22:40, a customer at till 3";
        api.log("22:40 the same customer buys a second loaf at staffed till 3: " + money(cu.till) + ", against her self-checkout receipt for " +
          money(cu.receipt) + ". Mismatch seen by a customer.", "bad");
        if (C.override) api.log("Till override: Dyfrig keys in " + money(st.label) + " for her. The till still charges " + money(cu.till) +
          " to everyone else, and the price checker still says " + money(st.prices[CHECKER]) + ".", "warn");
      } else {
        api.log("22:40 the same customer buys a second loaf at staffed till 3: " + money(cu.till) + ", the same as her receipt.", "ok");
      }
    }
    return st;
  }

  function stepOnce(api, withLine) {
    var S = api.state;
    S.k += 1;
    var t = timeAt(S.k);
    var st = state(S.C, t);
    if (withLine) api.log(hm(t) + " loaf: " + summary(st) + ". Shelf label " + money(st.label) + ", mismatches " + st.mism + ".", st.mism ? "bad" : "");
    events(api, t);
    if (S.k === LAST) endOfNight(api, st);
  }

  function step(api) {
    if (api.state.k >= LAST) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    stepOnce(api, true);
    draw(api);
  }

  function play(api) {
    if (api.state.k >= LAST) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    while (api.state.k < LAST) stepOnce(api, false);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "copies", up: AS_BUILT_UP, fail: false, report: false, override: false };
      resetNight(api);
      S.ui = buildWidget(api);

      api.control.select("design", "Design", DESIGNS.map(function (d) { return { value: d.value, label: d.label }; }), S.C.design, function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = o.value;
        change(api, "Design: " + o.label + ".");
      });
      api.control.range("up", "Services upgraded (12 copies, or callers of the rule service)", 0, 12, 1, AS_BUILT_UP, function (v) {
        var x = Math.max(0, Math.min(12, Math.round(Number(v))));
        if (!isFinite(x)) return;
        S.C.up = x;
        change(api, "Services upgraded: " + x + " of 12.");
      });
      function tog(id, label, key) {
        api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          change(api, label + ": " + (on ? "on." : "off."));
        });
      }
      tog("fail", "The café till's test fails on the new release", "fail");
      tog("report", "Nightly mismatch report (runs at 06:00)", "report");
      tog("override", "Staff may override the price at the till", "override");
      api.control.button("step", "Next 5 minutes", function () { step(api); });
      api.control.button("run", "Play to 23:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        prices: api.stat("prices", "loaf prices in the shop", "warn"),
        label: api.stat("label", "shelf label", ""),
        self: api.stat("self", "self-checkout charges", ""),
        till: api.stat("till", "staffed till charges", ""),
        checker: api.stat("checker", "price checker says", ""),
        mism: api.stat("mism", "services that differ from the label", "bad"),
        up: api.stat("up", "services on the new rule", ""),
        deploys: api.stat("deploys", "deploys per rule change", ""),
        rollout: api.stat("rollout", "time to roll out a rule", ""),
        seen: api.stat("seen", "mismatch first seen", "bad"),
        report: api.stat("report", "nightly report", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one of the 12 services and the pricing library it uses. \"loaf now\" is what it says a white loaf costs at this time; the last column compares it with the shelf label. A mismatch is a service that disagrees with the label. Deploys per rule change counts how many programs must be tested, put on the machines and checked for one new pricing rule.");

      api.log("Thursday 8 October 2026, 21:50, as built: 12 library copies, 7 of 12 services on 2.4, 5 on 2.1. The white loaf costs £1.10 everywhere.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { design: "copies", up: AS_BUILT_UP, fail: false, report: false, override: false };
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }
      function stepTo(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: 21:50, before the rule starts; one price, nothing seen.
      t.expect(t.stat("time") === "21:50" && t.stat("prices") === 1 && t.stat("label") === "£1.10" && t.stat("till") === "£1.10" &&
        t.stat("self") === "£1.10" && t.stat("mism") === 0 && t.stat("up") === "7 of 12 on 2.4" && t.stat("deploys") === 12 &&
        t.stat("rollout") === "12 hours, one at a time" && t.stat("seen") === "not yet" && has("21:50, as built"),
        "Opens at 21:50 as built: 7 of 12 on 2.4, one price, GBP 1.10 everywhere, 12 deploys a rule");

      // 2. 22:00: the rule starts on the 7 copies of 2.4; the old label still says GBP 1.10.
      begin();
      stepTo(2);
      t.expect(t.stat("time") === "22:00" && t.stat("prices") === 2 && t.stat("self") === "£0.55" && t.stat("till") === "£1.10" &&
        t.stat("label") === "£1.10" && t.stat("mism") === 7 && has("22:00 rule starts on 2.4 copies: the loaf costs £0.55 at 7, £1.10 at 5 services."),
        "22:00: GBP 0.55 at 7 services, GBP 1.10 at 5; the old label still says GBP 1.10");

      // 3. 22:05: the printer, on 2.4, prints GBP 0.55; now the 5 on 2.1 differ from the label.
      begin();
      stepTo(1);
      t.expect(t.stat("label") === "£0.55" && t.stat("mism") === 5 && t.stat("checker") === "£1.10" &&
        has("22:05 shelf-label printer prints the bakery label: £0.55."),
        "22:05: the label says GBP 0.55; the staffed tills, the price checker and 3 others differ");

      // 4. Play on: the customer at till 3 sees it at 22:40.
      begin();
      t.click("run");
      t.expect(t.stat("time") === "23:00" && t.stat("seen") === "Thu 22:40, a customer at till 3" && t.stat("report") === "off" &&
        has("22:20 a customer buys a loaf at a self-checkout: £0.55.") &&
        has("22:40 the same customer buys a second loaf at staffed till 3: £1.10, against her self-checkout receipt for £0.55. Mismatch seen by a customer.") &&
        has("23:00 end of the night: 2 prices for the loaf (£0.55 at 7, £1.10 at 5); 5 of 12 services differ from the shelf label. 12 deploys a rule change."),
        "As built: the customer at till 3 sees GBP 1.10 against her GBP 0.55 receipt at 22:40");

      // 5. All 12 upgraded: one price, no mismatch. None upgraded: one price, no reduction.
      as({ up: 12 });
      t.click("run");
      var a12 = t.stat("prices") === 1 && t.stat("till") === "£0.55" && t.stat("mism") === 0 && t.stat("seen") === "no mismatch";
      as({ up: 0 });
      t.click("run");
      t.expect(a12 && t.stat("prices") === 1 && t.stat("label") === "£1.10" && t.stat("self") === "£1.10",
        "12 of 12 upgraded: GBP 0.55 everywhere; 0 of 12: GBP 1.10 everywhere and the label never drops");

      // 6. One pricing place (option 0): one deploy, one price from 22:00, whatever the copies were.
      as({ design: "one" });
      stepTo(2);
      var o1 = t.stat("prices") === 1 && t.stat("till") === "£0.55" && t.stat("self") === "£0.55";
      t.click("run");
      t.expect(o1 && t.stat("mism") === 0 && t.stat("deploys") === 1 && t.stat("rollout") === "1 hour" && t.stat("seen") === "no mismatch",
        "One pricing place: 1 deploy, an hour, GBP 0.55 at all 12 from 22:00, no mismatch");

      // 7. One pipeline (option 3): one price after 12 deploys in one run; one failing test holds all 12.
      as({ design: "pipeline" });
      t.click("run");
      var p1 = t.stat("prices") === 1 && t.stat("till") === "£0.55" && t.stat("deploys") === 12 && t.stat("rollout") === "1 hour, all 12 at once";
      begin();
      t.set("fail", true);
      t.click("run");
      t.expect(p1 && has("Pipeline held: the café till's test failed, so none of the 12 moved to 2.4.") && t.stat("up") === "0 of 12 on 2.4" &&
        t.stat("prices") === 1 && t.stat("label") === "£1.10" && t.stat("self") === "£1.10",
        "Pipeline: one price, 12 deploys in one run; with the cafe till's test failing all 12 stay on 2.1 and the rule starts nowhere");

      // 8. One service per rule (option 1): 13 deploys, and with 7 callers updated still two prices.
      as({ design: "rule" });
      t.click("run");
      t.expect(t.stat("deploys") === 13 && t.stat("rollout") === "13 hours, one at a time" && t.stat("prices") === 2 &&
        t.stat("up") === "7 of 12 callers ask the rule" && t.stat("seen") === "Thu 22:40, a customer at till 3",
        "One service per rule: 13 deploys, 13 hours; at 7 callers the loaf still has two prices");

      // 9. Nightly report (option 2): it finds the mismatch on Friday at 06:00, after the customer did.
      as({ report: true });
      begin();
      t.click("run");
      t.expect(t.stat("seen") === "Thu 22:40, a customer at till 3" && t.stat("report") === "Fri 06:00: 5 services differ" &&
        has("Friday 06:00 nightly report: the white loaf has 2 prices; 5 services differ from the shelf label. That is 7 h 20 min after the customer at till 3 saw it."),
        "The report sees the mismatch on Friday at 06:00, 7 h 20 min after the customer at till 3");

      // 10. Till override: one receipt fixed, the shop still has two prices.
      as({ override: true });
      begin();
      t.click("run");
      t.expect(has("Till override: Dyfrig keys in £0.55 for her. The till still charges £1.10 to everyone else, and the price checker still says £1.10.") &&
        t.stat("prices") === 2 && t.stat("mism") === 5 && t.stat("checker") === "£1.10",
        "Till override fixes one receipt; still 2 prices and 5 services differ");

      // 11. 12 copies with the cafe till's test failing: only the cafe till stays behind, and only the report sees it.
      as({ up: 12, fail: true });
      t.click("run");
      var c1 = t.stat("up") === "11 of 12 on 2.4" && t.stat("prices") === 2 && t.stat("mism") === 1 && t.stat("seen") === "not seen yet";
      as({ up: 12, fail: true, report: true });
      t.click("run");
      t.expect(c1 && t.stat("seen") === "Fri 06:00, the nightly report" && t.stat("report") === "Fri 06:00: 1 service differs",
        "12 copies, cafe till failing: 11 on 2.4, the cafe till alone differs; no customer at till 3 sees it, the report does on Friday");
    }
  });
})();
