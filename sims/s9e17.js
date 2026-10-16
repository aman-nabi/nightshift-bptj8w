/* sims/s9e17-v1.0.0.js  (published as sims/s9e17.js)
   Case s9e17 "The Drill": a continuity lab for a payroll bureau's Thursday night run. Brinkwell
   Payroll pays 12,000 people at 40 client firms every Friday; the Thursday run must reach the bank,
   signed, by its 05:30 cut-off. The learner sets how review items are kept, the exercise held each
   March, quarterly contact checks, a monthly full-scale exercise and continuity software, then steps
   through the months from March 2025 to October 2026 and plays the night of Thursday 15 October 2026.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls review items (no owner, an owner and a due date),
     exercise each March (tabletop, functional, full-scale), more people round the tabletop, quarterly
     contact check, monthly full-scale, continuity software; buttons next month, play to tonight,
     start over. Stats: where you are, plan version, open review items, review item R-7, active key
     holders, last exercise, days with no active key holder, step 4 tonight, people paid, exercise
     staff-hours a year, real runs moved to the second site a year, where review items live.
     selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e17-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - The bureau (the post): 12,000 people at 40 client firms, paid every Friday; the bank's cut-off
     is 05:30; a file that misses it goes in the bank's next processing day's run, Monday 19 October.
   - The plan (the post): owned by Ranulf; version 4 at the start (sim.lede); four steps for "main
     system down". Tabletops each March: 9 March 2023 and 14 March 2024 (history, PASS), then
     13 March 2025 and 12 March 2026 (second Thursdays, played here). Four years of PASS: 2023 to 2026.
   - Key holders (the post): the plan names J. Kisember and the founder, who retired in 2022 and
     handed his token back, so one active holder. Kisember's last day: Friday 29 August 2025, 14
     months before tonight. The token's PIN left with him.
   - R-7 (the post): raised at the after-action review on Thursday 20 March 2025, 19 months before
     tonight: "only one active key holder, J. Kisember; add a second". As built, no owner, no date.
     The 2026 review (Thursday 19 March 2026) copies it forward.
   - Given data (sim.lede): enrolling a new key holder takes the bank 4 weeks (28 days). With an
     owner and a due date, Ranulf owns R-7, due Monday 30 June 2025; he asks the bank on Monday 2 June
     and Aldegonde is enrolled on 30 June. A failed real step 4, or a quarterly check that finds a
     departed holder, goes to the plan's owner, Ranulf, who removes the holder at once and asks the
     bank for a new one: Aldegonde, 28 days later. A tabletop really runs no step, so it finds nothing
     about the token. Quarterly checks fall on the last day of each quarter. The monthly full-scale
     falls on each second Thursday.
     Results: functional or full-scale each March fails on Thursday 12 March 2026, Aldegonde enrolled
     Thursday 9 April 2026 (223 days with no active key holder). Quarterly check finds it on Tuesday
     30 September 2025, enrolled Tuesday 28 October 2025 (60 days). Monthly full-scale fails on
     Thursday 11 September 2025, enrolled Thursday 9 October 2025 (41 days). As built: 29 August 2025
     to Friday 16 October 2026, 413 days.
   - Tonight (the post): storage fault 01:20; step 1 to 01:35, step 2 to 02:20, step 3 to 03:10
     (second site up, file of 12,000 payments). Step 4 from 03:10: each departed holder in the plan
     costs 6 minutes (03:10 to 03:16, the disconnected tone). An active holder drives 40 minutes to
     Ormsgill and spends 10 minutes at the token (given data): called at 03:10, file sent at 04:00;
     called at 03:16, sent at 04:06.
   - Costs a year (given data): tabletop 8 people x 3 hours = 24 staff-hours (16 people: 48);
     functional 3 people x 4 hours = 12; full-scale 8 people x 10 hours = 80 and the real Thursday
     run moves to Ormsgill; monthly full-scale 12 x 80 = 960 and 12 runs moved; quarterly check
     4 x 2 hours = 8.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PEOPLE = "12,000";
  var FIRMS = 40;
  var ENROL_DAYS = 28;              // the bank's 4 weeks to enrol a new key holder
  var DEAD_MIN = 6;                 // 03:10 to 03:16: one call to a dead number
  var DRIVE_MIN = 40;               // an active holder's drive to Ormsgill
  var SIGN_MIN = 10;                // typing the PIN, signing, sending
  var STEPS = [                     // tonight, in minutes after midnight
    { n: 1, start: 80, end: 95, what: "declare \"main system down\" and call Ranulf" },
    { n: 2, start: 95, end: 140, what: "start the payroll system at Ormsgill, the second site" },
    { n: 3, start: 140, end: 190, what: "load last night's copy and rerun tonight's pay" }
  ];
  var STEP4 = 190;                  // 03:10
  var CUTOFF = 330;                 // 05:30
  var COST = { tabletop: 24, tabletop16: 48, functional: 12, fullscale: 80, monthly: 960, quarterly: 8 };

  function day(y, m, d) { return Date.UTC(y, m - 1, d) / 86400000; }
  var KISEMBER_LEFT = day(2025, 8, 29);
  var TONIGHT = day(2026, 10, 16);
  var MONTHS = [];
  (function () {
    for (var i = 0; i < 20; i++) {
      var y = 2025 + Math.floor((2 + i) / 12);
      var m = ((2 + i) % 12) + 1;
      MONTHS.push({ y: y, m: m, first: day(y, m, 1), last: day(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1 });
    }
  })();
  var QUARTERS = [day(2025, 3, 31), day(2025, 6, 30), day(2025, 9, 30), day(2025, 12, 31), day(2026, 3, 31), day(2026, 6, 30), day(2026, 9, 30)];

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function asDate(n) { return new Date(n * 86400000); }
  function longDate(n) { var d = asDate(n); return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTH[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function shortDate(n) { var d = asDate(n); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function monthName(i) { return MONTH[MONTHS[i].m - 1] + " " + MONTHS[i].y; }
  function monthsBetween(a, b) { var x = asDate(a); var y = asDate(b); return (y.getUTCFullYear() * 12 + y.getUTCMonth()) - (x.getUTCFullYear() * 12 + x.getUTCMonth()); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(min) { return two(Math.floor(min / 60)) + ":" + two(min % 60); }
  function secondThursday(y, m) {
    var d = day(y, m, 1);
    while (asDate(d).getUTCDay() !== 4) d += 1;
    return d + 7;
  }

  var ITEMS = [
    { value: "none", label: "no owner, no due date (as built)" },
    { value: "owned", label: "an owner and a due date for each item" }
  ];
  var EXERCISES = [
    { value: "tabletop", label: "tabletop: talk the plan through (as built)" },
    { value: "functional", label: "functional: really sign a test file with the backup key at Ormsgill" },
    { value: "fullscale", label: "full-scale: all four steps for real, a real bank file" }
  ];
  var TYPE_NAME = { tabletop: "tabletop", functional: "functional exercise", fullscale: "full-scale exercise" };

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model ---------- */

  // The dated events for these settings, before any of them has run.
  function schedule(C) {
    var ev = [];
    function add(d, kind, p, extra) { var e = { d: d, kind: kind, p: p }; if (extra) e.type = extra; ev.push(e); }
    if (C.monthly) {
      MONTHS.forEach(function (mo) {
        var d = secondThursday(mo.y, mo.m);
        if (d < TONIGHT) add(d, "exercise", 3, "fullscale");
      });
    } else {
      add(day(2025, 3, 13), "exercise", 3, C.exercise);
      add(day(2026, 3, 12), "exercise", 3, C.exercise);
    }
    add(day(2025, 3, 20), "review", 4);
    add(day(2026, 3, 19), "review2", 4);
    if (C.software) add(day(2025, 5, 1), "software", 6);
    if (C.items === "owned") add(day(2025, 6, 30), "due", 0);
    add(KISEMBER_LEFT, "leave", 2);
    if (C.quarterly) QUARTERS.forEach(function (q) { add(q, "quarter", 5); });
    return ev;
  }

  function sortEvents(ev) { ev.sort(function (a, b) { return a.d - b.d || a.p - b.p; }); }

  function isGone(h, d) { return h.left !== null && h.left <= d; }
  function active(S, d) { return S.holders.filter(function (h) { return !isGone(h, d); }).length; }

  function note(S, d, msg, tone) { S.out.push({ msg: msg, tone: tone || "" }); }

  function setNoKey(S, d) {
    var a = active(S, d);
    if (a === 0 && S.since === null) S.since = d;
    if (a > 0 && S.since !== null) { S.nokey += d - S.since; S.since = null; }
  }

  function bump(S) { S.version += 1; }

  function askBank(S, d) {
    if (S.pending) return;
    S.pending = true;
    S.queue.push({ d: d + ENROL_DAYS, kind: "enrol", p: 1 });
    sortEvents(S.queue);
    note(S, d, "Ranulf, the plan's owner, asks the bank to enrol a new key holder: four weeks.", "warn");
  }

  function removeGone(S, d, why) {
    var gone = S.holders.filter(function (h) { return isGone(h, d); });
    if (!gone.length) return false;
    S.holders = S.holders.filter(function (h) { return !isGone(h, d); });
    bump(S);
    note(S, d, why + ": J. Kisember's number is dead; he left on " + longDate(KISEMBER_LEFT) + ". He comes off the plan: version " + S.version + ".", "warn");
    return true;
  }

  function closeR7(S, d) {
    if (S.r7 && !S.r7.closed && active(S, d) >= 2) {
      S.r7.closed = d;
      note(S, d, "R-7 closed: two active key holders.", "ok");
    }
  }

  function runEvent(S, e) {
    var C = S.C;
    var d = e.d;
    var when = longDate(d);
    if (e.kind === "exercise") {
      var type = e.type;
      var label = TYPE_NAME[type];
      if (type === "tabletop") {
        var who = C.people ? 16 : 8;
        S.lastex = shortDate(d) + " tabletop (" + who + " people): PASS, steps really run: none";
        note(S, d, when + ": tabletop, " + who + " people round the table. Steps really run: none; steps 1 to 4 talked through, and at step 4 someone says \"the key holder signs\". PASS.", "");
        return;
      }
      var real = type === "functional" ? "step 4: a test file signed with the backup key at Ormsgill" : "steps 1 to 4 for real, the real Thursday file sent from Ormsgill";
      removeGone(S, d, when + ", " + label + ", step 4");
      setNoKey(S, d);
      var signer = S.holders.filter(function (h) { return !isGone(h, d); })[0];
      if (signer) {
        S.lastex = shortDate(d) + " " + label + ": PASS, steps really run: " + (type === "functional" ? "4" : "1 to 4");
        note(S, d, when + ": " + label + ". Really run: " + real + ". " + signer.name + " types the PIN and signs. PASS.", "ok");
      } else {
        S.lastex = shortDate(d) + " " + label + ": FAIL at step 4";
        note(S, d, when + ": " + label + ". Really run: " + real + ". Nobody knows the token's PIN. FAIL at step 4" +
          (type === "fullscale" ? "; the run goes back to the main system and is signed there with the main key." : "."), "bad");
        askBank(S, d);
      }
      return;
    }
    if (e.kind === "review") {
      S.r7 = { raised: d, owner: C.items === "owned" ? "Ranulf" : null, due: C.items === "owned" ? day(2025, 6, 30) : null, closed: null };
      note(S, d, when + ": after-action review. Item R-7 raised: \"only one active key holder, J. Kisember; add a second\". Owner: " +
        (S.r7.owner ? "Ranulf, due " + longDate(S.r7.due) : "(blank), no due date") + ".", S.r7.owner ? "ok" : "warn");
      return;
    }
    if (e.kind === "review2") {
      if (S.r7 && !S.r7.closed) note(S, d, when + ": after-action review. R-7 copied forward: open, " + monthsBetween(S.r7.raised, d) + " months old, owner " + (S.r7.owner || "(blank)") + ".", "warn");
      else note(S, d, when + ": after-action review. No item from last year is still open.", "ok");
      return;
    }
    if (e.kind === "software") {
      S.lives = "continuity software";
      note(S, d, when + ": review items move into continuity software. R-7 comes across with owner " + (S.r7 && S.r7.owner ? "Ranulf; reminders go to him." : "(blank): the software reminds owners, and R-7 has none."), "");
      return;
    }
    if (e.kind === "due") {
      if (S.holders.some(function (h) { return h.name === "Aldegonde"; })) return;
      S.holders.push({ name: "Aldegonde", left: null });
      bump(S);
      note(S, d, when + ": R-7's due date. Ranulf asked the bank on Monday 2 June; Aldegonde is enrolled as a second key holder. Plan version " + S.version + ".", "ok");
      setNoKey(S, d);
      closeR7(S, d);
      return;
    }
    if (e.kind === "leave") {
      note(S, d, when + ": J. Kisember leaves Brinkwell. His token stays in the Ormsgill safe; its PIN leaves with him. Active key holders: " + active(S, d) + ".", active(S, d) ? "warn" : "bad");
      setNoKey(S, d);
      return;
    }
    if (e.kind === "quarter") {
      if (removeGone(S, d, when + ", quarterly contact check")) {
        setNoKey(S, d);
        if (active(S, d) === 0) askBank(S, d);
      } else {
        note(S, d, when + ": quarterly contact check. Every contact and key holder answers.", "");
      }
      return;
    }
    if (e.kind === "enrol") {
      S.pending = false;
      if (!S.holders.some(function (h) { return h.name === "Aldegonde"; })) {
        S.holders.push({ name: "Aldegonde", left: null });
        bump(S);
      }
      note(S, d, when + ": Aldegonde is enrolled by the bank as a key holder. Plan version " + S.version + "; active key holders: " + active(S, d) + ".", "ok");
      setNoKey(S, d);
      closeR7(S, d);
    }
  }

  function nextMonth(S) {
    if (S.month >= MONTHS.length) return false;
    var mo = MONTHS[S.month];
    while (S.queue.length && S.queue[0].d <= mo.last) runEvent(S, S.queue.shift());
    S.at = mo.last;
    S.month += 1;
    return true;
  }

  function playNight(S) {
    if (S.night) return false;
    S.night = true;
    note(S, TONIGHT, "Thursday 15 October 2026, the run. 01:20 storage alarm: \"main storage fault, run stopped\".", "bad");
    STEPS.forEach(function (s) {
      note(S, TONIGHT, hhmm(s.start) + " step " + s.n + ": " + s.what + ". Done at " + hhmm(s.end) + (s.n === 3 ? ": the second site is up and the file holds " + PEOPLE + " payments." : "."), "ok");
    });
    note(S, TONIGHT, "03:10 step 4: the guard opens the Ormsgill safe; the token asks for its PIN. The plan lists: " +
      (S.holders.length ? S.holders.map(function (h) { return h.name; }).join(", ") : "nobody") + ".", "");
    var t = STEP4;
    var sent = null;
    for (var i = 0; i < S.holders.length; i++) {
      var h = S.holders[i];
      note(S, TONIGHT, hhmm(t) + " calling " + h.name + ".", "");
      if (isGone(h, TONIGHT)) {
        t += DEAD_MIN;
        note(S, TONIGHT, hhmm(t) + " Kisember's number plays the disconnected tone.", "bad");
        continue;
      }
      sent = t + DRIVE_MIN + SIGN_MIN;
      note(S, TONIGHT, hhmm(sent) + " " + h.name + " has driven to Ormsgill, types the PIN, and the file is signed and sent.", "ok");
      break;
    }
    if (sent === null) {
      S.step4 = "failed " + hhmm(t);
      note(S, TONIGHT, hhmm(t) + " no other key holder in the plan. Step 4 failed, " + (t - STEP4) + " minutes after it began.", "bad");
      note(S, TONIGHT, "05:30 the bank's cut-off passes with no file. " + PEOPLE + " people at " + FIRMS + " firms will be paid on Monday 19 October, the bank's next processing day.", "bad");
      S.paid = "Monday 19 October";
    } else {
      S.step4 = "signed " + hhmm(sent);
      note(S, TONIGHT, hhmm(CUTOFF) + " the bank's cut-off: the file came in at " + hhmm(sent) + ". " + PEOPLE + " people at " + FIRMS + " firms paid on Friday 16 October.", "ok");
      S.paid = "Friday 16 October";
    }
    S.at = TONIGHT;
    return true;
  }

  function noKeyDays(S) { return S.nokey + (S.since !== null ? Math.max(0, Math.min(S.at, TONIGHT) - S.since) : 0); }

  function costs(C) {
    var c = C.monthly ? COST.monthly : (C.exercise === "tabletop" ? (C.people ? COST.tabletop16 : COST.tabletop) : COST[C.exercise]);
    return c + (C.quarterly ? COST.quarterly : 0);
  }
  function moved(C) { return C.monthly ? 12 : (C.exercise === "fullscale" ? 1 : 0); }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": "dg-axis", "text-anchor": anchor || "middle" }, g);
    t.textContent = s;
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style) { var e = doc.createElement(tag); if (style) e.setAttribute("style", style); return e; }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", { viewBox: "0 0 660 96", width: "100%", "class": "dg", role: "img",
      "aria-label": "The months from March 2025 to October 2026, then tonight. Grey: not reached yet. Green: a month with an active key holder at its end. Red: a month with none." });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var list = el("div", "margin:0;font-size:12px;white-space:pre-wrap;font-family:var(--mono, monospace);");
    box.appendChild(list);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, list: list };
  }

  function drawMonths(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    txt(doc, g, 10, 14, "Active key holders at each month's end, March 2025 to tonight", "start");
    for (var i = 0; i <= MONTHS.length; i++) {
      var x = 10 + i * 30.5;
      var fill = "var(--faint)";
      if (i < S.marks.length) fill = S.marks[i] > 0 ? "var(--green)" : "var(--red)";
      mk(doc, "rect", { x: x, y: 26, width: 26, height: 34, rx: 4, style: "fill:" + fill + ";opacity:.85" }, g);
    }
    txt(doc, g, 23, 78, "Mar 25");
    txt(doc, g, 10 + 17 * 30.5 + 13, 78, "Aug 26");
    txt(doc, g, 10 + 20 * 30.5 + 13, 78, "night");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Review items: " + pick(ITEMS, C.items).label + "; each March: " + pick(EXERCISES, C.exercise).label +
      (C.people ? "; 16 people round the tabletop" : "") + (C.quarterly ? "; quarterly contact check" : "") +
      (C.monthly ? "; full-scale every month" : "") + (C.software ? "; continuity software" : "") + ".";
    drawMonths(S);
    S.ui.list.textContent = "Exercises: 9 Mar 2023 tabletop: PASS; 14 Mar 2024 tabletop: PASS" + (S.exList.length ? "; " + S.exList.join("; ") : "") + ".";
    var r7 = "not raised yet";
    if (S.r7) {
      if (S.r7.closed) r7 = "closed " + shortDate(S.r7.closed);
      else r7 = monthsBetween(S.r7.raised, S.at) + " months, " + (S.r7.owner ? "owner Ranulf" : "no owner");
    }
    S.stat.now(S.night ? "tonight, 05:30" : (S.month === 0 ? "before March 2025" : monthName(S.month - 1)));
    S.stat.version("v" + S.version);
    S.stat.open(S.r7 && !S.r7.closed ? 1 : 0);
    S.stat.age("R-7: " + r7);
    S.stat.holders(active(S, S.at));
    S.stat.lastex(S.lastex);
    S.stat.nokey(noKeyDays(S));
    S.stat.step4(S.step4);
    S.stat.paid(S.paid);
    S.stat.cost(costs(C));
    S.stat.moved(moved(C));
    S.stat.lives(S.lives);
  }

  function flush(api) {
    var S = api.state;
    S.out.forEach(function (o) {
      api.log(o.msg, o.tone);
      var m = /^(\w+day \d+ \w+ \d{4}): (tabletop|functional exercise|full-scale exercise)[^]*?(PASS|FAIL)/.exec(o.msg);
      if (m) S.exList.push(m[1].split(" ").slice(1).join(" ") + " " + m[2] + ": " + m[3]);
    });
    S.out = [];
  }

  function stepMonth(api) {
    var S = api.state;
    if (!nextMonth(S)) return false;
    S.marks.push(active(S, S.at));
    flush(api);
    return true;
  }

  function stepNight(api) {
    var S = api.state;
    if (!playNight(S)) return false;
    S.marks.push(S.step4.indexOf("signed") === 0 ? 1 : 0);
    flush(api);
    return true;
  }

  function restart(api, what) {
    var S = api.state;
    S.queue = schedule(S.C);
    sortEvents(S.queue);
    S.holders = [{ name: "J. Kisember", left: KISEMBER_LEFT }];
    S.version = 4;
    S.r7 = null;
    S.pending = false;
    S.month = 0;
    S.at = day(2025, 3, 1);
    S.since = null;
    S.nokey = 0;
    S.night = false;
    S.lastex = "14 Mar 2024 tabletop: PASS, steps really run: none";
    S.step4 = "not reached";
    S.paid = "not yet";
    S.lives = "spreadsheet";
    S.marks = [];
    S.exList = [];
    S.out = [];
    if (what) api.log(what + " Back to the start of March 2025.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e17", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { items: "none", exercise: "tabletop", people: false, quarterly: false, monthly: false, software: false };
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          restart(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key) {
        api.control.toggle(id, label, S.C[key], function (on) {
          S.C[key] = !!on;
          restart(api, label + ": " + (on ? "on." : "off."));
        });
      }
      sel("items", "review items", ITEMS, "items");
      sel("exercise", "exercise each March", EXERCISES, "exercise");
      tog("people", "more people round the tabletop (16, not 8)", "people");
      tog("quarterly", "check contacts and key holders each quarter", "quarterly");
      tog("monthly", "full-scale exercise every month (second Thursday)", "monthly");
      tog("software", "continuity software holds the plan and items (from May 2025)", "software");
      api.control.button("month", "next month", function () {
        if (!stepMonth(api) && !stepNight(api)) api.log("the night is over. Change a setting or start over.", "");
        draw(api);
      });
      api.control.button("play", "play to tonight", function () {
        while (stepMonth(api)) { /* every month left */ }
        if (!stepNight(api)) api.log("the night is over. Change a setting or start over.", "");
        draw(api);
      });
      api.control.button("over", "start over", function () { api.reset(); });

      S.stat = {
        now: api.stat("now", "where you are", ""),
        version: api.stat("version", "plan version", ""),
        open: api.stat("open", "open review items", "warn"),
        age: api.stat("age", "review item R-7", ""),
        holders: api.stat("holders", "active key holders", "ok"),
        lastex: api.stat("lastex", "last exercise", ""),
        nokey: api.stat("nokey", "days with no active key holder", "bad"),
        step4: api.stat("step4", "step 4 tonight", ""),
        paid: api.stat("paid", "12,000 people paid on", ""),
        cost: api.stat("cost", "exercise staff-hours a year", "warn"),
        moved: api.stat("moved", "real runs moved to Ormsgill a year", ""),
        lives: api.stat("lives", "where review items live", "")
      };

      api.info("<strong>How to read it.</strong> Each click of next month plays that month's dated events: exercises, after-action reviews, Kisember leaving, quarterly checks, enrolments. A tabletop really runs no step; a functional exercise really signs a test file with the backup key at Ormsgill; a full-scale runs all four steps for real. A real step 4 that finds no PIN goes to Ranulf, the plan's owner, who asks the bank for a new key holder: four weeks. After October 2026 the next click plays tonight. Boxes: green, an active key holder at the month's end; red, none.");

      restart(api, "");
      api.log("As built: plan version 4, one active key holder (J. Kisember), review items in a spreadsheet with no owners, a tabletop each March.", "warn");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { items: "none", exercise: "tabletop", people: false, quarterly: false, monthly: false, software: false };
      function as(set) {
        Object.keys(BUILT).forEach(function (k) { t.set(k, set && Object.prototype.hasOwnProperty.call(set, k) ? set[k] : BUILT[k]); });
      }

      // 1. Opening state: before the March 2025 tabletop.
      t.expect(t.stat("now") === "before March 2025" && t.stat("version") === "v4" && t.stat("open") === 0 &&
        t.stat("holders") === 1 && t.stat("nokey") === 0 && t.stat("paid") === "not yet",
        "Opens before March 2025: plan v4, one active key holder, no open items");

      // 2. March 2025: the tabletop passes and R-7 is raised with no owner.
      begin();
      t.click("month");
      t.expect(t.stat("open") === 1 && t.stat("age") === "R-7: 0 months, no owner" &&
        has("Thursday 13 March 2025: tabletop, 8 people round the table. Steps really run: none") &&
        has("Thursday 20 March 2025: after-action review. Item R-7 raised: \"only one active key holder, J. Kisember; add a second\". Owner: (blank), no due date."),
        "March 2025: the tabletop passes; R-7 is raised with no owner");

      // 3. As built, to tonight: PASS every year, step 4 fails at 03:16, paid Monday.
      t.click("play");
      t.expect(t.stat("holders") === 0 && t.stat("age") === "R-7: 19 months, no owner" && t.stat("version") === "v4" &&
        t.stat("lastex") === "12 Mar 2026 tabletop (8 people): PASS, steps really run: none" && t.stat("nokey") === 413 &&
        t.stat("step4") === "failed 03:16" && t.stat("paid") === "Monday 19 October" &&
        has("03:16 Kisember's number plays the disconnected tone.") &&
        has("03:16 no other key holder in the plan. Step 4 failed, 6 minutes after it began.") &&
        has("Thursday 19 March 2026: after-action review. R-7 copied forward: open, 12 months old, owner (blank)."),
        "As built: tabletops PASS, R-7 open 19 months, step 4 fails at 03:16, 12,000 paid Monday 19 October");

      // 4. An owner and a due date: Aldegonde enrolled 30 June 2025, before Kisember leaves.
      begin();
      as({ items: "owned" });
      t.click("play");
      t.expect(has("Monday 30 June 2025: R-7's due date. Ranulf asked the bank on Monday 2 June; Aldegonde is enrolled as a second key holder. Plan version 5.") &&
        t.stat("open") === 0 && t.stat("nokey") === 0 && t.stat("holders") === 1 && t.stat("version") === "v5" &&
        t.stat("step4") === "signed 04:06" && t.stat("paid") === "Friday 16 October",
        "Owned item: second holder before Kisember leaves; tonight a dead number at 03:16, then the file at 04:06");

      // 5. Functional each March: fails step 4 on 12 March 2026, found then.
      begin();
      as({ exercise: "functional" });
      t.click("play");
      t.expect(has("Thursday 12 March 2026: functional exercise. Really run: step 4: a test file signed with the backup key at Ormsgill. Nobody knows the token's PIN. FAIL at step 4.") &&
        has("Thursday 9 April 2026: Aldegonde is enrolled by the bank as a key holder.") &&
        t.stat("nokey") === 223 && t.stat("step4") === "signed 04:00" && t.stat("open") === 1 && t.stat("cost") === 12,
        "Functional: 12 March 2026 fails step 4; Aldegonde by 9 April; tonight signed 04:00; R-7 still ownerless");

      // 6. Quarterly check: finds the departed holder on 30 September 2025.
      begin();
      as({ quarterly: true });
      t.click("play");
      t.expect(has("Tuesday 30 September 2025, quarterly contact check: J. Kisember's number is dead") &&
        has("Tuesday 28 October 2025: Aldegonde is enrolled") && t.stat("nokey") === 60 && t.stat("step4") === "signed 04:00",
        "Quarterly check: finds Kisember gone on 30 September 2025; 60 days with no key holder");

      // 7. Monthly full-scale: fails 11 September 2025; 960 staff-hours and 12 runs moved.
      begin();
      as({ monthly: true });
      t.click("play");
      t.expect(has("Thursday 11 September 2025: full-scale exercise.") && has("FAIL at step 4; the run goes back to the main system") &&
        t.stat("nokey") === 41 && t.stat("cost") === 960 && t.stat("moved") === 12 && t.stat("paid") === "Friday 16 October",
        "Monthly full-scale: found 11 September 2025, 41 days; but 960 staff-hours and 12 real runs moved a year");

      // 8. Continuity software: R-7 moves across with no owner; tonight still fails.
      begin();
      as({ software: true });
      t.click("play");
      t.expect(t.stat("lives") === "continuity software" && t.stat("age") === "R-7: 19 months, no owner" &&
        t.stat("step4") === "failed 03:16" && has("R-7 comes across with owner (blank)"),
        "Software: the item moves, ownerless; step 4 fails at 03:16");

      // 9. More people round the tabletop: still PASS, still nothing really run.
      as({ people: true });
      t.click("play");
      t.expect(t.stat("lastex") === "12 Mar 2026 tabletop (16 people): PASS, steps really run: none" && t.stat("cost") === 48 &&
        t.stat("step4") === "failed 03:16" && t.stat("paid") === "Monday 19 October",
        "16 people at the tabletop: PASS, 48 staff-hours, and step 4 still fails at 03:16");

      // 10. Full-scale each March: fails 12 March 2026; one real run moved a year.
      as({ exercise: "fullscale" });
      t.click("play");
      t.expect(t.stat("lastex") === "12 Mar 2026 full-scale exercise: FAIL at step 4" && t.stat("nokey") === 223 &&
        t.stat("moved") === 1 && t.stat("cost") === 80 && t.stat("step4") === "signed 04:00",
        "Full-scale each March: finds it on 12 March 2026, 80 staff-hours, one real run moved");

      // 11. The fix: owners and dates, a functional exercise, quarterly checks.
      as({ items: "owned", exercise: "functional", quarterly: true });
      t.click("play");
      t.expect(t.stat("version") === "v6" && t.stat("open") === 0 && t.stat("nokey") === 0 && t.stat("holders") === 1 &&
        t.stat("lastex") === "12 Mar 2026 functional exercise: PASS, steps really run: 4" && t.stat("cost") === 20 &&
        t.stat("step4") === "signed 04:00" && t.stat("paid") === "Friday 16 October",
        "The fix: owned item, quarterly check, functional exercise: no day without a key holder, file at 04:00, 20 staff-hours a year");
    }
  });
})();
