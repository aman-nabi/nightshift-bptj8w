/* sims/w10-v1.0.0.js  (published as sims/w10.js)
   case w10 "the pager that stayed quiet": a workbench for the logging library Odgerel finished
   for Quernwold brewery's fermentation room. six tank sensors, a chain of three handlers (file
   on the memory card, screen in the brew house, pager texting Bryluen), one night replayed from
   02:30:00 to 07:09:58. widget-style sim: it draws its own rows and table inside api.root.

   changelog
   v1.0.0 (2026-10-16) first version: design (chain as built, pager first, a 32 GB card, a queue
     and background writer per handler, each handler catches, reports once and passes on), what
     fails at 02:47 (the full card, as on the night; the screen unplugged; nothing), the file
     handler's level (debug as left, or info), step to the next moment, play the night, reset.
     stats: texts to Bryluen, critical lines that never reached the pager, the file's and the
     screen's last line, lines the file never wrote, failures reported, lines waiting in memory,
     card space left, tank 3 when Bryluen gets there. selftest: 11 assertions.

   the model (stated in sim.lede):
   - six tanks, one reading each every 2 s, at 02:30:00, 02:30:02 ... 07:09:58: 8,400 moments,
     50,400 debug lines. at every 10-minute mark (02:30:00 ... 07:00:00, 28 marks) each tank also
     sends an info line: 168 info lines. tank 3 sends a critical line at 03:10:00 and every 10
     minutes while above 21.0 C, to 07:00:00: 24 critical lines. 50,592 messages in all.
     order within one moment: info lines, then the critical line, then the six debug lines.
   - every line takes 60 bytes on the card. debug lines: 6 lines / 2 s x 60 bytes = 180 bytes a
     second = 15,552,000 bytes a day; info lines add 6 x 60 / 600 s = 0.6 bytes a second, so the
     file grows 180.6 bytes a second, 15,603,840 bytes (about 15.6 MB) a day.
   - the card keeps 500,000,000 bytes (500 MB) for the file. 500,000,000 / 180.6 = 2,768,549 s,
     close to 32.04 days: from about 01:45 on sunday 13 september 2026 (install, debug on) to
     02:47:00 on thursday 15 october. the replay opens at 02:30:00 with 184,320 bytes left:
     02:30:00 to 02:46:58 is 510 moments x 6 debug lines + 2 marks x 6 info lines = 3,072 lines
     x 60 = 184,320 bytes. so the last line fits at 02:46:58 and the first debug line at
     02:47:00 finds the card full.
   - levels: debug 0, info 1, warning 2, critical 3. file handler: debug (as left) or info;
     screen: info; pager: critical. a handler sends a message only at or above its level.
   - tank 3: its chiller stopped at 23:10 with the tank at 19.0 C; it warms 0.5 C an hour:
     20.0 C at 01:10 (the warning line, before the replay), 21.0 C at 03:10, 20.8 C at 02:46:58
     (20.808), 23.0 C at 07:10 when Bryluen opens up. Bryluen lives 35 minutes away: a text at
     03:10 has Bryluen at the tank at 03:45, when it reads 21.3 C (21.292).
   - designs:
     built: file, screen, pager; handle() checks the level, sends, then calls next.handle().
       a send that throws stops handle(), so later handlers never get that message; the sensor
       loop catches the error and reads on.
     pagerfirst: pager, file, screen; otherwise as built.
     bigcard: as built, on a 32,000,000,000-byte card. with the night's full card that leaves
       32,000,000,000 - (500,000,000 - 184,320) = 31,500,184,320 bytes at 02:30:00.
     queues: each handler has its own queue and background writer; the chain drops each
       message into every queue at or above that handler's level. a writer whose send throws
       stops with the failed line still at the front, and says nothing; its queue grows.
     catch: each handler catches its own send's error, passes the message on anyway, and on its
       first failure sends one critical report ("file handler failing: card full") to the other
       handlers. later failures are counted, not reported again.
   - faults: card = the night (184,320 bytes left at 02:30:00). screen = the card cleared
     (500,000,000 bytes free) and the brew-house screen unplugged at 02:47:00, so the screen's
     send throws from then on. none = the card cleared, nothing fails.

   where every number in the case comes from (all reproduced by the model and checked below):
   - as built, the night: the file's last line 02:46:58; the screen's last line 02:40:00 (the
     last info lines before 02:47:00); 50,592 - 3,072 = 47,520 lines the file never wrote
     (47,340 debug + 156 info + 24 critical); 24 critical lines, none reached the pager, 0 texts.
   - pager first: 24 texts, first at 03:10:00; the file and the screen as built; 0 reports.
   - 32 GB card, the night: 24 texts, 0 lines lost. screen unplugged: the screen's send first
     throws at 02:50:00, and from then 156 info + 24 critical lines stop there: 0 texts.
   - queues, the night: 24 texts; the screen shows every line to 07:00:00; 47,520 lines wait in
     the file's queue at 07:09:58, 47,520 x 60 = 2,851,200 bytes in memory, all lost on a restart.
   - catch, the night: 1 report at 02:47:00, then 24 critical texts: 25 texts in all.
   - file at info, as built: 168 info + 24 critical = 192 lines x 60 = 11,520 bytes, so the card
     ends with 184,320 - 11,520 = 172,800 bytes left and nothing fails.
   - 32 GB at 15,603,840 bytes a day lasts 2,050.8 days, about 5.6 years. at info level the file
     grows 0.6 x 86,400 = 51,840 bytes (about 52 KB) a day: 500 MB lasts about 26 years.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  function hm(h, m, s) { return h * 3600 + m * 60 + (s || 0); }
  var START = hm(2, 30);           // the replay opens here
  var END = hm(7, 9, 58);          // the last reading before Bryluen opens up at 07:10
  var FAULT = hm(2, 47);           // when the screen is unplugged, in the "screen" fault
  var CRIT0 = hm(3, 10);           // tank 3 passes 21.0 C
  var CRIT_LAST = hm(7, 0);
  var CHILL = hm(23, 10) - 86400;  // the chiller stopped at 23:10 the evening before
  var LINE = 60;                   // bytes per line
  var LEFT = 184320;               // bytes left on the card at 02:30:00, the night
  var CARD = 500000000;            // the card's space for the file
  var BIG = 32000000000;           // a 32 GB card
  var DRIVE = 35 * 60;             // Bryluen's drive to the brewery
  var CHECKPOINTS = [hm(2, 40), hm(2, 46, 58), hm(2, 47), hm(3, 10), END];
  var LEVELS = ["debug", "info", "warning", "critical"];

  var DESIGNS = [
    { value: "built", label: "chain as built: file, screen, pager" },
    { value: "pagerfirst", label: "pager first: pager, file, screen" },
    { value: "bigcard", label: "a 32 GB card, chain as built" },
    { value: "queues", label: "a queue and background writer per handler" },
    { value: "catch", label: "each handler catches, reports once, passes on" }
  ];
  var SHORT = {
    built: "the chain as built",
    pagerfirst: "the pager first",
    bigcard: "a 32 GB card",
    queues: "a queue and writer per handler",
    catch: "catch, report once, pass on"
  };
  var FAULTS = [
    { value: "card", label: "the card fills (the night)" },
    { value: "screen", label: "card cleared; screen unplugged at 02:47" },
    { value: "none", label: "card cleared; nothing fails" }
  ];
  var FILELEVELS = [
    { value: "debug", label: "debug (as left)" },
    { value: "info", label: "info" }
  ];

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(t) {
    var s = ((t % 86400) + 86400) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function temp(t) { return 19.0 + 0.5 * (t - CHILL) / 3600; }
  function deg(t) { return (Math.round(temp(t) * 10) / 10).toFixed(1) + "°C"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function names(list) {
    if (!list.length) return "nothing comes after it";
    var n = list.map(function (h) { return h.name; });
    return "the " + (n.length === 1 ? n[0] + " handler never gets" : n.join(" and ") + " handlers never get") + " this message";
  }

  /* ---------- the model ---------- */

  function fresh(C) {
    var order = C.design === "pagerfirst" ? ["pager", "file", "screen"] : ["file", "screen", "pager"];
    var lv = { file: C.fileLevel === "info" ? 1 : 0, screen: 1, pager: 3 };
    var free = C.fault === "card" ? LEFT : CARD;
    if (C.design === "bigcard") free += BIG - CARD;
    return {
      C: C, now: START - 2, tick: START, free: free, done: false,
      hs: order.map(function (n) {
        return { name: n, level: lv[n], last: null, sent: 0, failed: 0, lost: 0, queued: 0,
          stopped: false, reported: false, failAt: null, starveAt: null };
      }),
      pages: 0, tankPage: null, missed: 0, reports: 0, critSeen: false, events: []
    };
  }

  function send(M, h, msg) {
    if (h.name === "file") {
      if (M.free < LINE) return "card full";
      M.free -= LINE;
    } else if (h.name === "screen") {
      if (M.C.fault === "screen" && msg.t >= FAULT) return "screen unplugged";
    } else {
      M.pages += 1;
      if (msg.kind === "reading" && M.tankPage === null) M.tankPage = msg.t;
    }
    h.sent += 1;
    h.last = msg.t;
    return "";
  }

  function deliver(M, msg, skip) {
    var D = M.C.design;
    var hs = M.hs;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (h === skip || msg.level < h.level) continue;
      if (D === "queues" && h.stopped) { h.queued += 1; continue; }
      var err = send(M, h, msg);
      if (!err) continue;
      if (h.failAt === null) h.failAt = msg.t;
      if (D === "queues") {
        h.stopped = true;
        h.queued += 1;
        M.events.push({ t: msg.t, text: hms(msg.t) + ". the " + h.name + " writer's send throws an error: " + err +
          ". the writer stops, and its queue starts to grow; the other writers carry on. nothing reports it.", tone: "warn" });
        continue;
      }
      h.failed += 1;
      if (D === "catch") {
        if (!h.reported) {
          h.reported = true;
          M.reports += 1;
          M.events.push({ t: msg.t, text: hms(msg.t) + ". the " + h.name + " handler catches its error (" + err +
            ") and passes the message on. it reports once: \"" + h.name + " handler failing: " + err + "\" goes to the other handlers.", tone: "warn" });
          deliver(M, { t: msg.t, level: 3, kind: "report" }, h);
        }
        continue;
      }
      var rest = [];
      for (var j = i + 1; j < hs.length; j++) {
        rest.push(hs[j]);
        if (msg.level < hs[j].level) continue;
        hs[j].lost += 1;
        if (hs[j].starveAt === null) hs[j].starveAt = msg.t;
        if (hs[j].name === "pager" && msg.kind === "reading") M.missed += 1;
      }
      if (h.failed === 1) {
        M.events.push({ t: msg.t, text: hms(msg.t) + (msg.level === 1 ? ". an " : ". a ") + LEVELS[msg.level] + " line reaches the " + h.name +
          " handler: " + err + ", so its send throws an error. handle() stops before next.handle(): " + names(rest) +
          ". the sensor loop catches the error and reads on.", tone: "bad" });
      }
      return;
    }
  }

  // Run every moment up to and including time T.
  function advance(M, T) {
    while (M.tick <= T && M.tick <= END) {
      var t = M.tick;
      var batch = [];
      var k;
      if (t % 600 === 0) for (k = 1; k <= 6; k++) batch.push({ t: t, level: 1, kind: "reading", tank: k });
      if (t >= CRIT0 && t <= CRIT_LAST && (t - CRIT0) % 600 === 0) batch.push({ t: t, level: 3, kind: "reading", tank: 3 });
      for (k = 1; k <= 6; k++) batch.push({ t: t, level: 0, kind: "reading", tank: k });
      batch.forEach(function (msg) {
        var before = M.pages;
        var missedBefore = M.missed;
        deliver(M, msg, null);
        if (msg.level === 3 && !M.critSeen) {
          M.critSeen = true;
          M.events.push({ t: t, text: hms(t) + ". tank 3 passes 21.0°C: a critical line. " +
            (M.pages > before ? "the pager texts Bryluen." : (M.missed > missedBefore ? "it never reaches the pager." : "the pager does not send it.")),
            tone: M.pages > before ? "ok" : "bad" });
        }
      });
      M.now = t;
      M.tick += 2;
    }
    if (M.tick > END) M.done = true;
  }

  function H(M, n) { for (var i = 0; i < M.hs.length; i++) if (M.hs[i].name === n) return M.hs[i]; return null; }

  function tankText(M) {
    if (M.tankPage !== null) { var a = M.tankPage + DRIVE; return deg(a) + " at " + hms(a).slice(0, 5); }
    return M.done ? deg(hm(7, 10)) + " at 07:10" : "no text yet";
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 90;
  var X1 = 640;

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, text, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }
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
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 190", width: "100%", "class": "dg", role: "img",
      "aria-label": "three rows, one per handler, from 02:30:00 to 07:10:00. a plain bar means the handler is getting and sending its lines; a red bar means its send is failing; an amber bar means messages stop before they reach it. dots on the pager row are texts to Bryluen."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["handler", "level", "lines sent", "last line", "failed sends", "never got", "waiting in queue"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody };
  }

  function X(t) { return X0 + (X1 - X0) * Math.max(0, Math.min(hm(7, 10) - START, t - START)) / (hm(7, 10) - START); }

  function drawRows(S) {
    var M = S.M;
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    var rows = { file: 40, screen: 85, pager: 130 };
    ["file", "screen", "pager"].forEach(function (n) {
      var h = H(M, n);
      var y = rows[n];
      txt(doc, g, 10, y + 4, n, "dg-note", "start");
      if (M.now < START) return;
      var cut = h.failAt !== null && h.failAt <= M.now ? h.failAt : (h.starveAt !== null && h.starveAt <= M.now ? h.starveAt : null);
      var okEnd = cut === null ? M.now : cut;
      mk(doc, "rect", { x: X(START), y: y - 7, width: Math.max(2, X(okEnd) - X(START)), height: 14, "class": "dg-node st-ok" }, g);
      if (cut !== null) {
        var tone = h.failAt !== null && h.failAt === cut ? "bad" : "warn";
        if (M.C.design === "catch" && n === "file") tone = "bad";
        mk(doc, "rect", { x: X(cut), y: y - 7, width: Math.max(2, X(M.now) - X(cut)), height: 14, "class": "dg-node st-" + tone }, g);
      }
    });
    if (M.tankPage !== null) {
      for (var t = CRIT0; t <= Math.min(M.now, CRIT_LAST); t += 600) {
        var c = mk(doc, "g", { "class": "dg-node st-accent" }, g);
        mk(doc, "circle", { cx: X(t), cy: rows.pager, r: 4 }, c);
      }
    }
    for (var hh = 3; hh <= 7; hh++) {
      var tt = hm(hh, 0);
      mk(doc, "line", { x1: X(tt), y1: 152, x2: X(tt), y2: 158, "class": "dg-axis" }, g);
      txt(doc, g, X(tt), 172, pad(hh) + ":00", "dg-axis", "middle");
    }
    mk(doc, "line", { x1: X0, y1: 152, x2: X1, y2: 152, "class": "dg-axis" }, g);
    txt(doc, g, X0, 186, "02:30", "dg-axis", "start");
  }

  function drawTable(S) {
    var el = S.ui.el;
    clear(S.ui.tbody);
    S.M.hs.forEach(function (h) {
      var tr = el("tr");
      [h.name, LEVELS[h.level], fmt(h.sent), h.last === null ? "none yet" : hms(h.last), fmt(h.failed), fmt(h.lost), fmt(h.queued)].forEach(function (c) {
        tr.appendChild(el("td", "", c));
      });
      S.ui.tbody.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var M = S.M;
    var C = S.C;
    var file = H(M, "file");
    var screen = H(M, "screen");
    var queued = 0;
    M.hs.forEach(function (h) { queued += h.queued; });
    S.ui.head.textContent = "design: " + SHORT[C.design] + ". what fails: " + pick(FAULTS, C.fault).label +
      ". file handler at " + C.fileLevel + ". replayed to " + (M.now < START ? "02:30:00, before the first reading" : hms(M.now)) + ".";
    drawRows(S);
    drawTable(S);
    S.stat.pages(M.pages);
    S.stat.missed(M.missed);
    S.stat.filelast(file.last === null ? "none yet" : hms(file.last));
    S.stat.screenlast(screen.last === null ? "none yet" : hms(screen.last));
    S.stat.unwritten(fmt(file.failed + file.lost + file.queued));
    S.stat.reports(M.reports);
    S.stat.queued(fmt(queued));
    S.stat.card(fmt(M.free) + " bytes");
    S.stat.tank(tankText(M));
    api.clock = M.now < START ? START : M.now;
    S.ctl.step.disable(M.done);
    S.ctl.play.disable(M.done);
  }

  function flush(api, M, from) {
    for (var i = from; i < M.events.length; i++) api.log(M.events[i].text, M.events[i].tone);
  }

  function goTo(api, T) {
    var S = api.state;
    var M = S.M;
    var n = M.events.length;
    advance(M, T);
    api.clock = M.now;
    flush(api, M, n);
  }

  function summary(M) {
    var file = H(M, "file");
    var screen = H(M, "screen");
    var queued = 0;
    M.hs.forEach(function (h) { queued += h.queued; });
    return hms(M.now) + ". night replayed with " + SHORT[M.C.design] + ": " + M.pages + " texts to Bryluen, " + M.missed +
      " critical lines lost before the pager, the file's last line " + (file.last === null ? "none" : hms(file.last)) +
      ", the screen's " + (screen.last === null ? "none" : hms(screen.last)) + ", " + M.reports + " failures reported, " +
      fmt(queued) + " lines waiting in memory. tank 3 when Bryluen gets there: " + tankText(M) + ".";
  }

  function playAll(api) {
    var S = api.state;
    goTo(api, END);
    api.log(summary(S.M), S.M.missed ? "bad" : "ok");
    draw(api);
  }

  function replay(api) {
    var S = api.state;
    S.M = fresh(S.C);
    playAll(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", fault: "card", fileLevel: "debug" };
      S.M = fresh(S.C);
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.fault = api.control.select("fault", "what fails at 02:47", FAULTS, "card", function (v) {
        var o = pick(FAULTS, v);
        if (!o) return;
        S.C.fault = String(o.value);
        replay(api);
      });
      S.ctl.level = api.control.select("level", "file handler's level", FILELEVELS, "debug", function (v) {
        var o = pick(FILELEVELS, v);
        if (!o) return;
        S.C.fileLevel = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "step to the next moment", function () {
        var M = S.M;
        var next = null;
        for (var i = 0; i < CHECKPOINTS.length; i++) if (CHECKPOINTS[i] > M.now) { next = CHECKPOINTS[i]; break; }
        if (next === null) return;
        goTo(api, next);
        var file = H(M, "file");
        var screen = H(M, "screen");
        if (M.done) api.log(summary(M), M.missed ? "bad" : "ok");
        else api.log(hms(M.now) + ". so far: the file's last line " + (file.last === null ? "none" : hms(file.last)) + ", " + fmt(M.free) +
          " bytes left on the card; the screen's last line " + (screen.last === null ? "none" : hms(screen.last)) + "; " + M.pages + " texts to Bryluen.", "");
        draw(api);
      });
      S.ctl.play = api.control.button("play", "play the night", function () { playAll(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        pages: api.stat("pages", "texts to Bryluen", "ok"),
        missed: api.stat("missed", "critical lines that never reached the pager", "bad"),
        filelast: api.stat("filelast", "the file's last line", ""),
        screenlast: api.stat("screenlast", "the screen's last line", ""),
        unwritten: api.stat("unwritten", "lines the file never wrote", "bad"),
        reports: api.stat("reports", "failures reported", "warn"),
        queued: api.stat("queued", "lines waiting in memory", "warn"),
        card: api.stat("card", "card space left", ""),
        tank: api.stat("tank", "tank 3 when Bryluen gets there", "")
      };

      api.info("<strong>how to read it.</strong> every reading becomes a message with a level and goes to three handlers: " +
        "the file on the memory card, the screen in the brew house and the pager that texts Bryluen. each row shows one handler through the night: " +
        "plain while it gets and sends its lines, red while its send fails, amber while messages stop before they reach it. the table counts each " +
        "handler's lines. step moves to the next moment that matters; play runs the night to 07:09:58.");

      api.log("02:30:00. six tanks, a reading every 2 s; 184,320 bytes left on the card; tank 3 at " + deg(START) +
        " and warming. press step or play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. opens at 02:30:00, before the first reading.
      t.expect(t.stat("pages") === 0 && t.stat("missed") === 0 && t.stat("unwritten") === 0 && t.stat("reports") === 0 &&
        t.stat("filelast") === "none yet" && t.stat("screenlast") === "none yet" && t.stat("card") === "184,320 bytes" &&
        t.stat("tank") === "no text yet" && has("02:30:00. six tanks, a reading every 2 s; 184,320 bytes left on the card"),
        "opens at 02:30:00 before the first reading, with 184,320 bytes left on the card");

      // 2. two steps: the last line that fits, at 02:46:58.
      t.click("step");
      t.click("step");
      t.expect(t.stat("filelast") === "02:46:58" && t.stat("card") === "0 bytes" && t.stat("unwritten") === 0 &&
        t.stat("screenlast") === "02:40:00",
        "at 02:46:58 the last line fills the card exactly; the screen's last line is 02:40:00");

      // 3. 02:47:00: the file's send throws and the chain stops.
      t.click("step");
      t.expect(has("02:47:00. a debug line reaches the file handler: card full, so its send throws an error. handle() stops before next.handle(): the screen and pager handlers never get this message.") &&
        t.stat("unwritten") === 6,
        "02:47:00: the six debug lines fail at the file handler");

      // 4. 03:10:00: the first critical line dies at the file handler.
      t.click("step");
      t.expect(has("03:10:00. tank 3 passes 21.0°C: a critical line. it never reaches the pager.") &&
        t.stat("missed") === 1 && t.stat("pages") === 0,
        "03:10:00: tank 3's critical line never reaches the pager");

      // 5. the whole night as built.
      t.click("play");
      t.expect(t.stat("pages") === 0 && t.stat("missed") === 24 && t.stat("unwritten") === "47,520" &&
        t.stat("filelast") === "02:46:58" && t.stat("screenlast") === "02:40:00" && t.stat("tank") === "23.0°C at 07:10",
        "as built: 0 texts, 24 critical lines lost, 47,520 lines unwritten, tank 3 at 23.0 C at 07:10");

      // 6. pager first: the texts go, the file and screen still go silent, nothing reports it.
      t.set("design", "pagerfirst");
      t.expect(t.stat("pages") === 24 && t.stat("missed") === 0 && t.stat("filelast") === "02:46:58" &&
        t.stat("screenlast") === "02:40:00" && t.stat("unwritten") === "47,520" && t.stat("reports") === 0 &&
        t.stat("tank") === "21.3°C at 03:45",
        "pager first: 24 texts from 03:10, Bryluen at the tank at 03:45; the file and screen silent, unreported");

      // 7. a 32 GB card: fine on the night, silent pager when the screen fails.
      t.set("design", "bigcard");
      var big = t.stat("pages") === 24 && t.stat("unwritten") === 0 && t.stat("filelast") === "07:09:58";
      t.set("fault", "screen");
      t.expect(big && t.stat("pages") === 0 && t.stat("missed") === 24 && t.stat("tank") === "23.0°C at 07:10" &&
        has("02:50:00. an info line reaches the screen handler: screen unplugged, so its send throws an error."),
        "32 GB card: 24 texts on the night; with the screen unplugged, 0 texts again");

      // 8. a queue and writer per handler: texts go, the file's lines wait in memory, nothing reports it.
      t.set("fault", "card");
      t.set("design", "queues");
      t.expect(t.stat("pages") === 24 && t.stat("queued") === "47,520" && t.stat("reports") === 0 &&
        t.stat("screenlast") === "07:00:00" && t.stat("tank") === "21.3°C at 03:45",
        "queues: 24 texts, the screen to 07:00:00, 47,520 lines waiting in memory, 0 reports");

      // 9. catch, report once, pass on: one report at 02:47, then every critical text.
      t.set("design", "catch");
      t.expect(has("02:47:00. the file handler catches its error (card full) and passes the message on. it reports once: \"file handler failing: card full\" goes to the other handlers.") &&
        t.stat("pages") === 25 && t.stat("reports") === 1 && t.stat("unwritten") === "47,520" &&
        t.stat("screenlast") === "07:00:00" && t.stat("tank") === "21.3°C at 03:45",
        "catch: 1 report at 02:47, 24 critical texts, 25 in all; the screen runs to 07:00:00");

      // 10. catch with the screen unplugged: the report comes from the screen, the pager still texts.
      t.set("fault", "screen");
      t.expect(t.stat("reports") === 1 && t.stat("pages") === 25 && t.stat("missed") === 0 && t.stat("unwritten") === 0,
        "catch, screen unplugged: 1 report, 25 texts, nothing lost before the pager");

      // 11. the file at info level: the card does not fill tonight.
      t.set("fault", "card");
      t.set("design", "built");
      t.set("level", "info");
      t.expect(t.stat("unwritten") === 0 && t.stat("pages") === 24 && t.stat("card") === "172,800 bytes" &&
        t.stat("filelast") === "07:00:00",
        "file at info: 192 lines, 11,520 bytes, 172,800 bytes left; 24 texts");
    }
  });
})();
