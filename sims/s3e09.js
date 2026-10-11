/* sims/s3e09-v1.0.0.js  (published as sims/s3e09.js)
   Case s3e09 "Not Everything Is a Table": a store-chooser lab for Rookwood's, a curiosity shop on
   Wickery Row. The shop's four workloads (item lookups, the nightly owner chains, the cabinet
   sensors and the website's baskets) each run on a store the learner picks: PostgreSQL
   (relational), key-value, document, wide-column, graph or time-series. The learner also picks how
   the owner chain is followed (six self-joins as now, a recursive query with no cycle guard, or a
   recursive query that stops at cycles), whether the sales have an index, and whether the readings
   get a time-partitioned table with hourly rollups and 30-day raw retention. Four buttons load the
   case's four reply options.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: Tuesday night from 23:00 to 07:00 at an hour a real second.
     The owner-chain job starts on the first tick and finishes at 23:00 plus its run time, or runs
     until 07:00 and is stopped. Stats: item lookup, owner chains, the 12-month humidity chart,
     baskets, stores to run, data kept in two stores, and how many times the music box's printed
     chain says the shop owned it. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e09-v1.0.0.json):
   - post: the ledger is one PostgreSQL table with 61 columns, 53 of them empty on most rows, and
     40,000 rows: 6,140 objects, 25,180 sales and 8,680 everything else (people, repairs, baskets).
     Mrs Rookwood typed in the last of the eleven drawers of cards on Monday; the 1991 card (Pendle
     sold the music box back to the shop) was in it. The owner-chain job starts at 23:00 and joins
     the ledger to itself six times, one join per step, so it follows 6 steps for each object.
   - the all-night run (the sim's cost model, stated in sim.lede): with no index, every step of every
     chain reads the whole ledger, and the shop's server reads 60,000 ledger rows a second.
     6,140 objects x 6 steps x 40,000 rows = 1,473,600,000 rows; / 60,000 = 24,560 s =
     6 h 49 min 20 s, so Tuesday's job finished at 05:49:20 on Wednesday.
   - with the sales indexed on (object, seller), a step is one index lookup, 0.1 ms:
     six self-joins: 36,840 lookups = 3.684 s, shown "3.7 s";
     the recursive query that stops at cycles makes one lookup per sale reached and one per chain
     end: 25,180 + 6,140 = 31,320 lookups = 3.132 s, shown "3.1 s".
     The same recursive query without the index: 31,320 x 40,000 / 60,000 = 20,880 s =
     5 h 48 min 0 s.
     The recursive query with no cycle guard never ends on the music box, so at 07:00 Mrs Rookwood
     stops it, index or not.
   - six self-joins cut every chain at 6 steps: 37 objects have more than 6 sales.
   - the music box, lot 0417: Marchetti sold it to the shop in 1962; the shop sold it to Pendle in
     1974; Pendle sold it back in 1991; the shop sold it to Thorley in 2003. Half the old cards have
     no date, so a chain follows names: the buyer on one sale is the seller on the next. From the
     1991 sale the shop is the seller again, which matches the 1974 sale as well as the 2003 one.
     Six self-joins print, last: Marchetti, shop, Pendle, shop, Pendle, shop, Pendle (6 sales, the
     shop 3 times). Stopping at cycles: Marchetti, shop, Pendle, shop, Thorley (the shop twice).
   - readings: 14 cabinets x 1,440 minutes a day = 20,160 a day; 1,095 days (three years) =
     22,075,200 rows. The morning chart shows each cabinet over the last 12 months: 14 x 525,600 =
     7,358,400 raw readings, or 14 x 8,760 = 122,640 hourly rollups. Raw kept for 30 days under the
     retention rule: 14 x 43,200 = 604,800 rows. The readings table as built has no index, so the
     chart reads all 22,075,200 rows at 500,000 a second: 44.1504 s, shown "44.2 s". From the
     hourly rollups: 122,640 / 500,000 = 0.24528 s, shown "0.25 s".
   - other stores (the sim's cost model, stated in the terms): one record by key: PostgreSQL 1 ms,
     key-value 0.5 ms, document 1 ms, wide-column 2 ms, graph 2 ms, time-series not possible.
     One chain step where the app or store follows a link: key-value 0.5 ms, document 1 ms,
     wide-column 2 ms, graph 0.01 ms, time-series not possible. So with the cycle guard:
     document 31.32 s "31.3 s", key-value 15.66 s "15.7 s", wide-column 62.64 s "1 min 3 s",
     graph 0.3132 s "0.31 s"; with six steps: document "36.8 s", key-value "18.4 s",
     wide-column "1 min 14 s", graph "0.37 s".
     The 12-month chart: time-series store reads the 122,640 hourly rollups, "0.25 s"; wide-column
     reads the year's raw partitions, 7,358,400 at 1,000,000 a second, "7.4 s"; document 250,000 a
     second, "29.4 s"; graph 50,000 a second, 147.168 s, "2 min 27 s"; key-value has no range
     reads, "not possible". Sensor writes, 14 a minute, are easy for every store.
   - reply options: index 0, everything in a document store (chains 31.3 s, chart 29.4 s, 1 store);
     index 1, everything in a graph store (chains 0.31 s, chart 2 min 27 s, items 2 ms, 1 store);
     index 2, the ok option, PostgreSQL with the recursive query that stops at cycles, the sales
     index and hourly rollups (chains 3.1 s, chart 0.25 s, 1 store); index 3, a store for each job:
     documents for objects, a graph for chains, time-series for readings, key-value for baskets
     (chains 0.31 s, chart 0.25 s, baskets 0.5 ms, 4 stores, sales and people kept in two stores).

   Teaching model (stated in sim.lede):
   - The night runs from 23:00 to 07:00 at an hour a real second. The job starts on the first tick
     and finishes at 23:00 plus its run time from the cost model; a job still running at 07:00 is
     stopped. Changing any setting replays the night from 23:00.
   - Data kept in two stores: if owner chains run on a different store from item lookups, the sales
     and people live in both, written twice with no single transaction across them.
   - Nothing counted depends on api.rand(); the sim draws no random numbers.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Workloads, x 145, 260 wide (15 to 275), 58 high, y 50, 150, 250, 350: 42px gaps. Longest sub
     "one object by its lot number", 28 chars, 202px; longest meta "Wide-column: 1 min 14 s" and
     "PostgreSQL: 6 h 49 min 20 s", 27 chars, 178px; "Time-series: not possible", 25 chars.
   - Stores, two columns at x 410 and 620, 180 wide (320 to 500, 530 to 710), y 50, 150, 250:
     longest sub "partition and time" and "readings over time", 18 chars, 130px; longest label
     "Wide-column store" and "Time-series store", 17 chars, 133px.
   - Music box, x 515, 400 wide (315 to 715), y 350: longest sub "Marchetti, shop, Pendle, shop,
     Pendle, shop, Pendle", 51 chars, 367px; meta "the shop owned it 3 times", 25 chars.
   - No edges: which store serves each workload is written in the workload's meta line.

   Catalog note: concepts are the catalog's ids for s3e09 (nosql-families, key-value, document,
   wide-column).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START = 23 * 3600;            // Tuesday 23:00:00, when the owner-chain job starts
  var END = 31 * 3600;              // Wednesday 07:00:00, when Mrs Rookwood comes in
  var SPEED = 3600;                 // an hour a real second
  var OBJECTS = 6140;
  var SALES = 25180;
  var LEDGER_ROWS = 40000;          // 6,140 objects + 25,180 sales + 8,680 everything else
  var STEPS = 6;                    // six self-joins
  var FIXED_LOOKUPS = OBJECTS * STEPS;      // 36,840
  var GUARD_LOOKUPS = SALES + OBJECTS;      // 31,320
  var LEDGER_RATE = 60000;          // ledger rows read a second
  var CUT = 37;                     // objects with more than 6 sales
  var READINGS = 22075200;          // 14 cabinets x 1,440 x 1,095 days
  var YEAR_RAW = 7358400;           // 14 x 525,600
  var YEAR_HOURLY = 122640;         // 14 x 8,760
  var RAW_KEPT = 604800;            // 14 x 43,200, 30 days
  var READ_RATE = 500000;           // readings read a second, PostgreSQL and time-series

  var STORES = [
    { value: "pg", label: "PostgreSQL (relational)" },
    { value: "kv", label: "Key-value store" },
    { value: "doc", label: "Document store" },
    { value: "wide", label: "Wide-column store" },
    { value: "graph", label: "Graph store" },
    { value: "ts", label: "Time-series store" }
  ];
  var SHORT = { pg: "PostgreSQL", kv: "Key-value", doc: "Document", wide: "Wide-column", graph: "Graph", ts: "Time-series" };
  var NAME = { pg: "PostgreSQL", kv: "the key-value store", doc: "the document store", wide: "the wide-column store", graph: "the graph store", ts: "the time-series store" };
  var GET_MS = { pg: 1, kv: 0.5, doc: 1, wide: 2, graph: 2, ts: null };
  var HOP_MS = { kv: 0.5, doc: 1, wide: 2, graph: 0.01, ts: null };
  var CHART_RATE = { wide: 1000000, doc: 250000, graph: 50000 };

  var HOWS = [
    { value: "fixed", label: "Six self-joins (as now)" },
    { value: "loop", label: "Recursive, no cycle guard" },
    { value: "guard", label: "Recursive, stops at cycles" }
  ];

  var CHAIN_FIXED = "Marchetti, shop, Pendle, shop, Pendle, shop, Pendle";
  var CHAIN_GUARD = "Marchetti, shop, Pendle, shop, Thorley";
  var CHAIN_LOOP = "Marchetti, shop, Pendle, shop, Pendle, shop, ...";

  /* ---------- small helpers ---------- */

  function fmt(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function clockAt(sec) {
    var s = Math.round(sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  // 0.3132 -> "0.31 s", 3.132 -> "3.1 s", 62.64 -> "1 min 3 s", 24560 -> "6 h 49 min 20 s".
  function dur(s) {
    if (s < 1) return (Math.round(s * 100) / 100).toFixed(2) + " s";
    if (s < 60) return (Math.round(s * 10) / 10).toFixed(1) + " s";
    var t = Math.round(s);
    if (t < 3600) return Math.floor(t / 60) + " min " + (t % 60) + " s";
    return Math.floor(t / 3600) + " h " + Math.floor((t % 3600) / 60) + " min " + (t % 60) + " s";
  }

  function msText(ms) { return ms === null ? "not possible" : String(ms) + " ms"; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the cost model ---------- */

  // The owner-chain job: { kind: "na" | "loop" | "done", secs, lookups }.
  function chainCost(S) {
    var st = S.use.chains;
    if (st === "ts") return { kind: "na" };
    if (S.how === "loop") return { kind: "loop" };
    var lookups = S.how === "fixed" ? FIXED_LOOKUPS : GUARD_LOOKUPS;
    var secs;
    if (st === "pg") secs = S.index ? lookups / 10000 : lookups * LEDGER_ROWS / LEDGER_RATE;
    else secs = lookups * HOP_MS[st] / 1000;
    return { kind: "done", secs: secs, lookups: lookups };
  }

  // The 12-month humidity chart, in seconds, or null when the store has no range reads.
  function chartCost(S) {
    var st = S.use.sensors;
    if (st === "kv") return null;
    if (st === "pg") return S.rollup ? YEAR_HOURLY / READ_RATE : READINGS / READ_RATE;
    if (st === "ts") return YEAR_HOURLY / READ_RATE;
    return YEAR_RAW / CHART_RATE[st];
  }

  function storeCount(S) {
    var seen = {};
    var n = 0;
    ["items", "chains", "sensors", "baskets"].forEach(function (w) {
      if (!seen[S.use[w]]) { seen[S.use[w]] = true; n += 1; }
    });
    return n;
  }

  function copies(S) { return S.use.items !== S.use.chains ? 1 : 0; }

  function chainLine(S) {
    if (S.how === "fixed") return CHAIN_FIXED;
    if (S.how === "loop") return CHAIN_LOOP;
    return CHAIN_GUARD;
  }

  function shopTimes(S) { return S.how === "fixed" ? 3 : 2; }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "Store-chooser lab for Rookwood's curiosity shop. Four workloads on the left: item lookups by lot number, the nightly owner chains for 6,140 objects, the cabinet sensors writing 14 readings a minute with a 12-month humidity chart, and the website's baskets. Each shows the store that serves it and its time from the sim's cost model. On the right, six stores: PostgreSQL, key-value, document, wide-column, graph and time-series, each marked with how many workloads it serves. Below them, the music box's chain as the owner-chain job prints it.",
    nodes: [
      { id: "items", label: "Item lookups", sub: "one object by its lot number", meta: "PostgreSQL: 1 ms", x: 145, y: 50, w: 260, h: 58, shape: "box", tone: "" },
      { id: "chains", label: "Owner chains", sub: "6,140 objects, from 23:00", meta: "PostgreSQL: not started", x: 145, y: 150, w: 260, h: 58, shape: "box", tone: "" },
      { id: "sensors", label: "Cabinet sensors", sub: "14 writes a minute", meta: "PostgreSQL: chart 44.2 s", x: 145, y: 250, w: 260, h: 58, shape: "box", tone: "" },
      { id: "baskets", label: "Website baskets", sub: "get and set by basket id", meta: "PostgreSQL: 1 ms", x: 145, y: 350, w: 260, h: 58, shape: "box", tone: "" },
      { id: "pg", label: "PostgreSQL", sub: "relational", meta: "serves 4", x: 410, y: 50, w: 180, h: 58, shape: "db", tone: "ok" },
      { id: "kv", label: "Key-value store", sub: "get and set by key", meta: "not used", x: 620, y: 50, w: 180, h: 58, shape: "db", tone: "muted" },
      { id: "doc", label: "Document store", sub: "whole records", meta: "not used", x: 410, y: 150, w: 180, h: 58, shape: "db", tone: "muted" },
      { id: "wide", label: "Wide-column store", sub: "partition and time", meta: "not used", x: 620, y: 150, w: 180, h: 58, shape: "db", tone: "muted" },
      { id: "graph", label: "Graph store", sub: "nodes and links", meta: "not used", x: 410, y: 250, w: 180, h: 58, shape: "db", tone: "muted" },
      { id: "ts", label: "Time-series store", sub: "readings over time", meta: "not used", x: 620, y: 250, w: 180, h: 58, shape: "db", tone: "muted" },
      { id: "box", label: "Music box, lot 0417", sub: "not printed yet", meta: "the job has not run", x: 515, y: 350, w: 400, h: 58, shape: "box", tone: "" }
    ],
    edges: []
  };

  /* ---------- the night ---------- */

  function configText(S) {
    var how = { fixed: "six self-joins", loop: "a recursive query with no cycle guard", guard: "a recursive query that stops at cycles" };
    return "Items on " + NAME[S.use.items] + ", owner chains on " + NAME[S.use.chains] +
      (S.use.chains === "ts" ? "" : " by " + how[S.how] +
        (S.use.chains === "pg" ? (S.index ? ", sales indexed on (object, seller)" : ", no index on the sales") : "")) +
      ", readings on " + NAME[S.use.sensors] +
      (S.use.sensors === "pg" ? (S.rollup ? " (time-partitioned, hourly rollups, raw kept 30 days)" : " (one table, no index, kept forever)") : "") +
      ", baskets on " + NAME[S.use.baskets] + ". Stores to run: " + storeCount(S) + ".";
  }

  function consistencyNotes(api) {
    var S = api.state;
    if (copies(S)) {
      api.log("Sales and people live in " + NAME[S.use.items] + " and are copied to " + NAME[S.use.chains] +
        " for the chains: two writes, no single transaction, so the two can disagree.", "warn");
    }
    if (S.use.baskets !== S.use.items) {
      api.log("Baskets hold lot numbers whose objects live in " + NAME[S.use.items] +
        ": nothing stops a basket holding an object that has just been sold.", "warn");
    }
    if (S.use.sensors !== S.use.items && S.use.sensors !== "pg") {
      api.log("Readings stand alone in " + NAME[S.use.sensors] + ": nothing to keep in step, but one more store to run, back up and secure.", "");
    }
  }

  function startNight(api) {
    var S = api.state;
    S.phase = "waiting";
    S.began = false;
    S.cost = chainCost(S);
    api.clock = START;
    api.speed = SPEED;
  }

  function replay(api, what) {
    var S = api.state;
    startNight(api);
    api.log(what + " Replaying Tuesday from 23:00. " + configText(S), "");
    consistencyNotes(api);
    draw(api);
  }

  function beginJob(api) {
    var S = api.state;
    S.began = true;
    var c = S.cost;
    if (c.kind === "na") {
      S.phase = "na";
      api.log("23:00:00 The owner-chain job can't start: the time-series store finds readings by time, and has no way to look up a sale by its seller.", "bad");
      return;
    }
    S.phase = "running";
    var how = S.how === "fixed" ? "six self-joins, " + fmt(OBJECTS) + " objects x 6 steps" :
      (S.how === "loop" ? "a recursive query with no cycle guard, until no new owner turns up" : "a recursive query that stops at cycles");
    api.log("23:00:00 The owner-chain job starts on " + NAME[S.use.chains] + ": " + how + ".", "");
  }

  function finishJob(api) {
    var S = api.state;
    var c = S.cost;
    S.phase = "done";
    var at = clockAt(START + c.secs);
    var tail = S.how === "fixed" ? " " + CUT + " chains cut at 6 steps." : " No chain cut short.";
    api.log(at + " Owner chains finished after " + dur(c.secs) + ": " + fmt(c.lookups) +
      (S.use.chains === "pg" && !S.index ? " steps, each reading all " + fmt(LEDGER_ROWS) + " ledger rows." : " lookups.") + tail,
      c.secs > 3600 ? "bad" : (c.secs > 60 ? "warn" : "ok"));
    if (S.how === "fixed") {
      api.log("Above it: lot 0417, music box: Marchetti, shop, Pendle, shop, Thorley.", "");
      api.log("Last line: lot 0417, music box: " + CHAIN_FIXED + ". The shop has owned this object 3 times.", "bad");
    } else {
      api.log("Lot 0417, music box: " + CHAIN_GUARD + ". The shop owned it twice, 1962 to 1974 and 1991 to 2003. The branch back to the 1974 sale stopped: that sale was already on the path.", "ok");
    }
  }

  function stopJob(api) {
    var S = api.state;
    S.phase = "stopped";
    api.log("07:00:00 Mrs Rookwood stops the job. It never finished: the music box's chain goes " + CHAIN_LOOP +
      " The 1991 sale leads back to the 1974 sale, and round again." + (S.use.chains === "pg" && S.index ? " The index made every lap fast; it didn't end the loop." : ""), "bad");
  }

  /* ---------- drawing ---------- */

  function chainText(S) {
    var c = S.cost;
    if (S.phase === "na" || c.kind === "na") return "not possible";
    if (S.phase === "waiting") return "not started";
    if (S.phase === "running") return "running";
    if (S.phase === "stopped") return "never ends";
    return dur(c.secs);
  }

  function shopText(S) {
    if (S.phase === "done") return String(shopTimes(S));
    if (S.phase === "stopped") return "loops";
    if (S.phase === "na") return "none";
    return "not run";
  }

  function tone(v, warnAt, badAt) {
    if (v === null) return "bad";
    if (v >= badAt) return "bad";
    if (v >= warnAt) return "warn";
    return "ok";
  }

  function draw(api) {
    var S = api.state;
    var it = GET_MS[S.use.items];
    var bk = GET_MS[S.use.baskets];
    var ch = chartCost(S);
    var ct = chainText(S);

    api.node("items").text("meta", SHORT[S.use.items] + ": " + msText(it));
    api.node("items").set(it === null ? "bad" : "ok");
    api.node("chains").text("meta", SHORT[S.use.chains] + ": " + ct);
    var cs = "";
    if (S.phase === "done") cs = tone(S.cost.secs, 60, 3600);
    else if (S.phase === "stopped" || S.phase === "na") cs = "bad";
    else if (S.phase === "running") cs = "warn";
    api.node("chains").set(cs);
    api.node("sensors").text("meta", SHORT[S.use.sensors] + ": " + (ch === null ? "not possible" : "chart " + dur(ch)));
    api.node("sensors").set(tone(ch, 5, 30));
    api.node("baskets").text("meta", SHORT[S.use.baskets] + ": " + msText(bk));
    api.node("baskets").set(bk === null ? "bad" : "ok");

    STORES.forEach(function (o) {
      var n = 0;
      ["items", "chains", "sensors", "baskets"].forEach(function (w) { if (S.use[w] === o.value) n += 1; });
      api.node(o.value).text("meta", n ? "serves " + n : "not used");
      api.node(o.value).set(n ? "ok" : "muted");
    });

    var b = api.node("box");
    if (S.phase === "done") {
      b.text("sub", chainLine(S));
      b.text("meta", "the shop owned it " + shopTimes(S) + " times");
      b.set(S.how === "fixed" ? "bad" : "ok");
    } else if (S.phase === "stopped") {
      b.text("sub", CHAIN_LOOP);
      b.text("meta", "round and round: never printed");
      b.set("bad");
    } else if (S.phase === "na") {
      b.text("sub", "not printed");
      b.text("meta", "the job could not run");
      b.set("bad");
    } else {
      b.text("sub", "not printed yet");
      b.text("meta", S.phase === "running" ? "the job is running" : "the job has not run");
      b.set("");
    }

    S.stat.items(msText(it));
    S.stat.chain(ct);
    S.stat.sensors(ch === null ? "not possible" : dur(ch));
    S.stat.baskets(msText(bk));
    S.stat.stores(String(storeCount(S)));
    S.stat.copies(String(copies(S)));
    S.stat.shop(shopText(S));
  }

  /* ---------- the clock ---------- */

  function step(api) {
    var S = api.state;
    if (!S.use) return;
    if (S.phase === "over") return;
    if (!S.began) beginJob(api);
    if (S.phase === "running" && S.cost.kind === "done" && api.clock >= START + S.cost.secs) finishJob(api);
    if (api.clock >= END) {
      api.clock = END;
      api.speed = 0;
      if (S.phase === "running") stopJob(api);
    }
    draw(api);
  }

  /* ---------- controls ---------- */

  function setUse(api, w, v) {
    var o = pick(STORES, v);
    if (!o) return;
    api.state.use[w] = String(o.value);
    var what = { items: "Item lookups", chains: "Owner chains", sensors: "Cabinet sensors", baskets: "Website baskets" };
    replay(api, what[w] + " now on " + NAME[api.state.use[w]] + ".");
  }

  function setHow(api, v) {
    var o = pick(HOWS, v);
    if (!o) return;
    api.state.how = String(o.value);
    replay(api, "The chain is now followed by " + o.label.toLowerCase() + ".");
  }

  function preset(api, use, how, index, rollup, what) {
    var S = api.state;
    S.use = { items: use[0], chains: use[1], sensors: use[2], baskets: use[3] };
    S.how = how;
    S.index = index;
    S.rollup = rollup;
    S.ctl.items.set(use[0]);
    S.ctl.chains.set(use[1]);
    S.ctl.sensors.set(use[2]);
    S.ctl.baskets.set(use[3]);
    S.ctl.how.set(how);
    S.ctl.index.set(index);
    S.ctl.rollup.set(rollup);
    replay(api, what);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    items: "<strong>Item lookups.</strong> The till and the website fetch one object's whole record by its lot number, a few thousand times a day. Any store with a key does this in a millisecond or two. A time-series store finds readings by time and can't.",
    chains: "<strong>Owner chains.</strong> At 23:00 a job works out each of the 6,140 objects' chains of owners. Half the old cards have no date, so it follows names: the buyer on one sale is the seller on the next. As built it joins the ledger to itself six times, and with no index every step reads all 40,000 rows, 60,000 a second. A recursive query keeps going until no new owner turns up, and a cycle guard stops it when a sale is already on the path.",
    sensors: "<strong>Cabinet sensors.</strong> Fourteen glass cabinets each write a humidity reading a minute: 20,160 a day, 22,075,200 in three years. Writes are easy for any store. The morning chart shows each cabinet over the last 12 months, which is the hard part: a range read by time, best served from hourly rollups.",
    baskets: "<strong>Website baskets.</strong> The website keeps each visitor's basket under a basket id: get it, change it, set it back, a few hundred times a day. This is exactly what a key-value store is for, and at this size PostgreSQL does it too.",
    pg: "<strong>PostgreSQL.</strong> The shop's relational database: tables, joins, transactions and indexes. A recursive query can follow chains, and a time-partitioned table with an hourly rollup table can serve the chart.",
    kv: "<strong>Key-value store.</strong> Get and set a value by its key, and little else: no joins and no reads of a range of keys. Fast for baskets and sessions.",
    doc: "<strong>Document store.</strong> Each record is one document whose fields can differ from its neighbours', read and written whole. In this sim, following a chain is one read a step, done by the app: 1 ms a step.",
    wide: "<strong>Wide-column store.</strong> Rows grouped into partitions by a partition key and sorted inside each, built for huge, append-heavy data read by partition and time, such as messages per channel. In this sim the chart reads each cabinet's raw partitions for the year.",
    graph: "<strong>Graph store.</strong> Nodes and the relationships between them, stored side by side, so following a relationship is cheap: 0.01 ms a step in this sim. Ranges of readings are not its job: 50,000 a second.",
    ts: "<strong>Time-series store.</strong> Timestamped readings written in order, read by time range, rolled up and expired. It serves the chart from hourly rollups, but it has no lookups by key or by seller.",
    box: "<strong>The music box, lot 0417.</strong> The job's last line on Tuesday. Marchetti sold it to the shop in 1962, the shop sold it to Pendle in 1974, Pendle sold it back in 1991, and the shop sold it to Thorley in 2003. From the 1991 sale, the shop is the seller again, and that matches the 1974 sale as well as the 2003 one."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s3e09", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.use = { items: "pg", chains: "pg", sensors: "pg", baskets: "pg" };
      S.how = "fixed";
      S.index = false;
      S.rollup = false;

      S.ctl = {};
      S.ctl.items = api.control.select("useItems", "Item lookups use", STORES, "pg", function (v) { setUse(api, "items", v); });
      S.ctl.chains = api.control.select("useChains", "Owner chains use", STORES, "pg", function (v) { setUse(api, "chains", v); });
      S.ctl.sensors = api.control.select("useSensors", "Cabinet sensors use", STORES, "pg", function (v) { setUse(api, "sensors", v); });
      S.ctl.baskets = api.control.select("useBaskets", "Website baskets use", STORES, "pg", function (v) { setUse(api, "baskets", v); });
      S.ctl.how = api.control.select("how", "How the chain is followed", HOWS, "fixed", function (v) { setHow(api, v); });
      S.ctl.index = api.control.toggle("index", "PostgreSQL: sales indexed on (object, seller)", false, function (on) {
        api.state.index = !!on;
        replay(api, on ? "The sales now have an index on (object, seller)." : "The sales index is gone.");
      });
      S.ctl.rollup = api.control.toggle("rollup", "PostgreSQL: readings by time, hourly rollups, raw kept 30 days", false, function (on) {
        api.state.rollup = !!on;
        replay(api, on ? "Readings now go into a time-partitioned table with hourly rollups; raw readings older than 30 days are deleted, leaving " + fmt(RAW_KEPT) + "." : "Readings are back in one table, kept forever.");
      });
      S.ctl.optDoc = api.control.button("optDoc", "Option: all in a document store", function () {
        preset(api, ["doc", "doc", "doc", "doc"], "guard", false, false, "Option: everything moves into a document store.");
      });
      S.ctl.optGraph = api.control.button("optGraph", "Option: all in a graph store", function () {
        preset(api, ["graph", "graph", "graph", "graph"], "guard", false, false, "Option: everything moves into a graph store.");
      });
      S.ctl.optPg = api.control.button("optPg", "Option: keep PostgreSQL, fixed", function () {
        preset(api, ["pg", "pg", "pg", "pg"], "guard", true, true, "Option: PostgreSQL stays, with the recursive query that stops at cycles, the sales index and hourly rollups.");
      });
      S.ctl.optSpec = api.control.button("optSpec", "Option: a store for each job", function () {
        preset(api, ["doc", "graph", "ts", "kv"], "guard", false, false, "Option: a store for each job, four in all.");
      });
      S.ctl.reset = api.control.button("reset", "Back to as built", function () { api.reset(); });

      S.stat = {
        items: api.stat("items", "item lookup", ""),
        chain: api.stat("chain", "owner chains, all 6,140", "bad"),
        sensors: api.stat("sensors", "humidity chart, 12 months", ""),
        baskets: api.stat("baskets", "basket get or set", ""),
        stores: api.stat("stores", "stores to run", ""),
        copies: api.stat("copies", "data kept in two stores", "warn"),
        shop: api.stat("shop", "times the shop owned the music box, as printed", "")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f);
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
      api.log("Tuesday, 23:00. The ledger: one table, 61 columns, 40,000 rows. The readings: 22,075,200 rows. " + configText(S), "");
      draw(api);
    },

    step: function (api) { step(api); },

    selfTest: async function (t) {
      var a;

      // 1. The opening state: Tuesday 23:00, before the job starts.
      t.expect(t.stat("chain") === "not started" && t.stat("stores") === 1 && t.stat("copies") === 0 &&
        t.stat("items") === "1 ms" && t.stat("sensors") === "44.2 s" && t.stat("shop") === "not run" &&
        t.logText().indexOf("finished") < 0 && t.node("chains").text.meta === "PostgreSQL: not started",
        "Opens at 23:00 on Tuesday, as built, before the owner-chain job starts; the chart takes 44.2 s");

      // 2. Tuesday night as built: six self-joins, no index.
      await t.run(7);
      t.expect(t.stat("chain") === "6 h 49 min 20 s" && t.stat("shop") === 3 &&
        t.logText().indexOf("05:49:20 Owner chains finished after 6 h 49 min 20 s: 36,840 steps, each reading all 40,000 ledger rows.") >= 0 &&
        t.logText().indexOf("Last line: lot 0417, music box: Marchetti, shop, Pendle, shop, Pendle, shop, Pendle. The shop has owned this object 3 times.") >= 0,
        "As built, the job runs until 05:49:20 and prints the music box with the shop as owner 3 times");

      // 3. The index alone: fast, and still wrong.
      t.set("index", true);
      await t.run(1);
      t.expect(t.stat("chain") === "3.7 s" && t.stat("shop") === 3 && t.logText().indexOf("37 chains cut at 6 steps.") >= 0,
        "Six self-joins with the index: 3.7 s, still 37 chains cut and the shop 3 times");

      // 4. A recursive query with no cycle guard never ends, index or not.
      t.set("how", "loop");
      await t.run(8.5);
      t.expect(t.stat("chain") === "never ends" && t.stat("shop") === "loops" &&
        t.logText().indexOf("07:00:00 Mrs Rookwood stops the job. It never finished") >= 0 &&
        t.logText().indexOf("The index made every lap fast; it didn't end the loop.") >= 0,
        "Recursive with no cycle guard: the music box loops until 07:00, even with the index");

      // 5. Stopping at cycles without the index: right, and slow.
      t.set("index", false);
      t.set("how", "guard");
      await t.run(6);
      t.expect(t.stat("chain") === "5 h 48 min 0 s" && t.stat("shop") === 2 &&
        t.logText().indexOf("04:48:00 Owner chains finished after 5 h 48 min 0 s") >= 0,
        "Recursive and stopping at cycles, no index: 5 h 48 min, the shop twice");

      // 6. Stopping at cycles with the index: right, and fast.
      t.set("index", true);
      await t.run(1);
      t.expect(t.stat("chain") === "3.1 s" && t.stat("shop") === 2 &&
        t.logText().indexOf("Lot 0417, music box: Marchetti, shop, Pendle, shop, Thorley. The shop owned it twice") >= 0 &&
        t.node("box").text.meta === "the shop owned it 2 times",
        "Recursive, stops at cycles, with the index: 3.1 s, and the music box ends with Thorley");

      // 7. Hourly rollups for the readings.
      t.set("rollup", true);
      t.expect(t.stat("sensors") === "0.25 s" && t.stat("stores") === 1,
        "Hourly rollups: the 12-month chart reads 122,640 rows, 0.25 s, still one store");

      // 8. A key-value store has no range reads.
      t.set("useSensors", "kv");
      a = t.stat("sensors");
      t.set("useSensors", "pg");
      t.expect(a === "not possible" && t.stat("stores") === 1, "A key-value store can't read a range of readings by time");

      // 9. The ok option.
      t.click("optPg");
      await t.run(1);
      t.expect(t.stat("chain") === "3.1 s" && t.stat("sensors") === "0.25 s" && t.stat("items") === "1 ms" &&
        t.stat("baskets") === "1 ms" && t.stat("stores") === 1 && t.stat("copies") === 0 && t.stat("shop") === 2,
        "Keep PostgreSQL, fixed: chains 3.1 s, chart 0.25 s, one store");

      // 10. Everything in a document store.
      t.click("optDoc");
      await t.run(1);
      t.expect(t.stat("chain") === "31.3 s" && t.stat("sensors") === "29.4 s" && t.stat("stores") === 1 && t.stat("items") === "1 ms",
        "All in a document store: chains 31.3 s, chart 29.4 s");

      // 11. Everything in a graph store.
      t.click("optGraph");
      await t.run(1);
      t.expect(t.stat("chain") === "0.31 s" && t.stat("sensors") === "2 min 27 s" && t.stat("items") === "2 ms" && t.stat("stores") === 1,
        "All in a graph store: chains 0.31 s, but the chart takes 2 min 27 s");

      // 12. A store for each job.
      t.click("optSpec");
      await t.run(1);
      t.expect(t.stat("chain") === "0.31 s" && t.stat("sensors") === "0.25 s" && t.stat("baskets") === "0.5 ms" &&
        t.stat("stores") === 4 && t.stat("copies") === 1 &&
        t.logText().indexOf("two writes, no single transaction, so the two can disagree.") >= 0,
        "A store for each job: fast everywhere, four stores to run, sales and people kept in two");
    }
  });
})();
