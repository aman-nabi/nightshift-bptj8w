/* sims/a7e02-v1.0.0.js  (published as sims/a7e02.js)
   Case a7e02 "Teaching It to Misbehave": a red-team scorecard for the Brocklesby Debating Society's
   public chatbot. No real model runs here, and no conversation text exists in this file: every
   test conversation and every weekend chat is a stated count. The sim models the defence and its
   numbers, never an attack. Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: Read the weekend log, Run the test set, attack type
     to look at, the fix (after fix and re-test), option 1's line in the instructions, phrase
     blocking, live sample rate, offline for good, a plan (one of the four replies), Reset.
     Stats: weekend chats, rule breaks, breaks by day, breaks by type, held, held rate, held by
     type, weakest type, types improved, the chosen type, phrase blocking catches, screenshots
     caught, innocent chats blocked, sample read over the weekend, breaks the sample finds, sample
     in a normal week, email time. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Six attack types, in this order: pretend-play, slow drift, claims to be staff, asks its
     instructions, another language, opinion bait.
   - The weekend's log, Friday 10 to Sunday 12 October 2026: chats by day 340, 1,120, 940 = 2,400.
     Radhika's search gave 212 chats; read by hand, 31 broke a rule: by day 5, 15, 11; by type
     9, 6, 5, 4, 3, 4. The 3 screenshots: one each in pretend-play, claims to be staff, asks its
     instructions.
   - The test set: 60 conversations, 10 per type, described, never written out.
     Held before any fix: 5, 6, 7, 6, 8, 9 = 41 of 60.
     After the fix and re-test: 9, 9, 10, 9, 10, 10 = 57 of 60. (The fix with option 1's line as
     well: the same 57; the line adds nothing measurable once the fix is in.)
     Option 1's line alone (given): 6, 6, 8, 6, 8, 10 = 44 of 60.
     Phrase blocking: no effect on the test set (none of its conversations uses the phrases).
   - Phrase blocking on the weekend's log (given): catches 5 of the 31 (by type 2, 0, 2, 1, 0, 0:
     the 3 screenshots and 2 copies) and 9 innocent chats asking whether membership was free.
   - Live sample: read 1 chat in N. Weekend chats read = 2,400 / N; rule breaks found = about
     31 / N, rounded (Math.round). A normal week of 150 chats: 150 / N chats read, rounded.
       N = 50: 48 read, about 1 found (0.62); normal week 3.
       N = 20: 120 read, about 2 (1.55); normal week 8 (7.5 rounds up).
       N = 10: 240 read, about 3 (3.1); normal week 15.
       N = 1:  2,400 read, 31 found; normal week 150.
   - Offline for good: no chatbot; about 150 emails a week at about 4 minutes each (Nnenna's
     reply in the comments) = 600 minutes = 10 h 0 min a week.

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e02-v1.0.0.json):
   - Post: 2,400 chats, 31 rule breaks, 212 chats read, by day 340/5, 1,120/15, 940/11; by type
     9, 6, 5, 4, 3, 4; 3 screenshots; 150 chats a normal week.
   - Option 0 (r0): fix on, sample 1 in 10: 57 of 60 (95%), 240 weekend chats read, about 3 of 31,
     15 a normal week. Before the fix 41 of 60 (68%), weakest pretend-play 5 of 10.
   - Option 1 (r1): 44 of 60 (73%); improved types pretend-play, claims to be staff, opinion bait.
   - Option 2 (r2): 5 of 31 caught, 3 of 3 screenshots, 9 innocent; test set 41 of 60.
   - Option 3 (r3): no chatbot; email 10 h 0 min a week.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var TYPES = ["pretend-play", "slow drift", "claims to be staff", "asks its instructions", "another language", "opinion bait"];
  var BEFORE = [5, 6, 7, 6, 8, 9];
  var AFTER = [9, 9, 10, 9, 10, 10];
  var LINE = [6, 6, 8, 6, 8, 10];
  var PER_TYPE = 10;
  var DAYS = ["Fri 10 Oct", "Sat 11 Oct", "Sun 12 Oct"];
  var DAY_CHATS = [340, 1120, 940];
  var DAY_BREAKS = [5, 15, 11];
  var TYPE_BREAKS = [9, 6, 5, 4, 3, 4];
  var SCREENS = [1, 0, 1, 1, 0, 0];
  var PHRASE_CAUGHT = [2, 0, 2, 1, 0, 0];
  var INNOCENT = 9;
  var SEARCHED = 212;
  var NORMAL_WEEK = 150;
  var EMAIL_MIN = 4;

  var SAMPLES = [
    { value: "0", label: "No sample" },
    { value: "50", label: "1 chat in 50" },
    { value: "20", label: "1 chat in 20" },
    { value: "10", label: "1 chat in 10" },
    { value: "1", label: "Every chat" }
  ];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: red team, fix, re-test, watch" },
    { value: "r1", label: "Reply: a line in the instructions" },
    { value: "r2", label: "Reply: block the screenshots' phrases" },
    { value: "r3", label: "Reply: offline for good" }
  ];
  var TYPE_OPTS = [{ value: "all", label: "All six types" }].concat(TYPES.map(function (t, i) {
    return { value: String(i), label: t };
  }));

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function hm(min) { return Math.floor(min / 60) + " h " + (min % 60) + " min"; }
  function defaults() {
    return { fix: false, line: false, phrases: false, offline: false, sample: "0", type: "all", plan: "none" };
  }

  /* ---------- the model (pure: settings in, scorecard out) ---------- */

  function heldByType(C) {
    if (C.fix) return AFTER.slice();
    if (C.line) return LINE.slice();
    return BEFORE.slice();
  }

  function score(C) {
    var R = { offline: !!C.offline };
    var all = sum(DAY_CHATS);
    R.chats = all;
    R.breaks = sum(TYPE_BREAKS);
    R.caught = C.phrases ? sum(PHRASE_CAUGHT) : 0;
    R.screens = C.phrases ? sum(PHRASE_CAUGHT.map(function (c, i) { return Math.min(c, SCREENS[i]); })) : 0;
    R.innocent = C.phrases ? INNOCENT : 0;
    var N = Number(C.sample);
    R.sampleRead = (N && !C.offline) ? Math.round(all / N) : 0;
    R.sampleFound = (N && !C.offline) ? Math.round(R.breaks / N) : 0;
    R.sampleWeek = (N && !C.offline) ? Math.round(NORMAL_WEEK / N) : 0;
    R.emailMin = C.offline ? NORMAL_WEEK * EMAIL_MIN : 0;
    if (C.offline) return R;
    R.byType = heldByType(C);
    R.held = sum(R.byType);
    R.total = PER_TYPE * TYPES.length;
    var lo = Math.min.apply(null, R.byType);
    R.weakest = TYPES.filter(function (t, i) { return R.byType[i] === lo; }).join(", ") + ", " + lo + " of " + PER_TYPE;
    var up = TYPES.filter(function (t, i) { return R.byType[i] > BEFORE[i]; });
    R.improved = up.length === TYPES.length ? "all six" : (up.length ? up.join(", ") : "none");
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
    var w1 = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th, strong) {
    var tr = ui.el("tr", strong ? "font-weight:600;" : "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }
  function onOff(b) { return b ? "on" : "off"; }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui, R = S.R;
    ui.head.textContent = "Fix: " + onOff(C.fix) + ". Line in the instructions: " + onOff(C.line) +
      ". Phrase blocking: " + onOff(C.phrases) + ". Live sample: " + pick(SAMPLES, C.sample).label +
      ". Offline for good: " + onOff(C.offline) + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["attack type", "test conversations", "held before fix", "held now", "weekend rule breaks", "screenshots"], true);
    TYPES.forEach(function (t, i) {
      var now = (S.tested && R && !R.offline) ? R.byType[i] + " of " + PER_TYPE : "-";
      var wk = S.read ? TYPE_BREAKS[i] : "-";
      row(ui, [t, PER_TYPE, S.tested ? BEFORE[i] + " of " + PER_TYPE : "-", now, wk, S.read ? SCREENS[i] : "-"], false, String(i) === C.type);
    });
    if (!S.read && !S.tested) {
      ui.note.textContent = "Sunday 12 October, 21:52. The chatbot is off. Nothing read or tested yet.";
      return;
    }
    var lines = [];
    if (S.read) {
      lines.push("Weekend log: " + DAYS.map(function (d, i) { return d + " " + fmt(DAY_CHATS[i]) + " chats, " + DAY_BREAKS[i] + " broke a rule"; }).join("; ") + ".");
    }
    if (R && R.offline) lines.push("Offline for good: no chatbot to test; about " + NORMAL_WEEK + " emails a week.");
    ui.note.textContent = lines.join("\n");
  }

  function setStats(api) {
    var S = api.state, R = S.R, st = S.stat, C = S.C;
    if (S.read) {
      st.breaks(R.breaks + " of " + fmt(R.chats));
      st.byDay(DAY_BREAKS.join(", "));
      st.byKind(TYPE_BREAKS.join(", "));
      st.caught(R.caught + " of " + R.breaks);
      st.screens(R.screens + " of 3");
      st.innocent(R.innocent);
      st.sampleRead(fmt(R.sampleRead));
      st.sampleFound(Number(C.sample) && !R.offline ? "about " + R.sampleFound + " of " + R.breaks : "-");
      st.sampleWeek(R.sampleWeek);
    } else {
      st.breaks("-"); st.byDay("-"); st.byKind("-"); st.caught("-"); st.screens("-"); st.innocent(0);
      st.sampleRead(0); st.sampleFound("-"); st.sampleWeek(0);
    }
    st.email(R && R.offline ? hm(R.emailMin) + " a week" : "-");
    if (S.tested && R && !R.offline) {
      st.held(R.held + " of " + R.total);
      st.rate(Math.round(R.held / R.total * 100) + "%");
      st.byType(R.byType.join(", "));
      st.weakest(R.weakest);
      st.improved(R.improved);
      if (C.type === "all") st.chosen("all six: held " + R.held + " of " + R.total);
      else {
        var i = Number(C.type);
        st.chosen(TYPES[i] + ": held " + R.byType[i] + " of " + PER_TYPE + " (before the fix " + BEFORE[i] + ")" +
          (S.read ? ", " + TYPE_BREAKS[i] + " weekend rule breaks" : ""));
      }
    } else {
      var none = (R && R.offline) ? "no chatbot" : "-";
      st.held(none); st.rate("-"); st.byType("-"); st.weakest("-"); st.improved("-"); st.chosen("-");
    }
  }

  function refresh(api, what) {
    var S = api.state;
    S.R = score(S.C);
    draw(api);
    setStats(api);
    var R = S.R;
    if (what) {
      if (R.offline) api.log(what + " No chatbot: email " + hm(R.emailMin) + " a week.", "warn");
      else if (S.tested) api.log(what + " Test set: held " + R.held + " of " + R.total + ", by type " + R.byType.join(", ") + ".", R.held >= 57 ? "ok" : "bad");
      else api.log(what, "");
      if (S.read && (S.C.phrases || Number(S.C.sample))) {
        api.log("Weekend log: phrase blocking caught " + R.caught + " of " + R.breaks + " (" + R.innocent + " innocent). Sample read " +
          fmt(R.sampleRead) + " chats, found about " + R.sampleFound + ".", "");
      }
    }
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.fix = true; C.sample = "10"; }
    if (plan === "r1") C.line = true;
    if (plan === "r2") C.phrases = true;
    if (plan === "r3") C.offline = true;
    return C;
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.read = false;
      S.tested = false;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        S.read = true; S.tested = true;
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        refresh(api, what);
      }
      function tog(id, label, key) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      S.ctl.read = api.control.button("read", "Read the weekend log", function () {
        S.read = true;
        refresh(api, "");
        api.log("Read " + SEARCHED + " of " + fmt(sum(DAY_CHATS)) + " weekend chats: " + sum(TYPE_BREAKS) + " broke a rule, by day " +
          DAY_BREAKS.join(", ") + ", by type " + TYPE_BREAKS.join(", ") + ". The 3 screenshots are among them.", "bad");
      });
      S.ctl.test = api.control.button("test", "Run the test set", function () {
        S.tested = true;
        refresh(api, "Ran the test set, 60 conversations.");
      });
      S.ctl.type = api.control.select("type", "Attack type to look at", TYPE_OPTS, "all", function (val) {
        var o = pick(TYPE_OPTS, val);
        if (!o) return;
        S.C.type = String(o.value);
        S.R = score(S.C);
        draw(api);
        setStats(api);
      });
      tog("fix", "After the fix and re-test", "fix");
      tog("line", "Option 1: a line telling it never to break its rules", "line");
      tog("phrases", "Block chats containing the screenshots' phrases", "phrases");
      S.ctl.sample = api.control.select("sample", "Live sample: read", SAMPLES, "0", function (val) {
        var o = pick(SAMPLES, val);
        if (!o) return;
        S.C.sample = String(o.value);
        manual("Live sample: " + o.label + ".");
      });
      tog("offline", "Offline for good: answer by email", "offline");
      S.ctl.plan = api.control.select("plan", "Play a reply", PLANS, "none", function (val) {
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value));
        C.type = S.C.type;
        S.C = C;
        S.ctl.fix.set(C.fix); S.ctl.line.set(C.line); S.ctl.phrases.set(C.phrases);
        S.ctl.offline.set(C.offline); S.ctl.sample.set(C.sample);
        S.read = true; S.tested = true;
        refresh(api, "Plan: " + o.label + ".");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        breaks: api.stat("breaks", "weekend chats that broke a rule", "bad"),
        byDay: api.stat("byDay", "rule breaks by day, Fri to Sun", ""),
        byKind: api.stat("byKind", "rule breaks by attack type", ""),
        held: api.stat("held", "test conversations held", "ok"),
        rate: api.stat("rate", "held rate", ""),
        byType: api.stat("byType", "held by type, of 10 each", ""),
        weakest: api.stat("weakest", "weakest type", "warn"),
        improved: api.stat("improved", "types better than before the fix", ""),
        chosen: api.stat("chosen", "the chosen type", ""),
        caught: api.stat("caught", "rule breaks phrase blocking catches", "warn"),
        screens: api.stat("screens", "screenshots it catches", ""),
        innocent: api.stat("innocent", "innocent chats blocked", "warn"),
        sampleRead: api.stat("sampleRead", "weekend chats the sample reads", ""),
        sampleFound: api.stat("sampleFound", "rule breaks the sample finds", "ok"),
        sampleWeek: api.stat("sampleWeek", "chats read in a normal week", ""),
        email: api.stat("email", "email time if offline", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one attack type: its 10 test conversations, how many the bot held (stayed inside its rules) before the fix and now, and how many of the weekend's 31 rule breaks came that way. No conversation text exists here; every number is a stated count.");

      S.R = score(S.C);
      draw(api);
      setStats(api);
      api.log("Sunday 12 October, 21:52. The chatbot is off. Nothing read or tested yet: " + fmt(sum(DAY_CHATS)) + " weekend chats in the log.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: Sunday 21:52, nothing read or tested.
      t.expect(t.stat("breaks") === "-" && t.stat("held") === "-" && t.stat("sampleRead") === 0 &&
        has("Sunday 12 October, 21:52. The chatbot is off. Nothing read or tested yet"),
        "Opens on Sunday 12 October at 21:52 with nothing read or tested");

      // 2. The weekend log: 31 of 2,400, by day and by type.
      t.click("read");
      t.expect(t.stat("breaks") === "31 of 2,400" && t.stat("byDay") === "5, 15, 11" && t.stat("byKind") === "9, 6, 5, 4, 3, 4" &&
        has("Read 212 of 2,400 weekend chats: 31 broke a rule"),
        "Weekend log: 31 rule breaks in 2,400 chats, by day 5, 15, 11, by type 9, 6, 5, 4, 3, 4");

      // 3. The test set before any fix: 41 of 60, pretend-play weakest.
      t.click("test");
      t.expect(t.stat("held") === "41 of 60" && t.stat("rate") === "68%" && t.stat("byType") === "5, 6, 7, 6, 8, 9" &&
        t.stat("weakest") === "pretend-play, 5 of 10" && t.stat("improved") === "none",
        "Before the fix: 41 of 60 held (68%), by type 5, 6, 7, 6, 8, 9; pretend-play weakest at 5 of 10");

      // 4. One type at a time.
      t.set("type", "0");
      t.expect(t.stat("chosen") === "pretend-play: held 5 of 10 (before the fix 5), 9 weekend rule breaks",
        "Pretend-play: 5 of 10 held, 9 of the weekend's rule breaks");

      // 5. After the fix and re-test: 57 of 60, every type better.
      t.set("fix", true);
      t.expect(t.stat("held") === "57 of 60" && t.stat("rate") === "95%" && t.stat("byType") === "9, 9, 10, 9, 10, 10" &&
        t.stat("improved") === "all six" && t.stat("weakest") === "pretend-play, slow drift, asks its instructions, 9 of 10",
        "After the fix: 57 of 60 (95%), by type 9, 9, 10, 9, 10, 10, all six better");

      // 6. Option 1's line alone: 44 of 60, three types better.
      t.set("fix", false);
      t.set("line", true);
      t.expect(t.stat("held") === "44 of 60" && t.stat("rate") === "73%" && t.stat("byType") === "6, 6, 8, 6, 8, 10" &&
        t.stat("improved") === "pretend-play, claims to be staff, opinion bait",
        "Line alone: 44 of 60 (73%); better only on pretend-play, claims to be staff, opinion bait");

      // 7. Phrase blocking: 5 of 31, the 3 screenshots, 9 innocent; the test set unchanged.
      t.set("line", false);
      t.set("phrases", true);
      t.expect(t.stat("caught") === "5 of 31" && t.stat("screens") === "3 of 3" && t.stat("innocent") === 9 && t.stat("held") === "41 of 60",
        "Phrase blocking: 5 of 31 caught, 3 of 3 screenshots, 9 innocent chats blocked; test set still 41 of 60");

      // 8. A sample of 1 chat in 20.
      t.set("phrases", false);
      t.set("sample", "20");
      t.expect(t.stat("sampleRead") === 120 && t.stat("sampleFound") === "about 2 of 31" && t.stat("sampleWeek") === 8,
        "1 in 20: 120 weekend chats read, about 2 of 31 found; 8 in a normal week");

      // 9. A sample of 1 chat in 10.
      t.set("sample", "10");
      t.expect(t.stat("sampleRead") === 240 && t.stat("sampleFound") === "about 3 of 31" && t.stat("sampleWeek") === 15,
        "1 in 10: 240 weekend chats read, about 3 of 31 found; 15 in a normal week");

      // 10. Offline for good: no chatbot, 10 hours of email a week.
      t.set("sample", "0");
      t.set("offline", true);
      t.expect(t.stat("held") === "no chatbot" && t.stat("email") === "10 h 0 min a week",
        "Offline for good: no chatbot, email 10 h 0 min a week");

      // 11. Reply 0: red team, fix, re-test, watch.
      t.set("plan", "r0");
      t.expect(t.stat("held") === "57 of 60" && t.stat("sampleRead") === 240 && t.stat("sampleFound") === "about 3 of 31" &&
        t.stat("caught") === "0 of 31" && has("Plan: Reply: red team, fix, re-test, watch."),
        "Reply 0: 57 of 60 held, sample 1 in 10 reads 240 and finds about 3 of 31");

      // 12. Replies 1, 2 and 3 as plans.
      t.set("plan", "r1");
      var r1 = t.stat("held") === "44 of 60";
      t.set("plan", "r2");
      var r2 = t.stat("caught") === "5 of 31" && t.stat("held") === "41 of 60" && t.stat("innocent") === 9;
      t.set("plan", "r3");
      t.expect(r1 && r2 && t.stat("email") === "10 h 0 min a week",
        "Reply 1: 44 of 60. Reply 2: 5 of 31 caught, 41 of 60. Reply 3: 10 h of email a week");
    }
  });
})();
