/* sims/s4e16-v1.0.0.js  (published as sims/s4e16.js)
   Case s4e16 "Field Report: The Data Pipeline": a pipeline lab for Scaldwick Transit's Tapstream,
   copied in 2017 from Netflix's Keystone posts of 2016. 240 gates produce taps to a fronting Kafka
   cluster and a router fans them out to the fare engine, the data lake and the dashboards. The
   learner sets the fare path's acks, min.insync.replicas, unclean leader election, the gates'
   buffer behaviour, the replication factor, the brokers and the outage, presses Run the rush hour,
   and reads how many taps were produced, accepted, lost and where, how many riders were charged
   the maximum fare, and what the telemetry path (left on the copied settings) lost beside it.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: the seven settings above, a fare database first switch and
     four outages; 16 stats; selfTest: 12 assertions.

   The model (stated in sim.lede; a teaching model, whole seconds, t = seconds after 17:45:00):
   - The window is 17:45:00 to 17:53:00, 480 s. 240 gates send 240 taps a second (one per gate)
     over 12 partitions keyed by card: 20 a second each. Half are tap-ins, half tap-outs.
   - N brokers k1..kN. Partition p is led by broker p mod N; its other copies sit on the next
     brokers in turn ((p + 1) mod N, (p + 2) mod N), replication factor RF copies in all.
   - A copy that is alive and copying is in sync and holds everything its leader has (catch-up is
     instant in this model). acks = 1: a tap is accepted when the leader has it. acks = all: the
     partition refuses writes if fewer than min.insync.replicas copies are in sync, and a tap waits
     while any in-sync copy is not copying (dead or cut off) until that copy leaves the set.
     min.insync.replicas is ignored with acks = 1, as in Kafka.
   - The night: at 17:45:20 the link from k2 to k3 fails, so k3 stops copying partitions k2 leads.
     A copy that copies nothing for 30 s leaves the in-sync set (17:45:50; Tapstream's
     replica.lag.time.max.ms, given data). k2 stops at 17:46:00. Kafka notices at 17:46:12 (given
     data): k2 leaves every in-sync set, and each partition k2 led gets a new leader: an in-sync
     copy if there is one; otherwise, with unclean election on, the first live out-of-date copy,
     and every accepted tap that copy lacks is cut; otherwise none until k2 is back at 17:52:00
     (with all its data, on a repaired link). A new leader's other live copies are in sync at once.
   - "k2 stops, every copy in sync": the same without the link fault.
   - A tap that can't be accepted waits at its gate. Drop (as copied, block.on.buffer.full = false):
     each gate's producer holds at most 3 waiting taps (720 across 240 gates, one shared pool in the
     model); a new tap that finds the pool full is dropped, and a tap still waiting after 60 s of
     retries is dropped. Block and fail loudly: no cap; a tap still waiting after 60 s
     (max.block.ms = 60000) fails loudly: the gate raises a fault and keeps it in its own journal
     for upload next day. Not lost, not charged wrongly, but a gate in fault.
   - Each lost tap is one rider charged the maximum fare, 6.80 pounds: a lost tap-in leaves an exit
     with no entry, a lost tap-out an entry with no exit. No journey is shorter than a minute, so
     no rider loses both taps.
   - Fare database first: each gate writes the tap to the fare database and waits for its commit;
     no fare depends on the brokers. "The fare database stalls 40 s from 17:46:00" holds every tap
     at every gate for up to 40 s. On the Kafka path the router waits out a stall and gates notice
     nothing.
   - Telemetry path: 120 gate reports a second (one per gate every 2 s), 12 partitions, 3 brokers,
     RF 2, acks = 1, unclean on, drop at 3 per gate (its own producer), same outage. A day is
     1,200,000 fare taps and 120 x 86,400 = 10,368,000 reports.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e16-v1.0.0.json).
   All are worked out from the model above and checked by the selfTest.
   - Produced: 240 x 480 = 115,200 taps in the window.
   - As built (3 brokers, RF 2, acks 1, unclean on, drop): k2 leads partitions 1, 4, 7, 10, 80 taps
     a second. Cut: 17:45:20 to 17:46:00 is 40 s x 80 = 3,200 taps accepted by k2 only, cut when k3
     is elected at 17:46:12. Dropped: 17:46:00 to 17:46:12 is 12 s x 80 = 960 waiting against 720
     of buffer, full at the end of 17:46:08, so 240 dropped from 17:46:09. Lost 3,440 = 3,440 riders
     at the maximum fare, 1,720 exits with no entry, 3,440 x 6.80 = 23,392.00 pounds. A day's share
     3,440 / 1,200,000 = 0.287%. Netflix's "less than 0.01%" of 1,200,000 is 120.
   - Telemetry, same night: 40 reports a second on k2's partitions, 40 s cut = 1,600 lost; 12 s x 40
     = 480 waiting fits in 720. 1,600 / 10,368,000 = 0.015%.
   - Unclean off alone: k2's 4 partitions shut from 17:46:00 to 17:52:00; 28,800 taps, of which the
     720 in the buffer at 17:52:00 get through: 28,080 dropped. The same with RF 1 (option 1).
   - Hold alone: nothing dropped, 3,200 still cut.
   - acks all alone (min ISR 1): taps for k2's partitions wait from 17:45:20 for k3; 1,680 dropped
     by 17:45:50; then 1,520 accepted on k2 only and cut; 17:46:00 to 17:46:12 k2's and k1's
     partitions wait (1,920 against 720): 1,200 dropped. Lost 4,400.
   - Six brokers (option 0): k2 leads partitions 1 and 7, 40 a second: 1,600 cut, nothing dropped.
     Four brokers: 3 partitions, 2,400 cut.
   - Durable (option 2: RF 3, min ISR 2, acks all, unclean off, block): 17:45:20 to 17:45:50 k2's
     partitions wait for k3 (2,400 taps, 30 s at most); at 17:45:50 k3 leaves and k2 and k1 make
     two; 17:46:00 to 17:46:12 every partition waits (2,880); k1 takes k2's partitions at 17:46:12.
     5,280 sent late, longest 30 s, 0 lost, 0 failed loudly, 4 of 12 shut until 17:46:12. With
     drop instead: 1,680 + 2,160 = 3,840 dropped.
   - RF 2 with min ISR 2, acks all, unclean off, block: k2's and k1's partitions, 8 of 12, shut
     until 17:52:00. k2's taps wait from 17:45:20 and k1's from 17:46:00; those older than 60 s fail
     loudly: 340 s x 80 + 300 s x 80 = 51,200; the last 60 s of each, 9,600, are sent late.
   - Fare database first: 0 lost on the night. Stall: 240 x 40 = 9,600 held, longest 40 s.
   - k2 stops with every copy in sync, as built: only the 240 dropped.

   Drawing: the case's own diagram (below), 740 x 440. Broker boxes k1 to k6 are 44 wide, 50 apart.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var P = 12;
  var RATE = 240;
  var TELE_RATE = 120;
  var POOL = 720;
  var WIN = 480;
  var GIVE_UP = 60;
  var T_LAG = 20;
  var LAG_LIMIT = 30;
  var T_DIE = 60;
  var T_SEEN = 72;
  var T_BACK = 420;
  var DB_STALL = 40;
  var DAY_TAPS = 1200000;
  var DAY_REPORTS = 10368000;
  var MAX_FARE_PENCE = 680;
  var K2 = 1;
  var K3 = 2;
  var BROKERS = 6;

  var OUTAGES = [
    { value: "night", label: "The night: k2 stops 17:46:00 to 17:52:00, k3 cut off from k2 at 17:45:20" },
    { value: "clean", label: "k2 stops 17:46:00 to 17:52:00, every copy in sync" },
    { value: "dbstall", label: "The fare database stalls 40 s from 17:46:00, brokers fine" },
    { value: "none", label: "No failure" }
  ];
  var BUFFERS = [
    { value: "drop", label: "Drop: hold 3, drop when full, give up after 60 s (as copied)" },
    { value: "block", label: "Block, then fail loudly after 60 s (max.block.ms = 60000)" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function at(t) {
    var s = 17 * 3600 + 45 * 60 + t;
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var x = s % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x;
  }
  function secs(n) {
    if (n <= 60) return n + " s";
    var m = Math.floor(n / 60);
    var s = n % 60;
    return m + " min" + (s ? " " + s + " s" : "");
  }
  function money(pence) {
    var p = String(pence % 100);
    return "£" + fmt(Math.floor(pence / 100)) + "." + (p.length < 2 ? "0" + p : p);
  }
  function share(n, day) { return (Math.round(n * 100000 / day) / 1000).toFixed(3) + "%"; }
  function bname(i) { return "k" + (i + 1); }

  /* ---------- the model (pure: settings in, results out) ---------- */

  function run(C, rate) {
    var N = C.N;
    var per = rate / P;
    var lagOn = C.outage === "night";
    var fail = C.outage === "night" || C.outage === "clean";
    var alive = [];
    var b;
    for (b = 0; b < N; b++) alive.push(true);
    var parts = [];
    for (var p = 0; p < P; p++) {
      var reps = [];
      for (var j = 0; j < C.RF; j++) reps.push((p + j) % N);
      parts.push({ reps: reps, leader: p % N, isr: reps.slice(), len: 0, has: {}, cutoff: false, q: [] });
      reps.forEach(function (r) { parts[p].has[r] = 0; });
    }
    var R = { produced: 0, cut: 0, dropped: 0, late: 0, loud: 0, maxWait: 0, shutMax: 0, lastShut: -1,
      k2Led: 0, lagParts: 0, toClean: 0, toUnclean: 0, toNone: 0, firstDrop: -1 };
    parts.forEach(function (pt) { if (pt.leader === K2) R.k2Led += 1; });
    var queued = 0;

    function copying(pt, r) { return alive[r] && !(pt.cutoff && r === K3); }
    function accept(pt, n) {
      pt.len += n;
      pt.reps.forEach(function (r) { if (r === pt.leader || (pt.isr.indexOf(r) >= 0 && copying(pt, r))) pt.has[r] = pt.len; });
    }
    function drop(n, t) { R.dropped += n; if (R.firstDrop < 0 && n > 0) R.firstDrop = t; }

    for (var t = 0; t < WIN; t++) {
      if (lagOn && t === T_LAG) {
        parts.forEach(function (pt) { if (pt.leader === K2 && pt.reps.indexOf(K3) >= 0) { pt.cutoff = true; R.lagParts += 1; } });
      }
      if (lagOn && t === T_LAG + LAG_LIMIT) {
        parts.forEach(function (pt) { if (pt.cutoff) pt.isr = pt.isr.filter(function (r) { return r !== K3; }); });
      }
      if (fail && t === T_DIE) alive[K2] = false;
      if (fail && t === T_SEEN) {
        parts.forEach(function (pt) {
          pt.isr = pt.isr.filter(function (r) { return r !== K2; });
          if (pt.leader !== K2) return;
          var nl = -1;
          var cand = pt.isr.filter(function (r) { return alive[r]; });
          if (cand.length) { nl = cand[0]; R.toClean += 1; }
          else if (C.unclean) {
            var oth = pt.reps.filter(function (r) { return r !== K2 && alive[r]; });
            if (oth.length) {
              nl = oth[0];
              R.toUnclean += 1;
              R.cut += pt.len - pt.has[nl];
              pt.len = pt.has[nl];
            }
          }
          if (nl < 0) { pt.leader = -1; R.toNone += 1; return; }
          pt.leader = nl;
          pt.cutoff = false;
          pt.isr = pt.reps.filter(function (r) { return alive[r]; });
          pt.isr.forEach(function (r) { pt.has[r] = pt.len; });
        });
      }
      if (fail && t === T_BACK) {
        alive[K2] = true;
        parts.forEach(function (pt) {
          if (pt.reps.indexOf(K2) < 0) return;
          if (pt.leader < 0) pt.leader = K2;
          pt.cutoff = false;
          pt.isr = pt.reps.slice();
          pt.isr.forEach(function (r) { pt.has[r] = pt.len; });
        });
      }
      var shut = 0;
      parts.forEach(function (pt) {
        if (pt.leader < 0 || !alive[pt.leader]) pt.state = "shut";
        else if (C.acks === "all" && pt.isr.length < C.minIsr) pt.state = "shut";
        else if (C.acks === "all" && pt.isr.some(function (r) { return !copying(pt, r); })) pt.state = "wait";
        else pt.state = "ok";
        if (pt.state === "shut") shut += 1;
      });
      if (shut > R.shutMax) R.shutMax = shut;
      if (shut > 0) R.lastShut = t;
      // taps that have waited past 60 s give up: dropped (drop) or fail loudly (block)
      parts.forEach(function (pt) {
        pt.q = pt.q.filter(function (e) {
          if (t - e.t <= GIVE_UP) return true;
          queued -= e.n;
          if (C.buffer === "drop") drop(e.n, t); else R.loud += e.n;
          return false;
        });
      });
      parts.forEach(function (pt) {
        if (pt.state !== "ok" || !pt.q.length) return;
        pt.q.forEach(function (e) {
          accept(pt, e.n);
          queued -= e.n;
          R.late += e.n;
          if (t - e.t > R.maxWait) R.maxWait = t - e.t;
        });
        pt.q = [];
      });
      parts.forEach(function (pt) {
        R.produced += per;
        if (pt.state === "ok") { accept(pt, per); return; }
        var n = per;
        if (C.buffer === "drop") {
          var keep = Math.min(Math.max(0, POOL - queued), n);
          drop(n - keep, t);
          n = keep;
        }
        if (n > 0) { pt.q.push({ t: t, n: n }); queued += n; }
      });
    }
    R.lost = R.cut + R.dropped;
    R.reopen = R.lastShut >= 0 ? R.lastShut + 1 : -1;
    return R;
  }

  function fares(C) {
    if (!C.dbFirst) return run(C, RATE);
    var R = { produced: RATE * WIN, cut: 0, dropped: 0, late: 0, loud: 0, maxWait: 0, shutMax: 0, reopen: -1, lost: 0 };
    if (C.outage === "dbstall") { R.late = RATE * DB_STALL; R.maxWait = DB_STALL; }
    return R;
  }
  function telemetry(C) {
    return run({ N: 3, RF: 2, acks: "1", minIsr: 1, unclean: true, buffer: "drop", outage: C.outage }, TELE_RATE);
  }

  function settingsLine(C) {
    if (C.dbFirst) return "Fare database first: each gate waits for the database's commit, then the tap goes on to the stream.";
    return C.N + " brokers, replication factor " + C.RF + ", acks = " + C.acks + ", min.insync.replicas = " + C.minIsr +
      ", unclean leader election " + (C.unclean ? "on" : "off") + ", gates " + (C.buffer === "drop" ? "drop when full" : "block, then fail loudly") + ".";
  }

  /* ---------- display ---------- */

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var T = S.T;
    var ran = !!R;
    api.node("gates").text("meta", C.dbFirst ? "database first" : (C.buffer === "drop" ? "drop when full" : "block, fail loudly"));
    api.node("fare").text("sub", C.dbFirst ? "fares: database first" : C.N + " brokers, RF " + C.RF);
    api.node("fare").text("meta", C.dbFirst ? "stream after the commit" : "acks " + C.acks + ", min ISR " + C.minIsr + ", unclean " + (C.unclean ? "on" : "off"));
    for (var b = 0; b < BROKERS; b++) {
      var n = api.node(bname(b));
      if (b >= C.N || C.dbFirst) { n.set("muted"); n.text("sub", "-"); continue; }
      var led = 0;
      for (var p = 0; p < P; p++) if (p % C.N === b) led += 1;
      var fail = ran && (C.outage === "night" || C.outage === "clean");
      if (fail && b === K2) { n.set("bad"); n.text("sub", "down"); }
      else if (ran && C.outage === "night" && b === K3 && C.RF > 1) { n.set("warn"); n.text("sub", "late"); }
      else { n.set("ok"); n.text("sub", led + " led"); }
    }
    api.node("fare").set(!ran ? "" : (R.lost ? "bad" : (R.loud || R.shutMax > 4 ? "warn" : "ok")));
    api.node("tele").set(!ran ? "" : (T.lost ? "warn" : "ok"));
    api.node("tele").text("sub", ran ? "lost " + fmt(T.lost) + " reports" : "3 brokers, RF 2");
    api.node("engine").set(!ran ? "" : (R.lost ? "bad" : "ok"));
    api.node("engine").text("sub", ran ? "max fare: " + fmt(R.lost) : "fare run at 02:00");
    api.node("gates").set(!ran ? "" : (R.loud ? "bad" : (R.late ? "warn" : "ok")));

    S.stat.produced(ran ? fmt(R.produced) : 0);
    S.stat.accepted(ran ? fmt(R.produced - R.lost - R.loud) : 0);
    S.stat.lost(ran ? fmt(R.lost) : 0);
    S.stat.cut(ran ? fmt(R.cut) : 0);
    S.stat.dropped(ran ? fmt(R.dropped) : 0);
    S.stat.late(ran ? fmt(R.late) : 0);
    S.stat.loud(ran ? fmt(R.loud) : 0);
    S.stat.wait(ran ? secs(R.maxWait) : "not run");
    S.stat.shut(ran ? R.shutMax + " of " + P : "not run");
    S.stat.reopen(ran && R.reopen >= 0 ? at(R.reopen) : "-");
    S.stat.riders(ran ? fmt(R.lost) : 0);
    S.stat.exits(ran ? fmt(Math.floor(R.lost / 2)) : 0);
    S.stat.charged(ran ? money(R.lost * MAX_FARE_PENCE) : "£0.00");
    S.stat.share(ran ? share(R.lost, DAY_TAPS) : "not run");
    S.stat.tele(ran ? fmt(T.lost) : 0);
    S.stat.teleShare(ran ? share(T.lost, DAY_REPORTS) : "not run");
  }

  function narrate(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var T = S.T;
    var L = [];
    L.push("Replay from 17:45:00. " + settingsLine(C));
    if (C.outage === "night" && !C.dbFirst && R.lagParts) {
      L.push("17:45:20 k3 stops copying from k2: " + R.lagParts + " partitions fall behind.");
      L.push("17:45:50 k3 has copied nothing for 30 s and leaves the in-sync set of " + R.lagParts + " partitions.");
    }
    if (C.outage === "night" || C.outage === "clean") {
      L.push("17:46:00 k2 stops.");
      if (!C.dbFirst) {
        var bits = [];
        if (R.toClean) bits.push(R.toClean + " to an in-sync copy");
        if (R.toUnclean) bits.push(R.toUnclean + " to an out-of-date copy, " + fmt(R.cut) + " accepted taps cut");
        if (R.toNone) bits.push(R.toNone + " with no leader until 17:52:00");
        L.push("17:46:12 Kafka notices. k2's " + R.k2Led + " partitions: " + bits.join("; ") + ".");
        if (R.dropped) L.push("From " + at(R.firstDrop) + " the gates drop taps: " + fmt(R.dropped) + " in all.");
        if (R.loud) L.push(fmt(R.loud) + " taps waited past 60 s and failed loudly into the gates' journals.");
      }
      L.push("17:52:00 k2 is back.");
    }
    if (C.outage === "dbstall") {
      L.push(C.dbFirst ? "17:46:00 the fare database stalls; every gate holds its taps until 17:46:40." :
        "17:46:00 the fare database stalls for 40 s; the router waits and the gates notice nothing.");
    }
    var tail = R.lost ? " " + fmt(R.lost) + " riders charged the maximum fare, " + fmt(Math.floor(R.lost / 2)) +
      " of them exits with no entry: " + money(R.lost * MAX_FARE_PENCE) + "." : " Nobody charged the maximum fare.";
    L.push("Result: " + fmt(R.produced) + " fare taps, " + fmt(R.lost) + " lost (" + fmt(R.cut) + " cut, " + fmt(R.dropped) +
      " dropped), " + fmt(R.late) + " sent late, longest wait " + secs(R.maxWait) + "." + tail +
      " Telemetry: " + fmt(T.lost) + " reports lost (" + share(T.lost, DAY_REPORTS) + " of a day).");
    L.forEach(function (s) {
      var tone = "";
      if (s.indexOf("Result:") === 0) tone = R.lost ? "bad" : (R.loud ? "warn" : "ok");
      else if (s.indexOf("cut") >= 0 || s.indexOf("drop taps") >= 0) tone = "bad";
      else if (s.indexOf("failed loudly") >= 0) tone = "warn";
      api.log(s, tone);
    });
  }

  function replay(api) {
    var S = api.state;
    S.R = fares(S.C);
    S.T = telemetry(S.C);
    narrate(api);
    draw(api);
  }

  function changed(api, what) {
    var S = api.state;
    if (S.R) replay(api);
    else { api.log(what + " " + settingsLine(S.C), ""); draw(api); }
  }

  /* ---------- the module ---------- */

  var nodes = [
    { id: "gates", label: "240 gates", sub: "240 taps/s", meta: "drop when full", x: 80, y: 90, w: 130, h: 64, shape: "box" },
    { id: "reports", label: "Gate reports", sub: "120/s", meta: "copied settings", x: 80, y: 370, w: 130, h: 64, shape: "box" },
    { id: "fare", label: "Fare path", sub: "3 brokers, RF 2", meta: "acks 1, min ISR 1, unclean on", x: 300, y: 90, w: 220, h: 64, shape: "box" },
    { id: "tele", label: "Telemetry path", sub: "3 brokers, RF 2", meta: "acks 1, unclean on, drop", x: 300, y: 370, w: 220, h: 64, shape: "box" },
    { id: "router", label: "Router", x: 545, y: 230, w: 90, h: 50, shape: "box" },
    { id: "engine", label: "Fare engine", sub: "fare run at 02:00", x: 670, y: 90, w: 130, h: 56, shape: "db" },
    { id: "lake", label: "Data lake", x: 670, y: 230, w: 130, h: 56, shape: "db" },
    { id: "dash", label: "Dashboards", x: 670, y: 370, w: 130, h: 56, shape: "box" }
  ];
  for (var kb = 0; kb < BROKERS; kb++) {
    nodes.push({ id: bname(kb), label: bname(kb), sub: "4 led", x: 200 + 50 * kb, y: 200, w: 44, h: 44, shape: "box" });
  }

  DL.sims.define("s4e16", {
    diagram: {
      type: "arch", w: 740, h: 440,
      aria: "Tapstream on the test rig. 240 gates send taps to the fare path's brokers, k1 to k6, the first N in the cluster; gate reports go to the telemetry path on the copied settings. A router fans both out to the fare engine, the data lake and the dashboards. After a replay a dead broker shows red, one cut off from k2 amber.",
      nodes: nodes,
      edges: [
        { from: "gates", to: "fare", label: "taps" },
        { from: "reports", to: "tele" },
        { from: "fare", to: "router", via: [[545, 90]] },
        { from: "tele", to: "router" },
        { from: "router", to: "engine" },
        { from: "router", to: "lake" },
        { from: "router", to: "dash" }
      ],
      notes: [
        { x: 325, y: 250, text: "fare path brokers, k1 to k6", tone: "muted", anchor: "middle" }
      ]
    },

    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { N: 3, RF: 2, acks: "1", minIsr: 1, unclean: true, buffer: "drop", outage: "night", dbFirst: false };
      S.R = null;
      S.T = null;
      S.ctl = {};

      S.ctl.run = api.control.button("run", "Run the rush hour", function () { replay(api); });
      S.ctl.outage = api.control.select("outage", "The outage", OUTAGES, "night", function (v) {
        S.C.outage = String(v);
        changed(api, "Outage: " + S.C.outage + ".");
      });
      S.ctl.acks = api.control.select("acks", "acks (fare producers)", [{ value: "1", label: "1 (the leader has it)" }, { value: "all", label: "all (every in-sync copy has it)" }], "1", function (v) {
        S.C.acks = String(v) === "all" ? "all" : "1";
        changed(api, "acks = " + S.C.acks + ".");
      });
      S.ctl.minIsr = api.control.select("minIsr", "min.insync.replicas", [1, 2, 3].map(function (k) { return { value: String(k), label: String(k) }; }), "1", function (v) {
        S.C.minIsr = Math.max(1, Math.min(3, Number(v) || 1));
        changed(api, "min.insync.replicas = " + S.C.minIsr + ".");
      });
      S.ctl.unclean = api.control.toggle("unclean", "Unclean leader election", true, function (on) {
        S.C.unclean = !!on;
        changed(api, "Unclean leader election " + (on ? "on." : "off."));
      });
      S.ctl.buffer = api.control.select("buffer", "Gate producers", BUFFERS, "drop", function (v) {
        S.C.buffer = String(v) === "block" ? "block" : "drop";
        changed(api, "Gates: " + S.C.buffer + ".");
      });
      S.ctl.rf = api.control.select("rf", "Replication factor (fare topic)", [1, 2, 3].map(function (k) { return { value: String(k), label: String(k) }; }), "2", function (v) {
        S.C.RF = Math.max(1, Math.min(3, Number(v) || 2));
        changed(api, "Replication factor " + S.C.RF + ".");
      });
      S.ctl.brokers = api.control.select("brokers", "Brokers (fare path)", [3, 4, 6].map(function (k) { return { value: String(k), label: String(k) }; }), "3", function (v) {
        var x = Number(v);
        S.C.N = x === 4 || x === 6 ? x : 3;
        changed(api, S.C.N + " brokers.");
      });
      S.ctl.db = api.control.toggle("dbFirst", "Write each tap to the fare database first", false, function (on) {
        S.C.dbFirst = !!on;
        changed(api, "Fare database first " + (on ? "on." : "off."));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        produced: api.stat("produced", "fare taps, 17:45:00 to 17:53:00", ""),
        accepted: api.stat("accepted", "accepted by the stream", "ok"),
        lost: api.stat("lost", "fare taps lost", "bad"),
        cut: api.stat("cut", "lost: accepted, then cut at an unclean election", "bad"),
        dropped: api.stat("dropped", "lost: dropped by the gates", "bad"),
        late: api.stat("late", "waited at a gate, sent late", "warn"),
        loud: api.stat("loud", "failed loudly into a gate's journal", "warn"),
        wait: api.stat("wait", "longest wait at a gate", ""),
        shut: api.stat("shut", "fare partitions shut, most at once", "warn"),
        reopen: api.stat("reopen", "last shut partition open again", ""),
        riders: api.stat("riders", "riders charged the maximum fare", "bad"),
        exits: api.stat("exits", "of them, exits with no entry", "bad"),
        charged: api.stat("charged", "charged at the maximum fare", "bad"),
        share: api.stat("share", "share of a day's 1,200,000 fare taps lost", ""),
        tele: api.stat("tele", "telemetry reports lost (copied settings)", "warn"),
        teleShare: api.stat("teleShare", "share of a day's reports lost", "")
      };

      api.info("<strong>How to read it.</strong> Each gate is a Kafka producer. The fare path's settings are yours; the telemetry path keeps the settings Tapstream copied from Keystone. Run the rush hour replays 17:45:00 to 17:53:00 with the outage you chose. A tap is lost if it was cut when an out-of-date copy became leader, or dropped by a gate. A tap that fails loudly is kept in the gate's journal with an alarm, so it is late, not lost.");
      api.log("17:45:00 on the test rig, before the rush replay. Tapstream as built: " + settingsLine(S.C) + " Press Run the rush hour.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function n(id) { return Number(String(t.stat(id)).replace(/[^0-9.\-]/g, "")); }
      function setAll(o) { Object.keys(o).forEach(function (k) { t.set(k, o[k]); }); }
      var asBuilt = { outage: "night", acks: "1", minIsr: "1", unclean: true, buffer: "drop", rf: "2", brokers: "3", dbFirst: false };

      // 1. Opens before the rush replay, as built, nothing run.
      t.expect(n("lost") === 0 && t.stat("wait") === "not run" && t.stat("shut") === "not run" &&
        t.logText().indexOf("17:45:00 on the test rig, before the rush replay.") >= 0 &&
        t.logText().indexOf("3 brokers, replication factor 2, acks = 1, min.insync.replicas = 1, unclean leader election on, gates drop when full.") >= 0,
        "Opens at 17:45:00 before the replay, with Tapstream's copied settings and nothing run");

      // 2. The night as built: the story's numbers.
      begin();
      t.click("run");
      t.expect(t.stat("produced") === "115,200" && t.stat("lost") === "3,440" && t.stat("cut") === "3,200" && n("dropped") === 240 &&
        t.stat("riders") === "3,440" && t.stat("exits") === "1,720" && t.stat("charged") === "£23,392.00" &&
        t.stat("share") === "0.287%" && t.stat("accepted") === "111,760" && t.stat("wait") === "12 s" &&
        has("17:46:12 Kafka notices. k2's 4 partitions: 4 to an out-of-date copy, 3,200 accepted taps cut.") &&
        has("From 17:46:09 the gates drop taps: 240 in all."),
        "The night as built: 115,200 taps, 3,200 cut at the unclean election, 240 dropped, 3,440 riders at the maximum fare, 1,720 exits with no entry, 23,392.00 pounds");

      // 3. The telemetry path beside it.
      t.expect(t.stat("tele") === "1,600" && t.stat("teleShare") === "0.015%" && has("Telemetry: 1,600 reports lost (0.015% of a day)."),
        "Telemetry on the copied settings: 1,600 reports lost, 0.015% of a day's 10,368,000");

      // 4. One setting at a time is not enough.
      t.set("buffer", "block");
      var holdOnly = t.stat("lost") === "3,200" && n("dropped") === 0 && n("loud") === 0;
      t.set("buffer", "drop");
      t.set("unclean", false);
      var uncleanOff = t.stat("lost") === "28,080" && n("cut") === 0 && t.stat("shut") === "4 of 12" && t.stat("reopen") === "17:52:00";
      t.set("unclean", true);
      t.set("acks", "all");
      var acksAll = t.stat("lost") === "4,400" && t.stat("cut") === "1,520" && t.stat("dropped") === "2,880";
      t.set("acks", "1");
      t.expect(holdOnly && uncleanOff && acksAll,
        "Alone: blocking still loses the 3,200 cut; no unclean election drops 28,080; acks all with min ISR 1 loses 4,400");

      // 5. Option 0: six brokers.
      t.set("brokers", "6");
      t.expect(t.stat("lost") === "1,600" && t.stat("cut") === "1,600" && n("dropped") === 0 && t.stat("riders") === "1,600",
        "Six brokers: k2 leads 2 of 12 partitions, 1,600 cut, nothing dropped, 1,600 riders at the maximum fare");
      t.set("brokers", "4");
      var four = t.stat("lost") === "2,400";
      t.set("brokers", "3");

      // 6. Option 1: one copy per fare partition.
      begin();
      t.set("rf", "1");
      t.expect(four && t.stat("lost") === "28,080" && n("cut") === 0 && t.stat("dropped") === "28,080" && t.stat("reopen") === "17:52:00" &&
        has("4 with no leader until 17:52:00"),
        "One copy: nothing to cut, but k2's 4 partitions shut until 17:52:00 and 28,080 taps are dropped");

      // 7. Option 2: durable fare cluster.
      setAll({ rf: "3", minIsr: "2", acks: "all", unclean: false, buffer: "block" });
      t.expect(n("lost") === 0 && t.stat("late") === "5,280" && t.stat("wait") === "30 s" && n("loud") === 0 &&
        t.stat("shut") === "4 of 12" && t.stat("reopen") === "17:46:12" && t.stat("tele") === "1,600" && n("riders") === 0,
        "RF 3, min ISR 2, acks all, no unclean election, gates that block: 0 lost, 5,280 sent late, longest 30 s; telemetry still 1,600");

      // 8. The same, but gates that drop.
      t.set("buffer", "drop");
      t.expect(t.stat("lost") === "3,840" && n("cut") === 0,
        "The durable cluster with gates that drop: 3,840 dropped while the gates wait");
      t.set("buffer", "block");

      // 9. Why the third copy matters: RF 2 with two in sync required.
      t.set("rf", "2");
      t.expect(n("lost") === 0 && t.stat("shut") === "8 of 12" && t.stat("reopen") === "17:52:00" &&
        t.stat("loud") === "51,200" && t.stat("late") === "9,600" && t.stat("wait") === "60 s",
        "RF 2 with min ISR 2: 8 of 12 partitions shut until 17:52:00, 51,200 taps fail loudly; with RF 3 none stay shut");
      t.set("rf", "3");

      // 10. Option 3: the fare database first.
      setAll(asBuilt);
      t.set("dbFirst", true);
      var dbNight = n("lost") === 0 && n("late") === 0 && t.stat("tele") === "1,600";
      t.set("outage", "dbstall");
      t.expect(dbNight && n("lost") === 0 && t.stat("late") === "9,600" && t.stat("wait") === "40 s",
        "Database first: no fare lost on the night; a 40 s database stall holds 9,600 taps at the gates, up to 40 s");

      // 11. The same stall on the Kafka path: the gates notice nothing.
      begin();
      t.set("dbFirst", false);
      t.expect(n("lost") === 0 && n("late") === 0 && has("the router waits and the gates notice nothing"),
        "A database stall on the Kafka path: the router waits, nothing held at the gates");

      // 12. An ordinary broker loss, as built: only the buffer drops.
      t.set("outage", "clean");
      t.expect(n("lost") === 240 && n("cut") === 0 && n("dropped") === 240 && t.stat("tele") === 0,
        "k2 lost with every copy in sync, as built: 240 dropped, nothing cut");
    }
  });
})();
