/* sims/w05-v1.0.0.js  (published as sims/w05.js)
   Workshop case w05 "Two Tickets for Seat F7": a workbench for the summer cinema's seat booking
   program at Thistledown Park, finished by Odgerel from Winifrith Torvaine's work order. The last
   four free deckchairs of a sold-out screening, five checkouts between 20:58 and 21:07, replayed
   one step at a time.
   Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the design (as built, holds in each server's memory; sticky
     sessions; a second check of the database before charging the card; one booking at a time,
     in a line; holds as database rows taken only if the seat is free, with an end time and the
     checkout's key), servers (1 or 2), Mr Vowles's timing (as on the night, or a second after
     Ms Gatacre's tap), a Pay sent twice (none, or Ms Gatacre's sent again at 21:02:58), Step,
     Play the rush, Reset. Shows each seat's tickets and each checkout's result.
     Stats: tickets written, seats sold twice, extra tickets for the same checkout, tickets for F7,
     what Mr Vowles got, what checkout 3322 got, the longest wait in line, seats with no ticket.
     selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Saturday 25 July 2026, the 21:30 screening, 200 deckchairs. At 20:58:00, 196 are sold and
     4 have no ticket: C14, F7, H2, J19. Nobody holds any of them.
   - A hold lasts 5 minutes (300 s). A seat is free if it has no ticket and no hold that is still
     running, as the place that answers can see it.
   - Each checkout: opens the seat map, taps the first seat it wants that the map shows free (none
     free: it leaves, sold out), presses Pay, and the card company answers after a set time; then
     the ticket is written. A refused tap tries the next seat it wants 6 s later.
   - Which server answers each request is given data from the load balancer's log (route: seat
     map, tap, Pay). Sticky sessions: every request goes where the checkout's first went. With one
     server, every request goes to server 1.
   - Designs:
       built   each server keeps holds in its own memory; a tap is refused only if that server's
               memory or the database's tickets say the seat is taken. Pay writes a ticket.
       sticky  as built, with sticky sessions.
       check   as built, and at Pay the server checks the database for a ticket on the seat and
               stops (no charge) if there is one.
       line    one checkout books at a time, from seat map to ticket; the others wait in a line in
               order of arrival. Each keeps its own durations once its turn starts.
       rows    a hold is a database row with the checkout's number and an end time, written only
               if the seat has no ticket and no running hold. The ticket is written once per
               checkout key.
   - A Pay sent twice: the card company charges once (the checkout number is its idempotency key)
     and answers the repeat in 1 s; the server then writes a ticket again, except in "rows" (one
     ticket per checkout key) and "check" (the seat already has a ticket, so it stops).

   Where every number comes from (conventions rule 14; the case is content/s4/w05-v1.0.0.json).
   Given data, checkouts (seat map, tap, Pay, card company's time, seats wanted, route):
     3318 Ms Gatacre 20:58:30, 20:58:41, 21:02:20, 31 s, F7, servers 1 1 1
     3319            20:59:02, 20:59:10, 21:00:30, 22 s, C14, servers 2 1 2
     3320 Mr Vowles  21:00:07, 21:00:12, 21:02:40, 29 s, F7 then J19, servers 2 2 2
     3321            21:01:15, 21:01:24, 21:03:30, 28 s, H2, servers 1 2 1
     3322            21:04:40, 21:04:51, 21:06:05, 25 s, J19, servers 2 1 2
     Mr Vowles's other timing: seat map 20:58:36, tap 20:58:42. The repeat Pay: 21:02:58, server 2.
   - As built, 2 servers: 3318 holds F7 on server 1 at 20:58:41 (until 21:03:41); 3320's seat map on
     server 2 at 21:00:07 shows F7 free, and server 2 holds F7 for 3320 at 21:00:12 (until
     21:05:12). Tickets: C14 21:00:52, F7 21:02:51 (3318), F7 21:03:09 (3320), 21:03:09 - 21:02:51 =
     18 s apart; H2 21:03:58; J19 21:04:51 hold, ticket 21:06:30 (3322). 5 tickets for 4 seats,
     F7 sold twice. Mr Vowles pressed Pay at 21:02:40, 11 s before 3318's ticket at 21:02:51.
   - Sticky: each checkout stays on its first server (3318 on 1, 3320 on 2): the same 5 tickets.
   - Check: 3320's check at 21:02:40 finds no ticket for F7 (it is written at 21:02:51): the same.
   - One server, or rows: 3320's map at 21:00:07 shows F7 and C14 taken, so 3320 takes J19 (ticket
     21:03:09); 3321 takes H2; 3322's map at 21:04:40 shows nothing free: sold out. 4 tickets.
   - Rows, Mr Vowles a second after: his tap on F7 at 20:58:42 is refused (3318's hold row from
     20:58:41); he taps J19 at 20:58:48. 4 tickets, nobody twice.
   - Line: 3318 20:58:30 to 21:02:51; 3319 waits 20:59:02 to 21:02:51 (3 min 49 s), done 21:04:41;
     3320 waits 21:00:07 to 21:04:41 (4 min 34 s), takes J19, done 21:07:43; 3321 waits 21:01:15
     to 21:07:43 (6 min 28 s), takes H2, done 21:10:26; 3322 waits 21:04:40 to 21:10:26
     (5 min 46 s), then sold out. Longest wait 6 min 28 s. 4 tickets.
   - Pay sent twice, as built: a second ticket for 3318 on F7 at 21:02:59: 6 tickets, 3 for F7,
     1 extra for the same checkout. Rows: none extra.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  function at(h, m, s) { return h * 3600 + m * 60 + s; }
  var OPEN = at(20, 58, 0);
  var HOLD = 300;
  var RETAP = 6;
  var SEATS = ["C14", "F7", "H2", "J19"];

  var CHECKOUTS = [
    { id: 3318, who: "Ms Gatacre", map: at(20, 58, 30), tap: at(20, 58, 41), pay: at(21, 2, 20), takes: 31, wants: ["F7"], route: [1, 1, 1] },
    { id: 3319, who: "", map: at(20, 59, 2), tap: at(20, 59, 10), pay: at(21, 0, 30), takes: 22, wants: ["C14"], route: [2, 1, 2] },
    { id: 3320, who: "Mr Vowles", map: at(21, 0, 7), tap: at(21, 0, 12), pay: at(21, 2, 40), takes: 29, wants: ["F7", "J19"], route: [2, 2, 2] },
    { id: 3321, who: "", map: at(21, 1, 15), tap: at(21, 1, 24), pay: at(21, 3, 30), takes: 28, wants: ["H2"], route: [1, 2, 1] },
    { id: 3322, who: "", map: at(21, 4, 40), tap: at(21, 4, 51), pay: at(21, 6, 5), takes: 25, wants: ["J19"], route: [2, 1, 2] }
  ];
  var EARLY = { map: at(20, 58, 36), tap: at(20, 58, 42) };
  var REPEAT = { t: at(21, 2, 58), server: 2, answer: 1 };

  var DESIGNS = [
    { value: "built", label: "as built: holds in each server's memory" },
    { value: "sticky", label: "sticky sessions: each customer stays on one server" },
    { value: "check", label: "check the database again before charging the card" },
    { value: "line", label: "one booking at a time per screening, the rest in a line" },
    { value: "rows", label: "holds as database rows, taken only if free, with an end time and key" }
  ];
  var SHORT = {
    built: "holds in each server's memory", sticky: "sticky sessions", check: "a second check before the card",
    line: "one booking at a time", rows: "holds as database rows"
  };
  var SERVERS = [{ value: 2, label: "2 servers (Saturday)" }, { value: 1, label: "1 server (June)" }];
  var TIMINGS = [
    { value: "night", label: "as on the night: seat map 21:00:07, tap 21:00:12" },
    { value: "early", label: "a second after Ms Gatacre: seat map 20:58:36, tap 20:58:42" }
  ];
  var REPEATS = [
    { value: "none", label: "none" },
    { value: "gatacre", label: "Ms Gatacre's Pay sent again at 21:02:58" }
  ];

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function minsec(s) { return Math.floor(s / 60) + " min " + (s % 60) + " s"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function name(c) { return "checkout " + c.id + (c.who ? " (" + c.who + ")" : ""); }

  /* ---------- the model: the rush as a list of steps ---------- */

  function people(C) {
    return CHECKOUTS.map(function (c) {
      var p = { id: c.id, who: c.who, map: c.map, tap: c.tap, pay: c.pay, takes: c.takes, wants: c.wants.slice(), route: c.route.slice() };
      if (c.id === 3320 && C.timing === "early") { p.map = EARLY.map; p.tap = EARLY.tap; }
      return p;
    });
  }

  function night(C) {
    var P = people(C);
    var tickets = [];
    var mem = { 1: {}, 2: {} };
    var rows = {};
    var steps = [];
    var ev = [];
    var seq = 0;
    var waits = {};

    function server(p, k) {
      if (C.servers === 1) return 1;
      if (C.design === "sticky") return p.route[0];
      return p.route[k];
    }
    function ticketOn(seat) { return tickets.filter(function (x) { return x.seat === seat; }); }
    function heldBy(seat, t, sv) {
      var h = C.design === "rows" ? rows[seat] : (C.design === "line" ? null : mem[sv][seat]);
      return h && h.until > t ? h : null;
    }
    function takenFor(p, seat, t, sv) {
      if (ticketOn(seat).length) return "it has a ticket";
      var h = heldBy(seat, t, sv);
      if (h && h.c !== p.id) {
        return C.design === "rows" ? "the database has a running hold on " + seat + " for checkout " + h.c :
          "server " + sv + "'s memory holds " + seat + " for checkout " + h.c;
      }
      return "";
    }
    function step(t, msg, tone, extra) {
      var s = { t: t, msg: hms(t) + " " + msg + ".", tone: tone || "" };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) s[k] = extra[k];
      steps.push(s);
    }
    function push(t, kind, p, x) { ev.push({ t: t, kind: kind, p: p, x: x, seq: seq++ }); }
    function where(p, k) { return C.design === "line" ? name(p) : "server " + server(p, k) + ", " + name(p); }

    function doMap(p, t) {
      var sv = server(p, 0);
      var free = SEATS.filter(function (s) { return !takenFor(p, s, t, sv); });
      var choice = null;
      for (var i = 0; i < p.wants.length && !choice; i++) if (free.indexOf(p.wants[i]) >= 0) choice = p.wants[i];
      var shows = free.length ? free.join(", ") + " free" : "nothing free";
      if (!choice) {
        p.result = "sold out";
        step(t, where(p, 0) + ": the seat map shows " + shows + "; sold out, nothing to book", "warn", { p: p.id, kind: "out" });
        return false;
      }
      p.tried = [];
      step(t, where(p, 0) + ": the seat map shows " + shows, "", { p: p.id, kind: "map" });
      return choice;
    }
    function doTap(p, t, seat) {
      var sv = server(p, 1);
      p.tried.push(seat);
      var why = C.design === "line" ? "" : takenFor(p, seat, t, sv);
      if (why) {
        step(t, where(p, 1) + ": hold " + seat + " refused, " + why, "warn", { p: p.id, kind: "refused" });
        var next = null;
        for (var i = 0; i < p.wants.length && !next; i++) if (p.tried.indexOf(p.wants[i]) < 0) next = p.wants[i];
        if (next) push(t + RETAP, "tap", p, next);
        else { p.result = "sold out"; step(t, name(p) + " leaves: no seat it wants is free", "warn", { p: p.id, kind: "out" }); }
        return;
      }
      p.seat = seat;
      var h = { c: p.id, until: t + HOLD };
      var place;
      if (C.design === "rows") { rows[seat] = h; place = "as a database row"; }
      else if (C.design === "line") { place = "while its turn lasts"; }
      else { mem[sv][seat] = h; place = "in server " + sv + "'s memory"; }
      step(t, where(p, 1) + ": hold " + seat + " " + place + ": ok" + (C.design === "line" ? "" : ", until " + hms(t + HOLD)), "", { p: p.id, kind: "hold" });
      push(p.payAt !== undefined ? p.payAt : p.pay, "pay", p);
    }
    function doPay(p, t, again) {
      var sv = again ? (C.servers === 1 ? 1 : (C.design === "sticky" ? p.route[0] : REPEAT.server)) : server(p, 2);
      var head = (C.design === "line" ? name(p) : "server " + sv + ", " + name(p)) + ": ";
      if (C.design === "check") {
        var have = ticketOn(p.seat);
        if (have.length) {
          step(t, head + (again ? "Pay sent again; " : "Pay pressed; ") + "the second check finds a ticket for " + p.seat +
            " (checkout " + have[0].c + "'s), so it stops", again ? "warn" : "ok", { p: p.id, kind: "stopped" });
          if (!again) p.result = "stopped at Pay";
          return;
        }
        step(t, head + "Pay pressed; the second check finds no ticket for " + p.seat + " yet, so the card company is asked", "", { p: p.id, kind: "press" });
      } else if (again) {
        step(t, head + "Pay sent again after the signal dropped; the card company sees the same key and returns its saved answer, charging once", "warn", { p: p.id, kind: "press" });
      } else {
        step(t, head + "Pay pressed; the card company is asked", "", { p: p.id, kind: "press" });
      }
      push(t + (again ? REPEAT.answer : p.takes), "paid", p, again ? "again" : "");
    }
    function doPaid(p, t, again) {
      var sv = again ? (C.servers === 1 ? 1 : (C.design === "sticky" ? p.route[0] : REPEAT.server)) : server(p, 2);
      var head = C.design === "line" ? name(p) + ": " : "server " + sv + ", " + name(p) + ": ";
      var mine = tickets.filter(function (x) { return x.c === p.id && x.seat === p.seat; });
      if (C.design === "rows" && mine.length) {
        step(t, head + "the card company says yes; checkout " + p.id + " already has its ticket for " + p.seat + ", so the same ticket is sent again", "ok", { p: p.id, kind: "same" });
        return;
      }
      var others = ticketOn(p.seat).filter(function (x) { return x.c !== p.id; });
      tickets.push({ seat: p.seat, c: p.id, t: t });
      if (!again) p.result = p.seat;
      var tail = mine.length ? ": a second ticket for the same checkout" :
        (others.length ? ": " + p.seat + " now has two tickets, checkout " + others[0].c + "'s and " + p.id + "'s" : "");
      step(t, head + "the card company says yes; ticket for " + p.seat + " written" + tail,
        mine.length || others.length ? "bad" : "ok", { p: p.id, kind: "ticket" });
    }

    if (C.design === "line") {
      // One booking at a time, in order of arrival; each keeps its own durations once it starts.
      var busy = false;
      var queue = [];
      P.forEach(function (p) { push(p.map, "arrive", p); });
      if (C.repeat === "gatacre") push(REPEAT.t, "again", P[0]);
      var startTurn = function (p, t) {
        busy = p;
        waits[p.id] = t - p.map;
        var shift = t - p.map;
        p.payAt = p.pay + shift;
        if (shift > 0) step(t, name(p) + " leaves the line after " + minsec(shift) + " and starts", "warn", { p: p.id, kind: "start" });
        var choice = doMap(p, t);
        if (choice) push(p.tap + shift, "tap", p, choice);
        else endTurn(t);
      };
      var endTurn = function (t) {
        busy = false;
        if (queue.length) startTurn(queue.shift(), t);
      };
      while (ev.length) {
        ev.sort(function (a, b) { return (a.t - b.t) || (a.seq - b.seq); });
        var e = ev.shift();
        if (e.kind === "arrive") {
          if (busy) {
            queue.push(e.p);
            step(e.t, name(e.p) + " joins the line behind " + (queue.length) + (queue.length === 1 ? " booking" : " bookings"), "warn", { p: e.p.id, kind: "join" });
          } else startTurn(e.p, e.t);
        } else if (e.kind === "tap") doTap(e.p, e.t, e.x);
        else if (e.kind === "pay") doPay(e.p, e.t, false);
        else if (e.kind === "again") doPay(e.p, e.t, true);
        else if (e.kind === "paid") {
          doPaid(e.p, e.t, e.x === "again");
          if (e.x !== "again") endTurn(e.t);
        }
      }
    } else {
      P.forEach(function (p) { push(p.map, "map", p, p.tap); });
      if (C.repeat === "gatacre") push(REPEAT.t, "again", P[0]);
      while (ev.length) {
        ev.sort(function (a, b) { return (a.t - b.t) || (a.seq - b.seq); });
        var f = ev.shift();
        if (f.kind === "map") { var ch = doMap(f.p, f.t); if (ch) push(f.x, "tap", f.p, ch); }
        else if (f.kind === "tap") doTap(f.p, f.t, f.x);
        else if (f.kind === "pay") doPay(f.p, f.t, false);
        else if (f.kind === "again") doPay(f.p, f.t, true);
        else if (f.kind === "paid") doPaid(f.p, f.t, f.x === "again");
      }
    }
    return { people: P, steps: steps, waits: waits };
  }

  // Totals after the first n steps, worked out again from the steps shown.
  function tally(N, n) {
    var r = { tickets: 0, double: 0, extra: 0, f7: 0, free: SEATS.length, vowles: "not yet", last: "not yet", wait: 0, bySeat: {}, result: {} };
    SEATS.forEach(function (s) { r.bySeat[s] = []; });
    for (var i = 0; i < n && i < N.steps.length; i++) {
      var s = N.steps[i];
      if (s.kind === "ticket") {
        var seat = /ticket for (\w+) written/.exec(s.msg)[1];
        r.bySeat[seat].push(s.p);
        r.result[s.p] = r.result[s.p] || seat;
      }
      if (s.kind === "out") r.result[s.p] = r.result[s.p] || "sold out";
      if (s.kind === "stopped" && s.tone === "ok") r.result[s.p] = r.result[s.p] || "stopped at Pay";
      if (s.kind === "start") {
        var w = /after (\d+) min (\d+) s/.exec(s.msg);
        var sec = Number(w[1]) * 60 + Number(w[2]);
        if (sec > r.wait) r.wait = sec;
      }
    }
    SEATS.forEach(function (seat) {
      var list = r.bySeat[seat];
      r.tickets += list.length;
      if (list.length) r.free -= 1;
      var distinct = list.filter(function (c, k) { return list.indexOf(c) === k; });
      if (distinct.length > 1) r.double += 1;
      r.extra += list.length - distinct.length;
    });
    r.f7 = r.bySeat.F7.length;
    function told(id) {
      var got = r.result[id];
      if (!got) return "not yet";
      if (got === "sold out" || got === "stopped at Pay") return got;
      var others = r.bySeat[got].filter(function (c) { return c !== id; });
      return got + (others.length ? ", also sold to " + others[0] : "");
    }
    r.vowles = told(3320);
    r.last = told(3322);
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
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    function table(cols) {
      var t = el("table", "width:100%;font-size:12px;");
      var th = el("thead");
      var hr = el("tr");
      cols.forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
      th.appendChild(hr);
      t.appendChild(th);
      var tb = el("tbody");
      t.appendChild(tb);
      box.appendChild(t);
      return tb;
    }
    var seats = table(["seat", "tickets (checkout)", "state"]);
    var people = table(["checkout", "seat map", "tap", "Pay", "result"]);
    var last = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(last);
    api.root.appendChild(box);
    return { el: el, head: head, seats: seats, people: people, last: last };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = tally(S.N, S.shown);
    S.ui.head.textContent = "Design: " + SHORT[C.design] + ". Servers: " + C.servers + ". Mr Vowles: " +
      pick(TIMINGS, C.timing).label + ". Pay sent twice: " + pick(REPEATS, C.repeat).label + ". Steps shown: " +
      S.shown + " of " + S.N.steps.length + ".";
    clear(S.ui.seats);
    SEATS.forEach(function (seat) {
      var list = r.bySeat[seat];
      var tr = S.ui.el("tr");
      var state = !list.length ? "no ticket" : (list.length === 1 ? "sold" : "SOLD " + list.length + " TIMES");
      [seat, list.length ? list.join(", ") : "-", state].forEach(function (c) { tr.appendChild(S.ui.el("td", "", c)); });
      S.ui.seats.appendChild(tr);
    });
    clear(S.ui.people);
    S.N.people.forEach(function (p) {
      var tr = S.ui.el("tr");
      var res = r.result[p.id] || "not yet";
      [name(p), hms(p.map), hms(p.tap), hms(p.pay), res].forEach(function (c) { tr.appendChild(S.ui.el("td", "", c)); });
      S.ui.people.appendChild(tr);
    });
    S.ui.last.textContent = S.shown ? S.N.steps[S.shown - 1].msg : "20:58:00. Four deckchairs have no ticket: C14, F7, H2, J19.";
    S.stat.tickets(r.tickets);
    S.stat.double(r.double);
    S.stat.extra(r.extra);
    S.stat.f7(r.f7);
    S.stat.vowles(r.vowles);
    S.stat.last(r.last);
    S.stat.wait(r.wait ? minsec(r.wait) : "none");
    S.stat.free(r.free);
    api.clock = S.shown ? S.N.steps[S.shown - 1].t : OPEN;
    S.ctl.step.disable(S.shown >= S.N.steps.length);
    S.ctl.play.disable(S.shown >= S.N.steps.length);
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < S.N.steps.length) {
      var s = S.N.steps[S.shown];
      S.shown += 1;
      api.clock = s.t;
      api.log(s.msg, s.tone);
    }
  }

  function summary(S) {
    var r = tally(S.N, S.N.steps.length);
    return "Replayed the rush with " + SHORT[S.C.design] + " on " + S.C.servers + (S.C.servers === 1 ? " server: " : " servers: ") +
      r.tickets + " tickets for " + SEATS.length + " seats, " + r.double + " sold twice, " + r.extra +
      " extra for the same checkout; longest wait in line " + (r.wait ? minsec(r.wait) : "none") + ".";
  }

  function finish(api) {
    var S = api.state;
    var r = tally(S.N, S.N.steps.length);
    api.log(summary(S), r.double || r.extra ? "bad" : "ok");
  }

  function replay(api) {
    var S = api.state;
    S.N = night(S.C);
    S.shown = 0;
    showTo(api, S.N.steps.length);
    finish(api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", servers: 2, timing: "night", repeat: "none" };
      S.N = night(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "Design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.servers = api.control.select("servers", "Servers", SERVERS, 2, function (v) {
        var o = pick(SERVERS, v);
        if (!o) return;
        S.C.servers = Number(o.value);
        replay(api);
      });
      S.ctl.timing = api.control.select("timing", "Mr Vowles's timing", TIMINGS, "night", function (v) {
        var o = pick(TIMINGS, v);
        if (!o) return;
        S.C.timing = String(o.value);
        replay(api);
      });
      S.ctl.repeat = api.control.select("repeat", "A Pay sent twice", REPEATS, "none", function (v) {
        var o = pick(REPEATS, v);
        if (!o) return;
        S.C.repeat = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Play the rush", function () {
        showTo(api, S.N.steps.length);
        finish(api);
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        tickets: api.stat("tickets", "tickets written", ""),
        double: api.stat("double", "seats sold twice", "bad"),
        extra: api.stat("extra", "extra tickets for the same checkout", "warn"),
        f7: api.stat("f7", "tickets for F7", "warn"),
        vowles: api.stat("vowles", "what Mr Vowles got", ""),
        last: api.stat("last", "what checkout 3322 got", ""),
        wait: api.stat("wait", "longest wait in line", ""),
        free: api.stat("free", "seats with no ticket", "")
      };

      api.info("<strong>How to read it.</strong> Five checkouts want the last four deckchairs. Each opens the seat map, taps a seat " +
        "it sees free, presses Pay, and gets a ticket when the card company says yes. Each log line names the server that answered. " +
        "The first table shows each seat's tickets; the second, each checkout's times and result. Step moves one step; Play runs the rest.");

      api.log("20:58:00. Four deckchairs have no ticket: C14, F7, H2, J19. Five checkouts are due before 21:05. Press Step or Play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 20:58:00, before the first checkout.
      t.expect(t.stat("tickets") === 0 && t.stat("double") === 0 && t.stat("free") === 4 && t.stat("vowles") === "not yet" &&
        t.stat("wait") === "none" && has("Four deckchairs have no ticket: C14, F7, H2, J19."),
        "Opens at 20:58:00: four deckchairs with no ticket, nothing written");

      // 2. Six steps: server 2, which never saw Ms Gatacre's hold, holds F7 for Mr Vowles.
      for (var i = 0; i < 6; i++) t.click("step");
      t.expect(has("20:58:41 server 1, checkout 3318 (Ms Gatacre): hold F7 in server 1's memory: ok, until 21:03:41.") &&
        has("21:00:07 server 2, checkout 3320 (Mr Vowles): the seat map shows C14, F7, H2, J19 free.") &&
        has("21:00:12 server 2, checkout 3320 (Mr Vowles): hold F7 in server 2's memory: ok, until 21:05:12."),
        "21:00:12: server 2 holds F7 for checkout 3320 while server 1 holds it for 3318");

      // 3. The rest of the rush, as built: F7 sold twice, 18 s apart.
      t.click("play");
      t.expect(has("21:02:51 server 1, checkout 3318 (Ms Gatacre): the card company says yes; ticket for F7 written.") &&
        has("21:03:09 server 2, checkout 3320 (Mr Vowles): the card company says yes; ticket for F7 written: F7 now has two tickets, checkout 3318's and 3320's.") &&
        t.stat("tickets") === 5 && t.stat("double") === 1 && t.stat("f7") === 2 && t.stat("free") === 0 &&
        t.stat("vowles") === "F7, also sold to 3318" && t.stat("last") === "J19",
        "As built: 5 tickets for 4 seats, F7 at 21:02:51 and 21:03:09");

      // 4. One server, as in June: the seat map shows F7 taken.
      t.set("servers", 1);
      t.expect(t.stat("tickets") === 4 && t.stat("double") === 0 && t.stat("vowles") === "J19" && t.stat("last") === "sold out",
        "One server: Mr Vowles takes J19 and checkout 3322 finds the film sold out");

      // 5. Sticky sessions: each customer stays on its first server, and F7 still sells twice.
      t.set("servers", 2);
      t.set("design", "sticky");
      t.expect(t.stat("double") === 1 && t.stat("tickets") === 5 && t.stat("vowles") === "F7, also sold to 3318",
        "Sticky sessions: 3318 stays on server 1, 3320 on server 2: F7 sold twice");

      // 6. A second check before the card: Mr Vowles presses Pay 11 s before the first ticket.
      t.set("design", "check");
      t.expect(has("21:02:40 server 2, checkout 3320 (Mr Vowles): Pay pressed; the second check finds no ticket for F7 yet, so the card company is asked.") &&
        t.stat("double") === 1 && t.stat("f7") === 2,
        "Check again at Pay: at 21:02:40 there is no ticket for F7 yet, so F7 sells twice");

      // 7. One booking at a time: nobody twice, and the line.
      t.set("design", "line");
      t.expect(t.stat("double") === 0 && t.stat("tickets") === 4 && t.stat("wait") === "6 min 28 s" &&
        t.stat("vowles") === "J19" && t.stat("last") === "sold out" &&
        has("21:10:26 checkout 3322 leaves the line after 5 min 46 s and starts.") &&
        has("21:04:41 checkout 3320 (Mr Vowles) leaves the line after 4 min 34 s and starts."),
        "One at a time: 4 tickets, the longest wait 6 min 28 s, checkout 3322 waits 5 min 46 s to find it sold out");

      // 8. Holds as database rows: what every server sees.
      t.set("design", "rows");
      t.expect(t.stat("double") === 0 && t.stat("tickets") === 4 && t.stat("wait") === "none" &&
        t.stat("vowles") === "J19" && t.stat("last") === "sold out" &&
        has("21:00:07 server 2, checkout 3320 (Mr Vowles): the seat map shows H2, J19 free."),
        "Rows: server 2's seat map at 21:00:07 shows F7 taken; 4 tickets, nobody twice, no line");

      // 9. Rows, Mr Vowles a second after Ms Gatacre: the database refuses his hold.
      t.set("timing", "early");
      var rowsEarly = has("20:58:42 server 2, checkout 3320 (Mr Vowles): hold F7 refused, the database has a running hold on F7 for checkout 3318.") &&
        t.stat("vowles") === "J19" && t.stat("double") === 0;
      t.set("design", "built");
      t.expect(rowsEarly && t.stat("double") === 1 && t.stat("vowles") === "F7, also sold to 3318",
        "A second apart: the database row refuses Mr Vowles's F7; server memory does not");

      // 10. A Pay sent twice: one charge, but the as-built server writes a second ticket.
      t.set("timing", "night");
      t.set("repeat", "gatacre");
      var builtAgain = t.stat("extra") === 1 && t.stat("f7") === 3 && t.stat("tickets") === 6 &&
        has("21:02:59 server 2, checkout 3318 (Ms Gatacre): the card company says yes; ticket for F7 written: a second ticket for the same checkout.");
      t.set("design", "rows");
      t.expect(builtAgain && t.stat("extra") === 0 && t.stat("f7") === 1 && t.stat("tickets") === 4 &&
        has("checkout 3318 already has its ticket for F7, so the same ticket is sent again."),
        "Pay sent twice: as built, a second ticket for checkout 3318; rows keyed by checkout, the same ticket again");
    }
  });
})();
