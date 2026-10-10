/* sims/s2e08-v1.0.2.js  (published as sims/s2e08.js)
   Case s2e08 "Napkin Math": an estimation workbench built from Bronagh's New Year's Eve at
   Coldharbour Cars, a cab firm whose booking robot answers on rented phone lines and offers a
   ring-back when every line is busy.

   CHANGELOG
   v1.0.2 (2026-10-10) QA: the "hour" mistake on traffic that comes in a single hour now says nothing
     changes, as the log does, instead of "1 times too many".
   v1.0.1 (2026-10-10) Season 2 review fixes: the log no longer says a plan that is 100% busy
     "carries the peak": 180 lines log "is exactly full at the peak, with no room for a busier
     minute", and a plan over 80% busy says it has less room than 80% leaves (new selfTest
     assertion: plan 180 logs "exactly full"). The KiB mistake says how much bigger the real size
     is than the label ("the real size is 9.95% more than the label says"), not "% short", and the
     selfTest checks the new wording. The dispatcher mistake names the unit ("With 2 servers, 314.8
     a second ..."). A mistake that changes nothing logs "Mistake: no change here." and shows "-" in
     the off stat instead of 1. A plan with less than one server idle gives the spare capacity as a
     percentage instead of fractional servers sitting idle. Points at case v1.0.1. selfTest: 15
     assertions.
   v1.0.0 (2026-10-09) first version: a widget-style sim built inside api.root (no diagram, no
     step). Inputs: users a day, requests per user a day, reads for every write, hours the traffic
     comes in, peak factor, size of each write, retention years, copies, capacity per server (a
     select of teaching-model values, one of them a phone line) and the number of servers you plan
     to run. Presets: Coldharbour Cars on New Year's Eve, and a link shortener at 100 million
     requests a day. Outputs: requests a day, average and peak requests a second (reads and
     writes), storage a day, a year and in total, bandwidth in and out at the peak (bytes and
     bits), servers busy at the peak and servers to run at most 80% busy, and what your plan does
     at the true peak. "The napkin" panel lists every step's arithmetic. A mistakes select
     reproduces the dispatcher's napkin (the average, no peak, no headroom) and five other units
     traps, and shows how far off each lands. Stats: average a second, peak a second, servers to
     run, turned away in the busiest hour (your plan), storage in total, bandwidth out at the peak,
     how far off. selfTest: 14 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e08-v1.0.2.json):
   - post: last year's bill and this year's dashboard, 14,400 calls between 8 PM and 4 AM (8 hours);
     the robot records the pickup address in the five seconds after the tone; each line holds one
     call at a time. Bronagh's napkin: 14,400 / 8 = 1,800 an hour, 0.5 a second; a call holds a
     line 2 minutes, so a line takes 30 an hour; 1,800 / 30 = 60 lines; rent 60. The dashboard for
     01:00-02:00: 5,400 calls offered, 1,800 got a line, 3,600 sent to ring-back; at 02:00, 60 of
     60 lines busy and 3,600 ring-backs waiting. Ignatius's napkin: "Not the night. The hour after
     one."
   - comments: u/trunk_line_gethin, recordings at 64 kilobits a second, 8 kilobytes a second, so a
     five-second address is 40 KB, not 320; KB 1,000 bytes, KiB 1,024. OP's reply: Coldharbour's
     contract says 64 kilobits a second, kept for a year, in two copies.
   - reply options (part 2 is the Coldharbour preset with the plan set to the option's lines):
     225 lines: 180 of 225 busy, 80%, nobody sent to ring-back. 120 lines: they carry 1 a second,
     3,600 an hour, so 0.5 a second, 1,800 in the hour after one, go to ring-back. 180 lines:
     180 of 180 busy, exactly full on the hour's average. 500 lines: 180 of 500 busy, 36%, 320 idle.
   - explanation: 100,000,000 / 86,400 = 1,157.4, about 1,160; 14,400 / 86,400 = 0.167, one every
     6 seconds; 14,400 / 3,600 = 4 a second, 8 times too many; 5,400 / 30 = 180; 1.5 x 120 = 180;
     180 / 0.8 = 225; the link shortener's 990,099 writes and 99 million reads a day, 495 MB a day,
     181 GB a year, 2.71 TB for 5 years in 3 copies, about 2,290 reads a second at the peak,
     1.15 MB a second out, 9.17 Mbps.
   - sim.lede: both presets' inputs, the 80% target, rounding to 3 significant figures, KB = 1,000
     bytes.

   Teaching model (stated in sim.lede):
   - requests a day = users x requests each. Reads = requests x R / (R + 1), writes =
     requests / (R + 1), where R is reads for every write.
   - average a second = requests a day / (hours the traffic comes in x 3,600). With 24 hours that is
     the familiar / 86,400.
   - peak a second = average x peak factor, the busiest hour's rate.
   - busy at the peak = peak / what one server carries. A phone line carries one call per 120
     seconds, so busy lines = peak x 120 (1.5 x 120 = 180), the same as 5,400 an hour / 30 an hour.
   - servers to run = round up (busy / 0.8): at most 80% busy at the peak, the room to spare the
     ticket booth's case (s2e01) used. A teaching value, not a law.
   - storage a day = writes a day x size; a year = x 365; in total = x retention years x copies.
     Storage assumes every day looks like the one described.
   - bandwidth in = peak writes a second x size, out = peak reads a second x size; bits = bytes x 8.
   - your plan: N servers carry N x what one carries. At the true peak (no mistake), anything above
     that finds every server busy; x 3,600 is how many in the busiest hour.
   - Units are decimal: KB 1,000 bytes, MB a million, GB a billion, TB a trillion. Rates and sizes
     are shown to 3 significant figures (1,157.4 shows as 1,160); the napkin also shows the exact
     figure to one decimal place (three below 10).

   Derivations for the self-tests (all arithmetic with the model above):
   - Coldharbour: 14,400 x 1 = 14,400 a day, all writes (0 reads for every write). 8 x 3,600 =
     28,800 s; 14,400 / 28,800 = 0.5 a second exactly; x 3 = 1.5 exactly; x 3,600 = 5,400 in the
     hour after one. 1.5 x 120 = 180 lines busy; 180 x 100 / 80 = 225. Storage: 14,400 x 40,000 B
     = 576,000,000 B a day; x 365 = 210,240,000,000 B; x 1 year x 2 copies = 420,480,000,000 B,
     shown as 420 GB. Bandwidth in at the peak: 1.5 x 40,000 = 60,000 B/s = 480,000 bit/s; out 0.
   - The dispatcher's napkin (Coldharbour): peak factor treated as 1 and no headroom: 0.5 x 120 = 60
     lines, matching 1,800 / 30 = 60. 60 lines carry 60 / 120 = 0.5 a second, 1,800 an hour; at
     1.5 a second, 1.0 a second find every line busy, 3,600 in the hour. 180 / 60 = 3 times short;
     225 / 60 = 3.75 with headroom.
   - Whole-day mistake (Coldharbour): 14,400 / 86,400 = 0.1667, one every 6 s; x 3 = 0.5;
     x 120 = 60 busy; 75 to run; off by 0.5 / 0.1667 = 3.
   - 3,600-only mistake (Coldharbour): 14,400 / 3,600 = 4 a second; x 3 = 12; x 120 = 1,440 busy;
     1,800 to run; off by 4 / 0.5 = 8, too many.
   - Plans (Coldharbour): 120 lines carry 1 a second: 0.5 a second, 1,800 in the hour, turned to
     ring-back, 3,600 through. 180 carry 1.5: exactly full, 100%. 225 carry 1.875, 6,750 an hour:
     180 of 225 busy, 80%, 45 idle. 500 carry 4.167, 15,000 an hour: 180 of 500, 36%, 320 idle.
   - Link shortener: 10,000,000 x 10 = 100,000,000 a day; writes 100,000,000 / 101 = 990,099.0,
     reads 99,009,901. 100,000,000 / 86,400 = 1,157.407; Math.round(x 10) / 10 = 1,157.4; 3
     significant figures: 1,160. Peak x 2 = 2,314.8, shown as 2,310 (doubling is exact in floating
     point). Busy at 1,000 a second: 2.315; / 0.8 = 2.894; 3 servers. Storage: 990,099.0 x 500 =
     495,049,505 B a day (495 MB); x 365 = 180,693,069,307 B (181 GB); x 5 x 3 = 2,710,396,039,604 B
     (2.71 TB; checked against 10^8 x 500 x 365 x 15 / 101 to 1e-12). Out at the peak: 2,291.9 reads
     a second x 500 = 1,145,948 B/s (1.15 MB/s) = 9,167,583 bit/s (9.17 Mbps); in 11,459 B/s =
     91.7 kbps. Bits-for-bytes mistake: out shows 1.15 Mbps, off by 8. KiB mistake: the total
     divided by 1,024^4 is 2.465, shown as 2.47 TB, off by 1,024^4 / 1,000^4 = 1.0995, shown as 1.1.
     Copies forgotten: 903,465,346,535 B, shown as 903 GB, off by 3. The dispatcher's napkin: the
     average 1.157 busy, 2 servers, 2.315 / 2 = 1.16 times short.
   - Coldharbour KiB mistake: 420,480,000,000 / 1,024^3 = 391.6, shown as 392 GB, off by 1.0737,
     shown as 1.07.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the widget inside api.root on every reset. No step() is needed;
     every number is worked out the moment a control changes, and the log speaks 0.4 s later.
   - Inputs are ranges over fixed lists, so every story value is hit exactly and the self-tests can
     set them with t.set(id, index).
   - Stats get short strings; rates and counts carry no units (the labels have them), sizes and
     bandwidths carry their unit because it changes with the size.
   - Colors come only from theme classes (muted, small); no literal colors anywhere.
*/
(function () {
  "use strict";

  var X = "×";        // multiplication sign
  var DIV = "÷";      // division sign

  /* ---------- units and teaching values ---------- */

  var DAY = 86400;                 // seconds in a day
  var HOUR = 3600;                 // seconds in an hour
  var YEAR_DAYS = 365;
  var TARGET_PCT = 80;             // run servers at most 80% busy at the peak (the ticket booth's room to spare)
  var EPS = 1e-9;
  var START_CLOCK = 2 * 3600;      // 02:00:00, when every line at Coldharbour was busy
  var NARRATE_DELAY = 0.4;         // real seconds of stillness before the log speaks

  /* ---------- the story's numbers ---------- */

  var STORY = {
    calls: 14400,                  // last year's bill, and this year's dashboard, 8 PM to 4 AM
    hours: 8,                      // 8 PM to 4 AM
    hold: 120,                     // a call holds a line 2 minutes
    napkinLines: 60,               // Bronagh's napkin: 1,800 / 30
    peakHourCalls: 5400,           // 01:00-02:00, calls offered
    gotALine: 1800,                // 01:00-02:00, got a line
    ringBack: 3600,                // 01:00-02:00, sent to ring-back; waiting at 02:00
    recordSeconds: 5,              // the robot records the address in the five seconds after the tone
    recordBitsPerSec: 64000,       // 64 kilobits a second (Gethin's robots, and Coldharbour's contract)
    retainYears: 1,                // kept for a year
    copies: 2                      // in two copies
  };

  /* ---------- the inputs' stops ---------- */

  var USERS = [1000, 10000, 14400, 100000, 1000000, 10000000, 100000000, 1000000000];
  var ACTIONS = [1, 2, 3, 5, 10, 20, 50, 100];
  var RATIOS = [0, 1, 2, 5, 10, 20, 100, 1000];
  var HOURS = [1, 2, 4, 6, 8, 12, 16, 24];
  var PEAKS = [1, 1.5, 2, 3, 5, 10];
  var SIZES = [100, 500, 1000, 4000, 40000, 100000, 1000000, 5000000];
  var RETAIN = [1, 2, 3, 5, 7, 10];
  var COPIES = [1, 2, 3, 5];
  var PLANS = [1, 2, 3, 5, 10, 20, 30, 60, 75, 100, 120, 180, 225, 300, 500, 1000];

  // What one server carries: num requests every per seconds. All teaching-model values.
  var CAPS = [
    { value: "line", label: "A phone line: one call at a time, 2 minutes each (30 an hour)", num: 1, per: 120,
      one: "line", many: "lines", carries: "one call per 120 seconds, 30 an hour", away: "sent to ring-back" },
    { value: "150", label: "150 requests a second, like the ticket booth's small server", num: 150, per: 1,
      one: "server", many: "servers", carries: "150 requests a second", away: "turned away" },
    { value: "1000", label: "1,000 requests a second (teaching model)", num: 1000, per: 1,
      one: "server", many: "servers", carries: "1,000 requests a second", away: "turned away" },
    { value: "10000", label: "10,000 requests a second (teaching model)", num: 10000, per: 1,
      one: "server", many: "servers", carries: "10,000 requests a second", away: "turned away" }
  ];

  var PRESETS = {
    coldharbour: { users: 14400, actions: 1, ratio: 0, hours: 8, peak: 3, size: 40000, retain: 1, copies: 2, cap: "line", plan: 60 },
    linkday: { users: 10000000, actions: 10, ratio: 100, hours: 24, peak: 2, size: 500, retain: 5, copies: 3, cap: "1000", plan: 3 }
  };
  var PRESET_OPTS = [
    { value: "coldharbour", label: "Coldharbour Cars, New Year's Eve" },
    { value: "linkday", label: "A link shortener: 100 million requests a day" },
    { value: "custom", label: "Your own numbers" }
  ];
  var PRESET_NAME = {
    coldharbour: "Coldharbour Cars, New Year's Eve",
    linkday: "The link shortener, 100 million a day",
    custom: "Your numbers"
  };

  var MISTAKE_OPTS = [
    { value: "none", label: "No mistakes" },
    { value: "dispatcher", label: "The dispatcher's napkin: the average, no peak, no headroom" },
    { value: "wholeday", label: "A whole day's 86,400 seconds, though traffic comes in fewer hours" },
    { value: "hour", label: "Divide by 3,600 alone: the hours treated as one" },
    { value: "bits", label: "Bits for bytes: bandwidth in bytes read as bits" },
    { value: "kib", label: "KiB for KB: storage counted in 1,024s, labelled in 1,000s" },
    { value: "copies", label: "Forget the copies" }
  ];

  /* ---------- formatting (written by hand so it never depends on the browser's locale) ---------- */

  function commas(s) {
    var parts = String(s).split("."), i = parts[0], out = "";
    while (i.length > 3) { out = "," + i.slice(-3) + out; i = i.slice(0, -3); }
    return i + out + (parts.length > 1 ? "." + parts[1] : "");
  }
  function strip(s) { return s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s; }
  function fmtInt(n) { return commas(String(Math.round(n))); }
  function fmtNum(v) { return commas(strip(String(v))); }

  // floor(log10(x)) for x > 0, corrected for floating-point edges such as log10(1000).
  function mag(x) {
    var e = Math.floor(Math.log(x) / Math.LN10);
    if (Math.pow(10, e + 1) <= x) e += 1;
    if (Math.pow(10, e) > x) e -= 1;
    return e;
  }

  // Three significant figures, on purpose: 1,157.407 -> "1,160", 0.16667 -> "0.167", 1.5 -> "1.5".
  function about(x) {
    if (!isFinite(x)) return "-";
    if (x === 0) return "0";
    var e = mag(x), d = 2 - e, s;
    if (d > 0) {
      var k = Math.pow(10, d);
      s = strip((Math.round(x * k) / k).toFixed(d));
    } else {
      var step = Math.pow(10, -d);
      s = String(Math.round(x / step) * step);
    }
    return commas(s);
  }

  // The exact figure: one decimal place, or three below 10. 1,157.407 -> "1,157.4".
  function exact(x) {
    if (!isFinite(x)) return "-";
    if (x >= 10) return commas(strip((Math.round(x * 10) / 10).toFixed(1)));
    return commas(strip((Math.round(x * 1000) / 1000).toFixed(3)));
  }

  var BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  var BIT_UNITS = ["bps", "kbps", "Mbps", "Gbps", "Tbps", "Pbps"];

  // How many steps of base a value is divided by before it is shown.
  function unitStep(x, base, max) {
    var k = 0, v = x;
    while (v >= base && k < max) { v = v / base; k += 1; }
    return k;
  }
  // Decimal units: 420,480,000,000 -> "420 GB". binary: divide by 1,024s but keep the decimal labels (the KiB mistake).
  function fmtBytes(x, binary) {
    var base = binary ? 1024 : 1000;
    var k = unitStep(x, base, BYTE_UNITS.length - 1);
    return about(x / Math.pow(base, k)) + " " + BYTE_UNITS[k];
  }
  function fmtBits(x) {
    var k = unitStep(x, 1000, BIT_UNITS.length - 1);
    return about(x / Math.pow(1000, k)) + " " + BIT_UNITS[k];
  }

  function plural(n, one, many) { return n === 1 ? one : many; }
  function copyOf(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function capOf(v) { return pick(CAPS, v) || CAPS[0]; }

  /* ---------- the napkin's arithmetic ---------- */

  // p: the inputs. m: a mistake id, or "none". Every output of the workbench comes from here.
  function calc(p, m) {
    m = m || "none";
    var cap = capOf(p.cap);
    var perDay = p.users * p.actions;
    var writesDay = perDay / (p.ratio + 1);
    var readsDay = perDay * p.ratio / (p.ratio + 1);
    var liveSec = p.hours * HOUR;
    var divisor = m === "wholeday" ? DAY : m === "hour" ? HOUR : liveSec;
    var factor = m === "dispatcher" ? 1 : p.peak;
    var avg = perDay / divisor, avgR = readsDay / divisor, avgW = writesDay / divisor;
    var peak = avg * factor, peakR = avgR * factor, peakW = avgW * factor;
    var busy = peak * cap.per / cap.num;
    var run = m === "dispatcher" ? Math.max(1, Math.ceil(busy - EPS)) :
      Math.max(1, Math.ceil(busy * 100 / TARGET_PCT - EPS));
    var copies = m === "copies" ? 1 : p.copies;
    var storeDay = writesDay * p.size;
    var storeYear = storeDay * YEAR_DAYS;
    var storeTotal = storeYear * p.retain * copies;
    var inBytes = peakW * p.size, outBytes = peakR * p.size;
    var bitsPerByte = m === "bits" ? 1 : 8;
    return {
      mistake: m, cap: cap, perDay: perDay, writesDay: writesDay, readsDay: readsDay, liveSec: liveSec, divisor: divisor,
      factor: factor, avg: avg, avgR: avgR, avgW: avgW, peak: peak, peakR: peakR, peakW: peakW, busy: busy, run: run,
      copies: copies, storeDay: storeDay, storeYear: storeYear, storeTotal: storeTotal,
      inBytes: inBytes, outBytes: outBytes, inBits: inBytes * bitsPerByte, outBits: outBytes * bitsPerByte
    };
  }

  // Your plan, checked against the true peak (no mistake).
  function planEval(p) {
    var r = calc(p, "none"), cap = r.cap, n = p.plan;
    var carry = n * cap.num / cap.per;
    var away = r.peak - carry;
    if (away < EPS) away = 0;
    return {
      n: n, cap: cap, r: r, carry: carry, away: away, through: Math.min(carry, r.peak),
      util: r.busy * 100 / n, busy: Math.min(r.busy, n), idle: Math.max(0, n - r.busy)
    };
  }

  // How far the mistake lands from the right answer, in times; null with no mistake.
  function offBy(p, m) {
    if (!m || m === "none") return null;
    var c = calc(p, m), r = calc(p, "none");
    if (m === "dispatcher") return r.busy / c.run;
    if (m === "wholeday") return r.avg / c.avg;
    if (m === "hour") return c.avg / r.avg;
    if (m === "bits") return 8;
    if (m === "kib") {
      var k = unitStep(r.storeTotal, 1024, BYTE_UNITS.length - 1);
      return Math.pow(1024, k) / Math.pow(1000, k);
    }
    if (m === "copies") return p.copies;
    return null;
  }

  /* ---------- the napkin panel ---------- */

  function approx(x) { return about(x) === exact(x) ? "" : ", about " + about(x); }
  function every(x) { return x > 0 && x < 1 ? ", 1 every " + about(1 / x) + " s" : ""; }

  function carriedCalc(rate, cap) {
    if (cap.per === 1) return exact(rate) + " a second " + DIV + " " + fmtInt(cap.num) + " a second per " + cap.one;
    return about(rate * HOUR) + " an hour " + DIV + " " + fmtNum(HOUR * cap.num / cap.per) + " an hour per " + cap.one;
  }

  function napkinLines(S) {
    var p = S.p, m = S.mistake, c = calc(p, m), cap = c.cap, bin = m === "kib", out = [];

    out.push(fmtInt(p.users) + " users " + X + " " + fmtInt(p.actions) + plural(p.actions, " request", " requests") +
      " each = " + fmtInt(c.perDay) + " requests a day.");

    if (p.ratio === 0) out.push("0 reads for every write: all " + fmtInt(c.perDay) + " are writes.");
    else out.push(fmtInt(p.ratio) + " reads for every write: " + fmtInt(c.perDay) + " " + DIV + " " + fmtInt(p.ratio + 1) +
      " = " + exact(c.writesDay) + " writes a day, about " + about(c.writesDay) + ", and about " + about(c.readsDay) + " reads.");

    var lead;
    if (m === "wholeday") lead = "A whole day's 86,400 seconds, though the traffic comes in " + p.hours + plural(p.hours, " hour", " hours") + " (the mistake): ";
    else if (m === "hour") lead = "3,600 seconds alone, as if the " + p.hours + plural(p.hours, " hour", " hours") + " were one (the mistake): ";
    else if (p.hours === 24) lead = "A day is 86,400 seconds: ";
    else lead = "The traffic comes in " + p.hours + plural(p.hours, " hour", " hours") + ", " + p.hours + " " + X + " 3,600 = " +
      fmtInt(c.liveSec) + " seconds: ";
    out.push(lead + fmtInt(c.perDay) + " " + DIV + " " + fmtInt(c.divisor) + " = " + exact(c.avg) + " a second" + approx(c.avg) +
      every(c.avg) + (p.ratio ? " (" + about(c.avgR) + " reads, " + about(c.avgW) + " writes)" : "") + ".");

    if (m === "dispatcher") out.push("No peak (the mistake): sized for the average, " + exact(c.avg) + " a second.");
    else out.push("Busiest hour: " + exact(c.avg) + " " + X + " " + fmtNum(p.peak) + " peak factor = " + exact(c.peak) +
      " a second" + approx(c.peak) + ", " + about(c.peak * HOUR) + " in that hour.");

    out.push("Storage: " + about(c.writesDay) + " writes " + X + " " + fmtBytes(p.size, false) + " = " + fmtBytes(c.storeDay, bin) +
      " a day; " + X + " 365 = " + fmtBytes(c.storeYear, bin) + " a year; " + X + " " + p.retain + plural(p.retain, " year", " years") +
      " " + X + " " + c.copies + plural(c.copies, " copy", " copies") + " = " + fmtBytes(c.storeTotal, bin) +
      (m === "copies" ? " (the copies forgotten: the mistake)" : "") +
      (bin ? " (counted in 1,024s, labelled in 1,000s: the mistake)" : "") + ".");

    out.push("Bandwidth at the peak: in, " + about(c.peakW) + " writes a second " + X + " " + fmtBytes(p.size, false) + " = " +
      fmtBytes(c.inBytes, false) + "/s = " + fmtBits(c.inBits) + "; out, " + about(c.peakR) + " reads a second " + X + " " +
      fmtBytes(p.size, false) + " = " + fmtBytes(c.outBytes, false) + "/s = " + fmtBits(c.outBits) +
      (m === "bits" ? " (bytes read as bits: the mistake)." : " (" + X + " 8 bits a byte)."));

    if (m === "dispatcher") out.push("Each " + cap.one + " carries " + cap.carries + ": " + carriedCalc(c.peak, cap) + " = " +
      exact(c.busy) + " busy. No headroom (the mistake): round up to " + fmtInt(c.run) + " " + plural(c.run, cap.one, cap.many) + ".");
    else out.push("Each " + cap.one + " carries " + cap.carries + ": " + carriedCalc(c.peak, cap) + " = " + exact(c.busy) +
      " busy at the peak. At most 80% busy: " + exact(c.busy) + " " + DIV + " 0.8 = " + exact(c.busy * 100 / TARGET_PCT) +
      ", round up: " + fmtInt(c.run) + " " + plural(c.run, cap.one, cap.many) + " to run.");

    return out;
  }

  function presetNote(S) {
    if (S.preset === "coldharbour") {
      return "Coldharbour's night in the workbench's words: each call is one request from one user, and every call is a write, " +
        "because the robot saves a five-second recording of the address (64 kilobits a second " + DIV + " 8 = 8 KB a second, " +
        X + " 5 = 40 KB). Each line is a server that carries one call per 120 seconds. Storage assumes every night is like " +
        "this one, so read it as the most a year could need.";
    }
    if (S.preset === "linkday") {
      return "A link shortener at 100 million requests a day, like Loadout's Build Night L3: 10 million users making 10 requests each, " +
        "100 reads (links followed) for every write (a link created), 500 bytes a link, kept 5 years in 3 copies, a peak factor of 2 " +
        "and 1,000 requests a second per server. All teaching values: state them out loud and check them later.";
    }
    return "Your own numbers. Every capacity here is a teaching model, not a measurement, and storage assumes every day looks like this one.";
  }

  function planText(S) {
    var pl = planEval(S.p), cap = pl.cap, n = pl.n, s;
    s = "Your plan: " + fmtInt(n) + " " + plural(n, cap.one, cap.many) + ", carrying " + exact(pl.carry) + " a second, " +
      about(pl.carry * HOUR) + " an hour. At the true peak, " + exact(pl.r.peak) + " a second, ";
    if (pl.util > 100 + EPS) s += "demand is " + about(pl.util) + "% of what they carry, so all " + fmtInt(n) + " are busy. ";
    else s += exact(pl.busy) + " of " + fmtInt(n) + " are busy: " + about(pl.util) + "%. ";
    if (pl.away > 0) {
      s += exact(pl.away) + " a second find every one busy: " + fmtInt(Math.round(pl.away * HOUR)) + " " + cap.away +
        " in the busiest hour, while " + about(pl.through * HOUR) + " get through.";
    } else if (pl.util > 100 - EPS) {
      s += "Exactly full on the hour's average: any minute busier than the average finds every one busy.";
    } else {
      s += (pl.idle < 1 ? "About " + about(pl.idle * 100 / pl.n) + "% of their capacity is spare at the busiest moment" :
        exact(pl.idle) + " sit idle at the busiest moment") + (pl.util > TARGET_PCT + EPS ? ", less room than 80% busy leaves." : ".");
    }
    return s;
  }

  function mistakeText(S) {
    var p = S.p, m = S.mistake, c = calc(p, m), r = calc(p, "none"), cap = r.cap, off = offBy(p, m);
    if (m === "none") return "No mistake chosen. Pick one to see the wrong napkin beside the right one, and how far apart they land.";
    if (m === "dispatcher") {
      var carry = c.run * cap.num / cap.per, away = r.peak - carry;
      var s = "The dispatcher's napkin sizes for the average, with no peak and no headroom: " + exact(c.avg) + " a second needs " +
        fmtInt(c.run) + " " + plural(c.run, cap.one, cap.many) + ". ";
      if (away < EPS) return s + "Here the peak factor is " + fmtNum(p.peak) + ", so the napkin holds at the peak, but with no room to spare.";
      return s + "The busiest hour brings " + exact(r.peak) + " a second, which keeps " + exact(r.busy) + " busy: the napkin is " +
        about(off) + " times short, and " + about(r.run / c.run) + " times once you leave headroom (" + fmtInt(r.run) + "). With " +
        fmtInt(c.run) + " " + plural(c.run, cap.one, cap.many) + ", " + exact(away) + " a second find every one busy: " + fmtInt(Math.round(away * HOUR)) +
        " in the busiest hour, while " + about(carry * HOUR) + " get through.";
    }
    if (m === "wholeday") {
      if (p.hours === 24) return "This traffic comes in all 24 hours, so a whole day is the right divisor and nothing changes. Try it on Coldharbour's night.";
      return "Dividing by a whole day's 86,400 seconds spreads " + fmtInt(r.perDay) + " requests over 24 hours, though they come in " +
        p.hours + ": " + exact(c.avg) + " a second instead of " + exact(r.avg) + ", " + about(off) + " times too low. Every rate, " +
        "the bandwidth and the servers fall with it: " + fmtInt(c.run) + " " + plural(c.run, cap.one, cap.many) + " instead of " + fmtInt(r.run) + ".";
    }
    if (m === "hour") {
      if (p.hours === 1) return "This traffic comes in a single hour, so dividing by 3,600 is right and nothing changes. Try it on Coldharbour's night.";
      return "Dividing by 3,600 alone treats the " + p.hours + plural(p.hours, " hour", " hours") + " as one: " + exact(c.avg) +
        " a second instead of " + exact(r.avg) + ", " + about(off) + " times too many. It errs on the safe side, at a price: " +
        fmtInt(c.run) + " " + plural(c.run, cap.one, cap.many) + " instead of " + fmtInt(r.run) + ".";
    }
    if (m === "bits") {
      var big = r.outBytes >= r.inBytes ? "out" : "in", bytes = big === "out" ? r.outBytes : r.inBytes;
      return "Bandwidth worked out in bytes, then read as bits: " + big + " at the peak is " + fmtBytes(bytes, false) + "/s, which is " +
        fmtBits(bytes * 8) + ", not " + fmtBits(bytes) + ". A link bought from the wrong number is 8 times too small.";
    }
    if (m === "kib") {
      return "Storage counted in 1,024s but labelled in 1,000s: " + fmtBytes(r.storeTotal, false) + " shows as " +
        fmtBytes(r.storeTotal, true) + ": the real size is " + about((off - 1) * 100) + "% more than the label says. The gap grows at every step: 2.4% at KB, " +
        "about 4.9% at MB, 7.4% at GB and nearly 10% at TB.";
    }
    if (m === "copies") {
      if (p.copies === 1) return "Only 1 copy here, so nothing changes. Most stores keep 2 or 3.";
      return "Storage for one copy instead of " + p.copies + ": " + fmtBytes(c.storeTotal, false) + " instead of " +
        fmtBytes(r.storeTotal, false) + ", " + about(off) + " times too little.";
    }
    return "";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }

    var box = el("div", "", "display:grid;gap:6px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "Estimation workbench. Capacities are teaching-model values. Rates and sizes are rounded to 3 significant figures, " +
      "KB, MB, GB and TB are 1,000s, and storage assumes every day looks like the one you describe."));
    var note = el("p", "", "margin:0;font-size:13px;", "");
    box.appendChild(note);

    box.appendChild(head("The napkin, step by step"));
    var list = el("ol", "", "margin:0;padding-left:20px;font-size:13px;font-variant-numeric:tabular-nums;", "");
    list.setAttribute("aria-live", "polite");
    box.appendChild(list);

    box.appendChild(head("Your plan"));
    var plan = el("p", "", "margin:0;font-size:13px;", "");
    plan.setAttribute("aria-live", "polite");
    box.appendChild(plan);

    box.appendChild(head("The mistake"));
    var mistake = el("p", "", "margin:0;font-size:13px;", "");
    mistake.setAttribute("aria-live", "polite");
    box.appendChild(mistake);

    api.root.appendChild(box);
    return { el: el, box: box, note: note, list: list, plan: plan, mistake: mistake };
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function draw(api) {
    var S = api.state, ui = S.ui, p = S.p, m = S.mistake, c = calc(p, m), pl = planEval(p), off = offBy(p, m);
    ui.note.textContent = presetNote(S);
    clear(ui.list);
    napkinLines(S).forEach(function (line) { ui.list.appendChild(ui.el("li", "", "margin:2px 0;", line)); });
    ui.plan.textContent = planText(S);
    ui.mistake.textContent = mistakeText(S);

    S.stat.avg(about(c.avg));
    S.stat.peak(about(c.peak));
    S.stat.run(fmtInt(c.run));
    S.stat.away(fmtInt(Math.round(pl.away * HOUR)));
    S.stat.store(fmtBytes(c.storeTotal, m === "kib"));
    S.stat.out(fmtBits(c.outBits));
    S.stat.off(off === null || Math.abs(off - 1) < EPS ? "-" : about(off));
  }

  /* ---------- narration ---------- */

  function summary(S) {
    var p = S.p, m = S.mistake, c = calc(p, m), pl = planEval(p), cap = c.cap, off = offBy(p, m);
    var s = PRESET_NAME[S.preset] + ": " + about(c.avg) + " a second on average, " + about(c.peak) + " at the peak; " +
      exact(c.busy) + " " + cap.many + " busy, " + fmtInt(c.run) + " to run" + (m === "dispatcher" ? " by the napkin" : "") +
      ". Your plan, " + fmtInt(pl.n) + ", ";
    s += pl.away > 0 ? "leaves " + fmtInt(Math.round(pl.away * HOUR)) + " " + cap.away + " in the busiest hour." :
      pl.util > 100 - EPS ? "is exactly full at the peak, with no room for a busier minute." :
      pl.util > TARGET_PCT + EPS ? "carries the peak, with less room than 80% busy leaves." : "carries the peak.";
    if (off !== null) s += Math.abs(off - 1) < EPS ? " Mistake: no change here." : " Mistake: off by " + about(off) + " times.";
    return s;
  }

  function tone(S) {
    var pl = planEval(S.p);
    if (S.mistake !== "none") return "warn";
    return pl.away > 0 ? "bad" : pl.util > TARGET_PCT + EPS ? "warn" : "ok";
  }

  function narrateLater(api) {
    var S = api.state;
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      api.log(summary(S), tone(S));
    });
  }

  /* ---------- controls ---------- */

  var RANGES = [
    { key: "users", list: USERS, label: "Users a day (Coldharbour: calls on the night)", show: function (v) { return fmtInt(v); } },
    { key: "actions", list: ACTIONS, label: "Requests per user a day", show: function (v) { return fmtInt(v); } },
    { key: "ratio", list: RATIOS, label: "Reads for every write (the read:write ratio)", show: function (v) { return fmtInt(v) + " : 1"; } },
    { key: "hours", list: HOURS, label: "Hours the traffic comes in", show: function (v) { return v + plural(v, " hour", " hours"); } },
    { key: "peak", list: PEAKS, label: "Peak factor: the busiest hour " + DIV + " the average", show: function (v) { return X + " " + fmtNum(v); } },
    { key: "size", list: SIZES, label: "Size of each write", show: function (v) { return fmtBytes(v, false); } },
    { key: "retain", list: RETAIN, label: "Retention: years kept", show: function (v) { return v + plural(v, " year", " years"); } },
    { key: "copies", list: COPIES, label: "Copies kept", show: function (v) { return String(v); } }
  ];

  function toCustom(S) {
    S.preset = "custom";
    S.ctl.preset.set("custom");
  }

  function syncControls(S) {
    RANGES.forEach(function (r) { S.ctl[r.key].set(r.list.indexOf(S.p[r.key])); });
    S.ctl.cap.set(S.p.cap);
    S.ctl.plan.set(PLANS.indexOf(S.p.plan));
    S.ctl.preset.set(S.preset);
  }

  function applyPreset(api, name) {
    var S = api.state;
    if (!PRESETS[name]) { S.preset = "custom"; draw(api); narrateLater(api); return; }
    S.preset = name;
    S.p = copyOf(PRESETS[name]);
    syncControls(S);
    draw(api);
    narrateLater(api);
  }

  function setRange(api, r, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 0 && k < r.list.length)) return;
    S.p[r.key] = r.list[k];
    toCustom(S);
    draw(api);
    narrateLater(api);
  }

  function setCap(api, v) {
    var S = api.state, o = pick(CAPS, v);
    if (!o) return;
    S.p.cap = o.value;
    toCustom(S);
    draw(api);
    narrateLater(api);
  }

  function setPlan(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 0 && k < PLANS.length)) return;
    S.p.plan = PLANS[k];
    draw(api);
    narrateLater(api);
  }

  function setMistake(api, v) {
    var S = api.state, o = pick(MISTAKE_OPTS, v);
    if (!o) return;
    S.mistake = o.value;
    draw(api);
    narrateLater(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s2e08", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.preset = "coldharbour";
      S.p = copyOf(PRESETS.coldharbour);
      S.mistake = "none";
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.preset = api.control.select("preset", "Start from", PRESET_OPTS, "coldharbour", function (v) { applyPreset(api, v); });
      S.ctl.mistake = api.control.select("mistake", "Make a mistake on purpose", MISTAKE_OPTS, "none", function (v) { setMistake(api, v); });
      RANGES.forEach(function (r) {
        S.ctl[r.key] = api.control.range(r.key, r.label, 0, r.list.length - 1, 1, r.list.indexOf(S.p[r.key]),
          function (v) { setRange(api, r, v); },
          { format: function (v) { var k = Math.round(Number(v)); return k >= 0 && k < r.list.length ? r.show(r.list[k]) : ""; } });
      });
      S.ctl.cap = api.control.select("cap", "Capacity per server (teaching model)", CAPS, S.p.cap, function (v) { setCap(api, v); });
      S.ctl.plan = api.control.range("plan", "Servers you plan to run (Coldharbour: lines)", 0, PLANS.length - 1, 1, PLANS.indexOf(S.p.plan),
        function (v) { setPlan(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return k >= 0 && k < PLANS.length ? fmtInt(PLANS[k]) : ""; } });
      S.ctl.reset = api.control.button("reset", "Reset to Coldharbour's night", function () { api.reset(); });

      S.stat = {
        avg: api.stat("avg", "average requests a second", ""),
        peak: api.stat("peak", "peak requests a second (busiest hour)", "warn"),
        run: api.stat("run", "servers to run (lines at Coldharbour)", "ok"),
        away: api.stat("away", "turned away in the busiest hour, your plan", "bad"),
        store: api.stat("store", "storage in total", ""),
        out: api.stat("out", "bandwidth out at the peak", ""),
        off: api.stat("off", "how far off, in times (pick a mistake)", "warn")
      };

      api.info("<strong>How to read it.</strong> Pick a starting point, then move any input. The napkin lists every step's " +
        "arithmetic, top to bottom. <em>Your plan</em> checks a number of servers, or lines, against the true peak. " +
        "<em>Make a mistake on purpose</em> shows the wrong napkin beside the right one and how far apart they land. " +
        "Capacities are teaching-model values; servers to run keeps them at most 80% busy at the peak.");

      draw(api);
      api.log("02:00:00 at Coldharbour Cars. Every line is busy and 3,600 ring-backs are waiting. Bronagh's night is loaded: " +
        "14,400 calls in 8 hours, a peak factor of 3, and the 60 lines she rented.", "bad");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function has(text, part) { return String(text).indexOf(part) >= 0; }
      function napkin() { return napkinLines(st()).join("\n"); }
      var c, r, ok, i;

      // 1. The start: Coldharbour's night with the 60 lines Bronagh rented.
      await t.run(1);
      t.expect(st().preset === "coldharbour" && st().mistake === "none" && st().p.plan === 60 &&
        t.stat("avg") === 0.5 && t.stat("peak") === 1.5 && t.stat("run") === 225 && t.stat("away") === "3,600" &&
        t.stat("off") === "-" && t.stat("store") === "420 GB" && t.stat("out") === "0 bps" &&
        has(t.logText(), "3,600 ring-backs are waiting"),
        "start: Coldharbour's night averages 0.5 calls a second and peaks at 1.5; 225 lines to run; the 60 she rented leave 3,600 for ring-back in the hour after one");

      // 2. Every story number, from the model.
      c = calc(PRESETS.coldharbour, "none");
      t.expect(c.perDay === STORY.calls && c.liveSec === 28800 && STORY.hours * HOUR === 28800 && c.avg === 0.5 &&
        STORY.calls / STORY.hours === 1800 && c.avg * HOUR === 1800 && HOUR / STORY.hold === 30 && 1800 / 30 === STORY.napkinLines &&
        c.peak === 1.5 && c.peak * HOUR === STORY.peakHourCalls && STORY.peakHourCalls / 30 === 180 && c.busy === 180 &&
        c.peak * STORY.hold === 180 && c.run === 225 && 180 * 100 / 80 === 225 &&
        STORY.napkinLines * HOUR / STORY.hold === STORY.gotALine && STORY.peakHourCalls - STORY.gotALine === STORY.ringBack &&
        STORY.recordSeconds * STORY.recordBitsPerSec / 8 === 40000 && PRESETS.coldharbour.size === 40000 &&
        STORY.recordBitsPerSec / 8 === 8000 && STORY.recordSeconds * STORY.recordBitsPerSec / 1000 === 320 &&
        PRESETS.coldharbour.retain === STORY.retainYears && PRESETS.coldharbour.copies === STORY.copies &&
        PRESETS.coldharbour.users === STORY.calls && PRESETS.coldharbour.hours === STORY.hours && PRESETS.coldharbour.plan === STORY.napkinLines &&
        c.peak / c.avg === 3 && START_CLOCK === 7200,
        "story numbers: 14,400 calls in 8 hours (28,800 s) is 1,800 an hour, 0.5 a second; a 2-minute call means 30 an hour per line, so the napkin's 60; the hour after one's 5,400 is 1.5 a second, 3 times the average, 180 lines busy (5,400 / 30 = 1.5 x 120), 225 at 80%; 60 lines carry 1,800 an hour, so 3,600 go to ring-back; 5 s at 64 kilobits a second is 40 KB, not 320");

      // 3. The napkin panel shows each step's arithmetic.
      t.expect(has(napkin(), "14,400 users " + X + " 1 request each = 14,400 requests a day.") &&
        has(napkin(), "8 " + X + " 3,600 = 28,800 seconds: 14,400 " + DIV + " 28,800 = 0.5 a second, 1 every 2 s.") &&
        has(napkin(), "Busiest hour: 0.5 " + X + " 3 peak factor = 1.5 a second, 5,400 in that hour.") &&
        has(napkin(), "Storage: 14,400 writes " + X + " 40 KB = 576 MB a day; " + X + " 365 = 210 GB a year; " + X + " 1 year " + X + " 2 copies = 420 GB.") &&
        has(napkin(), "in, 1.5 writes a second " + X + " 40 KB = 60 KB/s = 480 kbps") &&
        has(napkin(), "5,400 an hour " + DIV + " 30 an hour per line = 180 busy at the peak. At most 80% busy: 180 " + DIV + " 0.8 = 225, round up: 225 lines to run."),
        "the napkin lists every step: 14,400 a day, 14,400 / 28,800 = 0.5 a second, x 3 = 1.5 and 5,400 in the hour, 576 MB a day to 420 GB, 60 KB/s = 480 kbps in, 5,400 / 30 = 180 busy, 225 to run");

      // 4. The dispatcher's mistake reproduces the napkin's 60 lines and the dashboard's 1,800 and 3,600.
      t.set("mistake", "dispatcher");
      await t.run(1);
      c = calc(PRESETS.coldharbour, "dispatcher");
      t.expect(c.run === 60 && c.busy === 60 && c.avg * HOUR / 30 === 60 && t.stat("run") === 60 && t.stat("off") === 3 &&
        has(mistakeText(st()), "0.5 a second needs 60 lines.") && has(mistakeText(st()), "the napkin is 3 times short, and 3.75 times once you leave headroom (225).") &&
        has(mistakeText(st()), "3,600 in the busiest hour, while 1,800 get through.") &&
        has(napkin(), "1,800 an hour " + DIV + " 30 an hour per line = 60 busy. No headroom (the mistake): round up to 60 lines.") &&
        has(t.logText(), "Mistake: off by 3 times."),
        "the dispatcher's napkin: the average with no peak and no headroom gives 60 lines (1,800 / 30), 3 times short of 180 and 3.75 of 225; 3,600 sent to ring-back while 1,800 get a line");

      // 5. The other units traps on Coldharbour's night.
      t.set("mistake", "wholeday");
      var whole = calc(PRESETS.coldharbour, "wholeday");
      var wholeOk = t.stat("avg") === 0.167 && t.stat("run") === 75 && t.stat("off") === 3 && whole.busy === 60 &&
        has(napkin(), "14,400 " + DIV + " 86,400 = 0.167 a second, 1 every 6 s.");
      t.set("mistake", "hour");
      var hourC = calc(PRESETS.coldharbour, "hour");
      var hourOk = hourC.avg === 4 && hourC.peak === 12 && hourC.busy === 1440 && t.stat("run") === "1,800" && t.stat("off") === 8 &&
        has(mistakeText(st()), "4 a second instead of 0.5, 8 times too many.");
      t.set("mistake", "kib");
      var kibOk = t.stat("store") === "392 GB" && t.stat("off") === 1.07;
      t.set("mistake", "none");
      t.expect(wholeOk && hourOk && kibOk,
        "a whole day's 86,400 s gives 0.167 a second (1 every 6 s), 3 times low, 75 lines; 3,600 alone gives 4 a second, 8 times high, 1,800 lines; KiB for KB shows 420 GB as 392 GB");

      // 6. The four reply options' part 2s: the same night with 225, 120, 180 and 500 lines.
      t.set("plan", PLANS.indexOf(225));
      var p225 = t.stat("away") === 0 && has(planText(st()), "180 of 225 are busy: 80%. 45 sit idle at the busiest moment.");
      t.set("plan", PLANS.indexOf(120));
      var p120 = t.stat("away") === "1,800" && has(planText(st()), "carrying 1 a second, 3,600 an hour.") &&
        has(planText(st()), "0.5 a second find every one busy: 1,800 sent to ring-back in the busiest hour, while 3,600 get through.");
      t.set("plan", PLANS.indexOf(180));
      var p180 = t.stat("away") === 0 && has(planText(st()), "180 of 180 are busy: 100%. Exactly full on the hour's average");
      t.set("plan", PLANS.indexOf(500));
      var p500 = t.stat("away") === 0 && has(planText(st()), "180 of 500 are busy: 36%. 320 sit idle at the busiest moment.");
      t.set("plan", PLANS.indexOf(60));
      var p60 = t.stat("away") === "3,600" && has(planText(st()), "demand is 300% of what they carry, so all 60 are busy.");
      t.expect(p225 && p120 && p180 && p500 && p60 && st().preset === "coldharbour",
        "plans: 225 lines run 80% busy with 45 spare; 120 leave 1,800 for ring-back; 180 are exactly full; 500 leave 320 idle; 60 leave 3,600");

      // 6b. The log for 180 lines says exactly full, not that they carry the peak.
      t.set("plan", PLANS.indexOf(180));
      await t.run(1);
      t.expect(has(t.logText(), "Your plan, 180, is exactly full at the peak, with no room for a busier minute.") &&
        !has(t.logText(), "Your plan, 180, carries the peak."),
        "plan 180: the log says the lines are exactly full at the peak, with no room for a busier minute");
      t.set("plan", PLANS.indexOf(60));

      // 7. 100 million a day: 1,157.4 a second, shown as about 1,160.
      t.set("preset", "linkday");
      await t.run(1);
      c = calc(PRESETS.linkday, "none");
      t.expect(c.perDay === 100000000 && c.avg === 100000000 / 86400 && Math.round(c.avg * 10) / 10 === 1157.4 &&
        about(c.avg) === "1,160" && t.stat("avg") === "1,160" &&
        has(napkin(), "A day is 86,400 seconds: 100,000,000 " + DIV + " 86,400 = 1,157.4 a second, about 1,160 (1,150 reads, 11.5 writes).") &&
        has(napkin(), "100 reads for every write: 100,000,000 " + DIV + " 101 = 990,099 writes a day, about 990,000, and about 99,000,000 reads."),
        "100,000,000 / 86,400 = 1,157.4 a second, shown as about 1,160; 100 reads for every write splits it into 990,099 writes and 99 million reads a day");

      // 8. Peak = average x peak factor, exactly, at every stop and both presets.
      ok = true;
      ["coldharbour", "linkday"].forEach(function (name) {
        PEAKS.forEach(function (f) {
          var q = copyOf(PRESETS[name]);
          q.peak = f;
          var k = calc(q, "none");
          if (k.peak !== k.avg * f || k.peakR !== k.avgR * f || k.peakW !== k.avgW * f) ok = false;
        });
      });
      t.expect(ok && c.peak === c.avg * 2 && t.stat("peak") === "2,310" && t.stat("run") === 3 &&
        has(napkin(), "2,314.8 a second " + DIV + " 1,000 a second per server = 2.315 busy at the peak. At most 80% busy: 2.315 " + DIV + " 0.8 = 2.894, round up: 3 servers to run."),
        "peak = average x peak factor exactly, for reads, writes and the total, at all 6 factors on both presets; the link shortener peaks at 2,314.8 (about 2,310) and needs 3 servers at 1,000 a second");

      // 9. Storage arithmetic: exact on Coldharbour, to 1e-12 on the link shortener.
      r = calc(PRESETS.coldharbour, "none");
      t.expect(r.storeDay === 576000000 && r.storeYear === 210240000000 && r.storeTotal === 420480000000 &&
        r.storeTotal === STORY.calls * 40000 * 365 * 1 * 2 && fmtBytes(r.storeTotal, false) === "420 GB" &&
        Math.abs(c.storeTotal / (1e8 * 500 * 365 * 5 * 3 / 101) - 1) < 1e-12 && fmtBytes(c.storeDay, false) === "495 MB" &&
        fmtBytes(c.storeYear, false) === "181 GB" && fmtBytes(c.storeTotal, false) === "2.71 TB" && t.stat("store") === "2.71 TB",
        "storage = size x writes x 365 x years x copies: Coldharbour 576,000,000 B a day, 210,240,000,000 a year, 420,480,000,000 in total (420 GB); the link shortener 495 MB a day, 181 GB a year, 2.71 TB for 5 years in 3 copies");

      // 10. Bits and bytes: a factor of 8, and the bits-for-bytes mistake.
      var b8 = c.outBits === c.outBytes * 8 && c.inBits === c.inBytes * 8 && fmtBytes(c.outBytes, false) === "1.15 MB" &&
        fmtBits(c.outBits) === "9.17 Mbps" && fmtBits(c.inBits) === "91.7 kbps" && t.stat("out") === "9.17 Mbps";
      t.set("mistake", "bits");
      var cb = calc(PRESETS.linkday, "bits");
      t.expect(b8 && cb.outBits === cb.outBytes && cb.outBits * 8 === c.outBits && t.stat("out") === "1.15 Mbps" && t.stat("off") === 8 &&
        has(mistakeText(st()), "out at the peak is 1.15 MB/s, which is 9.17 Mbps, not 1.15 Mbps."),
        "bits = bytes x 8: 1.15 MB a second out is 9.17 Mbps; read as bits it shows 1.15 Mbps, 8 times too small");

      // 11. KiB for KB, and forgotten copies, on the link shortener.
      t.set("mistake", "kib");
      var kib = t.stat("store") === "2.47 TB" && t.stat("off") === 1.1 && fmtBytes(c.storeTotal, true) === "2.47 TB" &&
        Math.pow(1024, 4) / Math.pow(1000, 4) === 1.099511627776 && Math.pow(1024, 3) / Math.pow(1000, 3) === 1.073741824 &&
        has(mistakeText(st()), "2.71 TB shows as 2.47 TB: the real size is 9.95% more than the label says.");
      t.set("mistake", "copies");
      var cc = calc(PRESETS.linkday, "copies");
      t.expect(kib && t.stat("store") === "903 GB" && t.stat("off") === 3 && Math.abs(cc.storeTotal * 3 / c.storeTotal - 1) < 1e-12,
        "a TB counted in 1,024s shows 2.71 TB as 2.47, the real size 9.95% more than the label; forgetting 3 copies stores a third, 903 GB");

      // 12. The rounding rules, on purpose.
      t.expect(about(1157.4074074074074) === "1,160" && about(0.5) === "0.5" && about(2314.814814814815) === "2,310" &&
        about(999.6) === "1,000" && about(1 / 6) === "0.167" && about(100000000) === "100,000,000" && about(6750) === "6,750" &&
        about(3.75) === "3.75" && about(1.099511627776) === "1.1" && exact(1157.4074074074074) === "1,157.4" && exact(1.875) === "1.875" &&
        exact(4.166666666666667) === "4.167" && fmtBytes(40000, false) === "40 KB" && fmtBits(480000) === "480 kbps" && fmtInt(14400) === "14,400",
        "rounding: 3 significant figures (1,157.4 shows as 1,160, 2,314.8 as 2,310, 1/6 as 0.167), exact figures to one decimal (1,157.4) or three below 10");

      // 13. Moving an input makes your own numbers; the plan and mistake keep working.
      t.set("mistake", "none");
      t.set("users", USERS.indexOf(1000000));
      await t.run(1);
      var custom = calc(st().p, "none");
      ok = st().preset === "custom" && t.api.state.ctl.preset.value === "custom" && custom.perDay === 10000000 &&
        t.stat("avg") === 116 && has(t.logText(), "Your numbers:");
      t.set("cap", "line");
      var lineCap = st().p.cap === "line" && calc(st().p, "none").busy === custom.peak * 120;
      t.expect(ok && lineCap,
        "moving an input switches to your own numbers: 1 million users x 10 is 10 million a day, 116 a second; picking a phone line's capacity sizes busy lines as peak x 120");

      // 14. Reset returns to Coldharbour's night.
      t.click("reset");
      await t.run(1);
      ok = true;
      for (i = 0; i < RANGES.length; i++) if (st().p[RANGES[i].key] !== PRESETS.coldharbour[RANGES[i].key]) ok = false;
      t.expect(ok && st().preset === "coldharbour" && st().mistake === "none" && st().p.plan === 60 && st().p.cap === "line" &&
        t.stat("run") === 225 && t.stat("away") === "3,600",
        "reset: Coldharbour's night again, 225 lines to run and 3,600 sent to ring-back with the 60 she rented");
    }
  });
})();
