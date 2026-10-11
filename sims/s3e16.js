/* sims/s3e16-v1.0.0.js  (published as sims/s3e16.js)
   Case s3e16 "The Migration That Ate Tuesday": a migration timeline lab for Grisedale Removals.
   Two apps share one PostgreSQL table of jobs: the office app (4.2, then 4.3) and the booking
   website (2.7, then 2.8). Hartigan replaces the text column move_day with a real date column
   move_date. The learner picks the method, which steps run, whether the website is redeployed,
   the backfill's batch size and when move_day is dropped, then steps through Monday to Thursday.
   Widget-style sim: it draws two tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: methods add-a-column (the story and expand and contract),
     RENAME and a downtime night; website redeployed or not; dual write; stop writing move_day;
     backfill never, once (Mon 23:00) or once more (Wed 01:00); batch 100, 1,000, 10,000 or all;
     compare reads; drop at Wed 02:00, only when nothing uses it, or never; Restore Tuesday's
     backup. Stats: clock, bookings made, in the schedule, Tuesday's in the schedule, rows with
     NULL move_date, dates lost, failed requests per app, backfill, longest lock, move_date type.
     selfTest: 12 assertions.

   The model is stated in sim.lede: old apps use move_day, new ones move_date (plus move_day
   while dual write is on); a request fails if a column it needs is gone; the backfill copies
   rows that existed at its start (5 s + 0.02 s per row per batch, a teaching model); an app that
   loses its column is fixed 8 h 40 min later (Wed 02:00 to 10:40 in the story); the schedule is
   what the office app reads. The sim opens at Mon 17:59, before the first step.

   Where every number comes from (content/s3/s3e16-v1.0.0.json; all checked by the selfTest).
   - 95,984 old jobs before Monday. Monday: website 7 bookings (09:12 to 22:31), office 9 (all
     before 18:00): 16. At 23:00 the backfill finds 95,984 + 16 = 96,000 rows: 96 batches of
     1,000, each 5 + 20 = 25 s, 2,400 s: 23:00 to 23:40.
   - Tuesday: website 29 (05:48 to 23:05), office 12 (09:10 to 17:10). None from 23:40 Monday to
     midnight, so between the backfill's end and the drop the website took 29 and the office 12.
     The 29 keep a NULL move_date: Tuesday shows "12 of 41" in the schedule.
   - Wed 02:00 drop: 29 dates lost. Website 2.7 fails from 02:00 until 2.8 ships at 10:40: lookups
     02:04, 05:30, 07:45, 08:58, 10:12 and bookings 06:55, 08:20, 09:41, 8 failed requests.
   - Wednesday made: website 10 (after 10:40) + office 11 = 21. Thursday: website 12 + office 10.
     Total made 16 + 41 + 21 + 22 = 100 of 103 tried; in the schedule 71.
   - Drop only if nothing uses it, website not redeployed: held; website 2.7 keeps writing
     move_day only, so 29 + 13 Wednesday + 12 Thursday = 54 rows NULL by Thursday, none lost.
   - Expand and contract, every app listed: all 103 made and in the schedule, 0 failed.
   - Restore at Wed 12:00 of the Tue 03:00 backup: holds 0 of the 29 (first booked 05:48) and
     undoes 41 + 4 office + 1 website = 46 bookings made since.
   - Batches of 100: 960 x 5 + 1,920 = 6,720 s, ends Tue 00:52, lock 7 s. All at once: 1,925 s,
     lock 32 min 5 s. 10,000: 1,970 s, lock 3 min 25 s.
   - RENAME at Mon 18:00, website not redeployed: fails until Tue 02:40: bookings 20:14, 21:47,
     22:31 and lookups 19:00, 22:50 = 5 failed, 100 made, move_date still text.
   - Downtime night Mon 22:00 to Tue 06:00, both redeployed: bookings 22:31 and 05:48 and lookup
     22:50 turned away = 3; 101 made; Tuesday "40 of 40". Website left on 2.7: it fails from Tue
     06:00 to 14:40 as well, 18 failed, 88 made.
   - Dual write, no stop step, drop at 02:00: office fails 09:15 and 10:00 (2), website 3 bookings.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var DAYS = ["Mon", "Tue", "Wed", "Thu"];
  var HIST = 95984;
  var FIX = 31200; // 8 h 40 min
  var END = 3 * 86400 + 23 * 3600 + 59 * 60;
  var START = 17 * 3600 + 59 * 60;

  // Request times by day, expanded to "Day HH:MM" strings.
  function byDay(o) {
    var out = [];
    Object.keys(o).forEach(function (d) { o[d].split(" ").forEach(function (x) { out.push(d + " " + x); }); });
    return out;
  }
  var WEB_BOOK = byDay({
    Mon: "09:12 11:40 14:05 16:33 20:14 21:47 22:31",
    Tue: "05:48 07:12 07:55 08:31 09:04 09:40 10:17 10:52 11:26 12:03 12:38 13:15 13:49 14:22 14:58 15:31 16:07 16:44 17:19 17:53 18:30 19:06 19:42 20:18 20:55 21:31 22:08 22:36 23:05",
    Wed: "06:55 08:20 09:41 11:15 12:30 13:02 14:10 15:25 16:40 18:05 19:20 20:45 22:10",
    Thu: "08:05 09:30 10:45 12:10 13:35 14:50 16:15 17:40 19:05 20:30 21:20 22:45"
  });
  var OFF_BOOK = byDay({
    Mon: "09:20 10:05 10:50 11:35 13:10 14:25 15:15 16:00 17:05",
    Tue: "09:10 09:45 10:30 11:05 11:50 12:40 13:25 14:05 14:50 15:35 16:20 17:10",
    Wed: "09:15 10:00 10:45 11:30 12:20 13:30 14:15 15:00 15:45 16:30 17:15",
    Thu: "09:05 09:55 10:40 11:25 12:35 13:20 14:10 15:05 15:50 16:45"
  });
  var WEB_LOOK = byDay({
    Mon: "19:00 22:50",
    Tue: "08:10 12:25 16:50 21:05",
    Wed: "02:04 05:30 07:45 08:58 10:12 13:40 19:55",
    Thu: "07:30 11:00 18:15"
  });

  var NAMES = { office: ["office app 4.2", "office app 4.3", "office app 4.4"], web: ["website 2.7", "website 2.8", "website 2.8"] };

  /* ---------- helpers ---------- */

  function at(s) {
    var d = DAYS.indexOf(s.slice(0, 3));
    return d * 86400 + Number(s.slice(4, 6)) * 3600 + Number(s.slice(7, 9)) * 60;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) {
    var s = t % 86400;
    var out = two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60);
    return s % 60 ? out + ":" + two(s % 60) : out;
  }
  function when(t) { return DAYS[Math.floor(t / 86400)] + " " + hm(t); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dur(s) {
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    return m + " min" + (s % 60 ? " " + (s % 60) + " s" : "");
  }
  function plural(n, one, many) { return fmt(n) + " " + (n === 1 ? one : many); }
  function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  var REQS = (function () {
    var r = [];
    WEB_BOOK.forEach(function (s) { r.push({ t: at(s), app: "web", k: "book" }); });
    OFF_BOOK.forEach(function (s) { r.push({ t: at(s), app: "office", k: "book" }); });
    WEB_LOOK.forEach(function (s) { r.push({ t: at(s), app: "web", k: "look" }); });
    r.sort(function (a, b) { return a.t - b.t; });
    return r;
  })();

  /* ---------- the model ---------- */

  function steps(C) {
    var s = [];
    if (C.method === "rename") {
      s.push({ t: at("Mon 18:00"), k: "rename" });
    } else if (C.method === "downtime") {
      s.push({ t: at("Mon 22:00"), k: "down" });
      s.push({ t: at("Mon 22:00"), k: "swap" });
      s.push({ t: at("Tue 06:00"), k: "up" });
    } else {
      s.push({ t: at("Mon 18:00"), k: "add" });
      s.push({ t: at("Mon 19:30"), k: "deploy", app: "office" });
      if (C.web) s.push({ t: at("Mon 19:30"), k: "deploy", app: "web" });
      if (C.backfill !== "never") s.push({ t: at("Mon 23:00"), k: "backfill" });
      if (C.compare) s.push({ t: at("Tue 12:00"), k: "compare" });
      if (C.backfill === "twice") s.push({ t: at("Wed 01:00"), k: "backfill", again: true });
      if (C.compare) s.push({ t: at("Wed 01:30"), k: "compare" });
      if (C.dual && C.stop) s.push({ t: at("Wed 01:45"), k: "stop" });
      if (C.drop !== "never") s.push({ t: at("Wed 02:00"), k: "drop" });
    }
    return s;
  }

  function usesDay(a) { return !a.down && (a.v === 0 || a.writesOld); }

  // Replays the week up to time T. Returns the state and every log line with its time.
  function simulate(C, T) {
    var M = {
      cols: { day: true, date: false }, text: false,
      apps: { office: { v: 0, writesOld: false, down: false }, web: { v: 0, writesOld: false, down: false } },
      hist: { day: true, date: false }, rows: [], fails: { office: 0, web: 0 }, failDay: [0, 0, 0, 0],
      logs: [], table: [], backfill: null, lock: 0, broken: {}, dropAt: null
    };
    var st = steps(C);
    var fixes = [];
    var i = 0;
    var j = 0;
    function log(t, msg, tone) { M.logs.push({ t: t, msg: when(t) + "  " + msg, tone: tone || "" }); }
    function row(t, step, status, back) { M.table.push({ t: t, step: step, status: status, back: back }); }
    function dayOnly() {
      var n = 0;
      M.rows.forEach(function (r) { if (r.day && !r.date) n += 1; });
      return n + (M.hist.day && !M.hist.date ? HIST : 0);
    }
    function name(a) { return NAMES[a][M.apps[a].v]; }
    function users() { return ["office", "web"].filter(function (a) { return usesDay(M.apps[a]); }).map(name); }
    function vanish(t) {
      ["office", "web"].forEach(function (a) {
        if (usesDay(M.apps[a])) { M.broken[a] = true; fixes.push({ t: t + FIX, k: "fix", app: a }); }
      });
    }
    function deploy(a, dual) { M.apps[a].v = 1; M.apps[a].writesOld = dual; }

    function doStep(s) {
      var t = s.t;
      var a;
      var n;
      if (s.k === "add") {
        log(t, "ALTER TABLE jobs ADD COLUMN move_date date. Before: only move_day, as text, in all " + fmt(HIST + M.rows.length) + " rows.");
        M.cols.date = true;
        row(t, "Add move_date", "ran", "yes: drop it, nothing reads it yet");
      } else if (s.k === "deploy") {
        a = s.app;
        log(t, name(a) + " replaced by " + NAMES[a][1] + ": reads move_date, writes " + (C.dual ? "both columns." : "move_date only."));
        deploy(a, C.dual);
        row(t, "Deploy " + NAMES[a][1] + (C.dual ? " (writes both)" : " (move_date only)"), "ran",
          C.dual ? "yes: the old version still finds move_day" : "no: the old version can't read its new rows");
      } else if (s.k === "backfill") {
        n = 0;
        M.rows.forEach(function (r) { if (r.t < t && r.day && !r.date) n += 1; });
        if (M.hist.day && !M.hist.date) n += HIST;
        if (!M.cols.day) {
          log(t, "Backfill: move_day is gone, nothing to copy.", "warn");
          row(t, "Backfill again", "nothing to copy", "yes");
          return;
        }
        var B = C.batch === "all" ? Math.max(n, 1) : Number(C.batch);
        var batches = Math.max(1, Math.ceil(n / B));
        var secs = Math.round(5 * batches + 0.02 * n);
        var lock = Math.round(5 + 0.02 * Math.min(B, n));
        M.rows.forEach(function (r) { if (r.t < t && r.day && !r.date) r.date = true; });
        if (M.hist.day) M.hist.date = true;
        M.lock = Math.max(M.lock, lock);
        var range = when(t) + " to " + (Math.floor((t + secs) / 86400) === Math.floor(t / 86400) ? hm(t + secs) : when(t + secs));
        if (!s.again) M.backfill = range + ", " + plural(batches, "batch", "batches");
        log(t, "Backfill" + (s.again ? " again" : "") + ": " + plural(n, "row has", "rows have") + " a move_day and no move_date. Copied in " +
          plural(batches, "batch", "batches") + ", " + dur(secs) + ", until " + when(t + secs) + ".", n && s.again ? "ok" : "");
        row(t, "Backfill" + (s.again ? " again" : "") + ", " + plural(n, "row", "rows"), "ran", "yes: move_day is untouched");
      } else if (s.k === "compare") {
        n = dayOnly();
        log(t, "Compare reads from both columns: " + plural(n, "row has", "rows have") + " a date in move_day and none in move_date.", n ? "bad" : "ok");
        row(t, "Compare reads", n ? fmt(n) + " differ" : "all agree", "yes: it only reads");
      } else if (s.k === "stop") {
        var who = ["office", "web"].filter(function (x) { return M.apps[x].writesOld; }).map(name);
        log(t, "Stop writing move_day. Before: " + (who.length ? list(who) + " still write it." : "nothing writes it."));
        ["office", "web"].forEach(function (x) { M.apps[x].writesOld = false; });
        row(t, "Stop writing move_day", "ran", "yes, until the drop");
      } else if (s.k === "drop") {
        var u = users();
        n = dayOnly();
        if (C.drop === "guard" && (u.length || n)) {
          log(t, "Drop move_day held: " + (u.length ? list(u) + " still " + (u.length > 1 ? "use" : "uses") + " it" : "no app uses it") +
            "; " + plural(n, "row has", "rows have") + " a date only there.", "warn");
          row(t, "Drop move_day", "held", "nothing changed");
          return;
        }
        log(t, "ALTER TABLE jobs DROP COLUMN move_day. Before: " + plural(n, "row has", "rows have") + " a date only in move_day" +
          (u.length ? "; " + list(u) + " still " + (u.length > 1 ? "use" : "uses") + " it." : "; no app uses it."), n || u.length ? "bad" : "ok");
        vanish(t);
        M.cols.day = false;
        M.hist.day = false;
        M.rows.forEach(function (r) { r.day = false; });
        M.dropAt = t;
        row(t, "Drop move_day", "ran", "no: only a restore brings it back");
      } else if (s.k === "rename") {
        log(t, "ALTER TABLE jobs RENAME COLUMN move_day TO move_date. Before: website " + (C.web ? "2.7 is redeployed at the same moment." : "2.7 still uses move_day."));
        M.cols.day = false;
        M.cols.date = true;
        M.text = true;
        M.hist.date = true;
        M.hist.day = false;
        M.rows.forEach(function (r) { r.date = r.day; r.day = false; });
        deploy("office", false);
        if (C.web) deploy("web", false);
        vanish(t);
        row(t, "Rename, deploy " + (C.web ? "both apps" : "office app 4.3"), "ran", "yes: rename back, and readers break again");
      } else if (s.k === "down") {
        log(t, "Both apps closed for the night.");
        M.apps.office.down = true;
        M.apps.web.down = true;
        row(t, "Close both apps", "ran", "yes");
      } else if (s.k === "swap") {
        log(t, "With nothing running: add move_date, copy all " + fmt(HIST + M.rows.length) + " rows, drop move_day.");
        M.cols.date = true;
        M.cols.day = false;
        M.hist.date = true;
        M.hist.day = false;
        M.rows.forEach(function (r) { r.date = true; r.day = false; });
        row(t, "Swap the column in one go", "ran", "only from the backup");
      } else if (s.k === "up") {
        M.apps.office.down = false;
        M.apps.web.down = false;
        deploy("office", false);
        if (C.web) deploy("web", false);
        log(t, "Apps reopen: office app 4.3 and " + name("web") + ".", C.web ? "ok" : "warn");
        vanish(t);
        row(t, "Reopen: office 4.3, " + name("web"), "ran", "yes");
      } else if (s.k === "fix") {
        a = s.app;
        log(t, NAMES[a][2] + " ships as a fix: reads and writes move_date only.", "ok");
        M.apps[a].v = 2;
        M.apps[a].writesOld = false;
        M.broken[a] = false;
        row(t, "Fix: " + NAMES[a][2], "ran", "no: move_day is gone");
      }
    }

    function doReq(q) {
      var a = M.apps[q.app];
      var ok = true;
      var why = "";
      if (a.down) { ok = false; why = "closed for the night, turned away"; }
      else if (a.v === 0 && !M.cols.day) { ok = false; why = "column \"move_day\" does not exist"; }
      else if (a.v > 0 && q.k === "book" && a.writesOld && !M.cols.day) { ok = false; why = "column \"move_day\" does not exist"; }
      if (!ok) {
        if (!a.down && !M.broken["_" + q.app]) {
          log(q.t, name(q.app) + (q.k === "book" ? " booking" : " lookup") + " fails: " + why + ".", "bad");
          M.broken["_" + q.app] = true;
        }
        M.fails[q.app] += 1;
        M.failDay[Math.floor(q.t / 86400)] += 1;
        return;
      }
      M.broken["_" + q.app] = false;
      if (q.k === "book") M.rows.push({ t: q.t, app: q.app, day: a.v === 0 || a.writesOld, date: a.v > 0 });
    }

    while (true) {
      fixes.sort(function (x, y) { return x.t - y.t; });
      var cand = [];
      if (i < st.length) cand.push(st[i]);
      if (fixes.length) cand.push(fixes[0]);
      var nextStep = null;
      cand.forEach(function (c) { if (!nextStep || c.t < nextStep.t) nextStep = c; });
      var q = j < REQS.length ? REQS[j] : null;
      if (nextStep && (!q || nextStep.t <= q.t)) {
        if (nextStep.t > T) break;
        if (nextStep === st[i]) i += 1; else fixes.shift();
        doStep(nextStep);
      } else if (q) {
        if (q.t > T) break;
        j += 1;
        doReq(q);
      } else break;
    }
    M.pendingFix = fixes.length ? fixes[0].t : null;
    return M;
  }

  function nextStepAfter(C, T) {
    var best = null;
    var M = simulate(C, END);
    M.table.forEach(function (r) { if (r.t > T && (best === null || r.t < best)) best = r.t; });
    return best;
  }

  function summary(M) {
    var office = M.apps.office;
    var readsDate = office.v > 0;
    var out = { made: M.rows.length, sched: 0, lost: 0, days: [] };
    for (var d = 0; d < 4; d++) out.days.push({ made: 0, sched: 0, failed: M.failDay[d] });
    M.rows.forEach(function (r) {
      var d = Math.floor(r.t / 86400);
      var inSched = readsDate ? r.date : r.day;
      out.days[d].made += 1;
      if (inSched) { out.sched += 1; out.days[d].sched += 1; }
      if (!r.day && !r.date) out.lost += 1;
    });
    if (!M.hist.day && !M.hist.date) out.lost += HIST;
    var nulls = 0;
    M.rows.forEach(function (r) { if (!r.date) nulls += 1; });
    if (!M.hist.date) nulls += HIST;
    out.nulls = M.cols.date ? nulls : "no column yet";
    return out;
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
    function table(heads) {
      var tb = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
      var tr = el("tr");
      heads.forEach(function (h) { tr.appendChild(el("th", "text-align:left;padding:2px 6px 2px 0;", h)); });
      var th = el("thead");
      th.appendChild(tr);
      tb.appendChild(th);
      var body = el("tbody");
      tb.appendChild(body);
      return { tb: tb, body: body };
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var t1 = table(["when", "step", "status", "can it be rolled back?"]);
    var t2 = table(["day", "bookings made", "in the schedule", "missing", "failed requests"]);
    box.appendChild(head);
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "Steps"));
    box.appendChild(t1.tb);
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "Bookings per day, as the office schedule shows them now"));
    box.appendChild(t2.tb);
    api.root.appendChild(box);
    return { el: el, head: head, steps: t1.body, days: t2.body };
  }

  function fill(ui, body, rows) {
    while (body.firstChild) body.removeChild(body.firstChild);
    rows.forEach(function (cells) {
      var tr = ui.el("tr");
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 6px 2px 0;", String(c))); });
      body.appendChild(tr);
    });
  }

  var METHOD_TEXT = {
    add: "add move_date, then move apps to it",
    rename: "RENAME move_day to move_date",
    downtime: "a downtime night, both apps closed"
  };

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var M = simulate(C, S.T);
    var sm = summary(M);
    S.M = M;
    S.sm = sm;
    var ignored = C.method === "add" ? "" : " Dual write, backfill, batch, compare and drop settings don't apply.";
    S.ui.head.textContent = "Showing " + when(S.T) + ". Method: " + METHOD_TEXT[C.method] + ". Website " +
      (C.web ? "redeployed with the office app." : "not redeployed.") + ignored;
    fill(S.ui, S.ui.steps, M.table.map(function (r) { return [when(r.t), r.step, r.status, r.back]; }));
    fill(S.ui, S.ui.days, sm.days.map(function (d, k) {
      return [DAYS[k], d.made, d.sched, d.made - d.sched, d.failed];
    }));
    var tue = sm.days[1];
    S.stat.clock(when(S.T));
    S.stat.made(sm.made);
    S.stat.sched(sm.sched);
    S.stat.tue(tue.sched + " of " + tue.made);
    S.stat.nulls(typeof sm.nulls === "number" ? fmt(sm.nulls) : sm.nulls);
    S.stat.lost(fmt(sm.lost));
    S.stat.webfail(M.fails.web);
    S.stat.offfail(M.fails.office);
    S.stat.backfill(M.backfill || "not run");
    S.stat.lock(M.lock ? dur(M.lock) : "none");
    S.stat.type(M.cols.date ? (M.text ? "text" : "date") : "no column yet");
  }

  // Move the clock to T and log every step and first failure between the old time and T.
  function advance(api, T) {
    var S = api.state;
    var M = simulate(S.C, T);
    M.logs.forEach(function (l) { if (l.t > S.T && l.t <= T) api.log(l.msg, l.tone); });
    S.T = T;
    draw(api);
  }

  function replay(api, what) {
    api.state.T = START;
    api.log(what + " Replaying from Mon 17:59.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e16", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { method: "add", web: false, dual: false, stop: true, backfill: "once", batch: "1000", compare: false, drop: "sched" };
      S.T = START;
      S.ui = buildWidget(api);
      S.ctl = {};

      var PLANS = [
        { value: "story", label: "Hartigan's week (the story)" },
        { value: "ok", label: "Both apps write both, compare, drop when unused" },
        { value: "rename", label: "RENAME, website not redeployed" },
        { value: "downtime", label: "Downtime night, both apps redeployed" }
      ];
      var PRESET = {
        story: { method: "add", web: false, dual: false, stop: true, backfill: "once", batch: "1000", compare: false, drop: "sched" },
        ok: { method: "add", web: true, dual: true, stop: true, backfill: "once", batch: "1000", compare: true, drop: "guard" },
        rename: { method: "rename", web: false, dual: false, stop: true, backfill: "once", batch: "1000", compare: false, drop: "sched" },
        downtime: { method: "downtime", web: true, dual: false, stop: true, backfill: "once", batch: "1000", compare: false, drop: "sched" }
      };
      function setAll(c) {
        S.C = {};
        Object.keys(c).forEach(function (k) { S.C[k] = c[k]; });
        S.ctl.method.set(c.method);
        S.ctl.web.set(c.web);
        S.ctl.dual.set(c.dual);
        S.ctl.stop.set(c.stop);
        S.ctl.backfill.set(c.backfill);
        S.ctl.batch.set(c.batch);
        S.ctl.compare.set(c.compare);
        S.ctl.drop.set(c.drop);
      }
      function change(key, v, what) { S.C[key] = v; replay(api, what); }

      S.ctl.plan = api.control.select("plan", "Plan", PLANS, "story", function (v) {
        var p = PRESET[String(v)];
        if (!p) return;
        setAll(p);
        replay(api, "Plan: " + PLANS.filter(function (x) { return x.value === String(v); })[0].label + ".");
      });
      S.ctl.method = api.control.select("method", "Method", [
        { value: "add", label: "Add move_date, move apps to it" },
        { value: "rename", label: "ALTER TABLE ... RENAME COLUMN" },
        { value: "downtime", label: "Downtime night, one big change" }
      ], "add", function (v) { change("method", String(v), "Method: " + METHOD_TEXT[String(v)] + "."); });
      S.ctl.web = api.control.toggle("web", "Website redeployed with the office app", false, function (on) {
        change("web", !!on, "Website redeployed: " + (on ? "yes." : "no."));
      });
      S.ctl.dual = api.control.toggle("dual", "Dual write: new versions write both columns", false, function (on) {
        change("dual", !!on, "Dual write: " + (on ? "on." : "off."));
      });
      S.ctl.stop = api.control.toggle("stop", "Stop writing move_day before the drop (Wed 01:45)", true, function (on) {
        change("stop", !!on, "Stop writing move_day before the drop: " + (on ? "on." : "off."));
      });
      S.ctl.backfill = api.control.select("backfill", "Backfill", [
        { value: "once", label: "Mon 23:00" },
        { value: "twice", label: "Mon 23:00, and again Wed 01:00" },
        { value: "never", label: "Never" }
      ], "once", function (v) {
        change("backfill", String(v), "Backfill: " + ({ once: "Mon 23:00", twice: "Mon 23:00 and Wed 01:00", never: "never" })[String(v)] + ".");
      });
      S.ctl.batch = api.control.select("batch", "Backfill batch size (rows)", [
        { value: "100", label: "100" }, { value: "1000", label: "1,000" },
        { value: "10000", label: "10,000" }, { value: "all", label: "All at once" }
      ], "1000", function (v) { change("batch", String(v), "Batch size: " + (String(v) === "all" ? "all at once" : fmt(v)) + "."); });
      S.ctl.compare = api.control.toggle("compare", "Compare reads from both columns (Tue 12:00, Wed 01:30)", false, function (on) {
        change("compare", !!on, "Compare reads: " + (on ? "on." : "off."));
      });
      S.ctl.drop = api.control.select("drop", "Drop move_day", [
        { value: "sched", label: "Wed 02:00, as scheduled" },
        { value: "guard", label: "Wed 02:00, only if nothing uses it" },
        { value: "never", label: "Never" }
      ], "sched", function (v) {
        change("drop", String(v), "Drop move_day: " + ({ sched: "Wed 02:00, as scheduled", guard: "only if nothing uses it", never: "never" })[String(v)] + ".");
      });
      S.ctl.next = api.control.button("next", "Next step", function () {
        var t = nextStepAfter(S.C, S.T);
        if (t === null) { api.log("No more steps. Run to the end to see Thursday.", ""); return; }
        advance(api, t);
      });
      S.ctl.runto = api.control.select("runto", "Run to", [
        { value: "start", label: "Mon 17:59 (start)" },
        { value: "beforedrop", label: "Wed 01:59 (just before the drop)" },
        { value: "end", label: "Thu 23:59 (the end)" }
      ], "start", function (v) {
        var T = v === "beforedrop" ? at("Wed 01:59") : (v === "end" ? END : START);
        if (T < S.T) { S.T = START; api.log("Back to Mon 17:59.", ""); }
        advance(api, T);
      });
      S.ctl.end = api.control.button("end", "Run to the end", function () { advance(api, END); });
      S.ctl.restore = api.control.button("restore", "Restore Tuesday's 03:00 backup at Wed 12:00", function () {
        var M = simulate(S.C, END);
        var lost = M.rows.filter(function (r) { return !r.day && !r.date; });
        var held = lost.filter(function (r) { return r.t < at("Tue 03:00"); }).length;
        var undone = M.rows.filter(function (r) { return r.t > at("Tue 03:00") && r.t <= at("Wed 12:00"); }).length;
        api.log("Restore check: the Tue 03:00 backup holds move_day for " + held + " of the " + lost.length + " lost bookings" +
          (lost.length ? " (the first was made " + when(lost[0].t) + ")" : "") + ", and restoring it at Wed 12:00 would undo " +
          undone + " bookings made since 03:00.", held < lost.length ? "bad" : "warn");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        clock: api.stat("clock", "time shown", ""),
        made: api.stat("made", "bookings made", ""),
        sched: api.stat("sched", "bookings in the schedule", "ok"),
        tue: api.stat("tue", "Tuesday's bookings in the schedule", "warn"),
        nulls: api.stat("nulls", "rows with NULL move_date", "warn"),
        lost: api.stat("lost", "dates lost (in neither column)", "bad"),
        webfail: api.stat("webfail", "failed website requests", "bad"),
        offfail: api.stat("offfail", "failed office app requests", "bad"),
        backfill: api.stat("backfill", "backfill", ""),
        lock: api.stat("lock", "longest lock held by one batch", ""),
        type: api.stat("type", "move_date's type", "")
      };

      api.info("<strong>How to read it.</strong> Each step runs at its stated time. A booking is a row in the jobs table; the schedule is what the office app reads. A request fails when a column it needs is gone, or is turned away while its app is closed. The steps table says whether each step could be undone without losing anything.");
      api.log("Mon 17:59. jobs holds " + fmt(HIST + 13) + " rows, each with move_day as text. Office app 4.2 and website 2.7 both read and write it.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function plan(p) { t.set("plan", p); }

      // 1. The opening state, before the first step.
      t.expect(t.stat("clock") === "Mon 17:59" && t.stat("made") === 13 && t.stat("sched") === 13 && t.stat("tue") === "0 of 0" &&
        t.stat("nulls") === "no column yet" && t.stat("lost") === 0 && t.stat("webfail") === 0 && t.stat("backfill") === "not run" &&
        t.stat("type") === "no column yet",
        "Opens at Mon 17:59: 13 bookings made, all in the schedule, no move_date yet");

      // 2. One step: adding move_date at 18:00, logged with the state before it.
      begin();
      t.click("next");
      t.expect(has("Mon 18:00  ALTER TABLE jobs ADD COLUMN move_date date. Before: only move_day, as text, in all 95,997 rows.") &&
        t.stat("nulls") === "95,997" && t.stat("type") === "date",
        "Next step adds move_date at Mon 18:00; 95,997 rows have it NULL");

      // 3. Just before the drop: 29 rows with no move_date, nothing lost yet, Tuesday 12 of 41.
      t.set("runto", "beforedrop");
      t.expect(t.stat("nulls") === 29 && t.stat("lost") === 0 && t.stat("tue") === "12 of 41" && t.stat("webfail") === 0 &&
        t.stat("backfill") === "Mon 23:00 to 23:40, 96 batches" && t.stat("lock") === "25 s",
        "Wed 01:59: backfill ran 23:00 to 23:40 in 96 batches; 29 rows NULL, none lost; Tuesday 12 of 41 in the schedule");

      // 4. The story to the end: 29 lost of 41, 8 failed website requests, fix at 10:40.
      begin();
      t.click("end");
      t.expect(has("Wed 02:00  ALTER TABLE jobs DROP COLUMN move_day. Before: 29 rows have a date only in move_day; website 2.7 still uses it.") &&
        has("Wed 02:04  website 2.7 lookup fails: column \"move_day\" does not exist.") && has("Wed 10:40  website 2.8 ships as a fix") &&
        t.stat("lost") === 29 && t.stat("nulls") === 29 && t.stat("tue") === "12 of 41" && t.stat("webfail") === 8 &&
        t.stat("offfail") === 0 && t.stat("made") === 100 && t.stat("sched") === 71,
        "The story: the drop at Wed 02:00 takes 29 dates; 12 of Tuesday's 41 in the schedule; 8 failed website requests until 10:40");

      // 5. Restoring Tuesday's backup brings back none of the 29 and undoes 46 bookings.
      begin();
      t.click("restore");
      t.expect(has("holds move_day for 0 of the 29 lost bookings (the first was made Tue 05:48), and restoring it at Wed 12:00 would undo 46 bookings made since 03:00."),
        "Restore check: the Tue 03:00 backup holds 0 of the 29 and would undo 46 bookings");

      // 6. A second backfill before the drop saves the dates, but the old website still breaks.
      t.set("backfill", "twice");
      begin();
      t.click("end");
      t.expect(has("Wed 01:00  Backfill again: 29 rows have a move_day and no move_date.") && t.stat("lost") === 0 &&
        t.stat("tue") === "41 of 41" && t.stat("webfail") === 8,
        "Backfill again at Wed 01:00: the 29 are copied and nothing is lost, but website 2.7 still fails 8 times");

      // 7. A guarded drop holds while the website still uses move_day.
      t.set("backfill", "once");
      t.set("drop", "guard");
      begin();
      t.click("end");
      t.expect(has("Wed 02:00  Drop move_day held: website 2.7 still uses it; 29 rows have a date only there.") &&
        t.stat("lost") === 0 && t.stat("nulls") === 54 && t.stat("webfail") === 0 && t.stat("made") === 103,
        "Drop only if nothing uses it: held at Wed 02:00; nothing lost or failed, but website 2.7 leaves 54 rows NULL by Thursday");

      // 8. Expand and contract with every app listed: nothing lost, nothing failed, every step undoable until the drop.
      plan("ok");
      begin();
      t.click("end");
      var tbl = t.api.state.M.table;
      var undoable = tbl.filter(function (r) { return r.t < 2 * 86400 + 7200; }).every(function (r) { return r.back.indexOf("no") !== 0; });
      t.expect(has("Compare reads from both columns: 0 rows have a date in move_day and none in move_date.") &&
        has("Wed 02:00  ALTER TABLE jobs DROP COLUMN move_day. Before: 0 rows have a date only in move_day; no app uses it.") &&
        t.stat("lost") === 0 && t.stat("nulls") === 0 && t.stat("webfail") === 0 && t.stat("offfail") === 0 &&
        t.stat("tue") === "41 of 41" && t.stat("sched") === 103 && undoable,
        "Expand and contract: 0 lost, 0 failed, 41 of 41 on Tuesday, every step before the drop can be rolled back");

      // 9. Dual write without the stop step: the drop breaks the writers.
      t.set("stop", false);
      t.set("drop", "sched");
      t.click("end");
      t.expect(t.stat("offfail") === 2 && t.stat("webfail") === 3 && t.stat("lost") === 0,
        "Dual write but no stop step: the drop fails office writes twice and website bookings 3 times");

      // 10. RENAME: instant, nothing lost, but the old website fails 5 times and the type stays text.
      plan("rename");
      begin();
      t.click("end");
      var r1 = t.stat("webfail") === 5 && t.stat("lost") === 0 && t.stat("made") === 100 && t.stat("type") === "text" && has("Tue 02:40  website 2.8 ships as a fix");
      t.set("web", true);
      t.click("end");
      t.expect(r1 && t.stat("webfail") === 0 && t.stat("type") === "text",
        "RENAME at Mon 18:00: website 2.7 fails 5 times until Tue 02:40; redeployed with it, 0, but move_date is still text");

      // 11. Downtime night: 3 requests turned away; without the website on the list, 18 fail.
      plan("downtime");
      t.click("end");
      var d1 = t.stat("webfail") === 3 && t.stat("lost") === 0 && t.stat("made") === 101 && t.stat("tue") === "40 of 40";
      t.set("web", false);
      t.click("end");
      t.expect(d1 && t.stat("webfail") === 18 && t.stat("made") === 88 && t.stat("lost") === 0,
        "Downtime night: 3 turned away, 101 made; leave the website off the list and 18 fail");

      // 12. Batch size: smaller batches hold locks briefly and run longer.
      plan("story");
      t.set("batch", "100");
      t.click("end");
      var b100 = t.stat("backfill") === "Mon 23:00 to Tue 00:52, 960 batches" && t.stat("lock") === "7 s" && t.stat("lost") === 29;
      t.set("batch", "all");
      t.click("end");
      t.expect(b100 && t.stat("backfill") === "Mon 23:00 to 23:32:05, 1 batch" && t.stat("lock") === "32 min 5 s",
        "Batches of 100: 960 batches to Tue 00:52, 7 s locks; all at once: one 32 min 5 s lock");
    }
  });
})();
