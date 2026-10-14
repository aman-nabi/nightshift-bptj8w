/* sims/s6e06-v1.0.0.js  (published as sims/s6e06.js)
   Case s6e06 "Promises": a promise lab for Cadwallader's, a funeral home that streams every
   service live through a streaming company, Streamwell. The learner replays September 2026 a day
   at a time and chooses when Streamwell's updates start, which minutes the promise counts (the
   SLI), the target, Streamwell's budget rule, and a second stream server. A month calendar shows
   each service and each update; the stats show percent up by both measures, the budget left, and
   which services showed families a frozen picture.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: update time 02:00 (until August), 10:30 (September) or 19:00
     (evening); SLI all minutes in the month or live minutes (minutes a service is streamed);
     target 99%, 99.9% or 99.99%; budget rule on or off; second stream server on or off. Buttons:
     next day, next week, run to the report, start the month again, reset. Stats: date, minutes
     counted, minutes down (all), percent up (all), minutes down (live), percent up (live), budget,
     budget left, services hit, frozen services, updates held, promise, refund. selfTest: 10
     assertions.

   The model (stated in sim.lede and the post):
   - September 2026 has 30 days, 43,200 minutes. 1 September is a Tuesday; 1 October a Thursday.
   - Services: every weekday (22 of them) at 10:30 for 60 minutes; a second at 14:00 for 60 minutes
     on 1, 3, 7, 10, 14, 17, 21, 23 and 28 September (9). 31 services, 31 x 60 = 1,860 live minutes.
   - Streamwell ran three updates in September, on Tue 8, Wed 16 and Thu 24. Each installs for about
     half an hour from its start time, then the stream server restarts and the stream is down:
     8 Sep: restart 34 min after the start, 9 min down; 16 Sep: 32 min, 8 min; 24 Sep: 35 min, 9 min.
   - Budget = minutes counted x (100% - target). Budget left = budget - minutes down by that measure.
   - Budget rule (Streamwell's): before each update, if the budget left is 0 or less, the update is
     held until next month. Otherwise it goes ahead.
   - Second stream server: Streamwell updates every server in the same minute, so the spare restarts
     with the first. It changes no minute.
   - Refund: the contract refunds 10% of the month's fee when percent up falls below the target.
     Shown for the chosen measure and target, so the learner can see what each contract would owe.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e06-v1.0.0.json):
   - All minutes, 99.9%: budget 43,200 x 0.1% = 43.2. 9 + 8 + 9 = 26 down. 43,174 / 43,200 = 99.94%.
     Left 43.2 - 26 = 17.2. Promise kept, refund none (the post's monthly report).
   - Live minutes, 10:30: 8 Sep 11:04 to 11:13, 16 Sep 11:02 to 11:10, 24 Sep 11:05 to 11:14, each
     inside its 10:30 to 11:30 service: 26 live minutes down, 1,834 / 1,860 = 98.6%. 3 of 31 services.
     Budget at 99.9%: 1.86, left 1.86 - 26 = -24.14, broken.
   - 02:00 (as until August) or 19:00: restarts at 02:34 / 02:32 / 02:35 or 19:34 / 19:32 / 19:35,
     no service live: 0 live minutes down, 100%. All minutes still 26 down, 99.94%.
   - Live minutes, rule on, 10:30: 8 Sep goes (1.86 left before it), 9 down, left -7.14; 16 and 24 Sep
     held. 1 frozen service, live 1,851 / 1,860 = 99.52%, all minutes 43,191 / 43,200 = 99.98%.
   - All minutes, 99.99%: budget 4.32, left 4.32 - 26 = -21.68, broken, refund 10% of the fee.
     Rule on: the first update spends it (left -4.68), the other two are held, at 10:30 or at 02:00.
   - Live minutes, 99%: budget 18.6, left 18.6 - 26 = -7.4. Rule on holds nothing (1.6 left before
     the 24 Sep update).
   Minutes are kept in thousandths (integers) so no sum is off by floating-point dust.
*/
(function () {
  "use strict";

  var DAYS = 30;
  var MONTH_MIN = 43200;
  var SECOND = [1, 3, 7, 10, 14, 17, 21, 23, 28];
  var UPDATES = [
    { d: 8, off: 34, dur: 9 },
    { d: 16, off: 32, dur: 8 },
    { d: 24, off: 35, dur: 9 }
  ];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var TIMES = [
    { value: "1030", label: "10:30 on weekdays (September)", min: 630 },
    { value: "0200", label: "02:00 (as until August)", min: 120 },
    { value: "1900", label: "19:00 (evening, staff still on)", min: 1140 }
  ];
  var SLIS = [
    { value: "all", label: "All minutes in the month (the contract)" },
    { value: "live", label: "Live minutes (a service is streamed)" }
  ];
  var TARGETS = [
    { value: 9990, label: "99.9% (the contract)" },
    { value: 9999, label: "99.99% (four nines)" },
    { value: 9900, label: "99%" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hm(m) { return two(Math.floor(m / 60)) + ":" + two(m % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dow(d) { return (d + 1) % 7; }   // 1 September 2026 is a Tuesday (2)
  function weekday(d) { var w = dow(d); return w !== 0 && w !== 6; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  // Thousandths of a minute to text: 17200 -> "17.2", -7140 -> "-7.14", 186 -> "0.186".
  function km(k) {
    var neg = k < 0;
    var a = Math.abs(k);
    var s = String(Math.floor(a / 1000));
    var f = two(Math.floor((a % 1000) / 10)) + String(a % 10);
    f = f.replace(/0+$/, "");
    return (neg ? "-" : "") + s + (f ? "." + f : "");
  }
  // Percent up to two decimals, trailing zeros dropped: "99.94%", "98.6%", "100%".
  function pct(total, down) {
    var s = ((total - down) * 100 / total).toFixed(2).replace(/\.?0+$/, "");
    return s + "%";
  }
  function tgtText(T) { return (T / 100).toFixed(2).replace(/\.?0+$/, "") + "%"; }

  /* ---------- the month (pure data) ---------- */

  function services() {
    var out = [];
    for (var d = 1; d <= DAYS; d++) {
      if (!weekday(d)) continue;
      out.push({ d: d, start: 630, end: 690 });
      if (SECOND.indexOf(d) >= 0) out.push({ d: d, start: 840, end: 900 });
    }
    return out;
  }
  var SERVICES = services();
  var LIVE_MIN = SERVICES.length * 60;

  function counted(C) { return C.sli === "live" ? LIVE_MIN : MONTH_MIN; }
  function budgetK(C) { return counted(C) * (10000 - C.target) / 10; }   // thousandths of a minute

  function newMonth(C) {
    return { C: C, day: 0, downAll: 0, downLive: 0, frozen: [], held: [], applied: [] };
  }

  function measuredK(N) { return (N.C.sli === "live" ? N.downLive : N.downAll) * 1000; }
  function leftK(N) { return budgetK(N.C) - measuredK(N); }

  // Runs one day; returns the day's log lines.
  function stepDay(N) {
    var C = N.C;
    var d = N.day + 1;
    var lines = [];
    var start = pick(TIMES, C.time).min;
    UPDATES.forEach(function (u) {
      if (u.d !== d) return;
      if (C.rule && leftK(N) <= 0) {
        N.held.push(d);
        lines.push({ txt: d + " Sep: update held by the budget rule (" + km(leftK(N)) + " minutes left).", tone: "warn" });
        return;
      }
      var a = start + u.off;
      var b = a + u.dur;
      N.downAll += u.dur;
      N.applied.push(d);
      var hit = [];
      SERVICES.forEach(function (s) {
        if (s.d !== d) return;
        var ov = Math.max(0, Math.min(b, s.end) - Math.max(a, s.start));
        if (ov > 0) { N.downLive += ov; N.frozen.push(d + " Sep " + hm(s.start)); hit.push(hm(s.start)); }
      });
      var t = d + " Sep: update from " + hm(start) + "; stream down " + hm(a) + " to " + hm(b) + ", " + u.dur + " minutes. " +
        (hit.length ? "The " + hit.join(" and ") + " service was live: frozen picture." : "No service was live.");
      if (C.spare) t += " The spare took the same update and restarted in the same minute.";
      lines.push({ txt: t, tone: hit.length ? "bad" : "ok" });
    });
    N.day = d;
    return lines;
  }

  function promiseKept(N) {
    var C = N.C;
    var total = counted(C);
    var down = C.sli === "live" ? N.downLive : N.downAll;
    return (total - down) * 10000 >= C.target * total;
  }

  function dateText(N) {
    if (N.day >= DAYS) return "Thu 1 Oct, 00:00";
    var d = N.day + 1;
    return DOW[dow(d)] + " " + d + " Sep, 00:00";
  }

  function reportLine(N) {
    var C = N.C;
    var down = C.sli === "live" ? N.downLive : N.downAll;
    return "Report, 1 Oct 00:00 (" + (C.sli === "live" ? "live minutes" : "all minutes") + "): minutes counted " + fmt(counted(C)) +
      "; minutes down " + down + "; percent up " + pct(counted(C), down) + "; target " + tgtText(C.target) +
      "; budget left " + km(leftK(N)) + "; promise " + (promiseKept(N) ? "kept" : "broken") + ".";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var grid = el("div", "display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;font-size:10px;");
    var foot = el("p", "margin:0;font-size:12px;");
    [head, grid, foot].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, grid: grid, foot: foot };
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var C = S.C;
    var ui = S.ui;
    var start = pick(TIMES, C.time).min;
    ui.head.textContent = "September 2026, 30 days. Updates start at " + hm(start) + ". The promise counts " +
      (C.sli === "live" ? "live minutes (1,860)" : "all minutes (43,200)") + " at " + tgtText(C.target) +
      ". Budget rule " + (C.rule ? "on" : "off") + ". Second stream server " + (C.spare ? "on" : "off") + ".";
    while (ui.grid.firstChild) ui.grid.removeChild(ui.grid.firstChild);
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (h) { ui.grid.appendChild(ui.el("div", "font-weight:600;", h)); });
    ui.grid.appendChild(ui.el("div", "", ""));   // Monday 31 August
    for (var d = 1; d <= DAYS; d++) {
      var done = d <= N.day;
      var lines = [String(d)];
      SERVICES.forEach(function (s) {
        if (s.d !== d) return;
        var fz = N.frozen.indexOf(d + " Sep " + hm(s.start)) >= 0;
        lines.push(hm(s.start) + (done ? (fz ? " FROZEN" : " ok") : ""));
      });
      UPDATES.forEach(function (u) {
        if (u.d !== d) return;
        if (!done) lines.push("update due");
        else if (N.held.indexOf(d) >= 0) lines.push("update held");
        else lines.push("down " + hm(start + u.off) + "-" + hm(start + u.off + u.dur));
      });
      var cell = ui.el("div", "border:1px solid currentColor;border-radius:4px;padding:2px;white-space:pre-line;opacity:" + (done ? "1" : "0.55") + ";", lines.join("\n"));
      ui.grid.appendChild(cell);
    }
    ui.foot.textContent = "Frozen services: " + (N.frozen.length ? N.frozen.join(", ") : "none") +
      ". Updates held: " + (N.held.length ? N.held.map(function (x) { return x + " Sep"; }).join(", ") : "none") + ".";
    S.stat.date(dateText(N));
    S.stat.counted(fmt(counted(C)));
    S.stat.downAll(N.downAll);
    S.stat.upAll(pct(MONTH_MIN, N.downAll));
    S.stat.downLive(N.downLive);
    S.stat.upLive(pct(LIVE_MIN, N.downLive));
    S.stat.budget(km(budgetK(C)));
    S.stat.left(km(leftK(N)));
    S.stat.hit(N.frozen.length + " of " + SERVICES.length);
    S.stat.frozen(N.frozen.length ? N.frozen.join(", ") : "none");
    S.stat.held(N.held.length);
    S.stat.promise(promiseKept(N) ? "kept" : "broken");
    S.stat.refund(promiseKept(N) ? "none" : "10% of the fee");
    S.ctl.day.disable(N.day >= DAYS);
    S.ctl.week.disable(N.day >= DAYS);
    S.ctl.all.disable(N.day >= DAYS);
  }

  function run(api, days) {
    var S = api.state;
    var N = S.N;
    if (N.day >= DAYS) return;
    var from = N.day + 1;
    var stop = Math.min(DAYS, N.day + days);
    var lines = [];
    while (N.day < stop) lines = lines.concat(stepDay(N));
    var head = from === N.day ? from + " Sep" : from + " to " + N.day + " Sep";
    var tone = lines.some(function (l) { return l.tone === "bad"; }) ? "bad" : (lines.some(function (l) { return l.tone === "warn"; }) ? "warn" : "ok");
    api.log((lines.length ? lines.map(function (l) { return l.txt; }).join(" ") : head + ": no update.") +
      (N.day >= DAYS ? " " + reportLine(N) : ""), tone);
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.N = newMonth(S.C);
    api.log((why ? why + " " : "") + "Tue 1 Sep, 00:00, before the first service. 31 services and 3 updates this month. Budget " +
      km(budgetK(S.C)) + " minutes.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { time: "1030", sli: "all", target: 9990, rule: true, spare: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      S.ctl.time = api.control.select("time", "Updates start at", TIMES.map(function (x) { return { value: x.value, label: x.label }; }), "1030", opt("time", String));
      S.ctl.sli = api.control.select("sli", "What the promise counts (SLI)", SLIS, "all", opt("sli", String));
      S.ctl.target = api.control.select("target", "Target", TARGETS, 9990, opt("target", Number));
      S.ctl.rule = api.control.toggle("rule", "Budget rule: hold updates once the budget is spent", true, opt("rule", function (v) { return !!v; }));
      S.ctl.spare = api.control.toggle("spare", "Second stream server", false, opt("spare", function (v) { return !!v; }));
      S.ctl.day = api.control.button("day", "Next day", function () { run(api, 1); });
      S.ctl.week = api.control.button("week", "Next week", function () { run(api, 7); });
      S.ctl.all = api.control.button("all", "Run to the report", function () { run(api, DAYS); });
      S.ctl.again = api.control.button("again", "Start the month again", function () { restart(api, "New month."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        date: api.stat("date", "now", ""),
        counted: api.stat("counted", "minutes the promise counts", ""),
        downAll: api.stat("downAll", "minutes down, all minutes", "warn"),
        upAll: api.stat("upAll", "percent up, all 43,200 minutes", ""),
        downLive: api.stat("downLive", "minutes down while a service was live", "bad"),
        upLive: api.stat("upLive", "percent up, 1,860 live minutes", ""),
        budget: api.stat("budget", "budget, minutes", ""),
        left: api.stat("left", "budget left, minutes", "warn"),
        hit: api.stat("hit", "services with a frozen picture", "bad"),
        frozen: api.stat("frozen", "which services", "bad"),
        held: api.stat("held", "updates held by the rule", "warn"),
        promise: api.stat("promise", "promise, by this measure and target", ""),
        refund: api.stat("refund", "refund owed, by this measure and target", "")
      };
      api.info("<strong>How to read it.</strong> Each box is a day of September 2026. A time is a service (60 minutes, streamed live); after the day has run it says ok or FROZEN. An update installs for about half an hour from its start time, then the stream server restarts and the stream is down for the minutes shown. The budget is the minutes counted times what the target leaves; the rule holds an update once the budget left is 0 or less.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function S() { return t.api.state; }

      // 1. Opens on 1 September at 00:00, before any service or update.
      t.expect(t.stat("date") === "Tue 1 Sep, 00:00" && t.stat("downAll") === 0 && t.stat("upAll") === "100%" &&
        t.stat("budget") === 43.2 && t.stat("left") === 43.2 && t.stat("frozen") === "none" && t.stat("counted") === "43,200" &&
        S().N.day === 0,
        "Opens on Tue 1 Sep 00:00: nothing down, budget 43.2 minutes of 43,200");

      // 2. The first week: no update yet.
      t.click("week");
      t.expect(t.stat("date") === "Tue 8 Sep, 00:00" && t.stat("downAll") === 0 && t.logText().indexOf("1 to 7 Sep: no update.") >= 0,
        "1 to 7 September: no update, nothing down");

      // 3. 8 September: the first update freezes the 10:30 service, 11:04 to 11:13.
      t.click("day");
      t.expect(t.logText().indexOf("8 Sep: update from 10:30; stream down 11:04 to 11:13, 9 minutes. The 10:30 service was live: frozen picture.") >= 0 &&
        t.stat("downLive") === 9 && t.stat("frozen") === "8 Sep 10:30",
        "8 Sep: stream down 11:04 to 11:13 during the 10:30 service");

      // 4. The record: the monthly report.
      t.click("all");
      t.expect(t.stat("date") === "Thu 1 Oct, 00:00" && t.stat("downAll") === 26 && t.stat("upAll") === "99.94%" &&
        t.stat("left") === 17.2 && t.stat("promise") === "kept" && t.stat("refund") === "none" && t.stat("held") === 0 &&
        t.stat("downLive") === 26 && t.stat("upLive") === "98.6%" && t.stat("hit") === "3 of 31" &&
        t.stat("frozen") === "8 Sep 10:30, 16 Sep 10:30, 24 Sep 10:30" &&
        t.logText().indexOf("24 Sep: update from 10:30; stream down 11:05 to 11:14, 9 minutes.") >= 0 &&
        t.logText().indexOf("minutes counted 43,200; minutes down 26; percent up 99.94%; target 99.9%; budget left 17.2; promise kept.") >= 0,
        "Report: 26 down, 99.94%, 17.2 left, kept, no refund; by live minutes 98.6%, 3 of 31 services frozen");

      // 5. The same month counted in live minutes, with the budget rule off.
      t.set("rule", false);
      t.set("sli", "live");
      t.click("all");
      t.expect(t.stat("budget") === 1.86 && t.stat("left") === -24.14 && t.stat("promise") === "broken" &&
        t.stat("refund") === "10% of the fee" && t.stat("held") === 0 && t.stat("counted") === "1,860" && t.stat("hit") === "3 of 31",
        "Live minutes, rule off: budget 1.86, left -24.14, broken, 3 of 31 services frozen");

      // 6. Option 1: live minutes and the budget rule on.
      t.set("rule", true);
      t.click("all");
      t.expect(t.stat("left") === -7.14 && t.stat("held") === 2 && t.stat("frozen") === "8 Sep 10:30" &&
        t.stat("upLive") === "99.52%" && t.stat("upAll") === "99.98%" && t.stat("promise") === "broken" &&
        t.logText().indexOf("16 Sep: update held by the budget rule (-7.14 minutes left).") >= 0,
        "Live minutes, rule on: 8 Sep spends the budget (-7.14), 16 and 24 Sep held, 1 service frozen");

      // 7. 02:00 (as until August) and 19:00: nobody watching.
      t.set("time", "0200");
      t.click("all");
      var night = t.stat("downLive") === 0 && t.stat("upLive") === "100%" && t.stat("downAll") === 26 && t.stat("upAll") === "99.94%" &&
        t.stat("left") === 1.86 && t.stat("promise") === "kept" && t.stat("frozen") === "none";
      t.set("time", "1900");
      t.click("all");
      t.expect(night && t.stat("downLive") === 0 && t.stat("held") === 0 && t.stat("left") === 1.86 && t.stat("promise") === "kept" &&
        t.logText().indexOf("stream down 19:35 to 19:44, 9 minutes. No service was live.") >= 0,
        "02:00 and 19:00: the same 26 minutes down, 0 live minutes, 100% live, 1.86 left, kept");

      // 8. Option 0: four nines of all minutes.
      t.set("sli", "all");
      t.set("time", "1030");
      t.set("target", 9999);
      t.set("rule", false);
      t.click("all");
      var off4 = t.stat("budget") === 4.32 && t.stat("left") === -21.68 && t.stat("promise") === "broken" &&
        t.stat("refund") === "10% of the fee" && t.stat("hit") === "3 of 31";
      t.set("rule", true);
      t.click("all");
      var on4 = t.stat("left") === -4.68 && t.stat("held") === 2 && t.stat("hit") === "1 of 31";
      t.set("time", "0200");
      t.click("all");
      t.expect(off4 && on4 && t.stat("held") === 2 && t.stat("hit") === "0 of 31" && t.stat("downAll") === 9,
        "99.99% of all minutes: budget 4.32, still 3 frozen and a refund; with the rule, 2 updates held even at 02:00");

      // 9. Option 3: a second stream server changes no minute.
      t.set("target", 9990);
      t.set("time", "1030");
      t.set("spare", true);
      t.click("all");
      t.expect(t.stat("downAll") === 26 && t.stat("downLive") === 26 && t.stat("hit") === "3 of 31" && t.stat("refund") === "none" &&
        t.logText().indexOf("The spare took the same update and restarted in the same minute.") >= 0,
        "Second stream server: the same 26 minutes, the same 3 services, no refund owed");

      // 10. A looser target: 99% of live minutes.
      t.set("spare", false);
      t.set("sli", "live");
      t.set("target", 9900);
      t.click("all");
      t.expect(t.stat("budget") === 18.6 && t.stat("left") === -7.4 && t.stat("held") === 0 && t.stat("hit") === "3 of 31",
        "99% of live minutes: budget 18.6, the rule holds nothing, -7.4 left, 3 frozen");
    }
  });
})();
