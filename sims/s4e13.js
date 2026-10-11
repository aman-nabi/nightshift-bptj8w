/* sims/s4e13-v1.0.0.js  (published as sims/s4e13.js)
   Case s4e13 "The Webhook That Knocked Twice": a webhook lab for Doorwarden, a doorbell camera
   company in Lowestone. When someone rings a Doorwarden doorbell, the company sends a "someone at
   the door" event to the customer's smart-home hub by webhook (an HTTPS POST). The hub flashes the
   porch lights and has the hall speaker announce a visitor. The learner replays the night from
   22:00 to 06:00 with three delivery policies, four timeouts, the hub's order (act then reply, or
   reply then act), the hub skipping event ids it has seen, two signature schemes, three tolerance
   windows, four things that can happen to Mrs Ferrandine's hub at 02:10, and a replay test.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: the controls and stats below; selfTest: 11 assertions.

   The model (stated in sim.lede):
   - 20 events. Event n's ring is at RINGS[n - 1] minutes after 22:00; the company sends its first
     delivery in that same second. Each event has its own event id and goes to one hub; the 20
     events go to 16 hubs (hubs 1, 3, 5 and 9 get two each). Event 9 at 02:10 is Mrs Ferrandine's
     (hub 7).
   - A hub that gets a delivery starts acting in that second: the porch lights flash and the hall
     speaker announces a visitor. So an announcement's time is its delivery's send time.
   - Act then reply (as now): the hub answers when it has finished acting, ACT[n - 1] seconds
     after the send (1 to 3 s for every event but hers). Reply then act: the hub answers at once,
     in under a second, counted as 0 s, and then acts.
   - The sender waits for the timeout (5 s as now). An answer later than the timeout, or none,
     makes the delivery "timed out". A late answer is ignored.
   - Retry policy (as now): each retry goes a stated time after the previous try was sent: 40
     minutes, then 2 hours, then 6 hours, then no more. Send once: never a retry. Send once with
     the events API: no retry; every hub asks the events API every 5 minutes (22:05 to 06:00, 96
     times each, 16 hubs: 1,536 polls) for events it hasn't received, and acts on any it finds.
   - Her hub at 02:10 (event 9's first delivery only; on any later try it acts and answers in
     1 s): acts in 7 s (as that night, an update running); acts in 75 s; acts, then the answer is
     lost on the way back; restarting from 02:10:00 to 02:12:00, so it never gets the delivery.
   - Skip event ids seen: the hub records an event's id when it first acts on it, keeps it 3
     days, and skips any delivery whose id it holds: no announcement, an answer at once.
   - Replay test: a copy of the last delivery of event 9 sent before the replay, captured and sent
     again, unchanged, at 05:00:00 tonight or exactly eight days after that delivery. Body only:
     the signature is valid for ever and the timestamp header isn't covered, so it can't be
     trusted or checked. Timestamp and body: a copy older than the tolerance is rejected. Then the
     event-id check, if on. Otherwise the hub accepts it and announces a visitor.
   - Late: an event first announced more than 60 s after its ring.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e13-v1.0.0.json):
   - As that night (retry, 5 s, act then reply, ids off, body only, 7 s): deliveries 21 (20 + one
     retry), timed out 1 (event 9 at 02:10:05; its answer came at 02:10:07), announcements 21,
     extra 1, late 0, never 0, polls 0. Her porch: 02:10:00 and 02:50:00 (02:10:00 + 40 min).
   - Send once: 20 deliveries, 1 timed out, 20 announcements, nothing extra. Restarting: 19
     announced, 1 never, her porch "never".
   - Timeout 60 s: 20 deliveries, none timed out, nothing extra. With 75 s: timed out at 02:11:00,
     retry 02:50:00, extra 1, her porch 02:10:00 and 02:50:00.
   - Events API: 1,536 polls, nothing extra. Restarting: found by her hub's 02:15:00 poll, late 1,
     her porch 02:15:00.
   - Ids on, act then reply: 21 deliveries, 1 timed out, 20 announcements, the 02:50:00 retry
     skipped. Reply then act, ids off: 20 deliveries, none timed out. Reply then act, ids off,
     answer lost: 21 deliveries, extra 1. Restarting with retries: her porch 02:50:00, late 1.
   - Replay at 05:00 of the 02:50:00 copy: 2 h 10 min old; of the 02:10:00 copy (no retry): 2 h 50
     min. Body only, ids off: accepted. Ids on: skipped (seen at 02:10:00, kept 3 days). Timestamp
     and body with 5 minutes: rejected. With 3 hours: passes the time check at 05:00, rejected
     eight days later. Eight days later with body only and ids on: the record has expired,
     accepted.
   - The fix (timestamp and body, 5 minutes, ids on, reply then act), in all four 02:10 cases:
     nothing extra; replay rejected. Restarting: her porch 02:50:00, 40 minutes late.
*/
(function () {
  "use strict";

  var START = 79200;          // 22:00:00
  var END = 28800;            // 06:00:00, seconds after 22:00
  var SPEED = 600;
  var RINGS = [14, 41, 58, 80, 107, 125, 153, 206, 250, 277, 315, 352, 380, 404, 422, 438, 449, 457, 466, 475];
  var HUBS = [1, 2, 3, 4, 5, 1, 6, 8, 7, 9, 10, 3, 11, 12, 13, 5, 14, 15, 9, 16];
  var ACT = [2, 1, 2, 1, 3, 1, 2, 1, 7, 2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 2];
  var HER = 9;
  var HUB_COUNT = 16;
  var RETRY = [2400, 7200, 21600];
  var DOWN_END = 15120;       // 02:12:00
  var POLL = 300;
  var KEEP = 259200;          // 3 days
  var REPLAY_AT = 25200;      // 05:00:00
  var EIGHT_DAYS = 691200;

  var POLICIES = [
    { value: "retry", label: "Retry 40 min, then 2 h, then 6 h after a try (as now)" },
    { value: "once", label: "Send once, no retries" },
    { value: "poll", label: "Send once; hubs fetch missed events every 5 min" }
  ];
  var TIMEOUTS = [
    { value: "5", label: "5 seconds (as now)" },
    { value: "15", label: "15 seconds" },
    { value: "30", label: "30 seconds" },
    { value: "60", label: "60 seconds" }
  ];
  var ORDERS = [
    { value: "act", label: "Act, then reply (as now)" },
    { value: "reply", label: "Reply at once, then act" }
  ];
  var SIGS = [
    { value: "body", label: "Body only (as now)" },
    { value: "ts", label: "Timestamp and body" }
  ];
  var TOLS = [
    { value: "300", label: "5 minutes (Stripe's default)" },
    { value: "10800", label: "3 hours" },
    { value: "0", label: "No check" }
  ];
  var HUB9 = [
    { value: "slow7", label: "Acts in 7 s, then answers (as that night)" },
    { value: "slow75", label: "Acts in 75 s, then answers" },
    { value: "lost", label: "Acts; its answer is lost on the way back" },
    { value: "down", label: "Restarting until 02:12; never gets it" }
  ];
  var REPLAYS = [
    { value: "off", label: "Off" },
    { value: "night", label: "Sent again at 05:00 tonight" },
    { value: "days", label: "Sent again eight days later" }
  ];
  var POLICY_SHORT = { retry: "retries 40 min, 2 h, 6 h", once: "send once", poll: "send once, hubs fetch from the events API" };

  var DIAGRAM = {
    type: "arch", w: 740, h: 330,
    aria: "Doorwarden's webhooks. The doorbell camera rings and makes an event. The Doorwarden sender POSTs it to the customer's hub and waits for the answer. The hub flashes the porch lights and the hall speaker announces a visitor. Below the sender, the events API keeps every event for hubs that fetch what they missed. A captured copy of a delivery can be sent to the hub again.",
    nodes: [
      { id: "cam", label: "Doorbell camera", sub: "0 rings", x: 90, y: 80, w: 150, h: 64, shape: "box", tone: "" },
      { id: "sender", label: "Doorwarden sender", sub: "retries 40m, 2h, 6h", meta: "timeout 5 s", x: 330, y: 80, w: 180, h: 72, shape: "box", tone: "" },
      { id: "hub", label: "Mrs Ferrandine's hub", sub: "act, then reply", meta: "ids seen: off", x: 610, y: 80, w: 200, h: 72, shape: "box", tone: "ok" },
      { id: "copy", label: "Captured copy", sub: "not tried", x: 90, y: 250, w: 150, h: 64, shape: "box", tone: "muted" },
      { id: "api", label: "Events API", sub: "not used", x: 330, y: 250, w: 180, h: 64, shape: "db", tone: "muted" },
      { id: "porch", label: "Porch lights, speaker", sub: "0 announcements", x: 610, y: 250, w: 200, h: 64, shape: "box", tone: "" }
    ],
    edges: [
      { from: "cam", to: "sender", label: "event" },
      { from: "sender", to: "hub", label: "POST" },
      { from: "hub", to: "porch", label: "announce" },
      { from: "sender", to: "api", label: "stored", dash: true },
      { from: "hub", to: "api", label: "fetch missed", dash: true, at: 0.35 },
      { from: "copy", to: "hub", label: "replay", dash: true, at: 0.3 }
    ]
  };

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = ((Math.floor(START + sec) % 86400) + 86400) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function age(sec) {
    if (sec >= 86400 && sec % 86400 === 0) return (sec / 86400) + " days";
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    return (h ? h + " h " : "") + m + " min";
  }
  function eid(n) {
    var h = 0x811c9dc5;
    var s = "ring-" + n;
    for (var i = 0; i < s.length; i++) h = Math.imul((h ^ s.charCodeAt(i)) >>> 0, 0x01000193) >>> 0;
    return "evt_" + ("0000000" + h.toString(16)).slice(-8);
  }
  function who(n) {
    return n === HER ? "Event 9 (Mrs Ferrandine, hub 7)" : "Event " + n + " (hub " + HUBS[n - 1] + ")";
  }
  function tolWords(v) { return v === 300 ? "5 minutes" : v === 10800 ? "3 hours" : "no check"; }
  function settingsLine(C) {
    return POLICY_SHORT[C.policy] + ", timeout " + C.timeout + " s, " + (C.order === "act" ? "act then reply" : "reply then act") +
      ", event ids " + (C.dedup ? "skipped when seen" : "not checked") + ", signed over " + (C.sig === "ts" ? "the timestamp and body" : "the body only") +
      (C.sig === "ts" ? ", tolerance " + tolWords(C.tol) : "") + ". Her hub at 02:10: " + hubWords(C.hub) + ".";
  }
  function hubWords(h) {
    return h === "slow7" ? "acts in 7 s" : h === "slow75" ? "acts in 75 s" : h === "lost" ? "answer lost" : "restarting until 02:12";
  }

  /* ---------- the replay check (pure) ---------- */

  function judgeReplay(C, stamp, at, rec9) {
    var head = "Replay test: a copy of event 9's delivery sent at " + clock(stamp) + ", captured and sent again " +
      (at - stamp === EIGHT_DAYS ? "eight days later" : "at " + clock(at)) + " (" + age(at - stamp) + " old). ";
    if (C.sig === "body") head += "Signed over the body only, so the signature still checks out, and the timestamp isn't signed. ";
    else head += "The signature covers its timestamp, " + clock(stamp) + ". ";
    if (C.sig === "ts" && C.tol > 0 && at - stamp > C.tol) {
      return { r: "rejected: timestamp too old", msg: head + "Older than the " + tolWords(C.tol) + " tolerance: rejected, nothing announced.", tone: "ok" };
    }
    if (C.sig === "ts") head += (C.tol > 0 ? "Inside the " + tolWords(C.tol) + " tolerance. " : "No tolerance check. ");
    if (C.dedup && rec9 !== null && at - rec9 < KEEP) {
      return { r: "skipped: event id seen", msg: head + "Event id " + eid(HER) + " was seen at " + clock(rec9) + ": skipped, nothing announced.", tone: "ok" };
    }
    if (C.dedup && rec9 !== null) head += "The record of event id " + eid(HER) + " expired after 3 days. ";
    return { r: "accepted: announced", msg: head + "Accepted: the porch lights flash and the hall speaker announces a visitor.", tone: "bad" };
  }

  /* ---------- the night, worked out in full (pure) ---------- */

  function night(C) {
    var ev = [];
    function add(t, msg, tone, d) { ev.push({ t: t, k: ev.length, msg: msg, tone: tone || "", d: d || {} }); }
    var got = {};       // event n -> the hub has received it
    var first = {};     // event n -> first announcement time
    var rec = {};       // event n -> when its id was recorded (dedup)
    var stamps = {};    // event n -> send times of its tries
    var tries = [];
    var i;
    for (i = 0; i < RINGS.length; i++) tries.push({ n: i + 1, t: RINGS[i] * 60, k: 1 });

    function announce(n, T) {
      var d = { ann: 1 };
      if (first[n] === undefined) {
        first[n] = T;
        if (T - RINGS[n - 1] * 60 > 60) d.late = 1;
        if (C.dedup) rec[n] = T;
      } else {
        d.extra = 1;
      }
      if (n === HER) d.her = clock(T);
      return d;
    }

    function tryOnce(x) {
      var n = x.n;
      var T = x.t;
      var head = who(n) + ", try " + x.k + ", sent " + clock(T) + ", event id " + eid(n) + ".";
      if (!stamps[n]) stamps[n] = [];
      stamps[n].push(T);
      var d;
      var failed = false;
      if (n === HER && C.hub === "down" && T < DOWN_END) {
        d = { sent: 1, tout: 1 };
        add(T + C.timeout, head + " Her hub is restarting and never gets it. No answer: timed out at " + clock(T + C.timeout) + ".", "warn", d);
        failed = true;
      } else if (C.dedup && rec[n] !== undefined && T - rec[n] < KEEP) {
        got[n] = true;
        add(T, head + " The hub has seen this event id (at " + clock(rec[n]) + "): skipped, nothing announced. Answered at once.", "ok", { sent: 1, skip: 1 });
        return;
      } else {
        got[n] = true;
        d = announce(n, T);
        d.sent = 1;
        var lost = n === HER && x.k === 1 && C.hub === "lost";
        var act = (n === HER && x.k > 1) ? 1 : (n === HER ? (C.hub === "slow75" ? 75 : 7) : ACT[n - 1]);
        var ans = C.order === "reply" ? 0 : act;
        var said = d.extra ? " The hub announces a visitor again." : " The hub announces a visitor.";
        if (lost) {
          d.tout = 1;
          add(T, head + said + " Its answer is lost on the way back: timed out at " + clock(T + C.timeout) + ".", d.extra ? "bad" : "warn", d);
          failed = true;
        } else if (ans > C.timeout) {
          d.tout = 1;
          add(T, head + said + " It answers after " + ans + " s, at " + clock(T + ans) + ", too late: timed out at " + clock(T + C.timeout) + ".", d.extra ? "bad" : "warn", d);
          failed = true;
        } else {
          add(T, head + said + (ans === 0 ? " Answered at once, then it acts." : " Answered in " + ans + " s.") + (d.extra ? " The porch is empty." : ""), d.extra ? "bad" : "", d);
        }
      }
      if (!failed) return;
      if (C.policy === "retry" && x.k <= RETRY.length) {
        var nt = T + RETRY[x.k - 1];
        if (nt < END) tries.push({ n: n, t: nt, k: x.k + 1 });
        add(T + C.timeout, who(n) + ": next try at " + (nt < END ? clock(nt) : clock(nt) + ", after 06:00") + ".", "");
      } else if (C.policy !== "retry") {
        add(T + C.timeout, who(n) + ": no retry, the event was sent once.", "");
      }
    }

    var guard = 0;
    while (tries.length && guard++ < 200) {
      tries.sort(function (a, b) { return (a.t - b.t) || (a.n - b.n); });
      tryOnce(tries.shift());
    }

    if (C.policy === "poll") {
      for (var p = POLL; p <= END; p += POLL) {
        add(p, "", "", { polls: HUB_COUNT });
        for (var n = 1; n <= RINGS.length; n++) {
          var ring = RINGS[n - 1] * 60;
          if (got[n] || ring > p) continue;
          if (n === HER && C.hub === "down" && p < DOWN_END) continue;
          got[n] = true;
          var dd = announce(n, p);
          add(p, who(n) + ": the hub's " + clock(p) + " poll of the events API finds it, missed at " + clock(ring) + ". The hub announces a visitor.", dd.late ? "warn" : "", dd);
        }
      }
    }

    if (C.replay === "night") {
      var st = (stamps[HER] || []).filter(function (s) { return s <= REPLAY_AT; });
      var stamp = st.length ? st[st.length - 1] : RINGS[HER - 1] * 60;
      var rv = judgeReplay(C, stamp, REPLAY_AT, rec[HER] !== undefined ? rec[HER] : null);
      add(REPLAY_AT, rv.msg, rv.tone, { replay: rv.r });
    }

    ev.sort(function (a, b) { return (a.t - b.t) || (a.k - b.k); });
    return { ev: ev, first: first, rec: rec, stamps: stamps };
  }

  /* ---------- the replay of the night ---------- */

  function zero() { return { rings: 0, sent: 0, tout: 0, ann: 0, extra: 0, late: 0, polls: 0, skip: 0, her: [], replay: "" }; }

  function newNight(api) {
    var S = api.state;
    S.N = night(S.C);
    S.i = 0;
    S.t = 0;
    S.done = false;
    S.sum = zero();
    S.never = null;
  }

  function reveal(api, upTo) {
    var S = api.state;
    while (S.i < S.N.ev.length && S.N.ev[S.i].t <= upTo) {
      var e = S.N.ev[S.i];
      S.i += 1;
      var d = e.d;
      ["sent", "tout", "ann", "extra", "late", "polls", "skip"].forEach(function (k) { if (d[k]) S.sum[k] += d[k]; });
      if (d.her) S.sum.her.push(d.her);
      if (d.replay) S.sum.replay = d.replay;
      if (e.msg) { api.clock = START + e.t; api.log(e.msg, e.tone); }
    }
    var r = 0;
    for (var j = 0; j < RINGS.length; j++) if (RINGS[j] * 60 <= upTo) r += 1;
    S.sum.rings = r;
  }

  function finish(api) {
    var S = api.state;
    if (S.done) return;
    reveal(api, END);
    S.done = true;
    S.t = END;
    api.clock = START + END;
    api.speed = 0;
    var x = S.sum;
    var never = 0;
    for (var n = 1; n <= RINGS.length; n++) if (S.N.first[n] === undefined) never += 1;
    S.never = never;
    if (S.C.replay === "days") {
      var st = S.N.stamps[HER] || [RINGS[HER - 1] * 60];
      var stamp = st[st.length - 1];
      var rv = judgeReplay(S.C, stamp, stamp + EIGHT_DAYS, S.N.rec[HER] !== undefined ? S.N.rec[HER] : null);
      x.replay = rv.r;
      api.log(rv.msg, rv.tone);
    }
    api.log("06:00, end of the night (" + POLICY_SHORT[S.C.policy] + "). 20 rings. Deliveries sent: " + x.sent + ". Timed out: " + x.tout +
      ". Announcements: " + x.ann + ". Extra announcements: " + x.extra + ". Never announced: " + never + "." +
      (S.C.policy === "poll" ? " Polls of the events API: " + fmt(x.polls) + "." : ""),
      x.extra || never ? "bad" : "");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var x = S.sum;
    api.node("cam").text("sub", x.rings + (x.rings === 1 ? " ring" : " rings"));
    var sd = api.node("sender");
    sd.text("sub", C.policy === "retry" ? "retries 40m, 2h, 6h" : "send once");
    sd.text("meta", "timeout " + C.timeout + " s, " + (C.sig === "ts" ? "ts + body" : "body only"));
    sd.set(x.tout ? "warn" : "");
    var hb = api.node("hub");
    hb.text("sub", C.order === "act" ? "act, then reply" : "reply, then act");
    hb.text("meta", "ids seen: " + (C.dedup ? "on, " + x.skip + " skipped" : "off"));
    hb.set(C.hub === "down" ? "warn" : "ok");
    var pc = api.node("porch");
    pc.text("sub", x.ann + (x.ann === 1 ? " announcement" : " announcements"));
    pc.set(x.extra ? "bad" : "");
    var ap = api.node("api");
    ap.text("sub", C.policy === "poll" ? fmt(x.polls) + " polls" : "not used");
    ap.set(C.policy === "poll" ? "" : "muted");
    var cp = api.node("copy");
    cp.text("sub", C.replay === "off" ? "not tried" : (x.replay ? x.replay.split(":")[0] : "waiting"));
    cp.set(C.replay === "off" ? "muted" : x.replay === "accepted: announced" ? "bad" : x.replay ? "ok" : "");
    S.stat.sent(x.sent);
    S.stat.tout(x.tout);
    S.stat.ann(x.ann);
    S.stat.extra(x.extra);
    S.stat.late(x.late);
    S.stat.never(S.never === null ? 0 : S.never);
    S.stat.polls(fmt(x.polls));
    S.stat.her(x.her.length ? x.her.join(" and ") : (S.done ? "never" : "none yet"));
    S.stat.replay(C.replay === "off" ? "not tried" : (x.replay || "not yet"));
  }

  function replayNight(api, why) {
    var S = api.state;
    newNight(api);
    api.speed = SPEED;
    api.clock = START;
    api.log(why + " The night starts again at 22:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  var INFO = {
    cam: "<strong>Doorbell camera.</strong> When someone rings, it records a clip and Doorwarden makes a \"someone at the door\" event with its own event id. 20 rings tonight, from 22:14 to 05:55, to 16 hubs.",
    sender: "<strong>Doorwarden sender.</strong> POSTs each event to the customer's hub over HTTPS, signed with a secret the hub shares, and waits for the answer. No answer within the timeout and the try counts as failed; with retries on, the next try goes 40 minutes after it was sent, then 2 hours, then 6 hours.",
    hub: "<strong>Mrs Ferrandine's hub.</strong> Hub 7. It checks the signature, acts on the event (lights, speaker) and answers. As now it acts first and answers after. With event ids on, it records each id it has acted on for 3 days and skips a repeat.",
    porch: "<strong>Porch lights and hall speaker.</strong> Every delivery the hub acts on flashes the lights and announces a visitor. A repeat announces a visitor who has gone.",
    api: "<strong>Events API.</strong> Used only by the send-once-and-fetch policy: every hub asks it every 5 minutes for events it hasn't received. 16 hubs, 96 times a night each.",
    copy: "<strong>Captured copy.</strong> The replay test: a copy of event 9's last delivery, taken from somewhere it was stored, such as a log, and sent to the hub again unchanged. Nobody does this in the story; the lab asks whether the hub would accept it."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s4e13", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.C = { policy: "retry", timeout: 5, order: "act", dedup: false, sig: "body", tol: 300, hub: "slow7", replay: "off" };
      api.speed = SPEED;
      S.ctl = {};
      S.ctl.policy = api.control.select("policy", "Delivery policy", POLICIES, "retry", function (v) {
        S.C.policy = String(v);
        replayNight(api, "Policy: " + POLICY_SHORT[S.C.policy] + ".");
      });
      S.ctl.timeout = api.control.select("timeout", "Timeout", TIMEOUTS, "5", function (v) {
        S.C.timeout = Number(v) || 5;
        replayNight(api, "Timeout: " + S.C.timeout + " s.");
      });
      S.ctl.order = api.control.select("order", "The hub's order", ORDERS, "act", function (v) {
        S.C.order = String(v);
        replayNight(api, "The hub: " + (S.C.order === "act" ? "act, then reply." : "reply at once, then act."));
      });
      S.ctl.dedup = api.control.toggle("dedup", "Hub skips event ids it has seen (kept 3 days)", false, function (on) {
        S.C.dedup = !!on;
        replayNight(api, "Skip event ids seen: " + (on ? "on." : "off."));
      });
      S.ctl.sig = api.control.select("sig", "What the signature covers", SIGS, "body", function (v) {
        S.C.sig = String(v);
        replayNight(api, "Signed over " + (S.C.sig === "ts" ? "the timestamp and body." : "the body only."));
      });
      S.ctl.tol = api.control.select("tol", "Tolerance for old timestamps", TOLS, "300", function (v) {
        S.C.tol = Number(v);
        replayNight(api, "Tolerance: " + tolWords(S.C.tol) + (S.C.sig === "ts" ? "." : ". It needs a signed timestamp to work."));
      });
      S.ctl.hub = api.control.select("hub", "Her hub at 02:10", HUB9, "slow7", function (v) {
        S.C.hub = String(v);
        replayNight(api, "Her hub at 02:10: " + hubWords(S.C.hub) + ".");
      });
      S.ctl.replay = api.control.select("replay", "Replay test (a captured copy of event 9)", REPLAYS, "off", function (v) {
        S.C.replay = String(v);
        replayNight(api, "Replay test: " + (S.C.replay === "off" ? "off." : S.C.replay === "night" ? "at 05:00 tonight." : "eight days later."));
      });
      S.ctl.skip = api.control.button("skip", "Skip to 06:00", function () { finish(api); draw(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        sent: api.stat("sent", "deliveries sent", ""),
        tout: api.stat("tout", "timed out", "warn"),
        ann: api.stat("ann", "announcements", ""),
        extra: api.stat("extra", "extra announcements", "bad"),
        late: api.stat("late", "first announced over a minute late", "warn"),
        never: api.stat("never", "visitors never announced", "bad"),
        polls: api.stat("polls", "polls of the events API", ""),
        her: api.stat("her", "Mrs Ferrandine's porch (event 9)", ""),
        replay: api.stat("replay", "replayed copy", "")
      };

      api.onNodeClick(function (id) { if (INFO[id]) api.info(INFO[id]); });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      newNight(api);
      api.log("22:00. Nothing rung yet. Settings: " + settingsLine(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.C || S.done) return;
      S.t += dt * api.speed;
      if (S.t >= END) { finish(api); draw(api); return; }
      reveal(api, Math.floor(S.t));
      api.clock = START + S.t;
      draw(api);
    },

    selfTest: async function (t) {
      function s(id) { return t.stat(id); }
      function has(x) { return t.logText().indexOf(x) >= 0; }
      function run() { t.click("skip"); }
      var a;
      var b;

      // 1. Opening state: 22:00, before the first ring.
      t.expect(s("sent") === 0 && s("tout") === 0 && s("ann") === 0 && s("extra") === 0 && s("late") === 0 && s("never") === 0 &&
        s("polls") === 0 && s("her") === "none yet" && s("replay") === "not tried" && t.node("cam").text.sub === "0 rings",
        "Opens at 22:00 with nothing rung and nothing sent");

      // 2. The first ring: 22:14:00, event 1 to hub 1, answered in 2 s.
      await t.run(1.5);                                    // 900 sim seconds, to 22:15:00
      t.expect(s("sent") === 1 && s("ann") === 1 && s("tout") === 0 &&
        has("Event 1 (hub 1), try 1, sent 22:14:00, event id " + eid(1) + ". The hub announces a visitor. Answered in 2 s."),
        "22:14: event 1 is delivered, announced and answered in 2 s");

      // 3. The story's night: one timed-out delivery, a retry at 02:50:00, one extra announcement.
      run();
      t.expect(s("sent") === 21 && s("tout") === 1 && s("ann") === 21 && s("extra") === 1 && s("late") === 0 && s("never") === 0 &&
        s("her") === "02:10:00 and 02:50:00" &&
        has("Event 9 (Mrs Ferrandine, hub 7), try 1, sent 02:10:00, event id " + eid(9) + ". The hub announces a visitor. It answers after 7 s, at 02:10:07, too late: timed out at 02:10:05.") &&
        has("Event 9 (Mrs Ferrandine, hub 7): next try at 02:50:00.") &&
        has("Event 9 (Mrs Ferrandine, hub 7), try 2, sent 02:50:00, event id " + eid(9) + ". The hub announces a visitor again. Answered in 1 s. The porch is empty."),
        "As that night: 21 deliveries, 1 timed out, 21 announcements, 1 extra; her porch at 02:10:00 and 02:50:00");

      // 4. Send once: nothing extra, but a restarting hub's visitor is never announced.
      t.set("policy", "once");
      run();
      a = s("sent") === 20 && s("tout") === 1 && s("ann") === 20 && s("extra") === 0 && s("her") === "02:10:00";
      t.set("hub", "down");
      run();
      t.expect(a && s("never") === 1 && s("ann") === 19 && s("her") === "never" &&
        has("Event 9 (Mrs Ferrandine, hub 7): no retry, the event was sent once."),
        "Send once: 20 deliveries, nothing extra; with her hub restarting, 1 visitor never announced");

      // 5. A 60-second timeout fixes 7 s and not 75 s.
      t.set("hub", "slow7");
      t.set("policy", "retry");
      t.set("timeout", "60");
      run();
      a = s("sent") === 20 && s("tout") === 0 && s("extra") === 0;
      t.set("hub", "slow75");
      run();
      t.expect(a && s("sent") === 21 && s("extra") === 1 && s("her") === "02:10:00 and 02:50:00" &&
        has("It answers after 75 s, at 02:11:15, too late: timed out at 02:11:00."),
        "Timeout 60 s: nothing extra at 7 s; at 75 s the retry at 02:50:00 announces again");

      // 6. Send once and fetch from the events API: 1,536 polls; a restarting hub catches up at 02:15:00.
      t.set("timeout", "5");
      t.set("hub", "slow7");
      t.set("policy", "poll");
      run();
      a = s("polls") === "1,536" && s("extra") === 0 && s("sent") === 20;
      t.set("hub", "down");
      run();
      t.expect(a && s("her") === "02:15:00" && s("late") === 1 && s("never") === 0 &&
        has("the hub's 02:15:00 poll of the events API finds it, missed at 02:10:00."),
        "Events API: 1,536 polls, nothing extra; a restarting hub finds event 9 at 02:15:00, 5 minutes late");

      // 7. Skipping event ids seen stops the 02:50:00 repeat; the retry still goes.
      t.set("hub", "slow7");
      t.set("policy", "retry");
      t.set("dedup", true);
      run();
      t.expect(s("sent") === 21 && s("tout") === 1 && s("ann") === 20 && s("extra") === 0 && s("her") === "02:10:00" &&
        has("try 2, sent 02:50:00, event id " + eid(9) + ". The hub has seen this event id (at 02:10:00): skipped, nothing announced."),
        "Event ids on: the 02:50:00 retry is skipped; 21 deliveries, 20 announcements");

      // 8. Replying first removes the time-out, but a lost answer still repeats without event ids.
      t.set("dedup", false);
      t.set("order", "reply");
      run();
      a = s("sent") === 20 && s("tout") === 0 && s("extra") === 0;
      t.set("hub", "lost");
      run();
      t.expect(a && s("sent") === 21 && s("extra") === 1 && s("her") === "02:10:00 and 02:50:00",
        "Reply then act: 20 deliveries, none timed out; with her answer lost, the retry announces again");

      // 9. Replay at 05:00: body only is accepted; timestamp and body with 5 minutes is rejected.
      t.set("hub", "slow7");
      t.set("order", "act");
      t.set("replay", "night");
      run();
      a = s("replay") === "accepted: announced" &&
        has("Replay test: a copy of event 9's delivery sent at 02:50:00, captured and sent again at 05:00:00 (2 h 10 min old). Signed over the body only");
      t.set("sig", "ts");
      run();
      t.expect(a && s("replay") === "rejected: timestamp too old" && has("Older than the 5 minutes tolerance: rejected, nothing announced."),
        "Replay at 05:00: accepted with a body-only signature, rejected with a signed timestamp and 5 minutes");

      // 10. The window and the event-id record must cover each other.
      t.set("tol", "10800");
      t.set("dedup", true);
      run();
      a = s("replay") === "skipped: event id seen";
      t.set("sig", "body");
      t.set("replay", "days");
      run();
      b = s("replay") === "accepted: announced" && has("The record of event id " + eid(9) + " expired after 3 days.");
      t.set("sig", "ts");
      run();
      t.expect(a && b && s("replay") === "rejected: timestamp too old",
        "3-hour window: the 05:00 copy passes the time check and the event id stops it; eight days later body only gets through, a signed timestamp doesn't");

      // 11. The fix in all four 02:10 cases: nothing extra, replays refused.
      t.set("tol", "300");
      t.set("order", "reply");
      var ok = true;
      ["slow7", "slow75", "lost", "down"].forEach(function (h) {
        t.set("hub", h);
        run();
        if (s("extra") !== 0 || s("never") !== 0 || s("replay") !== "rejected: timestamp too old") ok = false;
      });
      t.expect(ok && s("her") === "02:50:00" && s("late") === 1 && s("sent") === 21,
        "The fix (timestamp and body, 5 minutes, event ids, reply first): nothing extra in all four cases; a restarting hub's visitor is announced at 02:50:00, 40 minutes late");
    }
  });
})();
