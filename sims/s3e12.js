/* sims/s3e12-v1.0.0.js  (published as sims/s3e12.js)
   Case s3e12 "The Warehouse Out Back": a storage lab for Prothero Self Storage. Tenants' photos
   and videos live as objects in a bucket (prothero-units); leases and shares live in the app's
   database. The learner picks how share links work (presigned links to the files, as now, or a
   link to the app's gallery page, which checks the database and then signs), how long a signed
   link lives, public bucket on or off, deleting a unit's files when its lease ends, proxy mode
   (every file through the app server), multipart upload on or off with its part size, and the
   transcode pipeline (storage event, queue, HLS variant streams).

   CHANGELOG
   v1.0.0 (2026-10-11) first version: a replay from Tue 22 Sep 23:00 to Thu 01 Oct 01:00, one sim
     hour per real second, driven by a fixed list of events (no random numbers; api.rand() is not
     used). Controls: share links, link lifetime, public bucket, delete at lease end, proxy mode,
     multipart upload, part size, transcode pipeline, skip 1 day, skip to the end, reset. Stats:
     opens that should have been refused, rightful opens refused, time the shared C-14 link
     worked, how long a copied file link works, tenant files deleted, MiB thrown away (upload),
     app server MiB in the busiest hour, server line use in the busiest hour, HLS variant streams
     produced. selfTest: 15 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e12-v1.0.0.json):
   - post: Mrs Anwen Kittredge's lease on C-14 ended at midnight on Tuesday 22 September (Wed 23
     Sep 00:00). The crew cleared C-14 at 10:00 on Wednesday and it was let to Mr Haskard at
     16:00. At Thu 24 Sep 00:00, a day after her lease ended, she opened the app (which checks the
     login, not the lease) and shared her C-14 album, 40 files (38 photos and 2 videos), in her
     family chat. The link was signed for 7 days, the longest the provider allows, so it expired
     at Thu 01 Oct 00:00: eight days after the lease ended, and it worked for the 7 days (168 h)
     before that. Ifor's access log: 12 opens, all 200 OK, from Thu 24 Sep 00:02 to Wed 30 Sep
     23:40 (the grandson at the gate), then Thu 01 Oct 00:20 (outside C-14): 403 Forbidden.
     Mr Haskard's video, Wed 23 Sep 21:00: 612 MiB, 4 min 16 s; it failed at 551 MiB (90%) and
     started from zero, four times (the log's 21:38 line is attempt 4).
   - comments (OP replies): the app signs with a long-lived access key of an IAM user, so the 7
     days hold; the yard's signal holds for about 551 MiB at Mr Haskard's 1 MiB a second (551 s),
     then drops for about 30 s; Ms Senna Quist (A-03) shared her album with a removal man on Thu
     24 Sep 18:00, he opened it at 19:30, she withdrew the share in the app on Fri 25 Sep 12:00,
     and he opened it again at Sat 26 Sep 02:10 and Mon 28 Sep 03:30; the busiest hour is about
     400 gallery opens of about 120 MiB each, and the app server has a 100 Mbps line; Ifor's HLS
     plan: 4 variant streams (1080p, 720p, 480p, 360p), 6-second segments.
   - reply part 2s: A (gallery page, 5-minute links, 8 MiB parts): 0 should-have-been-refused,
     0 rightful refused, 7 MiB thrown away, upload complete at 21:10:49 in 77 parts, server 20 MiB
     in the busiest hour. B (public bucket, single upload): 15 should-have-been-refused, the C-14
     link 169 h by Thu 01 Oct 01:00 and still working, 2,204 MiB thrown away, nothing stored.
     C (7-day links, delete at lease end, single upload): 40 files deleted, 13 C-14 opens get 404,
     2 should-have-been-refused (the removal man), 2,204 MiB thrown away. D (proxy, 8 MiB parts):
     0 and 0, 48,000 MiB in the busiest hour, 112% of the 100 Mbps line, 7 MiB thrown away.

   Teaching model (stated in sim.lede):
   - Time is minutes from Wed 23 Sep 00:00 (the lease's end). The replay opens at -60 (Tue 22 Sep
     23:00), where nothing happens, and ends at 11,580 (Thu 01 Oct 01:00). The clock runs one sim
     hour per real second. Events are processed in time order when the clock reaches them, so
     results never depend on the frame rate. Logs describe each event as it was at that moment.
   - Access. Mode = public if the bucket is public; otherwise proxy if proxy mode is on;
     otherwise the share setting (file or page).
     * file: a share is a presigned link signed at share time with the app's long-lived key,
       valid for the lifetime L. Signing checks nothing (not the lease, not whether the files
       exist). An open works while the files exist and the open is before signing + L.
     * page: a share is a link to the gallery page. The app asks the database at share time (no
       share if the lease has ended) and at every open (refused once the share is withdrawn), and
       signs links of lifetime L for that visit only.
     * proxy: like page for every decision, but the app server streams the bytes itself.
     * public: a share is the files' plain URLs. Works for anyone while the files exist.
     * Delete at lease end removes C-14's 40 files at minute 0; any later open gets 404.
   - Who should open: nobody may open C-14's files through a share made after its lease ended
     (all 13 opens); the removal man may open A-03's until Ms Quist withdraws it (minute 3,600).
     "Opens that should have been refused" counts opens that worked but shouldn't; "rightful
     opens refused" counts opens that should have worked but didn't.
   - Time the shared C-14 link worked: from the share (1,440) to the earlier of now and the link's
     expiry (file mode), to now (public), and 0 if the files were deleted or no link was issued.
   - Upload: 612 MiB at 1 MiB a second from 21:00:00. The signal holds for 551 s (551 MiB, 90%)
     then drops for 30 s. A single upload keeps nothing when it drops; the app restarts from zero
     and gives up after 4 attempts. Multipart with part size P: parts 1 to floor(551 / P) are
     stored when the signal drops, the part in flight is thrown away, and after 30 s the app
     resends from that part: 612 - floor(551 / P) x P MiB more.
   - Transcode (on, and only if an object was created): the bucket sends an ObjectCreated event
     2 s after the upload completes, and the transcoder takes 4 minutes: 4 variant streams, each
     ceil(256 / 6) = 43 segments of up to 6 s, 4 media playlists and 1 master playlist, 177 files.
   - Busiest hour (19:00 to 20:00): 400 gallery opens x 120 MiB = 48,000 MiB through the app
     server in proxy mode; otherwise the server sends only pages and signed links, 0.05 MiB an
     open, 20 MiB. Line use = MiB x 1,048,576 x 8 / 3,600 s / 100,000,000 bit/s: 48,000 MiB is
     111.8 Mbps, shown as 112%; 20 MiB is 0.05 Mbps, shown as 0%.

   Self-test arithmetic:
   - C-14 opens (minutes): 1,442 (Thu 00:02, Mrs Kittredge), 1,875 (Thu 07:15), 2,200 (Thu 12:40),
     2,585 (Thu 19:05), 3,390 (Fri 08:30), 4,150 (Fri 21:10), 4,940 (Sat 10:20), 6,885 (Sun
     18:45), 8,430 (Mon 20:30), 9,420 (Tue 13:00), 11,450 (Wed 22:50, the grandson), 11,500 (Wed
     23:40, the grandson at the gate), 11,540 (Thu 01 Oct 00:20, outside C-14).
   - A-03: shared 2,520 (Thu 18:00); opens 2,610 (Thu 19:30, rightful), 4,450 (Sat 02:10) and
     7,410 (Mon 03:30), both after the withdrawal at 3,600 (Fri 12:00).
   - As now (file, 7 days = 10,080 min): C-14 link valid 1,440 to 11,520, so opens 1 to 12 work
     (12 wrong) and 13 gets 403; A-03 valid to 12,600, so 2 wrong. 14 in all. Worked 10,080 min =
     168 h 0 min.
   - 1 day: C-14 to 2,880, opens 1 to 4 work (4 wrong); A-03 to 3,960: 2,610 works, the later two
     get 403. Worked 24 h 0 min. 1 hour: C-14 to 1,500 (1 wrong, Mrs Kittredge at 00:02); A-03 to
     2,580, so 2,610 is refused (1 rightful refused). 5 minutes: the same 1 and 1; worked 0 h 5 min.
   - Public: all 13 C-14 opens and the 2 late A-03 opens work: 15 wrong. Worked 11,580 - 1,440 =
     10,140 min = 169 h 0 min.
   - Delete at lease end (7 days): the 13 C-14 opens get 404; A-03 still 2 wrong; 40 deleted.
   - Proxy or page: no C-14 share, A-03 refused after 3,600: 0 wrong, 0 rightful refused.
   - Single upload: drops at 551, 1,132, 1,713 and 2,294 s after 21:00:00 (21:09:11, 21:18:52,
     21:28:33, 21:38:14); 4 x 551 = 2,204 MiB thrown away, nothing stored.
   - Multipart, 8 MiB: 68 parts stored (544 MiB), part 69 thrown away at 7 MiB; resend 68 MiB from
     21:09:41, complete 21:10:49; 77 parts (76 x 8 + 4). Transcode: event 21:10:51, done 21:14:51.
     5 MiB: 110 parts, 1 MiB lost, 123 parts, complete 21:10:43. 16 MiB: 34 parts, 7 lost, 39
     parts, 21:10:49. 64 MiB: 8 parts, 39 lost, 10 parts, 21:11:21. 100 MiB: 5 parts, 51 lost,
     7 parts, 21:11:33.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Tenants' phones (110, 60) and People with links (110, 230), 200 x 62: longest sub "family
     chat, removal man" 24 chars, 173px; longest meta "upload: 2,204 MiB, failed" 25 chars, 165px.
   - Prothero app (370, 60), 200 x 62: longest sub "shares plain URLs" 17 chars, 122px; longest
     meta "checks the login only" 21 chars, 139px.
   - App database (630, 60), 190 x 72: meta "asked on every open" 19 chars, 125px.
   - Bucket prothero-units (370, 230), 210 x 72: label 21 chars, 164px; meta "public: anyone,
     forever" 23 chars, 152px.
   - Event queue (630, 230) and Transcoder (630, 390), 190 x 62: sub "4 variant streams" 17 chars,
     122px.
   - Gaps: top row bottoms y 91 and 96, middle row tops y 194 and 199 (98px and more); middle row
     bottoms y 261 and 266, transcoder top y 359. Horizontal: 210 to 265 and 475 to 535.
   - Edge labels: "share" on tenant to app (gap 60px, 33px label); "lease?" on app to db (60px gap,
     40px); "upload" at 0.3 along tenant to bucket, below the tenant box; "GET" on holders to
     bucket; "open page" at 0.45 along the elbow from holders up x = 240 to the app, on the vertical
     segment near y 150 to 165, clear of "upload"; "proxy" on the app to
     bucket vertical; "event" bucket to queue (60px, 33px); "job" queue to transcoder; "variants"
     on the elbow from the transcoder along y 390 to x 370 and up to the bucket.

   Catalog note: the case's concepts are object-storage, files-vs-databases, presigned-urls and
   upload-pipelines.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 3600;                 // sim seconds per real second: one hour a second
  var BASE = 86400;                 // clock seconds at Wed 23 Sep 00:00 (a whole day, so times of day read right)
  var OPEN_MIN = -60;               // Tue 22 Sep 23:00
  var END_MIN = 11580;              // Thu 01 Oct 01:00
  var LEASE_END = 0;                // C-14's lease ends, Wed 23 Sep 00:00
  var CLEARED = 600;                // Wed 23 Sep 10:00
  var RELET = 960;                  // Wed 23 Sep 16:00, Mr Haskard
  var UPLOAD_AT = 1260;             // Wed 23 Sep 21:00
  var SHARE1 = 1440;                // Thu 24 Sep 00:00, Mrs Kittredge's share
  var FILES = 40;                   // 38 photos and 2 videos in C-14's album
  var OPENS1 = [1442, 1875, 2200, 2585, 3390, 4150, 4940, 6885, 8430, 9420, 11450, 11500, 11540];
  var SHARE2 = 2520;                // Thu 24 Sep 18:00, Ms Quist shares A-03 with a removal man
  var WITHDRAW2 = 3600;             // Fri 25 Sep 12:00, she withdraws it
  var OPENS2 = [2610, 4450, 7410];  // Thu 19:30, Sat 02:10, Mon 03:30

  var VIDEO = 612;                  // MiB
  var HOLD = 551;                   // MiB (and seconds, at 1 MiB a second) before the signal drops: 90%
  var GAP = 30;                     // seconds without signal
  var TRIES = 4;                    // single-upload attempts before the app gives up
  var EVENT_DELAY = 2;              // seconds from the completed upload to the event on the queue
  var TRANSCODE = 240;              // seconds the transcoder takes
  var VARIANTS = ["1080p", "720p", "480p", "360p"];
  var DURATION = 256;               // 4 min 16 s
  var SEGMENT = 6;                  // seconds, the target duration

  var BUSY_OPENS = 400;             // gallery opens in the busiest hour
  var OPEN_MIB = 120;               // MiB per open, on average
  var PAGE_MIB = 0.05;              // MiB per open for a page and its signed links
  var LINE_BPS = 100000000;         // the app server's 100 Mbps line

  var DAYS = ["Tue 22 Sep", "Wed 23 Sep", "Thu 24 Sep", "Fri 25 Sep", "Sat 26 Sep", "Sun 27 Sep",
    "Mon 28 Sep", "Tue 29 Sep", "Wed 30 Sep", "Thu 01 Oct"];

  var SHARES = [
    { value: "file", label: "Share links point at the files (as now)" },
    { value: "page", label: "Share links point at the gallery page, which checks" }
  ];
  var LIVES = [
    { value: 10080, label: "7 days (as now)" },
    { value: 1440, label: "1 day" },
    { value: 60, label: "1 hour" },
    { value: 5, label: "5 minutes" }
  ];
  var LIFE_TEXT = { 10080: "7 days", 1440: "1 day", 60: "1 hour", 5: "5 minutes" };
  var LIFE_ADJ = { 10080: "7-day", 1440: "1-day", 60: "1-hour", 5: "5-minute" };
  var PARTS = [
    { value: 5, label: "5 MiB" },
    { value: 8, label: "8 MiB" },
    { value: 16, label: "16 MiB" },
    { value: 64, label: "64 MiB" },
    { value: 100, label: "100 MiB" }
  ];

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 2204 -> "2,204". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Minute -> "Thu 24 Sep 00:00".
  function when(m) {
    var d = Math.floor(m / 1440);
    var r = m - d * 1440;
    return DAYS[d + 1] + " " + pad(Math.floor(r / 60)) + ":" + pad(r % 60);
  }

  // Seconds after Wed 23 Sep 21:00:00 -> "21:09:11".
  function hms(s) {
    var t = 21 * 3600 + s;
    return pad(Math.floor(t / 3600)) + ":" + pad(Math.floor((t % 3600) / 60)) + ":" + pad(t % 60);
  }

  // Minutes -> "168 h 0 min".
  function dur(m) { return Math.floor(m / 60) + " h " + (m % 60) + " min"; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function mode(S) {
    if (S.pub) return "public";
    if (S.proxy) return "proxy";
    return S.share;
  }

  function onOff(b) { return b ? "on" : "off"; }

  function settingsText(S) {
    return "Share links: " + (S.share === "file" ? "to the files" : "to the gallery page") +
      "; signed links last " + LIFE_TEXT[S.life] +
      "; public bucket " + onOff(S.pub) +
      "; delete at lease end " + onOff(S.del) +
      "; proxy mode " + onOff(S.proxy) +
      "; multipart " + (S.multi ? "on, " + S.part + " MiB parts" : "off") +
      "; transcode " + onOff(S.trans) + ".";
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 450,
    aria: "Storage lab for Prothero Self Storage. Tenants' phones ask the Prothero app to share an album and upload video to the bucket prothero-units. The app may ask the app database about leases and shares. People holding links open files from the bucket, or open the app's gallery page. In proxy mode the app streams files from the bucket itself. When the transcode pipeline is on, the bucket sends an event to a queue, a transcoder takes the job, and writes HLS variant streams back to the bucket.",
    nodes: [
      { id: "tenant", label: "Tenants' phones", sub: "C-14: Mrs Kittredge", meta: "upload: not started", x: 110, y: 60, w: 200, h: 62, shape: "box", tone: "" },
      { id: "app", label: "Prothero app", sub: "signs 7-day links", meta: "checks the login only", x: 370, y: 60, w: 200, h: 62, shape: "box", tone: "" },
      { id: "db", label: "App database", sub: "leases and shares", meta: "not asked", x: 630, y: 60, w: 190, h: 72, shape: "db", tone: "" },
      { id: "holders", label: "People with links", sub: "family chat, removal man", meta: "should be refused: 0", x: 110, y: 230, w: 200, h: 62, shape: "box", tone: "" },
      { id: "bucket", label: "Bucket prothero-units", sub: "C-14: 40 objects", meta: "private", x: 370, y: 230, w: 210, h: 72, shape: "db", tone: "" },
      { id: "queue", label: "Event queue", sub: "pipeline off", meta: "", x: 630, y: 230, w: 190, h: 62, shape: "box", tone: "muted" },
      { id: "worker", label: "Transcoder", sub: "idle", meta: "0 variant streams", x: 630, y: 390, w: 190, h: 62, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "tenant", to: "app", label: "share" },
      { from: "app", to: "db", label: "lease?" },
      { from: "tenant", to: "bucket", label: "upload", at: 0.3 },
      { from: "holders", to: "bucket", label: "GET" },
      { from: "holders", to: "app", label: "open page", via: [[240, 230], [240, 60]], at: 0.45 },
      { from: "app", to: "bucket", label: "proxy" },
      { from: "bucket", to: "queue", label: "event" },
      { from: "queue", to: "worker", label: "job" },
      { from: "worker", to: "bucket", label: "variants", via: [[370, 390]] }
    ]
  };

  /* ---------- the events ---------- */

  function buildEvents(S) {
    var ev = [];
    var i;
    ev.push({ at: LEASE_END, kind: "leaseEnd" });
    ev.push({ at: CLEARED, kind: "cleared" });
    ev.push({ at: RELET, kind: "relet" });
    ev.push({ at: UPLOAD_AT, kind: "upload" });
    ev.push({ at: SHARE1, kind: "share1" });
    for (i = 0; i < OPENS1.length; i++) ev.push({ at: OPENS1[i], kind: "open1", i: i + 1 });
    ev.push({ at: SHARE2, kind: "share2" });
    ev.push({ at: WITHDRAW2, kind: "withdraw2" });
    for (i = 0; i < OPENS2.length; i++) ev.push({ at: OPENS2[i], kind: "open2", i: i + 1 });
    if (mode(S) === "file") {
      if (SHARE1 + S.life <= END_MIN) ev.push({ at: SHARE1 + S.life, kind: "expire1" });
      if (SHARE2 + S.life <= END_MIN) ev.push({ at: SHARE2 + S.life, kind: "expire2" });
    }
    ev.push({ at: END_MIN, kind: "end" });
    // Stable sort by time: ties keep the order above.
    for (i = 0; i < ev.length; i++) ev[i].seq = i;
    ev.sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
    return ev;
  }

  function setClockMin(api, m) { api.clock = BASE + m * 60; }

  function filesGone(S) { return S.del && S.deletedAt !== null; }

  function process(api, e) {
    var S = api.state;
    var md = mode(S);
    setClockMin(api, e.at);
    var t = when(e.at);

    if (e.kind === "leaseEnd") {
      if (S.del) {
        S.deleted = FILES;
        S.deletedAt = e.at;
        api.log(t + " Mrs Kittredge's lease on C-14 ends. The app deletes C-14's 40 files from the bucket.", "warn");
      } else {
        api.log(t + " Mrs Kittredge's lease on C-14 ends. Her 40 files stay in the bucket, and her app login still works.", "");
      }
      return;
    }
    if (e.kind === "cleared") { api.log(t + " The crew clears C-14.", ""); return; }
    if (e.kind === "relet") { api.log(t + " C-14 is let to Mr Haskard.", ""); return; }
    if (e.kind === "upload") { upload(api, e.at); return; }

    if (e.kind === "share1") {
      if (md === "public") {
        S.shared1 = true;
        api.log(t + " Mrs Kittredge shares her C-14 album in the family chat. The bucket is public, so the link is the files' plain URLs: no signature, no expiry." +
          (filesGone(S) ? " The files were deleted at 00:00 on Wednesday." : ""), "warn");
      } else if (md === "file") {
        S.shared1 = true;
        api.log(t + " Mrs Kittredge opens the app, which checks her login but not her lease, and shares her C-14 album in the family chat: 40 files, a link that expires " +
          when(SHARE1 + S.life) + "." + (filesGone(S) ? " The files were deleted at 00:00 on Wednesday, but signing a link checks nothing." : ""), "warn");
      } else {
        S.shared1 = false;
        api.log(t + " Mrs Kittredge opens the app and taps Share on C-14. The app asks the database: her lease ended Wed 23 Sep 00:00. No share, and nothing goes into the family chat.", "ok");
      }
      return;
    }

    if (e.kind === "open1") {
      if (!S.shared1) return;              // nothing was posted, so there is nothing to open
      var who = e.i === 1 ? ", by Mrs Kittredge herself" :
        (e.i === 11 ? ", by her grandson" : (e.i === 12 ? ", by her grandson, at the gate" :
        (e.i === 13 ? ", by her grandson, outside C-14" : ", in the family chat")));
      var res;
      var ok;
      if (filesGone(S)) { ok = false; res = "404 Not Found, the files were deleted."; }
      else if (md === "public") { ok = true; res = "200 OK, C-14 full: the armchair, the boxes, the lamp."; }
      else if (e.at < SHARE1 + S.life) { ok = true; res = "200 OK, C-14 full: the armchair, the boxes, the lamp."; }
      else { ok = false; res = "403 Forbidden, the link expired."; }
      if (ok) S.wrong += 1;                // nobody should open C-14's files after its lease ended
      api.log(t + " Open " + e.i + " of the C-14 link" + who + ": " + res, ok ? "bad" : "ok");
      return;
    }

    if (e.kind === "share2") {
      var how;
      if (md === "public") how = "the files' plain URLs, no expiry.";
      else if (md === "file") how = "a link that expires " + when(SHARE2 + S.life) + ".";
      else how = "a link to her gallery page. The database records the share.";
      api.log(t + " Ms Quist (A-03, lease active) shares her album with a removal man: " + how, "");
      return;
    }

    if (e.kind === "withdraw2") {
      var after;
      if (md === "public") after = ", but plain URLs never stop working.";
      else if (md === "file") {
        after = SHARE2 + S.life <= e.at ? ". The link had already expired at " + when(SHARE2 + S.life) + "." :
          ", but the link is already out, and nothing asks the database before the files open: it works until " + when(SHARE2 + S.life) + ".";
      } else after = ". The database marks the share ended.";
      api.log(t + " Ms Quist withdraws the share in the app" + after, md === "file" || md === "public" ? "warn" : "ok");
      return;
    }

    if (e.kind === "open2") {
      var should = e.at < WITHDRAW2;
      var ok2;
      var res2;
      if (md === "public") { ok2 = true; res2 = "200 OK."; }
      else if (md === "page") {
        ok2 = should;
        res2 = ok2 ? "the app checks the share and signs " + LIFE_ADJ[S.life] + " links: 200 OK." : "the app checks the database: share withdrawn, refused.";
      } else if (md === "proxy") {
        ok2 = should;
        res2 = ok2 ? "the app checks the share and streams the files: 200 OK." : "the app checks the database: share withdrawn, refused.";
      } else {
        ok2 = e.at < SHARE2 + S.life;
        res2 = ok2 ? "200 OK." : "403 Forbidden, the link expired.";
      }
      if (ok2 && !should) S.wrong += 1;
      if (!ok2 && should) S.rightRefused += 1;
      api.log(t + " The removal man opens Ms Quist's A-03 link" + (should ? "" : ", after she withdrew it") + ": " + res2,
        ok2 === should ? "ok" : "bad");
      return;
    }

    if (e.kind === "expire1") {
      api.log(t + " The C-14 link expires, " + LIFE_TEXT[S.life] + " after it was signed.", "");
      return;
    }
    if (e.kind === "expire2") {
      api.log(t + " Ms Quist's A-03 link expires, " + LIFE_TEXT[S.life] + " after it was signed.", "");
      return;
    }
    if (e.kind === "end") {
      S.done = true;
      api.log(t + " End of the replay. Opens that should have been refused: " + S.wrong + ". Rightful opens refused: " + S.rightRefused + ".", "");
    }
  }

  /* ---------- Mr Haskard's upload ---------- */

  function logAt(api, s, msg, tone) {
    api.clock = BASE + UPLOAD_AT * 60 + s;
    api.log("Wed 23 Sep " + hms(s) + " " + msg, tone);
  }

  function upload(api) {
    var S = api.state;
    var via = S.proxy ? "through the app server" : "straight from his phone";
    logAt(api, 0, "Mr Haskard starts uploading a 612 MiB, 4 min 16 s video of C-14 from the yard, " + via + ": " +
      (S.multi ? "a multipart upload in " + S.part + " MiB parts." : "one single upload."), "");
    var doneAt;
    if (!S.multi) {
      for (var k = 1; k <= TRIES; k++) {
        var drop = (k - 1) * (HOLD + GAP) + HOLD;
        if (k < TRIES) {
          logAt(api, drop, "Attempt " + k + " drops at 551 of 612 MiB (90%). A single upload keeps nothing, so the app starts again from zero.", "bad");
        } else {
          logAt(api, drop, "Attempt 4 drops at 551 of 612 MiB (90%). The app gives up: 2,204 MiB sent, nothing stored.", "bad");
        }
      }
      S.resent = TRIES * HOLD;
      S.uploadText = "upload: 2,204 MiB, failed";
      if (S.trans) logAt(api, (TRIES - 1) * (HOLD + GAP) + HOLD, "No object was ever created, so no event, and nothing to transcode.", "warn");
      return;
    }
    var P = S.part;
    var nParts = Math.ceil(VIDEO / P);
    var done = Math.floor(HOLD / P);
    var lost = HOLD - done * P;
    var resume = HOLD + GAP;
    doneAt = resume + (VIDEO - done * P);
    logAt(api, HOLD, "The signal drops at 551 of 612 MiB (90%). Parts 1 to " + done + " are stored; part " + (done + 1) +
      " was " + lost + " MiB in and is lost.", "warn");
    logAt(api, doneAt, "Upload complete: part " + (done + 1) + " resent from " + hms(resume) + ", and " + nParts +
      " parts joined into one 612 MiB object. " + lost + " MiB thrown away.", "ok");
    S.resent = lost;
    S.uploadText = "upload: done, " + nParts + " parts";
    if (S.trans) {
      var segs = Math.ceil(DURATION / SEGMENT);
      var files = VARIANTS.length * segs + VARIANTS.length + 1;
      logAt(api, doneAt + EVENT_DELAY, "The bucket sends an ObjectCreated event to the queue; the transcoder takes the job.", "");
      logAt(api, doneAt + EVENT_DELAY + TRANSCODE, "Transcoder done: " + VARIANTS.length + " variant streams (" + VARIANTS.join(", ") + "), " +
        segs + " segments each of up to 6 s, " + VARIANTS.length + " media playlists and a master playlist: " + files + " files.", "ok");
      S.hls = VARIANTS.length;
    } else {
      logAt(api, doneAt, "Transcode pipeline off: the video stays as one 612 MiB file.", "");
    }
  }

  /* ---------- the replay ---------- */

  function startRun(api) {
    var S = api.state;
    S.now = OPEN_MIN;
    S.events = buildEvents(S);
    S.ev = 0;
    S.wrong = 0;
    S.rightRefused = 0;
    S.deleted = 0;
    S.deletedAt = null;
    S.shared1 = false;
    S.resent = 0;
    S.hls = 0;
    S.uploadText = "upload: not started";
    S.done = false;
    setClockMin(api, OPEN_MIN);
    api.speed = SPEED;
    api.log("Tue 22 Sep 23:00 One hour before Mrs Kittredge's lease on C-14 ends. " + settingsText(S), "");
    edges(api);
    draw(api);
  }

  function replay(api, what) {
    api.log(what + " Replaying from Tue 22 Sep 23:00.", "");
    startRun(api);
  }

  // Process every event up to minute target, then leave the clock at target.
  function advance(api, target) {
    var S = api.state;
    if (target > END_MIN) target = END_MIN;
    while (S.ev < S.events.length && S.events[S.ev].at <= target) {
      process(api, S.events[S.ev]);
      S.ev += 1;
    }
    if (target > S.now) S.now = target;
    setClockMin(api, S.now);
    if (S.done) api.speed = 0;
  }

  function skipTo(api, target) {
    var S = api.state;
    if (S.done) return;
    advance(api, Math.min(target, END_MIN));
    draw(api);
  }

  function step(api) {
    var S = api.state;
    if (!S.events || S.done) return;
    var target = (api.clock - BASE) / 60;
    if (target <= S.now) return;
    var keep = api.clock;
    advance(api, target);
    if (!S.done) api.clock = keep;
    draw(api);
  }

  /* ---------- drawing ---------- */

  function edges(api) {
    var S = api.state;
    var md = mode(S);
    var asks = md === "page" || md === "proxy";
    api.edge("app", "db").set(asks ? "" : "cut");
    api.edge("holders", "app").set(asks ? "" : "cut");
    api.edge("holders", "bucket").set(md === "proxy" ? "cut" : "");
    api.edge("app", "bucket").set(md === "proxy" ? "" : "cut");
    api.edge("bucket", "queue").set(S.trans ? "" : "cut");
    api.edge("queue", "worker").set(S.trans ? "" : "cut");
    api.edge("worker", "bucket").set(S.trans ? "" : "cut");
  }

  function worked(S) {
    if (!S.shared1 || filesGone(S) || S.now <= SHARE1) return 0;
    var md = mode(S);
    if (md === "public") return Math.floor(S.now - SHARE1);
    if (md === "file") return Math.floor(Math.min(S.now, SHARE1 + S.life) - SHARE1);
    return 0;
  }

  function busiest(S) {
    return mode(S) === "proxy" ? BUSY_OPENS * OPEN_MIB : BUSY_OPENS * PAGE_MIB;
  }

  function lineUse(mib) { return Math.round(mib * 1048576 * 8 / 3600 / LINE_BPS * 100); }

  function draw(api) {
    var S = api.state;
    var md = mode(S);

    var tn = api.node("tenant");
    tn.text("sub", S.now < LEASE_END ? "C-14: Mrs Kittredge" : (S.now < RELET ? "C-14: lease ended" : "C-14: Mr Haskard"));
    tn.text("meta", S.uploadText);
    tn.set(S.uploadText.indexOf("failed") >= 0 ? "bad" : (S.uploadText.indexOf("done") >= 0 ? "ok" : ""));

    var ap = api.node("app");
    if (md === "public") { ap.text("sub", "shares plain URLs"); ap.text("meta", "bucket is public"); ap.set("bad"); }
    else if (md === "proxy") { ap.text("sub", "streams every file"); ap.text("meta", "busiest hour " + lineUse(busiest(S)) + "%"); ap.set("warn"); }
    else if (md === "page") { ap.text("sub", "checks, then signs"); ap.text("meta", "links last " + LIFE_TEXT[S.life]); ap.set("ok"); }
    else { ap.text("sub", "signs " + LIFE_ADJ[S.life] + " links"); ap.text("meta", "checks the login only"); ap.set(S.life >= 1440 ? "warn" : ""); }

    var db = api.node("db");
    db.text("meta", md === "page" || md === "proxy" ? "asked on every open" : "not asked");
    db.set(md === "page" || md === "proxy" ? "ok" : "muted");

    var hd = api.node("holders");
    hd.text("meta", "should be refused: " + S.wrong);
    hd.set(S.wrong > 0 ? "bad" : "");

    var bk = api.node("bucket");
    bk.text("sub", filesGone(S) ? "C-14: 40 deleted" : "C-14: 40 objects");
    bk.text("meta", S.pub ? "public: anyone, forever" : "private");
    bk.set(S.pub ? "bad" : (filesGone(S) ? "warn" : ""));

    var qu = api.node("queue");
    var wk = api.node("worker");
    if (!S.trans) {
      qu.text("sub", "pipeline off"); qu.text("meta", ""); qu.set("muted");
      wk.text("sub", "idle"); wk.text("meta", "0 variant streams"); wk.set("muted");
    } else if (S.hls) {
      qu.text("sub", "1 event, done"); qu.text("meta", "at least once"); qu.set("ok");
      wk.text("sub", S.hls + " variant streams"); wk.text("meta", "177 files"); wk.set("ok");
    } else {
      qu.text("sub", "waiting for an object"); qu.text("meta", "at least once"); qu.set("");
      wk.text("sub", "idle"); wk.text("meta", "0 variant streams"); wk.set("");
    }

    var mib = busiest(S);
    S.stat.wrong(fmt(S.wrong));
    S.stat.refused(fmt(S.rightRefused));
    S.stat.worked(dur(worked(S)));
    S.stat.copied(md === "public" ? "forever" : (md === "proxy" ? "no signed links" : LIFE_TEXT[S.life]));
    S.stat.deleted(fmt(S.deleted));
    S.stat.resent(fmt(S.resent));
    S.stat.server(fmt(mib));
    S.stat.uplink(fmt(lineUse(mib)));
    S.stat.hls(fmt(S.hls));

    S.ctl.day.disable(S.done);
    S.ctl.end.disable(S.done);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    tenant: function (S) {
      return "<strong>Tenants' phones.</strong> Mrs Kittredge rented C-14 until Wed 23 Sep 00:00; Mr Haskard has it from 16:00. At 21:00 he uploads a 612 MiB video from the yard, where the signal holds for 551 MiB, 90%, then drops for 30 seconds. " +
        (S.multi ? "Multipart is on: " + S.part + " MiB parts, and a drop costs only the part in flight." : "A single upload keeps nothing when the signal drops.");
    },
    app: function (S) {
      var md = mode(S);
      var txt = {
        file: "Signs a presigned link to the files when someone taps Share, with its long-lived key. It checks the login, never the lease, and never hears of the link again.",
        page: "Shares a link to its own gallery page. Each time the page opens, it asks the database whether this person may see these files now, and only then signs links for that visit.",
        proxy: "Checks the database on every request and streams the files itself, so every byte passes through its 100 Mbps line.",
        public: "Has nothing to sign: the bucket is public, so a share is the files' plain URLs."
      };
      return "<strong>Prothero app.</strong> " + txt[md];
    },
    db: function () {
      return "<strong>App database.</strong> The record of who rents which unit, from when to when, which files belong to it, and which shares are active. It can only stop an open if something asks it at the time.";
    },
    holders: function () {
      return "<strong>People with links.</strong> Mrs Kittredge's family chat, where her C-14 link was posted at Thu 24 Sep 00:00, and the removal man Ms Quist shared A-03 with until she withdrew it at Fri 25 Sep 12:00. Nobody should open C-14's files after its lease ended.";
    },
    bucket: function (S) {
      return "<strong>Bucket prothero-units.</strong> Object storage: every photo and video is an object under a key such as units/C-14/IMG_0412.jpg, read and written whole over HTTP. It checks a link's signature and expiry when the link is used. " +
        (S.pub ? "Right now it is public: anyone with a URL can read any object, with no expiry." : "Right now it is private: only signed requests get in.");
    },
    queue: function () {
      return "<strong>Event queue.</strong> When the transcode pipeline is on, the bucket posts an ObjectCreated event here when an upload completes. Events are delivered at least once, so the transcoder must cope with seeing one twice.";
    },
    worker: function () {
      return "<strong>Transcoder.</strong> Takes the job from the queue and makes 4 variant streams (1080p, 720p, 480p, 360p), each cut into 6-second segments with a media playlist, plus one master playlist that lists them, and writes them back to the bucket.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s3e12", {
    diagram: DIAGRAM,
    startClock: BASE + OPEN_MIN * 60,

    setup: function (api) {
      var S = api.state;
      S.share = "file";
      S.life = 10080;
      S.pub = false;
      S.del = false;
      S.proxy = false;
      S.multi = false;
      S.part = 8;
      S.trans = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.share = api.control.select("share", "Share links", SHARES, "file", function (v) {
        var o = pick(SHARES, v);
        if (!o) return;
        S.share = String(o.value);
        replay(api, "Share links now point " + (S.share === "file" ? "at the files." : "at the gallery page."));
      });
      S.ctl.life = api.control.select("life", "Signed links last", LIVES, 10080, function (v) {
        var o = pick(LIVES, v);
        if (!o) return;
        S.life = Number(o.value);
        replay(api, "Signed links now last " + LIFE_TEXT[S.life] + ".");
      });
      S.ctl.pub = api.control.toggle("pub", "Public bucket", false, function (on) {
        S.pub = !!on;
        replay(api, "Public bucket " + onOff(S.pub) + ".");
      });
      S.ctl.del = api.control.toggle("del", "Delete a unit's files when its lease ends", false, function (on) {
        S.del = !!on;
        replay(api, "Delete at lease end " + onOff(S.del) + ".");
      });
      S.ctl.proxy = api.control.toggle("proxy", "Proxy mode: every file through the app server", false, function (on) {
        S.proxy = !!on;
        replay(api, "Proxy mode " + onOff(S.proxy) + ".");
      });
      S.ctl.multi = api.control.toggle("multi", "Multipart upload", false, function (on) {
        S.multi = !!on;
        replay(api, "Multipart upload " + onOff(S.multi) + ".");
      });
      S.ctl.part = api.control.select("part", "Part size (multipart)", PARTS, 8, function (v) {
        var o = pick(PARTS, v);
        if (!o) return;
        S.part = Number(o.value);
        replay(api, "Part size " + S.part + " MiB.");
      });
      S.ctl.trans = api.control.toggle("trans", "Transcode pipeline (event, queue, HLS)", false, function (on) {
        S.trans = !!on;
        replay(api, "Transcode pipeline " + onOff(S.trans) + ".");
      });
      S.ctl.day = api.control.button("day", "Skip 1 day", function () { skipTo(api, S.now + 1440); });
      S.ctl.end = api.control.button("end", "Skip to Thu 01 Oct 01:00", function () { skipTo(api, END_MIN); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        wrong: api.stat("wrong", "opens that should have been refused", "bad"),
        refused: api.stat("refused", "rightful opens refused", "warn"),
        worked: api.stat("worked", "time the shared C-14 link worked", "bad"),
        copied: api.stat("copied", "a copied file link works for", ""),
        deleted: api.stat("deleted", "tenant files deleted", "warn"),
        resent: api.stat("resent", "MiB thrown away (upload)", "warn"),
        server: api.stat("server", "app server MiB, busiest hour", ""),
        uplink: api.stat("uplink", "server line use, busiest hour %", ""),
        hls: api.stat("hls", "HLS variant streams produced", "ok")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startRun(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var mark = 0;
      function since() { return t.logText().slice(mark); }
      function begin() { mark = t.logText().length; }
      var log;

      // 1. The opening state, before the lease ends.
      t.expect(n("wrong") === 0 && n("refused") === 0 && t.stat("worked") === "0 h 0 min" && t.stat("copied") === "7 days" &&
        n("deleted") === 0 && n("resent") === 0 && n("server") === 20 && n("uplink") === 0 && n("hls") === 0 &&
        t.node("bucket").text.sub === "C-14: 40 objects" && t.node("db").text.meta === "not asked" &&
        t.logText().indexOf("Tue 22 Sep 23:00 One hour before Mrs Kittredge's lease on C-14 ends.") >= 0,
        "Opening state at Tue 22 Sep 23:00: nothing has happened, 7-day links to the files, the database not asked");
      await t.run(0.5);
      t.expect(t.logText().indexOf("lease on C-14 ends. Her 40 files") < 0 && n("wrong") === 0,
        "Half a real second (30 sim minutes) later the lease has not ended yet: nothing runs at the opening minute");

      // 2. As now, to the end.
      begin();
      t.click("end");
      log = since();
      t.expect(log.indexOf("Thu 24 Sep 00:00 Mrs Kittredge opens the app, which checks her login but not her lease, and shares her C-14 album in the family chat: 40 files, a link that expires Thu 01 Oct 00:00.") >= 0 &&
        log.indexOf("Wed 30 Sep 23:40 Open 12 of the C-14 link, by her grandson, at the gate: 200 OK, C-14 full: the armchair, the boxes, the lamp.") >= 0 &&
        log.indexOf("Thu 01 Oct 00:20 Open 13 of the C-14 link, by her grandson, outside C-14: 403 Forbidden, the link expired.") >= 0,
        "As now: a 7-day link signed a day after the lease ended, 12 opens of a room that is gone, then 403 at 00:20 on Thu 01 Oct");
      t.expect(n("wrong") === 14 && n("refused") === 0 && t.stat("worked") === "168 h 0 min" &&
        log.indexOf("Sat 26 Sep 02:10 The removal man opens Ms Quist's A-03 link, after she withdrew it: 200 OK.") >= 0,
        "As now: the C-14 link worked 168 h, and with the removal man's 2 opens after the withdrawal, 14 opens should have been refused");
      t.expect(n("resent") === 2204 && n("hls") === 0 &&
        log.indexOf("Wed 23 Sep 21:38:14 Attempt 4 drops at 551 of 612 MiB (90%). The app gives up: 2,204 MiB sent, nothing stored.") >= 0,
        "As now: Mr Haskard's single upload fails at 90% four times, 2,204 MiB thrown away, nothing stored");

      // 3. The transcode pipeline needs an object.
      t.click("trans");
      begin();
      t.click("end");
      t.expect(n("hls") === 0 && since().indexOf("No object was ever created, so no event, and nothing to transcode.") >= 0,
        "Transcode on with a single upload: no object, no event, no variant streams");

      // 4. Multipart, 8 MiB parts, with the pipeline.
      t.click("multi");
      begin();
      t.click("end");
      log = since();
      t.expect(n("resent") === 7 && n("hls") === 4 &&
        log.indexOf("Wed 23 Sep 21:09:11 The signal drops at 551 of 612 MiB (90%). Parts 1 to 68 are stored; part 69 was 7 MiB in and is lost.") >= 0 &&
        log.indexOf("Wed 23 Sep 21:10:49 Upload complete: part 69 resent from 21:09:41, and 77 parts joined into one 612 MiB object. 7 MiB thrown away.") >= 0 &&
        log.indexOf("Wed 23 Sep 21:14:51 Transcoder done: 4 variant streams (1080p, 720p, 480p, 360p), 43 segments each of up to 6 s, 4 media playlists and a master playlist: 177 files.") >= 0,
        "Multipart 8 MiB: only part 69 is resent, 7 MiB thrown away, done at 21:10:49; the event and the transcoder make 4 variant streams, 177 files");

      // 5. Bigger parts lose more at a drop.
      t.set("part", 100);
      begin();
      t.click("end");
      log = since();
      t.expect(n("resent") === 51 && log.indexOf("Parts 1 to 5 are stored; part 6 was 51 MiB in and is lost.") >= 0 &&
        log.indexOf("Wed 23 Sep 21:11:33 Upload complete: part 6 resent from 21:09:41, and 7 parts joined") >= 0,
        "100 MiB parts: 51 MiB thrown away, done at 21:11:33");
      t.set("part", 8);
      t.click("multi");
      t.click("trans");

      // 6. Option B: public bucket.
      t.click("pub");
      begin();
      t.click("end");
      t.expect(n("wrong") === 15 && t.stat("worked") === "169 h 0 min" && t.stat("copied") === "forever" &&
        since().indexOf("Thu 01 Oct 00:20 Open 13 of the C-14 link, by her grandson, outside C-14: 200 OK, C-14 full: the armchair, the boxes, the lamp.") >= 0,
        "Public bucket: 15 opens that should have been refused, the C-14 link still working at 169 h, nothing ever expires");
      t.click("pub");

      // 7. Option C: 7-day links and delete at lease end.
      t.click("del");
      begin();
      t.click("end");
      t.expect(n("wrong") === 2 && n("deleted") === 40 && t.stat("worked") === "0 h 0 min" &&
        since().indexOf("Wed 30 Sep 23:40 Open 12 of the C-14 link, by her grandson, at the gate: 404 Not Found, the files were deleted.") >= 0,
        "Delete at lease end: C-14's 40 files are gone and its opens get 404, but the removal man's 2 late opens still work");
      t.click("del");

      // 8. Option D: proxy mode.
      t.click("proxy");
      begin();
      t.click("end");
      t.expect(n("wrong") === 0 && n("refused") === 0 && n("server") === 48000 && n("uplink") === 112 &&
        t.stat("copied") === "no signed links" &&
        since().indexOf("The app asks the database: her lease ended Wed 23 Sep 00:00. No share") >= 0,
        "Proxy mode: every open checked, 0 and 0, but 48,000 MiB through the server in the busiest hour, 112% of its line");
      t.click("proxy");

      // 9. Short links alone, still signed at share time.
      t.set("life", 5);
      begin();
      t.click("end");
      t.expect(n("wrong") === 1 && n("refused") === 1 && t.stat("worked") === "0 h 5 min" &&
        since().indexOf("Thu 24 Sep 19:30 The removal man opens Ms Quist's A-03 link: 403 Forbidden, the link expired.") >= 0,
        "5-minute links signed at share time: Mrs Kittredge still sees C-14 at 00:02, and the removal man's rightful open is refused");
      t.set("life", 1440);
      t.click("end");
      t.expect(n("wrong") === 4 && n("refused") === 0 && t.stat("worked") === "24 h 0 min",
        "1-day links: 4 C-14 opens on Thursday should have been refused, and the link worked 24 h");

      // 10. Option A: the gallery page, 5-minute links, 8 MiB parts.
      t.set("share", "page");
      t.set("life", 5);
      t.click("multi");
      begin();
      t.click("end");
      log = since();
      t.expect(n("wrong") === 0 && n("refused") === 0 && n("resent") === 7 && t.stat("copied") === "5 minutes" &&
        n("server") === 20 && n("uplink") === 0 && t.stat("worked") === "0 h 0 min" &&
        log.indexOf("Thu 24 Sep 19:30 The removal man opens Ms Quist's A-03 link: the app checks the share and signs 5-minute links: 200 OK.") >= 0 &&
        log.indexOf("Sat 26 Sep 02:10 The removal man opens Ms Quist's A-03 link, after she withdrew it: the app checks the database: share withdrawn, refused.") >= 0,
        "Gallery page, 5-minute links, 8 MiB parts: no C-14 share, the removal man in until the withdrawal, 7 MiB thrown away, 20 MiB on the server");

      // 11. Skip one day from a fresh start.
      t.click("reset");
      t.click("day");
      t.expect(n("resent") === 2204 && n("wrong") === 0 && t.node("tenant").text.sub === "C-14: Mr Haskard" &&
        t.node("tenant").text.meta === "upload: 2,204 MiB, failed",
        "Reset, then skip a day to Wed 23 Sep 23:00: Mr Haskard has C-14 and his upload has failed, and no link has been shared yet");
    }
  });
})();
