/* sims/s1e07-v1.0.0.js  (published as sims/s1e07.js)
   Case s1e07 "Where It Lives": latency numbers on a human time scale, where 1 nanosecond becomes 1 second.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: a CPU with six places an answer can live (L1 cache, RAM, SSD,
     hard disk, a server in the same data center, a server across the ocean). Fetch one and the dot
     makes the trip while the CPU box counts the wait in human time. Race mode sends 100 lookups each
     to RAM, a disk and the network on a speeding-up race clock. Controls: op, fetch, disk, net, race,
     reset. Stats: total time for 100 lookups from RAM, from the disk and over the network, plus the
     last fetch in human time. selfTest covers the human-time scale, a busy CPU ignoring a second
     click, the default race, and a race where the same-building network beats a hard disk.

   Notes for anyone copying this file:
   - Every number comes from the one LAT table below, and every piece of text (node lines, log, stats)
     is computed from it, so the sim, the case's explanation and its diagrams can't drift apart.
     Sources: Jeff Dean's 2009 "Numbers Everyone Should Know" slide (L1, RAM, same-datacenter round
     trip, disk seek, California to the Netherlands and back) and the ~2012 gist version for the SSD
     random 4 KB read. They are approximate and dated, and the case says so.
   - A single fetch takes 0.5 to 3.5 real seconds on a log scale. The human-time counter in the CPU box
     grows on the same log scale and lands exactly on the real value when the dot gets back.
   - The race clock speeds up: every real second, 10^1.25 (about 18) times more race time passes, so
     10 microseconds and 15 seconds both fit in a race of about 8 real seconds.
*/
(function () {
  "use strict";

  var MU = String.fromCharCode(0x3BC);   // Greek mu for microseconds, keeps the source plain ASCII
  var DAY = 86400;
  var MONTH = 30.44 * DAY;
  var YEAR = 365.25 * DAY;
  var LOOKUPS = 100;                     // lookups per lane in a race
  var ORDER_LINES = 40;                  // lookups per order in the story's warehouse
  var RACE_RATE = 1.25;                  // race clock: powers of ten per real second
  var SHUTTLE_SPEED = 520;               // viewBox units per real second for race dots
  var START = 2 * 3600 + 41 * 60;        // 02:41, as in the story's debug screen

  // Nanoseconds for one of each. "feel" is a plain-words sense of the human time.
  var LAT = {
    l1: { node: "l1", name: "the L1 cache", short: "L1 cache read", ns: 0.5, feel: "About a blink." },
    ram: { node: "ram", name: "RAM", short: "RAM read", ns: 100, feel: "Long enough to refill your coffee." },
    ssd: { node: "ssd", name: "the SSD (4 KB at random)", short: "SSD read", ns: 150000, feel: "Most of a weekend." },
    dc: { node: "dc", name: "a server in the same data center", short: "same data center round trip", ns: 500000, feel: "Most of a week." },
    hdd: { node: "hdd", name: "the hard disk (one seek)", short: "hard disk seek", ns: 10000000, feel: "A whole season." },
    far: { node: "far", name: "a server across the ocean", short: "round trip across the ocean", ns: 150000000, feel: "Longer than most degrees take." }
  };
  var ORDER = ["l1", "ram", "ssd", "dc", "hdd", "far"];

  /* ---------- time formats ---------- */

  function oneDecimal(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  function trimNum(v) {
    var r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return String(r);
  }

  // Real time, in the unit people would say: "0.5 ns", "150 us", "0.5 ms", "15 s".
  function realTime(ns) {
    if (ns < 1000) return trimNum(ns) + " ns";
    if (ns < 500000) return trimNum(ns / 1000) + " " + MU + "s";
    if (ns < 1e9) return trimNum(ns / 1e6) + " ms";
    return trimNum(ns / 1e9) + " s";
  }

  // Human time: 1 nanosecond becomes 1 second.
  function humanTime(ns) {
    var s = ns;
    if (s < 60) return trimNum(s) + (s === 1 ? " second" : " seconds");
    if (s < 3600) {
      var m = Math.floor(s / 60);
      var r = Math.round(s - m * 60);
      if (r === 60) { m += 1; r = 0; }
      return m + " min" + (r ? " " + r + " s" : "");
    }
    if (s < DAY) return oneDecimal(s / 3600) + " hours";
    if (s < 60 * DAY) return oneDecimal(s / DAY) + " days";
    if (s < YEAR) return oneDecimal(s / MONTH) + " months";
    var y = s / YEAR;
    return (y >= 100 ? String(Math.round(y)) : oneDecimal(y)) + " years";
  }

  function withCommas(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  /* ---------- the picture ---------- */

  /* The CPU sits below the middle of the top row, so lines to the top row fan out without crossing
     other boxes. Widths checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px),
     including the longest dynamic text: "waited 475 years", "race: 100/100", "100 in 1 s". */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "Latency sim. A CPU in the middle reaches up to four places inside the computer, the L1 cache, RAM, an SSD and a hard disk, and down to two over the network, a server in the same data center and a server across the ocean. Each box shows the real time for one read or round trip and the same time in human terms, where 1 nanosecond becomes 1 second.",
    groups: [
      { label: "Inside this computer", x: 8, y: 8, w: 724, h: 240 },
      { label: "Over the network", x: 8, y: 262, w: 724, h: 130 }
    ],
    nodes: [
      { id: "cpu", label: "CPU", sub: "does the work", meta: "idle", x: 370, y: 200, w: 150, h: 62, shape: "box", tone: "accent" },
      { id: "l1", label: "L1 cache", sub: realTime(LAT.l1.ns), meta: humanTime(LAT.l1.ns), x: 130, y: 70, w: 130, h: 62, shape: "box", tone: "" },
      { id: "ram", label: "RAM", sub: realTime(LAT.ram.ns), meta: humanTime(LAT.ram.ns), x: 290, y: 70, w: 130, h: 62, shape: "box", tone: "" },
      { id: "ssd", label: "SSD", sub: realTime(LAT.ssd.ns), meta: humanTime(LAT.ssd.ns), x: 450, y: 70, w: 130, h: 62, shape: "box", tone: "" },
      { id: "hdd", label: "Hard disk", sub: realTime(LAT.hdd.ns), meta: humanTime(LAT.hdd.ns), x: 610, y: 70, w: 130, h: 62, shape: "box", tone: "" },
      { id: "dc", label: "Same data center", sub: realTime(LAT.dc.ns) + " round trip", meta: humanTime(LAT.dc.ns), x: 250, y: 330, w: 180, h: 62, shape: "box", tone: "" },
      { id: "far", label: "Across the ocean", sub: realTime(LAT.far.ns) + " round trip", meta: humanTime(LAT.far.ns), x: 490, y: 330, w: 180, h: 62, shape: "box", tone: "" }
    ],
    edges: [
      { from: "cpu", to: "l1" },
      { from: "cpu", to: "ram" },
      { from: "cpu", to: "ssd" },
      { from: "cpu", to: "hdd" },
      { from: "cpu", to: "dc" },
      { from: "cpu", to: "far" }
    ]
  };

  var OP_OPTIONS = ORDER.map(function (k) {
    return { value: k, label: LAT[k].short.charAt(0).toUpperCase() + LAT[k].short.slice(1) + " (" + realTime(LAT[k].ns) + ")" };
  });
  var DISK_OPTIONS = [
    { value: "ssd", label: "SSD (" + realTime(LAT.ssd.ns) + " a read)" },
    { value: "hdd", label: "Hard disk (" + realTime(LAT.hdd.ns) + " a seek)" }
  ];
  var NET_OPTIONS = [
    { value: "far", label: "Across the ocean (" + realTime(LAT.far.ns) + ")" },
    { value: "dc", label: "Same data center (" + realTime(LAT.dc.ns) + ")" }
  ];

  /* ---------- small helpers ---------- */

  function center(id) {
    for (var i = 0; i < DIAGRAM.nodes.length; i++) if (DIAGRAM.nodes[i].id === id) return DIAGRAM.nodes[i];
    return { x: 0, y: 0 };
  }

  function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      var a = center(path[i - 1]), b = center(path[i]);
      len += Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    }
    return len;
  }

  function log10(v) { return Math.log(v) / Math.LN10; }

  // Real seconds a single fetch takes on screen: 0.6 s for L1, about 3.5 s across the ocean.
  function fetchSeconds(ns) { return 0.5 + 0.35 * log10(ns / 0.5 + 1); }

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

  function setBusy(api, on) {
    var S = api.state;
    S.busy = on;
    S.ctl.fetch.disable(on);
    S.ctl.race.disable(on);
  }

  function restoreMeta(api, key) {
    show(api, LAT[key].node, "meta", humanTime(LAT[key].ns));
    setState(api, LAT[key].node, "");
  }

  /* ---------- one fetch ---------- */

  function fetchOnce(api) {
    var S = api.state;
    if (S.busy) return;
    var key = S.op;
    var lat = LAT[key];
    if (!lat) return;
    setBusy(api, true);
    restoreMeta(api, key);
    setState(api, lat.node, "warn");
    var dur = fetchSeconds(lat.ns);
    var path = ["cpu", lat.node, "cpu"];
    var session = S.session;
    S.fetch = { key: key, t: 0, dur: dur, done: false };
    api.log("The CPU asks " + lat.name + " for data. Real time: " + realTime(lat.ns) + ". In human time: " + humanTime(lat.ns) + ". " + lat.feel, "");

    function finish() {
      if (S.session !== session || !S.fetch || S.fetch.done) return;
      S.fetch.done = true;
      S.fetch = null;
      show(api, "cpu", "meta", "waited " + humanTime(lat.ns));
      setState(api, "cpu", "accent");
      setState(api, lat.node, "ok");
      S.stat.last(humanTime(lat.ns));
      setBusy(api, false);
    }

    var arrivals = 0;
    api.dot({
      path: path,
      cls: "dot-req",
      r: 5,
      speed: pathLength(path) / dur,
      onArrive: function (d) {
        arrivals += 1;
        if (arrivals === 1 && d) d.cls("dot-accent");
        if (arrivals >= 2) finish();
      }
    });
    api.after(dur + 0.6, finish);   // safety net if the dot was dropped
  }

  /* ---------- the race ---------- */

  function shuttle(api, lane, session) {
    var S = api.state;
    if (S.session !== session || lane.finished) return;
    api.dot({
      path: ["cpu", LAT[lane.key].node, "cpu"],
      cls: lane.cls,
      r: 4,
      speed: SHUTTLE_SPEED,
      onArrive: function (d, wp) {
        if (wp === "cpu") shuttle(api, lane, session);
      }
    });
  }

  function startRace(api) {
    var S = api.state;
    if (S.busy) return;
    setBusy(api, true);
    var lanes = [
      { stat: "ram", key: "ram", cls: "dot-ok" },
      { stat: "disk", key: S.disk, cls: "dot-wait" },
      { stat: "net", key: S.net, cls: "dot-bad" }
    ];
    lanes.forEach(function (lane) {
      lane.total = LOOKUPS * LAT[lane.key].ns;
      lane.done = 0;
      lane.finished = false;
      S.stat[lane.stat]("racing");
      setState(api, LAT[lane.key].node, "warn");
    });
    S.race = { t: 0, lanes: lanes, order: [] };
    ORDER.forEach(function (k) {
      var inRace = lanes.some(function (l) { return l.key === k; });
      if (!inRace) restoreMeta(api, k);
    });
    api.log("Race: " + LOOKUPS + " lookups each, one after another, from RAM, from " + LAT[S.disk].name + " and from " + LAT[S.net].name +
      ". The race clock speeds up as it goes, about 18 times faster every real second.", "");
    var session = S.session;
    lanes.forEach(function (lane) { shuttle(api, lane, session); });
  }

  function raceStep(api, dt) {
    var S = api.state;
    var R = S.race;
    R.t += dt;
    var longest = 0;
    R.lanes.forEach(function (l) { longest = Math.max(longest, l.total); });
    var ns = Math.min(Math.pow(10, RACE_RATE * R.t), longest);
    show(api, "cpu", "meta", "race: " + realTime(ns));

    R.lanes.forEach(function (lane) {
      if (lane.finished) return;
      var lat = LAT[lane.key];
      lane.done = Math.min(LOOKUPS, Math.floor(ns / lat.ns + 1e-9));
      show(api, lat.node, "meta", "race: " + lane.done + "/" + LOOKUPS);
      if (lane.done < LOOKUPS) return;
      lane.finished = true;
      R.order.push(lane.stat);
      S.stat[lane.stat](realTime(lane.total));
      show(api, lat.node, "meta", LOOKUPS + " in " + realTime(lane.total));
      setState(api, lat.node, R.order.length === 1 ? "ok" : "");
      api.log(lat.short.charAt(0).toUpperCase() + lat.short.slice(1) + ": " + LOOKUPS + " lookups in " + realTime(lane.total) +
        ", which is " + humanTime(lane.total) + " in human time." + (R.order.length === 1 ? " First across the line." : ""),
        R.order.length === 1 ? "ok" : "");
    });

    var allDone = R.lanes.every(function (l) { return l.finished; });
    if (!allDone) return;
    var ram = R.lanes[0], net = R.lanes[2];
    var last = R.lanes.filter(function (l) { return l.stat === R.order[R.order.length - 1]; })[0];
    var story = net.key === "far"
      ? " That's the scanner's problem: " + ORDER_LINES + " of these round trips is " + realTime(ORDER_LINES * LAT.far.ns) + " per order."
      : " That's how the warehouse worked before Monday: " + ORDER_LINES + " of these round trips is " + realTime(ORDER_LINES * LAT.dc.ns) + " per order.";
    api.log("Done. " + LAT[last.key].short.charAt(0).toUpperCase() + LAT[last.key].short.slice(1) + " came last, " +
      withCommas(last.total / ram.total) + " times slower than RAM." + story, net.key === "far" ? "warn" : "");
    S.lastOrder = R.order.slice();
    S.race = null;
    show(api, "cpu", "meta", "race over");
    setBusy(api, false);
  }

  /* ---------- "what is this box" ---------- */

  function boxInfo(key, extra) {
    var lat = LAT[key];
    return "<strong>" + lat.short.charAt(0).toUpperCase() + lat.short.slice(1) + ".</strong> " + extra +
      " One costs about " + realTime(lat.ns) + ", which in human time is " + humanTime(lat.ns) + ".";
  }

  var INFO = {
    cpu: function () {
      return "<strong>CPU.</strong> The chip that does the computing, billions of simple steps a second. When the data it needs isn't already in its caches, it has to wait, and while it waits it does nothing useful. The box counts that wait in human time, where 1 nanosecond becomes 1 second.";
    },
    l1: function () { return boxInfo("l1", "The smallest, fastest cache, built into the CPU itself. It holds copies of what the CPU used a moment ago. L2 and L3 sit behind it, bigger and a little slower."); },
    ram: function () { return boxInfo("ram", "Main memory, the CPU's workbench. Fast, all electronic and right next to the CPU, but small compared with disk and wiped when the power goes."); },
    ssd: function () { return boxInfo("ssd", "Flash storage with no moving parts. It keeps data with the power off. Each read goes through the drive's controller, which is why it's over a thousand times slower than RAM."); },
    hdd: function () { return boxInfo("hdd", "Spinning platters and a moving arm. Before it can read, the arm has to swing to the right track: that's the seek."); },
    dc: function () { return boxInfo("dc", "A question to another machine in the same building, and the answer coming back. The warehouse's back-room server worked like this before Monday."); },
    far: function () { return boxInfo("far", "A question to a machine on another continent and back, like California to the Netherlands in Jeff Dean's list. Nothing beats the speed of light in fiber, so no upgrade makes this shorter. The warehouse's scanners pay it 40 times an order."); }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e07", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.session = {};
      S.busy = false;
      S.fetch = null;
      S.race = null;
      S.lastOrder = [];
      S.op = "ram";
      S.disk = "ssd";
      S.net = "far";
      S.shown = {};
      S.states = {};

      S.ctl = {};
      S.ctl.op = api.control.select("op", "Where the answer lives", OP_OPTIONS, "ram", function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.op && S.ctl.op.value;
        if (LAT[val]) S.op = String(val);
      });
      S.ctl.fetch = api.control.button("fetch", "Fetch it once", function () { fetchOnce(api); }, { tone: "primary" });
      S.ctl.disk = api.control.select("disk", "Race: which disk", DISK_OPTIONS, "ssd", function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.disk && S.ctl.disk.value;
        if (val === "ssd" || val === "hdd") S.disk = val;
      });
      S.ctl.net = api.control.select("net", "Race: which network", NET_OPTIONS, "far", function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.net && S.ctl.net.value;
        if (val === "far" || val === "dc") S.net = val;
      });
      S.ctl.race = api.control.button("race", "Race: " + LOOKUPS + " lookups each", function () { startRace(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        ram: api.stat("ram", "RAM, 100 lookups", "ok"),
        disk: api.stat("disk", "disk, 100 lookups", "warn"),
        net: api.stat("net", "network, 100 lookups", "bad"),
        last: api.stat("last", "last fetch, human time", "")
      };
      S.stat.ram("-");
      S.stat.disk("-");
      S.stat.net("-");
      S.stat.last("-");

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f());
      });
      api.info("<strong>Tip:</strong> click any box to see what it is in plain words.");
      api.log("1 nanosecond becomes 1 second. Pick where the answer lives and fetch it, or race " + LOOKUPS + " lookups.", "");
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.shown) return;
      if (S.fetch && !S.fetch.done) {
        var f = S.fetch;
        f.t += dt;
        var p = Math.min(1, f.t / f.dur);
        var ns = LAT[f.key].ns;
        var shown = 0.5 * Math.pow(ns / 0.5, p);   // log scale from 0.5 ns up to the real value
        show(api, "cpu", "meta", "waiting " + humanTime(shown));
        setState(api, "cpu", "warn");
      }
      if (S.race) raceStep(api, dt);
    },

    selfTest: async function (t) {
      function asks() { return t.logText().split("The CPU asks").length - 1; }

      // 1. One RAM read in human time.
      t.set("op", "ram");
      t.click("fetch");
      await t.run(4);
      t.expect(t.stat("last") === humanTime(LAT.ram.ns) && humanTime(LAT.ram.ns) === "1 min 40 s", "a RAM read, 100 ns, takes 1 min 40 s in human time");
      t.expect(t.logText().indexOf("Real time: 100 ns") >= 0, "the log gives the real time next to the human time");

      // 2. One round trip across the ocean.
      t.set("op", "far");
      t.click("fetch");
      await t.run(5);
      t.expect(t.stat("last") === "4.8 years" && t.node("cpu").text.meta === "waited 4.8 years", "an ocean round trip, 150 ms, takes 4.8 years in human time");

      // 3. While the CPU waits, a second click does nothing.
      var before = asks();
      t.set("op", "l1");
      t.click("fetch");
      t.click("fetch");
      await t.run(2);
      t.expect(asks() === before + 1 && t.stat("last") === "0.5 seconds", "a fetch already in flight ignores a second click, and L1 takes 0.5 seconds");

      // 4. The default race: RAM, SSD, across the ocean.
      t.click("race");
      await t.run(10);
      t.expect(t.stat("ram") === realTime(LOOKUPS * LAT.ram.ns) && t.stat("disk") === realTime(LOOKUPS * LAT.ssd.ns) && t.stat("net") === realTime(LOOKUPS * LAT.far.ns),
        "race totals: 100 RAM reads 10 " + MU + "s, 100 SSD reads 15 ms, 100 ocean round trips 15 s");
      t.expect(t.api.state.lastOrder.join(",") === "ram,disk,net", "RAM finishes first, then the SSD, then the ocean round trips");
      t.expect(t.logText().indexOf("40 of these round trips is 6 s") >= 0, "the race ties back to the scanner: 40 ocean round trips is 6 s");

      // 5. Same data center against a hard disk: the network wins.
      t.set("disk", "hdd");
      t.set("net", "dc");
      t.click("race");
      await t.run(10);
      t.expect(t.stat("disk") === "1 s" && t.stat("net") === "50 ms", "100 hard disk seeks take 1 s, 100 same-building round trips 50 ms");
      t.expect(t.api.state.lastOrder.join(",") === "ram,net,disk", "inside one data center, the network beats a spinning hard disk");
    }
  });
})();
