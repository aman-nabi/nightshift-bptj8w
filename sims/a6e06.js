/* sims/a6e06-v1.0.0.js  (published as sims/a6e06.js)
   Case a6e06 "Watching It Think": a trace viewer for the text assistant at Gorsemoor Wood, a
   forest campsite. Every camper's text goes through two steps: a search of the site handbook
   and tonight's notices for the five closest passages, then a language model that writes the
   reply from them. No real model runs here: every number comes from the evening's stated texts
   and one stated timing rule. Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: the night (tonight: searches slow from 21:00 to
     22:30; a worse night: the search silent for the same 90 minutes), search time limit (2 s, as
     built; 10 s), when the search times out (carry on with no passages, as built; refuse and
     point to the ranger), what is recorded (status and total time, as built; every question
     and reply in full, kept forever; a trace per answer, no message text), alert rule (none;
     error rate over 1%; zero passages found; tokens sent under 1,000), a plan (one of the four
     replies), Run the evening, Reset. Stats: answers, errors, error rate, average time 20:00 to
     21:00, average time 21:00 to 22:30, passages found at 21:47, tokens sent at 21:47, what the
     21:47 reply said, its total time, what the record shows for 21:47, the first alert,
     messages kept in full. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Each answer sends the model the standing instructions (250 tokens) and the camper's text
     with its pitch and time (counted as 50), plus each passage the search found (800 each, five
     at most): 250 + 50 + 5 x 800 = 4,300 with five passages; 300 with none.
   - The search answers in 0.3 s on a normal night. From 21:00 to 22:30 tonight it takes the
     stated time for each text (2.3 to 2.8 s). On the worse night it never answers in that window.
   - The app waits for the search up to its time limit. If the limit passes first, the search
     step ends at the limit with no passages (carry on), or the reply is a refusal sent at once
     with no model call (refuse).
   - The model (the provider calls it m2) takes 0.9 s plus 0.6 s for every 1,000 tokens sent.
     4,300 tokens: 3.48 s. 300 tokens: 1.08 s. Every answer finishes with reason "stop"; output
     tokens are stated per reply (5 to 18, short one-line replies).
   - Total time = search wait + model time (or the search wait alone for a refusal).
   - Cost, recorded in the trace as a custom field: $3 per million tokens sent, $15 per million
     written.
   - Every answer's status is "ok": nothing raised an error, because the code catches the timeout.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e06-v1.0.0.json):
   - Before 21:00 and after 22:30: 0.3 + 3.48 = 3.78 s, five passages, 4,300 tokens sent.
   - 21:00 to 22:30, as built: 2.0 + 1.08 = 3.08 s, no passages, 300 tokens sent. Six texts:
     21:04 (2.4 s), 21:15 (2.7), 21:29 (2.3), 21:47 (2.6), 22:03 (2.8), 22:18 (2.5).
   - Averages: 20:00 to 21:00, four texts at 3.78 s: 3.78 s. 21:00 to 22:30: 3.08 s. Faster.
     The difference, 0.7 s, is the commenter's "improved by 0.7 seconds".
   - 12 texts, 0 errors, error rate 0%. Tokens sent all evening: 6 x 4,300 + 6 x 300 = 27,600.
   - 21:47, pitch 31, as built: 0 passages, 300 tokens sent, 14 written, cost $0.0011
     (300 x 3 + 14 x 15 = 1,110 millionths of a dollar), 3.08 s,
     "Yes! Fires are allowed in the stone rings after 8 PM."
   - 20:38, pitch 44, the same question: 5 passages, 4,300 sent, "No. A fire ban is in force".
   - Zero-passage alert and tokens-under-1,000 alert: first at 21:04 (pitch 19), 43 minutes
     before 21:47, only when a trace is recorded; with status-only or full-text records neither
     can be checked.
   - Error-rate alert: never fires (0 of 12).
   - Full text kept forever: 12 questions + 12 replies = 24 messages, each tied to a pitch.
   - 10 s limit, tonight: every search finishes, 21:47 has 5 passages, 2.6 + 3.48 = 6.08 s;
     21:00 to 22:30 average (5.88 + 6.18 + 5.78 + 6.08 + 6.28 + 5.98) / 6 = 6.03 s.
   - 10 s limit, worse night: 10.0 + 1.08 = 11.08 s, no passages, the same "Yes!" at 21:47.
   - Refuse, 2 s limit: 21:47 is a refusal at 2.00 s; average 21:00 to 22:30 2.00 s.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var INST = 250;        // standing instructions, tokens
  var Q = 50;            // each camper's text with its pitch and time, counted as 50 tokens
  var PASS = 800;        // one passage
  var TOPK = 5;          // passages asked for
  var NORMAL = 300;      // a normal search: 0.3 s, kept in milliseconds like every time here
  var W0 = 3600;         // 21:00, seconds after 20:00
  var W1 = 9000;         // 22:30
  var REFUSAL = "I can't check the site rules right now. Please call the ranger on the number at the gate.";

  // The evening's texts: time (seconds after 20:00), pitch, question, search ms in the slow
  // window, output tokens with passages, output tokens without, reply with, reply from memory.
  var TEXTS = [
    { t: 360, p: 12, q: "Where's the nearest water tap?", s: 0, o1: 12, o0: 0, a1: "The tap by the shower block, past pitch 9.", a0: "" },
    { t: 1260, p: 7, q: "What time are quiet hours?", s: 0, o1: 13, o0: 0, a1: "Quiet hours are 22:30 to 07:00.", a0: "" },
    { t: 2280, p: 44, q: "Can we have a campfire tonight?", s: 0, o1: 18, o0: 0, a1: "No. A fire ban is in force tonight, from 18:00. Gas stoves only.", a0: "" },
    { t: 3120, p: 3, q: "Is the shop open tomorrow?", s: 0, o1: 10, o0: 0, a1: "Yes, 08:00 to 18:00.", a0: "" },
    { t: 3840, p: 19, q: "Where do we empty a camping toilet?", s: 2400, o1: 10, o0: 10, a1: "At the emptying point behind the shower block.", a0: "At the emptying point by the old barn." },
    { t: 4500, p: 26, q: "When does the gate lock?", s: 2700, o1: 9, o0: 9, a1: "The gate locks at 23:00.", a0: "The gate locks at 22:00." },
    { t: 5340, p: 8, q: "Are dogs allowed on the lake path?", s: 2300, o1: 6, o0: 9, a1: "Yes, on a lead.", a0: "Yes, dogs are welcome everywhere on site." },
    { t: 6420, p: 31, q: "Can we have a campfire tonight?", s: 2600, o1: 18, o0: 14, a1: "No. A fire ban is in force tonight, from 18:00. Gas stoves only.", a0: "Yes! Fires are allowed in the stone rings after 8 PM." },
    { t: 7380, p: 15, q: "Is there hot water in the showers?", s: 2800, o1: 5, o0: 8, a1: "Yes, all night.", a0: "Yes, until 22:00." },
    { t: 8280, p: 40, q: "We arrive late tomorrow. Where do we park?", s: 2500, o1: 10, o0: 7, a1: "In the late-arrivals bay by the gate.", a0: "On the verge by the gate." },
    { t: 9240, p: 22, q: "Can we play music until midnight?", s: 0, o1: 10, o0: 0, a1: "No, quiet hours start at 22:30.", a0: "" },
    { t: 10140, p: 9, q: "Do you sell firewood?", s: 0, o1: 11, o0: 0, a1: "Not tonight: the fire ban stops firewood sales.", a0: "" }
  ];
  var WATCH = 6420;      // 21:47, pitch 31

  var NIGHTS = [
    { value: "slow", label: "Tonight: searches take 2.3 to 2.8 s from 21:00 to 22:30" },
    { value: "silent", label: "A worse night: the search never answers, 21:00 to 22:30" }
  ];
  var LIMITS = [{ value: "2", label: "2 seconds (as built)" }, { value: "10", label: "10 seconds" }];
  var ONTIMEOUT = [
    { value: "carry", label: "Carry on with no passages (as built)" },
    { value: "refuse", label: "Refuse and point to the ranger" }
  ];
  var RECORDS = [
    { value: "status", label: "Status and total time (as built)" },
    { value: "full", label: "Every question and reply in full, kept forever" },
    { value: "trace", label: "A trace per answer: each step, no message text" }
  ];
  var ALERTS = [
    { value: "none", label: "None" },
    { value: "errors", label: "Error rate over 1%" },
    { value: "zero", label: "A search finds zero passages" },
    { value: "drop", label: "Tokens sent under 1,000" }
  ];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: alert on the error rate" },
    { value: "r1", label: "Reply: keep every message forever" },
    { value: "r2", label: "Reply: a 10-second search limit" },
    { value: "r3", label: "Reply: traces, refuse on nothing found" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) { var m = 20 * 60 + Math.floor(sec / 60); return two(Math.floor(m / 60)) + ":" + two(m % 60); }
  function secs(ms) { return (ms / 1000).toFixed(2) + " s"; }
  function money(tin, tout) {
    // dollars to four places: (tin x 3 + tout x 15) / 1,000,000
    var v = Math.round((tin * 3 + tout * 15) / 100);
    return "$0." + ("0000" + v).slice(-4);
  }
  function defaults() {
    return { night: "slow", limit: 2, onTimeout: "carry", record: "status", alert: "none", plan: "none" };
  }

  /* ---------- the model (pure: config in, evening out) ---------- */

  function answer(C, x) {
    var slow = x.t >= W0 && x.t < W1;
    var searchMs = slow ? (C.night === "silent" ? Infinity : x.s) : NORMAL;
    var limitMs = C.limit * 1000;
    var timedOut = searchMs > limitMs;
    var wait = timedOut ? limitMs : searchMs;
    var found = timedOut ? 0 : TOPK;
    var a = { x: x, wait: wait, timedOut: timedOut, found: found, refused: false, model: false, tin: 0, tout: 0, reply: "", ms: wait };
    if (timedOut && C.onTimeout === "refuse") {
      a.refused = true;
      a.reply = REFUSAL;
      return a;
    }
    a.model = true;
    a.tin = INST + Q + found * PASS;
    a.tout = found ? x.o1 : x.o0;
    a.reply = found ? x.a1 : x.a0;
    a.ms = wait + 900 + a.tin * 6 / 10;
    return a;
  }

  function evening(C) {
    var R = { list: [], errors: 0, alert: null, alertNote: "", kept: 0, tin: 0 };
    var canCheck = C.record === "trace";
    for (var i = 0; i < TEXTS.length; i++) {
      var a = answer(C, TEXTS[i]);
      R.list.push(a);
      R.tin += a.tin;
      if (C.record === "full") R.kept += 2;
      if (!R.alert && canCheck) {
        if (C.alert === "zero" && a.found === 0) R.alert = a;
        if (C.alert === "drop" && a.model && a.tin < 1000) R.alert = a;
      }
    }
    if (C.alert === "errors") R.alertNote = "never fired: 0 errors in " + TEXTS.length + " answers";
    else if ((C.alert === "zero" || C.alert === "drop") && !canCheck) R.alertNote = "can't fire: the record doesn't keep " + (C.alert === "zero" ? "passages found" : "tokens sent");
    else if (C.alert === "none") R.alertNote = "none set";
    else if (R.alert) R.alertNote = clock(R.alert.x.t) + ", pitch " + R.alert.x.p + (C.alert === "zero" ? ": 0 passages found" : ": " + fmt(R.alert.tin) + " tokens sent");
    else R.alertNote = "never fired";
    return R;
  }

  function avg(R, from, to) {
    var s = 0, n = 0;
    R.list.forEach(function (a) { if (a.x.t >= from && a.x.t < to) { s += a.ms; n += 1; } });
    return n ? secs(Math.round(s / n)) : "-";
  }
  function find(R, t) { for (var i = 0; i < R.list.length; i++) if (R.list[i].x.t === t) return R.list[i]; return null; }

  function recordLine(C, a) {
    var head = clock(a.x.t) + "  pitch " + a.x.p + "  ";
    if (C.record === "status") return head + "ok  " + secs(a.ms);
    if (C.record === "full") return head + "Q: " + a.x.q + "  A: " + a.reply + "  ok  " + secs(a.ms);
    var s = head + "search: " + secs(a.wait) + (a.timedOut ? ", timed out" : "") + ", " + a.found + " passages | ";
    if (a.refused) s += "refused, no model call";
    else s += "model: m2, prompt v4, " + fmt(a.tin) + " in, " + a.tout + " out, stop, " + money(a.tin, a.tout);
    return s + " | " + secs(a.ms);
  }

  function summary(C, R) {
    var w = find(R, WATCH);
    return "12 texts, 20:00 to 23:00: " + R.errors + " errors. Average time " + avg(R, 0, W0) + " before 21:00, " +
      avg(R, W0, W1) + " from 21:00 to 22:30. Tokens sent all evening: " + fmt(R.tin) + ". 21:47, pitch 31: " +
      w.found + " passages, " + (w.model ? fmt(w.tin) + " tokens sent" : "no model call") + ", " + secs(w.ms) + ", \"" + w.reply + "\"";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var rec = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, rec: rec };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = S.R;
    ui.head.textContent = pick(NIGHTS, C.night).label + ". Search limit " + C.limit + " s. On a time-out: " +
      pick(ONTIMEOUT, C.onTimeout).label.toLowerCase() + ". Recorded: " + pick(RECORDS, C.record).label.toLowerCase() +
      ". Alert: " + pick(ALERTS, C.alert).label.toLowerCase() + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["time", "pitch", "search", "passages", "tokens sent", "total", "reply"], true);
    if (!R) {
      ui.rec.textContent = "20:00. No texts yet.";
      return;
    }
    R.list.forEach(function (a) {
      row(ui, [clock(a.x.t), a.x.p, secs(a.wait) + (a.timedOut ? " (limit)" : ""), a.found,
        a.model ? fmt(a.tin) : "no model call", secs(a.ms), a.reply]);
    });
    ui.rec.textContent = "What your record keeps:\n" + R.list.map(function (a) { return recordLine(C, a); }).join("\n");
  }

  function setStats(api) {
    var S = api.state;
    var R = S.R;
    var st = S.stat;
    if (!R) {
      st.answers(0); st.errors(0); st.rate("0%"); st.avg0("-"); st.avg1("-"); st.found("-"); st.tin("-");
      st.reply("not sent yet"); st.time("-"); st.shows("-"); st.alert(pick(ALERTS, S.C.alert).label); st.kept(0);
      return;
    }
    var w = find(R, WATCH);
    st.answers(R.list.length);
    st.errors(R.errors);
    st.rate("0%");
    st.avg0(avg(R, 0, W0));
    st.avg1(avg(R, W0, W1));
    st.found(w.found);
    st.tin(w.model ? fmt(w.tin) : "no model call");
    st.reply(w.reply);
    st.time(secs(w.ms));
    st.shows(recordLine(S.C, w));
    st.alert(R.alertNote);
    st.kept(R.kept);
  }

  function run(api, what) {
    var S = api.state;
    S.R = evening(S.C);
    draw(api);
    setStats(api);
    var w = find(S.R, WATCH);
    api.log((what ? what + " " : "") + summary(S.C, S.R), w.reply.indexOf("Yes!") === 0 ? "bad" : "ok");
    api.log("Alert: " + S.R.alertNote + ". Record for 21:47: " + recordLine(S.C, w), S.R.alert ? "ok" : "warn");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.alert = "errors";
    if (plan === "r1") C.record = "full";
    if (plan === "r2") C.limit = 10;
    if (plan === "r3") { C.record = "trace"; C.onTimeout = "refuse"; C.alert = "zero"; }
    return C;
  }

  function planOutcome(plan) {
    var C = planConfig(plan);
    C.night = "silent";
    var R = evening(C);
    var w = find(R, WATCH);
    return "On the worse night, with the same plan: 21:47 gets \"" + w.reply + "\" after " + secs(w.ms) + ", " + w.found +
      " passages; alert " + R.alertNote + ".";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        run(api, what);
      }
      function sel(id, label, list, key, initial, conv) {
        S.ctl[id] = api.control.select(id, label, list, initial, function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = conv ? conv(o.value) : String(o.value);
          manual(label + ": " + o.label + ".");
        });
      }
      S.ctl.run = api.control.button("run", "Run the evening", function () { run(api, ""); });
      sel("night", "The night", NIGHTS, "night", "slow");
      sel("limit", "Search time limit", LIMITS, "limit", "2", Number);
      sel("ontimeout", "When the search times out", ONTIMEOUT, "onTimeout", "carry");
      sel("record", "What is recorded", RECORDS, "record", "status");
      sel("alert", "Alert rule", ALERTS, "alert", "none");
      S.ctl.plan = api.control.select("plan", "Play a reply (replays tonight)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value));
        S.C = C;
        S.ctl.night.set(C.night); S.ctl.limit.set(String(C.limit)); S.ctl.ontimeout.set(C.onTimeout);
        S.ctl.record.set(C.record); S.ctl.alert.set(C.alert);
        run(api, "Plan: " + o.label + ".");
        api.log(planOutcome(C.plan), "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        answers: api.stat("answers", "answers sent", ""),
        errors: api.stat("errors", "errors", "ok"),
        rate: api.stat("rate", "error rate", "ok"),
        avg0: api.stat("avg0", "average time, 20:00 to 21:00", ""),
        avg1: api.stat("avg1", "average time, 21:00 to 22:30", ""),
        found: api.stat("found", "passages found for 21:47", "warn"),
        tin: api.stat("tin", "tokens sent for 21:47", "warn"),
        reply: api.stat("reply", "the 21:47 reply", "bad"),
        time: api.stat("time", "21:47 total time", ""),
        shows: api.stat("shows", "what the record shows for 21:47", ""),
        alert: api.stat("alert", "first alert", "ok"),
        kept: api.stat("kept", "messages kept in full", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one camper's text and the reply. The search waits up to its time limit for the five closest passages; then the model is sent the instructions, the text and whatever passages came back. The box under the table shows exactly what your chosen record keeps for each answer.");

      draw(api);
      setStats(api);
      api.log("20:00 at Gorsemoor Wood. 12 texts will come in before 23:00. The company that runs the search moves it to a new machine at 21:00. Nothing answered yet.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: 20:00, nothing answered.
      t.expect(t.stat("answers") === 0 && t.stat("reply") === "not sent yet" &&
        has("20:00 at Gorsemoor Wood. 12 texts will come in before 23:00."),
        "Opens at 20:00 with no texts answered");

      // 2. Tonight as built: every answer ok, and faster after 21:00.
      t.click("run");
      t.expect(t.stat("answers") === 12 && t.stat("errors") === 0 && t.stat("rate") === "0%" &&
        t.stat("avg0") === "3.78 s" && t.stat("avg1") === "3.08 s" &&
        has("Tokens sent all evening: 27,600."),
        "As built: 12 answers, 0 errors, 3.78 s before 21:00 and 3.08 s from 21:00 to 22:30");

      // 3. The 21:47 answer was built on zero passages.
      t.expect(t.stat("found") === 0 && t.stat("tin") === 300 && t.stat("time") === "3.08 s" &&
        t.stat("reply") === "Yes! Fires are allowed in the stone rings after 8 PM." &&
        t.stat("shows") === "21:47  pitch 31  ok  3.08 s",
        "21:47: 0 passages, 300 tokens sent, 3.08 s, the old rule; the log line says only ok");

      // 4. The same question at 20:38 found the ban.
      var a = t.api.state.R.list[2];
      t.expect(a.found === 5 && a.tin === 4300 && a.ms === 3780 && a.reply.indexOf("No. A fire ban") === 0,
        "20:38, pitch 44: 5 passages, 4,300 tokens, 3.78 s, told no");

      // 5. A trace shows the step that failed.
      t.set("record", "trace");
      t.expect(t.stat("shows") === "21:47  pitch 31  search: 2.00 s, timed out, 0 passages | model: m2, prompt v4, 300 in, 14 out, stop, $0.0011 | 3.08 s",
        "Traced: the 21:47 search timed out at 2.00 s with 0 passages; the model was sent 300 tokens");

      // 6. The zero-passage alert needs the trace.
      t.set("alert", "zero");
      var traced = t.stat("alert") === "21:04, pitch 19: 0 passages found";
      t.set("record", "status");
      t.expect(traced && t.stat("alert") === "can't fire: the record doesn't keep passages found",
        "Zero-passage alert: fires at 21:04 with traces; can't fire from the status-only log");

      // 7. Tokens sent under 1,000 also fires at 21:04 with traces.
      t.set("record", "trace");
      t.set("alert", "drop");
      t.expect(t.stat("alert") === "21:04, pitch 19: 300 tokens sent",
        "Tokens-sent alert: fires at 21:04, 300 tokens");

      // 8. Reply 0: an error-rate alert never fires.
      t.set("plan", "r0");
      t.expect(t.stat("alert") === "never fired: 0 errors in 12 answers" &&
        t.stat("reply") === "Yes! Fires are allowed in the stone rings after 8 PM.",
        "Reply 0: the error-rate alert never fires; 21:47 still says yes");

      // 9. Reply 1: every message kept, still no steps.
      t.set("plan", "r1");
      t.expect(t.stat("kept") === 24 &&
        t.stat("shows") === "21:47  pitch 31  Q: Can we have a campfire tonight?  A: Yes! Fires are allowed in the stone rings after 8 PM.  ok  3.08 s",
        "Reply 1: 24 messages kept in full; the record shows what was said, not that the search found nothing");

      // 10. Reply 2: a 10-second limit fixes tonight, not the worse night.
      t.set("plan", "r2");
      var tonight = t.stat("found") === 5 && t.stat("time") === "6.08 s" && t.stat("avg1") === "6.03 s";
      t.expect(tonight && has("On the worse night, with the same plan: 21:47 gets \"Yes! Fires are allowed in the stone rings after 8 PM.\" after 11.08 s, 0 passages; alert none set."),
        "Reply 2: tonight 5 passages and 6.08 s at 21:47; on a worse night 11.08 s and the same yes");

      // 11. Reply 3: traces, refusal and the zero-passage alert.
      t.set("plan", "r3");
      t.expect(t.stat("alert") === "21:04, pitch 19: 0 passages found" && t.stat("time") === "2.00 s" &&
        t.stat("reply") === REFUSAL && t.stat("tin") === "no model call" && t.stat("kept") === 0,
        "Reply 3: alert at 21:04; 21:47 refused at 2.00 s, no model call, no message text kept");
    }
  });
})();
