/* sims/s8e05-v1.0.0.js  (published as sims/s8e05.js)
   Case s8e05 "Never Trust the Clock": a clock lab for a lettings agency's midnight offer deadline.
   Two servers, A and B, take offers on one flat and stamp each with a time; the flat goes to the
   highest offer stamped before 00:00:00.0. On the night of Friday 27 November 2026, server B's
   clock ran 900 ms behind, so an answer sent after midnight was stamped before the offer it
   answered and won. The learner sets B's clock, the time sync, how offers are stamped, waiting out
   the uncertainty and a deadline extension, then steps or plays 23:59:58.0 to 00:00:01.0 real time
   in 100 ms steps (later when offers are held) and reads each offer's stamp, the order the record
   shows, the real order, each offer's wait and the winner.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls B's clock behind (0 to 1,000 ms), time sync, stamps
     (server clock, phone, hybrid logical clock), wait out the uncertainty (off, 100 ms or 1,000 ms
     either way), deadline extension; step 100 ms, play to the end, reset. Stats: B's clock behind,
     B's sync tries blocked a day, B-208's stamp, answers sorted before their question, offers ruled
     late, each counted offer held for, window closes at, the flat. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e05-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Times are real time in ms from midnight (negative before). Server A's clock is right.
   - B's clock behind: B's last good sync was at 12:00 on Thursday 5 November 2026, which set it
     right; the firewall change then blocked every try. 12:00 Thu 5 Nov to 00:00 Sat 28 Nov is
     22.5 days; at 40 ms a day that is 900 ms. Hourly sync tries: 24 a day; every minute: 1,440.
     With the firewall reopened and sync every minute, B stays within 40 / 1,440 = 0.03 ms: 0 here.
   - Offers (ids count per server): B-207 Fleur 1,925 sent 23:59:52.0 on B, stamped 23:59:51.1;
     A-311 Ifeanyi 1,950 sent 23:59:59.6 on A, answers B-207, stamped 23:59:59.6; B-208 Fleur 1,975
     sent 500 ms after A-311 appeared, 00:00:00.1, answers A-311, stamped 00:00:00.1 - 0.9 =
     23:59:59.2; A-312 Ifeanyi 2,000 sent 600 ms after B-208 appeared, 00:00:00.7, answers B-208,
     stamped 00:00:00.7, late. B's own clock reaches midnight at 00:00:00.9 real time.
   - Each server copies every record it accepts, and A's close, to the other 50 ms later.
   - Phones (given): Ifeanyi's reads 200 ms fast, Fleur's 3,000 ms slow (set by hand). B-208 by her
     phone: 23:59:57.1; A-311 by his: 23:59:59.8; A-312: 00:00:00.9.
   - Hybrid logical clock: a stamp is the server's clock reading, unless the newest time the server
     has seen (its own stamps, copies from the other server, the offer being answered) is not
     earlier; then it is that time plus one step (+1). B hears A's close (00:00:00.0) at 00:00:00.05,
     so B-208 is stamped 00:00:00.0 +1: late, and sorted after A-311.
   - Waiting out the uncertainty, bound e either way (100 or 1,000 ms): a stamp is the clock reading
     plus e (the latest the real time could be); the offer is held 2e before it is confirmed and
     shown. A's close is stamped e at real midnight. With e = 1,000: A-311 stamped 00:00:00.6,
     shown 00:00:01.6; B-208 sent 00:00:02.1, stamped 00:00:02.2, late. With e = 100 (smaller than
     B's 900 ms error): A-311 23:59:59.7, B-208 sent 00:00:00.3, stamped 23:59:59.5, counted.
   - Extension: after a counted offer stamped in the last 60 s before the close, the close moves to
     that stamp plus 60 s: 23:59:51.1 + 60 s, then 00:00:59.6, then A-312's 00:01:00.7.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START = -2000;       // 23:59:58.0
  var END = 1000;          // 00:00:01.0
  var STEP = 100;          // ms per step
  var COPY = 50;           // a record reaches the other server 50 ms after it is accepted
  var EXTRA = 60000;       // the extension: 60 s
  var PHONE = { Ifeanyi: 200, Fleur: -3000 };
  var OFFERS = [
    { id: "B-207", who: "Fleur", amount: 1925, server: "B", sent: -8000, answers: null },
    { id: "A-311", who: "Ifeanyi", amount: 1950, server: "A", sent: -400, answers: "B-207" },
    { id: "B-208", who: "Fleur", amount: 1975, server: "B", after: 500, answers: "A-311" },
    { id: "A-312", who: "Ifeanyi", amount: 2000, server: "A", after: 600, answers: "B-208" }
  ];

  var SYNCS = [
    { value: "hourly", label: "every hour; B's tries blocked by the firewall (as on the night)", tries: "24" },
    { value: "minute", label: "every minute; B's tries still blocked", tries: "1,440" },
    { value: "fixed", label: "every minute; firewall reopened", tries: "0" }
  ];
  var STAMPS = [
    { value: "wall", label: "each server's own clock (as on the night)" },
    { value: "phone", label: "the applicant's phone, when they press send" },
    { value: "hlc", label: "hybrid logical clock: newest time seen, plus one step" }
  ];
  var WAITS = [
    { value: "0", label: "off (as on the night)" },
    { value: "100", label: "on, clocks trusted to 100 ms either way" },
    { value: "1000", label: "on, clocks trusted to 1,000 ms either way" }
  ];
  var EXTENDS = [
    { value: "off", label: "off (as on the night)" },
    { value: "on", label: "add 60 s after any offer in the last 60 s" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function tt(ms) {
    var d = 86400000;
    var s = ((ms % d) + d) % d;
    var whole = Math.floor(s / 1000);
    var rest = s % 1000;
    var frac = rest % 100 === 0 ? String(rest / 100) : two(Math.round(rest / 10));
    return two(Math.floor(whole / 3600)) + ":" + two(Math.floor(whole / 60) % 60) + ":" + two(whole % 60) + "." + frac;
  }
  function st(x) { return tt(x.l) + (x.c ? " +" + x.c : ""); }
  function cmp(a, b) { return (a.l - b.l) || (a.c - b.c); }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(n) { return "€" + commas(n); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function offsetOf(C) { return C.sync === "fixed" ? 0 : Number(C.offset); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // Replays the night. Returns every line, every offer and the outcome.
  function night(C) {
    var off = offsetOf(C);
    var mode = C.stamp;
    var e = mode === "wall" ? Number(C.wait) : 0;
    var close = { l: e, c: 0 };
    var closed = false;
    var seen = { A: null, B: null };
    var copies = [];
    var r = { lines: [], offers: [], off: off, e: e };
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    function clock(srv, t) { return srv === "A" ? t : t - off; }
    function hear(srv, x) { if (!seen[srv] || cmp(x, seen[srv]) > 0) seen[srv] = x; }
    function hlc(srv, pt) {
      var h = seen[srv];
      if (!h || pt > h.l) return { l: pt, c: 0 };
      return { l: h.l, c: h.c + 1 };
    }
    function deliver(upTo) {
      copies.forEach(function (k) {
        if (k.done || k.at > upTo) return;
        k.done = true;
        hear(k.to, k.x);
        if (k.close && mode === "hlc") {
          line(k.at, "B hears of A's close, stamped " + st(k.x) + ". B's clock reads " + tt(clock("B", k.at)) +
            "; the newest time B has seen is now " + tt(k.x.l) + ".", "ok");
        }
      });
    }
    function aClose(upTo) {
      var at = close.l - e;
      if (closed || at > upTo) return;
      closed = true;
      deliver(at);
      if (mode === "phone") {
        line(at, "Midnight, real time. With phone stamps, an offer counts if the phone said before 00:00:00.0.", "");
        return;
      }
      var x = mode === "hlc" ? hlc("A", at) : { l: at + e, c: 0 };
      hear("A", x);
      copies.push({ to: "B", at: at + COPY, x: x, close: true });
      if (e) line(at, "A's clock reads " + tt(at) + ": the close is stamped " + st(x) + " and confirmed at " + tt(at + 2 * e) + ".", "");
      else line(at, "A's clock reads " + tt(at) + ": A closes the window, stamped " + st(x) + ".", "");
    }

    var byId = {};
    var prev = null;
    OFFERS.forEach(function (o) {
      var sent;
      if (o.sent !== undefined) sent = o.sent;
      else {
        if (!prev || !prev.counted) return;
        sent = prev.shown + o.after;
      }
      aClose(sent);
      deliver(sent);
      var read = mode === "phone" ? sent + PHONE[o.who] : clock(o.server, sent);
      var ans = o.answers ? byId[o.answers] : null;
      var x;
      if (mode === "hlc") {
        if (ans) hear(o.server, ans.stamp);
        x = hlc(o.server, read);
      } else x = { l: read + e, c: 0 };
      hear(o.server, x);
      var rec = {
        id: o.id, who: o.who, amount: o.amount, server: o.server, answers: o.answers,
        sent: sent, read: read, stamp: x, counted: cmp(x, close) < 0, wait: 0, shown: null, before: false
      };
      if (rec.counted) {
        rec.wait = 2 * e;
        rec.shown = sent + 2 * e;
        copies.push({ to: o.server === "A" ? "B" : "A", at: sent + COPY, x: x });
        if (C.extend === "on" && x.l >= close.l - EXTRA && x.l + EXTRA > close.l) close = { l: x.l + EXTRA, c: 0 };
        if (ans && cmp(x, ans.stamp) < 0) rec.before = true;
      }
      var who = mode === "phone" ? o.who + "'s phone reads " : o.server + "'s clock reads ";
      var newest = mode === "hlc" && x.c ? "; the newest time " + o.server + " has seen is " + tt(x.l) : "";
      var text = o.who + (ans ? " answers " + ans.id + " with " : " offers ") + money(o.amount) + " on server " + o.server + ". " +
        who + tt(read) + newest + ": stamped " + st(x);
      if (rec.counted) {
        text += e ? ", held " + commas(rec.wait) + " ms, confirmed at " + tt(rec.shown) + ", counted." : ", counted.";
        if (rec.before) text += " It sorts before " + ans.id + ", the offer it answers.";
        if (o.id === "A-311") text += " His screen: Your offer is the highest.";
      } else text += ", late.";
      line(sent, text, rec.counted ? (rec.before ? "bad" : "") : (o.who === "Fleur" ? "ok" : "warn"));
      r.offers.push(rec);
      byId[o.id] = rec;
      prev = rec;
    });

    var last = START;
    r.lines.forEach(function (l) { if (l.t > last) last = l.t; });
    r.end = Math.max(END, Math.ceil(last / STEP) * STEP);
    aClose(r.end);
    deliver(r.end);
    r.open = close.l - e > r.end;
    if (mode !== "hlc" && mode !== "phone" && !r.open) {
      var bAt = close.l - e + off;
      if (bAt <= r.end) line(bAt, "B's clock reaches " + tt(close.l - e) + " at last: B stops taking offers.", "warn");
    }
    r.lines.sort(function (a, b) { return a.t - b.t; });

    var best = null;
    r.late = 0;
    r.before = 0;
    r.offers.forEach(function (o) {
      if (!o.counted) r.late += 1;
      else if (!best || o.amount > best.amount) best = o;
      if (o.before) r.before += 1;
    });
    r.close = close;
    r.best = best;
    r.winner = (r.open ? "still open: " + best.who + ", " + money(best.amount) + " leads" : best.who + ", " + money(best.amount)) + " (" + best.id + ")";
    var b208 = byId["B-208"];
    r.b208 = b208 ? st(b208.stamp) : "not sent";
    r.held = e ? 2 * e : 0;
    return r;
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var x = doc.createElement(tag);
      if (style) x.setAttribute("style", style);
      if (text) x.textContent = text;
      return x;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["offer", "who", "amount", "server", "sent (real time)", "clock read", "stamp", "answers", "held", "ruling"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var rec = el("p", "margin:0;font-size:12px;");
    box.appendChild(rec);
    var real = el("p", "margin:0;font-size:12px;");
    box.appendChild(real);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, rec: rec, real: real };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var N = night(C);
    var done = S.now >= N.end;
    ui.head.textContent = "Real time now: " + tt(S.now) + ". B's clock behind: " + N.off + " ms. Sync: " + pick(SYNCS, C.sync).label +
      ". Stamps: " + pick(STAMPS, C.stamp).label + ". Waiting: " + pick(WAITS, C.wait).label +
      (C.stamp !== "wall" && C.wait !== "0" ? " (server clocks only, so not used here)" : "") + ". Extension: " + C.extend + ".";
    clear(ui.body);
    var shown = N.offers.filter(function (o) { return o.sent <= S.now; });
    shown.forEach(function (o) {
      var tr = ui.el("tr");
      [o.id, o.who, money(o.amount), o.server, tt(o.sent), tt(o.read), st(o.stamp), o.answers || "-",
        commas(o.wait) + " ms", o.counted ? (o.before ? "counted, before its question" : "counted") : "late"].forEach(function (x) {
        tr.appendChild(ui.el("td", "", x));
      });
      ui.body.appendChild(tr);
    });
    var byStamp = shown.filter(function (o) { return o.counted; }).slice().sort(function (a, b) { return cmp(a.stamp, b.stamp); });
    ui.rec.textContent = "The record, sorted by stamp: " + byStamp.map(function (o) { return o.id + " (" + st(o.stamp) + ")"; }).join(", ") + ".";
    ui.real.textContent = "Real order: " + shown.map(function (o) { return o.id + " (" + tt(o.sent) + ")"; }).join(", ") + ".";
    S.stat.offset(String(N.off));
    S.stat.tries(pick(SYNCS, C.sync).tries);
    if (!done) {
      ["b208", "before", "late", "held", "close", "winner"].forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    S.stat.b208(N.b208);
    S.stat.before(String(N.before));
    S.stat.late(String(N.late));
    S.stat.held(String(N.held));
    S.stat.close(st(N.close));
    S.stat.winner(N.winner);
  }

  function change(api, what) {
    api.state.now = START;
    api.log(what + " Set back to 23:59:58.0.", "");
    draw(api);
  }

  function advance(api, to) {
    var S = api.state;
    var N = night(S.C);
    if (S.now >= N.end) {
      api.log("The replay has already reached " + tt(N.end) + ". Change a setting or reset to play it again.", "");
      return;
    }
    var from = S.now;
    var target = Math.min(to, N.end);
    N.lines.forEach(function (l) { if (l.t > from && l.t <= target) api.log(tt(l.t) + " " + l.text, l.tone); });
    S.now = target;
    if (S.now >= N.end) {
      api.log(tt(N.end) + " " + (N.open ? "Window still open" : "Window closed") + ". The flat: " + N.winner +
        ". Answers sorted before their question: " + N.before + ". Offers ruled late: " + N.late + ".", N.before ? "bad" : "ok");
    }
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { offset: 900, sync: "hourly", stamp: "wall", wait: "0", extend: "off" };
      S.now = START;
      S.ui = buildWidget(api);

      api.control.range("offset", "B's clock behind real time (ms)", 0, 1000, 100, 900, function (v) {
        var x = Math.max(0, Math.min(1000, Math.round(Number(v) / 100) * 100));
        if (!isFinite(x) || x === S.C.offset) return;
        S.C.offset = x;
        change(api, "B's clock: " + x + " ms behind." + (S.C.sync === "fixed" ? " Sync is working, so B stays right whatever this says." : ""));
      });
      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("sync", "Time sync", SYNCS, "sync");
      sel("stamp", "Stamp each offer with", STAMPS, "stamp");
      sel("wait", "Wait out the uncertainty", WAITS, "wait");
      sel("extend", "Deadline extension", EXTENDS, "extend");
      api.control.button("step", "Step 100 ms", function () { advance(api, S.now + STEP); });
      api.control.button("play", "Play to the end", function () { advance(api, Infinity); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        offset: api.stat("offset", "B's clock behind (ms)", "warn"),
        tries: api.stat("tries", "B's sync tries blocked a day", "warn"),
        b208: api.stat("b208", "B-208's stamp", ""),
        before: api.stat("before", "answers sorted before their question", "bad"),
        late: api.stat("late", "offers ruled late", ""),
        held: api.stat("held", "each counted offer held for (ms)", "warn"),
        close: api.stat("close", "window closes at (stamp)", ""),
        winner: api.stat("winner", "the flat", "")
      };

      api.info("<strong>How to read it.</strong> Times on the left are real time. Each row is one offer: when it was really sent, what its server's clock (or the phone) read, the stamp it was given, which offer it answers, how long it was held before it was confirmed, and the ruling. Below the table, the record in stamp order and the offers in real order. An answer that sorts before its question is the impossible record from the post.");

      api.log("Friday 27 November 2026, 23:59:58.0 real time, as on the night: B's clock 900 ms behind. Highest so far: B-207, Fleur, €1,925, stamped 23:59:51.1.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: 23:59:58.0, before Ifeanyi's offer.
      t.expect(t.stat("offset") === 900 && t.stat("tries") === 24 && t.stat("winner") === "not run yet" &&
        has("Highest so far: B-207, Fleur, €1,925, stamped 23:59:51.1."),
        "Opens at 23:59:58.0 with B 900 ms behind, nothing played");

      // 2. Stepping: 16 steps of 100 ms reach his offer at 23:59:59.6, and nothing is decided yet.
      for (var i = 0; i < 16; i++) t.click("step");
      t.expect(has("23:59:59.6 Ifeanyi answers B-207 with €1,950 on server A. A's clock reads 23:59:59.6: stamped 23:59:59.6, counted. His screen: Your offer is the highest.") &&
        t.stat("winner") === "not run yet",
        "Sixteen steps reach 23:59:59.6: A-311 stamped 23:59:59.6, counted");

      // 3. As on the night: the answer is stamped before its question and wins.
      t.click("play");
      t.expect(t.stat("b208") === "23:59:59.2" && t.stat("before") === 1 && t.stat("late") === 1 &&
        t.stat("winner") === "Fleur, €1,975 (B-208)" &&
        has("00:00:00.1 Fleur answers A-311 with €1,975 on server B. B's clock reads 23:59:59.2: stamped 23:59:59.2, counted. It sorts before A-311, the offer it answers.") &&
        has("00:00:00.7 Ifeanyi answers B-208 with €2,000 on server A. A's clock reads 00:00:00.7: stamped 00:00:00.7, late.") &&
        has("00:00:00.9 B's clock reaches 00:00:00.0 at last"),
        "As on the night: B-208 sent 00:00:00.1, stamped 23:59:59.2, sorts before A-311 and wins; A-312 late");

      // 4. A smaller gap: 300 ms sorts the answer after its question, but it still counts.
      t.set("offset", 300);
      t.click("play");
      var s300 = t.stat("b208") === "23:59:59.8" && t.stat("before") === 0 && t.stat("winner") === "Fleur, €1,975 (B-208)";
      t.set("offset", 100);
      t.click("play");
      t.expect(s300 && t.stat("b208") === "00:00:00.0" && t.stat("winner") === "Ifeanyi, €1,950 (A-311)",
        "300 ms behind: B-208 at 23:59:59.8, after A-311 but still counted; 100 ms: late, Ifeanyi wins");
      t.set("offset", 900);

      // 5. Option 0: sync every minute while the firewall still blocks B changes nothing.
      t.set("sync", "minute");
      t.click("play");
      var blocked = t.stat("tries") === "1,440" && t.stat("winner") === "Fleur, €1,975 (B-208)" && t.stat("b208") === "23:59:59.2";
      t.set("sync", "fixed");
      t.click("play");
      t.expect(blocked && t.stat("offset") === 0 && t.stat("winner") === "Ifeanyi, €1,950 (A-311)",
        "Every minute, still blocked: 1,440 failed tries a day, same result; firewall reopened: B right, Ifeanyi wins");
      t.set("sync", "hourly");

      // 6. Option 1: phone stamps. Her phone runs 3 s slow.
      t.set("stamp", "phone");
      t.click("play");
      t.expect(t.stat("b208") === "23:59:57.1" && t.stat("before") === 1 && t.stat("winner") === "Fleur, €1,975 (B-208)",
        "Phone stamps: B-208 stamped 23:59:57.1 by Fleur's phone, before A-311 at 23:59:59.8; she wins");

      // 7. Option 3: the hybrid logical clock. B has heard of A's close, so B-208 is stamped after it.
      t.set("stamp", "hlc");
      t.click("play");
      t.expect(t.stat("b208") === "00:00:00.0 +1" && t.stat("before") === 0 && t.stat("late") === 1 &&
        t.stat("winner") === "Ifeanyi, €1,950 (A-311)" &&
        has("00:00:00.05 B hears of A's close, stamped 00:00:00.0. B's clock reads 23:59:59.15"),
        "Hybrid logical clock: B-208 stamped 00:00:00.0 +1, late, after A-311; Ifeanyi wins at €1,950");

      // 8. The hybrid logical clock gives the same answer at every offset and sync setting.
      var all = true;
      for (var off = 0; off <= 1000; off += 100) {
        SYNCS.forEach(function (s) {
          var n = night({ offset: off, sync: s.value, stamp: "hlc", wait: "0", extend: "off" });
          if (n.best.id !== "A-311" || n.before !== 0) all = false;
        });
      }
      t.expect(all, "Hybrid logical clock: A-311 wins and nothing sorts before its question at every offset from 0 to 1,000 ms");
      t.set("stamp", "wall");

      // 9. Option 2: wait out 1,000 ms either way. Each offer is held 2,000 ms; she sees his offer too late to answer in time.
      t.set("wait", "1000");
      t.click("play");
      t.expect(t.stat("held") === 2000 && t.stat("b208") === "00:00:02.2" && t.stat("winner") === "Ifeanyi, €1,950 (A-311)" &&
        t.stat("close") === "00:00:01.0" && has("confirmed at 00:00:01.6, counted.") && has("00:00:02.1 Fleur answers A-311"),
        "Waiting 1,000 ms either way: every offer held 2,000 ms, A-311 shown at 00:00:01.6, B-208 sent 00:00:02.1 and late");

      // 10. A bound smaller than B's real error proves nothing.
      t.set("wait", "100");
      t.click("play");
      t.expect(t.stat("held") === 200 && t.stat("b208") === "23:59:59.5" && t.stat("before") === 1 &&
        t.stat("winner") === "Fleur, €1,975 (B-208)",
        "Waiting 100 ms either way with B 900 ms out: B-208 stamped 23:59:59.5, before A-311 at 23:59:59.7, and wins");
      t.set("wait", "0");

      // 11. The extension idea: fairer, still ordered by the wall clock.
      t.set("extend", "on");
      t.click("play");
      t.expect(t.stat("close") === "00:01:00.7" && t.stat("before") === 1 && t.stat("winner") === "still open: Ifeanyi, €2,000 leads (A-312)",
        "Extension: the window is still open at 00:00:01.0, closing at 00:01:00.7, and B-208 still sorts before A-311");
      t.set("extend", "off");

      // 12. A second play is refused until something changes.
      t.click("play");
      t.click("play");
      t.expect(has("The replay has already reached 00:00:01.0."), "A second play is refused");
    }
  });
})();
