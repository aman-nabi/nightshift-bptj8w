/* sims/s2e07-v1.0.0.js  (published as sims/s2e07.js)
   Case s2e07 "Mirrors Everywhere": a CDN in front of The Gloaming's fan site. Four edge servers,
   in Montreal, Lisbon, Seoul and Perth, keep copies of the site and answer each city's fans; the
   origin, one small server in Montreal, only hears from an edge that has no fresh copy. The
   learner deploys the cancellation of the Perth show, changes the Cache-Control of /tour and
   /my-ticket, purges one path or everything, flips the "mark /my-ticket public" mistake, and
   skips ahead to the morning of the post.

   CHANGELOG
   v1.0.0 (2026-10-09) first version: one slot is one second from 18:00:00 UTC on Thursday
     1 October. Each city sends 7 requests a second: /tour, the script the page names, 4 of the
     400 tour photos in turn, and /my-ticket. Controls: /tour's Cache-Control (a week, a minute,
     max-age=60 with s-maxage=300, no-cache), /my-ticket's Cache-Control (private, no-store or
     private, max-age=300), the public /my-ticket mistake, deploy (twice: cancel Perth, then the
     rebooked show), purge /tour, purge everything, skip 24 hours, skip to the post (Thursday
     8 October, 10:00 UTC), reset. Stats: edge hit ratio over the last 10 s, origin requests in
     the last second, the typical wait in each of the four cities, old /tour pages served since
     the first deploy, and tickets shown to the wrong fan. selfTest: 15 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e07-v1.0.0.json):
   - post: four cities, Montreal, Lisbon, Seoul, Perth, one edge each. The origin manages about
     15 requests a second. Each city sends about 7 a second: 1 for /tour, 1 for the script, 4
     photos (400 in all), 1 for /my-ticket. Last tour, with no CDN, all 28 went to the origin.
     The edges answer 6 in 7 (24 of 28, 85.7%) and the origin hears 4 a second (/my-ticket,
     private, no-store, one per city). A copy from the edge takes about 20 ms. /tour is sent
     as public, max-age=604800, a week; the script and photos have fingerprinted names and are
     kept a year, so they never run out in the sim. Deploy at 18:00:00 UTC on Thursday 1 October.
   - post log (Thursday 8 October, 10:00 UTC, 576,000 s after the deploy): each edge's /tour Age.
     The edges fetched /tour on Sun 27 Sep 09:14 (Montreal), Tue 29 Sep 21:40 (Lisbon), Wed
     30 Sep 13:05 (Seoul) and Thu 1 Oct 17:52 (Perth, 8 minutes before the deploy), each for a
     week, so they ran out at Sun 4 Oct 09:14, Tue 6 Oct 21:40, Wed 7 Oct 13:05 and Thu 8 Oct
     17:52. In slots from the deploy: 227,640, 445,200, 500,700 and 604,320. Each of the first
     three fetched the new page then, for another week: Ages at the post 576,000 - 227,640 =
     348,360; 576,000 - 445,200 = 130,800; 576,000 - 500,700 = 75,300. Perth's copy: 480 + 576,000
     = 576,480, with 604,320 - 576,000 = 28,320 s (7h 52m) left.
   - Latency: a hit is 20 ms everywhere. A request the edge passes on adds the edge-to-origin
     round trip (Montreal 10 ms, Lisbon 90, Seoul 190, Perth 260) plus 40 ms at the origin: 70,
     150, 250 and 320 ms. With no CDN (last tour), three round trips (TCP, TLS, the request) plus
     40 ms: Perth 3 x 260 + 40 = 820 ms, "most of a second".
   - comments: purging /tour costs one origin request per edge; purge everything makes every edge
     fetch all 400 photos again; the public /my-ticket mistake shows the first fan's page to every
     fan after them in that city for the copy's minute.
   - reply options (the actions happen at 10:00 UTC on Thursday 8 October, the post's slot
     576,000; the next deploy is 10:00 on Friday 9 October):
     index 0 (purge everything): 28 origin requests in the first second, then 20 a second for 99
     more while each edge fetches its 400 photos at 4 a second, over the origin's 15 for 100 s.
     Index 1 (public, max-age=60, no purge): Perth's old copy runs out at 17:52 as before, then
     its edge asks every minute; Montreal, Lisbon and Seoul keep their week-long copies of the
     cancelled-show page until Sun 11 Oct 09:14, Tue 13 Oct 21:40 and Wed 14 Oct 13:05, so the
     rebooked show reaches Perth within a minute and the others days later.
     Index 2 (purge /tour, max-age=60, s-maxage=300): the purge costs 9 origin requests in one
     second (4 pages, Perth's first app.7b1e.js, 4 tickets), then 4 a second; Friday's deploy and
     purge cost 12 (4 pages, 4 new app.c41d.js, 4 tickets), and every city has the rebooked show
     within the second.
     Index 3 (public, max-age=60 on /my-ticket too): each city stores one fan's ticket page for 60
     s and shows it to the next 59 fans: 59 x 4 = 236 a minute. 10:00 to 11:41 is 101 minutes:
     101 x 236 = 23,836.

   Teaching model (stated in sim.lede):
   - Slot n is the second starting 18:00:00 UTC + n on Thursday 1 October. A frame processes every
     slot that is due (floor(t + EPS)), so results never depend on the frame rate. The clock runs
     4 times faster than real life; skips process slots in a plain loop.
   - Each edge keys a copy by the URL alone. /tour: a copy is fresh while n < its expiry, unless
     it was fetched under no-cache, in which case every request goes to the origin. A request
     with no fresh copy goes to the origin and stores the page under the header in force at that
     moment. Changing a header never touches a copy already stored.
   - The script requested is the one the served page names: v1 app.3f9c.js, v2 app.7b1e.js, v3
     app.c41d.js. An edge that has never fetched that name fetches it once.
   - Photos: a purge everything sets the edge's count of photos held to 0. Requests walk the 400
     photos in turn, so each of the next 100 slots has 4 misses (400 / 4).
   - /my-ticket: every request is from a different fan. Under private or no-store the edge never
     stores it. Under the mistake (public, max-age=60) a miss stores that fan's page for 60 s and
     every hit on it within the 60 s is another fan's page: counted as shown to the wrong fan.
   - Typical wait: the middle (4th of 7) of a city's waits in the last second, so a miss only if 4
     or more of its 7 requests went to the origin. If the origin was asked for more than 15 in that
     second, waits that need it are reported as "over limit" instead of guessed.
   - api.rand() only picks which city and request a sample dot shows; no counted number uses it.

   Derivations for the self-tests (all arithmetic, with the model above):
   - Warm, no deploy: per slot 24 hits of 28 (85.7%), 4 origin requests, every city's middle wait
     a hit, 20 ms.
   - Deploy at slot 0, then 4 slots: every edge serves v1, 4 old pages a slot: 16.
   - Skip to the post (slot 576,000): old pages served = 227,640 + 445,200 + 500,700 + 576,000 =
     1,749,540. Time left: Perth 28,320 s = 7h 52m; Montreal 832,440 - 576,000 = 256,440 s = 2d
     23h; Lisbon 1,050,000 - 576,000 = 474,000 = 5d 11h; Seoul 1,105,500 - 576,000 = 529,500 =
     6d 3h. Tickets shown to the wrong fan: 0.
   - Purge /tour at slot 576,000: 4 page fetches, 1 script fetch (Perth has never needed
     app.7b1e.js; the others fetched it when their copies ran out), 4 tickets: 9. No old page
     is served from that slot on. Next slots: 4.
   - Purge everything at slot p: slot p, all 7 requests of every city miss: 28, every city's
     middle wait over limit. Slots p + 1 to p + 99: 4 photos + 1 ticket each: 20. Slot p + 100:
     4. The over-limit spell lasts 100 s and the photos are all back after 100 s.
   - Header change at the post to public, max-age=60, no purge: Perth still shows the show after
     4 slots. Skip 24 hours from slot 576,004 to 662,404: Perth fetched v2 at 604,320 and every
     60 s after, last at 662,400. Deploy v3 at 662,404: Perth's next fetch is 662,460, inside the
     next 64 slots. Montreal's v2 copy runs out at 832,440: at slot 662,468 it has 169,972 s
     left, 1d 23h, and is old.
   - Short header (s-maxage=300) and purge at 576,000: 9 requests, Perth's copy has 299 s left
     (4m 59s). Skip 24 hours to 662,401: all four copies were refetched together at 662,400.
     Deploy v3 and purge: 4 pages, 4 new app.c41d.js, 4 tickets: 12, under 15. No old page was
     served after slot 575,999, so the count stays 1,749,540.
   - Mistake on at slot 0: slot 0 stores one fan's page per city, slots 1 to 59 show it to 59
     others: 236. After 56 slots: 55 x 4 = 220 and every edge still holds a copy (it runs out at
     60); hit ratio over slots 46 to 55 is 100. Mistake off at slot 60: the copies ran out at
     60, nothing new is stored, the count stays 236 and the origin is back to 4.
   - private, max-age=300 or private, no-store: never stored at an edge, so 0 across any purge
     or skip.
   - no-cache and a purge, before any deploy: each edge asks the origin for /tour every second:
     4 + 4 = 8 a second; 2 of 7 requests miss, so the middle wait is still 20 ms.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Fans and edges: 164 wide at x 100, 280, 460, 640 (boxes 18-182, 198-362, 378-542, 558-722).
     Longest fan label "Fans in Montreal" 16 chars, 125px; fan meta "page: over limit" 16 chars,
     106px. Edge label "Montreal edge" 13 chars, 101px; longest edge sub "tour v2, asks origin"
     and "tour v1, 2d 23h left", 20 chars, 144px; longest edge meta "keeps a fan's ticket", 20
     chars, 132px.
   - Origin (280 wide): sub "Wed 14 Oct, tour v3" 19 chars, 137px; meta "28 req/s: over its 15" 21
     chars, 139px.
   - Vertical gaps: fans bottom y 79, edges top y 154 (75px); edges bottom y 226, origin top y 294
     (68px). Edge labels "7/s" (20px) sit at y about 108 on the vertical fan-to-edge lines.

   Catalog note: the case's concepts are the catalog's ids for s2e07 (cdns, edge-caching,
   cache-control-headers).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 4;                    // sim seconds per real second
  var START_CLOCK = 18 * 3600;      // 18:00:00 UTC on Thursday 1 October
  var DAY = 86400;
  var WEEK = 604800;                // max-age=604800
  var CAPACITY = 15;                // requests a second the origin manages
  var HIT_MS = 20;                  // a copy from the city's own edge
  var ORIGIN_MS = 40;               // the origin's own time per request
  var PHOTOS = 400;
  var PHOTO_RATE = 4;               // photo requests a second per city
  var PER_CITY = 7;                 // 1 tour + 1 script + 4 photos + 1 ticket
  var TICKET_TTL = 60;              // the mistake: public, max-age=60
  var POST_SLOT = 576000;           // Thursday 8 October, 10:00:00 UTC
  var MAX_VER = 3;
  var RING = 10;                    // the hit ratio covers the last 10 s
  var EPS = 1e-6;
  var DOT_EVERY = 0.25;             // real seconds between sample dots
  var DOT_SPEED = 300;              // viewBox units per real second

  var SCRIPTS = ["", "app.3f9c.js", "app.7b1e.js", "app.c41d.js"];
  var PAGE_META = ["", "Perth show: on", "Perth: cancelled", "Perth: Sat 17 Oct"];
  var PAGE_SEE = ["", "the Perth show still on", "the Perth show cancelled", "the rebooked Perth show, Saturday 17 October"];

  var CITIES = [
    { id: "mtl", name: "Montreal", rtt: 10, exp: 227640 },
    { id: "lis", name: "Lisbon", rtt: 90, exp: 445200 },
    { id: "sel", name: "Seoul", rtt: 190, exp: 500700 },
    { id: "per", name: "Perth", rtt: 260, exp: 604320 }
  ];

  var TOUR_OPTS = [
    { value: "week", label: "public, max-age=604800 (Thaddeus's: a week)" },
    { value: "min", label: "public, max-age=60 (a minute everywhere)" },
    { value: "short", label: "max-age=60, s-maxage=300 (edges keep 5 min)" },
    { value: "nocache", label: "no-cache (edges check with the origin every time)" }
  ];
  var TOUR_TTL = { week: WEEK, min: 60, short: 300, nocache: 0 };
  var TOUR_HDR = { week: "public, max-age=604800", min: "public, max-age=60", short: "max-age=60, s-maxage=300", nocache: "no-cache" };

  var TICKET_OPTS = [
    { value: "nostore", label: "private, no-store (as now)" },
    { value: "private", label: "private, max-age=300 (the fan's own browser only)" }
  ];
  var TICKET_HDR = { nostore: "private, no-store", "private": "private, max-age=300" };

  var WD = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
  var MONTHS = [["Oct", 31], ["Nov", 30], ["Dec", 31], ["Jan", 31], ["Feb", 28], ["Mar", 31],
    ["Apr", 30], ["May", 31], ["Jun", 30], ["Jul", 31], ["Aug", 31], ["Sep", 30]];

  /* ---------- small helpers ---------- */

  // 1749540 -> "1,749,540". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Slot n as a date: slot 0 -> "Thu 1 Oct".
  function dateText(n) {
    var d = Math.floor((START_CLOCK + n) / DAY);
    var date = 1 + d;
    var i = 0;
    while (date > MONTHS[i % 12][1]) { date -= MONTHS[i % 12][1]; i += 1; }
    return WD[d % 7] + " " + date + " " + MONTHS[i % 12][0];
  }

  // Slot n as a time of day: slot 0 -> "18:00:00".
  function timeText(n) {
    var s = (START_CLOCK + n) % DAY;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function whenText(n) { return dateText(n) + " " + timeText(n); }

  // 28320 -> "7h 52m", 256440 -> "2d 23h", 299 -> "4m 59s".
  function dur(s) {
    if (s >= DAY) return Math.floor(s / DAY) + "d " + Math.floor((s % DAY) / 3600) + "h";
    if (s >= 3600) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
    if (s >= 60) return Math.floor(s / 60) + "m " + (s % 60) + "s";
    return s + "s";
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function missMs(i) { return HIT_MS + CITIES[i].rtt + ORIGIN_MS; }

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  // During a skip the engine's clock stands still, so set it before each log line.
  function say(api, n, msg, tone) {
    if (api.state.skipping) api.clock = START_CLOCK + n;
    api.log(msg, tone || "");
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "CDN sim for The Gloaming's fan site. Fans in Montreal, Lisbon, Seoul and Perth each send 7 requests a second to the edge server in their own city. Each edge answers from its own copies when it has a fresh one, and otherwise asks the origin, one small server in Montreal that manages about 15 requests a second.",
    nodes: [
      { id: "fans_mtl", label: "Fans in Montreal", sub: "7 requests/s", meta: "page in 20 ms", x: 100, y: 48, w: 164, h: 62, shape: "box", tone: "" },
      { id: "fans_lis", label: "Fans in Lisbon", sub: "7 requests/s", meta: "page in 20 ms", x: 280, y: 48, w: 164, h: 62, shape: "box", tone: "" },
      { id: "fans_sel", label: "Fans in Seoul", sub: "7 requests/s", meta: "page in 20 ms", x: 460, y: 48, w: 164, h: 62, shape: "box", tone: "" },
      { id: "fans_per", label: "Fans in Perth", sub: "7 requests/s", meta: "page in 20 ms", x: 640, y: 48, w: 164, h: 62, shape: "box", tone: "" },
      { id: "edge_mtl", label: "Montreal edge", sub: "tour v1, 2d 15h left", meta: "Perth show: on", x: 100, y: 190, w: 164, h: 72, shape: "box", tone: "" },
      { id: "edge_lis", label: "Lisbon edge", sub: "tour v1, 5d 3h left", meta: "Perth show: on", x: 280, y: 190, w: 164, h: 72, shape: "box", tone: "" },
      { id: "edge_sel", label: "Seoul edge", sub: "tour v1, 5d 19h left", meta: "Perth show: on", x: 460, y: 190, w: 164, h: 72, shape: "box", tone: "" },
      { id: "edge_per", label: "Perth edge", sub: "tour v1, 6d 23h left", meta: "Perth show: on", x: 640, y: 190, w: 164, h: 72, shape: "box", tone: "" },
      { id: "origin", label: "Origin, Montreal", sub: "Thu 1 Oct, tour v1", meta: "4 of 15 req/s", x: 370, y: 330, w: 280, h: 72, shape: "box", tone: "ok" }
    ],
    edges: [
      { from: "fans_mtl", to: "edge_mtl", label: "7/s" },
      { from: "fans_lis", to: "edge_lis", label: "7/s" },
      { from: "fans_sel", to: "edge_sel", label: "7/s" },
      { from: "fans_per", to: "edge_per", label: "7/s" },
      { from: "edge_mtl", to: "origin", tone: "muted" },
      { from: "edge_lis", to: "origin", tone: "muted" },
      { from: "edge_sel", to: "origin", tone: "muted" },
      { from: "edge_per", to: "origin", tone: "muted" }
    ]
  };

  /* ---------- what each edge holds ---------- */

  // The version of /tour an edge would hand a fan at slot n.
  function pageVer(S, e, n) {
    var c = e.tour;
    if (c && !c.nc && n < c.exp) return c.ver;
    return S.ver;
  }

  function tourText(e, n) {
    var c = e.tour;
    if (!c) return "tour: none";
    if (c.nc) return "tour v" + c.ver + ", asks origin";
    if (c.exp <= n) return "tour v" + c.ver + ", expired";
    return "tour v" + c.ver + ", " + dur(c.exp - n) + " left";
  }

  function holdsTicket(e, n) { return !!(e.ticket && n < e.ticket.exp); }

  function expiryList(S) {
    var parts = [];
    for (var i = 0; i < CITIES.length; i++) {
      var c = S.edges[i].tour;
      var nm = CITIES[i].name;
      if (!c) parts.push(nm + " has none");
      else if (c.nc) parts.push(nm + " checks every time");
      else if (c.exp <= S.n) parts.push(nm + " on its next request");
      else parts.push(nm + " " + whenText(c.exp));
    }
    return parts.join(", ");
  }

  /* ---------- one slot: one second of requests in every city ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    var origin = 0;
    var hits = 0;
    var firstWrong = -1;
    var i, e, c, served, name, m, t, miss, gotScript, reason;

    for (i = 0; i < CITIES.length; i++) {
      e = S.edges[i];
      miss = 0;
      reason = null;

      // 1. /tour
      c = e.tour;
      if (c && !c.nc && n < c.exp) {
        served = c.ver;
        hits += 1;
      } else {
        reason = e.purged ? "/tour was purged" : !c ? "the edge had no copy of /tour" :
          c.nc ? "the edge checks /tour with the origin every time" : "the edge's copy of /tour ran out";
        served = S.ver;
        origin += 1;
        miss += 1;
        e.purged = false;
        e.tour = S.tourCC === "nocache" ? { ver: S.ver, exp: n, nc: true } : { ver: S.ver, exp: n + TOUR_TTL[S.tourCC], nc: false };
      }
      if (served < S.ver) S.stale += 1;

      // 2. The script the page names. A name this edge has never fetched costs one request.
      name = SCRIPTS[served];
      gotScript = false;
      if (e.scripts[name]) {
        hits += 1;
      } else {
        e.scripts[name] = true;
        origin += 1;
        miss += 1;
        gotScript = true;
      }

      // 3. Four photos, in turn. After a purge everything, the next 400 are all misses.
      m = PHOTOS - e.photos;
      if (m > PHOTO_RATE) m = PHOTO_RATE;
      e.photos += m;
      origin += m;
      miss += m;
      hits += PHOTO_RATE - m;

      // 4. /my-ticket, from a different fan every time.
      e.fan += 1;
      t = e.ticket;
      if (t && n < t.exp) {
        hits += 1;
        if (t.owner !== e.fan) {
          S.wrong += 1;
          if (firstWrong < 0) firstWrong = i;
        }
      } else {
        e.ticket = null;
        origin += 1;
        miss += 1;
        if (S.mistake) e.ticket = { owner: e.fan, exp: n + TICKET_TTL };
      }

      e.misses = miss;

      if (served > e.seen) {
        e.seen = served;
        say(api, n, whenText(n) + " " + CITIES[i].name + ": " + reason + ", so the edge fetched the current page from the origin" +
          (gotScript ? ", then " + name + ", a name it had never seen." : ", and it already had " + name + ".") +
          " Fans in " + CITIES[i].name + " now see " + PAGE_SEE[served] + ".", "ok");
      }
    }

    // Every city's typical wait: the 4th of its 7, a miss only if 4 or more went to the origin.
    S.over = origin > CAPACITY;
    for (i = 0; i < CITIES.length; i++) {
      e = S.edges[i];
      e.lat = e.misses >= 4 ? (S.over ? -1 : missMs(i)) : HIT_MS;
    }

    S.ringHits[S.ringPos] = hits;
    S.ringTotal[S.ringPos] = PER_CITY * CITIES.length;
    S.ringPos = (S.ringPos + 1) % RING;
    S.lastOrigin = origin;
    S.lastHits = hits;
    S.n = n + 1;

    narrate(api, n, origin, firstWrong);
  }

  /* ---------- narration ---------- */

  function narrate(api, n, origin, firstWrong) {
    var S = api.state;
    var full = true;
    var i;

    if (S.over && S.overSince === null) {
      S.overSince = n;
      say(api, n, whenText(n) + " The origin is asked for " + origin + " requests in one second, and it manages " + CAPACITY +
        ". Every request that needs it queues, in every city: the sim says over limit instead of guessing the wait.", "bad");
    } else if (!S.over && S.overSince !== null) {
      say(api, n, whenText(n) + " The origin is back to " + origin + " requests a second after " + (n - S.overSince) + " seconds over its limit.", "ok");
      S.overSince = null;
    }

    if (S.refillFrom !== null) {
      for (i = 0; i < CITIES.length; i++) if (S.edges[i].photos < PHOTOS) full = false;
      if (full) {
        say(api, n, whenText(n) + " Every edge has all 400 photos again, " + (n + 1 - S.refillFrom) + " seconds after the purge.", "ok");
        S.refillFrom = null;
      }
    }

    if (firstWrong >= 0 && !S.wrongLogged) {
      S.wrongLogged = true;
      say(api, n, whenText(n) + " " + CITIES[firstWrong].name + ": a fan opened /my-ticket and got another fan's ticket page, with that fan's name, email and seat. The edge keeps one copy per URL, and the cookie that says who is asking isn't part of that key.", "bad");
    }
  }

  /* ---------- the week ---------- */

  function startShow(api) {
    var S = api.state;
    var i;
    S.t = 0;
    S.n = 0;
    api.clock = START_CLOCK;
    S.ver = 1;
    S.stale = 0;
    S.wrong = 0;
    S.edges = [];
    for (i = 0; i < CITIES.length; i++) {
      S.edges.push({
        tour: { ver: 1, exp: CITIES[i].exp, nc: false },
        scripts: { "app.3f9c.js": true },
        photos: PHOTOS,
        ticket: null,
        fan: 0,
        seen: 1,
        purged: false,
        misses: 1,
        lat: HIT_MS
      });
    }
    // The ten seconds before 18:00 looked like every warm second: 24 hits of 28, 4 at the origin.
    S.ringHits = [];
    S.ringTotal = [];
    for (i = 0; i < RING; i++) { S.ringHits.push(24); S.ringTotal.push(PER_CITY * CITIES.length); }
    S.ringPos = 0;
    S.lastOrigin = 4;
    S.lastHits = 24;
    S.over = false;
    S.overSince = null;
    S.refillFrom = null;
    S.wrongLogged = false;
    S.skipping = false;
    S.dotClock = 0;
    say(api, 0, "Thu 1 Oct 18:00:00 UTC. The CDN is warm: every edge has /tour, " + SCRIPTS[1] + " and all 400 photos, and answers 24 of every 28 requests. /tour goes out as public, max-age=604800. Thaddeus is ready to take the Perth show off the site: press Deploy.", "");
    draw(api);
  }

  /* ---------- controls ---------- */

  function setTour(api, v) {
    var o = pick(TOUR_OPTS, v);
    if (!o) return;
    var S = api.state;
    S.tourCC = String(o.value);
    say(api, S.n, "New copies of /tour will carry Cache-Control: " + TOUR_HDR[S.tourCC] +
      ". Copies already at the edges keep the expiry they were fetched with: " + expiryList(S) + ". Purge /tour to replace them now.", "");
    draw(api);
  }

  function setTicket(api, v) {
    var o = pick(TICKET_OPTS, v);
    if (!o) return;
    var S = api.state;
    S.ticketCC = String(o.value);
    say(api, S.n, "/my-ticket now goes out as " + TICKET_HDR[S.ticketCC] + ". " +
      (S.ticketCC === "private" ? "private: a shared cache such as an edge must not store it, and the fan's own browser may keep it for 5 minutes." :
        "no-store: no cache may store it at all, not the edge and not the browser.") +
      (S.mistake ? " The mistake is still on, and it overrides this." : ""), "");
    draw(api);
  }

  function setMistake(api, on) {
    var S = api.state;
    S.mistake = !!on;
    if (S.mistake) {
      S.wrongLogged = false;
      say(api, S.n, "Mistake on: /my-ticket now goes out as public, max-age=60. Each edge keeps one copy per URL, and the fan's cookie isn't part of that key, so in each city the next fan's ticket page will be kept for a minute and shown to every fan after them.", "bad");
    } else {
      var held = 0;
      for (var i = 0; i < CITIES.length; i++) if (holdsTicket(S.edges[i], S.n)) held += 1;
      say(api, S.n, "Mistake off: /my-ticket goes out as " + TICKET_HDR[S.ticketCC] + " again. " +
        (held ? held + (held === 1 ? " edge still holds" : " edges still hold") + " a fan's ticket page and will keep showing it until its minute runs out: turning a header off doesn't take back copies already stored."
          : "No edge is holding a ticket page right now."), held ? "warn" : "ok");
    }
    draw(api);
  }

  function deploy(api) {
    var S = api.state;
    if (S.ver >= MAX_VER) return;
    S.ver += 1;
    var what = S.ver === 2
      ? "the origin's /tour no longer lists the Perth show, and it now loads " + SCRIPTS[2] + "."
      : "the origin's /tour now lists the rebooked Perth show, Saturday 17 October, and loads " + SCRIPTS[3] + ".";
    say(api, S.n, whenText(S.n) + " Deploy: " + what + " Each edge keeps the copy it has until that copy runs out: " + expiryList(S) + ".", "warn");
    draw(api);
  }

  function purgeTour(api) {
    var S = api.state;
    for (var i = 0; i < CITIES.length; i++) { S.edges[i].tour = null; S.edges[i].purged = true; }
    say(api, S.n, whenText(S.n) + " Purge /tour: all four edges drop their copy of that one URL. The next request in each city fetches the current page from the origin, one request per edge, and the edges keep everything else.", "");
    draw(api);
  }

  function purgeAll(api) {
    var S = api.state;
    for (var i = 0; i < CITIES.length; i++) {
      var e = S.edges[i];
      e.tour = null;
      e.purged = true;
      e.scripts = {};
      e.photos = 0;
      e.ticket = null;
    }
    S.refillFrom = S.n;
    say(api, S.n, whenText(S.n) + " Purge everything: all four edges drop /tour, the script, all 400 photos and everything else they hold. Until each has fetched them again, nearly every request goes to the origin.", "warn");
    draw(api);
  }

  function skipTo(api, target) {
    var S = api.state;
    S.skipping = true;
    var guard = 0;
    while (S.n < target && guard < 2000000) { slot(api); guard += 1; }
    S.skipping = false;
    S.t = S.n;
    api.clock = START_CLOCK + S.n;
  }

  function staleNote(S) {
    return S.ver > 1 ? " Old /tour pages served since the deploy: " + fmt(S.stale) + "." : " No deploy yet, so no edge's page is old.";
  }

  function skipDay(api) {
    var S = api.state;
    skipTo(api, S.n + DAY);
    say(api, S.n, "Skipped 24 hours to " + whenText(S.n) + " UTC." + staleNote(S), "");
    draw(api);
  }

  function skipPost(api) {
    var S = api.state;
    if (S.n >= POST_SLOT) return;
    skipTo(api, POST_SLOT);
    var p = S.edges[3].tour;
    say(api, S.n, "Skipped to " + whenText(S.n) + " UTC, the morning of the post." + staleNote(S) +
      (p && !p.nc && p.exp > S.n && p.ver < S.ver ? " Perth's edge still has its copy from before the deploy, with " + dur(p.exp - S.n) + " left." : ""),
      S.ver > 1 ? "warn" : "");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function latText(lat) { return lat < 0 ? "over limit" : lat; }

  function draw(api) {
    var S = api.state;
    var n = S.n;
    var i, e, v, fn, en, holds;

    for (i = 0; i < CITIES.length; i++) {
      e = S.edges[i];
      v = pageVer(S, e, n);
      holds = holdsTicket(e, n);

      en = api.node("edge_" + CITIES[i].id);
      en.text("sub", tourText(e, n));
      en.text("meta", holds ? "keeps a fan's ticket" : PAGE_META[v]);
      en.set(holds || v < S.ver ? "bad" : e.photos < PHOTOS ? "warn" : "ok");

      fn = api.node("fans_" + CITIES[i].id);
      fn.text("meta", e.lat < 0 ? "page: over limit" : "page in " + e.lat + " ms");
      fn.set(e.lat < 0 ? "bad" : e.lat > HIT_MS ? "warn" : "ok");
    }

    var o = api.node("origin");
    o.text("sub", dateText(n) + ", tour v" + S.ver);
    o.text("meta", S.over ? S.lastOrigin + " req/s: over its " + CAPACITY : S.lastOrigin + " of " + CAPACITY + " req/s");
    o.set(S.over ? "bad" : "ok");

    S.stat.hit(Math.round(1000 * sum(S.ringHits) / sum(S.ringTotal)) / 10);
    S.stat.origin(S.lastOrigin);
    S.stat.mtl(latText(S.edges[0].lat));
    S.stat.lis(latText(S.edges[1].lat));
    S.stat.sel(latText(S.edges[2].lat));
    S.stat.per(latText(S.edges[3].lat));
    S.stat.stale(fmt(S.stale));
    S.stat.wrong(fmt(S.wrong));

    S.ctl.deploy.disable(S.ver >= MAX_VER);
    S.ctl.post.disable(S.n >= POST_SLOT);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    var i = Math.floor(api.rand() * CITIES.length);
    if (i >= CITIES.length) i = CITIES.length - 1;
    var e = S.edges[i];
    var id = CITIES[i].id;
    var old = pageVer(S, e, S.n) < S.ver || holdsTicket(e, S.n);
    var over = S.over;
    if (api.rand() * PER_CITY < e.misses) {
      api.dot({ path: ["fans_" + id, "edge_" + id, "origin"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) {
          if (!dot) return;
          if (wp === "edge_" + id) dot.cls("dot-wait");
          if (wp === "origin") dot.cls(over ? "dot-fail" : "dot-ok");
        } });
    } else {
      api.dot({ path: ["fans_" + id, "edge_" + id], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === "edge_" + id) dot.cls(old ? "dot-bad" : "dot-ok"); } });
    }
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.edges) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t + EPS);
    var guard = 0;
    while (S.n < due && guard < 2000) { slot(api); guard += 1; }
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  function cityIndex(id) {
    for (var i = 0; i < CITIES.length; i++) if (id.slice(-3) === CITIES[i].id) return i;
    return -1;
  }

  function fansInfo(S, i) {
    var c = CITIES[i];
    return "<strong>Fans in " + c.name + ".</strong> 7 requests a second: /tour, the script that page names, 4 of the 400 tour photos in turn, and /my-ticket. " +
      "A copy from the " + c.name + " edge takes about " + HIT_MS + " ms. A request the edge has to pass on adds the round trip to Montreal, " + c.rtt +
      " ms from " + c.name + ", plus " + ORIGIN_MS + " ms at the origin: " + missMs(i) + " ms. Last tour, with no CDN, every page took three round trips to Montreal plus " +
      ORIGIN_MS + " ms: " + (3 * c.rtt + ORIGIN_MS) + " ms. The typical wait shown is the middle one of the city's 7 in the last second.";
  }

  function edgeInfo(S, i) {
    var e = S.edges[i];
    var c = e.tour;
    var names = [];
    for (var k in e.scripts) if (Object.prototype.hasOwnProperty.call(e.scripts, k)) names.push(k);
    var s = "<strong>" + CITIES[i].name + " edge.</strong> A CDN server in " + CITIES[i].name + " with its own cache, separate from the other three. It keys each copy by the URL alone. ";
    if (!c) s += "It has no copy of /tour right now. ";
    else if (c.nc) s += "Its copy of /tour was sent as no-cache, so it asks the origin before every use. ";
    else if (c.exp <= S.n) s += "Its copy of /tour has run out; the next request fetches a new one. ";
    else s += "Its copy of /tour is version " + c.ver + " and runs out at " + whenText(c.exp) + " UTC. ";
    s += "Scripts held: " + (names.length ? names.join(", ") : "none") + ". Photos held: " + e.photos + " of 400. ";
    s += holdsTicket(e, S.n) ? "It is holding one fan's /my-ticket page and showing it to everyone." : "It holds no /my-ticket page.";
    return s;
  }

  function originInfo(S) {
    return "<strong>Origin, Montreal.</strong> The one small server that holds the real site. It manages about " + CAPACITY +
      " requests a second. Right now /tour is version " + S.ver + " and names " + SCRIPTS[S.ver] + ". New copies of /tour go out with Cache-Control: " +
      TOUR_HDR[S.tourCC] + "; /my-ticket with " + (S.mistake ? "public, max-age=60 (the mistake)" : TICKET_HDR[S.ticketCC]) +
      ". The script and photos have fingerprinted names and go out for a year.";
  }

  /* ---------- the module ---------- */

  DL.sims.define("s2e07", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.tourCC = "week";
      S.ticketCC = "nostore";
      S.mistake = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.tour = api.control.select("tour", "/tour's Cache-Control", TOUR_OPTS, "week", function (v) { setTour(api, v); });
      S.ctl.ticket = api.control.select("ticket", "/my-ticket's Cache-Control", TICKET_OPTS, "nostore", function (v) { setTicket(api, v); });
      S.ctl.mistake = api.control.toggle("mistake", "Mistake: mark /my-ticket public (public, max-age=60)", false, function (on) { setMistake(api, on); });
      S.ctl.deploy = api.control.button("deploy", "Deploy the next /tour (cancel Perth, then the rebooked show)", function () { deploy(api); });
      S.ctl.purge = api.control.button("purge", "Purge /tour at every edge", function () { purgeTour(api); });
      S.ctl.purgeall = api.control.button("purgeall", "Purge everything", function () { purgeAll(api); }, { tone: "danger" });
      S.ctl.day = api.control.button("day", "Skip ahead 24 hours", function () { skipDay(api); });
      S.ctl.post = api.control.button("post", "Skip to Thu 8 Oct, 10:00 UTC (the post)", function () { skipPost(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        hit: api.stat("hit", "edge hit ratio %, last 10 s", "ok"),
        origin: api.stat("origin", "origin requests, last second (manages 15)", ""),
        mtl: api.stat("mtl", "Montreal: typical wait, ms", ""),
        lis: api.stat("lis", "Lisbon: typical wait, ms", ""),
        sel: api.stat("sel", "Seoul: typical wait, ms", ""),
        per: api.stat("per", "Perth: typical wait, ms", ""),
        stale: api.stat("stale", "old /tour pages served since the deploy", "bad"),
        wrong: api.stat("wrong", "tickets shown to the wrong fan", "bad")
      };

      api.onNodeClick(function (id) {
        var S2 = api.state;
        if (id === "origin") { api.info(originInfo(S2)); return; }
        var i = cityIndex(id);
        if (i < 0) return;
        api.info(id.indexOf("fans_") === 0 ? fansInfo(S2, i) : edgeInfo(S2, i));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startShow(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return t.stat(id); }
      var a, b, c;

      // 1. Warm, before any deploy: the edges answer most of the traffic.
      await t.run(1);                                   // slots 0-3
      t.expect(n("hit") === 85.7 && n("origin") === 4 && n("mtl") === 20 && n("per") === 20 && n("stale") === 0 && n("wrong") === 0 &&
        t.node("origin").text.meta === "4 of 15 req/s",
        "Warm: the edges answer 24 of 28 requests a second (85.7%), the origin hears 4, and fans in every city wait 20 ms");

      // 2. Deploy at 18:00:00: every edge keeps its old copy of /tour.
      t.click("reset");
      t.click("deploy");
      await t.run(1);                                   // slots 0-3
      t.expect(n("stale") === 16 && t.node("edge_per").text.meta === "Perth show: on" && t.node("edge_per").state === "bad" &&
        t.logText().indexOf("Montreal Sun 4 Oct 09:14:00, Lisbon Tue 6 Oct 21:40:00, Seoul Wed 7 Oct 13:05:00, Perth Thu 8 Oct 17:52:00") >= 0,
        "Deploy: the four edges keep the old page until Sun 4 Oct 09:14, Tue 6 Oct 21:40, Wed 7 Oct 13:05 and Thu 8 Oct 17:52");

      // 3. The morning of the post: only Perth still shows the cancelled show.
      t.click("post");                                  // slots 4-575,999
      t.expect(n("stale") === "1,749,540" && n("wrong") === 0 &&
        t.node("edge_per").text.sub === "tour v1, 7h 52m left" && t.node("edge_per").text.meta === "Perth show: on" &&
        t.node("edge_mtl").text.sub === "tour v2, 2d 23h left" && t.node("edge_mtl").text.meta === "Perth: cancelled" &&
        t.node("edge_lis").text.sub === "tour v2, 5d 11h left" && t.node("edge_sel").text.sub === "tour v2, 6d 3h left",
        "Thu 8 Oct 10:00 UTC: 1,749,540 old pages served, and Perth's week-long copy from 17:52 on 1 Oct still has 7h 52m left");
      t.expect(t.logText().indexOf("Sun 4 Oct 09:14:00 Montreal: the edge's copy of /tour ran out, so the edge fetched the current page from the origin, then app.7b1e.js, a name it had never seen.") >= 0,
        "Fingerprinted script: the first new page each edge fetched named app.7b1e.js, which it fetched at once, with no purge");

      // 4. Purge one path: one request per edge, plus Perth's first app.7b1e.js.
      t.click("purge");
      await t.run(0.25);                                // slot 576,000
      a = n("origin");
      await t.run(1);                                   // slots 576,001-576,004
      t.expect(a === 9 && n("origin") === 4 && n("stale") === "1,749,540" && t.node("edge_per").text.meta === "Perth: cancelled" &&
        t.logText().indexOf("Perth: /tour was purged, so the edge fetched the current page from the origin, then app.7b1e.js, a name it had never seen.") >= 0,
        "Purge /tour: 9 origin requests in one second (4 pages, Perth's new script, 4 tickets), then 4 again, and no city is stale");

      // 5. Purge everything: every photo, at every edge, at once.
      t.click("purgeall");
      await t.run(0.25);                                // slot 576,005
      a = n("origin");
      b = n("per");
      await t.run(0.25);                                // slot 576,006
      c = n("origin");
      await t.run(25);                                  // slots 576,007-576,106
      t.expect(a === 28 && b === "over limit" && c === 20 && n("origin") === 4 && n("per") === 20 && n("mtl") === 20 &&
        t.logText().indexOf("The origin is asked for 28 requests in one second, and it manages 15.") >= 0 &&
        t.logText().indexOf("after 100 seconds over its limit") >= 0 &&
        t.logText().indexOf("Every edge has all 400 photos again, 100 seconds after the purge.") >= 0,
        "Purge everything: 28 origin requests, then 20 a second, over its 15 for 100 seconds while the edges refetch 400 photos each");

      // 6. A header change doesn't touch copies already stored.
      t.click("reset");
      t.click("deploy");
      t.click("post");
      t.set("tour", "min");
      await t.run(1);                                   // slots 576,000-576,003
      a = t.node("edge_per").text.meta;
      t.click("day");                                   // to Fri 9 Oct 10:00:04
      t.click("deploy");                                // the rebooked show
      await t.run(16);                                  // slots 662,404-662,467
      t.expect(a === "Perth show: on" && t.node("edge_per").text.meta === "Perth: Sat 17 Oct" &&
        t.node("edge_mtl").text.meta === "Perth: cancelled" && t.node("edge_mtl").state === "bad" &&
        t.node("edge_mtl").text.sub === "tour v2, 1d 23h left",
        "max-age=60 with no purge: Perth gets the rebooked show within a minute, but Montreal's week-long copy holds the old page until Sun 11 Oct 09:14");

      // 7. The senior fix: purge /tour now, short edge copies, and purge on the next deploy.
      t.click("reset");
      t.click("deploy");
      t.click("post");
      t.set("tour", "short");
      t.click("purge");
      await t.run(0.25);                                // slot 576,000
      t.expect(n("origin") === 9 && t.node("edge_per").text.sub === "tour v2, 4m 59s left" && t.node("edge_per").text.meta === "Perth: cancelled",
        "Purge /tour with s-maxage=300: Perth shows the cancellation at once, and its new copy lasts 5 minutes at the edge");
      t.click("day");                                   // to Fri 9 Oct 10:00:01
      t.click("deploy");
      t.click("purge");
      await t.run(0.25);                                // slot 662,401
      t.expect(n("origin") === 12 && n("stale") === "1,749,540" && n("per") === 20 &&
        t.node("edge_mtl").text.meta === "Perth: Sat 17 Oct" && t.node("edge_per").text.meta === "Perth: Sat 17 Oct" &&
        t.logText().indexOf("then app.c41d.js, a name it had never seen.") >= 0,
        "Deploy and purge /tour: every city has the rebooked show in the same second for 12 origin requests, and nothing old is served");

      // 8. The mistake: /my-ticket marked public.
      t.click("reset");
      t.click("mistake");
      await t.run(14);                                  // slots 0-55
      t.expect(n("wrong") === 220 && n("hit") === 100 && t.node("edge_sel").text.meta === "keeps a fan's ticket" &&
        t.node("edge_sel").state === "bad" && t.logText().indexOf("a fan opened /my-ticket and got another fan's ticket page") >= 0,
        "Public /my-ticket: each edge shows one fan's ticket page to every fan after them, and the hit ratio reads 100%");
      await t.run(1);                                   // slots 56-59
      t.expect(n("wrong") === 236, "Public /my-ticket: 59 wrong pages per city per minute, 236 a minute across the four cities");
      t.click("mistake");                               // off, at slot 60
      await t.run(15);                                  // slots 60-119
      t.expect(n("wrong") === 236 && n("origin") === 4 && t.node("edge_sel").text.meta === "Perth show: on",
        "Mistake off once the copies ran out: no ticket page is stored or shown again");

      // 9. private and no-store pages are never served across fans.
      t.click("reset");
      t.set("ticket", "private");
      t.click("deploy");
      t.click("purgeall");
      await t.run(30);
      t.click("day");
      t.expect(n("wrong") === 0 && t.node("edge_per").text.meta !== "keeps a fan's ticket",
        "private, max-age=300: the edge never stores /my-ticket, so no fan ever gets another fan's page");
      t.set("ticket", "nostore");
      t.click("purge");
      t.click("day");
      t.expect(n("wrong") === 0 && n("origin") === 4,
        "private, no-store: never stored, never served across fans, every ticket request goes to the origin");

      // 10. no-cache: always current, at a price paid by the origin.
      t.click("reset");
      t.set("tour", "nocache");
      t.click("purge");
      await t.run(1);                                   // slots 0-3
      t.expect(n("origin") === 8 && n("per") === 20 && t.node("edge_per").text.sub === "tour v1, asks origin",
        "no-cache: every /tour request is checked with the origin, 8 origin requests a second, and the typical wait is still 20 ms");
    }
  });
})();
