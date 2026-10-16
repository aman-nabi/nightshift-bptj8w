/* sims/s9e15-v1.0.0.js  (published as sims/s9e15.js)
   Case s9e15 "Matching Engine": a matching lab for an all-night online auction house, replaying the
   close of lot 77, a guitar signed by Jubal Okerlund, at 03:00:00 on Saturday 7 November 2026 (the
   night of Friday 6 to Saturday 7 November). Bids reach a primary matching engine and a standby that
   gets a copy of every bid. Each engine applies bids with 4 threads; between equal bids, the one
   applied first wins. The learner picks the threads, how equal bids are ordered (thread race as run,
   arrival stamp, or a sequencer with a journal and one thread), a row lock in the database, whether
   the primary's power supply fails at 03:00:04, and whether the standby asks the primary who won,
   then steps the close event by event. Widget-style sim: it draws inside api.root. Button-driven
   (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls threads (1, 4, 8), ordering (thread race, arrival
     stamp, sequencer with journal), row lock, primary failure, standby asks the primary; buttons
     Next event, Play to the end, Reset. Stats: time, each engine's applied order and winner,
     whether they agree, emails sent, slips printed, result out, bids a second, queue wait, bid
     numbers, journal, standby replay, answer from the primary. selfTest: 10 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e15-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   Times are kept in ticks of 0.1 ms after 02:59:50.0000.
   - Lot 77's bids (given): fretwire_kwaku £420 at 02:59:51.0000 (front door 1); capo_haizea £430
     at 02:59:54.0000 (door 2); another bidder £440 at 02:59:56.5000 (door 1); fretwire_kwaku £450
     at 02:59:58.4127 (door 1); capo_haizea £450 at 02:59:58.4130 (door 2): 0.3 ms apart.
   - Lot 77 closes at 03:00:00. Equal bids: the second is not higher, so the one applied first wins.
   - Thread race (given): with several threads, a bid waits a random time for its thread to get the
     lot's lock: up to 2 ms with 4 threads, up to 4 ms with 8, none with 1. Only bids less than 4 ms
     apart can swap, so only the two £450 bids draw. api.rand() is drawn 4 times in setup, primary
     first (kwaku, haizea), then standby: with seed 7, 0.0117, 0.0620, 0.9769, 0.6990. 4 threads
     (up to 2 ms): primary, kwaku ready at 0.0234 ms, haizea at 0.3 + 0.1240 = 0.4240 ms, so kwaku
     first; standby, kwaku at 1.9538 ms, haizea at 0.3 + 1.3980 = 1.6980 ms, so haizea first: two
     winners. 8 threads (up to 4 ms): primary 0.0468 and 0.5480, standby 3.9076 and 3.0960: the
     same orders. 1 thread: arrival order on both, one winner, but no record to replay.
   - Arrival stamps (given): each bid is stamped by the front door it came through; door 2's clock
     runs 0.3 ms behind door 1's, so both £450 bids are stamped 02:59:58.412700: a tie to the
     microsecond, broken by the threads as before.
   - Takeover (given): a heartbeat every second; after 2 seconds of silence the standby takes over.
     The power supply fails at 03:00:04, so the standby takes over at 03:00:06 and sends again the
     result of every lot closed in the last 10 seconds. The email and slip systems drop a repeat to
     the same winner. Slips print 1 second after their email. Asking the primary: no answer after
     03:00:04; the standby waits 2 seconds, then sends its own result at 03:00:08.
   - Work per bid (given): 0.02 ms; threads sharing a lot's lock spend 0.0075 ms a bid per thread
     handing it over. 1 thread: 1,000 / 0.02 = 50,000 bids a second; 4: 1,000 / 0.05 = 20,000;
     8: 1,000 / 0.08 = 12,500. The sequencer's one thread needs no lock: 50,000.
   - Busy close (given): from 02:59:50 bids for all lots arrive evenly, one every 2.5 ms (400 a
     second), the first at 02:59:50.0010. Row lock: each bid is saved to the database's disk before
     its lock is let go, 5 ms a bid, one at a time: 200 a second. Bid j (in arrival order) starts
     at 0.0010 + 5(j - 1) ms. kwaku's £450 is j = 3,365 + 3 + 1 = 3,369: applied at 03:00:06.8410,
     after waiting 8.4 s. The 4,000 + 5 = 4,005 bids placed before 03:00:00 are all applied by
     03:00:10.0260: the result goes out at 03:00:10, 10.0 s after the close.
   - The standby had taken over twice before (given), both times in a quiet minute between closes,
     so no earlier takeover re-sent a result where the engines disagreed.
   - Sequencer (given): the count stood at 120,000 at 02:59:50. kwaku's £450 is 120,000 + 3,365 +
     3 + 1 = 123,369; haizea's is 123,370 (no other bid between them). The journal saves every 5 ms,
     taking all bids waiting: a bid waits at most 10 ms.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (ticks of 0.1 ms after 02:59:50.0000) ---------- */

  var BASE = 10790;            // 02:59:50 in seconds after midnight
  var CLOSE = 100000;          // 03:00:00
  var POWER = 140000;          // 03:00:04, the primary's power supply fails
  var TAKE = 160000;           // 03:00:06, 2 seconds of silence: the standby takes over
  var ASKWAIT = 20000;         // 2 seconds waiting for an answer that never comes
  var SLIP = 10000;            // a slip prints 1 second after its email
  var END = 120000 + 100000;   // 03:00:12, the end of the replay
  var DOOR2 = 3;               // door 2's clock runs 0.3 ms behind door 1's
  var BG_FIRST = 10, BG_GAP = 25;   // bids for all lots: first at 02:59:50.0010, one every 2.5 ms
  var DISK = 50;               // row lock: 5 ms a bid on the database's disk
  var SEQ0 = 120000;           // the sequencer's count at 02:59:50
  var KW = "fretwire_kwaku", HZ = "capo_haizea";
  var LOT = [
    { who: KW, amt: 420, t: 10000, door: 1 },
    { who: HZ, amt: 430, t: 40000, door: 2 },
    { who: "another bidder", amt: 440, t: 65000, door: 1 },
    { who: KW, amt: 450, t: 84127, door: 1 },
    { who: HZ, amt: 450, t: 84130, door: 2 }
  ];

  var THREADS = [{ value: "1", label: "1" }, { value: "4", label: "4 (as run)" }, { value: "8", label: "8" }];
  var ORDERS = [
    { value: "race", label: "thread race: whichever thread gets the lock first (as run)" },
    { value: "stamp", label: "arrival stamp, to the microsecond, from the front door" },
    { value: "seq", label: "sequencer: number, journal, one thread" }
  ];
  var ROWLOCK = [{ value: "off", label: "off (as run)" }, { value: "on", label: "on: 5 ms on the disk for every bid" }];
  var FAIL = [{ value: "on", label: "fails at 03:00:04 (as run)" }, { value: "off", label: "keeps running" }];
  var ASK = [{ value: "off", label: "no: it sends its own result (as run)" }, { value: "on", label: "yes: ask the primary who won" }];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(tk) {
    var s = BASE + Math.floor(tk / 10000);
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor((s % 3600) / 60)) + ":" + two(s % 60);
  }
  function frac(tk, places) {   // the part of a second, to 4 or 6 places
    var r = Math.round(tk) % 10000;
    var s = String(r);
    while (s.length < 4) s = "0" + s;
    return places === 6 ? s + "00" : s;
  }
  function fine(tk) { return hms(tk) + "." + frac(tk, 4); }
  function micro(tk) { return hms(tk) + "." + frac(tk, 6); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function bgBefore(t) { return t <= BG_FIRST ? 0 : Math.floor((t - BG_FIRST - 1) / BG_GAP) + 1; }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function spread(C) { return C.threads === "8" ? 40 : C.threads === "4" ? 20 : 0; }   // ticks
  function rate(C) {
    if (C.lock === "on") return 200;
    if (C.order === "seq" || C.threads === "1") return 50000;
    return Math.round(1000 / (0.02 + 0.0075 * Number(C.threads)));
  }
  function waitText(C) {
    if (C.lock === "on") return "10.0 s at the close";
    if (C.order === "seq") return "up to 10 ms";
    return C.threads === "1" ? "under 0.1 ms" : "up to " + (spread(C) / 10) + " ms";
  }

  // One engine's applied order for lot 77. R holds this engine's two draws (kwaku's, haizea's).
  function apply(C, R) {
    var bids = LOT.map(function (b, i) {
      var at = b.t;
      if (C.lock !== "on" && C.order !== "seq" && i >= 3) at = b.t + R[i - 3] * spread(C);
      return { i: i, who: b.who, amt: b.amt, t: b.t, at: at, stamp: b.t - (b.door === 2 ? DOOR2 : 0) };
    });
    var order = bids.slice().sort(function (x, y) { return (x.at - y.at) || (x.i - y.i); });
    var best = null;
    order.forEach(function (b) {
      if (!best || b.amt > best.amt) { b.res = "highest"; best = b; return; }
      if (b.amt === best.amt && C.lock !== "on" && C.order === "stamp" && b.stamp < best.stamp) {
        best.res = "equal, later stamp, refused"; b.res = "highest"; best = b; return;
      }
      b.res = b.amt === best.amt ? "equal, refused" : "lower, refused";
    });
    return { order: order, win: best.who };
  }

  function pairText(E) {
    var p = E.order.filter(function (b) { return b.amt === 450; });
    return p[0].who + " £450 first, then " + p[1].who + " £450 (" + p[1].res + ")";
  }

  // The whole close at once: both engines, every email and slip, in time order.
  function night(C, D) {
    var P = apply(C, D.p), S = apply(C, D.s);
    var ev = [];
    function add(t, text, tone, kind) { ev.push({ t: t, text: text, tone: tone || "", kind: kind || "" }); }
    LOT.forEach(function (b, i) {
      if (i < 3) add(b.t, fine(b.t) + " " + b.who + " bids £" + b.amt + " on lot 77, through front door " + b.door + ".", "", "bid");
    });
    add(84127, fine(84127) + " " + KW + " bids £450, through front door 1.", "", "bid");
    add(84130, fine(84130) + " " + HZ + " bids £450, through front door 2: 0.3 ms later. Equal bids.", "warn", "bid");
    var notes = [];
    if (C.lock === "on") {
      var kwStart = 10 + DISK * (bgBefore(84127) + 3);
      add(kwStart, fine(kwStart) + " row lock: the database applies " + KW + "'s £450, after " + ((kwStart - 84127) / 10000).toFixed(1) + " s in the queue for the disk.", "warn", "wait");
      notes.push("row lock: one bid at a time, in arrival order, each saved to the disk first; both engines read that one order");
    } else if (C.order === "seq") notes.push("sequencer: " + KW + " is bid " + num(SEQ0 + bgBefore(84127) + 4) + ", " + HZ + " is bid " + num(SEQ0 + bgBefore(84130) + 5) + ", in the journal; one thread applies them in number order");
    else {
      if (C.order === "stamp") notes.push("stamps tie at " + micro(84127) + ": door 2's clock runs 0.3 ms behind door 1's; " + (C.threads === "1" ? "one thread breaks the tie by arrival" : "the threads break the tie"));
      if (C.threads !== "1") notes.push("each engine's threads take both bids at once");
    }
    var lastAt = C.lock === "on" ? 10 + DISK * (bgBefore(84130) + 4) : Math.ceil(Math.max(P.order[4].at, S.order[4].at, P.order[3].at, S.order[3].at));
    var applied = C.lock === "on" ? "the database applied " + pairText(P) + "." : "primary applied " + pairText(P) + ". standby applied " + pairText(S) + ".";
    add(lastAt, fine(lastAt) + " " + (notes.length ? notes.join("; ") + ". " : "") + applied, P.win === S.win ? "ok" : "bad", "pair");
    add(CLOSE, "03:00:00 lot 77 closes. No bid after this counts.", "", "close");

    var sent = [];   // winners emailed
    function email(t, who, by) {
      if (sent.indexOf(who) >= 0) { add(t, hms(t) + " " + by + " sends the result again: " + who + ". Same winner, so the repeat is dropped: no email, no slip.", "ok", "repeat"); return; }
      sent.push(who);
      add(t, hms(t) + " " + by + " sends the result: " + who + ". 'You won' email to " + who + ".", sent.length > 1 ? "bad" : "", "email");
      add(t + SLIP, hms(t + SLIP) + " collection slip prints at the packing bench: lot 77, £450, " + who + ".", sent.length > 1 ? "bad" : "", "slip");
    }
    var out = C.lock === "on" ? 10 + DISK * (bgBefore(CLOSE) + LOT.length) : CLOSE;
    var failed = C.fail === "on";
    if (out < POWER || !failed) email(out, P.win, "the primary");
    if (failed) {
      add(POWER, "03:00:04 the primary's power supply fails. Its heartbeats stop.", "bad", "power");
      var closedBefore = out < POWER;
      if (C.ask === "on") {
        add(TAKE, "03:00:06 2 seconds without a heartbeat: the standby takes over and asks the primary who won lot 77.", "warn", "take");
        add(TAKE + ASKWAIT, "03:00:08 no answer: the primary has had no power since 03:00:04.", "bad", "noanswer");
        if (closedBefore) email(TAKE + ASKWAIT, S.win, "the standby, now primary,");
      } else {
        add(TAKE, "03:00:06 2 seconds without a heartbeat: the standby takes over. It cannot see what the primary sent, so it sends again every result from the last 10 seconds.", "warn", "take");
        if (closedBefore) email(TAKE, S.win, "the standby, now primary,");
      }
      if (!closedBefore) email(out, S.win, "the standby, now primary,");
    }
    ev.sort(function (a, b) { return a.t - b.t; });
    add(END, "03:00:12 end of the replay: " + sent.length + (sent.length === 1 ? " winner" : " winners") + " for lot 77.", sent.length > 1 ? "bad" : "ok", "end");
    return { P: P, S: S, ev: ev, sent: sent, out: out };
  }

  function nums(C) {
    if (C.lock === "on" || C.order !== "seq") return "none";
    return num(SEQ0 + bgBefore(84127) + 4) + " and " + num(SEQ0 + bgBefore(84130) + 5);
  }
  function journal(C) { return C.lock !== "on" && C.order === "seq" ? "every bid, in number order" : C.lock === "on" ? "the database's disk" : "none"; }
  function replay(C) {
    if (C.lock === "on") return "not needed: both read one database";
    return C.order === "seq" ? "replays the journal" : "not possible: nothing recorded";
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "lot 77's bids, in the order each engine applied them"));
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["engine", "applied, in order", "highest now"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, sum: sum };
  }

  function seen(S) { return S.N.ev.slice(0, S.k); }
  function has(S, kind) { return seen(S).some(function (e) { return e.kind === kind; }); }

  function rowFor(ui, name, E, S) {
    var t = S.k ? seen(S)[S.k - 1].t : 0;
    var done = E.order.filter(function (b) { return b.i < 3 ? b.t <= t : has(S, "pair"); });
    var best = null;
    done.forEach(function (b) { if (b.res === "highest") best = b; });
    var tr = ui.el("tr");
    tr.appendChild(ui.el("td", "", name));
    tr.appendChild(ui.el("td", "", done.length ? done.map(function (b) { return "£" + b.amt + " " + b.who + (b.res === "highest" ? "" : " (" + b.res + ")"); }).join(", ") : "none yet"));
    tr.appendChild(ui.el("td", "", best ? "£" + best.amt + " " + best.who : "none yet"));
    ui.body.appendChild(tr);
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui, N = S.N;
    var t = S.k ? seen(S)[S.k - 1].t : 0;
    ui.head.textContent = "Set-up: " + C.threads + " threads, " + pick(ORDERS, C.order).label + ", row lock " + C.lock +
      ", primary " + pick(FAIL, C.fail).label + ", standby asks the primary: " + C.ask + ".";
    clear(ui.body);
    rowFor(ui, "primary", N.P, S);
    rowFor(ui, "standby", N.S, S);
    var pair = has(S, "pair");
    var emails = seen(S).filter(function (e) { return e.kind === "email"; }).length;
    var slips = seen(S).filter(function (e) { return e.kind === "slip"; }).length;
    S.stat.time(hms(t));
    S.stat.porder(pair ? pairText(N.P) : "none yet");
    S.stat.sorder(pair ? pairText(N.S) : "none yet");
    S.stat.pwin(pair ? N.P.win : "none yet");
    S.stat.swin(pair ? N.S.win : "none yet");
    S.stat.agree(pair ? (N.P.win === N.S.win ? "yes" : "no") : "not yet");
    S.stat.emails(emails);
    S.stat.slips(slips);
    S.stat.out(emails ? hms(N.out) : "not yet");
    S.stat.rate(num(rate(C)));
    S.stat.wait(waitText(C));
    S.stat.nums(nums(C));
    S.stat.journal(journal(C));
    S.stat.replay(replay(C));
    S.stat.answer(C.ask === "off" ? "not asked" : C.fail === "off" ? "not asked: no takeover" : has(S, "noanswer") ? "no answer: power off since 03:00:04" : "not asked yet");
    ui.sum.textContent = "At " + hms(t) + ": " + emails + (emails === 1 ? " 'you won' email" : " 'you won' emails") + " and " + slips + (slips === 1 ? " slip" : " slips") + " for lot 77.";
  }

  function change(api, what) {
    var S = api.state;
    S.k = 0;
    S.N = night(S.C, S.D);
    api.log(what + " Set back to 02:59:50.", "");
    if (S.C.order === "seq" && S.C.lock !== "on" && S.C.threads !== "1") api.log("the sequencer's design applies bids with one thread, so the threads setting does not apply.", "");
    draw(api);
  }

  function stepOnce(api) {
    var S = api.state;
    var e = S.N.ev[S.k];
    S.k += 1;
    api.log(e.text, e.tone);
  }
  function step(api) {
    if (api.state.k >= api.state.N.ev.length) { api.log("The close has already played. Change a setting or reset to play it again.", ""); return; }
    stepOnce(api);
    draw(api);
  }
  function play(api) {
    if (api.state.k >= api.state.N.ev.length) { api.log("The close has already played. Change a setting or reset to play it again.", ""); return; }
    while (api.state.k < api.state.N.ev.length) stepOnce(api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e15", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      // The thread race's four draws, taken once: primary (kwaku's, haizea's), then standby.
      S.D = { p: [api.rand(), api.rand()], s: [api.rand(), api.rand()] };
      S.C = { threads: "4", order: "race", lock: "off", fail: "on", ask: "off" };
      S.k = 0;
      S.N = night(S.C, S.D);
      S.ui = buildWidget(api);

      function sel(id, label, opts, key) {
        api.control.select(id, label, opts, S.C[key], function (v) {
          var o = pick(opts, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("threads", "threads in each engine", THREADS, "threads");
      sel("order", "how equal bids are ordered", ORDERS, "order");
      sel("lock", "row lock in the database", ROWLOCK, "lock");
      sel("fail", "primary's power supply", FAIL, "fail");
      sel("ask", "on takeover, the standby asks the primary", ASK, "ask");
      api.control.button("step", "Next event", function () { step(api); });
      api.control.button("run", "Play to the end", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        porder: api.stat("porder", "primary applied", ""),
        sorder: api.stat("sorder", "standby applied", ""),
        pwin: api.stat("pwin", "primary's winner", ""),
        swin: api.stat("swin", "standby's winner", ""),
        agree: api.stat("agree", "engines agree", "warn"),
        emails: api.stat("emails", "'you won' emails sent", "bad"),
        slips: api.stat("slips", "slips printed", "bad"),
        out: api.stat("out", "first result out", ""),
        rate: api.stat("rate", "bids a second one engine can apply", "ok"),
        wait: api.stat("wait", "queue wait", "warn"),
        nums: api.stat("nums", "bid numbers of the £450 pair", ""),
        journal: api.stat("journal", "journal", ""),
        replay: api.stat("replay", "standby replay", ""),
        answer: api.stat("answer", "answer from the primary", "")
      };

      api.info("<strong>How to read it.</strong> The table shows lot 77's bids in the order each engine applied them, and its highest bid so far. Two bids of £450 arrive 0.3 ms apart; the one applied first wins. Step through the close and watch the emails and slips.");
      api.log("Saturday 7 November 2026, 02:59:50, as run: 4 threads in each engine, thread race, no row lock. Lot 77 closes at 03:00:00.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { threads: "4", order: "race", lock: "off", fail: "on", ask: "off" };
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }

      // 1. Opening state: 02:59:50, before the first bid; nothing sent, 4 threads at 20,000 bids a second.
      t.expect(t.stat("time") === "02:59:50" && t.stat("emails") === 0 && t.stat("slips") === 0 && t.stat("pwin") === "none yet" &&
        t.stat("rate") === "20,000" && t.stat("nums") === "none" && has("02:59:50, as run"),
        "Opens at 02:59:50: no bids applied, 0 emails, 0 slips, 20,000 bids a second");

      // 2. Through the equal bids: the primary applies kwaku first, the standby haizea first.
      begin();
      for (var i = 0; i < 6; i++) t.click("step");
      t.expect(t.stat("pwin") === "fretwire_kwaku" && t.stat("swin") === "capo_haizea" && t.stat("agree") === "no" &&
        has("primary applied fretwire_kwaku £450 first, then capo_haizea £450 (equal, refused). standby applied capo_haizea £450 first, then fretwire_kwaku £450 (equal, refused)."),
        "Seeded thread race: the primary applies kwaku first, the standby haizea first");

      // 3. Play as run: two emails, two slips after the takeover.
      begin();
      t.click("run");
      t.expect(t.stat("emails") === 2 && t.stat("slips") === 2 && t.stat("out") === "03:00:00" &&
        has("03:00:00 the primary sends the result: fretwire_kwaku.") && has("03:00:01 collection slip prints at the packing bench: lot 77, £450, fretwire_kwaku.") &&
        has("03:00:06 the standby, now primary, sends the result: capo_haizea.") && has("03:00:07 collection slip prints at the packing bench: lot 77, £450, capo_haizea."),
        "As run: emails at 03:00:00 and 03:00:06, slips at 03:00:01 and 03:00:07: two winners");

      // 4. No power failure: one email, but the engines still disagree inside.
      as({ fail: "off" });
      t.click("run");
      t.expect(t.stat("emails") === 1 && t.stat("slips") === 1 && t.stat("agree") === "no",
        "Primary keeps running: 1 email, 1 slip, but the standby still holds a different winner");

      // 5. Eight threads: the same two winners, and fewer bids a second.
      as({ threads: "8" });
      t.click("run");
      t.expect(t.stat("emails") === 2 && t.stat("swin") === "capo_haizea" && t.stat("rate") === "12,500" && t.stat("wait") === "up to 4 ms",
        "8 threads: still 2 winners, 12,500 bids a second");

      // 6. One thread, no sequencer: the same order by luck, but nothing to replay.
      as({ threads: "1" });
      t.click("run");
      t.expect(t.stat("emails") === 1 && t.stat("agree") === "yes" && t.stat("rate") === "50,000" && t.stat("replay") === "not possible: nothing recorded",
        "1 thread: one winner tonight, but no journal and no replay");

      // 7. Arrival stamps: a tie to the microsecond, broken by the threads: two winners.
      begin();
      as({ order: "stamp" });
      t.click("run");
      t.expect(has("stamps tie at 02:59:58.412700: door 2's clock runs 0.3 ms behind door 1's; the threads break the tie") && t.stat("emails") === 2,
        "Arrival stamps: both stamped 02:59:58.412700, a tie, and 2 winners");

      // 8. Row lock: one order and one winner, but a 10-second queue at the close.
      as({ lock: "on" });
      t.click("run");
      t.expect(t.stat("emails") === 1 && t.stat("slips") === 1 && t.stat("agree") === "yes" && t.stat("out") === "03:00:10" &&
        t.stat("wait") === "10.0 s at the close" && t.stat("rate") === 200,
        "Row lock: one winner, but 200 bids a second and the result 10.0 s after the close");

      // 9. Sequencer: one numbered order, the standby's replay agrees, the repeat is dropped.
      begin();
      as({ order: "seq" });
      t.click("run");
      t.expect(t.stat("nums") === "123,369 and 123,370" && t.stat("agree") === "yes" && t.stat("emails") === 1 && t.stat("slips") === 1 &&
        t.stat("rate") === "50,000" && t.stat("wait") === "up to 10 ms" && t.stat("replay") === "replays the journal" &&
        has("03:00:06 the standby, now primary, sends the result again: fretwire_kwaku. Same winner, so the repeat is dropped"),
        "Sequencer: bids 123,369 and 123,370, one winner, 1 email, 50,000 bids a second");

      // 10. The standby asks the primary: no answer after 03:00:04, then its own result.
      begin();
      as({ ask: "on" });
      t.click("run");
      t.expect(t.stat("answer") === "no answer: power off since 03:00:04" && t.stat("emails") === 2 &&
        has("03:00:08 the standby, now primary, sends the result: capo_haizea."),
        "Asking the primary: no answer, and capo_haizea's email at 03:00:08: two winners");
    }
  });
})();
