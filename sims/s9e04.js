/* sims/s9e04-v1.0.0.js  (published as sims/s9e04.js)
   Case s9e04 "The Bill": a bill lab for a 24-hour car wash whose bay cameras send every frame
   through three small cloud steps (serverless functions). Each frame is saved to storage once
   (a storage write), read back twice (storage reads) and handed from step to step three times
   (hand-offs). The cloud company prices each per million. A camera firmware update at 00:00 on
   Tuesday 1 September 2026 reset "record when a car is in the bay" to "always record", and
   September's bill, emailed at 00:00 on Thursday 1 October, came to 25,132.03 dollars.
   The learner sets the recording, the design, a budget alarm, a volume discount and the days of
   footage kept, then steps a day at a time (or plays to 30 September) and reads frames, writes,
   reads, hand-offs, each line's cost, the total, the cost per wash, the day the alarm would fire
   and the September frames still kept.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls recording, design, budget alarm, volume discount,
     footage kept; step a day, play to 30 September, reset. Stats: day, frames, storage writes,
     storage reads, hand-offs, cost of each line, the bay programs, discount, total, cost per wash,
     budget alarm, September frames kept, the month. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e04-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Money is kept in whole nano-dollars (a billionth of a dollar) so nothing is rounded until it is
     shown. Story prices per million: write 5 dollars (5,000 nano-dollars each), read 0.40 (400),
     hand-off 25 (25,000). One frame = 1 write + 2 reads + 3 hand-offs = 80,800 nano-dollars,
     80.80 dollars per million frames.
   - Always record: 4 bays x 30 frames a second x 86,400 seconds = 10,368,000 frames a day;
     x 30 days = 311,040,000. Writes 311,040,000 (1,555.20), reads 622,080,000 (248.83), hand-offs
     933,120,000 (23,328.00): 25,132.032 dollars, shown 25,132.03. One day: 837.7344, shown 837.73.
     Two days: 1,675.47.
   - Car in bay: 1,200 washes a month, 40 a day, 3 minutes = 180 seconds x 30 frames = 5,400 frames
     a wash, 216,000 a day, 6,480,000 a month: 32.40 + 5.18 + 486.00 = 523.584, shown 523.58.
     48 times fewer frames than always record.
   - Cost per wash: total / washes so far (40 a day). 25,132.032 / 1,200 = 20.94336, shown 20.94;
     523.584 / 1,200 = 0.43632, shown 0.44.
   - One program per bay (the fix): 12 dollars a month each, 4 bays = 48.00 a month, 1.60 a day; it
     keeps frames in memory and saves 2 photos a wash: 80 a day, 2,400 a month, 2,400 x 5,000 =
     0.012 dollars. Total 48.012, shown 48.01; per wash 0.04001, shown 0.04. The same with either
     recording setting. No reads, no hand-offs.
   - Volume discount 15% off the whole bill: 25,132.032 x 0.85 = 21,362.2272, shown 21,362.23;
     per wash 17.80.
   - Budget alarm: fires on the first day whose spending so far reaches the threshold. Always
     record, 600 dollars: day 1 (837.73), Tuesday 1 September. 5,000: day 6 (5,026.41; day 5 is
     4,188.67), Sunday 6 September. Car in bay, 600: never (523.58 for the month). The fix, 100: never.
   - Footage kept: September frames still in storage at the end of a day = frames a day x the
     smaller of the days played and the days kept. 30 days: 311,040,000; 7 days: 72,576,000. The
     storage space is on a yearly plan and deleting is free, so no dollar figure changes.
   - Takings 19,400 dollars in September (given data), shown beside the bill at the end.
   - Days: 1 September 2026 is a Tuesday; 30 September is a Wednesday.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (money in nano-dollars) ---------- */

  var DAYS = 30;
  var BAYS = 4;
  var FPS = 30;
  var DAY_SEC = 86400;
  var WASHES_A_DAY = 40;            // 1,200 in September
  var WASH_SEC = 180;               // 3 minutes
  var P_WRITE = 5000;               // 5 dollars per million
  var P_READ = 400;                 // 0.40 dollars per million
  var P_HAND = 25000;               // 25 dollars per million
  var PROGRAMS_A_DAY = 1600000000;  // 4 programs x 12 dollars a month / 30 days = 1.60 dollars
  var PHOTOS_A_WASH = 2;
  var TAKINGS = "$19,400";
  var WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  var RECORDS = [
    { value: "always", label: "always record (since the update, as built)" },
    { value: "car", label: "record only when a car is in the bay (before 1 September)" }
  ];
  var DESIGNS = [
    { value: "steps", label: "three steps per frame (as built)" },
    { value: "program", label: "one program per bay, frames in memory, 2 photos a wash" }
  ];
  var ALARMS = [
    { value: "0", label: "none (as built)" },
    { value: "100", label: "$100" },
    { value: "600", label: "$600" },
    { value: "1000", label: "$1,000" },
    { value: "5000", label: "$5,000" }
  ];
  var DISCOUNTS = [
    { value: "0", label: "none (as built)" },
    { value: "15", label: "15% off every line" }
  ];
  var KEPT = [
    { value: "30", label: "30 days (as built)" },
    { value: "14", label: "14 days" },
    { value: "7", label: "7 days" }
  ];

  /* ---------- small helpers ---------- */

  function commas(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) {
      out = "," + s.slice(s.length - 3) + out;
      s = s.slice(0, s.length - 3);
    }
    return s + out;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function money(nano) {
    var cents = Math.round(nano / 10000000);
    return "$" + commas(Math.floor(cents / 100)) + "." + two(cents % 100);
  }
  function dayName(d) { return WEEK[(2 + d - 1) % 7] + " " + d + " September"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function framesADay(C) {
    return C.rec === "always" ? BAYS * FPS * DAY_SEC : WASHES_A_DAY * WASH_SEC * FPS;
  }

  // Everything from 00:00 on 1 September to the end of day d (d = 0 is the opening state).
  function month(C, d) {
    var frames = framesADay(C) * d;
    var washes = WASHES_A_DAY * d;
    var r = { d: d, frames: frames, washes: washes };
    if (C.design === "steps") {
      r.writes = frames;
      r.reads = 2 * frames;
      r.hands = 3 * frames;
      r.programs = 0;
    } else {
      r.writes = PHOTOS_A_WASH * washes;
      r.reads = 0;
      r.hands = 0;
      r.programs = PROGRAMS_A_DAY * d;
    }
    r.wCost = r.writes * P_WRITE;
    r.rCost = r.reads * P_READ;
    r.hCost = r.hands * P_HAND;
    r.gross = r.wCost + r.rCost + r.hCost + r.programs;
    var pct = parseInt(C.disc, 10);
    r.net = r.gross * (100 - pct) / 100;
    r.off = r.gross - r.net;
    var keptDays = Math.min(d, parseInt(C.kept, 10));
    r.kept = C.design === "steps" ? framesADay(C) * keptDays : PHOTOS_A_WASH * WASHES_A_DAY * keptDays;
    return r;
  }

  function alarmDay(C) {
    var thr = parseInt(C.alarm, 10);
    if (!thr) return 0;
    for (var d = 1; d <= DAYS; d++) if (month(C, d).net >= thr * 1000000000) return d;
    return -1;
  }
  function alarmText(C) {
    var a = alarmDay(C);
    return a === 0 ? "none set" : a < 0 ? "never" : dayName(a);
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
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["line of the bill", "count", "price", "cost so far"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, sum: sum };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var r = month(C, S.day);
    ui.head.textContent = (S.day === 0 ? "Tuesday 1 September 2026, 00:00" : "End of " + dayName(S.day) + " 2026") +
      ". Recording: " + pick(RECORDS, C.rec).label + ". Design: " + pick(DESIGNS, C.design).label + ".";
    clear(ui.body);
    [
      ["storage writes", commas(r.writes), "$5.00 per million", money(r.wCost)],
      ["storage reads", commas(r.reads), "$0.40 per million", money(r.rCost)],
      ["hand-offs", commas(r.hands), "$25.00 per million", money(r.hCost)],
      ["bay programs", C.design === "program" ? "4" : "0", "$12 a month each", money(r.programs)]
    ].forEach(function (row) {
      var tr = ui.el("tr");
      row.forEach(function (v) { tr.appendChild(ui.el("td", "", v)); });
      ui.body.appendChild(tr);
    });
    ui.sum.textContent = S.day === 0 ? "It is 00:00 on Tuesday 1 September. Nothing has been counted yet." :
      "So far: " + commas(r.frames) + " frames from the cameras, " + r.washes + " washes, " + money(r.net) + " on the bill.";
    S.stat.day(S.day === 0 ? "Tuesday 1 September, 00:00" : "end of " + dayName(S.day));
    S.stat.frames(commas(r.frames));
    S.stat.writes(commas(r.writes));
    S.stat.reads(commas(r.reads));
    S.stat.hands(commas(r.hands));
    S.stat.wCost(money(r.wCost));
    S.stat.rCost(money(r.rCost));
    S.stat.hCost(money(r.hCost));
    S.stat.pCost(money(r.programs));
    S.stat.off(C.disc === "0" ? "none" : "-" + money(r.off));
    S.stat.total(money(r.net));
    S.stat.perWash(r.washes ? money(r.net / r.washes) : "$0.00");
    S.stat.alarm(alarmText(C));
    S.stat.kept(commas(r.kept));
    S.stat.outcome(S.day < DAYS ? "not closed" : "bill " + money(r.net) + " against takings of " + TAKINGS);
  }

  function dayLine(C, d) {
    var r = month(C, d);
    var one = month(C, 1);
    return dayName(d) + ": " + commas(one.frames) + " frames, " + commas(one.writes) + " writes, " +
      commas(one.hands) + " hand-offs; spending so far " + money(r.net) + ".";
  }

  function advance(api, to, quiet) {
    var S = api.state;
    var from = S.day;
    if (!quiet) api.log(dayLine(S.C, to), "");
    var a = alarmDay(S.C);
    if (a > from && a <= to) {
      api.log("Budget alarm at " + money(parseInt(S.C.alarm, 10) * 1000000000) + ": spending passed it on " + dayName(a) +
        " (" + money(month(S.C, a).net) + " so far). Email sent.", "warn");
    }
    S.day = to;
    if (to === DAYS) {
      var r = month(S.C, DAYS);
      api.log("00:00 Thursday 1 October: September's bill closes at " + money(r.net) + " for 1,200 washes, " +
        money(r.net / r.washes) + " a wash, against takings of " + TAKINGS + ".", r.net > 1940000000000 ? "bad" : "ok");
    }
  }

  function step(api) {
    var S = api.state;
    if (S.day >= DAYS) {
      api.log("September is closed. Change a setting or reset to replay it.", "");
      return;
    }
    advance(api, S.day + 1, false);
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.day >= DAYS) {
      api.log("September is closed. Change a setting or reset to replay it.", "");
      return;
    }
    var from = S.day;
    api.log("Played from " + (from === 0 ? "00:00 on Tuesday 1 September" : "the end of " + dayName(from)) +
      " to the end of " + dayName(DAYS) + ".", "");
    advance(api, DAYS, true);
    draw(api);
  }

  function change(api, what) {
    api.state.day = 0;
    api.log(what + " Back to 00:00 on Tuesday 1 September.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { rec: "always", design: "steps", alarm: "0", disc: "0", kept: "30" };
      S.day = 0;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("rec", "recording", RECORDS, "rec");
      sel("design", "design", DESIGNS, "design");
      sel("alarm", "budget alarm at", ALARMS, "alarm");
      sel("disc", "volume discount", DISCOUNTS, "disc");
      sel("kept", "footage kept", KEPT, "kept");
      api.control.button("step", "step a day", function () { step(api); });
      api.control.button("play", "play to 30 September", function () { play(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        day: api.stat("day", "replayed to", ""),
        frames: api.stat("frames", "frames from the cameras", ""),
        writes: api.stat("writes", "storage writes", ""),
        reads: api.stat("reads", "storage reads", ""),
        hands: api.stat("hands", "hand-offs", ""),
        wCost: api.stat("wCost", "storage writes, cost", ""),
        rCost: api.stat("rCost", "storage reads, cost", ""),
        hCost: api.stat("hCost", "hand-offs, cost", "bad"),
        pCost: api.stat("pCost", "bay programs, cost", ""),
        off: api.stat("off", "volume discount", ""),
        total: api.stat("total", "bill so far", "bad"),
        perWash: api.stat("perWash", "cost per wash", "warn"),
        alarm: api.stat("alarm", "budget alarm would fire", "warn"),
        kept: api.stat("kept", "September frames or photos still kept", ""),
        outcome: api.stat("outcome", "the month", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one line of the cloud bill: how many times it happened so far this month, its price, and what it has cost. With three steps, each frame is 1 storage write, 2 storage reads and 3 hand-offs. With one program per bay, frames stay in memory and only 2 photos a wash are written; the four programs cost $12 a month each. \"cost per wash\" is the bill so far divided by the washes so far, 40 a day. Storage space is on a yearly plan, so the days of footage kept change what is stored, not the bill.");

      api.log("Tuesday 1 September 2026, 00:00, as built: the cameras always record, three steps per frame, no budget alarm, no discount, footage kept 30 days.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      var BUILT = { rec: "always", design: "steps", alarm: "0", disc: "0", kept: "30" };
      function fresh(set) { as(BUILT); as(set || {}); t.click("play"); }

      // 1. Opening state: 00:00 on Tuesday 1 September, nothing counted.
      t.expect(t.stat("day") === "Tuesday 1 September, 00:00" && t.stat("frames") === 0 && t.stat("total") === "$0.00" &&
        t.stat("outcome") === "not closed" && has("Tuesday 1 September 2026, 00:00, as built"),
        "Opens at 00:00 on Tuesday 1 September 2026 with nothing counted");

      // 2. One day as built: 10,368,000 frames, 837.73 dollars.
      t.click("step");
      t.expect(t.stat("day") === "end of Tuesday 1 September" && t.stat("frames") === "10,368,000" &&
        t.stat("hands") === "31,104,000" && t.stat("hCost") === "$777.60" && t.stat("total") === "$837.73" &&
        has("Tuesday 1 September: 10,368,000 frames, 10,368,000 writes, 31,104,000 hand-offs; spending so far $837.73."),
        "Day 1 as built: 10,368,000 frames and 837.73 dollars");

      // 3. Two days as built: 1,675.47 dollars.
      t.click("step");
      t.expect(t.stat("total") === "$1,675.47", "Two days of always record cost 1,675.47 dollars");

      // 4. As built, played to 30 September: the bill.
      fresh({});
      t.expect(t.stat("frames") === "311,040,000" && t.stat("writes") === "311,040,000" && t.stat("reads") === "622,080,000" &&
        t.stat("hands") === "933,120,000" && t.stat("wCost") === "$1,555.20" && t.stat("rCost") === "$248.83" &&
        t.stat("hCost") === "$23,328.00" && t.stat("total") === "$25,132.03" && t.stat("perWash") === "$20.94" &&
        t.stat("alarm") === "none set" && t.stat("outcome") === "bill $25,132.03 against takings of $19,400" &&
        has("September's bill closes at $25,132.03 for 1,200 washes, $20.94 a wash, against takings of $19,400."),
        "As built: 311,040,000 frames, 25,132.03 dollars, 20.94 dollars a wash");

      // 5. Why never before: record only when a car is in the bay.
      fresh({ rec: "car" });
      t.expect(t.stat("frames") === "6,480,000" && t.stat("total") === "$523.58" && t.stat("perWash") === "$0.44" &&
        t.stat("wCost") === "$32.40" && t.stat("rCost") === "$5.18" && t.stat("hCost") === "$486.00",
        "Car in bay: 6,480,000 frames, 523.58 dollars, 0.44 dollars a wash");

      // 6. Option 1 (ok): one program per bay, the same with either recording setting.
      fresh({ design: "program" });
      var always = t.stat("writes") === "2,400" && t.stat("pCost") === "$48.00" && t.stat("wCost") === "$0.01" &&
        t.stat("hands") === 0 && t.stat("total") === "$48.01" && t.stat("perWash") === "$0.04";
      fresh({ design: "program", rec: "car" });
      t.expect(always && t.stat("writes") === "2,400" && t.stat("total") === "$48.01" && t.stat("perWash") === "$0.04",
        "One program per bay: 2,400 photos, 48.01 dollars, 0.04 dollars a wash, whatever the cameras record");

      // 7. Option 0: a 15% volume discount.
      fresh({ disc: "15" });
      t.expect(t.stat("total") === "$21,362.23" && t.stat("perWash") === "$17.80" && t.stat("frames") === "311,040,000",
        "15% discount: 21,362.23 dollars, still above the 19,400 dollars the wash took");

      // 8. Option 3: footage kept 7 days. Fewer frames kept, the same bill to the cent.
      fresh({});
      var built = t.stat("total");
      var kept30 = t.stat("kept");
      fresh({ kept: "7" });
      t.expect(built === "$25,132.03" && kept30 === "311,040,000" && t.stat("kept") === "72,576,000" && t.stat("total") === built,
        "Footage kept 7 days: 72,576,000 frames kept instead of 311,040,000, and the bill is unchanged");

      // 9. Budget alarm with always record: 600 fires on day 1, 5,000 on day 6.
      fresh({ alarm: "600" });
      var at600 = t.stat("alarm") === "Tuesday 1 September" &&
        has("Budget alarm at $600.00: spending passed it on Tuesday 1 September ($837.73 so far). Email sent.");
      fresh({ alarm: "5000" });
      t.expect(at600 && t.stat("alarm") === "Sunday 6 September", "Always record: an alarm at 600 fires on 1 September, at 5,000 on 6 September");

      // 10. Option 2 (warn): car in bay and an alarm at 600. Back to 523.58, the alarm never fires.
      fresh({ rec: "car", alarm: "600" });
      t.expect(t.stat("total") === "$523.58" && t.stat("perWash") === "$0.44" && t.stat("alarm") === "never",
        "Car in bay with an alarm at 600: 523.58 dollars and the alarm never fires");

      // 11. The fix with an alarm at 100 never fires, and a step past the month is refused.
      fresh({ design: "program", alarm: "100" });
      var quiet = t.stat("alarm") === "never";
      t.click("step");
      t.expect(quiet && has("September is closed."), "The fix stays under a 100-dollar alarm, and nothing plays past 30 September");
    }
  });
})();
