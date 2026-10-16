/* sims/s9e13-v1.0.1.js  (published as sims/s9e13.js)
   v1.0.1 (2026-10-16) the lane is renamed Withybed Lane (the old name sat inside a4e06's mill).
   Case s9e13 "Counting Clicks": a window lab for the council's toad dashboard on Withybed Lane, the
   night of Thursday 5 March into Friday 6 March 2026. Volunteers tap a phone app once for each toad
   they carry across. A phone in signal sends each tap at once; a phone out of signal (the new
   reservoir stretch) keeps its taps and sends them when it walks back into signal. As built, the
   dashboard counts each tap in the hour it arrives (processing time) and sends the warden a
   closure order when the current hour passes 50. The learner chooses what to count by (arrival or
   tap time), the watermark (none, or up to 3 hours), dropping taps over 10 minutes late, a morning-
   only count, clock sync and 3-hour smoothing, then steps the night from 21:00 to 03:00 in
   5-minute steps and reads each hour's count as first shown and as updated, the closure and the
   late taps. A second night, last spring's busiest (every stretch in signal), shows what a live
   count is for.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls night (tonight, last spring's busiest), count by
     (arrival time as built, tap time), watermark (none, up to 3 hours), drop taps over 10 minutes
     late, morning-only count, clock sync, smoothing over 3 hours; step 5 minutes, step 1 hour,
     play to 03:00, reset. Stats: time, air, watermark, this hour's count, the 21:00, 22:00 and
     01:00 hours now, the 22:00 hour as first shown, taps arrived, taps still on phones, taps set
     aside, closure, past hours corrected, tap times moved by clock sync. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e13-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Tonight: toads crossed only between 22:00 and 23:00. Reservoir stretch (phones 21 and 22,
     no signal) taps per 5 minutes from 22:00: 14, 22, 30, 36, 40, 42, 38, 34, 30, 24, 18, 12 = 340.
     They all arrive in the 01:00 to 01:05 step, when the two volunteers walk back up into signal
     at the end of their 22:00 to 01:00 shift. Other stretches (in signal) per 5 minutes from
     22:00: 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 0 = 12, each arriving within 2 seconds (same step).
     340 + 12 = 352.
   - Air by the hour, tonight: 21:00 8, 22:00 7, 23:00 5, 00:00 3, 01:00 2, 02:00 1, 03:00 0 °C.
     Toads do not move below about 5 °C, so none cross after 23:00.
   - The rule: close the lane when the hour's count passes 50 (51 or more). The dashboard checks at
     the end of every 5-minute step, against the current hour (the hour the step is in).
   - As built (arrival time): the 22:00 hour gets 12; the 01:00 to 01:05 step gets 340, so the
     01:00 hour reads 340 at 01:05 and the closure order goes at 01:05, at 2 °C.
   - Tap time, watermark up to 3 hours: an hour stays open until 3 hours after it ends (the
     longest any phone can be out of signal is one reservoir shift, 3 hours). The 22:00 hour is
     first shown at 23:00 as 12, corrected to 352 at 01:05, final at 02:00. The 01:00 hour reads 0.
     A corrected past hour never closes the lane; it is logged for the next warm night's plan.
   - Tap time, no watermark: each hour is final the moment it ends; later taps for it are set
     aside. The 340 arrive after 23:00 and are set aside: 22:00 hour 12, 01:00 hour 0.
   - Drop taps over 10 minutes late: the 340 are between 2 and 3 hours late and are thrown away.
   - Clock sync: every phone clock was already within 1 second of the council's (given), so no tap
     moves to another hour: tap times moved 0.
   - Smoothing: the check uses the average of the current hour and the two before it (hours before
     21:00 count 0). Tonight at 01:05: (0 + 0 + 340) / 3 = 113, over 50: closed at 01:05.
   - Morning-only: nothing is counted live and no closure is sent; at 07:00, with every phone in,
     each tap is counted in the hour it was tapped: 22:00 hour 352.
   - Last spring's busiest night (every stretch in signal, taps arrive in the step they are made):
     21:00 hour per 5 minutes 3, 4, 5, 6, 7, 8, 6, 5, 6, 5, 5, 4 = 64; 22:00 hour 5, 4, 4, 3, 3, 3,
     2, 2, 2, 1, 1, 0 = 30. Air: 9, 7, 5, 4, 3, 3, 2 °C. Running count of the 21:00 hour: 50 at
     21:45, 55 at 21:50, so the lane closed at 21:50 at 9 °C. Smoothed at 21:50: 55 / 3 = 18, and
     at most (0 + 64 + 30) / 3 = 31 later: never over 50, never closed. Morning-only: no closure.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (minutes after 00:00 Thursday) ---------- */

  var START = 1260;         // 21:00
  var END = 1620;           // 03:00
  var STEP = 5;
  var LIMIT = 50;           // close when the hour passes 50
  var WAIT = 180;           // the watermark: an hour stays open 3 hours after it ends
  var DROP = 10;            // drop taps more than 10 minutes late

  var NIGHTS = {
    tonight: {
      label: "Thursday 5 March, tonight",
      air: [8, 7, 5, 3, 2, 1, 0],
      groups: [
        { from: 1320, per: [14, 22, 30, 36, 40, 42, 38, 34, 30, 24, 18, 12], arrive: 1500, where: "reservoir" },
        { from: 1320, per: [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 0], arrive: null, where: "signal" }
      ]
    },
    spring: {
      label: "last spring's busiest night, every stretch in signal",
      air: [9, 7, 5, 4, 3, 3, 2],
      groups: [
        { from: 1260, per: [3, 4, 5, 6, 7, 8, 6, 5, 6, 5, 5, 4], arrive: null, where: "signal" },
        { from: 1320, per: [5, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 0], arrive: null, where: "signal" }
      ]
    }
  };

  var NIGHT_OPTS = [
    { value: "tonight", label: "tonight: Thursday 5 March (as built)" },
    { value: "spring", label: "last spring's busiest night, every stretch in signal" }
  ];
  var BY_OPTS = [
    { value: "arrival", label: "arrival time: the hour the tap reaches the council (as built)" },
    { value: "tap", label: "tap time: the hour the toad was tapped" }
  ];
  var WM_OPTS = [
    { value: "none", label: "none: each hour is final the moment it ends (as built)" },
    { value: "3h", label: "up to 3 hours: each hour stays open 3 hours after it ends" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(m) { return two(Math.floor(m / 60) % 24) + ":" + two(m % 60); }
  function hourOf(m) { return Math.floor(m / 60) * 60; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function airAt(night, m) { return NIGHTS[night].air[Math.floor((m - START) / 60)]; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // Every 5-minute bundle of taps: when tapped (step start), when it arrives (step start), how many.
  function taps(night) {
    var out = [];
    NIGHTS[night].groups.forEach(function (g) {
      g.per.forEach(function (n, i) {
        if (!n) return;
        var t = g.from + i * STEP;
        out.push({ t: t, a: g.arrive === null ? t : g.arrive, n: n, where: g.where });
      });
    });
    return out;
  }

  /* ---------- the model (a pure replay the display and self-tests read) ---------- */

  function replay(C, T) {
    var hours = {};
    var h;
    for (h = START; h < END; h += 60) hours[h] = { now: 0, first: null, final: false };
    var r = { hours: hours, arrived: 0, held: 0, aside: 0, closure: null, closureAir: null, corrected: [], ev: [] };
    var all = taps(C.night);
    function ev(t, text, tone) { r.ev.push({ t: t, text: text, tone: tone || "" }); }
    function closeAt(hr) { return hr + 60 + (C.by === "tap" && C.wm === "3h" ? WAIT : 0); }

    for (var s = START; s < T; s += STEP) {
      var e = s + STEP;
      var cur = hourOf(s);
      var fixedNow = {};
      all.forEach(function (x) {
        if (x.a !== s) return;
        r.arrived += x.n;
        var lateBy = x.a - x.t;
        var span = hhmm(x.t) + " to " + hhmm(x.t + STEP);
        var who = x.where === "reservoir" ? "from the reservoir stretch" : "from stretches in signal";
        if (C.morning) {
          if (lateBy > 0) ev(e, hhmm(e) + " " + plural(x.n, "tap", "taps") + " " + who + " (tapped " + span + ") arrive; the morning count will take them.");
          return;
        }
        if (C.drop && lateBy > DROP) {
          r.aside += x.n;
          ev(e, hhmm(e) + " " + plural(x.n, "tap", "taps") + " " + who + " (tapped " + span + ") arrive more than 10 minutes late and are thrown away.", "bad");
          return;
        }
        var target = C.by === "tap" ? hourOf(x.t) : cur;
        if (C.by === "tap" && s >= closeAt(target)) {
          r.aside += x.n;
          ev(e, hhmm(e) + " " + plural(x.n, "tap", "taps") + " " + who + " (tapped " + span + ") arrive after the " + hhmm(target) +
            " hour was final at " + hhmm(closeAt(target)) + ": set aside as too late.", "bad");
          return;
        }
        var before = hours[target].now;
        hours[target].now += x.n;
        if (target < cur) {
          if (!fixedNow[target]) fixedNow[target] = before;
        } else if (lateBy > 0) {
          ev(e, hhmm(e) + " " + plural(x.n, "tap", "taps") + " " + who + " (tapped " + span + ") arrive and count in the " + hhmm(target) + " hour: now " + hours[target].now + ".", "warn");
        }
      });
      Object.keys(fixedNow).forEach(function (k) {
        var hr = Number(k);
        var was = fixedNow[k];
        r.corrected.push(hhmm(hr) + " hour: " + was + " to " + hours[hr].now);
        ev(e, hhmm(e) + " late taps correct the " + hhmm(hr) + " hour: " + was + " to " + hours[hr].now + ". A past hour" +
          (hours[hr].now > LIMIT ? " over 50 is logged for the next warm night's plan; no closure, air " + airAt(C.night, s) + " °C." : " is logged; no closure."), "ok");
      });
      // the closure check, at the end of every step
      if (!C.morning && r.closure === null) {
        var val = hours[cur].now;
        var how = "the " + hhmm(cur) + " hour reads " + val;
        if (C.smooth) {
          var p1 = hours[cur - 60] ? hours[cur - 60].now : 0;
          var p2 = hours[cur - 120] ? hours[cur - 120].now : 0;
          var sum = val + p1 + p2;
          val = sum / 3;
          how = "the 3-hour average reads " + Math.round(val) + " (" + p2 + " + " + p1 + " + " + hours[cur].now + ", over 3)";
        }
        if (val > LIMIT) {
          r.closure = e;
          r.closureAir = airAt(C.night, s);
          ev(e, hhmm(e) + " closure order: " + how + ", over 50. The warden is texted to close Withybed Lane. Air " + r.closureAir + " °C.", "bad");
        }
      }
      // an hour ends: first shown
      if (e % 60 === 0 && hours[e - 60]) {
        var hh = hours[e - 60];
        hh.first = C.morning ? null : hh.now;
        if (!C.morning) ev(e, hhmm(e) + " the " + hhmm(e - 60) + " hour ends: shown as " + hh.now + ".");
      }
      // hours that become final
      Object.keys(hours).forEach(function (k) {
        var hr = Number(k);
        if (!C.morning && C.by === "tap" && C.wm === "3h" && closeAt(hr) === e) {
          hours[hr].final = true;
          ev(e, hhmm(e) + " the watermark passes the end of the " + hhmm(hr) + " hour: final at " + hours[hr].now + ".");
        } else if (closeAt(hr) <= e && !(C.by === "tap" && C.wm === "3h")) {
          hours[hr].final = true;
        }
      });
    }
    all.forEach(function (x) { if (x.t < T && x.a >= T) r.held += x.n; });
    return r;
  }

  function morningCount(C) {
    var byHour = {};
    for (var h = START; h < END; h += 60) byHour[h] = 0;
    taps(C.night).forEach(function (x) { byHour[hourOf(x.t)] += x.n; });
    return Object.keys(byHour).map(function (k) { return hhmm(Number(k)) + " hour " + byHour[k]; }).join(", ");
  }

  function watermarkText(C, T) {
    if (C.morning) return "not used";
    if (C.by !== "tap") return "not used";
    if (C.wm === "none") return hhmm(T);
    return hhmm(T - WAIT);
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
    var lane = el("p", "margin:0;font-size:13px;font-weight:600;");
    box.appendChild(lane);
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["hour", "air", "first shown", "now", "state"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { el: el, head: head, lane: lane, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = replay(C, S.t);
    S.r = r;
    var ui = S.ui;
    ui.head.textContent = hhmm(S.t) + ", " + NIGHTS[C.night].label + ". Counting by " + (C.morning ? "nothing live (morning count only)" : pick(BY_OPTS, C.by).label) +
      ". Watermark: " + (C.by === "tap" && !C.morning ? pick(WM_OPTS, C.wm).label : "not used") + "." +
      (C.drop ? " Taps over 10 minutes late are thrown away." : "") + (C.smooth ? " The check uses a 3-hour average." : "") +
      (C.sync ? " Phone clocks synced to the council's." : "");
    ui.lane.textContent = r.closure === null ? "Withybed Lane: open." : "Withybed Lane: closed at " + hhmm(r.closure) + ", air " + r.closureAir + " °C.";
    clear(ui.tbody);
    Object.keys(r.hours).forEach(function (k) {
      var hr = Number(k);
      var hh = r.hours[k];
      var state;
      if (C.morning) state = "not counted live";
      else if (S.t <= hr) state = "not yet";
      else if (hh.final) state = "final";
      else state = "open";
      var tr = ui.el("tr");
      [hhmm(hr), airAt(C.night, hr) + " °C", hh.first === null ? "-" : String(hh.first), C.morning ? "-" : String(hh.now), state].forEach(function (c) {
        tr.appendChild(ui.el("td", "", c));
      });
      ui.tbody.appendChild(tr);
    });
    var cur = hourOf(Math.min(S.t, END - STEP));
    S.stat.time(hhmm(S.t));
    S.stat.air(airAt(C.night, S.t) + " °C");
    S.stat.wm(watermarkText(C, S.t));
    S.stat.hour(C.morning ? "not counted live" : r.hours[cur].now);
    S.stat.h21(r.hours[1260].now);
    S.stat.h22(r.hours[1320].now);
    S.stat.h01(r.hours[1500].now);
    S.stat.first22(r.hours[1320].first === null ? "not yet shown" : r.hours[1320].first);
    S.stat.arrived(r.arrived);
    S.stat.held(r.held);
    S.stat.aside(r.aside);
    S.stat.closure(r.closure === null ? "none" : hhmm(r.closure) + " at " + r.closureAir + " °C");
    S.stat.corrected(r.corrected.length ? r.corrected.join("; ") : "none");
    S.stat.moved(0);
  }

  function logBetween(api, from, to) {
    var r = replay(api.state.C, to);
    r.ev.forEach(function (e) { if (e.t > from && e.t <= to) api.log(e.text, e.tone); });
  }

  function closing(api) {
    var C = api.state.C;
    var r = replay(C, END);
    if (C.morning) {
      api.log("03:00 the patrol ends. At 07:00, with every phone in, the morning count takes each tap in the hour it was tapped: " +
        morningCount(C) + ". No closure order was sent all night.", "warn");
      return;
    }
    api.log("03:00 the patrol ends: " + r.arrived + " taps arrived, " + r.aside + " set aside or thrown away; closure " +
      (r.closure === null ? "none" : "at " + hhmm(r.closure) + ", air " + r.closureAir + " °C") + ".", r.closure !== null && r.closureAir < 5 ? "bad" : "");
  }

  function advance(api, to) {
    var S = api.state;
    if (S.t >= END) {
      api.log("It is 03:00. Change a setting or reset to replay the night.", "");
      return;
    }
    if (to > END) to = END;
    logBetween(api, S.t, to);
    S.t = to;
    if (to === END) closing(api);
    draw(api);
  }

  function change(api, what) {
    api.state.t = START;
    api.log(what + " Back to 21:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e13", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { night: "tonight", by: "arrival", wm: "none", drop: false, morning: false, sync: false, smooth: false };
      S.t = START;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key, on1, off1) {
        api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          change(api, on ? on1 : off1);
        });
      }
      sel("night", "night", NIGHT_OPTS, "night");
      sel("by", "count each tap by", BY_OPTS, "by");
      sel("wm", "watermark (when counting by tap time)", WM_OPTS, "wm");
      tog("drop", "throw away taps more than 10 minutes late", "drop", "Taps more than 10 minutes late are thrown away.", "Late taps are kept.");
      tog("morning", "count once in the morning, after every phone is in", "morning", "Morning-only count: nothing is counted live.", "Live counting is back.");
      tog("sync", "sync every phone clock to the council's clock", "sync", "Every phone clock is synced to the council's. Each was already within 1 second, so no tap changes hour.", "Clock sync is off.");
      tog("smooth", "smooth: check the average of the last 3 hours", "smooth", "The closure check now uses the average of this hour and the two before it.", "The closure check uses this hour again.");
      api.control.button("step", "step 5 minutes", function () { advance(api, api.state.t + STEP); });
      api.control.button("hour", "step 1 hour", function () { advance(api, api.state.t + 60); });
      api.control.button("play", "play to 03:00", function () { advance(api, END); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        air: api.stat("air", "air", ""),
        wm: api.stat("wm", "watermark: tap times complete up to", ""),
        hour: api.stat("hour", "this hour's count", ""),
        h21: api.stat("h21", "21:00 hour now", ""),
        h22: api.stat("h22", "22:00 hour now", "ok"),
        first22: api.stat("first22", "22:00 hour as first shown", ""),
        h01: api.stat("h01", "01:00 hour now", "warn"),
        arrived: api.stat("arrived", "taps arrived", ""),
        held: api.stat("held", "taps still on phones", "warn"),
        aside: api.stat("aside", "taps set aside or thrown away", "bad"),
        closure: api.stat("closure", "closure order", "bad"),
        corrected: api.stat("corrected", "past hours corrected", "ok"),
        moved: api.stat("moved", "tap times moved by clock sync", "")
      };

      api.info("<strong>How to read it.</strong> Each step is 5 minutes of the night. A volunteer taps once per toad, and the phone records the tap time by its own clock. In signal the tap arrives at once; on the reservoir stretch it waits on the phone until the volunteer walks back into signal. Each hour is a box: it opens on the hour, taps fall in, it ends, and once it is final its count no longer changes. Counting by arrival time puts a tap in the hour it reaches the council; counting by tap time puts it in the hour the toad crossed. At the end of every step the dashboard checks the current hour and sends a closure order if it is over 50.");

      api.log("Thursday 5 March, 21:00: the patrol starts on Withybed Lane, air 8 °C and raining. No taps yet.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var BUILT = { night: "tonight", by: "arrival", wm: "none", drop: false, morning: false, sync: false, smooth: false };
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      function fresh(set) { as(BUILT); as(set || {}); t.click("play"); }

      // 1. Opening state: 21:00, nothing tapped, nothing arrived; the given data sums to 340 and 12.
      var g = NIGHTS.tonight.groups;
      var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      t.expect(t.stat("time") === "21:00" && t.stat("air") === "8 °C" && t.stat("arrived") === 0 && t.stat("held") === 0 &&
        t.stat("closure") === "none" && sum(g[0].per) === 340 && sum(g[1].per) === 12 && has("Thursday 5 March, 21:00: the patrol starts"),
        "Opens at 21:00 on Thursday 5 March, 8 °C, no taps; the reservoir's taps sum to 340 and the others to 12");

      // 2. As built, to 23:00: the 22:00 hour is shown as 12 and 340 taps wait on the two phones.
      t.click("hour");
      t.click("hour");
      t.expect(t.stat("time") === "23:00" && t.stat("first22") === 12 && t.stat("h22") === 12 && t.stat("held") === 340 &&
        t.stat("closure") === "none" && has("23:00 the 22:00 hour ends: shown as 12."),
        "As built at 23:00: the 22:00 hour ends at 12, the lane stays open, 340 taps still on the reservoir phones");

      // 3. As built, played to 03:00: 340 in the 01:00 hour and a closure at 01:05 at 2 °C.
      fresh({});
      t.expect(t.stat("h22") === 12 && t.stat("h01") === 340 && t.stat("arrived") === 352 && t.stat("held") === 0 &&
        t.stat("closure") === "01:05 at 2 °C" &&
        has("01:05 closure order: the 01:00 hour reads 340, over 50. The warden is texted to close Withybed Lane. Air 2 °C."),
        "As built: 22:00 hour 12, 01:00 hour 340, closure order at 01:05 at 2 °C");

      // 4. The fix: tap time, watermark up to 3 hours.
      fresh({ by: "tap", wm: "3h" });
      t.expect(t.stat("first22") === 12 && t.stat("h22") === 352 && t.stat("h01") === 0 && t.stat("closure") === "none" &&
        t.stat("aside") === 0 && t.stat("corrected") === "22:00 hour: 12 to 352" &&
        has("01:05 late taps correct the 22:00 hour: 12 to 352. A past hour over 50 is logged for the next warm night's plan; no closure, air 2 °C.") &&
        has("02:00 the watermark passes the end of the 22:00 hour: final at 352."),
        "Tap time, up to 3 hours: the 22:00 hour first shown 12, corrected to 352 at 01:05, final at 02:00; 01:00 hour 0, no frost closure");

      // 5. Tap time with no watermark: the hour is final at 23:00 and the 340 are set aside.
      fresh({ by: "tap", wm: "none" });
      t.expect(t.stat("h22") === 12 && t.stat("h01") === 0 && t.stat("aside") === 340 && t.stat("closure") === "none" &&
        has("arrive after the 22:00 hour was final at 23:00: set aside as too late."),
        "Tap time, no watermark: the 340 arrive after the hour is final and are set aside");

      // 6. Option 2: drop taps more than 10 minutes late.
      fresh({ drop: true });
      t.expect(t.stat("aside") === 340 && t.stat("h22") === 12 && t.stat("h01") === 0 && t.stat("closure") === "none" &&
        has("arrive more than 10 minutes late and are thrown away."),
        "Drop over 10 minutes late: all 340 reservoir taps thrown away, no closure");

      // 7. Option 1: clock sync changes nothing.
      fresh({ sync: true });
      t.expect(t.stat("h22") === 12 && t.stat("h01") === 340 && t.stat("closure") === "01:05 at 2 °C" && t.stat("moved") === 0 &&
        has("Each was already within 1 second, so no tap changes hour."),
        "Clock sync: every phone clock was right; still 340 in the 01:00 hour and the frost closure at 01:05");

      // 8. Option 3: the morning count is right and closes nothing.
      fresh({ morning: true });
      t.expect(t.stat("closure") === "none" &&
        has("07:00, with every phone in, the morning count takes each tap in the hour it was tapped: 21:00 hour 0, 22:00 hour 352, 23:00 hour 0, 00:00 hour 0, 01:00 hour 0, 02:00 hour 0. No closure order was sent all night."),
        "Morning-only: 22:00 hour 352 at 07:00, no live closure");

      // 9. Smoothing over 3 hours still closes in frost.
      fresh({ smooth: true });
      t.expect(t.stat("closure") === "01:05 at 2 °C" && has("the 3-hour average reads 113 (0 + 0 + 340, over 3), over 50"),
        "Smoothing: 340 / 3 = 113 at 01:05, still a frost closure");

      // 10. Last spring, as built: every stretch in signal, 64 in the 21:00 hour, closed at 21:50.
      fresh({ night: "spring" });
      t.expect(t.stat("h21") === 64 && t.stat("h22") === 30 && t.stat("closure") === "21:50 at 9 °C" &&
        has("21:50 closure order: the 21:00 hour reads 55, over 50."),
        "Last spring's busiest night: 64 in the 21:00 hour, closed live at 21:50 at 9 °C");

      // 11. Last spring, morning-only: right in the morning, no live closure.
      fresh({ night: "spring", morning: true });
      t.expect(t.stat("closure") === "none" && has("the hour it was tapped: 21:00 hour 64, 22:00 hour 30,"),
        "Last spring, morning-only: 64 counted at 07:00, the lane never closed");

      // 12. Last spring, smoothing: the average never passes 50, so the lane never closes.
      fresh({ night: "spring", smooth: true });
      var sm = t.stat("closure") === "none";
      fresh({ night: "spring", by: "tap", wm: "3h" });
      t.expect(sm && t.stat("closure") === "21:50 at 9 °C" && t.stat("h21") === 64,
        "Last spring: smoothing never closes; tap time with the watermark closes at 21:50 as before");
    }
  });
})();
