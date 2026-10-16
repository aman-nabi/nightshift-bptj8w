/* sims/w12-v1.0.0.js  (published as sims/w12.js)
   Workshop case w12 "The Folder Inside Itself": a workbench for the print queue Odgerel finished
   for a sign shop: an in-memory file tree whose folders report their total size, a run sheet
   of links to job folders, a size report at 01:00 and a print run that walks each job folder.
   Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the drag (harbour-fest onto proofs, the Wednesday slip;
     harbour-fest onto ready, as meant; ferry-times onto winter, the Friday 23 October slip),
     the design (as built; size walk stops at 100 levels; size report skips folders already
     counted; move copies then deletes; move walks up from the target first), Step, Play the
     night, Reset. Stats: the move, walk-up checks, MB copied, folders lost from the folder list,
     the size report, the dragged job's total, the run, jobs printed. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - The tree: queue (top) holds ready and drafts. ready holds bakery-menus (menu-board.pdf
     46 MB) and ferry-times (summer.pdf 28 MB, and winter, holding winter.pdf 36 MB). drafts
     holds harbour-fest (banner-1.tif and banner-2.tif, 380 MB each, and proofs, holding
     proof-a.pdf and proof-b.pdf, 12 MB each). 8 folders in all.
   - A walk keeps a to-do list: take the first folder off, add its files, put its subfolders on
     the end, repeat until the list is empty. The job folder is level 1.
   - move, as built: take the item out of its old parent's children, put it into the target's
     children, set its parent to the target. No check.
   - The run sheet links straight to bakery-menus, harbour-fest and ferry-times, in that order.
   - 01:00 size report: each job's walk. If every walk ends, the run starts at once and sends
     each job of 2,000 MB or less by a plain walk (no level limit, no counted list).
   - The bench stops any walk after 1,000 folders and calls it never-ending.
   - Copying runs at 200 MB a second.

   Where every number comes from (conventions rule 14; the case is content/s5/w12-v1.0.0.json).
   Given data: the tree and file sizes above, 21:40 run sheet, 22:50 drag, 01:00 report,
   2,000 MB printer limit, 200 MB a second, the bench's 1,000-folder stop.
   - harbour-fest: 760 MB of files + proofs 24 MB = 784 MB. ferry-times: 28 + 36 = 64 MB.
   - Slip, as built: the walk alternates harbour-fest and proofs; after 1,000 folders,
     500 x 760 + 500 x 24 = 392,000 MB so far. The run never starts; 0 printed. 2 folders lost.
   - Slip, level limit 100: levels 1 to 100, 50 harbour-fest + 50 proofs = 50 x 784 = 39,200 MB,
     over 2,000: skipped. bakery-menus and ferry-times printed: 2.
     Friday slip: 50 x 28 + 50 x 36 = 3,200 MB, skipped; 2 printed.
   - Counted list: slip 784 MB; the run's plain walk of harbour-fest goes round: banner-1.tif,
     banner-2.tif, proof-a.pdf, proof-b.pdf, banner-1.tif ...; ferry-times never sent: 1 printed.
     Friday slip: 64 MB; ferry-times goes round summer.pdf, winter.pdf, ...: 2 printed.
   - Copy then delete: the copy walks harbour-fest and meets proofs: refused, 0 copied, 3 printed.
     Meant drop on ready: 784 MB copied, 784 / 200 = 3.92 s.
   - Walk up: slip: proofs (1), harbour-fest (2), the item: refused. Meant: ready (1), queue (2),
     top: moved. Friday slip: winter (1), ferry-times (2): refused.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAY = 86400;
  function at(h, m, s) { var t = h * 3600 + m * 60 + s; return h < 12 ? t + DAY : t; }
  var OPEN = at(21, 30, 0);
  var T_SHEET = at(21, 40, 0);
  var T_DRAG = at(22, 50, 0);
  var T_REPORT = at(1, 0, 0);
  var LIMIT = 2000;      // MB the printer can hold
  var COPY = 200;        // MB a second
  var CAP = 1000;        // the bench stops a walk after this many folders
  var LEVELS = 100;      // the level limit

  var DRAGS = [
    { value: "slip", label: "harbour-fest onto proofs (Wednesday's slip)", item: "harbour-fest", target: "proofs" },
    { value: "meant", label: "harbour-fest onto ready (as Phelim meant)", item: "harbour-fest", target: "ready" },
    { value: "ferry", label: "ferry-times onto winter (the slip of Friday 23 October)", item: "ferry-times", target: "winter" }
  ];
  var DESIGNS = [
    { value: "built", label: "as built: move with no check" },
    { value: "depth", label: "size walk stops after 100 levels" },
    { value: "seen", label: "size report skips folders already counted" },
    { value: "copy", label: "move copies into the target, then deletes" },
    { value: "check", label: "move walks up from the target first" }
  ];

  function build() {
    var all = {};
    function folder(name, parent) {
      var f = { name: name, kind: "folder", mb: 0, parent: parent || null, children: [] };
      if (parent) parent.children.push(f);
      all[name] = f;
      return f;
    }
    function file(name, mb, parent) { parent.children.push({ name: name, kind: "file", mb: mb, parent: parent }); }
    var queue = folder("queue");
    var ready = folder("ready", queue);
    var drafts = folder("drafts", queue);
    var bakery = folder("bakery-menus", ready);
    file("menu-board.pdf", 46, bakery);
    var ferry = folder("ferry-times", ready);
    file("summer.pdf", 28, ferry);
    var winter = folder("winter", ferry);
    file("winter.pdf", 36, winter);
    var harbour = folder("harbour-fest", drafts);
    file("banner-1.tif", 380, harbour);
    file("banner-2.tif", 380, harbour);
    var proofs = folder("proofs", harbour);
    file("proof-a.pdf", 12, proofs);
    file("proof-b.pdf", 12, proofs);
    return { all: all, top: queue, sheet: [bakery, harbour, ferry] };
  }

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(t) { t = ((t % DAY) + DAY) % DAY; return pad(Math.floor(t / 3600)) + ":" + pad(Math.floor(t / 60) % 60) + ":" + pad(t % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // A walk with a to-do list. mode: "plain", "depth" (stop going down at level 100),
  // "seen" (skip a folder met again). Stops after CAP folders.
  function walk(start, mode) {
    var todo = [{ f: start, lvl: 1 }];
    var r = { mb: 0, visits: 0, files: [], skipped: 0, ended: true, deepest: 1 };
    var seen = [];
    while (todo.length) {
      if (r.visits >= CAP) { r.ended = false; return r; }
      var e = todo.shift();
      if (mode === "seen") {
        if (seen.indexOf(e.f) >= 0) { r.skipped += 1; continue; }
        seen.push(e.f);
      }
      r.visits += 1;
      if (e.lvl > r.deepest) r.deepest = e.lvl;
      e.f.children.forEach(function (c) { if (c.kind === "file") { r.mb += c.mb; r.files.push(c.name); } });
      e.f.children.forEach(function (c) {
        if (c.kind === "folder" && !(mode === "depth" && e.lvl >= LEVELS)) todo.push({ f: c, lvl: e.lvl + 1 });
      });
    }
    return r;
  }

  function lostCount(tree) {
    var reach = walk(tree.top, "seen");
    var total = 0;
    for (var k in tree.all) if (Object.prototype.hasOwnProperty.call(tree.all, k)) total += 1;
    return total - reach.visits;
  }

  function relink(item, target) {
    var old = item.parent;
    old.children.splice(old.children.indexOf(item), 1);
    target.children.push(item);
    item.parent = target;
    return old;
  }

  /* ---------- the model: one night, as a list of steps ---------- */

  function run(C) {
    var tree = build();
    var drag = pick(DRAGS, C.drag);
    var item = tree.all[drag.item];
    var target = tree.all[drag.target];
    var steps = [];
    var st = { move: "not yet", checks: 0, copied: 0, lost: 0, report: "not run yet", job: "not counted yet", run: "not started", printed: 0 };
    function push(t, msg, tone) {
      var s = { t: t, msg: hms(t) + " " + msg, tone: tone || "" };
      for (var k in st) if (Object.prototype.hasOwnProperty.call(st, k)) s[k] = st[k];
      steps.push(s);
    }

    push(T_SHEET, "Yrsa puts bakery-menus, harbour-fest and ferry-times on the run sheet: 3 links.", "");

    // 22:50: the drag.
    var head = "Phelim drops " + item.name + " onto " + target.name + ". ";
    var msg, tone;
    if (C.design === "check") {
      var n = 0, x = target, bits = [], hit = false;
      while (x) {
        n += 1;
        if (x === item) { bits.push("check " + n + ", " + x.name + ", the item itself"); hit = true; break; }
        bits.push("check " + n + ", " + x.name + ", not " + item.name);
        x = x.parent;
      }
      st.checks = n;
      if (hit) {
        st.move = "refused";
        msg = head + "Walking up: " + bits.join("; ") + ": refused, a folder can't go inside itself. Nothing moves.";
        tone = "ok";
      } else {
        relink(item, target);
        st.move = "moved";
        msg = head + "Walking up: " + bits.join("; ") + "; top reached: moved.";
        tone = "ok";
      }
    } else if (C.design === "copy") {
      var met = false;
      var todo = [item];
      while (todo.length) {
        var f = todo.shift();
        if (f === target) { met = true; break; }
        f.children.forEach(function (c) { if (c.kind === "folder") todo.push(c); });
      }
      if (met) {
        st.move = "refused";
        msg = head + "The copy walks down " + item.name + " and meets " + target.name + ", the target: refused, a folder can't go inside itself. Nothing moves.";
        tone = "ok";
      } else {
        var size = walk(item, "plain").mb;
        st.copied = size;
        relink(item, target);
        st.move = "moved";
        msg = head + "The copy walks down " + item.name + " without meeting " + target.name + ", copies " + fmt(size) + " MB at " + COPY +
          " MB a second (" + (size / COPY).toFixed(2) + " s, the memory holding both), then deletes the old one.";
        tone = "warn";
      }
    } else {
      var old = relink(item, target);
      st.move = "moved";
      st.lost = lostCount(tree);
      msg = head + "move takes it out of " + old.name + ", puts it in " + target.name + " and sets its parent to " + target.name + ". No message." +
        (st.lost ? " " + item.name + " and " + target.name + " now hold each other: " + st.lost + " folders lost from the folder list." : "");
      tone = st.lost ? "bad" : "";
    }
    st.lost = lostCount(tree);
    push(T_DRAG, msg, tone);

    // 01:00: the size report.
    st.report = "running";
    push(T_REPORT, "size report, " + tree.sheet.length + " jobs on the run sheet.", "");
    var sizes = [];
    var hung = false;
    for (var i = 0; i < tree.sheet.length; i++) {
      var job = tree.sheet[i];
      var mode = C.design === "depth" ? "depth" : (C.design === "seen" ? "seen" : "plain");
      var w = walk(job, mode);
      var text;
      if (!w.ended) {
        hung = true;
        text = job.name + ": counting... the walk goes round and never ends. The bench stops it after " + fmt(CAP) + " folders at " + fmt(w.mb) + " MB.";
        if (job === item) st.job = "never finishes (" + fmt(w.mb) + " MB when the bench stopped)";
        st.report = "never finishes";
        push(T_REPORT, text, "bad");
        break;
      }
      sizes.push(w.mb);
      text = job.name + ": " + fmt(w.mb) + " MB";
      if (mode === "depth" && w.deepest >= LEVELS) text += " (the walk stopped at " + LEVELS + " levels)";
      if (w.skipped) text += " (" + w.skipped + " folder met again and skipped)";
      text += ".";
      if (w.mb > LIMIT) text += " Over the printer's " + fmt(LIMIT) + " MB: the run will skip it.";
      if (job === item) st.job = fmt(w.mb) + " MB";
      push(T_REPORT, text, w.mb > LIMIT ? "bad" : "");
    }
    if (hung) {
      st.run = "never started";
      push(T_REPORT, "the run waits for the report and never starts.", "bad");
      return { steps: steps, drag: drag };
    }
    st.report = "finished";
    st.run = "started at " + hms(T_REPORT);
    push(T_REPORT, "the run starts.", "ok");

    // The run: send each job by a plain walk.
    for (var j = 0; j < tree.sheet.length; j++) {
      var jb = tree.sheet[j];
      if (sizes[j] > LIMIT) {
        push(T_REPORT, "skips " + jb.name + ": " + fmt(sizes[j]) + " MB is over " + fmt(LIMIT) + " MB.", "bad");
        continue;
      }
      var sw = walk(jb, "plain");
      if (!sw.ended) {
        var rest = tree.sheet.slice(j + 1).map(function (q) { return q.name; });
        push(T_REPORT, "sends " + jb.name + ": " + sw.files.slice(0, 5).join(", ") + ", and round again; the bench stops it after " +
          fmt(CAP) + " folders." + (rest.length ? " " + rest.join(" and ") + " never sent." : ""), "bad");
        return { steps: steps, drag: drag };
      }
      st.printed += 1;
      push(T_REPORT, "sends " + jb.name + ": " + sw.files.join(", ") + ". Done.", "ok");
    }
    return { steps: steps, drag: drag };
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
    ["time", "what happens"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody };
  }

  var BLANK = { move: "not yet", checks: 0, copied: 0, lost: 0, report: "not run yet", job: "not counted yet", run: "not started", printed: 0 };

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = S.shown ? S.N.steps[S.shown - 1] : BLANK;
    S.ui.head.textContent = "drag: " + S.N.drag.label + ". design: " + pick(DESIGNS, C.design).label +
      ". steps shown: " + S.shown + " of " + S.N.steps.length + ".";
    clear(S.ui.tbody);
    for (var i = 0; i < S.shown; i++) {
      var s = S.N.steps[i];
      var tr = S.ui.el("tr");
      tr.appendChild(S.ui.el("td", "", hms(s.t)));
      tr.appendChild(S.ui.el("td", "", s.msg.slice(9)));
      S.ui.tbody.appendChild(tr);
    }
    S.stat.move(r.move);
    S.stat.checks(r.checks);
    S.stat.copied(r.copied);
    S.stat.lost(r.lost);
    S.stat.report(r.report);
    S.stat.job(r.job);
    S.stat.run(r.run);
    S.stat.printed(r.printed);
    api.clock = (S.shown ? S.N.steps[S.shown - 1].t : OPEN) % DAY;
    S.ctl.step.disable(S.shown >= S.N.steps.length);
    S.ctl.play.disable(S.shown >= S.N.steps.length);
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < S.N.steps.length) {
      var s = S.N.steps[S.shown];
      S.shown += 1;
      api.clock = s.t % DAY;
      api.log(s.msg, s.tone);
    }
  }

  function summary(api) {
    var S = api.state;
    var r = S.N.steps[S.N.steps.length - 1];
    api.log("Night replayed (" + pick(DESIGNS, S.C.design).label + "): the move " + r.move + ", report " + r.report + ", " +
      r.printed + " of 3 jobs printed, " + r.lost + " folders lost from the folder list.",
      r.printed === 3 && r.lost === 0 ? "ok" : "bad");
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

  DL.sims.define("w12", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { drag: "slip", design: "built" };
      S.N = run(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.drag = api.control.select("drag", "the drag", DRAGS, "slip", function (v) {
        var o = pick(DRAGS, v);
        if (!o) return;
        S.C.drag = String(o.value);
        replay(api);
      });
      S.ctl.design = api.control.select("design", "the design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Play the night", function () {
        showTo(api, S.N.steps.length);
        summary(api);
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        move: api.stat("move", "the move", ""),
        checks: api.stat("checks", "walk-up checks", ""),
        copied: api.stat("copied", "MB copied by the move", "warn"),
        lost: api.stat("lost", "folders lost from the folder list", "bad"),
        report: api.stat("report", "the size report", ""),
        job: api.stat("job", "the dragged job's total in the report", ""),
        run: api.stat("run", "the print run", ""),
        printed: api.stat("printed", "jobs printed, of 3", "ok")
      };

      api.info("<strong>How to read it.</strong> The queue's folders hang from one top folder. The run sheet links straight to three job folders. " +
        "At 22:50 one drag moves a folder; at 01:00 the size report walks each job with a to-do list, then the run sends each job by walking it again. " +
        "The bench stops any walk after 1,000 folders. Folders lost from the folder list are ones nothing below the top folder leads to. " +
        "Step moves one event; Play runs the rest.");

      api.log(hms(OPEN) + ". Wednesday 14 October at the bench. The drag: " + pick(DRAGS, S.C.drag).label + ". Press Step or Play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 21:30:00, before the run sheet is set.
      t.expect(t.stat("move") === "not yet" && t.stat("lost") === 0 && t.stat("report") === "not run yet" &&
        t.stat("printed") === 0 && t.stat("run") === "not started" &&
        has("21:30:00. Wednesday 14 October at the bench. The drag: harbour-fest onto proofs (Wednesday's slip)."),
        "Opens at 21:30:00: nothing moved, no report, nothing printed");

      // 2. Two steps: the run sheet, then the slip at 22:50.
      t.click("step");
      t.click("step");
      t.expect(has("21:40:00 Yrsa puts bakery-menus, harbour-fest and ferry-times on the run sheet: 3 links.") &&
        has("22:50:00 Phelim drops harbour-fest onto proofs. move takes it out of drafts, puts it in proofs and sets its parent to proofs. No message. harbour-fest and proofs now hold each other: 2 folders lost from the folder list.") &&
        t.stat("move") === "moved" && t.stat("lost") === 2,
        "22:50: harbour-fest goes into its own subfolder; 2 folders lost from the folder list");

      // 3. The rest, as built: the report never finishes and the run never starts.
      t.click("play");
      t.expect(has("01:00:00 bakery-menus: 46 MB.") &&
        has("01:00:00 harbour-fest: counting... the walk goes round and never ends. The bench stops it after 1,000 folders at 392,000 MB.") &&
        has("01:00:00 the run waits for the report and never starts.") &&
        t.stat("report") === "never finishes" && t.stat("run") === "never started" && t.stat("printed") === 0,
        "As built: bakery-menus 46 MB, harbour-fest never finishes, the run never starts");

      // 4. The drop Phelim meant: 784 MB, all three jobs printed.
      t.set("drag", "meant");
      t.expect(t.stat("lost") === 0 && t.stat("job") === "784 MB" && t.stat("printed") === 3 &&
        t.stat("run") === "started at 01:00:00" && has("01:00:00 ferry-times: 64 MB."),
        "Dropped on ready: harbour-fest 784 MB, ferry-times 64 MB, 3 jobs printed");

      // 5. Level limit, Wednesday's slip: 39,200 MB, skipped.
      t.set("drag", "slip");
      t.set("design", "depth");
      t.expect(has("01:00:00 harbour-fest: 39,200 MB (the walk stopped at 100 levels). Over the printer's 2,000 MB: the run will skip it.") &&
        has("01:00:00 skips harbour-fest: 39,200 MB is over 2,000 MB.") &&
        t.stat("job") === "39,200 MB" && t.stat("printed") === 2 && t.stat("lost") === 2,
        "Level limit: harbour-fest reported as 39,200 MB and skipped; 2 printed; the loop stays");

      // 6. Level limit, Friday's slip: ferry-times 3,200 MB.
      t.set("drag", "ferry");
      t.expect(t.stat("job") === "3,200 MB" && t.stat("printed") === 2 && has("01:00:00 skips ferry-times: 3,200 MB is over 2,000 MB."),
        "Level limit, ferry-times onto winter: 3,200 MB, skipped");

      // 7. Counted list, Friday's slip: the report is right, the run goes round.
      t.set("design", "seen");
      t.expect(t.stat("job") === "64 MB" && t.stat("report") === "finished" && t.stat("printed") === 2 &&
        has("01:00:00 sends ferry-times: summer.pdf, winter.pdf, summer.pdf, winter.pdf, summer.pdf, and round again; the bench stops it after 1,000 folders."),
        "Counted list, Friday: ferry-times 64 MB, but the run prints summer and winter round and round");

      // 8. Counted list, Wednesday's slip: 784 MB, then the banners round and round.
      t.set("drag", "slip");
      t.expect(has("01:00:00 harbour-fest: 784 MB (1 folder met again and skipped).") &&
        has("01:00:00 sends harbour-fest: banner-1.tif, banner-2.tif, proof-a.pdf, proof-b.pdf, banner-1.tif, and round again; the bench stops it after 1,000 folders. ferry-times never sent.") &&
        t.stat("printed") === 1 && t.stat("lost") === 2,
        "Counted list, Wednesday: 784 MB, then the sender goes round; 1 printed");

      // 9. Copy then delete, Wednesday's slip: refused.
      t.set("design", "copy");
      t.expect(has("22:50:00 Phelim drops harbour-fest onto proofs. The copy walks down harbour-fest and meets proofs, the target: refused, a folder can't go inside itself. Nothing moves.") &&
        t.stat("move") === "refused" && t.stat("copied") === 0 && t.stat("lost") === 0 && t.stat("printed") === 3,
        "Copy then delete: the slip is refused; 3 printed");

      // 10. Copy then delete, the meant drop: 784 MB copied in 3.92 s.
      t.set("drag", "meant");
      t.expect(has("copies 784 MB at 200 MB a second (3.92 s, the memory holding both), then deletes the old one.") &&
        t.stat("copied") === 784 && t.stat("move") === "moved" && t.stat("printed") === 3,
        "Copy then delete, dropped on ready: 784 MB copied, 3.92 s");

      // 11. Walk up from the target, the meant drop: 2 checks, moved.
      t.set("design", "check");
      t.expect(has("22:50:00 Phelim drops harbour-fest onto ready. Walking up: check 1, ready, not harbour-fest; check 2, queue, not harbour-fest; top reached: moved.") &&
        t.stat("checks") === 2 && t.stat("move") === "moved" && t.stat("copied") === 0 && t.stat("printed") === 3,
        "Walk up, dropped on ready: 2 checks, moved, nothing copied");

      // 12. Walk up from the target, both slips: refused at check 2.
      t.set("drag", "slip");
      var w1 = has("Walking up: check 1, proofs, not harbour-fest; check 2, harbour-fest, the item itself: refused, a folder can't go inside itself.") &&
        t.stat("checks") === 2 && t.stat("move") === "refused" && t.stat("lost") === 0 && t.stat("printed") === 3;
      t.set("drag", "ferry");
      t.expect(w1 && has("check 1, winter, not ferry-times; check 2, ferry-times, the item itself: refused") &&
        t.stat("checks") === 2 && t.stat("printed") === 3 && t.stat("job") === "64 MB",
        "Walk up: both slips refused at check 2; 3 printed");
    }
  });
})();
