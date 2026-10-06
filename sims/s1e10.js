/* sims/s1e10-v1.0.1.js  (published as sims/s1e10.js)
   Case s1e10 "Lost in the Cloud": one region, three availability zones, and a power cut in AZ-b.

   CHANGELOG
   v1.0.1 (2026-10-06) review fixes: the single-database layout now follows the story's morning
     exactly. The power goes (press it at 04:12, as on Tuesday; the log says when the clock gets
     there), returns 85 minutes later (05:37), the servers boot in 4 (05:41), and then the single
     database, whose disk was damaged, is rebuilt from the 02:00 snapshot for 84 minutes, so the
     site is back at 07:05, 173 minutes after the cut. Bookings are no longer picked at random: one
     arrives every 12 minutes, as on Tuesday night, so 10 were made between 02:00 and the 04:00
     start and the 11th at 04:06. A new stat, bookings lost, counts the bookings made since the
     02:00 snapshot when the rebuild starts: 11 in the story run, 0 with a standby in AZ-c. Power
     and layout controls stay disabled until the zone is calm again, rebuild included. selfTest:
     the 89-minute check is replaced by the story run (power back 05:37, servers up 05:41, 11
     bookings lost, database back between 07:04 and 07:06, about 173 minutes down); the manual
     restore check now expects the database still rebuilding after the servers boot; the standby
     check adds 0 bookings lost through the whole outage.
   v1.0.0 (2026-10-06) first version: passengers and dock scanners send requests through a load
     balancer to app servers in AZ-a, AZ-b and AZ-c, which use a database. Controls: apps (where the
     two app servers run: both in AZ-b, AZ-a and AZ-b, or AZ-a and AZ-c), db (a single database in
     AZ-b, or a primary in AZ-b with a standby in AZ-c), power (power loss in AZ-b), restore,
     reset. Power returns by itself after 85 simulated minutes and servers take 4 minutes to boot,
     as in the story (4:12, 5:37, 5:41). A standby takes over 90 simulated seconds after its
     primary loses power, the middle of the 60 to 120 seconds RDS documents. Stats: requests
     served, requests failed, simulated minutes down. selfTest covers the single-zone layout going
     dark and coming back, app servers spread but the database not, the Multi-AZ failover, and the
     85 + 4 minute outage left alone.

   Notes for anyone copying this file:
   - Every request's fate is decided the moment it is created; the dot is a slow-motion replay.
   - Deterministic: requests arrive at a fixed rate, the load balancer takes turns (round robin),
     and every 36th request is a booking. api.rand() only picks whether any other request is a
     ticket scan or a timetable check, for the log.
   - "Minutes down" counts simulated time during which no request could be served.
   - The story's timeline, from a cut at 04:12: power back at 05:37 (85 minutes), servers booted at
     05:41 (4 more), database rebuilt from the 02:00 snapshot at 07:05 (84 more). step() handles
     the rebuild countdown before booting, and booting before the outage countdown, so a countdown
     started inside a tick is not also shortened in that tick and the times land on the minute.
*/
(function () {
  "use strict";

  var SPEED = 120;                    // sim seconds per real second: a minute passes in half a second
  var START_CLOCK = 4 * 3600;         // 04:00:00
  var TUESDAY_CUT = 4 * 3600 + 12 * 60; // 04:12:00, when the power went in the story
  var RATE = 3 / 60;                  // requests per simulated second: 3 a minute
  var OUTAGE_SEC = 85 * 60;           // power returns after 85 minutes (4:12 to 5:37 in the story)
  var BOOT_SEC = 4 * 60;              // servers boot in 4 minutes (5:37 to 5:41)
  var REBUILD_SEC = 84 * 60;          // a single database with a damaged disk is rebuilt from the
                                      // 02:00 snapshot in 84 minutes (5:41 to 7:05)
  var FAILOVER_SEC = 90;              // RDS documents 60 to 120 seconds; the sim uses the middle

  /* Bookings. In the story, 11 bookings were made between the 02:00 snapshot and the 04:12 power
     cut: one every 12 minutes, at 02:06, 02:18, ... 03:54 (10 before the sim starts at 04:00) and
     04:06 (the 11th). At 3 requests a minute, every 36th request is a booking, starting with the
     18th (04:06), so the next one is at 04:18. Any cut between 04:06 and 04:18 loses 11. */
  var BOOKINGS_BEFORE_START = 10;
  var BOOKING_EVERY = 36;
  var FIRST_BOOKING = 18;

  var DOT_SPEED = 700;
  var ZONES = ["a", "b", "c"];
  var DARK = 1;                       // the zone that loses power: AZ-b

  var APP_OPTIONS = [
    { value: "bb", label: "Both in AZ-b (Sol's setup)" },
    { value: "ab", label: "One in AZ-a, one in AZ-b" },
    { value: "ac", label: "One in AZ-a, one in AZ-c" }
  ];
  var APP_LAYOUTS = { bb: [0, 2, 0], ab: [1, 1, 0], ac: [1, 0, 1] };

  var DB_OPTIONS = [
    { value: "single", label: "Single database in AZ-b" },
    { value: "multi", label: "Primary in AZ-b, standby in AZ-c" }
  ];

  /* Layout checked at 0.6 x font size per character (label 13px, sub 12px, group 11px). The longest
     texts are "2 app servers" in a 190px box and "rebuilding from 02:00" (21 chars, 151px, inside
     the 190px database box). */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 380,
    aria: "Ferry bookings sim. Passengers and dock scanners send requests to a load balancer, which sends each one to an app server in availability zone AZ-a, AZ-b or AZ-c of the North Coast region. Each zone has room for app servers and a database. AZ-b is the zone that can lose power.",
    groups: [
      { label: "North Coast region", x: 6, y: 150, w: 728, h: 222 },
      { label: "AZ-a", x: 16, y: 178, w: 230, h: 186 },
      { label: "AZ-b", x: 255, y: 178, w: 230, h: 186 },
      { label: "AZ-c", x: 494, y: 178, w: 230, h: 186 }
    ],
    nodes: [
      { id: "users", label: "Passengers + dock", sub: "3 requests a minute", x: 370, y: 34, w: 230, h: 52, shape: "box", tone: "" },
      { id: "lb", label: "Load balancer", sub: "in every zone", x: 370, y: 112, w: 220, h: 52, shape: "box", tone: "" },
      { id: "appa", label: "No app server", sub: "nothing here", x: 131, y: 240, w: 190, h: 52, shape: "box", tone: "muted" },
      { id: "appb", label: "2 app servers", sub: "serving", x: 370, y: 240, w: 190, h: 52, shape: "box", tone: "ok" },
      { id: "appc", label: "No app server", sub: "nothing here", x: 609, y: 240, w: 190, h: 52, shape: "box", tone: "muted" },
      { id: "dba", label: "No database", sub: "nothing here", x: 131, y: 320, w: 190, h: 56, shape: "db", tone: "muted" },
      { id: "dbb", label: "Database", sub: "primary", x: 370, y: 320, w: 190, h: 56, shape: "db", tone: "ok" },
      { id: "dbc", label: "No database", sub: "nothing here", x: 609, y: 320, w: 190, h: 56, shape: "db", tone: "muted" }
    ],
    edges: [
      { from: "users", to: "lb" },
      { from: "lb", to: "appa" },
      { from: "lb", to: "appb" },
      { from: "lb", to: "appc" }
    ]
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function zoneName(z) { return "AZ-" + ZONES[z]; }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function up(S, z) { return S.power[z] && S.booting[z] <= 0; }

  function healthyApps(S) {
    var out = [];
    for (var z = 0; z < 3; z++) if (S.apps[z] > 0 && up(S, z)) out.push(z);
    return out;
  }

  function dbReady(S) { return S.failoverLeft <= 0 && S.rebuildLeft <= 0 && up(S, S.dbPrimary); }

  function canServe(S) { return healthyApps(S).length > 0 && dbReady(S); }

  function calm(S) {
    return S.power[DARK] && S.booting[DARK] <= 0 && S.failoverLeft <= 0 && S.rebuildLeft <= 0;
  }

  function layoutText(S) {
    var where = [];
    for (var z = 0; z < 3; z++) if (S.apps[z]) where.push((S.apps[z] === 2 ? "both in " : "") + zoneName(z));
    return "app servers " + where.join(" and ") + ", " +
      (S.dbStandby === null ? "a single database in " + zoneName(S.dbPrimary) : "primary database in " + zoneName(S.dbPrimary) + " with a standby in " + zoneName(S.dbStandby));
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    for (var z = 0; z < 3; z++) {
      var app = api.node("app" + ZONES[z]);
      var count = S.apps[z];
      if (!count) {
        app.text("label", "No app server");
        app.text("sub", "nothing here");
        app.set("muted");
      } else {
        app.text("label", count === 1 ? "App server" : count + " app servers");
        if (!S.power[z]) { app.text("sub", "no power"); app.set("bad"); }
        else if (S.booting[z] > 0) { app.text("sub", "booting"); app.set("warn"); }
        else { app.text("sub", "serving"); app.set("ok"); }
      }

      var db = api.node("db" + ZONES[z]);
      var role = S.dbPrimary === z ? "primary" : S.dbStandby === z ? "standby" : null;
      if (!role) {
        db.text("label", "No database");
        db.text("sub", "nothing here");
        db.set("muted");
      } else {
        db.text("label", "Database");
        if (!S.power[z]) { db.text("sub", "no power"); db.set("bad"); }
        else if (S.booting[z] > 0) { db.text("sub", "booting"); db.set("warn"); }
        else if (role === "primary" && S.rebuildLeft > 0) { db.text("sub", "rebuilding from 02:00"); db.set("warn"); }
        else if (S.failoverLeft > 0 && S.pending === z) { db.text("sub", "taking over..."); db.set("warn"); }
        else if (role === "primary") { db.text("sub", "primary"); db.set("ok"); }
        else { db.text("sub", "standby, in sync"); db.set("accent"); }
      }
    }
    var apps = healthyApps(S);
    api.node("lb").text("sub", apps.length ? "sends to " + apps.length + (apps.length === 1 ? " zone" : " zones") : "no server answers");
    api.node("lb").set(apps.length ? "" : "bad");

    S.stat.served(S.served);
    S.stat.failed(S.failed);
    S.stat.down((S.downSec / 60).toFixed(1));
    S.stat.lost(S.lost);

    var quiet = calm(S);
    S.ctl.apps.disable(!quiet);
    S.ctl.db.disable(!quiet);
    S.ctl.power.disable(!quiet);
    S.ctl.restore.disable(S.power[DARK]);
  }

  /* ---------- requests ---------- */

  function note(api, key, msg, tone) {
    var S = api.state;
    if (S.lastNote === key) return;
    S.lastNote = key;
    api.log(msg, tone);
  }

  function request(api) {
    var S = api.state;
    S.reqN += 1;
    var other = api.rand() < 0.5 ? "ticket scan" : "timetable check";
    var isBooking = S.reqN >= FIRST_BOOKING && (S.reqN - FIRST_BOOKING) % BOOKING_EVERY === 0;
    var kind = isBooking ? "booking" : other;
    var apps = healthyApps(S);
    if (!apps.length) {
      S.failed += 1;
      api.dot({ path: ["users", "lb"], cls: "dot-fail", r: 4, speed: DOT_SPEED });
      note(api, "noapp", "Requests are failing: no app server has power. A " + kind + " gets no answer at all.", "bad");
      return;
    }
    var z = apps[S.rr % apps.length];
    S.rr += 1;
    var appNode = "app" + ZONES[z];
    var dbNode = "db" + ZONES[S.dbPrimary];
    if (!dbReady(S)) {
      S.failed += 1;
      api.dot({
        path: ["users", "lb", appNode, dbNode], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (d, wp) { if (d && wp === dbNode) d.cls("dot-fail"); }
      });
      if (S.failoverLeft > 0) {
        note(api, "failover", "The app servers are fine, but the database is switching to its standby. Requests fail for now.", "warn");
      } else if (S.rebuildLeft > 0 && up(S, S.dbPrimary)) {
        note(api, "rebuild", "The app servers are back, but the database is still being rebuilt from the 02:00 snapshot. Every request needs it, so every request fails.", "bad");
      } else {
        note(api, "nodb", "The app servers in " + zoneName(z) + " are fine, but the database has no power and no standby. Every request needs it, so every request fails.", "bad");
      }
      return;
    }
    S.served += 1;
    api.dot({
      path: ["users", "lb", appNode, dbNode], cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (d, wp) { if (d && wp === dbNode) d.cls("dot-ok"); }
    });
    note(api, "ok", "Requests are being served: app servers in " + apps.map(zoneName).join(" and ") + ", database in " + zoneName(S.dbPrimary) + ".", "ok");
    if (isBooking) {
      S.sinceSnap += 1;
      api.log("New booking saved: " + plural(S.sinceSnap, "booking") + " since the 02:00 snapshot.", "");
    }
  }

  /* ---------- events ---------- */

  function cutPower(api) {
    var S = api.state;
    if (!calm(S)) return;
    S.power[DARK] = false;
    S.booting[DARK] = 0;
    S.outLeft = OUTAGE_SEC;
    S.everCut = true;
    S.lastNote = "";
    api.log("Power loss in one data center in AZ-b. Everything there stops at once. AZ-a and AZ-c still have power.", "bad");
    if (S.dbPrimary === DARK) {
      if (S.dbStandby !== null && up(S, S.dbStandby)) {
        S.failoverLeft = FAILOVER_SEC;
        S.pending = S.dbStandby;
        api.log("The primary database is in AZ-b. Failover starts: the standby in " + zoneName(S.dbStandby) + " already has every write and will take over.", "warn");
      } else {
        S.dbDamaged = true;
        api.log("The only database is in AZ-b, and there's no standby anywhere else. Its newest backup is the 02:00 snapshot, and " + plural(S.sinceSnap, "booking") + " made since then exist only on its disk.", "bad");
      }
    } else if (S.dbStandby === DARK) {
      api.log("The standby was in AZ-b. The primary in " + zoneName(S.dbPrimary) + " keeps serving, without a standby until power returns.", "warn");
    }
    draw(api);
  }

  function restorePower(api, auto) {
    var S = api.state;
    if (S.power[DARK]) return;
    S.power[DARK] = true;
    S.booting[DARK] = BOOT_SEC;
    S.outLeft = 0;
    S.lastNote = "";
    api.log((auto ? "Power returns to AZ-b after 85 minutes." : "You restore power to AZ-b.") + " Its servers need about 4 minutes to boot.", "warn");
    draw(api);
  }

  function booted(api, z) {
    var S = api.state;
    var damaged = z === DARK && S.dbDamaged && S.dbPrimary === z;
    var parts = [];
    if (S.apps[z]) parts.push(S.apps[z] === 1 ? "its app server" : "its app servers");
    if (S.dbPrimary === z && !damaged) parts.push("the database");
    if (S.dbStandby === z) parts.push("the old primary, now the standby, catching up");
    S.lastNote = "";
    var msg = zoneName(z) + " has booted";
    if (parts.length) msg += ": " + parts.join(", ") + " back.";
    else msg += damaged ? "." : ". Nothing of ours runs there.";
    api.log(msg, "ok");
    if (damaged) {
      S.dbDamaged = false;
      S.rebuildLeft = REBUILD_SEC;
      var gone = S.sinceSnap;
      S.lost += gone;
      S.sinceSnap = 0;
      api.log("The database's disk was damaged in the power cut. It has to be rebuilt from the 02:00 snapshot, which takes 84 minutes, and the " + plural(gone, "booking") + " made after 02:00 are gone.", "bad");
    }
  }

  function finishRebuild(api) {
    var S = api.state;
    S.rebuildLeft = 0;
    S.lastNote = "";
    api.log("The database is back, rebuilt from the 02:00 snapshot. Requests are served again, but the bookings made after 02:00 are not in it.", "ok");
  }

  function finishFailover(api) {
    var S = api.state;
    var old = S.dbPrimary;
    S.dbPrimary = S.pending;
    S.dbStandby = old;
    S.pending = null;
    S.failoverLeft = 0;
    S.lastNote = "";
    api.log("Failover done: " + zoneName(S.dbPrimary) + " is the primary now, after " + FAILOVER_SEC + " seconds. Its DNS name points at the new copy, and nothing written before the power cut is lost.", "ok");
  }

  function setApps(api, v) {
    var S = api.state;
    var layout = APP_LAYOUTS[v];
    if (!layout) return;
    S.apps = layout.slice();
    S.lastNote = "";
    api.log("New layout: " + layoutText(S) + ".", "");
    draw(api);
  }

  function setDb(api, v) {
    var S = api.state;
    S.dbPrimary = DARK;
    S.dbStandby = v === "multi" ? 2 : null;
    S.lastNote = "";
    api.log("New layout: " + layoutText(S) + "." + (v === "multi" ? " The standby gets every write as it happens." : ""), "");
    draw(api);
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.power) return;
    var simDt = dt * api.speed;

    if (S.failoverLeft > 0) {
      S.failoverLeft -= simDt;
      if (S.failoverLeft <= 0) finishFailover(api);
    }
    if (S.rebuildLeft > 0) {
      S.rebuildLeft -= simDt;
      if (S.rebuildLeft <= 0) finishRebuild(api);
    }
    for (var z = 0; z < 3; z++) {
      if (S.power[z] && S.booting[z] > 0) {
        S.booting[z] -= simDt;
        if (S.booting[z] <= 0) { S.booting[z] = 0; booted(api, z); }
      }
    }
    if (!S.power[DARK]) {
      S.outLeft -= simDt;
      if (S.outLeft <= 0) restorePower(api, true);
    }

    if (!S.cued && api.clock >= TUESDAY_CUT) {
      S.cued = true;
      if (!S.everCut) api.log("It's 04:12, the minute the power went on Tuesday. Press Power loss in AZ-b now to replay that morning.", "warn");
    }

    S.acc += RATE * simDt;
    var guard = 0;
    while (S.acc >= 1 && guard++ < 20) { S.acc -= 1; request(api); }

    if (!canServe(S)) S.downSec += simDt;
    draw(api);
  }

  /* ---------- "what is this box" ---------- */

  function appInfo(z) {
    return function (S) {
      var n = S.apps[z];
      var head = "<strong>" + zoneName(z) + ", app servers.</strong> ";
      if (!n) return head + "Nothing of Greywater's runs here. Use <em>App servers</em> to put one here.";
      return head + (n === 1 ? "One app server, a virtual machine" : "Two app servers, both virtual machines") + " in this zone. Each one can carry all the traffic alone. " +
        (!S.power[z] ? "This zone has no power, so the load balancer skips it." : S.booting[z] > 0 ? "Booting after the power cut." : "Serving.");
    };
  }

  function dbInfo(z) {
    return function (S) {
      var head = "<strong>" + zoneName(z) + ", database.</strong> ";
      if (S.dbPrimary === z) {
        if (S.rebuildLeft > 0) return head + "Its disk was damaged in the power cut, so it is being rebuilt from the 02:00 snapshot, a copy of its disk saved at 2:00 AM. Anything written after that copy is gone.";
        return head + "The primary: every booking is written here. " + (S.dbStandby === null
          ? "There's no standby, so if this zone goes dark, so does the database. Its newest backup is the 02:00 snapshot: " + plural(S.sinceSnap, "booking") + " made since then exist only on this disk."
          : "A standby in " + zoneName(S.dbStandby) + " gets every write as it happens.");
      }
      if (S.dbStandby === z) return head + "The standby: a copy that receives every write as it happens and takes over by itself, a failover, if the primary's zone goes dark. A managed database service does this for you.";
      return head + "No database here.";
    };
  }

  var INFO = {
    users: function () {
      return "<strong>Passengers and the dock.</strong> Ticket scans at the dock and timetable checks on the website, 3 requests a minute, with a new booking every 12 minutes, as on Tuesday night. Each one needs an app server and the database.";
    },
    lb: function (S) {
      var apps = healthyApps(S);
      return "<strong>Load balancer.</strong> It sends each request to a healthy app server, taking turns. The cloud company runs it in every zone, so it keeps working when one zone goes dark. Right now it can reach app servers in " + (apps.length ? apps.map(zoneName).join(" and ") : "no zone at all") + ".";
    },
    appa: appInfo(0), appb: appInfo(1), appc: appInfo(2),
    dba: dbInfo(0), dbb: dbInfo(1), dbc: dbInfo(2)
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e10", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.apps = APP_LAYOUTS.bb.slice();
      S.dbPrimary = DARK;
      S.dbStandby = null;
      S.pending = null;
      S.power = [true, true, true];
      S.booting = [0, 0, 0];
      S.outLeft = 0;
      S.failoverLeft = 0;
      S.rebuildLeft = 0;
      S.dbDamaged = false;
      S.served = 0;
      S.failed = 0;
      S.downSec = 0;
      S.sinceSnap = BOOKINGS_BEFORE_START;
      S.lost = 0;
      S.reqN = 0;
      S.acc = 0;
      S.rr = 0;
      S.cued = false;
      S.everCut = false;
      S.lastNote = "";
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.apps = api.control.select("apps", "App servers", APP_OPTIONS, "bb", function (v) { setApps(api, v); });
      S.ctl.db = api.control.select("db", "Database", DB_OPTIONS, "single", function (v) { setDb(api, v); });
      S.ctl.power = api.control.button("power", "Power loss in AZ-b", function () { cutPower(api); }, { tone: "danger", wide: true });
      S.ctl.restore = api.control.button("restore", "Restore power to AZ-b", function () { restorePower(api, false); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        served: api.stat("served", "requests served", "ok"),
        failed: api.stat("failed", "requests failed", "bad"),
        down: api.stat("down", "minutes down (simulated)", "warn"),
        lost: api.stat("lost", "bookings lost", "bad")
      };
      draw(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("04:00 at Greywater Ferries. Layout: " + layoutText(S) + ". The database's newest backup is the 02:00 snapshot, and " + plural(S.sinceSnap, "booking") + " have been made since then. Ticket scans and timetable checks are coming in.", "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }

      // 1. Sol's layout works while the power is on. 6 real seconds take the clock to 04:12.
      await t.run(6);
      var s0 = n("served");
      t.expect(s0 >= 33 && n("failed") === 0 && n("down") === 0 && n("lost") === 0, "with power on, Sol's single-zone layout serves every request");
      t.expect(t.logText().indexOf("11 bookings since the 02:00 snapshot") >= 0,
        "by 04:12, 11 bookings have been made since the 02:00 snapshot, as in the story");

      // 2. Power loss in AZ-b at 04:12 with everything in AZ-b.
      t.click("power");
      await t.run(10);
      t.expect(n("served") === s0 && n("failed") >= 55 && t.node("appb").state === "bad" && t.node("dbb").state === "bad",
        "after the power cut, every request fails: both app servers and the database are in AZ-b");
      t.expect(n("down") >= 19.5 && n("down") <= 20.5, "20 simulated minutes later, the minutes-down counter shows about 20");

      // 3. Left alone, the story's morning: power back at 05:37, servers up at 05:41, the database
      //    rebuilt from the 02:00 snapshot until 07:05, 11 bookings lost.
      await t.run(33);                                   // 05:38
      t.expect(n("served") === s0 && t.node("appb").state === "warn",
        "power returns after 85 minutes, and AZ-b's servers are booting");
      await t.run(3);                                    // 05:44
      t.expect(n("served") === s0 && t.node("appb").state === "ok" && t.node("dbb").state === "warn" && n("lost") === 11,
        "the app servers are back, but the database's disk was damaged: it is being rebuilt from the 02:00 snapshot, and the 11 bookings made since then are lost");
      await t.run(40);                                   // 07:04
      t.expect(n("served") === s0 && t.node("dbb").state === "warn", "at 07:04 the database is still being rebuilt and nothing is served");
      await t.run(1);                                    // 07:06
      var dn = n("down");
      t.expect(n("served") > s0 && t.node("dbb").state === "ok" && n("lost") === 11 && dn >= 172.5 && dn <= 173.5,
        "by 07:06 the site is back, about 173 minutes after the 04:12 cut, with 11 bookings lost, like the story");
      var log = t.logText();
      t.expect(/05:37:\d\d [^\n]*Power returns to AZ-b/.test(log) && /05:41:\d\d [^\n]*AZ-b has booted/.test(log) &&
        /07:05:\d\d [^\n]*rebuilt from the 02:00 snapshot/.test(log),
        "the log matches the story: power at 05:37, servers at 05:41, the database back from the 02:00 snapshot at 07:05");

      // 4. Restoring the power by hand: the servers boot, but the database still needs rebuilding.
      t.click("reset");
      t.click("power");
      await t.run(1);
      t.click("restore");
      await t.run(1);
      t.expect(n("served") === 0 && t.node("appb").state === "warn", "right after power returns, AZ-b's servers are still booting");
      await t.run(3);
      t.expect(n("served") === 0 && t.node("appb").state === "ok" && t.node("dbb").state === "warn",
        "after booting, the app servers are back, but the database is still being rebuilt from the snapshot, so nothing is served");

      // 5. App servers spread out, but a single database in AZ-b.
      t.click("reset");
      t.set("apps", "ac");
      await t.run(1);
      var s1 = n("served");
      t.click("power");
      await t.run(5);
      t.expect(n("served") === s1 && n("failed") > 0 && t.node("appa").state === "ok" && t.node("appc").state === "ok" && t.node("dbb").state === "bad",
        "app servers in AZ-a and AZ-c keep their power, but with the only database in AZ-b every request still fails");

      // 6. Multi-AZ: the standby in AZ-c takes over, and nothing is lost.
      t.click("reset");
      t.set("apps", "ac");
      t.set("db", "multi");
      await t.run(6);
      var s2 = n("served");
      t.click("power");
      await t.run(10);
      var down = n("down");
      t.expect(down >= 1 && down <= 2 && n("served") > s2 && t.node("dbc").state === "ok" && t.logText().indexOf("Failover done") >= 0,
        "with a standby in AZ-c, the database fails over in about a minute and a half and the site keeps serving");
      t.expect(n("lost") === 0, "with a standby, the failover loses no bookings");
      var s3 = n("served");
      await t.run(36);                                   // 05:44: AZ-b had power back at 05:37 and booted at 05:41
      down = n("down");
      t.expect(n("served") > s3 && n("lost") === 0 && down >= 1 && down <= 2 && t.node("dbb").state === "accent",
        "with a standby, the site keeps serving through the whole outage with 0 bookings lost, and AZ-b's copy returns as the standby");
    }
  });
})();
