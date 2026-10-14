/* sims/s6e09-v1.0.0.js  (published as sims/s6e09.js)
   Case s6e09 "Boxes in Boxes": a gate lab for Lowmarsh Yard, a shipping-container yard. Ten boxes
   come and go in one night shift. The gate system logs each arrival on the old gate server in UK
   time; the departures service logs each departure from a container built on gatebase:slim, a slim
   base image with no time-zone data, so it writes UTC. Billing subtracts the two bare times. The
   learner picks the night, the base image, the TZ environment variable, the host's time zone, where
   departures runs, and whether every time carries its offset, can restart the container mid-night,
   and plays the night one event at a time or to 06:00.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: nights Mon 30 Mar 2026 (first after the clocks went forward,
     offset +1) and Mon 16 Mar 2026 (winter, offset 0); base image slim or slim plus a time-zone data
     layer; TZ unset or Europe/London; host time zone UTC or UK time; departures in its container or
     on the old gate server; offsets off or on. Buttons: next event, run the night, restart the
     departures container, start the night again, reset. A table of the ten boxes and a small
     host / container / image drawing. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - The shift runs from 20:00 Monday to 06:00 Tuesday, UK time. Ten boxes, each dropped off by one
     lorry and collected by another the same night (MOVES below, minutes after 20:00).
   - Offset tonight: 30 March 2026 is UTC + 1 (the clocks went forward on Sunday 29 March, 01:00);
     16 March is UTC + 0 (winter).
   - Gate system: on the gate server, set to UK time, with time-zone data: writes UK time.
   - Departures writes UK time only if it runs on the old gate server, or if its image holds
     time-zone data AND TZ=Europe/London is passed. Otherwise it writes UTC. The host's time-zone
     setting is never read by the container. A restart starts the same image again: nothing changes.
   - Billing: with offsets on, both times are turned into UTC first, so billed = real stay. With
     offsets off, billing subtracts the bare clock readings: departure as logged minus arrival as
     logged.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e09-v1.0.0.json):
   - Real stays (minutes): 130, 145, 200, 105, 160, 30, 150, 110, 135, 125 = 1,290.
   - QZRU 2051144: in 23:20, out 23:50 (30 minutes). On 30 March the container writes 23:50 UK
     time as 22:50 UTC, so billed 22:50 - 23:20 = -30 (the post's record).
   - 30 March, departures in UTC, no offsets: every departure logged 60 minutes early, billed
     1,290 - 10 x 60 = 690, 600 short; only QZRU 2051144 (30 < 60) goes below zero.
   - 16 March: offset 0, so UTC and UK time read the same: billed 1,290, 0 short.
   - Option 0 (host to UK time), option 2 (restart) and TZ on the slim image: still UTC, 690.
   - Option 1 (offsets on): 1,290 on both nights, whatever else is set.
   - Option 3 (old gate server): UK time, 1,290 tonight.
   - TZ=Europe/London plus the time-zone data layer: UK time, 1,290. The layer without TZ: UTC, 690.
   - The first ten events, to 23:50: four boxes out (QZRU 4183520, 3307610, 5524087, 2051144),
     real 130 + 145 + 105 + 30 = 410, billed 70 + 85 + 45 - 30 = 170.
*/
(function () {
  "use strict";

  var START = 1200;   // 20:00, minutes after Monday 00:00
  var MOVES = [
    { box: "QZRU 4183520", i: 5, o: 135 },
    { box: "QZRU 3307610", i: 40, o: 185 },
    { box: "QZRU 1192873", i: 75, o: 275 },
    { box: "QZRU 5524087", i: 110, o: 215 },
    { box: "QZRU 2760392", i: 150, o: 310 },
    { box: "QZRU 2051144", i: 200, o: 230 },
    { box: "QZRU 6083155", i: 255, o: 405 },
    { box: "QZRU 1415961", i: 330, o: 440 },
    { box: "QZRU 3870244", i: 400, o: 535 },
    { box: "QZRU 4639570", i: 455, o: 580 }
  ];
  var STORY = 5;      // QZRU 2051144
  var END = 600;      // 06:00

  var NIGHTS = [
    { value: "spring", label: "Mon 30 Mar 2026 (first night since the clocks went forward)", d: 30, off: 60 },
    { value: "winter", label: "Mon 16 Mar 2026 (a winter night)", d: 16, off: 0 }
  ];
  var BASES = [
    { value: "slim", label: "gatebase:slim (no time-zone data)" },
    { value: "tzdata", label: "gatebase:slim plus a time-zone data layer" }
  ];
  var TZS = [
    { value: "none", label: "TZ not set (as now)" },
    { value: "london", label: "TZ=Europe/London" }
  ];
  var HOSTS = [
    { value: "utc", label: "UTC (as now)" },
    { value: "uk", label: "UK time" }
  ];
  var WHERE = [
    { value: "container", label: "Its container on the host (since 9 February)" },
    { value: "old", label: "The old gate server (as before February)" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function fmt(n) { var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); return n < 0 ? "-" + s : s; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function hm(m) { var x = ((m % 1440) + 1440) % 1440; return two(Math.floor(x / 60)) + ":" + two(x % 60); }
  // A clock reading, minutes after Monday 00:00 of the chosen night, as "2026-03-30 22:50".
  function stamp(N, m) {
    var day = N.d + Math.floor(m / 1440);
    return "2026-03-" + two(day) + " " + hm(m);
  }
  function offText(off) { return off ? "+01:00" : "+00:00"; }

  /* ---------- the model (pure) ---------- */

  function night(C) { return pick(NIGHTS, C.night); }
  function depZone(C) {
    if (C.where === "old") return "uk";
    if (C.base === "tzdata" && C.tz === "london") return "uk";
    return "utc";
  }
  function zoneText(C) { return depZone(C) === "uk" ? "UK time" : "UTC"; }

  function events() {
    var ev = [];
    MOVES.forEach(function (mv, k) {
      ev.push({ t: mv.i, k: k, kind: "in" });
      ev.push({ t: mv.o, k: k, kind: "out" });
    });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }
  var EVENTS = events();

  // One box's record on this night with these settings.
  function record(C, k) {
    var N = night(C);
    var mv = MOVES[k];
    var realIn = START + mv.i;
    var realOut = START + mv.o;
    var shift = depZone(C) === "utc" ? N.off : 0;
    var logIn = realIn;
    var logOut = realOut - shift;
    var inOff = N.off;
    var outOff = depZone(C) === "utc" ? 0 : N.off;
    var real = mv.o - mv.i;
    var billed = C.offsets ? (logOut - outOff) - (logIn - inOff) : logOut - logIn;
    return {
      realIn: realIn, realOut: realOut, real: real, billed: billed,
      inText: stamp(N, logIn) + (C.offsets ? offText(inOff) : ""),
      outText: stamp(N, logOut) + (C.offsets ? offText(outOff) : "")
    };
  }

  function newNight(C) {
    return { C: C, e: 0, out: [], real: 0, billed: 0, neg: 0, restarts: 0 };
  }

  function nowMin(R) { return R.e === 0 ? 0 : (R.e >= EVENTS.length ? END : EVENTS[R.e - 1].t); }

  // Runs one event; returns its log line.
  function stepEvent(R) {
    var ev = EVENTS[R.e];
    var C = R.C;
    var mv = MOVES[ev.k];
    var r = record(C, ev.k);
    R.e += 1;
    if (ev.kind === "in") {
      return { txt: hm(START + ev.t) + " " + mv.box + " IN. Gate log " + r.inText + ".", tone: "" };
    }
    R.out.push(ev.k);
    R.real += r.real;
    R.billed += r.billed;
    if (r.billed < 0) R.neg += 1;
    var txt = hm(START + ev.t) + " " + mv.box + " OUT. Departures log " + r.outText + " (" + zoneText(C) + "), gate log IN " +
      r.inText + ". Billed " + r.billed + " minutes; real stay " + r.real + " minutes.";
    return { txt: txt, tone: r.billed < 0 ? "bad" : (r.billed !== r.real ? "warn" : "ok") };
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
    var boxes = el("div", "font-size:11px;");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["box", "real in", "real out", "real stay", "gate log IN", "departures log OUT", "billed"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    [head, boxes, wrap].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, boxes: boxes, tbody: tbody };
  }

  // Host, container and image as boxes in boxes.
  function drawBoxes(S) {
    var ui = S.ui;
    var C = S.C;
    var el = ui.el;
    while (ui.boxes.firstChild) ui.boxes.removeChild(ui.boxes.firstChild);
    var line = "border:1px solid currentColor;border-radius:4px;padding:4px 6px;display:grid;gap:4px;";
    if (C.where === "old") {
      var g = el("div", line);
      g.appendChild(el("div", "font-weight:600;", "Old gate server: UK time, time-zone data present"));
      g.appendChild(el("div", "", "Gate system and departures both run here and read the same UK clock."));
      ui.boxes.appendChild(g);
    } else {
      var gate = el("div", line);
      gate.appendChild(el("div", "font-weight:600;", "Gate server: UK time, time-zone data present"));
      gate.appendChild(el("div", "", "Gate system writes UK time."));
      var host = el("div", line);
      host.appendChild(el("div", "font-weight:600;", "Host: rented server, time zone " + (C.host === "uk" ? "UK time" : "UTC") + " (the container does not read this)"));
      var cont = el("div", line);
      cont.appendChild(el("div", "font-weight:600;", "Container: departures, " + (S.R.restarts ? "restarted " + S.R.restarts + "x" : "running since 9 Feb")));
      cont.appendChild(el("div", "", "Environment variables: " + (C.tz === "london" ? "TZ=Europe/London" : "none")));
      var img = el("div", line);
      img.appendChild(el("div", "font-weight:600;", "Image: " + (C.base === "tzdata" ? "gatebase:slim + time-zone data layer" : "gatebase:slim")));
      img.appendChild(el("div", "", "Time-zone data: " + (C.base === "tzdata" ? "present" : "none")));
      cont.appendChild(img);
      cont.appendChild(el("div", "font-weight:600;", "Writes: " + zoneText(C)));
      host.appendChild(cont);
      ui.boxes.appendChild(gate);
      ui.boxes.appendChild(host);
    }
  }

  function drawTable(S) {
    var ui = S.ui;
    var R = S.R;
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    MOVES.forEach(function (mv, k) {
      var r = record(S.C, k);
      var inDone = false;
      for (var j = 0; j < R.e; j++) if (EVENTS[j].k === k && EVENTS[j].kind === "in") inDone = true;
      var outDone = R.out.indexOf(k) >= 0;
      var tr = ui.el("tr", "opacity:" + (inDone ? "1" : "0.55") + ";");
      [mv.box, hm(r.realIn), hm(r.realOut), r.real + " min",
        inDone ? r.inText : "-", outDone ? r.outText : "-", outDone ? r.billed + " min" : "-"].forEach(function (c) {
        tr.appendChild(ui.el("td", "padding:2px 4px;", c));
      });
      ui.tbody.appendChild(tr);
    });
  }

  function nowText(S) {
    var N = night(S.C);
    var m = START + nowMin(S.R);
    var day = m >= 1440 ? (N.d + 1) + " Mar" : N.d + " Mar";
    return (m >= 1440 ? "Tue " : "Mon ") + day + ", " + hm(m);
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var C = S.C;
    var N = night(C);
    S.ui.head.textContent = N.label + ". UK time is UTC + " + (N.off / 60) + ". Departures writes " + zoneText(C) +
      ". Offsets on every time: " + (C.offsets ? "on" : "off") + ".";
    drawBoxes(S);
    drawTable(S);
    S.stat.now(nowText(S));
    S.stat.out(R.out.length + " of 10");
    S.stat.zone(zoneText(C));
    S.stat.offset("UTC + " + (N.off / 60));
    S.stat.real(fmt(R.real));
    S.stat.billed(fmt(R.billed));
    S.stat.short(fmt(R.real - R.billed));
    S.stat.neg(R.neg);
    S.stat.story(R.out.indexOf(STORY) >= 0 ? record(C, STORY).billed : "not yet");
    var done = R.e >= EVENTS.length;
    S.ctl.next.disable(done);
    S.ctl.all.disable(done);
  }

  function next(api) {
    var R = api.state.R;
    if (R.e >= EVENTS.length) return;
    var l = stepEvent(R);
    api.log(l.txt, l.tone);
    draw(api);
  }

  function runAll(api) {
    var R = api.state.R;
    if (R.e >= EVENTS.length) return;
    while (R.e < EVENTS.length) stepEvent(R);
    api.log("06:00, gate shut. 10 boxes out; real " + fmt(R.real) + " minutes, billed " + fmt(R.billed) + ", " +
      fmt(R.real - R.billed) + " short; " + R.neg + (R.neg === 1 ? " bill" : " bills") + " below zero.",
      R.neg ? "bad" : (R.real !== R.billed ? "warn" : "ok"));
    draw(api);
  }

  function restartNight(api, why) {
    var S = api.state;
    S.R = newNight(S.C);
    var N = night(S.C);
    api.log((why ? why + " " : "") + "Mon " + N.d + " Mar 2026, 20:00. The gate opens; 10 boxes tonight. UK time is UTC + " +
      (N.off / 60) + "; departures writes " + zoneText(S.C) + ".", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { night: "spring", base: "slim", tz: "none", host: "utc", where: "container", offsets: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv, say) {
        return function (v) { S.C[key] = conv(v); restartNight(api, say(S.C[key])); };
      }
      S.ctl.night = api.control.select("night", "Night", NIGHTS.map(function (x) { return { value: x.value, label: x.label }; }), "spring",
        opt("night", String, function (v) { return "Night: " + pick(NIGHTS, v).label + "."; }));
      S.ctl.base = api.control.select("base", "Departures base image", BASES, "slim",
        opt("base", String, function (v) { return "Image rebuilt: " + pick(BASES, v).label + "."; }));
      S.ctl.tz = api.control.select("tz", "TZ environment variable", TZS, "none",
        opt("tz", String, function (v) { return "Environment variables: " + pick(TZS, v).label + "."; }));
      S.ctl.host = api.control.select("host", "Host's time zone", HOSTS, "utc",
        opt("host", String, function (v) { return "Host time zone: " + pick(HOSTS, v).label + ". The container keeps reading its own image's files."; }));
      S.ctl.where = api.control.select("where", "Departures runs on", WHERE, "container",
        opt("where", String, function (v) { return "Departures runs on: " + pick(WHERE, v).label + "."; }));
      S.ctl.offsets = api.control.toggle("offsets", "Every time carries its offset from UTC", false,
        opt("offsets", function (v) { return !!v; }, function (v) { return "Offsets on every time: " + (v ? "on" : "off") + "."; }));
      S.ctl.next = api.control.button("next", "Next event", function () { next(api); });
      S.ctl.all = api.control.button("all", "Run the night", function () { runAll(api); });
      S.ctl.restart = api.control.button("restart", "Restart the departures container", function () {
        var R = S.R;
        R.restarts += 1;
        var at = hm(START + nowMin(R));
        if (S.C.where === "old") {
          api.log(at + " Departures restarted on the old gate server. It still writes " + zoneText(S.C) + ".", "");
        } else {
          api.log(at + " Departures container restarted from the same image, with the same files. It still writes " + zoneText(S.C) + ".", "warn");
        }
        draw(api);
      });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restartNight(api, "Night replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now, UK time", ""),
        out: api.stat("out", "boxes gone out", ""),
        zone: api.stat("zone", "departures writes", "warn"),
        offset: api.stat("offset", "UK time tonight", ""),
        real: api.stat("real", "real minutes in the yard", ""),
        billed: api.stat("billed", "minutes billed", "warn"),
        short: api.stat("short", "minutes billed short", "bad"),
        neg: api.stat("neg", "bills below zero", "bad"),
        story: api.stat("story", "QZRU 2051144 billed, minutes", "bad")
      };
      api.info("<strong>How to read it.</strong> The boxes show what departures runs in: the host machine, the container on it, and the image the container was started from. The table lists tonight's ten boxes: the real times by the yard's wall clock (UK time), the gate log's arrival, the departures log's departure, and what billing charged. Billing subtracts the two logged times; with offsets on, it turns both into UTC first.");
      S.R = newNight(S.C);
      restartNight(api, "");
    },

    selfTest: async function (t) {
      function since(mark) { return t.logText().slice(mark); }

      // 1. Opens at 20:00 on Monday 30 March, before the first box arrives.
      t.expect(t.stat("now") === "Mon 30 Mar, 20:00" && t.stat("out") === "0 of 10" && t.stat("zone") === "UTC" &&
        t.stat("offset") === "UTC + 1" && t.stat("real") === 0 && t.stat("billed") === 0 && t.stat("story") === "not yet" &&
        t.logText().indexOf("Mon 30 Mar 2026, 20:00. The gate opens; 10 boxes tonight.") >= 0,
        "Opens at 20:00 on Mon 30 Mar, UK time UTC + 1, departures writing UTC, nothing billed yet");

      // 2. The record: ten events in, QZRU 2051144 leaves at 23:50, logged 22:50, billed -30.
      for (var i = 0; i < 10; i++) t.click("next");
      t.expect(t.logText().indexOf("23:50 QZRU 2051144 OUT. Departures log 2026-03-30 22:50 (UTC), gate log IN 2026-03-30 23:20. Billed -30 minutes; real stay 30 minutes.") >= 0 &&
        t.stat("story") === -30 && t.stat("neg") === 1 && t.stat("out") === "4 of 10" && t.stat("real") === 410 && t.stat("billed") === 170,
        "23:50: QZRU 2051144 logged out at 22:50 after IN at 23:20, billed -30 minutes");

      // 3. The whole night: 1,290 real, 690 billed, 600 short.
      t.click("all");
      t.expect(t.stat("now") === "Tue 31 Mar, 06:00" && t.stat("real") === "1,290" && t.stat("billed") === 690 &&
        t.stat("short") === 600 && t.stat("neg") === 1 &&
        t.logText().indexOf("06:00, gate shut. 10 boxes out; real 1,290 minutes, billed 690, 600 short; 1 bill below zero.") >= 0,
        "Night of 30 March: 1,290 real minutes billed as 690, 600 short, one bill below zero");

      // 4. Before tonight: 16 March, a winter night, every bill right.
      t.set("night", "winter");
      t.click("all");
      t.expect(t.stat("billed") === "1,290" && t.stat("short") === 0 && t.stat("neg") === 0 && t.stat("story") === 30 &&
        t.stat("offset") === "UTC + 0" && t.stat("zone") === "UTC",
        "16 March: UTC and UK time read the same, billed 1,290, nothing short");

      // 5. Option 0: the host's time zone set to UK time changes nothing.
      t.set("night", "spring");
      t.set("host", "uk");
      t.click("all");
      t.expect(t.stat("billed") === 690 && t.stat("story") === -30 && t.stat("zone") === "UTC" &&
        t.logText().indexOf("Host time zone: UK time. The container keeps reading its own image's files.") >= 0,
        "Host set to UK time: the container still writes UTC, 690 billed, -30");

      // 6. Option 2: restart the container mid-night.
      t.set("host", "utc");
      for (var j = 0; j < 9; j++) t.click("next");
      t.click("restart");
      var mark = t.logText().length;
      var restarted = t.logText().indexOf("23:35 Departures container restarted from the same image, with the same files. It still writes UTC.") >= 0;
      t.click("next");
      t.click("all");
      t.expect(restarted && t.stat("billed") === 690 && t.stat("story") === -30 && since(0).indexOf("Billed -30 minutes") >= 0 && mark > 0,
        "Restart at 23:35: same image, still UTC, QZRU 2051144 still -30 and the night still 690");

      // 7. Option 1: offsets on, right on both nights.
      t.set("offsets", true);
      for (var k = 0; k < 10; k++) t.click("next");
      var line = t.logText().indexOf("23:50 QZRU 2051144 OUT. Departures log 2026-03-30 22:50+00:00 (UTC), gate log IN 2026-03-30 23:20+01:00. Billed 30 minutes; real stay 30 minutes.") >= 0;
      t.click("all");
      var spring = t.stat("billed") === "1,290" && t.stat("short") === 0;
      t.set("night", "winter");
      t.click("all");
      t.expect(line && spring && t.stat("billed") === "1,290" && t.stat("neg") === 0,
        "Offsets on: QZRU 2051144 bills 30, both nights bill 1,290");

      // 8. Option 3: departures back on the old gate server.
      t.set("offsets", false);
      t.set("night", "spring");
      t.set("where", "old");
      t.click("all");
      t.expect(t.stat("zone") === "UK time" && t.stat("billed") === "1,290" && t.stat("story") === 30,
        "Old gate server: both programs on UK time, 1,290 billed tonight");

      // 9. TZ on the slim image: still UTC. TZ plus the time-zone data layer: UK time.
      t.set("where", "container");
      t.set("tz", "london");
      t.click("all");
      var slimTz = t.stat("zone") === "UTC" && t.stat("billed") === 690;
      t.set("base", "tzdata");
      t.click("all");
      t.expect(slimTz && t.stat("zone") === "UK time" && t.stat("billed") === "1,290",
        "TZ=Europe/London: UTC on the slim image (690), UK time once the image holds time-zone data (1,290)");

      // 10. The time-zone data layer without TZ: nothing names the zone, still UTC.
      t.set("tz", "none");
      t.click("all");
      t.expect(t.stat("zone") === "UTC" && t.stat("billed") === 690 && t.stat("neg") === 1,
        "Time-zone data but no TZ: departures still writes UTC, 690 billed");
    }
  });
})();
