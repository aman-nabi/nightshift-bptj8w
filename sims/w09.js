/* sims/w09-v1.0.0.js  (published as sims/w09.js)
   Workshop case w09 "Castling Twice": a workbench for the rules program of Winifrith Torvaine's
   chess automaton, finished by Odgerel and played by the Fernihough Chess Club on Thursday nights.
   Widget-style sim: it draws its own table inside api.root. No chess engine: the sim holds only
   the moves that touch a king or castling, and takes every other castling test as given.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the game (Thursday 8 October, Euphrosyne against the figure;
     Thursday 22 October, Zinovy against the figure), the design (as built, read back the last 10
     moves, read back the last 30 moves, replay from move 1 for every question, castling switched
     off for the figure, rights to castle kept in the game's state), Step, Play the game, Reset.
     Stats: where the kings stand, rights to castle as the design keeps them, illegal moves played,
     legal castles refused, single moves read for the last castling question, replay time for that
     turn, the arbiter. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Moves are numbered in pairs, white then black. Before white's move n come 2n - 2 single moves;
     before black's move n, 2n - 1.
   - At every castling question in the data the rook stands on its corner (h8 or h1), the squares
     between are empty, and no square the king stands on, crosses or reaches is attacked. So the
     board tests in canCastle all pass whenever the king stands on its start square (e8 or e1).
   - The Laws: castling is legal only if that side's king has never moved (no rook moves in the data).
   - Designs at a castling question:
       built   the board tests only.
       last10  the board tests, and no king or rook move by that side on tape lines n - 10 to n - 1.
       last30  the same with lines n - 30 to n - 1 (from line 1 at most). Lines read x 2 = single moves read.
       replay  replays every single move before this one, once per question: right by the Laws.
               The figure asks 30 questions a turn; a member's move is 1 question. 5 ms a single move.
       ban     the figure may never castle; a member's castling is judged by the board tests.
       rights  four rights to castle in the game's state, two a side, all held at the start; a king
               move (castling included) clears both of its side's. The question reads the right.
   - Outcomes: the figure castles if the design says yes, else plays another move. A member's castle
     the design accepts is played and answered; one it refuses lights the red lamp and is taken back.
     An illegal move played stops the game: the arbiter, Erconwald, reads it on the scoresheet.

   Where every number comes from (conventions rule 14; the case is content/s5/w09-v1.0.0.json).
   Given data: the game opens at 21:30:00; the events below; 30 questions a turn; 5 ms a single move.
   - 8 October: 21:51:40 move 9 black king e8-f8 (after Euphrosyne's bishop c4-b5 check);
     21:56:02 move 11 black king f8-e8; 22:47:13 move 31 the figure asks to castle king side.
     built: yes, illegal (king moved at move 9), game stopped at move 31. 1 illegal.
     last10: lines 21 to 30, 20 single moves read, no king move found: castles, 1 illegal.
     last30: lines 1 to 30, 60 single moves read, king move at move 9 found: refused, 0 illegal.
     replay: 2 x 31 - 1 = 61 single moves a question, 30 x 61 x 5 = 9,150 ms that turn: refused.
       At move 60: 30 x 119 x 5 = 17,850 ms. A 60-move game: 30 x 5 x (1 + 3 + ... + 119)
       = 150 x 3,600 = 540,000 ms, 9 minutes.
     ban: the figure may not castle: plays another move, 0 illegal, 0 legal refused.
     rights: move 9 clears black's two rights (white 2, black 0); move 31: no right, refused.
   - 22 October: 21:36:10 move 4 white king e1-f1 (after the figure's bishop f8-b4 check);
     21:37:45 move 5 white king f1-e1; 21:41:20 move 7 the figure asks to castle (legal);
     22:58:30 move 38 Zinovy castles (illegal: white king moved at move 4).
     built, last10 (lines 28 to 37), last30 (lines 8 to 37, 60 single moves): the figure castles
       at move 7, Zinovy's castle accepted at move 38, game stopped, 1 illegal.
     ban: the figure's legal castle at move 7 refused (1 legal refused); Zinovy's accepted, 1 illegal.
     replay: move 7 replays 13 single moves (30 x 13 x 5 = 1,950 ms); move 38 replays 74 single
       moves for 1 question, 370 ms; refused, red lamp. 0 illegal.
     rights: move 4 clears white's (white 0, black 2); the figure castles at move 7, which clears
       black's (white 0, black 0); move 38 refused, red lamp. 0 illegal.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  function at(h, m, s) { return h * 3600 + m * 60 + s; }
  var OPEN = at(21, 30, 0);
  var QUESTIONS = 30;   // the figure's questions a turn
  var MS = 5;           // ms to replay one single move

  var GAMES = [
    {
      value: "oct8", label: "Thursday 8 October: Euphrosyne (white) against the figure (black)",
      member: "Euphrosyne",
      events: [
        { t: at(21, 51, 40), n: 9, side: "b", kind: "king", from: "e8", to: "f8", why: "after Euphrosyne's bishop c4-b5 gives check" },
        { t: at(21, 56, 2), n: 11, side: "b", kind: "king", from: "f8", to: "e8", why: "" },
        { t: at(22, 47, 13), n: 31, side: "b", kind: "castle" }
      ]
    },
    {
      value: "oct22", label: "Thursday 22 October: Zinovy (white) against the figure (black)",
      member: "Zinovy",
      events: [
        { t: at(21, 36, 10), n: 4, side: "w", kind: "king", from: "e1", to: "f1", why: "after the figure's bishop f8-b4 gives check" },
        { t: at(21, 37, 45), n: 5, side: "w", kind: "king", from: "f1", to: "e1", why: "" },
        { t: at(21, 41, 20), n: 7, side: "b", kind: "castle" },
        { t: at(22, 58, 30), n: 38, side: "w", kind: "castle" }
      ]
    }
  ];

  var DESIGNS = [
    { value: "built", label: "as built: canCastle reads the board only" },
    { value: "last10", label: "read back the last 10 moves on the tape" },
    { value: "last30", label: "read back the last 30 moves on the tape" },
    { value: "replay", label: "replay the game from move 1 for every question" },
    { value: "ban", label: "castling switched off for the figure" },
    { value: "rights", label: "rights to castle kept in the game's state" }
  ];

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function colour(side) { return side === "w" ? "white" : "black"; }
  function rightsText(r) { return "white " + r.w + ", black " + r.b; }
  function before(ev) { return ev.side === "w" ? 2 * ev.n - 2 : 2 * ev.n - 1; }

  /* ---------- the model: one game, as a list of steps ---------- */

  function run(C) {
    var g = pick(GAMES, C.game);
    var king = { w: "e1", b: "e8" };
    var firstMove = { w: 0, b: 0 };
    var kingMoves = { w: [], b: [] };
    var rights = { w: 2, b: 2 };
    var steps = [];
    var stopped = 0;

    function kingMoved(side, n, to) {
      king[side] = to;
      kingMoves[side].push(n);
      if (!firstMove[side]) firstMove[side] = n;
      if (C.design === "rights" && rights[side]) {
        rights[side] = 0;
        return " The game's state clears " + colour(side) + "'s rights to castle: " + rightsText(rights) + ".";
      }
      return "";
    }

    g.events.forEach(function (ev) {
      if (stopped) return;
      var s = { t: ev.t, n: ev.n, side: ev.side, kind: ev.kind, illegal: 0, refused: 0, read: null, cost: null, tone: "" };
      var head = hms(ev.t) + " move " + ev.n + ": ";
      if (ev.kind === "king") {
        var note = kingMoved(ev.side, ev.n, ev.to);
        s.msg = head + colour(ev.side) + " king " + ev.from + "-" + ev.to + (ev.why ? " (" + ev.why + ")" : "") + "." + note;
        s.answer = "-";
        s.law = "-";
        s.result = "king " + ev.from + "-" + ev.to;
      } else {
        var home = ev.side === "w" ? "e1" : "e8";
        var corner = ev.side === "w" ? "h1" : "h8";
        var boardOk = king[ev.side] === home;
        var lawOk = !firstMove[ev.side];
        var who = ev.side === "w" ? g.member : "the figure";
        var yes, how;
        var boardHow = "canCastle finds the king on " + home + ", the rook on " + corner + ", the squares between empty and no check: " + (boardOk ? "yes" : "no");
        if (C.design === "built" || (C.design === "ban" && ev.side === "w")) {
          yes = boardOk; s.read = 0; how = boardHow;
        } else if (C.design === "last10" || C.design === "last30") {
          var w = C.design === "last10" ? 10 : 30;
          var from = Math.max(1, ev.n - w), to = ev.n - 1;
          var hit = 0;
          kingMoves[ev.side].forEach(function (m) { if (!hit && m >= from && m <= to) hit = m; });
          s.read = 2 * (to - from + 1);
          yes = boardOk && !hit;
          how = boardHow + "; it reads back moves " + from + " to " + to + " and finds " +
            (hit ? "the king's move at move " + hit + ": no" : "no king or rook move: yes");
        } else if (C.design === "replay") {
          var q = ev.side === "b" ? QUESTIONS : 1;
          s.read = before(ev);
          s.cost = q * s.read * MS;
          yes = lawOk;
          how = (q === 1 ? "the check replays" : "each of " + q + " questions replays") + " the " + s.read + " single moves before this one, " +
            fmt(s.cost) + " ms in all, and finds " + (lawOk ? "no king or rook move: yes" : "the king's move at move " + firstMove[ev.side] + ": no");
        } else if (C.design === "ban") {
          yes = false; s.read = 0; how = "castling is switched off for the figure: no";
        } else {
          s.read = 0;
          yes = rights[ev.side] > 0;
          how = "the game's state holds " + rightsText(rights) + ": " + (yes ? "yes" : "no right left, no");
        }
        var out;
        if (yes) {
          var note2 = kingMoved(ev.side, ev.n, ev.side === "w" ? "g1" : "g8");
          var cast = ev.side === "w" ? "king e1-g1, rook h1-f1" : "king e8-g8, rook h8-f8";
          if (lawOk) {
            out = (ev.side === "b" ? "The figure castles: " : "The figure accepts " + who + "'s castle: ") + cast + ". Legal." + note2;
            s.tone = "ok";
            s.result = "castled, legal";
          } else {
            s.illegal = 1;
            stopped = ev.n;
            out = (ev.side === "b" ? "The figure castles: " + cast : "The figure accepts " + who + "'s castle, " + cast + ", and replies") +
              ". Illegal: the " + colour(ev.side) + " king moved at move " + firstMove[ev.side] + ". Erconwald stops the game." + note2;
            s.tone = "bad";
            s.result = "ILLEGAL castle, game stopped";
          }
        } else if (ev.side === "b") {
          if (lawOk) {
            s.refused = 1;
            out = "Castling was legal, but it is not on the figure's list, so the figure plays another move.";
            s.tone = "warn";
            s.result = "legal castle refused";
          } else {
            out = "Castling is not on the figure's list, so the figure plays another move.";
            s.tone = "ok";
            s.result = "refused, rightly";
          }
        } else {
          if (lawOk) { s.refused = 1; s.result = "legal castle refused"; s.tone = "warn"; }
          else { s.result = "refused, rightly: red lamp"; s.tone = "ok"; }
          out = "The red lamp lights, and Erconwald has " + who + " take the move back.";
        }
        s.answer = yes ? "yes" : "no";
        s.law = lawOk ? "legal" : "illegal";
        s.msg = head + who + (ev.side === "b" ? " asks whether it may castle: " : " castles: ") + how + ". " + out;
      }
      s.kings = "white king " + king.w + " · black king " + king.b;
      s.rights = C.design === "rights" ? rightsText(rights) : "not kept";
      s.stopped = stopped;
      steps.push(s);
    });
    return { game: g, steps: steps };
  }

  // Totals over the first n steps.
  function tally(C, N, n) {
    var r = { illegal: 0, refused: 0, read: "none yet", cost: "none", kings: "white king e1 · black king e8",
      rights: C.design === "rights" ? "white 2, black 2" : "not kept", arbiter: "playing" };
    for (var i = 0; i < n && i < N.steps.length; i++) {
      var s = N.steps[i];
      r.illegal += s.illegal;
      r.refused += s.refused;
      r.kings = s.kings;
      r.rights = s.rights;
      if (s.read !== null) r.read = s.read;
      if (s.kind === "castle") r.cost = s.cost === null ? "none" : fmt(s.cost) + " ms";
      if (s.stopped) r.arbiter = "game stopped at move " + s.stopped;
    }
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
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["time", "move", "who", "the design says", "the laws say", "result"].forEach(function (h) {
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

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = tally(C, S.N, S.shown);
    S.ui.head.textContent = "game: " + S.N.game.label + ". design: " + pick(DESIGNS, C.design).label +
      ". steps shown: " + S.shown + " of " + S.N.steps.length + ".";
    clear(S.ui.tbody);
    for (var i = 0; i < S.shown; i++) {
      var s = S.N.steps[i];
      var tr = S.ui.el("tr");
      var who = s.side === "w" ? S.N.game.member : "the figure";
      [hms(s.t), String(s.n), who, s.answer, s.law, s.result].forEach(function (c) { tr.appendChild(S.ui.el("td", "", c)); });
      S.ui.tbody.appendChild(tr);
    }
    S.ui.last.textContent = S.shown ? S.N.steps[S.shown - 1].msg : hms(OPEN) + ". The game has not started.";
    S.stat.kings(r.kings);
    S.stat.rights(r.rights);
    S.stat.illegal(r.illegal);
    S.stat.refused(r.refused);
    S.stat.read(r.read);
    S.stat.cost(r.cost);
    S.stat.arbiter(r.arbiter);
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

  function summary(api) {
    var S = api.state;
    var r = tally(S.C, S.N, S.N.steps.length);
    var line = "Game replayed (" + pick(DESIGNS, S.C.design).label + "): " + r.illegal + " illegal move" +
      (r.illegal === 1 ? "" : "s") + " played, " + r.refused + " legal castle" + (r.refused === 1 ? "" : "s") + " refused.";
    api.log(line, r.illegal ? "bad" : (r.refused ? "warn" : "ok"));
    if (S.C.design === "replay") {
      api.log("At " + MS + " ms a single move and " + QUESTIONS + " questions a turn, the figure's turn at move 60 would spend " +
        fmt(QUESTIONS * 119 * MS) + " ms replaying; a 60-move game, " + fmt(QUESTIONS * MS * 3600) +
        " ms (9 minutes) of its clock.", "warn");
    }
  }

  function replay(api) {
    var S = api.state;
    S.N = run(S.C);
    S.shown = 0;
    showTo(api, S.N.steps.length);
    summary(api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { game: "oct8", design: "built" };
      S.N = run(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.game = api.control.select("game", "the game", GAMES, "oct8", function (v) {
        var o = pick(GAMES, v);
        if (!o) return;
        S.C.game = String(o.value);
        replay(api);
      });
      S.ctl.design = api.control.select("design", "the design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Play the game", function () {
        showTo(api, S.N.steps.length);
        summary(api);
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        kings: api.stat("kings", "where the kings stand", ""),
        rights: api.stat("rights", "rights to castle in the game's state", "ok"),
        illegal: api.stat("illegal", "illegal moves played", "bad"),
        refused: api.stat("refused", "legal castles refused", "warn"),
        read: api.stat("read", "single moves read for the last castling question", ""),
        cost: api.stat("cost", "replay time for that turn", "warn"),
        arbiter: api.stat("arbiter", "the arbiter", "")
      };

      api.info("<strong>How to read it.</strong> The sim holds only the moves that touch a king or castling. " +
        "At each castling question the design gives its answer, and the table sets it beside what the laws of chess say. " +
        "An illegal move played stops the game. Single moves read counts the moves, by either side, the design looked back through. " +
        "Step moves one event; Play runs the rest.");

      api.log(hms(OPEN) + ". " + S.N.game.label + ". The figure plays black. Press Step or Play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 21:30:00, before the first event.
      t.expect(t.stat("illegal") === 0 && t.stat("refused") === 0 && t.stat("rights") === "not kept" &&
        t.stat("kings") === "white king e1 · black king e8" && t.stat("arbiter") === "playing" && t.stat("read") === "none yet" &&
        has("21:30:00. Thursday 8 October: Euphrosyne (white) against the figure (black). The figure plays black."),
        "Opens at 21:30:00 on 8 October: no moves yet, both kings at home");

      // 2. One step: the black king steps out at move 9.
      t.click("step");
      t.expect(has("21:51:40 move 9: black king e8-f8 (after Euphrosyne's bishop c4-b5 gives check).") &&
        t.stat("kings") === "white king e1 · black king f8",
        "21:51:40, move 9: the black king leaves e8");

      // 3. The rest of the game, as built: the illegal castle at move 31.
      t.click("play");
      t.expect(has("21:56:02 move 11: black king f8-e8.") &&
        has("22:47:13 move 31: the figure asks whether it may castle: canCastle finds the king on e8, the rook on h8, the squares between empty and no check: yes. The figure castles: king e8-g8, rook h8-f8. Illegal: the black king moved at move 9. Erconwald stops the game.") &&
        t.stat("illegal") === 1 && t.stat("arbiter") === "game stopped at move 31" && t.stat("read") === 0,
        "As built: at 22:47:13 the board tests pass and the figure castles illegally");

      // 4. Read back the last 10 moves: moves 9 and 11 are too far back.
      t.set("design", "last10");
      t.expect(has("it reads back moves 21 to 30 and finds no king or rook move: yes. The figure castles") &&
        t.stat("illegal") === 1 && t.stat("read") === 20,
        "Last 10 moves: lines 21 to 30, 20 single moves, nothing found; castles again");

      // 5. The last 30 moves catch 8 October.
      t.set("design", "last30");
      t.expect(has("it reads back moves 1 to 30 and finds the king's move at move 9: no. Castling is not on the figure's list") &&
        t.stat("illegal") === 0 && t.stat("refused") === 0 && t.stat("read") === 60,
        "Last 30 moves: the king's move at move 9 is found; refused");

      // 6. ...but not 22 October: Zinovy's king moved 33 moves back.
      t.set("game", "oct22");
      t.expect(has("22:58:30 move 38: Zinovy castles: canCastle finds the king on e1, the rook on h1") &&
        has("it reads back moves 8 to 37 and finds no king or rook move: yes. The figure accepts Zinovy's castle, king e1-g1, rook h1-f1, and replies. Illegal: the white king moved at move 4. Erconwald stops the game.") &&
        t.stat("illegal") === 1 && t.stat("arbiter") === "game stopped at move 38" && t.stat("read") === 60,
        "Last 30 moves, 22 October: moves 8 to 37 read, Zinovy's illegal castle accepted at move 38");

      // 7. Castling switched off: the figure's legal castle refused, Zinovy's illegal one accepted.
      t.set("design", "ban");
      t.expect(has("21:41:20 move 7: the figure asks whether it may castle: castling is switched off for the figure: no. Castling was legal, but it is not on the figure's list") &&
        t.stat("refused") === 1 && t.stat("illegal") === 1 && t.stat("arbiter") === "game stopped at move 38",
        "Switched off: 1 legal castle refused at move 7; Zinovy's illegal castle still accepted");

      // 8. Switched off, 8 October: no castle at move 31.
      t.set("game", "oct8");
      t.expect(t.stat("illegal") === 0 && t.stat("refused") === 0 && t.stat("arbiter") === "playing",
        "Switched off, 8 October: nothing illegal, nothing legal refused");

      // 9. Replay from move 1: right, and 9,150 ms that turn.
      t.set("design", "replay");
      t.expect(has("each of 30 questions replays the 61 single moves before this one, 9,150 ms in all, and finds the king's move at move 9: no.") &&
        has("the figure's turn at move 60 would spend 17,850 ms replaying; a 60-move game, 540,000 ms (9 minutes) of its clock.") &&
        t.stat("illegal") === 0 && t.stat("read") === 61 && t.stat("cost") === "9,150 ms",
        "Replay: refused at move 31, 61 single moves a question, 9,150 ms; 17,850 ms at move 60");

      // 10. Replay, 22 October: the red lamp at move 38 after 74 single moves, 370 ms.
      t.set("game", "oct22");
      t.expect(has("22:58:30 move 38: Zinovy castles: the check replays the 74 single moves before this one, 370 ms in all, and finds the king's move at move 4: no. The red lamp lights, and Erconwald has Zinovy take the move back.") &&
        t.stat("illegal") === 0 && t.stat("refused") === 0 && t.stat("cost") === "370 ms",
        "Replay, 22 October: legal castle at move 7 played, Zinovy's refused with the red lamp");

      // 11. Rights in the state, 22 October.
      t.set("design", "rights");
      t.expect(has("21:36:10 move 4: white king e1-f1 (after the figure's bishop f8-b4 gives check). The game's state clears white's rights to castle: white 0, black 2.") &&
        has("22:58:30 move 38: Zinovy castles: the game's state holds white 0, black 0: no right left, no. The red lamp lights") &&
        t.stat("illegal") === 0 && t.stat("refused") === 0 && t.stat("rights") === "white 0, black 0",
        "Rights, 22 October: move 4 clears white's rights; the figure castles at 7; Zinovy refused at 38");

      // 12. Rights in the state, 8 October.
      t.set("game", "oct8");
      t.expect(has("The game's state clears black's rights to castle: white 2, black 0.") &&
        has("22:47:13 move 31: the figure asks whether it may castle: the game's state holds white 2, black 0: no right left, no. Castling is not on the figure's list, so the figure plays another move.") &&
        t.stat("illegal") === 0 && t.stat("read") === 0 && t.stat("arbiter") === "playing",
        "Rights, 8 October: move 9 clears black's rights; castling refused at move 31");
    }
  });
})();
