/* sims/s7e05-v1.0.0.js  (published as sims/s7e05.js)
   Case s7e05 "Locked Boxes": a key lab for the Wendmoor lost-property office, whose nightly
   backups are encrypted with a key kept in the same storage as the backups. A rotation script,
   first run at 00:30 on 1 November 2025, adds a new key version on the 1st of every month and
   deletes the one before. The learner replays the year of backups that the store holds on the
   night of 14 October 2026, month by month, and chooses where the key lives, how it is rotated,
   whether envelope encryption is on, and whether a weekly restore test runs.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only: keys are labels such as "v13", never key
   material; there are no attacks, no tools and no rates. Every count is worked out from the
   dates below, which are given data.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: where the key lives (beside the backups, as found; the
     office safe; a key service); rotation (none; monthly deleting old versions, as found; monthly
     keeping old versions); envelope encryption off (as found) or on; weekly restore tests off
     (as found) or on. Buttons: next month, run to tonight, start again, reset. selfTest: 10
     assertions.

   The model (stated in sim.lede, the post and the comments):
   - The store keeps the last 365 nightly backups. One backup is made at 01:00 every night. On
     14 October 2026 it holds the nights of 15 October 2025 to 14 October 2026: 365 backups.
   - Key v1 locked every backup before the rotation script's first run. With monthly rotation the
     script runs at 00:30 on the 1st, before that night's backup: v2 from 1 Nov 2025, v3 from
     1 Dec, and so on to v13 from 1 Oct 2026. A backup can be opened only if the version that
     locked it is still held.
   - Held versions: no rotation, v1 only; monthly deleting, only the current version; monthly
     keeping, v1 to the current one.
   - Where the key lives: beside the backups, so one stolen copy of the store holds the backups
     and every key that opens them; the office safe (the backup job holds only a public key, and
     the private key is on paper in the safe); a key service (the master key never leaves it,
     and it records each use). Only "beside" puts a key in the stolen copy.
   - Envelope encryption: each backup gets its own data key, locked by the key version and kept
     beside its backup. One leaked data key opens 1 backup. Without it, one leaked key opens every
     backup locked with that version.
   - Weekly restore test, every Sunday from 19 Oct 2025: restore the backup made 28 nights before
     (last month's backup). It fails if that backup's version is no longer held.
   - Ms Desrosiers's compass was handed in on 9 Nov 2025. Its record and photo left the live
     system after 180 days, on 8 May 2026. Backups of 10 Nov 2025 to 8 May 2026 hold it: 180.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e05-v1.0.0.json):
   - 365: 15 Oct 2025 to 14 Oct 2026. 17 under v1 (15 to 31 Oct 2025), 334 under v2 to v12
     (Nov 2025 to Sep 2026), 14 under v13 (1 to 14 Oct 2026).
   - As found, tonight: 14 open, 351 cannot, versions held v13, 12 deleted, one stolen copy of
     the store exposes 14 of 365, her photo 0 of 180.
   - First failing weekly test: Sunday 2 Nov 2025 (restores 5 Oct 2025, locked with v1, deleted
     the day before). 52 Sundays from 19 Oct 2025 to 11 Oct 2026; as found, 46 of the 52 tests
     would fail (a test passes only when the backup 28 nights back shares the current month's
     key version); keeping old versions, 0 fail.
   - Options: no rotation, 0 cannot open, stolen copy exposes 365; weekly tests, still 351, first
     fails 2 Nov 2025; office safe, no rotation, 0 cannot open, stolen copy exposes 0, one leaked
     key opens 365; key service keeping versions with envelope, 0 cannot open, 0 exposed, one
     leaked data key opens 1, every use recorded.
*/
(function () {
  "use strict";

  var DAY = 86400000;
  var START = Date.UTC(2025, 9, 15);      // 15 Oct 2025, the oldest backup the store holds tonight
  var NIGHTS = 365;                        // 15 Oct 2025 to 14 Oct 2026
  var PHOTO_FROM = 26;                     // 10 Nov 2025, the first backup holding her photo
  var PHOTO_TO = 205;                      // 8 May 2026, the last one (180 in all)
  var HANDED_IN = 25;                      // 9 Nov 2025
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var WHERE = [
    { value: "beside", label: "Beside the backups, in the same storage (as found)" },
    { value: "safe", label: "Office safe: private key on paper, the job holds the public key" },
    { value: "service", label: "A key service: the key never leaves it, each use recorded" }
  ];
  var ROT = [
    { value: "none", label: "No rotation: one key for good" },
    { value: "delete", label: "Monthly, deleting old versions (as found)" },
    { value: "keep", label: "Monthly, keeping old versions for opening" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dt(d) { return new Date(START + d * DAY); }
  function dateText(d) { var x = dt(d); return x.getUTCDate() + " " + MONTHS[x.getUTCMonth()] + " " + x.getUTCFullYear(); }
  function dayText(d) { return WEEKDAYS[dt(d).getUTCDay()] + " " + dateText(d); }
  // Month index from Oct 2025 (0) to Oct 2026 (12); nights before 15 Oct 2025 count as Oct 2025 or earlier.
  function monthIdx(d) { var x = dt(d); return Math.max(0, (x.getUTCFullYear() - 2025) * 12 + x.getUTCMonth() - 9); }
  function firstOf(k) { return Math.round((Date.UTC(2025, 9 + k, 1) - START) / DAY); }
  // Replay positions: 0 is 31 Oct 2025 (before the first rotation); 1 to 11 the last night of
  // Nov 2025 to Sep 2026; 12 is tonight, 14 Oct 2026.
  function posDay(k) { return k >= 12 ? NIGHTS - 1 : firstOf(k + 1) - 1; }
  var LAST = 12;

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function version(C, d) { return C.rot === "none" ? 1 : monthIdx(d) + 1; }
  function held(C, p, v) {
    var cur = version(C, p);
    if (C.rot === "none") return v === 1;
    if (C.rot === "delete") return v === cur;
    return v >= 1 && v <= cur;
  }
  function heldText(C, p) {
    var cur = version(C, p);
    if (C.rot === "keep" && cur > 1) return "v1 to v" + cur;
    return "v" + cur;
  }
  function deleted(C, p) { return C.rot === "delete" ? version(C, p) - 1 : 0; }

  function count(C, p) {
    var opens = 0;
    var photo = 0;
    var photoOpen = 0;
    var sameKey = 0;
    var cur = version(C, p);
    for (var d = 0; d <= p; d++) {
      var v = version(C, d);
      var ok = held(C, p, v);
      if (ok) opens += 1;
      if (v === cur) sameKey += 1;
      if (d >= PHOTO_FROM && d <= PHOTO_TO) { photo += 1; if (ok) photoOpen += 1; }
    }
    return { made: p + 1, opens: opens, lost: p + 1 - opens, photo: photo, photoOpen: photoOpen, sameKey: sameKey };
  }

  // Weekly restore tests, every Sunday from 19 Oct 2025 (day 4): restore the backup of 28 nights before.
  function tests(C, p) {
    var run = 0;
    var failed = 0;
    var first = -1;
    for (var t = 4; t <= p; t += 7) {
      run += 1;
      if (!held(C, t, version(C, t - 28))) {
        failed += 1;
        if (first < 0) first = t;
      }
    }
    return { run: run, failed: failed, first: first };
  }

  function results(C, p) {
    var n = count(C, p);
    var ts = tests(C, p);
    return {
      day: dateText(p),
      made: n.made,
      opens: n.opens,
      lost: n.lost,
      held: heldText(C, p),
      deleted: deleted(C, p),
      stolen: (C.where === "beside" ? fmt(n.opens) : "0") + " of " + fmt(n.made),
      leak: C.env ? 1 : n.sameKey,
      photo: p < HANDED_IN ? "not handed in yet" : fmt(n.photoOpen) + " of " + fmt(n.photo),
      record: C.where === "service" ? "every use recorded" : "none",
      tests: C.tests ? ts.run + " run, " + ts.failed + " failed" : "off",
      first: ts.first < 0 ? "none yet" : dayText(ts.first),
      firstDay: ts.first
    };
  }

  /* ---------- log lines (the self-test reads these exact strings) ---------- */

  function rotLine(C, k) {
    var d = firstOf(k);
    var v = k + 1;
    if (C.rot === "none") return dateText(d) + ", 00:30. No rotation: key v1 stays in use.";
    if (C.rot === "delete") return dateText(d) + ", 00:30. Key v" + (v - 1) + " is current. The script adds key v" + v + " and deletes v" + (v - 1) + ".";
    return dateText(d) + ", 00:30. Key v" + (v - 1) + " is current. The script adds key v" + v + " and keeps v1 to v" + (v - 1) + " for opening.";
  }
  function monthLine(R) {
    return "By " + R.day + ": " + fmt(R.made) + " backups made, " + fmt(R.opens) + " open, " + fmt(R.lost) + " cannot. Key versions held: " + R.held + ".";
  }
  function testLine(C, t) {
    return dayText(t) + ": the weekly test restores the backup of " + dateText(t - 28) + ", locked with v" + version(C, t - 28) + ". It cannot be opened.";
  }
  function nightLine(R) {
    return "14 Oct 2026, 22:40. Ms Desrosiers asks for the photo of her compass. Backups holding it that open: " + R.photo +
      ". One stolen copy of the backup store would expose " + R.stolen + " backups.";
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
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var foot = el("p", "margin:0;font-size:12px;");
    [head, table, foot].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, table: table, foot: foot };
  }

  function row(ui, cells, bold) {
    var tr = ui.el("tr");
    cells.forEach(function (c) { tr.appendChild(ui.el(bold ? "th" : "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    ui.table.appendChild(tr);
  }

  // One row per month of backups: which version locked them and whether they open on the replay date.
  function monthRows(C, p) {
    var rows = [];
    for (var k = 0; k <= LAST; k++) {
      var a = k === 0 ? 0 : firstOf(k);
      var b = k === LAST ? NIGHTS - 1 : firstOf(k + 1) - 1;
      var name = MONTHS[(9 + k) % 12] + " " + (k < 3 ? 2025 : 2026);
      if (a > p) { rows.push([name, "-", "not made yet", "-"]); continue; }
      var last = Math.min(b, p);
      var v = version(C, a);
      var n = last - a + 1;
      rows.push([name, "v" + v, n + (n === 1 ? " backup" : " backups"), held(C, p, v) ? "opens" : "cannot open"]);
    }
    return rows;
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var p = posDay(S.pos);
    var R = results(C, p);
    var ui = S.ui;
    ui.head.textContent = "Key: " + pick(WHERE, C.where).label.toLowerCase() + ". Rotation: " + pick(ROT, C.rot).label.toLowerCase() +
      ". Envelope encryption " + (C.env ? "on" : "off") + ". Weekly restore tests " + (C.tests ? "on" : "off") + ". Replayed to " + R.day + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["backups of", "locked with", "how many", "on " + R.day], true);
    monthRows(C, p).forEach(function (r) { row(ui, r); });
    ui.foot.textContent = "A stolen copy of the backup store exposes " + R.stolen + " backups. One leaked " +
      (C.env ? "data key opens 1 backup." : "key opens " + fmt(R.leak) + " backups.");
    S.stat.day(R.day);
    S.stat.made(R.made);
    S.stat.opens(R.opens);
    S.stat.lost(R.lost);
    S.stat.held(R.held);
    S.stat.deleted(R.deleted);
    S.stat.stolen(R.stolen);
    S.stat.leak(R.leak);
    S.stat.photo(R.photo);
    S.stat.record(R.record);
    S.stat.tests(R.tests);
    S.stat.first(R.first);
    S.ctl.next.disable(S.pos >= LAST);
    S.ctl.all.disable(S.pos >= LAST);
  }

  function step(api) {
    var S = api.state;
    var C = S.C;
    var before = posDay(S.pos);
    S.pos += 1;
    var p = posDay(S.pos);
    api.log(rotLine(C, S.pos), C.rot === "delete" ? "warn" : "");
    var ts = tests(C, p);
    if (C.tests && ts.first > before && ts.first <= p) api.log(testLine(C, ts.first), "bad");
    var R = results(C, p);
    api.log(monthLine(R), R.lost ? "bad" : "ok");
    if (S.pos === LAST) api.log(nightLine(R), R.lost ? "bad" : "ok");
  }

  function run(api, steps) {
    var S = api.state;
    var n = 0;
    while (S.pos < LAST && n < steps) { step(api); n += 1; }
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    var C = S.C;
    S.pos = 0;
    var R = results(C, posDay(0));
    api.log((why ? why + " " : "") + "31 Oct 2025, before the rotation script's first run. " + fmt(R.made) +
      " backups so far, all locked with key v1, kept " + (C.where === "beside" ? "in the same storage as the backups" : C.where === "safe" ? "as a private key on paper in the office safe" : "in a key service") + ".", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { where: "beside", rot: "delete", env: false, tests: false };
      S.pos = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function bool(v) { return !!v; }
      S.ctl.where = api.control.select("where", "Where the key lives", WHERE, "beside", opt("where", String));
      S.ctl.rot = api.control.select("rot", "Key rotation", ROT, "delete", opt("rot", String));
      S.ctl.env = api.control.toggle("env", "Envelope encryption: each backup its own data key", false, opt("env", bool));
      S.ctl.tests = api.control.toggle("tests", "Weekly restore test of last month's backup", false, opt("tests", bool));
      S.ctl.next = api.control.button("next", "Next month", function () { run(api, 1); });
      S.ctl.all = api.control.button("all", "Run to tonight, 14 Oct 2026", function () { run(api, LAST); });
      S.ctl.again = api.control.button("again", "Start again", function () { restart(api, "New run."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        day: api.stat("day", "replayed to", ""),
        made: api.stat("made", "of tonight's 365 backups, made so far", ""),
        opens: api.stat("opens", "backups that open", "ok"),
        lost: api.stat("lost", "backups that cannot open", "bad"),
        held: api.stat("held", "key versions held", ""),
        deleted: api.stat("deleted", "key versions deleted", "warn"),
        stolen: api.stat("stolen", "one stolen copy of the store exposes", "bad"),
        leak: api.stat("leak", "backups one leaked key opens", "warn"),
        photo: api.stat("photo", "backups with her photo that open", ""),
        record: api.stat("record", "record of each key use", ""),
        tests: api.stat("tests", "weekly restore tests", ""),
        first: api.stat("first", "first Sunday a restore test fails", "bad")
      };
      api.info("<strong>How to read it.</strong> The table shows the backups the store holds tonight, a month to a row: which key version locked them, and whether they open on the date you have replayed to. Each step is one month: the rotation on the 1st, then the month's backups. The stats count what opens, what is lost, and what one stolen copy of the backup store would expose. Keys are labels such as v13, never real keys.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens on 31 Oct 2025, before the first rotation, as found.
      t.expect(t.stat("day") === "31 Oct 2025" && t.stat("made") === 17 && t.stat("opens") === 17 && t.stat("lost") === 0 &&
        t.stat("held") === "v1" && t.stat("deleted") === 0 && t.stat("stolen") === "17 of 17" &&
        t.stat("photo") === "not handed in yet" && t.stat("first") === "none yet",
        "Opens on 31 Oct 2025: 17 backups, all locked with v1, all open");

      // 2. One month: the first run of the script deletes v1.
      t.click("next");
      t.expect(t.stat("day") === "30 Nov 2025" && t.stat("made") === 47 && t.stat("opens") === 30 && t.stat("lost") === 17 &&
        has("1 Nov 2025, 00:30. Key v1 is current. The script adds key v2 and deletes v1.") &&
        has("By 30 Nov 2025: 47 backups made, 30 open, 17 cannot. Key versions held: v2."),
        "1 Nov 2025: the script adds v2 and deletes v1; by 30 Nov, 17 backups cannot open");

      // 3. Tonight, as found: 351 of 365 cannot open.
      t.click("all");
      t.expect(t.stat("day") === "14 Oct 2026" && t.stat("made") === 365 && t.stat("opens") === 14 && t.stat("lost") === 351 &&
        t.stat("held") === "v13" && t.stat("deleted") === 12 && t.stat("stolen") === "14 of 365" && t.stat("leak") === 14 &&
        t.stat("photo") === "0 of 180" && t.stat("record") === "none" && t.stat("tests") === "off" &&
        t.stat("first") === "Sun 2 Nov 2025" &&
        has("1 Oct 2026, 00:30. Key v12 is current. The script adds key v13 and deletes v12.") &&
        has("Backups holding it that open: 0 of 180. One stolen copy of the backup store would expose 14 of 365 backups."),
        "As found, 14 Oct 2026: 14 open, 351 cannot, v13 held, 12 deleted, her photo 0 of 180, a stolen copy exposes 14");

      // 4. Option 0: no rotation. Everything opens, and a stolen copy exposes all 365.
      t.set("rot", "none");
      t.click("all");
      t.expect(t.stat("lost") === 0 && t.stat("opens") === 365 && t.stat("held") === "v1" && t.stat("stolen") === "365 of 365" &&
        t.stat("leak") === 365 && t.stat("photo") === "180 of 180" && t.stat("first") === "none yet",
        "No rotation: 0 lost, but one stolen copy of the store exposes 365 of 365 and one leaked key opens all 365");

      // 5. Option 1: weekly restore tests, everything else as found.
      t.set("rot", "delete");
      t.set("tests", true);
      t.click("next");
      var caught = has("Sun 2 Nov 2025: the weekly test restores the backup of 5 Oct 2025, locked with v1. It cannot be opened.");
      t.click("all");
      t.expect(caught && t.stat("lost") === 351 && t.stat("stolen") === "14 of 365" && t.stat("tests") === "52 run, 46 failed" &&
        t.stat("first") === "Sun 2 Nov 2025",
        "Weekly tests: the first fails on Sun 2 Nov 2025, but 351 still cannot open and the key still sits beside the backups");

      // 6. Option 2: the office safe, no rotation.
      t.set("tests", false);
      t.set("where", "safe");
      t.set("rot", "none");
      t.click("all");
      t.expect(t.stat("lost") === 0 && t.stat("stolen") === "0 of 365" && t.stat("leak") === 365 && t.stat("record") === "none" &&
        t.stat("held") === "v1",
        "Office safe, never rotated: 0 lost and 0 exposed by a stolen store, but one key opens all 365 and no use is recorded");

      // 7. Option 3 (ok): a key service, keeping old versions, envelope encryption on.
      t.set("where", "service");
      t.set("rot", "keep");
      t.set("env", true);
      t.click("all");
      t.expect(t.stat("lost") === 0 && t.stat("opens") === 365 && t.stat("held") === "v1 to v13" && t.stat("deleted") === 0 &&
        t.stat("stolen") === "0 of 365" && t.stat("leak") === 1 && t.stat("photo") === "180 of 180" &&
        t.stat("record") === "every use recorded" &&
        has("1 Oct 2026, 00:30. Key v12 is current. The script adds key v13 and keeps v1 to v12 for opening."),
        "Key service keeping versions, with envelope: 0 lost, 0 exposed, one leaked data key opens 1, every use recorded");

      // 8. Keeping versions but still beside the backups: nothing lost, everything exposed.
      t.set("where", "beside");
      t.set("env", false);
      t.click("all");
      t.expect(t.stat("lost") === 0 && t.stat("stolen") === "365 of 365" && t.stat("leak") === 14,
        "Keeping versions beside the backups: 0 lost, but a stolen copy of the store exposes all 365");

      // 9. Envelope encryption alone does not bring back deleted versions.
      t.set("rot", "delete");
      t.set("env", true);
      t.click("all");
      t.expect(t.stat("lost") === 351 && t.stat("leak") === 1 && t.stat("stolen") === "14 of 365",
        "Envelope encryption alone: one leaked data key opens 1, but 351 still cannot open");

      // 10. Tests with old versions kept: none fails all year.
      t.set("rot", "keep");
      t.set("tests", true);
      t.click("all");
      t.expect(t.stat("tests") === "52 run, 0 failed" && t.stat("first") === "none yet",
        "Keeping old versions: 52 weekly tests, none fails");
    }
  });
})();
