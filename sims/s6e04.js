/* sims/s6e04-v1.0.0.js  (published as sims/s6e04.js)
   Case s6e04 "Cascades": a cascade lab for Scarrow's six council car parks. Each exit barrier reads
   a number plate and asks the car-park server, which asks the permit service, which asks the plate
   store. Every layer waits up to its timeout and tries again. The learner sets the exit rate, the
   slow spell, the timeout, the retries per layer, which layers retry, load shedding at the store and
   the store's capacity, then plays 22:58:00 to 23:45:00, one second at a time.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: an arch diagram (six car parks, the server, the permit service,
     the plate store), one second per step from 22:58:00 to 23:45:00. Controls: exit rate (1.5, 2.5,
     5 cars a second), slow spell (23:00 rebuild, 23:10 hiccup, none), timeout (1 s, 5 s), retries per
     layer (0, 1, 3), which layers retry (all three, barrier only), load shedding (off, on), store
     capacity (100, 200); Next minute, Play / pause, To the end, Reset. selfTest: 10 assertions.

   The model (stated in sim.lede). Times in ms after 22:58:00.
   - Cars: the arena car park sends one car every round(1000 / rate) ms from 23:00:00 while before
     23:20:00 (400 ms at 2.5 a second: 3,000 cars; 667 ms at 1.5: 1,800; 200 ms at 5: 6,000). The
     other five car parks each send one car a minute, at :00 (station), :12 (market), :24 (library),
     :36 (baths) and :48 (riverside) past every minute from 22:58:00.
   - One plate read: barrier try b (b = 0..Rb) at read + b x timeout calls the server; server try c
     (0..Rs) at that + c x timeout calls the permit service; permit try p (0..Rp) at that + p x
     timeout asks the store: one lookup. Each layer starts its next try one timeout after the last,
     whether or not anyone above is still waiting (nobody tells it). As built Rb = Rs = Rp = 3, so a
     read can become 4 x 4 x 4 = 64 lookups, asked at read + 0 to 9 s with timeout 1 s.
   - A layer's try succeeds only if its answer comes within the timeout. Because each layer's later
     tries start one timeout later, only the lookup asked by try (b, 0, 0) can answer barrier try b in
     time; the barrier lifts at that answer. If all its tries fail, the car is refused at read +
     (Rb + 1) x timeout and lifted by hand (stewards at the arena, the attendant elsewhere).
   - The plate store answers one lookup at a time, first come, first served: 10 ms each (100 a
     second), 5 ms with capacity 200. During a slow spell each takes 500 ms (2 a second), 250 ms with
     capacity 200: the 23:00 index rebuild is 23:00:00 to 23:04:00; the hiccup is 23:10:00 to 23:10:30.
     It works through every lookup in its line, even one whose permit try has given up.
   - Load shedding: a lookup the store could not answer within the timeout is turned away at once
     ("busy"), costing the store nothing. It counts as a failed try.
   - The health check is a cheap separate question ("are you up, is the index built?"): "rebuilding
     index" from 23:00:00 to 23:04:00 in the rebuild run, "healthy" at every other moment.
   - Ties: retries due at the same millisecond as a new car go first; cars at the same millisecond
     in car-park order. No randomness: api.rand() is not used.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e04-v1.0.0.json).
   - As built (2.5 a second, rebuild 23:00, timeout 1 s, 3 retries at all layers, no shedding, 100):
     2.5 cars a second against 2 lookups a second. The first refusals come at 23:00:04 (a station
     car and an arena car read at 23:00:00 and 23:00:00.4). From 23:00:10 the arena's cars make 160
     lookups every second (2.5 x 64); with the other five the store sees up to 172 (23:00:16). At
     23:04:00 the health check says healthy with 38,434 lookups in the line; it keeps growing by
     about 60 a second (160 in, 100 out) to 101,212 at 23:20:00, where a new lookup would wait
     16 min 52 s. HL68 RWT at the station at 23:30:00 is looked up 64 times from 23:30:00 to
     23:30:09 (tries 1.1.1 to 4.4.4), each answered "permit ok" 7 min 22 s to 7 min 31 s later. The
     last refused car is read at 23:37:48 (riverside); the station car at 23:38:00 lifts by itself:
     barriers back 23:38:00. 3,189 cars refused (2,999 of 3,000 at the arena, 38 at each of the
     other five); 204,141 lookups, 204,092 answered after their caller had given up.
   - An ordinary night (no crowd, rebuild at 23:00): no car refused; a lone lookup takes 0.5 s.
   - Below about 1.5 cars a second, 64 lookups a car is under 100 a second (1.5 x 64 = 96); at
     1.5 plus the other five's cars it is about 101, so the line still does not shrink until 23:20.
   - Barrier only + shedding (the fix): 138 cars refused (118 arena, 20 elsewhere), all read between
     23:00:00 and 23:03:56, while the rebuild runs; 554 lookups turned away at once; the car after
     the last refusal lifts at 23:03:57; HL68 RWT needs 1 lookup; 0 answers after a caller gave up.
     Shedding alone: also 138 and 23:03:57, with 11,895 lookups. Barrier only: 667, 23:04:22.
   - Capacity 200 (rebuild 4 a second): no car refused at 2.5 a second; at 5 a second the storm
     returns (5 x 64 = 320 > 200): 6,173 refused, back 23:36:50.
   - Timeout 5 s: the storm starts later (first refusal 23:00:34) and ends at 23:37:30; 3,149
     refused; the line peaks at 96,775; HL68 RWT's 64 lookups run 23:30:00 to 23:30:45. Hiccup at 23:10 (rebuild moved to 04:00): 1,586 refused, back 23:27:24. No slow spell:
     no car refused.
*/
(function () {
  "use strict";

  var BASE = 82680;          // 22:58:00
  var LAST = 2820;           // 23:45:00, seconds after BASE
  var CROWD0 = 120000, CROWD1 = 1320000;
  var PARKS = ["Arena", "Station", "Market", "Library", "Baths", "Riverside"];
  var PLATE = "HL68 RWT", PLATE_PARK = 1, PLATE_T = 1920000;

  var RATES = [{ value: "1.5", label: "1.5 cars a second (a smaller show)" }, { value: "2.5", label: "2.5 cars a second (tonight)" }, { value: "5", label: "5 cars a second (a show twice the size)" }];
  var SLOWS = [{ value: "rebuild", label: "23:00 index rebuild, 4 min (tonight)" }, { value: "blip", label: "23:10 hiccup, 30 s (rebuild moved to 04:00)" }, { value: "none", label: "None (rebuild moved to 04:00)" }];
  var TMOS = [{ value: "1", label: "1 s (as built)" }, { value: "5", label: "5 s" }];
  var RETS = [{ value: "3", label: "3 (as built)" }, { value: "1", label: "1" }, { value: "0", label: "0" }];
  var WHO = [{ value: "all", label: "All three layers (as built)" }, { value: "barrier", label: "Barrier only" }];
  var SHED = [{ value: "off", label: "Off (as built)" }, { value: "on", label: "On: turn away at once" }];
  var CAPS = [{ value: "100", label: "100 lookups a second (as built)" }, { value: "200", label: "200 lookups a second" }];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(sec) {
    var s = ((Math.floor(sec) % 86400) + 86400) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60);
  }
  function at(ms) { return hms(BASE + Math.floor(ms / 1000)); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dur(ms) {
    if (ms < 1000) return (Math.round(ms / 10) / 100) + " s";
    var s = Math.round(ms / 1000);
    return s < 60 ? s + " s" : Math.floor(s / 60) + " min " + (s % 60) + " s";
  }

  /* ---------- the model: settings in, the whole night out ---------- */

  function simulate(C) {
    var T = C.timeout * 1000;
    var END = LAST * 1000;
    var S = LAST + 1;
    var Rb = C.retries, Rs = C.who === "all" ? C.retries : 0, Rp = Rs;
    var fast = 1000 / C.cap, slow = 50000 / C.cap;
    var s0 = C.slow === "rebuild" ? 120000 : (C.slow === "blip" ? 720000 : -1);
    var s1 = C.slow === "rebuild" ? 360000 : (C.slow === "blip" ? 750000 : -1);
    function svc(t) { return t >= s0 && t < s1 ? slow : fast; }

    var cars = [];
    var gap = Math.round(1000 / C.rate);
    for (var t = CROWD0; t < CROWD1; t += gap) cars.push({ t: t, park: 0 });
    for (var j = 1; j <= 5; j++) for (var q = (j - 1) * 12000; q < END; q += 60000) cars.push({ t: q, park: j });
    cars.sort(function (a, b) { return a.t - b.t || a.park - b.park; });
    for (var i = 0; i < cars.length; i++) { cars[i].done = -1; cars[i].pass = false; cars[i].n = 0; }

    var look = [], arena = [], refused = [], acc = [], ans = [], wasted = [], freeAt = [];
    for (var z = 0; z < S; z++) { look.push(0); arena.push(0); refused.push(0); acc.push(0); ans.push(0); wasted.push(0); freeAt.push(0); }
    var spawn = [], sp = 0, ci = 0, free = 0, sec = 0, total = 0, trace = [];
    function closeTo(k) { while (sec < k && sec < S) { freeAt[sec] = free; sec += 1; } }
    for (;;) {
      var e, ns = sp < spawn.length ? spawn[sp] : null, nc = ci < cars.length ? cars[ci] : null;
      if (!ns && !nc) break;
      if (ns && (!nc || ns.t <= nc.t)) { e = ns; sp += 1; } else { e = { t: nc.t, car: nc, b: 0, c: 0, p: 0 }; ci += 1; }
      if (e.t >= END) break;
      var s = e.t, ks = Math.floor(s / 1000);
      closeTo(ks);
      total += 1;
      look[ks] += 1;
      if (e.car.park === 0) arena[ks] += 1;
      e.car.n += 1;
      var start = Math.max(s, free), ok, a = -1;
      if (C.shed && start + svc(start) - s >= T) { refused[ks] += 1; ok = false; }
      else {
        a = start + svc(start);
        free = a;
        acc[ks] += 1;
        if (a < END) ans[Math.floor(a / 1000)] += 1;
        ok = a - s < T;
        if (!ok && a < END) wasted[Math.floor(a / 1000)] += 1;
      }
      if (e.car.t === PLATE_T && e.car.park === PLATE_PARK) trace.push({ t: s, tries: (e.b + 1) + "." + (e.c + 1) + "." + (e.p + 1), wait: a < 0 ? -1 : a - s });
      if (ok) {
        if (e.c === 0 && e.p === 0 && e.car.done < 0) { e.car.done = a; e.car.pass = true; }
        continue;
      }
      var nt = s + T;
      if (e.c === 0 && e.p === 0) {
        if (e.b < Rb) spawn.push({ t: nt, car: e.car, b: e.b + 1, c: 0, p: 0 });
        else if (e.car.done < 0) e.car.done = nt;
      }
      if (e.p === 0 && e.c < Rs) spawn.push({ t: nt, car: e.car, b: e.b, c: e.c + 1, p: 0 });
      if (e.p < Rp) spawn.push({ t: nt, car: e.car, b: e.b, c: e.c, p: e.p + 1 });
    }
    closeTo(S);
    var line = [], ca = 0, cs = 0;
    for (var k = 0; k < S; k++) { ca += acc[k]; cs += ans[k]; line.push(ca - cs); }
    var lastRef = null, back = null, nref = 0;
    for (var m = 0; m < cars.length; m++) if (cars[m].done >= 0 && !cars[m].pass) { nref += 1; if (!lastRef || cars[m].t > lastRef.t) lastRef = cars[m]; }
    if (lastRef) for (var n2 = 0; n2 < cars.length; n2++) if (cars[n2].t > lastRef.t && cars[n2].pass) { back = cars[n2]; break; }
    return { cars: cars, look: look, arena: arena, refused: refused, line: line, wasted: wasted, freeAt: freeAt, total: total,
      trace: trace, lastRef: lastRef, back: back, nref: nref, s0: s0, s1: s1, T: T };
  }

  // Everything the stats show at the end of second s (s < 120 is before the crowd).
  function summary(S, s) {
    var M = S.M, C = S.C, endMs = (s + 1) * 1000;
    var state = [true, true, true, true, true, true], last = [-1, -1, -1, -1, -1, -1], ref = [0, 0, 0, 0, 0, 0];
    for (var i = 0; i < M.cars.length; i++) {
      var c = M.cars[i];
      if (c.done < 0 || c.done >= endMs) continue;
      if (!c.pass) ref[c.park] += 1;
      if (c.t > last[c.park]) { last[c.park] = c.t; state[c.park] = c.pass; }
    }
    var open = 0, nref = 0, healed = M.back && M.back.done < endMs;
    for (var p = 0; p < 6; p++) { if (healed) state[p] = true; if (state[p]) open += 1; nref += ref[p]; }
    var w = 0;
    for (var k = 0; k <= s; k++) w += M.wasted[k];
    var waitMs = Math.max(0, M.freeAt[s] - endMs);
    var pl = M.trace.length ? M.trace : null;
    var plateText = "not read yet";
    if (pl && pl[0].t < endMs) {
      var seen = pl.filter(function (x) { return x.t < endMs; });
      plateText = seen.length === 1 ? "1, at " + at(seen[0].t) : seen.length + ", " + at(seen[0].t) + " to " + at(seen[seen.length - 1].t);
    }
    var backText = !M.lastRef ? "never shut" : (M.back && M.back.done < endMs ? at(M.back.done) : "not yet");
    var health = C.slow === "rebuild" && s * 1000 >= M.s0 && s * 1000 < M.s1 ? "rebuilding index" : "healthy";
    return { state: state, ref: ref, open: open, nref: nref, wasted: w, wait: dur(waitMs), waitMs: waitMs, plate: plateText, back: backText, health: health };
  }

  // The log lines for second s, each logged when the playhead passes it.
  function events(S, s) {
    var M = S.M, C = S.C, out = [], ms = s * 1000;
    if (s === 120) out.push(["The show lets out: " + C.rate + " cars a second reach the arena's exits until 23:20:00.", "warn"]);
    if (M.s0 === ms) out.push([C.slow === "rebuild" ? "The store starts its nightly index rebuild: about " + (C.cap / 50) + " lookups a second until 23:04:00. Health check: rebuilding index." :
      "A 30 s hiccup: the store answers about " + (C.cap / 50) + " lookups a second until 23:10:30. Health check: healthy.", "warn"]);
    var full = Math.round(C.rate * 64);
    if (C.retries === 3 && C.who === "all" && s > 0 && M.arena[s] >= full && M.arena[s - 1] < full && s * 1000 < CROWD1) {
      var nowCap = ms >= M.s0 && ms < M.s1 ? C.cap / 50 : C.cap;
      out.push(["The arena's " + C.rate + " cars a second now make " + M.arena[s] + " lookups a second. The store can answer " + nowCap + ".", "bad"]);
    }
    var before = s > 0 ? summary(S, s - 1) : null, now = summary(S, s);
    if (before) {
      for (var p = 0; p < 6; p++) {
        if (before.ref[p] === 0 && now.ref[p] > 0) out.push([p === 0 ? "First car refused at the arena: the barrier tried " + (C.retries ? (C.retries + 1) + " times" : "once") + " and gave up. A steward lifts it by key." :
          "The " + PARKS[p].toLowerCase() + " barrier refuses a car. No concert traffic there; I lift it from the desk.", "bad"]);
      }
    }
    if (M.s1 === ms && C.slow === "rebuild") out.push(["The rebuild is finished. Health check: healthy. The store answers " + C.cap + " a second; " + fmt(M.line[s - 1]) + " lookups wait in its line.", M.line[s - 1] > C.cap ? "warn" : "ok"]);
    if (ms === CROWD1) out.push(["The last concert car reached the exit before 23:20:00. " + fmt(M.line[s]) + " lookups wait in the store's line; a new one would wait " + now.wait + ".", M.line[s] > C.cap ? "bad" : "ok"]);
    var tr = M.trace;
    if (tr.length && Math.floor(tr[tr.length - 1].t / 1000) + 1 === s) {
      var ws = tr.filter(function (x) { return x.wait >= 0; }).map(function (x) { return x.wait; });
      var tail = tr.length === 1 ? "answered in " + dur(tr[0].wait) + ": the barrier lifts." :
        "the store will answer each of them, permit ok, after " + dur(Math.min.apply(null, ws)) + " to " + dur(Math.max.apply(null, ws)) + ", long after every layer gave up.";
      out.push(["Plate " + PLATE + " at the station: " + (tr.length === 1 ? "1 lookup at " + at(tr[0].t) : tr.length + " lookups from " + at(tr[0].t) + " to " + at(tr[tr.length - 1].t)) + "; " + tail, tr.length > 1 ? "bad" : "ok"]);
    }
    if (M.back && Math.floor(M.back.done / 1000) === s) out.push(["A barrier at the " + PARKS[M.back.park].toLowerCase() + " lifts by itself. From here every barrier works again.", "ok"]);
    if (s === LAST) out.push(["End: " + fmt(now.nref) + " cars refused; " + fmt(M.total) + " lookups asked; " + fmt(now.wasted) + " answered after the caller had given up. Barriers back: " + now.back + ".", now.nref ? "bad" : "ok"]);
    return out;
  }

  /* ---------- the picture ---------- */

  var NODES = [];
  for (var pi = 0; pi < 6; pi++) {
    NODES.push({ id: "p" + pi, label: PARKS[pi], sub: "lifts", meta: "refused 0", x: 70 + 120 * pi, y: 48, w: 110, h: 72, shape: "box", tone: pi === 0 ? "accent" : "" });
  }
  NODES.push({ id: "server", label: "Car-park server", sub: "tries per call: 4", meta: "timeout 1 s", x: 370, y: 250, w: 200, h: 72, shape: "box" });
  NODES.push({ id: "permits", label: "Permit service", sub: "tries per call: 4", meta: "timeout 1 s", x: 370, y: 370, w: 200, h: 72, shape: "box" });
  NODES.push({ id: "store", label: "Plate store", sub: "line: 0", meta: "health: healthy", x: 370, y: 490, w: 200, h: 72, shape: "db" });
  var EDGES = [];
  for (var pe = 0; pe < 6; pe++) EDGES.push({ from: "p" + pe, to: "server", tone: "muted" });
  EDGES.push({ from: "server", to: "permits", label: "asks" });
  EDGES.push({ from: "permits", to: "store", label: "asks" });
  var DIAGRAM = {
    type: "arch", w: 740, h: 540,
    aria: "Scarrow's six car parks across the top: the arena and five others. Each one's barrier asks the car-park server, which asks the permit service, which asks the plate store. A car park turns red while its barrier refuses cars; the store shows how many lookups wait in its line and what its health check says.",
    nodes: NODES,
    edges: EDGES
  };

  var INFO = {
    p0: "<strong>Arena car park.</strong> The concert crowd leaves here. A refused car is lifted out by a steward with a key, so the crowd keeps moving and every car is still read.",
    server: "<strong>Car-park server.</strong> Runs all six car parks. Each barrier call becomes up to 4 tries at the permit service, one timeout apart.",
    permits: "<strong>Permit service.</strong> Knows who has a season pass or a booking. Each call becomes up to 4 lookups at the store, one timeout apart.",
    store: "<strong>Plate store.</strong> Answers one lookup at a time, first come, first served. It works through every lookup in its line, even one whose caller has given up. Its health check is a separate cheap question."
  };
  var PARK_INFO = "<strong>A quiet car park.</strong> One car a minute at this hour, no concert traffic. A refused car is lifted by the night attendant from her desk.";

  /* ---------- running the night ---------- */

  function draw(api) {
    var S = api.state, C = S.C, M = S.M;
    var s = Math.max(0, Math.min(S.now, LAST));
    var sm = summary(S, s);
    if (S.now < 0) {   // the opening moment, before second 0 has run
      sm = { state: [true, true, true, true, true, true], ref: [0, 0, 0, 0, 0, 0], open: 6, nref: 0, wait: "0 s", plate: "not read yet", back: "not yet", health: "healthy" };
    }
    for (var p = 0; p < 6; p++) {
      var n = api.node("p" + p);
      n.text("sub", sm.state[p] ? "lifts" : "SHUT");
      n.text("meta", "refused " + fmt(sm.ref[p]));
      n.set(sm.state[p] ? (p === 0 ? "accent" : "") : "bad");
    }
    var tries = (C.who === "all" ? C.retries : 0) + 1;
    api.node("server").text("sub", "tries per call: " + tries);
    api.node("server").text("meta", "timeout " + C.timeout + " s");
    api.node("permits").text("sub", "tries per call: " + tries);
    api.node("permits").text("meta", "timeout " + C.timeout + " s");
    var st = api.node("store");
    var pre = S.now < 0;
    var lineNow = pre ? 0 : M.line[s];
    st.text("sub", "line: " + fmt(lineNow));
    st.text("meta", "health: " + sm.health);
    st.set(lineNow > C.cap ? "bad" : (sm.health === "healthy" ? "ok" : "warn"));
    var cars = 0;
    if (!pre) for (var i = 0; i < M.cars.length; i++) if (Math.floor(M.cars[i].t / 1000) === s) cars += 1;
    S.stat.cars(cars);
    S.stat.look(pre ? 0 : M.look[s]);
    S.stat.arena(pre ? 0 : M.arena[s]);
    S.stat.line(fmt(lineNow));
    S.stat.wait(sm.wait);
    S.stat.health(sm.health);
    S.stat.open(sm.open + " of 6");
    S.stat.refused(fmt(sm.nref));
    S.stat.plate(sm.plate);
    S.stat.back(sm.back);
  }

  function advance(api, to) {
    var S = api.state;
    to = Math.min(LAST, to);
    if (to <= S.now) return;
    for (var s = S.now + 1; s <= to; s++) {
      var ev = events(S, s);
      api.clock = BASE + s;
      for (var i = 0; i < ev.length; i++) api.log(ev[i][0], ev[i][1]);
    }
    S.now = to;
    api.clock = BASE + to;
    if (to === LAST) S.playing = false;
    draw(api);
  }

  function settingsLine(C) {
    return C.rate + " cars a second; slow spell: " + (C.slow === "rebuild" ? "23:00 rebuild" : (C.slow === "blip" ? "23:10 hiccup" : "none")) + "; timeout " + C.timeout + " s; " +
      C.retries + " retries at " + (C.who === "all" ? "all three layers" : "the barrier only") + "; shedding " + (C.shed ? "on" : "off") + "; store " + C.cap + " a second.";
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = simulate(S.C);
    S.now = -1;
    S.playing = false;
    api.clock = BASE;
    api.log(what + " Rewound to 22:58:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  DL.sims.define("s6e04", {
    diagram: DIAGRAM,
    startClock: BASE,

    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { rate: 2.5, slow: "rebuild", timeout: 1, retries: 3, who: "all", shed: false, cap: 100 };
      S.stat = {
        cars: api.stat("cars", "cars reaching an exit this second", ""),
        look: api.stat("look", "lookups asked at the store this second", "warn"),
        arena: api.stat("arena", "of those, for arena cars", "warn"),
        line: api.stat("line", "lookups waiting in the store's line", "bad"),
        wait: api.stat("wait", "a new lookup would wait", "bad"),
        health: api.stat("health", "store health check", "ok"),
        open: api.stat("open", "car parks whose barriers lift by themselves", "ok"),
        refused: api.stat("refused", "cars refused so far", "bad"),
        plate: api.stat("plate", "lookups for HL68 RWT (station, 23:30:00)", ""),
        back: api.stat("back", "every barrier lifting by itself again", "ok")
      };
      api.control.select("rate", "Exit rate at the arena", RATES, "2.5", function (v) {
        S.C.rate = Number(v) === 1.5 ? 1.5 : (Number(v) === 5 ? 5 : 2.5);
        rewind(api, "Exit rate: " + S.C.rate + " cars a second.");
      });
      api.control.select("slow", "Slow spell", SLOWS, "rebuild", function (v) {
        S.C.slow = v === "blip" || v === "none" ? String(v) : "rebuild";
        rewind(api, "Slow spell changed.");
      });
      api.control.select("timeout", "Timeout at every layer", TMOS, "1", function (v) {
        S.C.timeout = Number(v) === 5 ? 5 : 1;
        rewind(api, "Timeout: " + S.C.timeout + " s.");
      });
      api.control.select("retries", "Retries per layer", RETS, "3", function (v) {
        S.C.retries = Math.max(0, Math.min(3, Number(v) || 0));
        rewind(api, "Retries per layer: " + S.C.retries + ".");
      });
      api.control.select("who", "Which layers retry", WHO, "all", function (v) {
        S.C.who = v === "barrier" ? "barrier" : "all";
        rewind(api, S.C.who === "all" ? "All three layers retry." : "Only the barrier retries; the server and the permit service ask once.");
      });
      api.control.select("shed", "Busy switch at the store (load shedding)", SHED, "off", function (v) {
        S.C.shed = v === "on";
        rewind(api, S.C.shed ? "The store turns away at once any lookup that would wait a whole timeout." : "The store queues every lookup.");
      });
      api.control.select("cap", "Store capacity", CAPS, "100", function (v) {
        S.C.cap = Number(v) === 200 ? 200 : 100;
        rewind(api, "Store: " + S.C.cap + " lookups a second, " + (S.C.cap / 50) + " during a slow spell.");
      });
      api.control.button("next", "Next minute", function () { advance(api, (Math.floor(S.now / 60) + 1) * 60); });
      api.control.button("play", "Play / pause", function () { S.playing = !S.playing && S.now < LAST; });
      api.control.button("end", "To the end", function () { advance(api, LAST); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.onNodeClick(function (id) { api.info(INFO[id] || PARK_INFO); });
      api.info("<strong>How to read it.</strong> Each barrier asks the server, which asks the permit service, which asks the plate store. Every layer waits up to its timeout, then tries again, and nobody tells the layer below to stop. A car park turns red while its barrier refuses cars. Click any box to see what it is.");
      S.M = simulate(S.C);
      S.now = -1;
      S.playing = false;
      api.clock = BASE;
      api.log("22:58:00, before the show lets out. " + settingsLine(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      S.acc = (S.acc || 0) + dt * 20;
      if (!S.playing) { S.acc = 0; return; }
      var n = Math.floor(S.acc);
      if (n > 0) { S.acc -= n; advance(api, S.now + n); }
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. Opens at 22:58:00, before the show lets out.
      t.expect(t.api.clock === 82680 && t.stat("open") === "6 of 6" && t.stat("look") === 0 && t.stat("health") === "healthy" &&
        t.stat("refused") === 0 && t.stat("plate") === "not read yet" && t.stat("back") === "not yet" &&
        t.logText().indexOf("22:58:00, before the show lets out.") >= 0,
        "Opens at 22:58:00: six car parks lifting, no lookups, store healthy");

      // 2. 23:00 to 23:01: the rebuild meets the crowd; 160 lookups a second from the arena.
      begin();
      t.click("next"); t.click("next"); t.click("next"); t.click("next");
      t.expect(has("23:00:00 The show lets out: 2.5 cars a second") && has("23:00:00 The store starts its nightly index rebuild") &&
        has("23:00:10 The arena's 2.5 cars a second now make 160 lookups a second. The store can answer 2.") &&
        has("First car refused at the arena") && t.stat("health") === "rebuilding index" && t.stat("arena") === 160,
        "23:00: 2.5 cars a second meet a store answering 2; from 23:00:10 the arena's cars make 160 lookups a second");

      // 3. 23:04: healthy, but the barriers stay shut.
      begin();
      for (var i = 0; i < 4; i++) t.click("next");
      t.expect(has("23:04:00 The rebuild is finished. Health check: healthy.") && t.stat("health") === "healthy" && t.stat("open") === "0 of 6",
        "From 23:04:00 the health check says healthy, and every car park is still refusing cars");

      // 4. As built to the end: one plate 64 times in 9 s; barriers back at 23:38:00.
      begin();
      t.click("end");
      t.expect(t.stat("plate") === "64, 23:30:00 to 23:30:09" && has("Plate HL68 RWT at the station: 64 lookups from 23:30:00 to 23:30:09") &&
        t.stat("back") === "23:38:00" && has("23:38:00 A barrier at the station lifts by itself.") && t.stat("refused") === "3,189" &&
        has("23:20:00 The last concert car reached the exit before 23:20:00. 101,212 lookups wait in the store's line; a new one would wait 16 min 52 s."),
        "As built: HL68 RWT looked up 64 times from 23:30:00 to 23:30:09; barriers back at 23:38:00");

      // 5. Changing a setting rewinds to 22:58:00.
      t.set("who", "barrier");
      t.expect(t.api.clock === 82680 && t.stat("open") === "6 of 6" && t.stat("refused") === 0, "Changing a setting rewinds to 22:58:00");

      // 6. The fix: retry at the barrier only, and shed load at the store.
      t.set("shed", "on");
      t.click("end");
      t.expect(t.stat("back") === "23:03:57" && t.stat("refused") === 138 && t.stat("plate") === "1, at 23:30:00" && t.stat("line") === 0,
        "Barrier-only retries plus shedding: 138 cars refused, all during the rebuild; barriers back at 23:03:57; HL68 RWT needs one lookup");

      // 7. Double the store: fine tonight.
      t.set("who", "all"); t.set("shed", "off"); t.set("cap", "200");
      t.click("end");
      t.expect(t.stat("back") === "never shut" && t.stat("refused") === 0, "Store at 200 a second: no car refused tonight");

      // 8. Double the store, a show twice the size: the storm returns.
      t.set("rate", "5");
      t.click("end");
      t.expect(t.stat("back") === "23:36:50" && t.stat("refused") === "6,173", "Store at 200, 5 cars a second: 5 x 64 = 320, 6,173 refused, barriers back only at 23:36:50");

      // 9. Longer timeouts: the storm still comes.
      t.set("rate", "2.5"); t.set("cap", "100"); t.set("timeout", "5");
      t.click("end");
      t.expect(t.stat("back") === "23:37:30" && t.stat("refused") === "3,149", "Timeout 5 s at every layer: 3,149 refused, barriers back at 23:37:30");

      // 10. Rebuild moved to 04:00: tonight is clean, a 30 s hiccup at 23:10 brings the storm back.
      t.set("timeout", "1"); t.set("slow", "none");
      t.click("end");
      var none = t.stat("refused") === 0 && t.stat("back") === "never shut";
      t.set("slow", "blip");
      t.click("end");
      t.expect(none && t.stat("back") === "23:27:24", "No slow spell: no car refused; a 30 s hiccup at 23:10: barriers back at 23:27:24");
    }
  });
})();
