/* sims/s9e11-v1.0.0.js  (published as sims/s9e11.js)
   Case s9e11 "Build or Buy": a maintenance lab for a 24-lane bowling alley on its late league night,
   Saturday 31 October 2026, from 22:00 to 23:00 local time in one-minute steps. Each lane's
   pinsetter and score screen run only while the lane controller's paid check gets a "paid" answer
   from the booking database, a managed database the cloud provider runs. The learner sets the
   maintenance window, the season (summer or winter clocks), a standby copy in a second zone, the
   provider's updates "on" or "off", where the provider's notices go, the lane rule on "cannot
   check", the length of the update, and self-hosting, then plays the hour a minute at a time.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls window (assigned by our provider Saturday 22:30 UTC,
     another provider's own pick Saturday 22:10 UTC, chosen Tuesday 10:00 UTC), season (winter,
     summer), standby copy in a second zone (off, on), provider updates (on, off), notices to (the
     founder's old work address, the duty managers' shared inbox), lane rule on "cannot check"
     (unpaid, keep the last confirmed booking up to 15 minutes), update length (9, 20 minutes),
     run it on our own server; buttons Next minute, Play to 23:00, Reset. Stats: time, lanes lit,
     database, minutes dark, lane-minutes marked unpaid, minutes kept on the last booking, update
     starts, notice seen by, chores the alley owns, what stays ours. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e11-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - The alley (the post): 24 lanes, open noon to 23:00 every day of the year. Tonight, Saturday
     31 October 2026, all 24 lanes are booked and paid for the league until 23:00.
   - The paid check (the post): the lane controller asks the booking database once a minute, on the
     minute, whether each lane is paid. "Paid" keeps the lane on. "Unpaid", or no answer at all,
     marks the lane unpaid and switches its pinsetter and screen off. The sim plays the checks from
     22:00 to 22:59; the alley closes at 23:00.
   - The clocks (the post): they went back on Sunday 25 October 2026, so tonight local time = UTC.
     In summer, local time = UTC + 1 hour.
   - The window (the post, from the provider's page): nobody chose one, so the provider assigned
     Saturday 22:30 UTC, a 30-minute window picked at random from its 22:00 to 06:00 UTC block for
     the London region. The required update starts 1 minute into the window (given data): 22:31 UTC.
     Winter: 22:31 local. Summer: 23:31 local, after closing at 23:00.
   - The update (the post): a required operating-system update, apply date Monday 26 October 2026,
     so tonight's window is the first after it. It takes the single copy offline for 9 minutes:
     offline from 22:31:00, back at 22:40:00 in time for the 22:40 check. Checks at 22:31 to 22:39
     fail: 9 minutes dark, 24 lanes x 9 = 216 lane-minutes marked unpaid. The two earlier required
     updates, Saturday 20 September 2025 and Saturday 13 June 2026, ran at 22:31 UTC, which was
     23:31 local in summer.
   - A 20-minute update (sim.lede, given data for the limit of the keep-last rule): offline 22:31
     to 22:51. With keep-last, lanes stay on until 22:45 (15 minutes after the 22:30 answer), dark
     22:46 to 22:50: 5 minutes, 120 lane-minutes; kept 15 minutes.
   - Keep the last confirmed booking (the ok option): on no answer, a lane that had "paid" within
     the last 15 minutes stays on. Tonight: last "paid" at 22:30, no answer 22:31 to 22:39 (1 to
     9 minutes later), so 9 minutes kept, 0 dark.
   - A standby copy in a second zone (sim.lede, the order from the provider's page): the standby
     is updated first while the main copy answers (22:31 to 22:40), then the provider switches over
     to it, at 22:40:10 for 40 seconds (given data; the page says such a failover typically lasts
     less than a minute), between the 22:40 and 22:41 checks, then the old main copy is updated
     for 9 minutes (from 22:40:50; the checks at 22:41 to 22:49 see it). Every check is answered:
     0 minutes dark.
   - Another provider (option 2, given data): it also assigns a window when none is chosen; in this
     story its random pick is Saturday 22:10 UTC, so the update runs 22:11 to 22:20 local in
     winter, 9 minutes dark, 216 lane-minutes; 23:11 local in summer.
   - Chosen window (the ok option): Tuesday 10:00 UTC, update at 10:01 UTC: 10:01 local in winter,
     11:01 local in summer, both before the noon opening. Nothing runs on Saturday night.
   - Updates "off" (option 0): optional updates stop; this one is required and past its apply date,
     so it runs anyway.
   - Notices (the post): the notice for tonight's update was sent on Tuesday 29 September 2026 to
     the founder's old work address, which nobody reads.
   - Chores (the post and option 1): managed, the alley still owns 3: its settings, its notices,
     its exit plan. Self-hosted on a back-office server, 5: settings, updates, backups, failover,
     the 3 AM disk alarm.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var LANES = 24;
  var FIRST = 22 * 60;          // first check, 22:00 local, in minutes after midnight
  var CHECKS = 60;              // 22:00 to 22:59; closing at 23:00
  var CLOSE = 23 * 60;
  var KEEP = 15;                // keep the last confirmed booking up to 15 minutes
  var NIGHT = "Saturday 31 October 2026";
  var APPLY = "Monday 26 October 2026";

  var WINDOWS = [
    { value: "ours", label: "assigned by our provider: Saturday 22:30 UTC (as built)", day: "Sat", utc: 22 * 60 + 30 },
    { value: "other", label: "another provider's own pick: Saturday 22:10 UTC", day: "Sat", utc: 22 * 60 + 10 },
    { value: "chosen", label: "chosen by us: Tuesday 10:00 UTC", day: "Tue", utc: 10 * 60 }
  ];
  var SEASONS = [
    { value: "winter", label: "winter, clocks back: local time = UTC (tonight)", off: 0 },
    { value: "summer", label: "summer: local time = UTC + 1 hour", off: 60 }
  ];
  var UPDATES = [
    { value: "on", label: "on (as built)" },
    { value: "off", label: "\"off\"" }
  ];
  var NOTICES = [
    { value: "old", label: "the founder's old work address (as built)" },
    { value: "shared", label: "the duty managers' shared inbox" }
  ];
  var RULES = [
    { value: "unpaid", label: "no answer counts as unpaid (as built)" },
    { value: "keep", label: "keep the last confirmed booking up to 15 minutes" }
  ];
  var LENGTHS = [
    { value: "9", label: "9 minutes (tonight)" },
    { value: "20", label: "20 minutes (a longer one)" }
  ];
  var CHORES_MANAGED = ["its settings", "its notices", "our exit plan"];
  var CHORES_SELF = ["settings", "updates", "backups", "failover", "the 3 AM disk alarm"];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(min) {
    var m = ((min % 1440) + 1440) % 1440;
    return two(Math.floor(m / 60)) + ":" + two(m % 60);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // What the booking database does at each of the 60 checks, 22:00 to 22:59 local.
  function plan(C) {
    var W = pick(WINDOWS, C.window) || WINDOWS[0];
    var off = (pick(SEASONS, C.season) || SEASONS[0]).off;
    var len = Number(C.len);
    var R = { mins: [], start: null, when: "", self: !!C.self };
    var i;
    if (C.self) {
      for (i = 0; i < CHECKS; i++) R.mins.push({ answer: true, db: "our own server in the back office, answering" });
      R.when = "no provider window: we update our own server when we choose";
      return R;
    }
    var startUtc = W.utc + 1;
    var s = startUtc + off;
    if (W.day === "Sat") {
      R.start = s;
      R.when = "Sat " + hm(s) + " local (" + hm(startUtc) + " UTC)" + (s >= CLOSE ? ", after closing" : "");
    } else {
      R.when = "Tue " + hm(startUtc) + " UTC (" + hm(s) + " local), before the noon opening";
    }
    var base = C.standby ? "two copies in two zones, answering" : "one copy, answering";
    for (i = 0; i < CHECKS; i++) {
      var t = FIRST + i;
      var m = { answer: true, db: base };
      if (R.start !== null) {
        if (!C.standby) {
          if (t >= s && t < s + len) m = { answer: false, db: "offline for the required update" };
        } else if (t >= s && t < s + len) {
          m = { answer: true, db: "standby being updated; main copy answering" };
        } else if (t === s + len) {
          m = { answer: true, db: "switched over at " + hm(t) + ":10 for 40 s, between two checks; standby answering" };
        } else if (t > s + len && t <= s + 2 * len) {
          m = { answer: true, db: "old main copy being updated; the new main copy answering" };
        }
      }
      R.mins.push(m);
    }
    return R;
  }

  function chores(C) { return C.self ? CHORES_SELF : CHORES_MANAGED; }

  function noticeText(C) {
    if (C.self) return "no provider notices: we watch for updates ourselves";
    return C.notice === "shared" ? "the duty managers' shared inbox, Tuesday 29 September 2026"
      : "nobody: sent to the founder's old work address";
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 96;
  var CW = 9;

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
    function el(tag, style) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 130", width: "100%", "class": "dg", role: "img",
      "aria-label": "One square per minute from 22:00 to 22:59 local. Top row, the booking database: green answering, grey not answering, amber a copy being updated. Bottom row, the 24 lanes: green lit on a paid answer, amber kept on the last confirmed booking, red dark and marked unpaid."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, sum: sum };
  }

  function drawStrip(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    txt(doc, g, X0 - 8, 40, "database", "dg-axis", "end");
    txt(doc, g, X0 - 8, 76, "24 lanes", "dg-axis", "end");
    for (var i = 0; i < CHECKS; i++) {
      var x = X0 + i * CW;
      var p = S.plan.mins[i];
      var dbFill = !p.answer ? "var(--faint)" : (p.db.indexOf("updated") >= 0 || p.db.indexOf("switched") >= 0 ? "var(--amber)" : "var(--green)");
      var laneFill = "var(--faint)";
      if (i < S.i) laneFill = S.hist[i] === "lit" ? "var(--green)" : (S.hist[i] === "kept" ? "var(--amber)" : "var(--red)");
      mk(doc, "rect", { x: x, y: 28, width: CW - 2, height: 16, style: "fill:" + dbFill + ";opacity:" + (i < S.i ? ".9" : ".35") }, g);
      mk(doc, "rect", { x: x, y: 64, width: CW - 2, height: 16, style: "fill:" + laneFill + ";opacity:.85" }, g);
    }
    [0, 10, 20, 30, 40, 50].forEach(function (m) { txt(doc, g, X0 + m * CW, 104, hm(FIRST + m), "dg-axis", "middle"); });
    txt(doc, g, X0 + CHECKS * CW, 104, "23:00", "dg-axis", "middle");
    txt(doc, g, 8, 14, NIGHT + ", local time, one square a minute", "dg-axis", "start");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Window: " + pick(WINDOWS, C.window).label + "; " + pick(SEASONS, C.season).label +
      "; standby copy " + (C.standby ? "on" : "off") + "; updates " + C.updates + "; lane rule: " + pick(RULES, C.rule).label +
      "; update length " + C.len + " minutes" + (C.self ? "; on our own server (the window, standby, updates and notice settings don't apply)." : ".");
    drawStrip(S);
    var ch = chores(C);
    S.stat.time(S.i === 0 ? "22:00 (not played)" : (S.i >= CHECKS ? "23:00 closing" : hm(FIRST + S.i - 1)));
    S.stat.lit(S.on ? LANES : 0);
    S.stat.db(S.i === 0 ? S.plan.mins[0].db : S.plan.mins[S.i - 1].db);
    S.stat.dark(S.dark);
    S.stat.unpaid(S.unpaid);
    S.stat.kept(S.kept);
    S.stat.update(S.plan.when);
    S.stat.notice(noticeText(C));
    S.stat.chores(ch.length);
    S.stat.ours(ch.join(", "));
    S.ui.sum.textContent = S.i === 0
      ? "Not played yet: it is 22:00 on " + NIGHT + ". All 24 lanes are booked and paid for the league until 23:00."
      : "Checks so far: " + S.i + " of 60. Minutes dark " + S.dark + ", lane-minutes marked unpaid " + S.unpaid + ", minutes kept on the last booking " + S.kept + ".";
  }

  /* ---------- one check ---------- */

  function check(api) {
    var S = api.state;
    var C = S.C;
    var i = S.i;
    var p = S.plan.mins[i];
    var t = hm(FIRST + i);
    var prevDb = i === 0 ? null : S.plan.mins[i - 1].db;
    if (prevDb !== null && p.db !== prevDb) api.log(t + " database: " + p.db + ".", p.answer ? (p.db.indexOf("answering") >= 0 && p.db.indexOf("updated") < 0 && p.db.indexOf("switched") < 0 ? "ok" : "warn") : "bad");
    if (p.answer) {
      if (!S.on) api.log(t + " paid check: the database answers \"paid\" for all 24 lanes. Pinsetters and screens back on after " + S.run + " minutes dark.", "ok");
      else if (S.hist[i - 1] === "kept") api.log(t + " paid check: the database answers \"paid\" again. Lanes were kept on the last booking for " + S.run + " minutes; none went dark.", "ok");
      S.on = true;
      S.last = i;
      S.run = 0;
      S.hist.push("lit");
    } else if (C.rule === "keep" && i - S.last <= KEEP) {
      if (S.hist[i - 1] !== "kept") api.log(t + " paid check: no answer. Lanes keep the last confirmed booking, from " + hm(FIRST + S.last) + ", for up to 15 minutes.", "warn");
      S.kept += 1;
      S.run += 1;
      S.hist.push("kept");
    } else {
      if (S.on) {
        S.run = S.hist[i - 1] === "kept" ? 0 : S.run;
        api.log(t + " paid check: no answer" + (C.rule === "keep" ? ", " + (i - S.last) + " minutes after the last confirmed booking" : "") +
          ". The controller marks all 24 lanes unpaid and switches their pinsetters and screens off.", "bad");
      }
      S.on = false;
      S.dark += 1;
      S.unpaid += LANES;
      S.run += 1;
      S.hist.push("dark");
    }
    S.i += 1;
    if (S.i === CHECKS) {
      api.log("23:00 closing. Tonight: minutes dark " + S.dark + ", lane-minutes marked unpaid " + S.unpaid + ", minutes kept on the last booking " + S.kept + ".", S.dark ? "bad" : "ok");
    }
  }

  function restart(api, what) {
    var S = api.state;
    S.plan = plan(S.C);
    S.i = 0;
    S.on = true;
    S.last = -1;
    S.run = 0;
    S.dark = 0;
    S.unpaid = 0;
    S.kept = 0;
    S.hist = [];
    if (what) api.log(what + " Set back to 22:00. The update starts: " + S.plan.when + ".", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { window: "ours", season: "winter", standby: false, updates: "on", notice: "old", rule: "unpaid", len: "9", self: false };
      S.ui = buildWidget(api);

      function sel(id, label, list, key, extra) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          restart(api, label + ": " + o.label + "." + (extra ? extra(S.C) : ""));
        });
      }
      function tog(id, label, key, extra) {
        api.control.toggle(id, label, S.C[key], function (on) {
          S.C[key] = !!on;
          restart(api, label + ": " + (on ? "on." : "off.") + (extra ? extra(S.C) : ""));
        });
      }
      sel("window", "Maintenance window", WINDOWS, "window");
      sel("season", "Season", SEASONS, "season");
      tog("standby", "Standby copy in a second zone", "standby");
      sel("updates", "Provider updates", UPDATES, "updates", function (C) {
        return C.updates === "off" ? " Optional updates stop, but tonight's is required and its apply date, " + APPLY + ", has passed: it still runs in the next window." : "";
      });
      sel("notice", "Provider notices go to", NOTICES, "notice");
      sel("rule", "Lane rule when the check gets no answer", RULES, "rule");
      sel("len", "Length of the update", LENGTHS, "len");
      tog("self", "Run it on our own server in the back office", "self", function (C) {
        return C.self ? " No provider window; the alley now owns updates, backups, failover and the 3 AM disk alarm." : "";
      });
      api.control.button("step", "Next minute", function () {
        if (S.i >= CHECKS) { api.log("The hour has played out. Change a setting or reset to play it again.", ""); return; }
        check(api);
        draw(api);
      });
      api.control.button("play", "Play to 23:00", function () {
        if (S.i >= CHECKS) { api.log("The hour has played out. Change a setting or reset to play it again.", ""); return; }
        while (S.i < CHECKS) check(api);
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "last paid check", ""),
        lit: api.stat("lit", "lanes lit", "ok"),
        db: api.stat("db", "booking database", ""),
        dark: api.stat("dark", "minutes dark", "bad"),
        unpaid: api.stat("unpaid", "lane-minutes marked unpaid", "bad"),
        kept: api.stat("kept", "minutes kept on the last booking", "warn"),
        update: api.stat("update", "the update starts", "warn"),
        notice: api.stat("notice", "notice seen by", ""),
        chores: api.stat("chores", "chores the alley owns", ""),
        ours: api.stat("ours", "what stays ours", "")
      };

      api.info("<strong>How to read it.</strong> Each square is one minute. Once a minute, on the minute, the lane controller asks the booking database whether each lane is paid. Top row: the database (green answering, grey not answering, amber a copy being updated). Bottom row: the 24 lanes (green lit on a paid answer, amber kept on the last confirmed booking, red dark and marked unpaid). Times are local; the provider's window is set in UTC.");

      restart(api, "");
      api.log(NIGHT + ", 22:00 local. League night: all 24 lanes booked and paid until 23:00. The booking database runs as built: one copy, the provider's assigned window, notices to the founder's old work address.", "warn");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { window: "ours", season: "winter", standby: false, updates: "on", notice: "old", rule: "unpaid", len: "9", self: false };
      function as(set) {
        Object.keys(BUILT).forEach(function (k) { t.set(k, set && Object.prototype.hasOwnProperty.call(set, k) ? set[k] : BUILT[k]); });
      }
      function steps(n) { for (var k = 0; k < n; k++) t.click("step"); }

      // 1. Opening state: 22:00, before the first check.
      t.expect(t.stat("time") === "22:00 (not played)" && t.stat("lit") === 24 && t.stat("dark") === 0 && t.stat("unpaid") === 0 &&
        t.stat("db") === "one copy, answering" && t.stat("update") === "Sat 22:31 local (22:31 UTC)" && t.stat("chores") === 3,
        "Opens at 22:00 with 24 lanes lit, one copy answering, and the update due at 22:31 local");

      // 2. Step to 22:30: still lit. One more step, 22:31: all 24 dark.
      steps(31);
      var at2230 = t.stat("time") === "22:30" && t.stat("lit") === 24;
      begin();
      t.click("step");
      t.expect(at2230 && t.stat("time") === "22:31" && t.stat("lit") === 0 && t.stat("db") === "offline for the required update" &&
        has("22:31 paid check: no answer. The controller marks all 24 lanes unpaid and switches their pinsetters and screens off."),
        "Lit at 22:30; at 22:31 the single copy is offline and all 24 lanes go dark, marked unpaid");

      // 3. As built, to 23:00: dark 22:31 to 22:40, 9 minutes, 216 lane-minutes unpaid.
      begin();
      t.click("play");
      t.expect(t.stat("time") === "23:00 closing" && t.stat("dark") === 9 && t.stat("unpaid") === 216 && t.stat("lit") === 24 &&
        has("22:40 paid check: the database answers \"paid\" for all 24 lanes. Pinsetters and screens back on after 9 minutes dark.") &&
        t.stat("notice") === "nobody: sent to the founder's old work address",
        "As built: dark 22:31 to 22:40, 9 minutes, 24 x 9 = 216 lane-minutes marked unpaid; nobody saw the notice");

      // 4. Summer: the same 22:31 UTC is 23:31 local, after closing.
      as({ season: "summer" });
      t.click("play");
      t.expect(t.stat("dark") === 0 && t.stat("unpaid") === 0 && t.stat("update") === "Sat 23:31 local (22:31 UTC), after closing",
        "Summer: the update lands at 23:31 local, after the 23:00 closing; 0 minutes dark");

      // 5. Updates "off": the required update still runs.
      begin();
      as({ updates: "off" });
      t.click("play");
      t.expect(t.stat("dark") === 9 && t.stat("unpaid") === 216 &&
        has("tonight's is required and its apply date, Monday 26 October 2026, has passed: it still runs in the next window."),
        "Updates \"off\": the required update runs anyway; still 9 minutes dark");

      // 6. A standby copy in a second zone: standby updated first, a 40 s switch-over between checks, 0 dark.
      begin();
      as({ standby: true });
      t.click("play");
      t.expect(t.stat("dark") === 0 && t.stat("unpaid") === 0 &&
        has("22:31 database: standby being updated; main copy answering.") &&
        has("22:40 database: switched over at 22:40:10 for 40 s, between two checks; standby answering.") &&
        has("22:41 database: old main copy being updated; the new main copy answering."),
        "Standby: updated first, switch-over at 22:40:10 for 40 s between two checks, then the old copy; 0 minutes dark");

      // 7. Keep the last confirmed booking: lanes stay lit through the 9 minutes.
      begin();
      as({ rule: "keep" });
      t.click("play");
      t.expect(t.stat("dark") === 0 && t.stat("kept") === 9 && t.stat("unpaid") === 0 &&
        has("22:31 paid check: no answer. Lanes keep the last confirmed booking, from 22:30, for up to 15 minutes."),
        "Keep-last rule: no answer 22:31 to 22:39, lanes kept on the 22:30 booking for 9 minutes, 0 dark");

      // 8. Keep-last has a limit: a 20-minute update outlasts 15 minutes.
      begin();
      as({ rule: "keep", len: "20" });
      t.click("play");
      t.expect(t.stat("kept") === 15 && t.stat("dark") === 5 && t.stat("unpaid") === 120 &&
        has("22:46 paid check: no answer, 16 minutes after the last confirmed booking."),
        "Keep-last with a 20-minute update: kept 15 minutes, then dark 22:46 to 22:51, 5 minutes, 120 lane-minutes");

      // 9. Another provider (option 2): its own random window, Saturday 22:10 UTC, still in league hours.
      as({ window: "other" });
      t.click("play");
      t.expect(t.stat("dark") === 9 && t.stat("unpaid") === 216 && t.stat("update") === "Sat 22:11 local (22:11 UTC)",
        "Another provider with its defaults: its window lands at 22:11 local; 9 minutes dark");

      // 10. Self-hosting (option 1): no window tonight, but five chores.
      as({ self: true });
      t.click("play");
      t.expect(t.stat("dark") === 0 && t.stat("chores") === 5 && t.stat("ours") === "settings, updates, backups, failover, the 3 AM disk alarm",
        "Own server: no provider window, 0 dark, and the alley owns 5 chores");

      // 11. A chosen window: Tuesday 10:00 UTC, before the noon opening in winter and summer.
      as({ window: "chosen" });
      t.click("play");
      var w1 = t.stat("dark") === 0 && t.stat("update") === "Tue 10:01 UTC (10:01 local), before the noon opening";
      as({ window: "chosen", season: "summer" });
      t.expect(w1 && t.stat("update") === "Tue 10:01 UTC (11:01 local), before the noon opening",
        "Chosen window: the update runs Tuesday 10:01 UTC, 10:01 local in winter and 11:01 in summer, before opening");

      // 12. The fix together: chosen window, standby, shared inbox, keep-last.
      as({ window: "chosen", standby: true, notice: "shared", rule: "keep" });
      t.click("play");
      t.expect(t.stat("dark") === 0 && t.stat("kept") === 0 && t.stat("lit") === 24 && t.stat("chores") === 3 &&
        t.stat("notice") === "the duty managers' shared inbox, Tuesday 29 September 2026" &&
        t.stat("db") === "two copies in two zones, answering",
        "The fix: no update on league night, two copies answering, notices seen, 0 minutes dark");
    }
  });
})();
