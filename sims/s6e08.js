/* sims/s6e08-v1.0.0.js  (published as sims/s6e08.js)
   Case s6e08 "Canary in the Mine": a rollout lab for the lamp room at Tolgarrick Colliery. Miners tap
   a tag on the lamp-room tablet going down (a tag-in) and coming up (a tag-out); the tally service,
   on ten servers (tally-01 to tally-10), keeps the board of who is underground. A new version of the
   tally has a bug in tag-out only. The learner picks the release slot (20:00 tonight or the usual
   13:30), the strategy (canary on tally-10, or blue-green), the canary or watch length, the
   promotion rule (by time, or by traffic on both paths) and the feature flag for the new tag-out
   code, then runs four hours one minute per tick, and can roll everything back by hand.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: release slot, strategy, length, promotion rule, tag-out flag,
     roll back now. Stats: time, servers on the new version, release, canary's own counts, tag-ins and
     tag-outs served by the new version, errors on each path, board, lamps out, ghosts.
     selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - Shifts are 10 hours, and each goes down 2 hours before the shift it relieves comes up:
     day shift 04:00 to 14:00 (44 miners), back shift 12:00 to 22:00 (43), night shift 20:00 to
     06:00 (40). So from 20:00 to 22:00, and from 12:00 to 14:00, the lamp room sees only tag-ins.
   - The cage carries 11 at a time. Night shift down: tag-ins at 20:01, 20:04, 20:07, 20:10
     (11, 11, 11, 7 = 40). Back shift up: tag-outs at 22:02, 22:05, 22:08, 22:11 (11, 11, 11, 10 = 43).
     Day shift up: tag-outs at 14:02, 14:05, 14:08, 14:11 (11 each = 44).
   - The window is the four hours from one hour before the release: 19:00 to 23:00 for the 20:00
     release, 12:30 to 16:30 for the 13:30 slot. One tick is one minute. Nothing has run when the
     sim opens; the release happens at the start of its own minute.
   - Taps are dealt to the ten servers in turn (round robin): the k-th tap of the window (from 0)
     goes to server k mod 10, so tally-10 (index 9) gets taps 9, 19, 29 ...
   - The tablet shows its green tick at once, before the server answers. The new version saves
     tag-ins correctly and fails every tag-out with an error (unless the tag-out flag is off, which
     sends tag-outs to the old code). A failed tag-out leaves the miner on the board: his lamp is
     back on the rack, so he is a ghost (board count minus lamps out).
   - Canary: tally-10 gets the new version at the release. Checks run at the end of each minute.
     Any error on the canary: it goes back to the old version (roll back). By time: promoted to all
     ten when the canary length has passed with no error. By traffic: promoted once the canary has
     served at least 3 tag-ins and 3 tag-outs with no error, however long that takes.
   - Blue-green: all ten switch to the new version at the release. During the watch length, any
     error switches all ten back; after it, nobody watches the release's errors.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e08-v1.0.0.json):
   - Opening at 19:00: board 43 (the back shift), lamps out 43, ghosts 0.
   - Tonight as built (20:00, canary by time, 1 hour): tally-10 serves taps 9, 19, 29, 39, all
     tag-ins: "4 in, 0 out, 0 errors". Promoted at 21:00. At 21:00: board 83, lamps 83. Tag-outs from
     22:02: all 43 fail, 43 errors on tag-out, 0 on tag-in. 23:00: board 83, lamps out 40, ghosts 43.
   - Option 1 (2 hours): promoted at 22:00, first tag-out 22:02: 43 ghosts.
   - Option 0 (blue-green, watch 1 hour): all ten new from 20:00, 40 tag-ins on the new version, no
     error in the watch hour, 43 ghosts.
   - Option 2 (by traffic): canary waits with 4 tag-ins and 0 tag-outs; tap 49 (the 10th tag-out,
     22:02) goes to tally-10 and fails; rolled back at 22:03; "4 in, 1 out, 1 error"; the other 42
     tag out on the old version. 23:00: board 41, lamps 40, ghosts 1.
   - Option 3 (more tests): no sim control; the rollout is unchanged, 43 ghosts.
   - The usual 13:30 slot (canary by time): opening board 87 (day 44 + back 43); tap 9 (14:02) goes
     to tally-10 and fails; rolled back at 14:03; 1 ghost; 16:30: board 44, lamps 43.
     Blue-green at 13:30: the whole first cage (11) fails at 14:02; all ten switched back at 14:03;
     11 ghosts.
   - Tag-out flag off (as built): promoted at 21:00, 0 errors, 0 ghosts.
   - Roll back at 23:00 after the record: all ten old, ghosts still 43 (a rollback changes code, not
     the board).
*/
(function () {
  "use strict";

  var SLOTS = {
    night: { label: "20:00 tonight (urgent)", release: 20 * 60, board: 43,
      ins: { 1201: 11, 1204: 11, 1207: 11, 1210: 7 }, outs: { 1322: 11, 1325: 11, 1328: 11, 1331: 10 } },
    day: { label: "13:30, the usual day slot", release: 13 * 60 + 30, board: 87,
      ins: {}, outs: { 842: 11, 845: 11, 848: 11, 851: 11 } }
  };
  var SERVERS = 10;
  var CANARY = 9;          // tally-10
  var SPAN = 240;          // four hours
  var NEED = 3;            // by traffic: 3 tag-ins and 3 tag-outs

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hm(m) { var x = ((m % 1440) + 1440) % 1440; return two(Math.floor(x / 60)) + ":" + two(x % 60); }
  function name(i) { return "tally-" + two(i + 1); }
  function errs(n) { return n + (n === 1 ? " error" : " errors"); }

  /* ---------- the model ---------- */

  function newRun(C) {
    var slot = SLOTS[C.slot];
    var ver = [];
    var per = [];
    for (var i = 0; i < SERVERS; i++) { ver.push("old"); per.push({ ins: 0, outs: 0, err: 0 }); }
    return {
      C: C, slot: slot, start: slot.release - 60, end: slot.release - 60 + SPAN, t: slot.release - 60,
      ver: ver, per: per, k: 0, phase: "waiting", at: -1,
      can: { ins: 0, outs: 0, err: 0 }, neu: { ins: 0, outs: 0 }, errIn: 0, errOut: 0,
      board: slot.board, lamps: slot.board, events: []
    };
  }

  function note(R, m, txt, tone) { R.events.push({ txt: hm(m) + " " + txt, tone: tone || "" }); }
  function newCount(R) { return R.ver.filter(function (v) { return v === "new"; }).length; }
  function setAll(R, v) { for (var i = 0; i < SERVERS; i++) R.ver[i] = v; }

  function tap(R, kind) {
    var s = R.k % SERVERS;
    R.k += 1;
    var isNew = R.ver[s] === "new";
    var fail = kind === "out" && isNew && R.C.flag;
    var onCanary = s === CANARY && R.phase === "canary";
    if (kind === "in") {
      R.lamps += 1; R.board += 1; R.per[s].ins += 1;
      if (isNew) R.neu.ins += 1;
      if (onCanary) R.can.ins += 1;
    } else {
      R.lamps -= 1; R.per[s].outs += 1;
      if (isNew) R.neu.outs += 1;
      if (onCanary) R.can.outs += 1;
      if (fail) { R.errOut += 1; R.per[s].err += 1; if (onCanary) R.can.err += 1; }
      else R.board -= 1;
    }
  }

  function step(R) {
    var m = R.t;
    var C = R.C;
    if (m === R.slot.release) {
      if (C.strategy === "bluegreen") {
        setAll(R, "new"); R.phase = "watch";
        note(R, m, "Blue-green: all ten servers switched to the new version at once.", "warn");
      } else {
        R.ver[CANARY] = "new"; R.phase = "canary";
        note(R, m, "Canary: tally-10 gets the new version; the other nine stay on the old.", "");
      }
    }
    var i;
    for (i = 0; i < (R.slot.ins[m] || 0); i++) tap(R, "in");
    for (i = 0; i < (R.slot.outs[m] || 0); i++) tap(R, "out");
    var len = Number(C.length) * 60;
    var next = m + 1;
    if (R.phase === "canary") {
      if (R.can.err > 0) {
        R.ver[CANARY] = "old"; R.phase = "rolledback"; R.at = next;
        note(R, next, "tally-10 logged an error on a tag-out: canary rolled back to the old version.", "bad");
      } else if (C.rule === "time" && next === R.slot.release + len) {
        setAll(R, "new"); R.phase = "promoted"; R.at = next;
        note(R, next, "Promoted to all ten: " + C.length + " h on the canary, " + R.can.ins + " tag-ins, " + R.can.outs + " tag-outs, no errors.", "warn");
      } else if (C.rule === "traffic" && R.can.ins >= NEED && R.can.outs >= NEED) {
        setAll(R, "new"); R.phase = "promoted"; R.at = next;
        note(R, next, "Promoted to all ten: the canary served " + R.can.ins + " tag-ins and " + R.can.outs + " tag-outs with no error.", "ok");
      }
    } else if (R.phase === "watch") {
      if (R.errOut + R.errIn > 0) {
        setAll(R, "old"); R.phase = "switchedback"; R.at = next;
        note(R, next, "Errors in the watch time: all ten switched back to the old version.", "bad");
      } else if (next === R.slot.release + len) {
        R.phase = "live";
        note(R, next, "Watch time over with no errors; nobody watches the release from now on.", "warn");
      }
    }
    R.t = next;
  }

  function phaseText(R) {
    return {
      waiting: "not released yet",
      canary: "canary on tally-10",
      promoted: "promoted at " + hm(R.at),
      rolledback: "canary rolled back at " + hm(R.at),
      watch: "all ten on new (blue-green)",
      live: "all ten on new (blue-green)",
      switchedback: "all ten switched back at " + hm(R.at),
      manual: "all ten rolled back at " + hm(R.at)
    }[R.phase];
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 200");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "dg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The ten tally servers, each marked old or new version, with the tag-ins, tag-outs and errors it has served; below, the board's count of miners underground against the lamps missing from the rack.");
    box.appendChild(head);
    box.appendChild(svg);
    api.root.appendChild(box);
    return { doc: doc, head: head, svg: svg };
  }

  function svgEl(ui, tag, attrs, text, parent) {
    var e = ui.doc.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    if (text) e.textContent = text;
    (parent || ui.svg).appendChild(e);
    return e;
  }

  function drawServers(S) {
    var ui = S.ui;
    var R = S.R;
    while (ui.svg.firstChild) ui.svg.removeChild(ui.svg.firstChild);
    for (var i = 0; i < SERVERS; i++) {
      var x = 4 + i * 63;
      var p = R.per[i];
      var st = R.ver[i] === "new" ? (p.err ? "bad" : "warn") : "ok";
      var g = svgEl(ui, "g", { "class": "dg-node st-" + st });
      svgEl(ui, "rect", { x: x, y: 6, width: 58, height: 92, rx: 5 }, "", g);
      svgEl(ui, "text", { x: x + 29, y: 24, "class": "dg-label", "text-anchor": "middle" }, String(i + 1), g);
      svgEl(ui, "text", { x: x + 29, y: 42, "class": "dg-sub", "text-anchor": "middle" }, R.ver[i], g);
      svgEl(ui, "text", { x: x + 29, y: 60, "class": "dg-meta", "text-anchor": "middle" }, "in " + p.ins, g);
      svgEl(ui, "text", { x: x + 29, y: 74, "class": "dg-meta", "text-anchor": "middle" }, "out " + p.outs, g);
      svgEl(ui, "text", { x: x + 29, y: 88, "class": "dg-meta", "text-anchor": "middle" }, "err " + p.err, g);
    }
    var max = 90;
    [["board", R.board, "Board: underground", R.board > R.lamps ? "bad" : "ok"], ["lamps", R.lamps, "Lamps out of the rack", "ok"]].forEach(function (b, r) {
      var y = 120 + r * 36;
      svgEl(ui, "text", { x: 4, y: y + 15, "class": "dg-sub" }, b[2]);
      var g2 = svgEl(ui, "g", { "class": "dg-node st-" + b[3] });
      svgEl(ui, "rect", { x: 170, y: y, width: Math.max(2, 400 * b[1] / max), height: 22, rx: 3 }, "", g2);
      svgEl(ui, "text", { x: 580, y: y + 15, "class": "dg-meta" }, String(b[1]));
    });
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var C = R.C;
    S.ui.head.textContent = hm(R.t) + ". Release " + R.slot.label + ". " +
      (C.strategy === "bluegreen" ? "Blue-green, watched for " + C.length + " h." :
        "Canary on tally-10, promoted " + (C.rule === "time" ? "after " + C.length + " h with no error." : "after 3 tag-ins and 3 tag-outs with no error.")) +
      " New tag-out code " + (C.flag ? "on." : "switched off by the flag.");
    drawServers(S);
    S.stat.time(hm(R.t));
    S.stat.servers("new on " + newCount(R) + " of 10");
    S.stat.phase(phaseText(R));
    S.stat.canary(R.can.ins + " in, " + R.can.outs + " out, " + errs(R.can.err));
    S.stat.newin(R.neu.ins);
    S.stat.newout(R.neu.outs);
    S.stat.errin(R.errIn);
    S.stat.errout(R.errOut);
    S.stat.board(R.board);
    S.stat.lamps(R.lamps);
    S.stat.ghosts(R.board - R.lamps);
    ["ten", "hour", "all"].forEach(function (id) { S.ctl[id].disable(R.t >= R.end); });
  }

  function run(api, mins) {
    var S = api.state;
    var R = S.R;
    var from = R.events.length;
    var t0 = R.t;
    var e0 = R.errOut;
    var stop = Math.min(R.end, R.t + mins);
    while (R.t < stop) step(R);
    var s = hm(t0) + " to " + hm(R.t) + ": " + newCount(R) + " of 10 on the new version; " + (R.errOut - e0) + " tag-out errors logged.";
    var evs = R.events.slice(from);
    if (evs.length) s += " " + evs.map(function (e) { return e.txt; }).join(" ");
    if (R.t >= R.end) s += " " + hm(R.t) + " count: board " + R.board + " underground, lamps out " + R.lamps + ", ghosts " + (R.board - R.lamps) + ".";
    api.log(s, R.board > R.lamps ? "bad" : (evs.some(function (e) { return e.tone === "warn"; }) ? "warn" : "ok"));
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.R = newRun(S.C);
    api.log((why ? why + " " : "") + hm(S.R.t) + ", before the release. Board " + S.R.board + " underground, lamps out " + S.R.lamps + ".", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { slot: "night", strategy: "canary", length: "1", rule: "time", flag: true };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.slot = api.control.select("slot", "Release slot", [
        { value: "night", label: SLOTS.night.label },
        { value: "day", label: SLOTS.day.label }
      ], "night", function (v) { S.C.slot = String(v); restart(api, "Release slot changed."); });
      S.ctl.strategy = api.control.select("strategy", "Strategy", [
        { value: "canary", label: "Canary: tally-10 first (as built)" },
        { value: "bluegreen", label: "Blue-green: all ten at once" }
      ], "canary", function (v) { S.C.strategy = String(v); restart(api, "Strategy changed."); });
      S.ctl.length = api.control.select("length", "Canary length, or blue-green watch time", [
        { value: "1", label: "1 hour (as built)" },
        { value: "2", label: "2 hours" }
      ], "1", function (v) { S.C.length = String(v); restart(api, "Length changed."); });
      S.ctl.rule = api.control.select("rule", "Promotion rule", [
        { value: "time", label: "By time: the length passes with no error (as built)" },
        { value: "traffic", label: "By traffic: 3 tag-ins and 3 tag-outs, no error" }
      ], "time", function (v) { S.C.rule = String(v); restart(api, "Promotion rule changed."); });
      S.ctl.flag = api.control.toggle("flag", "Feature flag: new tag-out code on", true, function (on) {
        S.C.flag = !!on;
        api.log(hm(S.R.t) + " flag: new tag-out code " + (on ? "switched on" : "switched off") + " on every server, with no deploy.", on ? "warn" : "ok");
        draw(api);
      });
      S.ctl.rollback = api.control.button("rollback", "Roll back all ten now", function () {
        var R = S.R;
        setAll(R, "old"); R.phase = "manual"; R.at = R.t;
        api.log(hm(R.t) + " rollback: all ten back on the old version. The board still shows " + R.board + " underground and " + (R.board - R.lamps) + " ghosts.", R.board > R.lamps ? "bad" : "ok");
        draw(api);
      });
      S.ctl.again = api.control.button("new", "Start the four hours again", function () { restart(api, "New run."); });
      S.ctl.ten = api.control.button("ten", "Next 10 minutes", function () { run(api, 10); });
      S.ctl.hour = api.control.button("hour", "Next hour", function () { run(api, 60); });
      S.ctl.all = api.control.button("all", "Run to the end", function () { run(api, SPAN); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        time: api.stat("time", "time", ""),
        servers: api.stat("servers", "servers on the new version", "warn"),
        phase: api.stat("phase", "release", ""),
        canary: api.stat("canary", "tally-10 as canary: tag-ins, tag-outs, errors", ""),
        newin: api.stat("newin", "tag-ins served by the new version", ""),
        newout: api.stat("newout", "tag-outs served by the new version", ""),
        errin: api.stat("errin", "errors on tag-in", "bad"),
        errout: api.stat("errout", "errors on tag-out", "bad"),
        board: api.stat("board", "board: underground", ""),
        lamps: api.stat("lamps", "lamps out of the rack", "ok"),
        ghosts: api.stat("ghosts", "ghosts: on the board, lamp on the rack", "bad")
      };
      api.info("<strong>How to read it.</strong> Ten boxes are the ten tally servers, old or new version, with the tag-ins, tag-outs and errors each has served. Taps are dealt to them in turn, so tally-10 gets every tenth. The tablet shows a green tick before the server answers. A ghost is a miner the board says is underground whose lamp is back on the rack. Shifts: day 04:00 to 14:00 (44), back 12:00 to 22:00 (43), night 20:00 to 06:00 (40); the cage brings 11 at a time.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function R() { return t.api.state.R; }

      // 1. Opens at 19:00, before the release.
      t.expect(t.stat("time") === "19:00" && t.stat("servers") === "new on 0 of 10" && t.stat("phase") === "not released yet" &&
        t.stat("board") === 43 && t.stat("lamps") === 43 && t.stat("ghosts") === 0 && R().t === 1140,
        "Opens at 19:00: nothing released, board 43, lamps out 43, no ghosts");

      // 2. The canary hour: 4 tag-ins, 0 tag-outs, promoted at 21:00.
      t.click("hour");
      t.click("hour");
      t.expect(t.stat("time") === "21:00" && t.stat("canary") === "4 in, 0 out, 0 errors" && t.stat("phase") === "promoted at 21:00" &&
        t.stat("servers") === "new on 10 of 10" && t.stat("board") === 83 && t.stat("lamps") === 83,
        "20:00 to 21:00: tally-10 serves 4 tag-ins and 0 tag-outs, no error; promoted to all ten at 21:00");

      // 3. The record at 23:00.
      t.click("all");
      t.expect(t.stat("time") === "23:00" && t.stat("errout") === 43 && t.stat("errin") === 0 && t.stat("board") === 83 &&
        t.stat("lamps") === 40 && t.stat("ghosts") === 43 && t.logText().indexOf("ghosts 43") >= 0,
        "23:00: 43 tag-out errors, board 83, lamps out 40, 43 ghosts");

      // 4. A rollback at 23:00 changes the code, not the board.
      t.click("rollback");
      t.expect(t.stat("servers") === "new on 0 of 10" && t.stat("ghosts") === 43 && t.stat("phase") === "all ten rolled back at 23:00",
        "Rollback at 23:00: all ten old, still 43 ghosts");

      // 5. Option 1: a two-hour canary is promoted at 22:00, before the first tag-out.
      t.set("length", "2");
      t.click("all");
      t.expect(t.stat("phase") === "promoted at 22:00" && t.stat("canary") === "4 in, 0 out, 0 errors" && t.stat("ghosts") === 43,
        "Two-hour canary: promoted at 22:00 with 0 tag-outs seen, 43 ghosts");
      t.set("length", "1");

      // 6. Option 0: blue-green puts every tap on the new version and still makes 43 ghosts.
      t.set("strategy", "bluegreen");
      t.click("all");
      t.expect(t.stat("phase") === "all ten on new (blue-green)" && t.stat("newin") === 40 && t.stat("newout") === 43 && t.stat("ghosts") === 43,
        "Blue-green at 20:00: all 40 tag-ins and 43 tag-outs on the new version, no switch back, 43 ghosts");

      // 7. The usual 13:30 slot, blue-green: the first cage fails before the switch back.
      t.set("slot", "day");
      t.click("all");
      t.expect(t.stat("phase") === "all ten switched back at 14:03" && t.stat("ghosts") === 11 && t.stat("time") === "16:30",
        "13:30 blue-green: 11 tag-outs fail at 14:02, switched back at 14:03, 11 ghosts");

      // 8. The usual 13:30 slot, canary by time: caught by luck at the 14:00 shift change.
      t.set("strategy", "canary");
      t.click("all");
      t.expect(t.stat("phase") === "canary rolled back at 14:03" && t.stat("ghosts") === 1 && t.stat("board") === 44 && t.stat("lamps") === 43,
        "13:30 canary: tally-10's tag-out fails at 14:02, rolled back at 14:03, 1 ghost");
      t.set("slot", "night");

      // 9. Option 2: promote by traffic waits for tag-outs and rolls back at 22:03.
      t.set("rule", "traffic");
      t.click("hour");
      t.click("hour");
      var waited = t.stat("phase") === "canary on tally-10" && t.stat("canary") === "4 in, 0 out, 0 errors";
      t.click("all");
      t.expect(waited && t.stat("phase") === "canary rolled back at 22:03" && t.stat("canary") === "4 in, 1 out, 1 error" &&
        t.stat("board") === 41 && t.stat("lamps") === 40 && t.stat("ghosts") === 1,
        "By traffic: still a canary at 21:00, rolled back at 22:03 after 1 tag-out error, 1 ghost");
      t.set("rule", "time");

      // 10. The feature flag: new tag-out code off, no deploy, no ghosts.
      t.set("flag", false);
      t.click("new");
      t.click("all");
      t.expect(t.stat("phase") === "promoted at 21:00" && t.stat("errout") === 0 && t.stat("ghosts") === 0,
        "Tag-out flag off: promoted at 21:00, 0 tag-out errors, 0 ghosts");
      t.set("flag", true);

      // 11. By traffic with the flag off: promoted once the canary has served 3 tag-outs.
      t.set("flag", false);
      t.set("rule", "traffic");
      t.click("all");
      t.expect(t.stat("phase") === "promoted at 22:09" && t.stat("ghosts") === 0,
        "By traffic, flag off: promoted at 22:09 after tally-10's third tag-out, 0 ghosts");
    }
  });
})();
