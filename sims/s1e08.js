/* sims/s1e08-v1.0.1.js  (published as sims/s1e08.js)
   Case s1e08 "The Process That Wouldn't Die": processes, threads, CPU cores, signals and zombies.

   CHANGELOG
   v1.0.1 (2026-10-06) review fixes: a "Restart chartfeed" control (id restart) ends the parent and
     starts it again as a new process with the next free PID. Its zombie children become orphans,
     and init (PID 1) adopts them and collects them at once, so the zombies leave the list. Its
     running workers are adopted too: they show PPID 1, keep uploading, and init collects each one
     the moment it ends, so an orphan never lingers as a zombie. Every process now records its own
     PPID; the parent's row, node and wait() only count its own children; an orphan's edge from
     chartfeed is drawn cut. selfTest steps 9 and 10 add: after a restart the zombie is gone, the
     running worker shows PPID 1 under a new chartfeed PID, and when it ends init collects it at once.
   v1.0.0 (2026-10-06) first version: the records server's four CPU cores, the scheduler, chartfeed
     (PID 2210, the parent) and four scanners that can each get a worker process, plus a ps-style
     process table built in api.root under the diagram. Controls: slot (which scanner), start,
     thread, term (SIGTERM), kill (SIGKILL), exit (let it finish and exit, uncollected), wait
     (the parent collects its ended children), autowait (the fix: collect each child as it ends),
     reset. Stats: running, zombies, cores busy, pages never uploaded because of SIGKILL.
     selfTest checks PIDs, threads on cores, more threads than cores, SIGKILL losing work and
     leaving a zombie, kill -9 doing nothing to a zombie, wait, SIGTERM letting a worker finish,
     and the fix.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Processes come and go, but diagram nodes are fixed, so each scanner is a fixed slot that
     shows its newest worker. Every process, zombies included, lives in S.procs and shows in the
     process table under the diagram.
   - The scheduler is simplified on purpose: every runnable thread gets an equal share of the
     four cores (fair sharing), and the core boxes rotate which threads they show every half
     second of real time, a slowed-down picture of time slices that really last milliseconds.
   - Deterministic: no randomness is needed. PIDs count up from 3118, as in the story.
*/
(function () {
  "use strict";

  var PARENT_PID = 2210;                    // chartfeed's PID until it is restarted
  var INIT_PID = 1;                         // init, which adopts orphans and collects them at once
  var FIRST_PID = 3118;
  var CORES = 4;
  var SPEED = 10;                           // sim seconds per real second
  var PAGE_RATE = 0.5;                      // pages per sim second for one thread that has a core
  var BASE_MB = 120;                        // a worker's memory with one thread
  var THREAD_MB = 16;                       // each extra thread's stack and buffers
  var PARENT_MB = 40;
  var MAX_THREADS = 4;
  var SLICE = 0.5;                          // real seconds between core rotations
  var START_CLOCK = 23 * 3600 + 50 * 60;    // 23:50:00
  var MIDNIGHT = 24 * 3600;
  var DOT_SPEED = 520;

  var SLOTS = [
    { id: "a", node: "slotA", name: "Scanner A", bed: "Bed 14", pages: 600 },
    { id: "b", node: "slotB", name: "Scanner B", bed: "Bed 3", pages: 48 },
    { id: "c", node: "slotC", name: "Scanner C", bed: "Bed 9", pages: 120 },
    { id: "d", node: "slotD", name: "Scanner D", bed: "Bed 21", pages: 30 }
  ];

  var SLOT_OPTIONS = SLOTS.map(function (s) {
    return { value: s.id, label: s.name + " (" + s.bed + ", " + s.pages + " pages)" };
  });

  /* Layout checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px, group 11px),
     including the longest text each box can show: a slot's meta "600/600, 4 thr, 168MB" (21 chars,
     139px) fits its 170px box, and the parent's meta "3 running, 4 zombies" fits 200px. */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 360,
    aria: "Records server sim. Four CPU cores across the top, each showing the thread it is running. In the middle: you, typing kill commands; chartfeed, PID 2210, the parent process; and the scheduler, part of the operating system. Along the bottom, four scanners, each of which can have a worker process that chartfeed started.",
    groups: [
      { label: "CPU, 4 cores", x: 8, y: 6, w: 724, h: 96 }
    ],
    nodes: [
      { id: "core0", label: "Core 0", sub: "idle", x: 100, y: 64, w: 160, h: 52, shape: "box", tone: "muted" },
      { id: "core1", label: "Core 1", sub: "idle", x: 280, y: 64, w: 160, h: 52, shape: "box", tone: "muted" },
      { id: "core2", label: "Core 2", sub: "idle", x: 460, y: 64, w: 160, h: 52, shape: "box", tone: "muted" },
      { id: "core3", label: "Core 3", sub: "idle", x: 640, y: 64, w: 160, h: 52, shape: "box", tone: "muted" },
      { id: "you", label: "You", sub: "typing kill", x: 110, y: 170, w: 150, h: 52, shape: "box", tone: "" },
      { id: "parent", label: "chartfeed", sub: "PID 2210, parent", meta: "children: 0", x: 370, y: 170, w: 200, h: 62, shape: "box", tone: "" },
      { id: "sched", label: "Scheduler", sub: "part of the OS", meta: "0 threads, 4 cores", x: 630, y: 170, w: 170, h: 62, shape: "box", tone: "" },
      { id: "slotA", label: "Scanner A", sub: "no worker", meta: "Bed 14, 600 pages", x: 95, y: 300, w: 170, h: 62, shape: "box", tone: "muted" },
      { id: "slotB", label: "Scanner B", sub: "no worker", meta: "Bed 3, 48 pages", x: 275, y: 300, w: 170, h: 62, shape: "box", tone: "muted" },
      { id: "slotC", label: "Scanner C", sub: "no worker", meta: "Bed 9, 120 pages", x: 465, y: 300, w: 170, h: 62, shape: "box", tone: "muted" },
      { id: "slotD", label: "Scanner D", sub: "no worker", meta: "Bed 21, 30 pages", x: 645, y: 300, w: 170, h: 62, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "parent", to: "slotA" },
      { from: "parent", to: "slotB" },
      { from: "parent", to: "slotC" },
      { from: "parent", to: "slotD" }
    ]
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function padL(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }
  function padR(s, n) { s = String(s); while (s.length < n) s = s + " "; return s; }

  function slotIndex(id) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === id) return i;
    return 0;
  }

  function findProc(S, pid) {
    for (var i = 0; i < S.procs.length; i++) if (S.procs[i].pid === pid) return S.procs[i];
    return null;
  }

  // The newest process for a scanner, if its entry still exists (a collected one is gone).
  function current(S, k) {
    var pid = S.slotPid[k];
    return pid === null ? null : findProc(S, pid);
  }

  function alive(p) { return !!p && (p.state === "run" || p.state === "stopping"); }

  function memory(p) {
    if (!alive(p)) return 0;
    return BASE_MB + THREAD_MB * (p.threads - 1);
  }

  // Every runnable thread, in a stable order: by PID, then thread number.
  function runnable(S) {
    var list = [];
    S.procs.forEach(function (p) {
      if (!alive(p)) return;
      for (var t = 1; t <= p.threads; t++) list.push({ pid: p.pid, t: t });
    });
    return list;
  }

  // With `ppid`, only that parent's children are counted.
  function counts(S, ppid) {
    var running = 0, zombies = 0;
    S.procs.forEach(function (p) {
      if (ppid !== undefined && p.ppid !== ppid) return;
      if (alive(p)) running += 1;
      else if (p.state === "zombie") zombies += 1;
    });
    return { running: running, zombies: zombies };
  }

  function orphan(p) { return !!p && p.ppid === INIT_PID; }

  function pagesText(p) { return Math.floor(p.done) + "/" + p.pages; }

  /* ---------- drawing ---------- */

  function tableText(S) {
    var c = counts(S, S.parentPid);
    var lines = [];
    lines.push("  PID  PPID STAT THR    MEM  CMD                 CHART");
    lines.push(padL(S.parentPid, 5) + padL(INIT_PID, 6) + " S   " + padL(1, 4) + padL(PARENT_MB + "MB", 7) + "  " +
      padR("chartfeed", 20) + "parent of " + (c.running + c.zombies) + " in this list");
    S.procs.forEach(function (p) {
      var slot = SLOTS[p.slot];
      var stat = p.state === "zombie" ? "Z" : "R";
      var cmd = p.state === "zombie" ? "[worker] <defunct>" : "worker " + slot.id.toUpperCase();
      var chart;
      if (p.state === "zombie") chart = "ended at " + pagesText(p) + ", " + p.status;
      else chart = slot.bed + ": " + pagesText(p) + (p.state === "stopping" ? ", finishing (SIGTERM)" : "") +
        (orphan(p) ? ", orphan (init adopted it)" : "");
      lines.push(padL(p.pid, 5) + padL(p.ppid, 6) + " " + stat + "   " + padL(p.state === "zombie" ? 0 : p.threads, 4) +
        padL(memory(p) + "MB", 7) + "  " + padR(cmd, 20) + chart);
    });
    if (!S.procs.length) lines.push("  (no workers yet: pick a scanner and start one)");
    return lines.join("\n");
  }

  function drawCores(api) {
    var S = api.state;
    var list = runnable(S);
    var busy = Math.min(list.length, CORES);
    for (var i = 0; i < CORES; i++) {
      var id = "core" + i;
      if (i < busy) {
        var th = list[(S.offset + i) % list.length];
        api.node(id).text("sub", th.pid + ", thread " + th.t);
        api.node(id).set("ok");
      } else {
        api.node(id).text("sub", "idle");
        api.node(id).set("muted");
      }
    }
    api.node("sched").text("meta", list.length + (list.length === 1 ? " thread, " : " threads, ") + CORES + " cores");
    api.node("sched").set(list.length > CORES ? "warn" : "");
    return busy;
  }

  function drawSlots(api) {
    var S = api.state;
    SLOTS.forEach(function (slot, k) {
      var p = current(S, k);
      var node = api.node(slot.node);
      if (!p) {
        node.text("sub", "no worker");
        node.text("meta", slot.bed + ", " + slot.pages + " pages");
        node.set("muted");
      } else if (p.state === "zombie") {
        node.text("sub", p.pid + " zombie (Z)");
        node.text("meta", "ended " + pagesText(p) + ", 0MB");
        node.set("zombie");
      } else {
        node.text("sub", p.state === "stopping" ? p.pid + " finishing" : "PID " + p.pid + (orphan(p) ? ", orphan" : ", running"));
        node.text("meta", pagesText(p) + ", " + p.threads + " thr, " + memory(p) + "MB");
        node.set(p.state === "stopping" ? "warn" : "ok");
      }
      // An orphan's parent is init now, not chartfeed, so its line from chartfeed is drawn cut.
      api.edge("parent", slot.node).set(alive(p) && orphan(p) ? "cut" : "");
    });
  }

  function draw(api) {
    var S = api.state;
    var c = counts(S);
    var own = counts(S, S.parentPid);
    var busy = drawCores(api);
    drawSlots(api);
    var meta = own.running + " running, " + own.zombies + (own.zombies === 1 ? " zombie" : " zombies");
    api.node("parent").text("sub", "PID " + S.parentPid + ", parent");
    api.node("parent").text("meta", (own.running + own.zombies) ? meta : "children: 0");
    api.node("parent").set(own.zombies ? "warn" : "");
    S.stat.running(c.running);
    S.stat.zombies(c.zombies);
    S.stat.cores(busy);
    S.stat.lost(S.lost);
    if (S.ui) {
      var txt = tableText(S);
      if (S.ui.table.textContent !== txt) S.ui.table.textContent = txt;
    }
  }

  function signalDot(api, k, cls) {
    api.dot({ path: ["you", SLOTS[k].node], cls: cls, r: 5, speed: DOT_SPEED });
  }

  /* ---------- what processes do ---------- */

  // The process has ended. Its memory is freed and its threads are gone, but its entry stays
  // until the parent calls wait: it is a zombie. With the fix on, the parent collects it at once.
  // An orphan's parent is init, which always collects at once. Returns true if it was collected.
  function endProc(api, p, status) {
    var S = api.state;
    p.state = "zombie";
    p.threads = 0;
    p.status = status;
    if (orphan(p)) {
      collect(api, p);
      api.log(p.pid + " ended. Its parent is init (PID 1) now, and init collects it at once with wait(), so it never lingers as a zombie.", "ok");
      return true;
    }
    if (S.autowait) {
      collect(api, p);
      api.log("chartfeed got SIGCHLD and collects " + p.pid + " at once with wait(). Its entry is gone, and so is the zombie.", "ok");
      return true;
    }
    return false;
  }

  function collect(api, p) {
    var S = api.state;
    var i = S.procs.indexOf(p);
    if (i >= 0) S.procs.splice(i, 1);
  }

  function finishNaturally(api, p) {
    var slot = SLOTS[p.slot];
    p.done = p.pages;
    var was = p.state;
    if (!endProc(api, p, "exit 0")) {
      api.log(p.pid + " uploaded all " + p.pages + " pages of " + slot.bed + "'s chart" + (was === "stopping" ? ", as SIGTERM asked," : "") +
        " and exited normally. chartfeed doesn't call wait, so " + p.pid + " stays in the list as a zombie.", "warn");
    }
  }

  function step(api, dt) {
    var S = api.state;
    if (!S.procs) return;
    var simDt = dt * api.speed;
    var list = runnable(S);
    if (list.length) {
      var share = Math.min(1, CORES / list.length);
      var ended = [];
      S.procs.forEach(function (p) {
        if (!alive(p)) return;
        p.done = Math.min(p.pages, p.done + p.threads * share * PAGE_RATE * simDt);
        if (p.done >= p.pages) ended.push(p);
      });
      ended.forEach(function (p) { finishNaturally(api, p); });
    }
    if (!S.midnight && api.clock >= MIDNIGHT) {
      S.midnight = true;
      var c = counts(S);
      if (c.running) {
        api.log("Midnight. The nightly backup starts, and " + c.running + (c.running === 1 ? " worker is" : " workers are") + " still mid-upload.", "bad");
      } else {
        api.log("Midnight. The nightly backup starts, and nothing is mid-upload.", "ok");
      }
    }
    draw(api);
  }

  /* ---------- controls ---------- */

  function selected(api) {
    var S = api.state;
    return slotIndex(String(S.ctl.slot.value || "a"));
  }

  function startWorker(api) {
    var S = api.state;
    var k = selected(api);
    var slot = SLOTS[k];
    var p = current(S, k);
    if (alive(p)) {
      api.log(slot.name + " already has a worker, " + p.pid + ". One chart at a time.", "");
      return;
    }
    var pid = S.nextPid;
    S.nextPid += 1;
    S.procs.push({ pid: pid, ppid: S.parentPid, slot: k, state: "run", threads: 1, done: 0, pages: slot.pages, status: "" });
    S.slotPid[k] = pid;
    api.log("chartfeed (PID " + S.parentPid + ") starts a child process for " + slot.name + ": PID " + pid + ", with its own memory (" + BASE_MB + " MB) and one thread. It begins uploading " + slot.bed + "'s chart, " + slot.pages + " pages." +
      (p && p.state === "zombie" ? " The old zombie, " + p.pid + ", is still in the list." : ""), "");
    afterChange(api);
  }

  function addThread(api) {
    var S = api.state;
    var k = selected(api);
    var p = current(S, k);
    if (!p) { api.log(SLOTS[k].name + " has no worker. Start one first.", ""); return; }
    if (p.state === "zombie") { api.log(p.pid + " has already exited. A zombie has no threads to add to.", "warn"); return; }
    if (p.threads >= MAX_THREADS) { api.log(p.pid + " already runs " + MAX_THREADS + " threads, the most this sim allows.", ""); return; }
    p.threads += 1;
    var total = runnable(S).length;
    api.log(p.pid + " now runs " + p.threads + " threads. They share its memory (now " + memory(p) + " MB), and each one can take a core." +
      (total > CORES ? " " + total + " runnable threads, " + CORES + " cores: the scheduler gives them turns, a time slice each." : ""), total > CORES ? "warn" : "");
    afterChange(api);
  }

  function sendTerm(api) {
    var S = api.state;
    var k = selected(api);
    var p = current(S, k);
    if (!p) { api.log("kill (SIGTERM): " + SLOTS[k].name + " has no worker to signal.", ""); return; }
    if (p.state === "zombie") {
      api.log("kill " + p.pid + ": nothing happens. " + p.pid + " has already exited, and a zombie can't receive signals.", "warn");
      return;
    }
    signalDot(api, k, "dot-req");
    if (p.state === "stopping") { api.log(p.pid + " already got SIGTERM. It's still finishing its chart.", ""); return; }
    p.state = "stopping";
    api.log("kill " + p.pid + " sends SIGTERM. Its handler catches it: it will finish " + SLOTS[k].bed + "'s chart (" +
      Math.ceil(p.pages - p.done) + " pages left), save, and then exit. Until then it keeps running.", "");
    afterChange(api);
  }

  function sendKill(api) {
    var S = api.state;
    var k = selected(api);
    var p = current(S, k);
    if (!p) { api.log("kill -9: " + SLOTS[k].name + " has no worker to signal.", ""); return; }
    if (p.state === "zombie") {
      api.log("kill -9 " + p.pid + ": nothing happens. " + p.pid + " has already exited. There's nothing left to kill, only its entry, waiting for wait.", "warn");
      return;
    }
    signalDot(api, k, "dot-bad");
    var at = Math.floor(p.done);
    var left = p.pages - at;
    S.lost += left;
    p.done = at;
    api.log("kill -9 " + p.pid + " sends SIGKILL. It can't be caught: " + p.pid + " ends at once, mid-page. " + SLOTS[k].bed + "'s chart stops at page " + at + " of " + p.pages +
      ": " + left + " pages never uploaded, and whatever it held in memory is gone.", "bad");
    if (!endProc(api, p, "killed by signal 9")) api.log(p.pid + " is now a zombie: dead, but still in the list until chartfeed calls wait.", "warn");
    afterChange(api);
  }

  function exitNow(api) {
    var S = api.state;
    var k = selected(api);
    var p = current(S, k);
    if (!p) { api.log(SLOTS[k].name + " has no worker. Start one first.", ""); return; }
    if (p.state === "zombie") { api.log(p.pid + " has already exited.", ""); return; }
    finishNaturally(api, p);
    afterChange(api);
  }

  function callWait(api) {
    var S = api.state;
    var zombies = S.procs.filter(function (p) { return p.state === "zombie" && p.ppid === S.parentPid; });
    if (!zombies.length) {
      api.log("chartfeed calls wait(), but no child of its own has ended. Nothing to collect.", "");
      return;
    }
    zombies.forEach(function (p) {
      collect(api, p);
      api.dot({ path: [SLOTS[p.slot].node, "parent"], cls: "dot-ok", r: 5, speed: DOT_SPEED });
      api.log("wait() returns " + p.pid + ": " + (p.status === "exit 0" ? "exited normally, status 0" : "killed by signal 9 (SIGKILL)") + ". chartfeed collects it, and its entry leaves the process table.", "ok");
    });
    afterChange(api);
  }

  function setAutowait(api, on) {
    var S = api.state;
    S.autowait = !!on;
    var waiting = counts(S).zombies;
    if (S.autowait) {
      api.log("The fix: chartfeed now calls wait() whenever SIGCHLD says a child has ended, so each one is collected the moment it exits." +
        (waiting ? " The " + waiting + " already waiting stay until you press wait." : ""), "ok");
    } else {
      api.log("The bug is back: chartfeed never calls wait on its own, like after the contractor's update.", "warn");
    }
    afterChange(api);
  }

  // chartfeed itself ends and starts again as a new process. Its children are orphans now:
  // init (PID 1) adopts them. init collects the zombies at once, and the running workers keep
  // going with PPID 1 until they end, when init collects them too. The new chartfeed has no children.
  function restartParent(api) {
    var S = api.state;
    var old = S.parentPid;
    var zombies = S.procs.filter(function (p) { return p.ppid === old && p.state === "zombie"; });
    var running = S.procs.filter(function (p) { return p.ppid === old && alive(p); });
    zombies.forEach(function (p) { collect(api, p); });
    running.forEach(function (p) { p.ppid = INIT_PID; });
    S.parentPid = S.nextPid;
    S.nextPid += 1;
    var parts = [];
    if (zombies.length) {
      parts.push("init collects " + (zombies.length === 1 ? "the zombie, " + zombies[0].pid + "," : "all " + zombies.length + " zombies") + " at once with wait(), so " +
        (zombies.length === 1 ? "it leaves" : "they leave") + " the list");
    }
    if (running.length) {
      parts.push(running.length + (running.length === 1 ? " running worker now shows PPID 1 and keeps" : " running workers now show PPID 1 and keep") +
        " uploading; init will collect " + (running.length === 1 ? "it" : "each one") + " the moment it ends");
    }
    api.log("chartfeed (PID " + old + ") ends and starts again as a new process, PID " + S.parentPid + ". " +
      (parts.length
        ? "Its children become orphans, and init, the first process (PID 1), adopts them: " + parts.join(". And ") + "."
        : "It had no children, so there was nothing for init, the first process (PID 1), to adopt.") +
      " The new chartfeed has no children yet.", "ok");
    afterChange(api);
  }

  function rotate(api) {
    var S = api.state;
    var n = runnable(S).length;
    if (n > CORES) S.offset = (S.offset + CORES) % n;
    else S.offset = 0;
  }

  function afterChange(api) {
    var S = api.state;
    var n = runnable(S).length;
    if (n <= CORES) S.offset = 0;
    else S.offset = S.offset % n;
    draw(api);
  }

  /* ---------- the process table (plain DOM inside api.root) ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    var wrap = doc.createElement("div");
    wrap.setAttribute("style", "margin-top:12px;min-width:0;");
    var label = doc.createElement("p");
    label.setAttribute("style", "margin:0 0 4px;color:var(--muted);font-family:var(--f-ui);font-size:12px;");
    label.textContent = "Process list (like ps): STAT R is running, S is sleeping, Z is zombie. THR is threads.";
    var pre = doc.createElement("pre");
    pre.className = "logline";
    pre.setAttribute("style", "margin:0;max-height:220px;overflow:auto;white-space:pre;font-size:12px;");
    pre.setAttribute("tabindex", "0");
    pre.setAttribute("aria-live", "polite");
    pre.setAttribute("aria-label", "Process list");
    wrap.appendChild(label);
    wrap.appendChild(pre);
    api.root.appendChild(wrap);
    return { table: pre };
  }

  /* ---------- "what is this box" ---------- */

  function coreInfo(i) {
    return function () {
      return "<strong>Core " + i + ".</strong> One of the CPU's four cores. A core runs one thread at a time. When more threads are ready than there are cores, the scheduler gives each a short turn, a time slice, and switches many times a second. Here the switching is slowed to every half second so you can watch it.";
    };
  }

  var INFO = {
    core0: coreInfo(0), core1: coreInfo(1), core2: coreInfo(2), core3: coreInfo(3),
    you: function () {
      return "<strong>You.</strong> You pick a scanner and send its worker a signal with the kill command. Plain <em>kill</em> sends SIGTERM, a polite request the program can catch. <em>kill -9</em> sends SIGKILL, which the operating system carries out at once.";
    },
    parent: function (S) {
      return "<strong>chartfeed, PID " + S.parentPid + ".</strong> The parent. It starts one child process, a worker, per chart. When a child ends, the parent should call <em>wait</em> to collect it, and only then does the child's entry leave the process table. Right now it " +
        (S.autowait ? "collects each child as soon as it ends (the fix)." : "never calls wait on its own (the contractor's update). Press <em>wait</em> to make it collect.") +
        " If you restart it, this process ends: its children become orphans, init (PID 1) adopts them and collects every zombie at once, and the new chartfeed gets a new PID.";
    },
    sched: function (S) {
      var n = runnable(S).length;
      return "<strong>Scheduler.</strong> Part of the operating system. It decides which runnable thread gets a core next. Right now " + n + " runnable " + (n === 1 ? "thread shares" : "threads share") + " " + CORES + " cores. A zombie has no threads, so it never gets a turn.";
    },
    slotA: slotInfo(0), slotB: slotInfo(1), slotC: slotInfo(2), slotD: slotInfo(3)
  };

  function slotInfo(k) {
    return function (S) {
      var slot = SLOTS[k];
      var p = current(S, k);
      var head = "<strong>" + slot.name + ", " + slot.bed + "'s chart, " + slot.pages + " pages.</strong> ";
      if (!p) return head + "No worker right now. Pick this scanner and press <em>Start a worker</em>.";
      if (p.state === "zombie") return head + "Worker " + p.pid + " has ended (" + p.status + ") at page " + Math.floor(p.done) + ". It is a zombie: no threads, no memory, only its entry with its PID and exit status. Signals do nothing to it. Only chartfeed calling wait removes it.";
      return head + "Worker " + p.pid + " is " + (p.state === "stopping" ? "finishing its chart after SIGTERM" : "uploading") + ": page " + Math.floor(p.done) + " of " + p.pages + ", " + p.threads + " thread" + (p.threads === 1 ? "" : "s") + ", " + memory(p) + " MB of its own memory.";
    };
  }

  /* ---------- the module ---------- */

  DL.sims.define("s1e08", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.procs = [];
      S.slotPid = [null, null, null, null];
      S.nextPid = FIRST_PID;
      S.parentPid = PARENT_PID;
      S.lost = 0;
      S.offset = 0;
      S.autowait = false;
      S.midnight = false;
      api.speed = SPEED;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.slot = api.control.select("slot", "Scanner", SLOT_OPTIONS, "a", function () {});
      S.ctl.start = api.control.button("start", "Start a worker (new process)", function () { startWorker(api); });
      S.ctl.thread = api.control.button("thread", "Give it another thread", function () { addThread(api); });
      S.ctl.term = api.control.button("term", "Send SIGTERM (kill, please stop)", function () { sendTerm(api); });
      S.ctl.kill = api.control.button("kill", "Send SIGKILL (kill -9)", function () { sendKill(api); }, { tone: "danger" });
      S.ctl.exit = api.control.button("exit", "Let it finish and exit now", function () { exitNow(api); });
      S.ctl.wait = api.control.button("wait", "chartfeed calls wait()", function () { callWait(api); }, { tone: "primary" });
      S.ctl.autowait = api.control.toggle("autowait", "The fix: collect each child as it ends", false, function (on) { setAutowait(api, on); });
      S.ctl.restart = api.control.button("restart", "Restart chartfeed (end the parent)", function () { restartParent(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        running: api.stat("running", "running processes", "ok"),
        zombies: api.stat("zombies", "zombies", "warn"),
        cores: api.stat("cores", "cores busy (of 4)", ""),
        lost: api.stat("lost", "pages lost to SIGKILL", "bad")
      };

      api.every(SLICE, function () { rotate(api); draw(api); });
      draw(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("11:50 PM in the records room. chartfeed (PID 2210) is running, with no workers yet. The backup starts at midnight.", "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function table() { var S = t.api.state; return S.ui ? S.ui.table.textContent : ""; }

      // 1. A worker is a new process with its own PID, and one thread keeps one core busy.
      t.set("slot", "a");
      t.click("start");
      await t.run(0.1);
      t.expect(n("running") === 1 && table().indexOf(String(FIRST_PID)) >= 0, "starting a worker adds a process with its own PID to the list");
      t.expect(n("cores") === 1, "one thread keeps one core busy");

      // 2. More threads in the same process take more cores.
      t.click("thread");
      t.click("thread");
      await t.run(0.1);
      t.expect(n("cores") === 3 && n("running") === 1, "three threads in one process keep three cores busy");

      // 3. More runnable threads than cores: all four cores are busy, and they take turns.
      t.set("slot", "b");
      t.click("start");
      t.set("slot", "c");
      t.click("start");
      await t.run(0.1);
      t.expect(n("running") === 3 && n("cores") === 4, "five threads on four cores keep every core busy");

      // 4. SIGKILL in the middle of a chart.
      await t.run(2);
      t.set("slot", "a");
      t.click("kill");
      var lost = n("lost");
      t.expect(n("running") === 2 && n("zombies") === 1 && lost > 0 && lost < 600, "SIGKILL ends the worker at once, its unfinished pages are lost, and it becomes a zombie");

      // 5. kill -9 on a zombie does nothing, and a zombie uses no core.
      t.click("kill");
      t.expect(n("zombies") === 1 && n("lost") === lost && t.logText().indexOf("already exited") >= 0, "kill -9 on a zombie changes nothing");
      t.expect(n("cores") === 2, "the zombie uses no core: only the two remaining threads are running");

      // 6. The parent calls wait.
      t.click("wait");
      t.expect(n("zombies") === 0 && table().indexOf(" Z ") < 0, "wait collects the zombie and its entry leaves the process table");

      // 7. SIGTERM: the worker finishes its chart first, and nothing is lost.
      t.set("slot", "b");
      t.click("term");
      t.expect(n("running") === 2, "right after SIGTERM the worker is still running, finishing its chart");
      await t.run(15);
      t.expect(n("running") === 1 && n("zombies") === 1 && n("lost") === lost, "after SIGTERM the worker finishes, exits with nothing lost, and waits as a zombie");

      // 8. The fix: the parent collects each child as it ends.
      t.click("autowait");
      t.set("slot", "c");
      t.click("exit");
      t.expect(n("running") === 0 && n("cores") === 0, "with no workers running, every core is idle");
      t.expect(n("zombies") === 1 && t.logText().indexOf("collects " + (FIRST_PID + 2)) >= 0, "with the fix on, a worker that exits is collected at once, while the older zombie still waits");

      // 9. Restart chartfeed: init (PID 1) adopts its children, collects the zombie at once, and the
      //    running worker carries on with PPID 1 under a chartfeed that has a new PID.
      t.set("slot", "d");
      t.click("start");
      await t.run(0.1);
      var orphanPid = FIRST_PID + 3;
      var zombiesBefore = n("zombies");
      t.click("restart");
      t.expect(zombiesBefore === 1 && n("zombies") === 0 && table().indexOf(" Z ") < 0 && t.logText().indexOf("init") >= 0,
        "restarting chartfeed ends the parent: init adopts the old zombie and collects it, so it leaves the list");
      t.expect(n("running") === 1 && table().indexOf(padL(orphanPid, 5) + padL(INIT_PID, 6) + " R") >= 0 &&
        t.node("parent").text.sub === "PID " + (FIRST_PID + 4) + ", parent",
        "the worker still running after the restart shows PPID 1, and chartfeed comes back with a new PID");

      // 10. An orphan that ends is collected by init at once, so it never becomes a zombie.
      t.click("exit");
      t.expect(n("running") === 0 && n("zombies") === 0 && t.logText().indexOf(orphanPid + " ended. Its parent is init") >= 0,
        "when the orphan ends, init collects it at once and no zombie is left");
    }
  });
})();
