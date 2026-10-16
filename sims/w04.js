/* sims/w04-v1.0.0.js  (published as sims/w04.js)
   Workshop case w04 "The Missing Pennies": a workbench for Larkwater Rowing Club's camp expenses app,
   finished by Odgerel from Winifrith Torvaine's work order. Eight members in two crews, 61 expenses
   from Sunday 11 to Friday 16 October 2026, then the Simplify button, replayed one expense at a time.
   Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the design (as built: each share rounded down to the penny in
     pounds; each share rounded to the nearest penny; as built plus a check that passes within 5p;
     every expense settled on its own; whole pence with the odd pence on the payer's share and one
     netted payment per pair who shared costs), a later expense (none, or the head race entry on
     Saturday 7 November), Step, Run the camp, Reset. Shows each member's crew, paid, shares and
     balance, then the payments. Stats: expenses entered, owed to members, owed by members, the gap,
     the check, payments, payments between people who never shared a cost, what Ilektra is told to
     pay, what is left over. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Members, in list order: the four and its cox (Mehmet, Taddeo, Zlatko, Domagoj, Sulpicia) and
     the scullers (Ilektra, Vasudha, Yoshiro). No expense has a member of each crew in it.
   - An expense: who paid, the amount, and a split among some members: equal, exact amounts, or
     percentages. The payer's balance goes up by the amount; each sharer's goes down by the share.
   - Shares, by design:
       built, check  equal: Math.floor(pounds / count * 100) / 100, the share rounded down in pounds
                     (10 / 3 is 3.3333333333333335, stored as 3.33); percent: the same on
                     pounds * percent / 100; exact: as typed.
       nearest       Math.round instead of Math.floor.
       separate      shares as built; the payer collects only the other shares, so the payer's
                     balance goes up by the sum of the shares, not the amount.
       pence         amounts in whole pence; equal: pence / count rounded down, and the odd pence go
                     on the payer's own share (1,000p three ways: 333, 334 for the payer, 333);
                     percent: pence * percent / 100 rounded down, odd pence on the payer's share
                     (or the first sharer's, if the payer is not sharing). Both percentage
                     expenses in the data divide exactly, so this changes no number.
   - Payments, by design:
       built, nearest, check  Simplify: take each member's balance; the member who owes most pays
                     the member owed most, as much as either needs (ties go to the first in the list
                     order); repeat until nobody owes or nobody is owed.
       separate      one payment for each share of each expense, sharer to payer (a share of 0, or
                     the payer's own share, needs none).
       pence         one payment per pair: what each owes the other from expenses the other paid,
                     netted, so each payment carries the expenses behind it.
   - The check (design "check" only): balanced when the gap is under 5p.

   Where every number comes from (conventions rule 14; the case is content/s5/w04-v1.0.0.json).
   Given data: the 61 expenses in EXP below (day, time, payer, pence, what, split). Checked by a
   scratch script and by the selfTest:
   - Only three expenses do not split evenly in pence: #8 milk and bread, 1,000p three ways
     (3.33 each, 9.99); #22 launch fuel, 2,500p three ways (8.33 each, 24.99); #34 fuel, van,
     6,321p five ways (12.64 each, 63.20). Rounded down or to the nearest penny, each loses 1p.
     Every other equal or percentage split comes out exact, also in floating point.
   - As built after 61 expenses: Mehmet +808.71, Taddeo -170.94, Zlatko -171.59, Domagoj -275.23,
     Sulpicia -190.94, Ilektra -292.26, Vasudha +294.79, Yoshiro -2.51. Owed to members
     £1,103.50, owed by members £1,103.47: a gap of 3p.
   - Simplify, as built: Ilektra pays Mehmet £292.26; Domagoj pays Mehmet £275.23; Sulpicia pays
     Vasudha £190.94; Zlatko pays Mehmet £171.59; Taddeo pays Vasudha £103.85; Taddeo pays Mehmet
     £67.09; Yoshiro pays Mehmet £2.51. 7 payments, 4 between people who never shared a cost.
     Left over: Mehmet £0.03, owed by nobody.
   - Nearest penny: the same 61 shares, so the same 3p and 7 payments. With the head race (#62,
     Yoshiro, 2,000p three ways): 6.67 each, £20.01, so the gap is 3 - 1 = 2p, left on Yoshiro.
     As built with the head race: 6.66 each, £19.98, gap 3 + 2 = 5p, left on Yoshiro.
   - Check: 3p is under 5p, "balanced"; with the head race 5p is not.
   - Separate: 200 payments (Zlatko and Domagoj 33 each), none between strangers, gap 0p. Ilektra
     makes 19 payments, £310.46 in all (her shares of other people's expenses), and is paid £18.20
     (the others' shares of her two expenses): £292.26 net, as in every design.
   - Whole pence: Mehmet +808.71, Domagoj -275.24, Vasudha +294.78, Yoshiro -2.52, the rest as
     built; owed to and by members £1,103.49 each, gap 0p. 13 payments, one per pair with a
     balance, none between strangers. Ilektra pays Vasudha £194.03 (11 expenses) and Yoshiro £98.23
     (12 expenses). With the head race: 668, 666, 666 pence, £20.00.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var M = ["Mehmet", "Taddeo", "Zlatko", "Domagoj", "Sulpicia", "Ilektra", "Vasudha", "Yoshiro"];
  var FOUR = [0, 1, 2, 3, 4];
  var SCULL = [5, 6, 7];
  var DAYS = ["Sun 11 Oct", "Mon 12 Oct", "Tue 13 Oct", "Wed 14 Oct", "Thu 15 Oct", "Fri 16 Oct", "Sat 7 Nov"];

  // [day, time, payer, pence, what, split, who, exact pence or percents]
  var EXP = [
    [0, "13:10", 0, 24000, "van hire", "eq", FOUR],
    [0, "13:45", 0, 65000, "cottage, 5 nights", "eq", FOUR],
    [0, "15:30", 6, 45000, "caravan, 5 nights", "eq", SCULL],
    [0, "17:20", 1, 4835, "shop: dinner", "eq", FOUR],
    [0, "18:05", 7, 2460, "shop: dinner", "ex", SCULL, [840, 715, 905]],
    [0, "19:05", 2, 3500, "boat park", "eq", FOUR],
    [1, "07:30", 3, 2215, "shop: breakfast", "eq", FOUR],
    [1, "08:10", 6, 1000, "milk and bread", "eq", SCULL],
    [1, "09:00", 0, 6000, "launch hire", "eq", FOUR],
    [1, "10:00", 7, 3300, "launch fuel", "eq", SCULL],
    [1, "11:00", 3, 2750, "sun cream, plasters", "eq", FOUR],
    [1, "12:40", 4, 3870, "lunch", "eq", FOUR],
    [1, "13:05", 7, 3700, "pizza", "ex", SCULL, [1150, 1200, 1350]],
    [1, "16:15", 1, 1250, "tape and spares", "eq", FOUR],
    [1, "18:50", 2, 5160, "shop: dinner", "eq", FOUR],
    [1, "19:20", 6, 1350, "stove gas", "eq", SCULL],
    [1, "20:30", 0, 6800, "pub dinner", "ex", FOUR, [1450, 1200, 1620, 1180, 1350]],
    [1, "21:15", 4, 3250, "cinema", "eq", FOUR],
    [2, "07:25", 0, 2010, "shop: breakfast", "eq", FOUR],
    [2, "07:50", 5, 900, "ice creams", "ex", SCULL, [280, 310, 310]],
    [2, "09:05", 3, 6000, "launch hire", "eq", FOUR],
    [2, "11:30", 7, 2500, "launch fuel", "eq", SCULL],
    [2, "12:30", 1, 4125, "lunch", "eq", FOUR],
    [2, "13:15", 7, 4225, "shop: lunch", "ex", SCULL, [1420, 1275, 1530]],
    [2, "16:40", 2, 7500, "rowing machine hire", "eq", FOUR],
    [2, "17:30", 6, 2850, "shop: dinner", "ex", SCULL, [900, 975, 975]],
    [2, "18:40", 4, 4760, "shop: dinner", "eq", FOUR],
    [2, "19:30", 6, 2700, "boat park", "eq", SCULL],
    [2, "20:10", 0, 1500, "firewood", "eq", FOUR],
    [2, "21:00", 1, 8000, "rigger repair", "pc", [1, 2, 3], [40, 30, 30]],
    [3, "07:35", 2, 2340, "shop: breakfast", "eq", FOUR],
    [3, "08:20", 7, 2490, "chip shop", "ex", SCULL, [760, 810, 920]],
    [3, "09:00", 0, 6000, "launch hire", "eq", FOUR],
    [3, "11:45", 3, 6321, "fuel, van", "eq", FOUR],
    [3, "12:50", 1, 3950, "lunch", "eq", FOUR],
    [3, "13:30", 6, 1930, "shop: lunch", "ex", SCULL, [635, 590, 705]],
    [3, "16:20", 1, 4000, "swim passes", "eq", FOUR],
    [3, "17:50", 7, 4200, "shop: dinner", "eq", SCULL],
    [3, "18:30", 0, 5410, "shop: dinner", "eq", FOUR],
    [3, "19:10", 4, 6200, "pub dinner", "ex", FOUR, [1300, 1150, 1400, 1250, 1100]],
    [3, "20:45", 7, 1610, "cafe", "ex", SCULL, [480, 520, 610]],
    [3, "21:30", 2, 6400, "bowling", "ex", FOUR, [1280, 1280, 1280, 1280, 1280]],
    [4, "07:20", 4, 2105, "shop: breakfast", "eq", FOUR],
    [4, "09:10", 2, 6000, "launch hire", "eq", FOUR],
    [4, "10:30", 6, 1400, "laundrette", "ex", SCULL, [400, 400, 600]],
    [4, "12:20", 4, 5500, "lunch", "eq", FOUR],
    [4, "13:00", 0, 4470, "lunch", "eq", FOUR],
    [4, "16:30", 3, 1850, "physio tape", "eq", FOUR],
    [4, "17:40", 6, 1050, "shop: snacks", "ex", SCULL, [345, 290, 415]],
    [4, "18:30", 6, 3900, "pub dinner", "ex", SCULL, [1300, 1250, 1350]],
    [4, "19:00", 1, 5625, "chip shop", "eq", FOUR],
    [4, "20:30", 3, 3000, "pool table", "pc", FOUR, [20, 20, 20, 20, 20]],
    [5, "07:40", 0, 1760, "shop: breakfast", "eq", FOUR],
    [5, "09:15", 7, 6000, "fuel, drive home", "eq", SCULL],
    [5, "10:30", 4, 4000, "cottage cleaning", "eq", FOUR],
    [5, "12:15", 2, 3690, "lunch", "eq", FOUR],
    [5, "12:45", 5, 1800, "lunch", "ex", SCULL, [600, 550, 650]],
    [5, "13:30", 1, 3000, "ice and drinks", "eq", FOUR],
    [5, "15:20", 0, 7000, "fuel, van home", "eq", FOUR],
    [5, "16:00", 3, 1500, "car park", "eq", FOUR],
    [5, "19:40", 7, 2400, "takeaway", "eq", SCULL]
  ];
  var RACE = [6, "18:00", 7, 2000, "head race entry", "eq", SCULL];
  var TOL = 5;

  var DESIGNS = [
    { value: "built", label: "as built: each share rounded down to the penny, in pounds; simplify" },
    { value: "nearest", label: "each share rounded to the nearest penny; simplify" },
    { value: "check", label: "as built, plus a check that calls a gap under 5p balanced" },
    { value: "separate", label: "every expense settled on its own, never simplified" },
    { value: "pence", label: "whole pence, odd pence on the payer's share; one netted payment per pair who shared costs" }
  ];
  var SHORT = {
    built: "as built", nearest: "nearest penny", check: "as built with a 5p check",
    separate: "every expense on its own", pence: "whole pence, pairs netted"
  };
  var LATER = [
    { value: "none", label: "none: the camp as it was" },
    { value: "race", label: "the head race, Sat 7 Nov: Yoshiro pays £20.00 for the scullers" }
  ];

  /* ---------- helpers ---------- */

  function money(p) {
    var s = String(Math.floor(Math.abs(p) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var c = Math.abs(p) % 100;
    return (p < 0 ? "-" : "") + "£" + s + "." + (c < 10 ? "0" : "") + c;
  }
  function dec(p) { return (Math.floor(p / 100)) + "." + (p % 100 < 10 ? "0" : "") + (p % 100); }
  function signed(p) { return (p > 0 ? "+" : p < 0 ? "-" : "") + dec(Math.abs(p)); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function crewOf(m) { return m < 5 ? "four" : "sculls"; }

  /* ---------- the model ---------- */

  function shares(e, design) {
    var amt = e[3], who = e[6], out = [];
    if (e[5] === "ex") return e[7].slice();
    if (e[5] === "pc") {
      if (design === "pence") {
        var fl = e[7].map(function (pc) { return Math.floor(amt * pc / 100); });
        var odd = amt - fl.reduce(function (a, b) { return a + b; }, 0);
        var at = who.indexOf(e[2]);
        fl[at < 0 ? 0 : at] += odd;
        return fl;
      }
      return e[7].map(function (pc) {
        var v = amt / 100 * pc / 100;
        return Math.round((design === "nearest" ? Math.round(v * 100) : Math.floor(v * 100)));
      });
    }
    var n = who.length;
    var oddTo = who.indexOf(e[2]) < 0 ? 0 : who.indexOf(e[2]);
    for (var i = 0; i < n; i++) {
      if (design === "pence") out.push(Math.floor(amt / n) + (i === oddTo ? amt % n : 0));
      else if (design === "nearest") out.push(Math.round(amt / 100 / n * 100));
      else out.push(Math.round(Math.floor(amt / 100 / n * 100) / 100 * 100));
    }
    return out;
  }

  function camp(C) {
    var list = EXP.slice();
    if (C.later === "race") list.push(RACE);
    var bal = M.map(function () { return 0; });
    var paid = M.map(function () { return 0; });
    var owes = M.map(function () { return 0; });
    var pair = M.map(function () { return M.map(function () { return 0; }); });
    var pairExp = {};
    var together = {};
    var sep = [];
    var steps = [];
    list.forEach(function (e, k) {
      var s = shares(e, C.design);
      var sum = s.reduce(function (a, b) { return a + b; }, 0);
      var g0 = gapOf(bal);
      var credit = C.design === "separate" ? sum : e[3];
      bal[e[2]] += credit;
      paid[e[2]] += e[3];
      var all = [e[2]].concat(e[6]);
      all.forEach(function (a) { all.forEach(function (b) { together[a + "-" + b] = true; }); });
      e[6].forEach(function (m, i) {
        bal[m] -= s[i];
        owes[m] += s[i];
        if (m === e[2] || !s[i]) return;
        pair[m][e[2]] += s[i];
        var key = Math.min(m, e[2]) + "-" + Math.max(m, e[2]);
        pairExp[key] = (pairExp[key] || 0) + 1;
        sep.push([m, e[2], s[i]]);
      });
      var how = e[5] === "eq" ? "split equally " + e[6].length + " ways" :
        (e[5] === "ex" ? "exact amounts" : "by percentage " + e[7].join("/"));
      var msg = "#" + (k + 1) + " " + DAYS[e[0]] + " " + e[1] + " " + M[e[2]] + " paid " + money(e[3]) + ", " + e[4] +
        ", " + how + ": " + s.map(dec).join(" + ") + " = " + money(sum) + ".";
      var g = gapOf(bal);
      steps.push({ kind: "expense", day: e[0], time: e[1], msg: msg + " Gap was " + g0 + "p, now " + g + "p.",
        tone: sum === e[3] ? "" : "warn", bal: bal.slice(), paid: paid.slice(), owes: owes.slice(), n: k + 1 });
    });
    var pays = settle(C, bal, pair, pairExp, sep, together);
    var last = list[list.length - 1];
    steps.push({ kind: "simplify", day: last[0], time: C.later === "race" ? "21:00" : "21:52", pays: pays,
      bal: bal.slice(), paid: paid.slice(), owes: owes.slice(), n: list.length });
    return { list: list, steps: steps };
  }

  function gapOf(bal) {
    var to = 0, by = 0;
    bal.forEach(function (b) { if (b > 0) to += b; else by -= b; });
    return to - by;
  }

  function settle(C, bal, pair, pairExp, sep, together) {
    var out = [];
    if (C.design === "separate") {
      sep.forEach(function (p) { out.push({ from: p[0], to: p[1], p: p[2], exp: 1 }); });
    } else if (C.design === "pence") {
      for (var i = 0; i < M.length; i++) {
        for (var j = i + 1; j < M.length; j++) {
          var d = pair[i][j] - pair[j][i];
          var n = pairExp[i + "-" + j] || 0;
          if (d > 0) out.push({ from: i, to: j, p: d, exp: n });
          else if (d < 0) out.push({ from: j, to: i, p: -d, exp: n });
        }
      }
    } else {
      var b = bal.slice();
      for (;;) {
        var dbt = -1, cr = -1;
        for (var k = 0; k < b.length; k++) {
          if (b[k] < 0 && (dbt < 0 || b[k] < b[dbt])) dbt = k;
          if (b[k] > 0 && (cr < 0 || b[k] > b[cr])) cr = k;
        }
        if (dbt < 0 || cr < 0) break;
        var amt = Math.min(-b[dbt], b[cr]);
        b[dbt] += amt;
        b[cr] -= amt;
        out.push({ from: dbt, to: cr, p: amt, exp: 0 });
      }
      out.left = b;
    }
    out.forEach(function (p) { p.stranger = !together[p.from + "-" + p.to]; });
    return out;
  }

  function leftText(pays) {
    if (!pays.left) return "nothing";
    var parts = [];
    pays.left.forEach(function (v, i) { if (v > 0) parts.push(M[i] + " " + money(v) + ", owed by nobody"); });
    return parts.length ? parts.join("; ") : "nothing";
  }

  function ilektraText(C, pays) {
    var mine = pays.filter(function (p) { return p.from === 5; });
    if (C.design === "separate") {
      var tot = 0;
      mine.forEach(function (p) { tot += p.p; });
      return mine.length + " payments, " + money(tot) + " in all";
    }
    if (!mine.length) return "nothing";
    return "pays " + mine.map(function (p) { return M[p.to] + " " + money(p.p); }).join(" and ");
  }

  function checkText(C, gap) {
    if (C.design === "check") return gap < TOL ? "balanced: " + gap + "p is under 5p" : "NOT balanced: " + gap + "p";
    if (C.design === "pence") return gap === 0 ? "exact: 0p" : "out by " + gap + "p";
    return "no check";
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
      var t = el("table", "width:100%;font-size:12px;");
      var th = el("thead");
      var hr = el("tr");
      heads.forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
      th.appendChild(hr);
      t.appendChild(th);
      var tb = el("tbody");
      t.appendChild(tb);
      return { t: t, body: tb };
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var members = table(["member", "crew", "paid", "shares", "balance"]);
    box.appendChild(members.t);
    var payHead = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(payHead);
    var pays = table(["from", "to", "amount", "expenses behind it", "shared a cost?"]);
    box.appendChild(pays.t);
    api.root.appendChild(box);
    return { el: el, head: head, members: members.body, payHead: payHead, pays: pays.body };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var all = S.N.steps;
    var cur = S.shown ? all[S.shown - 1] : null;
    var bal = cur ? cur.bal : M.map(function () { return 0; });
    var paid = cur ? cur.paid : M.map(function () { return 0; });
    var owes = cur ? cur.owes : M.map(function () { return 0; });
    var done = cur && cur.kind === "simplify";
    S.ui.head.textContent = "design: " + SHORT[C.design] + ". later expense: " + pick(LATER, C.later).label +
      ". steps shown: " + S.shown + " of " + all.length + ".";
    clear(S.ui.members);
    M.forEach(function (name, i) {
      var tr = S.ui.el("tr");
      [name, crewOf(i), dec(paid[i]), dec(owes[i]), signed(bal[i])].forEach(function (c) { tr.appendChild(S.ui.el("td", "", c)); });
      S.ui.members.appendChild(tr);
    });
    clear(S.ui.pays);
    var pays = done ? cur.pays : [];
    S.ui.payHead.textContent = done ? pays.length + " payments" + (pays.length > 13 ? "; the first 13 shown" : "") + "." :
      "payments appear after the last step.";
    pays.slice(0, 13).forEach(function (p) {
      var tr = S.ui.el("tr");
      [M[p.from], M[p.to], money(p.p), p.exp ? String(p.exp) : "not shown", p.stranger ? "NEVER" : "yes"].forEach(function (c) {
        tr.appendChild(S.ui.el("td", "", c));
      });
      S.ui.pays.appendChild(tr);
    });
    var to = 0, by = 0;
    bal.forEach(function (b) { if (b > 0) to += b; else by -= b; });
    var strangers = pays.filter(function (p) { return p.stranger; }).length;
    S.stat.expenses(cur ? cur.n : 0);
    S.stat.owedTo(money(to));
    S.stat.owedBy(money(by));
    S.stat.gap(to - by);
    S.stat.check(checkText(C, to - by));
    S.stat.payments(pays.length);
    S.stat.strangers(strangers);
    S.stat.ilektra(done ? ilektraText(C, pays) : "not yet");
    S.stat.left(done ? leftText(pays) : "not yet");
    S.ctl.step.disable(S.shown >= all.length);
    S.ctl.play.disable(S.shown >= all.length);
  }

  function clockOf(s) {
    var hm = s.time.split(":");
    return Number(hm[0]) * 3600 + Number(hm[1]) * 60;
  }

  function summary(S, s) {
    var pays = s.pays;
    var strangers = pays.filter(function (p) { return p.stranger; }).length;
    var g = gapOf(s.bal);
    return "Settle up, " + DAYS[s.day] + " " + s.time + ", " + SHORT[S.C.design] + ": " + pays.length + " payments, " +
      strangers + " between people who never shared a cost. Gap " + g + "p. Ilektra: " + ilektraText(S.C, pays) +
      ". Left over: " + leftText(pays) + ".";
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < S.N.steps.length) {
      var s = S.N.steps[S.shown];
      S.shown += 1;
      api.clock = clockOf(s);
      if (s.kind === "simplify") {
        var bad = gapOf(s.bal) !== 0 || s.pays.some(function (p) { return p.stranger; });
        api.log(summary(S, s), bad ? "bad" : (s.pays.length > 13 ? "warn" : "ok"));
      } else {
        api.log(s.msg, s.tone);
      }
    }
  }

  function replay(api) {
    var S = api.state;
    S.N = camp(S.C);
    S.shown = 0;
    showTo(api, S.N.steps.length);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", later: "none" };
      S.N = camp(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.later = api.control.select("later", "a later expense", LATER, "none", function (v) {
        var o = pick(LATER, v);
        if (!o) return;
        S.C.later = String(o.value);
        replay(api);
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Run the camp", function () { showTo(api, S.N.steps.length); draw(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        expenses: api.stat("expenses", "expenses entered", ""),
        owedTo: api.stat("owedTo", "owed to members (plus balances)", ""),
        owedBy: api.stat("owedBy", "owed by members (minus balances)", ""),
        gap: api.stat("gap", "gap in pence: owed to minus owed by", "bad"),
        check: api.stat("check", "the app's check", "warn"),
        payments: api.stat("payments", "payments to settle up", ""),
        strangers: api.stat("strangers", "payments between people who never shared a cost", "bad"),
        ilektra: api.stat("ilektra", "what Ilektra is told to pay", "warn"),
        left: api.stat("left", "left over after the payments", "")
      };

      api.info("<strong>How to read it.</strong> Each step adds one expense: who paid, the amount, and each sharer's share. " +
        "The payer's balance goes up by what the design credits; each sharer's goes down by the share. A plus balance is owed " +
        "money, a minus balance owes it. The gap is what members are owed minus what members owe; it should be 0p. The last " +
        "step settles up and lists the payments, and whether the two people in each one ever shared a cost. Step moves one " +
        "expense; Run the camp runs the rest.");

      api.clock = 13 * 3600;
      api.log("Sun 11 Oct 13:00. 61 expenses are due by Friday night, then the settle-up at 21:52. Press Step or Run the camp.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the first expense.
      t.expect(t.stat("expenses") === 0 && t.stat("gap") === 0 && t.stat("payments") === 0 && t.stat("owedTo") === "£0.00" &&
        t.stat("ilektra") === "not yet" && has("61 expenses are due by Friday night"),
        "Opens on Sunday 11 October before expense 1: nothing entered, gap 0p");

      // 2. Eight steps: milk and bread, £10.00 three ways, loses a penny.
      for (var i = 0; i < 8; i++) t.click("step");
      t.expect(has("#8 Mon 12 Oct 08:10 Vasudha paid £10.00, milk and bread, split equally 3 ways: 3.33 + 3.33 + 3.33 = £9.99. Gap was 0p, now 1p.") &&
        t.stat("expenses") === 8 && t.stat("gap") === 1,
        "Expense 8: 3.33 three times is £9.99, and Vasudha is credited £10.00: a gap of 1p");

      // 3. The rest of the camp, as built.
      t.click("play");
      t.expect(has("#22 Tue 13 Oct 11:30 Yoshiro paid £25.00, launch fuel, split equally 3 ways: 8.33 + 8.33 + 8.33 = £24.99. Gap was 1p, now 2p.") &&
        has("#34 Wed 14 Oct 11:45 Domagoj paid £63.21, fuel, van, split equally 5 ways: 12.64 + 12.64 + 12.64 + 12.64 + 12.64 = £63.20. Gap was 2p, now 3p.") &&
        t.stat("expenses") === 61 && t.stat("gap") === 3 && t.stat("owedTo") === "£1,103.50" && t.stat("owedBy") === "£1,103.47",
        "After 61 expenses: owed to members £1,103.50, owed by members £1,103.47, a gap of 3p");

      // 4. Simplify, as built.
      t.expect(t.stat("payments") === 7 && t.stat("strangers") === 4 && t.stat("ilektra") === "pays Mehmet £292.26" &&
        t.stat("left") === "Mehmet £0.03, owed by nobody" && t.stat("check") === "no check" &&
        has("Settle up, Fri 16 Oct 21:52, as built: 7 payments, 4 between people who never shared a cost. Gap 3p."),
        "Simplify at 21:52: 7 payments, 4 between strangers; Ilektra pays Mehmet £292.26; Mehmet left owed 3p by nobody");

      // 5. Nearest penny: tonight is unchanged.
      t.set("design", "nearest");
      t.expect(t.stat("gap") === 3 && t.stat("payments") === 7 && t.stat("strangers") === 4 &&
        t.stat("ilektra") === "pays Mehmet £292.26" && t.stat("left") === "Mehmet £0.03, owed by nobody",
        "Nearest penny: the same three pennies, the same 7 payments");

      // 6. Nearest penny with the head race: the error turns the other way.
      t.set("later", "race");
      t.expect(has("#62 Sat 7 Nov 18:00 Yoshiro paid £20.00, head race entry, split equally 3 ways: 6.67 + 6.67 + 6.67 = £20.01. Gap was 3p, now 2p.") &&
        t.stat("gap") === 2 && t.stat("left") === "Yoshiro £0.02, owed by nobody",
        "Head race, nearest penny: 6.67 three times is £20.01; the gap becomes 2p");

      // 7. The 5p check: passes tonight, fails after the head race.
      t.set("design", "check");
      var failed = t.stat("gap") === 5 && t.stat("check") === "NOT balanced: 5p" &&
        has("#62 Sat 7 Nov 18:00 Yoshiro paid £20.00, head race entry, split equally 3 ways: 6.66 + 6.66 + 6.66 = £19.98. Gap was 3p, now 5p.");
      t.set("later", "none");
      t.expect(failed && t.stat("check") === "balanced: 3p is under 5p" && t.stat("gap") === 3 && t.stat("payments") === 7 &&
        t.stat("ilektra") === "pays Mehmet £292.26",
        "The check: balanced at 3p tonight, the same 7 payments; NOT balanced at 5p after the head race");

      // 8. Every expense on its own.
      t.set("design", "separate");
      t.expect(t.stat("payments") === 200 && t.stat("strangers") === 0 && t.stat("gap") === 0 &&
        t.stat("ilektra") === "19 payments, £310.46 in all" && t.stat("left") === "nothing",
        "Settled one expense at a time: 200 payments, none to a stranger, gap 0p");

      // 9. Whole pence, odd pence on the payer, one netted payment per pair.
      t.set("design", "pence");
      t.expect(has("#8 Mon 12 Oct 08:10 Vasudha paid £10.00, milk and bread, split equally 3 ways: 3.33 + 3.34 + 3.33 = £10.00. Gap was 0p, now 0p.") &&
        t.stat("gap") === 0 && t.stat("owedTo") === "£1,103.49" && t.stat("owedBy") === "£1,103.49" &&
        t.stat("payments") === 13 && t.stat("strangers") === 0 && t.stat("check") === "exact: 0p" &&
        t.stat("ilektra") === "pays Vasudha £194.03 and Yoshiro £98.23",
        "Whole pence: gap 0p, 13 payments between people who shared costs; Ilektra pays Vasudha £194.03 and Yoshiro £98.23");

      // 10. Whole pence with the head race: the odd pence go on Yoshiro's share.
      t.set("later", "race");
      t.expect(has("#62 Sat 7 Nov 18:00 Yoshiro paid £20.00, head race entry, split equally 3 ways: 6.66 + 6.66 + 6.68 = £20.00. Gap was 0p, now 0p.") &&
        t.stat("gap") === 0 && t.stat("strangers") === 0,
        "Whole pence, head race: 6.66 + 6.66 + 6.68 = £20.00, gap still 0p");
    }
  });
})();
