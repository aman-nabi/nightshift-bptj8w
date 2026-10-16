/* sims/a10e02-v1.0.0.js  (published as sims/a10e02.js)
   Case a10e02 "Two Phases": a two-clock job planner for the Strathcarne Bridge's night reports. The
   contractor's model (Llama 3.1 8B on its own A100 80GB) reads each section's notes, then writes its
   report. No real model runs here and no report text exists in this file: every figure is worked out
   from the given numbers below (also stated in sim.lede). Widget-style sim: it draws its own table in
   api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: sections sent at once (1, 8, 32), report length (3, 1,000
     or 2,000 tokens), notes length (2,000 or 500 tokens), card (the A100 80GB, or twice the sums a second
     on the same road), start time (03:30, 04:00, 04:30), play the night, play a reply, reset. Stats: the
     plan sheet's figure, reading, time to first token, time between tokens, time per section, the whole
     job, when it ends, against 05:30, progress at 05:00, writing throughput. selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 8B: 8.03 billion weights, 16.06 billion bytes in 16 bits (about 15 GB on the card's meter).
   - A100 80GB: 2,039 GB/s, 312 TFLOPS dense (16-bit). The road's floor for one token: 16.06 / 2,039 =
     7.9 ms.
   - the contractor's own measurements, never a source's: reading runs at 10,000 tokens a second (a
     2,000-token section in 0.2 s); the writing curve is 10 ms plus 0.25 ms for every answer in a pass,
     rounded here to whole ms: 1 answer 10 ms (10.25 rounded, as this case does), 4 answers 11 ms,
     8 answers 12 ms, 32 answers 18 ms.
   - a card with twice the sums a second on the same road: reading at 20,000 tokens a second, writing
     unchanged (writing waits on the road). a what-if, not a real product.
   - 900 sections; notes 2,000 tokens; a report 1,000 tokens (a grade 3, January's report 2,000).
   - the bridge closes 22:00 Tuesday 8 September 2026, reopens 05:30 Wednesday 9 September; inspection
     ends 03:20; the job starts at 03:30; the engineer phones at 05:00.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e02-v1.0.0.json).
   All times are kept in whole milliseconds so sums stay exact.
   - the plan sheet: 900 x (2,000 + 1,000) / 10,000 = 270 s, 4.5 minutes; with grades 900 x 2,003 /
     10,000 = 180.27 s, about 3 minutes.
   - one section, one at a time: reading 2,000 / 10,000 = 0.2 s; time to first token = reading + the
     first pass = 0.21 s; time between tokens 10 ms; the section = 0.21 + 999 x 0.01 = 0.2 + 1,000 x 0.01
     = 10.2 s.
   - the job: 900 x 10.2 = 9,180 s = 2 h 33 min; 03:30 + 2 h 33 min = 06:03:00, 33 min after 05:30.
   - at 05:00 (5,400 s in): 529 done (529 x 10.2 = 5,395.8 s; section 530 starts at 04:59:55);
     at 03:34:30, the sheet's end: 26 done; at 05:30 (7,200 s in): 705 done, 195 to go.
   - grades: 0.2 + 3 x 0.01 = 0.23 s; 900 x 0.23 = 207 s (3 min 27 s, "about 3.5 minutes"), ending
     03:33:27.
   - 32 at once: 28 groups of 32 and one of 4. a group of 32: reading 32 x 0.2 = 6.4 s, then 1,000
     passes of 18 ms = 18 s, 24.4 s; first token waits up to 6.4 + 0.018 = 6.42 s. the group of 4:
     0.8 + 11 = 11.8 s. 28 x 24.4 + 11.8 = 695 s = 11 min 35 s, ending 03:41:35. writing throughput
     32 / 0.018 = 1,778 tokens a second (the rough sum: 900,000 / 1,778 = 506 s, about 8.5 minutes,
     plus 180 s of reading, about 3: "about 12 minutes").
   - 8 at once: 112 groups of 8 (1.6 + 12 = 13.6 s) and one of 4: 1,535 s = 25 min 35 s; 667 a second.
   - twice the sums: reading 0.1 s; 900 x 10.1 = 9,090 s = 2 h 31 min 30 s, ending 06:01:30, 534 at 05:00
     (90 s saved).
   - notes cut to 500 tokens: reading 0.05 s; 900 x 10.05 = 9,045 s = 2 h 30 min 45 s, ending 06:00:45,
     537 at 05:00 (135 s saved).
   - the cold case, 2,000-token reports, 32 at once: 28 x (6.4 + 36) + (0.8 + 22) = 1,210 s =
     20 min 10 s, ending 03:50:10.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SECTIONS = 900;
  var DEADLINE = 5 * 3600 + 30 * 60;   // 05:30, reopening
  var CALL = 5 * 3600;                 // 05:00, the engineer's call
  var CARDS = {
    a100: { name: "A100 80GB", readRate: 10000 },
    twice: { name: "twice the sums, same road", readRate: 20000 }
  };
  var CARD_LIST = [
    { value: "a100", label: "A100 80GB: reading 10,000 tokens a second" },
    { value: "twice", label: "twice the sums a second, same road" }
  ];
  var AT_ONCE = [
    { value: "1", label: "1 (the script tonight)" },
    { value: "8", label: "8" },
    { value: "32", label: "32" }
  ];
  var ANSWERS = [
    { value: "3", label: "3 tokens (a one-word grade)" },
    { value: "1000", label: "1,000 tokens (a full report)" },
    { value: "2000", label: "2,000 tokens (a longer report)" }
  ];
  var NOTES = [
    { value: "2000", label: "2,000 tokens (as written)" },
    { value: "500", label: "500 tokens (cut)" }
  ];
  var STARTS = [
    { value: "12600", label: "03:30 (tonight)" },
    { value: "14400", label: "04:00" },
    { value: "16200", label: "04:30" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: two speeds, 32 at once" },
    { value: "r1", label: "reply 1: twice the sums a second" },
    { value: "r2", label: "reply 2: grades tonight, reports by day" },
    { value: "r3", label: "reply 3: notes cut to 500 tokens" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = Math.floor(sec);
    return pad2(Math.floor(s / 3600) % 24) + ":" + pad2(Math.floor(s / 60) % 60) + ":" + pad2(s % 60);
  }
  function dur(sec) {
    var s = Math.round(sec);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    var out = [];
    if (h) out.push(h + " h");
    if (m) out.push(m + " min");
    if (r || !out.length) out.push(r + " s");
    return out.join(" ");
  }
  function secs(ms) { return String(Math.round(ms / 10) / 100) + " s"; }
  // The contractor's writing curve, rounded to whole ms: 10 ms plus 0.25 ms per answer in the pass.
  function stepMs(n) { return Math.round(10 + 0.25 * n); }
  function defaults() { return { n: "1", a: "1000", q: "2000", card: "a100", start: "12600", plan: "none" }; }

  /* ---------- the planner (pure: settings in, figures out) ---------- */

  function calc(C) {
    var n = Number(C.n);
    var a = Number(C.a);
    var q = Number(C.q);
    var rate = CARDS[C.card].readRate;
    var start = Number(C.start);
    var readMs = q * 1000 / rate;              // one section's notes, whole ms
    var R = {};
    var groups = [];
    var left = SECTIONS;
    while (left > 0) { var g = Math.min(n, left); groups.push(g); left -= g; }
    var t = 0;
    var ends = [];
    groups.forEach(function (g) {
      t += g * readMs + a * stepMs(g);
      ends.push({ g: g, t: t });
    });
    R.totalMs = t;
    R.readMs = readMs;
    R.stepMs = stepMs(n);
    R.ttftMs = n * readMs + stepMs(n);
    R.sectionMs = n * readMs + a * stepMs(n);
    R.tput = Math.round(n * 1000 / stepMs(n));
    R.sheet = SECTIONS * (q + a) / 10000;
    R.end = start + t / 1000;
    function doneBy(clockSec) {
      var el = (clockSec - start) * 1000;
      var d = 0;
      ends.forEach(function (e) { if (e.t <= el) d += e.g; });
      return d;
    }
    R.at5 = doneBy(CALL);
    R.at530 = doneBy(DEADLINE);
    R.atSheet = doneBy(start + Math.round(R.sheet));
    R.groups = groups;
    var diff = Math.round(R.end - DEADLINE);
    R.text = {
      sheet: fmt(Math.round(R.sheet)) + " s (" + (Math.round(R.sheet / 6) / 10) + " minutes)",
      read: secs(readMs) + " a section, " + fmt(rate) + " tokens a second",
      ttft: secs(R.ttftMs),
      itl: R.stepMs + " ms",
      section: secs(R.sectionMs),
      job: fmt(Math.round(t / 1000)) + " s (" + dur(t / 1000) + ")",
      end: clock(R.end),
      deadline: diff > 0 ? dur(diff) + " after 05:30" : (diff < 0 ? dur(-diff) + " before 05:30" : "at 05:30"),
      at5: R.at5 + " of " + SECTIONS,
      tput: fmt(R.tput) + " tokens a second"
    };
    return R;
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
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th, mark) {
    var tr = ui.el("tr", mark ? "font-weight:bold;" : "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    ui.head.textContent = "900 sections: " + fmt(Number(C.q)) + " tokens of notes read, then " + fmt(Number(C.a)) +
      " tokens written, " + C.n + " at once, on " + CARDS[C.card].name + ", starting " + clock(Number(C.start)) + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["at once", "between tokens", "first token", "whole job", "ends", "done at 05:00"], true);
    AT_ONCE.forEach(function (o) {
      var D = {};
      for (var k in C) D[k] = C[k];
      D.n = o.value;
      var R = calc(D);
      row(ui, [o.value, R.text.itl, R.text.ttft, R.text.job, R.text.end, R.text.at5], false, o.value === C.n);
    });
    var R0 = calc(C);
    ui.note.textContent = "the plan sheet: 900 x " + fmt(Number(C.q) + Number(C.a)) + " tokens / 10,000 a second = " + R0.text.sheet +
      ". it times every token at the reading speed. reading is one pass for all the notes; writing is one pass per token, " +
      R0.text.itl + " each, and one pass serves every report in it.";
  }

  function setStats(api) {
    var R = calc(api.state.C);
    var st = api.state.stat;
    st.sheet(R.text.sheet);
    st.read(R.text.read);
    st.ttft(R.text.ttft);
    st.itl(R.text.itl);
    st.section(R.text.section);
    st.job(R.text.job);
    st.end(R.text.end);
    st.deadline(R.text.deadline);
    st.at5(R.text.at5);
    st.tput(R.text.tput);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = calc(api.state.C);
    if (what) api.log(what + " the job: " + R.text.job + ", ends " + R.text.end + ", " + R.text.deadline + ".",
      R.end > DEADLINE ? "bad" : "ok");
  }

  function playNight(api) {
    var R = calc(defaults());
    api.log("03:30:00  job starts: 900 sections, 1 at a time, 1,000-token reports. the sheet says " + R.text.sheet +
      ", done by " + clock(12600 + 270) + ".", "");
    api.log("03:30:10  section 1 done: reading 0.2 s, first token 0.21 s, then 10 ms a token, 10.2 s in all.", "");
    api.log(clock(12600 + 270) + "  the sheet's finish time: " + R.atSheet + " of 900 done.", "warn");
    api.log("05:00:00  the engineer phones: " + R.at5 + " of 900 done; section 530 began at 04:59:55.", "bad");
    api.log("05:30:00  reopening due: " + R.at530 + " of 900 done, " + (900 - R.at530) + " to go.", "bad");
    api.log(R.text.end + "  section 900 done: " + R.text.job + ", " + R.text.deadline + ".", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.n = "32"; }
    if (plan === "r1") { C.card = "twice"; }
    if (plan === "r2") { C.a = "3"; }
    if (plan === "r3") { C.q = "500"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = calc(api.state.C);
    if (plan === "r0") api.log("two speeds, timed apart: reading 900 x 0.2 s = 180 s; writing 900,000 tokens at " + R.text.tput +
      ". in " + (R.groups.length - 1) + " groups of 32 and one of " + R.groups[R.groups.length - 1] + ": " + R.text.job +
      ", done at " + R.text.end + ". first token waits up to " + R.text.ttft + "; " + R.text.itl + " between tokens.", "ok");
    if (plan === "r1") api.log("twice the sums a second: reading " + R.text.read + ", writing still " + R.text.itl +
      " a token. done at " + R.text.end + ", " + R.text.at5 + " at 05:00.", "bad");
    if (plan === "r2") api.log("one-word grades tonight: " + R.text.section + " a section, all 900 in " + R.text.job +
      ", done at " + R.text.end + ". the 1,000-token reports wait for the day shift.", "warn");
    if (plan === "r3") api.log("notes cut to 500 tokens: reading " + R.text.read + ", writing still " + R.text.itl +
      " a token. done at " + R.text.end + ", " + R.text.at5 + " at 05:00, " + Math.round(9180 - R.totalMs / 1000) + " s saved.", "bad");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.n.set(S.C.n);
        S.ctl.a.set(S.C.a);
        S.ctl.q.set(S.C.q);
        S.ctl.card.set(S.C.card);
        S.ctl.start.set(S.C.start);
        S.sync = false;
      }
      function chooser(id, label, list, initial) {
        S.ctl[id] = api.control.select(id, label, list, initial, function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          var what = label + ": " + o.label + ".";
          if (S.C.plan !== "none") {
            S.C.plan = "none";
            S.sync = true; S.ctl.plan.set("none"); S.sync = false;
            what += " (reply cleared.)";
          }
          refresh(api, what);
        });
      }
      chooser("n", "sections sent at once", AT_ONCE, "1");
      chooser("a", "report length", ANSWERS, "1000");
      chooser("q", "notes length", NOTES, "2000");
      chooser("card", "card", CARD_LIST, "a100");
      chooser("start", "job starts", STARTS, "12600");
      S.ctl.night = api.control.button("night", "play the night, 03:30 to the end", function () {
        S.C = defaults();
        syncControls();
        S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        draw(api);
        setStats(api);
        playNight(api);
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        sheet: api.stat("sheet", "the plan sheet's figure", ""),
        read: api.stat("read", "reading the notes", ""),
        ttft: api.stat("ttft", "time to first token (TTFT), longest wait", ""),
        itl: api.stat("itl", "time between tokens (ITL)", "warn"),
        section: api.stat("section", "time per section (or per group)", ""),
        job: api.stat("job", "the whole job", "warn"),
        end: api.stat("end", "the job ends", "bad"),
        deadline: api.stat("deadline", "against reopening", "bad"),
        at5: api.stat("at5", "done at 05:00", ""),
        tput: api.stat("tput", "writing throughput", "")
      };

      api.info("<strong>How to read it.</strong> Each row is the whole job sent 1, 8 or 32 sections at a time. Reading takes all of a section's notes in one pass; writing adds one token per pass, and one pass serves every report in it. Time to first token is the reading of the whole group plus one pass. The bold row is your choice.");

      draw(api);
      setStats(api);
      api.log("03:20 on wednesday 9 september: inspection over, the notes for 900 sections coming in. the script sends 1 section at a time.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state at 03:20, before the job starts: the sheet against one at a time.
      t.expect(t.stat("sheet") === "270 s (4.5 minutes)" && t.stat("read") === "0.2 s a section, 10,000 tokens a second" &&
        t.stat("ttft") === "0.21 s" && t.stat("itl") === "10 ms" && t.stat("section") === "10.2 s" &&
        t.stat("job") === "9,180 s (2 h 33 min)" && t.stat("end") === "06:03:00" && t.stat("deadline") === "33 min after 05:30" &&
        t.stat("at5") === "529 of 900" && t.stat("tput") === "100 tokens a second" && has("03:20 on wednesday 9 september"),
        "Opens at 03:20: the sheet 270 s, reading 0.2 s, first token 0.21 s, 10 ms a token, 10.2 s a section, 9,180 s, 06:03, 529 at 05:00");

      // 2. The night as it happened.
      t.click("night");
      t.expect(has("03:34:30  the sheet's finish time: 26 of 900 done.") &&
        has("05:00:00  the engineer phones: 529 of 900 done; section 530 began at 04:59:55.") &&
        has("05:30:00  reopening due: 705 of 900 done, 195 to go.") &&
        has("06:03:00  section 900 done: 9,180 s (2 h 33 min), 33 min after 05:30."),
        "The night: 26 done at the sheet's 03:34:30, 529 at 05:00, 705 at 05:30, the last at 06:03");

      // 3. One-word grades, as before tonight.
      t.set("a", "3");
      t.expect(t.stat("section") === "0.23 s" && t.stat("job") === "207 s (3 min 27 s)" && t.stat("end") === "03:33:27" &&
        t.stat("sheet") === "180 s (3 minutes)",
        "Grades: 0.23 s a section, 207 s in all, done at 03:33:27; the sheet said about 3 minutes");

      // 4. 32 at once, full reports.
      t.set("a", "1000");
      t.set("n", "32");
      t.expect(t.stat("itl") === "18 ms" && t.stat("tput") === "1,778 tokens a second" && t.stat("ttft") === "6.42 s" &&
        t.stat("section") === "24.4 s" && t.stat("job") === "695 s (11 min 35 s)" && t.stat("end") === "03:41:35" &&
        t.stat("at5") === "900 of 900" && t.stat("deadline") === "1 h 48 min 25 s before 05:30",
        "32 at once: 18 ms a pass, 1,778 a second, first token up to 6.42 s, 695 s in all, done at 03:41:35");

      // 5. 8 at once.
      t.set("n", "8");
      t.expect(t.stat("itl") === "12 ms" && t.stat("tput") === "667 tokens a second" && t.stat("job") === "1,535 s (25 min 35 s)",
        "8 at once: 12 ms a pass, 667 a second, 1,535 s in all");

      // 6. Twice the sums a second, one at a time: reading halves, writing does not move.
      t.set("n", "1");
      t.set("card", "twice");
      t.expect(t.stat("read") === "0.1 s a section, 20,000 tokens a second" && t.stat("itl") === "10 ms" &&
        t.stat("job") === "9,090 s (2 h 31 min 30 s)" && t.stat("end") === "06:01:30" && t.stat("at5") === "534 of 900",
        "Twice the sums: reading 0.1 s, still 10 ms a token, done at 06:01:30, 534 at 05:00");

      // 7. Notes cut to 500 tokens on the A100.
      t.set("card", "a100");
      t.set("q", "500");
      t.expect(t.stat("read") === "0.05 s a section, 10,000 tokens a second" && t.stat("job") === "9,045 s (2 h 30 min 45 s)" &&
        t.stat("end") === "06:00:45" && t.stat("at5") === "537 of 900",
        "500-token notes: reading 0.05 s, 9,045 s in all, done at 06:00:45, 537 at 05:00");

      // 8. Reply 0: the two speeds planned apart, 32 at once.
      t.set("plan", "r0");
      t.expect(t.stat("end") === "03:41:35" && has("two speeds, timed apart: reading 900 x 0.2 s = 180 s; writing 900,000 tokens at 1,778 tokens a second. in 28 groups of 32 and one of 4: 695 s (11 min 35 s), done at 03:41:35."),
        "Reply 0: 28 groups of 32 and one of 4, done at 03:41:35");

      // 9. Reply 1: twice the sums a second.
      t.set("plan", "r1");
      t.expect(has("twice the sums a second: reading 0.1 s a section, 20,000 tokens a second, writing still 10 ms a token. done at 06:01:30, 534 of 900 at 05:00."),
        "Reply 1: done at 06:01:30, still past 05:30");

      // 10. Reply 2: grades tonight.
      t.set("plan", "r2");
      t.expect(t.stat("end") === "03:33:27" && has("one-word grades tonight: 0.23 s a section, all 900 in 207 s (3 min 27 s), done at 03:33:27."),
        "Reply 2: grades done at 03:33:27, the reports left for the day");

      // 11. Reply 3: notes cut to 500 tokens.
      t.set("plan", "r3");
      t.expect(has("notes cut to 500 tokens: reading 0.05 s a section, 10,000 tokens a second, writing still 10 ms a token. done at 06:00:45, 537 of 900 at 05:00, 135 s saved."),
        "Reply 3: 135 s saved, done at 06:00:45");

      // 12. The cold case: 2,000-token reports, 32 at once.
      t.set("n", "32");
      t.set("q", "2000");
      t.set("a", "2000");
      t.expect(t.stat("job") === "1,210 s (20 min 10 s)" && t.stat("end") === "03:50:10" && t.stat("ttft") === "6.42 s",
        "2,000-token reports, 32 at once: 1,210 s, done at 03:50:10; reading unchanged");
    }
  });
})();
