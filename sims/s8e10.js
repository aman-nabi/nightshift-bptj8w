/* sims/s8e10-v1.0.0.js  (published as sims/s8e10.js)
   Case s8e10 "Rumors and Quorums": a quorum lab for a night wholesale produce market's stock book.
   Lot 7714's record lives on three home servers, A, B and C. A write counts once 2 copies say yes
   within 2 seconds; a read takes the first 2 answers (B and C, near the scanners, before A, across
   the yard). The servers learn who is up by gossip. When a home server is dead, a rented stand-in, D,
   says yes when fewer than 2 home copies answer, and keeps a note for the dead server. On Thursday 15
   October 2026 C was down for an upgrade from 00:30 to 02:00 and B was compacting from 00:35 to 01:02,
   dropping every write it could not store in time. The 00:40 recall flag was counted on A and D. A
   cost rule added on Thursday 8 October removed D at 01:30, 30 minutes after its last write, with 6
   notes for C undelivered. At 03:15 a buyer's scan read B and C: clean.
   The learner sets C's downtime, B's compacting, how a safety flag is counted, the removal rule, a tree
   repair, the gossip interval and the read and write counts, then plays 00:30 to 03:30 and reads which
   servers hold the flag over time, D's notes, each write's and read's servers, the 03:15 result and
   the writes refused while a server is down.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls C's upgrade, B's compacting, how the flag counts,
     stand-in removal, tree repair, gossip interval, write and read counts; Play 00:30 to 03:30;
     Reset. Stats: C declared dead after, 00:40 flag yes from, the flag, D's notes for C, D removed
     at, other writes refused, the 03:15 read asked, the 03:15 scan, flag held at 03:15 by, the
     night. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e10-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Writes to records on A, B and C: one every 5 minutes, 00:30 to 03:30 (37 writes). The 00:40
     one is the recall flag; a refused flag is retried at each later 5-minute mark.
   - C stops at 00:30:00 and is back at 02:00:00. SWIM on the gossip beat: a probe one interval
     after, suspect, dead 5 s later, then 2 rounds of gossip: 1 + 5 + 2 = 8 s (00:30:08) at 1 s;
     0.1 + 5 + 0.2 = 5.3 s at 0.1 s. Stand-in D is rented the moment C is declared dead. D hears that
     C is back 2 rounds after 02:00: 02:00:02 (or 02:00:00.2).
   - B compacts from 00:35:00 to 01:02:00: it misses the 2-second deadline on the writes at 00:35,
     00:40, 00:45, 00:50, 00:55 and 01:00 and drops them. Gossip calls B alive, so no note is kept.
   - As built (W 2, a stand-in's yes counts): 00:35 to 01:00 each write gets yes from A and D, with a
     note for C: 6 notes, the flag's among them. D's last write 01:00; the cost rule removes it at
     01:30 with all 6. The 03:15 read takes B and C: clean. The flag is held only by A.
   - Safety flags on home copies only: 00:40 A alone, NOT SAVED; refused at 00:40, 00:45, 00:50,
     00:55 and 01:00 (5 times), saved at 01:05 on A and B. D then holds 5 notes (no flag).
   - Removal only once notes are handed over: D hands its notes to C at 02:00:02 and is removed then.
   - Tree repair every hour at half past (01:30, 02:30, 03:30): compares the home copies that are up
     and copies the flag to any that lack it. As built, B gets it at 01:30 and C at 02:30.
   - All three copies (W 3, R 3): no write can count while C is down. The 17 other writes from 00:30
     to 01:55 are refused; the flag is refused 16 times (00:40 to 01:55) and saved at 02:00. A refused
     write stays on the copies that said yes (A from 00:40, B from 01:05).
   - Nearest single copy (R 1): the 03:15 read asks B alone.
   - B not compacting: the 00:40 flag gets yes from A and B, D takes no write and is removed at
     01:00:08, 30 minutes after it was rented.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in tenths of a second) ---------- */

  function at(h, m, s) { return (h * 3600 + m * 60 + s) * 10; }
  var START = at(0, 30, 0);
  var END = at(3, 30, 0);
  var FLAG_T = at(0, 40, 0);
  var C_DOWN = at(0, 30, 0);
  var C_UP = at(2, 0, 0);
  var B_FROM = at(0, 35, 0);
  var B_TO = at(1, 2, 0);
  var READ_T = at(3, 15, 0);
  var EVERY = 3000;                 // a write every 5 minutes
  var IDLE = 18000;                 // 30 minutes with no writes
  var SUSPECT = 50;                 // 5 seconds as suspect
  var ROUNDS = 2;                   // gossip rounds to reach every server
  var REPAIRS = [at(1, 30, 0), at(2, 30, 0), at(3, 30, 0)];
  var SNAPS = [at(0, 40, 0), at(1, 5, 0), at(1, 30, 0), at(2, 5, 0), at(2, 30, 0), at(3, 15, 0)];
  var ORDER = ["B", "C", "A"];      // who answers a read first

  var DOWNS = [
    { value: "upgrade", label: "down 00:30 to 02:00 for its upgrade (as built)" },
    { value: "none", label: "no upgrade tonight" }
  ];
  var COMPACTS = [
    { value: "on", label: "compacting 00:35 to 01:02, missing deadlines (as built)" },
    { value: "off", label: "not compacting tonight" }
  ];
  var COUNTS = [
    { value: "sloppy", label: "a stand-in's yes counts (as built)" },
    { value: "strict", label: "home copies only, for safety flags" }
  ];
  var REMOVALS = [
    { value: "idle", label: "after 30 minutes with no writes (as built)" },
    { value: "notes", label: "after 30 minutes with no writes, once every note is handed over" }
  ];
  var FIXES = [
    { value: "none", label: "none (as built)" },
    { value: "hourly", label: "every hour at half past: 01:30, 02:30, 03:30" }
  ];
  var GOSSIPS = [
    { value: "1", label: "every second (as built)" },
    { value: "0.1", label: "every tenth of a second" }
  ];
  var SIZES = [
    { value: "22", label: "write 2, read 2 (as built)", w: 2, r: 2 },
    { value: "33", label: "write 3, read 3: all three copies", w: 3, r: 3 },
    { value: "21", label: "write 2, read 1: the nearest single copy", w: 2, r: 1 }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(t) {
    var s = Math.floor(t / 10);
    var d = t % 10;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60) + (d ? "." + d : "");
  }
  function when(t) { return t % 600 === 0 ? hms(t).slice(0, 5) : hms(t); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function names(list) { return list.length ? list.join(", ") : "none"; }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function night(C) {
    var I = C.gossip === "0.1" ? 1 : 10;
    var size = pick(SIZES, C.size);
    var down = C.down === "upgrade";
    var deadAt = down ? C_DOWN + I + SUSPECT + ROUNDS * I : -1;
    var hearAt = down ? C_UP + ROUNDS * I : -1;
    var has = { A: false, B: false, C: false };
    var d = { present: false, rented: false, notes: 0, flagNote: false, last: -1, handed: -1 };
    var r = {
      lines: [], deadAfter: down ? String((deadAt - C_DOWN) / 10) + " s" : "C not down", flagYes: "", flagAt: -1,
      flagRefused: 0, refused: [], noteText: "none", removedAt: -1, asked: [], scan: "", snaps: {}, holders: ""
    };
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    function cUp(t) { return !down || t < C_DOWN || t >= C_UP; }
    function bSlow(t) { return C.compact === "on" && t >= B_FROM && t < B_TO; }
    function cDead(t) { return down && t >= deadAt && t < C_UP; }
    function holders() { return ["A", "B", "C"].filter(function (k) { return has[k]; }); }

    function settle(t) {
      if (!d.present) return;
      var due = d.last + IDLE;
      if (C.removal === "notes") {
        if (d.notes > 0) return;
        due = Math.max(due, d.handed);
      }
      if (due > t) return;
      d.present = false;
      r.removedAt = due;
      if (d.notes) {
        r.noteText = d.notes + " lost at " + when(due);
        line(due, "D removed after 30 min with no writes; " + d.notes + " notes for C undelivered" +
          (d.flagNote ? ", the flag's among them." : "."), "bad");
      } else {
        line(due, "D removed after 30 min with no writes; no notes on it.", "");
      }
    }

    function write(t, isFlag) {
      var yes = ["A"];
      var missedB = bSlow(t);
      if (!missedB) yes.push("B");
      if (cUp(t)) yes.push("C");
      var home = yes.length;
      var useD = false;
      var ok;
      if (size.w === 3) {
        ok = home === 3;
      } else if (home >= 2) {
        ok = true;
      } else {
        if (!(isFlag && C.count === "strict") && d.present && cDead(t)) useD = true;
        ok = home + (useD ? 1 : 0) >= 2;
      }
      if (useD) {
        d.notes += 1;
        d.last = t;
        if (isFlag) d.flagNote = true;
      }
      var who = yes.join(", ") + (useD ? ", D (note for C)" : "");
      var why = (missedB ? "; B missed its deadline and drops it" : "") + (cUp(t) ? "" : "; C is down");
      if (isFlag) {
        yes.forEach(function (k) { has[k] = true; });
        if (t === FLAG_T) r.flagYes = yes.join(", ") + (useD ? ", D" : "");
        if (ok) {
          r.flagAt = t;
          line(t, "Recall flag on lot 7714: yes from " + who + why + ". SAVED.", useD ? "warn" : "ok");
        } else {
          r.flagRefused += 1;
          line(t, "Recall flag on lot 7714: yes from " + who + why + ". NOT SAVED: " + home + " of 3 home copies" +
            (size.w === 3 ? ", all three needed" : "") + ". Retry in 5 minutes.", "bad");
        }
      } else if (!ok) {
        r.refused.push(t);
      } else if (useD) {
        line(t, "Another lot's write: yes from " + who + why + ". D now holds " + d.notes + (d.notes === 1 ? " note" : " notes") + " for C.", "warn");
      }
    }

    var ev = [];
    var P = { cdown: 0, cup: 1, write: 2, repair: 3, read: 4, dead: 5, hear: 6, snap: 9 };
    if (down) {
      ev.push({ t: C_DOWN, k: "cdown" }, { t: deadAt, k: "dead" }, { t: C_UP, k: "cup" }, { t: hearAt, k: "hear" });
    }
    for (var w = START; w <= END; w += EVERY) ev.push({ t: w, k: "write" });
    if (C.repair === "hourly") REPAIRS.forEach(function (t) { ev.push({ t: t, k: "repair" }); });
    ev.push({ t: READ_T, k: "read" });
    SNAPS.forEach(function (t) { ev.push({ t: t, k: "snap" }); });
    ev.sort(function (a, b) { return a.t - b.t || P[a.k] - P[b.k]; });

    ev.forEach(function (e) {
      settle(e.t);
      if (e.k === "cdown") {
        line(e.t, "C stops for its upgrade, until 02:00. It says nothing; the others must notice.", "warn");
      } else if (e.k === "dead") {
        line(e.t, "C declared dead: a probe got no answer, others were asked to try, C was marked suspect, then dead after 5 s more; gossip every " +
          (I === 1 ? "0.1" : "1") + " s told every server in 2 rounds. Stand-in D rented.", "warn");
        d.present = true;
        d.rented = true;
        d.last = e.t;
      } else if (e.k === "write") {
        if (r.flagAt < 0 && e.t >= FLAG_T) write(e.t, true);
        if (e.t !== FLAG_T) write(e.t, false);
      } else if (e.k === "cup") {
        line(e.t, "C is back from its upgrade" + (has.C ? ", holding the flag." : ", without the flag."), "");
      } else if (e.k === "hear") {
        if (d.present && d.notes > 0) {
          if (d.flagNote) has.C = true;
          r.noteText = d.notes + " handed to C at " + when(e.t);
          line(e.t, "D hears by gossip that C is back and hands over its " + d.notes + " notes" +
            (d.flagNote ? ", the flag's among them." : "."), "ok");
          d.notes = 0;
          d.flagNote = false;
          d.handed = e.t;
          settle(e.t);
        }
      } else if (e.k === "repair") {
        var up = ["A", "B", "C"].filter(function (k) { return k !== "C" || cUp(e.t); });
        var any = up.some(function (k) { return has[k]; });
        var gets = any ? up.filter(function (k) { return !has[k]; }) : [];
        gets.forEach(function (k) { has[k] = true; });
        line(e.t, "Tree repair compares " + up.join(", ") + ": " +
          (gets.length ? "copies the flag to " + gets.join(" and ") + "." : "nothing to copy."), gets.length ? "ok" : "");
      } else if (e.k === "read") {
        var answering = ORDER.filter(function (k) { return k !== "C" || cUp(e.t); });
        r.asked = answering.slice(0, size.r);
        r.scan = r.asked.some(function (k) { return has[k]; }) ? "recalled" : "clean";
        line(e.t, "Buyer's scan of lot 7714: the read takes the first " + size.r + (size.r === 1 ? " answer, " : " answers, ") +
          r.asked.join(", ") + ". " + (r.scan === "recalled" ? "RECALLED: the scanner refuses the pallet." : "CLEAN: the scanner beeps green."),
          r.scan === "recalled" ? "ok" : "bad");
      } else if (e.k === "snap") {
        var s = {};
        ["A", "B", "C"].forEach(function (k) { s[k] = k === "C" && !cUp(e.t) ? "down" : has[k] ? "flag" : "-"; });
        s.D = d.present ? (d.flagNote ? "note (flag)" : d.notes ? d.notes + " notes" : "no notes") : d.rented ? "gone" : "not rented";
        r.snaps[e.t] = s;
        if (e.t === READ_T) r.holders = names(holders());
      }
    });
    settle(END);
    if (r.refused.length) {
      line(END, "Other writes refused: " + r.refused.length + ", from " + when(r.refused[0]) + " to " +
        when(r.refused[r.refused.length - 1]) + ".", "bad");
    }
    line(END, "Flag held by: " + names(holders()) + ".", "");
    r.saved = r.flagAt < 0 ? "never saved" : (r.flagRefused ? "refused " + r.flagRefused + " times, saved " : "saved ") + when(r.flagAt);
    r.removed = r.removedAt >= 0 ? when(r.removedAt) : d.rented ? "still rented" : "not rented";
    r.outcome = r.scan === "recalled" ? (r.refused.length ? "recalled, writes refused" : "recalled") : "clean: the recall missed";
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
    ["server"].concat(SNAPS.map(when)).forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
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

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "C: " + pick(DOWNS, C.down).label + ". B: " + pick(COMPACTS, C.compact).label +
      ". Safety flag: " + pick(COUNTS, C.count).label + ". Stand-in removed: " + pick(REMOVALS, C.removal).label +
      ". Tree repair: " + pick(FIXES, C.repair).label + ". Gossip: " + pick(GOSSIPS, C.gossip).label +
      ". Counts: " + pick(SIZES, C.size).label + ".";
    clear(ui.body);
    var N = night(C);
    S.stat.dead(N.deadAfter);
    if (!S.ran) {
      ui.sum.textContent = "Not played yet: it is 00:30, and C is about to stop for its upgrade.";
      ["write", "saved", "notes", "removed", "refused", "asked", "scan", "holders", "outcome"].forEach(function (k) { S.stat[k]("not played yet"); });
      return;
    }
    ["A", "B", "C", "D"].forEach(function (k) {
      var tr = ui.el("tr");
      tr.appendChild(ui.el("td", "", k === "D" ? "D (stand-in)" : k + " (home)"));
      SNAPS.forEach(function (t) { tr.appendChild(ui.el("td", "", N.snaps[t][k])); });
      ui.body.appendChild(tr);
    });
    ui.sum.textContent = "The 00:40 flag got yes from " + N.flagYes + "; " + N.saved + ". The 03:15 read asked " +
      N.asked.join(", ") + ": " + N.scan + ".";
    S.stat.write(N.flagYes);
    S.stat.saved(N.saved);
    S.stat.notes(N.noteText);
    S.stat.removed(N.removed);
    S.stat.refused(String(N.refused.length));
    S.stat.asked(N.asked.join(", "));
    S.stat.scan(N.scan);
    S.stat.holders(N.holders);
    S.stat.outcome(N.outcome);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 00:30.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("00:30 to 03:30 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    N.lines.forEach(function (l) { api.log(hms(l.t) + " " + l.text, l.tone); });
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { down: "upgrade", compact: "on", count: "sloppy", removal: "idle", repair: "none", gossip: "1", size: "22" };
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
      sel("down", "C's downtime", DOWNS, "down");
      sel("compact", "B's compacting", COMPACTS, "compact");
      sel("count", "How a safety flag counts", COUNTS, "count");
      sel("removal", "Stand-in removed", REMOVALS, "removal");
      sel("repair", "Tree repair", FIXES, "repair");
      sel("gossip", "Gossip interval", GOSSIPS, "gossip");
      sel("size", "Write and read counts", SIZES, "size");
      api.control.button("run", "Play 00:30 to 03:30", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        dead: api.stat("dead", "C declared dead after", "warn"),
        write: api.stat("write", "00:40 flag: yes from", ""),
        saved: api.stat("saved", "the flag", ""),
        notes: api.stat("notes", "D's notes for C", "warn"),
        removed: api.stat("removed", "D removed at", ""),
        refused: api.stat("refused", "other writes refused", "bad"),
        asked: api.stat("asked", "03:15 read asked", ""),
        scan: api.stat("scan", "03:15 scan", "bad"),
        holders: api.stat("holders", "flag held at 03:15 by", "ok"),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a server: A, B and C are lot 7714's home servers, D the stand-in. Each column is a moment of the night. \"flag\" means the server holds the recall flag; \"down\" means it is off; D's cell shows the notes it holds for C, or \"gone\" once it is removed. The log lists every write that needed D, every flag attempt, each repair and the 03:15 read.");

      api.log("The night of Thursday 15 October 2026, 00:30, as built: C about to stop for its upgrade, B about to compact, a stand-in's yes counts, idle stand-ins removed after 30 minutes, no tree repair, gossip every second, write 2 and read 2.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      var BUILT = { down: "upgrade", compact: "on", count: "sloppy", removal: "idle", repair: "none", gossip: "1", size: "22" };
      function fresh(set) { as(BUILT); as(set || {}); begin(); t.click("run"); }

      // 1. Opening state: 00:30, before C stops, nothing played.
      t.expect(t.stat("scan") === "not played yet" && t.stat("saved") === "not played yet" && t.stat("dead") === "8 s" &&
        has("00:30, as built"),
        "Opens at 00:30 before C stops, nothing played; C would be declared dead after 8 s");

      // 2. As built: the flag on A and D, D removed at 01:30 with 6 notes, the 03:15 read on B and C says clean.
      begin();
      t.click("run");
      t.expect(t.stat("write") === "A, D" && t.stat("saved") === "saved 00:40" && t.stat("notes") === "6 lost at 01:30" &&
        t.stat("removed") === "01:30" && t.stat("asked") === "B, C" && t.stat("scan") === "clean" && t.stat("holders") === "A" &&
        t.stat("refused") === 0 &&
        has("Recall flag on lot 7714: yes from A, D (note for C); B missed its deadline and drops it; C is down. SAVED.") &&
        has("D removed after 30 min with no writes; 6 notes for C undelivered, the flag's among them.") &&
        has("CLEAN: the scanner beeps green."),
        "As built: flag yes from A and D, D removed at 01:30 with 6 notes, read on B and C at 03:15: clean");

      // 3. A second play is refused until something changes.
      begin();
      t.click("run");
      t.expect(has("has already played."), "A second play is refused");

      // 4. Option 3's count alone: NOT SAVED at 00:40, saved at 01:05 on A and B, recalled at 03:15.
      fresh({ count: "strict" });
      t.expect(t.stat("write") === "A" && t.stat("saved") === "refused 5 times, saved 01:05" && t.stat("scan") === "recalled" &&
        t.stat("holders") === "A, B" && t.stat("notes") === "5 lost at 01:30" && t.stat("refused") === 0 &&
        has("NOT SAVED: 1 of 3 home copies. Retry in 5 minutes.") && has("01:05:00 Recall flag on lot 7714: yes from A, B; C is down. SAVED."),
        "Strict count for the flag: refused 5 times, saved at 01:05 on A and B, recalled at 03:15");

      // 5. Why never before: a stand-in kept until its notes are handed over.
      fresh({ removal: "notes" });
      t.expect(t.stat("notes") === "6 handed to C at 02:00:02" && t.stat("removed") === "02:00:02" && t.stat("scan") === "recalled" &&
        t.stat("holders") === "A, C" && has("D hears by gossip that C is back and hands over its 6 notes, the flag's among them."),
        "Removal only after hand-over: D hands C 6 notes at 02:00:02, the read on B and C finds the flag on C");

      // 6. Tree repair alone: B gets the flag at 01:30, C at 02:30.
      fresh({ repair: "hourly" });
      t.expect(t.stat("scan") === "recalled" && t.stat("holders") === "A, B, C" && t.stat("notes") === "6 lost at 01:30" &&
        has("Tree repair compares A, B: copies the flag to B.") && has("Tree repair compares A, B, C: copies the flag to C."),
        "Hourly tree repair: B gets the flag at 01:30, C at 02:30, recalled at 03:15 even with D's notes lost");

      // 7. Option 1: all three copies. No misses, but 17 other writes refused and the flag saved only at 02:00.
      fresh({ size: "33" });
      t.expect(t.stat("refused") === 17 && t.stat("saved") === "refused 16 times, saved 02:00" && t.stat("scan") === "recalled" &&
        t.stat("asked") === "B, C, A" && t.stat("holders") === "A, B, C" && t.stat("notes") === "none" &&
        has("Other writes refused: 17, from 00:30 to 01:55."),
        "All three copies: 17 other writes refused 00:30 to 01:55, the flag refused 16 times and saved at 02:00");

      // 8. Option 2: the nearest single copy. The read asks B alone: clean.
      fresh({ size: "21" });
      t.expect(t.stat("asked") === "B" && t.stat("scan") === "clean" && has("the read takes the first 1 answer, B."),
        "Nearest single copy: the 03:15 read asks B alone and says clean");

      // 9. Option 0: gossip ten times as often. C dead after 5.3 s, nothing else moves.
      fresh({ gossip: "0.1" });
      t.expect(t.stat("dead") === "5.3 s" && t.stat("write") === "A, D" && t.stat("removed") === "01:30" &&
        t.stat("notes") === "6 lost at 01:30" && t.stat("scan") === "clean" && has("00:30:05.3 C declared dead"),
        "Gossip every 0.1 s: C declared dead after 5.3 s instead of 8, the 03:15 read still clean");

      // 10. Option 3 in full: strict flags, hand over before removal, hourly repair.
      fresh({ count: "strict", removal: "notes", repair: "hourly" });
      t.expect(t.stat("saved") === "refused 5 times, saved 01:05" && t.stat("notes") === "5 handed to C at 02:00:02" &&
        t.stat("removed") === "02:00:02" && t.stat("holders") === "A, B, C" && t.stat("scan") === "recalled" && t.stat("refused") === 0 &&
        has("Tree repair compares A, B, C: copies the flag to C."),
        "Option 3 in full: saved 01:05, 5 notes handed to C at 02:00:02, C gets the flag at 02:30, recalled, nothing else refused");

      // 11. B not compacting: two home copies answer, D takes nothing and goes at 01:00:08.
      fresh({ compact: "off" });
      t.expect(t.stat("write") === "A, B" && t.stat("scan") === "recalled" && t.stat("removed") === "01:00:08" &&
        t.stat("notes") === "none" && has("D removed after 30 min with no writes; no notes on it."),
        "B not compacting: the flag lands on A and B, D is removed empty at 01:00:08, recalled at 03:15");

      // 12. Option 3 finds the flag at 03:15 and refuses no other write, whatever C, B and gossip do.
      var safe = true;
      DOWNS.forEach(function (a) { COMPACTS.forEach(function (b) { GOSSIPS.forEach(function (g) {
        var n = night({ down: a.value, compact: b.value, count: "strict", removal: "notes", repair: "hourly", gossip: g.value, size: "22" });
        if (n.scan !== "recalled" || n.refused.length || n.flagAt < 0) safe = false;
      }); }); });
      t.expect(safe, "Option 3: recalled at 03:15 with no other write refused, under every downtime, compacting and gossip setting");
    }
  });
})();
