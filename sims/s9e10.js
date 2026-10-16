/* sims/s9e10-v1.0.0.js  (published as sims/s9e10.js)
   Case s9e10 "Trust but Verify": a guardrail lab for Steamhollow Tub Hire's website on the night of
   Friday 30 October into Saturday 31 October 2026. After 16:00 the website's assistant (a language
   model) quotes prices and takes bookings on its own. Every reply passes a second model, the
   checker, which compares the quoted price with the price list and blocks a mismatch; if the
   checker has not answered within the limit, the reply goes out unchecked (fail open, as built) or
   is held for a person (fail closed). A booking copies its price from the assistant's last reply
   (as built) or from the price list. At 16:00 the agency moved the checker to a larger model that
   takes 2.6 seconds against a 2-second limit; at 23:00 a deals forum spread a trick (prompt
   injection) that made the assistant quote £0. The learner sets the checker, the limit, what a
   timeout does, the price source and the other guards, then steps the night from 16:00 to 06:00 in
   10-minute steps (or plays it) and reads replies checked, timed out and blocked, £0 bookings,
   alerts fired and customers waiting.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls checker (0.8 s old model, 2.6 s larger model as
     built, 5.4 s next model up on a busy night, down), limit (2 s, 5 s), on timeout (send
     unchecked, hold for a person), price source (the assistant's reply, the price list), the
     never-discount line, the word block, morning approval, rate alerts; step 10 minutes, step
     1 hour, play to 06:00, reset. Stats: time, checker in use, each reply waits, replies, after
     23:00, checked, timed out, blocked, sent unchecked, held because the check was slow, chats
     refused by the word block, £0 bookings, lost at list price, bookings waiting for 08:00,
     alerts fired, the guardrail panel. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e10-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - The night runs 16:00 Friday to 06:00 Saturday, 84 steps of 10 minutes. The office is shut
     16:00 to 08:00; a person confirms held replies and held bookings at 08:00.
   - Replies by hour from 16:00: 40, 46, 52, 50, 44, 38, 30 (300 before 23:00), then 42, 30, 16,
     7, 3, 2, 0 (100 after 23:00): 400 in all. Within an hour they are spread evenly over its six
     steps: step b of an hour with n replies holds floor((b + 1) n / 6) - floor(b n / 6). So the
     first step (16:00 to 16:10) has 6, and 16:00 to 16:40 has 6 + 7 + 7 + 6 = 26.
   - Every tub, Saturday to Sunday, £220. 14 £0 bookings x £220 = £3,080; 5 x £220 = £1,100.
   - 40 bookings tonight, numbered B-5501 to B-5540 in time order: 22 genuine by 22:41
     (B-5501 to B-5522), then the 14 trick bookings at 23:04, 23:09, 23:13, 23:18, 23:22, 23:27,
     23:35, 23:41, 23:52, 00:06, 00:18, 00:33, 00:51 and 01:27, mixed with 4 genuine ones at
     23:31, 00:12, 00:40 and 01:55 (B-5529, B-5534, B-5537, B-5540). 26 genuine + 14 trick = 40.
   - 6 replies quote a wrong price by mistake (17:12, 18:40, 19:25, 20:05, 21:03, 21:33): the
     usual "about 6 in every 400" the old checker blocked. Those customers were asking, not
     booking. A working checker blocks those 6 and the 14 £0 quotes: 20.
   - Checker answer times: 0.8 s (old, before 16:00), 2.6 s (larger, from 16:00), 5.4 s (the next
     model up on a busy night, part 2 of option 1), or down (no answer). A reply is checked when
     the checker answers within the limit (2 s or 5 s); otherwise it times out.
   - As built (2.6 s, 2 s limit, send unchecked, price from the reply): 0 checked, 400 timed out,
     400 sent unchecked, 0 blocked ("blocked tonight: 0"), 14 £0 bookings, £3,080.
   - The never-discount line stops none of the 14 (given). The word block refuses chats with the
     word cousin: 9 of the 14 trick chats (all but 23:13, 23:27, 23:52, 00:18 and 01:27) and one
     genuine booking, 19:19. With it, 5 £0 bookings, 10 chats refused.
   - Price from the price list: a trick booking asks £220 at the card step and none of the 14
     pays (given), so 0 £0 bookings, whatever the checker does.
   - Hold for a person on timeout: every timed-out reply is held; its customer reads that a person
     will confirm the price at 08:00. 2.6 s with no alerts: 400 held, the 26 genuine bookings wait
     for 08:00, the 14 trick ones are refused then.
   - Morning approval: every booking made while the office is shut waits for 08:00: 40.
   - Rate alerts page the agency's on-call phone. Timeout alert: at the end of a step in which
     more than 5 in every 100 replies timed out (16:10 tonight). Block alert: at the end of a step
     when 3 or more replies were blocked in the last hour (23:20 with a working checker: 23:04,
     23:09, 23:13 and 23:18). The on-call puts the 0.8-second checker back 30 minutes after the
     timeout alert (16:40). The fix (price list, hold, alerts) at 2.6 s: 26 held, 20 blocked,
     0 at £0, 1 booking (16:22) waiting for 08:00.
   - 5-second limit: 2.6 s checks all 400, 20 blocked, 0 at £0, each reply waits 2.6 s; 5.4 s
     times out all 400 and sends them unchecked: 14 at £0 again.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after 00:00 Friday) ---------- */

  var START = 960;          // 16:00 Friday
  var END = 1800;           // 06:00 Saturday
  var STEP = 10;
  var HOURLY = [40, 46, 52, 50, 44, 38, 30, 42, 30, 16, 7, 3, 2, 0];
  var PRICE = 220;
  var ROLLBACK = 30;        // the on-call puts the old checker back 30 minutes after the timeout alert
  var SECS = { "0.8": 0.8, "2.6": 2.6, "5.4": 5.4 };

  function hm(h, m) { return (h < 16 ? h + 24 : h) * 60 + m; }
  // [time, uses the word] for the 14 trick chats
  var TRICKS = [[hm(23, 4), true], [hm(23, 9), true], [hm(23, 13), false], [hm(23, 18), true],
    [hm(23, 22), true], [hm(23, 27), false], [hm(23, 35), true], [hm(23, 41), true],
    [hm(23, 52), false], [hm(0, 6), true], [hm(0, 18), false], [hm(0, 33), true],
    [hm(0, 51), true], [hm(1, 27), false]];
  var GENUINE = [hm(16, 22), hm(16, 51), hm(17, 8), hm(17, 30), hm(17, 47), hm(18, 5), hm(18, 26),
    hm(18, 44), hm(19, 2), hm(19, 19), hm(19, 40), hm(19, 58), hm(20, 14), hm(20, 37), hm(20, 55),
    hm(21, 12), hm(21, 29), hm(21, 50), hm(22, 3), hm(22, 18), hm(22, 30), hm(22, 41),
    hm(23, 31), hm(0, 12), hm(0, 40), hm(1, 55)];
  var WORD_GENUINE = hm(19, 19);
  var SLIPS = [hm(17, 12), hm(18, 40), hm(19, 25), hm(20, 5), hm(21, 3), hm(21, 33)];

  var CHECKERS = [
    { value: "0.8", label: "0.8 s: the old model (before 16:00)" },
    { value: "2.6", label: "2.6 s: the larger model (from 16:00, as built)" },
    { value: "5.4", label: "5.4 s: the next model up, on a busy night" },
    { value: "down", label: "down: no answer at all" }
  ];
  var LIMITS = [
    { value: "2", label: "2 seconds (as built)" },
    { value: "5", label: "5 seconds" }
  ];
  var ONTIMEOUT = [
    { value: "send", label: "send the reply unchecked (as built)" },
    { value: "hold", label: "hold the reply: a person will confirm the price" }
  ];
  var SOURCES = [
    { value: "reply", label: "the assistant's reply (as built)" },
    { value: "list", label: "the price list" }
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
  function hhmm(m) { return two(Math.floor(m / 60) % 24) + ":" + two(m % 60); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function pounds(n) { return "£" + commas(n); }

  /* ---------- the night's chats (given data) ---------- */

  function repliesIn(s) {
    var k = Math.floor((s - START) / 60);
    var b = Math.floor(((s - START) % 60) / STEP);
    var n = HOURLY[k];
    return Math.floor((b + 1) * n / 6) - Math.floor(b * n / 6);
  }

  // Every booking and slip, in time order, with its booking number.
  function events() {
    var list = [];
    TRICKS.forEach(function (x) { list.push({ t: x[0], kind: "trick", word: x[1] }); });
    GENUINE.forEach(function (t) { list.push({ t: t, kind: "genuine", word: t === WORD_GENUINE }); });
    SLIPS.forEach(function (t) { list.push({ t: t, kind: "slip", word: false }); });
    list.sort(function (a, b) { return a.t - b.t; });
    var no = 5501;
    list.forEach(function (e) { if (e.kind !== "slip") { e.id = "B-" + no; no += 1; } });
    return list;
  }
  var EVENTS = events();

  /* ---------- the model (a pure replay the display and self-tests read) ---------- */

  function replay(C, T) {
    var r = {
      replies: 0, late: 0, checked: 0, timed: 0, blocked: 0, unchecked: 0, held: 0, refused: 0,
      zero: 0, waiting: 0, alertT: null, alertB: null, rollback: null, blockAt: [], ev: [], chk: C.checker
    };
    for (var s = START; s < T; s += STEP) {
      var e2 = s + STEP;
      var R = repliesIn(s);
      var chk = (r.rollback !== null && s >= r.rollback) ? "0.8" : C.checker;
      var inTime = chk !== "down" && SECS[chk] <= Number(C.limit);
      var evs = EVENTS.filter(function (e) { return e.t >= s && e.t < e2; });
      var refusedNow = 0;
      var lines = [];
      evs.forEach(function (e) {
        if (C.word && e.word) {
          refusedNow += 1;
          lines.push(hhmm(e.t) + " " + (e.kind === "trick" ? "a trick chat" : "a genuine customer booking a tub for a cousin's birthday") +
            " is refused by the word block.");
        }
      });
      var through = R - refusedNow;
      r.replies += R;
      if (s >= hm(23, 0)) r.late += R;
      r.refused += refusedNow;
      var timedNow = 0;
      var blockedNow = 0;
      if (inTime) r.checked += through; else { r.timed += through; timedNow = through; }
      if (!inTime && C.onTimeout === "send") r.unchecked += through;
      if (!inTime && C.onTimeout === "hold") r.held += through;
      evs.forEach(function (e) {
        if (C.word && e.word) return;
        var at = hhmm(e.t) + " ";
        if (e.kind === "slip") {
          if (inTime) { blockedNow += 1; r.blockAt.push(e.t); lines.push(at + "the checker blocks a reply that quoted a price not on the list; a person will confirm at 08:00."); }
          return;
        }
        if (e.kind === "genuine") {
          if (!inTime && C.onTimeout === "hold") { r.waiting += 1; lines.push(at + e.id + ": the reply is held, so the booking waits for a person at 08:00."); }
          else if (C.morning) { r.waiting += 1; lines.push(at + e.id + " at £220 waits for a person at 08:00."); }
          return;
        }
        // a trick chat: the assistant quotes £0
        var q = at + e.id + ": a customer claims to be family of the owner, and" + (C.line ? " despite the never-discount line" : "") +
          " the assistant quotes £0.00";
        if (inTime) {
          blockedNow += 1;
          r.blockAt.push(e.t);
          lines.push(q + "; the checker blocks it.");
        } else if (C.onTimeout === "hold") {
          lines.push(q + "; the check is slow, so the reply is held and no booking is made.");
        } else if (C.morning) {
          r.waiting += 1;
          lines.push(q + " unchecked; the booking waits for a person at 08:00.");
        } else if (C.price === "list") {
          lines.push(q + " unchecked, but the booking is priced from the list: £220 at the card step, and it is never paid.");
        } else {
          r.zero += 1;
          lines.push(q + " unchecked; the booking copies it: £0.00, card taken £0.00.");
        }
      });
      r.blocked += blockedNow;
      var head = hhmm(e2) + " " + R + (R === 1 ? " reply" : " replies") + " since " + hhmm(s) + ": " +
        (refusedNow ? refusedNow + " refused, " : "") +
        (through === 0 ? "none to check." : (inTime ? through + " checked in " + SECS[chk] + " s" + (blockedNow ? ", " + blockedNow + " blocked." : ".") :
          through + " timed out and " + (C.onTimeout === "send" ? "went out unchecked." : "held for a person.")));
      r.ev.push({ t: e2, tone: "", text: head });
      lines.forEach(function (x) { r.ev.push({ t: e2, tone: /£0\.00, card/.test(x) ? "bad" : "", text: x }); });
      if (C.alerts) {
        if (r.alertT === null && through > 0 && timedNow * 100 > through * 5) {
          r.alertT = e2;
          r.rollback = e2 + ROLLBACK;
          r.ev.push({ t: e2, tone: "warn", text: hhmm(e2) + " timeout alert: " + timedNow + " of " + through +
            " replies timed out. The agency's on-call phone rings; the 0.8-second checker goes back at " + hhmm(r.rollback) + "." });
        }
        var hour = r.blockAt.filter(function (x) { return x >= e2 - 60 && x < e2; }).length;
        if (r.alertB === null && hour >= 3) {
          r.alertB = e2;
          r.ev.push({ t: e2, tone: "warn", text: hhmm(e2) + " block alert: " + hour + " replies blocked in the last hour, against about 6 in every 400 replies. The on-call phone rings." });
        }
      }
      if (r.rollback !== null && e2 === r.rollback) r.ev.push({ t: e2, tone: "ok", text: hhmm(e2) + " the on-call puts the 0.8-second checker back." });
      r.chk = (r.rollback !== null && e2 >= r.rollback) ? "0.8" : C.checker;
    }
    return r;
  }

  function waitText(r, C) {
    var lim = Number(C.limit);
    if (r.chk === "down") return lim + " s";
    return (SECS[r.chk] <= lim ? SECS[r.chk] : lim) + " s";
  }
  function alertText(r) {
    var a = [];
    if (r.alertT !== null) a.push("timeouts " + hhmm(r.alertT));
    if (r.alertB !== null) a.push("blocks " + hhmm(r.alertB));
    return a.length ? a.join(", ") : "none";
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
    var path = el("p", "margin:0;font-size:12px;");
    box.appendChild(path);
    var panel = el("p", "margin:0;font-size:13px;font-weight:600;");
    box.appendChild(panel);
    var sheet = el("p", "margin:0;font-size:12px;");
    box.appendChild(sheet);
    api.root.appendChild(box);
    return { head: head, path: path, panel: panel, sheet: sheet };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = replay(C, S.t);
    S.r = r;
    S.ui.head.textContent = hhmm(S.t) + (S.t < 1440 ? " on Friday 30 October" : " on Saturday 31 October") +
      ". Checker: " + pick(CHECKERS, C.checker).label + ". Limit: " + C.limit + " s. On a timeout: " +
      pick(ONTIMEOUT, C.onTimeout).label + ". Booking price from: " + pick(SOURCES, C.price).label + ".";
    S.ui.path.textContent = "A reply's path: the assistant writes it; the checker compares its price with the list; a match goes out, a mismatch is blocked and held; no answer within " +
      C.limit + " s means " + (C.onTimeout === "send" ? "the reply goes out unchecked." : "the reply is held for a person.");
    S.ui.panel.textContent = "guardrail panel: replies tonight " + r.replies + ", blocked tonight: " + r.blocked;
    S.ui.sheet.textContent = "morning sheet so far: " + r.zero + " bookings at £0.00" + (r.waiting ? ", " + r.waiting + " waiting for a person at 08:00" : "") + ".";
    S.stat.time(hhmm(S.t));
    S.stat.checker(r.chk === "down" ? "down" : r.chk + " s");
    S.stat.wait(waitText(r, C));
    S.stat.replies(r.replies);
    S.stat.late(r.late);
    S.stat.checked(r.checked);
    S.stat.timed(r.timed);
    S.stat.blocked(r.blocked);
    S.stat.unchecked(r.unchecked);
    S.stat.held(r.held);
    S.stat.refused(r.refused);
    S.stat.zero(r.zero);
    S.stat.lost(pounds(r.zero * PRICE));
    S.stat.waiting(r.waiting);
    S.stat.alerts(alertText(r));
    S.stat.panel("blocked tonight: " + r.blocked);
  }

  function logBetween(api, from, to) {
    var r = replay(api.state.C, to);
    r.ev.forEach(function (e) { if (e.t > from && e.t <= to) api.log(e.text, e.tone); });
  }

  function closing(api) {
    var r = replay(api.state.C, END);
    api.log("06:00 the night ends: " + r.replies + " replies, " + r.checked + " checked, " + r.unchecked + " sent unchecked, " +
      r.held + " held because the check was slow; " + r.zero + " bookings at £0.00 (" + pounds(r.zero * PRICE) + " at list price). Panel: blocked tonight: " + r.blocked + ".",
      r.zero ? "bad" : "ok");
  }

  function advance(api, to) {
    var S = api.state;
    if (S.t >= END) {
      api.log("It is 06:00. Change a setting or reset to replay the night.", "");
      return;
    }
    if (to > END) to = END;
    logBetween(api, S.t, to);
    S.t = to;
    if (to === END) closing(api);
    draw(api);
  }

  function change(api, what) {
    api.state.t = START;
    api.log(what + " Back to 16:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { checker: "2.6", limit: "2", onTimeout: "send", price: "reply", line: false, word: false, morning: false, alerts: false };
      S.t = START;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key, on1, off1) {
        api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          change(api, on ? on1 : off1);
        });
      }
      sel("checker", "checker", CHECKERS, "checker");
      sel("limit", "time limit for the checker", LIMITS, "limit");
      sel("timeout", "when the checker runs out of time", ONTIMEOUT, "onTimeout");
      sel("price", "booking price taken from", SOURCES, "price");
      tog("line", "add the never-discount line to the assistant's instructions", "line", "The never-discount line is in the instructions.", "The never-discount line is out.");
      tog("word", "refuse any chat with the word cousin", "word", "The word block is on.", "The word block is off.");
      tog("morning", "hold every booking made 16:00 to 08:00 for a person at 08:00", "morning", "Morning approval is on.", "Morning approval is off.");
      tog("alerts", "rate alerts to the agency's on-call (timeouts, blocks)", "alerts", "Rate alerts are on.", "Rate alerts are off.");
      api.control.button("step", "step 10 minutes", function () { advance(api, api.state.t + STEP); });
      api.control.button("hour", "step 1 hour", function () { advance(api, api.state.t + 60); });
      api.control.button("play", "play to 06:00", function () { advance(api, END); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        checker: api.stat("checker", "checker in use answers in", ""),
        wait: api.stat("wait", "each reply waits", ""),
        replies: api.stat("replies", "replies tonight", ""),
        late: api.stat("late", "replies after 23:00", ""),
        checked: api.stat("checked", "replies checked", "ok"),
        timed: api.stat("timed", "replies timed out", "warn"),
        blocked: api.stat("blocked", "replies blocked", ""),
        unchecked: api.stat("unchecked", "sent unchecked", "bad"),
        held: api.stat("held", "held because the check was slow", "warn"),
        refused: api.stat("refused", "chats refused by the word block", "warn"),
        zero: api.stat("zero", "bookings at £0", "bad"),
        lost: api.stat("lost", "lost at list price", "bad"),
        waiting: api.stat("waiting", "bookings waiting for 08:00", "warn"),
        alerts: api.stat("alerts", "alerts fired", ""),
        panel: api.stat("panel", "the guardrail panel", "")
      };

      api.info("<strong>How to read it.</strong> Each step is 10 minutes of the night. Every reply the assistant writes goes to the checker, which compares the quoted price with the price list. If it answers within the time limit, the reply is checked: a match goes out, a mismatch is blocked and held for a person. If it doesn't, the reply times out, and then goes out unchecked or is held, as you choose. A booking copies its price from the assistant's reply or from the price list. The panel counts blocks only, so a reply that times out never shows on it.");

      api.log("Friday 30 October, 16:00: the office shuts and the assistant takes over the website. The checker is set as you choose; no replies yet.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var BUILT = { checker: "2.6", limit: "2", timeout: "send", price: "reply", line: false, word: false, morning: false, alerts: false };
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      function fresh(set) { as(BUILT); as(set || {}); t.click("play"); }

      // 1. Opening state: 16:00 Friday, the larger checker, nothing processed yet.
      t.expect(t.stat("time") === "16:00" && t.stat("replies") === 0 && t.stat("checker") === "2.6 s" &&
        t.stat("panel") === "blocked tonight: 0" && t.stat("zero") === 0 && t.stat("alerts") === "none" &&
        has("Friday 30 October, 16:00: the office shuts"),
        "Opens at 16:00 on Friday 30 October with the 2.6-second checker and no replies");

      // 2. One step as built: the first 6 replies time out and go out unchecked.
      t.click("step");
      t.expect(t.stat("time") === "16:10" && t.stat("replies") === 6 && t.stat("timed") === 6 && t.stat("checked") === 0 &&
        t.stat("unchecked") === 6 && t.stat("wait") === "2 s" &&
        has("16:10 6 replies since 16:00: 6 timed out and went out unchecked."),
        "16:10: 6 replies, all past the 2-second limit, all sent unchecked");

      // 3. As built, played to 06:00: nothing checked, nothing blocked, 14 bookings at £0.
      fresh({});
      t.expect(t.stat("replies") === 400 && t.stat("late") === 100 && t.stat("checked") === 0 && t.stat("timed") === 400 &&
        t.stat("unchecked") === 400 && t.stat("blocked") === 0 && t.stat("panel") === "blocked tonight: 0" &&
        t.stat("zero") === 14 && t.stat("lost") === "£3,080" &&
        has("23:04 B-5523: a customer claims to be family of the owner, and the assistant quotes £0.00 unchecked; the booking copies it: £0.00, card taken £0.00.") &&
        has("01:27 B-5539:"),
        "As built: 400 replies, 100 after 23:00, 0 checked, blocked tonight: 0, 14 bookings at £0, £3,080");

      // 4. The old 0.8-second checker, as before 16:00: everything checked, 20 blocked.
      fresh({ checker: "0.8" });
      t.expect(t.stat("checked") === 400 && t.stat("blocked") === 20 && t.stat("zero") === 0 && t.stat("unchecked") === 0 &&
        t.stat("panel") === "blocked tonight: 20" && t.stat("wait") === "0.8 s",
        "0.8-second checker: all 400 checked, 20 blocked (the 6 slips and the 14 £0 quotes), none at £0");

      // 5. Price from the price list, even with the checker down and replies sent unchecked.
      fresh({ checker: "down", price: "list" });
      t.expect(t.stat("timed") === 400 && t.stat("unchecked") === 400 && t.stat("zero") === 0 && t.stat("lost") === "£0" &&
        has("the booking is priced from the list: £220 at the card step"),
        "Price list, checker down, fail open: 400 unchecked, still 0 bookings at £0");

      // 6. Hold the reply on a timeout (fail closed), no alerts: every reply held.
      fresh({ timeout: "hold" });
      t.expect(t.stat("held") === 400 && t.stat("unchecked") === 0 && t.stat("zero") === 0 && t.stat("waiting") === 26 &&
        has("the check is slow, so the reply is held and no booking is made."),
        "Fail closed at 2.6 s with no alerts: 400 held, 0 at £0, 26 genuine bookings wait for 08:00");

      // 7. Rate alerts alone, still failing open: the timeout alert fires at 16:10.
      as(BUILT);
      t.set("alerts", true);
      t.click("step");
      t.expect(t.stat("alerts") === "timeouts 16:10" &&
        has("16:10 timeout alert: 6 of 6 replies timed out. The agency's on-call phone rings; the 0.8-second checker goes back at 16:40."),
        "Alerts on: the timeout alert fires at 16:10 and the old checker goes back at 16:40");

      // 8. The fix: price list, hold on timeout, rate alerts, with the 2.6-second checker.
      fresh({ price: "list", timeout: "hold", alerts: true });
      t.expect(t.stat("alerts") === "timeouts 16:10, blocks 23:20" && t.stat("held") === 26 && t.stat("blocked") === 20 &&
        t.stat("zero") === 0 && t.stat("waiting") === 1 && t.stat("checker") === "0.8 s" && t.stat("unchecked") === 0,
        "The fix: timeout alert 16:10, 26 held until 16:40, block alert 23:20, 20 blocked, 0 at £0, 1 booking waiting");

      // 9. Option 1: a 5-second limit fixes tonight, and fails open again with a 5.4-second checker.
      fresh({ limit: "5" });
      var five = t.stat("checked") === 400 && t.stat("blocked") === 20 && t.stat("zero") === 0 && t.stat("wait") === "2.6 s";
      fresh({ limit: "5", checker: "5.4" });
      t.expect(five && t.stat("timed") === 400 && t.stat("unchecked") === 400 && t.stat("zero") === 14 && t.stat("wait") === "5 s" &&
        t.stat("panel") === "blocked tonight: 0",
        "5-second limit: 2.6 s checks all 400 with none at £0; 5.4 s fails open again, 14 at £0");

      // 10. Option 0: the never-discount line stops none of the 14.
      fresh({ line: true });
      t.expect(t.stat("zero") === 14 && t.stat("blocked") === 0 && t.stat("lost") === "£3,080" &&
        has("owner, and despite the never-discount line the assistant quotes £0.00"),
        "Never-discount line: still 14 bookings at £0");

      // 11. Blocking the word cousin: 9 trick chats and one genuine booking refused, 5 still at £0.
      fresh({ word: true });
      t.expect(t.stat("refused") === 10 && t.stat("zero") === 5 && t.stat("lost") === "£1,100" &&
        has("19:19 a genuine customer booking a tub for a cousin's birthday is refused by the word block."),
        "Word block: 10 chats refused (one genuine), 5 bookings at £0, £1,100");

      // 12. Option 3: morning approval holds all 40 night bookings; none at £0, replies still unchecked.
      fresh({ morning: true });
      t.expect(t.stat("waiting") === 40 && t.stat("zero") === 0 && t.stat("unchecked") === 400 && t.stat("blocked") === 0,
        "Morning approval: all 40 bookings wait for 08:00, none at £0, 400 replies still unchecked");
    }
  });
})();
