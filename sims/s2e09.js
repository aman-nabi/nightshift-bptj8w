/* sims/s2e09-v1.0.0.js  (published as sims/s2e09.js)
   Case s2e09 "The Front Desk": a reverse proxy and API gateway that Sigrun calls the Porter, in
   the basement of the Kittiwake, a seaside hotel in Wrackmouth. Every request from the guests'
   phones goes through it: TLS ends there, it checks the guest pass, it limits each phone to 10
   requests a second, and it reads the path to send each request to /doors, /bookings or /dining.
   Its list of door servers is a file (a static list) or a registry (service discovery), with or
   without health checks. A second hotel, the Lodge at Tarnside, has its own Porter; DNS sends
   each phone to the nearer one, and a TTL decides how long phones keep that answer.

   CHANGELOG
   v1.0.0 (2026-10-09) first version: Saturday night at the Kittiwake from 01:11:50, in slots of
     one sim second. Settings (changing one replays the night): service discovery (a registry
     instead of Sigrun's file), health checks (every 5 s, out after 2 misses, back after 2
     answers), the DNS TTL on each hotel's record (1 hour or 60 seconds), and the rate limit (10
     requests a second per phone). Events (no replay): the Lodge goes dark, and a stuck tablet
     sends 300 requests a second to /bookings. Also: clock speed (10 s, 1 min or 10 min a
     second), skip to 02:39:50, replay, reset. Stats: requests sent to a dead door server so far,
     errors a second and latency for coast and hills phones, how long the Lodge's failover took,
     and requests turned away by the rate limit each second. selfTest: 15 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e09-v1.0.0.json):
   - post: the Porter holds the certificate, checks the guest pass, numbers and logs every request,
     and lets no phone through more than 10 times a second (since January, when a stuck tablet
     asked for its booking 300 times a second; each server answers about 20 a second). About 24
     requests a second at night: 12 for /doors, 6 each for /bookings and /dining. door-1 and
     door-2 in the basement, door-3 in the Seaward Wing's linen room, door-4 up in the basement
     since 14 September but not in Sigrun's file. The electricians cut the Seaward Wing's power
     from 01:12 to 02:40 on Saturday. A request to door-3 waits 10 s and gets a 504. The log:
     door-1, door-2 and door-3 at 4 a second each; at 02:40:00 door-3 had been sent 21,120 since
     01:12 (4 a second for 88 minutes, 5,280 s) and answered none; door-4 had received 0.
   - comments: health checks every 5 seconds, out after 2 misses in a row, back after 2 answers
     (u/pulse_check_ulrike); a registry that servers sign in and out of, which keeps a server that
     lost its power (u/sign_in_book_nkechi); August at the Lodge (OP's reply to u/grey_pager):
     the power failed at 23:10, DNS checks each Porter every 30 seconds and stops handing out an
     address after three misses in a row, so it answered Wrackmouth from 23:11; the Lodge's TTL
     is an hour, so phones kept going to the Lodge until 00:11; about 12 requests a second come
     from the hills at night; those phones reach the Lodge in about 20 ms and Wrackmouth in about
     30. u/zone_file_wystan: 60 seconds as the short TTL.
   - reply options, each one a combination of this sim's settings, replaying Tuesday's night test
     (the same cut, 01:12:00 to 02:40:00) and a Lodge outage in November at 23:40:00:
     index 0 (60-second TTL only): 21,120 sent to door-3 again, door-4 still 0; the Lodge moved
     by 23:42:00. Index 1 (health checks on the file): door-3 out at 01:12:05 after 20 requests,
     door-1 and door-2 at 6 a second, door-4 still 0, door-3 back at 02:40:05; the Lodge took until
     00:41:00. Index 2 (registry, no checks): door-4 at 3 a second from the start, door-3 kept on
     the list, 15,840 sent to it by 02:40; the tablet on Thursday: 290 a second turned away; the
     Lodge until 00:41:00. Index 3 (registry fed by checks, 60-second TTL): door-3 out at 01:12:05
     after 15 requests, door-1, door-2 and door-4 at 4 a second, back at 02:40:05; the Lodge
     marked down at 23:41:00 and every phone moved by 23:42:00.

   Teaching model (stated in sim.lede):
   - Slot n is one sim second; slot 0 is 01:11:50, slot 10 is 01:12:00 (the cut), slot 5290 is
     02:40:00 (the power comes back). Each frame processes every slot that is due, so results never
     depend on the frame rate. Rates are steady flows, so no api.rand() is needed.
   - /doors requests are spread evenly over the door servers in rotation (round robin). A server
     sent more than 20 a second falls behind and every request to it fails; a dead server answers
     nothing. Requests sent to a dead server count when they are sent, not 10 s later.
   - Static list: door-1, door-2, door-3. Discovery: door-1 to door-4 (door-3 never signs out:
     it lost its power). Health checks run at slots where n % 5 == 0 (the clock's :00, :05 and so
     on), before that slot's requests: 2 misses in a row and a server is out from that slot, 2
     answers in a row and it is back. They only ask whether a server answers, so a busy server
     still passes. Cut at slot 10: misses at 10 and 15, out from slot 15 (01:12:05). Sent to it:
     5 slots x 4 = 20 (file) or 5 x 3 = 15 (registry). Back: answers at 5290 and 5295, in from 5295.
   - Without checks: file, 4 a second x 5,280 s = 21,120 by 02:40:00; registry, 3 x 5,280 = 15,840.
   - DNS checks each Porter at slots where n % 30 == 10 (the clock's :00 and :30). The Lodge goes
     dark from slot L (the next slot after the click). After 3 missed checks, at slot T, DNS
     answers Wrackmouth. Resolvers asked at an even pace over the last TTL, so from T the share of
     hills phones still holding the Lodge's address is max(0, 1 - (n - T) / TTL), and the last one
     moves at T + TTL. Failover time = T + TTL - L. Dark on a check slot (L % 30 == 10): T = L + 60,
     so 60 + 3,600 = 3,660 s (61 min 0 s) with the 1-hour TTL and 60 + 60 = 120 s (2 min 0 s) with
     60 seconds, the difference being the difference in TTL. August: 23:10:00 dark, 23:11:00
     marked down, 00:11:00 the last phone.
   - Hills phones send 12 a second with the coast's mix (6 doors, 3 bookings, 3 dining). Those
     still holding the Lodge's address while it is dark fail. Those that moved go through the
     Porter at Wrackmouth like coast phones (their doors share door-3's fate too).
   - The stuck tablet sends 300 a second to /bookings. With the rate limit, 10 pass and 290 are
     turned away (429); /bookings gets 6 + 10 = 16 a second, 5.3 per server. Without it, 306 a
     second, 102 per server, past 20: every /bookings request fails, the guests' 6 a second too.
   - Errors and latency count guests' requests, not the tablet's. Latency counts answered requests
     only: 20 ms to the nearer hotel, 30 ms to the other.
   - selfTest timings assume the harness's TEST_STEP of 1/60 s: at 10 sim seconds a real second,
     t.run(1) after the skip advances exactly 10 slots, so the Lodge goes dark on slot 5290
     (02:40:00, a DNS check slot) and the tests can assert "61 min 0 s" and "2 min 0 s" exactly
     instead of a range (60 + TTL up to 89 + TTL for a click between checks).

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Rows: phones and DNS at y 45 (h 62, bottom 76); registry, Porter and Lodge at y 175 (h 72,
     top 139, bottom 211; 63px gap); servers at y 315 (h 62, top 284; 73px gap). The Porter's
     edges to the servers bend at y 250, so none crosses another box.
   - DNS (170 wide): meta "Lodge marked down" 17 chars, 112px. Coast phones (220): sub
     "24/s + tablet 300/s" 19 chars, 137px. Hills phones (180): sub "Lodge 52%, here 48%" 19 chars,
     137px. Registry (160): meta "Sigrun's file instead" 21 chars, 139px. Porter (300): label
     "The Porter, Wrackmouth" 22 chars, 172px; sub "TLS ends, pass, 10/s cap, path" 30 chars,
     216px. Lodge (180): label 19 chars, 148px; meta "dark since 01:12:30" 19 chars, 125px.
     Servers (108): sub "not listed" 10 chars, 72px; meta "lost 21,120" 11 chars, 73px;
     "overloaded" 10 chars, 66px.
   - Edge labels: "answer" (40px) in the 65px gap between DNS and the coast phones; "20 ms" on the two
     vertical edges near y 100; "30 ms" near (507, 99) on the hills-to-Porter edge.

   Catalog note: the case's concepts are the catalog's ids for s2e09 (reverse-proxies,
   api-gateways, tls-termination, service-discovery).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 1 * 3600 + 11 * 60 + 50;   // 01:11:50 on Saturday
  var CUT = 10;                                 // 01:12:00: the Seaward Wing's power goes off
  var BACK = 5290;                              // 02:40:00: it comes back
  var SKIP_TO = 5280;                           // 02:39:50
  var COAST = { doors: 12, bookings: 6, dining: 6 };   // a second, phones on the coast
  var HILLS = { doors: 6, bookings: 3, dining: 3 };    // a second, phones in the hills (12)
  var SERVER_CAP = 20;                          // requests a second one server answers
  var SERVICE_SERVERS = 3;                      // /bookings and /dining run on three each
  var RATE_LIMIT = 10;                          // requests a second per phone
  var FLOOD = 300;                              // the stuck tablet
  var CHECK_EVERY = 5;                          // health checks: every 5 s
  var MISSES_OUT = 2;                           // out after 2 misses in a row
  var PASSES_IN = 2;                            // back after 2 answers in a row
  var DNS_EVERY = 30;                           // DNS checks each Porter every 30 s
  var DNS_PHASE = 10;                           // on the clock's :00 and :30 (slot 10 is 01:12:00)
  var DNS_MISSES = 3;                           // three misses and the address is dropped
  var NEAR_MS = 20;                             // a phone to its nearer hotel
  var FAR_MS = 30;                              // a phone to the other hotel
  var EPS = 1e-6;
  var DOT_EVERY = 0.25;                         // real seconds between sample dots
  var DOT_SPEED = 300;
  var VIA_Y = 250;                              // where the Porter's edges bend

  var DOOR_NAMES = ["door-1", "door-2", "door-3", "door-4"];
  var DOOR_IDS = ["door1", "door2", "door3", "door4"];
  var DOOR_X = [70, 190, 310, 430];
  var SEAWARD = 2;                              // door-3, in the Seaward Wing's linen room
  var NEWEST = 3;                               // door-4, up since 14 September

  var TTL_OPTS = [
    { value: "3600", label: "1 hour (as in August)" },
    { value: "60", label: "60 seconds" }
  ];
  var SPEED_OPTS = [
    { value: "10", label: "10 s a second" },
    { value: "60", label: "1 minute a second" },
    { value: "600", label: "10 minutes a second" }
  ];

  /* ---------- small helpers ---------- */

  // 21120 -> "21,120". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 4 -> "4", 5.333 -> "5.3", 0 -> "0".
  function rateText(v) {
    if (!(v >= 0.05)) return "0";
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Slot n as a clock time: slot 10 -> "01:12:00".
  function slotClock(n) {
    var s = (START_CLOCK + n) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  // 3660 -> "61 min 0 s", 45 -> "45 s".
  function minSec(sec) {
    sec = Math.round(sec);
    if (sec < 60) return sec + " s";
    return Math.floor(sec / 60) + " min " + (sec % 60) + " s";
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function say(api, msg, tone) { if (!api.state.quiet) api.log(msg, tone || ""); }

  function ttlName(S) { return S.ttl === 60 ? "60 seconds" : "an hour"; }

  /* ---------- the diagram ---------- */

  function serverEdge(to, x) { return { from: "porter", to: to, via: [[x, VIA_Y]] }; }

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "Front desk sim for the Kittiwake hotels. DNS answers each phone with the nearer hotel's Porter. Phones on the coast send 24 requests a second to the Porter at Wrackmouth, about 20 ms away. Phones in the hills send 12 a second to the Lodge at Tarnside, 20 ms away, or to Wrackmouth, 30 ms away, if DNS moves them. The Porter ends TLS, checks the guest pass, limits each phone to 10 requests a second and sends each request by its path to the door servers, door-1 to door-4, or to the /bookings and /dining servers, three each. Its list of door servers comes from Sigrun's file or from a registry, with or without health checks.",
    nodes: [
      { id: "dns", label: "DNS", sub: "nearest Porter", meta: "TTL 1 hour", x: 110, y: 45, w: 170, h: 62, shape: "cloud", tone: "" },
      { id: "coast", label: "Coast phones", sub: "24 requests/s", meta: "errors 0/s", x: 370, y: 45, w: 220, h: 62, shape: "box", tone: "" },
      { id: "hills", label: "Hills phones", sub: "12/s to the Lodge", meta: "errors 0/s", x: 635, y: 45, w: 180, h: 62, shape: "box", tone: "" },
      { id: "registry", label: "Registry", sub: "not used", meta: "Sigrun's file instead", x: 110, y: 175, w: 160, h: 72, shape: "box", tone: "muted" },
      { id: "porter", label: "The Porter, Wrackmouth", sub: "TLS ends, pass, 10/s cap, path", meta: "list: Sigrun's file", x: 370, y: 175, w: 300, h: 72, shape: "box", tone: "accent" },
      { id: "lodge", label: "The Lodge, Tarnside", sub: "own Porter, servers", meta: "up, 20 ms away", x: 635, y: 175, w: 180, h: 72, shape: "box", tone: "ok" },
      { id: "door1", label: "door-1", sub: "4/s", meta: "basement", x: 70, y: 315, w: 108, h: 62, shape: "box", tone: "ok" },
      { id: "door2", label: "door-2", sub: "4/s", meta: "basement", x: 190, y: 315, w: 108, h: 62, shape: "box", tone: "ok" },
      { id: "door3", label: "door-3", sub: "4/s", meta: "Seaward Wing", x: 310, y: 315, w: 108, h: 62, shape: "box", tone: "ok" },
      { id: "door4", label: "door-4", sub: "not listed", meta: "received 0", x: 430, y: 315, w: 108, h: 62, shape: "box", tone: "muted" },
      { id: "book", label: "/bookings", sub: "2/s each", meta: "3 servers", x: 550, y: 315, w: 108, h: 62, shape: "box", tone: "ok" },
      { id: "dine", label: "/dining", sub: "2/s each", meta: "3 servers", x: 670, y: 315, w: 108, h: 62, shape: "box", tone: "ok" }
    ],
    edges: [
      { from: "dns", to: "coast", label: "answer", dash: true, tone: "muted" },
      { from: "coast", to: "porter", label: "20 ms" },
      { from: "hills", to: "lodge", label: "20 ms" },
      { from: "hills", to: "porter", label: "30 ms", dash: true, tone: "muted" },
      { from: "registry", to: "porter", dash: true, tone: "muted" },
      serverEdge("door1", DOOR_X[0]),
      serverEdge("door2", DOOR_X[1]),
      serverEdge("door3", DOOR_X[2]),
      serverEdge("door4", DOOR_X[3]),
      serverEdge("book", 550),
      serverEdge("dine", 670)
    ],
    notes: [
      { x: 20, y: 390, text: "Saturday night at the Kittiwake", tone: "muted", anchor: "start" }
    ]
  };

  /* ---------- the night's rules ---------- */

  function doorAlive(i, n) { return !(i === SEAWARD && n >= CUT && n < BACK); }

  // The servers the Porter could send /doors requests to, before health checks.
  function listed(S) { return S.disc ? [0, 1, 2, 3] : [0, 1, 2]; }

  function isListed(S, i) { return S.disc || i !== NEWEST; }

  function inRotation(S, i) { return isListed(S, i) && (!S.hc || S.doors[i].healthy); }

  function healthChecks(api, n) {
    var S = api.state;
    if (!S.hc || n % CHECK_EVERY !== 0) return;
    var list = listed(S);
    for (var k = 0; k < list.length; k++) {
      var i = list[k];
      var d = S.doors[i];
      if (doorAlive(i, n)) {
        d.miss = 0;
        d.pass += 1;
        if (!d.healthy && d.pass >= PASSES_IN) {
          d.healthy = true;
          say(api, slotClock(n) + ". " + DOOR_NAMES[i] + " has answered " + PASSES_IN + " checks in a row and is back in rotation.", "ok");
        }
      } else {
        d.pass = 0;
        d.miss += 1;
        if (d.healthy && d.miss >= MISSES_OUT) {
          d.healthy = false;
          d.outAt = n;
          var others = [];
          for (var j = 0; j < 4; j++) if (j !== i && inRotation(S, j)) others.push(DOOR_NAMES[j]);
          var each = others.length ? rateText(S.lastDoorLoad / others.length) : "0";
          say(api, slotClock(n) + ". " + DOOR_NAMES[i] + " missed the checks at " + slotClock(n - CHECK_EVERY) + " and " + slotClock(n) +
            " and is out of rotation from " + slotClock(n) + ", after " + fmt(d.lost) + " requests went to it. " +
            joinNames(others) + " now take " + each + " a second each." +
            (S.disc ? "" : " door-4 still isn't in the file, so it gets nothing."), "ok");
        }
      }
    }
  }

  function joinNames(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function dnsChecks(api, n) {
    var S = api.state;
    var L = S.lodge;
    if ((n - DNS_PHASE) % DNS_EVERY !== 0 || n < DNS_PHASE) return;
    if (!L.dark || L.T !== null) { L.misses = 0; return; }
    L.misses += 1;
    if (L.misses >= DNS_MISSES) {
      L.T = n;
      say(api, slotClock(n) + ". The Lodge has missed " + DNS_MISSES + " checks in a row, so DNS stops handing out its address and answers Wrackmouth instead, " +
        (n - L.L) + " s after the power went. Phones that asked before keep the Lodge's address for up to the TTL, " + ttlName(S) + ".", "warn");
    }
  }

  // Share of hills phones still holding the Lodge's address at slot n.
  function onLodge(S, n) {
    var L = S.lodge;
    if (!L.dark) return 1;
    if (L.T === null) return 1;
    return Math.max(0, 1 - (n - L.T) / S.ttl);
  }

  /* ---------- one slot ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;

    if (n === CUT) {
      say(api, "01:12:00. The electricians' night test cuts the Seaward Wing's power, and door-3 in its old linen room goes dark.", "bad");
    }
    if (n === BACK) {
      say(api, "02:40:00. The Seaward Wing's power comes back and door-3 answers again. Since 01:12:00 the Porter sent it " +
        fmt(S.doors[SEAWARD].lost) + " requests, and it answered none." +
        (S.hc ? " It has to answer " + PASSES_IN + " checks in a row before it gets any more." : ""), "ok");
    }

    healthChecks(api, n);
    dnsChecks(api, n);

    // Hills phones: on the Lodge, or moved to Wrackmouth.
    var share = onLodge(S, n);
    var lodgeDark = S.lodge.dark;
    var moved = lodgeDark ? 1 - share : 0;
    var hillsDeadSite = lodgeDark ? (HILLS.doors + HILLS.bookings + HILLS.dining) * share : 0;

    // /doors at Wrackmouth.
    var coastDoors = COAST.doors;
    var hillsDoors = HILLS.doors * moved;
    var doorLoad = coastDoors + hillsDoors;
    S.lastDoorLoad = doorLoad;
    var rot = [];
    for (var i = 0; i < 4; i++) if (inRotation(S, i)) rot.push(i);
    var each = rot.length ? doorLoad / rot.length : 0;
    var doorFail = rot.length ? 0 : doorLoad;
    var deadNow = 0;
    for (var d = 0; d < 4; d++) S.doors[d].rate = 0;
    for (var k = 0; k < rot.length; k++) {
      var idx = rot[k];
      var door = S.doors[idx];
      door.rate = each;
      door.recv += each;
      if (!doorAlive(idx, n)) {
        door.lost += each;
        deadNow += each;
        doorFail += each;
        if (!S.deadLogged) {
          S.deadLogged = true;
          say(api, "The Porter sends " + DOOR_NAMES[idx] + " its share, " + rateText(each) +
            " a second" + (S.hc ? ", until the health checks catch it" : "") +
            ". Each one waits 10 seconds for an answer, then the phone gets a 504." +
            (S.hc ? "" : (S.disc ? " The registry still lists door-3: it lost its power, so it never signed out." :
              " Sigrun's file says door-3 is there, and the Porter never asks.")), "bad");
        }
      } else if (each > SERVER_CAP) {
        doorFail += each;
      }
    }
    S.deadTotal += deadNow;

    // /bookings and /dining at Wrackmouth.
    var tabletSent = S.flood ? FLOOD : 0;
    var tabletPass = S.flood ? (S.rate ? RATE_LIMIT : FLOOD) : 0;
    var rejected = tabletSent - tabletPass;
    var bookLoad = COAST.bookings + HILLS.bookings * moved + tabletPass;
    var bookEach = bookLoad / SERVICE_SERVERS;
    var bookOver = bookEach > SERVER_CAP;
    var dineLoad = COAST.dining + HILLS.dining * moved;
    var dineEach = dineLoad / SERVICE_SERVERS;
    var dineOver = dineEach > SERVER_CAP;

    // Guests' errors, split by where the phones are.
    var coastShareDoors = doorLoad > 0 ? coastDoors / doorLoad : 0;
    var errC = doorFail * coastShareDoors + (bookOver ? COAST.bookings : 0) + (dineOver ? COAST.dining : 0);
    var errHmoved = doorFail * (1 - coastShareDoors) + (bookOver ? HILLS.bookings * moved : 0) + (dineOver ? HILLS.dining * moved : 0);
    var errH = hillsDeadSite + errHmoved;

    var coastTotal = COAST.doors + COAST.bookings + COAST.dining;
    var hillsTotal = HILLS.doors + HILLS.bookings + HILLS.dining;
    var answeredC = coastTotal - errC;
    var answeredHmoved = hillsTotal * moved - errHmoved;
    var answeredHlodge = lodgeDark ? 0 : hillsTotal;

    S.errC = errC;
    S.errH = errH;
    S.rej = rejected;
    S.share = share;
    S.moved = moved;
    S.bookEach = bookEach;
    S.bookOver = bookOver;
    S.dineEach = dineEach;
    S.latC = answeredC > EPS ? String(NEAR_MS) : "-";
    S.latH = answeredHlodge > EPS ? String(NEAR_MS) : (answeredHmoved > EPS ? String(FAR_MS) : "-");
    S.mix = { rot: rot, each: each, alive: rot.map(function (r) { return doorAlive(r, n); }), share: share,
      lodgeDark: lodgeDark, moved: moved, bookOver: bookOver, flood: S.flood };

    // The Lodge's failover finishes when the last phone has moved.
    if (lodgeDark && S.lodge.T !== null && S.lodge.done === null && share <= 0) {
      S.lodge.done = n - S.lodge.L;
      say(api, slotClock(n) + ". The last phone in the hills has moved to Wrackmouth, " + FAR_MS + " ms away. The failover took " +
        minSec(S.lodge.done) + ": " + (S.lodge.T - S.lodge.L) + " s for DNS to notice, plus the TTL, " + ttlName(S) + ".", "ok");
    }

    if (bookOver && !S.overLogged) {
      S.overLogged = true;
      say(api, "/bookings is getting " + fmt(bookLoad) + " requests a second, " + rateText(bookEach) +
        " for each server, and each answers 20. It falls over, and every guest's booking fails along with the tablet's.", "bad");
    }

    S.n = n + 1;
  }

  /* ---------- the night ---------- */

  function freshDoors() {
    var a = [];
    for (var i = 0; i < 4; i++) a.push({ healthy: true, miss: 0, pass: 0, lost: 0, recv: 0, rate: 0, outAt: null });
    return a;
  }

  function startNight(api, why) {
    var S = api.state;
    S.t = 0;
    S.n = 0;
    api.clock = START_CLOCK;
    S.doors = freshDoors();
    S.deadTotal = 0;
    S.lastDoorLoad = COAST.doors;
    S.lodge = { dark: false, L: null, misses: 0, T: null, done: null };
    S.flood = false;
    if (S.ctl && S.ctl.flood) S.ctl.flood.set(false);
    if (S.ctl && S.ctl.lodge) S.ctl.lodge.disable(false);
    S.errC = 0; S.errH = 0; S.rej = 0; S.share = 1; S.moved = 0;
    S.bookEach = COAST.bookings / SERVICE_SERVERS; S.bookOver = false; S.dineEach = COAST.dining / SERVICE_SERVERS;
    S.latC = String(NEAR_MS); S.latH = String(NEAR_MS);
    S.mix = null;
    S.quiet = false;
    S.deadLogged = false;
    S.overLogged = false;
    S.dotClock = 0;
    S.dotTurn = 0;
    var head = (why ? why + " " : "") + "01:11:50 on Saturday at the Kittiwake. Phones on the coast send the Porter 24 requests a second; phones in the hills send the Lodge 12. ";
    if (S.disc) {
      head += "The Porter reads the registry: door-1 to door-4 all signed themselves in, door-4 on 14 September, so each gets 3 a second.";
    } else {
      head += "The Porter reads Sigrun's file: door-1, door-2 and door-3, 4 a second each. door-4 is up in the basement, but it isn't in the file.";
    }
    head += S.hc ? " Health checks: every 5 s, out after 2 misses." : " No health checks.";
    say(api, head, "");
    draw(api);
  }

  function replay(api, what) { startNight(api, what + " The night replays."); }

  /* ---------- controls ---------- */

  function setDisc(api, on) {
    api.state.disc = !!on;
    replay(api, on ? "Discovery on: every server signs itself into a registry when it starts, and out when it shuts down cleanly. The Porter reads the registry." :
      "Discovery off: the Porter reads Sigrun's file again.");
  }

  function setHc(api, on) {
    api.state.hc = !!on;
    replay(api, on ? "Health checks on: every server on the list is asked every 5 seconds, out after 2 misses in a row, back after 2 answers." :
      "Health checks off: nobody asks the servers anything.");
  }

  function setTtl(api, v) {
    var o = pick(TTL_OPTS, v);
    if (!o) return;
    api.state.ttl = Number(o.value);
    replay(api, api.state.ttl === 60 ? "Each hotel's DNS record now has a TTL of 60 seconds." : "Each hotel's DNS record has a TTL of an hour again.");
  }

  function setRate(api, on) {
    api.state.rate = !!on;
    replay(api, on ? "Rate limit on: no phone gets through more than 10 times a second." : "Rate limit off: the Porter lets every request through.");
  }

  function setSpeed(api, v) {
    var o = pick(SPEED_OPTS, v);
    if (!o) return;
    api.speed = Number(o.value);
  }

  function lodgeDark(api) {
    var S = api.state;
    if (S.lodge.dark) return;
    S.lodge.dark = true;
    S.lodge.L = S.n;
    S.lodge.misses = 0;
    if (S.ctl.lodge) S.ctl.lodge.disable(true);
    say(api, slotClock(S.n) + ". The Lodge's power fails. Phones in the hills keep sending it 12 requests a second, and none is answered. DNS checks each Porter every 30 seconds, on the minute and the half-minute.", "bad");
    draw(api);
  }

  function setFlood(api, on) {
    var S = api.state;
    S.flood = !!on;
    if (on) {
      if (S.rate) say(api, "A stuck tablet starts sending 300 requests a second to /bookings. The Porter lets 10 a second through and turns 290 away with a 429.", "warn");
      else say(api, "A stuck tablet starts sending 300 requests a second to /bookings, and the Porter lets every one through.", "bad");
    } else {
      S.overLogged = false;
      say(api, "The tablet stops.", "");
    }
    draw(api);
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
    var d3 = S.doors[SEAWARD];
    say(api, "Skipped to 02:39:50. Since 01:12:00 the Porter has sent door-3 " + fmt(d3.lost) + " requests" +
      (d3.lost > 0 ? ", and it has answered none." : ".") + " door-4 has received " + fmt(S.doors[NEWEST].recv) + ".", "");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var n = Math.max(0, S.n - 1);

    var dns = api.node("dns");
    dns.text("sub", "nearest Porter");
    dns.text("meta", S.lodge.T !== null ? "Lodge marked down" : (S.ttl === 60 ? "TTL 60 s" : "TTL 1 hour"));
    dns.set(S.lodge.T !== null ? "warn" : "");

    var coast = api.node("coast");
    coast.text("sub", S.flood ? "24/s + tablet 300/s" : "24 requests/s");
    coast.text("meta", "errors " + rateText(S.errC) + "/s");
    coast.set(S.errC > EPS ? "bad" : "");

    var hills = api.node("hills");
    if (!S.lodge.dark) hills.text("sub", "12/s to the Lodge");
    else hills.text("sub", "Lodge " + Math.round(S.share * 100) + "%, here " + Math.round(S.moved * 100) + "%");
    hills.text("meta", "errors " + rateText(S.errH) + "/s");
    hills.set(S.errH > EPS ? "bad" : "");

    var reg = api.node("registry");
    if (!S.disc) {
      reg.text("sub", "not used");
      reg.text("meta", "Sigrun's file instead");
      reg.set("muted");
    } else {
      var inCount = 0;
      for (var i = 0; i < 4; i++) if (inRotation(S, i)) inCount++;
      reg.text("sub", S.hc ? inCount + " of 4 doors in" : "4 doors listed");
      reg.text("meta", S.hc ? "checks every 5 s" : "no health checks");
      reg.set(S.hc ? "ok" : "warn");
    }

    var porter = api.node("porter");
    porter.text("sub", S.rate ? "TLS ends, pass, 10/s cap, path" : "TLS ends, pass, no cap, path");
    porter.text("meta", S.disc ? "list: the registry" : (S.hc ? "list: the file, checked" : "list: Sigrun's file"));
    porter.set("accent");

    var lodge = api.node("lodge");
    lodge.text("meta", S.lodge.dark ? "dark since " + slotClock(S.lodge.L) : "up, 20 ms away");
    lodge.set(S.lodge.dark ? "bad" : "ok");

    for (var d = 0; d < 4; d++) {
      var nd = api.node(DOOR_IDS[d]);
      var door = S.doors[d];
      var alive = doorAlive(d, n);
      var rotNow = inRotation(S, d);
      if (!isListed(S, d)) {
        nd.text("sub", "not listed");
        nd.set("muted");
      } else if (!rotNow) {
        nd.text("sub", alive ? "rejoining" : "dark, out");
        nd.set("warn");
      } else if (!alive) {
        nd.text("sub", "no answer");
        nd.set("bad");
      } else {
        nd.text("sub", rateText(door.rate) + "/s");
        nd.set(door.rate > SERVER_CAP ? "bad" : "ok");
      }
      if (d === SEAWARD) nd.text("meta", door.lost > 0 ? "lost " + fmt(door.lost) : "Seaward Wing");
      else if (d === NEWEST) nd.text("meta", S.disc ? "since 14 Sep" : "received " + fmt(door.recv));
      else nd.text("meta", "basement");
      api.edge("porter", DOOR_IDS[d]).set(rotNow ? "" : "cut");
    }

    var book = api.node("book");
    book.text("sub", rateText(S.bookEach) + "/s each");
    book.text("meta", S.bookOver ? "overloaded" : "3 servers");
    book.set(S.bookOver ? "bad" : "ok");

    var dine = api.node("dine");
    dine.text("sub", rateText(S.dineEach) + "/s each");
    dine.text("meta", "3 servers");
    dine.set("ok");

    S.stat.dead(fmt(S.deadTotal));
    S.stat.errc(rateText(S.errC));
    S.stat.errh(rateText(S.errH));
    S.stat.latc(S.latC);
    S.stat.lath(S.latH);
    S.stat.fail(!S.lodge.dark ? "-" : (S.lodge.done === null ? "not yet" : minSec(S.lodge.done)));
    S.stat.rej(fmt(S.rej));

    S.ctl.skip.disable(S.n >= SKIP_TO);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || !S.mix) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    var mx = S.mix;
    var routes = [];
    var k;
    for (k = 0; k < mx.rot.length; k++) {
      var di = mx.rot[k];
      routes.push({ w: mx.each, from: "coast", to: DOOR_IDS[di], x: DOOR_X[di], ok: mx.alive[k] && mx.each <= SERVER_CAP });
    }
    routes.push({ w: COAST.bookings, from: "coast", to: "book", x: 550, ok: !mx.bookOver });
    routes.push({ w: COAST.dining, from: "coast", to: "dine", x: 670, ok: true });
    if (!mx.lodgeDark) routes.push({ w: 12, from: "hills", to: "lodge", ok: true });
    else {
      if (mx.share > 0) routes.push({ w: 12 * mx.share, from: "hills", to: "lodge", ok: false });
      if (mx.moved > 0) routes.push({ w: 12 * mx.moved, from: "hills", to: "dine", x: 670, ok: true });
    }
    if (mx.flood) routes.push({ w: 12, from: "coast", to: S.rate ? "porter" : "book", x: 550, ok: false, rejected: S.rate });
    var total = 0;
    for (k = 0; k < routes.length; k++) total += routes[k].w;
    if (!(total > 0)) return;
    S.dotTurn = (S.dotTurn + 0.6180339887) % 1;
    var target = S.dotTurn * total;
    var r = routes[routes.length - 1];
    var acc = 0;
    for (k = 0; k < routes.length; k++) { acc += routes[k].w; if (target < acc) { r = routes[k]; break; } }
    var path;
    if (r.to === "lodge") path = [r.from, "lodge"];
    else if (r.rejected) path = [r.from, "porter"];
    else path = [r.from, "porter", [r.x, VIA_Y], r.to];
    var end = r.to;
    var ok = r.ok;
    api.dot({ path: path, cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (dot, wp) { if (dot && wp === end) dot.cls(ok ? "dot-ok" : "dot-fail"); } });
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.doors) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t + EPS);
    var guard = 0;
    while (S.n < due && guard < 20000) { slot(api); guard += 1; }
    api.clock = START_CLOCK + S.t;
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    dns: function (S) {
      return "<strong>DNS.</strong> Answers each phone with the address of the nearer hotel's Porter (latency-based routing): about 20 ms to its own hotel, 30 to the other. It checks each Porter every 30 seconds, on the minute and the half-minute, and after three misses in a row stops handing out that address. Resolvers keep an answer for the TTL, now " + ttlName(S) + ", so a change reaches the last phone up to a TTL later.";
    },
    coast: function () {
      return "<strong>Coast phones.</strong> Guests' phones near Wrackmouth: 24 requests a second at night, 12 for /doors and 6 each for /bookings and /dining. They only ever see one address, the Porter's.";
    },
    hills: function () {
      return "<strong>Hills phones.</strong> Guests' phones near Tarnside, 300 miles inland: 12 requests a second with the same mix. Normally they go to the Lodge, 20 ms away. If DNS moves them, they come to Wrackmouth, 30 ms away.";
    },
    registry: function (S) {
      return "<strong>Registry.</strong> A list of servers that the servers keep themselves: each signs in when it starts and out when it shuts down cleanly. A server that loses its power can't sign out. " +
        (S.disc ? (S.hc ? "It's on, and it checks every server every 5 seconds: out after 2 misses, back after 2 answers." : "It's on, with no health checks.") : "It's off: the Porter reads Sigrun's file, written in April.");
    },
    porter: function (S) {
      return "<strong>The Porter.</strong> The reverse proxy and API gateway in the Kittiwake's basement. It holds the certificate, so TLS ends here; it checks the guest pass, numbers and logs every request, " +
        (S.rate ? "lets no phone through more than 10 times a second, " : "has no rate limit right now, ") +
        "and sends each request by its path to /doors, /bookings or /dining. It waits 10 seconds for a server, then answers the phone with a 504.";
    },
    lodge: function (S) {
      return "<strong>The Lodge, Tarnside.</strong> The sister hotel 300 miles inland, with its own Porter and servers. " +
        (S.lodge.dark ? "It's dark." : "Press The Lodge goes dark to cut its power.");
    },
    door1: function () { return doorInfo(0); },
    door2: function () { return doorInfo(1); },
    door3: function () { return doorInfo(2); },
    door4: function () { return doorInfo(3); },
    book: function () {
      return "<strong>/bookings.</strong> Three servers, each answering up to 20 requests a second. Past that a server falls behind and every request to it fails.";
    },
    dine: function () {
      return "<strong>/dining.</strong> Room service orders. Three servers, each answering up to 20 requests a second.";
    }
  };

  function doorInfo(i) {
    var where = [
      "In the basement.",
      "In the basement.",
      "In the Seaward Wing's old linen room. The electricians cut the wing's power from 01:12:00 to 02:40:00.",
      "In the basement, up since 14 September, set up to replace door-3. It isn't in Sigrun's file."
    ][i];
    return "<strong>" + DOOR_NAMES[i] + ".</strong> A door server: it answers the phones' requests to open doors, up to 20 a second. " + where;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s2e09", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.disc = false;
      S.hc = false;
      S.ttl = 3600;
      S.rate = true;
      api.speed = 10;

      S.ctl = {};
      S.ctl.disc = api.control.toggle("disc", "Service discovery: a registry, not Sigrun's file", false, function (on) { setDisc(api, on); });
      S.ctl.hc = api.control.toggle("hc", "Health checks: every 5 s, out after 2 misses", false, function (on) { setHc(api, on); });
      S.ctl.ttl = api.control.select("ttl", "DNS TTL on each hotel's record", TTL_OPTS, "3600", function (v) { setTtl(api, v); });
      S.ctl.rate = api.control.toggle("rate", "Rate limit: 10 requests a second per phone", true, function (on) { setRate(api, on); });
      S.ctl.lodge = api.control.button("lodge", "The Lodge goes dark", function () { lodgeDark(api); }, { tone: "danger" });
      S.ctl.flood = api.control.toggle("flood", "A stuck tablet sends 300 a second to /bookings", false, function (on) { setFlood(api, on); });
      S.ctl.speed = api.control.select("speed", "Clock speed", SPEED_OPTS, "10", function (v) { setSpeed(api, v); });
      S.ctl.skip = api.control.button("skip", "Skip to 02:39:50", function () { skip(api); });
      S.ctl.replay = api.control.button("replay", "Replay the night from 01:11:50", function () { replay(api, "Back to 01:11:50."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        dead: api.stat("dead", "requests sent to a dead door server so far", "bad"),
        errc: api.stat("errc", "coast phones: errors a second", "bad"),
        errh: api.stat("errh", "hills phones: errors a second", "bad"),
        latc: api.stat("latc", "coast phones: latency, ms (answered)", ""),
        lath: api.stat("lath", "hills phones: latency, ms (answered)", ""),
        fail: api.stat("fail", "the Lodge's failover took", "warn"),
        rej: api.stat("rej", "turned away by the rate limit, a second", "ok")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api, "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return t.stat(id); }

      // 1. Saturday as it happened: Sigrun's file, no health checks.
      await t.run(2);                                   // slots 0-19: up to 01:12:09
      t.expect(n("dead") === 40 && n("errc") === 4 && t.node("door3").state === "bad" && t.node("door3").text.sub === "no answer" &&
        t.node("door1").text.sub === "4/s" && t.node("door4").text.sub === "not listed",
        "Saturday: from 01:12:00 door-3 is dark and still gets a third of /doors, 4 a second, while door-4 isn't listed");
      t.click("skip");                                  // slots 20-5279 quietly
      await t.run(1);                                   // slots 5280-5289: up to 02:39:59
      t.expect(n("dead") === "21,120" && t.node("door3").text.meta === "lost 21,120" && t.node("door4").text.meta === "received 0",
        "Saturday: by 02:40:00 the Porter has sent door-3 21,120 requests, and door-4 has received 0");
      await t.run(0.2);                                 // slots 5290-5291
      t.expect(n("errc") === 0 && t.logText().indexOf("Since 01:12:00 the Porter sent it 21,120 requests, and it answered none") >= 0,
        "Saturday: at 02:40:00 the power comes back, and the log matches the post's line");

      // 2. Health checks on the file.
      t.click("reset");
      t.click("hc");
      await t.run(2);                                   // slots 0-19
      t.expect(n("dead") === 20 && n("errc") === 0 && t.node("door1").text.sub === "6/s" && t.node("door3").text.sub === "dark, out" &&
        t.node("door4").text.sub === "not listed" && t.logText().indexOf("is out of rotation from 01:12:05, after 20 requests") >= 0,
        "Health checks: door-3 is out at 01:12:05 after 20 requests, door-1 and door-2 take 6 a second, door-4 still gets nothing");
      t.click("skip");
      await t.run(1.2);                                 // slots 5280-5291
      t.expect(n("dead") === 20 && t.node("door3").text.sub === "rejoining", "Health checks: door-3 has to answer twice before it rejoins");
      await t.run(0.5);                                 // slots 5292-5296
      t.expect(t.node("door3").text.sub === "4/s", "Health checks: door-3 is back in rotation from 02:40:05");

      // 3. A registry without health checks.
      t.click("reset");
      t.click("disc");
      await t.run(2);
      t.expect(n("dead") === 30 && n("errc") === 3 && t.node("door4").text.sub === "3/s" && t.node("registry").text.sub === "4 doors listed",
        "Registry, no checks: door-4 takes its share, but door-3 never signed out and still gets 3 a second");
      t.click("skip");
      await t.run(1);
      t.expect(n("dead") === "15,840", "Registry, no checks: 15,840 requests to door-3 by 02:40:00");

      // 4. A registry fed by health checks.
      t.click("reset");
      t.click("disc");
      t.click("hc");
      await t.run(2);
      t.expect(n("dead") === 15 && n("errc") === 0 && t.node("door4").text.sub === "4/s" && t.node("door1").text.sub === "4/s" &&
        t.node("registry").text.sub === "3 of 4 doors in",
        "Registry with checks: door-3 out at 01:12:05 after 15 requests, then door-1, door-2 and door-4 at 4 a second");

      // 5. The Lodge goes dark with a 1-hour TTL.
      t.click("reset");
      t.click("skip");
      await t.run(1);                                   // slot 5290 is next: 02:40:00
      t.click("lodge");
      await t.run(1);                                   // slots 5290-5299
      t.expect(n("errh") === 12 && n("lath") === "-" && n("fail") === "not yet" && t.node("lodge").state === "bad",
        "1-hour TTL: every hills phone still goes to the dark Lodge, 12 errors a second");
      t.set("speed", "600");
      await t.run(6.5);                                 // past slot 8950 (03:41:00)
      t.expect(n("fail") === "61 min 0 s" && n("errh") === 0 && n("lath") === 30 && t.node("dns").text.meta === "Lodge marked down" &&
        t.logText().indexOf("60 s for DNS to notice, plus the TTL, an hour") >= 0,
        "1-hour TTL: DNS notices in 60 s, but the last hills phone moves 61 min 0 s after the Lodge went dark, 30 ms away");

      // 6. The same with a 60-second TTL.
      t.click("reset");
      t.set("ttl", "60");
      t.click("skip");
      await t.run(1);
      t.click("lodge");
      await t.run(13);                                  // slots 5290-5419
      t.expect(n("fail") === "2 min 0 s" && n("errh") === 0 && n("lath") === 30,
        "60-second TTL: the same outage moves every phone in 2 min 0 s, 59 minutes sooner: the difference in TTL");

      // 7. A stuck tablet, with the rate limit.
      t.click("reset");
      await t.run(2);
      t.click("flood");
      await t.run(1);
      t.expect(n("rej") === 290 && t.node("book").state === "ok" && t.node("book").text.sub === "5.3/s each" && n("errc") === 4,
        "Rate limit: 290 of the tablet's 300 a second turned away, /bookings at 5.3 a second per server");

      // 8. The same tablet, with no rate limit.
      t.click("reset");
      t.click("rate");
      await t.run(2);
      t.click("flood");
      await t.run(1);
      t.expect(n("rej") === 0 && t.node("book").state === "bad" && t.node("book").text.meta === "overloaded" && n("errc") === 10,
        "No rate limit: 306 a second reach /bookings, it falls over, and every guest's booking fails: 6 more errors a second");
      t.expect(t.logText().indexOf("It falls over, and every guest's booking fails") >= 0, "No rate limit: the log says why");
    }
  });
})();
