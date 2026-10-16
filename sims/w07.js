/* sims/w07-v1.0.0.js  (published as sims/w07.js)
   Workshop case w07 "The Ticket Machine That Kept the Coins": a workbench for the coin ticket
   machine at the bottom station of the Sornmouth cliff railway, finished by Odgerel from Winifrith
   Torvaine's work order. Thursday 15 October 2026, the evening rush from 17:30 to 18:30, replayed
   one group of riders at a time.
   Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the design (as built with three flags; a coin ignored while
     printing; a fourth flag, coinNext; one state name with a switch in each event; one object per
     state), the roll (300 tickets left, or 14 left), Step (one group of riders), Play the rush,
     Reset. Shows the machine's flags or state, the cup, the box and the roll, and a table of what
     the design does for each situation and event, with the square the last event used marked.
     Stats: tickets printed, riders who left with nothing, riders who left with their coin back,
     the cash box, money in the box with no ticket, the cup, the machine now, what the 17:41:23
     rider got, existing methods to change to add a jammed state. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Fare: one 2-pound coin, one ticket. A coin always drops into the holding cup. The program
     can tip the cup into the cash box or open it into the return tray; whoever caused that
     event takes what comes out of the tray. A ticket takes 4 s to print. When the printer
     finishes, the event is "printed". A print started with no paper runs 4 s and gives nothing.
   - As built (Winifrith's flags):
       coin:    if noPaper: cup to tray, stop
                hasCoin = yes
       button:  if hasCoin and not printing:
                  cup to box; printing = yes
       printed: printing = no; hasCoin = no
                if roll empty: noPaper = yes
       cancel:  if hasCoin and not printing:
                  cup to tray; hasCoin = no
     "ignore": coin does nothing while printing. "flag": coin while printing sets coinNext, and
     printed sets hasCoin = coinNext, then coinNext = no. Button never checks noPaper.
     "switch" and "states" behave the same: waiting, has money, printing, no paper. Printing
     hands a new coin straight back (the cup was tipped when printing began, so it holds only
     that coin) and lights "wait for the ticket"; printed goes to no paper if the roll is empty,
     else waiting.
   - Riders: each rider puts a coin in when stepping up (s) and presses the button at s+1. A
     rider whose coin comes back while another ticket prints puts it in again 1 s after the
     printer stops, and presses the button 1 s later. A rider whose coin comes back otherwise
     leaves with it. At s+6, s+12 and s+13, a rider who has neither ticket nor coin back, and
     is not having a ticket printed, presses the button again, then cancel, then gives up and
     tells Aneira, the attendant, who adds a mark to her tally.
   - Methods to change to add a jammed state (entered when a print ends in a jam): flags,
     ignore and flag designs 4 (a new flag checked in coin, button, cancel and printed);
     switch 4 (a new case in each event's switch); states 1 (printed in the printing state,
     plus one new class).

   Where every number comes from (conventions rule 14; the case is content/s5/w07-v1.0.0.json).
   Given data:
   - 41 groups step up at 17:30:00 + 85 s x g, g = 0 to 40 (the last at 18:26:40). Group g is a
     pair when (23g + 21) mod 41 < 23, else a single: 23 pairs, 18 singles, 64 riders. The second
     rider of a pair steps up 3 s after the first, 2 s into the first rider's 4 s print. Group 8
     is the post's pair: rider 14 at 17:41:20, rider 15 at 17:41:23.
   - The roll holds 300 tickets at 17:30 (or 14, on the bench).
   - Aneira puts an empty cash box in at 17:30 and takes it out at 18:30, so its count is the
     rush alone: 128 pounds (64 coins x 2) against 41 tickets on the counter (41 x 2 = 82
     pounds): 128 - 82 = 46 pounds with no ticket, 23 coins, one per mark on her tally.
   Reproduced by the model and checked by the selfTest:
   - As built or ignore, full roll: 41 tickets, 23 riders with nothing, the box 128 pounds (all
     64 coins: each stranded coin is tipped in by the next group's ticket; the last group is a
     single), 46 pounds with no ticket. After 9 groups: 9 tickets, 6 with nothing, box 28
     pounds, rider 15's coin still in the cup (2 pounds).
   - Rider 15 as built: coin 17:41:23 (hasCoin already yes), button 17:41:24 (printing), printed
     17:41:25 (hasCoin no), button 17:41:29, cancel 17:41:35, gives up 17:41:36.
   - Flag, full roll: 64 tickets, nobody without; rider 15's ticket at 17:41:33 (button again at
     17:41:29, print 4 s). Flag, 14 left: ticket 14 is rider 14's at 17:41:25, noPaper and hasCoin
     both yes; rider 15's button at 17:41:29 tips the cup and prints with no paper: 1 rider with
     nothing, 14 tickets, 2 pounds with no ticket, 49 riders leave with their coin back.
   - States or switch, full roll: 64 tickets; rider 15's coin comes back at 17:41:23, goes in
     again at 17:41:26, button 17:41:27, ticket at 17:41:31. 14 left: ticket 14 at 17:41:25, the
     state becomes no paper; rider 15's coin comes back again at 17:41:26: 0 with nothing, 50
     leave with their coin back.
   - As built, 14 left: ticket 14 is group 13's (a single) at 17:48:30; 8 riders with nothing
     before it, the box 44 pounds, 16 pounds with no ticket, 42 riders leave with their coin back.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  function at(h, m, s) { return h * 3600 + m * 60 + s; }
  var OPEN = at(17, 29, 50);
  var RUSH = at(17, 30, 0);
  var GAP = 85;
  var GROUPS = 41;
  var PRINT = 4;
  var FARE = 2;
  var ROLLS = { full: 300, short: 14 };

  var DESIGNS = [
    { value: "built", label: "as built: three flags" },
    { value: "ignore", label: "three flags; a coin is ignored while printing" },
    { value: "flag", label: "a fourth flag, coinNext, for a coin while printing" },
    { value: "switch", label: "one state name; a switch in each event" },
    { value: "states", label: "one object per state" }
  ];
  var SHORT = {
    built: "as built", ignore: "coins ignored while printing", flag: "a fourth flag",
    "switch": "a switch in each event", states: "one object per state"
  };
  var ROLL_OPTS = [
    { value: "full", label: "300 tickets left at 17:30" },
    { value: "short", label: "14 tickets left at 17:30" }
  ];
  var PLACES = { built: 4, ignore: 4, flag: 4, "switch": 4, states: 1 };
  var EVENTS = ["coin", "button", "cancel", "printed"];

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function yn(b) { return b ? "yes" : "no"; }
  function pounds(n) { return "£" + n; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function isPair(g) { return ((23 * g + 21) % 41) < 23; }
  function usesStates(C) { return C.design === "switch" || C.design === "states"; }

  function riders() {
    var list = [];
    for (var g = 0; g < GROUPS; g++) {
      var t = RUSH + GAP * g;
      list.push({ n: list.length + 1, g: g, s: t });
      if (isPair(g)) list.push({ n: list.length + 1, g: g, s: t + 3 });
    }
    list.forEach(function (r) { r.out = null; r.pending = false; r.ticketAt = -1; });
    return list;
  }

  /* ---------- the model: one rush, as a list of steps ---------- */

  function rush(C) {
    var R = riders();
    var m = { hasCoin: false, printing: false, noPaper: false, coinNext: false, state: "waiting",
      cup: 0, box: 0, roll: ROLLS[C.roll], owner: null, willTicket: false, printEnd: -1, tickets: 0 };
    var ev = [];
    var seq = 0;
    var steps = [];
    var cur = null;
    function push(t, kind, r) { ev.push({ t: t, kind: kind, r: r, pr: kind === "printed" ? 0 : 1, seq: seq++ }); }
    function before() {
      if (usesStates(C)) return "state " + m.state;
      return "hasCoin " + yn(m.hasCoin) + ", printing " + yn(m.printing) + ", noPaper " + yn(m.noPaper) +
        (C.design === "flag" ? ", coinNext " + yn(m.coinNext) : "");
    }
    function situation() {
      if (usesStates(C)) return m.state;
      if (m.printing) return "printing";
      if (m.noPaper) return m.hasCoin ? "no paper, coin held" : "no paper";
      return m.hasCoin ? "has money" : "waiting";
    }
    function served(r) { return m.printing && m.owner === r; }
    function toTray(r, t) {
      var n = m.cup;
      m.cup = 0;
      if (!r) return "";
      if (m.printing && m.owner !== r) {
        r.pending = true;
        push(m.printEnd + 1, "again", r);
        return "; rider " + r.n + " takes the coin and waits for the printer to stop.";
      }
      if (!r.out) r.out = "coin back";
      return "; rider " + r.n + " leaves with " + pounds(n * FARE) + " back.";
    }
    function startPrint(r, t) {
      m.box += m.cup * FARE;
      m.cup = 0;
      m.printing = true;
      m.owner = r;
      m.printEnd = t + PRINT;
      m.willTicket = m.roll > 0;
      push(t + PRINT, "printed", r);
      return "the cup tips into the box (now " + pounds(m.box) + ") and the printer starts" +
        (m.willTicket ? "" : ", with no paper in it");
    }
    function finishPrint(t) {
      var r = m.owner;
      var text;
      m.printing = false;
      m.owner = null;
      if (m.willTicket) {
        m.roll -= 1;
        m.tickets += 1;
        r.out = "ticket";
        r.ticketAt = t;
        text = "rider " + r.n + " takes ticket " + m.tickets;
      } else {
        text = "nothing comes out for rider " + r.n;
      }
      return text;
    }
    function record(t, r, what, msg, tone, ev0) {
      var who = r ? "rider " + r.n : "printer";
      cur = { sit: ev0.sit, ev: ev0.ev };
      steps.push({ t: t, g: ev0.g, msg: hms(t) + " " + who + ", " + what + " (" + ev0.before + "): " + msg, tone: tone,
        snap: snapshot(), cell: cur });
    }
    function snapshot() {
      var lost = 0, back = 0;
      R.forEach(function (r) { if (r.out === "lost") lost += 1; if (r.out === "coin back") back += 1; });
      var r15 = R[14];
      var got = r15.out === "ticket" ? "ticket at " + hms(r15.ticketAt) : (r15.out === "lost" ? "nothing" :
        (r15.out === "coin back" ? "coin back" : "not yet"));
      return { tickets: m.tickets, lost: lost, back: back, box: m.box, over: m.box - m.tickets * FARE,
        cup: m.cup * FARE, roll: m.roll, now: nowText(), r15: got };
    }
    function nowText() {
      if (usesStates(C)) return "state: " + m.state;
      return "hasCoin " + yn(m.hasCoin) + " · printing " + yn(m.printing) + " · noPaper " + yn(m.noPaper) +
        (C.design === "flag" ? " · coinNext " + yn(m.coinNext) : "");
    }

    // The machine's reaction to one event, by design. Returns [message, tone].
    function flagsEvent(kind, r, t) {
      if (kind === "coin") {
        m.cup += 1;
        if (m.noPaper) return ["noPaper is yes, so the cup opens into the tray" + toTray(r, t), ""];
        if (m.printing && C.design === "ignore") return ["printing is yes, so the coin is ignored; it waits in the cup", "warn"];
        if (m.printing && C.design === "flag") { m.coinNext = true; return ["printing is yes, so coinNext = yes; the coin waits in the cup", ""]; }
        var was = m.hasCoin;
        m.hasCoin = true;
        return [was ? "hasCoin = yes, as it already was; the coin waits in the cup" : "hasCoin = yes; the coin waits in the cup", was ? "warn" : ""];
      }
      if (kind === "button") {
        if (m.hasCoin && !m.printing) {
          var s = startPrint(r, t);
          return [s, m.willTicket ? "" : "bad"];
        }
        return ["nothing happens (" + (m.printing ? "printing is yes" : "hasCoin is no") + ")", m.printing ? "" : "warn"];
      }
      if (kind === "cancel") {
        if (m.hasCoin && !m.printing) {
          m.hasCoin = false;
          return ["the cup opens into the tray and hasCoin = no" + toTray(r, t), ""];
        }
        return ["nothing happens (" + (m.printing ? "printing is yes" : "hasCoin is no") + ")", "warn"];
      }
      // printed
      var text = finishPrint(t);
      if (C.design === "flag") {
        m.hasCoin = m.coinNext;
        m.coinNext = false;
        text += "; printing = no, hasCoin = coinNext (" + yn(m.hasCoin) + "), coinNext = no";
      } else {
        m.hasCoin = false;
        text += "; printing = no, hasCoin = no";
        if (m.cup) text += ", though a coin is in the cup";
      }
      if (m.roll === 0 && !m.noPaper) { m.noPaper = true; text += "; the roll is empty, so noPaper = yes"; }
      return [text, m.cup && C.design !== "flag" ? "bad" : (m.willTicket ? "ok" : "bad")];
    }

    function statesEvent(kind, r, t) {
      var st = m.state;
      if (kind === "coin") {
        m.cup += 1;
        if (st === "waiting") { m.state = "has money"; return ["the coin waits in the cup; state becomes has money", ""]; }
        if (st === "has money") { m.state = "waiting"; return ["one fare at a time: the cup opens into the tray and the state becomes waiting" + toTray(r, t), "warn"]; }
        if (st === "printing") return ["the cup opens into the tray at once and the lamp says wait for the ticket" + toTray(r, t), ""];
        return ["the cup opens into the tray and the lamp says no tickets" + toTray(r, t), ""];
      }
      if (kind === "button") {
        if (st === "has money") { var s = startPrint(r, t); m.state = "printing"; return [s + "; state becomes printing", ""]; }
        if (st === "waiting") return ["the lamp says insert " + pounds(FARE), ""];
        if (st === "printing") return ["the lamp says wait for the ticket", ""];
        return ["the lamp says no tickets", ""];
      }
      if (kind === "cancel") {
        if (st === "has money") { m.state = "waiting"; return ["the cup opens into the tray and the state becomes waiting" + toTray(r, t), ""]; }
        return ["nothing is held, so there is nothing to hand back", ""];
      }
      var text = finishPrint(t);
      if (m.roll === 0) { m.state = "no paper"; text += "; the roll is empty, so state becomes no paper"; }
      else { m.state = "waiting"; text += "; state becomes waiting"; }
      return [text, "ok"];
    }

    function machine(kind, r, t, what, g) {
      var ev0 = { before: before(), sit: situation(), ev: kind, g: g };
      var res = usesStates(C) ? statesEvent(kind, r, t) : flagsEvent(kind, r, t);
      record(t, kind === "printed" ? null : r, what, res[0] + (/[.!]$/.test(res[0]) ? "" : "."), res[1], ev0);
    }

    R.forEach(function (r) {
      push(r.s, "coin", r);
      push(r.s + 1, "button", r);
      push(r.s + 6, "retry", r);
      push(r.s + 12, "cancel", r);
      push(r.s + 13, "leave", r);
    });
    while (ev.length) {
      ev.sort(function (a, b) { return (a.t - b.t) || (a.pr - b.pr) || (a.seq - b.seq); });
      var e = ev.shift();
      var r = e.r;
      if (e.kind === "printed") { machine("printed", r, e.t, "printed", r.g); continue; }
      if (e.kind === "again") { r.pending = false; machine("coin", r, e.t, "coin again", r.g); push(e.t + 1, "button2", r); continue; }
      if (r.out || served(r)) continue;
      if (e.kind === "coin") { machine("coin", r, e.t, "coin", r.g); continue; }
      if (r.pending) continue;
      if (e.kind === "button" || e.kind === "button2") { machine("button", r, e.t, "button", r.g); continue; }
      if (e.kind === "retry") { machine("button", r, e.t, "button again", r.g); continue; }
      if (e.kind === "cancel") { machine("cancel", r, e.t, "cancel", r.g); continue; }
      r.out = "lost";
      cur = cur || { sit: "waiting", ev: "cancel" };
      steps.push({ t: e.t, g: r.g, msg: hms(e.t) + " rider " + r.n + " gives up with no ticket and no coin, and tells Aneira, who adds a mark to her tally.",
        tone: "bad", snap: snapshot(), cell: cur });
    }
    return { riders: R, steps: steps, start: (function () {
      return { tickets: 0, lost: 0, back: 0, box: 0, over: 0, cup: 0, roll: ROLLS[C.roll],
        now: usesStates(C) ? "state: waiting" : "hasCoin no · printing no · noPaper no" + (C.design === "flag" ? " · coinNext no" : ""),
        r15: "not yet" };
    })() };
  }

  /* ---------- what each design does, for the table ---------- */

  var TABLE = {
    flags: {
      "waiting": ["hasCoin = yes", "nothing", "nothing", "never written"],
      "has money": ["hasCoin = yes", "cup to box, print", "cup to tray", "never written"],
      "printing": ["hasCoin = yes (already)", "nothing", "nothing", "hasCoin = no"],
      "no paper": ["cup to tray", "nothing", "nothing", "never written"]
    },
    states: {
      "waiting": ["to has money", "lamp: insert", "nothing held", "can't happen: log"],
      "has money": ["cup to tray", "cup to box, print", "cup to tray", "can't happen: log"],
      "printing": ["cup to tray, lamp: wait", "lamp: wait", "nothing held", "ticket, then next state"],
      "no paper": ["cup to tray", "lamp: no tickets", "nothing held", "can't happen: log"]
    }
  };
  function tableFor(C) {
    if (usesStates(C)) return TABLE.states;
    var t = {};
    Object.keys(TABLE.flags).forEach(function (k) { t[k] = TABLE.flags[k].slice(); });
    if (C.design === "ignore") t.printing[0] = "ignored (coin in cup)";
    if (C.design === "flag") {
      t.printing[0] = "coinNext = yes";
      t.printing[3] = "hasCoin = coinNext";
      t["no paper, coin held"] = ["cup to tray", "cup to box, print", "cup to tray", "never written"];
    }
    return t;
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
    var mach = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(mach);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["situation"].concat(EVENTS).forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var last = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(last);
    api.root.appendChild(box);
    return { el: el, head: head, mach: mach, tbody: tbody, last: last };
  }

  function shownSteps(S) {
    var n = 0;
    while (n < S.N.steps.length && S.N.steps[n].g < S.groups) n += 1;
    return n;
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var n = shownSteps(S);
    var lastStep = n ? S.N.steps[n - 1] : null;
    var snap = lastStep ? lastStep.snap : S.N.start;
    S.ui.head.textContent = "design: " + SHORT[C.design] + "; roll: " + pick(ROLL_OPTS, C.roll).label +
      "; groups shown: " + S.groups + " of " + GROUPS + ".";
    S.ui.mach.textContent = "machine: " + snap.now + "; cup " + pounds(snap.cup) + ", box " + pounds(snap.box) +
      ", tickets left on the roll " + snap.roll + ".";
    clear(S.ui.tbody);
    var tab = tableFor(C);
    Object.keys(tab).forEach(function (sit) {
      var tr = S.ui.el("tr");
      tr.appendChild(S.ui.el("td", "", sit));
      tab[sit].forEach(function (cell, i) {
        var used = lastStep && lastStep.cell.sit === sit && lastStep.cell.ev === EVENTS[i];
        tr.appendChild(S.ui.el("td", used ? "outline:2px solid currentColor;" : "", cell));
      });
      S.ui.tbody.appendChild(tr);
    });
    S.ui.last.textContent = lastStep ? lastStep.msg : "17:29:50: nobody has stepped up yet.";
    S.stat.tickets(snap.tickets);
    S.stat.lost(snap.lost);
    S.stat.back(snap.back);
    S.stat.box(pounds(snap.box));
    S.stat.over(pounds(snap.over));
    S.stat.cup(pounds(snap.cup));
    S.stat.now(snap.now);
    S.stat.r15(snap.r15);
    S.stat.places(PLACES[C.design]);
    api.clock = lastStep ? lastStep.t : OPEN;
    S.ctl.step.disable(S.groups >= GROUPS);
    S.ctl.play.disable(S.groups >= GROUPS);
  }

  function showTo(api, groups) {
    var S = api.state;
    var from = shownSteps(S);
    S.groups = Math.min(GROUPS, groups);
    var to = shownSteps(S);
    for (var i = from; i < to; i++) {
      var s = S.N.steps[i];
      api.clock = s.t;
      api.log(s.msg, s.tone);
    }
  }

  function summary(S) {
    var end = S.N.steps[S.N.steps.length - 1].snap;
    return "rush replayed with " + SHORT[S.C.design] + ", " + pick(ROLL_OPTS, S.C.roll).label + ": " + end.tickets +
      " tickets, " + end.lost + (end.lost === 1 ? " rider" : " riders") + " left with nothing, " + end.back + " left with their coin back, " +
      pounds(end.over) + " in the box with no ticket.";
  }

  function rebuild(api) {
    var S = api.state;
    S.N = rush(S.C);
    S.groups = 0;
    api.log("design: " + SHORT[S.C.design] + "; roll: " + pick(ROLL_OPTS, S.C.roll).label + "; press step or play.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", roll: "full" };
      S.N = rush(S.C);
      S.groups = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        rebuild(api);
      });
      S.ctl.roll = api.control.select("roll", "paper roll", ROLL_OPTS, "full", function (v) {
        var o = pick(ROLL_OPTS, v);
        if (!o) return;
        S.C.roll = String(o.value);
        rebuild(api);
      });
      S.ctl.step = api.control.button("step", "step", function () { showTo(api, S.groups + 1); draw(api); });
      S.ctl.play = api.control.button("play", "play the rush", function () {
        showTo(api, GROUPS);
        var end = S.N.steps[S.N.steps.length - 1].snap;
        api.log(summary(S), end.lost ? "bad" : "ok");
        draw(api);
      });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        tickets: api.stat("tickets", "tickets printed", "ok"),
        lost: api.stat("lost", "riders who left with nothing", "bad"),
        back: api.stat("back", "riders who left with their coin back", ""),
        box: api.stat("box", "the cash box", ""),
        over: api.stat("over", "money in the box with no ticket", "bad"),
        cup: api.stat("cup", "in the cup now", "warn"),
        now: api.stat("now", "the machine now", ""),
        r15: api.stat("r15", "what the 17:41:23 rider got", "warn"),
        places: api.stat("places", "methods to change to add a jammed state", "")
      };

      api.info("<strong>how to read it:</strong> each rider puts a coin in and presses the button a second later. " +
        "A coin drops into the cup; the program tips the cup into the box when a ticket starts, or opens it into the tray. " +
        "the table shows what the design does in each situation for each event; the outlined square is the one the last event used. " +
        "step replays one group of riders (one, or two close together); play runs the rest of the rush.");

      api.log("17:29:50: 64 riders will pay by coin between 17:30 and 18:30; 23 of them step up while the ticket before theirs is still printing; press step or play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      // Every line checked below is among the log's last 14 lines.
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 17:29:50, before the first rider.
      t.expect(t.stat("tickets") === 0 && t.stat("lost") === 0 && t.stat("box") === "£0" && t.stat("cup") === "£0" &&
        t.stat("now") === "hasCoin no · printing no · noPaper no" && t.stat("r15") === "not yet" &&
        has("64 riders will pay by coin between 17:30 and 18:30; 23 of them step up"),
        "opens at 17:29:50: nothing printed, the cup empty, every flag no");

      // 2. Nine groups: the 17:41 pair, as built.
      for (var i = 0; i < 9; i++) t.click("step");
      t.expect(has("17:41:23 rider 15, coin (hasCoin yes, printing yes, noPaper no): hasCoin = yes, as it already was; the coin waits in the cup.") &&
        has("17:41:25 printer, printed (hasCoin yes, printing yes, noPaper no): rider 14 takes ticket 9; printing = no, hasCoin = no, though a coin is in the cup.") &&
        has("17:41:35 rider 15, cancel (hasCoin no, printing no, noPaper no): nothing happens (hasCoin is no).") &&
        has("17:41:36 rider 15 gives up with no ticket and no coin") &&
        t.stat("tickets") === 9 && t.stat("lost") === 6 && t.stat("box") === "£28" && t.stat("cup") === "£2" &&
        t.stat("r15") === "nothing",
        "as built, 17:41: rider 15's coin is wiped from hasCoin at 17:41:25 and sits in the cup");

      // 3. The whole rush as built.
      t.click("play");
      t.expect(t.stat("tickets") === 41 && t.stat("lost") === 23 && t.stat("box") === "£128" && t.stat("over") === "£46" &&
        t.stat("cup") === "£0" && t.stat("back") === 0 && t.stat("places") === 4,
        "as built: 41 tickets, 23 riders with nothing, 46 pounds in the box with no ticket");

      // 4. Ignoring coins while printing changes nothing.
      t.set("design", "ignore");
      t.click("play");
      t.expect(t.stat("tickets") === 41 && t.stat("lost") === 23 && t.stat("over") === "£46" &&
        has("rush replayed with coins ignored while printing, 300 tickets left at 17:30: 41 tickets, 23 riders left with nothing"),
        "ignore: the coins still drop into the cup: 23 riders with nothing, 46 pounds");

      // 5. A fourth flag: right on Thursday.
      t.set("design", "flag");
      t.click("play");
      t.expect(t.stat("tickets") === 64 && t.stat("lost") === 0 && t.stat("over") === "£0" && t.stat("r15") === "ticket at 17:41:33",
        "flag, full roll: 64 tickets; rider 15's ticket at 17:41:33");

      // 6. A fourth flag, 14 tickets left: a combination nobody wrote.
      t.set("roll", "short");
      t.click("play");
      t.expect(t.stat("tickets") === 14 && t.stat("lost") === 1 && t.stat("over") === "£2" && t.stat("r15") === "nothing" &&
        t.stat("back") === 49,
        "flag, 14 left: rider 15's button prints with no paper; 1 rider with nothing, 2 pounds kept");

      // 7. One object per state, 14 left: the coin comes back twice.
      t.set("design", "states");
      for (var j = 0; j < 9; j++) t.click("step");
      var s7 = has("17:41:23 rider 15, coin (state printing): the cup opens into the tray at once and the lamp says wait for the ticket; rider 15 takes the coin and waits for the printer to stop.") &&
        has("17:41:25 printer, printed (state printing): rider 14 takes ticket 14; the roll is empty, so state becomes no paper.") &&
        has("17:41:26 rider 15, coin again (state no paper): the cup opens into the tray and the lamp says no tickets; rider 15 leaves with £2 back.");
      t.click("play");
      t.expect(s7 && t.stat("tickets") === 14 && t.stat("lost") === 0 && t.stat("r15") === "coin back" && t.stat("back") === 50 &&
        t.stat("over") === "£0",
        "states, 14 left: rider 15's coin comes back at 17:41:23 and again at 17:41:26; nobody left with nothing");

      // 8. One object per state, full roll.
      t.set("roll", "full");
      t.click("play");
      t.expect(t.stat("tickets") === 64 && t.stat("lost") === 0 && t.stat("over") === "£0" && t.stat("r15") === "ticket at 17:41:31" &&
        t.stat("places") === 1 && t.stat("now") === "state: waiting",
        "states, full roll: 64 tickets; rider 15's ticket at 17:41:31; 1 method to change for a jammed state");

      // 9. A switch in each event: the same night, more places to change.
      t.set("design", "switch");
      t.click("play");
      t.expect(t.stat("tickets") === 64 && t.stat("lost") === 0 && t.stat("r15") === "ticket at 17:41:31" && t.stat("places") === 4,
        "switch: the same 64 tickets; 4 methods to change for a jammed state");

      // 10. As built with 14 left: the roll runs out at 17:48:30.
      t.set("design", "built");
      t.set("roll", "short");
      t.click("play");
      t.expect(t.stat("tickets") === 14 && t.stat("lost") === 8 && t.stat("over") === "£16" && t.stat("box") === "£44" &&
        t.stat("back") === 42,
        "as built, 14 left: 8 riders with nothing before the roll runs out, 16 pounds kept");
    }
  });
})();
