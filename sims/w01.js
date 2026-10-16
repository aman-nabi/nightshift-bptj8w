/* sims/w01-v1.0.0.js  (published as sims/w01.js)
   Workshop case w01 "The Car Park That Lied": a workbench for Abbotsmere Hospital's staff car park
   barrier program, finished by Odgerel from Winifrith Torvaine's work order. Five levels of 60 bays,
   the 19:00 to 19:40 shift change, nine arrivals replayed one at a time.
   Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the design (as built, a charging branch added to the level's
     count, a subclass per level's mix of bays, one shared table, each bay answers fits() with a
     swappable search order), the search order (nearest the lifts, the night order; from the top,
     the day order), a later change (none; the night rule made in every copy; the night rule made
     in the count only; six charging bays added on level 1), Step, Play the shift change, Reset.
     Shows each level's board figure next to the bays the gate would really give a petrol car.
     Stats: the board, bays the gate would give a petrol car, levels where the board is wrong,
     cars turned away, what the 19:40 car got, motorbike bays free, places to edit for the night
     rule. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Bays: every level has bays 1 to 60. Level 1: 1 to 50 ordinary, 51 to 60 motorbike. Level 2:
     1 to 44 ordinary, 45 to 60 charging. Levels 3, 4 and 5: all ordinary. 300 bays.
   - The gate's rule (Gate.pickBay): a motorbike bay fits only a motorbike; an ordinary bay fits a
     petrol or electric car; a charging bay fits only an electric car (with the night rule: any car).
     The gate tries levels in the search order and, on each level, empty bays in number order, and
     sends the vehicle to the first one that fits. None fits: CAR PARK FULL.
   - The board's car figure per level, by design:
       built     Level.freeBays: every empty bay that is not a motorbike bay is a car bay.
       branch    the count gets a charging branch: charging bays are not car bays
                 (with the night rule made in the count: they are).
       subclass  level 1 is a MotorbikeLevel and levels 3 to 5 plain Levels, both with the older
                 count; level 2 is a ChargingLevel whose count treats charging bays like "branch".
       table     both the gate and the count read one shared table; its night column is read by
                 whichever reader was taught it.
       bays      each bay class answers fits(vehicle); the count asks each empty bay fits(a car),
                 so it always matches the gate.
   - Later changes: "every": the night rule (from 19:00 to 07:00 a charging bay takes any car) made
     in every place the design keeps the rule. "count": the night rule made in the count only (in
     "bays" there is one place, so it is the same as "every"). "l1charge": level 1 bays 45 to 50
     become charging bays, empty at 19:00.
   - Places to edit for the night rule: built 2 (gate, count), branch 2 (gate, count), subclass 2
     (gate, ChargingLevel), table 3 (the table, the gate's reader, the count's reader), bays 1
     (ChargingBay.fits).

   Where every number comes from (conventions rule 14; the case is content/s5/w01-v1.0.0.json).
   Given data, Thursday 15 October 2026 at 19:00 (the replay opens here, before the first arrival):
   - Empty at 19:00: level 1 motorbike bays 57 to 60 (4); level 2 ordinary bays 23 and 41, and all
     16 charging bays, 45 to 60 (none used since they opened at noon); level 4 bays 37, 52 and 58.
     Every other bay is taken. So 5 bays fit a petrol car at 19:00, and the board as built reads
     L1 0 · L2 18 · L3 0 · L4 3 · L5 0 (level 2: 2 ordinary + 16 charging).
   - Arrivals: 19:04:12 pass 1187 petrol car; 19:09:40 pass 2650 petrol; 19:15:03 pass 3302
     motorbike; 19:21:26 pass 0954 electric; 19:26:51 pass 4019 petrol; 19:31:07 pass 4471 petrol;
     19:33:48 pass 0817 electric; 19:35:52 pass 2208 petrol; 19:40:14 pass 3390 petrol (Cliodhna).
   - As built, nearest the lifts: 1187 to level 2 bay 23, 2650 to level 2 bay 41, 3302 to level 1
     bay 57, 0954 to level 2 bay 45, 4019 to level 4 bay 37, 4471 to level 4 bay 52, 0817 to level 2
     bay 46, 2208 to level 4 bay 58, 3390 turned away. The board at 19:40: L1 0 · L2 14 · L3 0 ·
     L4 0 · L5 0 (16 - 2 = 14 empty charging bays), motorbikes 3 (4 - 1). 1 turned away.
   - Every other design, no change: the same bays; the board reads 0 on every level; 1 turned away.
   - From the top: 0954 takes level 4 bay 58 (an ordinary bay), so 2208 at 19:35:52 and 3390 at
     19:40:14 are both turned away: 2.
   - Night rule everywhere (or "bays"): 4019, 4471, 2208 and 3390 go to level 2 bays 46, 47, 49
     and 50, 0817 to bay 48; nobody is turned away; the board at 19:40 reads L2 10 · L4 3.
   - Night rule in the count only ("branch", "subclass", "table"): the gate keeps electric only, so
     the bays are as built and the board reads L2 14 again; 3390 is turned away.
   - Six charging bays on level 1: the electric cars take level 1 bays 45 and 46; level 1's
     MotorbikeLevel count shows 4 (47 to 50) in "subclass"; 3390 is turned away.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  function at(h, m, s) { return h * 3600 + m * 60 + s; }
  var OPEN = at(19, 0, 0);

  var ARRIVALS = [
    { t: at(19, 4, 12), pass: "1187", v: "car" },
    { t: at(19, 9, 40), pass: "2650", v: "car" },
    { t: at(19, 15, 3), pass: "3302", v: "motorbike" },
    { t: at(19, 21, 26), pass: "0954", v: "electric" },
    { t: at(19, 26, 51), pass: "4019", v: "car" },
    { t: at(19, 31, 7), pass: "4471", v: "car" },
    { t: at(19, 33, 48), pass: "0817", v: "electric" },
    { t: at(19, 35, 52), pass: "2208", v: "car" },
    { t: at(19, 40, 14), pass: "3390", v: "car" }
  ];
  var VNAME = { car: "petrol car", electric: "electric car", motorbike: "motorbike" };

  var DESIGNS = [
    { value: "built", label: "As built: branches in the gate, the older rule in the count" },
    { value: "branch", label: "A charging branch added to the level's count" },
    { value: "subclass", label: "A subclass per level's mix of bays, each with its own count" },
    { value: "table", label: "One shared table, read by the gate and the count" },
    { value: "bays", label: "Each bay answers fits(vehicle); the search order is a strategy" }
  ];
  var SHORT = {
    built: "as built", branch: "a charging branch in the count", subclass: "a subclass per level",
    table: "one shared table", bays: "each bay answers fits()"
  };
  var ORDERS = [
    { value: "lifts", label: "Nearest the lifts first (the night order)" },
    { value: "top", label: "From the top level down (the day order)" }
  ];
  var CHANGES = [
    { value: "none", label: "None: Thursday 15 October as it was" },
    { value: "every", label: "Night rule, made in every place the rule lives" },
    { value: "count", label: "Night rule, made in the count only" },
    { value: "l1charge", label: "Six charging bays added on level 1 (bays 45 to 50)" }
  ];
  var PLACES = { built: 2, branch: 2, subclass: 2, table: 3, bays: 1 };

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model ---------- */

  function buildLevels(C) {
    var L = [];
    for (var n = 1; n <= 5; n++) {
      var bays = [];
      for (var b = 1; b <= 60; b++) {
        var kind = "ordinary";
        if (n === 1 && b >= 51) kind = "motorbike";
        if (n === 2 && b >= 45) kind = "charging";
        if (n === 1 && C.change === "l1charge" && b >= 45 && b <= 50) kind = "charging";
        var empty = (n === 1 && b >= 57) || (n === 1 && kind === "charging") ||
          (n === 2 && (b === 23 || b === 41 || kind === "charging")) ||
          (n === 4 && (b === 37 || b === 52 || b === 58));
        bays.push({ no: b, kind: kind, taken: !empty });
      }
      L.push({ n: n, bays: bays });
    }
    return L;
  }

  function nightInGate(C) { return C.change === "every" || (C.change === "count" && C.design === "bays"); }
  function nightInCount(C) { return C.change === "every" || C.change === "count"; }

  // Gate.pickBay's rule; in "bays" it is ChargingBay.fits and the rest.
  function gateFits(C, bay, v) {
    if (bay.kind === "motorbike") return v === "motorbike";
    if (v === "motorbike") return false;
    if (bay.kind === "charging") return v === "electric" || nightInGate(C);
    return true;
  }

  // What the level's count calls a free car bay.
  function countsAsCar(C, level, bay) {
    if (C.design === "bays") return gateFits(C, bay, "car");
    if (bay.kind === "motorbike") return false;
    if (bay.kind === "ordinary") return true;
    if (C.design === "built") return true;
    if (C.design === "subclass" && level.n !== 2) return true;
    return nightInCount(C);
  }

  function snapshot(C, L) {
    var board = [], truth = [], wrong = 0, free = 0, moto = 0;
    L.forEach(function (lv) {
      var b = 0, t = 0;
      lv.bays.forEach(function (bay) {
        if (bay.taken) return;
        if (countsAsCar(C, lv, bay)) b += 1;
        if (gateFits(C, bay, "car")) t += 1;
        if (bay.kind === "motorbike") moto += 1;
      });
      board.push(b);
      truth.push(t);
      free += t;
      if (b !== t) wrong += 1;
    });
    var text = board.map(function (b, i) { return "L" + (i + 1) + " " + b; }).join(" · ");
    return { board: board, truth: truth, text: text, wrong: wrong, free: free, moto: moto };
  }

  function night(C) {
    var L = buildLevels(C);
    var order = C.order === "top" ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
    var steps = [];
    ARRIVALS.forEach(function (a) {
      var got = null;
      for (var i = 0; i < order.length && !got; i++) {
        var lv = L[order[i]];
        for (var j = 0; j < lv.bays.length; j++) {
          var bay = lv.bays[j];
          if (!bay.taken && gateFits(C, bay, a.v)) { bay.taken = true; got = { level: lv.n, bay: bay.no, kind: bay.kind }; break; }
        }
      }
      var snap = snapshot(C, L);
      var msg = hms(a.t) + " pass " + a.pass + ", " + VNAME[a.v] + ": " +
        (got ? "the gate sends it to level " + got.level + ", bay " + got.bay + " (" + got.kind + ")." :
          "no empty bay fits. The barrier shows CAR PARK FULL.") +
        " The board now reads " + snap.text + ".";
      steps.push({ t: a.t, a: a, got: got, snap: snap, msg: msg,
        tone: got ? (snap.wrong ? "warn" : "ok") : "bad" });
    });
    return { start: snapshot(C, buildLevels(C)), steps: steps };
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
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["level", "bays", "board says", "gate would give a petrol car", "board"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    var last = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(last);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, last: last };
  }

  var MIX = {
    1: "1-50 ordinary, 51-60 motorbike", 2: "1-44 ordinary, 45-60 charging",
    3: "1-60 ordinary", 4: "1-60 ordinary", 5: "1-60 ordinary"
  };

  function current(S) { return S.shown ? S.N.steps[S.shown - 1].snap : S.N.start; }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var snap = current(S);
    var away = 0, lastCar = "not yet";
    for (var i = 0; i < S.shown; i++) {
      var s = S.N.steps[i];
      if (!s.got) away += 1;
      if (s.a.pass === "3390") lastCar = s.got ? "level " + s.got.level + ", bay " + s.got.bay : "turned away";
    }
    S.ui.head.textContent = "Design: " + SHORT[C.design] + ". Order: " + pick(ORDERS, C.order).label +
      ". Change: " + pick(CHANGES, C.change).label + ". Arrivals shown: " + S.shown + " of " + S.N.steps.length + ".";
    clear(S.ui.tbody);
    for (var n = 1; n <= 5; n++) {
      var tr = S.ui.el("tr");
      var mix = n === 1 && C.change === "l1charge" ? "1-44 ordinary, 45-50 charging, 51-60 motorbike" : MIX[n];
      var b = snap.board[n - 1], t = snap.truth[n - 1];
      [String(n), mix, String(b), String(t), b === t ? "right" : "WRONG"].forEach(function (c) {
        tr.appendChild(S.ui.el("td", "", c));
      });
      S.ui.tbody.appendChild(tr);
    }
    S.ui.last.textContent = S.shown ? S.N.steps[S.shown - 1].msg : "19:00:00. Nobody has arrived yet.";
    S.stat.board(snap.text);
    S.stat.free(snap.free);
    S.stat.wrong(snap.wrong);
    S.stat.away(away);
    S.stat.last(lastCar);
    S.stat.moto(snap.moto);
    S.stat.places(PLACES[C.design]);
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
    var away = 0;
    S.N.steps.forEach(function (s) { if (!s.got) away += 1; });
    var end = S.N.steps[S.N.steps.length - 1].snap;
    return "Shift change replayed with " + SHORT[S.C.design] + ": " + away + " turned away; at 19:40 the board reads " +
      end.text + ", wrong on " + end.wrong + " level" + (end.wrong === 1 ? "" : "s") + ".";
  }

  function replay(api) {
    var S = api.state;
    S.N = night(S.C);
    S.shown = 0;
    showTo(api, S.N.steps.length);
    var end = S.N.steps[S.N.steps.length - 1].snap;
    api.log(summary(S), end.wrong ? "bad" : "ok");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", order: "lifts", change: "none" };
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
      S.ctl.order = api.control.select("order", "Search order (the strategy)", ORDERS, "lifts", function (v) {
        var o = pick(ORDERS, v);
        if (!o) return;
        S.C.order = String(o.value);
        replay(api);
      });
      S.ctl.change = api.control.select("change", "A later change", CHANGES, "none", function (v) {
        var o = pick(CHANGES, v);
        if (!o) return;
        S.C.change = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Play the shift change", function () {
        showTo(api, S.N.steps.length);
        var end = S.N.steps[S.N.steps.length - 1].snap;
        api.log(summary(S), end.wrong ? "bad" : "ok");
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        board: api.stat("board", "the entrance board, free car bays per level", "warn"),
        free: api.stat("free", "bays the gate would give a petrol car", ""),
        wrong: api.stat("wrong", "levels where the board is wrong", "bad"),
        away: api.stat("away", "cars turned away", "bad"),
        last: api.stat("last", "what the 19:40 car got", "warn"),
        moto: api.stat("moto", "motorbike bays free", ""),
        places: api.stat("places", "places to edit for the night rule", "")
      };

      api.info("<strong>How to read it.</strong> Each arrival taps a pass; the gate tries the levels in the search order " +
        "and each empty bay in number order, and sends the vehicle to the first bay that fits it. The table shows, " +
        "for each level, what the entrance board says and how many bays the gate would really give a petrol car. " +
        "A level where those differ is a board that lies. Step moves one arrival; Play runs the rest.");

      api.log("19:00:00. Nine arrivals are due before 19:41; the last, at 19:40:14, is Cliodhna's petrol car. Press Step or Play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      // Every line checked below is among the log's last 14 lines.
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 19:00, before the first arrival.
      t.expect(t.stat("board") === "L1 0 · L2 18 · L3 0 · L4 3 · L5 0" && t.stat("free") === 5 &&
        t.stat("wrong") === 1 && t.stat("away") === 0 && t.stat("moto") === 4 && t.stat("last") === "not yet" &&
        has("Nine arrivals are due before 19:41"),
        "Opens at 19:00:00: 5 bays fit a petrol car, the board says 18 on level 2");

      // 2. Four steps: the first electric car takes a charging bay on level 2.
      for (var i = 0; i < 4; i++) t.click("step");
      t.expect(has("19:21:26 pass 0954, electric car: the gate sends it to level 2, bay 45 (charging). The board now reads L1 0 · L2 15 · L3 0 · L4 3 · L5 0.") &&
        t.stat("moto") === 3 && t.stat("free") === 3,
        "19:21:26: the electric car takes level 2 bay 45; the board still counts 15 on level 2");

      // 3. The rest of the shift change, as built.
      t.click("play");
      t.expect(has("19:40:14 pass 3390, petrol car: no empty bay fits. The barrier shows CAR PARK FULL. The board now reads L1 0 · L2 14 · L3 0 · L4 0 · L5 0.") &&
        t.stat("away") === 1 && t.stat("free") === 0 && t.stat("wrong") === 1 && t.stat("last") === "turned away" &&
        t.stat("places") === 2,
        "As built: at 19:40:14 the board says 14 on level 2 and the gate turns Cliodhna away");

      // 4. A charging branch in the count: the board is right tonight.
      t.set("design", "branch");
      t.expect(t.stat("board") === "L1 0 · L2 0 · L3 0 · L4 0 · L5 0" && t.stat("wrong") === 0 && t.stat("away") === 1 &&
        t.stat("places") === 2, "Branch: the board reads 0 everywhere at 19:40; the car park was full");

      // 5. Subclass and table are right tonight too; they differ in places to edit.
      t.set("design", "subclass");
      var sub = t.stat("wrong") === 0 && t.stat("places") === 2;
      t.set("design", "table");
      t.expect(sub && t.stat("wrong") === 0 && t.stat("places") === 3 && t.stat("away") === 1,
        "Subclass and table: right tonight; 2 and 3 places to edit for the night rule");

      // 6. Each bay answers: right tonight, one place to edit.
      t.set("design", "bays");
      t.expect(t.stat("wrong") === 0 && t.stat("places") === 1 && t.stat("away") === 1 && t.stat("last") === "turned away",
        "Bays answer: the board matches the gate; 1 place to edit");

      // 7. The night rule in one place: nobody turned away, the board agrees.
      t.set("change", "every");
      var e1 = t.stat("last") === "level 2, bay 50" && t.stat("away") === 0 && t.stat("wrong") === 0 &&
        t.stat("board") === "L1 0 · L2 10 · L3 0 · L4 3 · L5 0";
      t.set("change", "count");
      t.expect(e1 && t.stat("last") === "level 2, bay 50" && t.stat("wrong") === 0,
        "Night rule with bays answering: the 19:40 car goes to level 2 bay 50, in every case");

      // 8. The night rule made in the count only, with a branch: the same lie as Thursday.
      t.set("design", "branch");
      t.expect(t.stat("board") === "L1 0 · L2 14 · L3 0 · L4 0 · L5 0" && t.stat("wrong") === 1 &&
        t.stat("last") === "turned away" && t.stat("away") === 1,
        "Branch, night rule in the count only: the board says 14 on level 2 and the gate says full");

      // 9. Six charging bays on level 1: a subclass per mix lies on level 1; the branch does not.
      t.set("change", "l1charge");
      var br = t.stat("wrong") === 0;
      t.set("design", "subclass");
      t.expect(br && t.stat("board") === "L1 4 · L2 0 · L3 0 · L4 0 · L5 0" && t.stat("wrong") === 1 && t.stat("away") === 1 &&
        has("19:21:26 pass 0954, electric car: the gate sends it to level 1, bay 45 (charging)."),
        "Charging bays on level 1: the MotorbikeLevel count shows 4 free on level 1 while the gate says full");

      // 10. The search order is a choice: from the top, an electric car takes an ordinary bay.
      t.set("change", "none");
      t.set("design", "bays");
      t.set("order", "top");
      t.expect(t.stat("away") === 2 && t.stat("wrong") === 0 &&
        has("19:21:26 pass 0954, electric car: the gate sends it to level 4, bay 58 (ordinary).") &&
        has("19:35:52 pass 2208, petrol car: no empty bay fits."),
        "From the top: the 19:21 electric car takes level 4 bay 58, and 2 petrol cars are turned away");
    }
  });
})();
