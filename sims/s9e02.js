/* sims/s9e02-v1.0.0.js  (published as sims/s9e02.js)
   Case s9e02 "The Long Move": a migration lab for a 24-hour launderette moving its card payments
   from an old payment system to a new one, Tapwren, one group of machines at a time.
   24 washing machines in three groups: 1 to 3 already owned by Tapwren, 4 to 6 next (Monday's move),
   7 to 24 last. On machines the old system owns, a copy of every payment request goes to Tapwren
   in shadow mode: Tapwren works out its charge, the two answers are compared and logged, and only
   the old system is meant to act. Tapwren reads its card keys from one settings file. For six weeks
   it said: 1 to 3 live, every other machine test. At 06:00 on Saturday 10 October 2026 Mr Adebayo
   changed "every other machine" to live, to get 4 to 6 ready for Monday 12 October. Each shadow copy
   then sent a real charge. By 23:14, 212 washes on machines 4 to 24 had been charged twice:
   212 second charges of 4.50 pounds, 954 pounds in all.
   The learner sets the keys, whether a shadow copy may send its charge, which system the router
   gives each group, the move plan and morning refunds, then steps through 06:00 to 23:14 in
   15-minute steps (or plays to 23:14) and reads charges per wash, double charges and their total,
   mismatches logged, wrong prices charged with no comparison, and customers who saw two charges.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls keys, shadow side effects, router owner for 4 to 6
     and for 7 to 24, move plan, morning refunds; step 15 minutes, play to 23:14, reset. Stats:
     clock, per wash on 4 to 6, per wash on 7 to 24, double charges, their total, customers who saw
     two charges, refunds, mismatches logged, wrong prices never compared, washes on 4 to 24 charged
     by Tapwren with no comparison, washes never really paid, the day. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e02-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Times in minutes from midnight. The replay runs from 06:00 (the switch) to 23:14 (the alert),
     in 15-minute steps; the last step is 23:00 to 23:14.
   - Washes (charged when the wash is paid, at its start): machines 1 to 3 run 10 each, the first at
     06:01, 06:06 and 06:11 (30 in all). Machines 4 to 24 run 10 each, and 11 on machines 4 and 5,
     the busy pair by the door: 2 x 11 + 19 x 10 = 212. Machine m's first wash is at
     06:00 + 5 x (m - 4) + 4 minutes (machine 4 at 06:04, machine 24 at 07:44), then one every
     101 minutes (a wash takes 45). The last is machine 5's 11th, at 06:09 + 10 x 101 = 22:59:
     Teodozja's. Every other wash on 4 to 24 is paid by 22:54.
   - Tapwren handles each shadow copy 15 minutes after the wash is paid, in a queue that runs behind
     the machines. So Teodozja's second charge lands at 23:14, and every second charge from a wash
     paid by 22:59 has landed by 23:14. Steps of 15 minutes: after 06:15, 0 second charges; after
     06:30, 3 (machines 4, 5 and 6 paid at 06:04, 06:09 and 06:14).
   - Prices: the old system charges 4.50 pounds, and 3.50 on machine 6, the small one. Tapwren's
     price list says 4.50 for every machine. So every second charge is 4.50: 212 x 4.50 = 954.00.
     Machine 6's 10 washes are the only comparison mismatches: 10 logged.
   - Router 4 to 6 to Tapwren, as built otherwise: 4 to 6 are charged once by Tapwren, 7 to 24 still
     twice: 212 - 32 = 180 second charges, 810.00 pounds; machine 6's 10 washes are charged 4.50
     instead of 3.50 with nothing compared (10, 10.00 pounds over).
   - Groups without shadow, 4 to 6 on Tapwren (option 2): 0 double charges, 0 mismatches logged,
     32 washes on Tapwren with no comparison, machine 6's 10 at the wrong price.
   - All 24 at once (option 3): 0 double charges, 212 washes on Tapwren with no comparison, machine
     6's 10 at the wrong price.
   - Keys test for every machine but 1 to 3 (the six weeks before): shadow copies send pretend
     charges: 0 double charges. With 4 to 6 on Tapwren and those keys, 32 washes are never really paid.
   - Morning refunds go out at 07:00 on Sunday 11 October, after every customer has seen both.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes from midnight, money in pence) ---------- */

  function at(h, m) { return h * 60 + m; }
  var START = at(6, 0);
  var END = at(23, 14);
  var STEP = 15;
  var LAG = 15;                     // a shadow copy is handled 15 minutes after the wash is paid
  var EVERY = 101;                  // minutes between washes on one machine
  var NEW_PRICE = 450;              // Tapwren's price list: every machine
  var HERS = { m: 5, t: at(22, 59) };

  function oldPrice(m) { return m === 6 ? 350 : 450; }
  function group(m) { return m <= 3 ? "a" : m <= 6 ? "b" : "c"; }

  var WASHES = (function () {
    var list = [];
    for (var m = 1; m <= 24; m++) {
      var first = m <= 3 ? START + 5 * (m - 1) + 1 : START + 5 * (m - 4) + 4;
      var n = m === 4 || m === 5 ? 11 : 10;
      for (var k = 0; k < n; k++) list.push({ m: m, t: first + k * EVERY });
    }
    return list;
  })();

  var KEYS = [
    { value: "all", label: "live for every machine (from 06:00, as built)" },
    { value: "test", label: "1 to 3 live, every other machine test (the six weeks before)" },
    { value: "group", label: "live only for groups the router gives Tapwren" }
  ];
  var SHADOWS = [
    { value: "send", label: "a shadow copy sends its charge (as built)" },
    { value: "block", label: "a shadow copy only works out its charge and logs it" }
  ];
  var OWNERS = [
    { value: "old", label: "the old system (as built)" },
    { value: "new", label: "Tapwren" }
  ];
  var PLANS = [
    { value: "shadow", label: "shadow copies on every machine the old system owns (as built)" },
    { value: "groups", label: "groups without shadow copies" },
    { value: "all", label: "all 24 machines on Tapwren at once, no shadow copies" }
  ];
  var REFUNDS = [
    { value: "off", label: "none (as built)" },
    { value: "on", label: "refund every double charge at 07:00 the next morning" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { return two(Math.floor(t / 60)) + ":" + two(t % 60); }
  function money(p) { return "£" + (p / 100).toFixed(2); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function ownerOf(C, m) {
    var g = group(m);
    if (g === "a" || C.plan === "all") return "new";
    return (g === "b" ? C.ownerB : C.ownerC) === "new" ? "new" : "old";
  }
  function liveKeys(C, m, owner) {
    if (C.keys === "all") return true;
    if (C.keys === "test") return group(m) === "a";
    return owner === "new";
  }
  function perWash(C, m) {
    var owner = ownerOf(C, m);
    var live = liveKeys(C, m, owner);
    if (owner === "new") return live ? "1 (Tapwren)" : "0 real (Tapwren, test keys)";
    if (C.plan === "shadow" && C.shadow === "send" && live) return "2 (old, then Tapwren)";
    return "1 (old)";
  }

  // Everything that has happened from 06:00 up to minute `upto`, and the log lines for (from, upto].
  function day(C, from, upto) {
    var r = {
      paid: 0, doubles: 0, doubleP: 0, mismatches: 0, unseen: 0, overP: 0, unchecked: 0, pretend: 0,
      hers: false, step: { paid: 0, doubles: 0, mismatches: 0, unseen: 0, pretend: 0 }, lines: []
    };
    WASHES.forEach(function (w) {
      if (w.t > upto) return;
      var inStep = w.t > from;
      var owner = ownerOf(C, w.m);
      var live = liveKeys(C, w.m, owner);
      var later = w.t + LAG;
      if (w.m >= 4) {
        r.paid += 1;
        if (inStep) r.step.paid += 1;
      }
      if (owner === "new") {
        if (!live) {
          r.pretend += 1;
          if (inStep) r.step.pretend += 1;
          return;
        }
        if (w.m >= 4) r.unchecked += 1;
        if (NEW_PRICE !== oldPrice(w.m)) {
          r.unseen += 1;
          r.overP += NEW_PRICE - oldPrice(w.m);
          if (inStep) r.step.unseen += 1;
        }
        return;
      }
      if (C.plan !== "shadow" || later > upto) return;
      var handledInStep = later > from;
      if (NEW_PRICE !== oldPrice(w.m)) {
        r.mismatches += 1;
        if (handledInStep) r.step.mismatches += 1;
      }
      if (C.shadow === "send" && live) {
        r.doubles += 1;
        r.doubleP += NEW_PRICE;
        if (handledInStep) r.step.doubles += 1;
        if (w.m === HERS.m && w.t === HERS.t) r.hers = true;
      }
    });
    return r;
  }

  function stepLine(C, from, upto, r) {
    var s = r.step;
    var parts = [];
    if (s.paid) parts.push(s.paid + (s.paid === 1 ? " wash" : " washes") + " paid on machines 4 to 24");
    if (s.doubles) parts.push(s.doubles + " charged again by Tapwren with live keys (" + r.doubles + " so far, " + money(r.doubleP) + ")");
    if (s.mismatches) parts.push(s.mismatches + " mismatch logged: machine 6, old " + money(oldPrice(6)) + ", Tapwren " + money(NEW_PRICE));
    if (s.unseen) parts.push(s.unseen + " charged " + money(NEW_PRICE) + " on machine 6, not " + money(oldPrice(6)) + ", with nothing compared");
    if (s.pretend) parts.push(s.pretend + " charged by Tapwren with test keys: never really paid");
    if (!parts.length) return null;
    return { text: hm(from) + " to " + hm(upto) + ": " + parts.join("; ") + ".", tone: s.doubles || s.unseen || s.pretend ? "bad" : s.mismatches ? "warn" : "" };
  }

  function outcome(r, C) {
    if (r.doubles) return r.doubles + " customers charged twice" + (C.refunds === "on" ? ", refunded next morning" : "");
    if (r.unseen || r.pretend) return "no double charges, but money wrong with nothing compared";
    return "no double charges" + (r.mismatches ? ", mismatches logged" : "");
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
    ["machines", "owner", "keys", "charges per wash", "washes paid", "second charges"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
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
    var r = day(C, S.clock, S.clock);
    ui.head.textContent = "Saturday 10 October 2026, " + hm(S.clock) + ". Keys: " + pick(KEYS, C.keys).label +
      ". Shadow copy: " + pick(SHADOWS, C.shadow).label + ". Plan: " + pick(PLANS, C.plan).label + ".";
    clear(ui.body);
    [["1 to 3", 1, 3], ["4 to 6", 4, 6], ["7 to 24", 7, 24]].forEach(function (g) {
      var paid = 0, seconds = 0;
      WASHES.forEach(function (w) {
        if (w.m < g[1] || w.m > g[2] || w.t > S.clock) return;
        paid += 1;
        if (ownerOf(C, w.m) === "old" && C.plan === "shadow" && C.shadow === "send" && liveKeys(C, w.m, "old") && w.t + LAG <= S.clock) seconds += 1;
      });
      var owner = ownerOf(C, g[1]);
      var tr = ui.el("tr");
      [g[0], owner === "new" ? "Tapwren" : "old system", liveKeys(C, g[1], owner) ? "live" : "test", perWash(C, g[1]), String(paid), String(seconds)]
        .forEach(function (v) { tr.appendChild(ui.el("td", "", v)); });
      ui.body.appendChild(tr);
    });
    ui.sum.textContent = S.clock === START ? "It is 06:00 and the live keys have just gone on. No wash has been paid yet." :
      "So far: " + r.paid + " washes paid on 4 to 24, " + r.doubles + " charged twice (" + money(r.doubleP) + "), " +
      r.mismatches + " mismatches logged.";
    S.stat.clock(hm(S.clock));
    S.stat.perB(perWash(C, 4));
    S.stat.perC(perWash(C, 7));
    S.stat.doubles(String(r.doubles));
    S.stat.total(money(r.doubleP));
    S.stat.saw(String(r.doubles));
    S.stat.refunded(C.refunds === "on" && r.doubles ? money(r.doubleP) + " at 07:00 Sunday" : "none");
    S.stat.mismatches(String(r.mismatches));
    S.stat.unseen(String(r.unseen));
    S.stat.unchecked(String(r.unchecked));
    S.stat.pretend(String(r.pretend));
    S.stat.outcome(S.clock === START ? "not started" : outcome(r, C));
  }

  function advance(api, to) {
    var S = api.state;
    var from = S.clock;
    var r = day(S.C, from, to);
    var l = stepLine(S.C, from, to, r);
    if (l) api.log(l.text, l.tone);
    if (r.hers && from < HERS.t + LAG && to >= HERS.t + LAG) {
      api.log("23:14 machine 5: Teodozja's wash, paid at 22:59, charged again by Tapwren. Her banking app pings a second time.", "bad");
    }
    S.clock = to;
    if (to === END) {
      api.log("23:14 the day so far: " + r.paid + " washes on 4 to 24; " + r.doubles + " charged twice, " + money(r.doubleP) +
        "; " + r.mismatches + " mismatches logged; " + r.unseen + " wrong prices never compared.", r.doubles ? "bad" : "ok");
      if (S.C.refunds === "on" && r.doubles) {
        api.log("07:00 Sunday: " + money(r.doubleP) + " refunded to " + r.doubles + " customers, each of whom had already seen two charges.", "warn");
      }
    }
  }

  function step(api) {
    var S = api.state;
    if (S.clock >= END) {
      api.log("Already at 23:14. Change a setting or reset to replay the day.", "");
      return;
    }
    advance(api, Math.min(S.clock + STEP, END));
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.clock >= END) {
      api.log("Already at 23:14. Change a setting or reset to replay the day.", "");
      return;
    }
    while (S.clock < END) advance(api, Math.min(S.clock + STEP, END));
    draw(api);
  }

  function change(api, what) {
    api.state.clock = START;
    api.log(what + " Back to 06:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { keys: "all", shadow: "send", ownerB: "old", ownerC: "old", plan: "shadow", refunds: "off" };
      S.clock = START;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("keys", "card keys", KEYS, "keys");
      sel("shadow", "shadow side effects", SHADOWS, "shadow");
      sel("ownerB", "router: 4 to 6 owned by", OWNERS, "ownerB");
      sel("ownerC", "router: 7 to 24 owned by", OWNERS, "ownerC");
      sel("plan", "move plan", PLANS, "plan");
      sel("refunds", "morning refunds", REFUNDS, "refunds");
      api.control.button("step", "step 15 minutes", function () { step(api); });
      api.control.button("play", "play to 23:14", function () { play(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        clock: api.stat("clock", "time", ""),
        perB: api.stat("perB", "charges per wash, 4 to 6", ""),
        perC: api.stat("perC", "charges per wash, 7 to 24", ""),
        doubles: api.stat("doubles", "double charges", "bad"),
        total: api.stat("total", "second charges, total", "bad"),
        saw: api.stat("saw", "customers who saw two charges", "bad"),
        refunded: api.stat("refunded", "refunds", ""),
        mismatches: api.stat("mismatches", "mismatches logged", "warn"),
        unseen: api.stat("unseen", "wrong prices, never compared", "bad"),
        unchecked: api.stat("unchecked", "washes on 4 to 24 charged by Tapwren, no comparison", "warn"),
        pretend: api.stat("pretend", "washes never really paid", "bad"),
        outcome: api.stat("outcome", "the day", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of machines. \"owner\" is the system the router gives that group: the only one meant to charge its cards. \"keys\" says whether Tapwren uses live keys (real money) or test keys (pretend) there. \"charges per wash\" counts real charges for one wash. \"second charges\" counts washes Tapwren charged again through a shadow copy. The log lists each 15 minutes in which something happened.");

      api.log("Saturday 10 October 2026, 06:00, as built: live keys for every machine, shadow copies send their charges, 1 to 3 on Tapwren, 4 to 24 on the old system with shadow copies, no refunds.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      var BUILT = { keys: "all", shadow: "send", ownerB: "old", ownerC: "old", plan: "shadow", refunds: "off" };
      function fresh(set) { as(BUILT); as(set || {}); begin(); t.click("play"); }

      // 1. Opening state: 06:00, the live keys just on, nothing paid yet.
      t.expect(t.stat("clock") === "06:00" && t.stat("doubles") === 0 && t.stat("total") === "£0.00" &&
        t.stat("outcome") === "not started" && has("Saturday 10 October 2026, 06:00, as built"),
        "Opens at 06:00 on Saturday 10 October 2026 with nothing paid");

      // 2. Two 15-minute steps: no second charge by 06:15; 3 by 06:30 (machines 4, 5 and 6).
      begin();
      t.click("step");
      var at615 = t.stat("clock") === "06:15" && t.stat("doubles") === 0;
      t.click("step");
      t.expect(at615 && t.stat("clock") === "06:30" && t.stat("doubles") === 3 &&
        has("06:15 to 06:30: 3 washes paid on machines 4 to 24; 3 charged again by Tapwren with live keys (3 so far, £13.50)"),
        "Steps of 15 minutes: 0 second charges at 06:15, 3 at 06:30");

      // 3. As built, played to 23:14: 212 double charges, 954 pounds, Teodozja's the last.
      begin();
      t.click("play");
      t.expect(t.stat("clock") === "23:14" && t.stat("doubles") === 212 && t.stat("total") === "£954.00" &&
        t.stat("saw") === 212 && t.stat("mismatches") === 10 && t.stat("perC") === "2 (old, then Tapwren)" &&
        t.stat("unseen") === 0 && has("23:14 machine 5: Teodozja's wash, paid at 22:59, charged again by Tapwren.") &&
        has("23:14 the day so far: 212 washes on 4 to 24; 212 charged twice, £954.00; 10 mismatches logged"),
        "As built: 212 washes on 4 to 24 charged twice, 954.00 pounds, the last at 23:14 on machine 5");

      // 4. A step past 23:14 is refused.
      begin();
      t.click("step");
      t.expect(has("Already at 23:14."), "Nothing plays past 23:14");

      // 5. Why never before: test keys for every machine but 1 to 3. Pretend charges, no doubles.
      fresh({ keys: "test" });
      t.expect(t.stat("doubles") === 0 && t.stat("mismatches") === 10 && t.stat("perC") === "1 (old)" && t.stat("pretend") === 0,
        "Six weeks of test keys: shadow copies charge nothing real, 10 mismatches still logged");

      // 6. Option 0: shadow copies only work out and log, keys live per group.
      fresh({ shadow: "block", keys: "group" });
      t.expect(t.stat("doubles") === 0 && t.stat("saw") === 0 && t.stat("mismatches") === 10 && t.stat("unseen") === 0 &&
        t.stat("unchecked") === 0 && t.stat("outcome") === "no double charges, mismatches logged" &&
        has("1 mismatch logged: machine 6, old £3.50, Tapwren £4.50"),
        "Option 0: no double charges, machine 6's 10 mismatches in the log, nothing charged unseen");

      // 7. Option 1: morning refunds. 212 customers still saw two charges.
      fresh({ refunds: "on" });
      t.expect(t.stat("doubles") === 212 && t.stat("saw") === 212 && t.stat("refunded") === "£954.00 at 07:00 Sunday" &&
        has("07:00 Sunday: £954.00 refunded to 212 customers, each of whom had already seen two charges."),
        "Option 1: 954.00 pounds refunded on Sunday morning, after 212 customers saw two charges");

      // 8. Option 2: groups without shadow, 4 to 6 on Tapwren with live keys per group.
      fresh({ plan: "groups", ownerB: "new", keys: "group" });
      t.expect(t.stat("doubles") === 0 && t.stat("mismatches") === 0 && t.stat("unseen") === 10 && t.stat("unchecked") === 32 &&
        t.stat("perB") === "1 (Tapwren)" && t.stat("perC") === "1 (old)" &&
        has("charged £4.50 on machine 6, not £3.50, with nothing compared"),
        "Option 2: no double charges, but machine 6's 10 washes charged 4.50 instead of 3.50 with nothing compared");

      // 9. Option 3: all 24 machines on Tapwren at once.
      fresh({ plan: "all" });
      t.expect(t.stat("doubles") === 0 && t.stat("mismatches") === 0 && t.stat("unseen") === 10 && t.stat("unchecked") === 212 &&
        t.stat("perC") === "1 (Tapwren)",
        "Option 3: no double charges, 212 washes on new code with no comparison, machine 6 wrong 10 times");

      // 10. The router alone: 4 to 6 on Tapwren, everything else as built. 7 to 24 still charged twice.
      fresh({ ownerB: "new" });
      t.expect(t.stat("doubles") === 180 && t.stat("total") === "£810.00" && t.stat("perB") === "1 (Tapwren)" &&
        t.stat("unseen") === 10,
        "Router 4 to 6 to Tapwren alone: 180 double charges on 7 to 24, 810.00 pounds");

      // 11. Option 0 never double-charges, whichever groups the router gives Tapwren.
      var safe = true;
      OWNERS.forEach(function (b) { OWNERS.forEach(function (c) { KEYS.forEach(function (k) {
        var C = { keys: k.value, shadow: "block", ownerB: b.value, ownerC: c.value, plan: "shadow", refunds: "off" };
        if (day(C, START, END).doubles !== 0) safe = false;
      }); }); });
      t.expect(safe, "Shadow copies that never send: 0 double charges under every router and key setting");
    }
  });
})();
