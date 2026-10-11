/* sims/s5e01-v1.0.0.js  (published as sims/s5e01.js)
   Case s5e01 "Two Hands, One Cup": a two-thread interleaving lab for the kitchen app at
   Heronsgate Hostel. Bookings for the one oven live in a Python dictionary in the app's memory;
   each tap runs book() on its own request thread. The learner sets the gap between the two taps,
   the front desk's lookup time, the fix, and where the operating system switches away from
   thread A, then steps through both threads on one timeline and reads the slot after each step.
   Widget-style sim: it draws its own code panel and timeline table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: threads A, B (bookings), C (a cancellation), D (the oven
     page); fixes as written, second check, one lock around the whole
     booking, lookup first and a lock only around check and write, read back after writing; gap
     0 to 60 ms; lookup 5 to 3,000 ms; switch points none, after A's first check, just before A's
     write, just after A's write; Step, Run to 18:55, Reset. Stats: race window, what 19:00 holds,
     confirmations, told 19:00 is gone, confirmed but not in the slot, longest wait for the lock,
     the 18:55 file. selfTest: 10 assertions.

   The model (stated in sim.lede and the info box):
   - Thread A: Nilufar (room 6) taps "book" for 19:00 at 18:52:41.208. Thread B: Halvorsen (room
     11) taps the gap later (23 ms on Thursday). Thread C: room 3 cancels its 20:30 booking at
     18:52:41.240, a different slot, so it only matters when it has to wait for a lock. Thread D:
     room 8 opens the oven page (reads every slot) at 18:52:41.260, the same way.
   - Steps in memory take no time. lookup_guest asks the front desk over the network and the
     thread waits the lookup time (40 ms on Thursday); Python's GIL is released while it waits,
     so other threads run.
   - The threads run in time order; at the same millisecond, A before B before C.
   - Code per fix (the case's reply options):
       as written: check, lookup, write, confirm.
       second check: check, lookup, check again, write, confirm.
       whole lock: lock, check, lookup, write, confirm, unlock.
       narrow lock: lookup, lock, check, write, unlock, confirm.
       read back: check, lookup, write, read back, confirm only if the slot holds your name.
     A check that finds the slot taken releases any lock held and tells the guest 19:00 is gone.
     C's cancellation and D's oven page take the same lock in both lock fixes.
   - A switch point pauses thread A there once; A runs again when B has finished or is waiting
     for the lock. The operating system decides which thread runs next, and may switch after any
     line (Python's sys.setswitchinterval documentation).
   - The lock is first come, first served. Wait = when a thread gets the lock minus when it asked.
   - Race window = the longest time between a thread's last check and its write, for writes made
     without the lock held, so far in the run (0 before the first write). Zero when every write
     is made under the lock.
   - The file is written from the dictionary at 18:55:00.000.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e01-v1.0.0.json).
   All of these come out of the model above and are checked by the selfTest.
   - Thursday, as written (gap 23, lookup 40): A checks at .208 (None), B at .231 (None); A writes
     Nilufar at .248, B writes Halvorsen over it at .271. 2 confirmations, 1 confirmed name not in
     the slot, the file says 19:00 Halvorsen. Race window 40 ms. The window is open while
     gap < lookup: gap 39 gives 2 confirmations, gap 40 gives 1 (A writes at .248 before B checks).
   - Second check, no switch: B's second check at .271 finds Nilufar: 1 confirmation, window 0.
     Switch just before A's write: A rechecks at .248, pauses, B rechecks at .271 (None), writes
     Halvorsen, confirms; A writes Nilufar over it at .271: 2 confirmations, file Nilufar, window
     23 ms (.248 to .271).
   - Read back: A reads back Nilufar at .248 and confirms before B writes at .271: 2 confirmations,
     file Halvorsen, window 40 ms.
   - Whole lock, lookup 40: A holds the lock .208 to .248; B waits 17 ms, C 8 ms; 1 confirmation.
     D, at .260, finds it free. Lookup 3,000 (the front desk at check-in): A holds it to
     18:52:44.208; B waits 2,977 ms, C 2,968 ms, D 2,948 ms.
   - Narrow lock: 1 confirmation, file Nilufar, nobody waits (0 ms) at 40 or 3,000 ms, and 1
     confirmation for every gap from 0 to 60 ms and every switch point.
*/
(function () {
  "use strict";

  var T0 = (18 * 3600 + 52 * 60 + 41) * 1000;   // 18:52:41.000 in ms
  var FILE_AT = (18 * 3600 + 55 * 60) * 1000;   // 18:55:00.000
  var A_TAP = 208;
  var C_TAP = 240;
  var D_TAP = 260;

  var FIXES = [
    { value: "none", label: "As written (no fix)" },
    { value: "recheck", label: "Check again just before the write" },
    { value: "wide", label: "One lock around the whole booking" },
    { value: "narrow", label: "Look up first; lock only check and write" },
    { value: "readback", label: "Read the slot back after writing" }
  ];
  var SWITCHES = [
    { value: "none", label: "Only while waiting on the front desk" },
    { value: "afterCheck", label: "After A's first check" },
    { value: "beforeWrite", label: "Just before A's write" },
    { value: "afterWrite", label: "Just after A's write" }
  ];
  var CODE = {
    none: [
      "def book(slot, guest_id):",
      "    if slots[slot] is None:            # check",
      "        name = lookup_guest(guest_id)  # about 40 ms",
      "        slots[slot] = name             # act",
      "        confirm(guest_id, slot)"
    ],
    recheck: [
      "def book(slot, guest_id):",
      "    if slots[slot] is None:            # check",
      "        name = lookup_guest(guest_id)",
      "        if slots[slot] is None:        # again",
      "            slots[slot] = name         # act",
      "            confirm(guest_id, slot)"
    ],
    wide: [
      "def book(slot, guest_id):",
      "    with slots_lock:                   # all of it",
      "        if slots[slot] is None:",
      "            name = lookup_guest(guest_id)",
      "            slots[slot] = name",
      "            confirm(guest_id, slot)"
    ],
    narrow: [
      "def book(slot, guest_id):",
      "    name = lookup_guest(guest_id)      # no lock",
      "    with slots_lock:                   # check, act",
      "        free = slots[slot] is None",
      "        if free:",
      "            slots[slot] = name",
      "    if free:",
      "        confirm(guest_id, slot)"
    ],
    readback: [
      "def book(slot, guest_id):",
      "    if slots[slot] is None:            # check",
      "        name = lookup_guest(guest_id)",
      "        slots[slot] = name             # act",
      "        if slots[slot] == name:        # read back",
      "            confirm(guest_id, slot)"
    ]
  };
  var OPS = {
    none: ["tap", "check", "lookup", "write", "confirm"],
    recheck: ["tap", "check", "lookup", "recheck", "write", "confirm"],
    wide: ["tap", "lock", "check", "lookup", "write", "confirm", "unlock"],
    narrow: ["tap", "lookup", "lock", "check", "write", "unlock", "confirm"],
    readback: ["tap", "check", "lookup", "write", "readback"]
  };

  /* ---------- small helpers ---------- */

  function pad(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }
  function clock(ms) {
    var t = T0 + ms;
    if (ms === null) t = FILE_AT;
    var h = Math.floor(t / 3600000);
    var m = Math.floor(t / 60000) % 60;
    var s = Math.floor(t / 1000) % 60;
    return pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2) + "." + pad(t % 1000, 3);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function show(v) { return v === null ? "None" : v; }
  function label(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label;
    return v;
  }

  /* ---------- the model: a pure function of the settings ---------- */

  function simulate(C) {
    var slot = null;
    var lock = { holder: null, queue: [] };
    var events = [];
    var confirmed = [];
    var gone = [];
    var win = 0;
    var maxWait = 0;
    var now = 0;
    var locking = C.fix === "wide" || C.fix === "narrow";
    var A = { id: "A", who: "Nilufar", room: 6, ready: A_TAP, ops: OPS[C.fix].slice(), pc: 0 };
    var B = { id: "B", who: "Halvorsen", room: 11, ready: A_TAP + C.gap, ops: OPS[C.fix].slice(), pc: 0 };
    var Cc = { id: "C", who: null, room: 3, ready: C_TAP, ops: locking ? ["lock", "cancel", "unlock"] : ["cancel"], pc: 0 };
    var D = { id: "D", who: null, room: 8, ready: D_TAP, ops: locking ? ["lock", "menu", "unlock"] : ["menu"], pc: 0 };
    var threads = [A, B, Cc, D];
    threads.forEach(function (th) { th.done = false; th.blocked = false; th.paused = false; th.holds = false; th.lastCheck = null; th.last = null; });
    var switched = C.sw === "none";

    function ev(th, text, tone) {
      events.push({ t: now, th: th ? th.id : "", text: clock(now) + " " + (th ? th.id + " " : "") + text, tone: tone || "",
        slot: slot, conf: confirmed.length, gone: gone.length, wait: maxWait, win: win,
        lost: confirmed.filter(function (n) { return n !== slot; }).length });
    }
    function freeA() {
      if (A.paused && (B.done || B.blocked)) { A.paused = false; A.ready = now; ev(A, "runs again.", ""); }
    }
    function refuse(th) {
      // keep the step running now (at pc); the thread goes on with these after it
      th.ops = th.ops.slice(0, th.pc + 1).concat(th.holds ? ["unlock", "refuse"] : ["refuse"]);
    }
    function check(th, again) {
      th.lastCheck = now;
      if (slot === null) {
        ev(th, (again ? "checks 19:00 again: " : "checks 19:00: ") + "None, so free.", "");
      } else {
        ev(th, (again ? "checks 19:00 again: " : "checks 19:00: ") + slot + ", so taken.", "warn");
        refuse(th);
      }
    }
    function release(th) {
      lock.holder = null;
      th.holds = false;
      ev(th, "releases the lock.", "");
      if (lock.queue.length) {
        var nx = lock.queue.shift();
        nx.blocked = false;
        nx.holds = true;
        lock.holder = nx;
        nx.ready = now;
        var w = now - nx.asked;
        if (w > maxWait) maxWait = w;
        ev(nx, "gets the lock after waiting " + fmt(w) + " ms.", w > 1000 ? "bad" : (w > 0 ? "warn" : ""));
      }
    }

    function runOp(th, op) {
      if (op === "tap") {
        ev(th, "room " + th.room + " (" + th.who + ") taps book for 19:00.", "");
      } else if (op === "check" || op === "recheck") {
        check(th, op === "recheck");
      } else if (op === "lookup") {
        ev(th, "asks the front desk for " + th.who + "'s name: " + fmt(C.lookup) + " ms, the GIL released while it waits.", "");
        th.ready = now + C.lookup;
      } else if (op === "write") {
        var before = slot;
        if (!th.holds && th.lastCheck !== null && now - th.lastCheck > win) win = now - th.lastCheck;
        slot = th.who;
        ev(th, "writes " + th.who + " to 19:00 (it held " + show(before) + ").", before !== null ? "bad" : "");
      } else if (op === "readback") {
        if (slot === th.who) {
          ev(th, "reads 19:00 back: " + slot + ", its own name.", "");
          th.ops.push("confirm");
        } else {
          ev(th, "reads 19:00 back: " + show(slot) + ", not " + th.who + ".", "warn");
          th.ops.push("refuse");
        }
      } else if (op === "confirm") {
        confirmed.push(th.who);
        ev(th, "confirms 19:00 to " + th.who + ".", confirmed.length > 1 ? "bad" : "ok");
      } else if (op === "refuse") {
        gone.push(th.who);
        ev(th, "tells " + th.who + " 19:00 is gone.", "");
      } else if (op === "cancel") {
        ev(th, "room 3 cancels its 20:30 booking.", "");
      } else if (op === "menu") {
        ev(th, "room 8 opens the oven page and reads every slot.", "");
      } else if (op === "lock") {
        if (lock.holder === null) {
          lock.holder = th;
          th.holds = true;
          ev(th, "takes the lock.", "");
        } else {
          th.blocked = true;
          th.asked = now;
          lock.queue.push(th);
          ev(th, "asks for the lock: " + lock.holder.id + " holds it, so " + th.id + " waits.", "warn");
          th.pc += 1;
          return;
        }
      } else if (op === "unlock") {
        release(th);
      }
      th.pc += 1;
    }

    for (var guard = 0; guard < 200; guard++) {
      var pick = null;
      for (var i = 0; i < threads.length; i++) {
        var th = threads[i];
        if (th.done || th.blocked || th.paused) continue;
        if (pick === null || th.ready < pick.ready) pick = th;
      }
      if (pick === null) break;
      if (pick.ready > now) now = pick.ready;
      var op = pick.ops[pick.pc];
      if (pick === A && !switched) {
        var hit = (C.sw === "afterCheck" && A.last === "check") || (C.sw === "beforeWrite" && op === "write") ||
          (C.sw === "afterWrite" && A.last === "write");
        if (hit) {
          switched = true;
          if (!B.done && !B.blocked) {
            A.paused = true;
            ev(A, "is switched out by the operating system, " + (C.sw === "afterWrite" ? "just after its write." : (C.sw === "beforeWrite" ? "just before its write." : "just after its check.")), "warn");
            continue;
          }
        }
      }
      runOp(pick, op);
      pick.last = op;
      if (pick.pc >= pick.ops.length) pick.done = true;
      if (pick === B) freeA();
    }
    var end = { t: null, th: "", text: clock(null) + " The file is written: 19:00 " + show(slot) + ". Confirmations sent: " + confirmed.length + ".",
      tone: confirmed.length > 1 ? "bad" : "ok", slot: slot, conf: confirmed.length, gone: gone.length, wait: maxWait, win: win,
      lost: confirmed.filter(function (n) { return n !== slot; }).length, file: true };
    events.push(end);
    return { events: events, window: win, slot: slot, confirmed: confirmed, gone: gone, wait: maxWait, lost: end.lost };
  }

  /* ---------- the widget ---------- */

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
    var code = el("pre", "margin:0;font-size:11px;line-height:1.45;overflow-x:auto;padding:8px;border:1px solid currentColor;border-radius:4px;opacity:0.9;");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["#", "time", "thread", "step", "19:00 holds"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 6px;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    var foot = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    box.appendChild(code);
    box.appendChild(wrap);
    box.appendChild(foot);
    api.root.appendChild(box);
    return { el: el, head: head, code: code, tbody: tbody, foot: foot };
  }

  function draw(api) {
    var S = api.state;
    var ui = S.ui;
    var C = S.C;
    var R = S.result;
    var shown = R.events.slice(0, S.pos);
    var lastEv = shown.length ? shown[shown.length - 1] : null;
    ui.head.textContent = label(FIXES, C.fix) + ". Taps " + C.gap + " ms apart, lookup " + fmt(C.lookup) + " ms, switch: " +
      label(SWITCHES, C.sw).toLowerCase() + ". Step " + S.pos + " of " + R.events.length + ".";
    ui.code.textContent = CODE[C.fix].join("\n");
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    shown.forEach(function (e, k) {
      var tr = ui.el("tr", "");
      var time = e.text.slice(0, 12);
      var rest = e.text.slice(13);
      if (e.th) rest = rest.slice(2);
      var tone = e.tone === "bad" ? "color:var(--bad, #c0392b);font-weight:600;" : (e.tone === "warn" ? "color:var(--warn, #b7791f);" : (e.tone === "ok" ? "color:var(--ok, #2f855a);" : ""));
      [String(k + 1), time, e.th || "-", rest, show(e.slot)].forEach(function (c, j) {
        tr.appendChild(ui.el("td", "padding:2px 6px;vertical-align:top;" + (j === 3 ? tone : ""), c));
      });
      ui.tbody.appendChild(tr);
    });
    var conf = R.confirmed.slice(0, lastEv ? lastEv.conf : 0);
    ui.foot.textContent = "Phones showing 'Oven booked, 19:00': " + (conf.length ? conf.join(", ") : "none yet") + ".";
    S.stat.window(lastEv ? lastEv.win : 0);
    S.stat.slot(show(lastEv ? lastEv.slot : null));
    S.stat.confirmed(lastEv ? lastEv.conf : 0);
    S.stat.gone(lastEv ? lastEv.gone : 0);
    S.stat.lost(lastEv ? lastEv.lost : 0);
    S.stat.wait(fmt(lastEv ? lastEv.wait : 0));
    S.stat.file(lastEv && lastEv.file ? "19:00 " + show(lastEv.slot) : "not written yet");
    S.ctl.step.disable(S.pos >= R.events.length);
    S.ctl.run.disable(S.pos >= R.events.length);
  }

  function rebuild(api, why) {
    var S = api.state;
    S.result = simulate(S.C);
    S.pos = 0;
    if (why) api.log(why + " Back to 18:52:41.000; press Step or Run.", "");
    draw(api);
  }

  function advance(api, n) {
    var S = api.state;
    var R = S.result;
    var stop = Math.min(R.events.length, S.pos + n);
    while (S.pos < stop) {
      var e = R.events[S.pos];
      api.log(e.text, e.tone);
      S.pos += 1;
    }
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s5e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { fix: "none", gap: 23, lookup: 40, sw: "none" };
      S.simulate = simulate;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.fix = api.control.select("fix", "The fix", FIXES, "none", function (v) {
        S.C.fix = String(v);
        rebuild(api, "Fix: " + label(FIXES, S.C.fix) + ".");
      });
      S.ctl.gap = api.control.range("gap", "Gap between the two taps (ms)", 0, 60, 1, 23, function (v) {
        S.C.gap = Math.max(0, Math.min(60, Math.round(Number(v))));
        rebuild(api, "B taps " + S.C.gap + " ms after A.");
      });
      S.ctl.lookup = api.control.range("lookup", "Front desk lookup (ms)", 5, 3000, 5, 40, function (v) {
        S.C.lookup = Math.max(5, Math.min(3000, Math.round(Number(v))));
        rebuild(api, "The front desk takes " + fmt(S.C.lookup) + " ms.");
      });
      S.ctl.sw = api.control.select("switch", "Where the operating system switches away from A", SWITCHES, "none", function (v) {
        S.C.sw = String(v);
        rebuild(api, "Switch: " + label(SWITCHES, S.C.sw).toLowerCase() + ".");
      });
      S.ctl.step = api.control.button("step", "Step", function () { advance(api, 1); });
      S.ctl.run = api.control.button("run", "Run to 18:55", function () { advance(api, 1000); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        window: api.stat("window", "race window (ms)", "warn"),
        slot: api.stat("slot", "19:00 holds", ""),
        confirmed: api.stat("confirmed", "confirmations for 19:00", "bad"),
        gone: api.stat("gone", "told 19:00 is gone", ""),
        lost: api.stat("lost", "confirmed, name not in the slot", "bad"),
        wait: api.stat("wait", "longest wait for the lock (ms)", "warn"),
        file: api.stat("file", "the 18:55 file", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one step of one thread, in time order, and the last column is what <code>slots[\"19:00\"]</code> holds after it. Steps in memory take no time; asking the front desk takes the lookup time, and Python releases the GIL while a thread waits, so other threads run. A is Nilufar's tap, B is Halvorsen's, C is room 3 cancelling 20:30, D is room 8 opening the oven page. The race window is the longest time between a thread's last check and its write, when no lock is held.");

      S.result = simulate(S.C);
      S.pos = 0;
      api.log("Thursday, as Ravindra wrote it. A: Nilufar taps book at 18:52:41.208. B: Halvorsen taps 23 ms later. C: room 3 cancels 20:30 at 18:52:41.240. D: room 8 opens the oven page at 18:52:41.260. Press Step or Run.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var S = function () { return t.api.state; };
      function texts() { return S().result.events.map(function (e) { return e.text; }).join("\n"); }
      function runWith(fix, gap, lookup, sw) {
        t.set("fix", fix); t.set("gap", gap); t.set("lookup", lookup); t.set("switch", sw);
        t.click("run");
      }

      // 1. The opening state: before the first tap, nothing run.
      t.expect(t.stat("slot") === "None" && t.stat("confirmed") === 0 && t.stat("gone") === 0 && t.stat("lost") === 0 &&
        t.stat("file") === "not written yet" && t.stat("window") === 0 && t.stat("wait") === 0 && S().pos === 0 &&
        S().result.window === 40 &&
        t.logText().indexOf("A: Nilufar taps book at 18:52:41.208. B: Halvorsen taps 23 ms later.") >= 0,
        "Opens before the first tap: 19:00 holds None, no confirmations; the run ahead has a 40 ms race window");

      // 2. Five steps in, both threads have checked and seen None.
      t.click("step"); t.click("step"); t.click("step"); t.click("step"); t.click("step");
      t.expect(S().pos === 5 && t.stat("slot") === "None" && t.stat("confirmed") === 0 &&
        t.logText().indexOf("18:52:41.208 A checks 19:00: None, so free.") >= 0 &&
        t.logText().indexOf("18:52:41.231 B checks 19:00: None, so free.") >= 0,
        "After 5 steps A checked at .208 and B at .231, and both saw None");

      // 3. Thursday to the end: two confirmations, one saved name.
      t.click("run");
      t.expect(t.stat("confirmed") === 2 && t.stat("lost") === 1 && t.stat("slot") === "Halvorsen" && t.stat("window") === 40 &&
        t.stat("file") === "19:00 Halvorsen" &&
        t.logText().indexOf("18:52:41.248 A writes Nilufar to 19:00 (it held None).") >= 0 &&
        t.logText().indexOf("18:52:41.271 B writes Halvorsen to 19:00 (it held Nilufar).") >= 0 &&
        t.logText().indexOf("18:55:00.000 The file is written: 19:00 Halvorsen. Confirmations sent: 2.") >= 0,
        "Thursday: 23 ms gap inside the 40 ms window, 2 confirmations, the 18:55 file names only Halvorsen");

      // 4. The window is the lookup time: gap 39 races, gap 40 doesn't.
      runWith("none", 39, 40, "none");
      var g39 = t.stat("confirmed");
      runWith("none", 40, 40, "none");
      t.expect(g39 === 2 && t.stat("confirmed") === 1 && t.stat("gone") === 1 && t.stat("file") === "19:00 Nilufar",
        "Gap 39 ms gives 2 confirmations; gap 40 ms gives 1, and Halvorsen is told 19:00 is gone");

      // 5. Second check: fine on Thursday's timings, broken by a switch just before the write.
      runWith("recheck", 23, 40, "none");
      var r0 = t.stat("confirmed") === 1 && t.stat("window") === 0 && t.stat("file") === "19:00 Nilufar";
      runWith("recheck", 23, 40, "beforeWrite");
      t.expect(r0 && t.stat("confirmed") === 2 && t.stat("window") === 23 && t.stat("lost") === 1 &&
        t.stat("file") === "19:00 Nilufar" &&
        texts().indexOf("18:52:41.271 B checks 19:00 again: None, so free.") >= 0 &&
        texts().indexOf("18:52:41.271 A writes Nilufar to 19:00 (it held Halvorsen).") >= 0,
        "Second check: 1 confirmation with no switch; a switch before A's write gives 2, a 23 ms window, and the file says Nilufar");

      // 6. Read back: A reads its own name before B writes.
      runWith("readback", 23, 40, "none");
      t.expect(t.stat("confirmed") === 2 && t.stat("window") === 40 && t.stat("file") === "19:00 Halvorsen" &&
        texts().indexOf("18:52:41.248 A reads 19:00 back: Nilufar, its own name.") >= 0,
        "Read back: A reads Nilufar at .248 and confirms before B writes at .271; 2 confirmations");

      // 7. Whole-booking lock: correct, and every tap waits behind the lookup.
      runWith("wide", 23, 40, "none");
      var w40 = t.stat("confirmed") === 1 && t.stat("wait") === 17 && t.stat("window") === 0 &&
        texts().indexOf("18:52:41.248 C gets the lock after waiting 8 ms.") >= 0;
      runWith("wide", 23, 3000, "none");
      t.expect(w40 && t.stat("confirmed") === 1 && t.stat("wait") === "2,977" &&
        texts().indexOf("18:52:44.208 B gets the lock after waiting 2,977 ms.") >= 0 &&
        texts().indexOf("18:52:44.208 C gets the lock after waiting 2,968 ms.") >= 0 &&
        texts().indexOf("18:52:44.208 D gets the lock after waiting 2,948 ms.") >= 0,
        "Whole lock: 1 confirmation; B waits 17 ms at a 40 ms lookup; at 3,000 ms B waits 2,977, the cancellation 2,968 and the oven page 2,948");

      // 8. Narrow lock: one confirmation, nobody waits, even at 3,000 ms.
      runWith("narrow", 23, 3000, "none");
      var n3 = t.stat("confirmed") === 1 && t.stat("wait") === 0 && t.stat("file") === "19:00 Nilufar";
      runWith("narrow", 23, 40, "none");
      t.expect(n3 && t.stat("confirmed") === 1 && t.stat("gone") === 1 && t.stat("wait") === 0 && t.stat("window") === 0 &&
        texts().indexOf("18:52:41.271 B checks 19:00: Nilufar, so taken.") >= 0,
        "Narrow lock: 1 confirmation and 0 ms waiting at both 40 and 3,000 ms; B's check at .271 finds Nilufar");

      // 9. Narrow lock with a switch inside the critical section: B waits for the lock, still 1.
      runWith("narrow", 23, 40, "beforeWrite");
      t.expect(t.stat("confirmed") === 1 && t.stat("file") === "19:00 Nilufar" &&
        texts().indexOf("18:52:41.271 B asks for the lock: A holds it, so B waits.") >= 0,
        "Narrow lock, switched out just before the write: B waits for the lock and still sees Nilufar");

      // 10. Narrow lock: exactly one confirmation for every gap and every switch point.
      var bad = 0;
      ["none", "afterCheck", "beforeWrite", "afterWrite"].forEach(function (sw) {
        for (var g = 0; g <= 60; g++) {
          var r = S().simulate({ fix: "narrow", gap: g, lookup: 40, sw: sw });
          if (r.confirmed.length !== 1 || r.lost !== 0) bad += 1;
        }
      });
      var none0 = 0;
      for (var g2 = 0; g2 < 40; g2++) if (S().simulate({ fix: "none", gap: g2, lookup: 40, sw: "none" }).confirmed.length === 2) none0 += 1;
      t.expect(bad === 0 && none0 === 40,
        "Narrow lock: 1 confirmation for all 244 runs (gaps 0 to 60, 4 switch points); as written, every gap from 0 to 39 ms double-books");
    }
  });
})();
