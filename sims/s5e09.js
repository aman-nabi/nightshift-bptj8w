/* sims/s5e09-v1.0.0.js  (published as sims/s5e09.js)
   Case s5e09 "The Assembly Line": a pipeline lab for line 2 at Okeburn Spring, a night-shift
   bottling plant. The label service works out each night's batch code with one line of JavaScript,
   format(today, "YYDDD"), using the date library tallydate. The learner chooses where the service is
   built (Mungo's laptop with npm install, or a clean machine with npm ci), the lockfile, an exact pin
   for tallydate, a hand-written date code, a year-end test, which build goes to the line, and which
   year end to run; then runs the nights and reads every batch code. Widget-style sim inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: build made in March 2025 or on 18 December 2025; built on the
     laptop or a clean machine; lockfile none, committed in March, or updated to the newest; pin
     tallydate to exactly 2.4.3; date code from tallydate or by hand; year-end test of 4 dates;
     deploy the new build or the last good stored build; nights 22 Dec 2025 to 2 Jan 2026 or
     22 Dec 2026 to 2 Jan 2027. Stats: tallydate in the build, versions not tested in March, year-end
     test, stored builds, running on the line, nights run, bottles labelled, bottles with a wrong code,
     bottles with a future code, first label of 29 Dec, what 1 Jul 2027 would print. selfTest: 12
     assertions.

   The model (stated in sim.lede):
   - Line 2 fills 9,000 bottles an hour, 22:00 to 06:00: 8 hours, 72,000 bottles a night. The service
     reads the date once, at 22:00, so a night is one batch with one code.
   - The code is 2 digits of a year, then the day of the year in 3 digits (1 January is 001).
   - tallydate 2.x prints YY as the calendar year. tallydate 3.x follows UTS #35: YY is the
     week-numbering year, the year of the Thursday in the date's Monday-to-Sunday week (ISO 8601).
     Both print DDD as the day of the calendar year. Computed from the date in UTC, not from a table.
   - package.json accepts tallydate ">=2.4.0" and labelwright ">=1.6.0" (or tallydate "2.4.3" when
     pinned). Newest releases in March 2025: tallydate 2.4.3, labelwright 1.6.0. On 18 December 2025:
     tallydate 3.0.0, labelwright 1.9.2.
   - npm install on the laptop uses the lockfile when it matches package.json, otherwise the newest
     version the range allows. npm ci on the clean machine stops with no lockfile, or with a lockfile
     that doesn't match package.json, and otherwise installs exactly what the lockfile lists.
   - The year-end test checks 29 Dec 2025 = 25363, 1 Jan 2026 = 26001, 1 Jan 2027 = 27001 and
     1 Jul 2027 = 27182. A failed build or test stops the pipeline, and the line keeps the build it
     already ran (the March build, tallydate 2.4.3).
   - Only the clean machine stores its builds. "The last good stored build" is the March build.
   - Mungo's hand-written date code: day of year = floor((midnight of the date - midnight of 1 Jan)
     / 24 hours) + 1, in UK local time, where the clocks go forward at 01:00 GMT on the last Sunday
     of March and back at 01:00 GMT on the last Sunday of October. In summer one day is lost.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e09-v1.0.0.json):
   - 72,000 a night = 9,000 x 8. Twelve nights, 22 Dec to 2 Jan: 864,000 bottles.
   - 22 to 28 Dec 2025: week-numbering year 2025, codes 25356 to 25362, right. 29, 30, 31 Dec 2025:
     Monday to Wednesday of ISO week 1 of 2026 (1 Jan 2026 is a Thursday), so tallydate 3.0.0 prints
     26363, 26364, 26365 (29 to 31 Dec 2026, future dates): 3 x 72,000 = 216,000 bottles.
     1 and 2 Jan 2026: 26001, 26002, right.
   - 22 Dec 2026 to 2 Jan 2027 with 3.0.0: 29 to 31 Dec 2026 are in ISO week 53 of 2026, right
     (26363 is right this time). 1 Jan 2027 is a Friday, still in 2026's last week: 26001 and 26002
     for 1 and 2 Jan 2027, dates a year in the past: 2 x 72,000 = 144,000 bottles.
   - Year-end test with 3.0.0: 2 of 4 fail (25363 printed 26363; 27001 printed 26001). By hand: 1 of 4
     fails (27182 printed 27181: 1 Jul 2027 is in summer time, 181 days less one hour, rounded down).
   - Rollback: deploying the last good stored build puts tallydate 2.4.3 back, 0 wrong codes.
   - Story dates: 29 Dec 2026 is 76 days (eleven weeks) after the post, Wednesday 14 Oct 2026.
   - Cold case (not in the sim): the line stood 22:10 to 23:00, 50 minutes at 9,000 an hour = 7,500
     bottles. Builds 13 and 14 are labels only.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var RATE = 9000;
  var HOURS = 8;
  var PER_NIGHT = RATE * HOURS;
  var NIGHTS = 12;
  var DAY = 86400000;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var NEWEST = {
    march: { tally: "2.4.3", label: "1.6.0" },
    dec: { tally: "3.0.0", label: "1.9.2" }
  };
  var MARCH = { tally: "2.4.3", label: "1.6.0", code: "tally" };
  var TESTS = [[2025, 11, 29, "25363"], [2026, 0, 1, "26001"], [2027, 0, 1, "27001"], [2027, 6, 1, "27182"]];

  var WHEN = [
    { value: "march", label: "March 2025 (as tested)" },
    { value: "dec", label: "18 December 2025 (new laptop)" }
  ];
  var MACHINE = [
    { value: "laptop", label: "Mungo's laptop (npm install)" },
    { value: "ci", label: "A clean machine (npm ci)" }
  ];
  var LOCK = [
    { value: "none", label: "None committed (as built)" },
    { value: "march", label: "Committed in March (tallydate 2.4.3)" },
    { value: "newest", label: "Updated to the newest that day" }
  ];
  var CODE = [
    { value: "tally", label: "tallydate: format(today, \"YYDDD\")" },
    { value: "hand", label: "Written by hand (Mungo's sum)" }
  ];
  var DEPLOY = [
    { value: "new", label: "The new build" },
    { value: "last", label: "The last good stored build" }
  ];
  var YEAREND = [
    { value: "2025", label: "22 Dec 2025 to 2 Jan 2026" },
    { value: "2026", label: "22 Dec 2026 to 2 Jan 2027" }
  ];

  /* ---------- dates, worked out from the date itself ---------- */

  function utc(y, m, d) { return Date.UTC(y, m, d); }
  function parts(t) { var x = new Date(t); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; }
  function doy(y, m, d) { return Math.round((utc(y, m, d) - utc(y, 0, 1)) / DAY) + 1; }
  // ISO 8601: a week runs Monday to Sunday and belongs to the year of its Thursday.
  function isoYear(y, m, d) {
    var t = utc(y, m, d);
    var wd = new Date(t).getUTCDay() || 7;
    return new Date(t + (4 - wd) * DAY).getUTCFullYear();
  }
  function lastSunday(y, m) {
    var last = new Date(utc(y, m + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  }
  // UK clocks: is local midnight on this date in summer time?
  function summer(y, m, d) {
    var t = utc(y, m, d);
    return t > utc(y, 2, lastSunday(y, 2)) && t <= utc(y, 9, lastSunday(y, 9));
  }
  function localMidnight(y, m, d) { return utc(y, m, d) - (summer(y, m, d) ? 3600000 : 0); }
  function handDoy(y, m, d) { return Math.floor((localMidnight(y, m, d) - localMidnight(y, 0, 1)) / DAY) + 1; }

  function pad(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dateText(y, m, d) { return pad(d, 2) + " " + MON[m] + " " + y; }
  function major(v) { return Number(String(v).split(".")[0]); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function rightCode(y, m, d) { return pad(y % 100, 2) + pad(doy(y, m, d), 3); }
  function codeFor(b, y, m, d) {
    if (b.code === "hand") return pad(y % 100, 2) + pad(handDoy(y, m, d), 3);
    if (major(b.tally) >= 3) return pad(isoYear(y, m, d) % 100, 2) + pad(doy(y, m, d), 3);
    return rightCode(y, m, d);
  }
  // The date a code claims, as UTC milliseconds.
  function claimed(code) {
    return utc(2000 + Number(code.slice(0, 2)), 0, 1) + (Number(code.slice(2)) - 1) * DAY;
  }

  /* ---------- the pipeline (pure: config in, build out) ---------- */

  function build(C) {
    var newest = NEWEST[C.when];
    var lock = C.lock === "none" ? null : (C.lock === "march" ? NEWEST.march : newest);
    var fits = function (v) { return C.pin ? v === "2.4.3" : true; };
    var b = { ok: true, stop: "", tally: "", label: "", code: C.code, machine: C.machine };
    if (C.machine === "ci") {
      if (!lock) { b.ok = false; b.stop = "npm ci stopped: no package-lock.json in the project."; return b; }
      if (!fits(lock.tally)) {
        b.ok = false;
        b.stop = "npm ci stopped: the lockfile lists tallydate " + lock.tally + ", package.json asks for 2.4.3.";
        return b;
      }
      b.tally = lock.tally;
      b.label = lock.label;
    } else if (lock && fits(lock.tally)) {
      b.tally = lock.tally;
      b.label = lock.label;
    } else {
      b.tally = C.pin ? "2.4.3" : newest.tally;
      b.label = lock ? lock.label : newest.label;
    }
    if (C.code === "hand") b.tally = "not used";
    return b;
  }

  function runTests(b) {
    var failed = [];
    TESTS.forEach(function (c) {
      var got = codeFor(b, c[0], c[1], c[2]);
      if (got !== c[3]) failed.push("expected " + c[3] + ", got " + got + " for " + dateText(c[0], c[1], c[2]));
    });
    return failed;
  }

  function drift(b) {
    var out = [];
    if (b.tally && b.tally !== "not used" && b.tally !== MARCH.tally) out.push("tallydate " + b.tally);
    if (b.label && b.label !== MARCH.label) out.push("labelwright " + b.label);
    return out.length ? out.join(", ") : "none";
  }

  // The whole route from package.json to the line computer.
  function pipeline(C) {
    var b = build(C);
    var P = { b: b, failed: [], tested: false, stored: false, line: null, lineText: "", why: "" };
    if (b.ok && C.test) { P.tested = true; P.failed = runTests(b); }
    var passed = b.ok && P.failed.length === 0;
    P.stored = C.machine === "ci" && passed;
    var keep = { tally: MARCH.tally, label: MARCH.label, code: "tally" };
    var mine = { tally: b.tally, label: b.label, code: b.code };
    if (!passed) {
      P.line = keep;
      P.lineText = "the build it already ran (tallydate 2.4.3)";
      P.why = "keep";
    } else if (C.deploy === "last" && C.machine === "ci") {
      P.line = keep;
      P.lineText = "the last good stored build (tallydate 2.4.3)";
      P.why = "rollback";
    } else {
      P.line = mine;
      P.lineText = (C.machine === "ci" ? "the stored build (" : "the laptop copy (") +
        (mine.code === "hand" ? "date code by hand)" : "tallydate " + mine.tally + ")");
      P.why = C.deploy === "last" ? "nothing stored" : "new";
    }
    return P;
  }

  function nightDates(C) {
    var y = Number(C.yearEnd);
    var out = [];
    for (var i = 0; i < NIGHTS; i++) out.push(parts(utc(y, 11, 22) + i * DAY));
    return out;
  }

  function night(P, dt) {
    var y = dt[0];
    var m = dt[1];
    var d = dt[2];
    var right = rightCode(y, m, d);
    var printed = codeFor(P.line, y, m, d);
    var c = claimed(printed);
    var t = utc(y, m, d);
    var p = parts(c);
    var verdict = printed === right ? "right" : (c > t ? "future" : "past");
    var line = "22:00 " + dateText(y, m, d) + "  batch " + printed + "  " + fmt(PER_NIGHT) + " bottles";
    if (verdict === "future") line += "  wrong: reads as " + dateText(p[0], p[1], p[2]) + ", a future date";
    else if (verdict === "past") line += "  wrong: reads as " + dateText(p[0], p[1], p[2]) + ", a year in the past";
    else line += "  right";
    return {
      y: y, m: m, d: d, wd: WDAY[new Date(t).getUTCDay()], cal: y, week: isoYear(y, m, d),
      right: right, printed: printed, verdict: verdict, line: line
    };
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
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;", "");
    box.appendChild(head);
    var row = el("div", "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;");
    var stages = {};
    ["Build", "Test", "Store", "Deploy"].forEach(function (name) {
      var s = el("div", "border:1px solid currentColor;border-radius:6px;padding:6px;min-width:0;");
      s.appendChild(el("strong", "", name));
      var v = el("div", "margin-top:4px;", "");
      s.appendChild(v);
      row.appendChild(s);
      stages[name] = v;
    });
    box.appendChild(row);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["night", "day", "calendar year", "week-numbering year", "right code", "printed", "result"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, stages: stages, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var P = S.P;
    var b = P.b;
    var ui = S.ui;
    ui.head.textContent = "Build made " + pick(WHEN, C.when).label + ", on " + pick(MACHINE, C.machine).label +
      ". package.json: tallydate " + (C.pin ? "\"2.4.3\"" : "\">=2.4.0\"") + ", labelwright \">=1.6.0\".";
    ui.stages.Build.textContent = b.ok ? "tallydate " + b.tally + ", labelwright " + b.label : b.stop;
    ui.stages.Test.textContent = !b.ok ? "not reached" : (!P.tested ? "no year-end test" :
      (P.failed.length ? P.failed.length + " of 4 failed: " + P.failed[0] : "4 of 4 passed"));
    ui.stages.Store.textContent = P.stored ? "kept, with the last good build" :
      (C.machine === "ci" ? "nothing new kept" : "nothing kept: copied by hand");
    ui.stages.Deploy.textContent = "line computer runs " + P.lineText;
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    S.rows.forEach(function (r) {
      var tr = ui.el("tr");
      [dateText(r.y, r.m, r.d), r.wd, String(r.cal), String(r.week), r.right, r.printed,
        r.verdict === "right" ? "right" : (r.verdict === "future" ? "future date" : "past date")].forEach(function (c) {
        tr.appendChild(ui.el("td", "", c));
      });
      ui.tbody.appendChild(tr);
    });

    S.stat.tally(b.ok ? b.tally : "none (stopped)");
    S.stat.drift(b.ok ? drift(b) : "-");
    S.stat.test(!b.ok ? "not reached" : (!P.tested ? "off" : (P.failed.length ? P.failed.length + " of 4 failed" : "4 of 4 passed")));
    S.stat.stored(C.machine === "ci" ? (P.stored ? "last good, and this one" : "last good only") : "none");
    S.stat.line(P.lineText);
    S.stat.nights(S.rows.length + " of " + NIGHTS);
    S.stat.bottles(fmt(S.rows.length * PER_NIGHT));
    S.stat.wrong(fmt(S.wrong * PER_NIGHT));
    S.stat.future(fmt(S.future * PER_NIGHT));
    S.stat.first(S.first || "not yet");
    S.stat.july(codeFor(P.line, 2027, 6, 1));
  }

  function rebuild(api, what) {
    var S = api.state;
    S.P = pipeline(S.C);
    S.rows = [];
    S.wrong = 0;
    S.future = 0;
    S.first = "";
    var P = S.P;
    var b = P.b;
    var where = S.C.machine === "ci" ? "a clean machine" : "Mungo's laptop";
    var tool = S.C.machine === "ci" ? "npm ci" : "npm install";
    var s = what + " Build on " + where + ": ";
    if (!b.ok) s += b.stop;
    else s += tool + " put in tallydate " + b.tally + " and labelwright " + b.label + ".";
    if (P.tested) s += P.failed.length ? " Year-end test: " + P.failed.length + " of 4 failed, first " + P.failed[0] + "." : " Year-end test: 4 of 4 passed.";
    if (P.why === "keep") s += " Nothing new reaches the line; it keeps the build it already ran (tallydate 2.4.3).";
    else if (P.why === "rollback") s += " Rolled back: the last good stored build (tallydate 2.4.3) goes to the line.";
    else if (P.why === "nothing stored") s += " Nothing was stored, so there is no last good build to go back to; the laptop copy goes on.";
    else s += S.C.machine === "ci" ? " Stored, and that same build goes to the line." : " Copied by hand to the line computer; no copy kept.";
    api.log(s, P.why === "keep" || P.why === "rollback" ? "ok" : (P.why === "nothing stored" ? "warn" : ""));
    draw(api);
  }

  function runNight(api) {
    var S = api.state;
    if (S.rows.length >= NIGHTS) return false;
    var dates = nightDates(S.C);
    var r = night(S.P, dates[S.rows.length]);
    S.rows.push(r);
    if (r.verdict !== "right") S.wrong += 1;
    if (r.verdict === "future") S.future += 1;
    if (r.m === 11 && r.d === 29) S.first = r.printed;
    api.log(r.line, r.verdict === "right" ? "" : "bad");
    return true;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s5e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { when: "march", machine: "laptop", lock: "none", pin: false, code: "tally", test: false, deploy: "new", yearEnd: "2025" };
      S.fn = { isoYear: isoYear, doy: doy, handDoy: handDoy, codeFor: codeFor };
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        return api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o || String(o.value) === S.C[key]) return;
          S.C[key] = String(o.value);
          rebuild(api, label + ": " + o.label + ".");
        });
      }
      S.ctl = {};
      S.ctl.when = sel("when", "Build made in", WHEN, "when");
      S.ctl.machine = sel("machine", "Built on", MACHINE, "machine");
      S.ctl.lock = sel("lock", "Lockfile", LOCK, "lock");
      S.ctl.pin = api.control.toggle("pin", "Pin tallydate to exactly 2.4.3", false, function (on) {
        S.C.pin = !!on;
        rebuild(api, "tallydate in package.json: " + (on ? "\"2.4.3\"." : "\">=2.4.0\"."));
      });
      S.ctl.code = sel("code", "Date code", CODE, "code");
      S.ctl.test = api.control.toggle("test", "Year-end test (4 dates)", false, function (on) {
        S.C.test = !!on;
        rebuild(api, "Year-end test: " + (on ? "on." : "off."));
      });
      S.ctl.deploy = sel("deploy", "Deploy to the line", DEPLOY, "deploy");
      S.ctl.yearEnd = sel("yearEnd", "Nights", YEAREND, "yearEnd");
      S.ctl.night = api.control.button("night", "Run the next night", function () {
        if (runNight(api)) draw(api);
      });
      S.ctl.all = api.control.button("all", "Run all nights", function () {
        var n = 0;
        while (runNight(api)) n += 1;
        if (n) api.log("Done: " + fmt(S.rows.length * PER_NIGHT) + " bottles, " + fmt(S.wrong * PER_NIGHT) + " with a wrong code.", S.wrong ? "bad" : "ok");
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        tally: api.stat("tally", "tallydate in the build", ""),
        drift: api.stat("drift", "versions not tested in March", "warn"),
        test: api.stat("test", "year-end test", ""),
        stored: api.stat("stored", "stored builds", ""),
        line: api.stat("line", "running on the line", ""),
        nights: api.stat("nights", "nights run", ""),
        bottles: api.stat("bottles", "bottles labelled", ""),
        wrong: api.stat("wrong", "bottles with a wrong code", "bad"),
        future: api.stat("future", "bottles coded with a future date", "bad"),
        first: api.stat("first", "first label, night of 29 Dec", "warn"),
        july: api.stat("july", "1 Jul 2027 would print", "")
      };

      api.info("<strong>How to read it.</strong> The four boxes are the pipeline: build (fetch the libraries and put the service together), test, store, deploy (put it on the line computer). Each night is one batch: the service reads the date at 22:00, and line 2 labels 72,000 bottles by 06:00. The table shows each night's calendar year, its week-numbering year (the year that owns its Monday-to-Sunday week), the right code and the code printed.");

      S.P = pipeline(S.C);
      S.rows = [];
      S.wrong = 0;
      S.future = 0;
      S.first = "";
      api.log("Line 2, before 18 December 2025: the March build is on the line computer (tallydate 2.4.3). No night has run yet.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var F = t.api.state.fn;

      // 1. Opening state: the March build, before the 18 December rebuild; no night run.
      t.expect(t.stat("tally") === "2.4.3" && t.stat("nights") === "0 of 12" && t.stat("bottles") === 0 &&
        t.stat("wrong") === 0 && t.stat("first") === "not yet" && t.stat("test") === "off" && t.stat("stored") === "none" &&
        t.stat("drift") === "none" && has("the March build is on the line computer (tallydate 2.4.3)"),
        "Opens before 18 December: the March build with tallydate 2.4.3 on the line, no night run");

      // 2. Week-numbering year and day of year, worked out from the date.
      t.expect(F.isoYear(2025, 11, 28) === 2025 && F.isoYear(2025, 11, 29) === 2026 && F.isoYear(2025, 11, 31) === 2026 &&
        F.isoYear(2026, 0, 1) === 2026 && F.isoYear(2026, 11, 31) === 2026 && F.isoYear(2027, 0, 1) === 2026 &&
        F.isoYear(2027, 0, 4) === 2027 && F.doy(2025, 11, 29) === 363 && F.doy(2025, 11, 22) === 356 && F.doy(2026, 0, 1) === 1,
        "29 Dec 2025 belongs to week-numbering year 2026, 28 Dec to 2025, 1 Jan 2027 to 2026; 29 Dec 2025 is day 363");

      // 3. The story: rebuilt on the new laptop on 18 December, tallydate 3.0.0.
      t.set("when", "dec");
      t.expect(t.stat("tally") === "3.0.0" && t.stat("drift") === "tallydate 3.0.0, labelwright 1.9.2" &&
        has("npm install put in tallydate 3.0.0 and labelwright 1.9.2"),
        "18 December laptop build: npm picks tallydate 3.0.0 and labelwright 1.9.2");
      t.click("all");
      t.expect(t.stat("bottles") === "864,000" && t.stat("wrong") === "216,000" && t.stat("future") === "216,000" &&
        t.stat("first") === 26363 &&
        has("22:00 28 Dec 2025  batch 25362  72,000 bottles  right") &&
        has("22:00 29 Dec 2025  batch 26363  72,000 bottles  wrong: reads as 29 Dec 2026, a future date") &&
        has("22:00 31 Dec 2025  batch 26365  72,000 bottles") && has("22:00 01 Jan 2026  batch 26001  72,000 bottles  right"),
        "Twelve nights, 864,000 bottles; 29 to 31 Dec print 26363 to 26365, 3 x 72,000 = 216,000 future codes");

      // 4. The March build prints 25363 on 29 December.
      t.set("when", "march");
      t.click("all");
      t.expect(t.stat("wrong") === 0 && t.stat("first") === 25363 && has("22:00 29 Dec 2025  batch 25363  72,000 bottles  right"),
        "With tallydate 2.4.3 the night of 29 Dec 2025 prints 25363 and no code is wrong");

      // 5. A year-end test on the laptop catches 3.0.0, and the line keeps the March build.
      t.set("when", "dec");
      t.set("test", true);
      var caught = t.stat("test") === "2 of 4 failed" && has("first expected 25363, got 26363 for 29 Dec 2025");
      t.click("all");
      t.expect(caught && t.stat("line") === "the build it already ran (tallydate 2.4.3)" && t.stat("wrong") === 0,
        "Year-end test: 2 of 4 fail (25363 printed 26363); nothing new reaches the line, 0 wrong codes");

      // 6. A clean machine with no lockfile: npm ci stops.
      t.set("test", false);
      t.set("machine", "ci");
      t.expect(t.stat("tally") === "none (stopped)" && has("npm ci stopped: no package-lock.json in the project.") &&
        t.stat("line") === "the build it already ran (tallydate 2.4.3)",
        "Clean machine, no lockfile: npm ci stops and the line keeps the build it ran");

      // 7. The senior route: lockfile from March, clean machine, year-end test, stored and deployed.
      t.set("lock", "march");
      t.set("test", true);
      t.click("all");
      t.expect(t.stat("tally") === "2.4.3" && t.stat("drift") === "none" && t.stat("test") === "4 of 4 passed" &&
        t.stat("stored") === "last good, and this one" && t.stat("line") === "the stored build (tallydate 2.4.3)" &&
        t.stat("wrong") === 0 && t.stat("first") === 25363,
        "Clean machine, March lockfile, year-end test: 2.4.3, 4 of 4 passed, stored, 0 wrong codes");

      // 8. A lockfile updated to 3.0.0 with no test reaches the line; rolling back to the stored build fixes it.
      t.set("test", false);
      t.set("lock", "newest");
      t.click("all");
      var bad = t.stat("wrong");
      t.set("deploy", "last");
      var rolled = has("Rolled back: the last good stored build (tallydate 2.4.3) goes to the line.");
      t.click("all");
      t.expect(bad === "216,000" && rolled && t.stat("wrong") === 0 && t.stat("line") === "the last good stored build (tallydate 2.4.3)",
        "Updated lockfile with no test: 216,000 wrong; deploying the last good stored build: 0 wrong");

      // 9. Mungo's hand-written date code: December is right, summer is a day early.
      t.set("deploy", "new");
      t.set("lock", "none");
      t.set("machine", "laptop");
      t.set("code", "hand");
      t.click("all");
      var decOk = t.stat("wrong") === 0 && t.stat("july") === 27181 && F.handDoy(2027, 6, 1) === 181;
      t.set("test", true);
      t.expect(decOk && t.stat("test") === "1 of 4 failed" && has("expected 27182, got 27181 for 01 Jul 2027"),
        "By hand: every December code right, but 1 Jul 2027 prints 27181, not 27182; the test catches it");

      // 10. Pinning tallydate alone on the laptop: codes right, labelwright still drifts, nothing stored.
      t.set("test", false);
      t.set("code", "tally");
      t.set("pin", true);
      t.click("all");
      t.expect(t.stat("tally") === "2.4.3" && t.stat("drift") === "labelwright 1.9.2" && t.stat("stored") === "none" &&
        t.stat("wrong") === 0,
        "Pinned on the laptop: tallydate 2.4.3 and 0 wrong codes, but labelwright 1.9.2 untested and no stored build");

      // 11. The next year end with 3.0.0: 29 Dec 2026 is right, 1 and 2 Jan 2027 print 2026's codes.
      t.set("pin", false);
      t.set("yearEnd", "2026");
      t.click("all");
      t.expect(t.stat("wrong") === "144,000" && t.stat("future") === 0 && t.stat("first") === 26363 &&
        has("22:00 01 Jan 2027  batch 26001  72,000 bottles  wrong: reads as 01 Jan 2026, a year in the past") &&
        has("22:00 02 Jan 2027  batch 26002"),
        "22 Dec 2026 to 2 Jan 2027 on 3.0.0: 26363 is right this time; 1 and 2 Jan 2027 print 26001, 26002, 144,000 bottles");
    }
  });
})();
