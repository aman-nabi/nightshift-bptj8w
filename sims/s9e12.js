/* sims/s9e12-v1.0.0.js  (published as sims/s9e12.js)
   Case s9e12 "The Review Board": a review lab for a council's night refuse depot on the night of
   Wednesday 21 to Thursday 22 October 2026 ("Wednesday night", the shift that starts at 00:00 on
   Thursday). Six crews empty city-centre bins; each crew lead's phone runs the crew app, which marks
   a street collected from the lorry's position while the crew is signed in. Two changes shipped this
   week, each approved by its own review: change A (security review, Tuesday 20 October) makes
   sign-ins last 1 hour instead of 24; change B (performance review, Wednesday 21 October, after
   Tuesday night's shift) makes the app refresh only when opened. The learner switches each change,
   picks how changes are reviewed, the reviewers per change and the minutes each code takes at the
   depot desk, then steps the night from 23:45 to 06:00 in 15-minute steps. Widget-style sim: it
   draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls change A, change B, how changes are reviewed (each
     alone, joint review, one architect), reviewers per change, minutes per code; buttons Next 15
     minutes, Play to 06:00, Reset. Stats: time, crews signed in, streets emptied, streets recorded,
     households on unrecorded streets, missed-bin texts sent, sign-ins last, app refreshes, a lost
     phone stays signed in, the clash, changes waiting for approval, teams reviewing their own
     changes, reviewers per change. selfTest: 10 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e12-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - 6 crews sign in and set off at 00:00. Each empties one street every 15 minutes, 24 streets a
     night: street s (0 to 23) is reached at 00:00 + 15s minutes. The app marks it collected when
     the lorry reaches it, if the crew is signed in at that moment.
   - Households a street, by crew (given data): 30, 20, 25, 15, 20, 23. So a night's routes hold
     24 x 133 = 3,192 households.
   - Sign-ins last 60 minutes with change A, 1,440 (24 hours) without. The app refreshes every 15
     minutes on its own unless change B ships; with B it refreshes only when opened, and nobody
     opens it on a route. A refresh renews the sign-in, so without B no crew is ever signed out.
   - Signing back in needs a code from the depot desk: one phone line, one supervisor, one code at a
     time, 15 minutes each (as run; 5 or 30 in the controls). Crews are served in the order they
     were signed out, lowest crew number first on a tie. Typing the code opens the app and starts a
     new sign-in.
   - With A and B and 15-minute codes: everyone out at 01:00; codes end at 01:15, 01:30, 01:45,
     02:00, 02:15, 02:30; crew 1 is out again at 02:15, an hour after its code; and so on. Streets
     reached while signed out, by crew: 7, 8, 8, 8, 9, 10 (50 of 144). Households: 7 x 30 = 210,
     8 x 20 = 160, 8 x 25 = 200, 8 x 15 = 120, 9 x 20 = 180, 10 x 23 = 230: 1,100 texts at 06:00.
     94 of 144 streets recorded. 5-minute codes: 372; 30-minute codes: 1,878.
   - A joint review, or one architect, reads both assumption lists before B ships and holds B until
     the app keeps its 15-minute refresh during a route: 0 texts, sign-ins still 1 hour.
   - One architect (given data): the council's 5 software teams send about 15 changes a week and one
     architect reads about 10, so after 4 weeks 20 changes wait; no team reviews its own changes.
   - Reviewers per change: 2 (as run) or 4. Each still reads one change, so the night is unchanged.
   - A lost phone stays signed in for up to the sign-in length: 1 hour with A, 24 hours without.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after midnight) ---------- */

  var START = -15;            // 23:45, the sim opens here
  var STEP = 15;              // minutes a step
  var LAST = 25;              // 25 steps: 00:00 to 06:00
  var STREETS = 24;           // streets a crew reaches in a night
  var END = 360;              // 06:00, the texts go out
  var HH = [30, 20, 25, 15, 20, 23];   // households a street, crews 1 to 6
  var WAITING = 20;           // changes waiting for one architect after 4 weeks (15 in, 10 read a week)

  var ONOFF_A = [
    { value: "on", label: "shipped: sign-ins last 1 hour (as run)" },
    { value: "off", label: "undone: sign-ins last 24 hours" }
  ];
  var ONOFF_B = [
    { value: "on", label: "shipped: refresh only when opened (as run)" },
    { value: "off", label: "not shipped: refresh every 15 minutes" }
  ];
  var REVIEWS = [
    { value: "alone", label: "each change in its own review (as run)" },
    { value: "joint", label: "joint review: both assumption lists, every team" },
    { value: "architect", label: "one architect approves every change" }
  ];
  var REVIEWERS = [{ value: "2", label: "2 (as run)" }, { value: "4", label: "4" }];
  var CODES = [{ value: "5", label: "5 minutes" }, { value: "15", label: "15 minutes (as run)" }, { value: "30", label: "30 minutes" }];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { var m = ((t % 1440) + 1440) % 1440; return two(Math.floor(m / 60)) + ":" + two(m % 60); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function list(ns) {
    if (ns.length === 1) return "crew " + ns[0];
    return "crews " + ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1];
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function both(C) { return C.a === "on" && C.b === "on"; }
  function held(C) { return both(C) && C.review !== "alone"; }
  function refreshes(C) { return C.b === "off" || held(C); }
  function life(C) { return C.a === "on" ? 60 : 1440; }

  // The whole night at once: who is signed in when each street is reached, and every sign-out and code.
  function night(C) {
    var L = life(C);
    var crews = HH.map(function (h, i) {
      return { n: i + 1, h: h, exp: refreshes(C) ? Infinity : L, waiting: false, outAt: 0, inAt: 0, rec: [], events: [] };
    });
    var deskFree = 0;
    var queue = [];
    var events = [];
    var code = Number(C.code);
    function advance(t) {
      var moved = true;
      while (moved) {
        moved = false;
        crews.forEach(function (c) {
          if (!c.waiting && c.exp <= t) {
            c.waiting = true;
            c.outAt = c.exp;
            events.push({ t: c.exp, kind: "out", n: c.n, since: c.inAt });
            queue.push(c);
            moved = true;
          }
        });
        queue.sort(function (x, y) { return (x.outAt - y.outAt) || (x.n - y.n); });
        if (queue.length) {
          var c = queue[0];
          var done = Math.max(deskFree, c.outAt) + code;
          if (done <= t && done <= END) {
            queue.shift();
            deskFree = done;
            c.waiting = false;
            c.inAt = done;
            c.exp = done + L;
            events.push({ t: done, kind: "in", n: c.n });
            moved = true;
          }
        }
      }
    }
    for (var s = 0; s < STREETS; s++) {
      advance(s * STEP);
      crews.forEach(function (c) { c.rec.push(!c.waiting); });
    }
    advance(END);
    events.sort(function (x, y) { return (x.t - y.t) || (x.kind === y.kind ? x.n - y.n : (x.kind === "out" ? -1 : 1)); });
    return { crews: crews, events: events };
  }

  // The state after step k (k = 0 is 23:45; k = 1 is 00:00, the first street; k = 25 is 06:00).
  function state(C, k, N) {
    var t = START + k * STEP;
    var reached = Math.max(0, Math.min(STREETS, k));
    var rows = N.crews.map(function (c) {
      var rec = 0;
      var missed = 0;
      for (var s = 0; s < reached; s++) {
        if (c.rec[s]) rec++; else missed += c.h;
      }
      var inNow = k >= 1 && (k > STREETS ? !c.waiting : (function () {
        var on = true;
        N.events.forEach(function (e) { if (e.n === c.n && e.t <= t) on = e.kind === "in"; });
        return on;
      })());
      return { n: c.n, h: c.h, emptied: reached, rec: rec, missed: missed, inNow: inNow };
    });
    var emptied = 0, rec = 0, missed = 0, inCount = 0;
    rows.forEach(function (r) { emptied += r.emptied; rec += r.rec; missed += r.missed; if (r.inNow) inCount++; });
    return { k: k, t: t, rows: rows, emptied: emptied, rec: rec, missed: missed, inCount: inCount, texts: k >= LAST ? missed : 0 };
  }

  function clashText(C) {
    if (!both(C)) return "none: only one change ships";
    if (C.review === "alone") return "not seen by either review";
    return C.review === "joint" ? "flagged by the joint review" : "flagged by the architect";
  }
  function lostText(C) { return C.a === "on" ? "up to 1 hour" : "up to 24 hours"; }
  function lifeText(C) { return C.a === "on" ? "1 hour" : "24 hours"; }
  function refreshText(C) { return refreshes(C) ? "every 15 minutes" : "only when opened"; }

  function describe(C) {
    return "change A " + C.a + ", change B " + C.b + (held(C) ? " (held until the refresh stays)" : "") + ", " +
      pick(REVIEWS, C.review).label + ", " + C.reviewers + " reviewers per change, " + C.code + " minutes a code";
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
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "The six crews"));
    var t1 = table(["crew", "households a street", "signed in?", "streets emptied", "recorded", "households unrecorded"]);
    box.appendChild(t1.wrap);
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "The assumption list: what each change relies on"));
    var t2 = table(["change", "its review", "assumes", "true tonight?", "read by the other team?"]);
    box.appendChild(t2.wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, b1: t1.body, b2: t2.body, sum: sum };
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
    var st = state(C, S.k, S.N);
    ui.head.textContent = "Set-up: " + describe(C) + ".";
    clear(ui.b1);
    st.rows.forEach(function (r) {
      row(ui, ui.b1, ["crew " + r.n, r.h, S.k < 1 ? "not yet" : r.inNow ? "yes" : "signed out", r.emptied, r.rec, num(r.missed)]);
    });
    clear(ui.b2);
    var seen = C.review === "alone" ? "no" : C.review === "joint" ? "yes, in the joint review" : "only the architect";
    row(ui, ui.b2, [C.a === "on" ? "A: sign-ins last 1 hour" : "A: undone", "security review",
      "the app refreshes every 15 minutes, as now", C.a === "off" ? "not shipped" : refreshes(C) ? "yes" : "no: change B stops it", C.a === "off" ? "-" : seen]);
    row(ui, ui.b2, [C.b === "off" ? "B: not shipped" : held(C) ? "B: held until the refresh stays" : "B: refresh only when opened", "performance review",
      "sign-ins last 24 hours, as now", C.b === "off" ? "not shipped" : held(C) ? "held before release" : C.a === "on" ? "no: change A ends them at 1 hour" : "yes", C.b === "off" ? "-" : seen]);
    S.stat.time(hm(st.t));
    S.stat.signedin(st.inCount + " of 6");
    S.stat.emptied(st.emptied);
    S.stat.recorded(st.rec);
    S.stat.unrec(num(st.missed));
    S.stat.texts(num(st.texts));
    S.stat.life(lifeText(C));
    S.stat.refresh(refreshText(C));
    S.stat.lost(lostText(C));
    S.stat.clash(clashText(C));
    S.stat.waiting(C.review === "architect" ? WAITING : 0);
    S.stat.teams(C.review === "architect" ? "0 of 5" : "5 of 5");
    S.stat.reviewers(Number(C.reviewers));
    ui.sum.textContent = "At " + hm(st.t) + ": " + st.emptied + " streets emptied, " + st.rec + " recorded; " +
      num(st.missed) + " households on unrecorded streets" + (S.k >= LAST ? ", each sent a missed-bin text." : ".");
  }

  function change(api, what) {
    var S = api.state;
    S.k = 0;
    S.N = night(S.C);
    api.log(what + " Set back to 23:45.", "");
    if (both(S.C) && S.C.review !== "alone") {
      api.log((S.C.review === "joint" ? "Joint review" : "The architect") + ", before release: A assumes a refresh every 15 minutes; B removes it. B is held until the app keeps its refresh during a route.", "ok");
    }
    draw(api);
  }

  function events(api, prevT, st) {
    var S = api.state;
    if (st.k === 1) api.log("00:00 crews 1 to 6 sign in and set off. Sign-ins last " + lifeText(S.C) + "; the app refreshes " + refreshText(S.C) + ".", "");
    var now = S.N.events.filter(function (e) { return e.t > prevT && e.t <= st.t; });
    var times = [];
    now.forEach(function (e) { if (times.indexOf(e.t) < 0) times.push(e.t); });
    times.forEach(function (tt) {
      var es = now.filter(function (e) { return e.t === tt && e.kind === "out"; });
      if (es.length) {
        var first = es.every(function (e) { return e.since === 0; });
        api.log(hm(tt) + " " + list(es.map(function (e) { return e.n; })) + " signed out: 'Ask the depot desk for a code.' " +
          (first ? (es.length === 6 ? "Six calls to the desk in one minute." : "First sign-out of the night.") : "One hour after its code at " + hm(es[0].since) + "."), "bad");
      }
      now.forEach(function (e) {
        if (e.t === tt && e.kind === "in") api.log(hm(e.t) + " crew " + e.n + " signed back in with a code from the desk.", "warn");
      });
    });
    if (st.k === LAST) {
      api.log("06:00 missed-bin texts sent: " + num(st.texts) + ". " + st.rec + " of " + st.emptied + " streets recorded; every street was emptied.", st.texts ? "bad" : "ok");
    }
  }

  function stepOnce(api) {
    var S = api.state;
    var prevT = START + S.k * STEP;
    S.k += 1;
    events(api, prevT, state(S.C, S.k, S.N));
  }

  function step(api) {
    if (api.state.k >= LAST) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    stepOnce(api);
    draw(api);
  }

  function play(api) {
    if (api.state.k >= LAST) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    while (api.state.k < LAST) stepOnce(api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e12", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { a: "on", b: "on", review: "alone", reviewers: "2", code: "15" };
      S.k = 0;
      S.N = night(S.C);
      S.ui = buildWidget(api);

      function sel(id, label, opts, key) {
        api.control.select(id, label, opts, S.C[key], function (v) {
          var o = pick(opts, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("a", "Change A, the security change", ONOFF_A, "a");
      sel("b", "Change B, the app team's change", ONOFF_B, "b");
      sel("review", "How changes are reviewed", REVIEWS, "review");
      sel("reviewers", "Reviewers per change", REVIEWERS, "reviewers");
      sel("code", "Minutes per code at the desk", CODES, "code");
      api.control.button("step", "Next 15 minutes", function () { step(api); });
      api.control.button("run", "Play to 06:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        signedin: api.stat("signedin", "crews signed in", ""),
        emptied: api.stat("emptied", "streets emptied", ""),
        recorded: api.stat("recorded", "streets recorded", "ok"),
        unrec: api.stat("unrec", "households on unrecorded streets", "warn"),
        texts: api.stat("texts", "missed-bin texts sent", "bad"),
        life: api.stat("life", "sign-ins last", ""),
        refresh: api.stat("refresh", "the app refreshes", ""),
        lost: api.stat("lost", "a lost phone stays signed in", "warn"),
        clash: api.stat("clash", "the clash between A and B", "bad"),
        waiting: api.stat("waiting", "changes waiting for approval", "warn"),
        teams: api.stat("teams", "teams reviewing their own changes", ""),
        reviewers: api.stat("reviewers", "reviewers per change", "")
      };

      api.info("<strong>How to read it.</strong> The first table is the six crews: households on each of their streets, whether the crew is signed in now, and streets emptied against streets the app recorded. The second is the assumption list: what each change relies on, whether that is still true tonight, and whether the other team ever read it. As run, neither list was written down.");

      api.log("Wednesday 21 October 2026, 23:45, as run: change A shipped Tuesday, change B shipped Wednesday morning, each approved by its own review. Six crews ready to sign in at 00:00.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { a: "on", b: "on", review: "alone", reviewers: "2", code: "15" };
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }
      function stepTo(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: 23:45, before the crews sign in; both changes shipped, each reviewed alone.
      t.expect(t.stat("time") === "23:45" && t.stat("signedin") === "0 of 6" && t.stat("emptied") === 0 && t.stat("recorded") === 0 &&
        t.stat("texts") === 0 && t.stat("life") === "1 hour" && t.stat("refresh") === "only when opened" &&
        t.stat("clash") === "not seen by either review" && t.stat("waiting") === 0 && t.stat("reviewers") === 2 && has("23:45, as run"),
        "Opens at 23:45: no crew signed in yet, sign-ins 1 hour, refresh only when opened, the clash unseen");

      // 2. 01:00: every crew signed out at once, exactly an hour after signing in; six calls.
      begin();
      stepTo(5);
      t.expect(t.stat("time") === "01:00" && t.stat("signedin") === "0 of 6" && t.stat("emptied") === 30 && t.stat("recorded") === 24 &&
        has("01:00 crews 1, 2, 3, 4, 5 and 6 signed out: 'Ask the depot desk for a code.' Six calls to the desk in one minute."),
        "01:00: all 6 crews signed out mid-route, 30 streets emptied and 24 recorded, six calls");

      // 3. Crew 1 is signed out again at 02:15, an hour after its code at 01:15.
      begin();
      stepTo(5);
      t.expect(t.stat("time") === "02:15" && has("01:15 crew 1 signed back in with a code from the desk.") &&
        has("02:15 crew 1 signed out: 'Ask the depot desk for a code.' One hour after its code at 01:15."),
        "15-minute codes: crew 1 back at 01:15 and out again at 02:15");

      // 4. Play to 06:00: 1,100 missed-bin texts, 94 of 144 streets recorded.
      begin();
      t.click("run");
      t.expect(t.stat("time") === "06:00" && t.stat("texts") === "1,100" && t.stat("emptied") === 144 && t.stat("recorded") === 94 &&
        has("06:00 missed-bin texts sent: 1,100. 94 of 144 streets recorded; every street was emptied."),
        "Both changes, each reviewed alone: 1,100 texts at 06:00, 94 of 144 streets recorded");

      // 5. Change A alone, then change B alone: 0 missed.
      as({ b: "off" });
      t.click("run");
      var aOnly = t.stat("texts") === 0 && t.stat("recorded") === 144 && t.stat("lost") === "up to 1 hour";
      as({ a: "off" });
      t.click("run");
      t.expect(aOnly && t.stat("texts") === 0 && t.stat("recorded") === 144 && t.stat("life") === "24 hours",
        "Each change alone: A alone and B alone both record all 144 streets, 0 texts");

      // 6. Undo the security change: 0 missed, but a lost phone stays signed in for up to 24 hours.
      as({ a: "off" });
      t.click("run");
      t.expect(t.stat("texts") === 0 && t.stat("lost") === "up to 24 hours" && t.stat("clash") === "none: only one change ships",
        "Undo A: 0 texts, and a lost phone stays signed in for up to 24 hours again");

      // 7. Joint review: the clash is flagged before release, B is held, sign-ins stay 1 hour, 0 missed.
      begin();
      as({ review: "joint" });
      t.click("run");
      t.expect(t.stat("texts") === 0 && t.stat("signedin") === "6 of 6" && t.stat("lost") === "up to 1 hour" &&
        t.stat("clash") === "flagged by the joint review" && t.stat("waiting") === 0 && t.stat("teams") === "5 of 5" &&
        has("Joint review, before release: A assumes a refresh every 15 minutes; B removes it."),
        "Joint review: the clash is flagged before release, 0 texts, sign-ins still 1 hour, 5 of 5 teams still review");

      // 8. Four reviewers per change, each change still reviewed alone: still 1,100.
      as({ reviewers: "4" });
      t.click("run");
      t.expect(t.stat("texts") === "1,100" && t.stat("reviewers") === 4 && t.stat("clash") === "not seen by either review",
        "4 reviewers per change: each still reads one change, 1,100 texts");

      // 9. One architect: catches the clash, 0 missed, but 20 changes wait and no team reviews its own.
      as({ review: "architect" });
      t.click("run");
      t.expect(t.stat("texts") === 0 && t.stat("clash") === "flagged by the architect" && t.stat("waiting") === 20 && t.stat("teams") === "0 of 5",
        "One architect: 0 texts, but 20 changes waiting after 4 weeks and 0 of 5 teams reviewing");

      // 10. Minutes per code: faster codes shrink the loss, slower ones grow it; none removes it.
      as({ code: "5" });
      t.click("run");
      var fast = t.stat("texts");
      as({ code: "30" });
      t.click("run");
      t.expect(fast === 372 && t.stat("texts") === "1,878",
        "Minutes per code: 5 minutes gives 372 texts, 30 minutes gives 1,878");
    }
  });
})();
