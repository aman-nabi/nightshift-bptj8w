/* sims/a10e03-v1.0.0.js  (published as sims/a10e03.js)
   Case a10e03 "What It Keeps in Mind": a chat-memory planner for the Grisholme refinery's procedures
   assistant on the first night of its maintenance shutdown. No real model runs here and no chat text
   exists in this file: every figure is worked out from the given numbers below (also stated in
   sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: longest allowed chat (2,048 or 8,192 tokens), how room is
     handed out (the whole longest chat when a chat opens, or 16-token pages as it grows), cards (1 or 2),
     idle close (off or 5 minutes), weights (16 or 4 bits), average open chat (1,600 or 4,000 tokens),
     the moment shown (22:10, 22:15, 22:45, 23:00), play the night, play a reply, reset. Stats: working
     memory per token, room for chats, chats that fit, the sizing sheet's sum, chats wanted, chats held,
     refused so far, paused now, room reserved, room used, share in use, chats started over, the card
     bill. selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 8B: 32 layers, 8 key/value heads of 128 numbers (4,096 / 32), 16.06 billion bytes in
     16 bits, about 15 GB on the card's meter. In 4 bits: about 4 GB (8.03 billion x half a byte =
     4.02 billion bytes, 3.74 GB, rounded up as the story does).
   - working memory per token: 2 (key and value) x 32 x 8 x 128 x 2 bytes = 131,072 bytes = 128 KB.
   - one A100 80GB, shared with the document-search model (24 GB), so the program may use 56 GB:
     15 for weights, 1 for working space, 40 for chats. Sizes in the meter's units: 1 GB = 1,024 MB,
     1 MB = 1,024 KB.
   - the refinery's own figures, never a source's: the program's count puts the average open chat at
     1,600 tokens (the sim counts every open chat at the average); the sizing sheet expects contractors
     to open chats at 4 a minute from 22:00 (one every 15 s) and keep each open 30 minutes; a contractor
     asks something about every 10 minutes and spends the time between on the job.
   - with idle close at 5 minutes: each contractor's 30 minutes become 3 chats of 5 minutes, opened
     at 0, 10 and 20 minutes; the second and third start over without what was pasted before.
   - the old program refuses a chat when its room is all reserved ("assistant busy, try later"), and
     the contractor goes to the permit cabin. The paging engine pauses the newest chat instead and
     resumes the oldest paused chat when room frees; a paused contractor's 30 minutes keep running.
   - card price $2.79 an hour (one provider's list price per card hour, read 16 October 2026);
     730 hours a month: $2,037, two cards $4,073.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e03-v1.0.0.json).
   The night runs in 15-second ticks from 22:00:00 to 23:00:00: at each tick, chats whose time is up
   close, paused chats resume oldest first, then new chats open.
   - the sheet: 1,600 x 128 KB = 204,800 KB = 200 MB; 40 GB = 40,960 MB; 40,960 / 200 = 204.8, 204.
   - the old program at 8,192: 8,192 x 128 KB = 1,048,576 KB = 1 GB a chat; 40 / 1 = 40 fit.
   - 22:10:00: 40 chats open (22:00:00 to 22:09:45), the 41st refused. Held 40 x 1,600 = 64,000
     tokens x 128 KB = 8,000 MB = 7.8 GB (7.8125) of 40 reserved: 19.5% (19.53).
   - 22:15:00: 21 refused (22:10:00 to 22:15:00, every 15 s). The peak, 22:45:00: 120 wanted
     (4 a minute x 30 minutes), 40 held. 23:00:00: 160 of 240 refused (80 got in: 40 by 22:09:45,
     40 more from 22:30:00 to 22:39:45 as the first chats closed).
   - before 24 August, 2,048 tokens: 2,048 x 128 KB = 256 MB; 40,960 / 256 = 160 fit; at the peak
     120 held, 30 GB reserved, 23.4 GB used (23.4375), 78.1%. normal nights since 24 August: at most
     30 chats, 30 GB.
   - pages: 16 x 128 KB = 2 MB a page; 40 GB / 128 KB = 327,680 tokens = 20,480 pages; a 1,600-token
     chat is 100 pages; 20,480 / 100 = 204 average chats. At the peak 120 held, 23.4 GB handed out and
     used, 100%; nobody refused or paused.
   - two cards, same program and settings: 80 fit; 40 refused by 22:45, 80 by 23:00; 19.5% at 22:10.
   - weights in 4 bits: room 56 - 1 - 4 = 51 GB; 51 chats of 1 GB.
   - idle close at 5 minutes: at 22:10 21 chats open; at the peak 60 wanted (120 x 5 / 10), 40 held,
     every slot still 1 GB and 19.5% in use; by 23:00 160 chat openings refused and 362 chats started
     over (a contractor's second and third chats, at 10 and 20 minutes).
   - weights in 4 bits, by 23:00: 138 refused (51 fit instead of 40).
   - the cold case, chats averaging 4,000 tokens with pages: 250 pages a chat; 20,480 / 250 = 81; at the
     peak 120 wanted, 81 held, 39 paused, the longest pause 9 min 45 s (paused at 22:20:15, resumed
     at 22:30:00 when the first chat closed), nobody's 30 minutes ran out while paused; with two cards
     163 fit and nobody waits; with 4-bit weights 104 fit, 16 paused.
   - the first hour: 240 of the 400 night contractors open a chat between 22:00:00 and 22:59:45.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var KB_PER_TOKEN = 2 * 32 * 8 * 128 * 2 / 1024;   // 128
  var KB_PER_GB = 1024 * 1024;
  var PAGE = 16;                                    // tokens a page
  var ARRIVE_EVERY = 15;                            // seconds: 4 a minute
  var CONTRACTORS = 240;                            // 22:00:00 to 22:59:45
  var CHAT_OPEN = 1800;                             // 30 minutes
  var ASK_EVERY = 600;                              // a question about every 10 minutes
  var END = 3600;                                   // 23:00:00
  var PRICE = 2.79;                                 // a card hour
  var LIMITS = [
    { value: "2048", label: "2,048 tokens (until 24 August)" },
    { value: "8192", label: "8,192 tokens (since 24 August)" }
  ];
  var HOLDS = [
    { value: "whole", label: "the whole longest chat, when it opens" },
    { value: "pages", label: "16-token pages, as it grows" }
  ];
  var CARDS = [
    { value: "1", label: "1 card" },
    { value: "2", label: "2 cards, same program" }
  ];
  var IDLE = [
    { value: "off", label: "off" },
    { value: "5", label: "after 5 idle minutes" }
  ];
  var BITS = [
    { value: "16", label: "16 bits (15 GB)" },
    { value: "4", label: "4 bits (about 4 GB, untested)" }
  ];
  var AVGS = [
    { value: "1600", label: "1,600 tokens (the program's count)" },
    { value: "4000", label: "4,000 tokens (whole procedures pasted)" }
  ];
  var MOMENTS = [
    { value: "600", label: "22:10, the 41st contractor" },
    { value: "900", label: "22:15, the cabin fills" },
    { value: "2700", label: "22:45, the peak" },
    { value: "3600", label: "23:00, the first hour" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a second card" },
    { value: "r1", label: "reply 1: back to 2,048 tokens" },
    { value: "r2", label: "reply 2: close idle chats" },
    { value: "r3", label: "reply 3: pages, pause not refuse" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = 22 * 3600 + sec;
    return pad2(Math.floor(s / 3600) % 24) + ":" + pad2(Math.floor(s / 60) % 60) + ":" + pad2(s % 60);
  }
  function gb(kb) { return String(Math.round(kb / KB_PER_GB * 10) / 10); }
  function size(kb) { return kb >= KB_PER_GB ? gb(kb) + " GB" : fmt(Math.round(kb / 1024)) + " MB"; }
  function pct(a, b) { return b ? String(Math.round(a / b * 1000) / 10) + "%" : "0%"; }
  function defaults() {
    return { limit: "8192", hold: "whole", cards: "1", idle: "off", bits: "16", avg: "1600", at: "600", plan: "none" };
  }

  /* ---------- the planner (pure: settings in, figures out) ---------- */

  function calc(C) {
    var cards = Number(C.cards);
    var avg = Number(C.avg);
    var limit = Number(C.limit);
    var paging = C.hold === "pages";
    var roomGB = 56 - 1 - (C.bits === "16" ? 15 : 4);
    var roomKB = roomGB * KB_PER_GB * cards;
    var perChatKB = limit * KB_PER_TOKEN;
    var pagesPer = Math.ceil(avg / PAGE);
    var cap = paging ? Math.floor(roomKB / (PAGE * KB_PER_TOKEN) / pagesPer) : Math.floor(roomKB / perChatKB);
    var reqs = [];
    for (var k = 0; k < CONTRACTORS; k++) {
      var a = k * ARRIVE_EVERY;
      if (C.idle === "off") reqs.push({ s: a, e: a + CHAT_OPEN, again: false });
      else for (var i = 0; i < 3; i++) reqs.push({ s: a + i * ASK_EVERY, e: a + i * ASK_EVERY + 300, again: i > 0 });
    }
    reqs.sort(function (x, y) { return x.s - y.s; });
    var open = [], queue = [], refused = 0, again = 0, firstRefusal = -1, paused = 0, peakPaused = 0, gaveUp = 0;
    var longestWait = 0;
    var snaps = {};
    var r = 0;
    for (var t = 0; t <= END; t += ARRIVE_EVERY) {
      open = open.filter(function (e) { return e > t; });
      var before = queue.length;
      queue = queue.filter(function (p) { return p.e > t; });
      gaveUp += before - queue.length;
      while (queue.length && open.length < cap) {
        var p = queue.shift();
        if (t - p.since > longestWait) longestWait = t - p.since;
        open.push(p.e);
      }
      while (r < reqs.length && reqs[r].s === t) {
        var q = reqs[r++];
        if (q.again) again++;
        if (paging) {
          if (!queue.length && open.length < cap) open.push(q.e);
          else { queue.push({ e: q.e, since: t }); paused++; }
        } else if (open.length < cap) open.push(q.e);
        else { refused++; if (firstRefusal < 0) firstRefusal = t; }
      }
      if (queue.length > peakPaused) peakPaused = queue.length;
      var wanted = 0;
      reqs.forEach(function (x) { if (x.s <= t && x.e > t) wanted++; });
      snaps[t] = { held: open.length, paused: queue.length, refused: refused, again: again, wanted: wanted };
    }
    var S = snaps[Number(C.at)];
    var reservedKB = paging ? S.held * pagesPer * PAGE * KB_PER_TOKEN : S.held * perChatKB;
    var usedKB = S.held * avg * KB_PER_TOKEN;
    var R = {
      cap: cap, snaps: snaps, S: S, reservedKB: reservedKB, usedKB: usedKB, roomKB: roomKB,
      firstRefusal: firstRefusal, peakPaused: peakPaused, pausedTotal: paused, gaveUp: gaveUp,
      longestWait: longestWait,
      sheet: Math.floor(roomKB / (avg * KB_PER_TOKEN))
    };
    R.text = {
      pertoken: fmt(KB_PER_TOKEN * 1024) + " bytes (128 KB)",
      room: gb(roomKB) + " GB",
      cap: paging ? cap + " average chats (" + fmt(roomKB / KB_PER_TOKEN) + " tokens)" :
        cap + " chats (" + size(perChatKB) + " each)",
      sheet: R.sheet + " chats (" + gb(roomKB) + " GB / " + size(avg * KB_PER_TOKEN) + ")",
      reserved: gb(reservedKB) + " of " + gb(roomKB) + " GB",
      used: gb(usedKB) + " GB (" + fmt(S.held * avg) + " tokens)",
      share: pct(usedKB, reservedKB),
      wait: Math.floor(longestWait / 60) + " min " + (longestWait % 60) + " s",
      cost: "$" + (PRICE * cards).toFixed(2) + " an hour"
    };
    return R;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th, mark) {
    var tr = ui.el("tr", mark ? "font-weight:bold;" : "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    var R = calc(C);
    ui.head.textContent = "contractors open chats at 4 a minute from 22:00, each for 30 minutes. room for chats: " +
      R.text.room + "; " + R.text.cap + " fit.";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["moment", "wanted", "held", "refused so far", "paused now", "reserved", "used"], true);
    MOMENTS.forEach(function (m) {
      var D = {};
      for (var k in C) D[k] = C[k];
      D.at = m.value;
      var Q = calc(D);
      row(ui, [clock(Number(m.value)), Q.S.wanted, Q.S.held, Q.S.refused, Q.S.paused, Q.text.reserved, gb(Q.usedKB) + " GB"],
        false, m.value === C.at);
    });
    ui.note.textContent = "each token keeps 2 x 32 layers x 8 x 128 numbers x 2 bytes = 131,072 bytes. " +
      (C.hold === "pages" ? "pages: 16 tokens, 2 MB each, handed out as a chat grows." :
        "whole: " + fmt(Number(C.limit)) + " tokens x 128 KB = " + size(Number(C.limit) * KB_PER_TOKEN) +
        " reserved when a chat opens, whatever it holds.");
  }

  function setStats(api) {
    var R = calc(api.state.C);
    var st = api.state.stat;
    st.pertoken(R.text.pertoken);
    st.room(R.text.room);
    st.cap(R.text.cap);
    st.sheet(R.text.sheet);
    st.wanted(R.S.wanted);
    st.held(R.S.held);
    st.refused(R.S.refused);
    st.paused(R.S.paused);
    st.reserved(R.text.reserved);
    st.used(R.text.used);
    st.share(R.text.share);
    st.again(R.S.again);
    st.wait(R.text.wait);
    st.gaveup(R.gaveUp);
    st.cost(R.text.cost);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = calc(api.state.C);
    var end = R.snaps[END];
    if (what) api.log(what + " by 23:00: " + end.refused + " refused, peak paused " + R.peakPaused + "; at " +
      clock(Number(api.state.C.at)) + " " + R.S.held + " held, " + R.text.share + " of reserved room in use.",
      end.refused ? "bad" : (R.peakPaused ? "warn" : "ok"));
  }

  function playNight(api) {
    var R = calc(defaults());
    var s10 = R.snaps[600], s15 = R.snaps[900], s45 = R.snaps[2700], s60 = R.snaps[END];
    api.log("22:00:00  night shift starts. the program holds " + R.text.cap + "; the sheet says " + R.text.sheet + ".", "");
    api.log("22:09:45  40 chats open: 64,000 tokens, 7.8 GB used of 40 GB reserved, 19.5%. card meter 80 of 80 GB.", "warn");
    api.log("22:10:00  chat 41 refused: assistant busy, try later. " + s10.held + " held, " + s10.refused + " refused.", "bad");
    api.log("22:15:00  " + s15.refused + " refused so far; contractors crowd the permit cabin.", "bad");
    api.log("22:45:00  the peak: " + s45.wanted + " want a chat, " + s45.held + " held.", "bad");
    api.log("23:00:00  first hour: " + s60.refused + " of 240 refused.", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.at = "2700";
    if (plan === "r0") C.cards = "2";
    if (plan === "r1") C.limit = "2048";
    if (plan === "r2") C.idle = "5";
    if (plan === "r3") C.hold = "pages";
    return C;
  }

  function planFollowUp(api, plan) {
    var R = calc(api.state.C);
    var end = R.snaps[END];
    if (plan === "r0") api.log("two cards, same program: " + R.text.cap + ", " + R.text.cost + ". at the peak " +
      R.S.held + " of " + R.S.wanted + " held; " + end.refused + " refused by 23:00; still " + R.text.share + " in use.", "bad");
    if (plan === "r1") api.log("back to 2,048 tokens: " + R.text.cap + ". at the peak " + R.S.held + " of " + R.S.wanted +
      " held, nobody refused; " + R.text.share + " in use. no chat can hold a long procedure.", "warn");
    if (plan === "r2") api.log("idle close at 5 minutes: " + R.S.wanted + " want a chat at the peak, " + R.S.held + " held; " +
      end.refused + " refused by 23:00; " + end.again + " returns to a closed chat, each starting over without what was pasted.", "bad");
    if (plan === "r3") api.log("16-token pages, 8,192 kept: " + R.text.cap + ". at the peak " + R.S.held + " of " + R.S.wanted +
      " held, " + R.text.reserved + " handed out, " + R.text.share + " in use; " + end.refused + " refused, " +
      R.peakPaused + " paused.", "ok");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["limit", "hold", "cards", "idle", "bits", "avg", "at"];
      function syncControls() {
        S.sync = true;
        IDS.forEach(function (id) { S.ctl[id].set(S.C[id]); });
        S.sync = false;
      }
      function chooser(id, label, list) {
        S.ctl[id] = api.control.select(id, label, list, S.C[id], function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          var what = label + ": " + o.label + ".";
          if (S.C.plan !== "none") {
            S.C.plan = "none";
            S.sync = true; S.ctl.plan.set("none"); S.sync = false;
            what += " (reply cleared.)";
          }
          refresh(api, what);
        });
      }
      chooser("limit", "longest allowed chat", LIMITS);
      chooser("hold", "room handed out", HOLDS);
      chooser("cards", "cards", CARDS);
      chooser("idle", "close idle chats", IDLE);
      chooser("bits", "weights", BITS);
      chooser("avg", "average open chat", AVGS);
      chooser("at", "moment shown", MOMENTS);
      S.ctl.night = api.control.button("night", "play the night, 22:00 to 23:00", function () {
        S.C = defaults();
        syncControls();
        S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        draw(api);
        setStats(api);
        playNight(api);
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        pertoken: api.stat("pertoken", "working memory per token", ""),
        room: api.stat("room", "room for chats", ""),
        cap: api.stat("cap", "chats that fit", "warn"),
        sheet: api.stat("sheet", "the sizing sheet's sum", ""),
        wanted: api.stat("wanted", "chats wanted at this moment", ""),
        held: api.stat("held", "chats held", ""),
        refused: api.stat("refused", "refused so far", "bad"),
        paused: api.stat("paused", "paused now", "warn"),
        reserved: api.stat("reserved", "room reserved", ""),
        used: api.stat("used", "room used", ""),
        share: api.stat("share", "share of reserved room in use", "warn"),
        again: api.stat("again", "returns to a closed chat", ""),
        wait: api.stat("wait", "longest pause, first hour", ""),
        gaveup: api.stat("gaveup", "paused until their 30 minutes ran out", "bad"),
        cost: api.stat("cost", "card bill", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one moment of the first hour. The wanted count is contractors who want a chat open; the held count is chats with room on the card. A refused contractor goes to the permit cabin; a paused one waits and resumes when room frees. The reserved figure is room set aside; the used figure is what the chats hold. The bold row is the moment shown.");

      draw(api);
      setStats(api);
      api.log("21:55 on monday 14 september: the first shutdown night shift starts at 22:00. no chats open yet.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before 22:00: the planner shows 22:10 as it will be.
      t.expect(t.stat("pertoken") === "131,072 bytes (128 KB)" && t.stat("room") === "40 GB" &&
        t.stat("cap") === "40 chats (1 GB each)" && t.stat("sheet") === "204 chats (40 GB / 200 MB)" &&
        t.stat("held") === 40 && t.stat("refused") === 1 && t.stat("reserved") === "40 of 40 GB" &&
        t.stat("used") === "7.8 GB (64,000 tokens)" && t.stat("share") === "19.5%" && has("21:55 on monday 14 september"),
        "Opens before 22:00: 128 KB a token, 40 chats of 1 GB, the sheet's 204; at 22:10 40 held, 7.8 of 40 GB, 19.5%");

      // 2. The night as it happened.
      t.click("night");
      t.expect(has("22:10:00  chat 41 refused: assistant busy, try later. 40 held, 1 refused.") &&
        has("22:15:00  21 refused so far") && has("22:45:00  the peak: 120 want a chat, 40 held.") &&
        has("23:00:00  first hour: 160 of 240 refused."),
        "The night: the 41st refused at 22:10, 21 by 22:15, 120 wanted at the peak, 160 of 240 refused by 23:00");

      // 3. Before 24 August: 2,048 tokens.
      t.set("limit", "2048");
      t.set("at", "2700");
      t.expect(t.stat("cap") === "160 chats (256 MB each)" && t.stat("held") === 120 && t.stat("refused") === 0 &&
        t.stat("reserved") === "30 of 40 GB" && t.stat("used") === "23.4 GB (192,000 tokens)" && t.stat("share") === "78.1%",
        "2,048 tokens: 160 fit; at the peak 120 held, 30 GB reserved, 23.4 GB used, 78.1%");

      // 4. Pages, 8,192 kept.
      t.set("limit", "8192");
      t.set("hold", "pages");
      t.expect(t.stat("cap") === "204 average chats (327,680 tokens)" && t.stat("held") === 120 && t.stat("paused") === 0 &&
        t.stat("reserved") === "23.4 of 40 GB" && t.stat("share") === "100%",
        "Pages: 327,680 tokens, 204 average chats; at the peak 120 held, 23.4 GB handed out, 100% in use");

      // 5. The cold case: chats average 4,000 tokens.
      t.set("avg", "4000");
      t.expect(t.stat("cap") === "81 average chats (327,680 tokens)" && t.stat("held") === 81 && t.stat("paused") === 39 &&
        t.stat("refused") === 0 && t.stat("wait") === "9 min 45 s" && t.stat("gaveup") === 0,
        "4,000-token chats with pages: 81 fit; at the peak 81 held, 39 paused up to 9 min 45 s, none refused");

      // 6. The cold case with two cards.
      t.set("cards", "2");
      t.expect(t.stat("cap") === "163 average chats (655,360 tokens)" && t.stat("paused") === 0 && t.stat("held") === 120,
        "4,000-token chats, two cards: 163 fit, nobody paused");

      // 7. Weights in 4 bits, the old way.
      t.set("cards", "1");
      t.set("avg", "1600");
      t.set("hold", "whole");
      t.set("bits", "4");
      t.expect(t.stat("room") === "51 GB" && t.stat("cap") === "51 chats (1 GB each)" && t.stat("held") === 51,
        "4 bits: 51 GB of room, 51 chats of 1 GB");

      // 8. Reply 0: a second card running the same program.
      t.set("plan", "r0");
      t.expect(t.stat("cost") === "$5.58 an hour" && has("two cards, same program: 80 chats (1 GB each), $5.58 an hour. at the peak 80 of 120 held; 80 refused by 23:00; still 19.5% in use."),
        "Reply 0: 80 chats for twice the price, 80 refused by 23:00, still 19.5%");

      // 9. Reply 1: back to 2,048.
      t.set("plan", "r1");
      t.expect(has("back to 2,048 tokens: 160 chats (256 MB each). at the peak 120 of 120 held, nobody refused; 78.1% in use."),
        "Reply 1: 160 fit, 120 held, nobody refused");

      // 10. Reply 2: close idle chats after 5 minutes.
      t.set("plan", "r2");
      t.expect(t.stat("wanted") === 60 && t.stat("held") === 40 && has("idle close at 5 minutes: 60 want a chat at the peak, 40 held;"),
        "Reply 2: 60 wanted at the peak, 40 held, chats started over");

      // 11. Reply 3: pages, pause not refuse.
      t.set("plan", "r3");
      t.expect(has("16-token pages, 8,192 kept: 204 average chats (327,680 tokens). at the peak 120 of 120 held, 23.4 of 40 GB handed out, 100% in use; 0 refused, 0 paused."),
        "Reply 3: 204 average chats, 120 held, nobody refused or paused");

      // 12. Two cards at 22:10 still use 19.5% of what they reserve.
      t.set("cards", "2");
      t.set("hold", "whole");
      t.set("at", "600");
      t.expect(t.stat("held") === 41 && t.stat("share") === "19.5%" && t.stat("refused") === 0,
        "Two cards at 22:10: 41 held, nobody refused yet, 19.5% in use");
    }
  });
})();
