/* sims/w03-v1.0.0.js  (published as sims/w03.js)
   Workshop case w03 "The Lift That Forgot": a workbench for the lift controller Odgerel finished
   for Quorrie House, a student hall of residence with eight floors and one lift. The learner picks
   a design, replays a recorded stretch of the hall's log through it, and watches the lift's state,
   its list of stops, the lit call buttons, and the record the replay produces.
   Widget-style sim: it draws a shaft and the table of states and events inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: two scenes (Wednesday 02:13:30, the night of the record;
     Monday 08:40:55, the first exam morning, from the hall's log), five designs (as built; restart
     every 10 minutes; serve in the order pressed; a loop that reads every button once a second;
     a table filled for every state and event, with calls kept in any state and served one way
     then back), step, play the rest, reset. Shows the shaft with lit buttons, the state table with
     the square the last step used, and stats. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Floors 1 to 8. One call button per landing and 8 floor buttons in the lift: 16 buttons. A
     button's light is wired to the button: it comes on when pressed and goes off when the doors
     finish opening at that floor.
   - Timings: the doors take 2 s to open, stay open 5 s, take 2 s to close; the lift takes 4 s a
     floor. Everyone at a floor gets in when the doors finish opening there and presses their floor
     at once; a student whose floor it is gets out then.
   - States: idle, moving up, moving down, doors opening, doors open, doors closing.
   - As built (Odgerel's program): idle: a call here opens the doors, a call elsewhere is listed and
     the lift sets off. Moving: a call is listed; at each floor the lift stops if that floor is
     listed. Doors opening and doors open: a call elsewhere is listed. Doors closing: a call here
     opens the doors again; a call from any other floor gets no reaction at all (the hole). When the
     doors have shut, the lift sets off for the nearest listed floor (ties: the earlier pressed),
     or goes idle if the list is empty.
   - "restart": as built, and the program restarts at 02:20:00 (every 10 minutes on the clock;
     none falls inside the morning scene). A restart empties the list.
   - "order": as built, but the next stop is always the first floor in the list (the order pressed),
     and while moving the lift stops only there.
   - "poll": the program stops listening for presses. At every whole second a loop reads all 16
     buttons and treats each lit floor that is not listed as a call, in any state (a call from
     another floor during doors closing is listed). A press made on a whole second is read at the
     next one. Next stop: nearest, as built.
   - "table": every state answers every event; doors closing lists a call from another floor; the
     next stop is the nearest listed floor in the direction the lift is going, and it turns back
     only when nothing is listed ahead (from idle, it heads toward the first floor pressed).
   - Same moment: the lift's own events first, then a restart, then the loop's read, then presses.

   Where every number comes from (conventions rule 14; the case is content/s5/w03-v1.0.0.json).
   All of these come out of the model above and are checked by the selfTest.
   - Night, as built: lift idle at floor 4. Ofeliya presses 4 at 02:13:40: doors open 02:13:42,
     presses 1; doors closing 02:13:47, shut 02:13:49; floors 3, 2, 1 at 02:13:53, :57, 02:14:01;
     doors open 02:14:03 (Ofeliya out); closing 02:14:08 to 02:14:10. Zlatoslava presses 6 at
     02:14:09, inside the closing window: dropped. Idle at floor 1 from 02:14:10 until the second
     press at 02:25:10: 11 min. Lift reaches 6 at 02:25:30, doors open 02:25:32. Zlatoslava's wait
     02:14:09 to 02:25:32 = 683 s = 11 min 23 s. 1 call dropped.
   - Night, restart: the same, plus a restart at 02:20:00 with an empty list: 683 s, 1 dropped.
   - Night, order: the same as built: 683 s, 1 dropped.
   - Night, poll: every press is read 1 s later. Ofeliya's at 02:13:41; doors closing at floor 1
     02:14:09 to 02:14:11; Zlatoslava's press read at 02:14:10 and listed; floor 6 doors open at
     02:14:33: 24 s.
   - Night, table: the press at 02:14:09 is listed; doors shut 02:14:10; floors 2 to 6 at 4 s each
     (20 s) to 02:14:30; doors open 02:14:32: 23 s. 0 dropped.
   - Morning: lift idle at floor 1; seven students, one each on floors 4, 8, 7, 6, 5, 3, 2, press at
     08:41:00, :07, :18, :31, :42, :48, :52, all going to floor 1. Waits (press to doors opening):
       as built (nearest): 14, 135, 111, 85, 61, 4, 13 = 423 s; longest 135 s (floor 8); 24 floors
         travelled; last student at floor 1 at 08:43:59.
       order: 14, 32, 91, 91, 93, 104, 113 = 538 s; longest 113 s (floor 2); 26 floors; 08:43:58.
       poll: 15, 136, 112, 86, 62, 5, 14 = 430 s; longest 136 s; 24 floors; 08:44:00.
       table: 14, 41, 17, 34, 36, 47, 56 = 245 s; longest 56 s (floor 2); 14 floors; 08:43:01. The
         student on floor 4 gets in at 08:41:14 and rides up to 8 before going down: at floor 1 at
         08:43:01, 107 s in the lift, against 21 s as built.
       restart: no restart falls inside the scene, so the same as built.
   - 0 calls dropped in the morning in every design.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var TRAVEL = 4, OPENING = 2, DWELL = 5, CLOSING = 2, BUTTONS = 16, FLOORS = 8;
  function at(h, m, s) { return h * 3600 + m * 60 + s; }

  var SCENES = {
    night: {
      label: "wednesday 02:13:30, the night of the record", open: at(2, 13, 30), start: 4,
      restarts: [at(2, 20, 0)],
      riders: [
        { who: "Ofeliya", from: 4, to: 1, at: at(2, 13, 40) },
        { who: "Zlatoslava", from: 6, to: 1, at: at(2, 14, 9), again: at(2, 25, 10) }
      ]
    },
    rush: {
      label: "monday 08:40:55, the first exam morning", open: at(8, 40, 55), start: 1,
      restarts: [],
      riders: [
        { who: "the student on floor 4", from: 4, to: 1, at: at(8, 41, 0) },
        { who: "the student on floor 8", from: 8, to: 1, at: at(8, 41, 7) },
        { who: "the student on floor 7", from: 7, to: 1, at: at(8, 41, 18) },
        { who: "the student on floor 6", from: 6, to: 1, at: at(8, 41, 31) },
        { who: "the student on floor 5", from: 5, to: 1, at: at(8, 41, 42) },
        { who: "the student on floor 3", from: 3, to: 1, at: at(8, 41, 48) },
        { who: "the student on floor 2", from: 2, to: 1, at: at(8, 41, 52) }
      ]
    }
  };

  var SCENE_OPTS = [
    { value: "night", label: "wednesday 02:13:30, the night of the record" },
    { value: "rush", label: "monday 08:40:55, the first exam morning" }
  ];
  var DESIGNS = [
    { value: "built", label: "as built (nearest stop next)" },
    { value: "restart", label: "as built, restarted every 10 minutes" },
    { value: "order", label: "serve calls strictly in the order pressed" },
    { value: "poll", label: "a loop reads every button once a second" },
    { value: "table", label: "every square filled; one way, then back" }
  ];
  var SHORT = {
    built: "as built", restart: "restart every 10 minutes", order: "the order pressed",
    poll: "the once-a-second loop", table: "the full table, one way then back"
  };
  var STATES = ["idle", "up", "down", "opening", "open", "closing"];
  var SNAME = { idle: "idle", up: "moving up", down: "moving down", opening: "doors opening", open: "doors open", closing: "doors closing" };
  var EVENTS = ["call", "floor reached", "doors opened", "5 s up", "doors shut"];

  function cells(design) {
    var nextRule = design === "order" ? "first in line, or idle" : (design === "table" ? "on the way, then back, or idle" : "nearest listed, or idle");
    var stopRule = design === "order" ? "stop if first in line" : "stop if listed";
    var closeCall = design === "table" ? "here: reopen; else: add" : (design === "poll" ? "here: reopen; else: add (loop)" : "here: reopen");
    var C = {
      idle: ["here: open; else: add, set off", "", "", "", ""],
      up: ["add", stopRule, "", "", ""],
      down: ["add", stopRule, "", "", ""],
      opening: ["add", "", "doors open", "", ""],
      open: ["here: get in; else: add", "", "", "doors closing", ""],
      closing: [closeCall, "", "", "", nextRule]
    };
    if (design === "table") {
      STATES.forEach(function (s) { C[s] = C[s].map(function (c) { return c || "can't happen: log it"; }); });
    }
    return C;
  }

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(t) { return pad(Math.floor(t / 3600) % 24) + ":" + pad(Math.floor(t / 60) % 60) + ":" + pad(t % 60); }
  function waitText(s) { return s >= 60 ? s + " s (" + Math.floor(s / 60) + " min " + (s % 60) + " s)" : s + " s"; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model: one replay, as a list of steps ---------- */

  function run(design, key) {
    var S = SCENES[key];
    var lift = { floor: S.start, state: "idle", dir: 0 };
    var stops = [];
    var lit = {};
    var car = {};
    var ev = [];
    var seq = 0;
    var gen = 0;
    var tot = { travelled: 0, dropped: 0, reads: 0 };
    var steps = [];
    var R = S.riders.map(function (r) {
      return { who: r.who, from: r.from, to: r.to, at: r.at, again: r.again || null, state: "wait", boarded: null, out: null };
    });
    function push(t, pri, kind, d) { ev.push({ t: t, pri: pri, kind: kind, d: d || {}, seq: seq++ }); }
    function listed(f) { return stops.indexOf(f) >= 0; }
    function add(f) { if (!listed(f)) stops.push(f); }
    function remove(f) { stops = stops.filter(function (x) { return x !== f; }); }
    function litList() {
      var a = [];
      for (var f = 1; f <= FLOORS; f++) if (lit[f]) a.push(f);
      return a;
    }
    function step(t, text, tone, cell, extra) {
      var s = {
        t: t, msg: hms(t) + " · " + text + ".", tone: tone || "", state: lift.state, floor: lift.floor,
        stops: stops.slice(), lit: litList(), dropped: tot.dropped, travelled: tot.travelled, reads: tot.reads, cell: cell || null
      };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) s[k] = extra[k];
      steps.push(s);
    }
    function choose() {
      if (!stops.length) return null;
      var fl = lift.floor;
      if (design === "order") return stops[0];
      if (design === "table") {
        if (listed(fl)) return fl;
        var above = stops.filter(function (f) { return f > fl; });
        var below = stops.filter(function (f) { return f < fl; });
        var d = lift.dir || (stops[0] > fl ? 1 : -1);
        if (d > 0 && above.length) return Math.min.apply(null, above);
        if (d < 0 && below.length) return Math.max.apply(null, below);
        if (above.length) return Math.min.apply(null, above);
        return Math.max.apply(null, below);
      }
      var best = stops[0];
      stops.forEach(function (f) { if (Math.abs(f - fl) < Math.abs(best - fl)) best = f; });
      return best;
    }
    function opening(t) {
      lift.state = "opening";
      remove(lift.floor);
      gen += 1;
      push(t + OPENING, 0, "opened", { g: gen });
    }
    function go(t) {
      var g = choose();
      if (g === null) { lift.state = "idle"; lift.dir = 0; return "the list is empty, so the lift goes idle at floor " + lift.floor; }
      if (g === lift.floor) { opening(t); return "floor " + g + " is listed and the lift is here, so the doors open"; }
      lift.dir = g > lift.floor ? 1 : -1;
      lift.state = lift.dir > 0 ? "up" : "down";
      push(t + TRAVEL, 0, "arrive", { f: lift.floor + lift.dir });
      return "it sets off " + (lift.dir > 0 ? "up" : "down") + " for floor " + g;
    }
    // A call for floor f, heard in the current state. Returns { text, tone }.
    function call(f, t) {
      var s = lift.state;
      var here = f === lift.floor;
      if (s === "idle") {
        if (here) { opening(t); return { text: "the lift is here, so the doors start opening", tone: "" }; }
        add(f);
        return { text: "added to the list; " + go(t), tone: "" };
      }
      if (s === "up" || s === "down") { add(f); return { text: "added to the list", tone: "" }; }
      if (s === "opening" || s === "open") {
        if (here) return { text: "the doors are " + (s === "open" ? "open" : "opening") + " here already", tone: "" };
        add(f);
        return { text: "added to the list", tone: "" };
      }
      if (here) { opening(t); return { text: "the doors open again", tone: "" }; }
      if (design === "table" || design === "poll") { add(f); return { text: "kept on the list for when the doors have shut", tone: "ok" }; }
      tot.dropped += 1;
      return { text: "no reaction: the call is dropped, and the light stays on", tone: "bad" };
    }
    function board(r, t) {
      r.state = "car";
      r.boarded = t;
      push(t, 3, "car", { r: r });
    }
    function pending() {
      return ev.some(function (x) { return x.kind !== "tick" && !(x.kind === "again" && x.d.r.state !== "wait"); });
    }

    R.forEach(function (r) {
      push(r.at, 3, "press", { r: r });
      if (r.again) push(r.again, 3, "again", { r: r });
    });
    S.restarts.forEach(function (t) { if (design === "restart") push(t, 1, "restart", {}); });
    if (design === "poll") push(S.open + 1, 2, "tick", {});

    while (ev.length) {
      ev.sort(function (a, b) { return (a.t - b.t) || (a.pri - b.pri) || (a.seq - b.seq); });
      var e = ev.shift();
      var t = e.t;
      var d = e.d;
      var was = SNAME[lift.state];
      var row = lift.state;
      if (e.kind === "tick") {
        tot.reads += BUTTONS;
        var heard = [];
        for (var f = 1; f <= FLOORS; f++) {
          if (!(lit[f] || car[f]) || listed(f)) continue;
          if (f === lift.floor && (lift.state === "open" || lift.state === "opening")) continue;
          var rowNow = lift.state;
          var wasNow = SNAME[lift.state];
          var res = call(f, t);
          heard.push(1);
          step(t, wasNow + " · the loop reads the buttons: floor " + f + " is lit and not listed: " + res.text, res.tone, { row: rowNow, col: 0, tone: res.tone });
        }
        if (pending() || lift.state !== "idle" || litList().length || heard.length) push(t + 1, 2, "tick", {});
        continue;
      }
      if (e.kind === "restart") {
        stops = [];
        step(t, was + " · restart: the program starts again with an empty list" + (litList().length ? "; the light on floor " + litList().join(", ") + " is still on" : ""), "warn", null);
        continue;
      }
      if (e.kind === "press" || e.kind === "again") {
        var r = d.r;
        if (r.state !== "wait") continue;
        lit[r.from] = true;
        var head = was + " · " + r.who + " presses the call button on floor " + r.from + (e.kind === "again" ? " again" : "");
        if (lift.state === "open" && lift.floor === r.from) {
          board(r, t);
          step(t, head + ": the doors are open here, so they get in", "", { row: row, col: 0, tone: "" }, { board: { who: r.who, wait: 0 } });
          continue;
        }
        if (design === "poll") { step(t, head + ": the light comes on; the program waits for the loop to read it", "", null); continue; }
        var c = call(r.from, t);
        step(t, head + ": " + c.text, c.tone, { row: row, col: 0, tone: c.tone });
        continue;
      }
      if (e.kind === "car") {
        var rr = d.r;
        car[rr.to] = true;
        var h2 = was + " · inside, " + rr.who + " presses " + rr.to;
        if (design === "poll") { step(t, h2 + ": the button lights; the loop will read it", "", null); continue; }
        var c2 = call(rr.to, t);
        step(t, h2 + ": " + c2.text, c2.tone, { row: row, col: 0, tone: c2.tone });
        continue;
      }
      if (e.kind === "arrive") {
        tot.travelled += 1;
        lift.floor = d.f;
        var stop = design === "order" ? stops[0] === d.f : listed(d.f);
        var why;
        if (!stops.length) { stop = true; why = "the list is empty, so it stops here"; }
        if (stop) {
          opening(t);
          step(t, was + " · floor " + d.f + " reached: " + (why || "listed, so it stops; the doors start opening"), "", { row: row, col: 1, tone: "" });
        } else {
          push(t + TRAVEL, 0, "arrive", { f: d.f + lift.dir });
          step(t, was + " · floor " + d.f + " reached: " + (design === "order" && listed(d.f) ? "listed, but not first in line, so it carries on" : "not listed, so it carries on"), "", { row: row, col: 1, tone: "" });
        }
        continue;
      }
      if (e.kind === "opened") {
        if (d.g !== gen) continue;
        lift.state = "open";
        lit[lift.floor] = false;
        car[lift.floor] = false;
        var bits = [];
        var extra = {};
        R.forEach(function (x) {
          if (x.state === "car" && x.to === lift.floor) { x.state = "done"; x.out = t; bits.push(x.who + " gets out"); extra.exit = { who: x.who, t: t }; }
        });
        var boards = [];
        R.forEach(function (x) {
          if (x.state === "wait" && x.from === lift.floor && x.at <= t) { board(x, t); boards.push({ who: x.who, wait: t - x.at }); bits.push(x.who + " gets in after " + waitText(t - x.at)); }
        });
        if (boards.length) extra.boards = boards;
        push(t + DWELL, 0, "dwell", { g: gen });
        step(t, was + " · doors opened at floor " + lift.floor + (bits.length ? ": " + bits.join("; ") : ""), "", { row: row, col: 2, tone: "" }, extra);
        continue;
      }
      if (e.kind === "dwell") {
        if (d.g !== gen) continue;
        lift.state = "closing";
        push(t + CLOSING, 0, "closed", { g: gen });
        step(t, was + " · 5 s up: the doors start closing", "", { row: row, col: 3, tone: "" });
        continue;
      }
      if (e.kind === "closed") {
        if (d.g !== gen) continue;
        var gtext = go(t);
        step(t, was + " · doors shut: " + gtext, "", { row: row, col: 4, tone: "" });
        continue;
      }
    }
    return { steps: steps, riders: R, total: tot };
  }

  // Totals over the first n steps.
  function tally(S, n) {
    var sc = SCENES[S.C.scene];
    var r = { state: "idle", floor: sc.start, stops: [], lit: [], dropped: 0, travelled: 0, reads: 0, longest: -1, total: 0, boarded: 0, last: null, yev: null, cell: null };
    for (var i = 0; i < n && i < S.N.steps.length; i++) {
      var s = S.N.steps[i];
      r.state = s.state; r.floor = s.floor; r.stops = s.stops; r.lit = s.lit; r.dropped = s.dropped;
      r.travelled = s.travelled; r.reads = s.reads; r.cell = s.cell;
      var list = s.boards || (s.board ? [s.board] : []);
      list.forEach(function (b) {
        r.boarded += 1;
        r.total += b.wait;
        if (b.wait > r.longest) r.longest = b.wait;
        if (b.who === "Zlatoslava") r.yev = b.wait;
      });
      if (s.exit) r.last = s.exit.t;
    }
    return r;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k]));
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, text, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }
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
    var svg = mk(doc, "svg", {
      viewBox: "0 0 300 250", width: "100%", "class": "dg", role: "img",
      "aria-label": "The lift shaft, floors 1 to 8 from the bottom up. A dot beside a floor is that floor's call button, filled when its light is on. The box in the shaft is the lift, labelled with its state."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    box.appendChild(table);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, table: table };
  }

  function drawShaft(S, r) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    function Y(f) { return 22 + (FLOORS - f) * 27; }
    mk(doc, "rect", { x: 110, y: Y(FLOORS) - 13, width: 50, height: FLOORS * 27, "class": "dg-gap" }, g);
    for (var f = 1; f <= FLOORS; f++) {
      txt(doc, g, 10, Y(f) + 4, "floor " + f, "dg-note", "start");
      var on = r.lit.indexOf(f) >= 0;
      var c = mk(doc, "g", { "class": "dg-node " + (on ? "st-warn" : "st-muted") }, g);
      mk(doc, "circle", { cx: 82, cy: Y(f), r: on ? 6 : 3 }, c);
    }
    var tone = r.state === "idle" ? "st-muted" : (r.state === "up" || r.state === "down" ? "st-accent" : "st-ok");
    var lg = mk(doc, "g", { "class": "dg-node " + tone }, g);
    mk(doc, "rect", { x: 116, y: Y(r.floor) - 10, width: 38, height: 20, rx: 3 }, lg);
    txt(doc, g, 168, Y(r.floor) + 4, SNAME[r.state], "dg-note", "start");
    txt(doc, g, 10, 242, "list: " + (r.stops.length ? r.stops.join(", ") : "empty"), "dg-note", "start");
  }

  function drawTable(S, r) {
    var el = S.ui.el;
    var tb = S.ui.table;
    clear(tb);
    var C = cells(S.C.design);
    var hr = el("tr");
    hr.appendChild(el("th", "text-align:left;padding:2px;", "state"));
    EVENTS.forEach(function (e) { hr.appendChild(el("th", "text-align:left;padding:2px;", e)); });
    tb.appendChild(hr);
    STATES.forEach(function (s) {
      var tr = el("tr");
      tr.appendChild(el("td", "padding:2px;" + (r.state === s ? "font-weight:bold;" : ""), SNAME[s]));
      C[s].forEach(function (text, i) {
        var used = r.cell && r.cell.row === s && r.cell.col === i;
        var style = "padding:2px;border:1px solid rgba(128,128,128,0.35);";
        if (used) style += "outline:2px solid currentColor;font-weight:bold;";
        tr.appendChild(el("td", style, used && r.cell.tone === "bad" ? "nothing (call dropped)" : (text || "·")));
      });
      tb.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var r = tally(S, S.shown);
    S.r = r;
    S.ui.head.textContent = "Scene: " + SCENES[S.C.scene].label + ". Design: " + SHORT[S.C.design] + ". Steps shown: " + S.shown + " of " + S.N.steps.length + ".";
    drawShaft(S, r);
    drawTable(S, r);
    S.stat.state(SNAME[r.state]);
    S.stat.floor(r.floor);
    S.stat.list(r.stops.length ? r.stops.join(", ") : "empty");
    S.stat.dropped(r.dropped);
    if (S.C.scene === "night") {
      var y = SCENES.night.riders[1];
      var pressed = S.shown && S.N.steps[S.shown - 1].t >= y.at;
      S.stat.yev(r.yev !== null ? waitText(r.yev) : (pressed ? "still waiting" : "not pressed yet"));
    } else {
      S.stat.yev("not in this scene");
    }
    S.stat.longest(r.longest < 0 ? "nobody in yet" : waitText(r.longest));
    S.stat.total(r.boarded ? r.total + " s, " + r.boarded + " students" : "nobody in yet");
    S.stat.floors(r.travelled);
    S.stat.last(r.last === null ? "nobody yet" : hms(r.last));
    S.stat.reads(r.reads);
    var last = S.shown ? S.N.steps[S.shown - 1].t : SCENES[S.C.scene].open;
    api.clock = last;
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
    var r = tally(S, S.N.steps.length);
    return "Replayed " + SCENES[S.C.scene].label + " with " + SHORT[S.C.design] + ": " + r.dropped + (r.dropped === 1 ? " call" : " calls") + " dropped; longest wait " +
      (r.longest < 0 ? "none" : waitText(r.longest)) + "; total wait " + r.total + " s; " + r.travelled + " floors travelled" +
      (S.C.design === "poll" ? "; " + fmt(r.reads) + " button reads." : ".");
  }

  function replay(api) {
    var S = api.state;
    S.N = run(S.C.design, S.C.scene);
    S.shown = 0;
    showTo(api, S.N.steps.length);
    var r = tally(S, S.N.steps.length);
    api.log(summary(S), r.dropped ? "bad" : "ok");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { scene: "night", design: "built" };
      S.N = run(S.C.design, S.C.scene);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.scene = api.control.select("scene", "scene", SCENE_OPTS, "night", function (v) {
        var o = pick(SCENE_OPTS, v);
        if (!o) return;
        S.C.scene = String(o.value);
        replay(api);
      });
      S.ctl.design = api.control.select("design", "design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "play the rest", function () {
        showTo(api, S.N.steps.length);
        var r = tally(S, S.N.steps.length);
        api.log(summary(S), r.dropped ? "bad" : "ok");
        draw(api);
      });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        state: api.stat("state", "lift's state", ""),
        floor: api.stat("floor", "lift at floor", ""),
        list: api.stat("list", "list of stops", ""),
        dropped: api.stat("dropped", "calls dropped", "bad"),
        yev: api.stat("yev", "floor 6's wait (night)", "warn"),
        longest: api.stat("longest", "longest wait for the lift", "warn"),
        total: api.stat("total", "all waits added up", ""),
        floors: api.stat("floors", "floors travelled", ""),
        last: api.stat("last", "last student at floor 1", ""),
        reads: api.stat("reads", "button reads by the loop", "")
      };

      api.info("<strong>how to read it.</strong> The shaft shows floors 1 to 8: a filled dot is a lit call button, and the box is the lift, " +
        "labelled with its state. The table has a row for each state and a column for each event; each square says what the program does. " +
        "A dot in a square means the program does nothing there. The square the last step used is outlined. A wait runs from a press until " +
        "the doors finish opening at that floor. step moves one step; play the rest runs to the end.");

      api.clock = SCENES.night.open;
      api.log("02:13:30. The lift is idle at floor 4. Replaying wednesday night with the program as built. Press step or play the rest.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the first press: idle at floor 4, nothing dropped, nobody waiting.
      t.expect(t.stat("state") === "idle" && t.stat("floor") === 4 && t.stat("dropped") === 0 && t.stat("list") === "empty" &&
        t.stat("yev") === "not pressed yet" && has("02:13:30. The lift is idle at floor 4."),
        "Opens at 02:13:30 before the first press: idle at floor 4, list empty");

      // 2. First step: Ofeliya's press at floor 4, where the lift is idle.
      t.click("step");
      t.expect(has("02:13:40 · idle · Ofeliya presses the call button on floor 4: the lift is here, so the doors start opening.") &&
        t.stat("state") === "doors opening",
        "02:13:40: a call where the idle lift stands opens the doors");

      // 3. Play the night as built: the press at 02:14:09 lands in doors closing and is dropped.
      t.click("play");
      t.expect(has("02:14:09 · doors closing · Zlatoslava presses the call button on floor 6: no reaction: the call is dropped, and the light stays on.") &&
        has("02:14:10 · doors closing · doors shut: the list is empty, so the lift goes idle at floor 1.") &&
        has("02:25:10 · idle · Zlatoslava presses the call button on floor 6 again: added to the list; it sets off up for floor 6.") &&
        t.stat("dropped") === 1 && t.stat("yev") === "683 s (11 min 23 s)",
        "As built: the call is dropped at 02:14:09, the lift idles at floor 1 until 02:25:10, and floor 6 waits 683 s");

      // 4. Restart every 10 minutes: the restart at 02:20:00 finds an empty list.
      t.set("design", "restart");
      t.expect(has("02:20:00 · idle · restart: the program starts again with an empty list; the light on floor 6 is still on.") &&
        t.stat("dropped") === 1 && t.stat("yev") === "683 s (11 min 23 s)",
        "Restart: nothing to bring back; the wait is still 683 s");

      // 5. Order pressed: the hole is untouched.
      t.set("design", "order");
      var o1 = t.stat("dropped") === 1 && t.stat("yev") === "683 s (11 min 23 s)";

      // 6. The loop: no call lost, each press read a second later.
      t.set("design", "poll");
      var p1 = has("02:14:10 · doors closing · the loop reads the buttons: floor 6 is lit and not listed: kept on the list for when the doors have shut.") &&
        t.stat("dropped") === 0 && t.stat("yev") === "24 s";
      t.expect(o1 && p1, "The order pressed still drops the call (683 s); the loop keeps it and floor 6 waits 24 s");

      // 7. The full table: the call is kept and floor 6 waits 23 s.
      t.set("design", "table");
      t.expect(has("02:14:09 · doors closing · Zlatoslava presses the call button on floor 6: kept on the list for when the doors have shut.") &&
        has("02:14:32 · doors opening · doors opened at floor 6: Zlatoslava gets in after 23 s.") &&
        t.stat("dropped") === 0 && t.stat("yev") === "23 s",
        "Full table: the call at 02:14:09 is kept; the doors open on floor 6 at 02:14:32, 23 s after the press");

      // 8. The morning, as built: the student on floor 8 waits 135 s.
      t.set("design", "built");
      t.set("scene", "rush");
      t.expect(t.stat("longest") === "135 s (2 min 15 s)" && t.stat("total") === "423 s, 7 students" && t.stat("floors") === 24 &&
        t.stat("last") === "08:43:59" && t.stat("dropped") === 0,
        "Morning as built: longest 135 s, 423 s in all, 24 floors, last at floor 1 at 08:43:59");

      // 9. The morning, order pressed.
      t.set("design", "order");
      t.expect(t.stat("longest") === "113 s (1 min 53 s)" && t.stat("total") === "538 s, 7 students" && t.stat("floors") === 26 &&
        t.stat("last") === "08:43:58",
        "Morning in the order pressed: longest 113 s, 538 s in all, 26 floors");

      // 10. The morning, the loop: a second later on every read.
      t.set("design", "poll");
      t.expect(t.stat("longest") === "136 s (2 min 16 s)" && t.stat("total") === "430 s, 7 students" && t.stat("floors") === 24 &&
        t.stat("dropped") === 0,
        "Morning with the loop: longest 136 s, 430 s in all");

      // 11. The morning, one way then back.
      t.set("design", "table");
      t.expect(t.stat("longest") === "56 s" && t.stat("total") === "245 s, 7 students" && t.stat("floors") === 14 &&
        t.stat("last") === "08:43:01" && t.stat("dropped") === 0,
        "Morning, one way then back: longest 56 s, 245 s in all, 14 floors, everyone at floor 1 by 08:43:01");
    }
  });
})();
