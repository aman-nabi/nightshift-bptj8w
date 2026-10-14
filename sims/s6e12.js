/* sims/s6e12-v1.0.0.js  (published as sims/s6e12.js)
   Case s6e12 "Debugging Production": a debugging lab for Fenmoor Laundry's night shift. A cart of
   linen is pushed past tag reader R3 at table 3 and every tag is read. The release of Wednesday
   30 September 2026 carried 64 changes; change 41 added a check that no tag is counted twice in a
   cart, and for each new tag it asks the database for every tag already in the cart, one lookup
   each. The learner picks the cart size, how many of the 64 changes are in the build, the database
   speed, how the check works, and detailed logging; scans a cart; and bisects the 64 changes one
   test build per click.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: carts of 40, 400 or 800 items; builds holding the first 0 to
     64 changes; database lookups of 0.4 ms (as now) or 0.2 ms (a faster database computer); the
     duplicate-tag check as built, switched off, or rewritten to keep the cart's tags in a list;
     detailed logging on or off. Buttons: scan the cart, bisect (build and test the middle), start
     the bisect again, reset. Shows lookups, scan time, a USE and RED table, the bisect range as 64
     cells, and the shift book's suspects with each one's fate. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - Reading and saving one tag takes 0.5 ms. Changes 1 to 64 are in the build in order: a build
     "with k changes" holds changes 1 to k. k = 0 is the build before 30 September; k = 64 is the
     release.
   - Change 41 is the duplicate-tag check. As built, for the i-th tag of a cart it looks up each of
     the i - 1 tags already in the cart, one lookup at a time: a cart of n items makes
     n(n-1)/2 lookups. Switched off, or rewritten to keep the cart's tags in a list as it goes, it
     makes none. A build with fewer than 41 changes has no check at all.
   - Scan time (ms) = n x 0.5 + lookups x lookup time (0.4 ms, or 0.2 ms on the faster database).
     Shown in seconds to one decimal place.
   - USE for the database computer: it can work on 8 lookups at once and a scan sends one at a
     time, so utilisation = (lookups x lookup time) / scan time / 8, as a whole percent. Saturation
     (lookups waiting) 0, errors 0.
   - RED for the database: rate = lookups / scan time in seconds, to the nearest hundred; errors 0;
     duration = the lookup time. RED for the scan program: one cart, 0 errors, duration = scan time.
   - Detailed logging writes one line per tag read and one per lookup; its slowest single step is
     the 0.5 ms tag read, the same for every cart size.
   - A test build is "slow" if the scan takes over 1 s. Bisect: the suspect range starts at changes
     1 to 64; each click builds the first m = lo + floor((hi - lo) / 2) changes, scans the cart
     with the current settings, and keeps the half that holds the cause (slow: hi = m; fast:
     lo = m + 1). 64 = 2^6, so any one change is named in exactly 6 builds.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e12-v1.0.0.json):
   - Hotel cart, 40 items, release: 40 x 39 / 2 = 780 lookups; 20 + 312 = 332 ms, "0.3 s" (the
     01:00 log line). Hospital cart, 400 items: 400 x 399 / 2 = 79,800 lookups; 200 + 31,920 =
     32,120 ms, "32.1 s" (the 01:10 log line).
   - Before 30 September (0 changes): 400 items 200 ms, "0.2 s"; 40 items 20 ms, "0.0 s".
   - USE at 01:10: 31,920 / 32,120 / 8 = 12.4%, "12%"; at 01:00: 312 / 332 / 8 = 11.7%, "12%".
     RED rate: 79,800 / 32.12 = 2,484, "2,500 a second"; 780 / 0.332 = 2,349, "2,300 a second".
   - Option 1, faster database (0.2 ms): 400 items 200 + 15,960 = 16,160 ms, "16.2 s"; 800 items
     319,600 lookups, 400 + 63,920 = 64,320 ms, "64.3 s".
   - Option 0, bisect with the 400-item cart: 32 fast (0.2 s), 48 slow (32.1 s), 40 fast, 44 slow,
     42 slow, 41 slow: change 41, in 6 builds (6 x 20 minutes, about two hours, in the story).
     With a 40-item cart every test is fast (0.3 s at most) and the bisect wrongly names change 64.
   - Option 2, rollback (0 changes): "0.2 s", and none of the 64 changes.
   - Option 3, detailed logging: 400 items 400 + 79,800 = 80,200 lines; 40 items 820 lines; the
     slowest single step 0.5 ms in both.
   - The fix (check rewritten): 0 lookups; 400 items "0.2 s", 800 items "0.4 s".
*/
(function () {
  "use strict";

  var READ_MS = 0.5;
  var CULPRIT = 41;
  var TOTAL = 64;
  var SLOW_MS = 1000;
  var WORKERS = 8;

  var CARTS = [
    { value: "40", label: "40 items (a hotel cart)", n: 40, id: "C-1187" },
    { value: "400", label: "400 items (a Tilsworth hospital cart)", n: 400, id: "C-2214" },
    { value: "800", label: "800 items (twice a hospital cart)", n: 800, id: "C-3009" }
  ];
  var DBS = [
    { value: "0.4", label: "0.4 ms a lookup (as now)", ms: 0.4 },
    { value: "0.2", label: "0.2 ms a lookup (a faster database computer)", ms: 0.2 }
  ];
  var CHECKS = [
    { value: "built", label: "As built: asks the database for the whole cart for each new tag" },
    { value: "off", label: "Switched off" },
    { value: "list", label: "Rewritten: keeps the cart's tags in a list as it goes" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function secs(ms) { return (Math.round(ms / 100) / 10).toFixed(1) + " s"; }

  /* ---------- the model (pure) ---------- */

  // One scan of a cart with these settings and a build holding the first k changes.
  function scan(C, k) {
    var cart = pick(CARTS, C.cart);
    var n = cart.n;
    var ms = pick(DBS, C.db).ms;
    var hasCheck = k >= CULPRIT;
    var lookups = hasCheck && C.check === "built" ? n * (n - 1) / 2 : 0;
    var t = n * READ_MS + lookups * ms;
    var busy = lookups ? Math.round(lookups * ms * 100 / t / WORKERS) : 0;
    var rate = lookups ? Math.round(lookups / (t / 1000) / 100) * 100 : 0;
    return {
      cart: cart, n: n, ms: ms, k: k, hasCheck: hasCheck, lookups: lookups, t: t,
      busy: busy, rate: rate, slow: t > SLOW_MS, lines: n + lookups
    };
  }

  function buildText(k) {
    if (k === 0) return "the build before 30 September (none of the 64 changes)";
    if (k === TOTAL) return "the release (all 64 changes)";
    return "a test build with changes 1 to " + k;
  }
  function checkText(C, r) {
    if (!r.hasCheck) return "no duplicate-tag check in this build";
    return C.check === "built" ? "check as built" : (C.check === "off" ? "check switched off" : "check rewritten");
  }

  function newBisect() { return { lo: 1, hi: TOTAL, builds: 0, done: false, everSlow: false }; }

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
    var bar = el("div", "display:grid;grid-template-columns:repeat(32,1fr);gap:2px;font-size:9px;");
    var barNote = el("p", "margin:0;font-size:11px;");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["what is checked", "method", "first letter", "second", "third"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    var book = el("ul", "margin:0;padding-left:18px;font-size:11px;");
    [head, bar, barNote, wrap, el("p", "margin:0;font-size:12px;font-weight:600;", "Shift book: the suspects"), book].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, bar: bar, barNote: barNote, tbody: tbody, book: book };
  }

  function drawBar(S) {
    var ui = S.ui;
    var B = S.B;
    while (ui.bar.firstChild) ui.bar.removeChild(ui.bar.firstChild);
    for (var c = 1; c <= TOTAL; c++) {
      var inRange = c >= B.lo && c <= B.hi;
      var cell = ui.el("span", "text-align:center;border:1px solid currentColor;border-radius:2px;opacity:" + (inRange ? "1" : "0.25") + ";" +
        (B.done && inRange ? "font-weight:700;" : ""), String(c));
      ui.bar.appendChild(cell);
    }
    ui.barNote.textContent = B.done ? "Bisect done after " + B.builds + " builds: change " + B.lo + " is the one left." :
      "Suspect changes: " + B.lo + " to " + B.hi + " (" + (B.hi - B.lo + 1) + " left). Builds tested: " + B.builds + ".";
  }

  function drawTable(S) {
    var ui = S.ui;
    var r = S.last;
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    var rows = r ? [
      ["Database computer", "USE", "utilisation: " + r.busy + "% busy", "saturation: 0 waiting", "errors: 0"],
      ["Database", "RED", "rate: " + (r.lookups ? fmt(r.rate) + " lookups a second" : "no lookups"), "errors: 0", "duration: " + (r.lookups ? r.ms + " ms each" : "none")],
      ["Scan program", "RED", "rate: 1 cart", "errors: 0", "duration: " + secs(r.t)]
    ] : [["Scan a cart to fill this table.", "", "", "", ""]];
    rows.forEach(function (cells) {
      var tr = ui.el("tr");
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 4px;", c)); });
      ui.tbody.appendChild(tr);
    });
  }

  function drawBook(S) {
    var ui = S.ui;
    while (ui.book.firstChild) ui.book.removeChild(ui.book.firstChild);
    var seen = S.seen;
    var size = seen.small && seen.big ? "confirmed: with the release, 40 items make 780 lookups and 400 make 79,800" : "open";
    var change = S.B.done && S.B.everSlow ? "confirmed: change " + S.B.lo + (S.B.lo === CULPRIT ? ", the duplicate-tag check" : "") :
      (S.B.done ? "not proven: no test build ran slow, so the test never reproduced the symptom" : "open");
    [
      "The database computer is slow: " + (seen.db ? "cleared by USE, 12% busy, nothing waiting, no errors" : "open"),
      "The scanners: cleared Tue 13 Oct, a spare reader gave the same 32.1 s",
      "The hospital's tags: cleared Thu 15 Oct, 40 hospital sheets alone scanned in 0.3 s",
      "The size of the cart: " + size,
      "One of the 64 changes in the release: " + change
    ].forEach(function (s) { ui.book.appendChild(ui.el("li", "", s)); });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = scan(C, C.k);
    S.ui.head.textContent = "Reader R3, table 3. Cart: " + pick(CARTS, C.cart).label + ". Build: " + buildText(C.k) +
      ". Lookups: " + pick(DBS, C.db).ms + " ms each. " + (r.hasCheck ? "Duplicate-tag check: " + checkText(C, r).replace("check ", "") + "." : "No duplicate-tag check in this build.") +
      " Detailed logging: " + (C.logging ? "on." : "off.");
    drawBar(S);
    drawTable(S);
    drawBook(S);
    var L = S.last;
    S.stat.lookups(L ? fmt(L.lookups) : "none yet");
    S.stat.time(L ? secs(L.t) : "not yet");
    S.stat.busy(L ? L.busy + "%" : "not yet");
    S.stat.waiting(L ? 0 : "not yet");
    S.stat.errors(L ? 0 : "not yet");
    S.stat.rate(L ? (L.lookups ? fmt(L.rate) + " a second" : "none") : "not yet");
    S.stat.slowest(L && L.logged ? READ_MS + " ms" : "logging off");
    S.stat.lines(L && L.logged ? fmt(L.lines) : "logging off");
    S.stat.range(S.B.lo === S.B.hi ? "change " + S.B.lo : "changes " + S.B.lo + " to " + S.B.hi);
    S.stat.builds(S.B.builds);
    S.stat.culprit(S.B.done ? "change " + S.B.lo : "not yet");
    S.ctl.bisect.disable(S.B.done);
  }

  function doScan(api) {
    var S = api.state;
    var C = S.C;
    var r = scan(C, C.k);
    r.logged = C.logging;
    S.last = r;
    if (r.lookups) S.seen.db = true;
    if (C.k >= CULPRIT && C.check === "built") {
      if (r.n === 40) S.seen.small = true;
      if (r.n === 400) S.seen.big = true;
    }
    var s = "R3, table 3, cart " + r.cart.id + ", " + r.n + " items: " + fmt(r.lookups) + " lookups, " + secs(r.t) +
      ". (" + buildText(C.k) + ", " + r.ms + " ms a lookup, " + checkText(C, r) + ".)";
    if (C.logging) s += " Detailed logging wrote " + fmt(r.lines) + " lines; the slowest single step took " + READ_MS + " ms.";
    api.log(s, r.slow ? "bad" : "ok");
    draw(api);
  }

  function doBisect(api) {
    var S = api.state;
    var B = S.B;
    if (B.done) return;
    var m = B.lo + Math.floor((B.hi - B.lo) / 2);
    var r = scan(S.C, m);
    B.builds += 1;
    if (r.slow) { B.hi = m; B.everSlow = true; } else { B.lo = m + 1; }
    var s = "Build " + B.builds + ": changes 1 to " + m + ", " + r.n + "-item cart, " + secs(r.t) + ", " + (r.slow ? "slow" : "fast") +
      ". The cause is in changes " + B.lo + " to " + B.hi + ".";
    var tone = r.slow ? "bad" : "ok";
    if (B.lo === B.hi) {
      B.done = true;
      if (B.everSlow) {
        s += " One change left after " + B.builds + " builds: change " + B.lo + (B.lo === CULPRIT ? ", the duplicate-tag check." : ".");
        tone = "warn";
      } else {
        s += " Change " + B.lo + " is named, but no test build ran slow: this test does not reproduce the symptom, so the name means nothing.";
        tone = "warn";
      }
    }
    api.log(s, tone);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e12", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { cart: "40", k: TOTAL, db: "0.4", check: "built", logging: false };
      S.B = newBisect();
      S.last = null;
      S.seen = { db: false, small: false, big: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function changed(msg) { S.last = null; api.log(msg, ""); draw(api); }
      S.ctl.cart = api.control.select("cart", "Cart", CARTS.map(function (x) { return { value: x.value, label: x.label }; }), "40", function (v) {
        S.C.cart = pick(CARTS, v).value;
        changed("Cart: " + pick(CARTS, v).label + ".");
      });
      S.ctl.build = api.control.range("build", "Changes in the build (0 = before 30 September, 64 = the release)", 0, TOTAL, 1, TOTAL, function (v) {
        var x = Math.max(0, Math.min(TOTAL, Math.round(Number(v))));
        if (!isFinite(x)) return;
        S.C.k = x;
        changed("Build: " + buildText(x) + ".");
      });
      S.ctl.db = api.control.select("db", "Database speed", DBS.map(function (x) { return { value: x.value, label: x.label }; }), "0.4", function (v) {
        S.C.db = pick(DBS, v).value;
        changed("Database: " + pick(DBS, v).label + ".");
      });
      S.ctl.check = api.control.select("check", "Duplicate-tag check (change 41)", CHECKS, "built", function (v) {
        S.C.check = pick(CHECKS, v).value;
        changed("Duplicate-tag check: " + pick(CHECKS, v).label + ".");
      });
      S.ctl.logging = api.control.toggle("logging", "Detailed logging (a line for every step)", false, function (on) {
        S.C.logging = !!on;
        changed("Detailed logging: " + (on ? "on." : "off."));
      });
      S.ctl.scan = api.control.button("scan", "Scan the cart", function () { doScan(api); });
      S.ctl.bisect = api.control.button("bisect", "Bisect: build and test the middle", function () { doBisect(api); });
      S.ctl.again = api.control.button("again", "Start the bisect again", function () {
        S.B = newBisect();
        api.log("Bisect started again: the cause is somewhere in changes 1 to 64.", "");
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        lookups: api.stat("lookups", "lookups for this cart", "warn"),
        time: api.stat("time", "scan time", "bad"),
        busy: api.stat("busy", "USE: database computer busy", ""),
        waiting: api.stat("waiting", "USE: lookups waiting", ""),
        errors: api.stat("errors", "USE and RED: errors", ""),
        rate: api.stat("rate", "RED: database lookups", ""),
        slowest: api.stat("slowest", "slowest single step (detailed logging)", ""),
        lines: api.stat("lines", "lines written (detailed logging)", ""),
        range: api.stat("range", "bisect: suspect changes", "warn"),
        builds: api.stat("builds", "bisect: builds tested", ""),
        culprit: api.stat("culprit", "bisect: the one change left", "bad")
      };
      api.info("<strong>How to read it.</strong> Reading and saving each tag takes 0.5 ms. A build holds the first k of the release's 64 changes, in order. Change 41 is a check that no tag is counted twice in a cart; as built, for each new tag it looks up every tag already in the cart, one at a time. The database computer can work on 8 lookups at once. The table shows USE (utilisation, saturation, errors) for the database computer and RED (rate, errors, duration) for the database and the scan program. Each bisect click builds the middle of the suspect changes and scans the cart you picked; over 1 s counts as slow.");
      api.log("Thursday night, reader R3 at table 3, running the release (all 64 changes). No cart scanned yet.", "");
      draw(api);
    },

    selfTest: async function (t) {
      // 1. Opens before the first cart: the release, nothing scanned, the full suspect range.
      t.expect(t.stat("lookups") === "none yet" && t.stat("time") === "not yet" && t.stat("range") === "changes 1 to 64" &&
        t.stat("builds") === 0 && t.stat("culprit") === "not yet" &&
        t.logText().indexOf("Thursday night, reader R3 at table 3, running the release (all 64 changes). No cart scanned yet.") >= 0,
        "Opens on the release, no cart scanned, suspects changes 1 to 64");

      // 2. 01:00: the hotel cart, 40 items.
      t.click("scan");
      t.expect(t.stat("lookups") === 780 && t.stat("time") === "0.3 s" && t.stat("busy") === "12%" && t.stat("rate") === "2,300 a second" &&
        t.logText().indexOf("R3, table 3, cart C-1187, 40 items: 780 lookups, 0.3 s.") >= 0,
        "Hotel cart: 40 items, 780 lookups, 0.3 s");

      // 3. 01:10: the hospital cart, 400 items. USE and RED say the database is healthy.
      t.set("cart", "400");
      t.click("scan");
      t.expect(t.stat("lookups") === "79,800" && t.stat("time") === "32.1 s" && t.stat("busy") === "12%" && t.stat("waiting") === 0 &&
        t.stat("errors") === 0 && t.stat("rate") === "2,500 a second" &&
        t.logText().indexOf("R3, table 3, cart C-2214, 400 items: 79,800 lookups, 32.1 s.") >= 0,
        "Hospital cart: 400 items, 79,800 lookups, 32.1 s; database 12% busy, nothing waiting, no errors");

      // 4. Option 3: detailed logging shows no slow step.
      t.set("logging", true);
      t.click("scan");
      var big = t.stat("lines") === "80,200" && t.stat("slowest") === "0.5 ms";
      t.set("cart", "40");
      t.click("scan");
      t.expect(big && t.stat("lines") === 820 && t.stat("slowest") === "0.5 ms",
        "Detailed logging: 80,200 lines for 400 items, 820 for 40, slowest step 0.5 ms in both");
      t.set("logging", false);

      // 5. Option 2: the build before 30 September.
      t.set("cart", "400");
      t.set("build", 0);
      t.click("scan");
      t.expect(t.stat("lookups") === 0 && t.stat("time") === "0.2 s" &&
        t.logText().indexOf("400 items: 0 lookups, 0.2 s. (the build before 30 September (none of the 64 changes)") >= 0,
        "Rollback: the build before 30 September scans 400 items in 0.2 s, without any of the 64 changes");

      // 6. Option 1: a faster database halves each lookup, but the count still grows.
      t.set("build", 64);
      t.set("db", "0.2");
      t.click("scan");
      var f400 = t.stat("time") === "16.2 s" && t.stat("lookups") === "79,800";
      t.set("cart", "800");
      t.click("scan");
      t.expect(f400 && t.stat("time") === "64.3 s" && t.stat("lookups") === "319,600",
        "Faster database: 400 items 16.2 s; 800 items 319,600 lookups, 64.3 s");

      // 7. Option 0: bisect with a 400-item pretend cart finds change 41 in 6 builds.
      t.set("db", "0.4");
      t.set("cart", "400");
      for (var i = 0; i < 6; i++) t.click("bisect");
      var log = t.logText();
      t.expect(log.indexOf("Build 1: changes 1 to 32, 400-item cart, 0.2 s, fast. The cause is in changes 33 to 64.") >= 0 &&
        log.indexOf("Build 2: changes 1 to 48, 400-item cart, 32.1 s, slow. The cause is in changes 33 to 48.") >= 0 &&
        log.indexOf("Build 3: changes 1 to 40, 400-item cart, 0.2 s, fast. The cause is in changes 41 to 48.") >= 0 &&
        log.indexOf("Build 6: changes 1 to 41, 400-item cart, 32.1 s, slow. The cause is in changes 41 to 41. One change left after 6 builds: change 41, the duplicate-tag check.") >= 0 &&
        t.stat("builds") === 6 && t.stat("culprit") === "change 41" && t.stat("range") === "change 41",
        "Bisect with 400 items: 32 fast, 48 slow, 40 fast, then 44, 42, 41 slow: change 41 in 6 builds");

      // 8. A test that doesn't reproduce: a 40-item cart names the wrong change.
      t.click("again");
      t.set("cart", "40");
      for (var j = 0; j < 6; j++) t.click("bisect");
      t.expect(t.stat("culprit") === "change 64" && t.stat("builds") === 6 &&
        t.logText().indexOf("Change 64 is named, but no test build ran slow: this test does not reproduce the symptom") >= 0,
        "Bisect with 40 items: every build fast, change 64 named, and the sim says the test never reproduced it");

      // 9. The fix: the check rewritten to keep a list, 400 and 800 items fast, the check still on.
      t.set("check", "list");
      t.set("cart", "400");
      t.click("scan");
      var l400 = t.stat("time") === "0.2 s" && t.stat("lookups") === 0;
      t.set("cart", "800");
      t.click("scan");
      t.expect(l400 && t.stat("time") === "0.4 s" && t.logText().indexOf("check rewritten") >= 0,
        "Check rewritten: 400 items 0.2 s, 800 items 0.4 s, no lookups");

      // 10. The arithmetic behind the record: n(n-1)/2 lookups at 0.4 ms.
      var C = { cart: "400", k: 64, db: "0.4", check: "built", logging: false };
      var a = scan(C, 64);
      C.cart = "40";
      var b = scan(C, 64);
      t.expect(a.lookups === 79800 && a.t === 32120 && b.lookups === 780 && b.t === 332 && scan(C, 40).lookups === 0,
        "400 items: 79,800 lookups, 32,120 ms; 40 items: 780 and 332 ms; a build without change 41 makes none");
    }
  });
})();
