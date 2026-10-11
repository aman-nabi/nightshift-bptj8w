/* sims/s3e13-v1.0.0.js  (published as sims/s3e13.js)
   Case s3e13 "Under the Floorboards": a three-node timeline lab for Hollinmere, a grief retreat in
   an old farmhouse. Guests write letters in the retreat's journal app and burn them on their last
   night; the Burn button deletes the letter. The app's Cassandra cluster has three nodes (the
   house, the barn and the cottage, whose node sits in the crawl space under the floorboards) and
   replication factor 3. The learner replays the weeks from 3 Feb 08:00 to 2 Mar 12:00 and changes
   the grace period, the outage, the replication factor, what happens when the cottage returns,
   and soft delete. Widget-style sim: it draws its own timeline inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: event timeline (outage, hint window, burn, nightly and full
     compactions, weekly repair, return), controls for gc_grace_seconds (0, 10 days, 14 days),
     outage (none, 5, 12, 20 days), replication factor 3 or 5, return (switch on, or rebuild),
     soft delete; stats for each node, the QUORUM read, when the letter comes back, letter bytes
     on disk, hints; a static B-tree against LSM panel. selfTest: 12 assertions.

   The model (stated in sim.lede and api.info):
   - Time is counted in minutes from 3 Feb 00:00. The letter was written 1 Feb 21:15 and sits in
     each node's big, old SSTable (the last full merge ran 3 Feb 03:00, before the sim opens).
   - Every write a node receives lands in a new, small SSTable.
   - Nightly compaction at 03:00 merges a node's small SSTables only. A full compaction, which
     merges every SSTable on the node, runs every 12 days: 3 Feb, 15 Feb and 27 Feb at 03:00.
   - In a merge, a letter with an older timestamp than a tombstone in the same merge is dropped.
     A tombstone is dropped only if (1) it is older than gc_grace_seconds and (2) no older copy
     of the letter sits on that node outside the merge. These are the two conditions in the
     Cassandra docs (Tombstones page).
   - Hints: a node down longer than max_hint_window (3h) gets no new hints.
   - Weekly repair, Mondays 02:00 (9, 16, 23 Feb, 2 Mar), among the nodes that are on: every node
     receives every cell another holds. An absent row is not a vote, so a value beats nothing.
   - Rebuild: the returning node's disk is wiped and it streams from the nodes that are on.
   - A QUORUM read takes the first replicas to answer, in the order house, barn, (dairy, stable),
     cottage, skipping nodes that are off; quorum is 2 of 3 or 3 of 5. A tombstone with a newer
     timestamp hides the letter.
   - Soft delete: Burn writes a burned flag (an update) instead of a tombstone; the words stay.

   Where every number comes from (the case is content/s3/s3e13-v1.0.0.json; all checked by the
   selfTest):
   - Cottage off 3 Feb 09:00 for 12 days, back 15 Feb 09:00 (story). Hints for it stop at
     3 Feb 12:00, 3 h later (max_hint_window default 3h, cassandra.yaml).
   - Burn 4 Feb 22:10: 37 h 10 min after the cottage went off, so no hint.
   - gc_grace_seconds 864,000 = 10 days (default). The tombstone is 10 d 4 h 50 min old at the full
     compaction on 15 Feb 03:00, so it and the letter are both dropped on the house and the barn.
     It was 9 d 4 h 50 min old at the 14 Feb nightly run, and the letter's SSTable was not in it.
   - Repair 16 Feb 02:00 (a Monday) streams the letter back: "back" = 16 Feb 02:00.
   - Letter size 2,312 bytes (story); three copies 6,936; five copies 11,560.
   - 14 days: the 15 Feb full merge drops the letter but keeps the tombstone (10 d 4 h 50 min is
     inside 14 d); the 16 Feb repair carries the tombstone to the cottage; the 27 Feb full merge
     drops everything (22 d 4 h 50 min old). Nothing comes back.
   - 20 days down (back 23 Feb 09:00) with 14 days of grace: purged 27 Feb 03:00, back 2 Mar 02:00.

   Drawing: viewBox 660 x 250, timeline x 120 (3 Feb 08:00) to x 640 (2 Mar 12:00).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAY = 1440;
  var LETTER_TS = -1605;          // 1 Feb 21:15
  var BURN_TS = 2770;             // 4 Feb 22:10
  var START = 480;                // 3 Feb 08:00
  var DOWN_AT = 540;              // 3 Feb 09:00
  var HINT_WINDOW = 180;          // max_hint_window, 3h
  var END = 27 * DAY + 720;       // 2 Mar 12:00
  var FULL_DAYS = { 12: true, 24: true };   // 15 Feb, 27 Feb (3 Feb ran before the sim opens)
  var REPAIR_DAYS = [6, 13, 20, 27];        // Mondays 9, 16, 23 Feb, 2 Mar
  var BYTES = 2312;
  var RATE = 360;                 // sim minutes per real second while playing

  var GRACES = [
    { value: "0", label: "0 s (purge at once)" },
    { value: "864000", label: "864,000 s (10 days, the default)" },
    { value: "1209600", label: "1,209,600 s (14 days)" }
  ];
  var OUTAGES = [
    { value: "0", label: "No outage" },
    { value: "5", label: "5 days (back 8 Feb 09:00)" },
    { value: "12", label: "12 days (back 15 Feb 09:00)" },
    { value: "20", label: "20 days (back 23 Feb 09:00)" }
  ];
  var RFS = [{ value: "3", label: "3 (house, barn, cottage)" }, { value: "5", label: "5 (adds the dairy and the stable)" }];
  var RETURNS = [
    { value: "switch", label: "Switch it on; weekly repair as usual" },
    { value: "rebuild", label: "Rebuild it: wipe, then stream from the others" }
  ];
  var ALL = ["house", "barn", "dairy", "stable", "cottage"];

  /* ---------- small helpers ---------- */

  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(m) {
    var d = Math.floor(m / DAY);
    var r = m - d * DAY;
    var date = 3 + d;
    var day = date <= 28 ? date + " Feb" : (date - 28) + " Mar";
    return day + " " + two(Math.floor(r / 60)) + ":" + two(r % 60);
  }
  function dur(min) {
    var d = Math.floor(min / DAY);
    var h = Math.floor((min - d * DAY) / 60);
    var mm = min % 60;
    var out = [];
    if (d) out.push(d + " d");
    if (h) out.push(h + " h");
    if (mm) out.push(mm + " min");
    return out.length ? out.join(" ") : "0 min";
  }
  function graceLabel(sec) { return sec === 0 ? "0 s" : (sec / 86400) + " d"; }
  function the(n) { return "the " + n; }
  function list(names) {
    var a = names.map(the);
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }
  function pick(opts, v) {
    for (var i = 0; i < opts.length; i++) if (String(opts[i].value) === String(v)) return opts[i];
    return null;
  }

  /* ---------- the model ---------- */

  function nodesOf(C) { return C.rf === 5 ? ALL.slice() : ["house", "barn", "cottage"]; }
  function quorum(C) { return Math.floor(C.rf / 2) + 1; }
  function hasK(cells, k) { for (var i = 0; i < cells.length; i++) if (cells[i].k === k) return true; return false; }

  function contents(node) {
    var parts = [];
    if (hasK(node.cells, "letter")) parts.push("letter");
    if (hasK(node.cells, "tomb")) parts.push("tombstone");
    if (hasK(node.cells, "flag")) parts.push("burned flag");
    var s = parts.length ? parts.join(", ") : "nothing";
    return node.up ? s : "off: " + s;
  }

  // Resolve a set of cells the way a read does: a newer tombstone hides the letter.
  function resolve(cells) {
    var letter = null;
    var tomb = null;
    var flag = false;
    cells.forEach(function (c) {
      if (c.k === "letter" && (!letter || c.ts > letter.ts)) letter = c;
      if (c.k === "tomb" && (!tomb || c.ts > tomb.ts)) tomb = c;
      if (c.k === "flag") flag = true;
    });
    if (!letter || (tomb && tomb.ts >= letter.ts)) return "nothing";
    return flag ? "hidden (marked burned)" : "the letter";
  }

  function readQuorum(S) {
    var q = quorum(S.C);
    var asked = [];
    nodesOf(S.C).forEach(function (n) { if (S.nodes[n].up && asked.length < q) asked.push(n); });
    if (asked.length < q) return "fails (too few nodes on)";
    var cells = [];
    asked.forEach(function (n) { cells = cells.concat(S.nodes[n].cells); });
    return resolve(cells);
  }

  // One merge on one node at time T. full: every SSTable; otherwise the small ones only.
  function compact(S, name, full, T) {
    var node = S.nodes[name];
    var inSet = node.cells.filter(function (c) { return full || c.tier === "small"; });
    var outSet = node.cells.filter(function (c) { return !(full || c.tier === "small"); });
    var res = { letter: false, tomb: false, kept: false, age: 0 };
    var tomb = null;
    inSet.forEach(function (c) { if (c.k === "tomb" && (!tomb || c.ts > tomb.ts)) tomb = c; });
    if (tomb) {
      res.age = T - tomb.ts;
      inSet = inSet.filter(function (c) {
        if (c.k === "letter" && c.ts < tomb.ts) { res.letter = true; return false; }
        return true;
      });
      var older = outSet.some(function (c) { return c.k === "letter" && c.ts < tomb.ts; });
      if (res.age * 60 > S.C.grace && !older) {
        inSet = inSet.filter(function (c) { return c.k !== "tomb"; });
        res.tomb = true;
      } else {
        res.kept = true;
      }
    }
    inSet.forEach(function (c) { c.tier = full ? "big" : "small"; });
    node.cells = outSet.concat(inSet);
    return res;
  }

  // Copy into dest every cell the sources hold that dest lacks. Returns the kinds copied.
  function stream(S, dest, sources) {
    var node = S.nodes[dest];
    var got = [];
    sources.forEach(function (src) {
      S.nodes[src].cells.forEach(function (c) {
        var have = node.cells.some(function (x) { return x.k === c.k && x.ts === c.ts; });
        if (!have) {
          node.cells.push({ k: c.k, ts: c.ts, tier: "small" });
          if (got.indexOf(c.k) < 0) got.push(c.k);
        }
      });
    });
    return got;
  }

  function kindName(k) { return k === "tomb" ? "tombstone" : (k === "flag" ? "burned flag" : "letter"); }

  function buildEvents(C) {
    var ev = [];
    if (C.outage > 0) {
      ev.push({ t: DOWN_AT, kind: "down" });
      if (C.outage * DAY > HINT_WINDOW) ev.push({ t: DOWN_AT + HINT_WINDOW, kind: "hintstop" });
      ev.push({ t: DOWN_AT + C.outage * DAY, kind: "up" });
    }
    ev.push({ t: BURN_TS, kind: "burn" });
    for (var k = 1; k <= 27; k++) ev.push({ t: k * DAY + 180, kind: FULL_DAYS[k] ? "full" : "nightly", quiet: !FULL_DAYS[k] });
    REPAIR_DAYS.forEach(function (d) { ev.push({ t: d * DAY + 120, kind: "repair" }); });
    ev.push({ t: END, kind: "end" });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function letterBytes(S) {
    var n = 0;
    nodesOf(S.C).forEach(function (name) {
      S.nodes[name].cells.forEach(function (c) { if (c.k === "letter") n += 1; });
    });
    return n * BYTES;
  }

  /* ---------- events ---------- */

  function applyEvent(api, e) {
    var S = api.state;
    var C = S.C;
    var on = nodesOf(C).filter(function (n) { return S.nodes[n].up; });
    var at = when(e.t) + " · ";
    if (e.kind === "down") {
      api.log(at + "The cottage node is switched off while the floor is lifted. It holds the letter from 1 Feb 21:15.", "warn");
      S.nodes.cottage.up = false;
    } else if (e.kind === "hintstop") {
      api.log(at + "The cottage has been off 3 h, the max_hint_window. From now on no hints are kept for it.", "warn");
    } else if (e.kind === "burn") {
      var off = nodesOf(C).filter(function (n) { return !S.nodes[n].up; });
      var need = quorum(C) + " of " + C.rf + " needed";
      if (on.length < quorum(C)) {
        api.log(at + "Isaura presses Burn, but too few nodes are on (" + need + "). The burn fails.", "bad");
      } else {
        S.burned = true;
        on.forEach(function (n) { S.nodes[n].cells.push({ k: C.soft ? "flag" : "tomb", ts: BURN_TS, tier: "small" }); });
        var s = C.soft ?
          "Isaura burns her letter. Soft delete: an UPDATE at QUORUM sets burned = true on " + list(on) + " (" + need + "). The words stay." :
          "Isaura burns her letter. The DELETE at QUORUM succeeds on " + list(on) + " (" + need + "): each writes a tombstone.";
        if (off.length) {
          var gap = BURN_TS - DOWN_AT;
          s += " The cottage is off and still holds the letter; it has been off " + Math.floor(gap / 60) + " h " + (gap % 60) + " min" +
            (gap > HINT_WINDOW ? ", past the 3 h hint window, so no hint is kept for it." : ", inside the 3 h hint window, so a hint is kept for it.");
          if (gap <= HINT_WINDOW) S.hints.push({ k: C.soft ? "flag" : "tomb", ts: BURN_TS });
        }
        api.log(at + s, "warn");
      }
    } else if (e.kind === "full" || e.kind === "nightly") {
      var full = e.kind === "full";
      var groups = {};
      var order = [];
      on.forEach(function (n) {
        var r = compact(S, n, full, e.t);
        var msg = "";
        if (r.letter && r.tomb) msg = "the letter and its tombstone meet in one merge, and the tombstone is " + dur(r.age) + " old, past the " + graceLabel(C.grace) + " grace, so both are dropped";
        else if (r.letter) msg = "the tombstone hides the letter, so the letter is dropped; at " + dur(r.age) + " old the tombstone is inside the " + graceLabel(C.grace) + " grace and stays";
        else if (r.tomb) msg = "the tombstone, " + dur(r.age) + " old and past the grace, hides nothing on this node, so it is dropped";
        if (!msg) return;
        if (!groups[msg]) { groups[msg] = []; order.push(msg); }
        groups[msg].push(n);
      });
      var label = full ? "Full compaction (every SSTable)" : "Nightly compaction (small SSTables)";
      if (order.length) {
        order.forEach(function (m) { api.log(at + label + " on " + list(groups[m]) + ": " + m + ".", "warn"); });
      } else if (full) {
        api.log(at + label + " on " + list(on) + ": nothing to drop.", "");
      }
    } else if (e.kind === "repair") {
      var skipped = nodesOf(C).filter(function (n) { return !S.nodes[n].up; });
      var snap = {};
      on.forEach(function (n) { snap[n] = S.nodes[n].cells.map(function (c) { return { k: c.k, ts: c.ts, tier: c.tier }; }); });
      var tmp = { nodes: {} };
      on.forEach(function (n) { tmp.nodes[n] = { cells: snap[n] }; });
      var moved = [];
      on.forEach(function (n) {
        var got = stream(tmp, n, on.filter(function (x) { return x !== n; }));
        if (got.length) moved.push(got.map(kindName).join(" and ") + " to " + the(n));
      });
      on.forEach(function (n) {
        var fresh = tmp.nodes[n].cells;
        S.nodes[n].cells = fresh;
      });
      var r1 = "Weekly repair on " + list(on) + ". ";
      r1 += moved.length ? "Streamed: " + moved.join("; ") + "." : "All copies already match.";
      if (skipped.length) r1 += " " + list(skipped).replace(/^t/, "T") + (skipped.length > 1 ? " are" : " is") + " off and left out.";
      api.log(at + r1, moved.length ? "warn" : "");
    } else if (e.kind === "up") {
      var others = on.slice();
      var days = C.outage + (C.outage === 1 ? " day" : " days");
      if (C.ret === "rebuild") {
        var had = contents({ up: true, cells: S.nodes.cottage.cells });
        S.nodes.cottage.cells = [];
        S.nodes.cottage.up = true;
        var got = stream(S, "cottage", others);
        api.log(at + "The cottage returns after " + days + " and is rebuilt: its disk (" + had + ") is wiped and it streams from " + list(others) +
          ". It receives " + (got.length ? got.map(kindName).join(" and ") : "nothing for the letter") + ".", "ok");
      } else {
        S.nodes.cottage.up = true;
        var hint = "";
        if (S.hints.length) {
          S.hints.forEach(function (h) { S.nodes.cottage.cells.push({ k: h.k, ts: h.ts, tier: "small" }); });
          hint = " Its hint is replayed to it.";
          S.hints = [];
        } else {
          hint = " No hints wait for it.";
        }
        api.log(at + "The cottage node is switched back on after " + days + ", holding: " + contents(S.nodes.cottage) + "." + hint, "warn");
      }
    } else if (e.kind === "end") {
      api.log(at + "End of the replay. Letter bytes on disk: " + fmtN(letterBytes(S)) + ".", "");
    }
    afterEvent(api, e.t);
  }

  function afterEvent(api, t) {
    var S = api.state;
    var r = readQuorum(S);
    if (S.burned && !S.backAt && r === "the letter") {
      S.backAt = t;
      api.log(when(t) + " · A QUORUM read now returns the letter. The burned letter is back in her journal, dated 1 Feb 21:15.", "bad");
    }
    record(S, t);
  }

  function toneOf(S, label) {
    if (label.indexOf("off") === 0) return "muted";
    if (label.indexOf("letter") === 0 && label.indexOf("tombstone") < 0 && label.indexOf("flag") < 0) return S.burned ? "bad" : "ok";
    if (label === "nothing" || label === "tombstone") return "ok";
    return "warn";
  }

  function record(S, t) {
    nodesOf(S.C).forEach(function (n) {
      var lab = contents(S.nodes[n]);
      var h = S.hist[n];
      var tone = toneOf(S, lab);
      if (!h.length || h[h.length - 1][1] !== lab || h[h.length - 1][2] !== tone) h.push([t, lab, tone]);
    });
  }

  function advanceTo(api, T) {
    var S = api.state;
    if (T > END) T = END;
    while (S.ei < S.events.length && S.events[S.ei].t <= T) {
      var e = S.events[S.ei];
      S.ei += 1;
      S.t = e.t;
      applyEvent(api, e);
    }
    S.t = T;
    if (S.t >= END) S.playing = false;
    draw(api);
  }

  function nextStop(S) {
    for (var i = S.ei; i < S.events.length; i++) if (!S.events[i].quiet) return S.events[i].t;
    return END;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 120;
  var X1 = 640;
  function xOf(m) { return Math.round((X0 + (m - START) * (X1 - X0) / (END - START)) * 10) / 10; }

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
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 250", width: "100%", "class": "dg", role: "img",
      "aria-label": "One row per node from 3 February to 2 March. Green: the letter before the burn, or nothing after it. Amber: the letter with its tombstone or burned flag. Red: the letter alone after the burn. Grey: the node is off. Dashed lines mark the burn, full compactions, the return and the weekly repairs."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var panel = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;font-size:12px;");
    [["One delete in a B-tree engine (PostgreSQL, InnoDB)", [
      "Write the change to the write-ahead log first.",
      "Find the row's page through the index, root to leaf.",
      "Mark the row dead on that page (PostgreSQL) or delete-mark it (InnoDB).",
      "VACUUM or purge reclaims the space later.",
      "No older copy of the row waits in a file that never changes."]],
    ["One delete in an LSM tree (Cassandra)", [
      "Append a tombstone to the commit log.",
      "Put the tombstone in the memtable.",
      "Flush: the tombstone lands in a new SSTable. The letter's SSTable is never edited.",
      "Compaction merges them later; after gc_grace_seconds both may go.",
      "Until then, the old copy and its tombstone sit side by side."]]].forEach(function (col) {
      var d = el("div", "min-width:0;");
      d.appendChild(el("strong", "", col[0]));
      var ol = el("ol", "margin:4px 0 0 18px;padding:0;");
      col[1].forEach(function (s) { ol.appendChild(el("li", "", s)); });
      d.appendChild(ol);
      panel.appendChild(d);
    });
    box.appendChild(panel);
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
    var names = nodesOf(C);
    var marks = [];
    S.events.forEach(function (e) {
      if (e.kind === "burn") marks.push([e.t, "burn"]);
      if (e.kind === "full") marks.push([e.t, "merge"]);
      if (e.kind === "up") marks.push([e.t, "on"]);
      if (e.kind === "repair") marks.push([e.t, "repair"]);
    });
    // Labels: burn and on along the top row, merge on the second; repairs are unlabeled lines.
    marks.forEach(function (m) {
      var x = xOf(m[0]);
      mk(doc, "line", { x1: x, y1: 26, x2: x, y2: 34 + names.length * 34, "class": "dg-axis", "stroke-dasharray": "3 3" }, g);
      if (m[1] !== "repair") txt(doc, g, x, m[1] === "merge" ? 22 : 12, m[1], "dg-axis", "middle");
    });
    names.forEach(function (n, i) {
      var y = 34 + i * 34;
      txt(doc, g, X0 - 8, y + 13, n, "dg-note", "end");
      var h = S.hist[n];
      for (var k = 0; k < h.length; k++) {
        var a = h[k][0] < START ? START : h[k][0];
        var b = k + 1 < h.length ? h[k + 1][0] : S.t;
        if (b <= a && !(k === h.length - 1 && S.t === a)) continue;
        var w = Math.max(1, xOf(b) - xOf(a));
        var gg = mk(doc, "g", { "class": "dg-node st-" + h[k][2] }, g);
        mk(doc, "rect", { x: xOf(a), y: y, width: Math.round(w * 10) / 10, height: 18, rx: 3 }, gg);
      }
    });
    var nx = xOf(S.t);
    mk(doc, "line", { x1: nx, y1: 28, x2: nx, y2: 40 + names.length * 34, "class": "dg-edge" }, g);
    var by = 52 + names.length * 34;
    txt(doc, g, X0, by, "3 Feb", "dg-axis", "start");
    txt(doc, g, X1, by, "2 Mar", "dg-axis", "end");
    txt(doc, g, X0, by + 18, "Now " + when(S.t) + ". QUORUM read: " + readQuorum(S) + ".", "dg-note", "start");

    ui.head.textContent = "Grace " + graceLabel(C.grace) + ". Cottage " + (C.outage ? "off " + C.outage + " days from 3 Feb 09:00" : "never off") +
      ". Replication factor " + C.rf + ". " + (C.ret === "rebuild" ? "On return: rebuild." : "On return: switch on.") + (C.soft ? " Soft delete on." : "");

    S.stat.now(when(S.t));
    ALL.forEach(function (n) { S.stat[n](names.indexOf(n) >= 0 ? contents(S.nodes[n]) : "not built"); });
    S.stat.read(readQuorum(S));
    S.stat.back(S.backAt === null ? "no" : when(S.backAt));
    S.stat.bytes(fmtN(letterBytes(S)));
    S.stat.hints(S.hints.length);
    S.stat.outage(C.outage ? C.outage + " d down, " + graceLabel(C.grace) + " grace" : "no outage");
  }

  /* ---------- runs ---------- */

  function fresh(api) {
    var S = api.state;
    S.nodes = {};
    S.hist = {};
    ALL.forEach(function (n) {
      S.nodes[n] = { up: true, cells: [{ k: "letter", ts: LETTER_TS, tier: "big" }] };
      S.hist[n] = [];
    });
    S.t = START;
    S.ei = 0;
    S.events = buildEvents(S.C);
    S.burned = false;
    S.backAt = null;
    S.hints = [];
    S.playing = false;
    record(S, START);
  }

  function changed(api, what) {
    fresh(api);
    api.log(what + " Replay starts again at 3 Feb 08:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e13", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { grace: 864000, outage: 12, rf: 3, ret: "switch", soft: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.play = api.control.button("play", "Play / pause", function () {
        if (S.t >= END) return;
        S.playing = !S.playing;
      });
      S.ctl.next = api.control.button("next", "Next event", function () {
        S.playing = false;
        advanceTo(api, nextStop(S));
      });
      S.ctl.end = api.control.button("end", "Run to the end", function () {
        S.playing = false;
        advanceTo(api, END);
      });
      S.ctl.grace = api.control.select("grace", "gc_grace_seconds", GRACES, "864000", function (v) {
        var o = pick(GRACES, v);
        if (!o) return;
        S.C.grace = Number(o.value);
        changed(api, "gc_grace_seconds: " + fmtN(S.C.grace) + " (" + graceLabel(S.C.grace) + ").");
      });
      S.ctl.outage = api.control.select("outage", "Cottage outage from 3 Feb 09:00", OUTAGES, "12", function (v) {
        var o = pick(OUTAGES, v);
        if (!o) return;
        S.C.outage = Number(o.value);
        changed(api, "Cottage outage: " + o.label + ".");
      });
      S.ctl.rf = api.control.select("rf", "Replication factor", RFS, "3", function (v) {
        var o = pick(RFS, v);
        if (!o) return;
        S.C.rf = Number(o.value);
        changed(api, "Replication factor: " + S.C.rf + (S.C.rf === 5 ? ", with the dairy and the stable added." : "."));
      });
      S.ctl.ret = api.control.select("ret", "When the cottage returns", RETURNS, "switch", function (v) {
        var o = pick(RETURNS, v);
        if (!o) return;
        S.C.ret = String(o.value);
        changed(api, "When the cottage returns: " + o.label + ".");
      });
      S.ctl.soft = api.control.toggle("soft", "Soft delete (Burn sets a flag instead)", false, function (on) {
        S.C.soft = !!on;
        changed(api, "Soft delete: " + (on ? "on." : "off."));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        now: api.stat("now", "now", ""),
        house: api.stat("house", "house node", ""),
        barn: api.stat("barn", "barn node", ""),
        cottage: api.stat("cottage", "cottage node (under the floor)", ""),
        dairy: api.stat("dairy", "dairy node", ""),
        stable: api.stat("stable", "stable node", ""),
        read: api.stat("read", "QUORUM read of the letter", "warn"),
        back: api.stat("back", "burned letter back in the journal", "bad"),
        bytes: api.stat("bytes", "letter bytes on disk, all nodes", "warn"),
        hints: api.stat("hints", "hints held for the cottage", ""),
        outage: api.stat("outage", "outage against the grace", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one node's copy of Isaura's letter over time. A delete is a write: a tombstone lands in a new SSTable and the old SSTable keeps the letter. Nightly compaction at 03:00 merges small SSTables; a full compaction on 15 and 27 Feb merges all of them. A tombstone goes only when it is older than gc_grace_seconds and every older copy on that node is in the same merge. Weekly repair runs Mondays at 02:00 among the nodes that are on.");

      fresh(api);
      api.log("3 Feb 08:00 · Hollinmere's three nodes each hold Isaura's letter (2,312 bytes, written 1 Feb 21:15). gc_grace_seconds is 864,000.", "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.playing) return;
      advanceTo(api, S.t + dt * RATE);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before the cottage goes off.
      t.expect(t.stat("now") === "3 Feb 08:00" && t.stat("house") === "letter" && t.stat("barn") === "letter" &&
        t.stat("cottage") === "letter" && t.stat("dairy") === "not built" && t.stat("read") === "the letter" &&
        t.stat("back") === "no" && t.stat("bytes") === "6,936" && t.stat("hints") === 0 && t.stat("outage") === "12 d down, 10 d grace",
        "Opens at 3 Feb 08:00: three copies of the letter, 6,936 bytes, read returns the letter");

      // 2. The cottage goes off, then the hint window passes.
      t.click("next");
      var off9 = t.stat("now") === "3 Feb 09:00" && t.stat("cottage") === "off: letter";
      t.click("next");
      t.expect(off9 && has("3 Feb 09:00 · The cottage node is switched off while the floor is lifted.") &&
        has("3 Feb 12:00 · The cottage has been off 3 h, the max_hint_window."),
        "3 Feb 09:00: the cottage node is switched off, still holding the letter; 3 Feb 12:00: hints for it stop");

      // 3. The burn.
      t.click("next");
      t.expect(t.stat("house") === "letter, tombstone" && t.stat("barn") === "letter, tombstone" && t.stat("cottage") === "off: letter" &&
        t.stat("read") === "nothing" && t.stat("hints") === 0 &&
        has("4 Feb 22:10 · Isaura burns her letter. The DELETE at QUORUM succeeds on the house and the barn (2 of 3 needed): each writes a tombstone.") &&
        has("it has been off 37 h 10 min, past the 3 h hint window, so no hint is kept for it."),
        "4 Feb 22:10: tombstones on the house and the barn, none on the cottage, no hint");

      // 4. The 9 Feb repair leaves the cottage out; nightly merges keep the tombstone.
      t.click("next");
      t.expect(t.stat("now") === "9 Feb 02:00" && t.stat("house") === "letter, tombstone" &&
        has("The cottage is off and left out."),
        "9 Feb 02:00: repair runs without the cottage; the letter and its tombstone are still on the house");

      // 5. The full compaction on 15 Feb 03:00 drops both.
      t.click("next");
      t.expect(t.stat("house") === "nothing" && t.stat("barn") === "nothing" &&
        has("15 Feb 03:00 · Full compaction (every SSTable) on the house and the barn: the letter and its tombstone meet in one merge, and the tombstone is 10 d 4 h 50 min old, past the 10 d grace, so both are dropped."),
        "15 Feb 03:00: tombstone 10 d 4 h 50 min old, letter in the same merge: both dropped");

      // 6. The cottage returns; reads at QUORUM still miss it.
      t.click("next");
      t.expect(t.stat("now") === "15 Feb 09:00" && t.stat("cottage") === "letter" && t.stat("read") === "nothing" && t.stat("bytes") === "2,312" &&
        has("The cottage node is switched back on after 12 days, holding: letter. No hints wait for it."),
        "15 Feb 09:00: the cottage is back with the only copy; 2,312 bytes on disk");

      // 7. The 16 Feb repair streams it back.
      t.click("next");
      t.expect(t.stat("house") === "letter" && t.stat("barn") === "letter" && t.stat("read") === "the letter" && t.stat("back") === "16 Feb 02:00" &&
        has("16 Feb 02:00 · Weekly repair on the house, the barn and the cottage. Streamed: letter to the house; letter to the barn.") &&
        has("The burned letter is back in her journal, dated 1 Feb 21:15."),
        "16 Feb 02:00: repair streams the letter to the house and the barn; it is back");
      t.click("end");
      t.expect(t.stat("now") === "2 Mar 12:00" && t.stat("bytes") === "6,936" && t.stat("read") === "the letter",
        "2 Mar 12:00: three copies again, 6,936 bytes");

      // 8. Option outcomes: grace 0, replication factor 5.
      t.set("grace", "0");
      t.click("end");
      var g0 = t.stat("back");
      t.set("grace", "864000");
      t.set("rf", "5");
      t.click("end");
      t.expect(g0 === "16 Feb 02:00" && t.stat("back") === "16 Feb 02:00" && t.stat("bytes") === "11,560" &&
        has("on the house, the barn, the dairy and the stable (3 of 5 needed)"),
        "Grace 0: still back 16 Feb 02:00. Replication factor 5: back 16 Feb 02:00, five copies, 11,560 bytes");
      t.set("rf", "3");

      // 9. Grace 14 days saves the 12-day outage but not a 20-day one.
      t.set("grace", "1209600");
      t.click("end");
      var g14 = t.stat("back") === "no" && t.stat("bytes") === 0 && t.stat("read") === "nothing" &&
        has("at 10 d 4 h 50 min old the tombstone is inside the 14 d grace and stays");
      t.set("outage", "20");
      t.click("end");
      t.expect(g14 && t.stat("back") === "2 Mar 02:00",
        "14 days of grace: nothing returns after 12 days down; after 20 days down the letter is back 2 Mar 02:00");

      // 10. Rebuild instead of switching on.
      t.set("ret", "rebuild");
      t.click("end");
      var rb20 = t.stat("back") === "no" && t.stat("bytes") === 0;
      t.set("grace", "864000");
      t.set("outage", "12");
      t.click("end");
      t.expect(rb20 && t.stat("back") === "no" && t.stat("bytes") === 0 && t.stat("read") === "nothing" &&
        has("is wiped and it streams from the house and the barn. It receives nothing for the letter."),
        "Rebuild: the cottage's old copy is wiped and nothing comes back, after 12 or 20 days down");

      // 11. Soft delete: never back, never gone.
      t.set("ret", "switch");
      t.click("soft");
      t.click("end");
      t.expect(t.stat("back") === "no" && t.stat("read") === "hidden (marked burned)" && t.stat("bytes") === "6,936" &&
        t.stat("cottage") === "letter, burned flag",
        "Soft delete: the letter stays hidden, and its 6,936 bytes stay on disk");
    }
  });
})();
