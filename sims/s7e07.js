/* sims/s7e07-v1.0.0.js  (published as sims/s7e07.js)
   Case s7e07 "Secrets in the Walls": a secrets lab for Eirwen's flower shop in Gowrie, whose
   website code sits in a public repository. Somerled pasted the shop's cloud key into a settings
   file in commit 41 (Thu 19 Mar 2026, 23:47) and deleted it in commit 42 (Fri 20 Mar 2026, 00:03),
   but commit 41 stays in the history. On Tue 13 Oct 2026 at 02:00 the key started 160 computers
   that are not the shop's. The learner replays seven moments, from just before commit 41 to the
   next morning, and chooses when the key is revoked, whether the history is rewritten, whether
   the repository is made private, when secret scanning is on, and whether any new key goes into a
   secrets store.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only: the key is the label KEY-REDACTED, never a
   key string; there is no search code, no attack and no tooling; only events and counts. Every
   number below is given data or worked out from it.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: revoke (never, as found; on the night at 22:30; at the first
     scanner alert); history rewrite (off, on at 22:30); repository public (as found) or private
     from 22:30; secret scanning (off, as found; on from tonight; on from the start); secrets store
     for any new key (off, on). Buttons: next moment, run to morning, start again, reset.
     selfTest: 10 assertions.

   The model (stated in sim.lede, the post and the comments):
   - The repository is public. It holds 214 commits over 227 days, 1 Mar to 13 Oct 2026 (given
     data). 40 commits come before commit 41.
   - Commit 41, Thu 19 Mar 2026 23:47: the key is pasted into a settings file. Commit 42, Fri 20 Mar
     2026 00:03: the line is deleted. Commit 41 still holds the key unless the history is
     rewritten.
   - The key has every right of the account, starting computers included (it was made from the
     account's main login, and the pipeline uses it to start the rented computer).
   - First misuse, Tue 13 Oct 2026 02:00: the key starts 160 computers (given data). They run until
     the key is revoked; revoking also stops the computers it started (the post and the explain
     section say both are done together). Price: $1.25 per computer-hour (fictional, given data),
     so $200 an hour while they run.
   - The cloud company bills early when a month's computing reaches $4,000: Tue 13 Oct 22:00, after
     20 hours.
   - Revoke "on the night" is at 22:30, when Somerled acts. Revoke "at the first scanner alert" is at
     the alert: 19 Mar 23:47 with scanning on from the start (it flags commit 41 as it arrives),
     22:30 with scanning on from tonight (it checks the whole history then), never with it off.
   - Rewrite and private take effect at 22:30. Neither changes whether the key works.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e07-v1.0.0.json):
   - Invoice at 22:00: 02:00 to 22:00 is 20 h; 160 x 20 = 3,200 computer-hours; x $1.25 = $4,000.00.
   - Revoked at 22:30: 20.5 h; 160 x 20.5 = 3,280 computer-hours; $4,100.00.
   - Never revoked, to Wed 14 Oct 06:00: 28 h; 160 x 28 = 4,480 computer-hours; $5,600.00.
   - Revoked at the alert with scanning on from the start (19 Mar 23:47): 0 computer-hours, $0.00.
   - Options: 0 (ok) revoke on the night, store on: 3,280, $4,100.00, new keys (one per job: photo
     uploads, pipeline) in the secrets store;
     1 rewrite, never revoked: 4,480, $5,600.00, commit 41 no longer holds it, key valid;
     2 scanning on from tonight, never revoked: flagged at 22:30, 4,480, $5,600.00, key valid;
     3 private, never revoked: 4,480, $5,600.00, key valid.
*/
(function () {
  "use strict";

  var MIN = 60000;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var COMPUTERS = 160;
  var RATE_CENTS = 125;                       // $1.25 per computer-hour
  var T_OPEN = Date.UTC(2026, 2, 19, 23, 40);  // before commit 41
  var T_C41 = Date.UTC(2026, 2, 19, 23, 47);
  var T_C42 = Date.UTC(2026, 2, 20, 0, 3);
  var T_USE = Date.UTC(2026, 9, 13, 2, 0);     // first misuse
  var T_BILL = Date.UTC(2026, 9, 13, 22, 0);   // early invoice
  var T_NIGHT = Date.UTC(2026, 9, 13, 22, 30); // Somerled acts
  var T_MORN = Date.UTC(2026, 9, 14, 6, 0);
  var MOMENTS = [T_OPEN, T_C41, T_C42, T_USE, T_BILL, T_NIGHT, T_MORN];
  var LAST = MOMENTS.length - 1;
  var COMMITS = [40, 41, 42, 214, 214, 214, 214];

  var REVOKE = [
    { value: "never", label: "never (as found)" },
    { value: "night", label: "on the night, at 22:30" },
    { value: "alert", label: "at the first scanner alert" }
  ];
  var SCAN = [
    { value: "off", label: "off (as found)" },
    { value: "tonight", label: "on from tonight, 22:30" },
    { value: "start", label: "on from the start" }
  ];
  var VIS = [
    { value: "public", label: "public (as found)" },
    { value: "private", label: "private from 22:30" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function num(n) { return n >= 1000 ? fmt(n) : n; }
  function money(cents) { return "$" + fmt(Math.floor(cents / 100)) + "." + ("0" + (cents % 100)).slice(-2); }
  function when(t) {
    var x = new Date(t);
    var hh = ("0" + x.getUTCHours()).slice(-2);
    var mm = ("0" + x.getUTCMinutes()).slice(-2);
    return WEEKDAYS[x.getUTCDay()] + " " + x.getUTCDate() + " " + MONTHS[x.getUTCMonth()] + " " + x.getUTCFullYear() + ", " + hh + ":" + mm;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function alertAt(C) {
    if (C.scan === "start") return T_C41;
    if (C.scan === "tonight") return T_NIGHT;
    return null;
  }
  function revokeAt(C) {
    if (C.revoke === "night") return T_NIGHT;
    if (C.revoke === "alert") return alertAt(C);
    return null;
  }
  // Minutes the strangers' computers have run by time t.
  function runMinutes(C, t) {
    var r = revokeAt(C);
    if (r !== null && r <= T_USE) return 0;
    var end = r === null ? t : Math.min(r, t);
    return end > T_USE ? (end - T_USE) / MIN : 0;
  }
  function results(C, k) {
    var t = MOMENTS[k];
    var r = revokeAt(C);
    var revoked = r !== null && r <= t;
    var mins = runMinutes(C, t);
    var hours = COMPUTERS * mins / 60;
    var running = !revoked && t >= T_USE ? COMPUTERS : 0;
    var a = alertAt(C);
    var holding = t < T_C41 ? 0 : (C.rewrite && t >= T_NIGHT ? 0 : 1);
    return {
      now: when(t),
      commits: COMMITS[k],
      holding: holding,
      key: t < T_C41 ? "valid, not in any commit" : (revoked ? "revoked" : "valid"),
      vis: C.vis === "private" && t >= T_NIGHT ? "private" : "public",
      scanner: C.scan === "off" ? "off" : (a !== null && a <= t ? "flagged commit 41, " + when(a) : "on from 22:30 tonight"),
      running: running,
      hours: num(hours),
      hoursN: hours,
      perHour: money(running * RATE_CENTS),
      cost: money(hours * RATE_CENTS),
      newKey: revoked ? (C.store ? "the secrets store" : "a file on the rented computer") : "no new keys"
    };
  }

  /* ---------- log lines (the self-test reads these exact strings) ---------- */

  function line(C, k) {
    var t = MOMENTS[k];
    var R = results(C, k);
    var r = revokeAt(C);
    var out = [];
    if (k === 1) {
      out.push([when(t) + ". Commit 41: the cloud key, KEY-REDACTED, is pasted into a settings file. The repository is public.", "bad"]);
      if (C.scan === "start") out.push([when(t) + ". Secret scanning flags commit 41 and raises an alert.", "warn"]);
      if (r === T_C41) out.push([when(t) + ". The key is revoked at the alert. New keys are made, one per job, kept in " + R.newKey + ".", "ok"]);
    } else if (k === 2) {
      out.push([when(t) + ". Commit 42, \"remove key\": the line is deleted from the newest version. Commit 41 still holds the key.", "warn"]);
    } else if (k === 3) {
      if (r !== null && r <= T_USE) out.push([when(t) + ". The old key is tried from an address that is not ours. It is refused: it was revoked. 0 computers start.", "ok"]);
      else out.push([when(t) + ". KEY-REDACTED starts " + COMPUTERS + " computers from an address that is not ours. Cost per hour now " + R.perHour + ".", "bad"]);
    } else if (k === 4) {
      if (R.hoursN > 0) out.push([when(t) + ". Invoice for 1 to 13 Oct: " + R.hours + " computer-hours at $1.25, " + R.cost + ". Still running: " + R.running + " computers.", "bad"]);
      else out.push([when(t) + ". No invoice: this month's computing is $0.00.", "ok"]);
    } else if (k === 5) {
      var before = results(C, 4);
      out.push([when(t) + ". Before tonight's changes: key " + before.key + ", " + before.running + " computers running, history public.", ""]);
      if (C.scan === "tonight") out.push([when(t) + ". Secret scanning turned on: it checks all 214 commits, flags commit 41 and raises an alert.", "warn"]);
      if (C.rewrite) out.push([when(t) + ". History rewritten: commit 41 no longer holds the key. Copies made before tonight still do.", "warn"]);
      if (C.vis === "private") out.push([when(t) + ". Repository made private: strangers can no longer read it. The key is unchanged.", "warn"]);
      if (r === T_NIGHT) out.push([when(t) + ". The key is revoked and the " + COMPUTERS + " computers it started are stopped. New keys are made, one per job, kept in " + R.newKey + ".", "ok"]);
      out.push([when(t) + ". Key " + R.key + ". Computer-hours billed " + R.hours + ", " + R.cost + ". Cost per hour now " + R.perHour + ".", R.running ? "bad" : "ok"]);
    } else if (k === 6) {
      out.push([when(t) + ". Morning. Key " + R.key + ". Computer-hours billed " + R.hours + ", " + R.cost + ". Commits holding the old key: " + R.holding + ".", R.running ? "bad" : "ok"]);
    }
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

  var NAMES = ["before commit 41", "commit 41, key pasted in", "commit 42, line deleted", "first misuse", "early invoice", "tonight's changes", "next morning"];

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = results(C, S.pos);
    var ui = S.ui;
    ui.head.textContent = "Revoke: " + C.revoke + ". History rewrite " + (C.rewrite ? "on" : "off") + ". Repository " + C.vis +
      ". Secret scanning " + C.scan + ". Secrets store for any new key " + (C.store ? "on" : "off") + ". Replayed to " + R.now + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["moment", "when", "key", "computer-hours"], true);
    for (var k = 0; k <= LAST; k++) {
      if (k > S.pos) { row(ui, [NAMES[k], when(MOMENTS[k]), "-", "-"]); continue; }
      var Q = results(C, k);
      row(ui, [NAMES[k], Q.now, Q.key, String(Q.hours)]);
    }
    ui.foot.textContent = "Commits holding the old key: " + R.holding + " of " + R.commits + ". Cost per hour now " + R.perHour + ". New keys kept in: " + R.newKey + ".";
    S.stat.now(R.now);
    S.stat.commits(R.commits);
    S.stat.holding(R.holding);
    S.stat.key(R.key);
    S.stat.vis(R.vis);
    S.stat.scanner(R.scanner);
    S.stat.running(R.running);
    S.stat.hours(R.hours);
    S.stat.perHour(R.perHour);
    S.stat.cost(R.cost);
    S.stat.newKey(R.newKey);
    S.ctl.next.disable(S.pos >= LAST);
    S.ctl.all.disable(S.pos >= LAST);
  }

  function step(api) {
    var S = api.state;
    S.pos += 1;
    line(S.C, S.pos).forEach(function (x) { api.log(x[0], x[1]); });
  }

  function run(api, steps) {
    var S = api.state;
    var n = 0;
    while (S.pos < LAST && n < steps) { step(api); n += 1; }
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.pos = 0;
    api.log((why ? why + " " : "") + when(T_OPEN) + ", before commit 41. The repository is public and holds 40 commits. The cloud key, KEY-REDACTED, is in no commit yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { revoke: "never", rewrite: false, vis: "public", scan: "off", store: false };
      S.pos = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function bool(v) { return !!v; }
      S.ctl.revoke = api.control.select("revoke", "Revoke the key (and stop what it started)", REVOKE, "never", opt("revoke", String));
      S.ctl.rewrite = api.control.toggle("rewrite", "Rewrite the history at 22:30, without the key", false, opt("rewrite", bool));
      S.ctl.vis = api.control.select("vis", "Repository", VIS, "public", opt("vis", String));
      S.ctl.scan = api.control.select("scan", "Secret scanning", SCAN, "off", opt("scan", String));
      S.ctl.store = api.control.toggle("store", "Secrets store for any new key", false, opt("store", bool));
      S.ctl.next = api.control.button("next", "Next moment", function () { run(api, 1); });
      S.ctl.all = api.control.button("all", "Run to morning, 06:00", function () { run(api, LAST); });
      S.ctl.again = api.control.button("again", "Start again", function () { restart(api, "New run."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "replayed to", ""),
        commits: api.stat("commits", "commits in the repository", ""),
        holding: api.stat("holding", "commits holding the old key", "warn"),
        key: api.stat("key", "the old key", "bad"),
        vis: api.stat("vis", "repository", ""),
        scanner: api.stat("scanner", "secret scanning", ""),
        running: api.stat("running", "strangers' computers running", "bad"),
        hours: api.stat("hours", "computer-hours billed", "bad"),
        perHour: api.stat("perHour", "cost per hour now", "warn"),
        cost: api.stat("cost", "running cost", "bad"),
        newKey: api.stat("newKey", "new keys kept in", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one moment in the story, from just before commit 41 to the next morning. The table shows, for each moment, whether the old key still works and the computer-hours billed so far. The cost grows by $200 an hour while the 160 computers run, and stops only when the key is revoked (which also stops what it started). Rewriting the history and making the repository private change who can read commit 41, not whether the key works. The key is the label KEY-REDACTED, never a real key.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before commit 41, as found.
      t.expect(t.stat("now") === "Thu 19 Mar 2026, 23:40" && t.stat("commits") === 40 && t.stat("holding") === 0 &&
        t.stat("key") === "valid, not in any commit" && t.stat("hours") === 0 && t.stat("cost") === "$0.00" &&
        t.stat("vis") === "public" && t.stat("scanner") === "off",
        "Opens on Thu 19 Mar 2026, 23:40: 40 commits, no key in any commit, nothing billed");

      // 2. Commit 41 then commit 42: the key stays in the history.
      t.click("next");
      t.click("next");
      t.expect(t.stat("commits") === 42 && t.stat("holding") === 1 && t.stat("key") === "valid" &&
        has("Thu 19 Mar 2026, 23:47. Commit 41: the cloud key, KEY-REDACTED, is pasted into a settings file. The repository is public.") &&
        has("Fri 20 Mar 2026, 00:03. Commit 42, \"remove key\": the line is deleted from the newest version. Commit 41 still holds the key."),
        "Commit 42 deletes the line, but commit 41 still holds the key");

      // 3. As found, to the morning: the invoice at 22:00 and the bill still growing.
      t.click("all");
      t.expect(t.stat("now") === "Wed 14 Oct 2026, 06:00" && t.stat("commits") === 214 && t.stat("key") === "valid" &&
        t.stat("running") === 160 && t.stat("hours") === "4,480" && t.stat("cost") === "$5,600.00" && t.stat("perHour") === "$200.00" &&
        has("Tue 13 Oct 2026, 02:00. KEY-REDACTED starts 160 computers from an address that is not ours. Cost per hour now $200.00.") &&
        has("Tue 13 Oct 2026, 22:00. Invoice for 1 to 13 Oct: 3,200 computer-hours at $1.25, $4,000.00. Still running: 160 computers."),
        "As found: invoice of 3,200 computer-hours, $4,000.00 at 22:00; never revoked, 4,480 and $5,600.00 by 06:00");

      // 4. Option 0 (ok): revoke on the night, secrets store on. The cost stops at 22:30 and stays.
      t.set("revoke", "night");
      t.set("store", true);
      t.click("next"); t.click("next"); t.click("next"); t.click("next"); t.click("next");
      var at2230 = t.stat("hours") === "3,280" && t.stat("cost") === "$4,100.00";
      t.click("all");
      t.expect(at2230 && t.stat("hours") === "3,280" && t.stat("cost") === "$4,100.00" && t.stat("key") === "revoked" &&
        t.stat("running") === 0 && t.stat("perHour") === "$0.00" && t.stat("newKey") === "the secrets store" &&
        has("Tue 13 Oct 2026, 22:30. The key is revoked and the 160 computers it started are stopped. New keys are made, one per job, kept in the secrets store."),
        "Revoke at 22:30 with a secrets store: 3,280 computer-hours, $4,100.00, nothing more by morning, new key in the store");

      // 5. Revoke on the night without a store: the same bill, but the new key sits in a file.
      t.set("store", false);
      t.click("all");
      t.expect(t.stat("hours") === "3,280" && t.stat("newKey") === "a file on the rented computer" && t.stat("holding") === 1,
        "Revoke without a store: same bill, new key typed into a file, commit 41 still holds the dead key");

      // 6. Option 1: rewrite the history, never revoke.
      t.set("revoke", "never");
      t.set("rewrite", true);
      t.click("all");
      t.expect(t.stat("holding") === 0 && t.stat("key") === "valid" && t.stat("hours") === "4,480" && t.stat("cost") === "$5,600.00" &&
        has("Tue 13 Oct 2026, 22:30. History rewritten: commit 41 no longer holds the key. Copies made before tonight still do."),
        "Rewrite only: commit 41 no longer holds the key, but it is still valid: 4,480 computer-hours, $5,600.00");

      // 7. Option 2: secret scanning from tonight, never revoke.
      t.set("rewrite", false);
      t.set("scan", "tonight");
      t.click("all");
      t.expect(t.stat("scanner") === "flagged commit 41, Tue 13 Oct 2026, 22:30" && t.stat("key") === "valid" &&
        t.stat("hours") === "4,480" && t.stat("perHour") === "$200.00",
        "Scanning from tonight: commit 41 flagged at 22:30, but the key still works and the bill grows");

      // 8. Option 3: private repository, never revoke.
      t.set("scan", "off");
      t.set("vis", "private");
      t.click("all");
      t.expect(t.stat("vis") === "private" && t.stat("key") === "valid" && t.stat("cost") === "$5,600.00",
        "Private from 22:30: fewer readers, same live key, $5,600.00 by morning");

      // 9. Scanning from the start, revoked at the first alert: nothing to bill.
      t.set("vis", "public");
      t.set("scan", "start");
      t.set("revoke", "alert");
      t.click("all");
      t.expect(t.stat("hours") === 0 && t.stat("cost") === "$0.00" && t.stat("key") === "revoked" &&
        t.stat("scanner") === "flagged commit 41, Thu 19 Mar 2026, 23:47" &&
        has("Tue 13 Oct 2026, 02:00. The old key is tried from an address that is not ours. It is refused: it was revoked. 0 computers start."),
        "Scanning from the start and revoking at the alert: flagged at 23:47 on 19 Mar, 0 computer-hours");

      // 10. Revoke at the alert with scanning off: no alert ever comes.
      t.set("scan", "off");
      t.click("all");
      t.expect(t.stat("key") === "valid" && t.stat("hours") === "4,480",
        "Revoke at the alert, scanning off: no alert, the key is never revoked, 4,480 computer-hours");
    }
  });
})();
