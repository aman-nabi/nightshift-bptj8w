/* sims/s4e11-v1.0.0.js  (published as sims/s4e11.js)
   Case s4e11 "The Long Errand": a saga lab for Vowline, the booking platform Mrs Gaskarth's wedding
   planning business uses. One booking, Clementine Tindall and Dashiell Fothergill's wedding on
   Saturday 12 September 2026, books four suppliers in a chain on the night of Thursday 12 March:
   the venue (Bramblecote Barn), the caterer (Pellinore Catering), the band (through Haverfield
   Music) and the florist (Hollyhock Flowers). The learner replays that night with a different way
   of coordinating the steps, a different supplier failing, a supplier that never hears the
   failure, the orchestrator's retries on or off, and the venue's cancellation arriving twice, and
   reads each step's state, the compensations run, the money still held and what arrives on the
   wedding date. Widget-style sim: it draws its own table inside api.root and replays the night at
   once.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: controls for Run the night, coordination (choreography as
     built, orchestration, one database transaction, retry the failed step every night), which
     supplier fails, a supplier that never hears the failure, orchestrator retries, the venue's
     cancellation arriving twice (with or without a key), Reset. Stats: steps booked, compensations
     done, deposits still held, owed back to the couple, fees kept, refunded twice, what arrives on
     12 September, where the booking's state lives, services to change for a new supplier, tries
     of the failed step, rows locked. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - STEPS below, in chain order, each booked at its stated time on Thursday 12 March (minutes
     after 21:00) with its stated deposit. A booked step pays its deposit at once. The failing step
     fails at its own time and pays nothing; the steps after it are never booked.
   - A compensation cancels a booked step and returns its deposit less its cancellation fee: the
     venue keeps 300 pounds, the others keep nothing.
   - Pellinore Catering's system is offline from 22:00 to 23:30 (its nightly maintenance). A call to
     it in that window fails; an event for it waits in its own queue and is delivered at 23:30.
   - Choreography (as built): the failing supplier's service publishes its failure event. Every
     booked service that subscribes to it cancels its own booking when the event is delivered; the
     service set as never hearing it subscribes to nothing. Later services that hear it drop the
     order they had waiting. Queues redeliver, so retries do not apply.
   - Orchestration: the orchestrator records each step in its saga log; on the failure it calls the
     booked steps' compensations in reverse order, each after the one before has finished. A call
     that fails is retried every 15 minutes if retries are on, otherwise recorded as failed and
     skipped. A supplier that never hears events doesn't matter: the orchestrator calls each one.
   - One database transaction: the platform opens it at 21:05 and writes its four booking rows in
     it, holding their locks until COMMIT or ROLLBACK. On the failure it rolls back: the platform's
     rows vanish, and nothing is sent to the suppliers, whose bookings and deposits stay.
   - Retry the failed step: the platform asks the failing supplier again every night at 22:15 and
     never compensates. No band is free on 12 September, so it never accepts: 184 tries, one a
     night from 12 March to 11 September (Date.UTC difference, 184 days).
   - Twice: the venue's cancellation is delivered twice, a minute apart (a lost reply resent, or an
     event redelivered). Without a key the venue refunds again; with the booking's key it returns
     the stored result.
   - On 12 September: if nothing failed, the wedding. Otherwise every step still booked arrives
     (the caterer's three-tier cake, the band) at an empty hall, "opened and paid for" if the venue
     is still booked; with nothing still booked, nothing arrives.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e11-v1.0.0.json).
   - Deposits: 2,400 + 1,850 + 500 + 400 = 5,150 pounds if all four are booked.
   - As built (choreography, the band fails at 22:15, the caterer never hears): 2 of 4 booked,
     4,250 paid; the venue cancels at 22:15, 2,100 back, 300 kept; the caterer keeps 1,850. Still
     held 2,150; owed back 1,850; on 12 September "a three-tier cake at an empty hall".
   - Complete choreography (nobody deaf): the caterer's event waits until 23:30, 1,850 back. Held
     300 (the fee), owed 0, nothing arrives. Services to change for a new supplier: 4.
   - Orchestration, retries off: the caterer's cancel fails at 22:15 and is skipped; the venue
     cancels at 22:15. Same 2,150 held and the same cake. Retries on: tries at 22:30, 22:45, 23:00,
     23:15 fail, 23:30 succeeds (5 retries); the venue cancels at 23:30. Held 300, nothing arrives.
   - Twice without a key: 2,100 refunded twice. With a key: 0.
   - One transaction: rows locked 21:05 to 22:15, 1 h 10 min; rolled back; 4,250 held and owed;
     "a three-tier cake at an empty hall, opened and paid for".
   - Retry the band: 184 tries, 4,250 held, the same cake at the opened hall, "waiting on the band".
   - The florist fails at 22:50 (as built): 3 of 4 booked, 4,750 paid; the venue and the band cancel
     at 22:50 (2,100 and 500 back); the caterer keeps 1,850. Held 2,150, owed 1,850.
   - Nothing fails: 4 of 4, 5,150 held, owed 0, "the wedding".
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // at: minutes after 21:00 on Thursday 12 March 2026
  var STEPS = [
    { id: "venue", name: "Bramblecote Barn", what: "the venue", at: 5, deposit: 2400, fee: 300, item: null, ev: "venue.failed" },
    { id: "caterer", name: "Pellinore Catering", what: "the caterer", at: 40, deposit: 1850, fee: 0, item: "a three-tier cake", ev: "caterer.failed" },
    { id: "band", name: "Haverfield Music", what: "the band", at: 75, deposit: 500, fee: 0, item: "a band", ev: "band.failed" },
    { id: "florist", name: "Hollyhock Flowers", what: "the florist", at: 110, deposit: 400, fee: 0, item: "flowers", ev: "florist.failed" }
  ];
  var OFF_FROM = 60;      // 22:00, the caterer's system goes offline
  var OFF_TO = 150;       // 23:30, back
  var RETRY_EVERY = 15;   // minutes between the orchestrator's tries
  var NIGHTS = Math.round((Date.UTC(2026, 8, 12) - Date.UTC(2026, 2, 12)) / 86400000);   // 184

  var MODES = [
    { value: "choreo", label: "Choreography: each service reacts to events (as built)" },
    { value: "orch", label: "Orchestration: one orchestrator runs the steps" },
    { value: "txn", label: "One database transaction around all four" },
    { value: "retry", label: "Retry the failed step every night, never cancel" }
  ];
  var MODE_SHORT = { choreo: "choreography", orch: "orchestration", txn: "one transaction", retry: "retry the failed step" };
  var FAILS = [
    { value: "venue", label: "The venue" },
    { value: "caterer", label: "The caterer" },
    { value: "band", label: "The band (as on 12 March)" },
    { value: "florist", label: "The florist" },
    { value: "none", label: "Nobody: every step succeeds" }
  ];
  var DEAF = [
    { value: "none", label: "Nobody: every service hears" },
    { value: "venue", label: "The venue" },
    { value: "caterer", label: "The caterer (as built)" },
    { value: "band", label: "The band" },
    { value: "florist", label: "The florist" }
  ];
  var TWICE = [
    { value: "no", label: "No" },
    { value: "key", label: "Yes, sent with the booking's key" },
    { value: "nokey", label: "Yes, with no key" }
  ];

  /* ---------- small helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(m) { return pad(21 + Math.floor(m / 60)) + ":" + pad(m % 60); }
  function money(p) { return "£" + p.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pounds(p) { return "£" + String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dur(m) { return Math.floor(m / 60) + " h " + (m % 60) + " min"; }
  function idx(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i; return STEPS.length; }
  function inList(list, v) { for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return true; return false; }
  function offline(i, t) { return STEPS[i].id === "caterer" && t >= OFF_FROM && t < OFF_TO; }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function replay(C) {
    var fi = idx(C.fail);
    var T = fi < STEPS.length ? STEPS[fi].at : null;
    var rows = STEPS.map(function (s, i) {
      return { i: i, state: i < fi ? "booked" : (i === fi ? "failed" : "not reached"), paid: i < fi ? s.deposit : 0,
        back: 0, kept: 0, dup: 0, done: null, trace: [] };
    });
    var comps = 0;
    var tries = fi < STEPS.length ? 1 : 0;
    var lock = 0;
    var failedComp = 0;
    rows.forEach(function (r, i) {
      if (i < fi) r.trace.push("booked " + clock(STEPS[i].at) + " (" + pounds(STEPS[i].deposit) + ")");
      if (i === fi) r.trace.push("failed " + clock(STEPS[i].at));
    });

    function cancel(i, t, how) {
      var r = rows[i];
      var s = STEPS[i];
      r.state = "cancelled";
      r.back = s.deposit - s.fee;
      r.kept = s.fee;
      r.done = t;
      comps += 1;
      r.trace.push(how + "cancelled " + clock(t) + ": " + pounds(r.back) + " back" + (s.fee ? ", " + pounds(s.fee) + " fee kept" : ""));
      if (i === 0 && C.twice !== "no") {
        if (C.twice === "nokey") { r.dup = r.back; r.trace.push("cancelled again " + clock(t + 1) + ": " + pounds(r.back) + " back twice"); }
        else r.trace.push("asked again " + clock(t + 1) + ": stored result, nothing sent");
      }
    }

    if (fi < STEPS.length) {
      if (C.mode === "choreo") {
        for (var i = 0; i < STEPS.length; i++) {
          if (i === fi) continue;
          var deaf = C.deaf === STEPS[i].id;
          if (i < fi) {
            if (deaf) { rows[i].trace.push("never heard " + STEPS[fi].ev + ", still booked"); continue; }
            var at = offline(i, T) ? OFF_TO : T;
            cancel(i, at, at > T ? "heard " + STEPS[fi].ev + " at " + clock(at) + " (offline till then), " : "heard " + STEPS[fi].ev + ", ");
          } else if (!deaf) {
            rows[i].trace.push("heard " + STEPS[fi].ev + ", dropped its waiting order");
          }
        }
      } else if (C.mode === "orch") {
        var t = T;
        for (var k = fi - 1; k >= 0; k--) {
          if (!offline(k, t)) { cancel(k, t, ""); continue; }
          if (!C.retries) {
            failedComp += 1;
            rows[k].trace.push("cancel failed " + clock(t) + " (offline), not retried, still booked");
            continue;
          }
          var n = 0;
          var first = t;
          while (offline(k, t)) { t += RETRY_EVERY; n += 1; }
          cancel(k, t, "cancel failed " + clock(first) + " (offline), retried " + n + " times, ");
        }
      } else if (C.mode === "txn") {
        lock = T - STEPS[0].at;
        rows.forEach(function (r, i2) { if (i2 < fi) r.trace.push("ROLLBACK " + clock(T) + ": the platform's row erased, the booking kept"); });
      } else {
        tries = NIGHTS;
        rows[fi].trace.push("asked again every night at " + clock(T) + ": " + NIGHTS + " tries, never accepted");
      }
    } else if (C.mode === "txn") {
      lock = STEPS[STEPS.length - 1].at - STEPS[0].at;
    }
    return summarise(C, fi, rows, comps, tries, lock, failedComp);
  }

  function summarise(C, fi, rows, comps, tries, lock, failedComp) {
    var paid = 0;
    var back = 0;
    var kept = 0;
    var dup = 0;
    var booked = 0;
    rows.forEach(function (r) {
      paid += r.paid; back += r.back; kept += r.kept; dup += r.dup;
      if (r.paid) booked += 1;
    });
    var held = paid - back;
    var failed = fi < STEPS.length;
    var arrives;
    if (!failed) arrives = "the wedding";
    else {
      var items = [];
      var venueHeld = false;
      rows.forEach(function (r, i) {
        if (r.state !== "booked") return;
        if (i === 0) venueHeld = true; else items.push(STEPS[i].item);
      });
      if (items.length) arrives = items.join(" and ") + " at an empty hall" + (venueHeld ? ", opened and paid for" : "");
      else arrives = venueHeld ? "an empty hall, opened and paid for" : "nothing";
    }
    var record;
    if (C.mode === "choreo") record = "spread over 4 services";
    else if (C.mode === "orch") record = !failed ? "saga log: done" : (failedComp ? "saga log: compensation failed" : "saga log: compensated");
    else if (C.mode === "txn") record = failed ? "rolled back: no record" : "committed";
    else record = failed ? "waiting on " + STEPS[fi].what : "done";
    return { fi: fi, rows: rows, paid: paid, held: held, owed: failed ? held - kept : 0, kept: kept, dup: dup, booked: booked,
      comps: comps, tries: tries, lock: lock, arrives: arrives, record: record, change: C.mode === "choreo" ? 4 : 1 };
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["step", "supplier", "deposit", "on 12 March", "back", "fee kept", "still held", "12 September"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 6px;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var date = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(date);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, date: date };
  }

  var TONE_STYLE = { bad: "background:rgba(200,60,60,0.16);", warn: "background:rgba(210,150,40,0.18);", ok: "", "": "" };

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    ui.head.textContent = "Coordination: " + MODE_SHORT[C.mode] + ". Fails: " + (C.fail === "none" ? "nobody" : STEPS[idx(C.fail)].what) +
      ". Never hears the failure: " + (C.deaf === "none" ? "nobody" : STEPS[idx(C.deaf)].what) + ". Orchestrator retries: " +
      (C.retries ? "on" : "off") + ". Venue's cancel twice: " + (C.twice === "no" ? "no" : (C.twice === "key" ? "yes, with a key" : "yes, no key")) +
      "." + (R ? "" : " Press Run the night.");
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    STEPS.forEach(function (s, i) {
      var r = R ? R.rows[i] : null;
      var still = r ? r.paid - r.back : 0;
      var failedRun = R && R.fi < STEPS.length;
      var onDate = !r ? "-" : (r.state === "booked" ? (failedRun ? (s.item || "hall opened") : "there") : "-");
      var cells = [String(i + 1), s.name + " (" + s.id + ")", pounds(s.deposit), r ? r.trace.join("; ") || r.state : "waiting",
        r ? pounds(r.back + r.dup) : "-", r ? pounds(r.kept) : "-", r ? pounds(still) : "-", onDate];
      var tone = r && r.state === "booked" && failedRun ? "bad" : (r && r.dup ? "warn" : "");
      var tr = ui.el("tr", TONE_STYLE[tone]);
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 6px;", c)); });
      ui.tbody.appendChild(tr);
    });
    ui.date.textContent = R ? "Saturday 12 September, Bramblecote Barn: " + R.arrives + "." : "Saturday 12 September: not yet.";
    S.stat.booked((R ? R.booked : 0) + " of 4");
    S.stat.comps(R ? R.comps : 0);
    S.stat.held(money(R ? R.held : 0));
    S.stat.owed(money(R ? R.owed : 0));
    S.stat.kept(money(R ? R.kept : 0));
    S.stat.dup(money(R ? R.dup : 0));
    S.stat.arrives(R ? R.arrives : "not yet");
    S.stat.record(R ? R.record : "not yet");
    S.stat.change(C.mode === "choreo" ? 4 : 1);
    S.stat.tries(R ? R.tries : 0);
    S.stat.lock(R && R.lock ? dur(R.lock) : "none");
  }

  function run(api, why) {
    var S = api.state;
    var C = S.C;
    S.R = replay(C);
    var R = S.R;
    api.log(why + " Replayed 12 March (" + MODE_SHORT[C.mode] + ", " + (C.fail === "none" ? "nobody fails" : STEPS[R.fi].what + " fails") +
      "): " + R.booked + " of 4 booked, " + R.comps + (R.comps === 1 ? " compensation" : " compensations") + " done, " + money(R.held) +
      " still held, " + money(R.owed) + " owed back.", R.owed || R.dup ? "bad" : "ok");
    api.log("Steps: " + R.rows.map(function (r, i) { return STEPS[i].name + " " + (r.trace.join(", ") || r.state); }).join("; ") + ".", "");
    api.log("Saturday 12 September: " + R.arrives + ".", R.fi < STEPS.length && R.arrives !== "nothing" ? "bad" : "");
    draw(api);
  }

  function changed(api, what) {
    if (api.state.R) run(api, what);
    else { api.log(what + " Press Run the night to replay it.", ""); draw(api); }
  }

  /* ---------- the module ---------- */

  DL.sims.define("s4e11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { mode: "choreo", fail: "band", deaf: "caterer", retries: false, twice: "no" };
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.run = api.control.button("run", "Run the night", function () { run(api, "Run the night."); });
      S.ctl.mode = api.control.select("mode", "How the steps are coordinated", MODES, "choreo", function (v) {
        if (!inList(MODES, v)) return;
        S.C.mode = String(v);
        changed(api, "Coordination: " + MODE_SHORT[S.C.mode] + ".");
      });
      S.ctl.fail = api.control.select("fail", "Which supplier fails", FAILS, "band", function (v) {
        if (!inList(FAILS, v)) return;
        S.C.fail = String(v);
        changed(api, "Fails: " + (S.C.fail === "none" ? "nobody." : STEPS[idx(S.C.fail)].what + "."));
      });
      S.ctl.deaf = api.control.select("deaf", "A service that never hears the failure (choreography)", DEAF, "caterer", function (v) {
        if (!inList(DEAF, v)) return;
        S.C.deaf = String(v);
        changed(api, "Never hears the failure: " + (S.C.deaf === "none" ? "nobody." : STEPS[idx(S.C.deaf)].what + "."));
      });
      S.ctl.retries = api.control.toggle("retries", "The orchestrator retries a failed compensation every 15 minutes", false, function (on) {
        S.C.retries = !!on;
        changed(api, "Orchestrator retries: " + (on ? "on." : "off."));
      });
      S.ctl.twice = api.control.select("twice", "The venue's cancellation arrives twice", TWICE, "no", function (v) {
        if (!inList(TWICE, v)) return;
        S.C.twice = String(v);
        changed(api, "Venue's cancellation twice: " + (S.C.twice === "no" ? "no." : (S.C.twice === "key" ? "yes, with the booking's key." : "yes, with no key.")));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        booked: api.stat("booked", "steps booked", ""),
        comps: api.stat("comps", "compensations done", "ok"),
        held: api.stat("held", "deposits still held by suppliers", "warn"),
        owed: api.stat("owed", "owed back to the couple", "bad"),
        kept: api.stat("kept", "cancellation fees kept", ""),
        dup: api.stat("dup", "refunded twice", "bad"),
        arrives: api.stat("arrives", "arrives on 12 September", "bad"),
        record: api.stat("record", "where the booking's state lives", ""),
        change: api.stat("change", "services to change for a new supplier", ""),
        tries: api.stat("tries", "tries of the failed step", ""),
        lock: api.stat("lock", "platform rows locked for", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one step of Clementine and Dashiell's booking, in chain order. " +
        "<em>On 12 March</em> is what happened to it that night. <em>Back</em> is the deposit returned by a compensation; " +
        "<em>fee kept</em> is what the supplier may keep when it cancels. Red rows are still booked after the booking failed: " +
        "they turn up on 12 September. Amber rows refunded twice.");
      api.log("Thursday 12 March, 21:00: Clementine and Dashiell's booking is ready to run. Nothing booked, nothing paid.", "");
      draw(api);
    },

    selfTest: async function (t) {
      // Each log check reads the whole log (at most 14 lines; 13 by test 5), and every string it looks
      // for first appears in the run it checks.
      function begin() { return 0; }
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function since(s) { return has(s); }

      // 1. The opening state: before 21:05, nothing booked.
      t.expect(t.stat("booked") === "0 of 4" && t.stat("comps") === 0 && t.stat("held") === "£0.00" && t.stat("arrives") === "not yet" &&
        since("Thursday 12 March, 21:00: Clementine and Dashiell's booking is ready to run. Nothing booked, nothing paid."),
        "Opens before the first step: nothing booked, nothing held");

      // 2. As built: the caterer never hears band.failed, and the cake arrives.
      begin();
      t.click("run");
      t.expect(t.stat("booked") === "2 of 4" && t.stat("comps") === 1 && t.stat("held") === "£2,150.00" && t.stat("owed") === "£1,850.00" &&
        t.stat("kept") === "£300.00" && t.stat("arrives") === "a three-tier cake at an empty hall" && t.stat("record") === "spread over 4 services" &&
        has("Bramblecote Barn booked 21:05 (£2,400), heard band.failed, cancelled 22:15: £2,100 back, £300 fee kept") &&
        has("Pellinore Catering booked 21:40 (£1,850), never heard band.failed, still booked") &&
        has("Saturday 12 September: a three-tier cake at an empty hall."),
        "As built: the venue cancels at 22:15, the caterer never hears, £1,850 owed, a three-tier cake at an empty hall");

      // 3. Complete choreography: every service hears; the caterer's event waits until 23:30.
      begin();
      t.set("deaf", "none");
      t.expect(t.stat("comps") === 2 && t.stat("held") === "£300.00" && t.stat("owed") === "£0.00" && t.stat("arrives") === "nothing" &&
        t.stat("change") === 4 && has("heard band.failed at 23:30 (offline till then), cancelled 23:30: £1,850 back"),
        "Complete choreography: both cancelled, £300 fee held, nothing arrives, 4 services to change for a new supplier");

      // 4. Orchestration with no retries: the caterer's cancel fails in its maintenance window.
      t.set("mode", "orch");
      t.expect(t.stat("held") === "£2,150.00" && t.stat("arrives") === "a three-tier cake at an empty hall" &&
        t.stat("record") === "saga log: compensation failed" && t.stat("change") === 1,
        "Orchestration, retries off: the caterer's cancel fails at 22:15, the same cake");

      // 5. Orchestration with retries: done at 23:30, then the venue.
      begin();
      t.set("retries", true);
      t.expect(t.stat("comps") === 2 && t.stat("held") === "£300.00" && t.stat("owed") === "£0.00" && t.stat("arrives") === "nothing" &&
        t.stat("record") === "saga log: compensated" &&
        has("cancel failed 22:15 (offline), retried 5 times, cancelled 23:30: £1,850 back") && has("cancelled 23:30: £2,100 back, £300 fee kept"),
        "Orchestration with retries: the caterer cancelled at 23:30 after 5 retries, then the venue; only the £300 fee held");

      // 6. A compensation that runs twice.
      t.set("twice", "nokey");
      var noKey = t.stat("dup") === "£2,100.00";
      t.set("twice", "key");
      t.expect(noKey && t.stat("dup") === "£0.00" && t.stat("held") === "£300.00",
        "The venue's cancellation twice: £2,100 refunded twice with no key, nothing extra with the key");

      // 7. One database transaction: rolled back, nothing compensated.
      t.set("twice", "no");
      t.set("mode", "txn");
      t.expect(t.stat("held") === "£4,250.00" && t.stat("owed") === "£4,250.00" && t.stat("comps") === 0 && t.stat("lock") === "1 h 10 min" &&
        t.stat("record") === "rolled back: no record" && t.stat("arrives") === "a three-tier cake at an empty hall, opened and paid for",
        "One transaction: rows locked 1 h 10 min, rolled back, £4,250 still held, the cake at the opened hall");

      // 8. Retry the band every night: 184 tries, never compensated.
      t.set("mode", "retry");
      t.expect(t.stat("tries") === 184 && t.stat("held") === "£4,250.00" && t.stat("record") === "waiting on the band" &&
        t.stat("arrives") === "a three-tier cake at an empty hall, opened and paid for",
        "Retry the band: 184 tries, none accepted, £4,250 held, the cake at the opened hall");

      // 9. The florist fails instead, as built: the caterer still never hears.
      t.set("mode", "choreo");
      t.set("deaf", "caterer");
      t.set("fail", "florist");
      t.expect(t.stat("booked") === "3 of 4" && t.stat("comps") === 2 && t.stat("held") === "£2,150.00" && t.stat("owed") === "£1,850.00" &&
        t.stat("arrives") === "a three-tier cake at an empty hall",
        "The florist fails: the venue and the band cancel at 22:50, the caterer keeps £1,850, the same cake");

      // 10. Nobody fails: the wedding.
      t.set("fail", "none");
      t.expect(t.stat("booked") === "4 of 4" && t.stat("held") === "£5,150.00" && t.stat("owed") === "£0.00" && t.stat("arrives") === "the wedding",
        "Nobody fails: 4 of 4 booked, £5,150 in deposits, the wedding");

      // 11. Choreography redelivers too: complete choreography with no key refunds twice.
      t.set("fail", "band");
      t.set("deaf", "none");
      t.set("twice", "nokey");
      t.expect(t.stat("dup") === "£2,100.00" && t.stat("owed") === "£0.00",
        "Complete choreography, the event delivered twice with no key: £2,100 refunded twice");
    }
  });
})();
