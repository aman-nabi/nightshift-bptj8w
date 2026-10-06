/* sims/s1e03-v1.0.0.js  (published as sims/s1e03.js)
   Case s1e03 "Three Handshakes": one message, eight packets, a stormy satellite link, TCP or UDP.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: Ada's phone sends "Dad, it's not safe to go out tonight." as 8
     packets (one word each) over a lossy satellite link to the keeper's laptop. TCP does the
     three-way handshake, waits for ACKs, resends on a timer that doubles, and hands words over in
     order. UDP sends each packet once and hands over whatever arrives. Controls: protocol, packet
     loss, send, reset. Stats: sent, lost, sent again, handed over, handed over out of order, first
     word time. selfTest covers the behaviours the case teaches.

   Notes:
   - Everything sits inside one function so nothing leaks into the page.
   - All logic runs on real-second timers (api.after). Dots are only a picture of it, so a dropped dot
     changes nothing.
   - The clock runs at 0.25 x real time, so the numbers stay true to a satellite link: a one-way trip
     of 0.6 to 1.4 real seconds is 0.15 to 0.35 s of clock time, and the first retransmission timer
     of 4 real seconds is 1 s of clock time, RFC 6298's starting value. The timer doubles each time it
     runs out, capped at 2 s of clock time here (real TCP allows far longer) so you can watch.
   - The fate of each packet's first trip (lost or not, and how long it takes) is rolled with
     api.rand() the moment Send is pressed, before anything else. After a reset the seed restarts, so
     TCP and UDP meet the same storm on their first trip. Retransmissions roll fresh.
   - Simplifications, also stated in the info panel: handshake messages and ACKs are never lost, and
     the receiver's ACKs name exactly which packet arrived (selective acknowledgement).
*/
(function () {
  "use strict";

  var WORDS = ["Dad,", "it's", "not", "safe", "to", "go", "out", "tonight."];
  var FULL = WORDS.join(" ");
  var N = WORDS.length;

  var SPEED = 0.25;                       // clock seconds per real second (slow motion)
  var START = 2 * 3600 + 13 * 60 + 40;    // 02:13:40, Ada's call in the story
  var GAP = 0.3;                          // real seconds between packets leaving the phone
  var TRIP_MIN = 0.6;                     // real seconds, one way, phone to laptop
  var TRIP_MAX = 1.4;
  var HS_TRIP = 1.0;                      // real seconds, one way, for handshake messages
  var ACK_TRIP = 1.0;                     // real seconds, one way, for ACKs
  var RTO0 = 4;                           // real seconds (1 s of clock time) before the first resend
  var RTO_MAX = 8;                        // real seconds (2 s of clock time) cap for the doubling
  var MAX_TRIES = 12;                     // then TCP gives up and reports the connection broken

  /* Layout: sender, link and receiver in a row, and what the keeper hears underneath. Label widths
     were checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px). */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 330,
    aria: "Packet sim. Ada's phone sends 8 packets through a stormy satellite link to the keeper's laptop, which hands the words to the screen below in the order it receives or reorders them.",
    nodes: [
      { id: "phone", label: "Ada's phone", sub: "sends over TCP", meta: "ready", x: 100, y: 100, w: 150, h: 72, shape: "box", tone: "" },
      { id: "link", label: "Satellite link", sub: "storm eats 20%", meta: "1/4 s each way", x: 370, y: 100, w: 170, h: 72, shape: "cloud", tone: "warn" },
      { id: "keeper", label: "Keeper's laptop", sub: "receiver", meta: "waiting", x: 640, y: 100, w: 170, h: 72, shape: "box", tone: "" },
      { id: "screen", label: "What the keeper hears", sub: "(nothing yet)", meta: "press Send", x: 370, y: 255, w: 600, h: 72, shape: "box", tone: "" }
    ],
    edges: [
      { from: "phone", to: "link", label: "packets" },
      { from: "link", to: "keeper" },
      { from: "keeper", to: "screen" }
    ]
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function center(id) {
    for (var i = 0; i < DIAGRAM.nodes.length; i++) {
      if (DIAGRAM.nodes[i].id === id) return DIAGRAM.nodes[i];
    }
    return { x: 0, y: 0 };
  }

  function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      var a = center(path[i - 1]), b = center(path[i]);
      len += Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    }
    return len;
  }

  function clockSec(realSec) { return realSec * SPEED; }

  function label(i) { return "#" + (i + 1) + " (" + WORDS[i] + ")"; }

  function updateStats(api) {
    var S = api.state;
    S.stat.sent(S.count.sent);
    S.stat.lost(S.count.lost);
    S.stat.retx(S.count.retx);
    S.stat.delivered(S.count.delivered);
    S.stat.ooo(S.count.ooo);
  }

  function setBusy(api, on) {
    var S = api.state;
    S.busy = on;
    S.ctl.send.disable(on);
    S.ctl.proto.disable(on);
  }

  // A dot that takes `duration` real seconds over `path`. A failing dot stops at the link, turns red
  // and fades. Purely visual.
  function sendDot(api, path, duration, cls, fail) {
    var speed = pathLength(path) / Math.max(0.05, duration);
    return api.dot({
      path: path,
      cls: cls,
      r: 5,
      speed: speed,
      onArrive: fail ? function (dot, wp) {
        if (wp !== "link") return;
        dot.cls("dot-fail");
        dot.park();
        api.after(0.5, function () { dot.remove(); });
      } : null
    });
  }

  /* ---------- drawing ---------- */

  function renderStatic(api) {
    var S = api.state;
    api.node("phone").text("sub", S.proto === "tcp" ? "sends over TCP" : "sends over UDP");
    api.node("link").text("sub", "storm eats " + Math.round(S.loss * 100) + "%");
    api.node("link").set(S.loss > 0 ? "warn" : "");
    if (!S.run) api.node("keeper").text("meta", S.proto === "tcp" ? "waiting" : "takes what comes");
  }

  function renderScreen(api, r) {
    var heard = r.heard.length ? r.heard.join(" ") : "(nothing yet)";
    api.node("screen").text("sub", heard);
    var meta = "";
    var keeper = "";
    if (r.proto === "tcp") {
      var held = [];
      for (var k = r.next + 1; k < N; k++) if (r.got[k]) held.push("#" + (k + 1));
      if (r.next >= N) meta = "complete, in order";
      else if (held.length) meta = "held back: " + held.join(" ") + " (waiting for #" + (r.next + 1) + ")";
      else meta = r.gaveUp ? "connection broken" : "listening";
      keeper = r.next >= N ? "all 8 in order" : "next needed: #" + (r.next + 1);
    } else {
      if (r.done) {
        var missing = [];
        for (var j = 0; j < N; j++) if (!r.got[j]) missing.push(WORDS[j]);
        meta = missing.length ? "missing: " + missing.join(" ") : "nothing missing";
      } else {
        meta = "listening";
      }
      keeper = "takes what comes";
    }
    api.node("screen").text("meta", meta);
    api.node("screen").set(r.done ? (meta === "complete, in order" || meta === "nothing missing" ? "ok" : "bad") : "");
    api.node("keeper").text("meta", keeper);
  }

  /* ---------- one message ---------- */

  function send(api) {
    var S = api.state;
    if (S.busy) return;
    var r = {
      proto: S.proto, plan: [], acked: [], got: [], tries: [],
      next: 0, heard: [], maxHanded: -1, resolved: 0,
      firstAt: null, t0: api.clock, done: false, gaveUp: false, lost: 0, retx: 0
    };
    // Roll the storm for every packet's first trip before anything else (see the notes at the top).
    for (var i = 0; i < N; i++) {
      var lostRoll = api.rand();
      var tripRoll = api.rand();
      r.plan.push({ lost: lostRoll < S.loss, trip: TRIP_MIN + tripRoll * (TRIP_MAX - TRIP_MIN) });
      r.acked.push(false);
      r.got.push(false);
      r.tries.push(0);
    }
    S.run = r;
    setBusy(api, true);
    api.node("phone").text("meta", "sending");
    renderScreen(api, r);

    if (r.proto === "tcp") {
      api.log("TCP first opens a connection: three calls before a single word moves.", "");
      handshake(api, r);
    } else {
      api.log("UDP skips the calls. Ada's phone starts sending at once: 8 packets, one word each.", "");
      schedule(api, r);
    }
  }

  function handshake(api, r) {
    var S = api.state;
    api.node("phone").text("meta", "handshake");
    sendDot(api, ["phone", "link", "keeper"], HS_TRIP, "dot-wait", false);
    api.log("SYN: \"Ada's phone calling the keeper's laptop. I'll start counting at 100.\"", "");
    api.after(HS_TRIP, function () {
      if (S.run !== r) return;
      sendDot(api, ["keeper", "link", "phone"], HS_TRIP, "dot-wait", false);
      api.log("SYN-ACK: \"Laptop here, I hear you. I'll start counting at 900.\"", "");
    });
    api.after(2 * HS_TRIP, function () {
      if (S.run !== r) return;
      sendDot(api, ["phone", "link", "keeper"], HS_TRIP, "dot-wait", false);
      api.log("ACK: \"I hear you too.\" A full round trip has gone by. The first word leaves right behind this ACK.", "");
      api.node("phone").text("meta", "sending");
      schedule(api, r);
    });
  }

  function schedule(api, r) {
    for (var i = 0; i < N; i++) {
      (function (k) {
        api.after(k * GAP, function () { transmit(api, r, k); });
      })(i);
    }
  }

  function transmit(api, r, i) {
    var S = api.state;
    if (S.run !== r || r.done) return;
    var first = r.tries[i] === 0;
    r.tries[i] += 1;
    var lost, trip;
    if (first) {
      lost = r.plan[i].lost;
      trip = r.plan[i].trip;
    } else {
      lost = api.rand() < S.loss;
      trip = TRIP_MIN + api.rand() * (TRIP_MAX - TRIP_MIN);
    }
    S.count.sent += 1;
    if (!first) { S.count.retx += 1; r.retx += 1; }
    updateStats(api);
    api.node("phone").text("meta", "sent #" + (i + 1) + (first ? "" : " again"));

    var cls = first ? "dot-req" : "dot-accent";
    if (lost) {
      sendDot(api, ["phone", "link"], trip / 2, cls, true);
      api.after(trip / 2, function () {
        if (S.run !== r) return;
        S.count.lost += 1;
        r.lost += 1;
        updateStats(api);
        if (r.proto === "udp") {
          api.log(label(i) + " is lost in the storm. Nobody will ever ask for it.", "bad");
          resolve(api, r);
        } else {
          api.log(label(i) + " is lost in the storm. The phone doesn't know yet: it's still waiting for an ACK.", "bad");
        }
      });
    } else {
      sendDot(api, ["phone", "link", "keeper"], trip, cls, false);
      api.after(trip, function () { arrive(api, r, i); });
    }
    if (r.proto === "tcp") armTimer(api, r, i);
  }

  function armTimer(api, r, i) {
    var S = api.state;
    var wait = Math.min(RTO0 * Math.pow(2, r.tries[i] - 1), RTO_MAX);
    api.after(wait, function () {
      if (S.run !== r || r.done || r.acked[i]) return;
      if (r.tries[i] >= MAX_TRIES) { giveUp(api, r, i); return; }
      api.log("No ACK for " + label(i) + " after " + clockSec(wait) + " s. The phone sends it again" + (wait < RTO_MAX ? ", and doubles its timer." : "."), "warn");
      transmit(api, r, i);
    });
  }

  function arrive(api, r, i) {
    var S = api.state;
    if (S.run !== r || r.done) return;

    if (r.proto === "udp") {
      r.got[i] = true;
      if (i < r.maxHanded) {
        S.count.ooo += 1;
        api.log(label(i) + " arrives after a later word. UDP hands it over anyway, out of order.", "warn");
      }
      r.maxHanded = Math.max(r.maxHanded, i);
      deliver(api, r, i);
      resolve(api, r);
      return;
    }

    // TCP
    if (r.got[i]) { sendAck(api, r, i); return; }   // a copy we already have: just ACK it again
    r.got[i] = true;
    if (i > r.next) {
      api.log(label(i) + " arrives early. The laptop holds it back, and its ACK says: got #" + (i + 1) + ", still need #" + (r.next + 1) + ".", "");
    }
    while (r.next < N && r.got[r.next]) {
      deliver(api, r, r.next);
      r.next += 1;
    }
    sendAck(api, r, i);
    renderScreen(api, r);
    if (r.next >= N) finish(api, r);
  }

  function sendAck(api, r, i) {
    var S = api.state;
    var upTo = r.next;
    sendDot(api, ["keeper", "link", "phone"], ACK_TRIP, "dot-ok", false);
    api.after(ACK_TRIP, function () {
      if (S.run !== r) return;
      r.acked[i] = true;
      for (var k = 0; k < upTo; k++) r.acked[k] = true;
    });
  }

  function deliver(api, r, i) {
    var S = api.state;
    r.heard.push(WORDS[i]);
    S.count.delivered += 1;
    if (r.firstAt === null) {
      r.firstAt = api.clock - r.t0;
      S.stat.first(r.firstAt.toFixed(2));
    }
    updateStats(api);
    renderScreen(api, r);
  }

  function resolve(api, r) {
    r.resolved += 1;
    if (r.resolved >= N) finish(api, r);
  }

  function finish(api, r) {
    if (r.done) return;
    r.done = true;
    renderScreen(api, r);
    api.node("phone").text("meta", "done");
    setBusy(api, false);
    var heard = r.heard.join(" ");
    if (r.proto === "tcp") {
      api.log("Every word arrived, in order: \"" + heard + "\" " + r.lost + " lost on the way, " + r.retx + " sent again.", "ok");
    } else if (r.lost) {
      api.log("Done. The keeper heard: \"" + heard + "\" " + r.lost + " of 8 words never arrived, and nobody asked for them again.", "bad");
    } else {
      api.log("Done. The keeper heard: \"" + heard + "\" Nothing was lost this time.", "ok");
    }
  }

  function giveUp(api, r, i) {
    if (r.done) return;
    r.gaveUp = true;
    r.done = true;
    renderScreen(api, r);
    api.node("phone").text("meta", "done");
    setBusy(api, false);
    api.log(label(i) + " was sent " + MAX_TRIES + " times with no ACK. TCP gives up and reports the connection broken. The keeper only has the words before the gap.", "bad");
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    phone: function () {
      return "<strong>Ada's phone, the sender.</strong> It cuts the message into 8 packets, one word each, numbered #1 to #8. Over TCP it first makes the three calls of the handshake, then keeps a timer for every packet: no ACK in time, and it sends that packet again. Over UDP it sends each packet once and forgets it.";
    },
    link: function (S) {
      return "<strong>Satellite link.</strong> Up to the satellite and down again, about a quarter of a second each way. Tonight's storm loses about " + Math.round(S.loss * 100) + "% of packets, and trips vary a little, so packets can arrive out of order. To keep things simple, handshake messages and ACKs always get through here. In real life they can be lost too, and TCP copes with that as well.";
    },
    keeper: function () {
      return "<strong>Keeper's laptop, the receiver.</strong> Over TCP it sends an ACK for every packet, holds early packets in a buffer, and hands words over only in order. Over UDP it hands every word over the moment it arrives, in whatever order, and never asks for anything.";
    },
    screen: function () {
      return "<strong>What the keeper hears.</strong> The words the laptop has handed to the call app so far, in the order it handed them over. With TCP that's always the right order, but words wait behind any gap. With UDP a gap just stays a gap.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e03", {
    diagram: DIAGRAM,

    setup: function (api) {
      var S = api.state;
      S.session = {};
      S.busy = false;
      S.proto = "tcp";
      S.loss = 0.2;
      S.run = null;
      S.count = { sent: 0, lost: 0, retx: 0, delivered: 0, ooo: 0 };
      api.speed = SPEED;
      api.clock = START;

      S.ctl = {};
      S.ctl.proto = api.control.select("proto", "Protocol", [
        { value: "tcp", label: "TCP: numbered, confirmed, resent" },
        { value: "udp", label: "UDP: sent once, no confirmations" }
      ], "tcp", function (v) {
        S.proto = String(v) === "udp" ? "udp" : "tcp";
        if (S.proto === "udp") api.log("Switched to UDP: no calls first, no ACKs, nothing sent twice.", "");
        else api.log("Switched to TCP: three calls to open, an ACK for every packet, and anything lost is sent again.", "");
        renderStatic(api);
      });
      S.ctl.loss = api.control.range("loss", "Packets the storm eats", 0, 50, 5, 20, function (v) {
        S.loss = Math.max(0, Math.min(50, Number(v))) / 100;
        renderStatic(api);
      }, { format: function (v) { return v + "%"; } });
      S.ctl.send = api.control.button("send", "Send Ada's message", function () { send(api); }, { tone: "primary", wide: true });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); }, { tone: "ghost" });

      S.stat = {
        sent: api.stat("sent", "packets sent", ""),
        lost: api.stat("lost", "lost in the storm", "bad"),
        retx: api.stat("retx", "sent again", "warn"),
        delivered: api.stat("delivered", "words handed over", "ok"),
        ooo: api.stat("ooo", "handed over out of order", "warn"),
        first: api.stat("first", "first word after (s)", "")
      };
      updateStats(api);
      S.stat.first("not yet");
      renderStatic(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("02:13:40. Ada calls Gull Point over the satellite link. The storm is eating about 1 packet in 5.", "");
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function heard() { return t.node("screen").text.sub; }
      async function finish() {
        for (var w = 0; w < 80 && t.node("phone").text.meta !== "done"; w++) await t.run(2);
      }
      var k;

      // 1. TCP on a calm link: the handshake comes first, then all 8 words in order.
      t.set("loss", 0);
      t.click("send");
      await t.run(1.5);
      t.expect(n("sent") === 0, "TCP sends no words until the handshake has finished");
      await finish();
      t.expect(t.logText().indexOf("SYN-ACK") >= 0, "TCP opens with the three-way handshake: SYN, SYN-ACK, ACK");
      t.expect(n("delivered") === 8 && n("lost") === 0 && n("retx") === 0 && heard() === FULL, "with no storm, TCP hands over all 8 words in order and sends nothing twice");
      var tcpFirst = n("first");

      // 2. UDP on the same calm link: no handshake, so the first word arrives sooner.
      t.click("reset");
      t.set("proto", "udp");
      t.set("loss", 0);
      t.click("send");
      await t.run(1.5);
      t.expect(n("sent") > 0, "UDP starts sending at once");
      await finish();
      t.expect(t.logText().indexOf("SYN") < 0, "UDP never makes the handshake calls");
      t.expect(n("first") < tcpFirst, "the handshake costs TCP a round trip: its first word arrives later than UDP's");

      // 3. UDP in a heavy storm: lost words stay lost.
      t.click("reset");
      t.set("proto", "udp");
      t.set("loss", 50);
      for (k = 0; k < 6 && n("lost") === 0; k++) {
        t.click("send");
        await finish();
      }
      t.expect(n("lost") > 0 && n("retx") === 0, "UDP never sends a lost packet again");
      t.expect(n("delivered") === n("sent") - n("lost"), "with UDP, every lost packet is simply gone");
      t.expect(heard() !== FULL, "the keeper hears a message with words missing");

      // 4. TCP in the same storm: every lost packet is sent again, and the message arrives whole and in order.
      t.click("reset");
      t.set("loss", 50);
      for (k = 0; k < 6 && n("lost") === 0; k++) {
        t.click("send");
        await finish();
      }
      t.expect(n("lost") > 0 && n("retx") === n("lost"), "TCP sends every lost packet again");
      t.expect(heard() === FULL && n("ooo") === 0 && n("delivered") % 8 === 0, "TCP still hands over the whole message, in order");
    }
  });
})();
