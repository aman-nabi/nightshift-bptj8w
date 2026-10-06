/* sims/s1e05-v1.0.0.js  (published as sims/s1e05.js)
   Case s1e05 "The Padlock": customers connecting to the pharmacy through the three TLS checks.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: a customer's browser and the refill app connect to the pharmacy
     server through the TLS checks (chain, name, date). The chain runs from Northgate Root through
     Northgate Trust CA. An ACME client can renew the certificate by itself. Controls: visit, app,
     advance (skip ahead 30 days), renew (by hand, 200 days), autorenew (toggle), cert (which
     certificate the server presents: the real one, one for the wrong name, a self-signed one), reset.
     Stats: secure connections, browser warnings, failed app connections. selfTest covers expiry at
     midnight, manual renewal, the name and chain checks, auto-renew over 180 days, the limit of
     auto-renew, and a manual certificate running out.

   Notes for anyone copying this file:
   - Sim time is seconds since Monday 5 October 2026, 00:00, local time with no time zones. The clock
     starts at 23:45 and runs 60 times faster than real life, so the story's certificate expires
     15 real seconds after the sim starts. The clock line shows the time of day; the Calendar box
     shows the date.
   - Every check is decided the moment a customer connects. The dot is a slow-motion replay of a
     handshake that really takes milliseconds.
   - Automatic customers use api.rand(), so self-tests see the same customers every run. Only manual
     visits and changes in outcome are logged, so the log stays readable.
   - Lifetimes follow the 2026 rules: 200 days at most for a certificate bought by hand (since
     15 March 2026), 90 days for a free ACME certificate, renewed with 30 days left.
*/
(function () {
  "use strict";

  var NAME = "larkspurrx.com";
  var DAY = 86400;
  var START = 23 * 3600 + 45 * 60;     // Mon 5 Oct 2026, 23:45
  var EXPIRY = DAY;                     // Tue 6 Oct 2026, 00:00
  var ISSUED = -364 * DAY;              // Mon 6 Oct 2025, 00:00
  var SPEED = 60;                       // sim seconds per real second
  var MANUAL_DAYS = 200;                // longest public certificate allowed since 15 March 2026
  var ACME_DAYS = 90;                   // a free ACME certificate in 2026
  var RENEW_LEFT = 30;                  // the ACME client renews with 30 days left (two thirds through)
  var WARN_LEFT = 14;                   // days left at which the server box turns amber
  var SKIP_DAYS = 30;
  var TRAFFIC_EVERY = 1.4;              // real seconds between automatic customers
  var APP_SHARE = 0.3;                  // share of customers using the refill app
  var DOT_SPEED = 520;                  // viewBox units per real second
  var MID = " " + String.fromCharCode(0xB7) + " ";   // middle dot, keeps the source plain ASCII

  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var EPOCH_MS = Date.UTC(2026, 9, 5);  // Monday 5 October 2026, 00:00 (UTC math only, so no time zones)

  var CERT_OPTIONS = [
    { value: "right", label: "larkspurrx.com (the real one)" },
    { value: "wrongname", label: "test.larkspurrx.com (wrong name)" },
    { value: "selfsigned", label: "self-signed (no CA)" }
  ];

  /* Layout: who signs on top, who connects on the left, the checks in the middle, the server and its
     ACME client on the right. Widths checked at 0.6 x font size per character (label 13px, sub 12px,
     meta 11px, edge labels 11px), including the longest text each box can show. */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 420,
    aria: "TLS sim. A customer's browser and the refill app connect through the TLS checks to the pharmacy server. Northgate Root signs Northgate Trust CA, which signs the server's certificate. An ACME client next to the server can renew the certificate. A calendar shows the date.",
    groups: [
      { label: "Certificate authorities", x: 240, y: 8, w: 490, h: 96 }
    ],
    nodes: [
      { id: "cal", label: "Calendar", sub: "Mon 5 Oct 2026", x: 110, y: 60, w: 180, h: 52, shape: "box", tone: "" },
      { id: "root", label: "Northgate Root", sub: "in the trust list", x: 345, y: 60, w: 190, h: 52, shape: "box", tone: "" },
      { id: "inter", label: "Northgate Trust CA", sub: "signs site certs", x: 620, y: 60, w: 200, h: 52, shape: "box", tone: "" },
      { id: "browser", label: "Customer's browser", sub: "a person", x: 110, y: 200, w: 180, h: 52, shape: "box", tone: "" },
      { id: "app", label: "Refill app", sub: "a program", x: 110, y: 330, w: 180, h: 52, shape: "box", tone: "" },
      { id: "checks", label: "TLS checks", sub: "chain ?" + MID + "name ?", meta: "date ?", x: 345, y: 265, w: 180, h: 62, shape: "box", tone: "" },
      { id: "server", label: "Pharmacy server", sub: "cert: " + NAME, meta: "expires in 15m", x: 620, y: 265, w: 200, h: 62, shape: "box", tone: "warn" },
      { id: "acme", label: "ACME client", sub: "auto-renew: off", meta: "renews: never", x: 620, y: 375, w: 200, h: 62, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "root", to: "inter", label: "signs" },
      { from: "inter", to: "server", label: "signs" },
      { from: "browser", to: "checks" },
      { from: "app", to: "checks" },
      { from: "checks", to: "server", label: "handshake" },
      { from: "acme", to: "server", label: "renews" }
    ]
  };

  /* ---------- small helpers ---------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function dateText(sec) {
    var d = new Date(EPOCH_MS + Math.floor(sec / DAY) * DAY * 1000);
    return WEEKDAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  function timeText(sec) {
    var s = ((Math.floor(sec) % DAY) + DAY) % DAY;
    return pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60));
  }

  function dateTime(sec) { return dateText(sec) + ", " + timeText(sec); }

  // Time left on a certificate, rounded up, short enough for the server box ("200d", "5h", "15m").
  function leftText(sec) {
    if (sec >= DAY) return Math.ceil(sec / DAY - 1e-9) + "d";
    if (sec >= 3600) return Math.ceil(sec / 3600 - 1e-9) + "h";
    return Math.max(1, Math.ceil(sec / 60 - 1e-9)) + "m";
  }

  // Time since expiry, rounded down ("3d", "2h", "0m").
  function agoText(sec) {
    if (sec >= DAY) return Math.floor(sec / DAY) + "d";
    if (sec >= 3600) return Math.floor(sec / 3600) + "h";
    return Math.floor(sec / 60) + "m";
  }

  function realCert(kind, from, days) {
    return {
      kind: kind,
      name: NAME,
      issuer: kind === "acme" ? "a free ACME CA" : "Northgate Trust CA",
      chained: true,
      from: from,
      until: from + days * DAY
    };
  }

  function presented(S) { return S.installed === "right" ? S.real : S.other; }

  function check(cert, now) {
    return { chain: !!cert.chained, name: cert.name === NAME, date: now >= cert.from && now < cert.until };
  }

  function passed(r) { return r.chain && r.name && r.date; }

  function failList(r, cert, now) {
    var out = [];
    if (!r.chain) out.push("Chain check failed: it's self-signed, so no chain leads to a trusted root");
    if (!r.name) out.push("Name check failed: it's for " + cert.name + ", not " + NAME);
    if (!r.date) {
      out.push(now >= cert.until
        ? "Date check failed: it expired " + dateTime(cert.until)
        : "Date check failed: it isn't valid until " + dateTime(cert.from));
    }
    return out.join(". ");
  }

  // Write node text and state only when they change (refresh runs every frame).
  function show(api, id, line, value) {
    var S = api.state;
    var key = id + "." + line;
    if (S.shown[key] === value) return;
    S.shown[key] = value;
    api.node(id).text(line, value);
  }

  function setState(api, id, state) {
    var S = api.state;
    if (S.states[id] === state) return;
    S.states[id] = state;
    api.node(id).set(state);
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.secure(S.count.secure);
    S.stat.warnings(S.count.warnings);
    S.stat.failed(S.count.failed);
  }

  function mark(ok) { return ok ? "ok" : "FAIL"; }

  /* ---------- the ACME client ---------- */

  // Renews every time the certificate it manages reaches 30 days left, from the moment auto-renew was
  // switched on. Run on every frame and after every jump, so a 30-day skip can't slip past a renewal.
  function acmeCatchUp(api) {
    var S = api.state;
    if (!S.auto) return;
    for (var guard = 0; guard < 100; guard++) {
      var due = Math.max(S.real.until - RENEW_LEFT * DAY, S.autoSince);
      if (due > api.clock) return;
      S.real = realCert("acme", due, ACME_DAYS);
      S.renewals += 1;
      var other = S.installed !== "right";
      api.log("ACME client: renewed " + NAME + " on " + dateTime(due) + ", " + ACME_DAYS + " days, until " +
        dateText(S.real.until) + ". Nobody touched it." +
        (other ? " But the server is still presenting the other certificate you installed by hand." : ""),
        other ? "warn" : "ok");
    }
  }

  /* ---------- the picture ---------- */

  function refresh(api) {
    var S = api.state;
    acmeCatchUp(api);
    var now = api.clock;
    var cert = presented(S);
    var r = check(cert, now);

    show(api, "cal", "sub", dateText(now));
    show(api, "server", "sub", "cert: " + cert.name);
    var meta;
    if (!cert.chained) meta = "self-signed";
    else if (cert.name !== NAME) meta = "wrong name";
    else if (now >= cert.until) meta = "expired " + agoText(now - cert.until) + " ago";
    else if (now < cert.from) meta = "not valid yet";
    else meta = "expires in " + leftText(cert.until - now);
    show(api, "server", "meta", meta);
    setState(api, "server", !passed(r) ? "bad" : cert.until - now <= WARN_LEFT * DAY ? "warn" : "ok");
    api.edge("checks", "server").set(passed(r) ? "" : "cut");

    show(api, "acme", "sub", "auto-renew: " + (S.auto ? "on" : "off"));
    show(api, "acme", "meta", S.auto ? "next: " + dateText(Math.max(S.real.until - RENEW_LEFT * DAY, now)) : "renews: never");
    setState(api, "acme", S.auto ? "ok" : "muted");

    // The story's moment: the certificate runs out while you watch.
    if (S.real.until <= now && S.expiryLogged !== S.real) {
      S.expiryLogged = S.real;
      api.log(dateTime(S.real.until) + ". The certificate for " + NAME + " has expired. Nothing on the server changed, but from now on every date check fails.", "bad");
    }
  }

  function showChecks(api, r) {
    show(api, "checks", "sub", "chain " + mark(r.chain) + MID + "name " + mark(r.name));
    show(api, "checks", "meta", "date " + mark(r.date));
    setState(api, "checks", passed(r) ? "ok" : "bad");
  }

  /* ---------- customers ---------- */

  function visit(api, who, manual) {
    var S = api.state;
    var now = api.clock;
    var cert = presented(S);
    var r = check(cert, now);
    var ok = passed(r);
    var browser = who === "browser";

    if (ok) S.count.secure += 1;
    else if (browser) S.count.warnings += 1;
    else S.count.failed += 1;
    updateStats(api);
    showChecks(api, r);

    var outcome = ok ? "ok" : browser ? "warn" : "bad";
    if (manual || S.lastOutcome[who] !== outcome) {
      var whoText = browser ? "A customer's browser" : "The refill app";
      var msg = ok
        ? whoText + " connects. Chain ok, name ok, date ok: " +
          (browser ? "the padlock shows and the order goes through encrypted." : "the refill goes through encrypted.")
        : whoText + " connects. " + failList(r, cert, now) + ". " +
          (browser ? "The browser shows the red warning page." : "No page to show: the app just reports an error and gives up.");
      api.log(msg, outcome);
    }
    S.lastOutcome[who] = outcome;

    var arrivals = 0;
    api.dot({
      path: [who, "checks", "server", "checks", who],
      cls: "dot-req",
      r: 5,
      speed: DOT_SPEED,
      onArrive: function (d) {
        arrivals += 1;
        if (arrivals === 3 && d) d.cls(ok ? "dot-ok" : "dot-fail");
      }
    });
  }

  /* ---------- controls ---------- */

  function renew(api) {
    var S = api.state;
    S.real = realCert("manual", api.clock, MANUAL_DAYS);
    S.installed = "right";
    S.ctl.cert.set("right");
    api.log("You buy a new certificate from Northgate and install it by hand. The longest allowed since March 2026 is " +
      MANUAL_DAYS + " days, so it lasts until " + dateTime(S.real.until) + ".", "ok");
    refresh(api);
  }

  function install(api, v) {
    var S = api.state;
    var now = api.clock;
    if (v === "right") {
      S.installed = "right";
      api.log("You put the real " + NAME + " certificate back on the server.", "");
    } else if (v === "wrongname") {
      S.installed = "wrongname";
      S.other = { kind: "wrongname", name: "test." + NAME, issuer: "Northgate Trust CA", chained: true, from: now - 30 * DAY, until: now + 170 * DAY };
      api.log("You install the certificate from Dev's test server, made for test." + NAME + ". Good chain, good dates, wrong name.", "warn");
    } else if (v === "selfsigned") {
      S.installed = "selfsigned";
      S.other = { kind: "selfsigned", name: NAME, issuer: NAME + " itself", chained: false, from: now - DAY, until: now + 365 * DAY };
      api.log("You install a self-signed certificate: right name, good dates, but no CA signed it, so no chain leads to a trusted root.", "warn");
    } else {
      return;
    }
    refresh(api);
  }

  function setAuto(api, on) {
    var S = api.state;
    S.auto = !!on;
    if (S.auto) {
      S.autoSince = api.clock;
      api.log("Auto-renew on. The ACME client will get a new " + ACME_DAYS + "-day certificate whenever " + RENEW_LEFT + " days or fewer are left.", "");
    } else {
      api.log("Auto-renew off. From now on, renewing is somebody's job again.", "warn");
    }
    refresh(api);
  }

  function advance(api) {
    var S = api.state;
    var before = api.clock;
    var wasValid = S.real.until > before;
    api.clock = before + SKIP_DAYS * DAY;
    acmeCatchUp(api);
    var now = api.clock;
    var msg = "You skip ahead " + SKIP_DAYS + " days to " + dateText(now) + ". ";
    var tone = "";
    if (S.real.until <= now) {
      msg += wasValid ? "The certificate for " + NAME + " expired on " + dateTime(S.real.until) + "." : "The certificate for " + NAME + " is still expired.";
      tone = "bad";
      S.expiryLogged = S.real;
    } else {
      msg += "The certificate for " + NAME + " has " + leftText(S.real.until - now) + " left.";
      if (S.real.until - now <= WARN_LEFT * DAY) tone = "warn";
    }
    api.log(msg, tone);
    refresh(api);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    cal: function (S, now) {
      return "<strong>Calendar.</strong> Today's date in the sim. The clock at the top shows the time of day and runs 60 times faster than real life. <em>Skip ahead 30 days</em> jumps the calendar. Right now: " + dateTime(now) + ".";
    },
    root: function () {
      return "<strong>Northgate Root (root certificate).</strong> Built into the customer's browser and phone. It's trusted without anyone vouching for it. Every chain the browser accepts must end at a root on its list.";
    },
    inter: function () {
      return "<strong>Northgate Trust CA (intermediate).</strong> Signed by the root. It signs websites' certificates day to day, so the root's key can stay locked away. Free ACME certificates come from a different CA, whose root is on the same list.";
    },
    browser: function () {
      return "<strong>Customer's browser.</strong> A person is looking at it. When a check fails, the browser stops before sending anything and shows a full red warning page, with a <em>proceed anyway</em> button nobody should press.";
    },
    app: function () {
      return "<strong>Refill app.</strong> A program, not a person. When a check fails there's no page to show: the connection just fails and the app reports an error. Nobody sees a warning, so these failures are easy to miss.";
    },
    checks: function () {
      return "<strong>TLS checks.</strong> Run by the browser or the app during the TLS handshake, before anything is sent. 1: does the chain end at a trusted root? 2: does the certificate cover " + NAME + "? 3: is the time now between its two dates? All three must pass.";
    },
    server: function (S, now) {
      var c = presented(S);
      return "<strong>Pharmacy server.</strong> Presents its certificate in every handshake. Right now: a certificate for " + c.name + ", signed by " + c.issuer + ", valid from " + dateTime(c.from) + " until " + dateTime(c.until) + (now >= c.until ? " (expired)" : "") + ".";
    },
    acme: function (S) {
      return "<strong>ACME client.</strong> A small program on the server. With auto-renew on, it gets a new " + ACME_DAYS + "-day certificate from a free CA once only " + RENEW_LEFT + " days are left, about two thirds of the way through, proving it controls " + NAME + " first. It renews the certificate it manages. It won't notice if someone installs a different one. Renewals so far: " + S.renewals + ".";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e05", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      api.speed = SPEED;
      S.real = { kind: "manual", name: NAME, issuer: "Northgate Trust CA", chained: true, from: ISSUED, until: EXPIRY };
      S.other = null;
      S.installed = "right";
      S.auto = false;
      S.autoSince = 0;
      S.renewals = 0;
      S.expiryLogged = null;
      S.lastOutcome = { browser: null, app: null };
      S.count = { secure: 0, warnings: 0, failed: 0 };
      S.shown = {};
      S.states = {};

      S.ctl = {};
      S.ctl.visit = api.control.button("visit", "A customer opens the site", function () { visit(api, "browser", true); });
      S.ctl.app = api.control.button("app", "The refill app connects", function () { visit(api, "app", true); });
      S.ctl.advance = api.control.button("advance", "Skip ahead " + SKIP_DAYS + " days", function () { advance(api); });
      S.ctl.renew = api.control.button("renew", "Renew by hand (" + MANUAL_DAYS + " days)", function () { renew(api); });
      S.ctl.autorenew = api.control.toggle("autorenew", "Auto-renew with ACME", false, function (on) { setAuto(api, on); });
      S.ctl.cert = api.control.select("cert", "Certificate on the server", CERT_OPTIONS, "right", function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.cert && S.ctl.cert.value;
        install(api, String(val));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        secure: api.stat("secure", "secure connections", "ok"),
        warnings: api.stat("warnings", "browser warnings", "warn"),
        failed: api.stat("failed", "failed app connections", "bad")
      };
      updateStats(api);

      show(api, "checks", "sub", "chain ?" + MID + "name ?");
      show(api, "checks", "meta", "date ?");
      refresh(api);

      api.every(TRAFFIC_EVERY, function () {
        visit(api, api.rand() < APP_SHARE ? "app" : "browser", false);
      });

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, api.clock));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("Monday night, " + timeText(api.clock) + ". The certificate for " + NAME + " expires at 00:00. Nobody has renewed it.", "warn");
    },

    step: function (api) {
      if (api.state.shown) refresh(api);
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }

      // 1. Before midnight every check passes.
      t.click("visit");
      t.expect(n("secure") === 1 && n("warnings") === 0 && n("failed") === 0, "before midnight, a customer's connection passes all three checks");

      // 2. Midnight: 15 sim-minutes at 60x is 15 real seconds.
      await t.run(16);
      t.expect(t.node("server").state === "bad", "at 00:00 the certificate expires and the server turns red");
      var s0 = n("secure"), w0 = n("warnings"), f0 = n("failed");
      t.click("visit");
      t.click("app");
      t.expect(n("secure") === s0 && n("warnings") === w0 + 1 && n("failed") === f0 + 1, "after expiry the browser shows a warning and the app just fails");
      t.expect(t.logText().indexOf("Date check failed") >= 0, "the log names the date check as the one that failed");

      // 3. Renewing by hand fixes it, for 200 days.
      t.click("renew");
      var s1 = n("secure");
      t.click("visit");
      t.expect(n("secure") === s1 + 1, "after renewing by hand, connections are secure again");
      t.expect(t.node("server").text.meta === "expires in 200d", "a renewal by hand buys 200 days, the most allowed in 2026");

      // 4. A certificate for the wrong name.
      t.set("cert", "wrongname");
      var w1 = n("warnings");
      t.click("visit");
      t.expect(n("warnings") === w1 + 1 && t.logText().indexOf("Name check failed") >= 0, "a certificate for the wrong name fails the name check");

      // 5. A self-signed certificate.
      t.set("cert", "selfsigned");
      var f1 = n("failed");
      t.click("app");
      t.expect(n("failed") === f1 + 1 && t.logText().indexOf("Chain check failed") >= 0, "a self-signed certificate fails the chain check");

      // 6. Auto-renew over 180 days.
      t.click("reset");
      t.click("autorenew");
      for (var i = 0; i < 6; i++) t.click("advance");
      var s2 = n("secure"), w2 = n("warnings"), f2 = n("failed");
      t.click("visit");
      t.click("app");
      t.expect(n("secure") === s2 + 2 && n("warnings") === w2 && n("failed") === f2, "with auto-renew on, 180 days later both clients still connect securely");
      t.expect(t.logText().indexOf("ACME client: renewed") >= 0, "the ACME client renewed with nobody touching it");

      // 7. Automation renews; it doesn't notice the wrong certificate.
      t.set("cert", "wrongname");
      var w3 = n("warnings");
      t.click("visit");
      t.click("advance");
      t.click("visit");
      t.expect(n("warnings") === w3 + 2, "auto-renew does not fix a certificate for the wrong name");

      // 8. Without automation the 200-day certificate runs out too.
      t.click("reset");
      t.click("renew");
      for (var j = 0; j < 7; j++) t.click("advance");
      var w4 = n("warnings");
      t.click("visit");
      t.expect(n("warnings") === w4 + 1 && t.node("server").state === "bad", "without automation, the 200-day certificate runs out after 210 days");
    }
  });
})();
