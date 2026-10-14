/* sims/s5e11-v1.0.0.js  (published as sims/s5e11.js)
   Case s5e11 "Branches": a branch lab for Kettlewyn Games. Five months of commits on two branches,
   main and open-world, from 29 January (1.4 out) to 9 July (1.6 out). The learner chooses how the
   branch meets main, how conflicts are resolved, and whether Fiachra's fix for bug #4127 came with a
   regression test, then steps through the events or runs to 9 July. Widget-style sim: it draws its
   own commit graph inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: strategies (one merge on 2 July, a merge from main every
     Monday, a rebase onto main on 2 July, every change into main behind a feature flag), resolution
     (take the branch's whole file, hunk by hunk by eye), regression test on or off; Next event,
     Run to 9 July, Reset. Stats: date, conflict stops, conflicting hunks, lines in conflict, days
     open-world's code waited for main, open-world commits landing on main at once, #4127 fix lines
     on main, regression test, #4127 in 1.6. selfTest: 11 assertions.

   The model (stated in sim.lede and api.info):
   - SaveGame.cs has three places that matter: the top of the file (C), the save code (W) and the
     load code (L). Each place holds the list of changes made to it, in order. Two versions of a
     place are equal when their lists are equal.
   - A commit appends its change to every place it touches. A rewrite (open-world's "Save regions in
     chunks", 22 April, in W) also appends: its author rewrites what is in front of him, so a fix
     already there is kept.
   - A merge is a three-way merge per place against the merge base: if only one side changed the
     place, that side wins; if both changed it differently, it is a conflicting hunk. Its size is the
     lines of every change either side added since the base.
   - "Take the branch's whole file": if any hunk conflicts, the result is the branch's whole file
     (git checkout --theirs on the 2 July merge; --ours on a sync into the branch; --theirs during a
     rebase, where Git's names flip). Main's side is dropped everywhere, conflicting or not.
   - "Hunk by hunk, by eye": each conflicting hunk keeps both sides, unless the branch's side
     rewrote that place since the base; then the rewrite is kept, as it replaced the old code.
   - Rebase: open-world's commits are replayed one at a time onto main as it stood on 2 July. For
     each commit the base is the branch before it, ours is the replayed result so far, theirs is the
     branch after it. A commit with a conflicting hunk is one stop. Then main moves to the result.
   - Weekly syncs: every Monday from 9 February to 29 June (21 Mondays) main is merged into
     open-world if main has new commits since the last sync (6 of the 21). The base is main at the
     last sync. On 2 July open-world is merged into main.
   - Trunk with a flag: every open-world commit goes into main the day it is made, behind the flag
     open_world, which is switched on on 2 July. Nothing waits, so nothing conflicts.
   - The regression test (if on) arrives with the fix on 12 March. The build machine runs it after
     every change to main. It fails if any of the fix's 8 lines is missing; the merge is then held
     and the missing lines put back before 1.6.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e11-v1.0.0.json):
   - The fix for #4127 (12 March, main): C 1 line, W 3 lines, L 4 lines = 8 lines.
   - open-world's save changes: 24 Feb C 2 lines; 10 Mar L 8 lines; 22 Apr W 30 lines (rewrite);
     3 Jun W 6 lines. Its other commits (3 Feb, 2 Apr, 13 May, 24 Jun) don't touch SaveGame.cs.
     8 open-world commits; main has 6 between 3 Feb and 2 Jul (17 Feb, 12 Mar, 26 Mar = 1.5,
     15 Apr, 20 May, 17 Jun).
   - One merge on 2 July: base = 1.4. C 1 + 2 = 3, W 3 + 36 = 39, L 4 + 8 = 12: 3 hunks, 54 lines,
     1 stop. Branch's whole file: 0 of 8 fix lines. By eye: W was rewritten, so 5 of 8 survive.
   - Rebase: branch's whole file: the first stop (24 Feb, C, 1 + 2 = 3 lines) takes that commit's
     whole file, the fix is gone, and the rest replay with no stop: 1 stop, 1 hunk, 3 lines, 0 of 8.
     By eye: 24 Feb C 3, 10 Mar L 12, 22 Apr W 3 + 30 = 33: 3 stops, 3 hunks, 48 lines, 5 of 8.
   - Weekly syncs: the sync of 16 March (4 days after the fix) meets C 1 + 2 = 3 and L 4 + 8 = 12:
     2 hunks, 15 lines; W did not conflict. By eye the fix goes in whole and the 22 April rewrite
     keeps it: 8 of 8. Branch's whole file drops it on 16 March, and the 2 July merge has no
     conflict at all: 0 of 8.
   - Days open-world's code waited for main: 3 Feb to 2 Jul = 149 (trunk: 0). Commits landing on
     main at once: 8 (trunk: 1).
   - With the regression test on, every route that loses a line fails on 2 July: "failed 2 Jul".

   Drawing: viewBox 660 x 250. Day 29 (29 Jan) at x 40 to day 190 (9 Jul) at x 620. main at y 70,
   open-world at y 160; trunk mode draws open-world's commits on main's line.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var MON = { Jan: 0, Feb: 31, Mar: 59, Apr: 90, May: 120, Jun: 151, Jul: 181 };
  function day(m, d) { return MON[m] + d; }
  var MNAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  function dname(n) {
    var best = "Jan";
    for (var i = 0; i < MNAMES.length; i++) if (n > MON[MNAMES[i]]) best = MNAMES[i];
    return (n - MON[best]) + " " + best;
  }

  var PLACES = ["C", "W", "L"];
  var PLACE_NAME = { C: "top of the file", W: "save code", L: "load code" };
  var CH = {
    fix: { C: 1, W: 3, L: 4 },
    b2: { C: 2 },
    b3: { L: 8 },
    b5: { W: 30 },
    b7: { W: 6 }
  };
  var REWRITE = { b5: "W" };
  var FIX_TOTAL = 8;

  var START = day("Jan", 29);
  var BRANCH_DAY = day("Feb", 3);
  var LAND_DAY = day("Jul", 2);
  var SHIP_DAY = day("Jul", 9);

  var MAIN = [
    { id: "m1", d: day("Feb", 17), msg: "Fix German menu text", ch: null },
    { id: "fix", d: day("Mar", 12), msg: "Fix #4127: temp file, rename", ch: "fix" },
    { id: "m3", d: day("Mar", 26), msg: "Release 1.5", ch: null },
    { id: "m4", d: day("Apr", 15), msg: "Controller remap screen", ch: null },
    { id: "m5", d: day("May", 20), msg: "Achievement icons", ch: null },
    { id: "m6", d: day("Jun", 17), msg: "Fix photo mode crash", ch: null }
  ];
  var BRANCH = [
    { id: "b1", d: day("Feb", 3), msg: "Start open world: stream regions", ch: null },
    { id: "b2", d: day("Feb", 24), msg: "Save region chunk size", ch: "b2" },
    { id: "b3", d: day("Mar", 10), msg: "Load region data", ch: "b3" },
    { id: "b4", d: day("Apr", 2), msg: "Fog and weather per region", ch: null },
    { id: "b5", d: day("Apr", 22), msg: "Save regions in chunks", ch: "b5" },
    { id: "b6", d: day("May", 13), msg: "Region map screen", ch: null },
    { id: "b7", d: day("Jun", 3), msg: "Faster region saves", ch: "b7" },
    { id: "b8", d: day("Jun", 24), msg: "Open world: final fixes", ch: null }
  ];

  var STRATS = [
    { value: "long", label: "Long branch, one merge on 2 July (as it was)" },
    { value: "weekly", label: "Long branch, merge main into it every Monday" },
    { value: "rebase", label: "Long branch, rebase onto main on 2 July" },
    { value: "trunk", label: "Every change into main daily, behind a feature flag" }
  ];
  var RESOLVES = [
    { value: "whole", label: "Take the branch's whole file" },
    { value: "eye", label: "Hunk by hunk, by eye" }
  ];

  /* ---------- the file model ---------- */

  function empty() { return { C: [], W: [], L: [] }; }
  function copy(f) { return { C: f.C.slice(), W: f.W.slice(), L: f.L.slice() }; }
  function eq(a, b) { return a.join(",") === b.join(","); }
  function apply(f, ch) {
    if (!ch) return;
    PLACES.forEach(function (p) { if (CH[ch][p]) f[p] = f[p].concat([ch]); });
  }
  function added(list, base) { return list.filter(function (x) { return base.indexOf(x) < 0; }); }
  function linesOf(items, p) {
    var n = 0;
    items.forEach(function (x) { n += (CH[x] && CH[x][p]) || 0; });
    return n;
  }
  function fixLines(f) {
    var n = 0;
    PLACES.forEach(function (p) { if (f[p].indexOf("fix") >= 0) n += CH.fix[p]; });
    return n;
  }

  // Three-way merge of SaveGame.cs. branchIsTheirs says which side is open-world's.
  function merge3(base, ours, theirs, branchIsTheirs, how) {
    var out = empty();
    var hunks = [];
    PLACES.forEach(function (p) {
      var B = base[p];
      var O = ours[p];
      var T = theirs[p];
      if (eq(O, B)) { out[p] = T.slice(); return; }
      if (eq(T, B) || eq(O, T)) { out[p] = O.slice(); return; }
      var size = linesOf(added(O, B), p) + linesOf(added(T, B), p);
      hunks.push({ p: p, lines: size });
      var side = branchIsTheirs ? T : O;
      var rewrote = added(side, B).some(function (x) { return REWRITE[x] === p; });
      if (how === "eye" && rewrote) out[p] = side.slice();
      else out[p] = O.concat(added(T, O));
    });
    if (hunks.length && how === "whole") out = copy(branchIsTheirs ? theirs : ours);
    var lines = 0;
    hunks.forEach(function (h) { lines += h.lines; });
    return { file: out, hunks: hunks, lines: lines };
  }

  function hunkText(r) {
    return r.hunks.map(function (h) { return PLACE_NAME[h.p] + " " + h.lines; }).join(", ");
  }

  /* ---------- the timeline ---------- */

  function mondays() {
    var out = [];
    for (var d = day("Feb", 9); d < LAND_DAY; d += 7) out.push(d);
    return out;
  }

  // Events in order: kind, day, and what they carry. Ties: branch work, main work, sync, landing.
  function events(C) {
    var ev = [{ k: "start", d: BRANCH_DAY, o: 0 }];
    BRANCH.forEach(function (c) { ev.push({ k: "branch", d: c.d, c: c, o: 1 }); });
    MAIN.forEach(function (c) { ev.push({ k: "main", d: c.d, c: c, o: 2 }); });
    if (C.strat === "weekly") mondays().forEach(function (d) { ev.push({ k: "sync", d: d, o: 3 }); });
    ev.push({ k: "land", d: LAND_DAY, o: 4 });
    ev.push({ k: "ship", d: SHIP_DAY, o: 5 });
    ev.sort(function (a, b) { return (a.d - b.d) || (a.o - b.o); });
    return ev;
  }

  function fresh(api) {
    var S = api.state;
    S.i = 0;
    S.ev = events(S.C);
    S.day = START;
    S.main = empty();
    S.branch = empty();
    S.base = empty();
    S.branchStart = empty();
    S.mainNew = 0;
    S.syncs = 0;
    S.busySyncs = 0;
    S.stops = 0;
    S.hunks = 0;
    S.lines = 0;
    S.apart = 0;
    S.landing = 0;
    S.fixMade = false;
    S.test = S.C.test ? "not run yet" : "off";
    S.verdict = "not shipped yet";
    S.done = [];
  }

  function runTest(api, when) {
    var S = api.state;
    if (!S.C.test || !S.fixMade) return;
    var have = fixLines(S.main);
    if (have === FIX_TOTAL) {
      if (S.test.indexOf("failed") < 0) S.test = "passed";
      return;
    }
    S.test = "failed " + dname(when);
    PLACES.forEach(function (p) { if (S.main[p].indexOf("fix") < 0) S.main[p] = S.main[p].concat(["fix"]); });
    api.log(dname(when) + ": the build machine runs the #4127 test on main. It fails: " + have + " of 8 fix lines. The merge is held and the missing " +
      (FIX_TOTAL - have) + " are put back.", "ok");
  }

  function landing(api, e) {
    var S = api.state;
    var C = S.C;
    var r;
    if (C.strat === "trunk") {
      S.landing = 1;
      S.apart = 0;
      api.log("2 Jul: the open_world flag is switched on. Its 8 commits reached main one at a time; Git never stopped. Fix #4127 lines on main: " +
        fixLines(S.main) + " of 8.", fixLines(S.main) === FIX_TOTAL ? "ok" : "bad");
      return;
    }
    S.landing = BRANCH.length;
    S.apart = LAND_DAY - BRANCH_DAY;
    if (C.strat === "rebase") {
      var tip = copy(S.main);
      var parent = copy(S.branchStart);
      var stops = 0;
      var hunks = 0;
      var lines = 0;
      var notes = [];
      BRANCH.forEach(function (c) {
        var after = copy(parent);
        apply(after, c.ch);
        r = merge3(parent, tip, after, true, C.how);
        tip = r.file;
        if (r.hunks.length) {
          stops += 1;
          hunks += r.hunks.length;
          lines += r.lines;
          notes.push(c.msg + " (" + hunkText(r) + ")");
        }
        parent = after;
      });
      S.main = tip;
      S.stops += stops;
      S.hunks += hunks;
      S.lines += lines;
      api.log("2 Jul: open-world rebased onto main. Git stopped " + stops + (stops === 1 ? " time: " : " times: ") + notes.join("; ") +
        ". Then main moved to the end of the branch, one straight line. Fix #4127 lines on main: " + fixLines(S.main) + " of 8.",
        fixLines(S.main) === FIX_TOTAL ? "ok" : "bad");
    } else {
      r = merge3(S.base, S.main, S.branch, true, C.how);
      S.main = r.file;
      if (r.hunks.length) { S.stops += 1; S.hunks += r.hunks.length; S.lines += r.lines; }
      var head = "2 Jul: open-world merged into main";
      if (C.strat === "weekly") head += " after " + S.syncs + " Monday syncs, " + S.busySyncs + " of them bringing commits from main";
      api.log(head + ". " + (r.hunks.length ? "Git stops with " + r.hunks.length + " conflicting hunks in SaveGame.cs, " + r.lines + " lines: " + hunkText(r) + "." :
        "No conflicts.") + " Fix #4127 lines on main: " + fixLines(S.main) + " of 8.", fixLines(S.main) === FIX_TOTAL ? "ok" : "bad");
    }
    runTest(api, e.d);
  }

  function stepOne(api) {
    var S = api.state;
    var C = S.C;
    if (S.i >= S.ev.length) return false;
    var e = S.ev[S.i];
    S.i += 1;
    S.day = e.d;
    S.done.push(e);
    var r;
    if (e.k === "start") {
      S.branchStart = copy(S.main);
      if (C.strat !== "trunk") {
        S.branch = copy(S.main);
        S.base = copy(S.main);
        api.log("3 Feb: open-world branches off main at 1.4.", "");
      } else {
        api.log("3 Feb: open-world work starts on main, behind the flag open_world, switched off.", "");
      }
    } else if (e.k === "branch") {
      if (C.strat === "trunk") {
        apply(S.main, e.c.ch);
        if (e.c.ch) api.log(dname(e.d) + ": \"" + e.c.msg + "\" goes into main the same day, behind the flag. No conflict.", "");
        runTest(api, e.d);
      } else {
        apply(S.branch, e.c.ch);
        if (e.c.ch) api.log(dname(e.d) + ": \"" + e.c.msg + "\" on open-world changes the " + PLACE_NAME[Object.keys(CH[e.c.ch])[0]] + ".", "");
      }
    } else if (e.k === "main") {
      apply(S.main, e.c.ch);
      S.mainNew += 1;
      if (e.c.id === "fix") {
        S.fixMade = true;
        api.log("12 Mar: Fiachra's fix for #4127 on main: 8 lines, top of the file 1, save code 3, load code 4." +
          (C.test ? " A regression test comes with it." : " No test comes with it."), "ok");
      } else if (e.c.id === "m3") {
        api.log("26 Mar: 1.5 ships from main with the fix: " + fixLines(S.main) + " of 8 lines.", "");
      }
      runTest(api, e.d);
    } else if (e.k === "sync") {
      S.syncs += 1;
      if (S.mainNew > 0) {
        S.busySyncs += 1;
        S.mainNew = 0;
        r = merge3(S.base, S.branch, S.main, false, C.how);
        S.branch = r.file;
        S.base = copy(S.main);
        if (r.hunks.length) {
          S.stops += 1;
          S.hunks += r.hunks.length;
          S.lines += r.lines;
          api.log(dname(e.d) + ": Monday sync, main into open-world. Git stops with " + r.hunks.length + " conflicting hunks, " + r.lines + " lines: " +
            hunkText(r) + ". Fix #4127 lines on open-world: " + fixLines(S.branch) + " of 8.", fixLines(S.branch) === FIX_TOTAL ? "ok" : "bad");
        }
      }
    } else if (e.k === "land") {
      landing(api, e);
    } else if (e.k === "ship") {
      var n = fixLines(S.main);
      S.verdict = n === FIX_TOTAL ? "fixed" : "back";
      if (S.C.test && S.test === "not run yet") S.test = "passed";
      api.log("9 Jul: 1.6 ships from main with " + n + " of 8 fix lines. Bug #4127 is " + (n === FIX_TOTAL ? "still fixed." : "back."), n === FIX_TOTAL ? "ok" : "bad");
    }
    return true;
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
  function X(d) { return Math.round(40 + (d - START) * 580 / (SHIP_DAY - START)); }
  function dot(x, y, r) { return "M" + (x - r) + " " + y + "a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0Z"; }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 250", width: "100%", "class": "dg", role: "img",
      "aria-label": "The commit graph from 29 January to 9 July. The top line is main, the lower line open-world. Each dot is a commit; filled dots have happened. Lines between them are merges. The fix for #4127 is the dot on main on 12 March."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    clear(g);
    var trunk = C.strat === "trunk";
    var yM = 70;
    var yB = trunk ? 70 : 160;
    ["Feb", "Mar", "Apr", "May", "Jun", "Jul"].forEach(function (m) {
      txt(doc, g, X(MON[m] + 1), 236, m, "dg-axis", "middle");
    });
    mk(doc, "path", { d: "M" + X(START) + " " + yM + "L" + X(SHIP_DAY) + " " + yM, "class": "dg-edge", fill: "none" }, g);
    txt(doc, g, 40, 48, "main", "dg-note", "start");
    if (!trunk) {
      mk(doc, "path", { d: "M" + X(BRANCH_DAY) + " " + yM + "L" + X(BRANCH_DAY) + " " + yB + "L" + X(LAND_DAY) + " " + yB + "L" + X(LAND_DAY) + " " + yM, "class": "dg-edge", fill: "none" }, g);
      txt(doc, g, X(BRANCH_DAY), yB + 24, "open-world", "dg-note", "start");
      if (C.strat === "weekly") {
        mondays().forEach(function (d) {
          mk(doc, "path", { d: "M" + X(d) + " " + (yM + 6) + "L" + X(d) + " " + (yB - 6), "class": "dg-axis", fill: "none" }, g);
        });
      }
    } else {
      txt(doc, g, X(BRANCH_DAY), 110, "open-world behind the flag, off until 2 Jul", "dg-note", "start");
    }
    var happened = {};
    S.done.forEach(function (e) { if (e.c) happened[e.c.id] = true; });
    function commit(c, y) {
      var tone = c.id === "fix" ? "st-ok" : (CH[c.ch] ? "st-warn" : "st-muted");
      var gg = mk(doc, "g", { "class": "dg-node " + (happened[c.id] ? tone : "st-muted") }, g);
      mk(doc, "path", { d: dot(X(c.d), y, happened[c.id] ? 6 : 4) }, gg);
    }
    MAIN.forEach(function (c) { commit(c, yM); });
    BRANCH.forEach(function (c) { commit(c, yB); });
    txt(doc, g, X(day("Mar", 12)), yM - 16, "#4127 fix", "dg-note", "middle");
    var shipTone = S.verdict === "back" ? "st-bad" : (S.verdict === "fixed" ? "st-ok" : "st-muted");
    var sg = mk(doc, "g", { "class": "dg-node " + shipTone }, g);
    mk(doc, "path", { d: dot(X(SHIP_DAY), yM, 7) }, sg);
    txt(doc, g, X(SHIP_DAY), yM - 16, "1.6", "dg-note", "middle");
    mk(doc, "path", { d: "M" + X(S.day) + " 30L" + X(S.day) + " 210", "class": "dg-axis", fill: "none" }, g);
    ui.head.textContent = "Strategy: " + STRATS.filter(function (s) { return s.value === C.strat; })[0].label + ". Conflicts: " +
      (C.how === "whole" ? "take the branch's whole file" : "hunk by hunk, by eye") + ". Regression test: " + (C.test ? "on" : "off") + ".";
    S.stat.date(dname(S.day));
    S.stat.stops(S.stops);
    S.stat.hunks(S.hunks);
    S.stat.lines(S.lines);
    S.stat.apart(S.apart);
    S.stat.landing(S.landing);
    S.stat.fix(fixLines(S.main) + " of 8");
    S.stat.test(S.test);
    S.stat.build(S.verdict);
  }

  function restart(api, why) {
    fresh(api);
    api.log(why + " Back to 29 Jan: 1.4 is out and nothing has branched yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s5e11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { strat: "long", how: "whole", test: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.strat = api.control.select("strategy", "How open-world meets main", STRATS, "long", function (v) {
        S.C.strat = String(v);
        restart(api, "Strategy: " + String(v) + ".");
      });
      S.ctl.how = api.control.select("resolve", "How conflicts are resolved", RESOLVES, "whole", function (v) {
        S.C.how = String(v) === "eye" ? "eye" : "whole";
        restart(api, "Conflicts: " + (S.C.how === "whole" ? "take the branch's whole file." : "hunk by hunk, by eye."));
      });
      S.ctl.test = api.control.toggle("test", "The #4127 fix comes with a regression test", false, function (on) {
        S.C.test = !!on;
        restart(api, "Regression test for #4127: " + (on ? "on." : "off."));
      });
      api.control.button("next", "Next event", function () { stepOne(api); draw(api); });
      api.control.button("run", "Run to 9 July", function () { while (stepOne(api)) { /* every event */ } draw(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        date: api.stat("date", "date", ""),
        stops: api.stat("stops", "times Git stopped for conflicts", "warn"),
        hunks: api.stat("hunks", "conflicting hunks", "warn"),
        lines: api.stat("lines", "lines in conflict", "warn"),
        apart: api.stat("apart", "days open-world's code waited for main", "warn"),
        landing: api.stat("landing", "open-world commits landing on main at once", ""),
        fix: api.stat("fix", "#4127 fix lines on main", "ok"),
        test: api.stat("test", "regression test", ""),
        build: api.stat("build", "#4127 in 1.6", "bad")
      };

      api.info("<strong>How to read it.</strong> The top line is main, the lower line open-world. Each dot is a commit; the green one is Fiachra's fix for #4127, 8 lines in three places in SaveGame.cs: the top of the file, the save code and the load code. Amber dots changed SaveGame.cs too. A conflicting hunk is a place both sides changed since they last met. Taking the branch's whole file drops main's side everywhere in the file. Hunk by hunk, by eye, keeps both sides of each hunk, unless the branch rewrote that place; then the rewrite is kept.");

      fresh(api);
      api.log("29 Jan: 1.4 is out. Nothing has branched yet. Step through the events, or run to 9 July.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function runAll() { t.click("run"); }
      function cfg(strat, how, test) {
        t.set("strategy", strat);
        t.set("resolve", how);
        t.set("test", test);
      }

      // 1. The opening state: 29 January, before open-world branches.
      t.expect(t.stat("date") === "29 Jan" && t.stat("stops") === 0 && t.stat("hunks") === 0 && t.stat("lines") === 0 &&
        t.stat("fix") === "0 of 8" && t.stat("build") === "not shipped yet" && t.stat("test") === "off" &&
        t.logText().indexOf("29 Jan: 1.4 is out. Nothing has branched yet.") >= 0,
        "Opens on 29 January: nothing branched, no fix yet, 1.6 not shipped");

      // 2. The first event is the branch on 3 February.
      t.click("next");
      t.expect(t.stat("date") === "3 Feb" && t.logText().indexOf("3 Feb: open-world branches off main at 1.4.") >= 0,
        "The first event: open-world branches off main on 3 February");

      // 3. As it was: one merge, the branch's whole file, no test.
      cfg("long", "whole", false);
      runAll();
      t.expect(t.stat("stops") === 1 && t.stat("hunks") === 3 && t.stat("lines") === 54 && t.stat("fix") === "0 of 8" &&
        t.stat("build") === "back" && t.stat("apart") === 149 && t.stat("landing") === 8 &&
        t.logText().indexOf("Git stops with 3 conflicting hunks in SaveGame.cs, 54 lines: top of the file 3, save code 39, load code 12. Fix #4127 lines on main: 0 of 8.") >= 0,
        "As it was: 3 hunks, 54 lines, the branch's whole file, 0 of 8 fix lines, #4127 back in 1.6");

      // 4. The fix was on main and shipped in 1.5 before the merge.
      t.expect(t.logText().indexOf("26 Mar: 1.5 ships from main with the fix: 8 of 8 lines.") >= 0,
        "1.5 shipped on 26 March with all 8 fix lines");

      // 5. Hunk by hunk, by eye: the save code was rewritten, so 3 lines are lost.
      t.set("resolve", "eye");
      runAll();
      t.expect(t.stat("hunks") === 3 && t.stat("lines") === 54 && t.stat("fix") === "5 of 8" && t.stat("build") === "back",
        "One merge, hunk by hunk by eye: 5 of 8 survive, the 3 save-code lines are lost, #4127 back");

      // 6. The regression test catches the loss on 2 July.
      cfg("long", "whole", true);
      runAll();
      t.expect(t.stat("test") === "failed 2 Jul" && t.stat("fix") === "8 of 8" && t.stat("build") === "fixed",
        "With the regression test, the build fails on 2 July and 1.6 ships fixed");

      // 7. Rebase, taking the branch's whole file: one stop, then the fix is gone.
      cfg("rebase", "whole", false);
      runAll();
      t.expect(t.stat("stops") === 1 && t.stat("hunks") === 1 && t.stat("lines") === 3 && t.stat("fix") === "0 of 8" &&
        t.stat("build") === "back" && t.stat("apart") === 149,
        "Rebase, branch's whole file: 1 stop at 24 February, 3 lines, then 0 of 8");

      // 8. Rebase, hunk by hunk: the same 3 conflicts, one commit at a time.
      t.set("resolve", "eye");
      runAll();
      t.expect(t.stat("stops") === 3 && t.stat("hunks") === 3 && t.stat("lines") === 48 && t.stat("fix") === "5 of 8" &&
        t.logText().indexOf("Git stopped 3 times: Save region chunk size (top of the file 3); Load region data (load code 12); Save regions in chunks (save code 33)") >= 0,
        "Rebase, hunk by hunk: 3 stops, 48 lines, the rewrite wins in the save code, 5 of 8");

      // 9. Weekly syncs, hunk by hunk: the fix arrives on 16 March and survives.
      cfg("weekly", "eye", false);
      runAll();
      t.expect(t.stat("stops") === 1 && t.stat("hunks") === 2 && t.stat("lines") === 15 && t.stat("fix") === "8 of 8" &&
        t.stat("build") === "fixed" && t.stat("apart") === 149 && t.stat("landing") === 8 &&
        t.logText().indexOf("16 Mar: Monday sync, main into open-world. Git stops with 2 conflicting hunks, 15 lines: top of the file 3, load code 12.") >= 0 &&
        t.logText().indexOf("after 21 Monday syncs, 6 of them bringing commits from main. No conflicts.") >= 0,
        "Weekly syncs by eye: 2 hunks, 15 lines on 16 March, 8 of 8 in 1.6, still 8 commits after 149 days");

      // 10. Weekly syncs, branch's whole file: lost on 16 March, and 2 July has no conflict at all.
      t.set("resolve", "whole");
      runAll();
      t.expect(t.stat("fix") === "0 of 8" && t.stat("build") === "back" && t.stat("hunks") === 2 &&
        t.logText().indexOf("Fix #4127 lines on open-world: 0 of 8.") >= 0 && t.logText().indexOf("No conflicts. Fix #4127 lines on main: 0 of 8.") >= 0,
        "Weekly syncs, branch's whole file: the fix vanishes on 16 March and the final merge reports no conflict");

      // 11. Trunk with a flag and the test: nothing waits, nothing conflicts, the fix stays.
      cfg("trunk", "whole", true);
      runAll();
      t.expect(t.stat("stops") === 0 && t.stat("hunks") === 0 && t.stat("lines") === 0 && t.stat("apart") === 0 &&
        t.stat("landing") === 1 && t.stat("fix") === "8 of 8" && t.stat("test") === "passed" && t.stat("build") === "fixed",
        "Trunk with a flag: 0 conflicts, 0 days apart, 1 commit at a time, test passed, 8 of 8 in 1.6");
    }
  });
})();
