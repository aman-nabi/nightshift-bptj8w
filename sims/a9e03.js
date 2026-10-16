/* sims/a9e03-v1.0.0.js  (published as sims/a9e03.js)
   Case a9e03 "The Client Who Doesn't Know": a measure re-counter for an insurance broker's chat
   assistant, from 21:40 on Sunday 1 November 2026 (the draft review just emailed) to the review at
   09:00 on Monday 2 November. No real model runs: every count below is given data, set out here and
   in sim.lede. Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: month (october, september baseline), what counts as
     success (resolved as built, thumbs-up only, the agreed measure), the 'anything else?' prompt,
     match chats to the phone log, a reply to play, reset. Stats: month, success measure, success
     count, share, dashboard colour, 'talk to a person' presses, rang back within 48 hours, done
     without a second contact, windows still open, thumbs-up presses, september baseline, what
     monday's review shows. selfTest: 10 assertions.

   The given data (stated in sim.lede):
   - October, live from Thursday 1 October: 600 chats, each started with a policy number.
     54 pressed 'talk to a person' (the office replies by email); the other 546 ended when the
     client closed the window or after 10 minutes idle, and 'resolved' counts them.
   - Matched by policy number and topic, within 48 hours of each chat's end: 210 of the 546 rang.
     The phone log ends on Saturday 31 October and the office is shut on Sundays, so chats on
     Friday 30 October lose no calls; the 17 chats of Saturday 31 October are counted with calls so
     far (rechecked on Tuesday 3 November).
   - Thumbs-up: 48 of the 600 chats; 6 of those 48 rang back (so 42 of the 336 done).
   - The 'anything else?' prompt: 24 of the 54 answer it instead of pressing 'talk to a person',
     go round again and leave; all 24 ring within 48 hours.
   - September, before the assistant, from the September phone log, counted the same way and set
     once (late-September calls checked against early October's log): 500 first calls, 290 with no
     second call on the same topic within 48 hours.
   - Each reply is played on a month like October: the same 600 chats.

   Where every number comes from (conventions rule 14; the case is content/latent/a9/a9e03-v1.0.0.json):
   - resolved = 600 - 54 = 546; 546 / 600 = 91%, at or above the 80% target, so green.
   - done without a second contact = 546 - 210 = 336 of 600 = 56%.
   - with the prompt: 'talk to a person' 54 - 24 = 30; resolved 600 - 30 = 570 (95%);
     rang 210 + 24 = 234; done 570 - 234 = 336, unchanged.
   - thumbs-up only: 48 of 600 = 8%, red.
   - september baseline: 290 of 500 = 58%. the agreed measure, 336 of 600 (56%), sits below it: amber.
   - warn reply: paused tuesday 3 to monday 16 november, 14 days, 10 working days;
     600 x 14 / 31 = 270.97, about 271 questions back on the phones.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var CHATS = 600;
  var TALK = 54;
  var RANG = 210;
  var SWITCHED = 24;           // with the prompt: answer it instead of 'talk to a person', then ring
  var THUMBS = 48;
  var THUMBS_RANG = 6;
  var OPEN31 = 17;             // chats on saturday 31 october, 48 hours still running
  var SEPT_FIRST = 500;
  var SEPT_DONE = 290;
  var TARGET = 80;
  var OCT_DAYS = 31;
  var PAUSE_DAYS = 14;
  var PAUSE_WORKDAYS = 10;

  var MONTHS = [
    { value: "october", label: "october (live from thursday 1 october)" },
    { value: "september", label: "september baseline (phone log, before the assistant)" }
  ];
  var MEASURES = [
    { value: "resolved", label: "resolved: no 'talk to a person' (as built)" },
    { value: "thumbs", label: "thumbs-up only" },
    { value: "agreed", label: "no second contact within 48 hours (the owner's words)" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: add 'anything else?' prompts" },
    { value: "r1", label: "reply 1: resolved only on thumbs-up" },
    { value: "r2", label: "reply 2: pause for two weeks of discovery" },
    { value: "r3", label: "reply 3: agree one measure, september baseline" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function pct(n, d) { return Math.round(n * 100 / d); }
  function of(n, d) { return n + " of " + d; }
  function defaults() {
    return { month: "october", measure: "resolved", prompt: false, matched: false, counted: false, plan: "none" };
  }
  function baselineText() { return of(SEPT_DONE, SEPT_FIRST) + " (" + pct(SEPT_DONE, SEPT_FIRST) + "%)"; }

  /* ---------- the count (pure: settings in, numbers out) ---------- */

  function count(C) {
    var R = {};
    R.talk = C.prompt ? TALK - SWITCHED : TALK;
    R.ended = CHATS - R.talk;
    R.rang = C.prompt ? RANG + SWITCHED : RANG;
    R.done = R.ended - R.rang;
    R.baseline = C.counted || C.month === "september" ? baselineText() : "not counted yet";
    if (C.month === "september") {
      R.monthText = "september (before the assistant)";
      R.talkText = "no chats";
      R.rangText = "no chats";
      R.doneText = "no chats";
      R.openText = "no chats";
      R.thumbsText = "no chats";
      if (C.measure === "agreed") {
        R.success = of(SEPT_DONE, SEPT_FIRST);
        R.share = pct(SEPT_DONE, SEPT_FIRST) + "%";
        R.colour = "grey: this is the baseline";
      } else {
        R.success = "no chats (live from 1 october)";
        R.share = "none";
        R.colour = "grey: no chats";
      }
      return R;
    }
    R.monthText = "october";
    R.talkText = R.talk;
    R.thumbsText = THUMBS;
    R.rangText = C.matched ? R.rang : "not matched yet";
    R.doneText = C.matched ? of(R.done, CHATS) : "not matched yet";
    R.openText = C.matched ? OPEN31 : "not matched yet";
    if (C.measure === "resolved") {
      R.success = of(R.ended, CHATS);
      R.share = pct(R.ended, CHATS) + "%";
      R.colour = pct(R.ended, CHATS) >= TARGET ? "green" : "red";
    } else if (C.measure === "thumbs") {
      R.success = of(THUMBS, CHATS);
      R.share = pct(THUMBS, CHATS) + "%";
      R.colour = pct(THUMBS, CHATS) >= TARGET ? "green" : "red";
    } else if (!C.matched) {
      R.success = "not matched yet";
      R.share = "none";
      R.colour = "grey: not matched yet";
    } else {
      R.success = of(R.done, CHATS);
      R.share = pct(R.done, CHATS) + "%";
      R.colour = R.done * SEPT_FIRST < SEPT_DONE * CHATS ? "amber: below the september baseline" : "green: at or above the september baseline";
    }
    return R;
  }

  function report(plan) {
    if (plan === "r0") {
      var p = count({ month: "october", measure: "resolved", prompt: true, matched: true, counted: false });
      return "resolved " + p.success + " (" + p.share + "), " + p.colour + "; rang back " + p.rang + "; done without a second contact " + p.doneText;
    }
    if (plan === "r1") {
      var q = count({ month: "october", measure: "thumbs", prompt: false, matched: true, counted: false });
      return "resolved " + q.success + " (" + q.share + "), " + q.colour + "; " + THUMBS_RANG + " of the " + THUMBS + " rang back; done without a second contact " + q.doneText;
    }
    if (plan === "r2") {
      return "paused 3 to 16 november: about " + Math.round(CHATS * PAUSE_DAYS / OCT_DAYS) + " questions back on the phones; " +
        PAUSE_WORKDAYS + " working days billed; by 16 november: her measure in writing, september baseline " + of(SEPT_DONE, SEPT_FIRST);
    }
    if (plan === "r3") {
      var a = count({ month: "october", measure: "resolved", prompt: false, matched: true, counted: true });
      return "monday 09:00: old rule " + a.success + "; done without a second contact " + a.doneText + " (" + pct(a.done, CHATS) +
        "%); september baseline " + baselineText() + "; amber";
    }
    return "not written yet";
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
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var R = count(C);
    var ui = api.state.ui;
    ui.head.textContent = "month: " + R.monthText + ". success counted as: " + pick(MEASURES, C.measure).label +
      ". 'anything else?' prompt: " + (C.prompt ? "on" : "off") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    if (C.month === "september") {
      row(ui, ["september phone log", "count", "no second call within 48 hours"], true);
      row(ui, ["first calls about a question", SEPT_FIRST, SEPT_DONE], false);
    } else {
      row(ui, ["how the chat ended", "chats", "resolved (as built)", "thumbs-up", "no second contact (agreed)"], true);
      row(ui, ["pressed 'talk to a person'", R.talk, "no", 0, "no"], false);
      if (!C.matched) {
        row(ui, ["closed the window or 10 min idle", R.ended, "yes", THUMBS, "not matched yet"], false);
      } else {
        row(ui, ["closed or idle, no call within 48 h", R.done, "yes", THUMBS - THUMBS_RANG, "yes"], false);
        row(ui, ["closed or idle, rang within 48 h, same topic", R.rang, "yes", THUMBS_RANG, "no"], false);
      }
    }
    ui.note.textContent = "success: " + R.success + ". dashboard colour: " + R.colour + ". september baseline: " + R.baseline +
      ". monday's review: " + report(C.plan) + ".";
  }

  function setStats(api) {
    var C = api.state.C;
    var R = count(C);
    var st = api.state.stat;
    st.month(R.monthText);
    st.measure(pick(MEASURES, C.measure).label);
    st.success(R.success);
    st.share(R.share);
    st.colour(R.colour);
    st.talk(R.talkText);
    st.rang(R.rangText);
    st.done(R.doneText);
    st.open(R.openText);
    st.thumbs(R.thumbsText);
    st.baseline(R.baseline);
    st.report(report(C.plan));
  }

  function refresh(api) { draw(api); setStats(api); }

  function matchLog(api, before) {
    var R = count(api.state.C);
    api.log("22:10. the owner forwards the october phone log: 'then why are clients still ringing us twice?'", "warn");
    api.log("match, step 1: each of the " + R.ended + " resolved chats' policy number and end time. step 2: calls from that policy number within the next 48 hours. step 3: same topic only. rang back: " +
      before + " before, " + R.rang + " after.", "bad");
    api.log("done without a second contact: " + R.ended + " - " + R.rang + " = " + R.done + " of " + CHATS + ". the " + OPEN31 +
      " chats of saturday 31 october still have hours to run: calls so far counted, recheck on tuesday.", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.matched = true;
    if (plan === "r0") { C.prompt = true; }
    if (plan === "r1") { C.measure = "thumbs"; }
    if (plan === "r2") { C.measure = "agreed"; C.counted = true; }
    if (plan === "r3") { C.measure = "agreed"; C.counted = true; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = count(api.state.C);
    if (plan === "r0") api.log("a month like october with the prompt: " + SWITCHED + " of the " + TALK + " answer it instead of pressing 'talk to a person', then ring. resolved " +
      R.success + ", " + R.colour + "; rang back " + R.rang + "; done " + R.ended + " - " + R.rang + " = " + R.done + " of " + CHATS + ", unchanged.", "bad");
    if (plan === "r1") api.log("resolved on thumbs-up only: " + R.success + " (" + R.share + "), " + R.colour + ". " + THUMBS_RANG + " of the " + THUMBS +
      " rang back anyway. done without a second contact: " + R.doneText + ", unchanged.", "bad");
    if (plan === "r2") api.log("assistant off for " + PAUSE_DAYS + " days: " + CHATS + " chats in " + OCT_DAYS + " days is about " + Math.round(CHATS / OCT_DAYS) +
      " a day, so about " + Math.round(CHATS * PAUSE_DAYS / OCT_DAYS) + " questions go back to the phones. under her measure october reads " + R.success + ".", "warn");
    if (plan === "r3") api.log("monday 09:00: resolved, old rule, " + of(R.ended, CHATS) + "; done without a second contact " + R.success + " (" + R.share +
      "); september baseline " + R.baseline + ". dashboard: " + R.colour + ".", "ok");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.month.set(S.C.month);
        S.ctl.measure.set(S.C.measure);
        S.ctl.prompt.set(S.C.prompt);
        S.sync = false;
      }
      function clearPlan() {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        }
      }
      S.ctl.month = api.control.select("month", "month", MONTHS, "october", function (val) {
        if (S.sync) return;
        var o = pick(MONTHS, val);
        if (!o) return;
        clearPlan();
        S.C.month = String(o.value);
        if (S.C.month === "september") S.C.counted = true;
        refresh(api);
        var R = count(S.C);
        api.log("month: " + o.label + ". " + (S.C.month === "september" ? "september phone log, counted once: " + SEPT_DONE + " of " + SEPT_FIRST +
          " first calls had no second call on the same topic within 48 hours." : "success: " + R.success + ", " + R.colour + "."), "");
      });
      S.ctl.measure = api.control.select("measure", "what counts as success", MEASURES, "resolved", function (val) {
        if (S.sync) return;
        var o = pick(MEASURES, val);
        if (!o) return;
        var before = count(S.C);
        clearPlan();
        S.C.measure = String(o.value);
        if (S.C.measure === "agreed") S.C.counted = true;   // agreeing the measure means taking its baseline
        refresh(api);
        var R = count(S.C);
        api.log("success counted as " + o.label + ": " + before.success + " before, " + R.success + " after. dashboard: " + R.colour + "." +
          (S.C.measure === "thumbs" && S.C.month === "october" && S.C.matched ? " " + THUMBS_RANG + " of the " + THUMBS + " rang back." : ""),
          R.colour.indexOf("red") === 0 ? "bad" : (R.colour.indexOf("amber") === 0 ? "warn" : ""));
      });
      S.ctl.prompt = api.control.toggle("prompt", "'anything else?' prompt", false, function (on) {
        if (S.sync) return;
        var before = count(S.C);
        clearPlan();
        S.C.prompt = !!on;
        refresh(api);
        var R = count(S.C);
        api.log("'anything else?' prompt " + (on ? "on" : "off") + ". 'talk to a person': " + before.talk + " before, " + R.talk + " after. resolved: " +
          of(before.ended, CHATS) + " before, " + of(R.ended, CHATS) + " after." + (S.C.matched ? " rang back " + R.rang + "; done " + of(R.done, CHATS) + "." : ""), "");
      });
      S.ctl.match = api.control.button("match", "match chats to the phone log", function () {
        if (S.C.matched) { api.log("already matched.", ""); return; }
        clearPlan();
        S.C.matched = true;
        refresh(api);
        matchLog(api, 0);
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api);
        api.log("reply: " + o.label + ".", "");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        month: api.stat("month", "month", ""),
        measure: api.stat("measure", "success counted as", ""),
        success: api.stat("success", "success, counted", ""),
        share: api.stat("share", "share", ""),
        colour: api.stat("colour", "dashboard colour (target 80%)", ""),
        talk: api.stat("talk", "pressed 'talk to a person'", ""),
        rang: api.stat("rang", "rang within 48 hours, same topic", "bad"),
        done: api.stat("done", "done without a second contact", ""),
        open: api.stat("open", "chats with 48 hours still running", "warn"),
        thumbs: api.stat("thumbs", "thumbs-up pressed, of 600", ""),
        baseline: api.stat("baseline", "september baseline", ""),
        report: api.stat("report", "monday's review shows", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of october's 600 chats, by how the chat ended: the client pressed 'talk to a person', or closed the window or went 10 minutes idle. Once matched to the phone log by policy number and topic, the second group splits into clients with no call within 48 hours and clients who rang. The columns say whether each group counts as a success under each rule. September has no chats: its row is the phone log's first calls, the baseline.");

      refresh(api);
      api.log("sunday 1 november, 21:40. the draft review is emailed to the owner. the dashboard reads resolved 546 of 600, green. the phone log hasn't arrived.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: 21:40, the dashboard green, nothing matched.
      t.expect(t.stat("month") === "october" && t.stat("success") === "546 of 600" && t.stat("share") === "91%" && t.stat("colour") === "green" &&
        t.stat("talk") === 54 && t.stat("rang") === "not matched yet" && t.stat("done") === "not matched yet" && t.stat("thumbs") === 48 &&
        t.stat("baseline") === "not counted yet" && has("21:40") && has("the phone log hasn't arrived"),
        "Opens at 21:40: resolved 546 of 600, 91%, green; nothing matched yet");

      // 2. The match at 22:10: 210 rang back; 336 of 600 done.
      t.click("match");
      t.expect(t.stat("rang") === 210 && t.stat("done") === "336 of 600" && t.stat("open") === 17 && t.stat("success") === "546 of 600" &&
        has("then why are clients still ringing us twice?") && has("rang back: 0 before, 210 after") && has("546 - 210 = 336 of 600"),
        "Match: 210 rang back, done 546 - 210 = 336 of 600, 17 windows still running; the dashboard still says 546");

      // 3. The 'anything else?' prompt raises resolved; done stays 336.
      t.set("prompt", true);
      t.expect(t.stat("talk") === 30 && t.stat("success") === "570 of 600" && t.stat("share") === "95%" && t.stat("rang") === 234 &&
        t.stat("done") === "336 of 600" && has("'talk to a person': 54 before, 30 after"),
        "Prompt on: talk to a person 30, resolved 570 of 600 (95%), rang 234, done still 336 of 600");

      // 4. Thumbs-up only: a small count, red.
      t.set("prompt", false);
      t.set("measure", "thumbs");
      t.expect(t.stat("success") === "48 of 600" && t.stat("share") === "8%" && t.stat("colour") === "red" && t.stat("done") === "336 of 600" &&
        has("6 of the 48 rang back"), "Thumbs-up only: 48 of 600, 8%, red; 6 of the 48 rang back; done still 336");

      // 5. The agreed measure: 336 of 600, amber once the baseline is known.
      t.set("measure", "agreed");
      t.expect(t.stat("success") === "336 of 600" && t.stat("share") === "56%" && t.stat("colour") === "amber: below the september baseline" &&
        t.stat("baseline") === "290 of 500 (58%)",
        "Agreed measure: 336 of 600, 56%, amber below the september baseline");

      // 6. September: the baseline, from the phone log, set once.
      t.set("month", "september");
      t.expect(t.stat("success") === "290 of 500" && t.stat("share") === "58%" && t.stat("baseline") === "290 of 500 (58%)" &&
        t.stat("talk") === "no chats" && has("290 of 500 first calls had no second call on the same topic within 48 hours"),
        "September baseline: 290 of 500 first calls, 58%");

      // 7. Reply 0: the prompt lifts the dashboard; the calls don't move.
      t.set("plan", "r0");
      t.expect(t.stat("report") === "resolved 570 of 600 (95%), green; rang back 234; done without a second contact 336 of 600" &&
        t.stat("month") === "october" && has("done 570 - 234 = 336 of 600, unchanged"),
        "Reply 0: resolved 570 of 600, green; 234 rang; done 336 of 600");

      // 8. Reply 1: thumbs-up only turns the dashboard red.
      t.set("plan", "r1");
      t.expect(t.stat("report") === "resolved 48 of 600 (8%), red; 6 of the 48 rang back; done without a second contact 336 of 600" &&
        t.stat("colour") === "red", "Reply 1: 48 of 600, red; done still 336 of 600");

      // 9. Reply 2: the pause costs about 271 questions and 10 working days.
      t.set("plan", "r2");
      t.expect(t.stat("report") === "paused 3 to 16 november: about 271 questions back on the phones; 10 working days billed; by 16 november: her measure in writing, september baseline 290 of 500" &&
        has("about 19 a day, so about 271 questions"), "Reply 2: about 271 questions back on the phones, 10 working days");

      // 10. Reply 3: both numbers on monday, with the baseline; amber.
      t.set("plan", "r3");
      t.expect(t.stat("report") === "monday 09:00: old rule 546 of 600; done without a second contact 336 of 600 (56%); september baseline 290 of 500 (58%); amber" &&
        t.stat("success") === "336 of 600" && t.stat("colour") === "amber: below the september baseline" && t.stat("baseline") === "290 of 500 (58%)",
        "Reply 3: old rule 546, agreed 336 of 600 against 290 of 500, amber");
    }
  });
})();
