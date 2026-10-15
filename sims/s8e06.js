/* sims/s8e06-v1.0.0.js  (published as sims/s8e06.js)
   Case s8e06 "Pick Two?": a partition lab for the only fuel station in Cwmhelyg, a mountain town
   whose till takes the region's fuel cards. Balances live at head office in the city, 140 km away.
   On Friday 15 January 2027 the storm cut the valley line from 21:40 to 05:10 (7.5 hours). The till
   kept selling up to each card's last known balance. Cynfael's plough account held £120: Iestyn
   bought £110 in town at 00:18 (stored offline, unheard), Aneurin bought £115 at the city depot at
   00:31 (head office still had £120). At 05:10 the line came back, the till sent its stored sale,
   and the slip showed -£105. The learner sets the cut, the offline rule, the sync interval, the
   clash rule and whether the till asks head office first while the line is up, then plays
   21:00 to 05:30 and reads each sale, both views of the balance, the money at risk, the slip and
   the wait per sale. Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so
   self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls line cut, offline rule (refuse all, £25 cap per
     card, last known balance), sync interval (60 or 5 minutes), clash rule (settle and flag,
     newest timestamp wins), ask head office first while the line is up; Play 21:00 to 05:30;
     Reset. Stats: balance at 21:00, Iestyn's sale, Aneurin's sale, card fuel sold in town, money
     approved without head office, the slip, below zero, fuel never charged, wait per town sale,
     head office's balance at 05:30, the night. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e06-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Times are minutes after 21:00 on Friday 15 January 2027: line cut at 40 (21:40), Iestyn at
     198 (00:18 Saturday), Aneurin at 211 (00:31), line back at 490 (05:10), end at 510 (05:30).
     Cut length 490 - 40 = 450 minutes = 7.5 hours.
   - Cynfael's account: £120 at head office; the till copies it at each sync (every 60 minutes from
     21:00 as built, so last copied at 21:00; every 5 minutes, last copied at 21:35).
   - As built: 120 - 110 = 10 on the till's list; head office 120 - 115 = 5; at 05:10,
     5 - 110 = -105 on the slip, flagged. Money approved without head office: 110.
   - £25 cap per card (counting only that card's offline spending, like a floor limit): £110 is
     over the cap, refused; Iestyn takes the £25 the cap allows. Head
     office 5; at 05:10, 5 - 25 = -20. At most 25 can be lost on his card.
   - Refuse all: no card fuel in town; head office 5; nothing stored, no slip.
   - Newest timestamp wins: at 05:10 the stored 00:18 sale clashes with the 00:31 sale (both spent
     the same £120); 00:31 is newer, so the 00:18 sale is dropped: the slip shows £5 and £110 of
     fuel is never charged (with the cap, £25).
   - No cut, ask first (as built while the line is up): Iestyn waits 400 ms, head office 120 -
     110 = 10, Aneurin's 115 refused. No cut, no asking: Iestyn approved on the till's list,
     sent at the next sync: 01:00 with 60 minutes (Aneurin approved at 00:31 first, slip -105 at
     01:00); 00:20 with 5 minutes (head office 10 before 00:31, Aneurin refused).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BASE = 21 * 60;          // minute 0 is 21:00
  var CUT_AT = 40;             // 21:40
  var BACK_AT = 490;           // 05:10
  var END_AT = 510;            // 05:30
  var BALANCE = 120;
  var CAP = 25;
  var ASK_MS = 400;
  var TOWN = { who: "Iestyn", where: "Cwmhelyg till", at: 198, amt: 110 };
  var CITY = { who: "Aneurin", where: "city depot", at: 211, amt: 115 };

  var CUTS = [
    { value: "cut", label: "cut 21:40 to 05:10 (as that night)" },
    { value: "none", label: "no cut" }
  ];
  var RULES = [
    { value: "last", label: "keep selling to the last known balance (as that night)" },
    { value: "cap", label: "a cap of £25 per card, bigger sales refused" },
    { value: "refuse", label: "refuse every card sale" }
  ];
  var SYNCS = [
    { value: "60", label: "every 60 minutes (as that night)" },
    { value: "5", label: "every 5 minutes" }
  ];
  var CLASHES = [
    { value: "flag", label: "settle in order of time, flag below zero (as that night)" },
    { value: "newest", label: "newest timestamp wins, the older sale is dropped" }
  ];
  var ASKS = [
    { value: "on", label: "on: ask before every sale, about 400 ms (as that night)" },
    { value: "off", label: "off: approve on the till's list, send at the next sync" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(m) {
    var t = (BASE + m) % 1440;
    return two(Math.floor(t / 60)) + ":" + two(t % 60);
  }
  function money(x) { return (x < 0 ? "-£" : "£") + Math.abs(x); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function lineUp(C, m) { return !(C.cut === "cut" && m >= CUT_AT && m < BACK_AT); }

  // Replays 21:00 to 05:30. Returns every line, every row of the table and every count.
  function night(C) {
    var every = Number(C.sync);
    var r = {
      lines: [], rows: [], town: "", city: "", fuel: 0, risk: 0, slip: null, below: 0, unpaid: 0,
      wait: 0, ho: BALANCE, how: ""
    };
    var ho = BALANCE;            // head office's balance
    var known = BALANCE;         // the till's list
    var knownAt = 0;             // when the till last heard head office
    var stored = [];             // sales held by the till, unheard
    var hoSales = [];            // sales head office approved itself
    var offSpent = 0;            // Iestyn's card, spent offline this outage
    var flagged = false;
    function line(m, text, tone) { r.lines.push({ m: m, text: text, tone: tone || "" }); }
    function row(m, where, what, answer) { r.rows.push([hhmm(m), where, what, money(ho), money(known), answer]); }

    function settle(m, why) {
      if (!stored.length) {
        known = ho;
        knownAt = m;
        return;
      }
      stored.forEach(function (s) {
        if (ho - s.amt >= 0 || C.clash === "flag") {
          ho -= s.amt;
          line(m, why + ": the till sends " + s.who + "'s stored " + money(s.amt) + " from " + hhmm(s.at) + ". Head office applies it: balance " + money(ho) + ".", ho < 0 ? "bad" : "ok");
          row(m, "head office", "applies stored " + money(s.amt), "balance " + money(ho));
          return;
        }
        var clash = null;
        hoSales.forEach(function (h) { if (h.at > s.knownAt) clash = h; });
        if (clash && clash.at > s.at) {
          r.unpaid += s.amt;
          line(m, why + ": " + s.who + "'s stored " + money(s.amt) + " from " + hhmm(s.at) + " clashes with " + clash.who + "'s " + money(clash.amt) + " at " + hhmm(clash.at) + ". The newest timestamp wins, so the " + hhmm(s.at) + " sale is dropped: " + money(s.amt) + " of fuel never charged.", "bad");
          row(m, "head office", "drops stored " + money(s.amt), "never charged");
        } else {
          ho -= s.amt;
          line(m, why + ": head office applies " + s.who + "'s stored " + money(s.amt) + ": balance " + money(ho) + ".", ho < 0 ? "bad" : "ok");
          row(m, "head office", "applies stored " + money(s.amt), "balance " + money(ho));
        }
      });
      stored = [];
      known = ho;
      knownAt = m;
      r.slip = ho;
      if (ho < 0) flagged = true;
      line(m, "The slip prints: account balance " + money(ho) + (ho < 0 ? ", BELOW ZERO, FLAGGED." : "."), ho < 0 ? "bad" : "ok");
    }

    function townSale(m) {
      var s = TOWN;
      if (lineUp(C, m) && C.ask === "on") {
        r.wait = ASK_MS;
        if (s.amt <= ho) {
          ho -= s.amt;
          known = ho;
          knownAt = m;
          r.town = money(s.amt) + " approved by head office";
          r.fuel += s.amt;
          line(m, s.who + " asks for " + money(s.amt) + ". The till asks head office first and waits " + ASK_MS + " ms. Approved: balance " + money(ho) + ".", "ok");
          row(m, s.where, s.who + " " + money(s.amt), "approved, asked first");
        } else {
          r.town = "refused by head office";
          line(m, s.who + " asks for " + money(s.amt) + ". Head office has " + money(ho) + ": refused.", "warn");
          row(m, s.where, s.who + " " + money(s.amt), "refused");
        }
        return;
      }
      var off = !lineUp(C, m);
      var rule = off ? C.rule : "last";
      // The cap works like a floor limit: it counts only this card's offline spending, not the list.
      var room = rule === "cap" ? CAP - offSpent : known;
      if (rule === "refuse") {
        r.town = "refused offline";
        line(m, s.who + " asks for " + money(s.amt) + ". The till is offline and refuses every card sale. No fuel for the town plough.", "warn");
        row(m, s.where, s.who + " " + money(s.amt), "refused offline");
        return;
      }
      var amt = s.amt;
      var note = "";
      if (amt > room) {
        if (rule === "cap" && room > 0) {
          amt = room;
          note = s.who + " asks for " + money(s.amt) + ". Over the " + money(CAP) + " cap: refused. He takes the " + money(amt) + " the cap allows.";
        } else {
          r.town = "refused";
          line(m, s.who + " asks for " + money(s.amt) + ". The till's list has " + money(known) + ": refused.", "warn");
          row(m, s.where, s.who + " " + money(s.amt), "refused");
          return;
        }
      }
      known -= amt;
      if (off) offSpent += amt;
      r.fuel += amt;
      r.risk += amt;
      stored.push({ who: s.who, at: m, amt: amt, knownAt: knownAt });
      var how = off ? "offline" : "on the till's list";
      r.town = money(amt) + " approved " + how;
      line(m, (note ? note + " " : s.who + " asks for " + money(amt) + ". ") + "The till's list shows " + money(known + amt) + ": approved " + how + ", stored to send later. Head office still has " + money(ho) + ".", "bad");
      row(m, s.where, s.who + " " + money(amt), "approved " + how + ", stored");
    }

    function citySale(m) {
      var s = CITY;
      if (s.amt <= ho) {
        ho -= s.amt;
        hoSales.push({ who: s.who, at: m, amt: s.amt });
        r.city = money(s.amt) + " approved";
        line(m, s.who + " asks for " + money(s.amt) + " at the city depot. Head office has " + money(ho + s.amt) + ": approved, balance " + money(ho) + "." + (stored.length ? " " + stored[0].who + "'s sale is still in the till, unheard." : ""), stored.length ? "bad" : "ok");
        row(m, s.where, s.who + " " + money(s.amt), "approved by head office");
      } else {
        r.city = "refused";
        line(m, s.who + " asks for " + money(s.amt) + " at the city depot. Head office has " + money(ho) + ": refused.", "warn");
        row(m, s.where, s.who + " " + money(s.amt), "refused");
      }
    }

    // Build the night's events in time order: syncs while the line is up, the cut, both sales, the return.
    var ev = [];
    for (var m = 0; m <= END_AT; m += every) ev.push({ m: m, k: 0 });
    if (C.cut === "cut") {
      ev.push({ m: CUT_AT, k: 1 });
      ev.push({ m: BACK_AT, k: 4 });
    }
    ev.push({ m: TOWN.at, k: 2 });
    ev.push({ m: CITY.at, k: 3 });
    ev.sort(function (a, b) { return (a.m - b.m) || (a.k - b.k); });

    line(0, "Head office holds " + money(BALANCE) + " on Cynfael's account. The till copies it at the 21:00 sync.", "");
    ev.forEach(function (e) {
      if (e.k === 0) {
        if (e.m === 0 || !lineUp(C, e.m) || (C.cut === "cut" && e.m === BACK_AT)) return;
        if (stored.length) settle(e.m, "Sync");
        else { known = ho; knownAt = e.m; }
      } else if (e.k === 1) {
        line(e.m, "The storm cuts the valley line. The till is offline; its list last heard head office at " + hhmm(knownAt) + ": " + money(known) + ".", "warn");
      } else if (e.k === 2) {
        townSale(e.m);
      } else if (e.k === 3) {
        citySale(e.m);
      } else if (e.k === 4) {
        line(e.m, "The line comes back after 7.5 hours.", "");
        settle(e.m, "Settling up");
      }
    });

    r.ho = ho;
    r.below = ho < 0 ? -ho : 0;
    if (r.slip === null) r.how = "no slip; card fuel in town " + money(r.fuel);
    else r.how = "slip " + money(r.slip) + (flagged ? ", flagged" : "") + (r.unpaid ? "; " + money(r.unpaid) + " of fuel never charged" : "");
    return r;
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
    ["time", "where", "sale", "head office has", "till's list has", "answer"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
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

  var KEYS = ["town", "city", "fuel", "risk", "slip", "below", "unpaid", "wait", "ho", "outcome"];

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Line: " + pick(CUTS, C.cut).label + ". Offline rule: " + pick(RULES, C.rule).label +
      ". Sync: " + pick(SYNCS, C.sync).label + ". Clashes: " + pick(CLASHES, C.clash).label +
      ". Ask first: " + pick(ASKS, C.ask).label + ".";
    clear(ui.body);
    S.stat.start(String(BALANCE));
    if (!S.ran) {
      ui.sum.textContent = "Not played yet: it is 21:00 and the line is up.";
      KEYS.forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var N = night(C);
    N.rows.forEach(function (rw) {
      var tr = ui.el("tr");
      rw.forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.body.appendChild(tr);
    });
    ui.sum.textContent = "The night: " + N.how + ".";
    S.stat.town(N.town);
    S.stat.city(N.city);
    S.stat.fuel(String(N.fuel));
    S.stat.risk(String(N.risk));
    S.stat.slip(N.slip === null ? "no slip" : String(N.slip));
    S.stat.below(String(N.below));
    S.stat.unpaid(String(N.unpaid));
    S.stat.wait(String(N.wait));
    S.stat.ho(String(N.ho));
    S.stat.outcome(N.how);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 21:00.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("21:00 to 05:30 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    N.lines.forEach(function (l) { api.log(hhmm(l.m) + " " + l.text, l.tone); });
    api.log("05:30: " + N.how + ".", N.below || N.unpaid ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { cut: "cut", rule: "last", sync: "60", clash: "flag", ask: "on" };
      S.ran = false;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("cut", "Valley line", CUTS, "cut");
      sel("rule", "Offline rule", RULES, "rule");
      sel("sync", "Sync while the line is up", SYNCS, "sync");
      sel("clash", "Clash rule when settling", CLASHES, "clash");
      sel("ask", "Ask head office first while the line is up", ASKS, "ask");
      api.control.button("run", "Play 21:00 to 05:30", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        start: api.stat("start", "balance at 21:00 (£)", ""),
        town: api.stat("town", "Iestyn's sale in town", ""),
        city: api.stat("city", "Aneurin's sale at the city depot", ""),
        fuel: api.stat("fuel", "card fuel sold in town (£)", "ok"),
        risk: api.stat("risk", "approved without head office: money at risk (£)", "warn"),
        slip: api.stat("slip", "the slip's balance (£)", "bad"),
        below: api.stat("below", "below zero, flagged (£)", "bad"),
        unpaid: api.stat("unpaid", "fuel never charged (£)", "bad"),
        wait: api.stat("wait", "wait per town sale (ms)", ""),
        ho: api.stat("ho", "head office's balance at 05:30 (£)", ""),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> Each row of the table is one moment of the night: a sale, or a stored sale reaching head office. The two balance columns show the same account as head office sees it and as the town till's own list sees it, after that moment. While the line is cut the two can disagree, and both can say yes.");

      api.log("Friday 15 January 2027, 21:00, as built: line up, the till asks head office first, offline rule last known balance.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: 21:00, before the cut.
      t.expect(t.stat("start") === 120 && t.stat("slip") === "not run yet" && t.stat("town") === "not run yet" &&
        has("offline rule last known balance."),
        "Opens at 21:00 before the cut: £120 on the account, nothing played");

      // 2. As built: both sales approved, the slip shows -£105.
      t.click("run");
      t.expect(t.stat("town") === "£110 approved offline" && t.stat("city") === "£115 approved" &&
        t.stat("slip") === -105 && t.stat("below") === 105 && t.stat("risk") === 110 && t.stat("wait") === 0 &&
        has("00:31 Aneurin asks for £115 at the city depot. Head office has £120: approved, balance £5. Iestyn's sale is still in the till, unheard.") &&
        has("05:10 The slip prints: account balance -£105, BELOW ZERO, FLAGGED."),
        "As built: £110 offline in town, £115 at the depot, slip -£105, £110 at risk");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("has already played."), "A second play is refused");

      // 4. Option 0: a £25 cap per card.
      t.set("rule", "cap");
      t.click("run");
      t.expect(t.stat("town") === "£25 approved offline" && t.stat("fuel") === 25 && t.stat("slip") === -20 &&
        t.stat("below") === 20 && t.stat("risk") === 25 && has("Over the £25 cap: refused. He takes the £25 the cap allows."),
        "Cap: £110 refused, £25 sold, slip -£20, no more than £25 at risk");

      // 5. Option 1: refuse every card sale.
      t.set("rule", "refuse");
      t.click("run");
      t.expect(t.stat("town") === "refused offline" && t.stat("fuel") === 0 && t.stat("slip") === "no slip" &&
        t.stat("ho") === 5 && t.stat("below") === 0,
        "Refuse all: no card fuel in town, no slip, head office ends at £5");
      t.set("rule", "last");

      // 6. Option 2: sync every 5 minutes changes nothing during the cut.
      t.set("sync", "5");
      t.click("run");
      t.expect(t.stat("slip") === -105 && has("its list last heard head office at 21:35: £120."),
        "Sync every 5 minutes: last copy at 21:35, still £120, slip still -£105");
      t.set("sync", "60");

      // 7. Option 3: the newest timestamp drops Iestyn's sale.
      t.set("clash", "newest");
      t.click("run");
      t.expect(t.stat("slip") === 5 && t.stat("unpaid") === 110 && t.stat("below") === 0 &&
        has("The newest timestamp wins, so the 00:18 sale is dropped: £110 of fuel never charged."),
        "Newest timestamp: slip £5, nothing flagged, £110 of fuel never charged");
      t.set("rule", "cap");
      t.click("run");
      var capNewest = t.stat("unpaid");
      t.set("rule", "last");
      t.set("clash", "flag");

      // 8. No cut, asking first: 400 ms per sale and nobody overspends.
      t.set("cut", "none");
      t.click("run");
      t.expect(capNewest === 25 && t.stat("wait") === 400 && t.stat("town") === "£110 approved by head office" &&
        t.stat("city") === "refused" && t.stat("slip") === "no slip" && t.stat("ho") === 10,
        "No cut, ask first: Iestyn waits 400 ms, Aneurin is refused, balance £10");

      // 9. No cut, no asking: the hourly sync is too slow; every 5 minutes is not.
      t.set("ask", "off");
      t.click("run");
      var hourly = t.stat("slip");
      var hourlyLine = has("01:00 Sync: the till sends Iestyn's stored £110 from 00:18. Head office applies it: balance -£105.");
      t.set("sync", "5");
      t.click("run");
      t.expect(hourly === -105 && hourlyLine && t.stat("wait") === 0 && t.stat("city") === "refused" && t.stat("slip") === 10,
        "No cut, no asking: hourly sync gives -£105 with no storm; 5-minute sync settles at 00:20 and Aneurin is refused");

      // 10. With the line cut, the cap never loses more than £25, whatever else is set.
      var worst = 0;
      SYNCS.forEach(function (s) { CLASHES.forEach(function (c) { ASKS.forEach(function (a) {
        var n = night({ cut: "cut", rule: "cap", sync: s.value, clash: c.value, ask: a.value });
        worst = Math.max(worst, n.below + n.unpaid);
      }); }); });
      t.expect(worst === 25, "Line cut, cap on: never more than £25 lost under any other setting");

      // 11. With the line cut, last known balance always lets both sales through.
      var both = true;
      SYNCS.forEach(function (s) { CLASHES.forEach(function (c) { ASKS.forEach(function (a) {
        var n = night({ cut: "cut", rule: "last", sync: s.value, clash: c.value, ask: a.value });
        if (n.fuel !== 110 || n.city !== "£115 approved") both = false;
      }); }); });
      t.expect(both, "Line cut, last known balance: both sales go through under every other setting");
    }
  });
})();
