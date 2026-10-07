/* sims/a1e03-v1.0.0.js  (published as sims/a1e03.js)
   Case a1e03 "Words Into Numbers": a byte-pair encoding lab built from Ysolde Vranckx's Book of Pairs.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), HTML built in
     code with theme classes only. A plain JS byte-pair encoder learns Ysolde's book from her twelve English
     messages (the training text, shown at the bottom) and reads one line from the story at a time. The
     line is shown as token chips with their token ids, then the id list and the cost at made-up teaching
     prices, then the merge list as it grows, then the training text with its token count. Controls: merges
     (0 to 63, so the vocabulary runs from 37 to 100), line (five lines from the story), compare (log every
     line's token count), reset. Stats: characters, words, tokens, characters per token, vocabulary size,
     input and output cost for a million copies of the line. selfTest covers the starting stats, the book's
     merges and ids, one token per character at 0 merges, the training text's token count never rising,
     frequent words becoming one token while her name stays split, deterministic ids, lossless round trips
     for every line at every merge count, every story number, the exact cost math, and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e03-v1.0.0.json):
   - post: entries 0 to 36 are the space, the ten digits and the 26 letters (ALPHABET, 37 symbols); the
     twelve English messages copied inside the front cover (MESSAGES, 131 words, 621 characters); entry 37
     joins t and h, counted 30 times; entry 38 joins 37 and e (counted 27 times); 63 joins, so the book
     stops at entry 99 (BOOK_MERGES, a vocabulary of 100); stop and courier are one number each (entries 42
     and 66); card 1's English, "the courier waits at the bridge at dawn stop", is 9 words, 44 characters,
     13 numbers; the Dutch on the same card, "de koerier wacht bij zonsopgang bij de brug stop", is 9 words,
     48 characters, 37 numbers (nearly three times as many); her signature, "ysolde vranckx", is 2 words,
     14 characters, 14 numbers, one per character, the space included; 0400, written three times in the
     twelve, is one number (entry 93); 0340 is four (' 0', 3, 4, 0). The evidence diagram repeats these
     and the characters per token: 3.4, 1.3 and 1.0.
   - comments: the last line of the book, "whatever is not in here, it spells": a line the book never saw is
     spelled out in smaller pieces, which the lossless self-test checks for every line and merge count.
   - reply part 2 (option C) and explanation: card 1 is 13 tokens in English and 37 in Dutch; card 1's
     English is 13 token ids, 38 66 61 29 50 43 70 50 87 11 33 24 42; at 0 merges it is 44, one per
     character; dawn is not in the twelve, so it is spelled ' d', a, w, n; her name is 14 tokens at every
     merge count; stop becomes one token at 6 merges and courier at 30; 0400 needs 57 merges.
   - explanation and tradeoff: card 1's English is 44 tokens with no merges and 13 with all 63; her twelve
     messages go from 621 tokens to 233.
   - teaching prices (sim.lede and the info panel say they are made up, not any provider's real prices):
     $6 per million input tokens and $24 per million output tokens. The cost stats price a million copies
     of the line, so each equals tokens x price exactly: card 1's English $78 in and $312 out; the Dutch
     $222 and $888; her name $84 and $336. One copy: 13 x $6 / 1,000,000 = $0.000078.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed
     because nothing animates; every number is worked out the moment a control changes.
   - The tokenizer learns only from MESSAGES, once, in setup. The five story lines are never used to learn
     anything and no setting is chosen by looking at them, so the sim never tunes on what it is tested on.
     Card 1's English is not one of the twelve messages.
   - Byte-pair encoding as Sennrich, Haddow and Birch (2016) describe it, over 37 characters instead of
     bytes: count every pair of neighbouring symbols across the training text, merge the most frequent pair
     into a new symbol, repeat. Ties go to the pair whose first occurrence comes earliest in the text, so
     the result is deterministic. Text is first cut into chunks (an optional leading space, then letters,
     or then digits) and merges never cross a chunk, so a space is glued to the front of the word after it,
     as in OpenAI's tokenizers. Reading new text replays the merges in the order they were learned.
   - No api.rand() anywhere: the book and every token id are fixed.
   - Stats get bare numbers (units live in the labels), so t.stat() returns numbers.
   - Colors come only from theme classes: chips, chip ok, chip core, chip warn, muted, small. Single
     characters are amber (chip warn); longer tokens alternate between chip ok and chip core so you can see
     where one ends.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // Entries 0 to 36 of her book: the space, the ten digits and the 26 letters. A symbol's id is its index.
  var ALPHABET = " 0123456789abcdefghijklmnopqrstuvwxyz";
  var BASE = ALPHABET.length;           // 37
  var BOOK_MERGES = 63;                 // entries 37 to 99, a vocabulary of 100

  // The twelve English messages copied inside the front cover: the training text.
  var MESSAGES = [
    "the courier waits at the north bridge stop",
    "the river is high stop the boats wait at the mill stop",
    "send the letters to the house by the river stop",
    "the courier did not come stop wait for the next night stop",
    "the bridge is watched stop use the mill road stop",
    "the lamp in the north window means wait stop",
    "the letters are in the third box under the stairs stop",
    "the house by the mill is empty stop the courier is gone stop",
    "the night train is late stop meet at the station at 0400 stop",
    "the river road is closed stop meet at the bridge at 0400 stop",
    "burn the letters at dusk stop",
    "the lamp is out stop do not come to the house before 0400 stop"
  ];

  // The lines from the story you can read with the book. None of them is one of the twelve.
  var LINES = [
    { value: "en", short: "card 1 English", label: "Card 1, her English", text: "the courier waits at the bridge at dawn stop",
      remark: "Her book was built from English like this, so the words she wrote often come out whole." },
    { value: "nl", short: "Dutch", label: "Card 1, the Dutch as it came in", text: "de koerier wacht bij zonsopgang bij de brug stop",
      remark: "Her twelve messages are all English, so most Dutch pairs were never merged." },
    { value: "name", short: "her name", label: "Her signature", text: "ysolde vranckx",
      remark: "Her name is not in the twelve messages, and none of its neighbouring pairs is ever merged, so it stays one token per character." },
    { value: "t0400", short: "0400 line", label: "A time she wrote: 0400", text: "the boats wait at the bridge at 0400 stop",
      remark: "0400 appears three times in her messages, so from 57 merges on it is a single token." },
    { value: "t0340", short: "0340 line", label: "A time she never wrote: 0340", text: "the boats wait at the bridge at 0340 stop",
      remark: "0340 never appears in her messages, so its digits stay in pieces." }
  ];
  var START_LINE = "en";

  var PRICE_IN = 6;                     // teaching price, made up: dollars per million input tokens
  var PRICE_OUT = 24;                   // teaching price, made up: dollars per million output tokens
  var PER_MILLION = 1000000;
  var COPIES = 1000000;                 // the cost stats price a million copies of the line
  var START_CLOCK = 15 * 60;            // a quarter past midnight in the attic
  var NARRATE_DELAY = 0.4;              // real seconds of stillness on the slider before the log speaks
  var SPACE_MARK = "·";            // a middle dot stands for a space inside a token

  /* ---------- byte-pair encoding ---------- */

  // Cut a line into chunks: an optional leading space, then letters, or then digits. Merges never cross a chunk.
  function chunk(line) {
    return String(line).match(/ ?[a-z]+| ?[0-9]+| +/g) || [];
  }

  function toIds(piece) {
    var ids = [];
    for (var i = 0; i < piece.length; i++) ids.push(ALPHABET.indexOf(piece.charAt(i)));
    return ids;
  }

  // Replace every non-overlapping (a, b), left to right, with id.
  function applyMerge(s, a, b, id) {
    if (s.length < 2) return s;
    var out = [], i = 0;
    while (i < s.length) {
      if (i + 1 < s.length && s[i] === a && s[i + 1] === b) {
        out.push(id);
        i += 2;
      } else {
        out.push(s[i]);
        i += 1;
      }
    }
    return out;
  }

  // Learn up to n merges from the training lines. Ties go to the pair seen first in the text.
  function learn(lines, n) {
    var seqs = [], strs = ALPHABET.split(""), merges = [], i, j, k;
    for (i = 0; i < lines.length; i++) {
      var parts = chunk(lines[i]);
      for (j = 0; j < parts.length; j++) seqs.push(toIds(parts[j]));
    }
    for (k = 0; k < n; k++) {
      var counts = {}, first = {}, order = [], pos = 0;
      for (i = 0; i < seqs.length; i++) {
        var s = seqs[i];
        for (j = 0; j + 1 < s.length; j++) {
          var key = s[j] + "," + s[j + 1];
          if (counts[key] === undefined) {
            counts[key] = 0;
            first[key] = pos;
            order.push(key);
          }
          counts[key] += 1;
          pos += 1;
        }
        pos += 1;
      }
      var best = null;
      for (i = 0; i < order.length; i++) {
        var c = order[i];
        if (best === null || counts[c] > counts[best] || (counts[c] === counts[best] && first[c] < first[best])) best = c;
      }
      if (best === null) break;
      var ab = best.split(","), a = Number(ab[0]), b = Number(ab[1]), id = BASE + k;
      merges.push({ a: a, b: b, id: id, count: counts[best], text: strs[a] + strs[b] });
      strs.push(strs[a] + strs[b]);
      for (i = 0; i < seqs.length; i++) seqs[i] = applyMerge(seqs[i], a, b, id);
    }
    return { merges: merges, strs: strs };
  }

  // Read a line with the first k merges, replayed in the order they were learned.
  function encode(book, line, k) {
    var out = [], parts = chunk(line), top = Math.min(k, book.merges.length);
    for (var p = 0; p < parts.length; p++) {
      var s = toIds(parts[p]);
      for (var j = 0; j < top; j++) {
        var m = book.merges[j];
        s = applyMerge(s, m.a, m.b, m.id);
      }
      for (var i = 0; i < s.length; i++) out.push(s[i]);
    }
    return out;
  }

  function decode(book, ids) {
    var out = "";
    for (var i = 0; i < ids.length; i++) out += book.strs[ids[i]];
    return out;
  }

  function countWords(line) {
    var t = String(line).trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function trainingTokens(book, k) {
    var total = 0;
    for (var i = 0; i < MESSAGES.length; i++) total += encode(book, MESSAGES[i], k).length;
    return total;
  }

  // Cost in dollars of n tokens at a price per million, for a number of copies of the line.
  function cost(n, price, copies) { return n * price * copies / PER_MILLION; }

  function measure(book, line, k) {
    var ids = encode(book, line, k);
    var chars = line.length, tokens = ids.length;
    return {
      ids: ids, chars: chars, words: countWords(line), tokens: tokens,
      cpt: tokens ? chars / tokens : 0,
      costIn: cost(tokens, PRICE_IN, COPIES), costOut: cost(tokens, PRICE_OUT, COPIES)
    };
  }

  function lineBy(value) {
    for (var i = 0; i < LINES.length; i++) if (LINES[i].value === value) return LINES[i];
    return LINES[0];
  }

  /* ---------- formatting ---------- */

  function shown(str) { return String(str).replace(/ /g, SPACE_MARK); }
  function f1(v) { return isFinite(v) ? v.toFixed(1) : "-"; }
  function money(v) { return v % 1 === 0 ? String(v) : v.toFixed(2); }
  function tiny(v) { return v.toFixed(6); }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* ---------- the widget ---------- */

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
      "Ysolde's Book of Pairs as a program. Each chip is one token with its token id. " + SPACE_MARK +
      " stands for a space glued to the front of a token. Amber chips are single characters, spelled out."));

    box.appendChild(head("The line, as tokens"));
    var lineText = el("p", "", "margin:0;font-size:13px;overflow-wrap:anywhere;", "");
    box.appendChild(lineText);
    var chips = el("div", "chips", "", "");
    chips.setAttribute("aria-label", "The line split into tokens");
    box.appendChild(chips);
    var idsLine = el("p", "", "margin:0;font-size:12.5px;overflow-wrap:anywhere;", "");
    box.appendChild(idsLine);
    var costNote = el("p", "muted", "margin:0;font-size:12px;", "");
    costNote.setAttribute("aria-live", "polite");
    box.appendChild(costNote);

    box.appendChild(head("Her Book of Pairs: the merges, in order"));
    var mergeNote = el("p", "muted", "margin:0;font-size:12px;", "");
    box.appendChild(mergeNote);
    var mergeChips = el("div", "chips", "", "");
    mergeChips.setAttribute("aria-label", "The merges, oldest first");
    box.appendChild(mergeChips);

    box.appendChild(head("Her twelve messages: the training text"));
    var trainNote = el("p", "muted", "margin:0;font-size:12px;", "");
    box.appendChild(trainNote);
    var trainText = el("pre", "muted", "margin:0;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;", MESSAGES.join("\n"));
    box.appendChild(trainText);

    api.root.appendChild(box);
    return { doc: doc, lineText: lineText, chips: chips, idsLine: idsLine, costNote: costNote,
      mergeNote: mergeNote, mergeChips: mergeChips, trainNote: trainNote };
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function chip(doc, text, id, cls) {
    var c = doc.createElement("span");
    c.className = cls;
    c.appendChild(doc.createTextNode(text));
    if (id !== null) {
      var n = doc.createElement("span");
      n.setAttribute("style", "font-size:10px;opacity:.75;margin-left:5px;");
      n.textContent = String(id);
      c.appendChild(n);
    }
    return c;
  }

  /* ---------- drawing ---------- */

  function drawLine(S) {
    var ui = S.ui, doc = ui.doc, book = S.book, line = lineBy(S.line), m = S.m, multi = 0;
    ui.lineText.textContent = line.label + ": \"" + line.text + "\"";
    clear(ui.chips);
    for (var i = 0; i < m.ids.length; i++) {
      var id = m.ids[i], str = book.strs[id], cls;
      if (str.length === 1) cls = "chip warn";
      else {
        cls = multi % 2 === 0 ? "chip ok" : "chip core";
        multi += 1;
      }
      ui.chips.appendChild(chip(doc, shown(str), id, cls));
    }
    ui.idsLine.textContent = "Token ids, all the model would see: " + m.ids.join(" ");
    ui.costNote.textContent = "Teaching prices, made up: " + m.tokens + " tokens x $" + PRICE_IN + " / 1,000,000 = $" +
      tiny(cost(m.tokens, PRICE_IN, 1)) + " to send this line once as input, and " + m.tokens + " x $" + PRICE_OUT +
      " / 1,000,000 = $" + tiny(cost(m.tokens, PRICE_OUT, 1)) + " if the model wrote it as output. A million copies: $" +
      commas(money(m.costIn)) + " and $" + commas(money(m.costOut)) + ".";
  }

  function drawMerges(S) {
    var ui = S.ui, doc = ui.doc, book = S.book, k = S.k;
    clear(ui.mergeChips);
    if (k === 0) {
      ui.mergeNote.textContent = "No merges yet. The vocabulary is entries 0 to 36: the space, the digits 0 to 9 and the letters a to z, so every character is its own token.";
      return;
    }
    var last = book.merges[k - 1];
    ui.mergeNote.textContent = "Entries 0 to 36 are the space, the digits and the letters. Then " + k + " merge" + (k === 1 ? "" : "s") +
      ", a vocabulary of " + (BASE + k) + ". Newest: entry " + last.id + " joins " + shown(book.strs[last.a]) + " and " +
      shown(book.strs[last.b]) + " into " + shown(last.text) + ", found " + last.count + " times in her messages.";
    for (var j = 0; j < k; j++) {
      var mg = book.merges[j];
      ui.mergeChips.appendChild(chip(doc, mg.id + " " + shown(mg.text), null, j === k - 1 ? "chip ok" : "chip"));
    }
  }

  function drawTraining(S) {
    var words = 0, chars = 0;
    for (var i = 0; i < MESSAGES.length; i++) {
      words += countWords(MESSAGES[i]);
      chars += MESSAGES[i].length;
    }
    S.ui.trainNote.textContent = MESSAGES.length + " messages, " + words + " words, " + chars + " characters: " +
      trainingTokens(S.book, S.k) + " tokens with " + S.k + " merge" + (S.k === 1 ? "" : "s") + ".";
  }

  function drawStats(S) {
    var m = S.m;
    S.stat.chars(m.chars);
    S.stat.words(m.words);
    S.stat.tokens(m.tokens);
    S.stat.cpt(f1(m.cpt));
    S.stat.vocab(BASE + S.k);
    S.stat.costIn(money(m.costIn));
    S.stat.costOut(money(m.costOut));
  }

  function draw(api) {
    var S = api.state;
    S.m = measure(S.book, lineBy(S.line).text, S.k);
    drawLine(S);
    drawMerges(S);
    drawTraining(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function logMerges(api) {
    var S = api.state, k = S.k, m = S.m;
    if (k === 0) {
      api.log("0 merges, a vocabulary of 37: every character is its own token. This line: " + m.tokens + " tokens for " + m.chars + " characters.", "warn");
      return;
    }
    var last = S.book.merges[k - 1];
    api.log(k + " merges, a vocabulary of " + (BASE + k) + ". Newest: entry " + last.id + ", " + shown(last.text) +
      ", found " + last.count + " times. This line: " + m.tokens + " tokens; her twelve messages: " + trainingTokens(S.book, k) + ".", "");
  }

  function logLine(api) {
    var S = api.state, line = lineBy(S.line), m = S.m;
    api.log(line.label + ": " + m.words + " words, " + m.chars + " characters, " + m.tokens + " tokens at " + S.k +
      " merges. " + line.remark, line.value === "en" || line.value === "t0400" ? "ok" : "bad");
  }

  function setMerges(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 0 && k <= BOOK_MERGES)) return;
    S.k = k;
    draw(api);
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      logMerges(api);
    });
  }

  function setLine(api, v) {
    var S = api.state;
    S.line = lineBy(v).value;
    draw(api);
    logLine(api);
  }

  function compareAll(api) {
    var S = api.state, parts = [];
    for (var i = 0; i < LINES.length; i++) parts.push(LINES[i].short + " " + encode(S.book, LINES[i].text, S.k).length);
    api.log("At " + S.k + " merges, in tokens: " + parts.join(", ") + ".", "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e03", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.book = learn(MESSAGES, BOOK_MERGES);
      S.k = BOOK_MERGES;
      S.line = START_LINE;
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.merges = api.control.range("merges", "Merges from her book", 0, BOOK_MERGES, 1, BOOK_MERGES,
        function (v) { setMerges(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return k + " (vocabulary " + (BASE + k) + ")"; } });
      S.ctl.line = api.control.select("line", "Line to read", LINES.map(function (l) { return { value: l.value, label: l.label }; }),
        START_LINE, function (v) { setLine(api, v); });
      S.ctl.compare = api.control.button("compare", "Count all five lines", function () { compareAll(api); }, { tone: "primary" });
      S.ctl.reset = api.control.button("reset", "Reset to her full book", function () { api.reset(); });

      S.stat = {
        chars: api.stat("chars", "characters", ""),
        words: api.stat("words", "words", ""),
        tokens: api.stat("tokens", "tokens", "bad"),
        cpt: api.stat("cpt", "characters per token", ""),
        vocab: api.stat("vocab", "vocabulary size", ""),
        costIn: api.stat("costIn", "input, a million copies ($, teaching price)", "warn"),
        costOut: api.stat("costOut", "output, a million copies ($, teaching price)", "warn")
      };

      api.info("<strong>How to read it.</strong> The top row is the chosen line cut into tokens: each chip is one token with its token id, the number a model would see. " +
        SPACE_MARK + " marks a space glued to the front of a token, and amber chips are a single character. Below it, her merges in order, newest highlighted. " +
        "The slider sets how many of her 63 merges the tokenizer may use, so the vocabulary runs from 37 to 100. " +
        "Costs use made-up teaching prices, not any provider's: $6 per million input tokens and $24 per million output tokens.");
      draw(api);
      api.log("A quarter past midnight in the attic. Her Book of Pairs is open at entry 99: 63 merges, a vocabulary of 100. Card 1, her English: " +
        S.m.words + " words, " + S.m.tokens + " tokens.", "");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      function same(a, b) {
        if (a.length !== b.length) return false;
        for (var q = 0; q < a.length; q++) if (a[q] !== b[q]) return false;
        return true;
      }
      var i, k, ok;

      // 1. The starting setup: all 63 merges, card 1's English.
      await t.run(1);
      t.expect(st().k === 63 && st().line === "en" && n("chars") === 44 && n("words") === 9 && n("tokens") === 13 &&
        n("cpt") === 3.4 && n("vocab") === 100 && n("costIn") === 78 && n("costOut") === 312 && t.logText().indexOf("13 tokens") >= 0,
        "the start shows card 1's English with all 63 merges: 44 characters, 9 words, 13 tokens, 3.4 characters per token, a vocabulary of 100, $78 input and $312 output for a million copies, and 13 tokens in the log");

      // 2. Her book: the merges, their ids and counts, and the same book every time it is learned.
      var book = st().book, again = learn(MESSAGES, BOOK_MERGES);
      ok = book.merges.length === 63 && book.strs.length === 100 && JSON.stringify(again.merges) === JSON.stringify(book.merges);
      var m0 = book.merges[0], m1 = book.merges[1], last = book.merges[62];
      t.expect(ok && m0.a === 30 && m0.b === 18 && m0.id === 37 && m0.count === 30 && m0.text === "th" &&
        m1.a === 37 && m1.b === 15 && m1.text === "the" && m1.count === 27 &&
        book.strs[42] === " stop" && book.strs[66] === " courier" && book.strs[93] === " 0400" &&
        last.id === 99 && last.text === " not" && last.count === 2,
        "learning her twelve messages twice gives the same 63 merges: entry 37 joins t and h (30 times), entry 38 joins 37 and e (27 times), entry 42 is ' stop', 66 is ' courier', 93 is ' 0400', and the last, 99, is ' not' (2 times), a vocabulary of 100");

      // 3. With 0 merges every character is its own token, and its id is its place in the alphabet.
      ok = true;
      var all = LINES.map(function (l) { return l.text; }).concat(MESSAGES);
      for (i = 0; i < all.length; i++) {
        var ids0 = encode(book, all[i], 0);
        if (ids0.length !== all[i].length) ok = false;
        for (var c = 0; c < ids0.length; c++) if (ids0[c] !== ALPHABET.indexOf(all[i].charAt(c))) ok = false;
      }
      t.expect(ok && encode(book, LINES[0].text, 0).length === 44 && trainingTokens(book, 0) === 621,
        "with 0 merges every story line and every message is one token per character, each id is the character's place among the 37 symbols, card 1's English is 44 tokens and the twelve messages 621");

      // 4. On the training text the token count never rises as merges rise.
      var prev = trainingTokens(book, 0), mono = true;
      for (k = 1; k <= BOOK_MERGES; k++) {
        var now = trainingTokens(book, k);
        if (now > prev) mono = false;
        prev = now;
      }
      t.expect(mono && trainingTokens(book, 63) === 233,
        "on her twelve messages the token count never rises from one merge count to the next, falling from 621 tokens to 233 at 63 merges");

      // 5. Frequent words become one token after enough merges; her name stays split at every count.
      var en = LINES[0].text, name = lineBy("name").text, nameOk = true;
      for (k = 0; k <= BOOK_MERGES; k++) if (encode(book, name, k).length !== 14) nameOk = false;
      t.expect(encode(book, en, 30).indexOf(66) >= 0 && encode(book, en, 29).indexOf(66) < 0 &&
        encode(book, en, 6).indexOf(42) >= 0 && encode(book, en, 5).indexOf(42) < 0 && nameOk,
        "' courier' becomes one token (id 66) at 30 merges and not at 29, ' stop' (id 42) at 6 and not at 5, while her name stays 14 tokens, one per character, at every merge count from 0 to 63");

      // 6. Reading is deterministic: the same merges always give the same ids.
      var want = [38, 66, 61, 29, 50, 43, 70, 50, 87, 11, 33, 24, 42];
      ok = true;
      for (i = 0; i < LINES.length; i++) {
        for (k = 0; k <= BOOK_MERGES; k += 7) if (!same(encode(book, LINES[i].text, k), encode(again, LINES[i].text, k))) ok = false;
      }
      t.expect(ok && same(encode(book, en, 63), want) && same(encode(book, en, 63), encode(book, en, 63)),
        "every story line gives identical ids from two separately learned books at merge counts 0, 7, 14 and on to 63, and card 1's English is always 38 66 61 29 50 43 70 50 87 11 33 24 42 at 63 merges");

      // 7. Lossless: joining the tokens back gives the exact line, at every merge count, for every line.
      ok = true;
      for (i = 0; i < all.length; i++) {
        for (k = 0; k <= BOOK_MERGES; k++) if (decode(book, encode(book, all[i], k)) !== all[i]) ok = false;
        for (var ch = 0; ch < all[i].length; ch++) if (ALPHABET.indexOf(all[i].charAt(ch)) < 0) ok = false;
      }
      t.expect(ok, "every story line and every message uses only the 37 symbols, and joining its tokens back gives the exact text, spaces included, at every merge count from 0 to 63");

      // 8. Every story number, checked exactly.
      var mEn = measure(book, en, 63), mNl = measure(book, lineBy("nl").text, 63), mName = measure(book, name, 63);
      var m400 = measure(book, lineBy("t0400").text, 63), m340 = measure(book, lineBy("t0340").text, 63);
      var words = 0, chars = 0;
      for (i = 0; i < MESSAGES.length; i++) {
        words += countWords(MESSAGES[i]);
        chars += MESSAGES[i].length;
      }
      t.expect(MESSAGES.length === 12 && words === 131 && chars === 621 && BASE === 37 &&
        mEn.chars === 44 && mEn.words === 9 && mEn.tokens === 13 && f1(mEn.cpt) === "3.4" &&
        mNl.chars === 48 && mNl.words === 9 && mNl.tokens === 37 && f1(mNl.cpt) === "1.3" &&
        mName.chars === 14 && mName.words === 2 && mName.tokens === 14 && f1(mName.cpt) === "1.0" &&
        m400.tokens === 11 && m400.ids.indexOf(93) >= 0 && m340.tokens === 14 && same(m340.ids.slice(9, 13), [90, 4, 5, 1]) &&
        same(mEn.ids.slice(8, 12), [87, 11, 33, 24]) && encode(book, lineBy("t0400").text, 57).indexOf(93) >= 0 &&
        encode(book, lineBy("t0400").text, 56).indexOf(93) < 0,
        "story numbers: 12 messages of 131 words and 621 characters; card 1's English 44 characters, 9 words, 13 tokens (3.4 each); the Dutch 48, 9, 37 (1.3); her name 14, 2, 14 (1.0); 0400 one token (id 93, from 57 merges), 0340 four (' 0', 3, 4, 0); dawn spelled ' d', a, w, n");

      // 9. The cost math is exact: tokens x price / 1,000,000, for one copy and for a million.
      ok = true;
      [mEn, mNl, mName, m400, m340].forEach(function (mm) {
        if (mm.costIn !== mm.tokens * 6 || mm.costOut !== mm.tokens * 24) ok = false;
        if (cost(mm.tokens, PRICE_IN, 1) !== mm.tokens * 6 / 1000000 || cost(mm.tokens, PRICE_OUT, 1) !== mm.tokens * 24 / 1000000) ok = false;
      });
      t.expect(ok && mEn.costIn === 78 && mEn.costOut === 312 && mNl.costIn === 222 && mNl.costOut === 888 &&
        mName.costIn === 84 && mName.costOut === 336 && tiny(cost(13, PRICE_IN, 1)) === "0.000078",
        "cost = tokens x price / 1,000,000 exactly: a million copies of card 1's English cost $78 in and $312 out, the Dutch $222 and $888, her name $84 and $336, and one copy of card 1 $0.000078");

      // 10. The controls: the Dutch, then no merges, then her name, then compare, then reset.
      t.set("line", "nl");
      await t.run(1);
      var dutch = n("tokens") === 37 && n("chars") === 48 && n("words") === 9 && n("cpt") === 1.3 && n("costIn") === 222 && n("costOut") === 888;
      t.set("merges", 0);
      await t.run(1);
      var zero = n("tokens") === 48 && n("vocab") === 37 && st().ui.mergeChips.children.length === 0 && st().ui.chips.children.length === 48 &&
        t.logText().indexOf("every character is its own token") >= 0;
      t.set("merges", 63);
      t.set("line", "name");
      await t.run(1);
      var nm = n("tokens") === 14 && n("cpt") === 1 && st().ui.mergeChips.children.length === 63;
      t.click("compare");
      var cmp = t.logText().indexOf("card 1 English 13, Dutch 37, her name 14, 0400 line 11, 0340 line 14") >= 0;
      t.click("reset");
      await t.run(1);
      t.expect(dutch && zero && nm && cmp && n("tokens") === 13 && st().line === "en" && st().k === 63,
        "the controls: the Dutch shows 37 tokens, 48 characters, 9 words, 1.3 per token, $222 and $888; 0 merges shows 48 tokens, a vocabulary of 37, no merge chips and 48 token chips; her name shows 14 tokens with 63 merge chips; compare logs 13, 37, 14, 11 and 14; reset returns to 13 tokens on card 1's English");
    }
  });
})();
