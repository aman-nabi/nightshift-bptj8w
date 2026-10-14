/* sims/s6e07-v1.0.0.js  (published as sims/s6e07.js)
   Case s6e07 "The Pager": an incident lab for the emergency department at Pellingford General.
   The department's patient board shows who is in which of its 12 bays, one row per patient, each
   triage note on its patient's row. A copy of the whole board is saved every hour on the hour.
   At 01:30 a bad update makes the board program copy every row each time it starts, so every
   patient shows twice. Two on-call engineers answer the page and act alone: Jarlath restores the
   01:00 copy, Breccan runs a repair script that keeps the older row. The learner picks an incident
   commander on or off, who is on the rota, when each engineer acts, the restore point, the
   script's rule, and a freeze, then runs the night one minute per tick from 01:00 to 02:30.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: commander on or off; engineers two (tonight), Jarlath only
     (option 1) or four (option 2); freeze the board at 01:44 (option 3); restore start 01:44,
     02:10 or never; restore point 01:00 or 00:00; script at 01:52 and again at 02:05 if doubles,
     at 01:52 only, or never; script rule keep older or keep newer row. Stats: time, rows, patients
     shown twice, triage notes, bay 4, the woman's 01:20 note, sent home but on the board, most
     changes at once, board, in command. selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - One tick is one minute, from 01:00 (tick 0) to 02:30 (tick 90). Nothing has run when the sim
     opens; minute m's events run on tick m.
   - At 01:00 the board holds 9 rows, bays 1 to 9, each with its triage note. Bay 4 is the man,
     in since 23:50. The 01:00 copy is exactly that board. The 00:00 copy holds bays 1 to 8 (the
     bay 9 patient came in at 00:35) and a boy in bay 11, in at 23:10 and sent home at 00:50.
   - 01:10 the man is sent home and his row leaves the board. 01:15 the woman takes bay 4 (a new
     row, no note). 01:20 her triage note is written on her row.
   - 01:30 the update installs and the program restarts. While the bad update is installed, every
     start of the program copies every row once; a copy has the start time and no note.
   - 01:32 the alarm pages Jarlath. Unanswered for 5 minutes, at 01:37 the page goes on to Breccan,
     who answers at 01:39; Jarlath answers at 01:40. With four engineers, engineers 3 and 4 are
     paged at 01:32 too and answer at 01:36.
   - No commander: Jarlath's restore starts at 01:44 and takes 14 minutes: at 01:58 the board is
     replaced by the chosen copy and the program restarts (copying every row while the update is
     installed). Breccan's script runs at 01:52; on the plan "twice" he checks again at 02:05 and
     reruns it if he sees doubles. The script keeps one row per patient: the older or the newer
     by the row's time. With four engineers, engineer 3 restarts the program at 02:15 to clear the
     screen.
   - Commander on: Jarlath takes command at 01:40; at 01:44 every plan is reported to him in one
     channel. His go: at 01:46 put back the previous version of the program (it restarts without
     copying), at 01:52 the script, with the chosen rule. The restore is held back.
   - Freeze: at 01:44 the board is frozen; every later change is refused and the department works
     on paper.
   - Changes at once: a restore counts in every minute from its start to its end; every other
     change counts in its own minute.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e07-v1.0.0.json):
   - 01:00: 9 rows, 9 notes, bay 4 the man. 01:29: 9 rows, bay 4 the woman, her note on her row.
     01:30: 18 rows, 9 patients shown twice.
   - Tonight: 01:52 script removes 9 copies, 9 rows, a clean board; 01:58 restore puts back the
     01:00 copy (the man in bay 4, no woman, no 01:20 note) and the restart makes 18 rows; 02:05
     the script removes 9 again. 02:30: 9 rows, 0 shown twice, bay 4 the man, her note gone, 1 sent
     home but on the board, most changes at once 2 (01:52, during the restore).
   - Option 0 (commander): 9 rows, 0 twice, bay 4 the woman with her note, 0 sent home on the
     board, most at once 1. With the rule keep newer: 0 notes.
   - Option 1 (Jarlath only): 18 rows, 9 twice, bay 4 the man twice, her note gone, most 1.
   - Option 2 (four): 02:15 restart makes 18 rows; the man back, her note gone, most 2.
   - Option 3 (freeze): 18 rows, 9 twice, her note on her row, the man not back, frozen from 01:44.
   - Restore point 00:00: 2 sent home but on the board (the man and the boy), her note gone.
   - Restore never: 01:52 script, 9 rows, her note kept; at 02:05 no doubles, nothing run.
*/
(function () {
  "use strict";

  var END = 90;           // 02:30
  var DISCHARGE = 10;     // 01:10
  var ARRIVE = 15;        // 01:15
  var NOTE = 20;          // 01:20
  var UPDATE = 30;        // 01:30
  var PAGE = 32;          // 01:32
  var ESCALATE = 37;      // 01:37
  var OTHERS = 36;        // 01:36, engineers 3 and 4
  var B_IN = 39;          // 01:39
  var J_IN = 40;          // 01:40
  var ACT = 44;           // 01:44: restore start, freeze, reports
  var ROLLBACK = 46;      // 01:46
  var SCRIPT1 = 52;       // 01:52
  var SCRIPT2 = 65;       // 02:05
  var RESTORE_TAKES = 14;
  var E3_RESTART = 75;    // 02:15

  var LABEL = {
    p1: "bay 1 patient", p2: "bay 2 patient", p3: "bay 3 patient", p5: "bay 5 patient",
    p6: "bay 6 patient", p7: "bay 7 patient", p8: "bay 8 patient", p9: "bay 9 patient",
    man: "the man (sent home 01:10)", woman: "the woman (in at 01:15)", boy: "the boy (sent home 00:50)"
  };
  var SHORT = { man: "man, sent home", woman: "woman, hip", boy: "boy, sent home" };
  var SENT = { man: DISCHARGE, boy: -10 };

  // [patient, bay, time in minutes from 01:00]
  var COPY = {
    "0100": [["p1", 1, -200], ["p2", 2, -180], ["p3", 3, -150], ["man", 4, -70], ["p5", 5, -100],
      ["p6", 6, -90], ["p7", 7, -80], ["p8", 8, -65], ["p9", 9, -25]],
    "0000": [["p1", 1, -200], ["p2", 2, -180], ["p3", 3, -150], ["man", 4, -70], ["p5", 5, -100],
      ["p6", 6, -90], ["p7", 7, -80], ["p8", 8, -65], ["boy", 11, -110]]
  };
  var POINT = { "0100": "01:00", "0000": "00:00" };

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hm(m) { var x = (1440 + 60 + m) % 1440; return two(Math.floor(x / 60)) + ":" + two(x % 60); }
  function load(k) { return COPY[k].map(function (r) { return { pid: r[0], bay: r[1], time: r[2], note: true }; }); }

  /* ---------- the model ---------- */

  function newNight(C) {
    return {
      C: C, t: 0, rows: load("0100"), updateOn: false, frozen: false, restoreEnd: -1, chg: [],
      events: [], timeline: [], boss: "nobody"
    };
  }

  function note(N, m, txt, tone) { N.events.push({ txt: hm(m) + " " + txt, tone: tone || "" }); }
  function mark(N, m) { N.chg[m] = (N.chg[m] || 0) + 1; }
  function most(N) { var x = 0; N.chg.forEach(function (c) { if (c > x) x = c; }); return x; }

  function doubles(N) {
    var n = {};
    N.rows.forEach(function (r) { n[r.pid] = (n[r.pid] || 0) + 1; });
    return Object.keys(n).filter(function (k) { return n[k] > 1; }).length;
  }

  function startUp(N) {
    if (!N.updateOn) return 0;
    var copies = N.rows.map(function (r) { return { pid: r.pid, bay: r.bay, time: N.t, note: false }; });
    N.rows = N.rows.concat(copies);
    return copies.length;
  }

  function script(N) {
    var keep = {};
    N.rows.forEach(function (r) {
      var k = keep[r.pid];
      if (!k || (N.C.rule === "older" ? r.time < k.time : r.time > k.time)) keep[r.pid] = r;
    });
    var before = N.rows.length;
    N.rows = N.rows.filter(function (r) { return keep[r.pid] === r; });
    return before - N.rows.length;
  }

  // One change to the board: refused while frozen, otherwise counted and put on the timeline.
  function change(N, m, who, what, data, fn) {
    if (N.frozen) { note(N, m, who + " tries to " + what + ": refused, the board is frozen.", "warn"); return; }
    mark(N, m);
    var said = fn();
    N.timeline.push(hm(m) + "  " + who + "  " + what + "  " + data);
    note(N, m, who + " " + said, "warn");
  }

  function step(N) {
    var m = N.t;
    var C = N.C;
    var two_ = C.eng !== "one";
    var four = C.eng === "four";
    if (m === DISCHARGE) {
      N.rows = N.rows.filter(function (r) { return r.pid !== "man"; });
      note(N, m, "the man in bay 4 is sent home; his row leaves the board.", "ok");
    }
    if (m === ARRIVE) { N.rows.push({ pid: "woman", bay: 4, time: m, note: false }); note(N, m, "a woman with a broken hip takes bay 4.", "ok"); }
    if (m === NOTE) {
      N.rows.forEach(function (r) { if (r.pid === "woman") r.note = true; });
      note(N, m, "the nurse writes her triage note.", "ok");
    }
    if (m === UPDATE) {
      N.updateOn = true;
      mark(N, m);
      var c0 = startUp(N);
      N.timeline.push(hm(m) + "  update  program restarts, copies every row  live board");
      note(N, m, "the update installs; the program restarts and copies every row: " + c0 + " copies, no notes.", "bad");
    }
    if (m === PAGE) note(N, m, "the alarm sees doubles and pages Jarlath" + (four ? ", engineer 3 and engineer 4" : "") + ".", "warn");
    if (four && m === OTHERS) note(N, m, "engineers 3 and 4 answer and log in from home.", "");
    if (two_ && m === ESCALATE) note(N, m, "no answer from Jarlath in 5 minutes: the page goes on to Breccan.", "warn");
    if (two_ && m === B_IN) note(N, m, "Breccan answers and logs in from home." + (C.cmd ? "" : " Nobody tells him Jarlath was paged."), "");
    if (m === J_IN) {
      if (C.cmd) { N.boss = "Jarlath"; note(N, m, "Jarlath answers and takes command: one channel, every plan reported to him before anyone acts, and he keeps the timeline.", "ok"); }
      else note(N, m, "Jarlath answers and logs in from home." + (two_ ? " Nobody tells him Breccan was paged." : ""), "");
    }
    if (C.freeze && m === ACT) { N.frozen = true; note(N, m, "the board is frozen; the department works on paper.", "warn"); }
    var fixer = two_ ? "Breccan" : "Jarlath";
    if (C.cmd) {
      if (m === ACT) note(N, m, (two_ ? "Breccan reports a repair script, keep " + C.rule + " row; Jarlath's own plan is a restore. " : "Jarlath writes down two plans: a restore, and a repair script. ") +
        "The timeline shows 3 changes since 01:00 (01:10, 01:15, 01:20), and the update still copies rows on every restart.", "");
      if (m === ROLLBACK) change(N, m, fixer, "puts back the previous version", "program", function () {
        N.updateOn = false;
        startUp(N);
        return "puts back the previous version of the board program on Jarlath's go; it restarts without copying.";
      });
      if (m === SCRIPT1) change(N, m, fixer, "runs repair script, keeps " + C.rule + " row", "live board", function () {
        return "runs the repair script on Jarlath's go, keeping the " + C.rule + " row: removes " + script(N) + " rows. The restore is held back.";
      });
    } else {
      if (C.start !== "never" && m === +C.start) {
        if (N.frozen) note(N, m, "Jarlath tries to start a restore: refused, the board is frozen.", "warn");
        else {
          N.restoreEnd = m + RESTORE_TAKES;
          for (var k = m; k <= N.restoreEnd; k++) mark(N, k);
          N.timeline.push(hm(m) + "  Jarlath  starts restore from " + POINT[C.point] + " backup  whole board");
          note(N, m, "Jarlath starts a restore from the " + POINT[C.point] + " backup; it takes " + RESTORE_TAKES + " minutes.", "warn");
        }
      }
      if (m === N.restoreEnd) {
        N.rows = load(C.point);
        var c1 = startUp(N);
        N.timeline.push(hm(m) + "  restore  finishes, program restarts  whole board");
        note(N, m, "the restore finishes: the board is the " + POINT[C.point] + " backup again" + (c1 ? ", and the restart copies every row: " + c1 + " copies." : "."), "bad");
      }
      if (two_ && C.plan !== "never" && m === SCRIPT1) change(N, m, "Breccan", "runs repair script, keeps " + C.rule + " row", "live board", function () {
        return "runs the repair script, keeping the " + C.rule + " row: removes " + script(N) + " rows.";
      });
      if (two_ && C.plan === "twice" && m === SCRIPT2) {
        if (doubles(N)) change(N, m, "Breccan", "runs repair script again", "live board", function () {
          return "runs the repair script again, keeping the " + C.rule + " row: removes " + script(N) + " rows.";
        });
        else note(N, m, "Breccan checks the board: no doubles, nothing to run.", "ok");
      }
      if (four && m === E3_RESTART) change(N, m, "engineer 3", "restarts the program", "live board", function () {
        var c2 = startUp(N);
        return "restarts the board program to clear the screen" + (c2 ? ": it copies every row, " + c2 + " copies." : ".");
      });
    }
    N.t = m + 1;
  }

  function bay4(N) {
    var order = [];
    var n = {};
    N.rows.forEach(function (r) { if (r.bay === 4) { if (!n[r.pid]) order.push(r.pid); n[r.pid] = (n[r.pid] || 0) + 1; } });
    if (!order.length) return "empty";
    return order.map(function (p) { return LABEL[p] + (n[p] === 2 ? ", twice" : n[p] > 2 ? ", " + n[p] + " times" : ""); }).join("; ");
  }

  function herNote(N) {
    if (N.t <= NOTE) return "not written yet";
    return N.rows.some(function (r) { return r.pid === "woman" && r.note; }) ? "on her row" : "gone";
  }

  function sentBack(N) {
    var seen = {};
    N.rows.forEach(function (r) { if (SENT[r.pid] !== undefined && SENT[r.pid] < N.t) seen[r.pid] = 1; });
    return Object.keys(seen).length;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";

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
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 300");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "dg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The patient board: 12 bays, each listing the rows it shows, how many times each patient appears, and whether the row carries a triage note.");
    var tl = el("p", "margin:0;font-size:12px;white-space:pre-wrap;font-family:monospace;");
    [head, svg, tl].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { doc: doc, head: head, svg: svg, tl: tl };
  }

  function svgEl(ui, tag, attrs, text) {
    var e = ui.doc.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    if (text) e.textContent = text;
    ui.svg.appendChild(e);
    return e;
  }

  function drawBoard(S) {
    var ui = S.ui;
    var N = S.N;
    while (ui.svg.firstChild) ui.svg.removeChild(ui.svg.firstChild);
    for (var b = 1; b <= 12; b++) {
      var x = 8 + ((b - 1) % 4) * 158;
      var y = 6 + Math.floor((b - 1) / 4) * 98;
      var here = N.rows.filter(function (r) { return r.bay === b; });
      var cnt = {};
      var order = [];
      here.forEach(function (r) {
        if (!cnt[r.pid]) { cnt[r.pid] = { n: 0, notes: 0 }; order.push(r.pid); }
        cnt[r.pid].n += 1;
        if (r.note) cnt[r.pid].notes += 1;
      });
      var dbl = order.some(function (p) { return cnt[p].n > 1; });
      var back = order.some(function (p) { return SENT[p] !== undefined && SENT[p] < N.t; });
      svgEl(ui, "rect", { x: x, y: y, width: 150, height: 90, rx: 6, "class": "dg-node" + (back ? " bad" : dbl ? " warn" : "") });
      svgEl(ui, "text", { x: x + 8, y: y + 18, "class": "dg-label" }, "Bay " + b);
      if (!order.length) svgEl(ui, "text", { x: x + 8, y: y + 40, "class": "dg-meta" }, "empty");
      order.forEach(function (p, i) {
        var c = cnt[p];
        svgEl(ui, "text", { x: x + 8, y: y + 40 + i * 32, "class": "dg-sub" }, (SHORT[p] || "patient") + (c.n > 1 ? " x" + c.n : ""));
        svgEl(ui, "text", { x: x + 8, y: y + 56 + i * 32, "class": "dg-meta" }, c.notes ? "triage note: yes" : "triage note: none");
      });
    }
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var C = N.C;
    S.ui.head.textContent = hm(N.t) + ". Commander: " + (C.cmd ? "on" : "off") + ". Engineers: " + { two: "Jarlath and Breccan", one: "Jarlath only", four: "four" }[C.eng] +
      ". Restore: " + (C.start === "never" ? "never" : hm(+C.start) + " from the " + POINT[C.point] + " backup") + ". Script: " + { twice: "01:52, again at 02:05 if doubles", once: "01:52 only", never: "never" }[C.plan] +
      ", keep " + C.rule + " row." + (C.freeze ? " Freeze at 01:44." : "");
    drawBoard(S);
    S.ui.tl.textContent = "Timeline of changes (time, who, action, data):\n" + (N.timeline.length ? N.timeline.join("\n") : "none yet");
    S.stat.time(hm(N.t));
    S.stat.rows(N.rows.length);
    S.stat.twice(doubles(N));
    S.stat.notes(N.rows.filter(function (r) { return r.note; }).length);
    S.stat.bay4(bay4(N));
    S.stat.note(herNote(N));
    S.stat.back(sentBack(N));
    S.stat.most(most(N));
    S.stat.board(N.frozen ? "frozen since 01:44" : "live");
    S.stat.boss(N.boss);
    ["minute", "ten", "all"].forEach(function (id) { S.ctl[id].disable(N.t >= END); });
  }

  function run(api, mins) {
    var S = api.state;
    var N = S.N;
    var from = N.events.length;
    var t0 = N.t;
    var stop = Math.min(END, N.t + mins);
    while (N.t < stop) step(N);
    var evs = N.events.slice(from);
    var s = hm(t0) + " to " + hm(N.t) + ": " + (evs.length ? evs.map(function (e) { return e.txt; }).join(" ") : "nothing changes.");
    if (N.t >= END) s += " 02:30: " + N.rows.length + " rows, " + doubles(N) + " patients shown twice; bay 4: " + bay4(N) + "; her 01:20 note: " + herNote(N) + ".";
    api.log(s, evs.some(function (e) { return e.tone === "bad"; }) ? "bad" : (evs.some(function (e) { return e.tone === "warn"; }) ? "warn" : "ok"));
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.N = newNight(S.C);
    api.log((why ? why + " " : "") + "01:00, before anything happens. 9 patients in bays 1 to 9; bay 4 is the man, in since 23:50.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { cmd: false, eng: "two", start: "44", point: "0100", plan: "twice", rule: "older", freeze: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function again(label) { return function () { restart(api, label + " changed."); }; }
      S.ctl.cmd = api.control.toggle("cmd", "Incident commander (Jarlath, first to answer)", false, function (on) { S.C.cmd = !!on; again("Commander")(); });
      S.ctl.eng = api.control.select("eng", "Engineers on the rota", [
        { value: "two", label: "Jarlath, then Breccan if no answer (tonight)" },
        { value: "one", label: "Jarlath only (Breccan off the rota)" },
        { value: "four", label: "Four: two more paged at once" }
      ], "two", function (v) { S.C.eng = String(v); again("Rota")(); });
      S.ctl.start = api.control.select("start", "Jarlath's restore starts", [
        { value: "44", label: "01:44 (tonight)" },
        { value: "70", label: "02:10" },
        { value: "never", label: "never" }
      ], "44", function (v) { S.C.start = String(v); again("Restore time")(); });
      S.ctl.point = api.control.select("point", "Restore point", [
        { value: "0100", label: "the 01:00 backup (tonight)" },
        { value: "0000", label: "the 00:00 backup" }
      ], "0100", function (v) { S.C.point = String(v); again("Restore point")(); });
      S.ctl.plan = api.control.select("plan", "Breccan's repair script runs", [
        { value: "twice", label: "01:52, and again at 02:05 if he sees doubles (tonight)" },
        { value: "once", label: "01:52 only" },
        { value: "never", label: "never" }
      ], "twice", function (v) { S.C.plan = String(v); again("Script plan")(); });
      S.ctl.rule = api.control.select("rule", "Script's rule", [
        { value: "older", label: "keep the older row (tonight)" },
        { value: "newer", label: "keep the newer row" }
      ], "older", function (v) { S.C.rule = String(v); again("Script rule")(); });
      S.ctl.freeze = api.control.toggle("freeze", "Freeze the board at 01:44, paper until morning", false, function (on) { S.C.freeze = !!on; again("Freeze")(); });
      S.ctl.minute = api.control.button("minute", "Next minute", function () { run(api, 1); });
      S.ctl.ten = api.control.button("ten", "Next 10 minutes", function () { run(api, 10); });
      S.ctl.all = api.control.button("all", "Run to 02:30", function () { run(api, END); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        time: api.stat("time", "time", ""),
        rows: api.stat("rows", "rows on the board", ""),
        twice: api.stat("twice", "patients shown twice", "warn"),
        notes: api.stat("notes", "triage notes on the board", ""),
        bay4: api.stat("bay4", "bay 4 shows", ""),
        note: api.stat("note", "the woman's 01:20 note", ""),
        back: api.stat("back", "sent home, but on the board", "bad"),
        most: api.stat("most", "most changes at once", "warn"),
        board: api.stat("board", "board", ""),
        boss: api.stat("boss", "in command", "ok")
      };
      api.info("<strong>How to read it.</strong> Each box is a bay on the patient board, listing the rows it shows: x2 means the patient appears twice, and each row says whether it carries a triage note. Red marks a patient who was sent home; amber marks a double. Below the board is the shared timeline: every change, with its time, who made it, what it was, and which data it touched.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function N() { return t.api.state.N; }

      // 1. Opens at 01:00, before anything happens.
      t.expect(t.stat("time") === "01:00" && t.stat("rows") === 9 && t.stat("twice") === 0 && t.stat("bay4") === "the man (sent home 01:10)" &&
        t.stat("note") === "not written yet" && t.stat("back") === 0 && N().t === 0,
        "Opens at 01:00: 9 rows, bay 4 the man, the woman's note not written yet");

      // 2. 01:30, before the update: the woman in bay 4 with her note.
      t.click("ten");
      t.click("ten");
      t.click("ten");
      t.expect(t.stat("time") === "01:30" && t.stat("rows") === 9 && t.stat("notes") === 9 && t.stat("bay4") === "the woman (in at 01:15)" &&
        t.stat("note") === "on her row" && t.stat("back") === 0,
        "01:30, before the update: 9 rows, 9 notes, bay 4 the woman, her note on her row");

      // 3. The update doubles every patient.
      t.click("minute");
      t.expect(t.stat("time") === "01:31" && t.stat("rows") === 18 && t.stat("twice") === 9 && t.stat("notes") === 9,
        "01:30 update: 18 rows, 9 patients shown twice, notes still 9");

      // 4. The record: the man back in bay 4, her note gone.
      t.click("all");
      t.expect(t.stat("rows") === 9 && t.stat("twice") === 0 && t.stat("bay4") === "the man (sent home 01:10)" && t.stat("note") === "gone" &&
        t.stat("back") === 1 && t.stat("most") === 2 && t.stat("boss") === "nobody" && t.logText().indexOf("02:05 Breccan runs the repair script again") >= 0,
        "Tonight: 02:30 shows 9 rows, the man back in bay 4, her 01:20 note gone, 2 changes at once");

      // 5. Option 0: one commander.
      t.set("cmd", true);
      t.click("all");
      t.expect(t.stat("rows") === 9 && t.stat("twice") === 0 && t.stat("bay4") === "the woman (in at 01:15)" && t.stat("note") === "on her row" &&
        t.stat("back") === 0 && t.stat("most") === 1 && t.stat("boss") === "Jarlath",
        "Commander: 9 rows, bay 4 the woman with her note, nobody sent home on the board, 1 change at a time");

      // 6. The script's rule still matters under a commander.
      t.set("rule", "newer");
      t.click("all");
      t.expect(t.stat("notes") === 0 && t.stat("note") === "gone" && t.stat("rows") === 9,
        "Commander with keep newer row: 9 rows and 0 notes");
      t.set("rule", "older");
      t.set("cmd", false);

      // 7. Option 1: Breccan off the rota.
      t.set("eng", "one");
      t.click("all");
      t.expect(t.stat("rows") === 18 && t.stat("twice") === 9 && t.stat("bay4") === "the man (sent home 01:10), twice" && t.stat("note") === "gone" &&
        t.stat("most") === 1,
        "Jarlath only: 18 rows, the man twice in bay 4, her note gone");

      // 8. Option 2: four engineers.
      t.set("eng", "four");
      t.click("all");
      t.expect(t.stat("rows") === 18 && t.stat("back") === 1 && t.stat("note") === "gone" && t.stat("most") === 2 &&
        t.logText().indexOf("engineer 3 restarts the board program") >= 0,
        "Four engineers: engineer 3's restart makes 18 rows again, the man back, her note gone");

      // 9. Option 3: freeze at 01:44.
      t.set("eng", "two");
      t.set("freeze", true);
      t.click("all");
      t.expect(t.stat("rows") === 18 && t.stat("twice") === 9 && t.stat("note") === "on her row" && t.stat("back") === 0 &&
        t.stat("board") === "frozen since 01:44",
        "Freeze: 18 rows frozen from 01:44, her note kept, the man not back");
      t.set("freeze", false);

      // 10. An older restore point brings back more.
      t.set("point", "0000");
      t.click("all");
      t.expect(t.stat("back") === 2 && t.stat("rows") === 9 && t.stat("note") === "gone",
        "Restore from the 00:00 copy: 2 sent home but on the board, her note gone");
      t.set("point", "0100");

      // 11. No restore: the script alone leaves a clean board.
      t.set("start", "never");
      t.click("all");
      t.expect(t.stat("rows") === 9 && t.stat("twice") === 0 && t.stat("note") === "on her row" && t.stat("back") === 0 && t.stat("most") === 1,
        "No restore: the 01:52 script leaves 9 rows, her note kept, 1 change at a time");
    }
  });
})();
