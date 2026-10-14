/* sims/s5e12-v1.0.0.js  (published as sims/s5e12.js)
   Case s5e12 "Leaks": a heap lab for the Quillmere pumping station. Its monitoring service (Java)
   takes readings from 9 sensors. Zygmunt's new version adds a listener every time a sensor's radio
   link drops and comes back, and never removes the old one. Each listener keeps its own 8 MB
   buffer of readings, so the old ones are still reachable and the collector can't free them. The
   learner runs the week night by night, picks a fix, changes the reconnects per night and the
   sensor's wait for an answer, and compares two nights' heaps. Widget-style sim inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: nights 0 to 6; fixes none, double heap, restart nightly at
     22:00, garbage collection by hand every hour, remove each listener when its sensor drops;
     reconnects 0, 25, 50, 75, 100 a night; the sensor's wait 4, 6, 8, 10, 12 s; snapshot compare.
     Stats: night, listeners, memory in use at 03:00, leaked, the 03:00 pause, messages deleted,
     the alarm, the alarm log's gap, the night memory runs out, full collections a day.
     selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - Night 0 is Monday 14:00, when the new version starts: 9 sensors, 9 listeners, 600 MB in use
     (the 9 listeners' 9 x 8 = 72 MB included). Night 1 is Monday to Tuesday, night 6 Saturday to
     Sunday.
   - Each night the big pumps start at 23:00 and the links drop and come back R times between 23:00
     and 02:00 (R = 25 as built). Each reconnect makes a fresh Sensor object and a new listener with
     a fresh 8 MB buffer; the old listener stays on the bus. Leaked after n nights = n x R x 8 MB.
   - At 03:00:00 the nightly report job starts, and the full collection starts with it. Its pause
     is 1 s plus 1 s for each 100 MB of leaked listener memory. The pause is spent tracing what is
     still in use, so collecting more often does not shorten it.
   - The high-water sensor sends a message every 2 s (03:00:00, 03:00:02 ...). Its radio holds each
     message until the service takes it in and answers. A message sent during the pause is answered
     when the pause ends: wait = end of pause - send time. Kept if wait <= the sensor's wait (6 s as
     built); otherwise the radio deletes it and does not send it again. A message sent after the
     pause is answered at once.
   - On night 4 (rain) the level crosses the high-water line at 03:00:02, and that message is the
     one alarm message. The service raises the alarm only on that message.
   - The alarm log has no line from 03:00:00 until the pause ends: the gap is the pause.
   - Memory runs out on the first night whose 03:00 memory in use is over the heap: 4,096 MB as
     built, 8,192 MB doubled.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e12-v1.0.0.json):
   - Leaked: 25 x 8 = 200 MB a night. Nights 1 to 6: 200, 400, 600, 800, 1,000, 1,200 MB.
   - In use at 03:00: 600 + leaked = 800, 1,000, 1,200, 1,400 MB on nights 1 to 4.
   - Listeners: 9 + 25n = 34, 59, 84, 109 on nights 1 to 4; they hold 8 MB each (872 MB on night 4).
   - Pause: 1 + leaked / 100 = 3, 5, 7, 9 s on nights 1 to 4 (11, 13 s on nights 5, 6).
   - Dropped with a 6 s wait: a message at 03:00:0k is dropped if pause - k > 6. Night 1 and 2:
     none (longest wait 3 s, 5 s). Night 3: 03:00:00 (waited 7 s); 03:00:02 waited 5 s, kept.
     Night 4: 03:00:00 (9 s) and the 03:00:02 alarm (7 s); 03:00:04 waited 5 s, kept.
     Nights 5, 6: 3 and 4 dropped.
   - Snapshot, night 3 against night 4: 84 to 109 listeners (+25), 672 MB to 872 MB (+200 MB).
   - Runs out: 600 + 200n > 4,096 first at n = 18 (4,200 MB); doubled, > 8,192 first at n = 38.
   - Restart at 22:00: only that night's 200 MB is leaked at 03:00, so 3 s every night; the alarm
     at 03:00:02 is answered at 03:00:03. With 75 reconnects: 600 MB, 7 s, the 03:00:00 reading
     dropped; with 100: 800 MB, 9 s, the alarm dropped.
   - Remove listeners: 0 leaked, 1 s, 9 listeners, the alarm answered at 03:00:02.
   - A 10 s wait with no fix: night 4's alarm waits 7 s and is kept, answered at 03:00:09.
*/
(function () {
  "use strict";

  var SENSORS = 9;
  var BUF = 8;          // MB per listener's buffer
  var BASE = 600;       // MB in use with the 9 listeners in use
  var HEAP = 4096;      // MB, as built
  var RAIN_NIGHT = 4;
  var ALARM_AT = 2;     // seconds after 03:00:00
  var NIGHTS = 6;
  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  var FIXES = [
    { value: "none", label: "No fix (as built)" },
    { value: "double", label: "Double the memory and heap size" },
    { value: "restart", label: "Restart the service every evening at 22:00" },
    { value: "hourly", label: "Call the garbage collector by hand every hour" },
    { value: "remove", label: "Remove each listener when its sensor drops" }
  ];
  var FIX_SHORT = {
    none: "no fix",
    double: "the heap doubled to 8,192 MB",
    restart: "a restart every evening at 22:00",
    hourly: "a collection by hand every hour",
    remove: "each listener removed when its sensor drops"
  };
  var RECONNECTS = [0, 25, 50, 75, 100];
  var WAITS = [4, 6, 8, 10, 12];

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function two(n) { return n < 10 ? "0" + n : String(n); }
  function at(sec) { return "03:00:" + two(sec); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions) ---------- */

  // Leaked MB at 03:00 on night n.
  function leakedAt(C, n) {
    if (n < 1 || C.fix === "remove") return 0;
    if (C.fix === "restart") return C.R * BUF;
    return n * C.R * BUF;
  }
  function heapOf(C) { return C.fix === "double" ? HEAP * 2 : HEAP; }
  function pauseOf(leaked) { return 1 + leaked / 100; }

  // The messages from 03:00:00 to 03:00:12 on night n.
  function messages(C, n) {
    var P = pauseOf(leakedAt(C, n));
    var out = [];
    for (var k = 0; k <= 12; k += 2) {
      var during = k < P;
      var wait = during ? P - k : 0;
      var kept = wait <= C.T;
      out.push({
        k: k,
        alarm: n === RAIN_NIGHT && k === ALARM_AT,
        wait: wait,
        kept: kept,
        answered: kept ? (during ? P : k) : null
      });
    }
    return out;
  }

  function runsOut(C) {
    var heap = heapOf(C);
    if (C.fix === "remove" || C.R === 0) return BASE > heap ? 1 : 0;
    if (C.fix === "restart") return BASE + C.R * BUF > heap ? 1 : 0;
    for (var n = 1; n < 1000; n++) if (BASE + n * C.R * BUF > heap) return n;
    return 0;
  }

  function night(C, n) {
    var leaked = leakedAt(C, n);
    var msgs = messages(C, n);
    var dropped = msgs.filter(function (m) { return !m.kept; });
    var alarm = "not due";
    msgs.forEach(function (m) {
      if (m.alarm) alarm = m.kept ? "sounded " + at(m.answered) : "missed";
    });
    return {
      n: n,
      leaked: leaked,
      inUse: BASE + leaked,
      listeners: SENSORS + leaked / BUF,
      pause: pauseOf(leaked),
      msgs: msgs,
      dropped: dropped,
      alarm: alarm
    };
  }

  function nightName(n) { return DAYS[n - 1] + " to " + DAYS[n]; }

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
    var bar = el("div", "font-size:12px;");
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["sent", "message", "answered", "waited", "result"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    var nights = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    box.appendChild(bar);
    box.appendChild(table);
    box.appendChild(nights);
    api.root.appendChild(box);
    return { el: el, head: head, bar: bar, tbody: tbody, nights: nights };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var cur = S.n > 0 ? night(C, S.n) : null;
    ui.head.textContent = "Week with " + FIX_SHORT[C.fix] + ", " + C.R + " reconnects a night, and a sensor that waits " +
      C.T + " s for an answer. " + (S.n === 0 ? "Monday 14:00: the new version has just started." : "Night " + S.n + ", " + nightName(S.n) + ".");
    var used = cur ? cur.inUse : BASE;
    var heap = heapOf(C);
    var blocks = Math.max(0, Math.min(40, Math.round(used * 40 / heap)));
    ui.bar.textContent = "Heap at 03:00 [" + new Array(blocks + 1).join("#") + new Array(41 - blocks).join(".") + "] " +
      fmt(used) + " of " + fmt(heap) + " MB";
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    if (cur) {
      cur.msgs.forEach(function (m) {
        var tr = ui.el("tr");
        [at(m.k), m.alarm ? "HIGH-WATER ALARM" : "reading",
          m.kept ? at(m.answered) : "never", m.wait + " s",
          m.kept ? "kept" : "deleted"].forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
        ui.tbody.appendChild(tr);
      });
    }
    var hist = [];
    for (var i = 1; i <= S.n; i++) hist.push("night " + i + ": " + pauseOf(leakedAt(C, i)) + " s");
    ui.nights.textContent = hist.length ? "03:00 pauses so far, " + hist.join(", ") + "." : "No night run yet.";

    S.stat.night(S.n);
    S.stat.listeners(cur ? cur.listeners : SENSORS);
    S.stat.inuse(fmt(used) + " MB");
    S.stat.leaked(fmt(cur ? cur.leaked : 0) + " MB");
    S.stat.pause(cur ? cur.pause + " s" : "none yet");
    S.stat.dropped(cur ? cur.dropped.length : 0);
    S.stat.alarm(cur ? cur.alarm : "not due");
    S.stat.gap(cur ? cur.pause + " s" : "none yet");
    var ro = runsOut(C);
    S.stat.full(ro ? "night " + ro : "never");
    S.stat.collections(C.fix === "hourly" ? 24 : 1);
    S.ctl.next.disable(S.n >= NIGHTS);
    S.ctl.all.disable(S.n >= NIGHTS);
  }

  function startWeek(api, why) {
    var S = api.state;
    S.n = 0;
    api.log((why ? why + " " : "") + "Monday 14:00: the service starts with " + FIX_SHORT[S.C.fix] + ". " + SENSORS +
      " sensors, " + SENSORS + " listeners, " + BASE + " MB in use. Each night: reconnects from 23:00 to 02:00, the report job at 03:00:00.", "");
    draw(api);
  }

  function runNight(api) {
    var S = api.state;
    var C = S.C;
    if (S.n >= NIGHTS) return;
    var n = S.n + 1;
    var r = night(C, n);
    var s = "Night " + n + ", " + nightName(n) + ": " + C.R + " reconnects";
    if (C.fix === "restart") s += " after the 22:00 restart";
    s += "; " + r.listeners + " listeners hold " + fmt(r.listeners * BUF) + " MB, " + fmt(r.leaked) + " MB of it leaked; " +
      fmt(r.inUse) + " MB in use. At 03:00:00 the full collection pauses the service for " + r.pause + " s.";
    if (r.dropped.length) {
      s += " Deleted: " + r.dropped.map(function (m) {
        return at(m.k) + " " + (m.alarm ? "HIGH-WATER ALARM" : "reading") + " (waited " + m.wait + " s)";
      }).join(", ") + ".";
    } else {
      s += " Nothing deleted; the longest wait was " + r.msgs[0].wait + " s.";
    }
    s += " The alarm log has a " + r.pause + " s gap.";
    if (r.alarm === "missed") s += " The alarm never sounded.";
    else if (r.alarm !== "not due") s += " The alarm " + r.alarm.replace("sounded ", "sounded at ") + ".";
    if (C.fix === "hourly") s += " And 23 more pauses like it through the day.";
    S.n = n;
    api.log(s, r.alarm === "missed" ? "bad" : (r.dropped.length ? "warn" : "ok"));
    draw(api);
  }

  function snapshot(api) {
    var S = api.state;
    var C = S.C;
    if (S.n < 1) {
      api.log("Snapshot: run a night first. A snapshot means something only next to another one.", "");
      return;
    }
    var a = night(C, S.n - 1);
    var b = night(C, S.n);
    var la = S.n - 1 === 0 ? SENSORS : a.listeners;
    var d = b.listeners - la;
    api.log("Snapshot, night " + (S.n - 1) + " against night " + S.n + ": ReadingListener objects " + la + " to " + b.listeners +
      " (+" + d + "), holding " + fmt(la * BUF) + " MB to " + fmt(b.listeners * BUF) + " MB (+" + fmt(d * BUF) + " MB). Everything else: " +
      fmt(BASE - SENSORS * BUF) + " MB, unchanged." + (d ? " Each new one is held by the bus's list of listeners." : ""), d ? "warn" : "ok");
  }

  /* ---------- the module ---------- */

  DL.sims.define("s5e12", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { fix: "none", R: 25, T: 6 };
      S.n = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.fix = api.control.select("fix", "The fix", FIXES, "none", function (v) {
        var o = pick(FIXES, v);
        if (!o) return;
        S.C.fix = String(o.value);
        startWeek(api, "New week.");
      });
      S.ctl.reconnects = api.control.select("reconnects", "Reconnects a night",
        RECONNECTS.map(function (r) { return { value: r, label: String(r) }; }), 25, function (v) {
          S.C.R = Number(v);
          startWeek(api, "Reconnects a night: " + S.C.R + ".");
        });
      S.ctl.wait = api.control.select("wait", "The sensor waits for an answer (s)",
        WAITS.map(function (w) { return { value: w, label: w + " s" }; }), 6, function (v) {
          S.C.T = Number(v);
          startWeek(api, "The sensor now waits " + S.C.T + " s.");
        });
      S.ctl.next = api.control.button("next", "Run the next night", function () { runNight(api); });
      S.ctl.all = api.control.button("all", "Run to night 6", function () { while (S.n < NIGHTS) runNight(api); });
      S.ctl.snap = api.control.button("snapshot", "Compare tonight's heap with last night's", function () { snapshot(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        night: api.stat("night", "night", ""),
        listeners: api.stat("listeners", "listeners on the bus", "warn"),
        inuse: api.stat("inuse", "memory in use at 03:00", ""),
        leaked: api.stat("leaked", "held by old listeners", "bad"),
        pause: api.stat("pause", "the 03:00 pause", "warn"),
        dropped: api.stat("dropped", "messages deleted at 03:00", "bad"),
        alarm: api.stat("alarm", "high-water alarm", "bad"),
        gap: api.stat("gap", "gap in the alarm log", "warn"),
        full: api.stat("full", "memory runs out on", ""),
        collections: api.stat("collections", "full collections a day", "")
      };

      api.info("<strong>How to read it.</strong> Each night the sensors' links drop and come back, and each time a new listener with an 8 MB buffer joins the bus. At 03:00:00 the full collection pauses the service. The table shows the high-water sensor's messages from 03:00:00: when each was sent, when the service answered, how long it waited, and whether the sensor's radio kept it or gave up on it. On night 4 the 03:00:02 message is the high-water alarm.");

      startWeek(api, "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function nights(k) { for (var i = 0; i < k; i++) t.click("next"); }

      // 1. Opens on Monday 14:00, before night 1.
      t.expect(t.stat("night") === 0 && t.stat("listeners") === 9 && t.stat("inuse") === "600 MB" &&
        t.stat("pause") === "none yet" && t.stat("alarm") === "not due" && t.stat("full") === "night 18" &&
        t.logText().indexOf("Monday 14:00: the service starts with no fix.") >= 0,
        "Opens on Monday 14:00: 9 listeners, 600 MB in use, no night run yet");

      // 2. Nights 1 and 2: a gap, no loss.
      begin();
      t.click("next");
      var n1 = t.stat("pause") === "3 s" && t.stat("dropped") === 0 && t.stat("gap") === "3 s" && t.stat("inuse") === "800 MB" &&
        t.stat("listeners") === 34 && has("Nothing deleted; the longest wait was 3 s.");
      begin();
      t.click("next");
      t.expect(n1 && t.stat("pause") === "5 s" && t.stat("dropped") === 0 && has("Nothing deleted; the longest wait was 5 s."),
        "Nights 1 and 2: pauses of 3 s and 5 s leave gaps but drop nothing");

      // 3. Night 3: one ordinary reading dropped.
      begin();
      t.click("next");
      t.expect(t.stat("pause") === "7 s" && t.stat("dropped") === 1 && t.stat("alarm") === "not due" &&
        has("Deleted: 03:00:00 reading (waited 7 s).") && t.stat("inuse") === "1,200 MB",
        "Night 3: a 7 s pause drops the 03:00:00 reading; the 03:00:02 one waits 5 s and is kept");

      // 4. Night 4: the alarm is dropped.
      begin();
      t.click("next");
      t.expect(t.stat("pause") === "9 s" && t.stat("dropped") === 2 && t.stat("alarm") === "missed" && t.stat("listeners") === 109 &&
        t.stat("inuse") === "1,400 MB" && t.stat("leaked") === "800 MB" &&
        has("Deleted: 03:00:00 reading (waited 9 s), 03:00:02 HIGH-WATER ALARM (waited 7 s). The alarm log has a 9 s gap. The alarm never sounded."),
        "Night 4: a 9 s pause drops the 03:00:00 reading and the 03:00:02 alarm; 109 listeners, 1,400 MB");

      // 5. The snapshot compares nights 3 and 4.
      begin();
      t.click("snapshot");
      t.expect(has("ReadingListener objects 84 to 109 (+25), holding 672 MB to 872 MB (+200 MB). Everything else: 528 MB, unchanged."),
        "Snapshot: 25 more listeners and 200 MB more in one night, nothing else grew");

      // 6. Nights 5 and 6 keep growing.
      t.click("next");
      var p5 = t.stat("pause") === "11 s" && t.stat("dropped") === 3;
      t.click("next");
      t.expect(p5 && t.stat("pause") === "13 s" && t.stat("dropped") === 4 && t.stat("night") === 6,
        "Nights 5 and 6: 11 s and 13 s, three and four messages dropped");

      // 7. Double the heap: the same pauses, memory runs out later.
      t.set("fix", "double");
      nights(4);
      t.expect(t.stat("pause") === "9 s" && t.stat("alarm") === "missed" && t.stat("full") === "night 38",
        "Double heap: night 4 is still 9 s and the alarm is missed; memory runs out on night 38 instead of 18");

      // 8. Restart nightly: 3 s, until a night of many reconnects.
      t.set("fix", "restart");
      nights(4);
      var r1 = t.stat("pause") === "3 s" && t.stat("alarm") === "sounded 03:00:03" && t.stat("listeners") === 34;
      t.set("reconnects", 75);
      nights(3);
      var r2 = t.stat("pause") === "7 s" && t.stat("dropped") === 1;
      t.set("reconnects", 100);
      nights(4);
      t.expect(r1 && r2 && t.stat("pause") === "9 s" && t.stat("alarm") === "missed",
        "Restart at 22:00: 3 s every night and the alarm sounds at 03:00:03; 75 reconnects give 7 s, 100 give 9 s and the alarm is missed");
      t.set("reconnects", 25);

      // 9. Garbage collection by hand every hour: the leak is still reachable.
      t.set("fix", "hourly");
      nights(4);
      t.expect(t.stat("pause") === "9 s" && t.stat("alarm") === "missed" && t.stat("collections") === 24 && t.stat("leaked") === "800 MB",
        "Hourly collections: the same 9 s pause on night 4, the alarm missed, and 24 pauses a day");

      // 10. Remove listeners: nothing leaks.
      t.set("fix", "remove");
      begin();
      nights(4);
      t.click("snapshot");
      t.expect(t.stat("pause") === "1 s" && t.stat("listeners") === 9 && t.stat("dropped") === 0 && t.stat("alarm") === "sounded 03:00:02" &&
        t.stat("full") === "never" && t.stat("inuse") === "600 MB" && has("ReadingListener objects 9 to 9 (+0)"),
        "Remove listeners: 9 listeners, 600 MB, a 1 s pause, and the alarm sounds at 03:00:02");

      // 11. A longer wait, no fix: night 4's alarm is kept, late.
      t.set("fix", "none");
      t.set("wait", 10);
      nights(4);
      t.expect(t.stat("pause") === "9 s" && t.stat("dropped") === 0 && t.stat("alarm") === "sounded 03:00:09",
        "A 10 s wait with no fix: the 9 s pause still happens, but the alarm is kept and sounds at 03:00:09");
    }
  });
})();
