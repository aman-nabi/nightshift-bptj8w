/* sims/s6e02-v1.0.0.js  (published as sims/s6e02.js)
   Case s6e02 "The Breaker Box": a pool lab for Hollinsbury Court, an old apartment block whose one
   small building server answers the front-door fob readers, the lift buttons and the basement
   laundry with one shared pool of helpers (threads). Paying for a dryer asks an outside payment
   company, Tillpenny. Tonight Tillpenny takes every request and never answers. The learner sets the
   pool, the payment timeout, server retries, a separate payment pool (bulkhead), a circuit breaker,
   a "pay later" fallback and Tillpenny's behaviour, then runs the night one second per tick.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: shared helpers 10 or 20; payment timeout 60, 10 or 3 s;
     server retries 0 or 2; own 2 payment helpers on or off; breaker on or off; pay later on or off;
     Tillpenny answers in 1 s, errors at once, or never answers (can be changed mid-night); 12
     dryers (tonight) or 24 (every dryer in the basement); start one more dryer now. Stats: time,
     shared helpers busy, dryers waiting for payment, requests in line, fob refusals, last refusal,
     breaker, dryers paid, paid later, payment failed. selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - One tick is one second, from 23:00:00. Nothing has run when the sim opens.
   - Shared helpers: 10 as built. Each takes one request at a time from one line, first come first
     served. With "own 2 payment helpers" on, 2 of them serve payments only and the rest serve
     everything else; the payment pair has no line: if both are busy, the payment fails at once.
   - Front door: a fob tap every 20 s, at :09, :29 and :49 past each minute (about three a minute,
     the door's usual rate at that hour). A fob check takes 50 ms, so a free helper finishes it in
     the same second. The reader waits 5 s: a tap still in line 5 s after it was made is refused,
     "timed out", and logged at that moment (tap + 5 s).
   - Dryers tonight start at 23:00:00, :06, :12 ... :54 (ten, one every 6 s), 23:01:02 and 23:02:30.
     The 24-dryer night adds 23:00:03, :09 ... :57 (ten more), 23:01:32 and 23:02:50.
   - A payment asks Tillpenny. Answers: paid after 1 s. Errors at once: fails in the same second.
     Never answers: holds its helper for the timeout, then fails. Server retries repeat a failed
     payment on the same helper, so a hang holds it timeout x (1 + retries).
   - After a failure the dryer asks again at once, 5 tries in all, then shows "payment failed".
   - Breaker: trips (open) when 5 payments have failed within the last 60 s; while open every
     payment fails at once without a helper; after 30 s it is half-open and lets the next payment
     through as a test: answered, it closes; failed, it opens for 30 s more.
   - Pay later: any failed payment is answered "pay later, added to your service charge" and the
     dryer runs.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e02-v1.0.0.json):
   - As built: all 10 helpers busy from 23:00:54 (ten dryers, 0 to 54 s). Dryer 11 at 23:01:02 and
     dryer 12 at 23:02:30 wait in line, so every fob tap from 23:01:09 waits behind payments. 14
     refusals, 23:01:14 to 23:05:34 (taps 23:01:09 to 23:05:29, three a minute for 4 minutes plus
     two). Helpers last all busy at 23:05:47. 10 dryers waiting for payment at once, never more.
     Dryers 1 to 11 show "payment failed" 23:05:30 to 23:06:42; dryer 12 at 23:08:00.
   - Earlier nights (errors at once): 0 refusals, 12 dryers fail in the second they start.
   - A normal night (answers): 12 paid, 0 refusals.
   - Option 0, 20 helpers: tonight 0 refusals, 12 payment failed. 24 dryers: all 20 busy from
     23:00:57, 13 refusals, 23:01:14 to 23:05:34.
   - Option 1, 10 s timeout: tonight 0 refusals, 12 payment failed. 24 dryers: 2 refusals
     (23:00:54, 23:01:14).
   - Option 2, 2 server retries: 51 refusals, 23:01:14 to 23:17:54.
   - Option 3, own 2 helpers + 3 s + breaker + pay later: 0 refusals, 12 paid later. Dryers 1 to 5
     wait 3 s each; the breaker trips at 23:00:27; dryers 6 to 10 get pay later at once; test calls
     at 23:01:02 and 23:02:30 fail after 3 s. Tillpenny back, one more dryer: the test is answered
     and the breaker closes.
   - Breaker alone (shared 10, 60 s): 1 refusal (23:01:14), trips at 23:01:24.
*/
(function () {
  "use strict";

  var K = 5;              // tries per dryer
  var FOB_WAIT = 5;       // s the door reader waits
  var TAP_EVERY = 20;
  var TAP_FIRST = 9;      // 23:00:09
  var END = 1200;         // 23:20:00
  var TRIP_FAILS = 5;
  var TRIP_WINDOW = 60;
  var OPEN_FOR = 30;
  var PAY_POOL = 2;
  var TONIGHT = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 62, 150];
  var BUSY = TONIGHT.concat([3, 9, 15, 21, 27, 33, 39, 45, 51, 57, 92, 170]);

  var PROVIDERS = [
    { value: "hang", label: "Never answers (tonight)" },
    { value: "error", label: "Errors at once (earlier outages)" },
    { value: "answer", label: "Answers in 1 s (a normal night)" }
  ];

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hms(s) { return "23:" + two(Math.floor(s / 60)) + ":" + two(s % 60); }

  /* ---------- the model ---------- */

  function newNight(C, provider) {
    var starts = C.dryers === 24 ? BUSY : TONIGHT;
    var shared = C.bulkhead ? C.pool - PAY_POOL : C.pool;
    return {
      C: C, t: 0, provider: provider, line: [], held: [],
      shared: shared, freeShared: shared, freePay: C.bulkhead ? PAY_POOL : 0,
      dry: starts.map(function (a, i) { return { n: i + 1, at: a, tries: 0, st: "idle", waited: 0 }; }),
      refusals: [], taps: 0, fails: [], br: "closed", openUntil: 0, testOut: false, trips: [],
      events: []
    };
  }

  function note(N, s, txt, tone) { N.events.push({ s: s, txt: hms(s) + " " + txt, tone: tone || "" }); }

  function openBreaker(N, s, txt) {
    N.br = "open";
    N.openUntil = s + OPEN_FOR;
    N.trips.push(s);
    note(N, s, txt, "warn");
  }

  function failPay(N, s, d, counts, queue) {
    var C = N.C;
    if (counts && C.breaker) {
      N.fails.push(s);
      N.fails = N.fails.filter(function (f) { return f > s - TRIP_WINDOW; });
      if (N.br === "closed" && N.fails.length >= TRIP_FAILS) openBreaker(N, s, "breaker trips: " + TRIP_FAILS + " failed payments within 60 s. Open.");
    }
    if (C.fallback) { d.st = "later"; return; }
    if (d.tries < K) queue.push({ k: "pay", d: d });
    else { d.st = "failed"; note(N, s, "dryer " + d.n + ": payment failed", "bad"); }
  }

  function step(N) {
    var C = N.C;
    var s = N.t;
    var re = [];
    var keep = [];
    var i;
    N.held.forEach(function (h) {
      if (h.end > s) { keep.push(h); return; }
      if (h.pay) N.freePay += 1; else N.freeShared += 1;
      if (h.test) {
        N.testOut = false;
        if (h.ok) { N.br = "closed"; N.fails = []; note(N, s, "test call answered. Breaker closed.", "ok"); }
        else openBreaker(N, s, "test call failed. Breaker open for 30 s more.");
      }
      if (h.ok) h.d.st = "paid"; else failPay(N, s, h.d, !h.test, re);
    });
    N.held = keep;
    if (C.breaker && N.br === "open" && s >= N.openUntil) { N.br = "half-open"; note(N, s, "breaker half-open: the next payment is a test.", ""); }
    N.dry.forEach(function (d) { if (d.at === s) { d.st = "asking"; N.line.push({ k: "pay", d: d }); } });
    re.forEach(function (x) { N.line.push(x); });
    if (s >= TAP_FIRST && (s - TAP_FIRST) % TAP_EVERY === 0) { N.taps += 1; N.line.push({ k: "fob", t: s }); }
    var rest = [];
    for (i = 0; i < N.line.length; i++) {
      var it = N.line[i];
      if (it.k === "fob") {
        if (N.freeShared === 0) rest.push(it);
        continue;
      }
      var d = it.d;
      if (C.breaker && (N.br === "open" || (N.br === "half-open" && N.testOut))) {
        d.tries += 1;
        failPay(N, s, d, false, N.line);
        continue;
      }
      if (C.bulkhead) {
        if (N.freePay === 0) { d.tries += 1; failPay(N, s, d, false, N.line); continue; }
      } else if (N.freeShared === 0) { rest.push(it); continue; }
      d.tries += 1;
      var test = C.breaker && N.br === "half-open";
      if (test) N.testOut = true;
      if (N.provider === "error") {
        if (test) { N.testOut = false; openBreaker(N, s, "test call failed. Breaker open for 30 s more."); }
        failPay(N, s, d, !test, N.line);
        continue;
      }
      if (C.bulkhead) N.freePay -= 1; else N.freeShared -= 1;
      var ok = N.provider === "answer";
      var dur = ok ? 1 : C.timeout * (1 + C.retries);
      if (!ok) d.waited += dur;
      N.held.push({ d: d, end: s + dur, ok: ok, pay: !!C.bulkhead, test: test });
    }
    N.line = rest.filter(function (x) {
      if (x.k === "fob" && s - x.t >= FOB_WAIT) {
        N.refusals.push(s);
        note(N, s, "front door: fob tapped at " + hms(x.t) + ", timed out", "bad");
        return false;
      }
      return true;
    });
    N.t = s + 1;
  }

  function count(N, st) { return N.dry.filter(function (d) { return d.st === st; }).length; }
  function payHeld(N) { return N.held.filter(function (h) { return !h.ok; }).length; }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var helpers = el("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:4px;font-size:11px;");
    var line = el("p", "margin:0;font-size:12px;");
    var door = el("p", "margin:0;font-size:12px;");
    var laundry = el("p", "margin:0;font-size:12px;");
    [head, helpers, line, door, laundry].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, helpers: helpers, line: line, door: door, laundry: laundry };
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = hms(N.t) + ". " + N.shared + " shared helpers" + (C.bulkhead ? " and 2 for payments only" : "") +
      ". Payment timeout " + C.timeout + " s" + (C.retries ? ", " + C.retries + " server retries" : "") +
      ". Breaker " + (C.breaker ? "on" : "off") + ". Pay later " + (C.fallback ? "on" : "off") + ". Tillpenny: " +
      (N.provider === "hang" ? "never answers." : (N.provider === "error" ? "errors at once." : "answers in 1 s."));
    while (ui.helpers.firstChild) ui.helpers.removeChild(ui.helpers.firstChild);
    var sh = N.held.filter(function (h) { return !h.pay; });
    var ph = N.held.filter(function (h) { return h.pay; });
    function cell(h, label) {
      var txt = h ? label + ": dryer " + h.d.n + ", " + (h.ok ? "paying" : (h.end - N.t) + " s left") : label + ": free";
      ui.helpers.appendChild(ui.el("div", "border:1px solid currentColor;border-radius:4px;padding:3px;opacity:" + (h ? "1" : "0.55") + ";", txt));
    }
    var i;
    for (i = 0; i < N.shared; i++) cell(sh[i], "helper " + (i + 1));
    if (C.bulkhead) for (i = 0; i < PAY_POOL; i++) cell(ph[i], "payment " + (i + 1));
    ui.line.textContent = "In line: " + (N.line.length ? N.line.map(function (x) { return x.k === "fob" ? "fob (" + hms(x.t) + ")" : "dryer " + x.d.n; }).join(", ") : "nobody") + ".";
    ui.door.textContent = "Door log, refusals: " + (N.refusals.length ? N.refusals.map(hms).join(", ") : "none yet") + ".";
    ui.laundry.textContent = "Laundry: " + N.dry.map(function (d) {
      var st = d.st === "idle" ? "not started" : (d.st === "asking" ? "waiting for payment" : (d.st === "later" ? "pay later" : (d.st === "paid" ? "paid" : "payment failed")));
      return "dryer " + d.n + " " + st;
    }).join("; ") + ".";
    S.stat.time(hms(N.t));
    S.stat.busy((N.shared - N.freeShared) + " of " + N.shared);
    S.stat.waiting(payHeld(N));
    S.stat.line(N.line.length);
    S.stat.refused(N.refusals.length);
    S.stat.last(N.refusals.length ? hms(N.refusals[N.refusals.length - 1]) : "none");
    S.stat.breaker(C.breaker ? N.br : "none fitted");
    S.stat.paid(count(N, "paid"));
    S.stat.later(count(N, "later"));
    S.stat.failed(count(N, "failed"));
    S.ctl.sec.disable(N.t >= END);
    S.ctl.min.disable(N.t >= END);
    S.ctl.all.disable(N.t >= END);
  }

  function run(api, secs) {
    var S = api.state;
    var N = S.N;
    var from = N.events.length;
    var r0 = N.refusals.length;
    var stop = Math.min(END, N.t + secs);
    var t0 = N.t;
    while (N.t < stop) step(N);
    var evs = N.events.slice(from);
    var other = evs.filter(function (e) { return e.txt.indexOf("front door") < 0; });
    var newRef = N.refusals.slice(r0);
    var s = hms(t0) + " to " + hms(N.t) + ": " + (newRef.length ? newRef.length + " fob " + (newRef.length === 1 ? "refusal" : "refusals") + " (" + newRef.map(hms).join(", ") + ")" : "no fob refusals") +
      "; " + payHeld(N) + " dryers waiting for payment now.";
    if (other.length) s += " " + other.map(function (e) { return e.txt; }).join(". ") + ".";
    api.log(s, newRef.length ? "bad" : (other.some(function (e) { return e.tone === "warn"; }) ? "warn" : "ok"));
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.N = newNight(S.C, S.provider);
    api.log((why ? why + " " : "") + "23:00:00, before the first dryer starts. " + S.N.dry.length + " dryers tonight, " + S.N.shared + " shared helpers" +
      (S.C.bulkhead ? " plus 2 for payments" : "") + ".", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { pool: 10, timeout: 60, retries: 0, bulkhead: false, breaker: false, fallback: false, dryers: 12 };
      S.provider = "hang";
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      S.ctl.pool = api.control.select("pool", "Shared helpers", [{ value: 10, label: "10 (as built)" }, { value: 20, label: "20" }], 10, opt("pool", Number));
      S.ctl.timeout = api.control.select("timeout", "Payment timeout", [{ value: 60, label: "60 s (as built)" }, { value: 10, label: "10 s" }, { value: 3, label: "3 s" }], 60, opt("timeout", Number));
      S.ctl.retries = api.control.select("retries", "Server retries a failed payment", [{ value: 0, label: "no" }, { value: 2, label: "twice" }], 0, opt("retries", Number));
      S.ctl.bulkhead = api.control.toggle("bulkhead", "Payments get their own 2 helpers", false, opt("bulkhead", function (v) { return !!v; }));
      S.ctl.breaker = api.control.toggle("breaker", "Breaker on payments", false, opt("breaker", function (v) { return !!v; }));
      S.ctl.fallback = api.control.toggle("fallback", "Pay later when payment fails", false, opt("fallback", function (v) { return !!v; }));
      S.ctl.dryers = api.control.select("dryers", "Dryers started", [{ value: 12, label: "12 (tonight)" }, { value: 24, label: "24 (every dryer)" }], 12, opt("dryers", Number));
      S.ctl.provider = api.control.select("provider", "Tillpenny (changes now, mid-night)", PROVIDERS, "hang", function (v) {
        S.provider = String(v);
        S.N.provider = S.provider;
        api.log(hms(S.N.t) + " Tillpenny now " + (S.provider === "hang" ? "never answers." : (S.provider === "error" ? "errors at once." : "answers in 1 s.")), "");
        draw(api);
      });
      S.ctl.more = api.control.button("more", "Start one more dryer now", function () {
        var N = S.N;
        var d = { n: N.dry.length + 1, at: N.t, tries: 0, st: "idle", waited: 0 };
        N.dry.push(d);
        api.log(hms(N.t) + " dryer " + d.n + " is started.", "");
        draw(api);
      });
      S.ctl.again = api.control.button("new", "Start the night again", function () { restart(api, "New night."); });
      S.ctl.sec = api.control.button("sec", "Next 10 seconds", function () { run(api, 10); });
      S.ctl.min = api.control.button("min", "Next minute", function () { run(api, 60); });
      S.ctl.all = api.control.button("all", "Run to 23:20", function () { run(api, END); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        time: api.stat("time", "time", ""),
        busy: api.stat("busy", "shared helpers busy", "warn"),
        waiting: api.stat("waiting", "dryers waiting for payment", "warn"),
        line: api.stat("line", "requests in line", ""),
        refused: api.stat("refused", "fob refusals", "bad"),
        last: api.stat("last", "last refusal", ""),
        breaker: api.stat("breaker", "breaker", ""),
        paid: api.stat("paid", "dryers paid", "ok"),
        later: api.stat("later", "dryers on pay later", "ok"),
        failed: api.stat("failed", "dryers: payment failed", "bad")
      };
      api.info("<strong>How to read it.</strong> Each box is a helper and what it holds: a dryer's payment and the seconds before it gives up, or nothing. Everything else waits in one line, first come first served. A fob tap still in line after 5 s is refused. Dryers ask again at once after a failed payment, 5 tries in all. Run the night 10 seconds or a minute at a time.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function S() { return t.api.state; }
      function refs() { return S().N.refusals.map(hms).join(" "); }

      // 1. Opens at 23:00:00, before the first dryer starts.
      t.expect(t.stat("time") === "23:00:00" && t.stat("busy") === "0 of 10" && t.stat("waiting") === 0 && t.stat("refused") === 0 &&
        t.stat("breaker") === "none fitted" && t.stat("last") === "none" && S().N.t === 0,
        "Opens at 23:00:00: 10 shared helpers, all free, nothing run yet");

      // 2. By 23:01:00 ten dryers hold all ten helpers, and nobody has been refused yet.
      t.click("min");
      t.expect(t.stat("time") === "23:01:00" && t.stat("busy") === "10 of 10" && t.stat("waiting") === 10 && t.stat("refused") === 0,
        "23:01:00: 10 dryers waiting for payment hold all 10 helpers; no refusal yet");

      // 3. The record: 14 refusals, 23:01:14 to 23:05:34, never more than 10 dryers waiting.
      var most = 0;
      while (S().N.t < 600) { t.click("sec"); if (t.stat("waiting") > most) most = t.stat("waiting"); }
      t.expect(t.stat("refused") === 14 && t.stat("last") === "23:05:34" && S().N.refusals[0] === 74 && most === 10 &&
        t.stat("failed") === 12 && t.stat("paid") === 0,
        "As built: 14 refusals from 23:01:14 to 23:05:34, 10 dryers waiting at most, all 12 payment failed by 23:10");

      // 4. Earlier outages answered with an error at once: nobody's door stuck.
      t.set("provider", "error");
      t.click("new");
      t.click("all");
      t.expect(t.stat("refused") === 0 && t.stat("failed") === 12 && t.stat("waiting") === 0,
        "Errors at once (earlier nights): 0 refusals, 12 dryers show payment failed straight away");

      // 5. A normal night: everyone pays.
      t.set("provider", "answer");
      t.click("new");
      t.click("all");
      t.expect(t.stat("paid") === 12 && t.stat("refused") === 0, "Tillpenny answering: 12 dryers paid, 0 refusals");
      t.set("provider", "hang");

      // 6. Option 0: 20 helpers hold tonight, but 24 dryers fill them too.
      t.set("pool", 20);
      t.click("all");
      var a0 = t.stat("refused") === 0 && t.stat("failed") === 12;
      t.set("dryers", 24);
      t.click("all");
      t.expect(a0 && t.stat("refused") === 13 && refs().indexOf("23:01:14") === 0 && t.stat("last") === "23:05:34",
        "20 helpers: 0 refusals tonight, 13 (23:01:14 to 23:05:34) when all 24 dryers run");

      // 7. Option 1: a 10 s timeout clears tonight, still crowds a 24-dryer night.
      t.set("pool", 10);
      t.set("timeout", 10);
      t.click("all");
      var b24 = t.stat("refused") === 2 && refs() === "23:00:54 23:01:14";
      t.set("dryers", 12);
      t.click("all");
      t.expect(b24 && t.stat("refused") === 0 && t.stat("failed") === 12,
        "10 s timeout: 0 refusals tonight but all 12 payments failed; 2 refusals with 24 dryers");

      // 8. Option 2: two server retries hold each helper three minutes.
      t.set("timeout", 60);
      t.set("retries", 2);
      t.click("all");
      t.expect(t.stat("refused") === 51 && t.stat("last") === "23:17:54", "2 server retries: 51 refusals, the last at 23:17:54");
      t.set("retries", 0);

      // 9. Option 3: own 2 helpers, 3 s, breaker, pay later.
      t.set("bulkhead", true);
      t.set("timeout", 3);
      t.set("breaker", true);
      t.set("fallback", true);
      t.click("min");
      var tripped = S().N.trips[0] === 27 && t.stat("breaker") === "half-open";
      t.click("all");
      var waited = S().N.dry.filter(function (d) { return d.waited === 3; }).length;
      t.expect(tripped && t.stat("refused") === 0 && t.stat("later") === 12 && t.stat("failed") === 0 && waited === 7 && t.stat("busy") === "0 of 8",
        "Own 2 helpers + 3 s + breaker + pay later: 0 refusals, 12 on pay later, breaker tripped at 23:00:27, 7 dryers waited 3 s");

      // 10. The breaker closes once Tillpenny answers a test call (23:03:10: half-open since 23:03:03).
      t.click("new");
      t.click("min");
      t.click("min");
      t.click("min");
      t.click("sec");
      var half = t.stat("breaker") === "half-open";
      t.set("provider", "answer");
      t.click("more");
      t.click("sec");
      t.expect(half && t.stat("breaker") === "closed" && t.stat("paid") === 1 && t.stat("later") === 12 && t.stat("time") === "23:03:20",
        "Tillpenny back at 23:03:10: dryer 13's payment is the test, it is answered, the breaker closes");
      t.set("provider", "hang");

      // 11. A breaker alone on the shared pool: it trips, but only after a minute of waiting.
      t.set("bulkhead", false);
      t.set("timeout", 60);
      t.set("fallback", false);
      t.click("all");
      t.expect(t.stat("refused") === 1 && t.stat("last") === "23:01:14" && S().N.trips[0] === 84 && t.stat("failed") === 12,
        "Breaker alone, 60 s timeout: trips at 23:01:24 after 1 refusal (23:01:14); dryers fail fast after that");
    }
  });
})();
