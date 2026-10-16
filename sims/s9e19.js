/* sims/s9e19-v1.0.0.js  (published as sims/s9e19.js)
   Case s9e19 "Field Report: Filling the Boxes at Night": a fill lab for one café of the Duskcade
   chain, Duskcade Thornaby, over two days from Friday 16 October 2026, 00:00, in 10-minute steps.
   The chain's central system lists a file for the café's cache server at 00:00 on Friday; the cache
   downloads it in its fill window (fill ahead) or the first time a player asks (fetch on first
   request). The learner picks the fill window, the speed cap, the file, the line speed, fill ahead
   or fetch on first request, and fill everything, then steps or plays the two days and reads the
   line graph, the fill's progress, the worst ping, when the fill is done, how long it spent
   filling, the minutes of 900 ms ping in and out of peak, and the first player's wait.
   Widget-style sim: it draws its own line graph inside api.root. Button-driven (api.speed = 0),
   so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls fill window (02:00 to 06:00, 08:00 to 12:00), speed
     cap (full line, 40 Mbps), file (60 GB, 5 GB, 2 GB, 90 GB), line (100, 500 Mbps), fill ahead or
     fetch on first request, fill everything; step 10 minutes, step 1 hour, play the two days,
     reset. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e19-v1.0.0.json).
   All of it is given data stated in sim.lede; each result is checked by the selfTest.
   - 1 GB = 8,000 megabits (Mb). A fill at full line moves data at the line's speed; with the cap
     at 40 Mbps it moves at 40 Mbps. The matches' own traffic is too small to change any sum here.
   - The provider runs each line 2% above its sold speed to carry the label on every piece of data,
     and the graph divides data by that: a full 100 Mbps line reads 100 / 102 = 98.04%, shown 98%.
     40 Mbps reads 39.2%, shown 39%. Each graph bar is one 10-minute step's average.
   - Ping: 20 ms at rest. While a fill takes the full line, the router's waiting room stays full and
     holds 880 ms of the line (the 500 Mbps line's new router is set the same way), so every match
     message waits 880 ms more: 900 ms. A capped fill leaves the waiting room empty: 20 ms.
   - The file is listed at Friday 00:00. Fill ahead: the cache downloads in its window each day,
     the release first, then any extra; what is left at the window's end waits for the next day's
     window. Fetch on first request: no fill; the first player to want it asks at 00:00 on
     Saturday (the unlock), and the cache fetches it then, at the same speed rules.
   - Peak is 00:00 to 04:00 each day; Thornaby's quiet hours are 08:00 to 12:00.
   - As built (02:00 window, full line, 60 GB, 100 Mbps): 480,000 Mb / 100 = 4,800 s = 80 min,
     02:00 to 03:20. At 02:30: 22.5 GB (7.5 GB per 10 minutes), line 98%, ping 900 ms. 80 min of
     900 ms in peak. Ready long before the unlock: the first player waits for nothing.
   - Patches: 5 GB = 40,000 Mb / 100 = 400 s = 6 min 40 s; 2 GB = 160 s = 2 min 40 s.
   - The fix (08:00 window, 40 Mbps): 480,000 / 40 = 12,000 s = 3 h 20 min, 08:00 to 11:20, line
     39%, ping 20 ms, 0 min of 900 ms. A 4-hour window at 40 Mbps holds 14,400 x 40 / 8,000 = 72 GB.
   - Option 0 (500 Mbps): 480,000 / 500 = 960 s = 16 min, 02:00 to 02:16, 16 min of 900 ms in peak.
     A 5 GB patch: 80 s.
   - Option 1 (fill everything): every other game's updates add 15 GB tonight (given). 75 GB at
     100 Mbps = 6,000 s = 100 min, 02:00 to 03:40. A 5 GB patch night becomes 20 GB = 26 min 40 s.
     With the fix: 72 GB on Friday 08:00 to 12:00, the last 3 GB Saturday 08:00 to 08:10
     (24,000 Mb / 40 = 600 s); 4 h 10 min of filling.
   - Option 3 (fetch on first request): Friday stays quiet; Saturday 00:00 to 01:20 the cache
     fetches 60 GB at full line: the first player waits 80 min, 80 min of 900 ms in peak.
   - Window only (08:00, full line): 08:00 to 09:20, 0 min in peak, 80 min outside it.
     Cap only (02:00, 40 Mbps): 02:00 to 05:20, ping 20 ms throughout.
   - 90 GB (the cold case): as built 720,000 / 100 = 7,200 s, 02:00 to 04:00, ready. With the fix,
     72 GB on Friday, 18 GB Saturday 08:00 to 09:00 (144,000 / 40 = 3,600 s): at the 00:00 unlock
     the cache holds 72 of 90 GB and the first player waits until 09:00: 9 h.

   Drawing: viewBox 660 x 210. Bars from x 40, 2 px per 10-minute step (288 steps = 576 px), up to
   120 px tall at 100%. Peak bands shaded. Every text sits inside the viewBox.
*/
(function () {
  "use strict";

  var DAY = 86400;
  var STEP = 600;
  var STEPS = 288;
  var END = 2 * DAY;
  var PEAK = 14400;           // 00:00 to 04:00
  var UNLOCK = DAY;           // Saturday 00:00
  var MB_PER_GB = 8000;
  var EXTRA_GB = 15;          // fill everything: every other game's updates tonight
  var BASE_MS = 20;
  var QUEUE_MS = 880;

  var WINDOW_OPTS = [
    { value: "0200", label: "02:00 to 06:00 (as built, all 20 cafés)", start: 7200 },
    { value: "0800", label: "08:00 to 12:00 (Thornaby's quiet hours)", start: 28800 }
  ];
  var CAP_OPTS = [
    { value: "full", label: "full line (as built)" },
    { value: "40", label: "40 Mbps" }
  ];
  var FILE_OPTS = [
    { value: "60", label: "60 GB release: Gravewake (last night)" },
    { value: "5", label: "5 GB patch (a usual night)" },
    { value: "2", label: "2 GB patch (a small night)" },
    { value: "90", label: "90 GB release" }
  ];
  var LINE_OPTS = [
    { value: "100", label: "100 Mbps (as built)" },
    { value: "500", label: "500 Mbps" }
  ];
  var MODE_OPTS = [
    { value: "ahead", label: "fill ahead, in the window (as built)" },
    { value: "first", label: "fetch on first request" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(s) {
    var d = Math.floor(s / DAY);
    var r = s - d * DAY;
    var names = ["Friday", "Saturday", "Sunday"];
    return names[d] + " " + two(Math.floor(r / 3600)) + ":" + two(Math.floor((r % 3600) / 60));
  }
  // Durations: under 2 hours in minutes (and seconds); from 2 hours in hours and minutes.
  function dur(s) {
    s = Math.round(s);
    if (s < 7200) {
      var m = Math.floor(s / 60);
      var r = s % 60;
      if (m === 0 && r > 0) return r + " s";
      return m + " min" + (r ? " " + r + " s" : "");
    }
    var h = Math.floor(s / 3600);
    var mm = Math.round((s % 3600) / 60);
    return h + " h" + (mm ? " " + mm + " min" : "");
  }
  function gb(x) {
    var v = Math.round(x * 10) / 10;
    return String(v);
  }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  /* ---------- the model: exact fill intervals over the two days ---------- */

  function plan(C) {
    var line = Number(C.line);
    var rate = C.cap === "40" ? Math.min(40, line) : line;
    var full = rate >= line;
    var releaseMb = Number(C.file) * MB_PER_GB;
    var totalMb = releaseMb + (C.mode === "ahead" && C.everything ? EXTRA_GB * MB_PER_GB : 0);
    var iv = [];
    var ready = null;
    if (C.mode === "first") {
      var t = releaseMb / rate;
      iv.push({ a: UNLOCK, b: UNLOCK + t, rate: rate });
      ready = UNLOCK + t;
    } else {
      var ws = pick(WINDOW_OPTS, C.window).start;
      var left = totalMb;
      var done = 0;
      for (var d = 0; d < 2 && left > 0; d++) {
        var a = d * DAY + ws;
        var b = a + 14400;
        var need = left / rate;
        var e = Math.min(b, a + need);
        iv.push({ a: a, b: e, rate: rate });
        if (ready === null && done + (e - a) * rate >= releaseMb) ready = a + (releaseMb - done) / rate;
        done += (e - a) * rate;
        left -= (e - a) * rate;
      }
    }
    var moved = 0;
    var filling = 0;
    var peakLag = 0;
    var otherLag = 0;
    iv.forEach(function (v) {
      moved += (v.b - v.a) * v.rate;
      filling += v.b - v.a;
      if (full) {
        var p = overlap(v.a, v.b, 0, PEAK) + overlap(v.a, v.b, DAY, DAY + PEAK);
        peakLag += p;
        otherLag += (v.b - v.a) - p;
      }
    });
    var finish = moved >= totalMb - 1e-6 && iv.length ? iv[iv.length - 1].b : null;
    var wait = ready === null ? null : Math.max(0, ready - UNLOCK);
    return {
      line: line, rate: rate, full: full, iv: iv, totalGB: totalMb / MB_PER_GB, releaseMb: releaseMb,
      finish: finish, filling: filling, peakLag: peakLag, otherLag: otherLag, ready: ready, wait: wait
    };
  }

  function movedBy(P, T) {
    var mb = 0;
    P.iv.forEach(function (v) { mb += overlap(v.a, v.b, 0, T) * v.rate; });
    return mb / MB_PER_GB;
  }
  // One 10-minute step's graph reading and worst ping.
  function stepOf(P, k) {
    var t0 = k * STEP;
    var t1 = t0 + STEP;
    var mb = 0;
    var busy = false;
    P.iv.forEach(function (v) {
      var o = overlap(v.a, v.b, t0, t1);
      mb += o * v.rate;
      if (o > 0 && P.full) busy = true;
    });
    var use = mb / STEP / (P.line * 1.02) * 100;
    return { use: Math.round(use), ping: busy ? BASE_MS + QUEUE_MS : BASE_MS };
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, text, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 210", width: "100%", "class": "dg", role: "img",
      "aria-label": "The café line graph over two days, one bar per 10 minutes. Bar height is the share of the line in use. Red bars are steps when the ping read 900 ms, green bars steps when a fill ran and the ping stayed at 20 ms. The shaded bands are the peak hours, midnight to 04:00."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer };
  }

  function drawGraph(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    var P = S.P;
    clear(g);
    var X0 = 40;
    var BASE = 160;
    var H = 120;
    [0, 1].forEach(function (d) {
      var px = X0 + d * 288;
      var band = mk(doc, "g", { "class": "dg-node st-muted" }, g);
      mk(doc, "rect", { x: px, y: BASE - H, width: 48, height: H, opacity: 0.25 }, band);
    });
    mk(doc, "path", { d: "M" + X0 + " " + BASE + "H" + (X0 + 576) + "M" + X0 + " " + (BASE - H) + "H" + (X0 + 576), "class": "dg-axis", fill: "none" }, g);
    txt(doc, g, X0 - 4, BASE - H + 4, "100%", "dg-axis", "end");
    txt(doc, g, X0 - 4, BASE + 4, "0%", "dg-axis", "end");
    var shown = Math.min(S.k, STEPS);
    for (var k = 0; k < shown; k++) {
      var st = stepOf(P, k);
      if (st.use <= 0) continue;
      var h = Math.max(1, Math.round(st.use * H / 100));
      var gg = mk(doc, "g", { "class": "dg-node st-" + (st.ping > BASE_MS ? "bad" : "ok") }, g);
      mk(doc, "rect", { x: X0 + 2 * k, y: BASE - h, width: 2, height: h }, gg);
    }
    var cx = X0 + 2 * shown;
    mk(doc, "path", { d: "M" + cx + " " + (BASE - H - 6) + "V" + (BASE + 4), "class": "dg-axis", fill: "none" }, g);
    txt(doc, g, X0, BASE + 18, "Friday 00:00", "dg-axis", "start");
    txt(doc, g, X0 + 288, BASE + 18, "Saturday 00:00", "dg-axis", "middle");
    txt(doc, g, X0 + 576, BASE + 18, "Sunday", "dg-axis", "end");
    txt(doc, g, X0, BASE + 36, "shaded: peak, 00:00 to 04:00. red: ping 900 ms. green: ping 20 ms.", "dg-note", "start");
    txt(doc, g, X0, 26, "line used, each 10 minutes", "dg-note", "start");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var P = S.P;
    var T = S.k * STEP;
    S.ui.head.textContent = when(T) + ". " + pick(FILE_OPTS, C.file).label + ". " +
      (C.mode === "first" ? "Fetch on first request, at " + (C.cap === "40" ? "40 Mbps" : "full line") + "." :
        "Fill window " + pick(WINDOW_OPTS, C.window).label + ", " + (C.cap === "40" ? "capped at 40 Mbps" : "at full line") + ".") +
      " Line " + C.line + " Mbps." + (C.everything && C.mode === "ahead" ? " Fill everything: 15 GB more." : "");
    drawGraph(S);
    var st = S.k > 0 ? stepOf(P, S.k - 1) : { use: 0, ping: BASE_MS };
    S.stat.clock(when(T));
    S.stat.line(st.use + "%");
    S.stat.ping(st.ping + " ms");
    S.stat.progress(gb(movedBy(P, T)) + " of " + gb(P.totalGB) + " GB");
    var ended = T >= END;
    S.stat.finish(P.finish !== null && P.finish <= T ? when(P.finish) : (ended ? "not done" : "not yet"));
    S.stat.filling(dur(Math.min(P.filling, filledBy(P, T))));
    S.stat.peaklag(dur(lagBy(P, T, true)));
    S.stat.otherlag(dur(lagBy(P, T, false)));
    S.stat.wait(T < UNLOCK ? "-" : (P.wait === null ? "not on the cache" : (P.wait === 0 ? "none: on the cache" : dur(P.wait))));
  }

  function filledBy(P, T) {
    var s = 0;
    P.iv.forEach(function (v) { s += overlap(v.a, v.b, 0, T); });
    return s;
  }
  function lagBy(P, T, peak) {
    if (!P.full) return 0;
    var p = 0;
    var all = 0;
    P.iv.forEach(function (v) {
      all += overlap(v.a, v.b, 0, T);
      p += overlap(v.a, v.b, 0, Math.min(T, PEAK)) + overlap(v.a, v.b, DAY, Math.min(T, DAY + PEAK));
    });
    return peak ? p : all - p;
  }

  // Log what happened between from and to (seconds), in order.
  function logBetween(api, from, to) {
    var P = api.state.P;
    var ev = [];
    P.iv.forEach(function (v, i) {
      if (v.a >= from && v.a < to) {
        var first = api.state.C.mode === "first";
        ev.push({ t: v.a, tone: P.full ? "bad" : "ok", s: when(v.a) + ": " + (first ?
          "the first player asks; the cache hasn't got it and fetches " + gb(P.releaseMb / MB_PER_GB) + " GB" :
          (i === 0 ? "the fill starts: " : "the fill goes on: ") + gb(P.totalGB - movedBy(P, v.a)) + " GB to go") +
          " at " + v.rate + " Mbps. Ping " + (P.full ? "20 ms to 900 ms." : "stays 20 ms.") });
      }
      if (v.b > from && v.b <= to) {
        var last = i === P.iv.length - 1 && P.finish !== null;
        ev.push({ t: v.b, tone: last ? "ok" : "warn", s: when(v.b) + ": " + (last ? "done: " + gb(movedBy(P, v.b)) + " of " + gb(P.totalGB) +
          " GB. Ping back to 20 ms." : "the window ends with " + gb(movedBy(P, v.b)) + " of " + gb(P.totalGB) + " GB; the rest waits for tomorrow's window.") });
      }
    });
    if (UNLOCK >= from && UNLOCK < to && api.state.C.mode === "ahead") {
      ev.push({ t: UNLOCK, tone: P.wait ? "bad" : "ok", s: when(UNLOCK) + ": the release unlocks. " +
        (P.wait ? "The cache holds " + gb(movedBy(P, UNLOCK)) + " GB of it; the first player waits " + dur(P.wait) + "." : "It is on the cache; the first player installs it from the back room.") });
    }
    ev.sort(function (a, b) { return a.t - b.t; });
    ev.forEach(function (e) { api.log(e.s, e.tone); });
  }

  function advance(api, steps) {
    var S = api.state;
    if (S.k >= STEPS) { api.log("Sunday 00:00: the two days are over. Change a setting or reset.", ""); return; }
    var to = Math.min(STEPS, S.k + steps);
    logBetween(api, S.k * STEP, to * STEP);
    S.k = to;
    if (S.k >= STEPS) {
      var P = S.P;
      api.log("Two days: filling " + dur(P.filling) + ", done " + (P.finish !== null ? when(P.finish) : "not done") +
        ". Ping at 900 ms: " + dur(P.peakLag) + " in peak, " + dur(P.otherLag) + " outside it.", P.peakLag > 0 ? "bad" : "ok");
    }
    draw(api);
  }

  function change(api, what) {
    var S = api.state;
    S.k = 0;
    S.P = plan(S.C);
    S.P.mode = S.C.mode;
    api.log(what + " Back to Friday 00:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e19", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { window: "0200", cap: "full", file: "60", line: "100", mode: "ahead", everything: false };
      S.k = 0;
      S.P = plan(S.C);
      S.P.mode = S.C.mode;
      S.ui = buildWidget(api);

      function sel(id, label, list) {
        api.control.select(id, label, list, S.C[id], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[id] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("window", "fill window", WINDOW_OPTS);
      sel("cap", "speed cap", CAP_OPTS);
      sel("file", "file", FILE_OPTS);
      sel("line", "line speed", LINE_OPTS);
      sel("mode", "how the cache gets it", MODE_OPTS);
      api.control.toggle("everything", "fill everything: every game's updates, 15 GB more", false, function (on) {
        S.C.everything = !!on;
        change(api, on ? "Fill everything on: every other game's updates join the fill, 15 GB more." : "Fill everything off.");
      });
      api.control.button("step", "step 10 minutes", function () { advance(api, 1); });
      api.control.button("hour", "step 1 hour", function () { advance(api, 6); });
      api.control.button("play", "play the two days", function () { advance(api, STEPS); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        clock: api.stat("clock", "clock", ""),
        line: api.stat("line", "line used, last 10 minutes", ""),
        ping: api.stat("ping", "worst ping, last 10 minutes", "bad"),
        progress: api.stat("progress", "fill progress", ""),
        finish: api.stat("finish", "fill done at", "ok"),
        filling: api.stat("filling", "time spent filling", ""),
        peaklag: api.stat("peaklag", "ping at 900 ms in peak", "bad"),
        otherlag: api.stat("otherlag", "ping at 900 ms outside peak", "warn"),
        wait: api.stat("wait", "first player's wait at the Saturday 00:00 unlock", "warn")
      };

      api.info("<strong>How to read it.</strong> A fill goes in four steps: the central system predicts what the café will want, sends the cache its list, the cache asks in its fill window for what it lacks, and downloads it at the speed the cap allows. Fetch on first request goes in three: a player asks, the cache fetches what it hasn't got, then hands it over and keeps a copy. Each bar is 10 minutes of the café's line. While a fill takes the full line, the router's waiting room fills and every match message waits 880 ms more.");

      api.log("Friday 00:00: the league final is on, 40 seats, ping 20 ms. The central system lists the file for the cache.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var BUILT = { window: "0200", cap: "full", file: "60", line: "100", mode: "ahead", everything: false };
      function fresh(set) {
        Object.keys(BUILT).forEach(function (k) { t.set(k, BUILT[k]); });
        Object.keys(set || {}).forEach(function (k) { t.set(k, set[k]); });
      }
      function steps(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: Friday 00:00, nothing filled, ping 20 ms.
      t.expect(t.stat("clock") === "Friday 00:00" && t.stat("line") === "0%" && t.stat("ping") === "20 ms" &&
        t.stat("progress") === "0 of 60 GB" && t.stat("finish") === "not yet" && t.stat("wait") === "-" &&
        has("Friday 00:00: the league final is on, 40 seats, ping 20 ms."),
        "Opens at Friday 00:00: league final on, ping 20 ms, 0 of 60 GB");

      // 2. As built, to 02:30: line 98%, ping 900 ms, 22.5 of 60 GB.
      steps(15);
      t.expect(t.stat("clock") === "Friday 02:30" && t.stat("line") === "98%" && t.stat("ping") === "900 ms" &&
        t.stat("progress") === "22.5 of 60 GB" && has("Friday 02:00: the fill starts: 60 GB to go at 100 Mbps. Ping 20 ms to 900 ms."),
        "As built at 02:30: the line reads 98%, ping 900 ms, 22.5 of 60 GB");

      // 3. As built, the two days: done 03:20 after 80 min, all of it in peak.
      t.click("play");
      t.expect(t.stat("finish") === "Friday 03:20" && t.stat("filling") === "80 min" && t.stat("peaklag") === "80 min" &&
        t.stat("otherlag") === "0 min" && t.stat("wait") === "none: on the cache",
        "As built: 60 GB from 02:00 to 03:20, 80 min of 900 ms ping in peak");

      // 4. A usual night: patches finish in minutes.
      fresh({ file: "5" });
      t.click("play");
      var p5 = t.stat("filling") === "6 min 40 s" && t.stat("peaklag") === "6 min 40 s";
      fresh({ file: "2" });
      t.click("play");
      t.expect(p5 && t.stat("filling") === "2 min 40 s" && t.stat("finish") === "Friday 02:02",
        "Patches: 5 GB takes 6 min 40 s, 2 GB 2 min 40 s");

      // 5. The fix: 08:00 to 12:00, capped at 40 Mbps.
      fresh({ window: "0800", cap: "40" });
      steps(51);
      var at830 = t.stat("clock") === "Friday 08:30" && t.stat("line") === "39%" && t.stat("ping") === "20 ms";
      t.click("play");
      t.expect(at830 && t.stat("finish") === "Friday 11:20" && t.stat("filling") === "3 h 20 min" &&
        t.stat("peaklag") === "0 min" && t.stat("otherlag") === "0 min" && t.stat("wait") === "none: on the cache",
        "The fix: 08:00 to 11:20 at 40 Mbps, line 39%, ping 20 ms, no lag");

      // 6. Option 0: a 500 Mbps line ends the fill in 16 minutes, all at 900 ms.
      fresh({ line: "500" });
      steps(13);
      var l500 = t.stat("line") === "98%" && t.stat("ping") === "900 ms";
      t.click("play");
      var a6 = l500 && t.stat("filling") === "16 min" && t.stat("peaklag") === "16 min" && t.stat("finish") === "Friday 02:16";
      fresh({ line: "500", file: "5" });
      t.click("play");
      t.expect(a6 && t.stat("filling") === "1 min 20 s", "500 Mbps: 16 minutes of 900 ms ping in peak; a 5 GB patch 1 min 20 s");

      // 7. Option 1: fill everything adds 15 GB: 100 min tonight, 26 min 40 s on a patch night.
      fresh({ everything: true });
      t.click("play");
      var a7 = t.stat("finish") === "Friday 03:40" && t.stat("filling") === "100 min" && t.stat("peaklag") === "100 min" &&
        t.stat("progress") === "75 of 75 GB";
      fresh({ everything: true, file: "5" });
      t.click("play");
      t.expect(a7 && t.stat("filling") === "26 min 40 s", "Fill everything: 75 GB, 100 min at 900 ms; a patch night 26 min 40 s");

      // 8. Option 3 (warn): fetch on first request. Friday quiet; the first player waits 80 min at peak.
      fresh({ mode: "first" });
      steps(15);
      var quiet = t.stat("line") === "0%" && t.stat("ping") === "20 ms";
      t.click("play");
      t.expect(quiet && t.stat("wait") === "80 min" && t.stat("peaklag") === "80 min" && t.stat("finish") === "Saturday 01:20" &&
        has("Saturday 00:00: the first player asks; the cache hasn't got it and fetches 60 GB at 100 Mbps. Ping 20 ms to 900 ms."),
        "Fetch on first request: no fill at 02:00 Friday; Saturday 00:00 to 01:20 at 900 ms, the first player waits 80 min");

      // 9. Window only, and cap only.
      fresh({ window: "0800" });
      t.click("play");
      var wOnly = t.stat("peaklag") === "0 min" && t.stat("otherlag") === "80 min" && t.stat("finish") === "Friday 09:20";
      fresh({ cap: "40" });
      t.click("play");
      t.expect(wOnly && t.stat("finish") === "Friday 05:20" && t.stat("peaklag") === "0 min",
        "Window only: 80 min of 900 ms in the morning; cap only: 02:00 to 05:20 with ping 20 ms");

      // 10. The fix with fill everything: 72 GB on Friday, the last 3 GB on Saturday morning.
      fresh({ window: "0800", cap: "40", everything: true });
      steps(72);
      var fri = t.stat("progress") === "72 of 75 GB" && has("Friday 12:00: the window ends with 72 of 75 GB");
      t.click("play");
      t.expect(fri && t.stat("finish") === "Saturday 08:10" && t.stat("filling") === "4 h 10 min" && t.stat("wait") === "none: on the cache",
        "Fix plus fill everything: 72 GB on Friday, 3 GB on Saturday 08:00 to 08:10");

      // 11. 90 GB with the fix: not ready at the unlock; the first player waits 9 h.
      fresh({ window: "0800", cap: "40", file: "90" });
      t.click("play");
      t.expect(t.stat("wait") === "9 h" && t.stat("finish") === "Saturday 09:00" &&
        has("The cache holds 72 GB of it; the first player waits 9 h."),
        "90 GB at 40 Mbps from 08:00: 72 GB by the unlock, the first player waits 9 h");

      // 12. 90 GB as built fits 02:00 to 04:00 at full line, all of it at 900 ms in peak.
      fresh({ file: "90" });
      t.click("play");
      t.expect(t.stat("finish") === "Friday 04:00" && t.stat("filling") === "2 h" && t.stat("peaklag") === "2 h",
        "90 GB as built: 02:00 to 04:00, 2 h of 900 ms ping in peak");
    }
  });
})();
