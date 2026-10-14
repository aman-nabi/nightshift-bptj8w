/* sims/a6e02-v1.0.0.js  (published as sims/a6e02.js)
   Case a6e02 "When the Oracle Is Down": an outage replay for the Saraband, a sleeper train
   between two capitals. One question (berth 14's, sent at 01:58:00.00), two providers: the
   main one, down from 01:12:00 to 03:24:00 tonight, and the fallback at a second company,
   reached through an adapter. No real model runs here: every answer comes from two stated
   timetables. Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: the outage (tonight, 3 seconds like the 11
     before, none), how it fails (fast 529s or silent), retries (2 as built, 5, 13), the
     timeout per try (30 s as built, 90 s, 5 s to the first word and 60 s in all), whether the
     fallback gets the timetable tool, whether it says it can't check without one, a third
     provider, when the question is asked (01:58 or 03:30), a plan (one of the four replies),
     Ask, Reset. Stats: tries to the main provider, seconds spent waiting, which path answered,
     when the fallback was asked, tools it got, first word, done, the answer, the verdict, the
     third provider. selfTest: 10 assertions.

   The model (stated in sim.lede). Times are kept in hundredths of a second, so sums are exact.
   - The question is sent at 01:58:00.00 (or 03:30:00.00). A try sent while the main provider is
     down fails: fast, a 529 back 0.2 s after it was sent; silent, nothing until the try's
     first-word timeout (30 s, 90 s or 5 s).
   - Outages: tonight 01:12:00 to 03:24:00; short, 3 s from the moment the question is sent
     ([Q, Q + 3 s)); none.
   - Retry k (k = 1, 2, ...) waits 2^(k-1) s plus the extra JIT[k-1], from the app's record:
     0.13, 0.21, 0.07, 0.18, 0.02, 0.24, 0.11, 0.05, 0.16, 0.09, 0.20, 0.03, 0.14 s.
   - After the last retry fails the app asks the fallback at once. A third provider, if set up,
     is asked only if the fallback fails; tonight it never does.
   - A model with the timetable tool: first word 1.4 s after it is asked, done at 3.2 s. Without
     a tool: 0.8 s and 2.6 s.
   - Answers. With the tool, done before 03:41:00: "Change at Calderwick, platform 4, at 03:41,
     for the 04:05 to Whinmoor." With the tool, done later: "This train has passed Calderwick,
     the last change for Whinmoor tonight. Please ask the steward in coach C." Without it, with
     the honest refusal: "I can't check connections right now. Please ask the steward in coach
     C." Without it, from training (the timetable before 2019): "Change at Skelbrook Junction,
     platform 2, at 02:50."

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e02-v1.0.0.json).
   - Tonight as built: tries at 01:58:00.00, 01:58:01.33 (0.20 + 1.13), 01:58:03.74
     (1.53 + 2.21), each 529 in 0.2 s; waits 3.34 s in all; fallback asked at 01:58:03.94, no
     tool; first word 01:58:04.74; done 01:58:06.54, Skelbrook.
   - The 11 short failures: the third try is never sent before 3.4 s (0.2 + 1 + 0.2 + 2), so any
     failure over within 3 s is cleared. The 3 s preset: try 3 at 01:58:03.74 gets through; main
     model first word 01:58:05.14, done 01:58:06.94, Calderwick.
   - No outage: one try; done 01:58:03.20. Asked again at 03:30: done 03:30:03.20, Calderwick.
   - Tested fallback with the tool: done 01:58:07.14 (3.94 + 3.2), Calderwick. Without the tool,
     refusal on: done 01:58:06.54, "I can't check connections right now ...".
   - Five retries: waits 1.13 + 2.21 + 4.07 + 8.18 + 16.02 = 31.61 s; six 529s 1.20 s; fallback
     asked at 01:58:32.81, done 01:58:35.41, Skelbrook.
   - Thirteen retries: waits 8,191 + 1.63 = 8,192.63 s, thirteen 529s 2.60 s; try 14 at
     04:14:35.23, after 03:24, gets through; first word 04:14:36.63, done 04:14:38.43: passed
     Calderwick. Twelve retries end at 03:06:19.09, still inside the outage.
   - Timeout 90 s with fast 529s: unchanged, 01:58:03.94. Silent outage: 30 s tries, fallback at
     01:59:33.34 (30 + 1.13 + 30 + 2.21 + 30 = 93.34 s); 90 s tries, 02:02:33.34 (273.34 s);
     5 s to the first word, 01:58:18.34 (18.34 s).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var Q = { "0158": 708000, "0330": 1260000 };       // 01:58:00.00 and 03:30:00.00, in 1/100 s
  var TONIGHT = [432000, 1224000];                    // 01:12:00.00 to 03:24:00.00
  var SHORT = 300;                                    // 3 s
  var ERR = 20;                                       // a 529 comes back in 0.2 s
  var JIT = [13, 21, 7, 18, 2, 24, 11, 5, 16, 9, 20, 3, 14];
  var LAST_CHANGE = 1326000;                          // 03:41:00.00 at Calderwick
  var WITH_TOOL = { fw: 140, done: 320 };
  var NO_TOOL = { fw: 80, done: 260 };
  var TIMEOUTS = {
    "30": { first: 3000, label: "30 s a try (as built)" },
    "90": { first: 9000, label: "90 s a try" },
    "split": { first: 500, label: "5 s to the first word, 60 s in all" }
  };
  var LIVE = "Change at Calderwick, platform 4, at 03:41, for the 04:05 to Whinmoor.";
  var LATE = "This train has passed Calderwick, the last change for Whinmoor tonight. Please ask the steward in coach C.";
  var REFUSE = "I can't check connections right now. Please ask the steward in coach C.";
  var STALE = "Change at Skelbrook Junction, platform 2, at 02:50.";
  var VERDICT = {};
  VERDICT[LIVE] = "Right: tonight's timetable.";
  VERDICT[LATE] = "Right, but too late for Calderwick.";
  VERDICT[REFUSE] = "Honest: it can't check.";
  VERDICT[STALE] = "Wrong: Skelbrook closed in 2019.";

  var OUTAGES = [
    { value: "tonight", label: "Tonight: 01:12:00 to 03:24:00" },
    { value: "short", label: "3 seconds from the question, like the 11 before" },
    { value: "none", label: "None" }
  ];
  var KINDS = [
    { value: "fast", label: "Fast: a 529 back in 0.2 s (tonight)" },
    { value: "silent", label: "Silent: nothing comes back" }
  ];
  var RETRIES = [2, 5, 13];
  var QUESTIONS = [
    { value: "0158", label: "01:58, berth 14" },
    { value: "0330", label: "03:30, Liesl asks again" }
  ];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: test the fallback, honest without the tool" },
    { value: "r1", label: "Reply: five retries before the fallback" },
    { value: "r2", label: "Reply: a 90-second timeout" },
    { value: "r3", label: "Reply: a third provider" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(cs) {
    var s = Math.floor(cs / 100);
    return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s % 3600 / 60)) + ":" + two(s % 60) + "." + two(cs % 100);
  }
  function secs(cs) { return Math.floor(cs / 100) + "." + two(cs % 100); }
  function defaults() {
    return { outage: "tonight", kind: "fast", retries: 2, timeout: "30", tool: false, refuse: false, third: false, q: "0158", plan: "none" };
  }

  /* ---------- the model (pure: config in, replay out) ---------- */

  function replay(C) {
    var q = Q[C.q];
    var win = C.outage === "tonight" ? TONIGHT : (C.outage === "short" ? [q, q + SHORT] : [0, 0]);
    var to = TIMEOUTS[C.timeout].first;
    var R = { q: q, tries: [], waits: [], waited: 0, path: "", fellBack: null, tools: "", fw: 0, done: 0, answer: "" };
    var t = q;
    for (var k = 0; k <= C.retries; k++) {
      var down = t >= win[0] && t < win[1];
      if (!down) {
        R.tries.push({ at: t, ok: true });
        R.path = "main provider";
        R.tools = "timetable";
        R.fw = t + WITH_TOOL.fw;
        R.done = t + WITH_TOOL.done;
        R.answer = R.done < LAST_CHANGE ? LIVE : LATE;
        return R;
      }
      var back = t + (C.kind === "fast" ? ERR : to);
      R.tries.push({ at: t, ok: false, back: back });
      if (k < C.retries) {
        var w = Math.pow(2, k) * 100 + JIT[k];
        R.waits.push(w);
        R.waited += w;
        t = back + w;
      } else {
        t = back;
      }
    }
    R.path = "fallback";
    R.fellBack = t;
    if (C.tool) {
      R.tools = "timetable";
      R.fw = t + WITH_TOOL.fw;
      R.done = t + WITH_TOOL.done;
      R.answer = R.done < LAST_CHANGE ? LIVE : LATE;
    } else {
      R.tools = "none";
      R.fw = t + NO_TOOL.fw;
      R.done = t + NO_TOOL.done;
      R.answer = C.refuse ? REFUSE : STALE;
    }
    return R;
  }

  function summary(C, R) {
    var n = R.tries.length;
    var failed = R.tries.filter(function (x) { return !x.ok; }).length;
    var why = C.kind === "fast" ? "529 in 0.2 s" : "no reply in " + secs(TIMEOUTS[C.timeout].first).replace(".00", "") + " s";
    var s = "Replay, question at " + clock(R.q) + ": " + n + (n === 1 ? " try" : " tries") + " to the main provider";
    if (failed) s += "; " + failed + " failed (" + why + ")";
    if (R.waits.length) s += ", waits " + R.waits.map(secs).join(" s, ") + " s";
    if (R.path === "main provider") {
      if (failed) s += "; try " + n + " at " + clock(R.tries[n - 1].at) + " got through";
      s += ". Main model, timetable tool: first word " + clock(R.fw) + ", done " + clock(R.done);
    } else {
      s += ". Fallback asked at " + clock(R.fellBack) + ", tools: " + R.tools +
        (C.third ? ", third provider never asked" : "") + ". First word " + clock(R.fw) + ", done " + clock(R.done);
    }
    return s + ": \"" + R.answer + "\" " + VERDICT[R.answer];
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
    var foot = el("p", "margin:0;", "", box);
    return { el: el, head: head, table: table, foot: foot };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;", String(c), tr); });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Outage: " + pick(OUTAGES, C.outage).label + ", " + pick(KINDS, C.kind).label.split(":")[0].toLowerCase() +
      ". Retries: " + C.retries + ". Timeout: " + TIMEOUTS[C.timeout].label + ". Fallback " + (C.tool ? "gets the timetable tool" : "gets no tool") +
      (C.refuse ? ", says when it can't check" : "") + (C.third ? ". A third provider waits behind it." : ".");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["try", "sent", "came back", "then"], true);
    var R = S.R;
    if (!R) {
      ui.foot.textContent = "01:11. The main provider is up. Nothing asked yet.";
      return;
    }
    R.tries.forEach(function (x, i) {
      var then = x.ok ? "answered" : (i < R.waits.length ? "wait " + secs(R.waits[i]) + " s" : "switch to the fallback");
      row(ui, [i + 1, clock(x.at), x.ok ? "first word " + clock(R.fw) : (C.kind === "fast" ? "529 at " + clock(x.back) : "nothing; timed out at " + clock(x.back)), then]);
    });
    if (R.path === "fallback") row(ui, ["fallback", clock(R.fellBack), "first word " + clock(R.fw), "tools: " + R.tools]);
    ui.foot.textContent = "Done " + clock(R.done) + ": " + R.answer;
  }

  function setStats(api) {
    var S = api.state;
    var R = S.R;
    var st = S.stat;
    if (!R) {
      st.tries(0); st.waited("0.00"); st.path("not asked yet"); st.fellBack("no"); st.tools("-");
      st.fw("-"); st.done("-"); st.answer("not asked yet"); st.verdict("-"); st.third(S.C.third ? "set up" : "not set up");
      return;
    }
    st.tries(R.tries.length);
    st.waited(secs(R.waited));
    st.path(R.path);
    st.fellBack(R.fellBack === null ? "no" : clock(R.fellBack));
    st.tools(R.tools);
    st.fw(clock(R.fw));
    st.done(clock(R.done));
    st.answer(R.answer);
    st.verdict(VERDICT[R.answer]);
    st.third(!S.C.third ? "not set up" : (R.path === "fallback" ? "never asked" : "not needed"));
  }

  function run(api, what) {
    var S = api.state;
    S.R = replay(S.C);
    draw(api);
    setStats(api);
    api.log((what ? what + " " : "") + summary(S.C, S.R), S.R.answer === STALE ? "bad" : (S.R.answer === LIVE || S.R.answer === REFUSE ? "ok" : "warn"));
  }

  function planOutcome(plan) {
    var base = defaults();
    if (plan === "r0") {
      var gone = defaults(); gone.refuse = true;
      var g = replay(gone);
      return "With the tool taken away on purpose, done " + clock(g.done) + ": \"" + g.answer + "\"";
    }
    if (plan === "r1") {
      base.retries = 13;
      var r = replay(base);
      return "To outlast tonight from 01:58 it needs 13 retries: the main model's first word comes at " + clock(r.fw) + ". " + VERDICT[r.answer];
    }
    if (plan === "r2") {
      base.kind = "silent";
      var a = replay(base);
      base.timeout = "90";
      var b = replay(base);
      return "If the provider went silent instead, the fallback is asked at " + clock(a.fellBack) + " with 30-second tries and " + clock(b.fellBack) + " with 90-second tries.";
    }
    return "The new path has never answered a passenger either.";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e02", {
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
      S.ctl.ask = api.control.button("ask", "Ask the question", function () { run(api, ""); });
      S.ctl.outage = api.control.select("outage", "The main provider's outage", OUTAGES, "tonight", function (v) {
        var o = pick(OUTAGES, v);
        if (!o) return;
        S.C.outage = String(o.value);
        manual("Outage: " + o.label + ".");
      });
      S.ctl.kind = api.control.select("kind", "How a try fails", KINDS, "fast", function (v) {
        var o = pick(KINDS, v);
        if (!o) return;
        S.C.kind = String(o.value);
        manual("Failures: " + o.label + ".");
      });
      S.ctl.retries = api.control.select("retries", "Retries before the fallback", RETRIES.map(function (x) { return { value: x, label: String(x) + (x === 2 ? " (as built)" : "") }; }), 2, function (v) {
        var x = Number(v);
        if (RETRIES.indexOf(x) < 0) return;
        S.C.retries = x;
        manual("Retries: " + x + ".");
      });
      S.ctl.timeout = api.control.select("timeout", "Timeout per try", Object.keys(TIMEOUTS).map(function (k) { return { value: k, label: TIMEOUTS[k].label }; }), "30", function (v) {
        var k = String(v);
        if (!TIMEOUTS[k]) return;
        S.C.timeout = k;
        manual("Timeout: " + TIMEOUTS[k].label + ".");
      });
      S.ctl.tool = api.control.toggle("tool", "Fallback gets the timetable tool (adapter fixed)", false, function (on) {
        S.C.tool = !!on;
        manual("Timetable tool for the fallback: " + (on ? "on." : "off."));
      });
      S.ctl.refuse = api.control.toggle("refuse", "Without the tool, the fallback says it can't check", false, function (on) {
        S.C.refuse = !!on;
        manual("Honest refusal without the tool: " + (on ? "on." : "off."));
      });
      S.ctl.third = api.control.toggle("third", "A third provider behind the fallback", false, function (on) {
        S.C.third = !!on;
        manual("Third provider: " + (on ? "on." : "off."));
      });
      S.ctl.q = api.control.select("q", "When the question is asked", QUESTIONS, "0158", function (v) {
        var o = pick(QUESTIONS, v);
        if (!o) return;
        S.C.q = String(o.value);
        manual("Question: " + o.label + ".");
      });
      S.ctl.plan = api.control.select("plan", "Play a reply (replays tonight at 01:58)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = defaults();
        C.plan = String(o.value);
        if (C.plan === "r0") { C.tool = true; C.refuse = true; }
        if (C.plan === "r1") C.retries = 5;
        if (C.plan === "r2") C.timeout = "90";
        if (C.plan === "r3") C.third = true;
        S.C = C;
        S.ctl.outage.set(C.outage); S.ctl.kind.set(C.kind); S.ctl.retries.set(C.retries); S.ctl.timeout.set(C.timeout);
        S.ctl.tool.set(C.tool); S.ctl.refuse.set(C.refuse); S.ctl.third.set(C.third); S.ctl.q.set(C.q);
        run(api, "Plan: " + o.label + ".");
        api.log(planOutcome(C.plan), "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        tries: api.stat("tries", "tries to the main provider", ""),
        waited: api.stat("waited", "seconds spent waiting between tries", ""),
        path: api.stat("path", "which path answered", ""),
        fellBack: api.stat("fellBack", "fallback asked at", "warn"),
        tools: api.stat("tools", "tools the answering model had", ""),
        fw: api.stat("fw", "first word", ""),
        done: api.stat("done", "answer done", ""),
        answer: api.stat("answer", "the answer", ""),
        verdict: api.stat("verdict", "verdict", "bad"),
        third: api.stat("third", "third provider", "")
      };

      api.info("<strong>How to read it.</strong> One question, two providers. Each row is one try to the main provider: when it was sent, what came back, and how long the app waited before the next. After the last retry the app switches to the fallback at the second company, through the adapter. The last line shows which tools the fallback had and what it said.");

      draw(api);
      setStats(api);
      api.log("01:11. The main provider is up. Berth 14's question comes at 01:58:00.00; nothing asked yet.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. The opening state: 01:11, before the outage and the question.
      t.expect(t.stat("tries") === 0 && t.stat("path") === "not asked yet" && t.stat("fellBack") === "no" &&
        t.logText().indexOf("01:11. The main provider is up. Berth 14's question comes at 01:58:00.00; nothing asked yet.") >= 0,
        "Opens at 01:11 with the main provider up and nothing asked");

      // 2. Tonight as built: three 529s, the toolless fallback, Skelbrook at 02:50.
      begin();
      t.click("ask");
      t.expect(has("Replay, question at 01:58:00.00: 3 tries to the main provider; 3 failed (529 in 0.2 s), waits 1.13 s, 2.21 s. Fallback asked at 01:58:03.94, tools: none. First word 01:58:04.74, done 01:58:06.54: \"Change at Skelbrook Junction, platform 2, at 02:50.\" Wrong: Skelbrook closed in 2019.") &&
        t.stat("tries") === 3 && t.stat("waited") === 3.34 && t.stat("tools") === "none" && t.stat("done") === "01:58:06.54",
        "Tonight: 529s at 01:58:00.00, 01:58:01.33 and 01:58:03.74; the fallback, with no tool, names Skelbrook at 01:58:06.54");

      // 3. A 3-second failure, like the 11 before: the third try gets through.
      begin();
      t.set("outage", "short");
      t.expect(has("3 tries to the main provider; 2 failed (529 in 0.2 s), waits 1.13 s, 2.21 s; try 3 at 01:58:03.74 got through. Main model, timetable tool: first word 01:58:05.14, done 01:58:06.94: \"Change at Calderwick, platform 4, at 03:41, for the 04:05 to Whinmoor.\"") &&
        t.stat("path") === "main provider" && 2 * ERR + 100 + 200 === 340,
        "3-second failure: the third try at 01:58:03.74 gets through (never before 3.4 s), Calderwick at 01:58:06.94");

      // 4. No outage, and Liesl's question at 03:30 after the outage.
      t.set("outage", "none");
      var none = t.stat("tries") === 1 && t.stat("done") === "01:58:03.20";
      t.set("outage", "tonight");
      t.set("q", "0330");
      t.expect(none && t.stat("tries") === 1 && t.stat("path") === "main provider" && t.stat("done") === "03:30:03.20" &&
        t.stat("answer") === LIVE,
        "No outage: one try, done 01:58:03.20; at 03:30 after the outage the main model says Calderwick, platform 4");
      t.set("q", "0158");

      // 5. The tested fallback with the timetable tool.
      t.set("tool", true);
      t.expect(t.stat("path") === "fallback" && t.stat("tools") === "timetable" && t.stat("done") === "01:58:07.14" && t.stat("answer") === LIVE,
        "Fallback with the timetable tool: Calderwick, platform 4, done 01:58:07.14");

      // 6. Without the tool, the honest refusal.
      t.set("tool", false);
      t.set("refuse", true);
      t.expect(t.stat("answer") === REFUSE && t.stat("done") === "01:58:06.54" && t.stat("verdict") === "Honest: it can't check.",
        "No tool, refusal on: it says it can't check connections, done 01:58:06.54");
      t.set("refuse", false);

      // 7. More retries: five still reach the toolless fallback; thirteen outlast the outage, too late.
      t.set("retries", 5);
      var five = t.stat("fellBack") === "01:58:32.81" && t.stat("waited") === 31.61 && t.stat("done") === "01:58:35.41" && t.stat("answer") === STALE;
      t.set("retries", 13);
      t.expect(five && t.stat("tries") === 14 && t.stat("path") === "main provider" && t.stat("fw") === "04:14:36.63" && t.stat("answer") === LATE,
        "Five retries: fallback at 01:58:32.81, still Skelbrook; thirteen: the main model at 04:14:36.63, after Calderwick");
      t.set("retries", 2);

      // 8. Timeouts: nothing changes with fast 529s; a silent provider makes each try last its timeout.
      t.set("timeout", "90");
      var fast90 = t.stat("fellBack") === "01:58:03.94";
      t.set("kind", "silent");
      var s90 = t.stat("fellBack") === "02:02:33.34";
      t.set("timeout", "30");
      var s30 = t.stat("fellBack") === "01:59:33.34";
      t.set("timeout", "split");
      t.expect(fast90 && s90 && s30 && t.stat("fellBack") === "01:58:18.34",
        "Fast 529s: the fallback at 01:58:03.94 at 90 s too; silent: 01:59:33.34 (30 s), 02:02:33.34 (90 s), 01:58:18.34 (5 s to the first word)");
      t.set("kind", "fast");
      t.set("timeout", "30");

      // 9. Reply 0: the tested fallback.
      begin();
      t.set("plan", "r0");
      t.expect(has("done 01:58:07.14: \"Change at Calderwick, platform 4, at 03:41, for the 04:05 to Whinmoor.\" Right: tonight's timetable.") &&
        has("With the tool taken away on purpose, done 01:58:06.54: \"I can't check connections right now. Please ask the steward in coach C.\""),
        "Reply 0: the fallback uses the timetable tool, Calderwick by 01:58:07.14; without the tool it says it can't check");

      // 10. Replies 1 to 3.
      begin();
      t.set("plan", "r1");
      var r1 = has("Fallback asked at 01:58:32.81, tools: none. First word 01:58:33.61, done 01:58:35.41") && has("first word comes at 04:14:36.63");
      begin();
      t.set("plan", "r2");
      var r2 = has("Fallback asked at 01:58:03.94, tools: none.") && has("asked at 01:59:33.34 with 30-second tries and 02:02:33.34 with 90-second tries.");
      begin();
      t.set("plan", "r3");
      t.expect(r1 && r2 && has("Fallback asked at 01:58:03.94, tools: none, third provider never asked. First word 01:58:04.74, done 01:58:06.54") &&
        t.stat("third") === "never asked",
        "Replies 1 to 3: five retries reach Skelbrook at 01:58:35.41; a 90-second timeout changes nothing; the third provider is never asked");
    }
  });
})();
