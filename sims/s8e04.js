/* sims/s8e04-v1.0.0.js  (published as sims/s8e04.js)
   Case s8e04 "The Vote": a vote lab for a beekeepers' cooperative that books hives into orchard rows.
   Three servers, A (extraction shed), B and C (office), keep one numbered record of bookings. On
   Thursday 22 October 2026 a new switch in the shed failed from 00:50:00 to 01:30:00 and cut A off
   from B and C. A kept leading alone and confirmed 50 bookings from the valley floor; B and C elected
   B after 30 seconds and confirmed 20 from the hill farms. At 01:30 the home-made rule "after a split,
   the longest record leads" chose A (150 entries against 120), and A's copy replaced the 20.
   The learner sets when a booking counts as confirmed, what happens when A rejoins, the cut, the
   election timeout and a slow server C, then plays 00:40 to 01:31 and reads each server's record and
   term, the leaders, confirmed and erased bookings, and the minutes when no booking could be confirmed.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls confirm after, at rejoin, cut A off, election timeout,
     slow server C; Play 00:40 to 01:31; Reset. Stats: records at 01:29:59, leaders, bookings
     confirmed, confirmed bookings erased, bookings to send again, minutes no booking could be
     confirmed, last booking confirmed, booking 112, row 7 goes to, the night. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e04-v1.0.0.json).
   All of it is given data stated in sim.lede, and each count is checked by the selfTest.
   - Before 00:50 every server holds the same 100 entries (this season's bookings 1 to 100); A leads.
   - The cut: 00:50:00 to 01:30:00, 40 minutes.
   - The valley floor: 50 bookings to A, one every 48 s from 00:50:00 (k = 0..49, last 01:29:12).
     On A they become entries 101 to 150. Entry 112 on A (k = 11) is from 00:58:48.
   - The hill farms: 20 bookings to B or C, one every 2 minutes from 00:50:40 (j = 0..19, last 01:28:40).
     On B and C they become entries 101 to 120. Ragnfrid's is j = 11: 01:12:40, entry 112, row 7.
   - Records at 01:29:59 when cut: A 100 + 50 = 150; B and C 100 + 20 = 120. Both share the first 100.
   - Row clashes (same row booked on both sides), given data: A's k = 7 (00:55:36, entry 108) with
     hill j = 2 (00:54:40, entry 103); A's k = 36 (01:18:48, entry 137, Tormod, row 7) with hill
     j = 11 (01:12:40, Ragnfrid, row 7); A's k = 40 (01:22:00, entry 141) with hill j = 16 (01:22:40,
     entry 117). Newest stamp wins each: 103 lost, 112 lost, 141 lost: 3.
   - Election timeout 30 s: B elected at 00:50:30. At 10 minutes: at 01:00:00, and the 5 hill
     bookings sent before then (j = 0..4) wait for it.
   - Minutes no booking could be confirmed during the cut: confirm after one, 0; a majority, the
     election timeout (0.5 or 10); all three, 40.
   - Slow C stores one entry every 2 minutes. Not cut, confirm after all three: 67 entries (70 less
     3 refused as row already booked) queue from 00:50:00, the last confirmed at 00:50 + 134 min = 03:04:00.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START = 40 * 60;               // 00:40:00, before the cut
  var CUT = 50 * 60;                 // 00:50:00, the shed switch fails
  var BACK = 90 * 60;                // 01:30:00, the switch restarts itself
  var SHARED = 100;
  var VALLEY = 50, V_EVERY = 48;
  var HILL = 20, H_FIRST = 50 * 60 + 40, H_EVERY = 120;
  var SLOW = 120;                    // a slow C takes 2 minutes to store each entry
  var HER = 11;                      // hill booking j = 11: Ragnfrid, 01:12:40, row 7
  var HIS = 36;                      // valley booking k = 36: Tormod, 01:18:48, row 7
  var CLASH = [{ k: 7, j: 2 }, { k: HIS, j: HER }, { k: 40, j: 16 }];

  var CONFIRMS = [
    { value: "one", label: "one server: the leader alone (as built)" },
    { value: "majority", label: "a majority: two of three" },
    { value: "all", label: "all three servers" }
  ];
  var RULES = [
    { value: "longest", label: "the longest record leads and is copied over (as built)" },
    { value: "newest", label: "each clash goes to the newest timestamp" },
    { value: "raft", label: "raft: terms, up-to-date votes, step down" }
  ];
  var CUTS = [
    { value: "on", label: "cut off 00:50 to 01:30 (as on the night)" },
    { value: "off", label: "never cut off" }
  ];
  var TIMEOUTS = [
    { value: "30", label: "30 seconds (as built)" },
    { value: "600", label: "10 minutes" }
  ];
  var SLOWS = [
    { value: "off", label: "no: C stores at once" },
    { value: "on", label: "yes: 2 minutes per entry" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(sec) {
    var s = ((Math.round(sec) % 86400) + 86400) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // Every booking of the night, with its side, its time and its row clash.
  function bookings() {
    var out = [];
    var k, j;
    for (k = 0; k < VALLEY; k++) out.push({ side: "v", i: k, t: CUT + V_EVERY * k });
    for (j = 0; j < HILL; j++) out.push({ side: "h", i: j, t: H_FIRST + H_EVERY * j });
    out.forEach(function (b) {
      b.clash = null;
      CLASH.forEach(function (c, n) {
        if ((b.side === "v" && b.i === c.k) || (b.side === "h" && b.i === c.j)) b.clash = n;
      });
      b.conf = null;     // time it was confirmed to the member
      b.kept = false;    // still in the record after the rejoin
    });
    return out;
  }

  // C stores entries one after another; returns each entry's finish time.
  function queue(times, slow, from) {
    var f = from || 0;
    return times.map(function (a) {
      f = Math.max(a, f) + (slow ? SLOW : 0);
      return f;
    });
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function night(C) {
    var r = { lines: [], books: bookings(), rec: null, after: null, leaders: "", lost: 0, confirmed: 0,
      resend: 0, refused: 0, nobook: 0, last: "none", her: "", row7: "", how: "" };
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    var slow = C.slow === "on";
    var raft = C.rule === "raft";
    var B = r.books;
    var her = B.filter(function (b) { return b.side === "h" && b.i === HER; })[0];
    var his = B.filter(function (b) { return b.side === "v" && b.i === HIS; })[0];

    line(START, "All three servers hold the same " + SHARED + " entries. A leads" + (raft ? " in term 1." : "."), "");

    if (C.cut === "off") {
      // A leads all night; a second booking for a booked row is refused.
      var sorted = B.slice().sort(function (a, b) { return a.t - b.t; });
      var taken = {};
      var stored = [];
      sorted.forEach(function (b) {
        if (b.clash !== null && taken[b.clash]) { r.refused += 1; return; }
        if (b.clash !== null) taken[b.clash] = true;
        stored.push(b);
      });
      var cf = queue(stored.map(function (b) { return b.t; }), slow, 0);
      stored.forEach(function (b, n) {
        b.kept = true;
        b.conf = C.confirm === "all" ? cf[n] : b.t;
      });
      line(CUT, "The shed switch holds. A leads all night and copies every booking to B and C as it comes in." +
        (slow && C.confirm === "all" ? " C stores one entry every 2 minutes, and every booking waits for C." : ""), "ok");
      line(his.t, "Tormod asks for row 7 at 01:18:48. A already holds Ragnfrid's booking for it from 01:12:40: row already booked, choose another.", "ok");
      var n0 = SHARED + stored.length;
      r.rec = { A: [n0, 1], B: [n0, 1], C: [n0, 1] };
      r.after = r.rec;
      r.leaders = raft ? "term 1: A, all night" : "A, all night";
    } else {
      var E = CUT + Number(C.timeout);
      line(CUT, "The shed switch fails. A is cut off from B and C; members on the valley floor still reach A through its own internet line.", "warn");
      if (C.confirm === "one") line(CUT, "A never learns it is cut off. It keeps leading, and confirms each booking once it has stored it.", "bad");
      else line(CUT, "A stores each valley booking but cannot reach " + (C.confirm === "all" ? "all three" : "a majority") + ", so it confirms none: the members' apps show waiting.", "ok");
      if (raft) {
        line(E, "B's election timeout runs out. B starts term 2 and votes for itself. C's last entry is from term 1, like B's, and both hold 100, so B's record is at least as up to date: C votes B. B leads term 2.", "");
      } else {
        line(E, "B and C have heard nothing from A for " + (C.timeout === "30" ? "30 seconds" : "10 minutes") + ". Election: B has 100 entries, C has 100, a tie goes to B. B leads.", "");
      }
      if (E > H_FIRST) line(E, "The 5 hill bookings sent since 00:50:40 waited for a leader and go to B now.", "warn");

      // During the cut.
      var hill = B.filter(function (b) { return b.side === "h"; });
      var vall = B.filter(function (b) { return b.side === "v"; });
      vall.forEach(function (b) { b.onA = true; if (C.confirm === "one") b.conf = b.t; });
      var atB = hill.map(function (b) { return Math.max(b.t, E); });
      var cq = queue(atB, slow, 0);
      hill.forEach(function (b, n) {
        b.onBC = true;
        b.cFinish = cq[n];
        if (C.confirm === "one") b.conf = atB[n];
        else if (C.confirm === "majority") b.conf = cq[n];
      });
      if (C.confirm === "one") r.nobook = 0;
      else if (C.confirm === "majority") r.nobook = (E - CUT) / 60;
      else r.nobook = (BACK - CUT) / 60;

      var herLine = "Ragnfrid books row 7 on B: stored on B and C, ";
      if (her.conf !== null && her.conf < BACK) herLine += "confirmed at " + hms(her.conf) + ". The email goes out.";
      else herLine += "not yet confirmed: her app shows waiting.";
      line(her.t, herLine, "");
      line(his.t, "Tormod books row 7 on A at 01:18:48" + (C.confirm === "one" ? ": confirmed by A alone." : ": stored on A, waiting."), C.confirm === "one" ? "bad" : "");
      r.rec = { A: [SHARED + VALLEY, 1], B: [SHARED + HILL, raft ? 2 : 1], C: [SHARED + HILL, raft ? 2 : 1] };
      line(BACK - 1, "Records: A " + r.rec.A[0] + " entries, B " + r.rec.B[0] + ", C " + r.rec.C[0] + "." + (raft ? " A is in term 1, B and C in term 2." : ""), "");

      // The rejoin at 01:30:00.
      var kept;
      if (C.rule === "longest") {
        line(BACK, "The switch restarts. Longest record leads: A, 150 entries to B's 120. A's copy replaces entries 101 to 120 on B and C.", "bad");
        kept = function (b) { return b.side === "v"; };
        r.leaders = "A; B too from " + hms(E) + "; A alone after 01:30";
      } else if (C.rule === "newest") {
        line(BACK, "The switch restarts. Both records are merged; where two bookings hold one row, the newer timestamp stays: 3 clashes.", "warn");
        kept = function (b) {
          if (b.clash === null) return true;
          var other = B.filter(function (x) { return x.side !== b.side && x.clash === b.clash; })[0];
          return b.t > other.t;
        };
        r.leaders = "A; B too from " + hms(E) + "; A alone after 01:30";
      } else {
        line(BACK, "The link is back. B's next message carries term 2; A, still in term 1, sees a higher term and steps down. B's record is copied to A, replacing A's entries 101 to 150.", "ok");
        line(BACK, "Had A asked for votes with its 150 entries, B and C would refuse: their last entry is from term 2, A's from term 1.", "");
        kept = function (b) { return b.side === "h"; };
        r.leaders = "term 1: A; term 2: B from " + hms(E);
      }
      B.forEach(function (b) { b.kept = kept(b); });

      // Entries in the final record that were not confirmed yet are confirmed once enough servers hold them.
      var cEnd = cq.length ? cq[cq.length - 1] : 0;
      var toC = [];
      B.forEach(function (b) {
        if (!b.kept || (b.conf !== null && b.conf < BACK)) return;
        if (b.conf !== null && C.confirm === "majority" && b.onBC) return;     // finishes on C's queue
        if (C.confirm === "majority") b.conf = BACK;
        else if (C.confirm === "all") {
          if (b.onBC) b.conf = Math.max(b.cFinish, BACK);
          else toC.push(b);
        }
      });
      var cq2 = queue(toC.map(function () { return BACK; }), slow, slow ? Math.max(cEnd, BACK) : 0);
      toC.forEach(function (b, n) { b.conf = cq2[n]; });
      // A booking confirmed before 01:30 but missing from the final record was erased.
      B.forEach(function (b) {
        if (!b.kept && b.conf !== null && b.conf > BACK) b.conf = null;
      });
      var nf = SHARED + B.filter(function (b) { return b.kept; }).length;
      r.after = { A: [nf, raft ? 2 : 1], B: [nf, raft ? 2 : 1], C: [nf, raft ? 2 : 1] };
    }

    B.forEach(function (b) {
      if (b.conf !== null) r.confirmed += 1;
      if (b.conf !== null && !b.kept) r.lost += 1;
      if (b.conf === null && !b.kept && C.cut === "on") r.resend += 1;
      if (b.conf !== null && b.kept && (r.last === "none" || b.conf > r.lastT)) { r.lastT = b.conf; r.last = hms(b.conf); }
    });

    if (her.kept) r.her = her.conf !== null ? "confirmed " + hms(her.conf) + ", kept" : "waiting";
    else r.her = her.conf !== null ? "confirmed " + hms(her.conf) + ", erased" : "never confirmed, sent again";
    if (her.kept && (!his.kept || C.cut === "off")) r.row7 = "Ragnfrid";
    else if (his.kept && !her.kept) r.row7 = "Tormod";
    else r.row7 = "nobody yet";

    if (r.lost) line(BACK, r.lost + (r.lost === 1 ? " confirmed booking" : " confirmed bookings") + " erased. Nobody tells their members.", "bad");
    if (r.resend) line(BACK, r.resend + (r.resend === 1 ? " booking was" : " bookings were") + " never confirmed; their apps send them again now the link is back.", "warn");
    r.how = r.lost ? r.lost + " confirmed bookings lost" : "no confirmed booking lost";
    return r;
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
    function table(heads) {
      var wrap = el("div", "overflow-x:auto;");
      var tb = el("table", "width:100%;font-size:12px;");
      var hr = el("tr");
      heads.forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
      var th = el("thead");
      th.appendChild(hr);
      tb.appendChild(th);
      var body = el("tbody");
      tb.appendChild(body);
      wrap.appendChild(tb);
      return { wrap: wrap, body: body };
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var rt = table(["server", "record at 01:29:59", "term", "record after 01:30"]);
    box.appendChild(rt.wrap);
    var bt = table(["bookings", "sent", "confirmed", "erased at 01:30", "to send again"]);
    box.appendChild(bt.wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, recs: rt.body, books: bt.body, sum: sum };
  }

  function row(ui, body, cells) {
    var tr = ui.el("tr");
    cells.forEach(function (x) { tr.appendChild(ui.el("td", "", String(x))); });
    body.appendChild(tr);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Confirm after: " + pick(CONFIRMS, C.confirm).label + ". At rejoin: " + pick(RULES, C.rule).label +
      ". Cut: " + pick(CUTS, C.cut).label + ". Election timeout: " + pick(TIMEOUTS, C.timeout).label +
      ". Slow C: " + pick(SLOWS, C.slow).label + ".";
    clear(ui.recs);
    clear(ui.books);
    if (!S.ran) {
      ["A", "B", "C"].forEach(function (s) { row(ui, ui.recs, [s, SHARED, C.rule === "raft" ? 1 : "none", "-"]); });
      ui.sum.textContent = "Not played yet: it is 00:40:00 and every server holds the same 100 entries.";
      ["split", "leaders", "confirmed", "lost", "resend", "nobook", "last", "her", "row7", "outcome"].forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var N = night(C);
    var raft = C.rule === "raft";
    ["A", "B", "C"].forEach(function (s) {
      row(ui, ui.recs, [s, N.rec[s][0], raft ? N.rec[s][1] : "none", N.after[s][0]]);
    });
    [["valley floor, to A", "v", VALLEY], ["hill farms, to B or C", "h", HILL]].forEach(function (g) {
      var mine = N.books.filter(function (b) { return b.side === g[1]; });
      row(ui, ui.books, [g[0], g[2],
        mine.filter(function (b) { return b.conf !== null; }).length,
        mine.filter(function (b) { return b.conf !== null && !b.kept; }).length,
        C.cut === "on" ? mine.filter(function (b) { return b.conf === null && !b.kept; }).length : 0]);
    });
    ui.sum.textContent = "Booking 112, Ragnfrid's, row 7: " + N.her + ". Row 7 goes to: " + N.row7 + "." +
      (N.refused ? " Refused as row already booked: " + N.refused + "." : "");
    S.stat.split("A " + N.rec.A[0] + ", B " + N.rec.B[0] + ", C " + N.rec.C[0] + (raft ? " (terms " + N.rec.A[1] + ", " + N.rec.B[1] + ", " + N.rec.C[1] + ")" : ""));
    S.stat.leaders(N.leaders);
    S.stat.confirmed(String(N.confirmed));
    S.stat.lost(String(N.lost));
    S.stat.resend(String(N.resend));
    S.stat.nobook(String(N.nobook));
    S.stat.last(N.last);
    S.stat.her(N.her);
    S.stat.row7(N.row7);
    S.stat.outcome(N.how);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 00:40:00, before the cut.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("00:40 to 01:31 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    N.lines.forEach(function (l) { api.log(hms(l.t) + " " + l.text, l.tone); });
    api.log("01:31:00: bookings confirmed " + N.confirmed + ", confirmed bookings erased " + N.lost + ", minutes no booking could be confirmed " + N.nobook + ".", N.lost ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { confirm: "one", rule: "longest", cut: "on", timeout: "30", slow: "off" };
      S.ran = false;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("confirm", "Confirm a booking after", CONFIRMS, "confirm");
      sel("rule", "When A rejoins", RULES, "rule");
      sel("cut", "Cut A off", CUTS, "cut");
      sel("timeout", "Election timeout", TIMEOUTS, "timeout");
      sel("slow", "Slow server C", SLOWS, "slow");
      api.control.button("run", "Play 00:40 to 01:31", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        split: api.stat("split", "records at 01:29:59 (entries)", ""),
        leaders: api.stat("leaders", "leader per term", ""),
        confirmed: api.stat("confirmed", "bookings confirmed", "ok"),
        lost: api.stat("lost", "confirmed bookings erased", "bad"),
        resend: api.stat("resend", "bookings to send again", "warn"),
        nobook: api.stat("nobook", "minutes no booking could be confirmed", "warn"),
        last: api.stat("last", "last booking confirmed", ""),
        her: api.stat("her", "booking 112 (row 7)", ""),
        row7: api.stat("row7", "row 7 goes to", ""),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> The first table shows each server's record, the number of entries it holds, at 01:29:59 and after the rejoin at 01:30, with its term when the raft rule is on. The second counts the night's 70 bookings: confirmed to members, confirmed and then erased, and never confirmed, so their apps send them again.");

      api.log("Thursday 22 October 2026, 00:40:00, as built: confirm after the leader alone, the longest record leads after a split, election timeout 30 seconds.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      var BUILT = { confirm: "one", rule: "longest", cut: "on", timeout: "30", slow: "off" };

      // 1. Opening state: before the cut.
      t.expect(t.stat("lost") === "not run yet" && t.stat("confirmed") === "not run yet" &&
        has("00:40:00, as built"),
        "Opens at 00:40:00 before the cut, nothing played");

      // 2. As built: longest wins erases all 20 hill bookings, hers among them.
      t.click("run");
      t.expect(t.stat("lost") === 20 && t.stat("confirmed") === 70 && t.stat("nobook") === 0 &&
        t.stat("split") === "A 150, B 120, C 120" && t.stat("her") === "confirmed 01:12:40, erased" &&
        t.stat("row7") === "Tormod" && has("Longest record leads: A, 150 entries to B's 120."),
        "As built: A 150 against B 120, A's copy erases 20 confirmed bookings, hers included");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("has already played."), "A second play is refused");

      // 4. Option 1: a majority and raft. A confirms none of its 50; nothing confirmed is lost.
      as({ confirm: "majority", rule: "raft" });
      t.click("run");
      t.expect(t.stat("lost") === 0 && t.stat("confirmed") === 20 && t.stat("resend") === 50 && t.stat("nobook") === 0.5 &&
        t.stat("her") === "confirmed 01:12:40, kept" && t.stat("row7") === "Ragnfrid" &&
        t.stat("leaders") === "term 1: A; term 2: B from 00:50:30" && has("sees a higher term and steps down"),
        "Majority and raft: A confirms 0 of 50, B confirms 20 in term 2, 0 confirmed bookings lost");

      // 5. A majority alone, with longest wins: A's longer record still erases B's 20.
      t.set("rule", "longest");
      t.click("run");
      t.expect(t.stat("lost") === 20 && t.stat("her") === "confirmed 01:12:40, erased",
        "Majority without up-to-date votes: longest wins still erases the 20");

      // 6. The raft rejoin with confirm after one: A's 50 were confirmed alone, and are erased.
      as({ confirm: "one", rule: "raft" });
      t.click("run");
      t.expect(t.stat("lost") === 50 && t.stat("row7") === "Ragnfrid",
        "A raft rejoin with confirm after one: A's 50 confirmed-alone bookings are erased");

      // 7. Option 2: all three. Nothing confirmed during the cut, nothing lost.
      as({ confirm: "all", rule: "longest" });
      t.click("run");
      t.expect(t.stat("lost") === 0 && t.stat("nobook") === 40 && t.stat("her") === "never confirmed, sent again" &&
        t.stat("resend") === 20 && t.stat("last") === "01:30:00",
        "All three: 40 minutes with no booking confirmed, 0 lost, the hill's 20 sent again");

      // 8. All three with a slow C and no cut: the last booking waits until 03:04:00; a majority does not wait.
      as({ cut: "off", slow: "on" });
      t.click("run");
      var slowAll = t.stat("last");
      t.set("confirm", "majority");
      t.click("run");
      t.expect(slowAll === "03:04:00" && t.stat("last") === "01:29:12" && t.stat("lost") === 0,
        "Slow C, no cut: all three confirms the last booking at 03:04:00, a majority at 01:29:12");
      as({ cut: "on", slow: "off", confirm: "one" });

      // 9. Option 0: newest timestamp per clash: 3 confirmed bookings still erased, hers among them.
      t.set("rule", "newest");
      t.click("run");
      t.expect(t.stat("lost") === 3 && t.stat("her") === "confirmed 01:12:40, erased" && t.stat("row7") === "Tormod" &&
        has("3 clashes"),
        "Newest timestamp wins: 3 confirmed bookings erased, hers to Tormod's 01:18:48");

      // 10. Option 3: a 10-minute election timeout. B leads from 01:00:00; still 20 lost.
      as({ rule: "longest", timeout: "600" });
      t.click("run");
      t.expect(t.stat("lost") === 20 && t.stat("confirmed") === 70 && has("The 5 hill bookings sent since 00:50:40 waited") &&
        t.stat("leaders") === "A; B too from 01:00:00; A alone after 01:30",
        "10-minute election timeout: B leads from 01:00:00, A still confirms alone, 20 erased");
      as(BUILT);

      // 11. Never cut off: one leader, row 7 to Ragnfrid, Tormod refused, nothing lost.
      t.set("cut", "off");
      t.click("run");
      t.expect(t.stat("lost") === 0 && t.stat("confirmed") === 67 && t.stat("row7") === "Ragnfrid" &&
        t.stat("split") === "A 167, B 167, C 167" && has("row already booked"),
        "No cut: 67 confirmed, 3 refused as row already booked, row 7 stays Ragnfrid's");

      // 12. Majority and raft lose no confirmed booking under every other setting.
      var safe = true;
      CUTS.forEach(function (c) { TIMEOUTS.forEach(function (o) { SLOWS.forEach(function (s) {
        var n = night({ confirm: "majority", rule: "raft", cut: c.value, timeout: o.value, slow: s.value });
        if (n.lost !== 0) safe = false;
      }); }); });
      t.expect(safe, "Majority and raft: 0 confirmed bookings lost under every cut, timeout and slow-C setting");
    }
  });
})();
