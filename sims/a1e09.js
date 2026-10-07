/* sims/a1e09-v1.0.0.js  (published as sims/a1e09.js)
   Case a1e09 "It Remembers Nothing": a breakfast-notes lab built from Severin's breakfast reader at the
   Lindenmere, a lake hotel where Mr Ostrander in Room 12 keeps nothing overnight.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as
     four inline SVG pictures that use theme classes only. A stateless model gets, each breakfast, a
     request the app builds: its instructions and his question, then the notebook pages a strategy
     picks, with room kept in the context window for the answer. Strategies: send everything (refused
     when it doesn't fit), keep the newest (drop the oldest first), keep the first and last (page 1,
     then the newest that fit), summarize (one 300-token summary stands in for every page older than
     the newest three). Switches: a 150-token standing card sent first, whether the summary kept the
     jetty line, and a recall-by-position teaching curve. Controls: strategy, window, breakfast, the
     three switches, reset. Stats: tokens sent this breakfast, whether the jetty fact arrives, input
     tokens over breakfasts 1 to this one, their cost at the teaching price, and the teaching curve's
     value for the jetty fact. selfTest covers this morning's start, the window never exceeded by any
     trimming strategy, send everything refusing rather than cutting, the exact running total of send
     everything, newest-first dropping the oldest first, first-and-last, the summary keeping the jetty
     if and only if it says so, the curve's lowest point in the middle, the exact cost, the card,
     every story number, the toy reader's answers, determinism and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e09-v1.0.0.json).
   All of them follow from PAGES, INSTR, RESERVE, the window, KEEP_NEWEST, SUMMARY_TOKENS, CARD_TOKENS,
   PRICE_PER_M and the strategy rules below:
   - PAGES, the notebook's token counts (teaching values): page 1, Saskia's page, 1,000; pages 2 to 15,
     Severin's nightly pages, 600 600 650 550 600 650 700 700 700 650 700 750 750 700. Page 8 is the
     night of the storm (his seventh night): the jetty is down. Breakfast k sees pages 1 to k.
     Running totals: 1,000 1,600 2,200 2,850 3,400 4,000 4,650 5,350 6,050 6,750 7,400 8,100 8,850
     9,600 10,300 (15 pages, 10,300 tokens).
   - post: window 8,192 (STORY_WINDOW); instructions and his first question 768 (INSTR); 1,024 kept for
     the answer (RESERVE); so 6,400 for pages. Breakfast 10: the notebook reached 6,750 > 6,400 and the
     request was refused (send everything). After that: page 1, then the newest pages that fit (first
     and last). Breakfast 15 (this morning): page 1 and pages 9 to 15, notebook part 1,000 + 4,950 =
     5,950, sent 768 + 5,950 = 6,718; pages 2 to 8 skipped, 4,350 tokens (10,300 - 5,950); adding page 8
     would make 6,650 > 6,400. The log line, the evidence diagram (1,000; 4,350; 4,950; 768; 6,718;
     8,192) and the caption use these.
   - comments: breakfast 13 sent page 1 and pages 7 to 13; breakfast 14 page 1 and pages 8 to 14;
     breakfast 15 page 1 and pages 9 to 15 (first and last at 8,192). The summary of pages 1 to 12 is
     300 tokens and does not mention the jetty (the summary switch starts off).
   - reply part 2: option A, window 16,384: all 15 pages, 768 + 10,300 = 11,068; his first breakfast
     768 + 1,000 = 1,768; page 8 is the middle of 15 pages. Option B, keep the newest at 8,192: pages
     7 to 15, 6,300 of notebook (7,068 sent), page 1 missing, page 8 the second-oldest page sent.
     Option C, summarize: 300-token summary of pages 1 to 12, pages 13 to 15 (2,200), sent 768 + 2,500
     = 3,268, about half of 6,718. Option D, card plus summarize: 768 + 150 + 300 + 2,200 = 3,418.
   - sim.tryThis and explain: the numbers above; send everything at 16,384 over breakfasts 1 to 15 adds
     up to 15 x 768 + 82,100 = 93,620 input tokens; at the teaching price of $2 per million input tokens
     that is 187,240 micro-dollars, 0.1872 dollars (about 19 cents); the curve gives the middle page of
     15 the lowest value, 0.50 (R_MID).
   - recall r5: 93,620 and 11,068. Start clock: nine in the morning, after the 06:31 request and the
     06:52 walk (the evidence was drawn at nine).

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed
     because nothing animates; every number is worked out the moment a control changes.
   - A request fits when INSTR + everything chosen + RESERVE <= window. Send everything is not a
     trimming strategy: when the pages don't fit, the request is refused (0 tokens sent, nothing
     billed, no answer), never silently cut. The three trimming strategies only add what fits.
   - Keep the newest and the newest part of first-and-last stop at the first page that doesn't fit, so
     the pages sent are always a run that ends at the newest page.
   - The toy reader is a teaching simplification: it answers from whether the jetty fact arrived and
     whether it knows who he is (page 1, the summary or the card). The curve does not change it.
   - The curve is a teaching simplification inspired by the U shape in Liu et al.: R_START at the first
     item, R_MID in the middle, R_END at the last, quadratic in between. The heights are made up, not
     the paper's numbers. R_END < R_START, so with an even count the lower of the two middle items is
     the later one, index floor(n / 2).
   - Money is held in whole micro-dollars (tokens x dollars per million), so the cost math is exact.
   - No random numbers anywhere: the sim is fully deterministic.
   - Stats get bare numbers or words (units live in the labels).
   - Colors come only from theme classes: dg, dot with dot-ok (sent, the jetty fact), dot-fail
     (skipped, refused), dot-wait (pages, not written yet), dot-req (instructions, the answer's room)
     and dot-accent (the summary, tokens per breakfast), dg-edge with tone-accent (the window, page 8),
     dg-label, dg-axis, muted, small. Shading is fill-opacity, a number, not a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  // The notebook: token counts of pages 1 to 15 (teaching values). Page 1 is Saskia's; page 8 is the storm.
  var PAGES = [1000, 600, 600, 650, 550, 600, 650, 700, 700, 700, 650, 700, 750, 750, 700];
  var N_PAGES = PAGES.length;
  var KEY_PAGE = 8;

  var INSTR = 768;                        // instructions and his first question
  var RESERVE = 1024;                     // kept free for the answer
  var STORY_WINDOW = 8192;
  var BIG_WINDOW = 16384;
  var WIN_MIN = 4096;
  var WIN_MAX = 16384;
  var WIN_STEP = 512;

  var KEEP_NEWEST = 3;                    // summarize keeps this many newest pages word for word
  var SUMMARY_TOKENS = 300;
  var CARD_TOKENS = 150;
  var PRICE_PER_M = 2;                    // teaching price: dollars per million input tokens

  var STORY_BREAKFAST = 15;
  var STORY_STRATEGY = "firstlast";

  // The teaching curve (made-up heights, inspired by the paper's U shape).
  var R_START = 0.9;
  var R_MID = 0.5;
  var R_END = 0.8;

  var START_CLOCK = 9 * 3600;             // nine in the morning
  var NARRATE_DELAY = 0.4;                // real seconds of stillness on a slider before the log speaks

  var STRATEGIES = ["all", "newest", "firstlast", "summary"];
  var STRAT_NAMES = {
    all: "send everything",
    newest: "keep the newest",
    firstlast: "keep the first and last",
    summary: "summarize older pages"
  };

  var LINE_BOAT = "Your boat will be at the jetty at seven, as always.";
  var LINE_AWAY = "The boats are put away since the storm, so no row today. Shall we take the garden path?";
  var LINE_STRANGER = "Is this your first stay with us?";

  /* ---------- building each breakfast's request ---------- */

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function prefix(k) {
    var t = 0, j;
    for (j = 1; j <= k; j++) t += PAGES[j - 1];
    return t;
  }

  function budgetOf(w) { return w - INSTR - RESERVE; }

  function pageItem(j) { return { kind: "page", page: j, tokens: PAGES[j - 1], key: j === KEY_PAGE }; }

  // s = { breakfast, window, strategy, card, sumKey }
  function plan(s) {
    var k = s.breakfast, B = budgetOf(s.window), used = 0, items = [], summarized = [], j;
    var written = k >= KEY_PAGE, refused = false;
    if (s.card) {
      items.push({ kind: "card", page: null, tokens: CARD_TOKENS, key: written });
      used += CARD_TOKENS;
    }
    if (s.strategy === "all") {
      if (used + prefix(k) > B) refused = true;
      else for (j = 1; j <= k; j++) items.push(pageItem(j));
    } else if (s.strategy === "newest") {
      var tail = [];
      for (j = k; j >= 1; j--) {
        if (used + PAGES[j - 1] <= B) { used += PAGES[j - 1]; tail.unshift(pageItem(j)); } else break;
      }
      items = items.concat(tail);
    } else if (s.strategy === "firstlast") {
      var head = [], last = [];
      if (used + PAGES[0] <= B) { used += PAGES[0]; head.push(pageItem(1)); }
      for (j = k; j >= 2; j--) {
        if (used + PAGES[j - 1] <= B) { used += PAGES[j - 1]; last.unshift(pageItem(j)); } else break;
      }
      items = items.concat(head, last);
    } else {
      var avail = B - used;
      if (k <= KEEP_NEWEST && prefix(k) <= avail) {
        for (j = 1; j <= k; j++) items.push(pageItem(j));
      } else if (avail >= SUMMARY_TOKENS) {
        var room = avail - SUMMARY_TOKENS, kept = [], lo = Math.max(1, k - KEEP_NEWEST + 1);
        for (j = k; j >= lo; j--) {
          if (PAGES[j - 1] <= room) { room -= PAGES[j - 1]; kept.unshift(pageItem(j)); } else break;
        }
        var firstKept = kept.length ? kept[0].page : k + 1;
        for (j = 1; j < firstKept; j++) summarized.push(j);
        items.push({ kind: "summary", page: null, tokens: SUMMARY_TOKENS,
          key: !!s.sumKey && written && KEY_PAGE < firstKept });
        items = items.concat(kept);
      }
    }
    if (refused) items = [];
    var notes = 0, sentPages = [], skipped = [], hasSummary = false, hasCard = false, keyArrives = false;
    items.forEach(function (it) {
      notes += it.tokens;
      if (it.kind === "page") sentPages.push(it.page);
      if (it.kind === "summary") hasSummary = true;
      if (it.kind === "card") hasCard = true;
      if (it.key) keyArrives = true;
    });
    for (j = 1; j <= k; j++) {
      if (sentPages.indexOf(j) < 0 && summarized.indexOf(j) < 0) skipped.push(j);
    }
    var hasPage1 = sentPages.indexOf(1) >= 0;
    return {
      breakfast: k, window: s.window, budget: B, strategy: s.strategy, refused: refused, written: written,
      items: items, sentPages: sentPages, summarized: summarized, skipped: skipped, notes: notes,
      sent: refused ? 0 : INSTR + notes,
      attempted: INSTR + (s.card ? CARD_TOKENS : 0) + prefix(k),
      keyArrives: !refused && keyArrives,
      knowsName: !refused && (hasPage1 || hasSummary || hasCard),
      knowsRoutine: !refused && (hasPage1 || hasSummary)
    };
  }

  function withBreakfast(s, b) {
    return { breakfast: b, window: s.window, strategy: s.strategy, card: s.card, sumKey: s.sumKey };
  }

  // Tokens sent at breakfasts 1 to 15 with these settings.
  function perBreakfast(s) {
    var out = [], b;
    for (b = 1; b <= N_PAGES; b++) out.push(plan(withBreakfast(s, b)).sent);
    return out;
  }

  function runningTotal(s, k) {
    var list = perBreakfast(s), t = 0, b;
    for (b = 0; b < k; b++) t += list[b];
    return t;
  }

  function costMicro(tokens) { return tokens * PRICE_PER_M; }

  /* ---------- the toy reader and the teaching curve ---------- */

  function answer(r) {
    if (r.refused) return { text: "(nothing: the service refused the request as too long)", tone: "warn" };
    var name = r.knowsName ? "Mr Ostrander" : "sir";
    if (r.keyArrives) return { text: "Good morning, " + name + ". " + LINE_AWAY, tone: r.knowsName ? "ok" : "warn" };
    if (r.knowsRoutine) return { text: "Good morning, " + name + ". " + LINE_BOAT, tone: r.written ? "bad" : "ok" };
    return { text: "Good morning, " + name + ". " + LINE_STRANGER, tone: "warn" };
  }

  // Teaching curve over n items in the order sent: high at the start, lowest in the middle, high at the end.
  function curve(n) {
    var out = [], i, x;
    if (n <= 0) return out;
    if (n === 1) return [R_START];
    for (i = 0; i < n; i++) {
      x = i / (n - 1);
      out.push(x <= 0.5 ? R_MID + (R_START - R_MID) * (1 - 2 * x) * (1 - 2 * x)
        : R_MID + (R_END - R_MID) * (2 * x - 1) * (2 * x - 1));
    }
    return out;
  }

  function argmin(list) {
    var best = 0, i;
    for (i = 1; i < list.length; i++) if (list[i] < list[best]) best = i;
    return best;
  }

  // The curve's value for the jetty fact: the best placed item that carries it, or null.
  function keyRecall(r) {
    if (!r.keyArrives) return null;
    var c = curve(r.items.length), best = null;
    r.items.forEach(function (it, i) { if (it.key && (best === null || c[i] > best)) best = c[i]; });
    return best;
  }

  /* ---------- formatting ---------- */

  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function f2(v) { return v.toFixed(2); }
  function dollars(micro) { return (micro / 1000000).toFixed(4); }

  function pagesText(list) {
    if (!list.length) return "no pages";
    var parts = [], i = 0;
    while (i < list.length) {
      var a = list[i], b = a;
      while (i + 1 < list.length && list[i + 1] === b + 1) { i++; b = list[i]; }
      parts.push(a === b ? "page " + a : "pages " + a + "-" + b);
      i++;
    }
    return parts.join(", ");
  }

  function sentText(r) {
    if (r.refused) return "refused";
    var bits = [];
    r.items.forEach(function (it) {
      if (it.kind === "card") bits.push("the card");
      if (it.kind === "summary") bits.push("a summary of " + pagesText(r.summarized));
    });
    if (r.sentPages.length) bits.push(pagesText(r.sentPages));
    return bits.join(", ");
  }

  function keyWord(r) {
    if (r.refused) return "refused";
    if (!r.written) return "not yet";
    return r.keyArrives ? "arrives" : "missing";
  }

  /* ---------- the widget ---------- */

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (own(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function txt(doc, parent, x, y, text, cls, anchor, style) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "middle" }, parent);
    if (style) t.setAttribute("style", style);
    t.textContent = text;
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }

    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "Each breakfast the app builds a brand-new request: the model keeps nothing from the day before. " +
      "Token counts are teaching values, and the reader is a toy that answers from what arrives."));

    box.appendChild(head("This breakfast's request, against the context window"));
    var reqSvg = mk(doc, "svg", { viewBox: "0 0 640 112", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(reqSvg);
    var reqNote = el("p", "", "margin:0;font-size:13px;", "");
    reqNote.setAttribute("aria-live", "polite");
    box.appendChild(reqNote);

    box.appendChild(head("The notebook: which pages reached the model"));
    var bookSvg = mk(doc, "svg", { viewBox: "0 0 640 104", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(bookSvg);

    box.appendChild(head("The reader at 06:31"));
    var said = el("p", "", "margin:0;font-size:13px;font-style:italic;", "");
    said.setAttribute("aria-live", "polite");
    box.appendChild(said);

    box.appendChild(head("Input tokens sent at each breakfast, with these settings"));
    var billSvg = mk(doc, "svg", { viewBox: "0 0 640 128", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(billSvg);
    var billNote = el("p", "muted", "margin:0;font-size:12px;", "");
    box.appendChild(billNote);

    var curveHead = head("Recall by position: a teaching curve, not the paper's numbers");
    box.appendChild(curveHead);
    var curveSvg = mk(doc, "svg", { viewBox: "0 0 640 128", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(curveSvg);
    var curveNote = el("p", "muted", "margin:0;font-size:12px;", "");
    box.appendChild(curveNote);

    api.root.appendChild(box);
    return { doc: doc, reqSvg: reqSvg, reqNote: reqNote, bookSvg: bookSvg, said: said, billSvg: billSvg,
      billNote: billNote, curveHead: curveHead, curveSvg: curveSvg, curveNote: curveNote };
  }

  /* ---------- drawing ---------- */

  function drawRequest(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.reqSvg, r = S.res, X0 = 20, SC = 600 / WIN_MAX, Y = 22, H = 38;
    clear(svg);
    var winEnd = X0 + r.window * SC, x = X0;
    function seg(tokens, cls, op, label) {
      var w = tokens * SC;
      mk(doc, "rect", { x: x.toFixed(2), y: Y, width: Math.max(1, w - 1).toFixed(2), height: H, rx: 2,
        "class": cls, "fill-opacity": op }, svg);
      if (label && w >= label.length * 6 + 4) {
        txt(doc, svg, (x + w / 2).toFixed(2), Y + H / 2 + 4, label, "dg-label", "middle", "font-size:10px;font-weight:400;");
      }
      x += w;
    }
    if (r.refused) {
      seg(r.attempted, "dot dot-fail", "0.45", "");
      txt(doc, svg, X0 + 6, Y + H / 2 + 4, "refused: " + comma(r.attempted) + " tokens, room for " +
        comma(r.budget + INSTR), "dg-label", "start", "font-size:11px;");
    } else {
      seg(INSTR, "dot dot-req", "0.8", "instr.");
      r.items.forEach(function (it) {
        if (it.kind === "card") seg(it.tokens, "dot dot-ok", "0.9", "card");
        else if (it.kind === "summary") seg(it.tokens, "dot dot-accent", "0.8", "sum.");
        else seg(it.tokens, it.key ? "dot dot-ok" : "dot dot-wait", it.key ? "0.9" : "0.6", String(it.page));
      });
    }
    var resX = X0 + (r.window - RESERVE) * SC;
    mk(doc, "rect", { x: resX.toFixed(2), y: Y, width: (RESERVE * SC).toFixed(2), height: H, rx: 2,
      "class": "dot dot-req", "fill-opacity": "0.2" }, svg);
    txt(doc, svg, (resX + RESERVE * SC / 2).toFixed(2), Y + H + 14, "answer", "dg-axis", "middle", "font-size:10px;");
    mk(doc, "rect", { x: X0, y: Y - 3, width: (r.window * SC).toFixed(2), height: H + 6, rx: 3,
      "class": "dg-edge tone-accent", fill: "none", style: "stroke-width:2" }, svg);
    if (!r.refused) txt(doc, svg, X0, Y + H + 14, "instructions", "dg-axis", "start", "font-size:10px;");
    txt(doc, svg, winEnd.toFixed(2), Y + H + 28, "window " + comma(r.window), "dg-axis", "end", "font-size:10px;");
    txt(doc, svg, X0, 12, (r.refused ? "Tried to send " + comma(r.attempted) : "Sent " + comma(r.sent)) +
      " tokens; " + comma(r.budget) + " of the window are free for pages", "dg-axis", "start", "font-size:10px;");
    svg.setAttribute("aria-label", "Breakfast " + r.breakfast + ", window " + comma(r.window) + " tokens. " +
      (r.refused ? "Request refused: " + comma(r.attempted) + " tokens do not fit with " + comma(RESERVE) + " kept for the answer."
        : "Sent " + comma(r.sent) + " tokens: the instructions, " + sentText(r) + ". " + comma(RESERVE) + " kept for the answer."));
    ui.reqNote.textContent = r.refused
      ? "Breakfast " + r.breakfast + ": the pages don't fit, so the service refuses the request. Nothing reaches the model."
      : "Breakfast " + r.breakfast + ": the instructions, " + sentText(r) + ". " + comma(r.sent) + " tokens sent." +
        (r.skipped.length ? " Never sent: " + pagesText(r.skipped) + "." : " Nothing skipped.");
  }

  function drawBook(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.bookSvg, r = S.res, TW = 38, GAP = 3, X0 = 14, Y = 14, H = 30, j;
    clear(svg);
    for (j = 1; j <= N_PAGES; j++) {
      var x = X0 + (j - 1) * (TW + GAP), cls, op;
      if (j > r.breakfast) { cls = "dot dot-wait"; op = "0.12"; }
      else if (r.refused) { cls = "dot dot-fail"; op = "0.3"; }
      else if (r.sentPages.indexOf(j) >= 0) { cls = "dot dot-ok"; op = "0.75"; }
      else if (r.summarized.indexOf(j) >= 0) { cls = "dot dot-accent"; op = "0.55"; }
      else { cls = "dot dot-fail"; op = "0.7"; }
      mk(doc, "rect", { x: x, y: Y, width: TW, height: H, rx: 3, "class": cls, "fill-opacity": op }, svg);
      txt(doc, svg, x + TW / 2, Y + 19, String(j), "dg-label", "middle", "font-size:11px;");
      txt(doc, svg, x + TW / 2, Y + H + 12, comma(PAGES[j - 1]), "dg-axis", "middle", "font-size:9px;");
      if (j === KEY_PAGE) {
        mk(doc, "rect", { x: x - 2, y: Y - 2, width: TW + 4, height: H + 4, rx: 4,
          "class": "dg-edge tone-accent", fill: "none", style: "stroke-width:2" }, svg);
        txt(doc, svg, x + TW / 2, Y + H + 25, "storm", "dg-label", "middle", "font-size:10px;");
      }
      if (j === 1) txt(doc, svg, x + TW / 2, Y + H + 25, "Saskia", "dg-label", "middle", "font-size:10px;");
    }
    var LY = 90, legend = [["dot dot-ok", "0.75", "sent"], ["dot dot-accent", "0.55", "only in the summary"],
      ["dot dot-fail", "0.7", "never sent"], ["dot dot-wait", "0.12", "not written yet"]], lx = X0;
    legend.forEach(function (l) {
      mk(doc, "rect", { x: lx, y: LY - 9, width: 12, height: 10, rx: 2, "class": l[0], "fill-opacity": l[1] }, svg);
      txt(doc, svg, lx + 16, LY, l[2], "dg-axis", "start", "font-size:10px;");
      lx += 30 + l[2].length * 6;
    });
    svg.setAttribute("aria-label", "The notebook at breakfast " + r.breakfast + ". " +
      (r.refused ? "Nothing sent: the request was refused." :
        "Sent: " + pagesText(r.sentPages) + ". " +
        (r.summarized.length ? "Only in the summary: " + pagesText(r.summarized) + ". " : "") +
        (r.skipped.length ? "Never sent: " + pagesText(r.skipped) + "." : "Nothing skipped.")) +
      " Page 8 is the storm: the jetty is down.");
  }

  function drawBill(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.billSvg, list = S.bill, X0 = 34, SLOT = 40, BW = 26, BASE = 92, TOP = 74, b;
    var MAXSENT = INSTR + CARD_TOKENS + prefix(N_PAGES);
    clear(svg);
    mk(doc, "path", { d: "M" + (X0 - 4) + " " + BASE + " H " + (X0 + N_PAGES * SLOT), "class": "dg-axis" }, svg);
    for (b = 1; b <= N_PAGES; b++) {
      var x = X0 + (b - 1) * SLOT, v = list[b - 1], r = plan(withBreakfast(settings(S), b));
      var h = v / MAXSENT * TOP, cls = r.refused ? "dot dot-fail" : !r.written ? "dot dot-wait" : r.keyArrives ? "dot dot-ok" : "dot dot-fail";
      var op = b === S.breakfast ? "0.95" : "0.45";
      if (r.refused) {
        mk(doc, "rect", { x: x, y: BASE - 3, width: BW, height: 3, "class": cls, "fill-opacity": op }, svg);
        txt(doc, svg, x + BW / 2, BASE - 8, "x", "dg-label", "middle", "font-size:11px;");
      } else {
        mk(doc, "rect", { x: x, y: (BASE - h).toFixed(2), width: BW, height: Math.max(1, h).toFixed(2), rx: 2,
          "class": cls, "fill-opacity": op }, svg);
      }
      txt(doc, svg, x + BW / 2, BASE + 14, String(b), b === S.breakfast ? "dg-label" : "dg-axis", "middle", "font-size:10px;");
    }
    mk(doc, "rect", { x: X0 + (S.breakfast - 1) * SLOT - 4, y: 10, width: BW + 8, height: BASE - 6, rx: 3,
      "class": "dg-edge tone-accent", fill: "none", style: "stroke-width:1.5" }, svg);
    txt(doc, svg, X0 - 4, 122, "breakfast; green: jetty fact sent, red: missing or refused, faint: before the storm",
      "dg-axis", "start", "font-size:10px;");
    var total = runningTotal(settings(S), S.breakfast);
    svg.setAttribute("aria-label", "Input tokens sent at breakfasts 1 to 15: " +
      list.map(function (v, i) { return (i + 1) + ": " + (v ? comma(v) : "refused"); }).join(", ") + ".");
    ui.billNote.textContent = "Breakfasts 1 to " + S.breakfast + ": " + comma(total) + " input tokens, " +
      dollars(costMicro(total)) + " dollars at the teaching price of $" + PRICE_PER_M + " per million input tokens. " +
      "The model is stateless, so every breakfast pays for every page it is sent again.";
  }

  function itemLabel(it) { return it.kind === "card" ? "C" : it.kind === "summary" ? "S" : String(it.page); }

  function drawCurve(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.curveSvg, r = S.res;
    var shown = S.curve ? "" : "display:none;";
    ui.curveHead.setAttribute("style", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;" + shown);
    svg.setAttribute("style", shown);
    ui.curveNote.setAttribute("style", "margin:0;font-size:12px;" + shown);
    clear(svg);
    if (!S.curve) { ui.curveNote.textContent = ""; svg.setAttribute("aria-label", "Curve off."); return; }
    if (r.refused || !r.items.length) {
      txt(doc, svg, 320, 64, "Nothing was sent, so nothing can be used.", "dg-label", "middle", "font-size:12px;");
      svg.setAttribute("aria-label", "Nothing was sent.");
      ui.curveNote.textContent = "Teaching simplification inspired by the U shape in Liu et al.: made-up heights, not the paper's numbers.";
      return;
    }
    var n = r.items.length, c = curve(n), SLOTW = 600 / n, BW = Math.min(26, SLOTW - 4), BASE = 100, TOP = 76, lo = argmin(c);
    mk(doc, "path", { d: "M16 " + BASE + " H 624", "class": "dg-axis" }, svg);
    r.items.forEach(function (it, i) {
      var cx = 20 + SLOTW * i + SLOTW / 2, h = c[i] * TOP;
      mk(doc, "rect", { x: (cx - BW / 2).toFixed(2), y: (BASE - h).toFixed(2), width: BW.toFixed(2), height: h.toFixed(2), rx: 2,
        "class": it.key ? "dot dot-ok" : "dot dot-wait", "fill-opacity": it.key ? "0.9" : "0.5" }, svg);
      if (SLOTW >= 26) txt(doc, svg, cx.toFixed(2), (BASE - h - 4).toFixed(2), f2(c[i]), "dg-axis", "middle", "font-size:9px;");
      txt(doc, svg, cx.toFixed(2), BASE + 13, itemLabel(it), i === lo ? "dg-label" : "dg-axis", "middle", "font-size:10px;");
    });
    txt(doc, svg, 16, 124, "order sent: C card, S summary, numbers are pages", "dg-axis", "start", "font-size:10px;");
    var kr = keyRecall(r);
    svg.setAttribute("aria-label", "Teaching curve over the " + n + " items sent: " +
      r.items.map(function (it, i) { return itemLabel(it) + " " + f2(c[i]); }).join(", ") + ".");
    ui.curveNote.textContent = "Teaching simplification inspired by the U shape in Liu et al.: made-up heights, not the paper's numbers. " +
      "Lowest here: " + (r.items[lo].kind === "page" ? "page " + r.items[lo].page : r.items[lo].kind) + ", in position " + (lo + 1) + " of " + n + ". " +
      (kr === null ? "The jetty fact isn't in this request at all." : "The jetty fact's best position gives " + f2(kr) + ".");
  }

  function drawStats(S) {
    var r = S.res, total = runningTotal(settings(S), S.breakfast), kr = keyRecall(r);
    S.stat.sent(r.refused ? "refused" : comma(r.sent));
    S.stat.key(keyWord(r));
    S.stat.total(comma(total));
    S.stat.cost(dollars(costMicro(total)));
    S.stat.recall(S.curve && kr !== null ? f2(kr) : "-");
  }

  function settings(S) { return { breakfast: S.breakfast, window: S.window, strategy: S.strategy, card: S.card, sumKey: S.sumKey }; }

  function draw(api) {
    var S = api.state;
    S.res = plan(settings(S));
    S.bill = perBreakfast(settings(S));
    S.said = answer(S.res);
    drawRequest(S);
    drawBook(S);
    S.ui.said.textContent = S.said.text;
    drawBill(S);
    drawCurve(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function summary(S) {
    var r = S.res;
    return "Breakfast " + r.breakfast + ", window " + comma(r.window) + ", " + STRAT_NAMES[r.strategy] +
      (S.card ? ", card on" : "") + ": " +
      (r.refused ? "refused, " + comma(r.attempted) + " tokens don't fit." : "sent " + sentText(r) + ", " + comma(r.sent) + " tokens.") +
      " The reader: " + S.said.text;
  }

  function toneOf(S) { return S.said.tone; }

  function narrateLater(api) {
    var S = api.state;
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      api.log(summary(S), toneOf(S));
    });
  }

  function setStrategy(api, v) {
    var S = api.state;
    if (STRATEGIES.indexOf(v) < 0) return;
    S.strategy = v;
    draw(api);
    api.log(summary(S), toneOf(S));
  }

  function setWindow(api, v) {
    var S = api.state, k = Math.round(Number(v) / WIN_STEP) * WIN_STEP;
    if (!(k >= WIN_MIN && k <= WIN_MAX)) return;
    S.window = k;
    draw(api);
    narrateLater(api);
  }

  function setBreakfast(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 1 && k <= N_PAGES)) return;
    S.breakfast = k;
    draw(api);
    narrateLater(api);
  }

  function setFlag(api, name, v, line) {
    var S = api.state;
    S[name] = !!v;
    draw(api);
    api.log(line(S) + " " + summary(S), toneOf(S));
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e09", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.breakfast = STORY_BREAKFAST;
      S.window = STORY_WINDOW;
      S.strategy = STORY_STRATEGY;
      S.card = false;
      S.sumKey = false;
      S.curve = false;
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.strategy = api.control.select("strategy", "Which pages go in", [
        { value: "all", label: "Send everything" },
        { value: "newest", label: "Keep the newest (drop the oldest first)" },
        { value: "firstlast", label: "Keep the first and last (page 1, then the newest)" },
        { value: "summary", label: "Summarize older pages (newest three kept)" }
      ], STORY_STRATEGY, function (v) { setStrategy(api, v); });
      S.ctl.window = api.control.range("window", "Context window", WIN_MIN, WIN_MAX, WIN_STEP, STORY_WINDOW,
        function (v) { setWindow(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return comma(k) + " tokens (" + comma(budgetOf(k)) + " for pages)"; } });
      S.ctl.breakfast = api.control.range("breakfast", "Breakfast", 1, N_PAGES, 1, STORY_BREAKFAST,
        function (v) { setBreakfast(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return "breakfast " + k + ", " + k + (k === 1 ? " page" : " pages"); } });
      S.ctl.card = api.control.toggle("card", "Standing card first (150 tokens)", false,
        function (v) { setFlag(api, "card", v, function (s) { return s.card ? "The card goes first now." : "No card."; }); });
      S.ctl.sumkey = api.control.toggle("sumkey", "The summary kept the jetty line", false,
        function (v) { setFlag(api, "sumKey", v, function (s) { return s.sumKey ? "This summary mentions the jetty." : "The summary leaves the jetty out, like the one Severin tried."; }); });
      S.ctl.curve = api.control.toggle("curve", "Recall-by-position curve (teaching)", false,
        function (v) { setFlag(api, "curve", v, function (s) { return s.curve ? "Teaching curve on." : "Teaching curve off."; }); });
      S.ctl.reset = api.control.button("reset", "Reset to this morning", function () { api.reset(); });

      S.stat = {
        sent: api.stat("sent", "tokens sent this breakfast", ""),
        key: api.stat("key", "the jetty fact", "bad"),
        total: api.stat("total", "input tokens, breakfasts 1 to this one", "warn"),
        cost: api.stat("cost", "dollars at the teaching price", ""),
        recall: api.stat("recall", "teaching curve, jetty fact", "")
      };

      api.info("<strong>How to read it.</strong> The model keeps nothing between requests, so every breakfast the app sends " +
        "its instructions and his question (768 tokens), then the pages a strategy picks, and keeps 1,024 tokens of the window " +
        "for the answer. The top bar is that request against the window. The tiles are the notebook: page 1 is Saskia's, page 8 " +
        "is the storm. Send everything is refused when the pages don't fit; the other strategies only add what fits. The bars " +
        "below are the tokens sent at every breakfast with these settings, and the stats add them up at a teaching price of $2 " +
        "per million input tokens. The reader is a toy that answers from whether the jetty fact arrived. The curve is a teaching " +
        "simplification inspired by the lost-in-the-middle U shape: made-up heights, not the paper's numbers.");
      draw(api);
      api.log("Nine in the morning, breakfast 15: window " + comma(STORY_WINDOW) + ", " + STRAT_NAMES[STORY_STRATEGY] +
        ". Sent " + sentText(S.res) + ", " + comma(S.res.sent) + " tokens. The reader said: " + S.said.text, toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function sv(id) { return String(t.stat(id)); }
      function cfg(b, w, strat, card, sumKey) { return { breakfast: b, window: w, strategy: strat, card: !!card, sumKey: !!sumKey }; }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      function range(a, b) { var out = [], i; for (i = a; i <= b; i++) out.push(i); return out; }
      var WINDOWS = [], w, b, ok, count;
      for (w = WIN_MIN; w <= WIN_MAX; w += WIN_STEP) WINDOWS.push(w);
      var TRIMS = ["newest", "firstlast", "summary"];

      // 1. This morning at the start.
      await t.run(1);
      t.expect(st().breakfast === 15 && st().window === 8192 && st().strategy === "firstlast" && !st().card && !st().sumKey && !st().curve &&
        sv("sent") === "6,718" && sv("key") === "missing" && sv("recall") === "-" &&
        same(st().res.sentPages, [1, 9, 10, 11, 12, 13, 14, 15]) && same(st().res.skipped, range(2, 8)) &&
        t.logText().indexOf("Good morning, Mr Ostrander. " + LINE_BOAT) >= 0 && t.logText().indexOf("page 1, pages 9-15") >= 0,
        "the start is this morning: breakfast 15, window 8,192, keep the first and last; page 1 and pages 9 to 15 sent, 6,718 tokens; pages 2 to 8 skipped; the jetty fact missing; the reader says the boat will be at seven");

      // 2. No trimming strategy ever sends more than the window allows.
      ok = true; count = 0;
      WINDOWS.forEach(function (ww) {
        for (b = 1; b <= N_PAGES; b++) {
          TRIMS.forEach(function (s) {
            [false, true].forEach(function (card) {
              [false, true].forEach(function (sk) {
                var r = plan(cfg(b, ww, s, card, sk));
                if (r.refused || r.sent + RESERVE > ww || r.notes > budgetOf(ww) || r.sent <= INSTR) ok = false;
                count += 1;
              });
            });
          });
        }
      });
      t.expect(ok && count === 25 * 15 * 3 * 4,
        "in all 4,500 runs of the three trimming strategies (25 windows from 4,096 to 16,384, 15 breakfasts, card and summary switches), the request plus the 1,024 kept for the answer never exceeds the window, and something is always sent");

      // 3. Send everything is refused when it doesn't fit, and never cuts anything.
      ok = true;
      WINDOWS.forEach(function (ww) {
        for (b = 1; b <= N_PAGES; b++) {
          [false, true].forEach(function (card) {
            var r = plan(cfg(b, ww, "all", card, false));
            var fits = INSTR + (card ? CARD_TOKENS : 0) + prefix(b) + RESERVE <= ww;
            if (r.refused === fits) ok = false;
            if (fits && (!same(r.sentPages, range(1, b)) || r.sent !== INSTR + (card ? CARD_TOKENS : 0) + prefix(b))) ok = false;
            if (!fits && (r.sent !== 0 || r.items.length !== 0 || r.keyArrives)) ok = false;
          });
        }
      });
      var firstRefusal = 0;
      for (b = N_PAGES; b >= 1; b--) if (plan(cfg(b, STORY_WINDOW, "all")).refused) firstRefusal = b;
      t.expect(ok && firstRefusal === 10 && prefix(9) === 6050 && prefix(10) === 6750 &&
        plan(cfg(15, STORY_WINDOW, "all")).refused && plan(cfg(15, BIG_WINDOW, "all")).sent === 11068,
        "send everything sends every page when it fits and is refused, sending nothing, when it doesn't; at 8,192 the first refusal is breakfast 10 (6,750 > 6,400); at 16,384 breakfast 15 fits with 11,068 tokens");

      // 4. Send everything: the running total is exactly the sum of the whole history at every breakfast.
      ok = true;
      var big = cfg(1, BIG_WINDOW, "all"), want = 0, hist = 0;
      for (b = 1; b <= N_PAGES; b++) {
        want += INSTR + prefix(b);
        hist += prefix(b);
        if (runningTotal(big, b) !== want || perBreakfast(big)[b - 1] !== INSTR + prefix(b)) ok = false;
      }
      t.expect(ok && want === 93620 && hist === 82100 && want === N_PAGES * INSTR + hist && plan(cfg(1, BIG_WINDOW, "all")).sent === 1768,
        "send everything at 16,384: each breakfast sends the instructions plus every page so far, and the running total is exactly their sum, breakfast by breakfast; 1,768 at breakfast 1, 93,620 over fifteen (15 x 768 + 82,100)");

      // 5. Keep the newest drops the oldest first.
      ok = true;
      WINDOWS.forEach(function (ww) {
        for (b = 1; b <= N_PAGES; b++) {
          [false, true].forEach(function (card) {
            var p = plan(cfg(b, ww, "newest", card, false)).sentPages;
            if (!p.length || p[p.length - 1] !== b || !same(p, range(p[0], b))) ok = false;
          });
        }
      });
      var nw = plan(cfg(15, STORY_WINDOW, "newest"));
      t.expect(ok && same(nw.sentPages, range(7, 15)) && nw.notes === 6300 && nw.sent === 7068 &&
        nw.sentPages.indexOf(1) < 0 && nw.keyArrives && nw.sentPages[1] === KEY_PAGE,
        "keep the newest always sends a run of pages ending at the newest, so every page dropped is older than every page sent; this morning: pages 7 to 15, 6,300 tokens of pages, page 1 dropped, page 8 the second-oldest sent");

      // 6. Keep the first and last: page 1, then the newest that fit; page 8 last sent at breakfast 14.
      ok = true;
      WINDOWS.forEach(function (ww) {
        for (b = 1; b <= N_PAGES; b++) {
          var p = plan(cfg(b, ww, "firstlast")).sentPages;
          if (p[0] !== 1) ok = false;
          var rest = p.slice(1);
          if (b > 1 && (!rest.length || !same(rest, range(rest[0], b)))) ok = false;
        }
      });
      var key8 = [];
      for (b = KEY_PAGE; b <= N_PAGES; b++) key8.push(plan(cfg(b, STORY_WINDOW, "firstlast")).keyArrives);
      var fl = plan(cfg(15, STORY_WINDOW, "firstlast"));
      t.expect(ok && same(key8, [true, true, true, true, true, true, true, false]) &&
        same(plan(cfg(13, STORY_WINDOW, "firstlast")).sentPages, [1].concat(range(7, 13))) &&
        same(plan(cfg(14, STORY_WINDOW, "firstlast")).sentPages, [1].concat(range(8, 14))) &&
        fl.notes === 5950 && fl.sent === 6718 && same(fl.skipped, range(2, 8)) && prefix(N_PAGES) - fl.notes === 4350 &&
        fl.notes + PAGES[KEY_PAGE - 1] > budgetOf(STORY_WINDOW),
        "keep the first and last always sends page 1 and then a run ending at the newest page; at 8,192 page 8 goes in at breakfasts 8 to 14 and not at 15; breakfast 13 sends 1 and 7 to 13, 14 sends 1 and 8 to 14, 15 sends 1 and 9 to 15 (5,950, so 6,718), skipping 4,350");

      // 7. Summarize keeps the jetty fact if, and only if, the summary includes it, whenever page 8 is summarized.
      ok = true; count = 0;
      WINDOWS.forEach(function (ww) {
        for (b = 1; b <= N_PAGES; b++) {
          [false, true].forEach(function (sk) {
            var r = plan(cfg(b, ww, "summary", false, sk));
            if (r.summarized.indexOf(KEY_PAGE) >= 0) {
              count += 1;
              if (r.keyArrives !== sk) ok = false;
            } else if (r.sentPages.indexOf(KEY_PAGE) >= 0) {
              if (!r.keyArrives) ok = false;
            } else if (r.written || r.keyArrives) ok = false;
          });
        }
      });
      var sm = plan(cfg(15, STORY_WINDOW, "summary", false, false)), sm2 = plan(cfg(15, STORY_WINDOW, "summary", false, true));
      t.expect(ok && count > 0 && same(sm.summarized, range(1, 12)) && same(sm.sentPages, [13, 14, 15]) && sm.sent === 3268 &&
        !sm.keyArrives && sm2.keyArrives && sm2.sent === 3268,
        "whenever page 8 is folded into the summary, the jetty fact arrives exactly when the summary includes it; when page 8 is kept word for word it always arrives; this morning: a 300-token summary of pages 1 to 12 plus pages 13 to 15, 3,268 tokens, jetty missing unless the summary kept it");

      // 8. The teaching curve: the middle item is lowest; page 8 in the middle of fifteen gets 0.50.
      ok = true;
      for (var n = 2; n <= 18; n++) {
        var c = curve(n), m = Math.floor(n / 2), i;
        for (i = 0; i < n; i++) {
          if (i !== m && !(c[i] > c[m])) ok = false;
          if (!(c[i] > 0 && c[i] <= 1)) ok = false;
        }
      }
      var whole = plan(cfg(15, BIG_WINDOW, "all")), wc = curve(whole.items.length);
      t.expect(ok && whole.items.length === 15 && argmin(wc) === 7 && whole.items[7].page === KEY_PAGE &&
        f2(wc[7]) === "0.50" && f2(keyRecall(whole)) === "0.50" && f2(curve(15)[0]) === "0.90" && f2(curve(15)[14]) === "0.80",
        "for 2 to 18 items the curve's lowest point is the middle item, below every other; sending all fifteen pages at 16,384 puts page 8 exactly in the middle, lowest at 0.50, against 0.90 first and 0.80 last");

      // 9. The cost math is exact.
      ok = true;
      [STORY_WINDOW, BIG_WINDOW, WIN_MIN].forEach(function (ww) {
        STRATEGIES.forEach(function (s) {
          [false, true].forEach(function (card) {
            for (b = 1; b <= N_PAGES; b++) {
              var tot = runningTotal(cfg(1, ww, s, card), b), micro = costMicro(tot);
              if (!(Number.isInteger(tot) && Number.isInteger(micro) && micro === tot * PRICE_PER_M)) ok = false;
            }
          });
        });
      });
      t.expect(ok && costMicro(93620) === 187240 && dollars(187240) === "0.1872" && PRICE_PER_M === 2,
        "every running total and its cost are whole numbers, cost = tokens x $2 per million exactly, in micro-dollars; 93,620 tokens cost 187,240 micro-dollars, 0.1872 dollars");

      // 10. The standing card: with it, the jetty fact arrives whenever a request is sent after the storm.
      ok = true;
      WINDOWS.forEach(function (ww) {
        for (b = 1; b <= N_PAGES; b++) {
          STRATEGIES.forEach(function (s) {
            [false, true].forEach(function (sk) {
              var r = plan(cfg(b, ww, s, true, sk));
              if (!r.refused && r.items[0].kind !== "card") ok = false;
              if (!r.refused && r.written && !r.keyArrives) ok = false;
            });
          });
        }
      });
      var cd = plan(cfg(15, STORY_WINDOW, "summary", true, false));
      t.expect(ok && cd.sent === 3418 && cd.keyArrives && f2(keyRecall(cd)) === "0.90" && Math.abs(cd.sent / 6718 - 0.5) < 0.02,
        "with the card on, it goes first in every request that isn't refused, and the jetty fact arrives at every breakfast from 8 on; card plus summary this morning is 3,418 tokens, about half of 6,718, with the card first at 0.90 on the curve");

      // 11. Every story number, checked exactly.
      var lastSeven = 0;
      for (b = 9; b <= 15; b++) lastSeven += PAGES[b - 1];
      var middle = 0;
      for (b = 2; b <= 8; b++) middle += PAGES[b - 1];
      t.expect(N_PAGES === 15 && prefix(15) === 10300 && PAGES[0] === 1000 && PAGES[KEY_PAGE - 1] === 700 &&
        INSTR === 768 && RESERVE === 1024 && STORY_WINDOW === 8192 && budgetOf(STORY_WINDOW) === 6400 &&
        lastSeven === 4950 && middle === 4350 && PAGES[0] + lastSeven === 5950 && INSTR + 5950 === 6718 &&
        prefix(10) === 6750 && BIG_WINDOW === 16384 && INSTR + prefix(15) === 11068 && INSTR + PAGES[0] === 1768 &&
        SUMMARY_TOKENS === 300 && CARD_TOKENS === 150 && INSTR + SUMMARY_TOKENS + 750 + 750 + 700 === 3268 &&
        INSTR + CARD_TOKENS + SUMMARY_TOKENS + 2200 === 3418 && INSTR + 6300 === 7068 && START_CLOCK === 32400,
        "story numbers: 15 pages, 10,300 tokens, page 1 1,000, page 8 700; 768 for instructions, 1,024 for the answer, 6,400 for pages in 8,192; pages 9 to 15 4,950, pages 2 to 8 4,350, 5,950 and 6,718 sent; 6,750 at breakfast 10; 11,068 and 1,768 at 16,384; summary 300 and 3,268; card 150 and 3,418; 7,068 newest; nine in the morning");

      // 12. The toy reader says what the story says.
      var at14 = answer(plan(cfg(14, STORY_WINDOW, "firstlast"))), at15 = answer(fl), nwA = answer(nw);
      var refA = answer(plan(cfg(15, STORY_WINDOW, "all"))), early = answer(plan(cfg(5, STORY_WINDOW, "firstlast")));
      t.expect(at15.text === "Good morning, Mr Ostrander. " + LINE_BOAT && at15.tone === "bad" &&
        at14.text === "Good morning, Mr Ostrander. " + LINE_AWAY && nwA.text === "Good morning, sir. " + LINE_AWAY &&
        refA.text.indexOf("refused") >= 0 && early.text === "Good morning, Mr Ostrander. " + LINE_BOAT && early.tone === "ok" &&
        answer(sm).text === "Good morning, Mr Ostrander. " + LINE_BOAT,
        "the reader: this morning, boat at seven (wrong, after the storm); breakfast 14, boats put away; newest only, it calls him sir; send everything at 8,192, nothing; before the storm, boat at seven is right; the summary without the jetty, boat at seven");

      // 13. The same settings give the same request, bit for bit.
      var a1 = JSON.stringify(plan(cfg(11, 9728, "summary", true, true))), a2 = JSON.stringify(plan(cfg(11, 9728, "summary", true, true)));
      t.expect(a1 === a2 && JSON.stringify(perBreakfast(cfg(1, 6144, "newest"))) === JSON.stringify(perBreakfast(cfg(1, 6144, "newest"))) &&
        JSON.stringify(curve(9)) === JSON.stringify(curve(9)),
        "the sim is deterministic: the same settings give the identical request, totals and curve");

      // 14. The controls.
      t.set("strategy", "all");
      var refView = sv("sent") === "refused" && sv("key") === "refused";
      t.set("window", 16384);
      await t.run(1);
      var bigView = sv("sent") === "11,068" && sv("key") === "arrives" && sv("total") === "93,620" && t.stat("cost") === 0.1872;
      t.set("curve", true);
      var curveView = t.stat("recall") === 0.5;
      t.set("window", 8192);
      await t.run(1);
      t.set("strategy", "newest");
      var newView = sv("sent") === "7,068" && sv("key") === "arrives" && st().said.text.indexOf("sir") >= 0;
      t.set("strategy", "summary");
      var sumView = sv("sent") === "3,268" && sv("key") === "missing";
      t.set("sumkey", true);
      var sumKeyView = sv("key") === "arrives";
      t.set("sumkey", false);
      t.set("card", true);
      var cardView = sv("sent") === "3,418" && sv("key") === "arrives" && t.stat("recall") === 0.9;
      t.set("card", false);
      t.set("strategy", "firstlast");
      t.set("breakfast", 14);
      await t.run(1);
      var b14View = sv("key") === "arrives" && t.logText().indexOf("Breakfast 14") >= 0;
      t.set("breakfast", 5);
      await t.run(1);
      var b5View = sv("key") === "not yet";
      t.click("reset");
      await t.run(1);
      t.expect(refView && bigView && curveView && newView && sumView && sumKeyView && cardView && b14View && b5View &&
        st().breakfast === 15 && st().window === 8192 && st().strategy === "firstlast" && !st().curve && sv("sent") === "6,718",
        "the controls: send everything is refused at 8,192 and fits at 16,384 with 11,068 and 93,620 in all (0.1872 dollars); the curve gives page 8 0.50; keep the newest sends 7,068 and calls him sir; summarize sends 3,268 and loses the jetty unless the summary kept it; the card makes 3,418 with the jetty first at 0.90; breakfast 14 gets the jetty; breakfast 5 is before the storm; reset returns to this morning");
    }
  });
})();
