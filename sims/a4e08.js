/* sims/a4e08-v1.0.0.js  (published as sims/a4e08.js)
   Case a4e08 "When It Goes in Circles": a runaway lab for the data team at Hartsilver Court, a
   garden estate whose hedge maze opens at night in October. Each night a cleaning agent fetches the
   day's bookings from the ticketing platform, Gatewicket, through a tool, export_bookings, then
   cleans them in batches into the warehouse. On Friday 9 October 2026 the shared Gatewicket quota
   was spent, the tool turned the 429 into "request failed", and the agent asked again every 15
   seconds until Orla, the morning on-call engineer, stopped it at 07:05. No real model runs here:
   a stand-in with stated rules plays the model. Widget-style sim: it draws its own trace in
   api.root, and shows the rate rather than 1,900 drawn steps.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: when it runs (night, nobody watching; day, someone watching),
     the shared quota spent or free, what the tool tells the agent on a 429 (bare, instructive,
     success with 0 bookings), backoff in the tool wrapper (none, doubling from 15 s with
     Retry-After ignored, honour Retry-After), step cap (120, 2,000, 5,000, none), spend cap (none,
     $20, $100), time cap (none, 1 h, 4 h), repeat detection, hand over with the trace. Stats: steps,
     cost, calls to Gatewicket, same call in a row, stopped at, stopped by, bookings cleaned, handed
     over, rate. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Night run starts 23:10:00 (Friday 9 October 2026); day run 09:00:00. Times below are seconds
     after the start.
   - A step is one model call: 15 s, 40,000 tokens in and 2,000 out (the harness keeps a sliding
     window of the last 10 steps, so every step is the same size). Teaching price $3 per million
     input tokens and $15 per million output: $0.12 + $0.03 = $0.15 a step. A step's tool call goes
     out as the step ends; the next step starts when its result is back.
   - The job: step 1 export_bookings(date: 2026-10-09); steps 2 to 59 clean_batch 1 to 58, 75
     bookings each (4,350); step 60 finishes. A night with a free quota: 60 steps, 900 s, $9.00.
   - Gatewicket: with the quota spent, the key is blocked until 1,200 s. A call while blocked gets
     429 with Retry-After: 1800 and moves the block to that call's time + 1,800 s (its docs: a call
     before then restarts the wait).
   - On a 429 the wrapper, which sees the status and the header, backs off or not:
     none: the agent gets the message at once. Doubling: waits 15, 30, 60 s and so on, then calls
     again, Retry-After ignored. Honour: waits the Retry-After seconds, then calls again.
     Wrapper retries are calls to Gatewicket, not steps: no model call, no cost.
   - The message the agent sees: bare "request failed" (it thinks a retry will get through, and
     asks again: the same thought, call and result every step); instructive (it stops with a note
     and says when to rerun); success with 0 bookings (it finishes: "Done. Friday had 0 bookings").
   - Before each step, in this order: Orla stops a night run at 07:05:00 (28,500 s); in the day a
     person glances at the trace every 10 minutes and stops it if the last 3 steps match; time cap
     (elapsed >= cap); step cap (steps >= cap); spend cap (spent + $0.15 > cap). Before a wrapper
     retry at r: Orla if r >= 28,500 (stops at 28,500); time cap if r >= cap (stops at the cap).
     After each step: repeat detection stops the run if the last 3 steps are the same call with the
     same result.
   - Hand over: when a cap, repeat detection or the model's note ends a run, your code sends the
     night on-call the trace. Off, the run ends quietly.

   Where every number comes from (conventions rule 14; the case is content/latent/a4/a4e08-v1.0.0.json).
   - As built (night, quota spent, bare, no backoff, step cap 2,000): steps start every 15 s;
     step 1,900 starts 28,485 s (07:04:45); Orla stops it before step 1,901 at 28,500 s, 07:05:00.
     1,900 steps x $0.15 = $285.00; 1,900 calls, all 429. The cap of 2,000 was 100 steps, 25 min
     and $15.00 away (30,000 s = 07:30:00, $300.00). Rate: 4 steps a minute, $36.00 an hour.
   - Option 0, step cap 5,000: the same 1,900 steps and $285.00; the cap 3,100 steps, 12 h 55 min
     and $465.00 away.
   - Step cap 120: 120 steps, $18.00, stopped 23:40:00. Spend cap $20: 133 steps, $19.95, stopped
     23:43:15 (a 134th would make $20.10). Time cap 1 h: 240 steps, $36.00, stopped 00:10:00.
   - Repeat detection: 3 steps, $0.45, stopped 23:10:45.
   - Instructive, no backoff: step 1's call at 23:10:15 moves the block to 23:40:15; step 2 is the
     model's note; 2 steps, $0.30, 23:10:30, "Rerun after 23:40:15".
   - Honour Retry-After: call at 15 s (429), retry at 1,815 s succeeds (23:40:15); steps 2 to 60
     from 1,815 s; ends 2,700 s, 23:55:00. 60 steps, $9.00, 2 calls, 4,350 of 4,350 cleaned.
   - Doubling: calls at 15, 30, 60, 120, 240, 480, 960, 1,920 s (all 429; the 1,920 call moves the
     block to 3,720) and 3,840 s (00:14:00, success): 9 calls; ends 4,725 s, 00:28:45, $9.00. With a
     time cap of 1 h the retry at 3,840 s is refused: stopped 00:10:00, 1 step, $0.15, 8 calls.
   - Option 1 (caps 120, $20, 1 h, repeat detection, honour Retry-After, instructive, hand over):
     60 steps, $9.00, 23:55:00.
   - Option 2 (success with 0 bookings): 2 steps, $0.30, 23:10:30, 0 of 4,350 cleaned.
   - Option 3 (day, someone watching): steps every 15 s from 09:00:00; at the 09:10:00 glance the
     last 3 steps match: 40 steps, $6.00. Day with a free quota: 60 steps, $9.00, 09:15:00.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var NIGHT = 23 * 3600 + 10 * 60;   // 23:10:00
  var DAY = 9 * 3600;                // 09:00:00
  var STEP = 15;                     // seconds per step
  var IN_TOK = 40000;
  var OUT_TOK = 2000;
  var CENTS = 15;                    // 40,000 x $3/M + 2,000 x $15/M = $0.15
  var RA = 1800;                     // Retry-After, seconds
  var FIRST_BLOCK = 1200;            // quota spent: blocked until 23:30:00 unless called
  var ORLA = 28500;                  // 07:05:00 on a night run
  var GLANCE = 600;                  // the day watcher looks every 10 minutes
  var BATCHES = 58;
  var PER_BATCH = 75;
  var BOOKINGS = BATCHES * PER_BATCH; // 4,350
  var HALT = 6000;                   // the sim's own guard; no setting reaches it

  var EXPORT = "export_bookings(date: 2026-10-09)";
  var BARE = "request failed";
  var INSTR = "429 rate limited: this key's quota is spent. Retry after 1800 seconds; a call before then restarts the wait. Nothing was exported.";
  var MASKED = "ok: 0 bookings";
  var THOUGHT = "I need Friday's bookings to clean. Fetching them from Gatewicket; once this gets through, the rest is ready, so I'm nearly done.";

  var WHENS = [
    { value: "night", label: "Night, 23:10, nobody watching (Orla arrives 07:05)" },
    { value: "day", label: "Day, 09:00, someone watching the trace" }
  ];
  var MSGS = [
    { value: "bare", label: "Bare: \"request failed\" (as built)" },
    { value: "instructive", label: "Instructive: 429, retry after 1800 s" },
    { value: "masked", label: "Success, 0 bookings (the 429 hidden)" }
  ];
  var BACKOFFS = [
    { value: "none", label: "None: the agent just asks again (as built)" },
    { value: "doubling", label: "Doubling from 15 s, Retry-After ignored" },
    { value: "honour", label: "Honour Retry-After" }
  ];
  var STEPCAPS = [
    { value: "120", label: "120" },
    { value: "2000", label: "2,000 (as built)" },
    { value: "5000", label: "5,000" },
    { value: "none", label: "none" }
  ];
  var SPENDCAPS = [
    { value: "none", label: "none (as built)" },
    { value: "2000", label: "$20" },
    { value: "10000", label: "$100" }
  ];
  var TIMECAPS = [
    { value: "none", label: "none (as built)" },
    { value: "3600", label: "1 h" },
    { value: "14400", label: "4 h" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(c) { return "$" + fmt(Math.floor(c / 100)) + "." + ("0" + (c % 100)).slice(-2); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = ((sec % 86400) + 86400) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function span(sec) {
    var m = Math.round(sec / 60);
    var h = Math.floor(m / 60);
    return h ? h + " h " + (m % 60) + " min" : m + " min";
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function capNum(v) { return v === "none" ? 0 : Number(v); }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function simulate(C) {
    var start = C.when === "night" ? NIGHT : DAY;
    var R = { start: start, steps: [], cents: 0, calls: 0, cleaned: 0, by: "", at: 0, note: "", ok: false, masked: false, tail: 0 };
    var t = 0;
    var blocked = C.quota ? FIRST_BLOCK : -1;
    var exported = false;
    var batch = 0;
    var finish = "";
    var nextGlance = GLANCE;

    function sig(s) { return s.action + " -> " + s.result; }
    function repeating() {
      var n = R.steps.length;
      return n >= 3 && sig(R.steps[n - 1]) === sig(R.steps[n - 2]) && sig(R.steps[n - 2]) === sig(R.steps[n - 3]);
    }
    function stop(by, at) { R.by = by; R.at = at; }
    // One call to Gatewicket at time x. True if it got through.
    function call(x) {
      R.calls += 1;
      if (C.quota && x < blocked) { blocked = x + RA; return false; }
      return true;
    }

    while (R.steps.length < HALT) {
      // Checks before a step, in the order the lede states.
      if (C.when === "night" && t >= ORLA) { stop("orla", t); break; }
      if (C.when === "day") {
        var seen = false;
        while (t >= nextGlance) {
          if (repeating()) { seen = true; break; }
          nextGlance += GLANCE;
        }
        if (seen) { stop("watcher", nextGlance); break; }
      }
      if (C.timecap && t >= C.timecap) { stop("timecap", t); break; }
      if (C.stepcap && R.steps.length >= C.stepcap) { stop("stepcap", t); break; }
      if (C.spendcap && R.cents + CENTS > C.spendcap) { stop("spendcap", t); break; }

      var s = { n: R.steps.length + 1, at: t, thought: "", action: "", result: "" };
      R.cents += CENTS;
      var end = t + STEP;
      if (finish) {
        s.thought = R.ok ? "Nothing left to do." : "I can't do any more tonight; say why.";
        s.action = "finish (end_turn)";
        s.result = finish;
        R.steps.push(s);
        t = end;
        if (R.ok) stop("done", t); else stop("model", t);
        break;
      }
      if (!exported) {
        s.thought = THOUGHT;
        s.action = EXPORT;
        var got = call(end);
        var when = end;
        if (!got && C.message !== "masked" && C.backoff !== "none") {
          var wait = C.backoff === "honour" ? RA : STEP;
          while (!got) {
            var r = when + wait;
            if (C.when === "night" && r >= ORLA) { when = -ORLA; break; }
            if (C.timecap && r >= C.timecap) { when = -C.timecap; break; }
            when = r;
            got = call(when);
            if (C.backoff === "doubling") wait *= 2;
          }
          if (when < 0) {
            s.result = "429 (the wrapper was still backing off)";
            R.steps.push(s);
            stop(-when === ORLA && C.when === "night" ? "orla" : "timecap", -when);
            break;
          }
        }
        if (got) {
          exported = true;
          s.result = "ok: " + fmt(BOOKINGS) + " bookings";
        } else if (C.message === "masked") {
          exported = true;
          R.masked = true;
          R.ok = true;
          s.result = MASKED;
          finish = "Done. Friday had 0 bookings to clean.";
        } else if (C.message === "instructive") {
          s.result = INSTR;
          finish = "Stopping. Gatewicket says this key's quota is spent and calling sooner restarts the wait. Nothing cleaned. Rerun after " + clock(R.start + blocked) + ".";
        } else {
          s.result = BARE;
        }
        t = when;
      } else {
        batch += 1;
        s.thought = "Batch " + batch + " of " + BATCHES + ".";
        s.action = "clean_batch(" + batch + ")";
        s.result = PER_BATCH + " bookings cleaned";
        R.cleaned += PER_BATCH;
        t = end;
        if (batch === BATCHES) { R.ok = true; finish = "Done. " + fmt(BOOKINGS) + " bookings cleaned."; }
      }
      R.steps.push(s);
      if (C.repeat && repeating()) { stop("repeat", t); break; }
    }
    if (!R.by) stop("halt", t);
    // How far the step cap was when a person stopped it.
    if (C.stepcap && (R.by === "orla" || R.by === "watcher")) R.tail = C.stepcap - R.steps.length;
    // The longest run of identical steps.
    var best = 0;
    var run = 0;
    for (var i = 0; i < R.steps.length; i++) {
      run = i > 0 && sig(R.steps[i]) === sig(R.steps[i - 1]) ? run + 1 : 1;
      if (run > best) best = run;
    }
    R.same = best;
    return R;
  }

  var BY_TEXT = {
    orla: "Orla, the morning on-call", watcher: "the person watching", timecap: "time cap",
    stepcap: "step cap", spendcap: "spend cap", repeat: "repeat detection", model: "the model, with a note",
    done: "finished", halt: "sim halt"
  };

  function byText(R) { return R.by === "done" && R.masked ? "finished: the tool said success" : BY_TEXT[R.by]; }

  function handed(C, R) {
    var when = clock(R.start + R.at);
    var n = fmt(R.steps.length) + (R.steps.length === 1 ? " step" : " steps");
    if (R.by === "orla") return "nothing: Orla found it at " + when;
    if (R.by === "watcher") return "not needed: the person watching stopped it";
    if (R.by === "done") return R.masked ? "nothing: it reported done" : "nothing needed: done";
    if (R.by === "model") return C.handover ? "the model's note and the trace of " + n + ", to the night on-call at " + when : "the model's note, in the run log";
    return C.handover ? "the trace of " + n + ", to the night on-call at " + when : "nothing: the run ended quietly";
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
    var rate = el("p", "margin:0;", "", box);
    el("strong", "", "The trace", box);
    var trace = el("ol", "margin:0;padding-left:20px;display:grid;gap:6px;", "", box);
    el("strong", "", "Handed over", box);
    var hand = el("p", "margin:0;", "", box);
    return { el: el, head: head, rate: rate, trace: trace, hand: hand };
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function stepItem(ui, R, s) {
    var li = ui.el("li", "", "", ui.trace);
    li.setAttribute("value", String(s.n));
    ui.el("div", "font-weight:600;", "Step " + fmt(s.n) + ", " + clock(R.start + s.at), li);
    ui.el("div", "", "Thought: " + s.thought, li);
    ui.el("div", "", "Action: " + s.action, li);
    ui.el("div", "", "Result: " + s.result, li);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = S.R;
    ui.head.textContent = (C.when === "night" ? "Night run from 23:10:00." : "Day run from 09:00:00.") +
      " Quota " + (C.quota ? "spent" : "free") + ". On a 429 the agent sees: " + pick(MSGS, C.message).label +
      ". Backoff: " + pick(BACKOFFS, C.backoff).label + ". Step cap " + (C.stepcap ? fmt(C.stepcap) : "none") +
      ", spend cap " + (C.spendcap ? money(C.spendcap) : "none") + ", time cap " + (C.timecap ? span(C.timecap) : "none") +
      ". Repeat detection " + (C.repeat ? "on" : "off") + ". Hand over " + (C.handover ? "on" : "off") + ".";
    ui.rate.textContent = "Each step: " + fmt(IN_TOK) + " tokens in (the window keeps the last 10 steps), " + fmt(OUT_TOK) +
      " out, " + money(CENTS) + ". One every 15 s while it loops: 4 a minute, 240 an hour, " + money(CENTS * 240) + " an hour.";
    clear(ui.trace);
    if (!R) {
      ui.el("li", "list-style:none;", "Nothing has run yet.", ui.trace);
      ui.hand.textContent = "Nothing yet.";
    } else {
      var n = R.steps.length;
      var i;
      if (n <= 6) {
        for (i = 0; i < n; i++) stepItem(ui, R, R.steps[i]);
      } else {
        for (i = 0; i < 3; i++) stepItem(ui, R, R.steps[i]);
        ui.el("li", "list-style:none;font-style:italic;", "... " + fmt(n - 5) + " more steps, one every 15 s or so ...", ui.trace);
        for (i = n - 2; i < n; i++) stepItem(ui, R, R.steps[i]);
      }
      ui.hand.textContent = handed(C, R) + ".";
    }
    S.stat.steps(R ? fmt(R.steps.length) : "0");
    S.stat.cost(money(R ? R.cents : 0));
    S.stat.calls(R ? fmt(R.calls) : "0");
    S.stat.same(R ? fmt(R.same) : "0");
    S.stat.at(R ? clock(R.start + R.at) : "not run");
    S.stat.by(R ? byText(R) : "not run");
    S.stat.cleaned(fmt(R ? R.cleaned : 0) + " of " + fmt(BOOKINGS));
    S.stat.handed(R ? handed(C, R) : "nothing yet");
  }

  function runIt(api) {
    var S = api.state;
    var C = S.C;
    var R = simulate(C);
    S.R = R;
    var s = "Run from " + clock(R.start) + ": " + fmt(R.steps.length) + " steps, " + money(R.cents) + ", " +
      fmt(R.calls) + (R.calls === 1 ? " call" : " calls") + " to Gatewicket. Stopped at " + clock(R.start + R.at) +
      " by " + byText(R) + ". Bookings cleaned: " + fmt(R.cleaned) + " of " + fmt(BOOKINGS) + ". Handed over: " + handed(C, R) + ".";
    api.log(s, R.ok && !R.masked ? "ok" : "bad");
    if (R.same >= 3) api.log("Repeated call: " + EXPORT + ", " + fmt(R.same) + " steps in a row, each result: " + R.steps[R.steps.length - 1].result + ".", "warn");
    if (R.tail > 0) api.log("The step cap of " + fmt(C.stepcap) + " was " + fmt(R.tail) + " steps, " + span(R.tail * STEP) + " and " + money(R.tail * CENTS) + " away.", "warn");
    if (R.by === "model") api.log("The model's note: " + R.steps[R.steps.length - 1].result, "");
    if (R.masked) api.log("The tool said " + MASKED + ", so nothing looked wrong. The model's last words: " + R.steps[R.steps.length - 1].result, "bad");
    draw(api);
  }

  function changed(api, what) {
    api.state.R = null;
    api.log(what + " Nothing run yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a4e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { when: "night", quota: true, message: "bare", backoff: "none", stepcap: 2000, spendcap: 0, timecap: 0, repeat: false, handover: false };
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function sel(id, label, list, init, key, num) {
        S.ctl[id] = api.control.select(id, label, list, init, function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = num ? capNum(String(v)) : String(v);
          changed(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key) {
        S.ctl[id] = api.control.toggle(id, label, S.C[key], function (on) {
          S.C[key] = !!on;
          changed(api, label + ": " + (on ? "on." : "off."));
        });
      }
      sel("when", "When it runs", WHENS, "night", "when", false);
      tog("quota", "Shared quota already spent at the start (as on Friday)", "quota");
      sel("message", "What the tool tells the agent on a 429", MSGS, "bare", "message", false);
      sel("backoff", "Backoff in the tool wrapper", BACKOFFS, "none", "backoff", false);
      sel("stepcap", "Step cap", STEPCAPS, "2000", "stepcap", true);
      sel("spendcap", "Spend cap per run", SPENDCAPS, "none", "spendcap", true);
      sel("timecap", "Time cap per run", TIMECAPS, "none", "timecap", true);
      tog("repeat", "Stop when the same call gets the same result 3 times in a row", "repeat");
      tog("handover", "When a limit stops it, hand over to the night on-call with the trace", "handover");
      S.ctl.run = api.control.button("run", "Run it", function () { runIt(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        steps: api.stat("steps", "steps (model calls)", ""),
        cost: api.stat("cost", "cost at the teaching price", "bad"),
        calls: api.stat("calls", "calls to Gatewicket", ""),
        same: api.stat("same", "same call and result, most in a row", "warn"),
        at: api.stat("at", "stopped at", ""),
        by: api.stat("by", "stopped by", ""),
        cleaned: api.stat("cleaned", "bookings cleaned", "ok"),
        handed: api.stat("handed", "handed over", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one model call: a thought, one action and its result. A stand-in with stated rules plays the model. Backoff happens in the tool wrapper, which sees Gatewicket's 429 and its Retry-After header before it writes a message for the agent; its retries are calls, not steps, and cost nothing. Change a control, then press Run it.");
      api.log("Friday 9 October, 23:10:00. Nothing has run yet. Each step sends 40,000 tokens and writes 2,000: $0.15 at the teaching price.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var S = t.api.state;
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function out() {
        return [t.stat("steps"), t.stat("cost"), t.stat("calls"), t.stat("at"), t.stat("by")].join(" | ");
      }

      // 1. The opening state: 23:10:00, before step 1.
      t.expect(t.stat("steps") === 0 && t.stat("cost") === "$0.00" && t.stat("calls") === 0 && t.stat("at") === "not run" &&
        t.stat("by") === "not run" && t.stat("cleaned") === "0 of 4,350" && has("Friday 9 October, 23:10:00. Nothing has run yet."),
        "Opens at 23:10:00 before step 1: nothing run, 0 of 4,350 cleaned");

      // 2. The night as built.
      t.click("run");
      t.expect(out() === "1,900 | $285.00 | 1,900 | 07:05:00 | Orla, the morning on-call" && t.stat("same") === "1,900" &&
        t.stat("cleaned") === "0 of 4,350" && t.stat("handed") === "nothing: Orla found it at 07:05:00" &&
        S.R.steps[1899].at === 28485 && S.R.steps[0].result === "request failed" &&
        has("Repeated call: export_bookings(date: 2026-10-09), 1,900 steps in a row, each result: request failed.") &&
        has("The step cap of 2,000 was 100 steps, 25 min and $15.00 away."),
        "As built: 1,900 identical steps from 23:10:00, $285.00, Orla stops it at 07:05:00; the cap was 100 steps away");

      // 3. Option 0: raise the step cap. The same night.
      t.set("stepcap", "5000");
      t.click("run");
      t.expect(out() === "1,900 | $285.00 | 1,900 | 07:05:00 | Orla, the morning on-call" &&
        has("The step cap of 5,000 was 3,100 steps, 12 h 55 min and $465.00 away."),
        "Step cap 5,000: the same 1,900 steps and $285.00");

      // 4. Each cap alone.
      t.set("stepcap", "120");
      t.click("run");
      var a = out();
      t.set("stepcap", "none");
      t.set("spendcap", "2000");
      t.click("run");
      var b = out();
      t.set("spendcap", "none");
      t.set("timecap", "3600");
      t.click("run");
      t.expect(a === "120 | $18.00 | 120 | 23:40:00 | step cap" && b === "133 | $19.95 | 133 | 23:43:15 | spend cap" &&
        out() === "240 | $36.00 | 240 | 00:10:00 | time cap" && t.stat("handed") === "nothing: the run ended quietly",
        "Caps alone: 120 steps by 23:40:00, $19.95 by 23:43:15, 240 steps and $36.00 by 00:10:00");
      t.set("timecap", "none");

      // 5. Repeat detection, then with a handover.
      t.set("stepcap", "2000");
      t.set("repeat", true);
      t.click("run");
      var c = out() === "3 | $0.45 | 3 | 23:10:45 | repeat detection" && t.stat("handed") === "nothing: the run ended quietly";
      t.set("handover", true);
      t.click("run");
      t.expect(c && t.stat("handed") === "the trace of 3 steps, to the night on-call at 23:10:45" && t.stat("same") === 3,
        "Repeat detection: 3 steps, $0.45, 23:10:45; with hand over, the trace goes to the night on-call");

      // 6. An instructive error, no backoff: the model stops and says when to rerun.
      t.set("message", "instructive");
      t.click("run");
      t.expect(out() === "2 | $0.30 | 1 | 23:10:30 | the model, with a note" && has("Rerun after 23:40:15.") &&
        t.stat("cleaned") === "0 of 4,350",
        "Instructive error: 2 steps, $0.30, the model stops at 23:10:30 and says rerun after 23:40:15");

      // 7. Honour Retry-After: the wrapper waits 30 minutes and the night's work is done.
      t.set("backoff", "honour");
      t.click("run");
      t.expect(out() === "60 | $9.00 | 2 | 23:55:00 | finished" && t.stat("cleaned") === "4,350 of 4,350" &&
        S.R.steps[1].at === 1815 && t.stat("handed") === "nothing needed: done",
        "Honour Retry-After: one retry at 23:40:15 gets through; 60 steps, $9.00, done at 23:55:00");

      // 8. Doubling that ignores Retry-After, with and without a time cap.
      t.set("backoff", "doubling");
      t.click("run");
      var d = out() === "60 | $9.00 | 9 | 00:28:45 | finished" && S.R.steps[1].at === 3840;
      t.set("timecap", "3600");
      t.click("run");
      t.expect(d && out() === "1 | $0.15 | 8 | 00:10:00 | time cap" &&
        t.stat("handed") === "the trace of 1 step, to the night on-call at 00:10:00",
        "Doubling: 9 calls, through at 00:14:00, done 00:28:45; a 1 h time cap stops it at 00:10:00 after 8");

      // 9. Option 1: caps on steps, spend and time, repeat detection, Retry-After honoured, hand over.
      t.set("backoff", "honour");
      t.set("stepcap", "120");
      t.set("spendcap", "2000");
      t.click("run");
      t.expect(out() === "60 | $9.00 | 2 | 23:55:00 | finished" && t.stat("cleaned") === "4,350 of 4,350",
        "Option 1: 60 steps, $9.00, done at 23:55:00, every cap unused");

      // 10. Option 2: the tool reports success on a rate limit.
      t.set("message", "masked");
      t.click("run");
      t.expect(out() === "2 | $0.30 | 1 | 23:10:30 | finished: the tool said success" && t.stat("cleaned") === "0 of 4,350" &&
        t.stat("handed") === "nothing: it reported done" && has("Done. Friday had 0 bookings to clean."),
        "Option 2: finished at 23:10:30 having cleaned 0 of 4,350, reported done");

      // 11. Option 3: in the day with someone watching, as built otherwise.
      t.set("stepcap", "2000");
      t.set("spendcap", "none");
      t.set("timecap", "none");
      t.set("repeat", false);
      t.set("handover", false);
      t.set("message", "bare");
      t.set("backoff", "none");
      t.set("when", "day");
      t.click("run");
      var e = out() === "40 | $6.00 | 40 | 09:10:00 | the person watching";
      t.set("quota", false);
      t.click("run");
      t.expect(e && out() === "60 | $9.00 | 1 | 09:15:00 | finished",
        "Day, watched: stopped at the 09:10:00 glance after 40 steps, $6.00; with a free quota, done at 09:15:00");
    }
  });
})();
