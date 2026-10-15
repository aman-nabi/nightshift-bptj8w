/* sims/s7e09-v1.0.0.js  (published as sims/s7e09.js)
   Case s7e09 "The Watchman's Book": a ledger lab for Crowhurst Lock on the Ottoway Canal. The canal
   trust's boat-passage system logs every boat through the lock and charges its fee. As found, its
   audit log is a table in the same database that the office's shared admin login can change.
   Ismene, the night lock-keeper, worked Whinchat up through the lock at 01:20 on Sun 11 Oct 2026
   (entry 15 of the night's 23). Mr Wrayburn disputed the fee at 09:30; at 16:12 entry 15 was
   changed to the trust's work boat, Dabchick, fee 0.00. The 06:00 printout still shows Whinchat.
   The learner replays eight moments and chooses where the log lives, the hash chain, the printed
   copy, who may edit, a nightly backup and the clock source, and can check the chain at any moment.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only. The change at 16:12 is an event in the record,
   never a method; the hashes are short labels from a toy function stated below, shown only so the
   reader sees links break. No attack, no tooling, no payloads.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: where the log lives (same database, as found; separate
     append-only store), hash chain (off, as found; on), printed copy (off; nightly at 06:00, as
     found; every entry as it happens), who may edit (one shared admin login, as found; two named
     admins with a login record), nightly backup at 01:00 (off, as found; on), clock source (network
     time, as found; the server's own clock). Buttons: next moment, run to the end, check the chain,
     start again, reset. selfTest: 11 assertions.

   The toy hash (stated in sim.lede and the info box; not a real hash, never secure):
     start at 7; for each character of (previous hash + "|" + entry text): value = (value x 31 +
     the character's code) mod 65536; write the result as "#" and four hex digits. The first entry's
     previous hash is "#0000". Each entry stores the hash worked out from the hash before it.
   The chain check: start from "#0000", rework every entry's hash from the reworked hash before it,
     and compare with the stored one. Once one entry differs, every later reworked hash differs too.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e09-v1.0.0.json):
   - 23 passages between Sat 10 Oct 2026 18:00 and Sun 11 Oct 06:00: the PASSES list below (given
     data). 14 come before 01:00, so the 01:20 passage is entry 15, and 23 - 15 = 8 entries follow.
   - Entry 15: Sun 11 Oct 01:20, Whinchat, up, 42.00 (given). Changed at Sun 11 Oct 16:12 to Dabchick,
     the trust's work boat, 0.00 (given; the "last changed" stamp).
   - Printout: nightly at 06:00, 23 entries (as found); every entry as it happens: 23 sheets.
   - Dispute email: Sun 11 Oct 09:30. Office email to Ismene: Wed 14 Oct 22:10 (given).
   - Backup (only if on): 01:00 nightly. Sun 11 Oct 01:00 copy holds 14 entries (no 01:20 line);
     Mon 12 Oct 01:00 copy holds the 01:20 line as it reads after 16:12.
   - Admin login shared by 4 office staff (as found); the named option is 2 admins (given).
   - Chain on, same database: the check reports first broken link at entry 15 and 8 links after it.
     Chain on, separate store: all 23 links good, and store and database differ at 01:20.
   - Options: 0 (ok) store + chain: entry 15 still Whinchat, all 23 links good, the difference shows;
     1 printed every entry: 23 sheets, the paper differs from the screen, found by hand;
     2 two named admins, printout off: nothing shows, login record in the same database;
     3 backup on, printout off: nothing shows, Mon 12 Oct copy reads Dabchick, no copy holds Whinchat.
*/
(function () {
  "use strict";

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // The night's 23 passages: [day (0 Sat 10 Oct, 1 Sun 11 Oct), "hh:mm", boat, direction, fee in pence]
  var PASSES = [
    [0, "18:04", "licence 40117", "down", 1800], [0, "18:31", "licence 31402", "up", 2400],
    [0, "18:52", "licence 27735", "down", 1800], [0, "19:15", "licence 46021", "up", 4200],
    [0, "19:40", "licence 30988", "up", 2400], [0, "20:02", "licence 51264", "down", 1800],
    [0, "20:26", "licence 22879", "down", 2400], [0, "20:55", "licence 43350", "up", 1800],
    [0, "21:30", "licence 38106", "down", 4200], [0, "22:08", "licence 29473", "up", 1800],
    [0, "22:47", "licence 45812", "down", 2400], [0, "23:25", "licence 36690", "up", 1800],
    [1, "00:05", "licence 41537", "down", 2400], [1, "00:41", "licence 33208", "up", 1800],
    [1, "01:20", "Whinchat", "up", 4200], [1, "02:12", "licence 28844", "down", 1800],
    [1, "03:05", "licence 47719", "up", 2400], [1, "03:48", "licence 35061", "down", 1800],
    [1, "04:22", "licence 42290", "up", 4200], [1, "04:51", "licence 26357", "down", 1800],
    [1, "05:13", "licence 39924", "up", 2400], [1, "05:34", "licence 44685", "down", 1800],
    [1, "05:52", "licence 32176", "up", 2400]
  ];
  var N = PASSES.length;            // 23
  var E15 = 14;                     // index of the 01:20 entry (entry 15)
  var EDITED = [1, "01:20", "Dabchick", "up", 0];

  var T_OPEN = Date.UTC(2026, 9, 10, 17, 55);
  var T_BK1 = Date.UTC(2026, 9, 11, 1, 0);
  var T_E15 = Date.UTC(2026, 9, 11, 1, 20);
  var T_END = Date.UTC(2026, 9, 11, 6, 0);
  var T_DISPUTE = Date.UTC(2026, 9, 11, 9, 30);
  var T_EDIT = Date.UTC(2026, 9, 11, 16, 12);
  var T_BK2 = Date.UTC(2026, 9, 12, 1, 0);
  var T_EMAIL = Date.UTC(2026, 9, 14, 22, 10);
  var MOMENTS = [T_OPEN, T_BK1, T_E15, T_END, T_DISPUTE, T_EDIT, T_BK2, T_EMAIL];
  var LAST = MOMENTS.length - 1;
  var NAMES = ["before the night", "01:00", "01:20 passage", "night ends", "dispute email", "16:12 change", "next 01:00", "office email"];

  var WHERE = [
    { value: "same", label: "a table in the same database (as found)" },
    { value: "store", label: "a separate append-only store" }
  ];
  var PRINT = [
    { value: "off", label: "off" },
    { value: "nightly", label: "nightly at 06:00 (as found)" },
    { value: "each", label: "every entry as it happens" }
  ];
  var EDITORS = [
    { value: "shared", label: "one admin login shared by 4 staff (as found)" },
    { value: "named", label: "two named admins, logins recorded" }
  ];
  var CLOCK = [
    { value: "network", label: "network time (as found)" },
    { value: "local", label: "the server's own clock" }
  ];

  /* ---------- small helpers ---------- */

  function when(t) {
    var x = new Date(t);
    return WEEKDAYS[x.getUTCDay()] + " " + x.getUTCDate() + " " + MONTHS[x.getUTCMonth()] + " " + x.getUTCFullYear() + ", " +
      ("0" + x.getUTCHours()).slice(-2) + ":" + ("0" + x.getUTCMinutes()).slice(-2);
  }
  function pounds(p) { return "£" + Math.floor(p / 100) + "." + ("0" + (p % 100)).slice(-2); }
  function passTime(p) {
    var hm = p[1].split(":");
    return Date.UTC(2026, 9, 10 + p[0], +hm[0], +hm[1]);
  }
  function text(i, p) {
    return (i + 1) + " | " + (p[0] ? "Sun 11 Oct" : "Sat 10 Oct") + " " + p[1] + " | " + p[2] + " | " + p[3] + " | " + pounds(p[4]);
  }
  function short(p) { return p[1] + " " + p[2] + ", " + p[3] + ", " + pounds(p[4]); }
  // The toy hash, as stated above.
  function toyHash(prev, s) {
    var v = 7, all = prev + "|" + s;
    for (var i = 0; i < all.length; i++) v = (v * 31 + all.charCodeAt(i)) % 65536;
    return "#" + ("000" + v.toString(16)).slice(-4);
  }
  // Stored hashes, worked out as each entry was written (before any change).
  var STORED = (function () {
    var out = [], prev = "#0000";
    for (var i = 0; i < N; i++) { prev = toyHash(prev, text(i, PASSES[i])); out.push(prev); }
    return out;
  })();

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function count(k) {
    var t = MOMENTS[k], n = 0;
    for (var i = 0; i < N; i++) if (passTime(PASSES[i]) <= t) n += 1;
    return n;
  }
  // The log as it reads at moment k: an array of passes.
  function logAt(C, k) {
    var n = count(k), out = [];
    for (var i = 0; i < n; i++) out.push(i === E15 && C.where === "same" && MOMENTS[k] >= T_EDIT ? EDITED : PASSES[i]);
    return out;
  }
  function paperHas(C, k, i) {
    if (C.print === "off") return false;
    if (C.print === "nightly") return MOMENTS[k] >= T_END;
    return passTime(PASSES[i]) <= MOMENTS[k];
  }
  function chainCheck(C, k) {
    var log = logAt(C, k);
    if (!C.chain) return { text: "no chain to check", first: "none", after: 0 };
    if (!log.length) return { text: "nothing to check yet", first: "none", after: 0 };
    var prev = "#0000", first = -1, broken = 0;
    for (var i = 0; i < log.length; i++) {
      prev = toyHash(prev, text(i, log[i]));
      if (prev !== STORED[i]) { if (first < 0) first = i; broken += 1; }
    }
    if (first < 0) return { text: "all " + log.length + " links good", first: "none", after: 0 };
    return { text: "broken at entry " + (first + 1) + ", and the " + (broken - 1) + " links after it", first: first + 1, after: broken - 1 };
  }
  function results(C, k) {
    var t = MOMENTS[k];
    var log = logAt(C, k);
    var n = log.length;
    var changed = t >= T_EDIT;
    var editedLog = changed && C.where === "same";
    var paper;
    if (C.print === "off") paper = "no printout";
    else if (C.print === "nightly") paper = t >= T_END ? "23 entries printed at 06:00" : "not printed yet";
    else paper = n + " sheets, one per entry";
    var paperE15 = n > E15 && paperHas(C, k, E15);
    var vs = !paperE15 ? "nothing to compare" : (editedLog ? "1 difference, entry 15 at 01:20" : "agree");
    var store = C.where !== "store" ? "no separate store" :
      (changed ? "1 difference at 01:20: store Whinchat, database Dabchick" : "agree");
    var ways = [];
    if (changed) {
      if (editedLog && paperE15) ways.push("the printout differs, found by hand");
      if (C.where === "store") ways.push("the store and the database differ at 01:20");
      if (editedLog && C.chain) ways.push("the chain check, when run");
    }
    var bk = "off";
    if (C.backup) {
      if (t < T_BK1) bk = "none yet";
      else if (t < T_BK2) bk = "Sun 11 Oct 01:00 copy: 14 entries, no 01:20 line";
      else bk = "Mon 12 Oct 01:00 copy: 01:20 reads " + (C.where === "same" ? "Dabchick" : "Whinchat");
    }
    var who;
    if (C.where === "store") who = "nobody: the store only adds lines (admins still change the passage table)";
    else who = (C.editors === "shared" ? "4 staff on one shared admin login" : "2 named admins") + ": every log entry" + (C.chain ? " and its hash" : "");
    return {
      now: when(t),
      entries: n,
      e15: n > E15 ? short(log[E15]) : "not yet",
      paper: paper,
      vs: vs,
      store: store,
      last: editedLog ? "Sun 11 Oct 2026, 16:12, by admin" : "never",
      shows: !changed ? "no change yet" : (ways.length ? ways.join("; ") : "nothing shows"),
      who: who,
      read: C.where === "store" ? "the lock screen and the auditor, read only" : "the admin login, and the lock screen (read only)",
      login: C.editors === "shared" ? "none" : "in the same database, which admins can change",
      clock: C.clock === "network" ? "network time: lines up with other records" : "server's own clock: unchecked",
      backup: bk
    };
  }

  /* ---------- log lines (the self-test reads these exact strings) ---------- */

  function line(C, k) {
    var t = MOMENTS[k];
    var R = results(C, k);
    var out = [];
    if (k === 1) {
      if (C.backup) out.push([when(t) + ". Nightly backup: a copy of the log's 14 entries. The 01:20 passage has not happened yet.", "warn"]);
      else out.push([when(t) + ". 14 passages logged so far.", ""]);
    } else if (k === 2) {
      out.push([when(t) + ". Entry 15: Whinchat, up, " + pounds(4200) + (C.where === "store" ? ", added to the separate append-only store." : ", written to the log table in the same database.") +
        (C.chain ? " Stored hash " + STORED[E15] + "." : ""), ""]);
      if (C.print === "each") out.push([when(t) + ". Printed as it happens: sheet 15.", ""]);
    } else if (k === 3) {
      out.push([when(t) + ". Night ends: 23 passages between 18:00 and 06:00.", ""]);
      if (C.print === "nightly") out.push([when(t) + ". The server prints all 23 entries on the lock-office printer.", "ok"]);
      if (C.print === "each") out.push([when(t) + ". 23 sheets printed, one per entry.", "ok"]);
    } else if (k === 4) {
      out.push([when(t) + ". Mr Wrayburn emails the office to dispute the " + pounds(4200) + " fee for 01:20.", ""]);
    } else if (k === 5) {
      if (C.where === "same") {
        out.push([when(t) + ". Entry 15 is changed under the admin login: Whinchat, " + pounds(4200) + " becomes Dabchick, " + pounds(0) + ". Nothing else records the change.", "bad"]);
        if (C.editors === "named") out.push([when(t) + ". The login record, in the same database, lists which named admin signed in.", "warn"]);
      } else {
        out.push([when(t) + ". The passage table is changed under the admin login: Whinchat, " + pounds(4200) + " becomes Dabchick, " + pounds(0) + ". The append-only store cannot be changed, so its entry 15 still reads Whinchat, " + pounds(4200) + ".", "warn"]);
      }
    } else if (k === 6) {
      if (C.backup) out.push([when(t) + ". Nightly backup: the copy's 01:20 entry reads " + (C.where === "same" ? "Dabchick" : "Whinchat") + ". No earlier copy holds the 01:20 line.", "warn"]);
      else out.push([when(t) + ". No backup is taken.", ""]);
    } else if (k === 7) {
      if (C.where === "same") out.push([when(t) + ". Kilcoyne's email: dispute upheld, fee refunded, because the log shows Dabchick at 01:20.", "bad"]);
      else out.push([when(t) + ". Kilcoyne's email: the store's entry 15 reads Whinchat, " + pounds(4200) + ", and the database differs. The dispute is held for review.", "ok"]);
      out.push([when(t) + ". How the change shows: " + R.shows + ".", R.shows === "nothing shows" ? "bad" : "ok"]);
    }
    return out;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, txt) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (txt) e.textContent = txt;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var foot = el("p", "margin:0;font-size:12px;");
    wrap.appendChild(table);
    [head, wrap, foot].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, table: table, foot: foot };
  }

  function row(ui, cells, bold) {
    var tr = ui.el("tr");
    cells.forEach(function (c) { tr.appendChild(ui.el(bold ? "th" : "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    ui.table.appendChild(tr);
  }

  function draw(api) {
    var S = api.state, C = S.C, R = results(C, S.pos), ui = S.ui;
    var log = logAt(C, S.pos);
    ui.head.textContent = "Log in " + (C.where === "same" ? "the same database" : "a separate append-only store") + ". Hash chain " + (C.chain ? "on" : "off") +
      ". Printed copy " + C.print + ". Editors: " + C.editors + ". Backup " + (C.backup ? "on" : "off") + ". Clock: " + C.clock + ". Replayed to " + R.now + " (" + NAMES[S.pos] + ").";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["no.", "on screen", "on paper", "stored hash"], true);
    for (var i = 0; i < log.length; i++) {
      row(ui, [i + 1, short(log[i]), paperHas(C, S.pos, i) ? short(PASSES[i]) : "-", C.chain ? STORED[i] : "-"]);
    }
    if (!log.length) row(ui, ["-", "no passages yet", "-", "-"]);
    ui.foot.textContent = "Who can change the log: " + R.who + ". Who can read it: " + R.read + ".";
    var K = S.check;
    S.stat.now(R.now);
    S.stat.entries(R.entries);
    S.stat.e15(R.e15);
    S.stat.paper(R.paper);
    S.stat.vs(R.vs);
    S.stat.store(R.store);
    S.stat.last(R.last);
    S.stat.shows(R.shows);
    S.stat.check(K ? K.text : "not run");
    S.stat.first(K ? K.first : "not run");
    S.stat.after(K ? K.after : "not run");
    S.stat.who(R.who);
    S.stat.read(R.read);
    S.stat.login(R.login);
    S.stat.clock(R.clock);
    S.stat.backup(R.backup);
    S.ctl.next.disable(S.pos >= LAST);
    S.ctl.all.disable(S.pos >= LAST);
  }

  function step(api) {
    var S = api.state;
    S.pos += 1;
    S.check = null;
    line(S.C, S.pos).forEach(function (x) { api.log(x[0], x[1]); });
  }

  function run(api, steps) {
    var S = api.state, n = 0;
    while (S.pos < LAST && n < steps) { step(api); n += 1; }
    draw(api);
  }

  function check(api) {
    var S = api.state;
    S.check = chainCheck(S.C, S.pos);
    api.log(when(MOMENTS[S.pos]) + ". Chain check: " + S.check.text + ".", S.check.first === "none" ? (S.C.chain ? "ok" : "") : "bad");
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.pos = 0;
    S.check = null;
    api.log((why ? why + " " : "") + when(T_OPEN) + ", before the night. 0 passages logged. The log lives in " +
      (S.C.where === "same" ? "a table in the same database." : "a separate append-only store."), "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { where: "same", chain: false, print: "nightly", editors: "shared", backup: false, clock: "network" };
      S.pos = 0;
      S.check = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function bool(v) { return !!v; }
      S.ctl.where = api.control.select("where", "Where the log lives", WHERE, "same", opt("where", String));
      S.ctl.chain = api.control.toggle("chain", "Hash chain", false, opt("chain", bool));
      S.ctl.print = api.control.select("print", "Printed copy", PRINT, "nightly", opt("print", String));
      S.ctl.editors = api.control.select("editors", "Who may edit", EDITORS, "shared", opt("editors", String));
      S.ctl.backup = api.control.toggle("backup", "Nightly backup at 01:00", false, opt("backup", bool));
      S.ctl.clock = api.control.select("clock", "Clock source", CLOCK, "network", opt("clock", String));
      S.ctl.next = api.control.button("next", "Next moment", function () { run(api, 1); });
      S.ctl.all = api.control.button("all", "Run to Wednesday, 22:10", function () { run(api, LAST); });
      S.ctl.check = api.control.button("check", "Check the chain", function () { check(api); });
      S.ctl.again = api.control.button("again", "Start again", function () { restart(api, "New run."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "replayed to", ""),
        entries: api.stat("entries", "entries in the log", ""),
        e15: api.stat("e15", "entry 15 on screen", "warn"),
        paper: api.stat("paper", "printed copy", ""),
        vs: api.stat("vs", "printed against on screen", "warn"),
        store: api.stat("store", "store against database", ""),
        last: api.stat("last", "entry 15 last changed", "warn"),
        shows: api.stat("shows", "how the change shows", "bad"),
        check: api.stat("check", "chain check", ""),
        first: api.stat("first", "first broken link", "bad"),
        after: api.stat("after", "broken links after it", "bad"),
        who: api.stat("who", "who can change the log", "warn"),
        read: api.stat("read", "who can read the log", ""),
        login: api.stat("login", "login record", ""),
        clock: api.stat("clock", "clock source", ""),
        backup: api.stat("backup", "nightly backup", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one moment, from just before the night of Saturday 10 October to the office's email on Wednesday 14 October at 22:10. The table lists the entries on screen, the same entries on paper if a printed copy exists, and each stored hash if the chain is on. The hash here is a toy, not a real one: start at 7, and for each letter of the previous hash, a bar and this entry, multiply by 31, add the letter's code, and keep the remainder after dividing by 65,536. Real systems use a strong hash such as SHA-256. Press <em>Check the chain</em> at any moment: it reworks every hash from the first entry on and reports the first link that no longer matches, and how many break after it.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the night, as found.
      t.expect(t.stat("now") === "Sat 10 Oct 2026, 17:55" && t.stat("entries") === 0 && t.stat("e15") === "not yet" &&
        t.stat("shows") === "no change yet" && t.stat("check") === "not run" && t.stat("clock") === "network time: lines up with other records",
        "Opens on Sat 10 Oct 2026, 17:55: no passages, nothing changed, chain not checked");

      // 2. To the 01:20 passage: entry 15.
      t.click("next");
      t.click("next");
      t.expect(t.stat("entries") === 15 && t.stat("e15") === "01:20 Whinchat, up, £42.00" &&
        has("Sun 11 Oct 2026, 01:20. Entry 15: Whinchat, up, £42.00, written to the log table in the same database."),
        "At 01:20 Whinchat is entry 15, written to the log table in the same database");

      // 3. As found, to Wednesday: the screen says Dabchick, the 06:00 printout says Whinchat.
      t.click("all");
      t.expect(t.stat("entries") === 23 && t.stat("e15") === "01:20 Dabchick, up, £0.00" &&
        t.stat("last") === "Sun 11 Oct 2026, 16:12, by admin" && t.stat("vs") === "1 difference, entry 15 at 01:20" &&
        t.stat("paper") === "23 entries printed at 06:00" && t.stat("shows") === "the printout differs, found by hand" &&
        has("Wed 14 Oct 2026, 22:10. Kilcoyne's email: dispute upheld, fee refunded, because the log shows Dabchick at 01:20."),
        "As found: 23 entries, entry 15 changed at 16:12, only the printout shows it");

      // 4. Without the printout, the change goes unnoticed.
      t.set("print", "off");
      t.click("all");
      t.expect(t.stat("shows") === "nothing shows" && t.stat("vs") === "nothing to compare" && t.stat("e15") === "01:20 Dabchick, up, £0.00",
        "Printout off: nothing shows the change");

      // 5. Chain on, same database: the check flags entry 15 and the 8 links after it.
      t.set("chain", true);
      t.click("all");
      t.click("check");
      t.expect(t.stat("first") === 15 && t.stat("after") === 8 && t.stat("check") === "broken at entry 15, and the 8 links after it" &&
        t.stat("who") === "4 staff on one shared admin login: every log entry and its hash" &&
        has("Wed 14 Oct 2026, 22:10. Chain check: broken at entry 15, and the 8 links after it."),
        "Chain on: the check breaks at entry 15 and the 8 links after it; the admin login can still reach the hashes");

      // 6. The same check before the change: every link good.
      t.click("again");
      t.click("next"); t.click("next"); t.click("next"); t.click("next");
      t.click("check");
      t.expect(t.stat("check") === "all 23 links good" && t.stat("first") === "none" && t.stat("after") === 0,
        "Checked on Sunday at 09:30, before the change: all 23 links good");

      // 7. Option 0 (ok): separate append-only store, chained.
      t.set("where", "store");
      t.click("all");
      t.click("check");
      t.expect(t.stat("e15") === "01:20 Whinchat, up, £42.00" && t.stat("check") === "all 23 links good" &&
        t.stat("store") === "1 difference at 01:20: store Whinchat, database Dabchick" &&
        t.stat("shows") === "the store and the database differ at 01:20" &&
        t.stat("who") === "nobody: the store only adds lines (admins still change the passage table)" &&
        t.stat("read") === "the lock screen and the auditor, read only",
        "Store and chain: entry 15 still Whinchat, all 23 links good, and the change shows against the database");

      // 8. Option 1: print every entry as it happens (log in the same database, no chain).
      t.set("where", "same");
      t.set("chain", false);
      t.set("print", "each");
      t.click("all");
      t.expect(t.stat("paper") === "23 sheets, one per entry" && t.stat("shows") === "the printout differs, found by hand" &&
        t.stat("e15") === "01:20 Dabchick, up, £0.00",
        "Paper for every entry: 23 sheets; the change shows only to someone comparing by hand");

      // 9. Option 2: two named admins with a login record (printout off).
      t.set("print", "off");
      t.set("editors", "named");
      t.click("all");
      t.expect(t.stat("shows") === "nothing shows" && t.stat("login") === "in the same database, which admins can change" &&
        t.stat("who") === "2 named admins: every log entry" &&
        has("Sun 11 Oct 2026, 16:12. The login record, in the same database, lists which named admin signed in."),
        "Two named admins: fewer hands, the entry still changed, nothing shows");

      // 10. Option 3: nightly backup at 01:00 (printout off).
      t.set("editors", "shared");
      t.set("backup", true);
      t.click("all");
      t.expect(t.stat("backup") === "Mon 12 Oct 01:00 copy: 01:20 reads Dabchick" && t.stat("shows") === "nothing shows" &&
        has("Sun 11 Oct 2026, 01:00. Nightly backup: a copy of the log's 14 entries. The 01:20 passage has not happened yet.") &&
        has("Mon 12 Oct 2026, 01:00. Nightly backup: the copy's 01:20 entry reads Dabchick. No earlier copy holds the 01:20 line."),
        "Backup: the first copy holding 01:20 was taken after the change, so it reads Dabchick");

      // 11. Clock source: the server's own clock.
      t.set("clock", "local");
      t.expect(t.stat("clock") === "server's own clock: unchecked",
        "Local clock: the times are the server's word only");
    }
  });
})();
