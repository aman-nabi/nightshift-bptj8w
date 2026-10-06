/* sims/s1e10-v1.0.0.js  (published as sims/s1e10.js)
   Case s1e10 "Lost in the Cloud": one region, three availability zones, and a power cut in AZ-b.

   CHANGELOG
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
     and api.rand() only picks whether a dot is a booking or a ticket scan, for the log.
   - "Minutes down" counts simulated time during which no request could be served.
*/
(function () {
  "use strict";

  var SPEED = 120;                    // sim seconds per real second: a minute passes in half a second
  var START_CLOCK = 4 * 3600;         // 04:00:00
  var RATE = 3 / 60;                  // requests per simulated second: 3 a minute
  var OUTAGE_SEC = 85 * 60;           // power returns after 85 minutes (4:12 to 5:37 in the story)
  var BOOT_SEC = 4 * 60;              // servers boot in 4 minutes (5:37 to 5:41)
  var FAILOVER_SEC = 90;              // RDS documents 60 to 120 seconds; the sim uses the middle
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
     texts are "2 app servers" in a 190px box and "standby, in sync" (16 chars, 115px). */
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

  function up(S, z) { return S.power[z] && S.booting[z] <= 0; }

  function healthyApps(S) {
    var out = [];
    for (var z = 0; z < 3; z++) if (S.apps[z] > 0 && up(S, z)) out.push(z);
    return out;
  }

  function dbReady(S) { return S.failoverLeft <= 0 && up(S, S.dbPrimary); }

  function canServe(S) { return healthyApps(S).length > 0 && dbReady(S); }

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

    var calm = S.power[DARK] && S.booting[DARK] <= 0 && S.failoverLeft <= 0;
    S.ctl.apps.disable(!calm);
    S.ctl.db.disable(!calm);
    S.ctl.power.disable(!S.power[DARK]);
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
    var kind = api.rand() < 0.5 ? "booking" : "ticket scan";
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
  }

  /* ---------- events ---------- */

  function cutPower(api) {
    var S = api.state;
    if (!S.power[DARK]) return;
    S.power[DARK] = false;
    S.booting[DARK] = 0;
    S.outLeft = OUTAGE_SEC;
    S.lastNote = "";
    api.log("Power loss in one data center in AZ-b. Everything there stops at once. AZ-a and AZ-c still have power.", "bad");
    if (S.dbPrimary === DARK) {
      if (S.dbStandby !== null && up(S, S.dbStandby)) {
        S.failoverLeft = FAILOVER_SEC;
        S.pending = S.dbStandby;
        api.log("The primary database is in AZ-b. Failover starts: the standby in " + zoneName(S.dbStandby) + " already has every write and will take over.", "warn");
      } else {
        api.log("The only database is in AZ-b, and there's no standby anywhere else.", "bad");
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
    var parts = [];
    if (S.apps[z]) parts.push(S.apps[z] === 1 ? "its app server" : "its app servers");
    if (S.dbPrimary === z) parts.push("the database");
    if (S.dbStandby === z) parts.push("the old primary, now the standby, catching up");
    S.lastNote = "";
    api.log(zoneName(z) + " has booted" + (parts.length ? ": " + parts.join(", ") + " back." : ". Nothing of ours runs there."), "ok");
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
    if (!S.power[DARK]) {
      S.outLeft -= simDt;
      if (S.outLeft <= 0) restorePower(api, true);
    }
    for (var z = 0; z < 3; z++) {
      if (S.power[z] && S.booting[z] > 0) {
        S.booting[z] -= simDt;
        if (S.booting[z] <= 0) { S.booting[z] = 0; booted(api, z); }
      }
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
      if (S.dbPrimary === z) return head + "The primary: every booking is written here. " + (S.dbStandby === null ? "There's no standby, so if this zone goes dark, so does the database." : "A standby in " + zoneName(S.dbStandby) + " gets every write as it happens.");
      if (S.dbStandby === z) return head + "The standby: a copy that receives every write as it happens and takes over by itself, a failover, if the primary's zone goes dark. A managed database service does this for you.";
      return head + "No database here.";
    };
  }

  var INFO = {
    users: function () {
      return "<strong>Passengers and the dock.</strong> Bookings from the website and ticket scans at the dock, 3 requests a minute. Each one needs an app server and the database.";
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
      S.served = 0;
      S.failed = 0;
      S.downSec = 0;
      S.acc = 0;
      S.rr = 0;
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
        down: api.stat("down", "minutes down (simulated)", "warn")
      };
      draw(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("04:00 at Greywater Ferries. Layout: " + layoutText(S) + ". Morning bookings and the first ticket scans are coming in.", "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }

      // 1. Sol's layout works while the power is on.
      await t.run(3);
      var s0 = n("served");
      t.expect(s0 >= 15 && n("failed") === 0 && n("down") === 0, "with power on, Sol's single-zone layout serves every request");

      // 2. Power loss in AZ-b with everything in AZ-b.
      t.click("power");
      await t.run(10);
      t.expect(n("served") === s0 && n("failed") >= 55 && t.node("appb").state === "bad" && t.node("dbb").state === "bad",
        "after the power cut, every request fails: both app servers and the database are in AZ-b");
      t.expect(n("down") >= 19.5 && n("down") <= 20.5, "20 simulated minutes later, the minutes-down counter shows about 20");

      // 3. Power returns: 4 minutes of booting, then serving again.
      t.click("restore");
      await t.run(1);
      t.expect(n("served") === s0 && t.node("appb").state === "warn", "right after power returns, AZ-b's servers are still booting");
      await t.run(3);
      t.expect(n("served") > s0 && t.node("dbb").state === "ok", "after booting, AZ-b serves again");

      // 4. App servers spread out, but a single database in AZ-b.
      t.click("reset");
      t.set("apps", "ac");
      await t.run(1);
      var s1 = n("served");
      t.click("power");
      await t.run(5);
      t.expect(n("served") === s1 && n("failed") > 0 && t.node("appa").state === "ok" && t.node("appc").state === "ok" && t.node("dbb").state === "bad",
        "app servers in AZ-a and AZ-c keep their power, but with the only database in AZ-b every request still fails");

      // 5. Multi-AZ: the standby in AZ-c takes over.
      t.click("reset");
      t.set("apps", "ac");
      t.set("db", "multi");
      await t.run(1);
      var s2 = n("served");
      t.click("power");
      await t.run(10);
      var down = n("down");
      t.expect(down >= 1 && down <= 2 && n("served") > s2 && t.node("dbc").state === "ok" && t.logText().indexOf("Failover done") >= 0,
        "with a standby in AZ-c, the database fails over in about a minute and a half and the site keeps serving");

      // 6. Sol's layout, left alone: 85 minutes without power plus 4 booting.
      t.click("reset");
      t.click("power");
      await t.run(46);
      var d = n("down");
      t.expect(d >= 88.5 && d <= 89.5 && t.node("appb").state === "ok", "left alone, the single-zone layout is down about 89 minutes, like the story's 4:12 to 5:41");
    }
  });
})();
