/* sims/s8e09-v1.0.0.js  (published as sims/s8e09.js)
   Case s8e09 "Two-Phase": a commit lab for a house-sale chain on completion day, Friday 5 March 2027.
   Three linked sales: the Uttleys buy the Gathercoles' house, the Gathercoles buy the Tunnicliffes',
   the Tunnicliffes buy a new cottage from a builder. The lead solicitor's completion system (the
   coordinator) asks each buyer's bank in turn "ready?"; a ready bank puts a hold on the money and
   promises. Then the system writes its decision (commit or abort) in its log and tells everyone.
   That night the disk was full at 16:59:00 (a debug setting left on since Monday 1 March), the
   system retried for 10 seconds, crashed at 16:59:10 before any decision, restarted at 16:59:40,
   found no decision and waited for a person. At 21:00 all three holds were still on.
   The learner sets the crash, the Tunnicliffes' bank's answer, where the decision is stored, the
   banks' timeout rule, what a restart does, and saga mode, then plays 16:58:00 to 21:00:00.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls crash moment, the Tunnicliffes' bank's answer,
     decision stored on (one server, three by majority), bank timeout rule (wait, go ahead after an
     hour), after a restart (read the log, cancel and run again), saga mode; Play; Reset. Stats:
     each bank's state, the decision, where it is stored, chain finished, holds still on at 21:00,
     longest money held, sales completed, families with no house or two at 21:00, longest such
     spell, payments made twice, reruns, the night. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e09-v1.0.0.json).
   All of it is given data stated in sim.lede; each result is checked by the selfTest.
   - Times are seconds after 16:58:00. The system asks each bank in turn; the banks answer at
     4, 31 and 58 (16:58:04, 16:58:31, 16:58:58). The decision is due 2 seconds after the last
     answer: 60 (16:59:00). A failed write is retried for 10 seconds (crash at 70, 16:59:10).
     A restart takes 30 seconds (16:59:40). With three servers, a surviving server takes over
     after 5 seconds of silence (75, 16:59:15). The timeout rule waits 3600 seconds (an hour).
     The night ends at 21:00:00 = 14520 seconds.
   - As built: holds from 4, 31, 58 to 14520: 14516 s = 4:01:56 (Uttleys), 4:01:29, 4:01:02.
   - Three servers: takeover at 75, commit, all pay: longest hold 75 - 4 = 71 s = 0:01:11.
   - Go ahead: banks pay at 3604, 3631, 3658 (17:58:04, 17:58:31, 17:58:58): longest hold 1:00:00.
     With the Tunnicliffes' bank saying no, two sales complete; the Tunnicliffes own no house
     from 3631 to 14520: 10889 s = 3:01:29.
   - Cancel and run again with the full disk: each round is 30 + 58 + 2 + 10 = 100 s, so restarts
     at 100, 200, ..., 14500: 145 reruns. The Uttleys' money is held 96 s in the first round and in
     each of the next 144, then 16 s (14504 to 14520): 145 x 96 + 16 = 13936 s = 3:52:16.
   - Crash just after the decision (60), only the Uttleys' bank told and paid: restart at 90 reads
     commit, done 16:59:30, longest hold 90 - 31 = 59 s. Cancel and run again instead: new holds
     at 94, 121, 148, commit at 150 (17:00:30), the Uttleys pay a second time.
   - Saga: sales complete at 4, 31, 58; the Gathercoles own no house 4 to 31, the Tunnicliffes 31
     to 58 (27 s each). With the Tunnicliffes' bank saying no and the full disk, the refunds can't
     be written: the Tunnicliffes own no house from 31 to 14520 = 14489 s = 4:01:29.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var T0 = 16 * 3600 + 58 * 60;   // second 0 is 16:58:00
  var READY = [4, 31, 58];        // each bank's answer, seconds after the round starts
  var GAP = 2;                    // decision due 2 s after the last answer
  var RETRY = 10;                 // a failed write is retried for 10 s, then the program stops
  var RESTART = 30;               // one server: back after 30 s
  var TAKEOVER = 5;               // three servers: a survivor takes over after 5 s of silence
  var TIMEOUT = 3600;             // the go-ahead rule: an hour
  var END = 14520;                // 21:00:00
  var BANKS = ["the Uttleys' bank", "the Gathercoles' bank", "the Tunnicliffes' bank"];
  var FAMILY = ["Uttleys", "Gathercoles", "Tunnicliffes"];

  var CRASHES = [
    { value: "between", label: "16:59:10: all three ready, no decision yet (as that night, disk full)" },
    { value: "none", label: "no crash: the debug setting was off" },
    { value: "before", label: "16:58:00: before it asks anyone" },
    { value: "after", label: "16:59:00: just after the decision is written, only the Uttleys' bank told" }
  ];
  var ANSWERS = [
    { value: "ready", label: "ready at 16:58:58 (as that night)" },
    { value: "no", label: "no at 16:58:58: the mortgage money hasn't arrived" }
  ];
  var STORES = [
    { value: "one", label: "one server (as built)" },
    { value: "three", label: "three servers: a decision counts once 2 of 3 store it" }
  ];
  var PARTIES = [
    { value: "wait", label: "wait for the decision (as built)" },
    { value: "go", label: "go ahead and pay after an hour with no decision" }
  ];
  var RESTARTS = [
    { value: "log", label: "read the log; no decision means wait for a person (as built)" },
    { value: "rerun", label: "cancel the whole chain and run all three sales again" }
  ];
  var SAGAS = [
    { value: "off", label: "off: two-phase commit (as built)" },
    { value: "on", label: "on: complete each sale in turn, refund if a later one fails" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t) {
    var s = (T0 + t) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function dur(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 3600) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure: the display and self-tests read it) ---------- */

  function night(C) {
    var r = {
      lines: [], banks: [], decision: null, where: "not written", doneAt: null, waiting: false,
      held: 0, longest: 0, sales: 0, odd: 0, spell: 0, twice: 0, reruns: 0, looping: false, how: ""
    };
    var B = [0, 1, 2].map(function (i) {
      return { state: "not asked", from: null, total: 0, paid: 0, said: null };
    });
    var sale = [];                // {t, i, d}: d = +1 completed, -1 refunded
    var done = [false, false, false];
    var three = C.store === "three";
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    function hold(i, t) { B[i].from = t; B[i].said = "ready"; B[i].state = "ready, money held"; }
    function letGo(i, t) {
      if (B[i].from === null) return false;
      B[i].total += t - B[i].from; B[i].from = null; B[i].state = "let go"; return true;
    }
    function pay(i, t) {
      if (B[i].from !== null) { B[i].total += t - B[i].from; B[i].from = null; }
      B[i].paid += 1;
      if (B[i].paid > 1) { r.twice += 1; B[i].state = "paid twice"; } else B[i].state = "paid";
      if (!done[i]) { done[i] = true; sale.push({ t: t, i: i, d: 1 }); }
    }
    function refund(i, t) {
      done[i] = false; sale.push({ t: t, i: i, d: -1 }); B[i].state = "paid, then refunded";
    }

    if (C.saga === "on") sagaNight(); else commitNight();

    function commitNight() {
      var diskFull = C.crash === "between" && !three;   // the runner after a restart is server 1
      var start = 0;
      var told = [false, false, false];
      function ask(s, quiet) {
        var ok = true;
        for (var i = 0; i < 3; i++) {
          var t = s + READY[i];
          if (t > END) return null;
          if (i === 2 && C.b3 === "no") {
            B[i].said = "no"; B[i].state = "said no"; ok = false;
            if (!quiet) line(t, BANKS[i] + ": no. Nothing held.", "warn");
          } else {
            hold(i, t);
            if (!quiet) line(t, BANKS[i] + ": ready, money held.", "");
          }
        }
        return ok;
      }
      function tell(which, t) {
        var any = false;
        which.forEach(function (i) {
          if (told[i]) return;
          told[i] = true; any = true;
          if (r.decision === "commit") pay(i, t); else letGo(i, t);
        });
        return any;
      }
      function finish(t) { r.doneAt = t; }

      // Round 0: the night as asked.
      if (C.crash === "before") {
        line(0, "The completion system crashes before it asks anyone.", "bad");
      } else {
        line(0, "The completion system asks each bank in turn: ready?", "");
        var ok = ask(0, false);
        if (C.crash === "between") {
          line(60, "Disk full: it can't write. It retries for " + RETRY + " seconds.", "bad");
          line(70, "The completion system crashes. No decision written.", "bad");
        } else {
          r.decision = ok ? "commit" : "abort";
          r.where = three ? "2 of 3 servers" : "one server";
          if (C.crash === "after") {
            tell([0], 60);
            line(60, "Decision " + r.decision + " written on " + r.where + ". " + cap(BANKS[0]) + " is told and " + (ok ? "pays" : "lets go") + ". Then the system crashes.", "bad");
          } else {
            tell([0, 1, 2], 60);
            finish(60);
            line(60, "Decision " + r.decision + " written on " + r.where + ". Everyone is told: " + (ok ? "all three banks pay." : "every hold is let go."), "ok");
          }
        }
      }

      // Recovery and, for the rerun rule, every round after it.
      var crashAt = C.crash === "before" ? 0 : (C.crash === "between" ? 70 : 60);
      if (C.crash !== "none") {
        var back = crashAt + (three ? TAKEOVER : RESTART);
        while (back <= END) {
          var who = three ? "server 2 takes over after " + TAKEOVER + " seconds of silence" : "the completion system restarts";
          if (C.restart === "rerun") {
            r.reruns += 1;
            var gone = 0;
            var already = [];
            for (var i = 0; i < 3; i++) {
              if (letGo(i, back)) gone += 1;
              if (B[i].paid > 0) already.push(i);
              told[i] = false;
            }
            r.decision = null; r.where = "not written";
            if (r.reruns <= 1) {
              line(back, cap(who) + ". It ignores its log, cancels the chain (" + (gone ? gone + " holds let go" : "nothing held") +
                (already.length ? "; " + BANKS[already[0]] + " already paid and can't be cancelled" : "") + ") and runs all three again.", "warn");
            }
            start = back;
            var ok2 = ask(start, r.reruns > 1);
            if (ok2 === null) break;
            if (diskFull) {
              if (r.reruns <= 1) line(start + GAP + READY[2] + RETRY, "Disk still full: it crashes again before any decision.", "bad");
              back = start + READY[2] + GAP + RETRY + RESTART;
              continue;
            }
            r.decision = ok2 ? "commit" : "abort";
            r.where = three ? "2 of 3 servers" : "one server";
            tell([0, 1, 2], start + READY[2] + GAP);
            finish(start + READY[2] + GAP);
            line(start + READY[2] + GAP, "Decision " + r.decision + " written. Everyone is told" + (r.twice ? ": " + BANKS[0] + " pays a second time." : "."), r.twice ? "bad" : "ok");
            break;
          }
          // Read the record.
          if (r.decision) {
            tell([0, 1, 2], back);
            finish(back);
            line(back, cap(who) + ", reads decision " + r.decision + " and tells the other banks.", "ok");
          } else if (three) {
            var allReady = B.every(function (b) { return b.said === "ready"; });
            r.decision = allReady ? "commit" : "abort";
            r.where = "2 of 3 servers";
            tell([0, 1, 2], back);
            finish(back);
            line(back, cap(who) + ". " + (allReady ? "All three readies are stored on a majority: it writes commit on 2 of 3 and tells everyone." :
              "Not every bank said ready: it writes abort on 2 of 3 and every hold is let go."), "ok");
          } else {
            r.waiting = true;
            line(back, "The completion system restarts. No decision in its log: it waits for a person.", "bad");
          }
          break;
        }
        if (r.reruns > 1) {
          line(END, "The same again every " + (READY[2] + GAP + RETRY + RESTART) + " seconds: " + r.reruns + " reruns by 21:00, money held, let go, held again.", "bad");
          r.looping = true;
        }
      }

      // The timeout rule: a bank still holding after an hour goes ahead and pays.
      if (C.party === "go") {
        for (var k = 0; k < 3; k++) {
          if (B[k].from !== null && B[k].from + TIMEOUT <= END) {
            var at = B[k].from + TIMEOUT;
            line(at, BANKS[k] + ": no decision for an hour. It goes ahead and pays.", "warn");
            pay(k, at);
          }
        }
      }
    }

    function sagaNight() {
      var full = C.crash === "between" && !three;
      var start = 0;
      r.where = three ? "saga log, 2 of 3 servers" : "saga log, one server";
      if (C.crash === "before") {
        start = three ? TAKEOVER : RESTART;
        line(0, "The saga runner crashes before the first sale. Back at " + clock(start) + ", it carries on from its log.", "warn");
      }
      var failed = false;
      for (var i = 0; i < 3; i++) {
        var t = start + READY[i];
        if (i === 2 && C.b3 === "no") {
          B[i].said = "no"; B[i].state = "said no"; failed = true;
          line(t, BANKS[i] + ": no. The cottage sale fails; the two sales before it must be refunded.", "bad");
        } else {
          pay(i, t);
          line(t, BANKS[i] + " pays. That sale is complete on its own.", "");
        }
      }
      var next = start + READY[2] + GAP;
      var at = next;
      if (C.crash === "between") {
        line(next, "Disk full: the saga runner can't write its next step. It crashes at " + clock(next + RETRY) + ".", "bad");
        at = next + RETRY + (three ? TAKEOVER : RESTART);
        if (full) {
          if (failed) {
            r.waiting = true;
            line(at, "Back with the disk still full: it can't write the refunds. It waits for a person.", "bad");
            return;
          }
          line(at, "Back: nothing was left to do.", "ok");
          r.doneAt = start + READY[2];
          return;
        }
      } else if (C.crash === "after") {
        line(next, "The saga runner writes its next step, then crashes.", "bad");
        at = next + (three ? TAKEOVER : RESTART);
      }
      if (failed) {
        refund(1, at); refund(0, at);
        line(at, "Refunds, in steps: money back to the Gathercoles and the Uttleys, keys back to me, each house back to its seller.", "warn");
        r.doneAt = at;
      } else {
        r.doneAt = start + READY[2];
      }
    }

    // Holds and money held.
    B.forEach(function (b) {
      var total = b.total + (b.from !== null ? END - b.from : 0);
      if (b.from !== null) r.held += 1;
      r.longest = Math.max(r.longest, total);
    });

    // Who owns what: the Gathercoles own 1 - sale1 + sale2, the Tunnicliffes 1 - sale2 + sale3.
    sale.sort(function (a, b) { return a.t - b.t; });
    var have = [0, 0, 0];
    var since = [null, null];
    function owns(f) { return f === 0 ? 1 - have[0] + have[1] : 1 - have[1] + have[2]; }
    var idx = 0;
    while (idx < sale.length) {
      var tt = sale[idx].t;
      while (idx < sale.length && sale[idx].t === tt) { have[sale[idx].i] += sale[idx].d; idx++; }
      for (var f = 0; f < 2; f++) {
        var n = owns(f);
        if (n !== 1 && since[f] === null) since[f] = tt;
        if (n === 1 && since[f] !== null) { r.spell = Math.max(r.spell, tt - since[f]); since[f] = null; }
      }
    }
    for (var g = 0; g < 2; g++) {
      if (since[g] !== null) { r.spell = Math.max(r.spell, END - since[g]); r.odd += 1; }
    }
    r.sales = have[0] + have[1] + have[2];
    r.banks = B.map(function (b) { return b.state; });

    var dec = C.saga === "on" ? "saga: no shared decision" : (r.decision ? r.decision :
      (r.looping ? "none: it crashes again each time" : (r.waiting ? "none: waiting for a person" : "none")));
    r.dec = dec;
    r.done = r.doneAt === null ? "not finished" : clock(r.doneAt);
    r.how = r.sales + " of 3 sales complete, " + r.held + " holds still on at 21:00, money held up to " + dur(r.longest) +
      (r.odd ? ", " + r.odd + " family with no house" : "") + (r.twice ? ", " + r.twice + " payment made twice" : "") +
      (r.reruns > 1 ? ", " + r.reruns + " reruns" : "");
    return r;
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
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["bank", "buys", "state at 21:00"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
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

  var BUYS = ["the Gathercoles' house", "the Tunnicliffes' house", "the builder's cottage"];
  var KEYS = ["b1", "b2", "b3", "decision", "where", "done", "held", "hours", "sales", "odd", "spell", "twice", "reruns", "outcome"];

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Crash: " + pick(CRASHES, C.crash).label + ". The Tunnicliffes' bank: " + pick(ANSWERS, C.b3).label +
      ". Decision stored on: " + pick(STORES, C.store).label + ". Banks: " + pick(PARTIES, C.party).label +
      ". After a restart: " + pick(RESTARTS, C.restart).label + ". Saga: " + pick(SAGAS, C.saga).label + ".";
    clear(ui.body);
    if (!S.ran) {
      ui.sum.textContent = "Not played yet: it is 16:58:00 and nobody has been asked.";
      KEYS.forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var N = night(C);
    for (var i = 0; i < 3; i++) {
      var tr = ui.el("tr");
      [BANKS[i], BUYS[i], N.banks[i]].forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.body.appendChild(tr);
    }
    ui.sum.textContent = "The night: " + N.how + ".";
    S.stat.b1(N.banks[0]);
    S.stat.b2(N.banks[1]);
    S.stat.b3(N.banks[2]);
    S.stat.decision(N.dec);
    S.stat.where(N.where);
    S.stat.done(N.done);
    S.stat.held(String(N.held));
    S.stat.hours(dur(N.longest));
    S.stat.sales(String(N.sales));
    S.stat.odd(String(N.odd));
    S.stat.spell(dur(N.spell));
    S.stat.twice(String(N.twice));
    S.stat.reruns(String(N.reruns));
    S.stat.outcome(N.how);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 16:58:00.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("16:58:00 to 21:00:00 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    N.lines.forEach(function (l) { api.log(clock(l.t) + " " + l.text, l.tone); });
    api.log("21:00:00 " + N.how + ".", N.held || N.odd || N.twice ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { crash: "between", b3: "ready", store: "one", party: "wait", restart: "log", saga: "off" };
      S.ran = false;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("crash", "When the completion system crashes", CRASHES, "crash");
      sel("b3", "The Tunnicliffes' bank answers", ANSWERS, "b3");
      sel("store", "Decision stored on", STORES, "store");
      sel("party", "A bank still holding money", PARTIES, "party");
      sel("restart", "After a restart", RESTARTS, "restart");
      sel("saga", "Saga mode", SAGAS, "saga");
      api.control.button("run", "Play 16:58:00 to 21:00:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        b1: api.stat("b1", "the Uttleys' bank", ""),
        b2: api.stat("b2", "the Gathercoles' bank", ""),
        b3: api.stat("b3", "the Tunnicliffes' bank", ""),
        decision: api.stat("decision", "the decision", ""),
        where: api.stat("where", "where it is stored", ""),
        done: api.stat("done", "chain finished at", "ok"),
        held: api.stat("held", "holds still on at 21:00", "warn"),
        hours: api.stat("hours", "longest money held (h:mm:ss)", "warn"),
        sales: api.stat("sales", "sales complete at 21:00", "ok"),
        odd: api.stat("odd", "families with no house or two at 21:00", "bad"),
        spell: api.stat("spell", "longest spell a family had no house or two (h:mm:ss)", "bad"),
        twice: api.stat("twice", "payments made twice", "bad"),
        reruns: api.stat("reruns", "times the chain was cancelled and run again", ""),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one buyer's bank, a party to the chain. A bank that says ready puts a hold on the money and has promised: it pays only when told commit and lets go only when told abort. The stats show the decision, where it is kept, how long money stays held, and whether any family is left with no house or two.");

      api.log("Friday 5 March 2027, 16:58:00, as built: one server, banks wait, a restart reads the log. The chain is about to start.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: 16:58:00, nobody asked.
      t.expect(t.stat("decision") === "not run yet" && t.stat("held") === "not run yet" &&
        has("The chain is about to start."),
        "Opens at 16:58:00 before anyone is asked");

      // 2. As built: crash at 16:59:10, no decision, three holds on at 21:00.
      t.click("run");
      t.expect(t.stat("b1") === "ready, money held" && t.stat("b3") === "ready, money held" &&
        t.stat("decision") === "none: waiting for a person" && t.stat("where") === "not written" &&
        t.stat("held") === 3 && t.stat("hours") === "4:01:56" && t.stat("sales") === 0 && t.stat("odd") === 0 &&
        t.stat("done") === "not finished" &&
        has("16:59:10 The completion system crashes. No decision written.") &&
        has("16:59:40 The completion system restarts. No decision in its log: it waits for a person."),
        "As built: three holds on at 21:00, the Uttleys' money held 4:01:56, no sale complete");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("has already played."), "A second play is refused");

      // 4. Option 0: three servers, a majority. A survivor finishes at 16:59:15.
      t.set("store", "three");
      t.click("run");
      t.expect(t.stat("decision") === "commit" && t.stat("where") === "2 of 3 servers" && t.stat("done") === "16:59:15" &&
        t.stat("hours") === "0:01:11" && t.stat("sales") === 3 && t.stat("held") === 0 && t.stat("spell") === "0:00:00",
        "Three servers: server 2 takes over at 16:59:15 and all three sales complete");

      // 5. Three servers with the Tunnicliffes' bank saying no: abort in seconds, every hold let go.
      t.set("b3", "no");
      t.click("run");
      t.expect(t.stat("decision") === "abort" && t.stat("done") === "16:59:15" && t.stat("sales") === 0 &&
        t.stat("held") === 0 && t.stat("b1") === "let go" && t.stat("b3") === "said no",
        "Three servers and a no: abort at 16:59:15, nobody stuck");
      t.set("store", "one");

      // 6. Option 2 with a no: two sales complete, one doesn't. The Tunnicliffes own no house.
      t.set("party", "go");
      t.click("run");
      t.expect(t.stat("sales") === 2 && t.stat("odd") === 1 && t.stat("spell") === "3:01:29" && t.stat("b3") === "said no" &&
        has("17:58:31 the Gathercoles' bank: no decision for an hour. It goes ahead and pays."),
        "Go ahead with a no: two sales complete, the Tunnicliffes own no house for 3:01:29");

      // 7. Option 2 as that night: all three go ahead an hour later.
      t.set("b3", "ready");
      t.click("run");
      t.expect(t.stat("sales") === 3 && t.stat("hours") === "1:00:00" && t.stat("spell") === "0:00:27" &&
        has("17:58:58 the Tunnicliffes' bank: no decision for an hour. It goes ahead and pays."),
        "Go ahead as that night: all three pay at 17:58, money held an hour");
      t.set("party", "wait");

      // 8. Option 3: cancel and run again with the full disk: 145 reruns, money held 3:52:16.
      t.set("restart", "rerun");
      t.click("run");
      t.expect(t.stat("reruns") === 145 && t.stat("hours") === "3:52:16" && t.stat("sales") === 0 && t.stat("held") === 1 &&
        has("145 reruns by 21:00"),
        "Cancel and run again: 145 reruns by 21:00, the Uttleys' money held 3:52:16");

      // 9. Option 3 after a crash just after commit: the Uttleys pay twice.
      t.set("crash", "after");
      t.click("run");
      t.expect(t.stat("twice") === 1 && t.stat("b1") === "paid twice" && t.stat("done") === "17:00:30" && t.stat("sales") === 3,
        "Rerun after commit: the Uttleys' bank pays a second time at 17:00:30");

      // 10. As built after a crash just after commit: the restart reads commit and finishes.
      t.set("restart", "log");
      t.click("run");
      t.expect(t.stat("done") === "16:59:30" && t.stat("hours") === "0:00:59" && t.stat("twice") === 0 && t.stat("sales") === 3,
        "Crash after the decision: the restart reads commit at 16:59:30");

      // 11. A crash before anyone is asked blocks nobody.
      t.set("crash", "before");
      t.click("run");
      var beforeHeld = t.stat("held");
      var beforeDec = t.stat("decision");
      t.set("crash", "none");
      t.click("run");
      t.expect(beforeHeld === 0 && beforeDec === "none: waiting for a person" && t.stat("done") === "16:59:00" &&
        t.stat("hours") === "0:00:56" && t.stat("sales") === 3,
        "Crash before asking holds nothing; no crash completes at 16:59:00");
      t.set("crash", "between");

      // 12. Option 1: saga. Nothing held, but families spend time with no house; a no and a full disk leave one for 4:01:29.
      t.set("saga", "on");
      t.click("run");
      var sagaSpell = t.stat("spell");
      var sagaHeld = t.stat("held");
      var sagaSales = t.stat("sales");
      t.set("b3", "no");
      t.click("run");
      t.expect(sagaSpell === "0:00:27" && sagaHeld === 0 && sagaSales === 3 &&
        t.stat("sales") === 2 && t.stat("odd") === 1 && t.stat("spell") === "4:01:29" && t.stat("held") === 0,
        "Saga: no holds, 27 s with no house; with a no and the full disk the Tunnicliffes have none for 4:01:29");
    }
  });
})();
