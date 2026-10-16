/* sims/s9e03-v1.0.0.js  (published as sims/s9e03.js)
   Case s9e03 "How Many Machines": a capacity lab for an online flower shop on Friday night
   13 February 2026, the night before the 14th. Orders for the 06:00 vans open at 21:30 and close
   at 23:00. The shop runs 6 web servers (200 orders a minute each, 1,200 in all) in front of one
   database. Each order reads 3 customer records (account, address, saved card). The learner sets
   the load test's data, rate and length, the web servers (6 to 12, or autoscaling), the database's
   disk, a waiting room and a worst-case fleet, runs the load test, and plays the night minute by
   minute. Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests
   are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls test data, test rate, test length, web servers,
     autoscaling, database disk, waiting room, worst-case fleet; buttons Run the load test, Next
     minute, Play to 23:00, Reset. Stats: time, orders tried, through and failed this minute, failed
     so far, web servers busy, database busy, first limit, orders waiting, monthly cost, last load
     test. selfTest: 11 assertions.

   Brief note: the brief's "web servers at 30%" is stale; bible v1.0.3 wins: the dashboard reads
   38% busy, 450 orders through against the 1,200 the 6 web servers were tested to (37.5%, rounded).

   Where every number comes from (conventions rule 14; the case is content/s9/s9e03-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - The plan (the post): last year's busiest minute 400 orders; forecast double, 800; plus half
     again as headroom: 1,200 a minute. 6 web servers x 200 a minute = 1,200.
   - The database (the post): 40,000 customers' records on its disk. The disk does 1,350 reads a
     minute; each order needs 3 reads, so from disk the database takes 1,350 / 3 = 450 orders a
     minute. From memory it answers 45,000 lookups a minute (15,000 orders), and memory holds the
     records of the 2,000 customers used most recently (sim.lede).
   - The line (the post): at most 1,000 orders wait in the database's line; past that, a new order
     fails and its basket empties.
   - Demand (given data, the post and sim.lede): 21:30 to 21:39 300 a minute, 21:40 350, 21:50 400,
     22:00 to 22:29 700 (after the 22:00 last-hour email), 22:30 400, 22:40 300, 22:50 150.
     Total 3,000 + 3,500 + 4,000 + 21,000 + 4,000 + 3,000 + 1,500 = 40,000 orders, each from a
     different customer, so every order's records come from disk.
   - As built: through 450 a minute from 22:00; the line holds 250, 500, 750, 1,000 at the end of
     22:00 to 22:03; from 22:04 to 22:29, 250 fail each minute: 26 x 250 = 6,500 failed. Web busy
     450 / 1,200 = 37.5%, shown 38%. The line drains 50 a minute from 22:30 and 150 a minute from
     22:40, empty at 22:43. 33,500 through.
   - Autoscaling (option 0): one web server added each minute orders wait, up to 12; 7 from 22:01,
     12 from 22:06. Still 450 through, 6,500 failed; web busy 450 / 2,400 = 18.75%, shown 19%.
   - Waiting room on, as built: admits 450 a minute, the first limit. Its line is 7,500 at 22:29,
     7,000 at 22:39, 5,500 at 22:49, 2,500 at 22:59; after 23:00 the last 2,500 go through by 23:05.
     No failures; all 40,000 through; the longest wait is 17 minutes.
   - Faster disk (option 3's raised limit): 4,050 reads a minute, 1,350 orders. With 6 web servers
     the first limit is the web servers at 1,200 (the plan). The night: 700 through at peak, none
     failed, web 700 / 1,200 = 58%, database 2,100 / 4,050 = 52%.
   - Worst-case fleet (option 2): 12,000 a minute, ten times the 1,200 plan: 60 web servers and a
     database whose disk does 36,000 reads a minute. Peak web and database busy 700 / 12,000 = 6%.
   - Story prices a month (given data): web server GBP 120 each; database as built GBP 400; with the
     faster disk GBP 900; waiting room GBP 60; worst-case fleet GBP 15,200 (60 x 120 = 7,200 plus a
     GBP 8,000 database). As built 720 + 400 = GBP 1,120. The fix 720 + 900 + 60 = GBP 1,680.
   - Load test (the post): Tuesday 27 January, 1,200 a minute for 15 minutes, 5 test customers and
     3 test bouquets. After their first order the 5 customers' records sit in memory: 18,000 of
     18,000 through, web 100% busy, database 1,200 x 3 / 45,000 = 8%. With 40,000 test customers
     every read goes to disk: the line holds 750 after minute 1, then 500 fail in minute 2 and 750
     in each of minutes 3 to 15: 6,750 through, 10,250 failed, 1,000 still waiting; web 38%,
     database 100%. Two hours: 5 customers 144,000 of 144,000 through; 40,000 customers stall at
     450 (54,000 through, 89,000 failed, 1,000 waiting). With the faster disk, 40,000 customers at
     1,200 pass (database 89%); at 1,500 the web servers stall at 1,200 (300 fail a minute).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after midnight) ---------- */

  var START = 21 * 60 + 30;   // 21:30, orders open
  var MINUTES = 90;           // 21:30 to 22:59; orders close at 23:00
  var DRAIN = 30;             // minutes after 23:00 for orders already waiting
  var DEMAND = [[0, 300], [10, 350], [20, 400], [30, 700], [60, 400], [70, 300], [80, 150]];
  var PER_WEB = 200;          // orders a minute per web server
  var READS = 3;              // customer records read per order
  var DISK = { built: 1350, fast: 4050 };
  var FLEET_DISK = 36000;
  var FLEET_WEB = 60;
  var MEMORY = 45000;         // lookups a minute from memory
  var MEM_CUSTOMERS = 2000;   // customers whose records memory holds
  var LINE_CAP = 1000;        // orders that may wait in the database's line
  var MAX_WEB = 12;
  var PRICE = { web: 120, built: 400, fast: 900, room: 60, fleet: 15200 };

  var DATA = [
    { value: "few", label: "5 test customers, 3 test bouquets (as tested)" },
    { value: "real", label: "40,000 test customers, the real mix of bouquets" }
  ];
  var RATES = [450, 800, 1200, 1500];
  var LENGTHS = [{ value: "15", label: "15 minutes (as tested)" }, { value: "120", label: "2 hours" }];
  var DISKS = [
    { value: "built", label: "as built: 1,350 reads a minute (450 orders)" },
    { value: "fast", label: "faster disk: 4,050 reads a minute (1,350 orders)" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { return two(Math.floor(t / 60) % 24) + ":" + two(t % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pct(a, b) { return Math.round(a * 100 / b) + "%"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function demandAt(i) {
    if (i >= MINUTES) return 0;
    var d = 0;
    for (var k = 0; k < DEMAND.length; k++) if (i >= DEMAND[k][0]) d = DEMAND[k][1];
    return d;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function diskReads(C) { return C.fleet ? FLEET_DISK : DISK[C.disk]; }
  function webCap(C, servers) { return (C.fleet ? FLEET_WEB : servers) * PER_WEB; }
  function serversShown(C, servers) { return C.fleet ? FLEET_WEB : servers; }

  // The first limit: whichever part fills first, for orders whose records come from disk
  // (dbOrders) or from memory.
  function firstLimit(web, db) {
    if (db < web) return { cap: db, text: "database, " + fmt(db) + " a minute" };
    if (web < db) return { cap: web, text: "web servers, " + fmt(web) + " a minute" };
    return { cap: web, text: "both, " + fmt(web) + " a minute" };
  }

  function cost(C) {
    var c = C.fleet ? PRICE.fleet : C.web * PRICE.web + PRICE[C.disk];
    if (C.room) c += PRICE.room;
    return "£" + fmt(c) + " a month";
  }

  // The whole night, minute by minute. Every order is a different customer, so every read is from disk.
  function night(C) {
    var reads = diskReads(C);
    var dbCap = Math.floor(reads / READS);
    var servers = C.web;
    var dbLine = 0;
    var cohorts = [];        // waiting room, first in first out: [arrival minute, orders]
    var roomLine = 0;
    var tot = { tried: 0, through: 0, failed: 0 };
    var maxRoom = 0;
    var longest = 0;
    var lastThrough = null;
    var firstFail = null;
    var mins = [];
    for (var i = 0; i < MINUTES + DRAIN; i++) {
      var t = START + i;
      var d = demandAt(i);
      if (i >= MINUTES && dbLine === 0 && roomLine === 0) break;
      var web = webCap(C, servers);
      var lim = firstLimit(web, dbCap);
      var through = 0;
      var failed = 0;
      if (C.room) {
        if (d) cohorts.push([i, d]);
        roomLine += d;
        var admit = Math.min(roomLine, lim.cap);
        roomLine -= admit;
        through = admit;
        var left = admit;
        while (left > 0 && cohorts.length) {
          var take = Math.min(left, cohorts[0][1]);
          longest = Math.max(longest, i - cohorts[0][0]);
          cohorts[0][1] -= take;
          left -= take;
          if (cohorts[0][1] === 0) cohorts.shift();
        }
        maxRoom = Math.max(maxRoom, roomLine);
      } else {
        var webIn = Math.min(d, web);
        failed = d - webIn;
        var pending = dbLine + webIn;
        through = Math.min(pending, dbCap);
        dbLine = pending - through;
        if (dbLine > LINE_CAP) {
          failed += dbLine - LINE_CAP;
          dbLine = LINE_CAP;
        }
      }
      tot.tried += d;
      tot.through += through;
      tot.failed += failed;
      if (through > 0) lastThrough = t;
      if (failed > 0 && firstFail === null) firstFail = t;
      mins.push({
        t: t, tried: d, through: through, failed: failed, failedAll: tot.failed,
        servers: serversShown(C, servers), webPct: pct(through, web), dbPct: pct(through * READS, reads),
        limit: lim.text, dbLine: dbLine, roomLine: roomLine, closed: i >= MINUTES
      });
      // Autoscaling acts after the minute: one more web server while orders wait, one fewer when none do.
      if (C.auto && !C.fleet) {
        var waiting = dbLine + roomLine;
        if (waiting > 0 && servers < MAX_WEB) servers += 1;
        else if (waiting === 0 && servers > C.web) servers -= 1;
      }
    }
    return { mins: mins, tot: tot, maxRoom: maxRoom, longest: longest, lastThrough: lastThrough, firstFail: firstFail, dbCap: dbCap };
  }

  // The load test: orders go straight to the web servers at a steady rate (no waiting room, no autoscaling).
  function loadTest(C) {
    var rate = Number(C.rate);
    var len = Number(C.len);
    var custs = C.data === "few" ? 5 : 40000;
    var fromMemory = custs <= MEM_CUSTOMERS;     // 5 fit in memory after their first order; 40,000 never do
    var reads = diskReads(C);
    var web = webCap(C, C.web);
    var dbCap = fromMemory ? Math.floor(MEMORY / READS) : Math.floor(reads / READS);
    var lim = firstLimit(web, dbCap);
    var line = 0;
    var through = 0;
    var failed = 0;
    var last = 0;
    for (var m = 0; m < len; m++) {
      var webIn = Math.min(rate, web);
      failed += rate - webIn;
      var pending = line + webIn;
      last = Math.min(pending, dbCap);
      through += last;
      line = pending - last;
      if (line > LINE_CAP) { failed += line - LINE_CAP; line = LINE_CAP; }
    }
    var sent = rate * len;
    var pass = failed === 0 && line === 0;
    var dbBusy = fromMemory ? pct(last * READS, MEMORY) : pct(last * READS, reads);
    var head = "Load test, " + pick(DATA, C.data).label.replace(" (as tested)", "") + ", " + fmt(rate) + " a minute for " +
      (len === 120 ? "2 hours" : len + " minutes") + ": ";
    var text = pass
      ? head + "PASSED at " + fmt(rate) + ". " + fmt(through) + " of " + fmt(sent) + " through. Web servers " + pct(last, web) +
        " busy, database " + dbBusy + " busy" + (fromMemory ? ", every lookup after the first 5 orders from memory." : ", every read from disk.") +
        " The first limit it would reach: " + lim.text + "."
      : head + "STALLED at " + fmt(last) + " a minute. First limit: " + lim.text + ". Web servers " + pct(last, web) +
        " busy, database " + dbBusy + " busy" + (fromMemory ? "." : ", every read from disk.") + " " + fmt(through) + " of " + fmt(sent) +
        " through, " + fmt(failed) + " failed, " + fmt(line) + " still waiting.";
    return { pass: pass, at: last, limit: lim.text, through: through, failed: failed, line: line, text: text,
      res: pass ? "PASSED at " + fmt(rate) : "STALLED at " + fmt(last) + ": " + lim.text.split(",")[0] };
  }

  function describe(C) {
    return (C.fleet ? "worst-case fleet: 60 web servers, a database for 12,000 orders a minute" :
      C.web + " web servers" + (C.auto ? " with autoscaling up to 12" : "") + ", database disk " +
      (C.disk === "fast" ? "faster (4,050 reads a minute)" : "as built (1,350 reads a minute)")) +
      ", waiting room " + (C.room ? "on" : "off");
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["part", "takes a minute", "this minute", "busy", "waiting"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, sum: sum };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var N = night(C);
    var row = S.m > 0 ? N.mins[S.m - 1] : null;
    var servers = row ? row.servers : serversShown(C, C.web);
    var web = servers * PER_WEB;
    var reads = diskReads(C);
    var dbCap = Math.floor(reads / READS);
    ui.head.textContent = "Set-up: " + describe(C) + ".";
    clear(ui.body);
    var rows = [
      ["customers", "-", row ? fmt(row.tried) + " tried" : "-", "-", "-"],
      ["waiting room", C.room ? "admits " + fmt(firstLimit(web, dbCap).cap) : "off", row && C.room ? fmt(row.through) + " let in" : "-", "-", C.room && row ? fmt(row.roomLine) : "-"],
      ["web servers (" + servers + ")", fmt(web), row ? fmt(row.through) + " through" : "-", row ? row.webPct : "0%", "-"],
      ["database", fmt(dbCap) + " (disk " + fmt(reads) + " reads)", row ? fmt(row.through * READS) + " reads" : "-", row ? row.dbPct : "0%", row && !C.room ? fmt(row.dbLine) : "-"]
    ];
    rows.forEach(function (r) {
      var tr = ui.el("tr");
      r.forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.body.appendChild(tr);
    });
    S.stat.time(row ? hm(row.t) : "21:30 (not played)");
    S.stat.tried(row ? row.tried : 0);
    S.stat.through(row ? row.through : 0);
    S.stat.failed(row ? row.failed : 0);
    S.stat.failedAll(fmt(row ? row.failedAll : 0));
    S.stat.web(row ? row.webPct + ", " + row.servers + " servers" : "0%, " + servers + " servers");
    S.stat.db(row ? row.dbPct : "0%");
    S.stat.limit(row ? row.limit : firstLimit(web, dbCap).text);
    S.stat.waiting(row ? (C.room ? "waiting room " + fmt(row.roomLine) : "database line " + fmt(row.dbLine)) : "none");
    S.stat.cost(cost(C));
    S.stat.test(S.test || "not run");
    ui.sum.textContent = row
      ? "At " + hm(row.t) + ": " + fmt(row.tried) + " tried, " + fmt(row.through) + " through, " + fmt(row.failed) + " failed. So far " +
        fmt(N.mins[S.m - 1].failedAll) + " baskets emptied."
      : "Not played yet: it is 21:30 on Friday 13 February 2026, and orders for the 06:00 vans have just opened.";
  }

  function change(api, what) {
    api.state.m = 0;
    api.log(what + " Set back to 21:30.", "");
    draw(api);
  }

  function minuteEvents(C, N, k) {
    var r = N.mins[k];
    var out = [];
    var prev = k > 0 ? N.mins[k - 1] : null;
    if (r.t === START + 30) out.push({ text: "22:00 last-hour email sent: 700 orders a minute.", tone: "warn" });
    if (prev && r.servers !== prev.servers && C.auto) out.push({ text: hm(r.t) + " autoscaling: " + r.servers + " web servers.", tone: "" });
    if (r.t === N.firstFail) out.push({ text: hm(r.t) + " orders failing: " + fmt(r.failed) + " baskets emptied. Through " + fmt(r.through) +
      " a minute, web servers " + r.webPct + " busy, database " + r.dbPct + ". First limit: " + r.limit + ".", tone: "bad" });
    if (k === N.mins.length - 1) {
      var tail = "Totals: " + fmt(N.tot.tried) + " tried, " + fmt(N.tot.through) + " through, " + fmt(N.tot.failed) + " failed.";
      if (C.room) tail += " Waiting room: longest line " + fmt(N.maxRoom) + ", longest wait " + N.longest + " minutes, last order through at " + hm(N.lastThrough) + ".";
      out.push({ text: hm(r.t) + " " + tail, tone: N.tot.failed ? "bad" : "ok" });
    }
    return out;
  }

  function runMinute(api, N, withSummary) {
    var S = api.state;
    var r = N.mins[S.m];
    if (withSummary) api.log(hm(r.t) + " tried " + fmt(r.tried) + ", through " + fmt(r.through) + ", failed " + fmt(r.failed) +
      ", web " + r.webPct + ", database " + r.dbPct + ".", r.failed ? "bad" : "");
    minuteEvents(S.C, N, S.m).forEach(function (e) { api.log(e.text, e.tone); });
    S.m += 1;
  }

  function step(api) {
    var S = api.state;
    var N = night(S.C);
    if (S.m >= N.mins.length) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    runMinute(api, N, true);
    draw(api);
  }

  function play(api) {
    var S = api.state;
    var N = night(S.C);
    if (S.m >= N.mins.length) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    while (S.m < N.mins.length) runMinute(api, N, false);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { data: "few", rate: "1200", len: "15", web: 6, auto: false, disk: "built", room: false, fleet: false };
      S.m = 0;
      S.test = "";
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key) {
        api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          change(api, label + ": " + (on ? "on." : "off."));
        });
      }
      sel("data", "Test data", DATA, "data");
      sel("rate", "Test rate", RATES.map(function (r) { return { value: String(r), label: fmt(r) + " orders a minute" }; }), "rate");
      sel("len", "Test length", LENGTHS, "len");
      api.control.button("test", "Run the load test", function () {
        var r = loadTest(S.C);
        S.test = r.res;
        api.log(r.text, r.pass ? "ok" : "bad");
        draw(api);
      });
      api.control.range("web", "Web servers", 6, MAX_WEB, 1, 6, function (v) {
        var x = Math.max(6, Math.min(MAX_WEB, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.web) return;
        S.C.web = x;
        change(api, "Web servers: " + x + ".");
      });
      tog("auto", "Autoscaling (one more web server a minute while orders wait, up to 12)", "auto");
      sel("disk", "Database disk", DISKS, "disk");
      tog("room", "Waiting room (lets in only what the first limit can take)", "room");
      tog("fleet", "Worst-case fleet (12,000 a minute, all year)", "fleet");
      api.control.button("step", "Next minute", function () { step(api); });
      api.control.button("run", "Play to 23:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        tried: api.stat("tried", "orders tried this minute", ""),
        through: api.stat("through", "orders through this minute", "ok"),
        failed: api.stat("failed", "orders failed this minute", "bad"),
        failedAll: api.stat("failedAll", "baskets emptied so far", "bad"),
        web: api.stat("web", "web servers busy", ""),
        db: api.stat("db", "database busy", "warn"),
        limit: api.stat("limit", "first limit", "warn"),
        waiting: api.stat("waiting", "orders waiting", ""),
        cost: api.stat("cost", "monthly cost", ""),
        test: api.stat("test", "last load test", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one part of the shop. \"takes a minute\" is the most orders it can handle in a minute; busy is this minute's orders against that. The database row counts disk reads: every order tonight is a new customer, so its 3 records come from disk. The first limit is the part that fills first. Run the load test to see what the January test saw; play the night to see 13 February.");

      api.log("Friday 13 February 2026, 21:30, as built: 6 web servers (1,200 a minute), the database's disk 1,350 reads a minute, no waiting room. The dashboard banner: load test passed at 1,200.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { data: "few", rate: "1200", len: "15", web: 6, auto: false, disk: "built", room: false, fleet: false };
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }
      function fresh(set) { as(set); begin(); t.click("run"); }
      function stepTo(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: 21:30, before the first minute is played; nothing tried, nothing failed.
      t.expect(t.stat("time") === "21:30 (not played)" && t.stat("tried") === 0 && t.stat("failedAll") === 0 &&
        t.stat("web") === "0%, 6 servers" && t.stat("limit") === "database, 450 a minute" && t.stat("cost") === "£1,120 a month" &&
        t.stat("test") === "not run" && has("21:30, as built"),
        "Opens at 21:30 as built: 6 web servers, the database's limit 450 a minute, GBP 1,120 a month");

      // 2. The January test: 5 customers and 3 bouquets at 1,200 for 15 minutes passes.
      begin();
      t.click("test");
      t.expect(t.stat("test") === "PASSED at 1,200" &&
        has("Load test, 5 test customers, 3 test bouquets, 1,200 a minute for 15 minutes: PASSED at 1,200. 18,000 of 18,000 through. Web servers 100% busy, database 8% busy, every lookup after the first 5 orders from memory."),
        "The January test: 5 customers at 1,200 a minute passes, database 8% busy from memory");

      // 3. The same test with 40,000 customers stalls at 450 and names the database.
      t.set("data", "real");
      begin();
      t.click("test");
      t.expect(t.stat("test") === "STALLED at 450: database" &&
        has("STALLED at 450 a minute. First limit: database, 450 a minute. Web servers 38% busy, database 100% busy, every read from disk. 6,750 of 18,000 through, 10,250 failed, 1,000 still waiting."),
        "With 40,000 test customers the test stalls at 450 and names the database; web servers 38% busy");

      // 4. Step the night to 22:04: the first failures, web servers 38% busy.
      as({});
      begin();
      stepTo(35);
      t.expect(t.stat("time") === "22:04" && t.stat("tried") === 700 && t.stat("through") === 450 && t.stat("failed") === 250 &&
        t.stat("web") === "38%, 6 servers" && t.stat("db") === "100%" && t.stat("waiting") === "database line 1,000" &&
        has("22:03 tried 700, through 450, failed 0, web 38%, database 100%.") &&
        has("22:04 orders failing: 250 baskets emptied. Through 450 a minute, web servers 38% busy, database 100%. First limit: database, 450 a minute."),
        "22:04: 700 tried, 450 through, 250 fail, with the web servers 38% busy and the database full");

      // 5. Play on: 6,500 failed by 22:29, the line empty at 22:43.
      begin();
      t.click("run");
      t.expect(t.stat("failedAll") === "6,500" && t.stat("time") === "22:59" &&
        has("22:59 Totals: 40,000 tried, 33,500 through, 6,500 failed."),
        "As built: 40,000 tried, 33,500 through, 6,500 baskets emptied");

      // 6. Autoscaling (option 0): 12 web servers by 22:06, still 450 through, still 6,500 failed.
      as({ auto: true });
      begin();
      stepTo(37);
      var a1 = t.stat("web") === "19%, 12 servers" && t.stat("through") === 450 && has("22:06 autoscaling: 12 web servers.");
      t.click("run");
      t.expect(a1 && t.stat("failedAll") === "6,500" && has("Totals: 40,000 tried, 33,500 through, 6,500 failed."),
        "Autoscaling adds web servers to 12 by 22:06; still 450 through and 6,500 failed, web 19% busy");

      // 7. Waiting room, as built: admits 450, nobody fails, the last order through at 23:05.
      fresh({ room: true });
      t.expect(t.stat("failedAll") === 0 && t.stat("time") === "23:05" &&
        has("Totals: 40,000 tried, 40,000 through, 0 failed. Waiting room: longest line 7,500, longest wait 17 minutes, last order through at 23:05."),
        "Waiting room on: 450 let in a minute, none failed, longest line 7,500, longest wait 17 minutes, all through by 23:05");

      // 8. Run the same test longer (option 1): 5 customers pass for 2 hours; 40,000 still stall at 450.
      as({ len: "120" });
      t.click("test");
      var l1 = t.stat("test") === "PASSED at 1,200";
      t.set("data", "real");
      begin();
      t.click("test");
      t.expect(l1 && t.stat("test") === "STALLED at 450: database" && has("54,000 of 144,000 through, 89,000 failed, 1,000 still waiting."),
        "A 2-hour test with the same 5 customers still passes; 40,000 customers still stall at 450");

      // 9. Faster disk (option 3): the test passes at 1,200, the next limit is the web servers; the night has no failures.
      as({ data: "real", disk: "fast" });
      t.click("test");
      var f1 = t.stat("test") === "PASSED at 1,200";
      t.set("rate", "1500");
      t.click("test");
      var f2 = t.stat("test") === "STALLED at 1,200: web servers";
      as({ disk: "fast" });
      stepTo(35);
      var f3 = t.stat("web") === "58%, 6 servers" && t.stat("db") === "52%" && t.stat("limit") === "web servers, 1,200 a minute";
      t.set("room", true);
      t.click("run");
      t.expect(f1 && f2 && f3 && t.stat("failedAll") === 0 && t.stat("cost") === "£1,680 a month" &&
        has("Totals: 40,000 tried, 40,000 through, 0 failed. Waiting room: longest line 0, longest wait 0 minutes"),
        "Faster disk: 40,000-customer test passes at 1,200, stalls at 1,200 on the web servers at 1,500; the night: 58% and 52% busy, none failed, GBP 1,680 with the waiting room");

      // 10. Worst-case fleet (option 2): never falls over, 6% busy, GBP 15,200 a month.
      as({ fleet: true });
      stepTo(35);
      var w1 = t.stat("web") === "6%, 60 servers" && t.stat("db") === "6%" && t.stat("cost") === "£15,200 a month";
      t.click("run");
      t.expect(w1 && t.stat("failedAll") === 0, "Worst-case fleet: 60 web servers 6% busy at the peak, none failed, GBP 15,200 a month");

      // 11. Before 22:00 the night stays under 450 in every set-up: no line, no failure.
      var calm = true;
      [false, true].forEach(function (auto) { [false, true].forEach(function (room) { ["built", "fast"].forEach(function (disk) {
        var N = night({ web: 6, auto: auto, disk: disk, room: room, fleet: false });
        for (var i = 0; i < 30; i++) if (N.mins[i].failed || N.mins[i].dbLine || N.mins[i].roomLine || N.mins[i].tried > 449) calm = false;
      }); }); });
      t.expect(calm, "21:30 to 21:59: at most 400 a minute, under the database's 450, so nothing waits and nothing fails in any set-up");
    }
  });
})();
