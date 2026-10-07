/* sims/a2e04-v1.0.0.js  (published as sims/a2e04.js)
   Case a2e04 "Everything It Can See": an evidence-wall context builder, from Wilmer's night assistant in the
   old projection box of the Alcazar, where a cold-case group works the February 1983 disappearance of the
   projectionist, Casimir Ledwith.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as two
     inline SVGs (the wall of 14 cards, and the request at call 1 as one bar cut into thirds), plain text
     readouts and one table, using theme classes only. Each card has a teaching token count and a flag the
     sim knows (needed for the 02:14 question or not); the foyer photograph is the key card. Controls: the
     wall (pin everything, the inspector's September wall, only what the question needs, or your own by
     pressing cards), the order (question first after the system prompt, standing parts first with the
     question last, or re-pinned in a new order every call), the budget per request, trimming the history
     to fit, prompt caching on or off, the number of calls in the night, reset. Stats: tokens sent per
     call, tokens not needed, where the photograph sits at call 1, right answers in the night, cache reads,
     the night's input cost as set and with caching off. selfTest covers the 02:14 start, the budget and
     trimming over every pin subset, a cache read if and only if the prefix matches the previous call's,
     zero reads when re-pinned every call, the exact cost arithmetic, pin everything putting the photograph
     in the middle third, the needed cards answering right, the answer rule over every subset and order,
     determinism, every story number, and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e04-v1.0.0.json).
   All of them follow from CARDS, the walls, build(), orderFor(), positionOf(), answerOf() and night():
   - The cards (teaching token counts, made up for the case): instructions 700 and two worked answers 900,
     the system prompt (1,600); the case file 4,200; DS Pennick's 1983 notes 9,600 (they name Mr Brask 14
     times; the 1985 review set them aside); Brask's statement 1,300; Fenwick's statement 1,100; the
     photographs of the projection box 500, the foyer 600 (the key card) and Orrin Street 400; the takings
     book 3,400; the clippings 7,800; September's saved conversation 6,200; tonight's conversation, kept to
     its last ten turns, 1,500; the question 100. All 14: 38,300. Not needed for the question (notes, box,
     street, takings, clippings, September): 27,900. Needed, the system prompt and the question included:
     10,400.
   - Gideon's request at 02:14 (pin everything, question first): the system prompt, the question, the nine
     wall cards in pin order, then the two conversations. 38,300 tokens, under the 60,000 budget. The foyer
     photograph is card 9 of 14, tokens 18,400 to 19,000: its midpoint 18,700 is 0.488 of the request, the
     middle third. Not needed: 27,900, over the 8,000 the teaching rule allows, and the notes are in, so
     the answer names Mr Brask. The cache breakpoint sits after the last wall card: 30,600 tokens before
     it, the question among them, so every call writes and none reads. Per call 30,600 x 1.25 + 7,700 =
     45,950 base-token equivalents; 120 calls = 5,514,000; at $2 per million, $11.028, shown $11.03.
     Caching off: 38,300 x 120 = 4,596,000, $9.192, shown $9.19.
   - A September night (the inspector's wall: system prompt, case file, both statements, the box and street
     photographs, tonight's conversation, the question; standing parts first): 10,700 tokens; 9,100 before
     the breakpoint. Call 1 writes: 9,100 x 1.25 + 1,600 = 12,975. Calls 2 to 120 read: 910 + 1,600 = 2,510
     each, 298,690. Total 311,665, $0.62333, shown $0.62. Cache reads 119 x 9,100 = 1,082,900 of 1,284,000
     input tokens, 84 percent. $11.028 / $0.62333 = 17.7: nearly eighteen times.
   - The OP's reply to u/gradient_ghost: card 9 of 14, tokens 18,400 to 19,000 of 38,300; 10,400 needed
     against 27,900; the notes 9,600 tokens, 14 mentions; 84 percent cache reads in September, none last
     night; all 120 calls wrote 30,600 tokens.
   - Reply option A (pin everything but the notes, question first): 28,700 tokens, 18,300 not needed; the
     photograph at tokens 8,800 to 9,400, midpoint 0.317, the first third; no name. Every call writes
     21,000: (26,250 + 7,700) x 120 = 4,074,000, $8.148, shown $8.15. No reads.
   - Option B (only what the question needs, standing parts first): system prompt, case file, both
     statements, the foyer photograph, tonight's conversation, the question: 10,400 tokens; the photograph
     at 8,200 to 8,800, midpoint 0.817, the last third; nothing not needed, so Fenwick Ledwith, on all 120
     calls. 8,800 before the breakpoint: 12,600 + 119 x 2,480 = 307,720, $0.61544, shown $0.62. Reads
     1,047,200 of 1,248,000, 84 percent.
   - Option C (pin everything, re-pinned every call: the nine wall cards move the top card to the bottom on
     each call): 30,500 before the breakpoint, different on every call, so 120 writes and no reads:
     (38,125 + 7,800) x 120 = 5,511,000, $11.022, shown $11.02, more than $9.19 with caching off. The
     photograph sits in the first third when the box, the photograph itself, or Brask's or Fenwick's
     statement is on top, the middle third when the case file or the notes are, and the last third when
     Orrin Street, the takings book or the clippings are. The period is 9 calls and 120 = 13 x 9 + 3, so:
     first third 14 + 13 x 3 = 53 calls, middle 14 + 14 = 28, last 13 x 3 = 39. Not needed is 27,900 on
     every call, so Mr Brask 120 times.
   - Option D (pin everything, standing parts first): 38,300 tokens; the photograph at 18,300 to 18,900,
     midpoint 0.486, the middle third, Mr Brask. 30,500 before the breakpoint: 45,925 + 119 x 10,850 =
     1,337,075, $2.67415, shown $2.67. Reads 3,629,500 of 4,596,000, 79 percent.
   - tryThis and the explanation: the needed cards with Gideon's order: the photograph at 8,300 to 8,900,
     the last third, right; 8,900 before the breakpoint with the question among them, so every call writes:
     (11,125 + 1,500) x 120 = 1,515,000, $3.03; caching off 1,248,000, $2.496, shown $2.50. The needed
     cards re-pinned every call: four wall cards, so the photograph is in the middle third whenever Brask's
     statement is on top, one call in four: right on 90 of 120; 120 writes, 12,600 x 120 = 1,512,000,
     $3.024, shown $3.02. Budget 9,000 with trimming on: tonight's conversation is trimmed, 8,900 sent,
     still right. Budget 8,000: still 8,900 after trimming the history, so nothing is sent. Pin everything
     at a 35,000 budget: September's conversation is trimmed, 32,100 sent.
   - Teaching values: the price is $2 per million input tokens (the teaching price of case 9 and case 1 of
     this season). The multipliers are Anthropic's documented ones (pricing page, read 7 October 2026): a
     5-minute cache write costs 1.25 times the base input price and a cache read 0.1 times, the standard
     read multiplier. The minimum cacheable length here is 1,024 tokens, one of the documented minimums
     (512 to 4,096 depending on the model). Calls are 3 minutes apart, inside the documented 5-minute
     lifetime, which every read refreshes; 120 calls is six hours. Hourly calls were not used: they fall
     outside the default 5-minute lifetime, and sit on the edge of the 1-hour option, whose lifetime is
     measured from the start of the request, so no call could ever read the cache. For the same reason the
     re-pinned order changes on every call, not every hour: an hourly re-pin with calls minutes apart would
     still read within each hour. The 8,000-token limit and the thirds are the teaching rule, not a
     measurement.
   - Story-only numbers, not computed: the Alcazar closed in 1991; the last reel ran out at 23:58; the
     foyer clock reads 23:40; Mr Brask took a coffee up at 23:30 and is 81 now; the 1985 review; the reply
     at 02:14. The sim clock starts at six in the morning (START_CLOCK), when Wilmer opens the request.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed;
     every number is worked out the moment a control changes.
   - The answer is a teaching rule, not a model: right only when the foyer photograph is in the request,
     not in its middle third, and no more than 8,000 tokens are not needed; otherwise Mr Brask when DS
     Pennick's notes are in, or no name. It leaves out where the question sits, which Anthropic's tests
     say matters too.
   - Trimming drops whole history cards, September's conversation first, then tonight's. It never drops a
     pinned wall card, the system prompt or the question: a request that still doesn't fit is not sent.
   - Caching: one breakpoint, after the last system-prompt or wall card in the order sent. A call reads
     the cache only when everything up to the breakpoint matches the previous call's exactly and is at
     least 1,024 tokens; otherwise it writes. Cards that change every call (tonight's conversation, the
     question) are stamped with the call number, so a prefix that holds one never matches. Costs are kept
     in hundredths of a base token (1x = 100, a write 125, a read 10) so the sums stay whole numbers.
   - No random numbers anywhere: re-pinned every call is a fixed rule (the top wall card goes to the
     bottom), so the sim is fully deterministic.
   - Stats get bare numbers (units live in the labels).
   - Colors come only from theme classes: dg, dg-node with st-ok, st-bad, st-accent and st-muted (cards),
     dg-label, dg-sub, dg-meta, dot with dot-ok, dot-bad, dot-accent and dot-req (the bar), dg-axis,
     dg-edge and dg-note with tone-ok, tone-bad, tone-muted and tone-accent, mark-ok, mark-no, muted,
     small, table-wrap. Fonts and spacing use style attributes, never colors.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 6 * 3600;        // six in the morning: Wilmer opens the 02:14 request
  var YEAR = 1983;                   // the night Casimir Ledwith left the projection box
  var CLOSED = 1991;                 // the Alcazar closed
  var REVIEW = 1985;                 // the review that set DS Pennick's notes aside
  var REEL_OUT = "23:58";            // the last reel ran out
  var PHOTO_CLOCK = "23:40";         // the foyer clock in Gideon's print
  var COFFEE = "23:30";              // Mr Brask took a coffee up
  var INCIDENT = "02:14";            // the reply that named Mr Brask
  var BRASK_AGE = 81;
  var MENTIONS = 14;                 // DS Pennick's notes name Mr Brask 14 times
  var TURNS = 10;                    // tonight's conversation is kept to its last ten turns

  var BUDGET0 = 60000, BUDGET_MIN = 1000, BUDGET_MAX = 60000, BUDGET_STEP = 1000;
  var CALLS0 = 120, CALLS_MIN = 1, CALLS_MAX = 200;
  var GAP_MIN = 3;                   // minutes between calls
  var LIFETIME_MIN = 5;              // Anthropic's default cache lifetime, refreshed by every read
  var PRICE = 2;                     // teaching price: dollars per million input tokens
  var BASE = 100, WRITE = 125, READ = 10;   // hundredths of the base price: 1x, a 5-minute write 1.25x, a read 0.1x
  var MIN_CACHE = 1024;              // one documented minimum cacheable length (512 to 4,096 by model)
  var NOISE_LIMIT = 8000;            // teaching rule: tokens not needed before the answer goes wrong

  // The wall, in the order the cards were pinned (Gideon's box-by-box order). kind: system (the system
  // prompt), doc (a wall card), history (a saved conversation), question. needed: bears on the 02:14
  // question (the sim knows; the app wouldn't). changes: different on every call.
  var CARDS = [
    { id: "rules", kind: "system", label: "Instructions", tokens: 700, needed: true,
      name: "the standing instructions",
      says: "Answer only from the cards, name the card behind every fact, and say so when the wall doesn't settle it." },
    { id: "examples", kind: "system", label: "Worked answers", tokens: 900, needed: true,
      name: "two worked answers",
      says: "Two questions from earlier cases, each answered from named cards." },
    { id: "casefile", kind: "doc", label: "Case file", tokens: 4200, needed: true,
      name: "the case file",
      says: "Casimir Ledwith, projectionist, left the projection box during the late show in February 1983. His last reel ran out at 23:58." },
    { id: "notes", kind: "doc", label: "Pennick's notes", tokens: 9600, needed: false,
      name: "DS Pennick's notes",
      says: "Last seen by the usher, Emrys Brask, who took him a coffee at 23:30. They name Mr Brask 14 times. The 1985 review set them aside." },
    { id: "brask", kind: "doc", label: "Brask statement", tokens: 1300, needed: true,
      name: "Emrys Brask's statement",
      says: "Took a coffee up at 23:30, then sold tickets for the midnight show at the kiosk." },
    { id: "fenwick", kind: "doc", label: "Fenwick statement", tokens: 1100, needed: true,
      name: "Fenwick Ledwith's statement",
      says: "His brother: spent that evening at home in Dunmore." },
    { id: "box", kind: "doc", label: "Photo: the box", tokens: 500, needed: false,
      name: "the photograph of the projection box",
      says: "The box as found: the reel still turning, a cold cup of coffee, his cardigan on the chair." },
    { id: "foyer", kind: "doc", label: "Photo: the foyer", tokens: 600, needed: true, key: true,
      name: "the foyer photograph",
      says: "The clock at 23:40. Mr Brask at the ticket kiosk. Through the side door, Casimir with a man in a houndstooth overcoat. Pencil on the back: C. L. and his brother, side door." },
    { id: "street", kind: "doc", label: "Photo: Orrin St", tokens: 400, needed: false,
      name: "the photograph of Orrin Street",
      says: "Orrin Street at midnight, from the next day's paper: a wet road and the queue for the midnight show." },
    { id: "takings", kind: "doc", label: "Takings book", tokens: 3400, needed: false,
      name: "the takings book",
      says: "The box office takings for February 1983, night by night." },
    { id: "clippings", kind: "doc", label: "Clippings", tokens: 7800, needed: false,
      name: "the newspaper clippings",
      says: "Anniversary pieces from 1983 to 2008." },
    { id: "september", kind: "history", label: "September chat", tokens: 6200, needed: false,
      name: "September's saved conversation",
      says: "The volunteers' questions and answers about another case, saved and never cleared." },
    { id: "tonight", kind: "history", label: "Tonight's chat", tokens: 1500, needed: true, changes: true,
      name: "tonight's conversation",
      says: "Tonight's questions and answers about the same night, kept to the last ten turns." },
    { id: "question", kind: "question", label: "The question", tokens: 100, needed: true, changes: true,
      name: "the question",
      says: "Who was the last person seen with Casimir Ledwith?" }
  ];
  var OPTIONAL = CARDS.filter(function (c) { return c.id !== "question"; }).map(function (c) { return c.id; });

  var WALLS = {
    everything: { name: "Pin everything (Gideon's wall)", short: "Gideon's wall", pins: OPTIONAL.slice() },
    september: { name: "The inspector's September wall", short: "September's wall",
      pins: ["rules", "examples", "casefile", "brask", "fenwick", "box", "street", "tonight"] },
    needed: { name: "Only what the question needs", short: "The needed cards",
      pins: ["rules", "examples", "casefile", "brask", "fenwick", "foyer", "tonight"] }
  };
  var WALL_KEYS = ["everything", "september", "needed"];

  var ORDERS = {
    question: "Question first, after the system prompt (Gideon's)",
    stable: "Standing parts first, question last",
    shuffle: "Re-pinned in a new order every call"
  };
  var ORDER_SHORT = { question: "question first", stable: "standing parts first", shuffle: "re-pinned every call" };
  var ORDER_KEYS = ["question", "stable", "shuffle"];

  var ANSWERS = {
    right: "Fenwick Ledwith, his brother: the foyer photograph, side door, 23:40, and the pencil note on its back.",
    wrong: "Emrys Brask, the usher: he took Mr Ledwith a coffee at 23:30 (DS Pennick's notes, 1983).",
    unsure: "The wall doesn't settle who was last seen with him.",
    refused: "Nothing was sent: the request is over the budget."
  };
  var SAYS = { right: "names Fenwick Ledwith", wrong: "names Mr Brask", unsure: "names nobody", refused: "sends nothing" };
  var THIRD = { beginning: "first", middle: "middle", end: "last" };

  /* ---------- the request: which cards, in what order ---------- */

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function card(id) {
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
    return null;
  }

  function sum(list) { return list.reduce(function (t, c) { return t + c.tokens; }, 0); }

  function pinSet(ids) {
    var p = {};
    ids.forEach(function (id) { if (card(id)) p[id] = true; });
    p.question = true;
    return p;
  }

  // The cards that go in, after trimming. Trimming drops whole history cards (September's conversation,
  // then tonight's) until the request fits. It never drops a pinned wall card, the system prompt or the
  // question: a request that still doesn't fit is not sent at all.
  function build(pins, budget, trim) {
    var sel = CARDS.filter(function (c) { return c.id === "question" || !!pins[c.id]; });
    var total = sum(sel), trimmed = [];
    if (total > budget && trim) {
      ["september", "tonight"].forEach(function (id) {
        var c = card(id);
        if (total <= budget || sel.indexOf(c) < 0) return;
        sel = sel.filter(function (x) { return x !== c; });
        total -= c.tokens;
        trimmed.push(id);
      });
    }
    var refused = total > budget;
    return { sel: refused ? [] : sel, trimmed: trimmed, refused: refused, wanted: total };
  }

  // The order sent on call k (0-based). The system prompt always comes first: it has its own slot.
  function orderFor(sel, mode, k) {
    var sys = sel.filter(function (c) { return c.kind === "system"; });
    var docs = sel.filter(function (c) { return c.kind === "doc"; });
    var hist = sel.filter(function (c) { return c.kind === "history"; });
    var q = sel.filter(function (c) { return c.kind === "question"; });
    if (mode === "question") return sys.concat(q, docs, hist);
    if (mode === "shuffle" && docs.length > 1) {
      var r = k % docs.length;
      docs = docs.slice(r).concat(docs.slice(0, r));   // the top wall card goes to the bottom, every call
    }
    return sys.concat(docs, hist, q);
  }

  // Where the foyer photograph sits: by the midpoint of its tokens, in thirds of the whole request.
  function positionOf(req) {
    var total = sum(req), start = 0, i;
    for (i = 0; i < req.length; i++) {
      if (req[i].key) {
        var mid2 = 2 * start + req[i].tokens;
        var pos = mid2 * 3 < 2 * total ? "beginning" : mid2 * 3 > 4 * total ? "end" : "middle";
        return { pos: pos, start: start, end: start + req[i].tokens, index: i + 1, count: req.length, total: total };
      }
      start += req[i].tokens;
    }
    return { pos: "absent", start: -1, end: -1, index: 0, count: req.length, total: total };
  }

  function noiseOf(req) { return sum(req.filter(function (c) { return !c.needed; })); }

  // The teaching rule (not a model).
  function answerOf(req) {
    if (!req.length) return "refused";
    var p = positionOf(req).pos;
    if (p !== "absent" && p !== "middle" && noiseOf(req) <= NOISE_LIMIT) return "right";
    if (req.some(function (c) { return c.id === "notes"; })) return "wrong";
    return "unsure";
  }

  // Everything up to the cache breakpoint: after the last system-prompt or wall card in the order sent.
  function prefixOf(req, k) {
    var bp = -1, i;
    for (i = 0; i < req.length; i++) if (req[i].kind === "system" || req[i].kind === "doc") bp = i;
    var items = req.slice(0, bp + 1);
    return { bp: bp, tokens: sum(items), items: items,
      key: items.map(function (c) { return c.changes ? c.id + "@" + k : c.id; }).join("|") };
  }

  // One night of calls, three minutes apart.
  function night(cfg) {
    var b = build(cfg.pins, cfg.budget, cfg.trim);
    var out = { b: b, calls: [], cu: 0, cuOff: 0, reads: 0, writes: 0, readTokens: 0, input: 0, right: 0, share: 0,
      tally: { beginning: 0, middle: 0, end: 0, absent: 0 } };
    if (b.refused) return out;
    var prevKey = null, k;
    for (k = 0; k < cfg.calls; k++) {
      var req = orderFor(b.sel, cfg.order, k), total = sum(req), pre = prefixOf(req, k), pos = positionOf(req);
      var kind = "none";
      if (cfg.cache && pre.bp >= 0 && pre.tokens >= MIN_CACHE) kind = prevKey !== null && pre.key === prevKey ? "read" : "write";
      var cu = kind === "read" ? pre.tokens * READ + (total - pre.tokens) * BASE :
        kind === "write" ? pre.tokens * WRITE + (total - pre.tokens) * BASE : total * BASE;
      prevKey = kind === "none" ? null : pre.key;
      var ans = answerOf(req);
      out.calls.push({ k: k, req: req, total: total, prefix: pre, kind: kind, cu: cu, pos: pos, answer: ans });
      out.cu += cu;
      out.cuOff += total * BASE;
      out.input += total;
      if (kind === "read") { out.reads++; out.readTokens += pre.tokens; }
      if (kind === "write") out.writes++;
      if (ans === "right") out.right++;
      out.tally[pos.pos]++;
    }
    out.share = out.input ? Math.round(100 * out.readTokens / out.input) : 0;
    return out;
  }

  /* ---------- money and words ---------- */

  function cents(cu) { return Math.round(cu * PRICE / (BASE * 10000)); }
  function money(cu) {
    var c = cents(cu), r = c % 100;
    return Math.floor(c / 100) + "." + (r < 10 ? "0" : "") + r;
  }
  function dollars(cu) { return "$" + money(cu); }

  function num(n) {
    var s = String(Math.round(n)), out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function listText(a) {
    if (!a.length) return "none";
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function sameSet(a, b) {
    return OPTIONAL.every(function (id) { return !!a[id] === !!b[id]; });
  }

  function matchWall(pins) {
    for (var i = 0; i < WALL_KEYS.length; i++) if (sameSet(pins, pinSet(WALLS[WALL_KEYS[i]].pins))) return WALL_KEYS[i];
    return "custom";
  }

  function wallShort(S) { return S.wall === "custom" ? "Your wall" : WALLS[S.wall].short; }

  function cfgOf(S, cache) {
    return { pins: S.pins, order: S.order, budget: S.budget, trim: S.trim, cache: cache, calls: S.calls };
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
      "Token counts are teaching values made up for the case, and the sim knows which cards bear on the 02:14 question; " +
      "your app wouldn't. The answer is a teaching rule, not a model. Prices are teaching values with Anthropic's documented multipliers."));

    box.appendChild(head("The wall: press a card to pin or unpin it"));
    var wall = mk(doc, "svg", { viewBox: "0 0 660 284", width: "100%", "class": "dg", role: "group",
      "aria-label": "The evidence wall. Each card is a button that pins or unpins it; the question is always sent." });
    box.appendChild(wall);
    var cards = {}, metas = {};
    CARDS.forEach(function (c, i) {
      var col = i % 4, row = Math.floor(i / 4), x = 12 + col * 162, y = 12 + row * 68, cx = x + 75, cy = y + 28;
      var g = mk(doc, "g", { "class": "dg-node", "data-card": c.id }, wall);
      mk(doc, "rect", { x: x, y: y, width: 150, height: 56, rx: 4 }, g);
      txt(doc, g, cx, cy - 9, c.label, "dg-label", "middle");
      txt(doc, g, cx, cy + 6, num(c.tokens) + " tokens", "dg-sub", "middle");
      metas[c.id] = txt(doc, g, cx, cy + 21, "", "dg-meta", "middle");
      if (c.id !== "question") {
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.addEventListener("click", function () { togglePin(api, c.id); });
        g.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
          if (typeof e.preventDefault === "function") e.preventDefault();
          togglePin(api, c.id);
        });
      }
      cards[c.id] = g;
    });

    box.appendChild(head("The request at call 1, in the order sent"));
    var strip = mk(doc, "svg", { viewBox: "0 0 660 92", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(strip);

    box.appendChild(head("What the assistant gets"));
    var sentLine = el("p", "", "margin:0;font-size:13px;", "");
    var keyLine = el("p", "", "margin:0;font-size:13px;", "");
    var noiseLine = el("p", "", "margin:0;font-size:13px;", "");
    var answerLine = el("p", "", "margin:0;font-size:13px;", "");
    answerLine.setAttribute("aria-live", "polite");
    var cacheLine = el("p", "", "margin:0;font-size:13px;", "");
    [sentLine, keyLine, noiseLine, answerLine, cacheLine].forEach(function (p) { box.appendChild(p); });

    var runHead = head("");
    box.appendChild(runHead);
    var wrap = el("div", "table-wrap", "", "");
    var table = el("table", "", "font-size:12px;", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["", "cache writes", "cache reads", "read from cache", "night's input cost"].forEach(function (h) {
      hr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var runBody = el("tbody", "", "", "");
    table.appendChild(runBody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var runNote = el("p", "", "margin:0;font-size:13px;", "");
    runNote.setAttribute("aria-live", "polite");
    box.appendChild(runNote);

    api.root.appendChild(box);
    return { doc: doc, el: el, wall: wall, cards: cards, cardMeta: metas, strip: strip, sentLine: sentLine, keyLine: keyLine,
      noiseLine: noiseLine, answerLine: answerLine, cacheLine: cacheLine, runHead: runHead, runBody: runBody, runNote: runNote };
  }

  /* ---------- drawing ---------- */

  function cardState(S, c) {
    if (c.id === "question") return { cls: "", meta: "always sent" };
    if (!S.pins[c.id]) return { cls: "st-muted", meta: "unpinned" };
    if (S.res.b.trimmed.indexOf(c.id) >= 0) return { cls: "st-muted", meta: "trimmed" };
    if (!c.needed) return { cls: "st-bad", meta: "not needed" };
    return { cls: c.key ? "st-accent" : "st-ok", meta: c.key ? "the key card" : "needed" };
  }

  function drawWall(S) {
    var ui = S.ui;
    CARDS.forEach(function (c) {
      var g = ui.cards[c.id], s = cardState(S, c);
      g.setAttribute("class", "dg-node" + (s.cls ? " " + s.cls : ""));
      ui.cardMeta[c.id].textContent = s.meta;
      if (c.id !== "question") g.setAttribute("aria-pressed", S.pins[c.id] ? "true" : "false");
      g.setAttribute("aria-label", cap(c.name) + ", " + num(c.tokens) + " tokens, " + s.meta + ". " + c.says);
    });
  }

  function bracketText(S) {
    var r = S.res, pre = r.calls[0].prefix;
    if (!S.cache) return "caching off: every token at the base price";
    if (pre.tokens < MIN_CACHE) return "before the breakpoint: " + num(pre.tokens) + " tokens, under the " + num(MIN_CACHE) + " minimum";
    if (r.reads > 0) return "cached prefix, " + num(pre.tokens) + " tokens: read on " + r.reads + " of " + S.calls + " calls";
    return "up to the breakpoint, " + num(pre.tokens) + " tokens: written " + r.writes + " times, never read";
  }

  function drawStrip(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.strip, X0 = 12, W = 636, Y = 22, H = 26, r = S.res;
    clear(svg);
    if (r.b.refused) {
      txt(doc, svg, 330, 50, "Not sent: over the budget", "dg-note tone-bad", "middle");
      svg.setAttribute("aria-label", "Nothing is sent: the request is over the budget.");
      return;
    }
    var c0 = r.calls[0], req = c0.req, total = c0.total, x = X0, k;
    for (k = 1; k <= 2; k++) {
      var tx = (X0 + W * k / 3).toFixed(2);
      mk(doc, "path", { d: "M" + tx + " " + (Y - 4) + " V " + (Y + H + 4), "class": "dg-axis", "stroke-dasharray": "3 3" }, svg);
    }
    ["first third", "middle third", "last third"].forEach(function (s, i) {
      txt(doc, svg, (X0 + W * (2 * i + 1) / 6).toFixed(2), 12, s, "dg-axis", "middle", "font-size:10px;");
    });
    req.forEach(function (c) {
      var w = W * c.tokens / total;
      var cls = c.key ? "dot dot-accent" : c.kind === "question" ? "dot dot-req" : c.needed ? "dot dot-ok" : "dot dot-bad";
      mk(doc, "rect", { x: (x + 0.5).toFixed(2), y: Y, width: Math.max(0.5, w - 1).toFixed(2), height: H, "class": cls }, svg);
      if (c.key) txt(doc, svg, (x + w / 2).toFixed(2), Y + H + 13, "foyer photo", "dg-note tone-accent", "middle", "font-size:11px;");
      x += w;
    });
    var pre = c0.prefix;
    if (pre.bp >= 0) {
      var px = (X0 + W * pre.tokens / total).toFixed(2), by = Y + H + 22;
      var tone = !S.cache || pre.tokens < MIN_CACHE ? "tone-muted" : r.reads > 0 ? "tone-ok" : "tone-bad";
      mk(doc, "path", { d: "M" + X0 + " " + (by - 4) + " V " + by + " H " + px + " V " + (by - 4), "class": "dg-edge " + tone }, svg);
      txt(doc, svg, X0, by + 14, bracketText(S), "dg-note " + tone, "start", "font-size:11px;");
    }
    svg.setAttribute("aria-label", "The request at call 1, " + num(total) + " tokens in " + req.length + " cards, in this order: " +
      req.map(function (c) { return c.name; }).join(", ") + ". " + keyText(S));
  }

  function sentText(S) {
    var b = S.res.b, names = b.trimmed.map(function (id) { return card(id).name; });
    if (b.refused) {
      if (names.length) {
        return "Not sent: even after trimming " + listText(names) + ", the request is " + num(b.wanted) + " tokens, over the " +
          num(S.budget) + "-token budget. Pinned cards are never trimmed: unpin one or raise the budget.";
      }
      return "Not sent: the request is " + num(b.wanted) + " tokens, over the " + num(S.budget) + "-token budget" +
        (S.trim ? "." : ", and trimming is off.");
    }
    var c0 = S.res.calls[0];
    return "Sent on every call: " + c0.req.length + " cards, " + num(c0.total) + " tokens of the " + num(S.budget) +
      "-token budget" + (names.length ? ", after trimming " + listText(names) : "") + ".";
  }

  function keyText(S) {
    var r = S.res;
    if (r.b.refused) return "Nothing is sent.";
    var p = r.calls[0].pos;
    if (p.pos === "absent") return "The foyer photograph is not in the request.";
    return "The foyer photograph, call 1: card " + p.index + " of " + p.count + ", tokens " + num(p.start) + " to " + num(p.end) +
      " of " + num(p.total) + ", in the " + THIRD[p.pos] + " third.";
  }

  function noiseText(S) {
    var r = S.res;
    if (r.b.refused) return "";
    var c0 = r.calls[0];
    return num(noiseOf(c0.req)) + " of " + num(c0.total) + " tokens are not needed for this question (the teaching rule allows " +
      num(NOISE_LIMIT) + ").";
  }

  function cacheText(S) {
    var r = S.res;
    if (r.b.refused) return "";
    if (!S.cache) return "Caching is off: every token on every call is billed at the base price.";
    var pre = r.calls[0].prefix;
    if (pre.bp < 0) return "No cache breakpoint: nothing stands before the conversation to reuse.";
    if (pre.tokens < MIN_CACHE) return "The " + num(pre.tokens) + " tokens before the cache breakpoint are under the " + num(MIN_CACHE) +
      "-token minimum, so nothing is cached.";
    var moving = pre.items.filter(function (c) { return c.changes; }).map(function (c) { return c.name; });
    return "Cache breakpoint after card " + (pre.bp + 1) + ", the end of the wall: " + num(pre.tokens) + " tokens before it" +
      (moving.length ? ", " + listText(moving) + " among them" : "") + ". Written " + r.writes + " times and read " + r.reads +
      " times in " + S.calls + " calls.";
  }

  function runText(S) {
    var r = S.res;
    if (r.b.refused) return "Nothing is sent on any of the " + S.calls + " calls.";
    var s = "Right answers: " + r.right + " of " + S.calls + " calls.";
    if (S.order === "shuffle" && !r.tally.absent) {
      s += " The photograph sat in the first third on " + r.tally.beginning + " calls, the middle third on " + r.tally.middle +
        " and the last third on " + r.tally.end + ".";
    }
    return s;
  }

  function drawReadout(S) {
    var ui = S.ui, r = S.res, a = r.b.refused ? "refused" : r.calls[0].answer;
    ui.sentLine.textContent = sentText(S);
    ui.sentLine.className = r.b.refused ? "mark-no" : "";
    ui.keyLine.textContent = keyText(S);
    ui.noiseLine.textContent = noiseText(S);
    ui.answerLine.textContent = "Answer, call 1 (teaching rule): " + ANSWERS[a];
    ui.answerLine.className = a === "right" ? "mark-ok" : a === "unsure" ? "muted" : "mark-no";
    ui.cacheLine.textContent = cacheText(S);
  }

  function drawRun(S) {
    var ui = S.ui, on = S.on, el = ui.el;
    ui.runHead.textContent = "A night of " + S.calls + (S.calls === 1 ? " call" : " calls") + ", " + GAP_MIN + " minutes apart";
    clear(ui.runBody);
    [["Caching off", "0", "0", "0 percent", dollars(on.cuOff)],
      ["Caching on", String(on.writes), String(on.reads), on.share + " percent", dollars(on.cu)]].forEach(function (row, i) {
      var tr = el("tr", "", (i === 1) === S.cache ? "font-weight:600;" : "", "");
      row.forEach(function (v) { tr.appendChild(el("td", "", "padding:2px 6px;white-space:nowrap;", v)); });
      ui.runBody.appendChild(tr);
    });
    ui.runNote.textContent = runText(S);
  }

  function drawStats(S) {
    var r = S.res, c0 = r.b.refused ? null : r.calls[0];
    S.stat.tokens(c0 ? c0.total : 0);
    S.stat.noise(c0 ? noiseOf(c0.req) : 0);
    S.stat.where(c0 ? c0.pos.pos : "not sent");
    S.stat.right(r.right);
    S.stat.reads(r.reads);
    S.stat.cost(money(r.cu));
    S.stat.costOff(money(r.cuOff));
  }

  function draw(api) {
    var S = api.state;
    S.on = night(cfgOf(S, true));
    S.res = S.cache ? S.on : night(cfgOf(S, false));
    drawWall(S);
    drawStrip(S);
    drawReadout(S);
    drawRun(S);
    drawStats(S);
  }

  /* ---------- narration and controls ---------- */

  function summary(S) {
    var r = S.res, head = wallShort(S) + ", " + ORDER_SHORT[S.order] + ": ";
    if (r.b.refused) return head + "not sent, over the " + num(S.budget) + "-token budget.";
    var c0 = r.calls[0];
    var where = c0.pos.pos === "absent" ? "the photograph not pinned" : "the photograph in the " + THIRD[c0.pos.pos] + " third";
    return head + num(c0.total) + " tokens, " + where + "; call 1 " + SAYS[c0.answer] + ". The night: " + dollars(S.on.cu) +
      " with caching, " + dollars(S.on.cuOff) + " without.";
  }

  function toneOf(S) {
    var r = S.res;
    if (r.b.refused) return "bad";
    var a = r.calls[0].answer;
    return a === "right" ? "ok" : a === "unsure" ? "warn" : "bad";
  }

  function setWall(api, v) {
    var S = api.state;
    if (!own(WALLS, v)) return;
    S.pins = pinSet(WALLS[v].pins);
    S.wall = v;
    draw(api);
    api.log(summary(S), toneOf(S));
  }

  function togglePin(api, id) {
    var S = api.state, c = card(id);
    if (!c || id === "question") return;
    S.pins[id] = !S.pins[id];
    S.wall = matchWall(S.pins);
    S.ctl.wall.set(S.wall);
    draw(api);
    api.log((S.pins[id] ? "Pinned " : "Unpinned ") + c.name + ". " + summary(S), toneOf(S));
  }

  function setOrder(api, v) {
    var S = api.state;
    if (!own(ORDERS, v)) return;
    S.order = v;
    draw(api);
    api.log(summary(S), toneOf(S));
  }

  function setBudget(api, v) {
    var S = api.state, n = Math.round(Number(v));
    if (!(n >= BUDGET_MIN && n <= BUDGET_MAX)) return;
    S.budget = n;
    draw(api);
    api.log("Budget " + num(n) + " tokens. " + summary(S), toneOf(S));
  }

  function setTrim(api, v) {
    var S = api.state;
    S.trim = !!v;
    draw(api);
    api.log("Trimming " + (S.trim ? "on" : "off") + ". " + summary(S), toneOf(S));
  }

  function setCache(api, v) {
    var S = api.state;
    S.cache = !!v;
    draw(api);
    api.log("Prompt caching " + (S.cache ? "on" : "off") + ": the night costs " + dollars(S.res.cu) + ", with " + S.res.reads +
      " cache reads.", S.cache && S.res.reads > 0 ? "ok" : "warn");
  }

  function setCalls(api, v) {
    var S = api.state, n = Math.round(Number(v));
    if (!(n >= CALLS_MIN && n <= CALLS_MAX)) return;
    S.calls = n;
    draw(api);
    api.log(n + (n === 1 ? " call" : " calls") + ": " + dollars(S.on.cu) + " with caching, " + dollars(S.on.cuOff) + " without.", "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e04", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.wall = "everything";
      S.pins = pinSet(WALLS.everything.pins);
      S.order = "question";
      S.budget = BUDGET0;
      S.trim = true;
      S.cache = true;
      S.calls = CALLS0;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.wall = api.control.select("wall", "Wall", WALL_KEYS.map(function (k) {
        return { value: k, label: WALLS[k].name };
      }).concat([{ value: "custom", label: "Your own (press the cards)" }]), "everything", function (v) { setWall(api, v); });
      S.ctl.order = api.control.select("order", "Order of the request", ORDER_KEYS.map(function (k) {
        return { value: k, label: ORDERS[k] };
      }), "question", function (v) { setOrder(api, v); });
      S.ctl.budget = api.control.range("budget", "Budget per request (tokens)", BUDGET_MIN, BUDGET_MAX, BUDGET_STEP, BUDGET0,
        function (v) { setBudget(api, v); }, { format: function (v) { return num(v); } });
      S.ctl.trim = api.control.toggle("trim", "Trim the history to fit the budget", true, function (v) { setTrim(api, v); });
      S.ctl.cache = api.control.toggle("cache", "Prompt caching", true, function (v) { setCache(api, v); });
      S.ctl.calls = api.control.range("calls", "Calls in the night, 3 minutes apart", CALLS_MIN, CALLS_MAX, 1, CALLS0,
        function (v) { setCalls(api, v); });
      S.ctl.reset = api.control.button("reset", "Reset to 02:14", function () { api.reset(); });

      S.stat = {
        tokens: api.stat("tokens", "tokens sent per call", ""),
        noise: api.stat("noise", "tokens not needed for the question", "bad"),
        where: api.stat("where", "foyer photograph, call 1", "warn"),
        right: api.stat("right", "right answers in the night", "ok"),
        reads: api.stat("reads", "cache reads in the night", "ok"),
        cost: api.stat("cost", "night's input cost, as set ($)", "warn"),
        costOff: api.stat("costOff", "same night, caching off ($)", "")
      };

      api.info("<strong>How to read it.</strong> The wall shows every card the app can send. Green cards bear on the 02:14 question, " +
        "red ones don't, amber is the foyer photograph; the sim knows which, your app wouldn't. The bar below is the request at call 1 " +
        "in the order sent, cut into thirds, and the bracket under it marks everything up to the cache breakpoint. The answer is a " +
        "teaching rule, not a model: right only when the photograph is in, outside the middle third, and no more than 8,000 tokens are " +
        "not needed; otherwise Mr Brask if DS Pennick's notes are in, or no name. Trimming drops only the history, oldest first. A cache " +
        "read needs everything up to the breakpoint to match the previous call exactly, at least 1,024 tokens of it. Prices are teaching " +
        "values: $2 per million input tokens, a cache write at 1.25 times that and a read at 0.1 times, Anthropic's documented multipliers.");
      draw(api);
      api.log("Six in the morning. " + summary(S), toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      function ids(req) { return req.map(function (c) { return c.id; }); }
      function cfg(pins, order, o) {
        o = o || {};
        return { pins: pinSet(pins), order: order, budget: own(o, "budget") ? o.budget : BUDGET0, trim: own(o, "trim") ? o.trim : true,
          cache: own(o, "cache") ? o.cache : true, calls: own(o, "calls") ? o.calls : CALLS0 };
      }
      function subset(m) { return OPTIONAL.filter(function (id, j) { return ((m >> j) & 1) === 1; }); }
      function press(node) {
        var ev = node.ownerDocument.createEvent("Event");
        ev.initEvent("click", true, true);
        node.dispatchEvent(ev);
      }
      var MASKS = 1 << OPTIONAL.length, ALL = WALLS.everything.pins, SEPT = WALLS.september.pins, NEED = WALLS.needed.pins;
      var NO_NOTES = ALL.filter(function (id) { return id !== "notes"; });
      var ok, m;

      // 1. The start: Gideon's request at 02:14.
      await t.run(1);
      var g = night(cfg(ALL, "question")), g0 = g.calls[0];
      t.expect(st().wall === "everything" && st().order === "question" && st().budget === BUDGET0 && st().calls === CALLS0 &&
        st().trim === true && st().cache === true &&
        t.stat("tokens") === 38300 && t.stat("noise") === 27900 && t.stat("where") === "middle" && t.stat("right") === 0 &&
        t.stat("reads") === 0 && t.stat("cost") === 11.03 && t.stat("costOff") === 9.19 &&
        g0.pos.index === 9 && g0.pos.count === 14 && g0.pos.start === 18400 && g0.pos.end === 19000 && g0.answer === "wrong" &&
        same(ids(g0.req).slice(0, 3), ["rules", "examples", "question"]) && g0.prefix.tokens === 30600 && g.writes === 120 && g.reads === 0 &&
        st().ui.keyLine.textContent.indexOf("card 9 of 14, tokens 18,400 to 19,000 of 38,300, in the middle third") >= 0 &&
        st().ui.answerLine.textContent.indexOf(ANSWERS.wrong) >= 0 && ANSWERS.wrong.indexOf("Emrys Brask") === 0 &&
        st().ui.cacheLine.textContent.indexOf("30,600 tokens before it, the question among them") >= 0 &&
        t.logText().indexOf("call 1 names Mr Brask") >= 0,
        "the start is Gideon's 02:14 request: 14 cards, 38,300 tokens, the question third; the foyer photograph is card 9 of 14 at tokens 18,400 to 19,000, the middle third; 27,900 tokens not needed; it names Mr Brask; 30,600 tokens up to the breakpoint, the question among them, written 120 times and never read: $11.03 a night, $9.19 with caching off");

      // 2. The budget: with trimming on, nothing over the budget is ever sent, and only the history is trimmed.
      ok = true;
      var budgets = [1000, 5000, 8000, 8900, 9000, 10400, 20000, 32100, 35000, 38300, 60000];
      for (m = 0; m < MASKS && ok; m++) {
        var pins = pinSet(subset(m)), want = sum(CARDS.filter(function (c) { return !!pins[c.id]; }));
        var hist = (pins.september ? 6200 : 0) + (pins.tonight ? 1500 : 0);
        budgets.forEach(function (bud) {
          [true, false].forEach(function (tr) {
            var b = build(pins, bud, tr), sent = sum(b.sel);
            if (tr && sent > bud) ok = false;
            if (b.refused !== (b.sel.length === 0)) ok = false;
            if (!tr && (b.trimmed.length || (want > bud) !== b.refused)) ok = false;
            if (tr && (want - hist <= bud) === b.refused) ok = false;
            b.trimmed.forEach(function (id) { if (card(id).kind !== "history") ok = false; });
            if (b.trimmed.indexOf("tonight") >= 0 && pins.september && b.trimmed.indexOf("september") < 0) ok = false;
            if (!b.refused) {
              CARDS.forEach(function (c) { if (pins[c.id] && c.kind !== "history" && b.sel.indexOf(c) < 0) ok = false; });
            }
          });
        });
      }
      var b9 = build(pinSet(NEED), 9000, true), b8 = build(pinSet(NEED), 8000, true), b35 = build(pinSet(ALL), 35000, true);
      t.expect(ok && sum(b9.sel) === 8900 && same(b9.trimmed, ["tonight"]) && answerOf(orderFor(b9.sel, "stable", 0)) === "right" &&
        b8.refused && b8.wanted === 8900 && sum(b35.sel) === 32100 && same(b35.trimmed, ["september"]) &&
        build(pinSet(ALL), 35000, false).refused,
        "the budget, over all 8,192 pin subsets, 11 budgets and trimming on or off: with trimming on nothing over the budget is sent; trimming drops only September's conversation and then tonight's, never a pinned wall card, the system prompt or the question; a request is refused exactly when what's left still doesn't fit; the needed cards at 9,000 trim tonight's conversation to 8,900 and stay right; at 8,000 nothing is sent; pin everything at 35,000 trims September's conversation to 32,100");

      // 3. A cache read happens if and only if everything up to the breakpoint matches the previous call's.
      ok = true;
      for (m = 0; m < MASKS && ok; m++) {
        ORDER_KEYS.forEach(function (ord) {
          var r3 = night(cfg(subset(m), ord, { calls: 4 })), prev = null;
          r3.calls.forEach(function (c, k) {
            var last = -1, j, parts = [], toks = 0;
            for (j = 0; j < c.req.length; j++) if (c.req[j].kind === "system" || c.req[j].kind === "doc") last = j;
            for (j = 0; j <= last; j++) { parts.push(c.req[j].changes ? c.req[j].id + "#" + k : c.req[j].id); toks += c.req[j].tokens; }
            var key = parts.join(","), cacheable = last >= 0 && toks >= MIN_CACHE, hit = cacheable && prev !== null && key === prev;
            if ((c.kind === "read") !== hit || (c.kind === "write") !== (cacheable && !hit)) ok = false;
            prev = cacheable ? key : null;
          });
        });
      }
      var sOn = night(cfg(ALL, "stable")), sOff = night(cfg(ALL, "stable", { cache: false })), tiny = night(cfg(["rules"], "stable"));
      t.expect(ok && sOn.reads === 119 && sOn.writes === 1 && g.reads === 0 && g.writes === 120 && sOff.reads === 0 && sOff.writes === 0 &&
        tiny.reads === 0 && tiny.writes === 0 && tiny.calls[0].total === 800 && tiny.calls[0].prefix.tokens === 700,
        "a cache read happens if and only if everything up to the breakpoint is identical to the previous call's and at least 1,024 tokens, checked independently over every subset and order: pin everything with the standing parts first reads on 119 of 120 calls; with the question first, never; with caching off nothing is read or written; 700 tokens before the breakpoint are never cached");

      // 4. Re-pinned every call: no reads at all, whenever the wall holds two or more cards.
      ok = true;
      for (m = 0; m < MASKS && ok; m++) {
        var sub = subset(m);
        if (sub.filter(function (id) { return card(id).kind === "doc"; }).length < 2) continue;
        var r4 = night(cfg(sub, "shuffle", { calls: 12 }));
        if (r4.reads !== 0) ok = false;
        for (var k4 = 1; k4 < r4.calls.length; k4++) {
          var top = r4.calls[k4].req.filter(function (c) { return c.kind === "doc"; })[0];
          var before = r4.calls[k4 - 1].req.filter(function (c) { return c.kind === "doc"; })[0];
          if (top === before) ok = false;
        }
      }
      var sh = night(cfg(ALL, "shuffle")), shN = night(cfg(NEED, "shuffle"));
      t.expect(ok && sh.reads === 0 && sh.writes === 120 && sh.tally.beginning === 53 && sh.tally.middle === 28 && sh.tally.end === 39 &&
        sh.right === 0 && sh.cu === 551100000 && dollars(sh.cu) === "$11.02" && sh.cu > sh.cuOff && dollars(sh.cuOff) === "$9.19" &&
        shN.right === 90 && shN.tally.middle === 30 && shN.reads === 0 && dollars(shN.cu) === "$3.02",
        "re-pinned in a new order every call: over every subset with two or more wall cards the top card changes on every call and the cache is never read; pin everything re-pinned writes 120 times, $11.02 against $9.19 with caching off, the photograph in the first third on 53 calls, the middle on 28 and the last on 39, and Mr Brask every time; the needed cards re-pinned are right on 90 of 120 for $3.02");

      // 5. The cost arithmetic, exactly.
      var sept = night(cfg(SEPT, "stable")), need = night(cfg(NEED, "stable")), optA = night(cfg(NO_NOTES, "question"));
      var optD = night(cfg(ALL, "stable")), needQ = night(cfg(NEED, "question")), needOff = night(cfg(NEED, "stable", { cache: false }));
      ok = true;
      for (m = 0; m < MASKS && ok; m += 3) {
        ORDER_KEYS.forEach(function (ord) {
          var r5 = night(cfg(subset(m), ord, { calls: 5 }));
          if (!r5.calls.length) return;
          var pt = r5.calls[0].prefix.tokens, tot = r5.calls[0].total, none = 5 - r5.reads - r5.writes;
          if (r5.calls.some(function (c) { return c.prefix.tokens !== pt || c.total !== tot; })) ok = false;
          if (r5.cu !== r5.writes * pt * WRITE + r5.reads * pt * READ + none * pt * BASE + 5 * (tot - pt) * BASE) ok = false;
          if (r5.cuOff !== 5 * tot * BASE) ok = false;
        });
      }
      t.expect(ok && g.cu === 551400000 && g.cuOff === 459600000 && dollars(g.cu) === "$11.03" && dollars(g.cuOff) === "$9.19" &&
        sept.cu === 31166500 && dollars(sept.cu) === "$0.62" && sept.share === 84 && sept.readTokens === 1082900 && sept.input === 1284000 &&
        need.cu === 30772000 && dollars(need.cu) === "$0.62" && need.share === 84 &&
        optA.cu === 407400000 && dollars(optA.cu) === "$8.15" && optA.reads === 0 &&
        optD.cu === 133707500 && dollars(optD.cu) === "$2.67" && optD.share === 79 &&
        needQ.cu === 151500000 && dollars(needQ.cu) === "$3.03" && needOff.cu === 124800000 && dollars(needOff.cu) === "$2.50" &&
        g.cu / sept.cu > 17.5 && g.cu / sept.cu < 18 && money(0) === "0.00" && cents(551400000) === 1103,
        "the cost arithmetic: every night equals writes x prefix x 1.25 + reads x prefix x 0.1 + the rest at the base price, checked over a third of the subsets in every order; Gideon's night $11.03 (551,400,000 hundredths of a base token) against $9.19 off; a September night $0.62 with 84 percent of input tokens read from the cache; the needed cards $0.62, 84 percent; option A $8.15; option D $2.67, 79 percent; the needed cards question first $3.03, off $2.50; Gideon's night is nearly eighteen times September's");

      // 6. Pin everything puts the photograph in the middle third, in either fixed order.
      var d0 = optD.calls[0];
      t.expect(g0.pos.pos === "middle" && d0.pos.pos === "middle" && d0.pos.start === 18300 && d0.pos.end === 18900 && d0.pos.index === 8 &&
        d0.answer === "wrong" && sum(CARDS) === 38300 && noiseOf(g0.req) === 27900 && optD.right === 0 && g.right === 0,
        "pin everything puts the foyer photograph in the middle third: card 9 of 14 at 18,400 to 19,000 with the question first, card 8 at 18,300 to 18,900 with the standing parts first, and Mr Brask on every call either way");

      // 7. Only what the question needs, standing parts first and the question last: the right answer.
      var n0 = need.calls[0], s0 = sept.calls[0], a0 = optA.calls[0];
      t.expect(n0.answer === "right" && n0.pos.pos === "end" && n0.pos.start === 8200 && n0.pos.end === 8800 && n0.total === 10400 &&
        noiseOf(n0.req) === 0 && need.right === 120 && need.reads === 119 && ANSWERS.right.indexOf("Fenwick Ledwith") === 0 &&
        same(ids(n0.req), ["rules", "examples", "casefile", "brask", "fenwick", "foyer", "tonight", "question"]) &&
        s0.pos.pos === "absent" && s0.answer === "unsure" && s0.total === 10700 &&
        a0.total === 28700 && noiseOf(a0.req) === 18300 && a0.pos.start === 8800 && a0.pos.end === 9400 && a0.pos.pos === "beginning" &&
        a0.answer === "unsure" && needQ.calls[0].pos.start === 8300 && needQ.right === 120,
        "the needed cards, standing parts first and the question last: 10,400 tokens, none of them not needed, the photograph at 8,200 to 8,800 in the last third, Fenwick Ledwith on all 120 calls; September's wall has no photograph and names nobody; without the notes but with the rest, 28,700 tokens, 18,300 not needed, the photograph at 8,800 to 9,400 in the first third, and no name");

      // 8. The answer rule, over every subset and order, against an independent recomputation.
      ok = true;
      for (m = 0; m < MASKS && ok; m++) {
        ORDER_KEYS.forEach(function (ord) {
          var b = build(pinSet(subset(m)), BUDGET0, true), req = orderFor(b.sel, ord, 0);
          var total = 0, start = -1, keyTok = 0, noise = 0, notes = false;
          req.forEach(function (c) {
            if (c.key) { start = total; keyTok = c.tokens; }
            if (!c.needed) noise += c.tokens;
            if (c.id === "notes") notes = true;
            total += c.tokens;
          });
          var mid = start < 0 ? -1 : (start + keyTok / 2) / total;
          var where = start < 0 ? "absent" : mid < 1 / 3 ? "beginning" : mid > 2 / 3 ? "end" : "middle";
          var want = (where === "beginning" || where === "end") && noise <= NOISE_LIMIT ? "right" : notes ? "wrong" : "unsure";
          if (positionOf(req).pos !== where || answerOf(req) !== want) ok = false;
        });
      }
      t.expect(ok && answerOf([]) === "refused",
        "the teaching rule over all 8,192 subsets in all three orders: right exactly when the photograph is in, outside the middle third, with no more than 8,000 tokens not needed; otherwise Mr Brask when DS Pennick's notes are in, or no name");

      // 9. Deterministic: the same settings give the same night every time.
      ok = true;
      WALL_KEYS.forEach(function (w) {
        ORDER_KEYS.forEach(function (ord) {
          var c1 = cfg(WALLS[w].pins, ord), c2 = cfg(WALLS[w].pins.slice(), ord);
          var a = JSON.stringify(night(c1).calls.map(function (c) { return [ids(c.req), c.kind, c.cu, c.pos.pos, c.answer]; }));
          var b = JSON.stringify(night(c2).calls.map(function (c) { return [ids(c.req), c.kind, c.cu, c.pos.pos, c.answer]; }));
          if (a !== b) ok = false;
        });
      });
      t.expect(ok && JSON.stringify(night(cfg(ALL, "shuffle")).tally) === JSON.stringify(sh.tally),
        "every wall in every order gives the same 120 calls each time it is run: no randomness, re-pinning follows a fixed rule");

      // 10. Every story number.
      var notes = card("notes");
      t.expect(CARDS.length === 14 && OPTIONAL.length === 13 && sum(CARDS) === 38300 &&
        sum(CARDS.filter(function (c) { return !c.needed; })) === 27900 && sum(CARDS.filter(function (c) { return c.needed; })) === 10400 &&
        sum([card("rules"), card("examples")]) === 1600 && notes.tokens === 9600 && notes.says.indexOf(MENTIONS + " times") >= 0 &&
        notes.says.indexOf(String(REVIEW)) >= 0 && notes.says.indexOf(COFFEE) >= 0 && card("brask").says.indexOf(COFFEE) >= 0 &&
        card("foyer").says.indexOf(PHOTO_CLOCK) >= 0 && card("foyer").says.indexOf("his brother, side door") >= 0 &&
        card("casefile").says.indexOf(REEL_OUT) >= 0 && card("casefile").says.indexOf(String(YEAR)) >= 0 &&
        card("tonight").says.indexOf("ten turns") >= 0 && TURNS === 10 && card("fenwick").says.indexOf("Dunmore") >= 0 &&
        BUDGET0 === 60000 && CALLS0 === 120 && GAP_MIN * CALLS0 === 360 && GAP_MIN < LIFETIME_MIN && LIFETIME_MIN === 5 &&
        PRICE === 2 && BASE === 100 && WRITE === 125 && READ === 10 && MIN_CACHE === 1024 && NOISE_LIMIT === 8000 &&
        CLOSED === 1991 && YEAR === 1983 && REVIEW === 1985 && BRASK_AGE === 81 && INCIDENT === "02:14" && START_CLOCK === 21600 &&
        g0.prefix.tokens === 30600 && sept.calls[0].prefix.tokens === 9100 && need.calls[0].prefix.tokens === 8800 &&
        optA.calls[0].prefix.tokens === 21000 && optD.calls[0].prefix.tokens === 30500,
        "story numbers: 14 cards, 38,300 tokens, 27,900 not needed and 10,400 needed, a 1,600-token system prompt, DS Pennick's 9,600-token notes naming Mr Brask 14 times and set aside in 1985, the coffee at 23:30, the foyer clock at 23:40, the reel out at 23:58 in 1983, tonight's last ten turns, Dunmore; a 60,000 budget, 120 calls 3 minutes apart inside the 5-minute lifetime, $2 per million, 1.25 and 0.1, 1,024 and 8,000; 1991, 81, 02:14 and six in the morning; 30,600, 9,100, 8,800, 21,000 and 30,500 tokens up to the breakpoint");

      // 11. The controls.
      t.set("order", "stable");
      var v1 = t.stat("cost") === 2.67 && t.stat("where") === "middle" && t.stat("reads") === 119 && t.stat("right") === 0;
      t.set("wall", "needed");
      var v2 = t.stat("tokens") === 10400 && t.stat("right") === 120 && t.stat("cost") === 0.62 && t.stat("where") === "end" &&
        st().ui.answerLine.textContent.indexOf(ANSWERS.right) >= 0;
      press(st().ui.cards.notes);
      var v3 = st().wall === "custom" && st().ctl.wall.value === "custom" && t.stat("noise") === 9600 && t.stat("right") === 0 &&
        st().ui.answerLine.textContent.indexOf(ANSWERS.wrong) >= 0 && st().ui.cards.notes.getAttribute("aria-pressed") === "true";
      press(st().ui.cards.notes);
      var v4 = st().wall === "needed" && st().ctl.wall.value === "needed" && t.stat("right") === 120;
      t.set("order", "shuffle");
      var v5 = t.stat("right") === 90 && t.stat("reads") === 0 && t.stat("cost") === 3.02;
      t.set("cache", false);
      var v6 = t.stat("cost") === 2.5 && t.stat("costOff") === 2.5 && t.stat("reads") === 0;
      t.set("cache", true);
      t.set("order", "stable");
      t.set("budget", 9000);
      var v7 = t.stat("tokens") === 8900 && t.stat("right") === 120 && st().ui.cardMeta.tonight.textContent === "trimmed";
      t.set("budget", 8000);
      var v8 = t.stat("tokens") === 0 && t.stat("where") === "not sent" && t.stat("cost") === 0 &&
        st().ui.sentLine.textContent.indexOf("Not sent: even after trimming tonight's conversation") === 0;
      t.set("budget", 60000);
      t.set("calls", 10);
      var v9 = t.stat("reads") === 9 && t.stat("right") === 10;
      t.click("reset");
      await t.run(1);
      var v10 = st().wall === "everything" && st().order === "question" && st().calls === CALLS0 && st().budget === BUDGET0 &&
        t.stat("cost") === 11.03 && t.stat("where") === "middle";
      t.expect(v1 && v2 && v3 && v4 && v5 && v6 && v7 && v8 && v9 && v10,
        "the controls: standing parts first $2.67 and still the middle; the needed cards 10,400 tokens, right on 120 calls, $0.62; pressing DS Pennick's notes onto the wall makes it your own, 9,600 tokens not needed and Mr Brask again, and pressing them off returns the needed wall; re-pinned every call 90 right, no reads, $3.02; caching off $2.50; a 9,000 budget trims tonight's conversation to 8,900; 8,000 sends nothing; 10 calls read 9 times; reset returns to 02:14");
    }
  });
})();
