/* sims/a4e03-v1.0.0.js  (published as sims/a4e03.js)
   Case a4e03 "What It Remembers": a memory lab for Lowenna's night diary app, Nightleaf. She writes
   one entry a night and the app writes one reply, so a night is 2 messages. As built, every 20
   messages a summariser rewrites the old summary plus the new messages into a new summary, and
   that summary is the app's long-term memory. No real model runs here: a stand-in summariser and
   a stand-in replier follow stated rules, the same way every time. The learner picks the memory
   mode, how often the summary is rewritten, the summariser's prompt, whether she deletes night 6's
   entry, and the token budget, then steps through the 30 nights of September 2026 to night 31
   (Thursday 1 October), and reads what the app remembers, the tokens it sends, whether the two
   sisters stay apart, and whether the deleted entry survives.
   Widget-style sim: it draws its own memory panel, reply and token bars inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: modes (whole history, rolling summary, dated facts with
     retrieval), summary every 10, 20 or 30 messages, the summariser prompt "keep names and
     relationships exact", the delete on night 12, token budgets 2,000, 4,000, 8,000 and 200,000,
     Next night and Run to night 31. Stats: night, tokens sent tonight, tokens sent so far,
     summariser calls, messages cut, sisters, the deleted entry, the reply. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - NIGHTS below: 30 entries (1 to 30 September 2026) and the 30 replies she got, kept as they were
     so every mode reads the same history. Entry n is message 2n - 1; its reply is message 2n.
     Night 31 (Thursday 1 October) is her entry "My sister rang tonight. She sounds lonely up
     there." and the reply the sim works out from memory.
   - Tokens (a teaching rule): a text's words times 4 / 3, rounded up. The system prompt (SYS) is
     27 words, 36 tokens.
   - "My sister" with no name means the sister last named before it in the conversation (her
     entries and the app's replies). Each night lists the sisters it names (nm), in order.
   - Whole history: every night it sends the system prompt, every stored message and tonight's
     entry. Over the budget, the oldest messages are cut until it fits.
   - Rolling summary: after every N messages (20 as built) the summariser reads the old summary,
     then the new messages, and writes a new one. A named fact goes under that person. "My sister"
     with no name goes under the sister last named earlier in this batch; if none yet, under the
     sister the old summary says most about (most facts; a tie goes to the one listed first). The
     summary holds at most 20 facts. Over that, it folds people who share a relationship (the two
     sisters become one entry, under the name it says more about, holding both sets of facts),
     then drops the oldest facts, keeping each person's first, until 20 remain. With the prompt
     "keep names and relationships exact" it never folds; it only drops. Each night it sends the
     system prompt, the summary, the messages since the last pass and tonight's entry; over the
     budget, the oldest of those messages are cut.
   - Dated facts: each fact is written down the night it is said, from the conversation so far,
     with its date and the message it came from. Each night the app sends the system prompt, the
     6 facts that share the most tags with tonight's entry (ties: newest first) and tonight's entry.
   - Delete: before her entry on night 12 she deletes night 6's entry (message 11) in settings. The
     message is removed; dated facts from message 11 are removed with it. A summary already written
     is text, and nothing in it points back to message 11.
   - The reply (night 31): it asks after the sister "my sister" means in memory: whole history, the
     sister last named in what was sent; summary, the sister last named in the recent messages, or
     else the one the summary says most about; facts, the sister of the top fact. "How is <name>
     getting on in <place>?" uses the newest place in her facts; it adds "I know this year has been
     hard since she died." if her facts hold a death, and "And please stop blaming yourself for the
     voicemail." if memory holds night 6's fact.

   Where every number comes from (conventions rule 14; the case is
   content/latent/a4/a4e03-v1.0.0.json). Worked out from the data and rules above; selfTest checks them.
   - Facts in the 30 entries: 24. Romilly 9, Tegwen 5 (+ 4 said as "my sister" on nights 8, 11,
     16, 21 and 26: 5 in all, so Tegwen 10), Pomona 2, Lowenna herself 3. (Counts in selfTest.)
   - As built (summary every 20, budget 2,000): passes after nights 10, 20, 30 (3 calls).
     Summary 1: apart. Summary 2: night 11's "first week at the hospital" filed under Romilly.
     Summary 3: 24 facts > 20, the sisters fold under Romilly, and she holds Carrowmere.
     Night 31's reply: "How is Romilly getting on in Carrowmere? I know this year has been hard
     since she died. And please stop blaming yourself for the voicemail."
   - Whole history, 200,000: no merge, the deleted entry gone, reply about Tegwen in Carrowmere.
   - Exact token counts: see the selfTest expectations (computed by this file's rules).
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var SYS = "You are Nightleaf, a gentle night diary. Reply in two or three warm sentences. Use what you remember about the writer, and never give medical advice.";
  var SISTERS = { Romilly: true, Tegwen: true };
  var ROLE = { Romilly: "sister", Tegwen: "sister", Pomona: "cat", Lowenna: "you" };
  var LIMIT = 20;
  var TOPK = 6;
  var DEL_MSG = 11;
  var DEL_NIGHT = 12;

  // e: her entry; nm: sisters named in the entry, in order; f: facts [who ("?" = "my sister"), text, tags, place, died];
  // r: the reply she got; rn: sisters named in the reply.
  var NIGHTS = [
    { e: "First night with Nightleaf. My counsellor thinks writing at night might help. My sister Romilly died on 14 March. She was 41.", nm: ["Romilly"],
      f: [["Romilly", "died on 14 March, aged 41", ["died"], null, true]],
      r: "I'm so sorry about Romilly. I'm here every night, and I'll remember what you tell me.", rn: ["Romilly"] },
    { e: "Romilly rang me every Sunday at seven, for twenty years. Sundays are the worst.", nm: ["Romilly"],
      f: [["Romilly", "rang you every Sunday at seven", ["rang", "sunday"]]],
      r: "Sunday at seven must feel very empty without Romilly's call. Be gentle with yourself this weekend.", rn: ["Romilly"] },
    { e: "My other sister, Tegwen, is moving to Carrowmere next week. She got a job at the hospital there.", nm: ["Tegwen"],
      f: [["Tegwen", "moving to Carrowmere for a job at the hospital", ["moving", "hospital"], "Carrowmere"]],
      r: "Big news from Tegwen. Carrowmere is a long way. How do you feel about her going?", rn: ["Tegwen"] },
    { e: "Pomona knocked the photo off the shelf again. I left it face down for an hour.", nm: [],
      f: [["Pomona", "your cat; knocks the photo off the shelf", ["cat", "photo"]]],
      r: "Pomona sounds like she has opinions. It's all right to need an hour.", rn: [] },
    { e: "Couldn't sleep. Romilly would have been 42 in October.", nm: ["Romilly"],
      f: [["Romilly", "would have been 42 in October", ["birthday"]]],
      r: "Birthdays after a loss are hard. We can plan something small for the day if you'd like.", rn: [] },
    { e: "I never rang Romilly back after her last voicemail. I keep thinking it's my fault. I can't write the rest.", nm: ["Romilly"],
      f: [["Lowenna", "never returned Romilly's last voicemail, and blames herself", ["voicemail", "blame"]]],
      r: "Thank you for trusting me with that. Grief often lands on the last thing we didn't do.", rn: [] },
    { e: "Tegwen left for Carrowmere this morning. The house is so quiet.", nm: ["Tegwen"],
      f: [["Tegwen", "left for Carrowmere on 7 September", ["moving"], "Carrowmere"]],
      r: "The first quiet evening after someone moves is strange. I hope Tegwen's journey went well.", rn: ["Tegwen"] },
    { e: "My sister rang from Carrowmere. Her flat is above a bakery and smells of bread.", nm: [],
      f: [["?", "her flat is above a bakery in Carrowmere", ["rang", "flat", "bakery"], "Carrowmere"]],
      r: "A flat that smells of bread sounds like a good start.", rn: [] },
    { e: "Went to Romilly's grave. Someone had left snowdrops. In September.", nm: ["Romilly"],
      f: [["Romilly", "someone left snowdrops on her grave", ["grave"]]],
      r: "Snowdrops in September. Someone else is missing Romilly too.", rn: ["Romilly"] },
    { e: "Found Romilly's red scarf in my coat pocket. I don't remember putting it there.", nm: ["Romilly"],
      f: [["Romilly", "her red scarf turned up in your coat pocket", ["scarf"]]],
      r: "Small things turn up when we need them. Has Tegwen settled in this week?", rn: ["Tegwen"] },
    { e: "My sister's first week at the hospital went well. She says the sea is loud at night.", nm: [],
      f: [["?", "first week at the hospital went well", ["hospital", "work"]]],
      r: "I'm glad the first week went well. The sea would take some getting used to.", rn: [] },
    { e: "Long day. I deleted one of my old entries in the settings tonight. I didn't want it kept.", nm: [],
      f: [],
      r: "That's always your choice to make. Rest well.", rn: [] },
    { e: "An old friend of Romilly's from her choir wrote to me today.", nm: ["Romilly"],
      f: [["Romilly", "an old friend from her choir wrote to you", ["choir", "letter"]]],
      r: "It's kind when Romilly's friends reach out.", rn: ["Romilly"] },
    { e: "Pomona brought a mouse in at two in the morning. Alive.", nm: [],
      f: [["Pomona", "brought a live mouse in at two in the morning", ["cat"]]],
      r: "Pomona clearly thinks you need company at night.", rn: [] },
    { e: "Tegwen sent photos of the harbour. Grey sea, red boats.", nm: ["Tegwen"],
      f: [["Tegwen", "sent photos of the harbour", ["photo", "harbour"]]],
      r: "Grey sea and red boats. Does Tegwen like it there so far?", rn: ["Tegwen"] },
    { e: "My sister has a night shift every Thursday now. She says the ward is quiet after three.", nm: [],
      f: [["?", "works a night shift every Thursday", ["shift", "work"]]],
      r: "Thursday nights on a ward must be long. You could write to each other on those nights.", rn: [] },
    { e: "Sunday. Seven o'clock came and went and nobody rang.", nm: [],
      f: [["Romilly", "seven o'clock on Sundays still hurts", ["sunday", "rang"]]],
      r: "Seven o'clock was Romilly's time. It makes sense that it still hurts.", rn: ["Romilly"] },
    { e: "Took Romilly's books to the charity shop. Kept the one with her handwriting in it.", nm: ["Romilly"],
      f: [["Romilly", "her books went to the charity shop; you kept one", ["books"]]],
      r: "Keeping the one with her handwriting sounds right.", rn: [] },
    { e: "Quiet night. Nothing to say.", nm: [],
      f: [],
      r: "Quiet nights are allowed. I'm here.", rn: [] },
    { e: "Tegwen's new friend from work took her sailing. She sounded happy.", nm: ["Tegwen"],
      f: [["Tegwen", "went sailing with a friend from work", ["sailing"]]],
      r: "Sailing already. Tegwen sounds like she's finding her feet.", rn: ["Tegwen"] },
    { e: "My sister says the bakery under her flat starts at four and wakes her every morning.", nm: [],
      f: [["?", "the bakery under her flat in Carrowmere wakes her at four", ["bakery", "flat"], "Carrowmere"]],
      r: "Four in the morning is early, even for good bread.", rn: [] },
    { e: "Wore Romilly's red scarf to work. Nobody said anything, which was right.", nm: ["Romilly"],
      f: [["Romilly", "you wore her red scarf to work", ["scarf"]]],
      r: "Wearing Romilly's scarf sounds like keeping her close.", rn: ["Romilly"] },
    { e: "My counsellor says I'm doing better. I don't feel it yet.", nm: [],
      f: [["Lowenna", "your counsellor says you're doing better", ["counsellor"]]],
      r: "Better often comes before feeling better. That's normal.", rn: [] },
    { e: "Romilly's birthday is in three weeks. I bought a card I can't send.", nm: ["Romilly"],
      f: [["Romilly", "you bought her a birthday card you can't send", ["birthday", "card"]]],
      r: "Buying the card was a way of remembering her.", rn: [] },
    { e: "Tegwen passed her probation at the hospital.", nm: ["Tegwen"],
      f: [["Tegwen", "passed her probation at the hospital", ["hospital", "work"]]],
      r: "Well done, Tegwen. You must be proud of her.", rn: ["Tegwen"] },
    { e: "My sister wants me to come and stay at half term.", nm: [],
      f: [["?", "wants you to come and stay at half term", ["visit"]]],
      r: "A visit could do you both good.", rn: [] },
    { e: "Pomona is asleep on Romilly's old jumper.", nm: ["Romilly"],
      f: [],
      r: "Pomona knows where the warm, safe things are.", rn: [] },
    { e: "Tegwen rang. She said Carrowmere is lonely in the evenings.", nm: ["Tegwen"],
      f: [["Tegwen", "rang: Carrowmere is lonely in the evenings", ["rang", "lonely"], "Carrowmere"]],
      r: "Evenings in a new town can be lonely. Maybe you two could talk more often.", rn: [] },
    { e: "Booked a train for half term.", nm: [],
      f: [["Lowenna", "booked a train for half term", ["visit", "train"]]],
      r: "Something to look forward to.", rn: [] },
    { e: "Last night of September. Six months and sixteen days.", nm: [],
      f: [],
      r: "That is a long time to carry this. Tegwen will be glad to see you at half term.", rn: ["Tegwen"] }
  ];
  var N31 = { e: "My sister rang tonight. She sounds lonely up there.", tags: ["rang", "lonely"] };

  var MODES = [
    { value: "summary", label: "Rolling summary (as built)" },
    { value: "whole", label: "Whole history, every night" },
    { value: "facts", label: "Dated facts with retrieval" }
  ];
  var EVERY = [10, 20];
  var BUDGETS = [400, 600, 1000, 200000];
  var ASBUILT = 600;

  /* ---------- small helpers ---------- */

  function tok(s) { var w = String(s).split(/\s+/).filter(function (x) { return x.length > 0; }).length; return Math.ceil(w * 4 / 3); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dateOf(night) { return night <= 30 ? night + " Sep" : (night - 30) + " Oct"; }

  // Every fact, with its true owner worked out from the whole conversation.
  var FACTS = (function () {
    var out = [];
    var last = null;
    NIGHTS.forEach(function (nt, i) {
      var night = i + 1;
      var named = null;
      nt.f.forEach(function (f) {
        out.push({ who: f[0], owner: f[0] === "?" ? last : f[0], text: f[1], tags: f[2].concat(SISTERS[f[0] === "?" ? last : f[0]] ? ["sister"] : []),
          place: f[3] || null, died: !!f[4], night: night, msg: 2 * night - 1 });
      });
      nt.nm.forEach(function (n) { last = n; named = n; });
      nt.rn.forEach(function (n) { last = n; });
    });
    return out;
  })();
  // September's messages, and whole history a night after a year at that rate (365 nights).
  var SEPT = 0;
  NIGHTS.forEach(function (nt) { SEPT += tok(nt.e) + tok(nt.r); });
  var YEAR = tok(SYS) + Math.round(SEPT * 365 / 30);

  function factsOfNight(night) { return FACTS.filter(function (f) { return f.night === night; }); }

  /* ---------- the model (pure: the state after k nights, for settings C) ---------- */

  function factLine(f) { return f.text; }
  function renderSummary(s) {
    return s.map(function (p) { return p.name + " (" + p.role + "): " + p.facts.map(factLine).join("; ") + "."; }).join("\n");
  }
  function factCard(f) { return dateOf(f.night) + ", message " + f.msg + ". " + f.owner + ": " + f.text + "."; }

  function mostSister(s) {
    var best = null;
    s.forEach(function (p) { if (p.role === "sister" && (!best || p.facts.length > best.facts.length)) best = p; });
    return best ? best.name : null;
  }
  function clone(s) { return s.map(function (p) { return { name: p.name, role: p.role, facts: p.facts.slice() }; }); }
  function countFacts(s) { var n = 0; s.forEach(function (p) { n += p.facts.length; }); return n; }

  // One summariser pass over the old summary and a batch of nights.
  function pass(old, nights, C, deleted) {
    var s = clone(old);
    var last = null;
    var folded = false;
    nights.forEach(function (night) {
      var nt = NIGHTS[night - 1];
      var gone = deleted && 2 * night - 1 === DEL_MSG;
      if (!gone) {
        factsOfNight(night).forEach(function (f) {
          var who = f.who === "?" ? (last || mostSister(s)) : f.who;
          var p = null;
          s.forEach(function (x) { if (x.name === who) p = x; });
          if (!p) { p = { name: who, role: ROLE[who], facts: [] }; s.push(p); }
          p.facts.push(f);
        });
        nt.nm.forEach(function (n) { last = n; });
      }
      nt.rn.forEach(function (n) { last = n; });
    });
    if (countFacts(s) > LIMIT && !C.exact) {
      var sis = s.filter(function (p) { return p.role === "sister"; });
      if (sis.length > 1) {
        var keep = sis[0].facts.length >= sis[1].facts.length ? sis[0] : sis[1];
        var other = keep === sis[0] ? sis[1] : sis[0];
        keep.facts = keep.facts.concat(other.facts).sort(function (a, b) { return a.msg - b.msg; });
        s.splice(s.indexOf(other), 1);
        folded = true;
      }
    }
    while (countFacts(s) > LIMIT) {
      var oldest = null;
      var holder = null;
      s.forEach(function (p) { p.facts.forEach(function (f, k) { if (k > 0 && (!oldest || f.msg < oldest.msg)) { oldest = f; holder = p; } }); });
      if (!oldest) break;
      holder.facts.splice(holder.facts.indexOf(oldest), 1);
    }
    return { s: s, folded: folded };
  }

  function msgText(m) { var nt = NIGHTS[Math.ceil(m / 2) - 1]; return m % 2 ? nt.e : nt.r; }
  function msgNames(m) { var nt = NIGHTS[Math.ceil(m / 2) - 1]; return m % 2 ? nt.nm : nt.rn; }

  // Fit messages (oldest first) into what is left of the budget, cutting the oldest.
  function fit(msgs, room) {
    var kept = msgs.slice();
    var used = 0;
    kept.forEach(function (m) { used += tok(msgText(m)); });
    var cut = 0;
    while (kept.length && used > room) { used -= tok(msgText(kept[0])); kept.shift(); cut += 1; }
    return { kept: kept, used: used, cut: cut };
  }

  // What is sent on night `night` (1 to 31), given the memory built from nights before it.
  function sendFor(C, night, mem) {
    var entry = night <= 30 ? NIGHTS[night - 1].e : N31.e;
    var base = tok(SYS) + tok(entry);
    var room = C.budget - base;
    var out = { tokens: base, cut: 0, sent: [], facts: [], summary: null };
    if (C.mode === "whole") {
      var fw = fit(mem.stored, room);
      out.sent = fw.kept; out.cut = fw.cut; out.tokens += fw.used;
    } else if (C.mode === "summary") {
      var st = mem.summary.length ? tok(renderSummary(mem.summary)) : 0;
      var fs = fit(mem.recent, room - st);
      out.summary = mem.summary; out.sent = fs.kept; out.cut = fs.cut; out.tokens += st + fs.used;
    } else {
      var tags = night <= 30 ? [] : N31.tags;
      if (night <= 30) factsOfNight(night).forEach(function (f) { tags = tags.concat(f.tags); });
      var ranked = mem.facts.map(function (f) {
        var sc = 0;
        f.tags.forEach(function (t) { if (tags.indexOf(t) >= 0) sc += 1; });
        if (night > 30 && f.tags.indexOf("sister") >= 0) sc += 1;
        return { f: f, sc: sc };
      }).filter(function (x) { return x.sc > 0; });
      ranked.sort(function (a, b) { return (b.sc - a.sc) || (b.f.msg - a.f.msg); });
      var used = 0;
      for (var i = 0; i < ranked.length && out.facts.length < TOPK; i++) {
        var t = tok(factCard(ranked[i].f));
        if (used + t > room) break;
        out.facts.push(ranked[i].f); used += t;
      }
      out.tokens += used;
    }
    return out;
  }

  // Run the nights 1..k for settings C. Night k's send uses memory from nights before it.
  function simulate(C, k) {
    var mem = { stored: [], recent: [], summary: [], facts: [], deleted: false };
    var R = { nights: [], calls: 0, callTokens: 0, passes: [], total: 0, foldNight: 0 };
    for (var night = 1; night <= k; night++) {
      if (C.del && night === DEL_NIGHT) {
        mem.deleted = true;
        mem.stored = mem.stored.filter(function (m) { return m !== DEL_MSG; });
        mem.recent = mem.recent.filter(function (m) { return m !== DEL_MSG; });
        mem.facts = mem.facts.filter(function (f) { return f.msg !== DEL_MSG; });
      }
      var snd = sendFor(C, night, mem);
      R.nights.push({ night: night, tokens: snd.tokens, cut: snd.cut, send: snd });
      R.total += snd.tokens;
      if (night > 30) break;
      var a = 2 * night - 1;
      mem.stored.push(a, a + 1);
      mem.recent.push(a, a + 1);
      factsOfNight(night).forEach(function (f) { mem.facts.push(f); });
      if (C.mode === "summary" && mem.recent.length >= C.every) {
        var nights = [];
        mem.recent.forEach(function (m) { if (m % 2 && nights.indexOf((m + 1) / 2) < 0) nights.push((m + 1) / 2); });
        var oldTok = mem.summary.length ? tok(renderSummary(mem.summary)) : 0;
        var batchTok = 0;
        mem.recent.forEach(function (m) { batchTok += tok(msgText(m)); });
        var p = pass(mem.summary, nights, C, mem.deleted);
        mem.summary = p.s;
        mem.recent = [];
        R.calls += 1;
        R.callTokens += oldTok + batchTok;
        R.total += oldTok + batchTok;
        R.passes.push({ night: night, summary: clone(p.s), folded: p.folded });
        if (p.folded && !R.foldNight) R.foldNight = night;
      }
    }
    R.mem = mem;
    return R;
  }

  // Who and what the memory holds, by mode, as people with facts.
  function people(C, R) {
    var mem = R.mem;
    var last = R.nights.length ? R.nights[R.nights.length - 1].send : null;
    var map = {};
    var order = [];
    function add(name, f) {
      if (!map[name]) { map[name] = []; order.push(name); }
      map[name].push(f);
    }
    if (C.mode === "summary") {
      mem.summary.forEach(function (p) { p.facts.forEach(function (f) { add(p.name, f); }); });
      var lastN = null;
      mem.recent.forEach(function (m) {
        if (m % 2) factsOfNight((m + 1) / 2).forEach(function (f) { if (!(mem.deleted && f.msg === DEL_MSG)) add(f.who === "?" ? (lastN || mostSister(mem.summary)) : f.who, f); });
        msgNames(m).forEach(function (n) { lastN = n; });
      });
    } else if (C.mode === "whole") {
      var sent = last ? last.sent : mem.stored;
      FACTS.forEach(function (f) { if (sent.indexOf(f.msg) >= 0) add(f.owner, f); });
    } else {
      mem.facts.forEach(function (f) { add(f.owner, f); });
    }
    return { map: map, order: order };
  }

  function sisterState(pp) {
    var sis = pp.order.filter(function (n) { return SISTERS[n]; });
    var crossed = 0;
    var holder = null;
    sis.forEach(function (n) { pp.map[n].forEach(function (f) { if (f.owner !== n) { crossed += 1; holder = n; } }); });
    if (sis.length === 1 && crossed) return "1, merged: " + sis[0] + " holds " + crossed + " of " + (sis[0] === "Romilly" ? "Tegwen" : "Romilly") + "'s facts";
    if (sis.length === 2 && crossed) return "2, crossed: " + crossed + " of Tegwen's facts under " + holder;
    return sis.length + ", apart";
  }

  function deletedState(C, R) {
    if (!C.del) return "not deleted";
    if (R.nights.length < DEL_NIGHT) return "not yet deleted";
    var pp = people(C, R);
    var held = false;
    pp.order.forEach(function (n) { pp.map[n].forEach(function (f) { if (f.msg === DEL_MSG) held = true; }); });
    if (held && C.mode === "summary") return "survives in the summary";
    return held ? "still held" : "gone everywhere";
  }

  // The reply on night 31, from what was sent that night.
  function reply31(C, R) {
    var snd = R.nights[30].send;
    var mem = R.mem;
    var who = null;
    var facts = [];
    if (C.mode === "whole") {
      snd.sent.forEach(function (m) { msgNames(m).forEach(function (n) { who = n; }); });
      FACTS.forEach(function (f) { if (snd.sent.indexOf(f.msg) >= 0 && f.owner === who) facts.push(f); });
      facts.vh = FACTS.some(function (f) { return f.msg === DEL_MSG && snd.sent.indexOf(DEL_MSG) >= 0; });
    } else if (C.mode === "summary") {
      snd.sent.forEach(function (m) { msgNames(m).forEach(function (n) { who = n; }); });
      if (!who) who = mostSister(mem.summary);
      mem.summary.forEach(function (p) { if (p.name === who) facts = p.facts.slice(); });
      facts.vh = mem.summary.some(function (p) { return p.facts.some(function (f) { return f.msg === DEL_MSG; }); });
    } else {
      snd.facts.forEach(function (f) { if (!who && SISTERS[f.owner]) who = f.owner; });
      facts = snd.facts.filter(function (f) { return f.owner === who; });
      facts.vh = snd.facts.some(function (f) { return f.msg === DEL_MSG; });
    }
    if (!who) return "How is your sister getting on?";
    var place = null;
    var died = false;
    facts.forEach(function (f) { if (f.place) place = f.place; if (f.died) died = true; });
    var s = "How is " + who + " getting on" + (place ? " in " + place : "") + "?";
    if (died) s += " I know this year has been hard since she died.";
    if (facts.vh) s += " And please stop blaming yourself for the voicemail.";
    return s;
  }

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
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var memT = el("p", "margin:0;font-size:12px;font-weight:600;", "What it remembers");
    var mem = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;");
    var repT = el("p", "margin:0;font-size:12px;font-weight:600;", "Night 31's reply");
    var rep = el("p", "margin:0;font-size:12px;");
    var barT = el("p", "margin:0;font-size:12px;font-weight:600;", "Tokens sent each night (the budget is the line)");
    var bars = el("div", "display:flex;align-items:flex-end;gap:2px;height:80px;position:relative;border-bottom:1px solid currentColor;");
    [head, memT, mem, repT, rep, barT, bars].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, mem: mem, rep: rep, bars: bars };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    var k = R.nights.length;
    var modeName = C.mode === "summary" ? "rolling summary every " + C.every + " messages" + (C.exact ? ", prompt: keep names and relationships exact" : "") :
      (C.mode === "whole" ? "whole history every night" : "dated facts with retrieval");
    ui.head.textContent = "Memory: " + modeName + ". Budget: " + fmt(C.budget) + " tokens a night. " +
      (C.del ? "She deletes night 6's entry on night 12." : "Nothing deleted.") + " Night " + k + " of 31.";
    var txt;
    if (C.mode === "summary") {
      txt = R.mem.summary.length ? "Summary (written after night " + R.passes[R.passes.length - 1].night + "):\n" + renderSummary(R.mem.summary) : "No summary yet.";
      txt += "\nMessages since the last summary: " + R.mem.recent.length + ".";
    } else if (C.mode === "whole") {
      txt = "Stored messages: " + R.mem.stored.length + (k ? ". Sent on night " + k + ": " + R.nights[k - 1].send.sent.length + ", cut " + R.nights[k - 1].cut + "." : ".");
    } else {
      txt = R.mem.facts.length ? R.mem.facts.map(factCard).join("\n") : "No facts yet.";
      if (k) txt += "\nSent on night " + k + ": " + R.nights[k - 1].send.facts.length + " facts.";
    }
    ui.mem.textContent = txt;
    ui.rep.textContent = k === 31 ? "“" + reply31(C, R) + "”" : "Not yet: run to night 31.";
    while (ui.bars.firstChild) ui.bars.removeChild(ui.bars.firstChild);
    var top = Math.max(C.budget > 10000 ? 0 : C.budget, 1);
    R.nights.forEach(function (n) { if (n.tokens > top) top = n.tokens; });
    R.nights.forEach(function (n) {
      var h = Math.max(1, Math.round(n.tokens * 78 / top));
      var b = ui.el("div", "flex:1;min-width:2px;height:" + h + "px;background:currentColor;opacity:" + (n.cut ? "0.9" : "0.45") + ";");
      b.setAttribute("title", "Night " + n.night + ": " + fmt(n.tokens) + " tokens" + (n.cut ? ", " + n.cut + " messages cut" : ""));
      ui.bars.appendChild(b);
    });
    if (C.budget <= top) {
      var line = ui.el("div", "position:absolute;left:0;right:0;border-top:1px dashed currentColor;bottom:" + Math.round(C.budget * 78 / top) + "px;");
      ui.bars.appendChild(line);
    }
    var last = k ? R.nights[k - 1] : null;
    S.stat.night(k + " of 31");
    S.stat.sent(last ? fmt(last.tokens) : "none yet");
    S.stat.total(fmt(R.total));
    S.stat.year(fmt(YEAR));
    S.stat.calls(R.calls);
    S.stat.cut(last ? last.cut : 0);
    S.stat.sisters(k ? sisterState(people(C, R)) : "nothing kept yet");
    S.stat.deleted(deletedState(C, R));
  }

  function recompute(api, what) {
    var S = api.state;
    S.R = simulate(S.C, S.k);
    if (what) api.log(what + (S.k ? " Replayed to night " + S.k + "." : ""), "");
    draw(api);
  }

  function logNight(api) {
    var S = api.state;
    var R = S.R;
    var n = R.nights[S.k - 1];
    var s = "Night " + S.k + " (" + dateOf(S.k) + "): sent " + fmt(n.tokens) + " tokens" + (n.cut ? ", " + n.cut + " oldest messages cut to fit" : "") + ".";
    var p = R.passes.length ? R.passes[R.passes.length - 1] : null;
    if (p && p.night === S.k) s += " Summary " + R.passes.length + " written" + (p.folded ? ": over 20 facts, the two sisters folded into one, " + p.summary.filter(function (x) { return x.role === "sister"; })[0].name + "." : ".");
    if (S.k === DEL_NIGHT && S.C.del) s += " Before her entry she deleted night 6's entry (message 11); the deleted entry is " + deletedState(S.C, R) + ".";
    if (S.k === 31) s += " Reply: " + reply31(S.C, R);
    api.log(s, S.k === 31 && reply31(S.C, R).indexOf("Romilly getting on in") >= 0 ? "bad" : "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a4e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { mode: "summary", every: 20, exact: false, del: true, budget: ASBUILT };
      S.k = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Memory mode", MODES, "summary", function (v) {
        S.C.mode = String(v);
        recompute(api, "Memory mode: " + String(v) + ".");
      });
      S.ctl.every = api.control.select("every", "Summarise every N messages", EVERY.map(function (n) { return { value: String(n), label: n + (n === 20 ? " (as built)" : "") }; }), "20", function (v) {
        S.C.every = Number(v);
        recompute(api, "Summary every " + S.C.every + " messages.");
      });
      S.ctl.exact = api.control.toggle("exact", "Summariser prompt: keep names and relationships exact", false, function (on) {
        S.C.exact = !!on;
        recompute(api, "Keep names and relationships exact: " + (on ? "on." : "off."));
      });
      S.ctl.del = api.control.toggle("del", "She deletes night 6's entry on night 12", true, function (on) {
        S.C.del = !!on;
        recompute(api, "Delete night 6's entry on night 12: " + (on ? "on." : "off."));
      });
      S.ctl.budget = api.control.select("budget", "Token budget a night", BUDGETS.map(function (b) { return { value: String(b), label: fmt(b) + (b === ASBUILT ? " (as built)" : (b === 200000 ? " (the whole window)" : "")) }; }), String(ASBUILT), function (v) {
        S.C.budget = Number(v);
        recompute(api, "Token budget: " + fmt(S.C.budget) + " a night.");
      });
      S.ctl.next = api.control.button("next", "Next night", function () {
        if (S.k >= 31) return;
        S.k += 1;
        S.R = simulate(S.C, S.k);
        logNight(api);
        draw(api);
      });
      S.ctl.run = api.control.button("run", "Run to night 31", function () {
        while (S.k < 31) {
          S.k += 1;
          S.R = simulate(S.C, S.k);
          var p = S.R.passes.length ? S.R.passes[S.R.passes.length - 1] : null;
          if ((p && p.night === S.k) || S.k === DEL_NIGHT || S.k === 31 || S.R.nights[S.k - 1].cut) logNight(api);
        }
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        night: api.stat("night", "night", ""),
        sent: api.stat("sent", "tokens sent tonight", ""),
        total: api.stat("total", "tokens sent so far (replies and summaries)", ""),
        year: api.stat("year", "whole history a night, after a year at this rate", ""),
        calls: api.stat("calls", "summariser calls", ""),
        cut: api.stat("cut", "messages cut tonight to fit", "warn"),
        sisters: api.stat("sisters", "sisters in memory", "bad"),
        deleted: api.stat("deleted", "night 6's deleted entry", "bad")
      };
      api.info("<strong>How to read it.</strong> Each night Lowenna writes one entry and Nightleaf writes one reply. The panel shows what the app keeps: the summary, the stored messages, or the dated facts with the message each came from. The bars show the tokens sent each night against the budget. Run to night 31 to see the reply to “My sister rang tonight.”");
      S.R = simulate(S.C, 0);
      api.log("1 September 2026, before night 1: 30 nights of entries ahead, the summariser every 20 messages, a budget of 600 tokens a night.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var S = t.api.state;
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before night 1.
      t.expect(t.stat("night") === "0 of 31" && t.stat("sent") === "none yet" && t.stat("total") === 0 && t.stat("calls") === 0 &&
        t.stat("sisters") === "nothing kept yet" && has("before night 1"),
        "Opens before night 1: nothing sent, nothing kept");

      // 2. The data: 24 facts, 5 said as \"my sister\", all Tegwen's.
      var q = FACTS.filter(function (f) { return f.who === "?"; });
      t.expect(FACTS.length === 24 && q.length === 5 && q.every(function (f) { return f.owner === "Tegwen"; }) && tok(SYS) === 36,
        "24 facts in 30 entries; the 5 said as my sister are all Tegwen's; the system prompt is 36 tokens");

      // 3. Night 1 as built.
      t.click("next");
      t.expect(t.stat("night") === "1 of 31" && t.stat("sent") === 66 && has("Night 1 (1 Sep): sent 66 tokens."),
        "Night 1 sends 66 tokens: the system prompt and her first entry");

      // 4. As built to night 10: summary 1 keeps the sisters apart.
      for (var i = 0; i < 9; i++) t.click("next");
      t.expect(t.stat("calls") === 1 && t.stat("sisters") === "2, apart" && has("Summary 1 written."),
        "After night 10, summary 1: two sisters, apart");

      // 5. Night 20: summary 2 files night 11's hospital week under Romilly.
      for (i = 0; i < 10; i++) t.click("next");
      t.expect(t.stat("calls") === 2 && t.stat("sisters") === "2, crossed: 1 of Tegwen's facts under Romilly" &&
        t.stat("deleted") === "survives in the summary",
        "After night 20, summary 2: one of Tegwen's facts under Romilly; the deleted entry survives");

      // 6. Night 31: the merge and the reply.
      t.click("run");
      t.expect(t.stat("calls") === 3 && t.stat("sisters") === "1, merged: Romilly holds 5 of Tegwen's facts" &&
        has("Summary 3 written: over 20 facts, the two sisters folded into one, Romilly.") &&
        has("Reply: How is Romilly getting on in Carrowmere? I know this year has been hard since she died. And please stop blaming yourself for the voicemail."),
        "Summary 3 folds the sisters under Romilly; night 31 asks how Romilly is getting on in Carrowmere and mentions the deleted voicemail");
      var asBuilt = S.R;

      // 7. Option 1: summarise every 10 messages. More calls, the fold sooner, the same reply.
      t.set("every", "10");
      var r1 = S.R;
      t.expect(r1.calls === 6 && r1.foldNight === 25 && reply31(S.C, r1) === reply31({ mode: "summary" }, asBuilt) &&
        t.stat("deleted") === "survives in the summary",
        "Every 10 messages: 6 summariser calls, the sisters fold on night 25, the same reply, the deleted entry survives");

      // 8. Option 2: the exact prompt. No fold, but Tegwen's facts still land under Romilly and the voicemail stays.
      t.set("every", "20");
      t.set("exact", true);
      var r2 = S.R;
      var st2 = sisterState(people(S.C, r2));
      t.expect(r2.foldNight === 0 && st2.indexOf("2, crossed") === 0 && reply31(S.C, r2).indexOf("Romilly getting on in Carrowmere") >= 0 &&
        reply31(S.C, r2).indexOf("voicemail") >= 0,
        "Exact prompt: no fold, but Romilly still holds Carrowmere and the voicemail is still in the summary");
      t.set("exact", false);

      // 9. Option 0: whole history in the whole window: apart, deleted gone, Tegwen asked after; and the tokens.
      t.set("mode", "whole");
      t.set("budget", "200000");
      var r0 = S.R;
      t.expect(t.stat("sisters") === "2, apart" && t.stat("deleted") === "gone everywhere" && t.stat("cut") === 0 &&
        reply31(S.C, r0) === "How is Tegwen getting on in Carrowmere?",
        "Whole history, whole window: sisters apart, the deleted entry gone, the reply asks after Tegwen");

      // 10. Whole history at the as-built budget: the oldest nights are cut, Romilly's death among them.
      t.set("budget", "2000");
      var rc = S.R;
      t.expect(rc.nights[30].cut > 0 && rc.nights[30].send.sent.indexOf(1) < 0 && t.stat("cut") === rc.nights[30].cut,
        "Whole history at 2,000 tokens: night 31 cuts the oldest messages, night 1 among them");

      // 11. Option 3: dated facts with retrieval.
      t.set("mode", "facts");
      var r3 = S.R;
      t.expect(t.stat("sisters") === "2, apart" && t.stat("deleted") === "gone everywhere" && t.stat("calls") === 0 &&
        reply31(S.C, r3) === "How is Tegwen getting on in Carrowmere?" && r3.nights[30].send.facts.length === 6,
        "Dated facts: 6 facts retrieved, sisters apart, the deleted fact gone, the reply asks after Tegwen in Carrowmere");
    }
  });
})();
