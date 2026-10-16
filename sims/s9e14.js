/* sims/s9e14-v1.0.0.js  (published as sims/s9e14.js)
   Case s9e14 "The Platform": a mesh lab for a pet-sitting agency's night visits. One night sitter,
   Ciarnait, visits Tobermory, a diabetic cat, four times on the night of Tuesday 3 November 2026
   (02:00, 04:00, 06:00 and 08:00 on Wednesday 4 November). Each press of "check in" in the app is a
   write to the visit service, carried by a sidecar that the platform's template puts beside every
   service. The learner sets the platform version, the limit per try, the retry rule, the key check,
   the time of the nightly report, how slow the visit service is during it, team-owned settings, the
   rollout, and whether she presses again after an error, then plays the night a visit at a time.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls platform version (2, 3), limit per try (2, 10
     seconds), retry rule (every call, only calls marked safe to repeat), key check (off, on), report
     time (02:00, 04:00), slow answer during the report (2.5 s, 12 s), each team sets its own (off,
     on), rollout of version 3 (all 40 at once, a few first), she presses again after an error (off,
     on); buttons next visit, play the night, start over. Stats: check-ins at the 02:00 visit, tries,
     check-ins written, refused by the key, visits made, visits cancelled as done, visits still
     booked, texts sent, what the app said at 02:13, services on version 3, who sets the visit
     service's retries. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e14-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   Times are kept in tenths of a second after midnight, so 2.5 s and 0.4 s stay exact.
   - The night (the post): Tobermory's plan holds four visits, 02:00, 04:00, 06:00 and 08:00 (the
     06:00 one with his insulin), ids 8841 to 8844 (sim.lede). At each visit she presses "check in"
     at 13 minutes 7 seconds past the hour (given data): the 02:00 visit's press is 02:13:07.
   - A check-in write (the post): the visit service saves a check-in line, then marks the home's
     earliest visit not yet done as done. A visit marked done before she reached it is "cancelled:
     done" and leaves her route.
   - The visit service (the post): 0.4 s an answer; 2.5 s during the nightly report, 02:00 to
     02:30. During the report every answer is slow, a refusal too (sim.lede). The 12 s slow answer
     is given data for option 0 (a bigger report).
   - The sidecar (the post): version 3, put into all 40 services on Tuesday 3 November 2026, gives
     every call a 2-second limit per try and up to 3 retries. Version 2 had no limit and no
     retries. The pause between tries (25 ms or more in Istio) is counted as 0 here (sim.lede).
     A cut try goes on in the visit service and saves its check-in when its work ends.
   - As built at 02:13:07: tries reach the visit service at 02:13:07, :09, :11 and :13 (the log's
     times), each is cut 2 s later, and each saves 2.5 s after it began: 02:13:09.5, :11.5, :13.5
     and :15.5. The four writes mark the 02:00 visit (made) and the 04:00, 06:00 and 08:00 visits
     (cancelled). The app says "Check-in failed. Please try again." at 02:13:15, 8 s after the press.
   - The rota service (the post): checks every route once a minute, on the minute, and texts any
     change: one text at 02:14:00, "Tobermory: next visits cancelled: done."
   - Version 2: one try, answered at 02:13:09.5, one check-in; then 04:13:07, 06:13:07, 08:13:07 at
     0.4 s each: four visits made, none cancelled.
   - Key check (the ok option, Rule 3): the key is the visit's id. The service looks it up as a try
     arrives; a new key is noted (in progress) and the work done; a key already noted is refused. As
     built with the key on: 4 tries, 1 check-in, 3 refused.
   - Safe to repeat only (the ok option): a check-in is a write, not marked safe, so it gets one
     try: cut at 02:13:09, saved at 02:13:09.5. A second press (given data: 5 s after the app says
     the check-in failed, here 02:13:14) with the key off saves a second check-in and cancels the 04:00 visit; with the
     key on it is refused.
   - Report at 04:00 (option 1): 02:13:07 at 0.4 s is one check-in; 04:13:07 falls in the report:
     4 writes at 04:13:09.5 to 04:13:15.5 mark the 04:00 visit made, cancel 06:00 and 08:00, and the
     fourth finds no visit left. Text at 04:14:00.
   - Limit 10 s (option 0): 2.5 s fits, one try. With the 12 s answer: tries at 02:13:07, :17, :27
     and :37, saves at :19, :29, :39 and :49, three visits cancelled again.
   - Each team sets its own (option 3, given data): the visits team picks no retries and a
     5-second limit for the visit service, so one try; the stat counts 40 services set by hand.
   - A few first (the ok option, given data): version 3 goes first to 3 of the 40 services
     (photos, search and messages), their owners told; the visit service waits for the second wave,
     so tonight it still runs version 2.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var HOUR = 36000;                 // tenths of a second in an hour
  var PRESS = 13 * 600 + 70;        // 13 min 7 s past the hour, in tenths
  var AGAIN = 50;                   // a second press 5 s after the app says the check-in failed
  var FAST = 4;                     // 0.4 s
  var REPORT_LEN = 18000;           // 30 minutes
  var VISITS = [
    { id: 8841, h: 2, what: "02:00" },
    { id: 8842, h: 4, what: "04:00" },
    { id: 8843, h: 6, what: "06:00" },
    { id: 8844, h: 8, what: "08:00" }
  ];
  var TEXT = "Tobermory: next visits cancelled: done.";
  var FAILED = "Check-in failed. Please try again.";
  var OK = "Checked in.";

  var VERSIONS = [
    { value: "3", label: "version 3: every call, 2-second limit per try, up to 3 retries (as built)" },
    { value: "2", label: "version 2: no limit, no retries" }
  ];
  var LIMITS = [
    { value: "2", label: "2 seconds (as built)" },
    { value: "10", label: "10 seconds" }
  ];
  var RULES = [
    { value: "all", label: "retry every call, reads and writes (as built)" },
    { value: "safe", label: "retry only calls marked safe to repeat" }
  ];
  var REPORTS = [
    { value: "02:00", label: "02:00 to 02:30 (as built)" },
    { value: "04:00", label: "04:00 to 04:30" }
  ];
  var SLOWS = [
    { value: "2.5", label: "2.5 seconds (tonight)" },
    { value: "12", label: "12 seconds (a bigger report)" }
  ];
  var ROLLOUTS = [
    { value: "all", label: "all 40 services at once (as built)" },
    { value: "few", label: "a few first: 3 services, owners told" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t) {
    var s = Math.floor(t / 10);
    var d = t % 10;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60) + (d ? "." + d : "");
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // What the sidecar in front of the visit service does tonight.
  function rules(C) {
    var on3 = C.version === "3" && C.rollout === "all";
    var v3 = C.version === "2" ? "0 of 40" : (C.rollout === "few" ? "3 of 40 (photos, search, messages; owners told)" : "40 of 40");
    if (C.teams) return { limit: 50, retries: 0, v3: v3,
      who: "each team for its own services: the visits team picks no retries and a 5-second limit; 40 services set by hand" };
    if (!on3) return { limit: null, retries: 0, v3: v3,
      who: C.version === "3" ? "the template, version 2 until the second wave: no limit, no retries" : "the template, version 2: no limit, no retries" };
    var safe = C.retry === "safe";
    return { limit: Number(C.limit) * 10, retries: safe ? 0 : 3, v3: v3,
      who: "the template, version 3: " + (safe ? "reads retried, writes not" : "every call retried up to 3 times") + ", limit " + C.limit + " s per try" };
  }

  function answerTime(C, t) {
    var start = (C.report === "04:00" ? 4 : 2) * HOUR;
    if (t >= start && t < start + REPORT_LEN) return Math.round(Number(C.slow) * 10);
    return FAST;
  }

  // One press: the tries the sidecar sends, and the check-ins they save.
  function press(C, R, t0, visit, keys, n) {
    var tries = [];
    var t = t0;
    var failed = false;
    for (var k = 0; k <= R.retries; k++) {
      var s = answerTime(C, t);
      var refused = false;
      if (C.key) {
        if (keys[visit.id]) refused = true;
        else keys[visit.id] = true;
      }
      var cut = R.limit !== null && s > R.limit ? t + R.limit : null;
      tries.push({ press: n, k: k + 1, arr: t, cut: cut, land: t + s, refused: refused });
      if (cut === null) break;
      if (k === R.retries) failed = true;
      t = cut;
    }
    return { tries: tries, failed: failed, end: failed ? t : tries[tries.length - 1].land };
  }

  // Plays one visit: the presses, the writes in time order, the texts.
  function playVisit(S, visit) {
    var C = S.C;
    var R = S.R;
    var ev = [];
    var t0 = visit.h * HOUR + PRESS;
    ev.push({ t: t0, o: 0, msg: clock(t0) + " Ciarnait presses check in at Tobermory's home (the " + visit.what + " visit, key " + visit.id + ").", tone: "" });
    var p1 = press(C, R, t0, visit, S.keys, 1);
    var all = p1.tries.slice();
    var said = p1.failed ? FAILED : OK;
    ev.push({ t: p1.end, o: 3, msg: clock(p1.end) + " the app says: \"" + said + "\"", tone: p1.failed ? "bad" : "ok" });
    if (visit.h === 2) S.app = said;
    if (p1.failed && C.again) {
      var t2 = p1.end + AGAIN;
      ev.push({ t: t2, o: 0, msg: clock(t2) + " Ciarnait presses check in again.", tone: "warn" });
      var p2 = press(C, R, t2, visit, S.keys, 2);
      all = all.concat(p2.tries);
      ev.push({ t: p2.end, o: 3, msg: clock(p2.end) + " the app says: \"" + (p2.failed ? FAILED : OK) + "\"", tone: p2.failed ? "bad" : "ok" });
    }
    all.forEach(function (x) {
      S.tries += 1;
      var m = clock(x.arr) + " try " + x.k + (x.press === 2 ? " of the second press" : "") + " reaches the visit service.";
      if (x.refused) m += " Refused by the key check: key " + visit.id + " already noted, so nothing is saved" + (x.cut !== null ? "; cut at " + clock(x.cut) + "." : ".");
      else if (x.cut !== null) m += " Cut at " + clock(x.cut) + "; it carries on and saves at " + clock(x.land) + ".";
      else m += " Answered at " + clock(x.land) + ".";
      ev.push({ t: x.arr, o: 1, msg: m, tone: x.refused ? "ok" : (x.cut !== null ? "warn" : "") });
      if (x.refused) { S.refused += 1; return; }
      ev.push({ t: x.land, o: 2, w: true, msg: "", tone: "" });
      S.table.push("try " + x.k + (x.press === 2 ? " (2nd press)" : "") + ": reached " + clock(x.arr) + ", " +
        (x.cut !== null ? "cut " + clock(x.cut) + ", " : "") + "saved " + clock(x.land));
    });
    all.filter(function (x) { return x.refused; }).forEach(function (x) {
      S.table.push("try " + x.k + (x.press === 2 ? " (2nd press)" : "") + ": reached " + clock(x.arr) + ", refused by the key");
    });
    ev.sort(function (a, b) { return a.t - b.t || a.o - b.o; });
    var texts = {};
    ev.forEach(function (e) {
      if (!e.w) return;
      S.checkins += 1;
      if (visit.h === 2) S.first += 1;
      var open = null;
      for (var i = 0; i < VISITS.length; i++) if (S.state[i] === "booked") { open = i; break; }
      if (open === null) { e.msg = clock(e.t) + " check-in saved; no visit left to mark."; e.tone = "warn"; return; }
      if (VISITS[open].id === visit.id) {
        S.state[open] = "made";
        e.msg = clock(e.t) + " check-in saved: the " + VISITS[open].what + " visit marked done.";
        e.tone = "ok";
      } else {
        S.state[open] = "cancelled";
        e.msg = clock(e.t) + " check-in saved: the " + VISITS[open].what + " visit marked done, cancelled before she came.";
        e.tone = "bad";
        var b = (Math.floor(e.t / 600) + 1) * 600;
        texts[b] = true;
      }
    });
    Object.keys(texts).forEach(function (b) {
      S.texts += 1;
      ev.push({ t: Number(b), o: 4, msg: clock(Number(b)) + " the rota service texts Ciarnait: \"" + TEXT + "\"", tone: "bad" });
    });
    ev.sort(function (a, b) { return a.t - b.t || a.o - b.o; });
    return ev;
  }

  function count(S, s) { return S.state.filter(function (x) { return x === s; }).length; }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "middle" }, g);
    t.textContent = s;
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style) { var e = doc.createElement(tag); if (style) e.setAttribute("style", style); return e; }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", { viewBox: "0 0 660 110", width: "100%", "class": "dg", role: "img",
      "aria-label": "Tobermory's four visits tonight, 02:00, 04:00, 06:00 and 08:00. Grey: still booked. Green: made, checked in at the visit. Red: marked done by an extra check-in and cancelled before she came." });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var list = el("div", "margin:0;font-size:12px;white-space:pre-wrap;font-family:var(--mono, monospace);");
    box.appendChild(list);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, list: list };
  }

  function drawVisits(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    txt(doc, g, 10, 16, "Tobermory's visits, Wednesday 4 November 2026", "dg-axis", "start");
    VISITS.forEach(function (v, i) {
      var x = 20 + i * 160;
      var st = S.state[i];
      var fill = st === "made" ? "var(--green)" : (st === "cancelled" ? "var(--red)" : "var(--faint)");
      mk(doc, "rect", { x: x, y: 30, width: 140, height: 56, rx: 6, style: "fill:" + fill + ";opacity:.85" }, g);
      txt(doc, g, x + 70, 52, v.what + (v.h === 6 ? ", insulin" : ""), "dg-axis", "middle");
      txt(doc, g, x + 70, 72, st === "cancelled" ? "cancelled: done" : st, "dg-axis", "middle");
    });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Platform: " + pick(VERSIONS, C.version).label + "; limit per try " + C.limit + " s; " +
      pick(RULES, C.retry).label + "; key check " + (C.key ? "on" : "off") + "; report " + pick(REPORTS, C.report).label +
      ", slow answer " + C.slow + " s; rollout: " + pick(ROLLOUTS, C.rollout).label + (C.teams ? "; each team sets its own" : "") +
      (C.again ? "; she presses again after an error." : ".");
    drawVisits(S);
    S.ui.list.textContent = S.table.length ? S.table.join("\n") : "No presses yet. Her first is at 02:13:07.";
    S.stat.first(S.first);
    S.stat.tries(S.tries);
    S.stat.checkins(S.checkins);
    S.stat.refused(S.refused);
    S.stat.made(count(S, "made"));
    S.stat.cancelled(count(S, "cancelled"));
    S.stat.left(count(S, "booked"));
    S.stat.texts(S.texts);
    S.stat.app(S.app);
    S.stat.v3(S.R.v3);
    S.stat.who(S.R.who);
  }

  function nextVisit(api) {
    var S = api.state;
    while (S.next < VISITS.length && S.state[S.next] !== "booked") S.next += 1;
    if (S.next >= VISITS.length) return false;
    var ev = playVisit(S, VISITS[S.next]);
    ev.forEach(function (e) { api.log(e.msg, e.tone); });
    S.next += 1;
    while (S.next < VISITS.length && S.state[S.next] !== "booked") S.next += 1;
    if (S.next >= VISITS.length) api.log("night over: check-ins written " + S.checkins + ", visits made " + count(S, "made") +
      ", visits cancelled as done " + count(S, "cancelled") + ", texts sent " + S.texts + ".", count(S, "cancelled") ? "bad" : "ok");
    return true;
  }

  function restart(api, what) {
    var S = api.state;
    S.R = rules(S.C);
    S.state = ["booked", "booked", "booked", "booked"];
    S.keys = {};
    S.next = 0;
    S.first = 0;
    S.tries = 0;
    S.checkins = 0;
    S.refused = 0;
    S.texts = 0;
    S.app = "not pressed yet";
    S.table = [];
    if (what) api.log(what + " Back to 02:00, four visits booked.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e14", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { version: "3", limit: "2", retry: "all", key: false, report: "02:00", slow: "2.5", teams: false, rollout: "all", again: false };
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          restart(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key) {
        api.control.toggle(id, label, S.C[key], function (on) {
          S.C[key] = !!on;
          restart(api, label + ": " + (on ? "on." : "off."));
        });
      }
      sel("version", "platform version", VERSIONS, "version");
      sel("limit", "limit per try (version 3)", LIMITS, "limit");
      sel("retry", "retry rule (version 3)", RULES, "retry");
      tog("key", "key check at the visit service", "key");
      sel("report", "nightly report runs", REPORTS, "report");
      sel("slow", "visit service's answer during the report", SLOWS, "slow");
      tog("teams", "each team sets its own retries and limits", "teams");
      sel("rollout", "rollout of version 3", ROLLOUTS, "rollout");
      tog("again", "she presses again after an error", "again");
      api.control.button("step", "next visit", function () {
        if (!nextVisit(api)) api.log("no visits left on her route. Change a setting or start over.", "");
        draw(api);
      });
      api.control.button("play", "play the night", function () {
        if (!nextVisit(api)) api.log("no visits left on her route. Change a setting or start over.", "");
        while (nextVisit(api)) { /* every visit still booked */ }
        draw(api);
      });
      api.control.button("over", "start over", function () { api.reset(); });

      S.stat = {
        first: api.stat("first", "check-ins at the 02:00 visit", "bad"),
        tries: api.stat("tries", "tries that reached the visit service", ""),
        checkins: api.stat("checkins", "check-ins written tonight", ""),
        refused: api.stat("refused", "tries refused by the key check", "ok"),
        made: api.stat("made", "visits made", "ok"),
        cancelled: api.stat("cancelled", "visits cancelled as done", "bad"),
        left: api.stat("left", "visits still booked", ""),
        texts: api.stat("texts", "texts from the rota service", "warn"),
        app: api.stat("app", "the app said at the 02:00 visit", ""),
        v3: api.stat("v3", "services on version 3 tonight", ""),
        who: api.stat("who", "who sets the visit service's retries", "")
      };

      api.info("<strong>How to read it.</strong> Each press of check in is a write to the visit service, carried by the sidecar beside the app's service. The sidecar sends the call, waits up to the limit per try, cuts the try, and may retry. A cut try is not stopped: it goes on and saves a check-in when its work ends. Each check-in marks the earliest visit still booked as done. Boxes: grey booked, green made, red cancelled as done before she came. The list shows each try: when it reached the visit service, when it was cut, when it saved.");

      restart(api, "");
      api.log("Tuesday night, 3 November 2026, as built: platform version 3 went into all 40 services this afternoon. Four visits booked for Tobermory: 02:00, 04:00, 06:00 and 08:00.", "warn");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { version: "3", limit: "2", retry: "all", key: false, report: "02:00", slow: "2.5", teams: false, rollout: "all", again: false };
      function as(set) {
        Object.keys(BUILT).forEach(function (k) { t.set(k, set && Object.prototype.hasOwnProperty.call(set, k) ? set[k] : BUILT[k]); });
      }

      // 1. Opening state: before the 02:13:07 press.
      t.expect(t.stat("first") === 0 && t.stat("checkins") === 0 && t.stat("left") === 4 && t.stat("texts") === 0 &&
        t.stat("app") === "not pressed yet" && t.stat("v3") === "40 of 40",
        "Opens before the first press: four visits booked, nothing written, version 3 on all 40 services");

      // 2. As built, the 02:00 visit: four tries at :07, :09, :11, :13, four saves, three visits cancelled.
      begin();
      t.click("step");
      t.expect(t.stat("first") === 4 && t.stat("tries") === 4 && t.stat("cancelled") === 3 && t.stat("made") === 1 && t.stat("left") === 0 &&
        has("02:13:07 try 1 reaches the visit service. Cut at 02:13:09; it carries on and saves at 02:13:09.5.") &&
        has("02:13:13 try 4 reaches the visit service. Cut at 02:13:15; it carries on and saves at 02:13:15.5.") &&
        has("02:13:11.5 check-in saved: the 04:00 visit marked done, cancelled before she came.") &&
        has("02:13:15 the app says: \"Check-in failed. Please try again.\""),
        "As built: tries reach the visit service at 02:13:07, :09, :11, :13; each is cut at 2 s and saves 2.5 s after it began; 04:00, 06:00 and 08:00 cancelled");

      // 3. The rota service's one text at 02:14:00, and the night ends there.
      t.expect(t.stat("texts") === 1 && has("02:14:00 the rota service texts Ciarnait: \"Tobermory: next visits cancelled: done.\"") &&
        has("night over: check-ins written 4, visits made 1, visits cancelled as done 3, texts sent 1."),
        "The rota service texts once at 02:14:00; four check-ins, one visit made, three cancelled");

      // 4. Version 2: one try, one check-in at the 02:00 visit; all four visits made.
      as({ version: "2" });
      t.click("play");
      t.expect(t.stat("first") === 1 && t.stat("made") === 4 && t.stat("cancelled") === 0 && t.stat("texts") === 0 &&
        t.stat("app") === "Checked in.",
        "Version 2: no retries, one check-in at 02:13:09.5, all four visits made");

      // 5. Key check on: four tries, one check-in, three refused.
      as({ key: true });
      t.click("play");
      t.expect(t.stat("first") === 1 && t.stat("refused") === 3 && t.stat("cancelled") === 0 && t.stat("made") === 4,
        "Key check: the four tries become one check-in; three refused");

      // 6. Retry only safe calls: one try; a second press with the key off cancels the 04:00 visit.
      as({ retry: "safe" });
      t.click("play");
      var safeOne = t.stat("first") === 1 && t.stat("cancelled") === 0 && t.stat("app") === FAILED;
      begin();
      as({ retry: "safe", again: true });
      t.click("play");
      t.expect(safeOne && t.stat("first") === 2 && t.stat("cancelled") === 1 &&
        has("02:13:09 the app says: \"Check-in failed. Please try again.\"") &&
        has("02:13:14 try 1 of the second press reaches the visit service. Cut at 02:13:16; it carries on and saves at 02:13:16.5."),
        "Safe to repeat only: one write; but her second press at 02:13:14 saves another and cancels the 04:00 visit");

      // 7. Safe only, key on, second press: the key catches the second press.
      as({ retry: "safe", key: true, again: true });
      t.click("play");
      t.expect(t.stat("first") === 1 && t.stat("refused") === 1 && t.stat("cancelled") === 0 && t.stat("texts") === 0,
        "Safe only with the key: the second press is refused; one check-in, nothing cancelled");

      // 8. Report at 04:00: the duplicates move to the 04:00 visit.
      begin();
      as({ report: "04:00" });
      t.click("play");
      t.expect(t.stat("first") === 1 && t.stat("checkins") === 5 && t.stat("made") === 2 && t.stat("cancelled") === 2 &&
        has("04:13:15.5 check-in saved; no visit left to mark.") && has("04:14:00 the rota service texts Ciarnait"),
        "Report at 04:00: one check-in at 02:13; four at 04:13; 06:00 and 08:00 cancelled; text at 04:14:00");

      // 9. Limit 10 s: fine at 2.5 s; with a 12-second answer, four saves again.
      as({ limit: "10" });
      t.click("play");
      var tenOk = t.stat("first") === 1 && t.stat("cancelled") === 0;
      begin();
      as({ limit: "10", slow: "12" });
      t.click("play");
      t.expect(tenOk && t.stat("first") === 4 && t.stat("cancelled") === 3 &&
        has("02:13:37 try 4 reaches the visit service. Cut at 02:13:47; it carries on and saves at 02:13:49."),
        "Limit 10 s: one try at 2.5 s, but a 12-second answer brings back four check-ins and three cancelled visits");

      // 10. Each team sets its own: one try tonight, 40 services set by hand.
      as({ teams: true });
      t.click("play");
      t.expect(t.stat("first") === 1 && t.stat("cancelled") === 0 &&
        t.stat("who") === "each team for its own services: the visits team picks no retries and a 5-second limit; 40 services set by hand",
        "Team-owned settings: one check-in tonight, and 40 services each set by hand");

      // 11. The fix: safe only, key on, a few first, and a second press.
      as({ retry: "safe", key: true, rollout: "few", again: true });
      t.click("play");
      t.expect(t.stat("v3") === "3 of 40 (photos, search, messages; owners told)" && t.stat("first") === 1 && t.stat("cancelled") === 0 &&
        t.stat("made") === 4 && t.stat("texts") === 0,
        "A few first: version 3 on 3 of 40 services, owners told; tonight one check-in and all four visits made");
    }
  });
})();
