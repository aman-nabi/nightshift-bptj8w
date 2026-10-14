/* sims/s6e17-v1.0.0.js  (published as sims/s6e17.js)
   Case s6e17 "The Night the Lights Went Out": a recovery lab for Ulverby General's IT night shift.
   At 01:20 a substation fault stops the data room's cooling; at 01:30 Chibuzo shuts the room
   down; from 01:40 the second site at Selsby restores seven systems from their last copies. The
   learner sets the recovery order, the targets the report uses, the runbook workarounds, the
   pharmacy's copy schedule, the cause and the new generator, or turns on a tabletop mode where
   four timed injects arrive as posts and the run stops until the learner makes the call.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: order (supplier default smallest first, by process
     deadline, all at once); report targets (one 8-hour target, 1 hour for every system, per
     process from the impact analysis); runbook workarounds on or off; pharmacy copies once a day
     at 20:00 or every 15 minutes; cause (substation fault or burst pipe); new generator and second
     cooling unit; tabletop mode with four injects. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - One step is 10 minutes. The night opens at 01:10 with nothing run (step 0); each step moves
     the clock on 10 minutes and runs that moment. Inside a moment: restores in progress get the
     last 10 minutes of work and any that complete are logged; then the night's events (01:20
     fault, 01:30 shutdown, 01:40 restores begin); then free capacity starts the next restore;
     then the report line if all are back; then any tabletop inject.
   - The plan's table, smallest first (place 1 to 7), restore minutes, process deadline counted
     from 01:20: staff directory 50 min, 3 days; payroll 60, 3 days; email 60, 24 h; theatre
     lists 60, 6 h; pharmacy 60, 3 h; admissions 60, 4 h; lab results 70, 1 h.
   - Capacity: the link to Selsby and the two engineers give 10 minutes of restore work per step.
     Restores running together share it equally. Work is counted in units of 1/420 minute so the
     shares are whole numbers: 4,200 units a step, 4,200 / n each for n restores (n = 1 to 7).
   - Supplier order: by place (size). Deadline order: by deadline, ties by place. All at once:
     every waiting restore starts together.
   - Copies: every system's last copy is from 01:00 (finished 01:12), except the pharmacy's: once
     a day at 20:00, or every 15 minutes (last one 01:15; the 01:30 copy never ran). Dose changes
     after 20:00 (given data from the pharmacy's own list, minutes after 20:00): 11 from 20:00 to
     21:00, 9 to 22:00, 12 to 23:00, 6 to 00:00, 5 to 01:00, 3 from 01:00 to 01:30 (01:05, 01:12,
     01:24): 46 in all.
   - Report targets: 8 hours for all (due 09:20), 1 hour for all (due 02:20), or each process's
     deadline. Wards' view: time past each process's deadline, summed; covered when a runbook
     workaround runs for it.
   - New generator and second cooling unit: with the substation fault, the room stays up and
     nothing is restored. A burst pipe floods the room whatever the generator, so the night runs
     as last night.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e17-v1.0.0.json).
   The hole closed: first restore 01:40; supplier order 50 + 60 + 60 + 60 + 60 + 60 + 70 = 420
   minutes = 7 h, so the last restore ends at 08:40, inside the 8-hour target of 09:20 (01:20 +
   8 h). Payroll is second: 01:40 + 50 = 02:30, + 60 = 03:30.
   - Supplier order: directory 01:40 to 02:30, payroll 02:30 to 03:30, email 03:30 to 04:30, theatre
     lists 04:30 to 05:30, pharmacy 05:30 to 06:30, admissions 06:30 to 07:30, lab results 07:30 to
     08:40. Missed: pharmacy (due 04:20) by 2 h 10 min, admissions (due 05:20) by 2 h 10 min, lab
     results (due 02:20) by 6 h 20 min: 3 of 7, 10 h 40 min. Report: all systems restored within
     target. With a 1-hour target for all: 0 of 7 (the directory ends at 02:30, 70 min after
     01:20). With per-process targets: 4 of 7.
   - Deadline order: lab results 01:40 to 02:50 (missed by 30 min), pharmacy to 03:50, admissions
     to 04:50, theatre lists to 05:50, email to 06:50, directory to 07:40, payroll to 08:40.
     1 of 7, 30 min. Report: all systems restored within target at 08:40.
   - All at once: 7 share 4,200 units a step, 600 each. The directory (21,000 units) ends after 35
     steps, 07:30. The other six have 4,200 units left (lab results 8,400); 6 share, 700 each, so
     the five 60-minute restores end 6 steps later, 08:30; lab results then has 4,200 left and ends
     alone at 08:40. Missed: lab results by 6 h 20 min, pharmacy by 4 h 10 min, admissions by
     3 h 10 min, theatre lists (due 07:20) by 1 h 10 min: 4 of 7, 14 h 50 min.
   - Pharmacy copy at 20:00: 46 dose changes missing; every 15 minutes: 1 (01:24).
   - Tabletop, every call senior: the directory ends 02:30, then deadline order: lab results 02:30
     to 03:40 (missed by 1 h 20 min, covered by the paper round), pharmacy to 04:40 (by 20 min),
     admissions to 05:40 (by 20 min), theatre lists to 06:40, email to 07:40, payroll to 08:40.
     2 h past deadlines, 40 min of it uncovered; calls 4 of 4.
*/
(function () {
  "use strict";

  var T0 = 70;            // 01:10, step 0, in minutes after midnight
  var FAULT = 80;         // 01:20
  var SHUT = 90;          // 01:30
  var BEGIN = 100;        // 01:40
  var END = 540;          // 09:00
  var STEP = 10;
  var UNIT = 420;         // work units per minute of restore
  var CAP = STEP * UNIT;  // 4,200 units of work per step

  var SYS = [
    { id: "directory", name: "staff directory", place: 1, mins: 50, due: 4320, dueText: "3 days" },
    { id: "payroll", name: "payroll", place: 2, mins: 60, due: 4320, dueText: "3 days" },
    { id: "email", name: "email", place: 3, mins: 60, due: 1440, dueText: "24 h" },
    { id: "theatre", name: "theatre lists", place: 4, mins: 60, due: 360, dueText: "6 h" },
    { id: "pharmacy", name: "pharmacy", place: 5, mins: 60, due: 180, dueText: "3 h" },
    { id: "admissions", name: "admissions", place: 6, mins: 60, due: 240, dueText: "4 h" },
    { id: "lab", name: "lab results", place: 7, mins: 70, due: 60, dueText: "1 h" }
  ];
  // Pharmacy dose changes, in minutes after 20:00 (the shutdown at 01:30 is minute 330).
  var DOSES = [4, 9, 13, 18, 22, 27, 33, 38, 44, 51, 57,
    63, 70, 76, 84, 91, 97, 105, 112, 118,
    121, 124, 127, 131, 134, 138, 142, 147, 153, 160, 168, 175,
    186, 197, 209, 218, 227, 236,
    249, 262, 274, 286, 297,
    305, 312, 324];

  var ORDERS = [
    { value: "supplier", label: "Supplier default: smallest first (the plan)" },
    { value: "deadline", label: "By process deadline, shortest first" },
    { value: "all", label: "All at once" }
  ];
  var TARGETS = [
    { value: "one8", label: "One target for all: 8 hours (the plan)" },
    { value: "one1", label: "1 hour for every system" },
    { value: "bia", label: "Per process, from the impact analysis" }
  ];
  var PCOPY = [
    { value: "daily", label: "Once a day at 20:00 (as built)" },
    { value: "q15", label: "Every 15 minutes" }
  ];
  var CAUSES = [
    { value: "substation", label: "Substation fault, cooling lost (last night)" },
    { value: "pipe", label: "A pipe bursts over the data room" }
  ];

  var INJECTS = [
    { at: 110, from: "the ED charge nurse", text: "The lab's machines are still testing blood and nobody can see the results. What now?",
      choices: [
        { value: "wait", label: "Wait for the lab system to come back", tone: "bad", say: "Results sit in the lab until the system returns." },
        { value: "ed", label: "Send ED porters for ED's own results only", tone: "warn", say: "The ED gets paper; the wards upstairs get nothing." },
        { value: "round", label: "Start the lab's paper round for every ward, urgent results by phone", tone: "ok", say: "The runbook's paper round starts; lab results are covered until the system is back." }
      ] },
    { at: 140, from: "Draycott's support line", text: "The staff directory finishes at 02:30. Next in the plan is payroll. Carry on?",
      choices: [
        { value: "keep", label: "Carry on with the plan's order", tone: "bad", say: "Payroll next, lab results last." },
        { value: "deadline", label: "Lab results next, then the rest by deadline", tone: "ok", say: "From 02:30 the restores follow the process deadlines." },
        { value: "all", label: "Start all six remaining at once", tone: "bad", say: "From 02:30 six restores share the link and the two engineers." }
      ] },
    { at: 240, from: "the switchboard", text: "A daughter asks if her father's ward is safe, and local radio wants a statement.",
      choices: [
        { value: "it", label: "Put the IT night shift on the phone", tone: "bad", say: "Chibuzo stops restoring to answer calls." },
        { value: "quiet", label: "Say nothing until the morning", tone: "bad", say: "The radio reports the hospital won't say what is wrong." },
        { value: "script", label: "The commander's agreed words: a script for families, the communications lead for the radio", tone: "ok", say: "Families hear the same words from the switchboard; the radio gets one statement." }
      ] },
    { at: null, from: "Marjatta, night pharmacist", text: "Pharmacy is back from its last copy. Every dose change after that copy is missing.",
      choices: [
        { value: "trust", label: "Use the restored records as they are", tone: "bad", say: "The next round gives the old doses." },
        { value: "check", label: "Check every change since the copy against the paper charts first", tone: "ok", say: "Each change is checked bed by bed before the next round." },
        { value: "stop", label: "Stop all medicines until the morning", tone: "bad", say: "Patients miss doses they need." }
      ] }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hhmm(m) { return two(Math.floor(m / 60) % 24) + ":" + two(m % 60); }
  function dur(m) {
    var h = Math.floor(m / 60);
    var r = m % 60;
    if (h === 0) return r + " min";
    if (r === 0) return h + " h";
    return h + " h " + r + " min";
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }

  /* ---------- the model ---------- */

  function newNight(C) {
    var R = { C: C, m: T0, order: C.order, sys: [], active: [], begun: false, noRestore: false, done: false,
      report: "not yet", doses: null, labCovered: false, pending: -1, calls: [0, 0, 0, 0], good: 0, events: [] };
    SYS.forEach(function (s) {
      R.sys.push({ s: s, left: s.mins * UNIT, start: null, end: null });
    });
    return R;
  }

  function say(R, msg, tone) { R.events.push({ msg: hhmm(R.m) + " " + msg, tone: tone || "" }); }

  function lastCopy(C) { return C.pcopy === "q15" ? 315 : 0; }   // minutes after 20:00
  function dosesLost(C) {
    var from = lastCopy(C);
    return DOSES.filter(function (t) { return t > from && t < 330; }).length;
  }

  function waiting(R) { return R.sys.filter(function (x) { return x.start === null; }); }
  function sorted(R, list) {
    var by = R.order === "deadline" ?
      function (a, b) { return (a.s.due - b.s.due) || (a.s.place - b.s.place); } :
      function (a, b) { return a.s.place - b.s.place; };
    return list.slice().sort(by);
  }

  function lateOf(R, x) {
    if (R.noRestore || R.m < FAULT) return 0;
    var upTo = x.end !== null ? x.end : R.m;
    return Math.max(0, upTo - (FAULT + x.s.due));
  }
  function covered(R, x) { return R.C.work || (x.s.id === "lab" && R.labCovered); }
  function wards(R) {
    var w = { missed: 0, late: 0, open: 0 };
    R.sys.forEach(function (x) {
      var l = lateOf(R, x);
      if (l > 0) w.missed += 1;
      w.late += l;
      if (!covered(R, x)) w.open += l;
    });
    return w;
  }

  function targetOf(C, x) {
    if (C.targets === "one1") return 60;
    if (C.targets === "bia") return x.s.due;
    return 480;
  }
  function verdict(R) {
    var met = R.sys.filter(function (x) { return x.end - FAULT <= targetOf(R.C, x); }).length;
    return met === R.sys.length ? "all systems restored within target" : met + " of " + R.sys.length + " restored within target";
  }

  function finishLine(R, x) {
    var late = x.end - (FAULT + x.s.due);
    var msg = x.s.name + " restored (" + hhmm(x.start) + " to " + hhmm(x.end) + "). Deadline " + x.s.dueText + ": " +
      (late > 0 ? "missed by " + dur(late) : "met") + ".";
    if (x.s.id === "pharmacy") {
      R.doses = dosesLost(R.C);
      msg += " " + R.doses + (R.doses === 1 ? " dose change" : " dose changes") + " made after its last copy at " +
        (R.C.pcopy === "q15" ? "01:15" : "20:00") + (R.doses === 1 ? " is missing." : " are missing.");
    }
    say(R, msg, late > 0 ? "bad" : "ok");
  }

  // Runs the next moment (10 minutes).
  function stepMoment(R) {
    var C = R.C;
    R.m += STEP;
    var m = R.m;
    var finished = [];
    if (R.active.length) {
      var share = CAP / R.active.length;
      R.active.forEach(function (x) {
        x.left -= share;
        if (x.left <= 0) { x.left = 0; x.end = m; finished.push(x); }
      });
      R.active = R.active.filter(function (x) { return x.end === null; });
      finished.forEach(function (x) { finishLine(R, x); });
    }
    if (m === FAULT) {
      if (C.cause === "pipe") {
        say(R, "A pipe bursts over the data room. Water reaches the racks.", "bad");
      } else if (C.gen) {
        R.noRestore = true;
        R.report = "no restore needed";
        R.doses = 0;
        say(R, "Substation fault. The new generator carries the cooling, and the second unit runs: the data room stays up.", "ok");
      } else {
        say(R, "Substation fault. The generators carry the wards and computers, not the data room's cooling.", "bad");
      }
    }
    if (m === SHUT && !R.noRestore) say(R, "Chibuzo shuts the data room down. Every system stops.", "warn");
    if (m === BEGIN && !R.noRestore) {
      R.begun = true;
      say(R, "Restores begin at Selsby: " + pick(ORDERS, R.order).label.toLowerCase() + ".", "");
    }
    if (R.begun && !R.done) {
      var wait = sorted(R, waiting(R));
      if (R.order === "all") {
        wait.forEach(function (x) { x.start = m; R.active.push(x); });
      } else if (!R.active.length && wait.length) {
        wait[0].start = m;
        R.active.push(wait[0]);
      }
      if (!R.active.length && !waiting(R).length) {
        R.done = true;
        R.report = verdict(R);
        say(R, "Report: " + R.report + ".", R.report.indexOf("all") === 0 ? "ok" : "bad");
      }
    }
    if (C.tabletop && !R.noRestore) {
      for (var k = 0; k < 3; k++) if (INJECTS[k].at === m) raise(R, k);
      finished.forEach(function (x) { if (x.s.id === "pharmacy") raise(R, 3); });
    }
  }

  function raise(R, k) {
    R.pending = k;
    var I = INJECTS[k];
    say(R, "INJECT " + (k + 1) + ", posted by " + I.from + ": " + I.text + " Choose your call, then press Make the call.", "warn");
  }

  function decide(R, choice) {
    if (R.pending < 0) { say(R, "No inject is waiting.", ""); return; }
    var k = R.pending;
    var c = null;
    INJECTS[k].choices.forEach(function (x) { if (x.value === choice) c = x; });
    if (!c) { say(R, "Choose a call for inject " + (k + 1) + " first.", ""); return; }
    if (k === 0 && c.value === "round") R.labCovered = true;
    if (k === 1 && c.value !== "keep") R.order = c.value;
    if (c.tone === "ok") R.good += 1;
    R.calls[k] = 1;
    R.pending = -1;
    say(R, "Your call on inject " + (k + 1) + ": " + c.label + ". " + c.say, c.tone);
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
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var hr = el("tr");
    ["system", "plan's place", "deadline", "restore", "deadline met", "workaround"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    var foot = el("p", "margin:0;font-size:12px;");
    [head, wrap, foot].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, foot: foot };
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var ui = S.ui;
    ui.head.textContent = "Order: " + pick(ORDERS, R.order).label + ". Report targets: " + pick(TARGETS, R.C.targets).label + "." +
      (R.C.tabletop ? " Tabletop mode: the run stops at each inject." : "");
    clear(ui.tbody);
    R.sys.forEach(function (x) {
      var tr = ui.el("tr");
      var restore = R.noRestore ? "not needed" : x.end !== null ? hhmm(x.start) + " to " + hhmm(x.end) :
        x.start !== null ? "restoring since " + hhmm(x.start) : "waiting";
      var l = lateOf(R, x);
      var met = R.noRestore ? "-" : l > 0 ? "missed by " + dur(l) + (x.end === null ? " so far" : "") : (x.end !== null ? "met" : "-");
      var wa = l > 0 ? (covered(R, x) ? "on paper" : "none") : "-";
      [x.s.name, String(x.s.place), x.s.dueText, restore, met, wa].forEach(function (c) {
        tr.appendChild(ui.el("td", "padding:2px 4px;", c));
      });
      ui.tbody.appendChild(tr);
    });
    var w = wards(R);
    ui.foot.textContent = "The report's view: " + R.report + ". The wards' view: " + w.missed + " of 7 deadlines missed, " +
      dur(w.late) + " past deadlines.";
    var back = R.sys.filter(function (x) { return x.end !== null; }).length;
    var act = R.active.map(function (x) { return x.s.name; });
    S.stat.now(hhmm(R.m));
    S.stat.restoring(act.length ? act.join(", ") : "none");
    S.stat.restored(back + " of 7");
    S.stat.lab(R.sys[6].end !== null ? hhmm(R.sys[6].end) : "-");
    S.stat.payroll(R.sys[1].end !== null ? hhmm(R.sys[1].end) : "-");
    S.stat.report(R.report);
    S.stat.missed(w.missed + " of 7");
    S.stat.late(dur(w.late));
    S.stat.uncovered(dur(w.open));
    S.stat.doses(R.doses === null ? "not yet" : R.doses);
    S.stat.calls(R.C.tabletop ? R.good + " of 4" : "off");
    var over = R.m >= END;
    var hold = R.pending >= 0;
    S.ctl.fwd.disable(over || hold);
    S.ctl.to0330.disable(R.m >= 210 || hold);
    S.ctl.all.disable(over || hold);
    S.ctl.decide.disable(!hold);
  }

  function flush(api) {
    var R = api.state.R;
    R.events.forEach(function (e) { api.log(e.msg, e.tone); });
    R.events = [];
  }

  function runTo(api, m) {
    var R = api.state.R;
    while (R.m < m && R.m < END && R.pending < 0) stepMoment(R);
    flush(api);
    draw(api);
  }

  function restartNight(api, why) {
    var S = api.state;
    S.R = newNight(S.C);
    S.R.events.push({ msg: (why ? why + " " : "") + "01:10 Before the fault. Order: " + pick(ORDERS, S.C.order).label.toLowerCase() +
      ". Report targets: " + pick(TARGETS, S.C.targets).label.toLowerCase() + ". Nothing restored yet.", tone: "" });
    flush(api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e17", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { order: "supplier", targets: "one8", work: false, pcopy: "daily", cause: "substation", gen: false, tabletop: false };
      S.choice = ["none", "none", "none", "none"];
      S.ui = buildWidget(api);
      S.ctl = {};
      function setting(id, label, list, key, word) {
        S.ctl[id] = api.control.select(id, label, list, S.C[key], function (v) {
          S.C[key] = pick(list, v).value;
          restartNight(api, word + ": " + pick(list, v).label.toLowerCase() + ".");
        });
      }
      setting("order", "Recovery order", ORDERS, "order", "Order");
      setting("targets", "Targets the report uses", TARGETS, "targets", "Report targets");
      setting("pcopy", "Pharmacy copies to Selsby", PCOPY, "pcopy", "Pharmacy copies");
      setting("cause", "What takes the data room out", CAUSES, "cause", "Cause");
      S.ctl.work = api.control.toggle("work", "Runbook workarounds for every process", false, function (on) {
        S.C.work = !!on;
        restartNight(api, "Runbook workarounds: " + (on ? "on." : "off."));
      });
      S.ctl.gen = api.control.toggle("gen", "Bigger generator and a second cooling unit", false, function (on) {
        S.C.gen = !!on;
        restartNight(api, "New generator and second cooling unit: " + (on ? "fitted." : "not fitted."));
      });
      S.ctl.tabletop = api.control.toggle("tabletop", "Tabletop mode: timed injects, you make the calls", false, function (on) {
        S.C.tabletop = !!on;
        S.C.order = "supplier";
        S.ctl.order.set("supplier");
        restartNight(api, "Tabletop mode: " + (on ? "on, starting from the plan's own order." : "off."));
      });
      S.ctl.fwd = api.control.button("fwd", "Forward 10 min", function () { runTo(api, S.R.m + STEP); });
      S.ctl.to0330 = api.control.button("to0330", "Run to 03:30", function () { runTo(api, 210); });
      S.ctl.all = api.control.button("all", "Run to 09:00", function () { runTo(api, END); });
      INJECTS.forEach(function (I, k) {
        var opts = [{ value: "none", label: "Choose when it arrives" }].concat(I.choices.map(function (c) { return { value: c.value, label: c.label }; }));
        S.ctl["call" + (k + 1)] = api.control.select("call" + (k + 1), "Inject " + (k + 1) + ": your call", opts, "none", function (v) {
          S.choice[k] = String(v);
        });
      });
      S.ctl.decide = api.control.button("decide", "Make the call", function () {
        var R = S.R;
        decide(R, R.pending >= 0 ? S.choice[R.pending] : "none");
        flush(api);
        draw(api);
      });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restartNight(api, "Night replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        restoring: api.stat("restoring", "restoring now", ""),
        restored: api.stat("restored", "systems restored", ""),
        lab: api.stat("lab", "lab results back at", "warn"),
        payroll: api.stat("payroll", "payroll back at", ""),
        report: api.stat("report", "the report says", "ok"),
        missed: api.stat("missed", "process deadlines missed", "bad"),
        late: api.stat("late", "time past deadlines, all processes", "bad"),
        uncovered: api.stat("uncovered", "of it with no workaround", "bad"),
        doses: api.stat("doses", "pharmacy dose changes missing", "bad"),
        calls: api.stat("calls", "tabletop: senior calls", "")
      };
      api.info("<strong>How to read it.</strong> Each step is 10 minutes. From 01:40 the second site restores seven systems; one restore alone gets the whole link and both engineers, and restores running together share them. The table shows each system's place in the plan (smallest first), its process deadline counted from 01:20, its restore window and whether the deadline was met. The report judges systems against its targets; the wards judge processes against their deadlines.");
      restartNight(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 01:10, before the fault: nothing restored, no verdict.
      t.expect(t.stat("now") === "01:10" && t.stat("restored") === "0 of 7" && t.stat("report") === "not yet" &&
        t.stat("lab") === "-" && t.stat("payroll") === "-" && t.stat("doses") === "not yet" &&
        has("01:10 Before the fault. Order: supplier default: smallest first (the plan)."),
        "Opens at 01:10, before the fault: nothing restored, no report yet");

      // 2. To 03:30: fault, shutdown, directory then payroll; payroll back at 03:30.
      t.click("to0330");
      t.expect(t.stat("now") === "03:30" && t.stat("payroll") === "03:30" && t.stat("restored") === "2 of 7" && t.stat("lab") === "-" &&
        has("01:20 Substation fault.") && has("01:30 Chibuzo shuts the data room down.") &&
        has("02:30 staff directory restored (01:40 to 02:30). Deadline 3 days: met.") &&
        has("03:30 payroll restored (02:30 to 03:30). Deadline 3 days: met."),
        "Smallest first: the directory by 02:30, payroll by 03:30, lab results not started");

      // 3. The record: lab results last at 08:40, all within the 8-hour target, three deadlines missed.
      t.click("all");
      t.expect(t.stat("now") === "09:00" && t.stat("lab") === "08:40" && t.stat("report") === "all systems restored within target" &&
        t.stat("missed") === "3 of 7" && t.stat("late") === "10 h 40 min" && t.stat("uncovered") === "10 h 40 min" && t.stat("doses") === 46 &&
        has("06:30 pharmacy restored (05:30 to 06:30). Deadline 3 h: missed by 2 h 10 min. 46 dose changes made after its last copy at 20:00 are missing.") &&
        has("08:40 lab results restored (07:30 to 08:40). Deadline 1 h: missed by 6 h 20 min.") &&
        has("08:40 Report: all systems restored within target."),
        "The record: all systems restored within target at 08:40; lab results last; 46 doses missing; 10 h 40 min past deadlines");

      // 4. Option 3: order by process deadline. Lab results at 02:50, payroll last, the same report line.
      t.set("order", "deadline");
      t.click("all");
      t.expect(t.stat("lab") === "02:50" && t.stat("payroll") === "08:40" && t.stat("report") === "all systems restored within target" &&
        t.stat("missed") === "1 of 7" && t.stat("late") === "30 min" &&
        has("02:50 lab results restored (01:40 to 02:50). Deadline 1 h: missed by 30 min."),
        "Deadline order: lab results at 02:50, payroll at 08:40, 30 min past deadlines, same report");

      // 5. Option 1: all at once. Everything later; lab results still 08:40.
      t.set("order", "all");
      t.click("all");
      t.expect(t.stat("lab") === "08:40" && t.stat("payroll") === "08:30" && t.stat("missed") === "4 of 7" &&
        t.stat("late") === "14 h 50 min" && has("07:30 staff directory restored (01:40 to 07:30).") &&
        has("08:30 theatre lists restored (01:40 to 08:30). Deadline 6 h: missed by 1 h 10 min."),
        "All at once: directory 07:30, five at 08:30, lab results 08:40; 14 h 50 min past deadlines");
      t.set("order", "supplier");

      // 6. Option 2: a 1-hour target for every system. Same order, honest report.
      t.set("targets", "one1");
      t.click("all");
      var one1 = t.stat("report") === "0 of 7 restored within target" && t.stat("lab") === "08:40" && t.stat("payroll") === "03:30" &&
        has("08:40 Report: 0 of 7 restored within target.");
      t.set("targets", "bia");
      t.click("all");
      t.expect(one1 && t.stat("report") === "4 of 7 restored within target" && t.stat("late") === "10 h 40 min",
        "1-hour targets: the report says 0 of 7, lab results still 08:40; per-process targets: 4 of 7");
      t.set("targets", "one8");

      // 7. Option 0: the new generator stops last night's cause; a burst pipe runs the same night.
      t.set("gen", true);
      t.click("all");
      var gen = t.stat("report") === "no restore needed" && t.stat("restored") === "0 of 7" && t.stat("late") === "0 min" &&
        has("the data room stays up.");
      t.set("cause", "pipe");
      t.click("all");
      t.expect(gen && t.stat("lab") === "08:40" && t.stat("payroll") === "03:30" && t.stat("report") === "all systems restored within target" &&
        t.stat("late") === "10 h 40 min" && has("01:20 A pipe bursts over the data room."),
        "New generator: no restore after the substation fault; a burst pipe brings back lab results at 08:40 and 10 h 40 min");
      t.set("gen", false);
      t.set("cause", "substation");

      // 8. RPO per process: pharmacy copies every 15 minutes lose 1 change, not 46.
      t.set("pcopy", "q15");
      t.click("all");
      t.expect(t.stat("doses") === 1 && has("1 dose change made after its last copy at 01:15 is missing."),
        "Pharmacy copied every 15 minutes: 1 dose change missing instead of 46");
      t.set("pcopy", "daily");

      // 9. Workarounds cover the gaps but don't shorten them.
      t.set("work", true);
      t.click("all");
      t.expect(t.stat("late") === "10 h 40 min" && t.stat("uncovered") === "0 min" && t.stat("lab") === "08:40",
        "Runbook workarounds: still 10 h 40 min past deadlines, none of it uncovered");
      t.set("work", false);

      // 10. Tabletop: four injects, every call senior.
      t.set("tabletop", true);
      t.click("all");
      var i1 = t.stat("now") === "01:50" && has("01:50 INJECT 1, posted by the ED charge nurse:");
      t.set("call1", "round");
      t.click("decide");
      t.click("all");
      var i2 = t.stat("now") === "02:20" && has("02:20 INJECT 2, posted by Draycott's support line:");
      t.set("call2", "deadline");
      t.click("decide");
      t.click("all");
      var i3 = t.stat("now") === "04:00" && t.stat("lab") === "03:40";
      t.set("call3", "script");
      t.click("decide");
      t.click("all");
      var i4 = t.stat("now") === "04:40" && has("04:40 INJECT 4, posted by Marjatta, night pharmacist:");
      t.set("call4", "check");
      t.click("decide");
      t.click("all");
      t.expect(i1 && i2 && i3 && i4 && t.stat("now") === "09:00" && t.stat("calls") === "4 of 4" && t.stat("payroll") === "08:40" &&
        t.stat("late") === "2 h" && t.stat("uncovered") === "40 min" && t.stat("report") === "all systems restored within target",
        "Tabletop, all senior calls: injects at 01:50, 02:20, 04:00 and 04:40; lab results 03:40; 2 h past deadlines, 40 min uncovered");
    }
  });
})();
