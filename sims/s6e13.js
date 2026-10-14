/* sims/s6e13-v1.0.0.js  (published as sims/s6e13.js)
   Case s6e13 "The Typo That Took Down the Internet": a restart lab for Calderline Power's 50 meter
   servers, mr-01 to mr-50, which carry the readings of 180,000 smart meters to the outage map. The
   learner picks the name pattern typed into the restart tool and the tool's guard rails (show the
   count before acting, a minimum of servers kept up, how many it restarts at a time, a dry run, a
   second approver, and the hour it runs), then runs the night minute by minute from 01:55 to 02:40
   and watches the servers, the silent meters and the homes the map shows dark.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: patterns mr-* (as typed), mr-0[1-3] (as meant), mr-[1-3]*
     (another slip); show the count on or off; minimum none, 30 or 40; at a time: all, 3 or 10; dry
     run; second approver; 02:00 or 12:00. Buttons: forward 1 minute, run to the 15-minute mark, run
     to the end, start again, reset. A strip of 50 servers and a chart of homes shown dark.
     selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - One step is one minute. The night opens at 01:55 with nothing run; each step moves the clock on
     one minute and runs that minute. Order inside a minute: servers due back come back (empty),
     silent meters move to servers with room, the restart tool acts (at 02:00 and later), then the
     map is checked.
   - 50 servers named mr-01 to mr-50. 180,000 meters, 3,600 on each server at 01:55. A server carries
     at most 6,000 meters, so 30 servers must be up to carry them all (the minimum in the post).
   - A restart stops a server for 20 minutes (it checks its stored readings, then starts). Its
     meters go silent; from the next minute they move to any up server with room, spread evenly.
     Meters with nowhere to go stay silent. When a server comes back it is empty and takes meters.
   - The map shows a home dark when its meter has been silent for 15 minutes or more.
   - The pattern: * means any characters (or none), [1-3] means one character, 1, 2 or 3. Names are
     matched whole. mr-* matches all 50; mr-0[1-3] matches mr-01, mr-02, mr-03; mr-[1-3]* matches
     mr-10 to mr-39, 30 servers.
   - The tool as built restarts every match at once and has no minimum. Guard rails: show the count
     (Ksawery meant 3; if the count is not 3 he types n and nothing runs); minimum (never leave fewer
     servers up); at a time (never more than that many down; the next ones go when those are back);
     dry run (prints what it would restart, restarts nothing); second approver (reads the typed
     line, which shows the pattern and not the count, and approves it).

   Where every number comes from (conventions rule 14; the case is content/s6/s6e13-v1.0.0.json).
   Worked out from the model above and checked by the selfTest:
   - As typed, mr-*: 50 of 50 match; all 50 down at 02:00, 180,000 meters silent with nowhere to go.
     02:14: 0 homes dark. 02:15: 180,000 homes dark (15 minutes). 02:20: all 50 back, every meter
     reconnects, 0 dark. Longest silence 20 minutes.
   - As meant, mr-0[1-3]: 3 of 50; 10,800 meters silent at 02:00, moved to the other 47 at 02:01
     (each under 6,000); 0 homes dark; longest silence 1 minute. Every restart before tonight.
   - mr-[1-3]*: 30 of 50 (mr-10 to mr-39); 108,000 meters silent; the 20 left up take 2,400 more each,
     48,000, at 02:01; 60,000 have nowhere to go: 60,000 homes dark at 02:15, until 02:20.
   - Minimum 30, all at once, mr-*: 20 restarted at 02:00 (mr-01 to mr-20), 30 held. 72,000 meters
     move to the 30 left, 2,400 each, filling every one to exactly 6,000; 0 dark. At 02:20 mr-21 to
     mr-40 go; at 02:40 mr-41 to mr-50.
   - Minimum 30 and 3 at a time, mr-*: mr-01 to mr-03 at 02:00, mr-04 to mr-06 at 02:20, mr-07 to
     mr-09 at 02:40; 0 dark, longest silence 1 minute.
   - Second approver, mr-*: approved; 180,000 dark at 02:15, as typed.
   - At 12:00: the same, an hour label later: 180,000 dark at 12:15.
   - Dry run: "would restart 50 of 50 servers (mr-01 to mr-50)"; nothing restarted, 0 dark.
   - Count shown: "50 of 50 servers match"; Ksawery meant 3 and types n; 0 dark.
*/
(function () {
  "use strict";

  var N = 50;
  var METERS = 180000;
  var CAP = 6000;
  var BACK = 20;      // minutes a restart takes
  var DARK = 15;      // minutes of silence before the map shows a home dark
  var RUN = 5;        // 02:00 (or 12:00), five minutes after the opening
  var MARK = 20;      // 02:15
  var END = 45;       // 02:40
  var MEANT = 3;

  var PATTERNS = [
    { value: "mr-*", label: "mr-* (as typed tonight)" },
    { value: "mr-0[1-3]", label: "mr-0[1-3] (as meant)" },
    { value: "mr-[1-3]*", label: "mr-[1-3]* (another slip)" }
  ];
  var MINS = [{ value: 0, label: "None (as built)" }, { value: 30, label: "30 up" }, { value: 40, label: "40 up" }];
  var BATCH = [{ value: 0, label: "All at once (as built)" }, { value: 3, label: "3 at a time" }, { value: 10, label: "10 at a time" }];
  var HOURS = [{ value: 1, label: "02:00 (tonight)" }, { value: 11, label: "12:00 (daytime)" }];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function name(i) { return "mr-" + two(i + 1); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function plural(n, one, many) { return fmt(n) + " " + (n === 1 ? one : many); }

  /* ---------- the model ---------- */

  function globRe(p) {
    var s = "^";
    for (var i = 0; i < p.length; i++) {
      var c = p.charAt(i);
      if (c === "*") s += ".*";
      else if (c === "[") { var j = p.indexOf("]", i); s += p.slice(i, j + 1); i = j; }
      else s += c.replace(/[.+?^${}()|\\]/g, "\\$&");
    }
    return new RegExp(s + "$");
  }
  function matches(p) {
    var re = globRe(p);
    var out = [];
    for (var i = 0; i < N; i++) if (re.test(name(i))) out.push(i);
    return out;
  }
  function span(list) { return list.length === 1 ? name(list[0]) : name(list[0]) + " to " + name(list[list.length - 1]); }

  function newNight(C) {
    var R = {
      C: C, m: 0, up: [], load: [], back: [], cohorts: [], pending: [], matched: matches(C.pattern),
      typed: false, dark: 0, maxDark: 0, longest: 0, printed: "nothing yet", series: [0], events: []
    };
    for (var i = 0; i < N; i++) { R.up.push(true); R.load.push(METERS / N); R.back.push(-1); }
    return R;
  }
  function clock(R, m) {
    var x = (R.C.hour * 60 + 55 + m);
    return two(Math.floor(x / 60) % 24) + ":" + two(x % 60);
  }
  function upCount(R) { var n = 0; for (var i = 0; i < N; i++) if (R.up[i]) n += 1; return n; }
  function silent(R) { var n = 0; R.cohorts.forEach(function (c) { n += c.n; }); return n; }
  function say(R, msg, tone) { R.events.push({ msg: clock(R, R.m) + " " + msg, tone: tone || "" }); }

  function placeMeters(R, c) {
    while (c.n > 0) {
      var room = [];
      for (var k = 0; k < N; k++) if (R.up[k] && R.load[k] < CAP) room.push(k);
      if (!room.length) break;
      var share = Math.ceil(c.n / room.length);
      for (var q = 0; q < room.length && c.n > 0; q++) {
        var g = Math.min(share, CAP - R.load[room[q]], c.n);
        R.load[room[q]] += g;
        c.n -= g;
      }
    }
  }

  function typeCommand(R) {
    var C = R.C;
    var M = R.matched.length;
    R.typed = true;
    if (C.approver) say(R, "Second engineer reads \"restart " + C.pattern + "\" and approves.", "");
    if (C.dry) {
      R.printed = "dry run: would restart " + M + " of " + N;
      say(R, "restart --dry-run " + C.pattern + ": Dry run: would restart " + M + " of " + N + " servers (" + span(R.matched) + "). Nothing restarted.", "ok");
      return;
    }
    if (C.count) {
      say(R, "restart " + C.pattern + ": " + M + " of " + N + " servers match. Go on? Type the number to confirm.", M === MEANT ? "" : "warn");
      if (M !== MEANT) {
        R.printed = M + " of " + N + " match; cancelled";
        say(R, "Ksawery meant " + MEANT + "; he types n. Nothing restarted.", "ok");
        return;
      }
    }
    R.pending = R.matched.slice();
  }

  function restartSome(R) {
    var C = R.C;
    var allow = R.pending.length;
    var down = N - upCount(R);
    if (C.batch) allow = Math.min(allow, C.batch - down);
    if (C.min) allow = Math.min(allow, upCount(R) - C.min);
    if (allow <= 0) return;
    var first = R.pending.length === R.matched.length;
    var take = R.pending.splice(0, allow);
    var n = 0;
    take.forEach(function (k) { n += R.load[k]; R.load[k] = 0; R.up[k] = false; R.back[k] = R.m + BACK; });
    R.cohorts.push({ n: n, since: R.m });
    var head = "restart " + C.pattern + ": ";
    if (!C.min && !C.batch) {
      var listed = take.length <= 3 ? take.map(name).join(" ") :
        take.slice(0, 3).map(name).join(" ") + " ... " + name(take[take.length - 1]);
      R.printed = "restarting " + listed + ": done";
      say(R, head + "restarting " + listed + ": done.", take.length > MEANT ? "bad" : "");
    } else {
      R.printed = "restarting " + take.length + " now; " + R.pending.length + " to go";
      say(R, (first ? head + R.matched.length + " of " + N + " match. " : "Next: ") +
        (C.min ? "Minimum " + C.min + " up. " : "") + (C.batch ? C.batch + " at a time. " : "") +
        "Restarting " + take.length + " now (" + span(take) + ")" +
        (R.pending.length ? ", holding " + R.pending.length + "." : "; none left."), "ok");
    }
    say(R, plural(n, "meter", "meters") + " silent; " + upCount(R) + " servers up.", "");
  }

  // Runs the next minute.
  function stepMinute(R) {
    var C = R.C;
    R.m += 1;
    var m = R.m;
    var i;
    var back = [];
    for (i = 0; i < N; i++) if (!R.up[i] && R.back[i] === m) { R.up[i] = true; R.load[i] = 0; back.push(i); }
    if (back.length) say(R, plural(back.length, "server", "servers") + " back (" + span(back) + ").", "ok");
    var moved = 0;
    R.cohorts.forEach(function (c) {
      if (c.since >= m) return;
      var before = c.n;
      placeMeters(R, c);
      moved += before - c.n;
      if (before > c.n) R.longest = Math.max(R.longest, m - c.since);
    });
    R.cohorts = R.cohorts.filter(function (c) { return c.n > 0; });
    if (moved) say(R, plural(moved, "meter", "meters") + " answer again through another server.", "ok");
    if (m === RUN) typeCommand(R);
    if (m >= RUN && R.pending.length) restartSome(R);
    var dark = 0;
    R.cohorts.forEach(function (c) { if (m - c.since >= DARK) dark += c.n; R.longest = Math.max(R.longest, m - c.since); });
    if (dark !== R.dark) {
      say(R, dark ? "Map: " + fmt(dark) + " homes shown dark (meters silent 15 minutes)." : "Map: every home shown with power again.", dark ? "bad" : "ok");
    }
    R.dark = dark;
    if (dark > R.maxDark) R.maxDark = dark;
    R.series.push(dark);
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
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
    var head = el("p", "margin:0;font-size:12px;");
    var strip = el("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:3px;font-size:10px;");
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 150", width: "100%", "class": "dg", role: "img",
      "aria-label": "Homes shown dark on the outage map, one point a minute from the opening to the end, with a dashed line at the 15-minute mark."
    });
    var g = mk(doc, "g", {}, svg);
    [head, strip, svg].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, strip: strip, g: g };
  }

  function drawStrip(S) {
    var ui = S.ui;
    var R = S.R;
    clear(ui.strip);
    for (var i = 0; i < N; i++) {
      var on = R.up[i];
      ui.strip.appendChild(ui.el("span",
        "border:1px solid currentColor;border-radius:3px;padding:1px 3px;" + (on ? "" : "opacity:0.45;text-decoration:line-through;"),
        name(i) + " " + (on ? fmt(R.load[i]) : "down")));
    }
  }

  function drawChart(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.g;
    var R = S.R;
    clear(g);
    var x0 = 60, x1 = 640, y0 = 120, y1 = 16;
    function X(m) { return x0 + (x1 - x0) * m / END; }
    function Y(v) { return y0 - (y0 - y1) * v / METERS; }
    mk(doc, "path", { d: "M" + x0 + " " + y0 + "H" + x1 + "M" + x0 + " " + y0 + "V" + y1, "class": "dg-axis", fill: "none" }, g);
    [0, 90000, 180000].forEach(function (v) {
      var t = mk(doc, "text", { x: x0 - 6, y: Y(v) + 4, "class": "dg-axis", "text-anchor": "end" }, g);
      t.textContent = fmt(v);
    });
    [0, RUN, MARK, RUN + BACK, END].forEach(function (m) {
      var t = mk(doc, "text", { x: X(m).toFixed(1), y: y0 + 16, "class": "dg-axis", "text-anchor": "middle" }, g);
      t.textContent = clock(R, m);
    });
    mk(doc, "path", { d: "M" + X(MARK).toFixed(1) + " " + y0 + "V" + y1, "class": "dg-axis", "stroke-dasharray": "3 3", fill: "none" }, g);
    var pts = R.series.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    if (pts.length > 1) mk(doc, "polyline", { points: pts.join(" "), "class": "dg-note", fill: "none", stroke: "currentColor", "stroke-width": 2 }, g);
    var lbl = mk(doc, "text", { x: x0 + 6, y: y1 + 2, "class": "dg-note" }, g);
    lbl.textContent = "homes shown dark";
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var C = S.C;
    S.ui.head.textContent = "Typed at " + clock(R, RUN) + ": restart " + (C.dry ? "--dry-run " : "") + C.pattern +
      ". Count shown: " + (C.count ? "yes" : "no") + ". Minimum: " + (C.min ? C.min + " up" : "none") +
      ". At a time: " + (C.batch ? C.batch : "all") + ". Second approver: " + (C.approver ? "yes" : "no") +
      ". A restart takes " + BACK + " minutes; a server carries at most " + fmt(CAP) + " meters.";
    drawStrip(S);
    drawChart(S);
    S.stat.now(clock(R, R.m));
    S.stat.matched(R.typed ? R.matched.length + " of " + N : "not typed yet");
    S.stat.up(upCount(R));
    S.stat.silent(fmt(silent(R)));
    S.stat.longest(R.longest);
    S.stat.dark(fmt(R.dark));
    S.stat.printed(R.printed);
    var done = R.m >= END;
    S.ctl.fwd.disable(done);
    S.ctl.mark.disable(R.m >= MARK);
    S.ctl.all.disable(done);
  }

  function flush(api) {
    var R = api.state.R;
    R.events.forEach(function (e) { api.log(e.msg, e.tone); });
    R.events = [];
  }

  function runTo(api, m) {
    var R = api.state.R;
    while (R.m < m && R.m < END) stepMinute(R);
    flush(api);
    draw(api);
  }

  function restartNight(api, why) {
    var S = api.state;
    S.R = newNight(S.C);
    api.log((why ? why + " " : "") + clock(S.R, 0) + " All 50 meter servers up, 3,600 meters on each; 180,000 meters answering. Restart due at " +
      clock(S.R, RUN) + ".", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e13", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { pattern: "mr-*", count: false, min: 0, batch: 0, dry: false, approver: false, hour: 1 };
      S.ui = buildWidget(api);
      S.ctl = {};
      function sel(key, list, label) {
        return function (v) { S.C[key] = pick(list, v).value; restartNight(api, label + ": " + pick(list, v).label + "."); };
      }
      function tog(key, label) {
        return function (on) { S.C[key] = !!on; restartNight(api, label + ": " + (on ? "on." : "off.")); };
      }
      S.ctl.pattern = api.control.select("pattern", "Pattern typed", PATTERNS, "mr-*", sel("pattern", PATTERNS, "Pattern"));
      S.ctl.count = api.control.toggle("count", "Show the count before acting", false, tog("count", "Show the count"));
      S.ctl.min = api.control.select("min", "Minimum servers kept up", MINS, 0, sel("min", MINS, "Minimum"));
      S.ctl.batch = api.control.select("batch", "Restart at a time", BATCH, 0, sel("batch", BATCH, "At a time"));
      S.ctl.dry = api.control.toggle("dry", "Dry run first", false, tog("dry", "Dry run"));
      S.ctl.approver = api.control.toggle("approver", "Second engineer approves", false, tog("approver", "Second approver"));
      S.ctl.hour = api.control.select("hour", "When the restart runs", HOURS, 1, sel("hour", HOURS, "Runs at"));
      S.ctl.fwd = api.control.button("fwd", "Forward 1 minute", function () { runTo(api, S.R.m + 1); });
      S.ctl.mark = api.control.button("mark", "Run to the 15-minute mark", function () { runTo(api, MARK); });
      S.ctl.all = api.control.button("all", "Run to the end (45 minutes)", function () { runTo(api, END); });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restartNight(api, "Night replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        matched: api.stat("matched", "servers the pattern matched", "warn"),
        up: api.stat("up", "servers up", "ok"),
        silent: api.stat("silent", "meters silent now", "warn"),
        longest: api.stat("longest", "longest silence, minutes", ""),
        dark: api.stat("dark", "homes shown dark on the map", "bad"),
        printed: api.stat("printed", "what the tool printed", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one minute. 50 servers carry 180,000 meters, 3,600 each, at most 6,000 each. A restart stops a server for 20 minutes; its meters move to servers with room a minute later, or stay silent. The map shows a home dark after 15 minutes of silence. The strip shows each server and its meters; the chart shows homes shown dark.");
      restartNight(api, "");
    },

    selfTest: async function (t) {
      function log(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 01:55, before the restart: 50 up, nothing silent, nothing dark.
      t.expect(t.stat("now") === "01:55" && t.stat("up") === 50 && t.stat("dark") === 0 && t.stat("silent") === 0 &&
        t.stat("matched") === "not typed yet" && log("01:55 All 50 meter servers up, 3,600 meters on each; 180,000 meters answering."),
        "Opens at 01:55: 50 servers up, 180,000 meters answering, nothing typed");

      // 2. As typed: 50 of 50 at 02:00; nothing on the map at 02:14; 180,000 dark at 02:15.
      for (var i = 0; i < 19; i++) t.click("fwd");
      var at14 = t.stat("now") === "02:14" && t.stat("dark") === 0 && t.stat("silent") === "180,000" && t.stat("up") === 0;
      t.click("fwd");
      t.expect(at14 && t.stat("now") === "02:15" && t.stat("dark") === "180,000" && t.stat("matched") === "50 of 50" &&
        log("02:00 restart mr-*: restarting mr-01 mr-02 mr-03 ... mr-50: done.") && log("02:15 Map: 180,000 homes shown dark"),
        "mr-* matches 50 of 50; 0 dark at 02:14, 180,000 homes dark at 02:15");

      // 3. 02:20: all 50 back, the map clears; silence lasted 20 minutes.
      t.click("all");
      t.expect(t.stat("up") === 50 && t.stat("dark") === 0 && t.stat("longest") === 20 &&
        log("02:20 50 servers back (mr-01 to mr-50).") && log("02:20 Map: every home shown with power again."),
        "At 02:20 the 50 servers are back and the map clears; longest silence 20 minutes");

      // 4. As meant: 3 of 50, meters move within a minute, nothing dark (every restart before tonight).
      t.set("pattern", "mr-0[1-3]");
      t.click("all");
      var R = t.api.state.R;
      t.expect(t.stat("matched") === "3 of 50" && R.maxDark === 0 && t.stat("longest") === 1 &&
        log("02:01 10,800 meters answer again through another server."),
        "mr-0[1-3] matches 3; 10,800 meters move at 02:01; 0 homes dark");

      // 5. Another slip: mr-[1-3]* takes 30; 20 servers can carry only 120,000.
      t.set("pattern", "mr-[1-3]*");
      t.click("mark");
      t.expect(t.stat("matched") === "30 of 50" && t.stat("dark") === "60,000" && t.stat("up") === 20,
        "mr-[1-3]* matches 30; 60,000 homes dark at 02:15");

      // 6. Option 1: a second approver reads the pattern, not the count, and approves.
      t.set("pattern", "mr-*");
      t.set("approver", true);
      t.click("mark");
      t.expect(t.stat("dark") === "180,000" && log("02:00 Second engineer reads \"restart mr-*\" and approves."),
        "Second approver: approves restart mr-*; 180,000 dark at 02:15");

      // 7. Option 2: daytime only. The same pattern at noon.
      t.set("approver", false);
      t.set("hour", 11);
      t.click("mark");
      t.expect(t.stat("now") === "12:15" && t.stat("dark") === "180,000",
        "At 12:00 the same mr-*: 180,000 homes dark at 12:15");
      t.set("hour", 1);

      // 8. Dry run: prints the count, restarts nothing.
      t.set("dry", true);
      t.click("all");
      R = t.api.state.R;
      t.expect(R.maxDark === 0 && t.stat("up") === 50 &&
        log("02:00 restart --dry-run mr-*: Dry run: would restart 50 of 50 servers (mr-01 to mr-50). Nothing restarted."),
        "Dry run: would restart 50 of 50, nothing restarted");
      t.set("dry", false);

      // 9. Count shown before acting: 50, not 3, so Ksawery cancels.
      t.set("count", true);
      t.click("all");
      R = t.api.state.R;
      t.expect(R.maxDark === 0 && log("02:00 restart mr-*: 50 of 50 servers match. Go on?") && log("Ksawery meant 3; he types n. Nothing restarted."),
        "Count shown: 50 of 50 match; he cancels; 0 dark");
      t.set("count", false);

      // 10. Minimum 30, all at once: 20 now, 30 held; the 30 left are full to 6,000 each.
      t.set("min", 30);
      t.click("fwd"); t.click("fwd"); t.click("fwd"); t.click("fwd"); t.click("fwd"); t.click("fwd");
      R = t.api.state.R;
      var full = true;
      for (i = 20; i < 50; i++) if (R.load[i] !== 6000) full = false;
      t.click("all");
      t.expect(full && t.api.state.R.maxDark === 0 &&
        log("02:00 restart mr-*: 50 of 50 match. Minimum 30 up. Restarting 20 now (mr-01 to mr-20), holding 30."),
        "Minimum 30: 20 restarted at 02:00, 30 held, the 30 up full at 6,000 each; 0 dark");

      // 11. Option 3: minimum 30 and 3 at a time.
      t.set("batch", 3);
      t.click("all");
      R = t.api.state.R;
      t.expect(R.maxDark === 0 && t.stat("longest") === 1 &&
        log("02:00 restart mr-*: 50 of 50 match. Minimum 30 up. 3 at a time. Restarting 3 now (mr-01 to mr-03), holding 47.") &&
        log("02:20 Next: Minimum 30 up. 3 at a time. Restarting 3 now (mr-04 to mr-06), holding 44."),
        "Minimum 30, 3 at a time: mr-01 to mr-03 at 02:00, mr-04 to mr-06 at 02:20; 0 dark, longest silence 1 minute");
    }
  });
})();
