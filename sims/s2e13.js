/* sims/s2e13-v1.0.1.js  (published as sims/s2e13.js)
   Case s2e13 "The Queue Outside": the Mothlight, a club in two railway arches on Brindle Lane.
   Guests sign up on their phones at the door, and the club's web server sends each one a welcome
   email. The learner plays Fenna, who built the app: send the email inside the request (before
   May) or answer 202 and put a ticket in "the box", a queue that workers drain. Controls: the
   request mode, the arrival rate, the late train's rush, the number of workers, a provider having
   a bad night, the retry rule (back on top forever, 3 tries then throw away, 3 tries then the
   dead-letter queue), a guest who mistypes the address, two skip buttons and reset.

   CHANGELOG
   v1.0.1 (2026-10-10) Season 2 review fixes: the header names the oldest-ticket commenter
     u/oldest_ticket_augustin, as the case now does. No change to the model or the numbers.
     Points at case v1.0.1.
   v1.0.0 (2026-10-09) first version: Saturday night from 22:59:50. Slots of 0.1 s. 8 web server
     threads; saving a signup 0.1 s; one email 1.5 s. Sync: a signup holds a thread for 1.6 s (3.1 s
     when the first send fails). Queued: 0.1 s, then a ticket goes in the box and free workers take
     the ticket on top. June's ticket 413 starts on worker-1 with 6,854,400 failed tries; ticket
     2035 signs up at 02:00:00 with a comma where the dot goes. Stats: p95 response time and busy
     share of threads over the last 10 s, tickets waiting, the oldest waiting ticket's age, retries,
     tickets in the dead-letter queue, tickets failed 3 or more times and still being tried.
     selfTest: 30 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e13-v1.0.1.json):
   - post: the door opens at 22:00 and a guest arrives every 10 seconds (slot n % 100 === 0), so
     tickets 1 to 359 went out before 22:59:50 and ticket 360 signs up at 22:59:50 (slot 0). The late
     train at 23:00: about 600 people sign up in a minute, 10 a second (one a slot, slots 100 to 699,
     tickets 361 to 960). The door shuts at 03:00 (no arrivals from slot 144100). Saving takes 0.1 s,
     the provider 1.5 s per email, and the server works on 8 signups at once. Before May: 8 / 1.6 s =
     5 a second; phones spun for up to a minute (61.6 s at most here). Since May: answer at once with
     the ticket number; two workers; a failed send goes back on top and is tried again. Ticket 413,
     13 June: "back for my coat" is not an address; tried every 1.5 s since that night, about 6.9
     million times: 119 days (13 June to 10 October) x 57,600 tries a day = 6,854,400, as if the
     first try began at 22:59:50 on 13 June; tonight's first failure (22:59:51.5) is the 6,854,401st.
     Up to 14 minutes late: ticket 960 is sent at 23:15:00.1, 840.2 s after signing up. 02:00:00
     ticket 2035 (one every 10 s from 23:01:00: 960 + 1,075 = 2,035); worker-2 takes it at
     02:00:00.1 and fails it at 02:00:01.6 and 02:00:03.1. 02:30: 179 waiting, oldest 1,790 s.
     03:00: 359 waiting (one every 10 s from 02:00:10 to 02:59:50), oldest 3,590 s. 05:00: still
     359, oldest 10,790 s.
   - comments: 5 a second against 10; one worker sending since June, about 0.7 a second (1 / 1.5 s),
     none since 02:00 (OP's reply to u/grey_pager). Festival nights, one guest a second (OP's reply;
     the rate control). The provider's bad night in August: one email in five failed its first try
     with a 503 and went through on the second (OP's reply to u/backoff_briony; tickets whose number
     is a multiple of 5). An alarm on the oldest ticket's age at 10 minutes rings at about 23:11
     (23:10:42.9 here, when ticket 790 has waited 600 s; u/oldest_ticket_augustin).
   - reply options: index 0 (sync): all 8 threads busy at 23:00:00.7, 296 waiting for a thread and
     a p95 of 30.4 s at 23:01:00, slowest answer 61.6 s, the line empty at 23:02:00.6; ticket 2035 is
     answered with an error after 3.1 s. Index 1 (six workers, forever): 399 waiting at 23:01:00,
     ticket 960 sent at 23:03:00.5 (120.6 s), box empty at 23:03:03.3; 2 stuck from 02:00:04.6; at
     03:00 the box is empty and 12,005 retries since 22:59:50. Index 2 (3 tries, throw away): 413
     thrown away at 22:59:51.5, ticket 960 sent at 23:07:30.2, box empty at 23:08:01.6, 2035 thrown
     away at 02:00:04.6. Index 3 (3 tries, dead-letter queue): 413 parked at 22:59:51.5, 519
     waiting at 23:01:00, ticket 960 sent at 23:07:30.2 (390.3 s), box empty at 23:08:01.6, the
     oldest waiting ticket never past 390 s, 2035 parked at 02:00:04.6 after 3 tries, 2 retries.

   Teaching model (stated in sim.lede):
   - Time runs in slots of 0.1 s. Slot 0 is 22:59:50. Each frame processes every slot that is due
     (floor(t x 10)), so results never depend on the frame rate. The clock runs 10x real time.
   - Each slot, in this order: (1) threads whose work ends this slot answer their guest (the
     response time is the slot minus the signup slot); queued, the ticket goes in the box. (2)
     Workers whose try ends this slot finish it: a send succeeds, or it fails and the retry rule
     decides: back to the same worker at once (forever, or fewer than 3 failed tries), or out of the
     worker to the dead-letter queue or the bin. Putting a failed ticket back on top and letting the
     first free worker take it is the same thing, because the worker that failed it is that worker.
     The sim never waits between tries, so it has no backoff. (3) A guest may sign up and join the
     line. (4) Free threads take guests from the line, in thread order: queued for 1 slot, sync for
     1 + 15 slots, or 1 + 30 when the first send fails (both tries fail for a bad address, which is
     then answered with an error). (5) Free workers take the ticket on top of the box, in worker
     order; a try takes 15 slots.
   - A bad address fails every try. The bad-night provider fails a ticket's first try when its
     number is a multiple of 5; the second works.
   - p95 is the nearest-rank 95th percentile of the response times of guests answered in the last
     100 slots. Busy is the average share of the 8 threads in use over the last 100 slots, rounded.
     The oldest ticket's age counts from its guest's signup (0.1 s more than SQS would count) and
     only covers tickets waiting in the box: a ticket a worker is trying isn't counted, as SQS
     leaves in-flight and poison-pill messages out. Stuck counts tickets that have failed 3 or more
     times and are still being tried: only possible with the forever rule (and for 413 in its first
     1.5 s, before its next failure moves it).
   - Changing a setting replays the night from 22:59:50. A mistyped address applies to the next
     signup.

   Derivations for the self-tests (all from the rules above):
   - Fenna's Saturday (queued, 2 workers, forever): worker-1 never sends; 413 fails at slots 15,
     30, ..., 690 (46 retries by 23:01:00). Worker-2 sends ticket 360 at slot 16, then takes rush
     tickets at slots 101, 116, ..., 686 (40 taken) and has sent 39 of them plus 360 by slot 699.
     Tickets 361 to 959 have gone in the box by the end of slot 699 (960 goes in at slot 700): 599 -
     40 = 559 waiting, the oldest ticket 401 (signed up at slot 140): (700 - 140) / 10 = 56 s. Busy:
     one thread for one slot per signup, 100 slot-threads in 100 slots, 100 / 8 = 12.5, shown as
     13. After the rush one worker sends 1 per 15 slots while 1 arrives per 100: ticket 790 (slot
     529) is still waiting at slot 6529 (23:10:42.9); ticket 960 is sent at slot 9101 (23:15:00.1,
     8,402 slots after signing up); the box is empty after slot 10571 (23:17:27.1). By 01:59:50
     (slot 108000) 1,674 sent and 7,199 retries. Ticket 2035 (slot 108100) goes in the box and to
     worker-2 at slot 108101; failures at 108116, 108131 and 108146 (02:00:04.6, its third: both
     workers now stuck); 7,219 retries by 02:00:10. Then nothing is sent: tickets from 108200 to
     144000, one per 100 slots, 359 waiting at 03:00:00, the oldest (108200) 3,590 s; retries
     12,005.
   - 3 tries, then the dead-letter queue: 413 fails its 6,854,401st try at slot 15 and is parked;
     both workers send; at 23:01:00 519 waiting (oldest 52 s), 1 in the DLQ, 0 retries; ticket 960
     sent at slot 4602 (23:07:30.2, 390.3 s), box empty after slot 4916 (23:08:01.6); the oldest
     waiting ticket peaks at 390 s, so the 10-minute line is never crossed. Ticket 2035 goes to
     worker-1, fails at 02:00:01.6, 02:00:03.1 and 02:00:04.6 (try 3, parked): 2 retries, 2 parked,
     2,034 sent by 03:00. With "throw away" the timings are the same and the bin counts 1, then 2.
   - Before May (sync): a signup holds a thread for 16 slots, so 8 threads finish 1 every 2 slots
     (5 a second) while the rush brings 1 a slot. All 8 busy first at slot 107 (23:00:00.7). At
     23:01:00: 296 waiting for a thread, p95 30.4 s, slowest answer so far 30.4 s, busy 100. The line
     is empty after slot 1306 (23:02:00.6); the slowest guest (ticket 961, slot 700) is answered at
     23:02:01.6 after 61.6 s; p95 61.6 at 23:02:10 and 1.6 at 23:02:20. Ticket 2035: two failed
     tries, answered with an error at 02:00:03.1, 3.1 s after signing up; p95 3.1 at 02:00:10.
   - Six workers, forever: 399 waiting at 23:01:00; ticket 960 sent at 23:03:00.5 (120.6 s); empty
     at 23:03:03.3; 2 stuck from 02:00:04.6; at 03:00 nothing waiting, 12,005 retries.
   - A festival night (one guest a second), 1 worker, dead-letter queue: 1 arrives every 10 slots,
     1 is sent every 15, so the box grows by 1 every 30 slots after the rush: 563 waiting at 23:01,
     744 at 23:10 (oldest 560 s), 1,000 at 23:22:45.2, 5,344 at 03:00 (oldest 5,344 s). With 2
     workers it drains: 519 at 23:01, 340 at 23:10 (oldest 340 s).
   - Provider's bad night, dead-letter queue: ticket 360 fails its first try at 22:59:51.6 with a
     503; at 23:01:00 532 waiting, 14 retries, 1 parked.
   - A mistyped address on ticket 360 (forever): worker-2 fails it at 22:59:51.6, 22:59:53.1 and
     22:59:54.6, and from then both workers are stuck. With the dead-letter queue: parked at
     22:59:54.6 after try 3; 2 retries, 2 parked.
   - No late train: one signup every 100 slots, each answered in 0.1 s and sent at once by
     worker-2: nothing waiting at 23:01:00, busy 1 / 8 = 0.125 rounded to 0.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Guests' phones (160 wide, 52 high): label 14 chars, 109px; longest sub "1 every 10 s" or
     "10 signups/s" 12 chars, 86px.
   - Web server (200 wide, 62 high): sub "8 of 8 threads busy" 19 chars, 137px; longest meta
     "1,234 waiting for a thread" 26 chars, 172px.
   - Email provider (190 wide, 62 high): label 14 chars, 109px; sub "1.5 s per email" 15 chars,
     108px; meta "1 in 5 fails once (503)" 23 chars, 152px.
   - The box (queue) (200 wide, 72 high): label 15 chars, 117px; sub "not used before May" 19 chars,
     137px; meta "oldest 10,790 s" 15 chars, 99px.
   - Workers (190 wide, 72 high): sub "6 workers, 2 stuck" or "not used before May" 19 chars at
     most, 137px; meta "11,348 sent" 11 chars, 73px.
   - Dead-letter queue (200 wide, 62 high): label 17 chars, 133px; sub "not used before May" 19
     chars, 137px; longest meta "12 thrown away after 3 tries" 28 chars, 185px.
   - Vertical gaps: the top row's bottom y 91 (phones 86), the middle row's top y 174 (83px);
     workers bottom y 246, dead-letter queue top y 309 (63px).
   - Edge labels: "signups" 46px at x 208 between the phones (right x 180) and the web server (left
     x 240); "sync: send" 66px and "top ticket" 66px at x 484 between x 440 and x 530; "queued:
     ticket" 92px centred on x 340 at y 123, between y 91 and y 174; "send" at x 625, y 126;
     "after 3 tries" 86px at x 625, y 268, between y 246 and y 309.

   Catalog note: the case's concept is the catalog's id for s2e13
   (offloading-slow-work-to-a-background-queue).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                               // sim seconds per real second
  var START_CLOCK = 22 * 3600 + 59 * 60 + 50;   // 22:59:50
  var SLOTS = 10;                               // slots a second: one slot is 0.1 s
  var OPENED = 35900;                           // slots from 22:00:00 (the door opens) to 22:59:50
  var RUSH0 = 100;                              // 23:00:00, the late train
  var RUSH1 = 700;                              // 23:01:00, the rush is over
  var COMMA = 108100;                           // 02:00:00, ticket 2035
  var CLOSE = 144100;                           // 03:00:00, the door shuts
  var SKIP1 = 108000;                           // 01:59:50
  var SKIP2 = CLOSE;                            // 03:00:00
  var THREADS = 8;                              // signups the web server works on at once
  var SAVE = 1;                                 // saving a signup: 0.1 s
  var SEND = 15;                                // one email: 1.5 s
  var TRIES = 3;                                // the cap on tries, when there is one
  var JUNE_FAILS = 6854400;                     // 119 days x 57,600 tries a day
  var AGE_ALARM = 6000;                         // 10 minutes
  var WINDOW = 100;                             // the last 10 s
  var BIG_BOX = 1000;
  var EPS = 1e-6;
  var DOT_EVERY = 0.25;                         // real seconds between sample dots
  var DOT_SPEED = 260;                          // viewBox units per real second

  var MODE_OPTS = [
    { value: "queued", label: "Since May: answer 202, queue the email" },
    { value: "sync", label: "Before May: send the email, then answer" }
  ];
  var RATE_OPTS = [
    { value: "100", label: "1 every 10 s (a Saturday)" },
    { value: "10", label: "1 a second (a festival night)" }
  ];
  var WORKER_OPTS = [
    { value: 1, label: "1" },
    { value: 2, label: "2 (Fenna's)" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
    { value: 6, label: "6" }
  ];
  var POLICY_OPTS = [
    { value: "forever", label: "Back on top, forever (Fenna's)" },
    { value: "throw", label: "3 tries, then throw it away" },
    { value: "dlq", label: "3 tries, then the dead-letter queue" }
  ];

  /* ---------- small helpers ---------- */

  // 6000 -> "6,000". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Slot n as a clock time with tenths: slot 15 -> "22:59:51.5".
  function slotClock(n) {
    var tenths = START_CLOCK * SLOTS + n;
    var s = Math.floor(tenths / SLOTS);
    var d = tenths - s * SLOTS;
    s = s % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60) + "." + d;
  }

  // A count of slots as seconds: 8402 -> "840.2", 1 -> "0.1", 600 -> "60".
  function tenthsText(slots) {
    var whole = Math.floor(slots / SLOTS);
    var d = slots - whole * SLOTS;
    return fmt(whole) + (d ? "." + d : "");
  }

  // A rate a second, one decimal at most: 0.6667 -> "0.7", 1 -> "1".
  function perSec(v) {
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function plural(n, one, many) { return n === 1 ? one : many; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function say(api, msg, tone) { if (!api.state.quiet) api.log(msg, tone || ""); }

  function zeroEv() { return { arr: 0, sent: 0, fail: 0, park: 0 }; }

  /* ---------- queues with a moving head (the line and the box) ---------- */

  function newQ() { return { items: [], head: 0 }; }
  function qLen(q) { return q.items.length - q.head; }
  function qFront(q) { return q.head < q.items.length ? q.items[q.head] : null; }
  function qPush(q, x) { q.items.push(x); }
  function qShift(q) {
    var x = q.items[q.head];
    q.items[q.head] = null;
    q.head += 1;
    if (q.head > 4096 && q.head * 2 > q.items.length) {
      q.items = q.items.slice(q.head);
      q.head = 0;
    }
    return x;
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 390,
    aria: "Background queue sim for the Mothlight. Guests' phones send signups to the web server, which works on 8 at once. Before May it sends the welcome email to the email provider before it answers. Since May it answers 202 and drops a ticket in the box, a queue. Workers take the ticket on top and send the email through the provider. With a retry cap, a ticket that fails 3 times goes to the dead-letter queue.",
    nodes: [
      { id: "phones", label: "Guests' phones", sub: "1 every 10 s", x: 100, y: 60, w: 160, h: 52, shape: "box", tone: "" },
      { id: "web", label: "Web server", sub: "0 of 8 threads busy", meta: "answers 202 in 0.1 s", x: 340, y: 60, w: 200, h: 62, shape: "box", tone: "" },
      { id: "provider", label: "Email provider", sub: "1.5 s per email", meta: "up", x: 625, y: 60, w: 190, h: 62, shape: "box", tone: "" },
      { id: "box", label: "The box (queue)", sub: "0 waiting", meta: "empty", x: 340, y: 210, w: 200, h: 72, shape: "box", tone: "ok" },
      { id: "workers", label: "Workers", sub: "2 workers, 1 stuck", meta: "0 sent", x: 625, y: 210, w: 190, h: 72, shape: "box", tone: "" },
      { id: "dlq", label: "Dead-letter queue", sub: "off", meta: "failures go back on top", x: 625, y: 340, w: 200, h: 62, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "phones", to: "web", label: "signups" },
      { from: "web", to: "provider", label: "sync: send", dash: true, tone: "muted" },
      { from: "web", to: "box", label: "queued: ticket" },
      { from: "box", to: "workers", label: "top ticket" },
      { from: "workers", to: "provider", label: "send" },
      { from: "workers", to: "dlq", label: "after 3 tries", dash: true }
    ]
  };

  /* ---------- reading the night's state (never changes it) ---------- */

  function ticketName(job) { return "#" + job.t + (job.june ? " (13 June)" : ""); }

  function oldestSec(S) {
    var f = qFront(S.box);
    return f ? Math.floor((S.n - f.arr) / SLOTS) : 0;
  }

  function stuckCount(S) {
    var c = 0;
    for (var w = 0; w < S.wk.length; w++) if (S.wk[w] && S.wk[w].job.fails >= TRIES) c++;
    return c;
  }

  function allStuck(S) {
    for (var w = 0; w < S.wk.length; w++) if (!S.wk[w] || S.wk[w].job.fails < TRIES) return false;
    return S.wk.length > 0;
  }

  function busyThreads(S) {
    var c = 0;
    for (var i = 0; i < THREADS; i++) if (S.thr[i]) c++;
    return c;
  }

  // Nearest-rank p95 of the response times answered in the last 100 slots, in slots.
  function p95Slots(S) {
    var all = [];
    for (var i = 0; i < WINDOW; i++) {
      var a = S.resp[i];
      for (var j = 0; j < a.length; j++) all.push(a[j]);
    }
    if (!all.length) return null;
    all.sort(function (x, y) { return x - y; });
    return all[Math.ceil(95 * all.length / 100) - 1];
  }

  function busyPct(S) {
    var s = 0;
    for (var i = 0; i < WINDOW; i++) s += S.busy[i];
    return Math.round(s / THREADS);
  }

  function policyText(S) {
    if (S.policy === "dlq") return "A ticket gets 3 tries, then it goes to the dead-letter queue.";
    if (S.policy === "throw") return "A ticket gets 3 tries, then it's thrown away.";
    return "A failed ticket goes back on top of the box, forever.";
  }

  /* ---------- one slot: answers, sends, a signup, threads, workers ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    var queued = S.mode === "queued";
    var ri = n % WINDOW;
    var rts = S.resp[ri];
    rts.length = 0;
    var i, w;

    // 1. Threads whose work ends this slot answer their guests.
    for (i = 0; i < THREADS; i++) {
      var th = S.thr[i];
      if (!th || th.done !== n) continue;
      var r = th.r;
      var rt = n - r.arr;
      if (!queued && r.poison && !S.syncErrLogged) {
        S.syncErrLogged = true;
        say(api, slotClock(n) + ": #" + r.t + "'s email failed twice (" + r.why + "), so after " + tenthsText(rt) +
          " s the web server answers with an error. The guest is still at the door and can fix the address.", "warn");
      }
      S.thr[i] = null;
      rts.push(rt);
      if (rt > S.maxResp) S.maxResp = rt;
      if (queued) {
        qPush(S.box, { t: r.t, arr: r.arr, june: false, poison: r.poison, why: r.why, ff: r.ff, fails: 0, rushLast: r.rushLast, logged: false });
      } else if (r.poison) {
        S.errors += 1;
      } else {
        S.sent += 1;
      }
    }

    // 2. Workers whose try ends this slot: sent, or failed and handled by the retry rule.
    for (w = 0; w < S.wk.length; w++) {
      var held = S.wk[w];
      if (!held || held.done !== n) continue;
      var job = held.job;
      var failed = job.poison || (job.ff && job.fails === 0);
      if (!failed) {
        if (job.rushLast) {
          say(api, "Ticket #" + job.t + ", the last guest off the late train, gets the welcome email at " + slotClock(n) + ", " +
            tenthsText(n - job.arr) + " s after signing up.", "");
        }
        S.wk[w] = null;
        S.sent += 1;
        S.ev.sent += 1;
        continue;
      }
      var tries = job.fails + 1;                    // this failure, counted before the ticket changes
      var retry = S.policy === "forever" || tries < TRIES;
      tellFailure(api, w, job, tries, retry, n);
      job.fails = tries;
      S.ev.fail += 1;
      if (retry) {
        S.retried += 1;
        S.wk[w] = { done: n + SEND, job: job };
      } else {
        S.wk[w] = null;
        if (S.policy === "dlq") S.dlq.push(job);
        else S.thrown += 1;
        S.ev.park += 1;
      }
    }

    // 3. A guest signs up: one every 10 s (or 1 s), one a slot in the rush, none after 03:00.
    if (n < CLOSE && ((S.rush && n >= RUSH0 && n < RUSH1) || n % S.P === 0)) {
      var t = S.tick + 1;
      var bad = n === COMMA ? 1 : S.mistype ? 2 : 0;
      if (n === RUSH0 && S.rush) {
        say(api, "23:00:00, the late train is in: 600 guests will sign up in the next minute, 10 a second. " +
          (queued ? "Each is answered in 0.1 s, and the emails go in the box." : "The server can finish 5 a second."), "warn");
      }
      if (bad) {
        say(api, slotClock(n) + ": ticket #" + t + " signs up with " + (bad === 1 ? "a comma where the dot goes" : "a typo") +
          " in the email address.", "warn");
      }
      S.tick = t;
      S.mistype = false;
      qPush(S.line, {
        t: t, arr: n, poison: bad > 0,
        why: bad === 1 ? "the address has a comma where the dot goes" : bad === 2 ? "the address has a typo" : null,
        ff: S.provider && t % 5 === 0,
        rushLast: S.rush && n === RUSH1 - 1
      });
      S.ev.arr += 1;
    }

    // 4. Free threads take the next guests in line.
    var busy = 0;
    for (i = 0; i < THREADS; i++) {
      if (!S.thr[i] && qLen(S.line) > 0) {
        var rq = qShift(S.line);
        var d = queued ? SAVE : SAVE + SEND * (rq.poison || rq.ff ? 2 : 1);
        S.thr[i] = { done: n + d, r: rq };
      }
      if (S.thr[i]) busy += 1;
    }
    S.busy[ri] = busy;
    if (busy === THREADS && !S.fullLogged) {
      S.fullLogged = true;
      say(api, slotClock(n) + ": all 8 threads are busy" +
        (queued ? "." : " sending emails. New signups wait in line for a thread."), "bad");
    }

    // 5. Free workers take the ticket on top of the box.
    if (queued) {
      for (w = 0; w < S.wk.length; w++) {
        if (!S.wk[w] && qLen(S.box) > 0) S.wk[w] = { done: n + SEND, job: qShift(S.box) };
      }
    }

    S.n = n + 1;
    afterSlot(api, n);
  }

  // Called before the failed ticket's count or place changes, so it reports what just happened.
  function tellFailure(api, w, job, tries, retry, n) {
    var S = api.state;
    var who = "Worker-" + (w + 1);
    var name = ticketName(job);
    var when = slotClock(n);
    if (!job.poison) {
      if (!S.blipLogged) {
        S.blipLogged = true;
        say(api, who + ": " + name + " failed at " + when + " with a 503: the provider is having a bad night. Back on top of the box, and the same worker tries it again at once.", "warn");
      }
      return;
    }
    if (retry) {
      if (job.logged) return;
      job.logged = true;
      say(api, who + ": " + name + " failed at " + when + ": " + job.why + ". Back on top of the box, and the same worker takes it again at once." +
        (job.june ? " That's " + fmt(tries) + " failed tries since June." : ""), "bad");
      return;
    }
    say(api, who + ": " + name + " failed at " + when + ", try " + fmt(tries) + ": " + job.why + ". That's 3 or more, so it " +
      (S.policy === "dlq" ? "goes to the dead-letter queue" : "is thrown away") + ", and the worker takes the next ticket.",
      S.policy === "dlq" ? "warn" : "bad");
  }

  // The night's state at the end of slot n, which is the clock time of slot n + 1.
  function afterSlot(api, n) {
    var S = api.state;
    var now = S.n;
    var queued = S.mode === "queued";
    var depth = qLen(S.box);
    var front = qFront(S.box);

    if (queued && depth > 0 && S.rush && n >= RUSH0) S.backlog = true;

    if (queued && front && !S.ageLogged && now - front.arr >= AGE_ALARM) {
      S.ageLogged = true;
      say(api, slotClock(now) + ": ticket #" + front.t + " has waited 10 minutes in the box. An alarm on the oldest ticket's age, set at 10 minutes, would ring now.", "warn");
    }

    if (queued && S.backlog && depth === 0 && n >= RUSH1 && !S.emptyLogged) {
      S.emptyLogged = true;
      say(api, "The box is empty again at " + slotClock(n) + ": the rush's backlog is cleared.", "ok");
    }

    if (!queued && S.rush && n >= RUSH1 && S.fullLogged && qLen(S.line) === 0 && !S.lineLogged) {
      S.lineLogged = true;
      say(api, "The line is empty again at " + slotClock(n) + ": every guest from the rush has a thread.", "ok");
    }

    if (now === RUSH1 && S.rush) {
      if (queued) {
        say(api, "23:01:00, the rush is over. The slowest answer took " + tenthsText(S.maxResp) + " s. " +
          (depth ? "The box holds " + fmt(depth) + plural(depth, " ticket", " tickets") + ", and the oldest has waited " + fmt(oldestSec(S)) + " s." : "The box is empty."),
          depth ? "warn" : "ok");
      } else {
        say(api, "23:01:00, the rush is over. The slowest answer took " + tenthsText(S.maxResp) + " s, and " + fmt(qLen(S.line)) +
          " guests are still in line for a thread.", "bad");
      }
    }

    if (now === CLOSE) {
      if (queued) {
        say(api, "03:00:00, the door shuts. The box holds " + fmt(depth) + plural(depth, " ticket", " tickets") +
          (depth ? ", and the oldest has waited " + fmt(oldestSec(S)) + " s." : "."), depth ? "warn" : "ok");
      } else {
        say(api, "03:00:00, the door shuts. " + fmt(qLen(S.line)) + " guests are in line.", "");
      }
    }

    if (queued && S.policy === "forever" && !S.stuckLogged && allStuck(S)) {
      S.stuckLogged = true;
      say(api, slotClock(n) + ": every worker is retrying a ticket that has failed 3 or more times. Nothing else will leave the box until someone steps in.", "bad");
    }

    if (queued && depth >= BIG_BOX && !S.bigLogged) {
      S.bigLogged = true;
      var arriving = SLOTS / S.P;
      var draining = (S.wk.length - stuckCount(S)) * SLOTS / SEND;
      say(api, slotClock(now) + ": " + fmt(BIG_BOX) + " tickets in the box. Guests arrive at " + perSec(arriving) +
        " a second and the workers still sending manage " + perSec(draining) + " a second, " +
        (arriving > draining ? "so the box will keep growing until the door shuts." : "so it will drain, slowly."), "bad");
    }
  }

  /* ---------- the night ---------- */

  function startNight(api, why) {
    var S = api.state;
    var i;
    S.t = 0;
    S.n = 0;
    api.clock = START_CLOCK;
    S.P = Number(S.rate);
    S.tick = OPENED / S.P;                        // tickets that signed up from 22:00 to 22:59:40
    S.line = newQ();
    S.box = newQ();
    S.thr = [];
    for (i = 0; i < THREADS; i++) S.thr.push(null);
    S.wk = [];
    for (i = 0; i < S.workers; i++) S.wk.push(null);
    if (S.mode === "queued") {
      S.wk[0] = {
        done: SEND,
        job: { t: 413, arr: null, june: true, poison: true, why: "\"back for my coat\" is not an email address", ff: false, fails: JUNE_FAILS, rushLast: false, logged: false }
      };
    }
    S.dlq = [];
    S.thrown = 0;
    S.retried = 0;
    S.sent = 0;
    S.errors = 0;
    S.maxResp = 0;
    S.resp = [];
    S.busy = [];
    for (i = 0; i < WINDOW; i++) { S.resp.push([]); S.busy.push(0); }
    S.mistype = false;
    S.backlog = false;
    S.ageLogged = false;
    S.emptyLogged = false;
    S.lineLogged = false;
    S.fullLogged = false;
    S.stuckLogged = false;
    S.bigLogged = false;
    S.blipLogged = false;
    S.syncErrLogged = false;
    S.quiet = false;
    S.ev = zeroEv();
    S.dotClock = 0;

    var head = (why ? why + " " : "") + "22:59:50, Saturday at the Mothlight. ";
    if (S.mode === "queued") {
      head += "Since May: the web server saves each signup, drops a ticket in the box and answers 202 at once. " +
        S.workers + plural(S.workers, " worker sends", " workers send") + " the emails, 1.5 s each. Worker-1 is on June's ticket #413 again: " +
        fmt(JUNE_FAILS) + " failed tries so far. " + policyText(S);
    } else {
      head += "Before May: the web server saves each signup and sends the welcome email before it answers, 1.6 s a signup, 8 at once: 5 a second at most.";
    }
    if (S.P === 10) head += " A festival night: a guest a second.";
    if (!S.rush) head += " No late train tonight.";
    if (S.provider) head += " The provider is having a bad night: every fifth email fails its first try.";
    say(api, head, "");
    draw(api);
  }

  function replay(api, what) { startNight(api, what + " The night replays from 22:59:50."); }

  /* ---------- controls ---------- */

  function setMode(api, v) {
    var o = pick(MODE_OPTS, v);
    if (!o) return;
    api.state.mode = String(o.value);
    replay(api, o.value === "sync" ? "Before May: the server sends the email, then answers." : "Since May: the server answers 202 and puts the email in the box.");
  }

  function setRate(api, v) {
    var o = pick(RATE_OPTS, v);
    if (!o) return;
    api.state.rate = String(o.value);
    replay(api, o.value === "10" ? "A festival night: a guest a second outside the rush." : "A Saturday: a guest every 10 seconds outside the rush.");
  }

  function setRush(api, on) {
    api.state.rush = !!on;
    replay(api, on ? "The late train arrives at 23:00." : "No late train tonight.");
  }

  function setWorkers(api, v) {
    var o = pick(WORKER_OPTS, v);
    if (!o) return;
    api.state.workers = Number(o.value);
    replay(api, o.value + plural(Number(o.value), " worker.", " workers."));
  }

  function setProvider(api, on) {
    api.state.provider = !!on;
    replay(api, on ? "The provider has a bad night: every fifth email fails its first try with a 503." : "The provider is fine tonight.");
  }

  function setPolicy(api, v) {
    var o = pick(POLICY_OPTS, v);
    if (!o) return;
    api.state.policy = String(o.value);
    replay(api, "New retry rule. " + policyText(api.state));
  }

  function mistype(api) {
    api.state.mistype = true;
    say(api, "The next guest to sign up will mistype the email address.", "");
  }

  function summary(S) {
    if (S.mode !== "queued") {
      return "Since 22:59:50: " + fmt(S.sent) + " emails sent, " + fmt(S.errors) + " signups answered with an error, " +
        fmt(qLen(S.line)) + " guests in line.";
    }
    var depth = qLen(S.box);
    var s = "Since 22:59:50: " + fmt(S.sent) + " emails sent and " + fmt(S.retried) + " retries. The box holds " + fmt(depth) +
      plural(depth, " ticket", " tickets") + (depth ? ", and the oldest has waited " + fmt(oldestSec(S)) + " s." : ".");
    var st = stuckCount(S);
    if (st) s += " " + st + plural(st, " ticket has", " tickets have") + " failed 3 or more times and " + plural(st, "is", "are") + " still being tried.";
    if (S.n >= CLOSE) s += " The door is shut.";
    return s;
  }

  function skip(api, target, label) {
    var S = api.state;
    if (S.n >= target) return;
    S.quiet = true;
    var guard = 0;
    while (S.n < target && guard < 250000) { slot(api); guard += 1; }
    S.quiet = false;
    S.t = S.n / SLOTS;
    api.clock = START_CLOCK + S.t;
    S.ev = zeroEv();
    say(api, "Skipped to " + label + ". " + summary(S), "");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var queued = S.mode === "queued";
    var depth = qLen(S.box);
    var oldest = oldestSec(S);
    var stuck = stuckCount(S);
    var busyNow = busyThreads(S);
    var last = S.n - 1;
    var inRush = S.rush && last >= RUSH0 && last < RUSH1;

    var ph = api.node("phones");
    ph.text("sub", S.n >= CLOSE ? "door shut" : inRush ? "10 signups/s" : S.P === 10 ? "1 a second" : "1 every 10 s");
    ph.set(inRush ? "warn" : S.n >= CLOSE ? "muted" : "");

    var web = api.node("web");
    web.text("sub", busyNow + " of 8 threads busy");
    web.text("meta", queued ? "answers 202 in 0.1 s" : fmt(qLen(S.line)) + " waiting for a thread");
    web.set(!queued && busyNow === THREADS ? "bad" : "");

    var pv = api.node("provider");
    pv.text("sub", "1.5 s per email");
    pv.text("meta", S.provider ? "1 in 5 fails once (503)" : "up");
    pv.set(S.provider ? "warn" : "");

    var bx = api.node("box");
    var wn = api.node("workers");
    var dq = api.node("dlq");
    if (queued) {
      bx.text("sub", fmt(depth) + " waiting");
      bx.text("meta", depth ? "oldest " + fmt(oldest) + " s" : "empty");
      bx.set(depth === 0 ? "ok" : oldest >= AGE_ALARM / SLOTS ? "bad" : "warn");

      var W = S.wk.length;
      wn.text("sub", W + plural(W, " worker, ", " workers, ") + stuck + " stuck");
      wn.text("meta", fmt(S.sent) + " sent");
      wn.set(stuck === W ? "bad" : stuck ? "warn" : "ok");

      if (S.policy === "forever") {
        dq.text("sub", "off");
        dq.text("meta", "failures go back on top");
        dq.set("muted");
      } else if (S.policy === "throw") {
        dq.text("sub", "off");
        dq.text("meta", fmt(S.thrown) + " thrown away after 3 tries");
        dq.set(S.thrown ? "bad" : "muted");
      } else {
        var nd = S.dlq.length;
        dq.text("sub", fmt(nd) + " parked");
        dq.text("meta", nd ? "last: " + ticketName(S.dlq[nd - 1]) : "empty");
        dq.set(nd ? "warn" : "ok");
      }
    } else {
      bx.text("sub", "not used before May");
      bx.text("meta", "");
      bx.set("muted");
      wn.text("sub", "not used before May");
      wn.text("meta", "");
      wn.set("muted");
      dq.text("sub", "not used before May");
      dq.text("meta", "");
      dq.set("muted");
    }

    var p = p95Slots(S);
    S.stat.p95(p === null ? "-" : (p / SLOTS).toFixed(1));
    S.stat.busy(String(busyPct(S)));
    S.stat.depth(queued ? String(depth) : "-");
    S.stat.oldest(queued ? String(oldest) : "-");
    S.stat.retried(queued ? String(S.retried) : "-");
    S.stat.dlq(queued ? String(S.dlq.length) : "-");
    S.stat.stuck(queued ? String(stuck) : "-");

    S.ctl.skip1.disable(S.n >= SKIP1);
    S.ctl.skip2.disable(S.n >= SKIP2);
    S.ctl.workers.disable(!queued);
    S.ctl.policy.disable(!queued);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion) { S.ev = zeroEv(); return; }
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    var ev = S.ev;
    S.ev = zeroEv();
    var queued = S.mode === "queued";
    if (ev.arr) {
      var waiting = !queued && qLen(S.line) > 0;
      api.dot({ path: queued ? ["phones", "web", "box"] : ["phones", "web", "provider"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === "web" && waiting) dot.cls("dot-wait"); } });
    }
    if (!queued) return;
    if (ev.sent) api.dot({ path: ["workers", "provider"], cls: "dot-ok", r: 4, speed: DOT_SPEED });
    if (ev.fail) {
      api.dot({ path: ["workers", "provider", "workers"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === "provider") dot.cls("dot-fail"); } });
    }
    if (ev.park) api.dot({ path: ["workers", "dlq"], cls: "dot-fail", r: 4, speed: DOT_SPEED });
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.thr) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t * SLOTS + EPS);
    var guard = 0;
    while (S.n < due && guard < 5000) { slot(api); guard += 1; }
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    phones: function () {
      return "<strong>Guests' phones.</strong> Each guest scans the code by the door and signs up with a name and an email address. From 22:00 one arrives every 10 seconds (one a second on a festival night). At 23:00 the late train brings 600 in a minute, 10 a second. The door shuts at 03:00. A guest goes in once the phone shows the server's answer.";
    },
    web: function (S) {
      return "<strong>Web server.</strong> Works on 8 signups at once, one per thread; the rest wait in line. Before May: save (0.1 s), send the welcome email (1.5 s), then answer: 1.6 s a signup, 5 a second at most. If the send fails it tries once more, and if that fails too it answers with an error. Since May: save, drop a ticket in the box and answer 202 Accepted with the ticket number, 0.1 s. " +
        "Right now " + busyThreads(S) + " of 8 threads are busy" + (S.mode === "sync" ? " and " + fmt(qLen(S.line)) + " guests are waiting for one." : ".");
    },
    provider: function (S) {
      return "<strong>Email provider.</strong> Sends each email in 1.5 seconds. It rejects an address that isn't one, every time. " +
        (S.provider ? "Tonight it's having a bad night: every fifth email fails its first try with a 503 and goes through on the second." : "Tonight it's fine.");
    },
    box: function (S) {
      return "<strong>The box.</strong> Fenna's queue. Tickets wait in the order they went in, and a free worker takes the one on top. Depth is how many are waiting. The oldest ticket's age is how long the one on top has waited since its guest signed up. A ticket a worker is trying isn't counted in either." +
        (S.mode === "queued" ? " Right now: " + fmt(qLen(S.box)) + " waiting." : " Before May there was no box.");
    },
    workers: function (S) {
      return "<strong>Workers.</strong> Each takes the ticket on top of the box and sends its email, 1.5 seconds a try. Worker-1 starts the night on June's ticket 413. When a send fails, the retry rule decides: back on top, where the same worker takes it again at once, or after 3 tries, thrown away or moved to the dead-letter queue. " +
        (S.mode === "queued" ? "Right now " + stuckCount(S) + " of " + S.wk.length + " are stuck on tickets that have failed 3 or more times." : "Before May there were none.");
    },
    dlq: function (S) {
      return "<strong>Dead-letter queue.</strong> A separate queue for tickets that failed 3 tries. Nothing sends them: they wait for a person to read them, fix the cause and send them again. An alarm on it would ring at the first ticket. " +
        (S.policy === "dlq" ? "It's on, holding " + fmt(S.dlq.length) + "." : "It's off: pick 3 tries, then the dead-letter queue.");
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e13", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.mode = "queued";
      S.rate = "100";
      S.rush = true;
      S.workers = 2;
      S.provider = false;
      S.policy = "forever";
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "The signup request", MODE_OPTS, "queued", function (v) { setMode(api, v); });
      S.ctl.rate = api.control.select("rate", "Guests outside the rush", RATE_OPTS, "100", function (v) { setRate(api, v); });
      S.ctl.rush = api.control.toggle("rush", "The late train at 23:00 (600 guests in a minute)", true, function (on) { setRush(api, on); });
      S.ctl.workers = api.control.select("workers", "Workers", WORKER_OPTS, 2, function (v) { setWorkers(api, v); });
      S.ctl.provider = api.control.toggle("provider", "Provider's bad night: 1 email in 5 fails its first try (503)", false, function (on) { setProvider(api, on); });
      S.ctl.policy = api.control.select("policy", "When a send fails", POLICY_OPTS, "forever", function (v) { setPolicy(api, v); });
      S.ctl.mistype = api.control.button("mistype", "Next guest mistypes the email", function () { mistype(api); });
      S.ctl.skip1 = api.control.button("skip1", "Skip to 01:59:50", function () { skip(api, SKIP1, "01:59:50"); });
      S.ctl.skip2 = api.control.button("skip2", "Skip to 03:00", function () { skip(api, SKIP2, "03:00:00"); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        p95: api.stat("p95", "p95 response time, last 10 s (seconds)", ""),
        busy: api.stat("busy", "web server threads busy, last 10 s (%)", ""),
        depth: api.stat("depth", "tickets waiting in the box", "warn"),
        oldest: api.stat("oldest", "oldest waiting ticket (seconds)", "warn"),
        retried: api.stat("retried", "retries since 22:59:50", ""),
        dlq: api.stat("dlq", "tickets in the dead-letter queue", ""),
        stuck: api.stat("stuck", "tickets failed 3+ times, still being tried", "bad")
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
      function s(id) { return t.stat(id); }
      function has(text) { return t.logText().indexOf(text) >= 0; }
      var a, b;

      // 1. Fenna's Saturday: queued, 2 workers, a failed ticket back on top forever.
      await t.run(7);                                   // slots 0-699: up to 23:01:00
      t.expect(s("p95") === 0.1 && s("busy") === 13 && s("depth") === 559 && s("oldest") === 56 &&
        s("retried") === 46 && s("stuck") === 1 && s("dlq") === 0,
        "Saturday at 23:01: every answer in 0.1 s, 13% of threads busy, 559 tickets waiting, the oldest 56 s, 46 retries of #413");
      t.expect(has("Worker-1: #413 (13 June) failed at 22:59:51.5: \"back for my coat\" is not an email address. Back on top of the box, and the same worker takes it again at once. That's 6,854,401 failed tries since June."),
        "#413 fails at 22:59:51.5 for the 6,854,401st time and goes back on top");
      t.expect(has("23:01:00, the rush is over. The slowest answer took 0.1 s. The box holds 559 tickets, and the oldest has waited 56 s.") &&
        t.node("workers").text.sub === "2 workers, 1 stuck" && t.node("box").text.meta === "oldest 56 s",
        "At 23:01 the box holds 559 tickets and one of two workers is stuck on #413");
      await t.run(99);                                  // slots 700-10599: up to 23:17:30
      t.expect(has("23:10:42.9: ticket #790 has waited 10 minutes in the box.") &&
        has("Ticket #960, the last guest off the late train, gets the welcome email at 23:15:00.1, 840.2 s after signing up.") &&
        has("The box is empty again at 23:17:27.1"),
        "One worker sending: the oldest ticket passes 10 minutes at 23:10:42.9, ticket 960 waits 840.2 s, the box empties at 23:17:27.1");
      t.expect(s("depth") === 0 && s("stuck") === 1, "After the rush the box drains, with #413 still looping");
      t.click("skip1");                                 // slot 108000: 01:59:50
      t.expect(s("depth") === 0 && s("retried") === 7199 &&
        has("Skipped to 01:59:50. Since 22:59:50: 1,674 emails sent and 7,199 retries. The box holds 0 tickets."),
        "By 01:59:50: 1,674 emails sent, 7,199 retries, nothing waiting");
      await t.run(2);                                   // slots 108000-108199: up to 02:00:10
      t.expect(has("02:00:00.0: ticket #2035 signs up with a comma where the dot goes in the email address.") &&
        has("Worker-2: #2035 failed at 02:00:01.6: the address has a comma where the dot goes. Back on top of the box") &&
        has("02:00:04.6: every worker is retrying a ticket that has failed 3 or more times."),
        "Ticket 2035 signs up at 02:00:00, fails at 02:00:01.6, and from 02:00:04.6 both workers are stuck");
      t.expect(s("stuck") === 2 && s("retried") === 7219 && t.node("workers").text.sub === "2 workers, 2 stuck",
        "At 02:00:10: 2 stuck tickets and 7,219 retries");
      t.click("skip2");                                 // slot 144100: 03:00:00
      t.expect(s("depth") === 359 && s("oldest") === 3590 && s("retried") === 12005 && s("stuck") === 2 &&
        t.node("box").text.meta === "oldest 3,590 s" &&
        has("Skipped to 03:00:00. Since 22:59:50: 1,675 emails sent and 12,005 retries. The box holds 359 tickets, and the oldest has waited 3,590 s."),
        "At 03:00 the box holds 359 tickets, the oldest 3,590 s, and nothing has been sent since 02:00");

      // 2. 3 tries, then the dead-letter queue.
      t.click("reset");
      t.set("policy", "dlq");
      await t.run(7);                                   // up to 23:01:00
      t.expect(s("depth") === 519 && s("oldest") === 52 && s("dlq") === 1 && s("retried") === 0 && s("stuck") === 0,
        "DLQ: #413 parked, both workers sending: 519 waiting at 23:01, the oldest 52 s");
      t.expect(has("Worker-1: #413 (13 June) failed at 22:59:51.5, try 6,854,401: \"back for my coat\" is not an email address. That's 3 or more, so it goes to the dead-letter queue, and the worker takes the next ticket."),
        "DLQ: #413 is parked at 22:59:51.5 on try 6,854,401");
      await t.run(43);                                  // up to 23:08:10
      t.expect(has("gets the welcome email at 23:07:30.2, 390.3 s after signing up.") && has("The box is empty again at 23:08:01.6") &&
        !has("has waited 10 minutes"),
        "DLQ: ticket 960 sent at 23:07:30.2, box empty at 23:08:01.6, and no ticket waits 10 minutes");
      t.click("skip1");
      await t.run(2);                                   // up to 02:00:10
      t.expect(s("dlq") === 2 && s("retried") === 2 && s("stuck") === 0 && s("depth") === 0 &&
        t.node("dlq").text.sub === "2 parked" && t.node("dlq").text.meta === "last: #2035" &&
        has("Worker-1: #2035 failed at 02:00:04.6, try 3: the address has a comma where the dot goes. That's 3 or more, so it goes to the dead-letter queue"),
        "DLQ: #2035 is parked at 02:00:04.6 after 3 tries, with 2 retries");
      t.click("skip2");
      t.expect(s("depth") === 0 && s("dlq") === 2 && t.node("workers").text.meta === "2,034 sent",
        "DLQ: at 03:00 nothing waits and 2,034 emails have gone out");

      // 3. 3 tries, then throw it away.
      t.click("reset");
      t.set("policy", "throw");
      await t.run(2);                                   // up to 23:00:10
      t.expect(s("dlq") === 0 && s("stuck") === 0 && t.node("dlq").text.meta === "1 thrown away after 3 tries" &&
        has("so it is thrown away, and the worker takes the next ticket."),
        "Throw away: #413 goes in the bin and leaves no trace in a queue");

      // 4. Before May: send the email inside the request.
      t.click("reset");
      t.set("mode", "sync");
      await t.run(7);                                   // up to 23:01:00
      t.expect(s("p95") === 30.4 && s("busy") === 100 && s("depth") === "-" && t.node("web").text.meta === "296 waiting for a thread" &&
        has("23:00:00.7: all 8 threads are busy sending emails.") &&
        has("23:01:00, the rush is over. The slowest answer took 30.4 s, and 296 guests are still in line for a thread."),
        "Before May: all 8 threads busy at 23:00:00.7, p95 30.4 s and 296 in line at 23:01");
      await t.run(7);                                   // up to 23:02:10
      t.expect(s("p95") === 61.6 && has("The line is empty again at 23:02:00.6"),
        "Before May: the line clears at 23:02:00.6 and the p95 reaches 61.6 s");
      await t.run(1);                                   // up to 23:02:20
      t.expect(s("p95") === 1.6, "Before May: after the rush every signup takes 1.6 s again");
      t.click("skip1");
      await t.run(2);                                   // up to 02:00:10
      t.expect(s("p95") === 3.1 && has("02:00:03.1: #2035's email failed twice (the address has a comma where the dot goes), so after 3.1 s the web server answers with an error."),
        "Before May: the bad address is answered with an error after 3.1 s, while the guest is at the door");

      // 5. Six workers, still retrying forever.
      t.click("reset");
      t.set("workers", 6);
      await t.run(7);                                   // up to 23:01:00
      t.expect(s("depth") === 399, "Six workers: 399 waiting at 23:01");
      await t.run(13);                                  // up to 23:03:10
      t.expect(has("at 23:03:00.5, 120.6 s after signing up.") && has("The box is empty again at 23:03:03.3"),
        "Six workers: ticket 960 sent at 23:03:00.5 and the box empty at 23:03:03.3");
      t.click("skip2");
      t.expect(s("depth") === 0 && s("stuck") === 2 && s("retried") === 12005 && t.node("workers").text.sub === "6 workers, 2 stuck",
        "Six workers: the box keeps up, but 2 of 6 workers loop all night");

      // 6. Too few workers: a festival night with one worker grows without bound.
      t.click("reset");
      t.set("rate", "10");
      t.set("workers", 1);
      t.set("policy", "dlq");
      await t.run(7);                                   // up to 23:01:00
      a = s("depth");
      await t.run(54);                                  // up to 23:10:00
      b = s("depth");
      t.expect(a === 563 && b === 744 && s("oldest") === 560,
        "Festival, one worker: 563 waiting at 23:01 and 744 at 23:10, the oldest 560 s");
      await t.run(77);                                  // up to 23:22:50
      t.expect(has("23:22:45.2: 1,000 tickets in the box. Guests arrive at 1 a second and the workers still sending manage 0.7 a second, so the box will keep growing until the door shuts."),
        "Festival, one worker: 1,000 waiting at 23:22:45.2, arrivals faster than the drain rate");
      t.click("skip2");
      t.expect(s("depth") === 5344 && s("oldest") === 5344, "Festival, one worker: 5,344 waiting at 03:00");

      // 7. The same festival night with two workers drains.
      t.click("reset");
      t.set("rate", "10");
      t.set("policy", "dlq");
      await t.run(61);                                  // up to 23:10:00
      t.expect(s("depth") === 340 && s("oldest") === 340, "Festival, two workers: down to 340 waiting by 23:10");

      // 8. The provider's bad night.
      t.click("reset");
      t.click("provider");
      t.set("policy", "dlq");
      await t.run(7);                                   // up to 23:01:00
      t.expect(s("depth") === 532 && s("retried") === 14 && s("dlq") === 1 &&
        has("Worker-2: #360 failed at 22:59:51.6 with a 503"),
        "Bad night: one email in five retried once, 14 retries and 532 waiting at 23:01, none parked but #413");

      // 9. A guest mistypes the address.
      t.click("reset");
      t.click("mistype");
      await t.run(1);                                   // up to 23:00:00
      t.expect(s("stuck") === 2 && has("22:59:50.0: ticket #360 signs up with a typo in the email address.") &&
        has("22:59:54.6: every worker is retrying a ticket that has failed 3 or more times."),
        "Forever: one typo and both workers are stuck from 22:59:54.6");
      t.click("reset");
      t.set("policy", "dlq");
      t.click("mistype");
      await t.run(1);                                   // up to 23:00:00
      t.expect(s("dlq") === 2 && s("stuck") === 0 && s("retried") === 2 && has("Worker-2: #360 failed at 22:59:54.6, try 3"),
        "DLQ: the typo is parked at 22:59:54.6 after 3 tries");

      // 10. No late train.
      t.click("reset");
      t.click("rush");
      await t.run(7);                                   // up to 23:01:00
      t.expect(s("depth") === 0 && s("p95") === 0.1 && s("busy") === 0 && s("retried") === 46,
        "No late train: nothing waits; only #413 keeps failing");
    }
  });
})();
