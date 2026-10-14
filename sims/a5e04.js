/* sims/a5e04-v1.0.0.js  (published as sims/a5e04.js)
   Case a5e04 "A Judge Made of Machine": a judge lab for Quillmarch's contract summaries. Each week a
   model used as a judge compares this week's summary of a contract with last week's (pairwise
   comparison) for the same 10 contracts, C1 to C10, and the dashboard shows the new summary's win
   rate. The new summary is always shown first. Ms Odhiambo's panel of lawyers rates every summary
   from 1 to 5 against a rubric. The learner picks the week (1 or 6), the position (as built, swapped,
   both orders), a length cap on what the judge reads, the judge prompt line, and the judge model.
   No real model: the judge is a stated rule over stated lengths and ratings, so every verdict can be
   checked by hand. Widget-style sim: it draws its own tables in api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: two labelled weeks of 10 contract pairs each, the judge's
     three-step rule, position as built, swapped and both orders, a 300-word cap, the prompt line,
     a larger judge, the six weeks' dashboard, and a reply preset for each of the four options.
     selfTest: 11 assertions.

   The judge's rule (stated in sim.lede), applied to the two summaries in the order shown:
   - Step 1, length: if one summary is at least G words longer than the other, and the lawyers rate
     it no more than 1 point lower, the longer one wins. G is 50 for the current judge, 80 with the
     prompt line on, 120 for the larger judge (120 with both).
   - Step 2, quality: otherwise, if the lawyers rate one summary higher, that one wins.
   - Step 3, position: otherwise (same rating, lengths within G words), the first-shown one wins.
   - Lengths are as the judge reads them: with the cap on, any summary over 300 words is cut to its
     first 300 words. The lawyers' ratings are of the full summaries and don't change.
   - The lawyers' preference for a pair: the summary they rate higher, or none when they rate both
     the same. Agreement: pairs where the judge's verdict equals the lawyers' preference; a tie
     (both orders disagree) matches "none".
   - Win rate as built or swapped: pairs the new summary wins / 10. Both orders: a verdict counts
     only if it is the same in both orders; a pair that flips is a tie and counts as half a win.

   Where every number comes from (conventions rule 14; the case is content/latent/a5/a5e04-v1.0.0.json).
   - Week 6 pairs [new words, old words, new rating, old rating]: C1 380/360 4/4, C2 390/370 3/3,
     C3 400/380 3/3, C4 370/390 4/4, C5 410/400 3/3 (same rating, within 50 words: position),
     C6 400/330 3/4 (+70), C7 410/320 3/4 (+90), C8 450/320 3/3 (+130), C9 410/240 4/4 (+170)
     (length), C10 380/390 3/4 (quality). Averages: new 4000/10 = 400 words, rating 33/10 = 3.3;
     old (week 5) 3500/10 = 350 words, rating 36/10 = 3.6.
   - Week 6 as built: new wins C1 to C9 = 9 of 10, 90%. Swapped: C1 to C5 go to the old one; new
     wins C6 to C9 = 4 of 10, 40%. Flips: 5 of 10. Both orders: 4 new, 1 old (C10), 5 ties:
     (4 + 2.5) / 10 = 65%. Agreement: as built 1 of 10 (C10), swapped 1 of 10, both orders 6 of 10.
   - Week 6, both orders, cap 300: C6 and C7 read 300/300 and go to quality: old. C8 300/300, same
     rating: flips, tie. C9 300/240 (+60) still length: new. Consistent new 1, old 3, ties 6:
     (1 + 3) / 10 = 40%. Agreement 9 of 10 (C9 misses). As built with the cap: 7 of 10, 70%.
   - Prompt line (G 80): C6 (+70) goes to quality: old. As built 8 of 10, 80%; flips 5; agreement
     2 of 10. Larger judge (G 120): C6 and C7 go to old. As built 7 of 10, 70%; flips 5; agreement
     3 of 10.
   - Week 1 pairs (all within 50 words): C1 140/130 4/4, C2 150/160 4/4, C3 160/140 5/4,
     C4 150/130 5/4, C5 140/150 4/5, C6 150/140 4/5, C7 160/150 4/5, C8 140/130 4/5, C9 150/140 4/5,
     C10 160/130 3/4. Averages: new 1500/10 = 150 words, rating 41/10 = 4.1; old (the launch
     summaries) 140 words, rating 45/10 = 4.5. As built: C1, C2 by position, C3, C4 by quality:
     4 of 10, 40%. Agreement as built 8 of 10; both orders 10 of 10, win rate (2 + 1) / 10 = 30%.
   - The dashboard, weeks 1 to 6 (weeks 2 to 5 are stated data): words 150, 200, 250, 300, 350, 400;
     win rate 40, 50, 60, 70, 80, 90%; lawyers' rating 4.1, 3.9, 3.8, 3.7, 3.6, 3.3.
   - Reply D: 6 prompt changes a week (stated) x 10 summaries x 5 minutes a rating (stated) = 300
     minutes of lawyers' time a week, against 10 x 5 = 50 minutes now.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var CS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"];

  // [new words, old words, new rating, old rating]
  var PAIRS = {
    1: {
      C1: [140, 130, 4, 4], C2: [150, 160, 4, 4], C3: [160, 140, 5, 4], C4: [150, 130, 5, 4], C5: [140, 150, 4, 5],
      C6: [150, 140, 4, 5], C7: [160, 150, 4, 5], C8: [140, 130, 4, 5], C9: [150, 140, 4, 5], C10: [160, 130, 3, 4]
    },
    6: {
      C1: [380, 360, 4, 4], C2: [390, 370, 3, 3], C3: [400, 380, 3, 3], C4: [370, 390, 4, 4], C5: [410, 400, 3, 3],
      C6: [400, 330, 3, 4], C7: [410, 320, 3, 4], C8: [450, 320, 3, 3], C9: [410, 240, 4, 4], C10: [380, 390, 3, 4]
    }
  };

  // The dashboard: weeks 1 to 6. Weeks 1 and 6 are computed from the pairs; 2 to 5 are stated.
  var HISTORY = [
    { week: 1, words: 150, win: 40, rating: 4.1 },
    { week: 2, words: 200, win: 50, rating: 3.9 },
    { week: 3, words: 250, win: 60, rating: 3.8 },
    { week: 4, words: 300, win: 70, rating: 3.7 },
    { week: 5, words: 350, win: 80, rating: 3.6 },
    { week: 6, words: 400, win: 90, rating: 3.3 }
  ];

  var CAP = 300;
  var CHANGES_A_WEEK = 6;
  var MINUTES_A_RATING = 5;

  var WEEKS = [{ value: "6", label: "Week 6 against week 5" }, { value: "1", label: "Week 1 against the launch summaries" }];
  var POS = [
    { value: "built", label: "As built: new summary first" },
    { value: "swapped", label: "Swapped: last week's first" },
    { value: "both", label: "Both orders: count only verdicts that hold" }
  ];
  var PNAME = { built: "as built", swapped: "swapped", both: "both orders" };
  var CAPS = [{ value: "0", label: "No cap" }, { value: "300", label: "Cap: the judge reads the first 300 words" }];
  var JUDGES = [{ value: "small", label: "The current judge" }, { value: "large", label: "A larger model" }];
  var JNAME = { small: "current judge", large: "larger judge" };
  var REPLIES = [
    { value: "none", label: "None yet" },
    { value: "0", label: "A: a larger, stronger judge" },
    { value: "1", label: "B: tell it to ignore length and order" },
    { value: "2", label: "C: both orders, checked against the lawyers" },
    { value: "3", label: "D: the lawyers rate every change" }
  ];

  /* ---------- the arithmetic (pure functions the display and self-tests read) ---------- */

  function gapOf(C) { return C.jm === "large" ? 120 : (C.line ? 80 : 50); }
  function seen(n, C) { return C.cap ? Math.min(n, C.cap) : n; }

  // One verdict, with the two summaries in the order shown. Returns { who, step }.
  function judge(first, second, G) {
    var longer = first.len >= second.len ? first : second;
    var shorter = longer === first ? second : first;
    if (longer.len - shorter.len >= G && longer.r >= shorter.r - 1) return { who: longer.who, step: "length" };
    if (first.r !== second.r) return { who: first.r > second.r ? first.who : second.who, step: "quality" };
    return { who: first.who, step: "position" };
  }

  function pairOf(C, c) {
    var p = PAIRS[C.week][c];
    var G = gapOf(C);
    var N = { len: seen(p[0], C), r: p[2], who: "new" };
    var O = { len: seen(p[1], C), r: p[3], who: "old" };
    var ab = judge(N, O, G);
    var sw = judge(O, N, G);
    var law = p[2] > p[3] ? "new" : (p[2] < p[3] ? "old" : "none");
    var both = ab.who === sw.who ? ab.who : "tie";
    var counted = C.pos === "built" ? ab.who : (C.pos === "swapped" ? sw.who : both);
    var agrees = counted === law || (counted === "tie" && law === "none");
    return { c: c, p: p, N: N, O: O, ab: ab, sw: sw, law: law, both: both, counted: counted, agrees: agrees, G: G };
  }

  function card(C) {
    var o = { wins: 0, flips: 0, consistent: 0, agree: 0, newWords: 0, oldWords: 0, newR: 0, oldR: 0 };
    CS.forEach(function (c) {
      var x = pairOf(C, c);
      if (x.counted === "new") o.wins += 1;
      if (x.counted === "tie") o.wins += 0.5;
      if (x.ab.who !== x.sw.who) o.flips += 1; else o.consistent += 1;
      if (x.agrees) o.agree += 1;
      o.newWords += x.p[0]; o.oldWords += x.p[1]; o.newR += x.p[2]; o.oldR += x.p[3];
    });
    o.win = Math.round(o.wins * 10);
    o.newWords /= 10; o.oldWords /= 10;
    o.newR = Math.round(o.newR) / 10; o.oldR = Math.round(o.oldR) / 10;
    return o;
  }

  function who(w) { return w === "new" ? "this week's" : (w === "old" ? "last week's" : w); }

  // The worked line for one contract: the rule applied by hand.
  function worked(C) {
    var x = pairOf(C, C.c);
    var head = x.c + ", week " + C.week + ": this week's summary " + x.N.len + " words, rated " + x.p[2] +
      "; last week's " + x.O.len + " words, rated " + x.p[3] + ". ";
    var d = Math.abs(x.N.len - x.O.len);
    var lenTxt = d >= x.G ? (d + " words apart, at least " + x.G) : (d + " words apart, under " + x.G);
    return head + lenTxt + ". New first: " + who(x.ab.who) + " wins (" + x.ab.step + "). Last week's first: " +
      who(x.sw.who) + " wins (" + x.sw.step + "). " + (x.ab.who === x.sw.who ? "The verdict holds." : "The verdict flips: a tie.") +
      " The lawyers prefer " + (x.law === "none" ? "neither" : who(x.law)) + ".";
  }

  function summaryLine(C) {
    var o = card(C);
    return "Week " + C.week + ", " + PNAME[C.pos] + ", " + (C.cap ? "300-word cap" : "no cap") + ", prompt line " +
      (C.line ? "on" : "off") + ", " + JNAME[C.jm] + ": win rate " + o.win + "%, " + o.flips + " of 10 verdicts flip when swapped, agreement with the lawyers " +
      o.agree + " of 10.";
  }

  function lengthWins(C) {
    return CS.filter(function (c) { var x = pairOf(C, c); return x.ab.step === "length" && x.ab.who === "new"; });
  }
  function gapsOf(C, list) {
    return list.map(function (c) { var p = PAIRS[C.week][c]; return seen(p[0], C) - seen(p[1], C); });
  }
  function joinAnd(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;overflow-x:auto;");
    var head = el("p", "margin:0;font-weight:600;");
    var pairT = el("table", "width:100%;border-collapse:collapse;");
    var work = el("p", "margin:0;");
    var histT = el("table", "width:100%;border-collapse:collapse;");
    box.appendChild(head);
    box.appendChild(pairT);
    box.appendChild(work);
    box.appendChild(el("p", "margin:0;font-weight:600;", "The dashboard, six weeks (as built, current judge)"));
    box.appendChild(histT);
    api.root.appendChild(box);
    return { el: el, head: head, pairT: pairT, work: work, histT: histT };
  }

  function row(ui, cells, style, tag) {
    var tr = ui.el("tr", style || "");
    cells.forEach(function (c) { tr.appendChild(ui.el(tag || "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    return tr;
  }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var o = card(C);
    ui.head.textContent = "Week " + C.week + ": the 10 contracts. Words are as the judge reads them; ratings are the lawyers', 1 to 5. Counted: " + PNAME[C.pos] + ".";

    empty(ui.pairT);
    ui.pairT.appendChild(row(ui, ["contract", "words new / old", "lawyers new / old", "lawyers prefer", "new first", "old first", "counted", "agrees"], "", "th"));
    CS.forEach(function (c) {
      var x = pairOf(C, c);
      var st = x.ab.who !== x.sw.who ? "color:var(--amber);" : "";
      if (c === C.c) st += "font-weight:600;";
      ui.pairT.appendChild(row(ui, [c, x.N.len + " / " + x.O.len, x.p[2] + " / " + x.p[3], x.law === "none" ? "neither" : x.law,
        x.ab.who + " (" + x.ab.step + ")", x.sw.who + " (" + x.sw.step + ")", x.counted, x.agrees ? "yes" : "NO"], st));
    });
    ui.pairT.appendChild(row(ui, ["all 10", o.newWords + " / " + o.oldWords + " (full)", o.newR + " / " + o.oldR, "", "", "", "win rate " + o.win + "%", o.agree + " of 10"], "font-weight:600;"));

    ui.work.textContent = worked(C);

    empty(ui.histT);
    ui.histT.appendChild(row(ui, ["week", "average words", "win rate", "lawyers' rating"], "", "th"));
    HISTORY.forEach(function (h) {
      ui.histT.appendChild(row(ui, [h.week, h.words, h.win + "%", h.rating.toFixed(1)], h.week === C.week ? "font-weight:600;" : ""));
    });

    S.stat.win(o.win + "%");
    S.stat.flips(o.flips + " of 10");
    S.stat.cons(o.consistent + " of 10");
    S.stat.agree(o.agree + " of 10");
    S.stat.rating(o.newR.toFixed(1));
    S.stat.prev(o.oldR.toFixed(1));
    S.stat.words(String(o.newWords));
  }

  function setAll(S) {
    var C = S.C;
    S.ctl.week.set(String(C.week)); S.ctl.pos.set(C.pos); S.ctl.cap.set(String(C.cap)); S.ctl.line.set(C.line);
    S.ctl.jm.set(C.jm); S.ctl.c.set(C.c);
  }

  function preset(C, over) {
    C.week = 6; C.pos = "built"; C.cap = 0; C.line = false; C.jm = "small"; C.c = "C1";
    for (var k in over) { if (Object.prototype.hasOwnProperty.call(over, k)) C[k] = over[k]; }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a5e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { week: 6, pos: "built", cap: 0, line: false, jm: "small", c: "C1" };
      S.ui = buildWidget(api);
      S.ctl = {};

      function change(msg, tone) {
        draw(api);
        api.log(msg + " " + summaryLine(S.C), tone || "");
      }

      S.ctl.week = api.control.select("week", "Week", WEEKS, "6", function (v) {
        var w = Number(v);
        if (!PAIRS[w] || w === S.C.week) return;
        S.C.week = w;
        change("Now week " + w + ".");
      });
      S.ctl.pos = api.control.select("pos", "Position", POS, "built", function (v) {
        if (!PNAME[v] || v === S.C.pos) return;
        S.C.pos = String(v);
        change("Position: " + PNAME[S.C.pos] + ".");
      });
      S.ctl.cap = api.control.select("cap", "Length cap", CAPS, "0", function (v) {
        var x = Number(v) === CAP ? CAP : 0;
        if (x === S.C.cap) return;
        S.C.cap = x;
        change(x ? "The judge now reads the first 300 words of each summary." : "No cap.");
      });
      S.ctl.line = api.control.toggle("line", "Judge prompt line: ignore the length and the order", false, function (on) {
        S.C.line = !!on;
        change("Prompt line " + (on ? "on." : "off."));
      });
      S.ctl.jm = api.control.select("jm", "Judge model", JUDGES, "small", function (v) {
        if (!JNAME[v] || v === S.C.jm) return;
        S.C.jm = String(v);
        change("Judge: the " + JNAME[S.C.jm] + ".");
      });
      S.ctl.c = api.control.select("c", "Contract to work by hand", CS.map(function (x) { return { value: x, label: x }; }), "C1", function (v) {
        if (CS.indexOf(v) < 0) return;
        S.C.c = String(v);
        draw(api);
      });
      S.ctl.reply = api.control.select("reply", "Try a reply", REPLIES, "none", function (v) {
        var C = S.C;
        var o, b, k, lw;
        if (v === "0") {
          preset(C, { jm: "large" });
          draw(api);
          o = card(C);
          lw = lengthWins(C);
          api.log("Reply A: the larger judge, week 6 as built. Win rate " + o.win + "%. Swapped, " + o.flips + " of 10 verdicts still flip. Agreement with the lawyers " +
            o.agree + " of 10. " + joinAnd(lw) + " still go to the summary " + joinAnd(gapsOf(C, lw).map(String)) + " words longer.", "bad");
        } else if (v === "1") {
          preset(C, { line: true });
          draw(api);
          o = card(C);
          lw = lengthWins(C);
          api.log("Reply B: the prompt line on, week 6 as built. Win rate " + o.win + "%. Swapped, " + o.flips + " of 10 verdicts still flip. Agreement with the lawyers " +
            o.agree + " of 10. " + joinAnd(lw) + " still go to the summary " + joinAnd(gapsOf(C, lw).map(String)) + " words longer.", "bad");
        } else if (v === "2") {
          preset(C, { pos: "both" });
          o = card(C);
          k = { week: 1, pos: "both", cap: 0, line: false, jm: "small", c: "C1" };
          var w1 = card(k);
          preset(C, { pos: "both", cap: CAP });
          draw(api);
          b = card(C);
          api.log("Reply C: both orders, week 6. " + o.flips + " of 10 verdicts flip and count as ties; win rate " + o.win + "%; agreement with the lawyers " + o.agree +
            " of 10, every miss a much longer summary. With the 300-word cap: agreement " + b.agree + " of 10, win rate " + b.win + "%. Week 1, both orders: agreement " +
            w1.agree + " of 10.", "ok");
        } else if (v === "3") {
          preset(C, {});
          draw(api);
          o = card(C);
          api.log("Reply D: the lawyers rate every summary of every change. " + CHANGES_A_WEEK + " prompt changes a week x 10 summaries x " + MINUTES_A_RATING +
            " minutes = " + (CHANGES_A_WEEK * 10 * MINUTES_A_RATING) + " minutes of lawyers' time a week, against " + (10 * MINUTES_A_RATING) + " now. Week 6 by hand: " +
            o.newR.toFixed(1) + " against last week's " + o.oldR.toFixed(1) + ", worse.", "warn");
        } else {
          return;
        }
        setAll(S);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        win: api.stat("win", "win rate on the dashboard", ""),
        flips: api.stat("flips", "verdicts that flip when swapped", "bad"),
        cons: api.stat("cons", "verdicts that hold in both orders", ""),
        agree: api.stat("agree", "agreement with the lawyers", "warn"),
        rating: api.stat("rating", "lawyers' rating, this week", ""),
        prev: api.stat("prev", "lawyers' rating, last week", ""),
        words: api.stat("words", "average words, this week", "")
      };

      api.info("<strong>How to read it.</strong> Ten contracts, each with this week's summary and last week's. The judge applies three steps in order: length (at least 50 words longer, rated no more than a point lower), then the lawyers' quality, then whichever it was shown first. Amber rows flip when the order is swapped. The line under the table works one contract by hand.");

      draw(api);
      var o0 = card(S.C);
      api.log("Week 6 as built, this week's summary first: the judge picks it in " + o0.win / 10 + " of 10, a win rate of " + o0.win + "%. The lawyers rate this week's summaries " +
        o0.newR.toFixed(1) + " on average, last week's " + o0.oldR.toFixed(1) + ".", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var S = t.api.state;

      // 1. Opening state: week 6 as built, the current judge, no cap, prompt line off.
      t.expect(t.stat("win") === "90%" && t.stat("flips") === "5 of 10" && t.stat("agree") === "1 of 10" && t.stat("rating") === 3.3 &&
        t.stat("prev") === 3.6 && t.stat("words") === 400 &&
        has("Week 6 as built, this week's summary first: the judge picks it in 9 of 10, a win rate of 90%. The lawyers rate this week's summaries 3.3 on average, last week's 3.6."),
        "Opens on week 6 as built: win rate 90%, 5 of 10 flip, agreement 1 of 10, ratings 3.3 against 3.6");

      // 2. Two contracts by hand: C1 flips on position, C6 holds on length.
      var w1 = worked(S.C);
      var w6 = worked({ week: 6, pos: "built", cap: 0, line: false, jm: "small", c: "C6" });
      t.expect(w1 === "C1, week 6: this week's summary 380 words, rated 4; last week's 360 words, rated 4. 20 words apart, under 50. New first: this week's wins (position). Last week's first: last week's wins (position). The verdict flips: a tie. The lawyers prefer neither." &&
        w6.indexOf("70 words apart, at least 50. New first: this week's wins (length). Last week's first: this week's wins (length). The verdict holds. The lawyers prefer last week's.") >= 0,
        "By hand: C1 flips on position; C6 holds on length against the lawyers");

      // 3. Swapped: the win rate falls to 40%.
      t.set("pos", "swapped");
      t.expect(t.stat("win") === "40%" && t.stat("agree") === "1 of 10", "Swapped: win rate 40%, agreement 1 of 10");

      // 4. Both orders: 5 ties, 65%, agreement 6 of 10.
      t.set("pos", "both");
      t.expect(t.stat("win") === "65%" && t.stat("cons") === "5 of 10" && t.stat("agree") === "6 of 10", "Both orders: 5 hold, win rate 65%, agreement 6 of 10");

      // 5. Both orders with the 300-word cap: agreement 9 of 10, win rate 40%.
      t.set("cap", "300");
      t.expect(t.stat("agree") === "9 of 10" && t.stat("win") === "40%" && t.stat("flips") === "6 of 10", "Both orders and the cap: agreement 9 of 10, win rate 40%");

      // 6. Week 1: as built 40% and 8 of 10; both orders 10 of 10.
      t.set("cap", "0");
      t.set("week", "1");
      var both1 = t.stat("agree");
      t.set("pos", "built");
      t.expect(both1 === "10 of 10" && t.stat("win") === "40%" && t.stat("agree") === "8 of 10" && t.stat("rating") === 4.1 && t.stat("prev") === 4.5 && t.stat("words") === 150,
        "Week 1: win rate 40%, agreement 8 of 10 as built and 10 of 10 in both orders, rating 4.1, 150 words");
      t.set("week", "6");

      // 7. The dashboard: the win rate rises and the rating falls every week; weeks 1 and 6 match the pairs.
      var up = true;
      for (var i = 1; i < HISTORY.length; i++) { if (!(HISTORY[i].win > HISTORY[i - 1].win && HISTORY[i].rating < HISTORY[i - 1].rating && HISTORY[i].words > HISTORY[i - 1].words)) up = false; }
      var c6 = card({ week: 6, pos: "built", cap: 0, line: false, jm: "small", c: "C1" });
      var c1 = card({ week: 1, pos: "built", cap: 0, line: false, jm: "small", c: "C1" });
      t.expect(up && c6.win === HISTORY[5].win && c6.newR === HISTORY[5].rating && c6.oldR === HISTORY[4].rating && c6.oldWords === HISTORY[4].words &&
        c1.win === HISTORY[0].win && c1.newR === HISTORY[0].rating && c1.newWords === HISTORY[0].words,
        "Six weeks: win rate up and ratings down every week; weeks 1, 5 and 6 match the labelled pairs");

      // 8. Reply A: the larger judge.
      t.set("reply", "0");
      t.expect(has("Reply A: the larger judge, week 6 as built. Win rate 70%. Swapped, 5 of 10 verdicts still flip. Agreement with the lawyers 3 of 10. C8 and C9 still go to the summary 130 and 170 words longer.") &&
        t.stat("win") === "70%", "Reply A: 70%, still 5 flips, agreement 3 of 10");

      // 9. Reply B: the prompt line.
      t.set("reply", "1");
      t.expect(has("Reply B: the prompt line on, week 6 as built. Win rate 80%. Swapped, 5 of 10 verdicts still flip. Agreement with the lawyers 2 of 10. C7, C8 and C9 still go to the summary 90, 130 and 170 words longer."),
        "Reply B: 80%, still 5 flips, agreement 2 of 10");

      // 10. Reply C: both orders, checked against the lawyers, then the cap.
      t.set("reply", "2");
      t.expect(has("Reply C: both orders, week 6. 5 of 10 verdicts flip and count as ties; win rate 65%; agreement with the lawyers 6 of 10, every miss a much longer summary. With the 300-word cap: agreement 9 of 10, win rate 40%. Week 1, both orders: agreement 10 of 10.") &&
        t.stat("agree") === "9 of 10", "Reply C: 6 of 10, then 9 of 10 with the cap");

      // 11. Reply D: the lawyers by hand.
      t.set("reply", "3");
      t.expect(has("Reply D: the lawyers rate every summary of every change. 6 prompt changes a week x 10 summaries x 5 minutes = 300 minutes of lawyers' time a week, against 50 now. Week 6 by hand: 3.3 against last week's 3.6, worse."),
        "Reply D: 300 minutes a week against 50");
    }
  });
})();
