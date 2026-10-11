/* sims/s3e14-v1.0.0.js  (published as sims/s3e14.js)
   Case s3e14 "Maybe, Never": Vellmouth General Cemetery's three offline tallies. Kiosk: Bloom
   filter of 48,000 names. Gate counter: HyperLogLog over pass numbers. Board: count-min sketch over
   graves. Widget sim (tables in api.root).
   CHANGELOG
   v1.0.0 (2026-10-11) first version: Bloom 8 to 512 KiB, 1 to 8 hashes; 16 to 4,096 registers;
     width 64 to 2,048, depth 1 to 5; last year or January to March; the trust's plan (as now or
     each reply option); Next entry walks the story. selfTest: 12 assertions.

   Model and where each number comes from (rule 14; all checked by the selfTest):
   - hash32(s, seed): FNV-1a with the seed mixed into its start value, then fmix32. Seeds, chosen
     so the story happens: stream 1914-1917, Bloom 807 + r, HLL 18, count-min 179 + r.
   - Register: graves 1 to 48,000, "entry-<g>" except 22,540 = "edwige danquart"; lowercased.
   - Year: 160 visits a day x 365 = 58,400 (January to March: 14,400). Visitor p = hash("visit-"i)
     mod 15,000; nine-digit pass 100,000,000 + hash("card-"p) mod 900,000,000. 30% of visits go to
     12 well-known graves (weights 20 down to 1), the rest to the visitor's family grave.
   - Kiosk (m bits, k hashes, formula (1 - e^(-kn/m))^k): 524,288 bits (64 KiB), k 3: Corisande
     Farrant maybe (false positive), Edwige Danquart maybe, Ottwell Grenvold no; 263 of 20,000
     strangers ("visitor-i") maybe; 1.385%, 1 in 72; 0 of 48,000 buried names get no. k 7: 107.
     4,194,304 bits (512 KiB): Corisande no, 1 of 20,000, 0.004%, 1 in 26,013.
   - Counter (alpha_m from the paper; linear counting when E <= 2.5m with empty registers, logged):
     gate book 14,667; 1,024 registers 14,963, +296 (+2.02%), standard error 1.04 / 32 = 3.25%,
     about 486. 16: 11,909; 4,096: 14,904. January to March: 9,226 exact, 9,487; 4,096 registers
     use linear counting. A list at 4 bytes a pass: 58,668 bytes; 4 KiB (1,024) full on 7 January.
   - Board (estimate = smallest cell; bound (e / w) x N with probability 1 - e^-d): w 256, d 3,
     3,072 bytes: grave 22,540, 0 visits, shows 1,856, 4th; its cells hold graves 2,290 (2,602),
     18,802 (1,705) and 7,316 (3,513); cells 2,785, 1,856, 3,726. Bound 620, 95.0%; 3 of 48,000
     over it; 0 under. Top 20 holds the true top 10. w 512: 82, off the board, 0 over. d 5: 124.
     January to March: 469, 5th.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var GRAVES = 48000;
  var POOL = 15000;
  var PER_DAY = 160;
  var SEED = { stream: 1914, bloom: 807, hll: 18, cms: 179 };
  var PHANTOM = 22540;
  var PHANTOM_NAME = "Edwige Danquart";
  var PROBE = "Corisande Farrant";
  var STRANGERS = 20000;
  var LIST_BYTES = 4096;
  var SHORT = 20;
  var FAMOUS = [[7316, 20], [2290, 15], [40951, 12], [18802, 10], [26117, 9], [33484, 8], [11073, 7], [45620, 6], [5909, 5], [29338, 4], [14456, 3], [37725, 1]];
  var MONTHS = [["January", 31], ["February", 28], ["March", 31], ["April", 30], ["May", 31], ["June", 30], ["July", 31], ["August", 31], ["September", 30], ["October", 31], ["November", 30], ["December", 31]];

  var M_OPTS = [65536, 131072, 262144, 524288, 1048576, 2097152, 4194304];
  var REG_OPTS = [16, 64, 256, 1024, 4096];
  var W_OPTS = [64, 128, 256, 512, 1024, 2048];
  var STREAMS = [{ value: "year", label: "Last year: 58,400 visits" }, { value: "q1", label: "January to March only: 14,400 visits" }];
  var PLANS = [
    { value: "asnow", label: "As now: trust every tally as it reads" },
    { value: "ok", label: "Each where its error does no harm" },
    { value: "bigger", label: "A kiosk filter 8 times bigger" },
    { value: "list", label: "Keep every pass number in a list" },
    { value: "hand", label: "Unplug all three, count by hand" }
  ];

  /* ---------- small helpers ---------- */

  function hash32(s, seed) {
    var h = (0x811c9dc5 ^ Math.imul(seed >>> 0, 0x9e3779b1)) >>> 0;
    for (var i = 0; i < s.length; i++) {
      h = (h ^ s.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function signed(n) { return (n >= 0 ? "+" : "-") + fmt(Math.abs(n)); }
  function regName(g) { return g === PHANTOM ? PHANTOM_NAME.toLowerCase() : "entry-" + g; }
  function dayName(d) {
    for (var i = 0; i < MONTHS.length; i++) {
      if (d <= MONTHS[i][1]) return d + " " + MONTHS[i][0];
      d -= MONTHS[i][1];
    }
    return "after the year";
  }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ---------- the stream (cached per choice) ---------- */

  var cache = {};
  function stream(which) {
    if (cache[which]) return cache[which];
    var days = which === "q1" ? 90 : 365;
    var V = days * PER_DAY;
    var cum = [];
    var t = 0;
    FAMOUS.forEach(function (f) { t += f[1]; cum.push(t); });
    var passes = new Array(V);
    var graves = new Array(V);
    var exact = new Int32Array(GRAVES + 1);
    var seen = {};
    var distinct = 0;
    var overflow = 0;
    for (var i = 0; i < V; i++) {
      var p = hash32("visit-" + i, SEED.stream) % POOL;
      passes[i] = 100000000 + hash32("card-" + p, SEED.stream + 1) % 900000000;
      var u = hash32("choice-" + i, SEED.stream + 2) % 1000;
      if (u < 300) {
        var r = u % 100;
        var j = 0;
        while (cum[j] <= r) j++;
        graves[i] = FAMOUS[j][0];
      } else {
        graves[i] = 1 + hash32("home-" + p, SEED.stream + 3) % GRAVES;
      }
      exact[graves[i]] += 1;
      if (!seen[passes[i]]) {
        seen[passes[i]] = true;
        distinct += 1;
        if (distinct * 4 > LIST_BYTES && !overflow) overflow = Math.floor(i / PER_DAY) + 1;
      }
    }
    var order = [];
    for (var g = 1; g <= GRAVES; g++) order.push(g);
    order.sort(function (a, b) { return (exact[b] - exact[a]) || (a - b); });
    cache[which] = { V: V, passes: passes, graves: graves, exact: exact, distinct: distinct, overflow: overflow, trueTop: order.slice(0, 10) };
    return cache[which];
  }

  /* ---------- the three structures ---------- */

  function bloom(m, k) {
    var bits = new Uint8Array(m);
    var g;
    var r;
    for (g = 1; g <= GRAVES; g++) {
      var s = regName(g);
      for (r = 0; r < k; r++) bits[hash32(s, SEED.bloom + r) % m] = 1;
    }
    function has(name) {
      var x = String(name).toLowerCase();
      for (var q = 0; q < k; q++) if (!bits[hash32(x, SEED.bloom + q) % m]) return false;
      return true;
    }
    var fp = 0;
    for (var i = 1; i <= STRANGERS; i++) if (has("visitor-" + i)) fp += 1;
    var falseNo = 0;
    for (g = 1; g <= GRAVES; g++) if (!has(regName(g))) falseNo += 1;
    var f = Math.pow(1 - Math.exp(-k * GRAVES / m), k);
    return { has: has, fp: fp, falseNo: falseNo, f: f };
  }

  function hll(passes, m) {
    var b = Math.round(Math.log(m) / Math.LN2);
    var reg = new Uint8Array(m);
    for (var i = 0; i < passes.length; i++) {
      var x = hash32("pass-" + passes[i], SEED.hll);
      var j = x >>> (32 - b);
      var w = (x << b) >>> 0;
      var rank = w === 0 ? 32 - b + 1 : Math.clz32(w) + 1;
      if (rank > reg[j]) reg[j] = rank;
    }
    var alpha = m === 16 ? 0.673 : m === 32 ? 0.697 : m === 64 ? 0.709 : 0.7213 / (1 + 1.079 / m);
    var sum = 0;
    var zeros = 0;
    for (var q = 0; q < m; q++) {
      sum += Math.pow(2, -reg[q]);
      if (reg[q] === 0) zeros += 1;
    }
    var E = alpha * m * m / sum;
    var small = false;
    if (E <= 2.5 * m && zeros > 0) {
      E = m * Math.log(m / zeros);
      small = true;
    }
    return { est: Math.round(E), small: small };
  }

  function sketch(st, w, d) {
    var rows = [];
    var r;
    var g;
    for (r = 0; r < d; r++) rows.push(new Int32Array(w));
    var col = [];
    for (r = 0; r < d; r++) {
      var c = new Int32Array(GRAVES + 1);
      for (g = 1; g <= GRAVES; g++) c[g] = hash32("grave-" + g, SEED.cms + r) % w;
      col.push(c);
    }
    for (var i = 0; i < st.V; i++) for (r = 0; r < d; r++) rows[r][col[r][st.graves[i]]] += 1;
    var est = new Int32Array(GRAVES + 1);
    var order = [];
    for (g = 1; g <= GRAVES; g++) {
      var mn = Infinity;
      for (r = 0; r < d; r++) mn = Math.min(mn, rows[r][col[r][g]]);
      est[g] = mn;
      order.push(g);
    }
    order.sort(function (a, b) { return (est[b] - est[a]) || (a - b); });
    var bound = Math.round(Math.E / w * st.V);
    var over = 0;
    var under = 0;
    for (g = 1; g <= GRAVES; g++) {
      if (est[g] - st.exact[g] > bound) over += 1;
      if (est[g] < st.exact[g]) under += 1;
    }
    // For each row: the busiest grave that shares the phantom's cell.
    var mates = [];
    for (r = 0; r < d; r++) {
      var best = 0;
      for (g = 1; g <= GRAVES; g++) {
        if (g !== PHANTOM && col[r][g] === col[r][PHANTOM] && st.exact[g] > (best ? st.exact[best] : 0)) best = g;
      }
      mates.push({ grave: best, cell: rows[r][col[r][PHANTOM]] });
    }
    var short = order.slice(0, SHORT);
    var covered = st.trueTop.every(function (x) { return short.indexOf(x) >= 0; });
    return { est: est, top: order.slice(0, 10), bound: bound, conf: 1 - Math.exp(-d), over: over, under: under, mates: mates, covered: covered };
  }

  /* ---------- derived answers ---------- */

  function compute(S) {
    var C = S.C;
    var st = stream(C.stream);
    var bl = bloom(C.plan === "bigger" ? 4194304 : C.m, C.k);
    var hl = hll(st.passes, C.regs);
    var cm = sketch(st, C.w, C.d);
    var maybe = bl.has(PROBE);
    var se = Math.round(1.04 / Math.sqrt(C.regs) * hl.est);
    var rank = cm.top.indexOf(PHANTOM) + 1;
    var phantomOnBoard = rank > 0;
    var R = { st: st, bl: bl, hl: hl, cm: cm, maybe: maybe, se: se, rank: rank };
    var answer = maybe ? "may rest here" : "not in our register";
    if (C.plan === "ok") answer = maybe ? "perhaps: ask the office in the morning" : "not in our register";
    if (C.plan === "hand") answer = "no answer at night";
    R.answer = answer;
    var listText = fmt(st.distinct * 4) + " bytes; a 4 KiB list full on " + dayName(st.overflow);
    var report = fmt(hl.est);
    if (C.plan === "ok") report = fmt(hl.est) + " ± " + fmt(se);
    if (C.plan === "list") report = listText;
    if (C.plan === "hand") report = fmt(st.distinct) + " (exact, by hand)";
    R.report = report;
    var money = "the board's top 10" + (phantomOnBoard ? ", with grave " + fmt(PHANTOM) : "");
    if (C.plan === "ok") money = "exact count of the board's top " + SHORT + "; true top 10 all in it: " + (cm.covered ? "yes" : "no");
    if (C.plan === "hand") money = "exact counts from the gate book";
    R.money = money;
    R.listText = listText;
    return R;
  }

  function planLine(S, R) {
    var C = S.C;
    var st = R.st;
    var ph = "grave " + fmt(PHANTOM) + (R.rank ? " is still " + ordinal(R.rank) : " is off the board");
    if (C.plan === "asnow") {
      return "As now: the kiosk says " + R.answer + " for " + PROBE + ", the report prints " + fmt(R.hl.est) +
        " as the count, and the money goes to " + R.money + ".";
    }
    if (C.plan === "ok") {
      return "Each where its error does no harm: the kiosk says " + R.answer + "; the report prints " + R.report +
        "; the clerks count the board's top " + SHORT + " in the gate book, grave " + fmt(PHANTOM) + " has " +
        fmt(st.exact[PHANTOM]) + (R.rank && R.rank <= SHORT ? " and is dropped" : "") + ", and the true top 10 " +
        (R.cm.covered ? "were all on the shortlist." : "were not all on the shortlist.");
    }
    if (C.plan === "bigger") {
      return "A filter 8 times bigger (512 KiB): " + PROBE + " now gets " + R.answer + ", but " + fmt(R.bl.fp) + " of " +
        fmt(STRANGERS) + " other names still get may rest here, and the formula says 1 in " + fmt(Math.round(1 / R.bl.f)) +
        ". The report and the board are unchanged: " + ph + ".";
    }
    if (C.plan === "list") {
      return "Every pass number in a list: the stream needs " + fmt(st.distinct * 4) + " bytes, and the counter's 4 KiB was full on " +
        dayName(st.overflow) + ". The board is unchanged: " + ph + ".";
    }
    return "By hand at the gate: every count is exact (" + fmt(st.distinct) + " passes; grave " + fmt(PHANTOM) + " has " +
      fmt(st.exact[PHANTOM]) + "), but the kiosk is dark at night, so nobody gets an answer at 02:00, and the clerks tally " +
      fmt(st.V) + " visits by grave.";
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
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;");
    var parts = {};
    ["kiosk", "gate", "board", "plan"].forEach(function (k) {
      var sec = el("section", "min-width:0;");
      var h = el("h4", "margin:0 0 4px 0;font-size:13px;");
      var p = el("p", "margin:0;");
      sec.appendChild(h);
      sec.appendChild(p);
      parts[k] = { h: h, p: p, sec: sec };
      box.appendChild(sec);
    });
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["rank", "grave", "board shows", "gate book", "over by"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    parts.board.sec.appendChild(table);
    api.root.appendChild(box);
    return { el: el, parts: parts, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var st = R.st;
    var ui = S.ui;
    var mBits = C.plan === "bigger" ? 4194304 : C.m;
    var kib = mBits / 8192;
    ui.parts.kiosk.h.textContent = "The kiosk: a Bloom filter of " + fmt(GRAVES) + " names, " + fmt(mBits) + " bits (" + kib + " KiB), " + C.k + (C.k === 1 ? " hash" : " hashes");
    ui.parts.kiosk.p.textContent = PROBE + ": " + R.answer + ". " + PHANTOM_NAME + ": " + (R.bl.has(PHANTOM_NAME) ? "maybe" : "no") +
      ". Ottwell Grenvold: " + (R.bl.has("Ottwell Grenvold") ? "maybe" : "no") + ". Register names that get no: " + R.bl.falseNo +
      ". Strangers that get maybe: " + fmt(R.bl.fp) + " of " + fmt(STRANGERS) + "; formula " + (R.bl.f * 100).toFixed(3) + "%.";
    ui.parts.gate.h.textContent = "The gate counter: HyperLogLog, " + fmt(C.regs) + " registers (" + fmt(C.regs) + " bytes)";
    ui.parts.gate.p.textContent = "Counter: " + fmt(R.hl.est) + ". Gate book: " + fmt(st.distinct) + ". Difference " + signed(R.hl.est - st.distinct) +
      ". Standard error 1.04 / √" + fmt(C.regs) + " = " + (104 / Math.sqrt(C.regs)).toFixed(2) + "%, about " + fmt(R.se) + "." +
      (R.hl.small ? " Small-range correction (linear counting) applied." : "");
    ui.parts.board.h.textContent = "The board: count-min sketch, " + C.d + (C.d === 1 ? " row" : " rows") + " of " + fmt(C.w) + " cells (" + fmt(C.w * C.d * 4) + " bytes)";
    ui.parts.board.p.textContent = "Never under. Over by at most " + fmt(R.cm.bound) + " with probability at least " + (R.cm.conf * 100).toFixed(1) +
      "%. Graves over by more: " + fmt(R.cm.over) + " of " + fmt(GRAVES) + ".";
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    R.cm.top.forEach(function (g, i) {
      var tr = ui.el("tr");
      [String(i + 1), fmt(g) + (g === PHANTOM ? " (" + PHANTOM_NAME + ")" : ""), fmt(R.cm.est[g]), fmt(st.exact[g]), fmt(R.cm.est[g] - st.exact[g])].forEach(function (c) {
        tr.appendChild(ui.el("td", g === PHANTOM ? "font-weight:600;" : "", c));
      });
      ui.tbody.appendChild(tr);
    });
    ui.parts.plan.h.textContent = "The trust's plan";
    ui.parts.plan.p.textContent = planLine(S, R);

    S.stat.kiosk(R.answer);
    S.stat.fp(fmt(R.bl.fp) + " of " + fmt(STRANGERS));
    S.stat.formula((R.bl.f * 100).toFixed(3) + "% (1 in " + fmt(Math.round(1 / R.bl.f)) + ")");
    S.stat.falseNo(R.bl.falseNo);
    S.stat.exact(fmt(st.distinct));
    S.stat.hll(fmt(R.hl.est));
    S.stat.diff(signed(R.hl.est - st.distinct) + " (" + (R.hl.est >= st.distinct ? "+" : "") + ((R.hl.est - st.distinct) * 100 / st.distinct).toFixed(2) + "%)");
    S.stat.se((104 / Math.sqrt(C.regs)).toFixed(2) + "%, about " + fmt(R.se));
    S.stat.phantom("grave " + fmt(PHANTOM) + ": shows " + fmt(R.cm.est[PHANTOM]) + ", gate book " + fmt(st.exact[PHANTOM]) + (R.rank ? ", " + ordinal(R.rank) : ", off the board"));
    S.stat.bound(fmt(R.cm.bound) + ", with probability at least " + (R.cm.conf * 100).toFixed(1) + "%");
    S.stat.over(fmt(R.cm.over) + " of " + fmt(GRAVES));
    S.stat.under(R.cm.under);
    S.stat.memory(kib + " KiB, " + fmt(C.regs) + " bytes, " + fmt(C.w * C.d * 4) + " bytes");
    S.stat.list(R.listText);
    S.stat.report(R.report);
    S.stat.money(R.money);
  }

  // Every log line also goes to S.history, so self-tests don't depend on the log's 14-line cap.
  function say(api, msg, tone) {
    api.state.last = msg;
    api.state.history.push(msg);
    api.log(msg, tone);
  }

  function apply(api, what) {
    var S = api.state;
    S.R = compute(S);
    if (what) {
      var R = S.R;
      var tail = "";
      if (R.hl.small) tail = " The gate counter's raw estimate is under 2.5 times its registers, so it uses the small-range correction (linear counting).";
      say(api,what + tail, "");
    }
    draw(api);
  }

  /* ---------- the story's four entries ---------- */

  function event(api) {
    var S = api.state;
    var R = S.R;
    var st = R.st;
    var C = S.C;
    S.step += 1;
    var n = S.step;
    if (n === 1) {
      say(api,"02:00. A visitor types " + PROBE + ". The kiosk answers: " + R.answer + ".", R.maybe && C.plan !== "ok" && C.plan !== "hand" ? "warn" : "");
    } else if (n === 2) {
      say(api,"07:30. Phineas Coker checks the register: no " + PROBE + " has ever been buried here. At these settings " +
        fmt(R.bl.fp) + " of " + fmt(STRANGERS) + " strangers get maybe; the formula says " + (R.bl.f * 100).toFixed(3) + "%.", R.maybe ? "bad" : "ok");
    } else if (n === 3) {
      say(api,"09:00. The gate book counts " + fmt(st.distinct) + " unique passes. The gate counter says " + fmt(R.hl.est) + ": " +
        signed(R.hl.est - st.distinct) + ", against a standard error of " + (104 / Math.sqrt(C.regs)).toFixed(2) + "%, about " + fmt(R.se) + ".", "warn");
    } else if (n === 4) {
      var cells = R.cm.mates.map(function (x, i) {
        return "row " + (i + 1) + " shares a cell with " + (x.grave ? "grave " + fmt(x.grave) + " (" + fmt(st.exact[x.grave]) + " visits)" : "no visited grave") + ", cell " + fmt(x.cell);
      }).join("; ");
      say(api,"10:15. The board: grave " + fmt(PHANTOM) + ", " + PHANTOM_NAME + ", shows " + fmt(R.cm.est[PHANTOM]) +
        (R.rank ? ", " + ordinal(R.rank) + " most visited" : ", not on the board") + ". The gate book has " + fmt(st.exact[PHANTOM]) + ". " +
        cells + ". The board shows the smallest.", R.rank ? "bad" : "ok");
    } else {
      S.step = 4;
      say(api,"No more entries. Change a setting or the plan and read the tallies again.", "");
    }
  }

  /* ---------- the module ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i]) === String(v)) return list[i];
    return null;
  }

  DL.sims.define("s3e14", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { m: 524288, k: 3, regs: 1024, w: 256, d: 3, stream: "year", plan: "asnow" };
      S.step = 0;
      S.history = [];
      S.last = "";
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.next = api.control.button("next", "Next entry in the night", function () { event(api); });
      S.ctl.m = api.control.select("bloomM", "Kiosk filter size (bits)", M_OPTS.map(function (x) { return { value: x, label: fmt(x) + " (" + x / 8192 + " KiB)" }; }), 524288, function (v) {
        var x = pick(M_OPTS, v);
        if (x === null) return;
        S.C.m = Number(x);
        apply(api, "Kiosk filter: " + fmt(S.C.m) + " bits (" + S.C.m / 8192 + " KiB)." + (S.C.plan === "bigger" ? " The plan fixes it at 4,194,304 bits." : ""));
      });
      S.ctl.k = api.control.range("bloomK", "Kiosk hashes per name", 1, 8, 1, 3, function (v) {
        var x = Math.max(1, Math.min(8, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.k) return;
        S.C.k = x;
        apply(api, "Kiosk hashes per name: " + x + ".");
      });
      S.ctl.regs = api.control.select("regs", "Gate counter registers", REG_OPTS.map(function (x) { return { value: x, label: fmt(x) }; }), 1024, function (v) {
        var x = pick(REG_OPTS, v);
        if (x === null) return;
        S.C.regs = Number(x);
        apply(api, "Gate counter registers: " + fmt(S.C.regs) + ".");
      });
      S.ctl.w = api.control.select("cmW", "Board width (cells per row)", W_OPTS.map(function (x) { return { value: x, label: fmt(x) }; }), 256, function (v) {
        var x = pick(W_OPTS, v);
        if (x === null) return;
        S.C.w = Number(x);
        apply(api, "Board width: " + fmt(S.C.w) + " cells per row.");
      });
      S.ctl.d = api.control.range("cmD", "Board depth (rows)", 1, 5, 1, 3, function (v) {
        var x = Math.max(1, Math.min(5, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.d) return;
        S.C.d = x;
        apply(api, "Board depth: " + x + (x === 1 ? " row." : " rows."));
      });
      S.ctl.stream = api.control.select("stream", "Visits", STREAMS, "year", function (v) {
        if (v !== "year" && v !== "q1") return;
        S.C.stream = String(v);
        apply(api, "Visits: " + (v === "q1" ? "January to March only, 14,400." : "last year, 58,400."));
      });
      S.ctl.plan = api.control.select("plan", "How the trust uses the tallies", PLANS, "asnow", function (v) {
        var ok = PLANS.some(function (p) { return p.value === v; });
        if (!ok) return;
        S.C.plan = String(v);
        S.R = compute(S);
        say(api,planLine(S, S.R), v === "ok" ? "ok" : (v === "hand" ? "warn" : "bad"));
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        kiosk: api.stat("kiosk", "kiosk's answer for " + PROBE, "bad"),
        fp: api.stat("fp", "strangers the kiosk says maybe to", "warn"),
        formula: api.stat("formula", "false positive rate, formula", ""),
        falseNo: api.stat("falseNo", "buried names the kiosk says no to", "ok"),
        exact: api.stat("exact", "unique passes, gate book", ""),
        hll: api.stat("hll", "unique passes, gate counter", "warn"),
        diff: api.stat("diff", "counter against gate book", "warn"),
        se: api.stat("se", "counter's standard error", ""),
        phantom: api.stat("phantom", "the lonely grave on the board", "bad"),
        bound: api.stat("bound", "board over by at most", ""),
        over: api.stat("over", "graves over by more than that", "bad"),
        under: api.stat("under", "graves the board under-counts", "ok"),
        memory: api.stat("memory", "kiosk, counter, board memory", ""),
        list: api.stat("list", "a list of every pass number", ""),
        report: api.stat("report", "annual report prints", ""),
        money: api.stat("money", "restoration money goes by", "")
      };

      api.info("<strong>How to read it.</strong> The kiosk can say maybe to a name it never held, never no to one it did. The counter is off by about its standard error, either way. The board only over-counts: a grave shows the smallest of its shared cells.");

      apply(api, "");
      say(api,"9 January, 01:59. The three tallies hold last year: " + fmt(GRAVES) + " names in the kiosk, " + fmt(S.R.st.V) + " visits through the gate.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function hist() { return t.api.state.history; }
      function begin() { mark = hist().length; }
      function has(s) { return hist().slice(mark).join("\n").indexOf(s) >= 0; }

      // 1. Opening state: the night before the first entry.
      t.expect(t.stat("kiosk") === "may rest here" && t.stat("fp") === "263 of 20,000" && t.stat("formula") === "1.385% (1 in 72)" &&
        t.stat("falseNo") === 0 && t.stat("exact") === "14,667" && t.stat("hll") === "14,963" && t.stat("diff") === "+296 (+2.02%)" &&
        t.stat("se") === "3.25%, about 486" && t.stat("phantom") === "grave 22,540: shows 1,856, gate book 0, 4th" &&
        t.stat("bound") === "620, with probability at least 95.0%" && t.stat("over") === "3 of 48,000" && t.stat("under") === 0 &&
        t.logText().indexOf("9 January, 01:59.") >= 0 && t.logText().indexOf("02:00.") < 0,
        "Opens before 02:00: Corisande maybe, 14,963 against 14,667, grave 22,540 shows 1,856, 4th");

      // 2. The four entries of the night.
      begin();
      t.click("next");
      t.click("next");
      t.click("next");
      t.click("next");
      t.expect(has("02:00. A visitor types Corisande Farrant. The kiosk answers: may rest here.") &&
        has("07:30. Phineas Coker checks the register: no Corisande Farrant has ever been buried here. At these settings 263 of 20,000 strangers get maybe; the formula says 1.385%.") &&
        has("09:00. The gate book counts 14,667 unique passes. The gate counter says 14,963: +296, against a standard error of 3.25%, about 486.") &&
        has("10:15. The board: grave 22,540, Edwige Danquart, shows 1,856, 4th most visited. The gate book has 0. row 1 shares a cell with grave 2,290 (2,602 visits), cell 2,785; row 2 shares a cell with grave 18,802 (1,705 visits), cell 1,856; row 3 shares a cell with grave 7,316 (3,513 visits), cell 3,726. The board shows the smallest."),
        "The night: a stranger's maybe, +296 on 14,667, and 0 visits shown as 1,856");

      // 3. More hashes at the same size: Corisande clears, the rate drops but stays above zero.
      t.set("bloomK", 7);
      var k7 = t.stat("kiosk") === "not in our register" && t.stat("fp") === "107 of 20,000" && t.stat("falseNo") === 0;
      t.set("bloomK", 3);
      t.expect(k7 && t.stat("kiosk") === "may rest here", "7 hashes: Corisande no, 107 of 20,000 still maybe, no buried name gets no");

      // 4. A filter 8 times bigger: still not never.
      t.set("bloomM", 4194304);
      t.expect(t.stat("kiosk") === "not in our register" && t.stat("fp") === "1 of 20,000" && t.stat("formula") === "0.004% (1 in 26,013)" && t.stat("falseNo") === 0,
        "512 KiB: Corisande clears, 1 of 20,000 still maybe, 1 in 26,013");
      t.set("bloomM", 524288);

      // 5. Registers: fewer is worse, more is better, and the estimate is the sim's own.
      t.set("regs", 16);
      var r16 = t.stat("hll") === "11,909" && t.stat("se") === "26.00%, about 3,096";
      t.set("regs", 4096);
      var r4096 = t.stat("hll") === "14,904";
      t.set("regs", 1024);
      t.expect(r16 && r4096 && t.stat("hll") === "14,963", "16 registers: 11,909 (26% standard error); 4,096: 14,904; 1,024: 14,963");

      // 6. A wider board: the lonely grave drops off, nobody beats the bound.
      t.set("cmW", 512);
      var w512 = t.stat("phantom") === "grave 22,540: shows 82, gate book 0, off the board" && t.stat("over") === "0 of 48,000" && t.stat("under") === 0;
      t.set("cmW", 256);
      t.set("cmD", 5);
      var d5 = t.stat("phantom") === "grave 22,540: shows 124, gate book 0, off the board" && t.stat("under") === 0;
      t.set("cmD", 3);
      t.expect(w512 && d5 && t.stat("phantom") === "grave 22,540: shows 1,856, gate book 0, 4th",
        "512 cells: 82, off the board, 0 over; 5 rows: 124; never under");

      // 7. January to March: smaller stream, same kinds of error.
      t.set("stream", "q1");
      var q1 = t.stat("exact") === "9,226" && t.stat("hll") === "9,487" && t.stat("phantom") === "grave 22,540: shows 469, gate book 0, 5th" && t.stat("under") === 0;
      begin();
      t.set("regs", 4096);
      t.expect(q1 && has("small-range correction (linear counting)"), "January to March: 9,487 against 9,226; 469, 5th; 4,096 registers use linear counting");
      t.set("regs", 1024);
      t.set("stream", "year");

      // 8. The ok plan: each where its error does no harm.
      begin();
      t.set("plan", "ok");
      t.expect(t.stat("kiosk") === "perhaps: ask the office in the morning" && t.stat("report") === "14,963 ± 486" &&
        t.stat("money") === "exact count of the board's top 20; true top 10 all in it: yes" &&
        has("grave 22,540 has 0 and is dropped, and the true top 10 were all on the shortlist."),
        "OK plan: perhaps, 14,963 plus or minus 486, exact top 20 drops grave 22,540");

      // 9. The bigger filter plan: the kiosk improves, nothing else does.
      begin();
      t.set("plan", "bigger");
      t.expect(t.stat("kiosk") === "not in our register" && t.stat("report") === "14,963" && t.stat("money") === "the board's top 10, with grave 22,540" &&
        has("1 of 20,000 other names still get may rest here, and the formula says 1 in 26,013. The report and the board are unchanged: grave 22,540 is still 4th."),
        "Bigger filter: Corisande clears, 1 in 26,013 still maybe, grave 22,540 still 4th");

      // 10. The list plan: full in a week, board unchanged.
      begin();
      t.set("plan", "list");
      t.expect(t.stat("report") === "58,668 bytes; a 4 KiB list full on 7 January" &&
        has("the stream needs 58,668 bytes, and the counter's 4 KiB was full on 7 January. The board is unchanged: grave 22,540 is still 4th."),
        "List: 58,668 bytes, 4 KiB full on 7 January, grave 22,540 still 4th");

      // 11. By hand: exact, and dark at night.
      t.set("plan", "hand");
      t.expect(t.stat("kiosk") === "no answer at night" && t.stat("report") === "14,667 (exact, by hand)" && t.stat("money") === "exact counts from the gate book",
        "By hand: 14,667 exact, money by the gate book, and no answer at the kiosk at night");

      // 12. Reset: back to the night before 02:00.
      t.click("reset");
      t.expect(t.stat("kiosk") === "may rest here" && t.stat("hll") === "14,963" && t.stat("money") === "the board's top 10, with grave 22,540" && t.logText().indexOf("02:00.") < 0,
        "Reset returns to the opening state, before 02:00");
    }
  });
})();
