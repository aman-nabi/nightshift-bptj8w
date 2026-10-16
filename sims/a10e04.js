/* sims/a10e04-v1.0.0.js  (published as sims/a10e04.js)
   Case a10e04 "Many at Once": a step-by-step batch replay of the Wrangthorpe tannery's shared server
   at 02:00 on Tuesday 6 October 2026, the first night the drum-log report ran on it. No real model runs
   here and no answer text is generated: every figure is worked out from the given numbers below (also
   stated in sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: scheduling (static, or after every step), places in a
     batch (4, 8, 16), card (A100 or H100), where the report runs (the shared server or its own A10),
     report length (2,000 or 500 tokens), reports at 02:00 (1 or 8), play the night, play a reply,
     reset. Stats: a full step, a 40-token answer alone, when the screens' answers were written, the
     report's wait, the longest screen wait, drum 6's wait, drum 11's wait, places doing work, the
     shared card's bill and the extra card's bill. selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 8B: 16.06 billion bytes of weights in 16 bits, about 15 GB on the card's meter. Each
     writing step reads them all once; every answer in the step gets one more token from that read.
   - A100 80GB memory speed 2,039 GB/s (the maker's 1,000): 16.06 / 2,039 = 7.9 ms at least a step.
     H100 SXM 3.35 TB/s = 3,350 GB/s.
   - the tannery's own writing curve on its A100, never a source's: a step takes 10 ms plus 0.25 ms
     per answer in it (1: 10.25 ms; 4: 11 ms; 8: 12 ms; 16: 14 ms). On the H100 the sim scales every
     step by 2,039 / 3,350 (memory speed sets the step): 8 places 7.3 ms (7.304).
   - the old program (static batching): when the card is free it takes up to 8 waiting questions,
     oldest first, runs them together in 8 places, filled or not (so a step always costs 12 ms), and
     returns every answer when the longest has its last token; anything asked meanwhile waits.
   - after every step (iteration-level scheduling): finished answers leave, waiting ones join the free
     places, then the next step runs; a step costs 10 ms plus 0.25 ms per answer actually in it.
   - 02:00:00.0: the drum-log report (2,000 tokens) and 7 drum screens (drums 1 to 5, 7 and 8; 40 tokens
     each) ask at once; the report reaches the program first. 02:00:00.6: Thorvaldur types drum 6's
     question (40 tokens). 02:00:05.0: drum 11's question, answered in two words (4 tokens).
     The sim counts every screen answer at 40 tokens.
   - prices, one provider's list (Lambda, read 16 October 2026), per card hour: A100 80GB $2.79, A10
     $1.29, H100 SXM $3.99 to $4.29. A month is 730 hours.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e04-v1.0.0.json):
   - a 40-token answer in 8 places: 40 x 12 ms = 0.48 s; alone 40 x 10.25 ms = 0.41 s. midnight (no
     report on the server) is the same as the report on its own A10: screens 0.48 s, drum 6 0.48 s.
   - static, 8 places: batch 1 = report + 7 screens, 2,000 steps x 12 ms = 24.0 s; the screens are
     written at 0.48 s and returned at 24.0 s. batch 2 = drum 6 and drum 11 from 24.0 s, 40 steps,
     ends 24.48 s: drum 6 24.48 - 0.6 = 23.88, 23.9 s; drum 11 24.48 - 5 = 19.48, 19.5 s.
     places doing work in batch 1: (7 x 40 + 2,000) / (8 x 2,000) = 14.25%, 14%; over both batches
     (2,280 + 44) / (16,000 + 320) = 14.2%, 14%.
   - static, 4 places (11 ms): batch 1 report + drums 1 to 3, 22.0 s; batch 2 drums 4, 5, 7, 8 to
     22.44 s; batch 3 drum 6 and drum 11 to 22.88 s: drum 6 22.3 s, drum 11 17.9 s.
   - static, H100: 2,000 x 7.304 ms = 14.6 s; drum 6 14.3 s; drum 11 9.9 s.
   - static, report capped at 500 tokens: 6.0 s; drum 6 5.9 s; drum 11 1.5 s.
   - after every step, 8 places: the 7 screens leave at 0.48 s; the report then writes alone at 10.25 ms
     a step; drum 6 joins at 0.603 s and leaves at 1.023 s (40 steps of 10.5 ms): 0.42 s; drum 11
     0.04 s; the report 20.6 s (20.581). every place in every step is writing: 100%.
   - the A10's bill: $1.29 x 730 = $941.70, $942 a month. the shared A100: $2.79 x 730 = $2,036.70,
     $2,037. an H100: $3.99 x 730 = $2,912.70 to $4.29 x 730 = $3,131.70.
   - the cold case, 8 reports at 02:00, after every step: 8 places full of reports for 2,000 steps of
     12 ms; the screens and drum 6 join at 24.0 s and leave at 24.48 s: drum 6 23.9 s, drum 11 joins at
     24.48 s, 19.5 s. with 16 places: 15 answers from 02:00 (13.75 ms a step), screens 0.55 s,
     drum 6 0.50 s, the reports 24.1 s.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BASE_MS = 10;            // the tannery's curve: 10 ms a step
  var PER_MS = 0.25;           // plus 0.25 ms per answer in it
  var A100_BW = 2039;          // GB/s
  var H100_BW = 3350;          // GB/s (3.35 TB/s)
  var HOURS = 730;             // a month
  var SCREENS = [1, 2, 3, 4, 5, 7, 8];
  var SCHEDS = [
    { value: "static", label: "static: a batch starts and ends together" },
    { value: "every", label: "after every step: done answers leave, waiting ones join" }
  ];
  var SIZES = [
    { value: "4", label: "4 places" },
    { value: "8", label: "8 places" },
    { value: "16", label: "16 places" }
  ];
  var CARDS = [
    { value: "a100", label: "A100 80GB, 2,039 GB/s, $2.79 an hour" },
    { value: "h100", label: "H100, 3.35 TB/s, $3.99 to $4.29 an hour" }
  ];
  var WHERES = [
    { value: "shared", label: "the shared server (since 5 october)" },
    { value: "a10", label: "its own A10, $1.29 an hour (before 5 october)" }
  ];
  var LENS = [
    { value: "2000", label: "2,000 tokens" },
    { value: "500", label: "500 tokens (a thinner report)" }
  ];
  var REPORTS = [
    { value: "1", label: "1 report" },
    { value: "8", label: "8 reports, one per operator" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: batches of 4" },
    { value: "r1", label: "reply 1: leave and join after every step" },
    { value: "r2", label: "reply 2: the report's own card back" },
    { value: "r3", label: "reply 3: a faster card" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function secs(x) { return x < 1 ? x.toFixed(2) + " s" : x.toFixed(1) + " s"; }
  function msText(x) { return (Math.round(x * 10) / 10) + " ms"; }
  function at(x) {
    var s = Math.floor(x + 1e-9);
    var tenth = Math.round((x - s) * 10);
    if (tenth === 10) { s += 1; tenth = 0; }
    return "02:00:" + (s < 10 ? "0" : "") + s + "." + tenth;
  }
  function money(x) { return "$" + fmt(Math.round(x)); }
  function defaults() {
    return { sched: "static", size: "8", card: "a100", where: "shared", len: "2000", reports: "1", plan: "none" };
  }

  /* ---------- the replay (pure: settings in, figures out) ---------- */

  function stepMs(n, C) { return (BASE_MS + PER_MS * n) * A100_BW / (C.card === "h100" ? H100_BW : A100_BW); }

  function requests(C) {
    var list = [];
    var nRep = Number(C.reports);
    if (C.where === "shared") {
      for (var i = 0; i < nRep; i++) {
        list.push({ id: "rep" + i, label: nRep > 1 ? "report " + (i + 1) : "drum-log report", t: 0, tokens: Number(C.len), kind: "report" });
      }
    }
    SCREENS.forEach(function (d) { list.push({ id: "d" + d, label: "drum " + d + " screen", t: 0, tokens: 40, kind: "screen" }); });
    list.push({ id: "d6", label: "drum 6, typed", t: 0.6, tokens: 40, kind: "typed" });
    list.push({ id: "d11", label: "drum 11, typed", t: 5, tokens: 4, kind: "typed" });
    return list;
  }

  function run(C) {
    var reqs = requests(C);
    var cap = Number(C.size);
    var T = 0, slotSteps = 0, useful = 0;
    var waiting = reqs.slice();
    function firstArrival() { return Math.min.apply(null, waiting.map(function (r) { return r.t; })); }
    if (C.sched === "static") {
      while (waiting.length) {
        var ready = waiting.filter(function (r) { return r.t <= T + 1e-9; });
        if (!ready.length) { T = firstArrival(); continue; }
        var batch = ready.slice(0, cap);
        var ms = stepMs(cap, C);
        var longest = Math.max.apply(null, batch.map(function (r) { return r.tokens; }));
        var end = T + longest * ms / 1000;
        batch.forEach(function (r) {
          r.start = T; r.written = T + r.tokens * ms / 1000; r.out = end; useful += r.tokens;
        });
        slotSteps += cap * longest;
        waiting = waiting.filter(function (r) { return batch.indexOf(r) < 0; });
        T = end;
      }
    } else {
      var active = [];
      while (waiting.length || active.length) {
        active = active.filter(function (r) {
          if (r.done >= r.tokens) { r.out = T; return false; }
          return true;
        });
        var ready2 = waiting.filter(function (r) { return r.t <= T + 1e-9; });
        while (ready2.length && active.length < cap) {
          var q = ready2.shift();
          q.start = T; q.done = 0; active.push(q);
          waiting.splice(waiting.indexOf(q), 1);
        }
        if (!active.length) { if (waiting.length) T = firstArrival(); continue; }
        var ms2 = stepMs(active.length, C);
        T += ms2 / 1000;
        slotSteps += active.length;
        useful += active.length;
        active.forEach(function (r) { r.done++; if (r.done === r.tokens) r.written = T; });
      }
    }
    reqs.forEach(function (r) { r.wait = r.out - r.t; });
    function find(id) { for (var i = 0; i < reqs.length; i++) if (reqs[i].id === id) return reqs[i]; return null; }
    var screens = reqs.filter(function (r) { return r.kind === "screen"; });
    var reps = reqs.filter(function (r) { return r.kind === "report"; });
    var cardHour = C.card === "h100" ? null : 2.79;
    var R = {
      reqs: reqs,
      d6: find("d6"), d11: find("d11"),
      screenWait: Math.max.apply(null, screens.map(function (r) { return r.wait; })),
      screenWritten: Math.max.apply(null, screens.map(function (r) { return r.written; })),
      reportWait: reps.length ? Math.max.apply(null, reps.map(function (r) { return r.wait; })) : null,
      share: useful / slotSteps
    };
    R.text = {
      step: msText(stepMs(Number(C.size), C)) + " (" + C.size + " places)",
      alone: secs(40 * stepMs(1, C) / 1000),
      written: secs(R.screenWritten),
      report: R.reportWait === null ? "on its own A10" : secs(R.reportWait),
      screens: secs(R.screenWait),
      d6: secs(R.d6.wait),
      d11: secs(R.d11.wait),
      work: Math.round(R.share * 100) + "%",
      bill: cardHour ? money(cardHour * HOURS) + " a month" : money(3.99 * HOURS) + " to " + money(4.29 * HOURS) + " a month",
      extra: C.where === "a10" ? money(1.29 * HOURS) + " a month" : "$0"
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
    var R = run(C);
    ui.head.textContent = (C.sched === "static" ? "static batching" : "after every step") + ", " + C.size +
      " places, " + (C.card === "h100" ? "H100" : "A100") + ". a full step: " + R.text.step + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["who", "tokens", "asked", "started", "written", "returned", "waited"], true);
    R.reqs.forEach(function (r) {
      row(ui, [r.label, fmt(r.tokens), at(r.t), at(r.start), at(r.written), at(r.out), secs(r.wait)], false,
        r.id === "d6" || r.id === "d11");
    });
    ui.note.textContent = "each step reads all 16.06 billion bytes once and gives every answer in it one more token. " +
      (C.sched === "static" ? "static: a batch's answers return together when the longest ends; empty or finished places still cost their share of the step." :
        "after every step: finished answers leave, waiting ones take the free places, then the next step runs.");
  }

  function setStats(api) {
    var R = run(api.state.C);
    var st = api.state.stat;
    st.step(R.text.step);
    st.alone(R.text.alone);
    st.written(R.text.written);
    st.report(R.text.report);
    st.screens(R.text.screens);
    st.d6(R.text.d6);
    st.d11(R.text.d11);
    st.work(R.text.work);
    st.bill(R.text.bill);
    st.extra(R.text.extra);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = run(api.state.C);
    if (what) api.log(what + " drum 6 waits " + R.text.d6 + ", drum 11 " + R.text.d11 + ", the report " +
      R.text.report + "; places doing work " + R.text.work + ".", R.d6.wait > 5 ? "bad" : "ok");
  }

  function playNight(api) {
    var C = defaults();
    var R = run(C);
    api.log("02:00:00.0  the report and 7 drum screens ask; batch 1 starts, 8 of 8 places, " + msText(stepMs(8, C)) + " a step.", "");
    api.log("02:00:00.5  the 7 screen answers are written (" + R.text.written + "); they wait for the report.", "warn");
    api.log("02:00:00.6  drum 6 asks and waits for the next batch.", "warn");
    api.log("02:00:05.0  drum 11 asks and waits.", "warn");
    api.log("02:00:24.0  batch 1 ends after 2,000 steps: the report and 7 screens after " + R.text.report + ".", "bad");
    api.log("02:00:24.5  drum 6 after " + R.text.d6 + ", drum 11 after " + R.text.d11 + ". places doing work: " + R.text.work + ".", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.size = "4";
    if (plan === "r1") C.sched = "every";
    if (plan === "r2") C.where = "a10";
    if (plan === "r3") C.card = "h100";
    return C;
  }

  function planFollowUp(api, plan) {
    var R = run(api.state.C);
    if (plan === "r0") api.log("batches of 4: the report's batch runs 2,000 steps of " + msText(stepMs(4, api.state.C)) +
      ", " + R.text.report + ". drum 6 after " + R.text.d6 + ", drum 11 after " + R.text.d11 + "; four screens wait for batch 2, " +
      R.text.screens + ".", "bad");
    if (plan === "r1") api.log("after every step: the screens leave at " + R.text.written + "; drum 6 joins at the next step, after " +
      R.text.d6 + "; drum 11 after " + R.text.d11 + ". the report " + R.text.report + ". places doing work: " + R.text.work + ".", "ok");
    if (plan === "r2") api.log("the report on its own A10: drum 6 after " + R.text.d6 + ", drum 11 after " + R.text.d11 +
      ". extra card: " + R.text.extra + " for one job a night.", "warn");
    if (plan === "r3") api.log("H100: a full step " + R.text.step + ". the report's batch " + R.text.report + "; drum 6 after " +
      R.text.d6 + ", drum 11 after " + R.text.d11 + ". card bill " + R.text.bill + ".", "bad");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["sched", "size", "card", "where", "len", "reports"];
      function syncControls() {
        S.sync = true;
        IDS.forEach(function (id) { S.ctl[id].set(S.C[id]); });
        S.sync = false;
      }
      function chooser(id, label, list) {
        S.ctl[id] = api.control.select(id, label, list, S.C[id], function (val) {
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
      chooser("sched", "scheduling", SCHEDS);
      chooser("size", "places in a batch", SIZES);
      chooser("card", "card", CARDS);
      chooser("where", "where the report runs", WHERES);
      chooser("len", "report length", LENS);
      chooser("reports", "reports at 02:00", REPORTS);
      S.ctl.night = api.control.button("night", "play 02:00 as it happened", function () {
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
        step: api.stat("step", "a full step", ""),
        alone: api.stat("alone", "a 40-token answer alone", ""),
        written: api.stat("written", "screen answers written by", ""),
        report: api.stat("report", "the report's wait", ""),
        screens: api.stat("screens", "longest screen wait", "warn"),
        d6: api.stat("d6", "drum 6 waited", "bad"),
        d11: api.stat("d11", "drum 11 waited", "bad"),
        work: api.stat("work", "places doing work", "warn"),
        bill: api.stat("bill", "shared card bill", ""),
        extra: api.stat("extra", "extra card bill", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one answer at 02:00 on the shared server. The asked column is when the question arrived; the started column is when it got a place in a step; the written column is its last token; the returned column is when the screen showed it. A wait is returned minus asked. The bold rows are drum 6 and drum 11.");

      draw(api);
      setStats(api);
      api.log("01:59:50 on tuesday 6 october: the report's first run on the shared server is at 02:00. nothing asked yet.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before 02:00: the replay shows the night as it will run.
      t.expect(t.stat("step") === "12 ms (8 places)" && t.stat("alone") === "0.41 s" && t.stat("written") === "0.48 s" &&
        t.stat("report") === "24.0 s" && t.stat("screens") === "24.0 s" && t.stat("d6") === "23.9 s" &&
        t.stat("d11") === "19.5 s" && t.stat("work") === "14%" && has("01:59:50 on tuesday 6 october"),
        "Opens before 02:00: 12 ms steps, 0.48 s written, 24.0 s returned, drum 6 23.9 s, drum 11 19.5 s, 14% of places working");

      // 2. 02:00 as it happened.
      t.click("night");
      t.expect(has("batch 1 starts, 8 of 8 places, 12 ms a step.") &&
        has("02:00:24.0  batch 1 ends after 2,000 steps: the report and 7 screens after 24.0 s.") &&
        has("02:00:24.5  drum 6 after 23.9 s, drum 11 after 19.5 s. places doing work: 14%."),
        "The night: batch 1 of 8 ends at 24.0 s; drum 6 23.9 s, drum 11 19.5 s; 14%");

      // 3. The bills: the shared A100 and nothing extra.
      t.expect(t.stat("bill") === "$2,037 a month" && t.stat("extra") === "$0",
        "The shared A100 costs $2,037 a month; no extra card");

      // 4. After every step: short answers about half a second, the report about 21 s.
      t.set("sched", "every");
      t.expect(t.stat("screens") === "0.48 s" && t.stat("d6") === "0.42 s" && t.stat("d11") === "0.04 s" &&
        t.stat("report") === "20.6 s" && t.stat("work") === "100%",
        "After every step: screens 0.48 s, drum 6 0.42 s, drum 11 0.04 s, report 20.6 s, every place working");

      // 5. Static batches of 4: still waiting for the longest.
      t.set("sched", "static");
      t.set("size", "4");
      t.expect(t.stat("step") === "11 ms (4 places)" && t.stat("report") === "22.0 s" && t.stat("d6") === "22.3 s" &&
        t.stat("d11") === "17.9 s" && t.stat("screens") === "22.4 s",
        "Batches of 4: 11 ms steps, the report's batch 22.0 s, drum 6 22.3 s, drum 11 17.9 s");

      // 6. An H100 under static batching.
      t.set("size", "8");
      t.set("card", "h100");
      t.expect(t.stat("step") === "7.3 ms (8 places)" && t.stat("report") === "14.6 s" && t.stat("d6") === "14.3 s" &&
        t.stat("d11") === "9.9 s" && t.stat("bill") === "$2,913 to $3,132 a month",
        "H100: 7.3 ms steps, the report's batch 14.6 s, drum 6 14.3 s, drum 11 9.9 s");

      // 7. The report on its own A10 (and midnight, with no report on the server).
      t.set("card", "a100");
      t.set("where", "a10");
      t.expect(t.stat("d6") === "0.48 s" && t.stat("screens") === "0.48 s" && t.stat("report") === "on its own A10" &&
        t.stat("extra") === "$942 a month",
        "Own A10: drum 6 0.48 s as at midnight; $942 a month extra");

      // 8. A 500-token report: shorter waits, still waits.
      t.set("where", "shared");
      t.set("len", "500");
      t.expect(t.stat("report") === "6.0 s" && t.stat("d6") === "5.9 s" && t.stat("d11") === "1.5 s",
        "A 500-token report: its batch 6.0 s, drum 6 5.9 s, drum 11 1.5 s");

      // 9. Reply 0 and reply 3 as played.
      t.set("plan", "r0");
      var r0 = has("batches of 4: the report's batch runs 2,000 steps of 11 ms, 22.0 s. drum 6 after 22.3 s, drum 11 after 17.9 s;");
      t.set("plan", "r3");
      t.expect(r0 && has("H100: a full step 7.3 ms (8 places). the report's batch 14.6 s; drum 6 after 14.3 s, drum 11 after 9.9 s."),
        "Replies 0 and 3: batches of 4 and an H100 both leave drum 6 waiting");

      // 10. Reply 1 as played.
      t.set("plan", "r1");
      t.expect(has("after every step: the screens leave at 0.48 s; drum 6 joins at the next step, after 0.42 s; drum 11 after 0.04 s. the report 20.6 s. places doing work: 100%."),
        "Reply 1: drum 6 0.42 s, the report 20.6 s, every place working");

      // 11. Reply 2 as played.
      t.set("plan", "r2");
      t.expect(has("the report on its own A10: drum 6 after 0.48 s, drum 11 after 0.05 s. extra card: $942 a month for one job a night."),
        "Reply 2: no waiting, $942 a month");

      // 12. The cold case: 8 reports at 02:00 after every step, then 16 places.
      t.set("plan", "r1");
      t.set("reports", "8");
      var full = t.stat("d6") === "23.9 s" && t.stat("d11") === "19.5 s" && t.stat("screens") === "24.5 s";
      t.set("size", "16");
      t.expect(full && t.stat("d6") === "0.50 s" && t.stat("screens") === "0.55 s" && t.stat("report") === "24.1 s",
        "Cold case: 8 reports fill all 8 places, drum 6 23.9 s again; 16 places: drum 6 0.50 s, reports 24.1 s");
    }
  });
})();
