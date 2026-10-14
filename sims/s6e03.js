/* sims/s6e03-v1.0.0.js  (published as sims/s6e03.js)
   Case s6e03 "The Bouncer": a limiter lab for the Pellucid's guest list. Promoters add names to the
   120 free New Year's places through the club's booking API, one request per name, each under its
   own key. A limiter counts each key's requests. The learner picks how it counts (fixed window,
   sliding window, token bucket, leaky bucket), the limit, the bucket's size and refill, when the
   script checks its login, who runs the script, and whether the script resends refused names,
   then plays the minute around midnight in tenths of a second. Widget-style sim: it draws the
   guest list and a table of keys inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: 23:59:00.0 to 00:01:00.0 in 0.1 s ticks. Controls: how the
     limiter counts, limit (60 or 30 a minute), bucket size (10 or 20), refill (1 or 2 a second),
     the script's login check (23:59:00.5, 23:59:30.0, none), who runs the script (P-07; P-07 and
     a copy on P-03; only the copy, P-07 banned), resend refused names; Next request, +1 second,
     Play / pause, To the end, Reset. Stats: places left, P-07's names, P-03's names, regulars'
     names from the door, requests refused, script names stamped 00:00:00.0 to 00:00:00.9, list
     full at, the script key's limiter. selfTest: 12 assertions.

   The model (stated in sim.lede). Time is counted in ticks of 0.1 s from 23:59:00.0 (tick 0);
   midnight is tick 600 and the sim ends at 00:01:00.0 (tick 1200). Inside a tick, keys act in
   the order P-07, P-03, P-02, P-04, P-05.
   - Every request under a key counts, a name or a login check. The list opens at tick 600.
   - The script: a login check at the chosen time, then at midnight 12 name requests every tick
     for ticks 600 to 609 (120 names, 120 a second). It never reads an answer before sending the
     next. If "resend" is on, each refused name is sent again 1 s (10 ticks) later. On "list
     full" it stops.
   - The door: Afua (P-02) taps 20 names, one every 2 s from 00:00:01.2; Sabriel (P-04) 15 from
     00:00:01.5; Moyra (P-05) 15 from 00:00:02.0. 50 regulars in all. Each stops at "list full".
   - Fixed window: a key's window starts at its first request after the last window ran out and
     lasts 60 s (600 ticks); the count starts at 1 with that request; past the limit, refused.
   - Sliding window: a request is allowed if fewer than the limit were allowed in the last 60 s,
     that is in ticks (i - 600, i].
   - Token bucket: kept in thousandths of a token; starts full; each tick, before requests, adds
     refill x 100 (0.1 token at 1 a second) up to the size; a request spends 1,000 or is refused.
   - Leaky bucket: a request waits in the key's bucket if it holds fewer than the size, else it is
     refused. After the tick's requests, one waiting request leaves the bucket if the last left at
     least 10 / refill ticks ago (at once when idle). A name counts on the list when it leaves.
   - A refused request gets 429 with Retry-After in whole seconds, rounded up, at least 1: until
     the window ends, until the oldest counted request is 60 s old, until the next whole token,
     or until the next drip.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e03-v1.0.0.json).
   - Tonight (fixed window, 60, login at 23:59:00.5): the login is count 1 of the window from
     23:59:00.5 to 00:00:00.5. Ticks 600 to 603 add 48 (count 49); tick 604 (00:00:00.4) allows 11
     (count 60) and refuses 1 (Retry-After 1 s). 59 names before the window ends. Tick 605 starts
     a new window; ticks 605 to 609 allow all 60 (count 60 at 00:00:00.9). 119 names by
     00:00:00.9, 121 requests sent, 1 refused, 1 place left. Afua's first tap at 00:00:01.2 takes
     place 120; Sabriel's (00:00:01.5) and Moyra's (00:00:02.0) get "list full". Regulars on: 1 of
     50, 49 outside.
   - Limit 30: 12 + 12 + 5 = 29 by 00:00:00.2 (7 refused at 00:00:00.2), then 12 + 12 + 6 = 30 in
     the new window by 00:00:00.7: 59. The door's 50 all get on; 11 places left.
   - Limit 30, two scripts: 59 each, 118; Afua and Sabriel take the last two, full at 00:00:01.5.
   - Limit 60, two scripts: P-07 61 (59 then 2), P-03 59; full at 00:00:00.5.
   - Only the copy (P-07 banned): P-03 119, full at 00:00:01.2, the same as tonight.
   - Token bucket 10, 1 a second: 10 at 00:00:00.0, 2 refused, then ticks 601 to 609 add 0.1
     token each and reach 0.9: no more. P-07 10, 110 refused; the door's 50 on; 60 left.
     With resend: 20 by 00:00:10.9 and 69 by 00:01:00.0 (10, then one a second).
     Size 20: 20.
   - Sliding window 60: 59 by 00:00:00.4; at 00:00:00.5 the login is 60 s old and 1 more gets in
     (Retry-After 60 s for the rest): 60. The door's 50 on; 10 left.
   - Leaky bucket 10, 1 a second: 10 wait and 1 leaves at 00:00:00.0, 1 more waits at 00:00:00.1,
     109 refused; names leave at 00:00:00.0, 01.0, ... 10.0: 11, and 1 in the first second.
   - Login at 23:59:30.0: the window runs to 00:00:30.0, so 59 then refusals: 59. No login: 60.
*/
(function () {
  "use strict";

  var MID = 600;              // tick of 00:00:00.0
  var END = 1200;             // tick of 00:01:00.0
  var PLACES = 120;
  var T0 = 86340;             // 23:59:00 in seconds
  var HANDS = [
    { id: "P-02", who: "Afua", start: 12, names: 20 },
    { id: "P-04", who: "Sabriel", start: 15, names: 15 },
    { id: "P-05", who: "Moyra", start: 20, names: 15 }
  ];

  var ALGOS = [
    { value: "fixed", label: "Fixed window (as built)" },
    { value: "sliding", label: "Sliding window: the last 60 s" },
    { value: "token", label: "Token bucket" },
    { value: "leaky", label: "Leaky bucket" }
  ];
  var LIMITS = [{ value: "60", label: "60 a minute (as built)" }, { value: "30", label: "30 a minute" }];
  var SIZES = [{ value: "10", label: "10" }, { value: "20", label: "20" }];
  var RATES = [{ value: "1", label: "1 a second" }, { value: "2", label: "2 a second" }];
  var LOGINS = [{ value: "5", label: "23:59:00.5 (tonight)" }, { value: "300", label: "23:59:30.0" }, { value: "-1", label: "No login check" }];
  var WHO = [
    { value: "one", label: "Nnamdi, key P-07 (tonight)" },
    { value: "two", label: "P-07 and a copy on key P-03" },
    { value: "copy", label: "Only the copy, P-03 (P-07 banned)" }
  ];
  var ALGO_SHORT = { fixed: "fixed window", sliding: "sliding window", token: "token bucket", leaky: "leaky bucket" };

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tt(i) {
    var d = ((T0 * 10 + i) % 864000 + 864000) % 864000;
    var s = Math.floor(d / 10);
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60) + "." + (d % 10);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function tok(m) { return (Math.floor(m / 100) / 10).toFixed(1); }

  /* ---------- the model: settings in, the whole minute out ---------- */

  function stateText(C, k, i) {
    if (C.algo === "fixed") return k.ws < 0 ? "no window yet" : "window from " + tt(k.ws) + ", count " + k.cnt;
    if (C.algo === "sliding") {
      var n = 0;
      for (var h = 0; h < k.hist.length; h++) if (k.hist[h] > i - 600) n += 1;
      return n + " counted in the last 60 s";
    }
    if (C.algo === "token") return "tokens " + tok(k.tok) + " of " + C.size;
    return "bucket holds " + k.q.length + " of " + C.size;
  }

  function admit(C, k, i) {
    if (C.algo === "fixed") {
      if (k.ws < 0 || i >= k.ws + 600) { k.ws = i; k.cnt = 0; }
      if (k.cnt < C.limit) { k.cnt += 1; return "ok"; }
      return "no";
    }
    if (C.algo === "sliding") {
      while (k.hist.length && k.hist[0] <= i - 600) k.hist.shift();
      if (k.hist.length < C.limit) { k.hist.push(i); return "ok"; }
      return "no";
    }
    if (C.algo === "token") {
      if (k.tok >= 1000) { k.tok -= 1000; return "ok"; }
      return "no";
    }
    return k.q.length < C.size ? "wait" : "no";
  }

  function retryAfter(C, k, i) {
    var ticks;
    if (C.algo === "fixed") ticks = k.ws + 600 - i;
    else if (C.algo === "sliding") ticks = k.hist[0] + 600 - i;
    else if (C.algo === "token") ticks = Math.ceil((1000 - k.tok) / (C.rate * 100));
    else ticks = k.next - i;
    return Math.max(1, Math.ceil(ticks / 10));
  }

  function simulate(C) {
    var keys = [];
    function mk(id, who, kind) {
      return { id: id, who: who, kind: kind, sent: 0, names: 0, refused: 0, first: 0, stopped: false,
        ws: -1, cnt: 0, hist: [], tok: C.size * 1000, q: [], next: -1, pend: [], todo: 0, total: 0, start: 0 };
    }
    if (C.who !== "copy") keys.push(mk("P-07", "Nnamdi", "script"));
    if (C.who !== "one") keys.push(mk("P-03", "a copy", "script"));
    HANDS.forEach(function (h) {
      var k = mk(h.id, h.who, "hand");
      k.start = MID + h.start; k.todo = h.names; k.total = h.names;
      keys.push(k);
    });
    var M = { list: 0, fullAt: -1, refused: 0, owners: [], events: [], busy: [], snap: [] };
    var script0 = keys[0];

    function place(k, i, st) {
      if (M.list >= PLACES) { st.full = true; k.stopped = true; return; }
      M.list += 1; k.names += 1; st.placed += 1;
      M.owners.push(k.kind === "hand" ? "door" : k.id);
      if (k.kind === "script" && i >= MID && i < MID + 10) k.first += 1;
      if (k.kind === "hand") k.todo -= 1;
      if (M.list === PLACES) M.fullAt = i;
    }

    for (var i = 0; i <= END; i++) {
      var out = [];
      var busy = false;
      for (var a = 0; a < keys.length; a++) {
        var k = keys[a];
        if (C.algo === "token") k.tok = Math.min(C.size * 1000, k.tok + C.rate * 100);
        var reqs = [];
        if (k.kind === "script") {
          if (C.login >= 0 && i === C.login) reqs.push("login");
          if (i >= MID && i < MID + 10 && !k.stopped) for (var r = 0; r < 12; r++) reqs.push("name");
          if (C.resend) while (k.pend.length && k.pend[0] <= i) { k.pend.shift(); if (!k.stopped) reqs.push("name"); }
        } else if (!k.stopped && k.todo > 0 && i >= k.start && (i - k.start) % 20 === 0) {
          reqs.push("name");
        }
        var st = { sent: 0, ok: 0, wait: 0, ref: 0, ra: 0, placed: 0, full: false, drip: 0 };
        for (var q = 0; q < reqs.length; q++) {
          if (k.stopped) break;
          st.sent += 1; k.sent += 1;
          var res = admit(C, k, i);
          if (res === "no") {
            st.ref += 1; k.refused += 1; M.refused += 1;
            if (!st.ra) st.ra = retryAfter(C, k, i);
            if (reqs[q] === "name" && C.resend) k.pend.push(i + 10);
            continue;
          }
          if (res === "wait") { k.q.push(reqs[q]); st.wait += 1; continue; }
          st.ok += 1;
          if (reqs[q] === "name") place(k, i, st);
        }
        if (C.algo === "leaky" && k.q.length && i >= k.next) {
          var item = k.q.shift();
          k.next = i + Math.round(10 / C.rate);
          if (item === "name") { st.drip = 1; place(k, i, st); }
        }
        if (st.sent || st.placed || st.full) busy = true;
        // The log for this key and tick.
        if (k.kind === "script") {
          var show = st.full || st.placed > 0 || (st.sent > 0 && i < MID + 10);
          if (show) {
            var bits = [];
            var head;
            if (st.sent === 1 && reqs[0] === "login") {
              head = "login check, " + (st.ok ? "allowed" : st.wait ? "into the bucket" : "refused");
            } else if (st.sent) {
              head = st.sent + " sent";
              if (st.ok) bits.push(st.ok + " allowed");
              if (st.wait) bits.push(st.wait + " into the bucket");
              if (st.ref) bits.push(st.ref + " refused (429, Retry-After: " + st.ra + " s)");
            } else {
              head = "nothing sent";
            }
            var msg = tt(i) + " " + k.id + ": " + head + (bits.length ? ", " + bits.join(", ") : "") + ". ";
            if (st.drip) msg += "1 name out of the bucket onto the list. ";
            if (st.full) msg += "List full: it stops. ";
            msg += cap(stateText(C, k, i)) + ".";
            out.push([msg, st.ref ? "bad" : (st.full ? "bad" : "warn")]);
          }
        } else if (st.placed || st.full) {
          var who = tt(i) + " " + k.id + " (" + k.who + "): ";
          if (st.full) out.push([who + "list full. " + (k.total - k.names) + " regulars left outside.", "bad"]);
          else if (M.fullAt === i) out.push([who + "place 120 of 120.", "warn"]);
          else if (k.names === 1) out.push([who + "first regular on, place " + M.list + " of 120.", "ok"]);
          else if (k.todo === 0) out.push([who + "all " + k.total + " regulars on the list.", "ok"]);
        }
      }
      if (M.fullAt === i) out.push(["The list is full at " + tt(i) + ": 120 of 120.", "bad"]);
      if (i === END) {
        out.push(["End, " + tt(i) + ". " + names(keys, "P-07") + names(keys, "P-03") + "regulars from the door " + doorNames(keys) +
          ", places left " + (PLACES - M.list) + ", requests refused " + M.refused + ".", "ok"]);
      }
      M.events.push(out);
      M.busy.push(busy);
      var first = 0;
      keys.forEach(function (x) { first += x.first; });
      M.snap.push({
        list: M.list, refused: M.refused, first: first, fullAt: M.fullAt,
        p07: count(keys, "P-07"), p03: count(keys, "P-03"), door: doorNames(keys),
        lim: script0.id + ": " + stateText(C, script0, i),
        rows: keys.map(function (x) { return [x.id, x.who, x.sent, x.names, x.refused]; })
      });
    }
    M.open = {
      list: 0, refused: 0, first: 0, fullAt: -1, p07: 0, p03: 0, door: 0,
      lim: script0.id + ": " + (C.algo === "fixed" ? "no window yet" : C.algo === "sliding" ? "0 counted in the last 60 s" :
        C.algo === "token" ? "tokens " + C.size + ".0 of " + C.size : "bucket holds 0 of " + C.size),
      rows: keys.map(function (x) { return [x.id, x.who, 0, 0, 0]; })
    };
    return M;
  }
  function count(keys, id) {
    for (var i = 0; i < keys.length; i++) if (keys[i].id === id) return keys[i].names;
    return 0;
  }
  function names(keys, id) {
    for (var i = 0; i < keys.length; i++) if (keys[i].id === id) return id + " " + keys[i].names + ", ";
    return "";
  }
  function doorNames(keys) {
    var n = 0;
    keys.forEach(function (k) { if (k.kind === "hand") n += k.names; });
    return n;
  }

  /* ---------- drawing ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mkEl(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, cls, anchor) {
    var t = mkEl(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, g);
    t.textContent = s;
    return t;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function build(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var wrap = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    wrap.appendChild(head);
    var svg = mkEl(doc, "svg", {
      viewBox: "0 0 660 210", width: "100%", "class": "dg", role: "img",
      "aria-label": "The guest list as 120 boxes, filled in the order names arrived. Red boxes are names from key P-07, amber from the copy on key P-03, green from the promoters at the door. Empty boxes are places still free."
    });
    var layer = mkEl(doc, "g", {}, svg);
    wrap.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["key", "who", "requests sent", "names on the list", "refused"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    api.root.appendChild(wrap);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody };
  }

  function drawAll(S, sn) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    txt(doc, g, 20, 16, "Guest list: " + sn.list + " of 120 places taken", "dg-axis");
    var tone = { "P-07": "st-bad", "P-03": "st-warn", door: "st-ok" };
    for (var c = 0; c < PLACES; c++) {
      var x = 20 + (c % 20) * 31, y = 26 + Math.floor(c / 20) * 27;
      var own = c < sn.list ? S.M.owners[c] : null;
      var gg = mkEl(doc, "g", { "class": own ? "dg-node " + tone[own] : "dg-node st-muted" }, g);
      mkEl(doc, "rect", { x: x, y: y, width: 26, height: 22, rx: 3 }, gg);
    }
    txt(doc, g, 20, 200, "Red: P-07. Amber: P-03 (the copy). Green: the promoters at the door. Empty: free.", "dg-axis");
  }

  function drawTable(S, sn) {
    var el = S.ui.el;
    clear(S.ui.tbody);
    sn.rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (v) { tr.appendChild(el("td", "", String(v))); });
      S.ui.tbody.appendChild(tr);
    });
  }

  function show(api) {
    var S = api.state;
    var sn = S.now < 0 ? S.M.open : S.M.snap[S.now];
    api.clock = T0 + Math.floor(Math.max(0, S.now) / 10);
    var C = S.C;
    S.ui.head.textContent = "Now " + tt(Math.max(0, S.now)) + ". The limiter counts with a " + ALGO_SHORT[C.algo] +
      (C.algo === "fixed" || C.algo === "sliding" ? ", " + C.limit + " requests a minute per key" :
        ", " + C.size + " per key, " + C.rate + " more a second") + ". Login check: " +
      (C.login < 0 ? "none" : tt(C.login)) + ". Resend refused names: " + (C.resend ? "on" : "off") + ".";
    S.stat.left(PLACES - sn.list);
    S.stat.p07(sn.p07);
    S.stat.p03(sn.p03);
    S.stat.door(sn.door);
    S.stat.refused(sn.refused);
    S.stat.first(sn.first);
    S.stat.full(sn.fullAt < 0 ? "not full" : tt(sn.fullAt));
    S.stat.lim(sn.lim);
    drawAll(S, sn);
    drawTable(S, sn);
  }

  function advance(api, to) {
    var S = api.state;
    to = Math.min(END, to);
    if (to <= S.now) return;
    for (var i = S.now + 1; i <= to; i++) {
      var ev = S.M.events[i];
      api.clock = T0 + Math.floor(i / 10);
      for (var e = 0; e < ev.length; e++) api.log(ev[e][0], ev[e][1]);
    }
    S.now = to;
    if (to === END) S.playing = false;
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = simulate(S.C);
    S.now = -1;
    S.playing = false;
    api.clock = T0;
    api.log(what + " Rewound to 23:59:00.0: nothing sent, 120 places free.", "");
    show(api);
  }

  DL.sims.define("s6e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { algo: "fixed", limit: 60, size: 10, rate: 1, login: 5, who: "one", resend: false };
      S.ui = build(api);
      S.stat = {
        left: api.stat("left", "places left", "ok"),
        p07: api.stat("p07", "P-07's names on the list", "bad"),
        p03: api.stat("p03", "P-03's names (the copy)", "warn"),
        door: api.stat("door", "regulars on from the door", "ok"),
        refused: api.stat("refused", "requests refused (429)", "warn"),
        first: api.stat("first", "script names stamped 00:00:00.0 to 00:00:00.9", "bad"),
        full: api.stat("full", "list full at", "bad"),
        lim: api.stat("lim", "the script key's limiter", "")
      };
      api.control.select("algo", "How the limiter counts", ALGOS, "fixed", function (v) {
        var x = String(v);
        S.C.algo = ALGO_SHORT[x] ? x : "fixed";
        rewind(api, "The limiter now counts with a " + ALGO_SHORT[S.C.algo] + ".");
      });
      api.control.select("limit", "Limit (windows)", LIMITS, "60", function (v) {
        S.C.limit = Number(v) === 30 ? 30 : 60;
        rewind(api, "Limit: " + S.C.limit + " requests a minute per key.");
      });
      api.control.select("size", "Bucket size", SIZES, "10", function (v) {
        S.C.size = Number(v) === 20 ? 20 : 10;
        rewind(api, "Bucket size: " + S.C.size + ".");
      });
      api.control.select("rate", "Refill (buckets)", RATES, "1", function (v) {
        S.C.rate = Number(v) === 2 ? 2 : 1;
        rewind(api, "Refill: " + S.C.rate + " a second.");
      });
      api.control.select("login", "Script's login check", LOGINS, "5", function (v) {
        var x = Number(v);
        S.C.login = x === 300 ? 300 : (x < 0 ? -1 : 5);
        rewind(api, "Login check: " + (S.C.login < 0 ? "none." : tt(S.C.login) + "."));
      });
      api.control.select("who", "Who runs the script", WHO, "one", function (v) {
        var x = String(v);
        S.C.who = x === "two" || x === "copy" ? x : "one";
        rewind(api, x === "two" ? "Two keys run the script: P-07 and a copy on P-03." : x === "copy" ? "P-07 is banned; a copy runs on P-03." : "Only Nnamdi's script runs, on P-07.");
      });
      api.control.toggle("resend", "Script resends refused names 1 s later", false, function (on) {
        S.C.resend = !!on;
        rewind(api, "Resend refused names: " + (S.C.resend ? "on." : "off."));
      });
      api.control.button("next", "Next request", function () {
        var nx = END;
        for (var i = Math.max(0, S.now + 1); i <= END; i++) if (S.M.busy[i]) { nx = i; break; }
        advance(api, nx);
      });
      api.control.button("sec", "+1 second", function () { advance(api, S.now + 10); });
      api.control.button("play", "Play / pause", function () { S.playing = !S.playing && S.now < END; });
      api.control.button("end", "To the end", function () { advance(api, END); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> Each box is one free place on the guest list, filled in the order names arrive. Every request a promoter sends carries the promoter's key, and the limiter decides for that key alone: allowed, refused with 429 and Retry-After, or (leaky bucket) waiting in the key's small bucket. The table shows each key's requests, names and refusals. Step a tenth of a second at a time with Next request.");
      S.M = simulate(S.C);
      S.now = -1;
      S.playing = false;
      api.clock = T0;
      api.log("23:59:00.0. The list opens at 00:00:00.0 with 120 free places. The limiter counts with a fixed window, 60 requests a minute per key.", "");
      show(api);
    },

    step: function (api, dt) {
      var S = api.state;
      S.acc = (S.acc || 0) + dt * 20;
      if (!S.playing) { S.acc = 0; return; }
      var n = Math.floor(S.acc);
      if (n > 0) { S.acc -= n; advance(api, S.now + n); }
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. Opens before anything is sent.
      t.expect(t.api.clock === 86340 && t.stat("left") === 120 && t.stat("p07") === 0 && t.stat("refused") === 0 &&
        t.stat("full") === "not full" && t.stat("lim") === "P-07: no window yet" &&
        t.logText().indexOf("The list opens at 00:00:00.0 with 120 free places.") >= 0,
        "Opens at 23:59:00.0: nothing sent, 120 places free, no window yet");

      // 2. The login check starts P-07's window and counts 1.
      begin();
      t.click("next");
      t.expect(has("23:59:00.5 P-07: login check, allowed. Window from 23:59:00.5, count 1.") &&
        t.stat("lim") === "P-07: window from 23:59:00.5, count 1",
        "23:59:00.5: the login check starts the window and counts 1 of 60");

      // 3. 59 names fit in the old window; the 61st request is refused at 00:00:00.4.
      begin();
      for (var a = 0; a < 5; a++) t.click("next");
      t.expect(has("00:00:00.0 P-07: 12 sent, 12 allowed. Window from 23:59:00.5, count 13.") &&
        has("00:00:00.4 P-07: 12 sent, 11 allowed, 1 refused (429, Retry-After: 1 s). Window from 23:59:00.5, count 60.") &&
        t.stat("p07") === 59 && t.stat("refused") === 1 && t.stat("left") === 61,
        "By 00:00:00.4: 59 names in the old window, 1 refused with Retry-After 1 s");

      // 4. A new window at 00:00:00.5 lets 60 more through: 119 by 00:00:00.9.
      begin();
      for (var b = 0; b < 5; b++) t.click("next");
      t.expect(has("00:00:00.5 P-07: 12 sent, 12 allowed. Window from 00:00:00.5, count 12.") &&
        has("00:00:00.9 P-07: 12 sent, 12 allowed. Window from 00:00:00.5, count 60.") &&
        t.stat("p07") === 119 && t.stat("first") === 119 && t.stat("left") === 1,
        "New window from 00:00:00.5: 60 more, 119 names by 00:00:00.9, 1 place left");

      // 5. Afua takes the last place; the others get list full.
      begin();
      t.click("end");
      t.expect(has("00:00:01.2 P-02 (Afua): place 120 of 120.") && has("00:00:01.5 P-04 (Sabriel): list full. 15 regulars left outside.") &&
        has("00:00:02.0 P-05 (Moyra): list full. 15 regulars left outside.") && t.stat("full") === "00:00:01.2" &&
        t.stat("door") === 1 && t.stat("refused") === 1,
        "List full at 00:00:01.2: 1 regular on from the door, 49 outside");

      // 6. Half the limit: 29 + 30 = 59, still twice the limit at the window edge.
      t.set("limit", "30");
      begin();
      t.click("end");
      t.expect(has("00:00:00.2 P-07: 12 sent, 5 allowed, 7 refused (429, Retry-After: 1 s). Window from 23:59:00.5, count 30.") &&
        t.stat("p07") === 59 && t.stat("first") === 59 && t.stat("door") === 50 && t.stat("left") === 11,
        "Limit 30: 29 before 00:00:00.5 and 30 after, 59 inside one second");

      // 7. Half the limit and two scripts: 118 in under a second.
      t.set("who", "two");
      t.click("end");
      t.expect(t.stat("p07") === 59 && t.stat("p03") === 59 && t.stat("left") === 0 && t.stat("full") === "00:00:01.5" && t.stat("door") === 2,
        "Limit 30, two scripts: 59 each, full at 00:00:01.5 with 2 regulars on");

      // 8. Ban P-07: the copy on P-03 takes the same 119.
      t.set("limit", "60");
      t.set("who", "copy");
      t.click("end");
      t.expect(t.stat("p03") === 119 && t.stat("p07") === 0 && t.stat("full") === "00:00:01.2" && t.stat("door") === 1,
        "P-07 banned: the copy on P-03 gets 119, full at 00:00:01.2");

      // 9. Token bucket: 10 at once, the door's 50 all on, 60 places left.
      t.set("who", "one");
      t.set("algo", "token");
      begin();
      t.click("end");
      t.expect(has("00:00:00.0 P-07: 12 sent, 10 allowed, 2 refused (429, Retry-After: 1 s). Tokens 0.0 of 10.") &&
        t.stat("p07") === 10 && t.stat("door") === 50 && t.stat("left") === 60 && t.stat("refused") === 110,
        "Token bucket: 10 names at 00:00:00.0, 110 refused, all 50 regulars on, 60 left");

      // 10. Token bucket with resends: 10, then about one a second.
      t.click("resend");
      for (var c = 0; c < 71; c++) t.click("sec");
      var at10 = t.stat("p07");
      t.click("end");
      t.expect(at10 === 20 && t.stat("p07") === 69,
        "Token bucket, resending every refused name: 20 by 00:00:10.9, 69 by 00:01:00.0");

      // 11. Sliding window: the login ages out at 00:00:00.5, one more gets in, then nothing.
      t.click("resend");
      t.set("algo", "sliding");
      begin();
      t.click("end");
      t.expect(has("00:00:00.5 P-07: 12 sent, 1 allowed, 11 refused (429, Retry-After: 60 s). 60 counted in the last 60 s.") &&
        t.stat("p07") === 60 && t.stat("first") === 60 && t.stat("left") === 10,
        "Sliding window: 60 names, never more than 60 in any 60 seconds; 10 places left");

      // 12. Leaky bucket drips one a second; and a login at 23:59:30.0 gives the fixed window 59.
      t.set("algo", "leaky");
      t.click("end");
      var leak = t.stat("p07") === 11 && t.stat("first") === 1;
      t.set("algo", "fixed");
      t.set("login", "300");
      t.click("end");
      t.expect(leak && t.stat("p07") === 59,
        "Leaky bucket: 11 names, one a second from 00:00:00.0; fixed window with the login at 23:59:30.0: 59");
    }
  });
})();
