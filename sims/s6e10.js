/* sims/s6e10-v1.0.0.js  (published as sims/s6e10.js)
   Case s6e10 "When the Building Burns": a backup lab for Trethowan Memorials. The archive lives on
   a server in building A of Bramhope Hosting's site; backups go to building B, 50 metres away. The
   learner replays the fortnight a day at a time and sees what each copy holds, what survives the
   fire, the RPO and RTO achieved, and what the stone says.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: backups nightly at 01:00 or hourly on the hour; copies to
     building B, to B and C, or to B and another region (whose first copies fail silently on a wrong
     password until a practice restore finds it); mirrored disk; export of Friday 12 March made or
     missed; fire at 00:40 or 02:00 on Sunday 14 March, spreading or not; practice restore on
     Sunday 7 March on or off. Buttons: next day, run to Wednesday, start again, reset.
     selfTest: 11 assertions.

   The model (stated in sim.lede and the post). Times are minutes after Monday 1 March, 00:00.
   - Changes: 3 every weekday, at 09:40, 11:20 and 14:50 (TYPE_AT), Mon 1 to Fri 5 and Mon 8 to
     Fri 12: 30 in the fortnight. Nothing is typed after the fire (the archive is gone).
   - The Spurdle correction is the change of Mon 08 Mar 09:40 (SPURDLE = 7 x 1440 + 580 = 10,660).
   - A backup at time T copies the whole archive as it is: every change typed before T. It runs only
     while the server in A stands (T before the fire). Nightly: 01:00 each night. Hourly: every hour
     on the hour from Mon 01 Mar 01:00.
   - Before the replay: building B holds the backup of Sun 28 Feb 01:00 (B_START); the office safe
     holds the export of Fri 26 Feb 17:30 (USB_START). Building C and the region start empty.
   - Exports to the USB drive: Fridays 17:30. Fri 5 is made; Fri 12 is missed (Gaynor away) unless
     switched on.
   - The far copy to another region fails on a wrong password from its first run, with no warning,
     until a practice restore finds it; after that, every copy arrives. Without the practice
     restore it never arrives.
   - Practice restore: Sun 07 Mar 02:30 (TEST), the first Sunday of the month. It loads building B's
     newest copy (passes) and checks the far copy, if there is one.
   - Fire in A at Sun 14 Mar 00:40 (or 02:00). With spread on, building B burns 2 h 20 min later
     (03:00) and building C 3 h 30 min later (04:10). The other region and the office safe never
     burn. A mirrored disk is inside the server and burns with it.
   - After the fire, the archive is restored from the newest copy that survived. From a hosted copy
     (B, C or the region) it takes 4 hours; from the USB drive it took until Tue 16 Mar 15:40 (a new
     hosting company was needed). The stone is cut from the restored archive on Wed 17 Mar 09:00.
   - RPO = fire time minus the time of the copy restored. RTO = restore time minus fire time.
     Changes lost = changes typed at or after that copy and before the fire.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e10-v1.0.0.json):
   - As built: the newest copy left is the USB drive of Fri 05 Mar 17:30 (6,810). Fire 18,760.
     RPO 11,950 min = 8 days 7 hours 10 minutes; RTO 22,540 - 18,760 = 3,780 min = 63 hours;
     changes lost: Mon 8 to Fri 12, 5 x 3 = 15; the stone says ELKANA SPURDLE.
   - Fire night as built: building B holds 14 backups (Sun 28 Feb plus Mon 1 to Sat 13 at 01:00),
     5 of them holding the h (Tue 9 to Sat 13). The Sun 14 01:00 backup never runs.
   - Export of Fri 12 made (16,890): RPO 1,870 min = 1 day 7 hours 10 minutes, 0 lost, ELKANAH.
   - Hourly: 312 runs (01:00 Mon 1 to 00:00 Sun 14), so B holds 313 backups, 135 with the h (from
     Mon 8 10:00). All burn at 03:00: the same 8 days 7 hours 10 minutes, 15 lost, ELKANA.
   - Mirrored disk: the same outcome. Third building: C holds 13 backups, 5 with the h, burns 04:10.
   - Another region with the practice restore: the Sat 13 Mar 01:00 copy (17,340) survives:
     RPO 1,420 min = 23 hours 40 minutes, restored 04:40, RTO 4 hours, 0 lost, ELKANAH.
     Without the practice restore: no far copy ever arrived, the same loss as built.
   - Spread off: building B survives, Sat 13 Mar 01:00, 23 hours 40 minutes, 4 hours. With the fire
     at 02:00 the Sun 14 01:00 backup runs first: RPO 1 hour, 0 lost.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAY = 1440;
  var END = 16 * DAY + 540;            // Wed 17 Mar 09:00, the stone is cut
  var TYPE_AT = [580, 680, 890];       // 09:40, 11:20, 14:50
  var SPURDLE = 7 * DAY + 580;         // Mon 08 Mar 09:40
  var TEST = 6 * DAY + 150;            // Sun 07 Mar 02:30
  var USB_BACK = 15 * DAY + 940;       // Tue 16 Mar 15:40
  var B_START = -DAY + 60;             // Sun 28 Feb 01:00
  var USB_START = -3 * DAY + 1050;     // Fri 26 Feb 17:30
  var EXPORT5 = 4 * DAY + 1050;        // Fri 05 Mar 17:30
  var EXPORT12 = 11 * DAY + 1050;      // Fri 12 Mar 17:30
  var TO_B = 140;                      // A to B: 00:40 to 03:00
  var TO_C = 210;                      // A to C: 00:40 to 04:10
  var HOSTED_RTO = 240;                // 4 hours from any surviving hosted copy
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  var FREQ = [
    { value: "nightly", label: "Every night at 01:00 (as built)" },
    { value: "hourly", label: "Every hour, on the hour" }
  ];
  var DEST = [
    { value: "b", label: "Building B (as built)" },
    { value: "c", label: "Buildings B and C, same site" },
    { value: "region", label: "Building B and another region" }
  ];
  var FIRE = [
    { value: "0040", label: "00:40 (as it happened)" },
    { value: "0200", label: "02:00" }
  ];
  var LOC = { B: "building B", C: "building C", R: "another region", USB: "the USB drive" };

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function dayOf(t) { return Math.floor(t / DAY); }
  function dlab(d) {
    var w = DOW[((d % 7) + 7) % 7];
    return w + " " + (d >= 0 ? two(d + 1) + " Mar" : two(29 + d) + " Feb");
  }
  function hm(t) { var m = t - dayOf(t) * DAY; return two(Math.floor(m / 60)) + ":" + two(m % 60); }
  function stamp(t) { return dlab(dayOf(t)) + " " + hm(t); }
  function unit(n, one, many) { return n + " " + (n === 1 ? one : many); }
  // RPO: "8 days 7 hours 10 minutes", "23 hours 40 minutes", "1 hour".
  function span(m) {
    var d = Math.floor(m / DAY);
    var h = Math.floor((m % DAY) / 60);
    var mi = m % 60;
    var p = [];
    if (d) p.push(unit(d, "day", "days"));
    if (h) p.push(unit(h, "hour", "hours"));
    if (mi || !p.length) p.push(unit(mi, "minute", "minutes"));
    return p.join(" ");
  }
  // RTO in hours: "63 hours", "4 hours", "61 hours 40 minutes".
  function hours(m) {
    var h = Math.floor(m / 60);
    var mi = m % 60;
    return unit(h, "hour", "hours") + (mi ? " " + unit(mi, "minute", "minutes") : "");
  }
  function destText(C) {
    if (C.dest === "c") return "buildings B and C";
    if (C.dest === "region") return "building B and another region";
    return "building B";
  }
  function copyText(c) { return LOC[c.loc] + ", " + stamp(c.t); }

  /* ---------- the model (pure) ---------- */

  function plan(C) {
    var FA = 13 * DAY + (C.fire === "0200" ? 120 : 40);
    var FB = C.spread ? FA + TO_B : null;
    var FC = C.spread && C.dest === "c" ? FA + TO_C : null;
    var edits = [];
    for (var d = 0; d < 16; d++) {
      if (d % 7 >= 5) continue;
      for (var k = 0; k < TYPE_AT.length; k++) {
        var te = d * DAY + TYPE_AT[k];
        if (te < FA) edits.push(te);
      }
    }
    var every = C.freq === "hourly" ? 60 : DAY;
    var runs = [];
    for (var t = 60; t < FA; t += every) runs.push(t);
    var never = C.freq === "hourly" ? Math.ceil(FA / 60) * 60 : (FA <= 13 * DAY + 60 ? 13 * DAY + 60 : 14 * DAY + 60);
    var copies = [{ loc: "B", t: B_START, ok: true }, { loc: "USB", t: USB_START, ok: true }];
    runs.forEach(function (tr) {
      copies.push({ loc: "B", t: tr, ok: true });
      if (C.dest === "c") copies.push({ loc: "C", t: tr, ok: true });
      if (C.dest === "region") copies.push({ loc: "R", t: tr, ok: C.test && tr > TEST });
    });
    copies.push({ loc: "USB", t: EXPORT5, ok: true });
    if (C.export12) copies.push({ loc: "USB", t: EXPORT12, ok: true });
    function burnAt(loc) { return loc === "B" ? FB : (loc === "C" ? FC : null); }
    var best = null;
    copies.forEach(function (c) {
      if (!c.ok || burnAt(c.loc) !== null) return;
      if (!best || c.t > best.t) best = c;
    });
    var rto = best.loc === "USB" ? USB_BACK - FA : HOSTED_RTO;
    var lost = edits.filter(function (e) { return e >= best.t; }).length;
    return {
      FA: FA, FB: FB, FC: FC, edits: edits, runs: runs, never: never, copies: copies, burnAt: burnAt,
      best: best, rpo: FA - best.t, rto: rto, RT: FA + rto, lost: lost, h: best.t > SPURDLE
    };
  }

  function stone(P) { return P.h ? "ELKANAH SPURDLE" : "ELKANA SPURDLE"; }

  function countAt(P, loc) {
    var n = 0;
    var k = 0;
    P.copies.forEach(function (c) {
      if (c.loc !== loc || !c.ok) return;
      n += 1;
      if (c.t > SPURDLE) k += 1;
    });
    return { n: n, k: k };
  }

  // Every event in time order. Routine ones (changes, backups, exports) go into the day's line.
  function events(C, P) {
    var ev = [];
    var seq = 0;
    function add(t, kind, x) { ev.push({ t: t, kind: kind, x: x, s: seq++ }); }
    add(P.FA, "fireA");
    P.edits.forEach(function (t) { add(t, "edit"); });
    P.runs.forEach(function (t) { add(t, "run"); });
    add(EXPORT5, "export");
    add(EXPORT12, C.export12 ? "export" : "missed");
    if (C.test) add(TEST, "test");
    add(P.never, "never");
    if (P.FB !== null) add(P.FB, "fireB");
    if (P.FC !== null) add(P.FC, "fireC");
    add(P.RT, "restore");
    add(END, "cut");
    ev.sort(function (a, b) { return (a.t - b.t) || (a.s - b.s); });
    return ev;
  }

  function special(C, P, e) {
    var at = stamp(e.t);
    var b;
    switch (e.kind) {
      case "test":
        if (C.dest === "region") {
          return { txt: at + " practice restore: building B's newest copy loads and passes. The far copy in the region holds nothing: every copy since Mon 01 Mar failed on a wrong password. Fixed now.", tone: "warn" };
        }
        return { txt: at + " practice restore: building B's newest copy loads and passes.", tone: "ok" };
      case "missed":
        return { txt: at + " no export: Gaynor is away, and nobody else makes it. The USB drive still holds Fri 05 Mar 17:30.", tone: "warn" };
      case "fireA":
        return { txt: at + " fire in building A. The server burns" + (C.mirror ? ", and its mirrored disk with it, holding every change up to " + hm(e.t) : "") + ".", tone: "bad" };
      case "never":
        return { txt: at + " backup never ran: the server has burned.", tone: "bad" };
      case "fireB":
        b = countAt(P, "B");
        return { txt: at + " fire reaches building B: " + b.n + " backups burn, " + b.k + " of them holding the h.", tone: "bad" };
      case "fireC":
        b = countAt(P, "C");
        return { txt: at + " fire reaches building C: " + b.n + " backups burn, " + b.k + " of them holding the h.", tone: "bad" };
      case "restore":
        return { txt: at + " archive restored from " + copyText(P.best) + ". RPO " + span(P.rpo) + ", RTO " + hours(P.rto) + ", " +
          unit(P.lost, "change", "changes") + " lost.", tone: P.best.loc === "USB" ? "bad" : "ok" };
      case "cut":
        return { txt: at + " stone cut from the restored archive: " + stone(P) + ".", tone: P.h ? "ok" : "bad" };
    }
    return null;
  }

  function dayLine(C, P, d, done) {
    var nE = 0;
    var hasS = false;
    var nR = 0;
    var fail = false;
    var exp = false;
    done.forEach(function (e) {
      if (e.kind === "edit") { nE += 1; if (e.t === SPURDLE) hasS = true; }
      if (e.kind === "run") { nR += 1; if (C.dest === "region" && !(C.test && e.t > TEST)) fail = true; }
      if (e.kind === "export") exp = true;
    });
    var parts = [];
    if (nE) parts.push(unit(nE, "change", "changes") + " typed" + (hasS ? " (the Spurdle correction at 09:40)" : ""));
    if (nR) {
      parts.push((C.freq === "hourly" ? nR + " hourly backups to " : "backup at 01:00 to ") + destText(C) +
        (fail ? ", but the copy to the region failed: wrong password, no warning" : ""));
    }
    if (exp) parts.push("export to the USB drive at 17:30");
    if (!parts.length) parts.push(d > dayOf(P.FA) ? "no archive: nothing typed, nothing copied" : "nothing typed");
    return dlab(d) + ": " + parts.join("; ") + ".";
  }

  function newRun(C) {
    var P = plan(C);
    return { P: P, ev: events(C, P), i: 0, now: 0, done: false };
  }

  function seen(R, t) { return R.done ? t <= END : t < R.now; }

  // One day forward (the last step is Wed 00:00 to 09:00). quiet: no day line.
  function stepDay(api, quiet) {
    var S = api.state;
    var R = S.R;
    if (R.done) return;
    var d = dayOf(R.now);
    var to = R.now < 16 * DAY ? (d + 1) * DAY : END;
    var last = to === END;
    var routine = [];
    var lines = [];
    while (R.i < R.ev.length && (R.ev[R.i].t < to || (last && R.ev[R.i].t <= to))) {
      var e = R.ev[R.i];
      R.i += 1;
      if (e.kind === "edit" || e.kind === "run" || e.kind === "export") routine.push(e);
      else lines.push(special(S.C, R.P, e));
    }
    if (!quiet) api.log(dayLine(S.C, R.P, d, routine), "");
    lines.forEach(function (l) { if (l) api.log(l.txt, l.tone); });
    R.now = to;
    if (last) R.done = true;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 120;
  var X1 = 650;
  function xt(t) { return Math.round((X0 + (X1 - X0) * Math.max(0, t) / END) * 10) / 10; }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "dg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The fortnight as a timeline: changes typed (the Spurdle correction in amber), the server in building A, each backup by place, and each USB export. Red marks a fire, a failed copy or a missed export. The vertical line is now.");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var hr = el("tr");
    ["place", "newest copy", "holds the h", "state"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    [head, svg, wrap].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, svg: svg, tbody: tbody };
  }

  function mk(doc, parent, tag, attrs) {
    var e = doc.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    parent.appendChild(e);
    return e;
  }

  function drawTimeline(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var svg = ui.svg;
    var C = S.C;
    var R = S.R;
    var P = R.P;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var rows = [["Changes", "edit"], ["Server, A", "A"], ["Building B", "B"]];
    if (C.dest === "c") rows.push(["Building C", "C"]);
    if (C.dest === "region") rows.push(["Region", "R"]);
    rows.push(["USB, safe", "USB"]);
    var H = 34 + rows.length * 24;
    svg.setAttribute("viewBox", "0 0 660 " + H);
    var g = {
      ok: mk(doc, svg, "g", { "class": "dg-node st-ok" }),
      warn: mk(doc, svg, "g", { "class": "dg-node st-warn" }),
      bad: mk(doc, svg, "g", { "class": "dg-node st-bad" })
    };
    function mark(tone, t, y, w, h) { mk(doc, g[tone], "rect", { x: xt(t), y: y - h / 2, width: w, height: h }); }
    function text(x, y, s, cls, anchor) {
      var e = mk(doc, svg, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" });
      e.textContent = s;
    }
    [0, 7, 14].forEach(function (d) { text(xt(d * DAY), 12, dlab(d), "dg-axis", "start"); });
    rows.forEach(function (row, k) {
      var y = 30 + k * 24;
      text(4, y + 4, row[0], "dg-axis", "start");
      mk(doc, svg, "line", { x1: X0, y1: y, x2: X1, y2: y, "class": "dg-axis" });
      var key = row[1];
      if (key === "edit") {
        P.edits.forEach(function (t) { if (seen(R, t)) mark(t === SPURDLE ? "warn" : "ok", t, y, 1.5, 12); });
      } else if (key === "A") {
        var upTo = seen(R, P.FA) ? P.FA : Math.min(R.now, P.FA);
        if (upTo > 0) mk(doc, g.ok, "rect", { x: X0, y: y - 3, width: Math.max(0, xt(upTo) - X0), height: 6 });
        if (seen(R, P.FA)) mark("bad", P.FA, y, 4, 16);
      } else if (key === "USB") {
        P.copies.forEach(function (c) { if (c.loc === "USB" && c.t >= 0 && seen(R, c.t)) mark("ok", c.t, y, 2, 12); });
        if (!C.export12 && seen(R, EXPORT12)) mark("bad", EXPORT12, y, 2, 12);
      } else {
        P.copies.forEach(function (c) { if (c.loc === key && c.t >= 0 && seen(R, c.t)) mark(c.ok ? "ok" : "bad", c.t, y, 1.2, 10); });
        var burn = P.burnAt(key);
        if (burn !== null && seen(R, burn)) mark("bad", burn, y, 4, 16);
      }
    });
    var xn = R.done ? xt(END) : xt(R.now);
    mk(doc, svg, "line", { x1: xn, y1: 16, x2: xn, y2: H - 4, "class": "dg-axis" });
  }

  function newest(R, loc) {
    var best = null;
    R.P.copies.forEach(function (c) {
      if (c.loc === loc && c.ok && seen(R, c.t) && (!best || c.t > best.t)) best = c;
    });
    return best;
  }

  function drawTable(S) {
    var ui = S.ui;
    var C = S.C;
    var R = S.R;
    var P = R.P;
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    var burnedA = seen(R, P.FA);
    var rows = [["Server, building A", burnedA ? "-" : "the live archive", burnedA ? "-" : (seen(R, SPURDLE) ? "yes" : "no"),
      burnedA ? "burned " + hm(P.FA) : "running"]];
    if (C.mirror) rows.push(["Mirrored disk, in A", burnedA ? "-" : "every change, at once", burnedA ? "-" : (seen(R, SPURDLE) ? "yes" : "no"),
      burnedA ? "burned " + hm(P.FA) : "running"]);
    var places = ["B"];
    if (C.dest === "c") places.push("C");
    if (C.dest === "region") places.push("R");
    places.push("USB");
    places.forEach(function (loc) {
      var c = newest(R, loc);
      var burn = P.burnAt(loc);
      var gone = burn !== null && seen(R, burn);
      var name = loc === "USB" ? "USB drive, office safe" : (loc === "R" ? "Another region" : "Backup server, " + loc);
      rows.push([name, gone ? "-" : (c ? stamp(c.t) : "nothing arrived"), gone ? "-" : (c ? (c.t > SPURDLE ? "yes" : "no") : "-"),
        gone ? "burned " + hm(burn) : "safe"]);
    });
    rows.forEach(function (cells) {
      var tr = ui.el("tr");
      cells.forEach(function (x) { tr.appendChild(ui.el("td", "padding:2px 4px;", x)); });
      ui.tbody.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var P = R.P;
    S.ui.head.textContent = "Backups " + (C.freq === "hourly" ? "every hour" : "every night at 01:00") + " to " + destText(C) +
      (C.mirror ? ", with a mirrored disk" : "") + ". Fire in A at " + hm(P.FA) + (C.spread ? ", spreading" : ", not spreading") +
      ". Practice restore " + (C.test ? "on" : "off") + ". Export on Fri 12: " + (C.export12 ? "made" : "missed") + ".";
    drawTimeline(S);
    drawTable(S);
    var nowT = R.done ? END : R.now;
    S.stat.now(dlab(dayOf(nowT)) + ", " + hm(nowT));
    S.stat.typed(P.edits.filter(function (t) { return seen(R, t); }).length);
    var b = newest(R, "B");
    S.stat.inB(P.FB !== null && seen(R, P.FB) ? "burned at " + hm(P.FB) : stamp(b.t));
    S.stat.usb(stamp(newest(R, "USB").t));
    var f = newest(R, "R");
    S.stat.far(C.dest !== "region" ? "not used" : (f ? stamp(f.t) : "nothing arrived"));
    var hc = 0;
    P.copies.forEach(function (c) {
      var burn = P.burnAt(c.loc);
      if (c.ok && c.t > SPURDLE && seen(R, c.t) && !(burn !== null && seen(R, burn))) hc += 1;
    });
    S.stat.hcount(hc);
    var back = seen(R, P.RT);
    S.stat.left(back ? copyText(P.best) : "not yet");
    S.stat.rpo(back ? span(P.rpo) : "not yet");
    S.stat.rto(back ? hours(P.rto) : "not yet");
    S.stat.lost(back ? P.lost : "not yet");
    S.stat.stone(R.done ? stone(P) : "not cut yet");
    S.ctl.next.disable(R.done);
    S.ctl.all.disable(R.done);
  }

  function restart(api, why) {
    var S = api.state;
    S.R = newRun(S.C);
    api.log((why ? why + " " : "") + "Mon 01 Mar 00:00. The replay starts. Building B holds the backup of Sun 28 Feb 01:00; the safe holds the export of Fri 26 Feb 17:30.", "");
    draw(api);
  }

  function runAll(api) {
    var S = api.state;
    var R = S.R;
    if (R.done) return;
    while (!R.done) stepDay(api, true);
    var P = R.P;
    var fire = "building A at " + hm(P.FA) + (P.FB !== null ? ", building B at " + hm(P.FB) : "") + (P.FC !== null ? ", building C at " + hm(P.FC) : "");
    api.log("Wed 17 Mar 09:00. Fire: " + fire + ". Newest copy left: " + copyText(P.best) + ". RPO " + span(P.rpo) + ", RTO " +
      hours(P.rto) + ", " + unit(P.lost, "change", "changes") + " lost. The stone says " + stone(P) + ".", P.h ? "ok" : "bad");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { freq: "nightly", dest: "b", mirror: false, export12: false, fire: "0040", spread: true, test: true };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv, say) {
        return function (v) { S.C[key] = conv(v); restart(api, say(S.C[key])); };
      }
      function onOff(v) { return v ? "on." : "off."; }
      S.ctl.freq = api.control.select("freq", "Backups run", FREQ, "nightly",
        opt("freq", String, function (v) { return "Backups: " + pick(FREQ, v).label + "."; }));
      S.ctl.dest = api.control.select("dest", "Each backup goes to", DEST, "b",
        opt("dest", String, function (v) { return "Each backup goes to: " + pick(DEST, v).label + "."; }));
      S.ctl.mirror = api.control.toggle("mirror", "Mirrored disk in the server", false,
        opt("mirror", function (v) { return !!v; }, function (v) { return "Mirrored disk: " + onOff(v); }));
      S.ctl.export12 = api.control.toggle("export12", "Export made on Friday the 12th", false,
        opt("export12", function (v) { return !!v; }, function (v) { return "Export on Fri 12 Mar: " + (v ? "made." : "missed."); }));
      S.ctl.fire = api.control.select("fire", "Fire in building A, Sunday the 14th", FIRE, "0040",
        opt("fire", String, function (v) { return "Fire in A at " + pick(FIRE, v).label + "."; }));
      S.ctl.spread = api.control.toggle("spread", "Fire spreads to the next buildings", true,
        opt("spread", function (v) { return !!v; }, function (v) { return "Fire spreads: " + onOff(v); }));
      S.ctl.test = api.control.toggle("test", "Practice restore, first Sunday of the month", true,
        opt("test", function (v) { return !!v; }, function (v) { return "Practice restore: " + onOff(v); }));
      S.ctl.next = api.control.button("next", "Next day", function () { stepDay(api, false); draw(api); });
      S.ctl.all = api.control.button("all", "Run to Wednesday", function () { runAll(api); });
      S.ctl.again = api.control.button("again", "Start again", function () { restart(api, "Fortnight replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        typed: api.stat("typed", "changes typed", ""),
        inB: api.stat("inB", "newest backup in B", ""),
        usb: api.stat("usb", "newest USB export", "warn"),
        far: api.stat("far", "newest far copy", ""),
        hcount: api.stat("hcount", "copies holding the h", "warn"),
        left: api.stat("left", "newest copy left", "warn"),
        rpo: api.stat("rpo", "RPO, work lost", "bad"),
        rto: api.stat("rto", "RTO, time to work again", "bad"),
        lost: api.stat("lost", "changes lost", "bad"),
        stone: api.stat("stone", "the stone says", "bad")
      };
      api.info("<strong>How to read it.</strong> Each backup copies the whole archive as it is at that moment. The timeline shows the changes typed, the server in building A, every copy and where it went, and every USB export; red marks a fire, a failed copy or a missed export. The table shows each place's newest copy, whether it holds the Spurdle correction (the h), and whether it survived. After the fire, the archive comes back from the newest copy left, and the stone is cut from that.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens on Monday 1 March, 00:00, before the first change or backup.
      t.expect(t.stat("now") === "Mon 01 Mar, 00:00" && t.stat("typed") === 0 && t.stat("inB") === "Sun 28 Feb 01:00" &&
        t.stat("usb") === "Fri 26 Feb 17:30" && t.stat("far") === "not used" && t.stat("hcount") === 0 &&
        t.stat("left") === "not yet" && t.stat("stone") === "not cut yet" &&
        has("Mon 01 Mar 00:00. The replay starts. Building B holds the backup of Sun 28 Feb 01:00; the safe holds the export of Fri 26 Feb 17:30."),
        "Opens Mon 01 Mar 00:00: B holds Sun 28 Feb 01:00, the safe Fri 26 Feb 17:30, nothing typed");

      // 2. The first week: 15 changes, the export of Fri 5, the practice restore passes on Sun 7.
      for (var i = 0; i < 7; i++) t.click("next");
      t.expect(t.stat("typed") === 15 && t.stat("inB") === "Sun 07 Mar 01:00" && t.stat("usb") === "Fri 05 Mar 17:30" &&
        has("Sun 07 Mar 02:30 practice restore: building B's newest copy loads and passes.") &&
        has("Fri 05 Mar: 3 changes typed; backup at 01:00 to building B; export to the USB drive at 17:30."),
        "First week: 15 changes, export Fri 05 Mar 17:30, practice restore passes on Sun 07 Mar 02:30");

      // 3. Monday 8: the correction at 09:40; Tuesday's 01:00 backup is the first to hold the h.
      t.click("next");
      var mon = t.stat("hcount") === 0 && has("Mon 08 Mar: 3 changes typed (the Spurdle correction at 09:40); backup at 01:00 to building B.");
      t.click("next");
      t.expect(mon && t.stat("hcount") === 1 && t.stat("typed") === 21 && t.stat("inB") === "Tue 09 Mar 01:00",
        "Mon 08 Mar 09:40 the correction; the backup of Tue 09 Mar 01:00 is the first copy holding the h");

      // 4. The fire night, as built.
      for (var j = 0; j < 5; j++) t.click("next");
      t.expect(has("Fri 12 Mar 17:30 no export: Gaynor is away, and nobody else makes it.") &&
        has("Sun 14 Mar 00:40 fire in building A. The server burns.") &&
        has("Sun 14 Mar 01:00 backup never ran: the server has burned.") &&
        has("Sun 14 Mar 03:00 fire reaches building B: 14 backups burn, 5 of them holding the h.") &&
        t.stat("hcount") === 0 && t.stat("inB") === "burned at 03:00" && t.stat("usb") === "Fri 05 Mar 17:30",
        "Fri 12 missed; fire in A 00:40, the 01:00 backup never runs, B burns at 03:00 with 14 backups, 5 holding the h");

      // 5. To Wednesday: the 9-day-old USB drive, 15 changes lost, ELKANA.
      t.click("all");
      t.expect(t.stat("left") === "the USB drive, Fri 05 Mar 17:30" && t.stat("rpo") === "8 days 7 hours 10 minutes" &&
        t.stat("rto") === "63 hours" && t.stat("lost") === 15 && t.stat("stone") === "ELKANA SPURDLE" &&
        has("Wed 17 Mar 09:00. Fire: building A at 00:40, building B at 03:00. Newest copy left: the USB drive, Fri 05 Mar 17:30. RPO 8 days 7 hours 10 minutes, RTO 63 hours, 15 changes lost. The stone says ELKANA SPURDLE."),
        "As built: restored from the USB drive of Fri 05 Mar 17:30, RPO 8 days 7 hours 10 minutes, RTO 63 hours, 15 lost, ELKANA");

      // 6. The export of Friday the 12th made: the h survives, by luck.
      t.set("export12", true);
      t.click("all");
      t.expect(t.stat("left") === "the USB drive, Fri 12 Mar 17:30" && t.stat("rpo") === "1 day 7 hours 10 minutes" &&
        t.stat("rto") === "63 hours" && t.stat("lost") === 0 && t.stat("stone") === "ELKANAH SPURDLE",
        "Export on Fri 12 made: RPO 1 day 7 hours 10 minutes, nothing lost, ELKANAH");

      // 7. Option 0: hourly backups to B. Newer copies, same place.
      t.set("export12", false);
      t.set("freq", "hourly");
      t.click("all");
      t.expect(has("Sun 14 Mar 03:00 fire reaches building B: 313 backups burn, 135 of them holding the h.") &&
        t.stat("rpo") === "8 days 7 hours 10 minutes" && t.stat("lost") === 15 && t.stat("stone") === "ELKANA SPURDLE",
        "Hourly: B holds 313 backups, 135 with the h, all burn at 03:00; the same loss and ELKANA");

      // 8. Option 1: a mirrored disk burns with the server.
      t.set("freq", "nightly");
      t.set("mirror", true);
      t.click("all");
      var mir = has("Sun 14 Mar 00:40 fire in building A. The server burns, and its mirrored disk with it, holding every change up to 00:40.") &&
        t.stat("lost") === 15 && t.stat("stone") === "ELKANA SPURDLE";
      // Option 2: a third building on the same site burns at 04:10.
      t.set("mirror", false);
      t.set("dest", "c");
      t.click("all");
      t.expect(mir && has("Sun 14 Mar 04:10 fire reaches building C: 13 backups burn, 5 of them holding the h.") &&
        has("Fire: building A at 00:40, building B at 03:00, building C at 04:10.") &&
        t.stat("rpo") === "8 days 7 hours 10 minutes" && t.stat("stone") === "ELKANA SPURDLE",
        "Mirrored disk burns with A; building C burns at 04:10 with 13 backups: ELKANA both times");

      // 9. Option 3: another region, with the practice restore.
      t.set("dest", "region");
      t.click("all");
      t.expect(has("Sun 07 Mar 02:30 practice restore: building B's newest copy loads and passes. The far copy in the region holds nothing: every copy since Mon 01 Mar failed on a wrong password. Fixed now.") &&
        has("Sun 14 Mar 04:40 archive restored from another region, Sat 13 Mar 01:00. RPO 23 hours 40 minutes, RTO 4 hours, 0 changes lost.") &&
        t.stat("left") === "another region, Sat 13 Mar 01:00" && t.stat("rpo") === "23 hours 40 minutes" && t.stat("rto") === "4 hours" &&
        t.stat("lost") === 0 && t.stat("stone") === "ELKANAH SPURDLE" && t.stat("far") === "Sat 13 Mar 01:00",
        "Another region: the practice restore catches the wrong password; restored 04:40, 23 hours 40 minutes, 4 hours, ELKANAH");

      // 10. The same far copy without the practice restore: it never arrived.
      t.set("test", false);
      t.click("all");
      t.expect(t.stat("far") === "nothing arrived" && t.stat("left") === "the USB drive, Fri 05 Mar 17:30" &&
        t.stat("lost") === 15 && t.stat("stone") === "ELKANA SPURDLE",
        "No practice restore: nothing reached the region, the USB drive again, ELKANA");

      // 11. No spread: building B was enough; with the fire at 02:00 the Sunday 01:00 copy runs first.
      t.set("test", true);
      t.set("dest", "b");
      t.set("spread", false);
      t.click("all");
      var nb = t.stat("left") === "building B, Sat 13 Mar 01:00" && t.stat("rpo") === "23 hours 40 minutes" && t.stat("rto") === "4 hours";
      t.set("fire", "0200");
      t.click("all");
      t.expect(nb && t.stat("left") === "building B, Sun 14 Mar 01:00" && t.stat("rpo") === "1 hour" && t.stat("lost") === 0 &&
        t.stat("stone") === "ELKANAH SPURDLE",
        "Fire kept to A: B restores Sat 13 Mar 01:00 (23 hours 40 minutes, 4 hours); at 02:00 the Sun 14 Mar 01:00 copy, 1 hour");
    }
  });
})();
