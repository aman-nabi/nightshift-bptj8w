/* sims/w08-v1.0.0.js  (published as sims/w08.js)
   Case w08 "All Four Sets on Loan": a workbench for the county music library's loans program.
   One title, the symphony, has four sets of orchestral parts in four numbered boxes. The week's
   eight requests, from Tuesday 10:15 to Monday 17:30, run through the design the learner picks.
   Widget-style sim: it draws its own table of the four boxes inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: five designs (as built, count each hold as a set out,
     separate title and set records, a record per box with the title copied, holds given the
     lowest-numbered set with no hold), Step, Play the week, Reset. Shows each box as it really
     is next to what the records say, and the title's record. Stats: free on the screen at 19:40
     on Thursday, orchestras turned away while a set was free, whom the records say box 1 came
     back from, loans the records get wrong, records changed for Monday's note, the waiting list.
     selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Box 1 is out with the railway orchestra; boxes 2, 3 and 4 are on the shelf.
   - The counter's habit: when the program names a set, the counter uses that box. When it names
     none, the counter keeps the lowest-numbered box on the shelf back for each hold, and lends
     the lowest-numbered box on the shelf that is not kept back.
   - "built": one record for the title: out (who has a set, not which), heldFor (one hold),
     waiting. free() = 0 if heldFor, else 4 - sets out. A return the record can't match to an
     orchestra takes one set off the count and leaves every borrower in doubt.
   - "count": as built, but holds are a list and free() = 4 - sets out - holds.
   - "number": as count, but each hold names the lowest-numbered set that no hold or loan names.
     A collected hold becomes a loan of that set number; a returned box closes the loan that
     names its number.
   - "split": a title record (waiting list) and a record per set (its loan or its hold). A hold
     goes on the lowest-numbered set on the shelf; a loan takes the lowest-numbered free set.
   - "copy": a record per box, with the title's name, composer and notes copied into each; the
     waiting list is filed under the title's name. Loans and holds as in "split".
   - When a set comes back and someone is waiting, the first on the list gets a hold and an
     email to their librarian.

   Where every number comes from (conventions rule 14; the case is content/s5/w08-v1.0.0.json).
   - The eight requests (given data): Tuesday 10:15 the hospital orchestra reserves; Thursday
     19:40 the youth orchestra and 19:52 the teachers' orchestra ask to borrow; Saturday 10:00
     the hospital orchestra collects; Saturday 10:20 the chamber orchestra asks to borrow; Monday
     09:00 box 1 (the railway orchestra's, second horn part missing) is in the night return box;
     Monday 11:00 the library adds a note, "mark in pencil only"; Monday 17:30 the fire brigade
     orchestra asks to borrow.
   - As built: free() is 4 - 1 = 3 at 10:15, so heldFor = hospital and free() becomes 0. At 19:40
     and 19:52: "free 0 of 4: all sets on loan", waiting list no. 1 and no. 2, with boxes 3 and 4
     on the shelf: 2 turned away with a set free. The rest of the week: the chamber orchestra is
     lent box 3 on Saturday ahead of both, box 1 can't be traced (1 of 3), the youth orchestra
     gets the hold, and the fire brigade orchestra is turned away with box 4 on the shelf: 3.
   - count and number: 4 - 1 - 1 = 2 free at 19:40; boxes 3 and 4 lent; 0 turned away. count:
     box 1 "can't tell: 1 of 4". number: the hold names set 1 (out with the railway orchestra),
     the hospital orchestra is handed box 2 while the record says set 1, and on Monday box 1
     closes the hospital orchestra's loan: 2 loans wrong.
   - split and copy: hold on set 2, sets 3 and 4 lent at 19:40 and 19:52 (2 of 4 free at 19:40),
     box 1 traced to the railway orchestra, chamber orchestra holds set 1, fire brigade orchestra
     waits: 0 turned away, 0 wrong. The note: 1 record changed, or 4 in "copy".
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAYS = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"];
  var OPEN = { day: 0, hm: "10:00" };
  var WHO = {
    railway: "the railway orchestra",
    hospital: "the hospital orchestra",
    youth: "the youth orchestra",
    teachers: "the teachers' orchestra",
    chamber: "the chamber orchestra",
    fire: "the fire brigade orchestra"
  };
  var SHORTWHO = { railway: "railway", hospital: "hospital", youth: "youth", teachers: "teachers'", chamber: "chamber", fire: "fire brigade" };
  var EVENTS = [
    { day: 0, hm: "10:15", kind: "reserve", o: "hospital" },
    { day: 2, hm: "19:40", kind: "borrow", o: "youth" },
    { day: 2, hm: "19:52", kind: "borrow", o: "teachers" },
    { day: 4, hm: "10:00", kind: "collect", o: "hospital" },
    { day: 4, hm: "10:20", kind: "borrow", o: "chamber" },
    { day: 6, hm: "09:00", kind: "nightbox", o: "railway", box: 1 },
    { day: 6, hm: "11:00", kind: "note" },
    { day: 6, hm: "17:30", kind: "borrow", o: "fire" }
  ];
  var DESIGNS = [
    { value: "built", label: "as built: one title record, the hold on the title" },
    { value: "count", label: "count each hold as one more set out" },
    { value: "split", label: "title and set records: loans and holds on a set" },
    { value: "copy", label: "a record per box, the title's details copied" },
    { value: "number", label: "each hold names the lowest-numbered set with no hold" }
  ];
  var SHORT = {
    built: "the program as built",
    count: "holds counted as sets out",
    split: "separate title and set records",
    copy: "a record per box, title copied",
    number: "holds named by set number"
  };

  /* ---------- helpers ---------- */

  function stamp(e) { return DAYS[e.day] + " " + e.hm + ". "; }
  function secs(e) { var p = e.hm.split(":"); return Number(p[0]) * 3600 + Number(p[1]) * 60; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function andList(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function isTitleDesign(d) { return d === "built" || d === "count" || d === "number"; }

  /* ---------- the model: one week, as a list of steps ---------- */

  function fresh(design) {
    var W = {
      design: design,
      boxes: { 1: { at: "railway", kept: null }, 2: { at: "shelf", kept: null }, 3: { at: "shelf", kept: null }, 4: { at: "shelf", kept: null } },
      waiting: [],
      turned: 0,
      screen: "not asked yet",
      box1: "not back yet",
      edits: "no note yet"
    };
    if (isTitleDesign(design)) {
      W.out = [{ o: "railway", set: null }];
      W.heldFor = null;
      W.holds = [];
      W.doubt = [];          // borrowers left in doubt by a return the record could not match
    } else {
      W.sets = { 1: { loan: "railway", hold: null }, 2: { loan: null, hold: null }, 3: { loan: null, hold: null }, 4: { loan: null, hold: null } };
    }
    return W;
  }

  function shelf(W, unkeptOnly) {
    var r = [];
    for (var n = 1; n <= 4; n++) if (W.boxes[n].at === "shelf" && (!unkeptOnly || !W.boxes[n].kept)) r.push(n);
    return r;
  }
  function keepBack(W, o) {
    var free = shelf(W, true);
    if (!free.length) return null;
    W.boxes[free[0]].kept = o;
    return free[0];
  }
  function titleFree(W) {
    var out = W.out.length - (W.doubt.length ? 1 : 0);
    if (W.design === "built") return W.heldFor ? 0 : 4 - out;
    return Math.max(0, 4 - out - W.holds.length);
  }
  function setFree(W) {
    var r = [];
    for (var n = 1; n <= 4; n++) if (!W.sets[n].loan && !W.sets[n].hold) r.push(n);
    return r;
  }
  function named(W) {
    var used = {};
    W.holds.forEach(function (h) { if (h.set) used[h.set] = true; });
    W.out.forEach(function (l) { if (l.set) used[l.set] = true; });
    for (var n = 1; n <= 4; n++) if (!used[n]) return n;
    return null;
  }
  function freeNow(W) { return isTitleDesign(W.design) ? titleFree(W) : setFree(W).length; }

  function reserve(W, e) {
    var o = e.o;
    var head = stamp(e) + cap(WHO[o]) + " reserves a set for Saturday. ";
    if (W.design === "built") {
      var f = titleFree(W);
      W.heldFor = o;
      var k = keepBack(W, o);
      return head + "free() is " + f + ", so the card sets heldFor to " + WHO[o] + ". The counter keeps box " + k + " back. The screen now shows " + titleFree(W) + " of 4 free.";
    }
    if (W.design === "count") {
      W.holds.push({ o: o, set: null });
      var k2 = keepBack(W, o);
      return head + "The card counts the hold as one more set out. The counter keeps box " + k2 + " back. The screen now shows " + titleFree(W) + " of 4 free.";
    }
    if (W.design === "number") {
      var s = named(W);
      W.holds.push({ o: o, set: s });
      var k3 = keepBack(W, o);
      var where = W.boxes[s].at === "shelf" ? "on the shelf" : "with " + WHO[W.boxes[s].at];
      return head + "The card gives the hold set " + s + ", the lowest-numbered set with no hold. Box " + s + " is " + where +
        ", so the counter keeps box " + k3 + " back. The screen now shows " + titleFree(W) + " of 4 free.";
    }
    var on = shelf(W, false).filter(function (n) { return !W.sets[n].hold; });
    var n0 = on[0];
    W.sets[n0].hold = o;
    W.boxes[n0].kept = o;
    return head + "The program puts a hold on set " + n0 + ", the lowest-numbered set on the shelf. The screen now shows " + setFree(W).length + " of 4 free.";
  }

  function lendBox(W, o, n) { W.boxes[n].at = o; W.boxes[n].kept = null; }

  function borrow(W, e) {
    var o = e.o;
    var f = freeNow(W);
    if (e.hm === "19:40") W.screen = f + " of 4";
    var head = stamp(e) + cap(WHO[o]) + " asks to borrow. ";
    if (f > 0) {
      var n;
      if (isTitleDesign(W.design)) {
        n = shelf(W, true)[0];
        W.out.push({ o: o, set: null });
        lendBox(W, o, n);
        var jump = W.waiting.length ? " That puts it ahead of " + andList(W.waiting.map(function (w) { return WHO[w]; })) + ", still on the waiting list." : "";
        return { msg: head + "The screen shows " + f + " of 4 free; the counter lends box " + n + "." + jump, tone: jump ? "warn" : "ok" };
      }
      n = setFree(W)[0];
      W.sets[n].loan = o;
      lendBox(W, o, n);
      return { msg: head + "The screen shows " + f + " of 4 free and names set " + n + "; the counter lends box " + n + ".", tone: "ok" };
    }
    W.waiting.push(o);
    var real = shelf(W, true);
    var lie = real.length > 0;
    if (lie) W.turned += 1;
    var what = W.design === "built" ? "free 0 of 4: all sets on loan" : "0 of 4 free";
    var tail = lie ? ", with box" + (real.length > 1 ? "es " : " ") + andList(real.map(String)) + " free on the shelf." : ". No box on the shelf is free.";
    return { msg: head + "The screen shows " + what + ". " + cap(WHO[o]) + " joins the waiting list, no. " + W.waiting.length + tail, tone: lie ? "bad" : "" };
  }

  function collect(W, e) {
    var o = e.o;
    var head = stamp(e) + cap(WHO[o]) + " comes to collect its set. ";
    var kept = null;
    for (var n = 1; n <= 4; n++) if (W.boxes[n].kept === o) kept = n;
    if (W.design === "built") {
      W.heldFor = null;
      W.out.push({ o: o, set: null });
      lendBox(W, o, kept);
      return { msg: head + "The card clears heldFor and adds it to out; the counter hands over box " + kept + ", the box kept back.", tone: "ok" };
    }
    if (W.design === "count") {
      W.holds = W.holds.filter(function (h) { return h.o !== o; });
      W.out.push({ o: o, set: null });
      lendBox(W, o, kept);
      return { msg: head + "The card turns the hold into a loan; the counter hands over box " + kept + ", the box kept back.", tone: "ok" };
    }
    if (W.design === "number") {
      var h = null;
      W.holds.forEach(function (x) { if (x.o === o) h = x; });
      W.holds = W.holds.filter(function (x) { return x.o !== o; });
      W.out.push({ o: o, set: h.set });
      lendBox(W, o, kept);
      return { msg: head + "The screen names set " + h.set + ", but box " + h.set + " is not on the shelf; the counter hands over box " + kept +
        ", the box kept back. The record now says " + WHO[o] + " has set " + h.set + ".", tone: "warn" };
    }
    var s = null;
    for (var m = 1; m <= 4; m++) if (W.sets[m].hold === o) s = m;
    W.sets[s].hold = null;
    W.sets[s].loan = o;
    lendBox(W, o, s);
    return { msg: head + "It collects set " + s + ", the set held for it.", tone: "ok" };
  }

  function nightbox(W, e) {
    var b = e.box;
    W.boxes[b].at = "shelf";
    W.boxes[b].kept = null;
    var msg = stamp(e) + "Box " + b + " is in the night return box, its second horn part missing. ";
    var tone = "ok";
    if (W.design === "built" || W.design === "count") {
      W.doubt = W.out.map(function (l) { return l.o; });
      W.box1 = "can't tell: 1 of " + W.doubt.length;
      msg += "The card knows only that " + andList(W.doubt.map(function (x) { return WHO[x]; })) + " each have a set. It takes one set off the count, but can't say whose loan ended.";
      tone = "warn";
    } else if (W.design === "number") {
      var hit = null;
      W.out.forEach(function (l) { if (l.set === b) hit = l; });
      W.out = W.out.filter(function (l) { return l !== hit; });
      W.box1 = SHORTWHO[hit.o] + " orchestra (wrong)";
      msg += "The record shows set " + b + " on loan to " + WHO[hit.o] + ", so it closes their loan. Box " + b + " came from " + WHO[e.o] + "; " + WHO[hit.o] + " has box " + boxOf(W, hit.o) + ".";
      tone = "bad";
    } else {
      W.sets[b].loan = null;
      W.box1 = SHORTWHO[e.o] + " orchestra";
      msg += "Set " + b + "'s record names " + WHO[e.o] + ", and closes its loan.";
    }
    if (W.waiting.length) {
      var w = W.waiting.shift();
      if (W.design === "built") {
        W.heldFor = w;
        var k = keepBack(W, w);
        msg += " The card sets heldFor to " + WHO[w] + "; the counter keeps box " + k + " back and the program emails " + WHO[w] + "'s librarian: a set is ready.";
      } else if (W.design === "count") {
        W.holds.push({ o: w, set: null });
        var k2 = keepBack(W, w);
        msg += " The card counts a hold for " + WHO[w] + "; the counter keeps box " + k2 + " back and the program emails " + WHO[w] + "'s librarian: a set is ready.";
      } else if (W.design === "number") {
        var s = named(W);
        W.holds.push({ o: w, set: s });
        var k3 = keepBack(W, w);
        msg += " The card gives " + WHO[w] + " a hold on set " + s + "; the counter keeps box " + k3 + " back and the program emails " + WHO[w] + "'s librarian: set " + s + " is ready.";
      } else {
        W.sets[b].hold = w;
        W.boxes[b].kept = w;
        msg += " The program puts set " + b + " on hold for " + WHO[w] + " and emails their librarian: set " + b + " is ready.";
      }
    }
    return { msg: msg, tone: tone };
  }
  function boxOf(W, o) {
    for (var n = 1; n <= 4; n++) if (W.boxes[n].at === o) return n;
    return null;
  }

  function note(W, e) {
    var many = W.design === "copy";
    W.edits = many ? 4 : 1;
    return { msg: stamp(e) + "The library adds a note to the symphony: mark in pencil only. " +
      (many ? "It has to be typed on 4 records, one per box." : "It goes on 1 record, the title's."), tone: many ? "warn" : "ok" };
  }

  // Loans the records get wrong: an orchestra the records say has a set (or a given set) that it
  // does not really have, or one that really has a box the records don't show. Borrowers left in
  // doubt by an unmatched return are not counted: the record makes no claim about them.
  function wrongCount(W) {
    var wrong = 0;
    Object.keys(WHO).forEach(function (o) {
      var real = boxOf(W, o);
      var claim = false;
      var claimSet = null;
      if (isTitleDesign(W.design)) {
        if (W.doubt.indexOf(o) >= 0) return;
        W.out.forEach(function (l) { if (l.o === o) { claim = true; claimSet = l.set; } });
      } else {
        for (var n = 1; n <= 4; n++) if (W.sets[n].loan === o) { claim = true; claimSet = n; }
      }
      if (claim !== (real !== null)) wrong += 1;
      else if (claim && claimSet !== null && claimSet !== real) wrong += 1;
    });
    return wrong;
  }

  function week(design) {
    var W = fresh(design);
    var steps = [];
    EVENTS.forEach(function (e) {
      var r;
      if (e.kind === "reserve") r = { msg: reserve(W, e), tone: "" };
      else if (e.kind === "borrow") r = borrow(W, e);
      else if (e.kind === "collect") r = collect(W, e);
      else if (e.kind === "nightbox") r = nightbox(W, e);
      else r = note(W, e);
      steps.push({ e: e, msg: r.msg, tone: r.tone, snap: snapshot(W) });
    });
    return steps;
  }

  function recordSays(W, n) {
    if (!isTitleDesign(W.design)) {
      var s = W.sets[n];
      if (s.loan) return "on loan: " + SHORTWHO[s.loan];
      if (s.hold) return "held for " + SHORTWHO[s.hold];
      return "on the shelf";
    }
    if (W.design === "number") {
      var said = null;
      W.out.forEach(function (l) { if (l.set === n) said = "on loan: " + SHORTWHO[l.o]; });
      W.holds.forEach(function (h) { if (h.set === n) said = "held for " + SHORTWHO[h.o]; });
      if (said) return said;
    }
    return "not recorded";
  }
  function really(W, n) {
    var b = W.boxes[n];
    if (b.at !== "shelf") return "with " + SHORTWHO[b.at];
    return b.kept ? "on the shelf, kept for " + SHORTWHO[b.kept] : "on the shelf";
  }
  function titleLine(W) {
    var wait = W.waiting.length ? W.waiting.map(function (w) { return SHORTWHO[w]; }).join(", ") : "nobody";
    if (W.design === "built") {
      return "title record: out " + W.out.map(function (l) { return SHORTWHO[l.o]; }).join(", ") + (W.doubt.length ? " (one of them returned, unknown which)" : "") +
        "; heldFor " + (W.heldFor ? SHORTWHO[W.heldFor] : "nobody") + "; waiting " + wait + "; free " + titleFree(W) + " of 4.";
    }
    if (isTitleDesign(W.design)) {
      return "title record: out " + W.out.map(function (l) { return SHORTWHO[l.o] + (l.set ? " (set " + l.set + ")" : ""); }).join(", ") +
        (W.doubt.length ? " (one of them returned, unknown which)" : "") + "; holds " +
        (W.holds.length ? W.holds.map(function (h) { return SHORTWHO[h.o] + (h.set ? " (set " + h.set + ")" : ""); }).join(", ") : "none") +
        "; waiting " + wait + "; free " + titleFree(W) + " of 4.";
    }
    return (W.design === "copy" ? "waiting list, filed under the symphony's name: " : "title record: waiting list ") + wait + "; free " + setFree(W).length + " of 4.";
  }
  function snapshot(W) {
    var rows = [];
    for (var n = 1; n <= 4; n++) rows.push({ n: n, really: really(W, n), says: recordSays(W, n) });
    return {
      rows: rows,
      title: titleLine(W),
      screen: W.screen,
      turned: W.turned,
      box1: W.box1,
      wrong: wrongCount(W),
      edits: W.edits,
      waiting: W.waiting.length ? W.waiting.map(function (w) { return SHORTWHO[w]; }).join(", ") : "nobody"
    };
  }
  function openSnap(design) { return snapshot(fresh(design)); }

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
    var title = el("p", "margin:0;font-size:12px;font-family:monospace;", "");
    box.appendChild(title);
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["box", "really", "the records say"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { el: el, head: head, title: title, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var snap = S.shown ? S.steps[S.shown - 1].snap : openSnap(S.design);
    S.ui.head.textContent = "Design: " + SHORT[S.design] + ". Requests shown: " + S.shown + " of " + S.steps.length + ".";
    S.ui.title.textContent = snap.title;
    clear(S.ui.tbody);
    snap.rows.forEach(function (r) {
      var tr = S.ui.el("tr");
      [String(r.n), r.really, r.says].forEach(function (c) { tr.appendChild(S.ui.el("td", "", c)); });
      S.ui.tbody.appendChild(tr);
    });
    S.stat.screen(snap.screen);
    S.stat.turned(snap.turned);
    S.stat.box1(snap.box1);
    S.stat.wrong(snap.wrong);
    S.stat.edits(snap.edits);
    S.stat.waiting(snap.waiting);
    S.ctl.step.disable(S.shown >= S.steps.length);
    S.ctl.play.disable(S.shown >= S.steps.length);
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < S.steps.length) {
      var s = S.steps[S.shown];
      S.shown += 1;
      api.clock = secs(s.e);
      api.log(s.msg, s.tone);
    }
  }

  function summary(S) {
    var z = S.steps[S.steps.length - 1].snap;
    return "Week replayed with " + SHORT[S.design] + ": " + z.screen + " free at 19:40 on Thursday, " + z.turned +
      " turned away with a set free; box 1 came back from, per the records: " + z.box1 + "; loans wrong: " + z.wrong + "; records changed for the note: " + z.edits + ".";
  }

  function playAll(api) {
    var S = api.state;
    showTo(api, S.steps.length);
    var z = S.steps[S.steps.length - 1].snap;
    api.log(summary(S), z.turned + z.wrong ? "bad" : "ok");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.design = "built";
      S.steps = week(S.design);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "Design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.design = String(o.value);
        S.steps = week(S.design);
        S.shown = 0;
        playAll(api);
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Play the week", function () { playAll(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        screen: api.stat("screen", "free on the screen, Thursday 19:40", "warn"),
        turned: api.stat("turned", "turned away with a set free", "bad"),
        box1: api.stat("box1", "box 1 came back from, per the records", ""),
        wrong: api.stat("wrong", "loans the records get wrong", "bad"),
        edits: api.stat("edits", "records changed for Monday's note", ""),
        waiting: api.stat("waiting", "waiting list now", "")
      };

      api.info("<strong>How to read it.</strong> One title, the symphony, has four sets of parts in boxes 1 to 4. " +
        "Each request runs through the design you pick. The line above the table is the title's record. " +
        "The table shows each box as it really is, and what the records say about it. " +
        "When the program names no set, the counter keeps the lowest-numbered box on the shelf back for each hold " +
        "and lends the lowest-numbered box that is not kept back. Step moves one request; Play runs the rest.");

      api.log("Tuesday 10:00. Box 1 is out with the railway orchestra; boxes 2, 3 and 4 are on the shelf. Eight requests come by Monday. Press Step or Play.", "");
      draw(api);
      api.clock = secs(OPEN);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens on Tuesday 10:00, before the first request.
      t.expect(t.stat("screen") === "not asked yet" && t.stat("turned") === 0 && t.stat("wrong") === 0 &&
        t.stat("box1") === "not back yet" && t.stat("waiting") === "nobody" && t.stat("edits") === "no note yet" &&
        has("Tuesday 10:00. Box 1 is out with the railway orchestra; boxes 2, 3 and 4 are on the shelf."),
        "Opens on Tuesday 10:00: box 1 out, nothing asked yet");

      // 2. Tuesday's hold zeroes the free count.
      t.click("step");
      t.expect(has("Tuesday 10:15. The hospital orchestra reserves a set for Saturday. free() is 3, so the card sets heldFor to the hospital orchestra. The counter keeps box 2 back. The screen now shows 0 of 4 free."),
        "As built: the hold on the title makes the screen show 0 of 4 free");

      // 3. Thursday night: both orchestras turned away with boxes on the shelf.
      t.click("step");
      t.click("step");
      t.expect(has("Thursday 19:40. The youth orchestra asks to borrow. The screen shows free 0 of 4: all sets on loan. The youth orchestra joins the waiting list, no. 1, with boxes 3 and 4 free on the shelf.") &&
        has("Thursday 19:52. The teachers' orchestra asks to borrow. The screen shows free 0 of 4: all sets on loan. The teachers' orchestra joins the waiting list, no. 2, with boxes 3 and 4 free on the shelf.") &&
        t.stat("screen") === "0 of 4" && t.stat("turned") === 2 && t.stat("waiting") === "youth, teachers'",
        "Thursday as built: 0 of 4 free at 19:40, 2 turned away with boxes 3 and 4 on the shelf");

      // 4. The rest of the week as built.
      t.click("play");
      t.expect(has("Saturday 10:20. The chamber orchestra asks to borrow. The screen shows 2 of 4 free; the counter lends box 3. That puts it ahead of the youth orchestra and the teachers' orchestra, still on the waiting list.") &&
        t.stat("turned") === 3 && t.stat("box1") === "can't tell: 1 of 3" && t.stat("waiting") === "teachers', fire brigade",
        "As built, the week: chamber served ahead of the list, box 1 untraceable, 3 turned away");

      // 5. Separate title and set records: the senior answer.
      t.set("design", "split");
      t.expect(has("Tuesday 10:15. The hospital orchestra reserves a set for Saturday. The program puts a hold on set 2, the lowest-numbered set on the shelf. The screen now shows 2 of 4 free.") &&
        has("Thursday 19:40. The youth orchestra asks to borrow. The screen shows 2 of 4 free and names set 3; the counter lends box 3.") &&
        t.stat("screen") === "2 of 4" && t.stat("turned") === 0 && t.stat("wrong") === 0 && t.stat("box1") === "railway orchestra" &&
        t.stat("edits") === 1 && t.stat("waiting") === "fire brigade",
        "Split: hold on set 2, set 3 lent at 19:40, box 1 traced to the railway orchestra, nothing wrong");

      // 6. Split, Monday: the returned set goes to the first on the waiting list.
      t.expect(has("Monday 09:00. Box 1 is in the night return box, its second horn part missing. Set 1's record names the railway orchestra, and closes its loan. The program puts set 1 on hold for the chamber orchestra and emails their librarian: set 1 is ready.") &&
        has("Monday 17:30. The fire brigade orchestra asks to borrow. The screen shows 0 of 4 free. The fire brigade orchestra joins the waiting list, no. 1. No box on the shelf is free."),
        "Split: on Monday set 1 is held for the chamber orchestra, and the fire brigade orchestra waits with no box free");

      // 7. A record per box: right all week, but the note goes on 4 records.
      t.set("design", "copy");
      t.expect(t.stat("screen") === "2 of 4" && t.stat("turned") === 0 && t.stat("wrong") === 0 && t.stat("box1") === "railway orchestra" &&
        t.stat("edits") === 4 && has("It has to be typed on 4 records, one per box."),
        "Copy: the same week as split, but Monday's note is typed on 4 records");

      // 8. Count holds as sets out: the screen is right, the return can't be traced.
      t.set("design", "count");
      t.expect(t.stat("screen") === "2 of 4" && t.stat("turned") === 0 && t.stat("wrong") === 0 && t.stat("box1") === "can't tell: 1 of 4" &&
        has("The card knows only that the railway orchestra, the youth orchestra, the teachers' orchestra and the hospital orchestra each have a set. It takes one set off the count, but can't say whose loan ended."),
        "Count: 2 of 4 free at 19:40, but box 1 could be any of 4 orchestras'");

      // 9. Holds named by number: the hold names set 1, which is out.
      t.set("design", "number");
      t.expect(has("The card gives the hold set 1, the lowest-numbered set with no hold. Box 1 is with the railway orchestra, so the counter keeps box 2 back. The screen now shows 2 of 4 free.") &&
        has("Saturday 10:00. The hospital orchestra comes to collect its set. The screen names set 1, but box 1 is not on the shelf; the counter hands over box 2, the box kept back. The record now says the hospital orchestra has set 1.") &&
        t.stat("screen") === "2 of 4",
        "Number: the hold names set 1, out with the railway orchestra; the hospital orchestra gets box 2");

      // 10. Number, Monday: box 1 closes the wrong orchestra's loan.
      t.expect(has("The record shows set 1 on loan to the hospital orchestra, so it closes their loan. Box 1 came from the railway orchestra; the hospital orchestra has box 2.") &&
        t.stat("box1") === "hospital orchestra (wrong)" && t.stat("wrong") === 2 && t.stat("turned") === 0,
        "Number: box 1 closes the hospital orchestra's loan; 2 loans wrong");
    }
  });
})();
