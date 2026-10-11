/* sims/s4e02-v1.0.0.js  (published as sims/s4e02.js)
   Case s4e02 "The Line That Stays Open": a connection lab for the Nightjar Line, a text crisis line.
   One conversation, between texter 0417 and the volunteer Ezinne, is replayed message by message
   through the transport the learner picks, behind a load balancer with an idle timeout. The lab
   shows when each of the texter's messages reaches Ezinne's screen (or that it never did until the
   refresh), the transcript as stored, and the requests a minute the transport costs for every
   volunteer on shift. Widget-style sim: it draws its own transcript table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: six transports (poll every 5 s, poll every 1 s, long poll,
     WebSocket as built, WebSocket with heartbeat and resend, server-sent events with
     Last-Event-ID), heartbeat interval, idle timeout, volunteers on shift, and "Cut the line" (the
     volunteer's router restarts at 02:21:21 for 30 s). Buttons: Next event, Play to the end, Reset.
     Stats: clock, texts in, on screen, missing from the screen, shown only by the refresh,
     longest wait, requests a minute, heartbeats a minute, connections held open, what you build.
     selfTest: 11 assertions.

   The model (stated in sim.lede). Times are whole seconds; t counts from 02:00:00.
   - 02:11:00 (t 660): Ezinne takes the conversation and the dashboard connects. The replay ends
     at 02:32:00 (t 1920).
   - Ezinne's replies go out by POST, each a new request, and reach the texter at once. They never
     touch the WebSocket or event stream, so they never reset its idle clock.
   - The texter's messages are stored by the server first (with ids 1 to 10), then delivered.
   - Idle timeout: a held connection with no data for the timeout (60 s as built) is closed by the
     load balancer. Only data on that connection resets the clock: a pushed text or a heartbeat.
   - Poll every P s: a request at 02:11:00 and every P s after; a text shows at the first poll at
     or after it. Long poll: the request is held until a text arrives (shown at once) or for 30 s,
     or until the idle timeout if that is shorter; then the dashboard asks again at once.
   - WebSocket as built: no heartbeat, and nothing handles a closed socket. Texts sent after the
     close are stored but never shown until the page is refreshed.
   - WebSocket with heartbeat and resend, and SSE with Last-Event-ID: a heartbeat (a ping frame,
     or an SSE comment line) goes out when the connection has carried nothing for the heartbeat
     interval. A heartbeat equal to the timeout or longer is too late: the timeout fires first.
     After a close or a break the browser reconnects 3 s later (the sim's retry time; the SSE
     standard leaves the default to the browser), every 3 s until it gets through, and the server
     resends every text after the last one the screen had.
   - The refresh at 02:31:08 (the shift lead's check) reloads the stored transcript in every mode,
     and a WebSocket as built opens a new socket.
   - Requests a minute, all volunteers, on a quiet minute: poll, volunteers x 60 / P; long poll,
     volunteers x 60 / min(30, timeout); WebSocket and SSE with a heartbeat inside the timeout, 0
     (heartbeats are frames or comment lines inside the connection, not requests); with no
     heartbeat (or one too late), a reconnect every timeout + 3 s, rounded; WebSocket as built, 0.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e02-v1.0.0.json).
   - Texter's messages at 02:11:12, 02:11:57, 02:12:43, 02:14:08, 02:15:53, 02:18:17, 02:21:31,
     02:25:22, 02:28:34, 02:31:53. Ezinne's replies at 02:11:30, 02:12:20, 02:13:20, 02:15:30,
     02:17:40, 02:22:10, 02:27:45, 02:31:25. The idle gap: 02:12:43 to 02:14:08, 85 s.
   - As built: the socket closes at 02:13:43 (02:12:43 + 60 s). Six texts (02:14:08 to 02:28:34)
     go into the closed socket and first appear at the refresh, 02:31:08; the oldest waited
     17:00, from 02:14:08. Four texts are seen live. 17 minutes = 02:14:08 to 02:31:08. Ezinne
     sends four replies into the silence (02:15:30, 02:17:40, 02:22:10, 02:27:45), and the
     texter reads every one.
   - Idle timeout 120 s, as built: closes at 02:17:53 (02:15:53 + 120 s); 4 missing, oldest 12:51
     (02:18:17 to 02:31:08). 3600 s: nothing missing that night.
   - Cut the line (02:21:21 to 02:21:51), timeout 3600, as built: 3 missing, the oldest 9:37
     (02:21:31 to 02:31:08). Heartbeat 20 s with resend, or SSE: the 02:21:31 text is resent at
     02:21:51, 0:20 late; nothing missing. Long poll and poll every 1 s: 0:20; every 5 s: 0:24.
   - 120 volunteers on shift: poll 5 s 1,440 requests a minute; poll 1 s 7,200; long poll 240;
     WebSocket and SSE with a 20 s heartbeat 0 requests and 360 heartbeats a minute; SSE with the
     heartbeat at 90 s (too late) 114 (120 x 60 / 63). 300 volunteers: poll 1 s 18,000.
   - Poll 5 s, the story's night: the slowest text waits 0:04 (02:21:31 shown at 02:21:35). Poll
     1 s, long poll, WebSocket with heartbeat, SSE: every text 0:00 (the sim counts whole seconds).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var T0 = 660;          // 02:11:00
  var END = 1920;        // 02:32:00
  var REFRESH = 1868;    // 02:31:08
  var CUT_AT = 1281;     // 02:21:21
  var CUT_FOR = 30;
  var RETRY = 3;
  var HOLD = 30;

  var MSGS = [
    { t: 672, who: "T", text: "hi. is anyone actually there" },
    { t: 690, who: "V", text: "Hi, I'm here. I'm Ezinne. What's keeping you up tonight?" },
    { t: 717, who: "T", text: "cant sleep. the house is too quiet since my sister moved away" },
    { t: 740, who: "V", text: "That sounds lonely. How long has it been this quiet?" },
    { t: 763, who: "T", text: "three weeks" },
    { t: 800, who: "V", text: "Three weeks is a long time. Take your time, I'm not going anywhere." },
    { t: 848, who: "T", text: "sorry, was making tea. it helps that someone's there" },
    { t: 930, who: "V", text: "Are you still with me?" },
    { t: 953, who: "T", text: "yes. i just said. i was making tea" },
    { t: 1060, who: "V", text: "It's okay if you need a minute. I'll be right here." },
    { t: 1097, who: "T", text: "did you get my messages?" },
    { t: 1291, who: "T", text: "you keep asking if i'm here. i am here" },
    { t: 1330, who: "V", text: "I'm still here whenever you want to talk." },
    { t: 1522, who: "T", text: "is this a robot" },
    { t: 1665, who: "V", text: "If you've had to step away, you can text this number any time tonight." },
    { t: 1714, who: "T", text: "please don't go" },
    { t: 1885, who: "V", text: "I'm so sorry. My screen stopped showing your messages. I can see them all now, and I'm here." },
    { t: 1913, who: "T", text: "oh. ok. i thought i was talking to no one" }
  ];

  var TRANSPORTS = [
    { value: "poll5", label: "Poll every 5 s (the old dashboard)" },
    { value: "poll1", label: "Poll every 1 s" },
    { value: "long", label: "Long poll (held up to 30 s)" },
    { value: "ws", label: "WebSocket, as built" },
    { value: "wsx", label: "WebSocket with heartbeat, acks and resend" },
    { value: "sse", label: "Server-sent events with Last-Event-ID" }
  ];
  var OPENS = {
    poll5: "The dashboard starts polling every 5 s.",
    poll1: "The dashboard starts polling every 1 s.",
    long: "The dashboard sends its first long poll.",
    ws: "The dashboard opens a WebSocket.",
    wsx: "The dashboard opens a WebSocket with heartbeats and acknowledgements.",
    sse: "The dashboard opens an event stream with EventSource."
  };
  var BUILD = {
    poll5: "a fetch of texts since the last one",
    poll1: "a fetch of texts since the last one",
    long: "a held request and a fetch since the last one",
    ws: "nothing more (as built)",
    wsx: "heartbeat, reconnect, numbering, acks, resend",
    sse: "an id per event, resend after an id, heartbeat"
  };
  var HEARTS = [0, 15, 20, 30, 45, 60, 90];
  var TIMEOUTS = [30, 60, 120, 3600];
  var VOLS = [120, 300];

  /* ---------- small helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t) { return pad(2 + Math.floor(t / 3600)) + ":" + pad(Math.floor(t / 60) % 60) + ":" + pad(t % 60); }
  function mmss(d) { return Math.floor(d / 60) + ":" + pad(d % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function inList(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i]) === String(v)) return list[i];
    return null;
  }
  function pickT(v) {
    for (var i = 0; i < TRANSPORTS.length; i++) if (TRANSPORTS[i].value === String(v)) return TRANSPORTS[i].value;
    return null;
  }
  function isPoll(tr) { return tr === "poll5" || tr === "poll1"; }
  function held(tr) { return tr === "ws" || tr === "wsx" || tr === "sse"; }
  function resumes(tr) { return tr === "wsx" || tr === "sse"; }
  function hbOn(C) { return resumes(C.tr) && C.hb > 0; }
  function hbInside(C) { return hbOn(C) && C.hb < C.timeout; }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function reqPerMin(C) {
    if (C.tr === "poll5") return C.vols * 12;
    if (C.tr === "poll1") return C.vols * 60;
    if (C.tr === "long") return Math.round(C.vols * 60 / Math.min(HOLD, C.timeout));
    if (C.tr === "ws") return 0;
    return hbInside(C) ? 0 : Math.round(C.vols * 60 / (C.timeout + RETRY));
  }
  function hbPerMin(C) { return hbInside(C) ? Math.round(C.vols * 60 / C.hb) : 0; }
  function openConns(C) { return isPoll(C.tr) ? 0 : C.vols; }

  function quote(m) { return "\"" + m.text + "\""; }

  // Replays the night second by second. Returns the events in order and, for each text, when it
  // reached Ezinne's screen and whether only the refresh showed it.
  function simulate(C) {
    var ev = [];
    var texts = [];
    var pending = [];
    var P = C.tr === "poll5" ? 5 : 1;
    var open = false;
    var lastData = 0;
    var nextTry = -1;
    var reqStart = 0;
    var lastShownId = 0;
    var cutDone = false;
    var nextId = 1;
    var byT = {};
    MSGS.forEach(function (m) { byT[m.t] = m; });

    function out(t) { return C.cut && t >= CUT_AT && t < CUT_AT + CUT_FOR; }
    function show(t, how) {
      var n = pending.length;
      pending.forEach(function (x) {
        x.seen = t;
        x.how = how;
        if (x.id > lastShownId) lastShownId = x.id;
      });
      pending = [];
      return n;
    }
    function add(t, kind, text, tone, extra) {
      var e = { t: t, kind: kind, text: clock(t) + "  " + text, tone: tone || "" };
      if (extra) e.ref = extra;
      ev.push(e);
    }

    for (var t = T0; t <= END; t++) {
      if (t === T0) {
        add(t, "open", "Ezinne takes texter 0417. " + OPENS[C.tr], "");
        open = true;
        lastData = t;
        reqStart = t;
      }
      // The router restarts.
      if (C.cut && t === CUT_AT && !cutDone) {
        cutDone = true;
        if (!isPoll(C.tr)) {
          open = false;
          if (resumes(C.tr) || C.tr === "long") nextTry = t + RETRY;
        }
        add(t, "cut", "Ezinne's router restarts. Her connection breaks for 30 s.", "warn");
      }
      // The load balancer's idle timeout on a held connection.
      if (held(C.tr) && open && t - lastData >= C.timeout) {
        open = false;
        if (resumes(C.tr)) {
          nextTry = t + RETRY;
          add(t, "close", "The load balancer closes the " + (C.tr === "sse" ? "event stream" : "WebSocket") + ": " + C.timeout +
            " s with no data. The browser sees it and will reconnect.", "warn");
        } else {
          add(t, "close", "The load balancer closes the WebSocket: " + C.timeout + " s with no data. Nobody notices.", "bad");
        }
      }
      // A held long poll answered empty, or cut by the load balancer.
      if (C.tr === "long" && open && t - reqStart >= Math.min(HOLD, C.timeout)) reqStart = t;
      // Reconnect after a close or a break.
      if (!open && nextTry >= 0 && t >= nextTry) {
        if (out(t)) {
          nextTry = t + RETRY;
        } else {
          open = true;
          nextTry = -1;
          lastData = t;
          reqStart = t;
          var from = lastShownId;
          var n = show(t, "resend");
          if (C.tr === "sse") {
            add(t, "reconnect", "Reconnected with Last-Event-ID " + from + "; the server resends " + n + (n === 1 ? " text." : " texts."), n ? "warn" : "ok");
          } else if (C.tr === "wsx") {
            add(t, "reconnect", "Reconnected; the server resends every text after number " + from + ": " + n + ".", n ? "warn" : "ok");
          } else {
            add(t, "reconnect", "The long poll gets through again and collects " + n + (n === 1 ? " text." : " texts."), n ? "warn" : "ok");
          }
        }
      }
      // A heartbeat before the connection goes quiet for too long.
      if (open && hbOn(C) && t - lastData >= C.hb) lastData = t;
      // The refresh: the shift lead's check.
      if (t === REFRESH) {
        var oldest = pending.length ? t - pending[0].t : 0;
        var k = show(t, "refresh");
        if (C.tr === "ws") { open = true; lastData = t; }
        add(t, "refresh", "The shift lead has Ezinne refresh. " + (k ? k + " texts appear for the first time, the oldest " + mmss(oldest) + " late." : "Nothing new appears."), k ? "bad" : "ok");
      }
      // A message.
      var m = byT[t];
      if (m && m.who === "V") {
        add(t, "reply", "Ezinne: " + quote(m) + " Sent by POST; it reaches the texter.", "");
      } else if (m) {
        var x = { id: nextId++, t: t, text: m.text, seen: null, how: "" };
        texts.push(x);
        pending.push(x);
        if (open && (held(C.tr) || C.tr === "long")) {
          show(t, "live");
          lastData = t;
          if (C.tr === "long") reqStart = t;
        }
        add(t, "text", "", "", x);
      }
      // A poll.
      if (isPoll(C.tr) && (t - T0) % P === 0 && !out(t)) show(t, "poll");
    }
    // Texts' log lines, now that every arrival time is known.
    ev.forEach(function (e) {
      if (e.kind !== "text") return;
      var x = e.ref;
      var s = "Texter: " + quote(x) + " ";
      if (x.how === "refresh") {
        s += "Stored and sent, but the " + (C.tr === "ws" ? "socket is closed" : "connection is down") + ". Not on Ezinne's screen.";
        e.tone = "bad";
      } else if (x.seen === x.t) {
        s += "On Ezinne's screen at once.";
        e.tone = "ok";
      } else {
        s += "On Ezinne's screen at " + clock(x.seen) + ", " + mmss(x.seen - x.t) + " late.";
        e.tone = x.seen - x.t > 5 ? "warn" : "";
      }
      e.text = clock(x.t) + "  " + s;
    });
    var byRefresh = texts.filter(function (x) { return x.how === "refresh"; }).length;
    var longest = 0;
    texts.forEach(function (x) { if (x.seen !== null && x.seen - x.t > longest) longest = x.seen - x.t; });
    return { ev: ev, texts: texts, byRefresh: byRefresh, live: texts.length - byRefresh, longest: longest };
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["sent", "from", "message", "on Ezinne's screen"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 6px;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var foot = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(foot);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, foot: foot };
  }

  // What Ezinne's screen says about a text at time now.
  function screenCell(x, now) {
    if (x.seen !== null && x.seen <= now) {
      if (x.seen === x.t) return ["at once", "ok"];
      return [clock(x.seen) + (x.how === "refresh" ? " (refresh), " : ", ") + mmss(x.seen - x.t) + " late", x.how === "refresh" ? "bad" : "warn"];
    }
    return [x.how === "refresh" ? "not on screen" : "waiting", x.how === "refresh" ? "bad" : "warn"];
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    var el = ui.el;
    var now = S.now;
    clear(ui.tbody);
    MSGS.forEach(function (m) {
      if (m.t > now) return;
      var tr = el("tr");
      var cells;
      var tone = "";
      if (m.who === "V") {
        cells = [clock(m.t), "Ezinne (POST)", m.text, "sent by her"];
      } else {
        var x = null;
        R.texts.forEach(function (y) { if (y.t === m.t) x = y; });
        var sc = screenCell(x, now);
        tone = sc[1];
        cells = [clock(m.t), "texter 0417", m.text, sc[0]];
      }
      cells.forEach(function (c, i) {
        var td = el("td", "padding:2px 6px;vertical-align:top;", c);
        if (i === 3 && tone) td.className = "st-" + tone;
        tr.appendChild(td);
      });
      ui.tbody.appendChild(tr);
    });
    ui.head.textContent = "Transport: " + S.label + ". Idle timeout " + C.timeout + " s. Heartbeat " +
      (hbOn(C) ? "every " + C.hb + " s" + (hbInside(C) ? "" : " (too late: not inside the timeout)") : (resumes(C.tr) ? "off" : "none")) +
      ". " + (C.cut ? "Ezinne's router restarts at 02:21:21 for 30 s." : "No other break.");
    ui.foot.textContent = now < T0 ? "Before 02:11:00. Press Next event or Play to the end." :
      "Rows are in the order they were sent: the stored transcript, as the refresh shows it.";

    var arrived = 0;
    var shown = 0;
    var byRef = 0;
    var longest = 0;
    R.texts.forEach(function (x) {
      if (x.t > now) return;
      arrived += 1;
      if (x.seen !== null && x.seen <= now) {
        shown += 1;
        if (x.how === "refresh") byRef += 1;
        if (x.seen - x.t > longest) longest = x.seen - x.t;
      }
    });
    S.stat.clock(now < T0 ? "not started" : clock(now));
    S.stat.texts(arrived);
    S.stat.shown(shown);
    S.stat.missing(arrived - shown);
    S.stat.refresh(byRef);
    S.stat.wait(mmss(longest));
    S.stat.req(fmt(reqPerMin(C)));
    S.stat.hb(fmt(hbPerMin(C)));
    S.stat.conns(fmt(openConns(C)));
    S.stat.build(BUILD[C.tr]);
    S.ctl.next.disable(S.i >= R.ev.length);
    S.ctl.play.disable(S.i >= R.ev.length);
  }

  function summary(R) {
    return clock(END) + "  End of the replay. " + R.texts.length + " texts from texter 0417: " + R.live + " on screen live, " +
      R.byRefresh + " only after the refresh. Longest wait " + mmss(R.longest) + ".";
  }

  // Back to the opening state: before 02:11:00, nothing sent.
  function rewind(api, what) {
    var S = api.state;
    S.R = simulate(S.C);
    S.i = 0;
    S.now = T0 - 1;
    S.label = "";
    TRANSPORTS.forEach(function (o) { if (o.value === S.C.tr) S.label = o.label; });
    if (what) api.log(what + " Replay from 02:11:00. Requests a minute for " + S.C.vols + " volunteers: " + fmt(reqPerMin(S.C)) + ".", "");
    draw(api);
  }

  function stepOne(api) {
    var S = api.state;
    if (S.i >= S.R.ev.length) return false;
    var e = S.R.ev[S.i];
    S.i += 1;
    S.now = e.t;
    api.log(e.text, e.tone);
    if (S.i >= S.R.ev.length) {
      S.now = END;
      api.log(summary(S.R), S.R.byRefresh ? "bad" : "ok");
    }
    return true;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s4e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { tr: "ws", hb: 20, timeout: 60, vols: 120, cut: false };
      S.ui = buildWidget(api);
      S.simulate = simulate;

      S.ctl = {};
      S.ctl.transport = api.control.select("transport", "How texts reach the dashboard", TRANSPORTS, "ws", function (v) {
        var x = pickT(v);
        if (!x) return;
        S.C.tr = x;
        var lab = "";
        TRANSPORTS.forEach(function (o) { if (o.value === x) lab = o.label; });
        rewind(api, "Transport: " + lab + ".");
      });
      S.ctl.hb = api.control.select("hb", "Heartbeat interval (with heartbeats only)",
        HEARTS.map(function (h) { return { value: h, label: h ? h + " s" : "off" }; }), 20, function (v) {
          var x = inList(HEARTS, num(v));
          if (x === null) return;
          S.C.hb = x;
          rewind(api, "Heartbeat: " + (x ? "every " + x + " s." : "off."));
        });
      S.ctl.timeout = api.control.select("timeout", "Load balancer idle timeout",
        TIMEOUTS.map(function (s) { return { value: s, label: fmt(s) + " s" }; }), 60, function (v) {
          var x = inList(TIMEOUTS, num(v));
          if (x === null) return;
          S.C.timeout = x;
          rewind(api, "Idle timeout: " + fmt(x) + " s.");
        });
      S.ctl.vols = api.control.select("vols", "Volunteers on shift",
        VOLS.map(function (n) { return { value: n, label: String(n) }; }), 120, function (v) {
          var x = inList(VOLS, num(v));
          if (x === null) return;
          S.C.vols = x;
          rewind(api, "Volunteers on shift: " + x + ".");
        });
      S.ctl.cut = api.control.toggle("cut", "Cut the line: Ezinne's router restarts at 02:21:21 for 30 s", false, function (on) {
        S.C.cut = !!on;
        rewind(api, "Router restart at 02:21:21: " + (on ? "on." : "off."));
      });
      S.ctl.next = api.control.button("next", "Next event", function () { stepOne(api); draw(api); });
      S.ctl.play = api.control.button("play", "Play to the end", function () {
        while (stepOne(api)) { /* every event in turn */ }
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        clock: api.stat("clock", "time", ""),
        texts: api.stat("texts", "texts from the texter so far", ""),
        shown: api.stat("shown", "on Ezinne's screen", "ok"),
        missing: api.stat("missing", "sent but not on her screen", "bad"),
        refresh: api.stat("refresh", "shown only by the refresh", "bad"),
        wait: api.stat("wait", "longest wait for a text (m:ss)", "warn"),
        req: api.stat("req", "requests a minute, all volunteers", ""),
        hb: api.stat("hb", "heartbeats a minute, all volunteers", ""),
        conns: api.stat("conns", "connections held open", ""),
        build: api.stat("build", "what you build for delivery", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one message, in the order it was sent. Ezinne's replies go out by POST and always reach the texter. The texter's texts are stored by the server, then reach Ezinne's screen by the transport you pick: the last column says when, or that it never did until the refresh at 02:31:08. The load balancer closes a held connection that carries nothing for the idle timeout.");

      rewind(api, "");
      api.log("Saturday night replay, texter 0417 and Ezinne, from 02:11:00. Transport: WebSocket, as built. Idle timeout 60 s. 120 volunteers on shift.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      function has(s) { return since().indexOf(s) >= 0; }
      function all(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before 02:11:00.
      t.expect(t.stat("clock") === "not started" && t.stat("texts") === 0 && t.stat("shown") === 0 && t.stat("missing") === 0 &&
        t.stat("refresh") === 0 && t.stat("wait") === "0:00" && t.stat("req") === 0 && t.stat("conns") === 120 &&
        all("Saturday night replay, texter 0417 and Ezinne, from 02:11:00."),
        "Opens before 02:11:00: WebSocket as built, nothing sent, 0 requests a minute, 120 connections held open");

      // 2. Step through the start: the socket closes at 02:13:43 and nobody notices.
      begin();
      for (var i = 0; i < 8; i++) t.click("next");
      t.expect(has("02:11:00  Ezinne takes texter 0417. The dashboard opens a WebSocket.") &&
        has("02:12:43  Texter: \"three weeks\" On Ezinne's screen at once.") &&
        has("02:13:20  Ezinne: \"Three weeks is a long time. Take your time, I'm not going anywhere.\" Sent by POST; it reaches the texter.") &&
        has("02:13:43  The load balancer closes the WebSocket: 60 s with no data. Nobody notices.") &&
        t.stat("clock") === "02:13:43" && t.stat("shown") === 3 && t.stat("missing") === 0,
        "As built: 3 texts on screen, then the socket closes at 02:13:43, 60 s after the last text, and nobody notices");

      // 3. The next text goes into the dead socket.
      begin();
      t.click("next");
      t.expect(has("02:14:08  Texter: \"sorry, was making tea. it helps that someone's there\" Stored and sent, but the socket is closed. Not on Ezinne's screen.") &&
        t.stat("missing") === 1 && t.stat("shown") === 3,
        "02:14:08: the texter's next message is stored but never reaches Ezinne's screen");

      // 4. Play on: 17 minutes, six texts, the refresh.
      begin();
      t.click("play");
      t.expect(has("02:31:08  The shift lead has Ezinne refresh. 6 texts appear for the first time, the oldest 17:00 late.") &&
        has("02:32:00  End of the replay. 10 texts from texter 0417: 4 on screen live, 6 only after the refresh. Longest wait 17:00.") &&
        t.stat("refresh") === 6 && t.stat("wait") === "17:00" && t.stat("shown") === 10 && t.stat("missing") === 0,
        "As built: 6 texts from 02:14:08 to 02:28:34 appear only at the 02:31:08 refresh, the oldest 17:00 late; 4 seen live");

      // 5. Polling: nothing lost; every 5 s up to 0:04 late at 1,440 requests a minute, every 1 s at 7,200.
      t.set("transport", "poll5");
      t.click("play");
      var p5 = t.stat("req") === "1,440" && t.stat("wait") === "0:04" && t.stat("refresh") === 0 &&
        all("02:21:31  Texter: \"you keep asking if i'm here. i am here\" On Ezinne's screen at 02:21:35, 0:04 late.");
      t.set("transport", "poll1");
      t.click("play");
      var p1 = t.stat("req") === "7,200" && t.stat("wait") === "0:00" && t.stat("refresh") === 0 && t.stat("conns") === 0;
      t.set("vols", 300);
      t.expect(p5 && p1 && t.stat("req") === "18,000",
        "Polling: every 5 s waits up to 0:04 at 1,440 requests a minute; every 1 s, 7,200, and 18,000 with 300 volunteers; nothing missing");
      t.set("vols", 120);

      // 6. Raise the idle timeout: 120 s still loses 4; 3600 s loses nothing that night.
      t.set("transport", "ws");
      t.set("timeout", 120);
      t.click("play");
      var w120 = t.stat("refresh") === 4 && t.stat("wait") === "12:51" && all("02:17:53  The load balancer closes the WebSocket: 120 s with no data. Nobody notices.");
      t.set("timeout", 3600);
      t.click("play");
      t.expect(w120 && t.stat("refresh") === 0 && t.stat("wait") === "0:00",
        "WebSocket as built: a 120 s timeout closes at 02:17:53 and hides 4 texts (12:51); 3600 s hides none that night");

      // 7. With the timeout at 3600 s, a router restart: as built, 3 hidden until the refresh.
      t.set("cut", true);
      begin();
      t.click("play");
      t.expect(has("02:21:21  Ezinne's router restarts. Her connection breaks for 30 s.") && t.stat("refresh") === 3 && t.stat("wait") === "9:37",
        "Timeout 3600 s, router restart at 02:21:21: 3 texts hidden until the refresh, the oldest 9:37");

      // 8. WebSocket with heartbeat and resend: the same break costs 20 s, nothing missing.
      t.set("timeout", 60);
      t.set("transport", "wsx");
      begin();
      t.click("play");
      t.expect(has("02:21:51  Reconnected; the server resends every text after number 6: 1.") && t.stat("refresh") === 0 &&
        t.stat("wait") === "0:20" && t.stat("req") === 0 && t.stat("hb") === 360 &&
        t.stat("build") === "heartbeat, reconnect, numbering, acks, resend",
        "WebSocket with a 20 s heartbeat and resend: never idles out, the break costs 0:20, 0 requests and 360 heartbeats a minute");

      // 9. SSE with Last-Event-ID: the same outcome, less to build.
      t.set("transport", "sse");
      begin();
      t.click("play");
      t.expect(has("02:21:51  Reconnected with Last-Event-ID 6; the server resends 1 text.") && t.stat("refresh") === 0 &&
        t.stat("wait") === "0:20" && t.stat("req") === 0 && t.stat("build") === "an id per event, resend after an id, heartbeat",
        "SSE with a 20 s heartbeat: resumes from Last-Event-ID 6 after the break, 0:20 late, nothing missing, 0 requests a minute");

      // 10. A heartbeat that isn't inside the timeout: the stream closes and reconnects, still nothing lost.
      t.set("cut", false);
      t.set("hb", 90);
      var ev = t.api.state.R.ev;
      t.expect(ev[7].text === "02:13:43  The load balancer closes the event stream: 60 s with no data. The browser sees it and will reconnect." &&
        ev[8].text === "02:13:46  Reconnected with Last-Event-ID 3; the server resends 0 texts." &&
        t.api.state.R.byRefresh === 0 && t.stat("req") === 114 && t.stat("hb") === 0,
        "SSE with the heartbeat at 90 s: closed at 02:13:43, back at 02:13:46 from Last-Event-ID 3, nothing missing, 114 reconnects a minute");

      // 11. Long poll: every text at once, 240 requests a minute.
      t.set("hb", 20);
      t.set("transport", "long");
      t.click("play");
      t.expect(t.stat("req") === 240 && t.stat("wait") === "0:00" && t.stat("refresh") === 0 && t.stat("conns") === 120,
        "Long poll held up to 30 s: every text at once, 240 requests a minute for 120 volunteers");
    }
  });
})();
