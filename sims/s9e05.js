/* sims/s9e05-v1.0.0.js  (published as sims/s9e05.js)
   Case s9e05 "Write It Down": a plant-room lab for a town ice rink on the night of Wednesday
   14 October to Thursday 15 October 2026. Two compressors chill the ice. They sit in the plant
   room, a brick building behind the rink on its own electricity supply behind one main fuse. The
   controller in the rink office starts them by its schedule. This evening a contractor merged the
   two start times. The learner sets the start times as they stood before this evening, the
   evening's merge, a controller guard, a decision record (absent, present, or present with a
   change check) and the fuse rating, then plays 02:58:00 to 03:05:00 second by second and the ice
   to 04:30 in 10-minute steps. Widget-style sim: it draws inside api.root. Button-driven
   (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls start A, start B (before this evening), the
     evening's merge, controller guard (off, 60 seconds), decision record (absent, present, present
     with a change check), main fuse (200 amps, or 300 marked as the supplier's call); buttons Next
     step, Play to 03:05:00, Play to 04:30, Reset. Stats: time, amps this second, peak, main fuse,
     compressors, ice, schedule tonight, change check, its reason, ice alarm. selfTest: 10
     assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e05-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - The plant room (the post): main fuse 200 amps; lights and pumps draw 30 amps at night. A
     fuse blows once the draw has stayed above its rating for a full second: a draw over the rating
     in second t blows it at second t + 1, and from then the plant room draws 0.
   - A compressor start (the post): 120 amps for its first 5 seconds (seconds s to s + 4), then
     40 amps while it runs.
   - Tamsworth's schedule since January 2024 (the post): A at 03:00:00, B at 03:02:00. Peaks:
     120 + 30 = 150 at 03:00:00, then 40 + 120 + 30 = 190 at 03:02:00; after 03:02:05,
     40 + 40 + 30 = 110. The fuse holds.
   - Tonight's merge (the post's change log, Wed 14 Oct 19:06): B moved to 03:00:00. At 03:00:00
     the draw is 120 + 120 + 30 = 270, over 200, so the fuse blows at 03:00:01.
   - Other gaps (sim.lede): B at 03:00:03 draws 270 at 03:00:03 (A still starting) and blows the
     fuse at 03:00:04; B at 03:00:05 peaks at 190 (A already at 40) and holds; B at 03:01:00 peaks
     at 190 and holds. So any gap of 5 seconds or more holds; 2 minutes is Tamsworth's margin.
   - The rest (the post): both compressors rest from 01:00 to 03:00; the ice holds at -5.0 °C.
   - The ice (sim.lede, given data): with the fuse holding, the ice stays at -5.0 °C. With the
     fuse blown, it warms steadily by 4 °C in 90 minutes from 03:00: in tenths of a degree,
     -50 + round(40 x k / 9) at 03:00 + 10k minutes: -4.6, -4.1, -3.7, -3.2, -2.8, -2.3, -1.9,
     -1.4, -1.0 at 03:10 to 04:30. The alarm is set at -1 °C, so it texts the night phone at
     04:30 (-1.4 at 04:20 does not trigger it).
   - Guard (option 3): the controller refuses a schedule change with two starts within 60
     seconds, and gives no reason. The merge (0 seconds apart) is refused; Tamsworth's schedule
     stays.
   - Decision record DR-1 (option 2): "never start both compressors within 2 minutes", reason
     "120-amp starts, 200-amp fuse". Present but unchecked, the merge goes through. With the change
     check, a change with starts under 120 seconds apart is rejected with that reason.
   - Larger fuse (option 1): 300 amps, the supplier's call. The merge draws 270 at 03:00:00 and
     the fuse holds; the ice stays at -5.0 °C.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in seconds after midnight) ---------- */

  var T0 = 2 * 3600 + 58 * 60;   // 02:58:00
  var SECS = 421;                // 02:58:00 to 03:05:00, one step a second
  var ICE_STEPS = 9;             // 03:10 to 04:30, one step every 10 minutes
  var ICE_FROM = 3 * 3600;       // 03:00
  var NIGHT_LOAD = 30;           // lights and pumps at night
  var RUNNING = 40;              // a compressor running
  var STARTING = 120;            // a compressor's first 5 seconds
  var START_SECS = 5;
  var ICE_SET = -50;             // tenths of a degree
  var WARM = 40;                 // tenths of a degree in 90 minutes, fuse blown
  var ALARM_AT = -10;            // tenths: the alarm texts at -1.0 or warmer
  var GUARD_GAP = 60;
  var RECORD_GAP = 120;

  var A_TIMES = [{ value: "10800", label: "03:00:00" }, { value: "10860", label: "03:01:00" }];
  var B_TIMES = [
    { value: "10800", label: "03:00:00" },
    { value: "10803", label: "03:00:03" },
    { value: "10805", label: "03:00:05" },
    { value: "10860", label: "03:01:00" },
    { value: "10920", label: "03:02:00 (Tamsworth's)" }
  ];
  var GUARDS = [
    { value: "off", label: "off (as built)" },
    { value: "60", label: "refuse two starts within 60 seconds" }
  ];
  var RECORDS = [
    { value: "absent", label: "absent (as built)" },
    { value: "present", label: "DR-1 pinned beside the schedule" },
    { value: "check", label: "DR-1, and every change checked against it" }
  ];
  var FUSES = [
    { value: "200", label: "200 amps (as fitted)" },
    { value: "300", label: "300 amps (the supplier's call, not the rink's)" }
  ];
  var DR1 = "never start both within 2 minutes: 120-amp starts, 200-amp fuse";

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(t) { return two(Math.floor(t / 3600) % 24) + ":" + two(Math.floor(t / 60) % 60) + ":" + two(t % 60); }
  function hm(t) { return hms(t).slice(0, 5); }
  function deg(tenths) { return (tenths / 10).toFixed(1) + " °C"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // This evening's change and what the guard and the decision record make of it.
  function plan(C) {
    var a = Number(C.a);
    var b = Number(C.b);
    var P = { A: a, B: b, result: "no change tonight", reason: "-", merged: false, guard: false, rejected: false };
    if (!C.merge) return P;
    var gap = 0;   // the merge puts B at A's time
    P.guard = C.guard === "60" && gap < GUARD_GAP;
    P.rejected = C.record === "check" && gap < RECORD_GAP;
    if (P.guard && P.rejected) {
      P.result = "REFUSED by the guard, REJECTED by the change check";
      P.reason = DR1;
    } else if (P.guard) {
      P.result = "REFUSED by the controller guard";
      P.reason = "none given";
    } else if (P.rejected) {
      P.result = "REJECTED by the change check";
      P.reason = DR1;
    } else {
      P.merged = true;
      P.B = a;
      P.result = C.record === "present" ? "saved, not checked against DR-1" : "saved, nothing to check against";
    }
    return P;
  }

  function draw(s, t) {
    if (t < s) return 0;
    return t < s + START_SECS ? STARTING : RUNNING;
  }
  function phase(s, t) {
    if (t < s) return "";
    return t < s + START_SECS ? "starting" : "running";
  }

  // The seconds from 02:58:00 to 03:05:00, then the ice to 04:30.
  function night(C) {
    var P = plan(C);
    var rating = Number(C.fuse);
    var steps = [];
    var blownAt = null;
    var over = false;
    var peak = 0;
    var peakAt = null;
    for (var i = 0; i < SECS; i++) {
      var t = T0 + i;
      if (blownAt === null && over) blownAt = t;
      if (blownAt !== null) {
        steps.push({ t: t, amps: 0, running: "none: the fuse has blown", blewNow: blownAt === t, ice: ICE_SET });
        continue;
      }
      var amps = NIGHT_LOAD + draw(P.A, t) + draw(P.B, t);
      if (amps > peak) { peak = amps; peakAt = t; }
      over = amps > rating;
      var parts = [];
      if (phase(P.A, t)) parts.push("A " + phase(P.A, t));
      if (phase(P.B, t)) parts.push("B " + phase(P.B, t));
      steps.push({
        t: t, amps: amps, over: over, running: parts.length ? parts.join(", ") : "none (resting)", ice: ICE_SET,
        startA: t === P.A, startB: t === P.B
      });
    }
    for (var k = 1; k <= ICE_STEPS; k++) {
      var tt = ICE_FROM + 600 * k;
      var ice = blownAt !== null ? ICE_SET + Math.round(WARM * k / ICE_STEPS) : ICE_SET;
      steps.push({ t: tt, ten: true, amps: blownAt !== null ? 0 : NIGHT_LOAD + 2 * RUNNING,
        running: blownAt !== null ? "none: the fuse has blown" : "A running, B running", ice: ice, alarm: ice >= ALARM_AT });
    }
    return { P: P, steps: steps, blownAt: blownAt, peak: peak, peakAt: peakAt, rating: rating };
  }

  function scheduleText(P) { return "A " + hms(P.A) + ", B " + hms(P.B); }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 60;
  var X1 = 640;
  function px(i) { return X0 + i * (X1 - X0) / (SECS - 1); }
  function py(a) { return 190 - a * 0.5; }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k]));
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
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 220", width: "100%", "class": "dg", role: "img",
      "aria-label": "Amps drawn by the plant room each second from 02:58:00 to 03:05:00, against the main fuse's rating, drawn as a red line."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, sum: sum };
  }

  function drawChart(S, N) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    mk(doc, "path", { d: "M" + X0 + " 190L" + X1 + " 190M" + X0 + " 190L" + X0 + " 30", "class": "dg-axis" }, g);
    [0, 100, 200, 300].forEach(function (a) { txt(doc, g, X0 - 8, py(a) + 4, String(a), "dg-axis", "end"); });
    txt(doc, g, 8, 18, "amps each second", "dg-axis", "start");
    [[0, "02:58"], [120, "03:00"], [240, "03:02"], [360, "03:04"]].forEach(function (m) {
      txt(doc, g, px(m[0]), 208, m[1], "dg-axis", "middle");
    });
    var fy = py(N.rating);
    mk(doc, "path", { d: "M" + X0 + " " + fy + "L" + X1 + " " + fy, "class": "dg-flat" }, g);
    txt(doc, g, X1, fy - 6, "main fuse " + N.rating + " amps", "dg-note", "end");
    var n = Math.min(S.i, SECS);
    if (n > 0) {
      var d = "";
      for (var i = 0; i < n; i++) {
        d += (i ? "L" : "M") + px(i).toFixed(1) + " " + py(N.steps[i].amps).toFixed(1);
      }
      mk(doc, "path", { d: d, "class": "dg-msg", "stroke-width": 2 }, g);
    }
  }

  function draw2(api) {
    var S = api.state;
    var N = night(S.C);
    var row = S.i > 0 ? N.steps[S.i - 1] : null;
    S.ui.head.textContent = "Schedule tonight: " + scheduleText(N.P) + ". Main fuse " + N.rating + " amps. Decision record: " +
      pick(RECORDS, S.C.record).label + ". Guard: " + pick(GUARDS, S.C.guard).label + ".";
    drawChart(S, N);
    var played = S.i;
    var secsPlayed = Math.min(played, SECS);
    var peak = 0;
    var peakAt = null;
    for (var i = 0; i < secsPlayed; i++) if (N.steps[i].amps > peak) { peak = N.steps[i].amps; peakAt = N.steps[i].t; }
    var blown = N.blownAt !== null && row && row.t >= N.blownAt;
    S.stat.time(row ? (row.ten ? hm(row.t) : hms(row.t)) : "02:58:00 (not played)");
    S.stat.amps(row ? row.amps : "-");
    S.stat.peak(peakAt === null ? "none yet" : peak + " at " + hms(peakAt));
    S.stat.fuse(blown ? "blown at " + hms(N.blownAt) : "intact, " + N.rating + " amps");
    S.stat.running(row ? row.running : "none (resting)");
    S.stat.ice(deg(row ? row.ice : ICE_SET));
    S.stat.schedule(scheduleText(N.P));
    S.stat.check(N.P.result);
    S.stat.reason(N.P.reason);
    var alarm = "none";
    for (var k = 0; k < played; k++) if (N.steps[k].alarm) { alarm = hm(N.steps[k].t) + ", ice " + deg(N.steps[k].ice); break; }
    S.stat.alarm(alarm);
    S.ui.sum.textContent = row
      ? "At " + (row.ten ? hm(row.t) : hms(row.t)) + ": the plant room draws " + row.amps + " amps; compressors: " + row.running + "; ice " + deg(row.ice) + "."
      : "Not played yet: it is 02:58:00 on Thursday 15 October 2026. Both compressors are resting, the plant room draws 30 amps, and the ice is at -5.0 °C.";
  }

  function changeText(C) {
    var P = plan(C);
    if (!C.merge) return "No schedule change this evening. Schedule tonight: " + scheduleText(P) + ".";
    var s = "Wed 14 Oct, 19:06: the contractor proposes start B " + hms(Number(C.b)) + " to " + hms(Number(C.a)) +
      ". Note: two start times " + gapText(C) + " apart, no reason found, merged for simplicity. ";
    if (P.guard) s += "Controller guard: REFUSED, two starts within 60 seconds. ";
    if (P.rejected) s += "Change check: REJECTED, it breaks decision record DR-1: " + DR1 + ". ";
    if (P.merged && C.record === "present") s += "Saved. DR-1 is pinned beside the schedule, but the change was not checked against it. ";
    else if (P.merged) s += "Saved. ";
    return s + "Schedule tonight: " + scheduleText(P) + ".";
  }
  function gapText(C) {
    var g = Math.abs(Number(C.b) - Number(C.a));
    if (g === 0) return "0 seconds";
    if (g % 60 === 0) return (g / 60) + (g === 60 ? " minute" : " minutes");
    return g + " seconds";
  }

  function change(api, what) {
    api.state.i = 0;
    api.log(what + " Set back to 02:58:00. " + changeText(api.state.C), plan(api.state.C).merged ? "warn" : "");
    draw2(api);
  }

  function events(S, N, idx) {
    var r = N.steps[idx];
    var out = [];
    var rate = N.rating;
    if (r.ten) {
      if (r.alarm) out.push({ text: hm(r.t) + " ALARM: ice " + deg(r.ice) + ". The controller texts the night phone.", tone: "bad" });
      else if (r.t === ICE_FROM + 600 * ICE_STEPS) out.push({ text: hm(r.t) + " ice " + deg(r.ice) + ". No alarm.", tone: "ok" });
      return out;
    }
    if (r.startA || r.startB) {
      var who = r.startA && r.startB ? "start A and start B: 120 amps each" : (r.startA ? "start A" : "start B") + ": 120 amps for 5 seconds";
      out.push({ text: hms(r.t) + " " + who + ". The plant room draws " + r.amps + " amps" +
        (r.over ? ", over the " + rate + "-amp main fuse." : ", under the " + rate + "-amp main fuse."), tone: r.over ? "bad" : "" });
    } else if (r.over) {
      out.push({ text: hms(r.t) + " the plant room draws " + r.amps + " amps, over the " + rate + "-amp main fuse.", tone: "bad" });
    }
    if (r.blewNow) out.push({ text: hms(r.t) + " main fuse blew: the plant room is dark, compressors and pumps stopped. The controller still shows both started.", tone: "bad" });
    if (idx === SECS - 1) {
      out.push({ text: hms(r.t) + " peak " + N.peak + " amps at " + hms(N.peakAt) + "; main fuse " +
        (N.blownAt !== null ? "blown at " + hms(N.blownAt) : "intact") + "; compressors: " + r.running + ".", tone: N.blownAt !== null ? "bad" : "ok" });
    }
    return out;
  }

  function runStep(api, N, withSummary) {
    var S = api.state;
    var r = N.steps[S.i];
    if (withSummary) api.log((r.ten ? hm(r.t) : hms(r.t)) + " " + r.amps + " amps; " + r.running + "; ice " + deg(r.ice) + ".", "");
    events(S, N, S.i).forEach(function (e) { api.log(e.text, e.tone); });
    S.i += 1;
  }

  function playTo(api, n, withSummary) {
    var S = api.state;
    var N = night(S.C);
    if (S.i >= n) {
      api.log(S.i >= N.steps.length ? "The night has already played to 04:30. Change a setting or reset to play it again." : "Already past that time.", "");
      return;
    }
    while (S.i < n) runStep(api, N, withSummary);
    draw2(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { a: "10800", b: "10920", merge: true, guard: "off", record: "absent", fuse: "200" };
      S.i = 0;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("a", "Start A, before this evening", A_TIMES, "a");
      sel("b", "Start B, before this evening", B_TIMES, "b");
      api.control.toggle("merge", "This evening's tidy: start B moved to start A's time", true, function (on) {
        S.C.merge = !!on;
        change(api, "This evening's tidy: " + (on ? "on." : "off."));
      });
      sel("guard", "Controller guard", GUARDS, "guard");
      sel("record", "Decision record", RECORDS, "record");
      sel("fuse", "Main fuse", FUSES, "fuse");
      api.control.button("step", "Next step", function () {
        var N = night(S.C);
        if (S.i >= N.steps.length) {
          api.log("The night has already played to 04:30. Change a setting or reset to play it again.", "");
          return;
        }
        runStep(api, N, true);
        draw2(api);
      });
      api.control.button("secs", "Play to 03:05:00", function () { playTo(api, SECS, false); });
      api.control.button("ice", "Play to 04:30", function () { playTo(api, SECS + ICE_STEPS, false); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        amps: api.stat("amps", "plant room amps this second", ""),
        peak: api.stat("peak", "peak amps so far", "warn"),
        fuse: api.stat("fuse", "main fuse", "bad"),
        running: api.stat("running", "compressors", ""),
        ice: api.stat("ice", "ice temperature", ""),
        schedule: api.stat("schedule", "schedule tonight", ""),
        check: api.stat("check", "this evening's change", "warn"),
        reason: api.stat("reason", "reason given", ""),
        alarm: api.stat("alarm", "ice alarm (set at -1 °C)", "bad")
      };

      api.info("<strong>How to read it.</strong> The line is the plant room's draw each second, in amps: 30 for lights and pumps, 120 for each compressor in its first 5 seconds, 40 once it runs. The red line is the main fuse: a draw above it for a full second blows the fuse, and the plant room goes dark. The controller only sends start signals; nothing reports the fuse, and only the ice temperature is watched. The guard and the decision record judge this evening's change.");

      api.log("Thursday 15 October 2026, 02:58:00. " + changeText(S.C), "warn");
      draw2(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { a: "10800", b: "10920", merge: true, guard: "off", record: "absent", fuse: "200" };
      function as(set) {
        Object.keys(BUILT).forEach(function (k) { t.set(k, set && Object.prototype.hasOwnProperty.call(set, k) ? set[k] : BUILT[k]); });
      }
      function stepTo(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: 02:58:00, before the first second; tonight's merged schedule, fuse intact.
      t.expect(t.stat("time") === "02:58:00 (not played)" && t.stat("amps") === "-" && t.stat("peak") === "none yet" &&
        t.stat("fuse") === "intact, 200 amps" && t.stat("running") === "none (resting)" && t.stat("ice") === "-5.0 °C" &&
        t.stat("schedule") === "A 03:00:00, B 03:00:00" && t.stat("check") === "saved, nothing to check against" &&
        t.stat("alarm") === "none" && has("Note: two start times 2 minutes apart, no reason found, merged for simplicity."),
        "Opens at 02:58:00 with the merged schedule, both resting, the fuse intact and the ice at -5.0 °C");

      // 2. Tamsworth's schedule, 2 minutes apart: 150 at 03:00:00, 190 at 03:02:00, the fuse holds.
      as({ merge: false });
      stepTo(121);
      var o1 = t.stat("time") === "03:00:00" && t.stat("amps") === 150 && t.stat("running") === "A starting";
      begin();
      t.click("secs");
      t.expect(o1 && t.stat("peak") === "190 at 03:02:00" && t.stat("fuse") === "intact, 200 amps" &&
        t.stat("running") === "A running, B running" &&
        has("03:02:00 start B: 120 amps for 5 seconds. The plant room draws 190 amps, under the 200-amp main fuse."),
        "Two minutes apart: 150 amps at 03:00:00, then 190 at 03:02:00, and the 200-amp fuse holds");

      // 3. Tonight's merge: 270 at 03:00:00, the fuse blows at 03:00:01.
      as({});
      begin();
      stepTo(121);
      var m1 = t.stat("amps") === 270 && t.stat("fuse") === "intact, 200 amps" &&
        has("03:00:00 start A and start B: 120 amps each. The plant room draws 270 amps, over the 200-amp main fuse.");
      begin();
      t.click("step");
      t.expect(m1 && t.stat("time") === "03:00:01" && t.stat("amps") === 0 && t.stat("fuse") === "blown at 03:00:01" &&
        t.stat("running") === "none: the fuse has blown" && has("03:00:01 main fuse blew: the plant room is dark"),
        "Merged: 270 amps at 03:00:00 against a 200-amp fuse, which blows at 03:00:01");

      // 4. The ice: -5.0 at 03:00, -3.7 at 03:30, -2.3 at 04:00, -1.4 at 04:20, -1.0 and the alarm at 04:30.
      t.click("secs");
      var ice = [];
      for (var k = 0; k < 9; k++) { t.click("step"); ice.push(t.stat("ice")); }
      t.expect(ice.join(" ") === "-4.6 °C -4.1 °C -3.7 °C -3.2 °C -2.8 °C -2.3 °C -1.9 °C -1.4 °C -1.0 °C",
        "Fuse blown: the ice warms from -5.0 to -1.0 °C by 04:30, in 10-minute steps");
      t.expect(t.stat("time") === "04:30" && t.stat("alarm") === "04:30, ice -1.0 °C" &&
        has("04:30 ALARM: ice -1.0 °C. The controller texts the night phone.") && !has("04:20 ALARM"),
        "The alarm, set at -1 °C, texts the night phone at 04:30 and not before");

      // 5. Controller guard (option 3): the merge is refused, with no reason; the night holds at 190.
      as({ guard: "60" });
      var g1 = t.stat("check") === "REFUSED by the controller guard" && t.stat("reason") === "none given" &&
        t.stat("schedule") === "A 03:00:00, B 03:02:00";
      t.click("ice");
      t.expect(g1 && t.stat("peak") === "190 at 03:02:00" && t.stat("fuse") === "intact, 200 amps" && t.stat("ice") === "-5.0 °C" &&
        t.stat("alarm") === "none",
        "Guard on: the merge is refused with no reason given; the night peaks at 190 and the ice holds at -5.0 °C");

      // 6. A decision record nobody checks: the merge goes through and the fuse still blows.
      as({ record: "present" });
      var p1 = t.stat("check") === "saved, not checked against DR-1" && t.stat("schedule") === "A 03:00:00, B 03:00:00";
      t.click("ice");
      t.expect(p1 && t.stat("fuse") === "blown at 03:00:01" && t.stat("ice") === "-1.0 °C",
        "DR-1 pinned up but unchecked: the merge is saved and the fuse blows at 03:00:01");

      // 7. The record with a change check (option 2): rejected with its reason; the ice holds.
      as({ record: "check" });
      var c1 = t.stat("check") === "REJECTED by the change check" &&
        t.stat("reason") === "never start both within 2 minutes: 120-amp starts, 200-amp fuse" &&
        t.stat("schedule") === "A 03:00:00, B 03:02:00";
      t.click("ice");
      t.expect(c1 && t.stat("peak") === "190 at 03:02:00" && t.stat("fuse") === "intact, 200 amps" && t.stat("ice") === "-5.0 °C",
        "Record with a change check: the merge is rejected with DR-1's reason; peak 190, fuse intact, ice -5.0 °C");

      // 8. A 300-amp fuse (option 1, the supplier's call): the merge draws 270 and the fuse holds.
      as({ fuse: "300" });
      stepTo(121);
      var f1 = t.stat("amps") === 270;
      t.click("ice");
      t.expect(f1 && t.stat("fuse") === "intact, 300 amps" && t.stat("peak") === "270 at 03:00:00" && t.stat("ice") === "-5.0 °C",
        "A 300-amp fuse: the merged starts draw 270 at 03:00:00 and it holds");

      // 9. The gap that matters: 3 seconds blows the fuse at 03:00:04, 5 seconds holds at 190.
      as({ merge: false, b: "10803" });
      t.click("secs");
      var s3 = t.stat("fuse") === "blown at 03:00:04" && t.stat("peak") === "270 at 03:00:03";
      as({ merge: false, b: "10805" });
      t.click("secs");
      t.expect(s3 && t.stat("fuse") === "intact, 200 amps" && t.stat("peak") === "190 at 03:00:05",
        "B 3 seconds after A draws 270 and blows the fuse at 03:00:04; 5 seconds after holds at 190");
    }
  });
})();
