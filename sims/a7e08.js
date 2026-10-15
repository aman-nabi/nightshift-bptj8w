/* sims/a7e08-v1.0.0.js  (published as sims/a7e08.js)
   Case a7e08 "Who Owns the Answer": a training-data ledger for Kinfold, a family-history service
   that trained a writing assistant on letters its customers uploaded. No real model runs here and no
   letter text exists in this file: each group of letters is a count with flags (a yes to training, a
   deletion receipt, in February's run). The sim models the defence and its numbers, never an attack.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: consent filter, deletion filter, retrain schedule
     (none, quarterly, monthly), output check, retrain in our own country, the date, replay the 01:20
     request, check the backups, a reply to play, reset. Stats: letters on the next training list,
     letters the live model learned from, deleted letters still in the model, days until a deletion
     takes effect, next retrain, last retrain, her sentences reaching the customer, matches caught by
     the output check, letters sent abroad for the next retrain. selfTest: 12 assertions.

   The model (stated in sim.lede, given data):
   - 48,000 letters uploaded since 2019, all in the training run that began Monday 9 February 2026,
     in a cloud region in another country. Mrs Dunstaple's 212 among them.
   - Her 212 deleted from the archive at 15:00 on Friday 4 September, after that day's 02:00 backup;
     backups are kept 35 days, so that copy expired Friday 9 October. Archive now: 47,788.
   - Asked from Monday 21 September, owners of 15,000 letters said yes by Tuesday 13 October; the other
     32,788 said no or did not answer, which counts as no. None of her 212 has a yes.
   - Training list: consent filter on gives 15,000; deletion filter only gives 47,788; neither gives
     February's 48,000, and a retrain on that list stops, because 212 of them have no text left.
   - A retrain always starts again from the bought model, so a valid retrain leaves 0 of her letters
     in the model, and a model retrained without them no longer writes her sentences.
   - Schedule set from Wednesday 14 October: quarterly on 1 January and 1 April 2027; monthly on
     1 November, 1 December, 1 January, 1 February.
   - The 01:20 draft on Wednesday 14 October: 9 sentences, 2 of hers word for word (sentences 4 and 5).
     The output check compares each sentence with the deletion receipts' fingerprints: 2 of 2 caught.
   - A line in the instructions does not change what the model learned: the replay still holds 2.

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e08-v1.0.0.json):
   - As it is: list 48,000, live model 48,000, 212 still in the model, no retrain, 2 sentences reach.
   - Filters: 15,000 (consent), 47,788 (deletion only), 48,000 (neither).
   - Days: 14 October to 1 January is 79 (17 + 30 + 31 + 1); to 1 November is 18.
   - Backups: 4 September plus 35 days is 9 October; copies found on 14 October: 0.
   - Reply 0: 212 in the model, 2 sentences. Reply 1: 15,000, 79 days, 2 of 2 caught, 0 sent abroad,
     and 0 in the model from 1 January. Reply 2: 0 backup copies, 212 in the model. Reply 3: model
     deleted, no assistant.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var UPLOADED = 48000;
  var HERS = 212;
  var ARCHIVE = UPLOADED - HERS;      // 47,788
  var YES = 15000;
  var SENTENCES = 9;
  var MATCHES = 2;
  var TODAY = "2026-10-14";
  var DAYNAME = {
    "2026-10-14": "Wednesday 14 October",
    "2026-11-01": "Sunday 1 November",
    "2026-12-01": "Tuesday 1 December",
    "2027-01-01": "Friday 1 January",
    "2027-02-01": "Monday 1 February",
    "2027-04-01": "Thursday 1 April"
  };
  var SCHEDULES = [
    { value: "none", label: "none planned", days: [] },
    { value: "quarterly", label: "quarterly", days: ["2027-01-01", "2027-04-01"] },
    { value: "monthly", label: "monthly", days: ["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"] }
  ];
  var DATES = [
    { value: "14oct", day: "2026-10-14", label: "Wednesday 14 October, the 01:20 draft" },
    { value: "1nov", day: "2026-11-01", label: "Sunday 1 November" },
    { value: "1dec", day: "2026-12-01", label: "Tuesday 1 December" },
    { value: "1jan", day: "2027-01-01", label: "Friday 1 January" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a line in the instructions" },
    { value: "r1", label: "reply 1: filters and a retrain schedule" },
    { value: "r2", label: "reply 2: check the backups, confirm" },
    { value: "r3", label: "reply 3: take it down, refund" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dayNum(s) { var p = s.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function defaults() {
    return { consent: false, deletion: false, schedule: "none", check: false, home: false,
      date: "14oct", instr: false, off: false, plan: "none" };
  }

  /* ---------- the model (pure: settings in, answers out) ---------- */

  function ledger(C) {
    var day = pick(DATES, C.date).day;
    var sched = pick(SCHEDULES, C.schedule);
    var listOk = C.consent || C.deletion;
    var size = C.consent ? YES : (C.deletion ? ARCHIVE : UPLOADED);
    var done = sched.days.filter(function (d) { return d > TODAY && d <= day; });
    var last = done.length ? done[done.length - 1] : null;
    var later = sched.days.filter(function (d) { return d > day; });
    var next = later.length ? later[0] : null;
    var R = { day: day, size: size, listOk: listOk, last: last, next: next, sched: sched };
    if (C.off) {
      R.trained = "model deleted"; R.inModel = 0; R.run = "none: assistant taken down";
      R.days = "-"; R.nextText = "none planned"; R.reach = "no assistant"; R.caught = "-";
      R.abroad = "no retrain planned";
      return R;
    }
    if (last && listOk) {
      R.trained = fmt(size); R.inModel = 0; R.run = DAYNAME[last] + ": " + fmt(size) + " letters";
    } else if (last) {
      R.trained = fmt(UPLOADED); R.inModel = HERS; R.run = "stopped: " + HERS + " letters on the list have no text";
    } else {
      R.trained = fmt(UPLOADED); R.inModel = HERS; R.run = "none yet";
    }
    R.nextText = next ? DAYNAME[next] : "none planned";
    if (R.inModel === 0) R.days = "done: " + DAYNAME[last];
    else if (!sched.days.length) R.days = "never: no retrain planned";
    else if (!listOk) R.days = "never: the list still names them";
    else R.days = (dayNum(next) - dayNum(day)) + " days";
    if (R.inModel === 0) { R.reach = 0; R.caught = C.check ? "nothing to catch" : "check off"; }
    else if (C.check) { R.reach = 0; R.caught = MATCHES + " of " + MATCHES; }
    else { R.reach = MATCHES; R.caught = "check off"; }
    R.abroad = !sched.days.length ? "no retrain planned" : (C.home ? 0 : fmt(size));
    return R;
  }

  function replayText(C) {
    var R = ledger(C);
    if (C.off) return "01:20 request replayed: no assistant, nothing written.";
    if (R.inModel === 0) return "01:20 request replayed: " + SENTENCES + " sentences, none of hers; the model never learned them.";
    if (C.check) return "01:20 request replayed: " + SENTENCES + " sentences; output check blocked " + MATCHES + " of " +
      MATCHES + " matches, sentences 4 and 5.";
    return "01:20 request replayed: " + SENTENCES + " sentences, " + MATCHES + " of them hers word for word" +
      (C.instr ? ", despite the line in the instructions." : ".");
  }
  var BACKUPS = "backups checked: the 02:00 backup on Friday 4 September was the last made before her letters " +
    "were deleted at 15:00; kept 35 days, it expired Friday 9 October. copies found today: 0.";

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
    var S = api.state;
    var C = S.C;
    var R = ledger(C);
    var ui = S.ui;
    ui.head.textContent = "the training-data ledger at Kinfold. date: " + pick(DATES, C.date).label +
      ". retrain: " + R.sched.label + "." + (C.instr ? " a line in the instructions." : "") +
      (C.off ? " assistant taken down." : "");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["letters", "count", "yes to training", "deletion receipt", "in February's run", "on the next list"], true);
    row(ui, ["Mrs Dunstaple's", HERS, "no", "yes", "yes", R.listOk ? "no" : "yes, with no text"], false);
    row(ui, ["owners said yes", fmt(YES), "yes", "no", "yes", "yes"], false);
    row(ui, ["no, or no answer", fmt(ARCHIVE - YES), "no", "no", "yes", C.consent ? "no" : "yes"], false);
    ui.note.textContent = "next training list: " + fmt(R.size) + " letters. live model learned from: " + R.trained +
      ". her letters in the model: " + R.inModel + ". last retrain: " + R.run + ".";
  }

  function setStats(api) {
    var R = ledger(api.state.C);
    var st = api.state.stat;
    st.list(fmt(R.size));
    st.trained(R.trained);
    st.inmodel(R.inModel);
    st.days(R.days);
    st.next(R.nextText);
    st.run(R.run);
    st.reach(R.reach);
    st.caught(R.caught);
    st.abroad(R.abroad);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = ledger(api.state.C);
    if (what) api.log(what + " list " + fmt(R.size) + "; in the model " + R.inModel + "; takes effect: " + R.days + ".",
      R.inModel === 0 ? "ok" : (R.listOk && R.sched.days.length ? "warn" : "bad"));
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.instr = true;
    if (plan === "r1") { C.consent = true; C.deletion = true; C.schedule = "quarterly"; C.check = true; C.home = true; }
    if (plan === "r3") C.off = true;
    return C;
  }

  function planFollowUp(api, plan) {
    var C = api.state.C;
    if (plan === "r0") {
      api.log("line added to the instructions: never quote Mrs Dunstaple's letters. the model's weights are unchanged.", "bad");
      api.log(replayText(C), "bad");
    }
    if (plan === "r1") {
      api.log("training list: consent filter keeps " + fmt(YES) + " of " + fmt(ARCHIVE) + "; deletion filter drops every letter with a receipt. " +
        "quarterly retrain from the bought model, in our own country: 0 letters sent abroad. next: Friday 1 January, 79 days.", "ok");
      api.log(replayText(C), "ok");
    }
    if (plan === "r2") {
      api.log(BACKUPS, "warn");
      api.log("letter to Rosheen: every copy is gone. deleted letters still in the model: " + HERS + ".", "bad");
    }
    if (plan === "r3") {
      api.log("assistant switched off, model deleted, every paying customer refunded. no rule yet on which letters may train anything.", "warn");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.consent.set(S.C.consent);
        S.ctl.deletion.set(S.C.deletion);
        S.ctl.schedule.set(S.C.schedule);
        S.ctl.check.set(S.C.check);
        S.ctl.home.set(S.C.home);
        S.ctl.date.set(S.C.date);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        refresh(api, what);
      }
      function flag(id, label) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          if (S.sync) return;
          S.C[id] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      flag("consent", "consent filter");
      flag("deletion", "deletion filter");
      S.ctl.schedule = api.control.select("schedule", "retrain schedule", SCHEDULES, "none", function (val) {
        if (S.sync) return;
        var o = pick(SCHEDULES, val);
        if (!o) return;
        S.C.schedule = String(o.value);
        manual("retrain schedule: " + o.label + ".");
      });
      flag("check", "output check");
      flag("home", "retrain in our own country");
      S.ctl.date = api.control.select("date", "date", DATES, "14oct", function (val) {
        if (S.sync) return;
        var o = pick(DATES, val);
        if (!o) return;
        S.C.date = String(o.value);
        manual("date: " + o.label + ".");
      });
      S.ctl.replay = api.control.button("replay", "replay the 01:20 request", function () {
        api.log(replayText(S.C), ledger(S.C).reach === 0 ? "ok" : "bad");
      });
      S.ctl.backups = api.control.button("backups", "check the backups", function () { api.log(BACKUPS, "warn"); });
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
        list: api.stat("list", "letters on the next training list", ""),
        trained: api.stat("trained", "letters the live model learned from", "warn"),
        inmodel: api.stat("inmodel", "deleted letters still in the model", "bad"),
        days: api.stat("days", "days until a deletion takes effect", "warn"),
        next: api.stat("next", "next retrain", ""),
        run: api.stat("run", "last retrain", ""),
        reach: api.stat("reach", "her sentences reaching the customer", "bad"),
        caught: api.stat("caught", "matches caught by the output check", "ok"),
        abroad: api.stat("abroad", "letters sent abroad for the next retrain", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of letters in the ledger: how many, whether the owner said yes to training, whether a deletion receipt exists, and whether the next training list includes it. Switch the filters, set a retrain schedule and a date, and watch what the model still holds.");

      refresh(api, "");
      api.log("Wednesday 14 October at Kinfold, after the 01:20 draft. the model learned from " + fmt(UPLOADED) +
        " letters, " + HERS + " of them since deleted. no retrain planned.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: February's model, no retrain, 2 of her sentences reach the customer.
      t.expect(t.stat("list") === "48,000" && t.stat("trained") === "48,000" && t.stat("inmodel") === 212 &&
        t.stat("next") === "none planned" && t.stat("days") === "never: no retrain planned" &&
        t.stat("reach") === 2 && t.stat("caught") === "check off" && has("Wednesday 14 October at Kinfold"),
        "Opens on 14 October: 48,000 learned, 212 deleted letters in the model, no retrain");

      // 2. The backups already let go of her letters on 9 October.
      t.click("backups");
      t.expect(has("expired Friday 9 October") && has("copies found today: 0.") && t.stat("inmodel") === 212,
        "Backups: expired 9 October, 0 copies found, 212 still in the model");

      // 3. The two filters and the training list.
      t.set("consent", true); var a = t.stat("list");
      t.set("consent", false); t.set("deletion", true); var b = t.stat("list");
      t.set("consent", true); var c = t.stat("list");
      t.set("consent", false); t.set("deletion", false); var d = t.stat("list");
      t.expect(a === "15,000" && b === "47,788" && c === "15,000" && d === "48,000",
        "Consent 15,000; deletion only 47,788; both 15,000; neither 48,000");

      // 4. A quarterly retrain with both filters: 79 days to 1 January.
      t.set("consent", true); t.set("deletion", true); t.set("schedule", "quarterly");
      t.expect(t.stat("next") === "Friday 1 January" && t.stat("days") === "79 days" && t.stat("abroad") === "15,000",
        "Quarterly: next Friday 1 January, 79 days, 15,000 sent abroad unless retrained at home");

      // 5. Monthly: 18 days to 1 November.
      t.set("schedule", "monthly");
      var m1 = t.stat("next") === "Sunday 1 November" && t.stat("days") === "18 days";
      t.set("schedule", "quarterly");
      t.expect(m1 && t.stat("days") === "79 days", "Monthly: next Sunday 1 November, 18 days");

      // 6. The output check as a stopgap.
      t.set("check", true);
      t.click("replay");
      t.expect(t.stat("caught") === "2 of 2" && t.stat("reach") === 0 && has("output check blocked 2 of 2 matches"),
        "Output check: 2 of 2 caught, 0 reach the customer");

      // 7. After the 1 January retrain, none of hers are in the model.
      t.set("date", "1jan");
      t.expect(t.stat("inmodel") === 0 && t.stat("trained") === "15,000" && t.stat("run") === "Friday 1 January: 15,000 letters" &&
        t.stat("days") === "done: Friday 1 January" && t.stat("caught") === "nothing to catch",
        "1 January: retrained on 15,000, 0 deleted letters in the model");

      // 8. Neither filter: the list still names her 212 and the run stops.
      t.set("consent", false); t.set("deletion", false);
      t.expect(t.stat("inmodel") === 212 && t.stat("run") === "stopped: 212 letters on the list have no text" &&
        t.stat("days") === "never: the list still names them",
        "No filters: the 1 January run stops; 212 stay in the model");

      // 9. Reply 0: a line in the instructions.
      t.set("plan", "r0");
      t.expect(t.stat("inmodel") === 212 && t.stat("reach") === 2 && has("despite the line in the instructions"),
        "Reply 0: the replay still holds 2 sentences; 212 in the model");

      // 10. Reply 1: filters, a quarterly retrain at home, the output check.
      t.set("plan", "r1");
      t.expect(t.stat("list") === "15,000" && t.stat("days") === "79 days" && t.stat("caught") === "2 of 2" &&
        t.stat("abroad") === 0 && t.stat("next") === "Friday 1 January",
        "Reply 1: 15,000, 79 days, 2 of 2 caught, 0 sent abroad");

      // 11. Reply 2: the backups were already clean.
      t.set("plan", "r2");
      t.expect(t.stat("inmodel") === 212 && t.stat("days") === "never: no retrain planned" && has("every copy is gone"),
        "Reply 2: 0 backup copies, 212 still in the model");

      // 12. Reply 3: taken down.
      t.set("plan", "r3");
      t.expect(t.stat("reach") === "no assistant" && t.stat("inmodel") === 0 && t.stat("trained") === "model deleted",
        "Reply 3: no assistant, model deleted");
    }
  });
})();
