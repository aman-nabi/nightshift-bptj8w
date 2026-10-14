/* sims/a6e03-v1.0.0.js  (published as sims/a6e03.js)
   Case a6e03 "Asking Twice Costs Twice": a cache log for Bexendale's, a 24-hour pawnshop whose
   assistant answers customers' texts. The learner replays the week's 300 questions (Monday 12
   October 09:00 to Friday 16 October 02:20) through the shop's answer cache under different
   rules, and reads the hits, the wrong answers and the cost. No real model runs here: every
   score is stated in the list below. Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: Replay the week, the threshold (0.90 as since
     Monday, 0.95 as in the first three weeks), the cache rule (meaning for every question,
     exact repeats only, or exact keys for named tickets with meaning for the rest), how long
     answers are kept (24 hours, or emptied at each shift change, 08:00 and 20:00), prompt
     caching of the shop policy (off, five-minute life, one-hour life), what the table shows,
     a plan (one of the four replies), Reset. Stats: questions, hits, hit rate, wrong ticket
     answers, model calls, policy reads, policy saves, cost in full calls, cost per question, the
     02:20 question, the ring test. selfTest: 10 assertions.

   The model (stated in sim.lede).
   - ROWS holds the 300 questions in order: [minutes after Monday 09:00, kind ("t" names a
     ticket, "g" is a general shop question), ticket number or general question id, wording
     (questions with the same id and wording are the same words), index of the closest earlier
     question or -1, its similarity score x 100, topic of a general question].
   - A question is a hit when its closest earlier question is still saved, still kept (24 hours,
     or the same shift), and the rule allows it: meaning, score >= threshold; exact, the same
     words (score 1.00); tickets, the same words for a ticket question, score >= threshold for
     a general one. A hit sends the saved answer; it is wrong when the two questions are about
     different tickets. A miss asks the model, and its answer is saved.
   - Cost, in units of 1/10,000 of a full call. A full call: the 9,000-token shop policy, about
     250 tokens of question and ticket line, and about 150 tokens of answer, output priced at five
     times input: 9,000 + 250 + 750 = 10,000. Prompt caching: a call within the life (5 or 60
     minutes) of the previous model call reads the policy at 0.1: 900 + 1,000 = 1,900. Otherwise
     it saves the policy again: 1.25 for five minutes (11,250 + 1,000 = 12,250) or 2 for one hour
     (18,000 + 1,000 = 19,000). A hit asks no model and costs nothing here.
   - The ring test pair (stated, not in the week): "Can I pawn my ring tonight?" then "Can I pawn
     my ring tomorrow?", score 0.96, different answers. General questions, so the meaning rules
     match it at either threshold; only exact repeats keep it apart.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e03-v1.0.0.json).
   - Meaning, 0.90, 24 hours: 93 hits of 300 (31%), 4 wrong: Q106 Tue 16:10 ticket 4582 got
     Q84's (4528, 0.92); Q209 Wed 22:45 4793 got Q193's (4739, 0.94); Q250 Thu 13:50 5160 got
     Q225's (5106, 0.91); Q300 Fri 02:20 4471 got Q296's (4417, Thu 21:05, 0.93). 207 model calls,
     cost 207.00 full calls, 0.69 a question.
   - Meaning, 0.95: 36 hits (12%), none wrong; 264 calls, 0.88 a question. The ring pair, 0.96, hits.
   - Exact repeats only: 9 hits (3%); 291 calls, 0.97 a question.
   - Emptied at 08:00 and 20:00, 0.90: 72 hits (24%), 3 wrong (4582, 5160, 4471); Q209's match,
     asked at 18:30 and again at 22:45, was emptied at 20:00. 228 calls, 0.76.
   - Tickets exact, the rest by meaning at 0.90: 75 hits (25%), none wrong; 225 calls, 0.75. With
     a five-minute policy cache: 47 reads, 178 saves, 226.98 full calls, 0.76. With a one-hour
     cache: 201 reads, 24 saves, 83.79 full calls, 0.28.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var ROWS = [
    [36,"t",4685,0,-1,0,0],[48,"g",55,0,-1,0,7],[65,"g",55,1,1,91,7],[71,"g",73,0,1,77,0],[80,"t",4875,0,0,74,0],[81,"t",4875,1,4,96,0],[89,"g",8,0,1,78,0],[93,"g",43,0,6,76,8],
    [99,"g",64,0,-1,0,8],[102,"g",64,1,8,90,8],[113,"g",8,1,6,93,0],[118,"g",43,1,7,90,8],[160,"g",70,0,8,72,6],[163,"g",70,1,12,91,6],[178,"g",48,0,6,76,5],[193,"g",48,1,14,99,5],
    [197,"t",4590,0,0,87,0],[200,"g",74,0,14,75,4],[215,"g",32,0,1,79,6],[216,"g",32,1,18,96,6],[247,"g",65,0,-1,0,0],[255,"t",5190,0,-1,0,0],[259,"g",72,0,-1,0,1],[264,"t",5032,0,4,71,0],
    [268,"g",53,0,8,88,3],[277,"t",4612,2,21,80,0],[318,"g",65,1,20,92,0],[328,"g",75,0,8,74,4],[355,"t",4612,3,25,97,0],[371,"g",72,1,22,93,1],[375,"t",4956,0,16,88,0],[383,"g",76,0,-1,0,8],
    [405,"t",4759,0,4,79,0],[416,"g",12,0,6,83,4],[438,"g",12,1,33,92,4],[445,"g",77,0,12,85,2],[449,"t",4923,2,-1,0,0],[455,"g",78,0,-1,0,6],[465,"g",79,0,22,80,7],[477,"g",53,1,24,99,3],
    [493,"g",80,0,-1,0,7],[498,"g",5,0,38,73,5],[503,"g",15,0,-1,0,3],[505,"g",81,0,37,87,3],[517,"g",31,0,38,70,1],[519,"g",31,1,44,95,1],[531,"t",4961,0,25,73,0],[543,"g",82,0,35,77,2],
    [551,"g",83,0,43,77,7],[553,"g",84,0,38,80,4],[571,"g",57,0,-1,0,2],[589,"t",4807,0,36,80,0],[607,"g",57,1,50,92,2],[615,"t",4807,1,51,95,0],[618,"g",85,0,-1,0,2],[654,"g",15,0,42,100,3],
    [698,"g",68,0,38,81,9],[712,"g",68,1,56,90,9],[720,"g",86,0,-1,0,7],[780,"g",39,0,-1,0,6],[857,"g",87,0,59,87,3],[928,"t",4719,0,30,70,0],[997,"g",52,0,56,79,7],[1016,"g",5,1,41,91,5],
    [1122,"g",35,0,54,71,4],[1178,"t",4769,0,30,75,0],[1259,"g",88,0,48,71,8],[1341,"t",4712,2,51,73,0],[1390,"g",89,0,-1,0,5],[1407,"g",90,0,48,87,9],[1484,"g",91,0,50,76,9],[1485,"t",4639,0,61,74,0],
    [1489,"g",19,0,54,81,5],[1499,"t",4730,0,30,81,0],[1500,"g",92,0,56,75,3],[1503,"g",93,0,69,82,5],[1511,"g",94,0,64,70,3],[1517,"g",13,0,-1,0,1],[1561,"g",13,0,77,100,1],[1577,"t",5129,0,32,81,0],
    [1582,"t",4539,2,-1,0,0],[1588,"g",95,0,62,80,8],[1596,"t",4819,0,-1,0,0],[1600,"t",4528,0,-1,0,0],[1612,"g",26,0,77,86,4],[1620,"g",52,1,62,90,7],[1627,"g",49,0,-1,0,7],[1639,"t",5129,1,79,91,0],
    [1641,"g",96,0,-1,0,4],[1651,"g",97,0,68,78,2],[1661,"g",49,1,86,93,7],[1711,"t",4712,3,67,93,0],[1726,"g",98,0,76,86,2],[1730,"g",33,0,-1,0,9],[1773,"g",10,0,88,86,2],[1781,"t",4357,2,61,81,0],
    [1785,"g",10,1,94,91,2],[1790,"g",19,1,72,90,5],[1813,"t",4378,0,65,73,0],[1817,"g",34,0,84,87,7],[1824,"g",35,1,64,91,4],[1828,"t",5139,2,95,73,0],[1831,"t",4501,0,79,85,0],[1840,"g",99,0,86,78,6],
    [1858,"t",5139,3,101,95,0],[1870,"t",4582,0,83,92,0],[1890,"g",100,0,94,74,4],[1896,"g",40,0,92,70,7],[1906,"t",4378,0,98,100,0],[1919,"g",33,1,93,94,9],[1930,"g",101,0,99,84,9],[1938,"t",4972,0,95,85,0],
    [1952,"g",27,0,-1,0,6],[1968,"g",102,0,86,84,6],[1992,"g",103,0,110,86,1],[2000,"t",4368,2,73,87,0],[2002,"g",34,1,99,92,7],[2055,"g",104,0,106,76,8],[2056,"g",27,1,112,90,6],[2066,"g",39,1,59,92,6],
    [2092,"g",20,0,94,79,2],[2097,"g",105,0,103,82,0],[2157,"t",4368,2,115,100,0],[2174,"g",40,1,107,98,7],[2193,"g",20,1,120,91,2],[2308,"g",106,0,-1,0,2],[2327,"g",24,0,112,75,7],[2480,"g",14,0,110,71,0],
    [2591,"t",5087,0,-1,0,0],[2648,"t",4786,0,111,82,0],[2728,"t",4786,1,129,93,0],[2772,"g",25,0,-1,0,9],[2869,"g",58,0,126,78,8],[2886,"t",5184,0,80,83,0],[2888,"t",5184,1,133,93,0],[2914,"g",44,0,-1,0,6],
    [2928,"g",26,1,84,95,4],[2937,"g",44,0,135,100,6],[2940,"g",56,0,-1,0,1],[2944,"g",56,1,138,93,1],[2959,"g",107,0,-1,0,6],[2966,"g",108,0,-1,0,4],[2981,"t",5079,0,95,75,0],[3005,"g",23,0,-1,0,8],
    [3006,"t",5079,1,142,98,0],[3046,"g",45,0,138,81,6],[3048,"g",46,0,135,84,1],[3050,"g",46,1,146,90,1],[3051,"g",50,0,-1,0,3],[3076,"g",1,0,131,87,4],[3081,"g",23,0,143,100,8],[3106,"g",28,0,-1,0,8],
    [3109,"g",109,0,140,75,7],[3116,"g",110,0,135,72,5],[3130,"t",4897,2,133,81,0],[3133,"t",4706,0,-1,0,0],[3143,"t",4598,2,133,84,0],[3172,"g",14,1,127,91,0],[3174,"g",69,0,-1,0,4],[3183,"g",69,1,158,96,4],
    [3200,"g",45,1,145,95,6],[3202,"t",4908,0,115,75,0],[3207,"g",22,0,158,88,9],[3210,"g",111,0,148,83,4],[3213,"g",71,0,145,87,1],[3250,"t",4562,0,-1,0,0],[3262,"g",22,1,162,91,9],[3291,"t",4562,1,165,92,0],
    [3296,"g",71,1,164,94,1],[3311,"g",58,0,132,100,8],[3312,"g",4,0,158,78,4],[3313,"g",67,0,-1,0,8],[3314,"g",4,1,170,94,4],[3329,"g",9,0,171,88,4],[3332,"g",62,0,-1,0,9],[3337,"g",112,0,173,81,9],
    [3342,"t",4750,2,-1,0,0],[3347,"t",5168,2,129,82,0],[3350,"g",113,0,151,81,8],[3356,"t",5021,2,177,74,0],[3357,"g",42,0,-1,0,2],[3376,"g",28,1,151,92,8],[3387,"g",42,1,180,91,2],[3393,"g",62,1,174,92,9],
    [3405,"t",4389,2,177,71,0],[3406,"g",114,0,-1,0,8],[3414,"g",61,0,170,80,4],[3416,"g",67,1,171,97,8],[3418,"g",1,1,149,96,4],[3424,"g",61,1,186,92,4],[3425,"t",4832,0,165,72,0],[3426,"g",24,1,126,96,7],
    [3450,"t",4739,0,190,76,0],[3508,"g",59,0,-1,0,4],[3532,"t",5048,0,-1,0,0],[3536,"g",59,1,193,91,4],[3549,"t",4389,3,184,93,0],[3571,"t",5048,1,194,97,0],[3583,"g",63,0,171,74,1],[3598,"g",50,1,148,96,3],
    [3605,"g",30,0,175,87,5],[3612,"g",63,1,198,93,1],[3617,"g",29,0,185,77,0],[3620,"g",30,1,200,93,5],[3651,"g",115,0,-1,0,7],[3655,"g",116,0,178,76,8],[3658,"g",117,0,180,73,0],[3669,"g",29,0,202,100,0],
    [3705,"t",4793,0,192,94,0],[3903,"g",118,0,-1,0,1],[4058,"g",7,0,185,75,4],[4103,"g",36,0,193,72,3],[4111,"g",2,0,211,84,8],[4143,"t",5149,0,-1,0,0],[4155,"g",119,0,209,82,6],[4180,"g",120,0,202,76,3],
    [4194,"g",25,1,131,90,9],[4255,"g",7,1,210,99,4],[4320,"g",54,0,205,73,1],[4330,"t",4861,0,184,75,0],[4360,"t",4853,2,192,86,0],[4364,"g",37,0,-1,0,1],[4372,"g",54,1,218,90,1],[4374,"g",36,1,211,91,3],
    [4395,"t",5106,0,-1,0,0],[4406,"t",5173,0,-1,0,0],[4414,"g",37,1,221,91,1],[4430,"t",4725,0,194,76,0],[4431,"g",41,0,-1,0,3],[4436,"t",5124,0,220,71,0],[4460,"g",121,0,-1,0,5],[4488,"g",60,0,215,77,6],
    [4492,"g",38,0,212,88,7],[4499,"g",6,0,232,70,8],[4500,"g",16,0,-1,0,0],[4510,"t",4517,2,-1,0,0],[4528,"g",9,1,173,91,4],[4532,"t",4982,2,184,72,0],[4540,"g",17,0,-1,0,4],[4545,"g",122,0,-1,0,9],
    [4550,"t",5149,0,213,100,0],[4558,"g",18,0,239,70,9],[4561,"t",4982,3,237,99,0],[4567,"g",123,0,221,88,1],[4571,"g",124,0,233,78,1],[4582,"g",125,0,239,84,1],[4584,"t",4781,0,-1,0,0],[4593,"t",4651,0,235,80,0],
    [4609,"g",6,1,233,95,8],[4610,"t",5160,0,224,91,0],[4615,"g",126,0,-1,0,6],[4617,"g",60,1,231,92,6],[4624,"g",127,0,238,71,6],[4626,"g",128,0,243,73,5],[4630,"g",51,0,253,73,1],[4641,"g",129,0,233,73,0],
    [4647,"g",11,0,-1,0,3],[4658,"g",2,1,212,94,8],[4664,"g",130,0,-1,0,5],[4678,"t",5026,2,-1,0,0],[4683,"g",51,1,254,93,1],[4686,"t",4630,0,-1,0,0],[4690,"g",66,0,243,85,1],[4703,"g",131,0,241,71,3],
    [4704,"g",11,1,256,95,3],[4712,"t",5178,2,-1,0,0],[4715,"g",38,1,232,96,7],[4722,"t",5072,2,259,86,0],[4730,"g",47,0,-1,0,7],[4732,"g",18,1,241,92,9],[4733,"t",4827,2,229,71,0],[4735,"g",132,0,258,73,0],
    [4742,"g",133,0,271,70,6],[4763,"g",134,0,253,80,5],[4764,"g",47,1,268,97,7],[4766,"g",135,0,258,88,0],[4789,"t",5063,0,246,87,0],[4792,"g",41,1,228,90,3],[4797,"g",66,1,262,97,1],[4810,"t",4576,0,235,84,0],
    [4843,"g",3,0,258,87,6],[4848,"g",3,1,280,98,6],[4856,"g",17,1,238,97,4],[4869,"g",136,0,280,72,5],[4910,"g",137,0,-1,0,7],[4925,"g",138,0,-1,0,3],[4941,"g",16,1,234,92,0],[4947,"g",139,0,258,85,9],
    [4951,"t",4523,2,270,84,0],[4970,"g",140,0,268,87,6],[4986,"t",4630,1,261,91,0],[4992,"t",5013,2,-1,0,0],[5001,"g",21,0,273,77,4],[5032,"g",141,0,289,83,5],[5042,"g",21,1,292,91,4],[5045,"t",4417,0,288,84,0],
    [5205,"t",4902,0,276,70,0],[5285,"t",5037,2,259,88,0],[5353,"t",4351,2,-1,0,0],[5360,"t",4471,0,295,93,0]
  ];
  var TOPICS = ["opening hours", "the valuer's hours", "gold prices", "what ID to bring", "interest", "extending a loan",
    "a lost ticket", "selling outright", "what we take", "parking"];
  var WORDING = ["When is the last day to collect ticket ", "What's the last day for ticket ", "How much to collect ticket ", "What do I owe on ticket "];
  var ITEMS = {
    4417: "the brass carriage clock, last day Monday 2 November",
    4471: "the gold ring, last day Monday 9 November",
    4528: "a silver cigarette case, last day 16 November",
    4582: "a pair of gold earrings, last day 23 November",
    4739: "a set of golf clubs, last day 13 December",
    4793: "an accordion, last day 20 December",
    5106: "a trumpet, last day 30 January",
    5160: "a laptop, last day 6 February"
  };
  var FULL = 10000;                                   // a full call, in input-token units
  var PC = {
    off: { label: "Off (as built)", life: 0, save: FULL, read: FULL },
    m5: { label: "On, five-minute life", life: 5, save: 12250, read: 1900 },
    h1: { label: "On, one-hour life", life: 60, save: 19000, read: 1900 }
  };
  var RULES = [
    { value: "meaning", label: "Meaning-based for every question (as built)" },
    { value: "exact", label: "Exact repeats only" },
    { value: "tickets", label: "Exact keys for named tickets, meaning for the rest" }
  ];
  var LIVES = [
    { value: "24h", label: "24 hours (as built)" },
    { value: "shift", label: "Emptied at each shift change, 08:00 and 20:00" }
  ];
  var THRESHOLDS = [
    { value: "90", label: "0.90 (since Monday)" },
    { value: "95", label: "0.95 (first three weeks)" }
  ];
  var VIEWS = [
    { value: "wrong", label: "Answers about another ticket" },
    { value: "tonight", label: "Tonight, from Thursday 20:00" },
    { value: "hits", label: "Every hit" }
  ];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: threshold back to 0.95" },
    { value: "r1", label: "Reply: exact repeats only" },
    { value: "r2", label: "Reply: empty at every shift change" },
    { value: "r3", label: "Reply: exact keys for tickets, cache the policy" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(m) {
    var t = m + 540;
    return ["Mon", "Tue", "Wed", "Thu", "Fri"][Math.floor(t / 1440)] + " " + two(Math.floor(t % 1440 / 60)) + ":" + two(t % 60);
  }
  function shift(m) { return Math.floor((m + 540 - 480) / 720); }
  function score(n) { return n === 100 ? "1.00" : "0." + two(n); }
  function units(u) { return (u / FULL).toFixed(2); }
  function question(r) {
    if (r[1] === "t") return WORDING[r[3]] + r[2] + "?";
    return "General, about " + TOPICS[r[6]] + (r[3] ? ", in other words" : "");
  }
  function defaults() { return { th: 90, rule: "meaning", life: "24h", pc: "off", view: "wrong", plan: "none" }; }

  /* ---------- the model (pure: config in, replay out) ---------- */

  function replay(C) {
    var saved = [], out = [], hits = 0, wrong = [], calls = 0, reads = 0, saves = 0, cost = 0, prev = -1;
    var pc = PC[C.pc];
    for (var i = 0; i < ROWS.length; i++) {
      var r = ROWS[i], a = r[4] >= 0 ? ROWS[r[4]] : null, res = { i: i, hit: false, why: "" };
      if (!a) res.why = "nothing close saved";
      else if (!saved[r[4]]) res.why = "closest was itself a hit, not saved";
      else if (C.life === "24h" ? r[0] - a[0] >= 1440 : shift(r[0]) !== shift(a[0])) res.why = C.life === "24h" ? "closest older than 24 hours" : "closest emptied at the shift change";
      else {
        var exact = r[5] === 100;
        var ok = C.rule === "exact" ? exact : (C.rule === "tickets" && r[1] === "t" ? exact : r[5] >= C.th);
        if (ok) res.hit = true;
        else res.why = C.rule === "meaning" || (C.rule === "tickets" && r[1] === "g") ? "below " + score(C.th) :
          (C.rule === "exact" ? "not the same words" : "a ticket needs the same words");
      }
      if (res.hit) {
        hits++;
        res.right = a[1] === r[1] && a[2] === r[2];
        if (!res.right) wrong.push(i);
      } else {
        saved[i] = true;
        calls++;
        if (C.pc === "off") cost += FULL;
        else if (prev >= 0 && r[0] - prev < pc.life) { cost += pc.read; reads++; }
        else { cost += pc.save; saves++; }
        prev = r[0];
      }
      out.push(res);
    }
    var ring = C.rule === "exact" ? "asked the model: right" : (96 >= C.th ? "0.96: sent the saved answer, wrong" : "asked the model: right");
    return { out: out, hits: hits, wrong: wrong, calls: calls, reads: reads, saves: saves, cost: cost, ring: ring };
  }

  function lastLine(R) {
    var x = R.out[299], r = ROWS[299], a = ROWS[r[4]];
    var near = "closest saved " + when(a[0]) + " ticket " + a[2] + ", " + score(r[5]);
    return x.hit ? near + ", sent the saved answer: " + ITEMS[a[2]] + ". Wrong." :
      near + ", " + x.why + ": the model answered: " + ITEMS[4471] + ". Right.";
  }

  function wrongList(R) {
    if (!R.wrong.length) return "No answer about another ticket.";
    return "Answers about another ticket: " + R.wrong.map(function (i) {
      var r = ROWS[i], a = ROWS[r[4]];
      return when(r[0]) + " ticket " + r[2] + " got " + a[2] + "'s (" + score(r[5]) + ")";
    }).join("; ") + ".";
  }

  function summary(C, R) {
    var rule = pick(RULES, C.rule).label.replace(" (as built)", "").toLowerCase();
    var th = C.rule === "exact" ? "" : ", threshold " + score(C.th);
    return "Replay, " + rule + th + ", kept " + (C.life === "24h" ? "24 hours" : "until the shift change") +
      ", prompt caching " + PC[C.pc].label.replace(" (as built)", "").toLowerCase() + ": " + R.hits + " hits of 300 (" +
      Math.round(R.hits * 100 / 300) + "%), " + R.wrong.length + " about another ticket. " + R.calls + " model calls" +
      (C.pc === "off" ? "" : " (" + R.reads + " read the saved policy, " + R.saves + " saved it again)") +
      ", " + units(R.cost) + " full calls, " + units(R.cost / 300) + " a question. Fri 02:20 ticket 4471: " + lastLine(R);
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    var wrap = el("div", "overflow-x:auto;max-height:340px;overflow-y:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var foot = el("p", "margin:0;", "", box);
    return { el: el, head: head, table: table, foot: foot };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui, R = S.R;
    ui.head.textContent = "Rule: " + pick(RULES, C.rule).label + ". Threshold: " + (C.rule === "exact" ? "not used" : score(C.th)) +
      ". Kept: " + pick(LIVES, C.life).label + ". Prompt caching: " + PC[C.pc].label + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["#", "when", "question", "closest earlier", "score", "result"], true);
    if (!R) { ui.foot.textContent = "Monday 09:00. The threshold is now 0.90 and the cache is empty. Nothing replayed yet."; return; }
    R.out.forEach(function (x) {
      var r = ROWS[x.i];
      var show = C.view === "hits" ? x.hit : (C.view === "wrong" ? x.hit && !x.right : r[0] >= 4980);
      if (!show) return;
      var a = r[4] >= 0 ? ROWS[r[4]] : null;
      var res = x.hit ? (x.right ? "hit: saved answer, right" : "hit: sent " + ITEMS[a[2]] + ", WRONG") : "miss (" + x.why + "): the model answered";
      row(ui, ["Q" + (x.i + 1), when(r[0]), question(r), a ? "Q" + (r[4] + 1) + ", " + when(a[0]) : "-", a ? score(r[5]) : "-", res]);
    });
    ui.foot.textContent = "Ring test pair (\"Can I pawn my ring tonight?\", then \"... tomorrow?\"): " + R.ring + ".";
  }

  function setStats(api) {
    var S = api.state, R = S.R, st = S.stat;
    if (!R) {
      st.questions(0); st.hits(0); st.rate("-"); st.wrong(0); st.calls(0); st.reads(0); st.saves(0);
      st.cost("-"); st.per("-"); st.last("not replayed yet"); st.ring("not replayed yet");
      return;
    }
    st.questions(300);
    st.hits(R.hits);
    st.rate(Math.round(R.hits * 100 / 300) + "%");
    st.wrong(R.wrong.length);
    st.calls(R.calls);
    st.reads(R.reads);
    st.saves(R.saves);
    st.cost(units(R.cost));
    st.per(units(R.cost / 300));
    st.last(R.out[299].hit ? "sent the clock's answer: wrong" : "asked the model: the gold ring");
    st.ring(R.ring);
  }

  function run(api, what) {
    var S = api.state;
    S.R = replay(S.C);
    draw(api);
    setStats(api);
    api.log((what ? what + " " : "") + summary(S.C, S.R), S.R.wrong.length ? "bad" : "ok");
    api.log(wrongList(S.R), S.R.wrong.length ? "bad" : "");
  }

  function planOutcome(plan) {
    var C = defaults();
    if (plan === "r0") return "Cost back up from 0.69 to 0.88 a question. Ring test pair: " + replay({ th: 95, rule: "meaning", life: "24h", pc: "off" }).ring + ".";
    if (plan === "r1") return "Safe, and 9 hits in 300: the cost per question falls only from 1.00 to 0.97.";
    if (plan === "r2") return "Tonight's 21:05 and 02:20 sit in one night shift, 20:00 to 08:00, so emptying at 20:00 and 08:00 never separates them.";
    C.rule = "tickets";
    var off = replay(C);
    C.pc = "m5";
    var m5 = replay(C);
    return "Policy caching: off " + units(off.cost / 300) + " a question; five-minute life " + units(m5.cost / 300) +
      " (" + m5.saves + " of " + m5.calls + " calls found the saved policy gone and saved it again); one-hour life, as played, 0.28.";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        run(api, what);
      }
      S.ctl.replay = api.control.button("replay", "Replay the week", function () { run(api, ""); });
      S.ctl.th = api.control.select("th", "Threshold", THRESHOLDS, "90", function (v) {
        var o = pick(THRESHOLDS, v);
        if (!o) return;
        S.C.th = Number(o.value);
        manual("Threshold: " + o.label + ".");
      });
      S.ctl.rule = api.control.select("rule", "Cache rule", RULES, "meaning", function (v) {
        var o = pick(RULES, v);
        if (!o) return;
        S.C.rule = String(o.value);
        manual("Rule: " + o.label + ".");
      });
      S.ctl.life = api.control.select("life", "How long answers are kept", LIVES, "24h", function (v) {
        var o = pick(LIVES, v);
        if (!o) return;
        S.C.life = String(o.value);
        manual("Kept: " + o.label + ".");
      });
      S.ctl.pc = api.control.select("pc", "Prompt caching of the 9,000-token policy", Object.keys(PC).map(function (k) { return { value: k, label: PC[k].label }; }), "off", function (v) {
        if (!PC[v]) return;
        S.C.pc = String(v);
        manual("Prompt caching: " + PC[v].label + ".");
      });
      S.ctl.view = api.control.select("view", "The table shows", VIEWS, "wrong", function (v) {
        var o = pick(VIEWS, v);
        if (!o) return;
        S.C.view = String(o.value);
        draw(api);
      });
      S.ctl.plan = api.control.select("plan", "Play a reply (replays the week)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = defaults();
        C.plan = String(o.value);
        C.view = S.C.view;
        if (C.plan === "r0") C.th = 95;
        if (C.plan === "r1") C.rule = "exact";
        if (C.plan === "r2") C.life = "shift";
        if (C.plan === "r3") { C.rule = "tickets"; C.pc = "h1"; }
        S.C = C;
        S.ctl.th.set(String(C.th)); S.ctl.rule.set(C.rule); S.ctl.life.set(C.life); S.ctl.pc.set(C.pc);
        run(api, "Plan: " + o.label + ".");
        api.log(planOutcome(C.plan), "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        questions: api.stat("questions", "questions replayed", ""),
        hits: api.stat("hits", "hits: saved answer sent", ""),
        rate: api.stat("rate", "hit rate", ""),
        wrong: api.stat("wrong", "answers about another ticket", "bad"),
        calls: api.stat("calls", "model calls", ""),
        reads: api.stat("reads", "calls that read the saved policy", ""),
        saves: api.stat("saves", "calls that saved the policy again", ""),
        cost: api.stat("cost", "cost, in full calls", ""),
        per: api.stat("per", "cost per question, in full calls", "warn"),
        last: api.stat("last", "Fri 02:20, ticket 4471", "bad"),
        ring: api.stat("ring", "ring test pair", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one question from the week. The closest earlier question and its similarity score come from the shop's log. A hit sends that question's saved answer without asking the model; a miss asks the model and saves its answer. Cost counts model calls only: a full call is 1.00.");

      draw(api);
      setStats(api);
      api.log("Monday 09:00. Threshold set to 0.90 and the cache emptied. 300 questions follow, the last at Fri 02:20; nothing replayed yet.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. The opening state: Monday 09:00, nothing replayed.
      t.expect(t.stat("hits") === 0 && t.stat("questions") === 0 && t.stat("last") === "not replayed yet" &&
        t.logText().indexOf("Monday 09:00. Threshold set to 0.90 and the cache emptied. 300 questions follow, the last at Fri 02:20; nothing replayed yet.") >= 0,
        "Opens at Monday 09:00 with nothing replayed");

      // 2. As built: 0.90, meaning for every question, 24 hours.
      begin();
      t.click("replay");
      t.expect(t.stat("hits") === 93 && t.stat("rate") === "31%" && t.stat("wrong") === 4 && t.stat("calls") === 207 &&
        t.stat("cost") === 207 && t.stat("per") === 0.69 &&
        has("Fri 02:20 ticket 4471: closest saved Thu 21:05 ticket 4417, 0.93, sent the saved answer: the brass carriage clock, last day Monday 2 November. Wrong."),
        "0.90: 93 hits of 300 (31%), 4 wrong, 0.69 a question; 4471 at 02:20 gets 4417's clock at 0.93");

      // 3. The three earlier wrong answers nobody reported.
      t.expect(has("Answers about another ticket: Tue 16:10 ticket 4582 got 4528's (0.92); Wed 22:45 ticket 4793 got 4739's (0.94); Thu 13:50 ticket 5160 got 5106's (0.91); Fri 02:20 ticket 4471 got 4417's (0.93)."),
        "Three more since Monday: 4582, 4793 and 5160, scores 0.91 to 0.94");

      // 4. The first three weeks' threshold: 12%, no ticket pair, but the ring test pair at 0.96 still matches.
      t.set("th", "95");
      t.expect(t.stat("hits") === 36 && t.stat("rate") === "12%" && t.stat("wrong") === 0 && t.stat("per") === 0.88 &&
        t.stat("ring") === "0.96: sent the saved answer, wrong",
        "0.95: 36 hits (12%), no wrong ticket answer, 0.88 a question; the ring pair at 0.96 gets the wrong answer");
      t.set("th", "90");

      // 5. Exact repeats only.
      t.set("rule", "exact");
      t.expect(t.stat("hits") === 9 && t.stat("rate") === "3%" && t.stat("wrong") === 0 && t.stat("per") === 0.97 &&
        t.stat("ring") === "asked the model: right",
        "Exact repeats only: 9 hits (3%), 0.97 a question, nothing wrong");
      t.set("rule", "meaning");

      // 6. Emptied at each shift change: tonight's pair sits in one shift.
      begin();
      t.set("life", "shift");
      t.expect(t.stat("hits") === 72 && t.stat("rate") === "24%" && t.stat("wrong") === 3 && t.stat("per") === 0.76 &&
        has("Answers about another ticket: Tue 16:10 ticket 4582 got 4528's (0.92); Thu 13:50 ticket 5160 got 5106's (0.91); Fri 02:20 ticket 4471 got 4417's (0.93)."),
        "Shift-change emptying: 72 hits (24%), 3 wrong; only Wednesday's 4793 is separated");
      t.set("life", "24h");

      // 7. Exact keys for named tickets, meaning for the rest.
      t.set("rule", "tickets");
      t.expect(t.stat("hits") === 75 && t.stat("rate") === "25%" && t.stat("wrong") === 0 && t.stat("calls") === 225 &&
        t.stat("per") === 0.75 && t.stat("last") === "asked the model: the gold ring",
        "Tickets exact: 75 hits (25%), none wrong; 4471 is answered by the model: the gold ring");

      // 8. Prompt caching the policy: the five-minute life barely changes anything; the one-hour life does.
      t.set("pc", "m5");
      var m5 = t.stat("reads") === 47 && t.stat("saves") === 178 && t.stat("cost") === 226.98 && t.stat("per") === 0.76;
      t.set("pc", "h1");
      t.expect(m5 && t.stat("reads") === 201 && t.stat("saves") === 24 && t.stat("cost") === 83.79 && t.stat("per") === 0.28,
        "Policy caching: five-minute life 47 reads, 178 saves, 0.76 a question; one-hour life 201 reads, 24 saves, 0.28");
      t.set("pc", "off");
      t.set("rule", "meaning");

      // 9. Replies 0 and 1.
      begin();
      t.set("plan", "r0");
      var r0 = has("36 hits of 300 (12%), 0 about another ticket") && has("Ring test pair: 0.96: sent the saved answer, wrong.");
      begin();
      t.set("plan", "r1");
      t.expect(r0 && has("9 hits of 300 (3%), 0 about another ticket") && has("falls only from 1.00 to 0.97"),
        "Replies 0 and 1: 12% and the ring pair still wrong; 3% and almost no saving");

      // 10. Replies 2 and 3.
      begin();
      t.set("plan", "r2");
      var r2 = has("72 hits of 300 (24%), 3 about another ticket") && has("never separates them");
      begin();
      t.set("plan", "r3");
      t.expect(r2 && has("75 hits of 300 (25%), 0 about another ticket. 225 model calls (201 read the saved policy, 24 saved it again), 83.79 full calls, 0.28 a question.") &&
        has("the model answered: the gold ring, last day Monday 9 November. Right.") &&
        has("five-minute life 0.76 (178 of 225 calls found the saved policy gone and saved it again)"),
        "Replies 2 and 3: emptying keeps 3 wrong; exact ticket keys and a one-hour policy cache: none wrong, 0.28 a question");
    }
  });
})();
