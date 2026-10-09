/* sims/s2e16-v1.0.0.js  (published as sims/s2e16.js)
   Case s2e16 "Field Report: Roll Call": Ishbel keeps the night radio at Inchkeld harbour and is on
   call for the fishing co-op's app. Struan's Roll is a service registry copied from Netflix's 2012
   Eureka post: nine berth servers, a1 to c3, three in each of zones A, B and C, send it a heartbeat
   every 30 seconds and are struck off after 90 seconds of silence. Three app servers fetch the list
   on their own schedules, keep their own copies, and spread their lookups over them themselves,
   with no load balancer in between (client-side load balancing). The learner replays Tuesday
   night: b2 dies with no goodbye, b4 joins as its replacement, and a network fault cuts zone B's
   heartbeats off from the Roll for nine minutes.

   CHANGELOG
   v1.0.0 (2026-10-10) first version: Tuesday night at Inchkeld from 02:13:50, in slots of one sim
     second. Settings (changing one replays the night): self-preservation (85% of the heartbeats
     expected in the last minute), how often the app servers fetch the list (30 s, 5 min or
     30 min), and one retry of a failed lookup on another server from the same list (never a
     booking). Events: b2 dies at 02:14:00, b4 starts at 02:20:00, and zone B's heartbeats can't
     reach the Roll from 03:30:00 to 03:39:00 (all scripted), plus a button that pulls the plug on
     the server on the roll whose heartbeat is due next. Also: clock speed (no replay), skip to
     03:29:50, replay, reset. Stats: lookups sent to a dead server, lookups failed, the share of
     lookups failing now, how long the last server to die took to be struck off and to leave every
     app server's list, and healthy servers wrongly struck off. selfTest: 22 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e16-v1.0.0.json):
   - post: nine berth servers a1 to c3, three per zone, answering the Roll every 30 seconds and
     struck off after 90 seconds of silence (copied from the Eureka post: heartbeats "every 30
     seconds", "taken out of the server registry in about 90 seconds", callers fetch every 30
     seconds); three app servers, about 90 lookups a second, a 2-second give-up; 1 lookup in 10
     books a berth; Struan's 5-minute fetch. Tuesday's log: b2 loses its power at 02:14:00, is
     struck off at 02:15:15 after 90 s of silence, and is off the last list at 02:20:00 with
     2,600 sent and 0 answered; b4 signs in at 02:20:30; no heartbeats from zone B at 03:30:00;
     b4, b1 and b3 struck off by 03:31:18; zone B heard again at 03:39:00; every list whole at
     03:43:20 with 7,000 failed since 03:30.
   - comments: self-preservation below 85% of the renewals expected (u/wiki_page_hesketh); one
     retry on a different server, Ribbon's MaxAutoRetriesNextServer default of 1, and never a
     booking, which is a POST (u/second_server_eilidh).
   - sim.lede: 30 lookups a second from each app server, spread evenly over its own list, round
     robin; each fetches on its own schedule, a third of the interval apart; a berth server
     answers up to 12 a second and the extra fail at once; a lookup to a dead server waits 2 s and
     fails; b4 starts at 02:20:00 and signs in 30 s later; zone B cut off from 03:30:00 to
     03:39:00 while the app servers still reach it; a struck-off server signs in again with its
     next heartbeat that gets through; self-preservation counts the heartbeats heard in the last
     minute against 85% of two for every server on the roll; a retry goes to one other server on
     the same list, spread evenly, and works only if that server is alive and has room, counted in
     the same second as the try it replaces.
   - reply options (part 2s) and explain: index 0 (all three changes): 900 lookups to b2, 810
     retried and answered, the 90 that failed all bookings, off every list by 02:15:40; b4 signed
     in at 02:20:30 with its full share by 02:20:50; 15 of the 18 heartbeats heard at 03:30:18, so
     the Roll strikes nobody off and nothing fails. Index 1 (30-second fetch and retries): the
     same 900, 810 and 90; b4, b1 and b3 struck off at 03:31:00, 03:31:12 and 03:31:18; all three
     app servers on six servers from 03:31:40; one lookup in five failing until 03:39:00; the last
     failure at 03:39:19; 8,259 failed. Index 2 (30-minute fetch): 9,600 lookups to b2 over 26
     minutes, app-2 holding it until 02:40:00; b4's first lookup at 02:30:00 and full share at
     02:50:00; the zone B servers struck off at 03:31 and signed back in at 03:39 with no fetch in
     between, so nothing failed. Index 3 (self-preservation only): b2 as on Tuesday (struck off at
     02:15:15, on lists until 02:20:00, 2,600 sent and failed); b4's first lookup at 02:21:40 and
     full share at 02:25:00; nothing failed in the fault. explain steps 2 to 4: 75 s to strike
     b2 off, 360 s to drop it with 5 minutes and 100 s with 30 seconds; 2,600 failures became 260
     with retries and the 5-minute fetch; the shorter list fetched at 03:31:40, 03:33:20 and
     03:35:00, 15 lookups a second against 12, lists whole at 03:43:20, 7,000 failures.
     explain.diagram: at 03:31:18 on Friday the Roll has 9 on the roll and heard 12/18, holding;
     every app server holds a list of 9, fetched every 30 s, retrying once elsewhere; every berth
     server gets 10 a second, and b1, b3 and b4 show "no beat". tryThis: two more plugs pulled
     within half a minute, with self-preservation on, are both kept.

   Teaching model (stated in sim.lede):
   - Slot n is one sim second; slot 0 is 02:13:50, slot 10 is 02:14:00, slot 370 is 02:20:00,
     slot 4560 is 03:29:50, slot 4570 is 03:30:00 and slot 5110 is 03:39:00. Each frame processes
     every slot that is due, so results never depend on the frame rate. Lookups are steady flows
     (fractions of a lookup), so no api.rand() is needed; displayed counts are rounded.
   - Heartbeats: each server beats on its own second of the half minute and 30 s later: b4 :00,
     a1 :03, c1 :06, a2 :09, b1 :12, b2 :15, b3 :18, c2 :21, a3 :24, c3 :27. Slot 0 is at :50,
     so second p is slot residue (p + 10) mod 30. b2 is on :15 because its last heartbeat reached
     the Roll at 02:13:45 (explain step 2); b4 on :00 because it starts at 02:20:00 and signs in
     30 s later; b1 on :12 and b3 on :18 because they were struck off at 03:31:12 and 03:31:18
     (reply index 1), 90 s after 03:29:42 and 03:29:48. The others are spread 3 s apart.
   - Inside a slot, in order: scripted events; heartbeats (a blocked one is not heard; one from a
     server off the roll signs it in); the self-preservation check; evictions (every server on the
     roll with n - lastHeard >= 90, unless the Roll is holding); fetches; lookups. A plug pulled
     from the panel takes effect from the next slot, before its heartbeats.
   - Self-preservation: heard = heartbeats heard in slots n - 59 to n; expected = 2 x the servers
     on the roll; with it on, the Roll holds while 100 x heard < 85 x expected (whole numbers, so
     the 85% line is never rounded).
   - Fetches: app-k (k = 1, 2, 3) fetches at the slots n where (n - 370 - k x I/3) mod I = 0, I
     being the interval in seconds, so app-3 fetches at 02:20:00 at every interval. 5 min: app-1
     at residue 170, app-2 at 270, app-3 at 70 (mod 300). 30 s: app-1 at 20, app-2 at 0, app-3 at
     10 (mod 30). 30 min: app-1 at 970, app-2 at 1570, app-3 at 370 (mod 1800). A fetch copies the
     roll as it stands after that slot's sign-ins and evictions. At 02:13:50 every list holds the
     nine original servers.
   - Lookups: app-k sends 30/m a second to each of the m servers on its list. A live server
     answers up to 12 a second, and past that the extra share of each sender's lookups fails at
     once; a dead one answers none. Of the failed first tries, the 1 in 10 that are bookings fail;
     with retries on, the other 9 in 10 are spread evenly over the other m - 1 servers on the same
     list, and each server takes as many retries as it has room for (12 minus its first tries; a
     dead one, none). Without retries every failed first try is a failure. Lookups sent to a dead
     server count as sent and failed in the second they're sent, not 2 s later.

   Derivations for the self-tests (all arithmetic, with the model above):
   - b2: its last heartbeat was at slot -5 (02:13:45), so it is struck off at slot 85 (02:15:15),
     75 s after it died at slot 10. With 9 on the roll and only b2 silent the Roll hears at least
     16 of 18, over 15.3, so self-preservation never holds for b2 alone.
   - b2 with 5 minutes: app-3 fetched at 70, before the strike, so the lists drop b2 at 170
     (app-1), 270 (app-2) and 370 (app-3, 02:20:00). Sent: 160 x 10 + 100 x 20/3 + 100 x 10/3 =
     2,600, every one failed; off every list 360 s after it died. 30 seconds: drops at 90 (app-2),
     100 (app-3) and 110 (app-1, 02:15:40): 80 x 10 + 10 x 20/3 + 10 x 10/3 = 900, 100 s. 30
     minutes: drops at 370 (app-3), 970 (app-1) and 1570 (app-2, 02:40:00): 360 x 10 + 600 x 20/3
     + 600 x 10/3 = 9,600 over 26 minutes, 1,560 s.
   - Retries while b2 is listed: the busiest live server gets 10 + 9/8 = 11.13 (three lists of 9),
     3.75 + 20/3 + 0.75 = 11.17 (one list of 8) or 7.5 + 10/3 + 0.375 = 11.21 (two), all under 12,
     so every retried lookup is answered and only the bookings fail: 90 of 900 (810 answered
     elsewhere) and 260 of 2,600.
   - b4: starts at 370 and signs in at 400 (02:20:30). 30 s: app-3 at 400 (first lookups), app-1
     at 410, app-2 at 420 (full share, 02:20:50). 5 min: 470 (02:21:40), 570, 670 (02:25:00). 30
     min: 970 (02:30:00), 1570, 2170 (02:50:00). With every list holding the nine, each berth
     server gets 3 x 30/9 = 10 a second.
   - The fault (slots 4570 to 5109): b4 last heard at 4540 (03:29:30), b1 at 4552, b3 at 4558,
     so without self-preservation they are struck off at 4630 (03:31:00), 4642 (03:31:12) and 4648
     (03:31:18), all alive: 3 wrongly. With it, the window at slot 4588 (03:30:18), 4529 to 4588,
     holds 12 heartbeats from the six others plus b4's 4540, b1's 4552 and b3's 4558: 15, under
     15.3, so it holds (at 4587 b3's 4528 still counts: 16). At 03:31:18 it hears 12 of 18. Zone B
     is heard again at 5110 (b4, 03:39:00), 5122 (b1) and 5128 (b3), each signing in again if it
     was struck off; at 5140 (03:39:30) b4's next heartbeat makes 16 and self-preservation lets go,
     having struck nobody off.
   - Tuesday (5 minutes, no retries): app-1 drops zone B at 4670 (03:31:40), app-2 at 4770
     (03:33:20), app-3 at 4870 (03:35:00); app-3 gets all nine back at 5170 (03:40:00), app-1 at
     5270 (03:41:40), app-2 at 5370 (03:43:20). Each of a1 to a3 and c1 to c3 gets 5 + 10/3 + 10/3
     = 11.67 (no failures), then 5 + 5 + 10/3 = 13.33 (1.33 extra each, 8 a second), 15 (18 a
     second, 20%), 13.33, 11.67. Failures: 100 x 8 + 300 x 18 + 100 x 8 = 7,000, the last at 5269
     (03:41:39); lists whole at 5370.
   - Reply index 1 (30 s, retries): lists without b4 at 4630 (app-3) and 4640 (app-1); without b1,
     b3 and b4 at 4650 (app-2), 4660 (app-3) and 4670 (app-1, 03:31:40); with b4 at 5110 (app-3)
     and 5120 (app-1); all nine at 5130 (app-2), 5140 (app-3) and 5150 (app-1, 03:39:40).
     Failures a second: 4650-4659 2.537 (some retries land on b1 and b3, which have room);
     4660-4669 9.764; 4670-5109 18, 20% (every retry lands on a full server); 5110-5119 13.097 (a
     sixth of app-3's retries land on b4); 5120-5129 8.535; from 5130 the busiest server gets 11.9
     and nothing fails. Total 25.37 + 97.64 + 7,920 + 130.97 + 85.35 = 8,259.3, the last at 5129
     (03:39:19).
   - Reply index 2 (30 minutes): app-1 fetches at 4570 (03:30:00, before any strike) and app-2 at
     5170 (03:40:00, after every sign-in), and nobody else fetches in between, so no list loses a
     server: 3 struck off, nothing failed.
   - Two plugs within half a minute, self-preservation on: the button stops the server on the roll
     whose next heartbeat is due soonest. X, pulled at d1, misses its heartbeat at m1 >= d1 and
     would be struck off at m1 + 60. Y, pulled at d2 <= d1 + 30, misses its next one at m2 <= d2 +
     29 <= m1 + 59, so at slot m1 + 60 the window m1 + 1 to m1 + 60 lacks both of X's heartbeats
     and at least one of Y's: heard <= 2R - 3, under 1.7R for any R <= 9 servers on the roll, so
     the Roll holds before X's lease runs out. Test: after b4 signs in, a1 is pulled at 02:21:02
     (due at 02:21:03) and b1 at 02:21:12; at 02:21:33 the Roll hears 15 of 18 and holds, and a1
     (lease out at 02:22:33) stays listed. Without self-preservation a1 is struck off at 02:22:03,
     61 s after it died.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label, group label and note 11px):
   - The Roll (300 wide, 62 high, y 17 to 79): longest sub "10 on the roll, heard 18/20" 27 chars,
     194px; longest meta "self-preservation: holding" 26 chars, 172px.
   - App servers (200 wide, y 134 to 196): longest sub "list of 10, every 30 min" 24 chars,
     173px; meta "retry once elsewhere" 20 chars, 132px. 55px between the Roll and the app servers.
   - Berth servers (60 wide, 56 high, y 282 to 338, centres 66 apart, 6px between boxes): label
     2 chars, 16px; longest sub "13.3/s" 6 chars, 43px; longest meta "starting" 8 chars, 53px.
     Zone groups at y 245 to 355; group labels at y 252 to 265, above the boxes. 86px between the
     app servers and the berth servers.
   - Edge labels "list" (26px) sit between the Roll and the app servers at y 89 to 102, as in the
     case's explain diagram. Notes at y 375 to 388 (403px) and 395 to 408 (350px), under the zones.

   Catalog note: the case's concepts are the catalog's ids for s2e16 (eureka,
   service-registry-for-a-cloud-where-servers-come, go, instances-registering).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 2 * 3600 + 13 * 60 + 50;   // 02:13:50 on Tuesday
  var BEAT = 30;              // a heartbeat every 30 s (Eureka's default)
  var LEASE = 90;             // struck off after 90 s without one (Eureka's default)
  var WINDOW = 60;            // self-preservation counts the last minute
  var PER_SERVER_MIN = 2;     // heartbeats expected a minute from each server on the roll
  var LINE_PCT = 85;          // the self-preservation line, 85% (Eureka's default)
  var APPS = 3;
  var PER_APP = 30;           // lookups a second from each app server (teaching value)
  var TOTAL = APPS * PER_APP; // 90 a second
  var CAP = 12;               // lookups a second one berth server answers (teaching value)
  var BOOKING = 0.1;          // 1 lookup in 10 books a berth and is never retried
  var B2_DIES = 10;           // 02:14:00
  var B4_STARTS = 370;        // 02:20:00
  var CUT_FROM = 4570;        // 03:30:00: zone B's heartbeats stop reaching the Roll
  var CUT_TO = 5110;          // 03:39:00: they reach it again
  var SKIP_TO = 4560;         // 03:29:50
  var ANCHOR = 370;           // 02:20:00: app-3 fetches here at every interval
  var EPS = 1e-6;
  var DOT_EVERY = 0.2;        // real seconds between sample lookup dots
  var DOT_SPEED = 300;        // viewBox units per real second
  var BEAT_DOTS_MAX_SPEED = 10;

  // Each server's second of the half minute (clock) and its place in the diagram.
  var SV = [
    { id: "a1", zone: "A", clock: 3, x: 52 },
    { id: "a2", zone: "A", clock: 9, x: 118 },
    { id: "a3", zone: "A", clock: 24, x: 184 },
    { id: "b1", zone: "B", clock: 12, x: 271 },
    { id: "b2", zone: "B", clock: 15, x: 337 },
    { id: "b3", zone: "B", clock: 18, x: 403 },
    { id: "b4", zone: "B", clock: 0, x: 469 },
    { id: "c1", zone: "C", clock: 6, x: 556 },
    { id: "c2", zone: "C", clock: 21, x: 622 },
    { id: "c3", zone: "C", clock: 27, x: 688 }
  ];
  var B2 = 4;
  var B4 = 6;
  var SV_Y = 310;
  // Slot 0 is at :50, so a server that beats at second p of the half minute beats on slots
  // n = p + 10 (mod 30).
  for (var q = 0; q < SV.length; q++) SV[q].ph = (SV[q].clock + 10) % BEAT;

  var FETCH_OPTS = [
    { value: "30", label: "every 30 s (Eureka's default)" },
    { value: "300", label: "every 5 min (Struan's)" },
    { value: "1800", label: "every 30 min" }
  ];
  var SPEED_OPTS = [
    { value: "1", label: "real time" },
    { value: "10", label: "10 s a second" },
    { value: "60", label: "1 minute a second" },
    { value: "600", label: "10 minutes a second" }
  ];

  /* ---------- small helpers ---------- */

  // 2600 -> "2,600". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 10 -> "10", 13.333 -> "13.3", 0 -> "0".
  function rateText(v) {
    if (!(v >= 0.05)) return "0";
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function mod(a, m) { return ((a % m) + m) % m; }

  // Slot n as a clock time: slot 85 -> "02:15:15".
  function slotClock(n) {
    var s = mod(START_CLOCK + n, 86400);
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }

  function joinNames(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function say(api, msg, tone) { if (!api.state.quiet) api.log(msg, tone || ""); }

  function everyText(sec) { return sec === 30 ? "30 s" : sec === 300 ? "5 min" : "30 min"; }
  function everyWords(sec) { return sec === 30 ? "30 seconds" : sec === 300 ? "5 minutes" : "30 minutes"; }

  /* ---------- the diagram ---------- */

  function serverNode(i) {
    var s = SV[i];
    return {
      id: s.id, label: s.id, sub: i === B4 ? "off" : "10/s", meta: i === B4 ? "not yet" : "on roll",
      x: s.x, y: SV_Y, w: 60, h: 56, shape: "box", tone: i === B4 ? "muted" : "ok"
    };
  }

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 420,
    aria: "Roll call sim for the fishing co-op at Inchkeld. The Roll, a service registry, sits at the top. Ten berth servers sit in three zones: a1 to a3 in zone A, b1 to b4 in zone B, c1 to c3 in zone C; b4 starts at 02:20:00. Each sends the Roll a heartbeat every 30 seconds, and the Roll strikes off any it hasn't heard from in 90 seconds. Three app servers, app-1 to app-3, fetch the list from the Roll on their own schedules, keep their own copies, and send 30 lookups a second each, spread over their own lists, straight to the berth servers, with no load balancer in between.",
    groups: [
      { label: "zone A", x: 15, y: 245, w: 205, h: 110 },
      { label: "zone B", x: 233, y: 245, w: 274, h: 110 },
      { label: "zone C", x: 520, y: 245, w: 205, h: 110 }
    ],
    nodes: [
      { id: "roll", label: "The Roll", sub: "9 on the roll, heard 18/18", meta: "self-preservation: off", x: 370, y: 48, w: 300, h: 62, shape: "box", tone: "accent" },
      { id: "app1", label: "app-1", sub: "list of 9, every 5 min", meta: "no retries", x: 130, y: 165, w: 200, h: 62, shape: "box", tone: "ok" },
      { id: "app2", label: "app-2", sub: "list of 9, every 5 min", meta: "no retries", x: 370, y: 165, w: 200, h: 62, shape: "box", tone: "ok" },
      { id: "app3", label: "app-3", sub: "list of 9, every 5 min", meta: "no retries", x: 610, y: 165, w: 200, h: 62, shape: "box", tone: "ok" },
      serverNode(0), serverNode(1), serverNode(2), serverNode(3), serverNode(4),
      serverNode(5), serverNode(6), serverNode(7), serverNode(8), serverNode(9)
    ],
    edges: [
      { from: "roll", to: "app1", label: "list", dash: true, tone: "muted" },
      { from: "roll", to: "app2", label: "list", dash: true, tone: "muted" },
      { from: "roll", to: "app3", label: "list", dash: true, tone: "muted" }
    ],
    notes: [
      { x: 20, y: 385, text: "Each app server balances over its own list. No load balancer.", tone: "muted", anchor: "start" },
      { x: 20, y: 405, text: "Heartbeats every 30 s, each server on its own second.", tone: "muted", anchor: "start" }
    ]
  };

  /* ---------- the night's rules ---------- */

  function freshServers() {
    var a = [];
    for (var i = 0; i < SV.length; i++) {
      var orig = i !== B4;
      a.push({
        running: orig, alive: true, onRoll: orig, everIn: orig,
        lastHeard: orig ? SV[i].ph - BEAT : null,   // the last heartbeat before 02:13:50
        firstBeat: null,                             // b4's is set when it starts
        diedAt: null, struckAt: null, droppedAt: null,
        sent: 0, rescued: 0
      });
    }
    return a;
  }

  function originalList() {
    var l = [];
    for (var i = 0; i < SV.length; i++) if (i !== B4) l.push(i);
    return l;
  }

  function beats(sv, i, n) {
    return sv.running && sv.alive && mod(n, BEAT) === SV[i].ph && (sv.firstBeat === null || n >= sv.firstBeat);
  }

  function onRollCount(S) {
    var c = 0;
    for (var i = 0; i < SV.length; i++) if (S.sv[i].onRoll) c++;
    return c;
  }

  function listsWith(S, i) {
    var c = 0;
    for (var k = 0; k < APPS; k++) if (S.lists[k].indexOf(i) >= 0) c++;
    return c;
  }

  // Lookups a second the app servers send server i, first tries only, from their current lists.
  function shareOf(S, i) {
    var s = 0;
    for (var k = 0; k < APPS; k++) {
      var L = S.lists[k];
      if (L.length && L.indexOf(i) >= 0) s += PER_APP / L.length;
    }
    return s;
  }

  // A live server the Roll has listed at least once.
  function counts(sv) { return sv.running && sv.alive && sv.everIn; }

  function rollWhole(S) {
    for (var i = 0; i < SV.length; i++) if (counts(S.sv[i]) && !S.sv[i].onRoll) return false;
    return true;
  }

  function listsWhole(S) {
    for (var i = 0; i < SV.length; i++) if (counts(S.sv[i]) && listsWith(S, i) < APPS) return false;
    return true;
  }

  function listStale(S, k) {
    var L = S.lists[k];
    for (var i = 0; i < SV.length; i++) {
      var on = L.indexOf(i) >= 0;
      if (on && !S.sv[i].alive) return true;
      if (!on && counts(S.sv[i])) return true;
    }
    return false;
  }

  function fetchOffset(S, k) { return (k + 1) * S.every / 3; }

  function fetchDue(S, k, n) { return mod(n - ANCHOR - fetchOffset(S, k), S.every) === 0; }

  // The last slot at or before n on which app-k fetched.
  function lastFetch(S, k, n) { return n - mod(n - ANCHOR - fetchOffset(S, k), S.every); }

  /* ---------- one slot ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    api.clock = START_CLOCK + n;   // log lines carry this slot's own time

    if (n === B2_DIES && S.sv[B2].alive) kill(api, B2, true);
    if (n === B4_STARTS) startB4(api, n);
    if (n === CUT_FROM) {
      var zb = [];
      for (var i = 0; i < SV.length; i++) if (SV[i].zone === "B" && S.sv[i].running && S.sv[i].alive) zb.push(SV[i].id);
      say(api, "A network fault stops zone B's heartbeats reaching the Roll. The app servers still reach zone B" +
        (zb.length ? ", and " + joinNames(zb) + " keep answering lookups." : "."), "bad");
    }
    if (n === CUT_TO) say(api, "The fault is fixed: zone B's heartbeats reach the Roll again.", "ok");

    heartbeats(api, n);
    selfPreservation(api, n);
    if (!S.holding) evictions(api, n);
    for (var k = 0; k < APPS; k++) if (fetchDue(S, k, n)) fetchList(api, k, n);
    afterFetches(api, n);
    lookups(api, n);
    partitionWatch(api, n);
    S.n = n + 1;
  }

  function heartbeats(api, n) {
    var S = api.state;
    var r = mod(n, WINDOW);
    S.heard -= S.ring[r];
    S.ring[r] = 0;
    var cut = n >= CUT_FROM && n < CUT_TO;
    for (var i = 0; i < SV.length; i++) {
      var sv = S.sv[i];
      if (!beats(sv, i, n)) continue;
      var blocked = cut && SV[i].zone === "B";
      beatDot(api, i, blocked);
      if (blocked) continue;
      sv.lastHeard = n;
      S.ring[r] += 1;
      S.heard += 1;
      if (!sv.onRoll) {
        var first = !sv.everIn;
        sv.onRoll = true;
        sv.everIn = true;
        say(api, first ? SV[i].id + " signs in with its first heartbeat." :
          SV[i].id + " signs in again with its first heartbeat that got through.", "ok");
      }
    }
  }

  function selfPreservation(api, n) {
    var S = api.state;
    var expected = PER_SERVER_MIN * onRollCount(S);
    var hold = S.selfPres && 100 * S.heard < LINE_PCT * expected;
    if (hold && !S.holding) {
      say(api, "The Roll heard " + S.heard + " of the " + expected + " heartbeats it expects in the last minute, under 85%. " +
        "Self-preservation holds: it strikes nobody off.", "warn");
    } else if (!hold && S.holding) {
      say(api, "The Roll hears " + S.heard + " of the " + expected + " heartbeats it expects again, and self-preservation lets go.", "ok");
    }
    S.holding = hold;
  }

  function evictions(api, n) {
    var S = api.state;
    for (var i = 0; i < SV.length; i++) {
      var sv = S.sv[i];
      if (!sv.onRoll || n - sv.lastHeard < LEASE) continue;
      var holders = listsWith(S, i);   // before anything changes
      var msg = SV[i].id + " struck off: nothing heard for " + (n - sv.lastHeard) + " s, since " + slotClock(sv.lastHeard) + ".";
      if (sv.alive) msg += " It's alive and still answering.";
      if (holders === APPS) msg += " Every app server's list still has it, until that app server fetches again.";
      else if (holders > 0) msg += " " + holders + " of the 3 app servers' lists still have it, until they fetch again.";
      sv.onRoll = false;
      sv.struckAt = n;
      if (sv.alive) {
        S.wrong += 1;
        if (n >= CUT_FROM) S.partStruck += 1;
      }
      say(api, msg, sv.alive ? "bad" : "warn");
    }
  }

  function fetchList(api, k, n) {
    var S = api.state;
    var old = S.lists[k];
    var fresh = [];
    var i, j;
    for (i = 0; i < SV.length; i++) if (S.sv[i].onRoll) fresh.push(i);
    var gone = [], added = [];
    for (j = 0; j < old.length; j++) if (fresh.indexOf(old[j]) < 0) gone.push(SV[old[j]].id);
    for (j = 0; j < fresh.length; j++) if (old.indexOf(fresh[j]) < 0) added.push(SV[fresh[j]].id);
    if (gone.length || added.length) {
      say(api, "app-" + (k + 1) + " fetches the list: " + fresh.length + " servers, " +
        (gone.length ? "without " + joinNames(gone) : "") + (gone.length && added.length ? ", and " : "") +
        (added.length ? "with " + joinNames(added) : "") + ".", "");
    }
    if (added.indexOf("b4") >= 0 && S.b4Fetcher === null) S.b4Fetcher = k;
    S.lists[k] = fresh;
  }

  function afterFetches(api, n) {
    var S = api.state;
    var b4 = S.sv[B4];
    if (b4.everIn && b4.alive) {
      var c = listsWith(S, B4);
      if (!S.b4First && c >= 1) {
        S.b4First = true;
        say(api, "b4 gets its first lookups: app-" + ((S.b4Fetcher === null ? 0 : S.b4Fetcher) + 1) + "'s new list has it.", "ok");
      }
      if (!S.b4Full && c === APPS) {
        S.b4Full = true;
        say(api, "b4 has its full share: every app server's list has it.", "ok");
      }
    }
    for (var i = 0; i < SV.length; i++) {
      var sv = S.sv[i];
      if (sv.alive || sv.onRoll || sv.struckAt === null || sv.droppedAt !== null) continue;
      if (listsWith(S, i) > 0) continue;
      sv.droppedAt = n;
      // The counts are as they stood before this slot's lookups, none of which go to it.
      var msg = SV[i].id + " is off every app server's list now. " + fmt(sv.sent) + " lookups were sent to it, and it answered none.";
      if (S.retry && sv.rescued >= 0.5) msg += " " + fmt(sv.rescued) + " were retried on another server and answered.";
      say(api, msg, "warn");
    }
  }

  function lookups(api, n) {
    var S = api.state;
    var N = SV.length;
    var load = S.load, rload = S.rload, room = S.room, ff = S.ff, acc = S.acc;
    var i, j, k, x, L, per, f, each;
    for (i = 0; i < N; i++) { load[i] = 0; rload[i] = 0; }
    var fail = 0;

    // First tries: each app server spreads its 30 a second evenly over its own list.
    for (k = 0; k < APPS; k++) {
      L = S.lists[k];
      if (!L.length) { fail += PER_APP; continue; }
      per = PER_APP / L.length;
      for (j = 0; j < L.length; j++) load[L[j]] += per;
    }
    for (i = 0; i < N; i++) {
      var alive = S.sv[i].alive;
      ff[i] = !alive ? 1 : (load[i] > CAP + EPS ? (load[i] - CAP) / load[i] : 0);
      room[i] = alive ? Math.max(0, CAP - load[i]) : 0;
    }

    // Failed first tries: bookings fail; the rest fail too, or with retries on go once to the
    // other servers on the same app server's list, spread evenly.
    for (k = 0; k < APPS; k++) {
      L = S.lists[k];
      if (!L.length) continue;
      per = PER_APP / L.length;
      for (j = 0; j < L.length; j++) {
        f = per * ff[L[j]];
        if (!(f > 0)) continue;
        if (!S.retry || L.length < 2) { fail += f; continue; }
        fail += BOOKING * f;
        each = (1 - BOOKING) * f / (L.length - 1);
        for (x = 0; x < L.length; x++) if (x !== j) rload[L[x]] += each;
      }
    }

    // Each server takes as many retries as it has room for; a dead one takes none.
    for (i = 0; i < N; i++) {
      acc[i] = Math.min(rload[i], room[i]);
      fail += rload[i] - acc[i];
    }

    // Which servers' failed lookups the retries rescued (for the log).
    if (S.retry) {
      for (k = 0; k < APPS; k++) {
        L = S.lists[k];
        if (L.length < 2) continue;
        per = PER_APP / L.length;
        for (j = 0; j < L.length; j++) {
          f = per * ff[L[j]];
          if (!(f > 0)) continue;
          each = (1 - BOOKING) * f / (L.length - 1);
          for (x = 0; x < L.length; x++) {
            var t = L[x];
            if (x !== j && rload[t] > 0) S.sv[L[j]].rescued += each * acc[t] / rload[t];
          }
        }
      }
    }

    var deadNow = 0;
    for (i = 0; i < N; i++) {
      var sv = S.sv[i];
      sv.sent += load[i] + rload[i];
      if (!sv.alive) deadNow += load[i] + rload[i];
    }
    S.deadSent += deadNow;
    S.failed += fail;
    S.failNow = fail;
    if (n >= CUT_FROM) {
      S.partFailed += fail;
      if (fail > EPS) S.lastPartFail = n;
    }
    overloadLog(api, load);
  }

  function overloadLog(api, load) {
    var S = api.state;
    var over = 0, top = 0;
    for (var i = 0; i < SV.length; i++) {
      if (S.sv[i].alive && load[i] > CAP + EPS) {
        over += 1;
        if (load[i] > top) top = load[i];
      }
    }
    var key = over ? over + "@" + rateText(top) : "";
    if (key === S.overKey) return;
    if (over) {
      say(api, (over === 1 ? "1 berth server gets more than the 12 lookups a second it answers" :
        over + " berth servers get more than the 12 lookups a second they answer") + ", the busiest " + rateText(top) +
        ": the extra fail at once. Failing now: " + rateText(100 * S.failNow / TOTAL) + "% of lookups.", "bad");
    } else {
      say(api, "No berth server gets more than 12 lookups a second now.", "ok");
    }
    S.overKey = key;
  }

  function partitionWatch(api, n) {
    var S = api.state;
    if (n < CUT_FROM || S.summary) return;
    if (!listsWhole(S)) { S.broken = true; return; }
    if (n < CUT_TO || S.holding || !rollWhole(S)) return;
    S.summary = true;
    var head = S.broken ? "Every app server's list is whole again. " :
      S.partStruck > 0 ? "Every server is back on the Roll, and no app server fetched the list while any was off it. " :
      "Every server stayed on the Roll and on every list. ";
    var tail = S.partFailed > EPS && S.lastPartFail !== null ?
      fmt(S.partFailed) + " lookups failed since 03:30:00, the last at " + slotClock(S.lastPartFail) + "." :
      "Nothing failed since 03:30:00.";
    say(api, head + tail, S.partFailed > EPS ? "warn" : "ok");
  }

  /* ---------- events ---------- */

  function kill(api, i, scripted) {
    var S = api.state;
    var sv = S.sv[i];
    var share = shareOf(S, i);   // before it dies: what the app servers send it now
    var msg = scripted ? "b2 loses its power in zone B, with no goodbye." :
      "Plug pulled: " + SV[i].id + ", the next server due to call in, loses its power with no goodbye.";
    msg += " Its last heartbeat reached the Roll at " + slotClock(sv.lastHeard) + ", and the app servers " +
      (share > EPS ? "keep sending it " + rateText(share) + " lookups a second. Each waits 2 s and gets no answer." :
        "aren't sending it any lookups.");
    sv.alive = false;
    sv.diedAt = S.n;
    sv.struckAt = null;
    sv.droppedAt = null;
    sv.sent = 0;                 // the drop message counts only what was sent after it died
    sv.rescued = 0;
    S.track = i;
    say(api, msg, "bad");
  }

  function startB4(api, n) {
    var S = api.state;
    var sv = S.sv[B4];
    sv.running = true;
    sv.firstBeat = n + BEAT;
    say(api, "b4 starts in zone B, b2's replacement. It signs in with its first heartbeat, 30 s from now, at " + slotClock(n + BEAT) + ".", "");
  }

  function pluggable(S) {
    var n = S.n, best = -1, bestAt = 0;
    for (var i = 0; i < SV.length; i++) {
      var sv = S.sv[i];
      if (!sv.alive || !sv.onRoll) continue;
      var next = n + mod(SV[i].ph - n, BEAT);
      if (best < 0 || next < bestAt) { best = i; bestAt = next; }
    }
    return best;
  }

  function pullPlug(api) {
    var S = api.state;
    var i = pluggable(S);
    if (i < 0) { say(api, "Nobody on the Roll is left to pull the plug on.", ""); return; }
    kill(api, i, false);
    draw(api);
  }

  /* ---------- the night ---------- */

  function startNight(api, why) {
    var S = api.state;
    var i, m;
    S.t = 0;
    S.n = 0;
    api.clock = START_CLOCK;
    S.sv = freshServers();
    S.lists = [originalList(), originalList(), originalList()];
    S.ring = zeros(WINDOW);
    for (m = -WINDOW; m < 0; m++) {
      for (i = 0; i < SV.length; i++) if (i !== B4 && mod(m, BEAT) === SV[i].ph) S.ring[mod(m, WINDOW)] += 1;
    }
    S.heard = 0;
    for (m = 0; m < WINDOW; m++) S.heard += S.ring[m];
    S.holding = false;
    S.deadSent = 0;
    S.failed = 0;
    S.failNow = 0;
    S.wrong = 0;
    S.track = null;
    S.partFailed = 0;
    S.lastPartFail = null;
    S.partStruck = 0;
    S.broken = false;
    S.summary = false;
    S.overKey = "";
    S.b4First = false;
    S.b4Full = false;
    S.b4Fetcher = null;
    S.quiet = false;
    S.dotClock = 0;
    S.dotTurn = 0;
    S.dotFail = 0;
    S.dotApp = 0;
    S.drawnAt = -1;
    say(api, (why ? why + " " : "") + "02:13:50, Tuesday night at Inchkeld. Nine berth servers answer the Roll every 30 seconds, " +
      "and three app servers send them 90 lookups a second from their own copies of the list, 10 a second for each server. " +
      "The app servers fetch the list every " + everyWords(S.every) + "; retries are " + (S.retry ? "on" : "off") +
      "; self-preservation is " + (S.selfPres ? "on" : "off") + ".", "");
    draw(api);
  }

  function replay(api, what) { startNight(api, what + " The night replays."); }

  /* ---------- controls ---------- */

  function setSelfPres(api, on) {
    api.state.selfPres = !!on;
    replay(api, on ? "Self-preservation on: while the Roll hears under 85% of the heartbeats it expects in a minute, it strikes nobody off." :
      "Self-preservation off: the Roll strikes off every server it hasn't heard from in 90 seconds.");
  }

  function setFetch(api, v) {
    var o = pick(FETCH_OPTS, v);
    if (!o) return;
    api.state.every = Number(o.value);
    replay(api, "The app servers now fetch the list every " + everyWords(api.state.every) + ".");
  }

  function setRetry(api, on) {
    api.state.retry = !!on;
    replay(api, on ? "Retries on: a lookup that fails is tried once more on another server from the same list, unless it's a booking." :
      "Retries off: a lookup that fails is an error.");
  }

  function setSpeed(api, v) {
    var o = pick(SPEED_OPTS, v);
    if (!o) return;
    api.speed = Number(o.value);
  }

  function skip(api) {
    var S = api.state;
    if (S.n >= SKIP_TO) return;
    S.quiet = true;
    var guard = 0;
    while (S.n < SKIP_TO && guard < 20000) { slot(api); guard += 1; }
    S.quiet = false;
    S.t = SKIP_TO;
    api.clock = START_CLOCK + SKIP_TO;
    var dead = S.deadSent, failed = S.failed;
    S.deadSent = 0;
    S.failed = 0;
    say(api, "Skipped to 03:29:50. Since 02:13:50, " + fmt(dead) + " lookups went to dead servers and " + fmt(failed) +
      " failed; those two counts start again from here. " + onRollCount(S) + " servers are on the Roll.", "");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function deathText(S, which) {
    if (S.track === null) return "-";
    var sv = S.sv[S.track];
    var at = which === "struck" ? sv.struckAt : sv.droppedAt;
    if (at !== null) return String(at - sv.diedAt);
    if (sv.onRoll && S.holding && S.n - 1 - sv.lastHeard >= LEASE) return "held";
    return "not yet";
  }

  function aliveStruck(S) {
    for (var i = 0; i < SV.length; i++) if (counts(S.sv[i]) && !S.sv[i].onRoll) return true;
    return false;
  }

  function serverMeta(S, i) {
    var sv = S.sv[i];
    if (!sv.running) return "not yet";
    if (!sv.onRoll) return sv.everIn ? "struck" : "starting";
    return S.n - 1 - sv.lastHeard >= BEAT ? "no beat" : "on roll";
  }

  function draw(api) {
    var S = api.state;
    var onRoll = onRollCount(S);

    var roll = api.node("roll");
    roll.text("sub", onRoll + " on the roll, heard " + S.heard + "/" + PER_SERVER_MIN * onRoll);
    roll.text("meta", "self-preservation: " + (!S.selfPres ? "off" : S.holding ? "holding" : "on"));
    roll.set(S.holding ? "warn" : aliveStruck(S) ? "bad" : "accent");

    for (var k = 0; k < APPS; k++) {
      var an = api.node("app" + (k + 1));
      an.text("sub", "list of " + S.lists[k].length + ", every " + everyText(S.every));
      an.text("meta", S.retry ? "retry once elsewhere" : "no retries");
      an.set(listStale(S, k) ? "warn" : "ok");
    }

    for (var i = 0; i < SV.length; i++) {
      var sv = S.sv[i];
      var nd = api.node(SV[i].id);
      var share = shareOf(S, i);
      var meta = serverMeta(S, i);
      nd.text("sub", sv.running ? rateText(share) + "/s" : "off");
      nd.text("meta", meta);
      nd.set(!sv.running ? "muted" : !sv.alive ? "bad" : (share > CAP + EPS || meta !== "on roll") ? "warn" : "ok");
    }

    S.stat.dead(fmt(S.deadSent));
    S.stat.failed(fmt(S.failed));
    S.stat.err(rateText(100 * S.failNow / TOTAL));
    S.stat.struck(deathText(S, "struck"));
    S.stat.dropped(deathText(S, "dropped"));
    S.stat.wrong(String(S.wrong));

    S.ctl.skip.disable(S.n >= SKIP_TO);
    S.ctl.plug.disable(pluggable(S) < 0);
    S.drawnAt = S.n;
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function beatDot(api, i, blocked) {
    var S = api.state;
    if (S.quiet || api.reducedMotion || api.speed > BEAT_DOTS_MAX_SPEED) return;
    if (blocked) {
      api.dot({ path: [SV[i].id, [SV[i].x, 230]], cls: "dot-wait", r: 3, speed: 200,
        onArrive: function (dot) { if (dot) dot.cls("dot-fail"); } });
    } else {
      api.dot({ path: [SV[i].id, "roll"], cls: "dot-accent", r: 3, speed: DOT_SPEED });
    }
  }

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || S.quiet) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    S.dotApp = (S.dotApp + 1) % APPS;
    var L = S.lists[S.dotApp];
    if (!L.length) return;
    S.dotTurn = (S.dotTurn + 0.6180339887) % 1;
    S.dotFail = (S.dotFail + 0.7548776662) % 1;
    var j = Math.min(L.length - 1, Math.floor(S.dotTurn * L.length));
    var i = L[j];
    var sv = S.sv[i];
    var load = shareOf(S, i);
    var bad = !sv.alive || (load > CAP + EPS && S.dotFail < (load - CAP) / load);
    var from = "app" + (S.dotApp + 1);
    var to = SV[i].id;
    if (!bad) {
      api.dot({ path: [from, to], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === to) dot.cls("dot-ok"); } });
      return;
    }
    if (!S.retry || L.length < 2) {
      api.dot({ path: [from, to], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === to) dot.cls("dot-fail"); } });
      return;
    }
    var o = L[(j + 1) % L.length];
    var other = SV[o].id;
    var otherOk = S.sv[o].alive && shareOf(S, o) < CAP - EPS;
    var hops = 0;
    api.dot({ path: [from, to, from, other], cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (dot) {
        if (!dot) return;
        hops += 1;
        if (hops === 1) dot.cls("dot-wait");
        if (hops === 3) dot.cls(otherOk ? "dot-ok" : "dot-fail");
      } });
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.sv) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t + EPS);
    var guard = 0;
    while (S.n < due && guard < 20000) { slot(api); guard += 1; }
    api.clock = START_CLOCK + S.t;
    if (S.drawnAt !== S.n) draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  function rollInfo(S) {
    var onRoll = onRollCount(S);
    return "<strong>The Roll.</strong> Struan's service registry, copied from Eureka. Every berth server signs in with its first heartbeat and then sends one every 30 seconds, each on its own second of the half minute. " +
      "The Roll strikes off any server it hasn't heard from in 90 seconds, without asking it; a struck-off server signs in again with its next heartbeat that gets through. 30 and 90 seconds are Eureka's documented defaults. " +
      (S.selfPres ? "Self-preservation is on: while the heartbeats heard in the last minute are under 85% of two for every server on the roll, it strikes nobody off, because the network is the likelier cause. " :
        "Self-preservation is off: silence always ends a lease. ") +
      "Right now " + onRoll + " servers are on the roll, and it heard " + S.heard + " of the " + PER_SERVER_MIN * onRoll + " heartbeats it expects in the last minute" +
      (S.holding ? ", so it's holding." : ".");
  }

  function appInfo(S, k) {
    var L = S.lists[k];
    var p = Math.max(0, S.n - 1);
    var deadOn = [], missing = [];
    for (var i = 0; i < SV.length; i++) {
      var on = L.indexOf(i) >= 0;
      if (on && !S.sv[i].alive) deadOn.push(SV[i].id);
      if (!on && counts(S.sv[i])) missing.push(SV[i].id);
    }
    var last = lastFetch(S, k, p);
    return "<strong>app-" + (k + 1) + ".</strong> One of the co-op's three app servers. It sends 30 lookups a second to the berth servers, spread evenly over its own copy of the list, round robin, and calls them directly: there is no load balancer in between. " +
      "It fetches the list from the Roll every " + everyWords(S.every) + ", a third of that apart from the other two. It last fetched at " + slotClock(last) +
      " and holds " + L.length + " servers" + (deadOn.length ? ", including " + joinNames(deadOn) + ", which no longer answer" : "") +
      (missing.length ? (deadOn.length ? ", and not " : ", but not ") + joinNames(missing) + ", which can answer" : "") + ". " +
      "A lookup to a dead server waits 2 s and fails; one past a server's 12 a second fails at once. " +
      (S.retry ? "Retries are on: a failed lookup is tried once more on another server from this list, unless it's a booking, which is never retried." :
        "Retries are off: a failed lookup is an error.");
  }

  function serverInfo(S, i) {
    var sv = S.sv[i];
    var p = Math.max(0, S.n - 1);
    var share = shareOf(S, i);
    var s = "<strong>" + SV[i].id + ".</strong> A berth server in zone " + SV[i].zone + ". It answers up to 12 lookups a second (a teaching value); past that, the extra fail at once. " +
      "Its heartbeat goes to the Roll at :" + pad(SV[i].clock) + " and :" + pad(SV[i].clock + 30) + " past each minute. ";
    if (i === B4) s += "It starts at 02:20:00 as b2's replacement and signs in with its first heartbeat, 30 seconds later. ";
    if (!sv.running) return s + "Right now it hasn't started.";
    if (!sv.alive) {
      s += "It lost its power at " + slotClock(sv.diedAt) + ", with no goodbye. The app servers send it " + rateText(share) + " lookups a second, and each waits 2 s for nothing. ";
    } else {
      s += "It's alive, sent " + rateText(share) + " lookups a second" + (share > CAP + EPS ? ", more than it answers" : "") + ". ";
    }
    if (sv.onRoll) {
      s += p - sv.lastHeard >= BEAT ? "It's on the Roll, but the Roll hasn't heard it since " + slotClock(sv.lastHeard) + "." :
        "It's on the Roll, last heard at " + slotClock(sv.lastHeard) + ".";
    } else if (sv.everIn) {
      s += "The Roll struck it off at " + slotClock(sv.struckAt) + "; " + listsWith(S, i) + " of the 3 app servers' lists still have it.";
    } else {
      s += "It hasn't signed in yet.";
    }
    return s;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s2e16", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.selfPres = false;
      S.every = 300;
      S.retry = false;
      api.speed = 10;
      S.load = zeros(SV.length);
      S.rload = zeros(SV.length);
      S.room = zeros(SV.length);
      S.ff = zeros(SV.length);
      S.acc = zeros(SV.length);

      S.ctl = {};
      S.ctl.selfpres = api.control.toggle("selfpres", "Self-preservation: under 85% of heartbeats, strike nobody off", false, function (on) { setSelfPres(api, on); });
      S.ctl.fetch = api.control.select("fetch", "App servers fetch the list", FETCH_OPTS, "300", function (v) { setFetch(api, v); });
      S.ctl.retry = api.control.toggle("retry", "Retry a failed lookup once on another server (never a booking)", false, function (on) { setRetry(api, on); });
      S.ctl.plug = api.control.button("plug", "Pull the plug on the next server due to call in", function () { pullPlug(api); }, { tone: "danger" });
      S.ctl.speed = api.control.select("speed", "Clock speed", SPEED_OPTS, "10", function (v) { setSpeed(api, v); });
      S.ctl.skip = api.control.button("skip", "Skip to 03:29:50", function () { skip(api); });
      S.ctl.replay = api.control.button("replay", "Replay the night from 02:13:50", function () { replay(api, "Back to 02:13:50."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        dead: api.stat("dead", "lookups sent to a dead server", "bad"),
        failed: api.stat("failed", "lookups failed", "bad"),
        err: api.stat("err", "failing now, % of lookups", "warn"),
        struck: api.stat("struck", "last to die: struck off after, s", ""),
        dropped: api.stat("dropped", "last to die: off every list after, s", ""),
        wrong: api.stat("wrong", "healthy servers wrongly struck off", "bad")
      };

      api.onNodeClick(function (id) {
        var S2 = api.state;
        if (id === "roll") { api.info(rollInfo(S2)); return; }
        if (id === "app1" || id === "app2" || id === "app3") { api.info(appInfo(S2, Number(id.charAt(3)) - 1)); return; }
        for (var i = 0; i < SV.length; i++) if (SV[i].id === id) { api.info(serverInfo(S2, i)); return; }
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api, "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return t.stat(id); }
      function has(s) { return t.logText().indexOf(s) >= 0; }
      // At 1 minute a second each test tick is exactly one slot, so go(k) runs k slots.
      function go(k) { return t.run(k / 60); }

      // 1. Tuesday as it happened: fetch every 5 minutes, no retries, no self-preservation.
      t.set("speed", "60");
      await go(20);                                     // slots 0-19: up to 02:14:09
      t.expect(t.node("b2").state === "bad" && t.node("b2").text.sub === "10/s" && n("dead") === 100 && n("failed") === 100 &&
        n("err") === 11.1 && n("struck") === "not yet",
        "Tuesday: b2 loses its power at 02:14:00 and keeps getting 10 lookups a second, every one a failure");
      await go(70);                                     // slots 20-89
      t.expect(n("struck") === 75 && n("dropped") === "not yet" && t.node("b2").text.meta === "struck" &&
        has("02:15:15 b2 struck off: nothing heard for 90 s, since 02:13:45."),
        "Tuesday: the Roll strikes b2 off at 02:15:15, 90 s after its last heartbeat and 75 s after it died");
      await go(290);                                    // slots 90-379
      t.expect(n("dead") === "2,600" && n("failed") === "2,600" && n("dropped") === 360 &&
        has("02:20:00 b2 is off every app server's list now. 2,600 lookups were sent to it, and it answered none."),
        "Tuesday: the app servers hold b2 until 02:20:00, 360 s after it died: 2,600 sent, 2,600 failed");
      await go(300);                                    // slots 380-679
      t.expect(has("02:20:30 b4 signs in with its first heartbeat.") && has("02:21:40 b4 gets its first lookups") &&
        has("02:25:00 b4 has its full share") && t.node("b4").text.sub === "10/s",
        "Tuesday: b4 signs in at 02:20:30 but gets lookups only as each app server fetches: the first at 02:21:40, its full share at 02:25:00");

      // 2. Fetch every 30 seconds.
      t.set("fetch", "30");                             // replays from 02:13:50; the speed stays
      await go(120);                                    // slots 0-119
      t.expect(n("dead") === 900 && n("failed") === 900 && n("struck") === 75 && n("dropped") === 100 &&
        has("02:15:40 b2 is off every app server's list now. 900 lookups were sent to it"),
        "30-second fetch: b2 is off every list by 02:15:40, 100 s after it died, and 900 lookups go to it");

      // 3. And retry once on another server.
      t.click("retry");
      await go(120);
      t.expect(n("dead") === 900 && n("failed") === 90 &&
        has("900 lookups were sent to it, and it answered none. 810 were retried on another server and answered."),
        "30-second fetch and retries: of b2's 900 lookups, 810 are answered elsewhere and the 90 bookings fail");
      await go(310);                                    // slots 120-429
      t.expect(has("02:20:30 b4 signs in with its first heartbeat.") && has("02:20:30 b4 gets its first lookups") &&
        has("02:20:50 b4 has its full share") && t.node("b4").text.sub === "10/s" && n("failed") === 90,
        "30-second fetch: b4 signs in at 02:20:30 and has its full share by 02:20:50");

      // 4. Retries with Struan's 5 minutes.
      t.set("fetch", "300");
      await go(380);
      t.expect(n("dead") === "2,600" && n("failed") === 260,
        "Retries with the 5-minute fetch: 2,600 lookups still go to b2, and 260 fail");

      // 5. Fetch every 30 minutes.
      t.click("reset");
      t.set("speed", "60");
      t.set("fetch", "1800");
      await go(1590);                                   // slots 0-1589: up to 02:40:19
      t.expect(n("dead") === "9,600" && n("failed") === "9,600" && n("dropped") === 1560 &&
        has("02:40:00 b2 is off every app server's list now. 9,600 lookups were sent to it") && has("02:30:00 b4 gets its first lookups: app-1"),
        "30-minute fetch: app-2 keeps b2 until 02:40:00, 9,600 lookups over 26 minutes, and b4's first lookups come at 02:30:00");
      await go(600);                                    // slots 1590-2189
      t.expect(has("02:50:00 b4 has its full share"), "30-minute fetch: b4 has its full share only at 02:50:00");
      t.click("skip");
      await go(600);                                    // slots 4560-5159
      t.expect(n("wrong") === 3 && n("failed") === 0 && has("03:31:00 b4 struck off") &&
        has("Every server is back on the Roll, and no app server fetched the list while any was off it. Nothing failed since 03:30:00."),
        "30-minute fetch: the Roll strikes off b4, b1 and b3, but no app server fetches before they sign back in: nothing fails");

      // 6. Tuesday's network fault.
      t.click("reset");
      t.set("speed", "60");
      t.click("skip");
      await go(90);                                     // slots 4560-4649
      t.expect(n("wrong") === 3 && n("failed") === 0 &&
        has("03:31:00 b4 struck off: nothing heard for 90 s, since 03:29:30. It's alive and still answering.") &&
        has("03:31:12 b1 struck off: nothing heard for 90 s") && has("03:31:18 b3 struck off: nothing heard for 90 s"),
        "Tuesday's fault: the Roll strikes off b4, b1 and b3 at 03:31:00, 03:31:12 and 03:31:18, all alive");
      await go(230);                                    // slots 4650-4879
      t.expect(n("err") === 20 && t.node("a1").text.sub === "15/s" && t.node("a1").state === "warn" &&
        t.node("app3").text.sub === "list of 6, every 5 min",
        "Tuesday's fault: from 03:35:00 six servers get 15 lookups a second each against the 12 they answer, and 1 lookup in 5 fails");
      await go(500);                                    // slots 4880-5379
      t.expect(n("failed") === "7,000" &&
        has("03:43:20 Every app server's list is whole again. 7,000 lookups failed since 03:30:00"),
        "Tuesday's fault: every list is whole again at 03:43:20, after 7,000 failures");

      // 7. Friday: self-preservation, a 30-second fetch and retries (the explain diagram).
      t.click("reset");
      t.set("speed", "60");
      t.set("fetch", "30");
      t.click("retry");
      t.click("selfpres");
      t.click("skip");
      await go(89);                                     // slots 4560-4648: up to 03:31:18
      t.expect(has("03:30:18 The Roll heard 15 of the 18 heartbeats it expects in the last minute, under 85%.") &&
        t.node("roll").text.sub === "9 on the roll, heard 12/18" && t.node("roll").text.meta === "self-preservation: holding" &&
        t.node("app1").text.sub === "list of 9, every 30 s" && t.node("app1").text.meta === "retry once elsewhere" &&
        t.node("b4").text.meta === "no beat" && t.node("b1").text.meta === "no beat" && t.node("a1").text.sub === "10/s" &&
        t.node("b4").text.sub === "10/s" && n("wrong") === 0,
        "Friday at 03:31:18: the Roll heard 15 of 18 at 03:30:18 and holds; every app server still lists all nine at 10 a second each");
      await go(600);                                    // slots 4649-5248
      t.expect(n("failed") === 0 && n("wrong") === 0 &&
        has("03:39:30 The Roll hears 16 of the 18 heartbeats it expects again, and self-preservation lets go.") &&
        has("Every server stayed on the Roll and on every list. Nothing failed since 03:30:00."),
        "Friday: self-preservation lets go at 03:39:30, having struck nobody off, and nothing failed");

      // 8. A 30-second fetch and retries, without self-preservation.
      t.click("reset");
      t.set("speed", "60");
      t.set("fetch", "30");
      t.click("retry");
      t.click("skip");
      await go(120);                                    // slots 4560-4679
      t.expect(n("err") === 20 && n("wrong") === 3 && t.node("app1").text.sub === "list of 6, every 30 s",
        "30-second fetch and retries: from 03:31:40 every app server lists six servers, and 1 lookup in 5 fails despite the retries");
      await go(480);                                    // slots 4680-5159
      t.expect(n("failed") === "8,259" &&
        has("03:39:40 Every app server's list is whole again. 8,259 lookups failed since 03:30:00, the last at 03:39:19."),
        "30-second fetch and retries: 8,259 failures in the fault, more than Tuesday's 7,000, the last at 03:39:19");

      // 9. Self-preservation alone.
      t.click("reset");
      t.set("speed", "60");
      t.click("selfpres");
      await go(380);
      t.expect(n("dead") === "2,600" && n("failed") === "2,600" && n("struck") === 75 && n("dropped") === 360 &&
        t.node("roll").text.meta === "self-preservation: on",
        "Self-preservation alone: one silent server of nine is no network fault, so b2 goes as on Tuesday, 2,600 failed");
      t.click("skip");
      await go(600);
      t.expect(n("failed") === 0 && n("wrong") === 0, "Self-preservation alone: nothing fails in zone B's nine minutes");

      // 10. Two real deaths within half a minute, with self-preservation on.
      t.click("reset");
      t.set("speed", "60");
      t.click("selfpres");
      await go(432);                                    // slots 0-431: up to 02:21:01
      t.click("plug");                                  // a1, due at 02:21:03
      await go(10);
      t.click("plug");                                  // b1, due at 02:21:12
      await go(100);                                    // slots 442-541
      t.expect(has("02:21:02 Plug pulled: a1, the next server due to call in, loses its power with no goodbye.") &&
        has("02:21:33 The Roll heard 15 of the 18 heartbeats it expects in the last minute, under 85%.") &&
        t.node("roll").text.sub === "9 on the roll, heard 14/18" && t.node("roll").text.meta === "self-preservation: holding" &&
        t.node("a1").state === "bad" && t.node("a1").text.meta === "no beat" && t.node("b1").text.meta === "no beat" &&
        n("struck") === "held",
        "Two deaths within half a minute: the Roll hears 15 of 18 at 02:21:33 and holds, keeping both dead servers listed");

      // 11. One death, without self-preservation.
      t.click("reset");
      t.set("speed", "60");
      await go(432);
      t.click("plug");
      await go(100);                                    // slots 432-531
      t.expect(n("struck") === 61 && has("02:22:03 a1 struck off: nothing heard for 90 s, since 02:20:33."),
        "One death: a1, pulled just before its heartbeat, is struck off 61 s after it died");
    }
  });
})();
