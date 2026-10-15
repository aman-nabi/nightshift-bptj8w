/* sims/s8e03-v1.0.0.js  (published as sims/s8e03.js)
   Case s8e03 "Two Heads of Shift": a split-brain lab for the Zinnhorn cable car's booking system.
   Two servers, one in each station, sell the 30 seats of the 05:30 sunrise cabin. The top server
   is the primary; the bottom one is the standby. One fibre runs between them. The learner picks
   what fails at 23:58, the promotion wait, a witness, the majority rule with term numbers and a
   leader lease, manual failover, a second fibre in the same trench and the merge rule, then plays
   the night from 23:50 to 02:00. Widget-style sim: it draws its own stations and seat map in
   api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: one step a second from 23:50:00 to 02:00:00. Controls: what
     fails at 23:58 (the fibre, the top server dies, the whole top station is cut off, nothing),
     promotion wait (3, 10, 60 s), witness, majority rule, leader lease (5 s, 30 s), manual
     failover, second fibre in the same trench, merge rule (report, keep the later clock); Next
     minute, Play / pause, To the end, Reset. Stats: each server's role and term, the last
     election's votes, seats sold by each server, tickets, seats sold twice, tickets cancelled by
     the merge, time with two primaries, time with no primary, buyers turned away (no server could
     sell, sold out). selfTest: 11 assertions.

   The model (stated in sim.lede). Times are whole seconds; sim seconds count from midnight of
   Friday, so 00:41:37 on Saturday is 86400 + 2497.
   - Contacts each second. The fibre joins top and bottom; it is down from the cut, 23:58:00, until
     the splice, 01:52:10 ("the fibre" and "cut off"). The witness at the office is reached by each
     station's own internet line, a different path: the top server over its radio mast, the bottom
     over the valley line. "Cut off" also takes the top's mast down until 01:52:10; "dies" stops
     the top server at 23:58:00 for the rest of the night. The ticket website reaches each server
     by the same internet lines.
   - Order inside one second: (1) the failure or the splice; (2) contacts: a standby or the witness
     that hears a primary notes the time; with the majority rule a primary that meets a higher term
     steps down, and a primary renews its lease when it reaches a voter of its own term or lower;
     (3) the merge, when the two servers meet again after the cut; (4) with the majority rule, a
     primary whose lease has run out steps down; (5) promotion or election; (6) the duty manager,
     with manual failover; (7) buyers; (8) the two-primaries and no-primary counters.
   - As built: when the bottom server has heard nothing from a primary for the wait (silence =
     s - last heard - 1), it holds an election with one voter, itself, and makes itself primary.
     The top server never steps down. Nothing asks the witness.
   - Majority rule: a standby that has heard no primary for the wait asks for votes in the next
     term. It votes for itself. A voter (the other server, or the witness) gives its one vote for
     that term only if it is not primary, has itself heard no primary for the wait, and has not
     voted in that term. More than half of the voters (2 of 3 with the witness, 2 of 2 without)
     makes it primary with the higher term. A failed candidate tries again after another wait. A
     primary may sell only while its lease holds: it steps down when lease seconds pass without
     reaching a voter.
   - Manual failover: no server makes itself primary. When the bottom server has heard nothing for
     the wait, the alarm phones the duty manager, who looks from the office at 00:46:00 (given) and
     makes the bottom server primary only if the top one cannot be reached from there.
   - Buyers: 48, from 00:00, in pairs at the minutes in PAIRS (given), the first of each pair at :12
     dealt to the top server, the second at :37 to the bottom server. A server that is a selling
     primary sells its own lowest free seat; a standby that can reach the primary over the fibre
     passes the sale up; otherwise the website tries the other server; if neither can sell, the
     buyer is turned away. A primary with no free seat in its own copy turns the buyer away: sold
     out. A sale is copied to the other server while the fibre is up.
   - The merge: compare the two copies seat by seat, copy any sale only one side has, count every
     seat both sides sold as a conflict. "Report" leaves it for staff; "later clock" keeps the
     sale with the later time and cancels the other. As built, the top server is primary after it.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e03-v1.0.0.json).
   - Dates (given; weekdays checked with Date): the night of Friday 24 to Saturday 25 July 2026.
     The six seats of the summit hut (seats 1 to 6) were booked on Friday afternoon and are on both
     copies at 23:50. The link has run since spring 2020, six years; the last yearly failover test
     was Tuesday 12 May 2026 (the top server switched off).
   - As built, the fibre: cut 23:58:00, last heartbeat 23:57:59, bottom silent 10 s at 23:58:10 and
     PRIMARY. Pair 6 (minute 41): top sells seat 12 at 00:41:12, bottom sells seat 12 at 00:41:37.
     Each side sells seats 7 to 30 to its first 24 buyers: 24 + 24 + 6 = 54 tickets, 24 seats sold
     twice. Two primaries from 23:58:10 to 01:52:10 = 6,840 s = 1 h 54 min. Merge: 24 conflicts.
   - Keep the later clock (option A): each pair's bottom buyer came 25 s after its top twin, so the
     merge keeps 24 bottom sales and cancels 24 tickets, all sold first, by the top server.
   - Second fibre (option B): both cut at 23:58:00: the same 24 and 1 h 54 min.
   - Shorter or longer wait: 3 s: PRIMARY at 23:58:03, two primaries 1 h 54 min 7 s, 24 twice;
     60 s: 23:59:00, 1 h 53 min 10 s, still 24 (sales open at 00:00).
   - Witness and majority (option C), the fibre: the witness hears the top every second, so it
     refuses the bottom server at 23:58:10: 1 of 3. The top keeps its lease through the witness and
     sells to all buyers (the bottom's are sent to it): 24 sold, 24 turned away sold out, 30
     tickets, 0 twice, 0 s with two primaries.
   - Majority without a witness: the top's lease (5 s) runs out at 23:58:04; the bottom gets 1 of 2.
     No primary from 23:58:04 to 01:52:10 = 1 h 54 min 6 s; all 48 buyers turned away; at the
     splice the bottom wins term 2 with 2 of 2 (its next try falls on 01:52:10).
   - The whole top station cut off, majority with the witness: lease 5 s: the top steps down at
     23:58:04, the bottom wins term 2 with 2 of 3 at 23:58:10: 0 s with two primaries, 6 s with
     none. Lease 30 s: the top sells on until 23:58:28: 19 s with two primaries. At 01:52:10 the
     top sees term 2 and stays standby.
   - Manual failover (option D): the fibre: the manager sees the top selling at 00:46 and leaves it:
     0 twice. The top server dies: no primary from 23:58:00 to 00:46:00 = 48 min; the 14 buyers of
     pairs 1 to 7 are turned away; the bottom then sells 24 of the next 34, 10 sold out. As built
     the same death leaves 10 s with no primary.
*/
(function () {
  "use strict";

  var START = 85800;            // 23:50:00 Friday
  var END = 93600;              // 02:00:00 Saturday
  var CUT = 86280;              // 23:58:00, the digger
  var HEAL = 93130;             // 01:52:10, the splice
  var OPEN = 86400;             // 00:00:00, sunrise seats go on sale
  var MANUAL_AT = 89160;        // 00:46:00, the duty manager looks
  var SEATS = 30, HUT = 6;
  var PAIRS = [2, 5, 11, 19, 30, 41, 44, 48, 51, 55, 58, 62, 66, 70, 74, 77, 81, 85, 89, 93, 97, 100, 104, 108];
  var NAMES = ["top", "bottom"];
  var FAILS = [
    { value: "fibre", label: "The fibre (tonight)" },
    { value: "dies", label: "The top server dies" },
    { value: "cutoff", label: "The whole top station is cut off" },
    { value: "none", label: "Nothing fails" }
  ];
  var WAITS = [{ value: "3", label: "3 s" }, { value: "10", label: "10 s (as built)" }, { value: "60", label: "60 s" }];
  var LEASES = [{ value: "5", label: "5 s (shorter than the wait)" }, { value: "30", label: "30 s" }];
  var MERGES = [{ value: "report", label: "Report conflicts (as built)" }, { value: "later", label: "Keep the later clock time" }];

  var BUYERS = [];
  PAIRS.forEach(function (m, i) {
    BUYERS.push({ n: 2 * i + 1, at: OPEN + m * 60 + 12, side: 0 });
    BUYERS.push({ n: 2 * i + 2, at: OPEN + m * 60 + 37, side: 1 });
  });

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { s = ((s % 86400) + 86400) % 86400; return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); }
  function dur(sec) {
    if (!sec) return "0 s";
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, out = [];
    if (h) out.push(h + " h");
    if (m) out.push(m + " min");
    if (s) out.push(s + " s");
    return out.join(" ");
  }

  /* ---------- the model ---------- */

  function initial(C) {
    var M = {
      C: C, now: START, two: 0, none: 0, away: 0, soldout: 0, cancelled: 0, double: 0,
      votes: "no election yet", alarm: false, merged: false, srv: [], wit: { term: 1, last: START, voted: 1 }
    };
    for (var i = 0; i < 2; i++) {
      var seats = [];
      for (var k = 0; k <= SEATS; k++) seats.push(k >= 1 && k <= HUT ? { buyer: "hut", at: 0, by: 0 } : null);
      M.srv.push({ role: i === 0 ? "primary" : "standby", term: 1, voted: 1, last: START, renew: START, sold: 0, seats: seats, next: 0, failed: false });
    }
    return M;
  }

  function topAlive(M, s) { return !(M.C.fail === "dies" && s >= CUT); }
  function fibreUp(M, s) { return !((M.C.fail === "fibre" || M.C.fail === "cutoff") && s >= CUT && s < HEAL); }
  function topNet(M, s) { return topAlive(M, s) && !(M.C.fail === "cutoff" && s >= CUT && s < HEAL); }
  function tb(M, s) { return fibreUp(M, s) && topAlive(M, s); }
  function reachW(M, i, s) { return M.C.witness && (i === 0 ? topNet(M, s) : true); }
  function alive(M, i, s) { return i === 1 || topAlive(M, s); }
  function selling(M, i, s) { return alive(M, i, s) && M.srv[i].role === "primary"; }

  // a primary meets a voter (the other server or the witness); returns nothing
  function meet(M, i, v, s, log) {
    var a = M.srv[i];
    if (a.role !== "primary") return;
    if (M.C.majority) {
      if (v.term > a.term) {
        log("The " + NAMES[i] + " server sees term " + v.term + ", higher than its own " + a.term + ", and steps down to standby.", "ok");
        a.role = "standby"; a.term = v.term; a.last = s;
        return;
      }
      v.term = a.term;
      a.renew = s;
    }
    if (v.role !== "primary") v.last = s;
  }

  function contacts(M, s, log) {
    var T = M.srv[0], B = M.srv[1], W = M.wit;
    if (tb(M, s)) {
      if (T.role === "primary" && B.role === "primary") {
        // as built: two banners, and the merge settles it; with terms, the lower term steps down
        if (M.C.majority) { var lo = T.term < B.term ? 0 : 1; meet(M, lo, M.srv[1 - lo], s, log); }
      } else if (T.role === "primary") meet(M, 0, B, s, log);
      else if (B.role === "primary") meet(M, 1, T, s, log);
    }
    if (M.C.majority) {
      for (var i = 0; i < 2; i++) if (alive(M, i, s) && reachW(M, i, s)) meet(M, i, W, s, log);
    }
  }

  function merge(M, s, log) {
    var T = M.srv[0], B = M.srv[1], conflicts = 0, copied = 0, cancel = [0, 0];
    if (T.role === "primary" && B.role === "primary") log("Both servers see each other again. Two banners: PRIMARY and PRIMARY.", "bad");
    for (var k = HUT + 1; k <= SEATS; k++) {
      var a = T.seats[k], b = B.seats[k];
      if (a && b && a.buyer !== b.buyer) {
        conflicts++;
        if (M.C.merge === "later") {
          var keep = a.at >= b.at ? a : b;
          cancel[keep === a ? 1 : 0]++;
          T.seats[k] = keep; B.seats[k] = keep;
        }
      } else if (a && !b) { B.seats[k] = a; copied++; }
      else if (b && !a) { T.seats[k] = b; copied++; }
    }
    log("The merge compares the two copies seat by seat: " + copied + " sales copied across, " + conflicts + " conflicting seats.", conflicts ? "bad" : "ok");
    if (M.C.merge === "later" && conflicts) {
      M.cancelled += cancel[0] + cancel[1];
      log("Keeping the later clock time on each conflicting seat cancels " + (cancel[0] + cancel[1]) + " tickets: " + cancel[0] + " sold by the top server, " + cancel[1] + " by the bottom server.", "bad");
    }
    if (!M.C.majority && T.role === "primary" && B.role === "primary") {
      B.role = "standby"; B.last = s;
      log("As built, the merge makes the top server primary again and the bottom one standby.", "");
    }
    M.merged = true;
  }

  function election(M, i, s, log) {
    var c = M.srv[i], o = M.srv[1 - i], W = M.wit, C = M.C;
    var t = c.term + 1, votes = 1, total = C.witness ? 3 : 2, why = [];
    if (tb(M, s) && alive(M, 1 - i, s)) {
      if (o.role !== "primary" && s - o.last - 1 >= C.wait && o.voted < t) votes++;
      else why.push("the " + NAMES[1 - i] + " server says no");
    } else why.push("it cannot reach the " + NAMES[1 - i] + " server");
    if (C.witness) {
      if (!reachW(M, i, s)) why.push("it cannot reach the witness");
      else if (s - W.last - 1 >= C.wait && W.voted < t) votes++;
      else why.push("the witness says no: it heard a primary " + Math.max(0, s - W.last) + " s ago");
    }
    M.votes = NAMES[i] + ": " + votes + " of " + total;
    if (votes * 2 > total) {
      c.role = "primary"; c.term = t; c.voted = t; c.renew = s; c.last = s;
      if (C.witness && reachW(M, i, s)) { W.voted = t; W.term = t; W.last = s; }
      if (tb(M, s) && alive(M, 1 - i, s)) { o.voted = t; o.term = t; o.last = s; }
      log("The " + NAMES[i] + " server asks for votes in term " + t + " and gets " + votes + " of " + total + ". It becomes PRIMARY, term " + t + ".", "ok");
    } else {
      c.next = s + C.wait;
      if (!c.failed) log("The " + NAMES[i] + " server asks for votes in term " + t + " and gets " + votes + " of " + total + " (" + why.join("; ") + "). It stays standby.", "warn");
      c.failed = true;
    }
  }

  function sellAt(M, p, s, buyer) {
    var P = M.srv[p], k;
    for (k = HUT + 1; k <= SEATS; k++) if (!P.seats[k]) break;
    if (k > SEATS) return "soldout";
    var sale = { buyer: buyer.n, at: s, by: p };
    P.seats[k] = sale;
    P.sold++;
    var O = M.srv[1 - p];
    if (tb(M, s)) O.seats[k] = sale;
    else if (O.seats[k] && O.seats[k].buyer !== buyer.n && O.seats[k].buyer !== "hut") {
      M.double++;
      M.lastDouble = k;
      M.log("Seat " + k + " is now sold twice: once by each server.", "bad");
    }
    return "sold";
  }

  function tryServe(M, i, s, buyer) {
    if (i === 0 && !topNet(M, s)) return null;
    if (selling(M, i, s)) return sellAt(M, i, s, buyer);
    if (M.srv[i].role === "standby" && tb(M, s) && selling(M, 1 - i, s)) return sellAt(M, 1 - i, s, buyer);
    return null;
  }

  function stepSecond(M, s, log) {
    var C = M.C, T = M.srv[0], B = M.srv[1], i;
    M.log = log;
    // (1) the failure or the splice
    if (s === CUT) {
      if (C.fail === "fibre") log("The digger cuts the fibre under the access road." + (C.second ? " The bucket takes both fibres: they share one trench." : ""), "bad");
      if (C.fail === "cutoff") log("The top station is cut off: the fibre" + (C.second ? "s" : "") + " and its radio mast are down.", "bad");
      if (C.fail === "dies") { T.role = "dead"; log("The top server dies.", "bad"); }
    }
    if (s === HEAL && (C.fail === "fibre" || C.fail === "cutoff")) log("The jointer's splice brings the link back.", "");
    if (s === OPEN) log("Sunrise seats go on sale: 24 left after the hut's 6.", "");
    // (2) contacts
    contacts(M, s, log);
    // (3) the merge when the two servers meet again
    if (!M.merged && s >= HEAL && (C.fail === "fibre" || C.fail === "cutoff") && tb(M, s)) merge(M, s, log);
    // (4) leases
    if (C.majority) {
      for (i = 0; i < 2; i++) {
        var x = M.srv[i];
        if (x.role === "primary" && alive(M, i, s) && s - x.renew >= C.lease) {
          x.role = "standby"; x.last = s;
          log("The " + NAMES[i] + " server's lease runs out: no voter has answered for " + C.lease + " s, so it stops selling and steps down.", "warn");
        }
      }
    }
    // (5) promotion or election
    if (!C.manual) {
      for (i = 0; i < 2; i++) {
        var y = M.srv[i];
        if (!alive(M, i, s) || y.role !== "standby" || s < y.next) continue;
        if (!C.majority && i === 0) continue;
        if (s - y.last - 1 < C.wait) continue;
        if (C.majority) election(M, i, s, log);
        else {
          y.role = "primary";
          M.votes = "bottom: 1, its own";
          log("The bottom server has heard nothing for " + C.wait + " s. It holds an election with one voter, itself, and wins: PRIMARY.", "bad");
        }
      }
    } else {
      // (6) the duty manager
      if (!M.alarm && B.role === "standby" && s - B.last - 1 >= C.wait) {
        M.alarm = true;
        log("The bottom server has heard nothing for " + C.wait + " s. The alarm phones the duty manager.", "warn");
      }
      if (M.alarm && s === MANUAL_AT && B.role === "standby") {
        if (topNet(M, s) && T.role === "primary") log("The duty manager looks from the office: the top server is still selling, so it stays primary.", "ok");
        else {
          B.role = "primary";
          if (C.majority) { B.term = Math.max(T.term, B.term) + 1; B.renew = s; if (C.witness) { M.wit.term = B.term; M.wit.last = s; } }
          log("The duty manager cannot reach the top server and makes the bottom one PRIMARY.", "warn");
        }
      }
    }
    // (7) buyers
    BUYERS.forEach(function (b) {
      if (b.at !== s) return;
      var r = tryServe(M, b.side, s, b);
      if (r === null) r = tryServe(M, 1 - b.side, s, b);
      if (r === null) M.away++;
      else if (r === "soldout") M.soldout++;
    });
    // (8) counters
    var n = 0;
    for (i = 0; i < 2; i++) if (selling(M, i, s)) n++;
    if (n === 2) M.two++;
    if (n === 0) M.none++;
  }

  function roleText(M, i) {
    var x = M.srv[i];
    if (x.role === "dead" || (i === 0 && !topAlive(M, M.now))) return "dead";
    var r = x.role === "primary" ? "PRIMARY" : "standby";
    return M.C.majority ? r + ", term " + x.term : r;
  }

  /* ---------- drawing ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, g);
    t.textContent = s;
    return t;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function build(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    var wrap = doc.createElement("div");
    wrap.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    wrap.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 250", width: "100%", "class": "dg", role: "img",
      "aria-label": "The two stations and the office. Each station box shows its server's role. The line between them is the fibre, dashed when cut. Below, one square per seat of the 05:30 cabin: hut seats, seats sold by the top server, by the bottom server, and seats sold twice."
    });
    var layer = mk(doc, "g", {}, svg);
    wrap.appendChild(svg);
    api.root.appendChild(wrap);
    return { doc: doc, head: head, layer: layer };
  }

  function box(doc, g, x, y, w, h, tone, l1, l2) {
    var gg = mk(doc, "g", { "class": "dg-node" + (tone ? " st-" + tone : "") }, g);
    mk(doc, "rect", { x: x, y: y, width: w, height: h, rx: 8, fill: "none", stroke: "currentColor" }, gg);
    txt(doc, g, x + w / 2, y + 20, l1, "dg-label", "middle");
    if (l2) txt(doc, g, x + w / 2, y + 38, l2, "dg-note", "middle");
  }

  function drawAll(S) {
    var M = S.M, doc = S.ui.doc, g = S.ui.layer, s = M.now;
    clear(g);
    var tone = function (i) { var r = roleText(M, i); return r === "dead" ? "muted" : (r.indexOf("PRIMARY") === 0 ? (selling(M, 1 - i, s) ? "bad" : "ok") : ""); };
    box(doc, g, 20, 10, 190, 50, tone(0), "Top server", roleText(M, 0));
    box(doc, g, 20, 110, 190, 50, tone(1), "Bottom server", roleText(M, 1));
    box(doc, g, 450, 60, 190, 50, M.C.witness ? "accent" : "muted", M.C.witness ? "Witness, office" : "No witness", M.C.witness ? "term " + M.wit.term : "");
    var up = tb(M, s);
    var gl = mk(doc, "g", { "class": "dg-node " + (up ? "st-ok" : "st-bad") }, g);
    mk(doc, "line", { x1: 115, y1: 60, x2: 115, y2: 110, stroke: "currentColor", "stroke-width": 2, "stroke-dasharray": up ? "" : "5 4" }, gl);
    txt(doc, g, 125, 89, up ? "fibre" : "fibre cut", "dg-note");
    // seat map
    var T = M.srv[0].seats, B = M.srv[1].seats;
    for (var k = 1; k <= SEATS; k++) {
      var col = (k - 1) % 15, row = Math.floor((k - 1) / 15);
      var a = T[k], b = B[k], st = "";
      if (k <= HUT) st = "muted";
      else if (a && b && a.buyer !== b.buyer) st = "bad";
      else if (a || b) st = (a ? a.by : b.by) === 0 ? "ok" : "accent";
      var gs = mk(doc, "g", { "class": "dg-node" + (st ? " st-" + st : "") }, g);
      mk(doc, "rect", { x: 20 + col * 42, y: 180 + row * 30, width: 34, height: 22, rx: 3, fill: st ? "currentColor" : "none", "fill-opacity": st ? 0.25 : 0, stroke: "currentColor" }, gs);
      txt(doc, g, 37 + col * 42, 195 + row * 30, String(k), "dg-note", "middle");
    }
  }

  function show(api) {
    var S = api.state, M = S.M, C = S.C;
    api.clock = M.now;
    var f = FAILS.filter(function (o) { return o.value === C.fail; })[0].label;
    S.ui.head.textContent = "At 23:58: " + f.toLowerCase() + ". Wait " + C.wait + " s. Witness " + (C.witness ? "on" : "off") +
      ". Majority rule " + (C.majority ? "on, lease " + C.lease + " s" : "off") + (C.manual ? ". Manual failover" : "") +
      (C.second ? ". Two fibres, one trench" : "") + ". Merge: " + (C.merge === "later" ? "later clock" : "report") + ".";
    S.stat.top(roleText(M, 0));
    S.stat.bottom(roleText(M, 1));
    S.stat.votes(M.votes);
    S.stat.soldtop(M.srv[0].sold);
    S.stat.soldbottom(M.srv[1].sold);
    S.stat.tickets(HUT + M.srv[0].sold + M.srv[1].sold);
    S.stat.double(M.double);
    S.stat.cancelled(M.cancelled);
    S.stat.two(dur(M.two));
    S.stat.none(dur(M.none));
    S.stat.away(M.away);
    S.stat.soldout(M.soldout);
    drawAll(S);
  }

  function advance(api, to) {
    var S = api.state, M = S.M;
    to = Math.min(END, to);
    for (var s = M.now + 1; s <= to; s++) {
      M.now = s;
      api.clock = s;
      stepSecond(M, s, function (msg, tone) { api.log(msg, tone); });
    }
    if (M.now >= END) {
      if (!S.endLogged) {
        S.endLogged = true;
        api.log("End: " + (HUT + M.srv[0].sold + M.srv[1].sold) + " tickets for " + SEATS + " seats, " + M.double + " seats sold twice, " + dur(M.two) + " with two primaries, " + dur(M.none) + " with none.", M.double ? "bad" : "ok");
      }
      S.playing = false;
    }
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = initial(S.C);
    S.playing = false;
    S.endLogged = false;
    api.clock = S.M.now;
    api.log(what + " Rewound to " + hms(S.M.now) + ".", "");
    show(api);
  }

  DL.sims.define("s8e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { fail: "fibre", wait: 10, witness: false, majority: false, lease: 5, manual: false, second: false, merge: "report" };
      S.ui = build(api);
      S.stat = {
        top: api.stat("top", "top server", ""),
        bottom: api.stat("bottom", "bottom server", ""),
        votes: api.stat("votes", "last election", ""),
        soldtop: api.stat("soldtop", "seats sold by the top server", ""),
        soldbottom: api.stat("soldbottom", "seats sold by the bottom server", ""),
        tickets: api.stat("tickets", "tickets for the 30 seats", ""),
        double: api.stat("double", "seats sold twice", "bad"),
        cancelled: api.stat("cancelled", "tickets cancelled by the merge", "bad"),
        two: api.stat("two", "time with two primaries", "bad"),
        none: api.stat("none", "time with no primary", "warn"),
        away: api.stat("away", "buyers turned away: no server could sell", "warn"),
        soldout: api.stat("soldout", "buyers turned away: sold out", "")
      };
      api.control.select("fail", "What fails at 23:58", FAILS, "fibre", function (v) {
        var ok = ["fibre", "dies", "cutoff", "none"].indexOf(String(v)) >= 0;
        S.C.fail = ok ? String(v) : "fibre";
        rewind(api, "At 23:58: " + FAILS.filter(function (o) { return o.value === S.C.fail; })[0].label.toLowerCase() + ".");
      });
      api.control.select("wait", "Promotion wait (silence before an election)", WAITS, "10", function (v) {
        var n = Number(v);
        S.C.wait = n === 3 || n === 60 ? n : 10;
        rewind(api, "The wait is " + S.C.wait + " s.");
      });
      api.control.toggle("witness", "Witness: a third voter at the office", false, function (on) {
        S.C.witness = !!on;
        rewind(api, "Witness " + (on ? "on." : "off."));
      });
      api.control.toggle("majority", "Majority rule: votes, term numbers and a lease", false, function (on) {
        S.C.majority = !!on;
        rewind(api, "Majority rule " + (on ? "on." : "off."));
      });
      api.control.select("lease", "Leader lease", LEASES, "5", function (v) {
        S.C.lease = Number(v) === 30 ? 30 : 5;
        rewind(api, "The lease is " + S.C.lease + " s.");
      });
      api.control.toggle("manual", "Manual failover: the duty manager decides", false, function (on) {
        S.C.manual = !!on;
        rewind(api, "Manual failover " + (on ? "on." : "off."));
      });
      api.control.toggle("second", "Second fibre in the same trench", false, function (on) {
        S.C.second = !!on;
        rewind(api, on ? "Two fibres, one trench." : "One fibre.");
      });
      api.control.select("merge", "When the link returns", MERGES, "report", function (v) {
        S.C.merge = String(v) === "later" ? "later" : "report";
        rewind(api, "The merge will " + (S.C.merge === "later" ? "keep the later clock time." : "report conflicts."));
      });
      api.control.button("next", "Next minute", function () { advance(api, S.M.now + 60); });
      api.control.button("play", "Play / pause", function () { S.playing = !S.playing && S.M.now < END; });
      api.control.button("end", "To the end", function () { advance(api, END); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> Each station box shows its server's role: PRIMARY sells seats, standby passes sales up the fibre to the primary. With the majority rule on, each role shows its term number. The witness votes and holds no seats. In the seat map, grey seats are the hut's, green were sold by the top server, blue by the bottom server, and red were sold twice.");
      S.M = initial(S.C);
      S.playing = false;
      S.endLogged = false;
      api.clock = S.M.now;
      api.log("Friday 24 July, before the cut. The top server is PRIMARY, the bottom one standby. Seats 1 to 6 are the hut's.", "");
      show(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.playing) { S.acc = 0; return; }
      S.acc = (S.acc || 0) + dt * 60;
      var n = Math.floor(S.acc);
      if (n > 0) { S.acc -= n; advance(api, S.M.now + n); }
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function fresh() { t.click("reset"); }

      // 1. Opens at 23:50:00, before the cut.
      t.expect(t.api.clock === START && t.stat("top") === "PRIMARY" && t.stat("bottom") === "standby" && t.stat("tickets") === 6 &&
        t.stat("double") === 0 && t.stat("two") === "0 s",
        "Opens at 23:50:00: top PRIMARY, bottom standby, 6 hut tickets, nothing sold twice");

      // 2. As built, to 00:42: the bottom makes itself primary at 23:58:10 and seat 12 is sold twice at 00:41.
      for (var m = 0; m < 52; m++) t.click("next");
      t.expect(has("23:58:10 The bottom server has heard nothing for 10 s. It holds an election with one voter, itself, and wins: PRIMARY.") &&
        has("00:41:37 Seat 12 is now sold twice: once by each server.") && t.stat("double") === 6 && t.stat("top") === "PRIMARY" && t.stat("bottom") === "PRIMARY",
        "As built: PRIMARY at 23:58:10 after 10 s of silence; seat 12 sold twice at 00:41:37");

      // 3. As built, to the end: 54 tickets, 24 twice, 1 h 54 min with two primaries.
      t.click("end");
      t.expect(t.stat("tickets") === 54 && t.stat("soldtop") === 24 && t.stat("soldbottom") === 24 && t.stat("double") === 24 &&
        t.stat("two") === "1 h 54 min" && has("01:52:10 Both servers see each other again. Two banners: PRIMARY and PRIMARY.") &&
        has("0 sales copied across, 24 conflicting seats."),
        "As built: 54 tickets for 30 seats, 24 seats sold twice, two primaries for 1 h 54 min, merge reports 24 conflicts");

      // 4. Option C: witness and majority rule. One primary, nothing twice.
      fresh(); t.click("witness"); t.click("majority"); t.click("end");
      t.expect(t.stat("double") === 0 && t.stat("two") === "0 s" && t.stat("none") === "0 s" && t.stat("tickets") === 30 &&
        t.stat("soldtop") === 24 && t.stat("soldout") === 24 && t.stat("votes") === "bottom: 1 of 3" && t.stat("bottom") === "standby, term 1" &&
        has("23:58:10 The bottom server asks for votes in term 2 and gets 1 of 3 (it cannot reach the top server; the witness says no: it heard a primary 0 s ago). It stays standby."),
        "Witness and majority: the bottom gets 1 of 3; the top sells all 24; 30 tickets, 0 twice, 0 s with two primaries");

      // 5. The witness alone changes nothing, and so does a second fibre in the same trench.
      fresh(); t.click("witness"); t.click("end");
      var w = t.stat("double") === 24 && t.stat("two") === "1 h 54 min";
      fresh(); t.click("second"); t.click("end");
      t.expect(w && t.stat("double") === 24 && t.stat("tickets") === 54 && has("The bucket takes both fibres: they share one trench."),
        "A witness nobody asks, or a second fibre in the same trench: still 24 seats sold twice");

      // 6. The majority rule with no witness: no split brain, and no primary at all until the splice.
      fresh(); t.click("majority"); t.click("end");
      t.expect(t.stat("double") === 0 && t.stat("tickets") === 6 && t.stat("away") === 48 && t.stat("none") === "1 h 54 min 6 s" &&
        t.stat("bottom") === "PRIMARY, term 2" && t.stat("votes") === "bottom: 2 of 2" && has("23:58:04 The top server's lease runs out"),
        "Two voters: 2 of 2 can't be reached, so nobody sells from 23:58:04 to 01:52:10; 48 buyers turned away");

      // 7. A shorter or longer wait still splits.
      fresh(); t.set("wait", "3"); t.click("end");
      var w3 = t.stat("double") === 24 && t.stat("two") === "1 h 54 min 7 s";
      fresh(); t.set("wait", "60"); t.click("end");
      t.expect(w3 && t.stat("double") === 24 && t.stat("two") === "1 h 53 min 10 s",
        "A 3 s or 60 s wait: 24 seats sold twice either way");

      // 8. Option A: keep the later clock cancels the 24 top-server tickets, sold first.
      fresh(); t.set("merge", "later"); t.click("end");
      t.expect(t.stat("cancelled") === 24 && has("cancels 24 tickets: 24 sold by the top server, 0 by the bottom server."),
        "Keep the later clock: 24 tickets cancelled, every one sold first, by the top server");

      // 9. The whole top station cut off: a real election, and the lease decides the overlap.
      fresh(); t.set("fail", "cutoff"); t.click("witness"); t.click("majority"); t.click("end");
      var l5 = t.stat("two") === "0 s" && t.stat("none") === "6 s" && t.stat("votes") === "top: 1 of 3" &&
        has("23:58:10 The bottom server asks for votes in term 2 and gets 2 of 3. It becomes PRIMARY, term 2.") && t.stat("bottom") === "PRIMARY, term 2";
      t.set("lease", "30"); t.click("end");
      t.expect(l5 && t.stat("two") === "19 s" && t.stat("double") === 0,
        "Top station cut off: with a 5 s lease the bottom wins term 2 with 2 of 3 and there is never a second primary; a 30 s lease gives 19 s with two");

      // 10. Option D: manual failover. The fibre: nothing twice. The top dies: 48 min with no primary.
      fresh(); t.click("manual"); t.click("end");
      var mf = t.stat("double") === 0 && t.stat("none") === "0 s" && has("00:46:00 The duty manager looks from the office: the top server is still selling");
      t.set("fail", "dies"); t.click("end");
      t.expect(mf && t.stat("none") === "48 min" && t.stat("away") === 14 && t.stat("soldbottom") === 24 && t.stat("soldout") === 10,
        "Manual failover: no split brain on the fibre night; when the top dies, 48 min with no primary and 14 buyers turned away");

      // 11. As built, the top server dies: the failover the yearly test knows, 10 s with no primary.
      fresh(); t.set("fail", "dies"); t.click("end");
      t.expect(t.stat("none") === "10 s" && t.stat("double") === 0 && t.stat("tickets") === 30 && t.stat("top") === "dead",
        "As built, a real death: the bottom takes over after 10 s, 30 tickets, nothing twice");
    }
  });
})();
